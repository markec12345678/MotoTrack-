'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Download,
  Trash2,
  Map,
  HardDrive,
  Wifi,
  WifiOff,
  Check,
  Loader2,
  Clock,
  XCircle,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const DB_NAME = 'mototrack-offline-maps'
const STORE_NAME = 'tiles'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveTile(key: string, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ key, blob, timestamp: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getTile(key: string): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result?.blob ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function deleteAllTiles(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function deleteTilesByPrefix(prefix: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        if (cursor.value.key.startsWith(prefix)) {
          cursor.delete()
        }
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getStorageEstimate(): Promise<{ usedBytes: number; tileCount: number }> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const items = request.result || []
      let usedBytes = 0
      items.forEach((item: any) => {
        usedBytes += item.blob?.size || 0
      })
      resolve({ usedBytes, tileCount: items.length })
    }
    request.onerror = () => reject(request.error)
  })
}

async function getTileCountByPrefix(prefix: string): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const items = request.result || []
      const count = items.filter((item: any) => item.key.startsWith(prefix)).length
      resolve(count)
    }
    request.onerror = () => reject(request.error)
  })
}

// ─── Tile URL interceptor for Leaflet ─────────────────────────────────────────

/**
 * Creates a custom tile URL function that checks IndexedDB first.
 * Usage in Leaflet: L.tileLayer(createOfflineTileUrl(...)...)
 */
export async function createOfflineTileUrl(
  url: string,
  z: number,
  x: number,
  y: number,
): Promise<string> {
  const key = `tile_${z}_${x}_${y}`
  try {
    const blob = await getTile(key)
    if (blob) {
      return URL.createObjectURL(blob)
    }
  } catch {
    // Fall through to online URL
  }
  return url
}

/**
 * Hook to intercept Leaflet tile loading to use offline tiles when available.
 */
