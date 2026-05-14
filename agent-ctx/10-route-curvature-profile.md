# Task 10: Route Curvature Profiles

## Agent: Route Curvature Profiles Implementer

## Summary
Added a visual curvature profile feature to the Plan Tab — similar to Calimoto's curvature indicator. Shows a color-coded ribbon and statistics for route curviness.

## Changes Made

### File Modified: `src/components/tabs/plan-tab.tsx`

1. **Icon imports**: Added `Activity` and `BarChart3` from lucide-react

2. **`calculateCurvature()` function** (line ~184):
   - Computes turn angle at waypoint B for triplet A-B-C
   - Uses `atan2(cross_product, dot_product)` formula
   - Returns angle in degrees

3. **`CurvatureSegment` interface** (line ~194):
   - index, angle, distance, color, label

4. **`calculateCurvatureProfile()` function** (line ~203):
   - Iterates through waypoint triplets
   - Classifies: green (0-15°), amber (15-45°), red (45°+)
   - Returns segments array, totalDistance, straightPct, moderatePct, tightPct, twistinessScore

5. **`CurvatureProfile` component** (line ~568):
   - Curvature ribbon (horizontal color strip)
   - Summary stats (distance + twistiness score)
   - Percentage progress bars
   - Toggle for detailed breakdown

6. **Inserted in single-day mode**: After distance display, before save button
7. **Inserted in round-trip mode**: After route name input, before save button

## Key Design Decisions
- Purely client-side calculation (no API routes needed)
- Appears only when 2+ waypoints exist
- Mobile-first compact design
- Slovenian labels throughout
- Color scheme: green (#22c55e), amber (#f59e0b), red (#ef4444)

## Lint Result
0 new errors, 2 pre-existing warnings in unrelated files
