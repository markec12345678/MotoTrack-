'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Trophy, Star, Flame, TrendingUp, X, Award, Zap } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { PointsData } from '@/components/tabs/types'

interface PointsPanelProps {
  userId?: string
  compact?: boolean
  onClose?: () => void
}

const LEVEL_ICONS: Record<string, string> = {
  'Začetnik': '🌱',
  'Motociklist': '🏍️',
  'Izkušen': '⚡',
  'Veteran': '🦅',
  'Legenda': '👑',
}

const LEVEL_COLORS: Record<string, string> = {
  'Začetnik': '#6b7280',
  'Motociklist': '#3b82f6',
  'Izkušen': '#f59e0b',
  'Veteran': '#8b5cf6',
  'Legenda': '#ef4444',
}

export default function PointsPanel({ userId, compact = false, onClose }: PointsPanelProps) {
  const [data, setData] = useState<PointsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)
  const [prevLevel, setPrevLevel] = useState<string | null>(null)
  const prevDataRef = useRef<PointsData | null>(null)

  const fetchPoints = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/points?userId=${userId}`)
      if (res.ok) {
        const j = await res.json()
        const newData = j.data
        // Check for level up using ref
        if (prevDataRef.current && newData && newData.level !== prevDataRef.current.level) {
          setPrevLevel(String(prevDataRef.current.level))
          setShowCelebration(true)
          setTimeout(() => setShowCelebration(false), 3000)
        }
        prevDataRef.current = newData
        setData(newData)
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
     
    fetchPoints()
     
  }, [fetchPoints])

  if (loading) {
    return compact ? (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10">
        <Trophy className="size-3.5 text-primary animate-pulse" />
        <span className="text-xs text-muted-foreground">...</span>
      </div>
    ) : (
      <Card className="w-80">
        <CardContent className="p-4 flex items-center justify-center h-48">
          <Trophy className="size-8 text-muted-foreground animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const levelIcon = LEVEL_ICONS[data.level] || '🌱'
  const levelColor = LEVEL_COLORS[data.level] || '#6b7280'

  // Compact mode for profile header
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${levelColor}15` }}>
        <span className="text-sm">{levelIcon}</span>
        <Trophy className="size-3" style={{ color: levelColor }} />
        <span className="text-xs font-bold" style={{ color: levelColor }}>{data.points}</span>
        <span className="text-[9px] text-muted-foreground">{data.level}</span>
      </div>
    )
  }

  return (
    <Card className="w-80 overflow-hidden border-primary/15">
      <div className="h-0.5 bg-gradient-to-r from-amber-500/80 via-yellow-400/60 to-orange-500/40" />
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-amber-500/15">
              <Trophy className="size-4 text-amber-500" />
            </div>
            <CardTitle className="text-sm">Točke in dosežki</CardTitle>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {/* Points and Level */}
        <div className="text-center py-2">
          <div className="text-3xl mb-1">{levelIcon}</div>
          <p className="text-2xl font-bold" style={{ color: levelColor }}>{data.points}</p>
          <p className="text-xs text-muted-foreground">točk</p>
          <Badge
            variant="outline"
            className="mt-1.5 text-[10px] px-2.5 py-0.5"
            style={{ borderColor: `${levelColor}60`, color: levelColor }}
          >
            <Award className="size-3 mr-1" /> {data.level}
          </Badge>
        </div>

        {/* Level progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Napredek do naslednje ravni</span>
            <span className="font-medium" style={{ color: levelColor }}>{Math.round(data.levelProgress)}%</span>
          </div>
          <Progress value={data.levelProgress} className="h-2.5" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{data.currentLevelMin} točk</span>
            <span>{data.nextLevelPoints} točk</span>
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <Flame className="size-5 text-orange-500" />
          <div>
            <p className="text-xs font-medium">{data.streak.current} dni zapored</p>
            <p className="text-[9px] text-muted-foreground">Najboljši: {data.streak.best} dni</p>
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* Points history */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Zadnje točke</p>
          <ScrollArea className="max-h-28">
            <div className="space-y-1">
              {data.history.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-2">Ni zgodovine točk</p>
              )}
              {data.history.slice(0, 10).map((entry, i) => (
                <div key={entry.id || i} className="flex items-center gap-2 text-[10px] py-0.5">
                  <Zap className="size-3 text-amber-500 shrink-0" />
                  <span className="flex-1 truncate text-muted-foreground">{entry.reason}</span>
                  <span className="font-medium text-amber-500">+{entry.amount}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator className="opacity-30" />

        {/* Leaderboard */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Lestvica</p>
          <div className="space-y-1.5">
            {data.leaderboard.slice(0, 5).map((user, i) => {
              const isCurrentUser = user.id === userId
              const icon = LEVEL_ICONS[user.level] || '🌱'
              const color = LEVEL_COLORS[user.level] || '#6b7280'
              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] ${
                    isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                  }`}
                >
                  <span className={`font-bold w-4 text-center ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    {i + 1}
                  </span>
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[8px]" style={{ backgroundColor: `${color}20`, color }}>
                      {icon}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`flex-1 truncate ${isCurrentUser ? 'font-bold' : ''}`}>
                    {user.name}
                  </span>
                  <span className="font-medium" style={{ color }}>{user.points}</span>
                  <Trophy className="size-2.5" style={{ color }} />
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>

      {/* Level-up celebration overlay */}
      {showCelebration && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg">
          <div className="text-center space-y-3 animate-bounce">
            <div className="text-5xl">{LEVEL_ICONS[data.level] || '🎉'}</div>
            <div>
              <p className="text-lg font-bold" style={{ color: LEVEL_COLORS[data.level] || '#f59e0b' }}>
    ČESTITAMO!
              </p>
              <p className="text-sm text-muted-foreground">
                {prevLevel && `${prevLevel} → `}{data.level}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCelebration(false)}>
              <Trophy className="size-3.5 mr-1" /> Super!
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
