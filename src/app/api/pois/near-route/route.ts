import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { waypoints, radiusKm = 2, types } = await req.json()
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
      return NextResponse.json({ error: 'waypoints array required' }, { status: 400 })
    }

    const allPois = await db.poi.findMany()
    const radius = radiusKm || 2

    // Filter POIs that are within radius of any waypoint on the route
    const nearbyPois = allPois.filter(poi => {
      if (types && Array.isArray(types) && types.length > 0 && !types.includes(poi.type)) return false
      return waypoints.some((wp: { lat: number; lng: number }) => haversine(wp.lat, wp.lng, poi.lat, poi.lng) <= radius)
    }).map(poi => {
      // Find the closest waypoint and its distance
      let minDist = Infinity
      for (const wp of waypoints) {
        const d = haversine(wp.lat, wp.lng, poi.lat, poi.lng)
        if (d < minDist) minDist = d
      }
      return { ...poi, distanceFromRoute: Math.round(minDist * 10) / 10 }
    }).sort((a, b) => a.distanceFromRoute - b.distanceFromRoute)

    return NextResponse.json({ data: nearbyPois })
  } catch (e: unknown) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
