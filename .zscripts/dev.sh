#!/bin/bash
# Custom dev script for MotoTrack sandbox
# Called by sandbox's /start.sh when present at .zscripts/dev.sh
# Uses production build + custom server with auto-restart watchdog

cd /home/z/my-project

# Check if we need to build
if [ ! -f ".next/BUILD_ID" ]; then
    echo "[DEV] No production build found, building..."
    NODE_OPTIONS="--max-old-space-size=4096" npx next build 2>&1 | tail -5
    echo "[DEV] Build complete"
fi

echo "[DEV] Starting MotoTrack server with watchdog..."
bash run-server.sh
