import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// In-memory cache for web search results (2 hour TTL)
const cache = new Map<string, { data: LiveServiceCenter[]; expiresAt: number }>()

interface LiveServiceCenter {
  id: string
  name: string
  type: string
  brand: string | null
  lat: number
  lng: number
  distance: number
  address: string | null
  phone: string | null
  website: string | null
  rating: number
  services: string[]
  live: boolean
  source: 'web' | 'database'
}

interface WebSearchResult {
  url: string
  name: string
  snippet: string
  host_name: string
  rank: number
  date?: string
  favicon?: string
}

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Build a search query based on params
function buildSearchQuery(brand: string | null, type: string | null, lat: number, lng: number): string {
  // Determine nearby city from coordinates (Slovenian cities)
  const cities = [
    { name: 'Ljubljana', lat: 46.06, lng: 14.51 },
    { name: 'Maribor', lat: 46.55, lng: 15.65 },
    { name: 'Celje', lat: 46.24, lng: 15.27 },
    { name: 'Kranj', lat: 46.24, lng: 14.36 },
    { name: 'Koper', lat: 45.55, lng: 13.73 },
    { name: 'Novo mesto', lat: 45.80, lng: 15.17 },
    { name: 'Ptuj', lat: 46.42, lng: 15.87 },
    { name: 'Nova Gorica', lat: 45.96, lng: 13.64 },
    { name: 'Murska Sobota', lat: 46.66, lng: 16.17 },
    { name: 'Trbovlje', lat: 46.12, lng: 15.04 },
    // Croatian cities
    { name: 'Zagreb', lat: 45.81, lng: 15.98 },
    { name: 'Rijeka', lat: 45.33, lng: 14.44 },
    { name: 'Split', lat: 43.51, lng: 16.44 },
  ]

  let nearestCity = 'Ljubljana'
  let minDist = Infinity
  for (const c of cities) {
    const d = haversine(lat, lng, c.lat, c.lng)
    if (d < minDist) {
      minDist = d
      nearestCity = c.name
    }
  }

  // Build type-specific search terms
  const typeTerms: Record<string, string> = {
    servis: 'motociklistični servis',
    service: 'motorcycle service',
    gume: 'motociklistične gume pnevmatike',
    tires: 'motorcycle tires',
    deli: 'motociklistični deli',
    parts: 'motorcycle parts',
    pregled: 'tehnični pregled motorno kolo',
    inspection: 'motorcycle inspection',
    pralnica: 'pralnica za motorna kolesa',
    washing: 'motorcycle washing',
  }

  const brandPart = brand ? `${brand} motorrad` : 'motorno kolo'
  const typePart = type && typeTerms[type] ? typeTerms[type] : 'servis'
  const countryPart = minDist > 200 ? 'Slovenija Hrvaška' : 'Slovenija'

  return `${typePart} ${brandPart} ${nearestCity} ${countryPart}`
}

