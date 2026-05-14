'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Play, Pause, Square, Save, Gauge, AlertTriangle, ChevronDown, ChevronUp, Activity, Bike } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { TrackPoint, SpeedAlertSettings } from '@/components/tabs/types'
import { formatDuration } from '@/components/tabs/types'

const CrashDetectionPanel = dynamic(() => import('@/components/crash-detection-panel'), { ssr: false })
const LiveTrackingPanel = dynamic(() => import('@/components/live-tracking-panel'), { ssr: false })
const LeanAngleDisplay = dynamic(() => import('@/components/lean-angle-display'), { ssr: false })

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

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
}

export default function TrackTab({
  isTracking, isPaused, trackPoints, duration,
  distance, maxSpeed, currentSpeed, elevation,
  userId,
  onStart, onPause, onResume, onStop, onSave,
}: TrackTabProps) {
  // Speed alert state
  const [speedSettings, setSpeedSettings] = useState<SpeedAlertSettings>({
    speedLimit: 90,
    speedAlertEnabled: true,
    speedAlertSound: true,
  })
  const [flashOn, setFlashOn] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const hasPlayedBeepRef = useRef(false)
  const [showFeatures, setShowFeatures] = useState(false)

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

  // Play beep when speed crosses over the limit (transition from under to over)
  useEffect(() => {
    if (isOverSpeed && !hasPlayedBeepRef.current && speedSettings.speedAlertSound) {
      playBeep()
      hasPlayedBeepRef.current = true
    }
    if (!isOverSpeed) {
      hasPlayedBeepRef.current = false
    }
  }, [isOverSpeed, speedSettings.speedAlertSound, playBeep])

  // Flashing animation effect — only subscribes to isOverSpeed changes
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

  return (
    <div className={`relative w-full h-[calc(100vh-104px)] flex flex-col transition-all duration-200 ${
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
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              <CrashDetectionPanel userId={userId} />
              <LiveTrackingPanel userId={userId} />
              <LeanAngleDisplay currentAngle={0} userId={userId} isTracking={isTracking} />
            </div>
          )}
        </div>
      )}
      <div className="flex-1 relative">
        <MotoMap center={[46.15, 14.99]} zoom={12} rides={[]} routes={[]} trackPoints={trackPoints} showTrack={true} />

        {/* Speed limit indicator - top right corner */}
        {speedSettings.speedAlertEnabled && isTracking && (
          <div className={`absolute top-3 right-3 z-[1001] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm transition-all duration-200 ${
            isOverSpeed
              ? 'bg-red-500/90 text-white'
              : 'bg-background/80 text-muted-foreground border border-border/50'
          }`}>
            <Gauge className="size-3.5" />
            <span>{speedSettings.speedLimit} km/h</span>
            {isOverSpeed && <AlertTriangle className="size-3.5 ml-0.5 animate-pulse" />}
          </div>
        )}

        {/* Speed alert overlay flash */}
        {isOverSpeed && flashOn && (
          <div className="absolute inset-0 z-[999] pointer-events-none bg-red-500/10" />
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-md border-t border-border/50">
        {/* Timer - prominent display */}
        <div className="text-center pt-3 pb-1">
          <span className="text-4xl font-mono font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{formatDuration(duration)}</span>
        </div>
        
        {/* Stats row - card-style pills */}
        <div className="flex items-center justify-center gap-2 px-4 pb-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-xs">
            <Activity className="size-3 text-primary" />
            <span className="font-bold">{distance.toFixed(1)}</span>
            <span className="text-muted-foreground">km</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors duration-200 ${
            isOverSpeed ? 'bg-red-500/20 text-red-500' : 'bg-primary/10'
          }`}>
            <Gauge className="size-3" />
            <span className="font-bold">{currentSpeed}</span>
            <span className="text-muted-foreground">km/h</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-xs">
            <Gauge className="size-3 text-amber-500" />
            <span className="font-bold">{maxSpeed}</span>
            <span className="text-muted-foreground">max</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-xs">
            <span className="font-bold">{Math.round(elevation)}</span>
            <span className="text-muted-foreground">m</span>
          </div>
        </div>

        {/* Speed progress bar */}
        {isTracking && !isPaused && speedSettings.speedAlertEnabled && (
          <div className="px-6 pb-1.5">
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isOverSpeed ? 'bg-red-500' : currentSpeed > speedSettings.speedLimit * 0.8 ? 'bg-amber-500' : 'bg-primary'
                }`} 
                style={{ width: `${Math.min(100, (currentSpeed / speedSettings.speedLimit) * 100)}%` }} 
              />
            </div>
            <div className="flex justify-between text-[8px] text-muted-foreground/50 mt-0.5">
              <span>0</span>
              <span className="text-amber-500">{speedSettings.speedLimit * 0.8} km/h</span>
              <span className="text-red-500">{speedSettings.speedLimit} km/h</span>
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-3 pb-3 px-4">
          {!isTracking ? (
            <Button size="lg" className="px-10 gap-2 rounded-full shadow-lg shadow-primary/20" onClick={onStart}>
              <Play className="size-5" />Začni sledenje
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button size="lg" variant="outline" className="px-6 gap-2 rounded-full" onClick={onResume}><Play className="size-4" />Nadaljuj</Button>
              ) : (
                <Button size="lg" variant="outline" className="px-6 gap-2 rounded-full" onClick={onPause}><Pause className="size-4" />Premor</Button>
              )}
              <Button size="lg" variant="destructive" className="px-6 gap-2 rounded-full" onClick={onStop}><Square className="size-4" />Ustavi</Button>
            </>
          )}
        </div>
        {!isTracking && trackPoints.length > 1 && (
          <div className="px-4 pb-3">
            <Button className="w-full gap-2 rounded-full" onClick={onSave}>
              <Save className="size-4" />Shrani vožnjo ({distance.toFixed(1)} km, {formatDuration(duration)})
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
