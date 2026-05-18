'use client'

import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Mountain, TrendingUp, Route, Activity, ArrowUp, Gauge } from 'lucide-react'

interface RideDifficultyCalculatorProps {
  distance: number // km
  elevation?: number // meters of climbing
  maxAltitude?: number // meters
  trackPoints?: { lat: number; lng: number; alt: number | null; timestamp: number }[]
  className?: string
}

// Difficulty level type
type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert'

// Factor score (1.0 - 5.0)
interface FactorScore {
  key: string
  label: string
  icon: React.ElementType
  value: number // 1-5
  rawValue: number
  rawUnit: string
  score: number // 0-100%
  description: string
}

// Difficulty thresholds for each factor
const ELEVATION_THRESHOLDS = [
  { max: 500, score: 1, label: 'Majhen vzpon' },
  { max: 1500, score: 2, label: 'Zmeren vzpon' },
  { max: 3000, score: 3, label: 'Velik vzpon' },
  { max: Infinity, score: 5, label: 'Ekstremen vzpon' },
]

const GRADIENT_THRESHOLDS = [
  { max: 5, score: 1, label: 'Rahel nagib' },
  { max: 10, score: 2, label: 'Zmeren nagib' },
  { max: 15, score: 3, label: 'Strma naklonina' },
  { max: Infinity, score: 5, label: 'Ekstremen nagib' },
]

const DISTANCE_THRESHOLDS = [
  { max: 50, score: 1, label: 'Kratka vožnja' },
  { max: 150, score: 2, label: 'Srednja razdalja' },
  { max: 300, score: 3, label: 'Dolga vožnja' },
  { max: Infinity, score: 5, label: 'Maratonska vožnja' },
]

const TWISTINESS_THRESHOLDS = [
  { max: 2, score: 1, label: 'Ravna cesta' },
  { max: 5, score: 2, label: 'Zmerne krivine' },
  { max: 8, score: 3, label: 'Veliko ovinkov' },
  { max: Infinity, score: 5, label: 'Ekstremno vijugasta' },
]

const ALTITUDE_THRESHOLDS = [
  { max: 500, score: 1, label: 'Nizka nadmorska' },
  { max: 1500, score: 2, label: 'Srednja nadmorska' },
  { max: 2500, score: 3, label: 'Visoka nadmorska' },
  { max: Infinity, score: 5, label: 'Ekstremna nadmorska' },
]

// Weights for each factor in the overall score
const FACTOR_WEIGHTS = {
  elevation: 0.25,
  gradient: 0.20,
  distance: 0.15,
  twistiness: 0.25,
  maxAltitude: 0.15,
}

// Calculate angle between three points (for twistiness)
function calculateTurnAngle(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
  p3: { lat: number; lng: number }
): number {
  const ba = { lat: p1.lat - p2.lat, lng: p1.lng - p2.lng }
  const bc = { lat: p3.lat - p2.lat, lng: p3.lng - p2.lng }
  const dot = ba.lat * bc.lat + ba.lng * bc.lng
  const cross = ba.lat * bc.lng - ba.lng * bc.lat
  return Math.abs(Math.atan2(cross, dot)) * (180 / Math.PI)
}

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Calculate max gradient from track points
function calculateMaxGradient(
  points: { lat: number; lng: number; alt: number | null; timestamp: number }[]
): number {
  if (points.length < 2) return 0

  let maxGrad = 0
  // Use a sliding window of ~100m segments
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]

    if (p1.alt === null || p2.alt === null) continue
    if (p1.alt < -500 || p2.alt < -500) continue // Skip gap markers

    const distM = haversineKm(p1.lat, p1.lng, p2.lat, p2.lng) * 1000
    if (distM < 5) continue // Skip very short segments

    const elevDiff = Math.abs(p2.alt - p1.alt)
    const gradient = (elevDiff / distM) * 100

    if (gradient > maxGrad) maxGrad = gradient
  }

  return Math.round(maxGrad * 10) / 10
}

