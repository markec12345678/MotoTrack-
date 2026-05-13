'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  LocateFixed,
} from 'lucide-react'
import { toast } from 'sonner'

type FuelType = '95' | '98' | 'diesel'
type SortMode = 'price' | 'distance'

interface FuelPriceCardProps {
  userId?: string
}

export default function FuelPriceCard({ userId }: FuelPriceCardProps) {
  const [fuelType, setFuelType] = useState<FuelType>('95')
  const [sortBy, setSortBy] = useState<SortMode>('price')
  const [stations, setStations] = useState<FuelStation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchLocation, setSearchLocation] = useState('')
  const [userLat, setUserLat] = useState(46.15)
  const [userLng, setUserLng] = useState(14.99)

  // Fetch fuel prices from API
  const fetchStations = useCallback(async (lat: number, lng: number, type: FuelType) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/fuel-prices?lat=${lat}&lng=${lng}&fuelType=${type}&radius=50`)
      if (res.ok) {
        const json = await res.json()
        setStations(json.data || [])
      } else {
        toast.error('Napaka pri pridobivanju cen goriva')
        setStations([])
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
      setStations([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Get user's current position and fetch stations on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          setUserLat(lat)
          setUserLng(lng)
          fetchStations(lat, lng, fuelType)
        },
        () => {
          // Geolocation denied, use default Slovenia center
          fetchStations(userLat, userLng, fuelType)
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      )
    } else {
      fetchStations(userLat, userLng, fuelType)
    }
    // Only run on mount
  }, [])

  // Re-fetch when fuel type changes (skip initial render since mount effect handles it)
  const initialFetchDoneRef = useRef(false)
  useEffect(() => {
    if (initialFetchDoneRef.current) {
      fetchStations(userLat, userLng, fuelType)
    }
    initialFetchDoneRef.current = true
  }, [fuelType, fetchStations, userLat, userLng])

  // Handle fuel type change
  const handleFuelTypeChange = useCallback((newType: string) => {
    setFuelType(newType as FuelType)
  }, [])

  // Real search: filter the API results by name, address, or brand
  const filteredStations = useMemo(() => {
    let result = [...stations]
    if (searchLocation.trim()) {
      const q = searchLocation.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.brand && s.brand.toLowerCase().includes(q))
      )
    }
    return result
  }, [stations, searchLocation])

  // Sort the filtered results
  const sortedStations = useMemo(() => {
    return [...filteredStations]
      .filter(s => s.prices[fuelType] !== null)
      .sort((a, b) => {
        if (sortBy === 'price') {
          return (a.prices[fuelType] ?? 999) - (b.prices[fuelType] ?? 999)
        }
        return a.distance - b.distance
      })
  }, [filteredStations, fuelType, sortBy])

  const cheapestPrice = sortedStations[0]?.prices[fuelType]

  // Use current location and refetch
  const handleLocateMe = useCallback(() => {
    if (navigator.geolocation) {
      setIsLoading(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          setUserLat(lat)
          setUserLng(lng)
          fetchStations(lat, lng, fuelType)
        },
        () => {
          toast.error('Napaka pri pridobivanju lokacije')
          setIsLoading(false)
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      )
    } else {
      toast.error('Geolokacija ni na voljo')
    }
  }, [fuelType, fetchStations])

  // Handle search: filters existing results (no fake timeout)
  const handleSearch = useCallback(() => {
    // The search is already reactive via useMemo on searchLocation
    // This button just provides visual feedback
    if (!searchLocation.trim()) {
      // If search is empty, refetch from API to get all results
      fetchStations(userLat, userLng, fuelType)
    }
  }, [searchLocation, userLat, userLng, fuelType, fetchStations])

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
              placeholder="Išči po imenu, naslovu..."
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
          <Button
            size="sm"
            variant="outline"
            onClick={handleLocateMe}
            disabled={isLoading}
            className="h-9 gap-1"
            title="Uporabi mojo lokacijo"
          >
            <LocateFixed className="h-4 w-4" />
          </Button>
        </div>

        {/* Fuel type & sort selector */}
        <div className="flex items-center gap-2">
          <Select value={fuelType} onValueChange={handleFuelTypeChange}>
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

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span className="ml-2 text-sm text-muted-foreground">Nalaganje cen...</span>
          </div>
        )}

        {/* Average price indicator */}
        {!isLoading && cheapestPrice !== undefined && (
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <span className="text-xs">Najnižja cena</span>
            <span className="text-lg font-bold text-emerald-500">{cheapestPrice?.toFixed(3)} €/L</span>
          </div>
        )}

        {/* Stations list */}
        {!isLoading && (
          <ScrollArea className="max-h-72">
            <div className="space-y-2 pr-2">
              {sortedStations.length === 0 ? (
                <div className="text-center py-8">
                  <Fuel className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchLocation ? 'Ni rezultatov za iskanje' : 'Ni najdenih bencinskih črpalk'}
                  </p>
                  {!searchLocation && (
                    <p className="text-xs text-muted-foreground mt-1">Poskusite spremeniti lokacijo ali povečati obseg</p>
                  )}
                </div>
              ) : (
                sortedStations.map((station, i) => {
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
                })
              )}
            </div>
          </ScrollArea>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Cene se posodabljajo vsak dan ob 6:00
        </p>
      </CardContent>
    </Card>
  )
}
