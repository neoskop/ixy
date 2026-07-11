#!/usr/bin/env bash

set -e

if [[ "$#" != "1" ]] || [[ ! "$1" =~ ^(dry-run|apply)$ ]]; then
  echo -e "Usage: $0 \033[1mdry-run|apply\033[0m"
  exit 1
fi

if ! command -v gh >/dev/null; then
  echo -e "Install \033[1mgh\033[0m (GitHub CLI)"
  exit 1
fi

echo "Triggering cleanup workflow in mode: $1"
gh workflow run cleanup.yml -f mode="$1"

echo ""
echo "Cleanup workflow triggered. Monitor at:"
echo "  https://github.com/neoskop/ixy/actions/workflows/cleanup.yml"
