'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Play, Pause, Square, Save, Gauge, AlertTriangle, ChevronDown, ChevronUp, Activity, Bike, Moon, Timer, Share2, Navigation2, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TrackPoint, SpeedAlertSettings } from '@/components/tabs/types'
import { formatDuration } from '@/components/tabs/types'
import { type UnitSystem, convertSpeed, convertDistance, speedUnit, distanceUnit } from '@/hooks/use-settings'

const CrashDetectionPanel = dynamic(() => import('@/components/crash-detection-panel'), { ssr: false })
const LiveTrackingPanel = dynamic(() => import('@/components/live-tracking-panel'), { ssr: false })
const LeanAngleDisplay = dynamic(() => import('@/components/lean-angle-display'), { ssr: false })
const WeatherAlertsPanel = dynamic(() => import('@/components/weather-alerts-panel'), { ssr: false })
const GradientAnalysis = dynamic(() => import('@/components/gradient-analysis'), { ssr: false })
const TwistinessScore = dynamic(() => import('@/components/twistiness-score'), { ssr: false })
const RideShareCard = dynamic(() => import('@/components/ride-share-card'), { ssr: false })
const PreRideChecklist = dynamic(() => import('@/components/pre-ride-checklist'), { ssr: false })

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

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

interface TrackTabProps {
  isTracking: boolean
  isPaused: boolean
  trackPoints: TrackPoint[]
  duration: number
  distance: number
  maxSpeed: number
  currentSpeed: number
  elevation: number
  userId?: string
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSave: () => void
  unitSystem?: UnitSystem
  autoPauseEnabled?: boolean
  wakelockEnabled?: boolean
}

