#!/bin/bash
cd /home/z/my-project/.next/standalone
export PORT=3000
export HOSTNAME=0.0.0.0
export NODE_OPTIONS="--max-old-space-size=4096"

while true; do
  echo "[$(date)] Starting MotoTrack server..."
  node server.js &
  SERVER_PID=$!
  
  # Health check loop - ping every 10 seconds
  while kill -0 $SERVER_PID 2>/dev/null; do
    sleep 10
    curl -s -o /dev/null http://localhost:3000/ 2>/dev/null
  done
  
  wait $SERVER_PID
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
