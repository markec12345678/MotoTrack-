'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouteDeviation } from '@/components/route-deviation-alert'
import { useSpeedCameraAlert, SpeedCameraFloatingAlert } from '@/components/speed-camera-alerts'
import {
  Map as MapIcon,
  Route,
  Play,
  Compass,
  User,
  Bike,
  Sun,
  Moon,
  Sparkles,
  Search,
  Mic,
  Activity,
  Download,
  Film,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

import type { TabId, RideData, RouteData, UserData, CommentData, WeatherData, LeaderboardUser, TrackPoint } from '@/components/tabs/types'
const HeaderDrawer = dynamic(withRetry(() => import('@/components/header-drawer')), { ssr: false, loading: () => null })
import { haversine, formatDuration, formatDate, categoryLabel, categoryColor } from '@/components/tabs/types'
import { useSettingsStore, useFetchSettings, useWakeLock, isInPrivacyZone, obfuscateCoordinate, type UnitSystem } from '@/hooks/use-settings'
import { useTracking } from '@/hooks/use-tracking'
import { usePlanRoute } from '@/hooks/use-plan-route'
import { useAppData } from '@/hooks/use-app-data'

// Retry wrapper for dynamic imports to handle ChunkLoadError
function withRetry<T>(importFn: () => Promise<T>, retries = 3, delay = 500): () => Promise<T> {
  return async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await importFn()
      } catch (err) {
        if (i === retries - 1) throw err
        // Wait before retrying
        await new Promise(r => setTimeout(r, delay * (i + 1)))
      }
    }
    throw new Error('Failed to load component')
  }
}

const DynamicLoading = () => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-muted-foreground">Nalaganje...</span>
    </div>
  </div>
)

// Lazy load heavy tab components with retry and loading states
const MapTab = dynamic(withRetry(() => import('@/components/tabs/map-tab')), { ssr: false, loading: DynamicLoading })
const PlanTab = dynamic(withRetry(() => import('@/components/tabs/plan-tab')), { ssr: false, loading: DynamicLoading })
const TrackTab = dynamic(withRetry(() => import('@/components/tabs/track-tab')), { ssr: false, loading: DynamicLoading })
const ExploreTab = dynamic(withRetry(() => import('@/components/tabs/explore-tab')), { ssr: false, loading: DynamicLoading })
const ProfileTab = dynamic(withRetry(() => import('@/components/tabs/profile-tab')), { ssr: false, loading: DynamicLoading })
const MotoChat = dynamic(withRetry(() => import('@/components/moto-chat')), { ssr: false, loading: () => null })
const DetailDialog = dynamic(withRetry(() => import('@/components/tabs/detail-dialog')), { ssr: false, loading: () => null })
const NotificationBell = dynamic(withRetry(() => import('@/components/notification-bell')), { ssr: false, loading: () => null })
const SosButton = dynamic(withRetry(() => import('@/components/sos-button')), { ssr: false, loading: () => null })
const PwaInstallPrompt = dynamic(withRetry(() => import('@/components/pwa-install-prompt').then(m => ({ default: m.PwaInstallPrompt }))), { ssr: false, loading: () => null })
const ChatBubble = dynamic(withRetry(() => import('@/components/group-ride-chat').then(m => ({ default: m.ChatBubble }))), { ssr: false, loading: () => null })
const RouteDeviationAlert = dynamic(withRetry(() => import('@/components/route-deviation-alert').then(m => ({ default: m.RouteDeviationAlert }))), { ssr: false, loading: () => null })
const RouteDeviationIndicator = dynamic(withRetry(() => import('@/components/route-deviation-alert').then(m => ({ default: m.RouteDeviationIndicator }))), { ssr: false, loading: () => null })
const AppShareButton = dynamic(withRetry(() => import('@/components/app-share-button').then(m => ({ default: m.AppShareButton }))), { ssr: false, loading: () => null })
// Feature Hub - loaded as a single chunk only when user opens it
const FeatureHubDialog = dynamic(withRetry(() => import('@/components/feature-hub-dialog')), { ssr: false, loading: () => null })
const GlobalSearch = dynamic(withRetry(() => import('@/components/global-search')), { ssr: false, loading: () => null })
const NightModeToggle = dynamic(withRetry(() => import('@/components/night-mode-toggle')), { ssr: false, loading: () => null })
const RouteShareDialog = dynamic(withRetry(() => import('@/components/route-share-dialog')), { ssr: false, loading: () => null })
const CarPlayMode = dynamic(withRetry(() => import('@/components/carplay-mode')), { ssr: false, loading: () => null })
const ParkingSpotPanel = dynamic(withRetry(() => import('@/components/parking-spot').then(m => ({ default: m.ParkingSpotPanel }))), { ssr: false, loading: () => null })
const ParkingMapIndicator = dynamic(withRetry(() => import('@/components/parking-spot').then(m => ({ default: m.ParkingMapIndicator }))), { ssr: false, loading: () => null })
const ParkingSavePrompt = dynamic(withRetry(() => import('@/components/parking-spot').then(m => ({ default: m.ParkingSavePrompt }))), { ssr: false, loading: () => null })
const BorderGuide = dynamic(withRetry(() => import('@/components/border-guide')), { ssr: false, loading: () => null })
const VoiceCommands = dynamic(withRetry(() => import('@/components/voice-commands')), { ssr: false, loading: () => null })
const TwistinessHeatmap = dynamic(withRetry(() => import('@/components/twistiness-heatmap')), { ssr: false, loading: () => null })
const AutoThemeIndicator = dynamic(withRetry(() => import('@/components/auto-theme').then(m => ({ default: m.AutoThemeIndicator }))), { ssr: false, loading: () => null })
const AutoThemeSettings = dynamic(withRetry(() => import('@/components/auto-theme').then(m => ({ default: m.AutoThemeSettings }))), { ssr: false, loading: () => null })
const ExportPanel = dynamic(withRetry(() => import('@/components/export-panel')), { ssr: false, loading: () => null })
const RouteSimulator = dynamic(withRetry(() => import('@/components/route-simulator')), { ssr: false, loading: () => null })

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'map', label: 'Zemljevid', icon: MapIcon },
  { id: 'plan', label: 'Načrtuj', icon: Route },
  { id: 'track', label: 'Sledi', icon: Play },
  { id: 'explore', label: 'Raziskuj', icon: Compass },
  { id: 'profile', label: 'Profil', icon: User },
]

