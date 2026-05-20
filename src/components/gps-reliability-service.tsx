'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Signal, SignalHigh, SignalMedium, SignalLow } from 'lucide-react'
import { toast } from 'sonner'
import type { TrackPoint } from '@/components/tabs/types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type GpsSignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'none'

export interface GpsReliabilityState {
  /** Current GPS signal quality based on accuracy */
  signalQuality: GpsSignalQuality
  /** Current GPS accuracy in meters (null if no signal) */
  accuracy: number | null
  /** Number of times GPS reconnection was needed */
  reconnectionCount: number
  /** Whether wake lock is currently active */
  wakeLockActive: boolean
  /** Whether the app is currently in the background */
  isBackground: boolean
  /** Number of suspicious (filtered) track points */
  suspiciousPoints: number
  /** Number of GPS errors encountered */
  errorCount: number
  /** Last GPS error type (for display) */
  lastError: string | null
  /** Heartbeat status - whether tracking was verified in last check */
  heartbeatOk: boolean
  /** Total dropped points (GPS errors that resulted in no data) */
  droppedPoints: number
}

export interface GpsReliabilityOptions {
  /** Whether tracking is currently active */
  isTracking: boolean
  /** Current track points (for validation) */
  trackPoints: TrackPoint[]
  /** Whether wake lock is enabled in settings */
  wakelockEnabled: boolean
  /** Callback to restart tracking if heartbeat detects it stopped */
  onRestartTracking?: () => void
  /** Callback to add a validated track point */
  onAddPoint?: (point: TrackPoint) => void
  /** Callback when GPS error needs user action (e.g., permission denied) */
  onGpsError?: (error: GeolocationPositionError) => void
}

