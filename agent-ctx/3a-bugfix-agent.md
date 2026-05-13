# Task 3a - Bugfix Agent Work Record

## Task: Fix Service Locator Unit Mismatch and GPX Manager Mock Data

### Changes Made

#### 1. Service Locator Unit Fix (`src/components/service-locator.tsx`)
- **Problem**: Component sent `radius[0] * 1000` (meters) to `/api/services` which expects km
- **Fix**: Changed `String(radius[0] * 1000)` → `String(radius[0])` on line 30
- Default radius is 50 km (already correct), slider shows km (already correct)

#### 2. GPX Manager Mock Data Fix (`src/components/gpx-manager.tsx`)
- **Problem**: 3 hardcoded mock import entries shown on first load
- **Fixes**:
  - Removed hardcoded mock array, replaced with empty initial state
  - Added `fetchHistory()` calling `GET /api/gpx?userId=xxx` on mount
  - Added loading state with spinner
  - When `onImport` not provided: uploads file directly via `POST /api/gpx/import` with FormData
  - When `onExport` not provided: calls `GET /api/gpx/export?routeId=xxx` and triggers file download
  - Added `userId` and `onRefresh` props to component interface
  - Added toast notifications (sonner) for success/error
  - Added GPX file validation, fileSize display, empty state

#### 3. New API Route (`src/app/api/gpx/route.ts`)
- `GET /api/gpx?userId=xxx` → returns `{ data: [{ id, fileName, fileSize, routeCount, trackCount, status, resultData, createdAt }] }`
- Queries `GpxImport` model ordered by `createdAt` DESC
- Maps DB status to UI status (completed → success, failed → error)

#### 4. Updated Import API (`src/app/api/gpx/import/route.ts`)
- On success: creates `GpxImport` record with status='completed', includes fileName, fileSize, routeCount, trackCount, resultData
- On failure (too few points): creates `GpxImport` record with status='failed'
- Returns `{ data: route, import: gpxImport }` on success

#### 5. Updated Types (`src/components/tabs/types.ts`)
- Extended `GpxImportResult` interface with optional `fileSize`, `resultData`, `createdAt` fields

### Verification
- `bun run lint` — 0 errors, 0 warnings
- `curl /api/gpx?userId=test` — returns `{"data":[]}` (correct empty response)
