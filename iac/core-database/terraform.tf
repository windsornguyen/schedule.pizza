terraform {
  required_version = ">= 1.11, < 2.0"

  required_providers {
    planetscale = {
      source  = "planetscale/planetscale"
      version = "= 1.11.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 5.21.1"
    }
  }
}

# Both providers read their credentials from environment variables.
provider "planetscale" {}
provider "cloudflare" {}
