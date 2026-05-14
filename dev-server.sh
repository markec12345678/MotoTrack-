#!/bin/bash
cd /home/z/my-project
while true; do
  echo "$(date): [dev-server] Starting..." >> /home/z/my-project/dev.log
  bun run dev >> /home/z/my-project/dev.log 2>&1
  echo "$(date): [dev-server] Exited, restarting in 3s..." >> /home/z/my-project/dev.log
  sleep 3
done
