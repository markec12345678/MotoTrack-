import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Service Centers
const serviceCentersData = [
  { name: 'BMW Motorrad Ljubljana', brand: 'BMW', address: 'Ljubljana, BTC', lat: 46.065, lng: 14.575, phone: '+386 1 588 12 00', services: 'Servis,Gume,Olije,Deli', rating: 4.5 },
  { name: 'Yamaha Center Maribor', brand: 'Yamaha', address: 'Maribor, Tezno', lat: 46.530, lng: 15.640, phone: '+386 2 620 12 00', services: 'Servis,Gume,Olije', rating: 4.2 },
  { name: 'Honda Shop Celje', brand: 'Honda', address: 'Celje, Mariborska cesta', lat: 46.235, lng: 15.270, phone: '+386 3 421 56 00', services: 'Servis,Delii', rating: 4.0 },
  { name: 'KTM Center Kranj', brand: 'KTM', address: 'Kranj, Predoslje', lat: 46.245, lng: 14.370, phone: '+386 4 213 45 00', services: 'Servis,Gume,Olije,Deli,Terenska oprema', rating: 4.7 },
  { name: 'Moto Servis Novo mesto', brand: null, address: 'Novo mesto', lat: 45.800, lng: 15.170, phone: '+386 7 334 12 00', services: 'Servis,Gume,Olije', rating: 3.8 },
  { name: 'Suzuki Service Koper', brand: 'Suzuki', address: 'Koper, Prisoje', lat: 45.550, lng: 13.740, phone: '+386 5 627 89 00', services: 'Servis,Gume', rating: 4.1 },
  { name: 'Moto Pohorje Maribor', brand: null, address: 'Maribor, Pohorska ulica', lat: 46.545, lng: 15.610, phone: '+386 2 450 34 00', services: 'Servis,Terenska oprema', rating: 4.3 },
  { name: 'Ducati Ljubljana', brand: 'Ducati', address: 'Ljubljana, Tržaška cesta', lat: 46.045, lng: 14.495, phone: '+386 1 256 78 00', services: 'Servis,Olije,Deli', rating: 4.6 },
  { name: 'Kawasaki Center Ptuj', brand: 'Kawasaki', address: 'Ptuj', lat: 46.420, lng: 15.870, phone: '+386 2 788 90 00', services: 'Servis,Gume,Olije', rating: 3.9 },
  { name: 'Triumph Slovenia', brand: 'Triumph', address: 'Ljubljana, Vič', lat: 46.030, lng: 14.490, phone: '+386 1 426 56 00', services: 'Servis,Delii,Olije', rating: 4.4 },
]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const brand = searchParams.get('brand')
    const lat = parseFloat(searchParams.get('lat') || '46.15')
    const lng = parseFloat(searchParams.get('lng') || '14.99')

    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLon = ((lon2 - lon1) * Math.PI) / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    let centers = serviceCentersData.map((c, i) => ({
      id: `sc${i + 1}`,
      ...c,
      distance: Math.round(haversine(lat, lng, c.lat, c.lng) * 10) / 10,
      services: c.services.split(','),
    }))

    if (brand) {
      centers = centers.filter(c => c.brand?.toLowerCase() === brand.toLowerCase())
    }

    centers.sort((a, b) => a.distance - b.distance)

    return NextResponse.json({ data: centers })
  } catch (error) {
    console.error('Service centers error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
