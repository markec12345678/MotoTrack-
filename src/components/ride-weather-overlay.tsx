'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Thermometer, Wind, Eye, Droplets, CloudRain, Snowflake, RefreshCw, AlertTriangle } from 'lucide-react'

// ─── Props ──────────────────────────────────────────────────────────────
interface RideWeatherOverlayProps {
  lat: number | null
  lng: number | null
  isTracking: boolean
  compact?: boolean
  className?: string
}

// ─── Weather data (from /api/weather) ──────────────────────────────────
interface WeatherData {
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windDir: number
  visibility: number
  description: string
  icon: string
  precipitation?: number
  weatherCode?: number
}

// ─── WMO code → emoji icon ─────────────────────────────────────────────
function weatherCodeToEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code === 1) return '🌤️'
  if (code === 2) return '⛅'
  if (code === 3) return '☁️'
  if (code >= 45 && code <= 48) return '🌫️'
  if (code >= 51 && code <= 57) return '🌧️'
  if (code >= 61 && code <= 67) return '🌧️'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '🌧️'
  if (code >= 85 && code <= 86) return '❄️'
  if (code >= 95) return '🌩️'
  return '🌤️'
}

// ─── Is rain/snow from WMO code ────────────────────────────────────────
function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)
}

function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || (code >= 85 && code <= 86)
}

// ─── Wind direction to Slovenian text ──────────────────────────────────
function windDirToSlo(degrees: number): string {
  const dirs = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ']
  const idx = Math.round(degrees / 45) % 8
  const sloLabels: Record<string, string> = {
    'S': 'Sever',
    'SV': 'Severovzhod',
    'V': 'Vzhod',
    'JV': 'Jugovzhod',
    'J': 'Jug',
    'JZ': 'Jugozahod',
    'Z': 'Zahod',
    'SZ': 'Severozahod',
  }
  return sloLabels[dirs[idx]] || dirs[idx]
}

// ─── Wind direction arrow ──────────────────────────────────────────────
function windDirArrow(degrees: number): string {
  const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘']
  return arrows[Math.round(degrees / 45) % 8]
}

