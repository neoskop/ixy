# Delete Unusable Helm Versions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manually-triggered GitHub Actions workflow that finds every published ixy chart version that is unusable — missing backend image or bundling the deprecated `neoskop/ixy-ui` image — and deletes it (release, tag, index entry, global index).

**Architecture:** A standalone detection script (`scripts/find-unusable-versions.sh`) does the pure logic and is self-testable offline. A `workflow_dispatch` workflow (`.github/workflows/cleanup.yml`) checks out `gh-pages` + `main`, runs the script, and — only in `apply` mode — strips index entries, deletes GitHub Releases/tags, pushes `gh-pages`, and re-dispatches the aggregator. A local wrapper (`scripts/cleanup.sh`) triggers the workflow, mirroring `scripts/release.sh`.

**Tech Stack:** Bash, `yq` (mikefarah), `gh` CLI, `curl`, `tar`, GitHub Actions.

## Global Constraints

- Chart entries live under `.entries.ixy[]` in `gh-pages/index.yaml`; each has `version`, `appVersion`, `urls[0]`.
- Backend image reference is always `neoskop/ixy:<appVersion>` (released charts never override `image.repository`/`image.tag`).
- Deprecated UI image string to detect: `neoskop/ixy-ui`.
- GitHub Releases holding chart `.tgz` are tagged `ixy-<version>`.
- All `gh` / cross-repo / gh-pages-push operations use `secrets.RELEASE_PAT` (same token `release.yml` uses).
- Install `yq` exactly as `release.yml` does: `sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 && sudo chmod +x /usr/local/bin/yq`.
- Docker Hub tags API: `https://hub.docker.com/v2/repositories/neoskop/ixy/tags?page_size=100`, paginated via `.next`.
- Aggregator (`neoskop/helm-charts`) pull-rebuilds its global index on each `update-index` dispatch, so no version payload is needed for deletion.

---

### Task 1: Detection script `scripts/find-unusable-versions.sh`

**Files:**
- Create: `scripts/find-unusable-versions.sh`
- Test: embedded `--self-test` mode in the same file (offline, no framework)

**Interfaces:**
- Consumes: an `index.yaml` path (arg 1), or `--self-test`.
- Produces: prints unusable `version` strings to **stdout** (one per line, nothing else); per-version reasons to **stderr**. Later consumed by the workflow's delete loop.

- [ ] **Step 1: Create the script with self-test harness and a stubbed `find_unusable`**

```bash
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
    echo "$page" | yq -p json eval '.results[].name' -
    url="$(echo "$page" | yq -p json eval '.next // "null"' -)"
  done
}

# Does the chart tgz at $1 reference the deprecated UI image?
chart_uses_ui() {
  local url="$1"
  curl -sfL "$url" 2>/dev/null | tar xzO 2>/dev/null | grep -q "$UI_IMAGE"
}

# Print unusable versions given an index file and a newline-separated tag list.
find_unusable() {
  return 0  # stub — replaced in Step 3
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
EOF
  # Stub the network UI check so the self-test stays offline and exercises
  # only the tag-membership logic (criterion 1).
  chart_uses_ui() { return 1; }
  local tags=$'2.1.1\n2.0.0'
  local got expected
  got="$(find_unusable "$tmp" "$tags" 2>/dev/null | sort | tr '\n' ' ')"
  expected="1.0.0 2.1.0 "
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
```

- [ ] **Step 2: Run the self-test and verify it FAILS**

Run: `chmod +x scripts/find-unusable-versions.sh && scripts/find-unusable-versions.sh --self-test`
Expected: FAIL — `SELF-TEST FAILED: got [] expected [1.0.0 2.1.0 ]` and exit code 1 (stub prints nothing).

- [ ] **Step 3: Replace the `find_unusable` stub with the real implementation**

Replace the stubbed function body:

```bash
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
```

- [ ] **Step 4: Run the self-test and verify it PASSES**

Run: `scripts/find-unusable-versions.sh --self-test`
Expected: PASS — stderr `self-test passed`, exit code 0.

- [ ] **Step 5: Live smoke check against the real index**

Run:
```bash
curl -sf https://neoskop.github.io/ixy/index.yaml -o /tmp/ixy-index.yaml
scripts/find-unusable-versions.sh /tmp/ixy-index.yaml
```
Expected (stdout): includes `2.1.0` and every `0.5.0`–`1.0.x` version; excludes `2.0.0`, `2.1.1`. stderr shows a reason per version.

- [ ] **Step 6: Commit**

```bash
git add scripts/find-unusable-versions.sh
git commit -m "feat: detect unusable ixy chart versions"
```

---

### Task 2: Cleanup workflow `.github/workflows/cleanup.yml`

**Files:**
- Create: `.github/workflows/cleanup.yml`

**Interfaces:**
- Consumes: `scripts/find-unusable-versions.sh` (from `main`) and `gh-pages/index.yaml`.
- Produces: a `workflow_dispatch` action with input `mode: dry-run|apply`.

- [ ] **Step 1: Create the workflow file**

