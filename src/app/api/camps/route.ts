import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function haversineKm(lat1: number, lon1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lng2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius = parseFloat(searchParams.get('radius') || '50')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (country) where.country = country

    let camps = await db.campSite.findMany({
      where,
      orderBy: { rating: 'desc' },
      take: limit * 3,
    })

    // Filter by distance if lat/lng provided
    if (lat && lng) {
      camps = camps.filter(c => haversineKm(lat, lng, c.lat, c.lng) <= radius)
    }

    const result = camps.slice(0, limit).map(c => ({
      ...c,
      amenities: c.amenities ? JSON.parse(c.amenities) : [],
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Camps fetch error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju kampov' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, lat, lng, country, address, phone, website, email, rating, priceRange, amenities, motoFriendly, openSeason } = body

    if (!name || !lat || !lng || !country) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    const camp = await db.campSite.create({
      data: {
        name,
        description: description || null,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        country,
        address: address || null,
        phone: phone || null,
        website: website || null,
        email: email || null,
        rating: rating ? parseFloat(rating) : 0,
        priceRange: priceRange || null,
        amenities: amenities ? JSON.stringify(amenities) : null,
        motoFriendly: motoFriendly !== false,
        openSeason: openSeason || null,
      },
    })

    return NextResponse.json({ data: { ...camp, amenities: camp.amenities ? JSON.parse(camp.amenities) : [] } }, { status: 201 })
  } catch (error) {
    console.error('Camp create error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju kampa' }, { status: 500 })
  }
}
