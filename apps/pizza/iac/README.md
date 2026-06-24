# Infrastructure

Terraform for the Cloudflare Workers deployment.

```
cp terraform.tfvars.example terraform.tfvars
# fill in values
terraform init
terraform plan
terraform apply
```

The Worker script content is managed by `wrangler deploy` — Terraform
creates the resource and route but ignores content changes so the two
don't fight.
