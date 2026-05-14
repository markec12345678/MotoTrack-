'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Navigation2, Volume2, VolumeX, Play, Pause, SkipForward, RotateCcw,
  Wifi, WifiOff, Download, Trash2, HardDrive,
  GitBranch, RefreshCw, Gauge,
  Radio, MapPin, AlertTriangle, Clock,
  Fuel, Star, ArrowUpDown, Phone,
  Smartphone, Bluetooth, Battery, Signal,
  Upload, FileText, Share2,
  Trophy, Target, Flame, Award,
  Cpu, Activity, Thermometer, Zap, Settings,
  CarFront, AlertCircle, Filter,
  Palette, Map, Satellite, Mountain,
  Wrench, Building2, ChevronRight,
  X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { RideData } from '@/components/tabs/types'

const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

// ==================== FEATURE 1: VOICE NAVIGATION ====================
export function VoiceNavigation({ routeId, waypoints, userId }: { routeId?: string; waypoints: { lat: number; lng: number }[]; userId?: string }) {
  const [navigating, setNavigating] = useState(false)
  const [steps, setSteps] = useState<any[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  const startNavigation = async () => {
    if (waypoints.length < 2) { toast.error('Dodajte vsaj dve točki'); return }
    setLoading(true)
    try {
      const start = waypoints[0]
      const end = waypoints[waypoints.length - 1]
      const midWp = waypoints.slice(1, -1)
      const params = new URLSearchParams({
        startLat: String(start.lat), startLng: String(start.lng),
        endLat: String(end.lat), endLng: String(end.lng),
        ...(midWp.length > 0 ? { waypoints: JSON.stringify(midWp) } : {}),
      })
      const res = await fetch(`/api/navigation?${params}`)
      const j = await res.json()
      if (j.data?.steps) {
        setSteps(j.data.steps)
        setCurrentStep(0)
        setNavigating(true)
        speak(j.data.steps[0]?.instruction || 'Krenite')
        toast.success('Navigacija začeta!')
      } else {
        toast.error('Ni mogoče najti poti')
      }
    } catch { toast.error('Napaka pri navigaciji') }
    setLoading(false)
  }

  const speak = (text: string) => {
    if (!voiceEnabled || !synthRef.current) return
    synthRef.current.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'sl-SI'
    utter.rate = 0.9
    const voices = synthRef.current.getVoices()
    const slVoice = voices.find(v => v.lang.startsWith('sl'))
    if (slVoice) utter.voice = slVoice
    synthRef.current.speak(utter)
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1
      setCurrentStep(next)
      speak(steps[next].instruction)
    }
  }

  const stopNavigation = () => {
    setNavigating(false)
    setSteps([])
    setCurrentStep(0)
    if (synthRef.current) synthRef.current.cancel()
  }

  if (!navigating) {
    return (
      <Button variant="outline" className="gap-2 text-xs" onClick={startNavigation} disabled={loading || waypoints.length < 2}>
        <Navigation2 className="size-4" /> {loading ? 'Nalagam...' : 'Navigiraj'}
      </Button>
    )
  }

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 className="size-4 text-primary animate-pulse" />
          <span className="text-xs font-bold text-primary">NAVIGACIJA</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setVoiceEnabled(!voiceEnabled)} className="p-1 rounded hover:bg-muted">
            {voiceEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5 text-muted-foreground" />}
          </button>
          <button onClick={stopNavigation} className="p-1 rounded hover:bg-destructive/20 text-destructive">
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {steps[currentStep] && (
        <div className="bg-background rounded-lg p-2.5">
          <p className="text-sm font-medium">{steps[currentStep].instruction}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{steps[currentStep].distance > 1000 ? `${(steps[currentStep].distance / 1000).toFixed(1)} km` : `${steps[currentStep].distance} m`}</span>
            <span>Korak {currentStep + 1}/{steps.length}</span>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs gap-1" onClick={nextStep} disabled={currentStep >= steps.length - 1}>
          <SkipForward className="size-3" /> Naslednji korak
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => speak(steps[currentStep]?.instruction || '')}>
          <Volume2 className="size-3" /> Ponovi
        </Button>
      </div>
      <Progress value={((currentStep + 1) / steps.length) * 100} className="h-1.5" />
    </div>
  )
}

