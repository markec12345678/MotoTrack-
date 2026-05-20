# Task 7: Photo Gallery Integration Developer

## Task: Integrate RidePhotoGallery into Track Tab and Detail Dialog

### Files Modified:
1. `src/components/tabs/track-tab.tsx` - Added RidePhotoGallery during tracking (compact PhotoButton + expandable panel) and after ride stop (collapsible section)
2. `src/components/tabs/detail-dialog.tsx` - Added RidePhotoGallery in ride details section (rides only)
3. `src/components/tabs/plan-tab.tsx` - Added RidePhotoGallery for saved routes (savedRouteId prop)
4. `src/components/home.tsx` - Passed savedRouteId={planShareRouteId} to PlanTab

### Key Changes:
- Dynamic imports with ssr: false for all RidePhotoGallery instances
- Camera icon added to lucide imports where needed
- showPhotoGallery + photoCount state for track-tab
- savedRouteId optional prop added to PlanTabProps
- All text in Slovenian

### Lint Status: 0 errors, 12 pre-existing warnings only