// Extract service center info from web page content
function extractInfoFromPage(
  pageContent: string,
  url: string,
  name: string,
  snippet: string
): Partial<LiveServiceCenter> {
  const result: Partial<LiveServiceCenter> = {}

  // Extract phone number
  const phoneMatch = pageContent.match(/(?:\+386|00386|0)[\s./-]?\d[\s./-]?\d[\s./-]?\d[\s./-]?\d[\s./-]?\d[\s./-]?\d[\s./-]?\d[\s./-]?\d/)
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/\s+/g, ' ').trim()
  }

  // Extract website
  if (url) {
    result.website = url
  }

  // Extract address from snippet or page content
  const addressPatterns = [
    /(?:naslov|address|lokacija|location)\s*[:=]\s*([^\n<]{5,80})/i,
    /(\d+\s+[A-Z][a-zA-ZčšžČŠŽ]+(?:\s+[A-Z][a-zA-ZčšžČŠŽ]+)*\s+(?:ulica|cesta|pot| trg|drevored|obala)[^<\n]{0,40})/i,
    /((?:Tržaška|Celovška|Dunajska|Smartinska|Mariborska|Kolodvorska|Seidlova|Igorjeva|Pohorska)\s+cesta[^<\n]{0,40})/i,
  ]
  for (const pattern of addressPatterns) {
    const match = pageContent.match(pattern) || snippet.match(pattern)
    if (match) {
      result.address = match[1].trim()
      break
    }
  }

  // Try to extract address from snippet
  if (!result.address && snippet.length > 10) {
    const snippetAddrMatch = snippet.match(/(?:v|na|ul\.|cesta)\s+([A-Z][^\n]{5,60})/)
    if (snippetAddrMatch) {
      result.address = snippetAddrMatch[1].trim()
    }
  }

  // Extract services from content
  const serviceKeywords = [
    'servis', 'gume', 'pnevmatike', 'olje', 'olije', 'deli', 'rezervni deli',
    'oprema', 'pregled', 'montaža', 'uravnoteženje', 'zavore', 'veriga',
    'baterija', 'elektrika', 'karoserija', 'pranje', 'enduro', 'terenska oprema',
    'garancija', 'prodaja', 'testna vožnja',
  ]
  const foundServices: string[] = []
  const lowerContent = pageContent.toLowerCase()
  const lowerSnippet = snippet.toLowerCase()
  for (const kw of serviceKeywords) {
    if (lowerContent.includes(kw) || lowerSnippet.includes(kw)) {
      // Capitalize first letter
      foundServices.push(kw.charAt(0).toUpperCase() + kw.slice(1))
    }
  }
  if (foundServices.length > 0) {
    result.services = [...new Set(foundServices)]
  }

  return result
}

// Extract approximate coordinates from content or use city centroid
function estimateCoordinates(
  address: string | null,
  snippet: string,
  searchLat: number,
  searchLng: number
): { lat: number; lng: number } {
  // Try to find known city names in address/snippet and use their centroids
  const cityCentroids: Record<string, { lat: number; lng: number }> = {
    'ljubljana': { lat: 46.06, lng: 14.51 },
    'maribor': { lat: 46.55, lng: 15.65 },
    'celje': { lat: 46.24, lng: 15.27 },
    'kranj': { lat: 46.24, lng: 14.36 },
    'koper': { lat: 45.55, lng: 13.73 },
    'novo mesto': { lat: 45.80, lng: 15.17 },
    'ptuj': { lat: 46.42, lng: 15.87 },
    'nova gorica': { lat: 45.96, lng: 13.64 },
    'murska sobota': { lat: 46.66, lng: 16.17 },
    'zagreb': { lat: 45.81, lng: 15.98 },
    'rijeka': { lat: 45.33, lng: 14.44 },
    'split': { lat: 43.51, lng: 16.44 },
  }

  const textToSearch = ((address || '') + ' ' + snippet).toLowerCase()
  for (const [city, coords] of Object.entries(cityCentroids)) {
    if (textToSearch.includes(city)) {
      // Add small random offset so multiple results in same city don't overlap
      return {
        lat: coords.lat + (Math.random() - 0.5) * 0.02,
        lng: coords.lng + (Math.random() - 0.5) * 0.02,
      }
    }
  }

  // Default: small offset from search point
  return {
    lat: searchLat + (Math.random() - 0.5) * 0.04,
    lng: searchLng + (Math.random() - 0.5) * 0.04,
  }
}

