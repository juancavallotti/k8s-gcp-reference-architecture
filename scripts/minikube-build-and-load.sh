#!/usr/bin/env bash

set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-contacts-db-sample}"
IMAGE_TAG="${IMAGE_TAG:-local}"
IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is required but not found in PATH." >&2
  exit 1
fi

if ! command -v minikube >/dev/null 2>&1; then
  echo "Error: minikube is required but not found in PATH." >&2
  exit 1
fi

if ! minikube status >/dev/null 2>&1; then
  echo "Error: minikube is not running. Start it with: minikube start" >&2
  exit 1
fi

echo "Building image ${IMAGE}..."
docker build -t "${IMAGE}" .

echo "Loading image ${IMAGE} into minikube..."
minikube image load "${IMAGE}"

cat <<EOF
Image is ready in minikube: ${IMAGE}

Suggested next steps:
  kubectl apply -k k8s/overlays/minikube
  kubectl set image deployment/contacts contacts=${IMAGE}
  kubectl set image job/contacts-migration migration=${IMAGE}
  kubectl patch job contacts-migration --type=merge -p '{"spec":{"suspend":false}}'
  kubectl wait --for=condition=complete job/contacts-migration --timeout=300s
  kubectl rollout status deployment/contacts --timeout=300s
  minikube service contacts --url
EOF
