'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Navigation, MapPin, Volume2, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

type DeviationLevel = 'on-route' | 'slight' | 'deviated' | 'far'

interface UseRouteDeviationOptions {
  plannedRoute: Array<{ lat: number; lng: number }>
  currentPosition: { lat: number; lng: number } | null
  isActive: boolean
  onRouteMeters?: number
  slightMeters?: number
  deviatedMeters?: number
}

interface UseRouteDeviationResult {
  deviation: number
  level: DeviationLevel
  isDeviated: boolean
}

// ─── Haversine ──────────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Point-to-segment distance ──────────────────────────────────────────────────

function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return haversineMeters(px, py, ax, ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projLat = ax + t * dx
  const projLng = ay + t * dy
  return haversineMeters(px, py, projLat, projLng)
}

// ─── Find min distance to route polyline ─────────────────────────────────────────

function minDistanceToRoute(
  lat: number, lng: number,
  route: Array<{ lat: number; lng: number }>
): number {
  if (route.length === 0) return Infinity
  if (route.length === 1) return haversineMeters(lat, lng, route[0].lat, route[0].lng)

  let minDist = Infinity
  // Bounding box filter: only check segments within ~3km
  const bboxRadius = 0.03 // ~3km in degrees

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]
    const b = route[i + 1]

    // Quick bounding box check
    const minLat = Math.min(a.lat, b.lat) - bboxRadius
    const maxLat = Math.max(a.lat, b.lat) + bboxRadius
    const minLng = Math.min(a.lng, b.lng) - bboxRadius
    const maxLng = Math.max(a.lng, b.lng) + bboxRadius

    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) continue

    const d = pointToSegmentDistance(lat, lng, a.lat, a.lng, b.lat, b.lng)
    if (d < minDist) minDist = d
  }

  // If no segment was within bounding box, find nearest point
  if (minDist === Infinity) {
    for (const pt of route) {
      const d = haversineMeters(lat, lng, pt.lat, pt.lng)
      if (d < minDist) minDist = d
    }
  }

  return minDist
}

// ─── Sound Alert ─────────────────────────────────────────────────────────────────

function playDeviationSound(level: DeviationLevel) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (level === 'deviated') {
      osc.frequency.value = 600
      gain.gain.value = 0.12
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.stop(ctx.currentTime + 0.3)
    } else if (level === 'far') {
      osc.frequency.value = 900
      gain.gain.value = 0.15
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.stop(ctx.currentTime + 0.15)
      // Second beep
      setTimeout(() => {
        try {
          const ctx2 = new AudioContext()
          const osc2 = ctx2.createOscillator()
          const gain2 = ctx2.createGain()
          osc2.connect(gain2)
          gain2.connect(ctx2.destination)
          osc2.frequency.value = 900
          gain2.gain.value = 0.15
          osc2.start()
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.15)
          osc2.stop(ctx2.currentTime + 0.15)
        } catch { /* ignore */ }
      }, 300)
    }
  } catch { /* Audio not available */ }
}

// ─── Hook ────────────────────────────────────────────────────────────────────────

