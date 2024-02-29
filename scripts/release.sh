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
sed -i "s/appVersion: .*/appVersion: \"$version\"/" helm/Chart.yaml
sed -i "s/version: .*/version: $version/" helm/Chart.yaml
yq eval ".version=\"$version\"" -i helm/Chart.yaml
yq eval ".appVersion=\"$version\"" -i helm/Chart.yaml
yq eval ".image.tag=\"$version\"" -i helm/values.yaml
yq eval ".ui.image.tag=\"$version\"" -i helm/values.yaml
git add .
git commit -m "$msg"
git tag -a $version -m "$msg"
git push origin $version
git push

helm package helm --destination .deploy
cr upload -o neoskop -r ixy -p .deploy
git checkout gh-pages
cr index -i ./index.yaml -p .deploy -o neoskop -r ixy -c https://neoskop.github.io/ixy/
git add index.yaml
git commit -m "chore: Bump version to ${version}."
git push
git checkout master
rm -rf .deploy/
