<div align="center">

# LoadFlow

**Freight brokerage operations — load board, carrier compliance, and rate confirmations, with RBAC enforced server-side.**

[![Node](https://img.shields.io/badge/Node-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)

[**Live demo**](https://load-flow-o0bf.onrender.com) · [Suggested walkthrough](#suggested-walkthrough) · [Assumptions & gaps](#assumptions--honest-gaps)

</div>

---

> ⚠️ **Deployed on Render's free tier** — the backend spins down after 15 min idle and its filesystem resets on restart, which wipes the SQLite data (see [Deployment notes](#deployment-notes)). Give it ~40s to wake up on first load, and expect a clean slate if it's been idle a while.

## What this is

A freight brokerage connects shippers and carriers, negotiates rates, and tracks
shipments pickup-to-delivery — and is legally on the hook if it dispatches a
load to a carrier with lapsed insurance or authority. LoadFlow models that
directly: **RBAC and the compliance gate are the actual product here**, not a
checkbox feature — see [Design priorities](#design-priorities).

| | Broker | Carrier | Shipper |
|---|---|---|---|
| Structure | Org, Admin + custom roles | Org, Admin + custom roles | Single account, no sub-roles |
| Can do | Post loads, assign carriers, confirm rates, override compliance flags | Accept/decline, update status, upload POD | View own shipments only |
| Scoped to | Own brokerage's loads | Own assigned loads | Own shipments |

## Table of contents

- [Quick start](#quick-start)
- [Running the E2E smoke test](#running-the-e2e-smoke-test)
- [Design priorities](#design-priorities)
- [Assumptions & honest gaps](#assumptions--honest-gaps)
- [Deployment notes](#deployment-notes)
- [Suggested walkthrough](#suggested-walkthrough)

## Quick start

No Docker, no external services, no env setup beyond what's committed.

```bash
# Terminal 1 — backend → http://localhost:4000
cd server
npm install
npm start

# Terminal 2 — frontend → http://localhost:5173
cd client
npm install
npm run dev
```

The SQLite file (`server/loadflow.db`) is created and schema-applied
automatically on first boot. Delete it any time to reset to a clean slate.

There's no seed data — open `http://localhost:5173` and sign up as a Broker,
Carrier, and Shipper (three separate browser profiles or incognito windows
work well) to exercise the full flow. See [Suggested walkthrough](#suggested-walkthrough).

> **Windows + `better-sqlite3` note:** if `npm install` in `server/` fails with
> a `node-gyp` / Visual Studio error, it's because `better-sqlite3` compiles
> from source on very new Node versions with no prebuilt binary yet. Switch to
> Node 22 LTS (e.g. via [nvm-windows](https://github.com/coreybutler/nvm-windows))
> and reinstall — Node 22 has a prebuilt binary, so it skips compilation entirely.

## Running the E2E smoke test

`e2e/smoke.js` is a Playwright script — not a formal test suite, a verification
tool used while building — that drives a real browser through signup →
compliance setup → load creation → carrier assignment → rate confirmation →
status advance → shipper visibility, and fails loudly on any console error.
It's what caught the compliance-override gap described below, before it
became a demo-day surprise.

```bash
# with both dev servers already running
npx playwright install chromium --with-deps
node e2e/smoke.js
```

## Design priorities

The spec's two hardest requirements — *"code checks permissions, never role
names"* and *"a lower-privileged account hitting a restricted endpoint
directly must be blocked"* — are also the two things most likely to be faked
with a prettier UI on top of `if (user.role === 'admin')`. So the build order
was: schema → RBAC middleware (negative-path tests written before any load
endpoint existed) → state machine → rate versioning → UI.

Two independent enforcement layers run on **every** request, never merged into one check:

- **Permission** — `requirePermission(key)`: can this user do this *kind* of
  action at all, based on their live role assignments, never a hardcoded role name.
- **Scope** — `loadScopeClause` / `loadInScope`: which *rows* they can see —
  broker→own `broker_org_id`, carrier→own `carrier_org_id`, shipper→own
  `shipper_org_id`. A user can hold a permission and still be scoped out of a
  specific row.

Org Admin (`is_org_admin`) is a separate, **non-revocable bypass flag**, not a
permission in the catalog — otherwise an Admin could accidentally strip their
own `staff.manage` permission via a self-authored role and lock themselves
out of their own org.

## Assumptions & honest gaps

<details>
<summary><strong>5 assumptions made where the spec was ambiguous</strong> (click to expand)</summary>

<br>

1. **Shipper modeled as a one-user org.** The spec calls Shipper an
   "individual/business, no sub-roles" account, distinct from Broker/Carrier
   orgs. Internally it's still an `organizations` row of type `SHIPPER`, so
   every load can reference `broker_org_id` / `carrier_org_id` /
   `shipper_org_id` uniformly instead of special-casing one FK. RBAC tables
   (roles, permissions) simply never get populated for shipper orgs.

2. **Carrier accept/decline vs. the state list.** Section 2 gives "Carrier Dispatch"
   an accept/decline action, but the state machine
   (`Posted -> Carrier Assigned -> Rate Confirmed -> ...`) has no
   `ACCEPTED`/`DECLINED` state. Resolution: `DECLINED` is a side-branch off
   `CARRIER_ASSIGNED` (clears the carrier, lets the broker reassign); "accept"
   isn't a separate transition -- a carrier simply not declining, followed by
   the broker confirming a rate, is what advances the load. Acceptance is
   therefore implicit rather than an explicit carrier action, which is
   arguably a weaker signal than the spec intended.

3. **Where the compliance override actually lives.** The gate is evaluated
   when a carrier is assigned and re-checked at the point a load would leave
   `CARRIER_ASSIGNED` -- which in practice is the rate-confirmation endpoint,
   not a generic status-transition endpoint. Early in the build the override
   permission (`load.override_compliance_flag`) was wired only into the
   generic `/transition` route; the Playwright smoke test surfaced that rate
   confirmation had its own hard block with no override path, which would
   have made the override *unreachable* in the one place it's actually
   needed. Fixed before considering the feature done.

4. **`load.update_status` is not org-restricted in code**, even though the
   permission catalog labels it a Carrier-side permission. Both broker and
   carrier roles can hold it, since moving `POD_VERIFIED -> INVOICED_CLOSED`
   is plausibly a broker (invoicing) action while `DISPATCHED -> IN_TRANSIT`
   is plausibly a carrier action, and the spec's fixed 7-key catalog doesn't
   split them. Object-level scoping still applies regardless of who holds
   the permission.

5. **Bootstrap:** signing up as Broker or Carrier creates a brand-new org
   *and* its first user as that org's non-revocable Admin in one step --
   there's no separate "claim an org" flow. All other staff are created by
   that Admin via Roles & staff and log in with credentials the Admin sets;
   there's no self-service invite-link/email flow.

</details>

<details>
<summary><strong>What's incomplete</strong> (click to expand)</summary>

<br>

- **POD upload/viewer** (stretch #8) -- not built. The schema has a
  `pod_file_path` column reserved for it, and the state machine already has
  `DELIVERED -> POD_VERIFIED` as a transition, but there's no file-upload
  endpoint or UI wired to it. `POD_VERIFIED` is currently reachable via the
  same generic "Advance" button as every other transition, which means POD
  verification isn't actually verified by anything today -- the single most
  load-bearing piece of missing functionality.
- **Compliance expiry renewal alerts** (stretch #9) -- not built. The data
  needed (`insurance_expiry`, `mc_dot_status`) is already tracked and the
  flagging logic already runs at assignment time; a scheduled job or an
  "expiring within N days" banner on the carrier dashboard would be the
  natural next step.
- **Audit log viewer** (stretch #10) -- built, but minimally: one flat,
  org-scoped, chronological table capped at 200 rows, no filtering by
  load/user/event type and no pagination past that cap.
- **Rate confirmation accessorials** are accepted by the API
  (`accessorials: [{label, amount}]`) but there's no UI to add them -- the
  form only exposes base rate.
- **No automated backend test suite.** Verification was done via a scripted
  curl walkthrough (permission denial, scope denial, compliance block,
  override, audit trail) during development, and the Playwright script
  exercises the UI end-to-end, but neither is wired into CI or organized as
  a conventional test file structure.
- **No password reset / email verification** -- signup and invite both take
  a password directly with no confirmation loop.

</details>

<details>
<summary><strong>What I'd do with more time</strong> (click to expand)</summary>

<br>

1. Build POD upload properly -- it's the one place the spec explicitly ties
   a document to a state transition, and right now that binding is missing.
2. Turn the curl-based permission/scope checks from development into an
   actual `supertest`-based backend test suite, so the negative paths
   (cross-org 403s, missing-permission 403s, compliance-block 403s) are
   regression-tested rather than one-off verified.
3. Split `load.update_status` into something more granular so a Carrier role
   genuinely can't touch `POD_VERIFIED -> INVOICED_CLOSED`, closing the gap
   noted in assumption #4.
4. Add compliance expiry alerting and a lightweight notification surface on
   the carrier dashboard.

</details>

## Deployment notes

Deployed on Render: `server/` as a Web Service, `client/` as a Static Site
(env var `VITE_API_URL` pointed at the backend's `/api`). Running on the
**free tier**, which means:

- The backend spins down after 15 minutes idle; the first request after
  that takes 30-60s to wake back up.
- The filesystem is ephemeral on free web services -- every restart wipes
  `loadflow.db`. Data does **not** persist between sessions on the deployed
  instance; it's there to prove the app is live and reachable, not to hold
  state between demos. Persistent SQLite storage requires Render's paid
  tier (a mounted disk), so this is a deliberate free-tier tradeoff, not
  an oversight.
- For anything you need to survive across a session, run it locally instead
  (see [Quick start](#quick-start)) -- local runs persist to disk normally.

## Suggested walkthrough

For a live demo or recording: sign up a Broker, a Carrier, and a Shipper
(three windows). As Broker: create a **Dispatcher** role scoped to
`load.assign_carrier` + `rate.confirm`, invite a staff member with it, post a
load. As that staff member: assign the carrier *before* the carrier has set
up a compliance record -- watch it auto-flag. Try to confirm the rate as that
staff member (blocked, 403). Switch back to the Broker Admin, confirm the
rate with an override reason (succeeds, flag clears, both events land in the
audit trail). That sequence demonstrates permission enforcement, object
scoping, the compliance gate, and the override path in about 90 seconds.
