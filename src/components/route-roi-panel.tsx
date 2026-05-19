'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import {
  ChevronDown,
  ChevronUp,
  GitCompare,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudFog,
  Thermometer,
  Wind,
  MapPin,
  Route,
  TrendingUp,
  Award,
  Loader2,
  Check,
  Clock,
  Calendar,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import type { RouteRoiScoreData, RouteData } from '@/components/tabs/types'

interface RouteRoiPanelProps {
  routeId: string
  userId?: string
  routeCategory?: string
  routeDistance?: number
  /** Optional list of available routes for comparison */
  availableRoutes?: RouteData[]
  /** Optional lat/lng for weather-based recommendations */
  routeLat?: number
  routeLng?: number
}

const weatherLabels: Record<string, string> = {
  dry: 'Suho',
  clear: 'Jasno',
  partly_cloudy: 'Delno oblačno',
  any: 'Karkoli',
  snow: 'Sneg',
  rain: 'Dež',
  fog: 'Megla',
}

const seasonLabels: Record<string, string> = {
  summer: 'Poletje',
  spring_autumn: 'Pomlad/Jesen',
  winter: 'Zima',
}

const weatherEmojis: Record<string, string> = {
  dry: '☀️',
  clear: '☀️',
  partly_cloudy: '⛅',
  any: '🌍',
  snow: '❄️',
  rain: '🌧️',
  fog: '🌫️',
}

const seasonEmojis: Record<string, string> = {
  summer: '☀️',
  spring_autumn: '🍂',
  winter: '❄️',
}

const categoryLabels: Record<string, string> = {
  scenic: 'Slikovita',
  twisty: 'Vijugasta',
  offroad: 'Terenska',
  city: 'Mestna',
  snowmobile: 'Snežna',
  racetrack: 'Dirkališčna',
  enduro: 'Enduro',
  adventure: 'Pustolovska',
}

const difficultyLabels: Record<string, string> = {
  easy: 'Lahka',
  medium: 'Srednja',
  hard: 'Težka',
}

function getGaugeColor(value: number): string {
  if (value >= 70) return '#22c55e' // green
  if (value >= 40) return '#eab308' // yellow
  return '#ef4444' // red
}

function getBarColor(value: number): string {
  if (value >= 7) return 'bg-emerald-500'
  if (value >= 4) return 'bg-amber-500'
  return 'bg-red-500'
}

function getBarBgColor(value: number): string {
  if (value >= 7) return 'bg-emerald-500/20'
  if (value >= 4) return 'bg-amber-500/20'
  return 'bg-red-500/20'
}

interface ScoreBarProps {
  label: string
  value: number
  max?: number
  isWinner?: boolean
}

function ScoreBar({ label, value, max = 10, isWinner }: ScoreBarProps) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400 flex items-center gap-1">
          {label}
          {isWinner && <Award className="size-2.5 text-amber-400" />}
        </span>
        <span className="text-zinc-300 font-medium">{value}/{max}</span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${getBarBgColor(value)}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface WeatherData {
  temperature: number
  windspeed: number
  weathercode: number
  description: string
}

interface ForecastDay {
  date: string
  tempMax: number
  tempMin: number
  precipitation: number
  windMax: number
  description: string
}

interface SimilarRouteData {
  routeId: string
  title: string
  category: string
  difficulty: string
  distance: number
  likes: number
  overallRoi: number | null
  fuelCost: number | null
  bestSeason: string | null
  userName: string | null
}

interface ComparisonData {
  routeId: string
  routeTitle: string
  routeCategory: string
  routeDistance: number
  routeDifficulty: string
  sceneryScore: number
  twistinessScore: number
  roadQualityScore: number
  weatherScore: number
  fuelEfficiencyScore: number
  timeEfficiencyScore: number
  overallRoi: number
  timePerKm: number
  fuelCost: number
  pointsOfInterest: number
  recommendedWeather: string
  bestSeason: string
}

interface RoiHistoryEntry {
  id: string
  overallRoi: number
  sceneryScore: number
  twistinessScore: number
  roadQualityScore: number
  weatherScore: number
  fuelEfficiencyScore: number
  timeEfficiencyScore: number
  updatedAt: string
}

/* ========================================
   Radar/Spider Chart Component (SVG)
   ======================================== */
interface RadarChartProps {
  scores: number[]
  labels: string[]
  comparisonScores?: number[]
  size?: number
}

