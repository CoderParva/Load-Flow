-- LoadFlow schema
-- Design notes:
--  * Shipper accounts are modeled as a one-user ORG (type=SHIPPER) so every
--    load can reference org ids uniformly, even though shippers have no
--    sub-roles/permissions of their own.
--  * RBAC is data-driven: permissions table is a fixed catalog, roles are
--    org-owned rows built from that catalog, never hardcoded in app logic.
--  * loads.status is only ever written by the transition() function in
--    lib/loadStateMachine.js -- load_events is the audit trail and the
--    source of truth for "what happened when, by whom".
--  * rate_confirmations rows are immutable once CONFIRMED. A renegotiation
--    inserts a new version and supersedes the old one; loads pin the
--    confirmed_rate_version_id they actually agreed to.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('BROKER','CARRIER','SHIPPER')),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_org_admin INTEGER NOT NULL DEFAULT 0, -- non-revocable bypass flag; prevents admin lockout
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fixed permission catalog. Seeded once, never created via UI.
CREATE TABLE IF NOT EXISTS permissions (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

-- Admin-defined roles, scoped to one org. Two orgs can both have a role
-- named "Dispatcher" -- they are different rows with different permission sets.
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key),
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Carrier compliance record: one per carrier org.
CREATE TABLE IF NOT EXISTS carrier_compliance (
  id TEXT PRIMARY KEY,
  carrier_org_id TEXT NOT NULL UNIQUE REFERENCES organizations(id),
  insurance_expiry TEXT NOT NULL, -- ISO date
  mc_dot_status TEXT NOT NULL CHECK (mc_dot_status IN ('ACTIVE','REVOKED','PENDING')),
  approved_equipment TEXT NOT NULL DEFAULT '[]', -- JSON array of equipment types
  approved_commodities TEXT NOT NULL DEFAULT '[]', -- JSON array
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS loads (
  id TEXT PRIMARY KEY,
  broker_org_id TEXT NOT NULL REFERENCES organizations(id),
  shipper_org_id TEXT NOT NULL REFERENCES organizations(id),
  carrier_org_id TEXT REFERENCES organizations(id), -- null until Carrier Assigned
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  pickup_date TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  commodity_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN (
    'POSTED','CARRIER_ASSIGNED','RATE_CONFIRMED','DISPATCHED',
    'IN_TRANSIT','DELIVERED','POD_VERIFIED','INVOICED_CLOSED','DECLINED'
  )),
  compliance_flag INTEGER NOT NULL DEFAULT 0, -- 1 = blocked, must be resolved/overridden
  compliance_flag_reason TEXT,
  confirmed_rate_version_id TEXT REFERENCES rate_confirmations(id),
  pod_file_path TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_confirmations (
  id TEXT PRIMARY KEY,
  load_id TEXT NOT NULL REFERENCES loads(id),
  version INTEGER NOT NULL,
  base_rate REAL NOT NULL,
  accessorials TEXT NOT NULL DEFAULT '[]', -- JSON array of {label, amount}
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','SUPERSEDED')),
  confirmed_by TEXT NOT NULL REFERENCES users(id),
  confirmed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(load_id, version)
);

-- Append-only audit trail. Every status change AND every compliance
-- override is logged here, with the acting user and a reason if applicable.
CREATE TABLE IF NOT EXISTS load_events (
  id TEXT PRIMARY KEY,
  load_id TEXT NOT NULL REFERENCES loads(id),
  event_type TEXT NOT NULL, -- e.g. STATUS_CHANGE, COMPLIANCE_OVERRIDE, RATE_CONFIRMED
  from_status TEXT,
  to_status TEXT,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  metadata TEXT NOT NULL DEFAULT '{}', -- JSON blob, e.g. override reason
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Permission-denied attempts, per spec requirement to log them.
CREATE TABLE IF NOT EXISTS access_denials (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  attempted_path TEXT NOT NULL,
  attempted_method TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_loads_broker ON loads(broker_org_id);
CREATE INDEX IF NOT EXISTS idx_loads_carrier ON loads(carrier_org_id);
CREATE INDEX IF NOT EXISTS idx_loads_shipper ON loads(shipper_org_id);
CREATE INDEX IF NOT EXISTS idx_load_events_load ON load_events(load_id);
