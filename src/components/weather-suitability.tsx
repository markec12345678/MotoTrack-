'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Cloud, Sun, CloudRain, Wind, Thermometer, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface WeatherSuitabilityProps {
  lat?: number
  lng?: number
}

interface ScoreFactor {
  name: string
  icon: React.ReactNode
  score: number // 0-100
  detail: string
}

function calcTemperatureScore(temp: number): { score: number; detail: string } {
  if (temp < 0) return { score: 5, detail: `${temp.toFixed(0)}°C - Nevarno hladno` }
  if (temp < 5) return { score: 20, detail: `${temp.toFixed(0)}°C - Zelo hladno` }
  if (temp < 10) return { score: 45, detail: `${temp.toFixed(0)}°C - Hladno` }
  if (temp < 15) return { score: 65, detail: `${temp.toFixed(0)}°C - Sveže` }
  if (temp < 25) return { score: 95, detail: `${temp.toFixed(0)}°C - Idealno` }
  if (temp < 30) return { score: 75, detail: `${temp.toFixed(0)}°C - Toplo` }
  if (temp < 35) return { score: 50, detail: `${temp.toFixed(0)}°C - Vroče` }
  return { score: 25, detail: `${temp.toFixed(0)}°C - Nevarno vroče` }
}

function calcRainScore(code: number): { score: number; detail: string } {
  // WMO weather codes
  if (code <= 1) return { score: 100, detail: 'Brez padavin' }
  if (code <= 3) return { score: 85, detail: 'Delno oblačno' }
  if (code <= 48) return { score: 60, detail: 'Megla' }
  if (code <= 57) return { score: 50, detail: 'Rosna izložba' }
  if (code <= 67) return { score: 25, detail: 'Dež' }
  if (code <= 75) return { score: 15, detail: 'Sneg' }
  if (code <= 77) return { score: 15, detail: 'Snežna zrna' }
  if (code <= 82) return { score: 10, detail: 'Močan dež' }
  if (code <= 86) return { score: 10, detail: 'Snežni ploh' }
  if (code <= 99) return { score: 5, detail: 'Nevihta' }
  return { score: 50, detail: 'Neznano' }
}

function calcWindScore(speed: number): { score: number; detail: string } {
  if (speed < 10) return { score: 100, detail: `${speed.toFixed(0)} km/h - Mirno` }
  if (speed < 20) return { score: 85, detail: `${speed.toFixed(0)} km/h - Rahel veter` }
  if (speed < 30) return { score: 60, detail: `${speed.toFixed(0)} km/h - Zmeren veter` }
  if (speed < 40) return { score: 35, detail: `${speed.toFixed(0)} km/h - Močan veter` }
  if (speed < 60) return { score: 15, detail: `${speed.toFixed(0)} km/h - Zelo močan` }
  return { score: 5, detail: `${speed.toFixed(0)} km/h - Nevarno` }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 50) return 'text-amber-400'
  if (score >= 30) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500/15 border-green-500/30'
  if (score >= 50) return 'bg-amber-500/15 border-amber-500/30'
  if (score >= 30) return 'bg-orange-500/15 border-orange-500/30'
  return 'bg-red-500/15 border-red-500/30'
}

function getRecommendation(score: number): { text: string; emoji: string } {
  if (score >= 80) return { text: 'Odlično za vožnjo!', emoji: '🏍️' }
  if (score >= 60) return { text: 'Dobro za vožnjo', emoji: '👍' }
  if (score >= 40) return { text: 'Previdno, preveri opremo', emoji: '⚠️' }
  if (score >= 20) return { text: 'Ni priporočljivo', emoji: '🔶' }
  return { text: 'Ne vozite! Nevarno!', emoji: '🚫' }
}

export default function WeatherSuitability({ lat = 46.0569, lng = 14.5058 }: WeatherSuitabilityProps) {
  const [weather, setWeather] = useState<{ temperature: number; windspeed: number; weathercode: number; description: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchWeather = useCallback(() => {
    setLoading(true)
    fetch(`/api/weather?lat=${lat}&lng=${lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.current) {
          setWeather(j.current)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [lat, lng])

   
  useEffect(() => { fetchWeather() }, [fetchWeather])

  if (loading) {
    return (
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="size-4 text-primary animate-pulse" />
            <span className="text-xs font-medium">Vremenska primernost</span>
          </div>
          <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!weather) {
    return (
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Vreme ni na voljo</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const tempResult = calcTemperatureScore(weather.temperature)
  const rainResult = calcRainScore(weather.weathercode)
  const windResult = calcWindScore(weather.windspeed)
  // Visibility estimate from weather code (rough)
  const visScore = weather.weathercode <= 3 ? 100 : weather.weathercode <= 48 ? 50 : 25
  const visDetail = visScore === 100 ? '>10km odlična' : visScore === 50 ? '5-10km zmanjšana' : '<5km slaba'

  const factors: ScoreFactor[] = [
    { name: 'Temperatura', icon: <Thermometer className="size-3" />, score: tempResult.score, detail: tempResult.detail },
    { name: 'Padavine', icon: <CloudRain className="size-3" />, score: rainResult.score, detail: rainResult.detail },
    { name: 'Veter', icon: <Wind className="size-3" />, score: windResult.score, detail: windResult.detail },
    { name: 'Vidljivost', icon: <Eye className="size-3" />, score: visScore, detail: visDetail },
  ]

  const overallScore = Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length)
  const recommendation = getRecommendation(overallScore)

  return (
    <Card className={`rounded-xl overflow-hidden border ${getScoreBg(overallScore)}`}>
      <CardContent className="p-3">
        {/* Header with score */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cloud className="size-4 text-primary" />
            <span className="text-xs font-medium">Vremenska primernost</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-lg font-bold ${getScoreColor(overallScore)}`}>{overallScore}</span>
            <span className="text-[9px] text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Score bar */}
        <div className="h-2 rounded-full bg-muted/50 mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              overallScore >= 80 ? 'bg-green-500' : overallScore >= 50 ? 'bg-amber-500' : overallScore >= 30 ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${overallScore}%` }}
          />
        </div>

        {/* Recommendation */}
        <div className="flex items-center gap-2 mb-3 rounded-lg bg-muted/30 px-2.5 py-2">
          <span className="text-base">{recommendation.emoji}</span>
          <span className={`text-xs font-semibold ${getScoreColor(overallScore)}`}>{recommendation.text}</span>
        </div>

        {/* Factor scores */}
        <div className="grid grid-cols-2 gap-1.5">
          {factors.map(factor => (
            <div key={factor.name} className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1.5">
              <span className={getScoreColor(factor.score)}>{factor.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground">{factor.name}</span>
                  <span className={`text-[10px] font-bold ${getScoreColor(factor.score)}`}>{factor.score}</span>
                </div>
                <span className="text-[8px] text-muted-foreground truncate block">{factor.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchWeather}
          className="mt-2 w-full text-center text-[9px] text-muted-foreground hover:text-primary transition-colors"
        >
          Osveži vreme
        </button>
      </CardContent>
    </Card>
  )
}
