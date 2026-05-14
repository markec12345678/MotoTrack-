'use client'

import React, { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { Mountain } from 'lucide-react'

interface ElevationProfileProps {
  trackData: string | number[][]
  className?: string
}

export default function ElevationProfile({ trackData, className = '' }: ElevationProfileProps) {
  const chartData = useMemo(() => {
    try {
      const points = typeof trackData === 'string' ? JSON.parse(trackData) : trackData
      if (!Array.isArray(points) || points.length < 2) return []

      // Sample points if too many (max 100 for performance)
      const maxPoints = 100
      const step = Math.max(1, Math.floor(points.length / maxPoints))
      const sampled = points.filter((_: unknown, i: number) => i % step === 0)

      let cumDist = 0
      return sampled.map((p: number[], i: number) => {
        if (i > 0) {
          const prev = sampled[i - 1]
          const R = 6371
          const dLat = ((p[0] - prev[0]) * Math.PI) / 180
          const dLon = ((p[1] - prev[1]) * Math.PI) / 180
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((prev[0] * Math.PI) / 180) * Math.cos((p[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
          cumDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        }
        return {
          distance: Math.round(cumDist * 10) / 10,
          elevation: Math.round(p[2] || 0),
        }
      })
    } catch {
      return []
    }
  }, [trackData])

  if (chartData.length < 2) return null

  const minElev = Math.min(...chartData.map(d => d.elevation))
  const maxElev = Math.max(...chartData.map(d => d.elevation))
  const totalDist = chartData[chartData.length - 1]?.distance || 0
  const gain = chartData.reduce((acc, d, i) => {
    if (i === 0) return 0
    const diff = d.elevation - chartData[i - 1].elevation
    return acc + (diff > 0 ? diff : 0)
  }, 0)

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Mountain className="size-3.5" /> Višinski profil
        </h4>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{totalDist.toFixed(1)} km</span>
          <span className="text-emerald-400">+{Math.round(gain)}m</span>
        </div>
      </div>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.7 0.18 55)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.7 0.18 55)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="distance"
              tick={{ fontSize: 9, fill: 'oklch(0.65 0.02 40)' }}
              tickFormatter={(v: number) => `${v}km`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'oklch(0.65 0.02 40)' }}
              tickFormatter={(v: number) => `${v}m`}
              domain={[Math.floor(minElev / 100) * 100, Math.ceil(maxElev / 100) * 100]}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.18 0.015 30)',
                border: '1px solid oklch(1 0 0 / 10%)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'oklch(0.96 0.01 60)',
              }}
              formatter={(value: unknown, name: unknown) => [`${value}m`, 'Nadm. viš.']}
              labelFormatter={(label: unknown) => `${label} km`}
            />
            <Area
              type="monotone"
              dataKey="elevation"
              stroke="oklch(0.7 0.18 55)"
              strokeWidth={2}
              fill="url(#elevGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
