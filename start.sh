#!/bin/bash
cd /home/z/my-project
while true; do
    NODE_OPTIONS="--max-old-space-size=1024" node custom-server.js
    echo "[$(date)] Server crashed, restarting in 5 seconds..." >> /tmp/nextjs-restart.log
    sleep 5
done
