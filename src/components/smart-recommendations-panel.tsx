'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RefreshCw,
  MapPin,
  Cloud,
  TrendingUp,
  Navigation,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import type { RouteRecommendation, RouteData } from '@/components/tabs/types'
import { categoryLabel, categoryColor } from '@/components/tabs/types'

interface SmartRecommendationsPanelProps {
  userId?: string
  userLat?: number
  userLng?: number
  onOpenDetail?: (route: RouteData) => void
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : score >= 40 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <Badge variant="outline" className={`${color} text-xs font-medium`}>
      {label}: {score}%
    </Badge>
  )
}

export default function SmartRecommendationsPanel({
  userId, userLat, userLng, onOpenDetail
}: SmartRecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<RouteRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [radius, setRadius] = useState(100)
  const [lat, setLat] = useState(userLat ?? 46.15)
  const [lng, setLng] = useState(userLng ?? 14.99)

  useEffect(() => {
    if (userLat) setLat(userLat)
    if (userLng) setLng(userLng)
  }, [userLat, userLng])

  const fetchRecommendations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius: radius.toString(),
      })
      if (userId) params.set('userId', userId)

      const res = await fetch(`/api/route-recommendations?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setRecommendations(json.data || [])
      }
    } catch {
      toast.error('Napaka pri nalaganju priporočil')
    } finally {
      setLoading(false)
    }
  }, [lat, lng, radius, userId])

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolokacija ni na voljo')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 100) / 100)
        setLng(Math.round(pos.coords.longitude * 100) / 100)
        toast.success('Lokacija zaznana')
      },
      () => toast.error('Napaka pri zaznavanju lokacije'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  return (
    <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="text-orange-400">🧠</span>
            Pametna Priporočila
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-400 hover:text-white"
              onClick={detectLocation}
            >
              <Navigation className="size-3.5 mr-1" />
              <span className="text-xs">Zaznaj</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-400 hover:text-white"
              onClick={fetchRecommendations}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {/* Radius selector */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-zinc-500">Polmer:</span>
          {[50, 100, 200].map(r => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`px-2 py-0.5 rounded text-xs transition-all ${
                radius === r
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Location indicator */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <MapPin className="size-3" />
          <span>{lat.toFixed(2)}, {lng.toFixed(2)}</span>
        </div>

        {loading ? (
          // Loading skeletons
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8">
            <Cloud className="size-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Ni priporočil za izbrano območje</p>
            <p className="text-xs text-zinc-600 mt-1">Poskusite povečati polmer iskanja</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar">
            {recommendations.map((rec, idx) => (
              <button
                key={rec.routeId}
                onClick={() => onOpenDetail?.(rec.route)}
                className="w-full text-left p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/50 hover:bg-zinc-800/70 hover:border-orange-500/20 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-orange-400">#{idx + 1}</span>
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {rec.route.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`${categoryColor(rec.route.category)} text-[10px] px-1.5 py-0`}
                      >
                        {categoryLabel(rec.route.category)}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {rec.route.distance.toFixed(0)} km
                      </span>
                      {rec.distance > 0 && (
                        <span className="text-xs text-zinc-600">
                          · {rec.distance.toFixed(0)} km stran
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-zinc-600 group-hover:text-orange-400 transition-colors flex-shrink-0 mt-1" />
                </div>

                {/* Score badges */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <ScoreBadge score={rec.combinedScore} label="Skupaj" />
                  {rec.weatherCompatibility > 0 && (
                    <ScoreBadge score={rec.weatherCompatibility} label="Vreme" />
                  )}
                  {rec.roiScore && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-300 border-orange-500/20 text-[10px] px-1.5 py-0">
                      <TrendingUp className="size-2.5 mr-0.5" />
                      ROI {rec.roiScore.overallRoi}
                    </Badge>
                  )}
                </div>

                {/* Weather at route */}
                {rec.weatherAtRoute && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500">
                    <Cloud className="size-3" />
                    <span>{rec.weatherAtRoute.description}</span>
                    <span>· {rec.weatherAtRoute.temperature}°C</span>
                    {rec.weatherAtRoute.isWindDangerous && (
                      <span className="text-red-400 font-medium">⚠️ Veter</span>
                    )}
                  </div>
                )}

                {/* Reason */}
                {rec.reason && (
                  <p className="text-[10px] text-zinc-600 mt-1.5 italic truncate">
                    💡 {rec.reason}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
