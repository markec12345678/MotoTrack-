'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  GitCompare, Trophy, Bike, Route, Clock, ChevronDown,
  Gauge, Mountain, BarChart3, ArrowLeft, AlertTriangle, Zap, Flag,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RideData, TrackPoint } from '@/components/tabs/types'
import { formatDuration, formatDate, haversine } from '@/components/tabs/types'

const RIDE_COLORS = ['#f97316', '#06b6d4']
const RIDE_COLOR_CLASSES = ['bg-orange-500', 'bg-cyan-500']
const RIDE_TEXT_CLASSES = ['text-orange-500', 'text-cyan-500']
const RIDE_BG_CLASSES = ['bg-orange-500/15', 'bg-cyan-500/15']
const RIDE_BORDER_CLASSES = ['border-orange-500/30', 'border-cyan-500/30']

interface RideComparisonPanelProps {
  rides: RideData[]
  userId?: string
}

type MetricKey = 'distance' | 'duration' | 'avgSpeed' | 'maxSpeed' | 'elevation'

interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  icon: React.ReactNode
  getValue: (r: RideData) => number
  higherIsBetter: boolean
}

const METRICS: MetricDef[] = [
  { key: 'distance', label: 'Razdalja', unit: 'km', icon: <Route className="size-4" />, getValue: r => r.distance, higherIsBetter: true },
  { key: 'duration', label: 'Trajanje', unit: '', icon: <Clock className="size-4" />, getValue: r => r.duration, higherIsBetter: false },
  { key: 'avgSpeed', label: 'Povp. hitrost', unit: 'km/h', icon: <Gauge className="size-4" />, getValue: r => r.avgSpeed, higherIsBetter: true },
  { key: 'maxSpeed', label: 'Max hitrost', unit: 'km/h', icon: <Zap className="size-4" />, getValue: r => r.maxSpeed, higherIsBetter: true },
  { key: 'elevation', label: 'Višina', unit: 'm', icon: <Mountain className="size-4" />, getValue: r => r.elevation, higherIsBetter: true },
]

function formatMetricValue(key: MetricKey, value: number): string {
  if (key === 'duration') return formatDuration(value)
  if (key === 'distance') return value.toFixed(1)
  if (key === 'elevation') return value.toFixed(0)
  return value.toFixed(1)
}

// Parse trackData: "[[lat, lng, alt, timestamp], ...]"
function parseTrackData(trackData: string): TrackPoint[] {
  try {
    const raw = typeof trackData === 'string' ? JSON.parse(trackData) : trackData
    if (!Array.isArray(raw)) return []
    return raw
      .filter((p: unknown[]) => Array.isArray(p) && p.length >= 2)
      .map((p: number[]) => ({
        lat: p[0],
        lng: p[1],
        alt: p[2] != null ? p[2] : null,
        timestamp: p[3] || 0,
      }))
      .filter((p: TrackPoint) => p.lat !== 0 && p.lng !== 0)
  } catch {
    return []
  }
}

// Compute distance array (cumulative, in km)
function computeCumulativeDistance(points: TrackPoint[]): number[] {
  const dists: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
    dists.push(dists[i - 1] + d)
  }
  return dists
}

// Compute speed array (km/h) between consecutive points
function computeSpeeds(points: TrackPoint[], cumDists: number[]): number[] {
  if (points.length < 2) return points.length === 1 ? [0] : []
  const speeds: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i].timestamp - points[i - 1].timestamp) / 1000 // seconds
    const dd = (cumDists[i] - cumDists[i - 1]) * 1000 // meters -> km already in cumDists
    if (dt > 0) {
      const speed = (dd / dt) * 3600 // km/h
      speeds.push(Math.min(speed, 300)) // cap at 300 km/h for sanity
    } else {
      speeds.push(speeds[i - 1])
    }
  }
  return speeds
}

// Smooth an array using a simple moving average
function smoothArray(arr: number[], windowSize: number): number[] {
  if (arr.length === 0) return []
  const result: number[] = []
  const half = Math.floor(windowSize / 2)
  for (let i = 0; i < arr.length; i++) {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - half); j <= Math.min(arr.length - 1, i + half); j++) {
      sum += arr[j]
      count++
    }
    result.push(sum / count)
  }
  return result
}

