/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useState, useCallback, useEffect } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'

interface OfflineMapRegion {
  id: string
  name: string
  bounds: { north: number; south: number; east: number; west: number }
  zoomLevels: string
  estimatedSizeMB: number
  downloaded: boolean
  downloadedAt: string | null
}

interface Props {
  userId?: string
}

export default function OfflineMapsManager({ userId }: Props) {
  const [regions, setRegions] = useState<OfflineMapRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)

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

  useEffect(() => {
    fetchRegions()
  }, [fetchRegions])

  const totalDownloaded = regions
    .filter(r => r.downloaded)
    .reduce((sum, r) => sum + r.estimatedSizeMB, 0)

  const handleDownload = useCallback(async (regionId: string) => {
    if (!userId) {
      toast.error('Prijava je potrebna za prenos')
      return
    }
    setDownloading(regionId)
    setDownloadProgress(0)

    // Simulate progress while the API request is in flight
    let progress = 0
    const progressInterval = setInterval(() => {
      progress += Math.random() * 10 + 2
      if (progress > 90) progress = 90
      setDownloadProgress(Math.round(progress))
    }, 300)

    try {
      const res = await fetch('/api/offline-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionId, userId }),
      })

      clearInterval(progressInterval)

      if (res.ok) {
        setDownloadProgress(100)
        // Small delay to show 100%
        await new Promise(resolve => setTimeout(resolve, 500))
        setRegions(prev =>
          prev.map(r =>
            r.id === regionId
              ? { ...r, downloaded: true, downloadedAt: new Date().toISOString() }
              : r
          )
        )
        toast.success('Zemljevid uspešno prenesen!')
      } else {
        const json = await res.json()
        toast.error(json.error || 'Napaka pri prenosu')
      }
    } catch {
      clearInterval(progressInterval)
      toast.error('Napaka pri povezavi s strežnikom')
    }

    setDownloading(null)
    setDownloadProgress(0)
  }, [userId])

  const handleDelete = useCallback(async (regionId: string) => {
    if (!userId) {
      toast.error('Prijava je potrebna za brisanje')
      return
    }
    setDeleting(regionId)
    try {
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
              : r
          )
        )
        toast.success('Offline zemljevid izbrisan')
      } else {
        const json = await res.json()
        toast.error(json.error || 'Napaka pri brisanju')
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    }
    setDeleting(null)
  }, [userId])

  const formatSize = (mb: number) => {
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`
    return `${mb} MB`
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
            <Badge variant="outline" className="text-xs">
              {formatSize(totalDownloaded)} / 2.0 GB
            </Badge>
          </div>
          <Progress
            value={(totalDownloaded / 2000) * 100}
            className="h-2"
          />

          {/* Download progress */}
          {downloading && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Prenašam...
                </span>
                <span className="text-sm text-amber-500">{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
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
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {region.downloaded ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(region.id)}
                          disabled={deleting !== null}
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
                          disabled={downloading !== null}
                          className="h-8 gap-1"
                        >
                          {downloading === region.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline text-xs">
                            {downloading === region.id ? 'Prenašam' : 'Prenesi'}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <p className="text-xs text-muted-foreground text-center">
            Offline zemljevidi omogočajo navigacijo brez internetne povezave
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
