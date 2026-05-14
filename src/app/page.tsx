'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import dynamic from 'next/dynamic'
import {
  Map as MapIcon,
  Route,
  Play,
  Compass,
  User,
  Bike,
  Sun,
  Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useSearchParams } from 'next/navigation'

import type { TabId, RideData, RouteData, UserData, CommentData, WeatherData, LeaderboardUser, TrackPoint } from '@/components/tabs/types'
import { haversine, formatDuration, formatDate, categoryLabel, categoryColor } from '@/components/tabs/types'

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
const AppShareButton = dynamic(withRetry(() => import('@/components/app-share-button').then(m => ({ default: m.AppShareButton }))), { ssr: false, loading: () => null })

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'map', label: 'Zemljevid', icon: MapIcon },
  { id: 'plan', label: 'Načrtuj', icon: Route },
  { id: 'track', label: 'Sledi', icon: Play },
  { id: 'explore', label: 'Raziskuj', icon: Compass },
  { id: 'profile', label: 'Profil', icon: User },
]

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-background">
        <header className="fixed top-0 left-0 right-0 z-[1400] h-10 flex items-center px-4 bg-background/95 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Bike className="size-4 text-primary" />
            <span className="font-bold text-sm tracking-tight">MotoTrack</span>
          </div>
        </header>
        <main className="flex-1 pt-11 pb-20 px-4 max-w-lg mx-auto w-full">
          <div className="py-6 space-y-6">
            <Skeleton className="w-full h-48 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </main>
      </div>
    }>
      <Home />
    </Suspense>
  )
}

