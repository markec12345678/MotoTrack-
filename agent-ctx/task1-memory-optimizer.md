# Task: Optimize MotoTrack for Memory Efficiency

## Summary
Rewrote key components to prevent Next.js dev server OOM crashes by deferring heavy Leaflet map compilation until explicitly needed.

## Changes Made

### 1. `/home/z/my-project/src/app/page.tsx`
- Changed from `React.lazy()` to `next/dynamic()` with `{ ssr: false }` for ALL tab components
- This prevents server-side compilation of any tab component code
- Changed default tab from `'map'` to `'explore'` to avoid Leaflet loading on initial render
- Uses conditional rendering (`{activeTab === 'map' && <MapTab />}`) instead of switch statement to ensure only ONE tab component is ever mounted at a time
- Kept all existing features: header, navigation, theme toggle

### 2. `/home/z/my-project/src/components/tabs/map-tab.tsx`
- Added `mapLoaded` state (starts as `false`) to defer Leaflet loading
- Shows a beautiful placeholder with "Naloži zemljevid" (Load Map) button instead of the MotoMap component
- Non-map UI (search bar, filters, action buttons, bottom sheet, POI panels) renders immediately
- When user clicks "Load Map" or enables a map-dependent feature (twisty roads, weather, hazards), the map loads
- Added loading component to `dynamic()` import for MotoMap
- All existing features preserved: search, filters, POI panels, LiveRIDE, fuel panel, etc.

### 3. `/home/z/my-project/src/components/tabs/plan-tab.tsx`
- Added `mapLoaded` state (starts as `false`) to defer Leaflet loading
- Shows a placeholder with "Naloži zemljevid" button in the map area
- Side panel (route/trip planner forms) renders immediately without needing the map
- Added loading component to `dynamic()` import for MotoMap
- All existing features preserved: route planner, trip planner, curvature profiles, waypoints, etc.

## Key Optimization Strategy
The core problem was that Leaflet (a very heavy library) was being compiled by the Next.js dev server even when not needed. The solution has three layers:

1. **`next/dynamic` with `{ ssr: false }`**: Prevents the server from ever compiling tab components during SSR. Components are only compiled when the client requests them.

2. **Default tab is 'explore'**: The initial page load doesn't trigger any Leaflet compilation at all. The explore tab uses only lightweight components.

3. **"Load Map" button**: Even when the user navigates to the map or plan tab, the Leaflet map is not loaded until they explicitly click "Load Map". The non-map UI is shown immediately.

## Test Results
- Server consistently starts and serves the page (38314+ bytes) on first request
- No OOM crashes during initial page compilation
- Page compiles in ~2.5-3.0 seconds
- 3 consecutive test runs all successful (38313, 38317, 38316 bytes)
- Lint passes cleanly

## Files NOT Changed (as instructed)
- `src/components/tabs/types.ts` - unchanged
- `src/components/tabs/explore-tab.tsx` - unchanged
- `src/components/tabs/track-tab.tsx` - unchanged  
- `src/components/tabs/profile-tab.tsx` - unchanged
- `src/components/moto-map.tsx` - unchanged
- All API routes - unchanged
