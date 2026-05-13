'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Bell,
  Heart,
  MessageCircle,
  Trophy,
  UserPlus,
  Users,
  AlertTriangle,
  Check,
  CheckCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { NotificationData } from '@/components/tabs/types'

interface NotificationBellProps {
  userId: string | undefined
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Pravkar'
  if (minutes < 60) return `Pred ${minutes} min`
  if (hours < 24) return `Pred ${hours} h`
  if (days < 7) return `Pred ${days} d`
  return new Date(dateStr).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })
}

function notificationIcon(type: NotificationData['type']) {
  switch (type) {
    case 'like':
      return <Heart className="size-4 text-rose-500" />
    case 'comment':
      return <MessageCircle className="size-4 text-sky-500" />
    case 'achievement':
      return <Trophy className="size-4 text-amber-500" />
    case 'friend_request':
      return <UserPlus className="size-4 text-emerald-500" />
    case 'community_join':
      return <Users className="size-4 text-violet-500" />
    case 'hazard_nearby':
      return <AlertTriangle className="size-4 text-orange-500" />
    default:
      return <Bell className="size-4 text-muted-foreground" />
  }
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/notifications?userId=${userId}&limit=30`)
      if (res.ok) {
        const j = await res.json()
        setNotifications(j.data || [])
        setUnreadCount(j.unreadCount || 0)
      }
    } catch {
      // silent
    }
  }, [userId])

  // Polling every 30s — initial load via setTimeout to avoid synchronous setState in effect
  useEffect(() => {
    const timer = setTimeout(loadNotifications, 0)
    pollRef.current = setInterval(loadNotifications, 30000)
    return () => {
      clearTimeout(timer)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadNotifications])



  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, notificationId }),
      })
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch {
      // silent
    }
  }, [userId])

  const markAllAsRead = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, markAll: true }),
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch {
      // silent
    }
  }, [userId])

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) loadNotifications() }}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 relative"
          title="Obvestila"
        >
          <Bell className="size-3.5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 size-4 p-0 flex items-center justify-center text-[9px] font-bold leading-none bg-rose-500 text-white border-0 hover:bg-rose-500"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Obvestila</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1 text-primary"
                onClick={markAllAsRead}
              >
                <CheckCheck className="size-3.5" />
                Označi vse kot prebrano
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-muted-foreground">
              <Bell className="size-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Ni obvestil</p>
              <p className="text-xs mt-1">Obvestila se bodo prikazala tukaj</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 transition-colors cursor-pointer hover:bg-accent/50 ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    if (!n.read) markAsRead(n.id)
                  }}
                >
                  <div className={`mt-0.5 shrink-0 size-8 rounded-full flex items-center justify-center ${
                    !n.read ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    {notificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!n.read ? 'font-semibold' : 'font-medium text-foreground/80'}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <div className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 mt-0.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        markAsRead(n.id)
                      }}
                      title="Označi kot prebrano"
                    >
                      <Check className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
