variable "cloudflare_account_id" {
  description = "Cloudflare account identifier for 月島デジタル."
  type        = string
}

variable "model_bucket_name" {
  description = "R2 bucket used for versioned model release artifacts."
  type        = string
  default     = "ikimono-scan-models"
}
