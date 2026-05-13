'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Route, Trash2, Save, MapPin, X, Upload, Plus, Calendar, Minus, Hotel, Fuel, ChevronDown, ChevronUp, Eye, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { categoryLabel, haversine } from '@/components/tabs/types'
import type { TripData, TripDayData } from '@/components/tabs/types'

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

interface DayPlan {
  dayNumber: number
  title: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  waypoints: Array<{ lat: number; lng: number }>
  distance: number
  duration: number
  notes: string
  accommodation: string
  fuelStop: boolean
}

interface PlanTabProps {
  waypoints: Array<{ lat: number; lng: number }>
  setWaypoints: React.Dispatch<React.SetStateAction<Array<{ lat: number; lng: number }>>>
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
  category: string
  setCategory: React.Dispatch<React.SetStateAction<string>>
  avoidHighways: boolean
  setAvoidHighways: React.Dispatch<React.SetStateAction<boolean>>
  distance: number
  onMapClick: (lat: number, lng: number) => void
  onSave: () => void
  userId: string
  onRefresh: () => void
}

const dayColors = ['#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

function getDayColor(dayNumber: number): string {
  return dayColors[(dayNumber - 1) % dayColors.length]
}

function emptyDay(num: number): DayPlan {
  return {
    dayNumber: num,
    title: `Dan ${num}`,
    startLat: 46.15,
    startLng: 14.99,
    endLat: 46.15,
    endLng: 14.99,
    waypoints: [],
    distance: 0,
    duration: 0,
    notes: '',
    accommodation: '',
    fuelStop: false,
  }
}

export default function PlanTab({
  waypoints, setWaypoints, title, setTitle,
  category, setCategory, avoidHighways, setAvoidHighways,
  distance, onMapClick, onSave, userId, onRefresh,
}: PlanTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mode: 'single' or 'multiday'
  const [mode, setMode] = useState<'single' | 'multiday'>('single')

  // Multi-day trip state
  const [tripTitle, setTripTitle] = useState('')
  const [tripDescription, setTripDescription] = useState('')
  const [tripStartDate, setTripStartDate] = useState('')
  const [tripEndDate, setTripEndDate] = useState('')
  const [tripDays, setTripDays] = useState<DayPlan[]>([emptyDay(1)])
  const [activeDay, setActiveDay] = useState(0) // index
  const [expandedDay, setExpandedDay] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)

  // Saved trips
  const [savedTrips, setSavedTrips] = useState<TripData[]>([])
  const [viewingTrip, setViewingTrip] = useState<TripData | null>(null)

  // Map click handler for multi-day: add waypoint to active day
  const handleMultiDayMapClick = useCallback((lat: number, lng: number) => {
    setTripDays(prev => {
      const updated = [...prev]
      const day = { ...updated[activeDay] }
      day.waypoints = [...day.waypoints, { lat, lng }]
      // Update start/end from waypoints
      if (day.waypoints.length === 1) {
        day.startLat = day.waypoints[0].lat
        day.startLng = day.waypoints[0].lng
        day.endLat = day.waypoints[0].lat
        day.endLng = day.waypoints[0].lng
      } else {
        day.startLat = day.waypoints[0].lat
        day.startLng = day.waypoints[0].lng
        day.endLat = day.waypoints[day.waypoints.length - 1].lat
        day.endLng = day.waypoints[day.waypoints.length - 1].lng
      }
      // Recalculate distance
      let dist = 0
      for (let i = 1; i < day.waypoints.length; i++) {
        dist += haversine(day.waypoints[i - 1].lat, day.waypoints[i - 1].lng, day.waypoints[i].lat, day.waypoints[i].lng)
      }
      day.distance = Math.round(dist * 10) / 10
      // Estimate duration: avg 60 km/h
      day.duration = Math.round((dist / 60) * 60)
      updated[activeDay] = day
      return updated
    })
  }, [activeDay])

  // Handle map click based on mode
  const handleMapClickInternal = useCallback((lat: number, lng: number) => {
    if (mode === 'multiday') {
      handleMultiDayMapClick(lat, lng)
    }
    onMapClick(lat, lng)
  }, [mode, handleMultiDayMapClick, onMapClick])

  // Calculate total trip distance
  const totalTripDistance = tripDays.reduce((sum, d) => sum + d.distance, 0)

  // Add day
  const addDay = () => {
    const lastDay = tripDays[tripDays.length - 1]
    const newDay: DayPlan = {
      ...emptyDay(tripDays.length + 1),
      startLat: lastDay?.endLat || 46.15,
      startLng: lastDay?.endLng || 14.99,
    }
    setTripDays(prev => [...prev, newDay])
    setActiveDay(tripDays.length)
    setExpandedDay(tripDays.length)
  }

  // Remove day
  const removeDay = (index: number) => {
    if (tripDays.length <= 1) return
    const updated = tripDays.filter((_, i) => i !== index).map((d, i) => ({ ...d, dayNumber: i + 1 }))
    setTripDays(updated)
    if (activeDay >= updated.length) setActiveDay(updated.length - 1)
    if (expandedDay !== null && expandedDay >= updated.length) setExpandedDay(updated.length - 1)
  }

  // Update day field
  const updateDay = (index: number, field: keyof DayPlan, value: unknown) => {
    setTripDays(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  // Remove waypoint from day
  const removeWaypoint = (dayIndex: number, wpIndex: number) => {
    setTripDays(prev => {
      const updated = [...prev]
      const day = { ...updated[dayIndex] }
      day.waypoints = day.waypoints.filter((_, i) => i !== wpIndex)
      // Update start/end
      if (day.waypoints.length > 0) {
        day.startLat = day.waypoints[0].lat
        day.startLng = day.waypoints[0].lng
        day.endLat = day.waypoints[day.waypoints.length - 1].lat
        day.endLng = day.waypoints[day.waypoints.length - 1].lng
      }
      // Recalculate distance
      let dist = 0
      for (let i = 1; i < day.waypoints.length; i++) {
        dist += haversine(day.waypoints[i - 1].lat, day.waypoints[i - 1].lng, day.waypoints[i].lat, day.waypoints[i].lng)
      }
      day.distance = Math.round(dist * 10) / 10
      day.duration = Math.round((dist / 60) * 60)
      updated[dayIndex] = day
      return updated
    })
  }

  // Save trip
  const saveTrip = async () => {
    if (!tripTitle.trim()) {
      toast.error('Vnesite naslov potovanja')
      return
    }
    if (!tripStartDate || !tripEndDate) {
      toast.error('Izberite datume potovanja')
      return
    }
    if (!userId) {
      toast.error('Uporabnik ni prijavljen')
      return
    }

    setSaving(true)
    try {
      const daysData = tripDays.map(d => ({
        dayNumber: d.dayNumber,
        title: d.title,
        startLat: d.startLat,
        startLng: d.startLng,
        endLat: d.endLat,
        endLng: d.endLng,
        waypoints: JSON.stringify(d.waypoints),
        distance: d.distance,
        duration: d.duration,
        notes: d.notes || undefined,
        accommodation: d.accommodation || undefined,
        fuelStop: d.fuelStop,
      }))

      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tripTitle,
          description: tripDescription,
          startDate: tripStartDate,
          endDate: tripEndDate,
          isPublic: true,
          userId,
          days: daysData,
        }),
      })

      if (res.ok) {
        toast.success('Potovanje shranjeno!')
        setTripTitle('')
        setTripDescription('')
        setTripStartDate('')
        setTripEndDate('')
        setTripDays([emptyDay(1)])
        setActiveDay(0)
        setExpandedDay(0)
        fetchSavedTrips()
      } else {
        toast.error('Napaka pri shranjevanju potovanja')
      }
    } catch {
      toast.error('Napaka pri shranjevanju potovanja')
    } finally {
      setSaving(false)
    }
  }

  // Fetch saved trips
  const fetchSavedTrips = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/trips?userId=${userId}`)
      if (res.ok) {
        const j = await res.json()
        setSavedTrips(j.data || [])
      }
    } catch {
      // ignore
    }
  }, [userId])

  useEffect(() => {
    fetchSavedTrips()
  }, [fetchSavedTrips])

  // Delete trip
  const deleteTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Potovanje izbrisano')
        if (viewingTrip?.id === tripId) setViewingTrip(null)
        fetchSavedTrips()
      } else {
        toast.error('Napaka pri brisanju')
      }
    } catch {
      toast.error('Napaka pri brisanju')
    }
  }

  // View trip on map
  const viewTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`)
      if (res.ok) {
        const j = await res.json()
        setViewingTrip(j.data || null)
      }
    } catch {
      toast.error('Napaka pri nalaganju potovanja')
    }
  }

  // Prepare trip days for map display
  const mapTripDays: TripDayData[] | undefined = viewingTrip
    ? viewingTrip.tripDays
    : mode === 'multiday'
      ? tripDays.map(d => ({
          id: `new-${d.dayNumber}`,
          dayNumber: d.dayNumber,
          title: d.title,
          startLat: d.startLat,
          startLng: d.startLng,
          endLat: d.endLat,
          endLng: d.endLng,
          waypoints: JSON.stringify(d.waypoints),
          distance: d.distance,
          duration: d.duration,
          notes: d.notes || null,
          accommodation: d.accommodation || null,
          fuelStop: d.fuelStop,
        }))
      : undefined

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      toast.error('Izberite datoteko formata .gpx')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', userId)
      const res = await fetch('/api/gpx/import', { method: 'POST', body: formData })
      if (res.ok) {
        toast.success('GPX uspešno uvožen!')
        onRefresh()
      } else {
        toast.error('Napaka pri uvozu GPX')
      }
    } catch {
      toast.error('Napaka pri uvozu GPX')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Auto-set end date based on start date and days
  useEffect(() => {
    if (tripStartDate && tripDays.length > 0) {
      const start = new Date(tripStartDate)
      const end = new Date(start)
      end.setDate(end.getDate() + tripDays.length - 1)
      const endStr = end.toISOString().split('T')[0]
      if (endStr !== tripEndDate) {
        setTripEndDate(endStr)
      }
    }
  }, [tripStartDate, tripDays.length, tripEndDate])

  return (
    <div className="relative w-full h-[calc(100vh-104px)] flex flex-col lg:flex-row">
      <div className="flex-1 relative">
        <MotoMap
          center={[46.15, 14.99]}
          zoom={8}
          rides={[]}
          routes={[]}
          planWaypoints={mode === 'single' ? waypoints : []}
          showPlan={mode === 'single'}
          onMapClick={handleMapClickInternal}
          tripDays={mapTripDays}
        />
      </div>
      <div className="lg:w-96 w-full bg-card border-t lg:border-t-0 lg:border-l border-border/50 p-4 overflow-y-auto max-h-[40vh] lg:max-h-full">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 mb-4 bg-secondary/50 rounded-lg p-1">
          <button
            className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${
              mode === 'single' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('single'); setViewingTrip(null) }}
          >
            Enodnevna pot
          </button>
          <button
            className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${
              mode === 'multiday' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('multiday'); setViewingTrip(null) }}
          >
            Večdnevno potovanje
          </button>
        </div>

        {mode === 'single' ? (
          /* ===== SINGLE DAY MODE ===== */
          <div className="space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><Route className="size-5 text-primary" />Načrtuj pot</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ime poti</label>
              <Input placeholder="Npr. Obala do Pirana" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Kategorija</label>
              <div className="flex flex-wrap gap-2">
                {['scenic', 'twisty', 'offroad', 'city'].map(cat => (
                  <Button key={cat} variant={category === cat ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setCategory(cat)}>
                    {categoryLabel(cat)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm">Izogni se avtocestam</label>
              <Switch checked={avoidHighways} onCheckedChange={setAvoidHighways} />
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Točke ({waypoints.length})</label>
                {waypoints.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={() => { setWaypoints([]) }}>
                    <Trash2 className="size-3 mr-1" />Počisti
                  </Button>
                )}
              </div>
              <ScrollArea className="max-h-40">
                {waypoints.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Kliknite na zemljevid za dodajanje točk</p>
                ) : (
                  <div className="space-y-1">
                    {waypoints.map((wp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-3 text-primary" />
                          <span>Točka {i + 1}</span>
                          <span className="text-muted-foreground">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => setWaypoints(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
            {waypoints.length > 1 && (
              <div className="bg-primary/10 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Skupna razdalja</span>
                  <span className="font-bold text-primary">{distance} km</span>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={onSave} disabled={waypoints.length < 2}>
              <Save className="size-4 mr-2" />Shrani pot
            </Button>

            {/* GPX Import */}
            <Separator />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4 mr-2" />Uvozi GPX
              </Button>
            </div>
          </div>
        ) : (
          /* ===== MULTI-DAY MODE ===== */
          <div className="space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><Calendar className="size-5 text-primary" />Večdnevno potovanje</h2>

            {/* Viewing trip banner */}
            {viewingTrip && (
              <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-primary">👁️ {viewingTrip.title}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setViewingTrip(null)}>
                    <X className="size-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {viewingTrip.tripDays.length} dni · {viewingTrip.totalDistance} km
                </p>
              </div>
            )}

            {/* Trip details */}
            {!viewingTrip && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Naslov potovanja</label>
                  <Input placeholder="Npr. Po Sloveniji v 3 dneh" value={tripTitle} onChange={e => setTripTitle(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis (opcijsko)</label>
                  <Input placeholder="Kratek opis potovanja..." value={tripDescription} onChange={e => setTripDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Začetek</label>
                    <Input type="date" value={tripStartDate} onChange={e => setTripStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Konec</label>
                    <Input type="date" value={tripEndDate} onChange={e => setTripEndDate(e.target.value)} />
                  </div>
                </div>

                <Separator />

                {/* Day-by-day planner */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground">Dnevi ({tripDays.length})</label>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={addDay}>
                      <Plus className="size-3 mr-1" />Dodaj dan
                    </Button>
                  </div>

                  <ScrollArea className="max-h-[45vh]">
                    <div className="space-y-2">
                      {tripDays.map((day, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg border transition-all ${
                            activeDay === idx ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-secondary/30'
                          }`}
                        >
                          {/* Day header */}
                          <button
                            className="w-full flex items-center gap-2 p-2.5 text-left"
                            onClick={() => {
                              setActiveDay(idx)
                              setExpandedDay(expandedDay === idx ? null : idx)
                            }}
                          >
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getDayColor(day.dayNumber) }}
                            />
                            <span className="text-sm font-medium flex-1 truncate">{day.title}</span>
                            <span className="text-xs text-muted-foreground">{day.distance} km</span>
                            {tripDays.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); removeDay(idx) }}
                              >
                                <Minus className="size-3" />
                              </Button>
                            )}
                            {expandedDay === idx ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                          </button>

                          {/* Expanded day details */}
                          {expandedDay === idx && (
                            <div className="px-2.5 pb-2.5 space-y-2.5 border-t border-border/30 pt-2">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Naslov dneva</label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder={`Dan ${day.dayNumber}: Ljubljana - Bled`}
                                  value={day.title}
                                  onChange={e => updateDay(idx, 'title', e.target.value)}
                                />
                              </div>

                              {/* Waypoints */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-xs text-muted-foreground">Točke ({day.waypoints.length})</label>
                                  {day.waypoints.length > 0 && (
                                    <Button variant="ghost" size="sm" className="h-5 text-xs text-destructive" onClick={() => {
                                      const updated = { ...day, waypoints: [], distance: 0, duration: 0, startLat: 46.15, startLng: 14.99, endLat: 46.15, endLng: 14.99 }
                                      setTripDays(prev => { const arr = [...prev]; arr[idx] = updated; return arr })
                                    }}>
                                      <Trash2 className="size-3 mr-1" />Počisti
                                    </Button>
                                  )}
                                </div>
                                {day.waypoints.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2 bg-secondary/30 rounded">
                                    Kliknite na zemljevid za točke tega dne
                                  </p>
                                ) : (
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {day.waypoints.map((wp, wi) => (
                                      <div key={wi} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getDayColor(day.dayNumber) }} />
                                          <span>{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeWaypoint(idx, wi)}>
                                          <X className="size-2.5" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Notes */}
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">📝 Opombe</label>
                                <Textarea
                                  className="text-xs min-h-[48px]"
                                  placeholder="Npr. Nočitev: Hotel Vila Bled"
                                  value={day.notes}
                                  onChange={e => updateDay(idx, 'notes', e.target.value)}
                                />
                              </div>

                              {/* Accommodation */}
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Hotel className="size-3" /> Namestitev</label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Npr. Hotel Vila Bled"
                                  value={day.accommodation}
                                  onChange={e => updateDay(idx, 'accommodation', e.target.value)}
                                />
                              </div>

                              {/* Fuel stop */}
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`fuel-${idx}`}
                                  checked={day.fuelStop}
                                  onCheckedChange={(checked) => updateDay(idx, 'fuelStop', !!checked)}
                                />
                                <label htmlFor={`fuel-${idx}`} className="text-xs flex items-center gap-1 cursor-pointer">
                                  <Fuel className="size-3" /> Načrtovan postanek za gorivo
                                </label>
                              </div>

                              {/* Day stats */}
                              {day.waypoints.length > 1 && (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground bg-secondary/30 rounded px-2 py-1.5">
                                  <span>📏 {day.distance} km</span>
                                  <span><Clock className="size-3 inline" /> ~{Math.round(day.duration)} min</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Total stats */}
                {totalTripDistance > 0 && (
                  <div className="bg-primary/10 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Skupna razdalja</span>
                      <span className="font-bold text-primary">{totalTripDistance} km</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Skupen čas</span>
                      <span className="font-medium">~{Math.round(tripDays.reduce((s, d) => s + d.duration, 0))} min</span>
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={saveTrip} disabled={saving || !tripTitle.trim()}>
                  <Save className="size-4 mr-2" />{saving ? 'Shranjujem...' : 'Shrani potovanje'}
                </Button>
              </>
            )}

            <Separator />

            {/* Saved trips list */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">📂 Shranjena potovanja</h3>
              {savedTrips.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Ni shranjenih potovanj</p>
              ) : (
                <ScrollArea className="max-h-40">
                  <div className="space-y-1.5">
                    {savedTrips.map(trip => (
                      <div
                        key={trip.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                          viewingTrip?.id === trip.id ? 'border-primary/50 bg-primary/5' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'
                        }`}
                        onClick={() => viewTrip(trip.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{trip.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {trip.days} dni · {trip.totalDistance} km
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); viewTrip(trip.id) }}>
                            <Eye className="size-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id) }}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
