'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Fuel, MapPin, TrendingUp, TrendingDown, Check, Plus,
  ChevronDown, ChevronUp, Navigation, Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FuelPriceEntry {
  id: string
  stationName: string
  stationBrand: string
  fuelType: string
  price: number
  lat: number
  lng: number
  country: string
  confirmedBy: number
  distance: number
  updatedAt: string
}

interface CountryAvg {
  country: string
  avgPrice: number
  count: number
}

interface FuelPriceTrackerProps {
  lat?: number
  lng?: number
  userId?: string
  className?: string
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const FUEL_TYPES = [
  { value: 'bencin-95', label: 'Bencin 95' },
  { value: 'bencin-98', label: 'Bencin 98' },
  { value: 'diesel', label: 'Dizel' },
  { value: 'e85', label: 'E85' },
  { value: 'lpg', label: 'LPG' },
]

const BRANDS = [
  { value: 'Petrol', label: 'Petrol', emoji: '🟡' },
  { value: 'OMV', label: 'OMV', emoji: '🔵' },
  { value: 'MOL', label: 'MOL', emoji: '🟢' },
  { value: 'INA', label: 'INA', emoji: '🔴' },
  { value: 'Hemus', label: 'Hemus', emoji: '🟠' },
  { value: 'Lukoil', label: 'Lukoil', emoji: '🔴' },
  { value: 'NIS', label: 'NIS', emoji: '🟤' },
  { value: 'Drugo', label: 'Drugo', emoji: '⛽' },
]

const COUNTRY_NAMES: Record<string, string> = {
  SI: '🇸🇮 Slovenija', HR: '🇭🇷 Hrvaška', BA: '🇧🇦 BiH', RS: '🇷🇸 Srbija',
  ME: '🇲🇪 Črna gora', MK: '🇲🇰 Makedonija', AL: '🇦🇱 Albanija',
  BG: '🇧🇬 Bolgarija', RO: '🇷🇴 Romunija', GR: '🇬🇷 Grčija',
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min nazaj`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h nazaj`
  const days = Math.floor(hours / 24)
  return `${days}d nazaj`
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function FuelPriceTracker({ lat, lng, userId = 'default', className = '' }: FuelPriceTrackerProps) {
  const [prices, setPrices] = useState<FuelPriceEntry[]>([])
  const [countryAvgs, setCountryAvgs] = useState<CountryAvg[]>([])
  const [fuelType, setFuelType] = useState('bencin-95')
  const [loading, setLoading] = useState(true)
  const [showReport, setShowReport] = useState(false)
  const [showAvgs, setShowAvgs] = useState(false)

  // Report form state
  const [reportName, setReportName] = useState('')
  const [reportBrand, setReportBrand] = useState('Petrol')
  const [reportPrice, setReportPrice] = useState('')
  const [reporting, setReporting] = useState(false)

  const fetchPrices = useCallback(async () => {
    if (!lat || !lng) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/fuel-prices-community?lat=${lat}&lng=${lng}&radius=30&fuelType=${fuelType}`)
      const data = await res.json()
      if (data.prices) setPrices(data.prices)
      if (data.countryAverages) setCountryAvgs(data.countryAverages)
    } catch {
      toast.error('Napaka pri nalaganju cen')
    } finally {
      setLoading(false)
    }
  }, [lat, lng, fuelType])

  useEffect(() => { fetchPrices() }, [fetchPrices])

  const handleReport = useCallback(async () => {
    if (!reportName.trim() || !reportPrice || !lat || !lng) {
      toast.error('Izpolnite vsa polja')
      return
    }
    const priceVal = parseFloat(reportPrice)
    if (isNaN(priceVal) || priceVal < 0.5 || priceVal > 3.0) {
      toast.error('Cena mora biti med 0.50 in 3.00 EUR')
      return
    }

    setReporting(true)
    try {
      const res = await fetch('/api/fuel-prices-community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationName: reportName.trim(),
          stationBrand: reportBrand,
          fuelType,
          price: priceVal,
          lat, lng,
          userId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Cena objavljena! Hvala za prispevek.')
        setReportName('')
        setReportPrice('')
        setShowReport(false)
        fetchPrices()
      } else {
        toast.error(data.error || 'Napaka pri objavi cene')
      }
    } catch {
      toast.error('Napaka pri objavi cene')
    } finally {
      setReporting(false)
    }
  }, [reportName, reportPrice, reportBrand, fuelType, lat, lng, userId, fetchPrices])

  const handleConfirm = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/fuel-prices-community', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Cena potrjena!')
        setPrices(prev => prev.map(p => p.id === id ? { ...p, confirmedBy: data.confirmedBy } : p))
      }
    } catch {
      toast.error('Napaka pri potrjevanju')
    }
  }, [])

  const brandEmoji = (brand: string) => BRANDS.find(b => b.value === brand)?.emoji || '⛽'

  const minPrice = prices.length > 0 ? Math.min(...prices.map(p => p.price)) : 0

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Fuel className="size-3.5" />
          Cene goriva
        </h3>
        <div className="flex items-center gap-1.5">
          <Select value={fuelType} onValueChange={setFuelType}>
            <SelectTrigger className="h-7 text-xs w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUEL_TYPES.map(ft => (
                <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowReport(!showReport)}
          >
            <Plus className="size-3" />
            Prijavi
          </Button>
        </div>
      </div>

      {/* Report Form */}
      {showReport && (
        <div className="mb-3 p-3 bg-secondary/20 rounded-xl border border-border space-y-2">
          <div className="text-xs font-semibold">Prijavi ceno goriva</div>
          <Input
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder="Ime bencinske črpalkle"
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Select value={reportBrand} onValueChange={setReportBrand}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.emoji} {b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Input
                type="number"
                step="0.01"
                min="0.50"
                max="3.00"
                value={reportPrice}
                onChange={(e) => setReportPrice(e.target.value)}
                placeholder="1.55"
                className="h-8 text-xs pr-8"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">EUR/l</span>
            </div>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs w-full"
            onClick={handleReport}
            disabled={reporting}
          >
            {reporting ? 'Pošiljanje...' : 'Objavi ceno'}
          </Button>
        </div>
      )}

      {/* Country Averages Toggle */}
      {countryAvgs.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => setShowAvgs(!showAvgs)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <TrendingUp className="size-3" />
            Povprečne cene po državah
            {showAvgs ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {showAvgs && (
            <div className="mt-1 space-y-1">
              {countryAvgs.map(ca => (
                <div key={ca.country} className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-secondary/30">
                  <span>{COUNTRY_NAMES[ca.country] || ca.country}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{ca.avgPrice.toFixed(3)} €</span>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0">{ca.count}x</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Price List */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : prices.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-muted-foreground">
          <Fuel className="size-8 opacity-30 mb-2" />
          <p className="text-xs">Brez cen v bližini</p>
          <p className="text-[10px] mt-1">Prijavite ceno na vaši črpalki!</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {prices.map(p => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                p.price === minPrice ? 'bg-green-500/10 border border-green-500/20' : 'bg-secondary/30 hover:bg-secondary/50'
              }`}
            >
              <span className="text-sm">{brandEmoji(p.stationBrand)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium truncate">{p.stationName}</span>
                  {p.confirmedBy > 0 && (
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-green-500/10 text-green-600">
                      <Check className="size-2 mr-0.5" />{p.confirmedBy}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="size-2.5" />
                    {formatDistance(p.distance)}
                  </span>
                  <span>{timeAgo(p.updatedAt)}</span>
                  <span>{COUNTRY_NAMES[p.country] || p.country}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${p.price === minPrice ? 'text-green-600' : ''}`}>
                  {p.price.toFixed(3)} €
                </div>
                <button
                  onClick={() => handleConfirm(p.id)}
                  className="text-[9px] text-muted-foreground hover:text-green-600 transition-colors"
                >
                  Potrdi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh */}
      <div className="mt-2 text-center">
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={fetchPrices}>
          <Navigation className="size-2.5" />
          Osveži cene
        </Button>
      </div>
    </div>
  )
}
