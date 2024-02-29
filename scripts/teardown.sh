#!/bin/bash
kind delete cluster --name=ixy &
pid=$!
docker stop kind-registry-ixy
docker rm kind-registry-ixy
wait $pid
