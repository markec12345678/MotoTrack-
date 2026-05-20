'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Plus, Search, Coffee, UtensilsCrossed, Camera, Fuel, ParkingCircle } from 'lucide-react'
import { toast } from 'sonner'

interface RestStopFinderProps {
  waypoints: { lat: number; lng: number }[]
  onAddWaypoint?: (point: { lat: number; lng: number; label: string }) => void
  className?: string
}

// POI category types for rest stops
const REST_CATEGORIES = [
  { type: 'cafe', label: 'Kavarnice', emoji: '☕', icon: Coffee, color: '#8B4513', poiType: 'restaurant' },
  { type: 'restaurant', label: 'Restavracije', emoji: '🍽️', icon: UtensilsCrossed, color: '#f59e0b', poiType: 'restaurant' },
  { type: 'viewpoint', label: 'Razgledišča', emoji: '📸', icon: Camera, color: '#0ea5e9', poiType: 'viewpoint' },
  { type: 'gas_station', label: 'Bencinske črp.', emoji: '⛽', icon: Fuel, color: '#22c55e', poiType: 'gas_station' },
  { type: 'parking', label: 'Počivališča', emoji: '🅿️', icon: ParkingCircle, color: '#3b82f6', poiType: 'parking' },
] as const

type RestCategoryType = typeof REST_CATEGORIES[number]['type']

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Calculate distance along route to the nearest waypoint for a given POI
function distanceAlongRoute(
  poiLat: number,
  poiLng: number,
  waypoints: { lat: number; lng: number }[]
): number {
  if (waypoints.length === 0) return 0

  // Find the closest waypoint to the POI
  let closestIdx = 0
  let closestDist = Infinity
  for (let i = 0; i < waypoints.length; i++) {
    const d = haversineKm(poiLat, poiLng, waypoints[i].lat, waypoints[i].lng)
    if (d < closestDist) {
      closestDist = d
      closestIdx = i
    }
  }

  // Sum distances from start to the closest waypoint
  let totalDist = 0
  for (let i = 1; i <= closestIdx; i++) {
    totalDist += haversineKm(
      waypoints[i - 1].lat, waypoints[i - 1].lng,
      waypoints[i].lat, waypoints[i].lng
    )
  }

  return Math.round(totalDist * 10) / 10
}

// Map a POI to a rest category
function getRestCategory(poiType: string): RestCategoryType | null {
  if (poiType === 'gas_station') return 'gas_station'
  if (poiType === 'viewpoint') return 'viewpoint'
  if (poiType === 'parking') return 'parking'
  if (poiType === 'restaurant') return 'restaurant'
  // Hotels could also be rest stops
  if (poiType === 'hotel') return 'cafe'
  if (poiType === 'camping') return 'parking'
  if (poiType === 'biker_spot') return 'cafe'
  return null
}

// Get the display category info for a POI
function getCategoryInfo(poiType: string) {
  if (poiType === 'gas_station') return REST_CATEGORIES.find(c => c.type === 'gas_station')!
  if (poiType === 'viewpoint') return REST_CATEGORIES.find(c => c.type === 'viewpoint')!
  if (poiType === 'parking') return REST_CATEGORIES.find(c => c.type === 'parking')!
  if (poiType === 'restaurant') return REST_CATEGORIES.find(c => c.type === 'restaurant')!
  if (poiType === 'hotel') return REST_CATEGORIES.find(c => c.type === 'cafe')!
  if (poiType === 'camping') return REST_CATEGORIES.find(c => c.type === 'parking')!
  if (poiType === 'biker_spot') return REST_CATEGORIES.find(c => c.type === 'cafe')!
  // Default fallback
  return REST_CATEGORIES.find(c => c.type === 'cafe')!
}

interface PoiResult {
  id: string
  name: string
  type: string
  lat: number
  lng: number
  description: string | null
  rating: number
  distanceFromRoute: number
  distanceAlongRoute: number
  category: RestCategoryType
}

