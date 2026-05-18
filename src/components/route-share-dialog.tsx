'use client'

import React, { useState, useCallback } from 'react'
import { Share2, Copy, Check, Link2, X, QrCode, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RouteShareDialogProps {
  open: boolean
  onClose: () => void
  routeId: string
  routeTitle?: string
}

export default function RouteShareDialog({ open, onClose, routeId, routeTitle }: RouteShareDialogProps) {
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateShare = useCallback(async () => {
    if (shareCode) return // Already generated
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/routes/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Napaka' }))
        throw new Error(data.error || 'Napaka pri deljenju')
      }
      const data = await res.json()
      setShareCode(data.data.shareCode)
      setShareUrl(data.data.shareUrl)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Napaka pri deljenju rute')
    } finally {
      setLoading(false)
    }
  }, [routeId, shareCode])

  // Auto-generate when dialog opens
  React.useEffect(() => {
    if (open && !shareCode && !loading) {
      generateShare()
    }
    if (!open) {
      // Reset when closing
      setShareCode(null)
      setShareUrl(null)
      setCopiedCode(false)
      setCopiedUrl(false)
      setError(null)
    }
  }, [open, shareCode, loading, generateShare])

  const copyToClipboard = useCallback(async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'code') {
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2000)
      } else {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      }
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }, [])

  const shareNative = useCallback(async () => {
    if (!shareUrl || !shareCode) return
    try {
      if (navigator.share) {
        await navigator.share({
          title: `MotoTrack Ruta: ${routeTitle || 'Deljena pot'}`,
          text: `Motoristična ruta na MotoTrack! Koda: ${shareCode}`,
          url: shareUrl,
        })
      } else {
        await copyToClipboard(shareUrl, 'url')
      }
    } catch {
      // User cancelled or share failed
    }
  }, [shareUrl, shareCode, routeTitle, copyToClipboard])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Share2 className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Deli ruto</h3>
              <p className="text-[10px] text-muted-foreground">Pošlji prijateljem kodo za nalaganje</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="size-8 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">Generiram kodo za deljenje...</span>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {shareCode && !loading && (
            <>
              {/* Share Code - Large, prominent */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Koda za deljenje</p>
                <div className="relative inline-flex items-center gap-2 bg-primary/10 border-2 border-primary/20 rounded-xl px-6 py-3">
                  <span className="text-2xl font-black tracking-[0.2em] text-primary font-mono">
                    {shareCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(shareCode, 'code')}
                    className="p-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                    title="Kopiraj kodo"
                  >
                    {copiedCode ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <Copy className="size-4 text-primary" />
                    )}
                  </button>
                </div>
                {copiedCode && (
                  <p className="text-xs text-emerald-500 mt-1 animate-in fade-in">Koda kopirana!</p>
                )}
              </div>

              {/* Share URL */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Povezava do rute</p>
                <div className="flex items-center gap-1.5">
                  <Input
                    readOnly
                    value={shareUrl || ''}
                    className="text-xs h-9 font-mono bg-muted/50"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-9 shrink-0"
                    onClick={() => copyToClipboard(shareUrl!, 'url')}
                    title="Kopiraj povezavo"
                  >
                    {copiedUrl ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Link2 className="size-3.5" />
                    )}
                  </Button>
                </div>
                {copiedUrl && (
                  <p className="text-[10px] text-emerald-500 mt-0.5 animate-in fade-in">Povezava kopirana!</p>
                )}
              </div>

              {/* How to use */}
              <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Kako uporabiti?</p>
                <p>1. Pošlji kodo <span className="font-mono text-primary">{shareCode}</span> prijatelju</p>
                <p>2. Prijatelj odpre MotoTrack in vnese kodo</p>
                <p>3. Ali pa odpre povezavo direktno v brskalniku</p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => copyToClipboard(shareCode, 'code')}
                >
                  {copiedCode ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copiedCode ? 'Kopirano!' : 'Kopiraj kodo'}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={shareNative}
                >
                  <Share2 className="size-4" />
                  Deli
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