// Shared loading skeleton — used by both Suspense fallback and Home loading state
// to prevent hydration mismatch (server and client must render identical HTML)
function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header skeleton - matches premium header */}
      <header className="fixed top-0 left-0 right-0 z-[1400] h-16 header-frosted">
        <div className="flex items-center gap-3 flex-1 h-full px-4 sm:px-5">
          <div className="relative flex items-center justify-center size-11 rounded-2xl bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/30">
            <Bike className="size-5 text-white" strokeWidth={2.5} />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-black text-base tracking-tight logo-gradient leading-none">MotoTrack</span>
            <span className="text-[9px] text-primary/60 uppercase tracking-[0.18em] font-semibold leading-tight">GPS Sledenje</span>
          </div>
        </div>
      </header>
      <div className="fixed top-16 left-0 right-0 z-[1400] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <main className="flex-1 pt-20 pb-[72px] sm:pb-[80px] px-4 max-w-lg mx-auto w-full">
        <div className="py-6 space-y-5">
          <Skeleton className="w-full h-52 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </main>

      {/* Bottom nav skeleton - matches premium nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1500]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="nav-premium">
          <div className="flex items-end justify-around max-w-lg mx-auto h-[72px] relative">
            {[1,2,4,5].map(i => (
              <div key={i} className="flex flex-col items-center gap-1 px-3 sm:px-5 pb-2 pt-3">
                <Skeleton className="size-5 rounded bg-muted/50" />
                <Skeleton className="h-2 w-8 bg-muted/50" />
              </div>
            ))}
            <div className="relative -mt-5 flex flex-col items-center">
              <Skeleton className="w-14 h-14 rounded-2xl bg-muted/50" />
              <Skeleton className="h-2 w-8 mt-1 bg-muted/50" />
            </div>
          </div>
        </div>
      </nav>
    </div>
  )
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ─── Domain Hooks (extracted from God Component) ──────────────
  const { settings, privacyZones } = useSettingsStore()

  // Active tab — declared early because hooks depend on it
  const [activeTab, setActiveTab] = useState<TabId>('map')
  
  // App data (user, rides, routes, leaderboard)
  const { 
    rides, routes, user, allUsers, leaderboard, loading,
    fetchData, switchUser, toggleLike
  } = useAppData()

  // Plan route state
  const {
    planWaypoints, setPlanWaypoints,
    planTitle, setPlanTitle,
    planCategory, setPlanCategory,
    planAvoidHighways, setPlanAvoidHighways,
    planAvoidTolls, setPlanAvoidTolls,
    planRoutingMode, setPlanRoutingMode,
    planDistance,
    showPlanShare, setShowPlanShare,
    planShareRouteId, setPlanShareRouteId,
    planShareTitle,
    saveRoute, sendToPhone, handleMapClick, loadTourToPlan, loadSharedRoute,
  } = usePlanRoute({ userId: user?.id, onRouteSaved: fetchData, activeTab: activeTab })

  // GPS Tracking state
  const {
    isTracking, isPaused, currentRideId, trackPoints,
    trackDuration, trackDistance, trackMaxSpeed, trackCurrentSpeed,
    trackElevation, gpsAccuracy, currentPos,
    autoStartEnabled, autoStartCountdown,
    startTracking, pauseTracking, resumeTracking, stopTracking, saveRide,
    toggleAutoStart,
  } = useTracking({ 
    onRideSaved: () => { fetchData(); setShowParkingPrompt(true); setTimeout(() => setShowParkingPrompt(false), 8000) },
    userId: user?.id,
    isActiveTabTrack: activeTab === 'track',
  })

  // Fetch settings from server
  useFetchSettings(user?.id)
  useWakeLock(settings.wakelockEnabled, isTracking)

  // ─── Remaining UI state (kept here — purely UI concerns) ───────
  const [deviationDismissed, setDeviationDismissed] = useState(false)
  const [userLat, setUserLat] = useState<number | undefined>()
  const [userLng, setUserLng] = useState<number | undefined>()
  const [cameraDismissed, setCameraDismissed] = useState(false)
  const [selectedItem, setSelectedItem] = useState<RideData | RouteData | null>(null)
  const [selectedType, setSelectedType] = useState<'ride' | 'route'>('ride')
  const [detailOpen, setDetailOpen] = useState(false)
  const [featureOpen, setFeatureOpen] = useState(false)
  const [exploreFullscreen, setExploreFullscreen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [headerDrawerOpen, setHeaderDrawerOpen] = useState(false)
  const [nightMode, setNightMode] = useState(false)
  const [carplayMode, setCarplayMode] = useState(false)
  const [showParkingPanel, setShowParkingPanel] = useState(false)
  const [showParkingPrompt, setShowParkingPrompt] = useState(false)
  const [showBorderGuide, setShowBorderGuide] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [showTwistiness, setShowTwistiness] = useState(false)
  const [autoThemeEnabled, setAutoThemeEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('mototrack_autotheme') === 'true' } catch { return false }
    }
    return false
  })
  const [showExport, setShowExport] = useState(false)
  const [exportRideId, setExportRideId] = useState<string | undefined>()
  const [exportRouteId, setExportRouteId] = useState<string | undefined>()
  const [showSimulator, setShowSimulator] = useState(false)
  const [comments, setComments] = useState<CommentData[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'plan' || tab === 'track' || tab === 'explore' || tab === 'profile') {
      setActiveTab(tab)
    }
    // Handle shared route code (?route=MT3K7X)
    const routeCode = params.get('route')
    if (routeCode) {
      loadSharedRoute(routeCode).then(ok => { if (ok) setActiveTab('plan') })
    }
  }, [loadSharedRoute])

  // Exit fullscreen when switching away from explore tab
  useEffect(() => {
    if (activeTab !== 'explore') setExploreFullscreen(false)
  }, [activeTab])

  // User location useEffect (state declared earlier for currentPos)
  // Use enableHighAccuracy: true and longer timeout for mobile GPS
  // Mobile GPS needs more time to get the first fix (especially cold start)
  useEffect(() => {
    if (!navigator.geolocation) return

    const gpsOptions: PositionOptions = { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 }

    // Try getting position with high accuracy first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
      },
      (err) => {
        // If high accuracy fails, try with low accuracy as fallback
        console.warn('[GPS] High accuracy failed, trying low accuracy:', err.message)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLat(pos.coords.latitude)
            setUserLng(pos.coords.longitude)
          },
          () => {
            // Use default Ljubljana coordinates as last resort
            setUserLat(46.0569)
            setUserLng(14.5058)
          },
          { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
        )
      },
      gpsOptions
    )
  }, [])

  // ─── Route deviation detection ────────────────────────────────
  const { deviation: routeDeviation, level: deviationLevel, isDeviated } = useRouteDeviation({
    plannedRoute: planWaypoints,
    currentPosition: currentPos,
    isActive: isTracking && planWaypoints.length >= 2,
  })

  // ─── Speed camera alerts ──────────────────────────────────────
  const { closestCamera } = useSpeedCameraAlert(
    currentPos?.lat ?? null,
    currentPos?.lng ?? null,
    undefined,
    trackCurrentSpeed,
    isTracking,
  )

  // ─── Auto day/night theme ─────────────────────────────────────
  useEffect(() => {
    if (!mounted || !autoThemeEnabled) return
    const lat = userLat ?? 46.0569
    const lng = userLng ?? 14.5058

    const checkDaytime = () => {
      const now = new Date()
      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
      const lngHour = lng / 15
      const t = dayOfYear + ((18) - lngHour) / 24
      const M = (0.9856 * t) - 3.289
      let L = M + (1.916 * Math.sin(M * Math.PI / 180)) + (0.020 * Math.sin(2 * M * Math.PI / 180)) + 282.634
      L = ((L % 360) + 360) % 360
      const sinDec = 0.39782 * Math.sin(L * Math.PI / 180)
      const cosDec = Math.cos(Math.asin(sinDec))
      const zenith = 90.833
      const cosH = (Math.cos(zenith * Math.PI / 180) - (sinDec * Math.sin(lat * Math.PI / 180))) /
                   (cosDec * Math.cos(lat * Math.PI / 180))

      let isDaytime = true
      if (cosH > 1) { isDaytime = false }
      else if (cosH < -1) { isDaytime = true }
      else {
        const H = Math.acos(cosH) * 180 / Math.PI
        const sunriseLocal = ((12 - H / 15 + lngHour) % 24 + 24) % 24
        const sunsetLocal = ((12 + H / 15 + lngHour) % 24 + 24) % 24
        const currentHour = now.getHours() + now.getMinutes() / 60
        isDaytime = currentHour >= sunriseLocal && currentHour < sunsetLocal
      }
      setTheme(isDaytime ? 'light' : 'dark')
    }

    checkDaytime()
    const interval = setInterval(checkDaytime, 60000)
    return () => clearInterval(interval)
  }, [mounted, autoThemeEnabled, userLat, userLng, setTheme])

  // ─── Detail dialog ────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const openDetail = useCallback(async (item: RideData | RouteData, type: 'ride' | 'route') => {
    setSelectedItem(item); setSelectedType(type); setDetailOpen(true)
    setComments([]); setNewComment(''); setCommentsLoading(true)
    const param = type === 'ride' ? `rideId=${item.id}` : `routeId=${item.id}`
    fetch(`/api/comments?${param}`).then(r => r.json()).then(j => { setComments(j.data || []); setCommentsLoading(false) }).catch(() => setCommentsLoading(false))
    const lat = (item as RideData).startLat || 46.15
    const lng = (item as RideData).startLng || 14.99
    setWeatherLoading(true)
    fetch(`/api/weather?lat=${lat}&lng=${lng}`).then(r => r.json()).then(j => { setWeather(j.data || null); setWeatherLoading(false) }).catch(() => setWeatherLoading(false))
  }, [])

  const postComment = useCallback(async () => {
    if (!newComment.trim() || !user || !selectedItem) return
    try {
      const body: Record<string, string> = { text: newComment.trim(), userId: user.id }
      if (selectedType === 'ride') body.rideId = selectedItem.id
      else body.routeId = selectedItem.id
      const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        const j = await res.json()
        setComments(prev => [j.data, ...prev]); setNewComment('')
      } else toast.error('Napaka pri dodajanju komentarja')
    } catch { toast.error('Napaka') }
  }, [newComment, user, selectedItem, selectedType])

  // Prevent hydration mismatch: show skeleton until client-mounted
  // This ensures SSR and client render identical HTML on first paint
  // Uses the same LoadingSkeleton as Suspense fallback for consistency
  if (!mounted || loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - Premium app header with context-aware styling */}
      <header className={`fixed top-0 left-0 right-0 z-[1400] transition-all duration-300 ${
        exploreFullscreen
          ? '-translate-y-full opacity-0 pointer-events-none'
          : activeTab === 'map'
            ? 'h-14 bg-gradient-to-b from-black/70 via-black/50 to-transparent backdrop-blur-md'
            : 'h-16 header-frosted'
      }`}>
        <div className={`flex items-center gap-3 flex-1 min-w-0 h-full ${activeTab === 'map' ? 'px-4' : 'px-4 sm:px-5'}`}>
          {/* Logo icon with premium gradient */}
          <div className={`relative flex items-center justify-center rounded-2xl flex-shrink-0 transition-all duration-300 ${
            activeTab === 'map'
              ? 'size-10 bg-white/10 backdrop-blur-sm border border-white/10'
              : 'size-11 bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/30'
          }`}>
            <Bike className={`size-5 ${activeTab === 'map' ? 'text-white' : 'text-white'}`} strokeWidth={2.5} />
            {activeTab !== 'map' && <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`font-black text-base tracking-tight leading-none ${
              activeTab === 'map' ? 'text-white drop-shadow-md' : 'logo-gradient'
            }`}>MotoTrack</span>
            <span className={`text-[9px] uppercase tracking-[0.18em] font-semibold leading-tight ${
              activeTab === 'map' ? 'text-white/50' : 'text-primary/60'
            }`}>GPS Sledenje</span>
          </div>
          {/* REC indicator during tracking - pulsing badge */}
          {activeTab === 'track' && isTracking && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-bold ml-1.5 animate-pulse">
              <div className="size-2 rounded-full bg-red-500 record-pulse" />
              REC
            </span>
          )}
        </div>
        {mounted && (
          <div className="flex items-center gap-0.5">
            {/* Search - always visible */}
            <Button
              variant="ghost"
              size="icon"
              className={`size-9 rounded-xl ${activeTab === 'map' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'}`}
              onClick={() => setSearchOpen(true)}
              title="Iskanje (Ctrl+K)"
            >
              <Search className="size-[18px]" />
            </Button>

            {/* Desktop: full icon set visible on md+ */}
            <div className="hidden md:flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-xl relative ${activeTab === 'map' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'}`}
                onClick={() => setFeatureOpen(true)}
                title="Napredne funkcije"
              >
                <Sparkles className="size-[18px] text-primary" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              </Button>
              <NotificationBell userId={user?.id} />
              <AppShareButton />
              <NightModeToggle enabled={nightMode} onToggle={setNightMode} />
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-xl ${voiceEnabled ? 'bg-red-500/15 text-red-400 border border-red-500/20' : activeTab === 'map' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'}`}
                onClick={() => { setVoiceEnabled(v => !v); toast[voiceEnabled ? 'info' : 'success'](voiceEnabled ? '🔇 Glasovni ukazi izklopljeni' : '🎤 Glasovni ukazi vklopljeni') }}
                title={voiceEnabled ? 'Izklopi glasovne ukaze' : 'Vklopi glasovne ukaze'}
              >
                <Mic className={`size-[18px] ${voiceEnabled ? 'text-red-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-xl ${showTwistiness ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : activeTab === 'map' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'}`}
                onClick={() => setShowTwistiness(t => !t)}
                title={showTwistiness ? 'Skrij heatmap vijugavosti' : 'Prikaži heatmap vijugavosti'}
              >
                <Activity className={`size-[18px] ${showTwistiness ? 'text-emerald-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-xl ${activeTab === 'map' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'}`}
                onClick={() => setShowExport(true)}
                title="Izvozi vožnjo (GPX/TCX/KML)"
              >
                <Download className="size-[18px]" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-xl ${showSimulator ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' : activeTab === 'map' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'}`}
                onClick={() => { if (planWaypoints.length < 2) { toast.error('Narišite ruto za simulacijo'); return } setShowSimulator(s => !s) }}
                title="Simulacija rute"
              >
                <Film className={`size-[18px] ${showSimulator ? 'text-orange-400' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-xl ${activeTab === 'map' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'}`}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? 'Svetla tema' : 'Temna tema'}
              >
                {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </Button>
            </div>

            {/* Mobile: hamburger menu */}
            <Button
              variant="ghost"
              size="icon"
              className={`size-9 rounded-xl md:hidden ${activeTab === 'map' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'}`}
              onClick={() => setHeaderDrawerOpen(true)}
              title="Meni"
            >
              <Menu className="size-5" />
            </Button>
          </div>
        )}
      </header>
      {/* Header bottom accent line - gradient primary glow */}
      <div className={`fixed top-14 left-0 right-0 z-[1400] h-px transition-opacity duration-300 ${
        exploreFullscreen ? 'opacity-0' : activeTab === 'map' ? 'opacity-40' : 'opacity-100'
      } bg-gradient-to-r from-transparent via-primary/30 to-transparent`} />

      <main className={`flex-1 relative ${activeTab === 'map' ? 'overflow-hidden' : ''}`} style={{
        paddingTop: exploreFullscreen ? '0' : activeTab === 'map' ? '0' : '64px',
        paddingBottom: exploreFullscreen ? '0' : 'calc(64px + env(safe-area-inset-bottom, 0px))'
      }}>
        <div key={activeTab} className="tab-transition">
          {activeTab === 'map' && (
            <MapTab rides={rides} routes={routes} onOpenDetail={openDetail} userId={user?.id} />
          )}
          {activeTab === 'plan' && (
            <PlanTab
              waypoints={planWaypoints} setWaypoints={setPlanWaypoints}
              title={planTitle} setTitle={setPlanTitle}
              category={planCategory} setCategory={setPlanCategory}
              avoidHighways={planAvoidHighways} setAvoidHighways={setPlanAvoidHighways}
              avoidTolls={planAvoidTolls} setAvoidTolls={setPlanAvoidTolls}
              routingMode={planRoutingMode} setRoutingMode={setPlanRoutingMode}
              distance={planDistance} onMapClick={handleMapClick} onSave={saveRoute}
              onSendToPhone={sendToPhone}
              userId={user?.id || ''} onRefresh={fetchData}
              savedRouteId={planShareRouteId}
            />
          )}
          {activeTab === 'track' && (
            <TrackTab
              isTracking={isTracking} isPaused={isPaused}
              trackPoints={trackPoints} duration={trackDuration}
              distance={trackDistance} maxSpeed={trackMaxSpeed}
              currentSpeed={trackCurrentSpeed} elevation={trackElevation}
              gpsAccuracy={gpsAccuracy}
              userId={user?.id}
              onStart={startTracking} onPause={pauseTracking}
              onResume={resumeTracking} onStop={stopTracking}
              onSave={saveRide}
              unitSystem={settings.unitSystem}
              autoPauseEnabled={settings.autoPauseEnabled}
              wakelockEnabled={settings.wakelockEnabled}
              autoStartEnabled={autoStartEnabled}
              autoStartCountdown={autoStartCountdown}
              onToggleAutoStart={toggleAutoStart}
              carplayMode={carplayMode}
              onToggleCarplay={() => setCarplayMode(!carplayMode)}
              onOpenParking={() => setShowParkingPanel(true)}
              onOpenBorderGuide={() => setShowBorderGuide(true)}
            />
          )}
          {activeTab === 'explore' && (
            <ExploreTab
              rides={rides} routes={routes} leaderboard={leaderboard}
              onOpenDetail={openDetail} onSwitchUser={switchUser}
              userId={user?.id}
              fullscreen={exploreFullscreen}
              onToggleFullscreen={setExploreFullscreen}
              onLoadToPlan={loadTourToPlan}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileTab
              user={user} allUsers={allUsers} rides={rides} routes={routes}
              loading={loading} onSwitchUser={switchUser}
              onOpenDetail={openDetail} onRefresh={fetchData}
              unitSystem={settings.unitSystem}
            />
          )}
        </div>
      </main>

      {/* Detail Dialog */}
      {detailOpen && selectedItem && (
        <DetailDialog
          item={selectedItem} type={selectedType}
          comments={comments} newComment={newComment}
          commentsLoading={commentsLoading} weather={weather}
          weatherLoading={weatherLoading} user={user}
          onClose={() => setDetailOpen(false)}
          onToggleLike={toggleLike}
          onPostComment={postComment}
          onNewCommentChange={setNewComment}
        />
      )}

      {/* Feature Hub Dialog - New v2 Features */}
      <FeatureHubDialog
        open={featureOpen}
        onClose={() => setFeatureOpen(false)}
        user={user}
        selectedItem={selectedItem}
        selectedType={selectedType}
        routes={routes}
        userLat={userLat}
        userLng={userLng}
        onOpenDetail={(route) => openDetail(route, 'route')}
        voiceEnabled={voiceEnabled}
        onToggleVoice={setVoiceEnabled}
        autoThemeEnabled={autoThemeEnabled}
        onToggleAutoTheme={setAutoThemeEnabled}
        showTwistiness={showTwistiness}
        onToggleTwistiness={setShowTwistiness}
        onOpenExport={() => setShowExport(true)}
        onOpenSimulator={() => setShowSimulator(true)}
      />

      {/* FAB - Floating Action Button for tracking */}
      {activeTab === 'map' && !isTracking && (
        <div className="fixed z-[1401] left-1/2 -translate-x-1/2" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={() => { setActiveTab('track'); startTracking() }}
            className="relative w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/40 flex items-center justify-center active:scale-95 transition-all hover:shadow-xl hover:shadow-primary/50 fab-breathe"
          >
            <Play className="size-6 text-primary-foreground fill-primary-foreground ml-0.5" />
          </button>
        </div>
      )}

      {/* SOS Button - hidden in explore fullscreen */}
      {!exploreFullscreen && <SosButton userId={user?.id} />}

      {/* AI Chat - hidden in explore fullscreen */}
      {!exploreFullscreen && <MotoChat />}

      {/* PWA Install Prompt */}
      {!exploreFullscreen && <PwaInstallPrompt />}

      {/* Group Ride Chat Bubble - visible when tracking */}
      {isTracking && !exploreFullscreen && currentRideId && (
        <ChatBubble rideId={currentRideId} userName={user?.name || 'Motorist'} />
      )}

      {/* Route Deviation Alert - when following a planned route */}
      {isTracking && isDeviated && !deviationDismissed && !exploreFullscreen && (
        <RouteDeviationAlert
          deviation={routeDeviation}
          level={deviationLevel}
          onReroute={() => {
            setDeviationDismissed(true)
            toast.success('Preračunavanje rute...')
          }}
          onDismiss={() => {
            setDeviationDismissed(true)
            setTimeout(() => setDeviationDismissed(false), 300000) // 5 min cooldown
          }}
        />
      )}

      {/* Speed Camera Alert - when tracking and near a camera */}
      {isTracking && closestCamera && closestCamera.distance <= 500 && !cameraDismissed && !exploreFullscreen && (
        <SpeedCameraFloatingAlert
          camera={closestCamera.camera}
          distance={closestCamera.distance}
          onDismiss={() => {
            setCameraDismissed(true)
            setTimeout(() => setCameraDismissed(false), 120000) // 2 min cooldown
          }}
        />
      )}

      {/* Global Search */}
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        rides={rides}
        routes={routes}
        onNavigateToRide={(ride) => { setActiveTab('map'); setSearchOpen(false) }}
        onNavigateToRoute={(route) => { setActiveTab('map'); setSearchOpen(false) }}
        onNavigateToRoad={(road) => { setActiveTab('explore'); setSearchOpen(false) }}
        onNavigateToTab={(tab) => { setActiveTab(tab as TabId); setSearchOpen(false) }}
      />

      {/* Plan Route Share Dialog (Send to Phone) */}
      {showPlanShare && planShareRouteId && (
        <RouteShareDialog
          open={showPlanShare}
          onClose={() => { setShowPlanShare(false); setPlanShareRouteId(null) }}
          routeId={planShareRouteId}
          routeTitle={planShareTitle}
          defaultTab="qr"
        />
      )}

      {/* Header Drawer Menu (mobile) */}
      <HeaderDrawer
        open={headerDrawerOpen}
        onOpenChange={setHeaderDrawerOpen}
        onOpenFeatureHub={() => setFeatureOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onToggleVoice={() => { setVoiceEnabled(v => !v); toast[voiceEnabled ? 'info' : 'success'](voiceEnabled ? '🔇 Glasovni ukazi izklopljeni' : '🎤 Glasovni ukazi vklopljeni') }}
        onToggleTwistiness={() => setShowTwistiness(t => !t)}
        onOpenExport={() => setShowExport(true)}
        onOpenSimulator={() => { if (planWaypoints.length < 2) { toast.error('Narišite ruto za simulacijo'); return } setShowSimulator(true) }}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        voiceEnabled={voiceEnabled}
        showTwistiness={showTwistiness}
        theme={theme}
        notificationBell={<NotificationBell userId={user?.id} />}
        shareButton={<AppShareButton />}
        nightModeToggle={<NightModeToggle enabled={nightMode} onToggle={setNightMode} />}
      />

      {/* Night Riding Mode Overlay */}
      {nightMode && (
        <div
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{
            background: 'rgba(180, 0, 0, 0.12)',
            mixBlendMode: 'multiply',
          }}
        />
      )}

      {/* CarPlay / Android Auto Mode */}
      <CarPlayMode
        isActive={carplayMode}
        onToggle={() => setCarplayMode(false)}
        currentSpeed={trackCurrentSpeed}
        distance={trackDistance}
        duration={trackDuration}
        elevation={trackElevation}
        maxSpeed={trackMaxSpeed}
        isTracking={isTracking}
        isPaused={isPaused}
        onStartStopTrack={isTracking ? stopTracking : startTracking}
        onPauseResume={isPaused ? resumeTracking : pauseTracking}
        speedLimit={90}
        isOverSpeed={isTracking && trackCurrentSpeed > 90}
        voiceEnabled={true}
        onToggleVoice={() => {}}
        currentLat={userLat}
        currentLng={userLng}
        fuelRange={undefined}
        onOpenEmergency={() => {}}
      />

      {/* Parking Spot Panel */}
      <ParkingSpotPanel
        isOpen={showParkingPanel}
        onClose={() => setShowParkingPanel(false)}
        currentLat={userLat}
        currentLng={userLng}
      />

      {/* Parking Save Prompt (after ride save) */}
      {showParkingPrompt && (
        <ParkingSavePrompt
          onSave={() => { setShowParkingPrompt(false); setShowParkingPanel(true) }}
          onDismiss={() => setShowParkingPrompt(false)}
        />
      )}

      {/* Border Crossing Guide */}
      <BorderGuide
        isOpen={showBorderGuide}
        onClose={() => setShowBorderGuide(false)}
      />

      {/* Voice Commands */}
      {voiceEnabled && !exploreFullscreen && (
        <VoiceCommands
          isTracking={isTracking}
          isPaused={isPaused}
          onStartTracking={startTracking}
          onStopTracking={stopTracking}
          onPauseTracking={pauseTracking}
          onResumeTracking={resumeTracking}
          onSaveRide={saveRide}
          onOpenEmergency={() => {}}
          onReportHazard={() => {}}
          onOpenNavigation={() => setActiveTab('plan')}
          currentSpeed={trackCurrentSpeed}
          currentLat={userLat ?? null}
          currentLng={userLng ?? null}
        />
      )}

      {/* Auto Day/Night Theme Indicator */}
      <AutoThemeIndicator
        lat={userLat}
        lng={userLng}
        enabled={autoThemeEnabled}
        onToggle={setAutoThemeEnabled}
      />

      {/* Export Panel */}
      <ExportPanel
        rideId={exportRideId}
        routeId={exportRouteId}
        trackData={trackPoints.map(p => ({ lat: p.lat, lng: p.lng, alt: p.alt, speed: null, timestamp: p.timestamp }))}
        rideName={selectedItem ? (selectedItem as RideData).title || 'MotoTrack vožnja' : 'MotoTrack vožnja'}
        totalDistance={trackDistance}
        totalDuration={trackDuration}
        isOpen={showExport}
        onClose={() => { setShowExport(false); setExportRideId(undefined); setExportRouteId(undefined) }}
      />

      {/* Route Simulator */}
      {showSimulator && planWaypoints.length >= 2 && (
        <RouteSimulator
          points={planWaypoints}
          routeName={planTitle || 'Simulacija rute'}
          totalDistance={planDistance}
          onClose={() => setShowSimulator(false)}
        />
      )}

      {/* Bottom Navigation - Premium motorcycle app style with raised center button */}
      <nav className={`fixed bottom-0 left-0 right-0 z-[1500] transition-all duration-300 ${
        exploreFullscreen ? 'translate-y-full opacity-0 pointer-events-none' : ''
      }`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="nav-premium">
          <div className="flex items-end justify-around max-w-lg mx-auto h-[64px] sm:h-[72px] relative">
            {tabs.map((tab, idx) => {
              const isActive = activeTab === tab.id
              const isCenter = tab.id === 'track'
              
              // Center button: raised, prominent
              if (isCenter) {
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex flex-col items-center -mt-4 sm:-mt-5 transition-all duration-200 active:scale-95`}
                  >
                    <div className={`relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl transition-all duration-300 shadow-xl ${
                      isActive
                        ? 'bg-gradient-to-br from-primary to-orange-600 shadow-primary/40'
                        : 'bg-gradient-to-br from-muted to-muted/80 shadow-black/10 dark:shadow-black/30'
                    }`}>
                      <tab.icon
                        className={`size-6 transition-all duration-200 ${isActive ? 'text-white' : 'text-muted-foreground'}`}
                        strokeWidth={isActive ? 2.5 : 1.8}
                      />
                      {isActive && <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent" />}
                    </div>
                    <span className={`text-[8px] sm:text-[9px] mt-0.5 tracking-tight leading-none font-bold ${
                      isActive ? 'text-primary' : 'text-muted-foreground/50'
                    }`}>
                      {tab.label}
                    </span>
                  </button>
                )
              }
              
              // Regular tabs
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-5 pb-2 pt-2 sm:pt-3 transition-all duration-200 active:scale-90 ${
                    isActive ? '' : ''
                  }`}
                >
                  <div className={`relative flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'size-10 rounded-xl bg-primary/10 dark:bg-primary/15' : ''
                  }`}>
                    <tab.icon
                      className={`size-[22px] sm:size-5 transition-all duration-200 ${
                        isActive ? 'text-primary' : 'text-muted-foreground/40'
                      }`}
                      strokeWidth={isActive ? 2.4 : 1.5}
                    />
                  </div>
                  <span className={`text-[9px] sm:text-[11px] tracking-tight leading-none transition-all duration-200 ${
                    isActive ? 'text-primary font-bold' : 'text-muted-foreground/40 font-medium'
                  }`}>
                    {tab.label}
                  </span>
                  {/* Active dot indicator */}
                  {isActive && (
                    <div className="nav-dot-indicator absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
