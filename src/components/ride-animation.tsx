'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface RideAnimationProps {
  rideId: string
  onClose?: () => void
}

interface AnimationData {
  trackPoints: Array<{ lat: number; lng: number; alt: number; speed: number; timestamp: number }>
  totalPoints: number
  totalDistance: number
  totalDuration: number
}

const SIMULATED_DATA: AnimationData = {
  trackPoints: Array.from({ length: 100 }, (_, i) => ({
    lat: 46.15 + (i / 100) * 0.5,
    lng: 14.99 + Math.sin(i / 10) * 0.05,
    alt: 300 + Math.sin(i / 5) * 50,
    speed: 40 + Math.random() * 80,
    timestamp: Date.now() - (100 - i) * 60000,
  })),
  totalPoints: 100,
  totalDistance: 45,
  totalDuration: 3600,
}

export default function RideAnimation({ rideId, onClose }: RideAnimationProps) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentPoint, setCurrentPoint] = useState(0)
  const [data, setData] = useState<AnimationData | null>(null)
  const animRef = useRef<number | null>(null)

  // Load animation data via fetch in effect with async pattern
  useEffect(() => {
    let cancelled = false

    const loadAnimation = async () => {
      try {
        const res = await fetch(`/api/ride-animation?rideId=${rideId}`)
        const j = await res.json()
        if (!cancelled && j.data) {
          setData(j.data)
          return
        }
      } catch { /* fall through to simulated */ }
      if (!cancelled) {
        setData(SIMULATED_DATA)
      }
    }

    loadAnimation()
    return () => { cancelled = true }
  }, [rideId])

  // Animation playback
  useEffect(() => {
    if (playing && data) {
      const interval = 1000 / (speed * 10)
      animRef.current = window.setInterval(() => {
        setCurrentPoint(p => {
          if (p >= data.totalPoints - 1) {
            setPlaying(false)
            if (animRef.current) clearInterval(animRef.current)
            return p
          }
          return p + 1
        })
      }, interval)
      return () => { if (animRef.current) clearInterval(animRef.current) }
    }
  }, [playing, speed, data])

  if (!data) {
    return (
      <div className="bg-primary/10 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="size-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Nalagam animacijo...</p>
        </div>
      </div>
    )
  }

  const point = data.trackPoints[currentPoint]
  const progress = data.totalPoints > 0 ? ((currentPoint + 1) / data.totalPoints) * 100 : 0

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-primary" />
          <span className="text-xs font-bold text-primary">REWIND</span>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 4, 8].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                speed === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {s}x
            </button>
          ))}
          {onClose && (
            <button onClick={onClose} className="p-1 rounded hover:bg-muted ml-1">
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {point && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-sm font-bold">{Math.round(point.speed)} km/h</p>
            <p className="text-[10px] text-muted-foreground">Hitrost</p>
          </div>
          <div>
            <p className="text-sm font-bold">{Math.round(point.alt)} m</p>
            <p className="text-[10px] text-muted-foreground">Višina</p>
          </div>
          <div>
            <p className="text-sm font-bold">{currentPoint}/{data.totalPoints}</p>
            <p className="text-[10px] text-muted-foreground">Točka</p>
          </div>
        </div>
      )}

      <input
        type="range"
        min={0}
        max={data.totalPoints - 1}
        value={currentPoint}
        onChange={e => setCurrentPoint(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-muted"
      />

      <Progress value={progress} className="h-1" />

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 gap-1 text-xs"
          onClick={() => {
            setPlaying(!playing)
            if (currentPoint >= data.totalPoints - 1) setCurrentPoint(0)
          }}
        >
          {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
          {playing ? 'Premor' : 'Predvajaj'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs"
          onClick={() => { setCurrentPoint(0); setPlaying(false) }}
        >
          <RotateCcw className="size-3" /> Na začetek
        </Button>
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data.totalDistance} km skupaj</span>
        <span>~{Math.round(data.totalDuration / 60)} min</span>
      </div>
    </div>
  )
}
