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

variable "domain" {
  type    = string
  default = "schedule.pizza"
}

locals {
  d1_database_names = {
    dev  = "schedule-pizza-dev"
    prod = "schedule-pizza-prod"
  }
}

resource "cloudflare_workers_script" "pizza" {
  account_id  = var.cloudflare_account_id
  script_name = "schedule-pizza"
  main_module = "index.js"

  content = "export default { fetch() { return new Response('deployed via terraform') } }"

  lifecycle {
    ignore_changes = [content, compatibility_date, compatibility_flags]
  }
}

resource "cloudflare_d1_database" "pizza" {
  for_each = local.d1_database_names

  account_id = var.cloudflare_account_id
  name       = each.value
}

resource "cloudflare_workers_route" "pizza" {
  count = var.cloudflare_zone_id == "" ? 0 : 1

  zone_id = var.cloudflare_zone_id
  pattern = "${var.domain}/*"
  script  = cloudflare_workers_script.pizza.script_name
}

variable "cloudflare_zone_id" {
  type    = string
  default = ""
}

output "d1_database_ids" {
  value = {
    for environment, database in cloudflare_d1_database.pizza :
    environment => database.uuid
  }
}
