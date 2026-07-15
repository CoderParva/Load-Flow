import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    orgId: req.user.org_id,
    orgType: req.user.org_type,
    name: req.user.name,
    email: req.user.email,
    isOrgAdmin: !!req.user.is_org_admin,
    permissions: [...req.user.permissions],
  });
});

export default router;
