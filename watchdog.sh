#!/bin/bash
cd /home/z/my-project/.next/standalone
export PORT=3000
export HOSTNAME=0.0.0.0
export NODE_OPTIONS="--max-old-space-size=4096"

while true; do
  node server.js &
  SERVER_PID=$!
  
  # Wait for the server to die
  wait $SERVER_PID 2>/dev/null
  
  # Small delay before restart
  sleep 1
done
