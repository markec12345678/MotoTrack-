'use client'

import React, { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches
    }
    return false
  })

  useEffect(() => {
    // Already installed — no need to listen for prompt
    if (isInstalled) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show prompt after a short delay (don't be too aggressive)
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Check if dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedAt = new Date(dismissed)
      const daysSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) return // Don't show again for 7 days
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isInstalled])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  if (!showPrompt || isInstalled) return null

  return (
    <div className="fixed bottom-24 left-4 z-[1599] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-2xl p-3 shadow-xl max-w-xs">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Smartphone className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold">Namesti MotoTrack</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Dobi hitri dostop iz domačega zaslona!
            </p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" className="text-[10px] gap-1 h-6 rounded-full px-2" onClick={handleInstall}>
                <Download className="size-3" /> Namesti
              </Button>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 rounded-full px-2" onClick={handleDismiss}>
                Ne zdaj
              </Button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
