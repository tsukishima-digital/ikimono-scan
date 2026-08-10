resource "cloudflare_r2_bucket" "models" {
  account_id    = var.cloudflare_account_id
  name          = var.model_bucket_name
  location      = "apac"
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}
