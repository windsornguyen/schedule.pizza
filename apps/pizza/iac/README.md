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
terraform output -raw cloudflare_account_id \
  | gh secret set CLOUDFLARE_ACCOUNT_ID --repo windsornguyen/schedule.pizza
terraform output -raw deploy_cloudflare_api_token \
  | gh secret set CLOUDFLARE_API_TOKEN --repo windsornguyen/schedule.pizza
```

The Worker script content is managed by `wrangler deploy` — Terraform
creates the resource and route but ignores content changes so the two
don't fight.

The existing D1 databases are retained recovery copies with destruction protection.
Do not bind them to a new Worker deployment. The active Postgres database,
limited runtime role, migration role, and Hyperdrive configuration are managed
in [iac/core-database](../../../iac/core-database/README.md).

Import blocks adopt the existing D1 databases and Worker script when local
state is empty.

Terraform also creates the Cloudflare deploy token used by GitHub Actions. The
token is scoped to the schedule.pizza account and Workers route zone instead of
being maintained by hand in the Cloudflare dashboard.

Terraform state contains the generated deploy token. Keep local state out of
Git, and move this root to a private remote backend before multiple operators
share it.
