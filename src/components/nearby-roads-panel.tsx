'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { MapPin, Star, Navigation, SortAsc } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { BalkanMotoRoad } from '@/components/tabs/types'

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-500/20 text-green-400 border-green-500/30',
  moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  challenging: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  extreme: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const difficultyLabels: Record<string, string> = {
  easy: 'Lahko', moderate: 'Zmerno', challenging: 'Zahtevno', extreme: 'Ekstremno',
}

const roadTypeLabels: Record<string, string> = {
  asphalt: '🛣️ Asfalt', mixed: '🔀 Mešano', gravel: '🪨 Makadam',
}

const countryFlags: Record<string, string> = {
  SI: '🇸🇮', HR: '🇭🇷', BA: '🇧🇦', ME: '🇲🇪', RS: '🇷🇸', MK: '🇲🇰',
  AL: '🇦🇱', GR: '🇬🇷', BG: '🇧🇬', RO: '🇷🇴', HU: '🇭🇺', AT: '🇦🇹',
}

interface NearbyRoadsPanelProps {
  userLat?: number
  userLng?: number
  onSelectRoad?: (road: BalkanMotoRoad & { distance?: number }) => void
  filterCountry?: string
  filterDifficulty?: string
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function NearbyRoadsPanel({ userLat, userLng, onSelectRoad, filterCountry, filterDifficulty }: NearbyRoadsPanelProps) {
  const [roads, setRoads] = useState<(BalkanMotoRoad & { distance?: number })[]>([])
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'difficulty'>('distance')

  const fetchRoads = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterCountry) params.set('country', filterCountry)
    if (filterDifficulty) params.set('difficulty', filterDifficulty)

    fetch(`/api/balkan-roads?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        let data: (BalkanMotoRoad & { distance?: number })[] = j?.data || []

        // Calculate distances if user location available
        if (userLat && userLng) {
          data = data.map(r => ({
            ...r,
            distance: haversine(userLat, userLng, r.lat, r.lng),
          }))
        }

        setRoads(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userLat, userLng, filterCountry, filterDifficulty])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRoads() }, [fetchRoads])

  const sortedRoads = useMemo(() => {
    const sorted = [...roads]
    switch (sortBy) {
      case 'distance':
        sorted.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999))
        break
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating)
        break
      case 'difficulty':
        const diffOrder = { extreme: 0, challenging: 1, moderate: 2, easy: 3 }
        sorted.sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty])
        break
    }
    return sorted
  }, [roads, sortBy])

  const renderStars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)

  const formatDistance = (km: number | undefined) => {
    if (km === undefined) return ''
    if (km < 1) return `${(km * 1000).toFixed(0)} m`
    return `${km.toFixed(0)} km`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Navigation className="size-3.5 text-primary" /> Bližnje motoristične ceste
        </h4>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={fetchRoads}>
            <SortAsc className="size-3" /> Osveži
          </Button>
        </div>
      </div>

      {/* Sort buttons */}
      <div className="flex gap-1.5">
        {[
          { key: 'distance' as const, label: '📏 Razdalja' },
          { key: 'rating' as const, label: '⭐ Ocena' },
          { key: 'difficulty' as const, label: '🔥 Težavnost' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setSortBy(s.key)}
            className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors ${
              sortBy === s.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* No location warning */}
      {!userLat && !userLng && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
          <p className="text-[10px] text-amber-400">📍 Vključite lokacijo za razvrščanje po razdalji</p>
        </div>
      )}

      {/* Roads list */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}</div>
      ) : sortedRoads.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-4">Ni najdenih cest</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
          {sortedRoads.slice(0, 20).map(road => (
            <button
              key={road.id}
              className="w-full text-left rounded-lg border border-border/30 p-2 hover:border-primary/30 transition-all group"
              onClick={() => onSelectRoad?.(road)}
            >
              <div className="flex items-start gap-2">
                <div className="size-7 rounded-lg bg-primary/15 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  {countryFlags[road.country] || '🗺️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-xs truncate group-hover:text-primary transition-colors">{road.name}</p>
                    {road.distance !== undefined && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 bg-primary/10 text-primary border-primary/20 shrink-0">
                        {formatDistance(road.distance)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{road.description}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className={`text-[8px] px-1 py-0 ${difficultyColors[road.difficulty]}`}>
                      {difficultyLabels[road.difficulty]}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">{roadTypeLabels[road.roadType]}</span>
                    <span className="text-[9px] text-muted-foreground">{road.lengthKm} km</span>
                    <span className="text-[9px] text-amber-400">{renderStars(road.rating)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground text-center">
        {sortedRoads.length} cest {userLat ? '· Razvrščeno po razdalji' : ''}
      </p>
    </div>
  )
}
