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
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Landmark,
} from 'lucide-react'
import { toast } from 'sonner'

type FuelType = '95' | '98' | 'diesel' | 'lpg'
type SortMode = 'price' | 'distance'

const FUEL_TYPE_LABELS: Record<string, string> = {
  '95': 'Bencin 95',
  '98': 'Bencin 98',
  diesel: 'Dizel',
  lpg: 'Avtoplin',
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
}

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
  const [isLive, setIsLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [nationalPrices, setNationalPrices] = useState<Record<string, number> | null>(null)
  const [priceTrend, setPriceTrend] = useState<Record<string, 'up' | 'down' | 'stable'> | null>(null)

  // Fetch fuel prices from API
  const fetchStations = useCallback(async (lat: number, lng: number, type: FuelType, forceLive = false) => {
    setIsLoading(true)
    try {
      const liveParam = forceLive ? '&live=true' : ''
      const res = await fetch(`/api/fuel-prices?lat=${lat}&lng=${lng}&fuelType=${type}&radius=50${liveParam}`)
      if (res.ok) {
        const json = await res.json()
        setStations(json.data || [])
        setIsLive(json.live === true)
        setLastUpdated(json.lastUpdated || null)
        setSource(json.source || null)
        setNationalPrices(json.nationalPrices || null)
        setPriceTrend(json.priceTrend || null)
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
          fetchStations(userLat, userLng, fuelType)
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      )
    } else {
      fetchStations(userLat, userLng, fuelType)
    }
  }, [])

  // Re-fetch when fuel type changes
  const initialFetchDoneRef = useRef(false)
  useEffect(() => {
    if (initialFetchDoneRef.current) {
      fetchStations(userLat, userLng, fuelType)
    }
    initialFetchDoneRef.current = true
  }, [fuelType, fetchStations, userLat, userLng])

  const handleFuelTypeChange = useCallback((newType: string) => {
    setFuelType(newType as FuelType)
  }, [])

  // Filter stations
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
      .filter(s => s.prices[fuelType] !== null && s.prices[fuelType] !== undefined)
      .sort((a, b) => {
        if (sortBy === 'price') {
          return (a.prices[fuelType] ?? 999) - (b.prices[fuelType] ?? 999)
        }
        return a.distance - b.distance
      })
  }, [filteredStations, fuelType, sortBy])

  const cheapestPrice = sortedStations[0]?.prices[fuelType]

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

  const handleSearch = useCallback(() => {
    if (!searchLocation.trim()) {
      fetchStations(userLat, userLng, fuelType)
    }
  }, [searchLocation, userLat, userLng, fuelType, fetchStations])

  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchStations(userLat, userLng, fuelType, true)
      toast.success(isLive ? 'Cene osvežene iz spleta' : 'Poskus pridobivanja živih cen...')
    } finally {
      setIsRefreshing(false)
    }
  }, [userLat, userLng, fuelType, fetchStations, isLive])

  // Format last updated time
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return null
    try {
      const date = new Date(lastUpdated)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMin = Math.floor(diffMs / 60000)
      const diffHrs = Math.floor(diffMin / 60)

      if (diffMin < 1) return 'Pravkar'
      if (diffMin < 60) return `Pred ${diffMin} min`
      if (diffHrs < 24) return `Pred ${diffHrs} h`
      return date.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch {
      return null
    }
  }, [lastUpdated])

  // Trend icon for current fuel type
  const currentTrend = priceTrend?.[fuelType] ?? 'stable'
  const TrendIcon = TREND_ICONS[currentTrend]

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Fuel className="h-5 w-5 text-emerald-500" />
            Cene goriva
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Live / Approximate indicator */}
            {isLive ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                V živo
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Približno
              </Badge>
            )}
            {/* Force refresh button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleForceRefresh}
              disabled={isRefreshing || isLoading}
              title="Osveži cene iz spleta"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {/* Last updated time + source */}
        {formattedLastUpdated && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground -mt-1">
            <Clock className="h-3 w-3" />
            <span>Osveženo: {formattedLastUpdated}</span>
            {source && source !== 'fallback' && (
              <span className="text-muted-foreground/60 flex items-center gap-0.5">
                · <Globe className="h-2.5 w-2.5" /> {source}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* National regulated prices banner */}
        {nationalPrices && Object.keys(nationalPrices).length > 0 && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Landmark className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Državna / uradna cena
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['95', '98', 'diesel', 'lpg'] as const).map(type => {
                const price = nationalPrices[type]
                if (!price) return null
                const trend = priceTrend?.[type] ?? 'stable'
                const TIcon = TREND_ICONS[trend]
                return (
                  <div key={type} className="text-center">
                    <p className="text-[9px] text-muted-foreground">{FUEL_TYPE_LABELS[type]}</p>
                    <div className="flex items-center justify-center gap-0.5">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{price.toFixed(3)}€</p>
                      <TIcon className={`h-2.5 w-2.5 ${
                        trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-muted-foreground'
                      }`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
              <SelectItem value="95">⛽ Bencin 95</SelectItem>
              <SelectItem value="98">⛽ Bencin 98</SelectItem>
              <SelectItem value="diesel">🛢️ Dizel</SelectItem>
              <SelectItem value="lpg">🔥 Avtoplin</SelectItem>
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

        {/* Cheapest price indicator with trend */}
        {!isLoading && cheapestPrice !== undefined && (
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs">Najnižja cena</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0">
                {FUEL_TYPE_LABELS[fuelType]}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-emerald-500">{cheapestPrice?.toFixed(3)} €/L</span>
              <TrendIcon className={`h-4 w-4 ${
                currentTrend === 'up' ? 'text-red-500' : currentTrend === 'down' ? 'text-green-500' : 'text-muted-foreground'
              }`} />
            </div>
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
                  // Compare with national price
                  const natPrice = nationalPrices?.[fuelType]
                  const diffFromNational = natPrice && price ? price - natPrice : null
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
                          <div className="flex items-center gap-2 mt-0.5">
                            {station.brand && (
                              <Badge variant="outline" className="text-[10px]">{station.brand}</Badge>
                            )}
                            {diffFromNational !== null && (
                              <span className={`text-[9px] font-medium ${
                                diffFromNational <= 0 ? 'text-green-500' : diffFromNational < 0.02 ? 'text-amber-500' : 'text-red-500'
                              }`}>
                                {diffFromNational <= 0 ? '≤ državna' : `+${diffFromNational.toFixed(3)}€`}
                              </span>
                            )}
                          </div>
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
          {isLive
            ? 'Cene pridobljene iz spleta v realnem času'
            : 'Prikazane so približne cene · Kliknite osveži za točne podatke'}
        </p>
      </CardContent>
    </Card>
  )
}
