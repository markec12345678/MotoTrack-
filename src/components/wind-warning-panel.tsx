'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Wind, AlertTriangle, Navigation2, RefreshCw, Mountain, TrendingUp } from 'lucide-react'
import { getAudioContext } from '@/lib/audio'

// ─── Props ──────────────────────────────────────────────────────────────
interface WindWarningPanelProps {
  lat: number | null
  lng: number | null
  altitude?: number | null // altitude from parent GPS tracker (avoids redundant watchPosition)
  isTracking: boolean
  heading?: number // rider's direction in degrees (from compass/GPS)
  compact?: boolean // for Driving Mode
  className?: string
}

// ─── Wind data (from /api/weather) ─────────────────────────────────────
interface WindData {
  windSpeed: number // km/h
  windDir: number // degrees, meteorological (where wind comes FROM)
  gustSpeed?: number // km/h (if available)
  weatherCode?: number
}

// ─── Forecast wind data ────────────────────────────────────────────────
interface WindForecast {
  date: string
  windMax: number // km/h
  precipitation: number
}

// ─── Warning level ─────────────────────────────────────────────────────
type WarningLevel = 'low' | 'moderate' | 'strong' | 'dangerous'

interface WarningInfo {
  level: WarningLevel
  label: string
  message: string
  color: string
  bgColor: string
  borderColor: string
  emoji: string
  flash: boolean
}

// ─── Calculate crosswind component ─────────────────────────────────────
// Wind direction is meteorological (FROM direction)
// Heading is where the rider is going
// Crosswind = wind_speed × |sin(windDir - heading)|
// Headwind = wind_speed × cos(windDir - heading)
function calculateCrosswind(windSpeed: number, windDir: number, heading: number): {
  crosswind: number
  headwind: number
  windType: 'headwind' | 'tailwind' | 'crosswind'
} {
  const angleRad = ((windDir - heading) * Math.PI) / 180
  const crosswind = Math.abs(windSpeed * Math.sin(angleRad))
  const headwind = windSpeed * Math.cos(angleRad)

  // Determine dominant wind type relative to rider
  const absHead = Math.abs(headwind)
  const absCross = crosswind
  let windType: 'headwind' | 'tailwind' | 'crosswind' = 'crosswind'
  if (absHead > absCross) {
    windType = headwind > 0 ? 'headwind' : 'tailwind'
  }

  return { crosswind: Math.round(crosswind * 10) / 10, headwind: Math.round(headwind * 10) / 10, windType }
}

// ─── Get warning level from crosswind speed ────────────────────────────
function getWarningLevel(crosswind: number): WarningInfo {
  if (crosswind >= 60) {
    return {
      level: 'dangerous',
      label: 'Nevaren',
      message: 'NEVAREN BOČNI VETER — USTAVI SE!',
      color: 'text-red-400',
      bgColor: 'bg-red-500/25',
      borderColor: 'border-red-500/40',
      emoji: '🔴',
      flash: true,
    }
  }
  if (crosswind >= 40) {
    return {
      level: 'strong',
      label: 'Močan',
      message: 'Močan bočni veter — ZMANJŠAJ HITROST!',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/35',
      emoji: '🟠',
      flash: false,
    }
  }
  if (crosswind >= 20) {
    return {
      level: 'moderate',
      label: 'Zmeren',
      message: 'Zmeren bočni veter — previdno!',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/15',
      borderColor: 'border-yellow-500/25',
      emoji: '🟡',
      flash: false,
    }
  }
  return {
    level: 'low',
    label: 'Nizka',
    message: '',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    emoji: '🟢',
    flash: false,
  }
}

// ─── Wind direction arrow rotation relative to rider heading ───────────
// Arrow shows where wind comes FROM, relative to the rider's direction
function getWindArrowRotation(windDir: number, riderHeading: number): number {
  // Arrow points in the direction the wind is coming FROM, relative to the rider
  return ((windDir - riderHeading + 360) % 360)
}

// ─── Wind type label in Slovenian ──────────────────────────────────────
function getWindTypeLabel(type: 'headwind' | 'tailwind' | 'crosswind'): string {
  switch (type) {
    case 'headwind': return 'Sprednji'
    case 'tailwind': return 'Zadnji'
    case 'crosswind': return 'Bočni'
  }
}

