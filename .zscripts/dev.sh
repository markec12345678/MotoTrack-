#!/bin/bash
# Custom dev script for MotoTrack sandbox
# Builds production app and runs custom server with auto-restart
# Called by sandbox's /start.sh when present at .zscripts/dev.sh

cd /home/z/my-project

# Check if we need to build
if [ ! -f ".next/BUILD_ID" ]; then
    echo "[DEV] No production build found, building..."
    NODE_OPTIONS="--max-old-space-size=4096" npx next build 2>&1 | tail -5
    echo "[DEV] Build complete"
fi

echo "[DEV] Starting MotoTrack custom server with auto-restart..."
while true; do
    NODE_OPTIONS="--max-old-space-size=1024" node custom-server.js
    EXIT_CODE=$?
    echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..." >> /tmp/nextjs-restart.log
    sleep 3
done