// Downsample array to maxN points
function downsample(arr: number[], maxN: number): number[] {
  if (arr.length <= maxN) return arr
  const step = arr.length / maxN
  const result: number[] = []
  for (let i = 0; i < maxN; i++) {
    const idx = Math.min(Math.floor(i * step), arr.length - 1)
    result.push(arr[idx])
  }
  return result
}

// SVG profile chart component
function SVGProfileChart({
  label,
  unit,
  ridesData,
  yLabel,
  showAreas,
  className,
}: {
  label: string
  unit: string
  yLabel: string
  ridesData: Array<{
    color: string
    title: string
    distances: number[]
    values: number[]
    maxDist: number
  }>
  showAreas?: boolean
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgWidth, setSvgWidth] = useState(600)
  const margin = { top: 20, right: 16, bottom: 36, left: 48 }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSvgWidth(Math.max(entry.contentRect.width, 200))
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const chartW = svgWidth - margin.left - margin.right
  const chartH = 180

  // Compute global max distance and Y range
  const maxDist = Math.max(...ridesData.map(r => r.maxDist), 1)
  const allValues = ridesData.flatMap(r => r.values)
  const yMin = Math.min(...allValues, 0)
  const yMax = Math.max(...allValues, 1)
  const yPad = (yMax - yMin) * 0.08 || 1
  const yLo = Math.floor(yMin - yPad)
  const yHi = Math.ceil(yMax + yPad)

  const toX = (d: number) => margin.left + (d / maxDist) * chartW
  const toY = (v: number) => margin.top + chartH - ((v - yLo) / (yHi - yLo)) * chartH

  // Y-axis ticks
  const yTicks = 5
  const yStep = (yHi - yLo) / yTicks
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => yLo + i * yStep)

  // X-axis ticks
  const xTicks = 5
  const xStep = maxDist / xTicks
  const xTickVals = Array.from({ length: xTicks + 1 }, (_, i) => i * xStep)

  // Build polylines and areas
  const polylines = ridesData.map(rd => {
    const points = rd.distances.map((d, i) => `${toX(d)},${toY(rd.values[i])}`).join(' ')
    return { color: rd.color, title: rd.title, points, values: rd.values, distances: rd.distances }
  })

  const areas = ridesData.map(rd => {
    const baseY = toY(Math.max(yLo, 0))
    const linePoints = rd.distances.map((d, i) => `${toX(d)},${toY(rd.values[i])}`).join(' ')
    const firstX = toX(rd.distances[0])
    const lastX = toX(rd.distances[rd.distances.length - 1])
    return {
      color: rd.color,
      path: `M${firstX},${baseY} L${linePoints.replace(/,/g, ' L').replace(/ L(\d+\.\d+)/g, ',$1')} L${lastX},${baseY} Z`,
      rawPath: `M${firstX},${baseY} ${rd.distances.map((d, i) => `L${toX(d)},${toY(rd.values[i])}`).join(' ')} L${lastX},${baseY} Z`,
    }
  })

  // Max value markers
  const maxMarkers = ridesData.map(rd => {
    const maxIdx = rd.values.indexOf(Math.max(...rd.values))
    if (maxIdx < 0 || rd.distances.length === 0) return null
    return {
      color: rd.color,
      title: rd.title,
      x: toX(rd.distances[maxIdx]),
      y: toY(rd.values[maxIdx]),
      value: rd.values[maxIdx],
      dist: rd.distances[maxIdx],
    }
  })

  if (ridesData.length === 0 || ridesData.every(r => r.distances.length === 0)) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-2">{label}</p>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm gap-2">
            <AlertTriangle className="size-4" /> Ni podatkov o sledi
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
          {showAreas ? <Mountain className="size-4 text-emerald-500" /> : <Gauge className="size-4 text-amber-500" />}
          {label}
        </p>
        <div ref={containerRef} className="w-full overflow-hidden">
          <svg width={svgWidth} height={chartH + margin.top + margin.bottom} className="block">
            {/* Y-axis grid lines */}
            {yTickVals.map(v => (
              <line key={`y-${v}`} x1={margin.left} y1={toY(v)} x2={svgWidth - margin.right} y2={toY(v)} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3,3" />
            ))}

            {/* X-axis grid lines */}
            {xTickVals.map(v => (
              <line key={`x-${v}`} x1={toX(v)} y1={margin.top} x2={toX(v)} y2={margin.top + chartH} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3,3" />
            ))}

            {/* Filled areas under curves */}
            {showAreas && areas.map((area, i) => (
              <path key={`area-${i}`} d={area.rawPath} fill={area.color} fillOpacity={0.12} stroke="none" />
            ))}

            {/* Polylines */}
            {polylines.map((pl, i) => (
              <polyline key={`line-${i}`} points={pl.points} fill="none" stroke={pl.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {/* Max value markers */}
            {maxMarkers.filter(Boolean).map((m, i) => (
              <g key={`marker-${i}`}>
                <circle cx={m!.x} cy={m!.y} r={4} fill={m!.color} stroke="white" strokeWidth={1.5} />
                <text x={m!.x + 6} y={m!.y - 6} fill={m!.color} fontSize={10} fontWeight="bold">
                  {m!.value.toFixed(0)} {unit}
                </text>
              </g>
            ))}

            {/* Y-axis labels */}
            {yTickVals.map(v => (
              <text key={`yt-${v}`} x={margin.left - 6} y={toY(v) + 3} textAnchor="end" fill="currentColor" fillOpacity={0.5} fontSize={9}>
                {v.toFixed(0)}
              </text>
            ))}

            {/* X-axis labels */}
            {xTickVals.map(v => (
              <text key={`xt-${v}`} x={toX(v)} y={margin.top + chartH + 16} textAnchor="middle" fill="currentColor" fillOpacity={0.5} fontSize={9}>
                {v.toFixed(1)}
              </text>
            ))}

            {/* Axis labels */}
            <text x={svgWidth / 2} y={margin.top + chartH + 30} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontSize={9}>
              Razdalja (km)
            </text>
            <text x={12} y={margin.top + chartH / 2} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontSize={9} transform={`rotate(-90,12,${margin.top + chartH / 2})`}>
              {yLabel} ({unit})
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          {ridesData.map((rd, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <div className="size-2.5 rounded-full" style={{ backgroundColor: rd.color }} />
              <span className="text-muted-foreground truncate max-w-[100px]">{rd.title}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Segment analysis component
function SegmentAnalysis({ selectedRides }: { selectedRides: RideData[] }) {
  const segmentData = useMemo(() => {
    return selectedRides.map(ride => {
      const points = parseTrackData(ride.trackData)
      if (points.length < 3) {
        return { title: ride.title, segments: [0, 0, 0], hasData: false }
      }
      const cumDists = computeCumulativeDistance(points)
      const speeds = computeSpeeds(points, cumDists)
      const smoothSpeeds = smoothArray(speeds, 5)
      const totalDist = cumDists[cumDists.length - 1]
      if (totalDist === 0) {
        return { title: ride.title, segments: [0, 0, 0], hasData: false }
      }
      const third = totalDist / 3
      const segments = [0, 1, 2].map(seg => {
        const startDist = seg * third
        const endDist = (seg + 1) * third
        let sumSpeed = 0
        let count = 0
        for (let i = 0; i < cumDists.length; i++) {
          if (cumDists[i] >= startDist && cumDists[i] < endDist) {
            sumSpeed += smoothSpeeds[i]
            count++
          }
        }
        return count > 0 ? sumSpeed / count : 0
      })
      return { title: ride.title, segments, hasData: true }
    })
  }, [selectedRides])

  const segmentLabels = ['Začetek', 'Sredina', 'Konec']
  const segmentIcons = [<Flag key="start" className="size-3.5" />, <BarChart3 key="mid" className="size-3.5" />, <Flag key="end" className="size-3.5" />]

  // Determine winner per segment
  const segmentWinners = useMemo(() => {
    if (segmentData.length < 2) return [null, null, null]
    return [0, 1, 2].map(seg => {
      const speeds = segmentData.map(s => s.segments[seg])
      const maxSpeed = Math.max(...speeds)
      if (maxSpeed === 0) return null
      return speeds.indexOf(maxSpeed)
    })
  }, [segmentData])

  const hasAnyData = segmentData.some(s => s.hasData)

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-violet-500" /> Segmenti
        </p>
        {!hasAnyData ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm gap-2">
            <AlertTriangle className="size-4" /> Ni podatkov o sledi za analizo
          </div>
        ) : (
          <div className="space-y-3">
            {segmentLabels.map((segLabel, segIdx) => (
              <div key={segIdx} className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium">
                  {segmentIcons[segIdx]}
                  <span>{segLabel}</span>
                  <span className="text-muted-foreground">
                    ({(selectedRides[0]?.distance || 0) / 3 * segIdx | 0}–{((selectedRides[0]?.distance || 0) / 3 * (segIdx + 1)).toFixed(1)} km)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {segmentData.map((sd, rideIdx) => {
                    const isWinner = segmentWinners[segIdx] === rideIdx
                    const maxSegSpeed = Math.max(...segmentData.map(s => s.segments[segIdx]), 1)
                    const barPct = (sd.segments[segIdx] / maxSegSpeed) * 100
                    return (
                      <div
                        key={rideIdx}
                        className={`rounded-lg p-2.5 border transition-colors ${
                          isWinner
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : 'bg-secondary/50 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`size-2 rounded-full ${RIDE_COLOR_CLASSES[rideIdx]}`} />
                          <span className="text-xs text-muted-foreground truncate max-w-[80px]">{sd.title}</span>
                          {isWinner && (
                            <Badge className="shrink-0 text-[9px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-1.5 py-0">
                              🏆
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{sd.segments[segIdx].toFixed(1)} km/h</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${barPct}%`,
                                backgroundColor: RIDE_COLORS[rideIdx],
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Elevation markers component
function ElevationMarkers({ selectedRides }: { selectedRides: RideData[] }) {
  const markers = useMemo(() => {
    return selectedRides.map(ride => {
      const points = parseTrackData(ride.trackData)
      const alts = points.map(p => p.alt).filter((a): a is number => a !== null && a > -999)
      if (alts.length === 0) return { title: ride.title, high: null, low: null }
      return {
        title: ride.title,
        high: Math.max(...alts),
        low: Math.min(...alts),
      }
    })
  }, [selectedRides])

  const hasAnyAlts = markers.some(m => m.high !== null)

  if (!hasAnyAlts) return null

  return (
    <div className="grid grid-cols-2 gap-2">
      {markers.map((m, i) => (
        <div key={i} className={`rounded-lg p-3 border ${RIDE_BG_CLASSES[i]} ${RIDE_BORDER_CLASSES[i]}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className={`size-2.5 rounded-full ${RIDE_COLOR_CLASSES[i]}`} />
            <span className="text-xs font-medium truncate max-w-[100px]">{m.title}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Najvišja</p>
              <p className="text-sm font-bold text-emerald-500">{m.high?.toFixed(0) ?? '–'} m</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Najnižja</p>
              <p className="text-sm font-bold text-amber-500">{m.low?.toFixed(0) ?? '–'} m</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function RideComparisonPanel({ rides, userId }: RideComparisonPanelProps) {
  const [selectedRideIds, setSelectedRideIds] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [apiRides, setApiRides] = useState<RideData[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch rides from API
  const fetchApiRides = useCallback(async () => {
    setApiLoading(true)
    try {
      const params = new URLSearchParams()
      if (userId) params.set('userId', userId)
      params.set('limit', '50')
      const res = await fetch(`/api/rides?${params.toString()}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setApiRides(data.data)
      }
    } catch {
      // Silently fail
    } finally {
      setApiLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchApiRides()
  }, [fetchApiRides])

  // Combine prop rides and API rides, dedup by id
  const allRides = useMemo(() => {
    const map = new Map<string, RideData>()
    for (const r of rides) map.set(r.id, r)
    for (const r of apiRides) map.set(r.id, r)
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [rides, apiRides])

  const selectedRides = useMemo(
    () => selectedRideIds.map(id => allRides.find(r => r.id === id)).filter(Boolean) as RideData[],
    [selectedRideIds, allRides]
  )

  const availableRides = useMemo(
    () => allRides.filter(r => !selectedRideIds.includes(r.id)),
    [allRides, selectedRideIds]
  )

  const filteredRides = useMemo(
    () => {
      if (!searchQuery.trim()) return availableRides
      const q = searchQuery.toLowerCase()
      return availableRides.filter(r =>
        r.title.toLowerCase().includes(q) || formatDate(r.createdAt).toLowerCase().includes(q)
      )
    },
    [availableRides, searchQuery]
  )

  const toggleRide = (rideId: string) => {
    if (selectedRideIds.includes(rideId)) {
      setSelectedRideIds(prev => prev.filter(id => id !== rideId))
    } else if (selectedRideIds.length < 2) {
      setSelectedRideIds(prev => [...prev, rideId])
    }
  }

  // Best per metric
  const bestPerMetric = useMemo(() => {
    const result: Record<string, number> = {}
    if (selectedRides.length < 2) return result
    METRICS.forEach(m => {
      const values = selectedRides.map(r => m.getValue(r))
      result[m.key] = m.higherIsBetter ? Math.max(...values) : Math.min(...values)
    })
    return result
  }, [selectedRides])

  // Overall scores
  const rideScores = useMemo(() => {
    if (selectedRides.length < 2) return []
    return selectedRides.map((ride) => {
      let score = 0
      METRICS.forEach(m => {
        if (m.getValue(ride) === bestPerMetric[m.key]) score += 1
      })
      return { ride, score }
    })
  }, [selectedRides, bestPerMetric])

  const bestRide = useMemo(() => {
    if (rideScores.length === 0) return null
    return rideScores.reduce((a, b) => a.score > b.score ? a : b)
  }, [rideScores])

  // Compute profile data for SVG charts
  const profileData = useMemo(() => {
    return selectedRides.map((ride, idx) => {
      const points = parseTrackData(ride.trackData)
      if (points.length < 2) {
        return { speed: null, elevation: null, idx, title: ride.title }
      }
      const cumDists = computeCumulativeDistance(points)
      const speeds = computeSpeeds(points, cumDists)
      const smoothSpeeds = smoothArray(speeds, 7)
      const maxDist = cumDists[cumDists.length - 1]

      // Downsample for SVG performance
      const maxPoints = 200
      const dsDists = downsample(cumDists, maxPoints)
      const dsSpeeds = downsample(smoothSpeeds, maxPoints)
      const dsElevs = downsample(
        points.map(p => (p.alt != null && p.alt > -999 ? p.alt : 0)),
        maxPoints
      )

      return {
        speed: {
          color: RIDE_COLORS[idx],
          title: ride.title,
          distances: dsDists,
          values: dsSpeeds,
          maxDist,
        },
        elevation: {
          color: RIDE_COLORS[idx],
          title: ride.title,
          distances: dsDists,
          values: dsElevs,
          maxDist,
        },
        idx,
        title: ride.title,
      }
    })
  }, [selectedRides])

  const isBest = (metric: MetricDef, ride: RideData): boolean => {
    if (!bestPerMetric[metric.key]) return false
    return metric.getValue(ride) === bestPerMetric[metric.key]
  }

  // Empty state: no rides at all
  if (allRides.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <GitCompare className="size-5 text-primary" /> Primerjava voženj
        </h2>
        <div className="text-center py-16">
          <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <GitCompare className="size-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Ni voženj za primerjavo</p>
          <p className="text-xs text-muted-foreground mt-1">Zabeležite vsaj 2 vožnji za primerjavo</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <GitCompare className="size-5 text-primary" /> Primerjava voženj
        </h2>
        {showComparison && (
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => { setShowComparison(false); setSelectedRideIds([]) }}>
            <ArrowLeft className="size-3.5" /> Nazaj
          </Button>
        )}
      </div>

      {!showComparison ? (
        /* ====== RIDE SELECTION ====== */
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Izberi 2 vožnji za primerjavo</p>

          {/* Selected rides chips */}
          {selectedRideIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedRideIds.map((id, idx) => {
                const ride = allRides.find(r => r.id === id)
                if (!ride) return null
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${RIDE_BG_CLASSES[idx]} ${RIDE_TEXT_CLASSES[idx]} ${RIDE_BORDER_CLASSES[idx]}`}
                  >
                    <div className={`size-2.5 rounded-full ${RIDE_COLOR_CLASSES[idx]}`} />
                    <span className="truncate max-w-[120px]">{ride.title}</span>
                    <button
                      onClick={() => toggleRide(id)}
                      className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity"
                      aria-label="Odstrani"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Ride selector dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between gap-2 text-sm"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={selectedRideIds.length >= 2}
            >
              <span className="flex items-center gap-2">
                <Bike className="size-4" />
                {selectedRideIds.length >= 2 ? 'Izbrani 2 vožnji' : 'Izberi vožnjo…'}
              </span>
              <ChevronDown className={`size-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </Button>
            {dropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg max-h-72 overflow-hidden">
                {/* Search input */}
                <div className="p-2 border-b border-border">
                  <input
                    type="text"
                    placeholder="Išči vožnje..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full text-sm px-3 py-1.5 bg-secondary/50 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                {/* Ride list */}
                <div className="max-h-56 overflow-y-auto custom-scrollbar">
                  {apiLoading && filteredRides.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Nalagam...</div>
                  ) : filteredRides.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Ni voženj</div>
                  ) : (
                    filteredRides.map(ride => (
                      <button
                        key={ride.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-secondary transition-colors flex items-center gap-3"
                        onClick={() => { toggleRide(ride.id); setDropdownOpen(false); setSearchQuery('') }}
                      >
                        <div className="size-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                          <Bike className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ride.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Route className="size-3" />{ride.distance.toFixed(1)} km</span>
                            <span className="flex items-center gap-1"><Clock className="size-3" />{formatDuration(ride.duration)}</span>
                            <span>{formatDate(ride.createdAt)}</span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick select recent */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                const ids = allRides.slice(0, 2).map(r => r.id)
                setSelectedRideIds(ids)
              }}
            >
              Zadnji 2 vožnji
            </Button>
          </div>

          {/* Compare button */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              Izbrano: {selectedRideIds.length}/2
            </span>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={selectedRideIds.length < 2}
              onClick={() => setShowComparison(true)}
            >
              <GitCompare className="size-3.5" /> Primerjaj
            </Button>
          </div>
        </div>
      ) : (
        /* ====== COMPARISON VIEW ====== */
        selectedRides.length < 2 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Potrebnih vsaj 2 vožnji</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Ride color legend */}
            <div className="flex flex-wrap gap-2">
              {selectedRides.map((ride, idx) => (
                <div
                  key={ride.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${RIDE_BG_CLASSES[idx]} ${RIDE_TEXT_CLASSES[idx]} ${RIDE_BORDER_CLASSES[idx]}`}
                >
                  <div className={`size-2.5 rounded-full ${RIDE_COLOR_CLASSES[idx]}`} />
                  <span className="truncate max-w-[120px]">{ride.title}</span>
                </div>
              ))}
            </div>

            {/* ====== SIDE-BY-SIDE STATS CARDS ====== */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="size-4 text-primary" /> Statistika
                </p>
                <div className="space-y-2">
                  {METRICS.map(metric => {
                    const values = selectedRides.map(r => metric.getValue(r))
                    const bestVal = metric.higherIsBetter ? Math.max(...values) : Math.min(...values)

                    return (
                      <div key={metric.key} className="grid grid-cols-[1fr_repeat(2,minmax(0,1fr))] gap-2 items-center">
                        {/* Metric label */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {metric.icon}
                          <span className="font-medium">{metric.label}</span>
                        </div>

                        {/* Each ride's value */}
                        {selectedRides.map((ride, idx) => {
                          const val = metric.getValue(ride)
                          const isWinner = val === bestVal && selectedRides.length > 1
                          const otherVal = selectedRides.find(r => r.id !== ride.id)
                            ? metric.getValue(selectedRides.find(r => r.id !== ride.id)!)
                            : val
                          const diff = otherVal !== 0 ? ((val - otherVal) / otherVal) * 100 : 0
                          const diffSign = diff > 0 ? '+' : ''

                          return (
                            <div
                              key={ride.id}
                              className={`rounded-lg p-2.5 text-center border transition-colors ${
                                isWinner
                                  ? 'bg-emerald-500/10 border-emerald-500/20'
                                  : 'bg-secondary/50 border-transparent'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 mb-0.5">
                                <div className={`size-2 rounded-full ${RIDE_COLOR_CLASSES[idx]}`} />
                                {isWinner && <span className="text-xs">🏆</span>}
                              </div>
                              <p className={`text-base font-bold ${isWinner ? 'text-emerald-500' : ''}`}>
                                {formatMetricValue(metric.key, val)}
                                <span className="text-xs font-normal text-muted-foreground ml-0.5">{metric.unit}</span>
                              </p>
                              {selectedRides.length > 1 && Math.abs(diff) > 0.5 && val !== otherVal && (
                                <p className={`text-[10px] mt-0.5 ${isWinner ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                  {diffSign}{diff.toFixed(0)}%
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ====== SPEED PROFILE CHART ====== */}
            <SVGProfileChart
              label="Hitrostni profil"
              unit="km/h"
              yLabel="Hitrost"
              ridesData={profileData.map(p => p.speed).filter(Boolean) as Array<{
                color: string
                title: string
                distances: number[]
                values: number[]
                maxDist: number
              }>}
              className=""
            />

            {/* ====== ELEVATION PROFILE CHART ====== */}
            <SVGProfileChart
              label="Višinski profil"
              unit="m"
              yLabel="Nadmorska višina"
              ridesData={profileData.map(p => p.elevation).filter(Boolean) as Array<{
                color: string
                title: string
                distances: number[]
                values: number[]
                maxDist: number
              }>}
              showAreas
              className=""
            />

            {/* ====== ELEVATION MARKERS ====== */}
            <ElevationMarkers selectedRides={selectedRides} />

            {/* ====== SEGMENT ANALYSIS ====== */}
            <SegmentAnalysis selectedRides={selectedRides} />

            {/* ====== BEST RIDE SUMMARY ====== */}
            {bestRide && (
              <Card className="rounded-xl overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
                <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-400">
                      <Trophy className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Najboljša vožnja</p>
                      <p className="font-bold text-sm">{bestRide.ride.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Zmagovalka s {bestRide.score} točkami · {bestRide.ride.distance.toFixed(1)} km · {formatDuration(bestRide.ride.duration)}
                      </p>
                    </div>
                  </div>
                  {/* Trophy counts per ride */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedRides.map((ride, idx) => {
                      const trophyCount = METRICS.filter(m =>
                        ride.id === selectedRides.find(r => m.getValue(r) === bestPerMetric[m.key])?.id
                      ).length
                      return (
                        <div
                          key={ride.id}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${RIDE_BG_CLASSES[idx]} ${RIDE_TEXT_CLASSES[idx]}`}
                        >
                          <div className={`size-2 rounded-full ${RIDE_COLOR_CLASSES[idx]}`} />
                          <span className="truncate max-w-[80px]">{ride.title}</span>
                          {trophyCount > 0 && (
                            <span className="flex items-center gap-0.5 font-bold text-amber-500">
                              <Trophy className="size-3" />{trophyCount}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )
      )}

      {/* Click-away handler for dropdown */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setDropdownOpen(false); setSearchQuery('') }}
        />
      )}
    </div>
  )
}
