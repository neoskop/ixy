#!/bin/bash

# Grows the ixy cache volumes. The cloud (Cinder) refuses to extend attached
# volumes, so ixy has to be scaled to 0 until the backend resize is done.
# ArgoCD would scale it straight back up, so its reconciliation is paused for
# the ixy app while this runs.

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <new-size-in-Gi>"
    exit 1
fi

NEW_SIZE="${1}Gi"
NS=ixy
SKIP_RECONCILE=argocd.argoproj.io/skip-reconcile

echo "Resizing ixy volumes in context $(kubectl config current-context) to ${NEW_SIZE}"

REPLICAS=$(kubectl -n "$NS" get sts ixy -o jsonpath='{.spec.replicas}')
HAS_APP=$(kubectl -n argocd get application ixy -o name 2>/dev/null || true)
HAS_APPSET=$(kubectl -n argocd get applicationset ixy -o name 2>/dev/null || true)
PRESERVED_FIELDS=""

restore() {
    echo "Scaling ixy back to ${REPLICAS} replicas"
    kubectl -n "$NS" scale sts/ixy --replicas="$REPLICAS"

    if [ -n "$HAS_APP" ]; then
        echo "Resuming ArgoCD reconciliation"
        kubectl -n argocd annotate application ixy "${SKIP_RECONCILE}-" || true
    fi
    if [ -n "$HAS_APPSET" ]; then
        if [ -n "$PRESERVED_FIELDS" ]; then
            kubectl -n argocd patch applicationset ixy --type=merge \
                -p "{\"spec\":{\"preservedFields\":${PRESERVED_FIELDS}}}" || true
        else
            kubectl -n argocd patch applicationset ixy --type=json \
                -p '[{"op":"remove","path":"/spec/preservedFields"}]' || true
        fi
    fi
}

# Wait until "$@" prints $expected, or fail after $timeout seconds.
wait_for() {
    local description="$1" expected="$2" timeout="$3"
    shift 3
    local waited=0
    echo "Waiting for ${description}..."
    until [ "$("$@")" = "$expected" ]; do
        if [ "$waited" -ge "$timeout" ]; then
            echo "Timed out waiting for ${description}" >&2
            return 1
        fi
        sleep 5
        waited=$((waited + 5))
    done
}

attachments_of() {
    kubectl get volumeattachment \
        -o jsonpath="{range .items[?(@.spec.source.persistentVolumeName=='$1')]}{.metadata.name}{end}"
}

pv_capacity() {
    kubectl get pv "$1" -o jsonpath='{.spec.capacity.storage}'
}

pvc_capacity() {
    kubectl -n "$NS" get pvc "$1" -o jsonpath='{.status.capacity.storage}'
}

trap restore EXIT

if [ -n "$HAS_APP" ]; then
    echo "Pausing ArgoCD reconciliation of the ixy app"
    if [ -n "$HAS_APPSET" ]; then
        # Without this the ApplicationSet removes the annotation right away.
        appset=$(kubectl -n argocd get applicationset ixy -o json)
        PRESERVED_FIELDS=$(jq -c '.spec.preservedFields // empty' <<<"$appset")
        patched=$(jq -c --arg a "$SKIP_RECONCILE" \
            '.spec.preservedFields // {} | .annotations = ((.annotations // []) + [$a] | unique)' <<<"$appset")
        kubectl -n argocd patch applicationset ixy --type=merge \
            -p "{\"spec\":{\"preservedFields\":${patched}}}"
    fi
    kubectl -n argocd annotate application ixy "${SKIP_RECONCILE}=true" --overwrite
fi

kubectl -n "$NS" scale sts/ixy --replicas=0
kubectl -n "$NS" wait --for=delete pod -l app.kubernetes.io/name=ixy --timeout=300s

PVS=()
for ((i = 0; i < REPLICAS; i++)); do
    pvc="cache-ixy-$i"
    if [ "$(pvc_capacity "$pvc")" = "$NEW_SIZE" ]; then
        echo "PVC ${pvc} already at ${NEW_SIZE}, skipping resize"
        continue
    fi
    pv=$(kubectl -n "$NS" get pvc "$pvc" -o jsonpath='{.spec.volumeName}')
    wait_for "${pv} to detach" "" 300 attachments_of "$pv"
    kubectl -n "$NS" patch pvc "$pvc" --type=merge \
        -p "{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"${NEW_SIZE}\"}}}}"
    PVS+=("$pvc:$pv")
done

for entry in "${PVS[@]}"; do
    wait_for "volume ${entry#*:} to be resized" "$NEW_SIZE" 600 pv_capacity "${entry#*:}"
done

# The filesystem grows when the pods mount the volumes again.
trap - EXIT
restore
kubectl -n "$NS" rollout status sts/ixy --timeout=600s
for entry in "${PVS[@]}"; do
    wait_for "filesystem of ${entry%%:*} to be resized" "$NEW_SIZE" 300 pvc_capacity "${entry%%:*}"
done

echo "Done"
