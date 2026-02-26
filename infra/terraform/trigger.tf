resource "google_cloudbuild_trigger" "main_push" {
  project         = var.project_id
  name            = "contacts-${var.deploy_environment}-deploy"
  service_account = google_service_account.cloudbuild_runner.id

  description = "Build and deploy contacts app to GKE for ${var.deploy_environment}."
  filename    = "cloudbuild.yaml"

  github {
    owner = var.github_owner
    name  = var.github_repo
    push {
      branch = var.deploy_environment == "prod" ? null : var.trigger_branch_regex
      tag    = var.deploy_environment == "prod" ? var.trigger_tag_regex : null
    }
  }

  substitutions = {
    _ARTIFACT_REPO_PATH = var.artifact_repo_path
    _IMAGE_NAME         = var.image_name
    _CLUSTER_NAME       = google_container_cluster.autopilot.name
    _CLUSTER_REGION     = google_container_cluster.autopilot.location
    _K8S_OVERLAY_PATH   = "k8s/overlays/${var.deploy_environment}"
  }

  depends_on = [
    google_container_cluster.autopilot,
    google_project_iam_member.cloudbuild_runner_custom_role,
    google_service_account_iam_member.allow_legacy_cloudbuild_to_impersonate_runner,
    google_service_account_iam_member.allow_cloudbuild_service_agent_to_impersonate_runner,
  ]
}
