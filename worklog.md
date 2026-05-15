---
Task ID: 1
Agent: Main
Task: Get MotoTrack server running in sandbox and fix 3D view

Work Log:
- Diagnosed that sandbox has a per-process memory limit of ~500MB RSS
- Next.js production server uses ~200MB RSS at idle, which is fine
- But concurrent API requests cause memory spikes that exceed the limit
- Server gets killed by SIGKILL (uncatchable) when it exceeds ~500MB
- Created custom-server.js with static file bypass and concurrency limiting
- Created /api/init endpoint to reduce concurrent API calls from 7+ to 1
- Updated home.tsx to use /api/init instead of multiple Promise.all fetches
- Removed separate leaderboard fetch (now included in /api/init)
- Server survives indefinitely when idle, but crashes after 2-3 page requests
- Created .zscripts/dev.sh for sandbox auto-start with production build
- For stable deployment, recommend using Vercel (mototrack-gamma.vercel.app)

Stage Summary:
- Sandbox has ~500MB per-process memory limit that kills Node.js
- Created /api/init endpoint to minimize concurrent requests
- Custom server with static file bypass and concurrency control
- Server works for single page loads but crashes under concurrent load
- Vercel deployment recommended for production use
- 3D view fixes from previous session are in code but untested in sandbox
