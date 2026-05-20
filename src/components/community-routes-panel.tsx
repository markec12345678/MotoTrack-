'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Globe, Heart, MapPin, Route, Search, X, Filter, TrendingUp,
  Clock, Star, ChevronDown, ChevronUp, ArrowUpRight, Loader2,
  Tag, Gauge, Mountain, Sun,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'

interface CommunityRoute {
  id: string
  title: string
  description?: string | null
  distance: number
  category: string
  difficulty?: string | null
  createdAt: string
  isPublic: boolean
  userId: string
  user?: { name: string; avatar: string | null; bike: string | null }
  likes: number
  userLiked?: boolean
  waypoints?: string | null
}

interface CommunityRoutesPanelProps {
  userId?: string
  onLoadToPlan?: (waypoints: { lat: number; lng: number }[], name: string) => void
  onOpenDetail?: (route: CommunityRoute) => void
  userLat?: number
  userLng?: number
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  scenic: { label: 'Scenic', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', icon: <Sun className="size-3" /> },
  twisty: { label: 'Vijugasta', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', icon: <Mountain className="size-3" /> },
  offroad: { label: 'Terenska', color: 'bg-orange-500/15 text-orange-400 border-orange-500/25', icon: <Globe className="size-3" /> },
  commute: { label: 'City', color: 'bg-sky-500/15 text-sky-400 border-sky-500/25', icon: <Gauge className="size-3" /> },
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Lahka',
  medium: 'Srednja',
  hard: 'Težka',
  expert: 'Strokovna',
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Najnovejše' },
  { value: 'popular', label: 'Najpopularnejše' },
  { value: 'distance', label: 'Razdalja' },
] as const

export default function CommunityRoutesPanel({ userId, onLoadToPlan, onOpenDetail, userLat, userLng }: CommunityRoutesPanelProps) {
  const [routes, setRoutes] = useState<CommunityRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [viewMode, setViewMode] = useState<'community' | 'mine'>('community')
  const [visibleCount, setVisibleCount] = useState(12)
  const [likingId, setLikingId] = useState<string | null>(null)

  // Fetch community routes
  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('isPublic', 'true')
      params.set('limit', '100')
      if (viewMode === 'mine' && userId) {
        params.set('userId', userId)
        params.delete('isPublic')
      }
      const res = await fetch(`/api/routes?${params}`)
      if (res.ok) {
        const j = await res.json()
        setRoutes(j.data || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [viewMode, userId])

  useEffect(() => { fetchRoutes() }, [fetchRoutes])

  // Filter and sort routes
  const filteredRoutes = useMemo(() => {
    let filtered = [...routes]

    // Search filter
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      )
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(r => r.category === categoryFilter)
    }

    // Difficulty filter
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(r => r.difficulty === difficultyFilter)
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.likes - a.likes)
        break
      case 'distance':
        filtered.sort((a, b) => b.distance - a.distance)
        break
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    return filtered
  }, [routes, debouncedSearch, categoryFilter, difficultyFilter, sortBy])

  const visibleRoutes = filteredRoutes.slice(0, visibleCount)
  const hasMore = visibleCount < filteredRoutes.length

