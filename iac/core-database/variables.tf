variable "planetscale_organization" {
  description = "Personal PlanetScale organization that owns only the intended resources."
  type        = string
  default     = "windsor"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the application's Hyperdrive configurations."
  type        = string

  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be a 32-character Cloudflare account identifier."
  }
}

variable "branch_id" {
  description = "Existing main-branch ID from the fixed-size Cloudflare billing bootstrap."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]+$", var.branch_id))
    error_message = "Provide the nonempty PlanetScale production branch ID."
  }
}
