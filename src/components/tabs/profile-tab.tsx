'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  User, Bike, Route, TrendingUp, Mountain, Users, Gauge, Award, Flame,
  Camera, ImageIcon, X, Trash2,
  Phone, Heart, Droplets, AlertTriangle, Save,
  Bell, BellOff, Volume2, VolumeX, AlertOctagon,
  Receipt, Wrench, Plus, CheckCircle2, Calendar, Play,
  ChevronDown, Zap, Wallet, Trophy,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { RideData, RouteData, UserData, PhotoData, EmergencyContactsData, SpeedAlertSettings, ExpenseData, TrackPoint } from '@/components/tabs/types'
import { formatDuration, formatDate, categoryLabel, categoryColor } from '@/components/tabs/types'
import AchievementsPanel from '@/components/tabs/achievements-panel'
import RideStatsDashboard from '@/components/ride-stats-dashboard'
import EnhancedStatsDashboard from '@/components/enhanced-stats-dashboard'
import PointsDisplay from '@/components/points-display'
import RideCalendar from '@/components/ride-calendar'
import RideInsights from '@/components/ride-insights'
import BluetoothPanel from '@/components/bluetooth-panel'
import OBDPanel from '@/components/obd-panel'
import RideReplay3D from '@/components/ride-replay-3d'
import TouringScore from '@/components/touring-score'
import BikeGarage from '@/components/bike-garage'
import RideReplayPlayer from '@/components/ride-replay-player'
import dynamic from 'next/dynamic'
const MaintenanceTracker = dynamic(() => import('@/components/maintenance-tracker'), { ssr: false })
import { toast } from 'sonner'
import { useSettingsStore, saveSettings, type UnitSystem, formatDistance, formatElevation, distanceUnit, elevationUnit } from '@/hooks/use-settings'
import { MapPin, Shield, Moon, Timer, Ruler, CircleDot, Trash2 as Trash2Icon } from 'lucide-react'

interface ProfileTabProps {
  user: UserData | null
  allUsers: Array<{ id: string; name: string; email: string; avatar: string | null; bike: string | null; bio: string | null }>
  rides: RideData[]
  routes: RouteData[]
  loading: boolean
  onSwitchUser: (userId: string) => void
  onOpenDetail: (item: RideData | RouteData, type: 'ride' | 'route') => void
  onRefresh: () => void
  unitSystem?: 'metric' | 'imperial'
}

