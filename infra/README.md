# Infrastructure

Cloudflare resources are managed with Terraform. Authentication is supplied through `CLOUDFLARE_API_TOKEN`; credentials and local state must not be committed.

The current scaffold creates the private R2 bucket for versioned model artifacts. The Worker, custom domain, and the read-only R2 binding will be added when the first licensed model release is ready, so a placeholder deployment cannot accidentally publish a model.

```console
terraform init
terraform plan -var='cloudflare_account_id=...'
```
