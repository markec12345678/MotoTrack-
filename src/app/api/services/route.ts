import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '46.15')
    const lng = parseFloat(searchParams.get('lng') || '14.99')
    const radius = parseFloat(searchParams.get('radius') || '50')
    const type = searchParams.get('type')

    // Try to get from DB first, fall back to sample data
    let centers = await db.serviceCenter.findMany(type ? { where: { type } } : {})

    if (centers.length === 0) {
      // Seed sample Slovenian service centers
      const sampleCenters = [
        { name: 'BMW Motorrad Ljubljana', type: 'dealer', brand: 'BMW', lat: 46.07, lng: 14.49, address: 'Tržaška cesta 130, Ljubljana', phone: '+386 1 477 01 00', website: 'https://bmw-motorrad.si', rating: 4.7, services: '["Prodaja", "Servis", "Deli", "Oprema"]', hours: '{"mon-fri":"8:00-18:00","sat":"9:00-13:00"}' },
        { name: 'Honda center Ljubljana', type: 'dealer', brand: 'Honda', lat: 46.06, lng: 14.53, address: 'Smartinska cesta 152, Ljubljana', phone: '+386 1 280 88 00', website: 'https://honda-moto.si', rating: 4.5, services: '["Prodaja", "Servis", "Deli", "Garancija"]', hours: '{"mon-fri":"8:00-17:00","sat":"9:00-12:00"}' },
        { name: 'Yamaha Medved', type: 'dealer', brand: 'Yamaha', lat: 46.08, lng: 14.48, address: 'Celovška cesta 262, Ljubljana', phone: '+386 1 513 41 00', website: 'https://yamaha-medved.si', rating: 4.6, services: '["Prodaja", "Servis", "Deli", "Testna vožnja"]', hours: '{"mon-fri":"9:00-18:00","sat":"9:00-13:00"}' },
        { name: 'KTM Center Maribor', type: 'dealer', brand: 'KTM', lat: 46.55, lng: 15.65, address: 'Tržaška cesta 45, Maribor', phone: '+386 2 620 12 00', website: 'https://ktm-maribor.si', rating: 4.4, services: '["Prodaja", "Servis", "Deli", "Enduro"]', hours: '{"mon-fri":"8:00-17:00"}' },
        { name: 'Moto servis Kranj', type: 'mechanic', brand: null, lat: 46.24, lng: 14.36, address: 'Igorjeva ulica 5, Kranj', phone: '+386 4 212 34 56', website: null, rating: 4.3, services: '["Splošni servis", "Zavorne ploščice", "Veriga", "Olje"]', hours: '{"mon-fri":"7:30-16:00"}' },
        { name: 'Pnevmatike Celje', type: 'tire_shop', brand: null, lat: 46.24, lng: 15.27, address: 'Mariborska cesta 78, Celje', phone: '+386 3 425 67 89', website: null, rating: 4.2, services: '["Pnevmatike", "Montaža", "Uravnoteženje"]', hours: '{"mon-fri":"8:00-17:00","sat":"8:00-12:00"}' },
        { name: 'Moto deli Ljubljana', type: 'parts', brand: null, lat: 46.05, lng: 14.50, address: 'Dunajska cesta 111, Ljubljana', phone: '+386 1 555 12 34', website: 'https://motodeli.si', rating: 4.1, services: '["Rezervni deli", "Oprema", "Naročilo"]', hours: '{"mon-fri":"9:00-18:00","sat":"9:00-13:00"}' },
        { name: 'Moto pralnica Ljubljana', type: 'washing', brand: null, lat: 46.07, lng: 14.51, address: 'Tržaška cesta 88, Ljubljana', phone: null, website: null, rating: 3.9, services: '["Pranje", "Čiščenje", "Zaščita"]', hours: '{"mon-sun":"6:00-22:00"}' },
        { name: 'Suzuki servis Novo mesto', type: 'mechanic', brand: 'Suzuki', lat: 45.80, lng: 15.17, address: 'Seidlova ulica 12, Novo mesto', phone: '+386 7 332 45 67', website: null, rating: 4.0, services: '["Servis", "Pregled", "Deli"]', hours: '{"mon-fri":"8:00-16:00"}' },
        { name: 'Tehnični pregled Koper', type: 'inspection', brand: null, lat: 45.55, lng: 13.73, address: 'Kolodvorska cesta 22, Koper', phone: '+386 5 621 78 90', website: null, rating: 3.8, services: '["Tehnični pregled", "Homologacija"]', hours: '{"mon-fri":"7:00-15:00"}' },
      ]

      for (const sc of sampleCenters) {
        await db.serviceCenter.create({ data: sc })
      }
      centers = await db.serviceCenter.findMany(type ? { where: { type } } : {})
    }

    const results = centers
      .map(c => ({
        ...c,
        distance: Math.round(calculateDistance(lat, lng, c.lat, c.lng) * 10) / 10,
        services: c.services ? JSON.parse(c.services) : [],
      }))
      .filter(c => c.distance <= radius)
      .sort((a, b) => a.distance - b.distance)

    return NextResponse.json({ data: results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
