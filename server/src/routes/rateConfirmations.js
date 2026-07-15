import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/connection.js';
import { requireAuth, requirePermission, logDenial } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { loadInScope } from '../lib/scope.js';

const router = Router();
router.use(requireAuth);

// POST /loads/:loadId/rate-confirmations
// Confirms (or renegotiates) a rate. Never UPDATEs an existing row --
// always inserts a new version and supersedes the previous CONFIRMED one.
// A load's confirmed_rate_version_id always points at the version that
// was actually agreed, so old audit history is never rewritten.
router.post('/:loadId/rate-confirmations', requirePermission(PERMISSIONS.RATE_CONFIRM), (req, res) => {
  const load = db.prepare('SELECT * FROM loads WHERE id = ?').get(req.params.loadId);
  if (!load) return res.status(404).json({ error: 'Load not found' });
  if (!loadInScope(req.user, load)) {
    logDenial(req, 'out_of_scope_load');
    return res.status(403).json({ error: "Load is not in your organization's scope" });
  }
  if (load.status !== 'CARRIER_ASSIGNED' && load.status !== 'RATE_CONFIRMED') {
    return res.status(400).json({ error: `Cannot confirm rate while load is ${load.status}` });
  }

  const { baseRate, accessorials, overrideReason } = req.body;

  // Rate confirmation is the action that actually moves a load past
  // CARRIER_ASSIGNED, so the compliance gate lives here rather than on a
  // generic status-transition endpoint. Same rule as everywhere else:
  // Admin bypass or explicit load.override_compliance_flag permission,
  // and every override is written to the audit trail with its reason.
  let isOverride = false;
  if (load.compliance_flag) {
    const canOverride = req.user.is_org_admin || req.user.permissions.has(PERMISSIONS.LOAD_OVERRIDE_COMPLIANCE_FLAG);
    if (!canOverride) {
      logDenial(req, `missing_permission:${PERMISSIONS.LOAD_OVERRIDE_COMPLIANCE_FLAG}`);
      return res.status(403).json({
        error: `Blocked by compliance flag: ${load.compliance_flag_reason}. Requires load.override_compliance_flag to proceed.`,
        code: 'COMPLIANCE_BLOCKED',
      });
    }
    isOverride = true;
  }
  if (typeof baseRate !== 'number' || baseRate <= 0) {
    return res.status(400).json({ error: 'baseRate must be a positive number' });
  }

  const prevMax = db.prepare(
    'SELECT MAX(version) as v FROM rate_confirmations WHERE load_id = ?'
  ).get(load.id).v || 0;
  const newVersion = prevMax + 1;
  const id = uuid();

  const txn = db.transaction(() => {
    db.prepare(`UPDATE rate_confirmations SET status = 'SUPERSEDED' WHERE load_id = ? AND status = 'CONFIRMED'`)
      .run(load.id);
    db.prepare(
      `INSERT INTO rate_confirmations (id, load_id, version, base_rate, accessorials, status, confirmed_by)
       VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?)`
    ).run(id, load.id, newVersion, baseRate, JSON.stringify(accessorials || []), req.user.id);
    const flagClear = isOverride ? `, compliance_flag = 0, compliance_flag_reason = NULL` : '';
    db.prepare(`UPDATE loads SET confirmed_rate_version_id = ?, status = 'RATE_CONFIRMED', updated_at = datetime('now')${flagClear} WHERE id = ?`)
      .run(id, load.id);
    db.prepare(
      `INSERT INTO load_events (id, load_id, event_type, from_status, to_status, actor_user_id, metadata)
       VALUES (?, ?, 'RATE_CONFIRMED', ?, 'RATE_CONFIRMED', ?, ?)`
    ).run(uuid(), load.id, load.status, req.user.id, JSON.stringify({ version: newVersion, baseRate }));

    if (isOverride) {
      db.prepare(
        `INSERT INTO load_events (id, load_id, event_type, from_status, to_status, actor_user_id, metadata)
         VALUES (?, ?, 'COMPLIANCE_OVERRIDE', ?, 'RATE_CONFIRMED', ?, ?)`
      ).run(uuid(), load.id, load.status, req.user.id, JSON.stringify({ reason: overrideReason || null }));
    }
  });
  txn();

  res.status(201).json(db.prepare('SELECT * FROM rate_confirmations WHERE id = ?').get(id));
});

export default router;
