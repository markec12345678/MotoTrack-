# Task 11: Search Along Route Implementer

## Task
Add Search Along Route feature to the Plan Tab in MotoTrack app.

## What Was Done

### Files Modified
- `/home/z/my-project/src/components/tabs/plan-tab.tsx` — Added SearchAlongRoute component and integrated it into all 3 plan modes

### Implementation Details

1. **Imports Added**:
   - `Search` icon from `lucide-react`
   - `poiTypeEmoji`, `poiTypeColor`, `poiTypeLabel` from `@/components/tabs/types`
   - `PoiData` type from `@/components/tabs/types`

2. **Utility Functions Added**:
   - `pointToSegmentDistance(px, py, ax, ay, bx, by)` — Calculates approximate km distance from a point to a line segment using degree→km conversion
   - `minDistanceToRoute(poiLat, poiLng, routeWaypoints)` — Finds minimum distance from a POI to any segment of the route

3. **POI Search Types Constant**:
   - 7 POI types with Slovenian labels and emojis: ⛽ Bencinska črpalka, 🍽️ Restavracija, 🔧 Servis, 🏨 Hotel, 🅿️ Parkirišče, 🏍️ Moto srečanje, 📍 Vse

4. **SearchAlongRoute Component**:
   - POI type filter pills (rounded-full buttons)
   - Buffer distance slider (1-20 km, default 5 km)
   - Search button → fetches `/api/poi`, filters client-side by type and distance
   - Results: compact cards with emoji, name, color-coded type badge, distance badge (green ≤2km, amber ≤5km, red >5km)
   - Count badge: "Najdenih: X POI-jev"
   - Empty state: "Brez rezultatov"
   - Only renders when waypoints.length >= 2

5. **Integration in All 3 Modes**:
   - Single mode: After WeatherAlongRoute in Napredna orodja section
   - Roundtrip mode: After save button, uses `rtWaypoints` if available, else `waypoints`
   - Multi-day mode: Before saved trips, uses `tripDays[activeDay].waypoints` if available, else `waypoints`

### Quality Checks
- ESLint: 0 new errors
- TypeScript: 0 errors in plan-tab.tsx
- No new files created
- All existing functionality preserved