export function useOfflineTileInterceptor() {
  const interceptTile = useCallback(
    async (z: number, x: number, y: number, onlineUrl: string): Promise<string> => {
      const key = `tile_${z}_${x}_${y}`
      try {
        const blob = await getTile(key)
        if (blob) {
          return URL.createObjectURL(blob)
        }
      } catch {
        // Fall through
      }
      return onlineUrl
    },
    [],
  )

  return { interceptTile }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OfflineMapRegion {
  id: string
  name: string
  bounds: { north: number; south: number; east: number; west: number }
  zoomLevels: string
  estimatedSizeMB: number
  downloaded: boolean
  downloadedAt: string | null
}

interface TileInfo {
  z: number
  x: number
  y: number
  url: string
  key: string
}

interface DownloadState {
  regionId: string
  totalTiles: number
  completedTiles: number
  failedTiles: number
  phase: 'fetching' | 'downloading' | 'done'
}

interface Props {
  userId?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OfflineMapsManager({ userId }: Props) {
  const [regions, setRegions] = useState<OfflineMapRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [storageInfo, setStorageInfo] = useState<{ usedBytes: number; tileCount: number }>({
    usedBytes: 0,
    tileCount: 0,
  })
  const abortRef = useRef<AbortController | null>(null)

  const fetchRegions = useCallback(async () => {
    setLoading(true)
    try {
      const url = userId ? `/api/offline-maps?userId=${userId}` : '/api/offline-maps'
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setRegions(json.data || [])
      }
    } catch {
      toast.error('Napaka pri nalaganju regij')
    }
    setLoading(false)
  }, [userId])

  const refreshStorage = useCallback(async () => {
    try {
      const info = await getStorageEstimate()
      setStorageInfo(info)
    } catch {
      // IndexedDB might not be available
    }
  }, [])

  useEffect(() => {
    fetchRegions()
    refreshStorage()
  }, [fetchRegions, refreshStorage])

  // Calculate actual region tile counts from IndexedDB
  const [regionTileCounts, setRegionTileCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    async function countTiles() {
      const counts: Record<string, number> = {}
      for (const region of regions) {
        try {
          const count = await getTileCountByPrefix(`tile_region_${region.id}_`)
          counts[region.id] = count
        } catch {
          counts[region.id] = 0
        }
      }
      if (!cancelled) {
        setRegionTileCounts(counts)
      }
    }
    if (regions.length > 0) {
      countTiles()
    }
    return () => { cancelled = true }
  }, [regions, storageInfo.tileCount])

  const handleDownload = useCallback(
    async (regionId: string) => {
      if (!userId) {
        toast.error('Prijava je potrebna za prenos')
        return
      }

      const abortController = new AbortController()
      abortRef.current = abortController

      setDownloadState({
        regionId,
        totalTiles: 0,
        completedTiles: 0,
        failedTiles: 0,
        phase: 'fetching',
      })

      try {
        // Step 1: Fetch tile list from API
        const listRes = await fetch('/api/offline-maps/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regionId }),
          signal: abortController.signal,
        })

        if (!listRes.ok) {
          const errData = await listRes.json()
          throw new Error(errData.error || 'Napaka pri pridobivanju ploščic')
        }

        const listData = await listRes.json()
        const tiles: TileInfo[] = listData.tiles
        const totalTiles = tiles.length

        if (totalTiles === 0) {
          throw new Error('Ni ploščic za prenos')
        }

        setDownloadState(prev =>
          prev ? { ...prev, totalTiles, phase: 'downloading' } : null,
        )

        // Step 2: Download tiles in batches and store in IndexedDB
        const BATCH_SIZE = 6 // Concurrent downloads
        let completed = 0
        let failed = 0

        for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
          if (abortController.signal.aborted) break

          const batch = tiles.slice(i, i + BATCH_SIZE)
          const results = await Promise.allSettled(
            batch.map(async tile => {
              // Check if already in IndexedDB
              const existingBlob = await getTile(`tile_region_${regionId}_${tile.z}_${tile.x}_${tile.y}`)
              if (existingBlob) {
                return // Already downloaded
              }

              const tileRes = await fetch(tile.url, {
                signal: abortController.signal,
                headers: {
                  'User-Agent': 'MotoTrack/1.0',
                },
              })

              if (!tileRes.ok) {
                throw new Error(`HTTP ${tileRes.status}`)
              }

              const blob = await tileRes.blob()

              // Store with region prefix for easy deletion later
              await saveTile(`tile_region_${regionId}_${tile.z}_${tile.x}_${tile.y}`, blob)
            }),
          )

          for (const result of results) {
            if (result.status === 'fulfilled') {
              completed++
            } else {
              failed++
            }
          }

          setDownloadState(prev =>
            prev
              ? { ...prev, completedTiles: completed, failedTiles: failed }
              : null,
          )

          // Small delay between batches to avoid overwhelming OSM servers
          if (i + BATCH_SIZE < tiles.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        if (!abortController.signal.aborted) {
          // Step 3: Record download in DB via existing API
          const saveRes = await fetch('/api/offline-maps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regionId, userId }),
          })

          if (saveRes.ok) {
            setDownloadState(prev =>
              prev ? { ...prev, phase: 'done' } : null,
            )
            setRegions(prev =>
              prev.map(r =>
                r.id === regionId
                  ? { ...r, downloaded: true, downloadedAt: new Date().toISOString() }
                  : r,
              ),
            )
            await refreshStorage()
            toast.success(
              `Prenos končan! ${completed}/${totalTiles} ploščic naloženih${failed > 0 ? `, ${failed} spodletelih` : ''}`,
            )
          } else {
            const errJson = await saveRes.json()
            toast.error(errJson.error || 'Napaka pri shranjevanju')
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          toast.info('Prenos preklican')
        } else {
          toast.error(err.message || 'Napaka pri prenosu')
        }
      }

      setDownloadState(null)
      abortRef.current = null
      await refreshStorage()
    },
    [userId, refreshStorage],
  )

  const handleCancelDownload = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      toast.info('Prekinjam prenos...')
    }
  }, [])

  const handleDelete = useCallback(
    async (regionId: string) => {
      if (!userId) {
        toast.error('Prijava je potrebna za brisanje')
        return
      }
      setDeleting(regionId)
      try {
        // Delete tiles from IndexedDB first
        await deleteTilesByPrefix(`tile_region_${regionId}_`)

        // Then delete metadata from server
        const res = await fetch('/api/offline-maps', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regionId, userId }),
        })

        if (res.ok) {
          setRegions(prev =>
            prev.map(r =>
              r.id === regionId
                ? { ...r, downloaded: false, downloadedAt: null }
                : r,
            ),
          )
          await refreshStorage()
          toast.success('Offline zemljevid izbrisan')
        } else {
          const json = await res.json()
          toast.error(json.error || 'Napaka pri brisanju')
        }
      } catch {
        toast.error('Napaka pri povezavi s strežnikom')
      }
      setDeleting(null)
    },
    [userId, refreshStorage],
  )

  const handleDeleteAll = useCallback(async () => {
    try {
      await deleteAllTiles()
      await refreshStorage()
      // Reset all downloaded states
      setRegions(prev => prev.map(r => ({ ...r, downloaded: false, downloadedAt: null })))
      toast.success('Vsi offline podatki izbrisani')
    } catch {
      toast.error('Napaka pri brisanju')
    }
  }, [refreshStorage])

  const formatSize = (mb: number) => {
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`
    return `${mb} MB`
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sl-SI', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const downloadProgressPercent =
    downloadState && downloadState.totalTiles > 0
      ? Math.round(
          ((downloadState.completedTiles + downloadState.failedTiles) /
            downloadState.totalTiles) *
            100,
        )
      : 0

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <WifiOff className="h-4 w-4" />
          <span className="hidden sm:inline">Offline zemljevidi</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Map className="h-5 w-5 text-amber-500" />
            Upravljanje offline zemljevidov
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Storage indicator */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Poraba prostora</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {formatBytes(storageInfo.usedBytes)} / 2.0 GB
              </Badge>
              {storageInfo.tileCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Layers className="h-3 w-3 mr-1" />
                  {storageInfo.tileCount}
                </Badge>
              )}
            </div>
          </div>
          <Progress
            value={Math.min((storageInfo.usedBytes / (2 * 1024 * 1024 * 1024)) * 100, 100)}
            className="h-2"
          />

          {/* Download progress */}
          {downloadState && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {downloadState.phase === 'fetching'
                    ? 'Pridobivam seznam ploščic...'
                    : downloadState.phase === 'downloading'
                      ? 'Prenašam ploščice...'
                      : 'Zaključujem...'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-amber-500">
                    {downloadState.totalTiles > 0
                      ? `${downloadState.completedTiles}/${downloadState.totalTiles}`
                      : '...'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                    onClick={handleCancelDownload}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Progress value={downloadProgressPercent} className="h-2" />
              {downloadState.failedTiles > 0 && (
                <p className="text-xs text-rose-400">
                  {downloadState.failedTiles} ploščic ni bilo mogoče naložiti
                </p>
              )}
            </div>
          )}

          {/* Regions list */}
          <ScrollArea className="max-h-96">
            <div className="space-y-2 pr-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : regions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Ni razpoložljivih regij
                </div>
              ) : (
                regions.map(region => (
                  <div
                    key={region.id}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      region.downloaded
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{region.name}</span>
                        {region.downloaded && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5">
                            <Check className="h-3 w-3 mr-0.5" />
                            Nameščeno
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {formatSize(region.estimatedSizeMB)}
                        </span>
                        <span className="flex items-center gap-1">
                          {region.downloaded ? (
                            <WifiOff className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Wifi className="h-3 w-3" />
                          )}
                          Zoom: {region.zoomLevels}
                        </span>
                        {region.downloaded && region.downloadedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(region.downloadedAt)}
                          </span>
                        )}
                        {regionTileCounts[region.id] > 0 && (
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {regionTileCounts[region.id]} ploščic
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {region.downloaded ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(region.id)}
                          disabled={deleting !== null || downloadState !== null}
                          className="h-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          {deleting === region.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(region.id)}
                          disabled={downloadState !== null}
                          className="h-8 gap-1"
                        >
                          {downloadState?.regionId === region.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline text-xs">
                            {downloadState?.regionId === region.id ? 'Prenašam' : 'Prenesi'}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Delete all button */}
          {storageInfo.tileCount > 0 && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteAll}
                disabled={deleting !== null || downloadState !== null}
                className="text-xs text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Izbriši vse offline podatke
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Offline zemljevidi omogočajo navigacijo brez internetne povezave
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
