'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Play, Pause, Square, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TrackPoint } from '@/components/tabs/types'
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
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSave: () => void
}

export default function TrackTab({
  isTracking, isPaused, trackPoints, duration,
  distance, maxSpeed, currentSpeed, elevation,
  onStart, onPause, onResume, onStop, onSave,
}: TrackTabProps) {
  return (
    <div className="relative w-full h-[calc(100vh-104px)] flex flex-col">
      <div className="flex-1 relative">
        <MotoMap center={[46.15, 14.99]} zoom={12} rides={[]} routes={[]} trackPoints={trackPoints} showTrack={true} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-md border-t border-border/50">
        <div className="text-center py-2">
          <span className="text-3xl font-mono font-bold text-primary">{formatDuration(duration)}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 px-4 pb-2">
          <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Razdalja</p><p className="text-sm font-bold">{distance.toFixed(1)} km</p></div>
          <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Hitrost</p><p className="text-sm font-bold">{currentSpeed} km/h</p></div>
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
