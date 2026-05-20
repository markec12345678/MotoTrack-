'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  GripVertical, Trash2, Save, FolderOpen, Download, Settings2,
  MapPin, Navigation, Mountain, Clock, Route, X, ChevronDown, ChevronUp,
  AlertTriangle, FileDown, Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

// ===== Types =====
interface WaypointWithName {
  lat: number
  lng: number
  name?: string
}

interface RoutePreferences {
  avoidHighways: boolean
  preferTwisty: boolean
  avoidTolls: boolean
}

interface SavedRouteData {
  id: string
  name: string
  description?: string
  waypoints: WaypointWithName[]
  preferences: RoutePreferences
  distance: number
  createdAt: string
  updatedAt: string
}

interface RoutePlannerEnhancedProps {
  waypoints: Array<{ lat: number; lng: number }>
  setWaypoints: React.Dispatch<React.SetStateAction<Array<{ lat: number; lng: number }>>>
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
  avoidHighways: boolean
  setAvoidHighways: React.Dispatch<React.SetStateAction<boolean>>
  avoidTolls?: boolean
  setAvoidTolls?: React.Dispatch<React.SetStateAction<boolean>>
  distance: number
  category: string
  userId: string
}

// Haversine distance between two points
function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Generate GPX file content
function generateGPX(
  waypoints: Array<{ lat: number; lng: number }>,
  title: string,
  preferences: RoutePreferences
): string {
  const now = new Date().toISOString()
  const wptElements = waypoints
    .map((w, i) => {
      const name = `Točka ${i + 1}`
      const sym = i === 0 ? 'Flag, Green' : i === waypoints.length - 1 ? 'Flag, Red' : 'Flag, Blue'
      return `  <wpt lat="${w.lat.toFixed(6)}" lon="${w.lng.toFixed(6)}">
    <name>${name}</name>
    <sym>${sym}</sym>
  </wpt>`
    })
    .join('\n')

  const rteptElements = waypoints
    .map((w, i) => {
      const name = `Točka ${i + 1}`
      return `    <rtept lat="${w.lat.toFixed(6)}" lon="${w.lng.toFixed(6)}">
      <name>${name}</name>
    </rtept>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoTrack"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:mt="https://mototrack.app/xml/ns"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${title || 'MotoTrack Pot'}</name>
    <time>${now}</time>
    <author>MotoTrack</author>
  </metadata>
${wptElements}
  <rte>
    <name>${title || 'MotoTrack Pot'}</name>
    <mt:avoidHighways>${preferences.avoidHighways}</mt:avoidHighways>
    <mt:preferTwisty>${preferences.preferTwisty}</mt:preferTwisty>
    <mt:avoidTolls>${preferences.avoidTolls}</mt:avoidTolls>
${rteptElements}
  </rte>
</gpx>`
}

export default function RoutePlannerEnhanced({
  waypoints,
  setWaypoints,
  title,
  setTitle,
  avoidHighways,
  setAvoidHighways,
  avoidTolls = false,
  setAvoidTolls,
  distance,
  category,
  userId,
}: RoutePlannerEnhancedProps) {
  const [preferTwisty, setPreferTwisty] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteData[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Estimated route stats
  const estimatedStats = useMemo(() => {
    const avgSpeed = preferTwisty ? 45 : avoidHighways ? 50 : 60 // km/h
    const durationHours = distance / avgSpeed
    const durationMinutes = Math.round(durationHours * 60)
    // Rough elevation gain estimate: 8-12m per km for hilly terrain, less for highways
    const elevationPerKm = preferTwisty ? 12 : avoidHighways ? 5 : 8
    const elevationGain = Math.round(distance * elevationPerKm)

    return {
      duration: durationMinutes,
      durationFormatted: durationMinutes >= 60
        ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}min`
        : `${durationMinutes} min`,
      elevationGain,
      avgSpeed,
    }
  }, [distance, preferTwisty, avoidHighways])

  // Drag and drop handlers
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    setWaypoints(prev => {
      const newWaypoints = [...prev]
      const draggedItem = newWaypoints[dragIndex]
      newWaypoints.splice(dragIndex, 1)
      newWaypoints.splice(targetIndex, 0, draggedItem)
      return newWaypoints
    })

    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, setWaypoints])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  // Remove waypoint
  const removeWaypoint = useCallback((index: number) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index))
  }, [setWaypoints])

  // Export as GPX
  const exportGPX = useCallback(() => {
    if (waypoints.length < 2) {
      toast.error('Dodajte vsaj dve točki za izvoz')
      return
    }

    const gpxContent = generateGPX(waypoints, title || 'MotoTrack Pot', {
      avoidHighways,
      preferTwisty,
      avoidTolls,
    })

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'mototrack-pot').replace(/[^a-zA-Z0-9čšžČŠŽ]/g, '-')}.gpx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('GPX datoteka izvožena!')
  }, [waypoints, title, avoidHighways, preferTwisty, avoidTolls])

  // Save route to library
  const saveRouteToLibrary = useCallback(async () => {
    if (waypoints.length < 2) {
      toast.error('Dodajte vsaj dve točki')
      return
    }
    if (!saveName.trim()) {
      toast.error('Vnesite ime poti')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/saved-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName,
          description: saveDescription || undefined,
          waypoints: waypoints.map((w, i) => ({
            lat: w.lat,
            lng: w.lng,
            name: `Točka ${i + 1}`,
          })),
          preferences: { avoidHighways, preferTwisty, avoidTolls },
          userId,
          distance,
        }),
      })

      if (res.ok) {
        toast.success(`Pot "${saveName}" shranjena v knjižnico!`)
        setShowSaveDialog(false)
        setSaveName('')
        setSaveDescription('')
      } else {
        toast.error('Napaka pri shranjevanju poti')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setSaving(false)
    }
  }, [waypoints, saveName, saveDescription, avoidHighways, preferTwisty, avoidTolls, userId, distance])

  // Load saved routes
  const loadSavedRoutes = useCallback(async () => {
    setLoadingRoutes(true)
    try {
      const res = await fetch(`/api/saved-routes?userId=${encodeURIComponent(userId)}`)
      if (res.ok) {
        const j = await res.json()
        setSavedRoutes(j.data || [])
        setShowLoadDialog(true)
      } else {
        toast.error('Napaka pri nalaganju shranjenih poti')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setLoadingRoutes(false)
    }
  }, [userId])

  // Load a saved route
  const loadRoute = useCallback((route: SavedRouteData) => {
    setWaypoints(route.waypoints.map(w => ({ lat: w.lat, lng: w.lng })))
    setTitle(route.name)
    if (setAvoidHighways) setAvoidHighways(route.preferences.avoidHighways)
    if (setAvoidTolls) setAvoidTolls(route.preferences.avoidTolls)
    setPreferTwisty(route.preferences.preferTwisty)
    setShowLoadDialog(false)
    toast.success(`Pot "${route.name}" naložena!`)
  }, [setWaypoints, setTitle, setAvoidHighways, setAvoidTolls])

  // Delete a saved route
  const deleteSavedRoute = useCallback(async (routeId: string, routeName: string) => {
    try {
      const res = await fetch(`/api/saved-routes?id=${encodeURIComponent(routeId)}`, { method: 'DELETE' })
      if (res.ok) {
        setSavedRoutes(prev => prev.filter(r => r.id !== routeId))
        toast.success(`Pot "${routeName}" izbrisana`)
      } else {
        toast.error('Napaka pri brisanju poti')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Estimated Route Stats */}
      {waypoints.length >= 2 && (
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <Route className="size-3.5 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold">{distance.toFixed(1)}</p>
                <p className="text-[9px] text-muted-foreground">km</p>
              </div>
              <div className="text-center">
                <Clock className="size-3.5 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold">{estimatedStats.durationFormatted}</p>
                <p className="text-[9px] text-muted-foreground">trajanje</p>
              </div>
              <div className="text-center">
                <Mountain className="size-3.5 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold">~{estimatedStats.elevationGain}</p>
                <p className="text-[9px] text-muted-foreground">vzpon (m)</p>
              </div>
              <div className="text-center">
                <Navigation className="size-3.5 text-primary mx-auto mb-1" />
                <p className="text-sm font-bold">~{estimatedStats.avgSpeed}</p>
                <p className="text-[9px] text-muted-foreground">km/h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Draggable Waypoints List */}
      {waypoints.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <MapPin className="size-3.5 text-primary" />
              Točke poti ({waypoints.length})
            </h4>
          </div>

          <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
            {waypoints.map((wp, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs border transition-all cursor-grab active:cursor-grabbing
                  ${dragIndex === i ? 'opacity-50 border-primary/30 bg-primary/5' : ''}
                  ${dragOverIndex === i && dragIndex !== i ? 'border-primary bg-primary/10' : ''}
                  ${dragIndex === null ? 'border-border/50 bg-secondary/30 hover:bg-secondary/50' : ''}
                `}
              >
                <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
                <span
                  className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    i === 0
                      ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                      : i === waypoints.length - 1
                      ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate text-muted-foreground">
                  {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                </span>
                {waypoints.length > 2 && (
                  <button
                    onClick={() => removeWaypoint(i)}
                    className="size-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground flex items-center gap-1">
            <GripVertical className="size-2.5" />
            Povlecite za spreminjanje vrstnega reda
          </p>
        </div>
      )}

      {/* Route Preferences Panel */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors"
          onClick={() => setShowPreferences(!showPreferences)}
        >
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <Settings2 className="size-3.5 text-primary" />
            Nastavitve poti
          </span>
          {showPreferences ? (
            <ChevronUp className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          )}
        </button>

        {showPreferences && (
          <div className="px-3 pb-3 space-y-3 border-t border-border/30">
            <div className="pt-2" />

            {/* Avoid Highways */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-3.5 text-amber-500" />
                <div>
                  <p className="text-xs font-medium">Izogibaj se avtocestam</p>
                  <p className="text-[9px] text-muted-foreground">Izberi lokalne ceste namesto avtocest</p>
                </div>
              </div>
              <Switch
                checked={avoidHighways}
                onCheckedChange={setAvoidHighways}
              />
            </div>

            {/* Prefer Twisty Roads */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="size-3.5 text-primary" />
                <div>
                  <p className="text-xs font-medium">Prednost vijugaste ceste</p>
                  <p className="text-[9px] text-muted-foreground">Izberi pot z več ovinki</p>
                </div>
              </div>
              <Switch
                checked={preferTwisty}
                onCheckedChange={setPreferTwisty}
              />
            </div>

            {/* Avoid Tolls */}
            {setAvoidTolls && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-3.5 text-red-500" />
                  <div>
                    <p className="text-xs font-medium">Izogibaj se cestninam</p>
                    <p className="text-[9px] text-muted-foreground">Brez cestninskih cest</p>
                  </div>
                </div>
                <Switch
                  checked={avoidTolls}
                  onCheckedChange={setAvoidTolls}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] gap-1"
          onClick={() => {
            setSaveName(title || '')
            setShowSaveDialog(true)
          }}
          disabled={waypoints.length < 2}
        >
          <Save className="size-3.5" />
          Shrani
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] gap-1"
          onClick={loadSavedRoutes}
          disabled={loadingRoutes}
        >
          {loadingRoutes ? (
            <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <FolderOpen className="size-3.5" />
          )}
          Naloži
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-[10px] gap-1"
          onClick={exportGPX}
          disabled={waypoints.length < 2}
        >
          <FileDown className="size-3.5" />
          GPX
        </Button>
      </div>

      {/* Save Route Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="size-5 text-primary" />
              Shrani pot v knjižnico
            </DialogTitle>
            <DialogDescription>
              Shranite pot za poznejšo uporabo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ime poti</label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Npr. Vikend tura po Gorenjski"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Opis (neobvezno)</label>
              <Textarea
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Kratek opis poti..."
                rows={2}
              />
            </div>

            {/* Route summary */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <MapPin className="size-3" />
                {waypoints.length} točk
              </Badge>
              <Badge variant="secondary">
                {distance.toFixed(1)} km
              </Badge>
              {avoidHighways && <Badge variant="outline" className="text-[9px]">Brez avtocest</Badge>}
              {preferTwisty && <Badge variant="outline" className="text-[9px]">Vijugaste</Badge>}
              {avoidTolls && <Badge variant="outline" className="text-[9px]">Brez cestnin</Badge>}
            </div>

            <Button
              className="w-full"
              onClick={saveRouteToLibrary}
              disabled={saving || !saveName.trim()}
            >
              {saving ? (
                <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              {saving ? 'Shranjujem...' : 'Shrani v knjižnico'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Route Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="size-5 text-primary" />
              Shranjene poti
            </DialogTitle>
            <DialogDescription>
              Izberite pot za nalaganje
            </DialogDescription>
          </DialogHeader>

          {savedRoutes.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <Route className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Ni shranjenih poti
              </p>
              <p className="text-xs text-muted-foreground">
                Načrtujte pot in jo shranite v knjižnico
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {savedRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Route className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{route.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {route.waypoints.length} točk
                        </span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {route.distance.toFixed(1)} km
                        </span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(route.updatedAt).toLocaleDateString('sl-SI')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => loadRoute(route)}
                      >
                        <Plus className="size-3" />
                        Naloži
                      </Button>
                      <button
                        onClick={() => deleteSavedRoute(route.id, route.name)}
                        className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