function RadarChart({ scores, labels, comparisonScores, size = 240 }: RadarChartProps) {
  const center = size / 2
  const maxRadius = size / 2 - 36 // Leave room for labels
  const numAxes = labels.length
  const angleStep = (2 * Math.PI) / numAxes
  const startAngle = -Math.PI / 2 // Start from top

  // Calculate axis endpoints
  const axisPoints = labels.map((_, i) => {
    const angle = startAngle + i * angleStep
    return {
      x: center + maxRadius * Math.cos(angle),
      y: center + maxRadius * Math.sin(angle),
    }
  })

  // Calculate polygon points for a set of scores
  function getPolygonPoints(scoreValues: number[]): string {
    return scoreValues
      .map((score, i) => {
        const angle = startAngle + i * angleStep
        const r = (score / 10) * maxRadius
        const x = center + r * Math.cos(angle)
        const y = center + r * Math.sin(angle)
        return `${x},${y}`
      })
      .join(' ')
  }

  // Grid rings at 2, 4, 6, 8, 10
  const gridRings = [2, 4, 6, 8, 10]

  // Label positions (slightly outside the axis)
  const labelPositions = labels.map((label, i) => {
    const angle = startAngle + i * angleStep
    const labelRadius = maxRadius + 20
    const x = center + labelRadius * Math.cos(angle)
    const y = center + labelRadius * Math.sin(angle)
    // Adjust text anchor based on position
    let textAnchor: 'start' | 'middle' | 'end' = 'middle'
    if (Math.abs(Math.cos(angle)) > 0.3) {
      textAnchor = Math.cos(angle) > 0 ? 'start' : 'end'
    }
    let dy = '0.35em'
    if (Math.sin(angle) < -0.5) dy = '-0.2em'
    if (Math.sin(angle) > 0.5) dy = '0.9em'
    return { x, y, textAnchor, dy, label }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Grid rings */}
      {gridRings.map(level => {
        const r = (level / 10) * maxRadius
        const points = labels
          .map((_, i) => {
            const angle = startAngle + i * angleStep
            const x = center + r * Math.cos(angle)
            const y = center + r * Math.sin(angle)
            return `${x},${y}`
          })
          .join(' ')
        return (
          <polygon
            key={level}
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Axis lines */}
      {axisPoints.map((pt, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={pt.x}
          y2={pt.y}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />
      ))}

      {/* Comparison polygon (route B) - drawn first so it's behind */}
      {comparisonScores && (
        <polygon
          points={getPolygonPoints(comparisonScores)}
          fill="rgba(168,85,247,0.15)"
          stroke="rgba(168,85,247,0.7)"
          strokeWidth="1.5"
        />
      )}

      {/* Main polygon (route A) */}
      <polygon
        points={getPolygonPoints(scores)}
        fill="rgba(16,185,129,0.15)"
        stroke="rgba(16,185,129,0.7)"
        strokeWidth="1.5"
      />

      {/* Data points for main */}
      {scores.map((score, i) => {
        const angle = startAngle + i * angleStep
        const r = (score / 10) * maxRadius
        const x = center + r * Math.cos(angle)
        const y = center + r * Math.sin(angle)
        return (
          <circle
            key={`a-${i}`}
            cx={x}
            cy={y}
            r="2.5"
            fill="#10b981"
            stroke="#064e3b"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Data points for comparison */}
      {comparisonScores?.map((score, i) => {
        const angle = startAngle + i * angleStep
        const r = (score / 10) * maxRadius
        const x = center + r * Math.cos(angle)
        const y = center + r * Math.sin(angle)
        return (
          <circle
            key={`b-${i}`}
            cx={x}
            cy={y}
            r="2.5"
            fill="#a855f7"
            stroke="#581c87"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Axis labels */}
      {labelPositions.map(({ x, y, textAnchor, dy, label }) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor={textAnchor as any}
          dy={dy}
          fill="#a1a1aa"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      ))}

      {/* Legend when comparing */}
      {comparisonScores && (
        <>
          <circle cx={center - 30} cy={size - 6} r="3" fill="#10b981" />
          <text x={center - 25} y={size - 3} fill="#a1a1aa" fontSize="8" fontFamily="system-ui, sans-serif">
            Ruta A
          </text>
          <circle cx={center + 10} cy={size - 6} r="3" fill="#a855f7" />
          <text x={center + 15} y={size - 3} fill="#a1a1aa" fontSize="8" fontFamily="system-ui, sans-serif">
            Ruta B
          </text>
        </>
      )}
    </svg>
  )
}

/* ========================================
   Calculate weather compatibility score
   ======================================== */
function calcWeatherCompatibility(
  tempMax: number,
  tempMin: number,
  precipitation: number,
  windMax: number,
  category: string,
): { score: number; reasons: string[] } {
  let score = 50
  const reasons: string[] = []
  const avgTemp = (tempMax + tempMin) / 2

  // Temperature check
  if (avgTemp >= 15 && avgTemp <= 30) {
    score += 20
    reasons.push('Udorna temperatura')
  } else if (avgTemp >= 5 && avgTemp < 15) {
    score += 10
    reasons.push('Nižja temperatura')
  } else if (avgTemp > 30) {
    score -= 10
    reasons.push('Visoka temperatura')
  } else {
    score -= 20
    reasons.push('Zelo nizka temperatura')
  }

  // Precipitation check
  if (precipitation <= 0) {
    score += 20
    reasons.push('Brez padavin')
  } else if (precipitation <= 2) {
    score += 5
    reasons.push('Rahle padavine')
  } else if (precipitation <= 5) {
    score -= 10
    reasons.push('Zmerne padavine')
  } else {
    score -= 25
    reasons.push('Močne padavine')
  }

  // Wind check
  if (windMax > 50) {
    score -= 20
    reasons.push('Močan veter')
  } else if (windMax > 30) {
    score -= 10
    reasons.push('Zmeren veter')
  } else {
    score += 5
    reasons.push('Ugoden veter')
  }

  // Category-specific
  if (category === 'offroad' || category === 'enduro') {
    if (precipitation <= 0 && windMax < 20) {
      score += 5
      reasons.push('Idealno za teren')
    }
  } else if (category === 'scenic') {
    if (precipitation <= 1) {
      score += 5
      reasons.push('Dobra vidljivost')
    }
  }

  score = Math.max(0, Math.min(100, score))
  return { score, reasons }
}

/* ========================================
   Main Component
   ======================================== */
export default function RouteRoiPanel({
  routeId,
  userId,
  routeCategory,
  routeDistance,
  availableRoutes,
  routeLat,
  routeLng,
}: RouteRoiPanelProps) {
  const [roiData, setRoiData] = useState<RouteRoiScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRating, setShowRating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ratings, setRatings] = useState({
    sceneryScore: 5,
    twistinessScore: 5,
    roadQualityScore: 5,
  })

  // Route Comparison state
  const [showCompare, setShowCompare] = useState(false)
  const [compareRouteId, setCompareRouteId] = useState<string | null>(null)
  const [comparisons, setComparisons] = useState<ComparisonData[]>([])
  const [compareWinners, setCompareWinners] = useState<Record<string, string | null>>({})
  const [compareBestOverall, setCompareBestOverall] = useState<string | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)

  // Weather recommendation state
  const [showWeatherRec, setShowWeatherRec] = useState(false)
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [forecastData, setForecastData] = useState<ForecastDay[]>([])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherRecommendation, setWeatherRecommendation] = useState<{
    isGoodDay: boolean
    score: number // 0-100
    reasons: string[]
  } | null>(null)

  // Similar routes state
  const [similarRoutes, setSimilarRoutes] = useState<SimilarRouteData[]>([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const [showSimilar, setShowSimilar] = useState(false)

  // ROI History state
  const [roiHistory, setRoiHistory] = useState<RoiHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Fetch ROI data
  useEffect(() => {
    if (!routeId) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ routeId })
    if (userId) params.set('userId', userId)

    fetch(`/api/route-roi?${params.toString()}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Napaka pri nalaganju')
        return res.json()
      })
      .then(json => {
        if (json.success && json.data) {
          setRoiData(json.data)
          if (json.data.sceneryScore > 1 || json.data.twistinessScore > 1 || json.data.roadQualityScore > 1) {
            setRatings({
              sceneryScore: json.data.sceneryScore,
              twistinessScore: json.data.twistinessScore,
              roadQualityScore: json.data.roadQualityScore,
            })
          }
        } else {
          setError(json.error || 'Ni podatkov')
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') setError('Napaka pri nalaganju ROI')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [routeId, userId])

  // Fetch weather-based recommendation
  const fetchWeatherRecommendation = useCallback(async () => {
    const lat = routeLat ?? 46.15
    const lng = routeLng ?? 14.99
    setWeatherLoading(true)
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data?.current) {
          const current = json.data.current as WeatherData
          setWeatherData(current)

          // Parse forecast data
          if (json.data.forecast && Array.isArray(json.data.forecast)) {
            setForecastData(json.data.forecast as ForecastDay[])
          }

          // Calculate recommendation based on weather and route category
          const category = routeCategory || 'scenic'
          let score = 50
          const reasons: string[] = []

          // Temperature check
          if (current.temperature >= 15 && current.temperature <= 30) {
            score += 20
            reasons.push('Udorna temperatura za vožnjo')
          } else if (current.temperature >= 5 && current.temperature < 15) {
            score += 10
            reasons.push('Nižja temperatura — primerna za opremo')
          } else if (current.temperature > 30) {
            score -= 10
            reasons.push('Visoka temperatura — tveganje za dehidracijo')
          } else {
            score -= 20
            reasons.push('Zelo nizka temperatura — nevarne razmere')
          }

          // Weather code check
          const code = current.weathercode
          if (code <= 1) {
            score += 25
            reasons.push('Jasno vreme — odlično za vožnjo')
          } else if (code <= 3) {
            score += 15
            reasons.push('Delno oblačno — sprejemljivo')
          } else if (code >= 61 && code <= 65) {
            score -= 25
            reasons.push('Dež — nevarne razmere na cesti')
          } else if (code >= 71 && code <= 77) {
            score -= 30
            reasons.push('Sneg — izjemno nevarno')
          } else if (code === 45 || code === 48) {
            score -= 15
            reasons.push('Megla — zmanjšana vidljivost')
          } else if (code >= 95) {
            score -= 35
            reasons.push('Nevihta — odsvetovana vožnja')
          }

          // Wind check
          if (current.windspeed > 50) {
            score -= 20
            reasons.push('Močan veter — nevarno za motoriste')
          } else if (current.windspeed > 30) {
            score -= 10
            reasons.push('Zmeren veter — previdnost pri ovinkih')
          } else {
            score += 5
            reasons.push('Ugodne razmere brez vetra')
          }

          // Category-specific adjustments
          if (category === 'offroad' || category === 'enduro') {
            if (code <= 1 && current.windspeed < 20) {
              score += 5
              reasons.push('Suho vreme idealno za terensko vožnjo')
            } else if (code >= 61) {
              score -= 10
              reasons.push('Mokri teren povečuje tveganje')
            }
          } else if (category === 'scenic') {
            if (code <= 3) {
              score += 5
              reasons.push('Dobra vidljivost za razgledno pot')
            }
          } else if (category === 'twisty' || category === 'racetrack') {
            if (code <= 1 && current.windspeed < 15) {
              score += 5
              reasons.push('Idealno za vijugasto/poto vožnjo')
            }
          }

          score = Math.max(0, Math.min(100, score))
          setWeatherRecommendation({
            isGoodDay: score >= 50,
            score,
            reasons,
          })
        }
      }
    } catch {
      // Silently fail for weather
    } finally {
      setWeatherLoading(false)
    }
  }, [routeLat, routeLng, routeCategory])

  // Fetch similar routes
  const fetchSimilarRoutes = useCallback(async () => {
    setSimilarLoading(true)
    try {
      const res = await fetch(`/api/route-roi/similar?routeId=${routeId}&limit=3`)
      if (res.ok) {
        const json = await res.json()
        if (json.success) {
          setSimilarRoutes(json.data || [])
        }
      }
    } catch {
      // silently fail
    } finally {
      setSimilarLoading(false)
    }
  }, [routeId])

  // Fetch ROI history
  const fetchRoiHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/route-roi?routeId=${routeId}&history=true`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setRoiHistory(json.data)
        }
      }
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false)
    }
  }, [routeId])

  // Auto-fetch weather when section opens
  useEffect(() => {
    if (showWeatherRec && !weatherData) {
      fetchWeatherRecommendation()
    }
  }, [showWeatherRec, weatherData, fetchWeatherRecommendation])

  // Auto-fetch similar routes when section opens
  useEffect(() => {
    if (showSimilar && similarRoutes.length === 0) {
      fetchSimilarRoutes()
    }
  }, [showSimilar, similarRoutes.length, fetchSimilarRoutes])

  // Auto-fetch ROI history when section opens
  useEffect(() => {
    if (showHistory && roiHistory.length === 0) {
      fetchRoiHistory()
    }
  }, [showHistory, roiHistory.length, fetchRoiHistory])

  const handleSaveRating = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/route-roi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          userId,
          scores: {
            sceneryScore: ratings.sceneryScore,
            twistinessScore: ratings.twistinessScore,
            roadQualityScore: ratings.roadQualityScore,
          },
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setRoiData(json.data)
        // Refresh history after saving
        setRoiHistory([])
        setShowRating(false)
        toast.success('Ocena shranjena!')
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  // Compare routes
  const handleCompare = async () => {
    if (!compareRouteId || compareRouteId === routeId) {
      toast.error('Izberite drugo ruto za primerjavo')
      return
    }
    setCompareLoading(true)
    try {
      const ids = `${routeId},${compareRouteId}`
      const params = new URLSearchParams({ routeIds: ids })
      if (userId) params.set('userId', userId)
      const res = await fetch(`/api/route-roi/compare?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setComparisons(json.data.comparisons)
          setCompareWinners(json.data.winners)
          setCompareBestOverall(json.data.bestOverall)
        }
      }
    } catch {
      toast.error('Napaka pri primerjavi')
    } finally {
      setCompareLoading(false)
    }
  }

  // ROI Gauge circle
  const overallRoi = roiData?.overallRoi ?? 0
  const gaugeColor = getGaugeColor(overallRoi)
  const gaugeRadius = 54
  const gaugeStroke = 8
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const gaugeOffset = gaugeCircumference - (overallRoi / 100) * gaugeCircumference

  // Radar chart data
  const radarLabels = ['Krajolik', 'Vijugavost', 'Cesta', 'Vreme', 'Gorivo', 'Čas']
  const radarScores = useMemo(() => [
    roiData?.sceneryScore ?? 0,
    roiData?.twistinessScore ?? 0,
    roiData?.roadQualityScore ?? 0,
    roiData?.weatherScore ?? 0,
    roiData?.fuelEfficiencyScore ?? 0,
    roiData?.timeEfficiencyScore ?? 0,
  ], [roiData])

  const comparisonRadarScores = useMemo(() => {
    if (comparisons.length !== 2) return undefined
    // Find the "other" route (not the current one)
    const other = comparisons.find(c => c.routeId !== routeId)
    if (!other) return undefined
    return [
      other.sceneryScore,
      other.twistinessScore,
      other.roadQualityScore,
      other.weatherScore,
      other.fuelEfficiencyScore,
      other.timeEfficiencyScore,
    ]
  }, [comparisons, routeId])

  // Forecast with compatibility scores
  const forecastWithScores = useMemo(() => {
    const category = routeCategory || 'scenic'
    return forecastData.map(day => ({
      ...day,
      ...calcWeatherCompatibility(day.tempMax, day.tempMin, day.precipitation, day.windMax, category),
    }))
  }, [forecastData, routeCategory])

  // Best day for riding
  const bestDay = useMemo(() => {
    if (forecastWithScores.length === 0) return null
    return forecastWithScores.reduce((best, day) => day.score > best.score ? day : best, forecastWithScores[0])
  }, [forecastWithScores])

  // Weather icon helper
  function getWeatherIcon(code: number, sizeClass = 'size-5') {
    if (code <= 1) return <Sun className={`${sizeClass} text-amber-400`} />
    if (code <= 3) return <Cloud className={`${sizeClass} text-zinc-300`} />
    if (code === 45 || code === 48) return <CloudFog className={`${sizeClass} text-zinc-400`} />
    if (code >= 61 && code <= 67) return <CloudRain className={`${sizeClass} text-sky-400`} />
    if (code >= 71 && code <= 77) return <CloudSnow className={`${sizeClass} text-blue-300`} />
    if (code >= 80) return <CloudRain className={`${sizeClass} text-sky-400`} />
    return <Cloud className={`${sizeClass} text-zinc-300`} />
  }

  // Day name from date string
  function getDayName(dateStr: string): string {
    try {
      const date = new Date(dateStr + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      if (date.getTime() === today.getTime()) return 'Danes'
      if (date.getTime() === tomorrow.getTime()) return 'Jutri'

      const days = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob']
      return days[date.getDay()]
    } catch {
      return dateStr.slice(5)
    }
  }

  // Infer weather code for forecast day (for icon display)
  function inferWeatherCode(precipitation: number, windMax: number): number {
    if (precipitation > 10) return 65
    if (precipitation > 3) return 63
    if (precipitation > 0.5) return 61
    if (windMax > 50) return 3
    if (windMax > 30) return 2
    return 1
  }

  if (loading) {
    return (
      <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !roiData) {
    return (
      <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">ROI Analiza</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <span className="text-orange-400">📊</span>
          ROI Analiza
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ROI Score Gauge */}
        <div className="flex justify-center py-2">
          <div className="relative">
            <svg width="128" height="128" className="-rotate-90">
              <circle
                cx="64"
                cy="64"
                r={gaugeRadius}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={gaugeStroke}
              />
              <circle
                cx="64"
                cy="64"
                r={gaugeRadius}
                fill="none"
                stroke={gaugeColor}
                strokeWidth={gaugeStroke}
                strokeLinecap="round"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={gaugeOffset}
                className="transition-all duration-1000 ease-out"
                style={{ filter: `drop-shadow(0 0 6px ${gaugeColor}66)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: gaugeColor }}>
                {overallRoi}
              </span>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">ROI</span>
            </div>
          </div>
        </div>

        {/* ========================================
            Radar/Spider Chart for ROI Dimensions
        ======================================== */}
        <div className="rounded-lg bg-zinc-800/30 p-3 border border-zinc-700/30">
          <div className="text-[10px] text-zinc-500 text-center mb-1 uppercase tracking-wider">
            Pregled dimenzij ROI
          </div>
          <RadarChart
            scores={radarScores}
            labels={radarLabels}
            comparisonScores={comparisonRadarScores}
            size={220}
          />
        </div>

        {/* Score Breakdown */}
        <div className="space-y-2.5">
          <ScoreBar label="Krajava" value={roiData?.sceneryScore ?? 0} />
          <ScoreBar label="Vijugavost" value={roiData?.twistinessScore ?? 0} />
          <ScoreBar label="Kakovost ceste" value={roiData?.roadQualityScore ?? 0} />
          <ScoreBar label="Vreme" value={roiData?.weatherScore ?? 0} />
          <ScoreBar label="Poraba goriva" value={roiData?.fuelEfficiencyScore ?? 0} />
          <ScoreBar label="Časovna učinkovitost" value={roiData?.timeEfficiencyScore ?? 0} />
        </div>

        {/* Weather & Season Badges */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-300 gap-1 text-xs"
          >
            {weatherEmojis[roiData?.recommendedWeather ?? 'any'] ?? '🌍'}
            Priporočeno vreme: {weatherLabels[roiData?.recommendedWeather ?? 'any'] ?? roiData?.recommendedWeather}
          </Badge>
          <Badge
            variant="outline"
            className="border-sky-500/30 bg-sky-500/10 text-sky-300 gap-1 text-xs"
          >
            {seasonEmojis[roiData?.bestSeason ?? 'summer'] ?? '🌍'}
            Najboljša sezona: {seasonLabels[roiData?.bestSeason ?? 'summer'] ?? roiData?.bestSeason}
          </Badge>
        </div>

        {/* Fuel Cost & Time */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-zinc-800/60 p-3 text-center border border-zinc-700/50">
            <div className="text-xs text-zinc-400 mb-1">Cena goriva</div>
            <div className="text-lg font-semibold text-orange-400">
              €{roiData?.fuelCost?.toFixed(2) ?? '0.00'}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-800/60 p-3 text-center border border-zinc-700/50">
            <div className="text-xs text-zinc-400 mb-1">Čas na km</div>
            <div className="text-lg font-semibold text-sky-400">
              {roiData?.timePerKm?.toFixed(2) ?? '0.00'}
              <span className="text-xs text-zinc-500 ml-0.5">min</span>
            </div>
          </div>
        </div>

        {/* Points of Interest */}
        {roiData?.pointsOfInterest != null && (
          <div className="text-xs text-zinc-400 text-center">
            📍 {roiData.pointsOfInterest} točk zanimanja v bližini
          </div>
        )}

        {/* Rate Button */}
        {!showRating ? (
          <Button
            onClick={() => setShowRating(true)}
            className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-medium"
            size="sm"
          >
            ⭐ Oceni pot
          </Button>
        ) : (
          <div className="space-y-4 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50">
            <div className="text-sm font-medium text-zinc-200">Oceni pot</div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Krajava</span>
                <span className="text-orange-400 font-medium">{ratings.sceneryScore}/10</span>
              </div>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[ratings.sceneryScore]}
                onValueChange={([v]) => setRatings(r => ({ ...r, sceneryScore: v }))}
                className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-orange-500 [&_[data-slot=slider-thumb]]:border-orange-500 [&_[data-slot=slider-thumb]]:bg-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Vijugavost</span>
                <span className="text-amber-400 font-medium">{ratings.twistinessScore}/10</span>
              </div>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[ratings.twistinessScore]}
                onValueChange={([v]) => setRatings(r => ({ ...r, twistinessScore: v }))}
                className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:border-amber-500 [&_[data-slot=slider-thumb]]:bg-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Kakovost ceste</span>
                <span className="text-emerald-400 font-medium">{ratings.roadQualityScore}/10</span>
              </div>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[ratings.roadQualityScore]}
                onValueChange={([v]) => setRatings(r => ({ ...r, roadQualityScore: v }))}
                className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500 [&_[data-slot=slider-thumb]]:bg-zinc-900"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowRating(false)}
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-zinc-200 flex-1"
              >
                Prekliči
              </Button>
              <Button
                onClick={handleSaveRating}
                disabled={saving}
                size="sm"
                className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white"
              >
                {saving ? 'Shranjujem...' : 'Shrani oceno'}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================
            ROI History/Progress
        ======================================== */}
        <div className="border-t border-zinc-700/50 pt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-orange-400" />
              Zgodovina ocen
            </span>
            {showHistory ? (
              <ChevronUp className="size-3.5 text-zinc-500" />
            ) : (
              <ChevronDown className="size-3.5 text-zinc-500" />
            )}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2">
              {historyLoading ? (
                <div className="space-y-2 p-3 rounded-lg bg-zinc-800/40">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-2 items-center">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : roiHistory.length === 0 ? (
                <div className="text-center py-3">
                  <Clock className="size-5 text-zinc-600 mx-auto mb-1" />
                  <p className="text-xs text-zinc-500">Ni zgodovine ocen</p>
                  <p className="text-[10px] text-zinc-600">Ocenite ruto za prikaz zgodovine</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {roiHistory.map((entry, i) => {
                    const dateStr = new Date(entry.updatedAt).toLocaleDateString('sl-SI', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                    const timeStr = new Date(entry.updatedAt).toLocaleTimeString('sl-SI', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30"
                      >
                        <div
                          className="size-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{
                            backgroundColor: `${getGaugeColor(entry.overallRoi)}20`,
                            color: getGaugeColor(entry.overallRoi),
                            border: `1px solid ${getGaugeColor(entry.overallRoi)}40`,
                          }}
                        >
                          {entry.overallRoi}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-zinc-300">
                            {i === 0 ? 'Trenutna ocena' : `Ocena #${roiHistory.length - i}`}
                          </div>
                          <div className="text-[9px] text-zinc-500">
                            {dateStr} ob {timeStr}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {[
                            { label: 'K', val: entry.sceneryScore },
                            { label: 'V', val: entry.twistinessScore },
                            { label: 'C', val: entry.roadQualityScore },
                          ].map(dim => (
                            <div
                              key={dim.label}
                              className="text-center"
                              title={
                                dim.label === 'K' ? 'Krajolik' :
                                dim.label === 'V' ? 'Vijugavost' : 'Kakovost ceste'
                              }
                            >
                              <div className="text-[8px] text-zinc-600">{dim.label}</div>
                              <div className="text-[10px] text-zinc-400 font-medium">{dim.val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {roiHistory.length > 0 && (
                <Button
                  onClick={() => {
                    setRoiHistory([])
                    fetchRoiHistory()
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 text-xs"
                >
                  <Clock className="size-3 mr-1" />
                  Osveži zgodovino
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ========================================
            Route Comparison Section
        ======================================== */}
        <div className="border-t border-zinc-700/50 pt-3">
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="w-full flex items-center justify-between text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <GitCompare className="size-3.5 text-purple-400" />
              Primerjaj rute
            </span>
            {showCompare ? (
              <ChevronUp className="size-3.5 text-zinc-500" />
            ) : (
              <ChevronDown className="size-3.5 text-zinc-500" />
            )}
          </button>

          {showCompare && (
            <div className="mt-3 space-y-3">
              {/* Route selector */}
              {!availableRoutes || availableRoutes.length === 0 ? (
                <div className="text-xs text-zinc-500 text-center py-2">
                  Ni drugih rut za primerjavo
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={compareRouteId || ''}
                    onChange={e => setCompareRouteId(e.target.value || null)}
                    className="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">Izberite ruto za primerjavo...</option>
                    {availableRoutes
                      .filter(r => r.id !== routeId)
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({categoryLabels[r.category] || r.category}, {r.distance.toFixed(0)} km)
                        </option>
                      ))}
                  </select>

                  <Button
                    onClick={handleCompare}
                    disabled={!compareRouteId || compareLoading}
                    size="sm"
                    className="w-full bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/20"
                  >
                    {compareLoading ? (
                      <Loader2 className="size-3.5 mr-1 animate-spin" />
                    ) : (
                      <GitCompare className="size-3.5 mr-1" />
                    )}
                    Primerjaj
                  </Button>
                </div>
              )}

              {/* Comparison results */}
              {comparisons.length === 2 && (
                <div className="space-y-3">
                  {/* ROI overview cards */}
                  <div className="grid grid-cols-2 gap-2">
                    {comparisons.map((c, idx) => {
                      const isBest = c.routeId === compareBestOverall
                      return (
                        <div
                          key={c.routeId}
                          className={`p-2.5 rounded-lg border text-center ${
                            isBest
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-zinc-800/40 border-zinc-700/50'
                          }`}
                        >
                          <div className="text-[10px] text-zinc-500 truncate">
                            {idx === 0 ? '🟢 Ruta A' : '🟣 Ruta B'}
                          </div>
                          <div className="text-[10px] text-zinc-600 truncate mt-0.5">{c.routeTitle}</div>
                          <div className="text-2xl font-bold" style={{ color: getGaugeColor(c.overallRoi) }}>
                            {c.overallRoi}
                          </div>
                          <div className="text-[10px] text-zinc-400">ROI</div>
                          {isBest && (
                            <Badge variant="outline" className="text-[9px] mt-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1 py-0">
                              🏆 Najboljša
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Radar chart comparison overlay */}
                  <div className="rounded-lg bg-zinc-800/30 p-2 border border-zinc-700/30">
                    <RadarChart
                      scores={[
                        comparisons[0].sceneryScore,
                        comparisons[0].twistinessScore,
                        comparisons[0].roadQualityScore,
                        comparisons[0].weatherScore,
                        comparisons[0].fuelEfficiencyScore,
                        comparisons[0].timeEfficiencyScore,
                      ]}
                      labels={radarLabels}
                      comparisonScores={[
                        comparisons[1].sceneryScore,
                        comparisons[1].twistinessScore,
                        comparisons[1].roadQualityScore,
                        comparisons[1].weatherScore,
                        comparisons[1].fuelEfficiencyScore,
                        comparisons[1].timeEfficiencyScore,
                      ]}
                      size={200}
                    />
                  </div>

                  {/* Metric comparison bars */}
                  <div className="space-y-1.5">
                    {[
                      { key: 'sceneryScore', label: 'Krajava' },
                      { key: 'twistinessScore', label: 'Vijugavost' },
                      { key: 'roadQualityScore', label: 'Cesta' },
                      { key: 'fuelEfficiencyScore', label: 'Gorivo' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2 text-[10px]">
                        <span className="w-16 text-zinc-500">{label}</span>
                        <div className="flex-1 flex gap-1">
                          {comparisons.map(c => {
                            const val = c[key as keyof ComparisonData] as number
                            const isWinner = compareWinners[key] === c.routeId
                            const pct = (val / 10) * 100
                            return (
                              <div key={c.routeId} className="flex-1">
                                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isWinner ? 'bg-emerald-500' : 'bg-zinc-500'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className={`mt-0.5 text-center ${isWinner ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                  {val}{isWinner ? ' ✓' : ''}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ========================================
                      Side-by-side Stats Comparison Table
                  ======================================== */}
                  <div className="rounded-lg border border-zinc-700/50 overflow-hidden">
                    <div className="grid grid-cols-3 text-[10px] font-medium bg-zinc-800/60">
                      <div className="p-2 text-zinc-400 border-r border-zinc-700/30">Metrika</div>
                      <div className="p-2 text-emerald-400 text-center border-r border-zinc-700/30">🟢 A</div>
                      <div className="p-2 text-purple-400 text-center">🟣 B</div>
                    </div>
                    {[
                      {
                        label: 'Razdalja',
                        a: `${comparisons[0].routeDistance.toFixed(0)} km`,
                        b: `${comparisons[1].routeDistance.toFixed(0)} km`,
                        winner: comparisons[0].routeDistance <= comparisons[1].routeDistance ? 'a' : 'b',
                        diff: comparisons[0].routeDistance <= comparisons[1].routeDistance
                          ? `${(comparisons[1].routeDistance - comparisons[0].routeDistance).toFixed(0)} km krajša`
                          : `${(comparisons[0].routeDistance - comparisons[1].routeDistance).toFixed(0)} km krajša`,
                      },
                      {
                        label: 'Težavnost',
                        a: difficultyLabels[comparisons[0].routeDifficulty] || comparisons[0].routeDifficulty,
                        b: difficultyLabels[comparisons[1].routeDifficulty] || comparisons[1].routeDifficulty,
                        winner: ['easy', 'medium', 'hard'].indexOf(comparisons[0].routeDifficulty) <= ['easy', 'medium', 'hard'].indexOf(comparisons[1].routeDifficulty) ? 'a' : 'b',
                        diff: '',
                      },
                      {
                        label: 'Cena goriva',
                        a: `€${comparisons[0].fuelCost.toFixed(2)}`,
                        b: `€${comparisons[1].fuelCost.toFixed(2)}`,
                        winner: comparisons[0].fuelCost <= comparisons[1].fuelCost ? 'a' : 'b',
                        diff: comparisons[0].fuelCost <= comparisons[1].fuelCost
                          ? `€${(comparisons[1].fuelCost - comparisons[0].fuelCost).toFixed(2)} ceneje`
                          : `€${(comparisons[0].fuelCost - comparisons[1].fuelCost).toFixed(2)} ceneje`,
                      },
                      {
                        label: 'Čas/km',
                        a: `${comparisons[0].timePerKm.toFixed(2)} min`,
                        b: `${comparisons[1].timePerKm.toFixed(2)} min`,
                        winner: comparisons[0].timePerKm <= comparisons[1].timePerKm ? 'a' : 'b',
                        diff: '',
                      },
                      {
                        label: 'POI',
                        a: `${comparisons[0].pointsOfInterest}`,
                        b: `${comparisons[1].pointsOfInterest}`,
                        winner: comparisons[0].pointsOfInterest >= comparisons[1].pointsOfInterest ? 'a' : 'b',
                        diff: '',
                      },
                      {
                        label: 'Naj. sezona',
                        a: seasonLabels[comparisons[0].bestSeason] || comparisons[0].bestSeason,
                        b: seasonLabels[comparisons[1].bestSeason] || comparisons[1].bestSeason,
                        winner: null,
                        diff: '',
                      },
                    ].map((row, i) => (
                      <div
                        key={row.label}
                        className={`grid grid-cols-3 text-[10px] ${
                          i % 2 === 0 ? 'bg-zinc-800/20' : 'bg-zinc-800/40'
                        }`}
                      >
                        <div className="p-1.5 text-zinc-500 border-r border-zinc-700/30">{row.label}</div>
                        <div className={`p-1.5 text-center border-r border-zinc-700/30 ${row.winner === 'a' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          <span className="flex items-center justify-center gap-0.5">
                            {row.a}
                            {row.winner === 'a' && <Check className="size-2.5 text-emerald-400" />}
                          </span>
                        </div>
                        <div className={`p-1.5 text-center ${row.winner === 'b' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          <span className="flex items-center justify-center gap-0.5">
                            {row.b}
                            {row.winner === 'b' && <Check className="size-2.5 text-emerald-400" />}
                          </span>
                        </div>
                        {row.diff && (
                          <div className="col-span-3 px-1.5 pb-1 text-[9px] text-emerald-400/70 text-center -mt-0.5">
                            {row.diff}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================
            Weather-based Recommendation + 3-day Forecast
        ======================================== */}
        <div className="border-t border-zinc-700/50 pt-3">
          <button
            onClick={() => setShowWeatherRec(!showWeatherRec)}
            className="w-full flex items-center justify-between text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Cloud className="size-3.5 text-sky-400" />
              Priporočilo na podlagi vremena
            </span>
            {showWeatherRec ? (
              <ChevronUp className="size-3.5 text-zinc-500" />
            ) : (
              <ChevronDown className="size-3.5 text-zinc-500" />
            )}
          </button>

          {showWeatherRec && (
            <div className="mt-3 space-y-3">
              {weatherLoading ? (
                <div className="space-y-2 p-3 rounded-lg bg-zinc-800/40">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ) : weatherData && weatherRecommendation ? (
                <>
                  {/* Current weather card */}
                  <div className={`p-3 rounded-lg border ${
                    weatherRecommendation.isGoodDay
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getWeatherIcon(weatherData.weathercode)}
                        <div>
                          <div className="text-sm font-medium text-zinc-200">
                            {weatherData.description}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <span className="flex items-center gap-0.5">
                              <Thermometer className="size-2.5" />
                              {weatherData.temperature}°C
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Wind className="size-2.5" />
                              {weatherData.windspeed} km/h
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${
                        weatherRecommendation.isGoodDay ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {weatherRecommendation.isGoodDay ? '✅' : '⚠️'}
                      </div>
                    </div>

                    {/* Compatibility score */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">Ujemanje z vremenom</span>
                        <span className={`font-medium ${
                          weatherRecommendation.score >= 70 ? 'text-emerald-400' :
                          weatherRecommendation.score >= 40 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {weatherRecommendation.score}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            weatherRecommendation.score >= 70 ? 'bg-emerald-500' :
                            weatherRecommendation.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${weatherRecommendation.score}%` }}
                        />
                      </div>
                    </div>

                    {/* Recommendation reasons */}
                    <div className="space-y-1">
                      {weatherRecommendation.reasons.map((reason, i) => (
                        <div key={i} className="text-[11px] text-zinc-400 flex items-start gap-1">
                          <span className="text-zinc-600 mt-0.5">•</span>
                          {reason}
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    <div className={`mt-2 text-xs font-medium text-center ${
                      weatherRecommendation.isGoodDay ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {weatherRecommendation.isGoodDay
                        ? 'Danes je dober dan za to ruto! 🏍️'
                        : 'Danes ni priporočljivo za to ruto.'
                      }
                    </div>
                  </div>

                  {/* ========================================
                      3-day Weather Forecast
                  ======================================== */}
                  {forecastWithScores.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                        <Calendar className="size-3 inline mr-1" />
                        3-dnevna napoved
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {forecastWithScores.map((day) => {
                          const isBest = bestDay && day.date === bestDay.date
                          const code = inferWeatherCode(day.precipitation, day.windMax)
                          return (
                            <div
                              key={day.date}
                              className={`p-2 rounded-lg border text-center ${
                                isBest
                                  ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
                                  : 'bg-zinc-800/40 border-zinc-700/30'
                              }`}
                            >
                              {/* Best day badge */}
                              {isBest && (
                                <div className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">
                                  <Trophy className="size-2.5 inline mr-0.5" />
                                  Najboljši dan
                                </div>
                              )}

                              {/* Day name */}
                              <div className="text-[10px] font-medium text-zinc-300 mb-1">
                                {getDayName(day.date)}
                              </div>

                              {/* Weather icon */}
                              <div className="flex justify-center mb-1">
                                {getWeatherIcon(code, 'size-5')}
                              </div>

                              {/* High/Low temps */}
                              <div className="text-[10px]">
                                <span className="text-zinc-200 font-medium">{Math.round(day.tempMax)}°</span>
                                <span className="text-zinc-500 mx-0.5">/</span>
                                <span className="text-zinc-500">{Math.round(day.tempMin)}°</span>
                              </div>

                              {/* Wind */}
                              <div className="text-[9px] text-zinc-500 flex items-center justify-center gap-0.5 mt-0.5">
                                <Wind className="size-2" />
                                {Math.round(day.windMax)} km/h
                              </div>

                              {/* Compatibility score */}
                              <div className="mt-1">
                                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      day.score >= 70 ? 'bg-emerald-500' :
                                      day.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${day.score}%` }}
                                  />
                                </div>
                                <div className={`text-[9px] font-medium mt-0.5 ${
                                  day.score >= 70 ? 'text-emerald-400' :
                                  day.score >= 40 ? 'text-amber-400' : 'text-red-400'
                                }`}>
                                  {day.score}%
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Best day summary */}
                      {bestDay && (
                        <div className="text-xs text-center text-emerald-400 font-medium p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                          <Trophy className="size-3 inline mr-1" />
                          Najboljši dan za vožnjo: {getDayName(bestDay.date)} ({Math.round(bestDay.tempMax)}°/{Math.round(bestDay.tempMin)}°)
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-zinc-500 text-center py-2">
                  Podatki o vremenu niso na voljo
                </div>
              )}

              {/* Refresh weather button */}
              <Button
                onClick={() => {
                  setWeatherData(null)
                  setWeatherRecommendation(null)
                  setForecastData([])
                  fetchWeatherRecommendation()
                }}
                variant="ghost"
                size="sm"
                className="w-full text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 text-xs"
              >
                <Cloud className="size-3 mr-1" />
                Osveži vreme
              </Button>
            </div>
          )}
        </div>

        {/* ========================================
            Similar Routes
        ======================================== */}
        <div className="border-t border-zinc-700/50 pt-3">
          <button
            onClick={() => setShowSimilar(!showSimilar)}
            className="w-full flex items-center justify-between text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Route className="size-3.5 text-teal-400" />
              Podobne rute
              {similarRoutes.length > 0 && (
                <Badge variant="outline" className="text-[9px] bg-teal-500/10 text-teal-400 border-teal-500/20 px-1 py-0">
                  {similarRoutes.length}
                </Badge>
              )}
            </span>
            {showSimilar ? (
              <ChevronUp className="size-3.5 text-zinc-500" />
            ) : (
              <ChevronDown className="size-3.5 text-zinc-500" />
            )}
          </button>

          {showSimilar && (
            <div className="mt-3 space-y-2">
              {similarLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <div key={i} className="flex gap-2 p-2 rounded-lg bg-zinc-800/40">
                      <Skeleton className="w-8 h-8 rounded" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-2 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : similarRoutes.length === 0 ? (
                <div className="text-center py-3">
                  <MapPin className="size-5 text-zinc-600 mx-auto mb-1" />
                  <p className="text-xs text-zinc-500">Ni podobnih rut</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {similarRoutes.map(sr => (
                    <div
                      key={sr.routeId}
                      className="p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30 hover:bg-zinc-800/60 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-zinc-200 truncate">
                            {sr.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                            <span>{categoryLabels[sr.category] || sr.category}</span>
                            <span>•</span>
                            <span>{sr.distance.toFixed(0)} km</span>
                            <span>•</span>
                            <span>{difficultyLabels[sr.difficulty] || sr.difficulty}</span>
                            {sr.userName && (
                              <>
                                <span>•</span>
                                <span>{sr.userName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end ml-2">
                          {sr.overallRoi != null ? (
                            <>
                              <div className="text-sm font-bold" style={{ color: getGaugeColor(sr.overallRoi) }}>
                                {sr.overallRoi}
                              </div>
                              <div className="text-[9px] text-zinc-500">ROI</div>
                            </>
                          ) : (
                            <div className="text-[10px] text-zinc-600">Brez ROI</div>
                          )}
                        </div>
                      </div>
                      {sr.fuelCost != null && (
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-500">
                          <span className="text-orange-400">€{sr.fuelCost.toFixed(2)} gorivo</span>
                          {sr.bestSeason && (
                            <span>
                              {seasonEmojis[sr.bestSeason] || '🌍'} {seasonLabels[sr.bestSeason] || sr.bestSeason}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => {
                  setSimilarRoutes([])
                  fetchSimilarRoutes()
                }}
                variant="ghost"
                size="sm"
                className="w-full text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 text-xs"
              >
                <Route className="size-3 mr-1" />
                Osveži podobne
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
