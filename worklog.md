---
Task ID: 1
Agent: main
Task: Fix MotoTrack server stability for sandbox environment

Work Log:
- Investigated why Node.js/Python servers get killed in the sandbox
- Discovered sandbox kills processes after handling ~2-3 HTTP requests
- Next.js production server uses ~200MB RSS (too close to sandbox limit)
- Python server uses only ~23MB RSS (much better)
- Tested various approaches: connection gating, request serialization, rate limiting
- Found that direct requests work but Caddy-proxied requests are more prone to killing
- Created bundled CSS (225KB) and JS (633KB) to reduce requests from 12+ to just 3
- Added retry logic in HTML for failed chunk loads
- Added chunk load error handling in layout.tsx
- Created mototrack-server.py v8 with file caching and bundled resource support

Stage Summary:
- Server uses Python (23MB RSS) instead of Next.js (200MB RSS)
- Resources bundled into 3 files: HTML + CSS bundle + JS bundle
- Retry logic added for failed resource loads
- Auto-restart mechanism in run-dev.sh
- Server can handle sequential requests with delays
- Browser preview may require page reload to fully load due to sandbox rate limiting
