resource "cloudflare_r2_bucket" "inbox" {
  account_id = var.cloudflare_account_id
  name       = local.inbox_bucket_name
}
