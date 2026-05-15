'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Loader2,
  CloudOff,
  HardDrive,
  Plus,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SyncQueueItem } from '@/components/tabs/types'

interface OfflineSyncPanelProps {
  userId?: string
}

interface StorageEstimate {
  usage: number
  quota: number
}

const entityLabels: Record<string, string> = {
  ride: 'Vožnja',
  route: 'Ruta',
  comment: 'Komentar',
  photo: 'Foto',
  poi: 'POI',
  expense: 'Strošek',
  maintenance: 'Vzdrževanje',
  hazard: 'Nevarnost',
  event: 'Dogodek',
  camp: 'Kamp',
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function OfflineSyncPanel({ userId }: OfflineSyncPanelProps) {
  const [items, setItems] = useState<SyncQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null)
  const [swQueueLength, setSwQueueLength] = useState(0)
  const autoSyncRef = useRef(false)
  const syncingRef = useRef(false)

  // Get storage estimate
  const updateStorageEstimate = useCallback(async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        })
      }
    } catch { /* not available */ }
  }, [])

  // Get SW queue status
  const updateSwQueueStatus = useCallback(() => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'GET_QUEUE_STATUS' })
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

  const handleSyncAll = useCallback(async () => {
    if (!userId || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncAll: true, userId }),
      })
      if (res.ok) {
        const json = await res.json()
        const msg = autoSyncRef.current
          ? '🔄 Samodejna sinhronizacija: ' + json.data.completed + ' zaključenih'
          : 'Sinhronizirano: ' + json.data.completed + ' zaključenih, ' + json.data.failed + ' neuspešnih'
        toast.success(msg)
        fetchItems()
        updateStorageEstimate()
      }
    } catch {
      toast.error('Napaka pri sinhronizaciji')
    } finally {
      syncingRef.current = false
      setSyncing(false)
      autoSyncRef.current = false
    }
  }, [userId, fetchItems, updateStorageEstimate])

  // Keep handleSyncAll in a ref so the online/offline effect can call it
  const handleSyncAllRef = useRef(handleSyncAll)
  useEffect(() => { handleSyncAllRef.current = handleSyncAll }, [handleSyncAll])

  // Listen for SW messages about queue status
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'QUEUE_STATUS') {
        setSwQueueLength(event.data.queueLength || 0)
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [])

  // Monitor online status — auto-sync when coming back online
  useEffect(() => {
    const update = () => {
      const online = navigator.onLine
      setIsOnline(online)

      if (online) {
        // Coming back online — trigger background sync via ref
        autoSyncRef.current = true
        handleSyncAllRef.current()
        toast.success('Povezava vzpostavljena', {
          description: 'Sinhronizacija podatkov je v teku...',
          duration: 3000,
        })
      } else {
        toast.warning('Brez povezave', {
          description: 'Nekatere funkcije so omejene. Podatki bodo shranjeni lokalno.',
          duration: 5000,
        })
      }
    }

    setIsOnline(navigator.onLine)

    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Initial load + periodic refresh
  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { updateStorageEstimate() }, [updateStorageEstimate])
  useEffect(() => { updateSwQueueStatus() }, [updateSwQueueStatus])

  // Auto-refresh items every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchItems()
      updateSwQueueStatus()
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchItems, updateSwQueueStatus])

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
      updateStorageEstimate()
    } catch {
      toast.error('Napaka')
    }
  }

  // Manual queue item for testing
  const handleAddTestItem = async () => {
    if (!userId) return
    try {
      const entities = ['ride', 'route', 'comment', 'poi', 'expense']
      const operations = ['create', 'update', 'delete']
      const randomEntity = entities[Math.floor(Math.random() * entities.length)]
      const randomOp = operations[Math.floor(Math.random() * operations.length)]

      await fetch('/api/sync-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          operation: randomOp,
          entity: randomEntity,
          data: { test: true, timestamp: Date.now() },
        }),
      })
      toast.success(`Testna postavka dodana: ${operationLabels[randomOp]} ${entityLabels[randomEntity]}`)
      fetchItems()
    } catch {
      toast.error('Napaka pri dodajanju')
    }
  }

  // Trigger SW background sync
  const handleTriggerBgSync = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' })
      toast.info('Sinhronizacija v ozadju zagnana')
    }
  }

  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'failed').length
  const failedCount = items.filter(i => i.status === 'failed').length
  const completedCount = items.filter(i => i.status === 'completed').length
  const storageUsagePct = storageEstimate && storageEstimate.quota > 0
    ? Math.min(100, Math.round((storageEstimate.usage / storageEstimate.quota) * 100))
    : 0

  return (
    <Card className="border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="text-sky-400">🔄</span>
            Offline Sinhronizacija
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Online/Offline indicator — prominent */}
            <Badge
              variant="outline"
              className={
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-2'
                  : 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-2 animate-pulse'
              }
            >
              {isOnline ? <Wifi className="size-2.5 mr-1" /> : <WifiOff className="size-2.5 mr-1" />}
              {isOnline ? 'Povezava' : 'Brez povezave'}
            </Badge>
            {pendingCount > 0 && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-2">
                {pendingCount}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status banner when offline */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <WifiOff className="size-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Način brez povezave</p>
              <p className="text-[10px] text-orange-400/70">Podatki bodo shranjeni lokalno in sinhronizirani ob povratku povezave</p>
            </div>
          </div>
        )}

        {/* Storage usage estimate */}
        {storageEstimate && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500 flex items-center gap-1">
                <HardDrive className="size-3" />
                Shranjevanje
              </span>
              <span className="text-zinc-400">
                {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
              </span>
            </div>
            <Progress value={storageUsagePct} className="h-1.5 bg-zinc-800" />
            {storageUsagePct > 80 && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Shramba je skoraj polna — razmislite o brisanju starejših podatkov
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
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
          {isOnline && (
            <Button
              onClick={handleTriggerBgSync}
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-sky-400"
              title="Sinhronizacija v ozadju"
            >
              <Zap className="size-3.5" />
            </Button>
          )}
          <Button
            onClick={handleAddTestItem}
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-emerald-400"
            title="Dodaj testno postavko"
          >
            <Plus className="size-3.5" />
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

        {/* SW queue info */}
        {swQueueLength > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
            <Clock className="size-3" />
            <span>{swQueueLength} postavk{swQueueLength === 1 ? 'a' : 'e'} v čakalni vrsti Service Workerja</span>
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
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-[10px] text-zinc-600 hover:text-emerald-400 h-6"
              onClick={handleAddTestItem}
            >
              <Plus className="size-3 mr-1" />
              Dodaj testno postavko
            </Button>
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
              {completedCount > 0 && `${completedCount} zaključenih · `}
              {failedCount > 0 && `${failedCount} neuspešnih`}
              {pendingCount === 0 && failedCount === 0 && 'Vse sinhronizirano ✓'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
