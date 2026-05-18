---
Task ID: 3
Agent: Tracking Reliability Developer
Task: Implement Enhanced Tracking Reliability

Work Log:
- Read worklog.md to understand prior work (QR sharing, hazard reporting, GPX, GPS reliability v1, BT helmet, iconic routes, weather overlay, driving mode v2, route reviews, emergency panel, wind warning)
- Read track-tab.tsx (865 lines) to understand existing tracking UI integration
- Read home.tsx GPS tracking implementation (startTracking, watchPosition, visibility change, GPS re-acquisition, error handling)
- Read types.ts for TrackPoint interface
- Created `src/components/gps-reliability-service.tsx`:
  a. useGpsReliability hook with full tracking reliability management
  b. Wake Lock API: request/release with automatic re-request on visibility change
  c. Visibility Change Handler: logs background events, re-requests wake lock and GPS fix on foreground
  d. Position Error Recovery: PERMISSION_DENIED → toast with settings link, POSITION_UNAVAILABLE → retry with increased timeout, TIMEOUT → exponential backoff (2s, 4s, 8s, max 16s)
  e. GPS Signal Quality Indicator: 🟢 Excellent ≤10m, 🟡 Good ≤25m, 🟠 Fair ≤50m, 🔴 Poor >50m, 🔴 None
  f. Track Point Validation: filter GPS jumps (>200m AND >120km/h = suspicious, reject)
  g. Heartbeat System: every 30s verify tracking running, auto-restart GPS if no fix for 60s
  h. Reconnection Counter: tracks GPS reconnections, shown in post-ride stats
  i. GpsSignalIndicator component (shown next to speed in dashboard)
  j. GpsReliabilityStats component (shown after ride stops)
  k. GpsErrorNotification component (error with retry button)
  l. GpsReliabilityBadge component (compact for driving mode)
  m. getSignalQuality and getSignalQualityDisplay helper functions
  n. submitDiagnostics function (POST to /api/tracking-diagnostics)
  o. All text in Slovenian
- Updated `src/components/home.tsx`:
  a. Added gpsAccuracy state (useState<number | null>(null))
  b. Reset gpsAccuracy in startTracking
  c. Set gpsAccuracy from pos.coords.accuracy in watchPosition callback
  d. Pass gpsAccuracy prop to TrackTab
- Updated `src/components/tabs/track-tab.tsx`:
  a. Added gpsAccuracy prop to TrackTabProps interface
  b. Imported useGpsReliability, GpsSignalIndicator, GpsReliabilityStats, GpsErrorNotification, getSignalQuality
  c. Added useGpsReliability hook with isTracking, trackPoints, wakelockEnabled, onRestartTracking
  d. GPS Signal Quality Indicator shown above stats grid during tracking
  e. GPS Error Notification shown when lastError is set (with retry button)
  f. GpsReliabilityStats shown in post-ride summary (after Ride Difficulty Calculator)
  g. Save button calls gpsReliability.submitDiagnostics(duration) before onSave()
- Created `src/app/api/tracking-diagnostics/route.ts`:
  a. POST: receives tracking session diagnostics (duration, totalPoints, droppedPoints, reconnections, suspiciousPoints, errorCount, signalQuality, finalAccuracy, wakeLockUsed)
  b. Calculates reliability score (0-100): point retention rate - penalties for reconnections, errors, suspicious points
  c. Calculates signal quality score from signal quality level
  d. Stores in in-memory cache (session-scoped)
  e. GET: returns latest diagnostics
  f. All error messages in Slovenian
- Lint check passes: 0 errors, 12 warnings (all pre-existing)

Stage Summary:
- Comprehensive GPS reliability system with hook + UI components
- Wake Lock management with automatic re-acquisition on foreground
- Exponential backoff for GPS TIMEOUT errors (2s→4s→8s→16s)
- Signal quality indicator (5 levels, color-coded, with accuracy display)
- Track point validation (reject >200m jumps at >120km/h)
- Heartbeat system (30s interval, auto-restart GPS after 60s no fix)
- Reconnection counter shown in post-ride statistics
- Diagnostics API with reliability scoring
- All Slovenian text, no lint errors introduced
