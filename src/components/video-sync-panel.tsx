'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
  Sparkles,
  Download,
  Link2,
  Plus,
  ChevronDown,
  ChevronUp,
  Activity,
  Eye,
  X,
  Timer,
} from 'lucide-react'
import { toast } from 'sonner'
import type { VideoFootageData } from '@/components/tabs/types'

interface VideoSyncPanelProps {
  userId?: string
  rideId?: string
  onVideoSelect?: (videoId: string) => void
}

interface HighlightData {
  id: string
  footageId: string
  startTime: number
  endTime: number
  title: string
  type: string // auto, manual
  thumbnailUrl: string | null
  gForce: number | null
  speed: number | null
  leanAngle: number | null
  createdAt: string
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

function highlightTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    high_speed: 'Visoka hitrost',
    sharp_curve: 'Ostra ovinka',
    steep_climb: 'Strm vzpon',
    scenic_view: 'Razgledna točka',
    hard_braking: 'Trdo zaviranje',
    acceleration: 'Pospeševanje',
    g_force: 'Visok G-force',
  }
  return labels[type] || type
}

function highlightTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    high_speed: '💨',
    sharp_curve: '↪️',
    steep_climb: '⛰️',
    scenic_view: '🌄',
    hard_braking: '🛑',
    acceleration: '🚀',
    g_force: '⚡',
  }
  return emojis[type] || '🎬'
}

function highlightTypeColor(type: string): string {
  const colors: Record<string, string> = {
    high_speed: 'border-red-500/30 bg-red-500/10 text-red-300',
    sharp_curve: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    steep_climb: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    scenic_view: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    hard_braking: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    acceleration: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    g_force: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
  }
  return colors[type] || 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
}

