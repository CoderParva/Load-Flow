import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const orgTypeLabel = { BROKER: 'Broker', CARRIER: 'Carrier', SHIPPER: 'Shipper' }[user?.orgType] || '';

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">Load<span>Flow</span></div>
        <nav>
          {user?.orgType === 'BROKER' && (
            <>
              <NavLink to="/loads" className={({ isActive }) => isActive ? 'active' : ''}>Load board</NavLink>
              <NavLink to="/roles" className={({ isActive }) => isActive ? 'active' : ''}>Roles &amp; staff</NavLink>
            </>
          )}
          {user?.orgType === 'CARRIER' && (
            <>
              <NavLink to="/loads" className={({ isActive }) => isActive ? 'active' : ''}>Assigned loads</NavLink>
              <NavLink to="/compliance" className={({ isActive }) => isActive ? 'active' : ''}>Compliance</NavLink>
              <NavLink to="/roles" className={({ isActive }) => isActive ? 'active' : ''}>Roles &amp; staff</NavLink>
            </>
          )}
          {user?.orgType === 'SHIPPER' && (
            <NavLink to="/loads" className={({ isActive }) => isActive ? 'active' : ''}>My shipments</NavLink>
          )}
          <span className="user-chip">{user?.name} · {orgTypeLabel}{user?.isOrgAdmin ? ' · Admin' : ''}</span>
          <button className="btn-secondary" onClick={handleLogout}>Log out</button>
        </nav>
      </div>
      {children}
    </div>
  );
}
