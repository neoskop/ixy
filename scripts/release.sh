#!/bin/bash
set -e
increment=${1:-patch}

build() {
    cd $1
    version=$(npm version ${increment} --no-git-tag-version)
    docker build -t neoskop/${1}:${version} .
    docker push neoskop/${1}:${version}
    cd - &>/dev/null
}

git add .
git commit -m "chore: release ${version}"
git push
