'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Cloud, AlertTriangle, Wind, Thermometer, CloudRain, Snowflake, Eye, Zap, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { WeatherAlert } from '@/components/tabs/types'

interface WeatherAlertsPanelProps {
  lat: number | null
  lng: number | null
  isTracking?: boolean
}

const alertIcons: Record<string, React.ReactNode> = {
  wind: <Wind className="size-4" />,
  rain: <CloudRain className="size-4" />,
  storm: <Zap className="size-4" />,
  ice: <Snowflake className="size-4" />,
  fog: <Eye className="size-4" />,
  heat: <Thermometer className="size-4" />,
  snow: <Snowflake className="size-4" />,
}

const severityColors: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  extreme: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const severityLabels: Record<string, string> = {
  low: 'Nizko',
  medium: 'Zmerno',
  high: 'Visoko',
  extreme: 'Ekstremno',
}

export default function WeatherAlertsPanel({ lat, lng, isTracking }: WeatherAlertsPanelProps) {
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAlerts = useCallback(async () => {
    if (!lat || !lng) return
    setLoading(true)
    try {
      const res = await fetch(`/api/weather-alerts?lat=${lat}&lng=${lng}&radius=100`)
      if (res.ok) {
        const j = await res.json()
        setAlerts(j.data || [])
      }
    } catch {
      // silent fail
    }
    setLoading(false)
  }, [lat, lng])

  // Fetch on mount and when coords change
  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // Auto-refresh every 10 minutes when tracking
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (isTracking && lat && lng) {
      intervalRef.current = setInterval(fetchAlerts, 600000) // 10 min
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isTracking, lat, lng, fetchAlerts])

  const highAlerts = alerts.filter(a => a.severity === 'high' || a.severity === 'extreme')

  // Compact tracking banner
  if (isTracking && highAlerts.length > 0) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="size-4 text-red-400 animate-pulse" />
            <span className="text-xs font-bold text-red-400">{highAlerts.length} opozoril</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Skrij' : 'Prikaži'}
          </Button>
        </div>
        {expanded && (
          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
            {alerts.map(alert => (
              <div key={alert.id} className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 border ${severityColors[alert.severity]}`}>
                {alertIcons[alert.type]}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{alert.title}</p>
                  <p className="text-[10px] opacity-70 truncate">{alert.description}</p>
                </div>
                <Badge variant="outline" className={`text-[8px] px-1.5 py-0 shrink-0 ${severityColors[alert.severity]}`}>
                  {severityLabels[alert.severity]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Full panel
  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <Cloud className="size-3.5 text-primary" /> Vremenska opozorila
          {highAlerts.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/20">
              {highAlerts.length}
            </Badge>
          )}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] gap-1"
          disabled={loading || !lat || !lng}
          onClick={() => { fetchAlerts(); toast.info('Preverjam vreme...') }}
        >
          {loading ? <span className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="size-3" />}
          Preveri
        </Button>
      </div>

      {!lat || !lng ? (
        <p className="text-[10px] text-muted-foreground">Lokacija ni na voljo</p>
      ) : alerts.length === 0 && !loading ? (
        <div className="flex items-center gap-2 py-2">
          <Cloud className="size-4 text-green-500" />
          <span className="text-xs text-green-500 font-medium">Brez opozoril - varno za vožnjo!</span>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
          {alerts.map(alert => (
            <div key={alert.id} className={`flex items-start gap-2 text-xs rounded-md px-2 py-1.5 border ${severityColors[alert.severity]}`}>
              <div className="shrink-0 mt-0.5">{alertIcons[alert.type]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium">{alert.title}</p>
                  <Badge variant="outline" className={`text-[8px] px-1.5 py-0 shrink-0 ${severityColors[alert.severity]}`}>
                    {severityLabels[alert.severity]}
                  </Badge>
                </div>
                <p className="text-[10px] opacity-80 mt-0.5">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
