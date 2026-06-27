# Adopt resources that were created before this Terraform root owned state.

import {
  to = cloudflare_d1_database.pizza["dev"]
  id = "461c3e3410e2e50b0fdd218f9ae04957/b8c00258-4534-4c1e-922e-c18a87760190"
}

import {
  to = cloudflare_d1_database.pizza["prod"]
  id = "461c3e3410e2e50b0fdd218f9ae04957/09e70875-d9bd-4b44-868b-86971fcd0486"
}

import {
  to = cloudflare_workers_script.pizza
  id = "461c3e3410e2e50b0fdd218f9ae04957/schedule-pizza"
}
