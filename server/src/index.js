import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import rolesRoutes from './routes/roles.js';
import staffRoutes from './routes/staff.js';
import complianceRoutes from './routes/compliance.js';
import loadsRoutes from './routes/loads.js';
import rateConfirmationsRoutes from './routes/rateConfirmations.js';
import orgsRoutes from './routes/orgs.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/loads', loadsRoutes);
app.use('/api/loads', rateConfirmationsRoutes); // adds /loads/:loadId/rate-confirmations
app.use('/api/orgs', orgsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`LoadFlow API listening on :${PORT}`));
