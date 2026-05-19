import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RoadCondition {
  id: string
  lat: number
  lng: number
  type: string
  description: string
  userId: string
  userName: string
  upvotes: number
  downvotes: number
  createdAt: string
  expiresAt: string
  distance?: number
}

const CONDITION_TYPES: Record<string, { label: string; emoji: string; color: string }> = {
  wet: { label: 'Mokra cesta', emoji: '💧', color: '#06b6d4' },
  ice: { label: 'Poledica', emoji: '🧊', color: '#3b82f6' },
  construction: { label: 'Gradbišče', emoji: '🚧', color: '#f59e0b' },
  gravel: { label: 'Gramoz na cesti', emoji: '🪨', color: '#a16207' },
  closed: { label: 'Zaprta cesta', emoji: '🚫', color: '#ef4444' },
  pothole: { label: 'Vozelj', emoji: '🕳️', color: '#8b5cf6' },
  accident: { label: 'Nesreča', emoji: '⚠️', color: '#dc2626' },
  police: { label: 'Policijska kontrola', emoji: '👮', color: '#6366f1' },
}

// In-memory storage
let conditions: RoadCondition[] = [
  // Seed data - some recent conditions around Balkans
  { id: 'rc-1', lat: 46.0569, lng: 14.5058, type: 'construction', description: 'Popravilo ceste na Ljubljanski obvočnici', userId: 'seed', userName: 'MotoTrack', upvotes: 5, downvotes: 0, createdAt: new Date(Date.now() - 3600000).toISOString(), expiresAt: new Date(Date.now() + 82800000).toISOString() },
  { id: 'rc-2', lat: 45.8150, lng: 15.9819, type: 'wet', description: 'Mokra cesta po dežju na zagrebški obvočnici', userId: 'seed', userName: 'MotoTrack', upvotes: 3, downvotes: 0, createdAt: new Date(Date.now() - 7200000).toISOString(), expiresAt: new Date(Date.now() + 79200000).toISOString() },
  { id: 'rc-3', lat: 42.4200, lng: 18.7700, type: 'gravel', description: 'Gramoz na cesti po delih na Kotor serpentinah', userId: 'seed', userName: 'MotoTrack', upvotes: 8, downvotes: 1, createdAt: new Date(Date.now() - 5400000).toISOString(), expiresAt: new Date(Date.now() + 81000000).toISOString() },
  { id: 'rc-4', lat: 43.8500, lng: 18.3800, type: 'pothole', description: 'Velik vozelj na cesti proti Sarajevu', userId: 'seed', userName: 'MotoTrack', upvotes: 4, downvotes: 0, createdAt: new Date(Date.now() - 10800000).toISOString(), expiresAt: new Date(Date.now() + 75600000).toISOString() },
  { id: 'rc-5', lat: 44.8700, lng: 15.5800, type: 'police', description: 'Policijska kontrola hitrosti pri Plitvicah', userId: 'seed', userName: 'MotoTrack', upvotes: 12, downvotes: 0, createdAt: new Date(Date.now() - 1800000).toISOString(), expiresAt: new Date(Date.now() + 84600000).toISOString() },
]

let nextId = 6

// Auto-clean expired conditions every request
function cleanExpired() {
  const now = new Date()
  conditions = conditions.filter(c => new Date(c.expiresAt) > now)
}

export async function GET(request: NextRequest) {
  try {
    cleanExpired()
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const radius = parseFloat(searchParams.get('radius') || '100')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    let result = [...conditions]

    // Filter by type
    if (type) {
      result = result.filter(c => c.type === type)
    }

    // Sort by distance if lat/lng provided
    if (lat && lng) {
      const userLat = parseFloat(lat)
      const userLng = parseFloat(lng)
      const R = 6371
      result = result.map(c => {
        const dLat = ((c.lat - userLat) * Math.PI) / 180
        const dLon = ((c.lng - userLng) * Math.PI) / 180
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLat * Math.PI) / 180) * Math.cos((c.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return { ...c, distance: dist } as RoadCondition
      }).filter(c => c.distance! <= radius)
      result.sort((a, b) => (a.distance || 0) - (b.distance || 0))
    } else {
      // Sort by most recent
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    result = result.slice(0, limit)

    // Add type metadata
    const enriched = result.map(c => ({
      ...c,
      typeLabel: CONDITION_TYPES[c.type]?.label || c.type,
      typeEmoji: CONDITION_TYPES[c.type]?.emoji || '⚠️',
      typeColor: CONDITION_TYPES[c.type]?.color || '#6b7280',
    }))

    return NextResponse.json({ data: enriched, types: CONDITION_TYPES })
  } catch (error) {
    console.error('Road conditions GET error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lng, type, description, userId, userName } = body

    if (!lat || !lng || !type) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    if (!CONDITION_TYPES[type]) {
      return NextResponse.json({ error: 'Neznan tip stanja' }, { status: 400 })
    }

    const id = `rc-${nextId++}`
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h expiry

    const condition: RoadCondition = {
      id,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      type,
      description: description || '',
      userId: userId || 'anonymous',
      userName: userName || 'Anonimen',
      upvotes: 0,
      downvotes: 0,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    conditions.unshift(condition)

    return NextResponse.json({
      data: {
        ...condition,
        typeLabel: CONDITION_TYPES[type].label,
        typeEmoji: CONDITION_TYPES[type].emoji,
        typeColor: CONDITION_TYPES[type].color,
      }
    })
  } catch (error) {
    console.error('Road conditions POST error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, vote } = body // vote: 'up' or 'down'

    const condition = conditions.find(c => c.id === id)
    if (!condition) {
      return NextResponse.json({ error: 'Ni najdeno' }, { status: 404 })
    }

    if (vote === 'up') condition.upvotes++
    else if (vote === 'down') condition.downvotes++

    return NextResponse.json({ data: condition })
  } catch (error) {
    console.error('Road conditions PUT error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
