import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory conversation store (per session)
const conversations = new Map<string, Array<{ role: string; content: string }>>()

const SYSTEM_PROMPT = `Si MotoTrack AI asistent - strokovnjak za motociklizem, balkanske ceste in alpske prelaze. 
Odgovarjaš v slovenščini. Pomagaš z:

SLOVENIJA - PRELAZI IN CESTE:
- Vršič (1611m): 50 serpentin, najvišji slovenski prelaz, odprt apr-okt, enosmerni režim počitkih
- Mangartsko sedlo (2072m): najvišja slovenska cesta, ozka, za izkušene motoriste
- Predel (1156m): Soška dolina - Italija, čudovita pot ob reki Soči
- Ljubelj (1370m): najstarejši cestni prelaz v Evropi, strmi klanci, ozek predor
- Črni vrh: slikovita pot nad Idrijo, zavit in razgleden, slaven pri motoristih
- Jezersko - Preval: zavite gorske ceste, Kamniške Alpe
- Gorjanci: krasne vijugaste ceste na meji s Hrvaško
- Soška dolina: znamenita turkizna Soča, 40km vijugaste ceste
- Pivška planota: kraška polja in mirne ceste, skriti biser
- Robanškovo (Solčava): redko obiskana alpska cesta pod Olševo, čudovita
- Logarška dolina: ena najlepših alpskih dolin v Evropi, slap Rinka
- Švabski klanc: iz Slovenskih Konjic na Žičko kartuzijo, priljubljen
- Banjšice: kraška planota nad Soško dolino, razgledi na Julijske Alpe
- Vipavska dolina: mediteranski pridih, vinogradi, vijugaste ceste
- Kras (Sežana-Komen): suhozidi, vinogradi, razgledi na Tržaški zaliv
- Idrija-Vojsko: strma gozdna cesta, cerkev Sv. Ahacija
- Kojca-Cerkno: gozdna cesta z razgledi na Idrijsko hribovje
- Bohinjska kotlina: ob jezeru s pogledom na Savinjske Alpe
- Triglavska cesta (Dovje-Mojstrana): pod Triglavom, severne stene
- Col-Predmeja: vijugaste ceste Notranjske
- Cerkno-Škofja Loka: slikovito Cerkno hribovje
- Pohorje: gozdni klanci in razgledne ceste

HRVAŠKA - CESTE IN OTOKI:
- Jadranska magistrala: Senj-Zadar, ena najlepših obalnih cest v Evropi
- D8 obalna cesta: zavoji ob morju, razgledi na Velebit in otoke
- Biokovo cesta: planinska cesta z razgledom na Jadran z 1600m!
- Mali Alan: zavita gorska cesta skozi Velebit
- Učka pass: hrvaški prelaz z razgledom na Kvarner
- Pelješki most (2404m): nova povezava čez Malostonski zaliv
- Istra notranjost (Buzet-Motovun): srednjeveška mesta na hribih, vinogradi
- Pag: lunarna pokrajina, razgledi na modro morje
- Krk: 1430m dolg most in otoške ceste
- Cetinska krajina: vijugasta cesta ob reki Cetini
- Gorski Kotar (Delnice): gozdne ceste, priljubljene pri motoristih
- Paklenica-Velebit: gorska cesta skozi narodni park
- D1 Drniš-Knin: hitra vijugasta cesta skozi Dalmatinsko zagoro
- D60 Makarska-Vrgorac: strma cesta od obale v Zagoro, razgled na Biokovo

BALKANSKE POTI:
- Transfăgărășan (RO): legendarna pot čez Karpati, 90km ovinkov, odprta jul-okt
- Transalpina DN67C (RO): najvišja cesta v Romuniji (2145m), bolj divja
- Kotor serpentine (ME): 25 serpentin čez goro, osupljivi razgled na Boko Kotorsko
- Pivska klisura (ME): kanjon reke Pive ob modrem jezeru
- Morača klisura (ME): vijugasta cesta ob turkizni reki Morači
- Tara most (ME): najvišji most v Evropi (150m) čez klisuro
- Llogara Pass (AL): 1027m z razgledi na Jonsko morje in otoke
- Obala Albanije (Riviera): podobna Amalfijski obali, turkizno morje
- SH21 Theth-Valbona (AL): albanske Alpe, makadamske ceste, za enduro
- Meteora (GR): samostani na skalah, enkraten prizor
- Vikos klisura (GR): ena najglobljih sotesk na svetu, Zagori regija
- Mani (GR): divja obalna cesta, srednjeveški stolpi, prazne plaže
- Prelaz Katara (GR): legendaren med motoristi, Epir-Tesalija
- Prelaz Shipka (BG): zgodovinski prelaz čez Stara Planino
- Trojanski prelaz (BG): 1525m, vijugast in slikovit
- Rodopska gorska cesta (BG): smrekovi gozdovi, mirne ceste
- Rila samostan (BG): cesta do slavnega samostana z razgledi
- Uvac klisura (RS): meandri reke in beloglavi jastrebani
- Fruška Gora (RS): vinogradi in samostani nad Novim Sadom
- Đerdap Klisura (RS): Donava skozi eno najlepših rečnih dolin v Evropi
- Tara narodni park (RS): gozdna cesta z razgledi na Drinsko klisuro
- Mavrovo (MK): narodni park ob jezeru z zasneženimi vrhovi
- Krusevo (MK): najvišje mesto na Balkanu (1350m)
- Prelaz Tjentište (BA): Sutjeska narodni park
- Mostar-Blagaj (BA): slikovita cesta do tekije ob izviru Bune
- Bicaz klisura (RO): navpične stene, dramatična cesta
- Maramureș (RO): tradicionalne lesene cerkve in hribi
- Grossglockner (AT): 48km s 36 ovinki do 2504m, ena najbolj znanih v Evropi

VARNOST IN OPREMA:
- Adekvatna zaščitna oprema (čelada, jakna, hlače, škornji, rokavice)
- Prilagajanje hitrosti razmeram (mokro, listje, senca, živali)
- Preverjanje vremena pred odhodom v gore
- Zaloga goriva na redko naseljenih poteh (Balkan, Albanija)
- Cestnina in dokumenti za mednarodne poti

SEZONSKI NASVETI:
- Pomlad (apr-maj): prelazi se odpirajo, preveri zapored, snežni plohe
- Poletje (jun-avg): popolne razmere, a prometne obale
- Jesen (sep-okt): najlepše barve, hlajenje, krajši dnevi
- Zima (nov-mar): gorski prelazi zaprti, obalne ceste še na voljo

Bodi prijazen, strokoven in jedrnaten. Uporabljaj emoji-je 🏍️ pri naslovu.
Če te vprašajo o čem, kar ni povezano z motorji ali potovanji, vljudno preusmeri pogovor nazaj na motociklizem.
Če si prejel rezultate spletne iskanja, jih uporabi za dopolnitev svojega znanja. Vedno navedi, če so informacije aktualne (npr. "glede na trenutne razmere...").`