export default function VideoSyncPanel({ userId, rideId, onVideoSelect }: VideoSyncPanelProps) {
  const [videos, setVideos] = useState<VideoFootageData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [gpsOffset, setGpsOffset] = useState(0)
  const [showOverlay, setShowOverlay] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Highlights state
  const [highlights, setHighlights] = useState<HighlightData[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)
  const [playingHighlight, setPlayingHighlight] = useState<string | null>(null)
  const [showAddHighlight, setShowAddHighlight] = useState(false)
  const [newHighlightStart, setNewHighlightStart] = useState(0)
  const [newHighlightEnd, setNewHighlightEnd] = useState(30)
  const [newHighlightTitle, setNewHighlightTitle] = useState('')

  // Export overlay state
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportComplete, setExportComplete] = useState(false)

  // Link to ride state
  const [linking, setLinking] = useState(false)

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

  // Fetch highlights when a video is selected
  const fetchHighlights = useCallback(async (videoId: string) => {
    setHighlightsLoading(true)
    try {
      const res = await fetch(`/api/videos/${videoId}/highlights`)
      if (res.ok) {
        const json = await res.json()
        setHighlights(json.data || [])
      }
    } catch {
      toast.error('Napaka pri nalaganju poudarkov')
    } finally {
      setHighlightsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId && showHighlights) {
      fetchHighlights(selectedId)
    }
  }, [selectedId, showHighlights, fetchHighlights])

  const handleAutoSync = async () => {
    if (!selectedVideo) return
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

  // Play highlight (simulated preview)
  const handlePlayHighlight = (highlight: HighlightData) => {
    if (playingHighlight === highlight.id) {
      setPlayingHighlight(null)
      return
    }
    setPlayingHighlight(highlight.id)
    toast.success(`Predvajam: ${highlight.title} (${formatDuration(highlight.startTime)} - ${formatDuration(highlight.endTime)})`)
    // Auto-stop after the clip duration
    setTimeout(() => {
      setPlayingHighlight(prev => prev === highlight.id ? null : prev)
    }, Math.min((highlight.endTime - highlight.startTime) * 100, 5000)) // Simulated, capped at 5s
  }

  // Create manual highlight
  const handleCreateHighlight = async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/videos/${selectedId}/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: newHighlightStart,
          endTime: newHighlightEnd,
          title: newHighlightTitle || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Poudarek ustvarjen!')
        fetchHighlights(selectedId)
        setShowAddHighlight(false)
        setNewHighlightTitle('')
        setNewHighlightStart(0)
        setNewHighlightEnd(30)
      }
    } catch {
      toast.error('Napaka pri ustvarjanju poudarka')
    }
  }

  // Export with overlay
  const handleExportOverlay = async () => {
    if (!selectedVideo) return
    setExporting(true)
    setExportProgress(0)
    setExportComplete(false)
    setShowExportDialog(true)

    try {
      const res = await fetch(`/api/videos/${selectedVideo.id}/export-overlay`, {
        method: 'POST',
      })
      if (res.ok) {
        // Simulate progress
        const totalSteps = 20
        for (let i = 1; i <= totalSteps; i++) {
          await new Promise(r => setTimeout(r, 500))
          setExportProgress(Math.round((i / totalSteps) * 100))
        }
        setExportComplete(true)
        toast.success('Video z overlay izvožen!')
      } else {
        toast.error('Napaka pri izvozu')
      }
    } catch {
      toast.error('Napaka pri izvozu videa')
    } finally {
      setExporting(false)
    }
  }

  // Link video to ride
  const handleLinkToRide = async () => {
    if (!selectedVideo || !rideId) return
    setLinking(true)
    try {
      const res = await fetch(`/api/videos/${selectedVideo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId }),
      })
      if (res.ok) {
        toast.success('Video povezan z vožnjo!')
        fetchVideos()
      }
    } catch {
      toast.error('Napaka pri povezovanju')
    } finally {
      setLinking(false)
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
                      {video.rideId && (
                        <span className="flex items-center gap-0.5 text-green-400">
                          <Link2 className="size-2.5" />
                          Povezano
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

        {/* Video Highlights Section */}
        {selectedVideo && selectedVideo.status === 'ready' && (
          <div className="space-y-2">
            <button
              onClick={() => setShowHighlights(!showHighlights)}
              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                <Sparkles className="size-3.5 text-amber-400" />
                Poudarki videa
                {highlights.length > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20 px-1.5 py-0">
                    {highlights.length}
                  </Badge>
                )}
              </div>
              {showHighlights ? (
                <ChevronUp className="size-3.5 text-zinc-500" />
              ) : (
                <ChevronDown className="size-3.5 text-zinc-500" />
              )}
            </button>

            {showHighlights && (
              <div className="space-y-2 p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
                {highlightsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-2 p-2 rounded bg-zinc-800/40">
                        <Skeleton className="w-8 h-8 rounded" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-2 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : highlights.length === 0 ? (
                  <div className="text-center py-3">
                    <Activity className="size-6 text-zinc-600 mx-auto mb-1" />
                    <p className="text-xs text-zinc-500">Ni še poudarkov</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {highlights.map(h => (
                      <div
                        key={h.id}
                        className={`p-2 rounded-lg border transition-all ${
                          playingHighlight === h.id
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-zinc-800/40 border-zinc-700/30 hover:bg-zinc-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {/* Play button */}
                          <button
                            onClick={() => handlePlayHighlight(h)}
                            className={`p-1.5 rounded-full transition-colors ${
                              playingHighlight === h.id
                                ? 'bg-amber-500 text-zinc-900'
                                : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                            }`}
                          >
                            {playingHighlight === h.id ? (
                              <Pause className="size-3" />
                            ) : (
                              <Play className="size-3" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${highlightTypeColor(h.title.includes('Visoka') ? 'high_speed' : h.title.includes('Ostra') ? 'sharp_curve' : h.title.includes('Strm') ? 'steep_climb' : h.title.includes('Razgled') ? 'scenic_view' : h.title.includes('Trdo') ? 'hard_braking' : h.title.includes('Pospe') ? 'acceleration' : h.title.includes('G-force') ? 'g_force' : 'scenic_view')}`}
                              >
                                {highlightTypeEmoji(h.title.includes('Visoka') ? 'high_speed' : h.title.includes('Ostra') ? 'sharp_curve' : h.title.includes('Strm') ? 'steep_climb' : h.title.includes('Razgled') ? 'scenic_view' : h.title.includes('Trdo') ? 'hard_braking' : h.title.includes('Pospe') ? 'acceleration' : h.title.includes('G-force') ? 'g_force' : 'scenic_view')}
                                <span className="ml-0.5">{h.title}</span>
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ${
                                  h.type === 'auto'
                                    ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
                                    : 'border-sky-500/30 bg-sky-500/10 text-sky-400'
                                }`}
                              >
                                {h.type === 'auto' ? 'Auto' : 'Ročno'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                              <span className="flex items-center gap-0.5">
                                <Timer className="size-2" />
                                {formatDuration(h.startTime)} - {formatDuration(h.endTime)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Telemetry data */}
                        {(h.speed != null || h.gForce != null || h.leanAngle != null) && (
                          <div className="flex gap-3 mt-1.5 ml-9">
                            {h.speed != null && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <Gauge className="size-2.5 text-orange-400" />
                                <span className="text-zinc-400">Hitrost:</span>
                                <span className="text-orange-400 font-mono">{h.speed} km/h</span>
                              </div>
                            )}
                            {h.gForce != null && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <Activity className="size-2.5 text-pink-400" />
                                <span className="text-zinc-400">G-force:</span>
                                <span className="text-pink-400 font-mono">{h.gForce}G</span>
                              </div>
                            )}
                            {h.leanAngle != null && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <Zap className="size-2.5 text-amber-400" />
                                <span className="text-zinc-400">Naklon:</span>
                                <span className="text-amber-400 font-mono">{h.leanAngle}°</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Simulated playing indicator */}
                        {playingHighlight === h.id && (
                          <div className="mt-2 ml-9">
                            <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                                style={{
                                  width: '0%',
                                  animation: 'progress 3s linear forwards',
                                }}
                              />
                            </div>
                            <style>{`
                              @keyframes progress {
                                from { width: 0%; }
                                to { width: 100%; }
                              }
                            `}</style>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add manual highlight button */}
                <Button
                  onClick={() => setShowAddHighlight(true)}
                  variant="ghost"
                  size="sm"
                  className="w-full text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-dashed border-zinc-600 hover:border-amber-500/30"
                >
                  <Plus className="size-3 mr-1" />
                  Dodaj ročni poudarek
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Action buttons: Export & Link to ride */}
        {selectedVideo && selectedVideo.status === 'ready' && (
          <div className="flex gap-2">
            {/* Export with overlay */}
            <Button
              onClick={handleExportOverlay}
              disabled={exporting}
              size="sm"
              className="flex-1 bg-gradient-to-r from-amber-600/80 to-orange-600/80 hover:from-amber-500 hover:to-orange-500 text-white border border-amber-500/20"
            >
              {exporting ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <Download className="size-3.5 mr-1" />
              )}
              Izvozi z overlay
            </Button>

            {/* Link to ride */}
            {rideId && !selectedVideo.rideId && (
              <Button
                onClick={handleLinkToRide}
                disabled={linking}
                variant="ghost"
                size="sm"
                className="text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-sky-500/20"
              >
                {linking ? (
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                ) : (
                  <Link2 className="size-3.5 mr-1" />
                )}
                Poveži z vožnjo
              </Button>
            )}
          </div>
        )}

        {/* Add Manual Highlight Dialog */}
        <Dialog open={showAddHighlight} onOpenChange={setShowAddHighlight}>
          <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Plus className="size-4 text-amber-400" />
                Nov ročni poudarek
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Določite časovni obseg za nov poudarek
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Naslov (opcijsko)</label>
                <Input
                  value={newHighlightTitle}
                  onChange={e => setNewHighlightTitle(e.target.value)}
                  placeholder="npr. Zanimiv odsek"
                  className="bg-zinc-800 border-zinc-600 text-white text-sm placeholder:text-zinc-500"
                />
              </div>

              {/* Start time */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Začetni čas (s)</span>
                  <span className="text-amber-400 font-mono">{newHighlightStart}s</span>
                </div>
                <Slider
                  min={0}
                  max={selectedVideo?.duration || 300}
                  step={1}
                  value={[newHighlightStart]}
                  onValueChange={([v]) => {
                    setNewHighlightStart(v)
                    if (v >= newHighlightEnd) setNewHighlightEnd(Math.min(v + 10, selectedVideo?.duration || 300))
                  }}
                  className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:border-amber-500 [&_[data-slot=slider-thumb]]:bg-zinc-900"
                />
              </div>

              {/* End time */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Končni čas (s)</span>
                  <span className="text-amber-400 font-mono">{newHighlightEnd}s</span>
                </div>
                <Slider
                  min={newHighlightStart + 1}
                  max={selectedVideo?.duration || 300}
                  step={1}
                  value={[newHighlightEnd]}
                  onValueChange={([v]) => setNewHighlightEnd(v)}
                  className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-green-500 [&_[data-slot=slider-thumb]]:border-green-500 [&_[data-slot=slider-thumb]]:bg-zinc-900"
                />
              </div>

              {/* Duration preview */}
              <div className="text-center text-xs text-zinc-400 bg-zinc-800/60 rounded-lg p-2">
                <Eye className="size-3 inline mr-1" />
                Trajanje: {formatDuration(newHighlightEnd - newHighlightStart)}
                {' '}({newHighlightEnd - newHighlightStart}s)
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setShowAddHighlight(false)}
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-zinc-200 flex-1"
                >
                  Prekliči
                </Button>
                <Button
                  onClick={handleCreateHighlight}
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
                >
                  <Plus className="size-3 mr-1" />
                  Ustvari
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Export Progress Dialog */}
        <Dialog open={showExportDialog} onOpenChange={(open) => {
          if (!open && !exporting) setShowExportDialog(false)
        }}>
          <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Download className="size-4 text-amber-400" />
                Izvoz videa z overlay
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {exportComplete
                  ? 'Izvoz dokončan!'
                  : 'Ustvarjam video s hitrost/visina/naklon telemetry overlay...'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Progress */}
              <div className="space-y-2">
                <Progress
                  value={exportProgress}
                  className="h-2 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500"
                />
                <div className="text-center text-xs text-zinc-400">
                  {exportComplete ? '✅ Dokončano' : `${exportProgress}%`}
                </div>
              </div>

              {/* Overlay layers info */}
              <div className="space-y-1.5 bg-zinc-800/40 rounded-lg p-2.5">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">
                  Overlay plasti
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Gauge className="size-3 text-orange-400" />
                  Hitrost (km/h)
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Mountain className="size-3 text-sky-400" />
                  Nadmorska višina
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Zap className="size-3 text-amber-400" />
                  Naklon (°)
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Activity className="size-3 text-pink-400" />
                  G-force
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Eye className="size-3 text-emerald-400" />
                  Razdalja
                </div>
              </div>

              {/* File info */}
              {selectedVideo && (
                <div className="text-xs text-zinc-500 text-center">
                  {selectedVideo.fileName.replace('.mp4', '_overlay.mp4')}
                </div>
              )}

              {exportComplete && (
                <Button
                  onClick={() => setShowExportDialog(false)}
                  size="sm"
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
                >
                  <CheckCircle className="size-3.5 mr-1" />
                  Zapri
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
