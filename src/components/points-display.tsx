'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Star, Flame, Trophy, Zap, Route, Users, TrendingUp, Award } from 'lucide-react'
import type { UserPointsData } from '@/components/tabs/types'

const LEVEL_NAMES = ['Novinec', 'Voznik', 'Izkušen', 'Strokovnjak', 'Mojster', 'Legenda', 'Prvak', 'Šampion']
const LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 5000, 8000, 12000, 18000]

export default function PointsDisplay({ userId }: { userId?: string }) {
  const [points, setPoints] = useState<UserPointsData | null>(null)

  const fetchPoints = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/points?userId=${userId}`)
      if (res.ok) { const j = await res.json(); setPoints(j.data) }
    } catch { /* ignore */ }
  }, [userId])

  useEffect(() => { fetchPoints() }, [fetchPoints])

  if (!points) return null

  const currentLevelIdx = LEVEL_THRESHOLDS.findIndex((t, i) => i === LEVEL_THRESHOLDS.length - 1 || points.totalPoints < LEVEL_THRESHOLDS[i + 1])
  const currentLevel = Math.max(0, currentLevelIdx)
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel + 1] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel] || 0
  const levelProgress = nextThreshold > currentThreshold ? Math.round(((points.totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100) : 100
  const levelName = LEVEL_NAMES[Math.min(currentLevel, LEVEL_NAMES.length - 1)]

  const reasonLabel: Record<string, string> = {
    ride_completed: '🏍️ Vožnja končana',
    challenge_won: '🏆 Izziv končan',
    social_share: '📡 Deljeno',
    route_created: '🗺️ Pot ustvarjena',
    comment_added: '💬 Komentar',
    like_received: '❤️ Všečk',
    achievement_earned: '🏅 Dosežek',
  }

  return (
    <div className="space-y-3">
      {/* Level Card */}
      <Card className="bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center border-2 border-amber-500/40">
              <span className="text-xl font-bold text-amber-500">{currentLevel + 1}</span>
            </div>
            <div>
              <div className="font-bold text-sm">{levelName}</div>
              <div className="text-xs text-muted-foreground">{points.totalPoints} točk skupaj</div>
            </div>
            <div className="ml-auto">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Flame className="size-3 mr-1" /> {points.streakDays} dni
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Raven {currentLevel + 1}</span>
              <span>{levelProgress}% do ravni {currentLevel + 2}</span>
            </div>
            <Progress value={levelProgress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Points Breakdown */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <Route className="size-4 mx-auto text-emerald-500 mb-1" />
          <div className="text-sm font-semibold">{points.ridesPoints}</div>
          <div className="text-[10px] text-muted-foreground">Vožnje</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <Trophy className="size-4 mx-auto text-amber-500 mb-1" />
          <div className="text-sm font-semibold">{points.challengePoints}</div>
          <div className="text-[10px] text-muted-foreground">Izzivi</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <Zap className="size-4 mx-auto text-purple-500 mb-1" />
          <div className="text-sm font-semibold">{points.socialPoints}</div>
          <div className="text-[10px] text-muted-foreground">Socialno</div>
        </div>
      </div>

      {/* Recent Activity */}
      {points.recentTransactions.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground">Zadnje aktivnosti</h4>
          {points.recentTransactions.slice(0, 5).map(tx => (
            <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
              <span>{reasonLabel[tx.reason] || tx.reason}</span>
              <span className={tx.amount > 0 ? 'text-emerald-500 font-semibold' : 'text-red-500'}>
                {tx.amount > 0 ? '+' : ''}{tx.amount} pt
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
