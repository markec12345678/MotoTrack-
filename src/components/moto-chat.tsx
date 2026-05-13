'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Trash2, Bike, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function MotoChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '🏍️ Živjo! Sem MotoTrack AI asistent. Vprašaj me o motociklističnih poteh, slovenskih prelazih, varnosti ali opremi!',
      timestamp: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `chat-${Date.now()}`)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        toast.error(data.error || 'Napaka pri pošiljanju')
        // Remove the user message if the API failed
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
    'Nasveti za začetnike',
    'Vršič ali Predel?',
    'Kakšno vreme za vikend?',
  ]

  return (
    <>
      {/* Floating chat button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-[1600] size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 flex items-center justify-center"
          aria-label="Odpri klepet"
        >
          <MessageCircle className="size-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-16 right-0 sm:right-4 z-[1600] w-full sm:w-96 max-h-[70vh] flex flex-col bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
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
                <p className="text-[10px] text-muted-foreground">Motociklistični asistent</p>
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
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-secondary rounded-tl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
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
                    <div className="flex gap-1">
                      <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                      <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                      <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
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
                      setTimeout(() => {
                        const fakeEvent = { preventDefault: () => {} }
                        // We'll just set the input and let them press send
                      }, 0)
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
                placeholder="Vprašaj o poteh, prelazih..."
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