export default function TrackTab({
  isTracking, isPaused, trackPoints, duration,
  distance, maxSpeed, currentSpeed, elevation,
  userId,
  onStart, onPause, onResume, onStop, onSave,
  unitSystem = 'metric',
  autoPauseEnabled = true,
  wakelockEnabled = true,
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

  // Voice navigation state
  const [navActive, setNavActive] = useState(false)
  const [navSteps, setNavSteps] = useState<NavStep[]>([])
  const [navStepIdx, setNavStepIdx] = useState(0)
  const [navVoiceOn, setNavVoiceOn] = useState(true)
  const [navLoading, setNavLoading] = useState(false)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const spokenStepsRef = useRef<Set<number>>(new Set())

  // Init speech synthesis for voice navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  // Speak a navigation instruction
  const speakNav = useCallback((text: string) => {
    if (!synthRef.current || !navVoiceOn) return
    synthRef.current.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'sl-SI'
    utter.rate = 0.95
    const voices = synthRef.current.getVoices()
    const slVoice = voices.find(v => v.lang.startsWith('sl'))
    if (slVoice) utter.voice = slVoice
    synthRef.current.speak(utter)
  }, [navVoiceOn])

  // Auto-advance nav step based on GPS proximity during tracking
  useEffect(() => {
    if (!navActive || navSteps.length === 0 || trackPoints.length === 0) return
    const lastPt = trackPoints[trackPoints.length - 1]
    let closestIdx = -1
    let closestDist = Infinity
    for (let i = navStepIdx; i < navSteps.length; i++) {
      const d = Math.sqrt((lastPt.lat - navSteps[i].lat) ** 2 + (lastPt.lng - navSteps[i].lng) ** 2)
      if (d < closestDist) { closestDist = d; closestIdx = i }
    }
    // If within ~50m of a step, advance to it
    if (closestDist < 0.0005 && closestIdx > navStepIdx) {
      setNavStepIdx(closestIdx)
    }
  }, [navActive, navSteps, navStepIdx, trackPoints])

  // Speak when nav step advances
  useEffect(() => {
    if (!navActive || navSteps.length === 0 || !navVoiceOn) return
    const step = navSteps[navStepIdx]
    if (step && !spokenStepsRef.current.has(navStepIdx)) {
      speakNav(step.instruction)
      spokenStepsRef.current.add(navStepIdx)
    }
  }, [navActive, navSteps, navStepIdx, navVoiceOn, speakNav])

  // Start voice navigation (fetch route from OSRM)
  const startNav = useCallback(async () => {
    if (trackPoints.length < 2) { return }
    setNavLoading(true)
    try {
      // Use last 2 points or current position to estimate destination
      const last = trackPoints[trackPoints.length - 1]
      const wpParam = `${last.lng},${last.lat}`
      // Get nearby POIs or just navigate back to start
      const start = trackPoints[0]
      const startParam = `${start.lng},${start.lat}`
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${wpParam};${startParam}?overview=full&steps=true&geometries=geojson`
      const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error('Routing failed')
      const data = await res.json()
      if (!data.routes?.length) throw new Error('No route')
      const route = data.routes[0]
      const steps: NavStep[] = route.legs.flatMap((leg: any) =>
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
      setNavSteps(steps)
      setNavStepIdx(0)
      setNavActive(true)
      spokenStepsRef.current = new Set()
    } catch {
      // Navigation not available - just track without nav
    } finally {
      setNavLoading(false)
    }
  }, [trackPoints])

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

  return (
    <div className={`relative w-full h-[calc(100vh-120px)] flex flex-col transition-all duration-200 ${
      isOverSpeed && flashOn ? 'ring-4 ring-inset ring-red-500/70' : ''
    }`}>
      {/* Feature panels toggle - when not tracking */}
      {!isTracking && (
        <div className="absolute top-2 left-2 right-2 z-[1002]">
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
          </div>
        )}

        {/* Speed alert overlay flash */}
        {isOverSpeed && flashOn && (
          <div className="absolute inset-0 z-[999] pointer-events-none bg-red-500/10" />
        )}
      </div>

      {/* REVER-style Dark Dashboard Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">
        {/* Dark glass panel */}
        <div className="bg-black/90 backdrop-blur-xl border-t border-white/10">
          
          {/* When not tracking - Start button */}
          {!isTracking && !trackPoints.length && (
            <div className="px-4 py-4 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Bike className="size-4" />
                <span>Pripravljen na vožnjo</span>
              </div>
              <button
                onClick={() => setShowChecklist(true)}
                className="relative w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform"
              >
                <Play className="size-7 text-white fill-white ml-1" />
                {/* Pulse ring animation */}
                <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
              </button>
              <span className="text-white/40 text-[10px]">Pritisni za začetek</span>
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
                <div className="mb-2 bg-primary/15 border border-primary/25 rounded-lg p-2 flex items-center gap-2">
                  <Navigation2 className="size-4 text-primary animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{navSteps[navStepIdx]?.instruction || 'Nadaljuj naravnost'}</p>
                    <p className="text-[10px] text-white/40">{navSteps[navStepIdx]?.distance > 1000 ? `${(navSteps[navStepIdx].distance / 1000).toFixed(1)} km` : `${navSteps[navStepIdx]?.distance || 0} m`} · Korak {navStepIdx + 1}/{navSteps.length}</p>
                  </div>
                  <button onClick={() => setNavVoiceOn(!navVoiceOn)} className="p-1 rounded hover:bg-white/10 flex-shrink-0">
                    {navVoiceOn ? <Volume2 className="size-3.5 text-primary" /> : <VolumeX className="size-3.5 text-white/30" />}
                  </button>
                  <button onClick={() => setNavActive(false)} className="p-1 rounded hover:bg-red-500/20 text-red-400 flex-shrink-0">
                    <Square className="size-3" />
                  </button>
                </div>
              )}
              {/* Start Nav button - when tracking but no nav */}
              {isTracking && !navActive && trackPoints.length > 5 && !navLoading && (
                <button
                  onClick={startNav}
                  className="mb-2 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <Navigation2 className="size-3.5" />
                  Zaženi navigacijo do začetka
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

              {/* Stats grid - REVER style */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className={`text-2xl font-bold ${isOverSpeed ? 'text-red-400' : 'text-white'}`}>
                    {displaySpeed}
                  </p>
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
              <div className="flex gap-2 w-full">
                <Button className="flex-1 gap-2 rounded-full bg-primary hover:bg-primary/90" onClick={onSave}>
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
        </div>
      </div>
    </div>
  )
}
