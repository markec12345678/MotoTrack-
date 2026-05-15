#!/bin/bash
cd /home/z/my-project

# Ensure bundles exist
if [ ! -f ".next/static/chunks/bundle.js" ]; then
  echo "[DEV] Building bundles..."
  FRAMEWORK_JS="1b722dc42a67f14a.js 52505032a065c95f.js turbopack-096cc15c6f0e2262.js e4a11e9bca78804b.js e502ec70dee7d74e.js de42c9af34da033a.js 4d518823ade4dafd.js 9fe7c86b9d499177.js 664adc71bc2617c2.js 03500a31fa9a5852.js"
  > .next/static/chunks/bundle.js
  for f in $FRAMEWORK_JS; do
    [ -f ".next/static/chunks/$f" ] && cat ".next/static/chunks/$f" >> .next/static/chunks/bundle.js
  done
  > .next/static/chunks/bundle.css
  for f in a7d5d0791c8c6223.css ac228c928740594b.css; do
    [ -f ".next/static/chunks/$f" ] && cat ".next/static/chunks/$f" >> .next/static/chunks/bundle.css
  done
fi

echo "[DEV] Starting MotoTrack Python server (auto-restart)..."
while true; do
  python3 mototrack-server.py
  echo "[DEV] Server died, restarting immediately..."
done
