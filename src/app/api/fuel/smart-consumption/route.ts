import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Motorcycle database with typical consumption values
const BIKE_DB: Record<string, { avg: number; city: number; highway: number; tank: number }> = {
  'honda cbr': { avg: 5.8, city: 6.5, highway: 4.8, tank: 17 },
  'yamaha r1': { avg: 6.2, city: 7.0, highway: 5.2, tank: 17 },
  'bmw gs': { avg: 4.8, city: 5.2, highway: 4.2, tank: 20 },
  'ktm duke': { avg: 4.5, city: 5.0, highway: 3.8, tank: 14 },
  'ducati panigale': { avg: 6.8, city: 7.5, highway: 5.5, tank: 17 },
  'honda africa': { avg: 4.5, city: 5.0, highway: 4.0, tank: 24 },
  'suzuki v-strom': { avg: 4.8, city: 5.3, highway: 4.2, tank: 20 },
  'kawasaki z': { avg: 5.5, city: 6.2, highway: 4.5, tank: 17 },
  'triumph tiger': { avg: 4.9, city: 5.4, highway: 4.3, tank: 20 },
  'yamaha mt': { avg: 5.0, city: 5.6, highway: 4.2, tank: 14 },
  'honda cb': { avg: 4.2, city: 4.8, highway: 3.5, tank: 16 },
  'bmw r1250': { avg: 4.6, city: 5.1, highway: 4.0, tank: 25 },
  'suzuki gsxr': { avg: 6.0, city: 6.8, highway: 5.0, tank: 17 },
  'kawasaki ninja': { avg: 5.8, city: 6.5, highway: 4.8, tank: 17 },
  'harley davidson': { avg: 5.8, city: 6.5, highway: 5.0, tank: 18 },
  'honda goldwing': { avg: 5.5, city: 6.0, highway: 4.8, tank: 21 },
  'bmw r1250gs': { avg: 4.6, city: 5.1, highway: 4.0, tank: 25 },
  'yamaha tenere': { avg: 4.5, city: 5.0, highway: 4.0, tank: 23 },
  'ktm adventure': { avg: 4.8, city: 5.3, highway: 4.2, tank: 23 },
  'ducati multistrada': { avg: 5.2, city: 5.8, highway: 4.5, tank: 22 },
  // More generic fallbacks
  'default_sport': { avg: 6.0, city: 6.8, highway: 5.0, tank: 17 },
  'default_touring': { avg: 5.0, city: 5.5, highway: 4.3, tank: 22 },
  'default_naked': { avg: 5.2, city: 5.8, highway: 4.4, tank: 15 },
  'default_adventure': { avg: 4.8, city: 5.3, highway: 4.1, tank: 20 },
  'default_cruiser': { avg: 5.5, city: 6.0, highway: 4.8, tank: 18 },
  'default_scooter': { avg: 2.8, city: 3.2, highway: 2.4, tank: 8 },
}

// Riding style multipliers
const STYLE_MULTIPLIERS: Record<string, number> = {
  calm: 0.85,
  normal: 1.0,
  sporty: 1.15,
  aggressive: 1.35,
}

// Terrain multipliers
const TERRAIN_MULTIPLIERS: Record<string, number> = {
  flat: 0.95,
  hills: 1.05,
  mountains: 1.15,
}

// Category detection keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  sport: ['cbr', 'gsxr', 'ninja', 'r1', 'r6', 'panigale', 'zx6r', 'zx10r', 'supersport', 'sport', 'rr', 'fireblade'],
  touring: ['goldwing', 'touring', 'rt', 'lt', 'wing', 'f6b', 'venture', 'tour'],
  adventure: ['gs', 'africa', 'v-strom', 'tenere', 'adventure', 'adv', 'tiger', 'multistrada', 'ténéré'],
  cruiser: ['harley', 'cruiser', 'chopper', 'victory', 'indian', 'street glide', 'road king', 'softail', 'fat boy'],
  scooter: ['scooter', 'scooty', 'burgman', 'vespa', 'metro', 'pcx', 'forza', 'xmax'],
  naked: ['naked', 'mt', 'z650', 'z900', 'z1000', 'cb', 'fz', 'streetfighter', 'monster', 'duke', 'speed triple'],
}

