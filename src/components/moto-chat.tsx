'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Trash2, Bike, Bot, User, Volume2, Search, ExternalLink, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'

interface ChatSource {
  name: string
  url: string
  snippet: string
  hostName: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  searched?: boolean
  sources?: ChatSource[]
}

export default function MotoChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '🏍️ Živjo! Sem MotoTrack AI asistent. Vprašaj me o motociklističnih poteh, slovenskih prelazih, varnosti ali opremi! Lahko tudi vprašaš o trenutnih cestnih razmerah ali vremenu — poiskal bom aktualne informacije na spletu. 🔍',
      timestamp: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [sessionId] = useState(() => `chat-${Date.now()}`)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }
    }
  }, [])

  const speakMessage = useCallback(async (messageId: string, text: string) => {
    // If already playing, stop it
    if (playingAudio === messageId) {
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
        audioRef.current = null
      }
      setPlayingAudio(null)
      return
    }

    // Stop any previous audio
    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
    }

    setPlayingAudio(messageId)

    try {
      // Clean text for TTS - remove emojis and special chars
      const cleanText = text
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[🏗🏍🔍⚡🏔🌊☀🌧❄💨🛑🚗]/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/---[\s\S]*?---/g, '')
        .replace(/\n{2,}/g, '. ')
        .slice(0, 500)

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, speed: 1.0, voice: 'tongtong' }),
      })

      if (res.ok) {
        const audioBlob = await res.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        audioRef.current = audio
        audio.onended = () => {
          setPlayingAudio(null)
          URL.revokeObjectURL(audioUrl)
          audioRef.current = null
        }
        audio.onerror = () => {
          setPlayingAudio(null)
          toast.error('Napaka pri predvajanju')
        }
        audio.play()
      } else {
        setPlayingAudio(null)
        toast.error('Napaka pri generiranju govora')
      }
    } catch {
      setPlayingAudio(null)
      toast.error('Napaka pri povezavi')
    }
  }, [playingAudio])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, sessionId }),
      })

      const data = await res.json()

      if (data.success) {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: Date.now(),
          searched: data.searched || false,
          sources: data.sources || [],
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        toast.error(data.error || 'Napaka pri pošiljanju')
        setMessages(prev => prev.filter(m => m.id !== userMessage.id))
      }
    } catch {
      toast.error('Napaka pri povezavi')
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    } finally {
      setLoading(false)
    }
  }, [input, loading, sessionId])

  const clearChat = useCallback(async () => {
    try {
      await fetch(`/api/chat?sessionId=${sessionId}`, { method: 'DELETE' })
    } catch {
      // ignore
    }
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '🏍️ Pogovor počiščen! Kako ti lahko pomagam?',
        timestamp: Date.now(),
      },
    ])
  }, [sessionId])

  const quickPrompts = [
    'Najboljši prelazi v Sloveniji',
    'Vreme za vikend vožnjo',
    'Vršič ali Predel?',
    'Nasveti za začetnike',
    'Jadranska magistrala',
    'Gorivo na Balkanu',
  ]

  return (
    <>
      {/* Floating chat button - smaller, less intrusive */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 sm:bottom-24 sm:right-4 z-[1600] size-11 sm:size-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 flex items-center justify-center"
          aria-label="Odpri klepet"
        >
          <MessageCircle className="size-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-2 right-0 sm:right-4 sm:bottom-36 z-[1600] w-full sm:w-96 sm:max-h-[70vh] max-h-[85vh] flex flex-col bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/50 bg-primary/5">
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  <Bike className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-bold">MotoTrack AI</p>
                <p className="text-[10px] text-muted-foreground">Motociklistični asistent · 🔍 Iskanje po spletu</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8" onClick={clearChat} title="Počisti pogovor">
                <Trash2 className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setOpen(false)} title="Zapri">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 max-h-[45vh] p-3" ref={scrollRef}>
            <div className="space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className="size-7 shrink-0 mt-0.5">
                    <AvatarFallback
                      className={`text-[10px] ${
                        msg.role === 'user'
                          ? 'bg-secondary text-foreground'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {msg.role === 'user' ? <User className="size-3" /> : <Bot className="size-3" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[80%]">
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-secondary rounded-tl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    </div>

                    {/* AI message actions */}
                    {msg.role === 'assistant' && msg.id !== 'welcome' && (
                      <div className="flex items-center gap-1 mt-1 ml-1">
                        {/* TTS button */}
                        <button
                          onClick={() => speakMessage(msg.id, msg.content)}
                          className={`p-1 rounded transition-colors ${
                            playingAudio === msg.id
                              ? 'bg-primary/20 text-primary'
                              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                          title={playingAudio === msg.id ? 'Ustavi' : 'Predvajaj glas'}
                        >
                          <Volume2 className={`size-3 ${playingAudio === msg.id ? 'animate-pulse' : ''}`} />
                        </button>

                        {/* Search indicator */}
                        {msg.searched && (
                          <span className="flex items-center gap-0.5 text-[10px] text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                            <Search className="size-2.5" />
                            Iskanje po spletu
                          </span>
                        )}
                      </div>
                    )}

                    {/* Search sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-1.5 ml-1 space-y-1">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Viri</p>
                        {msg.sources.slice(0, 3).map((source, i) => (
                          <a
                            key={i}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary transition-colors group"
                          >
                            <ExternalLink className="size-2.5 shrink-0" />
                            <span className="truncate group-hover:underline">
                              {source.name || source.hostName || source.url}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      <Bot className="size-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <span className="size-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                      <span className="size-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                      <span className="size-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                      <span className="text-[10px] text-muted-foreground ml-2">MotoTrack AI razmišlja...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick prompts (show when few messages) */}
          {messages.length <= 2 && !loading && (
            <div className="px-3 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map(prompt => (
                  <button
                    key={prompt}
                    className="text-xs bg-secondary/50 hover:bg-secondary rounded-full px-3 py-1.5 transition-colors"
                    onClick={() => {
                      setInput(prompt)
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border/50 bg-background/50">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Vprašaj o poteh, prelazih, vremenu..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                disabled={loading}
                className="text-sm"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="shrink-0"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
