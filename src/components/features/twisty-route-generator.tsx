'use client'

import React, { useState } from 'react'
import { GitBranch, RefreshCw, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function TwistyRouteGenerator({ userId, onSave }: { userId?: string; onSave?: (waypoints: { lat: number; lng: number }[]) => void }) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ waypoints: { lat: number; lng: number }[]; distance: number; corners: number; twistinessScore: number } | null>(null)
  const [distance, setDistance] = useState('medium')
  const [difficulty, setDifficulty] = useState('medium')

  const generate = async () => {
    setGenerating(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      ).catch(() => ({ coords: { latitude: 46.15, longitude: 14.99 } }))

      const res = await fetch(`/api/twisty-route?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&distance=${distance}&difficulty=${difficulty}`)
      const j = await res.json()
      if (j.data) {
        setResult(j.data)
        toast.success(`Vijugasta pot: ${j.data.distance} km, ${j.data.corners} ovinkov`)
      }
    } catch { toast.error('Napaka pri generiranju') }
    setGenerating(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><GitBranch className="size-5 text-amber-500" /><h3 className="font-bold">Vijugasta pot</h3></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Razdalja</Label>
          <Select value={distance} onValueChange={setDistance}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Kratka (&lt;50km)</SelectItem>
              <SelectItem value="medium">Srednja (50-150km)</SelectItem>
              <SelectItem value="long">Dolga (150+km)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Zahtevnost</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Lahko</SelectItem>
              <SelectItem value="medium">Srednje</SelectItem>
              <SelectItem value="hard">Težko</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button className="w-full gap-2" onClick={generate} disabled={generating}>
        <RefreshCw className={`size-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? 'Generiram...' : 'Generiraj vijugasto pot'}
      </Button>
      {result && (
        <div className="bg-amber-500/10 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-bold text-amber-500">{result.distance}</p><p className="text-[10px] text-muted-foreground">km</p></div>
            <div><p className="text-lg font-bold text-amber-500">{result.corners}</p><p className="text-[10px] text-muted-foreground">ovinkov</p></div>
            <div><p className="text-lg font-bold text-amber-500">{result.twistinessScore}</p><p className="text-[10px] text-muted-foreground">vinjenost</p></div>
          </div>
          {onSave && <Button size="sm" className="w-full gap-1" onClick={() => onSave(result.waypoints)}><MapPin className="size-3" /> Shrani kot pot</Button>}
        </div>
      )}
    </div>
  )
}
