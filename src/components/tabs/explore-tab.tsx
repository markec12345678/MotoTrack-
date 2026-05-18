'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Compass, Search, X, Bike, Route, TrendingUp,
  Heart, User, Clock, Star, Trophy, Crown, Medal,
  Users, Plus, LogOut, Shield, Sparkles, UserPlus,
  UserCheck, UserMinus, UserX, Send, MapPin, Calendar,
  ChevronRight, Trash2, Wrench, Fuel, GitCompare, ArrowLeft, Tent,
  Gauge, Film, Play, Maximize2, Minimize2, Navigation, Cloud, AlertTriangle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import type { RideData, RouteData, LeaderboardUser, CommunityData, FriendshipData, GroupRideData } from '@/components/tabs/types'
import { formatDuration, categoryLabel, categoryColor, formatDate } from '@/components/tabs/types'
import ChallengesPanel from '@/components/challenges-panel'
import ServiceLocator from '@/components/service-locator'
import FuelPriceCard from '@/components/fuel-price-card'
import SmartConsumptionPanel from '@/components/smart-consumption-panel'
import BalkanEventsPanel from '@/components/balkan-events-panel'
import BalkanCampsPanel from '@/components/balkan-camps-panel'
import RideComparisonPanel from '@/components/ride-comparison-panel'
import BalkanRoadsPanel from '@/components/balkan-roads-panel'
import BalkanTours from '@/components/balkan-tours-panel'
import NearbyRoadsPanel from '@/components/nearby-roads-panel'
import WeatherSuitability from '@/components/weather-suitability'
import RoadConditionsPanel from '@/components/road-conditions-panel'
import TouringScore from '@/components/touring-score'
import BikeGarage from '@/components/bike-garage'
import dynamic from 'next/dynamic'

const MoviePlayer = dynamic(() => import('@/components/movie-player'), { ssr: false, loading: () => null })

// Tab pill component (defined outside render to avoid re-creation)
function TabPill({ active, onClick, icon, label, badge, notification }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: React.ReactNode
  notification?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge}
      {notification !== undefined && notification > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full size-4 flex items-center justify-center">{notification}</span>
      )}
    </button>
  )
}

interface ExploreTabProps {
  rides: RideData[]
  routes: RouteData[]
  leaderboard: LeaderboardUser[]
  onOpenDetail: (item: RideData | RouteData, type: 'ride' | 'route') => void
  onSwitchUser: (userId: string) => void
  userId?: string
  fullscreen?: boolean
  onToggleFullscreen?: (fullscreen: boolean) => void
  onLoadToPlan?: (waypoints: { lat: number; lng: number }[], name: string) => void
}

