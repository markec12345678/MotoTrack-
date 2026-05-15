'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Bike, Route, MapPin, Star, Fuel, Mountain, Wrench,
  Calendar, Tent, AlertTriangle, Search, Users, Trophy,
  Cloud, Navigation, Compass,
} from 'lucide-react'
import type { RideData, RouteData, BalkanMotoRoad, MotoEventData, CampSiteData, PoiData } from '@/components/tabs/types'
import { categoryLabel, formatDate } from '@/components/tabs/types'

interface SearchResult {
  id: string
  type: 'ride' | 'route' | 'road' | 'event' | 'camp' | 'poi' | 'action'
  title: string
  description: string
  icon: React.ReactNode
  onSelect: () => void
}

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rides: RideData[]
  routes: RouteData[]
  onNavigateToRide?: (ride: RideData) => void
  onNavigateToRoute?: (route: RouteData) => void
  onNavigateToRoad?: (road: BalkanMotoRoad) => void
  onNavigateToTab?: (tab: string) => void
}

const COUNTRY_FLAGS: Record<string, string> = {
  SI: '🇸🇮', HR: '🇭🇷', BA: '🇧🇦', ME: '🇲🇪', RS: '🇷🇸', MK: '🇲🇰',
  AL: '🇦🇱', GR: '🇬🇷', BG: '🇧🇬', RO: '🇷🇴', HU: '🇭🇺', AT: '🇦🇹',
}

const QUICK_ACTIONS = [
  { id: 'action-track', title: 'Začni sledenje', description: 'Pojdi na zavihek Sledi', icon: <Bike className="size-4 text-primary" />, tab: 'track' },
  { id: 'action-plan', title: 'Načrtuj pot', description: 'Odpri načrtovalec', icon: <Route className="size-4 text-emerald-400" />, tab: 'plan' },
  { id: 'action-explore', title: 'Raziskuj', description: 'Odkrij nove poti', icon: <Compass className="size-4 text-amber-400" />, tab: 'explore' },
  { id: 'action-weather', title: 'Vremenska primernost', description: 'Preveri vreme za vožnjo', icon: <Cloud className="size-4 text-sky-400" />, tab: 'explore' },
  { id: 'action-roads', title: 'Bližnje ceste', description: 'Najdi motoristične ceste', icon: <Navigation className="size-4 text-orange-400" />, tab: 'explore' },
  { id: 'action-conditions', title: 'Stanje na cestah', description: 'Poročila o cestah', icon: <AlertTriangle className="size-4 text-amber-500" />, tab: 'explore' },
  { id: 'action-profile', title: 'Moj profil', description: 'Nastavitve in statistika', icon: <Users className="size-4 text-violet-400" />, tab: 'profile' },
]

