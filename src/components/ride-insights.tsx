'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  TrendingUp, Flame, Trophy, Bike, Route, Mountain, Gauge, Clock,
  Calendar, Target, Zap, Award, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RideData {
  id: string
  title: string
  distance: number
  duration: number
  maxSpeed: number
  elevation: number
  createdAt: string | Date
  trackData?: string
}

interface RideInsightsProps {
  rides: RideData[]
  userId?: string
  className?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDistance(km: number): string {
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function getDateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getWeekKey(d: Date): string {
  const start = new Date(d)
  start.setDate(start.getDate() - start.getDay() + 1) // Monday
  return getDateKey(start)
}

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
const DAY_NAMES = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']

// ─── Component ──────────────────────────────────────────────────────────────────

export default function RideInsights({ rides, userId = 'default', className = '' }: RideInsightsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview')
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month')

  // Filter rides by period
  const filteredRides = useMemo(() => {
    const now = new Date()
    return rides.filter(r => {
      const d = new Date(r.createdAt)
      if (period === 'week') {
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return d >= weekAgo
      }
      if (period === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }
      if (period === 'year') {
        return d.getFullYear() === now.getFullYear()
      }
      return true // all
    })
  }, [rides, period])

  // ─── Calculations ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (filteredRides.length === 0) return null

    const totalDist = filteredRides.reduce((s, r) => s + r.distance, 0)
    const totalDur = filteredRides.reduce((s, r) => s + r.duration, 0)
    const totalElev = filteredRides.reduce((s, r) => s + r.elevation, 0)
    const avgSpeed = totalDist > 0 && totalDur > 0 ? (totalDist / (totalDur / 3600)) : 0
    const maxSpeed = Math.max(...filteredRides.map(r => r.maxSpeed))
    const longestRide = Math.max(...filteredRides.map(r => r.distance))
    const avgDist = totalDist / filteredRides.length

    return {
      totalRides: filteredRides.length,
      totalDist: Math.round(totalDist * 10) / 10,
      totalDur,
      totalElev: Math.round(totalElev),
      avgSpeed: Math.round(avgSpeed),
      maxSpeed: Math.round(maxSpeed),
      longestRide: Math.round(longestRide * 10) / 10,
      avgDist: Math.round(avgDist * 10) / 10,
    }
  }, [filteredRides])

  // Riding streak (consecutive days with rides)
  const streak = useMemo(() => {
    if (rides.length === 0) return { current: 0, longest: 0 }
    const rideDays = [...new Set(rides.map(r => getDateKey(new Date(r.createdAt))))].sort().reverse()
    
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 1
    
    // Current streak
    const today = getDateKey(new Date())
    const yesterday = getDateKey(new Date(Date.now() - 86400000))
    
    if (rideDays[0] === today || rideDays[0] === yesterday) {
      currentStreak = 1
      let prevDate = new Date(rideDays[0])
      for (let i = 1; i < rideDays.length; i++) {
        const curr = new Date(rideDays[i])
        const diffDays = Math.round((prevDate.getTime() - curr.getTime()) / 86400000)
        if (diffDays === 1) {
          currentStreak++
          prevDate = curr
        } else break
      }
    }

    // Longest streak
    for (let i = 1; i < rideDays.length; i++) {
      const prev = new Date(rideDays[i - 1])
      const curr = new Date(rideDays[i])
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000)
      if (diffDays === 1) {
        tempStreak++
      } else {
        longestStreak = Math.max(longestStreak, tempStreak)
        tempStreak = 1
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak)

    return { current: currentStreak, longest: longestStreak }
  }, [rides])

