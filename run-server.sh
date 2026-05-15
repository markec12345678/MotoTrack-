#!/bin/bash
cd /home/z/my-project
LOG="/tmp/mototrack-server.log"
echo "[$(date)] Watchdog starting..." >> "$LOG"

while true; do
    echo "[$(date)] Starting server..." >> "$LOG"
    NODE_OPTIONS="--max-old-space-size=128" node custom-server.js >> "$LOG" 2>&1
    EXIT_CODE=$?
    echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 2s..." >> "$LOG"
    sleep 2
done
