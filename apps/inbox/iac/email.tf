resource "cloudflare_email_routing_rule" "inbox_addresses" {
  for_each = var.inbox_addresses

  zone_id  = var.cloudflare_zone_id
  name     = "Route ${each.value} to agentic-inbox"
  enabled  = var.enable_inbox_address_rules
  priority = 100

  matchers = [{
    type  = "literal"
    field = "to"
    value = each.value
  }]

  actions = [{
    type  = "worker"
    value = [cloudflare_workers_script.inbox.script_name]
  }]
}

resource "cloudflare_email_routing_catch_all" "inbox" {
  zone_id = var.cloudflare_zone_id
  name    = "Route unmatched ${var.domain} mail to agentic-inbox"
  enabled = var.enable_inbox_catch_all

  matchers = [{
    type = "all"
  }]

  actions = [{
    type  = "worker"
    value = [cloudflare_workers_script.inbox.script_name]
  }]
}
