'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Play, Pause, Square, Save, Gauge, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TrackPoint, SpeedAlertSettings } from '@/components/tabs/types'
import { formatDuration } from '@/components/tabs/types'

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
        <div className="text-center py-2">
          <span className="text-3xl font-mono font-bold text-primary">{formatDuration(duration)}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 px-4 pb-2">
          <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Razdalja</p><p className="text-sm font-bold">{distance.toFixed(1)} km</p></div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Hitrost</p>
            <p className={`text-sm font-bold transition-colors duration-200 ${
              isOverSpeed ? 'text-red-500' : ''
            }`}>{currentSpeed} km/h</p>
          </div>
          <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Max</p><p className="text-sm font-bold">{maxSpeed} km/h</p></div>
          <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Nadm. viš.</p><p className="text-sm font-bold">{Math.round(elevation)} m</p></div>
        </div>
        <div className="flex items-center justify-center gap-3 pb-3 px-4">
          {!isTracking ? (
            <Button size="lg" className="px-8" onClick={onStart}><Play className="size-5 mr-2" />Začni sledenje</Button>
          ) : (
            <>
              {isPaused ? (
                <Button size="lg" variant="outline" className="px-6" onClick={onResume}><Play className="size-4 mr-2" />Nadaljuj</Button>
              ) : (
                <Button size="lg" variant="outline" className="px-6" onClick={onPause}><Pause className="size-4 mr-2" />Premor</Button>
              )}
              <Button size="lg" variant="destructive" className="px-6" onClick={onStop}><Square className="size-4 mr-2" />Ustavi</Button>
            </>
          )}
        </div>
        {!isTracking && trackPoints.length > 1 && (
          <div className="px-4 pb-3">
            <Button className="w-full" onClick={onSave}>
              <Save className="size-4 mr-2" />Shrani vožnjo ({distance.toFixed(1)} km, {formatDuration(duration)})
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
