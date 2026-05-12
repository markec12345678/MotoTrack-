#!/bin/bash
cd /home/z/my-project
while true; do
  node --max-old-space-size=1024 node_modules/.bin/next dev -p 3000
  echo "Server died, restarting in 5 seconds..."
  sleep 5
done
