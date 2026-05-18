---
Task ID: 8
Agent: QR Code Route Sharing
Task: Add QR code to route sharing dialog for PC→Phone transfer

Work Log:
- Read existing route-share-dialog.tsx to understand current share dialog implementation (share code, URL, native share, clipboard copy)
- Read detail-dialog.tsx to understand how RouteShareDialog is integrated (used for route sharing with Hash button)
- Read home.tsx to understand PlanTab props, saveRoute function, and component structure
- Read plan-tab.tsx to find the "Shrani pot" button location for adding "Send to Phone" button
- Read /api/routes/route.ts to verify POST response includes route ID for share dialog
- Enhanced route-share-dialog.tsx with:
  a. Added QRCodeSVG import from qrcode.react
  b. Added tab toggle between "QR koda" and "Koda" tabs at top of dialog
  c. QR code tab: prominent 220x220px QR code with white background, rounded container, shadow
  d. "Skeniraj QR kodo" heading with "Načrtuj na PC, odpri na telefonu" subtitle
  e. Visual instruction section with PC→Phone emoji icons
  f. Visual divider between QR code and code sharing sections
  g. Compact share code display below QR section
  h. Added defaultTab prop to control which tab opens by default
  i. All existing functionality preserved in "Koda" tab
- Updated home.tsx:
  a. Added RouteShareDialog dynamic import
  b. Added planShareRouteId, planShareTitle, showPlanShare state
  c. Created sendToPhone callback that saves route then opens QR share dialog
  d. Passed onSendToPhone prop to PlanTab
  e. Added RouteShareDialog component render for plan share flow
- Updated plan-tab.tsx:
  a. Added onSendToPhone optional prop to PlanTabProps interface
  b. Added Smartphone icon import from lucide-react
  c. Added "Pošlji na telefon" button below "Shrani pot" button (visible when waypoints >= 2)
- Updated detail-dialog.tsx:
  a. Added QrCode icon import from lucide-react
  b. Added routeShareTab state to control which tab opens
  c. Added "QR" button (primary color) next to existing "Koda" button for routes
  d. Both buttons open RouteShareDialog with appropriate defaultTab
  e. RouteShareDialog now receives defaultTab prop

Stage Summary:
- Route share dialog now has dual-tab interface: "QR koda" (default) and "Koda"
- QR code displays share URL for PC→Phone scanning workflow
- "Pošlji na telefon" button in plan tab saves route and opens QR share dialog
- Detail dialog has dedicated "QR" button for quick QR code access
- All Slovenian language UI maintained throughout
- No TypeScript errors introduced in modified files
---
Task ID: 8
Agent: Main (QR Code + Stats + Tile Preloader)
Task: Implement QR code sharing, route tile pre-download, enhanced stats dashboard

Work Log:
- Installed qrcode.react@4.2.0 for QR code generation
- Enhanced route-share-dialog.tsx with QR code tab (QRCodeSVG, 220x220px)
- Added "📱 Pošlji na telefon" button in plan-tab.tsx
- Added QR button in detail-dialog.tsx for routes
- Created route-tile-preloader.tsx for pre-downloading tiles along route
- Added RouteTilePreloader to plan-tab.tsx (shows when 2+ waypoints)
- Created enhanced-stats-dashboard.tsx with 6 visual sections (summary, weekly, monthly, speed, top routes, records)
- Added EnhancedStatsDashboard to profile-tab.tsx
- Fixed TypeScript errors (Recharts formatter type mismatch)
- Updated README with new features and comparison table
- Pushed to GitHub (commit 5154005)

Stage Summary:
- QR code sharing for PC→Phone route transfer (key forum request)
- Route tile pre-download for offline use in mountains
- Enhanced statistics dashboard with charts
- All TypeScript errors in new files resolved
- README updated with 3 new comparison table rows and 4 new forum-driven improvements

---
Task ID: 11-12
Agent: Main
Task: Road hazard reporting + Mini elevation profile

Work Log:
- road-hazard-reporter.tsx created (14KB) - Waze-style hazard reporting
- 9 hazard types: landslide, construction, camera, ice, flood, animals, oil, pothole, other
- Quick report dialog with emoji buttons during tracking
- Nearby hazards display with distance calculation
- mini-elevation-profile.tsx created (8KB) - SVG live elevation profile
- Gradient fill, current position marker, ascent/descent stats
- Both components added to track-tab.tsx dynamically
- TypeScript and lint checks pass
- README updated with new features and comparison table
- Pushed to GitHub (commit 35e9c86)

Stage Summary:
- Hazard reporting system (Waze for motorcyclists) - key forum request
- Mini elevation profile during tracking - visual altitude changes
- All files pass TypeScript and lint checks

---
Task ID: 10
Agent: Main
Task: GPX export/import improvements with waypoints and metadata

Work Log:
- Rewrote /api/gpx/export/route.ts with full GPX 1.1 support
- Added wpt (waypoint) elements with symbols (Flag, Green/Red/Blue)
- Added rte (route) element with rtept points for route navigation
- Added MotoTrack XML namespace extensions (mt:type, mt:category, mt:difficulty, mt:distance, mt:shareCode)
- Added author, description, and time metadata
- Improved /api/gpx/import/route.ts to read MotoTrack extensions
- Import now preserves category and difficulty from MotoTrack exports
- Slovenian filenames in Content-Disposition header
- Pushed to GitHub (commit b2931bc)

