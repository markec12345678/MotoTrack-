'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { AlertTriangle, X, Phone, MapPin, Clock, CheckCircle, ShieldAlert, Droplets } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import type { SosAlertData } from '@/components/tabs/types'

interface SosButtonProps {
  userId: string | undefined
}

export default function SosButton({ userId }: SosButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [activeAlert, setActiveAlert] = useState<SosAlertData | null>(null)
  const [alertDetails, setAlertDetails] = useState<{
    iceContacts: Array<{ name: string; phone: string | null }>
    nearestHelp: { name: string; lat: number; lng: number; distance: number } | null
    bloodType: string | null
    allergies: string | null
  } | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-hide SOS button after 8 seconds of no interaction (expand on tap)
  useEffect(() => {
    autoHideTimer.current = setTimeout(() => setCollapsed(true), 8000)
    return () => { if (autoHideTimer.current) clearTimeout(autoHideTimer.current) }
  }, [])

  // Check for existing active alerts on mount
  useEffect(() => {
    if (!userId) return
    fetch(`/api/sos?userId=${userId}&status=active`)
      .then(r => r.json())
      .then(j => {
        const alerts = j.data || []
        if (alerts.length > 0) {
          setActiveAlert(alerts[0])
        }
      })
      .catch(() => {})
  }, [userId])

  // Countdown timer for active alerts
  useEffect(() => {
    if (activeAlert) {
      const created = new Date(activeAlert.createdAt).getTime()
      const updateCountdown = () => {
        const elapsed = Math.floor((Date.now() - created) / 1000)
        setCountdown(elapsed)
      }
      updateCountdown()
      countdownRef.current = setInterval(updateCountdown, 1000)
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current)
      }
    } else {
      setCountdown(null)
    }
  }, [activeAlert])

  const sendSos = useCallback(async (lat: number, lng: number, type: string = 'manual') => {
    if (!userId) {
      toast.error('Ni uporabnika')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lat, lng, type }),
      })
      if (res.ok) {
        const j = await res.json()
        setActiveAlert(j.data.alert)
        setAlertDetails(j.data.emergencyInfo)
        setShowPanel(true)
        toast.error('🚨 SOS alert poslan! Pomoč je na poti.')
      } else {
        toast.error('Napaka pri pošiljanju SOS alerta')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setSending(false)
    }
  }, [userId])

  const triggerSos = useCallback(() => {
    if (!userId) {
      toast.error('Ni uporabnika')
      return
    }
    if (activeAlert) {
      setShowPanel(true)
      return
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendSos(pos.coords.latitude, pos.coords.longitude)
        },
        () => {
          // Fallback to Ljubljana center
          sendSos(46.0569, 14.5058)
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else {
      sendSos(46.0569, 14.5058)
    }
  }, [userId, activeAlert, sendSos])

  // Long press handler for instant SOS
  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      // Instant SOS without confirmation
      triggerSos()
    }, 3000)
  }, [triggerSos])

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const resolveAlert = useCallback(async (status: 'resolved' | 'false_alarm') => {
    if (!activeAlert) return
    try {
      const res = await fetch(`/api/sos/${activeAlert.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setActiveAlert(null)
        setAlertDetails(null)
        setShowPanel(false)
        toast.success(status === 'resolved' ? 'Alert razrešen' : 'Alert označen kot lažni')
      } else {
        toast.error('Napaka pri razrešitvi alerta')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
  }, [activeAlert])

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* Floating SOS button - compact when collapsed */}
      {!showPanel && (
        <button
          onClick={() => {
            if (collapsed) {
              setCollapsed(false)
              if (autoHideTimer.current) clearTimeout(autoHideTimer.current)
              autoHideTimer.current = setTimeout(() => setCollapsed(true), 8000)
              return
            }
            if (activeAlert) {
              setShowPanel(true)
            } else {
              setConfirmOpen(true)
            }
          }}
          onPointerDown={collapsed ? undefined : handlePointerDown}
          onPointerUp={collapsed ? undefined : handlePointerUp}
          onPointerLeave={collapsed ? undefined : handlePointerLeave}
          className={`fixed left-4 z-[1600] rounded-full shadow-lg transition-all flex items-center justify-center font-bold text-white select-none ${
            collapsed
              ? 'bottom-24 size-10 bg-red-500/80 hover:bg-red-500'
              : activeAlert
                ? 'bottom-28 size-14 bg-red-600 animate-pulse hover:scale-105'
                : 'bottom-28 size-14 bg-red-500 hover:bg-red-600 hover:scale-105'
          }`}
          aria-label="SOS nujna pomoč"
        >
          {collapsed ? (
            <AlertTriangle className="size-4" />
          ) : (
            <span className="text-sm font-black tracking-wider">SOS</span>
          )}
        </button>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-full bg-red-500/20">
                <ShieldAlert className="size-5 text-red-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg">SOS Nujna pomoč</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="text-sm pt-2">
              Ali ste v sili? Pošiljanje SOS alerta bo poslilo vašo lokacijo vsem ICE kontaktom in označilo vašo pozicijo na zemljevidu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-sm">Prekliči</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white text-sm"
              onClick={triggerSos}
            >
              <AlertTriangle className="size-4 mr-2" />
              Pošlji SOS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Active alert panel */}
      {showPanel && (
        <div className="fixed bottom-20 left-0 sm:left-4 z-[1600] w-full sm:w-80 bg-card border border-red-500/50 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
          {/* Red pulsing header */}
          <div className="bg-red-500 text-white p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5" />
                <span className="font-bold text-sm">SOS ALERT AKTIVEN</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-white hover:bg-red-600"
                onClick={() => setShowPanel(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            {countdown !== null && (
              <div className="flex items-center gap-2 mt-2">
                <Clock className="size-4" />
                <span className="text-sm font-mono">Trajanje: {formatCountdown(countdown)}</span>
              </div>
            )}
          </div>

          {/* Alert details */}
          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {/* Location */}
            {activeAlert && (
              <div className="flex items-start gap-2">
                <MapPin className="size-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">Lokacija</p>
                  <p className="text-xs text-muted-foreground">
                    {activeAlert.lat.toFixed(4)}, {activeAlert.lng.toFixed(4)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Tip: {activeAlert.type === 'manual' ? 'Ročni' : activeAlert.type === 'crash_detected' ? 'Zaznan padec' : 'Brez gibanja'}
                  </p>
                </div>
              </div>
            )}

            {/* Medical info */}
            {alertDetails && (alertDetails.bloodType || alertDetails.allergies) && (
              <Card className="border-red-200 dark:border-red-900/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="size-4 text-red-500" />
                    <span className="text-xs font-bold">Zdravstveni podatki</span>
                  </div>
                  {alertDetails.bloodType && (
                    <Badge variant="outline" className="text-xs mr-1 mb-1 border-red-300 text-red-600">
                      Krvna skupina: {alertDetails.bloodType}
                    </Badge>
                  )}
                  {alertDetails.allergies && (
                    <p className="text-xs text-muted-foreground mt-1">Alergije: {alertDetails.allergies}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ICE Contacts */}
            {alertDetails && alertDetails.iceContacts.length > 0 && (
              <Card className="border-red-200 dark:border-red-900/50">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Phone className="size-4 text-red-500" />
                    ICE Kontakti
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {alertDetails.iceContacts.map((contact, i) => (
                    <div key={i} className="flex items-center justify-between bg-secondary/50 rounded-lg p-2">
                      <div>
                        <p className="text-xs font-medium">{contact.name}</p>
                        {contact.phone && (
                          <p className="text-[10px] text-muted-foreground">{contact.phone}</p>
                        )}
                      </div>
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-red-500 hover:text-red-600">
                          <Phone className="size-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Nearest help */}
            {alertDetails?.nearestHelp && (
              <div className="flex items-start gap-2">
                <CheckCircle className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">Najbližja pomoč</p>
                  <p className="text-xs text-muted-foreground">{alertDetails.nearestHelp.name} ({alertDetails.nearestHelp.distance} km)</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={() => resolveAlert('resolved')}
              >
                <CheckCircle className="size-3.5 mr-1" />
                V redu sem
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => resolveAlert('false_alarm')}
              >
                Lažni alarm
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Dolg pritisk na SOS gumb (3s) = takojšnji alert brez potrditve
            </p>
          </div>
        </div>
      )}

      {/* Sending overlay */}
      {sending && (
        <div className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center">
          <div className="bg-card rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl">
            <div className="size-12 rounded-full bg-red-500 animate-pulse flex items-center justify-center">
              <AlertTriangle className="size-6 text-white" />
            </div>
            <p className="text-sm font-bold">Pošiljam SOS...</p>
            <p className="text-xs text-muted-foreground">Pridobivam lokacijo</p>
          </div>
        </div>
      )}
    </>
  )
}
