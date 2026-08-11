data "cloudflare_zones" "app" {
  account = {
    id = var.cloudflare_account_id
  }
  name      = "ikimono-scan.app"
  max_items = 1
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "preview" {
  account_id = var.cloudflare_account_id
  name       = "ikimono-scan-preview"
  config_src = "cloudflare"
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "preview" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.preview.id
  config = {
    ingress = [
      {
        hostname = "dev.ikimono-scan.app"
        service  = "http://localhost:5175"
      },
      {
        service = "http_status:404"
      },
    ]
  }
}

resource "cloudflare_dns_record" "preview" {
  zone_id = one(data.cloudflare_zones.app.result).id
  name    = "dev.ikimono-scan.app"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.preview.id}.cfargotunnel.com"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

resource "cloudflare_zero_trust_access_policy" "owner" {
  account_id = var.cloudflare_account_id
  name       = "Allow the ikimono-scan owner"
  decision   = "allow"
  include = [
    {
      cloudflare_account_member = {
        account_id = var.cloudflare_account_id
      }
    },
  ]
}

resource "cloudflare_zero_trust_access_application" "preview" {
  account_id       = var.cloudflare_account_id
  name             = "Ikimono Scan mobile preview"
  domain           = "dev.ikimono-scan.app"
  type             = "self_hosted"
  session_duration = "24h"
  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.owner.id
      precedence = 1
    },
  ]
}
