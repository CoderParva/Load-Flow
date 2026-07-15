import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Shell from '../components/Shell.jsx';

export default function RolesStaff() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] });
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', roleIds: [] });

  async function loadAll() {
    try {
      const [c, r] = await Promise.all([api.permissionCatalog(), api.listRoles()]);
      setCatalog(c);
      setRoles(r);
      if (user?.isOrgAdmin) {
        const s = await api.listStaff();
        setStaff(s);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadAll(); }, [user]);

  function togglePerm(key) {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key],
    }));
  }
  function toggleStaffRole(id) {
    setStaffForm(f => ({
      ...f,
      roleIds: f.roleIds.includes(id) ? f.roleIds.filter(r => r !== id) : [...f.roleIds, id],
    }));
  }

  async function submitRole(e) {
    e.preventDefault();
    setError(''); setNotice('');
    try {
      await api.createRole(roleForm);
      setRoleForm({ name: '', permissions: [] });
      setNotice('Role created.');
      loadAll();
    } catch (err) { setError(err.message); }
  }

  async function submitStaff(e) {
    e.preventDefault();
    setError(''); setNotice('');
    try {
      await api.createStaff(staffForm);
      setStaffForm({ name: '', email: '', password: '', roleIds: [] });
      setNotice('Staff account created.');
      loadAll();
    } catch (err) { setError(err.message); }
  }

  if (!user?.isOrgAdmin) {
    return (
      <Shell>
        <div className="page">
          <div className="page-header"><div><h1>Roles &amp; staff</h1><p>Only your org's Admin can manage roles and staff.</p></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Role</th><th>Permissions</th></tr></thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r.id}><td>{r.name}</td><td>{r.permissions.join(', ')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="page">
        <div className="page-header"><div><h1>Roles &amp; staff</h1><p>Build custom roles from the permission catalog, then assign them to staff.</p></div></div>
        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="card" style={{ background: '#EFF9F1', borderColor: '#BFE8C7', color: '#166534', marginBottom: 16 }}>{notice}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Create a role</h3>
            <form onSubmit={submitRole}>
              <div className="form-row">
                <label>Role name</label>
                <input value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%' }} placeholder="e.g. Dispatcher" />
              </div>
              <div className="form-row">
                <label>Permissions</label>
                {catalog.map(p => (
                  <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, color: 'var(--text)', marginBottom: 4 }}>
                    <input type="checkbox" checked={roleForm.permissions.includes(p.key)} onChange={() => togglePerm(p.key)} />
                    <span className="mono" style={{ fontSize: 11 }}>{p.key}</span> — {p.description}
                  </label>
                ))}
              </div>
              <button className="btn-primary" type="submit" disabled={!roleForm.name || roleForm.permissions.length === 0}>Create role</button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Invite staff</h3>
            <form onSubmit={submitStaff}>
              <div className="form-row">
                <label>Name</label>
                <input value={staffForm.name} onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%' }} />
              </div>
              <div className="form-row">
                <label>Email</label>
                <input type="email" value={staffForm.email} onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))} required style={{ width: '100%' }} />
              </div>
              <div className="form-row">
                <label>Temporary password</label>
                <input type="password" value={staffForm.password} onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))} required style={{ width: '100%' }} />
              </div>
              <div className="form-row">
                <label>Roles</label>
                {roles.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Create a role first.</p>}
                {roles.map(r => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, color: 'var(--text)', marginBottom: 4 }}>
                    <input type="checkbox" checked={staffForm.roleIds.includes(r.id)} onChange={() => toggleStaffRole(r.id)} />
                    {r.name}
                  </label>
                ))}
              </div>
              <button className="btn-primary" type="submit" disabled={!staffForm.name || !staffForm.email || !staffForm.password}>Create staff account</button>
            </form>
          </div>
        </div>

        <div className="table-wrap" style={{ marginBottom: 24 }}>
          <table>
            <thead><tr><th>Role</th><th>Permissions</th><th></th></tr></thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{r.permissions.join(', ')}</td>
                  <td><button className="btn-secondary" onClick={() => api.deleteRole(r.id).then(loadAll)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginBottom: 12 }}>Staff</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Admin</th></tr></thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}><td>{s.name}</td><td>{s.email}</td><td>{s.is_org_admin ? 'Yes' : 'No'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
