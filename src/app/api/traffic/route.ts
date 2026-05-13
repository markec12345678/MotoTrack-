import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Static traffic incidents (always available as base data)
const STATIC_TRAFFIC_INCIDENTS = [
  { id: 't1', type: 'construction', description: 'Cesta A1, dela pri Blagovici - zmanjšan profil', lat: 46.19, lng: 14.87, severity: 'medium', updatedAt: new Date().toISOString() },
  { id: 't2', type: 'accident', description: 'Nesreča na Ljubljanski obvoznici, zastoj', lat: 46.08, lng: 14.52, severity: 'high', updatedAt: new Date().toISOString() },
  { id: 't3', type: 'delay', description: 'Zastoj na cesti proti Bledu', lat: 46.35, lng: 14.10, severity: 'low', updatedAt: new Date().toISOString() },
  { id: 't4', type: 'construction', description: 'Rekonstrukcija ceste pri Celju', lat: 46.24, lng: 15.27, severity: 'medium', updatedAt: new Date().toISOString() },
  { id: 't5', type: 'closure', description: 'Zaprt cestni prelaz Vršič za motorna vozila', lat: 46.43, lng: 13.78, severity: 'high', updatedAt: new Date().toISOString() },
  { id: 't6', type: 'delay', description: 'Počasen promet na avtocesti A2 proti Mariboru', lat: 46.38, lng: 15.65, severity: 'low', updatedAt: new Date().toISOString() },
]

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Map Hazard type to traffic incident type
const HAZARD_TYPE_TO_TRAFFIC: Record<string, string> = {
  speed_camera: 'delay',
  rockfall: 'closure',
  slippery: 'delay',
  wildlife: 'delay',
  construction: 'construction',
  speed_limit: 'delay',
  accident: 'accident',
}

// Map Hazard type to traffic severity
const HAZARD_SEVERITY: Record<string, string> = {
  speed_camera: 'low',
  rockfall: 'high',
  slippery: 'medium',
  wildlife: 'medium',
  construction: 'medium',
  speed_limit: 'low',
  accident: 'high',
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '46.15')
    const lng = parseFloat(searchParams.get('lng') || '14.99')
    const radius = parseFloat(searchParams.get('radius') || '100')

    // Get user-reported traffic incidents from Hazard model
    const dbHazards = await db.hazard.findMany({
      where: {
        type: { in: ['construction', 'accident', 'closure', 'delay', 'rockfall', 'slippery'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Convert DB hazards to traffic incidents
    const dbIncidents = dbHazards.map(h => ({
      id: `db-${h.id}`,
      type: HAZARD_TYPE_TO_TRAFFIC[h.type] || h.type,
      description: h.description || h.name,
      lat: h.lat,
      lng: h.lng,
      severity: HAZARD_SEVERITY[h.type] || 'medium',
      updatedAt: h.createdAt.toISOString(),
    }))

    // Merge static and DB incidents
    const allIncidents = [...STATIC_TRAFFIC_INCIDENTS, ...dbIncidents]

    // Filter by radius
    const filtered = allIncidents.filter(inc => {
      const dist = haversine(lat, lng, inc.lat, inc.lng)
      return dist <= radius
    })

    return NextResponse.json({
      data: filtered,
      lastUpdated: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, description, severity, lat, lng, userId } = body

    if (!type || !description || !lat || !lng) {
      return NextResponse.json(
        { error: 'type, description, lat in lng so obvezni' },
        { status: 400 }
      )
    }

    // Validate type
    const validTypes = ['construction', 'accident', 'delay', 'closure']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Neveljaven tip. Dovoljeni: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high']
    const incidentSeverity = validSeverities.includes(severity) ? severity : 'medium'

    // Store as a Hazard in the database
    const hazard = await db.hazard.create({
      data: {
        type,
        name: `Prometni dogodek: ${type}`,
        description,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        userId: userId || null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // expires in 24h
      },
    })

    return NextResponse.json({
      data: {
        id: hazard.id,
        type,
        description,
        severity: incidentSeverity,
        lat: hazard.lat,
        lng: hazard.lng,
        updatedAt: hazard.createdAt.toISOString(),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
