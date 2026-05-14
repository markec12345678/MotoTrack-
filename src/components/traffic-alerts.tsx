'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CarFront, X, Filter, Plus, Clock, MapPin } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { TrafficAlertData } from '@/components/tabs/types'

interface TrafficAlertsProps {
  alerts: TrafficAlertData[]
  onClose?: () => void
  onReport?: (alert: TrafficAlertData) => void
}

const SEVERITY_COLORS: Record<string, string> = {
  severe: '#ef4444',
  moderate: '#f97316',
  minor: '#eab308',
}

const SEVERITY_LABELS: Record<string, string> = {
  severe: 'Hudo',
  moderate: 'Zmerno',
  minor: 'Manjše',
}

const TYPE_ICONS: Record<string, string> = {
  zastoj: '🚗',
  'nesreča': '🆘',
  dela: '🚧',
  zapora: '🚫',
}

const TYPE_LABELS: Record<string, string> = {
  zastoj: 'Zastoj',
  'nesreča': 'Nesreča',
  dela: 'Dela',
  zapora: 'Zapora',
}

export default function TrafficAlerts({ alerts, onClose, onReport }: TrafficAlertsProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportType, setReportType] = useState<string>('zastoj')
  const [reportSeverity, setReportSeverity] = useState<string>('moderate')
  const [reportTitle, setReportTitle] = useState('')
  const [reportDesc, setReportDesc] = useState('')
  const [reportRoad, setReportRoad] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false
    if (filterType !== 'all' && a.type !== filterType) return false
    return true
  })

  const handleReport = useCallback(async () => {
    if (!reportTitle.trim()) {
      toast.error('Vnesite naziv opozorila')
      return
    }
    setSubmitting(true)
    try {
      // Get current position for the report
      const getPos = (): Promise<{ lat: number; lng: number }> =>
        new Promise(resolve => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => resolve({ lat: 46.15, lng: 14.99 }),
              { timeout: 5000 }
            )
          } else {
            resolve({ lat: 46.15, lng: 14.99 })
          }
        })

      const pos = await getPos()
      const res = await fetch('/api/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          severity: reportSeverity,
          title: reportTitle.trim(),
          description: reportDesc.trim(),
          lat: pos.lat,
          lng: pos.lng,
          road: reportRoad.trim(),
        }),
      })

      if (res.ok) {
        const j = await res.json()
        toast.success('Opozorilo prijavljeno!')
        if (onReport) onReport(j.data)
        setShowReportForm(false)
        setReportTitle('')
        setReportDesc('')
        setReportRoad('')
      } else {
        toast.error('Napaka pri prijavi')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
    setSubmitting(false)
  }, [reportType, reportSeverity, reportTitle, reportDesc, reportRoad, onReport])

  const formatTime = (isoStr: string) => {
    const diff = Date.now() - new Date(isoStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Pravkar'
    if (mins < 60) return `Pred ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Pred ${hours} h`
    return `Pred ${Math.floor(hours / 24)} d`
  }

  return (
    <Card className="w-80 overflow-hidden border-primary/15">
      <div className="h-0.5 bg-gradient-to-r from-red-500/80 via-orange-400/60 to-yellow-500/40" />
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-red-500/15">
              <AlertTriangle className="size-4 text-red-500" />
            </div>
            <CardTitle className="text-sm">Prometna opozorila</CardTitle>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              {alerts.length}
            </Badge>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-3">
        {/* Filters */}
        <div className="flex items-center gap-1.5">
          <Filter className="size-3 text-muted-foreground shrink-0" />
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="h-7 text-[10px] flex-1">
              <SelectValue placeholder="Resnost" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Vse resnosti</SelectItem>
              <SelectItem value="severe" className="text-xs">🔴 Hudo</SelectItem>
              <SelectItem value="moderate" className="text-xs">🟠 Zmerno</SelectItem>
              <SelectItem value="minor" className="text-xs">🟡 Manjše</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-7 text-[10px] flex-1">
              <SelectValue placeholder="Tip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Vsi tipi</SelectItem>
              <SelectItem value="zastoj" className="text-xs">🚗 Zastoj</SelectItem>
              <SelectItem value="nesreča" className="text-xs">🆘 Nesreča</SelectItem>
              <SelectItem value="dela" className="text-xs">🚧 Dela</SelectItem>
              <SelectItem value="zapora" className="text-xs">🚫 Zapora</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alert list */}
        <ScrollArea className="max-h-64">
          <div className="space-y-2">
            {filteredAlerts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Ni prometnih opozoril</p>
            )}
            {filteredAlerts.map(alert => {
              const color = SEVERITY_COLORS[alert.severity] || '#6b7280'
              return (
                <div
                  key={alert.id}
                  className="rounded-lg border p-2.5 space-y-1.5"
                  style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">{TYPE_ICONS[alert.type] || '⚠️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight">{alert.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[8px] px-1.5 py-0 h-4"
                      style={{ borderColor: `${color}60`, color }}
                    >
                      {SEVERITY_LABELS[alert.severity]}
                    </Badge>
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4">
                      {TYPE_LABELS[alert.type]}
                    </Badge>
                    {alert.road && (
                      <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="size-2.5" />{alert.road}
                      </span>
                    )}
                    <span className="text-[8px] text-muted-foreground ml-auto flex items-center gap-0.5">
                      <Clock className="size-2.5" />{formatTime(alert.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <Separator className="opacity-30" />

        {/* Report new alert */}
        {!showReportForm ? (
          <Button
            size="sm"
            className="w-full text-[10px] gap-1.5 h-8 bg-red-500 hover:bg-red-600 text-white"
            onClick={() => setShowReportForm(true)}
          >
            <Plus className="size-3" /> Prijavi prometno opozorilo
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Novo opozorilo</span>
              <button onClick={() => setShowReportForm(false)} className="p-0.5 rounded-full hover:bg-muted">
                <X className="size-3 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[9px]">Tip</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="h-7 text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zastoj" className="text-xs">🚗 Zastoj</SelectItem>
                    <SelectItem value="nesreča" className="text-xs">🆘 Nesreča</SelectItem>
                    <SelectItem value="dela" className="text-xs">🚧 Dela</SelectItem>
                    <SelectItem value="zapora" className="text-xs">🚫 Zapora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px]">Resnost</Label>
                <Select value={reportSeverity} onValueChange={setReportSeverity}>
                  <SelectTrigger className="h-7 text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="severe" className="text-xs">🔴 Hudo</SelectItem>
                    <SelectItem value="moderate" className="text-xs">🟠 Zmerno</SelectItem>
                    <SelectItem value="minor" className="text-xs">🟡 Manjše</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input
              placeholder="Naziv opozorila"
              value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              className="h-7 text-[10px]"
            />
            <Input
              placeholder="Cesta (opcijsko)"
              value={reportRoad}
              onChange={e => setReportRoad(e.target.value)}
              className="h-7 text-[10px]"
            />
            <Input
              placeholder="Opis (opcijsko)"
              value={reportDesc}
              onChange={e => setReportDesc(e.target.value)}
              className="h-7 text-[10px]"
            />
            <Button
              size="sm"
              className="w-full text-[10px] gap-1 h-7 bg-red-500 hover:bg-red-600 text-white"
              onClick={handleReport}
              disabled={submitting}
            >
              <Plus className="size-3" /> {submitting ? 'Pošiljam...' : 'Pošlji opozorilo'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
