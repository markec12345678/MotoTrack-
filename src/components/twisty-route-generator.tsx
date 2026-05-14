'use client'

import React, { useState, useCallback } from 'react'
import { GitBranch, MapPin, Loader2, Save, Zap, Gauge, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface TwistyRouteGeneratorProps {
  userId: string
  onRouteGenerated: (waypoints: Array<{ lat: number; lng: number }>) => void
  startLat?: number
  startLng?: number
}

interface TwistyRouteResult {
  waypoints: Array<{ lat: number; lng: number }>
  distance: number
  curvesCount: number
  totalAngleChange: number
  difficulty: string
}

const DISTANCE_OPTIONS = [
  { key: 'short', label: 'Kratka', desc: '< 50 km', icon: '🛣️' },
  { key: 'medium', label: 'Srednja', desc: '50-150 km', icon: '🛤️' },
  { key: 'long', label: 'Dolga', desc: '150+ km', icon: '🛤️🛤️' },
]

const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: 'Lahko', desc: 'Rahle krivine', color: 'text-green-500', border: 'border-green-500/30' },
  { key: 'medium', label: 'Srednje', desc: 'Zavite ceste', color: 'text-amber-500', border: 'border-amber-500/30' },
  { key: 'hard', label: 'Težko', desc: 'Izrazite krivine', color: 'text-red-500', border: 'border-red-500/30' },
]

export default function TwistyRouteGenerator({
  userId, onRouteGenerated, startLat, startLng,
}: TwistyRouteGeneratorProps) {
  const [distance, setDistance] = useState('medium')
  const [difficulty, setDifficulty] = useState('medium')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<TwistyRouteResult | null>(null)
  const [useCurrentLocation, setUseCurrentLocation] = useState(true)

  const generateRoute = useCallback(async () => {
    setGenerating(true)
    setResult(null)

    try {
      let lat = startLat || 46.15
      let lng = startLng || 14.99

      if (useCurrentLocation && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          })
          lat = pos.coords.latitude
          lng = pos.coords.longitude
        } catch {
          // Use default
        }
      }

      const res = await fetch('/api/twisty-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startLat: lat, startLng: lng, distance, difficulty }),
      })

      if (res.ok) {
        const j = await res.json()
        setResult(j.data)
        onRouteGenerated(j.data.waypoints)
        toast.success(`Vijugasta pot generirana! ${j.data.curvesCount} krivin, ${j.data.distance} km`)
      } else {
        toast.error('Napaka pri generiranju poti')
      }
    } catch {
      toast.error('Napaka pri generiranju poti')
    } finally {
      setGenerating(false)
    }
  }, [startLat, startLng, distance, difficulty, useCurrentLocation, onRouteGenerated])

  const saveRoute = async () => {
    if (!result || !userId) return
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Vijugasta pot ${new Date().toLocaleDateString('sl-SI')}`,
          description: `${result.curvesCount} krivin · Skupni kot: ${result.totalAngleChange}° · ${result.difficulty === 'easy' ? 'Lahka' : result.difficulty === 'medium' ? 'Srednja' : 'Zahtevna'}`,
          distance: result.distance,
          waypoints: JSON.stringify(result.waypoints),
          routeData: JSON.stringify(result.waypoints.map((w: { lat: number; lng: number }) => [w.lat, w.lng])),
          category: 'twisty',
          difficulty: result.difficulty,
          isPublic: true,
          userId,
        }),
      })
      if (res.ok) {
        toast.success('Vijugasta pot shranjena!')
      } else {
        toast.error('Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri shranjevanju')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GitBranch className="size-5 text-amber-500" />
        <h3 className="font-bold text-sm">Vijugasta pot</h3>
      </div>

      {/* Starting point */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Izhodišče</label>
        <div className="flex gap-2">
          <Button
            variant={useCurrentLocation ? 'default' : 'outline'}
            size="sm"
            className="text-xs flex-1"
            onClick={() => setUseCurrentLocation(true)}
          >
            <MapPin className="size-3 mr-1" /> Trenutna lokacija
          </Button>
          <Button
            variant={!useCurrentLocation ? 'default' : 'outline'}
            size="sm"
            className="text-xs flex-1"
            onClick={() => setUseCurrentLocation(false)}
          >
            <MapPin className="size-3 mr-1" /> Klik na zemljevid
          </Button>
        </div>
      </div>

      {/* Distance */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Razdalja</label>
        <div className="grid grid-cols-3 gap-2">
          {DISTANCE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`p-2 rounded-lg border text-center transition-all ${
                distance === opt.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40'
              }`}
              onClick={() => setDistance(opt.key)}
            >
              <span className="text-sm block">{opt.icon}</span>
              <span className="text-xs font-medium block">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground block">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Zahtevnost</label>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTY_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`p-2 rounded-lg border text-center transition-all ${
                difficulty === opt.key
                      ? `${opt.border} bg-secondary/30 ${opt.color}`
                  : 'border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40'
              }`}
              onClick={() => setDifficulty(opt.key)}
            >
              <span className="text-xs font-medium block">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground block">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
        onClick={generateRoute}
        disabled={generating}
      >
        {generating ? (
          <><Loader2 className="size-4 animate-spin" /> Generiram...</>
        ) : (
          <><Zap className="size-4" /> Generiraj vijugasto pot</>
        )}
      </Button>

      {/* Result stats */}
      {result && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-amber-500">{result.curvesCount}</p>
              <p className="text-[10px] text-muted-foreground">Krivin</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-500">{result.distance}</p>
              <p className="text-[10px] text-muted-foreground">km</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-500">{result.totalAngleChange}°</p>
              <p className="text-[10px] text-muted-foreground">Skupni kot</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 text-xs gap-1" onClick={saveRoute}>
              <Save className="size-3" /> Shrani pot
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={generateRoute} disabled={generating}>
              <RotateCcw className="size-3" /> Nova pot
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
