import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Shell from '../components/Shell.jsx';

export default function Compliance() {
  const { user } = useAuth();
  const [form, setForm] = useState({ insuranceExpiry: '', mcDotStatus: 'ACTIVE', approvedEquipment: '', approvedCommodities: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exists, setExists] = useState(false);

  useEffect(() => {
    api.myCompliance()
      .then(rec => {
        setExists(true);
        setForm({
          insuranceExpiry: rec.insurance_expiry,
          mcDotStatus: rec.mc_dot_status,
          approvedEquipment: rec.approved_equipment.join(', '),
          approvedCommodities: rec.approved_commodities.join(', '),
        });
      })
      .catch(() => {}); // 404 is fine — no record yet
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setNotice('');
    try {
      await api.updateMyCompliance({
        insuranceExpiry: form.insuranceExpiry,
        mcDotStatus: form.mcDotStatus,
        approvedEquipment: form.approvedEquipment.split(',').map(s => s.trim()).filter(Boolean),
        approvedCommodities: form.approvedCommodities.split(',').map(s => s.trim()).filter(Boolean),
      });
      setExists(true);
      setNotice('Compliance record saved.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user?.isOrgAdmin) {
    return (
      <Shell><div className="page"><div className="page-header"><div><h1>Compliance</h1><p>Only your org's Admin can edit compliance data.</p></div></div></div></Shell>
    );
  }

  return (
    <Shell>
      <div className="page" style={{ maxWidth: 560 }}>
        <div className="page-header">
          <div>
            <h1>Compliance record</h1>
            <p>Brokers see this data to decide whether they can dispatch loads to you. Keep it current — an expired record blocks new assignments.</p>
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="card" style={{ background: '#EFF9F1', borderColor: '#BFE8C7', color: '#166534', marginBottom: 16 }}>{notice}</div>}
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label>Insurance expiry</label>
              <input type="date" value={form.insuranceExpiry} onChange={e => setForm(f => ({ ...f, insuranceExpiry: e.target.value }))} required style={{ width: '100%' }} />
            </div>
            <div className="form-row">
              <label>MC/DOT authority status</label>
              <select value={form.mcDotStatus} onChange={e => setForm(f => ({ ...f, mcDotStatus: e.target.value }))} style={{ width: '100%' }}>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
            <div className="form-row">
              <label>Approved equipment types (comma-separated)</label>
              <input value={form.approvedEquipment} onChange={e => setForm(f => ({ ...f, approvedEquipment: e.target.value }))} style={{ width: '100%' }} placeholder="Dry Van, Reefer, Flatbed" />
            </div>
            <div className="form-row">
              <label>Approved commodity types (comma-separated)</label>
              <input value={form.approvedCommodities} onChange={e => setForm(f => ({ ...f, approvedCommodities: e.target.value }))} style={{ width: '100%' }} placeholder="General, Perishable" />
            </div>
            <button className="btn-primary" type="submit">{exists ? 'Update record' : 'Save record'}</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
