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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'


import type { TabId, RideData, RouteData, UserData, CommentData, WeatherData, LeaderboardUser, TrackPoint } from '@/components/tabs/types'
import { haversine, formatDuration, formatDate, categoryLabel, categoryColor } from '@/components/tabs/types'
import { useSettingsStore, useFetchSettings, useWakeLock, isInPrivacyZone, obfuscateCoordinate, type UnitSystem } from '@/hooks/use-settings'

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
      {/* Header skeleton */}
      <header className="fixed top-0 left-0 right-0 z-[1400] h-12 flex items-center px-4 bg-background/95 backdrop-blur-md border-b border-border/30">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center justify-center size-8 rounded-xl bg-primary/20 shadow-sm shadow-primary/20">
            <Bike className="size-[18px] text-primary" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col -space-y-0.5">
            <span className="font-black text-[15px] tracking-tight text-primary leading-none">MotoTrack</span>
            <span className="text-[8px] text-muted-foreground/70 uppercase tracking-[0.2em] font-semibold leading-none hidden sm:block">GPS Sledenje</span>
            <span className="text-[8px] text-primary/50 font-semibold leading-none hidden sm:block">by Markec</span>
          </div>
        </div>
      </header>
      <div className="header-gradient-line fixed top-12 left-0 right-0 z-[1400]" />

      <main className="flex-1 pt-12 pb-20 px-4 max-w-lg mx-auto w-full">
        <div className="py-6 space-y-6">
          <Skeleton className="w-full h-48 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton className="size-8 rounded-full mx-auto" />
              <Skeleton className="h-5 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
            <div className="space-y-2">
              <Skeleton className="size-8 rounded-full mx-auto" />
              <Skeleton className="h-5 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
            <div className="space-y-2">
              <Skeleton className="size-8 rounded-full mx-auto" />
              <Skeleton className="h-5 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          </div>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </main>

      {/* Bottom nav skeleton */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1500] bg-black/95 backdrop-blur-xl border-t border-white/5" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around max-w-lg mx-auto h-[72px]">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex flex-col items-center gap-1 px-4 py-2">
              <Skeleton className="size-5 rounded bg-white/10" />
              <Skeleton className="h-2.5 w-8 bg-white/10" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [rides, setRides] = useState<RideData[]>([])
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string; avatar: string | null; bike: string | null; bio: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const seedChecked = useRef(false)

  // Plan route state
  const [planWaypoints, setPlanWaypoints] = useState<{ lat: number; lng: number }[]>([])
  const [planAvoidHighways, setPlanAvoidHighways] = useState(false)
  const [planAvoidTolls, setPlanAvoidTolls] = useState(false)
  const [planRoutingMode, setPlanRoutingMode] = useState<'paved' | 'twisty' | 'offroad'>('paved')
  const [planTitle, setPlanTitle] = useState('')
  const [planCategory, setPlanCategory] = useState('scenic')
  const [planDistance, setPlanDistance] = useState(0)

  // Track state
  const [isTracking, setIsTracking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentRideId, setCurrentRideId] = useState<string | null>(null)
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([])
  const [trackDuration, setTrackDuration] = useState(0)
  const [trackDistance, setTrackDistance] = useState(0)
  const [trackMaxSpeed, setTrackMaxSpeed] = useState(0)
  const [trackCurrentSpeed, setTrackCurrentSpeed] = useState(0)
  const [trackElevation, setTrackElevation] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [deviationDismissed, setDeviationDismissed] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  // Route deviation detection
  const { deviation: routeDeviation, level: deviationLevel, isDeviated } = useRouteDeviation({
    plannedRoute: planWaypoints,
    currentPosition: currentPos ? { lat: currentPos[0], lng: currentPos[1] } : null,
    isActive: isTracking && planWaypoints.length >= 2,
  })

  // Speed camera alerts
  const [cameraDismissed, setCameraDismissed] = useState(false)
  const { closestCamera } = useSpeedCameraAlert(
    currentPos ? currentPos[0] : null,
    currentPos ? currentPos[1] : null,
    undefined,
    trackCurrentSpeed,
    isTracking,
  )

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedDurationRef = useRef<number>(0)
  const isPausedRef = useRef(false)
  const autoPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoPausedRef = useRef(false)

  // Auto-start tracking state
  const [autoStartEnabled, setAutoStartEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('mototrack_autoStartTracking') === 'true' } catch { return false }
    }
    return false
  })
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null)
  const autoStartWatchRef = useRef<number | null>(null)
  const autoStartCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStartSpeedAboveRef = useRef<boolean>(false)
  const autoStartSpeedStartRef = useRef<number>(0)

  // Detail dialog
  const [selectedItem, setSelectedItem] = useState<RideData | RouteData | null>(null)
  const [selectedType, setSelectedType] = useState<'ride' | 'route'>('ride')
  const [detailOpen, setDetailOpen] = useState(false)

  // Feature hub (new v2 features)
  const [featureOpen, setFeatureOpen] = useState(false)

  // Explore fullscreen mode
  const [exploreFullscreen, setExploreFullscreen] = useState(false)

  // Global search
  const [searchOpen, setSearchOpen] = useState(false)

  // Night riding mode
  const [nightMode, setNightMode] = useState(false)

  // CarPlay mode
  const [carplayMode, setCarplayMode] = useState(false)

  // Parking spot
  const [showParkingPanel, setShowParkingPanel] = useState(false)
  const [showParkingPrompt, setShowParkingPrompt] = useState(false)

  // Border guide
  const [showBorderGuide, setShowBorderGuide] = useState(false)

  // Voice commands
  const [voiceEnabled, setVoiceEnabled] = useState(false)

  // Twistiness heatmap
  const [showTwistiness, setShowTwistiness] = useState(false)

  // Auto day/night theme
  const [autoThemeEnabled, setAutoThemeEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('mototrack_autotheme') === 'true' } catch { return false }
    }
    return false
  })

  // Export panel
  const [showExport, setShowExport] = useState(false)
  const [exportRideId, setExportRideId] = useState<string | undefined>()
  const [exportRouteId, setExportRouteId] = useState<string | undefined>()

  // Route simulator
  const [showSimulator, setShowSimulator] = useState(false)

  // Plan share dialog (Send to Phone)
  const [showPlanShare, setShowPlanShare] = useState(false)
  const [planShareRouteId, setPlanShareRouteId] = useState<string | null>(null)
  const [planShareTitle, setPlanShareTitle] = useState('')

  // Comments
  const [comments, setComments] = useState<CommentData[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)

  // Weather
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])

  // PWA shortcut support - read ?tab= from URL on first load
  // Using window.location instead of useSearchParams() to avoid SSR suspension
  // which causes hydration mismatch (server renders Suspense fallback, client renders Home)
  const [activeTab, setActiveTab] = useState<TabId>('map')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'plan' || tab === 'track' || tab === 'explore' || tab === 'profile') {
      setActiveTab(tab)
    }
    // Handle shared route code (?route=MT3K7X)
    const routeCode = params.get('route')
    if (routeCode) {
      fetch(`/api/routes/share?code=${encodeURIComponent(routeCode)}`)
        .then(r => r.json())
        .then(j => {
          if (j.data?.waypoints) {
            try {
              const waypoints = typeof j.data.waypoints === 'string'
                ? JSON.parse(j.data.waypoints)
                : j.data.waypoints
              if (Array.isArray(waypoints) && waypoints.length >= 2) {
                setPlanWaypoints(waypoints.map((w: any) => ({ lat: w.lat, lng: w.lng })))
                setPlanTitle(j.data.title || `Deljena ruta: ${routeCode}`)
                setPlanCategory(j.data.category || 'scenic')
                setActiveTab('plan')
                toast.success(`🗺️ Ruta "${j.data.title || routeCode}" naložena!`)
                // Clean URL
                window.history.replaceState({}, '', '/')
              }
            } catch { /* ignore parse errors */ }
          }
        })
        .catch(() => {
          toast.error('Napaka pri nalaganju deljene rute')
        })
    }
  }, [])

  // Exit fullscreen when switching away from explore tab
  useEffect(() => {
    if (activeTab !== 'explore') setExploreFullscreen(false)
  }, [activeTab])

  // User location for recommendations
  const [userLat, setUserLat] = useState<number | undefined>()
  const [userLng, setUserLng] = useState<number | undefined>()
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
      }, () => {}, { enableHighAccuracy: false, timeout: 5000 })
    }
  }, [])

  // Fetch data - use single /api/init endpoint to reduce concurrent requests
  // This prevents memory spikes from multiple simultaneous API calls in sandbox
  const fetchData = useCallback(async () => {
    try {
      // Single request for all initial data (reduces concurrent API calls from 7+ to 1)
      const initRes = await fetch('/api/init')
      if (initRes.ok) {
        const j = await initRes.json()
        const d = j.data || j
        setRides(d.rides || [])
        setRoutes(d.routes || [])
        setUser(d.defaultUser || null)
        setAllUsers(d.users || [])
        setLeaderboard(d.leaderboard || [])
        
        // Seed if needed
        if (d.needsSeed && !seedChecked.current) {
          seedChecked.current = true
          try {
            await fetch('/api/seed', { method: 'POST' })
            // Re-fetch after seeding
            const retryRes = await fetch('/api/init')
            if (retryRes.ok) {
              const rj = await retryRes.json()
              const rd = rj.data || rj
              setRides(rd.rides || [])
              setRoutes(rd.routes || [])
              setUser(rd.defaultUser || null)
              setAllUsers(rd.users || [])
              setLeaderboard(rd.leaderboard || [])
            }
          } catch { /* ignore seed errors */ }
        }
      }
    } catch (err) { console.error('Fetch error:', err) }
    finally { setLoading(false) }
  }, [])

  // Fetch settings from server
  const { settings, privacyZones } = useSettingsStore()
  useFetchSettings(user?.id)
  useWakeLock(settings.wakelockEnabled, isTracking)

  useEffect(() => { fetchData() }, [fetchData])

  // Auto day/night theme - switch based on sunrise/sunset
  useEffect(() => {
    if (!mounted || !autoThemeEnabled) return
    const lat = userLat ?? 46.0569 // default: Ljubljana
    const lng = userLng ?? 14.5058

    const checkDaytime = () => {
      const now = new Date()
      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
      const lngHour = lng / 15
      const t = dayOfYear + ((18) - lngHour) / 24 // sunset calc
      const M = (0.9856 * t) - 3.289
      let L = M + (1.916 * Math.sin(M * Math.PI / 180)) + (0.020 * Math.sin(2 * M * Math.PI / 180)) + 282.634
      L = ((L % 360) + 360) % 360
      const sinDec = 0.39782 * Math.sin(L * Math.PI / 180)
      const cosDec = Math.cos(Math.asin(sinDec))
      const zenith = 90.833
      const cosH = (Math.cos(zenith * Math.PI / 180) - (sinDec * Math.sin(lat * Math.PI / 180))) /
                   (cosDec * Math.cos(lat * Math.PI / 180))
      // Simple check: if we can compute sunset hour, compare with current hour
      const currentHour = now.getHours()
      // Approximate: daytime is 6-20, nighttime is 20-6
      const isDaytime = currentHour >= 6 && currentHour < 20
      setTheme(isDaytime ? 'light' : 'dark')
    }

    checkDaytime()
    const interval = setInterval(checkDaytime, 60000) // check every minute
    return () => clearInterval(interval)
  }, [mounted, autoThemeEnabled, userLat, userLng, setTheme])

  // Recover unsaved track data from localStorage (crash recovery)
  useEffect(() => {
    if (!mounted) return
    try {
      const saved = localStorage.getItem('mototrack_autosave')
      if (saved) {
        const points: TrackPoint[] = JSON.parse(saved)
        if (points.length >= 2) {
          // Show recovery toast
          const recoverData = () => {
            setTrackPoints(points)
            let dist = 0
            for (let i = 1; i < points.length; i++) {
              dist += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
            }
            setTrackDistance(Math.round(dist * 100) / 100)
            toast.success(`♻️ Obnovljeno ${points.length} točk (${(dist).toFixed(1)} km)`)
            localStorage.removeItem('mototrack_autosave')
          }
          // Auto-recover after a brief delay
          const timer = setTimeout(recoverData, 1500)
          return () => clearTimeout(timer)
        }
      }
    } catch {}
  }, [mounted])

  // Calculate plan distance
  useEffect(() => {
    let dist = 0
    for (let i = 1; i < planWaypoints.length; i++) {
      dist += haversine(planWaypoints[i - 1].lat, planWaypoints[i - 1].lng, planWaypoints[i].lat, planWaypoints[i].lng)
    }
    setPlanDistance(Math.round(dist * 10) / 10)
  }, [planWaypoints])

  // GPS Tracking with auto-pause support + background reliability
  // Periodic auto-save to prevent data loss on crash/background
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastAutoSaveRef = useRef<number>(0)
  const lastGpsFixRef = useRef<number>(0) // timestamp of last GPS fix
  const gpsErrorCountRef = useRef<number>(0) // consecutive GPS errors
  const lastValidPointRef = useRef<TrackPoint | null>(null) // for GPS sanity checks
  const gpsReacquireIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null) // periodic GPS re-acquisition
  const lastAltitudeRef = useRef<number | null>(null) // last known altitude for elevation tracking

  // Handle visibility change (app going to background/foreground)
  // Key fix: re-acquire WakeLock and GPS when app comes back to foreground
  useEffect(() => {
    if (!isTracking) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // App came back to foreground — re-acquire WakeLock
        if (settings.wakelockEnabled && 'wakeLock' in navigator) {
          try { await navigator.wakeLock.request('screen') } catch {}
        }
        // Immediately request a fresh GPS fix when returning from background
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const point: TrackPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude, timestamp: Date.now() }
              // Only accept if accuracy is reasonable
              if (pos.coords.accuracy <= 200) {
                lastGpsFixRef.current = Date.now()
                lastValidPointRef.current = point
                // Update altitude tracking
                if (pos.coords.altitude !== null) {
                  if (lastAltitudeRef.current !== null) {
                    const altDiff = pos.coords.altitude - lastAltitudeRef.current
                    if (altDiff > 0) {
                      setTrackElevation(prev => Math.round((prev + altDiff) * 10) / 10)
                    }
                  }
                  lastAltitudeRef.current = pos.coords.altitude
                }
              }
            },
            () => {}, // silently ignore errors on foreground resume
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
          )
        }
        // Calculate time gap since last GPS fix and show informative toast
        const timeSinceLastFix = Date.now() - lastGpsFixRef.current
        if (lastGpsFixRef.current > 0 && timeSinceLastFix > 30000) {
          const gapMinutes = Math.round(timeSinceLastFix / 60000)
          const gapSeconds = Math.round(timeSinceLastFix / 1000)
          const gapText = gapMinutes >= 1 ? `${gapMinutes} min` : `${gapSeconds} s`
          toast.info(`📡 Nazaj po ${gapText} — nadaljujem sledenje`)
        }
      } else {
        // Going to background — save current state immediately
        try {
          const currentPoints = JSON.parse(localStorage.getItem('mototrack_autosave') || '[]')
          setTrackPoints(prev => {
            if (prev.length > 0) {
              try { localStorage.setItem('mototrack_autosave', JSON.stringify(prev)) } catch {}
            }
            return prev
          })
        } catch {}
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isTracking, settings.wakelockEnabled])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { toast.error('Geolokacija ni na voljo'); return }
    setIsTracking(true); setIsPaused(false); isPausedRef.current = false; autoPausedRef.current = false; setTrackPoints([]); setTrackDuration(0)
    setTrackDistance(0); setTrackMaxSpeed(0); setTrackCurrentSpeed(0); setTrackElevation(0)
    setGpsAccuracy(null); setCurrentRideId(`ride_${Date.now()}`)
    startTimeRef.current = Date.now(); pausedDurationRef.current = 0
    lastGpsFixRef.current = Date.now()
    gpsErrorCountRef.current = 0
    lastValidPointRef.current = null
    lastAltitudeRef.current = null

    // Acquire WakeLock to prevent screen from turning off (key for reliable tracking)
    if (settings.wakelockEnabled && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {})
    }

    timerRef.current = setInterval(() => { if (!isPausedRef.current) setTrackDuration(p => p + 1) }, 1000)

    // Periodic GPS re-acquisition: if no GPS fix for 30 seconds while tracking,
    // try to get a new position. This handles the case where watchPosition
    // silently stops updating (common on Android PWAs in background)
    gpsReacquireIntervalRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        const timeSinceLastFix = Date.now() - lastGpsFixRef.current
        if (timeSinceLastFix > 30000) {
          toast.info('📡 Ponovna vzpostavitev GPS...')
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (pos.coords.accuracy <= 200) {
                const point: TrackPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude, timestamp: Date.now() }
                lastGpsFixRef.current = Date.now()
                lastValidPointRef.current = point
                gpsErrorCountRef.current = 0
                // Update altitude tracking
                if (pos.coords.altitude !== null) {
                  if (lastAltitudeRef.current !== null) {
                    const altDiff = pos.coords.altitude - lastAltitudeRef.current
                    if (altDiff > 0) {
                      setTrackElevation(prev => Math.round((prev + altDiff) * 10) / 10)
                    }
                  }
                  lastAltitudeRef.current = pos.coords.altitude
                }
                // Add the re-acquired point to track
                setTrackPoints(prev => {
                  // Check for GPS gap — if > 30s since last point, insert gap marker
                  const newPoints = [...prev]
                  if (newPoints.length > 0) {
                    const lastPoint = newPoints[newPoints.length - 1]
                    // Don't add gap marker after existing gap markers
                    if (lastPoint.alt !== -9999) {
                      const gapTime = point.timestamp - lastPoint.timestamp
                      if (gapTime > 30000) {
                        newPoints.push({ lat: lastPoint.lat, lng: lastPoint.lng, alt: -9999, timestamp: lastPoint.timestamp + 1 })
                      }
                    }
                  }
                  newPoints.push(point)
                  // Auto-save to localStorage
                  if (Date.now() - lastAutoSaveRef.current > 15000) {
                    lastAutoSaveRef.current = Date.now()
                    try { localStorage.setItem('mototrack_autosave', JSON.stringify(newPoints)) } catch {}
                  }
                  return newPoints
                })
              }
            },
            () => {}, // silently ignore errors
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
          )
        }
      }
    }, 30000)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude, timestamp: Date.now() }
        
        // GPS sanity check: reject jumps > 500m in < 2 seconds (GPS glitch)
        if (lastValidPointRef.current) {
          const last = lastValidPointRef.current
          const dist = haversine(last.lat, last.lng, point.lat, point.lng)
          const timeDiff = (point.timestamp - last.timestamp) / 1000
          if (dist > 500 && timeDiff < 2) {
            console.warn('[Tracking] GPS glitch: jump', dist, 'm in', timeDiff, 's — rejecting')
            return // Reject this GPS fix
          }
          // Reject if accuracy is worse than 200m
          if (pos.coords.accuracy > 200) {
            console.warn('[Tracking] Low GPS accuracy:', pos.coords.accuracy, 'm — skipping')
            return
          }
        }
        
        lastGpsFixRef.current = Date.now()
        gpsErrorCountRef.current = 0 // Reset error counter on success
        lastValidPointRef.current = point
        setGpsAccuracy(pos.coords.accuracy)

        // Elevation tracking from GPS altitude
        // Only count positive altitude changes (climbing), not descending
        if (pos.coords.altitude !== null) {
          if (lastAltitudeRef.current !== null) {
            const altDiff = pos.coords.altitude - lastAltitudeRef.current
            if (altDiff > 0) {
              setTrackElevation(prev => Math.round((prev + altDiff) * 10) / 10)
            }
          }
          lastAltitudeRef.current = pos.coords.altitude
        }

        setTrackPoints(prev => {
          const newPoints = [...prev]
          // GPS gap interpolation: if > 30s since last point, insert gap marker
          // This prevents "teleportation" lines on the map when GPS signal is lost and regained
          if (newPoints.length > 0) {
            const lastPoint = newPoints[newPoints.length - 1]
            // Don't add gap marker after existing gap markers
            if (lastPoint.alt !== -9999) {
              const gapTime = point.timestamp - lastPoint.timestamp
              if (gapTime > 30000) {
                newPoints.push({ lat: lastPoint.lat, lng: lastPoint.lng, alt: -9999, timestamp: lastPoint.timestamp + 1 })
              }
            }
          }
          newPoints.push(point)
          // Auto-save to localStorage every 15 seconds (was 30s — more frequent for reliability)
          if (newPoints.length > 0 && Date.now() - lastAutoSaveRef.current > 15000) {
            lastAutoSaveRef.current = Date.now()
            try {
              localStorage.setItem('mototrack_autosave', JSON.stringify(newPoints))
            } catch {}
          }
          if (prev.length > 0 && !isPausedRef.current) {
            // Only calculate distance for non-gap points
            const lastNonGapPoint = [...prev].reverse().find(p => p.alt !== -9999)
            if (lastNonGapPoint) {
              const d = haversine(lastNonGapPoint.lat, lastNonGapPoint.lng, point.lat, point.lng)
              setTrackDistance(dd => Math.round((dd + d) * 100) / 100)
            }
          }
          return newPoints
        })
        if (pos.coords.speed !== null && pos.coords.speed >= 0) {
          const kph = Math.round(pos.coords.speed * 3.6 * 10) / 10
          setTrackCurrentSpeed(kph); setTrackMaxSpeed(max => Math.max(max, kph))
          // Auto-pause: if speed below threshold for sustained period, auto-pause
          if (settings.autoPauseEnabled && !isPausedRef.current && kph < settings.autoPauseSpeedThreshold) {
            if (!autoPauseTimerRef.current) {
              autoPauseTimerRef.current = setTimeout(() => {
                if (isPausedRef.current) return
                autoPausedRef.current = true
                setIsPaused(true); isPausedRef.current = true
                pausedDurationRef.current = Date.now()
                toast.info('🔄 Samodejni premor (nizka hitrost)')
              }, 5000) // 5 seconds below threshold = auto-pause
            }
          } else {
            // Speed is above threshold
            if (autoPauseTimerRef.current) { clearTimeout(autoPauseTimerRef.current); autoPauseTimerRef.current = null }
            // Auto-resume if we auto-paused
            if (autoPausedRef.current && isPausedRef.current && kph >= settings.autoPauseSpeedThreshold) {
              autoPausedRef.current = false
              setIsPaused(false); isPausedRef.current = false
              if (pausedDurationRef.current) startTimeRef.current += Date.now() - pausedDurationRef.current
              toast.info('▶️ Nadaljevanje snemanja')
            }
          }
        }
      },
      (error) => {
        // Enhanced GPS error handling with retry logic
        gpsErrorCountRef.current++
        const errMsg = error.code === 1 ? 'Dostop do lokacije zavrnjen'
          : error.code === 2 ? 'Lokacija ni na voljo'
          : error.code === 3 ? 'Časovna omejitev GPS'
          : 'Napaka GPS'
        
        if (gpsErrorCountRef.current <= 3) {
          toast.error(`📡 ${errMsg} — poskušam znova...`)
        } else if (gpsErrorCountRef.current === 10) {
          toast.error('📡 GPS signal izgubljen. Preverite lokacijske nastavitve.')
        }
        // Don't stop tracking on GPS errors — keep timer running, just skip the point
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }, [settings.autoPauseEnabled, settings.autoPauseSpeedThreshold, settings.wakelockEnabled])

  const pauseTracking = useCallback(() => { setIsPaused(true); isPausedRef.current = true; pausedDurationRef.current = Date.now() }, [])
  const resumeTracking = useCallback(() => { setIsPaused(false); isPausedRef.current = false; if (pausedDurationRef.current) startTimeRef.current += Date.now() - pausedDurationRef.current }, [])
  const stopTracking = useCallback(() => {
    setIsTracking(false); setIsPaused(false); isPausedRef.current = false; autoPausedRef.current = false; setCurrentRideId(null)
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (autoPauseTimerRef.current) { clearTimeout(autoPauseTimerRef.current); autoPauseTimerRef.current = null }
    if (autoSaveIntervalRef.current) { clearInterval(autoSaveIntervalRef.current); autoSaveIntervalRef.current = null }
    if (gpsReacquireIntervalRef.current) { clearInterval(gpsReacquireIntervalRef.current); gpsReacquireIntervalRef.current = null }
    // Clean up auto-save from localStorage
    try { localStorage.removeItem('mototrack_autosave') } catch {}
    // Release WakeLock
    if ('wakeLock' in navigator) {
      try { navigator.wakeLock.release?.() } catch {}
    }
    setTrackCurrentSpeed(0)
  }, [])

  // Toggle auto-start tracking setting
  const toggleAutoStart = useCallback(() => {
    setAutoStartEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('mototrack_autoStartTracking', String(next)) } catch {}
      if (!next) {
        // Disable: clean up any running monitoring
        if (autoStartWatchRef.current !== null) {
          navigator.geolocation.clearWatch(autoStartWatchRef.current)
          autoStartWatchRef.current = null
        }
        if (autoStartCountdownRef.current) {
          clearInterval(autoStartCountdownRef.current)
          autoStartCountdownRef.current = null
        }
        autoStartSpeedAboveRef.current = false
        autoStartSpeedStartRef.current = 0
        setAutoStartCountdown(null)
        toast.info('⚡ Samodejni začetek izklopljen')
      } else {
        toast.success('⚡ Samodejni začetek vklopljen — sledenje se začne pri > 20 km/h')
      }
      return next
    })
  }, [])

  // Auto-start GPS monitoring: when on "Sledi" tab, not tracking, and auto-start enabled
  useEffect(() => {
    if (!autoStartEnabled || activeTab !== 'track' || isTracking) {
      // Clean up monitoring when not applicable
      if (autoStartWatchRef.current !== null) {
        navigator.geolocation.clearWatch(autoStartWatchRef.current)
        autoStartWatchRef.current = null
      }
      if (autoStartCountdownRef.current) {
        clearInterval(autoStartCountdownRef.current)
        autoStartCountdownRef.current = null
      }
      autoStartSpeedAboveRef.current = false
      autoStartSpeedStartRef.current = 0
      setAutoStartCountdown(null)
      return
    }

    if (!navigator.geolocation) return

    // Start monitoring GPS for auto-start
    autoStartWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh = pos.coords.speed !== null ? pos.coords.speed * 3.6 : 0

        if (speedKmh > 20) {
          if (!autoStartSpeedAboveRef.current) {
            // Speed just crossed threshold — start timing
            autoStartSpeedAboveRef.current = true
            autoStartSpeedStartRef.current = Date.now()
            setAutoStartCountdown(30)
            toast.info('🚀 Zaznavam gibanje... sledenje se samodejno začne čez 30 sekund')

            // Start countdown interval
            if (autoStartCountdownRef.current) clearInterval(autoStartCountdownRef.current)
            autoStartCountdownRef.current = setInterval(() => {
              const elapsed = Math.floor((Date.now() - autoStartSpeedStartRef.current) / 1000)
              const remaining = 30 - elapsed
              if (remaining <= 0) {
                // 30 seconds of sustained speed > 20 km/h — auto-start!
                if (autoStartCountdownRef.current) clearInterval(autoStartCountdownRef.current)
                autoStartCountdownRef.current = null
                autoStartSpeedAboveRef.current = false
                setAutoStartCountdown(null)
                startTracking()
                toast.success('🚀 Samodejni začetek sledenja!')
              } else {
                setAutoStartCountdown(remaining)
              }
            }, 1000)
          }
          // Speed is still above threshold — check if we should start
          // (handled by interval above)
        } else {
          // Speed dropped below threshold — cancel countdown
          if (autoStartSpeedAboveRef.current) {
            autoStartSpeedAboveRef.current = false
            autoStartSpeedStartRef.current = 0
            if (autoStartCountdownRef.current) {
              clearInterval(autoStartCountdownRef.current)
              autoStartCountdownRef.current = null
            }
            setAutoStartCountdown(null)
          }
        }
      },
      () => {
        // GPS error — silently ignore during monitoring
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )

    return () => {
      if (autoStartWatchRef.current !== null) {
        navigator.geolocation.clearWatch(autoStartWatchRef.current)
        autoStartWatchRef.current = null
      }
      if (autoStartCountdownRef.current) {
        clearInterval(autoStartCountdownRef.current)
        autoStartCountdownRef.current = null
      }
      autoStartSpeedAboveRef.current = false
      autoStartSpeedStartRef.current = 0
    }
  }, [autoStartEnabled, activeTab, isTracking, startTracking])

  const saveRide = useCallback(async () => {
    if (trackPoints.length < 2) { toast.error('Premalo podatkov'); return }
    try {
      // Apply privacy: obfuscate start/end if hideStartEnd enabled or in privacy zone
      let startLat = trackPoints[0].lat
      let startLng = trackPoints[0].lng
      let endLat = trackPoints[trackPoints.length - 1].lat
      let endLng = trackPoints[trackPoints.length - 1].lng

      if (settings.hideStartEnd) {
        // Obfuscate start/end by small random offset
        startLat += (Math.random() - 0.5) * 0.005
        startLng += (Math.random() - 0.5) * 0.005
        endLat += (Math.random() - 0.5) * 0.005
        endLng += (Math.random() - 0.5) * 0.005
      }

      // Check privacy zones for start/end
      const startObf = obfuscateCoordinate(startLat, startLng, privacyZones)
      if (startObf) { startLat = startObf.lat; startLng = startObf.lng }
      const endObf = obfuscateCoordinate(endLat, endLng, privacyZones)
      if (endObf) { endLat = endObf.lat; endLng = endObf.lng }

      // Filter out track points inside privacy zones from the track data
      let filteredPoints = trackPoints
      if (privacyZones.length > 0) {
        filteredPoints = trackPoints.map(p => {
          if (isInPrivacyZone(p.lat, p.lng, privacyZones)) {
            const obf = obfuscateCoordinate(p.lat, p.lng, privacyZones)
            return obf ? { ...p, lat: obf.lat, lng: obf.lng } : p
          }
          return p
        })
      }

      // Filter out GPS gap points (alt: -9999) before saving — these are interpolation markers
      const nonGapPoints = filteredPoints.filter(p => p.alt !== -9999)
      const trackData = JSON.stringify(nonGapPoints.map(p => [p.lat, p.lng, p.alt, p.timestamp]))
      const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `Vožnja ${new Date().toLocaleDateString('sl-SI')}`, distance: trackDistance, duration: trackDuration, avgSpeed: trackDuration > 0 ? Math.round((trackDistance / (trackDuration / 3600)) * 10) / 10 : 0, maxSpeed: trackMaxSpeed, elevation: Math.round(trackElevation), trackData, startLat, startLng, endLat, endLng, isPublic: true }) })
      if (res.ok) { toast.success('Vožnja shranjena!'); setTrackPoints([]); setTrackDuration(0); setTrackDistance(0); setTrackMaxSpeed(0); setTrackElevation(0); fetchData(); setShowParkingPrompt(true); setTimeout(() => setShowParkingPrompt(false), 8000); if (user?.id) fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }).then(r => r.json()).then(j => { if (j.data?.newlyEarned?.length > 0) j.data.newlyEarned.forEach((a: { title: string; icon: string }) => toast.success(`🏆 Nov dosežek: ${a.icon} ${a.title}!`)) }).catch(() => {}) }
      else toast.error('Napaka pri shranjevanju')
    } catch { toast.error('Napaka pri shranjevanju') }
  }, [trackPoints, trackDistance, trackDuration, trackMaxSpeed, trackElevation, fetchData, settings.hideStartEnd, privacyZones])

  const saveRoute = useCallback(async () => {
    if (planWaypoints.length < 2) { toast.error('Dodajte vsaj dve točki'); return }
    try {
      const routeData = JSON.stringify(planWaypoints.map(w => [w.lat, w.lng]))
      const res = await fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: planTitle || `Pot ${new Date().toLocaleDateString('sl-SI')}`, description: '', distance: planDistance, waypoints: JSON.stringify(planWaypoints), routeData, category: planCategory, difficulty: 'medium', isPublic: true }) })
      if (res.ok) {
        const j = await res.json()
        toast.success('Pot shranjena!'); setPlanWaypoints([]); setPlanTitle(''); setPlanDistance(0); fetchData();
        if (user?.id) fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }).then(r => r.json()).then(j => { if (j.data?.newlyEarned?.length > 0) j.data.newlyEarned.forEach((a: { title: string; icon: string }) => toast.success(`🏆 Nov dosežek: ${a.icon} ${a.title}!`)) }).catch(() => {})
        return j.data?.id || null
      }
      else toast.error('Napaka pri shranjevanju')
    } catch { toast.error('Napaka pri shranjevanju') }
    return null
  }, [planWaypoints, planTitle, planDistance, planCategory, fetchData])

  // Send to Phone: save route and open QR share dialog
  const sendToPhone = useCallback(async () => {
    if (planWaypoints.length < 2) { toast.error('Dodajte vsaj dve točki'); return }
    try {
      const routeData = JSON.stringify(planWaypoints.map(w => [w.lat, w.lng]))
      const title = planTitle || `Pot ${new Date().toLocaleDateString('sl-SI')}`
      const res = await fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description: '', distance: planDistance, waypoints: JSON.stringify(planWaypoints), routeData, category: planCategory, difficulty: 'medium', isPublic: true }) })
      if (res.ok) {
        const j = await res.json()
        const routeId = j.data?.id
        if (routeId) {
          setPlanShareRouteId(routeId)
          setPlanShareTitle(title)
          setShowPlanShare(true)
        }
        fetchData()
        if (user?.id) fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }).then(r => r.json()).then(j => { if (j.data?.newlyEarned?.length > 0) j.data.newlyEarned.forEach((a: { title: string; icon: string }) => toast.success(`🏆 Nov dosežek: ${a.icon} ${a.title}!`)) }).catch(() => {})
      } else {
        toast.error('Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri pošiljanju na telefon')
    }
  }, [planWaypoints, planTitle, planDistance, planCategory, fetchData, user?.id])

  // Load a tour's waypoints into the Plan tab for navigation
  const loadTourToPlan = useCallback((waypoints: { lat: number; lng: number }[], name: string) => {
    setPlanWaypoints(waypoints)
    setPlanTitle(name)
    setPlanCategory('scenic')
    setActiveTab('plan')
  }, [])

  useEffect(() => {
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (activeTab === 'plan') {
      setPlanWaypoints(prev => {
        const maxWP = planRoutingMode === 'offroad' ? 100 : 25
        if (prev.length >= maxWP) {
          toast.error(`Največ ${maxWP} točk${maxWP === 25 ? '' : ''} za ${planRoutingMode === 'offroad' ? 'terensko' : 'ta način'} načrtovanje`)
          return prev
        }
        return [...prev, { lat, lng }]
      })
    }
  }, [activeTab, planRoutingMode])

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

  const toggleLike = useCallback(async (routeId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/routes/${routeId}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })
      if (res.ok) {
        const j = await res.json()
        setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, likes: j.data.likes, userLiked: j.data.userLiked } : r))
        if (selectedItem && selectedType === 'route' && selectedItem.id === routeId) {
          setSelectedItem(prev => prev ? { ...prev, likes: j.data.likes, userLiked: j.data.userLiked } : prev)
        }
      }
    } catch { toast.error('Napaka') }
  }, [user, selectedItem, selectedType])

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

  const switchUser = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`)
      if (res.ok) {
        const j = await res.json()
        const userData = j.data || j
        setUser(userData)
        toast.success(`Preklopljen na ${userData.name || 'uporabnika'}`)
      }
    } catch { toast.error('Napaka pri preklopu') }
  }, [])

  // Prevent hydration mismatch: show skeleton until client-mounted
  // This ensures SSR and client render identical HTML on first paint
  // Uses the same LoadingSkeleton as Suspense fallback for consistency
  if (!mounted || loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - REVER-inspired with bold orange brand */}
      <header className={`fixed top-0 left-0 right-0 z-[1400] h-12 flex items-center px-4 transition-all duration-300 ${
        exploreFullscreen
          ? '-translate-y-full opacity-0 pointer-events-none'
          : activeTab === 'map'
            ? 'bg-black/40 backdrop-blur-sm'
            : 'bg-background/95 backdrop-blur-md border-b border-border/30'
      }`}>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center justify-center size-8 rounded-xl bg-primary/20 shadow-sm shadow-primary/20">
            <Bike className="size-[18px] text-primary" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col -space-y-0.5">
            <span className="font-black text-[15px] tracking-tight text-primary leading-none">MotoTrack</span>
            <span className="text-[8px] text-muted-foreground/70 uppercase tracking-[0.2em] font-semibold leading-none hidden sm:block">GPS Sledenje</span>
            <span className="text-[8px] text-primary/50 font-semibold leading-none hidden sm:block">by Markec</span>
          </div>
        </div>
        {mounted && (
          <div className="flex items-center gap-0.5">
            {/* Feature Hub button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg hover:bg-primary/10 relative"
              onClick={() => setFeatureOpen(true)}
              title="Napredne funkcije"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
            </Button>
            <NotificationBell userId={user?.id} />
            <AppShareButton />
            <NightModeToggle enabled={nightMode} onToggle={setNightMode} />
            {/* Voice commands toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={`size-8 rounded-lg ${voiceEnabled ? 'bg-red-500/20 text-red-400' : 'hover:bg-primary/10'}`}
              onClick={() => { setVoiceEnabled(v => !v); toast[voiceEnabled ? 'info' : 'success'](voiceEnabled ? '🔇 Glasovni ukazi izklopljeni' : '🎤 Glasovni ukazi vklopljeni') }}
              title={voiceEnabled ? 'Izklopi glasovne ukaze' : 'Vklopi glasovne ukaze'}
            >
              <Mic className={`size-3.5 ${voiceEnabled ? 'text-red-400' : ''}`} />
            </Button>
            {/* Twistiness heatmap toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={`size-8 rounded-lg ${showTwistiness ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-primary/10'}`}
              onClick={() => setShowTwistiness(t => !t)}
              title={showTwistiness ? 'Skrij heatmap vijugavosti' : 'Prikaži heatmap vijugavosti'}
            >
              <Activity className={`size-3.5 ${showTwistiness ? 'text-emerald-400' : ''}`} />
            </Button>
            {/* Export button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg hover:bg-primary/10"
              onClick={() => setShowExport(true)}
              title="Izvozi vožnjo (GPX/TCX/KML)"
            >
              <Download className="size-3.5" />
            </Button>
            {/* Route simulator */}
            <Button
              variant="ghost"
              size="icon"
              className={`size-8 rounded-lg ${showSimulator ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-primary/10'}`}
              onClick={() => { if (planWaypoints.length < 2) { toast.error('Narišite ruto za simulacijo'); return } setShowSimulator(s => !s) }}
              title="Simulacija rute"
            >
              <Film className={`size-3.5 ${showSimulator ? 'text-orange-400' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg hover:bg-primary/10"
              onClick={() => setSearchOpen(true)}
              title="Iskanje (Ctrl+K)"
            >
              <Search className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg hover:bg-primary/10"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Svetla tema' : 'Temna tema'}
            >
              {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </Button>
          </div>
        )}
      </header>
      {/* Header gradient accent line - REVER orange glow */}
      <div className={`header-gradient-line fixed top-12 left-0 right-0 z-[1400] transition-opacity duration-300 ${
        exploreFullscreen ? 'opacity-0' : activeTab === 'map' ? 'opacity-50' : 'opacity-100'
      }`} />

      <main className="flex-1 relative" style={{
        paddingTop: exploreFullscreen ? '0' : activeTab === 'map' ? '0' : '48px',
        paddingBottom: exploreFullscreen ? '0' : 'calc(72px + env(safe-area-inset-bottom, 0px))'
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

      {/* FAB - Floating Action Button (REVER-style) */}
      {activeTab === 'map' && (
        <div className="fixed z-[1401] left-1/2 -translate-x-1/2" style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={() => setActiveTab('track')}
            className="relative w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/40 flex items-center justify-center active:scale-95 transition-all hover:shadow-xl hover:shadow-primary/50"
          >
            <Play className="size-6 text-white fill-white ml-0.5" />
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-full bg-primary/25 animate-ping" />
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
        <ChatBubble rideId={currentRideId} userName={userName || 'Motorist'} />
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

      {/* Bottom Nav - REVER-inspired dark bar with bold orange active */}
      <nav className={`fixed bottom-0 left-0 right-0 z-[1500] bg-black/95 backdrop-blur-xl border-t border-white/5 dark:bg-black/95 transition-all duration-300 ${
        exploreFullscreen ? 'translate-y-full opacity-0 pointer-events-none' : ''
      }`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around max-w-lg mx-auto h-[72px]">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300 active:scale-90 ${isActive ? '' : 'text-white/40 hover:text-white/70'}`}>
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.6)]" />
                )}
                <div className="relative">
                  <tab.icon className={`size-[22px] transition-all duration-300 ${isActive ? 'text-primary drop-shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]' : ''}`} strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
                <span className={`relative text-[10px] tracking-tight transition-all duration-300 ${isActive ? 'text-primary font-bold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
