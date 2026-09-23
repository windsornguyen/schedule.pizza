mock_provider "planetscale" {}
mock_provider "cloudflare" {}

variables {
  cloudflare_account_id = "00000000000000000000000000000000"
  branch_id             = "branchfixture"
}

override_resource {
  target = planetscale_postgres_branch.core
  values = { id = "branchfixture", replicas = 0, ready = true }
}

run "runtime_credentials_and_consistency" {
  command = plan

  assert {
    condition = (
      planetscale_postgres_branch.core.database == "schedule-pizza-core" &&
      planetscale_postgres_branch.core.region == "us-west" &&
      planetscale_postgres_branch.core.cluster_size == "PS_5_AWS_ARM" &&
      planetscale_postgres_branch.core.deletion_protected
    )
    error_message = "The core database must remain small, protected, and in Oregon."
  }

  assert {
    condition     = planetscale_postgres_branch_role.worker.inherited_roles == toset(["pg_read_all_data", "pg_write_all_data"])
    error_message = "Runtime credentials must have data access only, without schema or role administration."
  }

  assert {
    condition = (
      cloudflare_hyperdrive_config.core.caching.disabled &&
      cloudflare_hyperdrive_config.core.mtls.sslmode == "require" &&
      cloudflare_hyperdrive_config.core.origin_connection_limit == 10 &&
      cloudflare_hyperdrive_config.core.origin.port == 5432
    )
    error_message = "Hyperdrive must use current reads, verified TLS, bounded connections, and the direct Postgres port."
  }
}

run "reject_billed_replicas" {
  command = plan
  override_resource {
    target = planetscale_postgres_branch.core
    values = { id = "branchfixture", replicas = 2, ready = true }
  }
  expect_failures = [planetscale_postgres_branch.core]
}

run "reject_missing_branch_identity" {
  command = plan
  variables { branch_id = "" }
  expect_failures = [var.branch_id]
}

run "reject_invalid_cloudflare_account" {
  command = plan
  variables { cloudflare_account_id = "not-an-account-id" }
  expect_failures = [var.cloudflare_account_id]
}
