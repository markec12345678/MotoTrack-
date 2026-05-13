# Task 2 - Friends System Agent

## Summary
Implemented the complete Friends System for the MotoTrack motorcycle app.

## Changes Made

### 1. Prisma Schema (`prisma/schema.prisma`)
- Added `Friendship` model with status tracking (pending/accepted/blocked)
- Added `requestedFriends` and `receivedFriends` relations to User model
- Unique constraint on [requesterId, addresseeId]

### 2. API Routes
- **`/api/friends/route.ts`**: GET (list friends with status filter) + POST (send friend request)
- **`/api/friends/[id]/route.ts`**: PUT (accept/reject) + DELETE (remove friendship)
- **Updated `/api/rides/route.ts`**: Added `friendIds` query param for fetching rides by multiple user IDs

### 3. Types (`src/components/tabs/types.ts`)
- Added `FriendshipData` interface

### 4. Explore Tab (`src/components/tabs/explore-tab.tsx`)
- Added "Prijatelji" (Friends) sub-tab as third tab
- Friend management UI: accepted friends, pending requests, add friend
- Search/filter functionality
- Slovenian UI text throughout

### 5. Map Integration
- **`src/components/moto-map.tsx`**: Added friendRides prop, friends layer, blue friend markers
- **`src/components/tabs/map-tab.tsx`**: Added friend rides toggle button, fetches friend rides on toggle

## Verification
- `bun run db:push` — successful
- `bun run lint` — passes with no errors
- All API routes follow existing patterns
- All UI text in Slovenian
