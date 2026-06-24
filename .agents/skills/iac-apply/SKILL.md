---
name: iac-apply
description: Run terraform plan/apply for schedule.pizza infrastructure. Use when the user says /apply, mentions terraform, or wants to deploy/update Cloudflare Workers infrastructure.
---

# Infrastructure Apply

Runs `terraform plan` then `terraform apply` in `apps/pizza/iac/`.

## Prerequisites

Requires `apps/pizza/iac/terraform.tfvars` with:
- `cloudflare_api_token`
- `cloudflare_account_id`
- `cloudflare_zone_id` (blank until domain is registered)

If missing, copy from `terraform.tfvars.example` and prompt the user to fill values.

## Workflow

```bash
cd apps/pizza/iac
terraform init -upgrade
terraform plan -out=tfplan
```

Show the plan output. Ask the user to confirm before applying.

```bash
terraform apply tfplan
rm tfplan
```

If plan shows no changes, say so and stop. Do not apply without user confirmation.
