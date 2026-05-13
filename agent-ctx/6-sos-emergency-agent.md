# Task 6 - SOS Emergency Agent

## Summary
Implemented the SOS Emergency feature for the MotoTrack motorcycle app, including Prisma schema updates, API routes, SOS floating button, and ICE contacts in the profile tab.

## Files Modified
- `prisma/schema.prisma` — Added ICE fields (iceName1, icePhone1, iceName2, icePhone2, bloodType, allergies) to User model and SosAlert model with index
- `src/components/tabs/types.ts` — Added SosAlertData and EmergencyContactsData interfaces
- `src/components/tabs/profile-tab.tsx` — Added ICE Contacts card with contact inputs, blood type selector, allergies input, and save button
- `src/app/page.tsx` — Added SosButton component import and rendering

## Files Created
- `src/app/api/sos/route.ts` — GET (list alerts) + POST (create alert with emergency info)
- `src/app/api/sos/[id]/route.ts` — PUT (update alert status to resolved/false_alarm)
- `src/app/api/emergency-contacts/route.ts` — GET (fetch ICE contacts) + PUT (save ICE contacts)
- `src/components/sos-button.tsx` — Floating SOS button with confirmation dialog, long-press instant SOS, active alert panel

## Key Design Decisions
- SOS button positioned at `bottom-36 right-4` (above chat button at `bottom-20 right-4`)
- Long-press (3s) triggers instant SOS without confirmation dialog for emergency situations
- Active alert panel shows countdown timer, location, medical info, ICE contacts with call links, nearest help
- Nearest help calculated via haversine distance from mechanic POIs in the database
- ICE contacts saved to User model directly (not separate model) for simplicity
- Blood type uses Select dropdown with 8 standard types
- All UI text in Slovenian
