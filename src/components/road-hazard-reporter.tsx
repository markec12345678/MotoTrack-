'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle, X, Send, MapPin, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// Hazard types with Slovenian labels
const HAZARD_TYPES = [
  { type: 'landslide', emoji: '🪨', label: 'Plaz', color: '#92400e' },
  { type: 'construction', emoji: '🚧', label: 'Gradbišče', color: '#f59e0b' },
  { type: 'camera', emoji: '📸', label: 'Kamera', color: '#ef4444' },
  { type: 'ice', emoji: '❄️', label: 'Poledica', color: '#06b6d4' },
  { type: 'flood', emoji: '💧', label: 'Poplavljeno', color: '#3b82f6' },
  { type: 'animals', emoji: '🦌', label: 'Živali', color: '#22c55e' },
  { type: 'oil', emoji: '⛽', label: 'Olje', color: '#1f2937' },
  { type: 'pothole', emoji: '🕳️', label: 'Luknja', color: '#78716c' },
  { type: 'other', emoji: '⚠️', label: 'Drugo', color: '#a855f7' },
] as const

// Haversine formula for distance calculation (meters)
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Format distance for display
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

// Format time ago in Slovenian
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Pravkar'
  if (diffMin < 60) return `Pred ${diffMin} min`
  if (diffHr < 24) return `Pred ${diffHr} h`
  return `Pred ${diffDay} dni`
}

interface NearbyHazard {
  id: string
  type: string
  name: string
  description: string | null
  lat: number
  lng: number
  createdAt: string
  distance: number
}

interface RoadHazardReporterProps {
  currentLat: number | null
  currentLng: number | null
  userId?: string
  isTracking: boolean
}

