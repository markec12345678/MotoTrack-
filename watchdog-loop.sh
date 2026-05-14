#!/bin/bash
cd /home/z/my-project
while true; do
    echo "$(date): Starting server..." >> /home/z/my-project/dev.log
    node --max-old-space-size=4096 node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    SERVER_PID=$!
    echo "$(date): Server PID: $SERVER_PID" >> /home/z/my-project/dev.log
    
    # Wait for server to be ready
    for i in $(seq 1 30); do
        if curl -s --max-time 2 http://127.0.0.1:3000/api/user > /dev/null 2>&1; then
            echo "$(date): Server ready" >> /home/z/my-project/dev.log
            break
        fi
        sleep 1
    done
    
    # Warm up homepage compilation
    echo "$(date): Warming up homepage..." >> /home/z/my-project/dev.log
    curl -s --max-time 30 http://127.0.0.1:3000/ > /dev/null 2>&1
    echo "$(date): Homepage warmed up" >> /home/z/my-project/dev.log
    
    # Now wait for the server to die
    wait $SERVER_PID 2>/dev/null
    EXIT_CODE=$?
    echo "$(date): Server exited with code $EXIT_CODE, restarting in 3s..." >> /home/z/my-project/dev.log
    sleep 3
done
