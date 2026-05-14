'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import type { RouteRoiScoreData } from '@/components/tabs/types'

interface RouteRoiPanelProps {
  routeId: string
  userId?: string
  routeCategory?: string
  routeDistance?: number
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
}

function ScoreBar({ label, value, max = 10 }: ScoreBarProps) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
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

export default function RouteRoiPanel({ routeId, userId, routeCategory, routeDistance }: RouteRoiPanelProps) {
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
          // Pre-fill ratings if existing scores are non-default
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

  // ROI Gauge circle
  const overallRoi = roiData?.overallRoi ?? 0
  const gaugeColor = getGaugeColor(overallRoi)
  const gaugeRadius = 54
  const gaugeStroke = 8
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const gaugeOffset = gaugeCircumference - (overallRoi / 100) * gaugeCircumference

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
              {/* Background circle */}
              <circle
                cx="64"
                cy="64"
                r={gaugeRadius}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={gaugeStroke}
              />
              {/* Foreground arc */}
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

            {/* Scenery Slider */}
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

            {/* Twistiness Slider */}
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

            {/* Road Quality Slider */}
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

            {/* Action buttons */}
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
      </CardContent>
    </Card>
  )
}
