'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { WifiOff, RefreshCw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getInitialOnlineStatus() {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}

export function PwaRegister() {
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus)
  const [showOfflineBar, setShowOfflineBar] = useState(() => !getInitialOnlineStatus())
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [swQueueLength, setSwQueueLength] = useState(0)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  // Activate new service worker
  const activateNewWorker = useCallback((worker?: ServiceWorker) => {
    const targetWorker = worker || waitingWorker || registrationRef.current?.waiting
    if (targetWorker) {
      targetWorker.postMessage({ type: 'SKIP_WAITING' })
    }
  }, [waitingWorker])

  // Trigger background sync manually
  const triggerSync = useCallback(() => {
    const reg = registrationRef.current
    if (reg && 'sync' in reg) {
      reg.sync.register('mototrack-sync').catch(() => {
        navigator.serviceWorker.controller?.postMessage({ type: 'TRIGGER_SYNC' })
      })
    } else if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' })
    }
  }, [])

  // Keep triggerSync in a ref for use in the online/offline effect
  const triggerSyncRef = useRef(triggerSync)
  useEffect(() => { triggerSyncRef.current = triggerSync }, [triggerSync])

  // Register service worker and handle updates
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registrationRef.current = registration

        // Check for updates immediately
        registration.update()

        // Listen for waiting new service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available!
              setUpdateAvailable(true)
              setWaitingWorker(newWorker)
              toast.info('Na voljo je nova različica MotoTrack', {
                description: 'Osvežite aplikacijo za najnovejše spremembe.',
                duration: 10000,
                action: {
                  label: 'Osveži',
                  onClick: () => {
                    newWorker.postMessage({ type: 'SKIP_WAITING' })
                  },
                },
              })
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err)
      })

    // Handle controller change (new SW activated)
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data
      if (!data) return

      switch (data.type) {
        case 'QUEUE_STATUS':
          setSwQueueLength(data.queueLength || 0)
          break
        case 'SYNC_SUCCESS':
          toast.success('Sinhronizirano', {
            description: `${data.method} ${data.url?.split('/api/')[1]?.split('?')[0] || 'podatki'} uspešno posodobljeni`,
          })
          break
        case 'SYNC_FAILED':
          toast.error('Sinhronizacija neuspešna', {
            description: `${data.method} ${data.url?.split('/api/')[1]?.split('?')[0] || 'podatki'} — poskus bo ponovljen`,
          })
          break
        case 'SYNC_PROGRESS':
          if (data.completed > 0) {
            toast.success(`Sinhronizirano: ${data.completed} postavk${data.remaining > 0 ? `, ${data.remaining} čaka` : ''}`)
          }
          break
      }
    })
  }, [])

  // Monitor online/offline status — uses ref to avoid dependency on isOnline state
  const isOnlineRef = useRef(isOnline)
  useEffect(() => { isOnlineRef.current = isOnline }, [isOnline])

  useEffect(() => {
    const update = () => {
      const online = navigator.onLine
      const wasOffline = !isOnlineRef.current
      setIsOnline(online)
      setShowOfflineBar(!online)

      if (online && wasOffline) {
        // Coming back online — trigger background sync
        triggerSyncRef.current()
        toast.success('Povezava vzpostavljena', {
          description: 'Sinhronizacija podatkov je v teku...',
          duration: 3000,
        })
      } else if (!online) {
        toast.warning('Brez povezave', {
          description: 'Nekatere funkcije so omejene. Podatki bodo shranjeni lokalno.',
          duration: 5000,
        })
      }
    }

    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Request SW queue status periodically
  useEffect(() => {
    if (!isOnline) return
    const interval = setInterval(() => {
      navigator.serviceWorker.controller?.postMessage({ type: 'GET_QUEUE_STATUS' })
    }, 10000)
    return () => clearInterval(interval)
  }, [isOnline])

  return (
    <>
      {/* Offline indicator bar */}
      {showOfflineBar && (
        <div className="fixed top-12 left-0 right-0 z-[1501] bg-orange-600/90 backdrop-blur-sm text-white px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium">
          <WifiOff className="size-3" />
          <span>Brez povezave — delate v načinu brez povezave</span>
          {swQueueLength > 0 && (
            <span className="ml-1 bg-white/20 rounded-full px-2 py-0.5 text-[10px]">
              {swQueueLength} v čakalni vrsti
            </span>
          )}
        </div>
      )}

      {/* Update available banner */}
      {updateAvailable && (
        <div className="fixed bottom-24 left-4 right-4 z-[1600] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-card border border-border rounded-2xl p-3 shadow-xl max-w-md mx-auto flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="size-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">Nova različica na voljo</p>
              <p className="text-[10px] text-muted-foreground">Osvežite za najnovejše funkcije in popravke</p>
            </div>
            <Button
              size="sm"
              className="text-xs gap-1 h-7 rounded-full shrink-0"
              onClick={() => activateNewWorker()}
            >
              <RefreshCw className="size-3" />
              Osveži
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
