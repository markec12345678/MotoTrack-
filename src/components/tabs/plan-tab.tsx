'use client'

import React, { useRef } from 'react'
import dynamic from 'next/dynamic'
import { Route, Trash2, Save, MapPin, X, Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { categoryLabel } from '@/components/tabs/types'

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

interface PlanTabProps {
  waypoints: Array<{ lat: number; lng: number }>
  setWaypoints: React.Dispatch<React.SetStateAction<Array<{ lat: number; lng: number }>>>
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
  category: string
  setCategory: React.Dispatch<React.SetStateAction<string>>
  avoidHighways: boolean
  setAvoidHighways: React.Dispatch<React.SetStateAction<boolean>>
  distance: number
  onMapClick: (lat: number, lng: number) => void
  onSave: () => void
  userId: string
  onRefresh: () => void
}

export default function PlanTab({
  waypoints, setWaypoints, title, setTitle,
  category, setCategory, avoidHighways, setAvoidHighways,
  distance, onMapClick, onSave, userId, onRefresh,
}: PlanTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      toast.error('Izberite datoteko formata .gpx')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', userId)
      const res = await fetch('/api/gpx/import', { method: 'POST', body: formData })
      if (res.ok) {
        toast.success('GPX uspešno uvožen!')
        onRefresh()
      } else {
        toast.error('Napaka pri uvozu GPX')
      }
    } catch {
      toast.error('Napaka pri uvozu GPX')
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="relative w-full h-[calc(100vh-104px)] flex flex-col lg:flex-row">
      <div className="flex-1 relative">
        <MotoMap center={[46.15, 14.99]} zoom={8} rides={[]} routes={[]} planWaypoints={waypoints} showPlan={true} onMapClick={onMapClick} />
      </div>
      <div className="lg:w-80 w-full bg-card border-t lg:border-t-0 lg:border-l border-border/50 p-4 overflow-y-auto max-h-[40vh] lg:max-h-full">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><Route className="size-5 text-primary" />Načrtuj pot</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Ime poti</label>
            <Input placeholder="Npr. Obala do Pirana" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Kategorija</label>
            <div className="flex flex-wrap gap-2">
              {['scenic', 'twisty', 'offroad', 'city'].map(cat => (
                <Button key={cat} variant={category === cat ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setCategory(cat)}>
                  {categoryLabel(cat)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Izogni se avtocestam</label>
            <Switch checked={avoidHighways} onCheckedChange={setAvoidHighways} />
          </div>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Točke ({waypoints.length})</label>
              {waypoints.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-6 text-destructive" onClick={() => { setWaypoints([]) }}>
                  <Trash2 className="size-3 mr-1" />Počisti
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-40">
              {waypoints.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Kliknite na zemljevid za dodajanje točk</p>
              ) : (
                <div className="space-y-1">
                  {waypoints.map((wp, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3 text-primary" />
                        <span>Točka {i + 1}</span>
                        <span className="text-muted-foreground">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => setWaypoints(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          {waypoints.length > 1 && (
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Skupna razdalja</span>
                <span className="font-bold text-primary">{distance} km</span>
              </div>
            </div>
          )}
          <Button className="w-full" onClick={onSave} disabled={waypoints.length < 2}>
            <Save className="size-4 mr-2" />Shrani pot
          </Button>

          {/* GPX Import */}
          <Separator />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4 mr-2" />Uvozi GPX
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
