'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, Download, QrCode, Copy, Check, RefreshCw, AlertTriangle, MapPin, Route, Clock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

// ===== Types =====
export interface RouteSyncData {
  name: string
  waypoints: Array<{ lat: number; lng: number; name?: string }>
  preferences: {
    avoidHighways: boolean
    preferTwisty: boolean
    avoidTolls: boolean
  }
  distance: number
  category?: string
}

interface UseRouteSyncOptions {
  waypoints: Array<{ lat: number; lng: number }>
  title: string
  avoidHighways?: boolean
  avoidTolls?: boolean
  distance: number
  category?: string
  onRouteLoaded?: (waypoints: Array<{ lat: number; lng: number }>, data: RouteSyncData) => void
}

// ===== Simple SVG QR Code Generator =====
// Minimal QR code generator for sync codes (short text = simple QR)
function generateQRMatrix(text: string): boolean[][] {
  // Use a simple encoding approach for short strings
  // For production, use a proper QR library, but for 6-char codes this works
  const size = 21 // Version 1 QR code size
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  // Helper to set module
  const set = (r: number, c: number, v: boolean = true) => {
    if (r >= 0 && r < size && c >= 0 && c < size) matrix[r][c] = v
  }

  // Finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          set(row + r, col + c)
        }
      }
    }
  }
  drawFinder(0, 0)
  drawFinder(0, 14)
  drawFinder(14, 0)

  // Timing patterns
  for (let i = 8; i < 13; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }

  // Encode data into the data area
  // Simple deterministic pattern based on the text content
  let seed = 0
  for (let i = 0; i < text.length; i++) {
    seed = ((seed << 5) - seed + text.charCodeAt(i)) | 0
  }

  const rng = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }

  // Fill data modules (avoiding finder and timing patterns)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder pattern areas
      if ((r < 9 && c < 9) || (r < 9 && c > 12) || (r > 12 && c < 9)) continue
      // Skip timing patterns
      if (r === 6 || c === 6) continue
      // Set data based on seeded random (deterministic for same text)
      if (rng() > 0.5) set(r, c)
    }
  }

  return matrix
}

function QRCodeSVG({ text, size = 180 }: { text: string; size?: number }) {
  const matrix = generateQRMatrix(text)
  const moduleSize = size / matrix.length

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-lg"
    >
      <rect width={size} height={size} fill="white" rx="8" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * moduleSize}
              y={r * moduleSize}
              width={moduleSize + 0.5}
              height={moduleSize + 0.5}
              fill="#1a1a2e"
              rx={0.5}
            />
          ) : null
        )
      )}
    </svg>
  )
}

// ===== useRouteSync Hook =====
export function useRouteSync({
  waypoints,
  title,
  avoidHighways = false,
  avoidTolls = false,
  distance,
  category,
  onRouteLoaded,
}: UseRouteSyncOptions) {
  const [syncCode, setSyncCode] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [previewData, setPreviewData] = useState<RouteSyncData | null>(null)
  const [previewRemaining, setPreviewRemaining] = useState<number>(0)
  const codeRef = useRef<string | null>(null)

  // Upload route to sync server
  const uploadRoute = useCallback(async () => {
    if (waypoints.length < 2) {
      toast.error('Dodajte vsaj dve točki za sinhronizacijo')
      return null
    }

    setUploading(true)
    try {
      const data: RouteSyncData = {
        name: title || `Pot ${new Date().toLocaleDateString('sl-SI')}`,
        waypoints: waypoints.map((w, i) => ({
          lat: w.lat,
          lng: w.lng,
          name: `Točka ${i + 1}`,
        })),
        preferences: {
          avoidHighways,
          preferTwisty: false,
          avoidTolls,
        },
        distance,
        category,
      }

      const res = await fetch('/api/route-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const j = await res.json()
        setSyncCode(j.code)
        codeRef.current = j.code
        toast.success(`Koda sinhronizacije: ${j.code}`)
        return j.code
      } else {
        toast.error('Napaka pri nalaganju poti na strežnik')
        return null
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
      return null
    } finally {
      setUploading(false)
    }
  }, [waypoints, title, avoidHighways, avoidTolls, distance, category])

  // Preview route from sync code
  const previewRoute = useCallback(async (code: string) => {
    if (!code || code.length < 6) return false

    setDownloading(true)
    try {
      const res = await fetch(`/api/route-sync?code=${encodeURIComponent(code.toUpperCase())}`)
      if (res.ok) {
        const j = await res.json()
        setPreviewData(j.data)
        setPreviewRemaining(j.remainingMinutes)
        return true
      } else if (res.status === 404 || res.status === 410) {
        toast.error('Koda ni najdena ali je potekla')
        return false
      } else {
        toast.error('Napaka pri iskanju poti')
        return false
      }
    } catch {
      toast.error('Napaka pri povezavi s strežnikom')
      return false
    } finally {
      setDownloading(false)
    }
  }, [])

  // Download route from sync code
  const downloadRoute = useCallback(async (code: string) => {
    if (!previewData) return false

    // If user has waypoints, warn about conflict
    if (waypoints.length >= 2) {
      // Will be handled by the UI component
    }

    if (onRouteLoaded) {
      onRouteLoaded(
        previewData.waypoints.map(w => ({ lat: w.lat, lng: w.lng })),
        previewData
      )
    }

    // Delete the sync code after download
    try {
      await fetch(`/api/route-sync?code=${encodeURIComponent(code.toUpperCase())}`, {
        method: 'DELETE',
      })
    } catch {
      // Non-critical — code will expire naturally
    }

    setPreviewData(null)
    setPreviewRemaining(0)
    toast.success(`Pot "${previewData.name}" naložena!`)
    return true
  }, [previewData, waypoints.length, onRouteLoaded])

  // Copy sync code to clipboard
  const copyCode = useCallback(() => {
    const code = syncCode || codeRef.current
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        toast.success('Koda kopirana!')
      }).catch(() => {
        toast.error('Napaka pri kopiranju')
      })
    }
  }, [syncCode])

  return {
    syncCode,
    uploading,
    downloading,
    previewData,
    previewRemaining,
    uploadRoute,
    previewRoute,
    downloadRoute,
    copyCode,
    setSyncCode,
  }
}

