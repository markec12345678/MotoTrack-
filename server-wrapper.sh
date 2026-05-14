#!/bin/bash
cd /home/z/my-project
echo "$(date): Starting server..." >> /tmp/server-lifecycle.log
node --max-old-space-size=2048 node_modules/.bin/next dev -p 3000 2>>/tmp/server-lifecycle.log
EXIT_CODE=$?
echo "$(date): Server exited with code: $EXIT_CODE, signal: $?" >> /tmp/server-lifecycle.log
