#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=1024" npx next dev -p 3000
  echo "Server crashed, restarting in 3 seconds..." >> /tmp/nextjs-restart.log
  sleep 3
done
