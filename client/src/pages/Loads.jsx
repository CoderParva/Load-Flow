import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import StatusRail from '../components/StatusRail.jsx';
import Shell from '../components/Shell.jsx';

const STATUS_OPTIONS = [
  'POSTED', 'CARRIER_ASSIGNED', 'RATE_CONFIRMED', 'DISPATCHED',
  'IN_TRANSIT', 'DELIVERED', 'POD_VERIFIED', 'INVOICED_CLOSED', 'DECLINED',
];

export default function Loads() {
  const { user } = useAuth();
  const [loads, setLoads] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ origin: '', destination: '', status: '', equipment_type: '' });

  async function load(params = {}) {
    try {
      const data = await api.listLoads(params);
      setLoads(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  function applyFilters(e) {
    e.preventDefault();
    const params = {};
    for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
    load(params);
  }

  const isBroker = user?.orgType === 'BROKER';
  const isCarrier = user?.orgType === 'CARRIER';
  const isShipper = user?.orgType === 'SHIPPER';

  const title = isBroker ? 'Load board' : isCarrier ? 'Assigned loads' : 'My shipments';
  const subtitle = isBroker
    ? 'Every load your brokerage has posted, with live compliance and rate status.'
    : isCarrier
    ? 'Loads assigned to your fleet, in the order they need attention.'
    : 'Track your freight from pickup to delivery.';

  return (
    <Shell>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {isBroker && (
            <Link to="/loads/new"><button className="btn-primary">+ Post a load</button></Link>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {isBroker && (
          <form className="filters-bar" onSubmit={applyFilters}>
            <input placeholder="Origin" value={filters.origin} onChange={e => setFilters(f => ({ ...f, origin: e.target.value }))} />
            <input placeholder="Destination" value={filters.destination} onChange={e => setFilters(f => ({ ...f, destination: e.target.value }))} />
            <input placeholder="Equipment type" value={filters.equipment_type} onChange={e => setFilters(f => ({ ...f, equipment_type: e.target.value }))} />
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
            </select>
            <button className="btn-secondary" type="submit">Filter</button>
          </form>
        )}

        {loads === null ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : loads.length === 0 ? (
          <div className="empty-state card">
            <h3>Nothing here yet</h3>
            <p>{isBroker ? 'Post your first load to get started.' : isCarrier ? 'No loads have been assigned to you yet.' : 'You have no shipments yet.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Pickup</th>
                  <th>Equipment</th>
                  <th>Progress</th>
                  <th>Flag</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loads.map(l => (
                  <tr key={l.id}>
                    <td>{l.origin} → {l.destination}</td>
                    <td className="mono">{l.pickup_date}</td>
                    <td>{l.equipment_type}</td>
                    <td><StatusRail status={l.status} complianceFlag={!!l.compliance_flag} /></td>
                    <td>
                      {l.compliance_flag ? (
                        <span className="flag-badge"><span className="flag-dot" />Flagged</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td><Link to={`/loads/${l.id}`}>View →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