Stage Summary:
- GPX export now fully compatible with REVER, Calimoto, Kurviger, OsmAnd
- Round-trip: export from MotoTrack → import to another app → re-import preserves metadata
- Waypoint symbols for visual distinction on GPS devices

---
Task ID: 3
Agent: GPS Tracking Reliability Engineer
Task: Enhance GPS tracking reliability for background/foreground transitions

Work Log:
- Read worklog.md to understand prior work (QR sharing, hazard reporting, GPX improvements)
- Read types.ts to verify TrackPoint type (alt: number | null) supports -9999 sentinel value
- Read home.tsx (full file) to understand existing GPS tracking implementation (lines 347-501)
- Added gpsReacquireIntervalRef and lastAltitudeRef refs for new tracking features
- Implemented periodic GPS re-acquisition: 30s interval checks lastGpsFixRef, calls getCurrentPosition() with high accuracy if no fix for 30s, shows toast "📡 Ponovna vzpostavitev GPS..."
- Changed watchPosition options: maximumAge from 3000 to 0 (freshest position only), timeout from 10000 to 15000 (more time for GPS fix)
- Implemented GPS gap interpolation: when >30s gap between consecutive track points, inserts a marker point with alt: -9999 to prevent "teleportation" lines on the map
- Implemented elevation tracking from GPS altitude: tracks positive altitude changes (climbing only) using lastAltitudeRef, updates trackElevation state
- Enhanced visibility change handler: on foreground return, immediately calls getCurrentPosition() for fresh GPS fix; calculates and displays time gap message "📡 Nazaj po 5 min — nadaljujem sledenje"
- Updated stopTracking to clean up gpsReacquireIntervalRef interval
- Updated saveRide to filter out gap marker points (alt: -9999) before saving track data
- Fixed distance calculation to skip gap marker points when computing haversine distance
- All lint checks pass for home.tsx (no new errors introduced)
- All UI text in Slovenian as required

Stage Summary:
- GPS tracking now reliably re-acquires position when watchPosition silently stops (common Android PWA issue)
- Background→foreground transition immediately gets fresh GPS fix and shows time gap notification
- GPS gap markers (alt: -9999) prevent "teleportation" lines on map; filtered out before saving
- Elevation tracking now uses real GPS altitude data (climbing only, not descending)
- watchPosition uses maximumAge: 0 for always-fresh positions and timeout: 15000 for better fix chances
- All existing functionality preserved (auto-pause, WakeLock, auto-save, GPS sanity checks)

---
Task ID: 2
Agent: Voice Nav + BT Helmet Bridge Engineer
Task: Bridge Voice Navigation with Bluetooth Helmet speaker routing

Work Log:
- Read worklog.md to understand prior work (QR sharing, hazard reporting, GPX improvements, GPS reliability)
- Read bluetooth-helmet.tsx to understand BT helmet implementation: exposes `window.__mototrack_bt_nav` function when connected with nav prompts enabled, volume stored in localStorage `mototrack_bt_volume`
- Read voice-navigation.tsx to understand standalone voice nav: browser TTS + AI TTS, no BT helmet awareness
- Read track-tab.tsx to understand inline voice navigation: standalone speakNav using synthRef, no BT check
- Created `src/hooks/use-bt-audio.ts` shared hook:
  a. Checks `window.__mototrack_bt_nav` for connected BT helmet (polls every 2s)
  b. Returns `speak(text)` function that routes through BT helmet when connected, falls back to browser speechSynthesis
  c. Returns `isConnected` boolean and `volume` (from localStorage)
  d. Uses lazy initializer for volume state (avoids cascading render lint error)
  e. Declares global Window type for `__mototrack_bt_nav`
  f. Fully backward compatible - if no BT helmet, works identically to before
- Updated `src/components/tabs/track-tab.tsx`:
  a. Added Headphones import from lucide-react
  b. Imported useBtAudio hook
  c. Removed synthRef and its useEffect initializer (now handled by useBtAudio)
  d. Replaced speakNav callback to use btSpeak from useBtAudio instead of synthRef.current.speak()
  e. Added BT indicator badge (Headphones icon + "BT" text) next to voice toggle button in nav banner, visible only when BT helmet is connected
- Updated `src/components/voice-navigation.tsx`:
  a. Added Headphones import from lucide-react
  b. Imported useBtAudio hook
  c. Removed synthRef and its useEffect initializer
  d. Updated speakBrowser to check btConnected first: if connected, delegates to btSpeak; otherwise uses window.speechSynthesis directly
  e. Added BT indicator badge (Headphones icon + "BT" text) in header section next to "Navigacija" label, visible only when BT helmet is connected
- All three modified files pass lint with zero new errors
- All UI text in Slovenian as required

Stage Summary:
- Shared `useBtAudio` hook created at `src/hooks/use-bt-audio.ts` - single source of truth for BT audio routing
- Track tab inline voice navigation now routes through BT helmet when connected (was phone-only before)
- Voice navigation component now routes through BT helmet when connected (was phone-only before)
- Small BT indicator badge (🎧 + "BT") appears in both nav UIs when helmet is connected
- Fully backward compatible - no BT helmet = everything works exactly as before
- No lint errors introduced in any modified files