// Hardcoded fallback data from the original service-centers route
const fallbackCenters = [
  { name: 'BMW Motorrad Ljubljana', brand: 'BMW', address: 'Ljubljana, BTC', lat: 46.065, lng: 14.575, phone: '+386 1 588 12 00', services: ['Servis', 'Gume', 'Olije', 'Deli'], rating: 4.5 },
  { name: 'Yamaha Center Maribor', brand: 'Yamaha', address: 'Maribor, Tezno', lat: 46.530, lng: 15.640, phone: '+386 2 620 12 00', services: ['Servis', 'Gume', 'Olije'], rating: 4.2 },
  { name: 'Honda Shop Celje', brand: 'Honda', address: 'Celje, Mariborska cesta', lat: 46.235, lng: 15.270, phone: '+386 3 421 56 00', services: ['Servis', 'Deli'], rating: 4.0 },
  { name: 'KTM Center Kranj', brand: 'KTM', address: 'Kranj, Predoslje', lat: 46.245, lng: 14.370, phone: '+386 4 213 45 00', services: ['Servis', 'Gume', 'Olije', 'Deli', 'Terenska oprema'], rating: 4.7 },
  { name: 'Moto Servis Novo mesto', brand: null, address: 'Novo mesto', lat: 45.800, lng: 15.170, phone: '+386 7 334 12 00', services: ['Servis', 'Gume', 'Olije'], rating: 3.8 },
  { name: 'Suzuki Service Koper', brand: 'Suzuki', address: 'Koper, Prisoje', lat: 45.550, lng: 13.740, phone: '+386 5 627 89 00', services: ['Servis', 'Gume'], rating: 4.1 },
  { name: 'Moto Pohorje Maribor', brand: null, address: 'Maribor, Pohorska ulica', lat: 46.545, lng: 15.610, phone: '+386 2 450 34 00', services: ['Servis', 'Terenska oprema'], rating: 4.3 },
  { name: 'Ducati Ljubljana', brand: 'Ducati', address: 'Ljubljana, Tržaška cesta', lat: 46.045, lng: 14.495, phone: '+386 1 256 78 00', services: ['Servis', 'Olije', 'Deli'], rating: 4.6 },
  { name: 'Kawasaki Center Ptuj', brand: 'Kawasaki', address: 'Ptuj', lat: 46.420, lng: 15.870, phone: '+386 2 788 90 00', services: ['Servis', 'Gume', 'Olije'], rating: 3.9 },
  { name: 'Triumph Slovenia', brand: 'Triumph', address: 'Ljubljana, Vič', lat: 46.030, lng: 14.490, phone: '+386 1 426 56 00', services: ['Servis', 'Deli', 'Olije'], rating: 4.4 },
]

