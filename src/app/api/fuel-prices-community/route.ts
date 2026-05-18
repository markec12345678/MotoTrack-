import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Simple country detection from coordinates
function detectCountry(lat: number, lng: number): string {
  const countries: Array<{ code: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
    { code: 'SI', minLat: 45.4, maxLat: 46.9, minLng: 13.4, maxLng: 16.6 },
    { code: 'HR', minLat: 42.4, maxLat: 46.5, minLng: 13.5, maxLng: 19.4 },
    { code: 'BA', minLat: 42.6, maxLat: 45.3, minLng: 15.7, maxLng: 19.6 },
    { code: 'RS', minLat: 42.2, maxLat: 46.2, minLng: 18.8, maxLng: 23.0 },
    { code: 'ME', minLat: 41.8, maxLat: 43.6, minLng: 18.4, maxLng: 20.4 },
    { code: 'MK', minLat: 40.9, maxLat: 42.4, minLng: 20.5, maxLng: 23.0 },
    { code: 'AL', minLat: 39.6, maxLat: 42.7, minLng: 19.3, maxLng: 21.1 },
    { code: 'BG', minLat: 41.2, maxLat: 44.2, minLng: 22.4, maxLng: 28.6 },
    { code: 'RO', minLat: 43.6, maxLat: 48.3, minLng: 20.3, maxLng: 30.0 },
    { code: 'GR', minLat: 34.8, maxLat: 41.8, minLng: 19.4, maxLng: 29.7 },
  ]
  for (const c of countries) {
    if (lat >= c.minLat && lat <= c.maxLat && lng >= c.minLng && lng <= c.maxLng) return c.code
  }
  return 'SI'
}

// GET: Query fuel prices near a location
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius = parseInt(searchParams.get('radius') || '20') // km
    const fuelType = searchParams.get('fuelType') || 'bencin-95'
    const country = searchParams.get('country')

    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }

    // Simple bounding box filter (approximate)
    const latDelta = radius / 111
    const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180))

    const where: any = {
      active: true,
      fuelType,
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    }
    if (country) where.country = country

    const prices = await db.fuelPrice.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    // Calculate distance and sort
    const results = prices.map(p => {
      const dLat = p.lat - lat
      const dLng = p.lng - lng
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111
      return { ...p, distance: Math.round(distKm * 10) / 10 }
    }).filter(p => p.distance <= radius).sort((a, b) => a.distance - b.distance)

    // Average price per country
    const countryAvgs = await db.fuelPrice.aggregate({
      where: { fuelType, active: true },
      _avg: { price: true },
      _count: { price: true },
      groupBy: ['country'],
    })

    return NextResponse.json({
      prices: results,
      countryAverages: countryAvgs.map((c: any) => ({
        country: c.country,
        avgPrice: Math.round((c._avg.price || 0) * 1000) / 1000,
        count: c._count.price,
      })).sort((a: any, b: any) => (a.avgPrice || 0) - (b.avgPrice || 0)),
    })
  } catch {
    return NextResponse.json({ error: 'Napaka pri pridobivanju cen goriva' }, { status: 500 })
  }
}

// POST: Report a new fuel price
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { stationName, stationBrand, fuelType, price, lat, lng, userId = 'default' } = body

    if (!stationName || !fuelType || !price || !lat || !lng) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    if (price < 0.5 || price > 3.0) {
      return NextResponse.json({ error: 'Cena izven območja (0.50-3.00 EUR)' }, { status: 400 })
    }

    const country = body.country || detectCountry(lat, lng)

    const fuelPrice = await db.fuelPrice.create({
      data: {
        stationName,
        stationBrand: stationBrand || 'Drugo',
        fuelType,
        price,
        lat,
        lng,
        country,
        userId,
      },
    })

    return NextResponse.json({ success: true, fuelPrice })
  } catch {
    return NextResponse.json({ error: 'Napaka pri shranjevanju cene' }, { status: 500 })
  }
}

// PUT: Confirm a price
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID je obvezen' }, { status: 400 })
    }

    const fuelPrice = await db.fuelPrice.update({
      where: { id },
      data: { confirmedBy: { increment: 1 } },
    })

    return NextResponse.json({ success: true, confirmedBy: fuelPrice.confirmedBy })
  } catch {
    return NextResponse.json({ error: 'Napaka pri potrjevanju cene' }, { status: 500 })
  }
}

// DELETE: Remove price
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!id) {
      return NextResponse.json({ error: 'ID je obvezen' }, { status: 400 })
    }

    // Soft delete
    await db.fuelPrice.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Napaka pri brisanju cene' }, { status: 500 })
  }
}
