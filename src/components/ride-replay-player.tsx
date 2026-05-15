'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Play, Pause, FastForward, Mountain, Timer, Gauge, RotateCcw, Maximize2, Minimize2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'

interface RideReplayPlayerProps {
  trackData: string // JSON string of [[lat, lng, alt, timestamp], ...]
  maxSpeed?: number
  distance?: number
  duration?: number
}

interface ParsedPoint {
  lat: number
  lng: number
  alt: number
  timestamp: number
}

function parseTrackData(raw: string): ParsedPoint[] {
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((p: number[]) => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
      .map((p: number[]) => ({
        lat: p[0],
        lng: p[1],
        alt: p[2] ?? 0,
        timestamp: p[3] ?? 0,
      }))
  } catch {
    return []
  }
}

// Calculate bounds for the canvas
function calculateBounds(points: ParsedPoint[]) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  let minAlt = Infinity, maxAlt = -Infinity
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
    if (p.alt < minAlt) minAlt = p.alt
    if (p.alt > maxAlt) maxAlt = p.alt
  }
  // Add padding
  const padLat = (maxLat - minLat) * 0.1 || 0.005
  const padLng = (maxLng - minLng) * 0.1 || 0.005
  return {
    minLat: minLat - padLat, maxLat: maxLat + padLat,
    minLng: minLng - padLng, maxLng: maxLng + padLng,
    minAlt, maxAlt,
  }
}

// Speed → color for path coloring
function speedColor(speed: number, maxSpeed: number): string {
  if (maxSpeed <= 0) return '#f97316'
  const ratio = Math.min(speed / maxSpeed, 1)
  if (ratio < 0.33) return '#22c55e' // green
  if (ratio < 0.66) return '#eab308' // yellow
  return '#ef4444' // red
}

