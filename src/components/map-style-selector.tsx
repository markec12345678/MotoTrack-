'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Layers, Map, Satellite, Mountain, Moon, Globe, Eye } from 'lucide-react'
import { toast } from 'sonner'
import type { MapStyleConfig } from '@/components/tabs/types'

const MAP_STYLES = [
  { id: 'streets', name: 'Ulice', icon: Map, desc: 'Standardni zemljevid' },
  { id: 'satellite', name: 'Satelit', icon: Satellite, desc: 'Satelitski posnetki' },
  { id: 'terrain', name: 'Teren', icon: Mountain, desc: 'Topografski zemljevid' },
  { id: 'dark', name: 'Temni', icon: Moon, desc: 'Temna tema za nočno vožnjo' },
  { id: 'topo', name: 'Topo', icon: Layers, desc: 'Topografski s plastmi' },
  { id: 'osm', name: 'OSM', icon: Globe, desc: 'OpenStreetMap' },
]

interface Props {
  userId?: string
  onStyleChange?: (config: MapStyleConfig) => void
}

export default function MapStyleSelector({ userId, onStyleChange }: Props) {
  const [config, setConfig] = useState<MapStyleConfig>({
    styleName: 'streets', customUrl: null, overlayTraffic: false, overlayWeather: false, overlayHazards: true, overlayPois: true
  })

  useEffect(() => {
    if (userId) {
      fetch(`/api/map-styles?userId=${userId}`).then(r => r.json()).then(j => {
        if (j.data) setConfig(j.data)
      }).catch(() => {})
    }
  }, [userId])

  const updateConfig = async (updates: Partial<MapStyleConfig>) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    onStyleChange?.(newConfig)
    if (userId) {
      fetch('/api/map-styles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, ...newConfig }) }).catch(() => {})
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <Layers className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Eye className="size-4" /> Slog zemljevida</h4>

          <div className="grid grid-cols-3 gap-2">
            {MAP_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => updateConfig({ styleName: style.id })}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                  config.styleName === style.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                }`}
              >
                <style.icon className="size-4" />
                <span className="font-medium">{style.name}</span>
              </button>
            ))}
          </div>

          <div className="border-t pt-2 space-y-2">
            <h5 className="text-xs font-semibold text-muted-foreground">Prekrivne plasti</h5>
            {[
              { key: 'overlayTraffic' as const, label: '🚗 Promet', desc: 'Prometni podatki' },
              { key: 'overlayWeather' as const, label: '🌤️ Vreme', desc: 'Vremenski podatki' },
              { key: 'overlayHazards' as const, label: '⚠️ Nevarnosti', desc: 'Nevarnosti na cesti' },
              { key: 'overlayPois' as const, label: '📍 POI', desc: 'Zanimive točke' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">{item.desc}</span>
                </div>
                <Switch checked={config[item.key]} onCheckedChange={(v) => updateConfig({ [item.key]: v })} className="scale-75" />
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
