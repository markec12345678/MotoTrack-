'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Crown,
  Diamond,
  Check,
  Lock,
  X,
  Zap,
  Map as MapIcon,
  Cloud,
  FileText,
  Video,
  Radio,
  BarChart3,
  Headphones,
  Code,
  Loader2,
  Gift,
} from 'lucide-react'
import { toast } from 'sonner'

interface SubscriptionData {
  id: string
  userId: string
  plan: 'free' | 'pro' | 'elite'
  status: 'active' | 'cancelled' | 'expired'
  expiresAt: string | null
  createdAt: string
  trialEndsAt?: string | null
  cancelAtPeriodEnd?: boolean
}

interface SubscriptionPanelProps {
  userId?: string
}

const plans = [
  {
    id: 'free' as const,
    name: 'Brezplačno',
    price: '€0',
    period: '/mes',
    icon: <span className="text-lg">🏍️</span>,
    color: 'zinc',
    features: [
      { label: '3 rute/mesec', included: true },
      { label: 'Osnovno sledenje GPS', included: true },
      { label: 'Skupnost in komentarji', included: true },
      { label: 'Oglasi', included: true },
      { label: '3D Zemljevid', included: false },
      { label: 'Vremenska opozorila', included: false },
      { label: 'PDF Izvoz', included: false },
      { label: 'Video Sync', included: false },
      { label: 'Sledenje v živo', included: false },
      { label: 'ROI Analitika', included: false },
    ],
  },
  {
    id: 'pro' as const,
    name: 'PRO',
    price: '€4.99',
    period: '/mes',
    icon: <Crown className="size-5 text-amber-400" />,
    color: 'amber',
    features: [
      { label: 'Neomejene rute', included: true },
      { label: 'Napredno sledenje GPS', included: true },
      { label: 'Skupnost brez oglasov', included: true },
      { label: '3D Zemljevid', included: true },
      { label: 'Vremenska opozorila', included: true },
      { label: 'PDF Izvoz', included: true },
      { label: 'Video Sync', included: true },
      { label: 'Sledenje v živo', included: false },
      { label: 'ROI Analitika', included: false },
      { label: 'Podpora s prioriteto', included: false },
    ],
  },
  {
    id: 'elite' as const,
    name: 'Elite',
    price: '€9.99',
    period: '/mes',
    icon: <Diamond className="size-5 text-purple-400" />,
    color: 'purple',
    features: [
      { label: 'Vse iz PRO', included: true },
      { label: 'Sledenje v živo', included: true },
      { label: 'ROI Analitika', included: true },
      { label: 'Podpora s prioriteto', included: true },
      { label: 'API dostop', included: true },
      { label: 'Zgodnji dostop', included: true },
      { label: 'Prilagojene rute AI', included: true },
    ],
  },
]

const proFeatureIcons: Record<string, React.ElementType> = {
  '3d_map': MapIcon,
  weather_alerts: Cloud,
  pdf_export: FileText,
  video_sync: Video,
  live_tracking: Radio,
  roi_analytics: BarChart3,
  priority_support: Headphones,
  api_access: Code,
}

