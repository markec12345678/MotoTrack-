/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  Construction,
  Car,
  Ban,
  Activity,
  RefreshCw,
  Plus,
  X,
  Clock,
  MapPin,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Rahlo',
  medium: 'Zmerno',
  high: 'Hudo',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  construction: <Construction className="size-3" />,
  accident: <AlertTriangle className="size-3" />,
  delay: <Car className="size-3" />,
  closure: <Ban className="size-3" />,
}

const TYPE_LABELS: Record<string, string> = {
  construction: 'Gradbena dela',
  accident: 'Nesreča',
  delay: 'Zastoj',
  closure: 'Zaprto',
}

interface TrafficIncident {
  id: string
  type: string
  description: string
  lat: number
  lng: number
  severity: string
  updatedAt: string
}

interface Props {
  lat?: number
  lng?: number
  enabled?: boolean
  onToggle?: (v: boolean) => void
  userId?: string
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'Pravkar'
  if (diff < 3600) return `Pred ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Pred ${Math.floor(diff / 3600)} h`
  return `Pred ${Math.floor(diff / 86400)} d`
}

export default function TrafficOverlay({ lat = 46.15, lng = 14.99, enabled = false, onToggle, userId }: Props) {
  const [incidents, setIncidents] = useState<TrafficIncident[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [showReportForm, setShowReportForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reportType, setReportType] = useState<string>('delay')
  const [reportSeverity, setReportSeverity] = useState<string>('medium')
  const [reportDescription, setReportDescription] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTraffic = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/traffic?lat=${lat}&lng=${lng}&radius=50`)
      if (res.ok) {
        const json = await res.json()
        setIncidents(json.data || [])
        setLastUpdated(json.lastUpdated || new Date().toISOString())
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [lat, lng])

  // Fetch on enable and poll every 60 seconds
  useEffect(() => {
    if (enabled) {
      fetchTraffic()
      pollRef.current = setInterval(fetchTraffic, 60000)
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [enabled, fetchTraffic])

  const handleReport = useCallback(async () => {
    if (!reportDescription.trim()) {
      toast.error('Opis je obvezen')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          description: reportDescription.trim(),
          severity: reportSeverity,
          lat,
          lng,
          userId: userId || null,
        }),
      })

      if (res.ok) {
        toast.success('Prometni dogodek prijavljen!')
        setShowReportForm(false)
        setReportDescription('')
        setReportType('delay')
        setReportSeverity('medium')
        // Refresh the list
        fetchTraffic()
      } else {
        const json = await res.json()
        toast.error(json.error || 'Napaka pri prijavi')
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
    }
    setSubmitting(false)
  }, [reportType, reportDescription, reportSeverity, lat, lng, userId, fetchTraffic])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-orange-500" />
          <span className="text-sm font-semibold">Promet v živo</span>
          {incidents.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {incidents.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {enabled && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={fetchTraffic}
                disabled={loading}
              >
                <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setShowReportForm(prev => !prev)}
                title="Prijavi prometni dogodek"
              >
                {showReportForm ? <X className="size-3" /> : <Plus className="size-3" />}
              </Button>
            </>
          )}
          <Switch
            checked={enabled}
            onCheckedChange={onToggle || (() => {})}
            className="scale-75"
          />
        </div>
      </div>

      {/* Last updated timestamp */}
      {enabled && lastUpdated && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="size-2.5" />
          <span>Zadnja posodobitev: {timeAgo(lastUpdated)}</span>
        </div>
      )}

      {/* Report form */}
      {enabled && showReportForm && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
          <div className="text-xs font-semibold text-orange-400 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            Prijavi prometni dogodek
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Tip</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="construction">🏗️ Gradbena dela</SelectItem>
                    <SelectItem value="accident">⚠️ Nesreča</SelectItem>
                    <SelectItem value="delay">🚗 Zastoj</SelectItem>
                    <SelectItem value="closure">🚫 Zaprto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Resnost</Label>
                <Select value={reportSeverity} onValueChange={setReportSeverity}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟡 Rahlo</SelectItem>
                    <SelectItem value="medium">🟠 Zmerno</SelectItem>
                    <SelectItem value="high">🔴 Hudo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px]">Opis</Label>
              <Input
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
                placeholder="Opišite prometni dogodek..."
                className="h-7 text-xs"
                maxLength={200}
              />
            </div>

            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="size-2.5" />
              <span>Lokacija: {lat.toFixed(4)}, {lng.toFixed(4)}</span>
            </div>

            <Button
              size="sm"
              className="w-full h-7 text-xs gap-1"
              onClick={handleReport}
              disabled={submitting || !reportDescription.trim()}
            >
              {submitting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Pošlji prijavo
            </Button>
          </div>
        </div>
      )}

      {/* Incidents list */}
      {enabled && incidents.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {incidents.map(inc => (
            <div
              key={inc.id}
              className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                inc.severity === 'high'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : inc.severity === 'medium'
                    ? 'bg-orange-500/10 border border-orange-500/20'
                    : 'bg-muted/50'
              }`}
            >
              <div className="mt-0.5 text-muted-foreground">
                {TYPE_ICONS[inc.type] || <AlertTriangle className="size-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate">{inc.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={`${SEVERITY_COLORS[inc.severity] || ''} text-[10px] px-1.5 py-0`}
                  >
                    {SEVERITY_LABELS[inc.severity] || inc.severity}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="size-2" />
                    {timeAgo(inc.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state when enabled */}
      {enabled && incidents.length === 0 && !loading && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          Ni prometnih dogodkov v bližini
        </div>
      )}
    </div>
  )
}
