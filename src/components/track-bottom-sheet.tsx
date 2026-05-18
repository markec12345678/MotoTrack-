'use client'

import React, { useState, useCallback, useRef } from 'react'
import {
  Play,
  Pause,
  Square,
  Save,
  Gauge,
  AlertTriangle,
  ChevronUp,
  Timer,
  Navigation2,
  Volume2,
  VolumeX,
  Headphones,
  Share2,
  Camera,
  Eye,
  Monitor,
  MapPin,
  Globe,
  ShieldAlert,
  Moon,
  Zap,
  Radio,
  Bike,
  TrendingUp,
} from 'lucide-react'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import type { TrackPoint, SpeedAlertSettings } from '@/components/tabs/types'
import { formatDuration } from '@/components/tabs/types'
import { type UnitSystem, convertSpeed, convertDistance, speedUnit, distanceUnit } from '@/hooks/use-settings'

interface TrackBottomSheetProps {
  // Core state
  isTracking: boolean
  isPaused: boolean
  trackPoints: TrackPoint[]
  duration: number
  distance: number
  maxSpeed: number
  currentSpeed: number
  elevation: number
  // Actions
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSave: () => void
  // Settings
  unitSystem?: UnitSystem
  autoPauseEnabled?: boolean
  wakelockEnabled?: boolean
  autoStartEnabled?: boolean
  autoStartCountdown?: number | null
  onToggleAutoStart?: () => void
  // Speed alert
  speedSettings: SpeedAlertSettings
  isOverSpeed: boolean
  flashOn: boolean
  // Nav
  navActive: boolean
  navSteps: Array<{ instruction: string; distance: number; type: string; name: string }>
  navStepIdx: number
  navDistToStep: number | null
  navDestination: { lat: number; lng: number; name: string } | null
  navVoiceOn: boolean
  navLoading: boolean
  btConnected: boolean
  onToggleNavVoice: () => void
  onStopNav: () => void
  onStartNav: () => void
  // Quick actions
  onToggleDrivingMode: () => void
  onToggleCarplay?: () => void
  onOpenParking?: () => void
  onOpenBorderGuide?: () => void
  onOpenEmergency: () => void
  carplayMode?: boolean
  drivingMode: boolean
  // Share & photo
  showShareCard: boolean
  onToggleShareCard: () => void
  showPhotoGallery: boolean
  onTogglePhotoGallery: () => void
  // GPS
  gpsAccuracy: number | null
  gpsSignalQuality: 'good' | 'ok' | 'poor' | 'unknown'
  gpsAccuracyDisplay: React.ReactNode
  gpsErrorDisplay: React.ReactNode
  // Feature panels
  featurePanels: React.ReactNode
  // Elevation
  elevationProfile: React.ReactNode
  // Twistiness
  twistinessScore: React.ReactNode
  // Weather
  weatherAlerts: React.ReactNode
  // Fuel
  fuelRange: React.ReactNode
  // Photo gallery content
  photoGalleryContent: React.ReactNode
  // Checklist
  checklistComponent: React.ReactNode
}

