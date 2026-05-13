'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, Construction, Car, Ban, Activity, RefreshCw } from 'lucide-react'
import type { TrafficIncident } from '@/components/tabs/types'

const SEVERITY_COLORS: Record<string, string> = { low: 'bg-yellow-500/20 text-yellow-400', medium: 'bg-orange-500/20 text-orange-400', high: 'bg-red-500/20 text-red-400' }
const TYPE_ICONS: Record<string, React.ReactNode> = {
  construction: <Construction className="size-3" />,
  accident: <AlertTriangle className="size-3" />,
  delay: <Car className="size-3" />,
  closure: <Ban className="size-3" />,
}

interface Props {
  lat?: number
  lng?: number
  enabled?: boolean
  onToggle?: (v: boolean) => void
  incidents?: TrafficIncident[]
}

export default function TrafficOverlay({ lat = 46.15, lng = 14.99, enabled = false, onToggle, incidents: propIncidents }: Props) {
  const [incidents, setIncidents] = useState<TrafficIncident[]>(propIncidents || [])
  const [loading, setLoading] = useState(false)

  const fetchTraffic = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/traffic?lat=${lat}&lng=${lng}&radius=100`)
      if (res.ok) { const j = await res.json(); setIncidents(j.data || []) }
    } catch { /* ignore */ }
    setLoading(false)
  }, [lat, lng])

  useEffect(() => { if (enabled && !propIncidents) fetchTraffic() }, [enabled, propIncidents, fetchTraffic])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-orange-500" />
          <span className="text-sm font-semibold">Promet v živo</span>
          {incidents.length > 0 && <Badge variant="secondary" className="text-[10px]">{incidents.length}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {enabled && (
            <Button variant="ghost" size="icon" className="size-6" onClick={fetchTraffic} disabled={loading}>
              <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <Switch checked={enabled} onCheckedChange={onToggle || (() => {})} className="scale-75" />
        </div>
      </div>

      {enabled && incidents.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {incidents.map(inc => (
            <div key={inc.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-xs">
              <div className="mt-0.5">{TYPE_ICONS[inc.type] || <AlertTriangle className="size-3" />}</div>
              <div className="flex-1 min-w-0">
                <p className="truncate">{inc.description}</p>
                <Badge className={`${SEVERITY_COLORS[inc.severity] || ''} text-[10px] mt-1`}>
                  {inc.severity === 'high' ? 'Hudo' : inc.severity === 'medium' ? 'Zmerno' : 'Rahlo'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