function Home() {
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
  const [planTitle, setPlanTitle] = useState('')
  const [planCategory, setPlanCategory] = useState('scenic')
  const [planDistance, setPlanDistance] = useState(0)

  // Track state
  const [isTracking, setIsTracking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([])
  const [trackDuration, setTrackDuration] = useState(0)
  const [trackDistance, setTrackDistance] = useState(0)
  const [trackMaxSpeed, setTrackMaxSpeed] = useState(0)
  const [trackCurrentSpeed, setTrackCurrentSpeed] = useState(0)
  const [trackElevation, setTrackElevation] = useState(0)
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedDurationRef = useRef<number>(0)
  const isPausedRef = useRef(false)

  // Detail dialog
  const [selectedItem, setSelectedItem] = useState<RideData | RouteData | null>(null)
  const [selectedType, setSelectedType] = useState<'ride' | 'route'>('ride')
  const [detailOpen, setDetailOpen] = useState(false)

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
  const searchParams = useSearchParams()
  const initialTab = useMemo(() => {
    const tab = searchParams.get('tab')
    if (tab === 'plan' || tab === 'track' || tab === 'explore' || tab === 'profile') return tab
    return 'map' as TabId
  }, [])
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  // Fetch data - only seed if database is empty
  const fetchData = useCallback(async () => {
    try {
      // Only seed if database has no users (first time)
      if (!seedChecked.current) {
        seedChecked.current = true
        try {
          const checkRes = await fetch('/api/users')
          if (checkRes.ok) {
            const checkData = await checkRes.json()
            const existingUsers = checkData.data || checkData
            if (!existingUsers || existingUsers.length === 0) {
              await fetch('/api/seed', { method: 'POST' })
            }
          }
        } catch { /* ignore seed check errors */ }
      }
      const [ridesRes, routesRes, userRes, usersRes] = await Promise.all([
        fetch('/api/rides?public=true'),
        fetch('/api/routes?public=true'),
        fetch('/api/user'),
        fetch('/api/users'),
      ])
      if (ridesRes.ok) { const j = await ridesRes.json(); setRides(j.data || j) }
      if (routesRes.ok) { const j = await routesRes.json(); setRoutes(j.data || j) }
      if (userRes.ok) { const j = await userRes.json(); setUser(j.data || j) }
      if (usersRes.ok) { const j = await usersRes.json(); setAllUsers(j.data || j) }
    } catch (err) { console.error('Fetch error:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch leaderboard
  useEffect(() => {
    fetch('/api/leaderboard').then(r => r.json()).then(j => setLeaderboard(j.data || [])).catch(() => {})
  }, [])

  // Calculate plan distance
  useEffect(() => {
    let dist = 0
    for (let i = 1; i < planWaypoints.length; i++) {
      dist += haversine(planWaypoints[i - 1].lat, planWaypoints[i - 1].lng, planWaypoints[i].lat, planWaypoints[i].lng)
    }
    setPlanDistance(Math.round(dist * 10) / 10)
  }, [planWaypoints])

  // GPS Tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { toast.error('Geolokacija ni na voljo'); return }
    setIsTracking(true); setIsPaused(false); isPausedRef.current = false; setTrackPoints([]); setTrackDuration(0)
    setTrackDistance(0); setTrackMaxSpeed(0); setTrackCurrentSpeed(0); setTrackElevation(0)
    startTimeRef.current = Date.now(); pausedDurationRef.current = 0
    timerRef.current = setInterval(() => { if (!isPausedRef.current) setTrackDuration(p => p + 1) }, 1000)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude, timestamp: Date.now() }
        setTrackPoints(prev => {
          if (prev.length > 0) { const lp = prev[prev.length - 1]; const d = haversine(lp.lat, lp.lng, point.lat, point.lng); setTrackDistance(dd => Math.round((dd + d) * 100) / 100) }
          return [...prev, point]
        })
        if (pos.coords.speed !== null && pos.coords.speed >= 0) {
          const kph = Math.round(pos.coords.speed * 3.6 * 10) / 10
          setTrackCurrentSpeed(kph); setTrackMaxSpeed(max => Math.max(max, kph))
        }
      },
      () => toast.error('Napaka pri pridobivanju lokacije'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }, [])

  const pauseTracking = useCallback(() => { setIsPaused(true); isPausedRef.current = true; pausedDurationRef.current = Date.now() }, [])
  const resumeTracking = useCallback(() => { setIsPaused(false); isPausedRef.current = false; if (pausedDurationRef.current) startTimeRef.current += Date.now() - pausedDurationRef.current }, [])
  const stopTracking = useCallback(() => {
    setIsTracking(false); setIsPaused(false); isPausedRef.current = false
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setTrackCurrentSpeed(0)
  }, [])

  const saveRide = useCallback(async () => {
    if (trackPoints.length < 2) { toast.error('Premalo podatkov'); return }
    try {
      const trackData = JSON.stringify(trackPoints.map(p => [p.lat, p.lng, p.alt, p.timestamp]))
      const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `Vožnja ${new Date().toLocaleDateString('sl-SI')}`, distance: trackDistance, duration: trackDuration, avgSpeed: trackDuration > 0 ? Math.round((trackDistance / (trackDuration / 3600)) * 10) / 10 : 0, maxSpeed: trackMaxSpeed, elevation: Math.round(trackElevation), trackData, startLat: trackPoints[0].lat, startLng: trackPoints[0].lng, endLat: trackPoints[trackPoints.length - 1].lat, endLng: trackPoints[trackPoints.length - 1].lng, isPublic: true }) })
      if (res.ok) { toast.success('Vožnja shranjena!'); setTrackPoints([]); setTrackDuration(0); setTrackDistance(0); setTrackMaxSpeed(0); setTrackElevation(0); fetchData(); if (user?.id) fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }).then(r => r.json()).then(j => { if (j.data?.newlyEarned?.length > 0) j.data.newlyEarned.forEach((a: { title: string; icon: string }) => toast.success(`🏆 Nov dosežek: ${a.icon} ${a.title}!`)) }).catch(() => {}) }
      else toast.error('Napaka pri shranjevanju')
    } catch { toast.error('Napaka pri shranjevanju') }
  }, [trackPoints, trackDistance, trackDuration, trackMaxSpeed, trackElevation, fetchData])

  const saveRoute = useCallback(async () => {
    if (planWaypoints.length < 2) { toast.error('Dodajte vsaj dve točki'); return }
    try {
      const routeData = JSON.stringify(planWaypoints.map(w => [w.lat, w.lng]))
      const res = await fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: planTitle || `Pot ${new Date().toLocaleDateString('sl-SI')}`, description: '', distance: planDistance, waypoints: JSON.stringify(planWaypoints), routeData, category: planCategory, difficulty: 'medium', isPublic: true }) })
      if (res.ok) { toast.success('Pot shranjena!'); setPlanWaypoints([]); setPlanTitle(''); setPlanDistance(0); fetchData(); if (user?.id) fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }).then(r => r.json()).then(j => { if (j.data?.newlyEarned?.length > 0) j.data.newlyEarned.forEach((a: { title: string; icon: string }) => toast.success(`🏆 Nov dosežek: ${a.icon} ${a.title}!`)) }).catch(() => {}) }
      else toast.error('Napaka pri shranjevanju')
    } catch { toast.error('Napaka pri shranjevanju') }
  }, [planWaypoints, planTitle, planDistance, planCategory, fetchData])

  useEffect(() => {
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (activeTab === 'plan') setPlanWaypoints(prev => [...prev, { lat, lng }])
  }, [activeTab])

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

  // Loading skeleton for initial data fetch
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header skeleton */}
        <header className="fixed top-0 left-0 right-0 z-[1400] h-11 flex items-center px-4 bg-background/95 backdrop-blur-md">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
              <Bike className="size-4 text-primary" strokeWidth={2.2} />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-primary">MotoTrack</span>
            <span className="text-[9px] text-muted-foreground/60 hidden sm:inline uppercase tracking-widest">GPS Sledenje</span>
          </div>
        </header>
        <div className="header-gradient-line fixed top-11 left-0 right-0 z-[1400]" />

        <main className="flex-1 pt-10 pb-16 px-4 max-w-lg mx-auto w-full">
          <div className="py-6 space-y-6">
            {/* Map placeholder skeleton */}
            <Skeleton className="w-full h-48 rounded-xl" />
            {/* Stats row */}
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
            {/* Card skeletons */}
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </main>

        {/* Bottom nav skeleton */}
        <nav className="fixed bottom-0 left-0 right-0 z-[1500] bg-background/95 backdrop-blur-md border-t border-border/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-around max-w-lg mx-auto h-16">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex flex-col items-center gap-1 px-3 py-2">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-2.5 w-8" />
              </div>
            ))}
          </div>
        </nav>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - REVER-inspired with bold brand */}
      <header className={`fixed top-0 left-0 right-0 z-[1400] h-11 flex items-center px-4 transition-all duration-300 ${
        activeTab === 'map'
          ? 'bg-black/30 backdrop-blur-sm'
          : 'bg-background/95 backdrop-blur-md'
      }`}>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
            <Bike className="size-4 text-primary" strokeWidth={2.2} />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-primary">MotoTrack</span>
          <span className="text-[9px] text-muted-foreground/60 hidden sm:inline uppercase tracking-widest">GPS Sledenje</span>
        </div>
        {mounted && (
          <div className="flex items-center gap-1">
            <NotificationBell userId={user?.id} />
            <AppShareButton />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Svetla tema' : 'Temna tema'}
            >
              {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </Button>
          </div>
        )}
      </header>
      {/* Header gradient accent line */}
      <div className={`header-gradient-line fixed top-11 left-0 right-0 z-[1400] transition-opacity duration-300 ${
        activeTab === 'map' ? 'opacity-40' : 'opacity-100'
      }`} />

      <main className="flex-1 relative" style={{ paddingTop: activeTab === 'map' ? '0' : '44px', paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
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
              distance={planDistance} onMapClick={handleMapClick} onSave={saveRoute}
              userId={user?.id || ''} onRefresh={fetchData}
            />
          )}
          {activeTab === 'track' && (
            <TrackTab
              isTracking={isTracking} isPaused={isPaused}
              trackPoints={trackPoints} duration={trackDuration}
              distance={trackDistance} maxSpeed={trackMaxSpeed}
              currentSpeed={trackCurrentSpeed} elevation={trackElevation}
              userId={user?.id}
              onStart={startTracking} onPause={pauseTracking}
              onResume={resumeTracking} onStop={stopTracking}
              onSave={saveRide}
            />
          )}
          {activeTab === 'explore' && (
            <ExploreTab
              rides={rides} routes={routes} leaderboard={leaderboard}
              onOpenDetail={openDetail} onSwitchUser={switchUser}
              userId={user?.id}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileTab
              user={user} allUsers={allUsers} rides={rides} routes={routes}
              loading={loading} onSwitchUser={switchUser}
              onOpenDetail={openDetail} onRefresh={fetchData}
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

      {/* SOS Button */}
      <SosButton userId={user?.id} />

      {/* AI Chat */}
      <MotoChat />

      {/* PWA Install Prompt */}
      <PwaInstallPrompt />

      {/* Bottom Nav - REVER-inspired with bold orange active state */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1500] bg-card/95 backdrop-blur-xl border-t border-border/30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around max-w-lg mx-auto h-16">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-300 active:scale-95 ${isActive ? '' : 'text-muted-foreground/60 hover:text-foreground/80'}`}>
                {/* Active background glow */}
                {isActive && (
                  <div className="absolute inset-0 rounded-2xl bg-primary/15 shadow-[0_0_16px_rgba(var(--primary-rgb),0.2)]" />
                )}
                {/* Active dot indicator above icon */}
                {isActive && (
                  <div className="absolute -top-0.5 size-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(var(--primary-rgb),0.6)]" />
                )}
                <div className="relative">
                  <tab.icon className={`size-[22px] transition-all duration-300 ${isActive ? 'text-primary drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]' : ''}`} strokeWidth={isActive ? 2.5 : 1.8} />
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
