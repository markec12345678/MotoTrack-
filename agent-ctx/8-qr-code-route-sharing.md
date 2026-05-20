---
Task ID: 8
Agent: QR Code Route Sharing
Task: Add QR code to route sharing dialog for PC→Phone transfer

Files Modified:
1. /home/z/my-project/src/components/route-share-dialog.tsx - Complete rewrite with QR code tabs
2. /home/z/my-project/src/components/home.tsx - Added sendToPhone, plan share state, RouteShareDialog
3. /home/z/my-project/src/components/tabs/plan-tab.tsx - Added onSendToPhone prop and "Pošlji na telefon" button
4. /home/z/my-project/src/components/tabs/detail-dialog.tsx - Added QR button and routeShareTab state

Key Implementation Details:
- QR code uses QRCodeSVG from qrcode.react (already installed as qrcode.react@4.2.0)
- Share URL format: ${window.location.origin}?route=${shareCode}
- Tab toggle between "QR koda" (default) and "Koda" at top of dialog
- QR code is 220x220px with white background and rounded corners
- "Skeniraj QR kodo" heading with "Načrtuj na PC, odpri na telefonu" subtitle
- "Pošlji na telefon" button in plan tab saves route first, then opens QR share dialog
- Detail dialog has separate "QR" and "Koda" buttons that open RouteShareDialog with different default tabs
