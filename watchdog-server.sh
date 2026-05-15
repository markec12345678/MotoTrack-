#!/bin/bash
# Watchdog script that keeps the Next.js standalone server running
# Restarts automatically if the server crashes

PORT=3000
MAX_RETRIES=0
RETRY_COUNT=0

echo "[Watchdog] Starting MotoTrack server watchdog..."

while true; do
    # Kill any existing server
    pkill -f "node.*server.js" 2>/dev/null
    sleep 1
    
    echo "[Watchdog] Starting server (attempt $((RETRY_COUNT+1)))..."
    NODE_OPTIONS="--max-old-space-size=1536" node .next/standalone/server.js &
    SERVER_PID=$!
    
    # Wait for server to be ready
    for i in $(seq 1 15); do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null | grep -q "200"; then
            echo "[Watchdog] Server is UP (PID: $SERVER_PID)"
            RETRY_COUNT=0
            break
        fi
        sleep 1
    done
    
    # Wait for the server process to exit
    wait $SERVER_PID 2>/dev/null
    EXIT_CODE=$?
    RETRY_COUNT=$((RETRY_COUNT+1))
    
    echo "[Watchdog] Server exited with code $EXIT_CODE"
    
    # Brief pause before restart
    sleep 2
done
