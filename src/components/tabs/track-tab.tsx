'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Play, Pause, Square, Save, Gauge, AlertTriangle, ChevronDown, ChevronUp, Activity, Bike, Moon, Timer, Share2, Navigation2, Volume2, VolumeX, Eye, Headphones, Zap, Radio, ShieldAlert, Camera, Monitor, MapPin, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import type { TrackPoint, SpeedAlertSettings } from '@/components/tabs/types'
import { formatDuration } from '@/components/tabs/types'
import { type UnitSystem, convertSpeed, convertDistance, speedUnit, distanceUnit } from '@/hooks/use-settings'
import { useBtAudio } from '@/hooks/use-bt-audio'
import { useGpsReliability, GpsSignalIndicator, GpsReliabilityStats, GpsErrorNotification, getSignalQuality } from '@/components/gps-reliability-service'

const CrashDetectionPanel = dynamic(() => import('@/components/crash-detection-panel'), { ssr: false })
const LiveTrackingPanel = dynamic(() => import('@/components/live-tracking-panel'), { ssr: false })
const LeanAngleDisplay = dynamic(() => import('@/components/lean-angle-display'), { ssr: false })
const WeatherAlertsPanel = dynamic(() => import('@/components/weather-alerts-panel'), { ssr: false })
const GradientAnalysis = dynamic(() => import('@/components/gradient-analysis'), { ssr: false })
const TwistinessScore = dynamic(() => import('@/components/twistiness-score'), { ssr: false })
const RideShareCard = dynamic(() => import('@/components/ride-share-card'), { ssr: false })
const PreRideChecklist = dynamic(() => import('@/components/pre-ride-checklist'), { ssr: false })

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })
const DrivingMode = dynamic(() => import('@/components/driving-mode'), { ssr: false })
const FuelRangeIndicator = dynamic(() => import('@/components/fuel-range-indicator'), { ssr: false })
const RoadHazardReporter = dynamic(() => import('@/components/road-hazard-reporter'), { ssr: false })
const MiniElevationProfile = dynamic(() => import('@/components/mini-elevation-profile'), { ssr: false })
const RideWeatherOverlay = dynamic(() => import('@/components/ride-weather-overlay'), { ssr: false })
const RideDifficultyCalculator = dynamic(() => import('@/components/ride-difficulty-calculator'), { ssr: false })
const WindWarningPanel = dynamic(() => import('@/components/wind-warning-panel'), { ssr: false })
const EmergencyPanel = dynamic(() => import('@/components/emergency-panel'), { ssr: false })
const RidePhotoGallery = dynamic(() => import('@/components/ride-photo-gallery'), { ssr: false })
const PhotoButton = dynamic(() => import('@/components/ride-photo-gallery').then(m => ({ default: m.PhotoButton })), { ssr: false })
const VoiceCommands = dynamic(() => import('@/components/voice-commands'), { ssr: false })

// Inline voice navigation for track tab (lightweight, no separate component needed)
interface NavStep {
  instruction: string
  distance: number
  duration: number
  type: string
  name: string
  lat: number
  lng: number
}

// Slovenian translation for navigation instructions
const NAV_SLO: Record<string, string> = {
  'turn': 'Zavij', 'new name': 'Nadaljuj', 'depart': 'Kreni',
  'arrive': 'Prispeli ste na cilj', 'merge': 'Združi se', 'fork': 'Na razcepu',
  'roundabout': 'Krožišče', 'rotary': 'Krožišče', 'continue': 'Nadaljuj naravnost',
  'on ramp': 'Priključek', 'off ramp': 'Odhod', 'end of road': 'Konec ceste',
}
const MOD_SLO: Record<string, string> = {
  'left': 'levo', 'right': 'desno', 'slight left': 'rahlo levo',
  'slight right': 'rahlo desno', 'sharp left': 'ostro levo', 'sharp right': 'ostro desno',
  'straight': 'naravnost', 'uturn': 'polkrožni obrat',
}

// Haversine distance in meters
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Proactive announcement thresholds based on speed
function getAnnounceDistance(speedKmh: number): number {
  if (speedKmh > 100) return 500
  if (speedKmh > 60) return 300
  return 150
}

