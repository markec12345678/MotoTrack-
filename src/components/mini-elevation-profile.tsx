'use client'

import React, { useMemo } from 'react'
import { Mountain } from 'lucide-react'
import type { TrackPoint } from '@/components/tabs/types'

// Haversine distance in meters between two coordinates
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface ElevationDataPoint {
  distance: number // cumulative distance in meters
  altitude: number // meters
}

interface MiniElevationProfileProps {
  trackPoints: TrackPoint[]
  className?: string
}

export default function MiniElevationProfile({ trackPoints, className }: MiniElevationProfileProps) {
  // Process track points: compute cumulative distance + interpolate null altitudes
  const { elevationData, currentAlt, totalAscent, totalDescent, maxAlt, minAlt, maxDistance } = useMemo(() => {
    if (trackPoints.length < 2) {
      return { elevationData: [], currentAlt: 0, totalAscent: 0, totalDescent: 0, maxAlt: 0, minAlt: 0, maxDistance: 0 }
    }

    // Extract altitude values for interpolation
    const alts = trackPoints.map((p) => p.alt)

    // Interpolate null altitudes: fill forward/backward
    const interpolated = [...alts]
    // First pass: forward fill
    let lastValid: number | null = null
    for (let i = 0; i < interpolated.length; i++) {
      if (interpolated[i] !== null) {
        lastValid = interpolated[i]
      } else if (lastValid !== null) {
        interpolated[i] = lastValid
      }
    }
    // Second pass: backward fill for leading nulls
    let nextValid: number | null = null
    for (let i = interpolated.length - 1; i >= 0; i--) {
      if (interpolated[i] !== null) {
        nextValid = interpolated[i]
      } else if (nextValid !== null) {
        interpolated[i] = nextValid
      }
    }

    // Build elevation data with cumulative distance
    const data: ElevationDataPoint[] = []
    let cumDistance = 0
    data.push({ distance: 0, altitude: interpolated[0] ?? 0 })

    for (let i = 1; i < trackPoints.length; i++) {
      const prev = trackPoints[i - 1]
      const curr = trackPoints[i]
      const segDist = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng)
      cumDistance += segDist
      const alt = interpolated[i] ?? 0
      data.push({ distance: cumDistance, altitude: alt })
    }

    // Calculate total ascent/descent
    let ascent = 0
    let descent = 0
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].altitude - data[i - 1].altitude
      if (diff > 0) ascent += diff
      else descent += Math.abs(diff)
    }

    // Get current altitude (last point)
    const current = data[data.length - 1].altitude

    // Get min/max altitude
    let mn = Infinity
    let mx = -Infinity
    for (const d of data) {
      if (d.altitude < mn) mn = d.altitude
      if (d.altitude > mx) mx = d.altitude
    }

    return {
      elevationData: data,
      currentAlt: Math.round(current),
      totalAscent: Math.round(ascent),
      totalDescent: Math.round(descent),
      maxAlt: mx,
      minAlt: mn,
      maxDistance: cumDistance,
    }
  }, [trackPoints])

  // Don't render if not enough data with altitude
  const validAltCount = trackPoints.filter((p) => p.alt !== null).length
  if (validAltCount < 5 || elevationData.length < 5 || maxDistance < 10) {
    return null
  }

  // SVG dimensions
  const svgWidth = 320
  const svgHeight = 56
  const padding = { top: 8, bottom: 8, left: 0, right: 0 }
  const chartWidth = svgWidth - padding.left - padding.right
  const chartHeight = svgHeight - padding.top - padding.bottom

  // 3-point moving average for smoothing
  const smoothedData = elevationData.map((point, i) => {
    if (i === 0 || i === elevationData.length - 1) return point
    const prev = elevationData[i - 1]
    const curr = elevationData[i]
    const next = elevationData[i + 1]
    return {
      distance: curr.distance,
      altitude: (prev.altitude + curr.altitude + next.altitude) / 3,
    }
  })

  // Calculate SVG path points
  const altRange = maxAlt - minAlt || 1 // avoid division by zero
  const pathPoints = smoothedData.map((d) => {
    const x = maxDistance > 0 ? (d.distance / maxDistance) * chartWidth + padding.left : padding.left
    const yNorm = (d.altitude - minAlt) / altRange // 0 to 1 (1 = highest)
    const y = padding.top + chartHeight * (1 - yNorm * 0.8 - 0.1) // leave 10% margin top and bottom
    return { x, y }
  })

  // Build SVG path string (area fill path)
  const buildAreaPath = () => {
    if (pathPoints.length === 0) return ''
    let d = `M ${pathPoints[0].x} ${svgHeight - padding.bottom}`
    for (const p of pathPoints) {
      d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    }
    d += ` L ${pathPoints[pathPoints.length - 1].x} ${svgHeight - padding.bottom} Z`
    return d
  }

  // Build SVG stroke path (just the line, no fill)
  const buildStrokePath = () => {
    if (pathPoints.length === 0) return ''
    let d = `M ${pathPoints[0].x.toFixed(1)} ${pathPoints[0].y.toFixed(1)}`
    for (let i = 1; i < pathPoints.length; i++) {
      d += ` L ${pathPoints[i].x.toFixed(1)} ${pathPoints[i].y.toFixed(1)}`
    }
    return d
  }

  // Current position marker (right edge)
  const currentPoint = pathPoints[pathPoints.length - 1]

  return (
    <div className={`w-full ${className ?? ''}`}>
      {/* Label */}
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <Mountain className="size-3 text-orange-400" />
        <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider">Višinski profil</span>
      </div>

      {/* SVG Elevation Profile */}
      <div className="relative w-full rounded-lg overflow-hidden bg-white/5">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: '56px' }}
        >
          <defs>
            {/* Gradient fill for the area under the curve */}
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#f97316" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
            </linearGradient>
            {/* Pulse animation for current position dot */}
            <radialGradient id="pulseGradient">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Area fill */}
          <path d={buildAreaPath()} fill="url(#elevGradient)" />

          {/* Stroke line */}
          <path
            d={buildStrokePath()}
            fill="none"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current position pulsing dot */}
          {currentPoint && (
            <>
              <circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r="6"
                fill="url(#pulseGradient)"
                className="animate-ping"
                style={{ animationDuration: '1.5s' }}
              />
              <circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r="3"
                fill="#f97316"
                stroke="#fff"
                strokeWidth="1"
              />
            </>
          )}
        </svg>

        {/* Current elevation text overlay */}
        <div className="absolute top-1 left-1.5">
          <span className="text-[10px] font-bold text-white/80">
            ↑ {currentAlt}m
          </span>
        </div>

        {/* Ascent/Descent stats overlay */}
        <div className="absolute bottom-1 right-1.5 flex items-center gap-2">
          <span className="text-[9px] font-medium text-green-400/80">⬆ {totalAscent}m</span>
          <span className="text-[9px] font-medium text-red-400/80">⬇ {totalDescent}m</span>
        </div>
      </div>
    </div>
  )
}
