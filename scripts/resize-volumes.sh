#!/bin/bash

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <new-size-in-Gi>"
    exit 1
fi

NEW_SIZE="${1}Gi"

kubectl ns ixy

kubectl scale sts/ixy --replicas=0

while kubectl get po 2>/dev/null | grep -v "ixy-ui" | grep -q "Running"; do
  echo "Waiting for pods to terminate..."
  sleep 3
done

for i in 0 1 ; do
    kubectl patch pvc cache-ixy-$i -p "{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"${NEW_SIZE}\"}}}}" --type=merge
done

sleep 10
kubectl scale sts/ixy --replicas=2