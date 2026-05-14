# Task ID: 3 - Live Location Sharing WebSocket Mini-Service

## Agent: Live Tracking Agent

## Summary
Built the Live Location Sharing WebSocket mini-service enabling real-time location sharing between riders so friends/family can track them live.

## Changes Made

### 1. WebSocket Mini-Service (`mini-services/live-tracking/`)
- **index.ts**: Complete rewrite with new event schema:
  - `join-session` / `leave-session` for viewers
  - `location-update` for riders to broadcast position
  - `viewer-count` emitted when viewers join/leave
  - `rider-location` emitted to viewers on location updates
  - `rider-stopped` when rider disconnects or stops
  - Backward-compatible `start-broadcast` / `stop-broadcast`
  - In-memory session store, periodic cleanup (10min stale threshold)
  - Health check and sessions endpoints
- **package.json**: `bun --hot index.ts` dev script, socket.io dependency
- **Port**: 3003

### 2. LiveTrackingPanel (`src/components/live-tracking-panel.tsx`)
- Added Socket.io client with `io("/?XTransformPort=3003")`
- WS connection indicator (Wifi/WifiOff icons)
- Real-time `location-update` emissions on GPS changes
- Real-time `viewer-count` listener
- `start-broadcast` on session start, `stop-broadcast` on stop
- HTTP API retained as fallback (5s interval for persistence, 30s for viewer count)

### 3. LiveTrackingViewer (`src/components/live-tracking-viewer.tsx`)
- New component for viewing a live rider's position on a map
- Leaflet map with custom motorcycle marker, orange trail, re-center button
- Token input to join sessions, auto-follow rider with manual pan override
- Real-time position, speed, heading, viewer count display
- All UI in Slovenian

### 4. Feature Hub Integration (`src/app/page.tsx`)
- Added LiveTrackingViewer dynamic import
- "V živo" tab now shows both LiveTrackingPanel + LiveTrackingViewer

## Lint Status
- Clean: 0 errors, 0 warnings
