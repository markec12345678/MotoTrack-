'use client'

import React, { useMemo } from 'react'
import {
  TrendingUp, Clock, Gauge, Zap, BarChart3, Calendar,
  Route, Trophy, ArrowUpRight, ArrowDownRight, Minus,
  Activity, Target, Timer, Flame,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'
import type { RideData, RouteData } from '@/components/tabs/types'

// Slovenian locale constants
const DAYS_SL = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
const MONTHS_SL = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']

// Speed distribution segments
const SPEED_SEGMENTS = [
  { label: '0–50', min: 0, max: 50, color: '#22c55e', name: 'Mestna' },
  { label: '50–90', min: 50, max: 90, color: '#f59e0b', name: 'Primestna' },
  { label: '90–130', min: 90, max: 130, color: '#f97316', name: 'Hitra cesta' },
  { label: '130+', min: 130, max: Infinity, color: '#ef4444', name: 'Avtocesta' },
]

interface EnhancedStatsDashboardProps {
  rides: RideData[]
  routes?: RouteData[]
  className?: string
}

export default function EnhancedStatsDashboard({ rides, routes, className }: EnhancedStatsDashboardProps) {
  // ── Compute all stats ──
  const stats = useMemo(() => {
    if (rides.length === 0) return null

    const totalDistance = rides.reduce((s, r) => s + (r.distance || 0), 0)
    const totalTime = rides.reduce((s, r) => s + (r.duration || 0), 0)
    const avgSpeed = rides.length > 0
      ? rides.reduce((s, r) => s + (r.avgSpeed || 0), 0) / rides.length
      : 0
    const maxSpeed = rides.reduce((max, r) => Math.max(max, r.maxSpeed || 0), 0)

    // Trend: compare last 30 days vs previous 30 days
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000)
    const recentRides = rides.filter(r => new Date(r.createdAt) >= thirtyDaysAgo)
    const olderRides = rides.filter(r => {
      const d = new Date(r.createdAt)
      return d >= sixtyDaysAgo && d < thirtyDaysAgo
    })
    const recentDist = recentRides.reduce((s, r) => s + (r.distance || 0), 0)
    const olderDist = olderRides.reduce((s, r) => s + (r.distance || 0), 0)
    const distanceTrend = olderDist > 0
      ? ((recentDist - olderDist) / olderDist) * 100
      : recentDist > 0 ? 100 : 0

    return { totalDistance, totalTime, avgSpeed, maxSpeed, distanceTrend }
  }, [rides])

  // ── Weekly overview data ──
  const weeklyData = useMemo(() => {
    const dayCounts = DAYS_SL.map((day, i) => ({ day, count: 0 }))
    rides.forEach(r => {
      const d = new Date(r.createdAt)
      // getDay(): 0=Sun, 1=Mon, ..., 6=Sat → convert to Mon=0...Sun=6
      const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1
      dayCounts[dayIdx].count += 1
    })
    return dayCounts
  }, [rides])

  // ── Monthly activity data (last 12 months) ──
  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: Array<{ key: string; label: string; distance: number }> = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({
        key,
        label: `${MONTHS_SL[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        distance: 0,
      })
    }
    rides.forEach(r => {
      const d = new Date(r.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const m = months.find(m => m.key === key)
      if (m) m.distance += r.distance || 0
    })
    return months
  }, [rides])

  // ── Speed distribution ──
  const speedData = useMemo(() => {
    if (rides.length === 0) return { segments: [], dominantLabel: '-', dominantName: '' }

    const segments = SPEED_SEGMENTS.map(seg => ({
      ...seg,
      value: 0,
    }))

    rides.forEach(r => {
      const avg = r.avgSpeed || 0
      for (const seg of segments) {
        if (avg >= seg.min && avg < seg.max) {
          seg.value += 1
          break
        }
      }
    })

    // Find dominant
    const dominant = segments.reduce((max, seg) => seg.value > max.value ? seg : max, segments[0])
    return { segments, dominantLabel: dominant.label, dominantName: dominant.name }
  }, [rides])

  // ── Top routes ──
  const topRoutes = useMemo(() => {
    const routeList = routes || []
    // Combine rides and routes, sort by distance
    const allItems: Array<{ title: string; distance: number; type: 'ride' | 'route' }> = [
      ...rides.map(r => ({ title: r.title, distance: r.distance || 0, type: 'ride' as const })),
      ...routeList.map(r => ({ title: r.title, distance: r.distance || 0, type: 'route' as const })),
    ]
    allItems.sort((a, b) => b.distance - a.distance)
    return allItems.slice(0, 5)
  }, [rides, routes])

  // ── Records ──
  const records = useMemo(() => {
    if (rides.length === 0) return null

    const longestRide = rides.reduce((max, r) =>
      (r.distance || 0) > (max.distance || 0) ? r : max, rides[0])
    const fastestRide = rides.reduce((max, r) =>
      (r.avgSpeed || 0) > (max.avgSpeed || 0) ? r : max, rides[0])
    const highestSpeed = rides.reduce((max, r) =>
      (r.maxSpeed || 0) > (max.maxSpeed || 0) ? r : max, rides[0])

    // Streak: longest consecutive days with rides
    const rideDates = [...new Set(rides.map(r => new Date(r.createdAt).toDateString()))].sort()
    let longestStreak = 0
    let currentStreak = 0
    for (let i = 0; i < rideDates.length; i++) {
      if (i === 0) {
        currentStreak = 1
      } else {
        const diff = (new Date(rideDates[i]).getTime() - new Date(rideDates[i - 1]).getTime()) / 86400000
        currentStreak = diff === 1 ? currentStreak + 1 : 1
      }
      longestStreak = Math.max(longestStreak, currentStreak)
    }

    return {
      longestRide: { title: longestRide.title, value: `${(longestRide.distance || 0).toFixed(1)} km` },
      fastestRide: { title: fastestRide.title, value: `${(fastestRide.avgSpeed || 0).toFixed(1)} km/h` },
      highestSpeed: { title: highestSpeed.title, value: `${(highestSpeed.maxSpeed || 0).toFixed(0)} km/h` },
      streak: longestStreak,
    }
  }, [rides])

  // ── Empty state ──
  if (!stats || rides.length === 0) {
    return (
      <Card className={`rounded-xl ${className ?? ''}`}>
        <CardContent className="p-8 text-center">
          <Activity className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Ni podatkov o vožnjah</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Začni s sledenjem voženj za napredno statistiko</p>
        </CardContent>
      </Card>
    )
  }

  // ── Format helpers ──
  const formatKm = (v: number) => v.toLocaleString('sl-SI', { maximumFractionDigits: 1 })
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}min`
    return `${m}min`
  }

  const trendIcon = stats.distanceTrend > 5
    ? <ArrowUpRight className="size-3.5 text-emerald-400" />
    : stats.distanceTrend < -5
      ? <ArrowDownRight className="size-3.5 text-red-400" />
      : <Minus className="size-3 text-muted-foreground" />

  const maxRouteDistance = topRoutes.length > 0 ? topRoutes[0].distance : 1

  return (
    <div className={`space-y-4 ${className ?? ''}`}>

      {/* ══════════════════════════════════════════════
          a. POVZETEK – Summary Cards (2×2 grid)
      ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          icon={<Route className="size-4 text-orange-400" />}
          label="Skupna razdalja"
          value={`${formatKm(stats.totalDistance)} km`}
          trend={stats.distanceTrend}
          trendIcon={trendIcon}
          colorClass="from-orange-500/15 to-orange-500/5"
        />
        <SummaryCard
          icon={<Clock className="size-4 text-sky-400" />}
          label="Skupni čas"
          value={formatTime(stats.totalTime)}
          colorClass="from-sky-500/15 to-sky-500/5"
        />
        <SummaryCard
          icon={<Gauge className="size-4 text-emerald-400" />}
          label="Povprečna hitrost"
          value={`${formatKm(stats.avgSpeed)} km/h`}
          colorClass="from-emerald-500/15 to-emerald-500/5"
        />
        <SummaryCard
          icon={<Zap className="size-4 text-red-400" />}
          label="Najvišja hitrost"
          value={`${formatKm(stats.maxSpeed)} km/h`}
          colorClass="from-red-500/15 to-red-500/5"
        />
      </div>

      {/* ══════════════════════════════════════════════
          b. TEDENSKI PREGLED – Weekly Bar Chart
      ══════════════════════════════════════════════ */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-orange-400" />
            <span className="text-sm font-bold">Tedenski pregled</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
              Voženj / dan
            </Badge>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 10,
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                  }}
                  // @ts-expect-error Recharts formatter type mismatch
                  formatter={(v: number) => [`${v}`, 'Voženj']}
                />
                <Bar
                  dataKey="count"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════
          c. MESEČNA AKTIVNOST – Area Chart (12 months)
      ══════════════════════════════════════════════ */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-orange-400" />
            <span className="text-sm font-bold">Mesečna aktivnost</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
              Zadnjih 12 mesecev
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                <defs>
                  <linearGradient id="distGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 10,
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                  }}
                  // @ts-expect-error Recharts formatter type mismatch
                  formatter={(v: number) => [`${v.toFixed(1)} km`, 'Razdalja']}
                />
                <Area
                  type="monotone"
                  dataKey="distance"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#distGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════
          d. DISTRIBUCIJA HITROSTI – Donut Chart
      ══════════════════════════════════════════════ */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-orange-400" />
            <span className="text-sm font-bold">Distribucija hitrosti</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Donut chart */}
            <div className="relative h-[160px] w-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={speedData.segments.filter(s => s.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                    paddingAngle={2}
                  >
                    {speedData.segments.filter(s => s.value > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold">{speedData.dominantLabel}</span>
                <span className="text-[9px] text-muted-foreground">{speedData.dominantName}</span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-2">
              {speedData.segments.map((seg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ background: seg.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{seg.label} km/h</span>
                      <span className="text-[11px] font-bold">{seg.value}</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60">{seg.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════
          e. TOP RUTE – Top 5 by distance
      ══════════════════════════════════════════════ */}
      {topRoutes.length > 0 && (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-amber-400" />
              <span className="text-sm font-bold">Top rute</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                Po razdalji
              </Badge>
            </div>
            <div className="space-y-2.5">
              {topRoutes.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">
                        {i + 1}.
                      </span>
                      <span className="text-xs truncate">{item.title}</span>
                      <Badge
                        variant="outline"
                        className="text-[8px] px-1 py-0 h-3.5 shrink-0"
                      >
                        {item.type === 'ride' ? 'Vožnja' : 'Ruta'}
                      </Badge>
                    </div>
                    <span className="text-xs font-bold shrink-0 ml-2">
                      {formatKm(item.distance)} km
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-muted/50 overflow-hidden ml-6">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
                      style={{ width: `${Math.max(4, (item.distance / maxRouteDistance) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════
          f. REKORDI – Key records
      ══════════════════════════════════════════════ */}
      {records && (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-orange-400" />
              <span className="text-sm font-bold">Rekordi</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <RecordCard
                icon={<Route className="size-3.5 text-emerald-400" />}
                label="Najdaljša vožnja"
                value={records.longestRide.value}
                subtitle={records.longestRide.title}
              />
              <RecordCard
                icon={<Gauge className="size-3.5 text-sky-400" />}
                label="Najhitrejša vožnja"
                value={records.fastestRide.value}
                subtitle={records.fastestRide.title}
              />
              <RecordCard
                icon={<Zap className="size-3.5 text-red-400" />}
                label="Najvišja hitrost"
                value={records.highestSpeed.value}
                subtitle={records.highestSpeed.title}
              />
              <RecordCard
                icon={<Flame className="size-3.5 text-amber-400" />}
                label="Najdaljša serija"
                value={`${records.streak} dni`}
                subtitle="Zaporedne vožnje"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Sub-components ──

function SummaryCard({
  icon,
  label,
  value,
  trend,
  trendIcon,
  colorClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  trend?: number
  trendIcon?: React.ReactNode
  colorClass: string
}) {
  return (
    <Card className="rounded-xl overflow-hidden group hover:border-primary/30 transition-colors duration-200">
      <CardContent className={`p-3 bg-gradient-to-br ${colorClass} relative`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center justify-center size-7 rounded-lg bg-background/50">
            {icon}
          </div>
          {trend !== undefined && trendIcon && (
            <div className="flex items-center gap-0.5">
              {trendIcon}
              <span className={`text-[10px] font-medium ${
                trend > 5 ? 'text-emerald-400' : trend < -5 ? 'text-red-400' : 'text-muted-foreground'
              }`}>
                {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
        <p className="text-lg font-bold tracking-tight animate-[pulse_3s_ease-in-out_infinite]">
          {value}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}

function RecordCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle: string
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5 space-y-1 hover:bg-muted/60 transition-colors duration-200">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[9px] text-muted-foreground/60 truncate">{subtitle}</p>
    </div>
  )
}
