'use client'

import React, { useState, useEffect } from 'react'
import { ClipboardCheck, SkipForward, Play, Check, X, Cloud, Sun, AlertTriangle, Thermometer, Wind } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const CHECKLIST_ITEMS = [
  { id: 'helmet', label: 'Čelada', emoji: '🪖' },
  { id: 'gloves', label: 'Rokavice', emoji: '🧤' },
  { id: 'jacket', label: 'Jakna', emoji: '🧥' },
  { id: 'boots', label: 'Škornji', emoji: '👢' },
  { id: 'phone', label: 'Telefon napolnjen', emoji: '📱' },
  { id: 'documents', label: 'Dokumenti', emoji: '🔑' },
  { id: 'fuel', label: 'Gorivo', emoji: '⛽' },
  { id: 'tires', label: 'Pritisk v pnevmatikah', emoji: '🛞' },
  { id: 'lights', label: 'Luči delujejo', emoji: '🔦' },
  { id: 'chain', label: 'Veriga/tekočina', emoji: '🪛' },
]

const STORAGE_KEY = 'mototrack-preride-checklist'

interface WeatherInfo {
  temp: number
  description: string
  icon: string
  windSpeed: number
  humidity: number
  isDangerous: boolean
  warning?: string
}

interface PreRideChecklistProps {
  open: boolean
  onClose: (skipped: boolean) => void
  onStartRide: () => void
}

