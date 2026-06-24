# Agentic Inbox

Self-hosted email client for `schedule.pizza`, running on Cloudflare.
Uses [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox).

## Resources provisioned by Terraform

- R2 bucket (`agentic-inbox`) for attachments
- Email Routing catch-all -> Worker
- Cloudflare Access policy (restricts UI to owner)

## Setup

```
# 1. Provision infrastructure
cd iac
cp terraform.tfvars.example terraform.tfvars
# fill in values
terraform init && terraform apply

# 2. Clone and deploy the app
git clone https://github.com/cloudflare/agentic-inbox /tmp/agentic-inbox
cd /tmp/agentic-inbox

# 3. Update wrangler.jsonc
#    - Set DOMAINS to "schedule.pizza"
#    - Set route to inbox.schedule.pizza/*

# 4. Set secrets from terraform output
wrangler secret put POLICY_AUD
wrangler secret put TEAM_DOMAIN

# 5. Deploy
npm install && npm run deploy
```

## Notes

- No external DB — SQLite embedded in Durable Objects
- AI agent uses Workers AI (free tier)
- Auth is Cloudflare Access (email-based, zero cost)
- The token needs Email Routing + R2 + Access permissions
