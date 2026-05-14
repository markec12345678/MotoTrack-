'use client'

import React, { useState, useCallback } from 'react'
import { Share2, X, Download, Loader2, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface RideShareCardProps {
  open: boolean
  onClose: () => void
  rideTitle: string
  distance: number
  duration: number
  maxSpeed: number
  avgSpeed: number
  elevation: number
  category?: string
}

export default function RideShareCard({
  open, onClose, rideTitle, distance, duration, maxSpeed, avgSpeed, elevation, category,
}: RideShareCardProps) {
  const [generating, setGenerating] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)

  const generateCard = useCallback(async () => {
    setGenerating(true)
    setImageBase64(null)
    try {
      const res = await fetch('/api/ride-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideTitle,
          distance,
          duration,
          maxSpeed,
          avgSpeed,
          elevation,
          category,
        }),
      })

      const data = await res.json()
      if (data.success && data.imageBase64) {
        setImageBase64(data.imageBase64)
      } else {
        toast.error(data.error || 'Napaka pri generiranju kartice')
      }
    } catch {
      toast.error('Napaka pri povezavi')
    } finally {
      setGenerating(false)
    }
  }, [rideTitle, distance, duration, maxSpeed, avgSpeed, elevation, category])

  const downloadImage = useCallback(() => {
    if (!imageBase64) return
    const link = document.createElement('a')
    link.href = `data:image/png;base64,${imageBase64}`
    link.download = `mototrack-${rideTitle.replace(/\s+/g, '-').toLowerCase()}.png`
    link.click()
    toast.success('Kartica shranjena!')
  }, [imageBase64, rideTitle])

  const shareImage = useCallback(async () => {
    if (!imageBase64) return
    try {
      const blob = await (await fetch(`data:image/png;base64,${imageBase64}`)).blob()
      const file = new File([blob], `mototrack-${rideTitle.replace(/\s+/g, '-')}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `MotoTrack — ${rideTitle}`,
          text: `${distance.toFixed(1)} km · ${Math.floor(duration / 60)}h ${duration % 60}m · Max ${maxSpeed} km/h`,
          files: [file],
        })
      } else {
        await navigator.clipboard.writeText(`🏍️ ${rideTitle} — ${distance.toFixed(1)} km · ${Math.floor(duration / 60)}h ${duration % 60}m · Max ${maxSpeed} km/h · ${elevation}m`)
        toast.success('Kopirano za deljenje!')
      }
    } catch {
      toast.error('Napaka pri deljenju')
    }
  }, [imageBase64, rideTitle, distance, duration, maxSpeed, elevation])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-4 text-primary" />
            Deli kartico vožnje
          </DialogTitle>
          <DialogDescription>
            Generiraj AI kartico za deljenje na socialnih omrežjih
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          {imageBase64 ? (
            <div className="rounded-xl overflow-hidden border border-border/50">
              <img
                src={`data:image/png;base64,${imageBase64}`}
                alt={`Kartica vožnje: ${rideTitle}`}
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-primary/10 via-card to-card border border-border/30 flex flex-col items-center justify-center gap-2">
              {generating ? (
                <>
                  <Loader2 className="size-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Generiram kartico z AI...</p>
                </>
              ) : (
                <>
                  <ImageIcon className="size-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Klikni za generiranje kartice</p>
                </>
              )}
            </div>
          )}

          {/* Ride stats summary */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-secondary/50 p-2">
              <p className="text-xs font-bold">{distance.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">km</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <p className="text-xs font-bold">{Math.floor(duration / 60)}h {duration % 60}m</p>
              <p className="text-[10px] text-muted-foreground">čas</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <p className="text-xs font-bold">{maxSpeed}</p>
              <p className="text-[10px] text-muted-foreground">max km/h</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <p className="text-xs font-bold">{elevation}</p>
              <p className="text-[10px] text-muted-foreground">viš. m</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!imageBase64 ? (
              <Button
                onClick={generateCard}
                disabled={generating}
                className="flex-1 gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generiram...
                  </>
                ) : (
                  <>
                    <ImageIcon className="size-4" />
                    Generiraj kartico
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  onClick={shareImage}
                  className="flex-1 gap-2"
                >
                  <Share2 className="size-4" />
                  Deli
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadImage}
                  className="gap-2"
                >
                  <Download className="size-4" />
                  Shrani
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setImageBase64(null); generateCard() }}
                  disabled={generating}
                  className="gap-2"
                >
                  <ImageIcon className="size-4" />
                  Nova
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
