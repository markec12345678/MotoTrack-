'use client'

import React, { useState, useEffect } from 'react'
import { Lock, CheckCircle, Trophy } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AchievementData } from '@/components/tabs/types'

interface AchievementsPanelProps {
  userId: string
}

export default function AchievementsPanel({ userId }: AchievementsPanelProps) {
  const [achievements, setAchievements] = useState<AchievementData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetch('/api/achievements?userId=' + userId)
      .then(r => r.json())
      .then(j => { if (!cancelled) { setAchievements(j.data || []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  const earnedCount = achievements.filter(a => a.earned).length
  const totalCount = achievements.length

  return (
    <Card className="overflow-hidden border-primary/15">
      <div className="h-0.5 bg-gradient-to-r from-primary/80 via-accent/60 to-primary/40" />
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/15">
              <Trophy className="size-4 text-primary" />
            </div>
            <CardTitle className="text-sm">Dosežki</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {earnedCount}/{totalCount} dosežkov
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-secondary/30 animate-pulse">
                <div className="size-10 rounded-full bg-muted" />
                <div className="h-2.5 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="grid grid-cols-3 gap-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement.type}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                    achievement.earned
                      ? 'bg-primary/10 border border-primary/20'
                      : 'bg-secondary/30 border border-border/30 opacity-50'
                  }`}
                  title={`${achievement.title}: ${achievement.description}`}
                >
                  {/* Checkmark overlay for earned */}
                  {achievement.earned && (
                    <div className="absolute top-1.5 right-1.5">
                      <CheckCircle className="size-3.5 text-primary" />
                    </div>
                  )}
                  {/* Lock overlay for locked */}
                  {!achievement.earned && (
                    <div className="absolute top-1.5 right-1.5">
                      <Lock className="size-3 text-muted-foreground" />
                    </div>
                  )}
                  <div className={`size-10 rounded-full flex items-center justify-center text-lg ${
                    achievement.earned
                      ? 'bg-primary/20'
                      : 'bg-muted'
                  }`}>
                    {achievement.earned ? achievement.icon : <Lock className="size-4 text-muted-foreground" />}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${
                    achievement.earned ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {achievement.title}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {earnedCount === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-3">
            Še nimate dosežkov. Začnite z vožnjo! 🏍️
          </p>
        )}
      </CardContent>
    </Card>
  )
}
