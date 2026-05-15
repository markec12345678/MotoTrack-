'use client'

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { Activity, Zap, Route, TrendingUp, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { haversine } from '@/components/tabs/types'

// ─── Props ───────────────────────────────────────────────────────────
interface TwistinessScoreProps {
  trackPoints: Array<{ lat: number; lng: number; alt?: number | null; timestamp?: number }>
  distance: number // in km
}

// ─── Helpers ─────────────────────────────────────────────────────────

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

/** Score → color for gauge and display */
function scoreColor(score: number): string {
  if (score >= 80) return '#10b981' // emerald
  if (score >= 60) return '#22c55e' // green
  if (score >= 40) return '#eab308' // yellow
  if (score >= 20) return '#f97316' // orange
  return '#ef4444'                  // red
}

/** Fun fact based on score percentile */
function generateFunFact(score: number): string {
  // Map score to a rough percentile of all rides
  // Based on typical ride distributions: most rides score 15-50
  let percentile: number
  if (score >= 90) percentile = 98
  else if (score >= 80) percentile = 92
  else if (score >= 70) percentile = 85
  else if (score >= 60) percentile = 78
  else if (score >= 50) percentile = 65
  else if (score >= 40) percentile = 50
  else if (score >= 30) percentile = 35
  else if (score >= 20) percentile = 20
  else percentile = 10

  const facts = [
    `Ta cesta ima več zavojev kot ${percentile}% vseh voženj!`,
    `Vijugavost: ${percentile}. percentil med vsemi vožnjami.`,
    `Več kot ${percentile}% voženj je manj vijugastih od te!`,
    `Rang: top ${100 - percentile}% najbolj zavojastih cest!`,
  ]
  return facts[Math.floor(Math.random() * facts.length)]
}

// ─── Main computation ────────────────────────────────────────────────

interface TwistinessResult {
  score: number
  classification: ReturnType<typeof classifyRoad>
  bearingChanges: number[]       // absolute bearing change per consecutive pair (last 30)
  totalBearingChange: number     // sum of absolute bearing changes in window
  windowDistance: number         // distance covered in the window (km)
  funFact: string
}

const SCALE_FACTOR = 15 // calibration: ~6.67 degrees/km → score 100
const WINDOW_POINTS = 30

function computeTwistiness(
  points: Array<{ lat: number; lng: number }>,
  totalDistance: number
): TwistinessResult | null {
  if (points.length < 2) return null

  // Use the last WINDOW_POINTS points as the sliding window
  const windowStart = Math.max(0, points.length - WINDOW_POINTS)
  const window = points.slice(windowStart)

  // Calculate bearings between consecutive points in window
  const bearings: number[] = []
  for (let i = 0; i < window.length - 1; i++) {
    bearings.push(calculateBearing(window[i].lat, window[i].lng, window[i + 1].lat, window[i + 1].lng))
  }

  if (bearings.length < 1) return null

  // Absolute bearing changes
  const bearingChanges: number[] = []
  let totalBearingChange = 0
  for (let i = 1; i < bearings.length; i++) {
    const diff = bearingDiff(bearings[i - 1], bearings[i])
    bearingChanges.push(diff)
    totalBearingChange += diff
  }

  // Distance in window
  let windowDistance = 0
  for (let i = 1; i < window.length; i++) {
    windowDistance += haversine(window[i - 1].lat, window[i - 1].lng, window[i].lat, window[i].lng)
  }

  // If window distance is too small (< 50m), fall back to total distance
  const effectiveDistance = windowDistance > 0.05 ? windowDistance : totalDistance > 0 ? totalDistance : 0.001

  // twistinessScore = min(100, (totalBearingChange / distance) * scaleFactor)
  const rawScore = effectiveDistance > 0
    ? (totalBearingChange / effectiveDistance) * SCALE_FACTOR
    : 0
  const score = Math.min(100, Math.max(0, Math.round(rawScore)))

  const classification = classifyRoad(score)
  const funFact = generateFunFact(score)

  // Keep only the last 30 bearing changes for sparkline
  const sparklineData = bearingChanges.slice(-30)

  return {
    score,
    classification,
    bearingChanges: sparklineData,
    totalBearingChange: Math.round(totalBearingChange * 10) / 10,
    windowDistance: Math.round(windowDistance * 1000) / 100,
    funFact,
  }
}

// ─── Animated number hook ────────────────────────────────────────────

function useAnimatedValue(target: number, duration = 800): number {
  const [current, setCurrent] = useState(0)
  const prevTarget = useRef(0)
  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)

  useEffect(() => {
    const start = prevTarget.current
    const diff = target - start
    if (diff === 0) return

    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(start + diff * eased))
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step)
      } else {
        prevTarget.current = target
      }
    }

    animationRef.current = requestAnimationFrame(step)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [target, duration])

  return current
}

