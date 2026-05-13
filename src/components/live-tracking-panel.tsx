'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { LiveTrackingSession } from '@/components/tabs/types'
import {
  Radio,
  Copy,
  Check,
  Eye,
  Clock,
  QrCode,
  StopCircle,
  Play,
  Share2,
} from 'lucide-react'

interface LiveTrackingPanelProps {
  userId?: string
  onSessionChange?: (session: LiveTrackingSession | null) => void
}

export default function LiveTrackingPanel({ userId, onSessionChange }: LiveTrackingPanelProps) {
  const [isActive, setIsActive] = useState(false)
  const [session, setSession] = useState<LiveTrackingSession | null>(null)
  const [copied, setCopied] = useState(false)
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isActive])

  const formatDuration = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [])

  const handleStart = () => {
    const newSession: LiveTrackingSession = {
      id: `lt-${Date.now()}`,
      shareToken: Math.random().toString(36).substring(2, 10),
      shareUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/track/live/${Math.random().toString(36).substring(2, 10)}`,
      isActive: true,
      startedAt: new Date().toISOString(),
      viewerCount: 0,
    }
    setSession(newSession)
    setIsActive(true)
    setDuration(0)
    onSessionChange?.(newSession)
  }

  const handleStop = () => {
    setIsActive(false)
    setDuration(0)
    onSessionChange?.(null)
  }

  const handleCopyLink = async () => {
    if (session?.shareUrl) {
      try {
        await navigator.clipboard.writeText(session.shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Fallback
      }
    }
  }

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-5 w-5 text-emerald-500" />
          Sledenje v živo
          {isActive && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 animate-pulse">
              V ŽIVO
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isActive && session ? (
          <>
            {/* Duration & viewer count */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <Clock className="h-4 w-4 text-emerald-500 mb-1" />
                <span className="text-lg font-mono font-bold">{formatDuration(duration)}</span>
                <span className="text-[10px] text-muted-foreground">Trajanje</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
                <Eye className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-lg font-bold">{session.viewerCount}</span>
                <span className="text-[10px] text-muted-foreground">Gledalci</span>
              </div>
            </div>

            {/* Share link */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Povezava za deljenje</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={session.shareUrl}
                  className="text-xs h-9 bg-muted/50"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-9 w-9 p-0 flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* QR Code placeholder */}
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-4">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="h-12 w-12" />
                <span className="text-xs">QR koda za deljenje</span>
              </div>
            </div>

            {/* Share button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                if (navigator.share && session.shareUrl) {
                  navigator.share({
                    title: 'MotoTrack - Sledenje v živo',
                    text: 'Spremljaj mojo vožnjo v živo!',
                    url: session.shareUrl,
                  }).catch(() => {})
                }
              }}
            >
              <Share2 className="h-4 w-4" />
              Deli povezavo
            </Button>

            {/* Stop button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              className="w-full gap-2"
            >
              <StopCircle className="h-4 w-4" />
              Ustavi sledenje
            </Button>
          </>
        ) : (
          <>
            {/* Not active */}
            <div className="text-center space-y-3 py-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-500/10 p-4">
                  <Radio className="h-8 w-8 text-emerald-500" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Delite svojo vožnjo v živo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Družina in prijatelji lahko spremljajo vašo vožnjo v realnem času
                </p>
              </div>
            </div>

            <Button
              onClick={handleStart}
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Play className="h-4 w-4" />
              Začni sledenje v živo
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { className?: string }) {
  return <label className={className} {...props}>{children}</label>
}
