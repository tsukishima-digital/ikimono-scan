variable "cloudflare_account_id" {
  description = "Cloudflare account identifier for the application."
  type        = string
}

variable "state_bucket_name" {
  description = "Private R2 bucket dedicated to Terraform state and backups."
  type        = string
  default     = "ikimono-scan-terraform-state"
}
