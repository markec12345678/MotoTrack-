#!/bin/bash
# MotoTrack Server Watchdog
# Runs the Next.js server in foreground and restarts it if it dies
cd /home/z/my-project

echo "[$(date)] Starting MotoTrack server watchdog..."

while true; do
  echo "[$(date)] Starting server..."
  NODE_OPTIONS="--max-old-space-size=512" node run-server.mjs
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
