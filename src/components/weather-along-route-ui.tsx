'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Cloud, Droplets, Wind, Thermometer, AlertTriangle, MapPin, RefreshCw, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface WeatherAlongRouteProps {
  waypoints: Array<{ lat: number; lng: number }>
  /** Optional labels for each waypoint (e.g., "Ljubljana", "Bled") */
  waypointLabels?: string[]
}

interface WeatherPoint {
  lat: number
  lng: number
  temperature: number | null
  windspeed: number | null
  weathercode: number | null
  description: string
  windDirection: number | null
  precipitation: number | null
  isWindDangerous: boolean
}

// Weather code → emoji
function weatherEmoji(code: number | null): string {
  if (code === null) return '❓'
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '❄️'
  return '⛈️'
}

// Weather code → riding safety color
function weatherSafetyColor(code: number | null, windspeed: number | null, precip: number | null): string {
  if (code === null) return '#6b7280' // gray
  // Dangerous: thunderstorm, heavy rain, heavy snow, ice, strong wind
  if (code >= 95) return '#ef4444' // red
  if (code >= 65 || code >= 82) return '#ef4444'
  if (windspeed !== null && windspeed > 40) return '#ef4444'
  if (precip !== null && precip > 5) return '#ef4444'
  // Caution: rain, snow, moderate wind
  if (code >= 51 || (precip !== null && precip > 0)) return '#f97316' // orange
  if (windspeed !== null && windspeed > 25) return '#eab308' // yellow
  // Good: clear, partly cloudy
  if (code <= 3) return '#22c55e' // green
  return '#22c55e'
}

function weatherSafetyLabel(code: number | null, windspeed: number | null, precip: number | null): string {
  if (code === null) return 'Neznano'
  if (code >= 95) return 'Nevarno'
  if (code >= 65 || code >= 82) return 'Nevarno'
  if (windspeed !== null && windspeed > 40) return 'Nevarno'
  if (precip !== null && precip > 5) return 'Nevarno'
  if (code >= 51 || (precip !== null && precip > 0)) return 'Previdno'
  if (windspeed !== null && windspeed > 25) return 'Zmerno'
  if (code <= 3) return 'Varno'
  return 'Varno'
}

