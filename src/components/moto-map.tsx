'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { poiTypeEmoji, poiTypeColor, poiTypeLabel } from '@/components/tabs/types'
import type { LiveRider, HazardData, RoadRatingData, TripDayData } from '@/components/tabs/types'

interface FriendRideData {
  id: string
  title: string
  distance: number
  startLat?: number | null
  startLng?: number | null
  trackData: string
  userName: string
}

const ratingColors: Record<number, string> = {
  5: '#22c55e',
  4: '#84cc16',
  3: '#eab308',
  2: '#f97316',
  1: '#ef4444',
}

const surfaceIcons: Record<string, string> = {
  asphalt: '🛣️',
  gravel: '🪨',
  dirt: '🌱',
  mixed: '🔀',
}

const surfaceLabels: Record<string, string> = {
  asphalt: 'Asfalt',
  gravel: 'Makadam',
  dirt: 'Zemlja',
  mixed: 'Mešano',
}

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
  liveRiders?: LiveRider[]
  dbHazards?: HazardData[]
  friendRides?: FriendRideData[]
  showFriendRides?: boolean
  fuelRange?: number // range in km
  fuelCenter?: { lat: number; lng: number }
  parkedLocation?: { lat: number; lng: number; note?: string; parkedAt?: string }
  flyToLocation?: { lat: number; lng: number; zoom?: number }
  userPosition?: { lat: number; lng: number } | null
  roadRatings?: RoadRatingData[]
  tripDays?: TripDayData[]
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
  showBalkanRoads?: boolean
  className?: string
}

const categoryColors: Record<string, string> = {
  scenic: '#22c55e',
  twisty: '#f59e0b',
  offroad: '#f97316',
  city: '#3b82f6',
  snowmobile: '#06b6d4',
  racetrack: '#dc2626',
}