// ─── SVG Circular Gauge ──────────────────────────────────────────────

function CircularGauge({ score, color }: { score: number; color: string }) {
  const radius = 58
  const stroke = 8
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <svg
      width={radius * 2}
      height={radius * 2}
      viewBox={`0 0 ${radius * 2} ${radius * 2}`}
      className="drop-shadow-lg"
    >
      {/* Background track */}
      <circle
        cx={radius}
        cy={radius}
        r={normalizedRadius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-muted-foreground/15"
      />
      {/* Colored progress arc */}
      <circle
        cx={radius}
        cy={radius}
        r={normalizedRadius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${radius} ${radius})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.4s ease' }}
      />
      {/* Glow effect */}
      <circle
        cx={radius}
        cy={radius}
        r={normalizedRadius}
        fill="none"
        stroke={color}
        strokeWidth={stroke + 4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${radius} ${radius})`}
        style={{
          transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.4s ease',
          opacity: 0.15,
          filter: 'blur(4px)',
        }}
      />
    </svg>
  )
}

// ─── Sparkline Chart ─────────────────────────────────────────────────

function BearingSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null

  const maxVal = Math.max(...data, 1)
  const width = 120
  const height = 32
  const stepX = width / (data.length - 1)
  const padding = 2

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - padding - (v / maxVal) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  // Area fill path
  const areaPath = `M0,${height} L${points.split(' ').join(' L')} L${width},${height} Z`
  // Line path
  const linePath = `M${points.split(' ').join(' L')}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Gradient definition */}
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill="url(#sparkGrad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) * stepX}
          cy={height - padding - (data[data.length - 1] / maxVal) * (height - padding * 2)}
          r="2.5"
          fill={color}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      )}
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────

