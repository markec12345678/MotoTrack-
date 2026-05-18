'use client'

import React, { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { GitCompare, Trophy, Bike, Route, Clock, ArrowLeft, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RideData } from '@/components/tabs/types'
import { formatDuration, formatDate } from '@/components/tabs/types'

const RIDE_COLORS = ['#f97316', '#06b6d4', '#a855f7']
const RIDE_COLOR_CLASSES = [
  'bg-orange-500', 'bg-cyan-500', 'bg-purple-500',
]
const RIDE_TEXT_CLASSES = [
  'text-orange-500', 'text-cyan-500', 'text-purple-500',
]
const RIDE_BG_CLASSES = [
  'bg-orange-500/15', 'bg-cyan-500/15', 'bg-purple-500/15',
]
const RIDE_BORDER_CLASSES = [
  'border-orange-500/30', 'border-cyan-500/30', 'border-purple-500/30',
]

interface RideComparisonPanelProps {
  rides: RideData[]
  userId?: string
}

type MetricKey = 'distance' | 'duration' | 'avgSpeed' | 'maxSpeed' | 'elevation'

interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  getValue: (r: RideData) => number
  higherIsBetter: boolean
  positiveLabel: string
  negativeLabel: string
}

const METRICS: MetricDef[] = [
  { key: 'distance', label: 'Razdalja', unit: 'km', getValue: r => r.distance, higherIsBetter: true, positiveLabel: 'dlje', negativeLabel: 'krajše' },
  { key: 'duration', label: 'Trajanje', unit: '', getValue: r => r.duration, higherIsBetter: false, positiveLabel: 'hitreje', negativeLabel: 'počasneje' },
  { key: 'avgSpeed', label: 'Povp. hitrost', unit: 'km/h', getValue: r => r.avgSpeed, higherIsBetter: true, positiveLabel: 'hitreje', negativeLabel: 'počasneje' },
  { key: 'maxSpeed', label: 'Max hitrost', unit: 'km/h', getValue: r => r.maxSpeed, higherIsBetter: true, positiveLabel: 'hitreje', negativeLabel: 'počasneje' },
  { key: 'elevation', label: 'Višina', unit: 'm', getValue: r => r.elevation, higherIsBetter: true, positiveLabel: 'več vzpona', negativeLabel: 'manj vzpona' },
]

function formatMetricValue(key: MetricKey, value: number): string {
  if (key === 'duration') return formatDuration(value)
  if (key === 'distance') return value.toFixed(1)
  if (key === 'elevation') return value.toFixed(0)
  return value.toFixed(1)
}

function getPercentDiff(base: number, compare: number): { pct: number; label: string } | null {
  if (base === 0 && compare === 0) return null
  if (base === 0) return { pct: 100, label: '+100%' }
  const diff = ((compare - base) / base) * 100
  const sign = diff >= 0 ? '+' : ''
  return { pct: Math.abs(diff), label: `${sign}${diff.toFixed(0)}%` }
}

// Custom tooltip for Recharts
function ComparisonTooltip({ active, payload, metric }: {
  active?: boolean
  payload?: Array<{ value: number; payload: { name: string; rideIdx: number } }>
  metric: MetricDef
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{payload[0].payload.name}</p>
      <p className="text-muted-foreground">
        {metric.label}: <span className="font-bold text-foreground">{formatMetricValue(metric.key, payload[0].value)} {metric.unit}</span>
      </p>
    </div>
  )
}