// Format distance in Slovenian
function formatDistSlo(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace('.0', '')} kilometrov`
  if (meters >= 100) return `${Math.round(meters / 10) * 10} metrov`
  return `${Math.round(meters / 10) * 10} metrov`
}

interface TrackTabProps {
  isTracking: boolean
  isPaused: boolean
  trackPoints: TrackPoint[]
  duration: number
  distance: number
  maxSpeed: number
  currentSpeed: number
  elevation: number
  gpsAccuracy?: number | null
  userId?: string
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSave: () => void
  unitSystem?: UnitSystem
  autoPauseEnabled?: boolean
  wakelockEnabled?: boolean
  autoStartEnabled?: boolean
  autoStartCountdown?: number | null
  onToggleAutoStart?: () => void
  // CarPlay & Parking
  carplayMode?: boolean
  onToggleCarplay?: () => void
  onOpenParking?: () => void
  onOpenBorderGuide?: () => void
}

export default function TrackTab({
  isTracking, isPaused, trackPoints, duration,
  distance, maxSpeed, currentSpeed, elevation,
  gpsAccuracy = null,
  userId,
  onStart, onPause, onResume, onStop, onSave,
  unitSystem = 'metric',
  autoPauseEnabled = true,
  wakelockEnabled = true,
  autoStartEnabled = false,
  autoStartCountdown = null,
  onToggleAutoStart,
  carplayMode = false,
  onToggleCarplay,
  onOpenParking,
  onOpenBorderGuide,
}: TrackTabProps) {
  // Speed alert state
  const [speedSettings, setSpeedSettings] = useState<SpeedAlertSettings>({
    speedLimit: 90,
    speedAlertEnabled: true,
    speedAlertSound: true,
  })
  const [flashOn, setFlashOn] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const hasPlayedBeepRef = useRef(false)
  const [showFeatures, setShowFeatures] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [drivingMode, setDrivingMode] = useState(false)

  // Auto-enter driving mode when tracking starts and speed > 0
  const drivingModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (isTracking && currentSpeed > 10 && !drivingMode && !isPaused) {
      // Auto-enter driving mode after 5 seconds of sustained speed > 10 km/h
      if (!drivingModeTimerRef.current) {
        drivingModeTimerRef.current = setTimeout(() => {
          setDrivingMode(true)
          drivingModeTimerRef.current = null
        }, 5000)
      }
    } else {
      // Cancel timer if speed drops or tracking stops
      if (drivingModeTimerRef.current) {
        clearTimeout(drivingModeTimerRef.current)
        drivingModeTimerRef.current = null
      }
    }
    return () => {
      if (drivingModeTimerRef.current) {
        clearTimeout(drivingModeTimerRef.current)
        drivingModeTimerRef.current = null
      }
    }
  }, [isTracking, currentSpeed, drivingMode, isPaused])
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false)
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  const [photoCount, setPhotoCount] = useState(0)

  // Voice navigation state
  const [navActive, setNavActive] = useState(false)
  const [navSteps, setNavSteps] = useState<NavStep[]>([])
  const [navStepIdx, setNavStepIdx] = useState(0)
  const [navVoiceOn, setNavVoiceOn] = useState(true)
  const [navLoading, setNavLoading] = useState(false)
  const [navDistToStep, setNavDistToStep] = useState<number | null>(null)
  const [navDestination, setNavDestination] = useState<{lat: number; lng: number; name: string} | null>(null)
  const spokenStepsRef = useRef<Set<number>>(new Set())
  const spokenProactiveRef = useRef<Map<number, Set<string>>>(new Map()) // step -> Set of distance thresholds spoken

  // BT audio hook - routes through helmet when connected
  const { isConnected: btConnected, speak: btSpeak } = useBtAudio()

  // GPS Reliability hook - wake lock, visibility, error recovery, signal quality, heartbeat
  const gpsReliability = useGpsReliability({
    isTracking,
    trackPoints,
    wakelockEnabled: wakelockEnabled ?? true,
    onRestartTracking: onStart,
  })

  // Speak a navigation instruction via BT helmet or phone speaker
  const speakNav = useCallback((text: string) => {
    if (!navVoiceOn) return
    btSpeak(text)
  }, [navVoiceOn, btSpeak])

  // Calculate distance to current nav step + auto-advance
  useEffect(() => {
    if (!navActive || navSteps.length === 0 || trackPoints.length === 0) return
    const lastPt = trackPoints[trackPoints.length - 1]
    
    // Calculate distance to current step
    if (navStepIdx < navSteps.length) {
      const step = navSteps[navStepIdx]
      const dist = haversineMeters(lastPt.lat, lastPt.lng, step.lat, step.lng)
      setNavDistToStep(Math.round(dist))
      
      // Step completion: within 30m of step = advance
      if (dist < 30 && navStepIdx < navSteps.length - 1) {
        // Look ahead for the next closest step
        let nextIdx = navStepIdx + 1
        for (let i = navStepIdx + 1; i < navSteps.length; i++) {
          const d2 = haversineMeters(lastPt.lat, lastPt.lng, navSteps[i].lat, navSteps[i].lng)
          if (d2 < 50) { nextIdx = i; break }
        }
        if (nextIdx > navStepIdx) setNavStepIdx(nextIdx)
      }
    }
  }, [navActive, navSteps, navStepIdx, trackPoints])

  // Proactive distance-based announcements (KEY: speak BEFORE reaching the turn)
  useEffect(() => {
    if (!navActive || navSteps.length === 0 || !navVoiceOn || navDistToStep === null) return
    const step = navSteps[navStepIdx]
    if (!step) return

    const thresholds = [
      { dist: getAnnounceDistance(currentSpeed), key: 'far', prefix: 'Čez' },
      { dist: currentSpeed > 60 ? 100 : 50, key: 'close', prefix: 'Čez' },
      { dist: 25, key: 'now', prefix: 'Zdaj' },
    ]

    for (const threshold of thresholds) {
      if (navDistToStep <= threshold.dist) {
        const stepSpoken = spokenProactiveRef.current.get(navStepIdx) || new Set<string>()
        if (!stepSpoken.has(threshold.key)) {
          const announcement = threshold.key === 'now'
            ? `${threshold.prefix}, ${step.instruction}`
            : `${threshold.prefix} ${formatDistSlo(navDistToStep)}, ${step.instruction}`
          speakNav(announcement)
          stepSpoken.add(threshold.key)
          spokenProactiveRef.current.set(navStepIdx, stepSpoken)
          break // Only one announcement per tick
        }
      }
    }
  }, [navActive, navSteps, navStepIdx, navVoiceOn, navDistToStep, currentSpeed, speakNav])

  // Speak confirmation when step is reached
  useEffect(() => {
    if (!navActive || navSteps.length === 0 || !navVoiceOn) return
    const step = navSteps[navStepIdx]
    if (step && !spokenStepsRef.current.has(navStepIdx)) {
      // Only speak if we haven't already spoken 'now' for this step
      const stepSpoken = spokenProactiveRef.current.get(navStepIdx)
      if (!stepSpoken || !stepSpoken.has('now')) {
        speakNav(step.instruction)
      }
      spokenStepsRef.current.add(navStepIdx)
    }
  }, [navActive, navSteps, navStepIdx, navVoiceOn, speakNav])

  // Start voice navigation to a destination
  const startNav = useCallback(async (destination?: {lat: number; lng: number; name?: string}) => {
    if (trackPoints.length < 1) { return }
    setNavLoading(true)
    try {
      const last = trackPoints[trackPoints.length - 1]
      const wpParam = `${last.lng},${last.lat}`
      
      // If destination is provided, navigate there; otherwise navigate back to start
      let destLat: number, destLng: number, destName: string
      if (destination) {
        destLat = destination.lat
        destLng = destination.lng
        destName = destination.name || 'cilj'
      } else {
        // Default: navigate back to ride start
        const start = trackPoints[0]
        destLat = start.lat
        destLng = start.lng
        destName = 'začetek vožnje'
      }
      setNavDestination({ lat: destLat, lng: destLng, name: destName })
      const destParam = `${destLng},${destLat}`
      
      // Use our own navigation API for better Slovenian instructions
      const navApiUrl = `/api/navigation?waypoints=${encodeURIComponent(JSON.stringify([{lat: last.lat, lng: last.lng}, {lat: destLat, lng: destLng}]))}`
      let steps: NavStep[] = []
      
      try {
        const navRes = await fetch(navApiUrl, { signal: AbortSignal.timeout(10000) })
        if (navRes.ok) {
          const navData = await navRes.json()
          if (navData.data?.steps) {
            steps = navData.data.steps.map((s: any) => ({
              instruction: s.instruction || 'Nadaljuj',
              distance: s.distance || 0,
              duration: s.duration || 0,
              type: s.type || 'continue',
              name: s.name || '',
              lat: s.lat,
              lng: s.lng,
            }))
          }
        }
      } catch {
        // Fallback to direct OSRM
      }
      
      // If our API failed, fall back to direct OSRM
      if (steps.length === 0) {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${wpParam};${destParam}?overview=full&steps=true&geometries=geojson`
        const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) throw new Error('Routing failed')
        const data = await res.json()
        if (!data.routes?.length) throw new Error('No route')
        const route = data.routes[0]
        steps = route.legs.flatMap((leg: any) =>
          leg.steps.map((s: any) => {
            const type = s.maneuver.type
            const mod = s.maneuver.modifier || ''
            const name = s.name || ''
            const turnWord = NAV_SLO[type] || 'Nadaljuj'
            const modSlo = MOD_SLO[mod] || mod
            const instruction = modSlo ? `${turnWord} ${modSlo}${name ? ` na ${name}` : ''}` : `${turnWord}${name ? ` na ${name}` : ''}`
            return {
              instruction: type === 'arrive' ? '📍 Prispeli ste na cilj' : instruction,
              distance: Math.round(s.distance),
              duration: Math.round(s.duration),
              type,
              name,
              lat: s.maneuver.location[1],
              lng: s.maneuver.location[0],
            }
          })
        )
      }
      
      setNavSteps(steps)
      setNavStepIdx(0)
      setNavActive(true)
      spokenStepsRef.current = new Set()
      spokenProactiveRef.current = new Map()
      setNavDistToStep(null)
      
      // Announce navigation start
      if (navVoiceOn) {
        speakNav(`Navigacija začeta. Pot do ${destName}, ${steps.length} korakov.`)
      }
    } catch {
      // Navigation not available - just track without nav
    } finally {
      setNavLoading(false)
    }
  }, [trackPoints, navVoiceOn, speakNav])

  // Fetch speed alert settings
  useEffect(() => {
    if (!userId) return
    fetch(`/api/speed-settings?userId=${userId}`)
      .then(r => r.json())
      .then(j => {
        if (j.data) {
          setSpeedSettings({
            speedLimit: j.data.speedLimit ?? 90,
            speedAlertEnabled: j.data.speedAlertEnabled ?? true,
            speedAlertSound: j.data.speedAlertSound ?? true,
          })
        }
      })
      .catch(() => {})
  }, [userId])

  // Play beep sound using Web Audio API
  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    } catch {
      // Audio not available
    }
  }, [])

  // Derived: is current speed over limit?
  const isOverSpeed = useMemo(() => {
    if (!speedSettings.speedAlertEnabled || !isTracking || isPaused) return false
    return currentSpeed > speedSettings.speedLimit
  }, [speedSettings.speedAlertEnabled, speedSettings.speedLimit, currentSpeed, isTracking, isPaused])

  // Play beep when speed crosses over the limit
  useEffect(() => {
    if (isOverSpeed && !hasPlayedBeepRef.current && speedSettings.speedAlertSound) {
      playBeep()
      hasPlayedBeepRef.current = true
    }
    if (!isOverSpeed) {
      hasPlayedBeepRef.current = false
    }
  }, [isOverSpeed, speedSettings.speedAlertSound, playBeep])

  // Flashing animation effect
  useEffect(() => {
    if (!isOverSpeed) return
    const interval = setInterval(() => {
      setFlashOn(prev => !prev)
    }, 500)
    return () => {
      clearInterval(interval)
      setFlashOn(false)
    }
  }, [isOverSpeed])

  // Speed progress percentage
  const speedPct = speedSettings.speedLimit > 0 ? Math.min(100, (currentSpeed / speedSettings.speedLimit) * 100) : 0
  const speedBarColor = isOverSpeed ? 'bg-red-500' : speedPct > 80 ? 'bg-amber-500' : 'bg-primary'

  // Convert values based on unit system
  const displaySpeed = Math.round(convertSpeed(currentSpeed, unitSystem))
  const displayMaxSpeed = Math.round(convertSpeed(maxSpeed, unitSystem))
  const displayDistance = convertDistance(distance, unitSystem)
  const speedUnitLabel = speedUnit(unitSystem)
  const distanceUnitLabel = distanceUnit(unitSystem)

  // Calculate remaining distance for nav ETA
  const navRemainingDistance = useMemo(() => {
    if (!navActive || navSteps.length === 0) return undefined
    return navSteps.slice(navStepIdx).reduce((sum, s) => sum + s.distance, 0) + (navDistToStep ?? 0)
  }, [navActive, navSteps, navStepIdx, navDistToStep])

  return (
    <div className={`relative w-full h-[calc(100vh-120px)] flex flex-col transition-all duration-200 ${
      isOverSpeed && flashOn ? 'ring-4 ring-inset ring-red-500/70' : ''
    }`}>
      {/* Feature panels toggle - when not tracking */}
      {!isTracking && (
        <div className="absolute top-2 left-2 right-2 z-[1002]">
          {/* Auto-start monitoring indicator */}
          {autoStartEnabled && (
            <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 backdrop-blur-sm border border-amber-500/25">
              <Zap className="size-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">AUTO-START</span>
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              {autoStartCountdown !== null && autoStartCountdown > 0 ? (
                <span className="text-[10px] text-amber-300 ml-auto font-mono">{autoStartCountdown}s</span>
              ) : (
                <span className="text-[10px] text-amber-400/60 ml-auto">čakam na gibanje...</span>
              )}
            </div>
          )}
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/90 backdrop-blur-sm border border-border/50 text-xs font-medium shadow-sm hover:bg-background transition-all"
          >
            {showFeatures ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            <span>Napredne funkcije</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">LIVE</Badge>
          </button>
          {showFeatures && (
            <div className="mt-2 space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              <TwistinessScore trackPoints={trackPoints} distance={distance} />
              <WeatherAlertsPanel lat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null} lng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null} isTracking={isTracking} />
              <GradientAnalysis points={trackPoints} />
              <CrashDetectionPanel userId={userId} />
              <LiveTrackingPanel userId={userId} />
              <LeanAngleDisplay currentAngle={0} userId={userId} isTracking={isTracking} />
            </div>
          )}
        </div>
      )}

      {/* Map layer */}
      <div className="flex-1 relative">
        <MotoMap center={[46.15, 14.99]} zoom={12} rides={[]} routes={[]} trackPoints={trackPoints} showTrack={true} />

        {/* Speed limit badge - top right */}
        {speedSettings.speedAlertEnabled && isTracking && (
          <div className={`absolute top-3 right-3 z-[1001] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm transition-all duration-200 ${
            isOverSpeed
              ? 'bg-red-500/90 text-white'
              : 'bg-background/80 text-muted-foreground border border-border/50'
          }`}>
            <Gauge className="size-3.5" />
            <span>{Math.round(convertSpeed(speedSettings.speedLimit, unitSystem))} {speedUnitLabel}</span>
            {isOverSpeed && <AlertTriangle className="size-3.5 ml-0.5 animate-pulse" />}
          </div>
        )}

        {/* Ride Weather Overlay - floating, below speed limit badge */}
        {isTracking && (
          <div className="absolute top-12 right-3 z-[1001] w-48">
            <RideWeatherOverlay
              lat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null}
              lng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null}
              isTracking={isTracking}
            />
          </div>
        )}

        {/* Auto-pause & WakeLock indicators - top left */}
        {isTracking && (
          <div className="absolute top-3 left-3 z-[1001] flex items-center gap-2">
            {autoPauseEnabled && isPaused && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold shadow-lg">
                <Timer className="size-3" />
                <span>AUTO-PAUSE</span>
              </div>
            )}
            {wakelockEnabled && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/60 text-[10px] font-medium">
                <Moon className="size-3" />
                <span>Zaslon ON</span>
              </div>
            )}
            {/* Driving Mode toggle */}
            <button
              onClick={() => setDrivingMode(!drivingMode)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold shadow-lg transition-colors ${
                drivingMode
                  ? 'bg-primary text-white'
                  : 'bg-white/10 backdrop-blur-sm text-white/60 hover:bg-white/20'
              }`}
              title="Driving Mode - poenostavljen vmesnik za vožnjo"
            >
              <Eye className="size-3" />
              <span>DRIVE</span>
            </button>
            {/* CarPlay Mode toggle */}
            {onToggleCarplay && (
              <button
                onClick={onToggleCarplay}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold shadow-lg transition-colors ${
                  carplayMode
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/10 backdrop-blur-sm text-white/60 hover:bg-white/20'
                }`}
                title="CarPlay način - velik vmesnik za avto/telefon na volanu"
              >
                <Monitor className="size-3" />
                <span>CAR</span>
              </button>
            )}
            {/* Parking Spot toggle */}
            {onOpenParking && (
              <button
                onClick={onOpenParking}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/80 text-white text-[10px] font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-colors active:scale-95"
                title="Parkirni spomin - kje sem parkiral?"
              >
                <MapPin className="size-3" />
                <span>🅿️</span>
              </button>
            )}
            {/* Border Guide toggle */}
            {onOpenBorderGuide && (
              <button
                onClick={onOpenBorderGuide}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/80 text-white text-[10px] font-bold shadow-lg shadow-emerald-500/30 hover:bg-emerald-500 transition-colors active:scale-95"
                title="Mejni prehodi - dokumenti, cene, časi"
              >
                <Globe className="size-3" />
                <span>MEJA</span>
              </button>
            )}
            {/* SOS Emergency button */}
            <button
              onClick={() => setShowEmergencyPanel(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500 text-white text-[10px] font-black shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors active:scale-95"
              title="Nujna pomoč - klicne številke"
            >
              <ShieldAlert className="size-3" />
              <span>SOS</span>
            </button>
          </div>
        )}

        {/* Speed alert overlay flash */}
        {isOverSpeed && flashOn && (
          <div className="absolute inset-0 z-[999] pointer-events-none bg-red-500/10" />
        )}

        {/* Road Hazard Reporter - floating button during tracking */}
        <RoadHazardReporter
          currentLat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null}
          currentLng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null}
          userId={userId}
          isTracking={isTracking}
        />

        {/* Wind Warning Panel - floating, bottom-left on map */}
        {isTracking && (
          <div className="absolute bottom-4 left-3 z-[1001] w-52">
            <WindWarningPanel
              lat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null}
              lng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null}
              isTracking={isTracking}
              heading={trackPoints.length >= 2
                ? (() => {
                    const p1 = trackPoints[trackPoints.length - 2]
                    const p2 = trackPoints[trackPoints.length - 1]
                    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180
                    const la1 = (p1.lat * Math.PI) / 180
                    const la2 = (p2.lat * Math.PI) / 180
                    const y = Math.sin(dLng) * Math.cos(la2)
                    const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
                    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
                  })()
                : undefined
              }
            />
          </div>
        )}
        {/* Voice Commands - floating mic button, bottom-right on map */}
        {isTracking && (
          <VoiceCommands
            isTracking={isTracking}
            isPaused={isPaused}
            onStartTracking={onStart}
            onStopTracking={onStop}
            onPauseTracking={onPause}
            onResumeTracking={onResume}
            onReportHazard={() => {/* hazard reporter is always visible */}}
            onOpenEmergency={() => setShowEmergencyPanel(true)}
            onSaveRide={onSave}
            currentSpeed={currentSpeed}
            currentLat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null}
            currentLng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null}
            navRemainingDistance={navRemainingDistance}
            onOpenNavigation={() => startNav()}
            className="!bottom-28"
          />
        )}
      </div>

      {/* Draggable Bottom Sheet Dashboard */}
      <Drawer
        shouldScaleBackground={false}
        snapPoints={[0.16, 0.55, 0.92]}
        defaultSnap={isTracking ? 0.55 : 0.16}
        snapToSequentialPointOnSnap={true}
      >
        <DrawerContent className="bg-black/95 backdrop-blur-xl border-t border-white/10 max-h-[92vh]">
          <DrawerTitle className="sr-only">Sledenje vožnji</DrawerTitle>
          
          {/* When not tracking - Start button */}
          {!isTracking && !trackPoints.length && (
            <div className="px-4 py-4 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Bike className="size-4" />
                <span>Pripravljen na vožnjo</span>
              </div>
              {/* Auto-start countdown display */}
              {autoStartEnabled && autoStartCountdown !== null && autoStartCountdown > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 animate-pulse">
                  <Radio className="size-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    Zaznavam gibanje... sledenje se začne čez {autoStartCountdown} s
                  </span>
                </div>
              )}
              <button
                onClick={() => setShowChecklist(true)}
                className="relative w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform"
              >
                <Play className="size-7 text-white fill-white ml-1" />
                {/* Pulse ring animation */}
                <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
              </button>
              <span className="text-white/40 text-[10px]">Pritisni za začetek</span>
              {/* Auto-start toggle */}
              {onToggleAutoStart && (
                <button
                  onClick={onToggleAutoStart}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors ${
                    autoStartEnabled
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-white/10 text-white/40 border border-white/10 hover:bg-white/15'
                  }`}
                  title="Samodejni začetek sledenja pri hitrosti > 20 km/h"
                >
                  <Zap className="size-3" />
                  <span>AUTO-START</span>
                  {autoStartEnabled && (
                    <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              )}
              {/* Pre-Ride Checklist */}
              <PreRideChecklist
                open={showChecklist}
                onClose={(skipped) => setShowChecklist(false)}
                onStartRide={() => { setShowChecklist(false); onStart() }}
              />
            </div>
          )}

          {/* When tracking - REVER dashboard */}
          {isTracking && (
            <div className="px-4 pt-3 pb-2">
              {/* Voice Navigation Banner - shows when nav is active */}
              {navActive && navSteps.length > 0 && (
                <div className="mb-2 bg-primary/15 border border-primary/25 rounded-lg p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <Navigation2 className="size-4 text-primary animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{navSteps[navStepIdx]?.instruction || 'Nadaljuj naravnost'}</p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {btConnected && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/20 text-primary" title="Bluetooth čelada povezana">
                          <Headphones className="size-3" />
                          <span className="text-[8px] font-bold">BT</span>
                        </span>
                      )}
                      <button onClick={() => setNavVoiceOn(!navVoiceOn)} className="p-1 rounded hover:bg-white/10">
                        {navVoiceOn ? <Volume2 className="size-3.5 text-primary" /> : <VolumeX className="size-3.5 text-white/30" />}
                      </button>
                    </div>
                    <button onClick={() => setNavActive(false)} className="p-1 rounded hover:bg-red-500/20 text-red-400 flex-shrink-0">
                      <Square className="size-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-white/50">
                    {navDistToStep !== null && (
                      <span className="font-bold text-primary">{navDistToStep > 1000 ? `${(navDistToStep / 1000).toFixed(1)} km` : `${navDistToStep} m`}</span>
                    )}
                    <span>Korak {navStepIdx + 1}/{navSteps.length}</span>
                    {navDestination && <span>\u2192 {navDestination.name}</span>}
                  </div>
                  {/* Upcoming steps preview */}
                  {navSteps.length > navStepIdx + 1 && (
                    <div className="bg-white/5 rounded p-1.5 space-y-0.5">
                      {navSteps.slice(navStepIdx + 1, navStepIdx + 3).map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-[9px] text-white/40">
                          <span className="bg-white/10 px-1 rounded font-mono">{s.distance > 1000 ? `${(s.distance / 1000).toFixed(1)}km` : `${s.distance}m`}</span>
                          <span className="truncate">{s.instruction}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Start Nav button - when tracking but no nav */}
              {isTracking && !navActive && trackPoints.length > 3 && !navLoading && (
                <button
                  onClick={() => startNav()}
                  className="mb-2 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <Navigation2 className="size-3.5" />
                  Zaženi navigacijo (do začetka)
                </button>
              )}
              {navLoading && (
                <div className="mb-2 flex items-center justify-center gap-2 py-1.5 rounded-lg bg-primary/10 text-primary text-xs">
                  <div className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Nalaganje navigacije...
                </div>
              )}
              {/* Timer display */}
              <div className="text-center mb-2">
                <span className="text-3xl font-mono font-bold text-white tracking-wider">{formatDuration(duration)}</span>
              </div>

              {/* Mini Elevation Profile */}
              {isTracking && trackPoints.length >= 5 && (
                <div className="mb-2">
                  <MiniElevationProfile trackPoints={trackPoints} />
                </div>
              )}

              {/* GPS Signal Quality Indicator - next to speed */}
              {isTracking && (
                <div className="flex justify-center mb-2">
                  <GpsSignalIndicator quality={gpsAccuracy !== null ? getSignalQuality(gpsAccuracy) : gpsReliability.signalQuality} accuracy={gpsAccuracy ?? gpsReliability.accuracy} />
                </div>
              )}

              {/* GPS Error notification */}
              {isTracking && gpsReliability.lastError && (
                <div className="mb-2">
                  <GpsErrorNotification lastError={gpsReliability.lastError} onRetry={() => {
                    navigator.geolocation?.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 })
                  }} />
                </div>
              )}

              {/* Stats grid - REVER style */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <p className={`text-2xl font-bold ${isOverSpeed ? 'text-red-400' : 'text-white'}`}>
                      {displaySpeed}
                    </p>
                  </div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">{speedUnitLabel}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{displayDistance.toFixed(1)}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">{distanceUnitLabel}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white/70">{displayMaxSpeed}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">max</p>
                </div>
              </div>

              {/* Speed progress bar */}
              {speedSettings.speedAlertEnabled && !isPaused && (
                <div className="mb-3">
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${speedBarColor}`}
                      style={{ width: `${speedPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Twistiness Score - real-time during ride */}
              {trackPoints.length >= 2 && (
                <div className="mb-2">
                  <TwistinessScore trackPoints={trackPoints} distance={distance} />
                </div>
              )}

              {/* Weather alerts during ride */}
              {trackPoints.length > 0 && (
                <div className="mb-2">
                  <WeatherAlertsPanel
                    lat={trackPoints[trackPoints.length - 1].lat}
                    lng={trackPoints[trackPoints.length - 1].lng}
                    isTracking={true}
                  />
                </div>
              )}

              {/* Fuel range indicator */}
              {isTracking && (
                <div className="mb-2">
                  <FuelRangeIndicator
                    userId={userId}
                    currentSpeed={currentSpeed}
                    distance={distance}
                    unitSystem={unitSystem}
                  />
                </div>
              )}

              {/* Photo gallery panel (expandable) */}
              {showPhotoGallery && (
                <div className="mb-2 max-h-64 overflow-y-auto custom-scrollbar bg-white/5 rounded-lg p-2">
                  <RidePhotoGallery
                    isTracking={isTracking}
                    currentLat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null}
                    currentLng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null}
                    trackPoints={trackPoints}
                    onPhotosChange={(p) => setPhotoCount(p.length)}
                  />
                </div>
              )}

              {/* Control buttons */}
              <div className="flex items-center justify-center gap-4 pb-1">
                {isPaused ? (
                  <button
                    onClick={onResume}
                    className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform"
                  >
                    <Play className="size-6 text-white fill-white ml-0.5" />
                  </button>
                ) : (
                  <button
                    onClick={onPause}
                    className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Pause className="size-6 text-white" />
                  </button>
                )}
                <button
                  onClick={onStop}
                  className="w-10 h-10 rounded-full bg-red-500/80 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Square className="size-4 text-white fill-white" />
                </button>
                {/* Compact photo button */}
                <PhotoButton
                  photoCount={photoCount}
                  onClick={() => setShowPhotoGallery(!showPhotoGallery)}
                />
              </div>
            </div>
          )}

          {/* When stopped with data - Save button */}
          {!isTracking && trackPoints.length > 1 && (
            <div className="px-4 py-4 flex flex-col items-center gap-2">
              <div className="grid grid-cols-3 gap-4 mb-1 w-full">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{displayDistance.toFixed(1)}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">{distanceUnitLabel}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{formatDuration(duration)}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">čas</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white/70">{displayMaxSpeed}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">max</p>
                </div>
              </div>
              {/* Twistiness Score Summary */}
              <div className="w-full">
                <TwistinessScore trackPoints={trackPoints} distance={distance} />
              </div>
              {/* Gradient Analysis Summary */}
              <div className="w-full max-h-48 overflow-y-auto custom-scrollbar">
                <GradientAnalysis points={trackPoints} />
              </div>
              {/* Ride Difficulty Calculator */}
              <div className="w-full">
                <RideDifficultyCalculator
                  distance={distance}
                  elevation={elevation}
                  trackPoints={trackPoints}
                />
              </div>
              {/* GPS Reliability Stats */}
              <div className="w-full">
                <GpsReliabilityStats state={gpsReliability.getState()} />
              </div>
              {/* Photo Gallery - collapsible after ride stop */}
              <div className="w-full">
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70"
                  onClick={() => setShowPhotoGallery(!showPhotoGallery)}
                >
                  <Camera className="size-4" />
                  <span className="text-xs font-medium">Fotografije vožnje</span>
                  {photoCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{photoCount}</Badge>
                  )}
                  <span className="ml-auto">{showPhotoGallery ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}</span>
                </button>
                {showPhotoGallery && (
                  <div className="mt-2">
                    <RidePhotoGallery
                      isTracking={false}
                      trackPoints={trackPoints}
                      currentLat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null}
                      currentLng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null}
                      onPhotosChange={(p) => setPhotoCount(p.length)}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2 w-full">
                <Button className="flex-1 gap-2 rounded-full bg-primary hover:bg-primary/90" onClick={() => { gpsReliability.submitDiagnostics(duration); onSave() }}>
                  <Save className="size-4" />Shrani vožnjo
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 rounded-full"
                  onClick={() => setShowShareCard(true)}
                >
                  <Share2 className="size-4" />Deli kartico
                </Button>
              </div>
              <RideShareCard
                open={showShareCard}
                onClose={() => setShowShareCard(false)}
                rideTitle={`Vožnja ${new Date().toLocaleDateString('sl-SI')}`}
                distance={distance}
                duration={duration}
                maxSpeed={maxSpeed}
                avgSpeed={duration > 0 ? Math.round((distance / (duration / 3600)) * 10) / 10 : 0}
                elevation={elevation}
              />
            </div>
          )}
        </DrawerContent>
      </Drawer>
      <DrivingMode
        isActive={drivingMode && isTracking}
        onToggle={() => setDrivingMode(!drivingMode)}
        currentSpeed={currentSpeed}
        maxSpeed={maxSpeed}
        distance={distance}
        duration={duration}
        elevation={elevation}
        unitSystem={unitSystem}
        navInstruction={navActive && navSteps.length > 0 ? navSteps[navStepIdx]?.instruction : undefined}
        navDistanceToStep={navDistToStep}
        navStepIdx={navStepIdx}
        navTotalSteps={navSteps.length}
        navDestination={navDestination?.name}
        navStepType={navActive && navSteps.length > 0 ? navSteps[navStepIdx]?.type : undefined}
        navRoadName={navActive && navSteps.length > 0 ? navSteps[navStepIdx]?.name || undefined : undefined}
        navRemainingDistance={navRemainingDistance}
        isTracking={isTracking}
        isPaused={isPaused}
        onStartStopTrack={isTracking ? onStop : onStart}
        speedLimit={speedSettings.speedLimit}
        isOverSpeed={isOverSpeed}
        voiceEnabled={navVoiceOn}
        onToggleVoice={() => setNavVoiceOn(!navVoiceOn)}
        currentLat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null}
        currentLng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null}
        userId={userId}
        onOpenEmergency={() => setShowEmergencyPanel(true)}
      />

      {/* Emergency Panel - quick access to emergency numbers */}
      <EmergencyPanel
        userId={userId}
        currentLat={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lat : null}
        currentLng={trackPoints.length > 0 ? trackPoints[trackPoints.length - 1].lng : null}
        isOpen={showEmergencyPanel}
        onClose={() => setShowEmergencyPanel(false)}
      />
    </div>
  )
}
