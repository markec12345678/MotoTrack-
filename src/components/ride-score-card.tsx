'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Wind, Droplets, Thermometer, AlertTriangle, CloudSun, Bike } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RideScoreData {
  score: number
  label: string
  color: string
  bgClass: string
  factors: Array<{
    name: string
    impact: number
    value: string
    description: string
    emoji: string
  }>
  recommendation: string
  currentWeather: {
    temperature: number
    windspeed: number
    weathercode: number
    description: string
    maxWind: number
    maxGust: number
    precipitation: number
    tempMax: number
    tempMin: number
  }
}

export function RideScoreCard({ lat, lng }: { lat?: number; lng?: number }) {
  const [data, setData] = useState<RideScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const fetchScore = useCallback(async () => {
    setLoading(true)
    try {
      const latitude = lat ?? 46.15
      const longitude = lng ?? 14.99
      const res = await fetch(`/api/ride-score?lat=${latitude}&lng=${longitude}`)
      if (res.ok) {
        const j = await res.json()
        setData(j.data)
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }, [lat, lng])

  // Fetch on mount and when location changes
  useEffect(() => {
    fetchScore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  if (loading && !data) {
    return (
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-lg animate-pulse">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-white/10" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 bg-white/10 rounded" />
            <div className="h-2 w-28 bg-white/5 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const circumference = 2 * Math.PI * 20
  const strokeDashoffset = circumference - (data.score / 10) * circumference

  const getScoreIcon = () => {
    if (data.score >= 9) return <CloudSun className="size-4 text-emerald-400" />
    if (data.score >= 7) return <CloudSun className="size-4 text-green-400" />
    if (data.score >= 5) return <AlertTriangle className="size-4 text-yellow-400" />
    return <AlertTriangle className="size-4 text-red-400" />
  }

  return (
    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg overflow-hidden">
      {/* Main compact view */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
      >
        {/* Circular Score Gauge */}
        <div className="relative size-12 flex-shrink-0">
          <svg className="size-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <circle cx="24" cy="24" r="20" fill="none" stroke={data.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-white">{data.score}</span>
          </div>
        </div>

        {/* Score info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            {getScoreIcon()}
            <span className="text-xs font-bold text-white">{data.label}</span>
            <span className="text-[9px] text-white/40 ml-1">Ride Score</span>
          </div>
          <p className="text-[10px] text-white/50 truncate mt-0.5">
            {data.currentWeather.temperature}°C · {data.currentWeather.description} · {data.currentWeather.windspeed} km/h
          </p>
        </div>

        {/* Factor badges (compact) */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {data.factors.slice(0, 2).map((f, i) => (
            <span key={i} className="text-sm" title={`${f.name}: ${f.description}`}>
              {f.emoji}
            </span>
          ))}
          {data.factors.length > 2 && (
            <span className="text-[9px] text-white/40">+{data.factors.length - 2}</span>
          )}
        </div>
      </button>

      {/* Expanded detail view */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-white/5 pt-2.5">
          {/* Recommendation */}
          <p className="text-[11px] text-white/70 leading-relaxed">
            {data.recommendation}
          </p>

          {/* Weather details grid */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <Thermometer className="size-3 text-orange-400 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{data.currentWeather.tempMax}°</p>
              <p className="text-[9px] text-white/40">Max</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <Wind className="size-3 text-sky-400 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{data.currentWeather.maxWind}</p>
              <p className="text-[9px] text-white/40">km/h</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <Droplets className="size-3 text-blue-400 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{data.currentWeather.precipitation}</p>
              <p className="text-[9px] text-white/40">mm</p>
            </div>
          </div>

          {/* Factor details */}
          {data.factors.length > 0 && (
            <div className="space-y-1">
              {data.factors.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                  <span className="text-sm">{f.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-white">{f.name}</span>
                      <span className="text-[9px] text-white/40">{f.value}</span>
                    </div>
                    <p className="text-[9px] text-white/40 truncate">{f.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold ${f.impact <= -3 ? 'text-red-400' : f.impact <= -2 ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {f.impact}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* No factors = perfect conditions */}
          {data.factors.length === 0 && (
            <div className="flex items-center gap-2 bg-emerald-500/10 rounded-lg px-2.5 py-2">
              <Bike className="size-4 text-emerald-400" />
              <p className="text-[10px] text-emerald-300 font-medium">Popolni pogoji za vožnjo!</p>
            </div>
          )}

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[10px] text-white/50 hover:text-white hover:bg-white/10 gap-1"
            onClick={(e) => { e.stopPropagation(); fetchScore() }}
            disabled={loading}
          >
            <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            Osveži
          </Button>
        </div>
      )}
    </div>
  )
}
