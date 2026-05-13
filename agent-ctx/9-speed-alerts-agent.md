# Task 9 - Speed Alerts Agent

## Summary
Implemented Speed Alerts feature for MotoTrack motorcycle app.

## Changes Made

### 1. Prisma Schema (`prisma/schema.prisma`)
- Added `speedLimit Int? @default(90)` — user's preferred speed limit (km/h)
- Added `speedAlertEnabled Boolean? @default(true)` — whether speed alerts are enabled
- Added `speedAlertSound Boolean? @default(true)` — whether to play sound on alert
- Ran `bun run db:push` — database synced successfully

### 2. Types (`src/components/tabs/types.ts`)
- Added `SpeedAlertSettings` interface with `speedLimit`, `speedAlertEnabled`, `speedAlertSound`

### 3. API Route (`src/app/api/speed-settings/route.ts`)
- GET: Returns user's speed alert settings (query: userId)
- PUT: Update speed alert settings (userId, speedLimit [30-200], speedAlertEnabled, speedAlertSound)
- Error messages in Slovenian

### 4. Track Tab (`src/components/tabs/track-tab.tsx`)
- Added `userId` prop for fetching user-specific speed settings
- Speed limit indicator badge in top-right corner
- Flashing red border/overlay when over speed limit
- Speed text turns red when over limit
- Beep sound via Web Audio API (880Hz, 0.3s) on speed limit crossing
- Respects speedAlertEnabled and speedAlertSound settings

### 5. Profile Tab (`src/components/tabs/profile-tab.tsx`)
- Added "Hitrostna opozorila" card with amber theme
- Toggle: "Omogoči opozorila" (Enable alerts)
- Speed limit slider (30-200 km/h) with presets (50, 90, 110, 130)
- Toggle: "Zvočno opozorilo" (Sound alert)
- Save button → PUT /api/speed-settings

### 6. Page (`src/app/page.tsx`)
- Passes `userId={user?.id}` prop to TrackTab

## Lint Status
All lint checks pass.
