output "hyperdrive_id" {
  description = "Production binding identifier; application cutover is a separate deployment."
  value       = cloudflare_hyperdrive_config.core.id
}

output "database" {
  description = "Database and branch identities without connection credentials."
  value = {
    organization = planetscale_postgres_branch.core.organization
    database     = planetscale_postgres_branch.core.database
    branch       = planetscale_postgres_branch.core.name
    branch_id    = planetscale_postgres_branch.core.id
  }
}
