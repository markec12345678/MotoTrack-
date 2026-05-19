'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  XCircle,
  ChevronDown,
  ChevronUp,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Map,
} from 'lucide-react'
import { toast } from 'sonner'
import { saveTile, getTile, getStorageEstimate, checkLowStorage } from '@/lib/offline-protocol'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TileCoordinate {
  z: number
  x: number
  y: number
}

interface TileTask extends TileCoordinate {
  url: string
  key: string
}

interface Props {
  waypoints: Array<{ lat: number; lng: number }>
}

// ─── Tile math helpers ────────────────────────────────────────────────────────

/** Convert lat/lng to tile X/Y at a given zoom level */
function latLngToTile(lat: number, lng: number, zoom: number): { tx: number; ty: number } {
  const tx = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
  const latRad = (lat * Math.PI) / 180
  const ty = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  )
  return { tx, ty }
}

/** Calculate bounding box of waypoints + buffer in km */
function calculateBBox(
  waypoints: Array<{ lat: number; lng: number }>,
  bufferKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const wp of waypoints) {
    if (wp.lat < minLat) minLat = wp.lat
    if (wp.lat > maxLat) maxLat = wp.lat
    if (wp.lng < minLng) minLng = wp.lng
    if (wp.lng > maxLng) maxLng = wp.lng
  }

  // Convert buffer km to degrees: 1° ≈ 111km
  const bufferLat = bufferKm / 111
  // Longitude degrees shrink with latitude
  const avgLat = (minLat + maxLat) / 2
  const bufferLng = bufferKm / (111 * Math.cos((avgLat * Math.PI) / 180))

  return {
    minLat: minLat - bufferLat,
    maxLat: maxLat + bufferLat,
    minLng: minLng - bufferLng,
    maxLng: maxLng + bufferLng,
  }
}

/** Generate all tile coordinates for a bounding box across zoom levels */
function generateTileList(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  minZoom: number,
  maxZoom: number
): TileCoordinate[] {
  const tiles: TileCoordinate[] = []

  for (let z = minZoom; z <= maxZoom; z++) {
    const topLeft = latLngToTile(bbox.maxLat, bbox.minLng, z)
    const bottomRight = latLngToTile(bbox.minLat, bbox.maxLng, z)

    // Clamp tile Y to valid range [0, 2^zoom - 1]
    const maxTileY = Math.pow(2, z) - 1
    const minY = Math.max(0, topLeft.ty)
    const maxY = Math.min(maxTileY, bottomRight.ty)

    for (let x = topLeft.tx; x <= bottomRight.tx; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ z, x, y })
      }
    }
  }

  return tiles
}

