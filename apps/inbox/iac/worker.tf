resource "cloudflare_workers_script" "inbox" {
  account_id         = var.cloudflare_account_id
  script_name        = local.inbox_worker_name
  main_module        = "index.js"
  compatibility_date = "2025-11-28"

  content = <<-EOT
    export default {
      fetch() {
        return new Response("agentic-inbox has not been deployed yet", { status: 503 });
      },
      email(message) {
        message.setReject("agentic-inbox has not been deployed yet");
      }
    }
  EOT

  lifecycle {
    ignore_changes = all
  }
}

resource "cloudflare_workers_custom_domain" "inbox" {
  account_id = var.cloudflare_account_id
  zone_id    = var.cloudflare_zone_id
  hostname   = local.inbox_hostname
  service    = cloudflare_workers_script.inbox.script_name
}
