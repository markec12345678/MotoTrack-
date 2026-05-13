'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface CrashDetectionPanelProps {
  userId?: string
}

type Sensitivity = 'low' | 'medium' | 'high'

const SENSITIVITY_THRESHOLDS: Record<Sensitivity, number> = {
  low: 4.0,
  medium: 3.0,
  high: 2.5,
}

export default function CrashDetectionPanel({ userId }: CrashDetectionPanelProps) {
  const [enabled, setEnabled] = useState(true)
  const [sensitivity, setSensitivity] = useState<Sensitivity>('medium')
  const [isTesting, setIsTesting] = useState(false)
  const [crashHistory, setCrashHistory] = useState<CrashEvent[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [iceContacts, setIceContacts] = useState<Array<{ name: string; phone: string }>>([])

  const enabledRef = useRef(enabled)
  const sensitivityRef = useRef(sensitivity)
  const userIdRef = useRef(userId)
  const crashCooldownRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { sensitivityRef.current = sensitivity }, [sensitivity])
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Fetch crash history from API
  const fetchCrashHistory = useCallback(async () => {
    if (!userId) return
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/crash-detection?userId=${userId}`)
      if (res.ok) {
        const json = await res.json()
        const events: CrashEvent[] = (json.data || []).map((e: any) => ({
          id: e.id,
          userId: e.userId,
          lat: e.lat,
          lng: e.lng,
          gForce: e.gForce,
          speedBefore: e.speedBefore,
          detectedAt: e.detectedAt,
          alertSent: e.alertSent,
          status: e.status,
          notes: e.notes,
        }))
        setCrashHistory(events)
      }
    } catch {
      // Silently fail — UI will just show empty history
    } finally {
      setLoadingHistory(false)
    }
  }, [userId])

  // Fetch ICE contacts from API
  const fetchIceContacts = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/emergency-contacts?userId=${userId}`)
      if (res.ok) {
        const json = await res.json()
        const data = json.data
        const contacts: Array<{ name: string; phone: string }> = []
        if (data?.iceName1 && data?.icePhone1) {
          contacts.push({ name: data.iceName1, phone: data.icePhone1 })
        }
        if (data?.iceName2 && data?.icePhone2) {
          contacts.push({ name: data.iceName2, phone: data.icePhone2 })
        }
        setIceContacts(contacts)
      }
    } catch {
      // Silently fail
    }
  }, [userId])

  // Initial data fetch
  useEffect(() => {
    fetchCrashHistory()
    fetchIceContacts()
  }, [fetchCrashHistory, fetchIceContacts])

  // DeviceMotionEvent listener for real crash detection
  useEffect(() => {
    if (!enabled || !userId) return

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!enabledRef.current || crashCooldownRef.current) return

      const acc = event.accelerationIncludingGravity
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return

      // Calculate total g-force from acceleration values
      const gForce = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81
      const threshold = SENSITIVITY_THRESHOLDS[sensitivityRef.current]

      if (gForce >= threshold) {
        crashCooldownRef.current = true

        // Get current position for crash event
        navigator.geolocation?.getCurrentPosition(
          async (pos) => {
            try {
              const res = await fetch('/api/crash-detection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: userIdRef.current,
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  gForce: Math.round(gForce * 10) / 10,
                  speedBefore: Math.round((pos.coords.speed ?? 0) * 3.6), // m/s to km/h
                }),
              })
              if (res.ok) {
                toast.error('Zaznan trk!', {
                  description: `G-sila: ${gForce.toFixed(1)}G — SOS alert poslan`,
                  duration: 10000,
                })
                fetchCrashHistory()
              }
            } catch {
              toast.error('Napaka pri pošiljanju alerta')
            } finally {
              // Cooldown: prevent duplicate alerts for 10 seconds
              setTimeout(() => { crashCooldownRef.current = false }, 10000)
            }
          },
          async () => {
            // Geolocation failed — post with default coords
            try {
              await fetch('/api/crash-detection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: userIdRef.current,
                  lat: 46.0569,
                  lng: 14.5058,
                  gForce: Math.round(gForce * 10) / 10,
                  speedBefore: 0,
                }),
              })
              toast.error('Zaznan trk!', { description: `G-sila: ${gForce.toFixed(1)}G` })
              fetchCrashHistory()
            } catch {
              // silently fail
            } finally {
              setTimeout(() => { crashCooldownRef.current = false }, 10000)
            }
          },
          { timeout: 5000 }
        )
      }
    }

    // Check if DeviceMotionEvent is available and requires permission (iOS 13+)
    let cleanup = false

    const startListening = () => {
      if (cleanup) return
      window.addEventListener('devicemotion', handleMotion)
    }

    if (typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      // iOS 13+ requires user permission
      // We don't auto-request permission — it will be requested when user enables detection
      // For now, just try to listen (will work if already granted)
      startListening()
    } else if (typeof DeviceMotionEvent !== 'undefined') {
      startListening()
    }

    return () => {
      cleanup = true
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [enabled, userId, fetchCrashHistory])

  // Test button — simulate a crash event via the API
  const handleTest = async () => {
    if (!userId) {
      toast.error('Manjka userId')
      return
    }
    setIsTesting(true)
    try {
      // Get current position for test event
      const getPosition = (): Promise<{ lat: number; lng: number }> =>
        new Promise((resolve) => {
          navigator.geolocation?.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({ lat: 46.0569, lng: 14.5058 }),
            { timeout: 5000 }
          )
        })

      const { lat, lng } = await getPosition()

      const res = await fetch('/api/crash-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          lat,
          lng,
          gForce: 3.5,
          speedBefore: 45,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        toast.success('Testni trk zaznan', {
          description: json.data?.alertSent
            ? 'SOS alert poslan kontaktem v sili'
            : 'Dogodek zabeležen (brez alerta)',
        })
        fetchCrashHistory()
      } else {
        toast.error('Napaka pri testiranju')
      }
    } catch {
      toast.error('Napaka pri testiranju')
    } finally {
      setIsTesting(false)
    }
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
    low: { label: 'Nizka', description: 'Samo močni udarci', gThreshold: `> ${SENSITIVITY_THRESHOLDS.low}G` },
    medium: { label: 'Srednja', description: 'Zmerne in močne nesreče', gThreshold: `> ${SENSITIVITY_THRESHOLDS.medium}G` },
    high: { label: 'Visoka', description: 'Vsi udarci in trki', gThreshold: `> ${SENSITIVITY_THRESHOLDS.high}G` },
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
        {iceContacts.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              Kontakti v sili
            </span>
            {iceContacts.map((contact, i) => (
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
          {isTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4" />
          )}
          {isTesting ? 'Testiram...' : 'Preizkusi zaznavanje'}
        </Button>

        {/* Crash history */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Zgodovina dogodkov</span>
          {loadingHistory && crashHistory.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : crashHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Ni zgodovine dogodkov</p>
          ) : (
            <ScrollArea className="max-h-40">
              <div className="space-y-2 pr-2">
                {crashHistory.map(event => {
                  const config = statusConfig[event.status] || statusConfig.detected
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
          )}
        </div>
      </CardContent>
    </Card>
  )
}
