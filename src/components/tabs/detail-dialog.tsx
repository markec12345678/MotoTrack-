'use client'

import React from 'react'
import {
  X, Heart, MessageCircle, Clock, MapPin, Mountain,
  Wind, Thermometer, Droplets, Bike, Route, Gauge,
  Cloud, Sun, CloudRain, CloudSnow, CloudFog, CloudLightning,
  Send, Calendar,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { RideData, RouteData, CommentData, WeatherData, UserData } from '@/components/tabs/types'
import { formatDuration, formatDate, categoryLabel, categoryColor, difficultyLabel } from '@/components/tabs/types'
import ElevationProfile from '@/components/tabs/elevation-profile'

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

function isRideData(item: RideData | RouteData): item is RideData {
  return 'trackData' in item && 'duration' in item
}

export default function DetailDialog({
  item, type, comments, newComment, commentsLoading,
  weather, weatherLoading, user, onClose, onToggleLike,
  onPostComment, onNewCommentChange,
}: DetailDialogProps) {
  const isRide = isRideData(item)

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
              <span className="font-medium text-foreground">{item.elevation} m</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
              <Calendar className="size-3" />
              <span className="text-xs">{formatDate(item.createdAt)}</span>
            </span>
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
                      <WeatherIcon code={i === 0 ? weather.current.weathercode : 1} className="size-3.5" />
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
          </div>
        )}

        {/* Route elevation profile (from routeData) */}
        {!isRide && (item as RouteData).routeData && (
          <div className="px-4 py-3 border-b border-border/30">
            <ElevationProfile trackData={(item as RouteData).routeData!} />
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
    </Dialog>
  )
}
