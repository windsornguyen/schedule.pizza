resource "cloudflare_workers_script" "pizza" {
  account_id  = var.cloudflare_account_id
  script_name = "schedule-pizza"
  main_module = "index.js"

  content = "export default { fetch() { return new Response('deployed via terraform') } }"

  lifecycle {
    ignore_changes = [content, compatibility_date, compatibility_flags]
  }
}
