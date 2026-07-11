# Delete unusable Helm versions

## Problem

Ixy publishes a Docker image (`neoskop/ixy:<version>`) and a Helm chart
(`ixy-<version>`) from separate CI jobs. The chart release
(`.github/workflows/release.yml`) and the image build
(`.github/workflows/docker-build.yml`) are triggered independently by the same
git tag. When the image build fails but the chart release succeeds, a chart
version is published that references a Docker image tag that never got built —
an **unusable version**. Installing such a chart yields `ImagePullBackOff`.

Confirmed live examples at time of writing: chart versions **2.1.0** and
**1.0.0** exist in the index but have no matching `neoskop/ixy` image tag on
Docker Hub.

We want a "Delete unusable versions" action that finds every published chart
version whose referenced image is missing and removes it.

## Definitions

- **Chart version**: an entry in `.entries.ixy[]` of ixy's `gh-pages/index.yaml`.
  Each carries `version` and `appVersion`.
- **Referenced image**: released ixy charts deploy
  `{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}`.
  Released charts never override `image.tag` or `image.repository`, so the image
  is always `neoskop/ixy:<appVersion>`.
- **Unusable version**: a chart version whose `appVersion` is not present in the
  Docker Hub tag list for `neoskop/ixy`.

## How publishing works today (reverse of what we must undo)

`release.yml` for a new version V:
1. Bumps `helm/Chart.yaml` `version`/`appVersion`, commits to `main`.
2. Creates git tag `V` (triggers `docker-build.yml` → pushes `neoskop/ixy:V`).
3. `cr upload` → GitHub Release `ixy-V` holding the packaged `.tgz`.
4. On `gh-pages`: `cr index` adds the `ixy-V` entry to `index.yaml`, commits, pushes.
5. Dispatches `update-index` to `neoskop/helm-charts`.

The aggregator (`neoskop/helm-charts`, `update-index.yml`) **pull-rebuilds** the
global index: on each dispatch it downloads every source repo's live
`gh-pages/index.yaml` fresh and deep-merges them. It does not accumulate. So
removing a version from ixy's own `index.yaml` and re-dispatching `update-index`
is sufficient to drop it from the global index too.

## Design

Three files, mirroring the existing `release.yml` + `scripts/release.sh` convention.

### 1. `scripts/find-unusable-versions.sh` (pure detection)

- Usage: `find-unusable-versions.sh <path-to-index.yaml>`.
- Fetches all Docker Hub tags for `neoskop/ixy` via
  `https://hub.docker.com/v2/repositories/neoskop/ixy/tags?page_size=100`,
  following `.next` until exhausted, into a set of tag names.
- Reads `.entries.ixy[]` from the given index; for each, checks whether its
  `appVersion` is in the tag set.
- Prints each unusable `version` on its own line to stdout (nothing else on
  stdout, so callers can consume it directly). Diagnostics go to stderr.
- `--self-test`: runs with inlined fixtures (a small index snippet + a fixed tag
  set) and asserts the output is exactly `2.1.0` and `1.0.0`. Exits non-zero on
  mismatch. No test framework.

Kept as a standalone script so the error-prone logic (set membership +
pagination) is testable without CI.

### 2. `.github/workflows/cleanup.yml`

`workflow_dispatch` with one input:

- `mode`: choice `dry-run` (default) | `apply`.

Job `cleanup` (`runs-on: ubuntu-latest`, `permissions: contents: write`):

1. Install `yq` and `gh` (gh is preinstalled on the runner; install `yq` as in
   `release.yml`).
2. `actions/checkout@v6` with `ref: gh-pages` and `token: ${{ secrets.RELEASE_PAT }}`.
3. Configure git as `github-actions[bot]`.
4. Run `scripts/find-unusable-versions.sh index.yaml` → capture the version list.
5. Print the unusable list with reasons (`chart X.Y.Z → image neoskop/ixy:X.Y.Z missing`).
6. If the list is empty: log "nothing to delete" and exit 0.
7. If `mode == dry-run`: log "dry-run, no changes" and exit 0.
8. If `mode == apply`, for each version V:
   - `yq eval "del(.entries.ixy[] | select(.version == \"$V\"))" -i index.yaml`
   - `gh release delete "ixy-$V" --repo neoskop/ixy --yes --cleanup-tag`
     (deletes the GitHub Release and its `ixy-$V` git tag)
9. Commit and push `index.yaml` to `gh-pages` (only if it changed).
10. Dispatch the aggregator:
    `gh api repos/neoskop/helm-charts/dispatches -f event_type=update-index`
    (no version payload needed for a deletion; the aggregator rebuilds from
    source indices).

`GH_TOKEN` for all `gh` calls = `secrets.RELEASE_PAT` (cross-repo dispatch + repo
release/tag deletion + gh-pages push, same token `release.yml` uses).

A `notify-failure` job (`needs: cleanup`, `if: failure()`) posts to Slack via
`secrets.SLACK_WEBHOOK_URL`, copied from `release.yml`.

### 3. `scripts/cleanup.sh` (local trigger)

Mirror of `scripts/release.sh`: validates a `dry-run|apply` argument, checks for
`gh`, runs `gh workflow run cleanup.yml -f mode="$1"`, prints the Actions URL.

## Order and idempotency

- The index edit and release delete happen per version; the gh-pages push and
  aggregator dispatch happen once after the loop.
- Re-running is safe: a version already deleted no longer appears in the index,
  so detection won't list it; `gh release delete` on an absent release is guarded
  by the detection list (only listed versions are deleted).

## Scope boundaries (deliberately out of scope)

- **Plain `V` git tag** (the docker-build trigger) is left intact — only the
  `ixy-V` chart tag is removed via `--cleanup-tag`. This lets a maintainer
  re-run the image build to make V usable again. Deleting it too can be added
  later if desired.
- **Orphan Docker images that have no chart** (e.g. `0.7.3`, `0.6.2`, `0.4.0`)
  are not touched. The action removes unusable charts, not stray images.
- Image reference is assumed to be `neoskop/ixy:<appVersion>` per chart defaults.
  If a future release overrides `image.repository`/`image.tag` in the packaged
  chart, detection would need to read those values from the packaged `.tgz`;
  not handled now.

## Testing

- `scripts/find-unusable-versions.sh --self-test` asserts the detection logic
  against inlined fixtures (must flag exactly `2.1.0` and `1.0.0`).
- End-to-end validation: run the workflow in `dry-run` mode and confirm it
  reports exactly the currently-unusable versions before ever running `apply`.

## Alternative considered

Checking image existence with `docker manifest inspect neoskop/ixy:<v>` instead
of the Hub API — requires docker login and one call per version. The Hub tags
API needs one or two unauthenticated calls total for the whole set. Chose the
Hub API.