// Keywords that trigger web search
const SEARCH_KEYWORDS = [
  // Road conditions and closures
  'zapore', 'zapora', 'zaprt', 'zaprta', 'zaprto', 'closed', 'closure',
  'cestne razmere', 'razmere na cesti', 'stanje ceste', 'cesta zaprta',
  'obvozi', 'obvoz', 'detour', 'prelaz zaprt', 'prelazi odprti',
  'odprt', 'odprta', 'odprti', 'pass open', 'pass closed',
  // Weather
  'vreme', 'vremenska', 'napoved', 'weather', 'dež', 'sneg', 'megla',
  'nevihta', 'toča', 'poledica', 'slippery', 'mokro',
  'vreme za', 'vremenska napoved', 'ali bo deževalo',
  // Events and news
  'dogodek', 'prireditev', 'festival', 'rally', 'srečanje', 'event',
  'novice', 'novica', 'news', 'aktualno', 'danes', 'jutri', 'ta teden',
  'ta vikend', 'vikend', 'ta mesec',
  // Current conditions
  'trenutno', 'zdaj', 'trenutne', 'current', 'danes', 'jutri',
  'ali je', 'je odprt', 'je zaprta', 'kako je',
  // Road works
  'delo na cesti', 'road works', 'gradnja', 'sanacija', 'obnova ceste',
]

