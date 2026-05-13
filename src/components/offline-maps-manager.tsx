'use client'

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { OfflineMapRegion } from '@/components/tabs/types'
import {
  Download,
  Trash2,
  Map,
  HardDrive,
  Wifi,
  WifiOff,
  Check,
  Loader2,
} from 'lucide-react'

// Default offline map regions for Slovenia
const DEFAULT_REGIONS: OfflineMapRegion[] = [
  {
    id: 'slovenia-full',
    name: 'Slovenija (celotna)',
    bounds: { north: 46.88, south: 45.42, east: 16.61, west: 13.38 },
    zoomLevels: '6-15',
    estimatedSizeMB: 850,
    downloaded: false,
  },
  {
    id: 'ljubljana-region',
    name: 'Ljubljana in okolica',
    bounds: { north: 46.25, south: 45.95, east: 14.85, west: 14.25 },
    zoomLevels: '10-17',
    estimatedSizeMB: 220,
    downloaded: false,
  },
  {
    id: 'gorenjska',
    name: 'Gorenjska (Julijske Alpe)',
    bounds: { north: 46.65, south: 46.15, east: 14.45, west: 13.65 },
    zoomLevels: '10-16',
    estimatedSizeMB: 310,
    downloaded: false,
  },
  {
    id: 'primorska',
    name: 'Primorska in Obala',
    bounds: { north: 46.05, south: 45.45, east: 14.25, west: 13.38 },
    zoomLevels: '10-16',
    estimatedSizeMB: 280,
    downloaded: false,
  },
  {
    id: 'stajerska',
    name: 'Štajerska in Koroška',
    bounds: { north: 46.75, south: 46.35, east: 16.10, west: 15.05 },
    zoomLevels: '10-16',
    estimatedSizeMB: 290,
    downloaded: false,
  },
  {
    id: 'dolenjska',
    name: 'Dolenjska in Bela Krajina',
    bounds: { north: 46.05, south: 45.42, east: 15.70, west: 14.70 },
    zoomLevels: '10-16',
    estimatedSizeMB: 260,
    downloaded: false,
  },
]

export default function OfflineMapsManager() {
  const [regions, setRegions] = useState<OfflineMapRegion[]>(DEFAULT_REGIONS)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  const totalDownloaded = regions
    .filter(r => r.downloaded)
    .reduce((sum, r) => sum + r.estimatedSizeMB, 0)

  const simulateDownload = useCallback((regionId: string) => {
    setDownloading(regionId)
    setDownloadProgress(0)

    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        setRegions(prev =>
          prev.map(r => (r.id === regionId ? { ...r, downloaded: true } : r))
        )
        setDownloading(null)
        setDownloadProgress(0)
      }
      setDownloadProgress(Math.round(progress))
    }, 300)
  }, [])

  const handleDelete = useCallback((regionId: string) => {
    setRegions(prev =>
      prev.map(r => (r.id === regionId ? { ...r, downloaded: false } : r))
    )
  }, [])

  const formatSize = (mb: number) => {
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`
    return `${mb} MB`
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
              {regions.map(region => (
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
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {region.downloaded ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(region.id)}
                        className="h-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => simulateDownload(region.id)}
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
              ))}
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
