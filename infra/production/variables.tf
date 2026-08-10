variable "cloudflare_account_id" {
  description = "Cloudflare account identifier for the application."
  type        = string
}

variable "domain_name" {
  description = "Apex hostname serving the application."
  type        = string
  default     = "ikimono-scan.app"
}

variable "model_bucket_name" {
  description = "Private R2 bucket containing versioned model release artifacts."
  type        = string
  default     = "ikimono-scan-models"
}

variable "worker_name" {
  description = "Cloudflare Worker service name."
  type        = string
  default     = "ikimono-scan"
}
