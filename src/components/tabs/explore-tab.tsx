'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Compass, Search, X, Bike, Route, TrendingUp,
  Heart, User, Clock, Star, Trophy, Crown, Medal,
  Users, Plus, LogOut, Shield, Sparkles, UserPlus,
  UserCheck, UserMinus, UserX, Send,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { RideData, RouteData, LeaderboardUser, CommunityData, FriendshipData } from '@/components/tabs/types'
import { formatDuration, categoryLabel, categoryColor } from '@/components/tabs/types'

interface ExploreTabProps {
  rides: RideData[]
  routes: RouteData[]
  leaderboard: LeaderboardUser[]
  onOpenDetail: (item: RideData | RouteData, type: 'ride' | 'route') => void
  onSwitchUser: (userId: string) => void
  userId?: string
}

export default function ExploreTab({ rides, routes, leaderboard, onOpenDetail, onSwitchUser, userId }: ExploreTabProps) {
  const [exploreFilter, setExploreFilter] = useState<'all' | 'rides' | 'routes'>('all')
  const [exploreCategory, setExploreCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [exploreSection, setExploreSection] = useState<'discover' | 'communities' | 'friends'>('discover')

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
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string; avatar: string | null; bike: string | null }>>([])
  const [addingFriend, setAddingFriend] = useState<string | null>(null)

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
    if (!friendSearch) return acceptedFriends
    const q = friendSearch.toLowerCase()
    return acceptedFriends.filter(f =>
      f.friend.name.toLowerCase().includes(q) ||
      (f.friend.bike || '').toLowerCase().includes(q)
    )
  }, [acceptedFriends, friendSearch])

  const filteredNonFriends = useMemo(() => {
    if (!friendSearch) return nonFriendUsers
    const q = friendSearch.toLowerCase()
    return nonFriendUsers.filter(u =>
      u.name.toLowerCase().includes(q) ||
      (u.bike || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  }, [nonFriendUsers, friendSearch])

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
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const title = item.data.title.toLowerCase()
        const desc = (item.data.description || '').toLowerCase()
        if (!title.includes(q) && !desc.includes(q)) return false
      }
      return true
    })
  }, [rides, routes, exploreFilter, exploreCategory, searchQuery])

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

  return (
    <div className="w-full h-[calc(100vh-104px)] overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Section tabs */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mb-6 w-fit">
          <Button variant={exploreSection === 'discover' ? 'default' : 'ghost'} size="sm" className="text-xs" onClick={() => setExploreSection('discover')}>
            <Compass className="size-3.5 mr-1" /> Odkrij
          </Button>
          <Button variant={exploreSection === 'communities' ? 'default' : 'ghost'} size="sm" className="text-xs gap-1" onClick={() => setExploreSection('communities')}>
            <Users className="size-3.5" /> Skupnosti
            {communities.length > 0 && <span className="text-[10px] opacity-70">({communities.length})</span>}
          </Button>
          <Button variant={exploreSection === 'friends' ? 'default' : 'ghost'} size="sm" className="text-xs gap-1 relative" onClick={() => setExploreSection('friends')}>
            <UserPlus className="size-3.5" /> Prijatelji
            {acceptedFriends.length > 0 && <span className="text-[10px] opacity-70">({acceptedFriends.length})</span>}
            {pendingReceived.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full size-3.5 flex items-center justify-center">{pendingReceived.length}</span>
            )}
          </Button>
        </div>

        {exploreSection === 'friends' ? (
          /* ====== FRIENDS SECTION ====== */
          <div className="space-y-6">
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
                    <Card key={f.id} className="border-amber-500/20 hover:border-amber-500/30 transition-all">
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="text-sm bg-amber-500/20 text-amber-400">{f.friend.name.charAt(0)}</AvatarFallback>
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
                    <Card key={f.id} className="opacity-70">
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="text-sm bg-primary/20 text-primary">{f.friend.name.charAt(0)}</AvatarFallback>
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
                    <Card key={f.id} className="hover:border-primary/30 transition-all group">
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="text-sm bg-primary/20 text-primary">{f.friend.name.charAt(0)}</AvatarFallback>
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
                <div className="text-center py-8">
                  <UserCheck className="size-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {friendSearch ? 'Ni prijateljev s tem imenom' : 'Še nimate prijateljev'}
                  </p>
                  {!friendSearch && <p className="text-xs text-muted-foreground mt-1">Dodajte prijatelje spodaj!</p>}
                </div>
              )}
            </div>

            {/* Add friend section */}
            {!userId ? (
              <div className="text-center py-8">
                <User className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Izberite uporabnika za upravljanje prijateljev</p>
              </div>
            ) : filteredNonFriends.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="size-4 text-primary" /> Dodaj prijatelja ({nonFriendUsers.length})
                </h3>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {filteredNonFriends.map(u => (
                      <Card key={u.id} className="hover:border-primary/30 transition-all group">
                        <CardContent className="p-3 flex items-center gap-3">
                          <Avatar className="size-10">
                            <AvatarFallback className="text-sm bg-primary/20 text-primary">{u.name.charAt(0)}</AvatarFallback>
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
              <div className="text-center py-8">
                <Users className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Vsi uporabniki so že vaši prijatelji!</p>
              </div>
            )}
          </div>
        ) : exploreSection === 'communities' ? (
          /* ====== COMMUNITIES SECTION ====== */
          <div className="space-y-4">
            {/* Header with create button */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="size-5 text-primary" /> Moto skupnosti
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
                <Card key={community.id} className="overflow-hidden hover:border-primary/30 transition-all group">
                  <div className="h-1 bg-gradient-to-r from-primary/60 via-accent/40 to-primary/20" />
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
              <div className="text-center py-12">
                <Users className="size-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Ni skupnosti. Ustvarite prvo!</p>
              </div>
            )}
          </div>
        ) : (
          /* ====== DISCOVER SECTION ====== */
          <>
            {/* Featured route */}
            {routes.length > 0 && (() => {
              const featured = [...routes].sort((a, b) => b.likes - a.likes)[0]
              return (
                <Card className="mb-6 overflow-hidden border-primary/20 cursor-pointer group hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5" onClick={() => onOpenDetail(featured, 'route')}>
                  <div className="h-1 bg-gradient-to-r from-primary/80 via-accent/70 to-primary/50" />
                  <div className="bg-gradient-to-br from-primary/8 via-card to-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center size-6 rounded-full bg-amber-400/15">
                        <Star className="size-3.5 text-amber-400 fill-amber-400" />
                      </div>
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Izpostavljena pot</span>
                    </div>
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{featured.title}</h3>
                    {featured.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{featured.description}</p>}
                    <div className="flex items-center gap-4 mt-3">
                      <Badge variant="outline" className={categoryColor(featured.category)}>{categoryLabel(featured.category)}</Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Route className="size-3" />{featured.distance} km</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="size-3" />{featured.likes}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="size-3" />{featured.user?.name || 'Neznan'}</span>
                    </div>
                  </div>
                </Card>
              )
            })()}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card className="text-center overflow-hidden group hover:border-primary/20 transition-colors"><div className="h-0.5 bg-gradient-to-r from-primary/50 to-primary/20" /><CardContent className="p-4"><Bike className="size-5 text-primary mx-auto mb-1.5" /><p className="text-2xl font-bold">{exploreStats.totalRides}</p><p className="text-xs text-muted-foreground">Voženj</p></CardContent></Card>
              <Card className="text-center overflow-hidden group hover:border-primary/20 transition-colors"><div className="h-0.5 bg-gradient-to-r from-primary/50 to-primary/20" /><CardContent className="p-4"><Route className="size-5 text-primary mx-auto mb-1.5" /><p className="text-2xl font-bold">{exploreStats.totalRoutes}</p><p className="text-xs text-muted-foreground">Poti</p></CardContent></Card>
              <Card className="text-center overflow-hidden group hover:border-primary/20 transition-colors"><div className="h-0.5 bg-gradient-to-r from-primary/50 to-primary/20" /><CardContent className="p-4"><TrendingUp className="size-5 text-primary mx-auto mb-1.5" /><p className="text-2xl font-bold">{exploreStats.totalDistance}</p><p className="text-xs text-muted-foreground">km skupaj</p></CardContent></Card>
            </div>

            {/* Search + Filters */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Išči po imenu ali opisu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                {searchQuery && <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setSearchQuery('')}><X className="size-3" /></Button>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
                  {(['all', 'rides', 'routes'] as const).map(f => (
                    <Button key={f} variant={exploreFilter === f ? 'default' : 'ghost'} size="sm" className="text-xs" onClick={() => setExploreFilter(f)}>
                      {f === 'all' ? 'Vse' : f === 'rides' ? 'Vožnje' : 'Poti'}
                    </Button>
                  ))}
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex gap-1">
                  {['all', 'scenic', 'twisty', 'offroad', 'city'].map(cat => (
                    <Button key={cat} variant={exploreCategory === cat ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setExploreCategory(cat)}>
                      {cat === 'all' ? 'Vse' : categoryLabel(cat)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-12"><Compass className="size-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Ni najdenih voženj ali poti</p></div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredItems.map(item => (
                  <Card key={item.data.id + item.type} className="hover:border-primary/30 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => onOpenDetail(item.data, item.type)}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">{item.data.title}</CardTitle>
                          <CardDescription className="text-xs mt-1 line-clamp-2">{item.data.description}</CardDescription>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ml-2 ${item.type === 'ride' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : categoryColor((item.data as RouteData).category)}`}>
                          {item.type === 'ride' ? 'Vožnja' : categoryLabel((item.data as RouteData).category)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Route className="size-3" />{item.data.distance} km</span>
                        {item.type === 'ride' && <span className="flex items-center gap-1"><Clock className="size-3" />{formatDuration((item.data as RideData).duration)}</span>}
                        {item.type === 'route' && <span className="flex items-center gap-1"><Heart className="size-3" />{(item.data as RouteData).likes}</span>}
                        <span className="flex items-center gap-1"><User className="size-3" />{item.data.user?.name || 'Neznan'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Trophy className="size-5 text-primary" />Lestvica motoristov</h3>
                <div className="space-y-2">
                  {leaderboard.map((u, i) => (
                    <Card key={u.id} className="hover:border-primary/30 transition-all cursor-pointer" onClick={() => onSwitchUser(u.id)}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`flex items-center justify-center size-8 rounded-full shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-secondary text-muted-foreground'}`}>
                          {i === 0 ? <Crown className="size-4" /> : i === 1 ? <Medal className="size-4" /> : i === 2 ? <Medal className="size-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                        </div>
                        <Avatar className="size-9"><AvatarFallback className="text-xs bg-primary/20 text-primary">{u.name.charAt(0)}</AvatarFallback></Avatar>
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
}
