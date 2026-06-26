variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string

  validation {
    condition     = length(var.cloudflare_zone_id) > 0
    error_message = "cloudflare_zone_id is required because the deploy token is scoped to Workers Routes on this zone."
  }
}

variable "domain" {
  type    = string
  default = "schedule.pizza"
}
