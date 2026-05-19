# MotoTrack Worklog

---
Task ID: 1
Agent: Main Agent
Task: Fix blank white squares on Leaflet map tiles on Vercel deployment

Work Log:
- Used VLM to analyze user's screenshot - confirmed blank white squares with broken image icons
- Used agent-browser to inspect the deployed Vercel site (mototrack-gamma.vercel.app)
- Found that Leaflet tile images had naturalWidth=0 (failed to load) despite CSS being correct
- Tested various tile providers: OSM direct fails, CartoDB fails, OpenTopoMap WORKS, Esri WORKS
- Discovered that fetch() API works for OSM tiles but <img> tags fail (OSM policy enforcement on cloud providers)
- Found that the service worker was using addXTP() on tile requests which could interfere
- Found aggressive MutationObservers in both layout.tsx and moto-map.tsx that were modifying tile DOM elements every 500ms - likely interfering with Leaflet's internal tile management
- Console showed tile errors for BOTH OSM tiles AND the app's own URL (https://mototrack-gamma.vercel.app/) suggesting the map was being recreated with wrong tile URLs

Fixes Applied:
- Switched default tile from OSM direct (tile.openstreetmap.org) to OpenTopoMap (tile.opentopomap.org) - verified working on Vercel
- Added tile error retry logic with exponential backoff (3 retries at 500ms, 1000ms, 1500ms)
- Removed aggressive MutationObserver + interval fix from moto-map.tsx
- Removed aggressive MutationObserver from layout.tsx inline script
- Simplified CSS overrides in layout.tsx (only essential max-width/max-height fixes)
- Fixed service worker tile caching: cache-first with no-cors fetch, omit credentials for cross-origin tiles
- Added OpenTopoMap, Esri, RainViewer to SW tile host list
- Bumped SW cache version to v3 to clear stale caches
- Added map style aliases (streets, terrain) for MapStyleSelector compatibility

Verification:
- agent-browser confirmed all 24 tiles loaded (naturalWidth=256)
- VLM confirmed "fully loaded with actual map tiles displaying roads, terrain, labels (Ljubljana, Zagreb, etc.)"
- No console errors
- Pushed to GitHub (commit 109819c), auto-deployed to Vercel

Stage Summary:
- ROOT CAUSE: OpenStreetMap direct tiles (tile.openstreetmap.org) are rate-limited/blocked on Vercel cloud deployments. The <img> tags fail to load (naturalWidth=0) while fetch() API works, suggesting OSM's tile usage policy enforcement.
- CONTRIBUTING FACTOR: Aggressive MutationObservers modifying tile DOM elements were likely interfering with Leaflet's internal tile loading management.
- FIX: Switched to OpenTopoMap as default tile provider + removed interfering MutationObservers + added retry logic + fixed service worker caching.
