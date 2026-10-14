terraform {
  required_version = ">= 1.14, < 2.0"

  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # Provider 5.28 removes the registrar_domain data source used by this root.
      version = "~> 5.20, < 5.28"
    }
  }
}

provider "cloudflare" {}
