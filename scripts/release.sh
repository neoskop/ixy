#!/bin/bash
set -e
increment=${1:-patch}

build() {
    cd $1
    version=$(npm version ${increment} --no-git-tag-version)
    docker build -t neoskop/${2}:${version} .
    docker push neoskop/${2}:${version}
    cd - &>/dev/null
}

build frontend ixy-ui
build backend ixy

git add .
git commit -m "chore: release ${version}"
git push
