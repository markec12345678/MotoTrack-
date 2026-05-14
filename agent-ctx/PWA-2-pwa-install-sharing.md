# PWA-2 - PWA Install Prompt & Sharing Feature Implementer

## Task
Create PWA install prompt banner and app sharing component, integrate into page.tsx

## Work Completed

### 1. Created `/src/components/pwa-install-prompt.tsx`
- Detects `beforeinstallprompt` browser event for PWA installability
- Shows install banner with 3-second delay (non-aggressive UX)
- Respects 7-day dismissal period via localStorage
- Checks `display-mode: standalone` to detect already-installed state
- Fixed lint error: moved `isInstalled` check to `useState` initializer (avoids setState-in-effect)
- UI: fixed bottom-20 banner with Smartphone icon, install/dismiss buttons, all Slovenian labels

### 2. Created `/src/components/app-share-button.tsx`
- Supports native Web Share API (mobile) with Dialog fallback
- QR code generation via api.qrserver.com
- Copy link to clipboard with toast feedback
- Share via WhatsApp, Email, SMS with platform-specific URLs
- Installation instructions section (Android, iPhone, Desktop)
- All Slovenian labels (Deli MotoTrack, Prikaži QR kodo, Kako namestiti)

### 3. Integrated into page.tsx
- Added dynamic imports for both components with `ssr: false`
- `PwaInstallPrompt` placed before Bottom Nav (z-[1600] above nav z-[1500])
- `AppShareButton` placed in header next to NotificationBell and theme toggle

## Verification
- ESLint: 0 errors, 0 warnings
- Dev server: HTTP 200 OK
- All existing functionality preserved
