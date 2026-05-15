'use client'

import React, { useMemo, useState } from 'react'
import { Mountain, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GradientProfile, GradientSegment } from '@/components/tabs/types'
import { haversine } from '@/components/tabs/types'

interface GradientAnalysisProps {
  points: Array<{ lat: number; lng: number; alt: number | null }>
}

function calculateGradientProfile(points: Array<{ lat: number; lng: number; alt: number | null }>): GradientProfile | null {
  // Filter points that have elevation data
  const validPoints = points.filter(p => p.alt !== null && p.alt !== undefined)
  if (validPoints.length < 2) return null

  const segments: GradientSegment[] = []
  let totalAscent = 0
  let totalDescent = 0
  let maxGradient = 0
  let minGradient = 0
  let totalGradientSum = 0
  let totalDistance = 0

  // Variables to track current segment
  let segStart = 0
  let segDistance = 0

  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1]
    const curr = validPoints[i]
    const dist = haversine(prev.lat, prev.lng, curr.lat, curr.lng) * 1000 // meters
    const elevDiff = (curr.alt || 0) - (prev.alt || 0)

    segDistance += dist

    // Create segment every ~100m or at end
    if (segDistance >= 100 || i === validPoints.length - 1) {
      const gradient = segDistance > 0 ? (elevDiff / segDistance) * 100 : 0

      const segment: GradientSegment = {
        distance: Math.round(segDistance),
        elevationGain: Math.max(0, elevDiff),
        elevationLoss: Math.min(0, elevDiff),
        gradient: Math.round(gradient * 10) / 10,
        startIndex: segStart,
        endIndex: i,
      }

      segments.push(segment)

      if (elevDiff > 0) totalAscent += elevDiff
      else totalDescent += Math.abs(elevDiff)

      if (gradient > maxGradient) maxGradient = gradient
      if (gradient < minGradient) minGradient = gradient
      totalGradientSum += gradient
      totalDistance += segDistance

      segStart = i
      segDistance = 0
    }
  }

  if (segments.length === 0) return null

  const avgGradient = totalGradientSum / segments.length

  // Calculate percentages by gradient category
  let steepUphillDist = 0, moderateUphillDist = 0, flatDist = 0, moderateDownhillDist = 0, steepDownhillDist = 0

  segments.forEach(seg => {
    if (seg.gradient > 8) steepUphillDist += seg.distance
    else if (seg.gradient > 3) moderateUphillDist += seg.distance
    else if (seg.gradient >= -3) flatDist += seg.distance
    else if (seg.gradient >= -8) moderateDownhillDist += seg.distance
    else steepDownhillDist += seg.distance
  })

  return {
    segments,
    totalAscent: Math.round(totalAscent),
    totalDescent: Math.round(totalDescent),
    maxGradient: Math.round(maxGradient * 10) / 10,
    minGradient: Math.round(minGradient * 10) / 10,
    avgGradient: Math.round(avgGradient * 10) / 10,
    steepUphillPct: totalDistance > 0 ? Math.round((steepUphillDist / totalDistance) * 100) : 0,
    moderateUphillPct: totalDistance > 0 ? Math.round((moderateUphillDist / totalDistance) * 100) : 0,
    flatPct: totalDistance > 0 ? Math.round((flatDist / totalDistance) * 100) : 100,
    moderateDownhillPct: totalDistance > 0 ? Math.round((moderateDownhillDist / totalDistance) * 100) : 0,
    steepDownhillPct: totalDistance > 0 ? Math.round((steepDownhillDist / totalDistance) * 100) : 0,
  }
}

function gradientColor(g: number): string {
  if (g > 8) return '#ef4444'    // steep uphill - red
  if (g > 3) return '#f97316'    // moderate uphill - orange
  if (g >= -3) return '#22c55e'   // flat - green
  if (g >= -8) return '#3b82f6'   // moderate downhill - blue
  return '#8b5cf6'                 // steep downhill - purple
}

function gradientLabel(g: number): string {
  if (g > 8) return 'Strmo navzgor'
  if (g > 3) return 'Zmerno navzgor'
  if (g >= -3) return 'Ravno'
  if (g >= -8) return 'Zmerno navzdol'
  return 'Strmo navzdol'
}

function gradientIcon(g: number) {
  if (g > 3) return <TrendingUp className="size-3" />
  if (g < -3) return <TrendingDown className="size-3" />
  return <Minus className="size-3" />
}

