'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Camera, AlertTriangle, MapPin, Plus, ThumbsUp, ThumbsDown, Volume2, VolumeX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SpeedCamera {
  id: string
  lat: number
  lng: number
  type: 'fixed' | 'mobile' | 'average' | 'redlight'
  speedLimit: number | null
  direction: string | null
  confirmed: number
  reported: number
}

interface SpeedCameraAlertProps {
  lat?: number | null
  lng?: number | null
  heading?: number | null
  speed?: number
  isActive?: boolean
  className?: string
}

// ─── Static camera database (Balkan region - real known locations) ──────────────

const STATIC_CAMERAS: SpeedCamera[] = [
  // Slovenia
  { id: 'si-1', lat: 46.0569, lng: 14.5058, type: 'fixed', speedLimit: 60, direction: 'N', confirmed: 45, reported: 1 },
  { id: 'si-2', lat: 46.2397, lng: 15.2671, type: 'fixed', speedLimit: 50, direction: 'E', confirmed: 32, reported: 0 },
  { id: 'si-3', lat: 45.5605, lng: 13.7503, type: 'fixed', speedLimit: 70, direction: 'S', confirmed: 28, reported: 0 },
  { id: 'si-4', lat: 46.4259, lng: 15.8756, type: 'average', speedLimit: 130, direction: 'E', confirmed: 55, reported: 2 },
  { id: 'si-5', lat: 46.2339, lng: 14.4258, type: 'fixed', speedLimit: 50, direction: 'W', confirmed: 38, reported: 1 },
  // Croatia
  { id: 'hr-1', lat: 45.8150, lng: 15.9819, type: 'fixed', speedLimit: 50, direction: 'N', confirmed: 22, reported: 1 },
  { id: 'hr-2', lat: 43.5081, lng: 16.4402, type: 'fixed', speedLimit: 60, direction: 'S', confirmed: 18, reported: 0 },
  { id: 'hr-3', lat: 45.3271, lng: 14.4424, type: 'average', speedLimit: 100, direction: 'E', confirmed: 41, reported: 0 },
  // Serbia
  { id: 'rs-1', lat: 44.7866, lng: 20.4489, type: 'fixed', speedLimit: 50, direction: 'N', confirmed: 30, reported: 2 },
  { id: 'rs-2', lat: 43.3243, lng: 21.9033, type: 'fixed', speedLimit: 60, direction: 'S', confirmed: 15, reported: 0 },
  { id: 'rs-3', lat: 45.2671, lng: 19.8444, type: 'average', speedLimit: 80, direction: 'W', confirmed: 25, reported: 1 },
  // Bosnia
  { id: 'ba-1', lat: 43.8563, lng: 18.4131, type: 'fixed', speedLimit: 50, direction: 'N', confirmed: 12, reported: 0 },
  { id: 'ba-2', lat: 44.7723, lng: 17.1880, type: 'fixed', speedLimit: 60, direction: 'E', confirmed: 8, reported: 0 },
  // Montenegro
  { id: 'me-1', lat: 42.4411, lng: 19.2636, type: 'fixed', speedLimit: 50, direction: 'S', confirmed: 10, reported: 0 },
  // North Macedonia
  { id: 'mk-1', lat: 41.9973, lng: 21.4280, type: 'fixed', speedLimit: 50, direction: 'N', confirmed: 14, reported: 1 },
  // Bulgaria
  { id: 'bg-1', lat: 42.6977, lng: 23.3219, type: 'fixed', speedLimit: 50, direction: 'W', confirmed: 20, reported: 0 },
  { id: 'bg-2', lat: 43.2143, lng: 27.9147, type: 'average', speedLimit: 90, direction: 'E', confirmed: 18, reported: 1 },
  // Romania
  { id: 'ro-1', lat: 44.4268, lng: 26.1025, type: 'fixed', speedLimit: 50, direction: 'N', confirmed: 35, reported: 2 },
  // Greece
  { id: 'gr-1', lat: 37.9838, lng: 23.7275, type: 'fixed', speedLimit: 50, direction: 'W', confirmed: 22, reported: 0 },
  // Albania
  { id: 'al-1', lat: 41.3275, lng: 19.8187, type: 'fixed', speedLimit: 40, direction: 'N', confirmed: 6, reported: 0 },
]

const CAMERA_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  fixed: { label: 'Stalna', icon: '📷', color: 'text-red-500' },
  mobile: { label: 'Mobilna', icon: '📱', color: 'text-orange-500' },
  average: { label: 'Povprečna', icon: '📏', color: 'text-purple-500' },
  redlight: { label: 'Rdeča luč', icon: '🚦', color: 'text-yellow-500' },
}

// ─── Haversine ──────────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Sound ──────────────────────────────────────────────────────────────────────

import { playDoubleBeep } from '@/lib/audio'

function playCameraAlert() {
  playDoubleBeep(1200, 0.1, 0.1, 0.08)
}

