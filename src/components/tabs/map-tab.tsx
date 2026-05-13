'use client'

import React, { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Search, X, ChevronUp, ChevronDown, LocateFixed, Bike, Route as RouteIcon, Filter, MapPin, GitBranch, CloudRain, AlertTriangle, Radio, Plus, Send, Fuel, Users, Navigation, Trash2, Gauge, Star, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import MapStyleSelector from '@/components/map-style-selector'
import TrafficOverlay from '@/components/traffic-overlay'
import NavigationPanel from '@/components/navigation-panel'
import { toast } from 'sonner'
import type { RideData, RouteData, PoiData, LiveRider, HazardData, FuelData, FriendshipData, ParkingData, RoadRatingData, NavigationRoute } from '@/components/tabs/types'
import { categoryLabel, categoryColor, poiTypeLabel, poiTypeEmoji } from '@/components/tabs/types'

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

const POI_TYPES = [
  { key: 'gas_station', label: 'Bencinske črpalke', emoji: '⛽' },
  { key: 'restaurant', label: 'Restavracije', emoji: '🍽️' },
  { key: 'biker_spot', label: 'Moto srečanja', emoji: '🏍️' },
  { key: 'parking', label: 'Parkirišča', emoji: '🅿️' },
  { key: 'hotel', label: 'Hoteli', emoji: '🏨' },
  { key: 'mechanic', label: 'Servisi', emoji: '🔧' },
]

const HAZARD_TYPES = [
  { key: 'speed_camera', label: 'Hitrostna past', emoji: '📸' },
  { key: 'rockfall', label: 'Plazovito', emoji: '🪨' },
  { key: 'slippery', label: 'Zdrsna cesta', emoji: '⚠️' },
  { key: 'wildlife', label: 'Divjad', emoji: '🦌' },
  { key: 'construction', label: 'Delnice', emoji: '🚧' },
  { key: 'accident', label: 'Nesreča', emoji: '🆘' },
]

interface MapTabProps {
  rides: RideData[]
  routes: RouteData[]
  onOpenDetail: (item: RideData | RouteData, type: 'ride' | 'route') => void
  userId?: string
}

export default function MapTab({ rides, routes, onOpenDetail, userId }: MapTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [nearbyExpanded, setNearbyExpanded] = useState(false)
  const [filterRides, setFilterRides] = useState(true)
  const [filterRoutes, setFilterRoutes] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // POI state
  const [pois, setPois] = useState<PoiData[]>([])
  const [activePoiTypes, setActivePoiTypes] = useState<string[]>([])
  const [showPoiPanel, setShowPoiPanel] = useState(false)

  // Map overlays state
  const [showTwistyRoads, setShowTwistyRoads] = useState(false)
  const [showWeatherRadar, setShowWeatherRadar] = useState(false)
  const [showHazards, setShowHazards] = useState(false)

  // LiveRIDE state
  const [liveRiders, setLiveRiders] = useState<LiveRider[]>([])
  const [showLiveRide, setShowLiveRide] = useState(false)
  const [isSharingLocation, setIsSharingLocation] = useState(false)
  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null)
  const locationWatchRef = useRef<number | null>(null)

  // Hazard report state
  const [showHazardReport, setShowHazardReport] = useState(false)
  const [hazardType, setHazardType] = useState('speed_camera')
  const [hazardName, setHazardName] = useState('')
  const [hazardDesc, setHazardDesc] = useState('')
  const [reportingHazard, setReportingHazard] = useState(false)

  // Fuel range state
  const [showFuelPanel, setShowFuelPanel] = useState(false)
  const [fuelData, setFuelData] = useState<FuelData | null>(null)
  const [fuelCenter, setFuelCenter] = useState<{ lat: number; lng: number }>({ lat: 46.15, lng: 14.99 })
  const [savingFuel, setSavingFuel] = useState(false)

  // Friend rides state
  const [showFriendRides, setShowFriendRides] = useState(false)
  const [friendRides, setFriendRides] = useState<Array<{ id: string; title: string; distance: number; startLat: number | null; startLng: number | null; trackData: string; userName: string }>>([])

  // Parking state
  const [parkingData, setParkingData] = useState<ParkingData | null>(null)
  const [showParkingPanel, setShowParkingPanel] = useState(false)
  const [parkingNote, setParkingNote] = useState('')
  const [savingParking, setSavingParking] = useState(false)
  const [flyToParking, setFlyToParking] = useState<{ lat: number; lng: number; zoom: number } | undefined>(undefined)
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)

  // Navigation state
  const [navigationRoute, setNavigationRoute] = useState<NavigationRoute | null>(null)
  const [showNavigation, setShowNavigation] = useState(false)
  const [navigatingRoute, setNavigatingRoute] = useState<string | null>(null)

  // Traffic state
  const [showTraffic, setShowTraffic] = useState(false)

  // Road Quality state
  const [showRoadQuality, setShowRoadQuality] = useState(false)
  const [roadRatings, setRoadRatings] = useState<RoadRatingData[]>([])
  const [newRating, setNewRating] = useState(3)
  const [newSurface, setNewSurface] = useState('asphalt')
  const [newComment, setNewComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)

  // Fetch POIs
  useEffect(() => {
    fetch('/api/pois')
      .then(r => r.json())
      .then(j => setPois(j.data || []))
      .catch(() => {})
  }, [])

  // Fetch fuel data
  useEffect(() => {
    const url = userId ? `/api/fuel?userId=${userId}` : '/api/fuel'
    fetch(url)
      .then(r => r.json())
      .then(j => setFuelData(j.data || null))
      .catch(() => {})
  }, [userId])

  // Get user location for fuel center and current position
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFuelCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        () => {}, // keep default Slovenia center
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }
  }, [])

  // Fetch parking data
  useEffect(() => {
    if (!userId) return
    const url = `/api/parking?userId=${userId}`
    fetch(url)
      .then(r => r.json())
      .then(j => setParkingData(j.data || null))
      .catch(() => {})
  }, [userId])

  // Fetch friend rides when toggle is enabled
  useEffect(() => {
    if (!showFriendRides || !userId) {
      setFriendRides([])
      return
    }
    const fetchFriendRides = async () => {
      try {
        // First fetch accepted friends
        const friendsRes = await fetch(`/api/friends?userId=${userId}&status=accepted`)
        const friendsJson = await friendsRes.json()
        const friends: FriendshipData[] = friendsJson.data || []
        if (friends.length === 0) return

        const friendIds = friends.map(f => f.friend.id).join(',')
        // Then fetch their rides
        const ridesRes = await fetch(`/api/rides?friendIds=${friendIds}&limit=50`)
        const ridesJson = await ridesRes.json()
        const friendRidesData: RideData[] = ridesJson.data || []

        // Map to simpler format with userName
        const mapped = friendRidesData.map(r => ({
          id: r.id,
          title: r.title,
          distance: r.distance,
          startLat: r.startLat ?? null,
          startLng: r.startLng ?? null,
          trackData: r.trackData,
          userName: r.user?.name || 'Prijatelj',
        }))
        setFriendRides(mapped)
      } catch {
        // ignore
      }
    }
    fetchFriendRides()
  }, [showFriendRides, userId])

  // Fetch hazards from DB
  const [dbHazards, setDbHazards] = useState<HazardData[]>([])
  useEffect(() => {
    fetch('/api/hazards')
      .then(r => r.json())
      .then(j => setDbHazards(j.data || []))
      .catch(() => {})
  }, [showHazards])

  // Fetch road ratings when toggle enabled
  useEffect(() => {
    if (!showRoadQuality) {
      setRoadRatings([])
      return
    }
    fetch('/api/road-ratings?limit=200')
      .then(r => r.json())
      .then(j => setRoadRatings(j.data || []))
      .catch(() => {})
  }, [showRoadQuality])

  // LiveRIDE WebSocket connection
  useEffect(() => {
    if (!showLiveRide) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    const initSocket = async () => {
      const { io } = await import('socket.io-client')
      const socket = io('/?XTransformPort=3003', { transports: ['websocket'] })

      socket.on('connect', () => {
        console.log('LiveRIDE connected')
      })

      socket.on('live-riders', (riders: LiveRider[]) => {
        setLiveRiders(riders)
      })

      socket.on('rider-joined', (data: { userId: string; userName: string; rideId: string }) => {
        setLiveRiders(prev => {
          if (prev.some(r => r.userId === data.userId)) return prev
          return [...prev, { ...data, lat: 0, lng: 0, speed: 0, heading: 0, lastUpdate: Date.now() }]
        })
      })

      socket.on('rider-left', (data: { userId: string }) => {
        setLiveRiders(prev => prev.filter(r => r.userId !== data.userId))
      })

      socket.on('rider-location', (data: LiveRider) => {
        setLiveRiders(prev => prev.map(r => r.userId === data.userId ? { ...data, lastUpdate: Date.now() } : r))
      })

      socketRef.current = socket
    }

    initSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [showLiveRide])

  // Start/stop sharing location
  const toggleLocationSharing = () => {
    if (isSharingLocation) {
      // Stop sharing
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current)
        locationWatchRef.current = null
      }
      if (socketRef.current) {
        socketRef.current.emit('leave-ride', { userId: userId || 'anonymous', rideId: 'public' })
      }
      setIsSharingLocation(false)
      toast.success('Deljenje lokacije ustavljeno')
    } else {
      // Start sharing
      if (!navigator.geolocation) { toast.error('Geolokacija ni na voljo'); return }
      if (!socketRef.current) { toast.error('Povezava z LiveRIDE ni vzpostavljena'); return }

      socketRef.current.emit('join-ride', {
        userId: userId || 'anonymous',
        userName: 'Motorist',
        rideId: 'public',
      })

      locationWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (socketRef.current) {
            socketRef.current.emit('location-update', {
              userId: userId || 'anonymous',
              rideId: 'public',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
              heading: pos.coords.heading || 0,
            })
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      )
      setIsSharingLocation(true)
      toast.success('Deljenje lokacije začeto')
    }
  }

  // Report hazard
  const handleReportHazard = async () => {
    if (!hazardName.trim()) { toast.error('Vnesite naziv opozorila'); return }
    setReportingHazard(true)

    // Get current location for hazard
    const reportHazardAtLocation = async (lat: number, lng: number) => {
      try {
        const res = await fetch('/api/hazards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: hazardType,
            name: hazardName.trim(),
            description: hazardDesc.trim() || undefined,
            lat, lng,
            userId: userId || undefined,
          }),
        })
        if (res.ok) {
          toast.success('Opozorilo prijavljeno!')
          setShowHazardReport(false)
          setHazardName('')
          setHazardDesc('')
          // Refresh hazards
          fetch('/api/hazards').then(r => r.json()).then(j => setDbHazards(j.data || []))
        } else { toast.error('Napaka pri prijavi') }
      } catch { toast.error('Napaka') }
      setReportingHazard(false)
    }

    // Try to get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => reportHazardAtLocation(pos.coords.latitude, pos.coords.longitude),
        () => reportHazardAtLocation(46.15, 14.99), // Default to Slovenia center
        { timeout: 5000 }
      )
    } else {
      reportHazardAtLocation(46.15, 14.99)
    }
  }

  const totalCount = rides.length + routes.length

  // Filter rides and routes by search query
  const filteredRides = rides.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredRoutes = routes.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const hasResults = filteredRides.length > 0 || filteredRoutes.length > 0

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error('Ne morem pridobiti lokacije')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        toast.success(`Lokacija: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
      },
      () => { toast.error('Ne morem pridobiti lokacije') }
    )
  }

  const togglePoiType = (type: string) => {
    setActivePoiTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const activePoiCount = activePoiTypes.length

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* Map */}
      <MotoMap
        center={[46.15, 14.99]}
        zoom={8}
        rides={rides}
        routes={routes}
        pois={pois}
        liveRiders={showLiveRide ? liveRiders : []}
        dbHazards={showHazards ? dbHazards : []}
        fuelRange={showFuelPanel && fuelData ? fuelData.range : undefined}
        fuelCenter={showFuelPanel && fuelData ? fuelCenter : undefined}
        friendRides={friendRides}
        showFriendRides={showFriendRides}
        parkedLocation={parkingData?.parkedLat != null && parkingData?.parkedLng != null ? { lat: parkingData.parkedLat, lng: parkingData.parkedLng, note: parkingData.parkedNote ?? undefined, parkedAt: parkingData.parkedAt ?? undefined } : undefined}
        flyToLocation={flyToParking}
        filterRides={filterRides}
        filterRoutes={filterRoutes}
        filterCategory={filterCategory}
        filterPoiTypes={activePoiTypes}
        showTwistyRoads={showTwistyRoads}
        showWeatherRadar={showWeatherRadar}
        showHazards={showHazards}
        roadRatings={showRoadQuality ? roadRatings : []}
        className="absolute inset-0"
      />

      {/* Floating search bar */}
      <div className="absolute top-4 left-4 right-16 z-[1000]">
        <div className="relative max-w-md">
          <div className="flex items-center gap-2 bg-background/90 backdrop-blur-md border border-border rounded-xl shadow-lg px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value) setShowSearch(true)
              }}
              onFocus={() => setShowSearch(true)}
              placeholder="Išči vožnje in poti..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 py-0 h-7 text-sm placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setShowSearch(false) }} className="shrink-0 p-0.5 rounded-full hover:bg-muted transition-colors">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Search dropdown */}
          {showSearch && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg overflow-hidden">
              <ScrollArea className="max-h-72">
                {!hasResults && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Ni zadetkov</div>}
                {filteredRides.map((ride) => (
                  <button key={`ride-${ride.id}`} onClick={() => { onOpenDetail(ride, 'ride'); setShowSearch(false); setSearchQuery('') }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left">
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0 text-[10px] px-1.5 py-0">Vožnja</Badge>
                    <span className="text-sm text-foreground truncate flex-1">{ride.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{ride.distance} km</span>
                  </button>
                ))}
                {filteredRoutes.map((route) => (
                  <button key={`route-${route.id}`} onClick={() => { onOpenDetail(route, 'route'); setShowSearch(false); setSearchQuery('') }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left">
                    <Badge variant="outline" className={`${categoryColor(route.category)} shrink-0 text-[10px] px-1.5 py-0`}>Pot</Badge>
                    <span className="text-sm text-foreground truncate flex-1">{route.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{route.distance} km</span>
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Right side buttons */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showFilters ? 'bg-primary text-primary-foreground' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border relative ${activePoiCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowPoiPanel(!showPoiPanel)}>
          <MapPin className="h-4 w-4" />
          {activePoiCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full size-4 flex items-center justify-center">{activePoiCount}</span>}
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showTwistyRoads ? 'bg-amber-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowTwistyRoads(!showTwistyRoads)} title="Vijugaste ceste">
          <GitBranch className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showWeatherRadar ? 'bg-sky-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowWeatherRadar(!showWeatherRadar)} title="Vremenski radar">
          <CloudRain className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showHazards ? 'bg-red-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowHazards(!showHazards)} title="Opozorila na nevarnosti">
          <AlertTriangle className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showLiveRide ? 'bg-green-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowLiveRide(!showLiveRide)} title="LiveRIDE - sledi motoristom v živo">
          <Radio className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border bg-background/90 hover:bg-muted" onClick={() => setShowHazardReport(true)} title="Prijavi nevarnost">
          <Plus className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showFuelPanel ? 'bg-orange-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowFuelPanel(!showFuelPanel)} title="Kazalnik dosega">
          <Fuel className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${parkingData?.parkedLat != null ? 'bg-blue-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowParkingPanel(!showParkingPanel)} title="Parkirišče">
          <MapPin className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showFriendRides ? 'bg-blue-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowFriendRides(!showFriendRides)} title="Prijateljeve vožnje">
          <Users className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showNavigation ? 'bg-amber-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={async () => {
          if (!showNavigation && routes.length > 0) {
            // Use the first public route for navigation demo
            const firstRoute = routes[0]
            try {
              let waypoints: Array<{lat: number; lng: number}> = []
              if (firstRoute.waypoints) {
                waypoints = JSON.parse(firstRoute.waypoints)
              } else if (firstRoute.startLat && firstRoute.startLng) {
                waypoints = [{ lat: firstRoute.startLat, lng: firstRoute.startLng }]
              }
              if (waypoints.length >= 2) {
                const res = await fetch(`/api/navigation?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}`)
                if (res.ok) {
                  const j = await res.json()
                  setNavigationRoute(j.data)
                  setShowNavigation(true)
                  toast.success('Navigacija zagnana!')
                } else {
                  toast.error('Napaka pri navigaciji')
                }
              } else {
                toast.error('Pot nima dovolj točk za navigacijo')
              }
            } catch {
              toast.error('Napaka pri navigaciji')
            }
          } else {
            setShowNavigation(!showNavigation)
          }
        }} title="Turn-by-turn navigacija">
          <Navigation className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showTraffic ? 'bg-orange-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowTraffic(!showTraffic)} title="Promet v živo">
          <Layers className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className={`h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border ${showRoadQuality ? 'bg-emerald-500 text-white' : 'bg-background/90 hover:bg-muted'}`} onClick={() => setShowRoadQuality(!showRoadQuality)} title="Kakovost ceste">
          <Gauge className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="absolute top-16 right-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg p-3 w-48">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Prikaži</p>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setFilterRides(!filterRides)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterRides ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
              <Bike className="size-3" /> Vožnje
            </button>
            <button onClick={() => setFilterRoutes(!filterRoutes)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterRoutes ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
              <RouteIcon className="size-3" /> Poti
            </button>
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Kategorija</p>
          <div className="flex flex-wrap gap-1">
            {['all', 'scenic', 'twisty', 'offroad', 'city'].map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${filterCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}>
                {cat === 'all' ? 'Vse' : categoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* POI toggle panel */}
      {showPoiPanel && (
        <div className="absolute top-28 right-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg p-3 w-52">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Zanimive točke</p>
          <div className="space-y-1.5">
            {POI_TYPES.map(pt => (
              <button key={pt.key} onClick={() => togglePoiType(pt.key)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${activePoiTypes.includes(pt.key) ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border hover:bg-muted'}`}>
                <span className="text-sm">{pt.emoji}</span>
                <span className="flex-1 text-left">{pt.label}</span>
                <span className="text-[10px] text-muted-foreground">{pois.filter(p => p.type === pt.key).length}</span>
              </button>
            ))}
          </div>
          {activePoiCount > 0 && (
            <button onClick={() => setActivePoiTypes([])} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">Skrij vse</button>
          )}
        </div>
      )}

      {/* LiveRIDE panel */}
      {showLiveRide && (
        <div className="absolute top-4 left-4 right-16 z-[999] mt-[52px]">
          <div className="bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg p-3 max-w-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Radio className="size-4 text-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-500 uppercase tracking-wider">LiveRIDE</span>
              </div>
              <span className="text-xs text-muted-foreground">{liveRiders.length} motoristov v živo</span>
            </div>

            <div className="flex gap-2 mb-2">
              <Button size="sm" className={`text-xs flex-1 gap-1 ${isSharingLocation ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`} onClick={toggleLocationSharing}>
                {isSharingLocation ? <><X className="size-3" /> Ustavi deljenje</> : <><Radio className="size-3" /> Deli lokacijo</>}
              </Button>
            </div>

            {liveRiders.length > 0 && (
              <ScrollArea className="max-h-32">
                <div className="space-y-1">
                  {liveRiders.map(rider => (
                    <div key={rider.userId} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-green-500/10 text-xs">
                      <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium truncate">{rider.userName}</span>
                      {rider.speed > 0 && <span className="text-muted-foreground ml-auto">{rider.speed} km/h</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {liveRiders.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Trenutno ni aktivnih motoristov. Delite svojo lokacijo!</p>
            )}
          </div>
        </div>
      )}

      {/* Locate button & Map Style */}
      <div className="absolute bottom-28 right-4 z-[1000] flex flex-col gap-2">
        <MapStyleSelector userId={userId} />
        <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-md border border-border hover:bg-muted" onClick={handleLocate}>
          <LocateFixed className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation Panel */}
      {showNavigation && (
        <NavigationPanel
          route={navigationRoute}
          onStartNavigation={() => setNavigatingRoute('active')}
          onStopNavigation={() => { setNavigatingRoute(null); window.speechSynthesis?.cancel() }}
        />
      )}

      {/* Traffic Overlay Panel */}
      {showTraffic && (
        <div className="absolute top-4 left-4 z-[1000] mt-[52px] max-w-md">
          <div className="bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg p-3">
            <TrafficOverlay lat={fuelCenter.lat} lng={fuelCenter.lng} enabled={showTraffic} userId={userId} />
          </div>
        </div>
      )}

      {/* Nearby panel */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000]">
        <div className={`bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg transition-all duration-300 ${nearbyExpanded ? 'max-h-[60vh]' : 'max-h-14'}`}>
          <button onClick={() => setNearbyExpanded(!nearbyExpanded)} className="w-full flex items-center justify-between px-4 h-14 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors rounded-t-2xl">
            <span>
              {totalCount} voženj in poti{activePoiCount > 0 ? ` · ${pois.filter(p => activePoiTypes.includes(p.type)).length} POI` : ''}{liveRiders.length > 0 ? ` · ${liveRiders.length} v živo` : ''}
            </span>
            {nearbyExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </button>
          {nearbyExpanded && (
            <ScrollArea className="max-h-[calc(60vh-3.5rem)]">
              <div className="px-4 pb-4 space-y-2">
                {rides.map((ride) => (
                  <button key={`nearby-ride-${ride.id}`} onClick={() => onOpenDetail(ride, 'ride')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left">
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0 text-[10px] px-1.5 py-0">Vožnja</Badge>
                    <span className="text-sm text-foreground truncate flex-1">{ride.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{ride.distance} km</span>
                  </button>
                ))}
                {routes.map((route) => (
                  <button key={`nearby-route-${route.id}`} onClick={() => onOpenDetail(route, 'route')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left">
                    <Badge variant="outline" className={`${categoryColor(route.category)} shrink-0 text-[10px] px-1.5 py-0`}>{categoryLabel(route.category)}</Badge>
                    <span className="text-sm text-foreground truncate flex-1">{route.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{route.distance} km</span>
                  </button>
                ))}
                {totalCount === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Ni voženj in poti</div>}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Fuel Range Panel */}
      {showFuelPanel && (
        <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Fuel className="size-4 text-orange-500" />
              <span className="text-sm font-bold">Kazalnik dosega</span>
            </div>
            <button onClick={() => setShowFuelPanel(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>

          {fuelData ? (
            <div className="space-y-4">
              {/* Range display */}
              <div className="text-center py-2">
                <div className="text-3xl font-bold text-orange-500">⛽ {Math.round(fuelData.range)} km</div>
                <p className="text-xs text-muted-foreground mt-1">Preostali doseg</p>
              </div>

              {/* Fuel level slider */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Trenutna raven goriva: {fuelData.currentFuel.toFixed(1)} / {fuelData.fuelCapacity.toFixed(1)} L
                </Label>
                <Slider
                  value={[fuelData.currentFuel]}
                  min={0}
                  max={fuelData.fuelCapacity}
                  step={0.5}
                  onValueChange={(val) => {
                    setFuelData({ ...fuelData, currentFuel: val[0], range: fuelData.fuelConsumption > 0 ? Math.round((val[0] / fuelData.fuelConsumption) * 100 * 10) / 10 : 0 })
                  }}
                  onValueCommit={async (val) => {
                    setSavingFuel(true)
                    try {
                      const res = await fetch('/api/fuel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, currentFuel: val[0] }),
                      })
                      if (res.ok) {
                        const j = await res.json()
                        setFuelData(j.data)
                      }
                    } catch { /* ignore */ }
                    setSavingFuel(false)
                  }}
                  disabled={savingFuel}
                  className="mt-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0 L</span>
                  <span>{fuelData.fuelCapacity.toFixed(1)} L</span>
                </div>
              </div>

              {/* Tank capacity input */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Velikost rezervoarja (L)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  value={fuelData.fuelCapacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 15.0
                    setFuelData({ ...fuelData, fuelCapacity: val, currentFuel: Math.min(fuelData.currentFuel, val) })
                  }}
                  onBlur={async () => {
                    if (!userId) return
                    setSavingFuel(true)
                    try {
                      const res = await fetch('/api/fuel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, fuelCapacity: fuelData.fuelCapacity }),
                      })
                      if (res.ok) {
                        const j = await res.json()
                        setFuelData(j.data)
                      }
                    } catch { /* ignore */ }
                    setSavingFuel(false)
                  }}
                  className="h-8 text-sm"
                />
              </div>

              {/* Consumption input */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Poraba goriva (L/100km)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  step={0.1}
                  value={fuelData.fuelConsumption}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 5.5
                    setFuelData({ ...fuelData, fuelConsumption: val, range: val > 0 ? Math.round((fuelData.currentFuel / val) * 100 * 10) / 10 : 0 })
                  }}
                  onBlur={async () => {
                    if (!userId) return
                    setSavingFuel(true)
                    try {
                      const res = await fetch('/api/fuel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, fuelConsumption: fuelData.fuelConsumption }),
                      })
                      if (res.ok) {
                        const j = await res.json()
                        setFuelData(j.data)
                      }
                    } catch { /* ignore */ }
                    setSavingFuel(false)
                  }}
                  className="h-8 text-sm"
                />
              </div>

              {/* Fill Tank button */}
              <Button
                className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={async () => {
                  if (!userId) return
                  setSavingFuel(true)
                  try {
                    const res = await fetch('/api/fuel', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId, currentFuel: fuelData.fuelCapacity }),
                    })
                    if (res.ok) {
                      const j = await res.json()
                      setFuelData(j.data)
                      toast.success('Rezervoar napolnjen!')
                    }
                  } catch { toast.error('Napaka') }
                  setSavingFuel(false)
                }}
                disabled={savingFuel}
              >
                <Fuel className="size-4" /> Napolni rezervoar
              </Button>

              {fuelData.lastRefuelAt && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Zadnje polnjenje: {new Date(fuelData.lastRefuelAt).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nalagam podatke o gorivu...
            </div>
          )}
        </div>
      )}

      {/* Parking Panel */}
      {showParkingPanel && (
        <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-blue-500" />
              <span className="text-sm font-bold">Parkirišče</span>
            </div>
            <button onClick={() => setShowParkingPanel(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>

          {parkingData?.parkedLat != null && parkingData?.parkedLng != null ? (
            <div className="space-y-3">
              {/* Parked location info */}
              <div className="text-center py-2">
                <div className="text-3xl font-bold text-blue-500">🅿️</div>
                <p className="text-xs text-muted-foreground mt-1">Motor je parkiran</p>
              </div>

              {/* Parking details */}
              {parkingData.parkedAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>🕐</span>
                  <span>{new Date(parkingData.parkedAt).toLocaleString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}

              {parkingData.parkedNote && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>📝</span>
                  <span>{parkingData.parkedNote}</span>
                </div>
              )}

              {/* Distance from current position */}
              {currentPosition && (
                <div className="bg-blue-500/10 rounded-lg p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Navigation className="size-3.5 text-blue-500" />
                    <span className="text-sm font-bold text-blue-500">
                      {(() => {
                        const R = 6371
                        const dLat = ((parkingData.parkedLat! - currentPosition.lat) * Math.PI) / 180
                        const dLon = ((parkingData.parkedLng! - currentPosition.lng) * Math.PI) / 180
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                          Math.cos((currentPosition.lat * Math.PI) / 180) * Math.cos((parkingData.parkedLat! * Math.PI) / 180) *
                          Math.sin(dLon / 2) * Math.sin(dLon / 2)
                        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                        return dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(2)} km`
                      })()}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">oddaljenost od vas</p>
                </div>
              )}

              {/* Find motorcycle button */}
              <Button
                className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => {
                  if (parkingData?.parkedLat != null && parkingData?.parkedLng != null) {
                    setFlyToParking({ lat: parkingData.parkedLat, lng: parkingData.parkedLng, zoom: 17 })
                    // Reset flyTo after animation
                    setTimeout(() => setFlyToParking(undefined), 2000)
                  }
                }}
              >
                <Navigation className="size-4" /> Najdi motor
              </Button>

              {/* Forget parking button */}
              <Button
                variant="outline"
                className="w-full gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                onClick={async () => {
                  if (!userId) return
                  setSavingParking(true)
                  try {
                    const res = await fetch(`/api/parking?userId=${userId}`, { method: 'DELETE' })
                    if (res.ok) {
                      setParkingData({ parkedLat: null, parkedLng: null, parkedAt: null, parkedNote: null })
                      setParkingNote('')
                      toast.success('Parkirišče pozabljeno')
                    } else {
                      toast.error('Napaka pri brisanju')
                    }
                  } catch {
                    toast.error('Napaka')
                  }
                  setSavingParking(false)
                }}
                disabled={savingParking}
              >
                <Trash2 className="size-4" /> Pozabi parkirišče
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Not parked yet */}
              <div className="text-center py-2">
                <MapPin className="size-8 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Shrani trenutno lokacijo kot parkirišče</p>
              </div>

              {/* Parking note input */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Opomba (opcijsko)</Label>
                <Input
                  placeholder="Npr. V garaži, Pred trgovino"
                  value={parkingNote}
                  onChange={(e) => setParkingNote(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Park button */}
              <Button
                className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                onClick={async () => {
                  if (!userId) { toast.error('Prijava je potrebna'); return }
                  setSavingParking(true)

                  const saveParking = async (lat: number, lng: number) => {
                    try {
                      const res = await fetch('/api/parking', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, lat, lng, note: parkingNote.trim() || undefined }),
                      })
                      if (res.ok) {
                        const j = await res.json()
                        setParkingData(j.data)
                        setParkingNote('')
                        toast.success('Parkirišče shranjeno! 🅿️')
                      } else {
                        toast.error('Napaka pri shranjevanju')
                      }
                    } catch {
                      toast.error('Napaka')
                    }
                    setSavingParking(false)
                  }

                  // Use current GPS position if available, otherwise use map center
                  if (currentPosition) {
                    saveParking(currentPosition.lat, currentPosition.lng)
                  } else if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => saveParking(pos.coords.latitude, pos.coords.longitude),
                      () => saveParking(46.15, 14.99), // Default to Slovenia center
                      { enableHighAccuracy: true, timeout: 5000 }
                    )
                  } else {
                    saveParking(46.15, 14.99)
                  }
                }}
                disabled={savingParking}
              >
                <MapPin className="size-4" /> Parkiraj
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hazard Report Dialog */}
      {showHazardReport && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowHazardReport(false) }}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Prijavi nevarnost na cesti</DialogTitle>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Vrsta nevarnosti</label>
                <div className="grid grid-cols-3 gap-2">
                  {HAZARD_TYPES.map(ht => (
                    <button key={ht.key} onClick={() => setHazardType(ht.key)} className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs border-2 transition-colors ${hazardType === ht.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-muted'}`}>
                      <span className="text-lg">{ht.emoji}</span>
                      <span className="text-[10px] text-center leading-tight">{ht.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Naziv</label>
                <Input placeholder="Npr. Hitrostna past na obvoznici" value={hazardName} onChange={e => setHazardName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis (opcijsko)</label>
                <Input placeholder="Dodatne informacije..." value={hazardDesc} onChange={e => setHazardDesc(e.target.value)} />
              </div>
              <p className="text-[10px] text-muted-foreground">Lokacija bo pridobljena iz vaše trenutne pozicije.</p>
              <Button className="w-full gap-2" onClick={handleReportHazard} disabled={reportingHazard || !hazardName.trim()}>
                <Send className="size-4" /> {reportingHazard ? 'Prijavljam...' : 'Prijavi nevarnost'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Road Quality Panel */}
      {showRoadQuality && (
        <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-80 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-emerald-500" />
              <span className="text-sm font-bold">Kakovost ceste</span>
            </div>
            <button onClick={() => setShowRoadQuality(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Submit Rating Section */}
          <div className="border border-border rounded-xl p-3 mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Oceni cesto</p>
            
            {/* Star Rating */}
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => {
                const colors: Record<number, string> = { 5: '#22c55e', 4: '#84cc16', 3: '#eab308', 2: '#f97316', 1: '#ef4444' }
                return (
                  <button
                    key={star}
                    onClick={() => setNewRating(star)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`size-7 ${star <= newRating ? 'fill-current' : ''}`}
                      style={{ color: star <= newRating ? colors[star] : '#9ca3af' }}
                    />
                  </button>
                )
              })}
              <span className="text-xs text-muted-foreground ml-2">
                {newRating === 5 ? 'Odlično' : newRating === 4 ? 'Dobro' : newRating === 3 ? 'Srednje' : newRating === 2 ? 'Slabo' : 'Zelo slabo'}
              </span>
            </div>

            {/* Surface Type Selector */}
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1.5 block">Tip podlage</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { key: 'asphalt', label: 'Asfalt', emoji: '🛣️' },
                  { key: 'gravel', label: 'Makadam', emoji: '🪨' },
                  { key: 'dirt', label: 'Zemlja', emoji: '🌱' },
                  { key: 'mixed', label: 'Mešano', emoji: '🔀' },
                ].map(s => (
                  <button
                    key={s.key}
                    onClick={() => setNewSurface(s.key)}
                    className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg text-[10px] border-2 transition-colors ${newSurface === s.key ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border hover:border-muted'}`}
                  >
                    <span className="text-sm">{s.emoji}</span>
                    <span className="leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="mb-3">
              <Input
                placeholder="Opomba (opcijsko)"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Submit Button */}
            <Button
              className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={async () => {
                if (!userId) { toast.error('Prijava je potrebna'); return }
                setSubmittingRating(true)
                const submitAtLocation = async (lat: number, lng: number) => {
                  try {
                    const res = await fetch('/api/road-ratings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId,
                        lat,
                        lng,
                        rating: newRating,
                        surface: newSurface,
                        comment: newComment.trim() || undefined,
                      }),
                    })
                    if (res.ok) {
                      toast.success('Ocena ceste poslana! 🛣️')
                      setNewComment('')
                      // Refresh ratings
                      const refreshRes = await fetch('/api/road-ratings?limit=200')
                      const refreshJson = await refreshRes.json()
                      setRoadRatings(refreshJson.data || [])
                    } else {
                      toast.error('Napaka pri pošiljanju ocene')
                    }
                  } catch {
                    toast.error('Napaka')
                  }
                  setSubmittingRating(false)
                }
                if (currentPosition) {
                  submitAtLocation(currentPosition.lat, currentPosition.lng)
                } else if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => submitAtLocation(pos.coords.latitude, pos.coords.longitude),
                    () => submitAtLocation(46.15, 14.99),
                    { timeout: 5000 }
                  )
                } else {
                  submitAtLocation(46.15, 14.99)
                }
              }}
              disabled={submittingRating}
            >
              <Send className="size-4" /> {submittingRating ? 'Pošiljam...' : 'Pošlji oceno'}
            </Button>
          </div>

          {/* Recent Ratings */}
          <div className="flex-1 min-h-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Nedavne ocene</p>
            {roadRatings.length > 0 ? (
              <ScrollArea className="max-h-48">
                <div className="space-y-1.5">
                  {roadRatings.slice(0, 20).map((rr) => {
                    const ratingColorsMap: Record<number, string> = { 5: '#22c55e', 4: '#84cc16', 3: '#eab308', 2: '#f97316', 1: '#ef4444' }
                    const surfaceEmojiMap: Record<string, string> = { asphalt: '🛣️', gravel: '🪨', dirt: '🌱', mixed: '🔀' }
                    const color = ratingColorsMap[rr.rating] || '#6b7280'
                    const stars = '★'.repeat(rr.rating) + '☆'.repeat(5 - rr.rating)
                    return (
                      <div key={rr.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/30 text-xs">
                        <span style={{ color }} className="font-bold text-sm">{stars}</span>
                        <span>{surfaceEmojiMap[rr.surface] || '🛤️'}</span>
                        {rr.comment && <span className="text-muted-foreground truncate flex-1">{rr.comment}</span>}
                        <span className="text-muted-foreground shrink-0">{rr.user?.name || 'Uporabnik'}</span>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">Ni ocen ceste. Bodite prvi!</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
