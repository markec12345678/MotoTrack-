'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  User, Bike, Route, TrendingUp, Mountain, Users, Gauge, Award, Flame,
  Camera, ImageIcon, X, Trash2,
  Phone, Heart, Droplets, AlertTriangle, Save,
  Bell, BellOff, Volume2, VolumeX, AlertOctagon,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { RideData, RouteData, UserData, PhotoData, EmergencyContactsData, SpeedAlertSettings } from '@/components/tabs/types'
import { formatDuration, formatDate, categoryLabel, categoryColor } from '@/components/tabs/types'
import AchievementsPanel from '@/components/tabs/achievements-panel'
import { toast } from 'sonner'

interface ProfileTabProps {
  user: UserData | null
  allUsers: Array<{ id: string; name: string; email: string; avatar: string | null; bike: string | null; bio: string | null }>
  rides: RideData[]
  routes: RouteData[]
  loading: boolean
  onSwitchUser: (userId: string) => void
  onOpenDetail: (item: RideData | RouteData, type: 'ride' | 'route') => void
  onRefresh: () => void
}

export default function ProfileTab({ user, allUsers, rides, routes, loading, onSwitchUser, onOpenDetail, onRefresh }: ProfileTabProps) {
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [photosLoading, setPhotosLoading] = useState(true)
  const [viewPhoto, setViewPhoto] = useState<PhotoData | null>(null)

  // ICE contacts state
  const [iceData, setIceData] = useState<EmergencyContactsData>({
    iceName1: '', icePhone1: '', iceName2: '', icePhone2: '', bloodType: '', allergies: '',
  })
  const [iceSaving, setIceSaving] = useState(false)

  // Speed alert settings state
  const [speedSettings, setSpeedSettings] = useState<SpeedAlertSettings>({
    speedLimit: 90, speedAlertEnabled: true, speedAlertSound: true,
  })
  const [speedSaving, setSpeedSaving] = useState(false)

  // Fetch ICE data
  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/emergency-contacts?userId=${user.id}`)
      .then(r => r.json())
      .then(j => {
        const data = j.data
        if (data) {
          setIceData({
            iceName1: data.iceName1 || '',
            icePhone1: data.icePhone1 || '',
            iceName2: data.iceName2 || '',
            icePhone2: data.icePhone2 || '',
            bloodType: data.bloodType || '',
            allergies: data.allergies || '',
          })
        }
      })
      .catch(() => {})
  }, [user?.id])

  // Fetch speed alert settings
  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/speed-settings?userId=${user.id}`)
      .then(r => r.json())
      .then(j => {
        if (j.data) {
          setSpeedSettings({
            speedLimit: j.data.speedLimit ?? 90,
            speedAlertEnabled: j.data.speedAlertEnabled ?? true,
            speedAlertSound: j.data.speedAlertSound ?? true,
          })
        }
      })
      .catch(() => {})
  }, [user?.id])

  const saveIceContacts = useCallback(async () => {
    if (!user?.id) return
    setIceSaving(true)
    try {
      const res = await fetch('/api/emergency-contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...iceData }),
      })
      if (res.ok) {
        toast.success('ICE kontakti shranjeni')
      } else {
        toast.error('Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setIceSaving(false)
    }
  }, [user?.id, iceData])

  const saveSpeedSettings = useCallback(async () => {
    if (!user?.id) return
    setSpeedSaving(true)
    try {
      const res = await fetch('/api/speed-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...speedSettings }),
      })
      if (res.ok) {
        toast.success('Hitrostna opozorila shranjena')
      } else {
        toast.error('Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setSpeedSaving(false)
    }
  }, [user?.id, speedSettings])

  // Fetch user's photos
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch(`/api/photos?userId=${user.id}&limit=50`)
      .then(r => r.json())
      .then(j => { if (!cancelled) { setPhotos(j.data || []); setPhotosLoading(false) } })
      .catch(() => { if (!cancelled) setPhotosLoading(false) })
    return () => { cancelled = true }
  }, [user])

  // Delete photo
  const handleDeletePhoto = useCallback(async (photoId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/photos/${photoId}?userId=${user.id}`, { method: 'DELETE' })
      if (res.ok) {
        setPhotos(prev => prev.filter(p => p.id !== photoId))
        toast.success('Foto izbrisano')
        if (viewPhoto?.id === photoId) setViewPhoto(null)
      } else {
        toast.error('Napaka pri brisanju')
      }
    } catch {
      toast.error('Napaka pri brisanju')
    }
  }, [user, viewPhoto])

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
        <div className="grid grid-cols-2 gap-3">
          <Card className="overflow-hidden"><CardContent className="p-4 text-center relative"><div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" /><Bike className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalRides}</p><p className="text-xs text-muted-foreground">Voženj</p></CardContent></Card>
          <Card className="overflow-hidden"><CardContent className="p-4 text-center relative"><div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" /><Route className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalRoutes}</p><p className="text-xs text-muted-foreground">Poti</p></CardContent></Card>
          <Card className="overflow-hidden"><CardContent className="p-4 text-center relative"><div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" /><TrendingUp className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalDistance}</p><p className="text-xs text-muted-foreground">km skupaj</p></CardContent></Card>
          <Card className="overflow-hidden"><CardContent className="p-4 text-center relative"><div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-primary/20" /><Mountain className="size-5 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{user.stats.totalElevation}</p><p className="text-xs text-muted-foreground">m višine</p></CardContent></Card>
        </div>

        {/* ICE Contacts Card */}
        <Card className="overflow-hidden border-red-500/20">
          <div className="h-0.5 bg-gradient-to-r from-red-500/80 via-red-400/60 to-red-500/40" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-7 rounded-lg bg-red-500/15">
                <AlertTriangle className="size-4 text-red-500" />
              </div>
              <CardTitle className="text-sm">ICE Kontakti</CardTitle>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-red-300 text-red-500">V sili</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* ICE Contact 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 text-red-500" />
                <span className="text-xs font-medium">Stik v sili 1</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ime</Label>
                  <Input
                    placeholder="Ime kontakta"
                    value={iceData.iceName1 || ''}
                    onChange={e => setIceData(prev => ({ ...prev, iceName1: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Telefon</Label>
                  <Input
                    placeholder="+386 1 234 5678"
                    value={iceData.icePhone1 || ''}
                    onChange={e => setIceData(prev => ({ ...prev, icePhone1: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* ICE Contact 2 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 text-red-500" />
                <span className="text-xs font-medium">Stik v sili 2</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ime</Label>
                  <Input
                    placeholder="Ime kontakta"
                    value={iceData.iceName2 || ''}
                    onChange={e => setIceData(prev => ({ ...prev, iceName2: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Telefon</Label>
                  <Input
                    placeholder="+386 1 234 5678"
                    value={iceData.icePhone2 || ''}
                    onChange={e => setIceData(prev => ({ ...prev, icePhone2: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* Blood type */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Droplets className="size-3.5 text-red-500" />
                <span className="text-xs font-medium">Krvna skupina</span>
              </div>
              <Select
                value={iceData.bloodType || ''}
                onValueChange={val => setIceData(prev => ({ ...prev, bloodType: val }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Izberi krvno skupino" />
                </SelectTrigger>
                <SelectContent>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                    <SelectItem key={bt} value={bt} className="text-xs">
                      {bt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator className="opacity-30" />

            {/* Allergies */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="size-3.5 text-red-500" />
                <span className="text-xs font-medium">Alergije</span>
              </div>
              <Input
                placeholder="Znane alergije (npr. penicilin, latex...)"
                value={iceData.allergies || ''}
                onChange={e => setIceData(prev => ({ ...prev, allergies: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            {/* Save button */}
            <Button
              size="sm"
              className="w-full text-xs gap-2 bg-red-500 hover:bg-red-600 text-white"
              onClick={saveIceContacts}
              disabled={iceSaving}
            >
              <Save className="size-3.5" />
              {iceSaving ? 'Shranjujem...' : 'Shrani ICE kontakti'}
            </Button>
          </CardContent>
        </Card>

        {/* Speed Alert Settings Card */}
        <Card className="overflow-hidden border-amber-500/20">
          <div className="h-0.5 bg-gradient-to-r from-amber-500/80 via-amber-400/60 to-amber-500/40" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/15">
                <AlertOctagon className="size-4 text-amber-500" />
              </div>
              <CardTitle className="text-sm">Hitrostna opozorila</CardTitle>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                speedSettings.speedAlertEnabled
                  ? 'border-amber-300 text-amber-500'
                  : 'border-muted text-muted-foreground'
              }`}>
                {speedSettings.speedAlertEnabled ? 'Vklopljeno' : 'Izklopljeno'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* Enable alerts toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {speedSettings.speedAlertEnabled ? (
                  <Bell className="size-3.5 text-amber-500" />
                ) : (
                  <BellOff className="size-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">Omogoči opozorila</span>
              </div>
              <button
                onClick={() => setSpeedSettings(prev => ({ ...prev, speedAlertEnabled: !prev.speedAlertEnabled }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  speedSettings.speedAlertEnabled ? 'bg-amber-500' : 'bg-muted'
                }`}
                role="switch"
                aria-checked={speedSettings.speedAlertEnabled}
              >
                <span className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  speedSettings.speedAlertEnabled ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <Separator className="opacity-30" />

            {/* Speed limit slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="size-3.5 text-amber-500" />
                  <span className="text-xs font-medium">Omejitev hitrosti</span>
                </div>
                <span className="text-xs font-bold text-amber-500">{speedSettings.speedLimit} km/h</span>
              </div>
              <input
                type="range"
                min={30}
                max={200}
                step={5}
                value={speedSettings.speedLimit}
                onChange={e => setSpeedSettings(prev => ({ ...prev, speedLimit: Number(e.target.value) }))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500 bg-muted"
              />
              <div className="flex justify-between">
                <span className="text-[9px] text-muted-foreground/50">30 km/h</span>
                <span className="text-[9px] text-muted-foreground/50">200 km/h</span>
              </div>
              {/* Quick presets */}
              <div className="flex gap-1.5 flex-wrap">
                {[50, 90, 110, 130].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setSpeedSettings(prev => ({ ...prev, speedLimit: preset }))}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      speedSettings.speedLimit === preset
                        ? 'bg-amber-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {preset} km/h
                  </button>
                ))}
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* Sound alert toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {speedSettings.speedAlertSound ? (
                  <Volume2 className="size-3.5 text-amber-500" />
                ) : (
                  <VolumeX className="size-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">Zvočno opozorilo</span>
              </div>
              <button
                onClick={() => setSpeedSettings(prev => ({ ...prev, speedAlertSound: !prev.speedAlertSound }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  speedSettings.speedAlertSound ? 'bg-amber-500' : 'bg-muted'
                }`}
                role="switch"
                aria-checked={speedSettings.speedAlertSound}
              >
                <span className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  speedSettings.speedAlertSound ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Save button */}
            <Button
              size="sm"
              className="w-full text-xs gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={saveSpeedSettings}
              disabled={speedSaving}
            >
              <Save className="size-3.5" />
              {speedSaving ? 'Shranjujem...' : 'Shrani hitrostna opozorila'}
            </Button>
          </CardContent>
        </Card>

        {/* Achievements */}
        <AchievementsPanel userId={user.id} key={user.id} />

        {/* Photo Gallery */}
        <Card className="overflow-hidden border-primary/15">
          <div className="h-0.5 bg-gradient-to-r from-primary/80 via-accent/60 to-primary/40" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
                <Camera className="size-4 text-primary" />
              </div>
              <CardTitle className="text-sm">Foto galerija</CardTitle>
              {photos.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                  {photos.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {photosLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : photos.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <ImageIcon className="size-10 mb-2 opacity-30" />
                <p className="text-sm">Ni fotografij</p>
                <p className="text-xs opacity-60">Fotografije se pokažejo tukaj, ko jih dodate k vožnjam ali potem</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.slice(0, 12).map(photo => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setViewPhoto(photo)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Fotografija'}
                      className="size-full object-cover"
                    />
                    {/* Delete button for owner */}
                    <button
                      className="absolute top-1 right-1 size-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                    {/* Caption overlay */}
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                        <p className="text-[8px] text-white truncate">{photo.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {photos.length > 12 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Prikažujem 12 od {photos.length} fotografij
              </p>
            )}
          </CardContent>
        </Card>

        {/* Performance */}
        <Card className="overflow-hidden border-primary/15">
          <div className="h-0.5 bg-gradient-to-r from-primary/80 via-accent/60 to-primary/40" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
                <Award className="size-4 text-primary" />
              </div>
              <CardTitle className="text-sm">Uspešnost</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* Avg speed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Povprečna hitrost</span>
                </div>
                <span className="text-xs font-bold text-primary">{user.stats.avgSpeed} km/h</span>
              </div>
              <div className="relative">
                <Progress value={Math.min((user.stats.avgSpeed / 80) * 100, 100)} className="h-2 progress-glow" />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground/50">0</span>
                  <span className="text-[9px] text-muted-foreground/50">80 km/h</span>
                </div>
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* Ride consistency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Vzdržljivost voženj</span>
                </div>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${user.stats.totalRides > 5 ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary text-muted-foreground border-border'}`}>
                  {user.stats.totalRides > 5 ? 'Odlična' : 'Dobra'}
                </Badge>
              </div>
              <div className="relative">
                <Progress value={Math.min(user.stats.totalRides * 10, 100)} className="h-2 progress-glow" />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground/50">0</span>
                  <span className="text-[9px] text-muted-foreground/50">10 voženj</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity - tabs for rides & routes */}
        <Card>
          <Tabs defaultValue="rides">
            <CardHeader className="p-4 pb-0">
              <div className="flex items-center justify-between">
                <TabsList className="h-8">
                  <TabsTrigger value="rides" className="text-xs gap-1.5 px-3">
                    <Bike className="size-3" /> Vožnje ({rides.filter(r => r.userId === user.id).length})
                  </TabsTrigger>
                  <TabsTrigger value="routes" className="text-xs gap-1.5 px-3">
                    <Route className="size-3" /> Poti ({routes.filter(r => r.userId === user.id).length})
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
            <TabsContent value="rides" className="mt-0">
              <CardContent className="p-4 pt-2">
                <ScrollArea className="max-h-60">
                  {rides.filter(r => r.userId === user.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Ni voženj</p>
                  ) : (
                    rides.filter(r => r.userId === user.id).slice(0, 10).map(ride => (
                      <div key={ride.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 cursor-pointer hover:bg-secondary/30 rounded px-2 -mx-2" onClick={() => onOpenDetail(ride, 'ride')}>
                        <div><p className="text-sm font-medium">{ride.title}</p><p className="text-xs text-muted-foreground">{formatDate(ride.createdAt)}</p></div>
                        <div className="text-right"><p className="text-sm font-bold text-primary">{ride.distance} km</p><p className="text-xs text-muted-foreground">{formatDuration(ride.duration)}</p></div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </TabsContent>
            <TabsContent value="routes" className="mt-0">
              <CardContent className="p-4 pt-2">
                <ScrollArea className="max-h-60">
                  {routes.filter(r => r.userId === user.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Ni poti</p>
                  ) : (
                    routes.filter(r => r.userId === user.id).slice(0, 10).map(route => (
                      <div key={route.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 cursor-pointer hover:bg-secondary/30 rounded px-2 -mx-2" onClick={() => onOpenDetail(route, 'route')}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`${categoryColor(route.category)} text-[10px] px-1.5 py-0`}>{categoryLabel(route.category)}</Badge>
                          <div><p className="text-sm font-medium">{route.title}</p><p className="text-xs text-muted-foreground">{formatDate(route.createdAt)}</p></div>
                        </div>
                        <div className="text-right"><p className="text-sm font-bold text-primary">{route.distance} km</p><p className="text-xs text-muted-foreground">❤️ {route.likes}</p></div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Full-size photo overlay */}
      {viewPhoto && (
        <Dialog open onOpenChange={(open) => { if (!open) setViewPhoto(null) }}>
          <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden bg-black/95 border-border/20">
            <DialogTitle className="sr-only">{viewPhoto.caption || 'Fotografija'}</DialogTitle>
            <div className="relative">
              <button
                onClick={() => setViewPhoto(null)}
                className="absolute top-2 right-2 z-10 size-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
              <img
                src={viewPhoto.url}
                alt={viewPhoto.caption || 'Fotografija'}
                className="w-full max-h-[70vh] object-contain"
              />
              {viewPhoto.caption && (
                <div className="px-4 py-3 bg-black/60">
                  <p className="text-sm text-white">{viewPhoto.caption}</p>
                </div>
              )}
              <div className="px-4 py-2 bg-black/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                      {viewPhoto.user?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-white/80">{viewPhoto.user?.name || 'Neznan'}</span>
                  <span className="text-[10px] text-white/50">{formatDate(viewPhoto.createdAt)}</span>
                </div>
                {user && user.id === viewPhoto.userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => { handleDeletePhoto(viewPhoto.id); setViewPhoto(null) }}
                  >
                    <Trash2 className="size-3" /> Izbriši
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
