'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Wrench, Plus, CheckCircle2, Calendar, Clock, Trash2, ChevronDown,
  Gauge, History, RotateCcw, AlertTriangle, StickyNote,
} from 'lucide-react'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'

// ── Types ──
interface ReminderData {
  id: string
  userId: string
  type: string
  title: string
  nextMileage: number | null
  nextDate: string | null
  intervalKm: number | null
  intervalDays: number | null
  lastServiceKm: number | null
  lastServiceDate: string | null
  notes: string | null
  completed: boolean
  completedAt: string | null
  createdAt: string
}

interface ServiceHistoryEntry {
  id: string
  type: string
  title: string
  date: string
  km: number | null
  notes: string | null
}

interface MaintenanceTrackerProps {
  userId: string
  currentMileage: number
  totalRideKm: number
}

// ── Type config ──
const TYPE_CONFIG: Record<string, { emoji: string; label: string; defaultKm: number; defaultDays: number }> = {
  oil:      { emoji: '🛢️', label: 'Zamenjava olja',     defaultKm: 5000,  defaultDays: 365 },
  tires:    { emoji: '🔧', label: 'Pnevmatike',         defaultKm: 10000, defaultDays: 0 },
  chain:    { emoji: '⛓️', label: 'Veriga',             defaultKm: 3000,  defaultDays: 0 },
  brake:    { emoji: '🛑', label: 'Zavore',             defaultKm: 15000, defaultDays: 0 },
  filter:   { emoji: '🌀', label: 'Filter',             defaultKm: 10000, defaultDays: 0 },
  coolant:  { emoji: '💧', label: 'Hladilna tekočina',  defaultKm: 20000, defaultDays: 730 },
  battery:  { emoji: '🔋', label: 'Baterija',           defaultKm: 0,     defaultDays: 730 },
  inspection: { emoji: '📋', label: 'Pregled',          defaultKm: 0,     defaultDays: 365 },
  custom:   { emoji: '⚙️', label: 'Po meri',           defaultKm: 0,     defaultDays: 0 },
}

function getTypeEmoji(type: string): string {
  return TYPE_CONFIG[type]?.emoji ?? '⚙️'
}

function getTypeLabel(type: string): string {
  return TYPE_CONFIG[type]?.label ?? type
}

// ── Progress color logic ──
function getProgressColor(pctRemaining: number): string {
  if (pctRemaining > 50) return 'bg-emerald-500'
  if (pctRemaining >= 25) return 'bg-amber-500'
  return 'bg-red-500'
}

