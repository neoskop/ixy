#!/usr/bin/env bash
# Find published ixy chart versions that are unusable:
#   1. backend image neoskop/ixy:<appVersion> missing on Docker Hub, or
#   2. packaged chart still references the deprecated neoskop/ixy-ui image.
# Usage: find-unusable-versions.sh <index.yaml>
#        find-unusable-versions.sh --self-test
# stdout: unusable versions (one per line). stderr: per-version reasons.

set -euo pipefail

IMAGE_REPO="neoskop/ixy"
UI_IMAGE="neoskop/ixy-ui"

# Print all Docker Hub tag names for a repo, one per line.
fetch_docker_tags() {
  local repo="$1"
  local url="https://hub.docker.com/v2/repositories/${repo}/tags?page_size=100"
  local page
  while [ -n "$url" ] && [ "$url" != "null" ]; do
    page="$(curl -sf "$url")" || { echo "error: failed to fetch $url" >&2; return 1; }
    echo "$page" | yq -p json eval '.results[].name' - || { echo "error: failed to parse tags page from $url" >&2; return 1; }
    url="$(echo "$page" | yq -p json eval '.next // "null"' -)" || { echo "error: failed to parse next-page URL" >&2; return 1; }
  done
}

# Does the chart tgz at $1 reference the deprecated UI image?
chart_uses_ui() {
  local url="$1"
  curl -sfL "$url" 2>/dev/null | tar xzO 2>/dev/null | grep -q "$UI_IMAGE"
}

# Print unusable versions given an index file and a newline-separated tag list.
find_unusable() {
  local index="$1" tags="$2"
  local n i version appversion url
  n="$(yq eval '.entries.ixy | length' "$index")"
  for ((i=0; i<n; i++)); do
    version="$(yq eval ".entries.ixy[$i].version" "$index")"
    appversion="$(yq eval ".entries.ixy[$i].appVersion" "$index")"
    url="$(yq eval ".entries.ixy[$i].urls[0]" "$index")"

    if ! grep -qxF "$appversion" <<<"$tags"; then
      echo "$version: image ${IMAGE_REPO}:${appversion} missing" >&2
      echo "$version"
      continue
    fi
    if chart_uses_ui "$url"; then
      echo "$version: references deprecated ${UI_IMAGE}" >&2
      echo "$version"
    fi
  done
}

self_test() {
  local tmp
  tmp="$(mktemp)"
  cat >"$tmp" <<'EOF'
entries:
  ixy:
    - version: "2.1.1"
      appVersion: "2.1.1"
      urls: ["http://example/2.1.1.tgz"]
    - version: "2.1.0"
      appVersion: "2.1.0"
      urls: ["http://example/2.1.0.tgz"]
    - version: "2.0.0"
      appVersion: "2.0.0"
      urls: ["http://example/2.0.0.tgz"]
    - version: "1.0.0"
      appVersion: "1.0.0"
      urls: ["http://example/1.0.0.tgz"]
    - version: "0.7.0"
      appVersion: "0.7.0"
      urls: ["http://example/uses-ui.tgz"]
EOF
  # Stub the network UI check: pretend only the 0.7.0 chart references the UI
  # image, so the self-test exercises BOTH criteria offline — tag-membership
  # (criterion 1) and the deprecated-UI branch (criterion 2).
  chart_uses_ui() { [ "$1" = "http://example/uses-ui.tgz" ]; }
  local tags=$'2.1.1\n2.0.0\n0.7.0'
  local got expected
  got="$(find_unusable "$tmp" "$tags" 2>/dev/null | sort | tr '\n' ' ')"
  expected="0.7.0 1.0.0 2.1.0 "
  rm -f "$tmp"
  if [ "$got" != "$expected" ]; then
    echo "SELF-TEST FAILED: got [$got] expected [$expected]" >&2
    exit 1
  fi
  echo "self-test passed" >&2
}

main() {
  if [ "${1:-}" = "--self-test" ]; then
    self_test
    exit 0
  fi
  if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <index.yaml> | --self-test" >&2
    exit 1
  fi
  local index="$1" tags
  tags="$(fetch_docker_tags "$IMAGE_REPO")"
  find_unusable "$index" "$tags"
}

main "$@"
