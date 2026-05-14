import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── Fallback realistic Slovenian fuel prices (early 2025) ────────────────
const FALLBACK_PRICES: Record<string, number> = {
  '95': 1.559,
  '98': 1.679,
  diesel: 1.519,
  lpg: 0.899,
}

// ─── Fuel type labels in Slovenian ─────────────────────────────────────────
const FUEL_TYPE_LABELS: Record<string, string> = {
  '95': 'Bencin 95',
  '98': 'Bencin 98',
  diesel: 'Dizel',
  lpg: 'Avtoplin',
}

// ─── Search queries for live fuel prices ───────────────────────────────────
const SEARCH_QUERIES = [
  'cena goriva Slovenija Petrol OMV MOL danes 2025',
  'uradna cena goriva Slovenija bencin dizel',
  'Petrol Slovenija cene goriva bencin 95 98 dizel avtoplin',
]

// ─── In-memory cache ──────────────────────────────────────────────────────
interface CachedPrices {
  prices: Record<string, number>
  nationalPrices: Record<string, number>
  live: boolean
  lastUpdated: string
  source: string
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

let cachedPrices: CachedPrices | null = null

// ─── Distance helper ──────────────────────────────────────────────────────
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Web search types ─────────────────────────────────────────────────────
interface WebSearchResult {
  url: string
  name: string
  snippet: string
  host_name: string
  rank: number
  date?: string
  favicon?: string
}

interface WebPageContent {
  title?: string
  html?: string
  content?: string
}

// ─── Parse fuel prices from text ──────────────────────────────────────────
function parseFuelPricesFromText(text: string): Record<string, number> {
  const prices: Record<string, number> = {}

  // Normalize whitespace and common HTML artifacts
  const normalized = text
    .replace(/<[^>]+>/g, ' ')       // strip HTML tags
    .replace(/&nbsp;/gi, ' ')       // decode &nbsp;
    .replace(/&euro;/gi, '€')       // decode &euro;
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()

  // ── Pattern definitions for each fuel type ──
  const patterns: Array<{ key: string; regexes: RegExp[] }> = [
    {
      key: '95',
      regexes: [
        // "Bencin 95: 1,559 €/L" or "Bencin 95: 1,559 EUR/L"
        /(?:bencin\s*95|bmb\s*95|bnm\s*95|super\s*95|95[\s-]*oktanski)[^\d]*?(\d)[,.](\d{2,3})\s*(?:€|EUR|€\/L|EUR\/L|€\/l)?/i,
        // "Bencin 95: 1,559" (no currency)
        /(?:bencin\s*95|bmb\s*95|bnm\s*95|super\s*95)[^\d]*?(\d)[,.](\d{2,3})/i,
        // "95: 1,559" or "95 - 1,559"
        /(?:^|\s)95[\s:]+(\d)[,.](\d{2,3})/im,
        // "Bencin 95 ... 1,559" within 80 chars
        /(?:bencin\s*95).{0,80}?(\d)[,.](\d{2,3})/i,
      ],
    },
    {
      key: '98',
      regexes: [
        /(?:bencin\s*98|super\s*98|super\s*plus|98[\s-]*oktanski|bmb\s*98)[^\d]*?(\d)[,.](\d{2,3})\s*(?:€|EUR|€\/L|EUR\/L|€\/l)?/i,
        /(?:bencin\s*98|super\s*98|super\s*plus|bmb\s*98)[^\d]*?(\d)[,.](\d{2,3})/i,
        /(?:^|\s)98[\s:]+(\d)[,.](\d{2,3})/im,
        /(?:bencin\s*98).{0,80}?(\d)[,.](\d{2,3})/i,
      ],
    },
    {
      key: 'diesel',
      regexes: [
        /(?:dizel(?:sko)?|diesel|d2|gorivo\s*dizel|dizel\s*gorivo)[^\d]*?(\d)[,.](\d{2,3})\s*(?:€|EUR|€\/L|EUR\/L|€\/l)?/i,
        /(?:dizel(?:sko)?|diesel|d2|gorivo\s*dizel|dizel\s*gorivo)[^\d]*?(\d)[,.](\d{2,3})/i,
        /(?:cena\s*dizel|cena\s*diesel)[^\d]*?(\d)[,.](\d{2,3})/i,
        /(?:dizel).{0,80}?(\d)[,.](\d{2,3})/i,
      ],
    },
    {
      key: 'lpg',
      regexes: [
        /(?:avtoplin|lpg|plinsko\s*gorivo|autogas|lp\s*g)[^\d]*?(\d)[,.](\d{2,3})\s*(?:€|EUR|€\/L|EUR\/L|€\/l)?/i,
        /(?:avtoplin|lpg|plinsko\s*gorivo|autogas|lp\s*g)[^\d]*?(\d)[,.](\d{2,3})/i,
        /(?:cena\s*avtoplin|cena\s*lpg)[^\d]*?(\d)[,.](\d{2,3})/i,
        /(?:avtoplin).{0,80}?(\d)[,.](\d{2,3})/i,
      ],
    },
  ]

  // ── Try each pattern ──
  for (const pattern of patterns) {
    for (const regex of pattern.regexes) {
      const match = regex.exec(normalized)
      if (match) {
        const whole = match[1]
        const decimal = match[2]
        const price = parseFloat(`${whole}.${decimal.padEnd(3, '0').slice(0, 3)}`)
        // Sanity checks based on fuel type
        const minPrice = pattern.key === 'lpg' ? 0.3 : 1.0
        const maxPrice = pattern.key === 'lpg' ? 1.5 : 2.5
        if (price >= minPrice && price <= maxPrice) {
          prices[pattern.key] = price
          break // Found a valid price for this type, move to next type
        }
      }
    }
  }

  // ── Fallback: scan for price-like numbers near fuel keywords ──
  if (Object.keys(prices).length < 2) {
    const fuelSectionRegex = /(?:cena|gorivo|bencin|dizel|diesel|avtoplin|lpg|fuel|preis|oktanski)[^\n]{0,300}/gi
    let fuelMatch
    while ((fuelMatch = fuelSectionRegex.exec(normalized)) !== null) {
      const section = fuelMatch[0]
      // Match prices in format X,XXX or X.XXX
      const priceRegex = /(\d)[,.](\d{2,3})/g
      let priceMatch
      while ((priceMatch = priceRegex.exec(section)) !== null) {
        const price = parseFloat(`${priceMatch[1]}.${priceMatch[2].padEnd(3, '0').slice(0, 3)}`)
        if (price < 0.3 || price > 2.5) continue

        const beforePrice = section.substring(0, priceMatch.index)
        // Assign to fuel type based on nearest preceding keyword
        if (/(?:avtoplin|lpg|autogas)/i.test(beforePrice) && !prices.lpg) {
          if (price >= 0.3 && price <= 1.5) prices.lpg = price
        } else if (/(?:95|bencin\s*95|bmb\s*95|super\s*95)/i.test(beforePrice) && !prices['95']) {
          prices['95'] = price
        } else if (/(?:98|bencin\s*98|bmb\s*98|super\s*98)/i.test(beforePrice) && !prices['98']) {
          prices['98'] = price
        } else if (/(?:dizel|diesel|d2)/i.test(beforePrice) && !prices.diesel) {
          prices.diesel = price
        } else if (/(?:bencin)/i.test(beforePrice) && !prices['95']) {
          // Generic "bencin" without octane — assume 95
          prices['95'] = price
        }
      }
    }
  }

  // ── Table-style parsing: look for rows with fuel name + price ──
  if (Object.keys(prices).length < 2) {
    // Match patterns like "Bencin 95  1,559  1,559" or "Dizel  1,519  1,519"
    const tableRowRegex = /(bencin\s*(?:95|98)|dizel(?:sko)?|diesel|avtoplin|lpg)\s+(\d)[,.](\d{2,3})/gi
    let rowMatch
    while ((rowMatch = tableRowRegex.exec(normalized)) !== null) {
      const fuelName = rowMatch[1].toLowerCase()
      const whole = rowMatch[2]
      const decimal = rowMatch[3]
      const price = parseFloat(`${whole}.${decimal.padEnd(3, '0').slice(0, 3)}`)

      let key: string | null = null
      if (/bencin\s*95/.test(fuelName)) key = '95'
      else if (/bencin\s*98/.test(fuelName)) key = '98'
      else if (/dizel|diesel/.test(fuelName)) key = 'diesel'
      else if (/avtoplin|lpg/.test(fuelName)) key = 'lpg'

      if (key && !prices[key]) {
        const minPrice = key === 'lpg' ? 0.3 : 1.0
        const maxPrice = key === 'lpg' ? 1.5 : 2.5
        if (price >= minPrice && price <= maxPrice) {
          prices[key] = price
        }
      }
    }
  }

  return prices
}

// ─── Parse national/regulated prices from text ────────────────────────────
function parseNationalPricesFromText(text: string): Record<string, number> {
  const prices: Record<string, number> = {}

  const normalized = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&euro;/gi, '€')
    .replace(/\s+/g, ' ')
    .trim()

