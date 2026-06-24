resource "cloudflare_workers_route" "pizza" {
  count = var.cloudflare_zone_id == "" ? 0 : 1

  zone_id = var.cloudflare_zone_id
  pattern = "${var.domain}/*"
  script  = cloudflare_workers_script.pizza.script_name
}
