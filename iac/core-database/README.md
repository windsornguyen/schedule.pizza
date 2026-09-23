# Core Database

PlanetScale Postgres is the target for schedule.pizza's relational data. Cloudflare
Hyperdrive supplies connection pooling with query caching disabled. Sessions,
booking-code revocation, quotas, and availability require current reads.

This root provisions infrastructure only. It does not change the live Worker,
copy production data, or delete D1. The application currently still uses D1.

| Environment | PlanetScale database | Branch | Initial replicas |
| --- | --- | --- | --- |
| Production | `schedule-pizza-core` | `main` | 0 (single node) |
| Development | Local Postgres | Not hosted | None |

The database belongs to the personal `windsor` organization, not a company
organization. Development uses synthetic data in local Postgres, not a copy of
production user data. Region `us-west` is PlanetScale's identifier for AWS Oregon.

## Bootstrap and Apply

Confirm the recurring database charges before creating resources. PlanetScale's
API quoted single-node PS-5 at $5/month on 2026-09-23, before metered backup and
network usage. The approved setup has no replicas, fixed compute, storage
autoscaling disabled, and a fixed 10 GB disk. This does not cap network
egress charges or make the database highly available. Billing continues while
a database exists, even when idle. Resize only after explicit approval.

The current Terraform provider does not expose Cloudflare billing authorization
or writable replica/storage settings. Use the vendors' documented CLI bootstrap
once (or their in-app billing wizard), then import the branch into this root.
Do not use `local-exec` provisioners.

```sh
# Requires authenticated Wrangler and pscale. The billing proof is a secret:
# pipe it directly, and never put it in command arguments or commit it.
wrangler hyperdrive planetscale signature | pscale database create schedule-pizza-core \
  --org windsor --engine postgresql --major-version 18 \
  --region us-west --cluster-size PS_5_AWS_ARM --replicas 0 \
  --min-storage 10737418240 --max-storage 10737418240 \
  --cloudflare-billing @- --format json
```

`--cloudflare-billing` is an officially documented, hidden pscale flag. Record
the `main` branch ID from `pscale branch list schedule-pizza-core --org windsor
--format json`. Put it and `cloudflare_account_id` in an ignored `terraform.tfvars`:

```hcl
cloudflare_account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
branch_id = "YOUR_PRODUCTION_BRANCH_ID"
```

Export `PLANETSCALE_SERVICE_TOKEN_ID`, `PLANETSCALE_SERVICE_TOKEN`, and
`CLOUDFLARE_API_TOKEN` through the local credential store, not tracked files.
The PlanetScale service token should be scoped to this database only. The
Cloudflare token needs Hyperdrive read/write on the intended account.
For the PlanetScale service token, grant `read_database`, `read_branch`,
`write_database`, `connect_production_branch`, and
`delete_production_branch_password` on `schedule-pizza-core` only. OAuth scope
names in API examples are not interchangeable with service-token access names.

```sh
terraform init -lockfile=readonly
terraform validate
terraform test
terraform plan -out=tfplan
# Inspect the complete plan before applying it.
terraform apply tfplan
```

Commit `.terraform.lock.hcl`. Never commit state, saved plans, or secrets.
State contains generated database passwords; keep it private and encrypted at
rest, and do not copy it to build machines. Outputs contain identifiers only.
Cloudflare validates the database connection when creating Hyperdrive. Use the
direct Postgres port, 5432, because Hyperdrive already owns connection pooling.
Hyperdrive's `require` TLS mode validates public server certificates using
WebPKI. Its `verify-full` mode requires an uploaded custom CA, not just a flag.

The Worker roles have data read/write permissions only; migrations must use a
separate privileged connection. Do not give runtime roles DDL or role-management
permissions. `prevent_destroy` and provider deletion protection guard the
database. Replica changes require an explicit vendor operation; the Terraform
postcondition rejects billed replicas. The provider does not expose the storage
autoscaling switch: disable it under Clusters > Storage and verify it through
the vendor's cluster settings before sending application traffic. Equal minimum
and maximum storage values are an additional ceiling, not proof that the switch
is off. Do not claim Terraform currently reconciles this unsupported field.
Postgres 18 is selected during bootstrap; the provider does not recover
`major_version` on import, so declaring it here would replace the existing
database. Keep `prevent_destroy` enabled.

## Application Cutover

1. Translate the per-table Drizzle schema to `pg-core`; generate PostgreSQL SQL.
2. Replace D1 batches with transactions. Lock participating host rows in stable
   ID order before checking and reserving overlapping slots; prove concurrent
   requests cannot both succeed. A SQLite `INSERT ... WHERE NOT EXISTS` is not
   sufficient under PostgreSQL's default isolation.
3. Use request-scoped `pg` connections through Hyperdrive. Release them in a
   `finally` block; do not share connection state across Worker requests.
4. Switch Better Auth's Drizzle provider to `pg` and preserve account IDs,
   sessions, stored credentials, and timestamp meaning. Test login and refresh.
5. Rehearse an export/import into development with synthetic data. Inspect
   PlanetScale's `pscale import d1` dry run, but keep the TypeScript schema as the
   source of truth rather than accepting an unchecked inferred schema.
6. For live cutover, pause writes, export D1, import and compare every table's
   counts and relationships, then deploy the PostgreSQL Worker. Keep D1 intact.
   Returning to D1 after accepting PostgreSQL writes needs reconciliation, not
   just a Worker rollback. Update the release migration gate and service-provider
   disclosure before switching traffic.

References: [PlanetScale Terraform](https://planetscale.com/docs/terraform),
[Cloudflare billing bootstrap](https://developers.cloudflare.com/hyperdrive/planetscale/),
[Hyperdrive and PlanetScale](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/planetscale-postgres/).