function getProgressBadge(pctRemaining: number): { bg: string; text: string } {
  if (pctRemaining > 50) return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' }
  if (pctRemaining >= 25) return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' }
  return { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' }
}

// ── Component ──
export default function MaintenanceTracker({ userId, currentMileage, totalRideKm }: MaintenanceTrackerProps) {
  const [reminders, setReminders] = useState<ReminderData[]>([])
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Service history (completed reminders)
  const [history, setHistory] = useState<ServiceHistoryEntry[]>([])

  // New reminder form
  const [formType, setFormType] = useState('oil')
  const [formTitle, setFormTitle] = useState('')
  const [formIntervalKm, setFormIntervalKm] = useState('')
  const [formIntervalDays, setFormIntervalDays] = useState('')
  const [formLastServiceKm, setFormLastServiceKm] = useState('')
  const [formLastServiceDate, setFormLastServiceDate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Collapsible
  const [sectionOpen, setSectionOpen] = useState(true)

  // Fetch reminders
  const fetchReminders = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/maintenance?userId=${userId}`)
      const json = await res.json()
      const data: ReminderData[] = json.data || []
      setReminders(data)

      // Build service history from completed reminders
      const completed: ServiceHistoryEntry[] = data
        .filter(r => r.completedAt)
        .map(r => ({
          id: r.id,
          type: r.type,
          title: r.title,
          date: r.completedAt!,
          km: r.lastServiceKm,
          notes: r.notes,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setHistory(completed)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    setLoading(true)
    fetchReminders()
  }, [fetchReminders])

  // When type changes in form, auto-fill title and intervals
  const handleTypeChange = useCallback((newType: string) => {
    setFormType(newType)
    const cfg = TYPE_CONFIG[newType]
    if (cfg) {
      if (!formTitle) setFormTitle(cfg.label)
      if (cfg.defaultKm > 0 && !formIntervalKm) setFormIntervalKm(String(cfg.defaultKm))
      if (cfg.defaultDays > 0 && !formIntervalDays) setFormIntervalDays(String(cfg.defaultDays))
    }
  }, [formTitle, formIntervalKm, formIntervalDays])

  // Calculate next mileage/date from lastService + interval
  const calculateNext = useCallback(() => {
    const lastKm = formLastServiceKm ? parseInt(formLastServiceKm) : currentMileage
    const intKm = formIntervalKm ? parseInt(formIntervalKm) : null
    const intDays = formIntervalDays ? parseInt(formIntervalDays) : null
    const lastDate = formLastServiceDate ? new Date(formLastServiceDate) : new Date()

    const nextKm = intKm ? lastKm + intKm : null
    const nextDate = intDays ? new Date(lastDate.getTime() + intDays * 24 * 60 * 60 * 1000) : null

    return { nextKm, nextDate }
  }, [formLastServiceKm, formIntervalKm, formIntervalDays, formLastServiceDate, currentMileage])

  // Add reminder
  const handleAdd = useCallback(async () => {
    if (!userId || !formTitle.trim()) {
      toast.error('Naslov je obvezen')
      return
    }
    setSaving(true)
    try {
      const { nextKm, nextDate } = calculateNext()
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: formType,
          title: formTitle.trim(),
          nextMileage: nextKm,
          nextDate: nextDate?.toISOString(),
          intervalKm: formIntervalKm ? parseInt(formIntervalKm) : undefined,
          intervalDays: formIntervalDays ? parseInt(formIntervalDays) : undefined,
          lastServiceKm: formLastServiceKm ? parseInt(formLastServiceKm) : undefined,
          lastServiceDate: formLastServiceDate || undefined,
          notes: formNotes.trim() || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Opomnik dodan')
        setAddDialogOpen(false)
        resetForm()
        await fetchReminders()
      } else {
        toast.error('Napaka pri dodajanju opomnika')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setSaving(false)
    }
  }, [userId, formType, formTitle, formIntervalKm, formIntervalDays, formLastServiceKm, formLastServiceDate, formNotes, calculateNext, fetchReminders])

  // Mark as done (auto-reset)
  const handleMarkDone = useCallback(async (reminder: ReminderData) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/maintenance/${reminder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true, currentMileage }),
      })
      if (res.ok) {
        toast.success(`${reminder.title} — opravljeno!`)
        await fetchReminders()
      } else {
        toast.error('Napaka pri označevanju')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
  }, [userId, currentMileage, fetchReminders])

  // Delete reminder
  const handleDelete = useCallback(async (reminderId: string) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/maintenance/${reminderId}?userId=${userId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Opomnik izbrisan')
        await fetchReminders()
      } else {
        toast.error('Napaka pri brisanju')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
  }, [userId, fetchReminders])

  // Add manual service history entry
  const handleAddHistory = useCallback(async () => {
    if (!userId || !formTitle.trim()) {
      toast.error('Naslov je obvezen')
      return
    }
    setSaving(true)
    try {
      // Create a completed reminder as history entry
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: formType,
          title: formTitle.trim(),
          lastServiceKm: formLastServiceKm ? parseInt(formLastServiceKm) : currentMileage,
          lastServiceDate: formLastServiceDate || new Date().toISOString(),
          notes: formNotes.trim() || undefined,
          completed: true,
        }),
      })
      if (res.ok) {
        toast.success('Servis dodan v zgodovino')
        setAddDialogOpen(false)
        resetForm()
        await fetchReminders()
      } else {
        toast.error('Napaka pri dodajanju')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setSaving(false)
    }
  }, [userId, formType, formTitle, formLastServiceKm, formLastServiceDate, formNotes, currentMileage, fetchReminders])

  const resetForm = () => {
    setFormType('oil')
    setFormTitle('')
    setFormIntervalKm('')
    setFormIntervalDays('')
    setFormLastServiceKm('')
    setFormLastServiceDate('')
    setFormNotes('')
  }

  // ── Calculate progress for a reminder ──
  const calcProgress = useCallback((rem: ReminderData): { pct: number; pctRemaining: number; label: string; isOverdue: boolean } => {
    let pct = 0
    let pctRemaining = 100
    let label = ''
    let isOverdue = false

    if (rem.nextMileage && rem.lastServiceKm !== null && rem.lastServiceKm !== undefined) {
      const total = rem.nextMileage - rem.lastServiceKm
      const used = currentMileage - rem.lastServiceKm
      const kmRemaining = rem.nextMileage - currentMileage
      pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
      pctRemaining = 100 - pct
      label = `${Math.max(0, kmRemaining).toLocaleString()} km`
      isOverdue = kmRemaining <= 0
    } else if (rem.nextMileage && currentMileage > 0) {
      const kmRemaining = rem.nextMileage - currentMileage
      // Rough estimate if no lastServiceKm
      pct = kmRemaining <= 0 ? 100 : Math.max(0, Math.min(100, 100 - (kmRemaining / rem.nextMileage) * 100))
      pctRemaining = 100 - pct
      label = `${Math.max(0, kmRemaining).toLocaleString()} km`
      isOverdue = kmRemaining <= 0
    }

    if (rem.nextDate) {
      const daysLeft = Math.ceil((new Date(rem.nextDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (!label) {
        // Only date-based
        const totalDays = rem.intervalDays || 365
        pct = totalDays > 0 ? Math.min(100, Math.max(0, 100 - (daysLeft / totalDays) * 100)) : 0
        pctRemaining = 100 - pct
        label = `${Math.max(0, daysLeft)} dni`
        isOverdue = daysLeft <= 0
      } else {
        // Both km and date — append "ali X dni"
        label += ` ali ${Math.max(0, daysLeft)} dni`
        if (daysLeft <= 0) isOverdue = true
      }
    }

    return { pct, pctRemaining, label, isOverdue }
  }, [currentMileage])

  // ── Quick presets ──
  const quickPresets = [
    { type: 'oil', title: 'Zamenjava olja', intervalKm: 5000, emoji: '🛢️' },
    { type: 'tires', title: 'Pnevmatike', intervalKm: 10000, emoji: '🔧' },
    { type: 'chain', title: 'Veriga', intervalKm: 3000, emoji: '⛓️' },
    { type: 'brake', title: 'Zavore', intervalKm: 15000, emoji: '🛑' },
    { type: 'inspection', title: 'Pregled', intervalDays: 365, emoji: '📋' },
  ]

  const activeReminders = reminders.filter(r => !r.completed)
  const overdueCount = activeReminders.filter(r => calcProgress(r).isOverdue).length

  return (
    <Card className="rounded-xl overflow-hidden border-l-4 border-l-violet-500/60">
      <Collapsible open={sectionOpen} onOpenChange={setSectionOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="p-4 pb-0 flex items-center gap-3">
              <div className="flex items-center justify-center size-8 rounded-lg bg-violet-500/15 shrink-0">
                <Wrench className="size-4 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Vzdrževanje motorja</CardTitle>
                  {activeReminders.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/10 text-violet-500">
                      {activeReminders.length} opomnikov
                    </Badge>
                  )}
                  {overdueCount > 0 && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-500 text-white border-0">
                      {overdueCount} zapadlo
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Opomniki, zgodovina servisov, kilometrina
                </p>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${sectionOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-4 pt-3 space-y-4">

            {/* ── Mileage Sync Section ── */}
            <div className="rounded-lg bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="size-3.5 text-violet-500" />
                  <span className="text-xs font-medium">Trenutna kilometrina</span>
                </div>
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{currentMileage.toLocaleString()} km</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Skupaj prevoženih km iz voženj</span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{totalRideKm.toLocaleString()} km</span>
              </div>
            </div>

            {/* ── Quick Add Presets ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium">Hitri opomniki</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1 border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                  onClick={() => { resetForm(); setAddDialogOpen(true) }}
                >
                  <Plus className="size-3" />
                  Dodaj opomnik
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {quickPresets.map(preset => (
                  <button
                    key={preset.type}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                    onClick={async () => {
                      const nextKm = preset.intervalKm ? currentMileage + preset.intervalKm : undefined
                      const nextDt = preset.intervalDays
                        ? new Date(Date.now() + preset.intervalDays * 24 * 60 * 60 * 1000).toISOString()
                        : undefined
                      setSaving(true)
                      try {
                        const res = await fetch('/api/maintenance', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userId,
                            type: preset.type,
                            title: preset.title,
                            nextMileage: nextKm,
                            nextDate: nextDt,
                            intervalKm: preset.intervalKm || undefined,
                            intervalDays: preset.intervalDays || undefined,
                            lastServiceKm: currentMileage,
                            lastServiceDate: new Date().toISOString(),
                          }),
                        })
                        if (res.ok) {
                          toast.success(`${preset.emoji} ${preset.title} dodan`)
                          await fetchReminders()
                        } else {
                          toast.error('Napaka pri dodajanju')
                        }
                      } catch {
                        toast.error('Napaka pri povezavi')
                      } finally {
                        setSaving(false)
                      }
                    }}
                    disabled={saving}
                  >
                    {preset.emoji} {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* ── Active Reminders List ── */}
            <div className="space-y-2">
              <span className="text-[11px] font-medium">Opomniki</span>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded" />)}
                </div>
              ) : activeReminders.length === 0 ? (
                <div className="text-center py-4">
                  <Wrench className="size-8 mx-auto mb-1 text-muted-foreground/20" />
                  <p className="text-[10px] text-muted-foreground">Ni aktivnih opomnikov</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">Dodajte opomnik za sledenje vzdrževanja</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {activeReminders.map(rem => {
                      const { pct, pctRemaining, label, isOverdue } = calcProgress(rem)
                      const badge = getProgressBadge(pctRemaining)

                      return (
                        <div
                          key={rem.id}
                          className={`rounded-lg border p-3 space-y-2 transition-colors ${
                            isOverdue
                              ? 'border-red-300 bg-red-50 dark:bg-red-500/10'
                              : 'border-border/50 hover:border-violet-300/50'
                          }`}
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{getTypeEmoji(rem.type)}</span>
                              <div>
                                <p className="text-xs font-semibold">{rem.title}</p>
                                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                  {rem.nextMileage && <span>Ob {rem.nextMileage.toLocaleString()} km</span>}
                                  {rem.nextDate && (
                                    <span className="flex items-center gap-0.5">
                                      <Calendar className="size-2" />
                                      {new Date(rem.nextDate).toLocaleDateString('sl-SI')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isOverdue && (
                                <Badge className="text-[8px] px-1 py-0 bg-red-500 text-white border-0 h-4">
                                  <AlertTriangle className="size-2.5 mr-0.5" />
                                  Zapadlo
                                </Badge>
                              )}
                              <div className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${badge.bg} ${badge.text}`}>
                                {Math.round(pctRemaining)}%
                              </div>
                            </div>
                          </div>

                          {/* Progress bar */}
                          {(pct > 0 || isOverdue) && (
                            <div className="space-y-1">
                              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : getProgressColor(pctRemaining)}`}
                                  style={{ width: `${isOverdue ? 100 : Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <p className={`text-[9px] ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                  {isOverdue ? 'Potrebno vzdrževanje!' : `NASLEDNJE: ${label}`}
                                </p>
                                <p className="text-[9px] text-muted-foreground">
                                  Preostane: {label}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Interval info */}
                          {(rem.intervalKm || rem.intervalDays) && (
                            <div className="flex items-center gap-1.5">
                              <RotateCcw className="size-2.5 text-violet-500" />
                              <span className="text-[9px] text-violet-500 font-medium">
                                Ponovi vsak{rem.intervalKm ? ` ${rem.intervalKm.toLocaleString()} km` : ''}{rem.intervalKm && rem.intervalDays ? ' ali ' : ''}{rem.intervalDays ? `${rem.intervalDays} dni` : ''}
                              </span>
                            </div>
                          )}

                          {/* Last service info */}
                          {(rem.lastServiceKm !== null || rem.lastServiceDate) && (
                            <div className="text-[9px] text-muted-foreground">
                              Zadnje servisiranje:
                              {rem.lastServiceKm !== null && ` ${rem.lastServiceKm.toLocaleString()} km`}
                              {rem.lastServiceDate && ` (${new Date(rem.lastServiceDate).toLocaleDateString('sl-SI')})`}
                            </div>
                          )}

                          {/* Notes */}
                          {rem.notes && (
                            <div className="flex items-start gap-1.5">
                              <StickyNote className="size-2.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                              <p className="text-[9px] text-muted-foreground/70 line-clamp-2">{rem.notes}</p>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[9px] gap-1 flex-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                              onClick={() => handleMarkDone(rem)}
                            >
                              <CheckCircle2 className="size-2.5" />
                              Označi kot opravljeno
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[9px] gap-0.5 text-destructive border-destructive/30 hover:bg-destructive/10 px-2"
                              onClick={() => handleDelete(rem.id)}
                            >
                              <Trash2 className="size-2.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            <Separator className="opacity-30" />

            {/* ── Service History ── */}
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <button className="w-full flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <History className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium">Zgodovina servisov</span>
                  {history.length > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{history.length}</Badge>
                  )}
                </div>
                <ChevronDown className={`size-3 text-muted-foreground transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
              </button>
              <CollapsibleContent>
                <div className="mt-2 space-y-1">
                  {history.length === 0 ? (
                    <div className="text-center py-3">
                      <History className="size-5 mx-auto mb-1 text-muted-foreground/20" />
                      <p className="text-[10px] text-muted-foreground">Ni zgodovine servisov</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">Označite opomnik kot opravljen za vnos</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-48">
                      <div className="space-y-0.5">
                        {history.map(entry => (
                          <div key={entry.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/30 group">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">{getTypeEmoji(entry.type)}</span>
                              <div>
                                <p className="text-[11px] font-medium">{entry.title}</p>
                                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                  <span>{new Date(entry.date).toLocaleDateString('sl-SI')}</span>
                                  {entry.km !== null && <span>· {entry.km.toLocaleString()} km</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {entry.notes && (
                                <span className="text-[9px] text-muted-foreground/50 max-w-[100px] truncate">{entry.notes}</span>
                              )}
                              <button
                                className="size-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(entry.id)}
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
              </CollapsibleContent>
            </Collapsible>

          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Add Reminder Dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-sm font-semibold">Dodaj opomnik</DialogTitle>

          <div className="space-y-3 mt-2">
            {/* Type selector */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tip</Label>
              <Select value={formType} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {cfg.emoji} {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Naslov</Label>
              <Input
                placeholder="Naslov opomnika"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Interval: km and/or days */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Interval km</Label>
                <Input
                  type="number"
                  placeholder="npr. 5000"
                  value={formIntervalKm}
                  onChange={e => setFormIntervalKm(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Interval dni</Label>
                <Input
                  type="number"
                  placeholder="npr. 365"
                  value={formIntervalDays}
                  onChange={e => setFormIntervalDays(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Last service */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Zadnje servisiranje km</Label>
                <Input
                  type="number"
                  placeholder={currentMileage > 0 ? String(currentMileage) : 'km'}
                  value={formLastServiceKm}
                  onChange={e => setFormLastServiceKm(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Zadnje servisiranje datum</Label>
                <Input
                  type="date"
                  value={formLastServiceDate}
                  onChange={e => setFormLastServiceDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Opombe</Label>
              <Input
                placeholder="Opombe o servisiranju..."
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Preview next service */}
            {(formIntervalKm || formIntervalDays) && (
              <div className="rounded-lg bg-violet-500/10 p-2.5">
                <p className="text-[10px] font-medium text-violet-600 dark:text-violet-400">
                  Naslednje servisiranje:
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formIntervalKm && `Ob ${((formLastServiceKm ? parseInt(formLastServiceKm) : currentMileage) + parseInt(formIntervalKm || '0')).toLocaleString()} km`}
                  {formIntervalKm && formIntervalDays && ' ali '}
                  {formIntervalDays && `${formIntervalDays} dni po zadnjem servisu`}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 text-xs gap-2 bg-violet-500 hover:bg-violet-600 text-white h-8"
                onClick={handleAdd}
                disabled={saving || !formTitle.trim()}
              >
                <Plus className="size-3" />
                {saving ? 'Dodajam...' : 'Dodaj opomnik'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1 h-8 border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                onClick={handleAddHistory}
                disabled={saving || !formTitle.trim()}
              >
                <History className="size-3" />
                Samo zgodovina
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
