'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Play, Pause, Square, Save, Gauge, AlertTriangle, ChevronDown, ChevronUp, Activity, Bike, Moon, Timer, Share2 } from 'lucide-react'
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
