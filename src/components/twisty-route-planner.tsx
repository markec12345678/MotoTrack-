'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { TwistyRouteResult } from '@/components/tabs/types'
import {
  Waypoints,
  Route as RouteIcon,
  Clock,
  Gauge,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'

interface TwistyRoutePlannerProps {
  userId?: string
  onGenerate?: (curviness: number, avoidHighways: boolean) => void
  onRouteGenerated?: (waypoints: Array<{ lat: number; lng: number }>) => void
  result?: TwistyRouteResult | null
}

const CURVINESS_LABELS = ['Ravno', 'Rahlo vijugasto', 'Vijugasto', 'Zelo vijugasto', 'Ekstremno vijugasto']
const CURVINESS_EMOJIS = ['➡️', '↗️', '↪️', '🌀', '🏎️']

export default function TwistyRoutePlanner({ userId, onGenerate, onRouteGenerated, result }: TwistyRoutePlannerProps) {
  const [curviness, setCurviness] = useState(3)
  const [avoidHighways, setAvoidHighways] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/twisty-route?curviness=${curviness}&avoidHighways=${avoidHighways}`)
      if (res.ok) {
        const j = await res.json()
        const waypoints = j.data?.waypoints || []
        if (waypoints.length > 0 && onRouteGenerated) {
          onRouteGenerated(waypoints)
        }
      }
    } catch {
      // fallback - just call onGenerate
    }
    onGenerate?.(curviness, avoidHighways)
    setIsGenerating(false)
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Waypoints className="h-5 w-5 text-amber-500" />
          Vijugasta ruta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Curviness slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Vijugavost</Label>
            <span className="text-sm font-medium flex items-center gap-1">
              {CURVINESS_EMOJIS[curviness - 1]} {CURVINESS_LABELS[curviness - 1]}
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
          <div className="flex justify-between text-[10px] text-muted-foreground px-1">
            {CURVINESS_EMOJIS.map((emoji, i) => (
              <span key={i} className={curviness === i + 1 ? 'text-amber-500 font-medium' : ''}>
                {emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Avoid highways toggle */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <RouteIcon className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm cursor-pointer">Izogibaj se avtocestam</Label>
          </div>
          <Switch
            checked={avoidHighways}
            onCheckedChange={setAvoidHighways}
          />
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-amber-600 hover:bg-amber-700 gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Isčem vijugasto ruto...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Ustvari vijugasto ruto
            </>
          )}
        </Button>

        {/* Route results */}
        {result && (
          <div className="space-y-3">
            {/* Twisty score */}
            <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <span className="text-sm font-medium">Vijugavost ocena</span>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {CURVINESS_EMOJIS[Math.min(Math.ceil(result.twistyScore / 2) - 1, 4)]}
                </Badge>
                <span className="text-lg font-bold text-amber-500">{result.twistyScore}/10</span>
              </div>
            </div>

            {/* Route stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                <RouteIcon className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs font-medium">{(result.totalDistance / 1000).toFixed(1)} km</span>
                <span className="text-[10px] text-muted-foreground">Razdalja</span>
              </div>
              <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs font-medium">{Math.round(result.estimatedDuration / 60)} min</span>
                <span className="text-[10px] text-muted-foreground">Trajanje</span>
              </div>
              <div className="flex flex-col items-center rounded-md bg-muted/50 p-2">
                <Gauge className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-xs font-medium">{result.curvinessReport.tightCurves}%</span>
                <span className="text-[10px] text-muted-foreground">Ostri zavoji</span>
              </div>
            </div>

            {/* Curve analysis toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full gap-1 text-xs"
            >
              Analiza zavojev
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>

            {showDetails && (
              <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span>Ravni odseki</span>
                  <span className="font-medium">{result.curvinessReport.straight}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gray-400 transition-all"
                    style={{ width: `${result.curvinessReport.straight}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs mt-2">
                  <span>Zavoji</span>
                  <span className="font-medium">{result.curvinessReport.curves}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${result.curvinessReport.curves}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs mt-2">
                  <span>Ostri zavoji</span>
                  <span className="font-medium">{result.curvinessReport.tightCurves}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${result.curvinessReport.tightCurves}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
