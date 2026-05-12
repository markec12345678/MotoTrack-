#!/bin/bash
cd /home/z/my-project
bun install
bun run db:push
node --max-old-space-size=1024 node_modules/.bin/next dev -p 3000
