import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/connection.js';
import { requireAuth } from '../middleware/auth.js';
import { PERMISSION_CATALOG } from '../lib/permissions.js';

const router = Router();
router.use(requireAuth);

// Only org Admins manage roles -- staff.manage permission is deliberately
// NOT sufficient here; role creation is an Admin-only bootstrap-level
// action distinct from ordinary staff.manage (which covers day-to-day
// staff CRUD). This mirrors the spec's "Admin manages staff and role
// permissions" framing.
function requireAdmin(req, res, next) {
  if (!req.user.is_org_admin) {
    return res.status(403).json({ error: 'Only an org Admin can manage roles' });
  }
  next();
}

// Full catalog, filtered to what's relevant for this user's org type, so
// the role-builder UI only offers sensible permissions.
router.get('/catalog', (req, res) => {
  const relevant = PERMISSION_CATALOG.filter(
    p => p.orgType === 'BOTH' || p.orgType === req.user.org_type
  );
  res.json(relevant);
});

router.get('/', (req, res) => {
  const roles = db.prepare('SELECT * FROM roles WHERE org_id = ?').all(req.user.org_id);
  const withPerms = roles.map(r => ({
    ...r,
    permissions: db.prepare(
      `SELECT permission_key FROM role_permissions WHERE role_id = ?`
    ).all(r.id).map(x => x.permission_key),
  }));
  res.json(withPerms);
});

router.post('/', requireAdmin, (req, res) => {
  const { name, permissions } = req.body;
  if (!name || !Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({ error: 'name and non-empty permissions[] required' });
  }
  const validKeys = new Set(PERMISSION_CATALOG.map(p => p.key));
  for (const p of permissions) {
    if (!validKeys.has(p)) return res.status(400).json({ error: `Unknown permission key: ${p}` });
  }
  const roleId = uuid();
  const txn = db.transaction(() => {
    db.prepare('INSERT INTO roles (id, org_id, name) VALUES (?, ?, ?)').run(roleId, req.user.org_id, name);
    const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)');
    for (const p of permissions) insertPerm.run(roleId, p);
  });
  txn();
  res.status(201).json({ id: roleId, name, permissions });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE id = ? AND org_id = ?').get(req.params.id, req.user.org_id);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  db.prepare('DELETE FROM roles WHERE id = ?').run(role.id);
  res.status(204).end();
});

export default router;
