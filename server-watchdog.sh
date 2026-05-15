#!/bin/bash
# Watchdog for MotoTrack server - auto-restarts on crash
# Runs in foreground, manages the Next.js custom server

LOG="/tmp/mototrack-watchdog.log"
echo "[$(date)] Watchdog starting..." > "$LOG"

while true; do
    echo "[$(date)] Starting MotoTrack server..." >> "$LOG"
    
    NODE_OPTIONS="--max-old-space-size=1024" node /home/z/my-project/custom-server.js >> "$LOG" 2>&1
    EXIT_CODE=$?
    
    echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..." >> "$LOG"
    sleep 3
done
