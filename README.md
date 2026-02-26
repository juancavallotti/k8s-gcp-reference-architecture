# Contacts DB Sample

Next.js 16 + Tailwind CSS contacts CRUD app using:

- server actions (no API routes)
- SQLite or Postgres with Prisma
- 3-layer architecture:
  - Presentation: `src/app`, `src/components`, `src/actions`
  - Application: `src/application`
  - Persistence: `src/persistence`

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
6. Wait for rollout success

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
kubectl get ingress contacts-ingress
kubectl get managedcertificate contacts-cert
terraform output ingress_static_ip_address
dig +short contacts.eetr.app
```

Expected checks:

- `kubectl get ingress contacts-ingress` shows the same external IP as `terraform output ingress_static_ip_address`.
- `dig +short contacts.eetr.app` resolves to that same IP (DNS propagation can take a few minutes).
- `kubectl get managedcertificate contacts-cert` eventually reports status `Active`.

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

- `db-secret.yaml` is not applied by kustomize anymore; the secret is managed by Terraform.
- Keep Terraform state in a protected backend (for example, private GCS bucket with restricted IAM), because sensitive values can be represented in state.

Contacts fields:

- `name`
- `phone`
- `email`

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

The container starts by running `prisma migrate deploy`, then starts Next.js.

Use Postgres in Docker/K8s by overriding env vars:

```bash
-e APP_DB_ENGINE=postgres \
-e POSTGRES_DATABASE_URL="postgresql://postgres:example@postgres-rw:5432/postgres?schema=public"
```

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
