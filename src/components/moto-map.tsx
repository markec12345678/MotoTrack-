'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { poiTypeEmoji, poiTypeColor, poiTypeLabel } from '@/components/tabs/types'

interface MotoMapProps {
  center?: [number, number]
  zoom?: number
  rides: Array<{
    id: string
    title: string
    distance: number
    startLat?: number | null
    startLng?: number | null
    trackData: string
  }>
  routes: Array<{
    id: string
    title: string
    distance: number
    category: string
    likes: number
    waypoints: string
    routeData: string | null
  }>
  pois?: Array<{
    id: string
    name: string
    type: string
    lat: number
    lng: number
    description: string | null
    rating: number
  }>
  planWaypoints?: Array<{ lat: number; lng: number }>
  trackPoints?: Array<{ lat: number; lng: number }>
  showPlan?: boolean
  showTrack?: boolean
  onMapClick?: (lat: number, lng: number) => void
  filterRides?: boolean
  filterRoutes?: boolean
  filterCategory?: string
  filterPoiTypes?: string[]
  showTwistyRoads?: boolean
  showWeatherRadar?: boolean
  showHazards?: boolean
  className?: string
}

const categoryColors: Record<string, string> = {
  scenic: '#22c55e',
  twisty: '#f59e0b',
  offroad: '#f97316',
  city: '#3b82f6',
}

const catLabels: Record<string, string> = {
  scenic: 'Slikovito',
  twisty: 'Vijugasto',
  offroad: 'Terensko',
  city: 'Mesto',
}

// Custom SVG marker for rides (motorcycle icon)
function createRideMarker(title: string, distance: number): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      <div style="position:absolute;inset:0;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:1;">
        <circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/>
        <path d="M5 18h3l2-6h4l2 6h3"/>
        <path d="M10 12l1-4h2"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

