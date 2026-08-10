output "state_bucket_name" {
  description = "Private R2 bucket used by the Terraform S3 backend."
  value       = cloudflare_r2_bucket.terraform_state.name
}
