'use client'

import React, { useState, useEffect } from 'react'
import { Fuel, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

export default function FuelFinder({ userId }: { userId?: string }) {
  const [stations, setStations] = useState<any[]>([])
  const [fuelType, setFuelType] = useState('95')
  const [loading, setLoading] = useState(false)

  const fetchStations = async () => {
    setLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      ).catch(() => ({ coords: { latitude: 46.15, longitude: 14.99 } }))
      const res = await fetch(`/api/fuel-prices?fuelType=${fuelType}&lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
      const j = await res.json()
      if (j.data) setStations(j.data)
    } catch { toast.error('Napaka') }
    setLoading(false)
  }

  useEffect(() => { const doFetch = async () => { await fetchStations() }; doFetch() }, [fuelType])

  const priceColor = (price: number, min: number, max: number) => {
    if (max === min) return 'text-green-500'
    const ratio = (price - min) / (max - min)
    if (ratio < 0.33) return 'text-green-500'
    if (ratio < 0.66) return 'text-amber-500'
    return 'text-red-500'
  }

  const minPrice = stations.length > 0 ? Math.min(...stations.map(s => s.price)) : 0
  const maxPrice = stations.length > 0 ? Math.max(...stations.map(s => s.price)) : 1

  return (
    <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-80 max-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Fuel className="size-4 text-orange-500" /><span className="text-sm font-bold">Ceneno gorivo</span></div>
      </div>
      <div className="flex gap-1 mb-3">
        {['95', '98', 'diesel'].map(t => (
          <button key={t} onClick={() => setFuelType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${fuelType === t ? 'bg-orange-500 text-white' : 'bg-secondary text-muted-foreground'}`}>
            {t === 'diesel' ? 'Dizel' : t}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1 max-h-60">
        <div className="space-y-1.5">
          {stations.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${i === 0 ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}`}>#{i + 1}</Badge>
                  <p className="text-xs font-medium truncate">{s.name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground ml-7">{s.brand} · {s.distance} km</p>
              </div>
              <span className={`text-sm font-bold ${priceColor(s.price, minPrice, maxPrice)}`}>{s.price.toFixed(2)} €</span>
            </div>
          ))}
          {stations.length === 0 && !loading && <p className="text-xs text-muted-foreground text-center py-4">Nalagam...</p>}
        </div>
      </ScrollArea>
    </div>
  )
}
