data "cloudflare_zones" "app" {
  account = {
    id = var.cloudflare_account_id
  }
  name      = var.domain_name
  max_items = 1
}

data "cloudflare_registrar_domain" "app" {
  # Implementation: The provider cannot import existing registrations, so the
  # pre-existing purchase stays read-only until import support is available.
  account_id  = var.cloudflare_account_id
  domain_name = var.domain_name
}

resource "cloudflare_workers_script" "app" {
  account_id         = var.cloudflare_account_id
  script_name        = var.worker_name
  compatibility_date = "2026-08-10"
  content_file       = "${path.module}/worker/index.js"
  content_sha256     = filesha256("${path.module}/worker/index.js")
  main_module        = "index.js"

  assets = {
    directory = "${path.module}/../../web/dist"
    config = {
      headers            = file("${path.module}/../../web/public/_headers")
      not_found_handling = "single-page-application"
      run_worker_first   = ["/models/*"]
    }
  }

  bindings = [
    {
      name = "ASSETS"
      type = "assets"
    },
    {
      bucket_name = var.model_bucket_name
      name        = "MODELS"
      type        = "r2_bucket"
    },
  ]

  observability = {
    enabled = false
  }
}

resource "cloudflare_workers_custom_domain" "app" {
  account_id = var.cloudflare_account_id
  hostname   = var.domain_name
  service    = cloudflare_workers_script.app.script_name
  zone_id    = one(data.cloudflare_zones.app.result).id
  zone_name  = var.domain_name
}
