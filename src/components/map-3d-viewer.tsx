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
  Play,
  Pause,
  FastForward,
  Building2,
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

type MapStyle = 'topo' | 'satellite' | 'dark'
type FlySpeed = 1 | 2 | 5

// Haversine distance in meters
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Elevation color: green(low) -> yellow(mid) -> red(high)
function elevationColor(alt: number, minAlt: number, maxAlt: number): string {
  if (maxAlt === minAlt) return '#22c55e'
  const t = (alt - minAlt) / (maxAlt - minAlt)
  if (t < 0.5) {
    const r = Math.round(34 + t * 2 * (245 - 34))
    const g = Math.round(197 + t * 2 * (158 - 197))
    const b = Math.round(94 + t * 2 * (11 - 94))
    return `rgb(${r},${g},${b})`
  } else {
    const r = Math.round(245 + (t - 0.5) * 2 * (239 - 245))
    const g = Math.round(158 + (t - 0.5) * 2 * (68 - 158))
    const b = Math.round(11 + (t - 0.5) * 2 * (68 - 11))
    return `rgb(${r},${g},${b})`
  }
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
  const mapRef = useRef<any>(null)
  const maplibreRef = useRef<any>(null) // store dynamically imported maplibre-gl
  const flyAnimRef = useRef<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [mapStyle, setMapStyle] = useState<MapStyle>('topo')
  const [currentPitch, setCurrentPitch] = useState(pitch)
  const [showTerrain, setShowTerrain] = useState(true)
  const [showBuildings, setShowBuildings] = useState(true)
  const [is3DReady, setIs3DReady] = useState(false)
  const [isFlying, setIsFlying] = useState(false)
  const [flySpeed, setFlySpeed] = useState<FlySpeed>(1)
  const [profilePoint, setProfilePoint] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Compute track data with distances and elevation
  const trackData = useCallback(() => {
    if (trackPoints.length === 0) return null
    const points = trackPoints.map(p => ({
      lng: p.lng,
      lat: p.lat,
      alt: p.alt ?? 0,
    }))
    let totalDist = 0
    const dists = [0]
    for (let i = 1; i < points.length; i++) {
      totalDist += haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
      dists.push(totalDist)
    }
    const alts = points.map(p => p.alt)
    const minAlt = Math.min(...alts)
    const maxAlt = Math.max(...alts)
    const minAltIdx = alts.indexOf(minAlt)
    const maxAltIdx = alts.indexOf(maxAlt)
    return { points, dists, totalDist, minAlt, maxAlt, minAltIdx, maxAltIdx }
  }, [trackPoints])

  // Build map style based on selected type
  const buildStyle = useCallback((style: MapStyle): any => {
    const baseSources: Record<string, any> = {
      'terrain-dem': {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 15,
        encoding: 'terrarium',
      },
    }
    const baseLayers: any[] = []

    switch (style) {
      case 'topo':
        baseSources['osm-tiles'] = {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap',
          maxzoom: 19,
        }
        baseLayers.push({
          id: 'osm-tiles-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        })
        break
      case 'satellite':
        baseSources['satellite-tiles'] = {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '&copy; Esri',
          maxzoom: 19,
        }
        baseLayers.push({
          id: 'satellite-tiles-layer',
          type: 'raster',
          source: 'satellite-tiles',
          minzoom: 0,
          maxzoom: 19,
        })
        break
      case 'dark':
        baseSources['dark-tiles'] = {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          attribution: '&copy; CartoDB',
          maxzoom: 19,
        }
        baseLayers.push({
          id: 'dark-tiles-layer',
          type: 'raster',
          source: 'dark-tiles',
          minzoom: 0,
          maxzoom: 19,
        })
        break
    }

    // Add hillshade for topo and satellite
    if (style === 'topo' || style === 'satellite') {
      baseLayers.push({
        id: 'terrain-hillshade',
        type: 'hillshade',
        source: 'terrain-dem',
        paint: {
          'hillshade-shadow-color': '#1a0000',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#333333',
          'hillshade-exaggeration': style === 'topo' ? 0.4 : 0.25,
        },
      })
    }

    return {
      version: 8,
      sources: baseSources,
      layers: baseLayers,
      terrain: showTerrain ? { source: 'terrain-dem', exaggeration: 1.5 } : undefined,
    } as any
  }, [showTerrain])

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mounted || !containerRef.current) return

    let map: any = null

    const initMap = async () => {
      try {
        const maplibregl = await import('maplibre-gl')
        await import('maplibre-gl/dist/maplibre-gl.css')

        maplibreRef.current = maplibregl

        map = new maplibregl.Map({
          container: containerRef.current!,
          style: buildStyle(mapStyle),
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

          if (showTerrain) {
            try { map!.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 }) } catch {}
          }

          // Add 3D buildings vector source (OpenFreeMap)
          try {
            map!.addSource('openmaptiles', {
              type: 'vector',
              tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
              maxzoom: 14,
              attribution: '&copy; OpenFreeMap &copy; OpenMapTiles &copy; OpenStreetMap',
            })

            map!.addLayer({
              id: '3d-buildings',
              source: 'openmaptiles',
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 12,
              paint: {
                'fill-extrusion-color': mapStyle === 'dark' ? '#2a2a3a' : '#c8b89a',
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
                'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': mapStyle === 'dark' ? 0.7 : 0.6,
              },
            })
          } catch (err) {
            console.warn('Could not add 3D buildings layer:', err)
          }

          addTrackData(map!)
        })

        mapRef.current = map
      } catch (err) {
        console.error('MapLibre init error:', err)
        toast.error('Napaka pri nalaganju 3D zemljevida')
      }
    }

    initMap()

    return () => {
      if (flyAnimRef.current) cancelAnimationFrame(flyAnimRef.current)
      if (map) {
        map.remove()
        mapRef.current = null
      }
    }
  }, [mounted])

  // Add track/route data to the map
  const addTrackData = useCallback((map: any) => {
    const td = trackData()
    const allCoords: Array<[number, number]> = []

    if (trackPoints.length > 0) {
      const trackCoords = trackPoints.map(p => [p.lng, p.lat] as [number, number])
      allCoords.push(...trackCoords)

      // Add track source as GeoJSON
      map.addSource('track', {
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
      map.addLayer({
        id: 'track-glow',
        type: 'line',
        source: 'track',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 10,
          'line-opacity': 0.2,
          'line-blur': 6,
        },
      })

      // Track main line
      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      })

      // Add elevation-colored segments
      if (td && td.points.length > 1) {
        const segments: Array<{ coordinates: [number, number][]; color: string }> = []
        for (let i = 0; i < td.points.length - 1; i++) {
          const avgAlt = (td.points[i].alt + td.points[i + 1].alt) / 2
          segments.push({
            coordinates: [[td.points[i].lng, td.points[i].lat], [td.points[i + 1].lng, td.points[i + 1].lat]],
            color: elevationColor(avgAlt, td.minAlt, td.maxAlt),
          })
        }

        map.addSource('track-elevation', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: segments.map((seg, i) => ({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: seg.coordinates },
              properties: { color: seg.color, index: i },
            })),
          },
        })

        map.addLayer({
          id: 'track-elevation-line',
          type: 'line',
          source: 'track-elevation',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3,
            'line-opacity': 0.85,
          },
        })
      }

      // Add distance markers every 10km
      if (td && td.totalDist > 10000) {
        const markerInterval = 10000 // 10km
        let nextMarkerDist = markerInterval
        const markerPoints: Array<{ coord: [number, number]; km: number }> = []

        for (let i = 1; i < td.points.length; i++) {
          if (td.dists[i] >= nextMarkerDist) {
            markerPoints.push({
              coord: [td.points[i].lng, td.points[i].lat],
              km: Math.round(nextMarkerDist / 1000),
            })
            nextMarkerDist += markerInterval
          }
        }

        if (markerPoints.length > 0) {
          map.addSource('distance-markers', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: markerPoints.map(mp => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: mp.coord },
                properties: { km: mp.km },
              })),
            },
          })

          map.addLayer({
            id: 'distance-markers-layer',
            type: 'symbol',
            source: 'distance-markers',
            layout: {
              'text-field': ['concat', ['get', 'km'], ' km'],
              'text-size': 11,
              'text-offset': [0, 0.5],
              'text-anchor': 'top',
              'text-allow-overlap': true,
              'icon-image': '',
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 2,
            },
          })

          // Add small circle behind the marker
          map.addLayer({
            id: 'distance-markers-circle',
            type: 'circle',
            source: 'distance-markers',
            paint: {
              'circle-radius': 4,
              'circle-color': '#f59e0b',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.5,
            },
          }, 'distance-markers-layer')
        }
      }

      // Elevation labels at highest and lowest points
      if (td && td.points.length > 1) {
        const elevMarkers = []
        if (td.maxAltIdx >= 0) {
          elevMarkers.push({
            coord: [td.points[td.maxAltIdx].lng, td.points[td.maxAltIdx].lat] as [number, number],
            label: `↑ ${Math.round(td.maxAlt)}m`,
            color: '#ef4444',
            type: 'max',
          })
        }
        if (td.minAltIdx >= 0 && td.minAltIdx !== td.maxAltIdx) {
          elevMarkers.push({
            coord: [td.points[td.minAltIdx].lng, td.points[td.minAltIdx].lat] as [number, number],
            label: `↓ ${Math.round(td.minAlt)}m`,
            color: '#22c55e',
            type: 'min',
          })
        }

        if (elevMarkers.length > 0) {
          map.addSource('elevation-markers', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: elevMarkers.map(em => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: em.coord },
                properties: { label: em.label, color: em.color },
              })),
            },
          })

          map.addLayer({
            id: 'elevation-markers-circle',
            type: 'circle',
            source: 'elevation-markers',
            paint: {
              'circle-radius': 6,
              'circle-color': ['get', 'color'],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          })

          map.addLayer({
            id: 'elevation-markers-label',
            type: 'symbol',
            source: 'elevation-markers',
            layout: {
              'text-field': ['get', 'label'],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': '#000000',
              'text-halo-width': 2,
            },
          })
        }
      }

      // Start marker
      if (trackCoords.length > 0) {
        const startEl = document.createElement('div')
        startEl.innerHTML = `<div style="background:#22c55e;border:3px solid #fff;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;">S</div>`
        const ml = maplibreRef.current
        if (!ml) return

        new ml.Marker({ element: startEl })
          .setLngLat(trackCoords[0])
          .addTo(map)

        // End marker
        if (trackCoords.length > 1) {
          const endEl = document.createElement('div')
          endEl.innerHTML = `<div style="background:#ef4444;border:3px solid #fff;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;">E</div>`
          new ml.Marker({ element: endEl })
            .setLngLat(trackCoords[trackCoords.length - 1])
            .addTo(map)
        }
      }
    }

    // Add route data
    if (routeCoords.length > 0) {
      allCoords.push(...routeCoords)

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: routeCoords },
          properties: {},
        },
      })

      map.addLayer({
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

      map.addLayer({
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
      const ml = maplibreRef.current
      if (!ml) return
      const bounds = new ml.LngLatBounds()
      allCoords.forEach(c => bounds.extend(c))
      map.fitBounds(bounds, { padding: 60, pitch: currentPitch, bearing, duration: 1500 })
    }
  }, [trackPoints, routeCoords, trackData, currentPitch, bearing, mapStyle])

  // Switch map style
  useEffect(() => {
    if (!mapRef.current || !is3DReady) return
    const map = mapRef.current
    try {
      map.setStyle(buildStyle(mapStyle))
      map.once('style.load', () => {
        if (showTerrain) {
          try { map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 }) } catch {}
        }
        // Re-add 3D buildings
        if (showBuildings) {
          try {
            if (!map.getSource('openmaptiles')) {
              map.addSource('openmaptiles', {
                type: 'vector',
                tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
                maxzoom: 14,
                attribution: '&copy; OpenFreeMap &copy; OpenMapTiles &copy; OpenStreetMap',
              })
            }
            if (!map.getLayer('3d-buildings')) {
              map.addLayer({
                id: '3d-buildings',
                source: 'openmaptiles',
                'source-layer': 'building',
                type: 'fill-extrusion',
                minzoom: 12,
                paint: {
                  'fill-extrusion-color': mapStyle === 'dark' ? '#2a2a3a' : '#c8b89a',
                  'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
                  'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                  'fill-extrusion-opacity': mapStyle === 'dark' ? 0.7 : 0.6,
                },
              })
            }
          } catch {}
        }
        addTrackData(map)
      })
    } catch (err) {
      console.error('Style switch error:', err)
    }
  }, [mapStyle, is3DReady, buildStyle, showTerrain, showBuildings, addTrackData])

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

  // Toggle buildings
  useEffect(() => {
    if (!mapRef.current || !is3DReady) return
    try {
      const map = mapRef.current
      if (showBuildings) {
        if (!map.getSource('openmaptiles')) {
          map.addSource('openmaptiles', {
            type: 'vector',
            tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
            maxzoom: 14,
            attribution: '&copy; OpenFreeMap &copy; OpenMapTiles &copy; OpenStreetMap',
          })
        }
        if (!map.getLayer('3d-buildings')) {
          map.addLayer({
            id: '3d-buildings',
            source: 'openmaptiles',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': mapStyle === 'dark' ? '#2a2a3a' : '#c8b89a',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': mapStyle === 'dark' ? 0.7 : 0.6,
            },
          })
        } else {
          map.setLayoutProperty('3d-buildings', 'visibility', 'visible')
        }
      } else {
        if (map.getLayer('3d-buildings')) {
          map.setLayoutProperty('3d-buildings', 'visibility', 'none')
        }
      }
    } catch {}
  }, [showBuildings, is3DReady, mapStyle])

  // Draw elevation profile on canvas
  useEffect(() => {
    if (!canvasRef.current) return
    const td = trackData()
    if (!td || td.points.length < 2) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padX = 30
    const padY = 10
    const plotW = w - padX * 2
    const plotH = h - padY * 2

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.roundRect(0, 0, w, h, 8)
    ctx.fill()

    // Draw elevation area
    const altRange = Math.max(td.maxAlt - td.minAlt, 1)
    ctx.beginPath()
    ctx.moveTo(padX, padY + plotH)
    for (let i = 0; i < td.points.length; i++) {
      const x = padX + (i / (td.points.length - 1)) * plotW
      const y = padY + plotH - ((td.points[i].alt - td.minAlt) / altRange) * plotH
      ctx.lineTo(x, y)
    }
    ctx.lineTo(padX + plotW, padY + plotH)
    ctx.closePath()

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padY, 0, padY + plotH)
    gradient.addColorStop(0, 'rgba(239,68,68,0.4)')
    gradient.addColorStop(0.5, 'rgba(245,158,11,0.3)')
    gradient.addColorStop(1, 'rgba(34,197,94,0.2)')
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw elevation line
    ctx.beginPath()
    for (let i = 0; i < td.points.length; i++) {
      const x = padX + (i / (td.points.length - 1)) * plotW
      const y = padY + plotH - ((td.points[i].alt - td.minAlt) / altRange) * plotH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Alt labels
    ctx.fillStyle = '#ffffff'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(td.maxAlt)}m`, padX - 2, padY + 8)
    ctx.fillText(`${Math.round(td.minAlt)}m`, padX - 2, padY + plotH)

    // Distance labels
    ctx.textAlign = 'center'
    ctx.fillText('0', padX, h - 1)
    const totalKm = (td.totalDist / 1000).toFixed(0)
    ctx.fillText(`${totalKm}km`, padX + plotW, h - 1)
    if (td.totalDist > 20000) {
      ctx.fillText(`${Math.round(td.totalDist / 2000)}km`, padX + plotW / 2, h - 1)
    }

    // Current profile point
    if (profilePoint !== null && profilePoint >= 0 && profilePoint < td.points.length) {
      const px = padX + (profilePoint / (td.points.length - 1)) * plotW
      const py = padY + plotH - ((td.points[profilePoint].alt - td.minAlt) / altRange) * plotH

      // Vertical line
      ctx.beginPath()
      ctx.moveTo(px, padY)
      ctx.lineTo(px, padY + plotH)
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Dot
      ctx.beginPath()
      ctx.arc(px, py, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#f59e0b'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Label
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(td.points[profilePoint].alt)}m`, px, py - 8)
    }
  }, [trackData, profilePoint, is3DReady])

  // Handle elevation profile click
  const handleProfileClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const td = trackData()
    if (!td || td.points.length < 2 || !mapRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const padX = 30
    const plotW = rect.width - padX * 2
    const t = Math.max(0, Math.min(1, (x - padX) / plotW))
    const idx = Math.round(t * (td.points.length - 1))

    setProfilePoint(idx)
    mapRef.current.flyTo({
      center: [td.points[idx].lng, td.points[idx].lat],
      zoom: Math.max(mapRef.current.getZoom(), 13),
      pitch: currentPitch,
      duration: 1000,
    })
  }, [trackData, currentPitch])

  // Fly along track animation
  const startFlyAlong = useCallback(() => {
    const td = trackData()
    if (!td || td.points.length < 2 || !mapRef.current) return

    setIsFlying(true)
    const map = mapRef.current
    let currentIndex = 0
    const stepInterval = Math.max(1, Math.floor(td.points.length / 200)) // ~200 steps
    const delayMs = Math.max(20, 80 / flySpeed)

    const step = () => {
      if (currentIndex >= td.points.length || !mapRef.current) {
        setIsFlying(false)
        return
      }

      const p = td.points[currentIndex]
      map.easeTo({
        center: [p.lng, p.lat],
        pitch: currentPitch,
        duration: delayMs,
        easing: (t) => t,
      })

      setProfilePoint(currentIndex)
      currentIndex += stepInterval

      flyAnimRef.current = window.setTimeout(() => {
        flyAnimRef.current = requestAnimationFrame(step)
      }, delayMs)
    }

    step()
  }, [trackData, currentPitch, flySpeed])

  const stopFlyAlong = useCallback(() => {
    if (flyAnimRef.current) {
      clearTimeout(flyAnimRef.current)
      cancelAnimationFrame(flyAnimRef.current)
      flyAnimRef.current = null
    }
    setIsFlying(false)
  }, [])

  const handleResetView = useCallback(() => {
    if (!mapRef.current) return
    const allCoords: Array<[number, number]> = [
      ...trackPoints.map(p => [p.lng, p.lat] as [number, number]),
      ...routeCoords,
    ]
    if (allCoords.length > 1) {
      // Compute bounds manually
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
      allCoords.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      })
      const map = mapRef.current
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, pitch: currentPitch, bearing, duration: 1500 })
    } else {
      mapRef.current.easeTo({ center, zoom, pitch: currentPitch, bearing, duration: 1000 })
    }
  }, [trackPoints, routeCoords, center, zoom, currentPitch, bearing])

  const td = trackData()

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
          {td && (
            <Badge variant="outline" className="bg-black/40 text-white/80 border-white/20 text-[10px]">
              {td.points.length} točk · {(td.totalDist / 1000).toFixed(1)}km · {Math.round(td.minAlt)}-{Math.round(td.maxAlt)}m
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 pointer-events-auto">
          {onClose && (
            <Button variant="ghost" size="icon" className="size-8 rounded-full bg-black/40 hover:bg-black/60 text-white" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Map style selector */}
      <div className="absolute top-12 left-3 z-10 flex flex-col gap-1">
        {(['topo', 'satellite', 'dark'] as MapStyle[]).map(s => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-[10px] rounded-full backdrop-blur ${
              mapStyle === s
                ? 'bg-amber-500/80 text-white hover:bg-amber-600/80'
                : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'
            }`}
            onClick={() => setMapStyle(s)}
          >
            {s === 'topo' ? '🗺️ Topo' : s === 'satellite' ? '🛰️ Sat' : '🌙 Tema'}
          </Button>
        ))}
      </div>

      {/* Fly-along controls */}
      {td && td.points.length > 2 && (
        <div className="absolute top-12 right-3 z-10 flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-[10px] rounded-full backdrop-blur ${
              isFlying
                ? 'bg-rose-500/80 text-white hover:bg-rose-600/80'
                : 'bg-amber-500/80 text-white hover:bg-amber-600/80'
            }`}
            onClick={isFlying ? stopFlyAlong : startFlyAlong}
          >
            {isFlying ? <Pause className="size-3 mr-1" /> : <Play className="size-3 mr-1" />}
            {isFlying ? 'Ustavi' : 'Poleti'}
          </Button>
          {isFlying && (
            <div className="flex gap-0.5">
              {([1, 2, 5] as FlySpeed[]).map(sp => (
                <Button
                  key={sp}
                  variant="ghost"
                  size="sm"
                  className={`h-5 px-1.5 text-[9px] rounded-full backdrop-blur ${
                    flySpeed === sp
                      ? 'bg-white/40 text-white'
                      : 'bg-black/40 text-white/60 hover:text-white/80'
                  }`}
                  onClick={() => setFlySpeed(sp)}
                >
                  {sp}x
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-32 left-4 right-4 z-10 flex items-end justify-between gap-3">
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
          <Button
            variant="secondary"
            size="icon"
            className={`size-10 rounded-full shadow-lg backdrop-blur ${showBuildings ? 'bg-amber-600/80 hover:bg-amber-700/80 text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}
            onClick={() => setShowBuildings(!showBuildings)}
            title={showBuildings ? 'Skrij zgradbe' : 'Prikaži zgradbe'}
          >
            <Building2 className="size-4" />
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
              Nagib: {currentPitch}° {showTerrain ? '· Teren' : ''} {showBuildings ? '· Zgradbe' : ''}
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

      {/* Mini Elevation Profile */}
      {td && td.points.length > 1 && (
        <div className="absolute bottom-2 left-4 right-4 z-10 h-20">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-pointer rounded-lg"
            onClick={handleProfileClick}
          />
        </div>
      )}
    </div>
  )
}
