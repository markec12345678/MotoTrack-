'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  MapPin,
  Clock,
  Navigation2,
  Trash2,
  Share2,
  Camera,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Car,
  ArrowUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ===== PARKING SPOT REMINDER =====
// Remember where you parked your motorcycle
// Auto-suggest on ride stop, navigate back, share location

interface ParkingSpot {
  id: string
  lat: number
  lng: number
  address: string
  timestamp: number
  note: string
  photo?: string // base64 compressed
}

// Haversine distance in meters
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Bearing from point 1 to point 2
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const la1 = (lat1 * Math.PI) / 180
  const la2 = (lat2 * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(la2)
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Format time ago in Slovenian
function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Pravkar'
  if (minutes < 60) return `${minutes} min nazaj`
  if (hours < 24) return `${hours} h nazaj`
  return `${days} dni nazaj`
}

// Format walking time
function formatWalkingTime(meters: number): string {
  const walkingSpeed = 5000 / 3600 // 5 km/h in m/s
  const seconds = meters / walkingSpeed
  if (seconds < 60) return '< 1 min'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

// Auto-expire: spots older than 48h are removed
const MAX_AGE = 48 * 3600000
const MAX_SPOTS = 5

function loadSpots(): ParkingSpot[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('mototrack_parking')
    if (!raw) return []
    const spots: ParkingSpot[] = JSON.parse(raw)
    // Auto-expire old spots
    const now = Date.now()
    const valid = spots.filter(s => now - s.timestamp < MAX_AGE)
    if (valid.length !== spots.length) {
      localStorage.setItem('mototrack_parking', JSON.stringify(valid))
    }
    return valid.slice(0, MAX_SPOTS)
  } catch {
    return []
  }
}

function saveSpots(spots: ParkingSpot[]): void {
  try {
    localStorage.setItem('mototrack_parking', JSON.stringify(spots.slice(0, MAX_SPOTS)))
  } catch {}
}

// Reverse geocode using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=sl`,
      { headers: { 'User-Agent': 'MotoTrack/1.0' } }
    )
    if (res.ok) {
      const data = await res.json()
      return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
  } catch {}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

interface ParkingSpotProps {
  isOpen: boolean
  onClose: () => void
  currentLat?: number | null
  currentLng?: number | null
  onSaveParking?: (lat: number, lng: number) => void
}

