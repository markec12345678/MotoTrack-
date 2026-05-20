'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Sun, Moon } from 'lucide-react'

// ===== AUTO DAY/NIGHT THEME =====
// Automatically switches between light and dark mode based on sunrise/sunset
// Uses sun position calculation for the Balkan region (default: Ljubljana)

interface SunTimes {
  sunrise: Date
  sunset: Date
}

// Calculate sunrise/sunset using simplified algorithm
// Based on NOAA Solar Calculator, accuracy ~1-2 minutes
function calculateSunTimes(lat: number, lng: number, date: Date = new Date()): SunTimes {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
  
  // Convert longitude to hour value
  const lngHour = lng / 15
  
  // Sunrise calculation
  const sunriseTime = calcSunTime(lat, lngHour, dayOfYear, true)
  const sunsetTime = calcSunTime(lat, lngHour, dayOfYear, false)
  
  return {
    sunrise: sunriseTime,
    sunset: sunsetTime,
  }
}

function calcSunTime(lat: number, lngHour: number, dayOfYear: number, isRise: boolean): Date {
  // Approximate time of sunrise/sunset
  const t = dayOfYear + ((isRise ? 6 : 18) - lngHour) / 24
  
  // Sun's mean anomaly
  const M = (0.9856 * t) - 3.289
  
  // Sun's true longitude
  let L = M + (1.916 * Math.sin(M * Math.PI / 180)) + (0.020 * Math.sin(2 * M * Math.PI / 180)) + 282.634
  L = ((L % 360) + 360) % 360
  
  // Sun's right ascension
  let RA = Math.atan(0.91764 * Math.tan(L * Math.PI / 180)) * 180 / Math.PI
  RA = ((RA % 360) + 360) % 360
  
  // Adjust quadrant
  const Lquadrant = Math.floor(L / 90) * 90
  const RAquadrant = Math.floor(RA / 90) * 90
  RA = RA + (Lquadrant - RAquadrant)
  
  // Convert to hours
  RA = RA / 15
  
  // Sun's declination
  const sinDec = 0.39782 * Math.sin(L * Math.PI / 180)
  const cosDec = Math.cos(Math.asin(sinDec))
  
  // Sun's local hour angle
  const zenith = 90.833 // official zenith for sunrise/sunset
  const cosH = (Math.cos(zenith * Math.PI / 180) - (sinDec * Math.sin(lat * Math.PI / 180))) / 
               (cosDec * Math.cos(lat * Math.PI / 180))
  
  if (cosH > 1) return new Date(Date.now() + 86400000) // never rises (polar)
  if (cosH < -1) return new Date(0) // never sets (polar midnight sun)
  
  const H = isRise 
    ? (360 - Math.acos(cosH) * 180 / Math.PI) / 15
    : Math.acos(cosH) * 180 / Math.PI / 15
  
  // Local mean time of rising/setting
  const T = H + RA - (0.06571 * t) - 6.622
  
  // Adjust to UTC
  let UT = T - lngHour
  UT = ((UT % 24) + 24) % 24
  
  // Convert to local time (CET = UTC+1, CEST = UTC+2)
  const now = new Date()
  const isDST = now.getTimezoneOffset() < -60 // CEST (DST)
  const utcOffset = isDST ? 2 : 1
  
  const hours = Math.floor(UT)
  const minutes = Math.floor((UT - hours) * 60)
  
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours + utcOffset, minutes)
  
  return result
}

interface AutoThemeProps {
  lat?: number
  lng?: number
  enabled: boolean
  onToggle?: (enabled: boolean) => void
}

export function useAutoTheme({ lat = 46.0569, lng = 14.5058, enabled = false }: AutoThemeProps) {
  const [isDaytime, setIsDaytime] = useState(true)
  const [sunTimes, setSunTimes] = useState<SunTimes | null>(null)
  
  const updateDaytime = useCallback(() => {
    const times = calculateSunTimes(lat, lng)
    setSunTimes(times)
    const now = new Date()
    setIsDaytime(now >= times.sunrise && now <= times.sunset)
  }, [lat, lng])
  
  useEffect(() => {
    if (!enabled) return
    updateDaytime()
    // Check every minute
    const interval = setInterval(updateDaytime, 60000)
    return () => clearInterval(interval)
  }, [enabled, updateDaytime])
  
  return { isDaytime, sunTimes }
}

// Floating indicator component
export function AutoThemeIndicator({
  lat,
  lng,
  enabled,
  onToggle,
}: AutoThemeProps) {
  const { isDaytime, sunTimes } = useAutoTheme({ lat, lng, enabled })
  
  if (!enabled || !sunTimes) return null
  
  const formatTime = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  
  return (
    <button
      onClick={() => onToggle?.(!enabled)}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg transition-colors ${
        isDaytime
          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
          : 'bg-indigo-500/20 text-indigo-400'
      }`}
      title={`Avtomatska tema: ${isDaytime ? 'Dan' : 'Noč'} (sonce: ${formatTime(sunTimes.sunrise)}-${formatTime(sunTimes.sunset)})`}
    >
      {isDaytime ? <Sun className="size-3" /> : <Moon className="size-3" />}
      <span>{isDaytime ? 'DAN' : 'NOČ'}</span>
      <span className="opacity-60">{formatTime(isDaytime ? sunTimes.sunset : sunTimes.sunrise)}</span>
    </button>
  )
}

// Settings component for Profile tab
export function AutoThemeSettings() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('mototrack_autotheme') === 'true' } catch { return false }
    }
    return false
  })
  const [lat, setLat] = useState(46.0569)
  const [lng, setLng] = useState(14.5058)
  
  const { isDaytime, sunTimes } = useAutoTheme({ lat, lng, enabled })
  
  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }
  }, [])
  
  // Save preference
  useEffect(() => {
    try { localStorage.setItem('mototrack_autotheme', String(enabled)) } catch {}
  }, [enabled])
  
  const formatTime = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? <Sun className="size-4 text-amber-500" /> : <Moon className="size-4 text-muted-foreground" />}
          <span className="text-sm font-medium">Samodejna tema (dan/noč)</span>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>
      
      {enabled && sunTimes && (
        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50">
          <div className="text-center">
            <Sun className="size-5 text-amber-500 mx-auto" />
            <p className="text-xs text-muted-foreground mt-1">Sončni vzhod</p>
            <p className="text-sm font-bold">{formatTime(sunTimes.sunrise)}</p>
          </div>
          <div className="text-center">
            <Moon className="size-5 text-indigo-400 mx-auto" />
            <p className="text-xs text-muted-foreground mt-1">Sončni zahod</p>
            <p className="text-sm font-bold">{formatTime(sunTimes.sunset)}</p>
          </div>
        </div>
      )}
      
      {enabled && (
        <p className="text-xs text-muted-foreground">
          Tema se samodejno preklopi glede na sončni vzhod in zahod na vaši lokaciji.
          Trenutno: <strong>{isDaytime ? '☀️ Dan' : '🌙 Noč'}</strong>
        </p>
      )}
    </div>
  )
}

export default AutoThemeSettings