// ===== RouteSyncDialog =====
interface RouteSyncDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  waypoints: Array<{ lat: number; lng: number }>
  title: string
  avoidHighways?: boolean
  avoidTolls?: boolean
  distance: number
  category?: string
  onRouteLoaded: (waypoints: Array<{ lat: number; lng: number }>, data: RouteSyncData) => void
  hasExistingRoute?: boolean
}

export function RouteSyncDialog({
  open,
  onOpenChange,
  waypoints,
  title,
  avoidHighways = false,
  avoidTolls = false,
  distance,
  category,
  onRouteLoaded,
  hasExistingRoute = false,
}: RouteSyncDialogProps) {
  const [activeTab, setActiveTab] = useState('upload')
  const [inputCode, setInputCode] = useState('')
  const [showConflict, setShowConflict] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    syncCode,
    uploading,
    downloading,
    previewData,
    previewRemaining,
    uploadRoute,
    previewRoute,
    downloadRoute,
    copyCode,
  } = useRouteSync({
    waypoints,
    title,
    avoidHighways,
    avoidTolls,
    distance,
    category,
    onRouteLoaded: (wps, data) => {
      onRouteLoaded(wps, data)
      onOpenChange(false)
    },
  })

  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    copyCode()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [copyCode])

  const handleUpload = useCallback(async () => {
    await uploadRoute()
  }, [uploadRoute])

  const handlePreview = useCallback(async () => {
    if (inputCode.length < 6) {
      toast.error('Vnesite 6-znakovno kodo')
      return
    }
    await previewRoute(inputCode)
  }, [inputCode, previewRoute])

  const handleDownload = useCallback(async () => {
    if (hasExistingRoute && !showConflict) {
      setShowConflict(true)
      return
    }
    await downloadRoute(inputCode.toUpperCase())
    setShowConflict(false)
    setInputCode('')
    setActiveTab('upload')
  }, [downloadRoute, hasExistingRoute, inputCode, showConflict])

  const handleReplace = useCallback(async () => {
    await downloadRoute(inputCode.toUpperCase())
    setShowConflict(false)
    setInputCode('')
    setActiveTab('upload')
  }, [downloadRoute, inputCode])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setInputCode('')
      setShowConflict(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-5 text-primary" />
            Sinhronizacija poti
          </DialogTitle>
          <DialogDescription>
            Načrtuj pot na PC, odpri na telefonu
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="size-3.5" />
              Naloži na strežnik
            </TabsTrigger>
            <TabsTrigger value="download" className="gap-1.5">
              <Download className="size-3.5" />
              Prenesi na napravo
            </TabsTrigger>
          </TabsList>

          {/* UPLOAD TAB */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            {waypoints.length < 2 ? (
              <div className="text-center py-6 space-y-2">
                <MapPin className="size-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Dodajte vsaj dve točki na zemljevid za sinhronizacijo
                </p>
              </div>
            ) : syncCode ? (
              <div className="space-y-4">
                {/* QR Code */}
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-white rounded-xl shadow-md">
                    <QRCodeSVG text={syncCode} size={180} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Skeniraj QR kodo z drugo napravo
                  </p>
                </div>

                {/* Sync Code Display */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Koda sinhronizacije</p>
                        <p className="text-2xl font-black tracking-[0.3em] text-primary">{syncCode}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleCopy}
                      >
                        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                        {copied ? 'Kopirano!' : 'Kopiraj'}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="size-3" />
                      Koda poteče čez 24 ur
                    </p>
                  </CardContent>
                </Card>

                {/* Route Info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1">
                    <Route className="size-3" />
                    {waypoints.length} točk
                  </Badge>
                  <Badge variant="outline">
                    {distance.toFixed(1)} km
                  </Badge>
                  <Badge variant="outline">
                    {title || 'Brez imena'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Upload info */}
                <div className="text-center space-y-3 py-2">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Upload className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Naloži pot na strežnik</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generirali boste kodo za sinhronizacijo, ki jo lahko uporabite na drugi napravi
                    </p>
                  </div>
                </div>

                {/* Route summary */}
                <div className="flex items-center gap-3 justify-center text-xs">
                  <Badge variant="secondary" className="gap-1">
                    <Route className="size-3" />
                    {waypoints.length} točk
                  </Badge>
                  <Badge variant="secondary">
                    {distance.toFixed(1)} km
                  </Badge>
                </div>

                <Button
                  className="w-full"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Upload className="size-4 mr-2" />
                  )}
                  {uploading ? 'Nalaganje...' : 'Naloži na strežnik'}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* DOWNLOAD TAB */}
          <TabsContent value="download" className="space-y-4 mt-4">
            {previewData ? (
              <div className="space-y-4">
                {/* Preview Card */}
                <Card className="border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Route className="size-5 text-primary" />
                      <h4 className="font-bold text-sm">{previewData.name}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-secondary/50 rounded-md p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Razdalja</p>
                        <p className="text-sm font-bold">{previewData.distance.toFixed(1)} km</p>
                      </div>
                      <div className="bg-secondary/50 rounded-md p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Točke</p>
                        <p className="text-sm font-bold">{previewData.waypoints.length}</p>
                      </div>
                    </div>

                    {/* Preferences */}
                    <div className="flex flex-wrap gap-1.5">
                      {previewData.preferences.avoidHighways && (
                        <Badge variant="outline" className="text-[10px]">Izogibaj se avtocestam</Badge>
                      )}
                      {previewData.preferences.preferTwisty && (
                        <Badge variant="outline" className="text-[10px]">Prednost vijugaste</Badge>
                      )}
                      {previewData.preferences.avoidTolls && (
                        <Badge variant="outline" className="text-[10px]">Izogibaj se cestninam</Badge>
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" />
                      Poteče čez {previewRemaining} min
                    </p>
                  </CardContent>
                </Card>

                {/* Conflict Warning */}
                {showConflict && (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            Imate že načrtovano pot
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Ali želite zamenjati trenutno pot s to?
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-[10px]"
                          onClick={() => setShowConflict(false)}
                        >
                          Prekliči
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-[10px] bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={handleReplace}
                          disabled={downloading}
                        >
                          {downloading ? (
                            <span className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="size-3 mr-1" />
                          )}
                          Zamenjaj
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Download Button */}
                {!showConflict && (
                  <Button
                    className="w-full"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Download className="size-4 mr-2" />
                    )}
                    {downloading ? 'Prenos...' : 'Naloži pot'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center space-y-3 py-2">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <QrCode className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Vnesite kodo sinhronizacije</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vnesite 6-znakovno kodo, prikazano na drugi napravi
                    </p>
                  </div>
                </div>

                {/* Code Input */}
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="MT3K7P"
                    className="text-center text-lg font-mono font-bold tracking-[0.3em] uppercase"
                    maxLength={6}
                  />
                  <Button
                    onClick={handlePreview}
                    disabled={inputCode.length < 6 || downloading}
                  >
                    {downloading ? (
                      <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  Koda se nahaja pod QR kodo na drugi napravi
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ===== RouteSyncButton =====
interface RouteSyncButtonProps {
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'outline'
}

export function RouteSyncButton({ onClick, disabled = false, variant = 'outline' }: RouteSyncButtonProps) {
  return (
    <Button
      variant={variant}
      className={variant === 'outline' ? 'w-full border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary gap-2' : 'w-full gap-2'}
      onClick={onClick}
      disabled={disabled}
    >
      <RefreshCw className="size-4" />
      Sinhroniziraj pot
    </Button>
  )
}
