import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { applySession } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login({ email, password });
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
      <div className="card" style={{ width: 380 }}>
        <h1 style={{ marginBottom: 4 }}>Load<span style={{ color: 'var(--amber)' }}>Flow</span></h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4, marginBottom: 20, fontSize: 13 }}>Sign in to your account</p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%' }} />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%' }} />
          </div>
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          New org? <Link to="/signup">Create a Broker, Carrier, or Shipper account</Link>
        </p>
      </div>
    </div>
  );
}
