'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Camera, ImageIcon, MapPin, Clock, X, ChevronLeft, ChevronRight, Trash2, Plus, Navigation2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RidePhoto {
  id: string
  dataUrl: string // base64
  lat: number
  lng: number
  timestamp: number
  caption?: string
}

interface RidePhotoGalleryProps {
  rideId?: string
  trackPoints?: { lat: number; lng: number; alt: number | null; timestamp: number }[]
  isTracking?: boolean
  currentLat?: number | null
  currentLng?: number | null
  onPhotosChange?: (photos: RidePhoto[]) => void
  className?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 10
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB before resize
const MAX_WIDTH = 800 // resize to max 800px width
const STORAGE_KEY_PREFIX = 'mototrack_photos_'

function getStorageKey(rideId?: string): string {
  return `${STORAGE_KEY_PREFIX}${rideId || 'temp'}`
}

function loadPhotos(rideId?: string): RidePhoto[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getStorageKey(rideId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePhotos(rideId: string | undefined, photos: RidePhoto[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getStorageKey(rideId), JSON.stringify(photos))
  } catch {
    toast.error('Napaka pri shranjevanju fotografij — premalo prostora')
  }
}

/** Resize image to max width, return base64 data URL */
function resizeImage(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        if (img.width <= maxWidth) {
          resolve(reader.result as string)
          return
        }
        const scale = maxWidth / img.width
        const canvas = document.createElement('canvas')
        canvas.width = maxWidth
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        // Use JPEG for smaller size
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** Find nearest track point to given lat/lng */
function findNearestTrackPoint(
  lat: number,
  lng: number,
  trackPoints: { lat: number; lng: number; alt: number | null; timestamp: number }[]
): { lat: number; lng: number; timestamp: number } | null {
  if (trackPoints.length === 0) return null
  let minDist = Infinity
  let nearest = trackPoints[0]
  for (const pt of trackPoints) {
    const dLat = pt.lat - lat
    const dLng = pt.lng - lng
    const dist = dLat * dLat + dLng * dLng
    if (dist < minDist) {
      minDist = dist
      nearest = pt
    }
  }
  return { lat: nearest.lat, lng: nearest.lng, timestamp: nearest.timestamp }
}

/** Format timestamp to Slovenian locale time */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('sl-SI', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

/** Format GPS coordinates */
function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function RidePhotoGallery({
  rideId,
  trackPoints = [],
  isTracking = false,
  currentLat = null,
  currentLng = null,
  onPhotosChange,
  className = '',
}: RidePhotoGalleryProps) {
  const [photos, setPhotos] = useState<RidePhoto[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const touchStartXRef = useRef<number | null>(null)

  // Load photos from localStorage on mount
  useEffect(() => {
    const stored = loadPhotos(rideId)
    setPhotos(stored)
  }, [rideId])

  // Notify parent when photos change
  useEffect(() => {
    onPhotosChange?.(photos)
  }, [photos, onPhotosChange])

  // Save to localStorage whenever photos change
  const updatePhotos = useCallback((newPhotos: RidePhoto[]) => {
    setPhotos(newPhotos)
    savePhotos(rideId, newPhotos)
  }, [rideId])

  // Handle file upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input
    e.target.value = ''

    if (photos.length >= MAX_PHOTOS) {
      toast.error(`Največ ${MAX_PHOTOS} fotografij na vožnjo`)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Slika je prevelika (največ 2MB)')
      return
    }

    setUploading(true)
    try {
      const dataUrl = await resizeImage(file, MAX_WIDTH)

      // Get GPS coordinates: use current position or nearest track point
      let photoLat = currentLat ?? 0
      let photoLng = currentLng ?? 0

      if (photoLat === null || photoLng === null || (photoLat === 0 && photoLng === 0)) {
        // Try nearest track point
        if (trackPoints.length > 0) {
          const last = trackPoints[trackPoints.length - 1]
          photoLat = last.lat
          photoLng = last.lng
        }
      }

      const newPhoto: RidePhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        dataUrl,
        lat: photoLat,
        lng: photoLng,
        timestamp: Date.now(),
      }

      updatePhotos([...photos, newPhoto])
      toast.success('Fotografija dodana!')
    } catch {
      toast.error('Napaka pri obdelavi slike')
    } finally {
      setUploading(false)
    }
  }, [photos, currentLat, currentLng, trackPoints, updatePhotos])

  // Delete photo
  const handleDelete = useCallback((photoId: string) => {
    const newPhotos = photos.filter(p => p.id !== photoId)
    updatePhotos(newPhotos)
    setViewerIndex(null)
    toast.success('Fotografija izbrisana')
  }, [photos, updatePhotos])

  // Swipe navigation in viewer
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null || viewerIndex === null) return
    const diff = e.changedTouches[0].clientX - touchStartXRef.current
    if (Math.abs(diff) > 50) {
      if (diff < 0 && viewerIndex < photos.length - 1) {
        setViewerIndex(viewerIndex + 1)
      } else if (diff > 0 && viewerIndex > 0) {
        setViewerIndex(viewerIndex - 1)
      }
    }
    touchStartXRef.current = null
  }, [viewerIndex, photos.length])

  // Keyboard navigation in viewer
  useEffect(() => {
    if (viewerIndex === null) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && viewerIndex < photos.length - 1) {
        setViewerIndex(viewerIndex + 1)
      } else if (e.key === 'ArrowLeft' && viewerIndex > 0) {
        setViewerIndex(viewerIndex - 1)
      } else if (e.key === 'Escape') {
        setViewerIndex(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [viewerIndex, photos.length])

  // Photo markers for map (exported via onPhotosChange)
  const currentPhoto = viewerIndex !== null ? photos[viewerIndex] : null

  return (
    <div className={className}>
      {/* Header with add button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="size-3.5" />
          Fotografije
          {photos.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
              {photos.length}/{MAX_PHOTOS}
            </Badge>
          )}
        </h3>
        {photos.length < MAX_PHOTOS && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Dodaj fotografijo
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed border-border/50 rounded-xl bg-secondary/20">
          <ImageIcon className="size-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Brez fotografij</p>
          <p className="text-xs mt-1 opacity-60">Dodajte fotografije iz vaše vožnje!</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 text-xs h-8"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="size-3.5" />
            Kamera
          </Button>
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="relative group rounded-xl overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-all aspect-[4/3] bg-black/5"
              onClick={() => setViewerIndex(idx)}
            >
              <img
                src={photo.dataUrl}
                alt={photo.caption || `Fotografija ${idx + 1}`}
                className="size-full object-cover"
                loading="lazy"
              />
              {/* Overlay gradient */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent h-1/2 pointer-events-none" />
              {/* Timestamp overlay - bottom left */}
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white pointer-events-none">
                <Clock className="size-2.5 opacity-70" />
                <span className="text-[9px] font-medium">{formatTime(photo.timestamp)}</span>
              </div>
              {/* Location overlay - bottom right */}
              {(photo.lat !== 0 || photo.lng !== 0) && (
                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-white pointer-events-none">
                  <MapPin className="size-2.5 opacity-70" />
                  <span className="text-[8px] opacity-70">Lokacija</span>
                </div>
              )}
              {/* Delete button */}
              <button
                className="absolute top-1 right-1 size-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleDelete(photo.id) }}
                title="Izbriši"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Full-size Photo Viewer Dialog */}
      <Dialog
        open={viewerIndex !== null}
        onOpenChange={(open) => { if (!open) setViewerIndex(null) }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[95vh] p-0 gap-0 bg-black border-white/10 overflow-hidden">
          <DialogTitle className="sr-only">
            {currentPhoto ? `Fotografija ${viewerIndex !== null ? viewerIndex + 1 : ''}` : 'Fotografija'}
          </DialogTitle>
          {currentPhoto && (
            <div
              className="relative w-full flex flex-col"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Image area */}
              <div className="relative flex-1 flex items-center justify-center min-h-[50vh] max-h-[70vh] bg-black">
                <img
                  src={currentPhoto.dataUrl}
                  alt={currentPhoto.caption || 'Fotografija'}
                  className="max-w-full max-h-[70vh] object-contain"
                />
                {/* Navigation arrows */}
                {viewerIndex! > 0 && (
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    onClick={() => setViewerIndex(viewerIndex! - 1)}
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                )}
                {viewerIndex! < photos.length - 1 && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    onClick={() => setViewerIndex(viewerIndex! + 1)}
                  >
                    <ChevronRight className="size-5" />
                  </button>
                )}
                {/* Close button */}
                <button
                  className="absolute top-2 right-2 size-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                  onClick={() => setViewerIndex(null)}
                >
                  <X className="size-4" />
                </button>
                {/* Delete button */}
                <button
                  className="absolute top-2 left-2 size-8 rounded-full bg-red-500/80 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                  onClick={() => handleDelete(currentPhoto.id)}
                  title="Izbriši"
                >
                  <Trash2 className="size-3.5" />
                </button>
                {/* Photo counter */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white text-xs font-medium">
                  {viewerIndex! + 1} / {photos.length}
                </div>
              </div>

              {/* Photo info panel */}
              <div className="px-4 py-3 bg-white/5 border-t border-white/10 space-y-2">
                <div className="flex items-center gap-4 text-white/80 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-white/50" />
                    {formatDateTime(currentPhoto.timestamp)}
                  </span>
                  {(currentPhoto.lat !== 0 || currentPhoto.lng !== 0) && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-white/50" />
                      {formatCoords(currentPhoto.lat, currentPhoto.lng)}
                    </span>
                  )}
                </div>
                {(currentPhoto.lat !== 0 || currentPhoto.lng !== 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-white/70 border-white/20 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      // Open in maps
                      const url = `https://www.openstreetmap.org/?mlat=${currentPhoto.lat}&mlon=${currentPhoto.lng}#map=16/${currentPhoto.lat}/${currentPhoto.lng}`
                      window.open(url, '_blank')
                    }}
                  >
                    <Navigation2 className="size-3" />
                    Pokaži na zemljevidu
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Photo Markers for Map ──────────────────────────────────────────────────────

/** Returns photo markers for the map overlay */
export function usePhotoMarkers(rideId?: string) {
  const [photos, setPhotos] = useState<RidePhoto[]>([])

  useEffect(() => {
    const stored = loadPhotos(rideId)
    setPhotos(stored)
  }, [rideId])

  return photos.map(photo => ({
    id: photo.id,
    lat: photo.lat,
    lng: photo.lng,
    timestamp: photo.timestamp,
    dataUrl: photo.dataUrl,
  }))
}

// ─── Compact Photo Button (for tracking controls) ──────────────────────────────

interface PhotoButtonProps {
  photoCount: number
  disabled?: boolean
  onClick: () => void
}

export function PhotoButton({ photoCount, disabled, onClick }: PhotoButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold shadow-lg transition-colors ${
        disabled
          ? 'bg-white/5 text-white/20 cursor-not-allowed'
          : 'bg-white/10 backdrop-blur-sm text-white/60 hover:bg-white/20'
      }`}
      title={`Fotografije (${photoCount})`}
    >
      <Camera className="size-3" />
      <span>Galerija</span>
      {photoCount > 0 && (
        <span className="flex items-center justify-center size-4 rounded-full bg-primary text-white text-[8px] font-bold -mr-1">
          {photoCount}
        </span>
      )}
    </button>
  )
}
