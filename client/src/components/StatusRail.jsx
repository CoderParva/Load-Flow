const STAGES = [
  'POSTED', 'CARRIER_ASSIGNED', 'RATE_CONFIRMED', 'DISPATCHED',
  'IN_TRANSIT', 'DELIVERED', 'POD_VERIFIED', 'INVOICED_CLOSED',
];

export default function StatusRail({ status, complianceFlag }) {
  if (status === 'DECLINED') {
    return <span className="chip chip-declined">Declined by carrier</span>;
  }
  const currentIdx = STAGES.indexOf(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={status.replaceAll('_', ' ')}>
      {STAGES.map((stage, i) => {
        const filled = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const flagged = isCurrent && complianceFlag;
        return (
          <div
            key={stage}
            style={{
              width: isCurrent ? 10 : 7,
              height: isCurrent ? 10 : 7,
              borderRadius: '50%',
              background: flagged ? 'var(--amber)' : filled ? 'var(--steel)' : 'var(--border)',
              animation: flagged ? 'pulse 1.4s infinite' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