export default function ProfileTab({ user, allUsers, rides, routes, loading, onSwitchUser, onOpenDetail, onRefresh, unitSystem: unitSystemProp }: ProfileTabProps) {
  const { settings, privacyZones, setSettings, setPrivacyZones, addPrivacyZone, removePrivacyZone } = useSettingsStore()
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

  // Expense tracker state
  const [expenses, setExpenses] = useState<ExpenseData[]>([])
  const [expenseTotals, setExpenseTotals] = useState({ allTime: 0, thisMonth: 0 })
  const [expenseByType, setExpenseByType] = useState<Record<string, number>>({})
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [newExpense, setNewExpense] = useState({ type: 'fuel', amount: '', description: '', mileage: '' })
  const [expenseSaving, setExpenseSaving] = useState(false)


  const [currentMileage, setCurrentMileage] = useState(0)
  const [mileageSaving, setMileageSaving] = useState(false)
  const [replayRide, setReplayRide] = useState<RideData | null>(null)
  const [replayTrackData, setReplayTrackData] = useState<TrackPoint[]>([])

  // Enhanced stats toggle
  const [showEnhancedStats, setShowEnhancedStats] = useState(false)

  // Collapsible section states — first section (Motocikel) expanded by default
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    motocikel: true,
    nadzor: false,
    financije: false,
    mediji: false,
    dosezki: false,
    statistika: false,
    nastavitve: false,
    zasebnost: false,
  })

  // Privacy zone creation state
  const [newZoneName, setNewZoneName] = useState('')
  const [newZoneRadius, setNewZoneRadius] = useState(200)
  const [addingZone, setAddingZone] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const toggleSection = (key: string) => {
    setSectionOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleReplayRide = useCallback((ride: RideData) => {
    try {
      const parsed = JSON.parse(ride.trackData)
      if (!Array.isArray(parsed) || parsed.length < 2) {
        toast.error('Ni podatkov za predvajanje')
        return
      }
      const points: TrackPoint[] = parsed.map((p: number[]) => ({
        lat: p[0],
        lng: p[1],
        alt: p[2] ?? null,
        timestamp: p[3] ?? Date.now(),
      }))
      setReplayTrackData(points)
      setReplayRide(ride)
    } catch {
      toast.error('Napaka pri nalaganju podatkov')
    }
  }, [])

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

  // Fetch expenses
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setExpensesLoading(true)
    fetch(`/api/expenses?userId=${user.id}&limit=10`)
      .then(r => r.json())
      .then(j => {
        if (!cancelled) {
          setExpenses(j.data || [])
          setExpenseTotals(j.totals || { allTime: 0, thisMonth: 0 })
          setExpenseByType(j.byType || {})
          setExpensesLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setExpensesLoading(false) })
    return () => { cancelled = true }
  }, [user?.id])



  // Fetch current mileage
  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/users/${user.id}`)
      .then(r => r.json())
      .then(j => {
        if (j.data?.currentMileage !== undefined) {
          setCurrentMileage(j.data.currentMileage || 0)
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

  // Expense handlers
  const addExpense = useCallback(async () => {
    if (!user?.id || !newExpense.amount) return
    setExpenseSaving(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: newExpense.type,
          amount: parseFloat(newExpense.amount),
          description: newExpense.description || undefined,
          mileage: newExpense.mileage ? parseInt(newExpense.mileage) : undefined,
        }),
      })
      if (res.ok) {
        toast.success('Strošek dodan')
        setNewExpense({ type: 'fuel', amount: '', description: '', mileage: '' })
        // Refresh expenses
        const j = await (await fetch(`/api/expenses?userId=${user.id}&limit=10`)).json()
        setExpenses(j.data || [])
        setExpenseTotals(j.totals || { allTime: 0, thisMonth: 0 })
        setExpenseByType(j.byType || {})
      } else {
        toast.error('Napaka pri dodajanju stroška')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setExpenseSaving(false)
    }
  }, [user?.id, newExpense])

  const deleteExpense = useCallback(async (expenseId: string) => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/expenses/${expenseId}?userId=${user.id}`, { method: 'DELETE' })
      if (res.ok) {
        setExpenses(prev => prev.filter(e => e.id !== expenseId))
        toast.success('Strošek izbrisan')
        // Refresh totals
        const j = await (await fetch(`/api/expenses?userId=${user.id}&limit=10`)).json()
        setExpenseTotals(j.totals || { allTime: 0, thisMonth: 0 })
        setExpenseByType(j.byType || {})
      } else {
        toast.error('Napaka pri brisanju')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
  }, [user?.id])



  const saveMileage = useCallback(async () => {
    if (!user?.id) return
    setMileageSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentMileage }),
      })
      if (res.ok) {
        toast.success('Kilometrina posodobljena')
      } else {
        toast.error('Napaka pri shranjevanju')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setMileageSaving(false)
    }
  }, [user?.id, currentMileage])

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
      <div className="w-full h-[calc(100vh-120px)] flex items-center justify-center">
        <User className="size-12 text-muted-foreground animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="w-full h-[calc(100vh-120px)] flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Podatki o uporabniku niso na voljo</p>
        <Button onClick={onRefresh}>Poskusi znova</Button>
      </div>
    )
  }

  // Count items for badges
  const motocikelItemCount = [iceData.iceName1, iceData.iceName2, user.bike, currentMileage > 0].filter(Boolean).length + 2 // +2 for Bluetooth, OBD
  const nadzorItemCount = 2 // speed alerts + crash detection
  const financijeItemCount = expenses.length
  const medijiItemCount = photos.length + (rides.filter(r => r.userId === user.id).some(r => r.trackData) ? 1 : 0)
  const dosezkiItemCount = 3 // achievements + points + performance

  return (
    <div className="w-full h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* ── User Switcher ── */}
        <Card className="rounded-xl">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2"><Users className="size-3.5 text-muted-foreground" /><span className="text-[11px] text-muted-foreground font-medium">Preklopi uporabnika</span></div>
            <div className="flex gap-1.5 flex-wrap">
              {allUsers.map(u => (
                <Button key={u.id} variant={user.id === u.id ? 'default' : 'outline'} size="sm" className="text-xs gap-1 h-7" onClick={() => onSwitchUser(u.id)}>
                  <Avatar className="size-4"><AvatarFallback className="text-[7px]">{u.name.charAt(0)}</AvatarFallback></Avatar>
                  {u.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Improved User Card - Premium REVER style ── */}
        <Card className="rounded-xl overflow-hidden border-primary/10">
          <div className="h-1 bg-gradient-to-r from-primary/80 via-primary/50 to-primary/10" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              {/* Avatar with gradient ring - Premium glow */}
              <div className="relative shrink-0">
                <div className="absolute inset-[-3px] rounded-full bg-gradient-to-br from-primary/40 to-primary/10 blur-[2px]" />
                <Avatar className="size-16 relative ring-2 ring-background shadow-lg shadow-primary/15">
                  <AvatarFallback className="text-xl bg-primary/15 text-primary font-bold">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{user.name}</h2>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                {user.bike && <Badge className="mt-1.5 bg-primary/10 text-primary border-primary/20 text-[10px] h-5"><Bike className="size-3 mr-1" />{user.bike}</Badge>}
              </div>
            </div>
            {user.bio && <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{user.bio}</p>}
            {/* Stats horizontal strip - Premium pill style */}
            <div className="mt-4 grid grid-cols-4 gap-1.5 bg-muted/30 rounded-xl p-2">
              <div className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg bg-background/50">
                <Bike className="size-3.5 text-primary" />
                <span className="text-xs font-bold">{user.stats.totalRides}</span>
                <span className="text-[8px] text-muted-foreground">voženj</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg bg-background/50">
                <Route className="size-3.5 text-primary" />
                <span className="text-xs font-bold">{user.stats.totalRoutes}</span>
                <span className="text-[8px] text-muted-foreground">poti</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg bg-background/50">
                <TrendingUp className="size-3.5 text-primary" />
                <span className="text-xs font-bold">{user.stats.totalDistance}</span>
                <span className="text-[8px] text-muted-foreground">km</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg bg-background/50">
                <Mountain className="size-3.5 text-primary" />
                <span className="text-xs font-bold">{user.stats.totalElevation}</span>
                <span className="text-[8px] text-muted-foreground">m</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            STATISTIKA VOŽENJ (always visible)
        ════════════════════════════════════════════════════════════════ */}
        <RideStatsDashboard rides={rides} userId={user.id} />

        {/* ════════════════════════════════════════════════════════════════
            NAPREDNA STATISTIKA (expandable)
        ════════════════════════════════════════════════════════════════ */}
        <Card className="rounded-xl overflow-hidden border-l-4 border-l-orange-500/60">
          <button
            className="w-full text-left p-4 flex items-center gap-3"
            onClick={() => setShowEnhancedStats(prev => !prev)}
          >
            <div className="flex items-center justify-center size-8 rounded-lg bg-orange-500/15 shrink-0">
              <TrendingUp className="size-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">Napredna statistika</CardTitle>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-orange-500/10 text-orange-500">
                  {rides.length} voženj
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Grafi, distribucija, rekordi</p>
            </div>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${showEnhancedStats ? 'rotate-180' : ''}`} />
          </button>
          {showEnhancedStats && (
            <CardContent className="px-4 pb-4 pt-0">
              <EnhancedStatsDashboard rides={rides} routes={routes} />
            </CardContent>
          )}
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            KOLEDAR VOŽENJ
        ════════════════════════════════════════════════════════════════ */}
        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-4">
            <RideCalendar
              userId={user.id}
              onRideClick={(rideId) => {
                const ride = rides.find(r => r.id === rideId)
                if (ride) onOpenDetail(ride, 'ride')
              }}
            />
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            VPOGLEDI V VOŽNJE (always visible)
        ════════════════════════════════════════════════════════════════ */}
        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-4">
            <RideInsights rides={rides} userId={user.id} />
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            TOURING SCORE (always visible)
        ════════════════════════════════════════════════════════════════ */}
        <TouringScore rides={rides} routes={routes} userId={user.id} />

        {/* ════════════════════════════════════════════════════════════════
            BIKE GARAGE (always visible)
        ════════════════════════════════════════════════════════════════ */}
        <BikeGarage userId={user.id} currentMileage={currentMileage} />

        {/* ════════════════════════════════════════════════════════════════
            MAINTENANCE TRACKER (always visible)
        ════════════════════════════════════════════════════════════════ */}
        <MaintenanceTracker
          userId={user.id}
          currentMileage={currentMileage}
          totalRideKm={rides.reduce((sum, r) => sum + r.distance, 0)}
        />

        {/* ════════════════════════════════════════════════════════════════
            RIDE REPLAY (always visible - for last ride)
        ════════════════════════════════════════════════════════════════ */}
        {rides.length > 0 && rides[0].trackData && (
          <RideReplayPlayer
            trackData={rides[0].trackData}
            maxSpeed={rides[0].maxSpeed}
            distance={rides[0].distance}
            duration={rides[0].duration}
          />
        )}

        {/* ════════════════════════════════════════════════════════════════
            COLLAPSIBLE SECTION 1: 🎮 Moj Motocikel
            ICE contacts, bike info, mileage, Bluetooth, OBD
        ════════════════════════════════════════════════════════════════ */}
        <Collapsible open={sectionOpen.motocikel} onOpenChange={() => toggleSection('motocikel')}>
          <Card className="rounded-xl overflow-hidden border-l-4 border-l-red-500/60">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <div className="p-4 pb-0 flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-red-500/15 shrink-0">
                    <Bike className="size-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">Moj Motocikel</CardTitle>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-red-500/10 text-red-500">{motocikelItemCount} postavk</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">ICE kontakti, kilometrina, povezave</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${sectionOpen.motocikel ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-3 space-y-4">

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
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Telefon</Label>
                      <Input
                        placeholder="+386 1 234 5678"
                        value={iceData.icePhone1 || ''}
                        onChange={e => setIceData(prev => ({ ...prev, icePhone1: e.target.value }))}
                        className="h-7 text-xs"
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
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Telefon</Label>
                      <Input
                        placeholder="+386 1 234 5678"
                        value={iceData.icePhone2 || ''}
                        onChange={e => setIceData(prev => ({ ...prev, icePhone2: e.target.value }))}
                        className="h-7 text-xs"
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
                    <SelectTrigger className="h-7 text-xs">
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
                    className="h-7 text-xs"
                  />
                </div>

                {/* Save ICE button */}
                <Button
                  size="sm"
                  className="w-full text-xs gap-2 bg-red-500 hover:bg-red-600 text-white h-7"
                  onClick={saveIceContacts}
                  disabled={iceSaving}
                >
                  <Save className="size-3" />
                  {iceSaving ? 'Shranjujem...' : 'Shrani ICE kontakti'}
                </Button>

                <Separator className="opacity-30" />

                {/* Current mileage */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="size-3.5 text-red-500" />
                    <span className="text-xs font-medium">Trenutna kilometrina</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        type="number"
                        value={currentMileage}
                        onChange={e => setCurrentMileage(parseInt(e.target.value) || 0)}
                        className="h-7 text-xs pr-8"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">km</span>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-red-500 hover:bg-red-600 text-white"
                      onClick={saveMileage}
                      disabled={mileageSaving}
                    >
                      <Save className="size-3" />
                      {mileageSaving ? '...' : 'Shrani'}
                    </Button>
                  </div>
                </div>

                <Separator className="opacity-30" />

                {/* Bluetooth & OBD sections */}
                <BluetoothPanel />
                <OBDPanel userId={user?.id} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ════════════════════════════════════════════════════════════════
            COLLAPSIBLE SECTION 2: ⚡ Vozniški Nadzor
            Speed alerts, crash detection
        ════════════════════════════════════════════════════════════════ */}
        <Collapsible open={sectionOpen.nadzor} onOpenChange={() => toggleSection('nadzor')}>
          <Card className="rounded-xl overflow-hidden border-l-4 border-l-amber-500/60">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <div className="p-4 pb-0 flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-amber-500/15 shrink-0">
                    <Zap className="size-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">Vozniški Nadzor</CardTitle>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-500">{nadzorItemCount} nastavitve</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Hitrostna opozorila, varnost</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${sectionOpen.nadzor ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-3 space-y-4">

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
                  className="w-full text-xs gap-2 bg-amber-500 hover:bg-amber-600 text-white h-7"
                  onClick={saveSpeedSettings}
                  disabled={speedSaving}
                >
                  <Save className="size-3" />
                  {speedSaving ? 'Shranjujem...' : 'Shrani hitrostna opozorila'}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ════════════════════════════════════════════════════════════════
            COLLAPSIBLE SECTION 3: 💰 Financije
            Expenses
        ════════════════════════════════════════════════════════════════ */}
        <Collapsible open={sectionOpen.financije} onOpenChange={() => toggleSection('financije')}>
          <Card className="rounded-xl overflow-hidden border-l-4 border-l-emerald-500/60">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <div className="p-4 pb-0 flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-500/15 shrink-0">
                    <Wallet className="size-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">Financije</CardTitle>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-500">{financijeItemCount} postavk</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Stroški, vzdrževanje, opomniki</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${sectionOpen.financije ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-3 space-y-4">

                {/* Expense totals */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-emerald-500/10 p-2.5 text-center">
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{(expenseTotals.thisMonth ?? 0).toFixed(2)} €</p>
                    <p className="text-[10px] text-muted-foreground">Ta mesec</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-2.5 text-center">
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{(expenseTotals.allTime ?? 0).toFixed(2)} €</p>
                    <p className="text-[10px] text-muted-foreground">Skupaj</p>
                  </div>
                </div>

                {/* By type mini breakdown */}
                {Object.keys(expenseByType).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(expenseByType).map(([t, amt]) => (
                      <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-muted">
                        {t === 'fuel' ? '⛽' : t === 'maintenance' ? '🔧' : t === 'insurance' ? '🛡️' : t === 'parts' ? '🔩' : t === 'toll' ? '🛣️' : t === 'parking' ? '🅿️' : '📦'}
                        {(amt ?? 0).toFixed(0)} €
                      </span>
                    ))}
                  </div>
                )}

                <Separator className="opacity-30" />

                {/* Add expense form */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Plus className="size-3.5 text-emerald-500" />
                    <span className="text-xs font-medium">Dodaj strošek</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Tip</Label>
                      <Select value={newExpense.type} onValueChange={val => setNewExpense(prev => ({ ...prev, type: val }))}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fuel" className="text-xs">⛽ Gorivo</SelectItem>
                          <SelectItem value="maintenance" className="text-xs">🔧 Vzdrževanje</SelectItem>
                          <SelectItem value="insurance" className="text-xs">🛡️ Zavarovanje</SelectItem>
                          <SelectItem value="parts" className="text-xs">🔩 Deli</SelectItem>
                          <SelectItem value="toll" className="text-xs">🛣️ Cestnina</SelectItem>
                          <SelectItem value="parking" className="text-xs">🅿️ Parkiranje</SelectItem>
                          <SelectItem value="other" className="text-xs">📦 Drugo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Znesek (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newExpense.amount}
                        onChange={e => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Opis</Label>
                      <Input
                        placeholder="Opis stroška"
                        value={newExpense.description}
                        onChange={e => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Kilometrina</Label>
                      <Input
                        type="number"
                        placeholder="km"
                        value={newExpense.mileage}
                        onChange={e => setNewExpense(prev => ({ ...prev, mileage: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full text-xs gap-2 bg-emerald-500 hover:bg-emerald-600 text-white h-7"
                    onClick={addExpense}
                    disabled={expenseSaving || !newExpense.amount}
                  >
                    <Plus className="size-3" />
                    {expenseSaving ? 'Dodajam...' : 'Dodaj strošek'}
                  </Button>
                </div>

                <Separator className="opacity-30" />

                {/* Recent expenses list */}
                <div className="space-y-1">
                  <span className="text-xs font-medium">Zadnji stroški</span>
                  {expensesLoading ? (
                    <div className="space-y-2 mt-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 rounded" />)}
                    </div>
                  ) : expenses.length === 0 ? (
                    <div className="text-center py-3">
                      <Receipt className="size-6 mx-auto mb-1 text-muted-foreground/30" />
                      <p className="text-[10px] text-muted-foreground">Ni stroškov</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-40">
                      <div className="space-y-0.5">
                        {expenses.map(exp => (
                          <div key={exp.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-secondary/30 group">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">
                                {exp.type === 'fuel' ? '⛽' : exp.type === 'maintenance' ? '🔧' : exp.type === 'insurance' ? '🛡️' : exp.type === 'parts' ? '🔩' : exp.type === 'toll' ? '🛣️' : exp.type === 'parking' ? '🅿️' : '📦'}
                              </span>
                              <div>
                                <p className="text-[11px] font-medium">{exp.description || (exp.type === 'fuel' ? 'Gorivo' : exp.type === 'maintenance' ? 'Vzdrževanje' : exp.type === 'insurance' ? 'Zavarovanje' : exp.type === 'parts' ? 'Deli' : exp.type === 'toll' ? 'Cestnina' : exp.type === 'parking' ? 'Parkiranje' : 'Drugo')}</p>
                                <p className="text-[9px] text-muted-foreground">
                                  {formatDate(exp.date)}
                                  {exp.mileage ? ` · ${exp.mileage} km` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{(exp.amount ?? 0).toFixed(2)} €</span>
                              <button
                                className="size-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                                onClick={() => deleteExpense(exp.id)}
                              >
                                <Trash2 className="size-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>


              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ════════════════════════════════════════════════════════════════
            COLLAPSIBLE SECTION 4: 📸 Mediji
            Photos, ride replay
        ════════════════════════════════════════════════════════════════ */}
        <Collapsible open={sectionOpen.mediji} onOpenChange={() => toggleSection('mediji')}>
          <Card className="rounded-xl overflow-hidden border-l-4 border-l-pink-500/60">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <div className="p-4 pb-0 flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-pink-500/15 shrink-0">
                    <Camera className="size-4 text-pink-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">Mediji</CardTitle>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-pink-500/10 text-pink-500">{medijiItemCount} postavk</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Fotografije, predvajanje voženj</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${sectionOpen.mediji ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-3 space-y-4">

                {/* REWIND - 3D Ride Replay */}
                {replayRide && replayTrackData.length > 1 ? (
                  <div className="space-y-2">
                    <RideReplay3D trackData={replayTrackData} title={`REWIND: ${replayRide.title}`} />
                    <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => { setReplayRide(null); setReplayTrackData([]) }}>
                      <X className="size-3 mr-1" /> Zapri predvajanje
                    </Button>
                  </div>
                ) : rides.filter(r => r.userId === user.id).some(r => r.trackData) ? (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                      <Play className="size-4 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium">REWIND — Predvajaj vožnjo</p>
                      <p className="text-[10px] text-muted-foreground">Kliknite ▶ pri vožnji spodaj za 3D predvajanje</p>
                    </div>
                  </div>
                ) : null}

                {/* Photo Gallery */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="size-3.5 text-pink-500" />
                    <span className="text-xs font-medium">Foto galerija</span>
                    {photos.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {photos.length}
                      </Badge>
                    )}
                  </div>
                  {photosLoading ? (
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <Skeleton key={i} className="aspect-square rounded-lg" />
                      ))}
                    </div>
                  ) : photos.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground">
                      <ImageIcon className="size-8 mb-1 opacity-30" />
                      <p className="text-xs">Ni fotografij</p>
                      <p className="text-[10px] opacity-60">Fotografije se pokažejo tukaj, ko jih dodate k vožnjam</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
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
                            className="absolute top-1 right-1 size-4 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }}
                          >
                            <Trash2 className="size-2.5" />
                          </button>
                          {/* Caption overlay */}
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                              <p className="text-[7px] text-white truncate">{photo.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {photos.length > 12 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Prikažujem 12 od {photos.length} fotografij
                    </p>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ════════════════════════════════════════════════════════════════
            COLLAPSIBLE SECTION 5: 🏆 Dosežki
            Points, achievements, performance
        ════════════════════════════════════════════════════════════════ */}
        <Collapsible open={sectionOpen.dosezki} onOpenChange={() => toggleSection('dosezki')}>
          <Card className="rounded-xl overflow-hidden border-l-4 border-l-orange-500/60">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <div className="p-4 pb-0 flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-orange-500/15 shrink-0">
                    <Trophy className="size-4 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">Dosežki</CardTitle>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-orange-500/10 text-orange-500">{dosezkiItemCount} pogledi</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Točke, dosežki, uspešnost</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${sectionOpen.dosezki ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-3 space-y-4">
                {/* Achievements */}
                <AchievementsPanel userId={user.id} key={user.id} />

                {/* Points & Level */}
                <PointsDisplay userId={user.id} key={`pts-${user.id}`} />

                {/* Performance */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Award className="size-3.5 text-orange-500" />
                    <span className="text-xs font-medium">Uspešnost</span>
                  </div>

                  {/* Avg speed */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="size-3 text-muted-foreground" />
                        <span className="text-[11px] font-medium">Povprečna hitrost</span>
                      </div>
                      <span className="text-[11px] font-bold text-primary">{user.stats.avgSpeed} km/h</span>
                    </div>
                    <div className="relative">
                      <Progress value={Math.min((user.stats.avgSpeed / 80) * 100, 100)} className="h-1.5 progress-glow" />
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[8px] text-muted-foreground/50">0</span>
                        <span className="text-[8px] text-muted-foreground/50">80 km/h</span>
                      </div>
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Ride consistency */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="size-3 text-muted-foreground" />
                        <span className="text-[11px] font-medium">Vzdržljivost voženj</span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${user.stats.totalRides > 5 ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary text-muted-foreground border-border'}`}>
                        {user.stats.totalRides > 5 ? 'Odlična' : 'Dobra'}
                      </Badge>
                    </div>
                    <div className="relative">
                      <Progress value={Math.min(user.stats.totalRides * 10, 100)} className="h-1.5 progress-glow" />
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[8px] text-muted-foreground/50">0</span>
                        <span className="text-[8px] text-muted-foreground/50">10 voženj</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ── Recent Activity (always visible) ── */}
        <Card className="rounded-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary/60 via-primary/30 to-primary/10" />
          <Tabs defaultValue="rides">
            <CardHeader className="p-4 pb-0">
              <div className="flex items-center justify-between">
                <TabsList className="h-7">
                  <TabsTrigger value="rides" className="text-[11px] gap-1 px-2.5">
                    <Bike className="size-3" /> Vožnje ({rides.filter(r => r.userId === user.id).length})
                  </TabsTrigger>
                  <TabsTrigger value="routes" className="text-[11px] gap-1 px-2.5">
                    <Route className="size-3" /> Poti ({routes.filter(r => r.userId === user.id).length})
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
            <TabsContent value="rides" className="mt-0">
              <CardContent className="p-4 pt-2">
                <ScrollArea className="max-h-52">
                  {rides.filter(r => r.userId === user.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Ni voženj</p>
                  ) : (
                    rides.filter(r => r.userId === user.id).slice(0, 10).map(ride => (
                      <div key={ride.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 cursor-pointer hover:bg-secondary/30 rounded px-2 -mx-2" onClick={() => onOpenDetail(ride, 'ride')}>
                        <div><p className="text-xs font-medium">{ride.title}</p><p className="text-[10px] text-muted-foreground">{formatDate(ride.createdAt)}</p></div>
                        <div className="flex items-center gap-2">
                          <button
                            className="size-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center hover:bg-amber-500/30 transition-colors"
                            title="REWIND - Predvajaj vožnjo"
                            onClick={(e) => { e.stopPropagation(); handleReplayRide(ride) }}
                          >
                            <Play className="size-2.5" />
                          </button>
                          <div className="text-right"><p className="text-xs font-bold text-primary">{ride.distance} km</p><p className="text-[10px] text-muted-foreground">{formatDuration(ride.duration)}</p></div>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </TabsContent>
            <TabsContent value="routes" className="mt-0">
              <CardContent className="p-4 pt-2">
                <ScrollArea className="max-h-52">
                  {routes.filter(r => r.userId === user.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Ni poti</p>
                  ) : (
                    routes.filter(r => r.userId === user.id).slice(0, 10).map(route => (
                      <div key={route.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 cursor-pointer hover:bg-secondary/30 rounded px-2 -mx-2" onClick={() => onOpenDetail(route, 'route')}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`${categoryColor(route.category)} text-[9px] px-1 py-0 h-4`}>{categoryLabel(route.category)}</Badge>
                          <div><p className="text-xs font-medium">{route.title}</p><p className="text-[10px] text-muted-foreground">{formatDate(route.createdAt)}</p></div>
                        </div>
                        <div className="text-right"><p className="text-xs font-bold text-primary">{route.distance} km</p><p className="text-[10px] text-muted-foreground">❤️ {route.likes}</p></div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            COLLAPSIBLE SECTION 6: ⚙️ Nastavitve
            Units, auto-pause, wakelock, toll avoidance
        ════════════════════════════════════════════════════════════════ */}
        <Collapsible open={sectionOpen.nastavitve} onOpenChange={() => toggleSection('nastavitve')}>
          <Card className="rounded-xl overflow-hidden border-l-4 border-l-violet-500/60">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <div className="p-4 pb-0 flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-violet-500/15 shrink-0">
                    <Ruler className="size-4 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">Nastavitve</CardTitle>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/10 text-violet-500">6 opcij</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Enote, samodejni premor, zaslon</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${sectionOpen.nastavitve ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-3 space-y-4">

                {/* Unit system toggle */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Ruler className="size-3.5 text-violet-500" />
                    <span className="text-xs font-medium">Merske enote</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={settings.unitSystem === 'metric' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs flex-1 gap-1"
                      onClick={() => setSettings({ unitSystem: 'metric' })}
                    >
                      🛣️ Kilometri
                    </Button>
                    <Button
                      variant={settings.unitSystem === 'imperial' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs flex-1 gap-1"
                      onClick={() => setSettings({ unitSystem: 'imperial' })}
                    >
                      🇺🇸 Milje
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Trenutno: {settings.unitSystem === 'metric' ? 'km, km/h, m' : 'mi, mph, ft'}
                  </p>
                </div>

                <Separator className="opacity-30" />

                {/* Auto-pause toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="size-3.5 text-violet-500" />
                    <span className="text-xs font-medium">Samodejni premor</span>
                  </div>
                  <button
                    onClick={() => setSettings({ autoPauseEnabled: !settings.autoPauseEnabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.autoPauseEnabled ? 'bg-violet-500' : 'bg-muted'
                    }`}
                    role="switch"
                    aria-checked={settings.autoPauseEnabled}
                  >
                    <span className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.autoPauseEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                {settings.autoPauseEnabled && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Prag hitrosti za premor</span>
                      <span className="text-xs font-bold text-violet-500">{settings.autoPauseSpeedThreshold} km/h</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={settings.autoPauseSpeedThreshold}
                      onChange={e => setSettings({ autoPauseSpeedThreshold: Number(e.target.value) })}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500 bg-muted"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground/50">
                      <span>1 km/h</span>
                      <span>20 km/h</span>
                    </div>
                  </div>
                )}

                <Separator className="opacity-30" />

                {/* WakeLock toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon className="size-3.5 text-violet-500" />
                    <span className="text-xs font-medium">Prepreči zaklep zaslona</span>
                  </div>
                  <button
                    onClick={() => setSettings({ wakelockEnabled: !settings.wakelockEnabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.wakelockEnabled ? 'bg-violet-500' : 'bg-muted'
                    }`}
                    role="switch"
                    aria-checked={settings.wakelockEnabled}
                  >
                    <span className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.wakelockEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">Zaslon ostane vklopljen med snemanjem vožnje</p>

                <Separator className="opacity-30" />

                {/* Avoid tolls toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Route className="size-3.5 text-violet-500" />
                    <span className="text-xs font-medium">Izogibanje cestninam</span>
                  </div>
                  <button
                    onClick={() => setSettings({ avoidTolls: !settings.avoidTolls })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.avoidTolls ? 'bg-violet-500' : 'bg-muted'
                    }`}
                    role="switch"
                    aria-checked={settings.avoidTolls}
                  >
                    <span className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.avoidTolls ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Save all settings button */}
                <Button
                  size="sm"
                  className="w-full text-xs gap-2 bg-violet-500 hover:bg-violet-600 text-white h-7"
                  onClick={async () => {
                    if (!user?.id) return
                    setSettingsSaving(true)
                    const ok = await saveSettings(user.id, settings)
                    setSettingsSaving(false)
                    if (ok) toast.success('Nastavitve shranjene')
                    else toast.error('Napaka pri shranjevanju')
                  }}
                  disabled={settingsSaving}
                >
                  <Save className="size-3" />
                  {settingsSaving ? 'Shranjujem...' : 'Shrani nastavitve'}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ════════════════════════════════════════════════════════════════
            COLLAPSIBLE SECTION 7: 🔒 Zasebnost
            Hide start/end, privacy zones
        ════════════════════════════════════════════════════════════════ */}
        <Collapsible open={sectionOpen.zasebnost} onOpenChange={() => toggleSection('zasebnost')}>
          <Card className="rounded-xl overflow-hidden border-l-4 border-l-rose-500/60">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <div className="p-4 pb-0 flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-rose-500/15 shrink-0">
                    <Shield className="size-4 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">Zasebnost</CardTitle>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-rose-500/10 text-rose-500">{privacyZones.length + 1} nastavitve</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Skrivanje lokacije, cone zasebnosti</p>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${sectionOpen.zasebnost ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-3 space-y-4">

                {/* Hide start/end toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-rose-500" />
                    <div>
                      <span className="text-xs font-medium block">Skrij začetno/končno točko</span>
                      <span className="text-[10px] text-muted-foreground">Zamegli lokacijo doma v javnih vožnjah</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ hideStartEnd: !settings.hideStartEnd })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.hideStartEnd ? 'bg-rose-500' : 'bg-muted'
                    }`}
                    role="switch"
                    aria-checked={settings.hideStartEnd}
                  >
                    <span className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.hideStartEnd ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <Separator className="opacity-30" />

                {/* Privacy Zones */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CircleDot className="size-3.5 text-rose-500" />
                    <span className="text-xs font-medium">Cone zasebnosti ({privacyZones.length})</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Območja, kjer se vaša lokacija samodejno skrije v vožnjah</p>

                  {/* Existing zones */}
                  {privacyZones.length > 0 && (
                    <div className="space-y-1.5">
                      {privacyZones.map(zone => (
                        <div key={zone.id} className="flex items-center justify-between rounded-lg bg-rose-500/10 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="size-3 text-rose-500" />
                            <div>
                              <p className="text-xs font-medium">{zone.name}</p>
                              <p className="text-[10px] text-muted-foreground">{zone.radiusMeters}m radij</p>
                            </div>
                          </div>
                          <button
                            className="size-6 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500/30 transition-colors"
                            onClick={async () => {
                              if (!user?.id) return
                              try {
                                const res = await fetch(`/api/privacy-zones?id=${zone.id}&userId=${user.id}`, { method: 'DELETE' })
                                if (res.ok) {
                                  removePrivacyZone(zone.id)
                                  toast.success('Cona izbrisana')
                                }
                              } catch { toast.error('Napaka') }
                            }}
                          >
                            <Trash2Icon className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new zone */}
                  <div className="space-y-2 mt-2">
                    <Input
                      placeholder="Ime cone (npr. Dom, Služba)"
                      value={newZoneName}
                      onChange={e => setNewZoneName(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Radij: {newZoneRadius}m</span>
                      <input
                        type="range"
                        min={50}
                        max={1000}
                        step={50}
                        value={newZoneRadius}
                        onChange={e => setNewZoneRadius(Number(e.target.value))}
                        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-rose-500 bg-muted"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full text-xs gap-2 bg-rose-500 hover:bg-rose-600 text-white h-7"
                      disabled={addingZone || !newZoneName.trim()}
                      onClick={async () => {
                        if (!user?.id || !newZoneName.trim()) return
                        setAddingZone(true)
                        try {
                          // Use current GPS position as zone center
                          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
                          })
                          const res = await fetch('/api/privacy-zones', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              userId: user.id,
                              name: newZoneName.trim(),
                              lat: pos.coords.latitude,
                              lng: pos.coords.longitude,
                              radiusMeters: newZoneRadius,
                            }),
                          })
                          if (res.ok) {
                            const j = await res.json()
                            addPrivacyZone(j.data)
                            setNewZoneName('')
                            toast.success('Cona zasebnosti dodana!')
                          } else {
                            toast.error('Napaka pri dodajanju')
                          }
                        } catch {
                          toast.error('Napaka pri pridobivanju lokacije. Omogočite GPS.')
                        }
                        setAddingZone(false)
                      }}
                    >
                      <Plus className="size-3" />
                      {addingZone ? 'Dodajam...' : 'Dodaj cono (trenutna lokacija)'}
                    </Button>
                  </div>
                </div>

                {/* Save privacy settings */}
                <Button
                  size="sm"
                  className="w-full text-xs gap-2 bg-rose-500 hover:bg-rose-600 text-white h-7"
                  onClick={async () => {
                    if (!user?.id) return
                    setSettingsSaving(true)
                    const ok = await saveSettings(user.id, { hideStartEnd: settings.hideStartEnd })
                    setSettingsSaving(false)
                    if (ok) toast.success('Zasebnostne nastavitve shranjene')
                    else toast.error('Napaka pri shranjevanju')
                  }}
                  disabled={settingsSaving}
                >
                  <Save className="size-3" />
                  {settingsSaving ? 'Shranjujem...' : 'Shrani zasebnost'}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ── Made by Markec Credit ── */}
        <div className="flex flex-col items-center gap-1.5 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary/30" />
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.15em] font-medium">Made by</span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary/30" />
          </div>
          <span className="text-sm font-bold text-primary/70 tracking-tight">Markec</span>
          <span className="text-[9px] text-muted-foreground/40">MotoTrack v2.0</span>
        </div>

      </div>
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
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              {viewPhoto.caption && (
                <div className="p-4 bg-background/80 backdrop-blur-sm">
                  <p className="text-sm text-foreground">{viewPhoto.caption}</p>
                </div>
              )}
              <div className="flex justify-between items-center p-3 bg-background/60">
                <p className="text-xs text-muted-foreground">{formatDate(viewPhoto.createdAt)}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs gap-1.5 h-7"
                  onClick={() => { handleDeletePhoto(viewPhoto.id); setViewPhoto(null) }}
                >
                  <Trash2 className="size-3" /> Izbriši
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