export default function RestStopFinder({ waypoints, onAddWaypoint, className = '' }: RestStopFinderProps) {
  const [results, setResults] = useState<PoiResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<RestCategoryType>>(
    new Set(REST_CATEGORIES.map(c => c.type))
  )

  // Filter results by selected categories
  const filteredResults = useMemo(() => {
    return results.filter(r => selectedCategories.has(r.category))
  }, [results, selectedCategories])

  // Toggle category
  const toggleCategory = useCallback((type: RestCategoryType) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        // Don't allow deselecting all
        if (next.size > 1) {
          next.delete(type)
        }
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  // Search for rest stops along route
  const searchRestStops = useCallback(async () => {
    if (waypoints.length < 2) {
      toast.error('Dodajte vsaj dve točki za iskanje počivališč')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/pois/near-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypoints,
          radiusKm: 3,
          types: ['gas_station', 'restaurant', 'viewpoint', 'parking', 'hotel', 'camping', 'biker_spot'],
        }),
      })

      if (res.ok) {
        const j = await res.json()
        const pois: PoiResult[] = (j.data || []).map((poi: Record<string, unknown>) => {
          const category = getRestCategory(poi.type as string) || 'cafe'
          return {
            id: poi.id as string,
            name: poi.name as string,
            type: poi.type as string,
            lat: poi.lat as number,
            lng: poi.lng as number,
            description: poi.description as string | null,
            rating: poi.rating as number,
            distanceFromRoute: poi.distanceFromRoute as number,
            distanceAlongRoute: distanceAlongRoute(poi.lat as number, poi.lng as number, waypoints),
            category,
          }
        })

        // Sort by distance along route (order of encounter)
        pois.sort((a, b) => a.distanceAlongRoute - b.distanceAlongRoute)
        setResults(pois)
        setSearched(true)

        if (pois.length === 0) {
          toast.info('Ni počivališč ob poti')
        }
      } else {
        toast.error('Napaka pri iskanju počivališč')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
    setLoading(false)
  }, [waypoints])

  // Add waypoint from rest stop
  const handleAddWaypoint = useCallback((poi: PoiResult) => {
    if (onAddWaypoint) {
      onAddWaypoint({ lat: poi.lat, lng: poi.lng, label: poi.name })
      toast.success(`Dodano: ${poi.name}`)
    }
  }, [onAddWaypoint])

  // Get distance badge color based on how far from route
  const getDistColor = (dist: number) => {
    if (dist <= 0.5) return { bg: '#22c55e20', text: '#22c55e' }
    if (dist <= 1.5) return { bg: '#f59e0b20', text: '#f59e0b' }
    return { bg: '#ef444420', text: '#ef4444' }
  }

  if (waypoints.length < 2) return null

  return (
    <Card className={`border-border/50 ${className}`}>
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary" />
            Počivališča ob poti
          </h4>
          <div className="flex items-center gap-2">
            {searched && results.length > 0 && (
              <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {filteredResults.length} najdenih
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1"
              disabled={loading}
              onClick={searchRestStops}
            >
              {loading ? (
                <span className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="size-3" />
              )}
              Išči
            </Button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5">
          {REST_CATEGORIES.map(cat => {
            const Icon = cat.icon
            const isActive = selectedCategories.has(cat.type)
            const count = results.filter(r => r.category === cat.type).length
            return (
              <button
                key={cat.type}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all ${
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                    : 'border-border/30 bg-secondary/20 text-muted-foreground opacity-50'
                }`}
                onClick={() => toggleCategory(cat.type)}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                {searched && count > 0 && (
                  <span className="text-[8px] font-bold opacity-70">({count})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Results */}
        {searched && (
          <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
            {filteredResults.length === 0 ? (
              <div className="text-center py-4">
                <MapPin className="size-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">
                  {results.length === 0
                    ? 'Ni počivališč v bližini poti'
                    : 'Ni rezultatov za izbrane kategorije'}
                </p>
              </div>
            ) : (
              filteredResults.map(poi => {
                const catInfo = getCategoryInfo(poi.type)
                const distColor = getDistColor(poi.distanceFromRoute)
                return (
                  <div
                    key={poi.id}
                    className="flex items-start gap-2 text-xs rounded-lg px-2.5 py-2 bg-secondary/40 hover:bg-secondary/60 transition-colors group"
                  >
                    {/* Type icon */}
                    <div
                      className="size-7 rounded-md flex items-center justify-center shrink-0 text-sm"
                      style={{ backgroundColor: catInfo.color + '20' }}
                    >
                      {catInfo.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{poi.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="inline-block text-[9px] px-1.5 py-0 rounded-full font-medium"
                          style={{
                            backgroundColor: catInfo.color + '20',
                            color: catInfo.color,
                          }}
                        >
                          {catInfo.label}
                        </span>
                        {poi.rating > 0 && (
                          <span className="text-[9px] text-amber-500 flex items-center gap-0.5">
                            ★ {poi.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {/* Distance info */}
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: distColor.bg,
                            color: distColor.text,
                          }}
                        >
                          {poi.distanceFromRoute.toFixed(1)} km od poti
                        </span>
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="size-2.5" />
                          {poi.distanceAlongRoute.toFixed(1)} km ob poti
                        </span>
                      </div>

                      {/* Coordinates */}
                      <p className="text-[8px] text-muted-foreground/60 mt-0.5 font-mono">
                        {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
                      </p>
                    </div>

                    {/* Add waypoint button */}
                    {onAddWaypoint && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[9px] gap-1 px-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleAddWaypoint(poi)}
                      >
                        <Plus className="size-3" />
                        Dodaj
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Not searched yet */}
        {!searched && (
          <div className="text-center py-3">
            <p className="text-[10px] text-muted-foreground">
              Pritisnite &quot;Išči&quot; za iskanje kavarn, restavracij, razgledišč in drugih počivališč ob načrtovani poti.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
