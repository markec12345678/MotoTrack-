'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import L from 'leaflet'
import {
  Play, Pause, RotateCcw, X, Gauge, Mountain, Navigation2,
  Clock, Activity, Maximize2, Minimize2, Lock, Unlock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'

// ─── Types ─────────────────────────────────────────────────────────────

interface RouteSimulatorProps {
  points: Array<{ lat: number; lng: number; alt?: number | null; timestamp?: number }>
  map?: L.Map | null
  routeName?: string
  totalDistance?: number
  autoStart?: boolean
  onClose?: () => void
  className?: string
}

interface SimPoint {
  lat: number
  lng: number
  alt: number
  bearing: number
  speed: number
  twistiness: number
  distance: number
}

interface SimSegment {
  startIdx: number
  endIdx: number
  type: 'twisty' | 'straight' | 'urban' | 'highway'
  avgSpeed: number
}

// ─── Constants ─────────────────────────────────────────────────────────

const SPEED_OPTIONS = [1, 2, 4, 8, 16] as const

const BEARING_DIRECTIONS_SL: [number, string][] = [
  [22.5, 'S'],
  [67.5, 'SV'],
  [112.5, 'V'],
  [157.5, 'JV'],
  [202.5, 'J'],
  [247.5, 'JZ'],
  [292.5, 'Z'],
  [337.5, 'SZ'],
  [360, 'S'],
]

function bearingToDirection(bearing: number): string {
  const norm = ((bearing % 360) + 360) % 360
  for (const [limit, label] of BEARING_DIRECTIONS_SL) {
    if (norm < limit) return label
  }
  return 'S'
}

// ─── Helpers ───────────────────────────────────────────────────────────

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const la1 = (lat1 * Math.PI) / 180
  const la2 = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDiff(b1: number, b2: number): number {
  const d = Math.abs(b1 - b2)
  return d > 180 ? 360 - d : d
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return ((a + diff * t) % 360 + 360) % 360
}

// Create motorcycle SVG marker icon
function createMotoIcon(bearing: number): L.DivIcon {
  return L.divIcon({
    className: 'sim-moto-marker',
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:40px;height:40px;position:relative;
      transform:rotate(${bearing}deg);
      transition:transform 0.15s ease-out;
    ">
      <div style="position:absolute;inset:0;background:rgba(249,115,22,0.2);border-radius:50%;animation:simPulse 1.5s infinite;"></div>
      <div style="position:absolute;inset:3px;background:#f97316;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(249,115,22,0.6);z-index:1;"></div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:2;">
        <circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/>
        <path d="M5 18h3l2-6h4l2 6h3"/>
        <path d="M10 12l1-4h2"/>
      </svg>
    </div>
    <style>@keyframes simPulse{0%{transform:scale(1);opacity:0.5}100%{transform:scale(2);opacity:0}}</style>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

// ─── Simulation Data Preparation ───────────────────────────────────────

function prepareSimulationData(
  rawPoints: Array<{ lat: number; lng: number; alt?: number | null; timestamp?: number }>
): { points: SimPoint[]; segments: SimSegment[]; totalDistance: number } {
  if (rawPoints.length < 2) {
    return { points: [], segments: [], totalDistance: 0 }
  }

  // Step 1: Interpolate to get ~50m spacing for smooth animation
  const interpolated: Array<{ lat: number; lng: number; alt: number }> = []
  interpolated.push({ lat: rawPoints[0].lat, lng: rawPoints[0].lng, alt: rawPoints[0].alt ?? 300 })

  for (let i = 1; i < rawPoints.length; i++) {
    const prev = rawPoints[i - 1]
    const curr = rawPoints[i]
    const segDist = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng) * 1000 // meters
    const numInterp = Math.max(0, Math.floor(segDist / 50) - 1)

    for (let j = 1; j <= numInterp; j++) {
      const t = j / (numInterp + 1)
      interpolated.push({
        lat: lerp(prev.lat, curr.lat, t),
        lng: lerp(prev.lng, curr.lng, t),
        alt: lerp(prev.alt ?? 300, curr.alt ?? 300, t),
      })
    }
    interpolated.push({ lat: curr.lat, lng: curr.lng, alt: curr.alt ?? 300 })
  }

  // Step 2: Calculate bearing, twistiness, and speed for each point
  const simPoints: SimPoint[] = interpolated.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    alt: p.alt,
    bearing: 0,
    speed: 80,
    twistiness: 0,
    distance: 0,
  }))

  // Calculate bearings
  for (let i = 0; i < simPoints.length; i++) {
    if (i < simPoints.length - 1) {
      simPoints[i].bearing = calculateBearing(
        simPoints[i].lat, simPoints[i].lng,
        simPoints[i + 1].lat, simPoints[i + 1].lng
      )
    } else if (i > 0) {
      simPoints[i].bearing = simPoints[i - 1].bearing
    }
  }

  // Calculate cumulative distance
  for (let i = 1; i < simPoints.length; i++) {
    simPoints[i].distance =
      simPoints[i - 1].distance +
      haversineKm(simPoints[i - 1].lat, simPoints[i - 1].lng, simPoints[i].lat, simPoints[i].lng)
  }

  // Calculate twistiness using sliding window
  const WINDOW = 10
  for (let i = 0; i < simPoints.length; i++) {
    const start = Math.max(0, i - WINDOW)
    let totalBearingChange = 0
    for (let j = start + 1; j <= i; j++) {
      totalBearingChange += bearingDiff(simPoints[j - 1].bearing, simPoints[j].bearing)
    }
    const windowDist = simPoints[i].distance - simPoints[start].distance
    simPoints[i].twistiness = windowDist > 0.001
      ? Math.min(100, (totalBearingChange / windowDist) * 10)
      : 0
  }

  // Step 3: Calculate simulated speed based on twistiness and elevation
  for (let i = 0; i < simPoints.length; i++) {
    const twist = simPoints[i].twistiness
    const altChange = i > 0 ? simPoints[i].alt - simPoints[i - 1].alt : 0
    const gradient = i > 0 ? altChange / (haversineKm(simPoints[i - 1].lat, simPoints[i - 1].lng, simPoints[i].lat, simPoints[i].lng) * 1000) : 0

    let baseSpeed: number
    if (twist >= 60) {
      baseSpeed = 40 + Math.random() * 40 // 40-80 twisty
    } else if (twist >= 30) {
      baseSpeed = 60 + Math.random() * 40 // 60-100 moderate
    } else {
      baseSpeed = 80 + Math.random() * 40 // 80-120 straight
    }

    // Elevation adjustments
    if (gradient > 0.05) {
      baseSpeed = Math.max(30, baseSpeed - 30) // uphill: 30-60
    } else if (gradient < -0.05) {
      baseSpeed = Math.max(50, Math.min(90, baseSpeed + 10)) // downhill: 50-90
    }

    // Add ±10% variation
    const variation = 1 + (Math.random() - 0.5) * 0.2
    simPoints[i].speed = Math.round(baseSpeed * variation)
  }

  // Smooth speed values to avoid sudden jumps
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < simPoints.length - 1; i++) {
      simPoints[i].speed = Math.round(
        (simPoints[i - 1].speed + simPoints[i].speed * 2 + simPoints[i + 1].speed) / 4
      )
    }
  }

  // Step 4: Segment classification
  const segments: SimSegment[] = []
  let segStart = 0
  let segType: SimSegment['type'] = 'straight'
  let segSpeedSum = simPoints[0]?.speed ?? 80

  for (let i = 1; i <= simPoints.length; i++) {
    let newType: SimSegment['type'] = 'straight'
    if (i < simPoints.length) {
      const twist = simPoints[i].twistiness
      if (twist >= 50) newType = 'twisty'
      else if (twist >= 20) newType = 'straight'
      else newType = 'highway'
    }

    if (i === simPoints.length || newType !== segType) {
      if (i > segStart) {
        segments.push({
          startIdx: segStart,
          endIdx: Math.min(i - 1, simPoints.length - 1),
          type: segType,
          avgSpeed: Math.round(segSpeedSum / (i - segStart)),
        })
      }
      segStart = i
      segType = newType
      segSpeedSum = i < simPoints.length ? simPoints[i].speed : 0
    } else {
      segSpeedSum += simPoints[i].speed
    }
  }

  const totalDist = simPoints.length > 0 ? simPoints[simPoints.length - 1].distance : 0

  return { points: simPoints, segments, totalDistance: totalDist }
}

