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

variable "inbox_addresses" {
  type = set(string)
  default = [
    "security@schedule.pizza",
    "support@schedule.pizza",
  ]
}

variable "enable_inbox_address_rules" {
  type    = bool
  default = false
}

variable "enable_inbox_catch_all" {
  type    = bool
  default = false
}
