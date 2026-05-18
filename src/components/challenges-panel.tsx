'use client'
 

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Trophy, Users, Clock, Plus, Flame, Mountain, Route, Zap, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { ChallengeData } from '@/components/tabs/types'

export default function ChallengesPanel({ userId }: { userId?: string }) {
  const [challenges, setChallenges] = useState<ChallengeData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges${userId ? `?userId=${userId}` : ''}`)
      if (res.ok) { const j = await res.json(); setChallenges(j.data || []) }
    } catch { /* ignore */ }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchChallenges() }, [fetchChallenges])

  const joinChallenge = async (id: string) => {
    if (!userId) return
    try {
      const res = await fetch(`/api/challenges/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
      if (res.ok) { toast.success('Pridružili ste se izzivu!'); fetchChallenges() }
      else toast.error('Napaka pri pridružitvi')
    } catch { toast.error('Napaka') }
  }

  const typeIcon: Record<string, React.ReactNode> = {
    distance: <Route className="size-4" />,
    elevation: <Mountain className="size-4" />,
    rides: <Flame className="size-4" />,
    speed: <Zap className="size-4" />,
    streak: <Calendar className="size-4" />,
  }

  const categoryLabel: Record<string, string> = { weekly: 'Tedenski', monthly: 'Mesečni', seasonal: 'Sezonski', yearly: 'Letni', special: 'Poseben' }

  if (loading) return <div className="p-4 text-center text-muted-foreground text-sm">Nalaganje izzivov...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Trophy className="size-4 text-amber-500" /> Izzivi &amp; Tekmovanja</h3>
        <Badge variant="secondary" className="text-xs">{challenges.length} aktivnih</Badge>
      </div>

      <div className="grid gap-3">
        {challenges.map(ch => {
          const progressPct = ch.goal > 0 ? Math.min(100, Math.round((ch.userProgress / ch.goal) * 100)) : 0
          return (
            <Card key={ch.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{ch.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{ch.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{categoryLabel[ch.category] || ch.category}</Badge>
                    </div>
                    {ch.description && <p className="text-xs text-muted-foreground mb-2">{ch.description}</p>}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>{typeIcon[ch.type]} {ch.userProgress} / {ch.goal} {ch.unit}</span>
                        <span className={ch.userCompleted ? 'text-emerald-500 font-semibold' : 'text-muted-foreground'}>{progressPct}%</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="size-3" /> {ch.participantCount}</span>
                          <span className="flex items-center gap-1"><Clock className="size-3" /> {ch.daysRemaining}d</span>
                          <span className="flex items-center gap-1 text-amber-500">+{ch.points}pt</span>
                        </div>
                        {ch.userCompleted ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">✅ Končano</Badge>
                        ) : ch.userProgress > 0 ? (
                          <Badge variant="secondary" className="text-xs">V teku</Badge>
                        ) : (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => joinChallenge(ch.id)}>
                            <Plus className="size-3 mr-1" /> Pridruži se
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {challenges.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Trenutno ni aktivnih izzivov</CardContent></Card>
      )}
    </div>
  )
}
