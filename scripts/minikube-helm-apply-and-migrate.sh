#!/usr/bin/env bash
# Deploy the contacts app to minikube using Helm and run the contacts-migration Job.
# Uses the same IMAGE_NAME/IMAGE_TAG convention as minikube-build-and-load.sh.
# Run from the repository root.

set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-contacts-db-sample}"
IMAGE_TAG="${IMAGE_TAG:-local}"

if ! command -v helm >/dev/null 2>&1; then
  echo "Error: helm is required but not found in PATH." >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl is required but not found in PATH." >&2
  exit 1
fi

if ! minikube status >/dev/null 2>&1; then
  echo "Error: minikube is not running. Start it with: minikube start" >&2
  exit 1
fi

echo "Removing existing migration job if present (avoids spec.template immutable error on upgrade)..."
kubectl delete job contacts-migration --ignore-not-found=true

echo "Installing/upgrading contacts release with Helm (values-minikube.yaml, image ${IMAGE_NAME}:${IMAGE_TAG})..."
helm upgrade --install contacts ./helm/contacts \
  -f ./helm/contacts/values-minikube.yaml \
  --set image.repository="${IMAGE_NAME}" \
  --set image.tag="${IMAGE_TAG}"

echo "Starting migration job and waiting for completion..."
kubectl patch job contacts-migration --type=merge -p '{"spec":{"suspend":false}}'
kubectl wait --for=condition=complete job/contacts-migration --timeout=300s

echo "Migration completed successfully."

cat <<EOF
Suggested next step:
  minikube service contacts --url
EOF
