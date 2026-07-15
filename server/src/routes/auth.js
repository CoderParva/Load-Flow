import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../db/connection.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

// Bootstrap: signing up as BROKER or CARRIER creates a brand new org AND
// its first user as that org's Admin (is_org_admin=1). There is no invite
// code needed for this path -- it's how an org comes into existence.
// SHIPPER signup similarly creates a one-user org of type SHIPPER (no
// sub-roles apply to shippers, so is_org_admin is irrelevant for them but
// set true for consistency/self-service e.g. future profile edits).
router.post('/signup-org', (req, res) => {
  const { orgType, orgName, name, email, password } = req.body;
  if (!['BROKER', 'CARRIER', 'SHIPPER'].includes(orgType)) {
    return res.status(400).json({ error: 'orgType must be BROKER, CARRIER, or SHIPPER' });
  }
  if (!orgName || !name || !email || !password) {
    return res.status(400).json({ error: 'orgName, name, email, password are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const orgId = uuid();
  const userId = uuid();
  const hash = bcrypt.hashSync(password, 10);

  const txn = db.transaction(() => {
    db.prepare('INSERT INTO organizations (id, type, name) VALUES (?, ?, ?)').run(orgId, orgType, orgName);
    db.prepare(
      'INSERT INTO users (id, org_id, email, password_hash, name, is_org_admin) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(userId, orgId, email, hash, name);
  });
  txn();

  const token = signToken(userId);
  res.status(201).json({ token, user: { id: userId, orgId, orgType, name, email, isOrgAdmin: true } });
});

// Invited staff: an existing Admin creates the account (see routes/staff.js).
// This endpoint is just login; staff accounts never self-register.
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare(
    `SELECT u.*, o.type as org_type FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.email = ?`
  ).get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      orgId: user.org_id,
      orgType: user.org_type,
      name: user.name,
      email: user.email,
      isOrgAdmin: !!user.is_org_admin,
    },
  });
});

export default router;
