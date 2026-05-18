'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  MessageCircle, Send, Users, MapPin, AlertTriangle,
  ChevronDown, ChevronUp, X, Wifi, WifiOff, Circle, Phone
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  userName: string
  message: string
  type: 'text' | 'location' | 'hazard' | 'status' | 'system'
  timestamp: number
  lat?: number
  lng?: number
}

interface RiderInfo {
  userName: string
}

interface GroupRideChatProps {
  rideId: string
  userName?: string
  className?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    osc.type = 'sine'
    gain.gain.value = 0.1
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // Audio not available
  }
}

const STATUS_OPTIONS = [
  { value: 'Pripravljen 🟢', label: 'Pripravljen' },
  { value: 'Na poti 🏍️', label: 'Na poti' },
  { value: 'Odmor ☕', label: 'Odmor' },
  { value: 'Konec 🏁', label: 'Konec' },
]

// ─── Floating Chat Bubble ───────────────────────────────────────────────────────

export function ChatBubble({ rideId, userName = 'Motorist' }: { rideId: string; userName?: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 size-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        title="Klepet skupine"
      >
        <MessageCircle className="size-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-16 right-4 z-50 w-80 sm:w-96">
      <GroupRideChat rideId={rideId} userName={userName} />
      <button
        onClick={() => setOpen(false)}
        className="absolute -top-2 -right-2 size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

// ─── Main Chat Component ────────────────────────────────────────────────────────

export default function GroupRideChat({ rideId, userName = 'Motorist', className = '' }: GroupRideChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [riders, setRiders] = useState<RiderInfo[]>([])
  const [connected, setConnected] = useState(false)
  const [showRiders, setShowRiders] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Connect to socket.io
  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join-ride', { rideId, userName })
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('message-history', (history: ChatMessage[]) => {
      setMessages(history)
    })

    socket.on('new-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg])
      if (msg.userName !== userName && msg.type !== 'system') {
        playNotificationSound()
      }
    })

    socket.on('riders-update', (riderList: RiderInfo[]) => {
      setRiders(riderList)
    })

    socketRef.current = socket

    return () => {
      socket.emit('leave-ride', { rideId, userName })
      socket.disconnect()
    }
  }, [rideId, userName])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Send message
  const sendMessage = useCallback((message: string, type: ChatMessage['type'] = 'text', lat?: number, lng?: number) => {
    if (!message.trim() && type === 'text') return

    if (socketRef.current?.connected) {
      socketRef.current.emit('send-message', {
        rideId,
        userName,
        message: message.trim(),
        type,
        lat,
        lng,
      })
    } else {
      // Fallback to REST API
      fetch('/api/group-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, userName, message: message.trim(), type, lat, lng }),
      }).catch(() => {
        toast.error('Napaka pri pošiljanju sporočila')
      })
    }

    setInputValue('')
    setShowStatusPicker(false)
    inputRef.current?.focus()
  }, [rideId, userName])

  const handleSend = useCallback(() => {
    sendMessage(inputValue, 'text')
  }, [inputValue, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleStatus = useCallback((status: string) => {
    sendMessage(status, 'status')
  }, [sendMessage])

  const handleLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolokacija ni na voljo')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        sendMessage(`📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, 'location', latitude, longitude)
      },
      () => toast.error('Napaka pri pridobivanju lokacije'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [sendMessage])

  const handleHazard = useCallback(() => {
    sendMessage('⚠️ Nevarnost na cesti!', 'hazard')
  }, [sendMessage])

  return (
    <div className={`bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <span className="text-sm font-semibold">Klepet</span>
          {connected ? (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-1 bg-green-500/10 text-green-600">
              <Wifi className="size-2.5" /> Povezan
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-1 bg-red-500/10 text-red-500">
              <WifiOff className="size-2.5" /> Nepovezan
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRiders(!showRiders)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/50 text-xs hover:bg-secondary transition-colors"
          >
            <Users className="size-3" />
            <span>{riders.length}</span>
          </button>
        </div>
      </div>

      {/* Riders Panel (collapsible) */}
      {showRiders && (
        <div className="px-3 py-2 bg-secondary/20 border-b border-border">
          <div className="text-xs font-medium text-muted-foreground mb-1">Povezani motoristi</div>
          <div className="flex flex-wrap gap-1.5">
            {riders.map((rider, i) => (
              <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs">
                <Circle className="size-2 fill-green-500 text-green-500" />
                <span>{rider.userName}</span>
              </div>
            ))}
            {riders.length === 0 && (
              <span className="text-xs text-muted-foreground">Ni povezanih</span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-64 p-2 space-y-1.5">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            Še ni sporočil — pišite kaj!
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.userName === userName} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1 px-2 py-1 border-t border-border bg-secondary/10">
        <button
          onClick={handleLocation}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-medium hover:bg-blue-500/20 transition-colors"
          title="Delite lokacijo"
        >
          <MapPin className="size-3" /> Lokacija
        </button>
        <button
          onClick={handleHazard}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-600 text-[10px] font-medium hover:bg-orange-500/20 transition-colors"
          title="Prijavi nevarnost"
        >
          <AlertTriangle className="size-3" /> Nevarnost
        </button>
        <div className="relative">
          <button
            onClick={() => setShowStatusPicker(!showStatusPicker)}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-[10px] font-medium hover:bg-green-500/20 transition-colors"
            title="Spremeni status"
          >
            <Phone className="size-3" /> Status
          </button>
          {showStatusPicker && (
            <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-lg shadow-lg p-1 space-y-0.5 min-w-[140px] z-10">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatus(opt.value)}
                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-secondary transition-colors"
                >
                  {opt.value}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-border">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Napiši sporočilo..."
          className="h-8 text-xs"
          disabled={!connected}
        />
        <Button
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleSend}
          disabled={!connected || !inputValue.trim()}
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  if (message.type === 'system') {
    return (
      <div className="flex items-center justify-center py-0.5">
        <span className="text-[10px] text-muted-foreground italic">
          {message.message}
        </span>
      </div>
    )
  }

  const colorClass = getAvatarColor(message.userName)

  return (
    <div className={`flex gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`size-6 rounded-full ${colorClass} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
        {getInitial(message.userName)}
      </div>
      {/* Bubble */}
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[9px] font-medium text-muted-foreground">{message.userName}</span>
          <span className="text-[8px] text-muted-foreground/60">{formatTime(message.timestamp)}</span>
        </div>
        <div className={`rounded-xl px-2.5 py-1.5 text-xs ${
          message.type === 'hazard'
            ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20'
            : message.type === 'location'
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
            : message.type === 'status'
            ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
            : isOwn
            ? 'bg-primary/15 text-foreground'
            : 'bg-secondary text-foreground'
        }`}>
          {message.message}
        </div>
        {message.lat && message.lng && (
          <button
            onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${message.lat}&mlon=${message.lng}#map=16/${message.lat}/${message.lng}`, '_blank')}
            className="text-[9px] text-blue-500 hover:underline mt-0.5"
          >
            Pokaži na zemljevidu
          </button>
        )}
      </div>
    </div>
  )
}
