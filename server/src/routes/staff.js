import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../db/connection.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = Router();
router.use(requireAuth);

// List staff in my own org only -- org scoping applied unconditionally,
// permission check is layered on top for the mutating actions below.
router.get('/', requirePermission(PERMISSIONS.STAFF_MANAGE), (req, res) => {
  const staff = db.prepare('SELECT id, name, email, is_org_admin, created_at FROM users WHERE org_id = ?').all(req.user.org_id);
  res.json(staff);
});

router.post('/', requirePermission(PERMISSIONS.STAFF_MANAGE), (req, res) => {
  const { name, email, password, roleIds } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, password required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  // Guard: role ids must belong to the caller's own org, otherwise a
  // Broker admin could hand out Carrier-org roles by id-guessing.
  const roles = (roleIds || []).map(rid => {
    const r = db.prepare('SELECT * FROM roles WHERE id = ? AND org_id = ?').get(rid, req.user.org_id);
    if (!r) throw new Error(`Role ${rid} not found in your org`);
    return r;
  });

  const userId = uuid();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const txn = db.transaction(() => {
      db.prepare('INSERT INTO users (id, org_id, email, password_hash, name) VALUES (?, ?, ?, ?, ?)')
        .run(userId, req.user.org_id, email, hash, name);
      const insertUR = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
      for (const r of roles) insertUR.run(userId, r.id);
    });
    txn();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  res.status(201).json({ id: userId, name, email, roles: roles.map(r => r.name) });
});

export default router;
