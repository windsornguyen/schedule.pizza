resource "cloudflare_workers_route" "pizza" {
  zone_id = var.cloudflare_zone_id
  pattern = "${var.domain}/*"
  script  = cloudflare_workers_script.pizza.script_name
}
