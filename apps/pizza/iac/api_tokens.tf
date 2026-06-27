locals {
  deploy_token_account_permissions = [
    "Account Settings Read",
    "D1 Write",
    "Workers Scripts Write",
  ]

  deploy_token_zone_permissions = [
    "Workers Routes Write",
  ]
}

data "cloudflare_account_api_token_permission_groups_list" "deploy_account" {
  for_each = toset(local.deploy_token_account_permissions)

  account_id = var.cloudflare_account_id
  name       = each.value
}

data "cloudflare_account_api_token_permission_groups_list" "deploy_zone" {
  for_each = toset(local.deploy_token_zone_permissions)

  account_id = var.cloudflare_account_id
  name       = each.value
}

resource "cloudflare_account_token" "deploy" {
  account_id = var.cloudflare_account_id
  name       = "${var.domain} deploy"
  status     = "active"

  policies = [
    {
      effect = "allow"
      permission_groups = [
        for permission in local.deploy_token_account_permissions : {
          id = one(data.cloudflare_account_api_token_permission_groups_list.deploy_account[permission].result).id
        }
      ]
      resources = jsonencode({
        "com.cloudflare.api.account.${var.cloudflare_account_id}" = "*"
      })
    },
    {
      effect = "allow"
      permission_groups = [
        for permission in local.deploy_token_zone_permissions : {
          id = one(data.cloudflare_account_api_token_permission_groups_list.deploy_zone[permission].result).id
        }
      ]
      resources = jsonencode({
        "com.cloudflare.api.account.${var.cloudflare_account_id}" = {
          "com.cloudflare.api.account.zone.${var.cloudflare_zone_id}" = "*"
        }
      })
    },
  ]
}
