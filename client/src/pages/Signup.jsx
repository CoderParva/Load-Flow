import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Signup() {
  const [orgType, setOrgType] = useState('BROKER');
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { applySession } = useAuth();
  const navigate = useNavigate();

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.signupOrg({ orgType, ...form });
      applySession(token, user);
      navigate('/loads');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div className="card" style={{ width: 420 }}>
        <h1 style={{ marginBottom: 4 }}>Create an account</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4, marginBottom: 20, fontSize: 13 }}>
          This creates a new organization and makes you its first Admin. Invite staff afterward from Roles &amp; staff.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Account type</label>
            <select value={orgType} onChange={e => setOrgType(e.target.value)} style={{ width: '100%' }}>
              <option value="BROKER">Broker</option>
              <option value="CARRIER">Carrier</option>
              <option value="SHIPPER">Shipper</option>
            </select>
          </div>
          <div className="form-row">
            <label>{orgType === 'SHIPPER' ? 'Your business name' : 'Organization name'}</label>
            <input value={form.orgName} onChange={e => set('orgName', e.target.value)} required style={{ width: '100%' }} />
          </div>
          <div className="form-row">
            <label>Your name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required style={{ width: '100%' }} />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required style={{ width: '100%' }} />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required style={{ width: '100%' }} />
          </div>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
