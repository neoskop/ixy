#!/bin/bash
set -e
source .env

reg_name='kind-registry-ixy'
reg_port='5000'

setup_registry() {
  running="$(docker inspect -f '{{.State.Running}}' "${reg_name}" 2>/dev/null || true)"
  state=$(docker container ls -a -f name=$reg_name --format="{{.State}}")
  if [ -z "$state" ]; then
    docker run \
      -d --restart=always -p "127.0.0.1:${reg_port}:5000" --name "${reg_name}" \
      registry:2 &>/dev/null
  elif [ "$state" != "running" ]; then
    docker start "${reg_name}" &>/dev/null
  fi
}

setup_registry

# Setup kind cluster
if ! kind get clusters | grep -o ixy &>/dev/null; then
  local_dir=$(pwd)
  cat <<EOF | kind create cluster --name ixy --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
containerdConfigPatches:
- |-
  [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:${reg_port}"]
    endpoint = ["http://${reg_name}:${reg_port}"]
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 30080
    listenAddress: "127.0.0.1"
    protocol: TCP
  - containerPort: 443
    hostPort: 30443
    listenAddress: "127.0.0.1"
    protocol: TCP
  - containerPort: 30001
    hostPort: 8080
    listenAddress: "127.0.0.1"
  - containerPort: 30002
    hostPort: 5173
    listenAddress: "127.0.0.1"
  extraMounts:
  - hostPath: ${local_dir}
    containerPath: /ixy
EOF

  docker network connect "kind" "${reg_name}" || true

  cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:${reg_port}"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF
fi

kubectl config use-context kind-ixy &>/dev/null

# Setup NGINX ingress controller
if ! kubectl get ns ingress-nginx &>/dev/null; then
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
  sleep 3
  kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=90s
fi

# Build and push app image
cd backend
docker build --target $TARGET_STAGE -t localhost:5000/ixy:latest .
docker push localhost:5000/ixy:latest
cd - &>/dev/null

# Build and push ui image
cd frontend
docker build --target $TARGET_STAGE -t localhost:5000/ixy-ui:latest .
docker push localhost:5000/ixy-ui:latest
cd - &>/dev/null

# Install helm chart
if ! helm status ixy -n ixy &>/dev/null; then
  kubectl create ns ixy
  helm install ixy -n ixy -f quickstart-values.yaml ./helm
else
  helm upgrade ixy -n ixy -f quickstart-values.yaml ./helm
  sleep 3
  kubectl -n ixy rollout restart sts/ixy
  kubectl -n ixy rollout restart deploy/ixy-ui
fi

kubectl config set-context --current --namespace=ixy &>/dev/null