// Calculate twistiness (turns per km)
function calculateTwistiness(
  points: { lat: number; lng: number; alt: number | null; timestamp: number }[]
): number {
  if (points.length < 3) return 0

  let totalDistance = 0
  let significantTurns = 0

  for (let i = 1; i < points.length - 1; i++) {
    const angle = calculateTurnAngle(points[i - 1], points[i], points[i + 1])
    const segDist = haversineKm(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng)
    totalDistance += segDist

    // Count turns > 20 degrees as significant
    if (angle > 20) significantTurns++
  }

  if (totalDistance < 0.1) return 0
  return Math.round((significantTurns / totalDistance) * 10) / 10
}

// Calculate max altitude from track points
function calculateMaxAltitude(
  points: { lat: number; lng: number; alt: number | null; timestamp: number }[]
): number {
  if (points.length === 0) return 0

  let maxAlt = 0
  for (const p of points) {
    if (p.alt !== null && p.alt > -500 && p.alt > maxAlt) {
      maxAlt = p.alt
    }
  }
  return Math.round(maxAlt)
}

// Get score from thresholds
function getScoreFromThresholds(value: number, thresholds: { max: number; score: number; label: string }[]): { score: number; label: string } {
  for (const t of thresholds) {
    if (value <= t.max) return { score: t.score, label: t.label }
  }
  return { score: 5, label: 'Ekstremno' }
}

// Get difficulty level from overall score
function getDifficultyLevel(score: number): {
  level: DifficultyLevel
  label: string
  emoji: string
  color: string
  bgColor: string
  borderColor: string
} {
  if (score <= 1.5) {
    return {
      level: 'easy',
      label: 'LAHKA',
      emoji: '🟢',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    }
  }
  if (score <= 2.5) {
    return {
      level: 'medium',
      label: 'SREDNJA',
      emoji: '🟡',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    }
  }
  if (score <= 3.5) {
    return {
      level: 'hard',
      label: 'TEŽKA',
      emoji: '🟠',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
    }
  }
  return {
    level: 'expert',
    label: 'STROKOVNA',
    emoji: '🔴',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  }
}