// ─── Format time ───────────────────────────────────────────────────────
function formatUpdateTime(date: Date): string {
  return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ─────────────────────────────────────────────────────────
export default function RideWeatherOverlay({
  lat,
  lng,
  isTracking,
  compact = false,
  className = '',
}: RideWeatherOverlayProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [rainWarning, setRainWarning] = useState<'none' | 'rain' | 'snow'>('none')
  const [warningLevel, setWarningLevel] = useState<'yellow' | 'red'>('yellow')
  const hasAlertedRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevRainStateRef = useRef<'none' | 'rain' | 'snow'>('none')

  // ─── Play beep via Web Audio API ────────────────────────────────────
  const playAlertBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      // Play two short beeps
      for (let i = 0; i < 2; i++) {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(660, ctx.currentTime + i * 0.2)
        gainNode.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.2)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.15)
        oscillator.start(ctx.currentTime + i * 0.2)
        oscillator.stop(ctx.currentTime + i * 0.2 + 0.15)
      }
    } catch {
      // Audio not available
    }
  }, [])

  // ─── Fetch weather data ─────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    if (lat == null || lng == null) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error('Napaka pri pridobivanju vremena')

      const json = await res.json()
      if (!json.success || !json.data?.current) {
        throw new Error('Vremenski podatki niso na voljo')
      }

      const current = json.data.current
      const forecast = json.data.forecast || []

      // Map API data to our WeatherData interface
      const wd: WeatherData = {
        temp: current.temperature ?? 0,
        feelsLike: current.temperature ?? 0, // API doesn't provide feels-like
        humidity: 0, // API doesn't provide humidity in current
        windSpeed: current.windspeed ?? 0,
        windDir: current.winddirection ?? 0,
        visibility: 10, // API doesn't provide visibility, default 10km
        description: current.description || 'Neznano',
        icon: weatherCodeToEmoji(current.weathercode),
        precipitation: forecast.length > 0 ? forecast[0]?.precipitation : undefined,
        weatherCode: current.weathercode,
      }

      setWeather(wd)
      setLastUpdate(new Date())

      // ─── Rain/Snow warning detection ──────────────────────────────
      const code = current.weathercode
      let newRainState: 'none' | 'rain' | 'snow' = 'none'

      if (isSnowCode(code)) {
        newRainState = 'snow'
      } else if (isRainCode(code)) {
        newRainState = 'rain'
      }

      // Check forecast for approaching precipitation
      if (newRainState === 'none' && forecast.length > 0) {
        const todayPrecip = forecast[0]?.precipitation ?? 0
        if (todayPrecip > 5) {
          newRainState = 'rain'
        } else if (todayPrecip > 2) {
          // Moderate precipitation expected
          newRainState = 'rain'
        }
      }

      // Determine warning level
      const newWarningLevel: 'yellow' | 'red' = code >= 63 || code >= 73 || (forecast[0]?.precipitation ?? 0) > 5
        ? 'red'
        : 'yellow'

      setRainWarning(newRainState)
      setWarningLevel(newWarningLevel)

      // Audio alert when rain/snow is first detected
      if (newRainState !== 'none' && prevRainStateRef.current === 'none' && !hasAlertedRef.current) {
        playAlertBeep()
        hasAlertedRef.current = true
      }
      if (newRainState === 'none') {
        hasAlertedRef.current = false
      }
      prevRainStateRef.current = newRainState

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka')
    } finally {
      setLoading(false)
    }
  }, [lat, lng, playAlertBeep])

  // ─── Fetch on mount / when coordinates change ───────────────────────
  useEffect(() => {
    if (lat == null || lng == null) return
    fetchWeather()
  }, [lat, lng, fetchWeather])

  // ─── Auto-refresh every 10 minutes during tracking ──────────────────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (isTracking && lat != null && lng != null) {
      intervalRef.current = setInterval(fetchWeather, 600000) // 10 min
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isTracking, lat, lng, fetchWeather])

  // ─── No GPS ──────────────────────────────────────────────────────────
  if (lat == null || lng == null) {
    if (!isTracking) return null
    return (
      <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 text-white/60 text-xs ${className}`}>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
          Čakam na GPS...
        </div>
      </div>
    )
  }

  // ─── Not tracking ───────────────────────────────────────────────────
  if (!isTracking) return null

  // ─── Loading state (first load) ─────────────────────────────────────
  if (!weather && loading) {
    return (
      <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 ${className}`}>
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <RefreshCw className="size-3 animate-spin" />
          Nalagam vreme...
        </div>
      </div>
    )
  }

  // ─── Error state ─────────────────────────────────────────────────────
  if (!weather && error) {
    return (
      <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-red-500/30 px-3 py-2 ${className}`}>
        <div className="flex items-center gap-1.5 text-red-400 text-xs">
          <AlertTriangle className="size-3" />
          Vreme ni na voljo
        </div>
      </div>
    )
  }

  if (!weather) return null

  // ─── COMPACT MODE (Driving Mode) ─────────────────────────────────────
  if (compact) {
    return (
      <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-white/10 px-3 py-2 ${className}`}>
        <div className="flex items-center gap-2">
          {/* Weather icon + temp */}
          <span className="text-xl leading-none">{weather.icon}</span>
          <span className="text-lg font-bold text-white">{Math.round(weather.temp)}°</span>

          {/* Rain/Snow warning badge */}
          {rainWarning === 'rain' && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              warningLevel === 'red'
                ? 'bg-red-500/30 text-red-300 border border-red-500/40'
                : 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40'
            }`}>
              🌧️ Dež!
            </span>
          )}
          {rainWarning === 'snow' && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              warningLevel === 'red'
                ? 'bg-red-500/30 text-red-300 border border-red-500/40'
                : 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
            }`}>
              ❄️ Sneg!
            </span>
          )}

          {/* Wind (small) */}
          <span className="text-[10px] text-white/50 ml-auto">
            {windDirArrow(weather.windDir)} {Math.round(weather.windSpeed)} km/h
          </span>
        </div>
      </div>
    )
  }

  // ─── FULL MODE (floating overlay on map) ─────────────────────────────
  return (
    <div className={`rounded-xl bg-black/70 backdrop-blur-md border border-white/10 shadow-lg ${className}`}>
      <div className="px-3 pt-2.5 pb-2 space-y-2">
        {/* Header: icon + temp + description */}
        <div className="flex items-start gap-2">
          <span className="text-3xl leading-none mt-0.5">{weather.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{Math.round(weather.temp)}°C</span>
              {weather.feelsLike !== weather.temp && weather.feelsLike !== 0 && (
                <span className="text-xs text-white/40">
                  Občutek {Math.round(weather.feelsLike)}°
                </span>
              )}
            </div>
            <p className="text-xs text-white/60 truncate">{weather.description}</p>
          </div>
          {/* Refresh indicator */}
          <button
            onClick={fetchWeather}
            disabled={loading}
            className="p-1 rounded-md hover:bg-white/10 transition-colors"
            title="Osveži vreme"
          >
            <RefreshCw className={`size-3 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Rain/Snow warning */}
        {rainWarning === 'rain' && (
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
            warningLevel === 'red'
              ? 'bg-red-500/20 border border-red-500/30 text-red-300'
              : 'bg-yellow-500/15 border border-yellow-500/25 text-yellow-300'
          } ${warningLevel === 'red' ? 'animate-pulse' : ''}`}>
            🌧️ Dež v bližini!
            {weather.precipitation != null && weather.precipitation > 0 && (
              <span className="font-normal opacity-70 ml-1">({weather.precipitation.toFixed(1)} mm)</span>
            )}
          </div>
        )}
        {rainWarning === 'snow' && (
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
            warningLevel === 'red'
              ? 'bg-red-500/20 border border-red-500/30 text-red-300'
              : 'bg-blue-500/15 border border-blue-500/25 text-blue-300'
          } ${warningLevel === 'red' ? 'animate-pulse' : ''}`}>
            ❄️ Sneg v bližini!
            {weather.precipitation != null && weather.precipitation > 0 && (
              <span className="font-normal opacity-70 ml-1">({weather.precipitation.toFixed(1)} mm)</span>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {/* Wind */}
          <div className="flex items-center gap-1.5 text-white/70">
            <Wind className="size-3 text-white/40 flex-shrink-0" />
            <span className="truncate">{Math.round(weather.windSpeed)} km/h {windDirArrow(weather.windDir)}</span>
          </div>

          {/* Wind direction text */}
          <div className="flex items-center gap-1.5 text-white/70">
            <span className="text-[10px] text-white/30">↖→</span>
            <span className="truncate">{windDirToSlo(weather.windDir)}</span>
          </div>

          {/* Visibility */}
          <div className="flex items-center gap-1.5 text-white/70">
            <Eye className="size-3 text-white/40 flex-shrink-0" />
            <span>{weather.visibility >= 10 ? '10+ km' : `${weather.visibility} km`}</span>
          </div>

          {/* Humidity */}
          {weather.humidity > 0 && (
            <div className="flex items-center gap-1.5 text-white/70">
              <Droplets className="size-3 text-white/40 flex-shrink-0" />
              <span>{weather.humidity}%</span>
            </div>
          )}
        </div>

        {/* Last update timestamp */}
        {lastUpdate && (
          <div className="flex items-center justify-between text-[9px] text-white/25 pt-0.5 border-t border-white/5">
            <span>Osveženo: {formatUpdateTime(lastUpdate)}</span>
            <span>10 min</span>
          </div>
        )}
      </div>
    </div>
  )
}
