'use client'

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import L from 'leaflet'
import { Eye, EyeOff, Activity, BarChart3, TrendingUp } from 'lucide-react'

// ─── Re-export helpers from twistiness-score ──────────────────────────
// We import the functions directly since they are not exported from twistiness-score.tsx
// Instead we re-implement the core calculation functions here for the heatmap

/** Calculate bearing (direction in degrees) between two GPS points */
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const la1 = (lat1 * Math.PI) / 180
  const la2 = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Smallest absolute difference between two bearings (0-180) */
function bearingDiff(b1: number, b2: number): number {
  const d = Math.abs(b1 - b2)
  return d > 180 ? 360 - d : d
}

/** Road classification from twistiness score */
function classifyRoad(score: number): { label: string; emoji: string; color: string } {
  if (score >= 80) return { label: 'Ekstremna', emoji: '🔥', color: '#10b981' }
  if (score >= 60) return { label: 'Zelo vijugasta', emoji: '🐍', color: '#22c55e' }
  if (score >= 40) return { label: 'Vijugasta', emoji: '🌀', color: '#eab308' }
  if (score >= 20) return { label: 'Rahlo vijugasta', emoji: '↪️', color: '#f97316' }
  return { label: 'Ravna cesta', emoji: '➡️', color: '#ef4444' }
}

/** Score → color for heatmap polylines */
function scoreColor(score: number): string {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#22c55e'
  if (score >= 40) return '#eab308'
  if (score >= 20) return '#f97316'
  return '#ef4444'
}

/** Score → line width (thicker = twistier, more fun) */
function scoreWeight(score: number): number {
  if (score >= 80) return 7
  if (score >= 60) return 6
  if (score >= 40) return 5
  if (score >= 20) return 4
  return 3
}

// ─── Haversine for window distance ────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Segment computation ──────────────────────────────────────────────

interface TwistinessSegment {
  start: [number, number] // [lat, lng]
  end: [number, number]
  score: number
  color: string
  label: string
  emoji: string
  weight: number
}

const SCALE_FACTOR = 15
const WINDOW_DISTANCE_KM = 0.5 // ~500m sliding window
const DOWNSAMPLE_THRESHOLD = 1000

/**
 * Compute twistiness segments from an array of points.
 * Uses a sliding window of ~500m to calculate bearing changes and produce a score per segment.
 */
function computeTwistinessSegments(
  points: Array<{ lat: number; lng: number }>,
  opacity: number
): TwistinessSegment[] {
  if (points.length < 3) return []

  // Downsample for performance if 1000+ points
  let pts = points
  if (points.length >= DOWNSAMPLE_THRESHOLD) {
    pts = points.filter((_, i) => i % 3 === 0 || i === points.length - 1)
  }

  if (pts.length < 3) return []

  // Calculate bearings between consecutive points
  const bearings: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    bearings.push(calculateBearing(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng))
  }

  // Calculate distances between consecutive points
  const distances: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    distances.push(haversineKm(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng))
  }

  // For each segment (pair of consecutive bearings), compute a sliding window score
  const segments: TwistinessSegment[] = []

  for (let i = 1; i < pts.length - 1; i++) {
    // Build a window around this point: accumulate distances until we reach ~500m in each direction
    let windowBearingChange = 0
    let windowDist = 0
    let windowStart = i
    let windowEnd = i

    // Expand window backwards
    for (let j = i; j >= 1; j--) {
      const segDist = distances[j - 1] || 0
      if (windowDist + segDist > WINDOW_DISTANCE_KM / 2 && windowDist > 0) break
      windowDist += segDist
      windowStart = j
    }

    // Expand window forwards
    for (let j = i; j < bearings.length; j++) {
      const segDist = distances[j] || 0
      windowDist += segDist
      windowEnd = j + 1
      if (windowDist >= WINDOW_DISTANCE_KM) break
    }

    // Sum bearing changes in window
    for (let j = Math.max(1, windowStart); j < Math.min(bearings.length, windowEnd); j++) {
      windowBearingChange += bearingDiff(bearings[j - 1], bearings[j])
    }

    // Calculate score
    const effectiveDistance = windowDist > 0.01 ? windowDist : 0.01
    const rawScore = (windowBearingChange / effectiveDistance) * SCALE_FACTOR
    const score = Math.min(100, Math.max(0, Math.round(rawScore)))
    const classification = classifyRoad(score)

    segments.push({
      start: [pts[i].lat, pts[i].lng],
      end: [pts[i + 1].lat, pts[i + 1].lng],
      score,
      color: classification.color,
      label: classification.label,
      emoji: classification.emoji,
      weight: scoreWeight(score),
    })
  }

  return segments
}

