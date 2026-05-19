#!/bin/bash
cd /home/z/my-project
echo "[DEV] Starting MotoTrack Node.js server (daemon mode)..."
while true; do
  node static-server.mjs 2>&1
  echo "[DEV] Server died, restarting in 1s..."
  sleep 1
done
