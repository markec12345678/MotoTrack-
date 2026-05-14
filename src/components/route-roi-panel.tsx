'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
        setShowRating(false)
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

  // Weather icon helper
  function getWeatherIcon(code: number) {
    if (code <= 1) return <Sun className="size-5 text-amber-400" />
    if (code <= 3) return <Cloud className="size-5 text-zinc-300" />
    if (code === 45 || code === 48) return <CloudFog className="size-5 text-zinc-400" />
    if (code >= 61 && code <= 67) return <CloudRain className="size-5 text-sky-400" />
    if (code >= 71 && code <= 77) return <CloudSnow className="size-5 text-blue-300" />
    if (code >= 80) return <CloudRain className="size-5 text-sky-400" />
    return <Cloud className="size-5 text-zinc-300" />
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
            NEW: Route Comparison Section
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
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {comparisons.map(c => {
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
                          <div className="text-[10px] text-zinc-500 truncate">{c.routeTitle}</div>
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

                  {/* Fuel cost comparison */}
                  <div className="grid grid-cols-2 gap-2">
                    {comparisons.map(c => {
                      const isCheapest = compareWinners['fuelCost'] === c.routeId
                      return (
                        <div key={c.routeId} className={`text-center p-1.5 rounded ${isCheapest ? 'bg-emerald-500/5' : ''}`}>
                          <div className="text-[10px] text-zinc-500">Gorivo</div>
                          <div className={`text-sm font-semibold ${isCheapest ? 'text-emerald-400' : 'text-orange-400'}`}>
                            €{c.fuelCost.toFixed(2)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================
            NEW: Weather-based Recommendation
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
            <div className="mt-3 space-y-2">
              {weatherLoading ? (
                <div className="space-y-2 p-3 rounded-lg bg-zinc-800/40">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ) : weatherData && weatherRecommendation ? (
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
            NEW: Similar Routes
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
