resource "google_compute_global_address" "contacts_ingress" {
  count = var.deploy_environment == "prod" ? 1 : 0

  name = var.ingress_static_ip_name

  depends_on = [
    google_project_service.required,
  ]
}

resource "google_dns_record_set" "contacts_a_record" {
  count = var.deploy_environment == "prod" ? 1 : 0

  managed_zone = var.dns_managed_zone
  name         = var.contacts_dns_name
  type         = "A"
  ttl          = 300
  rrdatas = [
    google_compute_global_address.contacts_ingress[0].address,
  ]

  depends_on = [
    google_project_service.required,
  ]
}
