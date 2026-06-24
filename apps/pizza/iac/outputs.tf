output "d1_database_ids" {
  value = {
    for environment, database in cloudflare_d1_database.pizza :
    environment => database.uuid
  }
}
