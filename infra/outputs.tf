output "model_bucket_name" {
  description = "R2 bucket that receives licensed model release artifacts."
  value       = cloudflare_r2_bucket.models.name
}