  // Look for patterns indicating regulated/official prices
  // e.g., "Uradna cena", "Odobrena cena", "regulirana cena", "najvišja cena"
  const regulatedSectionRegex = /(?:uradna|odobrena|regulirana|najvišja|maximalna)\s*cena[^\n]{0,500}/gi
  let sectionMatch
  while ((sectionMatch = regulatedSectionRegex.exec(normalized)) !== null) {
    const section = sectionMatch[0]
    const parsed = parseFuelPricesFromText(section)
    for (const [key, value] of Object.entries(parsed)) {
      if (!prices[key]) prices[key] = value
    }
  }

  // Also look for "od [date]" patterns which indicate price changes
  const odDateSectionRegex = /od\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}[^\n]{0,500}/gi
  while ((sectionMatch = odDateSectionRegex.exec(normalized)) !== null) {
    const section = sectionMatch[0]
    const parsed = parseFuelPricesFromText(section)
    for (const [key, value] of Object.entries(parsed)) {
      if (!prices[key]) prices[key] = value
    }
  }

  return prices
}

// ─── Calculate price trend ────────────────────────────────────────────────
function calculatePriceTrend(
  livePrices: Record<string, number>,
  fallbackPrices: Record<string, number>
): Record<string, 'up' | 'down' | 'stable'> {
  const trend: Record<string, 'up' | 'down' | 'stable'> = {}
  const threshold = 0.005 // 0.5 cent difference to consider a change

  for (const key of Object.keys(fallbackPrices)) {
    const live = livePrices[key]
    const fallback = fallbackPrices[key]
    if (live == null || fallback == null) {
      trend[key] = 'stable'
      continue
    }
    const diff = live - fallback
    if (diff > threshold) trend[key] = 'up'
    else if (diff < -threshold) trend[key] = 'down'
    else trend[key] = 'stable'
  }

  return trend
}