export default function WeatherAlongRouteUI({ waypoints, waypointLabels }: WeatherAlongRouteProps) {
  const [weatherData, setWeatherData] = useState<WeatherPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = useCallback(async () => {
    if (waypoints.length < 2) return
    setLoading(true)
    setError(null)
    try {
      const wpParam = JSON.stringify(waypoints)
      const res = await fetch(`/api/weather-along-route?waypoints=${encodeURIComponent(wpParam)}`)
      if (!res.ok) throw new Error('Napaka pri pridobivanju vremena')
      const json = await res.json()
      setWeatherData(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka')
    } finally {
      setLoading(false)
    }
  }, [waypoints])

  // Auto-fetch when waypoints change
  useEffect(() => {
    if (waypoints.length >= 2) fetchWeather()
  }, [waypoints, fetchWeather])

  // Overall route safety assessment
  const overallSafety = useMemo(() => {
    if (weatherData.length === 0) return { label: 'Nalaganje...', color: '#6b7280', emoji: '⏳' }
    const hasDangerous = weatherData.some(w => w.isWindDangerous || (w.weathercode !== null && w.weathercode >= 95))
    const hasCaution = weatherData.some(w =>
      (w.weathercode !== null && w.weathercode >= 51 && w.weathercode < 95) ||
      (w.precipitation !== null && w.precipitation > 0) ||
      (w.windspeed !== null && w.windspeed > 25)
    )
    if (hasDangerous) return { label: 'Nevarno za vožnjo!', color: '#ef4444', emoji: '🚨' }
    if (hasCaution) return { label: 'Previdno, preverite razmere', color: '#f97316', emoji: '⚠️' }
    return { label: 'Vreme ugodno za vožnjo', color: '#22c55e', emoji: '✅' }
  }, [weatherData])

  // Temperature range
  const tempRange = useMemo(() => {
    const temps = weatherData.map(w => w.temperature).filter((t): t is number => t !== null)
    if (temps.length === 0) return null
    return { min: Math.min(...temps), max: Math.max(...temps) }
  }, [weatherData])

  if (waypoints.length < 2) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 text-center">
          <Cloud className="size-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Dodajte vsaj 2 točki za vremensko napoved</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
              <Cloud className="size-3.5 text-primary" />
            </div>
            <div>
              <h4 className="text-xs font-semibold">Vreme ob poti</h4>
              <p className="text-[9px] text-muted-foreground">{waypoints.length} točk na poti</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={fetchWeather} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Overall Safety */}
        {weatherData.length > 0 && (
          <div
            className="flex items-center gap-2 p-2.5 rounded-lg border"
            style={{
              backgroundColor: overallSafety.color + '10',
              borderColor: overallSafety.color + '30',
            }}
          >
            <span className="text-lg">{overallSafety.emoji}</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: overallSafety.color }}>{overallSafety.label}</p>
              {tempRange && (
                <p className="text-[10px] text-muted-foreground">
                  Temperatura: {tempRange.min}°C – {tempRange.max}°C
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 animate-pulse">
                <div className="size-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-3">
            <AlertTriangle className="size-5 text-red-400 mx-auto mb-1" />
            <p className="text-xs text-red-400">{error}</p>
            <Button variant="outline" size="sm" className="mt-2 text-[10px] h-6" onClick={fetchWeather}>
              Poskusi znova
            </Button>
          </div>
        )}

        {/* Weather Points */}
        {!loading && !error && weatherData.length > 0 && (
          <div className="space-y-1.5">
            {weatherData.map((wp, idx) => {
              const safetyColor = weatherSafetyColor(wp.weathercode, wp.windspeed, wp.precipitation)
              const safetyLabel = weatherSafetyLabel(wp.weathercode, wp.windspeed, wp.precipitation)
              const label = waypointLabels?.[idx] || `Točka ${idx + 1}`

              return (
                <React.Fragment key={idx}>
                  <div
                    className="flex items-center gap-3 p-2.5 rounded-lg border transition-all hover:border-primary/20"
                    style={{ borderLeftWidth: '3px', borderLeftColor: safetyColor }}
                  >
                    {/* Weather icon */}
                    <div className="text-xl flex-shrink-0">
                      {weatherEmoji(wp.weathercode)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3 text-muted-foreground" />
                        <span className="text-[11px] font-medium truncate">{label}</span>
                        <Badge
                          variant="secondary"
                          className="text-[8px] px-1 py-0 h-3.5"
                          style={{ backgroundColor: safetyColor + '20', color: safetyColor }}
                        >
                          {safetyLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {wp.temperature !== null && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Thermometer className="size-2.5" /> {wp.temperature}°C
                          </span>
                        )}
                        {wp.windspeed !== null && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${wp.isWindDangerous ? 'text-red-400 font-semibold' : 'text-muted-foreground'}`}>
                            <Wind className="size-2.5" /> {wp.windspeed} km/h
                          </span>
                        )}
                        {wp.precipitation !== null && wp.precipitation > 0 && (
                          <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                            <Droplets className="size-2.5" /> {wp.precipitation} mm
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{wp.description}</p>
                    </div>
                  </div>

                  {/* Route connector between points */}
                  {idx < weatherData.length - 1 && (
                    <div className="flex items-center gap-2 pl-4 py-0.5">
                      <div className="w-px h-3 bg-border/50" />
                      <ChevronRight className="size-2.5 text-muted-foreground/30" />
                      <div className="flex-1 border-t border-dashed border-border/30" />
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* Legend */}
        {weatherData.length > 0 && (
          <div className="flex items-center gap-3 text-[8px] text-muted-foreground/60 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Varno</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Previdno</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Nevarno</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
