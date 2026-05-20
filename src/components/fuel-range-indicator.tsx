'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Fuel, AlertTriangle, Gauge, MapPin, Navigation } from 'lucide-react'
import { toast } from 'sonner'

interface FuelRangeIndicatorProps {
  userId?: string
  currentSpeed?: number
  distance?: number
  unitSystem?: 'metric' | 'imperial'
}

export default function FuelRangeIndicator({
  userId,
  currentSpeed = 0,
  distance = 0,
  unitSystem = 'metric',
}: FuelRangeIndicatorProps) {
  const [fuelCapacity, setFuelCapacity] = useState(15)
  const [fuelConsumption, setFuelConsumption] = useState(5.5)
  const [currentFuel, setCurrentFuel] = useState(15)
  const [loading, setLoading] = useState(true)

  // Fetch fuel settings from user
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetch(`/api/smart-consumption?userId=${userId}`)
      .then(r => r.json())
      .then(j => {
        if (j.data) {
          setFuelCapacity(j.data.fuelCapacity ?? 15)
          setFuelConsumption(j.data.fuelConsumption ?? 5.5)
          setCurrentFuel(j.data.currentFuel ?? 15)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  // Calculate range
  const rangeKm = fuelConsumption > 0 ? (currentFuel / fuelConsumption) * 100 : 0
  const rangeMi = rangeKm * 0.621371
  const range = unitSystem === 'imperial' ? rangeMi : rangeKm
  const rangeUnit = unitSystem === 'imperial' ? 'mi' : 'km'
  
  // Fuel percentage
  const fuelPct = fuelCapacity > 0 ? (currentFuel / fuelCapacity) * 100 : 0
  
  // Range status
  const isCritical = rangeKm < 30
  const isLow = rangeKm < 80
  const isWarning = rangeKm < 150

  // Estimated time until empty (at current speed)
  const hoursUntilEmpty = currentSpeed > 0 ? rangeKm / currentSpeed : 0
  const minutesUntilEmpty = Math.round(hoursUntilEmpty * 60)

  // Find nearest gas station
  const findGasStation = useCallback(async () => {
    if (!navigator.geolocation) { toast.error('GPS ni na voljo'); return }
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`/api/fuel?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radius=5000`)
        if (res.ok) {
          const j = await res.json()
          if (j.data?.stations?.length > 0) {
            const nearest = j.data.stations[0]
            toast.success(`⛽ Najbližja bencinska: ${nearest.name || nearest.brand || 'bencinska'} — ${Math.round(nearest.distance || 0)}m`)
          } else {
            toast.info('🔧 Na voljo je iskanje POI-jev za gorivo v bližini')
          }
        }
      } catch {
        toast.error('Napaka pri iskanju bencinske')
      }
    }, () => toast.error('GPS ni na voljo'), { enableHighAccuracy: true, timeout: 5000 })
  }, [])

  // Color coding
  const statusColor = isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : isWarning ? 'text-amber-400' : 'text-emerald-500'
  const bgColor = isCritical ? 'bg-red-500/10 border-red-500/30' : isLow ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
  const barColor = isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'

  if (loading) return null

  return (
    <Card className={`border ${bgColor}`}>
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fuel className={`size-4 ${statusColor}`} />
            <span className="text-xs font-bold uppercase tracking-wider">Doseg goriva</span>
          </div>
          <span className={`text-lg font-black ${statusColor}`}>
            {Math.round(range)} <span className="text-xs font-medium">{rangeUnit}</span>
          </span>
        </div>

        {/* Fuel bar */}
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(100, fuelPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{currentFuel.toFixed(1)}L / {fuelCapacity}L</span>
            <span>{fuelConsumption}L/100km</span>
          </div>
        </div>

        {/* Time until empty */}
        {currentSpeed > 5 && hoursUntilEmpty > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gauge className="size-3" />
            <span>~{minutesUntilEmpty >= 60 ? `${Math.floor(minutesUntilEmpty / 60)}h ${minutesUntilEmpty % 60}min` : `${minutesUntilEmpty}min`} do praznega</span>
            <span className="text-[9px]">({Math.round(currentSpeed)} km/h)</span>
          </div>
        )}

        {/* Warning */}
        {isCritical && (
          <div className="flex items-center gap-2 text-xs text-red-500 font-medium">
            <AlertTriangle className="size-3" />
            <span>Nevarno nizko gorivo! Išči bencinsko!</span>
          </div>
        )}

        {/* Find gas station button */}
        {(isLow || isCritical) && (
          <Button
            size="sm"
            className={`w-full text-xs gap-2 ${isCritical ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
            onClick={findGasStation}
          >
            <MapPin className="size-3" />
            Najdi bencinsko
          </Button>
        )}

        {/* Quick fuel adjustment */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Trenutno:</span>
          <input
            type="range"
            min={0}
            max={fuelCapacity}
            step={0.5}
            value={currentFuel}
            onChange={(e) => setCurrentFuel(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-primary"
          />
          <span className="text-[10px] text-muted-foreground">{currentFuel.toFixed(1)}L</span>
        </div>
      </CardContent>
    </Card>
  )
}
