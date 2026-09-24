# Postgres cutover

The production app moved from D1 to PlanetScale Postgres on September 24, 2026
(UTC), through [PR #45](https://github.com/windsornguyen/schedule.pizza/pull/45).
The merged source is `be4d2466d9a6f1e9c74bfc459b85523c51600d04`.

## Active database

- Personal PlanetScale organization: `windsor`.
- Database: `schedule-pizza-core`, branch `main`, AWS Oregon.
- Hyperdrive binding: `HYPERDRIVE`, with query caching disabled.
- Fixed PS-5 single node, no replicas, 10 GiB, storage autoscaling disabled.
- Runtime role: data read/write only. The separate migration role owns schema changes.

The Worker has no D1 binding. Future schema changes use the TypeScript tables
and generated PostgreSQL migrations described in the
[database guide](../../apps/pizza/app/db/README.md).

## Verification

The final D1 export was restored locally and passed SQLite integrity and
foreign-key checks. All 250 application rows matched after import and again
in a separate read-back verification. IDs and authentication tokens were retained.
The explicit timestamp repair converted one booking-code creation value and one
expiry value from milliseconds. Raw exports and row-level receipts remain private.

The [production deployment workflow](https://github.com/windsornguyen/schedule.pizza/actions/runs/35950484291)
completed schema migration, Worker upload, deployment, and public smoke checks.
An existing signed-in browser session remained valid. A live Google Calendar
booking was confirmed, cancelled through the dashboard, and its slot reopened.
The temporary test booking code was revoked without rotating existing share links.

## Recovery boundary

D1 remains a retained recovery copy, not a second writable database. Its 12
application tables have 36 `cutover_readonly_<table>_<operation>` triggers that
reject inserts, updates, and deletes with `POSTGRES_CUTOVER_READ_ONLY`.
This also fences requests from stale Worker versions. The migration metadata
tables are not part of the application write surface.

Do not remove these triggers or redeploy a D1-backed Worker as an ordinary
rollback. Postgres has accepted writes since cutover. Such a rollback would
either fail against the fence or lose newer writes after removing it.

Roll back only to a Postgres-compatible Worker version. A database-engine reversal
requires a maintenance window, a fresh Postgres backup, explicit reconciliation,
and row-level verification before changing the writer. D1 deletion is a separate,
explicitly approved retention decision. Terraform keeps destruction protection.
