'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import type { LeanAngleSession } from '@/components/tabs/types'
import { Bike, ArrowLeftRight, Clock, Play, Square, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

interface LeanAngleDisplayProps {
  currentAngle?: number
  maxLeft?: number
  maxRight?: number
  userId?: string
  isTracking?: boolean
}

function LeanGauge({ angle, maxAngle = 60 }: { angle: number; maxAngle?: number }) {
  const size = 180
  const center = size / 2
  const radius = 70
  const strokeWidth = 8

  // Calculate the needle angle (0 = straight up, negative = left lean, positive = right lean)
  const clampedAngle = Math.max(-maxAngle, Math.min(maxAngle, angle))
  const needleAngle = (clampedAngle / maxAngle) * 80 // Map to ±80 degrees of visual arc

  // Arc paths
  const startAngle = -100
  const endAngle = 100
  const arcPoints: [number, number][] = []

  for (let a = startAngle; a <= endAngle; a += 2) {
    const rad = ((a - 90) * Math.PI) / 180
    arcPoints.push([
      center + radius * Math.cos(rad),
      center + radius * Math.sin(rad),
    ])
  }

  const arcPath = arcPoints
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(' ')

  // Tick marks
  const ticks: Array<{ x1: number; y1: number; x2: number; y2: number; isCenter: boolean }> = []
  for (let a = startAngle; a <= endAngle; a += 20) {
    const rad = ((a - 90) * Math.PI) / 180
    const innerR = radius - 12
    const outerR = radius - 4
    ticks.push({
      x1: center + innerR * Math.cos(rad),
      y1: center + innerR * Math.sin(rad),
      x2: center + outerR * Math.cos(rad),
      y2: center + outerR * Math.sin(rad),
      isCenter: a === 0,
    })
  }

  // Needle
  const needleRad = ((needleAngle - 90 + 90) * Math.PI) / 180
  const needleLen = radius - 20
  const needleX = center + needleLen * Math.cos(needleRad)
  const needleY = center + needleLen * Math.sin(needleRad)

  // Color based on angle
  const absAngle = Math.abs(angle)
  const getAngleColor = (a: number) => {
    if (a < 20) return '#22c55e'
    if (a < 35) return '#f59e0b'
    if (a < 50) return '#f97316'
    return '#ef4444'
  }

  return (
    <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`} className="w-full max-w-[200px]">
      {/* Background arc */}
      <path
        d={arcPath}
        fill="none"
        stroke="currentColor"
        className="text-muted/30"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Colored zones */}
      {/* Green zone (0-20) */}
      {[-20, 20].map((zoneStart, idx) => {
        const zoneEnd = 0
        const a1 = ((zoneStart - 90) * Math.PI) / 180
        const a2 = ((zoneEnd - 90) * Math.PI) / 180
        const step = idx === 0 ? 2 : -2
        const points: string[] = []
        for (let a = zoneStart; idx === 0 ? a <= zoneEnd : a >= zoneEnd; a += step) {
          const rad = ((a - 90) * Math.PI) / 180
          points.push(`${center + radius * Math.cos(rad)},${center + radius * Math.sin(rad)}`)
        }
        return (
          <polyline
            key={idx}
            points={points.join(' ')}
            fill="none"
            stroke="#22c55e40"
            strokeWidth={strokeWidth - 2}
            strokeLinecap="round"
          />
        )
      })}

      {/* Tick marks */}
      {ticks.map((tick, i) => (
        <line
          key={i}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke={tick.isCenter ? '#f59e0b' : 'currentColor'}
          className={tick.isCenter ? '' : 'text-muted-foreground'}
          strokeWidth={tick.isCenter ? 2 : 1}
        />
      ))}

      {/* Center dot */}
      <circle cx={center} cy={center} r={4} fill="#f59e0b" />

      {/* Needle */}
      <line
        x1={center}
        y1={center}
        x2={needleX}
        y2={needleY}
        stroke={getAngleColor(absAngle)}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* Current angle text */}
      <text
        x={center}
        y={center + 30}
        textAnchor="middle"
        className="fill-foreground text-lg font-bold"
        style={{ fontSize: '18px' }}
      >
        {Math.round(angle)}°
      </text>

      {/* Labels */}
      <text x={15} y={center + 10} className="fill-muted-foreground" style={{ fontSize: '9px' }}>
        LEVO
      </text>
      <text x={size - 40} y={center + 10} className="fill-muted-foreground" style={{ fontSize: '9px' }}>
        DESNO
      </text>
    </svg>
  )
}

export default function LeanAngleDisplay({ currentAngle = 0, maxLeft = 0, maxRight = 0, userId, isTracking }: LeanAngleDisplayProps) {
  // Display angle with smooth animation using useRef for target
  const [displayAngle, setDisplayAngle] = useState(0)
  const targetAngleRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)

  // Session history from API
  const [sessions, setSessions] = useState<LeanAngleSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  // Live lean angle from device orientation
  const [liveAngle, setLiveAngle] = useState(0)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const orientationSupported = useRef(false)

  // Data points collected during a session
  const dataPointsRef = useRef<Array<{ timestamp: number; lean: number; speed: number }>>([])
  const sessionStartRef = useRef<number>(0)
  const maxLeftRef = useRef(0)
  const maxRightRef = useRef(0)

  // Fetch session history from API
  const fetchSessions = useCallback(async () => {
    if (!userId) return
    setSessionsLoading(true)
    try {
      const res = await fetch(`/api/lean-angle?userId=${userId}`)
      if (res.ok) {
        const json = await res.json()
        setSessions(json.data || [])
      }
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Smooth needle animation using useRef — only triggered when currentAngle changes
  useEffect(() => {
    targetAngleRef.current = currentAngle
  }, [currentAngle])

  useEffect(() => {
    let running = true
    const animate = () => {
      if (!running) return
      setDisplayAngle(prev => {
        const target = targetAngleRef.current
        const step = (target - prev) / 5
        if (Math.abs(step) < 0.5) return target
        return prev + step
      })
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animationFrameRef.current = requestAnimationFrame(animate)
    return () => {
      running = false
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // DeviceOrientationEvent integration for real lean angle measurement
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return
    orientationSupported.current = true

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!isMeasuring) return
      // gamma = left/right tilt (-90 to 90)
      // When device tilts left, gamma is negative; when right, gamma is positive
      const gamma = event.gamma || 0
      // Clamp to reasonable lean angle range (-60 to 60)
      const lean = Math.max(-60, Math.min(60, gamma))
      setLiveAngle(lean)

      // Store data points during session
      const now = Date.now()
      dataPointsRef.current.push({
        timestamp: now,
        lean,
        speed: 0, // speed from GPS not available here
      })

      // Track max lean angles
      if (lean < maxLeftRef.current) maxLeftRef.current = lean
      if (lean > maxRightRef.current) maxRightRef.current = lean
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [isMeasuring])

  // Start a lean angle measurement session
  const startMeasuring = useCallback(async () => {
    // Check if DeviceOrientationEvent requires permission (iOS 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission()
        if (permission !== 'granted') {
          toast.error('Dovoljenje za senzor naprave zavrnjeno')
          return
        }
      } catch {
        toast.error('Napaka pri pridobivanju dovoljenja')
        return
      }
    }

    dataPointsRef.current = []
    sessionStartRef.current = Date.now()
    maxLeftRef.current = 0
    maxRightRef.current = 0
    setIsMeasuring(true)
    toast.success('Merjenje kota nagiba začeto')
  }, [])

  // Stop measuring and save session
  const stopMeasuring = useCallback(async () => {
    setIsMeasuring(false)

    if (!userId) {
      toast.error('Prijava potrebna za shranjevanje')
      return
    }

    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const dataPoints = dataPointsRef.current
    const avgLean = dataPoints.length > 0
      ? Math.round(dataPoints.reduce((sum, p) => sum + Math.abs(p.lean), 0) / dataPoints.length)
      : 0

    // Only save if we collected meaningful data
    if (duration < 5) {
      toast.error('Seja prekratka za shranjevanje')
      return
    }

    try {
      const res = await fetch('/api/lean-angle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          maxLeanLeft: Math.round(maxLeftRef.current),
          maxLeanRight: Math.round(maxRightRef.current),
          avgLean,
          dataPoints: JSON.stringify(dataPoints),
          duration,
        }),
      })
      if (res.ok) {
        toast.success('Seja nagiba shranjena!')
        fetchSessions()
      } else {
        toast.error('Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri shranjevanju')
    }
  }, [userId, fetchSessions])

  // Determine which angle to display on the gauge
  const gaugeAngle = isMeasuring ? liveAngle : displayAngle
  const displayMaxLeft = isMeasuring ? maxLeftRef.current : (maxLeft || (sessions[0]?.maxLeanLeft || 0))
  const displayMaxRight = isMeasuring ? maxRightRef.current : (maxRight || (sessions[0]?.maxLeanRight || 0))

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}min` : `${m} min`
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bike className="h-5 w-5 text-amber-500" />
          Nagib kota
          {isMeasuring && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 animate-pulse">
              MERJENJE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gauge */}
        <div className="flex justify-center">
          <LeanGauge angle={gaugeAngle} />
        </div>

        {/* Measurement controls */}
        <div className="flex gap-2">
          {!isMeasuring ? (
            <Button
              size="sm"
              className="flex-1 gap-1 bg-amber-600 hover:bg-amber-700 text-xs"
              onClick={startMeasuring}
              disabled={!orientationSupported.current}
            >
              <Play className="h-3.5 w-3.5" />
              Začni merjenje
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 gap-1 text-xs"
              onClick={stopMeasuring}
            >
              <Square className="h-3.5 w-3.5" />
              Ustavi merjenje
            </Button>
          )}
          {orientationSupported.current && (
            <Badge variant="outline" className="text-[10px] gap-1 h-8 flex items-center px-2">
              <Smartphone className="h-3 w-3" />
              Senzor
            </Badge>
          )}
        </div>

        {/* Max angles */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-md bg-rose-500/10 border border-rose-500/20 p-2">
            <ArrowLeftRight className="h-4 w-4 text-rose-500 mb-1 rotate-180" />
            <span className="text-lg font-bold text-rose-500">{Math.abs(displayMaxLeft)}°</span>
            <span className="text-[10px] text-muted-foreground">Max levo</span>
          </div>
          <div className="flex flex-col items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2">
            <ArrowLeftRight className="h-4 w-4 text-emerald-500 mb-1" />
            <span className="text-lg font-bold text-emerald-500">{Math.abs(displayMaxRight)}°</span>
            <span className="text-[10px] text-muted-foreground">Max desno</span>
          </div>
        </div>

        {/* History */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Zgodovina sej</span>
          <ScrollArea className="max-h-40">
            <div className="space-y-2 pr-2">
              {sessionsLoading && sessions.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Nalaganje...
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Ni shranjenih sej
                </div>
              ) : (
                sessions.map(session => (
                  <div key={session.id} className="rounded-md border p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {new Date(session.createdAt).toLocaleDateString('sl-SI')}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Povp. {session.avgLean}°
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="text-rose-500">Levo: {Math.abs(session.maxLeanLeft)}°</span>
                      <span className="text-emerald-500">Desno: {session.maxLeanRight}°</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.duration)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