  // Like a route
  const handleLike = useCallback(async (routeId: string) => {
    if (!userId) { toast.error('Izberite uporabnika'); return }
    setLikingId(routeId)
    try {
      const res = await fetch(`/api/routes/${routeId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        setRoutes(prev => prev.map(r =>
          r.id === routeId
            ? { ...r, likes: r.userLiked ? r.likes - 1 : r.likes + 1, userLiked: !r.userLiked }
            : r
        ))
      }
    } catch { /* ignore */ }
    setLikingId(null)
  }, [userId])

  // Load route to plan
  const handleLoadToPlan = useCallback((route: CommunityRoute) => {
    if (!route.waypoints || !onLoadToPlan) return
    try {
      const wps = typeof route.waypoints === 'string' ? JSON.parse(route.waypoints) : route.waypoints
      if (Array.isArray(wps) && wps.length >= 2) {
        const points = wps.map((w: { lat: number; lng: number }) => ({ lat: w.lat, lng: w.lng }))
        onLoadToPlan(points, route.title)
        toast.success(`🗺️ Ruta "${route.title}" naložena v Načrtuj!`)
      } else {
        toast.error('Ruta nima dovolj točk')
      }
    } catch {
      toast.error('Napaka pri nalaganju rute')
    }
  }, [onLoadToPlan])

  // Format date
  const formatDate = (date: string) => {
    const d = new Date(date)
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec']
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          {viewMode === 'community' ? 'Skupnostne rute' : 'Moje rute'}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'community' ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => setViewMode('community')}
          >
            Skupnost
          </Button>
          <Button
            variant={viewMode === 'mine' ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => setViewMode('mine')}
          >
            Moje rute
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Išči rute..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => setSearchQuery('')}>
                <X className="size-3" />
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 gap-1 ${showFilters ? 'bg-primary/10 border-primary/30' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="size-3.5" />
            Filter
          </Button>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Kategorija</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse</SelectItem>
                  <SelectItem value="scenic">Scenic</SelectItem>
                  <SelectItem value="twisty">Vijugasta</SelectItem>
                  <SelectItem value="offroad">Terenska</SelectItem>
                  <SelectItem value="commute">City</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Težavnost</label>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse</SelectItem>
                  <SelectItem value="easy">Lahka</SelectItem>
                  <SelectItem value="medium">Srednja</SelectItem>
                  <SelectItem value="hard">Težka</SelectItem>
                  <SelectItem value="expert">Strokovna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Razvrsti</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filteredRoutes.length} {filteredRoutes.length === 1 ? 'ruta' : filteredRoutes.length === 2 ? 'ruti' : 'rut'}</span>
        {debouncedSearch && <span>Rezultati za &ldquo;{debouncedSearch}&rdquo;</span>}
      </div>

      {/* Route grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="rounded-xl animate-pulse">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="text-center py-12">
          <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Route className="size-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            {viewMode === 'mine' ? 'Nimate shranjenih rut' : 'Ni skupnostnih rut'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {viewMode === 'mine' ? 'Načrtujte pot in jo shranite!' : 'Bodite prvi, ki delite ruto!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleRoutes.map(route => {
            const catConfig = CATEGORY_CONFIG[route.category] || CATEGORY_CONFIG.scenic
            return (
              <Card
                key={route.id}
                className="rounded-xl hover:border-primary/30 transition-all group cursor-pointer overflow-hidden"
                onClick={() => onOpenDetail?.(route)}
              >
                {/* Category strip */}
                <div className={`h-1 bg-gradient-to-r ${route.category === 'scenic' ? 'from-emerald-400 to-emerald-600' : route.category === 'twisty' ? 'from-amber-400 to-amber-600' : route.category === 'offroad' ? 'from-orange-400 to-orange-600' : 'from-sky-400 to-sky-600'}`} />
                <CardContent className="p-4 space-y-3">
                  {/* Title + Author */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{route.title}</p>
                      {route.user && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Avatar className="size-4">
                            <AvatarFallback className="text-[8px] bg-primary/15 text-primary">{route.user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground">{route.user.name}</span>
                        </div>
                      )}
                    </div>
                    <button
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                        route.userLiked
                          ? 'text-red-500 bg-red-500/10'
                          : 'text-muted-foreground hover:text-red-400 hover:bg-red-500/5'
                      }`}
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (likingId !== route.id) handleLike(route.id)
                      }}
                      disabled={likingId === route.id}
                    >
                      <Heart className={`size-3.5 ${route.userLiked ? 'fill-red-500' : ''}`} />
                      {route.likes > 0 && <span className="font-medium">{route.likes}</span>}
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {route.distance.toFixed(1)} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(route.createdAt)}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 gap-0.5 ${catConfig.color}`}>
                      {catConfig.icon}
                      {catConfig.label}
                    </Badge>
                    {route.difficulty && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {DIFFICULTY_LABELS[route.difficulty] || route.difficulty}
                      </Badge>
                    )}
                  </div>

                  {/* Load to Plan button */}
                  {route.waypoints && onLoadToPlan && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-[11px] gap-1.5 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLoadToPlan(route)
                      }}
                    >
                      <ArrowUpRight className="size-3" />
                      Naloži v Načrtuj
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Show more */}
      {hasMore && (
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setVisibleCount(prev => prev + 12)}
          >
            <ChevronDown className="size-3.5" />
            Prikaži več ({filteredRoutes.length - visibleCount} ostaja)
          </Button>
        </div>
      )}
    </div>
  )
}
