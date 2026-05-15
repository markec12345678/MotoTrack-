---
Task ID: 1
Agent: main
Task: Fix dev server OOM crash and get MotoTrack running

Work Log:
- Identified that the dev server crashes due to OOM when compiling the large page.tsx (~690 lines with 15+ dynamic imports)
- Refactored page.tsx by extracting the Home component into src/components/home.tsx
- page.tsx is now minimal (~25 lines) with just a dynamic import and loading skeleton
- Added `output: 'standalone'` to next.config.ts for production builds
- Rebuilt the project for production mode
- Copied static files, public, db, prisma, and .env to .next/standalone/
- Started standalone production server with NODE_OPTIONS="--max-old-space-size=4096"
- Server runs stably and responds with HTTP 200 in ~30ms
- All API endpoints tested and working (users, rides, routes, pois, hazards, etc.)

Stage Summary:
- Dev mode (turbopack/webpack) crashes due to OOM in sandbox
- Production standalone mode works reliably with 4GB heap
- Server responds in ~30ms for page loads, ~15ms for API calls
- 3D view code (map-3d-viewer.tsx) is correctly implemented with:
  - Dynamic CSS loading via <link> tag
  - Loading state with spinner overlay
  - Error state with warning icon and close button
  - MapLibre GL v5 for 3D terrain with hillshade
  - Elevation-colored track lines
  - Fly-along animation
  - Mini elevation profile canvas
