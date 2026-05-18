'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Volume2,
  VolumeX,
  Navigation2,
  Fuel,
  AlertTriangle,
  Gauge,
  X,
  Maximize2,
  Minimize2,
  Battery,
  Signal,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ===== DRIVING MODE =====
// Minimal, safe UI for riding — large text, essential info only
// Designed for handlebar-mounted phones (forum request: "CarPlay alternative")
// Key: speed, next turn, distance to turn, fuel range, ETA

interface DrivingModeProps {
  isActive: boolean
  onToggle: () => void
  currentSpeed: number
  maxSpeed: number
  distance: number
  duration: number
  elevation: number
  currentFuel?: number // liters remaining
  fuelRange?: number   // km remaining
  unitSystem?: 'metric' | 'imperial'
  // Navigation
  navInstruction?: string
  navDistanceToStep?: number // meters
  navStepIdx?: number
  navTotalSteps?: number
  navDestination?: string
  // Tracking
  isTracking: boolean
  isPaused: boolean
  // Speed alert
  speedLimit?: number
  isOverSpeed?: boolean
  // Voice
  voiceEnabled?: boolean
  onToggleVoice?: () => void
}

function formatDriveDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`
  return `${m} min`
}

function formatDriveDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000
    return km >= 100 ? `${Math.round(km)}` : `${km.toFixed(1)}`
  }
  return `${Math.round(meters)}`
}

function formatDriveDistanceUnit(meters: number): string {
  return meters >= 1000 ? 'km' : 'm'
}

export default function DrivingMode({
  isActive,
  onToggle,
  currentSpeed,
  maxSpeed,
  distance,
  duration,
  elevation,
  currentFuel,
  fuelRange,
  unitSystem = 'metric',
  navInstruction,
  navDistanceToStep,
  navStepIdx,
  navTotalSteps,
  navDestination,
  isTracking,
  isPaused,
  speedLimit = 90,
  isOverSpeed = false,
  voiceEnabled = true,
  onToggleVoice,
}: DrivingModeProps) {
  const [flashOn, setFlashOn] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<'good' | 'ok' | 'poor'>('good')
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const lastSpeedRef = useRef<number>(0)

  // Speed smoothing for display (avoid jitter)
  const smoothSpeed = useMemo(() => {
    // If speed dropped suddenly (GPS glitch), keep last speed briefly
    if (currentSpeed === 0 && lastSpeedRef.current > 20) return lastSpeedRef.current
    return currentSpeed
  }, [currentSpeed])
  
  useEffect(() => {
    if (currentSpeed > 0) lastSpeedRef.current = currentSpeed
  }, [currentSpeed])

  // Speed alert flash animation
  useEffect(() => {
    if (!isOverSpeed) { setFlashOn(false); return }
    const interval = setInterval(() => setFlashOn(p => !p), 500)
    return () => clearInterval(interval)
  }, [isOverSpeed])

  // Monitor GPS accuracy
  useEffect(() => {
    if (!isTracking) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy < 15) setGpsAccuracy('good')
        else if (pos.coords.accuracy < 50) setGpsAccuracy('ok')
        else setGpsAccuracy('poor')
      },
      () => setGpsAccuracy('poor'),
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [isTracking])

  // Battery level monitoring
  useEffect(() => {
    if (!('getBattery' in navigator)) return
    (navigator as any).getBattery?.()?.then((battery: any) => {
      setBatteryLevel(Math.round(battery.level * 100))
      battery.addEventListener('levelchange', () => setBatteryLevel(Math.round(battery.level * 100)))
    })
  }, [])

  // Auto-enter compact mode at high speed (less visual clutter)
  useEffect(() => {
    if (currentSpeed > 120 && !compactMode) setCompactMode(true)
    if (currentSpeed < 80 && compactMode) setCompactMode(false)
  }, [currentSpeed, compactMode])

  if (!isActive) return null

  const speedUnit = unitSystem === 'imperial' ? 'MPH' : 'km/h'
  const displaySpeed = unitSystem === 'imperial' ? Math.round(currentSpeed * 0.621371) : Math.round(smoothSpeed)
  const displaySpeedLimit = unitSystem === 'imperial' ? Math.round(speedLimit * 0.621371) : speedLimit
  const displayDistance = unitSystem === 'imperial' ? (distance * 0.621371).toFixed(1) : distance.toFixed(1)
  const distUnit = unitSystem === 'imperial' ? 'mi' : 'km'

  return (
    <div className={`fixed inset-0 z-[9999] transition-all duration-300 ${
      isOverSpeed && flashOn ? 'bg-red-900/30' : 'bg-black'
    }`}>
      {/* Speed alert overlay */}
      {isOverSpeed && flashOn && (
        <div className="absolute inset-0 bg-red-500/15 pointer-events-none" />
      )}

      {/* Close button - top right, small */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {/* GPS accuracy indicator */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
          gpsAccuracy === 'good' ? 'bg-emerald-500/20 text-emerald-400' :
          gpsAccuracy === 'ok' ? 'bg-amber-500/20 text-amber-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          <Signal className="size-3" />
          GPS
        </div>
        {/* Battery level */}
        {batteryLevel !== null && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
            batteryLevel > 30 ? 'bg-white/10 text-white/60' : 'bg-red-500/20 text-red-400'
          }`}>
            <Battery className="size-3" />
            {batteryLevel}%
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="size-4 text-white/60" />
        </button>
      </div>

      {/* Voice toggle - top left */}
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={onToggleVoice}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          {voiceEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 text-white/40" />}
        </button>
      </div>

      {/* Main content - centered, large text */}
      <div className="h-full flex flex-col items-center justify-center px-6">
        
        {/* Navigation instruction - top of screen */}
        {navInstruction && (
          <div className="absolute top-16 left-4 right-4">
            <div className={`rounded-2xl p-4 ${
              navDistanceToStep !== undefined && navDistanceToStep < 50
                ? 'bg-primary/20 border-2 border-primary/40'
                : 'bg-white/10 border border-white/10'
            }`}>
              <div className="flex items-center gap-3">
                <Navigation2 className={`size-8 flex-shrink-0 ${
                  navDistanceToStep !== undefined && navDistanceToStep < 50
                    ? 'text-primary animate-pulse'
                    : 'text-white/70'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white truncate">{navInstruction}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {navDistanceToStep !== undefined && (
                      <span className="text-2xl font-black text-primary">
                        {formatDriveDistance(navDistanceToStep)}
                        <span className="text-sm font-medium text-primary/70 ml-1">
                          {formatDriveDistanceUnit(navDistanceToStep)}
                        </span>
                      </span>
                    )}
                    {navTotalSteps && navStepIdx !== undefined && (
                      <span className="text-xs text-white/40">
                        {navStepIdx + 1}/{navTotalSteps}
                      </span>
                    )}
                    {navDestination && (
                      <span className="text-xs text-white/30 truncate">
                        → {navDestination}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SPEED - Main display, huge text */}
        <div className="text-center -mt-8">
          <div className={`transition-colors duration-300 ${
            isOverSpeed ? 'text-red-500' :
            currentSpeed > speedLimit * 0.9 ? 'text-amber-400' :
            'text-white'
          }`}>
            <span className={`font-black tracking-tighter leading-none ${
              compactMode ? 'text-[120px]' : 'text-[140px]'
            }`}>
              {displaySpeed}
            </span>
          </div>
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="text-xl text-white/40 font-medium">{speedUnit}</span>
            {speedLimit > 0 && (
              <div className={`flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold ${
                isOverSpeed
                  ? 'bg-red-500 text-white'
                  : 'bg-white/10 text-white/50'
              }`}>
                <Gauge className="size-3.5 mr-1" />
                {displaySpeedLimit}
              </div>
            )}
          </div>
        </div>

        {/* Stats row - below speed */}
        <div className="flex items-center justify-center gap-8 mt-8">
          {/* Distance */}
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{displayDistance}</p>
            <p className="text-xs text-white/30 uppercase tracking-wider">{distUnit}</p>
          </div>
          
          {/* Duration */}
          <div className="text-center">
            <p className="text-3xl font-bold text-white">{formatDriveDuration(duration)}</p>
            <p className="text-xs text-white/30 uppercase tracking-wider">čas</p>
          </div>

          {/* Elevation */}
          {!compactMode && elevation > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold text-white/70">{Math.round(elevation)}</p>
              <p className="text-xs text-white/30 uppercase tracking-wider">m ↑</p>
            </div>
          )}
        </div>

        {/* Fuel range indicator */}
        {fuelRange !== undefined && fuelRange > 0 && (
          <div className={`mt-6 flex items-center gap-3 px-5 py-3 rounded-2xl ${
            fuelRange < 30
              ? 'bg-red-500/20 border border-red-500/30'
              : fuelRange < 80
                ? 'bg-amber-500/15 border border-amber-500/20'
                : 'bg-white/5 border border-white/10'
          }`}>
            <Fuel className={`size-5 ${
              fuelRange < 30 ? 'text-red-400' :
              fuelRange < 80 ? 'text-amber-400' :
              'text-white/50'
            }`} />
            <div>
              <p className={`text-2xl font-bold ${
                fuelRange < 30 ? 'text-red-400' :
                fuelRange < 80 ? 'text-amber-400' :
                'text-white'
              }`}>
                {Math.round(fuelRange)}
                <span className="text-sm font-normal text-white/40 ml-1">{distUnit}</span>
              </p>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">doseg</p>
            </div>
            {currentFuel !== undefined && (
              <span className="text-xs text-white/20 ml-2">
                {currentFuel.toFixed(1)}L
              </span>
            )}
          </div>
        )}

        {/* Auto-pause indicator */}
        {isPaused && isTracking && (
          <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30">
            <div className="size-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">Premor</span>
          </div>
        )}

        {/* Paused / Not tracking indicator */}
        {!isTracking && (
          <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <MapPin className="size-3 text-white/30" />
            <span className="text-sm text-white/30">Ne sledi</span>
          </div>
        )}
      </div>

      {/* Bottom bar - minimal controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe">
        <div className="flex items-center justify-center gap-6 py-4">
          <button
            onClick={() => setCompactMode(!compactMode)}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            title={compactMode ? 'Razširjeni pogled' : 'Kompaktni pogled'}
          >
            {compactMode ? <Maximize2 className="size-5 text-white/40" /> : <Minimize2 className="size-5 text-white/40" />}
          </button>
        </div>
      </div>
    </div>
  )
}