export default function RideDifficultyCalculator({
  distance,
  elevation = 0,
  maxAltitude: maxAltitudeProp,
  trackPoints = [],
  className = '',
}: RideDifficultyCalculatorProps) {
  // Calculate factors
  const factors = useMemo(() => {
    // Elevation gain
    const elevationScore = getScoreFromThresholds(elevation, ELEVATION_THRESHOLDS)

    // Max gradient (from track points or estimate from elevation)
    const maxGradient = trackPoints.length >= 5
      ? calculateMaxGradient(trackPoints)
      : distance > 0 ? Math.round((elevation / (distance * 10)) * 100) / 10 : 0
    const gradientScore = getScoreFromThresholds(maxGradient, GRADIENT_THRESHOLDS)

    // Distance
    const distanceScore = getScoreFromThresholds(distance, DISTANCE_THRESHOLDS)

    // Twistiness (from track points or estimate)
    const twistiness = trackPoints.length >= 5
      ? calculateTwistiness(trackPoints)
      : 0
    const twistinessScore = getScoreFromThresholds(twistiness, TWISTINESS_THRESHOLDS)

    // Max altitude
    const maxAlt = maxAltitudeProp ?? (trackPoints.length >= 2 ? calculateMaxAltitude(trackPoints) : 0)
    const altitudeScore = getScoreFromThresholds(maxAlt, ALTITUDE_THRESHOLDS)

    return {
      elevation: {
        key: 'elevation',
        label: 'Vzpon',
        icon: TrendingUp,
        value: elevationScore.score,
        rawValue: elevation,
        rawUnit: 'm',
        score: (elevationScore.score / 5) * 100,
        description: elevationScore.label,
      } as FactorScore,
      gradient: {
        key: 'gradient',
        label: 'Največji nagib',
        icon: ArrowUp,
        value: gradientScore.score,
        rawValue: maxGradient,
        rawUnit: '%',
        score: (gradientScore.score / 5) * 100,
        description: gradientScore.label,
      } as FactorScore,
      distance: {
        key: 'distance',
        label: 'Razdalja',
        icon: Route,
        value: distanceScore.score,
        rawValue: distance,
        rawUnit: 'km',
        score: (distanceScore.score / 5) * 100,
        description: distanceScore.label,
      } as FactorScore,
      twistiness: {
        key: 'twistiness',
        label: 'Vijugavost',
        icon: Activity,
        value: twistinessScore.score,
        rawValue: twistiness,
        rawUnit: 'zavoji/km',
        score: (twistinessScore.score / 5) * 100,
        description: twistinessScore.label,
      } as FactorScore,
      maxAltitude: {
        key: 'maxAltitude',
        label: 'Najvišja točka',
        icon: Mountain,
        value: altitudeScore.score,
        rawValue: maxAlt,
        rawUnit: 'm',
        score: (altitudeScore.score / 5) * 100,
        description: altitudeScore.label,
      } as FactorScore,
    }
  }, [distance, elevation, maxAltitudeProp, trackPoints])

  // Calculate overall score (weighted average)
  const overallScore = useMemo(() => {
    const raw =
      factors.elevation.value * FACTOR_WEIGHTS.elevation +
      factors.gradient.value * FACTOR_WEIGHTS.gradient +
      factors.distance.value * FACTOR_WEIGHTS.distance +
      factors.twistiness.value * FACTOR_WEIGHTS.twistiness +
      factors.maxAltitude.value * FACTOR_WEIGHTS.maxAltitude
    return Math.round(raw * 10) / 10
  }, [factors])

  const difficulty = getDifficultyLevel(overallScore)

  // Handle edge cases
  if (distance < 0.1 && trackPoints.length < 2) {
    return null
  }

  return (
    <Card className={`border-border/50 ${className}`}>
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Gauge className="size-3.5 text-primary" />
          Zahtevnost vožnje
        </h4>

        {/* Overall difficulty badge */}
        <div className={`rounded-lg p-3 border ${difficulty.bgColor} ${difficulty.borderColor} text-center`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-2xl">{difficulty.emoji}</span>
            <span className={`text-lg font-bold ${difficulty.color}`}>
              {difficulty.label}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-2xl font-bold">{overallScore.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">/ 5.0</span>
          </div>
          {/* Score bar */}
          <div className="mt-2 h-2 rounded-full bg-secondary/50 overflow-hidden max-w-48 mx-auto">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                difficulty.level === 'easy' ? 'bg-green-500' :
                difficulty.level === 'medium' ? 'bg-amber-500' :
                difficulty.level === 'hard' ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${(overallScore / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Factor breakdown */}
        <div className="space-y-2.5">
          {Object.values(factors).map(factor => {
            const Icon = factor.icon
            return (
              <div key={factor.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3 text-muted-foreground" />
                    <span className="text-[11px] font-medium">{factor.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {typeof factor.rawValue === 'number' ? factor.rawValue : 0} {factor.rawUnit}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[8px] px-1.5 py-0 ${
                        factor.value <= 1 ? 'border-green-500/30 text-green-500' :
                        factor.value <= 2 ? 'border-amber-500/30 text-amber-500' :
                        factor.value <= 3 ? 'border-orange-500/30 text-orange-500' :
                        'border-red-500/30 text-red-500'
                      }`}
                    >
                      {factor.description}
                    </Badge>
                  </div>
                </div>
                <Progress
                  value={factor.score}
                  className={`h-1.5 ${
                    factor.value <= 1 ? '[&>div]:bg-green-500' :
                    factor.value <= 2 ? '[&>div]:bg-amber-500' :
                    factor.value <= 3 ? '[&>div]:bg-orange-500' :
                    '[&>div]:bg-red-500'
                  }`}
                />
              </div>
            )
          })}
        </div>

        {/* Weight info */}
        <p className="text-[8px] text-muted-foreground/50 text-center">
          Uteži: Vzpon 25% · Nagib 20% · Razdalja 15% · Vijugavost 25% · Nadm. viš. 15%
        </p>
      </CardContent>
    </Card>
  )
}