// ─── Main Component ────────────────────────────────────────────────────

export default function RouteSimulator({
  points: rawPoints,
  map,
  routeName,
  totalDistance: propTotalDistance,
  autoStart = false,
  onClose,
  className = '',
}: RouteSimulatorProps) {
  // State
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const [progress, setProgress] = useState(0)
  const [freeCamera, setFreeCamera] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  // Refs
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef(0)
  const currentIdxRef = useRef(0)
  const markerRef = useRef<L.Marker | null>(null)
  const coveredLineRef = useRef<L.Polyline | null>(null)
  const remainingLineRef = useRef<L.Polyline | null>(null)
  const simLayerRef = useRef<L.LayerGroup | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [simReady, setSimReady] = useState(false)

  // Prepare simulation data
  const simData = useMemo(() => prepareSimulationData(rawPoints), [rawPoints])
  const { points, segments, totalDistance } = simData
  const effectiveTotalDist = propTotalDistance ?? totalDistance

  // Current point data
  const currentPoint = points[currentIdx] ?? null
  const currentSpeed = currentPoint?.speed ?? 0
  const currentAlt = currentPoint?.alt ?? 0
  const currentBearing = currentPoint?.bearing ?? 0
  const currentDist = currentPoint?.distance ?? 0
  const currentTwist = currentPoint?.twistiness ?? 0
  const distPct = effectiveTotalDist > 0 ? Math.round((currentDist / effectiveTotalDist) * 100) : 0

  // ETA calculation
  const remainingDist = effectiveTotalDist - currentDist
  const etaMinutes = currentSpeed > 5 ? Math.round((remainingDist / currentSpeed) * 60) : 0
  const etaHours = Math.floor(etaMinutes / 60)
  const etaMins = etaMinutes % 60

  // ─── Map Layer Management ──────────────────────────────────────────────

  // Initialize simulation layers on map
  useEffect(() => {
    if (!map || points.length < 2) return

    const simLayer = L.layerGroup().addTo(map)
    simLayerRef.current = simLayer

    // Route line (remaining - blue)
    const remainingCoords: L.LatLngExpression[] = points.map(p => [p.lat, p.lng] as L.LatLngExpression)
    const remainingLine = L.polyline(remainingCoords, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.6,
      dashArray: '8 6',
    }).addTo(simLayer)
    remainingLineRef.current = remainingLine

    // Route line (covered - green)
    const coveredLine = L.polyline([], {
      color: '#22c55e',
      weight: 5,
      opacity: 0.9,
    }).addTo(simLayer)
    coveredLineRef.current = coveredLine

    // Start marker
    const startIcon = L.divIcon({
      className: 'sim-start-marker',
      html: `<div style="width:16px;height:16px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
    L.marker([points[0].lat, points[0].lng], { icon: startIcon }).addTo(simLayer)

    // End marker
    const endIcon = L.divIcon({
      className: 'sim-end-marker',
      html: `<div style="width:16px;height:16px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
    L.marker([points[points.length - 1].lat, points[points.length - 1].lng], { icon: endIcon }).addTo(simLayer)

    // Motorcycle marker
    const motoIcon = createMotoIcon(points[0].bearing)
    const motoMarker = L.marker([points[0].lat, points[0].lng], { icon: motoIcon, zIndexOffset: 1000 }).addTo(simLayer)
    markerRef.current = motoMarker

    setSimReady(true)

    // Zoom to route bounds
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as L.LatLngExpression))
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })

    return () => {
      simLayer.remove()
      simLayerRef.current = null
      markerRef.current = null
      coveredLineRef.current = null
      remainingLineRef.current = null
      setSimReady(false)
    }
  }, [map, points])

  // ─── Control Handlers (declared before keyboard shortcuts) ─────────────

  const handleRestart = useCallback(() => {
    setPlaying(false)
    currentIdxRef.current = 0
    setCurrentIdx(0)
    setProgress(0)
    if (markerRef.current && points[0]) {
      markerRef.current.setLatLng([points[0].lat, points[0].lng])
      markerRef.current.setIcon(createMotoIcon(points[0].bearing))
    }
    if (coveredLineRef.current) coveredLineRef.current.setLatLngs([])
    if (remainingLineRef.current) {
      const allCoords = points.map(p => [p.lat, p.lng] as L.LatLngExpression)
      remainingLineRef.current.setLatLngs(allCoords)
    }
    if (map && points[0]) {
      map.panTo([points[0].lat, points[0].lng], { animate: true, duration: 0.5 })
    }
  }, [map, points])

  const seekToProgress = useCallback((p: number) => {
    const idx = Math.round(p * (points.length - 1))
    currentIdxRef.current = idx
    setCurrentIdx(idx)
    setProgress(p)
    setPlaying(false)

    if (markerRef.current && points[idx]) {
      const pt = points[idx]
      markerRef.current.setLatLng([pt.lat, pt.lng])
      markerRef.current.setIcon(createMotoIcon(pt.bearing))
    }
    if (coveredLineRef.current && idx > 0) {
      const coords = points.slice(0, idx + 1).map(pt => [pt.lat, pt.lng] as L.LatLngExpression)
      coveredLineRef.current.setLatLngs(coords)
    }
    if (remainingLineRef.current) {
      const coords = points.slice(idx).map(pt => [pt.lat, pt.lng] as L.LatLngExpression)
      remainingLineRef.current.setLatLngs(coords)
    }
    if (map && points[idx] && !freeCamera) {
      map.panTo([points[idx].lat, points[idx].lng], { animate: true, duration: 0.3 })
    }
  }, [points, map, freeCamera])

  // ─── Animation Loop ────────────────────────────────────────────────────

  // Use a ref for the animate function to allow self-reference without hoisting issues
  const animateRef = useRef<(timestamp: number) => void>(() => {})

  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp
      animRef.current = requestAnimationFrame(animateRef.current)
      return
    }

    const deltaMs = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp

    // Advance based on speed multiplier and simulated speed
    const idx = currentIdxRef.current
    if (idx >= points.length - 1) {
      setPlaying(false)
      return
    }

    // Each point represents ~50m. At speed S km/h, we traverse 50m in (0.05/S)*3600 seconds
    // In simulation time, we speed this up by the speed multiplier
    const simSpeedAtPoint = points[idx]?.speed ?? 80
    const realTimePerPointMs = (0.05 / simSpeedAtPoint) * 3600 * 1000 // ms per point at real speed
    const simulatedTimePerPointMs = realTimePerPointMs / speed
    const pointsToAdvance = Math.max(1, Math.round(deltaMs / simulatedTimePerPointMs))

    const newIdx = Math.min(idx + pointsToAdvance, points.length - 1)
    currentIdxRef.current = newIdx
    setCurrentIdx(newIdx)
    setProgress(newIdx / Math.max(1, points.length - 1))

    // Update map elements
    if (markerRef.current && points[newIdx]) {
      const p = points[newIdx]
      markerRef.current.setLatLng([p.lat, p.lng])
      markerRef.current.setIcon(createMotoIcon(p.bearing))
    }

    // Update covered line
    if (coveredLineRef.current && newIdx > 0) {
      const coveredCoords: L.LatLngExpression[] = points.slice(0, newIdx + 1).map(p => [p.lat, p.lng] as L.LatLngExpression)
      coveredLineRef.current.setLatLngs(coveredCoords)
    }

    // Update remaining line
    if (remainingLineRef.current) {
      const remCoords: L.LatLngExpression[] = points.slice(newIdx).map(p => [p.lat, p.lng] as L.LatLngExpression)
      remainingLineRef.current.setLatLngs(remCoords)
    }

    // Camera follow
    if (!freeCamera && map && points[newIdx]) {
      const p = points[newIdx]
      map.panTo([p.lat, p.lng], { animate: true, duration: 0.3 })

      // Dynamic zoom based on twistiness
      const twist = points[newIdx].twistiness
      let targetZoom: number
      if (twist >= 60) targetZoom = 15 // Zoom in for twisty
      else if (twist >= 30) targetZoom = 14
      else targetZoom = 13 // Zoom out for straight

      const currentZoom = map.getZoom()
      if (Math.abs(currentZoom - targetZoom) >= 1) {
        map.setZoom(targetZoom, { animate: true })
      }
    }

    if (newIdx < points.length - 1) {
      animRef.current = requestAnimationFrame(animateRef.current)
    } else {
      setPlaying(false)
    }
  }, [points, speed, freeCamera, map])

  // Keep the ref updated (must be in effect, not during render)
  useEffect(() => {
    animateRef.current = animate
  }, [animate])

  useEffect(() => {
    if (playing && points.length >= 2) {
      lastTimeRef.current = 0
      animRef.current = requestAnimationFrame(animateRef.current)
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [playing, animate, points.length])

  // Auto-start
  useEffect(() => {
    if (autoStart && simReady && points.length >= 2) {
      setPlaying(true)
    }
  }, [autoStart, simReady, points.length])

  // ─── Keyboard Shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          if (currentIdx >= points.length - 1) {
            handleRestart()
          }
          setPlaying(p => !p)
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekToProgress(Math.max(0, currentIdxRef.current / points.length - 0.1))
          break
        case 'ArrowRight':
          e.preventDefault()
          seekToProgress(Math.min(1, currentIdxRef.current / points.length + 0.1))
          break
        case 'Digit1': setSpeed(1); break
        case 'Digit2': setSpeed(2); break
        case 'Digit3': setSpeed(4); break
        case 'Digit4': setSpeed(8); break
        case 'Digit5': setSpeed(16); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [points.length, currentIdx, handleRestart, seekToProgress])

  // ─── Elevation Profile SVG ─────────────────────────────────────────────

  const elevationSvg = useMemo(() => {
    if (points.length < 2) return null
    const w = 300
    const h = 44
    const minAlt = Math.min(...points.map(p => p.alt))
    const maxAlt = Math.max(...points.map(p => p.alt))
    const altRange = maxAlt - minAlt || 1
    const step = w / (points.length - 1)

    const pathStr = points.map((p, i) => {
      const x = i * step
      const y = h - 2 - ((p.alt - minAlt) / altRange) * (h - 4)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')

    const cx = currentIdx * step
    const cy = h - 2 - ((points[currentIdx]?.alt ?? minAlt) - minAlt) / altRange * (h - 4)

    // Covered vs remaining split
    const coveredEndX = currentIdx * step

    return (
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="simElevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Full profile background */}
        <path d={`${pathStr} L${w},${h} L0,${h} Z`} fill="url(#simElevGrad)" />
        {/* Full profile line */}
        <path d={pathStr} fill="none" stroke="#f97316" strokeWidth="1.5" opacity="0.4" />
        {/* Covered portion (brighter) */}
        {currentIdx > 0 && (
          <path
            d={points.slice(0, currentIdx + 1).map((p, i) => {
              const x = i * step
              const y = h - 2 - ((p.alt - minAlt) / altRange) * (h - 4)
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
            }).join(' ')}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
          />
        )}
        {/* Current position */}
        <circle cx={cx} cy={cy} r="3" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
      </svg>
    )
  }, [points, currentIdx])

  // ─── Twistiness indicator ──────────────────────────────────────────────

  const twistInfo = useMemo(() => {
    if (currentTwist >= 60) return { label: 'Ekstremno vijugasto', emoji: '🔥', color: '#10b981' }
    if (currentTwist >= 40) return { label: 'Vijugasto', emoji: '🌀', color: '#22c55e' }
    if (currentTwist >= 20) return { label: 'Zmerno vijugasto', emoji: '↪️', color: '#eab308' }
    return { label: 'Ravna cesta', emoji: '➡️', color: '#f97316' }
  }, [currentTwist])

  // ─── Render ─────────────────────────────────────────────────────────────

  if (points.length < 2) {
    return (
      <div className={`bg-card/95 backdrop-blur-md border border-border/50 rounded-xl p-4 ${className}`}>
        <p className="text-sm text-muted-foreground text-center">Potrebujem vsaj 2 točki za simulacijo</p>
        {onClose && (
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={onClose}>Zapri</Button>
        )}
      </div>
    )
  }

  return (
    <div
      className={`${fullscreen ? 'fixed inset-0 z-[9999]' : ''} flex flex-col justify-end pointer-events-none ${className}`}
    >
      {/* Control Panel */}
      <div
        className={`pointer-events-auto bg-gradient-to-t from-black/90 via-black/80 to-black/50 backdrop-blur-lg border-t border-white/10 ${
          fullscreen ? '' : 'rounded-t-2xl'
        }`}
      >
        {/* Top info bar */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Navigation2 className="size-4 text-orange-400" />
              <span className="text-sm font-bold text-white">
                {routeName ?? 'Simulacija poti'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setFreeCamera(f => !f)}
                title={freeCamera ? 'Sprosti kamero' : 'Sledi kameri'}
              >
                {freeCamera ? <Unlock className="size-4" /> : <Lock className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setFullscreen(f => !f)}
              >
                {fullscreen ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={onClose}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* HUD stats row */}
          <div className="grid grid-cols-5 gap-2 mb-2">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Gauge className="size-3 text-orange-400" />
                <span className="text-lg font-black text-white tabular-nums">{currentSpeed}</span>
              </div>
              <span className="text-[9px] text-white/50">km/h</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Mountain className="size-3 text-sky-400" />
                <span className="text-lg font-black text-white tabular-nums">{Math.round(currentAlt)}</span>
              </div>
              <span className="text-[9px] text-white/50">m</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Navigation2 className="size-3 text-green-400" style={{ transform: `rotate(${currentBearing}deg)` }} />
                <span className="text-lg font-black text-white tabular-nums">{bearingToDirection(currentBearing)}</span>
              </div>
              <span className="text-[9px] text-white/50">{Math.round(currentBearing)}°</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Activity className="size-3" style={{ color: twistInfo.color }} />
                <span className="text-lg font-black text-white tabular-nums">{Math.round(currentTwist)}</span>
              </div>
              <span className="text-[9px] text-white/50">{twistInfo.emoji}</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Clock className="size-3 text-purple-400" />
                <span className="text-sm font-bold text-white tabular-nums">
                  {etaHours > 0 ? `${etaHours}h ` : ''}{etaMins}m
                </span>
              </div>
              <span className="text-[9px] text-white/50">ETA</span>
            </div>
          </div>

          {/* Distance progress */}
          <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
            <span>{currentDist.toFixed(1)} km</span>
            <Badge variant="secondary" className="text-[10px] bg-orange-500/20 text-orange-300 border-orange-500/30 px-2 py-0">
              {distPct}%
            </Badge>
            <span>{effectiveTotalDist.toFixed(1)} km</span>
          </div>
        </div>

        {/* Elevation mini profile */}
        <div className="px-4 pb-1">
          <div className="bg-white/5 rounded-md p-1.5">
            {elevationSvg}
          </div>
        </div>

        {/* Progress bar with scrubbing */}
        <div className="px-4 py-2">
          <Slider
            value={[Math.round(progress * 100)]}
            onValueChange={(val) => seekToProgress(val[0] / 100)}
            max={100}
            step={1}
            className="w-full [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-400 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 pb-4 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-white/80 hover:text-white hover:bg-white/10 shrink-0"
            onClick={handleRestart}
            title="Na začetek"
          >
            <RotateCcw className="size-5" />
          </Button>

          <button
            onClick={() => {
              if (currentIdx >= points.length - 1) handleRestart()
              setPlaying(p => !p)
            }}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0 ${
              playing
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/40'
            } ${!playing ? 'animate-pulse' : ''}`}
            style={{ animationDuration: '2s' }}
          >
            {playing ? (
              <Pause className="size-6 text-white" />
            ) : (
              <Play className="size-6 text-white fill-white ml-0.5" />
            )}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors min-w-[36px] min-h-[36px] ${
                  speed === s
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="px-4 pb-3 text-center">
          <span className="text-[9px] text-white/30">
            Preslednica = predvajaj/premor • ← → = preskoči • 1-5 = hitrost
          </span>
        </div>
      </div>
    </div>
  )
}
