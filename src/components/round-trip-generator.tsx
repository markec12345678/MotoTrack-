'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import type { RoundTripResult } from '@/components/tabs/types'
import {
  RotateCcw,
  Compass,
  Route as RouteIcon,
  Clock,
  Gauge,
  Spline,
  Loader2,
  Zap,
  Shuffle,
  MapPin,
} from 'lucide-react'
import { toast } from 'sonner'

interface RoundTripGeneratorProps {
  onGenerate?: (result: RoundTripResult) => void
  startLat?: number
  startLng?: number
}

const DIRECTIONS = [
  { id: 'N', label: 'S', full: 'Sever' },
  { id: 'NE', label: 'SV', full: 'Severovzhod' },
  { id: 'E', label: 'V', full: 'Vzhod' },
  { id: 'SE', label: 'JV', full: 'Jugovzhod' },
  { id: 'S', label: 'J', full: 'Jug' },
  { id: 'SW', label: 'JZ', full: 'Jugozahod' },
  { id: 'W', label: 'Z', full: 'Zahod' },
  { id: 'NW', label: 'SZ', full: 'Severozahod' },
]

export default function RoundTripGenerator({ onGenerate, startLat = 46.05, startLng = 14.5 }: RoundTripGeneratorProps) {
  const [distance, setDistance] = useState(120)
  const [direction, setDirection] = useState('N')
  const [curviness, setCurviness] = useState(3)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<RoundTripResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchRoundTrip = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        startLat: startLat.toString(),
        startLng: startLng.toString(),
        distance: distance.toString(),
        direction: direction,
        curviness: curviness.toString(),
      })
      const res = await fetch(`/api/round-trip?${params}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Napaka strežnika (${res.status})`)
      }
      const json = await res.json()
      const data: RoundTripResult = json.data
      setResult(data)
      onGenerate?.(data)
      toast.success(`Krožna ruta ustvarjena: ${Math.round(data.totalDistance / 1000)} km`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Napaka pri generiranju route')
      toast.error('Napaka pri generiranju route', { description: err.message })
    } finally {
      setIsGenerating(false)
    }
  }, [startLat, startLng, distance, direction, curviness, onGenerate])

  const handleShuffle = useCallback(() => {
    // Pick a random direction to get a different route
    const dirs = DIRECTIONS.map(d => d.id)
    let newDir = direction
    // Try to pick a different direction
    const otherDirs = dirs.filter(d => d !== direction)
    if (otherDirs.length > 0) {
      newDir = otherDirs[Math.floor(Math.random() * otherDirs.length)]
    }
    setDirection(newDir)
    // The fetchRoundTrip will use the new direction
    // We need to trigger after state update, so use a slight delay
    setTimeout(() => {
      fetchRoundTrip()
    }, 50)
  }, [direction, fetchRoundTrip])

  // Format duration nicely
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}min`
    return `${m} min`
  }

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <RotateCcw className="h-5 w-5 text-emerald-500" />
          Krožna ruta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Starting point info */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <MapPin className="size-3" />
          <span>Začetek: {startLat.toFixed(4)}, {startLng.toFixed(4)}</span>
        </div>

        {/* Distance slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Razdalja</span>
            <span className="text-sm font-medium">{distance} km</span>
          </div>
          <Slider
            value={[distance]}
            onValueChange={(v) => setDistance(v[0])}
            min={50}
            max={300}
            step={10}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>50 km</span>
            <span>300 km</span>
          </div>
        </div>

        {/* Direction compass */}
        <div className="space-y-2">
          <span className="text-sm flex items-center gap-1">
            <Compass className="h-4 w-4 text-muted-foreground" />
            Smer
          </span>
          <div className="grid grid-cols-4 gap-1.5 max-w-[200px] mx-auto">
            {DIRECTIONS.map(dir => (
              <button
                key={dir.id}
                onClick={() => setDirection(dir.id)}
                className={`rounded-md border p-2 text-center transition-colors ${
                  direction === dir.id
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                    : 'border-border hover:border-emerald-500/50'
                }`}
                title={dir.full}
              >
                <span className="text-xs font-medium">{dir.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {DIRECTIONS.find(d => d.id === direction)?.full}
          </p>
        </div>

        {/* Curviness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-1">
              <Spline className="h-4 w-4 text-muted-foreground" />
              Vijugavost
            </span>
            <span className="text-sm font-medium">
              {['➡️', '↗️', '↪️', '🌀', '🏎️'][curviness - 1]}
            </span>
          </div>
          <Slider
            value={[curviness]}
            onValueChange={(v) => setCurviness(v[0])}
            min={1}
            max={5}
            step={1}
            className="py-2"
          />
        </div>

        {/* Generate + Shuffle buttons */}
        <div className="flex gap-2">
          <Button
            onClick={fetchRoundTrip}
            disabled={isGenerating}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ustvarjam ruto...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Generiraj
              </>
            )}
          </Button>
          {result && !isGenerating && (
            <Button
              variant="outline"
              onClick={handleShuffle}
              className="gap-1"
              title="Ponovno generiraj z drugo smerjo"
            >
              <Shuffle className="size-4" />
            </Button>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}

        {/* Result preview */}
        {result && (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Vijugavost ocena</span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {result.twistyScore}/10
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                <RouteIcon className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs font-medium">{(result.totalDistance / 1000).toFixed(0)} km</span>
                <span className="text-[10px] text-muted-foreground">Razdalja</span>
              </div>
              <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs font-medium">{formatDuration(result.estimatedDuration)}</span>
                <span className="text-[10px] text-muted-foreground">Trajanje</span>
              </div>
              <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                <Gauge className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs font-medium">{result.waypoints.length}</span>
                <span className="text-[10px] text-muted-foreground">Točke</span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Ruta se vrne na izhodišče po vijugastih cestah
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