// In-memory cache (1 hour TTL)
interface CacheEntry {
  data: Record<string, unknown>
  timestamp: number
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function findBikeInDb(bikeName: string): { data: { avg: number; city: number; highway: number; tank: number }; key: string } | null {
  const lower = bikeName.toLowerCase().trim()

  // Direct match first
  for (const [key, data] of Object.entries(BIKE_DB)) {
    if (key.startsWith('default_')) continue
    if (lower.includes(key) || key.includes(lower)) {
      return { data, key }
    }
  }

  // Partial match
  const words = lower.split(/\s+/)
  for (const [key, data] of Object.entries(BIKE_DB)) {
    if (key.startsWith('default_')) continue
    if (words.some(w => w.length > 2 && key.includes(w))) {
      return { data, key }
    }
  }

  // Category detection
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const defaultKey = `default_${category}` as keyof typeof BIKE_DB
      if (BIKE_DB[defaultKey]) {
        return { data: BIKE_DB[defaultKey], key: defaultKey }
      }
    }
  }

  // Default fallback: naked
  return { data: BIKE_DB['default_naked'], key: 'default_naked' }
}

function calculateFromDb(
  bike: string,
  ridingStyle: string,
  terrain: string,
  avgSpeed?: number,
): Record<string, unknown> {
  const dbResult = findBikeInDb(bike)
  const { data: bikeData } = dbResult!

  const styleMultiplier = STYLE_MULTIPLIERS[ridingStyle] ?? 1.0
  const terrainMultiplier = TERRAIN_MULTIPLIERS[terrain] ?? 1.0
  const totalMultiplier = styleMultiplier * terrainMultiplier

  // Speed adjustment: highway speeds increase consumption slightly
  let speedMultiplier = 1.0
  if (avgSpeed && avgSpeed > 0) {
    if (avgSpeed > 130) speedMultiplier = 1.15
    else if (avgSpeed > 100) speedMultiplier = 1.05
    else if (avgSpeed < 50) speedMultiplier = 0.95
  }

  const estimatedL100km = Math.round(bikeData.avg * totalMultiplier * speedMultiplier * 10) / 10
  const cityConsumption = Math.round(bikeData.city * totalMultiplier * 10) / 10
  const highwayConsumption = Math.round(bikeData.highway * totalMultiplier * speedMultiplier * 10) / 10

  const range_city = Math.round((bikeData.tank / cityConsumption) * 100)
  const range_highway = Math.round((bikeData.tank / highwayConsumption) * 100)
  const range_mixed = Math.round((bikeData.tank / estimatedL100km) * 100)

  // Confidence based on match quality
  const isDefault = dbResult!.key.startsWith('default_')
  const confidence: 'low' | 'medium' | 'high' = isDefault ? 'medium' : 'high'

  // Slovenian tips based on style and terrain
  const tips: Record<string, string> = {
    'calm_flat': 'Mirena vožnja po ravnem - najnižja poraba. Izogibajte se naglim pospeševanjem.',
    'calm_hills': 'V gričevju poskrbite za pravočasno prestavljanje - ohranjajte nizke vrtljaje.',
    'calm_mountains': 'V gorah pazite na pregrevanje motorja pri nizkih hitrostih.',
    'normal_flat': 'Normalna vožnja po ravnem - zmerna poraba. Redno preverjajte tlak pnevmatik.',
    'normal_hills': 'V gričevju izkoristite vzdržljivost za varčevanje z gorivom.',
    'normal_mountains': 'V gorah načrtujte postanke za hlajenje in preverjanje goriva.',
    'sporty_flat': 'Športna vožnja poveča porabo za ~15%. Pazite na zavorne razdalje.',
    'sporty_hills': 'Športna vožnja v gričevju zahteva več goriva. Izberite pravo linijo v ovinkih.',
    'sporty_mountains': 'V gorah pri športni vožnji poraba močno naraste. Imejte rezervo goriva.',
    'aggressive_flat': 'Agresivna vožnja poveča porabo za 35%+. Načrtujte dodatne postanke za gorivo.',
    'aggressive_hills': 'Agresivna vožnja v gričevju zelo poveča porabo. Povečajte varnostno razdaljo.',
    'aggressive_mountains': 'Ekstremna poraba v gorah! Načrtujte postanke vsakih 100 km.',
  }

  const tipKey = `${ridingStyle}_${terrain}`
  const notes = tips[tipKey] || 'Prilagodite vožnjo razmeram in redno preverjajte raven goriva.'

  return {
    estimatedL100km,
    range_city,
    range_highway,
    range_mixed,
    confidence,
    source: 'database',
    notes,
    bike,
    ridingStyle,
    suggestedTankSize: bikeData.tank,
    multipliers: { style: styleMultiplier, terrain: terrainMultiplier },
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { bike, ridingStyle, avgSpeed, terrain } = body

    if (!bike || typeof bike !== 'string') {
      return NextResponse.json({ error: 'bike is required' }, { status: 400 })
    }

    const validStyles = ['calm', 'normal', 'sporty', 'aggressive']
    const style = validStyles.includes(ridingStyle) ? ridingStyle : 'normal'

    const validTerrains = ['flat', 'hills', 'mountains']
    const terrainType = validTerrains.includes(terrain) ? terrain : 'flat'

    const speed = typeof avgSpeed === 'number' && avgSpeed > 0 ? avgSpeed : undefined

    // Check cache
    const cacheKey = `${bike.toLowerCase().trim()}_${style}_${terrainType}_${speed ?? 'auto'}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ data: cached.data })
    }

    // Try LLM first
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      const response = await zai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a motorcycle fuel consumption expert. Respond ONLY with valid JSON, no markdown.' },
          { role: 'user', content: `Estimate fuel consumption for: ${bike}, riding style: ${style}, avg speed: ${speed ?? 'typical'}km/h, terrain: ${terrainType}. 
    Return JSON: { "estimatedL100km": number, "range_city": number, "range_highway": number, "range_mixed": number, "confidence": "low"|"medium"|"high", "notes": "brief tip in Slovenian", "tankSize_suggested": number }` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })

      const content = response.choices?.[0]?.message?.content
      if (content) {
        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(content)
        } catch {
          // LLM returned invalid JSON, fall back to database
          throw new Error('Invalid JSON from LLM')
        }

        const styleMultiplier = STYLE_MULTIPLIERS[style] ?? 1.0
        const terrainMultiplier = TERRAIN_MULTIPLIERS[terrainType] ?? 1.0

        // Apply multipliers to LLM estimates
        const baseConsumption = typeof parsed.estimatedL100km === 'number' ? parsed.estimatedL100km : 5.5
        const estimatedL100km = Math.round(baseConsumption * styleMultiplier * terrainMultiplier * 10) / 10
        const tankSize = typeof parsed.tankSize_suggested === 'number' ? parsed.tankSize_suggested : 17

        const cityConsumption = Math.round(estimatedL100km * 1.15 * 10) / 10
        const highwayConsumption = Math.round(estimatedL100km * 0.8 * 10) / 10

        const range_city = typeof parsed.range_city === 'number'
          ? Math.round(parsed.range_city * (1 / styleMultiplier) * (1 / terrainMultiplier))
          : Math.round((tankSize / cityConsumption) * 100)
        const range_highway = typeof parsed.range_highway === 'number'
          ? Math.round(parsed.range_highway * (1 / styleMultiplier) * (1 / terrainMultiplier))
          : Math.round((tankSize / highwayConsumption) * 100)
        const range_mixed = typeof parsed.range_mixed === 'number'
          ? Math.round(parsed.range_mixed * (1 / styleMultiplier) * (1 / terrainMultiplier))
          : Math.round((tankSize / estimatedL100km) * 100)

        const confidence = ['low', 'medium', 'high'].includes(parsed.confidence as string) ? parsed.confidence as string : 'medium'

        const result = {
          estimatedL100km,
          range_city,
          range_highway,
          range_mixed,
          confidence,
          source: 'llm',
          notes: typeof parsed.notes === 'string' ? parsed.notes : 'Prilagodite vožnjo razmeram in redno preverjajte raven goriva.',
          bike,
          ridingStyle: style,
          suggestedTankSize: tankSize,
          multipliers: { style: styleMultiplier, terrain: terrainMultiplier },
        }

        // Cache the result
        cache.set(cacheKey, { data: result, timestamp: Date.now() })

        return NextResponse.json({ data: result })
      }
    } catch (llmError) {
      console.error('LLM fuel estimation failed, falling back to database:', llmError)
    }

    // Fallback to database calculation
    const result = calculateFromDb(bike, style, terrainType, speed)

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Smart consumption error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
