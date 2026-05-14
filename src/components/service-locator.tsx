'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { MapPin, Phone, Globe, Star, Wrench, Building2, ShoppingBag, CheckCircle, Car } from 'lucide-react'
import type { ServiceCenterData } from '@/components/tabs/types'

const TYPE_LABELS: Record<string, string> = {
  dealer: '🏢 Dilerc', mechanic: '🔧 Servis', tire_shop: '🛞 Pnevmatike',
  parts: '📦 Deli', washing: '🧹 Pralnica', inspection: '✅ Pregled'
}

const BRAND_OPTIONS = ['Vsi', 'BMW', 'Honda', 'Yamaha', 'KTM', 'Suzuki', 'Kawasaki', 'Ducati']

export default function ServiceLocator({ userId }: { userId?: string }) {
  const [centers, setCenters] = useState<ServiceCenterData[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [brandFilter, setBrandFilter] = useState<string>('Vsi')
  const [radius, setRadius] = useState([50])

  const fetchCenters = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ lat: '46.15', lng: '14.99', radius: String(radius[0]) })
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter)
      const res = await fetch(`/api/services?${params}`)
      if (res.ok) {
        let data = (await res.json()).data || []
        if (brandFilter !== 'Vsi') data = data.filter((c: ServiceCenterData) => c.brand === brandFilter)
        setCenters(data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [typeFilter, brandFilter, radius])

  useEffect(() => { fetchCenters() }, [fetchCenters])

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2"><Wrench className="size-4 text-orange-500" /> Iskalnik serviserjev</h3>

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

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {centers.map(c => (
          <Card key={c.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="text-xl">{TYPE_LABELS[c.type]?.split(' ')[0] || '🏪'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{c.name}</span>
                    {c.brand && <Badge variant="outline" className="text-[10px] shrink-0">{c.brand}</Badge>}
                  </div>
                  {c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span><MapPin className="size-3 inline" /> {c.distance} km</span>
                    {c.rating > 0 && <span><Star className="size-3 inline text-amber-500" /> {c.rating}</span>}
                  </div>
                  {c.services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.services.slice(0, 4).map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
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
        ))}
      </div>

      {centers.length === 0 && !loading && (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Ni najdenih servisov v tem območju</CardContent></Card>
      )}
    </div>
  )
}
