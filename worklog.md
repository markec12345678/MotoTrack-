---
Task ID: 8
Agent: QR Code Route Sharing
Task: Add QR code to route sharing dialog for PC→Phone transfer

Work Log:
- Read existing route-share-dialog.tsx to understand current share dialog implementation (share code, URL, native share, clipboard copy)
- Read detail-dialog.tsx to understand how RouteShareDialog is integrated (used for route sharing with Hash button)
- Read home.tsx to understand PlanTab props, saveRoute function, and component structure
- Read plan-tab.tsx to find the "Shrani pot" button location for adding "Send to Phone" button
- Read /api/routes/route.ts to verify POST response includes route ID for share dialog
- Enhanced route-share-dialog.tsx with:
  a. Added QRCodeSVG import from qrcode.react
  b. Added tab toggle between "QR koda" and "Koda" tabs at top of dialog
  c. QR code tab: prominent 220x220px QR code with white background, rounded container, shadow
  d. "Skeniraj QR kodo" heading with "Načrtuj na PC, odpri na telefonu" subtitle
  e. Visual instruction section with PC→Phone emoji icons
  f. Visual divider between QR code and code sharing sections
  g. Compact share code display below QR section
  h. Added defaultTab prop to control which tab opens by default
  i. All existing functionality preserved in "Koda" tab
- Updated home.tsx:
  a. Added RouteShareDialog dynamic import
  b. Added planShareRouteId, planShareTitle, showPlanShare state
  c. Created sendToPhone callback that saves route then opens QR share dialog
  d. Passed onSendToPhone prop to PlanTab
  e. Added RouteShareDialog component render for plan share flow
- Updated plan-tab.tsx:
  a. Added onSendToPhone optional prop to PlanTabProps interface
  b. Added Smartphone icon import from lucide-react
  c. Added "Pošlji na telefon" button below "Shrani pot" button (visible when waypoints >= 2)
- Updated detail-dialog.tsx:
  a. Added QrCode icon import from lucide-react
  b. Added routeShareTab state to control which tab opens
  c. Added "QR" button (primary color) next to existing "Koda" button for routes
  d. Both buttons open RouteShareDialog with appropriate defaultTab
  e. RouteShareDialog now receives defaultTab prop

Stage Summary:
- Route share dialog now has dual-tab interface: "QR koda" (default) and "Koda"
- QR code displays share URL for PC→Phone scanning workflow
- "Pošlji na telefon" button in plan tab saves route and opens QR share dialog
- Detail dialog has dedicated "QR" button for quick QR code access
- All Slovenian language UI maintained throughout
- No TypeScript errors introduced in modified files
