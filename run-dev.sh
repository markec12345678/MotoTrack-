#!/bin/bash
# MotoTrack Auto-Restart Server
# Uses Python server with bundles + auto-restart
cd /home/z/my-project

# Ensure bundles exist
if [ ! -f ".next/static/chunks/bundle.js" ]; then
  echo "[RUN-DEV] Creating bundles..."
  cat .next/static/chunks/1b722dc42a67f14a.js \
      .next/static/chunks/52505032a065c95f.js \
      .next/static/chunks/turbopack-096cc15c6f0e2262.js \
      .next/static/chunks/e4a11e9bca78804b.js \
      .next/static/chunks/e502ec70dee7d74e.js \
      .next/static/chunks/de42c9af34da033a.js \
      .next/static/chunks/4d518823ade4dafd.js \
      .next/static/chunks/9fe7c86b9d499177.js \
      .next/static/chunks/664adc71bc2617c2.js \
      .next/static/chunks/03500a31fa9a5852.js \
      > .next/static/chunks/bundle.js
  cat .next/static/chunks/a7d5d0791c8c6223.css \
      .next/static/chunks/ac228c928740594b.css \
      > .next/static/chunks/bundle.css
fi

echo "[RUN-DEV] Starting MotoTrack server..."
while true; do
  python3 mototrack-server.py
  echo "[RUN-DEV] Server crashed, restarting in 2s..."
  sleep 2
done
