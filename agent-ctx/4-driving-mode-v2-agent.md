# Task ID: 4 - Driving Mode v2 Upgrade

## Agent: Driving Mode v2 Upgrade Engineer

## Task: Upgrade Driving Mode with compass, ETA, road name, speed trend, and improved UX

## Summary of Changes

### Modified Files
1. `src/components/driving-mode.tsx` - Main Driving Mode component (5 new features)
2. `src/components/tabs/track-tab.tsx` - Pass new props to DrivingMode

### New Features Added to Driving Mode

1. **Compass Heading Indicator** (top-center)
   - DeviceOrientationEvent API with iOS 13+ permission request
   - Circular compass with rotating N/S/E/W markers (Slovenian: S/J/V/Z)
   - Heading display in degrees + cardinal direction
   - GPS heading fallback

2. **ETA to Destination**
   - Shows "Prihod HH:MM" when navigation is active
   - Calculated from current speed + remaining distance
   - Remaining distance shown in parentheses

3. **Current Road Name**
   - Shows nav step's `name` property below speed
   - Small muted text, no placeholder when unavailable

4. **Speed Trend Indicator**
   - TrendingUp (amber) / TrendingDown (red) / Minus (emerald)
   - Tracks last 3 speed readings for trend detection
   - Only visible above 5 km/h

5. **Improved Bottom Bar**
   - Start/Stop Track toggle button
   - Duration display in compact format
   - Larger hazard button (size-[72px] was size-16)

### Props Added to DrivingMode
- `navRoadName?: string`
- `navRemainingDistance?: number`
- `onStartStopTrack?: () => void`

### Track Tab Changes
- Added `navRemainingDistance` computed value (sum of remaining step distances)
- Passes `navRoadName`, `navRemainingDistance`, `onStartStopTrack` to DrivingMode

### Lint Status
- Zero errors in modified files
- Pre-existing errors in other files unchanged
