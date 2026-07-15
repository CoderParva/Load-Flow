// Object-level scoping is deliberately separate from permission checks.
// A user can hold `load.update_status` and STILL only see loads that
// belong to their own org -- permission answers "can you do X at all",
// scope answers "on which rows". Mixing the two into one check is the
// most common way this kind of system leaks data across orgs.
export function loadScopeClause(user) {
  if (user.org_type === 'BROKER') {
    return { clause: 'broker_org_id = ?', params: [user.org_id] };
  }
  if (user.org_type === 'CARRIER') {
    return { clause: 'carrier_org_id = ?', params: [user.org_id] };
  }
  // SHIPPER
  return { clause: 'shipper_org_id = ?', params: [user.org_id] };
}

export function loadInScope(user, load) {
  if (user.org_type === 'BROKER') return load.broker_org_id === user.org_id;
  if (user.org_type === 'CARRIER') return load.carrier_org_id === user.org_id;
  return load.shipper_org_id === user.org_id;
}
