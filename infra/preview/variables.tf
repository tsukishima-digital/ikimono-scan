variable "cloudflare_account_id" {
  description = "Cloudflare account identifier for the application."
  type        = string
  sensitive   = true
}

variable "model_bucket_name" {
  description = "Private R2 bucket containing versioned model release artifacts."
  type        = string
  default     = "ikimono-scan-models"
}

variable "model_worker_name" {
  description = "Worker serving model artifacts to the mobile preview."
  type        = string
  default     = "ikimono-scan-preview-models"
}
