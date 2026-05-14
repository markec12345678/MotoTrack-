---
Task ID: 1
Agent: Main
Task: Implement missing REVER free-tier features in MotoTrack

Work Log:
- Updated Prisma schema with new User settings fields (unitSystem, autoPauseEnabled, autoPauseSpeedThreshold, hideStartEnd, wakelockEnabled, avoidTolls) and PrivacyZone model
- Ran `bun run db:push` to sync database
- Created `/api/settings` API endpoint (GET + PUT) for user settings management
- Created `/api/privacy-zones` API endpoint (GET + POST + DELETE) for privacy zone CRUD
- Created `use-settings.ts` hook with:
  - Zustand store for global settings state
  - Unit conversion utilities (km/miles, kmh/mph, m/ft)
  - Format helpers (formatDistance, formatSpeed, formatElevation)
  - Privacy zone utilities (isInPrivacyZone, obfuscateCoordinate)
  - useFetchSettings hook to load settings from server
  - useWakeLock hook for WakeLock API integration
  - saveSettings helper function
- Updated page.tsx with:
  - Auto-pause logic in startTracking (5s below threshold = auto-pause, auto-resume when speed increases)
  - WakeLock integration via useWakeLock hook
  - Privacy zone obfuscation in saveRide (hide start/end, obfuscate points in zones)
  - New state: planAvoidTolls, planRoutingMode
  - New props passed to TrackTab (unitSystem, autoPauseEnabled, wakelockEnabled)
  - New props passed to PlanTab (avoidTolls, setAvoidTolls, routingMode, setRoutingMode)
  - New props passed to ProfileTab (unitSystem)
- Rewrote track-tab.tsx with:
  - Unit system display (km/miles switching in dashboard)
  - Auto-pause indicator badge on map
  - WakeLock "Screen ON" indicator
  - Speed limit badge shows converted units
- Updated plan-tab.tsx with:
  - New props: avoidTolls, setAvoidTolls, routingMode, setRoutingMode
  - Routing mode selector UI (Asfalt/Vijugasto/Terensko)
  - Toll avoidance toggle switch
  - Category options now include snowmobile and racetrack
- Updated types.ts with:
  - New category labels (snowmobile: 'Snežni skuter', racetrack: 'Dirkališče')
  - New category colors (cyan for snowmobile, red for racetrack)
- Updated explore-tab.tsx with:
  - snowmobile and racetrack filter options in category pills
  - snowmobile and racetrack options in group ride creation
- Updated profile-tab.tsx with:
  - New Collapsible Section 6: Nastavitve (Settings)
    - Unit system toggle (metric/imperial)
    - Auto-pause toggle with speed threshold slider
    - WakeLock toggle
    - Toll avoidance toggle
    - Save button
  - New Collapsible Section 7: Zasebnost (Privacy)
    - Hide start/end toggle
    - Privacy Zones CRUD (list, add via GPS, delete)
    - Radius slider for new zones
    - Save button

Stage Summary:
- All 7 missing REVER features implemented:
  ✅ Auto-pause (low speed detection + auto pause/resume)
  ✅ WakeLock API (prevent screen lock during ride)
  ✅ Units switching km/miles (with conversion across all displays)
  ✅ Privacy - hide start/end points
  ✅ Privacy Zones (geofencing with obfuscation)
  ✅ Off-Road routing mode + snowmobile/racetrack categories
  ✅ Toll avoidance option
- Lint passes clean
- Dev server running successfully
