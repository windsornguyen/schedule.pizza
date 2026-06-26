# Infrastructure

Terraform for the Cloudflare Workers deployment.

The `cloudflare_api_token` value is a bootstrap token for Terraform. It must
be created from Cloudflare's `Create additional tokens` API token template so
Terraform can create the deploy token used by GitHub Actions. A normal Workers
deploy token cannot apply this root.

```
cp terraform.tfvars.example terraform.tfvars
# fill in values
terraform init
terraform plan
terraform apply
terraform output -json d1_database_ids
terraform output -raw cloudflare_account_id \
  | gh secret set CLOUDFLARE_ACCOUNT_ID --repo windsornguyen/schedule.pizza
terraform output -raw deploy_cloudflare_api_token \
  | gh secret set CLOUDFLARE_API_TOKEN --repo windsornguyen/schedule.pizza
```

The Worker script content is managed by `wrangler deploy` — Terraform
creates the resource and route but ignores content changes so the two
don't fight.

Terraform creates separate D1 databases for dev and prod. Copy the
matching UUIDs from `d1_database_ids` into `wrangler.jsonc`.

Import blocks adopt the existing D1 databases and Worker script when local
state is empty.

Terraform also creates the Cloudflare deploy token used by GitHub Actions. The
token is scoped to the schedule.pizza account and Workers route zone instead of
being maintained by hand in the Cloudflare dashboard.

Terraform state contains the generated deploy token. Keep local state out of
Git, and move this root to a private remote backend before multiple operators
share it.
