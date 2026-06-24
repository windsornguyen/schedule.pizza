terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "domain" {
  type    = string
  default = "schedule.pizza"
}

variable "owner_email" {
  type = string
}

# R2 bucket for email attachments
resource "cloudflare_r2_bucket" "inbox" {
  account_id = var.cloudflare_account_id
  name       = "agentic-inbox"
}

# Email routing catch-all → Worker
resource "cloudflare_email_routing_catch_all" "inbox" {
  zone_id = var.cloudflare_zone_id
  enabled = true

  matchers = [{
    type = "all"
  }]

  actions = [{
    type  = "worker"
    value = ["agentic-inbox"]
  }]
}

# Cloudflare Access — protect the inbox UI
resource "cloudflare_zero_trust_access_application" "inbox" {
  zone_id          = var.cloudflare_zone_id
  name             = "Agentic Inbox"
  domain           = "inbox.${var.domain}"
  session_duration = "24h"
  type             = "self_hosted"
}

resource "cloudflare_zero_trust_access_policy" "inbox_allow_owner" {
  zone_id        = var.cloudflare_zone_id
  application_id = cloudflare_zero_trust_access_application.inbox.id
  name           = "Allow owner"
  precedence     = 1
  decision       = "allow"

  include = [{
    email = { email = var.owner_email }
  }]
}

# Outputs for wrangler secrets
output "access_policy_aud" {
  value     = cloudflare_zero_trust_access_application.inbox.aud
  sensitive = true
}

output "access_team_domain" {
  value = "${var.cloudflare_account_id}.cloudflareaccess.com"
}
