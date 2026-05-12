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
      { role: 'assistant', content: SYSTEM_PROMPT }
    ]

    // Add user message
    history.push({ role: 'user', content: message })

    // Trim history if too long (keep system prompt + last 20 messages)
    if (history.length > 22) {
      history = [history[0], ...history.slice(-21)]
    }

    // Use z-ai-web-dev-sdk
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const completion = await zai.chat.completions.create({
      messages: history.map(m => ({ role: m.role as 'assistant' | 'user', content: m.content })),
      thinking: { type: 'disabled' },
    })

    const aiResponse = completion.choices?.[0]?.message?.content || 'Oprostite, nisem mogel odgovoriti. Poskusite znova.'

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
