'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  Map as MapIcon,
  Route,
  Play,
  Pause,
  Square,
  Compass,
  User,
  LocateFixed,
  Trash2,
  Save,
  ChevronUp,
  ChevronDown,
  X,
  Clock,
  Gauge,
  TrendingUp,
  Bike,
  Heart,
  MapPin,
  Mountain,
  AlertTriangle,
  Search,
  MessageCircle,
  Send,
  Trophy,
  Cloud,
  CloudRain,
  Sun,
  CloudSun,
  Wind,
  Thermometer,
  Droplets,
  Users,
  ChevronRight,
  Flame,
  Crown,
  Medal,
  Star,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'

import { toast } from 'sonner'

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })
const MotoChat = dynamic(() => import('@/components/moto-chat'), { ssr: false })

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */
interface TrackPoint {
  lat: number
  lng: number
  alt: number | null
  timestamp: number
}

interface RideData {
  id: string
  title: string
  description?: string
  distance: number
  duration: number
  avgSpeed: number
  maxSpeed: number
  elevation: number
  isPublic: boolean
  trackData: string
  startLat?: number | null
  startLng?: number | null
  endLat?: number | null
  endLng?: number | null
  userId: string
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
}

interface RouteData {
  id: string
  title: string
  description?: string
  distance: number
  waypoints: string
  routeData: string | null
  category: string
  difficulty: string
  isPublic: boolean
  likes: number
  userId: string
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
  userLiked?: boolean
}

interface UserData {
  id: string
  name: string
  email: string
  avatar: string | null
  bike: string | null
  bio: string | null
  stats: {
    totalRides: number
    totalRoutes: number
    totalDistance: number
    totalElevation: number
    avgSpeed: number
  }
}

interface CommentData {
  id: string
  text: string
  userId: string
  rideId?: string | null
  routeId?: string | null
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
}

interface WeatherData {
  current: {
    temperature: number
    windspeed: number
    weathercode: number
    description: string
  } | null
  forecast: Array<{
    date: string
    tempMax: number
    tempMin: number
    precipitation: number
    windMax: number
    description: string
  }>
}

interface LeaderboardUser {
  id: string
  name: string
  avatar: string | null
  bike: string | null
  totalRides: number
  totalRoutes: number
  totalDistance: number
  totalElevation: number
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = { scenic: 'Slikovito', twisty: 'Vijugasto', offroad: 'Terensko', city: 'Mesto' }
  return map[cat] || cat
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    scenic: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    twisty: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    offroad: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    city: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  }
  return map[cat] || ''
}

function difficultyLabel(d: string): string {
  const map: Record<string, string> = { easy: 'Lahko', medium: 'Srednje', hard: 'Težko' }
  return map[d] || d
}

function weatherIcon(code: number) {
  if (code <= 1) return <Sun className="size-5 text-amber-400" />
  if (code <= 3) return <CloudSun className="size-5 text-slate-300" />
  if (code <= 48) return <Cloud className="size-5 text-slate-400" />
  if (code <= 67) return <CloudRain className="size-5 text-blue-400" />
  return <CloudRain className="size-5 text-blue-500" />
}

/* ------------------------------------------------------------------ */
/*  TABS CONFIG                                                        */
/* ------------------------------------------------------------------ */
type TabId = 'map' | 'plan' | 'track' | 'explore' | 'profile'

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'map', label: 'Zemljevid', icon: MapIcon },
  { id: 'plan', label: 'Načrtuj', icon: Route },
  { id: 'track', label: 'Sledi', icon: Play },
  { id: 'explore', label: 'Raziskuj', icon: Compass },
  { id: 'profile', label: 'Profil', icon: User },
]

