---
Task ID: 9
Agent: Route Tile Pre-download Implementer
Task: Add pre-download tiles along planned route for offline use

Work Log:
- Read and analyzed existing files: offline-protocol.ts, offline-maps-manager.tsx, plan-tab.tsx, sw.js
- Created `/home/z/my-project/src/components/route-tile-preloader.tsx`:
  - Full tile math implementation (latLngToTile, calculateBBox, generateTileList)
  - Configurable buffer (1-20km) and zoom levels (8-16)
  - CartoDB light primary + OSM fallback tile sources
  - Rate-limited download (4 concurrent, 100ms delay between batches)
  - AbortController for cancellation
  - Skip already-cached tiles in IndexedDB
  - Key format: `tile_route_{timestamp}_{z}_{x}_{y}`
  - Progress: "Prenašam ploščice... X/Y (Z%)"
  - Estimated tile count and size (~15KB/tile)
  - WiFi warning message
  - Completion message with stats
  - Color coding: green=done, amber=downloading, default=idle
  - Collapsible with "Offline ploščice" header
  - All Slovenian text
- Modified `/home/z/my-project/src/components/tabs/plan-tab.tsx`:
  - Added RouteTilePreloader import
  - Placed after CurvatureProfile, before Save button
  - Conditionally rendered when waypoints >= 2
- ESLint: 0 errors on new/modified files

Stage Summary:
- RouteTilePreloader component fully implemented and integrated
- Users can now pre-download map tiles for planned routes before riding in poor-signal areas
