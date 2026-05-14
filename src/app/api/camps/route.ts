import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Haversine distance calculation in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// GET /api/camps - Fetch camp sites with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const radius = parseFloat(searchParams.get('radius') || '50')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (country) {
      where.country = country.toUpperCase()
    }

    let camps = await db.campSite.findMany({
      where,
      orderBy: { rating: 'desc' },
    })

    // Filter by proximity if lat/lng provided
    if (lat && lng) {
      const userLat = parseFloat(lat)
      const userLng = parseFloat(lng)

      camps = camps
        .map((camp) => ({
          ...camp,
          distance: haversineDistance(userLat, userLng, camp.lat, camp.lng),
        }))
        .filter((camp) => camp.distance <= radius)
        .sort((a, b) => a.distance - b.distance) as (typeof camps[0] & { distance: number })[]
    }

    // Apply limit after filtering
    const result = camps.slice(0, limit)

    return NextResponse.json({
      success: true,
      data: result,
      count: result.length,
    })
  } catch (error) {
    console.error('Fetch camps error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch camp sites' },
      { status: 500 }
    )
  }
}

// POST /api/camps - Create a new camp site
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      lat,
      lng,
      country,
      address,
      phone,
      website,
      email,
      rating,
      priceRange,
      amenities,
      motoFriendly,
      openSeason,
    } = body

    if (!name || lat === undefined || lng === undefined || !country) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, lat, lng, country' },
        { status: 400 }
      )
    }

    const camp = await db.campSite.create({
      data: {
        name,
        description: description || null,
        lat: parseFloat(String(lat)),
        lng: parseFloat(String(lng)),
        country: country.toUpperCase(),
        address: address || null,
        phone: phone || null,
        website: website || null,
        email: email || null,
        rating: rating ? parseFloat(String(rating)) : 0,
        priceRange: priceRange || null,
        amenities: amenities
          ? typeof amenities === 'string'
            ? amenities
            : JSON.stringify(amenities)
          : null,
        motoFriendly: motoFriendly !== undefined ? motoFriendly : true,
        openSeason: openSeason || null,
      },
    })

    return NextResponse.json(
      { success: true, data: camp },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create camp error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create camp site' },
      { status: 500 }
    )
  }
}