interface SearchResult {
  url: string
  name: string
  snippet: string
  host_name?: string
  rank?: number
  date?: string
  favicon?: string
}

/**
 * Detect if a message should trigger web search
 */
function shouldSearch(message: string): boolean {
  const lower = message.toLowerCase()
  return SEARCH_KEYWORDS.some(keyword => lower.includes(keyword))
}

/**
 * Build a search query from the user message
 */
function buildSearchQuery(message: string): string {
  // Add context for better search results
  const lower = message.toLowerCase()
  let query = message

  if (lower.includes('vreme') || lower.includes('napoved') || lower.includes('dež') || lower.includes('sneg')) {
    query = `vremenska napoved Slovenija Balkan motoristi ${message}`
  } else if (lower.includes('zapor') || lower.includes('zaprt') || lower.includes('cest')) {
    query = `cestne razmere zapore Slovenija Balkan ${message}`
  } else if (lower.includes('dogodek') || lower.includes('rally') || lower.includes('festival') || lower.includes('srečanje')) {
    query = `motociklistični dogodki Slovenija Balkan ${message}`
  } else {
    query = `motoristi Slovenija Balkan ${message}`
  }

  return query.slice(0, 200)
}

/**
 * Perform web search using z-ai-web-dev-sdk
 */
async function webSearch(query: string): Promise<SearchResult[]> {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const results = await zai.functions.invoke('web_search', {
      query,
      num: 5,
    })

    if (Array.isArray(results)) {
      return results.slice(0, 5) as SearchResult[]
    }

    return []
  } catch (error: unknown) {
    console.error('Web search error:', error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Format search results as context for the AI
 */
function formatSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return ''

  const formatted = results
    .map((r, i) => `[${i + 1}] ${r.name}\n    Vir: ${r.host_name || r.url}\n    ${r.snippet}`)
    .join('\n\n')

  return `\n\n--- AKTUALNE INFORMACIJE IZ SPLETA ---\n${formatted}\n--- KONEC AKTUALNIH INFORMACIJ ---\n\nUporabi zgornje aktualne informacije za dopolnitev svojega odgovora. Če so informacije relevantne, se sklici nanje. Če niso relevantne, jih ignoriraj in odgovori na podlagi svojega znanja.`
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// Multiple free models to try in order
const OPENROUTER_MODELS = [
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-4-scout:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen3-32b:free',
]

// Circuit breaker: if OpenRouter fails, skip it for N seconds
let openRouterCircuitOpen = false
let openRouterCircuitResetAt = 0
const CIRCUIT_COOLDOWN_MS = 60_000 // 1 minute cooldown after failure

/**
 * Try OpenRouter API with timeout, circuit breaker, and model fallback
 */
async function callOpenRouter(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  if (!OPENROUTER_API_KEY) {
    console.log('OpenRouter: No API key configured, skipping')
    return null
  }

  // Circuit breaker: skip OpenRouter if it recently failed
  if (openRouterCircuitOpen) {
    if (Date.now() < openRouterCircuitResetAt) {
      console.log('OpenRouter: Circuit breaker active, skipping')
      return null
    }
    openRouterCircuitOpen = false
  }

  // Try each free model in order with a 15-second timeout
  for (const model of OPENROUTER_MODELS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout per model

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mototrack.app',
          'X-Title': 'MotoTrack AI',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errText = await response.text()
        console.error(`OpenRouter error (${response.status}) with ${model}:`, errText.slice(0, 200))
        // If rate-limited, try next model
        if (response.status === 429) continue
        // Other errors: open circuit breaker and bail
        openRouterCircuitOpen = true
        openRouterCircuitResetAt = Date.now() + CIRCUIT_COOLDOWN_MS
        return null
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        console.error('OpenRouter: Empty response from', model)
        continue
      }

      console.log('OpenRouter: Success with model', model)
      return content
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`OpenRouter: Timeout (5s) with ${model}`)
      } else {
        console.error(`OpenRouter fetch error with ${model}:`, error instanceof Error ? error.message : error)
      }
      continue
    }
  }

  // All models failed - open circuit breaker
  openRouterCircuitOpen = true
  openRouterCircuitResetAt = Date.now() + CIRCUIT_COOLDOWN_MS
  return null
}