export interface GpsReliabilityActions {
  /** Validate a track point before adding it to the track */
  validatePoint: (point: TrackPoint) => { valid: boolean; suspicious: boolean; reason?: string }
  /** Handle a GPS position error with recovery logic */
  handlePositionError: (error: GeolocationPositionError) => void
  /** Request wake lock */
  requestWakeLock: () => Promise<void>
  /** Release wake lock */
  releaseWakeLock: () => void
  /** Get current reliability state */
  getState: () => GpsReliabilityState
  /** Submit diagnostics to API */
  submitDiagnostics: (duration: number) => Promise<void>
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Get signal quality from GPS accuracy value */
export function getSignalQuality(accuracy: number | null): GpsSignalQuality {
  if (accuracy === null) return 'none'
  if (accuracy <= 10) return 'excellent'
  if (accuracy <= 25) return 'good'
  if (accuracy <= 50) return 'fair'
  return 'poor'
}

/** Get signal quality display info */
export function getSignalQualityDisplay(quality: GpsSignalQuality): { emoji: string; label: string; color: string; bgColor: string } {
  const map: Record<GpsSignalQuality, { emoji: string; label: string; color: string; bgColor: string }> = {
    excellent: { emoji: '\uD83D\uDFE2', label: 'Izvrstno', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30' },
    good: { emoji: '\uD83D\uDFE1', label: 'Dobro', color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30' },
    fair: { emoji: '\uD83D\uDFE0', label: 'Zmerno', color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30' },
    poor: { emoji: '\uD83D\uDD34', label: 'Slabo', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' },
    none: { emoji: '\uD83D\uDD34', label: 'Brez signala', color: 'text-red-500', bgColor: 'bg-red-500/20 border-red-500/30' },
  }
  return map[quality]
}

/** Get signal icon component based on quality */
function SignalIcon({ quality }: { quality: GpsSignalQuality }) {
  switch (quality) {
    case 'excellent': return <SignalHigh className="size-3.5 text-emerald-400" />
    case 'good': return <Signal className="size-3.5 text-amber-400" />
    case 'fair': return <SignalMedium className="size-3.5 text-orange-400" />
    case 'poor': return <SignalLow className="size-3.5 text-red-400" />
    case 'none': return <WifiOff className="size-3.5 text-red-500" />
  }
}

// ─── Hook: useGpsReliability ─────────────────────────────────────────────────

export function useGpsReliability(options: GpsReliabilityOptions): GpsReliabilityState & GpsReliabilityActions {
  const { isTracking, trackPoints, wakelockEnabled, onRestartTracking, onGpsError } = options

  // State
  const [signalQuality, setSignalQuality] = useState<GpsSignalQuality>('none')
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [reconnectionCount, setReconnectionCount] = useState(0)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [isBackground, setIsBackground] = useState(false)
  const [suspiciousPoints, setSuspiciousPoints] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const [heartbeatOk, setHeartbeatOk] = useState(true)
  const [droppedPoints, setDroppedPoints] = useState(0)

  // Refs
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const lastGpsFixTimeRef = useRef<number>(0)
  const lastValidPointRef = useRef<TrackPoint | null>(null)
  const wasTrackingRef = useRef(false)

  // ─── Wake Lock Management ────────────────────────────────────────────────

  const requestWakeLock = useCallback(async () => {
    if (!wakelockEnabled || !('wakeLock' in navigator)) return
    try {
      // Release existing wake lock first
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        await wakeLockRef.current.release()
      }
      const sentinel = await navigator.wakeLock.request('screen')
      wakeLockRef.current = sentinel
      setWakeLockActive(true)

      // Listen for wake lock release (happens when page goes to background)
      sentinel.addEventListener('release', () => {
        setWakeLockActive(false)
        wakeLockRef.current = null
      })
    } catch {
      setWakeLockActive(false)
    }
  }, [wakelockEnabled])

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
      setWakeLockActive(false)
    }
  }, [])

  // ─── Track Point Validation ──────────────────────────────────────────────

  const validatePoint = useCallback((point: TrackPoint): { valid: boolean; suspicious: boolean; reason?: string } => {
    // No previous point — accept first point
    if (!lastValidPointRef.current) {
      lastValidPointRef.current = point
      return { valid: true, suspicious: false }
    }

    const prev = lastValidPointRef.current
    const R = 6371000 // Earth radius in meters
    const dLat = ((point.lat - prev.lat) * Math.PI) / 180
    const dLng = ((point.lng - prev.lng) * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((prev.lat * Math.PI) / 180) * Math.cos((point.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    const distMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    const timeDiffSec = Math.max((point.timestamp - prev.timestamp) / 1000, 0.5)
    const speedKmh = (distMeters / timeDiffSec) * 3.6

    // Rule: If distance > 200m AND implied speed > 120 km/h, mark as suspicious
    if (distMeters > 200 && speedKmh > 120) {
      setSuspiciousPoints(prev => prev + 1)
      lastValidPointRef.current = point // Still update so next comparison is valid
      return { valid: false, suspicious: true, reason: `GPS skok: ${Math.round(distMeters)}m v ${timeDiffSec.toFixed(1)}s (${Math.round(speedKmh)} km/h)` }
    }

    lastValidPointRef.current = point
    return { valid: true, suspicious: false }
  }, [])

  // ─── Position Error Recovery ─────────────────────────────────────────────

  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    setErrorCount(prev => prev + 1)
    setDroppedPoints(prev => prev + 1)

    switch (error.code) {
      case error.PERMISSION_DENIED:
        setLastError('Dostop do lokacije zavrnjen')
        toast.error('📡 Dostop do lokacije zavrnjen. Omogočite lokacijo v nastavitvah naprave.', {
          duration: 8000,
        })
        onGpsError?.(error)
        break

      case error.POSITION_UNAVAILABLE: {
        setLastError('Lokacija ni na voljo')
        // Try to get GPS lock again with increased timeout
        const timeout = 20000 + (retryAttemptRef.current * 5000) // Increase timeout on each retry
        toast.warning('📡 GPS signal ni na voljo — poskušam znova...')
        retryAttemptRef.current++

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              // Success — reset retry counter
              retryAttemptRef.current = 0
              lastGpsFixTimeRef.current = Date.now()
              setLastError(null)
              setReconnectionCount(prev => prev + 1)
              toast.success('📡 GPS signal ponovno vzpostavljen')
            },
            () => {
              // Still failing — will retry via heartbeat
            },
            { enableHighAccuracy: true, maximumAge: 2000, timeout }
          )
        }
        break
      }

      case error.TIMEOUT: {
        setLastError('Časovna omejitev GPS')
        // Retry with exponential backoff: 2s, 4s, 8s, max 16s
        const backoffDelay = Math.min(2000 * Math.pow(2, retryAttemptRef.current), 16000)
        retryAttemptRef.current++

        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = setTimeout(() => {
          if (!isTracking) return
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              retryAttemptRef.current = 0
              lastGpsFixTimeRef.current = Date.now()
              setLastError(null)
              setReconnectionCount(prev => prev + 1)
              toast.success('📡 GPS povezava ponovno vzpostavljena')
            },
            () => {
              // Will be handled by heartbeat
            },
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
          )
        }, backoffDelay)
        break
      }

