#!/bin/bash
for pod in $(kubectl -n ixy get po -oname); do
    echo $pod
    kubectl -n ixy exec $pod -- rm -rf /home/node/cache/src /home/node/cache/target
    kubectl -n ixy exec $pod -- mkdir -p /home/node/cache/src /home/node/cache/target
done
