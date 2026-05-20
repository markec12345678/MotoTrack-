'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import type { TrackPoint } from '@/components/tabs/types'
import { haversine } from '@/components/tabs/types'
import { useSettingsStore, isInPrivacyZone, obfuscateCoordinate } from '@/hooks/use-settings'

/**
 * useTracking — Extracted from home.tsx God Component
 * 
 * Manages GPS tracking state: position watching, auto-pause, auto-start,
 * auto-save, crash recovery, elevation tracking, and ride saving.
 * 
 * This hook encapsulates ALL tracking logic so the UI component only
 * needs to call start/pause/resume/stop/saveRide.
 */

interface UseTrackingOptions {
  /** Callback to refresh data after saving a ride */
  onRideSaved?: () => void
  /** User ID for ride saving */
  userId?: string
  /** Whether we're on the track tab (for auto-start) */
  isActiveTabTrack?: boolean
}

export function useTracking(options: UseTrackingOptions = {}) {
  const { onRideSaved, userId, isActiveTabTrack = false } = options
  const { settings, privacyZones } = useSettingsStore()

  // ─── Core tracking state ──────────────────────────────────────
  const [isTracking, setIsTracking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentRideId, setCurrentRideId] = useState<string | null>(null)
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([])
  const [trackDuration, setTrackDuration] = useState(0)
  const [trackDistance, setTrackDistance] = useState(0)
  const [trackMaxSpeed, setTrackMaxSpeed] = useState(0)
  const [trackCurrentSpeed, setTrackCurrentSpeed] = useState(0)
  const [trackElevation, setTrackElevation] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)

  // ─── Refs for non-reactive state ──────────────────────────────
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedDurationRef = useRef<number>(0)
  const isPausedRef = useRef(false)
  const autoPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoPausedRef = useRef(false)
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastAutoSaveRef = useRef<number>(0)
  const lastGpsFixRef = useRef<number>(0)
  const gpsErrorCountRef = useRef<number>(0)
  const lastValidPointRef = useRef<TrackPoint | null>(null)
  const gpsReacquireIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastAltitudeRef = useRef<number | null>(null)

  // ─── Auto-start tracking state ────────────────────────────────
  const [autoStartEnabled, setAutoStartEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('mototrack_autoStartTracking') === 'true' } catch { return false }
    }
    return false
  })
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null)
  const autoStartWatchRef = useRef<number | null>(null)
  const autoStartCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStartSpeedAboveRef = useRef<boolean>(false)
  const autoStartSpeedStartRef = useRef<number>(0)

  // ─── Derived current position ─────────────────────────────────
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const currentPos = useMemo<{ lat: number; lng: number } | null>(() => {
    if (trackPoints.length > 0) {
      const last = trackPoints[trackPoints.length - 1]
      if (last.alt !== -9999) return { lat: last.lat, lng: last.lng }
      for (let i = trackPoints.length - 2; i >= 0; i--) {
        if (trackPoints[i].alt !== -9999) return { lat: trackPoints[i].lat, lng: trackPoints[i].lng }
      }
    }
    return null
  }, [trackPoints])

  // ─── Visibility change handler (background/foreground) ────────
  useEffect(() => {
    if (!isTracking) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Re-acquire WakeLock
        if (settings.wakelockEnabled && 'wakeLock' in navigator) {
          try { await navigator.wakeLock.request('screen') } catch {}
        }
        // Fresh GPS fix
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const point: TrackPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude, timestamp: Date.now() }
              if (pos.coords.accuracy <= 200) {
                lastGpsFixRef.current = Date.now()
                lastValidPointRef.current = point
                if (pos.coords.altitude !== null) {
                  if (lastAltitudeRef.current !== null) {
                    const altDiff = pos.coords.altitude - lastAltitudeRef.current
                    if (altDiff > 0) {
                      setTrackElevation(prev => Math.round((prev + altDiff) * 10) / 10)
                    }
                  }
                  lastAltitudeRef.current = pos.coords.altitude
                }
              }
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
          )
        }
        // Time gap toast
        const timeSinceLastFix = Date.now() - lastGpsFixRef.current
        if (lastGpsFixRef.current > 0 && timeSinceLastFix > 30000) {
          const gapMinutes = Math.round(timeSinceLastFix / 60000)
          const gapSeconds = Math.round(timeSinceLastFix / 1000)
          const gapText = gapMinutes >= 1 ? `${gapMinutes} min` : `${gapSeconds} s`
          toast.info(`📡 Nazaj po ${gapText} — nadaljujem sledenje`)
        }
      } else {
        // Going to background — save state
        try {
          setTrackPoints(prev => {
            if (prev.length > 0) {
              try { localStorage.setItem('mototrack_autosave', JSON.stringify(prev)) } catch {}
            }
            return prev
          })
        } catch {}
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isTracking, settings.wakelockEnabled])

  // ─── Start tracking ───────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { toast.error('Geolokacija ni na voljo'); return }
    setIsTracking(true); setIsPaused(false); isPausedRef.current = false; autoPausedRef.current = false
    setTrackPoints([]); setTrackDuration(0); setTrackDistance(0); setTrackMaxSpeed(0)
    setTrackCurrentSpeed(0); setTrackElevation(0); setGpsAccuracy(null)
    setCurrentRideId(`ride_${Date.now()}`)
    startTimeRef.current = Date.now(); pausedDurationRef.current = 0
    lastGpsFixRef.current = Date.now()
    gpsErrorCountRef.current = 0
    lastValidPointRef.current = null
    lastAltitudeRef.current = null

    timerRef.current = setInterval(() => { if (!isPausedRef.current) setTrackDuration(p => p + 1) }, 1000)

    // Periodic GPS re-acquisition (for Android PWA background issues)
    gpsReacquireIntervalRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        const timeSinceLastFix = Date.now() - lastGpsFixRef.current
        if (timeSinceLastFix > 30000) {
          toast.info('📡 Ponovna vzpostavitev GPS...')
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (pos.coords.accuracy <= 200) {
                const point: TrackPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude, timestamp: Date.now() }
                lastGpsFixRef.current = Date.now()
                lastValidPointRef.current = point
                gpsErrorCountRef.current = 0
                if (pos.coords.altitude !== null) {
                  if (lastAltitudeRef.current !== null) {
                    const altDiff = pos.coords.altitude - lastAltitudeRef.current
                    if (altDiff > 0) {
                      setTrackElevation(prev => Math.round((prev + altDiff) * 10) / 10)
                    }
                  }
                  lastAltitudeRef.current = pos.coords.altitude
                }
                setTrackPoints(prev => {
                  const newPoints = [...prev]
                  if (newPoints.length > 0) {
                    const lastPoint = newPoints[newPoints.length - 1]
                    if (lastPoint.alt !== -9999) {
                      const gapTime = point.timestamp - lastPoint.timestamp
                      if (gapTime > 30000) {
                        newPoints.push({ lat: lastPoint.lat, lng: lastPoint.lng, alt: -9999, timestamp: lastPoint.timestamp + 1 })
                      }
                    }
                  }
                  newPoints.push(point)
                  if (Date.now() - lastAutoSaveRef.current > 15000) {
                    lastAutoSaveRef.current = Date.now()
                    try { localStorage.setItem('mototrack_autosave', JSON.stringify(newPoints)) } catch {}
                  }
                  return newPoints
                })
              }
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
          )
        }
      }
    }, 30000)

    // Main GPS watchPosition
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, alt: pos.coords.altitude, timestamp: Date.now() }
        
        // GPS sanity check: reject jumps > 500m in < 2 seconds
        if (lastValidPointRef.current) {
          const last = lastValidPointRef.current
          const dist = haversine(last.lat, last.lng, point.lat, point.lng)
          const timeDiff = (point.timestamp - last.timestamp) / 1000
          if (dist > 500 && timeDiff < 2) {
            console.warn('[Tracking] GPS glitch: jump', dist, 'm in', timeDiff, 's — rejecting')
            return
          }
          if (pos.coords.accuracy > 200) {
            console.warn('[Tracking] Low GPS accuracy:', pos.coords.accuracy, 'm — skipping')
            return
          }
        }
        
        lastGpsFixRef.current = Date.now()
        gpsErrorCountRef.current = 0
        lastValidPointRef.current = point
        setGpsAccuracy(pos.coords.accuracy)

        // Elevation tracking
        if (pos.coords.altitude !== null) {
          if (lastAltitudeRef.current !== null) {
            const altDiff = pos.coords.altitude - lastAltitudeRef.current
            if (altDiff > 0) {
              setTrackElevation(prev => Math.round((prev + altDiff) * 10) / 10)
            }
          }
          lastAltitudeRef.current = pos.coords.altitude
        }

        setTrackPoints(prev => {
          const newPoints = [...prev]
          // GPS gap interpolation
          if (newPoints.length > 0) {
            const lastPoint = newPoints[newPoints.length - 1]
            if (lastPoint.alt !== -9999) {
              const gapTime = point.timestamp - lastPoint.timestamp
              if (gapTime > 30000) {
                newPoints.push({ lat: lastPoint.lat, lng: lastPoint.lng, alt: -9999, timestamp: lastPoint.timestamp + 1 })
              }
            }
          }
          newPoints.push(point)
          // Auto-save to localStorage every 15 seconds
          if (newPoints.length > 0 && Date.now() - lastAutoSaveRef.current > 15000) {
            lastAutoSaveRef.current = Date.now()
            try { localStorage.setItem('mototrack_autosave', JSON.stringify(newPoints)) } catch {}
          }
          // Distance calculation
          if (prev.length > 0 && !isPausedRef.current) {
            const lastNonGapPoint = [...prev].reverse().find(p => p.alt !== -9999)
            if (lastNonGapPoint) {
              const d = haversine(lastNonGapPoint.lat, lastNonGapPoint.lng, point.lat, point.lng)
              setTrackDistance(dd => Math.round((dd + d) * 100) / 100)
            }
          }
          return newPoints
        })

        // Speed tracking + auto-pause
        if (pos.coords.speed !== null && pos.coords.speed >= 0) {
          const kph = Math.round(pos.coords.speed * 3.6 * 10) / 10
          setTrackCurrentSpeed(kph); setTrackMaxSpeed(max => Math.max(max, kph))
          
          if (settings.autoPauseEnabled && !isPausedRef.current && kph < settings.autoPauseSpeedThreshold) {
            if (!autoPauseTimerRef.current) {
              autoPauseTimerRef.current = setTimeout(() => {
                if (isPausedRef.current) return
                autoPausedRef.current = true
                setIsPaused(true); isPausedRef.current = true
                pausedDurationRef.current = Date.now()
                toast.info('🔄 Samodejni premor (nizka hitrost)')
              }, 5000)
            }
          } else {
            if (autoPauseTimerRef.current) { clearTimeout(autoPauseTimerRef.current); autoPauseTimerRef.current = null }
            if (autoPausedRef.current && isPausedRef.current && kph >= settings.autoPauseSpeedThreshold) {
              autoPausedRef.current = false
              setIsPaused(false); isPausedRef.current = false
              if (pausedDurationRef.current) startTimeRef.current += Date.now() - pausedDurationRef.current
              toast.info('▶️ Nadaljevanje snemanja')
            }
          }
        }
      },
      (error) => {
        gpsErrorCountRef.current++
        const errMsg = error.code === 1 ? 'Dostop do lokacije zavrnjen'
          : error.code === 2 ? 'Lokacija ni na voljo'
          : error.code === 3 ? 'Časovna omejitev GPS'
          : 'Napaka GPS'
        if (gpsErrorCountRef.current <= 3) {
          toast.error(`📡 ${errMsg} — poskušam znova...`)
        } else if (gpsErrorCountRef.current === 10) {
          toast.error('📡 GPS signal izgubljen. Preverite lokacijske nastavitve.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    )
  }, [settings.autoPauseEnabled, settings.autoPauseSpeedThreshold, settings.wakelockEnabled])

  // ─── Pause / Resume / Stop ────────────────────────────────────
  const pauseTracking = useCallback(() => { 
    setIsPaused(true); isPausedRef.current = true; pausedDurationRef.current = Date.now() 
  }, [])

  const resumeTracking = useCallback(() => { 
    setIsPaused(false); isPausedRef.current = false
    if (pausedDurationRef.current) startTimeRef.current += Date.now() - pausedDurationRef.current 
  }, [])

  const stopTracking = useCallback(() => {
    setIsTracking(false); setIsPaused(false); isPausedRef.current = false; autoPausedRef.current = false
    setCurrentRideId(null)
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (autoPauseTimerRef.current) { clearTimeout(autoPauseTimerRef.current); autoPauseTimerRef.current = null }
    if (autoSaveIntervalRef.current) { clearInterval(autoSaveIntervalRef.current); autoSaveIntervalRef.current = null }
    if (gpsReacquireIntervalRef.current) { clearInterval(gpsReacquireIntervalRef.current); gpsReacquireIntervalRef.current = null }
    try { localStorage.removeItem('mototrack_autosave') } catch {}
    setTrackCurrentSpeed(0)
  }, [])

  // ─── Save ride ────────────────────────────────────────────────
  const saveRide = useCallback(async () => {
    if (trackPoints.length < 2) { toast.error('Premalo podatkov'); return }
    try {
      let startLat = trackPoints[0].lat
      let startLng = trackPoints[0].lng
      let endLat = trackPoints[trackPoints.length - 1].lat
      let endLng = trackPoints[trackPoints.length - 1].lng

      if (settings.hideStartEnd) {
        startLat += (Math.random() - 0.5) * 0.005
        startLng += (Math.random() - 0.5) * 0.005
        endLat += (Math.random() - 0.5) * 0.005
        endLng += (Math.random() - 0.5) * 0.005
      }

      const startObf = obfuscateCoordinate(startLat, startLng, privacyZones)
      if (startObf) { startLat = startObf.lat; startLng = startObf.lng }
      const endObf = obfuscateCoordinate(endLat, endLng, privacyZones)
      if (endObf) { endLat = endObf.lat; endLng = endObf.lng }

      let filteredPoints = trackPoints
      if (privacyZones.length > 0) {
        filteredPoints = trackPoints.map(p => {
          if (isInPrivacyZone(p.lat, p.lng, privacyZones)) {
            const obf = obfuscateCoordinate(p.lat, p.lng, privacyZones)
            return obf ? { ...p, lat: obf.lat, lng: obf.lng } : p
          }
          return p
        })
      }

      const nonGapPoints = filteredPoints.filter(p => p.alt !== -9999)
      const trackData = JSON.stringify(nonGapPoints.map(p => [p.lat, p.lng, p.alt, p.timestamp]))
      const res = await fetch('/api/rides', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          title: `Vožnja ${new Date().toLocaleDateString('sl-SI')}`, 
          distance: trackDistance, duration: trackDuration, 
          avgSpeed: trackDuration > 0 ? Math.round((trackDistance / (trackDuration / 3600)) * 10) / 10 : 0, 
          maxSpeed: trackMaxSpeed, elevation: Math.round(trackElevation), 
          trackData, startLat, startLng, endLat, endLng, isPublic: true 
        }) 
      })
      if (res.ok) { 
        toast.success('Vožnja shranjena!'); 
        setTrackPoints([]); setTrackDuration(0); setTrackDistance(0)
        setTrackMaxSpeed(0); setTrackElevation(0)
        onRideSaved?.()
        // Check achievements
        if (userId) {
          fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
            .then(r => r.json())
            .then(j => { if (j.data?.newlyEarned?.length > 0) j.data.newlyEarned.forEach((a: { title: string; icon: string }) => toast.success(`🏆 Nov dosežek: ${a.icon} ${a.title}!`)) })
            .catch(() => {})
        }
      }
      else toast.error('Napaka pri shranjevanju')
    } catch { toast.error('Napaka pri shranjevanju') }
  }, [trackPoints, trackDistance, trackDuration, trackMaxSpeed, trackElevation, onRideSaved, settings.hideStartEnd, privacyZones, userId])

  // ─── Toggle auto-start ────────────────────────────────────────
  const toggleAutoStart = useCallback(() => {
    setAutoStartEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('mototrack_autoStartTracking', String(next)) } catch {}
      if (!next) {
        if (autoStartWatchRef.current !== null) {
          navigator.geolocation.clearWatch(autoStartWatchRef.current)
          autoStartWatchRef.current = null
        }
        if (autoStartCountdownRef.current) {
          clearInterval(autoStartCountdownRef.current)
          autoStartCountdownRef.current = null
        }
        autoStartSpeedAboveRef.current = false
        autoStartSpeedStartRef.current = 0
        setAutoStartCountdown(null)
        toast.info('⚡ Samodejni začetek izklopljen')
      } else {
        toast.success('⚡ Samodejni začetek vklopljen — sledenje se začne pri > 20 km/h')
      }
      return next
    })
  }, [])

  // ─── Auto-start GPS monitoring ────────────────────────────────
  useEffect(() => {
    if (!autoStartEnabled || !isActiveTabTrack || isTracking) {
      if (autoStartWatchRef.current !== null) {
        navigator.geolocation.clearWatch(autoStartWatchRef.current)
        autoStartWatchRef.current = null
      }
      if (autoStartCountdownRef.current) {
        clearInterval(autoStartCountdownRef.current)
        autoStartCountdownRef.current = null
      }
      autoStartSpeedAboveRef.current = false
      autoStartSpeedStartRef.current = 0
      setAutoStartCountdown(null)
      return
    }

    if (!navigator.geolocation) return

    autoStartWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh = pos.coords.speed !== null ? pos.coords.speed * 3.6 : 0
        if (speedKmh > 20) {
          if (!autoStartSpeedAboveRef.current) {
            autoStartSpeedAboveRef.current = true
            autoStartSpeedStartRef.current = Date.now()
            setAutoStartCountdown(30)
            toast.info('🚀 Zaznavam gibanje... sledenje se samodejno začne čez 30 sekund')
            if (autoStartCountdownRef.current) clearInterval(autoStartCountdownRef.current)
            autoStartCountdownRef.current = setInterval(() => {
              const elapsed = Math.floor((Date.now() - autoStartSpeedStartRef.current) / 1000)
              const remaining = 30 - elapsed
              if (remaining <= 0) {
                if (autoStartCountdownRef.current) clearInterval(autoStartCountdownRef.current)
                autoStartCountdownRef.current = null
                autoStartSpeedAboveRef.current = false
                setAutoStartCountdown(null)
                startTracking()
                toast.success('🚀 Samodejni začetek sledenja!')
              } else {
                setAutoStartCountdown(remaining)
              }
            }, 1000)
          }
        } else {
          if (autoStartSpeedAboveRef.current) {
            autoStartSpeedAboveRef.current = false
            autoStartSpeedStartRef.current = 0
            if (autoStartCountdownRef.current) {
              clearInterval(autoStartCountdownRef.current)
              autoStartCountdownRef.current = null
            }
            setAutoStartCountdown(null)
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )

    return () => {
      if (autoStartWatchRef.current !== null) {
        navigator.geolocation.clearWatch(autoStartWatchRef.current)
        autoStartWatchRef.current = null
      }
      if (autoStartCountdownRef.current) {
        clearInterval(autoStartCountdownRef.current)
        autoStartCountdownRef.current = null
      }
      autoStartSpeedAboveRef.current = false
      autoStartSpeedStartRef.current = 0
    }
  }, [autoStartEnabled, isActiveTabTrack, isTracking, startTracking])

  // ─── Crash recovery from localStorage ─────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mototrack_autosave')
      if (saved) {
        const rawPoints: unknown[] = JSON.parse(saved)
        if (!Array.isArray(rawPoints) || rawPoints.length < 2 || rawPoints.length > 50000) {
          localStorage.removeItem('mototrack_autosave')
          return
        }
        const points: TrackPoint[] = rawPoints.filter((p: any) =>
          typeof p.lat === 'number' && typeof p.lng === 'number' && typeof p.timestamp === 'number' &&
          !isNaN(p.lat) && !isNaN(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
        ) as TrackPoint[]
        if (points.length < 2) {
          localStorage.removeItem('mototrack_autosave')
          return
        }
        const recoverData = () => {
          setTrackPoints(points)
          let dist = 0
          for (let i = 1; i < points.length; i++) {
            if (points[i].alt !== -9999 && points[i - 1].alt !== -9999) {
              dist += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
            }
          }
          setTrackDistance(Math.round(dist * 100) / 100)
          toast.success(`♻️ Obnovljeno ${points.length} točk (${dist.toFixed(1)} km)`)
          localStorage.removeItem('mototrack_autosave')
        }
        const timer = setTimeout(recoverData, 1500)
        return () => clearTimeout(timer)
      }
    } catch {
      try { localStorage.removeItem('mototrack_autosave') } catch {}
    }
  }, [])

  // ─── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      if (autoPauseTimerRef.current) clearTimeout(autoPauseTimerRef.current)
      if (gpsReacquireIntervalRef.current) clearInterval(gpsReacquireIntervalRef.current)
    }
  }, [])

  return {
    // State
    isTracking, isPaused, currentRideId, trackPoints,
    trackDuration, trackDistance, trackMaxSpeed, trackCurrentSpeed,
    trackElevation, gpsAccuracy, currentPos,
    autoStartEnabled, autoStartCountdown,
    // Actions
    startTracking, pauseTracking, resumeTracking, stopTracking, saveRide,
    toggleAutoStart,
  }
}
