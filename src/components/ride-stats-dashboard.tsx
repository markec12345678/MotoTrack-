'use client'

import React, { useMemo } from 'react'
import { BarChart3, TrendingUp, Mountain, Gauge, Route, Bike, Trophy, Flame } from 'lucide-react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { RideData } from '@/components/tabs/types'
import { categoryLabel, categoryColor } from '@/components/tabs/types'

const MONTHS_SL = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']

interface RideStatsDashboardProps {
  rides: RideData[]
  userId?: string
}

export default function RideStatsDashboard({ rides, userId }: RideStatsDashboardProps) {
  // Filter rides for this user
  const myRides = useMemo(() =>
    userId ? rides.filter(r => r.userId === userId) : rides,
    [rides, userId]
  )

  // Monthly stats (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: Array<{ key: string; label: string; distance: number; count: number; elevation: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({ key, label: `${MONTHS_SL[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, distance: 0, count: 0, elevation: 0 })
    }
    myRides.forEach(r => {
      const d = new Date(r.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const m = months.find(m => m.key === key)
      if (m) {
        m.distance += r.distance || 0
        m.count += 1
        m.elevation += r.elevation || 0
      }
    })
    return months
  }, [myRides])

  // Category breakdown
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    myRides.forEach(r => {
      const cat = 'scenic' // rides don't have category, default to scenic
      cats[cat] = (cats[cat] || 0) + 1
    })
    // Also count routes if passed
    if (Object.keys(cats).length === 0) {
      cats['scenic'] = myRides.length || 1
    }
    return Object.entries(cats).map(([name, value]) => ({ name: categoryLabel(name), value, color: getCategoryColor(name) }))
  }, [myRides])

  // Summary stats
  const stats = useMemo(() => {
    const totalDist = myRides.reduce((s, r) => s + (r.distance || 0), 0)
    const totalElev = myRides.reduce((s, r) => s + (r.elevation || 0), 0)
    const totalDuration = myRides.reduce((s, r) => s + (r.duration || 0), 0)
    const avgSpeed = myRides.length > 0 ? myRides.reduce((s, r) => s + (r.avgSpeed || 0), 0) / myRides.length : 0
    const maxSpeed = myRides.reduce((max, r) => Math.max(max, r.maxSpeed || 0), 0)
    const longestRide = myRides.reduce((max, r) => Math.max(max, r.distance || 0), 0)
    const avgRideLen = myRides.length > 0 ? totalDist / myRides.length : 0

    // Best month
    const bestMonth = monthlyData.reduce((best, m) => m.distance > best.distance ? m : best, monthlyData[0])

    // Streak: consecutive days with rides
    const rideDates = [...new Set(myRides.map(r => new Date(r.createdAt).toDateString()))].sort()
    let streak = 0
    let currentStreak = 0
    for (let i = 0; i < rideDates.length; i++) {
      if (i === 0) { currentStreak = 1 }
      else {
        const diff = (new Date(rideDates[i]).getTime() - new Date(rideDates[i - 1]).getTime()) / 86400000
        currentStreak = diff === 1 ? currentStreak + 1 : 1
      }
      streak = Math.max(streak, currentStreak)
    }

    return { totalDist, totalElev, totalDuration, avgSpeed, maxSpeed, longestRide, avgRideLen, bestMonth, streak, totalRides: myRides.length }
  }, [myRides, monthlyData])

  const [open, setOpen] = React.useState(false)

  if (myRides.length === 0) {
    return (
      <Card className="rounded-xl overflow-hidden border-l-4 border-l-violet-500/60">
        <CardContent className="p-4 text-center">
          <BarChart3 className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Še ni voženj za statistiko</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-xl overflow-hidden border-l-4 border-l-violet-500/60">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="p-4 pb-0 flex items-center gap-3">
              <div className="flex items-center justify-center size-8 rounded-lg bg-violet-500/15 shrink-0">
                <BarChart3 className="size-4 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">Statistika Voženj</CardTitle>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/10 text-violet-500">{stats.totalRides}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Grafikon, rekordi, trendi</p>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4 pt-3 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-violet-500/10 p-2 text-center">
                <p className="text-sm font-bold text-violet-500">{stats.totalDist.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">km skupaj</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                <p className="text-sm font-bold text-emerald-500">{stats.avgSpeed.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">km/h povp.</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                <p className="text-sm font-bold text-amber-500">{stats.totalElev.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">m višine</p>
              </div>
            </div>

            {/* Personal records */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="size-3.5 text-amber-500" />
                <span className="text-xs font-medium">Osebni rekordi</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <RecordRow icon={<Route className="size-3 text-primary" />} label="Najdaljša" value={`${stats.longestRide.toFixed(1)} km`} />
                <RecordRow icon={<Gauge className="size-3 text-red-400" />} label="Najhitrejša" value={`${stats.maxSpeed.toFixed(0)} km/h`} />
                <RecordRow icon={<Mountain className="size-3 text-emerald-400" />} label="Največji vzpon" value={`${stats.totalElev.toFixed(0)} m`} />
                <RecordRow icon={<Flame className="size-3 text-orange-400" />} label="Spleta voženj" value={`${stats.streak} dni`} />
                <RecordRow icon={<Bike className="size-3 text-sky-400" />} label="Povprečna dolžina" value={`${stats.avgRideLen.toFixed(1)} km`} />
                <RecordRow icon={<TrendingUp className="size-3 text-violet-400" />} label="Najboljši mesec" value={stats.bestMonth?.label || '-'} />
              </div>
            </div>

            {/* Monthly distance chart */}
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground font-medium">Kilometrina po mesecih</span>
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      formatter={((v: number) => [`${v.toFixed(0)} km`, 'Razdalja']) as any}
                    />
                    <Bar dataKey="distance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly elevation chart */}
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground font-medium">Višinski metri po mesecih</span>
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      formatter={((v: number) => [`${v.toFixed(0)} m`, 'Višina']) as any}
                    />
                    <Bar dataKey="elevation" fill="#22c55e" radius={[4, 4, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ride frequency chart */}
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground font-medium">Število voženj po mesecih</span>
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      formatter={((v: number) => [`${v}`, 'Voženj']) as any}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category pie chart */}
            {categoryData.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] text-muted-foreground font-medium">Kategorije voženj</span>
                <div className="flex items-center gap-4">
                  <div className="h-[100px] w-[100px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={25} outerRadius={45} dataKey="value" stroke="none">
                          {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1">
                    {categoryData.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px]">
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="text-muted-foreground">{c.name}</span>
                        <span className="ml-auto font-medium">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function RecordRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1.5">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-muted-foreground truncate">{label}</p>
        <p className="text-[11px] font-bold truncate">{value}</p>
      </div>
    </div>
  )
}

function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    scenic: '#10b981', twisty: '#f59e0b', offroad: '#f97316', city: '#0ea5e9',
    snowmobile: '#06b6d4', racetrack: '#ef4444', enduro: '#84cc16', adventure: '#14b8a6',
  }
  return map[cat] || '#8b5cf6'
}