// Custom SVG marker for routes (route/flag icon)
function createRouteMarker(category: string, title: string, likes: number): L.DivIcon {
  const color = categoryColors[category] || '#3b82f6'
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      <div style="position:absolute;inset:0;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:1;">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

// Custom POI marker
function createPoiMarker(type: string, name: string): L.DivIcon {
  const emoji = poiTypeEmoji(type)
  const color = poiTypeColor(type)
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
      <div style="position:absolute;inset:0;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
      <span style="position:relative;z-index:1;font-size:13px;line-height:1;">${emoji}</span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

export default function MotoMap({
  center = [46.15, 14.99],
  zoom = 8,
  rides = [],
  routes = [],
  pois = [],
  planWaypoints = [],
  trackPoints = [],
  showPlan = false,
  showTrack = false,
  onMapClick,
  filterRides = true,
  filterRoutes = true,
  filterCategory = 'all',
  filterPoiTypes = [],
  showTwistyRoads = false,
  showWeatherRadar = false,
  showHazards = false,
  className = '',
}: MotoMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<{
    rides: L.LayerGroup
    routes: L.LayerGroup
    plan: L.LayerGroup
    track: L.LayerGroup
    pois: L.LayerGroup
    overlays: L.LayerGroup
  } | null>(null)
  const overlayLayersRef = useRef<{ twisty?: L.TileLayer; weather?: L.TileLayer }>({})

  // Initialize map
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clean up any previous Leaflet instance on this container (React Strict Mode)
    const existingMap = mapRef.current
    if (existingMap) {
      existingMap.remove()
      mapRef.current = null
    }
    // Clear Leaflet's internal container ID so a new map can be created
    const containerEl = container as HTMLDivElement & { _leaflet_id?: number }
    delete containerEl._leaflet_id

    const map = L.map(container, {
      center,
      zoom,
      zoomControl: false,
    })

    // Add zoom control to top-left
    L.control.zoom({ position: 'topleft' }).addTo(map)

    // Tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    // Layer groups
    const ridesLayer = L.layerGroup().addTo(map)
    const routesLayer = L.layerGroup().addTo(map)
    const planLayer = L.layerGroup().addTo(map)
    const trackLayer = L.layerGroup().addTo(map)
    const poisLayer = L.layerGroup().addTo(map)
    const overlaysLayer = L.layerGroup().addTo(map)

    layersRef.current = {
      rides: ridesLayer,
      routes: routesLayer,
      plan: planLayer,
      track: trackLayer,
      pois: poisLayer,
      overlays: overlaysLayer,
    }

    // Map click handler
    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng)
      })
    }

    mapRef.current = map

    // Fix size issue - guard against map being removed before timeout fires
    const timerId = setTimeout(() => {
      if (mapRef.current === map) {
        try { map.invalidateSize() } catch { /* map already removed */ }
      }
    }, 100)

    return () => {
      clearTimeout(timerId)
      map.remove()
      mapRef.current = null
      layersRef.current = null
      overlayLayersRef.current = {}
    }
  }, [])

  // Update rides layer
  useEffect(() => {
    if (!layersRef.current) return
    const layer = layersRef.current.rides
    layer.clearLayers()

    if (!filterRides) return

    rides.forEach((ride) => {
      if (!ride.startLat || !ride.startLng) return

      // Custom marker
      const marker = L.marker([ride.startLat, ride.startLng], {
        icon: createRideMarker(ride.title, ride.distance),
      }).addTo(layer)

      marker.bindPopup(`
        <div style="min-width:160px">
          <strong>${ride.title}</strong><br/>
          <span style="color:#888">${ride.distance} km</span><br/>
          <span style="background:#f59e0b22;color:#d97706;padding:2px 6px;border-radius:4px;font-size:11px">🏍️ Vožnja</span>
        </div>
      `)

      // Track polyline
      try {
        const track = JSON.parse(ride.trackData)
        if (Array.isArray(track) && track.length > 1) {
          const coords: L.LatLngExpression[] = track.map(
            (p: number[]) => [p[0], p[1]] as L.LatLngExpression
          )
          L.polyline(coords, {
            color: '#f59e0b',
            weight: 3,
            opacity: 0.7,
          }).addTo(layer)
        }
      } catch {
        // ignore
      }
    })
  }, [rides, filterRides])

  // Update routes layer
  useEffect(() => {
    if (!layersRef.current) return
    const layer = layersRef.current.routes
    layer.clearLayers()

    if (!filterRoutes) return

    routes.forEach((route) => {
      // Filter by category
      if (filterCategory !== 'all' && route.category !== filterCategory) return

      try {
        const wp = JSON.parse(route.waypoints)
        if (!Array.isArray(wp) || wp.length === 0) return

        const color = categoryColors[route.category] || '#3b82f6'

        // Custom route marker
        const marker = L.marker([wp[0].lat, wp[0].lng], {
          icon: createRouteMarker(route.category, route.title, route.likes),
        }).addTo(layer)

        marker.bindPopup(`
          <div style="min-width:160px">
            <strong>${route.title}</strong><br/>
            <span style="color:#888">${route.distance} km · ❤️ ${route.likes}</span><br/>
            <span style="background:${color}22;color:${color};padding:2px 6px;border-radius:4px;font-size:11px">${catLabels[route.category] || route.category}</span>
          </div>
        `)

        // Route polyline
        if (route.routeData) {
          const rd = JSON.parse(route.routeData)
          if (Array.isArray(rd) && rd.length > 1) {
            const coords: L.LatLngExpression[] = rd.map(
              (p: number[]) => [p[0], p[1]] as L.LatLngExpression
            )
            L.polyline(coords, {
              color: color,
              weight: 3,
              opacity: 0.7,
              dashArray: '8 6',
            }).addTo(layer)
          }
        }
      } catch {
        // ignore
      }
    })
  }, [routes, filterRoutes, filterCategory])

  // Update POI layer
  useEffect(() => {
    if (!layersRef.current) return
    const layer = layersRef.current.pois
    layer.clearLayers()

    pois.forEach((poi) => {
      // Check filter - if filterPoiTypes is empty, show none
      if (!filterPoiTypes.includes(poi.type)) return

      const marker = L.marker([poi.lat, poi.lng], {
        icon: createPoiMarker(poi.type, poi.name),
      }).addTo(layer)

      const color = poiTypeColor(poi.type)
      const emoji = poiTypeEmoji(poi.type)
      const label = poiTypeLabel(poi.type)
      const stars = '★'.repeat(Math.round(poi.rating)) + '☆'.repeat(5 - Math.round(poi.rating))

      marker.bindPopup(`
        <div style="min-width:180px">
          <strong style="font-size:14px">${poi.name}</strong><br/>
          <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin:4px 0">${emoji} ${label}</span><br/>
          ${poi.description ? `<span style="color:#666;font-size:12px;display:block;margin:4px 0">${poi.description}</span>` : ''}
          <span style="color:#f59e0b;font-size:12px">${stars}</span>
          <span style="color:#888;font-size:11px;margin-left:4px">${poi.rating.toFixed(1)}</span>
        </div>
      `)
    })
  }, [pois, filterPoiTypes])

  // Update plan waypoints
  useEffect(() => {
    if (!layersRef.current || !showPlan) return
    const layer = layersRef.current.plan
    layer.clearLayers()

    planWaypoints.forEach((wp, i) => {
      const color = i === 0 ? '#22c55e' : i === planWaypoints.length - 1 ? '#ef4444' : '#f59e0b'
      L.circleMarker([wp.lat, wp.lng], {
        radius: 7,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .addTo(layer)
        .bindPopup(`Točka ${i + 1}`)
    })

    if (planWaypoints.length > 1) {
      const coords: L.LatLngExpression[] = planWaypoints.map(
        (wp) => [wp.lat, wp.lng] as L.LatLngExpression
      )
      L.polyline(coords, {
        color: '#f59e0b',
        weight: 4,
        opacity: 0.8,
      }).addTo(layer)
    }
  }, [planWaypoints, showPlan])

  // Update track points
  useEffect(() => {
    if (!layersRef.current || !showTrack) return
    const layer = layersRef.current.track
    layer.clearLayers()

    if (trackPoints.length > 1) {
      const coords: L.LatLngExpression[] = trackPoints.map(
        (p) => [p.lat, p.lng] as L.LatLngExpression
      )
      L.polyline(coords, {
        color: '#f59e0b',
        weight: 4,
        opacity: 0.9,
      }).addTo(layer)
    }

    // Current position
    if (trackPoints.length > 0) {
      const last = trackPoints[trackPoints.length - 1]
      L.circleMarker([last.lat, last.lng], {
        radius: 10,
        fillColor: '#f59e0b',
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(layer)
    }
  }, [trackPoints, showTrack])

  // Update twisty roads overlay
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    // Remove existing twisty layer
    if (overlayLayersRef.current.twisty) {
      map.removeLayer(overlayLayersRef.current.twisty)
      overlayLayersRef.current.twisty = undefined
    }

    if (showTwistyRoads) {
      // Use OpenStreetMap cycle map to highlight curvy roads visually
      // Also add a custom overlay that shows route difficulty by color
      const twistyLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap',
        maxZoom: 17,
        opacity: 0.6,
      })
      twistyLayer.addTo(map)
      overlayLayersRef.current.twisty = twistyLayer

      // Add twisty road indicators for known Slovenian passes
      if (layersRef.current) {
        const overlayLayer = layersRef.current.overlays
        // Clear old overlays
        overlayLayer.clearLayers()

        // Known twisty roads in Slovenia with difficulty ratings
        const twistyRoads = [
          { name: 'Prelaz Vršič', desc: '50 klancev - ZELO ZAHTEVNO', lat: 46.4333, lng: 13.7333, difficulty: 'hard', color: '#ef4444' },
          { name: 'Prelaz Predel', desc: 'Strme serpentine', lat: 46.3833, lng: 13.5667, difficulty: 'hard', color: '#ef4444' },
          { name: 'Prelaz Mangart', desc: 'Najvišji cestni prelaz v SLO', lat: 46.4500, lng: 13.6333, difficulty: 'extreme', color: '#dc2626' },
          { name: 'Jezersko - Preval', desc: 'Zavite gorske ceste', lat: 46.4000, lng: 14.8500, difficulty: 'medium', color: '#f59e0b' },
          { name: 'Gorjanci', desc: 'Krasne vijugaste ceste', lat: 45.8000, lng: 15.1667, difficulty: 'medium', color: '#f59e0b' },
          { name: 'Pohorje', desc: 'Gozdne klance', lat: 46.5000, lng: 15.5500, difficulty: 'medium', color: '#f59e0b' },
          { name: 'Col - Predmeja', desc: 'Vijugaste ceste Notranjske', lat: 45.7500, lng: 14.2500, difficulty: 'easy', color: '#22c55e' },
          { name: 'Cerkno - Škofja Loka', desc: 'Slikovite vijugaste ceste', lat: 46.1167, lng: 14.0500, difficulty: 'easy', color: '#22c55e' },
        ]

        twistyRoads.forEach(road => {
          const marker = L.circleMarker([road.lat, road.lng], {
            radius: 10,
            fillColor: road.color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85,
          }).addTo(overlayLayer)

          const diffLabel = road.difficulty === 'extreme' ? 'Ekstremno' : road.difficulty === 'hard' ? 'Zahtevno' : road.difficulty === 'medium' ? 'Srednje' : 'Lahko'
          marker.bindPopup(`
            <div style="min-width:180px">
              <strong style="font-size:14px">🔄 ${road.name}</strong><br/>
              <span style="color:#666;font-size:12px;display:block;margin:4px 0">${road.desc}</span>
              <span style="background:${road.color}22;color:${road.color};padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block">Vijugasto: ${diffLabel}</span>
            </div>
          `)
        })
      }
    } else {
      // Clear overlays when twisty roads hidden
      if (layersRef.current) {
        layersRef.current.overlays.clearLayers()
      }
    }
  }, [showTwistyRoads])

  // Update weather radar overlay
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    // Remove existing weather layer
    if (overlayLayersRef.current.weather) {
      map.removeLayer(overlayLayersRef.current.weather)
      overlayLayersRef.current.weather = undefined
    }

    if (showWeatherRadar) {
      // RainViewer radar overlay (free, no API key needed)
      const weatherLayer = L.tileLayer('https://tilecache.rainviewer.com/v2/radar/latest/256/{z}/{x}/{y}/6/1_1.png', {
        attribution: '© RainViewer',
        maxZoom: 19,
        opacity: 0.5,
      })
      weatherLayer.addTo(map)
      overlayLayersRef.current.weather = weatherLayer
    }
  }, [showWeatherRadar])

  // Update hazards overlay
  useEffect(() => {
    if (!layersRef.current) return
    // We reuse the overlays layer for hazards when twisty roads are off
    // Only add hazards if twisty roads aren't using the overlay layer
    if (!showTwistyRoads) {
      const layer = layersRef.current.overlays
      layer.clearLayers()

      if (showHazards) {
        // Known hazard locations in Slovenia
        const hazards = [
          { name: 'Hitrostna past Ljubljana', desc: 'Hitrostna kamera na Ljubljanski obvoznici', lat: 46.0750, lng: 14.5300, type: 'speed_camera', icon: '📸' },
          { name: 'Hitrostna past Maribor', desc: 'Hitrostna kamera na Mariborski obvoznici', lat: 46.5400, lng: 15.6200, type: 'speed_camera', icon: '📸' },
          { name: 'Plazovito območje Vršič', desc: 'Nevarnost padanja kamenja spomladi', lat: 46.4400, lng: 13.7200, type: 'rockfall', icon: '🪨' },
          { name: 'Zdrsna cesta Predel', desc: 'Nevarnost zdrsa pri mrazu', lat: 46.3850, lng: 13.5600, type: 'slippery', icon: '⚠️' },
          { name: 'Divjad Soška dolina', desc: 'Pogost prehod divjadi čez cesto', lat: 46.3200, lng: 13.6000, type: 'wildlife', icon: '🦌' },
          { name: 'Zdrsna cesta Mangart', desc: 'Izjemno drsna cesta pri mokri podlagi', lat: 46.4550, lng: 13.6400, type: 'slippery', icon: '⚠️' },
          { name: 'Delnice na Gorenjski', desc: 'Cesta v popravilu - zavozljivo', lat: 46.2000, lng: 14.2000, type: 'construction', icon: '🚧' },
          { name: 'Omejitev 30 Ljubljana center', desc: 'Omejitev hitrosti 30 km/h', lat: 46.0500, lng: 14.5050, type: 'speed_limit', icon: '🔢' },
        ]

        const hazardColors: Record<string, string> = {
          speed_camera: '#ef4444',
          rockfall: '#f97316',
          slippery: '#eab308',
          wildlife: '#8b5cf6',
          construction: '#f59e0b',
          speed_limit: '#3b82f6',
        }

        hazards.forEach(hazard => {
          const color = hazardColors[hazard.type] || '#6b7280'
          const marker = L.circleMarker([hazard.lat, hazard.lng], {
            radius: 9,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85,
          }).addTo(layer)

          marker.bindPopup(`
            <div style="min-width:180px">
              <strong style="font-size:14px">${hazard.icon} ${hazard.name}</strong><br/>
              <span style="color:#666;font-size:12px;display:block;margin:4px 0">${hazard.desc}</span>
              <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block">Opozorilo</span>
            </div>
          `)
        })
      }
    }
  }, [showHazards, showTwistyRoads])

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ minHeight: '300px' }}
    />
  )
}