      default:
        setLastError('Neznana napaka GPS')
        break
    }
  }, [isTracking, onGpsError])

  // ─── Visibility Change Handler ───────────────────────────────────────────

  useEffect(() => {
    if (!isTracking) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // App going to background
        setIsBackground(true)
        // Log the event but keep tracking alive
        console.log('[GpsReliability] App went to background — tracking continues')
      } else {
        // App came back to foreground
        setIsBackground(false)

        // Re-request wake lock (it's lost when page becomes hidden)
        if (wakelockEnabled && 'wakeLock' in navigator) {
          try {
            const sentinel = await navigator.wakeLock.request('screen')
            wakeLockRef.current = sentinel
            setWakeLockActive(true)
            sentinel.addEventListener('release', () => {
              setWakeLockActive(false)
              wakeLockRef.current = null
            })
          } catch {
            setWakeLockActive(false)
          }
        }

        // Verify GPS is still working — request a fresh position
        if (navigator.geolocation) {
          // Capture the last fix time BEFORE updating it, so we can detect time gaps
          const previousFixTime = lastGpsFixTimeRef.current
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const now = Date.now()
              // Show toast about time gap if GPS was silent for a while
              if (previousFixTime > 0) {
                const timeSinceLastFix = now - previousFixTime
                if (timeSinceLastFix > 30000) {
                  const gapMin = Math.round(timeSinceLastFix / 60000)
                  const gapSec = Math.round(timeSinceLastFix / 1000)
                  const gapText = gapMin >= 1 ? `${gapMin} min` : `${gapSec} s`
                  toast.info(`📡 Nazaj po ${gapText} — GPS deluje`)
                }
              }
              lastGpsFixTimeRef.current = now
              setAccuracy(pos.coords.accuracy)
              setSignalQuality(getSignalQuality(pos.coords.accuracy))
              setLastError(null)
              retryAttemptRef.current = 0
            },
            (err) => {
              handlePositionError(err)
            },
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
          )
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isTracking, wakelockEnabled, handlePositionError])

  // ─── Heartbeat System ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isTracking) {
      wasTrackingRef.current = false
      return
    }
    wasTrackingRef.current = true

    // Heartbeat: every 30 seconds, verify tracking is still running
    heartbeatIntervalRef.current = setInterval(() => {
      if (!isTracking) return

      const timeSinceLastFix = Date.now() - lastGpsFixTimeRef.current

      // If no GPS fix for more than 60 seconds, something is wrong
      if (lastGpsFixTimeRef.current > 0 && timeSinceLastFix > 60000) {
        setHeartbeatOk(false)
        setReconnectionCount(prev => prev + 1)
        toast.warning('📡 Srčni utrip: GPS ne deluje — poskušam znova zagnati...')

        // Try to get a new GPS fix
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lastGpsFixTimeRef.current = Date.now()
              setAccuracy(pos.coords.accuracy)
              setSignalQuality(getSignalQuality(pos.coords.accuracy))
              setHeartbeatOk(true)
              setLastError(null)
              toast.success('📡 GPS ponovno vzpostavljen (srčni utrip)')
            },
            () => {
              setHeartbeatOk(false)
            },
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
          )
        }
      } else {
        setHeartbeatOk(true)
      }
    }, 30000)

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }
  }, [isTracking])

  // ─── Update accuracy/signal from track points ───────────────────────────

  useEffect(() => {
    if (!isTracking || trackPoints.length === 0) return
    // When track points are added, update last GPS fix time
    const lastPoint = trackPoints[trackPoints.length - 1]
    if (lastPoint && lastPoint.alt !== -9999) { // Not a gap marker
      lastGpsFixTimeRef.current = lastPoint.timestamp
    }
  }, [isTracking, trackPoints])

  // ─── Request wake lock on tracking start ─────────────────────────────────

  useEffect(() => {
    if (isTracking && wakelockEnabled) {
      requestWakeLock()
    }
    if (!isTracking) {
      releaseWakeLock()
      // Reset state when tracking stops
      setReconnectionCount(0)
      setSuspiciousPoints(0)
      setErrorCount(0)
      setLastError(null)
      setDroppedPoints(0)
      setHeartbeatOk(true)
      retryAttemptRef.current = 0
      lastValidPointRef.current = null
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [isTracking, wakelockEnabled, requestWakeLock, releaseWakeLock])

  // ─── Submit Diagnostics ──────────────────────────────────────────────────

  const submitDiagnostics = useCallback(async (duration: number) => {
    try {
      const diagnostics = {
        duration,
        totalPoints: trackPoints.filter(p => p.alt !== -9999).length,
        droppedPoints,
        reconnections: reconnectionCount,
        suspiciousPoints,
        errorCount,
        signalQuality: signalQuality,
        finalAccuracy: accuracy,
        wakeLockUsed: wakelockEnabled,
        timestamp: new Date().toISOString(),
      }
      await fetch('/api/tracking-diagnostics?XTransformPort=', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diagnostics),
      })
    } catch {
      // Silently fail — diagnostics are optional
    }
  }, [trackPoints, droppedPoints, reconnectionCount, suspiciousPoints, errorCount, signalQuality, accuracy, wakelockEnabled])

  // ─── Get State ───────────────────────────────────────────────────────────

  const getState = useCallback((): GpsReliabilityState => ({
    signalQuality,
    accuracy,
    reconnectionCount,
    wakeLockActive,
    isBackground,
    suspiciousPoints,
    errorCount,
    lastError,
    heartbeatOk,
    droppedPoints,
  }), [signalQuality, accuracy, reconnectionCount, wakeLockActive, isBackground, suspiciousPoints, errorCount, lastError, heartbeatOk, droppedPoints])

  return {
    signalQuality,
    accuracy,
    reconnectionCount,
    wakeLockActive,
    isBackground,
    suspiciousPoints,
    errorCount,
    lastError,
    heartbeatOk,
    droppedPoints,
    validatePoint,
    handlePositionError,
    requestWakeLock,
    releaseWakeLock,
    getState,
    submitDiagnostics,
  }
}

