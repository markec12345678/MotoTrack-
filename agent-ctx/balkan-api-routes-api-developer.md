# Task: Balkan API Routes Implementation

## Agent: API Routes Developer
## Task ID: balkan-api-routes
## Status: COMPLETED

## Summary
Created 7 API route files for the MotoTrack Balkan motorcycle features.

## Files Created

1. **`/src/app/api/events/route.ts`** - Balkan Moto Events API
   - GET: Fetch events with filters (country, category, upcoming, limit)
   - POST: Create new event (title, description, date, endDate, lat, lng, location, country, category, website, organizerName, contactEmail, createdBy)

2. **`/src/app/api/events/[id]/route.ts`** - Single Event API
   - GET: Fetch single event by ID
   - DELETE: Delete event by ID (with existence check)

3. **`/src/app/api/camps/route.ts`** - Balkan Camp Sites API
   - GET: Fetch camp sites with filters (country, lat/lng with haversine distance, radius, limit)
   - POST: Create new camp site (name, description, lat, lng, country, address, phone, website, email, rating, priceRange, amenities, motoFriendly, openSeason)

4. **`/src/app/api/camps/[id]/route.ts`** - Single Camp Site API
   - GET: Fetch single camp site by ID (with amenities JSON parsing)

5. **`/src/app/api/weather-alerts/route.ts`** - Weather Alerts API
   - GET: Fetch weather alerts using Open-Meteo API
   - Checks: wind > 60 km/h (storm), precipitation > 10mm (heavy rain), temp < 0 (ice), WMO thunderstorm codes
   - Returns severity levels: warning, danger, extreme
   - Includes current conditions in response

6. **`/src/app/api/gpx/export-pdf/route.ts`** - PDF Export API
   - GET: Generate PDF for a route using jsPDF
   - Includes: route title, description, stats, waypoint table, route map sketch, QR code placeholder
   - Returns PDF as downloadable file

7. **`/src/app/api/balkan-roads/route.ts`** - Balkan Motorcycle Roads API
   - GET: Fetch curated roads with filters (country, difficulty)
   - 35 hardcoded roads across 12 countries: SI, HR, BA, ME, RS, MK, AL, GR, BG, RO, HU, AT
   - Each road: id, name, description, lat, lng, difficulty, roadType, lengthKm, country, rating

## Technical Details
- All routes use `export const dynamic = 'force-dynamic'`
- All routes use `import { db } from '@/lib/db'` for database access
- Follows existing project patterns (NextRequest/NextResponse, params as Promise)
- Proper TypeScript typing and error handling throughout
- Lint passes cleanly, database schema is already in sync