/* ================================================================== */
/*  MAIN PAGE COMPONENT                                                */
/* ================================================================== */
export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('map')
  const [rides, setRides] = useState<RideData[]>([])
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string; avatar: string | null; bike: string | null; bio: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [showNearbyPanel, setShowNearbyPanel] = useState(false)
  const [seeded, setSeeded] = useState(false)

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

  // Explore state
  const [exploreFilter, setExploreFilter] = useState<'all' | 'rides' | 'routes'>('all')
  const [exploreCategory, setExploreCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Map search state
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [mapSearchFocused, setMapSearchFocused] = useState(false)

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

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      if (!seeded) {
        await fetch('/api/seed', { method: 'POST' })
        setSeeded(true)
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
  }, [seeded])

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
    setIsTracking(true); setIsPaused(false); setTrackPoints([]); setTrackDuration(0)
    setTrackDistance(0); setTrackMaxSpeed(0); setTrackCurrentSpeed(0); setTrackElevation(0)
    startTimeRef.current = Date.now(); pausedDurationRef.current = 0
    timerRef.current = setInterval(() => { if (!isPaused) setTrackDuration(p => p + 1) }, 1000)
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
        if (pos.coords.altitude !== null) {
          setTrackElevation(prev => {
            const last = trackPoints[trackPoints.length - 1]
            if (last?.alt !== null && last?.alt !== undefined) { const diff = pos.coords.altitude! - last.alt!; if (diff > 0) return prev + diff }
            return prev
          })
        }
      },
      () => toast.error('Napaka pri pridobivanju lokacije'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }, [isPaused, trackPoints])

  const pauseTracking = useCallback(() => { setIsPaused(true); pausedDurationRef.current = Date.now() }, [])
  const resumeTracking = useCallback(() => { setIsPaused(false); if (pausedDurationRef.current) startTimeRef.current += Date.now() - pausedDurationRef.current }, [])
  const stopTracking = useCallback(() => {
    setIsTracking(false); setIsPaused(false)
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setTrackCurrentSpeed(0)
  }, [])

  const saveRide = useCallback(async () => {
    if (trackPoints.length < 2) { toast.error('Premalo podatkov'); return }
    try {
      const trackData = JSON.stringify(trackPoints.map(p => [p.lat, p.lng, p.alt, p.timestamp]))
      const res = await fetch('/api/rides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `Vožnja ${new Date().toLocaleDateString('sl-SI')}`, distance: trackDistance, duration: trackDuration, avgSpeed: trackDuration > 0 ? Math.round((trackDistance / (trackDuration / 3600)) * 10) / 10 : 0, maxSpeed: trackMaxSpeed, elevation: Math.round(trackElevation), trackData, startLat: trackPoints[0].lat, startLng: trackPoints[0].lng, endLat: trackPoints[trackPoints.length - 1].lat, endLng: trackPoints[trackPoints.length - 1].lng, isPublic: true }) })
      if (res.ok) { toast.success('Vožnja shranjena!'); setTrackPoints([]); setTrackDuration(0); setTrackDistance(0); setTrackMaxSpeed(0); setTrackElevation(0); fetchData() }
      else toast.error('Napaka pri shranjevanju')
    } catch { toast.error('Napaka pri shranjevanju') }
  }, [trackPoints, trackDistance, trackDuration, trackMaxSpeed, trackElevation, fetchData])

  const saveRoute = useCallback(async () => {
    if (planWaypoints.length < 2) { toast.error('Dodajte vsaj dve točki'); return }
    try {
      const routeData = JSON.stringify(planWaypoints.map(w => [w.lat, w.lng]))
      const res = await fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: planTitle || `Pot ${new Date().toLocaleDateString('sl-SI')}`, description: '', distance: planDistance, waypoints: JSON.stringify(planWaypoints), routeData, category: planCategory, difficulty: 'medium', isPublic: true }) })
      if (res.ok) { toast.success('Pot shranjena!'); setPlanWaypoints([]); setPlanTitle(''); setPlanDistance(0); fetchData() }
      else toast.error('Napaka pri shranjevanju')
    } catch { toast.error('Napaka pri shranjevanju') }
  }, [planWaypoints, planTitle, planDistance, planCategory, fetchData])

  useEffect(() => {
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Explore filtered items
  const filteredItems = useMemo(() => {
    const items: Array<{ type: 'ride' | 'route'; data: RideData | RouteData; category: string }> = [
      ...rides.map(r => ({ type: 'ride' as const, data: r as RideData | RouteData, category: 'scenic' })),
      ...routes.map(r => ({ type: 'route' as const, data: r as RideData | RouteData, category: r.category })),
    ]
    return items.filter(item => {
      if (exploreFilter === 'rides' && item.type !== 'ride') return false
      if (exploreFilter === 'routes' && item.type !== 'route') return false
      if (exploreCategory !== 'all' && item.category !== exploreCategory) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const title = item.data.title.toLowerCase()
        const desc = (item.data.description || '').toLowerCase()
        if (!title.includes(q) && !desc.includes(q)) return false
      }
      return true
    })
  }, [rides, routes, exploreFilter, exploreCategory, searchQuery])

  const exploreStats = useMemo(() => ({
    totalRides: rides.length, totalRoutes: routes.length,
    totalDistance: Math.round(rides.reduce((s, r) => s + r.distance, 0) + routes.reduce((s, r) => s + r.distance, 0)),
  }), [rides, routes])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (activeTab === 'plan') setPlanWaypoints(prev => [...prev, { lat, lng }])
  }, [activeTab])

  // Open detail - fetch comments & weather
  const openDetail = useCallback(async (item: RideData | RouteData, type: 'ride' | 'route') => {
    setSelectedItem(item); setSelectedType(type); setDetailOpen(true)
    setComments([]); setNewComment(''); setCommentsLoading(true)
    // Fetch comments
    const param = type === 'ride' ? `rideId=${item.id}` : `routeId=${item.id}`
    fetch(`/api/comments?${param}`).then(r => r.json()).then(j => { setComments(j.data || []); setCommentsLoading(false) }).catch(() => setCommentsLoading(false))
    // Fetch weather
    const lat = (item as RideData).startLat || 46.15
    const lng = (item as RideData).startLng || 14.99
    setWeatherLoading(true)
    fetch(`/api/weather?lat=${lat}&lng=${lng}`).then(r => r.json()).then(j => { setWeather(j.data || null); setWeatherLoading(false) }).catch(() => setWeatherLoading(false))
  }, [])

  // Toggle like
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

  // Post comment
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

  // Switch user
  const switchUser = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`)
      if (res.ok) {
        const u = await res.json(); setUser(u.data || u); toast.success(`Preklopljen na ${u.name || u.data?.name}`)
      }
    } catch { toast.error('Napaka pri preklopu') }
  }, [])

  // Elevation profile data
  const elevationData = useMemo(() => {
    if (!selectedItem || selectedType !== 'ride') return []
    try {
      const track = JSON.parse((selectedItem as RideData).trackData)
      if (!Array.isArray(track)) return []
      const step = Math.max(1, Math.floor(track.length / 60))
      return track.filter((_: unknown, i: number) => i % step === 0).map((p: number[], i: number) => ({
        km: Math.round(i * ((selectedItem as RideData).distance / 60) * 10) / 10,
        višina: p[2] || 0,
      }))
    } catch { return [] }
  }, [selectedItem, selectedType])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ============ BRANDED HEADER BAR ============ */}
      <header className={`fixed top-0 left-0 right-0 z-[1400] h-10 flex items-center px-4 border-b transition-all duration-300 ${
        activeTab === 'map'
          ? 'bg-background/40 backdrop-blur-sm border-transparent'
          : 'bg-background/95 backdrop-blur-md border-border/50'
      }`}>
        <div className="flex items-center gap-2">
          <Bike className="size-4 text-primary" />
          <span className="font-bold text-sm tracking-tight">MotoTrack</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">GPS Sledenje</span>
        </div>
      </header>

      <main className="flex-1 relative" style={{ paddingTop: activeTab === 'map' ? '0' : '40px', paddingBottom: '64px' }}>

        {/* ============ ZEMLJEVID VIEW ============ */}
        {activeTab === 'map' && (
          <div className="relative w-full h-[calc(100vh-64px)]">
            <MotoMap center={[46.15, 14.99]} zoom={8} rides={rides} routes={routes} className="z-0" />
            {/* Floating search bar */}
            <div className="absolute top-12 left-4 right-4 z-[1001]">
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Išči vožnje in poti..."
                  value={mapSearchQuery}
                  onChange={e => setMapSearchQuery(e.target.value)}
                  onFocus={() => setMapSearchFocused(true)}
                  onBlur={() => setTimeout(() => setMapSearchFocused(false), 200)}
                  className="pl-9 bg-background/90 backdrop-blur-sm border-border/50 shadow-lg"
                />
                {mapSearchQuery && (
                  <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setMapSearchQuery('')}>
                    <X className="size-3" />
                  </Button>
                )}
                {mapSearchFocused && mapSearchQuery && (
                  <div className="absolute top-full mt-1 w-full bg-background/95 backdrop-blur-md rounded-lg border border-border/50 shadow-xl max-h-60 overflow-y-auto">
                    {[...rides.map(r => ({ ...r, _type: 'ride' as const })), ...routes.map(r => ({ ...r, _type: 'route' as const }))]
                      .filter(item => item.title.toLowerCase().includes(mapSearchQuery.toLowerCase()))
                      .map(item => (
                        <div key={item.id + item._type} className="p-2.5 hover:bg-secondary/50 cursor-pointer transition-colors" onClick={() => { openDetail(item, item._type); setMapSearchQuery('') }}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{item.title}</span>
                            <Badge variant="outline" className={`text-[10px] ${item._type === 'ride' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                              {item._type === 'ride' ? 'Vožnja' : 'Pot'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5"><span>{item.distance} km</span></div>
                        </div>
                      ))}
                    {[...rides, ...routes].filter(item => item.title.toLowerCase().includes(mapSearchQuery.toLowerCase())).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">Ni zadetkov</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Legend */}
            <div className="absolute top-12 right-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs mb-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /><span>Vožnje ({rides.length})</span></div>
              <div className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /><span>Poti ({routes.length})</span></div>
            </div>
            {/* Locate */}
            <Button variant="outline" size="icon" className="absolute bottom-4 right-4 z-[1000] bg-background/90 backdrop-blur-sm border-border/50 hover:bg-primary/10"
              onClick={() => { navigator.geolocation?.getCurrentPosition(pos => toast.success(`Lokacija: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`), () => toast.error('Ne morem pridobiti lokacije')) }}>
              <LocateFixed className="size-5" />
            </Button>
            {/* Nearby panel */}
            <div className="absolute bottom-4 left-4 right-16 z-[1000]">
              <Button variant="outline" className="w-full bg-background/90 backdrop-blur-sm border-border/50 hover:bg-primary/10" onClick={() => setShowNearbyPanel(!showNearbyPanel)}>
                {showNearbyPanel ? <ChevronDown className="size-4 mr-2" /> : <ChevronUp className="size-4 mr-2" />}
                {rides.length + routes.length} voženj in poti
              </Button>
              {showNearbyPanel && (
                <ScrollArea className="max-h-60 mt-2 bg-background/95 backdrop-blur-sm rounded-lg border border-border/50 p-2">
                  {[...rides.map(r => ({ ...r, _type: 'ride' as const })), ...routes.map(r => ({ ...r, _type: 'route' as const }))].map(item => (
                    <div key={item.id + item._type} className="p-2 hover:bg-secondary/50 rounded cursor-pointer transition-colors" onClick={() => openDetail(item, item._type)}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{item.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${item._type === 'ride' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                          {item._type === 'ride' ? 'Vožnja' : 'Pot'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1"><span>{item.distance} km</span></div>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* ============ NAČRTUJ VIEW ============ */}
        {activeTab === 'plan' && (
          <div className="relative w-full h-[calc(100vh-104px)] flex flex-col lg:flex-row">
            <div className="flex-1 relative">
              <MotoMap center={[46.15, 14.99]} zoom={8} rides={[]} routes={[]} planWaypoints={planWaypoints} showPlan={true} onMapClick={handleMapClick} />
            </div>
            <div className="lg:w-80 w-full bg-card border-t lg:border-t-0 lg:border-l border-border/50 p-4 overflow-y-auto max-h-[40vh] lg:max-h-full">
              <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><Route className="size-5 text-primary" />Načrtuj pot</h2>
              <div className="space-y-4">
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Ime poti</label><Input placeholder="Npr. Obala do Pirana" value={planTitle} onChange={e => setPlanTitle(e.target.value)} /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Kategorija</label><div className="flex flex-wrap gap-2">{['scenic', 'twisty', 'offroad', 'city'].map(cat => (<Button key={cat} variant={planCategory === cat ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setPlanCategory(cat)}>{categoryLabel(cat)}</Button>))}</div></div>
                <div className="flex items-center justify-between"><label className="text-sm">Izogni se avtocestam</label><Switch checked={planAvoidHighways} onCheckedChange={setPlanAvoidHighways} /></div>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2"><label className="text-xs font-medium text-muted-foreground">Točke ({planWaypoints.length})</label>{planWaypoints.length > 0 && <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={() => { setPlanWaypoints([]); setPlanDistance(0) }}><Trash2 className="size-3 mr-1" />Počisti</Button>}</div>
                  <ScrollArea className="max-h-40">
                    {planWaypoints.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Kliknite na zemljevid za dodajanje točk</p> : (
                      <div className="space-y-1">{planWaypoints.map((wp, i) => (<div key={i} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1.5"><div className="flex items-center gap-2"><MapPin className="size-3 text-primary" /><span>Točka {i + 1}</span><span className="text-muted-foreground">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span></div><Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => setPlanWaypoints(prev => prev.filter((_, idx) => idx !== i))}><X className="size-3" /></Button></div>))}</div>
                    )}
                  </ScrollArea>
                </div>
                {planWaypoints.length > 1 && (<div className="bg-primary/10 rounded-lg p-3"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Skupna razdalja</span><span className="font-bold text-primary">{planDistance} km</span></div></div>)}
                <Button className="w-full" onClick={saveRoute} disabled={planWaypoints.length < 2}><Save className="size-4 mr-2" />Shrani pot</Button>
              </div>
            </div>
          </div>
        )}

        {/* ============ SLEDI VIEW ============ */}
        {activeTab === 'track' && (
          <div className="relative w-full h-[calc(100vh-104px)] flex flex-col">
            <div className="flex-1 relative"><MotoMap center={[46.15, 14.99]} zoom={12} rides={[]} routes={[]} trackPoints={trackPoints} showTrack={true} /></div>
            <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-md border-t border-border/50">
              <div className="text-center py-2"><span className="text-3xl font-mono font-bold text-primary">{formatDuration(trackDuration)}</span></div>
              <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Razdalja</p><p className="text-sm font-bold">{trackDistance.toFixed(1)} km</p></div>
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Hitrost</p><p className="text-sm font-bold">{trackCurrentSpeed} km/h</p></div>
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Max</p><p className="text-sm font-bold">{trackMaxSpeed} km/h</p></div>
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Nadm. viš.</p><p className="text-sm font-bold">{Math.round(trackElevation)} m</p></div>
              </div>
              <div className="flex items-center justify-center gap-3 pb-3 px-4">
                {!isTracking ? (
                  <Button size="lg" className="px-8" onClick={startTracking}><Play className="size-5 mr-2" />Začni sledenje</Button>
                ) : (<>
                  {isPaused ? <Button size="lg" variant="outline" className="px-6" onClick={resumeTracking}><Play className="size-4 mr-2" />Nadaljuj</Button> : <Button size="lg" variant="outline" className="px-6" onClick={pauseTracking}><Pause className="size-4 mr-2" />Premor</Button>}
                  <Button size="lg" variant="destructive" className="px-6" onClick={stopTracking}><Square className="size-4 mr-2" />Ustavi</Button>
                </>)}
              </div>
              {!isTracking && trackPoints.length > 1 && (<div className="px-4 pb-3"><Button className="w-full" onClick={saveRide}><Save className="size-4 mr-2" />Shrani vožnjo ({trackDistance.toFixed(1)} km, {formatDuration(trackDuration)})</Button></div>)}
            </div>
          </div>
        )}

        {/* ============ RAZISKUJ VIEW ============ */}
        {activeTab === 'explore' && (
          <div className="w-full h-[calc(100vh-104px)] overflow-y-auto custom-scrollbar">
            <div className="mx-auto max-w-4xl px-4 py-6">
              {/* Featured route hero card */}
              {routes.length > 0 && (() => {
                const featured = [...routes].sort((a, b) => b.likes - a.likes)[0]
                return (
                  <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/30 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => openDetail(featured, 'route')}>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="size-4 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Izpostavljena pot</span>
                      </div>
                      <h3 className="font-bold text-lg">{featured.title}</h3>
                      {featured.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{featured.description}</p>}
                      <div className="flex items-center gap-4 mt-3">
                        <Badge variant="outline" className={categoryColor(featured.category)}>{categoryLabel(featured.category)}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Route className="size-3" />{featured.distance} km</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="size-3" />{featured.likes}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="size-3" />{featured.user?.name || 'Neznan'}</span>
                      </div>
                    </div>
                  </Card>
                )
              })()}
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="text-center"><CardContent className="p-4"><Bike className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{exploreStats.totalRides}</p><p className="text-xs text-muted-foreground">Voženj</p></CardContent></Card>
                <Card className="text-center"><CardContent className="p-4"><Route className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{exploreStats.totalRoutes}</p><p className="text-xs text-muted-foreground">Poti</p></CardContent></Card>
                <Card className="text-center"><CardContent className="p-4"><TrendingUp className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{exploreStats.totalDistance}</p><p className="text-xs text-muted-foreground">km skupaj</p></CardContent></Card>
              </div>

              {/* Search + Filters */}
              <div className="space-y-3 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input placeholder="Išči po imenu ali opisu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                  {searchQuery && <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setSearchQuery('')}><X className="size-3" /></Button>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
                    {(['all', 'rides', 'routes'] as const).map(f => (<Button key={f} variant={exploreFilter === f ? 'default' : 'ghost'} size="sm" className="text-xs" onClick={() => setExploreFilter(f)}>{f === 'all' ? 'Vse' : f === 'rides' ? 'Vožnje' : 'Poti'}</Button>))}
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex gap-1">{['all', 'scenic', 'twisty', 'offroad', 'city'].map(cat => (<Button key={cat} variant={exploreCategory === cat ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setExploreCategory(cat)}>{cat === 'all' ? 'Vse' : categoryLabel(cat)}</Button>))}</div>
                </div>
              </div>

              {/* Grid */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-12"><Compass className="size-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Ni najdenih voženj ali poti</p></div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {filteredItems.map(item => (
                    <Card key={item.data.id + item.type} className="hover:border-primary/30 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => openDetail(item.data, item.type)}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between">
                          <div><CardTitle className="text-sm">{item.data.title}</CardTitle><CardDescription className="text-xs mt-1 line-clamp-2">{item.data.description}</CardDescription></div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ml-2 ${item.type === 'ride' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : categoryColor((item.data as RouteData).category)}`}>
                            {item.type === 'ride' ? 'Vožnja' : categoryLabel((item.data as RouteData).category)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Route className="size-3" />{item.data.distance} km</span>
                          {item.type === 'ride' && 'duration' in item.data && <span className="flex items-center gap-1"><Clock className="size-3" />{formatDuration((item.data as RideData).duration)}</span>}
                          {item.type === 'route' && 'likes' in item.data && <span className="flex items-center gap-1"><Heart className="size-3" />{(item.data as RouteData).likes}</span>}
                          <span className="flex items-center gap-1"><User className="size-3" />{item.data.user?.name || 'Neznan'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Leaderboard section */}
              {leaderboard.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Trophy className="size-5 text-primary" />Lestvica motoristov</h3>
                  <div className="space-y-2">
                    {leaderboard.map((u, i) => (
                      <Card key={u.id} className="hover:border-primary/30 transition-all cursor-pointer" onClick={() => switchUser(u.id)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`flex items-center justify-center size-8 rounded-full shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-secondary text-muted-foreground'}`}>
                            {i === 0 ? <Crown className="size-4" /> : i === 1 ? <Medal className="size-4" /> : i === 2 ? <Medal className="size-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                          </div>
                          <Avatar className="size-9"><AvatarFallback className="text-xs bg-primary/20 text-primary">{u.name.charAt(0)}</AvatarFallback></Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.bike || 'Motocikel'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-primary">{u.totalDistance} km</p>
                            <p className="text-[10px] text-muted-foreground">{u.totalRides} voženj · {u.totalElevation}m</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ PROFIL VIEW ============ */}
        {activeTab === 'profile' && (
          <div className="w-full h-[calc(100vh-104px)] overflow-y-auto custom-scrollbar">
            <div className="mx-auto max-w-lg px-4 py-6">
              {loading ? (
                <div className="text-center py-12"><User className="size-12 text-muted-foreground mx-auto mb-4 animate-pulse" /><p className="text-muted-foreground">Nalaganje...</p></div>
              ) : user ? (
                <div className="space-y-6">
                  {/* User switcher */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2"><Users className="size-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Preklopi uporabnika</span></div>
                      <div className="flex gap-2">
                        {allUsers.map(u => (
                          <Button key={u.id} variant={user.id === u.id ? 'default' : 'outline'} size="sm" className="text-xs gap-1.5" onClick={() => switchUser(u.id)}>
                            <Avatar className="size-5"><AvatarFallback className="text-[8px]">{u.name.charAt(0)}</AvatarFallback></Avatar>
                            {u.name}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* User card */}
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Avatar className="size-20 mx-auto mb-4"><AvatarFallback className="text-2xl bg-primary/20 text-primary">{user.name.charAt(0)}</AvatarFallback></Avatar>
                      <h2 className="text-xl font-bold">{user.name}</h2>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.bike && <Badge className="mt-2 bg-primary/20 text-primary border-primary/30"><Bike className="size-3 mr-1" />{user.bike}</Badge>}
                      {user.bio && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{user.bio}</p>}
                    </CardContent>
                  </Card>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card><CardContent className="p-4 text-center"><Bike className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalRides}</p><p className="text-xs text-muted-foreground">Voženj</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><Route className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalRoutes}</p><p className="text-xs text-muted-foreground">Poti</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><TrendingUp className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalDistance}</p><p className="text-xs text-muted-foreground">km skupaj</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><Mountain className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalElevation}</p><p className="text-xs text-muted-foreground">m višine</p></CardContent></Card>
                  </div>

                  {/* Performance */}
                  <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Uspešnost</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="space-y-1"><div className="flex justify-between text-xs"><span>Povprečna hitrost</span><span className="text-primary font-medium">{user.stats.avgSpeed} km/h</span></div><Progress value={Math.min((user.stats.avgSpeed / 80) * 100, 100)} className="h-2" /></div>
                      <div className="space-y-1"><div className="flex justify-between text-xs"><span>Vslednost voženj</span><span className="text-primary font-medium">{user.stats.totalRides > 5 ? 'Odlična' : 'Dobra'}</span></div><Progress value={Math.min(user.stats.totalRides * 10, 100)} className="h-2" /></div>
                    </CardContent>
                  </Card>

                  {/* Recent rides */}
                  <Card>
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Zadnje vožnje</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                      <ScrollArea className="max-h-60">
                        {rides.filter(r => r.userId === user.id).slice(0, 5).map(ride => (
                          <div key={ride.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 cursor-pointer hover:bg-secondary/30 rounded px-2 -mx-2" onClick={() => openDetail(ride, 'ride')}>
                            <div><p className="text-sm font-medium">{ride.title}</p><p className="text-xs text-muted-foreground">{formatDate(ride.createdAt)}</p></div>
                            <div className="text-right"><p className="text-sm font-bold text-primary">{ride.distance} km</p><p className="text-xs text-muted-foreground">{formatDuration(ride.duration)}</p></div>
                          </div>
                        ))}
                        {rides.filter(r => r.userId === user.id).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Ni voženj</p>}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-muted-foreground">Podatki o uporabniku niso na volja</p><Button className="mt-4" onClick={() => fetchData()}>Poskusi znova</Button></div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ============ DETAIL DIALOG ============ */}
      {detailOpen && selectedItem && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" onClick={() => setDetailOpen(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto bg-card rounded-t-2xl sm:rounded-2xl border border-border/50 shadow-2xl custom-scrollbar animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="font-bold text-lg">{selectedItem.title}</h3>{selectedItem.description && <p className="text-sm text-muted-foreground mt-1">{selectedItem.description}</p>}</div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setDetailOpen(false)}><X className="size-5" /></Button>
              </div>

              {/* Badges + Like */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge variant="outline" className={selectedType === 'ride' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : categoryColor((selectedItem as RouteData).category)}>
                  {selectedType === 'ride' ? 'Vožnja' : categoryLabel((selectedItem as RouteData).category)}
                </Badge>
                {selectedType === 'route' && <Badge variant="outline" className="bg-secondary text-muted-foreground">{difficultyLabel((selectedItem as RouteData).difficulty)}</Badge>}
                {selectedType === 'route' && (
                  <Button variant="outline" size="sm" className={`text-xs gap-1 ${(selectedItem as RouteData).userLiked ? 'text-red-400 border-red-500/30 bg-red-500/10' : ''}`} onClick={() => toggleLike(selectedItem.id)}>
                    <Heart className={`size-3 ${(selectedItem as RouteData).userLiked ? 'fill-red-400' : ''}`} />
                    {(selectedItem as RouteData).likes}
                  </Button>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-secondary/50 rounded-lg p-2.5 text-center"><Route className="size-4 text-primary mx-auto mb-1" /><p className="text-sm font-bold">{selectedItem.distance} km</p><p className="text-[10px] text-muted-foreground">Razdalja</p></div>
                {selectedType === 'ride' && (<>
                  <div className="bg-secondary/50 rounded-lg p-2.5 text-center"><Clock className="size-4 text-primary mx-auto mb-1" /><p className="text-sm font-bold">{formatDuration((selectedItem as RideData).duration)}</p><p className="text-[10px] text-muted-foreground">Trajanje</p></div>
                  <div className="bg-secondary/50 rounded-lg p-2.5 text-center"><Gauge className="size-4 text-primary mx-auto mb-1" /><p className="text-sm font-bold">{(selectedItem as RideData).avgSpeed} km/h</p><p className="text-[10px] text-muted-foreground">Povp. hitrost</p></div>
                  <div className="bg-secondary/50 rounded-lg p-2.5 text-center"><Mountain className="size-4 text-primary mx-auto mb-1" /><p className="text-sm font-bold">{(selectedItem as RideData).elevation} m</p><p className="text-[10px] text-muted-foreground">Višina</p></div>
                </>)}
                {selectedType === 'route' && (<>
                  <div className="bg-secondary/50 rounded-lg p-2.5 text-center"><Mountain className="size-4 text-primary mx-auto mb-1" /><p className="text-sm font-bold">{(selectedItem as RouteData).difficulty === 'hard' ? '1680' : (selectedItem as RouteData).difficulty === 'medium' ? '800' : '300'} m</p><p className="text-[10px] text-muted-foreground">Višina</p></div>
                </>)}
              </div>

              {/* Elevation Profile (rides only) */}
              {selectedType === 'ride' && elevationData.length > 2 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Višinski profil</h4>
                  <div className="h-32 bg-secondary/30 rounded-lg p-2 relative">
                    <svg viewBox={`0 0 ${elevationData.length * 10} 100`} className="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(30, 90%, 55%)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="hsl(30, 90%, 55%)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const maxAlt = Math.max(...elevationData.map(d => d.višina), 1)
                        const minAlt = Math.min(...elevationData.map(d => d.višina))
                        const range = maxAlt - minAlt || 1
                        const points = elevationData.map((d, i) => `${i * 10},${100 - ((d.višina - minAlt) / range) * 80 - 10}`).join(' ')
                        const areaPoints = `0,100 ${points} ${(elevationData.length - 1) * 10},100`
                        return <>
                          <polygon points={areaPoints} fill="url(#elevGrad)" />
                          <polyline points={points} fill="none" stroke="hsl(30, 90%, 55%)" strokeWidth={2} />
                        </>
                      })()}
                    </svg>
                    <div className="absolute bottom-1 left-1 text-[8px] text-muted-foreground">{elevationData[0]?.km}km</div>
                    <div className="absolute bottom-1 right-1 text-[8px] text-muted-foreground">{elevationData[elevationData.length - 1]?.km}km</div>
                    <div className="absolute top-1 left-1 text-[8px] text-muted-foreground">{Math.max(...elevationData.map(d => d.višina))}m</div>
                  </div>
                </div>
              )}

              {/* Weather */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Vreme na lokaciji</h4>
                {weatherLoading ? (
                  <div className="h-20 bg-secondary/30 rounded-lg flex items-center justify-center"><Cloud className="size-6 text-muted-foreground animate-pulse" /></div>
                ) : weather ? (
                  <div className="bg-secondary/30 rounded-lg p-3">
                    {weather.current && (
                      <div className="flex items-center gap-3 mb-3">
                        {weatherIcon(weather.current.weathercode)}
                        <div><p className="font-bold text-lg">{weather.current.temperature}°C</p><p className="text-xs text-muted-foreground">{weather.current.description}</p></div>
                        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Wind className="size-3" />{weather.current.windspeed} km/h</div>
                      </div>
                    )}
                    {weather.forecast.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {weather.forecast.map((f, i) => (
                          <div key={i} className="text-center p-2 bg-background/50 rounded">
                            <p className="text-[10px] text-muted-foreground">{new Date(f.date).toLocaleDateString('sl-SI', { weekday: 'short' })}</p>
                            {weatherIcon(inferCode(f.precipitation, f.windMax))}
                            <p className="text-xs font-medium">{f.tempMax}°/{f.tempMin}°</p>
                            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><Droplets className="size-2.5" />{f.precipitation}mm</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-20 bg-secondary/30 rounded-lg flex items-center justify-center text-xs text-muted-foreground">Vreme ni na voljo</div>
                )}
              </div>

              {/* Mini map */}
              <div className="h-40 rounded-lg overflow-hidden border border-border/50 mb-4">
                <MotoMap center={[(selectedItem as RideData).startLat || 46.15, (selectedItem as RideData).startLng || 14.99]} zoom={10} rides={selectedType === 'ride' ? [selectedItem as RideData] : []} routes={selectedType === 'route' ? [selectedItem as RouteData] : []} />
              </div>

              {/* Comments */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><MessageCircle className="size-3" />Komentarji ({comments.length})</h4>
                {commentsLoading ? (
                  <div className="space-y-2"><div className="h-10 bg-secondary/30 rounded animate-pulse" /><div className="h-10 bg-secondary/30 rounded animate-pulse" /></div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Ni komentarjev</p>}
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2 p-2 bg-secondary/30 rounded-lg">
                        <Avatar className="size-7 shrink-0"><AvatarFallback className="text-[10px] bg-primary/20 text-primary">{c.user.name.charAt(0)}</AvatarFallback></Avatar>
                        <div className="min-w-0"><p className="text-xs font-medium">{c.user.name} <span className="text-muted-foreground font-normal">· {formatDate(c.createdAt)}</span></p><p className="text-sm break-words">{c.text}</p></div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add comment */}
                <div className="flex gap-2 mt-2">
                  <Input placeholder="Dodaj komentar..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && postComment()} className="text-sm" />
                  <Button size="icon" onClick={postComment} disabled={!newComment.trim()}><Send className="size-4" /></Button>
                </div>
              </div>

              {/* User info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><User className="size-3" /><span>{selectedItem.user?.name || 'Neznan'}</span><span>·</span><span>{formatDate(selectedItem.createdAt)}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ============ AI CHAT ============ */}
      <MotoChat />

      {/* ============ BOTTOM NAV ============ */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1500] bg-background/95 backdrop-blur-md border-t border-border/50 safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto h-16">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                <tab.icon className={`size-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
                {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

// Helper to infer weather code for daily forecast
function inferCode(precipitation: number, windSpeed: number): number {
  if (precipitation > 10) return 65
  if (precipitation > 3) return 63
  if (precipitation > 0.5) return 61
  if (windSpeed > 50) return 3
  if (windSpeed > 30) return 2
  return 1
}
