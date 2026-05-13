import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const FUEL_PRICE_RANGES: Record<string, { min: number; max: number }> = {
  '95': { min: 1.45, max: 1.65 },
  '98': { min: 1.55, max: 1.75 },
  diesel: { min: 1.35, max: 1.55 },
}

function randomPrice(type: string): number {
  const range = FUEL_PRICE_RANGES[type] || FUEL_PRICE_RANGES['95']
  return Math.round((range.min + Math.random() * (range.max - range.min)) * 100) / 100
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '46.15')
    const lng = parseFloat(searchParams.get('lng') || '14.99')
    const radius = parseFloat(searchParams.get('radius') || '25')
    const fuelType = searchParams.get('fuelType') || '95'

    const pois = await db.poi.findMany({ where: { type: 'gas_station' } })

    const stations = pois
      .map(poi => {
        const distance = calculateDistance(lat, lng, poi.lat, poi.lng)
        const brand = poi.name.includes('Petrol') ? 'Petrol' : poi.name.includes('OMV') ? 'OMV' : poi.name.includes('MOL') ? 'MOL' : poi.name.includes('Shell') ? 'Shell' : null
        return {
          id: poi.id,
          name: poi.name,
          lat: poi.lat,
          lng: poi.lng,
          distance: Math.round(distance * 10) / 10,
          prices: { '95': randomPrice('95'), '98': randomPrice('98'), diesel: randomPrice('diesel') },
          brand,
          address: poi.description,
        }
      })
      .filter(s => s.distance <= radius)
      .sort((a, b) => (a.prices[fuelType as keyof typeof a.prices] || 99) - (b.prices[fuelType as keyof typeof b.prices] || 99))

    return NextResponse.json({ data: stations })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