// ─── Merge prices from multiple search results ────────────────────────────
function mergePrices(
  existing: Record<string, number>,
  incoming: Record<string, number>
): Record<string, number> {
  const merged = { ...existing }
  for (const [key, value] of Object.entries(incoming)) {
    // Only fill in missing prices; first found price takes precedence
    if (!merged[key]) merged[key] = value
  }
  return merged
}

// ─── Web search for real fuel prices ──────────────────────────────────────
async function fetchLivePrices(): Promise<CachedPrices> {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    let extractedPrices: Record<string, number> = {}
    let extractedNationalPrices: Record<string, number> = {}
    let sourceLabel = 'web_search'
    let foundEnough = false

    // ── Try multiple search queries ──
    for (const query of SEARCH_QUERIES) {
      if (foundEnough) break

      const searchResults = await zai.functions.invoke('web_search', {
        query,
        num: 6,
      }) as WebSearchResult[]

      if (!Array.isArray(searchResults) || searchResults.length === 0) continue

      // ── Try reading top result pages ──
      for (const result of searchResults.slice(0, 3)) {
        try {
          const pageContent = await zai.functions.invoke('web_reader', {
            url: result.url,
          }) as WebPageContent

          const text = pageContent?.content || pageContent?.html || ''
          if (!text) continue

          const pagePrices = parseFuelPricesFromText(text)
          extractedPrices = mergePrices(extractedPrices, pagePrices)

          // Also try to extract national regulated prices
          const nationalPagePrices = parseNationalPricesFromText(text)
          extractedNationalPrices = mergePrices(extractedNationalPrices, nationalPagePrices)

          // If we got enough prices from this page, mark source
          if (Object.keys(pagePrices).length >= 2 && sourceLabel === 'web_search') {
            try {
              sourceLabel = new URL(result.url).hostname
            } catch {
              sourceLabel = result.host_name || 'web_search'
            }
          }

          // Consider it enough if we have at least 3 fuel types
          if (Object.keys(extractedPrices).length >= 3) {
            foundEnough = true
            break
          }
        } catch {
          // Skip this page, try next
        }
      }

      // ── If web_reader didn't find enough, try parsing search snippets ──
      if (!foundEnough && Object.keys(extractedPrices).length < 2) {
        const allSnippets = searchResults.map(r => `${r.name} ${r.snippet}`).join(' ')
        const snippetPrices = parseFuelPricesFromText(allSnippets)
        extractedPrices = mergePrices(extractedPrices, snippetPrices)

        const snippetNationalPrices = parseNationalPricesFromText(allSnippets)
        extractedNationalPrices = mergePrices(extractedNationalPrices, snippetNationalPrices)

        if (Object.keys(extractedPrices).length >= 2 && sourceLabel === 'web_search') {
          sourceLabel = 'web_search_snippets'
        }
      }
    }

    // ── Determine if we have live data ──
    const hasLivePrices = Object.keys(extractedPrices).length >= 2

    // ── Build final prices with fallbacks ──
    const finalPrices: Record<string, number> = {
      '95': extractedPrices['95'] ?? FALLBACK_PRICES['95'],
      '98': extractedPrices['98'] ?? FALLBACK_PRICES['98'],
      diesel: extractedPrices.diesel ?? FALLBACK_PRICES.diesel,
      lpg: extractedPrices.lpg ?? FALLBACK_PRICES.lpg,
    }

    // ── Build national prices (regulated by Slovenian government) ──
    // National prices may not always be available; fall back to base prices
    const finalNationalPrices: Record<string, number> = {
      '95': extractedNationalPrices['95'] ?? finalPrices['95'],
      '98': extractedNationalPrices['98'] ?? finalPrices['98'],
      diesel: extractedNationalPrices.diesel ?? finalPrices.diesel,
      lpg: extractedNationalPrices.lpg ?? finalPrices.lpg,
    }

    return {
      prices: finalPrices,
      nationalPrices: finalNationalPrices,
      live: hasLivePrices,
      lastUpdated: new Date().toISOString(),
      source: hasLivePrices ? sourceLabel : 'fallback',
    }
  } catch (err) {
    console.error('[Fuel Prices API] Web search failed:', err)
    return {
      prices: { ...FALLBACK_PRICES },
      nationalPrices: { ...FALLBACK_PRICES },
      live: false,
      lastUpdated: new Date().toISOString(),
      source: 'fallback',
    }
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '46.15')
    const lng = parseFloat(searchParams.get('lng') || '14.99')
    const radius = parseFloat(searchParams.get('radius') || '25')
    const fuelType = searchParams.get('fuelType') || '95'
    const forceLive = searchParams.get('live') === 'true'

    // ── Resolve prices (cached, live, or fallback) ──
    let priceData: CachedPrices

    if (forceLive || !cachedPrices || (Date.now() - new Date(cachedPrices.lastUpdated).getTime() > CACHE_TTL_MS)) {
      priceData = await fetchLivePrices()
      cachedPrices = priceData
    } else {
      priceData = cachedPrices
    }

    const basePrices = priceData.prices

    // ── Calculate price trend ──
    const priceTrend = calculatePriceTrend(basePrices, FALLBACK_PRICES)

    // ── Fetch gas station POIs from DB ──
    const pois = await db.poi.findMany({ where: { type: 'gas_station' } })

    const stations = pois
      .map((poi) => {
        const distance = calculateDistance(lat, lng, poi.lat, poi.lng)
        const brand = poi.name.includes('Petrol')
          ? 'Petrol'
          : poi.name.includes('OMV')
            ? 'OMV'
            : poi.name.includes('MOL')
              ? 'MOL'
              : poi.name.includes('Shell')
                ? 'Shell'
                : null

        // Small brand-specific variation around base prices
        const brandModifier: Record<string, Record<string, number>> = {
          Petrol: { '95': 0, '98': 0, diesel: 0, lpg: 0 },
          OMV: { '95': 0.02, '98': 0.03, diesel: 0.01, lpg: 0.01 },
          MOL: { '95': 0.01, '98': 0.02, diesel: 0.005, lpg: 0.005 },
          Shell: { '95': 0.015, '98': 0.025, diesel: 0.01, lpg: 0.008 },
        }
        const modifier = brandModifier[brand || ''] || { '95': 0.01, '98': 0.02, diesel: 0.005, lpg: 0.005 }

        const stationPrices = {
          '95': Math.round((basePrices['95'] + modifier['95']) * 1000) / 1000,
          '98': Math.round((basePrices['98'] + modifier['98']) * 1000) / 1000,
          diesel: Math.round((basePrices.diesel + modifier.diesel) * 1000) / 1000,
          lpg: Math.round((basePrices.lpg + modifier.lpg) * 1000) / 1000,
        }

        return {
          id: poi.id,
          name: poi.name,
          lat: poi.lat,
          lng: poi.lng,
          distance: Math.round(distance * 10) / 10,
          prices: stationPrices,
          brand,
          address: poi.description,
        }
      })
      .filter((s) => s.distance <= radius)
      .sort(
        (a, b) =>
          (a.prices[fuelType as keyof typeof a.prices] || 99) -
          (b.prices[fuelType as keyof typeof b.prices] || 99)
      )

    return NextResponse.json({
      data: stations,
      nationalPrices: priceData.nationalPrices,
      live: priceData.live,
      lastUpdated: priceData.lastUpdated,
      source: priceData.source,
      priceTrend,
      fuelTypeLabels: FUEL_TYPE_LABELS,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
