'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Radio,
  Eye,
  Clock,
  Navigation,
  Crosshair,
  Wifi,
  WifiOff,
  ArrowRight,
  Loader2,
  MapPin,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { io as socketIO, Socket } from 'socket.io-client'

interface RiderPosition {
  lat: number
  lng: number
  speed: number
  heading: number
  timestamp?: number
}

interface LiveTrackingViewerProps {
  /** shareToken to auto-join a session */
  shareToken?: string
  /** Callback when the viewer closes */
  onClose?: () => void
}

export default function LiveTrackingViewer({ shareToken: initialToken, onClose }: LiveTrackingViewerProps) {
  const [token, setToken] = useState(initialToken || '')
  const [joined, setJoined] = useState(false)
  const [riderPos, setRiderPos] = useState<RiderPosition | null>(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [wsConnected, setWsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [riderStopped, setRiderStopped] = useState(false)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 46.15, lng: 14.99 })
  const socketRef = useRef<Socket | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const trailRef = useRef<any>(null)
  const trailPositionsRef = useRef<Array<[number, number]>>([])
  const followRiderRef = useRef(true)
  const [followRider, setFollowRider] = useState(true)

  // Initialize Socket.io
  useEffect(() => {
    const socket = socketIO('/', {
      query: { XTransformPort: '3003' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })

    socket.on('connect', () => {
      console.log('[LiveViewer] WebSocket connected')
      setWsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('[LiveViewer] WebSocket disconnected')
      setWsConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.warn('[LiveViewer] WebSocket connection error:', err.message)
      setWsConnected(false)
    })

    // Listen for rider location updates
    socket.on('rider-location', (data: RiderPosition) => {
      setRiderPos(data)
      setLastUpdate(new Date())
      setRiderStopped(false)

      if (followRiderRef.current) {
        setMapCenter({ lat: data.lat, lng: data.lng })
      }

      // Add to trail
      trailPositionsRef.current = [
        ...trailPositionsRef.current.slice(-100), // Keep last 100 points
        [data.lat, data.lng] as [number, number],
      ]

      // Update map markers if map is loaded
      updateMapMarker(data.lat, data.lng, data.heading)
      updateMapTrail()
    })

    // Listen for viewer count updates
    socket.on('viewer-count', (data: { shareToken: string; count: number }) => {
      setViewerCount(data.count)
    })

    // Listen for rider stopped
    socket.on('rider-stopped', (data: { shareToken: string }) => {
      console.log('[LiveViewer] Rider stopped broadcasting')
      setRiderStopped(true)
      toast.info('Voznik je ustavil deljenje lokacije')
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  // Update map marker
  const updateMapMarker = useCallback((lat: number, lng: number, heading: number) => {
    if (!mapRef.current || !markerRef.current) return
    try {
      markerRef.current.setLatLng([lat, lng])
      // Rotate the marker icon based on heading
      const el = markerRef.current.getElement()
      if (el) {
        el.style.transform = `rotate(${heading}deg)`
      }
      if (followRiderRef.current) {
        mapRef.current.setView([lat, lng], mapRef.current.getZoom(), { animate: true })
      }
    } catch {
      // Map may not be ready
    }
  }, [])

  // Update trail on map
  const updateMapTrail = useCallback(() => {
    if (!mapRef.current || !trailRef.current) return
    try {
      trailRef.current.setLatLngs(trailPositionsRef.current)
    } catch {
      // Map may not be ready
    }
  }, [])

  // Join a session
  const handleJoin = useCallback(() => {
    if (!token.trim()) {
      toast.error('Vnesite kodo za deljenje')
      return
    }

    const socket = socketRef.current
    if (!socket?.connected) {
      toast.error('Povezava s strežnikom ni na voljo')
      return
    }

    socket.emit('join-session', { shareToken: token.trim() })
    setJoined(true)
    setRiderStopped(false)

    // Also fetch initial position from API as fallback
    fetch(`/api/live-tracking/${token.trim()}?XTransformPort=3000`)
      .then(r => r.json())
      .then(json => {
        const data = json.data
        if (data?.lat && data?.lng) {
          setRiderPos({
            lat: data.lat,
            lng: data.lng,
            speed: data.speed || 0,
            heading: data.heading || 0,
          })
          setMapCenter({ lat: data.lat, lng: data.lng })
          setLastUpdate(data.lastUpdate ? new Date(data.lastUpdate) : new Date())
          if (data.isActive === false) {
            setRiderStopped(true)
          }
        }
      })
      .catch(() => {
        // API fallback failed, rely on WebSocket
      })

    toast.success('Pridruženi seji sledenja!')
  }, [token])

  // Leave a session
  const handleLeave = useCallback(() => {
    const socket = socketRef.current
    if (socket?.connected && token) {
      socket.emit('leave-session', { shareToken: token })
    }
    setJoined(false)
    setRiderPos(null)
    setViewerCount(0)
    setLastUpdate(null)
    setRiderStopped(false)
    trailPositionsRef.current = []

    if (!initialToken) {
      setToken('')
    }

    onClose?.()
  }, [token, initialToken, onClose])

  // Auto-join if initialToken is provided
  useEffect(() => {
    if (initialToken && socketRef.current?.connected && !joined) {
      handleJoin()
    }
  }, [initialToken, handleJoin, joined])

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let map: any = null
    let marker: any = null
    let trail: any = null

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default

        // Fix default marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        map = L.map(mapContainerRef.current!, {
          center: [mapCenter.lat, mapCenter.lng],
          zoom: 14,
          zoomControl: false,
        })

        L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png', {
          attribution: '&copy; CartoDB &copy; OSM',
          maxZoom: 20,
        }).addTo(map)

        // Custom motorcycle marker
        const riderIcon = L.divIcon({
          html: `<div style="
            width: 32px; height: 32px;
            background: #f97316;
            border: 3px solid white;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 16px;
            transition: transform 0.3s;
          ">🏍️</div>`,
          className: 'rider-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        marker = L.marker([mapCenter.lat, mapCenter.lng], { icon: riderIcon }).addTo(map)

        // Trail polyline
        trail = L.polyline([], {
          color: '#f97316',
          weight: 4,
          opacity: 0.7,
          dashArray: '8, 6',
        }).addTo(map)

        mapRef.current = map
        markerRef.current = marker
        trailRef.current = trail

        // Add zoom control to bottom-right
        L.control.zoom({ position: 'bottomright' }).addTo(map)

        // Detect when user pans the map (disable follow)
        map.on('dragstart', () => {
          followRiderRef.current = false
          setFollowRider(false)
        })
      } catch (err) {
        console.error('Failed to init map:', err)
      }
    }

    initMap()

    return () => {
      if (map) {
        map.remove()
        mapRef.current = null
        markerRef.current = null
        trailRef.current = null
      }
    }
  }, [])

  // Re-center on rider
  const handleRecenter = useCallback(() => {
    followRiderRef.current = true
    setFollowRider(true)
    if (riderPos && mapRef.current) {
      mapRef.current.setView([riderPos.lat, riderPos.lng], mapRef.current.getZoom(), { animate: true })
    }
  }, [riderPos])

  const formatTimeAgo = useCallback((date: Date | null) => {
    if (!date) return '--'
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 5) return 'Zdaj'
    if (seconds < 60) return `Pred ${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Pred ${minutes}min`
    return `Pred ${Math.floor(minutes / 60)}h`
  }, [])

  const getHeadingDirection = useCallback((heading: number) => {
    const dirs = ['S', 'JV', 'J', 'JZ', 'Z', 'SZ', 'S', 'SV']
    return dirs[Math.round(heading / 45) % 8]
  }, [])

  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-5 w-5 text-orange-500" />
          Sledenje vozniku
          {joined && !riderStopped && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5 animate-pulse">
              V ŽIVO
            </Badge>
          )}
          {riderStopped && (
            <Badge className="bg-muted/50 text-muted-foreground text-[10px] px-1.5">
              USTAVLJENO
            </Badge>
          )}
          {/* WebSocket connection indicator */}
          <div className="ml-auto flex items-center gap-1">
            {wsConnected ? (
              <div className="flex items-center gap-1 text-emerald-500">
                <Wifi className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium">WS</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" />
                <span className="text-[9px]">WS</span>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!joined ? (
          /* Token input to join a session */
          <div className="space-y-4">
            <div className="text-center space-y-2 py-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-orange-500/10 p-3">
                  <Radio className="h-6 w-6 text-orange-500" />
                </div>
              </div>
              <p className="text-sm font-medium">Vnesite kodo za sledenje</p>
              <p className="text-xs text-muted-foreground">
                Vnesite kodo, ki vam jo je delil voznik, za sledenje v realnem času
              </p>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Primer: a1b2c3d4e5f6"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="text-center font-mono text-sm"
                disabled={!wsConnected}
              />
              <Button
                onClick={handleJoin}
                disabled={!token.trim() || !wsConnected}
                className="w-full bg-orange-600 hover:bg-orange-700 gap-2"
              >
                <Crosshair className="h-4 w-4" />
                Pridruži se seji
              </Button>
            </div>

            {!wsConnected && (
              <p className="text-xs text-center text-muted-foreground">
                Povezovanje s strežnikom...
              </p>
            )}
          </div>
        ) : (
          /* Active viewing session */
          <>
            {/* Map container */}
            <div className="relative rounded-lg overflow-hidden border border-border">
              <div
                ref={mapContainerRef}
                className="w-full h-64 sm:h-72"
                style={{ background: '#1a1a2e' }}
              />
              {/* Map overlay controls */}
              <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 shadow-lg"
                  onClick={handleRecenter}
                  title="Centriraj na voznika"
                >
                  <Crosshair className="h-4 w-4" />
                </Button>
              </div>
              {/* Status badge on map */}
              <div className="absolute top-2 left-2">
                <Badge
                  className={`text-[10px] px-2 ${
                    riderStopped
                      ? 'bg-muted/80 text-muted-foreground'
                      : 'bg-orange-500/90 text-white animate-pulse'
                  }`}
                >
                  {riderStopped ? '⚫ Ustavljeno' : '🟢 V živo'}
                </Badge>
              </div>
              {/* Last update time on map */}
              <div className="absolute bottom-2 left-2">
                <Badge variant="outline" className="text-[9px] bg-background/80">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimeAgo(lastUpdate)}
                </Badge>
              </div>
            </div>

            {/* Rider info panel */}
            {riderPos && (
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center rounded-lg bg-orange-500/10 border border-orange-500/20 p-2.5">
                  <span className="text-base font-bold">{Math.round(riderPos.speed * 3.6)}</span>
                  <span className="text-[9px] text-muted-foreground">km/h</span>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-muted/50 p-2.5">
                  <div className="flex items-center gap-1">
                    <Navigation
                      className="h-3.5 w-3.5 text-orange-500"
                      style={{ transform: `rotate(${riderPos.heading}deg)` }}
                    />
                    <span className="text-base font-bold">{Math.round(riderPos.heading)}°</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {getHeadingDirection(riderPos.heading)}
                  </span>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-muted/50 p-2.5">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                  <span className="text-base font-bold">{viewerCount}</span>
                  <span className="text-[9px] text-muted-foreground">Gledalci</span>
                </div>
              </div>
            )}

            {/* Position coordinates */}
            {riderPos && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
                <MapPin className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                <span className="font-mono">
                  {riderPos.lat.toFixed(5)}, {riderPos.lng.toFixed(5)}
                </span>
                {followRider && (
                  <Badge className="ml-auto text-[8px] px-1.5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Sledi
                  </Badge>
                )}
              </div>
            )}

            {/* No position yet */}
            {!riderPos && !riderStopped && (
              <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs">Čakam na lokacijo voznika...</span>
              </div>
            )}

            {/* Rider stopped message */}
            {riderStopped && (
              <div className="flex flex-col items-center gap-2 py-3 text-muted-foreground">
                <div className="rounded-full bg-muted/50 p-3">
                  <Radio className="h-6 w-6 text-muted-foreground" />
                </div>
                <span className="text-xs">Voznik je ustavil deljenje lokacije</span>
              </div>
            )}

            {/* Session info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Koda seje:</span>
              <code className="bg-muted/50 px-1.5 py-0.5 rounded font-mono text-[11px]">
                {token}
              </code>
            </div>

            {/* Leave button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLeave}
              className="w-full gap-2"
            >
              <X className="h-4 w-4" />
              Zapusti sejo
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
