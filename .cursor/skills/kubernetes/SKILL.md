---
name: kubernetes
description: Keeps Kubernetes deployment options consistent: Kustomize (base + overlays) and Helm chart must both be updated when changing K8s manifests. Use when editing deployment, service, migration job, ingress, or any Kubernetes resource for the contacts app.
---
# Kubernetes: Kustomize and Helm

This repo supports **two deployment paths** for the same app. When changing any Kubernetes resource, **update both** so minikube, dev, and prod stay consistent whether users deploy with Kustomize or Helm.

## Two paths, same behavior

| Path | Location | How envs differ |
|------|----------|-----------------|
| **Kustomize** | `k8s/base/` + `k8s/overlays/{minikube,dev,prod}/` | Patches and extra resources per overlay |
| **Helm** | `helm/contacts/` (templates + values) | `values-minikube.yaml`, `values-dev.sample.yaml`, `values-prod.sample.yaml` |

Both must produce equivalent manifests for each environment (same probes, env vars, volumes, service types, ingress where applicable).

## Kustomize layout

- **Base** (`k8s/base/`): shared resources — `contacts-service.yaml`, `deployment.yaml`, `migration-job.yaml`. Change here only when all envs share the change.
- **Overlays** (`k8s/overlays/<env>/`): patches (e.g. `deployment-patch.yaml`, `service-patch.yaml`, `migration-job-patch.yaml`) and extra resources (e.g. `pvc.yaml` for sqlite, postgres `StatefulSet`/`Service`/`ConfigMap`, `ingress.yaml`, `managed-certificate.yaml` for prod).

Apply with: `kubectl apply -k k8s/overlays/<env>` (Cloud Build uses this for dev/prod).

## Helm layout

- **Templates** (`helm/contacts/templates/`): one set of templates that branch on values:
  - `database.engine`: `sqlite` → PVC, file-based URL; `postgres` → ConfigMap + Secret, postgres services + StatefulSet.
  - `ingress.enabled`: `true` → Ingress + ManagedCertificate; `false` → no ingress.
- **Values**: `values.yaml` (defaults), `values-minikube.yaml`, `values-dev.sample.yaml`, `values-prod.sample.yaml`. Committed samples; `values-dev.yaml` / `values-prod.yaml` are gitignored for secrets/overrides.

Deploy with: `helm upgrade --install contacts ./helm/contacts -f ./helm/contacts/values-<env>.yaml [--set ...]`.

## Change checklist

When adding or modifying any K8s concern (container image, probes, env vars, volumes, service type, migration job, ingress, DB config):

1. **Kustomize**
   - Shared change? Edit `k8s/base/` (e.g. `deployment.yaml`, `migration-job.yaml`, `contacts-service.yaml`).
   - Env-specific? Edit or add files in the right overlay(s) under `k8s/overlays/minikube/`, `k8s/overlays/dev/`, or `k8s/overlays/prod/` (patches and/or new YAML).

2. **Helm**
   - Update the corresponding template(s) in `helm/contacts/templates/` (e.g. `deployment.yaml`, `migration-job.yaml`, `service.yaml`, `ingress.yaml`, `pvc.yaml`, postgres resources).
   - Use `{{- if eq .Values.database.engine "sqlite" }}` / `postgres` and `{{- if .Values.ingress.enabled }}` so behavior matches overlays.
   - Adjust default or env-specific values in `values.yaml` or `values-minikube.yaml` / `values-*-.sample.yaml` as needed.

3. **Verify**
   - Kustomize: `kubectl kustomize k8s/overlays/<env>` and spot-check key resources.
   - Helm: `helm template contacts ./helm/contacts -f ./helm/contacts/values-<env>.yaml` and compare with the Kustomize output for that env (same structure, env vars, and options).

4. **Environments**  
   Use the **infrastructure** skill to ensure minikube, dev, and prod are all considered; the k8s skill ensures both Kustomize and Helm reflect that.

## Resource parity (quick reference)

| Resource | Kustomize | Helm template |
|----------|-----------|---------------|
| Deployment | base + overlay patches | `deployment.yaml` |
| Service | base + overlay patch (type) | `service.yaml` |
| Migration Job | base + overlay patches | `migration-job.yaml` |
| PVC (SQLite) | overlay `pvc.yaml` | `pvc.yaml` (if sqlite) |
| Postgres (prod) | overlay StatefulSet, services, configmap | `statefulset.yaml`, `postgres-services.yaml`, `configmap.yaml` (if postgres) |
| Ingress + cert (prod) | overlay | `ingress.yaml`, `managed-certificate.yaml` (if ingress.enabled) |

CI currently uses the **Kustomize** path; the Helm path is optional (see `cloudbuild.yaml` and `DEPLOYMENT_ARCHITECTURE.md`). Even when only Kustomize is used in CI, keep the Helm chart in sync so local or future Helm-based deploys match.
