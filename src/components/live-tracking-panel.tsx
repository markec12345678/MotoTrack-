'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { io as socketIO, Socket } from 'socket.io-client'

interface LiveTrackingPanelProps {
  userId?: string
  onSessionChange?: (session: LiveTrackingSession | null) => void
}

export default function LiveTrackingPanel({ userId, onSessionChange }: LiveTrackingPanelProps) {
  const [isActive, setIsActive] = useState(false)
  const [session, setSession] = useState<LiveTrackingSession | null>(null)
  const [copied, setCopied] = useState(false)
  const [duration, setDuration] = useState(0)
  const [viewerCount, setViewerCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [currentHeading, setCurrentHeading] = useState(0)
  const [wsConnected, setWsConnected] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const watchRef = useRef<number | null>(null)
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPositionRef = useRef<{ lat: number; lng: number; speed: number; heading: number } | null>(null)
  const sessionRef = useRef<LiveTrackingSession | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Keep sessionRef in sync
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Initialize Socket.io connection
  useEffect(() => {
    const socket = socketIO('/', {
      query: { XTransformPort: '3003' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })

    socket.on('connect', () => {
      console.log('[LiveTracking] WebSocket connected')
      setWsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('[LiveTracking] WebSocket disconnected')
      setWsConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.warn('[LiveTracking] WebSocket connection error:', err.message)
      setWsConnected(false)
    })

    // Listen for viewer count updates (when we're the rider)
    socket.on('viewer-count', (data: { shareToken: string; count: number }) => {
      const currentSession = sessionRef.current
      if (currentSession && currentSession.shareToken === data.shareToken) {
        setViewerCount(data.count)
      }
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  // Fetch active sessions on mount
  useEffect(() => {
    if (!userId) return

    const fetchActiveSession = async () => {
      try {
        const res = await fetch(`/api/live-tracking?userId=${encodeURIComponent(userId)}`)
        if (!res.ok) return
        const json = await res.json()
        const sessions = json.data as Array<LiveTrackingSession & { viewerCount?: number }>
        const activeSession = sessions?.find(s => s.isActive)
        if (activeSession) {
          const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/live/${activeSession.shareToken}`
          const restored: LiveTrackingSession = {
            id: activeSession.id,
            shareToken: activeSession.shareToken,
            shareUrl: fullUrl,
            isActive: true,
            startedAt: activeSession.startedAt,
            viewerCount: activeSession.viewerCount ?? 0,
          }
          setSession(restored)
          setIsActive(true)
          setViewerCount(activeSession.viewerCount ?? 0)

          // Calculate duration from start
          const startMs = new Date(activeSession.startedAt).getTime()
          const elapsed = Math.floor((Date.now() - startMs) / 1000)
          setDuration(elapsed)

          onSessionChange?.(restored)

          // Re-join the WebSocket session as rider
          const socket = socketRef.current
          if (socket?.connected) {
            socket.emit('start-broadcast', {
              userId,
              userName: 'Rider',
              shareToken: activeSession.shareToken,
              lat: activeSession.lat ?? 0,
              lng: activeSession.lng ?? 0,
              speed: 0,
              heading: 0,
            })
          }
        }
      } catch {
        // Silently fail on mount
      }
    }

    fetchActiveSession()
  }, [userId, onSessionChange])

  // Duration timer
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

  // Poll viewer count as fallback (less frequent since we also get WS updates)
  useEffect(() => {
    if (!isActive || !userId) return

    const pollViewers = async () => {
      try {
        const res = await fetch(`/api/live-tracking?userId=${encodeURIComponent(userId)}`)
        if (!res.ok) return
        const json = await res.json()
        const sessions = json.data as Array<LiveTrackingSession & { viewerCount?: number }>
        const current = sessions?.find(s => s.id === sessionRef.current?.id)
        if (current?.viewerCount !== undefined) {
          // Only update if WebSocket isn't connected (fallback)
          if (!socketRef.current?.connected) {
            setViewerCount(current.viewerCount)
          }
        }
      } catch {
        // Silently fail
      }
    }

    const interval = setInterval(pollViewers, 30000) // 30s fallback poll
    return () => clearInterval(interval)
  }, [isActive, userId])

  // Send position updates via HTTP API AND WebSocket while tracking
  const startPositionUpdates = useCallback((sessionId: string, shareToken: string) => {
    if (updateIntervalRef.current) clearInterval(updateIntervalRef.current)

    updateIntervalRef.current = setInterval(async () => {
      const pos = lastPositionRef.current
      if (!pos) return

      // 1. Send via WebSocket (real-time, primary)
      const socket = socketRef.current
      if (socket?.connected) {
        socket.emit('location-update', {
          shareToken,
          lat: pos.lat,
          lng: pos.lng,
          speed: pos.speed,
          heading: pos.heading,
        })
      }

      // 2. Send via HTTP API (fallback/persistence)
      try {
        await fetch('/api/live-tracking', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            lat: pos.lat,
            lng: pos.lng,
            speed: pos.speed,
            heading: pos.heading,
          }),
        })
      } catch {
        // Silently fail - WS update may still have gone through
      }
    }, 5000) // Update every 5 seconds
  }, [])

  // Clean up all tracking resources
  const cleanupTracking = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
      updateIntervalRef.current = null
    }
    lastPositionRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupTracking()
    }
  }, [cleanupTracking])

  const formatDuration = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [])

  const handleStart = async () => {
    if (!userId) {
      toast.error('Prijava je potrebna za sledenje v živo')
      return
    }

    setLoading(true)

    try {
      // Get current position first
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      })

      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const speed = position.coords.speed ?? 0
      const heading = position.coords.heading ?? 0

      // Create session via API
      const res = await fetch('/api/live-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lat, lng, speed, heading }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Napaka pri ustvarjanju seje')
      }

      const json = await res.json()
      const shareToken = json.data.shareToken as string
      const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/live/${shareToken}`
      const newSession: LiveTrackingSession = {
        id: json.data.id,
        shareToken,
        shareUrl: fullUrl,
        isActive: true,
        startedAt: json.data.startedAt,
        viewerCount: json.data.viewerCount ?? 0,
      }

      setSession(newSession)
      setIsActive(true)
      setDuration(0)
      setViewerCount(0)
      setCurrentSpeed(speed)
      setCurrentHeading(heading)
      onSessionChange?.(newSession)

      // Store initial position
      lastPositionRef.current = { lat, lng, speed, heading }

      // Start broadcasting via WebSocket
      const socket = socketRef.current
      if (socket?.connected) {
        socket.emit('start-broadcast', {
          userId,
          userName: 'Rider',
          shareToken,
          lat,
          lng,
          speed,
          heading,
        })
      }

      // Start watching GPS position
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newLat = pos.coords.latitude
          const newLng = pos.coords.longitude
          const newSpeed = pos.coords.speed ?? 0
          const newHeading = pos.coords.heading ?? 0

          lastPositionRef.current = { lat: newLat, lng: newLng, speed: newSpeed, heading: newHeading }
          setCurrentSpeed(newSpeed)
          setCurrentHeading(newHeading)

          // Emit real-time WebSocket location update on every GPS update
          const currentSocket = socketRef.current
          const currentSession = sessionRef.current
          if (currentSocket?.connected && currentSession?.shareToken) {
            currentSocket.emit('location-update', {
              shareToken: currentSession.shareToken,
              lat: newLat,
              lng: newLng,
              speed: newSpeed,
              heading: newHeading,
            })
          }
        },
        (err) => {
          console.warn('GPS watch error:', err.message)
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      )

      // Start periodic position updates to API (fallback persistence)
      startPositionUpdates(json.data.id, shareToken)

      toast.success('Sledenje v živo začeto!')
    } catch (err: any) {
      if (err instanceof GeolocationPositionError) {
        toast.error('Dostop do lokacije zavrnjen. Omogočite GPS.')
      } else {
        toast.error(err.message || 'Napaka pri začetku sledenja')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    if (!session) return

    try {
      const res = await fetch('/api/live-tracking', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Napaka pri ustavitvi seje')
      }

      // Stop broadcasting via WebSocket
      const socket = socketRef.current
      if (socket?.connected && session.shareToken) {
        socket.emit('stop-broadcast', {
          shareToken: session.shareToken,
        })
      }

      cleanupTracking()
      setIsActive(false)
      setDuration(0)
      setViewerCount(0)
      setCurrentSpeed(0)
      setCurrentHeading(0)
      onSessionChange?.(null)
      setSession(null)

      toast.success('Sledenje v živo ustavljeno')
    } catch (err: any) {
      toast.error(err.message || 'Napaka pri ustavitvi sledenja')
    }
  }

  const handleCopyLink = async () => {
    if (session?.shareUrl) {
      try {
        await navigator.clipboard.writeText(session.shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success('Povezava kopirana!')
      } catch {
        toast.error('Kopiranje ni uspelo')
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
          {/* WebSocket connection indicator */}
          <div className="ml-auto flex items-center gap-1">
            {wsConnected ? (
              <div className="flex items-center gap-1 text-emerald-500">
                <Wifi className="h-3.5 w-3.5" />
                <span className="text-[9px] font-medium">WS</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" />
                <span className="text-[9px]">WS</span>
              </div>
            )}
          </div>
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
                <span className="text-lg font-bold">{viewerCount}</span>
                <span className="text-[10px] text-muted-foreground">Gledalci</span>
              </div>
            </div>

            {/* Speed & heading info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col items-center rounded-lg bg-muted/50 p-2">
                <span className="text-sm font-bold">{Math.round(currentSpeed * 3.6)} km/h</span>
                <span className="text-[10px] text-muted-foreground">Hitrost</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-muted/50 p-2">
                <span className="text-sm font-bold">{Math.round(currentHeading)}°</span>
                <span className="text-[10px] text-muted-foreground">Smer</span>
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
              disabled={loading || !userId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {loading ? 'Pridobivanje lokacije...' : 'Začni sledenje v živo'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
