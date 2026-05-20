'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RefreshCw,
  MapPin,
  Route as RouteIcon,
  Navigation,
  Loader2,
  Zap,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Gauge,
  Clock,
  Spline,
  ChevronRight,
  Mountain,
  TreePine,
  Route as RoadIcon,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

type Direction = 'north' | 'east' | 'south' | 'west' | 'auto'
type RouteType = 'asfalt' | 'makadam' | 'mesano'

interface WaypointV2 {
  name: string
  lat: number
  lng: number
  distanceFromPrev: number
  cumulativeDistance: number
}

interface RoundTripV2Result {
  waypoints: WaypointV2[]
  totalDistance: number
  totalDistanceKm: number
  estimatedDuration: number
  estimatedDurationMin: number
  twistinessScore: number
  outboundReturnSeparation: number
  direction: string
  directionLabel: string
  directionAngle: number
  type: string
  typeLabel: string
  avoidHighways: boolean
  algorithm: string
  antiBacktrackGuarantee: boolean
  generatedAt: string
}

interface RoundTripGeneratorV2Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (waypoints: Array<{ lat: number; lng: number }>) => void
  startLat?: number
  startLng?: number
}

// ─── Config options ──────────────────────────────────────────────────────────

const DISTANCE_OPTIONS = [30, 50, 80, 100, 150, 200]

const DIRECTION_OPTIONS: Array<{ id: Direction; label: string; icon: React.ReactNode; desc: string }> = [
  { id: 'auto', label: 'Samodejno', icon: <Zap className="h-4 w-4" />, desc: 'Najbolj vijugasta smer' },
  { id: 'north', label: 'Sever', icon: <Navigation className="h-4 w-4 rotate-[-45deg]" />, desc: 'Gorski prelazi' },
  { id: 'east', label: 'Vzhod', icon: <Navigation className="h-4 w-4 rotate-[45deg]" />, desc: 'Panonske gričevje' },
  { id: 'south', label: 'Jug', icon: <Navigation className="h-4 w-4 rotate-[135deg]" />, desc: 'Obalne ceste' },
  { id: 'west', label: 'Zahod', icon: <Navigation className="h-4 w-4 rotate-[-135deg]" />, desc: 'Kraška ceste' },
]

const TYPE_OPTIONS: Array<{ id: RouteType; label: string; icon: React.ReactNode; desc: string }> = [
  { id: 'asfalt', label: 'Asfalt', icon: <RoadIcon className="h-4 w-4" />, desc: 'Pločniki in asfaltirane ceste' },
  { id: 'makadam', label: 'Makadam', icon: <Mountain className="h-4 w-4" />, desc: 'Gozdne poti in makadam' },
  { id: 'mesano', label: 'Mešano', icon: <TreePine className="h-4 w-4" />, desc: 'Kombinacija obojega' },
]

const TWISTINESS_LABELS = [
  { emoji: '➡️', label: 'Direktno', desc: 'Kar se da naravnost' },
  { emoji: '↗️', label: 'Rahlo', desc: 'Nekaj ovinkov' },
  { emoji: '↪️', label: 'Zmerno', desc: 'Uravnotežena vijugavost' },
  { emoji: '🌀', label: 'Vijugasto', desc: 'Veliko ovinkov' },
  { emoji: '🏎️', label: 'Ekstremno', desc: 'Največ zavojev' },
]

