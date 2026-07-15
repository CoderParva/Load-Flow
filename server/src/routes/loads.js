import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/connection.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { loadScopeClause, loadInScope } from '../lib/scope.js';
import { transition, assignCarrierAndFlag, TransitionError } from '../lib/loadStateMachine.js';
import { logDenial } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function getLoadOr404(req, res) {
  const load = db.prepare('SELECT * FROM loads WHERE id = ?').get(req.params.id);
  if (!load) {
    res.status(404).json({ error: 'Load not found' });
    return null;
  }
  // Object-level scope check independent of any permission the user holds.
  if (!loadInScope(req.user, load)) {
    logDenial(req, 'out_of_scope_load');
    res.status(403).json({ error: 'Load is not in your organization\'s scope' });
    return null;
  }
  return load;
}

// GET /loads -- list, scoped to caller's org, with search/filter for the
// broker load board (origin, destination, status, equipment_type).
router.get('/', (req, res) => {
  const { clause, params } = loadScopeClause(req.user);
  const filters = [];
  const filterParams = [];
  const { origin, destination, status, equipment_type } = req.query;
  if (origin) { filters.push('origin LIKE ?'); filterParams.push(`%${origin}%`); }
  if (destination) { filters.push('destination LIKE ?'); filterParams.push(`%${destination}%`); }
  if (status) { filters.push('status = ?'); filterParams.push(status); }
  if (equipment_type) { filters.push('equipment_type = ?'); filterParams.push(equipment_type); }

  const whereParts = [clause, ...filters];
  const sql = `SELECT * FROM loads WHERE ${whereParts.join(' AND ')} ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(...params, ...filterParams);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const load = getLoadOr404(req, res);
  if (!load) return;
  const events = db.prepare('SELECT * FROM load_events WHERE load_id = ? ORDER BY created_at ASC').all(load.id);
  const rateVersions = db.prepare('SELECT * FROM rate_confirmations WHERE load_id = ? ORDER BY version ASC').all(load.id);
  res.json({ ...load, events, rateVersions });
});

// POST /loads -- broker staff with load.create only. shipper_org_id must
// belong to a real SHIPPER org (broker picks from shippers they've worked with,
// or types a new one -- for hackathon scope we require an existing org id).
router.post('/', requirePermission(PERMISSIONS.LOAD_CREATE), (req, res) => {
  if (req.user.org_type !== 'BROKER') {
    return res.status(403).json({ error: 'Only broker staff can create loads' });
  }
  const { shipperOrgId, origin, destination, pickupDate, equipmentType, commodityType } = req.body;
  if (!shipperOrgId || !origin || !destination || !pickupDate || !equipmentType || !commodityType) {
    return res.status(400).json({ error: 'shipperOrgId, origin, destination, pickupDate, equipmentType, commodityType required' });
  }
  const shipperOrg = db.prepare(`SELECT * FROM organizations WHERE id = ? AND type = 'SHIPPER'`).get(shipperOrgId);
  if (!shipperOrg) return res.status(400).json({ error: 'shipperOrgId does not reference a valid shipper org' });

  const id = uuid();
  db.prepare(
    `INSERT INTO loads (id, broker_org_id, shipper_org_id, origin, destination, pickup_date, equipment_type, commodity_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.org_id, shipperOrgId, origin, destination, pickupDate, equipmentType, commodityType, req.user.id);

  const load = db.prepare('SELECT * FROM loads WHERE id = ?').get(id);
  res.status(201).json(load);
});

// POST /loads/:id/assign-carrier -- broker only, computes compliance flag.
router.post('/:id/assign-carrier', requirePermission(PERMISSIONS.LOAD_ASSIGN_CARRIER), (req, res) => {
  const load = getLoadOr404(req, res);
  if (!load) return;
  if (load.status !== 'POSTED' && load.status !== 'DECLINED') {
    return res.status(400).json({ error: `Cannot assign a carrier while load is ${load.status}` });
  }
  const { carrierOrgId } = req.body;
  const carrierOrg = db.prepare(`SELECT * FROM organizations WHERE id = ? AND type = 'CARRIER'`).get(carrierOrgId);
  if (!carrierOrg) return res.status(400).json({ error: 'carrierOrgId does not reference a valid carrier org' });

  const updated = assignCarrierAndFlag({ load, carrierOrgId, actorUserId: req.user.id });
  res.json(updated);
});

// POST /loads/:id/transition -- generic status transition endpoint.
// Body: { toStatus, overrideReason? }
// override is only honored if caller holds load.override_compliance_flag.
router.post('/:id/transition', (req, res) => {
  const load = getLoadOr404(req, res);
  if (!load) return;
  const { toStatus, overrideReason } = req.body;
  if (!toStatus) return res.status(400).json({ error: 'toStatus required' });

  // Carrier accept/decline and status progress both use load.update_status;
  // Broker-side moves toward RATE_CONFIRMED after accept use rate.confirm
  // (handled by the /rate-confirmations endpoint, not here).
  const wantsOverride = load.compliance_flag && toStatus !== 'DECLINED';
  if (wantsOverride) {
    if (!req.user.is_org_admin && !req.user.permissions.has(PERMISSIONS.LOAD_OVERRIDE_COMPLIANCE_FLAG)) {
      logDenial(req, `missing_permission:${PERMISSIONS.LOAD_OVERRIDE_COMPLIANCE_FLAG}`);
      return res.status(403).json({ error: 'Missing permission: load.override_compliance_flag' });
    }
  } else {
    if (!req.user.is_org_admin && !req.user.permissions.has(PERMISSIONS.LOAD_UPDATE_STATUS)) {
      logDenial(req, `missing_permission:${PERMISSIONS.LOAD_UPDATE_STATUS}`);
      return res.status(403).json({ error: 'Missing permission: load.update_status' });
    }
  }

  try {
    const updated = transition({
      load,
      toStatus,
      actorUserId: req.user.id,
      allowOverride: wantsOverride,
      overrideReason: overrideReason || null,
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof TransitionError) {
      return res.status(400).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

export default router;
