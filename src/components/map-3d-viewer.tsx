'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Mountain,
  X,
  Navigation,
  Eye,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'

interface Map3DViewerProps {
  center?: [number, number]
  zoom?: number
  trackPoints?: Array<{ lat: number; lng: number; alt?: number | null; timestamp?: number }>
  routeCoords?: Array<[number, number]>
  title?: string
  onClose?: () => void
  pitch?: number
  bearing?: number
}

export default function Map3DViewer({
  center = [14.99, 46.15],
  zoom = 12,
  trackPoints = [],
  routeCoords = [],
  title = '3D Pogled',
  onClose,
  pitch = 60,
  bearing = -20,
}: Map3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mounted, setMounted] = useState(false)
  const [mapStyle, setMapStyle] = useState<'topo' | 'satellite' | 'dark'>('topo')
  const [currentPitch, setCurrentPitch] = useState(pitch)
  const [showTerrain, setShowTerrain] = useState(true)
  const [is3DReady, setIs3DReady] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const styleUrls: Record<string, string> = {
    topo: 'https://demotiles.maplibre.org/style.json',
    satellite: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    dark: 'https://basemaps.cartocdn.org/gl/dark-matter-gl-style/style.json',
  }

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mounted || !containerRef.current) return

    let map: maplibregl.Map | null = null

    const initMap = async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default
        await import('maplibre-gl/dist/maplibre-gl.css')

        map = new maplibregl.Map({
          container: containerRef.current!,
          style: {
            version: 8,
            sources: {
              'osm-tiles': {
                type: 'raster',
                tiles: [
                  'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
                ],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap',
                maxzoom: 19,
              },
              'terrain-dem': {
                type: 'raster-dem',
                tiles: [
                  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
                ],
                tileSize: 256,
                maxzoom: 15,
                encoding: 'terrarium',
              },
            },
            layers: [
              {
                id: 'osm-tiles-layer',
                type: 'raster',
                source: 'osm-tiles',
                minzoom: 0,
                maxzoom: 19,
              },
              {
                id: 'terrain-hillshade',
                type: 'hillshade',
                source: 'terrain-dem',
                paint: {
                  'hillshade-shadow-color': '#000000',
                  'hillshade-highlight-color': '#ffffff',
                  'hillshade-accent-color': '#333333',
                  'hillshade-exaggeration': 0.3,
                },
              },
            ],
            terrain: showTerrain ? { source: 'terrain-dem', exaggeration: 1.5 } : undefined,
          },
          center: center,
          zoom: zoom,
          pitch: currentPitch,
          bearing: bearing,
          maxPitch: 85,
          antialias: true,
        })

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left')
        map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

        map.on('load', () => {
          setIs3DReady(true)

          // Add track/route data if available
          const allCoords: Array<[number, number]> = []

          // Add track points
          if (trackPoints.length > 0) {
            const trackCoords = trackPoints.map(p => [p.lng, p.lat] as [number, number])
            allCoords.push(...trackCoords)

            // Add track source and layer
            map!.addSource('track', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: trackCoords,
                },
                properties: {},
              },
            })

            // Track glow layer
            map!.addLayer({
              id: 'track-glow',
              type: 'line',
              source: 'track',
              paint: {
                'line-color': '#f59e0b',
                'line-width': 8,
                'line-opacity': 0.3,
                'line-blur': 4,
              },
            })

            // Track main line
            map!.addLayer({
              id: 'track-line',
              type: 'line',
              source: 'track',
              paint: {
                'line-color': '#f59e0b',
                'line-width': 4,
                'line-opacity': 0.9,
              },
            })

            // Start marker
            if (trackCoords.length > 0) {
              const startEl = document.createElement('div')
              startEl.innerHTML = `<div style="background:#22c55e;border:3px solid #fff;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;">S</div>`
              new maplibregl.Marker({ element: startEl })
                .setLngLat(trackCoords[0])
                .addTo(map!)

              // End marker
              if (trackCoords.length > 1) {
                const endEl = document.createElement('div')
                endEl.innerHTML = `<div style="background:#ef4444;border:3px solid #fff;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;">E</div>`
                new maplibregl.Marker({ element: endEl })
                  .setLngLat(trackCoords[trackCoords.length - 1])
                  .addTo(map!)
              }
            }
          }

          // Add route data
          if (routeCoords.length > 0) {
            allCoords.push(...routeCoords)

            map!.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords,
                },
                properties: {},
              },
            })

            map!.addLayer({
              id: 'route-glow',
              type: 'line',
              source: 'route',
              paint: {
                'line-color': '#3b82f6',
                'line-width': 8,
                'line-opacity': 0.3,
                'line-blur': 4,
              },
            })

            map!.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              paint: {
                'line-color': '#3b82f6',
                'line-width': 4,
                'line-opacity': 0.9,
                'line-dasharray': [2, 1],
              },
            })
          }

          // Fit bounds if we have coordinates
          if (allCoords.length > 1) {
            const bounds = new maplibregl.LngLatBounds()
            allCoords.forEach(c => bounds.extend(c))
            map!.fitBounds(bounds, { padding: 60, pitch: currentPitch, bearing, duration: 1500 })
          }

          // Add 3D terrain if available
          if (showTerrain) {
            try {
              map!.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
            } catch {
              // Terrain not available, continue without it
            }
          }
        })

        mapRef.current = map
      } catch (err) {
        console.error('MapLibre init error:', err)
        toast.error('Napaka pri nalaganju 3D zemljevida')
      }
    }

    initMap()

    return () => {
      if (map) {
        map.remove()
        mapRef.current = null
      }
    }
  }, [mounted])

  // Update pitch
  useEffect(() => {
    if (mapRef.current && is3DReady) {
      try {
        mapRef.current.easeTo({ pitch: currentPitch, duration: 500 })
      } catch { /* ignore */ }
    }
  }, [currentPitch, is3DReady])

  // Toggle terrain
  useEffect(() => {
    if (mapRef.current && is3DReady) {
      try {
        if (showTerrain) {
          mapRef.current.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
        } else {
          mapRef.current.setTerrain(null)
        }
      } catch { /* ignore */ }
    }
  }, [showTerrain, is3DReady])

  const handleResetView = useCallback(() => {
    if (!mapRef.current) return
    const allCoords: Array<[number, number]> = [
      ...trackPoints.map(p => [p.lng, p.lat] as [number, number]),
      ...routeCoords,
    ]
    if (allCoords.length > 1) {
      // Use the map's built-in bounds calculation
      const map = mapRef.current
      const firstCoord = allCoords[0]
      const lastCoord = allCoords[allCoords.length - 1]
      map.fitBounds([firstCoord, lastCoord], { padding: 60, pitch: currentPitch, bearing, duration: 1500 })
    } else {
      mapRef.current.easeTo({ center, zoom, pitch: currentPitch, bearing, duration: 1000 })
    }
  }, [trackPoints, routeCoords, center, zoom, currentPitch, bearing])

  if (!mounted) return null

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs font-bold">
            <Mountain className="size-3 mr-1" /> 3D
          </Badge>
          <span className="text-white text-sm font-medium drop-shadow">{title}</span>
        </div>
        <div className="flex items-center gap-1 pointer-events-auto">
          {onClose && (
            <Button variant="ghost" size="icon" className="size-8 rounded-full bg-black/40 hover:bg-black/60 text-white" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-end justify-between gap-3">
        {/* Left controls */}
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="size-10 rounded-full shadow-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur"
            onClick={() => setCurrentPitch(p => Math.min(p + 15, 85))}
            title="Povečaj nagib"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-10 rounded-full shadow-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur"
            onClick={() => setCurrentPitch(p => Math.max(p - 15, 0))}
            title="Zmanjšaj nagib"
          >
            <Navigation className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className={`size-10 rounded-full shadow-lg backdrop-blur ${showTerrain ? 'bg-emerald-600/80 hover:bg-emerald-700/80 text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}
            onClick={() => setShowTerrain(!showTerrain)}
            title={showTerrain ? 'Skrij teren' : 'Prikaži teren'}
          >
            <Mountain className="size-4" />
          </Button>
        </div>

        {/* Center - pitch slider */}
        <div className="flex flex-col items-center gap-2 bg-black/60 backdrop-blur rounded-2xl px-4 py-3 min-w-[200px]">
          <div className="flex items-center gap-2 w-full">
            <span className="text-[10px] text-white/60 w-8">2D</span>
            <Slider
              value={[currentPitch]}
              onValueChange={(v) => setCurrentPitch(v[0])}
              min={0}
              max={85}
              step={5}
              className="flex-1"
            />
            <span className="text-[10px] text-white/60 w-8 text-right">3D</span>
          </div>
          <div className="flex items-center gap-2 w-full">
            <Layers className="size-3 text-white/60" />
            <span className="text-[10px] text-white/80">
              Nagib: {currentPitch}° {showTerrain ? '· Teren ON' : '· Teren OFF'}
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="size-10 rounded-full shadow-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur"
            onClick={() => mapRef.current?.zoomIn()}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-10 rounded-full shadow-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur"
            onClick={() => mapRef.current?.zoomOut()}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-10 rounded-full shadow-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur"
            onClick={handleResetView}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
