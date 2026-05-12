'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
  planWaypoints?: Array<{ lat: number; lng: number }>
  trackPoints?: Array<{ lat: number; lng: number }>
  showPlan?: boolean
  showTrack?: boolean
  onMapClick?: (lat: number, lng: number) => void
  filterRides?: boolean
  filterRoutes?: boolean
  filterCategory?: string
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

export default function MotoMap({
  center = [46.15, 14.99],
  zoom = 8,
  rides = [],
  routes = [],
  planWaypoints = [],
  trackPoints = [],
  showPlan = false,
  showTrack = false,
  onMapClick,
  filterRides = true,
  filterRoutes = true,
  filterCategory = 'all',
  className = '',
}: MotoMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<{
    rides: L.LayerGroup
    routes: L.LayerGroup
    plan: L.LayerGroup
    track: L.LayerGroup
  } | null>(null)

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
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

    layersRef.current = {
      rides: ridesLayer,
      routes: routesLayer,
      plan: planLayer,
      track: trackLayer,
    }

    // Map click handler
    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng)
      })
    }

    mapRef.current = map

    // Fix size issue
    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapRef.current = null
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

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ minHeight: '300px' }}
    />
  )
}