export default function GradientAnalysis({ points }: GradientAnalysisProps) {
  const [showDetailed, setShowDetailed] = useState(false)

  const profile = useMemo(() => calculateGradientProfile(points), [points])

  if (!profile) {
    return (
      <div className="rounded-lg border border-border/50 p-3">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Mountain className="size-3.5 text-primary" /> Gradientni profil
        </h4>
        <p className="text-[10px] text-muted-foreground mt-1">Podatki o nadmorski višini niso na voljo</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Mountain className="size-3.5 text-primary" /> Gradientni profil
        </h4>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => setShowDetailed(!showDetailed)}>
          <BarChart3 className="size-3" />
          {showDetailed ? 'Skrij' : 'Podrobno'}
        </Button>
      </div>

      {/* Gradient Ribbon */}
      <div className="space-y-1">
        <div className="h-6 rounded-md overflow-hidden flex">
          {profile.segments.map((seg, i) => (
            <div
              key={i}
              className="flex items-center justify-center transition-all"
              style={{
                backgroundColor: gradientColor(seg.gradient),
                flex: seg.distance > 0 ? seg.distance : 0.5,
                minWidth: 6,
              }}
              title={`${gradientLabel(seg.gradient)}: ${seg.gradient > 0 ? '+' : ''}${seg.gradient}%`}
            >
              {seg.distance > (profile.segments.reduce((a, b) => a + b.distance, 0) / profile.segments.length) * 0.8 && (
                <span className="text-[8px] font-bold text-white/90">{seg.gradient > 0 ? '+' : ''}{seg.gradient}%</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#ef4444]" /> Strmo ↑</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#f97316]" /> Zmerno ↑</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#22c55e]" /> Ravno</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#3b82f6]" /> Zmerno ↓</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-[#8b5cf6]" /> Strmo ↓</span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-secondary/50 rounded-md p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Vzpon</p>
          <p className="text-sm font-bold text-emerald-500">+{profile.totalAscent}m</p>
        </div>
        <div className="bg-secondary/50 rounded-md p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Spust</p>
          <p className="text-sm font-bold text-blue-500">-{profile.totalDescent}m</p>
        </div>
        <div className="bg-secondary/50 rounded-md p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Max gradient</p>
          <p className="text-sm font-bold text-red-500">+{profile.maxGradient}%</p>
        </div>
        <div className="bg-secondary/50 rounded-md p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Min gradient</p>
          <p className="text-sm font-bold text-purple-500">{profile.minGradient}%</p>
        </div>
      </div>

      {/* Percentage bars */}
      <div className="space-y-1.5">
        {[
          { label: 'Strmo navzgor', pct: profile.steepUphillPct, color: '#ef4444', icon: <TrendingUp className="size-3" /> },
          { label: 'Zmerno navzgor', pct: profile.moderateUphillPct, color: '#f97316', icon: <TrendingUp className="size-3 opacity-50" /> },
          { label: 'Ravno', pct: profile.flatPct, color: '#22c55e', icon: <Minus className="size-3" /> },
          { label: 'Zmerno navzdol', pct: profile.moderateDownhillPct, color: '#3b82f6', icon: <TrendingDown className="size-3 opacity-50" /> },
          { label: 'Strmo navzdol', pct: profile.steepDownhillPct, color: '#8b5cf6', icon: <TrendingDown className="size-3" /> },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-[10px] w-24 text-muted-foreground flex items-center gap-1">{item.icon}{item.label}</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
            </div>
            <span className="text-[10px] font-medium w-8 text-right">{item.pct}%</span>
          </div>
        ))}
      </div>

      {/* Detailed segment breakdown */}
      {showDetailed && profile.segments.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
          {profile.segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-secondary/50 rounded px-2 py-1.5">
              <div className="size-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: gradientColor(seg.gradient) }} />
              {gradientIcon(seg.gradient)}
              <span className="font-medium">Seg. {i + 1}</span>
              <span className={seg.gradient > 0 ? 'text-red-400' : seg.gradient < 0 ? 'text-blue-400' : 'text-muted-foreground'}>
                {seg.gradient > 0 ? '+' : ''}{seg.gradient}%
              </span>
              <span className="text-muted-foreground ml-auto">{(seg.distance / 1000).toFixed(1)} km</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: gradientColor(seg.gradient) + '20', color: gradientColor(seg.gradient) }}>
                {gradientLabel(seg.gradient)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
