#!/bin/bash
# Custom dev script for MotoTrack sandbox
# Called by sandbox's /start.sh when present at .zscripts/dev.sh
# Uses lightweight Node.js server optimized for sandbox memory constraints

cd /home/z/my-project

# Kill any existing process on port 3000
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Check if we need to build (first time only)
if [ ! -f ".next/BUILD_ID" ]; then
    echo "[DEV] No production build found, building..."
    NODE_OPTIONS="--max-old-space-size=4096" npx next build 2>&1 | tail -5
    echo "[DEV] Build complete"
fi

# Ensure we have a cached index.html
if [ ! -f ".next/cached-index.html" ]; then
    echo "[DEV] Generating cached index.html..."
    # Build creates the HTML, we need to cache it
    node -e "
    const http = require('http');
    const fs = require('fs');
    const next = require('next');
    const app = next({ dev: false });
    app.prepare().then(() => {
      http.get('http://localhost:3000/', (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          fs.writeFileSync('.next/cached-index.html', d);
          console.log('Cached index.html: ' + d.length + ' bytes');
          process.exit(0);
        });
      }).on('error', () => process.exit(1));
    });
    " 2>/dev/null || true
fi

echo "[DEV] Starting MotoTrack lightweight server..."
echo "[DEV] This server auto-restarts if killed by sandbox OOM monitor"

# Auto-restart loop - the sandbox kills processes, so we restart them
while true; do
    node --expose-gc mototrack-server.js 2>&1
    echo "[DEV] Server died, restarting in 2s..."
    sleep 2
done
