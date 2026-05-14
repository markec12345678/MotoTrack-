'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { NavigationRoute, NavigationStep } from '@/components/tabs/types'
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
} from 'lucide-react'

interface NavigationPanelProps {
  route: NavigationRoute | null
  onStartNavigation?: () => void
  onStopNavigation?: () => void
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

export default function NavigationPanel({ route, onStartNavigation, onStopNavigation }: NavigationPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentStep: NavigationStep | null = route?.steps[currentStepIndex] ?? null

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

  const handleStart = () => {
    setIsNavigating(true)
    setCurrentStepIndex(0)
    setElapsedTime(0)
    onStartNavigation?.()
  }

  const handleStop = () => {
    setIsNavigating(false)
    setElapsedTime(0)
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
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {!isMinimized && (
          <CardContent className="px-3 pb-3 pt-0 space-y-3">
            {isNavigating && currentStep ? (
              <>
                {/* Current instruction */}
                <div className="flex items-center gap-4 rounded-lg bg-amber-500/10 p-3 border border-amber-500/20">
                  <div className="flex-shrink-0 text-amber-500">
                    {getTurnIcon(currentStep.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{currentStep.instruction}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentStep.name && `${currentStep.name} · `}
                      {formatDistance(currentStep.distance)}
                    </p>
                  </div>
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

                {/* Elapsed time */}
                <div className="text-center text-xs text-muted-foreground">
                  Čas navigacije: {formatETA(elapsedTime)}
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