const ExploreTabInner = React.memo(function ExploreTabInner({ rides, routes, leaderboard, onOpenDetail, onSwitchUser, userId, fullscreen, onToggleFullscreen, onLoadToPlan }: ExploreTabProps) {
  const [exploreFilter, setExploreFilter] = useState<'all' | 'rides' | 'routes'>('all')
  const [exploreCategory, setExploreCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 200)
  const [exploreSection, setExploreSection] = useState<'discover' | 'feed' | 'favorites' | 'communities' | 'friends' | 'grouprides' | 'challenges' | 'services' | 'fuel' | 'consumption' | 'comparison' | 'events' | 'camps' | 'balkanroads' | 'balkantours' | 'nearbyroads' | 'weather' | 'roadconditions' | 'cinema' | 'garage' | 'touring'>('discover')

  // Cinema state
  const [cinemaRideId, setCinemaRideId] = useState<string | null>(null)


  // Social Feed state
  const [feedItems, setFeedItems] = useState<import('@/components/tabs/types').SocialActivityData[]>([])
  const [feedLoading, setFeedLoading] = useState(false)

  // Favorites state
  const [favoriteItems, setFavoriteItems] = useState<import('@/components/tabs/types').FavoriteData[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  // Communities state
  const [communities, setCommunities] = useState<CommunityData[]>([])
  const [showCreateCommunity, setShowCreateCommunity] = useState(false)
  const [newCommunityName, setNewCommunityName] = useState('')
  const [newCommunityDesc, setNewCommunityDesc] = useState('')
  const [newCommunityAvatar, setNewCommunityAvatar] = useState('🏍️')
  const [creatingCommunity, setCreatingCommunity] = useState(false)

  // Friends state
  const [friendships, setFriendships] = useState<FriendshipData[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const debouncedFriendSearch = useDebounce(friendSearch, 200)
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string; avatar: string | null; bike: string | null }>>([])
  const [addingFriend, setAddingFriend] = useState<string | null>(null)

  // Group Rides state
  const [groupRides, setGroupRides] = useState<GroupRideData[]>([])
  const [showCreateGroupRide, setShowCreateGroupRide] = useState(false)
  const [newGroupRideTitle, setNewGroupRideTitle] = useState('')
  const [newGroupRideDesc, setNewGroupRideDesc] = useState('')
  const [newGroupRideDate, setNewGroupRideDate] = useState('')
  const [newGroupRideMeetingPlace, setNewGroupRideMeetingPlace] = useState('')
  const [newGroupRideDestinationPlace, setNewGroupRideDestinationPlace] = useState('')
  const [newGroupRideMaxRiders, setNewGroupRideMaxRiders] = useState(10)
  const [newGroupRideCategory, setNewGroupRideCategory] = useState('scenic')
  const [creatingGroupRide, setCreatingGroupRide] = useState(false)
  const [groupRideFilter, setGroupRideFilter] = useState<string>('all')

  // Fetch social feed
  const fetchFeed = useCallback(() => {
    setFeedLoading(true)
    const url = userId ? `/api/feed?userId=${userId}&limit=30` : '/api/feed?limit=30'
    fetch(url)
      .then(r => r.json())
      .then(j => { setFeedItems(j.data || []); setFeedLoading(false) })
      .catch(() => setFeedLoading(false))
  }, [userId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchFeed() }, [fetchFeed])

  // Fetch favorites
  const fetchFavorites = useCallback(() => {
    if (!userId) return
    setFavoritesLoading(true)
    fetch(`/api/favorites?userId=${userId}`)
      .then(r => r.json())
      .then(j => { setFavoriteItems(j.data || []); setFavoritesLoading(false) })
      .catch(() => setFavoritesLoading(false))
  }, [userId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchFavorites() }, [fetchFavorites])

  // Fetch communities
  useEffect(() => {
    const url = userId ? `/api/communities?userId=${userId}` : '/api/communities'
    fetch(url)
      .then(r => r.json())
      .then(j => setCommunities(j.data || []))
      .catch(() => {})
  }, [userId])

  // Fetch friendships
  const fetchFriendships = useCallback(() => {
    if (!userId) return
    fetch(`/api/friends?userId=${userId}&status=all`)
      .then(r => r.json())
      .then(j => setFriendships(j.data || []))
      .catch(() => {})
  }, [userId])

  useEffect(() => { fetchFriendships() }, [fetchFriendships])

  // Fetch all users for "Add friend" section
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(j => setAllUsers(j.data || []))
      .catch(() => {})
  }, [])

  // Fetch group rides
  const fetchGroupRides = useCallback(() => {
    const statusParam = groupRideFilter !== 'all' ? `&status=${groupRideFilter}` : ''
    fetch(`/api/group-rides?limit=50${statusParam}`)
      .then(r => r.json())
      .then(j => setGroupRides(j.data || []))
      .catch(() => {})
  }, [groupRideFilter])

  useEffect(() => { fetchGroupRides() }, [fetchGroupRides])

  // Derived friend lists
  const acceptedFriends = useMemo(() =>
    friendships.filter(f => f.status === 'accepted'),
    [friendships]
  )

  const pendingReceived = useMemo(() =>
    friendships.filter(f => f.status === 'pending' && f.addresseeId === userId),
    [friendships, userId]
  )

  const pendingSent = useMemo(() =>
    friendships.filter(f => f.status === 'pending' && f.requesterId === userId),
    [friendships, userId]
  )

  // Non-friend users (excluding self and users with existing friendship)
  const nonFriendUsers = useMemo(() => {
    const friendIds = new Set(friendships.map(f => f.friend.id))
    friendIds.add(userId || '')
    return allUsers.filter(u => !friendIds.has(u.id))
  }, [allUsers, friendships, userId])

  // Filtered lists
  const filteredFriends = useMemo(() => {
    if (!debouncedFriendSearch) return acceptedFriends
    const q = debouncedFriendSearch.toLowerCase()
    return acceptedFriends.filter(f =>
      f.friend.name.toLowerCase().includes(q) ||
      (f.friend.bike || '').toLowerCase().includes(q)
    )
  }, [acceptedFriends, debouncedFriendSearch])

  const filteredNonFriends = useMemo(() => {
    if (!debouncedFriendSearch) return nonFriendUsers
    const q = debouncedFriendSearch.toLowerCase()
    return nonFriendUsers.filter(u =>
      u.name.toLowerCase().includes(q) ||
      (u.bike || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  }, [nonFriendUsers, debouncedFriendSearch])

  // Friend actions
  const handleAddFriend = async (addresseeId: string) => {
    if (!userId) { toast.error('Izberite uporabnika'); return }
    setAddingFriend(addresseeId)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: userId, addresseeId }),
      })
      if (res.ok) {
        toast.success('Prošnja za prijateljstvo poslana!')
        fetchFriendships()
      } else {
        const j = await res.json()
        toast.error(j.error || 'Napaka')
      }
    } catch { toast.error('Napaka') }
    setAddingFriend(null)
  }

  const handleAcceptFriend = async (friendshipId: string) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted', userId }),
      })
      if (res.ok) {
        toast.success('Prijateljstvo sprejeto!')
        fetchFriendships()
      } else { toast.error('Napaka') }
    } catch { toast.error('Napaka') }
  }

  const handleRejectFriend = async (friendshipId: string) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', userId }),
      })
      if (res.ok) {
        toast.success('Prošnja zavrnjena')
        fetchFriendships()
      } else { toast.error('Napaka') }
    } catch { toast.error('Napaka') }
  }

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        toast.success('Prijatelj odstranjen')
        fetchFriendships()
      } else { toast.error('Napaka') }
    } catch { toast.error('Napaka') }
  }

  const filteredItems = useMemo(() => {
    const items: Array<{ type: 'ride' | 'route'; data: RideData | RouteData; category: string }> = [
      ...rides.map(r => ({ type: 'ride' as const, data: r as RideData | RouteData, category: 'scenic' })),
      ...routes.map(r => ({ type: 'route' as const, data: r as RideData | RouteData, category: r.category })),
    ]
    return items.filter(item => {
      if (exploreFilter === 'rides' && item.type !== 'ride') return false
      if (exploreFilter === 'routes' && item.type !== 'route') return false
      if (exploreCategory !== 'all' && item.category !== exploreCategory) return false
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase()
        const title = item.data.title.toLowerCase()
        const desc = (item.data.description || '').toLowerCase()
        if (!title.includes(q) && !desc.includes(q)) return false
      }
      return true
    })
  }, [rides, routes, exploreFilter, exploreCategory, debouncedSearchQuery])

  const exploreStats = useMemo(() => ({
    totalRides: rides.length, totalRoutes: routes.length,
    totalDistance: Math.round(rides.reduce((s, r) => s + r.distance, 0) + routes.reduce((s, r) => s + r.distance, 0)),
  }), [rides, routes])

  const handleJoinCommunity = async (communityId: string) => {
    if (!userId) { toast.error('Izberite uporabnika'); return }
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        toast.success('Pridružili ste se skupnosti!')
        const url = `/api/communities?userId=${userId}`
        fetch(url).then(r => r.json()).then(j => setCommunities(j.data || []))
      } else {
        const j = await res.json()
        toast.error(j.error || 'Napaka')
      }
    } catch { toast.error('Napaka') }
  }

  const handleLeaveCommunity = async (communityId: string) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/communities/${communityId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        toast.success('Zapustili ste skupnost')
        const url = `/api/communities?userId=${userId}`
        fetch(url).then(r => r.json()).then(j => setCommunities(j.data || []))
      }
    } catch { toast.error('Napaka') }
  }

  const handleCreateCommunity = async () => {
    if (!userId || !newCommunityName.trim()) { toast.error('Vnesite ime skupnosti'); return }
    setCreatingCommunity(true)
    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCommunityName.trim(),
          description: newCommunityDesc.trim() || null,
          avatar: newCommunityAvatar,
          userId,
        }),
      })
      if (res.ok) {
        toast.success('Skupnost ustvarjena!')
        setShowCreateCommunity(false)
        setNewCommunityName('')
        setNewCommunityDesc('')
        const url = `/api/communities?userId=${userId}`
        fetch(url).then(r => r.json()).then(j => setCommunities(j.data || []))
      } else { toast.error('Napaka pri ustvarjanju') }
    } catch { toast.error('Napaka') }
    setCreatingCommunity(false)
  }

  const roleLabel = (role: string) => role === 'admin' ? 'Upravitelj' : role === 'moderator' ? 'Moderator' : 'Član'
  const roleIcon = (role: string) => role === 'admin' ? <Shield className="size-3 text-amber-400" /> : role === 'moderator' ? <Star className="size-3 text-sky-400" /> : null

  // Relative time formatting (Slovenian)
  const relativeTime = (date: string) => {
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)
    if (diffMin < 1) return 'zdaj'
    if (diffMin === 1) return 'pred 1 min'
    if (diffMin < 60) return `pred ${diffMin} min`
    if (diffHr === 1) return 'pred 1 uro'
    if (diffHr === 2) return 'pred 2 urama'
    if (diffHr < 24) return `pred ${diffHr} urami`
    if (diffDay === 1) return 'včeraj'
    if (diffDay < 7) return `pred ${diffDay} dnevi`
    return formatDate(date)
  }

  // Category gradient for card strips
  const categoryGradient = (cat: string) => {
    switch (cat) {
      case 'scenic': return 'from-emerald-400 to-emerald-600'
      case 'twisty': return 'from-sky-400 to-sky-600'
      case 'offroad': return 'from-orange-400 to-orange-600'
      case 'city': return 'from-violet-400 to-violet-600'
      default: return 'from-primary/60 to-primary/40'
    }
  }

  // Popular routes for featured section
  const popularRoutes = useMemo(() =>
    [...routes].sort((a, b) => b.likes - a.likes).slice(0, 3),
    [routes]
  )

  // Auto-expand when any input/textarea is focused (form entry mode)
  const handleFocusCapture = useCallback(() => {
    if (!fullscreen && onToggleFullscreen) {
      onToggleFullscreen(true)
    }
  }, [fullscreen, onToggleFullscreen])

  return (
    <div
      className={`w-full overflow-y-auto custom-scrollbar transition-all duration-300 ${
        fullscreen
          ? 'h-[100vh] fixed inset-0 z-[1399] bg-background'
          : 'h-[calc(100vh-120px)]'
      }`}
      onFocusCapture={handleFocusCapture}
    >
      {/* Fullscreen header bar */}
      {fullscreen && (
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-background/95 backdrop-blur-md border-b border-border/30">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            <span className="text-sm font-bold">Raziskuj</span>
            <span className="text-[10px] text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">Cel zaslon</span>
          </div>
          <button
            onClick={() => onToggleFullscreen?.(false)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full bg-secondary hover:bg-muted"
          >
            <Minimize2 className="size-3.5" />
            Skrči
          </button>
        </div>
      )}
      <div className={`mx-auto max-w-4xl ${fullscreen ? 'px-4 py-4' : 'px-4 py-6'}`}>
        {/* Section tabs + fullscreen toggle */}
        <div className="space-y-1.5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            {!fullscreen && onToggleFullscreen && (
              <button
                onClick={() => onToggleFullscreen(true)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-full hover:bg-primary/10"
                title="Razširi na cel zaslon"
              >
                <Maximize2 className="size-3" />
                Cel zaslon
              </button>
            )}
          </div>
          {/* Primary row */}
          <div className="flex gap-1 flex-wrap">
            <TabPill
              active={exploreSection === 'discover'}
              onClick={() => setExploreSection('discover')}
              icon={<Compass className="size-3.5" />}
              label="Odkrij"
            />
            <TabPill
              active={exploreSection === 'feed'}
              onClick={() => { setExploreSection('feed'); fetchFeed() }}
              icon={<Sparkles className="size-3.5" />}
              label="Novice"
            />
            <TabPill
              active={exploreSection === 'favorites'}
              onClick={() => { setExploreSection('favorites'); fetchFavorites() }}
              icon={<Star className="size-3.5" />}
              label="Priljubljene"
              badge={favoriteItems.length > 0 ? <span className="text-[10px] opacity-70">({favoriteItems.length})</span> : undefined}
            />
            <TabPill
              active={exploreSection === 'communities'}
              onClick={() => setExploreSection('communities')}
              icon={<Users className="size-3.5" />}
              label="Skupnosti"
              badge={communities.length > 0 ? <span className="text-[10px] opacity-70">({communities.length})</span> : undefined}
            />
            <TabPill
              active={exploreSection === 'friends'}
              onClick={() => setExploreSection('friends')}
              icon={<UserPlus className="size-3.5" />}
              label="Prijatelji"
              badge={acceptedFriends.length > 0 ? <span className="text-[10px] opacity-70">({acceptedFriends.length})</span> : undefined}
              notification={pendingReceived.length}
            />
          </div>
          {/* Secondary row */}
          <div className="flex gap-1 flex-wrap">
            <TabPill
              active={exploreSection === 'grouprides'}
              onClick={() => { setExploreSection('grouprides'); fetchGroupRides() }}
              icon={<Bike className="size-3.5" />}
              label="Vožnje"
              badge={groupRides.length > 0 ? <span className="text-[10px] opacity-70">({groupRides.length})</span> : undefined}
            />
            <TabPill
              active={exploreSection === 'challenges'}
              onClick={() => setExploreSection('challenges')}
              icon={<Trophy className="size-3.5" />}
              label="Izzivi"
            />
            <TabPill
              active={exploreSection === 'services'}
              onClick={() => setExploreSection('services')}
              icon={<Wrench className="size-3.5" />}
              label="Servisi"
            />
            <TabPill
              active={exploreSection === 'fuel'}
              onClick={() => setExploreSection('fuel')}
              icon={<Fuel className="size-3.5" />}
              label="Gorivo"
            />
            <TabPill
              active={exploreSection === 'consumption'}
              onClick={() => setExploreSection('consumption')}
              icon={<Gauge className="size-3.5" />}
              label="Poraba"
            />
            <TabPill
              active={exploreSection === 'comparison'}
              onClick={() => { setExploreSection('comparison') }}
              icon={<GitCompare className="size-3.5" />}
              label="Primerjava"
            />
            <TabPill
              active={exploreSection === 'events'}
              onClick={() => setExploreSection('events')}
              icon={<Calendar className="size-3.5" />}
              label="Dogodki"
            />
            <TabPill
              active={exploreSection === 'camps'}
              onClick={() => setExploreSection('camps')}
              icon={<span className="text-sm">⛺</span>}
              label="Kampi"
            />
            <TabPill
              active={exploreSection === 'balkanroads'}
              onClick={() => setExploreSection('balkanroads')}
              icon={<span className="text-sm">🗺️</span>}
              label="Ceste"
            />
            <TabPill
              active={exploreSection === 'balkantours'}
              onClick={() => setExploreSection('balkantours')}
              icon={<span className="text-sm">🏔️</span>}
              label="Ture"
            />
            <TabPill
              active={exploreSection === 'cinema'}
              onClick={() => setExploreSection('cinema')}
              icon={<Film className="size-3.5" />}
              label="Cinema"
            />
            <TabPill
              active={exploreSection === 'nearbyroads'}
              onClick={() => setExploreSection('nearbyroads')}
              icon={<Navigation className="size-3.5" />}
              label="Bližnje"
            />
            <TabPill
              active={exploreSection === 'weather'}
              onClick={() => setExploreSection('weather')}
              icon={<Cloud className="size-3.5" />}
              label="Vreme"
            />
            <TabPill
              active={exploreSection === 'roadconditions'}
              onClick={() => setExploreSection('roadconditions')}
              icon={<AlertTriangle className="size-3.5" />}
              label="Ceste stanje"
            />
            <TabPill
              active={exploreSection === 'touring'}
              onClick={() => setExploreSection('touring')}
              icon={<Trophy className="size-3.5" />}
              label="Ocena"
            />
            <TabPill
              active={exploreSection === 'garage'}
              onClick={() => setExploreSection('garage')}
              icon={<Bike className="size-3.5" />}
              label="Garaža"
            />
          </div>
        </div>

        {exploreSection === 'feed' ? (
          /* ====== SOCIAL FEED SECTION ====== */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="size-5 text-primary" /> Novice
              </h2>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={fetchFeed}>
                <TrendingUp className="size-3.5" /> Osveži
              </Button>
            </div>

            {feedLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <Card key={i} className="animate-pulse rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className="size-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : feedItems.length === 0 ? (
              <div className="text-center py-16">
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="size-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Ni aktivnosti</p>
                <p className="text-xs text-muted-foreground mt-1">Začnite z vožnjo, da vidite novice!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedItems.map(item => {
                  const typeIcon = item.type === 'ride_completed' ? '🏍️' : item.type === 'route_shared' ? '🗺️' : item.type === 'achievement_earned' ? '🏆' : item.type === 'challenge_joined' ? '⚔️' : item.type === 'community_joined' ? '👥' : item.type === 'group_ride_created' ? '🚀' : item.type === 'photo_uploaded' ? '📸' : '💬'
                  const typeLabel = item.type === 'ride_completed' ? 'zaključil vožnjo' : item.type === 'route_shared' ? 'delil pot' : item.type === 'achievement_earned' ? 'pridobil dosežek' : item.type === 'challenge_joined' ? 'se pridružil izzivu' : item.type === 'community_joined' ? 'se pridružil skupnosti' : item.type === 'group_ride_created' ? 'ustvaril skupinsko vožnjo' : item.type === 'photo_uploaded' ? 'dodal fotografijo' : 'komentiral'
                  return (
                    <Card key={item.id} className="rounded-xl hover:border-primary/30 transition-all group">
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center text-lg shrink-0">
                            {typeIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Avatar className="size-7 border border-primary/10">
                                <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">{item.user?.name?.charAt(0) || '?'}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{item.user?.name || 'Neznan'}</span>
                              <span className="text-xs text-muted-foreground">{typeLabel}</span>
                            </div>
                            <p className="text-sm font-semibold mt-1">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <button
                                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors ${
                                  item.userLiked
                                    ? 'text-red-500 bg-red-500/10'
                                    : 'text-muted-foreground hover:text-red-400 hover:bg-red-500/5'
                                }`}
                                onClick={async () => {
                                  if (!userId) { toast.error('Izberite uporabnika'); return }
                                  try {
                                    const res = await fetch(`/api/feed/${item.id}/like`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId }),
                                    })
                                    if (res.ok) {
                                      const j = await res.json()
                                      setFeedItems(prev => prev.map(f => f.id === item.id ? { ...f, userLiked: j.data.liked, likes: j.data.likesCount } : f))
                                    }
                                  } catch { /* ignore */ }
                                }}
                              >
                                <Heart className={`size-3.5 ${item.userLiked ? 'fill-red-500' : ''}`} />
                                {item.likes > 0 && <span className="font-medium">{item.likes}</span>}
                              </button>
                              <span className="text-xs text-muted-foreground">{relativeTime(item.createdAt)}</span>
                              {item.targetType && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1 px-2"
                                  onClick={() => {
                                    if (item.targetType === 'ride') {
                                      const ride = rides.find(r => r.id === item.targetId)
                                      if (ride) onOpenDetail(ride, 'ride')
                                    } else if (item.targetType === 'route') {
                                      const route = routes.find(r => r.id === item.targetId)
                                      if (route) onOpenDetail(route, 'route')
                                    }
                                  }}
                                >
                                  <ChevronRight className="size-3" /> Odpri
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        ) : exploreSection === 'favorites' ? (
          /* ====== FAVORITES SECTION ====== */
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Star className="size-5 text-primary" /> Priljubljene
            </h2>

            {!userId ? (
              <div className="text-center py-16">
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Star className="size-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Izberite uporabnika</p>
                <p className="text-xs text-muted-foreground mt-1">Za ogled priljubljenih izberite svoj profil</p>
              </div>
            ) : favoritesLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <Card key={i} className="animate-pulse rounded-xl">
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : favoriteItems.length === 0 ? (
              <div className="text-center py-16">
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Star className="size-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Ni priljubljenih</p>
                <p className="text-xs text-muted-foreground mt-1">Kliknite ★ v podrobnostih vožnje/poti za dodajanje</p>
              </div>
            ) : (
              <div className="space-y-2">
                {favoriteItems.map(fav => {
                  const isRide = !!fav.ride
                  const item = fav.ride || fav.route
                  if (!item) return null
                  return (
                    <Card key={fav.id} className="rounded-xl hover:border-primary/30 transition-all group cursor-pointer overflow-hidden" onClick={() => {
                      if (fav.ride) onOpenDetail(fav.ride as unknown as RideData, 'ride')
                      else if (fav.route) onOpenDetail(fav.route as unknown as RouteData, 'route')
                    }}>
                      <div className={`h-0.5 bg-gradient-to-r ${isRide ? 'from-amber-400 to-amber-600' : 'from-emerald-400 to-emerald-600'}`} />
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${isRide ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {isRide ? <Bike className="size-5" /> : <Route className="size-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{item.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{item.distance?.toFixed(1)} km</span>
                            {!isRide && 'category' in item && <Badge variant="outline" className="text-[9px] px-1 py-0">{categoryLabel((item as unknown as RouteData).category)}</Badge>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-amber-400 hover:text-amber-300"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const body: Record<string, string> = { userId }
                              if (fav.rideId) body.rideId = fav.rideId
                              if (fav.routeId) body.routeId = fav.routeId
                              await fetch('/api/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                              toast.success('Odstranjeno iz priljubljenih')
                              fetchFavorites()
                            } catch { toast.error('Napaka') }
                          }}
                        >
                          <Star className="size-4 fill-current" />
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        ) : exploreSection === 'friends' ? (
          /* ====== FRIENDS SECTION ====== */
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="size-5 text-primary" /> Prijatelji
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><UserCheck className="size-3" /> {acceptedFriends.length}</span>
                {pendingReceived.length > 0 && (
                  <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0">
                    {pendingReceived.length} {pendingReceived.length === 1 ? 'prošnja' : 'prošnje'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Search friends */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Išči prijatelje po imenu..."
                value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
                className="pl-9"
              />
              {friendSearch && (
                <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setFriendSearch('')}>
                  <X className="size-3" />
                </Button>
              )}
            </div>

            {/* Pending received requests */}
            {pendingReceived.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-400">
                  <Send className="size-4" /> Prejete prošnje ({pendingReceived.length})
                </h3>
                <div className="space-y-2">
                  {pendingReceived.map(f => (
                    <Card key={f.id} className="rounded-xl border-amber-500/20 hover:border-amber-500/30 transition-all">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="text-sm bg-amber-500/20 text-amber-400 font-semibold">{f.friend.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{f.friend.name}</p>
                          <p className="text-xs text-muted-foreground">{f.friend.bike || 'Motocikel'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="sm" className="text-xs gap-1 h-7 bg-green-500 hover:bg-green-600" onClick={() => handleAcceptFriend(f.id)}>
                            <UserCheck className="size-3" /> Sprejmi
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs gap-1 h-7 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => handleRejectFriend(f.id)}>
                            <UserX className="size-3" /> Zavrni
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Pending sent requests */}
            {pendingSent.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <Send className="size-4" /> Poslane prošnje ({pendingSent.length})
                </h3>
                <div className="space-y-2">
                  {pendingSent.map(f => (
                    <Card key={f.id} className="rounded-xl opacity-70">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="text-sm bg-primary/20 text-primary font-semibold">{f.friend.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{f.friend.name}</p>
                          <p className="text-xs text-muted-foreground">{f.friend.bike || 'Motocikel'}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Čaka potrditev
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted friends */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="size-4 text-primary" /> Moji prijatelji ({acceptedFriends.length})
              </h3>
              {filteredFriends.length > 0 ? (
                <div className="space-y-2">
                  {filteredFriends.map(f => (
                    <Card key={f.id} className="rounded-xl hover:border-primary/30 transition-all group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="text-sm bg-primary/20 text-primary font-semibold">{f.friend.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{f.friend.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Bike className="size-3" /> {f.friend.bike || 'Motocikel'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 h-7 text-red-400 border-red-500/30 hover:bg-red-500/10 shrink-0"
                          onClick={() => handleRemoveFriend(f.id)}
                        >
                          <UserMinus className="size-3" /> Odstrani
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <UserCheck className="size-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {friendSearch ? 'Ni prijateljev s tem imenom' : 'Še nimate prijateljev'}
                  </p>
                  {!friendSearch && <p className="text-xs text-muted-foreground mt-1">Dodajte prijatelje spodaj!</p>}
                </div>
              )}
            </div>

            {/* Add friend section */}
            {!userId ? (
              <div className="text-center py-12">
                <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <User className="size-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">Izberite uporabnika</p>
                <p className="text-xs text-muted-foreground mt-1">Za upravljanje prijateljev izberite svoj profil</p>
              </div>
            ) : filteredNonFriends.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="size-4 text-primary" /> Dodaj prijatelja ({nonFriendUsers.length})
                </h3>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {filteredNonFriends.map(u => (
                      <Card key={u.id} className="rounded-xl hover:border-primary/30 transition-all group">
                        <CardContent className="p-4 flex items-center gap-3">
                          <Avatar className="size-10">
                            <AvatarFallback className="text-sm bg-primary/20 text-primary font-semibold">{u.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{u.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Bike className="size-3" /> {u.bike || 'Motocikel'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="text-xs gap-1 h-7 shrink-0"
                            onClick={() => handleAddFriend(u.id)}
                            disabled={addingFriend === u.id}
                          >
                            {addingFriend === u.id ? (
                              'Pošiljam...'
                            ) : (
                              <><Plus className="size-3" /> Dodaj</>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Users className="size-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">Vsi uporabniki so že vaši prijatelji!</p>
              </div>
            )}
          </div>
        ) : exploreSection === 'grouprides' ? (
          /* ====== GROUP RIDES SECTION ====== */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Bike className="size-5 text-primary" /> Skupinske vožnje
              </h2>
              {userId && (
                <Button size="sm" className="text-xs gap-1" onClick={() => setShowCreateGroupRide(true)}>
                  <Plus className="size-3.5" /> Nova vožnja
                </Button>
              )}
            </div>

            {/* Filter */}
            <div className="flex gap-1 flex-wrap">
              {['all', 'upcoming', 'active', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => { setGroupRideFilter(f); fetchGroupRides() }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    groupRideFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'Vse' : f === 'upcoming' ? 'Prihajajoče' : f === 'active' ? 'Aktivne' : 'Zaključene'}
                </button>
              ))}
            </div>

            {/* Group rides list */}
            {groupRides.length === 0 ? (
              <div className="text-center py-16">
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Bike className="size-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Ni skupinskih voženj</p>
                <p className="text-xs text-muted-foreground mt-1">Ustvarite prvo skupinsko vožnjo!</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {groupRides.map(gr => (
                  <Card key={gr.id} className="rounded-xl overflow-hidden hover:border-primary/30 transition-all group">
                    <div className={`h-0.5 bg-gradient-to-r ${categoryGradient(gr.category)}`} />
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center text-lg shrink-0">
                          {gr.category === 'twisty' ? '🔄' : gr.category === 'offroad' ? '🏔️' : gr.category === 'city' ? '🏙️' : '🌅'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm group-hover:text-primary transition-colors truncate">{gr.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{gr.description || 'Skupinska motorna vožnja'}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="size-3" /> {new Date(gr.date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="flex items-center gap-1"><MapPin className="size-3" /> {gr.meetingPlace}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[9px]">{gr.category === 'twisty' ? 'Vijugasta' : gr.category === 'offroad' ? 'Off-road' : gr.category === 'city' ? 'Mestna' : 'Scenična'}</Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Users className="size-3" /> {gr.participants?.length ?? 0}/{gr.maxRiders}</span>
                            <Badge variant="outline" className={`text-[9px] ${gr.status === 'upcoming' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : gr.status === 'active' ? 'bg-green-500/15 text-green-500 border-green-500/30' : 'bg-muted text-muted-foreground'}`}>
                              {gr.status === 'upcoming' ? 'Prihajajoča' : gr.status === 'active' ? 'Aktivna' : gr.status === 'completed' ? 'Zaključena' : gr.status}
                            </Badge>
                          </div>
                          {/* Participant avatars */}
                          {gr.participants && gr.participants.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              {gr.participants.slice(0, 4).map(p => (
                                <Avatar key={p.id} className="size-5 border border-background">
                                  <AvatarFallback className="text-[7px] bg-primary/20 text-primary">{p.user?.name?.charAt(0) || '?'}</AvatarFallback>
                                </Avatar>
                              ))}
                              {gr.participants.length > 4 && <span className="text-[10px] text-muted-foreground">+{gr.participants.length - 4}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {userId && !gr.participants?.some((p: { userId: string }) => p.userId === userId) ? (
                          <Button size="sm" className="flex-1 text-xs gap-1" onClick={async () => {
                            try {
                              const res = await fetch(`/api/group-rides/${gr.id}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, status: 'joined' }) })
                              if (res.ok) { toast.success('Pridružili ste se!'); fetchGroupRides() }
                              else { const j = await res.json(); toast.error(j.error || 'Napaka') }
                            } catch { toast.error('Napaka') }
                          }}>
                            <Plus className="size-3" /> Pridruži se
                          </Button>
                        ) : userId && gr.participants?.some((p: { userId: string }) => p.userId === userId) ? (
                          <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={async () => {
                            try {
                              const res = await fetch(`/api/group-rides/${gr.id}/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
                              if (res.ok) { toast.success('Zapustili ste vožnjo'); fetchGroupRides() }
                            } catch { toast.error('Napaka') }
                          }}>
                            Zapusti
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={async () => {
                          try {
                            const res = await fetch(`/api/group-rides/${gr.id}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, status: 'maybe' }) })
                            if (res.ok) { toast.success('Označeno kot morda'); fetchGroupRides() }
                          } catch { toast.error('Napaka') }
                        }}>
                          Morda
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Create Group Ride Dialog */}
            {showCreateGroupRide && (
              <Dialog open onOpenChange={(open) => { if (!open) setShowCreateGroupRide(false) }}>
                <DialogContent className="sm:max-w-md">
                  <DialogTitle>Nova skupinska vožnja</DialogTitle>
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">Naslov</Label>
                      <Input placeholder="Npr. Nedeljski izlet" value={newGroupRideTitle} onChange={e => setNewGroupRideTitle(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">Opis</Label>
                      <Input placeholder="Kratek opis vožnje..." value={newGroupRideDesc} onChange={e => setNewGroupRideDesc(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">Datum in ura</Label>
                      <Input type="datetime-local" value={newGroupRideDate} onChange={e => setNewGroupRideDate(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">Zbirno mesto</Label>
                      <Input placeholder="Npr. Petrol Ljubljana" value={newGroupRideMeetingPlace} onChange={e => setNewGroupRideMeetingPlace(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">Cilj (opcijsko)</Label>
                      <Input placeholder="Npr. Bled" value={newGroupRideDestinationPlace} onChange={e => setNewGroupRideDestinationPlace(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">Max motoristov</Label>
                        <Input type="number" min={2} max={50} value={newGroupRideMaxRiders} onChange={e => setNewGroupRideMaxRiders(parseInt(e.target.value) || 10)} />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">Kategorija</Label>
                        <div className="flex gap-1 flex-wrap">
                          {['scenic', 'twisty', 'offroad', 'city', 'snowmobile', 'racetrack'].map(cat => (
                            <button key={cat} onClick={() => setNewGroupRideCategory(cat)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${newGroupRideCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}>
                              {cat === 'scenic' ? 'Scenična' : cat === 'twisty' ? 'Vijugasta' : cat === 'offroad' ? 'Off-road' : cat === 'city' ? 'Mestna' : cat === 'snowmobile' ? 'Snežni skuter' : 'Dirkališče'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button className="w-full" onClick={async () => {
                      if (!newGroupRideTitle.trim() || !newGroupRideDate || !newGroupRideMeetingPlace.trim()) {
                        toast.error('Izpolnite obvezna polja')
                        return
                      }
                      setCreatingGroupRide(true)
                      try {
                        const res = await fetch('/api/group-rides', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            creatorId: userId,
                            title: newGroupRideTitle,
                            description: newGroupRideDesc || undefined,
                            date: newGroupRideDate,
                            meetingLat: 46.0569, meetingLng: 14.5058,
                            meetingPlace: newGroupRideMeetingPlace,
                            destinationPlace: newGroupRideDestinationPlace || undefined,
                            maxRiders: newGroupRideMaxRiders,
                            category: newGroupRideCategory,
                          }),
                        })
                        if (res.ok) {
                          toast.success('Skupinska vožnja ustvarjena!')
                          setShowCreateGroupRide(false)
                          setNewGroupRideTitle('')
                          setNewGroupRideDesc('')
                          setNewGroupRideDate('')
                          setNewGroupRideMeetingPlace('')
                          fetchGroupRides()
                        } else {
                          const j = await res.json()
                          toast.error(j.error || 'Napaka')
                        }
                      } catch { toast.error('Napaka') }
                      setCreatingGroupRide(false)
                    }} disabled={creatingGroupRide}>
                      {creatingGroupRide ? 'Ustvarjam...' : 'Ustvari skupinsko vožnjo'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ) : exploreSection === 'communities' ? (
          /* ====== COMMUNITIES SECTION ====== */
          <div className="space-y-4">
            {/* Header with create button */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="size-5 text-primary" /> Moto skupnosti
              </h2>
              {userId && (
                <Button size="sm" className="text-xs gap-1" onClick={() => setShowCreateCommunity(true)}>
                  <Plus className="size-3.5" /> Nova skupnost
                </Button>
              )}
            </div>

            {/* Communities grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {communities.map(community => (
                <Card key={community.id} className="rounded-xl overflow-hidden hover:border-primary/30 transition-all group">
                  <div className="h-0.5 bg-gradient-to-r from-primary/60 via-accent/40 to-primary/20" />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-xl bg-primary/15 flex items-center justify-center text-2xl shrink-0">
                        {community.avatar || '🏍️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm group-hover:text-primary transition-colors truncate">{community.name}</h3>
                        {community.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{community.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="size-3" /> {community.memberCount}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Bike className="size-3" /> {community.rideCount} voženj
                          </span>
                          {community.isMember && community.userRole && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 flex items-center gap-0.5">
                              {roleIcon(community.userRole)} {roleLabel(community.userRole)}
                            </Badge>
                          )}
                        </div>
                        {/* Recent members */}
                        {community.recentMembers.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {community.recentMembers.slice(0, 3).map(m => (
                              <Avatar key={m.id} className="size-5 border border-background">
                                <AvatarFallback className="text-[7px] bg-primary/20 text-primary">{m.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {community.memberCount > 3 && (
                              <span className="text-[10px] text-muted-foreground ml-1">+{community.memberCount - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      {community.isMember ? (
                        <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => handleLeaveCommunity(community.id)}>
                          <LogOut className="size-3" /> Zapusti
                        </Button>
                      ) : (
                        <Button size="sm" className="w-full text-xs gap-1" onClick={() => handleJoinCommunity(community.id)}>
                          <Plus className="size-3" /> Pridruži se
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {communities.length === 0 && (
              <div className="text-center py-16">
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Ni skupnosti</p>
                <p className="text-xs text-muted-foreground mt-1">Ustvarite prvo motociklistično skupnost!</p>
              </div>
            )}
          </div>
        ) : exploreSection === 'challenges' ? (
          /* ====== CHALLENGES SECTION ====== */
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="size-5 text-primary" /> Izzivi
            </h2>
            <ChallengesPanel userId={userId} />
          </div>
        ) : exploreSection === 'services' ? (
          /* ====== SERVICES SECTION ====== */
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Wrench className="size-5 text-primary" /> Servisi
            </h2>
            <ServiceLocator userId={userId} />
          </div>
        ) : exploreSection === 'fuel' ? (
          /* ====== FUEL PRICES SECTION ====== */
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Fuel className="size-5 text-primary" /> Gorivo
            </h2>
            <FuelPriceCard userId={userId} />
          </div>
        ) : exploreSection === 'consumption' ? (
          /* ====== SMART CONSUMPTION SECTION ====== */
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Gauge className="size-5 text-primary" /> Pametna poraba
            </h2>
            <SmartConsumptionPanel userId={userId} />
          </div>
        ) : exploreSection === 'comparison' ? (
          /* ====== RIDE COMPARISON SECTION ====== */
          <RideComparisonPanel rides={rides} userId={userId} />
        ) : exploreSection === 'events' ? (
          /* ====== BALKAN EVENTS SECTION ====== */
          <BalkanEventsPanel userId={userId} />
        ) : exploreSection === 'camps' ? (
          /* ====== BALKAN CAMPS SECTION ====== */
          <BalkanCampsPanel userId={userId} />
        ) : exploreSection === 'balkanroads' ? (
          /* ====== BALKAN ROADS SECTION ====== */
          <BalkanRoadsPanel />
        ) : exploreSection === 'balkantours' ? (
          /* ====== BALKAN TOURS SECTION ====== */
          <BalkanTours onLoadToPlan={onLoadToPlan} />
        ) : exploreSection === 'nearbyroads' ? (
          /* ====== NEARBY ROADS SECTION ====== */
          <NearbyRoadsPanel
            userLat={undefined}
            userLng={undefined}
            onSelectRoad={(road) => {
              // Could navigate map to the road
            }}
          />
        ) : exploreSection === 'weather' ? (
          /* ====== WEATHER SUITABILITY SECTION ====== */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Cloud className="size-5 text-primary" /> Vremenska primernost
              </h2>
            </div>
            <WeatherSuitability />
          </div>
        ) : exploreSection === 'roadconditions' ? (
          /* ====== ROAD CONDITIONS SECTION ====== */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" /> Stanje na cestah
              </h2>
            </div>
            <RoadConditionsPanel userId={userId} userName={undefined} />
          </div>
        ) : exploreSection === 'cinema' ? (
          /* ====== MOTO CINEMA DIRECTOR ====== */
          <div className="space-y-4">
            {/* Cinema Player (full screen overlay) */}
            {cinemaRideId && (
              <MoviePlayer
                rideId={cinemaRideId}
                onClose={() => setCinemaRideId(null)}
              />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Film className="size-5 text-primary" /> Moto Cinema
              </h2>
              <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[9px]">
                REŽISER
              </Badge>
            </div>

            {/* Intro card */}
            <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-primary/5 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-orange-400 via-red-500 to-orange-400" />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-orange-500/20 shrink-0">
                    <Film className="size-6 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Dokumentarni film tvoje vožnje</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Izberi vožnjo in oglej si interaktivni film z animacijo po zemljevidu,
                      telemetrijo, fotografijami in AI narracijo. Kot Relive ali GoPro Quik!
                    </p>
                  </div>
                </div>

                {/* Features list */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: '🗺️', label: 'Animacija po poti' },
                    { icon: '📷', label: 'Smart foto pavze' },
                    { icon: '📊', label: 'Telemetrija LIVE' },
                    { icon: '🎙️', label: 'AI narracija TTS' },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-2 py-1.5">
                      <span className="text-sm">{f.icon}</span>
                      <span>{f.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ride selector */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Bike className="size-4 text-primary" /> Izberi vožnjo za predvajanje
              </h3>

              {rides.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <Bike className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Ni shranjenih voženj</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Snemaj vožnjo v zavihku Sledi, nato jo predvajaj tukaj!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {rides.map(ride => (
                    <Card
                      key={ride.id}
                      className="rounded-xl hover:border-orange-500/30 transition-all group cursor-pointer overflow-hidden"
                      onClick={() => {
                        setCinemaRideId(ride.id)
                        toast.success('🎬 Moto Cinema se začenja!')
                      }}
                    >
                      <div className="h-0.5 bg-gradient-to-r from-orange-400 to-red-500" />
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="flex items-center justify-center size-10 rounded-xl bg-orange-500/20 shrink-0">
                          <Play className="size-5 text-orange-400 ml-0.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate group-hover:text-orange-400 transition-colors">
                            {ride.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{ride.distance?.toFixed(1)} km</span>
                            <span>·</span>
                            <span>{ride.duration ? formatDuration(ride.duration) : '--'}</span>
                            {ride.maxSpeed && (
                              <>
                                <span>·</span>
                                <span className="text-orange-400">{ride.maxSpeed} km/h max</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[9px] shrink-0">
                          PLAY
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">💡 Namig</p>
              <p>
                Med predvajanjem uporabljaj tipke: <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Space</kbd> za premor,
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">←</kbd> <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">→</kbd> za premik,
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> za izhod.
                Fotografije se samodejno prikažejo ob ustreznih točkah!
              </p>
            </div>
          </div>
        ) : exploreSection === 'touring' ? (
          /* ====== TOURING SCORE SECTION ====== */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Trophy className="size-5 text-primary" /> Touring Score
              </h2>
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-[9px]">
                GAMIFIKACIJA
              </Badge>
            </div>
            <TouringScore rides={rides} routes={routes} userId={userId} />
          </div>
        ) : exploreSection === 'garage' ? (
          /* ====== BIKE GARAGE SECTION ====== */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Bike className="size-5 text-primary" /> Garaža
              </h2>
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px]">
                MOTOCIKLI
              </Badge>
            </div>
            <BikeGarage userId={userId} />
          </div>
        ) : (
          /* ====== DISCOVER SECTION ====== */
          <>
            {/* Stats bar */}
            <div className="flex items-center justify-center gap-3 py-3 px-4 bg-secondary/50 rounded-xl mb-6 text-sm">
              <span className="flex items-center gap-1.5">
                <Bike className="size-4 text-primary" />
                <span className="font-bold">{exploreStats.totalRides}</span>
                <span className="text-muted-foreground">voženj</span>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="flex items-center gap-1.5">
                <Route className="size-4 text-primary" />
                <span className="font-bold">{exploreStats.totalRoutes}</span>
                <span className="text-muted-foreground">poti</span>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="size-4 text-primary" />
                <span className="font-bold">{exploreStats.totalDistance}</span>
                <span className="text-muted-foreground">km skupaj</span>
              </span>
            </div>

            {/* Popular Routes Featured Section */}
            {popularRoutes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Star className="size-5 text-amber-400 fill-amber-400" /> Popularne poti
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {popularRoutes.map((route, idx) => (
                    <Card
                      key={route.id}
                      className={`rounded-xl overflow-hidden hover:border-primary/30 transition-all cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 ${
                        idx === 0 ? 'sm:col-span-1 sm:row-span-1 border-amber-500/20' : ''
                      }`}
                      onClick={() => onOpenDetail(route, 'route')}
                    >
                      <div className={`h-0.5 bg-gradient-to-r ${categoryGradient(route.category)}`} />
                      <CardContent className={`p-4 ${idx === 0 ? '' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`flex items-center justify-center size-7 rounded-full shrink-0 ${
                            idx === 0 ? 'bg-amber-400/15' : 'bg-primary/15'
                          }`}>
                            {idx === 0 ? (
                              <Star className="size-3.5 text-amber-400 fill-amber-400" />
                            ) : (
                              <Route className="size-3.5 text-primary" />
                            )}
                          </div>
                          <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{route.title}</span>
                        </div>
                        {route.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{route.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Route className="size-3" /> {route.distance} km
                          </span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${categoryColor(route.category)}`}>
                            {categoryLabel(route.category)}
                          </Badge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Heart className="size-3" /> {route.likes}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Search + Filters */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Išči po imenu ali opisu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                {searchQuery && <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setSearchQuery('')}><X className="size-3" /></Button>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Type filter pills */}
                {(['all', 'rides', 'routes'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setExploreFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      exploreFilter === f
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {f === 'all' ? 'Vse' : f === 'rides' ? 'Vožnje' : 'Poti'}
                  </button>
                ))}
                <Separator orientation="vertical" className="h-5 mx-1" />
                {/* Category filter pills */}
                {['all', 'scenic', 'twisty', 'offroad', 'city', 'snowmobile', 'racetrack'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setExploreCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      exploreCategory === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {cat === 'all' ? 'Vse' : categoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Compass className="size-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Ni najdenih voženj ali poti</p>
                <p className="text-xs text-muted-foreground mt-1">Poskusite spremeniti filtre ali iskalni niz</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredItems.map(item => (
                  <Card key={item.data.id + item.type} className="rounded-xl overflow-hidden hover:border-primary/30 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md" onClick={() => onOpenDetail(item.data, item.type)}>
                    <div className={`h-0.5 bg-gradient-to-r ${categoryGradient(item.category)}`} />
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                          item.type === 'ride' ? 'bg-amber-500/15 text-amber-500' : 'bg-primary/15 text-primary'
                        }`}>
                          {item.type === 'ride' ? <Bike className="size-4" /> : <Route className="size-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{item.data.title}</p>
                            <Badge variant="outline" className={`text-[9px] shrink-0 ${item.type === 'ride' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : categoryColor((item.data as RouteData).category)}`}>
                              {item.type === 'ride' ? 'Vožnja' : categoryLabel((item.data as RouteData).category)}
                            </Badge>
                          </div>
                          {item.data.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.data.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Route className="size-3" />{item.data.distance} km</span>
                            {item.type === 'ride' && <span className="flex items-center gap-1"><Clock className="size-3" />{formatDuration((item.data as RideData).duration)}</span>}
                            {item.type === 'route' && <span className="flex items-center gap-1"><Heart className="size-3" />{(item.data as RouteData).likes}</span>}
                            <span className="flex items-center gap-1"><User className="size-3" />{item.data.user?.name || 'Neznan'}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Trophy className="size-5 text-primary" /> Lestvica motoristov
                </h3>
                <div className="space-y-2">
                  {leaderboard.map((u, i) => (
                    <Card key={u.id} className="rounded-xl hover:border-primary/30 transition-all cursor-pointer" onClick={() => onSwitchUser(u.id)}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`flex items-center justify-center size-8 rounded-full shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-secondary text-muted-foreground'}`}>
                          {i === 0 ? <Crown className="size-4" /> : i === 1 ? <Medal className="size-4" /> : i === 2 ? <Medal className="size-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                        </div>
                        <Avatar className="size-9"><AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">{u.name.charAt(0)}</AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.bike || 'Motocikel'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary">{u.totalDistance} km</p>
                          <p className="text-[10px] text-muted-foreground">{u.totalRides} voženj · {u.totalElevation}m</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Community Dialog */}
      {showCreateCommunity && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowCreateCommunity(false) }}>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Ustvari novo skupnost</DialogTitle>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Ikona</label>
                <div className="flex gap-2 flex-wrap">
                  {['🏍️', '🏔️', '🌊', '🏖️', '🌙', '⚡', '🔥', '🎯', '🛣️', '🌄'].map(emoji => (
                    <button key={emoji} onClick={() => setNewCommunityAvatar(emoji)} className={`size-10 rounded-lg text-xl flex items-center justify-center border-2 transition-colors ${newCommunityAvatar === emoji ? 'border-primary bg-primary/10' : 'border-border hover:border-muted'}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Ime skupnosti</label>
                <Input placeholder="Npr. Gorenjski motoristi" value={newCommunityName} onChange={e => setNewCommunityName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Opis</label>
                <Input placeholder="Kratki opis skupnosti..." value={newCommunityDesc} onChange={e => setNewCommunityDesc(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleCreateCommunity} disabled={creatingCommunity || !newCommunityName.trim()}>
                {creatingCommunity ? 'Ustvarjam...' : 'Ustvari skupnost'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
})

export default function ExploreTab(props: ExploreTabProps) {
  return <ExploreTabInner {...props} />
}
