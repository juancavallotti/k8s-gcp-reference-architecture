data "google_project" "current" {
  project_id = var.project_id
}

locals {
  cloud_build_legacy_sa  = "${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
  cloud_build_service_sa = "service-${data.google_project.current.number}@gcp-sa-cloudbuild.iam.gserviceaccount.com"
}

resource "google_service_account" "cloudbuild_runner" {
  account_id   = var.cloud_build_runner_account_id
  display_name = "Contacts Cloud Build Runner"
  description  = "Runs Cloud Build trigger builds for contacts app deployment."
}

resource "google_project_iam_custom_role" "cloudbuild_runner" {
  project = var.project_id
  role_id = "contactsCloudBuildRunner"
  title   = "Contacts Cloud Build Runner"

  description = "Custom role for building images and deploying contacts app to GKE."
  permissions = [
    "artifactregistry.dockerimages.get",
    "artifactregistry.repositories.downloadArtifacts",
    "artifactregistry.repositories.get",
    "artifactregistry.repositories.list",
    "artifactregistry.repositories.uploadArtifacts",
    "container.clusters.get",
    "container.clusters.getCredentials",
    "container.clusters.list",
    "container.configMaps.create",
    "container.configMaps.get",
    "container.configMaps.list",
    "container.configMaps.update",
    "container.deployments.create",
    "container.deployments.get",
    "container.deployments.list",
    "container.deployments.update",
    "container.events.list",
    "container.namespaces.get",
    "container.namespaces.list",
    "container.persistentVolumeClaims.create",
    "container.persistentVolumeClaims.get",
    "container.persistentVolumeClaims.list",
    "container.persistentVolumeClaims.update",
    "container.pods.get",
    "container.pods.list",
    "container.secrets.create",
    "container.secrets.get",
    "container.secrets.list",
    "container.secrets.update",
    "container.services.create",
    "container.services.get",
    "container.services.list",
    "container.services.update",
    "container.statefulSets.create",
    "container.statefulSets.get",
    "container.statefulSets.list",
    "container.statefulSets.update",
    "logging.logEntries.create",
  ]

  depends_on = [
    google_project_service.required,
  ]
}

resource "google_project_iam_member" "cloudbuild_runner_custom_role" {
  project = var.project_id
  role    = google_project_iam_custom_role.cloudbuild_runner.name
  member  = "serviceAccount:${google_service_account.cloudbuild_runner.email}"

  depends_on = [
    google_project_service.required,
  ]
}

resource "google_service_account_iam_member" "allow_legacy_cloudbuild_to_impersonate_runner" {
  service_account_id = google_service_account.cloudbuild_runner.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.cloud_build_legacy_sa}"
}

resource "google_service_account_iam_member" "allow_cloudbuild_service_agent_to_impersonate_runner" {
  service_account_id = google_service_account.cloudbuild_runner.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.cloud_build_service_sa}"
}
