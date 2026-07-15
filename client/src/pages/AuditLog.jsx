import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Shell from '../components/Shell.jsx';

export default function AuditLog() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.auditLog().then(setEvents).catch(e => setError(e.message));
  }, []);

  return (
    <Shell>
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Audit log</h1>
            <p>Every status change and compliance override across your organization's loads, newest first.</p>
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {events === null ? <p>Loading…</p> : events.length === 0 ? (
          <div className="empty-state card"><h3>No activity yet</h3><p>Events will appear here as loads move through the pipeline.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Load</th><th>Event</th><th>Transition</th><th>Detail</th></tr></thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td className="mono">{ev.created_at}</td>
                    <td>{ev.origin} → {ev.destination}</td>
                    <td>{ev.event_type.replaceAll('_', ' ')}</td>
                    <td>{ev.from_status ? `${ev.from_status} → ${ev.to_status}` : '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {ev.event_type === 'COMPLIANCE_OVERRIDE' ? JSON.parse(ev.metadata || '{}').reason : ''}
                    </td>
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
