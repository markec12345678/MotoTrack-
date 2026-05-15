---
Task ID: 1
Agent: Main
Task: Get MotoTrack server running stably in sandbox

Work Log:
- Extensive testing of different server approaches (Node.js, Python, Next.js dev, Next.js start)
- Discovered sandbox process killer terminates any process after ~5-6 Caddy-proxied HTTP requests
- Direct HTTP requests (bypassing Caddy) work indefinitely
- Python server (mototrack-server.py) is most memory-efficient (~24MB RSS)
- Node.js lightweight server works but uses ~55MB RSS
- Next.js production server uses ~200MB RSS - too heavy
- Auto-restart wrapper helps but process group gets killed entirely
- Vercel deployment at https://mototrack-gamma.vercel.app works for the main page
- Server on port 3000 works for initial page load through Caddy

Stage Summary:
- Server can run but dies after ~5-6 Caddy requests
- Vercel deployment is the most stable option for testing
- Python server (mototrack-threaded.py) is the best local option
- The sandbox's process killer is the fundamental blocker
