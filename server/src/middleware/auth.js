import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// NOTE: the JWT only carries { userId }. We deliberately do NOT bake
// permissions or role names into the token payload -- if we did, revoking
// a role or deactivating a user would have no effect until the token
// expired/re-issued. Every request re-reads current permissions from DB.
export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '12h' });
}

function logDenial(req, reason) {
  db.prepare(
    `INSERT INTO access_denials (id, user_id, attempted_path, attempted_method, reason)
     VALUES (?, ?, ?, ?, ?)`
  ).run(uuid(), req.user?.id || null, req.originalUrl, req.method, reason);
  console.warn(`[ACCESS DENIED] user=${req.user?.id || 'anon'} ${req.method} ${req.originalUrl} reason="${reason}"`);
}

// Loads req.user with org info + a live Set of permission keys.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    logDenial(req, 'missing_token');
    return res.status(401).json({ error: 'Missing auth token' });
  }
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    logDenial(req, 'invalid_token');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = db.prepare(
    `SELECT u.id, u.org_id, u.email, u.name, u.is_org_admin, o.type as org_type
     FROM users u JOIN organizations o ON o.id = u.org_id
     WHERE u.id = ?`
  ).get(payload.userId);

  if (!user) {
    logDenial(req, 'user_not_found');
    return res.status(401).json({ error: 'User no longer exists' });
  }

  const permRows = db.prepare(
    `SELECT DISTINCT rp.permission_key
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     WHERE ur.user_id = ?`
  ).all(user.id);

  req.user = {
    ...user,
    permissions: new Set(permRows.map(r => r.permission_key)),
  };
  next();
}

// requirePermission: org Admins always pass (non-revocable bypass, prevents
// lockout); everyone else must hold the permission key in their live set.
export function requirePermission(key) {
  return (req, res, next) => {
    if (req.user.is_org_admin) return next();
    if (req.user.permissions.has(key)) return next();
    logDenial(req, `missing_permission:${key}`);
    return res.status(403).json({ error: `Missing permission: ${key}` });
  };
}

export function requireOrgType(...types) {
  return (req, res, next) => {
    if (!types.includes(req.user.org_type)) {
      logDenial(req, `wrong_org_type:need_one_of_${types.join(',')}`);
      return res.status(403).json({ error: 'Not permitted for this account type' });
    }
    next();
  };
}

export { logDenial };
