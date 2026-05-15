'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, MapPin, Plus, ExternalLink, Filter, Star, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { MotoEventData } from '@/components/tabs/types'

const countryNames: Record<string, string> = {
  SI: '🇸🇮 Slovenija', HR: '🇭🇷 Hrvaška', BA: '🇧🇦 BiH', ME: '🇲🇪 Črna gora',
  RS: '🇷🇸 Srbija', MK: '🇲🇰 Makedonija', AL: '🇦🇱 Albanija', GR: '🇬🇷 Grčija',
  BG: '🇧🇬 Bolgarija', RO: '🇷🇴 Romunija', HU: '🇭🇺 Madžarska', AT: '🇦🇹 Avstrija',
}

const categoryEmoji: Record<string, string> = {
  meet: '🤝', rally: '🏁', race: '🏎️', show: '✨', charity: '❤️', tour: '🗺️', festival: '🎉',
}
const categoryLabel: Record<string, string> = {
  meet: 'Srečanje', rally: 'Rally', race: 'Dirka', show: 'Show', charity: 'Dobrodelno', tour: 'Turneja', festival: 'Festival',
}

const countryList = Object.entries(countryNames).map(([code, name]) => ({ code, name }))

interface BalkanEventsPanelProps {
  userId?: string
}

export default function BalkanEventsPanel({ userId }: BalkanEventsPanelProps) {
  const [events, setEvents] = useState<MotoEventData[]>([])
  const [loading, setLoading] = useState(false)
  const [filterCountry, setFilterCountry] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newCountry, setNewCountry] = useState('SI')
  const [newCategory, setNewCategory] = useState('meet')
  const [newDescription, setNewDescription] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [newLat, setNewLat] = useState('46.0569')
  const [newLng, setNewLng] = useState('14.5058')

  // Fetch events on mount and when filters change
  const fetchEvents = useCallback(() => {
    setLoading(true)
    fetch(`/api/events?upcoming=true&limit=50${filterCountry !== 'all' ? `&country=${filterCountry}` : ''}${filterCategory !== 'all' ? `&category=${filterCategory}` : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { setEvents(j?.data || []); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [filterCountry, filterCategory])

  useEffect(() => {
    const ac = new AbortController()
    fetch(`/api/events?upcoming=true&limit=50${filterCountry !== 'all' ? `&country=${filterCountry}` : ''}${filterCategory !== 'all' ? `&category=${filterCategory}` : ''}`, { signal: ac.signal })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setEvents(j?.data || []) })
      .catch(() => {})
    return () => ac.abort()
  }, [filterCountry, filterCategory])

  const handleCreate = async () => {
    if (!newTitle || !newDate || !newLocation) {
      toast.error('Izpolnite vsaj naslov, datum in lokacijo')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          date: newDate,
          endDate: newEndDate || null,
          location: newLocation,
          country: newCountry,
          category: newCategory,
          description: newDescription || null,
          website: newWebsite || null,
          lat: parseFloat(newLat),
          lng: parseFloat(newLng),
          createdBy: userId || null,
        }),
      })
      if (res.ok) {
        toast.success('Dogodek ustvarjen!')
        setShowCreate(false)
        setNewTitle(''); setNewDate(''); setNewLocation(''); setNewDescription(''); setNewWebsite('')
        fetchEvents()
      } else {
        toast.error('Napaka pri ustvarjanju')
      }
    } catch { toast.error('Napaka') }
    setCreating(false)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="size-5 text-primary" /> Balkan Moto Dogodki
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={fetchEvents}>
            <Filter className="size-3" /> Osveži
          </Button>
          <Button size="sm" className="text-xs gap-1" onClick={() => setShowCreate(true)}>
            <Plus className="size-3" /> Dodaj
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          className="text-xs rounded-md border border-border/50 bg-secondary/50 px-2 py-1"
          value={filterCountry}
          onChange={e => setFilterCountry(e.target.value)}
        >
          <option value="all">Vse države</option>
          {countryList.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select
          className="text-xs rounded-md border border-border/50 bg-secondary/50 px-2 py-1"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="all">Vse kategorije</option>
          {Object.entries(categoryLabel).map(([k, v]) => <option key={k} value={k}>{categoryEmoji[k]} {v}</option>)}
        </select>
      </div>

      {/* Events list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Calendar className="size-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Ni prihajajočih dogodkov</p>
          <p className="text-xs text-muted-foreground mt-1">Dodajte nov dogodek ali spremenite filtre</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
          {events.map(event => (
            <div key={event.id} className="rounded-xl border border-border/30 p-3 hover:border-primary/30 transition-all group">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center text-lg shrink-0">
                  {categoryEmoji[event.category] || '📅'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{event.title}</p>
                    {event.isFeatured && <Star className="size-3 text-amber-400 fill-amber-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(event.date)}</span>
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{event.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{countryNames[event.country] || event.country}</Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{categoryEmoji[event.category]} {categoryLabel[event.category] || event.category}</Badge>
                    {event.website && (
                      <a href={event.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                        <Globe className="size-3" />
                      </a>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{event.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogTitle>Nov dogodek</DialogTitle>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Naslov *</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ime dogodka" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Datum začetka *</Label>
                  <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Datum konca</Label>
                  <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Lokacija *</Label>
                <Input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="npr. Ljubljana, BTC" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Država</Label>
                  <select className="w-full text-sm rounded-md border border-border bg-background px-2 py-1.5" value={newCountry} onChange={e => setNewCountry(e.target.value)}>
                    {countryList.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Kategorija</Label>
                  <select className="w-full text-sm rounded-md border border-border bg-background px-2 py-1.5" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                    {Object.entries(categoryLabel).map(([k, v]) => <option key={k} value={k}>{categoryEmoji[k]} {v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Opis</Label>
                <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Opis dogodka..." rows={2} />
              </div>
              <div>
                <Label className="text-xs">Spletna stran</Label>
                <Input value={newWebsite} onChange={e => setNewWebsite(e.target.value)} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Zem. širina</Label>
                  <Input type="number" step="0.001" value={newLat} onChange={e => setNewLat(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Zem. dolžina</Label>
                  <Input type="number" step="0.001" value={newLng} onChange={e => setNewLng(e.target.value)} />
                </div>
              </div>
              <Button className="w-full" disabled={creating} onClick={handleCreate}>
                {creating ? 'Ustvarjam...' : 'Ustvari dogodek'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
