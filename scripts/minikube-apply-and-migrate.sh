#!/usr/bin/env bash
# Apply the minikube kustomize overlay and run the contacts-migration Job.
# Uses the same IMAGE_NAME/IMAGE_TAG convention as minikube-build-and-load.sh.
# Run from the repository root. If k8s/base image changes, update BASE_IMAGE below.

set -euo pipefail

OVERLAY_PATH="${OVERLAY_PATH:-k8s/overlays/minikube}"
IMAGE_NAME="${IMAGE_NAME:-contacts-db-sample}"
IMAGE_TAG="${IMAGE_TAG:-local}"
IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"

# Must match the image in k8s/base/deployment.yaml and k8s/base/migration-job.yaml
BASE_IMAGE="us-west1-docker.pkg.dev/juancavallotti/eetr-artifacts/contacts-db-sample:latest"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl is required but not found in PATH." >&2
  exit 1
fi

if ! minikube status >/dev/null 2>&1; then
  echo "Error: minikube is not running. Start it with: minikube start" >&2
  exit 1
fi

echo "Removing existing migration job if present (avoids spec.template immutable error on apply)..."
kubectl delete job contacts-migration --ignore-not-found=true

echo "Applying overlay ${OVERLAY_PATH}..."
kubectl apply -k "${OVERLAY_PATH}"

echo "Recreating migration job with image ${IMAGE} (Job spec.template is immutable)..."
kubectl delete job contacts-migration --ignore-not-found=true
kubectl kustomize "${OVERLAY_PATH}" | sed "s|${BASE_IMAGE}|${IMAGE}|g" | kubectl apply -f -

echo "Starting migration job and waiting for completion..."
kubectl patch job contacts-migration --type=merge -p '{"spec":{"suspend":false}}'
kubectl wait --for=condition=complete job/contacts-migration --timeout=300s

echo "Migration completed successfully."