// ==================== FEATURE 2: OFFLINE MAPS ====================
export function OfflineMapsPanel({ onClose }: { onClose: () => void }) {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [savedRegions, setSavedRegions] = useState<Array<{ id: string; name: string; size: string; zoom: number }>>(() => {
    try {
      if (typeof window === 'undefined') return []
      const saved = localStorage.getItem('mototrack_offline_maps')
      if (saved) { const parsed = JSON.parse(saved); if (parsed) return parsed }
    } catch { /* ignore */ }
    return []
  })

  const downloadRegion = () => {
    setDownloading(true)
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          setDownloading(false)
          const newRegion = { id: `region_${Date.now()}`, name: `Slovenija ${savedRegions.length + 1}`, size: '~45 MB', zoom: 14 }
          const updated = [...savedRegions, newRegion]
          setSavedRegions(updated)
          try { localStorage.setItem('mototrack_offline_maps', JSON.stringify(updated)) } catch { /* ignore */ }
          toast.success('Karta prenesena!')
          return 0
        }
        return p + Math.random() * 15
      })
    }, 300)
  }

  const deleteRegion = (id: string) => {
    const updated = savedRegions.filter(r => r.id !== id)
    setSavedRegions(updated)
    try { localStorage.setItem('mototrack_offline_maps', JSON.stringify(updated)) } catch { /* ignore */ }
    toast.success('Regija izbrisana')
  }

  return (
    <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <WifiOff className="size-4 text-primary" />
          <span className="text-sm font-bold">Karte brez povezave</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted"><X className="size-3.5 text-muted-foreground" /></button>
      </div>

      {downloading && (
        <div className="mb-3 space-y-1">
          <div className="flex justify-between text-xs"><span>Prenašam...</span><span>{Math.round(progress)}%</span></div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <Button className="w-full mb-3 gap-2" onClick={downloadRegion} disabled={downloading}>
        <Download className="size-4" /> {downloading ? 'Prenašam...' : 'Prenesi regijo (Slovenija)'}
      </Button>

      {savedRegions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Shranjene regije</p>
          {savedRegions.map(r => (
            <div key={r.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <HardDrive className="size-3 text-muted-foreground" />
                <div><p className="font-medium">{r.name}</p><p className="text-muted-foreground">{r.size} · Zoom {r.zoom}</p></div>
              </div>
              <button onClick={() => deleteRegion(r.id)} className="p-1 rounded hover:bg-destructive/20 text-destructive"><Trash2 className="size-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== FEATURE 3: TWISTY ROUTE GENERATOR ====================
export function TwistyRouteGenerator({ userId, onSave }: { userId?: string; onSave?: (waypoints: { lat: number; lng: number }[]) => void }) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ waypoints: { lat: number; lng: number }[]; distance: number; corners: number; twistinessScore: number } | null>(null)
  const [distance, setDistance] = useState('medium')
  const [difficulty, setDifficulty] = useState('medium')

  const generate = async () => {
    setGenerating(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      ).catch(() => ({ coords: { latitude: 46.15, longitude: 14.99 } }))

      const res = await fetch(`/api/twisty-route?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&distance=${distance}&difficulty=${difficulty}`)
      const j = await res.json()
      if (j.data) {
        setResult(j.data)
        toast.success(`Vijugasta pot: ${j.data.distance} km, ${j.data.corners} ovinkov`)
      }
    } catch { toast.error('Napaka pri generiranju') }
    setGenerating(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><GitBranch className="size-5 text-amber-500" /><h3 className="font-bold">Vijugasta pot</h3></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Razdalja</Label>
          <Select value={distance} onValueChange={setDistance}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Kratka (&lt;50km)</SelectItem>
              <SelectItem value="medium">Srednja (50-150km)</SelectItem>
              <SelectItem value="long">Dolga (150+km)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Zahtevnost</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Lahko</SelectItem>
              <SelectItem value="medium">Srednje</SelectItem>
              <SelectItem value="hard">Težko</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button className="w-full gap-2" onClick={generate} disabled={generating}>
        <RefreshCw className={`size-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? 'Generiram...' : 'Generiraj vijugasto pot'}
      </Button>
      {result && (
        <div className="bg-amber-500/10 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-bold text-amber-500">{result.distance}</p><p className="text-[10px] text-muted-foreground">km</p></div>
            <div><p className="text-lg font-bold text-amber-500">{result.corners}</p><p className="text-[10px] text-muted-foreground">ovinkov</p></div>
            <div><p className="text-lg font-bold text-amber-500">{result.twistinessScore}</p><p className="text-[10px] text-muted-foreground">vinjenost</p></div>
          </div>
          {onSave && <Button size="sm" className="w-full gap-1" onClick={() => onSave(result.waypoints)}><MapPin className="size-3" /> Shrani kot pot</Button>}
        </div>
      )}
    </div>
  )
}

// ==================== FEATURE 5: CRASH DETECTION ====================
export function CrashDetection({ userId }: { userId?: string }) {
  const [enabled, setEnabled] = useState(false)
  const [crashDetected, setCrashDetected] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [cancelled, setCancelled] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) return
    // Listen for high acceleration via DeviceMotion
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (!acc) return
      const total = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2)
      if (total > 2.5 * 9.81) { // 2.5g threshold
        // Trigger crash detection
        setCrashDetected(true)
        setCountdown(30)
        toast.error('⚠️ Zaznan padec! SOS čez 30s...')
        timerRef.current = setInterval(() => {
          setCountdown(p => p <= 1 ? 0 : p - 1)
        }, 1000)
      }
    }
    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [enabled])

  // Auto-send SOS when countdown reaches 0
  useEffect(() => {
    if (crashDetected && countdown === 0 && !cancelled) {
      // Send SOS
      const sendAutoSOS = async () => {
        if (!userId) return
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          ).catch(() => null)
          await fetch('/api/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, lat: pos?.coords.latitude || 46.15, lng: pos?.coords.longitude || 14.99, type: 'crash_detected' }),
          })
          toast.success('SOS poslan!')
        } catch { toast.error('Napaka pri pošiljanju SOS') }
      }
      sendAutoSOS()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [crashDetected, countdown, cancelled, userId])

  const cancelSOS = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCrashDetected(false)
    setCancelled(true)
    toast.success('SOS preklican')
    setTimeout(() => setCancelled(false), 3000)
  }

  // cancelSOS and sendSOS are used in callbacks, not effects

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-500" />
          <span className="text-xs font-medium">Zaznavanje padca</span>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {crashDetected && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-center animate-pulse">
          <AlertTriangle className="size-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-red-500">ZAZNAN PAD!</p>
          <p className="text-2xl font-mono font-bold text-red-500 mt-1">{countdown}s</p>
          <p className="text-xs text-muted-foreground mb-2">SOS bo poslan avtomatsko</p>
          <Button variant="outline" className="gap-1" onClick={cancelSOS}>
            <X className="size-4" /> Prekliči SOS
          </Button>
        </div>
      )}
      {cancelled && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
          <p className="text-xs text-green-500 font-medium">SOS preklican - vse je v redu</p>
        </div>
      )}
    </div>
  )
}

// ==================== FEATURE 6: RIDE ANIMATION (REWIND) ====================
export function RideAnimation({ rideId }: { rideId: string }) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentPoint, setCurrentPoint] = useState(0)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const animRef = useRef<number | null>(null)

  const loadAnimation = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ride-animation?rideId=${rideId}`)
      const j = await res.json()
      if (j.data) setData(j.data)
    } catch { toast.error('Napaka pri nalaganju animacije') }
    setLoading(false)
  }

  useEffect(() => {
    if (playing && data) {
      const interval = 1000 / (speed * 10)
      animRef.current = window.setInterval(() => {
        setCurrentPoint(p => {
          if (p >= data.totalPoints - 1) {
            setPlaying(false)
            if (animRef.current) clearInterval(animRef.current)
            return p
          }
          return p + 1
        })
      }, interval)
      return () => { if (animRef.current) clearInterval(animRef.current) }
    }
  }, [playing, speed, data])

  if (!data && !loading) {
    return <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={loadAnimation}><Play className="size-3" /> Predvajaj vožnjo</Button>
  }

  if (loading) return <p className="text-xs text-muted-foreground">Nalagam animacijo...</p>
  if (!data) return null

  const point = data.trackPoints[currentPoint]

  return (
    <div className="bg-primary/10 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-primary" />
          <span className="text-xs font-bold">REWIND</span>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 4, 8].map(s => (
            <button key={s} onClick={() => setSpeed(s)} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${speed === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{s}x</button>
          ))}
        </div>
      </div>
      {point && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-sm font-bold">{point.speed || 0} km/h</p><p className="text-[10px] text-muted-foreground">Hitrost</p></div>
          <div><p className="text-sm font-bold">{Math.round(point.alt || 0)} m</p><p className="text-[10px] text-muted-foreground">Višina</p></div>
          <div><p className="text-sm font-bold">{currentPoint}/{data.totalPoints}</p><p className="text-[10px] text-muted-foreground">Točka</p></div>
        </div>
      )}
      <input type="range" min={0} max={data.totalPoints - 1} value={currentPoint} onChange={e => setCurrentPoint(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-muted" />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 gap-1 text-xs" onClick={() => { setPlaying(!playing); if (currentPoint >= data.totalPoints - 1) setCurrentPoint(0) }}>
          {playing ? <Pause className="size-3" /> : <Play className="size-3" />} {playing ? 'Premor' : 'Predvajaj'}
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setCurrentPoint(0); setPlaying(false) }}>
          <RotateCcw className="size-3" /> Na začetek
        </Button>
      </div>
    </div>
  )
}

// ==================== FEATURE 7: CHEAP FUEL FINDER ====================
export function FuelFinder({ userId }: { userId?: string }) {
  const [stations, setStations] = useState<any[]>([])
  const [fuelType, setFuelType] = useState('95')
  const [loading, setLoading] = useState(false)

  const fetchStations = async () => {
    setLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      ).catch(() => ({ coords: { latitude: 46.15, longitude: 14.99 } }))
      const res = await fetch(`/api/fuel-prices?fuelType=${fuelType}&lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
      const j = await res.json()
      if (j.data) setStations(j.data)
    } catch { toast.error('Napaka') }
    setLoading(false)
  }

  useEffect(() => {
    const doFetch = async () => { await fetchStations() }
    doFetch()
  }, [fuelType, fetchStations])

  const priceColor = (price: number, min: number, max: number) => {
    if (max === min) return 'text-green-500'
    const ratio = (price - min) / (max - min)
    if (ratio < 0.33) return 'text-green-500'
    if (ratio < 0.66) return 'text-amber-500'
    return 'text-red-500'
  }

  const minPrice = stations.length > 0 ? Math.min(...stations.map(s => s.price)) : 0
  const maxPrice = stations.length > 0 ? Math.max(...stations.map(s => s.price)) : 1

  return (
    <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-80 max-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Fuel className="size-4 text-orange-500" /><span className="text-sm font-bold">Ceneno gorivo</span></div>
      </div>
      <div className="flex gap-1 mb-3">
        {['95', '98', 'diesel'].map(t => (
          <button key={t} onClick={() => setFuelType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${fuelType === t ? 'bg-orange-500 text-white' : 'bg-secondary text-muted-foreground'}`}>
            {t === 'diesel' ? 'Dizel' : t}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1 max-h-60">
        <div className="space-y-1.5">
          {stations.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${i === 0 ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}`}>#{i + 1}</Badge>
                  <p className="text-xs font-medium truncate">{s.name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground ml-7">{s.brand} · {s.distance} km</p>
              </div>
              <span className={`text-sm font-bold ${priceColor(s.price, minPrice, maxPrice)}`}>{s.price.toFixed(2)} €</span>
            </div>
          ))}
          {stations.length === 0 && !loading && <p className="text-xs text-muted-foreground text-center py-4">Nalagam...</p>}
        </div>
      </ScrollArea>
    </div>
  )
}

// ==================== FEATURE 8: LEAN ANGLE DISPLAY ====================
export function LeanAngleDisplay() {
  const [angle, setAngle] = useState(0)
  const [maxLeft, setMaxLeft] = useState(0)
  const [maxRight, setMaxRight] = useState(0)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        const lean = Math.round(e.gamma)
        setAngle(lean)
        if (lean < 0) setMaxLeft(prev => Math.min(prev, lean))
        if (lean > 0) setMaxRight(prev => Math.max(prev, lean))
      }
    }
    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation)
    } else {
      // DeviceOrientation not supported
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [])

  const getColor = (a: number) => {
    const abs = Math.abs(a)
    if (abs < 20) return '#22c55e'
    if (abs < 35) return '#eab308'
    if (abs < 45) return '#f97316'
    return '#ef4444'
  }

  if (!supported) return null

  return (
    <div className="flex items-center gap-3">
      {/* Gauge visualization */}
      <div className="relative w-16 h-8 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-16 rounded-t-full border-2 border-muted" style={{ background: `conic-gradient(${getColor(angle)} ${50 + angle}%, transparent ${50 + angle}%)`, transformOrigin: 'center bottom' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-8 bg-foreground origin-bottom transition-transform" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <div className="text-xs">
        <p className="font-bold text-sm" style={{ color: getColor(angle) }}>{angle}°</p>
        <p className="text-muted-foreground">⬅ {Math.abs(maxLeft)}° | {maxRight}° ➡</p>
      </div>
    </div>
  )
}

// ==================== FEATURE 9: ROUND TRIP GENERATOR ====================
export function RoundTripGenerator({ userId, onSave }: { userId?: string; onSave?: (waypoints: { lat: number; lng: number }[]) => void }) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ waypoints: { lat: number; lng: number }[]; distance: number } | null>(null)
  const [radius, setRadius] = useState(30)
  const [direction, setDirection] = useState('clockwise')

  const generate = async () => {
    setGenerating(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      ).catch(() => ({ coords: { latitude: 46.15, longitude: 14.99 } }))
      const res = await fetch(`/api/round-trip?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radius=${radius}&direction=${direction}`)
      const j = await res.json()
      if (j.data) {
        setResult(j.data)
        toast.success(`Krožna pot: ${j.data.distance} km`)
      }
    } catch { toast.error('Napaka') }
    setGenerating(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><RefreshCw className="size-5 text-primary" /><h3 className="font-bold">Krožna pot</h3></div>
      <div>
        <Label className="text-xs">Polmer: {radius} km</Label>
        <input type="range" min={10} max={200} value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-muted" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => setDirection('clockwise')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${direction === 'clockwise' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          ↻ V smeri urinega kazalca
        </button>
        <button onClick={() => setDirection('counterclockwise')} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${direction === 'counterclockwise' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          ↺ Proti urinemu kazalcu
        </button>
      </div>
      <Button className="w-full gap-2" onClick={generate} disabled={generating}>
        <RefreshCw className={`size-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? 'Generiram...' : 'Generiraj krožno pot'}
      </Button>
      {result && (
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-center text-lg font-bold text-primary">{result.distance} km</p>
          <p className="text-center text-xs text-muted-foreground">Ocenjeni čas: ~{Math.round(result.distance / 50 * 60)} min</p>
          {onSave && <Button size="sm" className="w-full mt-2 gap-1" onClick={() => onSave(result.waypoints)}><MapPin className="size-3" /> Shrani kot pot</Button>}
        </div>
      )}
    </div>
  )
}

// ==================== FEATURE 10: BLUETOOTH HELMET ====================
export function BluetoothHelmetPanel() {
  const [scanning, setScanning] = useState(false)
  const [devices, setDevices] = useState<Array<{ id: string; name: string; type: string; battery: number }>>([])
  const [connected, setConnected] = useState<{ deviceId: string; name: string; battery: number; volume: number } | null>(null)
  const [volume, setVolume] = useState(70)

  const scan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/bluetooth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) })
      const j = await res.json()
      if (j.data) setDevices(j.data)
    } catch { toast.error('Napaka pri iskanju') }
    setScanning(false)
  }

  const connect = async (deviceId: string, name: string) => {
    try {
      const res = await fetch('/api/bluetooth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', deviceId }) })
      const j = await res.json()
      if (j.data?.connected) {
        setConnected({ deviceId, name, battery: j.data.battery || 80, volume: j.data.volume || 70 })
        toast.success(`Povezano z ${name}`)
      }
    } catch { toast.error('Napaka pri povezovanju') }
  }

  const disconnect = async () => {
    await fetch('/api/bluetooth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) })
    setConnected(null)
    toast.success('Povezava prekinjena')
  }

  return (
    <div className="absolute bottom-20 left-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-lg p-4 w-72">
      <div className="flex items-center gap-2 mb-3">
        <Bluetooth className="size-4 text-blue-500" />
        <span className="text-sm font-bold">Bluetooth čelada</span>
      </div>
      {connected ? (
        <div className="space-y-3">
          <div className="bg-blue-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Signal className="size-4 text-blue-500" />
              <span className="text-sm font-medium">{connected.name}</span>
              <Badge variant="outline" className="text-[9px] bg-green-500/20 text-green-400 border-green-500/30">Povezano</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs"><Battery className="size-3" /><span>{connected.battery}%</span></div>
          </div>
          <div>
            <Label className="text-xs">Glasnost: {volume}%</Label>
            <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500 bg-muted" />
          </div>
          <Button variant="outline" className="w-full gap-2 text-xs" onClick={disconnect}><X className="size-3" /> Prekini povezavo</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button className="w-full gap-2" onClick={scan} disabled={scanning}>
            <Bluetooth className={`size-4 ${scanning ? 'animate-pulse' : ''}`} /> {scanning ? 'Iščem...' : 'Išči naprave'}
          </Button>
          {devices.map(d => (
            <button key={d.id} onClick={() => connect(d.id, d.name)} className="w-full flex items-center gap-2 p-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors">
              <Bluetooth className="size-4 text-blue-500" />
              <div className="flex-1 text-left"><p className="text-xs font-medium">{d.name}</p><p className="text-[10px] text-muted-foreground">Baterija: {d.battery}%</p></div>
              <ChevronRight className="size-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== FEATURE 12: CHALLENGES PANEL ====================
export function ChallengesPanel({ userId }: { userId?: string }) {
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = userId ? `/api/challenges?userId=${userId}` : '/api/challenges'
    fetch(url).then(r => r.json()).then(j => { setChallenges(j.data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [userId])

  const typeIcon = (type: string) => {
    switch (type) {
      case 'distance': return <Gauge className="size-4" />
      case 'elevation': return <Mountain className="size-4" />
      case 'corners': return <GitBranch className="size-4" />
      case 'streak': return <Flame className="size-4" />
      default: return <Trophy className="size-4" />
    }
  }

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { distance: 'Razdalja', elevation: 'Višina', corners: 'Ovinki', streak: 'Niz' }
    return map[type] || type
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Trophy className="size-5 text-primary" /><h3 className="font-bold">Izzivi</h3></div>
      {loading ? <p className="text-xs text-muted-foreground">Nalagam...</p> : (
        <div className="space-y-2">
          {challenges.map(ch => (
            <Card key={ch.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-primary/15 text-primary">{typeIcon(ch.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ch.title}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel(ch.type)} · {ch.target} {ch.unit}</p>
                    {ch.percentComplete !== undefined && (
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span>{ch.progress} / {ch.target} {ch.unit}</span>
                          <span>{ch.percentComplete}%</span>
                        </div>
                        <Progress value={ch.percentComplete} className="h-1.5" />
                      </div>
                    )}
                  </div>
                  {ch.completed && <Award className="size-5 text-amber-500" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== FEATURE 13: OBD CONNECTOR ====================
export function OBDDashboard() {
  const [connected, setConnected] = useState(false)
  const [dashboard, setDashboard] = useState<any>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connect = async () => {
    try {
      const res = await fetch('/api/obd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect' }) })
      const j = await res.json()
      if (j.data?.connected) {
        setConnected(true)
        setDashboard(j.data.dashboard)
        // Start live updates
        intervalRef.current = setInterval(async () => {
          const r = await fetch('/api/obd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dashboard' }) })
          const d = await r.json()
          if (d.data) setDashboard(d.data)
        }, 2000)
      }
    } catch { toast.error('Napaka pri povezovanju') }
  }

  const disconnect = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    await fetch('/api/obd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) })
    setConnected(false)
    setDashboard(null)
  }

  if (!connected) {
    return <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={connect}><Cpu className="size-3" /> Poveži OBD</Button>
  }

  return (
    <div className="bg-card border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Cpu className="size-4 text-green-500" /><span className="text-xs font-bold text-green-500">OBD Povezano</span></div>
        <button onClick={disconnect} className="text-xs text-red-500 hover:underline">Prekini</button>
      </div>
      {dashboard && (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><Activity className="size-3 mx-auto text-primary" /><p className="text-xs font-bold">{dashboard.rpm}</p><p className="text-[9px] text-muted-foreground">RPM</p></div>
          <div><Gauge className="size-3 mx-auto text-primary" /><p className="text-xs font-bold">{dashboard.speed}</p><p className="text-[9px] text-muted-foreground">km/h</p></div>
          <div><Thermometer className="size-3 mx-auto text-primary" /><p className="text-xs font-bold">{dashboard.engineTemp}°</p><p className="text-[9px] text-muted-foreground">Temp</p></div>
          <div><Zap className="size-3 mx-auto text-primary" /><p className="text-xs font-bold">{dashboard.batteryVoltage}V</p><p className="text-[9px] text-muted-foreground">Baterija</p></div>
        </div>
      )}
    </div>
  )
}

// ==================== FEATURE 14: TRAFFIC ALERTS ====================
export function TrafficAlerts({ userId }: { userId?: string }) {
  const [alerts, setAlerts] = useState<any[]>([])
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

  useEffect(() => {
    const params = severityFilter ? `?severity=${severityFilter}` : ''
    fetch(`/api/traffic${params}`).then(r => r.json()).then(j => setAlerts(j.data || [])).catch(() => {})
  }, [severityFilter])

  const severityColor = (s: string) => s === 'high' ? 'text-red-500' : s === 'medium' ? 'text-amber-500' : 'text-yellow-500'
  const typeIcon = (t: string) => {
    switch (t) {
      case 'congestion': return '🚗'
      case 'accident': return '🆘'
      case 'construction': return '🚧'
      case 'closure': return '⛔'
      default: return '⚠️'
    }
  }
  const typeLabel = (t: string) => {
    const map: Record<string, string> = { congestion: 'Zastoj', accident: 'Nesreča', construction: 'Delnice', closure: 'Zapora' }
    return map[t] || t
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><CarFront className="size-4 text-amber-500" /><span className="text-xs font-bold">Prometna opozorila</span></div>
        <div className="flex gap-1">
          {[null, 'high', 'medium', 'low'].map(s => (
            <button key={s ?? 'all'} onClick={() => setSeverityFilter(s)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${severityFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
              {s === null ? 'Vse' : s === 'high' ? 'Hudo' : s === 'medium' ? 'Srednje' : 'Nizko'}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="max-h-48">
        <div className="space-y-1.5">
          {alerts.map(a => (
            <div key={a.id} className="flex items-start gap-2 p-2 bg-secondary/50 rounded-lg">
              <span className="text-sm">{typeIcon(a.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate">{a.title}</p>
                  <Badge variant="outline" className={`text-[8px] px-1 py-0 ${severityColor(a.severity)}`}>{typeLabel(a.type)}</Badge>
                </div>
                {a.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{a.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ==================== FEATURE 15: MAP STYLE SWITCHER ====================
export function MapStyleSwitcher({ currentStyle, onStyleChange }: { currentStyle: string; onStyleChange: (url: string, attr: string, id: string) => void }) {
  const [styles, setStyles] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/map-styles').then(r => r.json()).then(j => setStyles(j.data || [])).catch(() => {})
  }, [])

  if (!open) {
    return (
      <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full shadow-lg backdrop-blur-md border border-border bg-background/90 hover:bg-muted" onClick={() => setOpen(true)} title="Slog zemljevida">
        <Palette className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <div className="absolute top-16 right-4 z-[1000] bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg p-3 w-52">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold">Slog zemljevida</span>
        <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-muted"><X className="size-3 text-muted-foreground" /></button>
      </div>
      <div className="space-y-1.5">
        {styles.map(s => (
          <button key={s.id} onClick={() => { onStyleChange(s.url, s.attribution, s.id); setOpen(false) }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${currentStyle === s.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}>
            <span className="text-lg">{s.preview}</span>
            <div className="text-left"><p className="font-medium">{s.name}</p><p className="text-[10px] opacity-70">{s.description}</p></div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ==================== FEATURE 16: SERVICE CENTER LOCATOR ====================
export function ServiceCenterLocator() {
  const [centers, setCenters] = useState<any[]>([])
  const [brandFilter, setBrandFilter] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = brandFilter ? `?brand=${brandFilter}` : ''
    fetch(`/api/service-centers${params}`).then(r => r.json()).then(j => { if (!cancelled) { setCenters(j.data || []); setLoading(false) } }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [brandFilter])

  const brands = ['BMW', 'Yamaha', 'Honda', 'KTM', 'Ducati', 'Kawasaki', 'Suzuki', 'Triumph']

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><Wrench className="size-5 text-primary" /><h3 className="font-bold">Servisi</h3></div>
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setBrandFilter('')} className={`px-2 py-1 rounded-md text-[10px] font-medium ${!brandFilter ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>Vsi</button>
        {brands.map(b => (
          <button key={b} onClick={() => setBrandFilter(b)} className={`px-2 py-1 rounded-md text-[10px] font-medium ${brandFilter === b ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{b}</button>
        ))}
      </div>
      <ScrollArea className="max-h-48">
        <div className="space-y-1.5">
          {centers.map(c => (
            <div key={c.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3 text-primary shrink-0" />
                  <p className="text-xs font-medium truncate">{c.name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground ml-4.5">{c.distance} km · {'★'.repeat(Math.round(c.rating))}{'☆'.repeat(5 - Math.round(c.rating))}</p>
                <div className="flex gap-1 ml-4.5 mt-0.5">
                  {c.services?.slice(0, 3).map((s: string) => (
                    <Badge key={s} variant="outline" className="text-[8px] px-1 py-0">{s}</Badge>
                  ))}
                </div>
              </div>
              {c.phone && <a href={`tel:${c.phone}`} className="p-1.5 rounded-full hover:bg-green-500/20 text-green-500"><Phone className="size-3" /></a>}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ==================== FEATURE 17: POINTS/GAMIFICATION ====================
export function PointsPanel({ userId }: { userId?: string }) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!userId) return
    fetch(`/api/points?userId=${userId}`).then(r => r.json()).then(j => setData(j.data)).catch(() => {})
  }, [userId])

  if (!data) return null

  return (
    <div className="bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{data.levelIcon}</span>
          <div>
            <p className="font-bold text-sm">{data.level}</p>
            <p className="text-xs text-muted-foreground">{data.points} točk</p>
          </div>
        </div>
        {data.nextLevel && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Naslednji: {data.nextLevelIcon} {data.nextLevel}</p>
            <p className="text-[10px] text-muted-foreground">{data.pointsToNext} točk do nadgradnje</p>
          </div>
        )}
      </div>
      <Progress value={data.progress} className="h-2" />
      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
        <span>📏 {data.breakdown?.distance || 0} točk (razdalja)</span>
        <span>⛰️ {data.breakdown?.elevation || 0} točk (višina)</span>
        <span>🗺️ {data.breakdown?.routes || 0} točk (poti)</span>
      </div>
    </div>
  )
}