// ─── Format time ───────────────────────────────────────────────────────
function formatUpdateTime(date: Date): string {
  return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ─────────────────────────────────────────────────────────
export default function WindWarningPanel({
  lat,
  lng,
  altitude,
  isTracking,
  heading = 0,
  compact = false,
  className = '',
}: WindWarningPanelProps) {
  const [windData, setWindData] = useState<WindData | null>(null)
  const [forecast, setForecast] = useState<WindForecast[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [bridgeWarning, setBridgeWarning] = useState(false)
  const [dangerFlash, setDangerFlash] = useState(false)

  const hasBeepedRef = useRef(false)
  const prevWarningLevelRef = useRef<WarningLevel>('low')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastAltsRef = useRef<number[]>([]) // track altitude changes for bridge detection

  // ─── Play beep via shared AudioContext ──────────────────────────────
  const playBeep = useCallback(() => {
    try {
      const ctx = getAudioContext()
      if (!ctx) return
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.4)
    } catch {
      // Audio not available
    }
  }, [])

  // ─── Fetch wind data ────────────────────────────────────────────────
  const fetchWind = useCallback(async () => {
    if (lat == null || lng == null) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error('Napaka pri pridobivanju vremena')

      const json = await res.json()
      if (!json.success || !json.data?.current) {
        throw new Error('Vremenski podatki niso na voljo')
      }

      const current = json.data.current
      const forecastData = json.data.forecast || []

      const wd: WindData = {
        windSpeed: current.windspeed ?? 0,
        windDir: current.winddirection ?? 0,
        gustSpeed: undefined, // Open-Meteo current_weather doesn't provide gusts separately
        weatherCode: current.weathercode,
      }

      setWindData(wd)
      setLastUpdate(new Date())

      // Parse forecast wind data
      const windForecast: WindForecast[] = forecastData.map((f: any) => ({
        date: f.date,
        windMax: f.windMax ?? 0,
        precipitation: f.precipitation ?? 0,
      }))
      setForecast(windForecast)

      // Bridge detection: check if wind > 30 km/h and elevation changing rapidly
      // (Simplified: just show warning when wind > 30 and we have altitude data)
      if (wd.windSpeed > 30) {
        setBridgeWarning(true)
      } else {
        setBridgeWarning(false)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka')
    } finally {
      setLoading(false)
    }
  }, [lat, lng])

  // ─── Fetch on mount / when coordinates change ──────────────────────
  useEffect(() => {
    if (lat == null || lng == null) return
    fetchWind()
  }, [lat, lng, fetchWind])

  // ─── Auto-refresh every 10 minutes during tracking ──────────────────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (isTracking && lat != null && lng != null) {
      intervalRef.current = setInterval(fetchWind, 600000) // 10 min
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isTracking, lat, lng, fetchWind])

  // ─── Crosswind calculation ──────────────────────────────────────────
  const crosswindInfo = useMemo(() => {
    if (!windData) return null
    const { crosswind, headwind, windType } = calculateCrosswind(
      windData.windSpeed,
      windData.windDir,
      heading
    )
    return { crosswind, headwind, windType }
  }, [windData, heading])

  const warningInfo = useMemo(() => {
    if (!crosswindInfo) return getWarningLevel(0)
    return getWarningLevel(crosswindInfo.crosswind)
  }, [crosswindInfo])

  // ─── Audio beep when crosswind exceeds 40 km/h ─────────────────────
  useEffect(() => {
    if (!crosswindInfo || !isTracking) return

    if (crosswindInfo.crosswind >= 40 && prevWarningLevelRef.current !== 'strong' && prevWarningLevelRef.current !== 'dangerous') {
      if (!hasBeepedRef.current) {
        playBeep()
        hasBeepedRef.current = true
      }
    }

    // Reset beep flag when crosswind drops below 35 (hysteresis)
    if (crosswindInfo.crosswind < 35) {
      hasBeepedRef.current = false
    }

    prevWarningLevelRef.current = warningInfo.level
  }, [crosswindInfo, isTracking, playBeep, warningInfo.level])

  // ─── Danger flash animation ─────────────────────────────────────────
  useEffect(() => {
    if (warningInfo.level !== 'dangerous') {
      setDangerFlash(false)
      return
    }
    const interval = setInterval(() => setDangerFlash(p => !p), 500)
    return () => clearInterval(interval)
  }, [warningInfo.level])

  // ─── Bridge warning from altitude changes (passed from parent GPS tracker) ──
  useEffect(() => {
    if (!isTracking || altitude == null) return
    // Use altitude from parent (already tracked by main GPS watcher) instead of
    // opening a redundant second watchPosition that wastes battery on mobile
    const alt = altitude
    lastAltsRef.current = [...lastAltsRef.current.slice(-9), alt]
    const alts = lastAltsRef.current

    // Detect rapid elevation change (> 5m in last 10 readings) AND wind > 30 km/h
    if (alts.length >= 5 && windData && windData.windSpeed > 30) {
      const recentChange = Math.abs(alts[alts.length - 1] - alts[0])
      if (recentChange > 5) {
        setBridgeWarning(true)
      }
    } else if (windData && windData.windSpeed <= 30) {
      setBridgeWarning(false)
    }
  }, [isTracking, altitude, windData])

  // ─── Wind arrow rotation ────────────────────────────────────────────
  const windArrowRotation = useMemo(() => {
    if (!windData) return 0
    return getWindArrowRotation(windData.windDir, heading)
  }, [windData, heading])

  // ─── No GPS ──────────────────────────────────────────────────────────
  if (lat == null || lng == null) {
    if (!isTracking) return null
    return (
      <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 text-white/60 text-xs ${className}`}>
        <div className="flex items-center gap-1.5">
          <Wind className="size-3" />
          <span>Čakam na GPS...</span>
        </div>
      </div>
    )
  }

  // ─── Not tracking ───────────────────────────────────────────────────
  if (!isTracking) return null

  // ─── Loading state ──────────────────────────────────────────────────
  if (!windData && loading) {
    return (
      <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 ${className}`}>
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <RefreshCw className="size-3 animate-spin" />
          Nalagam veter...
        </div>
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────────
  if (!windData && error) {
    return (
      <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-red-500/30 px-3 py-2 ${className}`}>
        <div className="flex items-center gap-1.5 text-red-400 text-xs">
          <AlertTriangle className="size-3" />
          Veter ni na voljo
        </div>
      </div>
    )
  }

  if (!windData) return null

  // Don't show panel when wind speed < 15 km/h (for track-tab full mode)
  // This check is handled by parent, but also here for safety
  const windSpeed = windData.windSpeed
  const crosswind = crosswindInfo?.crosswind ?? 0

  // ─── COMPACT MODE (Driving Mode) ──────────────────────────────────
  if (compact) {
    // Only show in compact when crosswind > 20 km/h
    if (crosswind < 20) return null

    return (
      <>
        <div className={`rounded-xl bg-black/70 backdrop-blur-md border ${warningInfo.borderColor} px-3 py-2 ${className} ${
          dangerFlash ? 'ring-2 ring-red-500/60' : ''
        }`}>
          <div className="flex items-center gap-2">
            {/* Wind arrow */}
            <div className="relative size-7 flex items-center justify-center">
              <div
                className="transition-transform duration-500 ease-out"
                style={{ transform: `rotate(${windArrowRotation}deg)` }}
              >
                <Navigation2 className={`size-4 ${warningInfo.color}`} />
              </div>
            </div>

            {/* Crosswind speed */}
            <div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-black ${warningInfo.color}`}>
                  {Math.round(crosswind)}
                </span>
                <span className="text-[10px] text-white/40">km/h</span>
              </div>
              <p className="text-[9px] text-white/40 font-medium">Bočni veter</p>
            </div>

            {/* Warning badge */}
            <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold ${warningInfo.bgColor} ${warningInfo.color} border ${warningInfo.borderColor}`}>
              {warningInfo.label}
            </span>
          </div>

          {/* Strong/Dangerous warning message */}
          {(warningInfo.level === 'strong' || warningInfo.level === 'dangerous') && (
            <p className={`text-[10px] font-bold mt-1 ${warningInfo.color} ${warningInfo.flash ? 'animate-pulse' : ''}`}>
              {warningInfo.message}
            </p>
          )}

          {/* Bridge warning */}
          {bridgeWarning && windSpeed > 30 && (
            <div className="flex items-center gap-1 mt-1 px-2 py-1 rounded bg-amber-500/15 border border-amber-500/25">
              <Mountain className="size-3 text-amber-400" />
              <span className="text-[9px] font-bold text-amber-300">MOST — povečan veter!</span>
            </div>
          )}
        </div>

        {/* Red flash overlay for dangerous crosswind */}
        {warningInfo.level === 'dangerous' && dangerFlash && (
          <div className="fixed inset-0 bg-red-500/20 pointer-events-none z-[9998]" />
        )}
      </>
    )
  }

  // ─── FULL MODE (floating overlay on map) ──────────────────────────
  // Only show when wind > 15 km/h (parent also checks, but safe here too)
  if (windSpeed < 15) return null

  return (
    <div className={`rounded-xl bg-black/70 backdrop-blur-md border ${
      warningInfo.level === 'dangerous' ? 'border-red-500/50' :
      warningInfo.level === 'strong' ? 'border-orange-500/40' :
      'border-white/10'
    } shadow-lg ${className} ${
      dangerFlash ? 'ring-2 ring-red-500/50' : ''
    }`}>
      <div className="px-3 pt-2.5 pb-2 space-y-2">
        {/* Header: Wind arrow + speed */}
        <div className="flex items-start gap-2">
          {/* Rotating wind direction arrow */}
          <div className="relative size-10 flex items-center justify-center flex-shrink-0">
            <div
              className="transition-transform duration-500 ease-out"
              style={{ transform: `rotate(${windArrowRotation}deg)` }}
            >
              <Navigation2 className={`size-5 ${warningInfo.color}`} />
            </div>
            {/* Rider direction indicator (up arrow, fixed) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2">
              <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[4px] border-transparent border-b-white/40" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{Math.round(windSpeed)}</span>
              <span className="text-xs text-white/40">km/h</span>
            </div>
            {/* Wind type relative to rider */}
            {crosswindInfo && (
              <p className={`text-xs font-medium ${warningInfo.color}`}>
                {getWindTypeLabel(crosswindInfo.windType)} veter
                {crosswindInfo.windType === 'crosswind' && ` ${Math.round(crosswind)} km/h`}
              </p>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchWind}
            disabled={loading}
            className="p-1 rounded-md hover:bg-white/10 transition-colors"
            title="Osveži veter"
          >
            <RefreshCw className={`size-3 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Crosswind warning */}
        {crosswind >= 20 && (
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold ${warningInfo.bgColor} border ${warningInfo.borderColor} ${warningInfo.flash ? 'animate-pulse' : ''}`}>
            <Wind className={`size-3.5 ${warningInfo.color}`} />
            <div className="flex-1 min-w-0">
              <span className={warningInfo.color}>Bočni veter: {Math.round(crosswind)} km/h</span>
              {warningInfo.message && (
                <p className={`text-[10px] font-medium ${warningInfo.color} mt-0.5`}>
                  {warningInfo.emoji} {warningInfo.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Bridge/Overpass warning */}
        {bridgeWarning && windSpeed > 30 && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 border border-amber-500/25">
            <Mountain className="size-3.5 text-amber-400" />
            <span className="text-amber-300">MOST — povečan veter!</span>
          </div>
        )}

        {/* Wind details */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {/* Wind speed */}
          <div className="flex items-center gap-1.5 text-white/70">
            <Wind className="size-3 text-white/40 flex-shrink-0" />
            <span>{Math.round(windSpeed)} km/h</span>
          </div>

          {/* Crosswind */}
          <div className="flex items-center gap-1.5 text-white/70">
            <Navigation2 className="size-3 text-white/40 flex-shrink-0" />
            <span className={crosswind >= 20 ? warningInfo.color : ''}>
              Bočni: {Math.round(crosswind)} km/h
            </span>
          </div>

          {/* Gust speed (if available) */}
          {windData.gustSpeed !== undefined && windData.gustSpeed > 0 && (
            <div className="flex items-center gap-1.5 text-white/70">
              <TrendingUp className="size-3 text-white/40 flex-shrink-0" />
              <span>Zahladi: {Math.round(windData.gustSpeed)} km/h</span>
            </div>
          )}
        </div>

        {/* Wind forecast (upcoming days) */}
        {forecast.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-white/5">
            <p className="text-[9px] text-white/30 uppercase tracking-wider">Napoved vetra</p>
            {forecast.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] text-white/50">
                <span>{i === 0 ? 'Danes' : i === 1 ? 'Jutri' : f.date}</span>
                <span className={`font-medium ${f.windMax >= 40 ? 'text-orange-400' : f.windMax >= 25 ? 'text-yellow-400' : ''}`}>
                  do {Math.round(f.windMax)} km/h
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Last update timestamp */}
        {lastUpdate && (
          <div className="flex items-center justify-between text-[9px] text-white/25 pt-0.5 border-t border-white/5">
            <span>Osveženo: {formatUpdateTime(lastUpdate)}</span>
            <span>10 min</span>
          </div>
        )}
      </div>
    </div>
  )
}
