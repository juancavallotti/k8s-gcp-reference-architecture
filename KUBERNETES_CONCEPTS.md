# Kubernetes Concepts Used In This Repo

This project deploys a Next.js app and a Postgres database into Kubernetes using manifest files and `kustomize`.

The manifests in `k8s/` are focused on workload and networking resources. The database password secret is expected to exist in the cluster as `contacts-db-secret` (for example, provisioned by Terraform), and is consumed by the app/database Pods.

## 1) Kustomization (resource composition)

File: `kustomization.yaml`

`Kustomization` is the entrypoint that bundles multiple manifests into one deployable set.

- It lists the resources to apply together: config, secret, services, stateful workload, and app workload.
- Typical usage:

```bash
kubectl apply -k .
```

## 2) Deployment (stateless app replicas)

File: `deployment.yaml` (resource name: `contacts`)

`Deployment` manages stateless app Pods and keeps the desired replica count running.

- `replicas: 3` means Kubernetes schedules three app Pods.
- `selector.matchLabels` and Pod template `labels` (`app: contacts`) tie the Deployment to its Pods.
- The container reads database configuration from `ConfigMap` + `Secret`.
- The image is pulled from Artifact Registry:
  - `us-west1-docker.pkg.dev/juancavallotti/eetr-artifacts/contacts-db-sample:latest`
- This manifest does not currently set `nodeSelector` or `imagePullPolicy`, so normal cluster scheduling and default image pull behavior apply.

## 3) StatefulSet (stateful database workload)

File: `statefulset.yaml` (resource name: `postgres`)

`StatefulSet` is used for stateful services like databases that need stable identity and persistent storage.

- `serviceName: postgres` connects the StatefulSet to the headless service.
- `replicas: 1` runs a single Postgres instance.
- The Pod gets `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` from Kubernetes config resources.
- `volumeClaimTemplates` creates a per-Pod PersistentVolumeClaim named `data` and mounts it at `/var/lib/postgresql/data`.

## 4) Services (internal networking and discovery)

Files: `contacts-service.yaml`, `service.yaml`, `postgres-service.yaml`

This repo uses two service patterns:

- App service `contacts` (port `80` -> targetPort `3000`)
  - Exposes the Next.js Pods internally in the cluster.
  - Used as the backend service for Ingress.
- Headless service `postgres` (`clusterIP: None`)
  - Used with the StatefulSet for stable DNS identity of stateful Pods.
- Regular ClusterIP service `postgres-rw`
  - Provides a stable virtual IP/DNS endpoint for clients to connect to Postgres.
  - The app uses `DB_HOST=postgres-rw` from `ConfigMap`.

Both services route traffic using `selector: app: postgres`.

## 5) ConfigMap (non-secret configuration)

File: `db-configmap.yaml` (resource name: `contacts-db-config`)

`ConfigMap` stores plain-text configuration data consumed by Pods.

Values defined here include:

- `APP_DB_ENGINE`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_SCHEMA`
- `POSTGRES_USER`

The app and database manifests consume these values with `configMapKeyRef`.

## 6) Secret (sensitive configuration)

Resource: `contacts-db-secret` (consumed in `deployment.yaml` and `statefulset.yaml`)

`Secret` stores sensitive values, in this case `POSTGRES_PASSWORD`.

- It is injected into containers with `secretKeyRef`.
- This keeps credentials out of plain-text config maps and app manifests.
- A secret manifest file is not currently included in `k8s/`; the secret is expected to be created before applying workloads (for example by Terraform in `infra/terraform`).

## 7) Environment variable wiring

Mainly in: `deployment.yaml`

The app container combines values from config and secret into runtime env vars:

- Individual fields (`DB_HOST`, `DB_PORT`, etc.) come from `ConfigMap`.
- Password comes from `Secret`.
- `POSTGRES_DATABASE_URL` is assembled from these variables:

```text
postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?schema=$(DB_SCHEMA)
```

This pattern decouples app image from environment-specific database endpoints.

## 8) Persistent storage patterns in this repo

Files: `statefulset.yaml`, `pvc.yaml`

- Active DB persistence is implemented with `StatefulSet.volumeClaimTemplates`.
- There is also a standalone `PersistentVolumeClaim` in `pvc.yaml` (`sqlite-pvc`) that requests `64Mi`.
- Important: `pvc.yaml` exists but is not currently included in `kustomization.yaml`, so it is not applied by `kubectl apply -k .` unless applied separately.

## 9) Label selectors and workload-to-service routing

A consistent `app` label ties objects together:

- `Deployment` uses `app: contacts`
- `StatefulSet` and DB services use `app: postgres`
- Services select Pods by label, which is how Kubernetes routes traffic to the right workload.

## 10) Operational notes for this project

- Local default (`.env`) is SQLite (`APP_DB_ENGINE=sqlite`), while Kubernetes manifests are wired for Postgres (`APP_DB_ENGINE=postgres` in `ConfigMap`).
- To run in Kubernetes, ensure the app image in `deployment.yaml` is available to cluster nodes.
- Ensure `contacts-db-secret` exists in the target namespace before deploying app/database workloads.
- The app-to-db dependency is represented through service DNS (`postgres-rw:5432`) rather than hardcoded Pod IPs.
- The app now redacts DB credentials server-side before display/logging:
  - UI prints a masked DB URL (password replaced with `***`).
  - Startup logs also use the redacted URL.
  - This avoids leaking raw credentials to browser responses and routine logs.

## 11) Ingress and managed TLS

Files: `ingress.yaml`, `managed-certificate.yaml`

- `Ingress` (`contacts-ingress`) routes `contacts.eetr.app` to service `contacts` on port `80`.
- GCE annotations configure:
  - ingress class (`kubernetes.io/ingress.class: gce`)
  - global static IP (`kubernetes.io/ingress.global-static-ip-name: contacts-static-ip`)
  - managed certificate binding (`networking.gke.io/managed-certificates: contacts-cert`)
- `ManagedCertificate` (`contacts-cert`) requests TLS cert provisioning for `contacts.eetr.app`.

## 12) Quick verification commands

Use these to inspect what was applied and validate concept understanding:

```bash
# Apply all resources in kustomization.yaml
kubectl apply -k .

# List main resources
kubectl get deploy,statefulset,svc,configmap,secret,ingress,managedcertificate,pvc

# Inspect app deployment config and env wiring
kubectl describe deployment contacts

# Inspect postgres stateful workload and volume claims
kubectl describe statefulset postgres
kubectl get pvc

# Check generated Pod names and labels
kubectl get pods --show-labels

# Confirm secret expected by workloads exists
kubectl get secret contacts-db-secret

# Verify ingress and certificate status
kubectl get ingress contacts-ingress
kubectl get managedcertificate contacts-cert
```