```yaml
name: Delete unusable versions

on:
  workflow_dispatch:
    inputs:
      mode:
        description: "dry-run lists unusable versions; apply deletes them"
        required: true
        type: choice
        default: dry-run
        options:
          - dry-run
          - apply

permissions:
  contents: write

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout gh-pages
        uses: actions/checkout@v6
        with:
          ref: gh-pages
          path: gh-pages
          token: ${{ secrets.RELEASE_PAT }}

      - name: Checkout main (for scripts)
        uses: actions/checkout@v6
        with:
          ref: main
          path: main

      - name: Install yq
        run: |
          sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
          sudo chmod +x /usr/local/bin/yq

      - name: Configure git
        working-directory: gh-pages
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Find unusable versions
        id: find
        run: |
          chmod +x main/scripts/find-unusable-versions.sh
          versions="$(main/scripts/find-unusable-versions.sh gh-pages/index.yaml)"
          echo "Unusable versions:"
          echo "${versions:-<none>}"
          {
            echo "versions<<EOF"
            echo "$versions"
            echo "EOF"
          } >> "$GITHUB_OUTPUT"

      - name: Dry-run summary
        if: github.event.inputs.mode == 'dry-run'
        run: echo "Dry-run mode: no changes made. Set mode=apply to delete the versions listed above."

      - name: Delete unusable versions and update indices
        if: github.event.inputs.mode == 'apply'
        env:
          GH_TOKEN: ${{ secrets.RELEASE_PAT }}
        run: |
          versions="${{ steps.find.outputs.versions }}"
          if [ -z "$versions" ]; then
            echo "Nothing to delete."
            exit 0
          fi
          cd gh-pages
          while IFS= read -r v; do
            [ -z "$v" ] && continue
            echo "Deleting chart version $v"
            yq eval "del(.entries.ixy[] | select(.version == \"$v\"))" -i index.yaml
            gh release delete "ixy-$v" --repo neoskop/ixy --yes --cleanup-tag
          done <<< "$versions"

          git add index.yaml
          if git diff --cached --quiet; then
            echo "index.yaml unchanged; skipping push."
          else
            git commit -m "chore: remove unusable chart versions"
            git push origin gh-pages
          fi

          echo "Triggering global index rebuild..."
          gh api repos/neoskop/helm-charts/dispatches -f event_type=update-index

  notify-failure:
    runs-on: ubuntu-latest
    needs: cleanup
    if: failure()
    steps:
      - uses: slackapi/slack-github-action@v3
        with:
          payload: '{"text": "*[ixy]:* Cleanup failed. Check: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

- [ ] **Step 2: Validate the workflow YAML parses**

Run: `yq eval '.' .github/workflows/cleanup.yml > /dev/null && echo OK`
Expected: `OK` (no parse error). If `actionlint` is installed, also run `actionlint .github/workflows/cleanup.yml` and expect no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/cleanup.yml
git commit -m "feat: add delete-unusable-versions workflow"
```

- [ ] **Step 4: Post-merge end-to-end verification (manual, after this is on `main`)**

Run: `gh workflow run cleanup.yml -f mode=dry-run` then watch the run.
Expected: the "Find unusable versions" step lists exactly `2.1.0` plus every `0.5.0`–`1.0.x` version, and no changes are made. Only after confirming the list, run `mode=apply`.

---

### Task 3: Local trigger wrapper `scripts/cleanup.sh`

**Files:**
- Create: `scripts/cleanup.sh`

**Interfaces:**
- Consumes: nothing (invokes `gh workflow run cleanup.yml`).
- Produces: CLI `scripts/cleanup.sh dry-run|apply`.

- [ ] **Step 1: Create the wrapper (mirror of `scripts/release.sh`)**

```bash
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
```

- [ ] **Step 2: Verify syntax and the usage guard**

Run:
```bash
chmod +x scripts/cleanup.sh
bash -n scripts/cleanup.sh && echo "syntax OK"
scripts/cleanup.sh; echo "exit=$?"
scripts/cleanup.sh bogus; echo "exit=$?"
```
Expected: `syntax OK`; both invocations print the `Usage:` line and report `exit=1`.

- [ ] **Step 3: Commit**

```bash
git add scripts/cleanup.sh
git commit -m "feat: add local trigger for cleanup workflow"
```

---

## Self-Review

**Spec coverage:**
- Detection of missing backend image → Task 1 `find_unusable` criterion 1. ✓
- Detection of deprecated `neoskop/ixy-ui` → Task 1 criterion 2 (`chart_uses_ui`). ✓
- Iterate all published chart versions → Task 1 loops `.entries.ixy[]`. ✓
- Delete release + tag → Task 2 `gh release delete --cleanup-tag`. ✓
- Remove index entry + push gh-pages → Task 2 `yq del` + commit/push. ✓
- Propagate to global index → Task 2 `update-index` dispatch. ✓
- Workflow placement + dry-run/apply gate → Task 2. ✓
- Local wrapper → Task 3. ✓
- Self-test for detection logic → Task 1 `--self-test`. ✓
- Scope boundaries (leave plain `V` tag, leave orphan images) → honored: only `ixy-V` tag removed via `--cleanup-tag`; no image deletion. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete.

**Type consistency:** `find_unusable(index, tags)`, `chart_uses_ui(url)`, `fetch_docker_tags(repo)` names and argument order match across Task 1 steps and the workflow's invocation (`find-unusable-versions.sh <index>`). Workflow input `mode` and output `versions` referenced consistently. ✓
