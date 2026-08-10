output "model_bucket_name" {
  description = "Private R2 bucket containing versioned model release artifacts."
  value       = cloudflare_r2_bucket.models.name
}
