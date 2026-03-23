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

count_fs_resize_events() {
  local pvc="$1"
  kubectl get events \
    --field-selector="involvedObject.kind=PersistentVolumeClaim,involvedObject.name=${pvc},reason=FileSystemResizeSuccessful" \
    -o jsonpath='{range .items[*]}{.metadata.uid}{"\n"}{end}' 2>/dev/null | sed '/^\s*$/d' | wc -l | awk '{print $1}'
}

get_pvc_capacity_size() {
  local pvc="$1"
  kubectl get pvc "$pvc" -o jsonpath='{.status.capacity.storage}' 2>/dev/null
}

wait_for_fs_resize_success() {
  local pvc="$1"
  local baseline="${2:-0}"
  local timeout="${3:-300}"
  local interval=3
  local waited=0

  echo "Waiting for FileSystemResizeSuccessful event on ${pvc}..."
  while true; do
    local current
    current=$(count_fs_resize_events "${pvc}")
    if [ "${current}" -gt "${baseline}" ]; then
      echo "Resize confirmed for ${pvc}"
      return 0
    fi
    if [ "${waited}" -ge "${timeout}" ]; then
      echo "Timed out waiting for FileSystemResizeSuccessful on ${pvc}" >&2
      exit 1
    fi
    sleep "${interval}"
    waited=$((waited + interval))
  done
}

declare -A PVC_EVENT_BASELINES
PVC_TO_WAIT=()

for i in 0 1 ; do
    pvc="cache-ixy-$i"
    current_size=$(get_pvc_capacity_size "$pvc")
    if [ "${current_size}" = "${NEW_SIZE}" ]; then
        echo "PVC ${pvc} already at ${NEW_SIZE}, skipping resize"
        continue
    fi
    PVC_EVENT_BASELINES["$pvc"]=$(count_fs_resize_events "$pvc")
    kubectl patch pvc "$pvc" -p "{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"${NEW_SIZE}\"}}}}" --type=merge
    PVC_TO_WAIT+=("$pvc")
done

if [ "${#PVC_TO_WAIT[@]}" -gt 0 ]; then
    for pvc in "${PVC_TO_WAIT[@]}"; do
        wait_for_fs_resize_success "$pvc" "${PVC_EVENT_BASELINES[$pvc]}"
    done
else
    echo "All PVCs already at desired size; nothing to wait for."
fi

kubectl scale sts/ixy --replicas=2
