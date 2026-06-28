data "cloudflare_zero_trust_organization" "account" {
  account_id = var.cloudflare_account_id
}

resource "cloudflare_zero_trust_access_application" "inbox" {
  account_id       = var.cloudflare_account_id
  name             = "schedule.pizza inbox"
  session_duration = "24h"
  type             = "self_hosted"

  destinations = [{
    type = "public"
    uri  = local.inbox_hostname
  }]

  policies = [{
    name       = "Allow owner"
    decision   = "allow"
    precedence = 1

    include = [{
      email = {
        email = var.owner_email
      }
    }]
  }]
}