// ─── Props ────────────────────────────────────────────────────────────

interface TwistinessHeatmapProps {
  points: Array<{ lat: number; lng: number }>
  map: L.Map | null
  visible: boolean
  opacity?: number
  showLegend?: boolean
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────

export default function TwistinessHeatmap({
  points,
  map,
  visible,
  opacity = 0.7,
  showLegend = true,
  className = '',
}: TwistinessHeatmapProps) {
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const [legendVisible, setLegendVisible] = useState(true)
  const [statsExpanded, setStatsExpanded] = useState(false)

  // Compute twistiness segments
  const segments = useMemo(
    () => computeTwistinessSegments(points, opacity),
    [points, opacity]
  )

  // Compute statistics
  const stats = useMemo(() => {
    if (segments.length === 0) return null

    const avgScore = segments.reduce((sum, s) => sum + s.score, 0) / segments.length
    const maxSegment = segments.reduce((max, s) => (s.score > max.score ? s : max), segments[0])

    const countByCategory = {
      extreme: segments.filter(s => s.score >= 80).length,
      veryTwisty: segments.filter(s => s.score >= 60 && s.score < 80).length,
      twisty: segments.filter(s => s.score >= 40 && s.score < 60).length,
      slightly: segments.filter(s => s.score >= 20 && s.score < 40).length,
      straight: segments.filter(s => s.score < 20).length,
    }

    return {
      averageScore: Math.round(avgScore),
      mostTwistySegment: maxSegment,
      countByCategory,
      totalSegments: segments.length,
    }
  }, [segments])

  // Render heatmap polylines on the map
  useEffect(() => {
    // Clean up previous layer
    if (layerGroupRef.current) {
      layerGroupRef.current.clearLayers()
      if (map) {
        map.removeLayer(layerGroupRef.current)
      }
      layerGroupRef.current = null
    }

    if (!map || !visible || segments.length === 0) return

    // Create a new layer group
    const layerGroup = L.layerGroup()
    layerGroupRef.current = layerGroup

    // Batch add polylines
    const polylines: L.Polyline[] = []
    for (const seg of segments) {
      const polyline = L.polyline([seg.start, seg.end] as L.LatLngExpression[], {
        color: seg.color,
        weight: seg.weight,
        opacity: opacity,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round',
      })

      // Tooltip with score and classification
      polyline.bindTooltip(
        `<div style="font-size:11px;line-height:1.3;min-width:100px">
          <strong>${seg.emoji} ${seg.label}</strong><br/>
          <span style="color:${seg.color};font-weight:700">Ocena: ${seg.score}/100</span><br/>
          <span style="color:#888;font-size:10px">Zelena = vijugasta (zabavna)<br/>Rdeča = ravna (dolgočasna)</span>
        </div>`,
        { sticky: true, direction: 'top', offset: [0, -5] }
      )

      polylines.push(polyline)
    }

    // Add all polylines to layer group
    polylines.forEach(p => p.addTo(layerGroup))

    // Add layer group to map
    layerGroup.addTo(map)

    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers()
        if (map) {
          map.removeLayer(layerGroupRef.current)
        }
        layerGroupRef.current = null
      }
    }
  }, [map, visible, segments, opacity])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (layerGroupRef.current && map) {
        layerGroupRef.current.clearLayers()
        map.removeLayer(layerGroupRef.current)
        layerGroupRef.current = null
      }
    }
  }, [])

  if (!visible || !map) return null

  return (
    <>
      {/* Color Legend - floating bottom-right of map */}
      {showLegend && legendVisible && (
        <div
          className={`absolute bottom-4 right-3 z-[1002] bg-black/80 backdrop-blur-md rounded-lg border border-white/15 shadow-xl text-white ${className}`}
          style={{ maxWidth: '200px' }}
        >
          {/* Legend header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Vijugavost</span>
            </div>
            <button
              onClick={() => setLegendVisible(false)}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
              title="Skrij legendo"
            >
              <EyeOff className="size-3 text-white/50" />
            </button>
          </div>

          {/* Color scale */}
          <div className="px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#10b981' }} />
              <span className="text-[10px] font-medium">Ekstremna 🔥</span>
              <span className="text-[8px] text-white/40 ml-auto">80+</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
              <span className="text-[10px] font-medium">Zelo vijugasta 🐍</span>
              <span className="text-[8px] text-white/40 ml-auto">60-80</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#eab308' }} />
              <span className="text-[10px] font-medium">Vijugasta 🌀</span>
              <span className="text-[8px] text-white/40 ml-auto">40-60</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#f97316' }} />
              <span className="text-[10px] font-medium">Rahlo vijugasta ↪️</span>
              <span className="text-[8px] text-white/40 ml-auto">20-40</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-[10px] font-medium">Ravna cesta ➡️</span>
              <span className="text-[8px] text-white/40 ml-auto">0-20</span>
            </div>

            {/* Color gradient bar */}
            <div className="h-1.5 rounded-full overflow-hidden flex mt-1">
              <div className="flex-1 bg-red-500" />
              <div className="flex-1 bg-orange-500" />
              <div className="flex-1 bg-yellow-500" />
              <div className="flex-1 bg-green-500" />
              <div className="flex-1 bg-emerald-500" />
            </div>
            <div className="flex justify-between text-[8px] text-white/40">
              <span>Dolgočasna</span>
              <span>Zabavna!</span>
            </div>
          </div>

          {/* Statistics */}
          {stats && (
            <div className="border-t border-white/10 px-3 py-2 space-y-1.5">
              <button
                onClick={() => setStatsExpanded(!statsExpanded)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="size-3 text-white/60" />
                  <span className="text-[10px] font-semibold">Statistika</span>
                </div>
                <TrendingUp className={`size-3 text-white/40 transition-transform ${statsExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Average score */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/60">Povprečje:</span>
                <span
                  className="text-xs font-bold"
                  style={{ color: scoreColor(stats.averageScore) }}
                >
                  {stats.averageScore}/100
                </span>
                <span className="text-[9px]" style={{ color: scoreColor(stats.averageScore) }}>
                  {classifyRoad(stats.averageScore).emoji} {classifyRoad(stats.averageScore).label}
                </span>
              </div>

              {/* Most twisty segment */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/60">Najbolj vijugast:</span>
                <span className="text-[9px]" style={{ color: stats.mostTwistySegment.color }}>
                  {stats.mostTwistySegment.emoji} {stats.mostTwistySegment.score}/100
                </span>
              </div>

              {statsExpanded && (
                <div className="space-y-1 pt-1">
                  <div className="text-[9px] text-white/40 font-medium uppercase tracking-wider">Razdelitev odsekov</div>
                  {stats.countByCategory.extreme > 0 && (
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="size-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#10b981' }} />
                      <span className="text-white/70">Ekstremna: {stats.countByCategory.extreme}</span>
                      <span className="text-white/30 ml-auto">{Math.round((stats.countByCategory.extreme / stats.totalSegments) * 100)}%</span>
                    </div>
                  )}
                  {stats.countByCategory.veryTwisty > 0 && (
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="size-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
                      <span className="text-white/70">Zelo vijugasta: {stats.countByCategory.veryTwisty}</span>
                      <span className="text-white/30 ml-auto">{Math.round((stats.countByCategory.veryTwisty / stats.totalSegments) * 100)}%</span>
                    </div>
                  )}
                  {stats.countByCategory.twisty > 0 && (
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="size-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#eab308' }} />
                      <span className="text-white/70">Vijugasta: {stats.countByCategory.twisty}</span>
                      <span className="text-white/30 ml-auto">{Math.round((stats.countByCategory.twisty / stats.totalSegments) * 100)}%</span>
                    </div>
                  )}
                  {stats.countByCategory.slightly > 0 && (
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="size-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#f97316' }} />
                      <span className="text-white/70">Rahlo vijugasta: {stats.countByCategory.slightly}</span>
                      <span className="text-white/30 ml-auto">{Math.round((stats.countByCategory.slightly / stats.totalSegments) * 100)}%</span>
                    </div>
                  )}
                  {stats.countByCategory.straight > 0 && (
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="size-2 rounded-sm flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
                      <span className="text-white/70">Ravna: {stats.countByCategory.straight}</span>
                      <span className="text-white/30 ml-auto">{Math.round((stats.countByCategory.straight / stats.totalSegments) * 100)}%</span>
                    </div>
                  )}
                  <div className="text-[8px] text-white/30 pt-1">
                    Skupaj {stats.totalSegments} odsekov
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legend explanation */}
          <div className="px-3 py-1.5 border-t border-white/10">
            <p className="text-[8px] text-white/30 leading-tight">
              Zelena = vijugasta (zabavna), Rdeča = ravna (dolgočasna)
            </p>
          </div>
        </div>
      )}

      {/* Show legend toggle button when legend is hidden */}
      {showLegend && !legendVisible && (
        <button
          onClick={() => setLegendVisible(true)}
          className="absolute bottom-4 right-3 z-[1002] flex items-center gap-1 px-2 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm border border-white/15 text-white/70 hover:text-white hover:bg-black/80 transition-colors shadow-lg"
          title="Prikaži legendo vijugavosti"
        >
          <Eye className="size-3.5" />
          <span className="text-[9px] font-medium">Legenda</span>
        </button>
      )}
    </>
  )
}
