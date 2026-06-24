# Infrastructure

Terraform for the Cloudflare Workers deployment.

```
cp terraform.tfvars.example terraform.tfvars
# fill in values
terraform init
terraform plan
terraform apply
terraform output -json d1_database_ids
```

The Worker script content is managed by `wrangler deploy` — Terraform
creates the resource and route but ignores content changes so the two
don't fight.

Terraform creates separate D1 databases for dev and prod. Copy the
matching UUIDs from `d1_database_ids` into `wrangler.jsonc`.
