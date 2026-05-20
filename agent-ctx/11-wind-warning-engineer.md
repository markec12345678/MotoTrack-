# Task 11: Wind Warning System Engineer

## Work Summary
Created a comprehensive wind monitoring and warning system for motorcyclists in MotoTrack.

## Files Created
- `src/components/wind-warning-panel.tsx` — Main Wind Warning Panel component

## Files Modified
- `src/components/tabs/track-tab.tsx` — Added WindWarningPanel dynamic import and floating overlay (bottom-left on map)
- `src/components/driving-mode.tsx` — Added WindWarningPanel compact mode below weather overlay

## Key Features
1. **Crosswind Calculation**: wind_speed × |sin(windDir - heading)| with headwind/tailwind/crosswind decomposition
2. **4-Level Warning System**:
   - 🟢 LOW: crosswind < 20 km/h — "Nizka"
   - 🟡 MODERATE: crosswind 20-40 km/h — "Zmeren bočni veter — previdno!"
   - 🟠 STRONG: crosswind 40-60 km/h — "Močan bočni veter — ZMANJŠAJ HITROST!"
   - 🔴 DANGEROUS: crosswind > 60 km/h — "NEVAREN BOČNI VETER — USTAVI SE!"
3. **Audio Alert**: 880Hz beep via Web Audio API when crosswind > 40 km/h
4. **Visual Flash Overlay**: Red flash in Driving Mode when crosswind > 60 km/h
5. **Bridge/Overpass Warning**: "MOST — povečan veter!" when wind > 30 km/h
6. **Wind Direction Arrow**: Rotates based on wind direction vs rider heading
7. **Wind Type Labels**: "Sprednji" (Headwind), "Zadnji" (Tailwind), "Bočni" (Crosswind)
8. **Wind Forecast**: 3-day max wind speeds from Open-Meteo API
9. **Auto-refresh**: Every 10 minutes during tracking
10. **Compact Mode**: Only shows when crosswind > 20 km/h in Driving Mode

## Lint Status
- 0 errors in wind-warning-panel.tsx, track-tab.tsx, driving-mode.tsx
