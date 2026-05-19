#!/bin/bash
cd /home/z/my-project
echo "[DEV] Starting MotoTrack Next.js dev server..."
NODE_OPTIONS='--max-old-space-size=4096' npx next dev --port 3000 2>&1
