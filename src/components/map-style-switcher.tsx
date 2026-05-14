'use client'

import React, { useState, useEffect } from 'react'
import { Palette, X, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { MapStyleData } from '@/components/tabs/types'

interface MapStyleSwitcherProps {
  currentStyleId: string
  onStyleChange: (style: MapStyleData) => void
  onClose?: () => void
}

export default function MapStyleSwitcher({ currentStyleId, onStyleChange, onClose }: MapStyleSwitcherProps) {
  const [styles, setStyles] = useState<MapStyleData[]>([])
  const [previewStyle, setPreviewStyle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/map-styles')
      .then(r => r.json())
      .then(j => {
        setStyles(j.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Load saved style from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('mototrack-map-style')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as MapStyleData
        if (parsed.id && parsed.tileUrl) {
          onStyleChange(parsed)
        }
      } catch {
        // ignore invalid saved data
      }
    }
  }, [])

  const handleStyleSelect = (style: MapStyleData) => {
    setPreviewStyle(style.id)
  }

  const handleApply = () => {
    const style = styles.find(s => s.id === previewStyle)
    if (style) {
      onStyleChange(style)
      localStorage.setItem('mototrack-map-style', JSON.stringify(style))
      toast.success(`Slog zemljevida: ${style.name}`)
      if (onClose) onClose()
    }
  }

  if (loading) {
    return (
      <Card className="w-72">
        <CardContent className="p-4 flex items-center justify-center h-32">
          <Palette className="size-6 text-muted-foreground animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-72 overflow-hidden border-primary/15">
      <div className="h-0.5 bg-gradient-to-r from-violet-500/80 via-pink-400/60 to-rose-500/40" />
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-violet-500/15">
              <Palette className="size-4 text-violet-500" />
            </div>
            <CardTitle className="text-sm">Slog zemljevida</CardTitle>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        {/* Style grid */}
        <div className="grid grid-cols-2 gap-2">
          {styles.map(style => {
            const isCurrent = style.id === currentStyleId
            const isPreview = style.id === previewStyle
            return (
              <button
                key={style.id}
                onClick={() => handleStyleSelect(style)}
                className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all duration-200 hover:scale-[1.02] ${
                  isPreview
                    ? 'border-violet-500 bg-violet-500/10 shadow-md shadow-violet-500/20'
                    : isCurrent
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/50 hover:border-border'
                }`}
              >
                {/* Style thumbnail */}
                <div className={`w-full aspect-[4/3] rounded-md flex items-center justify-center text-2xl ${
                  style.id === 'dark' ? 'bg-gray-900' :
                  style.id === 'satellite' ? 'bg-green-900/50 bg-[url(https://placehold.co/100x75/2d4a22/fff?text=%F0%9F%9B%B0%EF%B8%8F)]' :
                  style.id === 'topo' ? 'bg-amber-50 dark:bg-amber-950/50' :
                  style.id === 'terrain' ? 'bg-green-50 dark:bg-green-950/50' :
                  'bg-blue-50 dark:bg-blue-950/50'
                }`}>
                  {style.preview}
                </div>
                <span className="text-[10px] font-medium">{style.name}</span>
                {isCurrent && !isPreview && (
                  <div className="absolute top-1 right-1 size-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="size-2.5 text-primary-foreground" />
                  </div>
                )}
                {isPreview && (
                  <Badge className="absolute top-1 left-1 text-[7px] px-1 py-0 h-3.5 bg-violet-500">
                    Predogled
                  </Badge>
                )}
              </button>
            )
          })}
        </div>

        {/* Apply button */}
        {previewStyle && previewStyle !== currentStyleId && (
          <button
            onClick={handleApply}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-500 text-white text-xs font-medium hover:bg-violet-600 transition-colors"
          >
            <Check className="size-3" /> Uporabi slog
          </button>
        )}

        <p className="text-[8px] text-muted-foreground text-center">
          Slog se shrani za naslednji obisk
        </p>
      </CardContent>
    </Card>
  )
}
