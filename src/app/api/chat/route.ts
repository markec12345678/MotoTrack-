import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory conversation store (per session)
const conversations = new Map<string, Array<{ role: string; content: string }>>()

const SYSTEM_PROMPT = `Si MotoTrack AI asistent - strokovnjak za motociklizem in slovenske ceste. 
Odgovarjaš v slovenščini. Pomagaš z:
- Načrtovanjem motociklističnih poti po Sloveniji in okolici
- Nasveti o vožnji, varnosti in opremi
- Informacijami o prelazih, cestah in zanimivih destinacijah
- Vremenskimi nasveti za motoriste
- Predlogi za izlete glede na sezono in razmere

Bodi prijazen, strokoven in jedrnaten. Uporabljaj emoji-je 🏍️ pri naslovu.
Če te vprašajo o čem, kar ni povezano z motorji ali potovanji, vljudno preusmeri pogovor nazaj na motociklizem.`

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'google/gemma-4-31b-it:free'

/**
 * Try OpenRouter API first (free model)
 */
async function callOpenRouter(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  if (!OPENROUTER_API_KEY) {
    console.log('OpenRouter: No API key configured, skipping')
    return null
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mototrack.app',
        'X-Title': 'MotoTrack AI',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`OpenRouter error (${response.status}):`, errText)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      console.error('OpenRouter: Empty response')
      return null
    }

    console.log('OpenRouter: Success with model', OPENROUTER_MODEL)
    return content
  } catch (error: any) {
    console.error('OpenRouter fetch error:', error?.message || error)
    return null
  }
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

    // Add user message
    history.push({ role: 'user', content: message })

    // Trim history if too long (keep system prompt + last 20 messages)
    if (history.length > 22) {
      history = [history[0], ...history.slice(-21)]
    }

    // Build messages array for API calls
    const apiMessages = history.map(m => ({ role: m.role, content: m.content }))

    // Try OpenRouter first, fall back to z-ai-web-dev-sdk
    let aiResponse = await callOpenRouter(apiMessages)
    let provider = 'openrouter'

    if (!aiResponse) {
      console.log('OpenRouter failed, falling back to z-ai-web-dev-sdk')
      aiResponse = await callZAI(apiMessages)
      provider = 'z-ai'
    }

    // Add AI response to history
    history.push({ role: 'assistant', content: aiResponse })

    // Save updated history
    conversations.set(sid, history)

    // Clean up old conversations (keep last 50 sessions)
    if (conversations.size > 50) {
      const keys = Array.from(conversations.keys())
      keys.slice(0, conversations.size - 50).forEach(k => conversations.delete(k))
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1,
      provider,
    })
  } catch (error: any) {
    console.error('Chat API error:', error?.message || error)
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
