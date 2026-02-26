# Kubernetes Concepts Used In This Repo

This project deploys a Next.js contacts app into Kubernetes. It supports **three environments** (minikube, dev, prod) and **two deployment paths**: **Kustomize** (base + overlays) and **Helm** (one chart with env-specific values). Minikube and dev use SQLite with a PVC; prod uses Postgres with a StatefulSet. The database password secret (`contacts-db-secret`) is not in the repo—it is provisioned by Terraform for prod and consumed by the app and Postgres Pods.

For deployment topology and CI/CD, see `DEPLOYMENT_ARCHITECTURE.md`. For step-by-step Minikube and GKE instructions, see `README.md`.

## 1) Kustomization (resource composition)

- **Base**: `k8s/base/kustomization.yaml` bundles the shared app resources: `contacts-service.yaml`, `deployment.yaml`, `migration-job.yaml`. No env-specific config here.
- **Overlays**: `k8s/overlays/{minikube,dev,prod}/` each reference the base and add patches or extra resources:
  - **minikube** and **dev**: Patch deployment (SQLite env + volume), service (NodePort or LoadBalancer), migration job; add `pvc.yaml` for SQLite. No Postgres, no Ingress.
  - **prod**: Patch deployment (replicas, Postgres env from ConfigMap/Secret), migration job; add `db-configmap.yaml`, `service.yaml` (headless postgres), `postgres-service.yaml` (postgres-rw), `statefulset.yaml`, `ingress.yaml`, `managed-certificate.yaml`.
- **Default apply target**: `k8s/kustomization.yaml` points to `overlays/prod`, so `kubectl apply -k k8s` deploys prod. To deploy a specific env, apply that overlay:

```bash
kubectl apply -k k8s/overlays/minikube
kubectl apply -k k8s/overlays/dev
kubectl apply -k k8s/overlays/prod
```

For minikube, use the helper scripts after building and loading the image: `./scripts/minikube-build-and-load.sh` then `./scripts/minikube-apply-and-migrate.sh` (Kustomize) or `./scripts/minikube-helm-apply-and-migrate.sh` (Helm).

## 2) Deployment (stateless app replicas)

**Files**: `k8s/base/deployment.yaml`; overlays use `deployment-patch.yaml` to add env vars, volumes, or replica counts.

`Deployment` manages the stateless Next.js app Pods.

- **Base** defines: container port `3000` (named `http`), `startupProbe`, `readinessProbe`, and `livenessProbe` using `GET /api/healthcheck`, and the default image (Artifact Registry). Replicas default to `1`.
- **Overlay patches**:
  - minikube/dev: Add `APP_DB_ENGINE=sqlite`, `SQLITE_DATABASE_URL=file:../data/contacts.db`, volume mount for `sqlite-pvc` at `/app/prisma/data`.
  - prod: Set `replicas: 3` and wire env from ConfigMap `contacts-db-config` and Secret `contacts-db-secret` to build `POSTGRES_DATABASE_URL`.
- The image in the base is overridden at deploy time (e.g. by Cloud Build or the minikube scripts). No `nodeSelector` or custom `imagePullPolicy` in this repo.

## 2.1) Application health endpoint

**File**: `src/app/api/healthcheck/route.ts`

`GET /api/healthcheck` is used by Kubernetes probes and performs a real DB read:

- Equivalent to `SELECT * FROM contacts ORDER BY createdAt DESC LIMIT 1`.
- Returns `contacts` as a list (`[]` when empty, `[latestContact]` when rows exist). HTTP `200` on success, HTTP `500` on DB failure.

## 3) StatefulSet (stateful database workload)

**File**: `k8s/overlays/prod/statefulset.yaml` (resource name: `postgres`). Only used in the prod overlay.

`StatefulSet` runs a single Postgres instance with stable identity and persistent storage.

- `serviceName: postgres` ties it to the headless Service.
- `replicas: 1`. Pod gets `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` from ConfigMap/Secret. `volumeClaimTemplates` creates a PVC named `data` mounted at `/var/lib/postgresql/data`.

## 4) Services (internal networking and discovery)

**Files**: `k8s/base/contacts-service.yaml`; `k8s/overlays/dev/service-patch.yaml` and `k8s/overlays/minikube/service-patch.yaml` (change type); `k8s/overlays/prod/service.yaml` (headless postgres) and `k8s/overlays/prod/postgres-service.yaml` (postgres-rw).

- **App service `contacts`** (from base, patched in dev/minikube): selector `app: contacts`, port `80` → targetPort `3000`. In base it is ClusterIP; dev patches to LoadBalancer; minikube patches to NodePort. In prod it stays ClusterIP and is the backend for Ingress.
- **Headless service `postgres`** (prod only): `clusterIP: None`, selector `app: postgres`, port `5432`. Gives stable DNS for StatefulSet Pods.
- **Service `postgres-rw`** (prod only): ClusterIP, selector `app: postgres`, port `5432`. The app connects to Postgres via `DB_HOST=postgres-rw` from the ConfigMap.

Traffic to the app uses `app: contacts`; traffic to Postgres uses `app: postgres`.

## 5) ConfigMap (non-secret configuration)

**File**: `k8s/overlays/prod/db-configmap.yaml` (resource name: `contacts-db-config`). Only in prod overlay.

