resource "cloudflare_hyperdrive_config" "core" {
  account_id = var.cloudflare_account_id
  name       = "schedule-pizza-core"
  origin = {
    scheme   = "postgres"
    host     = planetscale_postgres_branch_role.worker.access_host_url
    port     = 5432
    database = planetscale_postgres_branch_role.worker.database_name
    user     = planetscale_postgres_branch_role.worker.username
    password = planetscale_postgres_branch_role.worker.password
  }
  caching = { disabled = true }
  # Hyperdrive's require mode validates public server certificates via WebPKI.
  # verify-full is the custom-CA mode and requires an uploaded CA certificate.
  mtls = { sslmode = "require" }

  origin_connection_limit = 10
}
