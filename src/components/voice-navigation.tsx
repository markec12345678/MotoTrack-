'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Navigation2, Volume2, VolumeX, X, SkipForward, Loader2, AlertTriangle, Reroute } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// ===== TYPES =====

interface NavStep {
  instruction: string
  instructionSlo: string
  distance: number
  duration: number
  type: string
  name: string
  location: [number, number]
}

interface NavRoute {
  distance: number
  duration: number
  steps: NavStep[]
  geometry: [number, number][]
}

interface VoiceNavigationProps {
  isActive: boolean
  route: NavRoute | null
  currentLat: number | null
  currentLng: number | null
  currentSpeed: number
  currentHeading?: number
  onClose: () => void
  onReroute?: () => void
}

// ===== DISTANCE FORMATTING =====

function formatDistanceSlo(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000
    return km >= 10 ? `${Math.round(km)} kilometrov` : `${km.toFixed(1).replace('.0', '')} kilometrov`
  }
  if (meters >= 100) return `${Math.round(meters / 10) * 10} metrov`
  if (meters >= 50) return '50 metrov'
  return `${Math.round(meters / 10) * 10} metrov`
}

// ===== Haversine distance =====

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ===== Proactive announcement thresholds (based on speed) =====

function getAnnouncementDistances(speedKmh: number): number[] {
  // At higher speeds, announce further in advance
  if (speedKmh > 100) return [500, 200, 50]  // highway speed
  if (speedKmh > 60) return [300, 100, 30]    // rural road speed
  return [150, 50, 20]                          // city speed
}

// ===== MAIN COMPONENT =====