/**
 * Fallback to z-ai-web-dev-sdk
 */
async function callZAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()

  const completion = await zai.chat.completions.create({
    messages: messages.map(m => ({ role: m.role as 'assistant' | 'user', content: m.content })),
    thinking: { type: 'disabled' },
  })

  return completion.choices?.[0]?.message?.content || 'Oprostite, nisem mogel odgovoriti. Poskusite znova.'
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Message too long (max 2000 chars)' },
        { status: 400 }
      )
    }

    const sid = sessionId || 'default'

    // Get or create conversation history
    let history = conversations.get(sid) || [
      { role: 'system', content: SYSTEM_PROMPT }
    ]

    // Check if web search should be triggered
    let searchResults: SearchResult[] = []
    let searched = false
    let searchContext = ''

    if (shouldSearch(message)) {
      const searchQuery = buildSearchQuery(message)
      console.log('Chat: Web search triggered for query:', searchQuery)
      searchResults = await webSearch(searchQuery)
      searched = searchResults.length > 0
      searchContext = formatSearchContext(searchResults)
      if (searched) {
        console.log(`Chat: Found ${searchResults.length} search results`)
      }
    }

    // Add user message with search context if available
    const userContent = searchContext
      ? `${message}${searchContext}`
      : message

    history.push({ role: 'user', content: userContent })

    // Trim history if too long (keep system prompt + last 20 messages)
    if (history.length > 22) {
      history = [history[0], ...history.slice(-21)]
    }

    // Build messages array for API calls
    const apiMessages = history.map(m => ({ role: m.role, content: m.content }))

    // Try OpenRouter first (free models), fall back to z-ai-web-dev-sdk
    let aiResponse: string | null = null
    let provider = 'openrouter'

    aiResponse = await callOpenRouter(apiMessages)

    if (!aiResponse) {
      console.log('OpenRouter unavailable, falling back to z-ai')
      try {
        aiResponse = await callZAI(apiMessages)
        provider = 'z-ai'
      } catch (e: unknown) {
        console.error('z-ai also failed:', e instanceof Error ? e.message : e)
        aiResponse = null
      }
    }

    // Add AI response to history (without search context in stored version)
    history.push({ role: 'assistant', content: aiResponse || '' })

    // But we need to replace the user message in history with the original (no search context)
    // so future messages don't carry stale search context
    if (searched) {
      const lastUserIdx = history.findIndex((m, i) => i > 0 && m.role === 'user' && m.content === userContent)
      if (lastUserIdx !== -1) {
        history[lastUserIdx] = { role: 'user', content: message }
      }
    }

    // Save updated history
    conversations.set(sid, history)

    // Clean up old conversations (keep last 50 sessions)
    if (conversations.size > 50) {
      const keys = Array.from(conversations.keys())
      keys.slice(0, conversations.size - 50).forEach(k => conversations.delete(k))
    }

    // Build sources array for the client
    const sources = searched ? searchResults.map(r => ({
      name: r.name,
      url: r.url,
      snippet: r.snippet,
      hostName: r.host_name || '',
    })) : []

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1,
      provider,
      searched,
      sources,
    })
  } catch (error: unknown) {
    console.error('Chat API error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: 'Napaka pri komunikaciji z AI. Poskusite znova.' },
      { status: 500 }
    )
  }
}

// DELETE - clear conversation
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    if (sessionId) {
      conversations.delete(sessionId)
    }
    return NextResponse.json({ success: true, message: 'Pogovor počiščen' })
  } catch {
    return NextResponse.json({ success: false, error: 'Napaka' }, { status: 500 })
  }
}
