'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Navigation2, Volume2, VolumeX, X, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

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
  onClose: () => void
}

export default function VoiceNavigation({
  isActive, route, currentLat, currentLng, currentSpeed, onClose,
}: VoiceNavigationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const spokenStepsRef = useRef<Set<number>>(new Set())
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const routeRef = useRef(route)

  // Keep routeRef in sync
  useEffect(() => { routeRef.current = route }, [route])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'sl-SI'
    utter.rate = 0.9
    const voices = synthRef.current.getVoices()
    const slVoice = voices.find(v => v.lang.startsWith('sl'))
    if (slVoice) utter.voice = slVoice
    synthRef.current.speak(utter)
  }, [])

  // Auto-advance navigation step based on GPS proximity
  useEffect(() => {
    if (!isActive || !route || !currentLat || !currentLng) return
    const steps = route.steps
    if (steps.length === 0) return

    // Find closest upcoming step using a timeout to avoid direct setState in effect
    let closestIdx = -1
    let closestDist = Infinity

    for (let i = 0; i < steps.length; i++) {
      const [sLat, sLng] = steps[i].location
      const d = Math.sqrt((currentLat - sLat) ** 2 + (currentLng - sLng) ** 2)
      if (d < closestDist) {
        closestDist = d
        closestIdx = i
      }
    }

    if (closestDist < 0.0005 && closestIdx >= 0) {
      // Use setTimeout to break the synchronous setState chain
      const timer = setTimeout(() => {
        setCurrentStep(prev => {
          if (closestIdx > prev) return closestIdx
          return prev
        })
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isActive, route, currentLat, currentLng])

  // Speak current step when it changes
  useEffect(() => {
    if (!isActive || !route || !voiceEnabled) return
    const step = route.steps[currentStep]
    if (step && !spokenStepsRef.current.has(currentStep)) {
      speak(step.instructionSlo || step.instruction)
      spokenStepsRef.current = new Set(spokenStepsRef.current).add(currentStep)
    }
  }, [isActive, route, currentStep, speak, voiceEnabled])

  // Reset when route changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentStep(0)
      spokenStepsRef.current = new Set()
    }, 0)
    return () => clearTimeout(timer)
  }, [route])

  if (!isActive || !route) return null

  const steps = route.steps
  const step = steps[currentStep]
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0

  return (
    <div className="absolute bottom-36 left-3 right-3 z-[1002]">
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-2 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation2 className="size-4 text-primary animate-pulse" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Navigacija</span>
          </div>
          <div className="flex items-center gap-1">
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

        {step && (
          <div className="bg-background rounded-lg p-2.5">
            <p className="text-sm font-medium">{step.instructionSlo || step.instruction}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{step.distance > 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}</span>
              <span>Korak {currentStep + 1}/{steps.length}</span>
              {currentSpeed > 0 && <span>{currentSpeed} km/h</span>}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 text-xs gap-1"
            onClick={() => {
              if (currentStep < steps.length - 1) {
                const next = currentStep + 1
                setCurrentStep(next)
                speak(steps[next]?.instructionSlo || steps[next]?.instruction || '')
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
              if (step) speak(step.instructionSlo || step.instruction)
            }}
          >
            <Volume2 className="size-3" /> Ponovi
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
