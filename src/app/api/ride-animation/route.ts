import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Ride Animation API - returns ride data formatted for playback
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rideId = searchParams.get('rideId')
    if (!rideId) {
      return NextResponse.json({ error: 'Manjka rideId' }, { status: 400 })
    }

    const ride = await db.ride.findUnique({ where: { id: rideId } })
    if (!ride) {
      return NextResponse.json({ error: 'Vožnja ni najdena' }, { status: 404 })
    }

    // Parse track data
    let trackPoints: number[][] = []
    try {
      trackPoints = JSON.parse(ride.trackData)
    } catch { /* ignore */ }

    // Format for animation: each point has lat, lng, alt, timestamp, speed
    const animationData = trackPoints.map((p, i) => {
      const speed = i > 0 ? calculateSpeed(trackPoints[i - 1], p) : 0
      return {
        lat: p[0],
        lng: p[1],
        alt: p[2] || 0,
        timestamp: p[3] || 0,
        speed: Math.round(speed * 10) / 10,
        index: i,
      }
    })

    return NextResponse.json({
      data: {
        rideId: ride.id,
        title: ride.title,
        distance: ride.distance,
        duration: ride.duration,
        maxSpeed: ride.maxSpeed,
        elevation: ride.elevation,
        totalPoints: animationData.length,
        trackPoints: animationData,
      }
    })
  } catch (error) {
    console.error('Ride animation error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

function calculateSpeed(p1: number[], p2: number[]): number {
  const R = 6371000
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((p1[0] * Math.PI) / 180) * Math.cos((p2[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const dt = ((p2[3] || 0) - (p1[3] || 0)) / 1000
  if (dt <= 0) return 0
  return (dist / dt) * 3.6 // km/h
}
