import { NextRequest, NextResponse } from 'next/server'

const TRAFFIC_INCIDENTS = [
  { id: 't1', type: 'construction', description: 'Cesta A1, dela pri Blagovici - zmanjšan profil', lat: 46.19, lng: 14.87, severity: 'medium', updatedAt: new Date().toISOString() },
  { id: 't2', type: 'accident', description: 'Nesreča na Ljubljanski obvoznici, zastoj', lat: 46.08, lng: 14.52, severity: 'high', updatedAt: new Date().toISOString() },
  { id: 't3', type: 'delay', description: 'Zastoj na cesti proti Bledu', lat: 46.35, lng: 14.10, severity: 'low', updatedAt: new Date().toISOString() },
  { id: 't4', type: 'construction', description: 'Rekonstrukcja ceste pri Celju', lat: 46.24, lng: 15.27, severity: 'medium', updatedAt: new Date().toISOString() },
  { id: 't5', type: 'closure', description: 'Zaprt cestni prelaz Vršič za motorna vozila', lat: 46.43, lng: 13.78, severity: 'high', updatedAt: new Date().toISOString() },
  { id: 't6', type: 'delay', description: 'Počasen promet na avtocesti A2 proti Mariboru', lat: 46.38, lng: 15.65, severity: 'low', updatedAt: new Date().toISOString() },
]

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '46.15')
    const lng = parseFloat(searchParams.get('lng') || '14.99')
    const radius = parseFloat(searchParams.get('radius') || '100')

    const R = 6371
    const filtered = TRAFFIC_INCIDENTS.filter(inc => {
      const dLat = ((inc.lat - lat) * Math.PI) / 180
      const dLng = ((inc.lng - lng) * Math.PI) / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((inc.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return dist <= radius
    })

    return NextResponse.json({ data: filtered })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
