#!/bin/bash
cd /home/z/my-project
while true; do
  node --max-old-space-size=2048 node_modules/.bin/next dev -p 3000 2>&1
  sleep 2
done
