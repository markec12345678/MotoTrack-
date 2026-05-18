'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  X,
  Volume2,
  VolumeX,
  Battery,
  Signal,
  Clock,
  ShieldAlert,
  Pause,
  Play,
  Square,
  Navigation2,
  Fuel,
  Gauge,
  Phone,
} from 'lucide-react'

// ===== CARPLAY / ANDROID AUTO MODE =====
// Ultra-large text, high-contrast driving interface
// Optimized for phone mounted on handlebars or connected to car display
// Works as PWA alternative to native CarPlay/Android Auto apps

type ArrowDirection = '↑' | '↗' | '→' | '↘' | '↓' | '↙' | '←' | '↖' | '↩'

function parseNavArrow(instruction?: string, navStepType?: string): ArrowDirection {
  if (!instruction && !navStepType) return '↑'
  const text = (instruction || '').toLowerCase()
  const type = (navStepType || '').toLowerCase()
  if (text.includes('polkrožni obrat') || text.includes('obrat') || type === 'uturn') return '↩'
  if (text.includes('ostro levo') || text.includes('sharp left')) return '↙'
  if (text.includes('ostro desno') || text.includes('sharp right')) return '↘'
  if (text.includes('levo') && !text.includes('rahlo')) return '←'
  if (text.includes('rahlo levo') || text.includes('slight left')) return '↖'
  if (text.includes('desno') && !text.includes('rahlo')) return '→'
  if (text.includes('rahlo desno') || text.includes('slight right')) return '↗'
  if (text.includes('krožišče') || type === 'roundabout' || type === 'rotary') return '↗'
  if (text.includes('prispeli') || type === 'arrive') return '🏁'
  return '↑'
}

function formatCpDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`
  return `${m} min`
}

function formatCpDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000
    return km >= 100 ? `${Math.round(km)}` : `${km.toFixed(1)}`
  }
  return `${Math.round(meters)}`
}

function formatCpDistUnit(meters: number): string {
  return meters >= 1000 ? 'km' : 'm'
}

interface CarPlayModeProps {
  isActive: boolean
  onToggle: () => void
  currentSpeed: number
  distance: number
  duration: number
  elevation: number
  maxSpeed: number
  // Navigation
  navInstruction?: string
  navDistanceToStep?: number
  navStepType?: string
  navDestination?: string
  navStepIdx?: number
  navTotalSteps?: number
  navRemainingDistance?: number
  navRoadName?: string
  // Tracking
  isTracking: boolean
  isPaused: boolean
  onStartStopTrack?: () => void
  onPauseResume?: () => void
  // Speed
  speedLimit?: number
  isOverSpeed?: boolean
  // Voice
  voiceEnabled?: boolean
  onToggleVoice?: () => void
  // Position
  currentLat?: number | null
  currentLng?: number | null
  heading?: number
  // Fuel
  fuelRange?: number
  currentFuel?: number
  // Emergency
  onOpenEmergency?: () => void
}

export default function CarPlayMode({
  isActive,
  onToggle,
  currentSpeed,
  distance,
  duration,
  elevation,
  maxSpeed,
  navInstruction,
  navDistanceToStep,
  navStepType,
  navDestination,
  navStepIdx,
  navTotalSteps,
  navRemainingDistance,
  navRoadName,
  isTracking,
  isPaused,
  onStartStopTrack,
  onPauseResume,
  speedLimit = 90,
  isOverSpeed = false,
  voiceEnabled = true,
  onToggleVoice,
  currentLat,
  currentLng,
  heading = 0,
  fuelRange,
  currentFuel,
  onOpenEmergency,
}: CarPlayModeProps) {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [gpsQuality, setGpsQuality] = useState<'good' | 'ok' | 'poor'>('good')
  const [flashOn, setFlashOn] = useState(false)
  const [fontScale, setFontScale] = useState<1 | 1.5 | 2>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mototrack_cp_fontscale')
        if (saved === '1.5') return 1.5
        if (saved === '2') return 2
      } catch {}
    }
    return 1
  })
  const [clockStr, setClockStr] = useState('')
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastSpeedRef = useRef(currentSpeed)

  // Smoothed speed (avoid jitter)
  const smoothSpeed = useMemo(() => {
    if (currentSpeed === 0 && lastSpeedRef.current > 20) return lastSpeedRef.current
    return currentSpeed
  }, [currentSpeed])

  useEffect(() => {
    if (currentSpeed > 0) lastSpeedRef.current = currentSpeed
  }, [currentSpeed])

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setClockStr(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`)
    }
    update()
    const interval = setInterval(update, 10000)
    return () => clearInterval(interval)
  }, [])

  // Speed alert flash
  useEffect(() => {
    if (!isOverSpeed) { setFlashOn(false); return }
    const interval = setInterval(() => setFlashOn(p => !p), 600)
    return () => clearInterval(interval)
  }, [isOverSpeed])

  // Battery monitoring
  useEffect(() => {
    if (!('getBattery' in navigator)) return
    ;(navigator as any).getBattery?.()?.then((b: any) => {
      setBatteryLevel(Math.round(b.level * 100))
      b.addEventListener('levelchange', () => setBatteryLevel(Math.round(b.level * 100)))
    })
  }, [])

  // GPS quality
  useEffect(() => {
    if (!isActive) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy < 15) setGpsQuality('good')
        else if (pos.coords.accuracy < 50) setGpsQuality('ok')
        else setGpsQuality('poor')
      },
      () => setGpsQuality('poor'),
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [isActive])

  // Save font scale preference
  useEffect(() => {
    try { localStorage.setItem('mototrack_cp_fontscale', String(fontScale)) } catch {}
  }, [fontScale])

  // ETA
  const etaDisplay = useMemo(() => {
    if (!navDestination || !navRemainingDistance || navRemainingDistance <= 0) return null
    const speedMs = currentSpeed / 3.6
    if (speedMs < 2) return null
    const hoursRemaining = (navRemainingDistance / 1000) / currentSpeed
    const eta = new Date(Date.now() + hoursRemaining * 3600000)
    return `${eta.getHours().toString().padStart(2, '0')}:${eta.getMinutes().toString().padStart(2, '0')}`
  }, [navDestination, navRemainingDistance, currentSpeed])

  // Nav arrow
  const navArrow = useMemo(() => parseNavArrow(navInstruction, navStepType), [navInstruction, navStepType])
  const arrowUrgency = useMemo(() => {
    if (navDistanceToStep === undefined) return 'green' as const
    if (navDistanceToStep < 100) return 'red' as const
    if (navDistanceToStep < 500) return 'amber' as const
    return 'green' as const
  }, [navDistanceToStep])

  // Swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.changedTouches[0]
    const dy = touch.clientY - touchStartRef.current.y
    const dx = touch.clientX - touchStartRef.current.x
    const dt = Date.now() - touchStartRef.current.time
    touchStartRef.current = null
    if (dt > 600) return
    const minDist = 80

    if (Math.abs(dy) > Math.abs(dx) && dy < -minDist) {
      // Swipe UP: cycle font scale
      setFontScale(prev => prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1)
    } else if (Math.abs(dx) > Math.abs(dy) && dx > minDist) {
      // Swipe RIGHT: toggle voice
      onToggleVoice?.()
    }
  }, [onToggleVoice])

  // Font sizes based on scale
  const speedFontSize = fontScale === 2 ? 'text-[240px]' : fontScale === 1.5 ? 'text-[200px]' : 'text-[160px]'
  const unitFontSize = fontScale === 2 ? 'text-4xl' : fontScale === 1.5 ? 'text-3xl' : 'text-2xl'
  const statFontSize = fontScale === 2 ? 'text-5xl' : fontScale === 1.5 ? 'text-4xl' : 'text-3xl'
  const statLabelSize = fontScale === 2 ? 'text-base' : fontScale === 1.5 ? 'text-sm' : 'text-xs'
  const arrowBoxSize = fontScale === 2 ? 'size-28' : fontScale === 1.5 ? 'size-24' : 'size-20'
  const arrowFontSize = fontScale === 2 ? 'text-7xl' : fontScale === 1.5 ? 'text-6xl' : 'text-5xl'
  const btnSize = fontScale === 2 ? 'size-20' : fontScale === 1.5 ? 'size-[72px]' : 'size-16'

  if (!isActive) return null

  const displaySpeed = Math.round(smoothSpeed)

  return (
    <div
      className={`fixed inset-0 z-[10000] bg-black select-none transition-all duration-300 ${
        isOverSpeed && flashOn ? 'bg-red-900/40' : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Speed over limit flash */}
      {isOverSpeed && flashOn && (
        <div className="absolute inset-0 bg-red-500/20 pointer-events-none" />
      )}

      {/* ─── Top Bar: Clock, GPS, Battery, Exit ─────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/50">
        {/* Clock */}
        <div className="flex items-center gap-3">
          <Clock className="size-5 text-white/40" />
          <span className="text-2xl font-mono font-bold text-white/60">{clockStr}</span>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          {/* GPS */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-bold ${
            gpsQuality === 'good' ? 'bg-emerald-500/20 text-emerald-400' :
            gpsQuality === 'ok' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            <Signal className="size-4" />
            <span className="hidden sm:inline">GPS</span>
          </div>

          {/* Battery */}
          {batteryLevel !== null && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-bold ${
                batteryLevel > 30 ? 'bg-white/10 text-white/50' : 'bg-red-500/20 text-red-400'
              }`}
            >
              <Battery className="size-4" />
              <span>{batteryLevel}%</span>
            </div>
          )}

          {/* Font scale indicator */}
          <button
            onClick={() => setFontScale(prev => prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1)}
            className="px-2 py-1 rounded-full bg-white/10 text-white/40 text-xs font-bold hover:bg-white/20"
          >
            {fontScale}x
          </button>

          {/* Exit */}
          <button
            onClick={onToggle}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="size-5 text-white/60" />
          </button>
        </div>
      </div>

      {/* ─── Navigation Turn Arrow (HUGE, like real GPS) ────────────────────── */}
      {navInstruction && (
        <div className="absolute top-16 left-4 right-4 z-10">
          <div className={`rounded-3xl p-5 ${
            arrowUrgency === 'red'
              ? 'bg-red-500/30 border-2 border-red-500/50'
              : arrowUrgency === 'amber'
                ? 'bg-amber-500/20 border-2 border-amber-500/30'
                : 'bg-emerald-500/15 border-2 border-emerald-500/20'
          } ${navDistanceToStep !== undefined && navDistanceToStep < 100 ? 'animate-pulse' : ''}`}>
            <div className="flex items-center gap-5">
              {/* Giant arrow */}
              <div className={`flex-shrink-0 flex items-center justify-center ${arrowBoxSize} rounded-2xl ${
                arrowUrgency === 'red' ? 'bg-red-500/30' :
                arrowUrgency === 'amber' ? 'bg-amber-500/20' :
                'bg-emerald-500/20'
              }`}>
                <span className={`${arrowFontSize} font-black leading-none ${
                  arrowUrgency === 'red' ? 'text-red-400' :
                  arrowUrgency === 'amber' ? 'text-amber-400' :
                  'text-emerald-400'
                }`}>
                  {navArrow}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-white truncate">{navInstruction}</p>
                <div className="flex items-center gap-4 mt-2">
                  {navDistanceToStep !== undefined && (
                    <span className={`text-4xl font-black ${
                      arrowUrgency === 'red' ? 'text-red-400' :
                      arrowUrgency === 'amber' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {formatCpDistance(navDistanceToStep)}
                      <span className="text-xl ml-1 opacity-70">{formatCpDistUnit(navDistanceToStep)}</span>
                    </span>
                  )}
                  {navDestination && (
                    <span className="text-base text-white/40 truncate">→ {navDestination}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Speed Display (CENTER, MASSIVE) ────────────────────────────── */}
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center" style={{ marginTop: navInstruction ? '120px' : '-40px' }}>
          {/* Speed number */}
          <div className={`transition-colors duration-300 ${
            isOverSpeed ? 'text-red-500' :
            currentSpeed > speedLimit * 0.9 ? 'text-amber-400' :
            'text-white'
          }`}>
            <span className={`${speedFontSize} font-black tracking-tighter leading-none`}>
              {displaySpeed}
            </span>
          </div>

          {/* Unit + speed limit */}
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className={`${unitFontSize} text-white/50 font-medium`}>km/h</span>
            {speedLimit > 0 && (
              <div className={`flex items-center justify-center rounded-full px-4 py-1.5 text-lg font-bold ${
                isOverSpeed
                  ? 'bg-red-500 text-white'
                  : 'bg-white/10 text-white/30'
              }`}>
                <Gauge className="size-4 mr-1.5" />
                {speedLimit}
              </div>
            )}
          </div>

          {/* Road name */}
          {navRoadName && (
            <p className="text-lg text-white/30 font-medium mt-1 truncate max-w-[400px] mx-auto">
              {navRoadName}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-12 mt-10">
          <div className="text-center">
            <p className={`${statFontSize} font-bold text-white`}>{distance.toFixed(1)}</p>
            <p className={`${statLabelSize} text-white/30 uppercase tracking-wider`}>km</p>
          </div>
          <div className="text-center">
            <p className={`${statFontSize} font-bold text-white`}>{formatCpDuration(duration)}</p>
            <p className={`${statLabelSize} text-white/30 uppercase tracking-wider`}>čas</p>
          </div>
          {etaDisplay && (
            <div className="text-center">
              <p className={`${statFontSize} font-bold text-emerald-400`}>{etaDisplay}</p>
              <p className={`${statLabelSize} text-white/30 uppercase tracking-wider`}>prihod</p>
            </div>
          )}
        </div>

        {/* Fuel range */}
        {fuelRange !== undefined && fuelRange > 0 && (
          <div className={`mt-6 flex items-center gap-3 px-6 py-3 rounded-2xl ${
            fuelRange < 30 ? 'bg-red-500/20 border border-red-500/30' :
            fuelRange < 80 ? 'bg-amber-500/15 border border-amber-500/20' :
            'bg-white/10 border border-white/10'
          }`}>
            <Fuel className={`size-6 ${
              fuelRange < 30 ? 'text-red-400' : fuelRange < 80 ? 'text-amber-400' : 'text-white/40'
            }`} />
            <p className={`text-3xl font-bold ${
              fuelRange < 30 ? 'text-red-400' : fuelRange < 80 ? 'text-amber-400' : 'text-white'
            }`}>
              {Math.round(fuelRange)}
              <span className="text-lg text-white/40 ml-1">km</span>
            </p>
            {currentFuel !== undefined && (
              <span className="text-sm text-white/30">{currentFuel.toFixed(1)}L</span>
            )}
          </div>
        )}

        {/* Paused indicator */}
        {isPaused && isTracking && (
          <div className="mt-6 flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-500/20 border border-amber-500/30">
            <div className="size-3 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xl font-bold text-amber-400 uppercase">Premor</span>
          </div>
        )}

        {/* Not tracking */}
        {!isTracking && (
          <div className="mt-6 flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/10 border border-white/10">
            <span className="text-xl text-white/40">Ne sledi</span>
          </div>
        )}
      </div>

      {/* ─── Bottom Control Bar ──────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe">
        {/* Tracking duration */}
        {isTracking && duration > 0 && (
          <div className="text-center pb-1 text-sm text-white/30 font-mono">
            {formatCpDuration(duration)}
          </div>
        )}
        <div className="flex items-center justify-center gap-6 py-4 px-4">
          {/* Voice toggle */}
          <button
            onClick={onToggleVoice}
            className={`${btnSize} rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              voiceEnabled ? 'bg-primary/30 text-primary' : 'bg-white/10 text-white/30'
            }`}
            title={voiceEnabled ? 'Izklopi glas' : 'Vklopi glas'}
          >
            {voiceEnabled ? <Volume2 className="size-7" /> : <VolumeX className="size-7" />}
          </button>

          {/* Start/Stop/Pause tracking */}
          {onStartStopTrack && (
            <button
              onClick={isTracking ? (isPaused ? onPauseResume : onPauseResume) : onStartStopTrack}
              className={`${btnSize} rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                isTracking
                  ? isPaused
                    ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40'
                    : 'bg-amber-500 shadow-lg shadow-amber-500/40'
                  : 'bg-primary shadow-lg shadow-primary/40'
              }`}
              title={isTracking ? (isPaused ? 'Nadaljuj' : 'Premor') : 'Začni sledenje'}
            >
              {isTracking
                ? isPaused
                  ? <Play className="size-8 text-white fill-white ml-1" />
                  : <Pause className="size-8 text-white" />
                : <Play className="size-8 text-white fill-white ml-1" />
              }
            </button>
          )}

          {/* Stop tracking */}
          {isTracking && onStartStopTrack && (
            <button
              onClick={onStartStopTrack}
              className={`${btnSize} rounded-full flex items-center justify-center bg-red-500 shadow-lg shadow-red-500/30 transition-colors active:scale-95`}
              title="Ustavi sledenje"
            >
              <Square className="size-7 text-white fill-white" />
            </button>
          )}

          {/* SOS Emergency */}
          <button
            onClick={onOpenEmergency}
            className={`${btnSize} rounded-full flex items-center justify-center bg-red-500/30 text-red-400 transition-colors active:scale-95 hover:bg-red-500/50`}
            title="Nujna pomoč"
          >
            <ShieldAlert className="size-7" />
          </button>

          {/* Phone call (for CarPlay integration) */}
          <button
            onClick={() => { window.location.href = 'tel:112' }}
            className={`${btnSize} rounded-full flex items-center justify-center bg-white/10 text-white/30 transition-colors active:scale-95 hover:bg-white/20`}
            title="Klic 112"
          >
            <Phone className="size-7" />
          </button>
        </div>
      </div>

      {/* Swipe hint (shown briefly on activate) */}
      <div className="absolute bottom-28 left-0 right-0 text-center pointer-events-none">
        <span className="text-xs text-white/20">↑ Pisava ←/→ Glas</span>
      </div>
    </div>
  )
}
