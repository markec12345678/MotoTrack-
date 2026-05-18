'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  X, Heart, MessageCircle, Clock, MapPin, Mountain,
  Wind, Thermometer, Droplets, Bike, Route, Gauge,
  Cloud, Sun, CloudRain, CloudSnow, CloudFog, CloudLightning,
  Send, Calendar, Download, Camera, ImageIcon, Trash2,
  GitCompare, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Star, Share2, Hash,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { RideData, RouteData, CommentData, WeatherData, UserData, PhotoData, ComparisonData } from '@/components/tabs/types'
import { formatDuration, formatDate, categoryLabel, categoryColor, difficultyLabel } from '@/components/tabs/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import ElevationProfile from '@/components/tabs/elevation-profile'
import RouteShareDialog from '@/components/route-share-dialog'
import RideReplay3D from '@/components/ride-replay-3d'
import GradientAnalysis from '@/components/gradient-analysis'
import { toast } from 'sonner'

interface DetailDialogProps {
  item: RideData | RouteData
  type: 'ride' | 'route'
  comments: CommentData[]
  newComment: string
  commentsLoading: boolean
  weather: WeatherData | null
  weatherLoading: boolean
  user: UserData | null
  onClose: () => void
  onToggleLike: (routeId: string) => void
  onPostComment: () => void
  onNewCommentChange: (val: string) => void
}

function WeatherIcon({ code, className = 'size-5' }: { code: number; className?: string }) {
  if (code <= 1) return <Sun className={className} />
  if (code <= 3) return <Cloud className={className} />
  if (code <= 48) return <CloudFog className={className} />
  if (code <= 57) return <Droplets className={className} />
  if (code <= 67) return <CloudRain className={className} />
  if (code <= 77) return <CloudSnow className={className} />
  if (code <= 82) return <CloudRain className={className} />
  return <CloudLightning className={className} />
}

// ─── Comparison Panel Component ───────────────────────────────────────────────

interface ComparableRide {
  id: string
  title: string
  date: string
  distance: number
  duration: number
  avgSpeed: number
  maxSpeed: number
  elevation: number
}

interface ComparisonPanelProps {
  currentRide: ComparableRide
  comparisonData: ComparisonData
  expanded: boolean
  onToggleExpand: () => void
}

function TrendIndicator({ current, previous, lowerIsBetter = false }: {
  current: number
  previous: number
  lowerIsBetter?: boolean
}) {
  if (current === previous) {
    return <Minus className="size-3 text-muted-foreground" />
  }
  const improved = lowerIsBetter ? current < previous : current > previous
  return improved
    ? <TrendingUp className="size-3 text-emerald-400" />
    : <TrendingDown className="size-3 text-rose-400" />
}

