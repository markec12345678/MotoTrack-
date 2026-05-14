'use client'

import React, { useState } from 'react'
import { WifiOff, Download, Trash2, HardDrive, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

export default function OfflineMapsPanel({ onClose }: { onClose: () => void }) {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [savedRegions, setSavedRegions] = useState<Array<{ id: string; name: string; size: string; zoom: number }>>(() => {
    try {
      if (typeof window === 'undefined') return []
      const saved = localStorage.getItem('mototrack_offline_maps')
      if (saved) { const parsed = JSON.parse(saved); if (parsed) return parsed }
    } catch { /* ignore */ }
    return []
  })

  const downloadRegion = () => {
    setDownloading(true)
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          setDownloading(false)
          const newRegion = { id: `region_${Date.now()}`, name: `Slovenija ${savedRegions.length + 1}`, size: '~45 MB', zoom: 14 }
          const updated = [...savedRegions, newRegion]
          setSavedRegions(updated)
          try { localStorage.setItem('mototrack_offline_maps', JSON.stringify(updated)) } catch { /* ignore */ }
          toast.success('Karta prenesena!')
          return 0
        }
        return p + Math.random() * 15
      })
    }, 300)
  }

  const deleteRegion = (id: string) => {
    const updated = savedRegions.filter(r => r.id !== id)
    setSavedRegions(updated)
    try { localStorage.setItem('mototrack_offline_maps', JSON.stringify(updated)) } catch { /* ignore */ }
    toast.success('Regija izbrisana')
  }

  return (
    <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <WifiOff className="size-4 text-primary" />
          <span className="text-sm font-bold">Karte brez povezave</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted"><X className="size-3.5 text-muted-foreground" /></button>
      </div>

      {downloading && (
        <div className="mb-3 space-y-1">
          <div className="flex justify-between text-xs"><span>Prenašam...</span><span>{Math.round(progress)}%</span></div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <Button className="w-full mb-3 gap-2" onClick={downloadRegion} disabled={downloading}>
        <Download className="size-4" /> {downloading ? 'Prenašam...' : 'Prenesi regijo (Slovenija)'}
      </Button>

      {savedRegions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Shranjene regije</p>
          {savedRegions.map(r => (
            <div key={r.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <HardDrive className="size-3 text-muted-foreground" />
                <div><p className="font-medium">{r.name}</p><p className="text-muted-foreground">{r.size} · Zoom {r.zoom}</p></div>
              </div>
              <button onClick={() => deleteRegion(r.id)} className="p-1 rounded hover:bg-destructive/20 text-destructive"><Trash2 className="size-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
