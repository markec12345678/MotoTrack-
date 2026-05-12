'use client'

import React from 'react'
import {
  User, Bike, Route, TrendingUp, Mountain, Users,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { RideData, UserData } from '@/components/tabs/types'
import { formatDuration, formatDate } from '@/components/tabs/types'

interface ProfileTabProps {
  user: UserData | null
  allUsers: Array<{ id: string; name: string; email: string; avatar: string | null; bike: string | null; bio: string | null }>
  rides: RideData[]
  loading: boolean
  onSwitchUser: (userId: string) => void
  onOpenDetail: (item: RideData | RouteData, type: 'ride' | 'route') => void
  onRefresh: () => void
}

import type { RouteData } from '@/components/tabs/types'

export default function ProfileTab({ user, allUsers, rides, loading, onSwitchUser, onOpenDetail, onRefresh }: ProfileTabProps) {
  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-104px)] flex items-center justify-center">
        <User className="size-12 text-muted-foreground animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="w-full h-[calc(100vh-104px)] flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Podatki o uporabniku niso na voljo</p>
        <Button onClick={onRefresh}>Poskusi znova</Button>
      </div>
    )
  }

  return (
    <div className="w-full h-[calc(100vh-104px)] overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* User switcher */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><Users className="size-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Preklopi uporabnika</span></div>
            <div className="flex gap-2 flex-wrap">
              {allUsers.map(u => (
                <Button key={u.id} variant={user.id === u.id ? 'default' : 'outline'} size="sm" className="text-xs gap-1.5" onClick={() => onSwitchUser(u.id)}>
                  <Avatar className="size-5"><AvatarFallback className="text-[8px]">{u.name.charAt(0)}</AvatarFallback></Avatar>
                  {u.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User card */}
        <Card>
          <CardContent className="p-6 text-center">
            <Avatar className="size-20 mx-auto mb-4"><AvatarFallback className="text-2xl bg-primary/20 text-primary">{user.name.charAt(0)}</AvatarFallback></Avatar>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.bike && <Badge className="mt-2 bg-primary/20 text-primary border-primary/30"><Bike className="size-3 mr-1" />{user.bike}</Badge>}
            {user.bio && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{user.bio}</p>}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="p-4 text-center"><Bike className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalRides}</p><p className="text-xs text-muted-foreground">Voženj</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Route className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalRoutes}</p><p className="text-xs text-muted-foreground">Poti</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><TrendingUp className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalDistance}</p><p className="text-xs text-muted-foreground">km skupaj</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><Mountain className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalElevation}</p><p className="text-xs text-muted-foreground">m višine</p></CardContent></Card>
        </div>

        {/* Performance */}
        <Card>
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Uspešnost</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="space-y-1"><div className="flex justify-between text-xs"><span>Povprečna hitrost</span><span className="text-primary font-medium">{user.stats.avgSpeed} km/h</span></div><Progress value={Math.min((user.stats.avgSpeed / 80) * 100, 100)} className="h-2" /></div>
            <div className="space-y-1"><div className="flex justify-between text-xs"><span>Vslednost voženj</span><span className="text-primary font-medium">{user.stats.totalRides > 5 ? 'Odlična' : 'Dobra'}</span></div><Progress value={Math.min(user.stats.totalRides * 10, 100)} className="h-2" /></div>
          </CardContent>
        </Card>

        {/* Recent rides */}
        <Card>
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Zadnje vožnje</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <ScrollArea className="max-h-60">
              {rides.filter(r => r.userId === user.id).slice(0, 5).map(ride => (
                <div key={ride.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 cursor-pointer hover:bg-secondary/30 rounded px-2 -mx-2" onClick={() => onOpenDetail(ride, 'ride')}>
                  <div><p className="text-sm font-medium">{ride.title}</p><p className="text-xs text-muted-foreground">{formatDate(ride.createdAt)}</p></div>
                  <div className="text-right"><p className="text-sm font-bold text-primary">{ride.distance} km</p><p className="text-xs text-muted-foreground">{formatDuration(ride.duration)}</p></div>
                </div>
              ))}
              {rides.filter(r => r.userId === user.id).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Ni voženj</p>}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
