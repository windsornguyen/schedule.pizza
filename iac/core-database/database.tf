locals {
  database_name = "schedule-pizza-core"
}

# Cloudflare billing is established once through the vendors' supported CLI flow.
# Importing the branch gives Terraform ownership without recreating the database.
import {
  to = planetscale_postgres_branch.core
  id = jsonencode({
    organization = var.planetscale_organization
    database     = local.database_name
    id           = var.branch_id
  })
}

resource "planetscale_postgres_branch" "core" {
  organization       = var.planetscale_organization
  database           = local.database_name
  name               = "main"
  region             = "us-west"
  cluster_size       = "PS_5_AWS_ARM"
  deletion_protected = true

  lifecycle {
    prevent_destroy = true

    postcondition {
      condition     = self.replicas == 0
      error_message = "The imported branch must be single-node, with no billed replicas."
    }
  }
}
