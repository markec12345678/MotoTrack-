'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
// Leaflet CSS is loaded from CDN in layout.tsx to bypass Tailwind v4 CSS processing
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Play, Pause, SkipBack, SkipForward, X,
  Mountain, MapPin, Camera, Volume2,
  VolumeX, Maximize2, Minimize2, Film,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──
interface CinemaTrackPoint {
  lat: number
  lng: number
  alt: number
  timestamp: number
  speed: number
  index: number
}

interface CinemaPhoto {
  photoIndex: number
  photoUrl: string
  photoCaption: string
  photoId: string
}

interface CinemaData {
  rideId: string
  title: string
  distance: number
  duration: number
  maxSpeed: number
  elevation: number
  totalPoints: number
  trackPoints: CinemaTrackPoint[]
  photos: CinemaPhoto[]
  stops: number[]
}

interface MoviePlayerProps {
  rideId: string
  onClose?: () => void
}

// ── Motorcycle SVG Icon for Map ──
function createMotorcycleMarker(heading: number = 0): L.DivIcon {
  return L.divIcon({
    className: 'cinema-motorcycle-marker',
    html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:-4px;background:rgba(249,115,22,0.3);border-radius:50%;animation:motoPulse 1.5s infinite;"></div>
      <div style="position:absolute;inset:0;background:#f97316;border:3px solid #fff;border-radius:50%;box-shadow:0 0 16px rgba(249,115,22,0.6);z-index:1;"></div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:2;transform:rotate(${heading}deg);">
        <circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/>
        <path d="M5 18h3l2-6h4l2 6h3"/>
        <path d="M10 12l1-4h2"/>
      </svg>
      <style>@keyframes motoPulse{0%{transform:scale(1);opacity:0.5}100%{transform:scale(2);opacity:0}}</style>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

// ── Format Helpers ──
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Main MoviePlayer Component ──
export default function MoviePlayer({ rideId, onClose }: MoviePlayerProps) {
  // State
  const [data, setData] = useState<CinemaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentPoint, setCurrentPoint] = useState(0)
  const [showPhoto, setShowPhoto] = useState<CinemaPhoto | null>(null)
  const [photoFadeIn, setPhotoFadeIn] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [narrationEnabled, setNarrationEnabled] = useState(true)
  const [locationName, setLocationName] = useState('')
  const [narrationText, setNarrationText] = useState('')

  // Refs for animation control
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)
  const traveledPolylineRef = useRef<L.Polyline | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const narratedStopsRef = useRef<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const photoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shownPhotosRef = useRef<Set<string>>(new Set())

  // Refs for accessing latest state in animation loop
  const playingRef = useRef(false)
  const speedRef = useRef(1)
  const dataRef = useRef<CinemaData | null>(null)

  // Keep refs in sync
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { dataRef.current = data }, [data])

  // Load cinema data
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const res = await fetch(`/api/cinema?rideId=${rideId}`)
        if (res.ok) {
          const json = await res.json()
          if (!cancelled && json.data) {
            setData(json.data)
          }
        }
      } catch {
        if (!cancelled) {
          setData(createSimulatedData())
        }
      }
      if (!cancelled) setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [rideId])

  // Initialize Leaflet map
  useEffect(() => {
    if (!data || !mapContainerRef.current) return

    const container = mapContainerRef.current
    const existingMap = mapRef.current
    if (existingMap) {
      existingMap.remove()
      mapRef.current = null
    }
    const containerEl = container as HTMLDivElement & { _leaflet_id?: number }
    delete containerEl._leaflet_id

    const firstPt = data.trackPoints[0]
    if (!firstPt) return

    const map = L.map(container, {
      center: [firstPt.lat, firstPt.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', {
      maxZoom: 19,
    }).addTo(map)

    const routeCoords = data.trackPoints.map(p => [p.lat, p.lng] as L.LatLngExpression)
    const fullPolyline = L.polyline(routeCoords, {
      color: '#f97316',
      weight: 4,
      opacity: 0.3,
      dashArray: '8 6',
    }).addTo(map)
    polylineRef.current = fullPolyline

    const traveledLine = L.polyline([], {
      color: '#f97316',
      weight: 5,
      opacity: 0.9,
    }).addTo(map)
    traveledPolylineRef.current = traveledLine

    // Photo markers
    data.photos.forEach(photo => {
      const pt = data.trackPoints[photo.photoIndex]
      if (pt) {
        const photoIcon = L.divIcon({
          className: 'cinema-photo-marker',
          html: `<div style="background:rgba(34,197,94,0.9);border:2px solid #fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(34,197,94,0.5);">
            <span style="font-size:10px;">📷</span>
          </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
        L.marker([pt.lat, pt.lng], { icon: photoIcon, interactive: false }).addTo(map)
      }
    })

    const startMarker = L.marker([firstPt.lat, firstPt.lng], {
      icon: createMotorcycleMarker(0),
      zIndexOffset: 1000,
    }).addTo(map)
    markerRef.current = startMarker

    if (routeCoords.length > 1) {
      map.fitBounds(fullPolyline.getBounds(), { padding: [40, 40] })
    }

    mapRef.current = map

    const timer = setTimeout(() => {
      if (mapRef.current === map) {
        try { map.invalidateSize() } catch { /* */ }
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      polylineRef.current = null
      traveledPolylineRef.current = null
    }
  }, [data])

  // Trigger TTS narration (defined before animation loop that uses it)
  const triggerNarration = useCallback(async (pt: CinemaTrackPoint) => {
    try {
      const res = await fetch('/api/cinema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: pt.lat,
          lng: pt.lng,
          speed: pt.speed,
          altitude: pt.alt,
          action: 'narrate',
        }),
      })

      if (res.ok) {
        const contentType = res.headers.get('Content-Type') || ''
        if (contentType.includes('audio')) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          if (audioRef.current) {
            audioRef.current.src = url
            audioRef.current.play().catch(() => {})
          }
        } else {
          const json = await res.json()
          if (json.narration) {
            setNarrationText(json.narration)
            setTimeout(() => setNarrationText(''), 4000)
          }
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Main animation loop using requestAnimationFrame
  useEffect(() => {
    if (!data) return

    const animate = (now: number) => {
      if (!playingRef.current || !dataRef.current) {
        animFrameRef.current = requestAnimationFrame(animate)
        return
      }

      if (lastTickRef.current === 0) {
        lastTickRef.current = now
        animFrameRef.current = requestAnimationFrame(animate)
        return
      }

      const dt = (now - lastTickRef.current) / 1000
      lastTickRef.current = now

      const pointsPerSecond = speedRef.current * 2
      const pointsToAdvance = Math.round(dt * pointsPerSecond)

      if (pointsToAdvance > 0) {
        setCurrentPoint(prev => {
          const next = Math.min(prev + pointsToAdvance, dataRef.current!.totalPoints - 1)

          // Check for photo at this point
          const photoAtPoint = dataRef.current!.photos.find(p => {
            return Math.abs(p.photoIndex - next) <= 3 && !shownPhotosRef.current.has(p.photoId)
          })

          if (photoAtPoint) {
            shownPhotosRef.current.add(photoAtPoint.photoId)
            // Trigger photo display via setTimeout to avoid setState in rAF
            setTimeout(() => {
              setPlaying(false)
              setShowPhoto(photoAtPoint)
              setTimeout(() => setPhotoFadeIn(true), 50)

              if (photoTimerRef.current) clearTimeout(photoTimerRef.current)
              photoTimerRef.current = setTimeout(() => {
                setPhotoFadeIn(false)
                setTimeout(() => {
                  setShowPhoto(null)
                  setPlaying(true)
                  playingRef.current = true
                }, 500)
              }, 3000)
            }, 0)
            return next
          }

          // Check for narration at stop points
          const isNearStop = dataRef.current!.stops.some(stopIdx => Math.abs(stopIdx - next) <= 5)
          if (isNearStop && !narratedStopsRef.current.has(next)) {
            const stopArea = Math.floor(next / 20) * 20
            narratedStopsRef.current.add(stopArea)
            const pt = dataRef.current!.trackPoints[next]
            if (pt) {
              setTimeout(() => triggerNarration(pt), 0)
            }
          }

          if (next >= dataRef.current!.totalPoints - 1) {
            setTimeout(() => setPlaying(false), 0)
            playingRef.current = false
          }

          return next
        })
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [data])

  // Update map position based on current point
  useEffect(() => {
    if (!data || !mapRef.current || !markerRef.current) return

    const pt = data.trackPoints[currentPoint]
    if (!pt) return

    markerRef.current.setLatLng([pt.lat, pt.lng])

    if (currentPoint > 0) {
      const prev = data.trackPoints[currentPoint - 1]
      const heading = Math.atan2(pt.lng - prev.lng, pt.lat - prev.lat) * (180 / Math.PI)
      markerRef.current.setIcon(createMotorcycleMarker(heading))
    }

    mapRef.current.panTo([pt.lat, pt.lng], { animate: true, duration: 0.3 })

    if (traveledPolylineRef.current) {
      const traveledCoords = data.trackPoints.slice(0, currentPoint + 1).map(p => [p.lat, p.lng] as L.LatLngExpression)
      traveledPolylineRef.current.setLatLngs(traveledCoords)
    }

    // Reverse geocode (throttled)
    if (currentPoint % 20 === 0) {
      fetch(`/api/cinema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pt.lat, lng: pt.lng, action: 'location' }),
      })
        .then(r => r.json())
        .then(j => { if (j.locationName) setLocationName(j.locationName) })
        .catch(() => {})
    }
  }, [currentPoint, data])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setPlaying(p => {
          const newVal = !p
          playingRef.current = newVal
          if (newVal && data && currentPoint >= data.totalPoints - 1) {
            setCurrentPoint(0)
          }
          if (newVal) lastTickRef.current = 0
          return newVal
        })
      }
      if (e.key === 'Escape') {
        onClose?.()
      }
      if (e.key === 'ArrowRight') {
        setCurrentPoint(p => Math.min(p + 10, (data?.totalPoints || 1) - 1))
      }
      if (e.key === 'ArrowLeft') {
        setCurrentPoint(p => Math.max(p - 10, 0))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [data, currentPoint, onClose])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-[3000] bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-white text-lg font-bold flex items-center gap-2">
              <Film className="size-5 text-orange-500" /> Moto Cinema
            </p>
            <p className="text-white/50 text-sm mt-1">Pripravljam dokumentarni film...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const point = data.trackPoints[currentPoint]
  const progress = data.totalPoints > 0 ? ((currentPoint + 1) / data.totalPoints) * 100 : 0
  const elapsedSeconds = data.duration > 0 ? Math.round((currentPoint / data.totalPoints) * data.duration) : 0

  return (
    <div ref={containerRef} className="fixed inset-0 z-[3000] bg-black flex flex-col cinema-player">
      <audio ref={audioRef} className="hidden" />

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Title bar */}
        <div className="absolute top-0 left-0 right-0 z-[400] bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-8 rounded-full bg-orange-500/20">
                <Film className="size-4 text-orange-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-sm">{data.title}</h2>
                <p className="text-white/50 text-[10px]">
                  {data.distance.toFixed(1)} km · {data.totalPoints} točk
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[9px]">
                CINEMA
              </Badge>
              {playing && (
                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] animate-pulse">
                  ● LIVE
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="size-8 text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Telemetry HUD */}
        <div className="absolute top-16 right-3 z-[400] w-40">
          <div className="rounded-lg overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.75), rgba(0,0,0,0.55))',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 bg-white/5">
              <span className="text-[8px] text-zinc-400 font-semibold tracking-wider uppercase">Telemetrija</span>
              <span className="text-[8px] text-green-400 flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="p-2 space-y-2">
              <div className="text-center">
                <div className="text-2xl font-mono font-black text-orange-400">
                  {point ? Math.round(point.speed) : 0}
                </div>
                <div className="text-[8px] text-zinc-500 uppercase tracking-wider">km/h</div>
              </div>
              <div className="flex items-center gap-1.5">
                <Mountain className="size-3 text-sky-400 flex-shrink-0" />
                <div className="flex-1"><div className="text-[8px] text-zinc-500 uppercase">Nadm. viš.</div></div>
                <span className="text-xs font-mono font-bold text-sky-400">{point ? Math.round(point.alt) : 0}m</span>
              </div>
              {locationName && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-[9px] text-emerald-400 font-medium truncate">{locationName}</span>
                </div>
              )}
              {data.photos.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Camera className="size-3 text-pink-400 flex-shrink-0" />
                  <span className="text-[9px] text-pink-400">{data.photos.length} {data.photos.length === 1 ? 'fotografija' : 'fotografije'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Narration Text */}
        {narrationText && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[400] max-w-md">
            <div className="bg-black/80 backdrop-blur-md rounded-xl px-6 py-3 border border-orange-500/20">
              <p className="text-white text-sm text-center font-medium">{narrationText}</p>
            </div>
          </div>
        )}

        {/* Photo Overlay */}
        {showPhoto && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            style={{ opacity: photoFadeIn ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }}
          >
            <div className="relative max-w-lg w-full mx-4">
              <div className="rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl shadow-orange-500/20">
                {showPhoto.photoUrl.startsWith('/') ? (
                  <div className="w-full h-48 bg-gradient-to-br from-orange-500/20 to-emerald-500/20 flex items-center justify-center">
                    <Camera className="size-12 text-white/30" />
                  </div>
                ) : (
                  <img src={showPhoto.photoUrl} alt={showPhoto.photoCaption || 'Fotografija'} className="w-full max-h-[60vh] object-cover" />
                )}
                {showPhoto.photoCaption && (
                  <div className="bg-black/80 backdrop-blur-sm p-3">
                    <p className="text-white text-sm text-center">{showPhoto.photoCaption}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center mt-3 gap-2">
                <Camera className="size-4 text-orange-400" />
                <span className="text-white/70 text-xs">Fotografija z vožnje</span>
                <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[9px]">
                  SAMODEJNA USTAVITEV
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Point Counter */}
        <div className="absolute top-16 left-3 z-[400]">
          <div className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10">
            <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Točka</div>
            <div className="text-sm font-mono font-bold text-white">
              {currentPoint + 1}<span className="text-zinc-500">/{data.totalPoints}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="bg-gradient-to-t from-black via-black/95 to-transparent">
        {/* Progress */}
        <div className="px-4 pt-2">
          <div className="relative group cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            setCurrentPoint(Math.floor(x * data.totalPoints))
          }}>
            <Progress value={progress} className="h-1.5 bg-zinc-800 [&>div]:bg-orange-500" />
            {data.photos.map((photo, i) => {
              const pct = (photo.photoIndex / data.totalPoints) * 100
              return (
                <div key={i} className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 border border-white/30"
                  style={{ left: `${pct}%` }} />
              )
            })}
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50 border-2 border-white"
              style={{ left: `${progress}%` }} />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-white/70 text-xs font-mono min-w-[80px]">
            <span className="text-white">{formatTime(elapsedSeconds)}</span>
            <span className="text-zinc-600"> / {formatTime(data.duration)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setCurrentPoint(p => Math.max(p - 20, 0))}>
              <SkipBack className="size-4" />
            </Button>
            <Button
              size="icon"
              className="size-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30"
              onClick={() => {
                if (currentPoint >= data.totalPoints - 1) setCurrentPoint(0)
                const newPlaying = !playing
                setPlaying(newPlaying)
                playingRef.current = newPlaying
                if (newPlaying) lastTickRef.current = 0
              }}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setCurrentPoint(p => Math.min(p + 20, data.totalPoints - 1))}>
              <SkipForward className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 min-w-[80px] justify-end">
            {[1, 2, 4, 8].map(s => (
              <button key={s} onClick={() => { setSpeed(s); speedRef.current = s }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                  speed === s ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
            <Button variant="ghost" size="icon" className="size-7 text-white/50 hover:text-white hover:bg-white/10"
              onClick={() => {
                setNarrationEnabled(n => !n)
                toast.success(narrationEnabled ? 'Narracija izključena' : 'Narracija vključena')
              }}
              title={narrationEnabled ? 'Izklopi narracijo' : 'Vklopi narracijo'}
            >
              {narrationEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-white/50 hover:text-white hover:bg-white/10"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 pb-2 text-[10px] text-zinc-600">
          <span>📏 {data.distance.toFixed(1)} km</span>
          <span>🏔️ {data.elevation}m</span>
          <span>🏎️ {data.maxSpeed} km/h max</span>
          <span>📷 {data.photos.length} slik</span>
          <span className="text-orange-500/50">by Markec</span>
        </div>
      </div>
    </div>
  )
}

// ── Simulated data fallback ──
function createSimulatedData(): CinemaData {
  const trackPoints: CinemaTrackPoint[] = Array.from({ length: 150 }, (_, i) => ({
    lat: 46.15 + (i / 150) * 0.3 + Math.sin(i / 8) * 0.02,
    lng: 14.99 + Math.sin(i / 6) * 0.04 + (i / 150) * 0.1,
    alt: 300 + Math.sin(i / 5) * 80 + i * 2,
    speed: 40 + Math.random() * 80,
    timestamp: Date.now() - (150 - i) * 60000,
    index: i,
  }))

  return {
    rideId: 'demo',
    title: 'Demo vožnja — Julijske Alpe',
    distance: 67.5,
    duration: 5400,
    maxSpeed: 128,
    elevation: 1450,
    totalPoints: trackPoints.length,
    trackPoints,
    photos: [],
    stops: [25, 50, 75, 100, 125],
  }
}
