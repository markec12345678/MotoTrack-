'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Search, X, ChevronUp, ChevronDown, LocateFixed } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import type { RideData, RouteData } from '@/components/tabs/types'
import { categoryLabel, categoryColor } from '@/components/tabs/types'

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

interface MapTabProps {
  rides: RideData[]
  routes: RouteData[]
  onOpenDetail: (item: RideData | RouteData, type: 'ride' | 'route') => void
}

export default function MapTab({ rides, routes, onOpenDetail }: MapTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [nearbyExpanded, setNearbyExpanded] = useState(false)

  const totalCount = rides.length + routes.length

  // Filter rides and routes by search query
  const filteredRides = rides.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredRoutes = routes.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const hasResults = filteredRides.length > 0 || filteredRoutes.length > 0

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error('Ne morem pridobiti lokacije')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        toast.success(`Lokacija: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
      },
      () => {
        toast.error('Ne morem pridobiti lokacije')
      }
    )
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* Map */}
      <MotoMap
        center={[46.15, 14.99]}
        zoom={8}
        rides={rides}
        routes={routes}
        className="absolute inset-0"
      />

      {/* Floating search bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <div className="relative max-w-md mx-auto">
          <div className="flex items-center gap-2 bg-background/90 backdrop-blur-md border border-border rounded-xl shadow-lg px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value) setShowSearch(true)
              }}
              onFocus={() => setShowSearch(true)}
              placeholder="Išči vožnje in poti..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 py-0 h-7 text-sm placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setShowSearch(false)
                }}
                className="shrink-0 p-0.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Search dropdown */}
          {showSearch && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg overflow-hidden">
              <ScrollArea className="max-h-72">
                {!hasResults && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Ni zadetkov
                  </div>
                )}

                {filteredRides.map((ride) => (
                  <button
                    key={`ride-${ride.id}`}
                    onClick={() => {
                      onOpenDetail(ride, 'ride')
                      setShowSearch(false)
                      setSearchQuery('')
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Badge
                      variant="outline"
                      className="bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0 text-[10px] px-1.5 py-0"
                    >
                      Vožnja
                    </Badge>
                    <span className="text-sm text-foreground truncate flex-1">
                      {ride.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {ride.distance} km
                    </span>
                  </button>
                ))}

                {filteredRoutes.map((route) => (
                  <button
                    key={`route-${route.id}`}
                    onClick={() => {
                      onOpenDetail(route, 'route')
                      setShowSearch(false)
                      setSearchQuery('')
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Badge
                      variant="outline"
                      className={`${categoryColor(route.category)} shrink-0 text-[10px] px-1.5 py-0`}
                    >
                      Pot
                    </Badge>
                    <span className="text-sm text-foreground truncate flex-1">
                      {route.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {route.distance} km
                    </span>
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-[1000] bg-background/90 backdrop-blur-md border border-border rounded-xl shadow-lg px-3 py-2">
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">
              Vožnje <span className="text-foreground font-medium">{rides.length}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">
              Poti <span className="text-foreground font-medium">{routes.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Locate button */}
      <div className="absolute bottom-28 right-4 z-[1000]">
        <Button
          size="icon"
          variant="secondary"
          className="h-10 w-10 rounded-full shadow-lg bg-background/90 backdrop-blur-md border border-border hover:bg-muted"
          onClick={handleLocate}
        >
          <LocateFixed className="h-5 w-5" />
        </Button>
      </div>

      {/* Nearby panel */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000]">
        <div
          className={`bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg transition-all duration-300 ${
            nearbyExpanded ? 'max-h-[60vh]' : 'max-h-14'
          }`}
        >
          {/* Toggle button */}
          <button
            onClick={() => setNearbyExpanded(!nearbyExpanded)}
            className="w-full flex items-center justify-between px-4 h-14 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors rounded-t-2xl"
          >
            <span>
              {totalCount} voženj in poti
            </span>
            {nearbyExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Expanded list */}
          {nearbyExpanded && (
            <ScrollArea className="max-h-[calc(60vh-3.5rem)]">
              <div className="px-4 pb-4 space-y-2">
                {rides.map((ride) => (
                  <button
                    key={`nearby-ride-${ride.id}`}
                    onClick={() => onOpenDetail(ride, 'ride')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <Badge
                      variant="outline"
                      className="bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0 text-[10px] px-1.5 py-0"
                    >
                      Vožnja
                    </Badge>
                    <span className="text-sm text-foreground truncate flex-1">
                      {ride.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {ride.distance} km
                    </span>
                  </button>
                ))}

                {routes.map((route) => (
                  <button
                    key={`nearby-route-${route.id}`}
                    onClick={() => onOpenDetail(route, 'route')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <Badge
                      variant="outline"
                      className={`${categoryColor(route.category)} shrink-0 text-[10px] px-1.5 py-0`}
                    >
                      {categoryLabel(route.category)}
                    </Badge>
                    <span className="text-sm text-foreground truncate flex-1">
                      {route.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {route.distance} km
                    </span>
                  </button>
                ))}

                {totalCount === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Ni voženj in poti
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  )
}
