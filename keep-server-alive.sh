#!/bin/bash
cd /home/z/my-project
while true; do
  if ! lsof -i :3000 > /dev/null 2>&1; then
    echo "$(date): Starting server..." >> /tmp/server-watchdog.log
    node --max-old-space-size=1024 node_modules/.bin/next dev -p 3000 >> /tmp/next-dev.log 2>&1 &
    sleep 15
  else
    sleep 10
  fi
done
