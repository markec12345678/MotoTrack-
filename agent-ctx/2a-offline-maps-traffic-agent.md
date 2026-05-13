# Task 2a - Offline Maps & Traffic Overlay Agent

## Task Summary
Improve Offline Maps Manager and Traffic Overlay components to use real API integration instead of hardcoded/stubbed data.

## Files Modified

### 1. Prisma Schema (`prisma/schema.prisma`)
- Added `OfflineMap` model with fields: id, regionId (unique), userId, downloadedAt
- Added `offlineMaps OfflineMap[]` relation to User model
- Ran `bun run db:push` successfully

### 2. Offline Maps API (`src/app/api/offline-maps/route.ts`)
- Complete rewrite from hardcoded to DB-backed
- GET: Returns 10 regions with download status from DB (supports ?userId= query)
- POST: Creates OfflineMap record (body: userId, regionId)
- DELETE: Removes OfflineMap record (body: userId, regionId)
- 10 regions: 6 Slovenian sub-regions + 4 neighboring countries

### 3. Offline Maps Manager Component (`src/components/offline-maps-manager.tsx`)
- Added `userId` prop
- Fetches regions from API on mount (GET /api/offline-maps?userId=...)
- Real download flow: POST /api/offline-maps with progress simulation
- Real delete flow: DELETE /api/offline-maps with loading state
- Shows download timestamp (Clock icon + formatted date)
- Toast notifications for success/error
- Loading and empty states
- All UI in Slovenian

### 4. Traffic API (`src/app/api/traffic/route.ts`)
- Added POST endpoint for reporting incidents
- GET now merges static incidents with DB-reported incidents from Hazard model
- Maps Hazard types to traffic types/severity
- Returns `lastUpdated` timestamp
- Validates type and severity on POST
- Stores reported incidents as Hazard records with 24h expiration

### 5. Traffic Overlay Component (`src/components/traffic-overlay.tsx`)
- Added `userId` prop
- 60-second polling when enabled (useRef interval with cleanup)
- Report form with type selector, severity selector, description input
- Last updated timestamp with timeAgo helper
- Severity-based styling: high=red, medium=orange, low=muted
- Slovenian labels for types and severities
- Toggle button for report form
- Empty state
- Toast notifications

### 6. Integration Updates
- `plan-tab.tsx`: passes userId to OfflineMapsManager
- `map-tab.tsx`: passes userId to TrafficOverlay

## Verification
- `bun run db:push` — successful
- `bun run lint` — 0 errors, 0 warnings
- Offline maps API tested via curl — returns 10 regions with download status
- Traffic API tested via curl — returns merged static + DB incidents with lastUpdated
