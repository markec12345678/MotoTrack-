'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Fuel,
  Mountain,
  Waves,
  TreePine,
  LayoutGrid,
  Highway,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

interface RoundTripGeneratorProps {
  onGenerate?: (result: RoundTripResult) => void
  startLat?: number
  startLng?: number
}

type TerrainType = 'mixed' | 'mountain' | 'coastal' | 'forest'

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

const TERRAIN_OPTIONS: Array<{ id: TerrainType; label: string; icon: React.ReactNode; desc: string }> = [
  { id: 'mixed', label: 'Mešano', icon: <LayoutGrid className="h-4 w-4" />, desc: 'Uravnotežena ruta' },
  { id: 'mountain', label: 'Gorsko', icon: <Mountain className="h-4 w-4" />, desc: 'Gorski prelazi' },
  { id: 'coastal', label: 'Obalno', icon: <Waves className="h-4 w-4" />, desc: 'Obalne ceste' },
  { id: 'forest', label: 'Gozdno', icon: <TreePine className="h-4 w-4" />, desc: 'Gozdne poti' },
]

export default function RoundTripGenerator({ onGenerate, startLat = 46.05, startLng = 14.5 }: RoundTripGeneratorProps) {
  const [distance, setDistance] = useState(120)
  const [direction, setDirection] = useState('N')
  const [curviness, setCurviness] = useState(3)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<RoundTripResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [avoidSameRoad, setAvoidSameRoad] = useState(true)
  const [terrain, setTerrain] = useState<TerrainType>('mixed')
  const [avoidHighways, setAvoidHighways] = useState(false)

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
        avoidSameRoad: avoidSameRoad.toString(),
        terrain: terrain,
        avoidHighways: avoidHighways.toString(),
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
      toast.error('Napaka pri generiranju route', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setIsGenerating(false)
    }
  }, [startLat, startLng, distance, direction, curviness, avoidSameRoad, terrain, avoidHighways, onGenerate])

  const handleShuffle = useCallback(() => {
    const dirs = DIRECTIONS.map(d => d.id)
    let newDir = direction
    const otherDirs = dirs.filter(d => d !== direction)
    if (otherDirs.length > 0) {
      newDir = otherDirs[Math.floor(Math.random() * otherDirs.length)]
    }
    setDirection(newDir)
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

  // Format distance with km
  const formatKm = (meters: number): string => {
    return `${(meters / 1000).toFixed(1)} km`
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

        {/* Terrain Type Selector */}
        <div className="space-y-2">
          <span className="text-sm flex items-center gap-1">
            <Mountain className="h-4 w-4 text-muted-foreground" />
            Teren
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {TERRAIN_OPTIONS.map(t => (
              <button
                key={t.id}
                onClick={() => setTerrain(t.id)}
                className={`rounded-md border p-2 text-center transition-colors ${
                  terrain === t.id
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                    : 'border-border hover:border-emerald-500/50'
                }`}
                title={t.desc}
              >
                <div className="flex flex-col items-center gap-0.5">
                  {t.icon}
                  <span className="text-[9px] font-medium leading-tight">{t.label}</span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {TERRAIN_OPTIONS.find(t => t.id === terrain)?.desc}
          </p>
        </div>

        {/* Avoid Same Road Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <RouteIcon className="h-4 w-4 text-emerald-500" />
            <div>
              <span className="text-sm font-medium">Izogibaj isti cesti</span>
              <p className="text-[10px] text-muted-foreground">Različna pot tja in nazaj</p>
            </div>
          </div>
          <Switch
            checked={avoidSameRoad}
            onCheckedChange={setAvoidSameRoad}
          />
        </div>

        {/* Avoid Highways Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Highway className="h-4 w-4 text-amber-500" />
            <div>
              <span className="text-sm font-medium">Brez avtocest</span>
              <p className="text-[10px] text-muted-foreground">Izogibaj glavnim cestam</p>
            </div>
          </div>
          <Switch
            checked={avoidHighways}
            onCheckedChange={setAvoidHighways}
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
            {/* Avoid Same Road Badge */}
            {result.avoidSameRoad && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-600">Različna pot tja in nazaj ✓</span>
              </div>
            )}

            {/* Twisty Score */}
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Vijugavost ocena</span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {result.twistyScore}/10
                </Badge>
              </div>
            </div>

            {/* Stats grid */}
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

            {/* Fuel Estimate */}
            {result.fuelEstimate && (
              <div className={`rounded-lg border p-3 ${
                result.fuelEstimate.rangeOk
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Fuel className={`h-4 w-4 ${result.fuelEstimate.rangeOk ? 'text-amber-500' : 'text-red-500'}`} />
                  <span className="text-sm font-medium">Poraba goriva</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Potrebno</span>
                    <p className="text-sm font-medium">{result.fuelEstimate.litersNeeded} L</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Poraba</span>
                    <p className="text-sm font-medium">{result.fuelEstimate.consumptionPer100km} L/100km</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Rezerva</span>
                    <p className={`text-sm font-medium ${result.fuelEstimate.rangeOk ? 'text-emerald-600' : 'text-red-500'}`}>
                      {result.fuelEstimate.rangeRemaining > 0
                        ? `${result.fuelEstimate.rangeRemaining} km`
                        : 'Premalo!'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Rezervoar</span>
                    <p className="text-sm font-medium">{result.fuelEstimate.tankCapacity} L</p>
                  </div>
                </div>
                {!result.fuelEstimate.rangeOk && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    <span className="text-[10px] text-red-500 font-medium">
                      Ruta presega doseg rezervoarja — načrtujte postanek za gorivo!
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Segment Distances */}
            {result.segmentDistances && result.segmentDistances.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <span className="text-xs font-medium mb-2 block">Razdalje po odsekih</span>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.segmentDistances.map((seg, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">{seg.fromLabel} → {seg.toLabel}</span>
                      <span className="font-medium">{formatKm(seg.distanceMeters)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Ruta se vrne na izhodišče po vijugastih cestah
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
