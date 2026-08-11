output "application_url" {
  description = "Public application URL after a successful deployment."
  value       = var.site_published ? "https://${cloudflare_workers_custom_domain.app[0].hostname}" : null
}

output "model_bucket_name" {
  description = "Private R2 bucket containing versioned model release artifacts."
  value       = var.model_bucket_name
}