export function useRouteDeviation({
  plannedRoute,
  currentPosition,
  isActive,
  onRouteMeters = 50,
  slightMeters = 150,
  deviatedMeters = 300,
}: UseRouteDeviationOptions): UseRouteDeviationResult {
  const [deviation, setDeviation] = useState(0)
  const [level, setLevel] = useState<DeviationLevel>('on-route')
  const deviationStartRef = useRef<number | null>(null)
  const lastAlertRef = useRef<Record<DeviationLevel, number>>({
    'on-route': 0, slight: 0, deviated: 0, far: 0,
  })

  useEffect(() => {
    if (!isActive || !currentPosition || plannedRoute.length < 2) {
      setDeviation(0)
      setLevel('on-route')
      deviationStartRef.current = null
      return
    }

    const dist = minDistanceToRoute(currentPosition.lat, currentPosition.lng, plannedRoute)
    setDeviation(Math.round(dist))

    let newLevel: DeviationLevel
    if (dist <= onRouteMeters) newLevel = 'on-route'
    else if (dist <= slightMeters) newLevel = 'slight'
    else if (dist <= deviatedMeters) newLevel = 'deviated'
    else newLevel = 'far'

    // Debounce: require 10s of continuous deviation before alerting
    const now = Date.now()
    if (newLevel !== 'on-route') {
      if (!deviationStartRef.current) {
        deviationStartRef.current = now
      }
      const elapsed = now - deviationStartRef.current
      if (elapsed < 10000) {
        // Not yet 10 seconds, keep previous level
        return
      }
    } else {
      deviationStartRef.current = null
    }

    setLevel(newLevel)

    // Sound/toast alerts with cooldown
    if (newLevel !== 'on-route' && newLevel !== level) {
      const lastAlertTime = lastAlertRef.current[newLevel] || 0
      if (now - lastAlertTime > 60000) {
        lastAlertRef.current[newLevel] = now

        if (newLevel === 'slight') {
          toast.warning('Zapuščate načrtovano pot', { duration: 4000 })
        } else if (newLevel === 'deviated') {
          playDeviationSound('deviated')
          toast.error(`Zapustili ste pot! ${Math.round(dist)}m stran`, { duration: 6000 })
        } else if (newLevel === 'far') {
          playDeviationSound('far')
          toast.error(`Preveč oddaljeni! ${Math.round(dist)}m od rute`, { duration: 8000 })
        }
      }
    }
  }, [currentPosition, plannedRoute, isActive, onRouteMeters, slightMeters, deviatedMeters, level])

  return { deviation, level, isDeviated: level !== 'on-route' }
}

// ─── UI Components ──────────────────────────────────────────────────────────────

interface RouteDeviationAlertProps {
  deviation: number
  level: DeviationLevel
  onReroute?: () => void
  onDismiss?: () => void
}

export function RouteDeviationAlert({ deviation, level, onReroute, onDismiss }: RouteDeviationAlertProps) {
  if (level === 'on-route') return null

  const config: Record<DeviationLevel, { bg: string; border: string; icon: string; text: string }> = {
    'on-route': { bg: '', border: '', icon: '', text: '' },
    slight: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: 'text-yellow-500',
      text: 'text-yellow-700 dark:text-yellow-400',
    },
    deviated: {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      icon: 'text-orange-500',
      text: 'text-orange-700 dark:text-orange-400',
    },
    far: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-400',
    },
  }

  const c = config[level]
  const messages: Record<Exclude<DeviationLevel, 'on-route'>, string> = {
    slight: 'Zapuščate načrtovano pot',
    deviated: `Zapustili ste pot! ${deviation}m stran`,
    far: `Preveč oddaljeni! ${deviation}m od rute`,
  }

  return (
    <div className={`fixed bottom-20 left-4 right-4 z-[1400] ${c.bg} border ${c.border} rounded-xl p-3 backdrop-blur-sm`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className={`size-5 ${c.icon} shrink-0 ${level === 'far' ? 'animate-pulse' : ''}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${c.text}`}>{messages[level]}</p>
          <p className="text-[10px] text-muted-foreground">Preverite pot ali preračunajte ruto</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onReroute && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onReroute}>
              <RotateCcw className="size-3" />
              Preračunaj
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDismiss}>
              <X className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Compact Indicator ───────────────────────────────────────────────────────────

interface RouteDeviationIndicatorProps {
  level: DeviationLevel
  deviation: number
}

export function RouteDeviationIndicator({ level, deviation }: RouteDeviationIndicatorProps) {
  const dotColor: Record<DeviationLevel, string> = {
    'on-route': 'bg-green-500',
    slight: 'bg-yellow-500',
    deviated: 'bg-orange-500',
    far: 'bg-red-500 animate-pulse',
  }

  const labels: Record<DeviationLevel, string> = {
    'on-route': 'Na poti',
    slight: `${deviation}m`,
    deviated: `${deviation}m`,
    far: `${deviation}m`,
  }

  return (
    <Badge
      variant="secondary"
      className={`text-[9px] px-1.5 py-0 gap-1 ${
        level === 'on-route'
          ? 'bg-green-500/10 text-green-600'
          : level === 'slight'
          ? 'bg-yellow-500/10 text-yellow-600'
          : level === 'deviated'
          ? 'bg-orange-500/10 text-orange-600'
          : 'bg-red-500/10 text-red-600'
      }`}
    >
      <span className={`size-1.5 rounded-full ${dotColor[level]}`} />
      <Navigation className="size-2.5" />
      {labels[level]}
    </Badge>
  )
}