export default function SubscriptionPanel({ userId }: SubscriptionPanelProps) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/subscription?userId=${userId}`)
      .then(r => r.json())
      .then(j => setSubscription(j.data || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const handleUpgrade = async (plan: 'pro' | 'elite') => {
    if (!userId) return
    setUpgrading(plan)
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan }),
      })
      if (res.ok) {
        const json = await res.json()
        setSubscription(json.data)
        toast.success(`Nadgradnja na ${plan.toUpperCase()} uspešna! 14-dnevni preizkus začet.`)
      } else {
        toast.error('Napaka pri nadgradnji')
      }
    } catch {
      toast.error('Napaka pri nadgradnji')
    } finally {
      setUpgrading(null)
    }
  }

  const handleCancel = async () => {
    if (!userId) return
    try {
      const res = await fetch('/api/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'cancel' }),
      })
      if (res.ok) {
        const json = await res.json()
        setSubscription(json.data)
        toast.success('Naročnina bo preklicana ob koncu obdobja')
      }
    } catch {
      toast.error('Napaka pri preklicu')
    }
  }

  const handleReactivate = async () => {
    if (!userId) return
    try {
      const res = await fetch('/api/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reactivate' }),
      })
      if (res.ok) {
        const json = await res.json()
        setSubscription(json.data)
        toast.success('Naročnina reaktivirana!')
      }
    } catch {
      toast.error('Napaka pri reaktivaciji')
    }
  }

  const currentPlan = subscription?.plan || 'free'
  const isTrial = (subscription?.status as string) === 'trial'
  const trialEndsAt = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false

  return (
    <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {currentPlan === 'elite' ? (
              <Diamond className="size-5 text-purple-400" />
            ) : currentPlan === 'pro' ? (
              <Crown className="size-5 text-amber-400" />
            ) : (
              <span className="text-lg">🏍️</span>
            )}
            MotoTrack {currentPlan !== 'free' ? currentPlan.toUpperCase() : ''}
          </CardTitle>
          <Badge
            variant="outline"
            className={
              currentPlan === 'elite'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : currentPlan === 'pro'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
            }
          >
            {currentPlan === 'free' ? 'Brezplačno' : currentPlan.toUpperCase()}
          </Badge>
        </div>

        {/* Trial banner */}
        {isTrial && trialEndsAt && (
          <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <Gift className="size-4 text-amber-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="text-amber-300 font-medium">
                {daysLeft > 0 ? `${daysLeft} dni` : 'Zadnji dan'} preizkusa
              </span>
              <span className="text-zinc-400 ml-1">
                {cancelAtPeriodEnd ? '· Naročnina bo preklicana' : '· Samodejno podaljšanje'}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Plan cards */}
        <div className="space-y-2.5">
          {plans.map(plan => {
            const isCurrent = plan.id === currentPlan
            const isLocked = plan.id !== 'free' && currentPlan === 'free'

            return (
              <div
                key={plan.id}
                className={`p-3 rounded-lg border transition-all ${
                  isCurrent
                    ? plan.color === 'purple'
                      ? 'bg-purple-500/10 border-purple-500/30'
                      : plan.color === 'amber'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-zinc-800/40 border-zinc-700/50'
                    : 'bg-zinc-800/30 border-zinc-700/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {plan.icon}
                    <div>
                      <div className="text-sm font-medium">{plan.name}</div>
                      <div className="text-xs text-zinc-400">
                        {plan.price}<span className="text-zinc-600">{plan.period}</span>
                      </div>
                    </div>
                  </div>
                  {isCurrent ? (
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                      <Check className="size-2.5 mr-0.5" />
                      Trenutni
                    </Badge>
                  ) : plan.id !== 'free' && currentPlan === 'free' ? (
                    <Button
                      size="sm"
                      className={
                        plan.color === 'purple'
                          ? 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 border border-purple-500/30 h-7 text-xs'
                          : 'bg-amber-600/30 text-amber-300 hover:bg-amber-600/50 border border-amber-500/30 h-7 text-xs'
                      }
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgrading !== null}
                    >
                      {upgrading === plan.id ? (
                        <Loader2 className="size-3 animate-spin mr-1" />
                      ) : (
                        <Zap className="size-3 mr-1" />
                      )}
                      Nadgradi
                    </Button>
                  ) : plan.id === 'elite' && currentPlan === 'pro' ? (
                    <Button
                      size="sm"
                      className="bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 border border-purple-500/30 h-7 text-xs"
                      onClick={() => handleUpgrade('elite')}
                      disabled={upgrading !== null}
                    >
                      <Diamond className="size-3 mr-1" />
                      Nadgradi
                    </Button>
                  ) : null}
                </div>

                {/* Feature list */}
                <div className="space-y-1">
                  {plan.features.slice(0, isCurrent ? undefined : 5).map((feat, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      {feat.included ? (
                        <Check className="size-2.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Lock className="size-2.5 text-zinc-600 flex-shrink-0" />
                      )}
                      <span className={feat.included ? 'text-zinc-300' : 'text-zinc-600'}>
                        {feat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Action buttons for current subscribers */}
        {currentPlan !== 'free' && subscription && (
          <div className="pt-2 border-t border-zinc-700/50 space-y-2">
            {cancelAtPeriodEnd ? (
              <Button
                onClick={handleReactivate}
                variant="ghost"
                size="sm"
                className="w-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              >
                Reaktiviraj naročnino
              </Button>
            ) : (
              <Button
                onClick={handleCancel}
                variant="ghost"
                size="sm"
                className="w-full text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
              >
                Prekliči naročnino
              </Button>
            )}
          </div>
        )}

        {/* Trial CTA for free users */}
        {currentPlan === 'free' && (
          <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-amber-500/20 text-center">
            <div className="text-xs text-zinc-300 mb-1.5">
              <Gift className="size-3.5 inline mr-1 text-amber-400" />
              Preizkusi brezplačno 14 dni
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleUpgrade('pro')}
                disabled={upgrading !== null}
                size="sm"
                className="flex-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs h-8"
              >
                {upgrading === 'pro' ? <Loader2 className="size-3 animate-spin mr-1" /> : <Crown className="size-3 mr-1" />}
                PRO €4.99
              </Button>
              <Button
                onClick={() => handleUpgrade('elite')}
                disabled={upgrading !== null}
                size="sm"
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs h-8"
              >
                {upgrading === 'elite' ? <Loader2 className="size-3 animate-spin mr-1" /> : <Diamond className="size-3 mr-1" />}
                Elite €9.99
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