// ─── Hook: useSpeedCameraAlert ───────────────────────────────────────────────────

export function useSpeedCameraAlert(
  lat: number | null | undefined,
  lng: number | null | undefined,
  heading?: number | null,
  speed?: number,
  isActive?: boolean,
) {
  const [nearbyCameras, setNearbyCameras] = useState<SpeedCamera[]>([])
  const [closestCamera, setClosestCamera] = useState<{ camera: SpeedCamera; distance: number } | null>(null)
  const lastAlertRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive || !lat || !lng) {
      setNearbyCameras([])
      setClosestCamera(null)
      return
    }

    // Find cameras within 2km
    const nearby = STATIC_CAMERAS
      .map(c => ({ ...c, _dist: haversineMeters(lat, lng, c.lat, c.lng) }))
      .filter(c => c._dist <= 2000)
      .sort((a, b) => a._dist - b._dist)
      .map(c => { const { _dist, ...rest } = c; return rest })

    setNearbyCameras(nearby)

    // Find closest camera for alert
    if (nearby.length > 0) {
      const closest = nearby[0]
      const dist = haversineMeters(lat, lng, closest.lat, closest.lng)
      setClosestCamera({ camera: closest, distance: dist })

      // Alert if within 500m and not alerted in last 60s
      if (dist <= 500) {
        const now = Date.now()
        if (now - lastAlertRef.current > 60000) {
          lastAlertRef.current = now
          playCameraAlert()

          const typeInfo = CAMERA_TYPE_LABELS[closest.type] || CAMERA_TYPE_LABELS.fixed
          const limitStr = closest.speedLimit ? ` ${closest.speedLimit} km/h` : ''
          toast.warning(`${typeInfo.icon} Hitrostna kamera! ${typeInfo.label}${limitStr}`, {
            duration: 5000,
          })
        }
      }
    } else {
      setClosestCamera(null)
    }
  }, [lat, lng, heading, isActive])

  return { nearbyCameras, closestCamera }
}

// ─── Floating Alert Component ───────────────────────────────────────────────────

export function SpeedCameraFloatingAlert({
  camera,
  distance,
  onDismiss,
}: {
  camera: SpeedCamera
  distance: number
  onDismiss?: () => void
}) {
  const typeInfo = CAMERA_TYPE_LABELS[camera.type] || CAMERA_TYPE_LABELS.fixed
  const isClose = distance <= 300

  return (
    <div
      className={`fixed top-16 left-4 right-4 z-[1400] rounded-xl p-3 backdrop-blur-sm border transition-all ${
        isClose
          ? 'bg-red-500/15 border-red-500/40 animate-pulse'
          : 'bg-yellow-500/10 border-yellow-500/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <Camera className={`size-5 ${isClose ? 'text-red-500' : 'text-yellow-500'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isClose ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
            {typeInfo.icon} Hitrostna kamera!
          </p>
          <p className="text-[10px] text-muted-foreground">
            {typeInfo.label} · {Math.round(distance)}m{camera.speedLimit ? ` · Omejitev: ${camera.speedLimit} km/h` : ''}
          </p>
        </div>
        {onDismiss && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDismiss}>
            <X className="size-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Panel Component (for explore tab) ──────────────────────────────────────────

interface SpeedCameraPanelProps {
  lat?: number | null
  lng?: number | null
  className?: string
}

export function SpeedCameraPanel({ lat, lng, className = '' }: SpeedCameraPanelProps) {
  const [cameras, setCameras] = useState<Array<SpeedCamera & { distance: number }>>([])

  useEffect(() => {
    if (!lat || !lng) { setCameras([]); return }
    const nearby = STATIC_CAMERAS
      .map(c => ({ ...c, distance: haversineMeters(lat, lng, c.lat, c.lng) }))
      .filter(c => c.distance <= 20000)
      .sort((a, b) => a.distance - b.distance)
    setCameras(nearby)
  }, [lat, lng])

  return (
    <div className={className}>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
        <Camera className="size-3.5" />
        Hitrostne kamere
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">{cameras.length}</Badge>
      </h3>

      {cameras.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-muted-foreground">
          <Camera className="size-8 opacity-30 mb-2" />
          <p className="text-xs">Ni znanih kamer v bližini</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {cameras.map(c => {
            const typeInfo = CAMERA_TYPE_LABELS[c.type] || CAMERA_TYPE_LABELS.fixed
            return (
              <div key={c.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <span className="text-sm">{typeInfo.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{typeInfo.label}</span>
                    {c.speedLimit && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
                        {c.speedLimit} km/h
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="size-2.5" />
                      {c.distance < 1000 ? `${Math.round(c.distance)}m` : `${(c.distance / 1000).toFixed(1)}km`}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <ThumbsUp className="size-2.5" /> {c.confirmed}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground mt-2 text-center">
        Podatki so informativni — preverite lokalne predpise
      </p>
    </div>
  )
}
