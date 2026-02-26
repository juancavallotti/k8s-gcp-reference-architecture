---
name: infrastructure
description: Ensures infrastructure changes consider all environments (minikube, dev, prod). Use when modifying Terraform, Kustomize overlays, Helm chart, Cloud Build, or deployment topology.
---
# Infrastructure and Environments

When changing infrastructure, **always consider all three environments** so no environment is left broken or inconsistent.

## Environments

| Environment | Purpose | DB | Service type | Ingress |
|-------------|---------|-----|--------------|---------|
| **minikube** | Local K8s (dev machine) | SQLite + PVC | NodePort | None |
| **dev** | GKE dev (branch push) | SQLite + PVC | LoadBalancer | None |
| **prod** | GKE prod (tag push) | Postgres + StatefulSet | ClusterIP | GCE Ingress + ManagedCertificate |

## Where each environment is defined

- **Kustomize**: `k8s/base` + `k8s/overlays/minikube`, `k8s/overlays/dev`, `k8s/overlays/prod`
- **Helm**: `helm/contacts/` with `values.yaml` (defaults), `values-minikube.yaml`, `values-dev.sample.yaml`, `values-prod.sample.yaml` (gitignored: `values-dev.yaml`, `values-prod.yaml`)
- **Terraform**: `infra/terraform` — one trigger per env via `deploy_environment` (`dev` or `prod`); sets `_K8S_OVERLAY_PATH = k8s/overlays/<env>`
- **CI/CD**: `cloudbuild.yaml` uses overlay path from trigger; optional Helm path needs env-specific values from Secret Manager or build step

## Update checklist

When adding or changing infra (new resource, env var, probe, secret, ingress, DB config, etc.):

1. **Identify affected envs**  
   Does this apply to minikube, dev, prod, or all?

2. **Kustomize path**  
   - Change in `k8s/base/` only if all envs share it.  
   - Otherwise add or edit files in the right overlay(s): `k8s/overlays/minikube/`, `k8s/overlays/dev/`, `k8s/overlays/prod/`.

3. **Helm path**  
   If the chart is used: update `helm/contacts/templates/` and the right values file(s). Chart branches on `database.engine` (sqlite vs postgres) and `ingress.enabled`; keep minikube, dev, and prod behavior aligned with Kustomize.

4. **Terraform**  
   Changes in `infra/terraform` affect GKE + Cloud Build only (dev/prod). Run `terraform plan` and consider `deploy_environment` and trigger substitutions.

5. **Secrets and config**  
   - Prod Postgres: `contacts-db-secret` is created by Terraform (`kubernetes-secret.tf`); do not put secrets in repo.  
   - Dev/minikube: no Postgres secret in overlays; SQLite only.

6. **Docs**  
   If topology or steps change, update `README.md` and `DEPLOYMENT_ARCHITECTURE.md`.

## Quick reference

- **Minikube**: SQLite, NodePort (Kustomize or Helm with `values-minikube.yaml`), scripts: `minikube-build-and-load.sh`, `minikube-apply-and-migrate.sh` or `minikube-helm-apply-and-migrate.sh`
- **Dev**: SQLite, LoadBalancer, no ingress; Cloud Build applies `k8s/overlays/dev`
- **Prod**: Postgres, ClusterIP, Ingress + ManagedCertificate, static IP + DNS; Cloud Build applies `k8s/overlays/prod`; secret from Terraform

For full topology and resource inventory, see `DEPLOYMENT_ARCHITECTURE.md` in the repository root.
