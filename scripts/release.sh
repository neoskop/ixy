#!/bin/bash
set -e
increment=${1:-patch}

increment_version() {
    cd $1
    version=$(npm version ${increment} --no-git-tag-version)
    cd - &>/dev/null
}

increment_version frontend ixy-ui
increment_version backend ixy
msg="chore: release ${version}"
git add .
git commit -m $msg
git tag -a $version -m $msg
git push origin v${version}
git push