function ProgressBar({ value, max, isBest }: { value: number; max: number; isBest: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${isBest ? 'bg-emerald-400' : 'bg-primary/60'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ComparisonPanel({ currentRide, comparisonData, expanded, onToggleExpand }: ComparisonPanelProps) {
  const { rides, best } = comparisonData

  // Combine current ride with comparison rides, sorted by date (newest first)
  const allRides = useMemo(() => {
    const current = { ...currentRide, isCurrent: true as const }
    const others = rides.map(r => ({ ...r, isCurrent: false as const }))
    return [current, ...others].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [currentRide, rides])

  // Recharts data for bar chart
  const chartData = useMemo(() => {
    return allRides.map(r => ({
      name: r.title.length > 12 ? r.title.slice(0, 12) + '…' : r.title,
      Razdalja: r.distance,
      'Povp. hitrost': r.avgSpeed,
      'Max hitrost': r.maxSpeed,
      NadmViš: r.elevation,
      isCurrent: r.isCurrent,
    }))
  }, [allRides])

  const metrics: Array<{
    key: keyof ComparableRide
    label: string
    unit: string
    format: (v: number) => string
    lowerIsBetter: boolean
  }> = [
    { key: 'distance', label: 'Razdalja', unit: 'km', format: v => v.toFixed(1), lowerIsBetter: false },
    { key: 'duration', label: 'Trajanje', unit: '', format: v => formatDuration(v), lowerIsBetter: true },
    { key: 'avgSpeed', label: 'Povp. hitrost', unit: 'km/h', format: v => v.toFixed(1), lowerIsBetter: false },
    { key: 'maxSpeed', label: 'Max hitrost', unit: 'km/h', format: v => v.toFixed(1), lowerIsBetter: false },
    { key: 'elevation', label: 'Nadm. višina', unit: 'm', format: v => v.toFixed(0), lowerIsBetter: false },
  ]

  const getBestValue = (key: keyof ComparableRide): number => {
    if (key === 'distance') return best.distance
    if (key === 'duration') return best.duration
    if (key === 'avgSpeed') return best.avgSpeed
    if (key === 'maxSpeed') return best.maxSpeed
    if (key === 'elevation') return best.elevation
    return 0
  }

  const isBestForMetric = (ride: ComparableRide & { isCurrent: boolean }, key: keyof ComparableRide): boolean => {
    const bestVal = getBestValue(key)
    const metric = metrics.find(m => m.key === key)
    if (!metric) return false
    const rideVal = ride[key]
    if (typeof rideVal !== 'number') return false
    return metric.lowerIsBetter ? rideVal <= bestVal : rideVal >= bestVal
  }

  const getMaxForMetric = (key: keyof ComparableRide): number => {
    const vals = allRides.map(r => r[key] as number).filter(v => v > 0)
    return vals.length > 0 ? Math.max(...vals) : 1
  }

  return (
    <div className="space-y-3">
      {/* Expand/collapse toggle */}
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={onToggleExpand}
      >
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {expanded ? 'Skrči primerjavo' : 'Razširi primerjavo'}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{allRides.length} voženj</Badge>
      </button>

      {expanded && (
        <>
          {/* Bar chart */}
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">
              Primerjava po merilih
            </p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Bar dataKey="Razdalja" radius={[3, 3, 0, 0]} maxBarSize={28}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.isCurrent ? '#f59e0b' : '#64748b'}
                        opacity={entry.isCurrent ? 1 : 0.6}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="size-2 rounded-sm bg-amber-500" /> Trenutna vožnja
              </span>
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="size-2 rounded-sm bg-slate-500" /> Prejšnje vožnje
              </span>
            </div>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground">Vožnja</th>
                  {metrics.map(m => (
                    <th key={m.key} className="text-right py-1.5 px-1.5 font-medium text-muted-foreground whitespace-nowrap">
                      {m.label}
                    </th>
                  ))}
                  <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">Trend</th>
                </tr>
              </thead>
              <tbody>
                {allRides.map((ride, idx) => {
                  // Find the previous ride (older by date) for trend comparison
                  const prevRide = idx < allRides.length - 1 ? allRides[idx + 1] : null
                  return (
                    <tr
                      key={ride.id}
                      className={`border-b border-border/10 ${ride.isCurrent ? 'bg-amber-500/5' : ''}`}
                    >
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          {ride.isCurrent && (
                            <Badge className="text-[8px] px-1 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                              Sedaj
                            </Badge>
                          )}
                          <span className={`truncate max-w-[80px] ${ride.isCurrent ? 'font-medium' : 'text-muted-foreground'}`}>
                            {ride.title}
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">{formatDate(ride.date)}</span>
                      </td>
                      {metrics.map(m => {
                        const val = ride[m.key] as number
                        const isBest = isBestForMetric(ride, m.key)
                        const maxVal = getMaxForMetric(m.key)
                        return (
                          <td key={m.key} className="py-1.5 px-1.5 text-right">
                            <span className={isBest ? 'text-emerald-400 font-medium' : ''}>
                              {m.format(val)}{m.unit ? ` ${m.unit}` : ''}
                            </span>
                            <ProgressBar value={val} max={maxVal} isBest={isBest} />
                          </td>
                        )
                      })}
                      <td className="py-1.5 px-1 text-center">
                        {prevRide ? (
                          <div className="flex items-center justify-center gap-0.5">
                            {metrics.slice(0, 3).map(m => (
                              <TrendIndicator
                                key={m.key}
                                current={ride[m.key] as number}
                                previous={prevRide[m.key] as number}
                                lowerIsBetter={m.lowerIsBetter}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-[9px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Best values summary */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Najboljše:</span>
            <Badge variant="outline" className="text-[9px] gap-1 border-emerald-500/30 text-emerald-400">
              🏁 {best.distance.toFixed(1)} km
            </Badge>
            <Badge variant="outline" className="text-[9px] gap-1 border-emerald-500/30 text-emerald-400">
              ⏱️ {formatDuration(best.duration)}
            </Badge>
            <Badge variant="outline" className="text-[9px] gap-1 border-emerald-500/30 text-emerald-400">
              🚀 {best.avgSpeed.toFixed(1)} km/h
            </Badge>
            <Badge variant="outline" className="text-[9px] gap-1 border-emerald-500/30 text-emerald-400">
              💨 {best.maxSpeed.toFixed(1)} km/h
            </Badge>
            <Badge variant="outline" className="text-[9px] gap-1 border-emerald-500/30 text-emerald-400">
              ⛰️ {best.elevation.toFixed(0)} m
            </Badge>
          </div>
        </>
      )}
    </div>
  )
}

// ─── End Comparison Panel ─────────────────────────────────────────────────────

function isRideData(item: RideData | RouteData): item is RideData {
  return 'trackData' in item && 'duration' in item
}

export default function DetailDialog({
  item, type, comments, newComment, commentsLoading,
  weather, weatherLoading, user, onClose, onToggleLike,
  onPostComment, onNewCommentChange,
}: DetailDialogProps) {
  const isRide = isRideData(item)
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewPhoto, setViewPhoto] = useState<PhotoData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Comparison state
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonExpanded, setComparisonExpanded] = useState(true)

  // Favorite state
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [showRouteShare, setShowRouteShare] = useState(false)

  // Check if item is favorited
  useEffect(() => {
    if (!user) { setIsFavorite(false); return }
    const type = isRide ? 'ride' : 'route'
    fetch(`/api/favorites?userId=${user.id}&type=${type}`)
      .then(r => r.json())
      .then(j => {
        const favs: Array<{ rideId: string | null; routeId: string | null }> = j.data || []
        const isFav = isRide
          ? favs.some(f => f.rideId === item.id)
          : favs.some(f => f.routeId === item.id)
        setIsFavorite(isFav)
      })
      .catch(() => setIsFavorite(false))
  }, [user, item.id, isRide])

  // Fetch photos for this ride/route
  useEffect(() => {
    setPhotosLoading(true)
    const param = isRide ? `rideId=${item.id}` : `routeId=${item.id}`
    fetch(`/api/photos?${param}`)
      .then(r => r.json())
      .then(j => { setPhotos(j.data || []); setPhotosLoading(false) })
      .catch(() => setPhotosLoading(false))
  }, [item.id, isRide])

  // Upload photo
  const handleUpload = useCallback(async (file: File) => {
    if (!user) { toast.error('Prijava je obvezna'); return }

    // Check file size (~365KB actual = ~500KB base64)
    if (file.size > 400 * 1024) {
      toast.error('Slika je prevelika. Največja velikost je 400KB.')
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const body: Record<string, string> = {
        url: dataUrl,
        userId: user.id,
      }
      if (isRide) body.rideId = item.id
      else body.routeId = item.id

      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const j = await res.json()
        setPhotos(prev => [j.data, ...prev])
        toast.success('Foto dodano!')
      } else {
        const j = await res.json()
        toast.error(j.error || 'Napaka pri nalaganju')
      }
    } catch {
      toast.error('Napaka pri nalaganju slike')
    } finally {
      setUploading(false)
    }
  }, [user, item.id, isRide])

  // Delete photo
  const handleDeletePhoto = useCallback(async (photoId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/photos/${photoId}?userId=${user.id}`, { method: 'DELETE' })
      if (res.ok) {
        setPhotos(prev => prev.filter(p => p.id !== photoId))
        toast.success('Foto izbrisano')
      } else {
        toast.error('Napaka pri brisanju')
      }
    } catch {
      toast.error('Napaka pri brisanju')
    }
  }, [user])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }, [handleUpload])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{item.title}</DialogTitle>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-card to-card p-4 pb-3">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 size-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-muted transition-colors z-10"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
              isRide ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {isRide ? <Bike className="size-5" /> : <Route className="size-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg leading-tight truncate">{item.title}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isRide ? (
                  <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                    Vožnja
                  </Badge>
                ) : (
                  <>
                    <Badge variant="outline" className={`${categoryColor((item as RouteData).category)} text-[10px]`}>
                      {categoryLabel((item as RouteData).category)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {difficultyLabel((item as RouteData).difficulty)}
                    </Badge>
                  </>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3" />
                  {item.user?.name || 'Neznan'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Route className="size-3.5" />
              <span className="font-medium text-foreground">{item.distance} km</span>
            </span>
            {isRide && (
              <>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span className="font-medium text-foreground">{formatDuration((item as RideData).duration)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="size-3.5" />
                  <span className="font-medium text-foreground">{(item as RideData).avgSpeed} km/h</span>
                </span>
              </>
            )}
            {!isRide && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Heart className="size-3.5" />
                <span className="font-medium text-foreground">{(item as RouteData).likes}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Mountain className="size-3.5" />
              <span className="font-medium text-foreground">{'elevation' in item ? (item as RideData).elevation : 0} m</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
              <Calendar className="size-3" />
              <span className="text-xs">{formatDate(item.createdAt)}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              asChild
            >
              <a href={`/api/gpx/export?${isRide ? 'rideId' : 'routeId'}=${item.id}`} download>
              <Download className="size-3" />
              GPX
              </a>
            </Button>
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 gap-1 text-xs ${isFavorite ? 'text-amber-400 hover:text-amber-300' : 'text-muted-foreground hover:text-amber-400'}`}
                disabled={favoriteLoading}
                onClick={async () => {
                  setFavoriteLoading(true)
                  try {
                    if (isFavorite) {
                      const body: Record<string, string> = { userId: user.id }
                      if (isRide) body.rideId = item.id; else body.routeId = item.id
                      await fetch('/api/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                      setIsFavorite(false)
                      toast.success('Odstranjeno iz priljubljenih')
                    } else {
                      const body: Record<string, string> = { userId: user.id }
                      if (isRide) body.rideId = item.id; else body.routeId = item.id
                      await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                      setIsFavorite(true)
                      toast.success('Dodano med priljubljene ★')
                    }
                  } catch { toast.error('Napaka') }
                  setFavoriteLoading(false)
                }}
              >
                <Star className={`size-3 ${isFavorite ? 'fill-current' : ''}`} />
                {isFavorite ? 'Priljubljena' : 'Priljubi'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={async () => {
                try {
                  const type = isRide ? 'ride' : 'route'
                  const res = await fetch('/api/share', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, id: item.id, userId: user?.id, platform: 'clipboard' }),
                  })
                  if (res.ok) {
                    const j = await res.json()
                    await navigator.clipboard.writeText(j.shareUrl)
                    toast.success('Povezava kopirana!')
                  }
                } catch {
                  // Fallback: just copy a simple share text
                  try {
                    await navigator.clipboard.writeText(`${item.title} — ${item.distance} km`)
                    toast.success('Kopirano!')
                  } catch { toast.error('Napaka pri deljenju') }
                }
              }}
            >
              <Share2 className="size-3" />
              Deli
            </Button>
            {/* Route share code button - only for routes */}
            {!isRide && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-primary hover:text-primary/80"
                onClick={() => setShowRouteShare(true)}
              >
                <Hash className="size-3" />
                Koda
              </Button>
            )}
          </div>

          {/* Like button for routes */}
          {!isRide && user && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className={`gap-1.5 ${
                  (item as RouteData).userLiked
                    ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                    : 'hover:bg-red-500/10 hover:text-red-400'
                }`}
                onClick={() => onToggleLike(item.id)}
              >
                <Heart className={`size-3.5 ${(item as RouteData).userLiked ? 'fill-current' : ''}`} />
                {(item as RouteData).userLiked ? 'Všeč mi je' : 'Všečkanje'}
                <span className="text-xs ml-1">({(item as RouteData).likes})</span>
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        {item.description && (
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </div>
        )}

        {/* Photo Gallery section */}
        <div className="px-4 py-3 border-b border-border/30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="size-3.5" /> Foto galerija
              {photos.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                  {photos.length}
                </Badge>
              )}
            </h3>
            {user && (
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
                  <Camera className="size-3.5" />
                )}
                Dodaj foto
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          {photosLoading ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="size-20 rounded-lg shrink-0" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-muted-foreground">
              <ImageIcon className="size-8 mb-2 opacity-40" />
              <p className="text-xs">Ni fotografij. Dodajte prvo!</p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map(photo => (
                <div
                  key={photo.id}
                  className="relative group shrink-0 size-20 rounded-lg overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setViewPhoto(photo)}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Fotografija'}
                    className="size-full object-cover"
                  />
                  {/* Delete button for owner */}
                  {user && user.id === photo.userId && (
                    <button
                      className="absolute top-0.5 right-0.5 size-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                  {/* Caption indicator */}
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                      <p className="text-[8px] text-white truncate">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weather section */}
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Cloud className="size-3.5" /> Vreme na lokaciji
          </h3>
          {weatherLoading ? (
            <div className="flex gap-3">
              <Skeleton className="h-12 w-24 rounded-lg" />
              <Skeleton className="h-12 w-24 rounded-lg" />
              <Skeleton className="h-12 w-24 rounded-lg" />
            </div>
          ) : weather?.current ? (
            <div>
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <WeatherIcon code={weather.current.weathercode} className="size-6 text-primary" />
                  <span className="text-lg font-bold">{weather.current.temperature}°C</span>
                </div>
                <span className="text-sm text-muted-foreground">{weather.current.description}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wind className="size-3" />
                  {weather.current.windspeed} km/h
                </span>
              </div>
              {weather.forecast.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {weather.forecast.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5 text-xs shrink-0">
                      <WeatherIcon code={i === 0 ? weather.current!.weathercode : 1} className="size-3.5" />
                      <span className="text-muted-foreground">{new Date(f.date).toLocaleDateString('sl-SI', { weekday: 'short' })}</span>
                      <span className="font-medium">{f.tempMax}°/{f.tempMin}°</span>
                      {f.precipitation > 0 && (
                        <span className="flex items-center gap-0.5 text-sky-400">
                          <Droplets className="size-3" />{f.precipitation}mm
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Vreme ni na voljo</p>
          )}
        </div>

        {/* Ride-specific stats */}
        {isRide && (
          <div className="px-4 py-3 border-b border-border/30 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <Gauge className="size-4 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold">{(item as RideData).maxSpeed}</p>
                <p className="text-[10px] text-muted-foreground">Max km/h</p>
              </div>
              <div className="text-center">
                <Wind className="size-4 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold">{(item as RideData).avgSpeed}</p>
                <p className="text-[10px] text-muted-foreground">Povp. km/h</p>
              </div>
              <div className="text-center">
                <Mountain className="size-4 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold">{(item as RideData).elevation}</p>
                <p className="text-[10px] text-muted-foreground">Nadm. viš.</p>
              </div>
              <div className="text-center">
                <Clock className="size-4 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold">{formatDuration((item as RideData).duration)}</p>
                <p className="text-[10px] text-muted-foreground">Čas</p>
              </div>
            </div>
            {/* Elevation Profile */}
            <ElevationProfile trackData={(item as RideData).trackData} />

            {/* Gradient Analysis */}
            {(item as RideData).trackData && (() => {
              try {
                const parsed = typeof (item as RideData).trackData === 'string'
                  ? JSON.parse((item as RideData).trackData)
                  : (item as RideData).trackData
                const gradientPoints = parsed.map((p: number[]) => ({
                  lat: p[0], lng: p[1], alt: p[2] ?? null
                }))
                return gradientPoints.length >= 2 ? <GradientAnalysis points={gradientPoints} /> : null
              } catch { return null }
            })()}

            {/* 3D Ride Replay */}
            {isRide && (item as RideData).trackData && (() => {
              try {
                const parsed = typeof (item as RideData).trackData === 'string'
                  ? JSON.parse((item as RideData).trackData)
                  : (item as RideData).trackData
                const trackPoints: import('@/components/tabs/types').TrackPoint[] = parsed.map((p: number[]) => ({
                  lat: p[0], lng: p[1], alt: p[2] ?? null, timestamp: p[3] ?? Date.now()
                }))
                return trackPoints.length >= 2 ? <RideReplay3D trackData={trackPoints} title="Rewind - Predvajaj vožnjo" /> : null
              } catch { return null }
            })()}
          </div>
        )}

        {/* Route elevation profile (from routeData) */}
        {!isRide && (item as RouteData).routeData && (
          <div className="px-4 py-3 border-b border-border/30">
            <ElevationProfile trackData={(item as RouteData).routeData!} />
          </div>
        )}

        {/* Comparison section - only for rides */}
        {isRide && (
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <GitCompare className="size-3.5" /> Primerjaj
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={comparisonLoading}
                onClick={async () => {
                  if (showComparison) {
                    setShowComparison(false)
                    return
                  }
                  if (!item.userId) {
                    toast.error('Ni mogoče primerjati — manjka uporabnik')
                    return
                  }
                  setComparisonLoading(true)
                  try {
                    const params = new URLSearchParams({ userId: item.userId, rideId: item.id })
                    const res = await fetch(`/api/compare?${params}`)
                    const j = await res.json()
                    if (j.success && j.data) {
                      setComparisonData(j.data)
                      setShowComparison(true)
                    } else {
                      toast.error(j.error || 'Ni podatkov za primerjavo')
                    }
                  } catch {
                    toast.error('Napaka pri pridobivanju podatkov')
                  } finally {
                    setComparisonLoading(false)
                  }
                }}
              >
                {comparisonLoading ? (
                  <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <GitCompare className="size-3.5" />
                )}
                {showComparison ? 'Skrij' : 'Primerjaj vožnje'}
              </Button>
            </div>

            {showComparison && comparisonData && (
              <ComparisonPanel
                currentRide={{
                  id: item.id,
                  title: item.title,
                  date: item.createdAt,
                  distance: item.distance,
                  duration: (item as RideData).duration,
                  avgSpeed: (item as RideData).avgSpeed,
                  maxSpeed: (item as RideData).maxSpeed,
                  elevation: item.elevation,
                }}
                comparisonData={comparisonData}
                expanded={comparisonExpanded}
                onToggleExpand={() => setComparisonExpanded(!comparisonExpanded)}
              />
            )}

            {showComparison && !comparisonData && (
              <div className="flex flex-col items-center py-4 text-muted-foreground">
                <GitCompare className="size-8 mb-2 opacity-40" />
                <p className="text-xs">Ni voženj za primerjavo</p>
              </div>
            )}
          </div>
        )}

        {/* Comments section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-border/30">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageCircle className="size-3.5" /> Komentarji ({comments.length})
            </h3>
          </div>

          <ScrollArea className="flex-1 max-h-[30vh]">
            <div className="px-4 py-2 space-y-3">
              {commentsLoading ? (
                <>
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Ni komentarjev. Bodite prvi!</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="flex gap-2.5">
                    <Avatar className="size-7 shrink-0 mt-0.5">
                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                        {comment.user?.name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{comment.user?.name || 'Neznan'}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 break-words">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Comment input */}
          {user && (
            <div className="px-4 py-3 border-t border-border/30">
              <div className="flex gap-2">
                <Input
                  placeholder="Napišite komentar..."
                  value={newComment}
                  onChange={(e) => onNewCommentChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      onPostComment()
                    }
                  }}
                  className="text-sm"
                />
                <Button
                  size="icon"
                  onClick={onPostComment}
                  disabled={!newComment.trim()}
                  className="shrink-0"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Full-size photo overlay */}
      {viewPhoto && (
        <Dialog open onOpenChange={(open) => { if (!open) setViewPhoto(null) }}>
          <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden bg-black/95 border-border/20">
            <DialogTitle className="sr-only">{viewPhoto.caption || 'Fotografija'}</DialogTitle>
            <div className="relative">
              <button
                onClick={() => setViewPhoto(null)}
                className="absolute top-2 right-2 z-10 size-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
              <img
                src={viewPhoto.url}
                alt={viewPhoto.caption || 'Fotografija'}
                className="w-full max-h-[70vh] object-contain"
              />
              {viewPhoto.caption && (
                <div className="px-4 py-3 bg-black/60">
                  <p className="text-sm text-white">{viewPhoto.caption}</p>
                </div>
              )}
              <div className="px-4 py-2 bg-black/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                      {viewPhoto.user?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-white/80">{viewPhoto.user?.name || 'Neznan'}</span>
                  <span className="text-[10px] text-white/50">{formatDate(viewPhoto.createdAt)}</span>
                </div>
                {user && user.id === viewPhoto.userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => { handleDeletePhoto(viewPhoto.id); setViewPhoto(null) }}
                  >
                    <Trash2 className="size-3" /> Izbriši
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Route Share Dialog */}
      {!isRide && (
        <RouteShareDialog
          open={showRouteShare}
          onClose={() => setShowRouteShare(false)}
          routeId={item.id}
          routeTitle={item.title}
        />
      )}
    </Dialog>
  )
}