export default function GlobalSearch({
  open, onOpenChange,
  rides, routes,
  onNavigateToRide, onNavigateToRoute, onNavigateToRoad, onNavigateToTab,
}: GlobalSearchProps) {
  const [balkanRoads, setBalkanRoads] = useState<BalkanMotoRoad[]>([])
  const [events, setEvents] = useState<MotoEventData[]>([])
  const [camps, setCamps] = useState<CampSiteData[]>([])
  const [pois, setPois] = useState<PoiData[]>([])

  // Fetch extra data on open
  useEffect(() => {
    if (open) {
      fetch('/api/balkan-roads').then(r => r.json()).then(j => setBalkanRoads(j?.data || [])).catch(() => {})
      fetch('/api/events').then(r => r.json()).then(j => setEvents(j?.data || [])).catch(() => {})
      fetch('/api/camps').then(r => r.json()).then(j => setCamps(j?.data || [])).catch(() => {})
      fetch('/api/pois').then(r => r.json()).then(j => setPois(j?.data || [])).catch(() => {})
    }
  }, [open])

  // Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  const buildResults = useCallback((): SearchResult[] => {
    const results: SearchResult[] = []

    // Rides
    rides.forEach(ride => {
      results.push({
        id: `ride-${ride.id}`,
        type: 'ride',
        title: ride.title,
        description: `${ride.distance?.toFixed(1) || 0} km · ${formatDate(ride.createdAt)}`,
        icon: <Bike className="size-4 text-primary" />,
        onSelect: () => { onOpenChange(false); onNavigateToRide?.(ride) },
      })
    })

    // Routes
    routes.forEach(route => {
      results.push({
        id: `route-${route.id}`,
        type: 'route',
        title: route.title,
        description: `${route.distance?.toFixed(1) || 0} km · ${categoryLabel(route.category)}`,
        icon: <Route className="size-4 text-emerald-400" />,
        onSelect: () => { onOpenChange(false); onNavigateToRoute?.(route) },
      })
    })

    // Balkan roads
    balkanRoads.forEach(road => {
      results.push({
        id: `road-${road.id}`,
        type: 'road',
        title: road.name,
        description: `${COUNTRY_FLAGS[road.country] || ''} ${road.lengthKm} km · ${road.difficulty}`,
        icon: <Mountain className="size-4 text-orange-400" />,
        onSelect: () => { onOpenChange(false); onNavigateToRoad?.(road) },
      })
    })

    // Events
    events.forEach(event => {
      results.push({
        id: `event-${event.id}`,
        type: 'event',
        title: event.title,
        description: `${COUNTRY_FLAGS[event.country] || ''} ${formatDate(event.date)}`,
        icon: <Calendar className="size-4 text-pink-400" />,
        onSelect: () => { onOpenChange(false); onNavigateToTab?.('explore') },
      })
    })

    // Camps
    camps.forEach(camp => {
      results.push({
        id: `camp-${camp.id}`,
        type: 'camp',
        title: camp.name,
        description: `${COUNTRY_FLAGS[camp.country] || ''} ${camp.motoFriendly ? '🏍️ Moto prijazen' : ''}`,
        icon: <Tent className="size-4 text-teal-400" />,
        onSelect: () => { onOpenChange(false); onNavigateToTab?.('explore') },
      })
    })

    // POIs
    pois.slice(0, 20).forEach(poi => {
      results.push({
        id: `poi-${poi.id}`,
        type: 'poi',
        title: poi.name,
        description: poi.description || poi.type,
        icon: <MapPin className="size-4 text-red-400" />,
        onSelect: () => { onOpenChange(false); onNavigateToTab?.('map') },
      })
    })

    // Quick actions
    QUICK_ACTIONS.forEach(action => {
      results.push({
        id: action.id,
        type: 'action',
        title: action.title,
        description: action.description,
        icon: action.icon,
        onSelect: () => { onOpenChange(false); onNavigateToTab?.(action.tab) },
      })
    })

    return results
  }, [rides, routes, balkanRoads, events, camps, pois, onOpenChange, onNavigateToRide, onNavigateToRoute, onNavigateToRoad, onNavigateToTab])

  const results = useMemo(() => buildResults(), [buildResults])

  // Group results by type
  const ridesResults = results.filter(r => r.type === 'ride').slice(0, 8)
  const routesResults = results.filter(r => r.type === 'route').slice(0, 8)
  const roadsResults = results.filter(r => r.type === 'road').slice(0, 8)
  const eventsResults = results.filter(r => r.type === 'event').slice(0, 5)
  const campsResults = results.filter(r => r.type === 'camp').slice(0, 5)
  const actionsResults = results.filter(r => r.type === 'action')

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Išči vožnje, poti, ceste, dogodke..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Ni najdenih rezultatov</CommandEmpty>

        {/* Quick actions */}
        {actionsResults.length > 0 && (
          <CommandGroup heading="⚡ Hitra dejanja">
            {actionsResults.map(result => (
              <CommandItem key={result.id} onSelect={result.onSelect} className="gap-2">
                {result.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{result.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{result.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Rides */}
        {ridesResults.length > 0 && (
          <CommandGroup heading="🏍️ Vožnje">
            {ridesResults.map(result => (
              <CommandItem key={result.id} onSelect={result.onSelect} className="gap-2">
                {result.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{result.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{result.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Routes */}
        {routesResults.length > 0 && (
          <CommandGroup heading="🗺️ Poti">
            {routesResults.map(result => (
              <CommandItem key={result.id} onSelect={result.onSelect} className="gap-2">
                {result.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{result.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{result.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Balkan Roads */}
        {roadsResults.length > 0 && (
          <CommandGroup heading="🏔️ Motoristične ceste">
            {roadsResults.map(result => (
              <CommandItem key={result.id} onSelect={result.onSelect} className="gap-2">
                {result.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{result.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{result.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Events */}
        {eventsResults.length > 0 && (
          <CommandGroup heading="📅 Dogodki">
            {eventsResults.map(result => (
              <CommandItem key={result.id} onSelect={result.onSelect} className="gap-2">
                {result.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{result.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{result.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Camps */}
        {campsResults.length > 0 && (
          <CommandGroup heading="⛺ Kampi">
            {campsResults.map(result => (
              <CommandItem key={result.id} onSelect={result.onSelect} className="gap-2">
                {result.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{result.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{result.description}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer */}
      <div className="border-t border-border/30 px-3 py-2 flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">
          {results.length} rezultatov
        </span>
        <span className="text-[9px] text-muted-foreground">
          <kbd className="px-1 py-0.5 rounded bg-muted text-[8px]">Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded bg-muted text-[8px]">K</kbd> za iskanje
        </span>
      </div>
    </CommandDialog>
  )
}
