output "access_policy_aud" {
  value     = cloudflare_zero_trust_access_application.inbox.aud
  sensitive = true
}

output "access_team_domain" {
  value = "https://${data.cloudflare_zero_trust_organization.account.auth_domain}"
}

output "inbox_addresses" {
  value = sort(tolist(var.inbox_addresses))
}

output "inbox_url" {
  value = "https://${local.inbox_hostname}"
}

output "r2_bucket_name" {
  value = cloudflare_r2_bucket.inbox.name
}
