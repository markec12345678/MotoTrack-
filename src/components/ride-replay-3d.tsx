'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import type { TrackPoint } from '@/components/tabs/types'
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  FastForward,
  Mountain,
  Route as RouteIcon,
} from 'lucide-react'

interface RideReplay3DProps {
  trackData: TrackPoint[]
  title?: string
}

type SpeedMultiplier = 1 | 2 | 4 | 8

export default function RideReplay3D({ trackData, title }: RideReplay3DProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speedMultiplier, setSpeedMultiplier] = useState<SpeedMultiplier>(1)
  const [currentIndex, setCurrentIndex] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const lastTimeRef = useRef<number>(0)

  const currentPoint = trackData[currentIndex] ?? trackData[0]
  const totalPoints = trackData.length

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    if (trackData.length < 2) return

    // Calculate bounds
    let minLat = Infinity, maxLat = -Infinity
    let minLng = Infinity, maxLng = -Infinity
    for (const p of trackData) {
      minLat = Math.min(minLat, p.lat)
      maxLat = Math.max(maxLat, p.lat)
      minLng = Math.min(minLng, p.lng)
      maxLng = Math.max(maxLng, p.lng)
    }
    const latRange = maxLat - minLat || 0.01
    const lngRange = maxLng - minLng || 0.01
    const padding = 20

    const toX = (lng: number) => padding + ((lng - minLng) / lngRange) * (width - 2 * padding)
    const toY = (lat: number) => height - padding - ((lat - minLat) / latRange) * (height - 2 * padding)

    // Draw route (completed)
    ctx.beginPath()
    ctx.strokeStyle = '#f59e0b40'
    ctx.lineWidth = 3
    for (let i = 0; i < trackData.length; i++) {
      const x = toX(trackData[i].lng)
      const y = toY(trackData[i].lat)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Draw completed portion
    ctx.beginPath()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 3
    for (let i = 0; i <= currentIndex && i < trackData.length; i++) {
      const x = toX(trackData[i].lng)
      const y = toY(trackData[i].lat)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Draw current position
    if (currentPoint) {
      const cx = toX(currentPoint.lng)
      const cy = toY(currentPoint.lat)

      // Glow effect
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 15)
      gradient.addColorStop(0, '#f59e0b80')
      gradient.addColorStop(1, '#f59e0b00')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(cx, cy, 15, 0, Math.PI * 2)
      ctx.fill()

      // Dot
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fill()

      // Direction arrow
      if (currentIndex < trackData.length - 1) {
        const nextPoint = trackData[currentIndex + 1]
        const nx = toX(nextPoint.lng)
        const ny = toY(nextPoint.lat)
        const angle = Math.atan2(ny - cy, nx - cx)
        const arrowLen = 12

        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * arrowLen, cy + Math.sin(angle) * arrowLen)
        ctx.stroke()
      }
    }

    // Draw elevation profile at bottom
    if (trackData.some(p => p.alt !== null)) {
      const elevationHeight = 30
      const elevationY = height - elevationHeight
      ctx.fillStyle = '#1e293b80'
      ctx.fillRect(0, elevationY, width, elevationHeight)

      let minAlt = Infinity, maxAlt = -Infinity
      for (const p of trackData) {
        if (p.alt !== null) {
          minAlt = Math.min(minAlt, p.alt)
          maxAlt = Math.max(maxAlt, p.alt)
        }
      }
      const altRange = maxAlt - minAlt || 1

      ctx.beginPath()
      ctx.strokeStyle = '#22c55e80'
      ctx.lineWidth = 1
      for (let i = 0; i < trackData.length; i++) {
        if (trackData[i].alt !== null) {
          const x = padding + (i / (trackData.length - 1)) * (width - 2 * padding)
          const y = elevationY + elevationHeight - ((trackData[i].alt! - minAlt) / altRange) * (elevationHeight - 4)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      // Current position line
      const progressX = padding + (currentIndex / (trackData.length - 1)) * (width - 2 * padding)
      ctx.strokeStyle = '#f59e0b60'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(progressX, elevationY)
      ctx.lineTo(progressX, height)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [trackData, currentIndex, currentPoint])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  useEffect(() => {
    if (!isPlaying || trackData.length < 2) return

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const delta = timestamp - lastTimeRef.current
      const stepInterval = 50 / speedMultiplier

      if (delta >= stepInterval) {
        lastTimeRef.current = timestamp
        setCurrentIndex(prev => {
          const next = prev + 1
          if (next >= trackData.length) {
            setIsPlaying(false)
            return prev
          }
          setProgress((next / (trackData.length - 1)) * 100)
          return next
        })
      }
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, speedMultiplier, trackData.length])

  const handleReset = () => {
    setIsPlaying(false)
    setCurrentIndex(0)
    setProgress(0)
    lastTimeRef.current = 0
  }

  const handleProgressChange = (value: number[]) => {
    const newProgress = value[0]
    setProgress(newProgress)
    const newIndex = Math.round((newProgress / 100) * (trackData.length - 1))
    setCurrentIndex(newIndex)
  }

  if (!trackData || trackData.length < 2) {
    return null
  }

  return (
    <Card className="border-amber-500/30">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-1">
            <RouteIcon className="h-4 w-4 text-amber-500" />
            {title ?? 'Predvajaj vožnjo'}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {currentIndex + 1} / {totalPoints} točk
          </Badge>
        </div>

        {/* Canvas */}
        <div className="rounded-lg overflow-hidden border border-border">
          <canvas
            ref={canvasRef}
            width={600}
            height={300}
            className="w-full h-auto"
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
            <span className="text-xs font-medium">
              {currentPoint ? Math.round((trackData.slice(0, currentIndex + 1).reduce((sum, p, i) => {
                if (i === 0) return 0
                const prev = trackData[i - 1]
                const dt = (p.timestamp - prev.timestamp) / 1000
                const dist = Math.sqrt(
                  Math.pow((p.lat - prev.lat) * 111000, 2) +
                  Math.pow((p.lng - prev.lng) * 111000 * Math.cos(prev.lat * Math.PI / 180), 2)
                )
                return dt > 0 ? sum + (dist / dt) * 3.6 : sum
              }, 0) / Math.max(currentIndex, 1))) : 0} km/h
            </span>
            <span className="text-[10px] text-muted-foreground">Hitrost</span>
          </div>
          <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
            <Mountain className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
            <span className="text-xs font-medium">
              {currentPoint?.alt ? `${Math.round(currentPoint.alt)} m` : '—'}
            </span>
            <span className="text-[10px] text-muted-foreground">Nadm. viš.</span>
          </div>
          <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
            <FastForward className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
            <span className="text-xs font-medium">{speedMultiplier}x</span>
            <span className="text-[10px] text-muted-foreground">Hitrost</span>
          </div>
        </div>

        {/* Progress slider */}
        <Slider
          value={[progress]}
          onValueChange={handleProgressChange}
          max={100}
          step={0.1}
          className="py-1"
        />

        {/* Controls */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 w-8 p-0"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            variant={isPlaying ? 'outline' : 'default'}
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className={isPlaying ? 'h-9 w-9 p-0' : 'h-9 gap-1 bg-amber-600 hover:bg-amber-700'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <div className="flex items-center gap-1">
            {([1, 2, 4, 8] as SpeedMultiplier[]).map(speed => (
              <Button
                key={speed}
                variant={speedMultiplier === speed ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSpeedMultiplier(speed)}
                className={`h-7 w-7 p-0 text-xs ${speedMultiplier === speed ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
