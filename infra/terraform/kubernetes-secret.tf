resource "kubernetes_secret_v1" "contacts_db_secret" {
  metadata {
    name = "contacts-db-secret"
  }

  type = "Opaque"

  data = {
    POSTGRES_PASSWORD = var.db_password
  }

  depends_on = [
    google_container_cluster.autopilot,
  ]
}
