'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Loader2,
  ArrowUpDown,
  CloudOff,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SyncQueueItem } from '@/components/tabs/types'

interface OfflineSyncPanelProps {
  userId?: string
}

const entityLabels: Record<string, string> = {
  ride: 'Vožnja',
  route: 'Ruta',
  comment: 'Komentar',
  photo: 'Foto',
  poi: 'POI',
}

const operationLabels: Record<string, string> = {
  create: 'Ustvari',
  update: 'Posodobi',
  delete: 'Izbriši',
}

const operationColors: Record<string, string> = {
  create: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  update: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const statusConfig: Record<string, { icon: React.ElementType; className: string; label: string }> = {
  pending: { icon: Clock, className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'V čakalni vrsti' },
  in_progress: { icon: Loader2, className: 'bg-sky-500/20 text-sky-400 border-sky-500/30', label: 'V teku' },
  completed: { icon: CheckCircle, className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Zaključeno' },
  failed: { icon: AlertTriangle, className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Neuspešno' },
}

export default function OfflineSyncPanel({ userId }: OfflineSyncPanelProps) {
  const [items, setItems] = useState<SyncQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // Monitor online status
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const fetchItems = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sync-queue?userId=${userId}`)
      if (res.ok) {
        const json = await res.json()
        setItems(json.data || [])
      }
    } catch {
      toast.error('Napaka pri nalaganju')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleSyncAll = async () => {
    if (!userId) return
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncAll: true, userId }),
      })
      if (res.ok) {
        const json = await res.json()
        toast.success(`Sinhronizirano: ${json.data.completed} zaključenih, ${json.data.failed} neuspešnih`)
        fetchItems()
      }
    } catch {
      toast.error('Napaka pri sinhronizaciji')
    } finally {
      setSyncing(false)
    }
  }

  const handleRetry = async (itemId: string) => {
    try {
      await fetch('/api/sync-queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: itemId, status: 'pending' }),
      })
      toast.success('Ponovno v čakalni vrsti')
      fetchItems()
    } catch {
      toast.error('Napaka')
    }
  }

  const handleClearCompleted = async () => {
    if (!userId) return
    try {
      await fetch(`/api/sync-queue?userId=${userId}&completed=true`, { method: 'DELETE' })
      toast.success('Zaključeni izbrisani')
      fetchItems()
    } catch {
      toast.error('Napaka')
    }
  }

  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'failed').length
  const failedCount = items.filter(i => i.status === 'failed').length

  return (
    <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="text-sky-400">🔄</span>
            Offline Sinhronizacija
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Online/Offline indicator */}
            <Badge
              variant="outline"
              className={
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]'
                  : 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px]'
              }
            >
              {isOnline ? <Wifi className="size-2.5 mr-0.5" /> : <WifiOff className="size-2.5 mr-0.5" />}
              {isOnline ? 'Povezava' : 'Brez povezave'}
            </Badge>
            {pendingCount > 0 && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Sync button */}
        <div className="flex gap-2">
          <Button
            onClick={handleSyncAll}
            disabled={syncing || !isOnline || pendingCount === 0}
            size="sm"
            className="flex-1 bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 border border-sky-500/20"
          >
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin mr-1" />
            ) : (
              <RefreshCw className="size-3.5 mr-1" />
            )}
            Sinhroniziraj vse
          </Button>
          {items.some(i => i.status === 'completed') && (
            <Button
              onClick={handleClearCompleted}
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Progress bar during sync */}
        {syncing && (
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded bg-zinc-800/40 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-4">
            <CloudOff className="size-6 text-zinc-600 mx-auto mb-1.5" />
            <p className="text-xs text-zinc-500">Sinhronizacija je na voljo</p>
            <p className="text-[10px] text-zinc-700 mt-0.5">Podatki bodo shranjeni v čakalno vrsto brez povezave</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            {items.map(item => {
              const status = statusConfig[item.status] || statusConfig.pending
              const StatusIcon = status.icon

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded bg-zinc-800/40 border border-zinc-700/30"
                >
                  <StatusIcon className={`size-3 flex-shrink-0 ${item.status === 'in_progress' ? 'animate-spin' : ''} ${status.className.includes('yellow') ? 'text-yellow-400' : status.className.includes('emerald') ? 'text-emerald-400' : status.className.includes('red') ? 'text-red-400' : 'text-sky-400'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`${operationColors[item.operation] || ''} text-[8px] px-1 py-0`}>
                        {operationLabels[item.operation] || item.operation}
                      </Badge>
                      <span className="text-[10px] text-zinc-400 truncate">
                        {entityLabels[item.entity] || item.entity}
                        {item.entityId ? ` · ${item.entityId.slice(0, 6)}...` : ''}
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-600 mt-0.5">
                      {status.label} · poskus {item.attempts}/{item.maxAttempts}
                    </div>
                  </div>

                  {item.status === 'failed' && item.attempts < item.maxAttempts && (
                    <button
                      onClick={() => handleRetry(item.id)}
                      className="p-1 text-zinc-500 hover:text-yellow-400 transition-colors"
                    >
                      <RefreshCw className="size-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {items.length > 0 && (
          <div className="flex items-center justify-between text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
            <span>Skupaj: {items.length} postavk</span>
            <span>
              {pendingCount > 0 && `${pendingCount} čakajo · `}
              {failedCount > 0 && `${failedCount} neuspešnih`}
              {pendingCount === 0 && failedCount === 0 && 'Vse sinhronizirano ✓'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
