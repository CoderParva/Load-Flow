# LoadFlow — Freight Brokerage Operations Suite

An operations platform for a freight brokerage: post loads, assign carriers,
confirm rates, and track shipments pickup-to-delivery — with compliance
checks that block dispatching to a carrier with lapsed insurance or authority.

Built for a hackathon. **RBAC and the compliance gate were treated as the
actual product**, not a feature bullet — see [Why RBAC first](#design-priorities)
below.

## Stack (one line each)

- **Backend:** Node/Express — synchronous, minimal ceremony, easy to review in one sitting.
- **DB:** SQLite via `better-sqlite3` — zero setup, judges can clone and run with no external service.
- **Frontend:** React + Vite — fast dev loop, no build config to fight.
- **Auth:** JWT carries only `{ userId }`; permissions are re-read from the DB on every request. If the token cached permissions, revoking a role would silently do nothing until the token expired — so it doesn't.

## Running it

Two terminals, no Docker, no env setup beyond what's committed:

```bash
# Terminal 1 — backend (http://localhost:4000)
cd server
npm install
npm start

# Terminal 2 — frontend (http://localhost:5173)
cd client
npm install
npm run dev
```

The SQLite file (`server/loadflow.db`) is created and schema-applied
automatically on first boot. Delete it any time to reset to a clean slate.

Open `http://localhost:5173`. There's no seed data — sign up as a Broker,
Carrier, and Shipper (three separate browser profiles or incognito windows
work well) to exercise the full flow. See [Suggested walkthrough](#suggested-walkthrough-path)
below for the exact click-path used in the demo recording.

### Running the E2E smoke test

`e2e/smoke.js` is a Playwright script (not a formal test suite — a
verification tool used while building) that drives a real browser through
signup → compliance setup → load creation → carrier assignment → rate
confirmation → status advance → shipper visibility, and fails loudly on any
console error. It's what caught the compliance-override gap described below.

```bash
# with both dev servers already running
npm install -g playwright   # or: npx playwright install chromium --with-deps
node e2e/smoke.js
```

## Design priorities

The spec's two hardest requirements — *"code checks permissions, never role
names"* and *"a lower-privileged account hitting a restricted endpoint
directly must be blocked"* — are also the two things most likely to be
faked with a prettier UI on top of `if (user.role === 'admin')`. So the
build order was: schema → RBAC middleware (with negative-path tests before
any load endpoint existed) → state machine → rate versioning → UI.

Two independent enforcement layers run on every request, not one merged
check:
- **Permission** (`requirePermission(key)`): can this user do this *kind*
  of action at all, based on their live role assignments — never a
  hardcoded role name.
- **Scope** (`loadScopeClause` / `loadInScope`): which *rows* they can see —
  broker→own broker_org_id, carrier→own carrier_org_id, shipper→own
  shipper_org_id. A user can hold a permission and still be scoped out of a
  specific row.

Org Admin (`is_org_admin`) is a separate, non-revocable bypass flag, not a
permission in the catalog — otherwise an Admin could accidentally strip
their own `staff.manage` permission via a self-authored role and lock
themselves out of their own org.

## Assumptions made

The spec leaves a few real gaps; here's how each was resolved and why:

1. **Shipper modeled as a one-user org.** The spec calls Shipper an
   "individual/business, no sub-roles" account, distinct from Broker/Carrier
   orgs. Internally it's still an `organizations` row of type `SHIPPER`, so
   every load can reference `broker_org_id` / `carrier_org_id` /
   `shipper_org_id` uniformly instead of special-casing one FK. RBAC tables
   (roles, permissions) simply never get populated for shipper orgs.

2. **Carrier accept/decline vs. the state list.** §2 gives "Carrier
   Dispatch" an accept/decline action, but §3's state machine
   (`Posted → Carrier Assigned → Rate Confirmed → ...`) has no
   `ACCEPTED`/`DECLINED` state. Resolution: `DECLINED` is a side-branch off
   `CARRIER_ASSIGNED` (clears the carrier and lets the broker reassign);
   "accept" isn't a separate transition — a carrier simply not declining,
   followed by the broker confirming a rate, is what advances the load.
   This means acceptance is implicit rather than an explicit carrier
   action, which is arguably a weaker signal than the spec intended.

3. **Where the compliance override actually lives.** The gate is evaluated
   when a carrier is assigned and re-checked at the point a load would
   leave `CARRIER_ASSIGNED` — which in practice is the rate-confirmation
   endpoint, not a generic status-transition endpoint. Early in the build
   the override permission (`load.override_compliance_flag`) was wired
   only into the generic `/transition` route; the Playwright smoke test
   surfaced that rate confirmation had its own hard block with no override
   path, which would have made the override *unreachable* in the one place
   it's actually needed. Fixed before considering the feature done.

4. **`load.update_status` is not org-restricted in code**, even though the
   permission catalog labels it a Carrier-side permission. Both broker and
   carrier roles can hold it, since moving `POD_VERIFIED → INVOICED_CLOSED`
   is plausibly a broker (invoicing) action while `DISPATCHED → IN_TRANSIT`
   is plausibly a carrier action, and the spec's fixed 7-key catalog
   doesn't split them. Object-level scoping still applies regardless of
   who holds the permission.

5. **Bootstrap:** signing up as Broker or Carrier creates a brand-new org
   *and* its first user as that org's non-revocable Admin in one step —
   there's no separate "claim an org" flow. All other staff are created by
   that Admin via Roles & staff and log in with credentials the Admin sets;
   there's no self-service invite-link/email flow.

## What's incomplete

- **POD upload/viewer** (stretch #8) — not built. The schema has a
  `pod_file_path` column reserved for it, and the state machine already
  has `DELIVERED → POD_VERIFIED` as a transition, but there's no file
  upload endpoint or UI wired to it. `POD_VERIFIED` is currently reachable
  via the same generic "Advance" button as every other transition, which
  means POD verification isn't actually verified by anything today — it's
  the single most load-bearing piece of missing functionality.
- **Compliance expiry renewal alerts** (stretch #9) — not built. The data
  needed (`insurance_expiry`, `mc_dot_status`) is already tracked and the
  flagging logic already runs at assignment time; a scheduled job or a
  "expiring within N days" banner on the carrier dashboard would be the
  natural next step.
- **Audit log viewer** (stretch #10) — built, but minimally: one flat,
  org-scoped, chronological table capped at 200 rows, no filtering by
  load/user/event type and no pagination past that cap.
- **Rate confirmation accessorials** are accepted by the API
  (`accessorials: [{label, amount}]`) but there's no UI to add them — the
  form only exposes base rate.
- **No automated backend test suite.** Verification was done via a
  scripted curl walkthrough (permission denial, scope denial, compliance
  block, override, audit trail) during development, and the Playwright
  script exercises the UI end-to-end, but neither is wired into CI or
  organized as a conventional test file structure.
- **No password reset / email verification** — signup and invite both
  take a password directly with no confirmation loop.

## What I'd do with more time

1. Build POD upload properly — it's the one place the spec explicitly
   ties a document to a state transition, and right now that binding
   is missing.
2. Turn the curl-based permission/scope checks from development into an
   actual `supertest`-based backend test suite, so the negative paths
   (cross-org 403s, missing-permission 403s, compliance-block 403s) are
   regression-tested rather than one-off verified.
3. Split `load.update_status` into something more granular so a Carrier
   role genuinely can't touch `POD_VERIFIED → INVOICED_CLOSED`, closing
   the gap noted in assumption #4.
4. Add compliance expiry alerting and a lightweight notification surface
   on the carrier dashboard.

## Suggested walkthrough path

For the recording: sign up a Broker, a Carrier, and a Shipper (three
windows). As Broker: create a "Dispatcher" role scoped to
`load.assign_carrier` + `rate.confirm`, invite a staff member with it, post
a load. As that staff member: assign the carrier *before* the carrier has
set up a compliance record — watch it auto-flag. Try to confirm the rate
as that staff member (blocked, 403). Switch back to the Broker Admin,
confirm the rate with an override reason (succeeds, flag clears, both
events land in the audit trail). That sequence demonstrates permission
enforcement, object scoping, the compliance gate, and the override path
in about 90 seconds.
