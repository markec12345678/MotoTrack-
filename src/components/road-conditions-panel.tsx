'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Plus, ThumbsUp, ThumbsDown, Clock, Filter, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface RoadCondition {
  id: string
  lat: number
  lng: number
  type: string
  description: string
  userId: string
  userName: string
  upvotes: number
  downvotes: number
  createdAt: string
  expiresAt: string
  distance?: number
  typeLabel: string
  typeEmoji: string
  typeColor: string
}

const CONDITION_TYPES: Record<string, { label: string; emoji: string }> = {
  wet: { label: 'Mokra cesta', emoji: '💧' },
  ice: { label: 'Poledica', emoji: '🧊' },
  construction: { label: 'Gradbišče', emoji: '🚧' },
  gravel: { label: 'Gramoz', emoji: '🪨' },
  closed: { label: 'Zaprta cesta', emoji: '🚫' },
  pothole: { label: 'Vozelj', emoji: '🕳️' },
  accident: { label: 'Nesreča', emoji: '⚠️' },
  police: { label: 'Policijska kontrola', emoji: '👮' },
}

interface RoadConditionsPanelProps {
  lat?: number
  lng?: number
  userId?: string
  userName?: string
}

export default function RoadConditionsPanel({ lat, lng, userId, userName }: RoadConditionsPanelProps) {
  const [conditions, setConditions] = useState<RoadCondition[]>([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newType, setNewType] = useState('wet')
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchConditions = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (lat && lng) { params.set('lat', String(lat)); params.set('lng', String(lng)); params.set('radius', '200') }
    if (filterType !== 'all') params.set('type', filterType)
    params.set('limit', '50')

    fetch(`/api/road-conditions?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { setConditions(j?.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [lat, lng, filterType])

  useEffect(() => { fetchConditions() }, [fetchConditions])

  const handleAdd = async () => {
    if (!lat || !lng) return
    setAdding(true)
    try {
      const res = await fetch('/api/road-conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat, lng, type: newType,
          description: newDesc.trim() || undefined,
          userId: userId || 'anonymous',
          userName: userName || 'Anonimen',
        }),
      })
      if (res.ok) {
        setShowAdd(false)
        setNewDesc('')
        setNewType('wet')
        fetchConditions()
      }
    } catch { /* ignore */ }
    setAdding(false)
  }

  const handleVote = async (id: string, vote: 'up' | 'down') => {
    try {
      const res = await fetch('/api/road-conditions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, vote }),
      })
      if (res.ok) fetchConditions()
    } catch { /* ignore */ }
  }

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'zdaj'
    if (mins < 60) return `pred ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `pred ${hrs} h`
    return `pred ${Math.floor(hrs / 24)} dni`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <AlertTriangle className="size-3.5 text-amber-500" /> Stanje na cestah
        </h4>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={fetchConditions}>
            <Filter className="size-3" /> Osveži
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => setShowAdd(true)}>
            <Plus className="size-3" /> Prijavi
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors ${filterType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          onClick={() => setFilterType('all')}
        >
          Vse
        </button>
        {Object.entries(CONDITION_TYPES).map(([key, val]) => (
          <button
            key={key}
            className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors ${filterType === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            onClick={() => setFilterType(key)}
          >
            {val.emoji} {val.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />)}</div>
      ) : conditions.length === 0 ? (
        <div className="text-center py-6">
          <AlertTriangle className="size-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Ni poročil o stanju na cestah</p>
          <p className="text-[9px] text-muted-foreground mt-1">Bodite prvi, ki boste poročali!</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
          {conditions.map(c => (
            <div key={c.id} className="rounded-lg border border-border/30 p-2 hover:border-primary/20 transition-all">
              <div className="flex items-start gap-2">
                <div
                  className="size-7 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5"
                  style={{ background: `${c.typeColor}20` }}
                >
                  {c.typeEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium" style={{ color: c.typeColor }}>{c.typeLabel}</span>
                    {c.distance !== undefined && (
                      <span className="text-[9px] text-muted-foreground">{c.distance.toFixed(0)} km</span>
                    )}
                  </div>
                  {c.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{c.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="size-2.5" /> {relativeTime(c.createdAt)}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{c.userName}</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => handleVote(c.id, 'up')}
                        className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-green-400 transition-colors"
                      >
                        <ThumbsUp className="size-2.5" /> {c.upvotes > 0 && c.upvotes}
                      </button>
                      <button
                        onClick={() => handleVote(c.id, 'down')}
                        className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <ThumbsDown className="size-2.5" /> {c.downvotes > 0 && c.downvotes}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground text-center">
        {conditions.length} poročil · Samodejno potečejo po 24h
      </p>

      {/* Add report dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> Prijavi stanje na cesti
          </DialogTitle>

          <div className="space-y-3 mt-2">
            {/* Type selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground font-medium">Tip</span>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(CONDITION_TYPES).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setNewType(key)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                      newType === key ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span>{val.emoji}</span>
                    {val.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground font-medium">Opis (opcijsko)</span>
              <Textarea
                placeholder="Opišite stanje na cesti..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Location info */}
            {lat && lng && (
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <MapPin className="size-3" /> {lat.toFixed(4)}, {lng.toFixed(4)}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => setShowAdd(false)}>
                Prekliči
              </Button>
              <Button size="sm" className="flex-1 text-xs h-8 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleAdd} disabled={adding}>
                {adding ? 'Pošiljam...' : 'Pošlji poročilo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
