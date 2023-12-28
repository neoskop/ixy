#!/bin/bash
set -e

# Setup kind cluster
if ! kind get clusters | grep -o ixy &>/dev/null; then
  reg_name='kind-registry-ixy'
  reg_port='5000'
  running="$(docker inspect -f '{{.State.Running}}' "${reg_name}" 2>/dev/null || true)"

  state=$(docker container ls -a -f name=$reg_name --format="{{.State}}")
  if [ -z "$state" ]; then
    docker run \
      -d --restart=always -p "127.0.0.1:${reg_port}:5000" --name "${reg_name}" \
      registry:2
  elif [ "$state" == "exited" ]; then
    docker start "${reg_name}"
  fi

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
  extraPortMappings:
  - containerPort: 30001
    hostPort: 8080
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

# Build and push image
docker build --target development -t localhost:5000/ixy:latest .
docker push localhost:5000/ixy:latest

# Install helm chart
if ! helm status ixy -n ixy &>/dev/null; then
  kubectl create ns ixy
  helm install ixy -n ixy -f quickstart-values.yaml ./helm
else
  helm upgrade ixy -n ixy -f quickstart-values.yaml ./helm
  sleep 3
  kubectl -n ixy rollout restart sts/ixy
fi

kubectl config set-context --current --namespace=ixy &>/dev/null
