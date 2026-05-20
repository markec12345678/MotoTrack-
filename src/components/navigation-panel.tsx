'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { NavigationRoute, NavigationStep } from '@/components/tabs/types'
import { playBeep } from '@/lib/audio'
import {
  Navigation,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Square,
  MapPin,
  Clock,
  Route as RouteIcon,
  CornerUpLeft,
  CornerUpRight,
  Circle,
  Siren,
  Crosshair,
  Bell,
  BellRing,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

interface NavigationPanelProps {
  route: NavigationRoute | null
  onStartNavigation?: () => void
  onStopNavigation?: () => void
  onUserPositionChange?: (pos: { lat: number; lng: number } | null) => void
  onRecalculateRoute?: (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => void
}

// Base proximity thresholds (adjusted for motorcycle speeds)
const BASE_PROXIMITY_THRESHOLD = 80   // meters — auto-advance to next step
const BASE_APPROACH_THRESHOLD = 200   // meters — play alert sound
const OFF_ROUTE_THRESHOLD = 200       // meters — off-route detection
const OFF_ROUTE_DURATION = 10000      // ms — must be off-route this long before recalculating

/**
 * Speed-adaptive proximity threshold
 * At higher speeds, riders need more advance warning
 */
function getAdaptiveProximityThreshold(speedKmh: number): number {
  if (speedKmh < 30) return 50    // City speed: 50m is sufficient
  if (speedKmh <= 80) return 80   // Normal riding: 80m (~3.5s at 80km/h)
  return 120                       // Highway: 120m (~5.4s at 120km/h)
}

function getAdaptiveApproachThreshold(speedKmh: number): number {
  if (speedKmh < 30) return 120
  if (speedKmh <= 80) return 200   // ~9s at 80km/h
  return 300                        // ~9s at 120km/h
}

function getTurnIcon(type: string) {
  switch (type) {
    case 'left':
      return <CornerUpLeft className="h-8 w-8" />
    case 'slight_left':
      return <CornerUpLeft className="h-8 w-8 opacity-70" />
    case 'sharp_left':
      return <CornerUpLeft className="h-8 w-8 text-red-500" />
    case 'right':
      return <CornerUpRight className="h-8 w-8" />
    case 'slight_right':
      return <CornerUpRight className="h-8 w-8 opacity-70" />
    case 'sharp_right':
      return <CornerUpRight className="h-8 w-8 text-red-500" />
    case 'straight':
      return <ArrowUp className="h-8 w-8" />
    case 'roundabout':
      return <RotateCcw className="h-8 w-8" />
    case 'arrive':
      return <MapPin className="h-8 w-8 text-emerald-500" />
    default:
      return <ArrowUp className="h-8 w-8" />
  }
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

function formatETA(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

/**
 * Haversine distance between two points in meters
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Find the minimum distance from a point to any step on the route
 */
function distanceToRoute(
  pos: { lat: number; lng: number },
  steps: NavigationStep[]
): number {
  let minDist = Infinity
  for (const step of steps) {
    const targetLat = step.coords ? step.coords[1] : step.lat
    const targetLng = step.coords ? step.coords[0] : step.lng
    const dist = haversineDistance(pos.lat, pos.lng, targetLat, targetLng)
    if (dist < minDist) minDist = dist
  }
  return minDist
}

export default function NavigationPanel({
  route,
  onStartNavigation,
  onStopNavigation,
  onUserPositionChange,
  onRecalculateRoute,
}: NavigationPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Proximity-based navigation state
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [followMyPosition, setFollowMyPosition] = useState(false)
  const lastAlertTimeRef = useRef<number>(0)
  // Use ref to hold current step index for the GPS callback
  const currentStepIndexRef = useRef(0)
  const routeRef = useRef<NavigationRoute | null>(null)

  // Speed tracking for adaptive proximity
  const [currentSpeed, setCurrentSpeed] = useState(0) // km/h
  const lastPositionRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null)

  // Off-route detection
  const [isOffRoute, setIsOffRoute] = useState(false)
  const offRouteStartRef = useRef<number>(0)
  const [isRecalculating, setIsRecalculating] = useState(false)

  // Adaptive thresholds based on current speed
  const proximityThreshold = useMemo(() => getAdaptiveProximityThreshold(currentSpeed), [currentSpeed])
  const approachThreshold = useMemo(() => getAdaptiveApproachThreshold(currentSpeed), [currentSpeed])

  // Keep refs in sync
  useEffect(() => { currentStepIndexRef.current = currentStepIndex }, [currentStepIndex])
  useEffect(() => { routeRef.current = route ?? null }, [route])

  const currentStep: NavigationStep | null = route?.steps[currentStepIndex] ?? null

  // Derived: distance to next step
  const distanceToNext = useMemo(() => {
    if (!userPosition || !route) return null
    const step = route.steps[currentStepIndex]
    if (!step) return null
    const targetLat = step.coords ? step.coords[1] : step.lat
    const targetLng = step.coords ? step.coords[0] : step.lng
    return Math.round(haversineDistance(userPosition.lat, userPosition.lng, targetLat, targetLng))
  }, [userPosition, route, currentStepIndex])

  // Derived: approaching alert
  const approachingAlert = useMemo(() => {
    if (distanceToNext === null) return false
    return distanceToNext < approachThreshold && distanceToNext >= proximityThreshold
  }, [distanceToNext, proximityThreshold, approachThreshold])

  // Notify parent of position changes
  useEffect(() => {
    onUserPositionChange?.(userPosition)
  }, [userPosition, onUserPositionChange])

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === 'undefined') return
    try {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'sl-SI'
      utterance.rate = 0.9
      window.speechSynthesis?.speak(utterance)
    } catch { /* speechSynthesis not available on some mobile browsers */ }
  }, [voiceEnabled])

  useEffect(() => {
    if (isNavigating && currentStep) {
      speak(currentStep.instruction)
    }
  }, [currentStepIndex, isNavigating, currentStep, speak])

  useEffect(() => {
    if (isNavigating) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isNavigating])

  // Play approach alert sound (side effect based on distanceToNext)
  useEffect(() => {
    if (!approachingAlert || !isNavigating) return
    const now = Date.now()
    if (now - lastAlertTimeRef.current > 5000) {
      lastAlertTimeRef.current = now
      playBeep(800, 0.15, 0.1)
    }
  }, [approachingAlert, isNavigating])

  // Auto-recalculate when off-route for more than 10 seconds
  useEffect(() => {
    if (!isOffRoute || !isNavigating || !route || !onRecalculateRoute || isRecalculating) return

    const timer = setTimeout(() => {
      // Find the next waypoint (current step target)
      const nextStep = route.steps[currentStepIndexRef.current]
      if (userPosition && nextStep) {
        const targetLat = nextStep.coords ? nextStep.coords[1] : nextStep.lat
        const targetLng = nextStep.coords ? nextStep.coords[0] : nextStep.lng

        setIsRecalculating(true)
        onRecalculateRoute(userPosition, { lat: targetLat, lng: targetLng })

        // Reset after a delay to avoid repeated recalculations
        setTimeout(() => {
          setIsRecalculating(false)
          setIsOffRoute(false)
          offRouteStartRef.current = 0
        }, 5000)
      }
    }, OFF_ROUTE_DURATION)

    return () => clearTimeout(timer)
  }, [isOffRoute, isNavigating, route, userPosition, onRecalculateRoute, isRecalculating])

  // Watch GPS position when navigating, with proximity-based auto-advance
  useEffect(() => {
    if (!isNavigating || !route) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserPosition(newPos)

        // Calculate speed from GPS or position delta
        const gpsSpeed = pos.coords.speed // m/s, may be null
        if (gpsSpeed !== null && gpsSpeed >= 0) {
          setCurrentSpeed(gpsSpeed * 3.6) // Convert m/s to km/h
        } else if (lastPositionRef.current) {
          // Fallback: calculate speed from position changes
          const dt = (Date.now() - lastPositionRef.current.timestamp) / 1000
          if (dt > 0) {
            const dist = haversineDistance(
              lastPositionRef.current.lat, lastPositionRef.current.lng,
              newPos.lat, newPos.lng
            )
            const speedMs = dist / dt
            setCurrentSpeed(speedMs * 3.6) // Convert m/s to km/h
          }
        }
        lastPositionRef.current = { ...newPos, timestamp: Date.now() }

        // Use current adaptive threshold (from ref to avoid stale closure)
        const step = route.steps[currentStepIndexRef.current]
        if (step) {
          const targetLat = step.coords ? step.coords[1] : step.lat
          const targetLng = step.coords ? step.coords[0] : step.lng
          const distance = haversineDistance(newPos.lat, newPos.lng, targetLat, targetLng)

          // Get adaptive threshold (we need to compute it here with latest speed)
          const speedKmh = gpsSpeed !== null ? gpsSpeed * 3.6 : currentSpeed
          const adaptiveProximity = getAdaptiveProximityThreshold(speedKmh)

          if (distance < adaptiveProximity && currentStepIndexRef.current < route.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1)
          }

          // Off-route detection
          const distToRoute = distanceToRoute(newPos, route.steps)
          if (distToRoute > OFF_ROUTE_THRESHOLD) {
            if (!offRouteStartRef.current) {
              offRouteStartRef.current = Date.now()
            }
            setIsOffRoute(true)
          } else {
            setIsOffRoute(false)
            offRouteStartRef.current = 0
          }
        }
      },
      () => {
        // Silently ignore GPS errors
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [isNavigating, route, currentSpeed])

  const handleStart = () => {
    setIsNavigating(true)
    setCurrentStepIndex(0)
    setElapsedTime(0)
    setFollowMyPosition(true)
    setIsOffRoute(false)
    setLastAlertTimeRef(0)
    setCurrentSpeed(0)
    offRouteStartRef.current = 0
    onStartNavigation?.()
  }

  const setLastAlertTimeRef = (val: number) => {
    lastAlertTimeRef.current = val
  }

  const handleStop = () => {
    setIsNavigating(false)
    setElapsedTime(0)
    setUserPosition(null)
    setFollowMyPosition(false)
    setIsOffRoute(false)
    setCurrentSpeed(0)
    offRouteStartRef.current = 0
    onStopNavigation?.()
    window.speechSynthesis?.cancel()
  }

  const handleNextStep = () => {
    if (route && currentStepIndex < route.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }

  if (!route) return null

  const remainingSteps = route.steps.length - currentStepIndex - 1
  const remainingDistance = route.steps.slice(currentStepIndex + 1).reduce((sum, s) => sum + s.distance, 0)
  const remainingDuration = route.steps.slice(currentStepIndex + 1).reduce((sum, s) => sum + s.duration, 0)

  return (
    <div className="absolute bottom-20 left-2 right-2 z-[1000] sm:left-4 sm:right-auto sm:w-96">
      <Card className="border-2 border-amber-500/50 bg-background/95 shadow-xl backdrop-blur-sm">
        {/* Header - always visible */}
        <div
          className="flex items-center justify-between p-3 cursor-pointer"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-sm">
              {isNavigating ? 'Navigacija aktivna' : 'Navigacija'}
            </span>
            {isNavigating && (
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                V ŽIVO
              </Badge>
            )}
            {isNavigating && userPosition && (
              <Badge variant="outline" className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-xs">
                GPS
              </Badge>
            )}
            {isOffRoute && (
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-xs animate-pulse">
                IZVEN POTI
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Pulsing dot for user position — shown when navigating with GPS */}
        {isNavigating && userPosition && followMyPosition && (
          <div className="flex items-center gap-2 px-3 pb-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
            </span>
            <span className="text-xs text-sky-500 font-medium">
              Sledim položaju: {userPosition.lat.toFixed(4)}, {userPosition.lng.toFixed(4)}
            </span>
            {currentSpeed > 0 && (
              <span className="text-xs text-amber-500 font-medium ml-2">
                {Math.round(currentSpeed)} km/h
              </span>
            )}
          </div>
        )}

        {/* Off-route warning banner */}
        {isOffRoute && isNavigating && (
          <div className="mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40">
            <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse shrink-0" />
            <span className="text-xs font-medium text-red-400">
              {isRecalculating ? 'Preračunavam pot...' : 'Izven poti! Prilagajanje čez nekaj sekund...'}
            </span>
            {isRecalculating && (
              <RefreshCw className="h-3.5 w-3.5 text-red-400 animate-spin shrink-0" />
            )}
          </div>
        )}

        {!isMinimized && (
          <CardContent className="px-3 pb-3 pt-0 space-y-3">
            {isNavigating && currentStep ? (
              <>
                {/* Current instruction */}
                <div className={`flex items-center gap-4 rounded-lg p-3 border ${
                  isOffRoute
                    ? 'bg-red-500/20 border-red-500/50'
                    : approachingAlert
                    ? 'bg-amber-500/20 border-amber-500/50 animate-pulse'
                    : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                  <div className="flex-shrink-0 text-amber-500">
                    {getTurnIcon(currentStep.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{currentStep.instruction}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentStep.name && `${currentStep.name} · `}
                      {formatDistance(currentStep.distance)}
                    </p>
                    {/* Distance to next turn */}
                    {distanceToNext !== null && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {approachingAlert ? (
                          <BellRing className="h-3.5 w-3.5 text-amber-500 animate-bounce" />
                        ) : (
                          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className={`text-xs font-semibold ${
                          distanceToNext < proximityThreshold
                            ? 'text-emerald-500'
                            : distanceToNext < approachThreshold
                            ? 'text-amber-500'
                            : 'text-muted-foreground'
                        }`}>
                          {distanceToNext < proximityThreshold
                            ? 'Na ciljnem koraku!'
                            : `${formatDistance(distanceToNext)} do naslednjega zavoja`
                          }
                        </span>
                      </div>
                    )}
                    {/* Speed-adaptive threshold indicator */}
                    {currentSpeed > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Prilagojeno za {Math.round(currentSpeed)} km/h (±{proximityThreshold}m)
                      </div>
                    )}
                  </div>
                  {/* Approaching alert indicator */}
                  {approachingAlert && (
                    <div className="flex-shrink-0">
                      <span className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Step navigation */}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevStep}
                    disabled={currentStepIndex === 0}
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Nazaj
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {currentStepIndex + 1} / {route.steps.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextStep}
                    disabled={currentStepIndex === route.steps.length - 1}
                    className="h-8"
                  >
                    Naprej
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Route stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                    <RouteIcon className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium">{formatDistance(remainingDistance)}</span>
                    <span className="text-[10px] text-muted-foreground">Preostalo</span>
                  </div>
                  <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                    <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium">{formatETA(remainingDuration)}</span>
                    <span className="text-[10px] text-muted-foreground">Prihod</span>
                  </div>
                  <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                    <Siren className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium">{remainingSteps}</span>
                    <span className="text-[10px] text-muted-foreground">Zavoji</span>
                  </div>
                </div>

                {/* Elapsed time + follow position toggle */}
                <div className="flex items-center justify-between">
                  <div className="text-center text-xs text-muted-foreground">
                    Čas navigacije: {formatETA(elapsedTime)}
                  </div>
                  <Button
                    variant={followMyPosition ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFollowMyPosition(!followMyPosition)}
                    className={`h-7 text-xs gap-1 ${
                      followMyPosition ? 'bg-sky-600 hover:bg-sky-700' : ''
                    }`}
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    {followMyPosition ? 'Sledim' : 'Sledi'}
                  </Button>
                </div>
              </>
            ) : (
              /* Not navigating - show route summary */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                    <RouteIcon className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium">{formatDistance(route.totalDistance)}</span>
                    <span className="text-[10px] text-muted-foreground">Skupaj</span>
                  </div>
                  <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                    <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium">{formatETA(route.totalDuration)}</span>
                    <span className="text-[10px] text-muted-foreground">Trajanje</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {route.steps.length} korakov navigacije
                </p>
              </div>
            )}

            {/* Control buttons */}
            <div className="flex items-center gap-2">
              {isNavigating ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-1" />
                  Ustavi
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStart}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Začni navigacijo
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled)
                  if (voiceEnabled) window.speechSynthesis?.cancel()
                }}
                className="h-9 w-9 p-0"
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>

            {/* Upcoming steps preview */}
            {isNavigating && (
              <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                <p className="text-xs font-medium text-muted-foreground mb-1">Prihajajoči koraki:</p>
                {route.steps.slice(currentStepIndex + 1, currentStepIndex + 5).map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                    <span className="text-muted-foreground flex-shrink-0">{getTurnIcon(step.type)}</span>
                    <span className="truncate flex-1">{step.instruction}</span>
                    <span className="text-muted-foreground flex-shrink-0">{formatDistance(step.distance)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
