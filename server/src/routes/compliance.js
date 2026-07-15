import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/connection.js';
import { requireAuth, requireOrgType } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// A carrier's own admin manages its own compliance record. Broker staff
// need read access (to see why a load is flagged) -- handled via the
// loads routes, not exposed here for cross-org listing.
router.get('/mine', requireOrgType('CARRIER'), (req, res) => {
  const rec = db.prepare('SELECT * FROM carrier_compliance WHERE carrier_org_id = ?').get(req.user.org_id);
  if (!rec) return res.status(404).json({ error: 'No compliance record on file yet' });
  res.json({
    ...rec,
    approved_equipment: JSON.parse(rec.approved_equipment),
    approved_commodities: JSON.parse(rec.approved_commodities),
  });
});

router.put('/mine', requireOrgType('CARRIER'), (req, res) => {
  if (!req.user.is_org_admin) {
    return res.status(403).json({ error: 'Only the carrier org Admin can edit compliance data' });
  }
  const { insuranceExpiry, mcDotStatus, approvedEquipment, approvedCommodities } = req.body;
  if (!insuranceExpiry || !mcDotStatus) {
    return res.status(400).json({ error: 'insuranceExpiry and mcDotStatus are required' });
  }
  const existing = db.prepare('SELECT id FROM carrier_compliance WHERE carrier_org_id = ?').get(req.user.org_id);
  if (existing) {
    db.prepare(
      `UPDATE carrier_compliance SET insurance_expiry=?, mc_dot_status=?, approved_equipment=?, approved_commodities=?, updated_at=datetime('now'), updated_by=? WHERE carrier_org_id=?`
    ).run(insuranceExpiry, mcDotStatus, JSON.stringify(approvedEquipment || []), JSON.stringify(approvedCommodities || []), req.user.id, req.user.org_id);
  } else {
    db.prepare(
      `INSERT INTO carrier_compliance (id, carrier_org_id, insurance_expiry, mc_dot_status, approved_equipment, approved_commodities, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uuid(), req.user.org_id, insuranceExpiry, mcDotStatus, JSON.stringify(approvedEquipment || []), JSON.stringify(approvedCommodities || []), req.user.id);
  }
  const rec = db.prepare('SELECT * FROM carrier_compliance WHERE carrier_org_id = ?').get(req.user.org_id);
  res.json(rec);
});

export default router;