export default function RoadHazardReporter({
  currentLat,
  currentLng,
  userId,
  isTracking,
}: RoadHazardReporterProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [reporting, setReporting] = useState(false)
  const [nearbyHazards, setNearbyHazards] = useState<NearbyHazard[]>([])
  const [allHazards, setAllHazards] = useState<Array<{
    id: string
    type: string
    name: string
    description: string | null
    lat: number
    lng: number
    createdAt: string
  }>>([])
  const [loading, setLoading] = useState(false)

  // Fetch hazards from API
  const fetchHazards = useCallback(async () => {
    try {
      const res = await fetch('/api/hazards')
      if (res.ok) {
        const j = await res.json()
        const hazards = j.data || []
        // Filter out hazards older than 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const freshHazards = hazards.filter((h: { createdAt: string }) =>
          new Date(h.createdAt).getTime() > sevenDaysAgo
        )
        setAllHazards(freshHazards)
      }
    } catch {
      // ignore fetch errors
    }
  }, [])

  // Fetch hazards when tracking starts and periodically refresh
  useEffect(() => {
    if (!isTracking) return
    fetchHazards()
    const interval = setInterval(fetchHazards, 60000) // Refresh every 60s
    return () => clearInterval(interval)
  }, [isTracking, fetchHazards])

  // Compute nearby hazards (within 5km)
  useEffect(() => {
    if (currentLat == null || currentLng == null) {
      setNearbyHazards([])
      return
    }
    const nearby = allHazards
      .map((h) => ({
        ...h,
        distance: haversineMeters(currentLat, currentLng, h.lat, h.lng),
      }))
      .filter((h) => h.distance <= 5000)
      .sort((a, b) => a.distance - b.distance)
    setNearbyHazards(nearby)
  }, [allHazards, currentLat, currentLng])

  const nearbyCount = nearbyHazards.length

  // Get hazard type info
  const getHazardInfo = (type: string) => {
    return HAZARD_TYPES.find((h) => h.type === type) || HAZARD_TYPES[HAZARD_TYPES.length - 1]
  }

  // Report a hazard
  const handleReport = useCallback(async () => {
    if (!selectedType) {
      toast.error('Izberite tip nevarnosti')
      return
    }

    // Determine coordinates
    let lat = currentLat
    let lng = currentLng
    if (lat == null || lng == null) {
      // Try to get current location
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          })
        })
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {
        toast.error('Ni mogoče pridobiti lokacije')
        return
      }
    }

    const hazardInfo = getHazardInfo(selectedType)
    setReporting(true)
    try {
      const res = await fetch('/api/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          name: `${hazardInfo.emoji} ${hazardInfo.label}`,
          description: description.trim() || undefined,
          lat,
          lng,
          userId: userId || undefined,
        }),
      })
      if (res.ok) {
        toast.success(`${hazardInfo.emoji} Opozorilo prijavljeno!`)
        setDialogOpen(false)
        setSelectedType(null)
        setDescription('')
        // Refresh hazards
        fetchHazards()
      } else {
        toast.error('Napaka pri prijavi opozorila')
      }
    } catch {
      toast.error('Napaka pri prijavi opozorila')
    } finally {
      setReporting(false)
    }
  }, [selectedType, description, currentLat, currentLng, userId, fetchHazards])

  // Don't render if not tracking
  if (!isTracking) return null

  return (
    <>
      {/* Floating hazard button - bottom left, above dashboard */}
      <button
        onClick={() => setDialogOpen(true)}
        className="absolute bottom-4 left-4 z-[1001] size-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/40 flex items-center justify-center active:scale-95 transition-all"
        title="Prijavi nevarnost na cesti"
      >
        <AlertTriangle className="size-5" />
        {/* Pulsing animation ring */}
        <span className="absolute inset-0 rounded-full bg-amber-400/50 animate-ping" />
        {/* Nearby hazards count badge */}
        {nearbyCount > 0 && (
          <Badge className="absolute -top-1.5 -right-1.5 size-5 p-0 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold border-2 border-white dark:border-gray-900 rounded-full shadow">
            {nearbyCount > 9 ? '9+' : nearbyCount}
          </Badge>
        )}
      </button>

      {/* Hazard reporting dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] w-[360px] p-0 gap-0 rounded-2xl overflow-hidden bg-background border-border">
          {/* Header */}
          <div className="bg-amber-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-white" />
              <DialogTitle className="text-white font-bold text-sm">
                Prijavi nevarnost
              </DialogTitle>
            </div>
            <button
              onClick={() => setDialogOpen(false)}
              className="size-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="size-4 text-white" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Hazard type selection grid */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Tip nevarnosti
              </p>
              <div className="grid grid-cols-3 gap-2">
                {HAZARD_TYPES.map((hazard) => (
                  <button
                    key={hazard.type}
                    onClick={() => setSelectedType(hazard.type)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all text-center ${
                      selectedType === hazard.type
                        ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <span className="text-xl leading-none">{hazard.emoji}</span>
                    <span className={`text-[10px] font-medium leading-tight ${
                      selectedType === hazard.type ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
                    }`}>
                      {hazard.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional description */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Opis <span className="font-normal lowercase">(izbirno)</span>
              </p>
              <Input
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= 100) {
                    setDescription(e.target.value)
                  }
                }}
                placeholder="Npr. na ovinku, za oviro..."
                className="text-sm h-9"
                maxLength={100}
              />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                {description.length}/100
              </p>
            </div>

            {/* GPS indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5 text-amber-500" />
              <span>
                {currentLat != null && currentLng != null
                  ? `GPS: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`
                  : 'GPS ni na voljo'}
              </span>
            </div>

            {/* Report button */}
            <Button
              onClick={handleReport}
              disabled={!selectedType || reporting}
              className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              {reporting ? (
                <>
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Prijavljam...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Prijavi
                </>
              )}
            </Button>

            {/* Nearby hazards list */}
            {nearbyCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    V bližini
                  </p>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-red-500/10 text-red-500 border-red-500/20">
                    {nearbyCount}
                  </Badge>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {nearbyHazards.slice(0, 10).map((hazard) => {
                    const info = getHazardInfo(hazard.type)
                    return (
                      <div
                        key={hazard.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-muted/50"
                      >
                        <span className="text-base leading-none flex-shrink-0">
                          {info.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate text-foreground">
                            {hazard.name || info.label}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="size-2.5" />
                              {formatDistance(hazard.distance)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="size-2.5" />
                              {timeAgo(hazard.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state for nearby hazards */}
            {nearbyCount === 0 && allHazards.length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                V 5 km radiju ni prijavljenih nevarnosti
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