  // Weekly heatmap (last 12 weeks)
  const weeklyHeatmap = useMemo(() => {
    const now = new Date()
    const weeks: Array<{ label: string; rides: number; distance: number }> = []
    
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - w * 7 - now.getDay() + 1)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      
      const weekRides = rides.filter(r => {
        const d = new Date(r.createdAt)
        return d >= weekStart && d < weekEnd
      })
      
      weeks.push({
        label: `${weekStart.getDate()}.${weekStart.getMonth() + 1}`,
        rides: weekRides.length,
        distance: weekRides.reduce((s, r) => s + r.distance, 0),
      })
    }
    return weeks
  }, [rides])

  // Day of week preference
  const dayPreference = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0] // Mon-Sun
    rides.forEach(r => {
      const d = new Date(r.createdAt).getDay()
      counts[d === 0 ? 6 : d - 1]++ // Convert to Mon=0
    })
    return DAY_NAMES.map((name, i) => ({ day: name, count: counts[i] }))
  }, [rides])

  // Best rides
  const bestRides = useMemo(() => {
    if (filteredRides.length === 0) return { longest: null, fastest: null, highest: null }
    const sorted = [...filteredRides]
    return {
      longest: sorted.reduce((a, b) => a.distance > b.distance ? a : b),
      fastest: sorted.reduce((a, b) => a.maxSpeed > b.maxSpeed ? a : b),
      highest: sorted.reduce((a, b) => a.elevation > b.elevation ? a : b),
    }
  }, [filteredRides])

  // Riding pace (rides per week average)
  const ridingPace = useMemo(() => {
    if (rides.length < 2) return 0
    const first = new Date(rides[rides.length - 1].createdAt)
    const last = new Date(rides[0].createdAt)
    const weeks = (last.getTime() - first.getTime()) / (7 * 86400000)
    return weeks > 0 ? Math.round((rides.length / weeks) * 10) / 10 : 0
  }, [rides])

  const toggleSection = (s: string) => setExpandedSection(prev => prev === s ? null : s)

  const maxWeekRides = Math.max(...weeklyHeatmap.map(w => w.rides), 1)
  const maxDayCount = Math.max(...dayPreference.map(d => d.count), 1)

  return (
    <div className={className}>
      {/* Period selector */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 className="size-3.5" />
          Vpogledi v vožnje
        </h3>
        <div className="flex gap-1">
          {(['week', 'month', 'year', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                period === p ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              }`}
            >
              {p === 'week' ? '7d' : p === 'month' ? 'Mesec' : p === 'year' ? 'Leto' : 'Vse'}
            </button>
          ))}
        </div>
      </div>

      {/* No data state */}
      {filteredRides.length === 0 && (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <TrendingUp className="size-8 opacity-30 mb-2" />
          <p className="text-sm font-medium">Brez voženj v tem obdobju</p>
          <p className="text-xs mt-1">Začni s sledenjem in vpogledi bodo tukaj!</p>
        </div>
      )}

      {stats && (
        <>
          {/* Overview Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-primary/10 rounded-xl p-2.5 text-center">
              <Bike className="size-4 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold text-primary">{stats.totalRides}</div>
              <div className="text-[9px] text-muted-foreground">Voženj</div>
            </div>
            <div className="bg-green-500/10 rounded-xl p-2.5 text-center">
              <Route className="size-4 text-green-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-green-600">{formatDistance(stats.totalDist)}</div>
              <div className="text-[9px] text-muted-foreground">Skupaj</div>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-2.5 text-center">
              <Mountain className="size-4 text-blue-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-600">{stats.totalElev}m</div>
              <div className="text-[9px] text-muted-foreground">Vzpon</div>
            </div>
          </div>

          {/* Streak & Pace */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-orange-500/10 rounded-xl p-3 flex items-center gap-3">
              <Flame className="size-6 text-orange-500" />
              <div>
                <div className="text-xl font-bold text-orange-600">{streak.current}</div>
                <div className="text-[9px] text-muted-foreground">dnevna serija 🔥</div>
                <div className="text-[8px] text-muted-foreground">Najdaljša: {streak.longest} dni</div>
              </div>
            </div>
            <div className="bg-purple-500/10 rounded-xl p-3 flex items-center gap-3">
              <Target className="size-6 text-purple-500" />
              <div>
                <div className="text-xl font-bold text-purple-600">{ridingPace}</div>
                <div className="text-[9px] text-muted-foreground">voženj/teden</div>
                <div className="text-[8px] text-muted-foreground">Povp. hitrost: {stats.avgSpeed} km/h</div>
              </div>
            </div>
          </div>

          {/* Weekly Activity Heatmap (collapsible) */}
          <div className="mb-2">
            <button
              onClick={() => toggleSection('heatmap')}
              className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1"><Calendar className="size-3" /> Tedenska aktivnost</span>
              {expandedSection === 'heatmap' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            {expandedSection === 'heatmap' && (
              <div className="flex items-end gap-1 h-16 mt-1">
                {weeklyHeatmap.map((w, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={`w-full rounded-t transition-all ${
                        w.rides > 0 ? 'bg-primary' : 'bg-secondary/30'
                      }`}
                      style={{
                        height: `${Math.max(w.rides > 0 ? 20 : 4, (w.rides / maxWeekRides) * 60)}%`,
                        opacity: w.rides > 0 ? 0.5 + (w.rides / maxWeekRides) * 0.5 : 0.3,
                      }}
                      title={`${w.rides} voženj, ${formatDistance(w.distance)}`}
                    />
                    <span className="text-[7px] text-muted-foreground">{w.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Day Preference (collapsible) */}
          <div className="mb-2">
            <button
              onClick={() => toggleSection('days')}
              className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1"><Zap className="size-3" /> Priljubljeni dnevi</span>
              {expandedSection === 'days' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            {expandedSection === 'days' && (
              <div className="flex items-end gap-1.5 h-14 mt-1">
                {dayPreference.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] font-medium">{d.count}</span>
                    <div
                      className={`w-full rounded-t ${d.count > 0 ? 'bg-primary' : 'bg-secondary/30'}`}
                      style={{
                        height: `${Math.max(d.count > 0 ? 8 : 3, (d.count / maxDayCount) * 40)}px`,
                        opacity: d.count > 0 ? 0.5 + (d.count / maxDayCount) * 0.5 : 0.3,
                      }}
                    />
                    <span className="text-[7px] text-muted-foreground">{d.day}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Best Rides (collapsible) */}
          <div className="mb-2">
            <button
              onClick={() => toggleSection('best')}
              className="w-full flex items-center justify-between py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1"><Trophy className="size-3" /> Najboljše vožnje</span>
              {expandedSection === 'best' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            {expandedSection === 'best' && (
              <div className="space-y-1.5 mt-1">
                {bestRides.longest && (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-green-500/10">
                    <Route className="size-4 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{bestRides.longest.title}</div>
                      <div className="text-[10px] text-muted-foreground">Najdaljša vožnja</div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-600 text-[10px]">{formatDistance(bestRides.longest.distance)}</Badge>
                  </div>
                )}
                {bestRides.fastest && (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-500/10">
                    <Gauge className="size-4 text-red-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{bestRides.fastest.title}</div>
                      <div className="text-[10px] text-muted-foreground">Najhitrejša vožnja</div>
                    </div>
                    <Badge className="bg-red-500/20 text-red-600 text-[10px]">{Math.round(bestRides.fastest.maxSpeed)} km/h</Badge>
                  </div>
                )}
                {bestRides.highest && (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-blue-500/10">
                    <Mountain className="size-4 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{bestRides.highest.title}</div>
                      <div className="text-[10px] text-muted-foreground">Največji vzpon</div>
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-600 text-[10px]">{Math.round(bestRides.highest.elevation)}m</Badge>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] bg-secondary/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Povp. razdalja</span>
              <span className="font-medium">{formatDistance(stats.avgDist)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Povp. čas</span>
              <span className="font-medium">{formatDuration(stats.totalDur / stats.totalRides)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Najdaljša</span>
              <span className="font-medium">{formatDistance(stats.longestRide)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max hitrost</span>
              <span className="font-medium">{stats.maxSpeed} km/h</span>
            </div>
          </div>

          {/* Achievements Preview */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {stats.totalRides >= 1 && (
              <Badge variant="secondary" className="text-[9px] gap-1 bg-primary/10 text-primary">
                <Award className="size-2.5" /> Prva vožnja
              </Badge>
            )}
            {stats.totalRides >= 10 && (
              <Badge variant="secondary" className="text-[9px] gap-1 bg-green-500/10 text-green-600">
                <Bike className="size-2.5" /> 10 voženj
              </Badge>
            )}
            {stats.totalRides >= 50 && (
              <Badge variant="secondary" className="text-[9px] gap-1 bg-blue-500/10 text-blue-600">
                <Trophy className="size-2.5" /> 50 voženj
              </Badge>
            )}
            {stats.totalDist >= 100 && (
              <Badge variant="secondary" className="text-[9px] gap-1 bg-orange-500/10 text-orange-600">
                <Route className="size-2.5" /> 100 km
              </Badge>
            )}
            {stats.totalDist >= 1000 && (
              <Badge variant="secondary" className="text-[9px] gap-1 bg-purple-500/10 text-purple-600">
                <Flame className="size-2.5" /> 1000 km
              </Badge>
            )}
            {streak.current >= 3 && (
              <Badge variant="secondary" className="text-[9px] gap-1 bg-red-500/10 text-red-600">
                <Flame className="size-2.5" /> Serija {streak.current}🔥
              </Badge>
            )}
            {stats.maxSpeed >= 120 && (
              <Badge variant="secondary" className="text-[9px] gap-1 bg-red-500/10 text-red-600">
                <Gauge className="size-2.5" /> 120+ km/h
              </Badge>
            )}
          </div>
        </>
      )}
    </div>
  )
}
