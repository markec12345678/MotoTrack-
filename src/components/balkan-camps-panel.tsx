'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Tent, MapPin, Star, Phone, Globe, ExternalLink, Filter, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { CampSiteData } from '@/components/tabs/types'

const countryNames: Record<string, string> = {
  SI: '🇸🇮 Slovenija', HR: '🇭🇷 Hrvaška', BA: '🇧🇦 BiH', ME: '🇲🇪 Črna gora',
  RS: '🇷🇸 Srbija', MK: '🇲🇰 Makedonija', AL: '🇦🇱 Albanija', GR: '🇬🇷 Grčija',
  BG: '🇧🇬 Bolgarija', RO: '🇷🇴 Romunija', HU: '🇭🇺 Madžarska', AT: '🇦🇹 Avstrija',
}

const priceLabels: Record<string, string> = { budget: 'Proračunsko', mid: 'Zmerno', premium: 'Premium' }
const priceColors: Record<string, string> = { budget: 'bg-green-500/20 text-green-400', mid: 'bg-yellow-500/20 text-yellow-400', premium: 'bg-purple-500/20 text-purple-400' }

const amenityEmoji: Record<string, string> = {
  wifi: '📶', showers: '🚿', kitchen: '🍳', parking: '🅿️', laundry: '👕', pool: '🏊', restaurant: '🍽️', shop: '🛒', electricity: '⚡', water: '💧',
}

const countryList = Object.entries(countryNames).map(([code, name]) => ({ code, name }))

interface BalkanCampsPanelProps {
  userId?: string
}

export default function BalkanCampsPanel({ userId: _userId }: BalkanCampsPanelProps) {
  const [camps, setCamps] = useState<CampSiteData[]>([])
  const [loading, setLoading] = useState(false)
  const [filterCountry, setFilterCountry] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newCountry, setNewCountry] = useState('HR')
  const [newAddress, setNewAddress] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriceRange, setNewPriceRange] = useState('mid')
  const [newOpenSeason, setNewOpenSeason] = useState('')
  const [newLat, setNewLat] = useState('45.8000')
  const [newLng, setNewLng] = useState('15.9500')

  const fetchCamps = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/camps?limit=50'
      if (filterCountry !== 'all') url += `&country=${filterCountry}`
      const res = await fetch(url)
      if (res.ok) {
        const j = await res.json()
        setCamps(j.data || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [filterCountry])

  useEffect(() => { fetchCamps() }, [fetchCamps])

  const handleCreate = async () => {
    if (!newName || !newCountry) { toast.error('Izpolnite ime in državo'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/camps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          country: newCountry,
          address: newAddress || null,
          phone: newPhone || null,
          website: newWebsite || null,
          description: newDescription || null,
          priceRange: newPriceRange,
          openSeason: newOpenSeason || null,
          lat: parseFloat(newLat),
          lng: parseFloat(newLng),
          motoFriendly: true,
        }),
      })
      if (res.ok) {
        toast.success('Kamp dodan!')
        setShowCreate(false)
        setNewName(''); setNewAddress(''); setNewPhone(''); setNewWebsite(''); setNewDescription(''); setNewOpenSeason('')
        fetchCamps()
      } else { toast.error('Napaka') }
    } catch { toast.error('Napaka') }
    setCreating(false)
  }

  const renderStars = (rating: number) => {
    const full = Math.round(rating)
    return '★'.repeat(full) + '☆'.repeat(5 - full)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Tent className="size-5 text-primary" /> Kampi za motoriste
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={fetchCamps}>
            <Filter className="size-3" /> Osveži
          </Button>
          <Button size="sm" className="text-xs gap-1" onClick={() => setShowCreate(true)}>
            <Plus className="size-3" /> Dodaj
          </Button>
        </div>
      </div>

      {/* Country filter */}
      <select
        className="text-xs rounded-md border border-border/50 bg-secondary/50 px-2 py-1"
        value={filterCountry}
        onChange={e => setFilterCountry(e.target.value)}
      >
        <option value="all">Vse države</option>
        {countryList.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>

      {/* Camps list */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />)}</div>
      ) : camps.length === 0 ? (
        <div className="text-center py-12">
          <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Tent className="size-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Ni najdenih kampov</p>
          <p className="text-xs text-muted-foreground mt-1">Dodajte nov kamp ali spremenite filter</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
          {camps.map(camp => (
            <div key={camp.id} className="rounded-xl border border-border/30 p-3 hover:border-primary/30 transition-all group">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-lg shrink-0">⛺</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{camp.name}</p>
                    {camp.motoFriendly && <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">🏍️ Moto</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{camp.address || camp.country}</span>
                    <span className="text-amber-400">{renderStars(camp.rating)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{countryNames[camp.country] || camp.country}</Badge>
                    {camp.priceRange && <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${priceColors[camp.priceRange] || ''}`}>{priceLabels[camp.priceRange] || camp.priceRange}</Badge>}
                    {camp.openSeason && <span className="text-[9px] text-muted-foreground">📅 {camp.openSeason}</span>}
                    {camp.phone && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Phone className="size-2.5" />{camp.phone}</span>}
                    {camp.website && (
                      <a href={camp.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                        <Globe className="size-3" />
                      </a>
                    )}
                  </div>
                  {camp.amenities && camp.amenities.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {camp.amenities.map((a: string, i: number) => (
                        <span key={i} className="text-[10px] bg-secondary/50 rounded-full px-1.5 py-0.5">{amenityEmoji[a] || '•'} {a}</span>
                      ))}
                    </div>
                  )}
                  {camp.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{camp.description}</p>}
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
            <DialogTitle>Nov kamp</DialogTitle>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Ime kampa *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ime kampa" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Država</Label>
                  <select className="w-full text-sm rounded-md border border-border bg-background px-2 py-1.5" value={newCountry} onChange={e => setNewCountry(e.target.value)}>
                    {countryList.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Cenovni razred</Label>
                  <select className="w-full text-sm rounded-md border border-border bg-background px-2 py-1.5" value={newPriceRange} onChange={e => setNewPriceRange(e.target.value)}>
                    <option value="budget">Proračunsko</option>
                    <option value="mid">Zmerno</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Naslov</Label>
                <Input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Naslov kampa" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Telefon</Label><Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+386..." /></div>
                <div><Label className="text-xs">Spletna stran</Label><Input value={newWebsite} onChange={e => setNewWebsite(e.target.value)} placeholder="https://..." /></div>
              </div>
              <div>
                <Label className="text-xs">Opis</Label>
                <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Opis kampa..." rows={2} />
              </div>
              <div>
                <Label className="text-xs">Odprta sezona</Label>
                <Input value={newOpenSeason} onChange={e => setNewOpenSeason(e.target.value)} placeholder="npr. Apr-Oct ali Celo leto" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Zem. širina</Label><Input type="number" step="0.001" value={newLat} onChange={e => setNewLat(e.target.value)} /></div>
                <div><Label className="text-xs">Zem. dolžina</Label><Input type="number" step="0.001" value={newLng} onChange={e => setNewLng(e.target.value)} /></div>
              </div>
              <Button className="w-full" disabled={creating} onClick={handleCreate}>
                {creating ? 'Dodajam...' : 'Dodaj kamp'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
