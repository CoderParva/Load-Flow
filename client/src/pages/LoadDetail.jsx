import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import StatusRail from '../components/StatusRail.jsx';
import Shell from '../components/Shell.jsx';

const NEXT_STATUS = {
  RATE_CONFIRMED: 'DISPATCHED',
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED',
  DELIVERED: 'POD_VERIFIED',
  POD_VERIFIED: 'INVOICED_CLOSED',
};

export default function LoadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [load, setLoad] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [carriers, setCarriers] = useState([]);
  const [carrierChoice, setCarrierChoice] = useState('');
  const [rateForm, setRateForm] = useState({ baseRate: '', overrideReason: '' });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const data = await api.getLoad(id);
      setLoad(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { refresh(); }, [id]);
  useEffect(() => {
    if (user?.orgType === 'BROKER') {
      api.listOrgs('CARRIER').then(setCarriers).catch(() => {});
    }
  }, [user]);

  const hasPerm = (key) => user?.isOrgAdmin || user?.permissions?.includes(key);

  async function withGuard(fn) {
    setError(''); setNotice(''); setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!load) {
    return <Shell><div className="page">{error ? <div className="error-banner">{error}</div> : <p>Loading…</p>}</div></Shell>;
  }

  const canAssignCarrier = user?.orgType === 'BROKER' && hasPerm('load.assign_carrier') && (load.status === 'POSTED' || load.status === 'DECLINED');
  const canConfirmRate = user?.orgType === 'BROKER' && hasPerm('rate.confirm') && (load.status === 'CARRIER_ASSIGNED');
  const canDecline = user?.orgType === 'CARRIER' && hasPerm('load.update_status') && load.status === 'CARRIER_ASSIGNED';
  const nextStatus = NEXT_STATUS[load.status];
  const canAdvance = hasPerm('load.update_status') && !!nextStatus;
  const needsOverride = load.compliance_flag && load.status === 'CARRIER_ASSIGNED';
  const canOverride = hasPerm('load.override_compliance_flag');

  return (
    <Shell>
      <div className="page">
        <p><Link to="/loads">← Back to loads</Link></p>
        <div className="page-header">
          <div>
            <h1>{load.origin} → {load.destination}</h1>
            <p className="mono">{load.id}</p>
          </div>
          <StatusRail status={load.status} complianceFlag={!!load.compliance_flag} />
        </div>

        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="card" style={{ background: '#EFF9F1', borderColor: '#BFE8C7', color: '#166534', marginBottom: 16 }}>{notice}</div>}

        {load.compliance_flag && (
          <div className="error-banner" style={{ background: '#FFF4E0', color: '#92660A' }}>
            <strong>Compliance flag:</strong> {load.compliance_flag_reason}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Load details</h3>
            <p><strong>Pickup:</strong> {load.pickup_date}</p>
            <p><strong>Equipment:</strong> {load.equipment_type}</p>
            <p><strong>Commodity:</strong> {load.commodity_type}</p>
            <p><strong>Status:</strong> {load.status.replaceAll('_', ' ')}</p>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Rate confirmations</h3>
            {load.rateVersions?.length ? load.rateVersions.map(rv => (
              <div key={rv.id} style={{ marginBottom: 8, opacity: rv.status === 'SUPERSEDED' ? 0.5 : 1 }}>
                <span className="mono">v{rv.version}</span> — ${rv.base_rate} <span className="chip chip-posted">{rv.status}</span>
              </div>
            )) : <p style={{ color: 'var(--text-muted)' }}>No rate confirmed yet.</p>}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 14 }}>Actions</h3>

          {canAssignCarrier && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
              <div>
                <label>Assign carrier</label>
                <select value={carrierChoice} onChange={e => setCarrierChoice(e.target.value)}>
                  <option value="">Select carrier…</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button className="btn-primary" disabled={!carrierChoice || busy}
                onClick={() => withGuard(async () => {
                  await api.assignCarrier(load.id, carrierChoice);
                  setNotice('Carrier assigned.');
                })}>
                Assign
              </button>
            </div>
          )}

          {canConfirmRate && (
            <div style={{ marginBottom: 12 }}>
              {needsOverride && !canOverride && (
                <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>
                  This load is compliance-flagged. Confirming the rate is blocked until the flag is resolved or an authorized user overrides it.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label>Base rate (USD)</label>
                  <input type="number" min="1" value={rateForm.baseRate}
                    onChange={e => setRateForm(f => ({ ...f, baseRate: e.target.value }))} style={{ width: 120 }} />
                </div>
                {needsOverride && canOverride && (
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <label>Override reason (required)</label>
                    <input value={rateForm.overrideReason}
                      onChange={e => setRateForm(f => ({ ...f, overrideReason: e.target.value }))} style={{ width: '100%' }} />
                  </div>
                )}
                <button className={needsOverride ? 'btn-amber' : 'btn-primary'}
                  disabled={busy || !rateForm.baseRate || (needsOverride && !canOverride) || (needsOverride && !rateForm.overrideReason)}
                  onClick={() => withGuard(async () => {
                    await api.confirmRate(load.id, {
                      baseRate: Number(rateForm.baseRate),
                      accessorials: [],
                      overrideReason: rateForm.overrideReason || undefined,
                    });
                    setNotice(needsOverride ? 'Rate confirmed — compliance flag overridden and logged.' : 'Rate confirmed.');
                  })}>
                  {needsOverride ? 'Override & confirm rate' : 'Confirm rate'}
                </button>
              </div>
            </div>
          )}

          {canDecline && (
            <button className="btn-danger" disabled={busy} style={{ marginRight: 8 }}
              onClick={() => withGuard(async () => {
                await api.transitionLoad(load.id, { toStatus: 'DECLINED' });
                setNotice('Load declined.');
              })}>
              Decline load
            </button>
          )}

          {canAdvance && (
            <button className="btn-primary" disabled={busy}
              onClick={() => withGuard(async () => {
                await api.transitionLoad(load.id, { toStatus: nextStatus });
                setNotice(`Moved to ${nextStatus.replaceAll('_', ' ')}.`);
              })}>
              Advance to {nextStatus.replaceAll('_', ' ')}
            </button>
          )}

          {!canAssignCarrier && !canConfirmRate && !canDecline && !canAdvance && (
            <p style={{ color: 'var(--text-muted)' }}>No actions available to you at this stage.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Audit trail</h3>
          {load.events?.length ? (
            <table>
              <thead><tr><th>When</th><th>Event</th><th>Transition</th><th>Detail</th></tr></thead>
              <tbody>
                {load.events.map(ev => (
                  <tr key={ev.id}>
                    <td className="mono">{ev.created_at}</td>
                    <td>{ev.event_type.replaceAll('_', ' ')}</td>
                    <td>{ev.from_status ? `${ev.from_status} → ${ev.to_status}` : '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {ev.event_type === 'COMPLIANCE_OVERRIDE' && JSON.parse(ev.metadata || '{}').reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ color: 'var(--text-muted)' }}>No events yet.</p>}
        </div>
      </div>
    </Shell>
  );
}