export default function TwistinessScore({ trackPoints, distance }: TwistinessScoreProps) {
  const [showInfo, setShowInfo] = useState(false)

  // Memoize the expensive computation
  const result = useMemo(
    () => computeTwistiness(trackPoints, distance),
    [trackPoints, distance]
  )

  // Animated score value
  const animatedScore = useAnimatedValue(result?.score ?? 0)

  // Average comparison (simulated based on typical ride data)
  const averageScore = useMemo(() => {
    // In production, this would fetch from API. Use a realistic average.
    return 35
  }, [])

  const comparedToAverage = useMemo(() => {
    if (!result) return null
    const diff = result.score - averageScore
    if (Math.abs(diff) < 3) return { label: 'Povprečno', emoji: '📊', color: 'text-yellow-500' }
    if (diff > 0) return { label: `+${diff} nad povprečjem`, emoji: '📈', color: 'text-emerald-500' }
    return { label: `${diff} pod povprečjem`, emoji: '📉', color: 'text-orange-500' }
  }, [result, averageScore])

  // Don't render if insufficient data
  if (!result || trackPoints.length < 2) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="size-4 text-primary" />
            <h4 className="text-xs font-semibold">Vijugavost</h4>
          </div>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Route className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Potrebujem več podatkov...</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Za izračun vijugavosti potrebujem vsaj 2 GPS točki</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const color = scoreColor(result.score)

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h4 className="text-xs font-semibold">Vijugavost</h4>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-0.5">
              <Zap className="size-2.5" /> LIVE
            </Badge>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 rounded-md hover:bg-secondary/50 transition-colors"
            title="Kako se izračuna?"
          >
            <Info className="size-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Info tooltip */}
        {showInfo && (
          <div className="bg-secondary/50 rounded-md p-2.5 text-[10px] text-muted-foreground space-y-1 border border-border/30">
            <p><strong className="text-foreground">Kako deluje?</strong></p>
            <p>Izračunam smer (azimut) med zaporednima GPS točkama in seštejem spremembe smeri v drsnem oknu (zadnjih {WINDOW_POINTS} točk).</p>
            <p className="font-mono text-[9px]">ocena = min(100, (skupnaSprememba / razdalja) × {SCALE_FACTOR})</p>
            <p>Več sprememb smeri = višja ocena vijugavosti!</p>
          </div>
        )}

        {/* Main gauge + score */}
        <div className="flex items-center gap-4">
          {/* Circular gauge */}
          <div className="relative flex-shrink-0">
            <CircularGauge score={animatedScore} color={color} />
            {/* Score number in center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-3xl font-black tabular-nums leading-none"
                style={{ color, transition: 'color 0.4s ease' }}
              >
                {animatedScore}
              </span>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">
                /100
              </span>
            </div>
          </div>

          {/* Right side: classification + comparison */}
          <div className="flex-1 space-y-2">
            {/* Road type badge */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border"
              style={{
                backgroundColor: color + '15',
                color: color,
                borderColor: color + '30',
              }}
            >
              <span>{result.classification.emoji}</span>
              <span>{result.classification.label}</span>
            </div>

            {/* Comparison to average */}
            {comparedToAverage && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Povprečje: {averageScore}</span>
                <span className={`text-[10px] font-semibold ${comparedToAverage.color}`}>
                  {comparedToAverage.emoji} {comparedToAverage.label}
                </span>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-secondary/40 rounded-md px-2 py-1 text-center">
                <p className="text-[9px] text-muted-foreground">Spremembe</p>
                <p className="text-xs font-bold">{result.totalBearingChange}°</p>
              </div>
              <div className="bg-secondary/40 rounded-md px-2 py-1 text-center">
                <p className="text-[9px] text-muted-foreground">Okno</p>
                <p className="text-xs font-bold">{result.windowDistance} km</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bearing changes sparkline */}
        {result.bearingChanges.length >= 2 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="size-3" />
                Spremembe smeri
              </span>
              <span className="text-[9px] text-muted-foreground/60">
                zadnjih {result.bearingChanges.length} odsekov
              </span>
            </div>
            <div className="bg-secondary/30 rounded-md p-2">
              <BearingSparkline data={result.bearingChanges} color={color} />
            </div>
          </div>
        )}

        {/* Fun fact */}
        <div
          className="flex items-start gap-2 rounded-md p-2.5 border"
          style={{
            backgroundColor: color + '08',
            borderColor: color + '20',
          }}
        >
          <Zap className="size-3.5 mt-0.5 flex-shrink-0" style={{ color }} />
          <p className="text-[11px] leading-tight" style={{ color: color + 'dd' }}>
            {result.funFact}
          </p>
        </div>

        {/* Score scale legend */}
        <div className="flex items-center gap-1 text-[8px] text-muted-foreground/60">
          <span>Ravna</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
            <div className="flex-1 bg-red-500" />
            <div className="flex-1 bg-orange-500" />
            <div className="flex-1 bg-yellow-500" />
            <div className="flex-1 bg-green-500" />
            <div className="flex-1 bg-emerald-500" />
          </div>
          <span>Ekstremna</span>
        </div>
      </CardContent>
    </Card>
  )
}
