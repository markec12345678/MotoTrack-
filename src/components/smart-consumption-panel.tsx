'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Fuel, Gauge, TrendingUp, Lightbulb, Calculator, Bike, Droplets, Route } from 'lucide-react'
import { toast } from 'sonner'

// ─── Slovenian labels ───────────────────────────────────────────────────
const BIKE_CATEGORIES: Record<string, string> = {
  scooter: '🛵 Skuter',
  naked: '🏍️ Golo',
  sport: '🏎️ Športno',
  touring: '🛣️ Turistično',
  adventure: '🏔️ Pustolovsko',
  cruiser: '🆒 Križar',
}

const RIDING_STYLES: Record<string, string> = {
  calm: '😌 Miren',
  normal: '👍 Običajen',
  sporty: '🔥 Športen',
  aggressive: '😤 Agresiven',
}

const STYLE_COLORS: Record<string, string> = {
  calm: 'bg-green-500',
  normal: 'bg-blue-500',
  sporty: 'bg-orange-500',
  aggressive: 'bg-red-500',
}

const STYLE_COMPARISON_LABELS: Record<string, string> = {
  calm: 'Miren',
  normal: 'Običajen',
  sporty: 'Športen',
  aggressive: 'Agresiven',
}

interface SmartConsumptionData {
  baseConsumption: number
  adjustedConsumption: number
  factors: Record<string, { name: string; value: string; factor: number }>
  estimatedRange: number
  fuelCapacity: number
  currentFuel: number
  estimatedCost: number | null
  tips: string[]
  comparison: Record<string, number>
  bikeCategory: string
  ridingStyle: string
  engineDisplacement: number
}

interface SmartConsumptionPanelProps {
  userId?: string
  bikeCategory?: string
  ridingStyle?: string
  engineDisplacement?: number
  fuelPrice?: number
}