Stores plain-text DB configuration: `APP_DB_ENGINE`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `POSTGRES_USER`. Consumed by the app Deployment and the migration Job (and by the Postgres StatefulSet for non-secret fields). The app builds `POSTGRES_DATABASE_URL` from these plus the password from the Secret.

## 6) Secret (sensitive configuration)

**Resource**: `contacts-db-secret` (consumed in prod deployment and migration job patches and in the Postgres StatefulSet). Not stored in `k8s/`—created by Terraform (`infra/terraform/kubernetes-secret.tf`) so credentials stay out of the repo.

Contains `POSTGRES_PASSWORD`. Injected via `secretKeyRef`. For prod, ensure Terraform has been applied so the secret exists before applying the prod overlay.

## 7) Environment variable wiring

**Base**: `k8s/base/deployment.yaml` (no DB env in base). **Overlays**: `k8s/overlays/dev/deployment-patch.yaml`, `k8s/overlays/minikube/deployment-patch.yaml`, `k8s/overlays/prod/deployment-patch.yaml`.

- **minikube/dev**: Env set directly in the patch: `APP_DB_ENGINE=sqlite`, `SQLITE_DATABASE_URL=file:../data/contacts.db`.
- **prod**: Env from ConfigMap and Secret; `POSTGRES_DATABASE_URL` is built from `postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?schema=$(DB_SCHEMA)`.

## 8) Persistent storage

**Files**: `k8s/overlays/prod/statefulset.yaml` (volumeClaimTemplates); `k8s/overlays/dev/pvc.yaml` and `k8s/overlays/minikube/pvc.yaml` (sqlite-pvc).

- **Prod**: Postgres data via StatefulSet `volumeClaimTemplates` (PVC `data`).
- **Dev/minikube**: SQLite file in `sqlite-pvc` (e.g. 64Mi), mounted at `/app/prisma/data` in the app and migration Job.

## 9) Label selectors and routing

- **App**: `app: contacts` on Deployment and Pods; Service `contacts` selects by this label.
- **Postgres** (prod): `app: postgres` on StatefulSet and Pods; Services `postgres` and `postgres-rw` select by this label.

## 10) Helm chart (alternative to Kustomize)

A Helm chart at `helm/contacts/` produces equivalent manifests for minikube, dev, and prod.

- **Templates** in `helm/contacts/templates/` branch on `database.engine` (sqlite vs postgres) and `ingress.enabled`, mirroring overlay behavior.
- **Values**: `values.yaml` (defaults), `values-minikube.yaml`, `values-dev.sample.yaml`, `values-prod.sample.yaml`. Gitignored `values-dev.yaml` and `values-prod.yaml` are for local/CI overrides.
- **Usage**: e.g. `helm template contacts ./helm/contacts -f ./helm/contacts/values-minikube.yaml` to render; for minikube deploy, use `./scripts/minikube-helm-apply-and-migrate.sh` after `./scripts/minikube-build-and-load.sh`.

CI currently uses the Kustomize path; the Helm path is optional (see `cloudbuild.yaml`). Both paths should be kept in sync when changing manifests (see `.cursor/skills/kubernetes/SKILL.md`).

## 11) Ingress and managed TLS (prod only)

**Files**: `k8s/overlays/prod/ingress.yaml`, `k8s/overlays/prod/managed-certificate.yaml`

- **Ingress** `contacts-ingress`: routes `contacts.eetr.app` to Service `contacts` on port `80`. GCE annotations set ingress class, global static IP (`contacts-static-ip`), and managed certificate (`contacts-cert`).
- **ManagedCertificate** `contacts-cert`: requests TLS for `contacts.eetr.app`. Provisioned by GKE.

## 12) Operational notes

- **Environments**: minikube (SQLite, NodePort); dev (SQLite, LoadBalancer, no Ingress); prod (Postgres, ClusterIP, Ingress + cert). Terraform variable `deploy_environment` selects which overlay Cloud Build applies.
- **Image**: Must be available to the cluster (e.g. loaded into minikube or in Artifact Registry). Minikube scripts use `IMAGE_NAME`/`IMAGE_TAG` (default `contacts-db-sample:local`).
- **Migration Job**: Base defines `contacts-migration` (suspended by default). Overlays patch env/volumes. Job `spec.template` is immutable, so pipelines and scripts delete and re-apply the job with the desired image instead of `kubectl set image`. See `scripts/minikube-apply-and-migrate.sh` and `cloudbuild.yaml`.
- **Secrets**: For prod, apply Terraform so `contacts-db-secret` exists before applying the prod overlay. The app redacts DB credentials in UI and logs (masked URL).

## 13) Quick verification commands

```bash
# Render overlays (no apply)
kubectl kustomize k8s/overlays/minikube
kubectl kustomize k8s/overlays/dev
kubectl kustomize k8s/overlays/prod

# Or render Helm for an env
helm template contacts ./helm/contacts -f ./helm/contacts/values-minikube.yaml

# Apply an overlay (after image is available)
kubectl apply -k k8s/overlays/dev
kubectl apply -k k8s/overlays/prod

# List main resources
kubectl get deploy,statefulset,svc,job,configmap,ingress,managedcertificate,pvc

# Inspect app deployment and env
kubectl describe deployment contacts

# Prod: Postgres and secret
kubectl describe statefulset postgres
kubectl get pvc
kubectl get secret contacts-db-secret

# Ingress and certificate (prod)
kubectl get ingress contacts-ingress
kubectl get managedcertificate contacts-cert
```
