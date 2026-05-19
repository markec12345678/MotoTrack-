#!/bin/bash
cd /home/z/my-project
while true; do
  node static-server.mjs 2>&1
  echo "Server died, restarting in 1s..."
  sleep 1
done
