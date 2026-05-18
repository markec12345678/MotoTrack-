'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Volume2,
  VolumeX,
  Navigation2,
  Fuel,
  AlertTriangle,
  Gauge,
  X,
  Maximize2,
  Minimize2,
  Battery,
  Signal,
  MapPin,
  Sun,
  Moon,
  Timer,
  Flag,
  ChevronUp,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ===== DRIVING MODE =====
// Minimal, safe UI for riding — large text, essential info only
// Designed for handlebar-mounted phones (forum request: "CarPlay alternative")
// Key: speed, next turn, distance to turn, fuel range, ETA
// Enhanced with: swipe gestures, turn arrows, hazard report, auto-brightness, lap timer, fuel station

// ─── Display modes (swipe UP to cycle) ────────────────────────────────────
type DisplayMode = 'speed' | 'stats' | 'compact'

// ─── Quick hazard types for driving mode ──────────────────────────────────
const QUICK_HAZARD_TYPES = [
  { type: 'pothole', emoji: '🕳️', label: 'Luknja' },
  { type: 'ice', emoji: '❄️', label: 'Poledica' },
  { type: 'construction', emoji: '🚧', label: 'Gradbišče' },
  { type: 'landslide', emoji: '🪨', label: 'Plaz' },
] as const

// ─── Arrow direction map based on turn type/modifier ──────────────────────
type ArrowDirection = '↑' | '↗' | '→' | '↘' | '↓' | '↙' | '←' | '↖' | '↩'

function parseNavArrow(instruction?: string, navStepType?: string): ArrowDirection {
  if (!instruction && !navStepType) return '↑'

  const text = (instruction || '').toLowerCase()
  const type = (navStepType || '').toLowerCase()

  // U-turn
  if (text.includes('polkrožni obrat') || text.includes('obrat') || type === 'uturn') return '↩'

  // Sharp left
  if (text.includes('ostro levo') || text.includes('sharp left')) return '↙'

  // Sharp right
  if (text.includes('ostro desno') || text.includes('sharp right')) return '↘'

  // Left
  if (text.includes('levo') && !text.includes('rahlo')) return '←'

  // Slight left
  if (text.includes('rahlo levo') || text.includes('slight left')) return '↖'

  // Right
  if (text.includes('desno') && !text.includes('rahlo')) return '→'

  // Slight right
  if (text.includes('rahlo desno') || text.includes('slight right')) return '↗'

  // Roundabout — show right (most roundabouts are clockwise in EU)
  if (text.includes('krožišče') || type === 'roundabout' || type === 'rotary') return '↗'

  // Arrive
  if (text.includes('prispeli') || type === 'arrive') return '🏁'

  // Default: straight
  return '↑'
}

// ─── Haversine for fuel station bearing ───────────────────────────────────
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const la1 = (lat1 * Math.PI) / 180
  const la2 = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// ─── Sunset/sunrise approximation ─────────────────────────────────────────
function isNightTime(): boolean {
  const now = new Date()
  const hours = now.getHours() + now.getMinutes() / 60
  // Simple approximation: night between 20:00 and 06:30
  // (Slovenian summer sunset ~20:30, winter ~16:30 — use 20:00 as safe threshold)
  return hours >= 20 || hours < 6.5
}

interface DrivingModeProps {
  isActive: boolean
  onToggle: () => void
  currentSpeed: number
  maxSpeed: number
  distance: number
  duration: number
  elevation: number
  currentFuel?: number // liters remaining
  fuelRange?: number   // km remaining
  unitSystem?: 'metric' | 'imperial'
  // Navigation
  navInstruction?: string
  navDistanceToStep?: number // meters
  navStepIdx?: number
  navTotalSteps?: number
  navDestination?: string
  navStepType?: string // e.g. 'turn', 'new name', 'arrive'
  // Tracking
  isTracking: boolean
  isPaused: boolean
  // Speed alert
  speedLimit?: number
  isOverSpeed?: boolean
  // Voice
  voiceEnabled?: boolean
  onToggleVoice?: () => void
  // GPS position (for hazard reporting + fuel station)
  currentLat?: number | null
  currentLng?: number | null
  // User
  userId?: string
  // Heading (for fuel station direction)
  heading?: number
}

function formatDriveDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`
  return `${m} min`
}

function formatDriveDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000
    return km >= 100 ? `${Math.round(km)}` : `${km.toFixed(1)}`
  }
  return `${Math.round(meters)}`
}

function formatDriveDistanceUnit(meters: number): string {
  return meters >= 1000 ? 'km' : 'm'
}

// ─── Nearest fuel station type ────────────────────────────────────────────
interface NearestStation {
  name: string
  distance: number // km
  bearing: number  // degrees
  price95: number
}

export default function DrivingMode({
  isActive,
  onToggle,
  currentSpeed,
  maxSpeed,
  distance,
  duration,
  elevation,
  currentFuel,
  fuelRange,
  unitSystem = 'metric',
  navInstruction,
  navDistanceToStep,
  navStepIdx,
  navTotalSteps,
  navDestination,
  navStepType,
  isTracking,
  isPaused,
  speedLimit = 90,
  isOverSpeed = false,
  voiceEnabled = true,
  onToggleVoice,
  currentLat,
  currentLng,
  userId,
  heading = 0,
}: DrivingModeProps) {
  // ─── State ──────────────────────────────────────────────────────────────
  const [flashOn, setFlashOn] = useState(false)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('speed')
  const [gpsAccuracy, setGpsAccuracy] = useState<'good' | 'ok' | 'poor'>('good')
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const lastSpeedRef = useRef<number>(0)

  // Night mode
  const [nightMode, setNightMode] = useState(isNightTime())

  // Swipe gesture state
  const [gestureHint, setGestureHint] = useState<string | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const gestureHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Quick hazard reporting
  const [hazardIdx, setHazardIdx] = useState(0)
  const [hazardFlash, setHazardFlash] = useState(false)
  const [hazardSending, setHazardSending] = useState(false)

  // Lap timer
  const [laps, setLaps] = useState<Array<{ time: number; timestamp: number }>>([])
  const [showLaps, setShowLaps] = useState(false)

  // Nearest fuel station
  const [nearestStation, setNearestStation] = useState<NearestStation | null>(null)

  // ─── Computed ───────────────────────────────────────────────────────────
  const isCompact = displayMode === 'compact'

  // Speed smoothing for display (avoid jitter)
  const smoothSpeed = useMemo(() => {
    if (currentSpeed === 0 && lastSpeedRef.current > 20) return lastSpeedRef.current
    return currentSpeed
  }, [currentSpeed])

  useEffect(() => {
    if (currentSpeed > 0) lastSpeedRef.current = currentSpeed
  }, [currentSpeed])

  // Parse arrow direction from nav instruction
  const navArrow = useMemo(() => parseNavArrow(navInstruction, navStepType), [navInstruction, navStepType])

  // Arrow urgency color based on distance to turn
  const arrowUrgency = useMemo(() => {
    if (navDistanceToStep === undefined) return 'green' as const
    if (navDistanceToStep < 100) return 'red' as const
    if (navDistanceToStep < 500) return 'amber' as const
    return 'green' as const
  }, [navDistanceToStep])

  // Arrow should animate when close to turn
  const arrowAnimate = navDistanceToStep !== undefined && navDistanceToStep < 150

  // Last lap time
  const lastLapTime = laps.length >= 2
    ? laps[laps.length - 1].time - laps[laps.length - 2].time
    : null

  const bestLapTime = laps.length >= 2
    ? Math.min(...laps.slice(1).map((l, i) => l.time - laps[i].time))
    : null

  // ─── Effects ────────────────────────────────────────────────────────────

  // Speed alert flash animation
  useEffect(() => {
    if (!isOverSpeed) { setFlashOn(false); return }
    const interval = setInterval(() => setFlashOn(p => !p), 500)
    return () => clearInterval(interval)
  }, [isOverSpeed])

  // Monitor GPS accuracy
  useEffect(() => {
    if (!isTracking) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy < 15) setGpsAccuracy('good')
        else if (pos.coords.accuracy < 50) setGpsAccuracy('ok')
        else setGpsAccuracy('poor')
      },
      () => setGpsAccuracy('poor'),
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [isTracking])

  // Battery level monitoring
  useEffect(() => {
    if (!('getBattery' in navigator)) return
    (navigator as unknown as { getBattery: () => Promise<{ level: number; addEventListener: (event: string, cb: () => void) => void }> }).getBattery?.()?.then((battery) => {
      setBatteryLevel(Math.round(battery.level * 100))
      battery.addEventListener('levelchange', () => setBatteryLevel(Math.round(battery.level * 100)))
    })
  }, [])

  // Night mode auto-detect every 5 minutes
  useEffect(() => {
    const check = () => setNightMode(isNightTime())
    check()
    const interval = setInterval(check, 300000)
    return () => clearInterval(interval)
  }, [])

  // Fetch nearest fuel station
  useEffect(() => {
    if (!isActive || currentLat == null || currentLng == null) return
    const fetchStation = async () => {
      try {
        const res = await fetch(`/api/fuel-prices?lat=${currentLat}&lng=${currentLng}&fuelType=95&radius=25`)
        if (res.ok) {
          const json = await res.json()
          const stations = json.data || []
          if (stations.length > 0) {
            const s = stations[0]
            setNearestStation({
              name: s.name || 'Bencinska',
              distance: s.distance,
              bearing: bearingDeg(currentLat, currentLng, s.lat, s.lng),
              price95: s.prices?.['95'] ?? 0,
            })
          }
        }
      } catch {
        // ignore
      }
    }
    fetchStation()
    const interval = setInterval(fetchStation, 120000)
    return () => clearInterval(interval)
  }, [isActive, currentLat, currentLng])

  // ─── Handlers ───────────────────────────────────────────────────────────

  // Swipe gesture handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    const dt = Date.now() - touchStartRef.current.time
    touchStartRef.current = null

    // Minimum swipe distance and maximum time
    const minDist = 60
    const maxTime = 500
    if (dt > maxTime) return

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDy > absDx && dy < -minDist) {
      // Swipe UP — cycle display mode
      const modes: DisplayMode[] = ['speed', 'stats', 'compact']
      const nextIdx = (modes.indexOf(displayMode) + 1) % modes.length
      setDisplayMode(modes[nextIdx])
      const modeLabels: Record<DisplayMode, string> = { speed: 'Hitrost', stats: 'Statistika', compact: 'Kompaktno' }
      showGestureHint(modeLabels[modes[nextIdx]])
    } else if (absDx > absDy && dx < -minDist) {
      // Swipe LEFT — skip nav instruction (repeat current)
      showGestureHint('↻ Ponovi navodilo')
    } else if (absDx > absDy && dx > minDist) {
      // Swipe RIGHT — quick hazard report
      handleQuickHazard()
      showGestureHint('⚠️ Nevarnost!')
    }
  }, [displayMode])

  const showGestureHint = useCallback((text: string) => {
    setGestureHint(text)
    if (gestureHintTimerRef.current) clearTimeout(gestureHintTimerRef.current)
    gestureHintTimerRef.current = setTimeout(() => setGestureHint(null), 1200)
  }, [])

  // Quick hazard report
  const handleQuickHazard = useCallback(async () => {
    if (hazardSending) return
    const hazard = QUICK_HAZARD_TYPES[hazardIdx]

    // Get GPS position
    let lat = currentLat
    let lng = currentLng
    if (lat == null || lng == null) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          })
        })
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {
        return
      }
    }

    // Flash feedback
    setHazardFlash(true)
    setTimeout(() => setHazardFlash(false), 300)

    // Cycle hazard type
    setHazardIdx((hazardIdx + 1) % QUICK_HAZARD_TYPES.length)

    // Send report
    setHazardSending(true)
    try {
      await fetch('/api/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: hazard.type,
          name: `${hazard.emoji} ${hazard.label}`,
          lat,
          lng,
          userId: userId || undefined,
        }),
      })
    } catch {
      // ignore
    } finally {
      setHazardSending(false)
    }
  }, [hazardIdx, hazardSending, currentLat, currentLng, userId])

  // Lap timer
  const handleLap = useCallback(() => {
    setLaps(prev => [...prev, { time: duration, timestamp: Date.now() }])
    setShowLaps(true)
    setTimeout(() => setShowLaps(false), 4000)
  }, [duration])

  const handleResetLaps = useCallback(() => {
    setLaps([])
    setShowLaps(false)
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────
  if (!isActive) return null

  const speedUnitLabel = unitSystem === 'imperial' ? 'MPH' : 'km/h'
  const displaySpeed = unitSystem === 'imperial' ? Math.round(currentSpeed * 0.621371) : Math.round(smoothSpeed)
  const displaySpeedLimit = unitSystem === 'imperial' ? Math.round(speedLimit * 0.621371) : speedLimit
  const displayDistance = unitSystem === 'imperial' ? (distance * 0.621371).toFixed(1) : distance.toFixed(1)
  const distUnit = unitSystem === 'imperial' ? 'mi' : 'km'

  // Night mode colors
  const textPrimary = nightMode ? 'text-red-400' : 'text-white'
  const textSecondary = nightMode ? 'text-red-300/60' : 'text-white/60'
  const textTertiary = nightMode ? 'text-red-300/30' : 'text-white/30'
  const bgBase = nightMode ? 'bg-black' : 'bg-black'
  const bgCard = nightMode ? 'bg-red-950/20' : 'bg-white/10'

  // Fuel station arrow rotation (relative to heading)
  const fuelBearing = nearestStation ? ((nearestStation.bearing - heading + 360) % 360) : 0

  return (
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-300 select-none ${
        isOverSpeed && flashOn ? 'bg-red-900/30' : bgBase
      } ${nightMode ? 'brightness-75' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Speed alert overlay */}
      {isOverSpeed && flashOn && (
        <div className="absolute inset-0 bg-red-500/15 pointer-events-none" />
      )}

      {/* Hazard flash feedback */}
      {hazardFlash && (
        <div className="absolute inset-0 bg-red-500/30 pointer-events-none animate-pulse" />
      )}

      {/* Gesture hint overlay */}
      {gestureHint && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="px-6 py-3 rounded-2xl bg-white/20 backdrop-blur-md text-white text-xl font-bold animate-bounce">
            {gestureHint}
          </div>
        </div>
      )}

      {/* Close button - top right, small */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {/* Night mode indicator */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
          nightMode ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/60'
        }`}>
          {nightMode ? <Moon className="size-3" /> : <Sun className="size-3" />}
          {nightMode ? 'NOČ' : 'DAN'}
        </div>
        {/* GPS accuracy indicator */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
          gpsAccuracy === 'good' ? 'bg-emerald-500/20 text-emerald-400' :
          gpsAccuracy === 'ok' ? 'bg-amber-500/20 text-amber-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          <Signal className="size-3" />
          GPS
        </div>
        {/* Battery level */}
        {batteryLevel !== null && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
            batteryLevel > 30 ? 'bg-white/10 text-white/60' : 'bg-red-500/20 text-red-400'
          }`}>
            <Battery className="size-3" />
            {batteryLevel}%
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="size-4 text-white/60" />
        </button>
      </div>

      {/* Voice toggle - top left */}
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={onToggleVoice}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          {voiceEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 text-white/40" />}
        </button>
      </div>

      {/* ─── Navigation turn arrow (large, colored by urgency) ──────────── */}
      {navInstruction && (
        <div className="absolute top-14 left-4 right-4 z-10">
          <div className={`rounded-2xl p-4 ${
            navDistanceToStep !== undefined && navDistanceToStep < 50
              ? 'bg-primary/20 border-2 border-primary/40'
              : `${bgCard} border border-white/10`
          }`}>
            <div className="flex items-center gap-3">
              {/* Large arrow indicator */}
              <div className={`flex-shrink-0 flex items-center justify-center size-16 rounded-xl ${
                arrowUrgency === 'red'
                  ? nightMode ? 'bg-red-500/30' : 'bg-red-500/20'
                  : arrowUrgency === 'amber'
                    ? nightMode ? 'bg-amber-500/20' : 'bg-amber-500/15'
                    : nightMode ? 'bg-emerald-500/15' : 'bg-emerald-500/15'
              } ${arrowAnimate ? 'animate-pulse' : ''}`}>
                <span className={`text-4xl font-black leading-none ${
                  arrowUrgency === 'red'
                    ? 'text-red-400'
                    : arrowUrgency === 'amber'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }`}>
                  {navArrow}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold ${textPrimary} truncate`}>{navInstruction}</p>
                <div className="flex items-center gap-3 mt-1">
                  {navDistanceToStep !== undefined && (
                    <span className={`text-2xl font-black ${
                      arrowUrgency === 'red' ? 'text-red-400' :
                      arrowUrgency === 'amber' ? 'text-amber-400' :
                      'text-primary'
                    }`}>
                      {formatDriveDistance(navDistanceToStep)}
                      <span className={`text-sm font-medium ml-1 ${
                        arrowUrgency === 'red' ? 'text-red-400/70' :
                        arrowUrgency === 'amber' ? 'text-amber-400/70' :
                        'text-primary/70'
                      }`}>
                        {formatDriveDistanceUnit(navDistanceToStep)}
                      </span>
                    </span>
                  )}
                  {navTotalSteps && navStepIdx !== undefined && (
                    <span className={`text-xs ${textTertiary}`}>
                      {navStepIdx + 1}/{navTotalSteps}
                    </span>
                  )}
                  {navDestination && (
                    <span className={`text-xs ${textTertiary} truncate`}>
                      → {navDestination}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main content - centered, large text ──────────────────────────── */}
      <div className="h-full flex flex-col items-center justify-center px-6">

        {/* SPEED - Main display, huge text */}
        {displayMode !== 'stats' && (
          <div className="text-center -mt-8">
            <div className={`transition-colors duration-300 ${
              isOverSpeed ? 'text-red-500' :
              currentSpeed > speedLimit * 0.9 ? 'text-amber-400' :
              textPrimary
            }`}>
              <span className={`font-black tracking-tighter leading-none ${
                isCompact ? 'text-[120px]' : 'text-[140px]'
              }`}>
                {displaySpeed}
              </span>
            </div>
            <div className="flex items-center justify-center gap-3 mt-1">
              <span className={`text-xl ${textSecondary} font-medium`}>{speedUnitLabel}</span>
              {speedLimit > 0 && (
                <div className={`flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold ${
                  isOverSpeed
                    ? 'bg-red-500 text-white'
                    : `${bgCard} ${textTertiary}`
                }`}>
                  <Gauge className="size-3.5 mr-1" />
                  {displaySpeedLimit}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATS display mode */}
        {displayMode === 'stats' && (
          <div className="text-center -mt-8 space-y-4">
            <div>
              <span className={`font-black tracking-tighter leading-none text-[100px] ${textPrimary}`}>
                {displaySpeed}
              </span>
              <span className={`text-xl ${textSecondary} font-medium ml-2`}>{speedUnitLabel}</span>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${textPrimary}`}>{displayDistance}</p>
                <p className={`text-xs ${textTertiary} uppercase tracking-wider`}>{distUnit}</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${textPrimary}`}>{formatDriveDuration(duration)}</p>
                <p className={`text-xs ${textTertiary} uppercase tracking-wider`}>čas</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${textSecondary}`}>{Math.round(elevation)}</p>
                <p className={`text-xs ${textTertiary} uppercase tracking-wider`}>m ↑</p>
              </div>
            </div>
            {maxSpeed > 0 && (
              <div className="text-center">
                <span className={`text-sm ${textTertiary}`}>max: </span>
                <span className={`text-lg font-bold ${textSecondary}`}>
                  {unitSystem === 'imperial' ? Math.round(maxSpeed * 0.621371) : Math.round(maxSpeed)}
                </span>
                <span className={`text-sm ${textTertiary} ml-1`}>{speedUnitLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Stats row - below speed (only in speed mode) */}
        {displayMode === 'speed' && (
          <div className="flex items-center justify-center gap-8 mt-8">
            <div className="text-center">
              <p className={`text-3xl font-bold ${textPrimary}`}>{displayDistance}</p>
              <p className={`text-xs ${textTertiary} uppercase tracking-wider`}>{distUnit}</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-bold ${textPrimary}`}>{formatDriveDuration(duration)}</p>
              <p className={`text-xs ${textTertiary} uppercase tracking-wider`}>čas</p>
            </div>
            {!isCompact && elevation > 0 && (
              <div className="text-center">
                <p className={`text-3xl font-bold ${textSecondary}`}>{Math.round(elevation)}</p>
                <p className={`text-xs ${textTertiary} uppercase tracking-wider`}>m ↑</p>
              </div>
            )}
          </div>
        )}

        {/* Fuel range indicator */}
        {fuelRange !== undefined && fuelRange > 0 && (
          <div className={`mt-6 flex items-center gap-3 px-5 py-3 rounded-2xl ${
            fuelRange < 30
              ? 'bg-red-500/20 border border-red-500/30'
              : fuelRange < 80
                ? 'bg-amber-500/15 border border-amber-500/20'
                : `${bgCard} border border-white/10`
          }`}>
            <Fuel className={`size-5 ${
              fuelRange < 30 ? 'text-red-400' :
              fuelRange < 80 ? 'text-amber-400' :
              nightMode ? 'text-red-300/50' : 'text-white/50'
            }`} />
            <div>
              <p className={`text-2xl font-bold ${
                fuelRange < 30 ? 'text-red-400' :
                fuelRange < 80 ? 'text-amber-400' :
                textPrimary
              }`}>
                {Math.round(fuelRange)}
                <span className={`text-sm font-normal ${textTertiary} ml-1`}>{distUnit}</span>
              </p>
              <p className={`text-[10px] ${textTertiary} uppercase tracking-wider`}>doseg</p>
            </div>
            {currentFuel !== undefined && (
              <span className={`text-xs ${textTertiary} ml-2`}>
                {currentFuel.toFixed(1)}L
              </span>
            )}
          </div>
        )}

        {/* Auto-pause indicator */}
        {isPaused && isTracking && (
          <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30">
            <div className="size-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">Premor</span>
          </div>
        )}

        {/* Paused / Not tracking indicator */}
        {!isTracking && (
          <div className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-full ${bgCard} border border-white/10`}>
            <MapPin className={`size-3 ${textTertiary}`} />
            <span className={`text-sm ${textTertiary}`}>Ne sledi</span>
          </div>
        )}

        {/* ─── Lap timer display ─────────────────────────────────────────── */}
        {laps.length > 0 && showLaps && (
          <div className={`mt-4 px-4 py-2 rounded-xl ${bgCard} border border-white/10`}>
            {lastLapTime !== null && (
              <div className="text-center">
                <span className={`text-xs ${textTertiary} uppercase tracking-wider`}>Zadnji krog</span>
                <p className={`text-lg font-bold ${textPrimary}`}>
                  {formatDriveDuration(lastLapTime)}
                </p>
              </div>
            )}
            {bestLapTime !== null && (
              <div className="text-center mt-1">
                <span className={`text-xs text-emerald-400/60 uppercase tracking-wider`}>Najboljši</span>
                <p className="text-sm font-bold text-emerald-400">
                  {formatDriveDuration(bestLapTime)}
                </p>
              </div>
            )}
            <p className={`text-[10px] ${textTertiary} text-center mt-1`}>
              Krogov: {laps.length - 1}
            </p>
          </div>
        )}
      </div>

      {/* ─── Bottom bar - controls + hazard button ──────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe">
        <div className="flex items-center justify-center gap-4 py-4 px-4">

          {/* Fuel station direction arrow */}
          {nearestStation && (
            <div className="flex flex-col items-center gap-0.5">
              <div className={`relative size-12 rounded-full ${bgCard} border border-white/10 flex items-center justify-center`}>
                <div
                  className="transition-transform duration-500"
                  style={{ transform: `rotate(${fuelBearing}deg)` }}
                >
                  <Navigation2 className={`size-5 ${nightMode ? 'text-red-300/60' : 'text-white/60'}`} />
                </div>
              </div>
              <span className={`text-[9px] ${textTertiary} font-medium`}>
                {nearestStation.distance.toFixed(1)} km
              </span>
              <span className={`text-[8px] ${textTertiary}`}>
                {nearestStation.price95 > 0 ? `${nearestStation.price95.toFixed(3)}€` : '⛽'}
              </span>
            </div>
          )}

          {/* Display mode toggle */}
          <button
            onClick={() => setDisplayMode(
              displayMode === 'speed' ? 'stats' :
              displayMode === 'stats' ? 'compact' : 'speed'
            )}
            className={`p-3 rounded-full ${bgCard} hover:bg-white/15 transition-colors`}
            title="Preklop pogleda"
          >
            {displayMode === 'speed' ? <ChevronUp className={`size-5 ${textSecondary}`} /> :
             displayMode === 'stats' ? <Minimize2 className={`size-5 ${textSecondary}`} /> :
             <Maximize2 className={`size-5 ${textSecondary}`} />}
          </button>

          {/* ─── Quick hazard reporting button — big, easy to tap ────────── */}
          <button
            onClick={handleQuickHazard}
            disabled={hazardSending}
            className={`relative size-16 rounded-full flex items-center justify-center active:scale-90 transition-all ${
              hazardFlash
                ? 'bg-red-500 scale-110'
                : 'bg-red-500/80 hover:bg-red-500'
            } shadow-lg shadow-red-500/40`}
            title={`Prijavi: ${QUICK_HAZARD_TYPES[hazardIdx].label}`}
          >
            <span className="text-2xl">{QUICK_HAZARD_TYPES[hazardIdx].emoji}</span>
            {/* Next hazard type indicator */}
            <span className="absolute -bottom-1 text-[8px] text-white/60 font-medium">
              {QUICK_HAZARD_TYPES[(hazardIdx + 1) % QUICK_HAZARD_TYPES.length].emoji}
            </span>
          </button>

          {/* Lap timer button */}
          <button
            onClick={handleLap}
            className={`relative p-3 rounded-full ${bgCard} hover:bg-white/15 transition-colors`}
            title="Označi krog"
          >
            <Flag className={`size-5 ${laps.length > 0 ? 'text-emerald-400' : textSecondary}`} />
            {laps.length > 0 && (
              <span className="absolute -top-1 -right-1 size-4 rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center">
                {laps.length - 1}
              </span>
            )}
          </button>

          {/* Reset laps (only when laps exist) */}
          {laps.length > 0 && (
            <button
              onClick={handleResetLaps}
              className={`p-3 rounded-full ${bgCard} hover:bg-white/15 transition-colors`}
              title="Ponastavi kroge"
            >
              <RotateCcw className={`size-5 ${textSecondary}`} />
            </button>
          )}
        </div>

        {/* Swipe hint (subtle, bottom center) */}
        <div className={`text-center pb-2 text-[9px] ${textTertiary}`}>
          ↑ preklop · ← ponovi · → nevarnost
        </div>
      </div>
    </div>
  )
}
