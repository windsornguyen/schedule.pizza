# Database

The TypeScript files in `schema/` own the relational schema, one table per file.
`functions/` owns queries and transactions. Drizzle generates the PostgreSQL SQL
in `../../drizzle/`; do not hand-edit ordinary migrations.

The Worker connects to PlanetScale through Hyperdrive with query caching off.
`withDatabase` owns one request-scoped pool. Each transaction uses a dedicated
connection so parallel React Router loaders cannot share transaction state.
All database work must finish before the handler returns; deferred loaders must
not retain this pool. The pool is closed even when the request fails.

## Development

Use a disposable PostgreSQL 18 database in the existing shared Linux environment.
Do not use the production connection string for development or tests. Wrangler's
local Hyperdrive binding defaults to `postgres://pizza:pizza@127.0.0.1:5432/pizza`.
Override it with `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` when the
database runs on another host. Remote development can access production: do not
enable `--remote` for ordinary local work.

```sh
DATABASE_URL=postgres://pizza:pizza@127.0.0.1:5432/pizza pnpm db migrate
TEST_DATABASE_URL=postgres://pizza:pizza@127.0.0.1:5432/pizza pnpm check
pnpm dev
```

After editing a table, run `pnpm db generate --name=describe_change`, review the
generated migration, and run the full gate. CI supplies its own PostgreSQL service.
Schema migrations use a dedicated privileged role; the Worker role has data
read/write privileges only. Production migration credentials never belong in
Worker bindings, browser assets, or build steps.

## Transactions

- Reservations lock all participating host rows in sorted ID order, then check
  overlaps using a fresh READ COMMITTED snapshot. A group reserves every host
  or none; touching interval endpoints do not overlap.
- Group transitions lock bookings in sorted order and require every member to
  remain pending. Confirmation and failure cannot partially update a group.
- Profile creation, renames, and booking-code rotation are atomic. Rotation
  locks the host so simultaneous rotations leave one active code.
- Booking-code authorization locks its IP's `booking_code_gate` row until quota
  checks and attempt recording finish. These are ordinary row locks, not
  Hyperdrive-unsupported advisory locks. Gate rows contain only IP hashes.

The integration tests use real transactions and concurrent connections. Unit
SQL-string mocks are not proof of database concurrency semantics.

## D1 Cutover

Freeze application writes and drain pending Google Calendar work before exporting.
Restore the export into SQLite with foreign-key enforcement disabled during
loading (D1 exports tables out of dependency order), then require both
`PRAGMA integrity_check` and `PRAGMA foreign_key_check` to pass.

`apps/pizza/scripts/import-d1.mjs` imports the restored snapshot into the generated
Postgres schema. It refuses nonempty target tables, compares every normalized
column in every row, and rolls back on any mismatch. `--rehearse` always rolls
back; `--import` commits; `--verify` only compares. Keep exports and receipts
outside the checkout with private permissions. Never send real user data to CI.

The initial production export contains one `booking_code.createdAt` value and
one `booking_code.expiresAt` value in milliseconds. Passing the explicit
`--repair-booking-code-milliseconds` flag converts only these two named columns
within the supported date range and records repair counts. Unexpected units
elsewhere fail. Booleans convert strictly from 0/1; IDs and tokens stay unchanged.

Retain D1 and the export after cutover. Once Postgres accepts writes, restoring an
old D1-backed Worker would lose those writes. Roll back only to a Postgres-compatible
Worker, or freeze writes and reconcile data before changing database engines.
