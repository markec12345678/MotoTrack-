'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { MapPin, Phone, Globe, Star, Wrench, Loader2, Search, LocateFixed, Sparkles } from 'lucide-react'
import type { ServiceCenterData } from '@/components/tabs/types'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, string> = {
  dealer: '🏢 Diler', mechanic: '🔧 Servis', tire_shop: '🛞 Pnevmatike',
  parts: '📦 Deli', washing: '🧹 Pralnica', inspection: '✅ Pregled'
}

const BRAND_OPTIONS = ['Vsi', 'BMW', 'Honda', 'Yamaha', 'KTM', 'Suzuki', 'Kawasaki', 'Ducati', 'Triumph', 'Harley-Davidson']

export default function ServiceLocator({ userId }: { userId?: string }) {
  const [centers, setCenters] = useState<ServiceCenterData[]>([])
  const [loading, setLoading] = useState(false)
  const [webSearching, setWebSearching] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [brandFilter, setBrandFilter] = useState<string>('Vsi')
  const [radius, setRadius] = useState([50])
  const [userLat, setUserLat] = useState(46.15)
  const [userLng, setUserLng] = useState(14.99)
  const [hasWebResults, setHasWebResults] = useState(false)

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude)
          setUserLng(pos.coords.longitude)
        },
        () => { /* use defaults */ },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      )
    }
  }, [])

  // Fetch from live API (which combines DB + web search)
  const fetchLiveCenters = useCallback(async (forceWebSearch = false) => {
    setLoading(true)
    if (forceWebSearch) setWebSearching(true)
    try {
      const params = new URLSearchParams({
        lat: String(userLat),
        lng: String(userLng),
        radius: String(radius[0]),
      })
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter)
      if (brandFilter && brandFilter !== 'Vsi') params.set('brand', brandFilter)

      // Use the live API endpoint
      const res = await fetch(`/api/service-centers/live?${params}`)
      if (res.ok) {
        let data = (await res.json()).data || []

        // Apply client-side brand filter if not sent to API
        if (brandFilter !== 'Vsi') {
          data = data.filter((c: ServiceCenterData) =>
            c.brand?.toLowerCase() === brandFilter.toLowerCase()
          )
        }

        // Apply client-side type filter
        if (typeFilter && typeFilter !== 'all') {
          data = data.filter((c: ServiceCenterData) => c.type === typeFilter)
        }

        setCenters(data)
        setHasWebResults(data.some((c: ServiceCenterData) => c.live || c.source === 'web'))

        if (forceWebSearch) {
          const webCount = data.filter((c: ServiceCenterData) => c.live || c.source === 'web').length
          toast.success(`Iskanje končano: ${webCount} rezultatov iz spleta`)
        }
      }
    } catch {
      toast.error('Napaka pri iskanju servisov')
    }
    setLoading(false)
    setWebSearching(false)
  }, [typeFilter, brandFilter, radius, userLat, userLng])

  // Auto-fetch when filters change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLiveCenters() }, [fetchLiveCenters])

  // Explicit web search
  const handleWebSearch = useCallback(() => {
    fetchLiveCenters(true)
  }, [fetchLiveCenters])

  // Count web vs db results
  const webCount = centers.filter(c => c.live || c.source === 'web').length
  const dbCount = centers.filter(c => !c.live && c.source !== 'web').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Wrench className="size-4 text-orange-500" />
          Iskalnik serviserjev
        </h3>
        {(webCount > 0 || dbCount > 0) && (
          <div className="flex items-center gap-1">
            {webCount > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 gap-0.5">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                {webCount} splet
              </Badge>
            )}
            {dbCount > 0 && (
              <Badge variant="outline" className="text-[9px] px-1.5">
                {dbCount} baza
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi tipi</SelectItem>
            <SelectItem value="dealer">Diler</SelectItem>
            <SelectItem value="mechanic">Servis</SelectItem>
            <SelectItem value="tire_shop">Pnevmatike</SelectItem>
            <SelectItem value="parts">Deli</SelectItem>
            <SelectItem value="inspection">Pregled</SelectItem>
            <SelectItem value="washing">Pralnica</SelectItem>
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Znamka" /></SelectTrigger>
          <SelectContent>
            {BRAND_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Radius: {radius[0]} km</span>
        <Slider value={radius} onValueChange={setRadius} min={10} max={200} step={10} className="flex-1" />
      </div>

      {/* Web search button */}
      <Button
        className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white h-8 text-xs"
        onClick={handleWebSearch}
        disabled={webSearching}
      >
        {webSearching ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Iščem na spletu...
          </>
        ) : (
          <>
            <Sparkles className="size-3.5" />
            Išči na spletu {brandFilter !== 'Vsi' ? `(${brandFilter} servis)` : '(vsi servisi)'}
          </>
        )}
      </Button>

      {/* Results list */}
      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
        {centers.map(c => {
          const isWeb = c.live || c.source === 'web'
          return (
            <Card key={c.id} className={`overflow-hidden ${isWeb ? 'border-emerald-500/20' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="text-xl">{TYPE_LABELS[c.type]?.split(' ')[0] || '🏪'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{c.name}</span>
                      {isWeb && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[8px] px-1 py-0 h-4 gap-0.5">
                          <span className="h-1 w-1 rounded-full bg-emerald-400" />
                          Splet
                        </Badge>
                      )}
                      {!isWeb && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
                          Baza
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.brand && <Badge variant="outline" className="text-[10px] shrink-0">{c.brand}</Badge>}
                    </div>
                    {c.address && <p className="text-xs text-muted-foreground mt-0.5">{c.address}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span><MapPin className="size-3 inline" /> {c.distance} km</span>
                      {c.rating > 0 && <span><Star className="size-3 inline text-amber-500" /> {c.rating.toFixed(1)}</span>}
                    </div>
                    {c.services.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.services.slice(0, 4).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                        {c.services.length > 4 && (
                          <Badge variant="secondary" className="text-[10px]">+{c.services.length - 4}</Badge>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="inline-flex items-center justify-center h-6 px-2 text-xs border rounded-md hover:bg-accent">
                          <Phone className="size-3 mr-1" /> Klic
                        </a>
                      )}
                      {c.website && (
                        <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-6 px-2 text-xs border rounded-md hover:bg-accent">
                          <Globe className="size-3 mr-1" /> Spletna
                        </a>
                      )}
                      <a href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-6 px-2 text-xs border rounded-md hover:bg-accent">
                        <MapPin className="size-3 mr-1" /> Zemljevid
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {centers.length === 0 && !loading && !webSearching && (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
          Ni najdenih servisov v tem območju
          <br />
          <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={handleWebSearch}>
            <Search className="size-3" /> Išči na spletu
          </Button>
        </CardContent></Card>
      )}
    </div>
  )
}
