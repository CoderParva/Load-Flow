import { v4 as uuid } from 'uuid';
import db from '../db/connection.js';

// Valid forward transitions. DECLINED is a side-branch off CARRIER_ASSIGNED
// (spec gives Carrier Dispatch an accept/decline action but the state list
// in the spec has no ACCEPTED/DECLINED state -- documented assumption:
// "accept" simply lets the load continue toward RATE_CONFIRMED, "decline"
// moves it to DECLINED and clears carrier_org_id so the broker can
// reassign; see README "Assumptions".)
const TRANSITIONS = {
  POSTED: ['CARRIER_ASSIGNED'],
  CARRIER_ASSIGNED: ['RATE_CONFIRMED', 'DECLINED'],
  RATE_CONFIRMED: ['DISPATCHED'],
  DISPATCHED: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: ['POD_VERIFIED'],
  POD_VERIFIED: ['INVOICED_CLOSED'],
  INVOICED_CLOSED: [],
  DECLINED: ['CARRIER_ASSIGNED'], // broker reassigns a new carrier
};

// Statuses at or past which an unresolved compliance flag blocks progress.
// The flag is evaluated at CARRIER_ASSIGNED and must be cleared/overridden
// before advancing to RATE_CONFIRMED or beyond.
const COMPLIANCE_GATE_AFTER = 'CARRIER_ASSIGNED';

export class TransitionError extends Error {
  constructor(message, code = 'INVALID_TRANSITION') {
    super(message);
    this.code = code;
  }
}

export function evaluateCompliance(carrierOrgId, load) {
  const rec = db.prepare(`SELECT * FROM carrier_compliance WHERE carrier_org_id = ?`).get(carrierOrgId);
  if (!rec) {
    return { flagged: true, reason: 'No compliance record on file for this carrier' };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (rec.insurance_expiry < today) {
    return { flagged: true, reason: `Insurance expired ${rec.insurance_expiry}` };
  }
  if (rec.mc_dot_status !== 'ACTIVE') {
    return { flagged: true, reason: `MC/DOT authority status is ${rec.mc_dot_status}` };
  }
  const equipment = JSON.parse(rec.approved_equipment || '[]');
  if (!equipment.includes(load.equipment_type)) {
    return { flagged: true, reason: `Carrier not approved for equipment type ${load.equipment_type}` };
  }
  const commodities = JSON.parse(rec.approved_commodities || '[]');
  if (!commodities.includes(load.commodity_type)) {
    return { flagged: true, reason: `Carrier not approved for commodity type ${load.commodity_type}` };
  }
  return { flagged: false, reason: null };
}

// The ONLY function permitted to write loads.status. Every call produces
// exactly one load_events row, so the audit trail can never drift from
// reality.
export function transition({ load, toStatus, actorUserId, allowOverride = false, overrideReason = null }) {
  const allowed = TRANSITIONS[load.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new TransitionError(`Cannot move load from ${load.status} to ${toStatus}`);
  }

  // Compliance gate: cannot leave CARRIER_ASSIGNED while flagged, unless
  // an authorized override is explicitly supplied.
  if (load.status === COMPLIANCE_GATE_AFTER && toStatus !== 'DECLINED') {
    if (load.compliance_flag) {
      if (!allowOverride) {
        throw new TransitionError(
          `Blocked by compliance flag: ${load.compliance_flag_reason}`,
          'COMPLIANCE_BLOCKED'
        );
      }
    }
  }

  const now = new Date().toISOString();
  const runTxn = db.transaction(() => {
    db.prepare(`UPDATE loads SET status = ?, updated_at = ? WHERE id = ?`)
      .run(toStatus, now, load.id);

    db.prepare(
      `INSERT INTO load_events (id, load_id, event_type, from_status, to_status, actor_user_id, metadata)
       VALUES (?, ?, 'STATUS_CHANGE', ?, ?, ?, ?)`
    ).run(uuid(), load.id, load.status, toStatus, actorUserId, JSON.stringify({}));

    if (allowOverride && load.compliance_flag) {
      db.prepare(
        `INSERT INTO load_events (id, load_id, event_type, from_status, to_status, actor_user_id, metadata)
         VALUES (?, ?, 'COMPLIANCE_OVERRIDE', ?, ?, ?, ?)`
      ).run(uuid(), load.id, load.status, toStatus, actorUserId, JSON.stringify({ reason: overrideReason }));

      db.prepare(`UPDATE loads SET compliance_flag = 0, compliance_flag_reason = NULL WHERE id = ?`)
        .run(load.id);
    }
  });
  runTxn();

  return db.prepare(`SELECT * FROM loads WHERE id = ?`).get(load.id);
}

// Called when a carrier is assigned to a load -- (re)computes the
// compliance flag from the carrier's current compliance record.
export function assignCarrierAndFlag({ load, carrierOrgId, actorUserId }) {
  const result = evaluateCompliance(carrierOrgId, load);
  const now = new Date().toISOString();

  const runTxn = db.transaction(() => {
    db.prepare(
      `UPDATE loads SET carrier_org_id = ?, status = 'CARRIER_ASSIGNED',
       compliance_flag = ?, compliance_flag_reason = ?, updated_at = ? WHERE id = ?`
    ).run(carrierOrgId, result.flagged ? 1 : 0, result.reason, now, load.id);

    db.prepare(
      `INSERT INTO load_events (id, load_id, event_type, from_status, to_status, actor_user_id, metadata)
       VALUES (?, ?, 'STATUS_CHANGE', ?, 'CARRIER_ASSIGNED', ?, ?)`
    ).run(uuid(), load.id, load.status, actorUserId, JSON.stringify({ carrierOrgId, complianceFlagged: result.flagged }));
  });
  runTxn();

  return db.prepare(`SELECT * FROM loads WHERE id = ?`).get(load.id);
}
