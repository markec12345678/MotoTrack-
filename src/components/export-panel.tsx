'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  X, Download, FileText, Globe, Map, Table,
  Copy, Check, Loader2, ChevronDown, ChevronUp,
  Activity, Mountain, Gauge, Clock,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface ExportPanelProps {
  rideId?: string
  routeId?: string
  trackData?: Array<{ lat: number; lng: number; alt: number | null; speed: number | null; timestamp: number }>
  rideName?: string
  rideDate?: string
  totalDistance?: number    // km
  totalDuration?: number   // seconds
  isOpen: boolean
  onClose: () => void
  className?: string
}

interface FormatOption {
  id: string
  name: string
  extension: string
  description: string
  platforms: string[]
  icon: React.ReactNode
  colorClass: string
  contentTypes: string
}

const FORMATS: FormatOption[] = [
  {
    id: 'gpx',
    name: 'GPX',
    extension: 'gpx',
    description: 'Splošni format za GPS podatke, združljiv z večino naprav in aplikacij',
    platforms: ['OsmAnd', 'Kurviger', 'REVER', 'Calimoto'],
    icon: <Globe className="size-5" />,
    colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    contentTypes: 'application/gpx+xml',
  },
  {
    id: 'tcx',
    name: 'TCX',
    extension: 'tcx',
    description: 'Training Center XML — Strava najprimernejši format s hitrostjo, višino in krogi',
    platforms: ['Strava', 'Garmin Connect', 'TrainingPeaks'],
    icon: <Activity className="size-5" />,
    colorClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    contentTypes: 'application/vnd.garmin.tcx+xml',
  },
  {
    id: 'kml',
    name: 'KML',
    extension: 'kml',
    description: 'Keyhole Markup Language — vizualizacija v Google Earth in zemljevidih',
    platforms: ['Google Earth', 'Google Maps', 'Marble'],
    icon: <Map className="size-5" />,
    colorClass: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    contentTypes: 'application/vnd.google-earth.kml+xml',
  },
  {
    id: 'csv',
    name: 'CSV',
    extension: 'csv',
    description: 'Surovi podatki za analizo v preglednicah (Excel, LibreOffice Calc)',
    platforms: ['Excel', 'LibreOffice', 'Google Sheets'],
    icon: <Table className="size-5" />,
    colorClass: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    contentTypes: 'text/csv',
  },
]

const ACTIVITY_TYPES = [
  { value: 'Biking', label: 'Motoristična vožnja' },
  { value: 'Cycling', label: 'Kolesarjenje' },
  { value: 'Driving', label: 'Vožnja z avtom' },
] as const