export function ParkingSpotPanel({
  isOpen,
  onClose,
  currentLat,
  currentLng,
  onSaveParking,
}: ParkingSpotProps) {
  const [spots, setSpots] = useState<ParkingSpot[]>([])
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [showNoteInput, setShowNoteInput] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null)

  // Load spots on mount and when panel opens
  useEffect(() => {
    setSpots(loadSpots())
  }, [isOpen])

  // Update current position
  useEffect(() => {
    if (currentLat != null && currentLng != null) {
      setCurrentPos({ lat: currentLat, lng: currentLng })
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [currentLat, currentLng, isOpen])

  // Save current location as parking spot
  const saveParking = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      let lat = currentLat
      let lng = currentLng

      if (lat == null || lng == null) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
            })
          })
          lat = pos.coords.latitude
          lng = pos.coords.longitude
        } catch {
          return
        }
      }

      const address = await reverseGeocode(lat!, lng!)
      const newSpot: ParkingSpot = {
        id: `park_${Date.now()}`,
        lat: lat!,
        lng: lng!,
        address,
        timestamp: Date.now(),
        note: '',
      }

      const updated = [newSpot, ...spots].slice(0, MAX_SPOTS)
      setSpots(updated)
      saveSpots(updated)
      onSaveParking?.(lat!, lng!)
    } finally {
      setSaving(false)
    }
  }, [saving, currentLat, currentLng, spots, onSaveParking])

  // Delete a spot
  const deleteSpot = useCallback((id: string) => {
    const updated = spots.filter(s => s.id !== id)
    setSpots(updated)
    saveSpots(updated)
  }, [spots])

  // Update note for a spot
  const updateNote = useCallback((id: string, newNote: string) => {
    const updated = spots.map(s => s.id === id ? { ...s, note: newNote } : s)
    setSpots(updated)
    saveSpots(updated)
    setShowNoteInput(null)
  }, [spots])

  // Share parking location
  const shareLocation = useCallback(async (spot: ParkingSpot) => {
    const text = `🅿️ Moj motor je parkiran: ${spot.address}\n📍 https://www.google.com/maps?q=${spot.lat},${spot.lng}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Parkiran motor', text })
        return
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }, [])

  // Navigate to parking spot (walking)
  const navigateToSpot = useCallback((spot: ParkingSpot) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=walking`
    window.open(url, '_blank')
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Parkirni spomin</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Save current location button */}
          <button
            onClick={saveParking}
            disabled={saving}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <MapPin className="size-5" />
            {saving ? 'Shranjujem...' : 'Shrani trenutno lokacijo'}
          </button>

          {/* Active parking spot (most recent) */}
          {spots.length > 0 && currentPos && (() => {
            const active = spots[0]
            const dist = haversineM(currentPos.lat, currentPos.lng, active.lat, active.lng)
            const dir = bearing(currentPos.lat, currentPos.lng, active.lat, active.lng)
            const bearingFromNorth = dir

            return (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🅿️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primary truncate">{active.address}</p>
                    <p className="text-xs text-muted-foreground">{formatTimeAgo(active.timestamp)}</p>
                  </div>
                </div>

                {/* Distance + direction */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`}</p>
                    <p className="text-xs text-muted-foreground">Razdalja do motorja</p>
                  </div>
                  {/* Direction arrow */}
                  <div className="relative size-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <div
                      className="transition-transform duration-500"
                      style={{ transform: `rotate(${bearingFromNorth}deg)` }}
                    >
                      <ArrowUp className="size-8 text-primary" />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatWalkingTime(dist)}</p>
                    <p className="text-xs text-muted-foreground">Hoja</p>
                  </div>
                </div>

                {/* Note */}
                {active.note ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50">
                    <FileText className="size-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{active.note}</p>
                  </div>
                ) : null}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateToSpot(active)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-bold active:scale-95 transition-transform"
                  >
                    <Navigation2 className="size-4" />
                    Vodi do motorja
                  </button>
                  <button
                    onClick={() => shareLocation(active)}
                    className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                    title="Deli lokacijo"
                  >
                    <Share2 className="size-4" />
                  </button>
                  <button
                    onClick={() => setShowNoteInput(showNoteInput === active.id ? null : active.id)}
                    className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                    title="Dodaj opombo"
                  >
                    <FileText className="size-4" />
                  </button>
                </div>

                {/* Note input */}
                {showNoteInput === active.id && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Npr. 3. nadstropje, mesto B12"
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && note.trim()) {
                          updateNote(active.id, note.trim())
                          setNote('')
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (note.trim()) {
                          updateNote(active.id, note.trim())
                          setNote('')
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium"
                    >
                      Shrani
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Recent parking spots */}
          {spots.length > 1 && (
            <div>
              <button
                onClick={() => setExpanded(expanded === 'history' ? null : 'history')}
                className="w-full flex items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Zadnja parkirišča ({spots.length - 1})</span>
                {expanded === 'history' ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {expanded === 'history' && (
                <div className="space-y-2 mt-2">
                  {spots.slice(1).map(spot => (
                    <div key={spot.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
                      <MapPin className="size-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{spot.address}</p>
                        <p className="text-xs text-muted-foreground">{formatTimeAgo(spot.timestamp)}</p>
                      </div>
                      <button
                        onClick={() => navigateToSpot(spot)}
                        className="p-1.5 rounded-full hover:bg-muted"
                        title="Vodi do sem"
                      >
                        <Navigation2 className="size-3.5 text-primary" />
                      </button>
                      <button
                        onClick={() => deleteSpot(spot.id)}
                        className="p-1.5 rounded-full hover:bg-red-500/10"
                        title="Izbriši"
                      >
                        <Trash2 className="size-3.5 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {spots.length === 0 && (
            <div className="text-center py-8">
              <span className="text-4xl">🅿️</span>
              <p className="mt-2 text-sm text-muted-foreground">Nobenega shranjenega parkirišča</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Pritisnite &quot;Shrani trenutno lokacijo&quot; ko parkirate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Floating parking indicator for map
export function ParkingMapIndicator({
  currentLat,
  currentLng,
  onClick,
}: {
  currentLat?: number | null
  currentLng?: number | null
  onClick: () => void
}) {
  const [spots, setSpots] = useState<ParkingSpot[]>([])

  useEffect(() => {
    setSpots(loadSpots())
    const interval = setInterval(() => setSpots(loadSpots()), 30000)
    return () => clearInterval(interval)
  }, [])

  if (spots.length === 0) return null
  if (currentLat == null || currentLng == null) return null

  const spot = spots[0]
  const dist = haversineM(currentLat, currentLng, spot.lat, spot.lng)

  // Don't show if very close (already at motorcycle)
  if (dist < 20) return null

  const dir = bearing(currentLat, currentLng, spot.lat, spot.lng)

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/90 text-white text-xs font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-colors active:scale-95"
      title="Parkirni spomin"
    >
      <span className="text-sm">🅿️</span>
      <span>{dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`}</span>
      <div
        className="transition-transform duration-500"
        style={{ transform: `rotate(${dir}deg)` }}
      >
        <ArrowUp className="size-3" />
      </div>
    </button>
  )
}

// Auto-save prompt: shown when ride stops
export function ParkingSavePrompt({
  onSave,
  onDismiss,
}: {
  onSave: () => void
  onDismiss: () => void
}) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2000] w-80 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500 shadow-xl shadow-blue-500/30 text-white">
        <span className="text-2xl">🅿️</span>
        <div className="flex-1">
          <p className="text-sm font-bold">Ali ste parkirali?</p>
          <p className="text-xs opacity-80">Shrani lokacijo parkiranja</p>
        </div>
        <button
          onClick={onSave}
          className="px-3 py-1.5 rounded-lg bg-white text-blue-500 text-xs font-bold hover:bg-white/90 active:scale-95 transition-transform"
        >
          Shrani
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded-full hover:bg-white/20"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