export default function RideComparisonPanel({ rides, userId: _userId }: RideComparisonPanelProps) {
  const [selectedRideIds, setSelectedRideIds] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const selectedRides = useMemo(
    () => selectedRideIds.map(id => rides.find(r => r.id === id)).filter(Boolean) as RideData[],
    [selectedRideIds, rides]
  )

  const availableRides = useMemo(
    () => rides.filter(r => !selectedRideIds.includes(r.id)),
    [rides, selectedRideIds]
  )

  const toggleRide = (rideId: string) => {
    if (selectedRideIds.includes(rideId)) {
      setSelectedRideIds(prev => prev.filter(id => id !== rideId))
    } else if (selectedRideIds.length < 3) {
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
    return selectedRides.map((ride, idx) => {
      let score = 0
      METRICS.forEach(m => {
        const values = selectedRides.map(r => m.getValue(r))
        const sorted = m.higherIsBetter ? [...values].sort((a, b) => b - a) : [...values].sort((a, b) => a - b)
        const rank = sorted.indexOf(m.getValue(ride))
        score += (selectedRides.length - rank) * (m.key === 'avgSpeed' ? 2 : 1)
      })
      return { ride, score, idx }
    })
  }, [selectedRides])

  const bestRide = useMemo(() => {
    if (rideScores.length === 0) return null
    return rideScores.reduce((a, b) => a.score > b.score ? a : b)
  }, [rideScores])

  // Build chart data per metric
  const getChartData = (metric: MetricDef) => {
    return selectedRides.map((ride, idx) => ({
      name: ride.title.length > 12 ? ride.title.slice(0, 12) + '…' : ride.title,
      value: metric.getValue(ride),
      rideIdx: idx,
      fill: RIDE_COLORS[idx],
    }))
  }

  // Percent difference: compare each ride to the first selected ride
  const getDiffLabel = (metric: MetricDef, rideIdx: number): string | null => {
    if (rideIdx === 0 || selectedRides.length < 2) return null
    const baseVal = metric.getValue(selectedRides[0])
    const compareVal = metric.getValue(selectedRides[rideIdx])
    const result = getPercentDiff(baseVal, compareVal)
    if (!result) return null

    // Determine if the difference is positive or negative in context
    const isBetter = metric.higherIsBetter ? compareVal >= baseVal : compareVal <= baseVal
    const contextualLabel = isBetter ? metric.positiveLabel : metric.negativeLabel
    return `${result.label} ${contextualLabel}`
  }

  const isBest = (metric: MetricDef, ride: RideData): boolean => {
    if (!bestPerMetric[metric.key]) return false
    return metric.getValue(ride) === bestPerMetric[metric.key]
  }

  // Empty state: no rides at all
  if (rides.length === 0) {
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
          <p className="text-sm text-muted-foreground">Izberi 2–3 vožnje za primerjavo</p>

          {/* Selected rides chips */}
          {selectedRideIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedRides.map((id, idx) => {
                const ride = rides.find(r => r.id === id)
                if (!ride) return null
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${RIDE_BG_CLASSES[idx]} ${RIDE_TEXT_CLASSES[idx]} ${RIDE_BORDER_CLASSES[idx]}`}
                  >
                    <div className={`size-2.5 rounded-full ${RIDE_COLOR_CLASSES[idx]}`} />
                    <span className="truncate max-w-[100px]">{ride.title}</span>
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

          {/* Dropdown to add rides */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between gap-2 text-sm"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={selectedRideIds.length >= 3}
            >
              <span className="flex items-center gap-2">
                <Bike className="size-4" />
                {selectedRideIds.length >= 3 ? 'Največ 3 vožnje izbrane' : 'Dodaj vožnjo…'}
              </span>
              <ChevronDown className={`size-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </Button>
            {dropdownOpen && availableRides.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                {availableRides.map(ride => (
                  <button
                    key={ride.id}
                    className="w-full text-left px-3 py-2.5 hover:bg-secondary transition-colors flex items-center gap-3"
                    onClick={() => { toggleRide(ride.id); setDropdownOpen(false) }}
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
                ))}
              </div>
            )}
            {dropdownOpen && availableRides.length === 0 && (
              <div className="absolute z-20 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Vse vožnje so že izbrane</p>
              </div>
            )}
          </div>

          {/* Quick select all / recent */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                const ids = rides.slice(0, 3).map(r => r.id)
                setSelectedRideIds(ids)
              }}
            >
              Zadnje 3 vožnje
            </Button>
          </div>

          {/* Compare button */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              Izbrano: {selectedRideIds.length}/3
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
                  <span className="truncate max-w-[100px]">{ride.title}</span>
                </div>
              ))}
            </div>

            {/* Metric comparison cards */}
            {METRICS.map(metric => {
              const chartData = getChartData(metric)
              const maxValue = Math.max(...chartData.map(d => d.value), 1)

              return (
                <Card key={metric.key} className="rounded-xl overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold">{metric.label}</span>
                    </div>

                    {/* Recharts horizontal bar chart */}
                    <div className="min-h-[120px]" style={{ height: `${selectedRides.length * 56 + 24}px` }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          layout="vertical"
                          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                          barCategoryGap="25%"
                        >
                          <XAxis type="number" hide domain={[0, maxValue * 1.15]} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={80}
                            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<ComparisonTooltip metric={metric} />} />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                            {chartData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Side-by-side stats with winner badge and percentage diff */}
                    <div className="mt-3 space-y-2">
                      {selectedRides.map((ride, idx) => {
                        const val = metric.getValue(ride)
                        const best = isBest(metric, ride)
                        const diffLabel = getDiffLabel(metric, idx)

                        return (
                          <div
                            key={ride.id}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors ${
                              best ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-secondary/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`size-2.5 rounded-full shrink-0 ${RIDE_COLOR_CLASSES[idx]}`} />
                              <span className="text-xs truncate max-w-[90px]">{ride.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                {formatMetricValue(metric.key, val)} {metric.unit}
                              </span>
                              {diffLabel && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  diffLabel.startsWith('+') || metric.higherIsBetter
                                    ? diffLabel.startsWith('-') ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'
                                    : diffLabel.startsWith('-') ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                                }`}>
                                  {diffLabel}
                                </span>
                              )}
                              {best && (
                                <Badge className="shrink-0 text-[9px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-0.5 px-1.5 py-0">
                                  🏆 Najboljši
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Best ride summary */}
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
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  )
}