export default function ExportPanel({
  rideId,
  routeId,
  trackData,
  rideName = 'MotoTrack vožnja',
  rideDate,
  totalDistance,
  totalDuration,
  isOpen,
  onClose,
  className,
}: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>('tcx')
  const [includeWaypoints, setIncludeWaypoints] = useState(true)
  const [includeSpeed, setIncludeSpeed] = useState(true)
  const [includeElevation, setIncludeElevation] = useState(true)
  const [activityType, setActivityType] = useState<string>('Biking')
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  // Estimate point count and file size
  const pointCount = useMemo(() => trackData?.length ?? 0, [trackData])
  const estimatedSize = useMemo(() => {
    if (!selectedFormat || !pointCount) return '~1 KB'
    const bytesPerPoint: Record<string, number> = {
      gpx: 120,
      tcx: 250,
      kml: 60,
      csv: 70,
    }
    const bpe = bytesPerPoint[selectedFormat] || 100
    const bytes = pointCount * bpe + 500 // overhead
    if (bytes < 1024) return `~${bytes} B`
    if (bytes < 1024 * 1024) return `~${(bytes / 1024).toFixed(1)} KB`
    return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }, [selectedFormat, pointCount])

  const buildExportUrl = useCallback((format: string) => {
    const params = new URLSearchParams()
    if (rideId) params.set('rideId', rideId)
    if (routeId) params.set('routeId', routeId)
    params.set('format', format)
    params.set('activityType', activityType)
    params.set('includeSpeed', String(includeSpeed))
    params.set('includeElevation', String(includeElevation))
    params.set('includeWaypoints', String(includeWaypoints))
    return `/api/export?${params.toString()}`
  }, [rideId, routeId, activityType, includeSpeed, includeElevation, includeWaypoints])

  const handleExport = useCallback(async () => {
    if (!selectedFormat) return
    setExporting(true)
    try {
      const url = buildExportUrl(selectedFormat)
      const res = await fetch(url)
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Napaka pri izvozu' }))
        toast.error(j.error || 'Napaka pri izvozu')
        return
      }
      // Get the blob and trigger download
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition')
      let filename = `MotoTrack_voznja.${FORMATS.find(f => f.id === selectedFormat)?.extension || 'gpx'}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match) filename = match[1].replace(/['"]/g, '')
      }
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
      toast.success(`Izvoz ${selectedFormat.toUpperCase()} uspešen!`)
    } catch {
      toast.error('Napaka pri izvozu datoteke')
    } finally {
      setExporting(false)
    }
  }, [selectedFormat, buildExportUrl])

  const handleCopyLink = useCallback(async () => {
    const url = buildExportUrl(selectedFormat)
    try {
      await navigator.clipboard.writeText(window.location.origin + url)
      setCopied(true)
      toast.success('Povezava kopirana!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Napaka pri kopiranju povezave')
    }
  }, [selectedFormat, buildExportUrl])

  const selectedFormatObj = FORMATS.find(f => f.id === selectedFormat)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className={`sm:max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden ${className || ''}`}>
        <DialogTitle className="sr-only">Izvozi vožnjo</DialogTitle>

        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-card to-card p-4 pb-3">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 size-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-muted transition-colors z-10"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/20 text-primary">
              <Download className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg leading-tight truncate">Izvozi</h2>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{rideName}</p>
            </div>
          </div>

          {/* Quick stats */}
          {(totalDistance || totalDuration) && (
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {totalDistance != null && (
                <span className="flex items-center gap-1">
                  <Gauge className="size-3" /> {totalDistance.toFixed(1)} km
                </span>
              )}
              {totalDuration != null && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {Math.floor(totalDuration / 60)} min
                </span>
              )}
              {pointCount > 0 && (
                <span className="flex items-center gap-1">
                  <Map className="size-3" /> {pointCount} točk
                </span>
              )}
            </div>
          )}
        </div>

        {/* Format selection */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Izberi format
          </h3>

          <div className="grid gap-2.5">
            {FORMATS.map((fmt) => {
              const isSelected = selectedFormat === fmt.id
              return (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/50 hover:border-border hover:bg-secondary/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${fmt.colorClass}`}>
                      {fmt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{fmt.name}</span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          .{fmt.extension}
                        </Badge>
                        {fmt.id === 'tcx' && (
                          <Badge className="text-[8px] px-1.5 py-0 bg-orange-500/20 text-orange-400 border-orange-500/30">
                            Strava
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {fmt.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {fmt.platforms.map((p) => (
                          <span key={p} className="text-[9px] text-muted-foreground/70 bg-secondary/50 rounded px-1.5 py-0.5">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                    }`}>
                      {isSelected && <Check className="size-3 text-primary-foreground" />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <Separator />

          {/* Export options */}
          <div>
            <button
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => setShowOptions(!showOptions)}
            >
              {showOptions ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              Možnosti izvoza
            </button>

            {showOptions && (
              <div className="mt-3 space-y-3 rounded-xl border border-border/50 p-3">
                {/* Activity type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Vrsta aktivnosti</label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((at) => (
                        <SelectItem key={at.value} value={at.value} className="text-xs">
                          {at.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Checkboxes */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-waypoints"
                      checked={includeWaypoints}
                      onCheckedChange={(checked) => setIncludeWaypoints(checked === true)}
                      className="size-4"
                    />
                    <label htmlFor="include-waypoints" className="text-xs cursor-pointer flex items-center gap-1.5">
                      <Map className="size-3 text-muted-foreground" />
                      Vključi točke poti (waypoints)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-speed"
                      checked={includeSpeed}
                      onCheckedChange={(checked) => setIncludeSpeed(checked === true)}
                      className="size-4"
                    />
                    <label htmlFor="include-speed" className="text-xs cursor-pointer flex items-center gap-1.5">
                      <Gauge className="size-3 text-muted-foreground" />
                      Vključi podatke o hitrosti
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-elevation"
                      checked={includeElevation}
                      onCheckedChange={(checked) => setIncludeElevation(checked === true)}
                      className="size-4"
                    />
                    <label htmlFor="include-elevation" className="text-xs cursor-pointer flex items-center gap-1.5">
                      <Mountain className="size-3 text-muted-foreground" />
                      Vključi podatke o nadmorski višini
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Preview section */}
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Predogled izvoza
            </h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-sm font-bold">{pointCount > 0 ? pointCount.toLocaleString() : '—'}</p>
                <p className="text-[10px] text-muted-foreground">GPS točk</p>
              </div>
              <div>
                <p className="text-sm font-bold">{estimatedSize}</p>
                <p className="text-[10px] text-muted-foreground">Velikost</p>
              </div>
              <div>
                <p className="text-sm font-bold">{selectedFormatObj?.name || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Format</p>
              </div>
            </div>
            {selectedFormat === 'tcx' && (
              <div className="mt-2 rounded-lg bg-orange-500/10 border border-orange-500/20 p-2">
                <p className="text-[10px] text-orange-400 flex items-center gap-1">
                  <Activity className="size-3" />
                  Strava: Hitrost v m/s, čas v UTC, krogi po segmentih
                </p>
              </div>
            )}
            {selectedFormat === 'kml' && (
              <div className="mt-2 rounded-lg bg-sky-500/10 border border-sky-500/20 p-2">
                <p className="text-[10px] text-sky-400 flex items-center gap-1">
                  <Map className="size-3" />
                  Google Earth: Koordinate v vrstnem redu lng,lat,alt
                </p>
              </div>
            )}
            {selectedFormat === 'csv' && (
              <div className="mt-2 rounded-lg bg-violet-500/10 border border-violet-500/20 p-2">
                <p className="text-[10px] text-violet-400 flex items-center gap-1">
                  <Table className="size-3" />
                  Evropski format: ločilo je podpičje (;)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border/30 bg-card">
          <div className="flex items-center gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={handleExport}
              disabled={exporting || (!rideId && !routeId)}
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exporting ? 'Izvažam...' : `Prenesi ${selectedFormatObj?.name || ''}`}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              title="Kopiraj povezavo"
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            {rideId ? 'Vožnja' : 'Pot'} bo izvožena v izbranem formatu
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
