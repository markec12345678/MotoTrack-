#!/bin/bash
cd /home/z/my-project
while true; do
  setsid python3 mototrack-server.py &
  SERVER_PID=$!
  wait $SERVER_PID 2>/dev/null
  echo "[$(date)] Server died, restarting in 2s..."
  sleep 2
done
