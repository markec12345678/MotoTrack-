'use client'

import React, { useState, useEffect } from 'react'
import { Trophy, Gauge, Mountain, GitBranch, Flame, Award } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export default function ChallengesPanel({ userId }: { userId?: string }) {
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = userId ? `/api/challenges?userId=${userId}` : '/api/challenges'
    fetch(url).then(r => r.json()).then(j => { setChallenges(j.data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [userId])

  const typeIcon = (type: string) => {
    switch (type) {
      case 'distance': return <Gauge className="size-4" />
      case 'elevation': return <Mountain className="size-4" />
      case 'corners': return <GitBranch className="size-4" />
      case 'streak': return <Flame className="size-4" />
      default: return <Trophy className="size-4" />
    }
  }

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { distance: 'Razdalja', elevation: 'Višina', corners: 'Ovinki', streak: 'Niz' }
    return map[type] || type
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Trophy className="size-5 text-primary" /><h3 className="font-bold">Izzivi</h3></div>
      {loading ? <p className="text-xs text-muted-foreground">Nalagam...</p> : (
        <div className="space-y-2">
          {challenges.map(ch => (
            <Card key={ch.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-primary/15 text-primary">{typeIcon(ch.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ch.title}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel(ch.type)} · {ch.target} {ch.unit}</p>
                    {ch.percentComplete !== undefined && (
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span>{ch.progress} / {ch.target} {ch.unit}</span>
                          <span>{ch.percentComplete}%</span>
                        </div>
                        <Progress value={ch.percentComplete} className="h-1.5" />
                      </div>
                    )}
                  </div>
                  {ch.completed && <Award className="size-5 text-amber-500" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