export default function SmartConsumptionPanel({
  userId,
  bikeCategory: initialCategory,
  ridingStyle: initialStyle,
  engineDisplacement: initialDisplacement,
}: SmartConsumptionPanelProps) {
  const [bikeCategory, setBikeCategory] = useState(initialCategory || 'naked')
  const [ridingStyle, setRidingStyle] = useState(initialStyle || 'normal')
  const [engineDisplacement, setEngineDisplacement] = useState(initialDisplacement || 600)
  const [avgSpeed, setAvgSpeed] = useState<string>('')
  const [elevation, setElevation] = useState<string>('')
  const [distance, setDistance] = useState<string>('')

  const [data, setData] = useState<SmartConsumptionData | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch smart consumption data
  const fetchCalculation = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        bikeCategory,
        ridingStyle,
        engineDisplacement: String(engineDisplacement),
      })
      if (avgSpeed) params.set('avgSpeed', avgSpeed)
      if (elevation) params.set('elevation', elevation)
      if (distance) params.set('distance', distance)
      if (userId) params.set('userId', userId)

      const res = await fetch(`/api/smart-consumption?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      } else {
        toast.error('Napaka pri izračunu porabe')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
    setLoading(false)
  }, [bikeCategory, ridingStyle, engineDisplacement, avgSpeed, elevation, distance, userId])

  // Auto-calculate when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCalculation()
    }, 300) // debounce
    return () => clearTimeout(timer)
  }, [bikeCategory, ridingStyle, engineDisplacement, avgSpeed, elevation, distance, userId, fetchCalculation])

  // Consumption level gauge (0-10 L/100km scale)
  const consumptionLevel = data ? Math.min((data.adjustedConsumption / 10) * 100, 100) : 0
  const consumptionColor = consumptionLevel < 35 ? 'text-green-500' : consumptionLevel < 65 ? 'text-amber-500' : 'text-red-500'
  const consumptionBg = consumptionLevel < 35 ? 'bg-green-500' : consumptionLevel < 65 ? 'bg-amber-500' : 'bg-red-500'

  // Max comparison value for bar chart
  const maxComparison = data ? Math.max(...Object.values(data.comparison)) : 10

  return (
    <Card className="border-orange-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-5 w-5 text-orange-500" />
          Pametna poraba
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Izračun porabe goriva na podlagi voznenega sloga in modela motocikla
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input section */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Bike className="size-3" /> Kategorija motocikla
            </Label>
            <Select value={bikeCategory} onValueChange={setBikeCategory}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BIKE_CATEGORIES).map(([key, label]) => (
                  <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Gauge className="size-3" /> Vozni slog
            </Label>
            <Select value={ridingStyle} onValueChange={setRidingStyle}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RIDING_STYLES).map(([key, label]) => (
                  <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Prostornina motorja (cc)</Label>
            <Input
              type="number"
              value={engineDisplacement}
              onChange={e => setEngineDisplacement(parseInt(e.target.value) || 600)}
              className="h-8 text-xs"
              placeholder="npr. 600"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Povprečna hitrost (km/h)</Label>
            <Input
              type="number"
              value={avgSpeed}
              onChange={e => setAvgSpeed(e.target.value)}
              className="h-8 text-xs"
              placeholder="neobvezno"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Vzpon (m)</Label>
            <Input
              type="number"
              value={elevation}
              onChange={e => setElevation(e.target.value)}
              className="h-8 text-xs"
              placeholder="neobvezno"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Razdalja (km)</Label>
            <Input
              type="number"
              value={distance}
              onChange={e => setDistance(e.target.value)}
              className="h-8 text-xs"
              placeholder="neobvezno"
            />
          </div>
        </div>

        {/* Loading state */}
        {loading && !data && (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Izračunavam...</span>
          </div>
        )}

        {/* Results section */}
        {data && (
          <>
            {/* Main result */}
            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Ocenjena poraba</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold ${consumptionColor}`}>
                      {data.adjustedConsumption.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">L/100km</span>
                  </div>
                </div>
                <div className="w-16 h-16 relative">
                  {/* Circular gauge */}
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" className="stroke-muted/30" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="14" fill="none"
                      className={consumptionLevel < 35 ? 'stroke-green-500' : consumptionLevel < 65 ? 'stroke-amber-500' : 'stroke-red-500'}
                      strokeWidth="3"
                      strokeDasharray={`${consumptionLevel * 0.88} 88`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Fuel className={`size-5 ${consumptionColor}`} />
                  </div>
                </div>
              </div>

              {/* Consumption bar */}
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${consumptionBg}`}
                    style={{ width: `${consumptionLevel}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Varčno</span>
                  <span>Normalno</span>
                  <span>Visoko</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <Route className="size-3.5 mx-auto text-blue-500 mb-1" />
                <p className="text-sm font-bold">{data.estimatedRange}</p>
                <p className="text-[9px] text-muted-foreground">km doseg</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <Droplets className="size-3.5 mx-auto text-emerald-500 mb-1" />
                <p className="text-sm font-bold">{data.currentFuel.toFixed(1)}L</p>
                <p className="text-[9px] text-muted-foreground">trenutno</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <Fuel className="size-3.5 mx-auto text-orange-500 mb-1" />
                <p className="text-sm font-bold">{data.fuelCapacity.toFixed(0)}L</p>
                <p className="text-[9px] text-muted-foreground">kapaciteta</p>
              </div>
            </div>

            {/* Estimated cost (if distance provided) */}
            {data.estimatedCost !== null && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 flex items-center justify-between">
                <span className="text-xs">Ocenjeni strošek goriva</span>
                <span className="text-base font-bold text-emerald-500">{data.estimatedCost.toFixed(2)} €</span>
              </div>
            )}

            {/* Factors breakdown */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Dejavniki porabe</p>
              <div className="space-y-1">
                {Object.entries(data.factors).map(([key, factor]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{factor.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{factor.value}</span>
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 h-4 ${
                        factor.factor > 1.1 ? 'text-red-500 border-red-500/30' :
                        factor.factor < 0.9 ? 'text-green-500 border-green-500/30' :
                        'text-muted-foreground'
                      }`}>
                        ×{factor.factor.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparison by riding style */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Primerjava po voznenem slogu
              </p>
              <div className="space-y-1.5">
                {Object.entries(data.comparison).map(([style, consumption]) => {
                  const isActive = style === ridingStyle
                  const barWidth = maxComparison > 0 ? (consumption / maxComparison) * 100 : 0
                  return (
                    <div key={style} className={`flex items-center gap-2 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                      <span className="text-[10px] w-16 text-muted-foreground shrink-0">
                        {STYLE_COMPARISON_LABELS[style] || style}
                      </span>
                      <div className="flex-1 h-5 bg-muted/50 rounded overflow-hidden relative">
                        <div
                          className={`h-full rounded transition-all duration-500 ${STYLE_COLORS[style]} ${
                            isActive ? 'opacity-80' : 'opacity-40'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                        <span className="absolute inset-y-0 right-1.5 flex items-center text-[10px] font-bold">
                          {consumption.toFixed(1)} L
                        </span>
                      </div>
                      {isActive && (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[8px] px-1 py-0 h-4">
                          Trenutni
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tips */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Lightbulb className="size-3" /> Namigi za zmanjšanje porabe
              </p>
              <div className="space-y-1">
                {data.tips.slice(0, 4).map((tip, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="text-amber-500 shrink-0 mt-0.5">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Calculate button */}
        <Button
          className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white h-8 text-xs"
          onClick={fetchCalculation}
          disabled={loading}
        >
          <Calculator className="size-3.5" />
          {loading ? 'Izračunavam...' : 'Izračunaj porabo'}
        </Button>
      </CardContent>
    </Card>
  )
}
