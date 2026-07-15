import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import Shell from '../components/Shell.jsx';

export default function NewLoad() {
  const [shippers, setShippers] = useState([]);
  const [form, setForm] = useState({
    shipperOrgId: '', origin: '', destination: '', pickupDate: '', equipmentType: '', commodityType: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.listOrgs('SHIPPER').then(setShippers).catch(e => setError(e.message));
  }, []);

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const load = await api.createLoad(form);
      navigate(`/loads/${load.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="page-header">
          <div>
            <h1>Post a load</h1>
            <p>Create a new load for a shipper. You'll assign a carrier next.</p>
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label>Shipper</label>
              <select value={form.shipperOrgId} onChange={e => set('shipperOrgId', e.target.value)} required style={{ width: '100%' }}>
                <option value="">Select a shipper…</option>
                {shippers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label>Origin</label>
                <input value={form.origin} onChange={e => set('origin', e.target.value)} required style={{ width: '100%' }} placeholder="Chicago, IL" />
              </div>
              <div className="form-row">
                <label>Destination</label>
                <input value={form.destination} onChange={e => set('destination', e.target.value)} required style={{ width: '100%' }} placeholder="Dallas, TX" />
              </div>
              <div className="form-row">
                <label>Pickup date</label>
                <input type="date" value={form.pickupDate} onChange={e => set('pickupDate', e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div className="form-row">
                <label>Equipment type</label>
                <input value={form.equipmentType} onChange={e => set('equipmentType', e.target.value)} required style={{ width: '100%' }} placeholder="Dry Van" />
              </div>
              <div className="form-row">
                <label>Commodity type</label>
                <input value={form.commodityType} onChange={e => set('commodityType', e.target.value)} required style={{ width: '100%' }} placeholder="General" />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Posting…' : 'Post load'}</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