const catLabels: Record<string, string> = {
  scenic: 'Slikovito',
  twisty: 'Vijugasto',
  offroad: 'Terensko',
  city: 'Mesto',
  snowmobile: 'Snežni skuter',
  racetrack: 'Dirkališče',
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

// Custom friend ride marker (blue with user icon)
function createFriendRideMarker(name: string, title: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      <div style="position:absolute;inset:0;background:#3b82f6;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:1;">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
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
  liveRiders = [],
  dbHazards = [],
  friendRides = [],
  showFriendRides = false,
  fuelRange,
  fuelCenter,
  parkedLocation,
  flyToLocation,
  userPosition,
  roadRatings = [],
  tripDays = [],
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
  showBalkanRoads = false,
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
    live: L.LayerGroup
    friends: L.LayerGroup
  } | null>(null)
  const overlayLayersRef = useRef<{ twisty?: L.TileLayer; weather?: L.TileLayer }>({})
  const fuelCircleRef = useRef<L.Circle | null>(null)
  const fuelLabelRef = useRef<L.Marker | null>(null)
  const parkingMarkerRef = useRef<L.Marker | null>(null)
  const userPositionMarkerRef = useRef<L.Marker | null>(null)
  const roadRatingsLayerRef = useRef<L.LayerGroup | null>(null)
  const tripLayerRef = useRef<L.LayerGroup | null>(null)
  const balkanRoadsLayerRef = useRef<L.LayerGroup | null>(null)

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
    const liveLayer = L.layerGroup().addTo(map)
    const friendsLayer = L.layerGroup().addTo(map)
    const roadRatingsLayer = L.layerGroup().addTo(map)
    roadRatingsLayerRef.current = roadRatingsLayer
    const tripLayer = L.layerGroup().addTo(map)
    tripLayerRef.current = tripLayer
    const balkanRoadsLayer = L.layerGroup().addTo(map)
    balkanRoadsLayerRef.current = balkanRoadsLayer

    layersRef.current = {
      rides: ridesLayer,
      routes: routesLayer,
      plan: planLayer,
      track: trackLayer,
      pois: poisLayer,
      overlays: overlaysLayer,
      live: liveLayer,
      friends: friendsLayer,
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
      if (fuelCircleRef.current) { fuelCircleRef.current = null }
      if (fuelLabelRef.current) { fuelLabelRef.current = null }
      if (parkingMarkerRef.current) { parkingMarkerRef.current = null }
      if (userPositionMarkerRef.current) { userPositionMarkerRef.current = null }
      if (roadRatingsLayerRef.current) { roadRatingsLayerRef.current = null }
      if (tripLayerRef.current) { tripLayerRef.current = null }
      if (balkanRoadsLayerRef.current) { balkanRoadsLayerRef.current = null }
    }
  }, [])

  // Fly to location
  useEffect(() => {
    if (!mapRef.current || !flyToLocation) return
    const map = mapRef.current
    map.flyTo([flyToLocation.lat, flyToLocation.lng], flyToLocation.zoom ?? 16, {
      duration: 1.5,
    })
  }, [flyToLocation])

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

  // Update Balkan motorcycle roads overlay (Butler Maps equivalent - polyline routes)
  useEffect(() => {
    const layer = balkanRoadsLayerRef.current
    if (!layer) return
    layer.clearLayers()

    if (!showBalkanRoads) return

    // Detailed route coordinates tracing actual road paths across the Balkans
    const balkanRoadRoutes = [
      // Slovenia - Vršič Pass (50 hairpin turns)
      { name: 'Vršič', difficulty: 'extreme', country: 'SI', length: 18,
        coords: [[46.3500,13.7100],[46.3700,13.7200],[46.3900,13.7300],[46.4000,13.7280],[46.4100,13.7250],[46.4200,13.7280],[46.4300,13.7310],[46.4333,13.7333]] },
      // Slovenia - Mangart
      { name: 'Mangart', difficulty: 'challenging', country: 'SI', length: 12,
        coords: [[46.4300,13.6100],[46.4350,13.6150],[46.4400,13.6200],[46.4450,13.6250],[46.4500,13.6333]] },
      // Slovenia - Predel Pass
      { name: 'Predel', difficulty: 'challenging', country: 'SI', length: 15,
        coords: [[46.3600,13.5500],[46.3650,13.5550],[46.3700,13.5600],[46.3750,13.5630],[46.3800,13.5660],[46.3833,13.5667]] },
      // Slovenia - Soča Valley
      { name: 'Soška dolina', difficulty: 'moderate', country: 'SI', length: 40,
        coords: [[46.1800,13.6800],[46.2000,13.6700],[46.2200,13.6600],[46.2400,13.6500],[46.2600,13.6400],[46.2800,13.6300]] },
      // Croatia - Jadranska Magistrala (Adriatic Highway)
      { name: 'Jadranska magistrala', difficulty: 'easy', country: 'HR', length: 180,
        coords: [[45.3000,14.5000],[45.1000,14.6000],[44.9000,14.8000],[44.7000,15.0000],[44.4000,15.2000],[44.1000,15.4000],[43.8000,15.8000],[43.5000,16.2000],[43.3000,16.4500]] },
      // Croatia - Mali Alan (Velebit)
      { name: 'Mali Alan', difficulty: 'challenging', country: 'HR', length: 25,
        coords: [[44.3500,15.4000],[44.3700,15.4300],[44.3900,15.4600],[44.4000,15.5000]] },
      // Montenegro - Kotor Serpentine
      { name: 'Kotor Serpentine', difficulty: 'extreme', country: 'ME', length: 16,
        coords: [[42.4200,18.7700],[42.4100,18.7800],[42.4000,18.7900],[42.3900,18.8000],[42.3850,18.8100],[42.3800,18.8200],[42.3750,18.8300],[42.3700,18.8400],[42.3650,18.8500]] },
      // Montenegro - Lovćen
      { name: 'Lovćen', difficulty: 'challenging', country: 'ME', length: 20,
        coords: [[42.3600,18.8300],[42.3700,18.8400],[42.3800,18.8500]] },
      // Romania - Transfăgărășan
      { name: 'Transfăgărășan', difficulty: 'extreme', country: 'RO', length: 90,
        coords: [[45.5500,24.6000],[45.5600,24.6200],[45.5700,24.6300],[45.5800,24.6200],[45.5900,24.6200],[45.6000,24.6300],[45.6100,24.6400]] },
      // Romania - Transalpina
      { name: 'Transalpina', difficulty: 'extreme', country: 'RO', length: 120,
        coords: [[45.4000,23.6000],[45.4100,23.6500],[45.4200,23.7000],[45.4300,23.7200],[45.4400,23.7500],[45.4500,23.8000]] },
      // Albania - Llogara Pass
      { name: 'Llogara Pass', difficulty: 'challenging', country: 'AL', length: 30,
        coords: [[40.1500,19.5500],[40.1600,19.5600],[40.1700,19.5700],[40.1800,19.5800]] },
      // Albania - Theth
      { name: 'Theth', difficulty: 'extreme', country: 'AL', length: 35,
        coords: [[42.3500,19.7300],[42.3600,19.7400],[42.3700,19.7500],[42.3800,19.7700]] },
      // Austria - Grossglockner
      { name: 'Grossglockner', difficulty: 'extreme', country: 'AT', length: 48,
        coords: [[47.0500,12.8000],[47.0600,12.8100],[47.0700,12.8200],[47.0800,12.8300],[47.0900,12.8400]] },
      // Bulgaria - Shipka Pass
      { name: 'Shipka', difficulty: 'challenging', country: 'BG', length: 30,
        coords: [[42.6900,25.3000],[42.7000,25.3100],[42.7100,25.3300]] },
      // Serbia - Zlatibor
      { name: 'Zlatibor', difficulty: 'moderate', country: 'RS', length: 25,
        coords: [[43.7000,19.6800],[43.7100,19.6900],[43.7200,19.7000]] },
      // Bosnia - Ivan Sedlo
      { name: 'Ivan Sedlo', difficulty: 'moderate', country: 'BA', length: 18,
        coords: [[43.6800,18.0300],[43.6900,18.0400],[43.7000,18.0500]] },
      // Greece - Katara Pass
      { name: 'Katara Pass', difficulty: 'challenging', country: 'GR', length: 40,
        coords: [[39.7500,21.2000],[39.7600,21.2100],[39.7700,21.2300]] },
      // Slovenia - Jezersko
      { name: 'Jezersko', difficulty: 'moderate', country: 'SI', length: 22,
        coords: [[46.3800,14.8200],[46.3900,14.8300],[46.4000,14.8500]] },
      // Slovenia - Gorjanci
      { name: 'Gorjanci', difficulty: 'moderate', country: 'SI', length: 30,
        coords: [[45.8300,15.1400],[45.8200,15.1500],[45.8100,15.1600],[45.8000,15.1667]] },
      // Croatia - Pelješac
      { name: 'Pelješac', difficulty: 'easy', country: 'HR', length: 55,
        coords: [[43.0000,17.3500],[42.9800,17.4000],[42.9600,17.4300],[42.9500,17.4500]] },
      // Montenegro - Durmitor
      { name: 'Durmitor', difficulty: 'challenging', country: 'ME', length: 28,
        coords: [[43.1300,19.1000],[43.1400,19.1100],[43.1500,19.1200]] },
    ]

    const difficultyConfig: Record<string, { color: string; weight: number; label: string }> = {
      easy: { color: '#22c55e', weight: 4, label: 'Lahko' },
      moderate: { color: '#f59e0b', weight: 5, label: 'Zmerno' },
      challenging: { color: '#f97316', weight: 6, label: 'Zahtevno' },
      extreme: { color: '#ef4444', weight: 7, label: 'Ekstremno' },
    }

    balkanRoadRoutes.forEach(road => {
      const config = difficultyConfig[road.difficulty] || { color: '#6b7280', weight: 4, label: road.difficulty }
      const coords: L.LatLngExpression[] = road.coords.map(
        (c: number[]) => [c[0], c[1]] as L.LatLngExpression
      )

      // For extreme difficulty: add glow effect (wide translucent line underneath)
      if (road.difficulty === 'extreme') {
        L.polyline(coords, {
          color: config.color,
          weight: 14,
          opacity: 0.3,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer)
      }

      // Main route polyline
      L.polyline(coords, {
        color: config.color,
        weight: config.weight,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer)

      // Circle marker at the start of each road
      const startCoord = road.coords[0]
      const marker = L.circleMarker([startCoord[0], startCoord[1]], {
        radius: 7,
        fillColor: config.color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      }).addTo(layer)

      marker.bindPopup(`
        <div style="min-width:200px">
          <strong style="font-size:14px">🗺️ ${road.name}</strong><br/>
          <span style="background:${config.color}22;color:${config.color};padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin:4px 2px">${config.label}</span>
          <span style="background:#6b728022;color:#6b7280;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin:4px 2px">${road.country}</span>
          <span style="color:#888;font-size:12px;display:block;margin-top:4px">📏 ${road.length} km</span>
        </div>
      `)
    })
  }, [showBalkanRoads])

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

  // Update hazards overlay - use DB hazards when available
  useEffect(() => {
    if (!layersRef.current) return
    if (!showTwistyRoads) {
      const layer = layersRef.current.overlays
      layer.clearLayers()

      if (showHazards) {
        const hazardColors: Record<string, string> = {
          speed_camera: '#ef4444',
          rockfall: '#f97316',
          slippery: '#eab308',
          wildlife: '#8b5cf6',
          construction: '#f59e0b',
          speed_limit: '#3b82f6',
          accident: '#dc2626',
        }

        const hazardIcons: Record<string, string> = {
          speed_camera: '📸',
          rockfall: '🪨',
          slippery: '⚠️',
          wildlife: '🦌',
          construction: '🚧',
          speed_limit: '🔢',
          accident: '🆘',
        }

        // Use DB hazards if available, otherwise fallback to hardcoded
        const hazards = dbHazards.length > 0
          ? dbHazards.map(h => ({ name: h.name, desc: h.description || '', lat: h.lat, lng: h.lng, type: h.type, icon: hazardIcons[h.type] || '⚠️' }))
          : [
              { name: 'Hitrostna past Ljubljana', desc: 'Hitrostna kamera na Ljubljanski obvoznici', lat: 46.0750, lng: 14.5300, type: 'speed_camera', icon: '📸' },
              { name: 'Hitrostna past Maribor', desc: 'Hitrostna kamera na Mariborski obvoznici', lat: 46.5400, lng: 15.6200, type: 'speed_camera', icon: '📸' },
              { name: 'Plazovito območje Vršič', desc: 'Nevarnost padanja kamenja spomladi', lat: 46.4400, lng: 13.7200, type: 'rockfall', icon: '🪨' },
              { name: 'Zdrsna cesta Predel', desc: 'Nevarnost zdrsa pri mrazu', lat: 46.3850, lng: 13.5600, type: 'slippery', icon: '⚠️' },
              { name: 'Divjad Soška dolina', desc: 'Pogost prehod divjadi čez cesto', lat: 46.3200, lng: 13.6000, type: 'wildlife', icon: '🦌' },
              { name: 'Zdrsna cesta Mangart', desc: 'Izjemno drsna cesta pri mokri podlagi', lat: 46.4550, lng: 13.6400, type: 'slippery', icon: '⚠️' },
              { name: 'Delnice na Gorenjski', desc: 'Cesta v popravilu - zavozljivo', lat: 46.2000, lng: 14.2000, type: 'construction', icon: '🚧' },
              { name: 'Omejitev 30 Ljubljana center', desc: 'Omejitev hitrosti 30 km/h', lat: 46.0500, lng: 14.5050, type: 'speed_limit', icon: '🔢' },
            ]

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
  }, [showHazards, showTwistyRoads, dbHazards])

  // Update fuel range circle
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    // Remove existing fuel circle and label
    if (fuelCircleRef.current) {
      map.removeLayer(fuelCircleRef.current)
      fuelCircleRef.current = null
    }
    if (fuelLabelRef.current) {
      map.removeLayer(fuelLabelRef.current)
      fuelLabelRef.current = null
    }

    if (fuelRange && fuelRange > 0 && fuelCenter) {
      const radius = fuelRange * 1000 // convert km to meters
      const circle = L.circle([fuelCenter.lat, fuelCenter.lng], {
        radius,
        color: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.08,
        weight: 2,
        opacity: 0.6,
      }).addTo(map)
      fuelCircleRef.current = circle

      // Add label in the center
      const labelIcon = L.divIcon({
        className: 'fuel-range-label',
        html: `<div style="background:rgba(249,115,22,0.9);color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(249,115,22,0.4);display:flex;align-items:center;gap:4px;">
          <span style=\"font-size:14px\">⛽</span> ${Math.round(fuelRange)} km
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      })
      const label = L.marker([fuelCenter.lat, fuelCenter.lng], {
        icon: labelIcon,
        interactive: false,
      }).addTo(map)
      fuelLabelRef.current = label
    }
  }, [fuelRange, fuelCenter])

  // Update friend rides layer
  useEffect(() => {
    if (!layersRef.current) return
    const layer = layersRef.current.friends
    layer.clearLayers()

    if (!showFriendRides) return

    friendRides.forEach((ride) => {
      if (!ride.startLat || !ride.startLng) return

      const marker = L.marker([ride.startLat, ride.startLng], {
        icon: createFriendRideMarker(ride.userName, ride.title),
      }).addTo(layer)

      marker.bindPopup(`
        <div style="min-width:180px">
          <strong style="color:#3b82f6">👤 ${ride.userName}</strong><br/>
          <strong>${ride.title}</strong><br/>
          <span style="color:#888">${ride.distance} km</span><br/>
          <span style="background:#3b82f622;color:#3b82f6;padding:2px 6px;border-radius:4px;font-size:11px">🏍️ Prijateljeva vožnja</span>
        </div>
      `)

      // Track polyline (blue)
      try {
        const track = JSON.parse(ride.trackData)
        if (Array.isArray(track) && track.length > 1) {
          const coords: L.LatLngExpression[] = track.map(
            (p: number[]) => [p[0], p[1]] as L.LatLngExpression
          )
          L.polyline(coords, {
            color: '#3b82f6',
            weight: 3,
            opacity: 0.5,
            dashArray: '6 4',
          }).addTo(layer)
        }
      } catch {
        // ignore
      }
    })
  }, [friendRides, showFriendRides])

  // Update parking marker
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    // Remove existing parking marker
    if (parkingMarkerRef.current) {
      map.removeLayer(parkingMarkerRef.current)
      parkingMarkerRef.current = null
    }

    if (parkedLocation) {
      const parkingIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;">
          <div style="position:absolute;inset:-3px;background:#3b82f640;border-radius:50%;animation:parkingPulse 2s infinite;"></div>
          <div style="position:absolute;inset:0;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(59,130,246,0.5);z-index:1;"></div>
          <span style="position:relative;z-index:2;color:#fff;font-weight:900;font-size:16px;font-family:Arial,sans-serif;line-height:1;">P</span>
        </div>
        <style>@keyframes parkingPulse{0%{transform:scale(1);opacity:0.5}100%{transform:scale(1.8);opacity:0}}</style>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      })

      const marker = L.marker([parkedLocation.lat, parkedLocation.lng], {
        icon: parkingIcon,
      }).addTo(map)

      const timeStr = parkedLocation.parkedAt
        ? new Date(parkedLocation.parkedAt).toLocaleString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : ''

      marker.bindPopup(`
        <div style="min-width:180px">
          <strong style="color:#3b82f6;font-size:14px">🅿️ Parkirani motor</strong><br/>
          ${parkedLocation.note ? `<span style="color:#666;font-size:12px;display:block;margin:4px 0">📝 ${parkedLocation.note}</span>` : ''}
          ${timeStr ? `<span style="color:#888;font-size:11px;display:block;margin:2px 0">🕐 ${timeStr}</span>` : ''}
          <span style="background:#3b82f622;color:#3b82f6;padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin-top:4px">Parkirišče</span>
        </div>
      `)

      parkingMarkerRef.current = marker
    }
  }, [parkedLocation])

  // Update user position marker (pulsing dot for navigation)
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (userPositionMarkerRef.current) {
      map.removeLayer(userPositionMarkerRef.current)
      userPositionMarkerRef.current = null
    }

    if (userPosition) {
      const userIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
          <div style="position:absolute;inset:-6px;background:#0ea5e940;border-radius:50%;animation:userPulse 1.5s infinite;"></div>
          <div style="position:absolute;inset:-3px;background:#0ea5e960;border-radius:50%;animation:userPulse 1.5s infinite 0.3s;"></div>
          <div style="position:absolute;inset:0;background:#0ea5e9;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(14,165,233,0.6);z-index:1;"></div>
        </div>
        <style>@keyframes userPulse{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.2);opacity:0}}</style>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const marker = L.marker([userPosition.lat, userPosition.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map)

      userPositionMarkerRef.current = marker
    }
  }, [userPosition])

  // Update live riders layer
  useEffect(() => {
    if (!layersRef.current) return
    const layer = layersRef.current.live
    layer.clearLayers()

    liveRiders.forEach((rider) => {
      if (rider.lat === 0 && rider.lng === 0) return

      // Pulsing green marker for live riders
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
          <div style="position:absolute;inset:-4px;background:#22c55e40;border-radius:50%;animation:pulse 2s infinite;"></div>
          <div style="position:absolute;inset:0;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px #22c55e80;z-index:1;"></div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" style="position:relative;z-index:2;">
            <circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/>
            <path d="M5 18h3l2-6h4l2 6h3"/>
          </svg>
        </div>
        <style>@keyframes pulse{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2);opacity:0}}</style>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      })

      const marker = L.marker([rider.lat, rider.lng], { icon }).addTo(layer)

      marker.bindPopup(`
        <div style="min-width:160px">
          <strong style="color:#22c55e">🟢 ${rider.userName}</strong><br/>
          <span style="color:#888;font-size:12px">V živo</span><br/>
          ${rider.speed > 0 ? `<span style="font-size:12px">🚀 ${rider.speed} km/h</span>` : ''}
        </div>
      `)
    })
  }, [liveRiders])

  // Update road ratings layer
  useEffect(() => {
    const layer = roadRatingsLayerRef.current
    if (!layer) return
    layer.clearLayers()

    if (!roadRatings || roadRatings.length === 0) return

    roadRatings.forEach((rr) => {
      const color = ratingColors[rr.rating] || '#6b7280'
      const surfaceIcon = surfaceIcons[rr.surface] || '🛤️'
      const surfaceLabel = surfaceLabels[rr.surface] || rr.surface
      const stars = '★'.repeat(rr.rating) + '☆'.repeat(5 - rr.rating)

      const marker = L.circleMarker([rr.lat, rr.lng], {
        radius: 9,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      }).addTo(layer)

      const userName = rr.user?.name || 'Uporabnik'
      const commentHtml = rr.comment ? `<span style="color:#666;font-size:12px;display:block;margin:4px 0">💬 ${rr.comment}</span>` : ''

      marker.bindPopup(`
        <div style="min-width:180px">
          <strong style="font-size:14px">${surfaceIcon} Kakovost ceste</strong><br/>
          <span style="color:${color};font-size:14px;font-weight:bold">${stars}</span><br/>
          <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin:4px 0">${surfaceIcon} ${surfaceLabel}</span><br/>
          ${commentHtml}
          <span style="color:#888;font-size:11px;display:block;margin-top:2px">👤 ${userName}</span>
        </div>
      `)
    })
  }, [roadRatings])

  // Update trip days layer
  useEffect(() => {
    const layer = tripLayerRef.current
    if (!layer) return
    layer.clearLayers()

    if (!tripDays || tripDays.length === 0) return

    const dayColorList = ['#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
    const dayColorLabels: Record<string, string> = {
      '#22c55e': 'Zeleni',
      '#f59e0b': 'Rumeni',
      '#3b82f6': 'Modri',
      '#a855f7': 'Vijolični',
      '#ef4444': 'Rdeči',
      '#06b6d4': 'Cian',
      '#ec4899': 'Rožnati',
      '#84cc16': 'Limeta',
    }

    tripDays.forEach((td) => {
      const color = dayColorList[(td.dayNumber - 1) % dayColorList.length]
      const colorLabel = dayColorLabels[color] || `Dan ${td.dayNumber}`

      // Parse waypoints
      let waypoints: Array<{ lat: number; lng: number }> = []
      try {
        waypoints = JSON.parse(td.waypoints)
      } catch {
        // ignore
      }

      // Build all points: start + waypoints + end
      const allPoints: L.LatLngExpression[] = []
      allPoints.push([td.startLat, td.startLng] as L.LatLngExpression)
      waypoints.forEach(wp => {
        allPoints.push([wp.lat, wp.lng] as L.LatLngExpression)
      })
      // Only add end point if it's different from last waypoint
      if (waypoints.length === 0 || (waypoints[waypoints.length - 1].lat !== td.endLat || waypoints[waypoints.length - 1].lng !== td.endLng)) {
        allPoints.push([td.endLat, td.endLng] as L.LatLngExpression)
      }

      // Draw polyline for the day
      if (allPoints.length > 1) {
        L.polyline(allPoints, {
          color,
          weight: 4,
          opacity: 0.8,
        }).addTo(layer)
      }

      // Start marker (circle with day number)
      const startIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
          <div style="position:absolute;inset:0;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
          <span style="position:relative;z-index:1;color:#fff;font-weight:700;font-size:11px;font-family:Arial,sans-serif;line-height:1;">${td.dayNumber}</span>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
      })
      const startMarker = L.marker([td.startLat, td.startLng], { icon: startIcon }).addTo(layer)
      startMarker.bindPopup(`
        <div style="min-width:180px">
          <strong style="font-size:14px;color:${color}">📅 ${td.title}</strong><br/>
          <span style="color:#888;font-size:12px;display:block;margin:4px 0">📏 ${td.distance} km · ⏱️ ~${td.duration} min</span>
          ${td.notes ? `<span style="color:#666;font-size:12px;display:block;margin:2px 0">📝 ${td.notes}</span>` : ''}
          <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin-top:4px">${colorLabel} dan - START</span>
        </div>
      `)

      // End marker (circle with flag)
      if (allPoints.length > 1) {
        const endIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
            <div style="position:absolute;inset:0;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);opacity:0.7;"></div>
            <span style="position:relative;z-index:1;font-size:14px;line-height:1;">🏁</span>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        })
        const endMarker = L.marker([td.endLat, td.endLng], { icon: endIcon }).addTo(layer)
        endMarker.bindPopup(`
          <div style="min-width:180px">
            <strong style="font-size:14px;color:${color}">📅 ${td.title}</strong><br/>
            <span style="color:#888;font-size:12px;display:block;margin:4px 0">📏 ${td.distance} km</span>
            <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;display:inline-block;margin-top:4px">${colorLabel} dan - CILJ</span>
          </div>
        `)
      }

      // Accommodation marker (hotel icon)
      if (td.accommodation) {
        const hotelIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
            <div style="position:absolute;inset:0;background:#8b5cf6;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
            <span style="position:relative;z-index:1;font-size:13px;line-height:1;">🏨</span>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        })
        const hotelMarker = L.marker([td.endLat, td.endLng], {
          icon: hotelIcon,
        }).addTo(layer)
        hotelMarker.bindPopup(`
          <div style="min-width:180px">
            <strong style="font-size:14px;color:#8b5cf6">🏨 Namestitev</strong><br/>
            <span style="color:#666;font-size:12px;display:block;margin:4px 0">${td.accommodation}</span>
            <span style="color:#888;font-size:11px;display:block;margin:2px 0">📅 ${td.title}</span>
          </div>
        `)
      }

      // Fuel stop marker
      if (td.fuelStop && allPoints.length > 0) {
        // Place fuel marker at the midpoint of the route
        const midIdx = Math.floor(allPoints.length / 2)
        const midCoord = allPoints[midIdx] as L.LatLngExpression
        const midLat = Array.isArray(midCoord) ? midCoord[0] : (midCoord as L.LatLng).lat
        const midLng = Array.isArray(midCoord) ? midCoord[1] : (midCoord as L.LatLng).lng

        const fuelIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
            <div style="position:absolute;inset:0;background:#22c55e;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
            <span style="position:relative;z-index:1;font-size:11px;line-height:1;">⛽</span>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -14],
        })
        const fuelMarker = L.marker([midLat, midLng], { icon: fuelIcon }).addTo(layer)
        fuelMarker.bindPopup(`
          <div style="min-width:140px">
            <strong style="font-size:13px;color:#22c55e">⛽ Postanek za gorivo</strong><br/>
            <span style="color:#888;font-size:11px;display:block;margin:2px 0">📅 ${td.title}</span>
          </div>
        `)
      }

      // Intermediate waypoints (small dots)
      if (waypoints.length > 0) {
        waypoints.forEach((wp, wi) => {
          // Skip first/last if they match start/end
          const isStart = wp.lat === td.startLat && wp.lng === td.startLng
          const isEnd = wp.lat === td.endLat && wp.lng === td.endLng
          if ((isStart && wi === 0) || (isEnd && wi === waypoints.length - 1)) return

          L.circleMarker([wp.lat, wp.lng], {
            radius: 4,
            fillColor: color,
            color: '#fff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.8,
          }).addTo(layer)
        })
      }
    })
  }, [tripDays])

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className={`w-full h-full ${className}`}
        style={{ minHeight: '300px' }}
      />
      {showBalkanRoads && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-4 py-2 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-1 rounded" style={{ background: '#22c55e', height: '4px' }} />
            <span className="text-xs text-gray-600 dark:text-gray-300">Lahko</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-1 rounded" style={{ background: '#f59e0b', height: '5px' }} />
            <span className="text-xs text-gray-600 dark:text-gray-300">Zmerno</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-1 rounded" style={{ background: '#f97316', height: '6px' }} />
            <span className="text-xs text-gray-600 dark:text-gray-300">Zahtevno</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-7 h-1.5 rounded" style={{ background: '#ef4444', height: '7px', boxShadow: '0 0 6px #ef444466' }} />
            <span className="text-xs text-gray-600 dark:text-gray-300">Ekstremno</span>
          </div>
        </div>
      )}
    </div>
  )
}