// Haversine distance between two points in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function RideReplayPlayer({ trackData, maxSpeed: maxSpeedProp, distance, duration }: RideReplayPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [progress, setProgress] = useState(0) // 0-1
  const [currentIndex, setCurrentIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const lastTimeRef = useRef(0)

  // Parse track data
  const points = useMemo(() => parseTrackData(trackData), [trackData])
  const bounds = useMemo(() => points.length > 0 ? calculateBounds(points) : null, [points])

  // Calculate speed at each point (for coloring)
  const pointSpeeds = useMemo(() => {
    const speeds: number[] = []
    for (let i = 0; i < points.length; i++) {
      if (i === 0 || points[i].timestamp === 0 || points[i - 1].timestamp === 0) {
        speeds.push(0)
        continue
      }
      const dt = (points[i].timestamp - points[i - 1].timestamp) / 1000 // seconds
      if (dt <= 0) { speeds.push(speeds[i - 1] || 0); continue }
      const d = haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
      speeds.push(Math.round((d / dt) * 3600)) // km/h
    }
    return speeds
  }, [points])

  const calculatedMaxSpeed = useMemo(() => Math.max(...pointSpeeds, 1), [pointSpeeds])
  const effectiveMaxSpeed = maxSpeedProp || calculatedMaxSpeed

  // Current stats
  const currentSpeed = pointSpeeds[currentIndex] || 0
  const currentAlt = points[currentIndex]?.alt || 0
  const currentDist = useMemo(() => {
    let d = 0
    for (let i = 1; i <= currentIndex && i < points.length; i++) {
      d += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
    }
    return d
  }, [points, currentIndex])

  const currentTime = useMemo(() => {
    if (currentIndex === 0 || !points[0].timestamp) return 0
    const start = points[0].timestamp
    const end = points[Math.min(currentIndex, points.length - 1)].timestamp
    return start && end ? Math.round((end - start) / 1000) : 0
  }, [points, currentIndex])

  // Draw the map on canvas
  const drawMap = useCallback((idx: number) => {
    const canvas = canvasRef.current
    if (!canvas || !bounds || points.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const dpr = window.devicePixelRatio || 1

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const cw = rect.width
    const ch = rect.height

    // Clear
    ctx.fillStyle = 'rgba(15, 15, 15, 0.95)'
    ctx.fillRect(0, 0, cw, ch)

    // Map bounds
    const latRange = bounds.maxLat - bounds.minLat
    const lngRange = bounds.maxLng - bounds.minLng

    // Project point to canvas
    const project = (lat: number, lng: number) => {
      const x = ((lng - bounds.minLng) / lngRange) * (cw - 20) + 10
      const y = ch - 10 - ((lat - bounds.minLat) / latRange) * (ch - 20)
      return { x, y }
    }

    // Draw path (colored by speed)
    for (let i = 1; i < points.length; i++) {
      const p1 = project(points[i - 1].lat, points[i - 1].lng)
      const p2 = project(points[i].lat, points[i].lng)
      const isPast = i <= idx
      const spd = pointSpeeds[i] || 0

      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)

      if (isPast) {
        ctx.strokeStyle = speedColor(spd, effectiveMaxSpeed)
        ctx.lineWidth = 3
        ctx.globalAlpha = 1
      } else {
        ctx.strokeStyle = '#555'
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.3
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Draw start point
    if (points.length > 0) {
      const start = project(points[0].lat, points[0].lng)
      ctx.beginPath()
      ctx.arc(start.x, start.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#22c55e'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Draw end point
    if (points.length > 1 && idx >= points.length - 1) {
      const end = project(points[points.length - 1].lat, points[points.length - 1].lng)
      ctx.beginPath()
      ctx.arc(end.x, end.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ef4444'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Draw current position dot (with glow)
    if (idx >= 0 && idx < points.length) {
      const pos = project(points[idx].lat, points[idx].lng)
      // Glow
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(249, 115, 22, 0.25)'
      ctx.fill()
      // Dot
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#f97316'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [bounds, points, pointSpeeds, effectiveMaxSpeed])

  // Animation loop
  useEffect(() => {
    if (!playing || points.length < 2) return

    const step = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const delta = (timestamp - lastTimeRef.current) * speed
      lastTimeRef.current = timestamp

      // Advance ~30 points per second at 1x
      const pointsPerMs = 0.03 * speed
      const advance = Math.max(1, Math.round(delta * pointsPerMs))

      setCurrentIndex(prev => {
        const next = Math.min(prev + advance, points.length - 1)
        setProgress(next / (points.length - 1))
        if (next >= points.length - 1) {
          setPlaying(false)
        }
        return next
      })

      animRef.current = requestAnimationFrame(step)
    }

    lastTimeRef.current = 0
    animRef.current = requestAnimationFrame(step)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [playing, speed, points.length])

  // Redraw on index change
  useEffect(() => {
    drawMap(currentIndex)
  }, [currentIndex, drawMap])

  // Initial draw
  useEffect(() => {
    if (points.length >= 2) drawMap(0)
  }, [points, drawMap])

  // Handle resize
  useEffect(() => {
    const handleResize = () => drawMap(currentIndex)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [currentIndex, drawMap])

  const handlePlay = () => {
    if (currentIndex >= points.length - 1) {
      setCurrentIndex(0)
      setProgress(0)
    }
    setPlaying(true)
  }

  const handlePause = () => setPlaying(false)

  const handleReset = () => {
    setPlaying(false)
    setCurrentIndex(0)
    setProgress(0)
  }

  const handleProgressChange = (val: number[]) => {
    const p = val[0] / 100
    setProgress(p)
    setCurrentIndex(Math.round(p * (points.length - 1)))
    setPlaying(false)
  }

  // Elevation profile SVG
  const elevationProfile = useMemo(() => {
    if (points.length < 2 || !bounds) return null
    const w = 280
    const h = 40
    const altRange = bounds.maxAlt - bounds.minAlt || 1
    const step = w / (points.length - 1)

    const pathPoints = points.map((p, i) => {
      const x = i * step
      const y = h - 2 - ((p.alt - bounds.minAlt) / altRange) * (h - 4)
      return `${x},${y}`
    })

    const areaPath = `M0,${h} L${pathPoints.join(' L')} L${w},${h} Z`
    const linePath = `M${pathPoints.join(' L')}`

    // Current position marker
    const cx = currentIndex * step
    const cy = h - 2 - ((points[currentIndex]?.alt || bounds.minAlt) - bounds.minAlt) / altRange * (h - 4)

    return (
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#elevGrad)" />
        <path d={linePath} fill="none" stroke="#f97316" strokeWidth="1.5" opacity="0.6" />
        {/* Past portion (brighter) */}
        {currentIndex > 0 && (
          <path
            d={`M${points.slice(0, currentIndex + 1).map((p, i) => `${i * step},${h - 2 - ((p.alt - bounds.minAlt) / altRange) * (h - 4)}`).join(' L')}`}
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
          />
        )}
        {/* Current position */}
        <circle cx={cx} cy={cy} r="3" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
      </svg>
    )
  }, [points, bounds, currentIndex])

  // Format time
  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  if (points.length < 2) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Ni podatkov za predvajanje</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Potrebujem vsaj 2 GPS točki za replay</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`border-border/50 overflow-hidden ${fullscreen ? 'fixed inset-0 z-[2000] rounded-none' : ''}`}>
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
              <Play className="size-3.5 text-primary fill-primary" />
            </div>
            <div>
              <h4 className="text-xs font-semibold">Replay vožnje</h4>
              <p className="text-[9px] text-muted-foreground">{points.length} točk • {distance?.toFixed(1) ?? currentDist.toFixed(1)} km</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setFullscreen(!fullscreen)}>
            {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>

        {/* Canvas Map */}
        <div className={`relative rounded-lg overflow-hidden bg-black/90 ${fullscreen ? 'h-[50vh]' : 'h-48'}`}>
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block' }}
          />
          {/* Live speed overlay */}
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] bg-black/60 backdrop-blur-sm border-white/10 text-white">
              <Gauge className="size-3 mr-1" /> {currentSpeed} km/h
            </Badge>
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] bg-black/60 backdrop-blur-sm border-white/10 text-white">
              <Mountain className="size-3 mr-1" /> {Math.round(currentAlt)} m
            </Badge>
          </div>
        </div>

        {/* Elevation Profile */}
        {elevationProfile && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Mountain className="size-3" /> Višinski profil
              </span>
              <span className="text-[9px] text-muted-foreground">
                {bounds ? `${Math.round(bounds.minAlt)}m - ${Math.round(bounds.maxAlt)}m` : ''}
              </span>
            </div>
            <div className="bg-secondary/30 rounded-md p-1.5">
              {elevationProfile}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center bg-secondary/40 rounded-md py-1.5">
            <div className="flex items-center justify-center gap-1">
              <Gauge className="size-3 text-primary" />
              <span className="text-sm font-bold">{currentSpeed}</span>
            </div>
            <span className="text-[9px] text-muted-foreground">km/h</span>
          </div>
          <div className="text-center bg-secondary/40 rounded-md py-1.5">
            <div className="flex items-center justify-center gap-1">
              <Timer className="size-3 text-primary" />
              <span className="text-sm font-bold font-mono">{fmtTime(currentTime)}</span>
            </div>
            <span className="text-[9px] text-muted-foreground">čas</span>
          </div>
          <div className="text-center bg-secondary/40 rounded-md py-1.5">
            <div className="flex items-center justify-center gap-1">
              <Mountain className="size-3 text-primary" />
              <span className="text-sm font-bold">{Math.round(currentAlt)}</span>
            </div>
            <span className="text-[9px] text-muted-foreground">m</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <Slider
            value={[Math.round(progress * 100)]}
            onValueChange={handleProgressChange}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>0:00</span>
            <span>{fmtTime(duration || (points.length > 1 && points[0].timestamp ? Math.round((points[points.length - 1].timestamp - points[0].timestamp) / 1000) : 0))}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={handleReset} title="Na začetek">
            <RotateCcw className="size-4" />
          </Button>
          {playing ? (
            <button
              onClick={handlePause}
              className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform"
            >
              <Pause className="size-5 text-white" />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform"
            >
              <Play className="size-5 text-white fill-white ml-0.5" />
            </button>
          )}
          <div className="flex items-center gap-1">
            {[1, 2, 4, 8].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  speed === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Speed color legend */}
        <div className="flex items-center gap-1 text-[8px] text-muted-foreground/60">
          <span>Počasi</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
            <div className="flex-1 bg-green-500" />
            <div className="flex-1 bg-yellow-500" />
            <div className="flex-1 bg-red-500" />
          </div>
          <span>Hitro</span>
        </div>
      </CardContent>
    </Card>
  )
}