/** Generate tile URL (CartoDB light as primary, OSM as fallback) */
function getTileUrl(z: number, x: number, y: number, source: 'cartodb' | 'osm'): string {
  if (source === 'cartodb') {
    return `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`
  }
  return `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVG_TILE_SIZE_KB = 15
const MAX_CONCURRENT = 4
const BATCH_DELAY_MS = 100

// ─── Component ────────────────────────────────────────────────────────────────

export default function RouteTilePreloader({ waypoints }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [bufferKm, setBufferKm] = useState(5)
  const [minZoom, setMinZoom] = useState(10)
  const [maxZoom, setMaxZoom] = useState(15)
  const [downloading, setDownloading] = useState(false)
  const [completedTiles, setCompletedTiles] = useState(0)
  const [failedTiles, setFailedTiles] = useState(0)
  const [totalTiles, setTotalTiles] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [completedSizeMB, setCompletedSizeMB] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const timestampRef = useRef<number>(0)

  // Calculate estimated tile count and size
  const estimate = useMemo(() => {
    if (waypoints.length < 2) return { tileCount: 0, sizeMB: 0 }

    const bbox = calculateBBox(waypoints, bufferKm)
    const tiles = generateTileList(bbox, minZoom, maxZoom)
    const tileCount = tiles.length
    const sizeMB = Math.round((tileCount * AVG_TILE_SIZE_KB) / 1024 * 10) / 10

    return { tileCount, sizeMB }
  }, [waypoints, bufferKm, minZoom, maxZoom])

  const handleDownload = useCallback(async () => {
    if (waypoints.length < 2) return

    // Check storage
    const lowStorage = await checkLowStorage()
    if (lowStorage) {
      toast.error('Premalo prostora za prenos! Manj kot 100MB na voljo.')
      return
    }

    const abortController = new AbortController()
    abortRef.current = abortController
    timestampRef.current = Date.now()

    setDownloading(true)
    setCompleted(false)
    setCompletedTiles(0)
    setFailedTiles(0)

    const bbox = calculateBBox(waypoints, bufferKm)
    const tiles = generateTileList(bbox, minZoom, maxZoom)
    const timestamp = timestampRef.current

    // Build task list
    const tasks: TileTask[] = tiles.map((t) => ({
      ...t,
      url: getTileUrl(t.z, t.x, t.y, 'cartodb'),
      key: `tile_route_${timestamp}_${t.z}_${t.x}_${t.y}`,
    }))

    setTotalTiles(tasks.length)

    let completed = 0
    let failed = 0
    let totalBytes = 0

    // Process in batches of MAX_CONCURRENT
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENT) {
      if (abortController.signal.aborted) break

      const batch = tasks.slice(i, i + MAX_CONCURRENT)
      const results = await Promise.allSettled(
        batch.map(async (task) => {
          // Check if already in IndexedDB
          try {
            const existing = await getTile(task.key)
            if (existing) {
              // Already cached, count as completed but don't re-download
              return existing.size
            }
          } catch {
            // Ignore errors checking, proceed with download
          }

          try {
            // Try CartoDB first
            const res = await fetch(task.url, {
              signal: abortController.signal,
              headers: {
                'User-Agent': 'MotoTrack/1.0',
              },
            })

            if (!res.ok) {
              // Fallback to OSM
              const osmUrl = getTileUrl(task.z, task.x, task.y, 'osm')
              const osmRes = await fetch(osmUrl, {
                signal: abortController.signal,
              })
              if (!osmRes.ok) {
                throw new Error(`HTTP ${osmRes.status}`)
              }
              const blob = await osmRes.blob()
              await saveTile(task.key, blob)
              return blob.size
            }

            const blob = await res.blob()
            await saveTile(task.key, blob)
            return blob.size
          } catch (err: unknown) {
            if (abortController.signal.aborted) throw err
            throw err
          }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          completed++
          if (typeof result.value === 'number') {
            totalBytes += result.value
          }
        } else {
          // Don't count aborted as failed
          if (!abortController.signal.aborted) {
            failed++
          }
        }
      }

      setCompletedTiles(completed)
      setFailedTiles(failed)

      // Delay between batches (respect OSM tile usage policy)
      if (i + MAX_CONCURRENT < tasks.length && !abortController.signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    if (!abortController.signal.aborted) {
      const sizeMB = Math.round((totalBytes / (1024 * 1024)) * 10) / 10
      setCompleted(true)
      setCompletedCount(completed)
      setCompletedSizeMB(sizeMB)
      toast.success(`${completed} ploščic naloženih (~${sizeMB} MB). Zemljevid bo na voljo offline ob poti.`)
    } else {
      toast.info('Prenos preklican')
    }

    setDownloading(false)
    abortRef.current = null
  }, [waypoints, bufferKm, minZoom, maxZoom])

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      toast.info('Prekinjam prenos...')
    }
  }, [])

  const progressPercent =
    totalTiles > 0 ? Math.round(((completedTiles + failedTiles) / totalTiles) * 100) : 0

  // Determine color state
  const statusColor = completed
    ? 'border-emerald-500/30 bg-emerald-500/5'
    : downloading
      ? 'border-amber-500/30 bg-amber-500/5'
      : 'border-border/50'

  const headerColor = completed
    ? 'text-emerald-600 dark:text-emerald-400'
    : downloading
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-foreground'

  return (
    <div className={`rounded-lg border ${statusColor} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-xs font-semibold"
          onClick={() => setExpanded(!expanded)}
        >
          {completed ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : downloading ? (
            <Loader2 className="size-4 text-amber-500 animate-spin" />
          ) : (
            <WifiOff className="size-4 text-muted-foreground" />
          )}
          <span className={headerColor}>Offline ploščice</span>
          {completed && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5">
              <CheckCircle2 className="size-3 mr-0.5" />
              Naloženo
            </Badge>
          )}
          {downloading && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5">
              <Loader2 className="size-3 mr-0.5 animate-spin" />
              Prenašam
            </Badge>
          )}
        </button>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      {/* Collapsible content */}
      {expanded && (
        <div className="space-y-3 pt-1">
          {/* Completed message */}
          {completed && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2.5">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                ✅ {completedCount} ploščic naloženih (~{completedSizeMB} MB). Zemljevid bo na voljo offline ob poti.
              </p>
            </div>
          )}

          {/* Download progress */}
          {downloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  Prenašam ploščice... {completedTiles}/{totalTiles} ({progressPercent}%)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                  onClick={handleCancel}
                >
                  <XCircle className="size-4" />
                </Button>
              </div>
              <Progress value={progressPercent} className="h-2" />
              {failedTiles > 0 && (
                <p className="text-[10px] text-rose-400">
                  {failedTiles} ploščic ni bilo mogoče naložiti
                </p>
              )}
            </div>
          )}

          {/* Configuration - only show when not downloading */}
          {!downloading && !completed && (
            <>
              {/* Buffer distance */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-muted-foreground">Medpomnilnik ob poti</label>
                  <span className="text-xs font-bold text-primary">{bufferKm} km</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={bufferKm}
                  onChange={(e) => setBufferKm(Number(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>1 km</span>
                  <span>10 km</span>
                  <span>20 km</span>
                </div>
              </div>

              {/* Zoom levels */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-muted-foreground">Raven približanja</label>
                  <span className="text-xs font-bold text-primary">{minZoom}–{maxZoom}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Min zoom</label>
                    <select
                      value={minZoom}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setMinZoom(val)
                        if (val > maxZoom) setMaxZoom(val)
                      }}
                      className="w-full text-xs bg-secondary/50 rounded-md px-2 py-1.5 border border-border/50"
                    >
                      {[8, 9, 10, 11, 12].map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Max zoom</label>
                    <select
                      value={maxZoom}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setMaxZoom(val)
                        if (val < minZoom) setMinZoom(val)
                      }}
                      className="w-full text-xs bg-secondary/50 rounded-md px-2 py-1.5 border border-border/50"
                    >
                      {[12, 13, 14, 15, 16].map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Estimate */}
              {estimate.tileCount > 0 && (
                <div className="bg-secondary/50 rounded-md p-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Map className="size-3.5" />
                    <span>Ocenjeno:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {estimate.tileCount} ploščic
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      ~{estimate.sizeMB} MB
                    </Badge>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
                <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Prenos lahko traja več minut. Prepričajte se, da imate WiFi povezavo.
                </p>
              </div>

              {/* Download button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                size="sm"
                disabled={downloading || estimate.tileCount === 0}
                onClick={handleDownload}
              >
                <Download className="size-3.5 mr-1.5" />
                Prenesi ploščice za ruto
              </Button>
            </>
          )}

          {/* Re-download button after completion */}
          {completed && !downloading && (
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => {
                setCompleted(false)
                setCompletedTiles(0)
                setFailedTiles(0)
                setTotalTiles(0)
              }}
            >
              <Download className="size-3.5 mr-1.5" />
              Prenesi znova
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
