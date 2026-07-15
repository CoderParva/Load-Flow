import { Router } from 'express';
import db from '../db/connection.js';
import { requireAuth, requireOrgType } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Broker staff need to pick a shipper + carrier org when creating/assigning
// loads. This intentionally returns only id/name/type -- no cross-org
// operational data (loads, staff, compliance details) leaks through here.
router.get('/', requireOrgType('BROKER'), (req, res) => {
  const { type } = req.query;
  if (!['SHIPPER', 'CARRIER'].includes(type)) {
    return res.status(400).json({ error: 'type query param must be SHIPPER or CARRIER' });
  }
  const rows = db.prepare('SELECT id, name, type FROM organizations WHERE type = ?').all(type);
  res.json(rows);
});

export default router;
