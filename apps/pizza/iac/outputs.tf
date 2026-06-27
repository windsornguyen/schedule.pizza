output "d1_database_ids" {
  value = {
    for environment, database in cloudflare_d1_database.pizza :
    environment => database.uuid
  }
}

output "cloudflare_account_id" {
  value = var.cloudflare_account_id
}

output "deploy_cloudflare_api_token" {
  value     = cloudflare_account_token.deploy.value
  sensitive = true
}

output "deploy_cloudflare_api_token_id" {
  value = cloudflare_account_token.deploy.id
}
