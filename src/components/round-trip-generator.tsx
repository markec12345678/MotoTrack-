'use client'

import { useState } from 'react'
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
} from 'lucide-react'

interface RoundTripGeneratorProps {
  onGenerate?: (distance: number, direction: string, curviness: number) => void
  result?: RoundTripResult | null
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

export default function RoundTripGenerator({ onGenerate, result }: RoundTripGeneratorProps) {
  const [distance, setDistance] = useState(120)
  const [direction, setDirection] = useState('N')
  const [curviness, setCurviness] = useState(3)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    onGenerate?.(distance, direction, curviness)
    setIsGenerating(false)
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

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Ustvarjam ruto...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Ustvari krožno ruto
            </>
          )}
        </Button>

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
                <span className="text-xs font-medium">{Math.round(result.estimatedDuration / 60)} min</span>
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
