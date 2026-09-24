# Runtime roles cannot create tables, manage users, or administer the cluster.
resource "planetscale_postgres_branch_role" "worker" {
  organization    = var.planetscale_organization
  database        = local.database_name
  branch          = planetscale_postgres_branch.core.name
  name            = "schedule-pizza-worker"
  inherited_roles = ["pg_read_all_data", "pg_write_all_data"]
}

# Only trusted release jobs receive this role. It is never a Worker binding.
resource "planetscale_postgres_branch_role" "migrations" {
  organization    = var.planetscale_organization
  database        = local.database_name
  branch          = planetscale_postgres_branch.core.name
  name            = "schedule-pizza-migrations"
  inherited_roles = ["postgres"]
}
