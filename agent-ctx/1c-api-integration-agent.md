# Task 1c - Fix Lean Angle Display and Fuel Price Card to call their APIs

## Summary

Both components were using hardcoded mock data instead of calling their respective APIs. This task replaced the mock data with real API calls and fixed several issues.

## Changes Made

### 1. `/home/z/my-project/src/components/lean-angle-display.tsx`
- **Removed MOCK_SESSIONS** (3 hardcoded sessions) → replaced with `useState<LeanAngleSession[]>([])`
- **Added API fetch on mount**: `fetchSessions()` calls `GET /api/lean-angle?userId=xxx`
- **Fixed infinite render loop**: Replaced the `useEffect` that depended on `displayAngle` and called `setDisplayAngle` with a `requestAnimationFrame`-based animation loop using `useRef` for the target angle
- **Added DeviceOrientationEvent integration**: Listens to `deviceorientation` event, calculates lean from gamma, handles iOS 13+ permission request
- **Added start/stop measuring controls**: "Začni merjenje" / "Ustavi merjenje" buttons
- **Added session saving**: On stop, calls `POST /api/lean-angle` with maxLeanLeft, maxLeanRight, avgLean, dataPoints (JSON), duration
- **Added props**: `userId` and `isTracking`
- **Kept existing SVG gauge** (LeanGauge component unchanged)

### 2. `/home/z/my-project/src/components/fuel-price-card.tsx`
- **Removed MOCK_STATIONS** (7 hardcoded stations) → replaced with `useState<FuelStation[]>([])`
- **Added API fetch**: `fetchStations()` calls `GET /api/fuel-prices?lat=xxx&lng=xxx&fuelType=xxx&radius=50`
- **Geolocation on mount**: Gets user position for accurate nearby station search
- **Fuel type selector calls API**: Re-fetches when fuel type changes (uses `useRef` to skip initial render since mount effect handles it)
- **Sort functionality**: Works with both price (default) and distance using `useMemo`
- **Replaced fake search**: Removed `setTimeout` that reset to mock data; now filters real API results by name, address, brand
- **Added "Locate me" button**: Refetches with current GPS position
- **Added loading spinner and empty states**
- **Added `userId` prop** (for future use)
- **Kept existing visual design and layout**

### 3. `/home/z/my-project/src/components/tabs/track-tab.tsx`
- Updated `LeanAngleDisplay` call to pass `userId={userId} isTracking={isTracking}` props

## Verification
- Lint: 0 errors, 0 warnings
- Dev server running successfully on port 3000
- All existing APIs verified working
