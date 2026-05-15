import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface WebSearchResult {
  url: string
  name: string
  snippet: string
  host_name: string
  rank: number
  date?: string
  favicon?: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    // Parse and validate num parameter
    let num = parseInt(searchParams.get('num') || '5', 10)
    if (isNaN(num) || num < 1) num = 5
    if (num > 10) num = 10

    // Dynamically import z-ai-web-dev-sdk (backend only)
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Perform web search
    const results = await zai.functions.invoke('web_search', {
      query: query.trim(),
      num,
    }) as WebSearchResult[]

    return NextResponse.json({
      success: true,
      results: Array.isArray(results) ? results : [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Web search failed'
    console.error('[Web Search API] Error:', message)
    return NextResponse.json(
      { success: false, error: message, results: [] },
      { status: 500 }
    )
  }
}
