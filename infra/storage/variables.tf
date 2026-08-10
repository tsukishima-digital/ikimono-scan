variable "cloudflare_account_id" {
  description = "Cloudflare account identifier for the application."
  type        = string
}

variable "model_bucket_name" {
  description = "Private R2 bucket containing versioned model release artifacts."
  type        = string
  default     = "ikimono-scan-models"
}