export default function PreRideChecklist({ open, onClose, onStartRide }: PreRideChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [weather, setWeather] = useState<WeatherInfo | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  // Fetch weather when dialog opens
  useEffect(() => {
    if (!open) return
    setWeatherLoading(true)
    setWeather(null)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(`/api/weather?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
            if (res.ok) {
              const j = await res.json()
              const data = j.data
              if (data) {
                const isDangerous = 
                  (data.windSpeed ?? 0) > 50 ||
                  data.description?.toLowerCase().includes('thunder') ||
                  data.description?.toLowerCase().includes('storm') ||
                  data.description?.toLowerCase().includes('snow') ||
                  (data.temp ?? 20) < 0
                
                let warning: string | undefined
                if ((data.windSpeed ?? 0) > 50) warning = 'Močan veter! Nevarno za vožnjo.'
                else if (data.description?.toLowerCase().includes('thunder')) warning = 'Nevihte! Odložite vožnjo.'
                else if (data.description?.toLowerCase().includes('snow')) warning = 'Sneg! Nevarno za motor.'
                else if ((data.temp ?? 20) < 0) warning = 'Zmrzal! Preverite ceste.'
                else if ((data.temp ?? 20) < 5) warning = 'Nizka temperatura. Topla oblačila!'
                else if ((data.windSpeed ?? 0) > 30) warning = 'Zmeren veter. Bodite previdni.'
                
                setWeather({
                  temp: Math.round(data.temp ?? 0),
                  description: data.description || '',
                  icon: data.icon || '',
                  windSpeed: Math.round(data.windSpeed ?? 0),
                  humidity: data.humidity ?? 0,
                  isDangerous,
                  warning,
                })
              }
            }
          } catch { /* weather not available */ }
          setWeatherLoading(false)
        },
        () => setWeatherLoading(false),
        { enableHighAccuracy: false, timeout: 5000 }
      )
    } else {
      setWeatherLoading(false)
    }
  }, [open])

  // Save to localStorage on change
  useEffect(() => {
    if (open && Object.keys(checked).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked))
    }
  }, [checked, open])

  const toggleItem = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const checkedCount = Object.values(checked).filter(Boolean).length
  const totalItems = CHECKLIST_ITEMS.length
  const progressPct = (checkedCount / totalItems) * 100
  const allChecked = checkedCount === totalItems
  const enoughChecked = checkedCount >= 5

  const handleStartRide = () => {
    onStartRide()
    onClose(false)
  }

  const handleSkip = () => {
    onClose(true)
  }

  const handleCheckAll = () => {
    const allChecked: Record<string, boolean> = {}
    CHECKLIST_ITEMS.forEach(item => { allChecked[item.id] = true })
    setChecked(allChecked)
  }

  const handleUncheckAll = () => {
    setChecked({})
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-primary/80 to-primary/40 p-4">
          <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
            <ClipboardCheck className="size-5" />
            Pre-Ride Checklist
          </DialogTitle>
          <p className="text-white/80 text-xs mt-1">Preverite opremo in vreme pred vožnjo</p>
        </div>

        {/* Weather check */}
        {weather && (
          <div className={`mx-4 mt-2 p-3 rounded-lg border ${
            weather.isDangerous 
              ? 'bg-red-500/10 border-red-500/30' 
              : weather.warning 
                ? 'bg-amber-500/10 border-amber-500/20' 
                : 'bg-emerald-500/10 border-emerald-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {weather.isDangerous ? (
                <AlertTriangle className="size-4 text-red-500" />
              ) : weather.warning ? (
                <Cloud className="size-4 text-amber-500" />
              ) : (
                <Sun className="size-4 text-emerald-500" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Thermometer className="size-3 text-muted-foreground" />
                  <span className="text-sm font-bold">{weather.temp}°C</span>
                  <Wind className="size-3 text-muted-foreground ml-2" />
                  <span className="text-xs text-muted-foreground">{weather.windSpeed} km/h</span>
                </div>
                {weather.description && (
                  <p className="text-xs text-muted-foreground capitalize">{weather.description}</p>
                )}
              </div>
            </div>
            {weather.warning && (
              <p className={`text-xs font-medium mt-1.5 ${weather.isDangerous ? 'text-red-500' : 'text-amber-500'}`}>
                ⚠️ {weather.warning}
              </p>
            )}
          </div>
        )}
        {weatherLoading && (
          <div className="mx-4 mt-2 p-2 rounded-lg bg-muted/30 flex items-center gap-2">
            <div className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Preverjam vreme...</span>
          </div>
        )}

        {/* Progress */}
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">{checkedCount}/{totalItems} preverjeno</span>
            <span className={`font-bold ${allChecked ? 'text-green-500' : enoughChecked ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {allChecked ? '✓ Vse OK!' : enoughChecked ? `${checkedCount}/${totalItems}` : 'Preverite opremo'}
            </span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        {/* Checklist items */}
        <div className="px-4 py-2 space-y-1.5 max-h-[280px] overflow-y-auto">
          {CHECKLIST_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all text-left ${
                checked[item.id]
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-border/30 bg-muted/30 hover:border-primary/30'
              }`}
            >
              <span className="text-base shrink-0">{item.emoji}</span>
              <span className={`flex-1 text-xs font-medium ${checked[item.id] ? 'text-green-400 line-through' : ''}`}>
                {item.label}
              </span>
              <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                checked[item.id]
                  ? 'border-green-500 bg-green-500'
                  : 'border-muted-foreground/30'
              }`}>
                {checked[item.id] && <Check className="size-3 text-white" />}
              </div>
            </button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="px-4 py-2 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 gap-1 flex-1"
            onClick={handleCheckAll}
          >
            <Check className="size-3" /> Označi vse
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 gap-1 flex-1"
            onClick={handleUncheckAll}
          >
            <X className="size-3" /> Počisti
          </Button>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs gap-1.5 h-9"
            onClick={handleSkip}
          >
            <SkipForward className="size-3.5" />
            Preskoči
          </Button>
          <Button
            size="sm"
            className={`flex-1 text-xs gap-1.5 h-9 ${
              allChecked
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-primary hover:bg-primary/90'
            }`}
            onClick={handleStartRide}
            disabled={weather?.isDangerous}
          >
            <Play className="size-3.5" />
            {weather?.isDangerous ? 'Nevarno!' : allChecked ? 'Začni vožnjo ✓' : enoughChecked ? 'Začni vožnjo' : 'Preveri opremo'}
          </Button>
        </div>

        {/* Weather danger warning */}
        {weather?.isDangerous && (
          <div className="px-4 pb-3">
            <p className="text-[9px] text-red-500 text-center font-medium">
              ⚠️ Vremenski pogoji so nevarni za vožnjo z motorjem! Razmislite o odlogi.
            </p>
          </div>
        )}

        {/* Warning if not enough checked */}
        {!enoughChecked && checkedCount > 0 && !weather?.isDangerous && (
          <div className="px-4 pb-3">
            <p className="text-[9px] text-amber-400 text-center">
              ⚠️ Priporočamo preverjanje vsaj 5 postavk pred vožnjo
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
