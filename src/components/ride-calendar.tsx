'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Bike, Clock, Gauge,
  Mountain, TrendingUp, Route, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CalendarRide {
  id: string
  title: string
  distance: number
  duration: number
  maxSpeed: number
  elevation: number
  hour: number
}

interface CalendarStats {
  totalRides: number
  totalDistance: number
  totalDuration: number
  totalElevation: number
  longestRide: number
  fastestRide: number
  avgDistance: number
  avgDuration: number
}

interface RideCalendarProps {
  userId?: string
  onRideClick?: (rideId: string) => void
  className?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
]

const DAY_NAMES = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  // Convert Sunday=0 to Monday-first (0=Mon, 6=Sun)
  return day === 0 ? 6 : day - 1
}

function formatDistance(km: number): string {
  if (km >= 100) return `${Math.round(km)} km`
  return `${km.toFixed(1)} km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function getIntensityColor(rideCount: number): string {
  if (rideCount === 0) return ''
  if (rideCount === 1) return 'bg-primary/20 text-primary'
  if (rideCount === 2) return 'bg-primary/40 text-primary-foreground'
  if (rideCount >= 3) return 'bg-primary/70 text-primary-foreground'
  return ''
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function RideCalendar({ userId = 'default', onRideClick, className = '' }: RideCalendarProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [rides, setRides] = useState<Record<string, CalendarRide[]>>({})
  const [stats, setStats] = useState<CalendarStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Fetch calendar data
  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ride-calendar?userId=${userId}&year=${year}&month=${month + 1}`)
      const data = await res.json()
      if (data.rides) setRides(data.rides)
      if (data.stats) setStats(data.stats)
    } catch {
      toast.error('Napaka pri nalaganju koledarja')
    } finally {
      setLoading(false)
    }
  }, [userId, year, month])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  // Navigation
  const prevMonth = useCallback(() => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else { setMonth(m => m - 1) }
  }, [month])

  const nextMonth = useCallback(() => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else { setMonth(m => m + 1) }
  }, [month])

  const goToToday = useCallback(() => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }, [])

  // Calendar grid
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDate = today.getDate()

  // Build calendar cells
  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number | null; dateKey: string }> = []
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, dateKey: '' })
    }
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, dateKey })
    }
    return cells
  }, [year, month, firstDay, daysInMonth])

  // Selected day rides
  const selectedDayRides = selectedDay ? (rides[selectedDay] || []) : []

  return (
    <div className={className}>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Calendar className="size-4 text-primary" />
          Koledar voženj
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToToday}>
            Danes
          </Button>
          <button onClick={prevMonth} className="size-7 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors">
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="size-7 rounded-lg hover:bg-secondary flex items-center justify-center transition-colors">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.totalRides > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-primary">{stats.totalRides}</div>
            <div className="text-[9px] text-muted-foreground">Voženj</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-primary">{formatDistance(stats.totalDistance)}</div>
            <div className="text-[9px] text-muted-foreground">Skupaj</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-primary">{formatDuration(stats.totalDuration)}</div>
            <div className="text-[9px] text-muted-foreground">Čas</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-primary">{Math.round(stats.totalElevation)}m</div>
            <div className="text-[9px] text-muted-foreground">Vzpon</div>
          </div>
        </div>
      )}

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map(day => (
          <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, i) => {
          if (!cell.day) {
            return <div key={`empty-${i}`} className="aspect-square" />
          }

          const dayRides = rides[cell.dateKey] || []
          const isToday = isCurrentMonth && cell.day === todayDate
          const isSelected = selectedDay === cell.dateKey
          const hasRides = dayRides.length > 0

          return (
            <button
              key={cell.dateKey}
              onClick={() => setSelectedDay(isSelected ? null : cell.dateKey)}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition-all
                ${isToday ? 'ring-2 ring-primary' : ''}
                ${isSelected ? 'bg-primary/20 ring-1 ring-primary' : hasRides ? getIntensityColor(dayRides.length) : 'hover:bg-secondary/50'}
              `}
            >
              <span className={`font-medium ${isToday ? 'text-primary' : ''}`}>
                {cell.day}
              </span>
              {hasRides && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayRides.slice(0, 3).map((_, j) => (
                    <div key={j} className="size-1 rounded-full bg-primary" />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-3 border border-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-secondary/30 flex items-center justify-between">
            <span className="text-xs font-semibold">
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {selectedDayRides.length} {selectedDayRides.length === 1 ? 'vožnja' : 'vožnje'}
            </Badge>
          </div>
          {selectedDayRides.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Ni voženj na ta dan
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto divide-y divide-border">
              {selectedDayRides.map(ride => (
                <button
                  key={ride.id}
                  onClick={() => onRideClick?.(ride.id)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left"
                >
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bike className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{ride.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Route className="size-2.5" />
                        {formatDistance(ride.distance)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="size-2.5" />
                        {formatDuration(ride.duration)}
                      </span>
                      {ride.elevation > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Mountain className="size-2.5" />
                          {Math.round(ride.elevation)}m
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="size-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monthly summary */}
      {stats && stats.totalRides > 0 && (
        <div className="mt-3 p-3 bg-secondary/20 rounded-xl">
          <div className="text-xs font-semibold mb-2">Povzetek meseca</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="size-3" /> Povprečna razdalja
              </span>
              <span className="font-medium">{formatDistance(stats.avgDistance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" /> Povprečen čas
              </span>
              <span className="font-medium">{formatDuration(stats.avgDuration)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Route className="size-3" /> Najdaljša vožnja
              </span>
              <span className="font-medium">{formatDistance(stats.longestRide)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Gauge className="size-3" /> Najvišja hitrost
              </span>
              <span className="font-medium">{Math.round(stats.fastestRide)} km/h</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && stats && stats.totalRides === 0 && (
        <div className="mt-4 flex flex-col items-center text-center py-6 text-muted-foreground">
          <Calendar className="size-10 opacity-30 mb-2" />
          <p className="text-sm font-medium">Brez voženj</p>
          <p className="text-xs mt-1">Začni s sledenjem in vožnje bodo tukaj!</p>
        </div>
      )}
    </div>
  )
}