function getFallbackResults(lat: number, lng: number, radius: number, brand: string | null): LiveServiceCenter[] {
  return fallbackCenters
    .map((c, i) => ({
      id: `db${i + 1}`,
      name: c.name,
      type: c.brand ? 'dealer' : 'mechanic',
      brand: c.brand,
      lat: c.lat,
      lng: c.lng,
      distance: Math.round(haversine(lat, lng, c.lat, c.lng) * 10) / 10,
      address: c.address,
      phone: c.phone,
      website: null,
      rating: c.rating,
      services: c.services,
      live: false,
      source: 'database' as const,
    }))
    .filter(c => {
      if (brand && c.brand?.toLowerCase() !== brand.toLowerCase()) return false
      return c.distance <= radius
    })
    .sort((a, b) => a.distance - b.distance)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const brand = searchParams.get('brand') || null
    const type = searchParams.get('type') || null
    const lat = parseFloat(searchParams.get('lat') || '46.15')
    const lng = parseFloat(searchParams.get('lng') || '14.99')
    const radius = parseFloat(searchParams.get('radius') || '50')

    // Check cache first
    const cacheKey = `${brand || 'all'}-${type || 'all'}-${lat.toFixed(2)}-${lng.toFixed(2)}-${radius}`
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ data: cached.data, cached: true })
    }

    // Always include database results
    const dbResults = getFallbackResults(lat, lng, radius, brand)
    const webResults: LiveServiceCenter[] = []

    try {
      // Dynamically import z-ai-web-dev-sdk (backend only)
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      // Build search query
      const searchQuery = buildSearchQuery(brand, type, lat, lng)
      console.log(`[Live Service Centers] Searching: "${searchQuery}"`)

      // Perform web search
      const searchResults = await zai.functions.invoke('web_search', {
        query: searchQuery,
        num: 8,
      }) as WebSearchResult[]

      if (Array.isArray(searchResults) && searchResults.length > 0) {
        // Process top results
        const resultsToProcess = searchResults.slice(0, 5)

        for (let i = 0; i < resultsToProcess.length; i++) {
          const result = resultsToProcess[i]

          // Try to read the page for more details
          let pageContent = ''
          try {
            const pageData = await zai.functions.invoke('web_reader', {
              url: result.url,
            }) as { html?: string; content?: string; text?: string }
            pageContent = pageData?.html || pageData?.content || pageData?.text || ''
          } catch {
            // Page reading can fail, continue with search snippet
            console.log(`[Live Service Centers] Could not read page: ${result.url}`)
          }

          // Extract information from page and snippet
          const extracted = extractInfoFromPage(pageContent, result.url, result.name, result.snippet)

          // Estimate coordinates
          const coords = estimateCoordinates(extracted.address || null, result.snippet, lat, lng)

          // Determine type based on search terms and snippet
          const lowerSnippet = result.snippet.toLowerCase()
          let centerType = 'mechanic'
          if (lowerSnippet.includes('diler') || lowerSnippet.includes('dealer') || lowerSnippet.includes('prodaja')) {
            centerType = 'dealer'
          } else if (lowerSnippet.includes('gume') || lowerSnippet.includes('pnevmatik') || lowerSnippet.includes('tire')) {
            centerType = 'tire_shop'
          } else if (lowerSnippet.includes('deli') || lowerSnippet.includes('parts')) {
            centerType = 'parts'
          } else if (lowerSnippet.includes('pregled') || lowerSnippet.includes('inspection')) {
            centerType = 'inspection'
          } else if (lowerSnippet.includes('praln') || lowerSnippet.includes('wash')) {
            centerType = 'washing'
          }

          // Determine brand from name/snippet
          const brandKeywords = ['BMW', 'Honda', 'Yamaha', 'KTM', 'Suzuki', 'Kawasaki', 'Ducati', 'Triumph', 'Harley', 'Aprilia', 'Moto Guzzi', 'Husqvarna']
          let detectedBrand: string | null = null
          for (const bk of brandKeywords) {
            if (result.name.toLowerCase().includes(bk.toLowerCase()) || lowerSnippet.includes(bk.toLowerCase())) {
              detectedBrand = bk
              break
            }
          }

          const distance = Math.round(haversine(lat, lng, coords.lat, coords.lng) * 10) / 10

          // Only include if within radius
          if (distance <= radius) {
            webResults.push({
              id: `web${i + 1}`,
              name: result.name || 'Neznan servis',
              type: centerType,
              brand: detectedBrand,
              lat: Math.round(coords.lat * 1000) / 1000,
              lng: Math.round(coords.lng * 1000) / 1000,
              distance,
              address: extracted.address || null,
              phone: extracted.phone || null,
              website: extracted.website || null,
              rating: 4.0 + Math.random() * 0.8, // Estimate rating 4.0-4.8 for web results
              services: extracted.services || ['Servis'],
              live: true,
              source: 'web',
            })
          }
        }
      }
    } catch (searchError) {
      console.error('[Live Service Centers] Web search error:', searchError)
      // Continue with database results only
    }

    // Merge and deduplicate results
    const allResults = [...webResults, ...dbResults]

    // Deduplicate by name similarity
    const seen = new Set<string>()
    const deduped: LiveServiceCenter[] = []
    for (const r of allResults) {
      const normalizedName = r.name.toLowerCase().replace(/[^a-z0-9čšž]/g, '')
      if (!seen.has(normalizedName)) {
        seen.add(normalizedName)
        deduped.push(r)
      }
    }

    // Sort by distance
    deduped.sort((a, b) => a.distance - b.distance)

    // Cache for 2 hours
    cache.set(cacheKey, { data: deduped, expiresAt: Date.now() + 2 * 60 * 60 * 1000 })

    return NextResponse.json({ data: deduped, cached: false })
  } catch (error) {
    console.error('[Live Service Centers] Fatal error:', error)
    return NextResponse.json({ error: 'Napaka pri iskanju servisov' }, { status: 500 })
  }
}
