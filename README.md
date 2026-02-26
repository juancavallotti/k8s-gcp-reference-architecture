# GCP + K8s Reference Architecture

## Sample App: Contacts Database

A simple contacts app to create, read, update, and delete contact entries. Each contact has **name**, **phone**, and **email**. The app demonstrates a production-ready stack and deployment patterns.

**Tech and architecture:**

- Next.js 16 + Tailwind CSS
- server actions for CRUD flows
- one API route for infrastructure health checks: `GET /api/healthcheck`
- SQLite or Postgres with Prisma
- 3-layer architecture:
  - Presentation: `src/app`, `src/components`, `src/actions`
  - Application: `src/application`
  - Persistence: `src/persistence`


## Prerequisites

Install the following depending on what you want to run:

| What you want to do | Software needed |
|---------------------|-----------------|
| **Local development** (run the app with `npm run dev`) | [Node.js](https://nodejs.org/) (v18+; includes npm) |
| **Docker** (build/run the image locally) | [Docker](https://docs.docker.com/get-docker/) |
| **Minikube with Kustomize** | [minikube](https://minikube.sigs.k8s.io/docs/start/), [kubectl](https://kubernetes.io/docs/tasks/tools/), Docker (for building and loading the image) |
| **Minikube with Helm** | Same as above, plus [Helm](https://helm.sh/docs/intro/install/) (v3) |
| **GKE + Cloud Build** (deploy to dev/prod via Terraform) | [Terraform](https://developer.hashicorp.com/terraform/install), [gcloud CLI](https://cloud.google.com/sdk/docs/install) (for local verification); Cloud Build runs in GCP |

All terminal commands in this README assume you are in the repository root unless noted.

## Kubernetes

For a repo-specific explanation of the Kubernetes setup and concepts used here, see:

- `KUBERNETES_CONCEPTS.md`
- `DEPLOYMENT_ARCHITECTURE.md` (dev/prod deployment topology + Mermaid diagrams)

### GKE + Cloud Build CI/CD (Terraform)

This repo includes Terraform to provision:

- GKE Autopilot cluster
- Dedicated Cloud Build runner service account and custom IAM role
- Cloud Build trigger (env-specific name) that builds, pushes, and deploys:
  - `dev`: branch push trigger (default `^main$`)
  - `prod`: tag push trigger (default `^v.*$`)

Path:

```bash
infra/terraform
```

#### 1) Configure Terraform variables

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Set at minimum:

- `project_id` (your GCP project)
- `artifact_repo_path` (defaults to `us-west1-docker.pkg.dev/juancavallotti/eetr-artifacts`)
- `cloud_build_runner_account_id` (service account id used by the trigger)
- `deploy_environment` (`dev` or `prod`, selects `k8s/overlays/<environment>`)
- `trigger_tag_regex` (tag regex used when `deploy_environment=prod`)
- `db_password` (used by Terraform to create `contacts-db-secret` in the cluster)

#### 2) Create infra

```bash
terraform init
terraform validate
terraform plan
terraform apply
```

Terraform creates:

- `google_container_cluster` (Autopilot)
- `google_cloudbuild_trigger` for `main` pushes
- Dedicated service account + custom IAM role required by Cloud Build
- `kubernetes_secret_v1.contacts_db_secret` (`contacts-db-secret`)
- `google_compute_global_address.contacts_ingress` (reserved global static IP for ingress)
- `google_dns_record_set.contacts_a_record` (`contacts.eetr.app` A record)

#### 3) CI/CD flow

On matching GitHub push events, Cloud Build (`cloudbuild.yaml`) will:

1. Build image: `${_ARTIFACT_REPO_PATH}/${_IMAGE_NAME}:${SHORT_SHA}`
2. Push image to Artifact Registry
3. Get GKE credentials
4. `kubectl apply -k ${_K8S_OVERLAY_PATH}` (set by Terraform from `deploy_environment`)
5. `kubectl set image deployment/contacts ...:${SHORT_SHA}`
6. Run Prisma migrations as a Kubernetes Job (`contacts-migration`) and wait for completion
7. Wait for rollout success

Trigger behavior by environment:

- `deploy_environment=dev`:
  - trigger name: `contacts-dev-deploy`
  - source filter: `trigger_branch_regex`
- `deploy_environment=prod`:
  - trigger name: `contacts-prod-deploy`
  - source filter: `trigger_tag_regex`

#### 4) Verify deployment

```bash
gcloud container clusters get-credentials contacts-autopilot --region us-west1 --project <project_id>
kubectl get pods,svc
kubectl rollout status deployment/contacts
```

Additional checks for `prod`:

```bash
kubectl get ingress contacts-ingress
kubectl get managedcertificate contacts-cert
terraform output ingress_static_ip_address
dig +short contacts.eetr.app
```

Expected checks for `prod`:

- `kubectl get ingress contacts-ingress` shows the same external IP as `terraform output ingress_static_ip_address`.
- `dig +short contacts.eetr.app` resolves to that same IP (DNS propagation can take a few minutes).
- `kubectl get managedcertificate contacts-cert` eventually reports status `Active`.

Expected checks for `dev`:

- `kubectl get svc contacts` shows `TYPE=LoadBalancer`.
- `EXTERNAL-IP` is assigned and can be used for direct external access.

#### 5) Teardown

To remove the resources this Terraform stack created (including the GKE cluster and Cloud Build trigger):

```bash
cd infra/terraform
terraform destroy
```

Not deleted by this stack:

- Existing Artifact Registry repository (`eetr-artifacts`)
- External source control integrations/connections created outside this Terraform stack

Security note:

- Keep Terraform state in a protected backend (for example, private GCS bucket with restricted IAM), because sensitive values can be represented in state.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Key env vars:

- `APP_DB_ENGINE=sqlite|postgres`
- `SQLITE_DATABASE_URL` for local SQLite
- `POSTGRES_DATABASE_URL` for PostgreSQL deployments

3. Create/update SQLite database and Prisma clients:

```bash
npm run db:migrate -- --name init
npm run db:generate
```

4. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

Healthcheck endpoint (end-to-end app + DB check):

```bash
curl -s http://localhost:3000/api/healthcheck
```

Expected behavior:

- HTTP `200` when DB query succeeds, including empty table.
- Response payload includes `contacts` as a list with up to one row (latest contact).
- HTTP `500` when DB connectivity/query fails.

## Validation

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

## Docker

Build image:

```bash
docker build -t contacts-db-sample .
```

Run container:

```bash
docker run --rm -p 3000:3000 -v "$(pwd)/prisma/data:/app/prisma/data" contacts-db-sample
```

The container starts Next.js directly (`node server.js`).

In Kubernetes, Prisma migrations are run by the `contacts-migration` Job during Cloud Build deploys.
Use Postgres in Docker/K8s by overriding env vars:

```bash
-e APP_DB_ENGINE=postgres \
-e POSTGRES_DATABASE_URL="postgresql://postgres:example@postgres-rw:5432/postgres?schema=public"
```

## Minikube

You can run the app on local Kubernetes (minikube) in two ways: **Kustomize** (overlay-based) or **Helm** (chart-based). Both use the same image build step; only the deploy and migration steps differ.

Run all commands from the repository root.

---

### Run on Minikube with Kustomize

1. **Start minikube**
   ```bash
   minikube start
   ```

2. **Build the image and load it into minikube**
   ```bash
   ./scripts/minikube-build-and-load.sh
   ```
   Optional overrides: `IMAGE_NAME=contacts-db-sample IMAGE_TAG=local ./scripts/minikube-build-and-load.sh`

3. **Apply the minikube overlay**
   ```bash
   kubectl apply -k k8s/overlays/minikube
   ```

4. **Use the local image tag for the app and migration job**
   ```bash
   kubectl set image deployment/contacts contacts=contacts-db-sample:local
   kubectl set image job/contacts-migration migration=contacts-db-sample:local
   ```

5. **Run the migration job and wait for it to finish**
   ```bash
   kubectl patch job contacts-migration --type=merge -p '{"spec":{"suspend":false}}'
   kubectl wait --for=condition=complete job/contacts-migration --timeout=300s
   kubectl rollout status deployment/contacts --timeout=300s
   ```

6. **Get the app URL**
   ```bash
   minikube service contacts --url
   ```
   Open the URL in a browser or call `curl $(minikube service contacts --url)/api/healthcheck`.

---

### Run on Minikube with Helm

1. **Start minikube**
   ```bash
   minikube start
   ```

2. **Build the image and load it into minikube**
   ```bash
   ./scripts/minikube-build-and-load.sh
   ```
   Optional overrides: `IMAGE_NAME=contacts-db-sample IMAGE_TAG=local ./scripts/minikube-build-and-load.sh`

3. **Deploy with Helm and run migrations**
   ```bash
   ./scripts/minikube-helm-apply-and-migrate.sh
   ```
   This runs `helm upgrade --install` with `helm/contacts/values-minikube.yaml` and the same image tag as step 2, then unsuspends the migration job and waits for completion. Optional overrides: `IMAGE_NAME=contacts-db-sample IMAGE_TAG=local ./scripts/minikube-helm-apply-and-migrate.sh`

4. **Get the app URL**
   ```bash
   minikube service contacts --url
   ```

---

### Helm chart and dev/prod values

The repo includes a Helm chart at `helm/contacts/`:

- **Committed:** `values.yaml` (defaults), `values-minikube.yaml` (minikube), and samples `values-dev.sample.yaml`, `values-prod.sample.yaml`.
- **Gitignored:** `values-dev.yaml`, `values-prod.yaml` (for env-specific or sensitive overrides).

To use Helm for dev or prod locally or in CI, copy the sample and edit:

```bash
cp helm/contacts/values-dev.sample.yaml helm/contacts/values-dev.yaml
# edit helm/contacts/values-dev.yaml as needed
helm upgrade --install contacts ./helm/contacts -f ./helm/contacts/values-dev.yaml --set image.tag=YOUR_TAG
```

For **Cloud Build** with the commented Helm deploy: CI must supply `values-dev.yaml` or `values-prod.yaml` (e.g. from Secret Manager or a step that writes the file).

## GitHub repository

Target remote:

```bash
git@github.com:juancavallotti/contacts-db-sample.git
```

Suggested push flow:

```bash
git init
git remote add origin git@github.com:juancavallotti/contacts-db-sample.git
git add .
git commit -m "feat: create contacts CRUD app with Next.js, server actions and SQLite"
git branch -M main
git push -u origin main
```

## License

MIT License. See [LICENSE](LICENSE) for details.

### Contact

Want to work with me? [Call my agent](https://juancavallotti.com/ai-assistant).
