# Task 7: Balkan Roads Polyline Enhancement

## Summary
Enhanced the Balkan motorcycle roads overlay in `/home/z/my-project/src/components/moto-map.tsx` to show actual route polylines instead of just circle markers, similar to Butler Maps in REVER.

## Changes Made

### 1. New `balkanRoadsLayerRef` (dedicated layer)
- Added `const balkanRoadsLayerRef = useRef<L.LayerGroup | null>(null)` at line 231
- Initialized as `L.layerGroup().addTo(map)` in the map init useEffect
- Cleanup added in the map init cleanup function
- This separates Balkan roads from the general `overlays` layer, preventing conflicts when twisty roads/hazards toggle clears the overlays layer

### 2. Replaced Balkan roads useEffect (was lines 583-660)
- Old: Only drew circle markers at road locations
- New: Draws thick colored POLYLINES tracing actual road paths with:
  - 21 detailed route coordinate sets across 8 countries
  - Difficulty-based color coding and line weights:
    - easy: green (#22c55e), 4px
    - moderate: amber (#f59e0b), 5px
    - challenging: orange (#f97316), 6px
    - extreme: red (#ef4444), 7px + glow (14px translucent underlay at 0.3 opacity)
  - Circle markers at road start points
  - Rich popups with name, difficulty label, country badge, and length

### 3. Legend overlay in return JSX
- Added a floating legend at the bottom of the map when `showBalkanRoads` is true
- Shows all 4 difficulty levels with colored line samples matching the polyline weights
- Uses responsive styling with backdrop blur and dark mode support

### 4. Layer isolation
- The hazards useEffect and twisty roads useEffect clear `layersRef.current.overlays`
- Balkan roads are now on `balkanRoadsLayerRef` which is never cleared by those effects
- This eliminates the conflict where toggling hazards/twisty roads would wipe out Balkan road markers

## Files Modified
- `/home/z/my-project/src/components/moto-map.tsx`
- `/home/z/my-project/worklog.md`
