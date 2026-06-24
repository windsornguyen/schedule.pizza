locals {
  d1_database_names = {
    dev  = "schedule-pizza-dev-db"
    prod = "schedule-pizza-prod-db"
  }
}

resource "cloudflare_d1_database" "pizza" {
  for_each = local.d1_database_names

  account_id = var.cloudflare_account_id
  name       = each.value

  read_replication = {
    mode = "disabled"
  }
}
