# Task 10 - Offline Tile Caching Engineer

## Task
Fix the offline tile caching system to support proper tile downloading and storage using IndexedDB.

## Files Modified
1. **Created**: `/home/z/my-project/src/app/api/offline-maps/download/route.ts` - New API endpoint that calculates tile coordinates from region bounds and returns tile URLs
2. **Modified**: `/home/z/my-project/src/components/offline-maps-manager.tsx` - Complete rewrite with IndexedDB integration, real tile downloading, progress tracking, cancellation, and storage usage

## Key Changes
- New `/api/offline-maps/download` POST endpoint calculates all tile {z}/{x}/{y} for a region's bounds across its zoom levels
- IndexedDB wrapper (DB: `mototrack-offline-maps`, store: `tiles`) for tile blob storage
- Tiles stored with keys `tile_region_{regionId}_{z}_{x}_{y}` for region-scoped management
- Real tile fetching from OSM in batches of 6 concurrent requests with 100ms delay between batches
- Real progress: X/Y tiles, phase indicators (fetching/downloading/done), failed count
- Cancellation via AbortController with XCircle cancel button
- Actual storage usage from IndexedDB (bytes + tile count) instead of estimated MB
- Per-region tile count display
- Region-scoped deletion + "delete all" option
- Exported `createOfflineTileUrl()` and `useOfflineTileInterceptor()` for map integration

## Lint Status
- No new lint errors introduced
- Only pre-existing lint errors in other files (balkan-camps-panel, balkan-events-panel, etc.)
