variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type    = string
  default = ""
}

variable "domain" {
  type    = string
  default = "schedule.pizza"
}
