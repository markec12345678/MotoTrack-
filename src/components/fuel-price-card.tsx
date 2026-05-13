'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FuelStation } from '@/components/tabs/types'
import {
  Fuel,
  MapPin,
  Navigation,
  ArrowUpDown,
  Loader2,
  Search,
} from 'lucide-react'

type FuelType = '95' | '98' | 'diesel'
type SortMode = 'price' | 'distance'

// Mock fuel stations for Slovenia
const MOCK_STATIONS: FuelStation[] = [
  {
    id: 'fs-1',
    name: 'Petrol Ljubljana BTC',
    lat: 46.0717,
    lng: 14.5364,
    distance: 2.3,
    prices: { '95': 1.549, '98': 1.649, diesel: 1.499 },
    brand: 'Petrol',
    address: 'Šmartinska cesta 152, Ljubljana',
  },
  {
    id: 'fs-2',
    name: 'OMV Ljubljana',
    lat: 46.0569,
    lng: 14.5058,
    distance: 3.1,
    prices: { '95': 1.559, '98': 1.669, diesel: 1.509 },
    brand: 'OMV',
    address: 'Dunajska cesta 87, Ljubljana',
  },
  {
    id: 'fs-3',
    name: 'MOL Ljubljana Sever',
    lat: 46.0897,
    lng: 14.4756,
    distance: 5.2,
    prices: { '95': 1.539, '98': 1.639, diesel: 1.489 },
    brand: 'MOL',
    address: 'Celovška cesta 145, Ljubljana',
  },
  {
    id: 'fs-4',
    name: 'Shell Maribor',
    lat: 46.5547,
    lng: 15.6459,
    distance: 105.0,
    prices: { '95': 1.529, '98': null, diesel: 1.479 },
    brand: 'Shell',
    address: 'Partizanska cesta 12, Maribor',
  },
  {
    id: 'fs-5',
    name: 'Petrol Bled',
    lat: 46.3638,
    lng: 14.0944,
    distance: 45.7,
    prices: { '95': 1.549, '98': 1.659, diesel: 1.499 },
    brand: 'Petrol',
    address: 'Cesta svobode 8, Bled',
  },
  {
    id: 'fs-6',
    name: 'OMV Kranj',
    lat: 46.2397,
    lng: 14.3556,
    distance: 25.3,
    prices: { '95': 1.545, '98': 1.655, diesel: 1.495 },
    brand: 'OMV',
    address: 'Predoslje 20, Kranj',
  },
  {
    id: 'fs-7',
    name: 'Neodvisna črpalka Novo mesto',
    lat: 45.8029,
    lng: 15.1682,
    distance: 62.8,
    prices: { '95': 1.519, '98': 1.619, diesel: 1.469 },
    brand: null,
    address: 'Seidlova cesta 3, Novo mesto',
  },
]

export default function FuelPriceCard() {
  const [fuelType, setFuelType] = useState<FuelType>('95')
  const [sortBy, setSortBy] = useState<SortMode>('price')
  const [stations, setStations] = useState<FuelStation[]>(MOCK_STATIONS)
  const [isLoading, setIsLoading] = useState(false)
  const [searchLocation, setSearchLocation] = useState('')

  const handleSearch = useCallback(async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800))
    setStations(MOCK_STATIONS)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    handleSearch()
  }, [handleSearch])

  const sortedStations = [...stations]
    .filter(s => s.prices[fuelType] !== null)
    .sort((a, b) => {
      if (sortBy === 'price') {
        return (a.prices[fuelType] ?? 999) - (b.prices[fuelType] ?? 999)
      }
      return a.distance - b.distance
    })

  const cheapestPrice = sortedStations[0]?.prices[fuelType]

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Fuel className="h-5 w-5 text-emerald-500" />
          Cene goriva
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              placeholder="Vnesi lokacijo..."
              className="w-full h-9 rounded-md border border-input bg-background px-8 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={isLoading}
            className="h-9 gap-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Fuel type & sort selector */}
        <div className="flex items-center gap-2">
          <Select value={fuelType} onValueChange={(v) => setFuelType(v as FuelType)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="95">Bencin 95</SelectItem>
              <SelectItem value="98">Bencin 98</SelectItem>
              <SelectItem value="diesel">Dizel</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortBy(sortBy === 'price' ? 'distance' : 'price')}
            className="h-8 gap-1 text-xs"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortBy === 'price' ? 'Cena' : 'Razdalja'}
          </Button>
        </div>

        {/* Average price indicator */}
        {cheapestPrice !== undefined && (
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <span className="text-xs">Najnižja cena</span>
            <span className="text-lg font-bold text-emerald-500">{cheapestPrice?.toFixed(3)} €/L</span>
          </div>
        )}

        {/* Stations list */}
        <ScrollArea className="max-h-72">
          <div className="space-y-2 pr-2">
            {sortedStations.map((station, i) => {
              const price = station.prices[fuelType]
              const isCheapest = price === cheapestPrice && i === 0
              return (
                <div
                  key={station.id}
                  className={`rounded-lg border p-3 space-y-2 transition-colors ${
                    isCheapest
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{station.name}</span>
                        {isCheapest && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5">
                            Najcenejše
                          </Badge>
                        )}
                      </div>
                      {station.brand && (
                        <Badge variant="outline" className="text-[10px] mt-1">{station.brand}</Badge>
                      )}
                      {station.address && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{station.address}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                      <span className="text-lg font-bold text-emerald-500">{price?.toFixed(3)} €</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {station.distance.toFixed(1)} km
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1 text-emerald-500 hover:text-emerald-400 p-0"
                    >
                      <Navigation className="h-3 w-3" />
                      Navigiraj
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <p className="text-[10px] text-muted-foreground text-center">
          Cene se posodabljajo vsak dan ob 6:00
        </p>
      </CardContent>
    </Card>
  )
}
