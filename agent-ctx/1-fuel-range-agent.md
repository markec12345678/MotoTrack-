# Fuel Range Indicator - Task 1

## Summary
Implemented the Fuel Range Indicator feature for the MotoTrack motorcycle app.

## Changes Made

### 1. Prisma Schema (`prisma/schema.prisma`)
- Added 4 fields to User model: `fuelCapacity` (Float?, default 15.0), `fuelConsumption` (Float?, default 5.5), `currentFuel` (Float?, default 15.0), `lastRefuelAt` (DateTime?)

### 2. Types (`src/components/tabs/types.ts`)
- Added `FuelData` interface with fields: fuelCapacity, fuelConsumption, currentFuel, range, lastRefuelAt

### 3. API Route (`src/app/api/fuel/route.ts`)
- GET: Returns user fuel settings + calculated range (currentFuel / fuelConsumption * 100 km)
- POST: Updates fuel settings, sets lastRefuelAt when tank is filled to capacity

### 4. Map Component (`src/components/moto-map.tsx`)
- Added props: `fuelRange`, `fuelCenter`
- Draws orange circle (L.circle) with fuelRange radius when both props provided
- Center label with "⛽ X km" text
- Proper cleanup on unmount and prop changes

### 5. Map Tab (`src/components/tabs/map-tab.tsx`)
- Added Fuel button in toolbar (orange when active)
- Fuel panel with slider, capacity/consumption inputs, fill tank button
- Fetches/saves fuel data via /api/fuel
- Passes fuelRange and fuelCenter to MotoMap
- All UI text in Slovenian

### 6. Bug Fix
- Fixed pre-existing lint error in notification-bell.tsx (setState in effect body)

## Status
- All lint checks pass
- Database schema synced via db:push
- No test code written (as per instructions)