// ─── Haversine for mini-map preview ──────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoundTripGeneratorV2({
  isOpen,
  onClose,
  onConfirm,
  startLat = 46.0569,
  startLng = 14.5058,
}: RoundTripGeneratorV2Props) {
  // Parameters
  const [distance, setDistance] = useState(80)
  const [twistiness, setTwistiness] = useState(3)
  const [direction, setDirection] = useState<Direction>('auto')
  const [routeType, setRouteType] = useState<RouteType>('asfalt')
  const [avoidHighways, setAvoidHighways] = useState(false)

  // State
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<RoundTripV2Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Generate
  const generate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/round-trip-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startLat,
          startLng,
          distance,
          twistiness,
          direction,
          type: routeType,
          avoidHighways,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Napaka strežnika (${res.status})`)
      }
      const json = await res.json()
      const data: RoundTripV2Result = json.data
      setResult(data)
      toast.success(`Krožna tura v2 ustvarjena: ${data.totalDistanceKm} km`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Napaka pri generiranju ture'
      setError(msg)
      toast.error('Napaka pri generiranju ture', { description: msg })
    } finally {
      setIsGenerating(false)
    }
  }, [startLat, startLng, distance, twistiness, direction, routeType, avoidHighways])

  // Regenerate (same params, new random offsets)
  const regenerate = useCallback(() => {
    generate()
  }, [generate])

  // Confirm: load waypoints into plan tab
  const handleConfirm = useCallback(() => {
    if (!result || result.waypoints.length < 2) {
      toast.error('Najprej generirajte turo')
      return
    }
    // Convert to simple lat/lng array (exclude the final "Konec" point that duplicates start)
    const wps = result.waypoints.slice(0, -1).map(wp => ({
      lat: wp.lat,
      lng: wp.lng,
    }))
    onConfirm(wps)
    onClose()
    toast.success(`${wps.length} točk naloženih v Načrtuj`)
  }, [result, onConfirm, onClose])

  // Estimated stats from current params (before generation)
  const estimatedRadiusKm = useMemo(() => {
    const twistinessFactor = 1.0 - (twistiness - 1) * 0.06
    return (distance / (2 * Math.PI)) * twistinessFactor
  }, [distance, twistiness])

  // Mini-map SVG: draw waypoints as a circle preview
  const miniMapSvg = useMemo(() => {
    if (!result || result.waypoints.length < 2) return null

    const wps = result.waypoints
    const lats = wps.map(w => w.lat)
    const lngs = wps.map(w => w.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const padding = 0.15
    const latRange = (maxLat - minLat) || 0.01
    const lngRange = (maxLng - minLng) || 0.01

    const svgW = 280
    const svgH = 180

    const toSvgX = (lng: number) =>
      ((lng - minLng) / lngRange) * svgW * (1 - 2 * padding) + svgW * padding
    const toSvgY = (lat: number) =>
      svgH - (((lat - minLat) / latRange) * svgH * (1 - 2 * padding) + svgH * padding)

    const mid = Math.floor(wps.length / 2)

    return (
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-40 rounded-lg border border-border/50 bg-secondary/30">
        {/* Outbound path (green) */}
        <polyline
          points={wps.slice(0, mid + 1).map(w => `${toSvgX(w.lng)},${toSvgY(w.lat)}`).join(' ')}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Return path (blue) */}
        <polyline
          points={wps.slice(mid).map(w => `${toSvgX(w.lng)},${toSvgY(w.lat)}`).join(' ')}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeDasharray="6 3"
        />
        {/* Waypoint dots */}
        {wps.map((w, i) => {
          const isStart = i === 0
          const isEnd = i === wps.length - 1
          const isMid = i === mid
          return (
            <g key={i}>
              <circle
                cx={toSvgX(w.lng)}
                cy={toSvgY(w.lat)}
                r={isStart || isEnd ? 6 : isMid ? 5 : 3.5}
                fill={isStart || isEnd ? '#ef4444' : isMid ? '#f59e0b' : '#6b7280'}
                stroke="white"
                strokeWidth="1.5"
              />
              {/* Number label */}
              {i > 0 && i < wps.length - 1 && (
                <text
                  x={toSvgX(w.lng)}
                  y={toSvgY(w.lat) - 8}
                  textAnchor="middle"
                  fontSize="8"
                  fill="currentColor"
                  fontWeight="bold"
                >
                  {i}
                </text>
              )}
              {isStart && (
                <text
                  x={toSvgX(w.lng)}
                  y={toSvgY(w.lat) + 14}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#ef4444"
                  fontWeight="bold"
                >
                  START
                </text>
              )}
            </g>
          )
        })}
        {/* Legend */}
        <line x1="10" y1={svgH - 12} x2="25" y2={svgH - 12} stroke="#22c55e" strokeWidth="2" />
        <text x="28" y={svgH - 9} fontSize="7" fill="currentColor">Tja</text>
        <line x1="50" y1={svgH - 12} x2="65" y2={svgH - 12} stroke="#3b82f6" strokeWidth="2" strokeDasharray="3 2" />
        <text x="68" y={svgH - 9} fontSize="7" fill="currentColor">Nazaj</text>
      </svg>
    )
  }, [result])

  // Format duration
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}min`
    return `${m} min`
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-5 w-5 text-emerald-500" />
            Krožna tura v2
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/50 text-emerald-600">
              Izboljšano
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Izboljšan algoritem zagotavlja različno pot tja in nazaj — brez vračanja po isti cesti!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Starting point */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary/30 rounded-md px-3 py-2">
            <MapPin className="size-3.5 shrink-0" />
            <span>Začetek: {startLat.toFixed(4)}, {startLng.toFixed(4)}</span>
          </div>

          {/* Distance selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <RouteIcon className="h-4 w-4 text-muted-foreground" />
                Razdalja
              </span>
              <span className="text-sm font-bold text-primary">{distance} km</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DISTANCE_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDistance(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                    distance === d
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                      : 'border-border hover:border-emerald-500/50 text-muted-foreground'
                  }`}
                >
                  {d} km
                </button>
              ))}
            </div>
          </div>

          {/* Twistiness slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Spline className="h-4 w-4 text-muted-foreground" />
                Vijugavost
              </span>
              <span className="text-sm font-medium">
                {TWISTINESS_LABELS[twistiness - 1].emoji} {TWISTINESS_LABELS[twistiness - 1].label}
              </span>
            </div>
            <Slider
              value={[twistiness]}
              onValueChange={(v) => setTwistiness(v[0])}
              min={1}
              max={5}
              step={1}
              className="py-1"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Direktno</span>
              <span>Zmerno</span>
              <span>Ekstremno</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{TWISTINESS_LABELS[twistiness - 1].desc}</p>
          </div>

          {/* Direction selector */}
          <div className="space-y-2">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              Smer
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {DIRECTION_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDirection(opt.id)}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-md border transition-all ${
                    direction === opt.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                      : 'border-border hover:border-emerald-500/50 text-muted-foreground'
                  }`}
                  title={opt.desc}
                >
                  {opt.icon}
                  <span className="text-[9px] font-medium leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              {DIRECTION_OPTIONS.find(d => d.id === direction)?.desc}
            </p>
          </div>

          {/* Route type selector */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Tip ceste</span>
            <div className="grid grid-cols-3 gap-1.5">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setRouteType(opt.id)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-md border transition-all ${
                    routeType === opt.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                      : 'border-border hover:border-emerald-500/50 text-muted-foreground'
                  }`}
                  title={opt.desc}
                >
                  {opt.icon}
                  <span className="text-[10px] font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Avoid highways toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-amber-500" />
              <div>
                <span className="text-sm font-medium">Izogibaj avtocestam</span>
                <p className="text-[10px] text-muted-foreground">Izogibaj glavnim cestam</p>
              </div>
            </div>
            <Switch
              checked={avoidHighways}
              onCheckedChange={setAvoidHighways}
            />
          </div>

          {/* Pre-generation estimate */}
          {!result && (
            <div className="rounded-lg bg-muted/50 border border-border/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Predviden polmer ture: <span className="font-medium text-foreground">{estimatedRadiusKm.toFixed(1)} km</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Točk na obodu: {Math.min(6, Math.max(3, 2 + twistiness))} + začetek + konec
              </p>
            </div>
          )}

          {/* Generate / Regenerate buttons */}
          <div className="flex gap-2">
            <Button
              onClick={generate}
              disabled={isGenerating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ustvarjam turo...
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
                onClick={regenerate}
                className="gap-1"
                title="Ponovno generiraj z novimi odmiki"
              >
                <RefreshCw className="size-4" />
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
              <Separator />

              {/* Anti-backtrack guarantee badge */}
              <div className={`flex items-center gap-2 rounded-lg p-3 ${
                result.antiBacktrackGuarantee
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-amber-500/10 border border-amber-500/20'
              }`}>
                <ShieldCheck className={`h-5 w-5 ${
                  result.antiBacktrackGuarantee ? 'text-emerald-500' : 'text-amber-500'
                }`} />
                <div>
                  <span className={`text-xs font-semibold ${
                    result.antiBacktrackGuarantee ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {result.antiBacktrackGuarantee
                      ? 'Različna pot tja in nazaj ✓'
                      : 'Poti se delno prekrivajo'}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Razdalja med vhodno in povratno potjo: {(result.outboundReturnSeparation / 1000).toFixed(1)} km
                  </p>
                </div>
              </div>

              {/* Mini-map preview */}
              {miniMapSvg}

              {/* Route stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center rounded-md bg-muted/50 p-3">
                  <RouteIcon className="h-4 w-4 text-muted-foreground mb-1" />
                  <span className="text-sm font-bold">{result.totalDistanceKm} km</span>
                  <span className="text-[10px] text-muted-foreground">Razdalja</span>
                </div>
                <div className="flex flex-col items-center rounded-md bg-muted/50 p-3">
                  <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                  <span className="text-sm font-bold">{formatDuration(result.estimatedDuration)}</span>
                  <span className="text-[10px] text-muted-foreground">Trajanje</span>
                </div>
                <div className="flex flex-col items-center rounded-md bg-muted/50 p-3">
                  <Gauge className="h-4 w-4 text-muted-foreground mb-1" />
                  <span className="text-sm font-bold">{result.twistinessScore}/10</span>
                  <span className="text-[10px] text-muted-foreground">Vijugavost</span>
                </div>
                <div className="flex flex-col items-center rounded-md bg-muted/50 p-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mb-1" />
                  <span className="text-sm font-bold">{result.waypoints.length - 2}</span>
                  <span className="text-[10px] text-muted-foreground">Vmesne točke</span>
                </div>
              </div>

              {/* Direction & type badges */}
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  <Navigation className="h-3 w-3 mr-1" />
                  {result.directionLabel} ({result.directionAngle}°)
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {result.typeLabel}
                </Badge>
                {result.avoidHighways && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                    Brez avtocest
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {result.algorithm}
                </Badge>
              </div>

              {/* Waypoints list */}
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Točke poti</span>
                <ScrollArea className="max-h-36">
                  <div className="space-y-1">
                    {result.waypoints.map((wp, i) => {
                      const isStart = i === 0
                      const isEnd = i === result.waypoints.length - 1
                      const isMid = i === Math.floor(result.waypoints.length / 2)
                      return (
                        <div key={i} className={`flex items-center gap-2 text-xs rounded px-2 py-1.5 ${
                          isStart || isEnd ? 'bg-emerald-500/10' : isMid ? 'bg-amber-500/10' : 'bg-secondary/50'
                        }`}>
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            isStart || isEnd ? 'bg-emerald-500' : isMid ? 'bg-amber-500' : 'bg-muted-foreground/40'
                          }`} />
                          <span className="font-medium min-w-[60px]">
                            {isStart ? 'START' : isEnd ? 'CILJ' : wp.name}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                          </span>
                          {wp.distanceFromPrev > 0 && (
                            <span className="ml-auto text-[10px] font-medium text-muted-foreground">
                              +{(wp.distanceFromPrev / 1000).toFixed(1)} km
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Segment distances */}
              <div className="rounded-lg border border-border p-3">
                <span className="text-xs font-medium mb-2 block">Razdalje po odsekih</span>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {result.waypoints.slice(1).map((wp, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">
                        {result.waypoints[i].name} → {wp.name}
                      </span>
                      <span className="font-medium">{(wp.distanceFromPrev / 1000).toFixed(1)} km</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm button */}
              <Button
                onClick={handleConfirm}
                className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                disabled={isGenerating}
              >
                <ChevronRight className="h-4 w-4" />
                Naloži v Načrtuj
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
