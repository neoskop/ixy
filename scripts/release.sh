#!/bin/bash
set -e
increment=${1:-patch}
version=$(npm version ${increment})
docker build -t neoskop/ixy:${version} .
docker push neoskop/ixy:${version}
