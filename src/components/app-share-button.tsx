'use client'

import React, { useState, useCallback } from 'react'
import { Share2, Copy, QrCode, MessageCircle, Mail, Phone, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface AppShareButtonProps {
  variant?: 'button' | 'icon'
  className?: string
}

export function AppShareButton({ variant = 'icon', className = '' }: AppShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrGenerated, setQrGenerated] = useState(false)
  const [qrSvg, setQrSvg] = useState<string>('')

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const shareText = `MotoTrack - GPS sledenje za motoriste! Namesti si aplikacijo: ${appUrl}`
  const shareTitle = 'MotoTrack - Motoristična aplikacija'

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: appUrl })
        return
      } catch { /* fallback to dialog */ }
    }
    setOpen(true)
  }, [shareTitle, shareText, appUrl])

  const handleCopyLink = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(appUrl)
      } else {
        // Fallback for non-HTTPS (insecure context)
        const textArea = document.createElement('textarea')
        textArea.value = appUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      toast.success('Povezava kopirana!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Napaka pri kopiranju')
    }
  }, [appUrl])

  const generateQR = useCallback(async () => {
    if (qrGenerated) return
    try {
      // Simple QR code using an API
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appUrl)}&bgcolor=0a0a0a&color=ffffff&format=svg`
      setQrSvg(qrUrl)
      setQrGenerated(true)
    } catch {
      toast.error('Napaka pri generiranju QR kode')
    }
  }, [appUrl, qrGenerated])

  const shareWhatsApp = () => {
    window.location.href = `https://wa.me/?text=${encodeURIComponent(shareText)}`
  }
  const shareEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText)}`
  }
  const shareSMS = () => {
    window.location.href = `sms:?body=${encodeURIComponent(shareText)}`
  }

  return (
    <>
      {variant === 'icon' ? (
        <Button variant="ghost" size="icon" className={`size-7 ${className}`} onClick={handleNativeShare}>
          <Share2 className="size-3.5" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" className={`gap-1.5 ${className}`} onClick={handleNativeShare}>
          <Share2 className="size-4" /> Deli aplikacijo
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogTitle className="text-center">Deli MotoTrack</DialogTitle>
          <div className="space-y-4 py-2">
            {/* App URL with copy button */}
            <div className="flex gap-2">
              <Input value={appUrl} readOnly className="text-xs flex-1" />
              <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={handleCopyLink}>
                {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                {copied ? 'Kopirano' : 'Kopiraj'}
              </Button>
            </div>

            {/* QR Code section */}
            <div className="text-center">
              <Button variant="outline" size="sm" className="gap-1.5 mb-3" onClick={generateQR}>
                <QrCode className="size-4" /> Prikaži QR kodo
              </Button>
              {qrGenerated && (
                <div className="bg-white rounded-xl p-3 inline-block">
                  <img src={qrSvg} alt="QR Code" width="180" height="180" className="rounded-lg" />
                  <p className="text-[10px] text-gray-500 mt-1">Skeniraj za namestitev</p>
                </div>
              )}
            </div>

            {/* Share buttons */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Deli preko</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={shareWhatsApp} className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 transition-colors">
                  <MessageCircle className="size-5 text-green-500" />
                  <span className="text-[10px] font-medium">WhatsApp</span>
                </button>
                <button onClick={shareEmail} className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                  <Mail className="size-5 text-blue-500" />
                  <span className="text-[10px] font-medium">Email</span>
                </button>
                <button onClick={shareSMS} className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors">
                  <Phone className="size-5 text-purple-500" />
                  <span className="text-[10px] font-medium">SMS</span>
                </button>
              </div>
            </div>

            {/* Instructions for installation */}
            <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <ExternalLink className="size-3.5" /> Kako namestiti
              </p>
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p>📱 <strong>Android:</strong> Meni → Namesti aplikacijo</p>
                <p>🍎 <strong>iPhone:</strong> Deli → Dodaj na domači zaslon</p>
                <p>💻 <strong>Računalnik:</strong> Ikona namestitve v naslovni vrstici</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