// ─── UI Components ───────────────────────────────────────────────────────────

/** GPS Signal Quality Indicator - shows next to speed in dashboard */
export function GpsSignalIndicator({ quality, accuracy }: { quality: GpsSignalQuality; accuracy: number | null }) {
  const display = getSignalQualityDisplay(quality)

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${display.bgColor} backdrop-blur-sm`}>
      <span className="text-xs">{display.emoji}</span>
      <span className={display.color}>{display.label}</span>
      {accuracy !== null && quality !== 'none' && (
        <span className="text-white/40 ml-0.5">±{Math.round(accuracy)}m</span>
      )}
    </div>
  )
}

/** GPS Reliability Stats Panel - shown in ride statistics after stopping */
export function GpsReliabilityStats({ state }: { state: GpsReliabilityState }) {
  if (state.reconnectionCount === 0 && state.suspiciousPoints === 0 && state.errorCount === 0 && state.droppedPoints === 0) {
    // Perfect tracking — no issues
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <Wifi className="size-4" />
          <span className="text-xs font-bold">GPS zanesljivost: Odlična</span>
        </div>
        <p className="text-[10px] text-white/40 mt-1">Brez izgube signala med vožnjo</p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-white/70">
        <Signal className="size-4" />
        <span className="text-xs font-bold">GPS zanesljivost</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {state.reconnectionCount > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <RefreshCw className="size-3 text-amber-400" />
            <span className="text-white/50">Ponovne povezave:</span>
            <span className="text-amber-400 font-bold">{state.reconnectionCount}×</span>
          </div>
        )}
        {state.droppedPoints > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <WifiOff className="size-3 text-red-400" />
            <span className="text-white/50">Izpuščene točke:</span>
            <span className="text-red-400 font-bold">{state.droppedPoints}</span>
          </div>
        )}
        {state.suspiciousPoints > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <AlertTriangle className="size-3 text-orange-400" />
            <span className="text-white/50">Sumljive točke:</span>
            <span className="text-orange-400 font-bold">{state.suspiciousPoints}</span>
          </div>
        )}
        {state.errorCount > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <SignalLow className="size-3 text-red-400" />
            <span className="text-white/50">Napake GPS:</span>
            <span className="text-red-400 font-bold">{state.errorCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Compact GPS reliability badge for driving mode */
export function GpsReliabilityBadge({ state }: { state: GpsReliabilityState }) {
  const display = getSignalQualityDisplay(state.signalQuality)

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={`${display.bgColor} text-[9px] font-bold gap-0.5 px-1.5 py-0`}>
        <span className="text-[10px]">{display.emoji}</span>
        <span className={display.color}>GPS</span>
      </Badge>
      {state.reconnectionCount > 0 && (
        <Badge variant="outline" className="bg-amber-500/20 border-amber-500/30 text-amber-400 text-[9px] font-bold gap-0.5 px-1.5 py-0">
          <RefreshCw className="size-2.5" />
          {state.reconnectionCount}×
        </Badge>
      )}
      {!state.heartbeatOk && (
        <Badge variant="outline" className="bg-red-500/20 border-red-500/30 text-red-400 text-[9px] font-bold gap-0.5 px-1.5 py-0 animate-pulse">
          <AlertTriangle className="size-2.5" />
          GPS!
        </Badge>
      )}
    </div>
  )
}

/** GPS Error Recovery notification component */
export function GpsErrorNotification({ lastError, onRetry }: { lastError: string | null; onRetry?: () => void }) {
  if (!lastError) return null

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 backdrop-blur-sm">
      <WifiOff className="size-3.5 text-red-400 flex-shrink-0" />
      <span className="text-[10px] text-red-300 flex-1">{lastError}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold hover:bg-red-500/30 transition-colors"
        >
          Poskusi znova
        </button>
      )}
    </div>
  )
}

export default function GpsReliabilityService() {
  // This component doesn't render anything directly
  // Use the useGpsReliability hook and the sub-components instead
  return null
}