export default function TrackBottomSheet({
  isTracking,
  isPaused,
  trackPoints,
  duration,
  distance,
  maxSpeed,
  currentSpeed,
  elevation,
  onStart,
  onPause,
  onResume,
  onStop,
  onSave,
  unitSystem = 'metric',
  autoPauseEnabled = true,
  wakelockEnabled = true,
  autoStartEnabled = false,
  autoStartCountdown = null,
  onToggleAutoStart,
  speedSettings,
  isOverSpeed,
  flashOn,
  navActive,
  navSteps,
  navStepIdx,
  navDistToStep,
  navDestination,
  navVoiceOn,
  navLoading,
  btConnected,
  onToggleNavVoice,
  onStopNav,
  onStartNav,
  onToggleDrivingMode,
  onToggleCarplay,
  onOpenParking,
  onOpenBorderGuide,
  onOpenEmergency,
  carplayMode = false,
  drivingMode,
  showShareCard,
  onToggleShareCard,
  showPhotoGallery,
  onTogglePhotoGallery,
  gpsAccuracy,
  gpsSignalQuality,
  gpsAccuracyDisplay,
  gpsErrorDisplay,
  featurePanels,
  elevationProfile,
  twistinessScore,
  weatherAlerts,
  fuelRange,
  photoGalleryContent,
  checklistComponent,
}: TrackBottomSheetProps) {
  // Convert values
  const displaySpeed = Math.round(convertSpeed(currentSpeed, unitSystem))
  const displayMaxSpeed = Math.round(convertSpeed(maxSpeed, unitSystem))
  const displayDistance = convertDistance(distance, unitSystem)
  const speedUnitLabel = speedUnit(unitSystem)
  const distanceUnitLabel = distanceUnit(unitSystem)
  const speedPct = speedSettings.speedLimit > 0 ? Math.min(100, (currentSpeed / speedSettings.speedLimit) * 100) : 0
  const speedBarColor = isOverSpeed ? 'bg-red-500' : speedPct > 80 ? 'bg-amber-500' : 'bg-primary'

  return (
    <Drawer
      shouldScaleBackground={false}
      snapPoints={[0.18, 0.55, 0.92]}
      defaultSnap={isTracking ? 0.55 : 0.18}
      snapToSequentialPointOnSnap={true}
    >
      <DrawerContent className="bg-black/95 backdrop-blur-xl border-t border-white/10 max-h-[92vh]">
        <DrawerTitle className="sr-only">Sledenje vožnji</DrawerTitle>

        {/* ─── Collapsed view: Slim stats bar (visible at 0.18 snap) ─── */}
        <div className="vaul-closed:px-4 vaul-closed:py-2">
          {/* Drag handle + quick stats */}
          <div className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-4 flex-1">
              {/* Speed - primary */}
              <div className="text-center">
                <p className={`text-3xl font-black tracking-tight leading-none ${
                  isOverSpeed ? 'text-red-400' : 'text-white'
                }`}>
                  {displaySpeed}
                </p>
                <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium mt-0.5">{speedUnitLabel}</p>
              </div>
              {/* Distance */}
              <div className="text-center">
                <p className="text-lg font-bold text-white/80 leading-none">{displayDistance.toFixed(1)}</p>
                <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium mt-0.5">{distanceUnitLabel}</p>
              </div>
              {/* Duration */}
              <div className="text-center">
                <p className="text-lg font-bold text-white/80 font-mono leading-none">{formatDuration(duration)}</p>
                <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium mt-0.5">čas</p>
              </div>
            </div>
            {/* Quick action buttons (always visible) */}
            <div className="flex items-center gap-2">
              {!isTracking && !trackPoints.length ? (
                <button
                  onClick={() => onStart()}
                  className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform"
                >
                  <Play className="size-5 text-white fill-white ml-0.5" />
                </button>
              ) : isTracking ? (
                <>
                  {isPaused ? (
                    <button onClick={onResume} className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform">
                      <Play className="size-5 text-white fill-white ml-0.5" />
                    </button>
                  ) : (
                    <button onClick={onPause} className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform">
                      <Pause className="size-5 text-white" />
                    </button>
                  )}
                  <button onClick={onStop} className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center active:scale-95 transition-transform">
                    <Square className="size-3 text-white fill-white" />
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* Speed progress bar - thin line */}
          {speedSettings.speedAlertEnabled && isTracking && !isPaused && (
            <div className="h-0.5 rounded-full bg-white/10 overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${speedBarColor}`}
                style={{ width: `${speedPct}%` }}
              />
            </div>
          )}

          {/* Auto-pause indicator */}
          {autoPauseEnabled && isPaused && isTracking && (
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Premor</span>
            </div>
          )}
        </div>

        {/* ─── Expanded content (visible at 0.55 and 1.0 snap) ─── */}
        <div className="px-4 pb-4 space-y-3 overflow-y-auto max-h-[70vh] custom-scrollbar">

          {/* When NOT tracking - Start screen */}
          {!isTracking && !trackPoints.length && (
            <div className="py-4 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Bike className="size-4" />
                <span>Pripravljen na vožnjo</span>
              </div>
              {/* Auto-start countdown */}
              {autoStartEnabled && autoStartCountdown !== null && autoStartCountdown > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 animate-pulse">
                  <Radio className="size-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    Zaznavam gibanje... {autoStartCountdown}s
                  </span>
                </div>
              )}
              <button
                onClick={() => onStart()}
                className="relative w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform"
              >
                <Play className="size-7 text-white fill-white ml-1" />
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
                >
                  <Zap className="size-3" />
                  <span>AUTO-START</span>
                  {autoStartEnabled && <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />}
                </button>
              )}
              {checklistComponent}
            </div>
          )}

          {/* When TRACKING - Full dashboard */}
          {isTracking && (
            <>
              {/* Navigation Banner */}
              {navActive && navSteps.length > 0 && (
                <div className="bg-primary/15 border border-primary/25 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Navigation2 className="size-4 text-primary animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {navSteps[navStepIdx]?.instruction || 'Nadaljuj naravnost'}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {btConnected && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/20 text-primary">
                          <Headphones className="size-3" />
                          <span className="text-[8px] font-bold">BT</span>
                        </span>
                      )}
                      <button onClick={onToggleNavVoice} className="p-1 rounded hover:bg-white/10">
                        {navVoiceOn ? <Volume2 className="size-3.5 text-primary" /> : <VolumeX className="size-3.5 text-white/30" />}
                      </button>
                    </div>
                    <button onClick={onStopNav} className="p-1 rounded hover:bg-red-500/20 text-red-400 flex-shrink-0">
                      <Square className="size-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-white/50">
                    {navDistToStep !== null && (
                      <span className="font-bold text-primary">
                        {navDistToStep > 1000 ? `${(navDistToStep / 1000).toFixed(1)} km` : `${navDistToStep} m`}
                      </span>
                    )}
                    <span>Korak {navStepIdx + 1}/{navSteps.length}</span>
                    {navDestination && <span>→ {navDestination.name}</span>}
                  </div>
                  {/* Upcoming steps */}
                  {navSteps.length > navStepIdx + 1 && (
                    <div className="bg-white/5 rounded-lg p-1.5 space-y-0.5">
                      {navSteps.slice(navStepIdx + 1, navStepIdx + 3).map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-[9px] text-white/40">
                          <span className="bg-white/10 px-1 rounded font-mono">
                            {s.distance > 1000 ? `${(s.distance / 1000).toFixed(1)}km` : `${s.distance}m`}
                          </span>
                          <span className="truncate">{s.instruction}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Start Nav button */}
              {!navActive && trackPoints.length > 3 && !navLoading && (
                <button
                  onClick={onStartNav}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <Navigation2 className="size-3.5" />
                  Zaženi navigacijo (do začetka)
                </button>
              )}
              {navLoading && (
                <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 text-primary text-xs">
                  <div className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Nalaganje navigacije...
                </div>
              )}

              {/* Full stats grid */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 rounded-xl bg-white/5">
                  <p className={`text-2xl font-black ${isOverSpeed ? 'text-red-400' : 'text-white'}`}>
                    {displaySpeed}
                  </p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium">{speedUnitLabel}</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/5">
                  <p className="text-2xl font-black text-white">{displayDistance.toFixed(1)}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium">{distanceUnitLabel}</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold text-white/60">{displayMaxSpeed}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium">max</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold text-white/60">{Math.round(elevation)}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider font-medium">m ↑</p>
                </div>
              </div>

              {/* Speed progress bar */}
              {speedSettings.speedAlertEnabled && !isPaused && (
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${speedBarColor}`}
                    style={{ width: `${speedPct}%` }}
                  />
                </div>
              )}

              {/* GPS Signal */}
              {gpsAccuracyDisplay}
              {gpsErrorDisplay}

              {/* Mini Elevation Profile */}
              {elevationProfile}

              {/* Twistiness Score */}
              {twistinessScore}

              {/* Weather alerts */}
              {weatherAlerts}

              {/* Fuel range */}
              {fuelRange}

              {/* Photo gallery */}
              {photoGalleryContent}

              {/* Quick actions row */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={onToggleDrivingMode}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                    drivingMode ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:bg-white/15'
                  }`}
                >
                  <Eye className="size-3" />
                  DRIVE
                </button>
                {onToggleCarplay && (
                  <button
                    onClick={onToggleCarplay}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                      carplayMode ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/15'
                    }`}
                  >
                    <Monitor className="size-3" />
                    CAR
                  </button>
                )}
                {onOpenParking && (
                  <button
                    onClick={onOpenParking}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500/30 transition-colors"
                  >
                    <MapPin className="size-3" />
                    🅿️
                  </button>
                )}
                {onOpenBorderGuide && (
                  <button
                    onClick={onOpenBorderGuide}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
                  >
                    <Globe className="size-3" />
                    MEJA
                  </button>
                )}
                <button
                  onClick={onOpenEmergency}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-colors"
                >
                  <ShieldAlert className="size-3" />
                  SOS
                </button>
                <button
                  onClick={onTogglePhotoGallery}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                    showPhotoGallery ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-white/60 hover:bg-white/15'
                  }`}
                >
                  <Camera className="size-3" />
                  FOTO
                </button>
                <button
                  onClick={onToggleShareCard}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                    showShareCard ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-white/60 hover:bg-white/15'
                  }`}
                >
                  <Share2 className="size-3" />
                  DELI
                </button>
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-center gap-4 py-2">
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
                {trackPoints.length >= 2 && (
                  <button
                    onClick={onSave}
                    className="w-14 h-14 rounded-full bg-emerald-500/80 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
                  >
                    <Save className="size-5 text-white" />
                  </button>
                )}
              </div>
            </>
          )}

          {/* When stopped with unsaved track */}
          {!isTracking && trackPoints.length > 0 && (
            <div className="py-4 flex flex-col items-center gap-3">
              <div className="text-center space-y-1">
                <p className="text-lg font-bold text-white">Vožnja končana</p>
                <div className="flex items-center justify-center gap-4 text-white/60 text-sm">
                  <span>{displayDistance.toFixed(1)} {distanceUnitLabel}</span>
                  <span>{formatDuration(duration)}</span>
                  <span>{displayMaxSpeed} {speedUnitLabel} max</span>
                </div>
              </div>
              <button
                onClick={onSave}
                className="w-14 h-14 rounded-full bg-emerald-500/80 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
              >
                <Save className="size-6 text-white" />
              </button>
              <span className="text-white/40 text-[10px]">Shrani vožnjo</span>
              <button
                onClick={onToggleShareCard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/60 text-xs font-medium hover:bg-white/15 transition-colors"
              >
                <Share2 className="size-3" />
                Deli vožnjo
              </button>
            </div>
          )}

          {/* Feature panels - when not tracking */}
          {!isTracking && featurePanels}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
