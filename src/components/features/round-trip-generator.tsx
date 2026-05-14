'use client'

import React, { useState } from 'react'
import { RefreshCw, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function RoundTripGenerator({ userId, onSave }: { userId?: string; onSave?: (waypoints: { lat: number; lng: number }[]) => void }) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ waypoints: { lat: number; lng: number }[]; distance: number } | null>(null)
  const [radius, setRadius] = useState(30)
  const [direction, setDirection] = useState('clockwise')

  const generate = async () => {
    setGenerating(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      ).catch(() => ({ coords: { latitude: 46.15, longitude: 14.99 } }))
      const res = await fetch(`/api/round-trip?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radius=${radius}&direction=${direction}`)
      const j = await res.json()
      if (j.data) {
        setResult(j.data)
        toast.success(`Krožna pot: ${j.data.distance} km`)
      }
    } catch { toast.error('Napaka') }
    setGenerating(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><RefreshCw className="size-5 text-primary" /><h3 className="font-bold">Krožna pot</h3></div>
      <div>
        <Label className="text-xs">Polmer: {radius} km</Label>
        <input type="range" min={10} max={200} value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-muted" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => setDirection('clockwise')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${direction === 'clockwise' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          ↻ V smeri urinega kazalca
        </button>
        <button onClick={() => setDirection('counterclockwise')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${direction === 'counterclockwise' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          ↺ Proti urinemu kazalcu
        </button>
      </div>
      <Button className="w-full gap-2" onClick={generate} disabled={generating}>
        <RefreshCw className={`size-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? 'Generiram...' : 'Generiraj krožno pot'}
      </Button>
      {result && (
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-center text-lg font-bold text-primary">{result.distance} km</p>
          <p className="text-center text-xs text-muted-foreground">Ocenjeni čas: ~{Math.round(result.distance / 50 * 60)} min</p>
          {onSave && <Button size="sm" className="w-full mt-2 gap-1" onClick={() => onSave(result.waypoints)}><MapPin className="size-3" /> Shrani kot pot</Button>}
        </div>
      )}
    </div>
  )
}