export default function VoiceNavigation({
  isActive, route, currentLat, currentLng, currentSpeed, currentHeading, onClose, onReroute,
}: VoiceNavigationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [useTTSEngine, setUseTTSEngine] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [isOffRoute, setIsOffRoute] = useState(false)
  const [distanceToNextStep, setDistanceToNextStep] = useState<number | null>(null)
  const [bearingToNextStep, setBearingToNextStep] = useState<number | null>(null)
  const spokenStepsRef = useRef<Set<number>>(new Set())
  const spokenProactiveRef = useRef<Map<number, Set<number>>>(new Map()) // step -> Set of threshold index
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const routeRef = useRef(route)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const offRouteCounterRef = useRef(0)
  const lastPositionRef = useRef<{ lat: number; lng: number; ts: number } | null>(null)

  // Keep routeRef in sync
  useEffect(() => { routeRef.current = route }, [route])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
        audioRef.current = null
      }
    }
  }, [])

  // ===== Browser TTS =====
  const speakBrowser = useCallback((text: string) => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'sl-SI'
    utter.rate = 0.9
    utter.volume = 1.0
    const voices = synthRef.current.getVoices()
    const slVoice = voices.find(v => v.lang.startsWith('sl'))
    if (slVoice) utter.voice = slVoice
    synthRef.current.speak(utter)
  }, [])

  // ===== AI TTS via API =====
  const speakAI = useCallback(async (text: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }

    setTtsLoading(true)
    try {
      const cleanText = text.replace(/[^\w\sčšžČŠŽ.,!?:\-]/g, '').slice(0, 500)
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, speed: 1.1, voice: 'tongtong' }),
      })

      if (res.ok) {
        const audioBlob = await res.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        audioRef.current = audio
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          audioRef.current = null
        }
        audio.play()
      } else {
        speakBrowser(text)
      }
    } catch {
      speakBrowser(text)
    } finally {
      setTtsLoading(false)
    }
  }, [speakBrowser])

  // ===== Unified speak function =====
  const speak = useCallback((text: string) => {
    if (!voiceEnabled) return
    if (useTTSEngine) {
      speakAI(text)
    } else {
      speakBrowser(text)
    }
  }, [useTTSEngine, speakAI, speakBrowser, voiceEnabled])

  // ===== Calculate distance and bearing to next step =====
  useEffect(() => {
    if (!isActive || !route || !currentLat || !currentLng) return
    const steps = route.steps
    if (steps.length === 0 || currentStep >= steps.length) return

    const [sLat, sLng] = steps[currentStep].location
    const dist = haversineMeters(currentLat, currentLng, sLat, sLng)
    setDistanceToNextStep(Math.round(dist))

    // Calculate bearing
    const dLng = ((sLng - currentLng) * Math.PI) / 180
    const lat1Rad = (currentLat * Math.PI) / 180
    const lat2Rad = (sLat * Math.PI) / 180
    const y = Math.sin(dLng) * Math.cos(lat2Rad)
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
    const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
    setBearingToNextStep(Math.round(bearing))
  }, [isActive, route, currentLat, currentLng, currentStep])

  // ===== Auto-advance navigation step based on GPS proximity =====
  useEffect(() => {
    if (!isActive || !route || !currentLat || !currentLng) return
    const steps = route.steps
    if (steps.length === 0) return

    // Only look at steps from currentStep onwards (can't go backwards)
    let closestIdx = -1
    let closestDist = Infinity

    for (let i = currentStep; i < steps.length; i++) {
      const [sLat, sLng] = steps[i].location
      const d = haversineMeters(currentLat, currentLng, sLat, sLng)
      if (d < closestDist) {
        closestDist = d
        closestIdx = i
      }
    }

    // Step completion threshold: within 30m of the step location
    if (closestDist < 30 && closestIdx >= 0 && closestIdx > currentStep) {
      setCurrentStep(closestIdx)
    }
  }, [isActive, route, currentLat, currentLng, currentStep])

  // ===== Proactive distance announcements (KEY FEATURE for motorcyclists) =====
  useEffect(() => {
    if (!isActive || !route || !voiceEnabled || distanceToNextStep === null) return
    const steps = route.steps
    if (steps.length === 0 || currentStep >= steps.length) return

    const step = steps[currentStep]
    if (!step) return

    const thresholds = getAnnouncementDistances(currentSpeed)
    const dist = distanceToNextStep

    // Check each threshold
    for (let i = 0; i < thresholds.length; i++) {
      const threshold = thresholds[i]
      if (dist <= threshold && dist > (thresholds[i + 1] || 0)) {
        // Check if we already spoke this threshold for this step
        const stepSpoken = spokenProactiveRef.current.get(currentStep) || new Set()
        if (!stepSpoken.has(i)) {
          // Build proactive announcement
          let announcement = ''
          if (i === 0) {
            // Far announcement: "Čez 500 metrov zavijte desno"
            announcement = `Čez ${formatDistanceSlo(threshold)}, ${step.instructionSlo || step.instruction}`
          } else if (i === 1) {
            // Close announcement: "Čez 100 metrov zavijte desno"
            announcement = `Čez ${formatDistanceSlo(threshold)}, ${step.instructionSlo || step.instruction}`
          } else {
            // At the turn: "Zdaj zavijte desno"
            announcement = `Zdaj, ${step.instructionSlo || step.instruction}`
          }
          speak(announcement)
          stepSpoken.add(i)
          spokenProactiveRef.current.set(currentStep, stepSpoken)
          break // Only announce one threshold at a time
        }
      }
    }
  }, [isActive, route, voiceEnabled, distanceToNextStep, currentSpeed, currentStep, speak])

  // ===== Speak when step is reached (final confirmation) =====
  useEffect(() => {
    if (!isActive || !route || !voiceEnabled) return
    const step = route.steps[currentStep]
    if (step && !spokenStepsRef.current.has(currentStep)) {
      // Only speak if we haven't already spoken the "at turn" announcement
      const stepSpoken = spokenProactiveRef.current.get(currentStep)
      if (!stepSpoken || !stepSpoken.has(2)) {
        speak(step.instructionSlo || step.instruction)
      }
      spokenStepsRef.current = new Set(spokenStepsRef.current).add(currentStep)
    }
  }, [isActive, route, currentStep, speak, voiceEnabled])

  // ===== Off-route detection =====
  useEffect(() => {
    if (!isActive || !route || !currentLat || !currentLng) return

    // Check if current position is far from the route geometry
    const geometry = route.geometry
    if (geometry.length === 0) return

    let minDist = Infinity
    // Sample every 10th point for performance
    for (let i = 0; i < geometry.length; i += 10) {
      const [gLat, gLng] = geometry[i]
      const d = haversineMeters(currentLat, currentLng, gLat, gLng)
      if (d < minDist) minDist = d
    }

    // Off-route if more than 100m from route line
    if (minDist > 100) {
      offRouteCounterRef.current++
      if (offRouteCounterRef.current >= 3) { // 3 consecutive readings = confirmed off-route
        setIsOffRoute(true)
        if (offRouteCounterRef.current === 3) {
          speak('Ste zapustili načrtovano pot. Preračunam ruto.')
        }
      }
    } else {
      offRouteCounterRef.current = 0
      setIsOffRoute(false)
    }
  }, [isActive, route, currentLat, currentLng, speak])

  // ===== Track position for sanity checks =====
  useEffect(() => {
    if (!currentLat || !currentLng) return
    const now = Date.now()
    const last = lastPositionRef.current
    if (last) {
      const dist = haversineMeters(currentLat, currentLng, last.lat, last.lng)
      const timeDiff = (now - last.ts) / 1000
      // GPS sanity: reject jumps > 500m in < 2s (GPS glitch)
      if (dist > 500 && timeDiff < 2) {
        console.warn('[VoiceNav] GPS glitch detected, ignoring position jump')
        return
      }
    }
    lastPositionRef.current = { lat: currentLat, lng: currentLng, ts: now }
  }, [currentLat, currentLng])

  // ===== Reset when route changes =====
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentStep(0)
      spokenStepsRef.current = new Set()
      spokenProactiveRef.current = new Map()
      offRouteCounterRef.current = 0
      setIsOffRoute(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [route])

  if (!isActive || !route) return null

  const steps = route.steps
  const step = steps[currentStep]
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0
  const isArrived = currentStep >= steps.length - 1 && distanceToNextStep !== null && distanceToNextStep < 30

  return (
    <div className="absolute bottom-36 left-3 right-3 z-[1002]">
      <div className={`border rounded-xl p-3 space-y-2 backdrop-blur-md transition-colors ${
        isOffRoute
          ? 'bg-amber-500/15 border-amber-500/30'
          : isArrived
            ? 'bg-emerald-500/15 border-emerald-500/30'
            : 'bg-primary/10 border-primary/20'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOffRoute ? (
              <AlertTriangle className="size-4 text-amber-500 animate-pulse" />
            ) : isArrived ? (
              <Navigation2 className="size-4 text-emerald-500" />
            ) : (
              <Navigation2 className="size-4 text-primary animate-pulse" />
            )}
            <span className={`text-xs font-bold uppercase tracking-wider ${
              isOffRoute ? 'text-amber-500' : isArrived ? 'text-emerald-500' : 'text-primary'
            }`}>
              {isOffRoute ? 'Zunaj rute' : isArrived ? 'Prispeli!' : 'Navigacija'}
            </span>
            {ttsLoading && <Loader2 className="size-3 text-primary animate-spin" />}
          </div>
          <div className="flex items-center gap-1">
            {/* TTS engine toggle */}
            <button
              onClick={() => setUseTTSEngine(!useTTSEngine)}
              className={`p-1 rounded transition-colors text-[9px] font-medium ${useTTSEngine ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
              title={useTTSEngine ? 'AI glas (kakovostnejši)' : 'Brskalnikov glas (hitrejši)'}
            >
              {useTTSEngine ? 'AI🔊' : '🔊'}
            </button>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              {voiceEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5 text-muted-foreground" />}
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors">
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Off-route banner */}
        {isOffRoute && onReroute && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1 text-xs gap-1 bg-amber-500 hover:bg-amber-600"
              onClick={onReroute}
            >
              <Reroute className="size-3" />
              Preračunaj ruto
            </Button>
          </div>
        )}

        {/* Current instruction */}
        {step && (
          <div className={`rounded-lg p-2.5 ${isOffRoute ? 'bg-amber-500/10' : 'bg-background'}`}>
            <p className="text-sm font-medium">
              {isArrived ? '📍 Prispeli ste na cilj!' : step.instructionSlo || step.instruction}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {distanceToNextStep !== null && !isArrived && (
                <span className="font-medium text-primary">
                  {distanceToNextStep > 1000
                    ? `${(distanceToNextStep / 1000).toFixed(1)} km`
                    : `${distanceToNextStep} m`}
                </span>
              )}
              <span>Korak {currentStep + 1}/{steps.length}</span>
              {currentSpeed > 0 && <span>{currentSpeed} km/h</span>}
            </div>
          </div>
        )}

        {/* Upcoming steps preview */}
        {steps.length > currentStep + 1 && (
          <div className="bg-background/50 rounded-md p-2 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Naslednji koraki</p>
            {steps.slice(currentStep + 1, currentStep + 3).map((s, i) => (
              <div key={currentStep + 1 + i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                  {s.distance > 1000 ? `${(s.distance / 1000).toFixed(1)}km` : `${Math.round(s.distance)}m`}
                </span>
                <span className="truncate">{s.instructionSlo || s.instruction}</span>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 text-xs gap-1"
            onClick={() => {
              if (currentStep < steps.length - 1) {
                const next = currentStep + 1
                setCurrentStep(next)
                // Clear proactive spoken for next step so it can re-announce
                const stepSpoken = spokenProactiveRef.current.get(next)
                if (stepSpoken) stepSpoken.clear()
                if (voiceEnabled) speak(steps[next]?.instructionSlo || steps[next]?.instruction || '')
              }
            }}
            disabled={currentStep >= steps.length - 1}
          >
            <SkipForward className="size-3" /> Naslednji korak
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1"
            onClick={() => {
              if (step && voiceEnabled) speak(step.instructionSlo || step.instruction)
            }}
            disabled={ttsLoading}
          >
            {ttsLoading ? <Loader2 className="size-3 animate-spin" /> : <Volume2 className="size-3" />}
            Ponovi
          </Button>
        </div>

        <Progress value={progress} className="h-1.5" />

        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Skupaj: {route.distance > 1000 ? `${(route.distance / 1000).toFixed(1)} km` : `${Math.round(route.distance)} m`}</span>
          <span>~{Math.round(route.duration / 60)} min</span>
        </div>
      </div>
    </div>
  )
}
