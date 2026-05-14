'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { MapPin, Star, Filter } from 'lucide-react'
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

const countryNames: Record<string, string> = {
  SI: '🇸🇮', HR: '🇭🇷', BA: '🇧🇦', ME: '🇲🇪', RS: '🇷🇸', MK: '🇲🇰',
  AL: '🇦🇱', GR: '🇬🇷', BG: '🇧🇬', RO: '🇷🇴', HU: '🇭🇺', AT: '🇦🇹',
}

interface BalkanRoadsPanelProps {
  onSelectRoad?: (road: BalkanMotoRoad) => void
}

export default function BalkanRoadsPanel({ onSelectRoad }: BalkanRoadsPanelProps) {
  const [roads, setRoads] = useState<BalkanMotoRoad[]>([])
  const [loading, setLoading] = useState(false)
  const [filterCountry, setFilterCountry] = useState<string>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all')

  const fetchRoads = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/balkan-roads?'
      if (filterCountry !== 'all') url += `country=${filterCountry}&`
      if (filterDifficulty !== 'all') url += `difficulty=${filterDifficulty}&`
      const res = await fetch(url)
      if (res.ok) {
        const j = await res.json()
        setRoads(j.data || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [filterCountry, filterDifficulty])

  useEffect(() => { fetchRoads() }, [fetchRoads])

  const renderStars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <MapPin className="size-3.5 text-primary" /> Motoristične ceste Balkana
        </h4>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={fetchRoads}>
          <Filter className="size-3" /> Osveži
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          className="text-[10px] rounded-md border border-border/50 bg-secondary/50 px-1.5 py-0.5 flex-1"
          value={filterCountry}
          onChange={e => setFilterCountry(e.target.value)}
        >
          <option value="all">Vse države</option>
          {Object.entries(countryNames).map(([code, flag]) => <option key={code} value={code}>{flag} {code}</option>)}
        </select>
        <select
          className="text-[10px] rounded-md border border-border/50 bg-secondary/50 px-1.5 py-0.5 flex-1"
          value={filterDifficulty}
          onChange={e => setFilterDifficulty(e.target.value)}
        >
          <option value="all">Vse težavnosti</option>
          {Object.entries(difficultyLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Roads list */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}</div>
      ) : roads.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-4">Ni najdenih cest</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
          {roads.map(road => (
            <button
              key={road.id}
              className="w-full text-left rounded-lg border border-border/30 p-2 hover:border-primary/30 transition-all group"
              onClick={() => onSelectRoad?.(road)}
            >
              <div className="flex items-start gap-2">
                <div className="size-7 rounded-lg bg-primary/15 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  {countryNames[road.country] || '🗺️'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate group-hover:text-primary transition-colors">{road.name}</p>
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
        {roads.length} cest · Kliknite za prikaz na zemljevidu
      </p>
    </div>
  )
}
