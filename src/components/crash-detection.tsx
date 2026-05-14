'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, X, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface CrashDetectionProps {
  isEnabled: boolean
  userId?: string
  currentLat: number | null
  currentLng: number | null
  onToggle: (enabled: boolean) => void
}

export default function CrashDetection({
  isEnabled, userId, currentLat, currentLng, onToggle,
}: CrashDetectionProps) {
  const [crashDetected, setCrashDetected] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [cancelled, setCancelled] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Listen for high acceleration via DeviceMotion
  useEffect(() => {
    if (!isEnabled) return

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (!acc) return
      const total = Math.sqrt(
        (acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2
      )
      // 2.5g threshold
      if (total > 2.5 * 9.81 && !crashDetected) {
        setCrashDetected(true)
        setCountdown(30)
        toast.error('⚠️ Zaznan padec! SOS čez 30s...')
        timerRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    }

    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [isEnabled, crashDetected])

  // Auto-send SOS when countdown reaches 0
  useEffect(() => {
    if (!crashDetected || countdown !== 0 || cancelled || !userId) return

    const sendAutoSOS = async () => {
      try {
        await fetch('/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            lat: currentLat ?? 46.15,
            lng: currentLng ?? 14.99,
            type: 'crash_detected',
          }),
        })
        toast.success('SOS poslan!')
      } catch {
        toast.error('Napaka pri pošiljanju SOS')
      }
    }
    sendAutoSOS()
  }, [crashDetected, countdown, cancelled, userId, currentLat, currentLng])

  const cancelSOS = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCrashDetected(false)
    setCancelled(true)
    toast.success('SOS preklican - vse je v redu')
    setTimeout(() => setCancelled(false), 3000)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (!isEnabled) return null

  return (
    <>
      {/* Crash detected overlay */}
      {crashDetected && (
        <div className="absolute inset-0 z-[2000] pointer-events-none">
          <div className="absolute bottom-40 left-3 right-3 pointer-events-auto">
            <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 text-center backdrop-blur-md animate-pulse">
              <ShieldAlert className="size-10 text-red-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-red-500">ZAZNAN PAD!</p>
              <p className="text-4xl font-mono font-bold text-red-500 mt-2">{countdown}s</p>
              <p className="text-sm text-muted-foreground mb-3">
                SOS bo poslan avtomatsko
              </p>
              <Button
                variant="outline"
                className="gap-2 bg-background hover:bg-muted"
                onClick={cancelSOS}
              >
                <X className="size-4" /> Prekliči SOS
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled confirmation */}
      {cancelled && (
        <div className="absolute bottom-40 left-3 right-3 z-[2000]">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center backdrop-blur-md">
            <p className="text-sm text-green-500 font-medium">✓ SOS preklican - vse je v redu</p>
          </div>
        </div>
      )}

      {/* Active indicator */}
      {isEnabled && !crashDetected && !cancelled && (
        <div className="absolute top-3 left-3 z-[1002]">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-sm">
            <ShieldAlert className="size-3 text-red-500" />
            <span className="text-[10px] font-medium text-red-500">Zaščita</span>
          </div>
        </div>
      )}
    </>
  )
}
