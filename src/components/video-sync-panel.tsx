'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Video,
  Upload,
  RefreshCw as SyncIcon,
  Clock,
  Camera,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Gauge,
  Mountain,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import type { VideoFootageData } from '@/components/tabs/types'

interface VideoSyncPanelProps {
  userId?: string
  rideId?: string
  onVideoSelect?: (videoId: string) => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; className: string; label: string }> = {
    processing: { icon: Loader2, className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Obdelava' },
    ready: { icon: CheckCircle, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Pripravljen' },
    error: { icon: AlertTriangle, className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Napaka' },
  }
  const { icon: Icon, className, label } = config[status] || config.processing
  return (
    <Badge variant="outline" className={`${className} text-[10px] gap-1`}>
      <Icon className={`size-2.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  )
}

export default function VideoSyncPanel({ userId, rideId, onVideoSelect }: VideoSyncPanelProps) {
  const [videos, setVideos] = useState<VideoFootageData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gpsOffset, setGpsOffset] = useState(0)
  const [showOverlay, setShowOverlay] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchVideos = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ userId })
      if (rideId) params.set('rideId', rideId)
      const res = await fetch(`/api/videos?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setVideos(json.data || [])
      }
    } catch {
      toast.error('Napaka pri nalaganju videov')
    } finally {
      setLoading(false)
    }
  }, [userId, rideId])

  useEffect(() => { fetchVideos() }, [fetchVideos])

  const selectedVideo = videos.find(v => v.id === selectedId)

  const handleAutoSync = async () => {
    if (!selectedVideo) return
    // Simulate auto-detection of GPS offset
    const detectedOffset = Math.round((Math.random() - 0.5) * 20 * 10) / 10
    setGpsOffset(detectedOffset)
    try {
      await fetch(`/api/videos/${selectedVideo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gpsTrackOffset: detectedOffset }),
      })
      toast.success(`Avtosinhronizacija: zamaknjeno za ${detectedOffset}s`)
      fetchVideos()
    } catch {
      toast.error('Napaka pri sinhronizaciji')
    }
  }

  const handleOffsetChange = async (offset: number) => {
    setGpsOffset(offset)
    if (!selectedVideo) return
    try {
      await fetch(`/api/videos/${selectedVideo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gpsTrackOffset: offset }),
      })
    } catch { /* silent */ }
  }

  const handleSimulateUpload = async () => {
    if (!userId) return
    setUploading(true)
    try {
      const cameras = ['GoPro Hero 12', 'DJI Action 4', 'Insta360 X4', 'Sony Action Cam']
      const camera = cameras[Math.floor(Math.random() * cameras.length)]
      const duration = Math.floor(Math.random() * 1800) + 300
      const fileSize = Math.floor(Math.random() * 3000000000) + 500000000

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          rideId: rideId || undefined,
          fileName: `${camera.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.mp4`,
          fileSize,
          duration,
          gpsTrackOffset: 0,
          metadata: { camera: camera, resolution: '4K', fps: 60, format: 'MP4' },
        }),
      })
      if (res.ok) {
        toast.success('Video naložen! Obdelava v teku...')
        fetchVideos()
        // Simulate processing completion after 3 seconds
        const json = await res.json()
        if (json.data?.id) {
          setTimeout(async () => {
            await fetch(`/api/videos/${json.data.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'ready' }),
            })
            fetchVideos()
          }, 3000)
        }
      }
    } catch {
      toast.error('Napaka pri nalaganju videa')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/${videoId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Video izbrisan')
        if (selectedId === videoId) setSelectedId(null)
        fetchVideos()
      }
    } catch {
      toast.error('Napaka pri brisanju')
    }
  }

  return (
    <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="text-green-400">🎥</span>
            Video Sync
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10"
            onClick={handleSimulateUpload}
            disabled={uploading || !userId}
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            <span className="text-xs ml-1">Naloži</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-3 p-2 rounded-lg bg-zinc-800/40">
                <Skeleton className="w-16 h-10 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-6">
            <Video className="size-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Ni videoposnetkov</p>
            <p className="text-xs text-zinc-600 mt-1">Naložite GoPro/Action Cam posnetke</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {videos.map(video => (
              <button
                key={video.id}
                onClick={() => {
                  setSelectedId(video.id === selectedId ? null : video.id)
                  setGpsOffset(video.gpsTrackOffset)
                  onVideoSelect?.(video.id)
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  video.id === selectedId
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Thumbnail placeholder */}
                  <div className="w-14 h-9 rounded bg-gradient-to-br from-green-900/50 to-zinc-900 flex items-center justify-center flex-shrink-0">
                    {video.status === 'processing' ? (
                      <Loader2 className="size-3.5 text-yellow-400 animate-spin" />
                    ) : video.status === 'ready' ? (
                      <Play className="size-3.5 text-green-400" />
                    ) : (
                      <AlertTriangle className="size-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {video.fileName.length > 25 ? video.fileName.slice(0, 25) + '...' : video.fileName}
                      </span>
                      <StatusBadge status={video.status} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-0.5">
                        <Clock className="size-2.5" />
                        {formatDuration(video.duration)}
                      </span>
                      <span>{formatFileSize(video.fileSize)}</span>
                      {video.metadata && typeof video.metadata === 'object' && (
                        <span className="flex items-center gap-0.5">
                          <Camera className="size-2.5" />
                          {(video.metadata as Record<string, unknown>).camera as string || 'Neznano'}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(video.id) }}
                    className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* GPS Sync Controls */}
        {selectedVideo && (
          <div className="space-y-3 p-3 rounded-lg bg-zinc-800/40 border border-green-500/20">
            <div className="text-xs font-medium text-green-400 flex items-center gap-1.5">
              <SyncIcon className="size-3" />
              GPS Sinhronizacija
            </div>

            {/* Offset slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Zamik GPS</span>
                <span className="text-green-400 font-mono font-medium">
                  {gpsOffset >= 0 ? '+' : ''}{gpsOffset.toFixed(1)}s
                </span>
              </div>
              <Slider
                min={-30}
                max={30}
                step={0.5}
                value={[gpsOffset]}
                onValueChange={([v]) => handleOffsetChange(v)}
                className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-green-500 [&_[data-slot=slider-thumb]]:border-green-500 [&_[data-slot=slider-thumb]]:bg-zinc-900"
              />
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>-30s</span>
                <span>0s</span>
                <span>+30s</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAutoSync}
                size="sm"
                className="flex-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/20"
              >
                <SyncIcon className="size-3 mr-1" />
                Avtosinhronizacija
              </Button>
              <Button
                onClick={() => setShowOverlay(!showOverlay)}
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white"
              >
                {showOverlay ? 'Skrij' : 'Overlay'}
              </Button>
            </div>

            {/* Metadata Overlay Preview */}
            {showOverlay && (
              <div className="p-2.5 rounded bg-black/60 border border-green-500/10 space-y-1.5">
                <div className="text-[10px] text-green-400/70 uppercase tracking-wider font-semibold mb-1.5">
                  Metapodatki Overlay
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-1 text-xs text-zinc-300">
                    <Gauge className="size-3 text-orange-400" />
                    <span>Hitrost</span>
                    <span className="ml-auto font-mono text-orange-400">87 km/h</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-300">
                    <Mountain className="size-3 text-sky-400" />
                    <span>Nadm. viš.</span>
                    <span className="ml-auto font-mono text-sky-400">845m</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-300">
                    <Zap className="size-3 text-amber-400" />
                    <span>Naklon</span>
                    <span className="ml-auto font-mono text-amber-400">23°</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-300">
                    <Clock className="size-3 text-emerald-400" />
                    <span>Čas</span>
                    <span className="ml-auto font-mono text-emerald-400">14:32</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
