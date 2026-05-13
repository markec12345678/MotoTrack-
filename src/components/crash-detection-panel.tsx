'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { CrashEvent } from '@/components/tabs/types'
import {
  ShieldAlert,
  Bell,
  Phone,
  Activity,
  TestTube,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react'

interface CrashDetectionPanelProps {
  userId?: string
  emergencyContacts?: Array<{ name: string; phone: string }>
}

const MOCK_CRASH_HISTORY: CrashEvent[] = [
  {
    id: 'crash-1',
    userId: 'user-1',
    lat: 46.0569,
    lng: 14.5058,
    gForce: 3.2,
    speedBefore: 45,
    detectedAt: '2024-03-15T14:30:00Z',
    alertSent: true,
    status: 'false_alarm',
    notes: 'Zdrsnil na mokri cesti',
  },
  {
    id: 'crash-2',
    userId: 'user-1',
    lat: 46.2397,
    lng: 14.3556,
    gForce: 5.8,
    speedBefore: 60,
    detectedAt: '2024-04-02T09:15:00Z',
    alertSent: true,
    status: 'confirmed',
    notes: null,
  },
]

type Sensitivity = 'low' | 'medium' | 'high'

export default function CrashDetectionPanel({ userId, emergencyContacts }: CrashDetectionPanelProps) {
  const [enabled, setEnabled] = useState(true)
  const [sensitivity, setSensitivity] = useState<Sensitivity>('medium')
  const [isTesting, setIsTesting] = useState(false)
  const [crashHistory] = useState<CrashEvent[]>(MOCK_CRASH_HISTORY)

  const handleTest = async () => {
    setIsTesting(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsTesting(false)
  }

  const statusConfig: Record<CrashEvent['status'], { label: string; icon: React.ReactNode; color: string }> = {
    detected: {
      label: 'Zaznano',
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-amber-500',
    },
    confirmed: {
      label: 'Potrjeno',
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-rose-500',
    },
    false_alarm: {
      label: 'Lažni alarm',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-emerald-500',
    },
  }

  const sensitivityConfig: Record<Sensitivity, { label: string; description: string; gThreshold: string }> = {
    low: { label: 'Nizka', description: 'Samo močni udarci', gThreshold: '> 5G' },
    medium: { label: 'Srednja', description: 'Zmerne in močne nesreče', gThreshold: '> 3G' },
    high: { label: 'Visoka', description: 'Vsi udarci in trki', gThreshold: '> 1.5G' },
  }

  return (
    <Card className="border-rose-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-5 w-5 text-rose-500" />
          Zaznavanje nesreč
          {enabled ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              Aktivno
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5">
              Nedejavno
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Omogoči zaznavanje</span>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Sensitivity selector */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Občutljivost</span>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as Sensitivity[]).map(level => (
              <button
                key={level}
                onClick={() => setSensitivity(level)}
                className={`rounded-lg border p-2 text-center transition-colors ${
                  sensitivity === level
                    ? 'border-rose-500 bg-rose-500/10'
                    : 'border-border hover:border-rose-500/50'
                }`}
              >
                <span className="text-xs font-medium block">{sensitivityConfig[level].label}</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {sensitivityConfig[level].gThreshold}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {sensitivityConfig[sensitivity].description}
          </p>
        </div>

        {/* Status indicator */}
        {enabled && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <span className="text-xs text-rose-500 font-medium">Senzorji aktivni — {sensitivityConfig[sensitivity].label} občutljivost</span>
          </div>
        )}

        {/* Emergency contacts */}
        {emergencyContacts && emergencyContacts.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              Kontakti v sili
            </span>
            {emergencyContacts.map((contact, i) => (
              <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 p-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">{contact.name}</span>
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" />
                  {contact.phone}
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Test button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!enabled || isTesting}
          className="w-full gap-2"
        >
          <TestTube className="h-4 w-4" />
          {isTesting ? 'Testiram...' : 'Preizkusi zaznavanje'}
        </Button>

        {/* Crash history */}
        {crashHistory.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Zgodovina dogodkov</span>
            <ScrollArea className="max-h-40">
              <div className="space-y-2 pr-2">
                {crashHistory.map(event => {
                  const config = statusConfig[event.status]
                  return (
                    <div key={event.id} className="rounded-md border p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium flex items-center gap-1 ${config.color}`}>
                          {config.icon}
                          {config.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(event.detectedAt).toLocaleDateString('sl-SI')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{event.gForce}G</span>
                        <span>{event.speedBefore} km/h pred</span>
                        {event.alertSent && <span className="text-amber-500">Alert poslan</span>}
                      </div>
                      {event.notes && (
                        <p className="text-[10px] text-muted-foreground italic">{event.notes}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
