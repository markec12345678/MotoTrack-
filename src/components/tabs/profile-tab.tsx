'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  User, Bike, Route, TrendingUp, Mountain, Users, Gauge, Award, Flame,
  Camera, ImageIcon, X, Trash2,
  Phone, Heart, Droplets, AlertTriangle, Save,
  Bell, BellOff, Volume2, VolumeX, AlertOctagon,
  Receipt, Wrench, Plus, CheckCircle2, Calendar,
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
import type { RideData, RouteData, UserData, PhotoData, EmergencyContactsData, SpeedAlertSettings, ExpenseData, MaintenanceReminderData } from '@/components/tabs/types'
import { formatDuration, formatDate, categoryLabel, categoryColor } from '@/components/tabs/types'
import AchievementsPanel from '@/components/tabs/achievements-panel'
import PointsDisplay from '@/components/points-display'
import BluetoothPanel from '@/components/bluetooth-panel'
import OBDPanel from '@/components/obd-panel'
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

  // Expense tracker state
  const [expenses, setExpenses] = useState<ExpenseData[]>([])
  const [expenseTotals, setExpenseTotals] = useState({ allTime: 0, thisMonth: 0 })
  const [expenseByType, setExpenseByType] = useState<Record<string, number>>({})
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [newExpense, setNewExpense] = useState({ type: 'fuel', amount: '', description: '', mileage: '' })
  const [expenseSaving, setExpenseSaving] = useState(false)

  // Maintenance reminders state
  const [reminders, setReminders] = useState<MaintenanceReminderData[]>([])
  const [remindersLoading, setRemindersLoading] = useState(true)
  const [newReminder, setNewReminder] = useState({ type: 'oil_change', title: '', nextMileage: '', nextDate: '', intervalKm: '', intervalDays: '' })
  const [reminderSaving, setReminderSaving] = useState(false)
  const [currentMileage, setCurrentMileage] = useState(0)
  const [mileageSaving, setMileageSaving] = useState(false)

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

  // Fetch maintenance reminders
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setRemindersLoading(true)
    fetch(`/api/maintenance?userId=${user.id}`)
      .then(r => r.json())
      .then(j => {
        if (!cancelled) {
          setReminders(j.data || [])
          setRemindersLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setRemindersLoading(false) })
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

  // Reminder handlers
  const addReminder = useCallback(async () => {
    if (!user?.id || !newReminder.title) return
    setReminderSaving(true)
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: newReminder.type,
          title: newReminder.title,
          nextMileage: newReminder.nextMileage ? parseInt(newReminder.nextMileage) : undefined,
          nextDate: newReminder.nextDate || undefined,
          intervalKm: newReminder.intervalKm ? parseInt(newReminder.intervalKm) : undefined,
          intervalDays: newReminder.intervalDays ? parseInt(newReminder.intervalDays) : undefined,
        }),
      })
      if (res.ok) {
        toast.success('Opomnik dodan')
        setNewReminder({ type: 'oil_change', title: '', nextMileage: '', nextDate: '', intervalKm: '', intervalDays: '' })
        // Refresh reminders
        const j = await (await fetch(`/api/maintenance?userId=${user.id}`)).json()
        setReminders(j.data || [])
      } else {
        toast.error('Napaka pri dodajanju opomnika')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setReminderSaving(false)
    }
  }, [user?.id, newReminder])

  const completeReminder = useCallback(async (reminderId: string) => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/maintenance/${reminderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, completed: true }),
      })
      if (res.ok) {
        toast.success('Vzdrževanje opravljeno')
        const j = await (await fetch(`/api/maintenance?userId=${user.id}`)).json()
        setReminders(j.data || [])
      } else {
        toast.error('Napaka pri označevanju')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
  }, [user?.id])

  const deleteReminder = useCallback(async (reminderId: string) => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/maintenance/${reminderId}?userId=${user.id}`, { method: 'DELETE' })
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== reminderId))
        toast.success('Opomnik izbrisan')
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

        {/* Expense Tracker Card */}
        <Card className="overflow-hidden border-emerald-500/20">
          <div className="h-0.5 bg-gradient-to-r from-emerald-500/80 via-emerald-400/60 to-emerald-500/40" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-7 rounded-lg bg-emerald-500/15">
                <Receipt className="size-4 text-emerald-500" />
              </div>
              <CardTitle className="text-sm">Stroški</CardTitle>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-300 text-emerald-500">EUR</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* Totals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{expenseTotals.thisMonth.toFixed(2)} €</p>
                <p className="text-[10px] text-muted-foreground">Ta mesec</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{expenseTotals.allTime.toFixed(2)} €</p>
                <p className="text-[10px] text-muted-foreground">Skupaj</p>
              </div>
            </div>

            {/* By type mini breakdown */}
            {Object.keys(expenseByType).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(expenseByType).map(([t, amt]) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-muted">
                    {t === 'fuel' ? '⛽' : t === 'maintenance' ? '🔧' : t === 'insurance' ? '🛡️' : t === 'parts' ? '🔩' : t === 'toll' ? '🛣️' : t === 'parking' ? '🅿️' : '📦'}
                    {amt.toFixed(0)} €
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
                    <SelectTrigger className="h-8 text-xs">
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
                    className="h-8 text-xs"
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
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Kilometrina</Label>
                  <Input
                    type="number"
                    placeholder="km"
                    value={newExpense.mileage}
                    onChange={e => setNewExpense(prev => ({ ...prev, mileage: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full text-xs gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={addExpense}
                disabled={expenseSaving || !newExpense.amount}
              >
                <Plus className="size-3.5" />
                {expenseSaving ? 'Dodajam...' : 'Dodaj strošek'}
              </Button>
            </div>

            <Separator className="opacity-30" />

            {/* Recent expenses list */}
            <div className="space-y-1">
              <span className="text-xs font-medium">Zadnji stroški</span>
              {expensesLoading ? (
                <div className="space-y-2 mt-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded" />)}
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-4">
                  <Receipt className="size-8 mx-auto mb-1 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Ni stroškov</p>
                </div>
              ) : (
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {expenses.map(exp => (
                      <div key={exp.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/30 group">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {exp.type === 'fuel' ? '⛽' : exp.type === 'maintenance' ? '🔧' : exp.type === 'insurance' ? '🛡️' : exp.type === 'parts' ? '🔩' : exp.type === 'toll' ? '🛣️' : exp.type === 'parking' ? '🅿️' : '📦'}
                          </span>
                          <div>
                            <p className="text-xs font-medium">{exp.description || (exp.type === 'fuel' ? 'Gorivo' : exp.type === 'maintenance' ? 'Vzdrževanje' : exp.type === 'insurance' ? 'Zavarovanje' : exp.type === 'parts' ? 'Deli' : exp.type === 'toll' ? 'Cestnina' : exp.type === 'parking' ? 'Parkiranje' : 'Drugo')}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDate(exp.date)}
                              {exp.mileage ? ` • ${exp.mileage} km` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{exp.amount.toFixed(2)} €</span>
                          <button
                            className="size-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                            onClick={() => deleteExpense(exp.id)}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Reminders Card */}
        <Card className="overflow-hidden border-violet-500/20">
          <div className="h-0.5 bg-gradient-to-r from-violet-500/80 via-violet-400/60 to-violet-500/40" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-7 rounded-lg bg-violet-500/15">
                <Wrench className="size-4 text-violet-500" />
              </div>
              <CardTitle className="text-sm">Vzdrževanje</CardTitle>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-300 text-violet-500">Opomniki</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* Current mileage */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gauge className="size-3.5 text-violet-500" />
                <span className="text-xs font-medium">Trenutna kilometrina</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type="number"
                    value={currentMileage}
                    onChange={e => setCurrentMileage(parseInt(e.target.value) || 0)}
                    className="h-8 text-xs pr-8"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">km</span>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1 bg-violet-500 hover:bg-violet-600 text-white"
                  onClick={saveMileage}
                  disabled={mileageSaving}
                >
                  <Save className="size-3" />
                  {mileageSaving ? '...' : 'Shrani'}
                </Button>
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* Common presets */}
            <div className="space-y-2">
              <span className="text-xs font-medium">Hitri predloge</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { type: 'oil_change', title: 'Zamenjava olja', intervalKm: 5000, emoji: '🛢️' },
                  { type: 'tire_change', title: 'Zamenjava pnevmatik', intervalKm: 10000, emoji: '🛞' },
                  { type: 'chain_service', title: 'Veriga', intervalKm: 3000, emoji: '⛓️' },
                  { type: 'brake_service', title: 'Zavore', intervalKm: 15000, emoji: '🛑' },
                  { type: 'inspection', title: 'Pregled', intervalDays: 365, emoji: '📋' },
                ].map(preset => (
                  <button
                    key={preset.type}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                    onClick={() => {
                      const nextKm = preset.intervalKm ? currentMileage + preset.intervalKm : undefined
                      const nextDt = preset.intervalDays
                        ? new Date(Date.now() + preset.intervalDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                        : ''
                      setNewReminder({
                        type: preset.type,
                        title: preset.title,
                        nextMileage: nextKm ? String(nextKm) : '',
                        nextDate: nextDt,
                        intervalKm: preset.intervalKm ? String(preset.intervalKm) : '',
                        intervalDays: preset.intervalDays ? String(preset.intervalDays) : '',
                      })
                    }}
                  >
                    {preset.emoji} {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* Add reminder form */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Plus className="size-3.5 text-violet-500" />
                <span className="text-xs font-medium">Dodaj opomnik</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Tip</Label>
                  <Select value={newReminder.type} onValueChange={val => setNewReminder(prev => ({ ...prev, type: val }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oil_change" className="text-xs">🛢️ Zamenjava olja</SelectItem>
                      <SelectItem value="tire_change" className="text-xs">🛞 Pnevmatike</SelectItem>
                      <SelectItem value="chain_service" className="text-xs">⛓️ Veriga</SelectItem>
                      <SelectItem value="brake_service" className="text-xs">🛑 Zavore</SelectItem>
                      <SelectItem value="filter_change" className="text-xs">🔧 Filter</SelectItem>
                      <SelectItem value="inspection" className="text-xs">📋 Pregled</SelectItem>
                      <SelectItem value="custom" className="text-xs">⚙️ Po meri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Naslov</Label>
                  <Input
                    placeholder="Naslov opomnika"
                    value={newReminder.title}
                    onChange={e => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Naslednji pri km</Label>
                  <Input
                    type="number"
                    placeholder="km"
                    value={newReminder.nextMileage}
                    onChange={e => setNewReminder(prev => ({ ...prev, nextMileage: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Naslednji pri datumu</Label>
                  <Input
                    type="date"
                    value={newReminder.nextDate}
                    onChange={e => setNewReminder(prev => ({ ...prev, nextDate: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ponovi vsak X km</Label>
                  <Input
                    type="number"
                    placeholder="npr. 5000"
                    value={newReminder.intervalKm}
                    onChange={e => setNewReminder(prev => ({ ...prev, intervalKm: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ponovi vsak X dni</Label>
                  <Input
                    type="number"
                    placeholder="npr. 365"
                    value={newReminder.intervalDays}
                    onChange={e => setNewReminder(prev => ({ ...prev, intervalDays: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full text-xs gap-2 bg-violet-500 hover:bg-violet-600 text-white"
                onClick={addReminder}
                disabled={reminderSaving || !newReminder.title}
              >
                <Plus className="size-3.5" />
                {reminderSaving ? 'Dodajam...' : 'Dodaj opomnik'}
              </Button>
            </div>

            <Separator className="opacity-30" />

            {/* Active reminders list */}
            <div className="space-y-2">
              <span className="text-xs font-medium">Aktivni opomniki</span>
              {remindersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded" />)}
                </div>
              ) : reminders.filter(r => !r.completed).length === 0 ? (
                <div className="text-center py-4">
                  <Wrench className="size-8 mx-auto mb-1 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Ni aktivnih opomnikov</p>
                </div>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {reminders.filter(r => !r.completed).map(rem => {
                      // Calculate progress
                      let progress = 0
                      let progressLabel = ''
                      if (rem.nextMileage && currentMileage > 0) {
                        const kmRemaining = rem.nextMileage - currentMileage
                        progress = Math.max(0, Math.min(100, ((rem.nextMileage - kmRemaining) / rem.nextMileage) * 100))
                        progressLabel = `${Math.max(0, kmRemaining).toLocaleString()} km do naslednjega`
                      } else if (rem.nextDate) {
                        const daysLeft = Math.ceil((new Date(rem.nextDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        progress = Math.max(0, Math.min(100, 100 - (daysLeft / 365) * 100))
                        progressLabel = `${Math.max(0, daysLeft)} dni do naslednjega`
                      }

                      const isOverdue = (rem.nextMileage && currentMileage >= rem.nextMileage) ||
                        (rem.nextDate && new Date(rem.nextDate) <= new Date())

                      return (
                        <div
                          key={rem.id}
                          className={`rounded-lg border p-3 space-y-2 ${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-500/10' : 'border-border/50'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {rem.type === 'oil_change' ? '🛢️' : rem.type === 'tire_change' ? '🛞' : rem.type === 'chain_service' ? '⛓️' : rem.type === 'brake_service' ? '🛑' : rem.type === 'filter_change' ? '🔧' : rem.type === 'inspection' ? '📋' : '⚙️'}
                              </span>
                              <div>
                                <p className="text-xs font-medium">{rem.title}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  {rem.nextMileage && <span>Ob {rem.nextMileage.toLocaleString()} km</span>}
                                  {rem.nextDate && (
                                    <span className="flex items-center gap-0.5">
                                      <Calendar className="size-2.5" />
                                      {new Date(rem.nextDate).toLocaleDateString('sl-SI')}
                                    </span>
                                  )}
                                  {(rem.intervalKm || rem.intervalDays) && (
                                    <span className="text-violet-500">
                                      (vsak{rem.intervalKm ? ` ${rem.intervalKm.toLocaleString()} km` : ''}{rem.intervalKm && rem.intervalDays ? ' / ' : ''}{rem.intervalDays ? ` ${rem.intervalDays} dni` : ''})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isOverdue && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-red-500 text-white border-0">Zapadlo</Badge>
                            )}
                          </div>
                          {/* Progress bar */}
                          {(progress > 0 || isOverdue) && (
                            <div className="space-y-1">
                              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : 'bg-violet-500'}`}
                                  style={{ width: `${isOverdue ? 100 : Math.min(progress, 100)}%` }}
                                />
                              </div>
                              <p className={`text-[10px] ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                {isOverdue ? 'Potrebno vzdrževanje!' : progressLabel}
                              </p>
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] gap-1 flex-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                              onClick={() => completeReminder(rem.id)}
                            >
                              <CheckCircle2 className="size-3" />
                              Opravljeno
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => deleteReminder(rem.id)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}

              {/* Completed reminders */}
              {reminders.filter(r => r.completed).length > 0 && (
                <>
                  <Separator className="opacity-30" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">Opravljeno ({reminders.filter(r => r.completed).length})</span>
                    </div>
                    <ScrollArea className="max-h-32">
                      <div className="space-y-1">
                        {reminders.filter(r => r.completed).slice(0, 5).map(rem => (
                          <div key={rem.id} className="flex items-center justify-between py-1 px-2 rounded opacity-50">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="size-3 text-emerald-500" />
                              <span className="text-xs line-through">{rem.title}</span>
                            </div>
                            <button
                              className="size-4 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"
                              onClick={() => deleteReminder(rem.id)}
                            >
                              <Trash2 className="size-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        <AchievementsPanel userId={user.id} key={user.id} />

        {/* Points & Level */}
        <PointsDisplay userId={user.id} key={`pts-${user.id}`} />

        {/* Bluetooth Helmet */}
        <BluetoothPanel />

        {/* OBD/IoT Connection */}
        <OBDPanel userId={user?.id} />

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
