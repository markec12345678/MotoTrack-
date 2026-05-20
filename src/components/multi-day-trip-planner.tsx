'use client'

import React, { useState, useCallback } from 'react'
import {
  Calendar, Plus, Trash2, MapPin, Clock, Route, BedDouble,
  ChevronDown, ChevronUp, Edit3, Check, X, Sunrise, Sunset
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TripDay {
  id: string
  name: string // "Dan 1: Ljubljana → Bled"
  startLocation: string
  endLocation: string
  waypoints: Array<{ lat: number; lng: number; name: string }>
  notes: string
  accommodation?: string
  estimatedDistance: number // km
  estimatedDuration: number // minutes
}

interface MultiDayTrip {
  id: string
  name: string
  days: TripDay[]
  createdAt: number
}

interface MultiDayTripPlannerProps {
  onLoadDay?: (waypoints: Array<{ lat: number; lng: number }>) => void
  className?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `trip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function createDay(index: number): TripDay {
  return {
    id: `day_${Date.now()}_${index}`,
    name: `Dan ${index}: `,
    startLocation: '',
    endLocation: '',
    waypoints: [],
    notes: '',
    estimatedDistance: 0,
    estimatedDuration: 0,
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function MultiDayTripPlanner({ onLoadDay, className = '' }: MultiDayTripPlannerProps) {
  const [trip, setTrip] = useState<MultiDayTrip>({
    id: generateId(),
    name: '',
    days: [createDay(1)],
    createdAt: Date.now(),
  })
  const [expandedDay, setExpandedDay] = useState<string>(trip.days[0].id)
  const [savedTrips, setSavedTrips] = useState<MultiDayTrip[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem('mototrack_trips')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const addDay = useCallback(() => {
    if (trip.days.length >= 14) {
      toast.error('Največ 14 dni na potovanje')
      return
    }
    const newDay = createDay(trip.days.length + 1)
    const lastDay = trip.days[trip.days.length - 1]
    if (lastDay.endLocation) {
      newDay.startLocation = lastDay.endLocation
      newDay.name = `Dan ${trip.days.length + 1}: ${lastDay.endLocation} → `
    }
    setTrip(prev => ({ ...prev, days: [...prev.days, newDay] }))
    setExpandedDay(newDay.id)
    toast.success(`Dan ${trip.days.length + 1} dodan`)
  }, [trip.days])

  const removeDay = useCallback((dayId: string) => {
    if (trip.days.length <= 1) {
      toast.error('Potovanje mora imeti vsaj 1 dan')
      return
    }
    setTrip(prev => ({
      ...prev,
      days: prev.days.filter(d => d.id !== dayId).map((d, i) => ({
        ...d,
        name: d.name.replace(/^Dan \d+/, `Dan ${i + 1}`),
      })),
    }))
  }, [trip.days.length])

  const updateDay = useCallback((dayId: string, updates: Partial<TripDay>) => {
    setTrip(prev => ({
      ...prev,
      days: prev.days.map(d => d.id === dayId ? { ...d, ...updates } : d),
    }))
  }, [])

  const totalDistance = trip.days.reduce((s, d) => s + d.estimatedDistance, 0)
  const totalDuration = trip.days.reduce((s, d) => s + d.estimatedDuration, 0)

  const saveTrip = useCallback(() => {
    if (!trip.name.trim()) {
      toast.error('Imenujte potovanje')
      return
    }
    const updated = [...savedTrips.filter(t => t.id !== trip.id), trip]
    setSavedTrips(updated)
    try {
      localStorage.setItem('mototrack_trips', JSON.stringify(updated))
      toast.success('Potovanje shranjeno!')
    } catch {
      toast.error('Napaka pri shranjevanju')
    }
  }, [trip, savedTrips])

  const loadTrip = useCallback((t: MultiDayTrip) => {
    setTrip(t)
    if (t.days.length > 0) setExpandedDay(t.days[0].id)
    toast.success(`Potovanje "${t.name}" naloženo`)
  }, [])

  const deleteTrip = useCallback((tripId: string) => {
    const updated = savedTrips.filter(t => t.id !== tripId)
    setSavedTrips(updated)
    try {
      localStorage.setItem('mototrack_trips', JSON.stringify(updated))
    } catch {}
    toast.success('Potovanje izbrisano')
  }, [savedTrips])

  const handleLoadDay = useCallback((day: TripDay) => {
    if (day.waypoints.length < 2) {
      toast.error('Dan potrebuje vsaj 2 točki')
      return
    }
    onLoadDay?.(day.waypoints)
    toast.success(`Dan "${day.name}" naložen v Načrtuj`)
  }, [onLoadDay])

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          Večdnevno potovanje
        </h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={saveTrip}>
            <Check className="size-3" />
            Shrani
          </Button>
        </div>
      </div>

      {/* Trip Name */}
      <Input
        value={trip.name}
        onChange={(e) => setTrip(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Ime potovanja (npr. Balkanski vikend)"
        className="h-8 text-xs mb-3"
      />

      {/* Trip Summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-secondary/50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold">{trip.days.length}</div>
          <div className="text-[9px] text-muted-foreground">Dni</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold">{Math.round(totalDistance)} km</div>
          <div className="text-[9px] text-muted-foreground">Skupaj</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold">{Math.round(totalDuration / 60)}h</div>
          <div className="text-[9px] text-muted-foreground">Čas</div>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-2">
        {trip.days.map((day, idx) => {
          const isExpanded = expandedDay === day.id
          return (
            <div key={day.id} className="border border-border/50 rounded-xl overflow-hidden">
              {/* Day header */}
              <button
                onClick={() => setExpandedDay(isExpanded ? '' : day.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/30 transition-colors"
              >
                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-medium truncate">{day.name || `Dan ${idx + 1}`}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {day.estimatedDistance > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Route className="size-2.5" />
                        {Math.round(day.estimatedDistance)} km
                      </span>
                    )}
                    {day.accommodation && (
                      <span className="flex items-center gap-0.5">
                        <BedDouble className="size-2.5" />
                        {day.accommodation}
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
              </button>

              {/* Day detail */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                  <Input
                    value={day.name}
                    onChange={(e) => updateDay(day.id, { name: e.target.value })}
                    placeholder={`Dan ${idx + 1}: Od → Do`}
                    className="h-7 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground flex items-center gap-0.5 mb-0.5">
                        <Sunrise className="size-2.5" /> Start
                      </label>
                      <Input
                        value={day.startLocation}
                        onChange={(e) => updateDay(day.id, { startLocation: e.target.value })}
                        placeholder="Ljubljana"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground flex items-center gap-0.5 mb-0.5">
                        <Sunset className="size-2.5" /> Konec
                      </label>
                      <Input
                        value={day.endLocation}
                        onChange={(e) => updateDay(day.id, { endLocation: e.target.value })}
                        placeholder="Bled"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground flex items-center gap-0.5 mb-0.5">
                      <BedDouble className="size-2.5" /> Namestitev
                    </label>
                    <Input
                      value={day.accommodation || ''}
                      onChange={(e) => updateDay(day.id, { accommodation: e.target.value })}
                      placeholder="Hotel Bled, Kamping..."
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground mb-0.5 block">Razdalja (km)</label>
                      <Input
                        type="number"
                        value={day.estimatedDistance || ''}
                        onChange={(e) => updateDay(day.id, { estimatedDistance: parseFloat(e.target.value) || 0 })}
                        placeholder="150"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground mb-0.5 block">Čas (min)</label>
                      <Input
                        type="number"
                        value={day.estimatedDuration || ''}
                        onChange={(e) => updateDay(day.id, { estimatedDuration: parseFloat(e.target.value) || 0 })}
                        placeholder="180"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground mb-0.5 block">Opombe</label>
                    <Input
                      value={day.notes}
                      onChange={(e) => updateDay(day.id, { notes: e.target.value })}
                      placeholder="Premorski prelaz, kosilo v Kobaridu..."
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 flex-1"
                      onClick={() => handleLoadDay(day)}
                    >
                      <Route className="size-3" />
                      Naloži v Načrtuj
                    </Button>
                    {trip.days.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => removeDay(day.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add day button */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1 w-full mt-2"
        onClick={addDay}
      >
        <Plus className="size-3" />
        Dodaj dan
      </Button>

      {/* Saved trips */}
      {savedTrips.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Shranjena potovanja</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {savedTrips.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/30">
                <Calendar className="size-3 text-muted-foreground" />
                <button
                  onClick={() => loadTrip(t)}
                  className="flex-1 text-left text-xs font-medium hover:text-primary transition-colors"
                >
                  {t.name}
                </button>
                <Badge variant="secondary" className="text-[8px] px-1 py-0">{t.days.length}d</Badge>
                <button onClick={() => deleteTrip(t.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
