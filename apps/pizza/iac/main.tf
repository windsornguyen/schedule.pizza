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

resource "cloudflare_workers_script" "pizza" {
  account_id = var.cloudflare_account_id
  script_name = "schedule-pizza"
  main_module = "index.js"

  content = [{
    content  = "export default { fetch() { return new Response('deployed via terraform') } }"
    name     = "index.js"
    type     = "esm"
  }]

  lifecycle {
    ignore_changes = [content, compatibility_date, compatibility_flags]
  }
}

resource "cloudflare_workers_route" "pizza" {
  zone_id = var.cloudflare_zone_id
  pattern = "${var.domain}/*"
  script  = cloudflare_workers_script.pizza.script_name
}

variable "cloudflare_zone_id" {
  type    = string
  default = ""
}
