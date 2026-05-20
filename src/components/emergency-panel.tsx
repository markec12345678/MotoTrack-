'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Phone,
  AlertTriangle,
  Heart,
  MapPin,
  ShieldAlert,
  Copy,
  Share2,
  ChevronDown,
  Wrench,
  X,
  Droplets,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

// ─── Emergency numbers by country (hardcoded for offline use) ──────────────
interface CountryEmergency {
  code: string
  name: string
  nameSl: string
  flag: string
  police: string
  ambulance: string
  fire: string
  general: string
  roadsideAssistance: { name: string; phone: string }[]
}

const BALKAN_EMERGENCY: CountryEmergency[] = [
  {
    code: 'SI',
    name: 'Slovenia',
    nameSl: 'Slovenija',
    flag: '🇸🇮',
    police: '113',
    ambulance: '112',
    fire: '112',
    general: '112',
    roadsideAssistance: [
      { name: 'HAK', phone: '1987' },
      { name: 'AMZS', phone: '080 22 44' },
    ],
  },
  {
    code: 'HR',
    name: 'Croatia',
    nameSl: 'Hrvaška',
    flag: '🇭🇷',
    police: '192',
    ambulance: '194',
    fire: '193',
    general: '112',
    roadsideAssistance: [
      { name: 'HAK', phone: '1987' },
      { name: 'HAM', phone: '062 646 646' },
    ],
  },
  {
    code: 'BA',
    name: 'Bosnia',
    nameSl: 'Bosna in Hercegovina',
    flag: '🇧🇦',
    police: '122',
    ambulance: '124',
    fire: '123',
    general: '112',
    roadsideAssistance: [
      { name: 'BIHAMK', phone: '1282' },
    ],
  },
  {
    code: 'ME',
    name: 'Montenegro',
    nameSl: 'Črna gora',
    flag: '🇲🇪',
    police: '122',
    ambulance: '124',
    fire: '123',
    general: '112',
    roadsideAssistance: [
      { name: 'AMSCG', phone: '19807' },
    ],
  },
  {
    code: 'RS',
    name: 'Serbia',
    nameSl: 'Srbija',
    flag: '🇷🇸',
    police: '192',
    ambulance: '194',
    fire: '193',
    general: '112',
    roadsideAssistance: [
      { name: 'AMS', phone: '1987' },
    ],
  },
  {
    code: 'MK',
    name: 'N. Macedonia',
    nameSl: 'Severna Makedonija',
    flag: '🇲🇰',
    police: '192',
    ambulance: '194',
    fire: '193',
    general: '112',
    roadsideAssistance: [
      { name: 'AMSM', phone: '196' },
    ],
  },
  {
    code: 'AL',
    name: 'Albania',
    nameSl: 'Albanija',
    flag: '🇦🇱',
    police: '129',
    ambulance: '127',
    fire: '128',
    general: '112',
    roadsideAssistance: [
      { name: 'ACI', phone: '0800 2222' },
    ],
  },
  {
    code: 'BG',
    name: 'Bulgaria',
    nameSl: 'Bolgarija',
    flag: '🇧🇬',
    police: '166',
    ambulance: '150',
    fire: '160',
    general: '112',
    roadsideAssistance: [
      { name: 'BAK', phone: '146' },
    ],
  },
  {
    code: 'RO',
    name: 'Romania',
    nameSl: 'Romunija',
    flag: '🇷🇴',
    police: '955',
    ambulance: '961',
    fire: '981',
    general: '112',
    roadsideAssistance: [
      { name: 'ACR', phone: '9276' },
    ],
  },
  {
    code: 'GR',
    name: 'Greece',
    nameSl: 'Grčija',
    flag: '🇬🇷',
    police: '100',
    ambulance: '166',
    fire: '199',
    general: '112',
    roadsideAssistance: [
      { name: 'ELPA', phone: '10400' },
    ],
  },
]

// ─── Country detection from GPS via reverse geocoding ──────────────────────
// Fallback: point-in-polygon approximation using bounding boxes
const COUNTRY_BOUNDS: Array<{ code: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { code: 'SI', minLat: 45.42, maxLat: 46.88, minLng: 13.38, maxLng: 16.60 },
  { code: 'HR', minLat: 42.38, maxLat: 46.54, minLng: 13.49, maxLng: 19.44 },
  { code: 'BA', minLat: 42.55, maxLat: 45.28, minLng: 15.73, maxLng: 19.63 },
  { code: 'ME', minLat: 41.85, maxLat: 43.56, minLng: 18.45, maxLng: 20.36 },
  { code: 'RS', minLat: 42.23, maxLat: 46.19, minLng: 18.83, maxLng: 23.01 },
  { code: 'MK', minLat: 40.86, maxLat: 42.36, minLng: 20.46, maxLng: 23.04 },
  { code: 'AL', minLat: 39.64, maxLat: 42.66, minLng: 19.28, maxLng: 21.06 },
  { code: 'BG', minLat: 41.24, maxLat: 44.22, minLng: 22.36, maxLng: 28.61 },
  { code: 'RO', minLat: 43.62, maxLat: 48.27, minLng: 20.26, maxLng: 30.06 },
  { code: 'GR', minLat: 34.93, maxLat: 41.75, minLng: 19.38, maxLng: 29.70 },
]

function detectCountryFromCoords(lat: number, lng: number): CountryEmergency | null {
  // Try bounding box match
  for (const b of COUNTRY_BOUNDS) {
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) {
      return BALKAN_EMERGENCY.find(c => c.code === b.code) || null
    }
  }
  return null
}

// ─── Emergency call button ─────────────────────────────────────────────────
function EmergencyCallButton({
  emoji,
  label,
  number,
  countryFlag,
}: {
  emoji: string
  label: string
  number: string
  countryFlag?: string
}) {
  return (
    <a
      href={`tel:${number}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border-2 border-red-200 dark:border-red-900/50 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all active:scale-95 min-h-[56px]"
    >
      <span className="text-2xl flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-black text-red-600 dark:text-red-400 tracking-wide">{number}</p>
      </div>
      <div className="flex items-center gap-1 text-red-500 flex-shrink-0">
        <Phone className="size-4" />
        <span className="text-[10px] font-bold uppercase">Pokliči</span>
      </div>
      {countryFlag && (
        <span className="text-lg flex-shrink-0">{countryFlag}</span>
      )}
    </a>
  )
}

// ─── ICE contact row ───────────────────────────────────────────────────────
function IceContactRow({
  name,
  phone,
  onShare,
}: {
  name: string
  phone: string | null
  onShare?: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
      <div className="flex items-center justify-center size-10 rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0">
        <Heart className="size-5 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {phone && (
          <p className="text-xs text-muted-foreground">{phone}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center justify-center size-10 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors active:scale-90"
            title={`Pokliči ${name}`}
          >
            <Phone className="size-4" />
          </a>
        )}
        {onShare && phone && (
          <button
            onClick={onShare}
            className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors active:scale-90"
            title="Deli lokacijo"
          >
            <Share2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────
export interface EmergencyPanelProps {
  userId?: string
  currentLat?: number | null
  currentLng?: number | null
  isOpen: boolean
  onClose: () => void
}

export default function EmergencyPanel({
  userId,
  currentLat,
  currentLng,
  isOpen,
  onClose,
}: EmergencyPanelProps) {
  // ─── State ─────────────────────────────────────────────────────────────
  const [detectedCountry, setDetectedCountry] = useState<CountryEmergency | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<CountryEmergency | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [iceContacts, setIceContacts] = useState<{
    iceName1: string | null
    icePhone1: string | null
    iceName2: string | null
    icePhone2: string | null
    bloodType: string | null
    allergies: string | null
  } | null>(null)
  const [locationCopied, setLocationCopied] = useState(false)
  const locationCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Active country (manual selection overrides detection) ──────────
  const activeCountry = selectedCountry || detectedCountry || BALKAN_EMERGENCY[0]

  // ─── Detect country from GPS coordinates ────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    if (currentLat == null || currentLng == null) return

    let cancelled = false

    // First try reverse geocoding for accurate country detection
    const detectViaGeocoding = async () => {
      if (cancelled) return
      setDetecting(true)

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLng}&format=json&zoom=3&accept-language=sl`,
          { signal: AbortSignal.timeout(5000) }
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          const code = data?.address?.country_code?.toUpperCase()
          if (code) {
            const match = BALKAN_EMERGENCY.find(c => c.code === code)
            if (match) {
              setDetectedCountry(match)
              setDetecting(false)
              return
            }
          }
        }
      } catch {
        // Geocoding failed — fall back to bounding box
      }

      if (cancelled) return
      // Fallback: bounding box detection
      const match = detectCountryFromCoords(currentLat, currentLng)
      if (match) {
        setDetectedCountry(match)
      }
      setDetecting(false)
    }

    detectViaGeocoding()
    return () => { cancelled = true }
  }, [isOpen, currentLat, currentLng])

  // ─── Fetch ICE contacts ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !userId) return
    fetch(`/api/emergency-contacts?userId=${userId}`)
      .then(r => r.json())
      .then(j => {
        if (j.data) {
          setIceContacts(j.data)
        }
      })
      .catch(() => {})
  }, [isOpen, userId])

  // ─── Copy coordinates to clipboard ──────────────────────────────────
  const handleCopyLocation = useCallback(async () => {
    if (currentLat == null || currentLng == null) return

    const text = `🆘 Nujna pomoč!\nMoja lokacija:\nhttps://maps.google.com/?q=${currentLat.toFixed(6)},${currentLng.toFixed(6)}\nKoordinate: ${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`

    try {
      await navigator.clipboard.writeText(text)
      setLocationCopied(true)
      toast.success('Koordinate kopirane v odložišče')
      if (locationCopiedTimer.current) clearTimeout(locationCopiedTimer.current)
      locationCopiedTimer.current = setTimeout(() => setLocationCopied(false), 3000)
    } catch {
      toast.error('Napaka pri kopiranju')
    }
  }, [currentLat, currentLng])

  // ─── Share location via SMS ─────────────────────────────────────────
  const handleShareLocation = useCallback((phone: string | null) => {
    if (currentLat == null || currentLng == null) {
      toast.error('Lokacija ni na voljo')
      return
    }

    const text = `🆘 MotoTrack SOS! Moja lokacija: https://maps.google.com/?q=${currentLat.toFixed(6)},${currentLng.toFixed(6)}`

    // Try native share first
    if (navigator.share) {
      navigator.share({
        title: 'MotoTrack SOS',
        text,
      }).catch(() => {})
      return
    }

    // Fallback: SMS
    if (phone) {
      const smsUrl = `sms:${phone}?body=${encodeURIComponent(text)}`
      window.open(smsUrl, '_blank')
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(text).then(() => {
        toast.success('Sporočilo kopirano — prilepite v SMS')
      }).catch(() => {
        toast.error('Napaka pri deljenju lokacije')
      })
    }
  }, [currentLat, currentLng])

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white dark:bg-zinc-950">
        {/* Red emergency header */}
        <div className="sticky top-0 z-10 bg-red-600 text-white p-4 rounded-t-lg">
          <DialogHeader className="space-y-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-10 rounded-full bg-white/20 animate-pulse">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black tracking-wide">
                    🆘 NUJNA POMOČ
                  </DialogTitle>
                  <p className="text-xs text-white/80">
                    Hitri dostop do vseh slovarskih številk
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogHeader>

          {/* Country detection indicator */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCountryPicker(!showCountryPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-sm font-bold"
            >
              <span className="text-lg">{activeCountry.flag}</span>
              <span>{activeCountry.nameSl}</span>
              <ChevronDown className={`size-3.5 transition-transform ${showCountryPicker ? 'rotate-180' : ''}`} />
            </button>
            {detecting && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 text-[10px] text-white/70">
                <Loader2 className="size-3 animate-spin" />
                Zaznavam državo...
              </span>
            )}
            {detectedCountry && !detecting && !selectedCountry && (
              <span className="text-[10px] text-white/60">📍 Samodejno zaznano</span>
            )}
            {selectedCountry && (
              <button
                onClick={() => setSelectedCountry(null)}
                className="text-[10px] text-white/60 underline hover:text-white/80"
              >
                🔄 Samodejno zaznaj
              </button>
            )}
          </div>
        </div>

        {/* Country picker dropdown */}
        {showCountryPicker && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">Izberi državo:</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BALKAN_EMERGENCY.map((country) => (
                <button
                  key={country.code}
                  onClick={() => {
                    setSelectedCountry(country)
                    setShowCountryPicker(false)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCountry.code === country.code
                      ? 'bg-red-600 text-white'
                      : 'bg-white dark:bg-white/5 border border-border hover:bg-red-50 dark:hover:bg-red-950/50'
                  }`}
                >
                  <span className="text-base">{country.flag}</span>
                  <span className="truncate">{country.nameSl}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* ─── Emergency numbers ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                Klicne številke
              </h3>
              <span className="text-lg">{activeCountry.flag}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <EmergencyCallButton
                emoji="🚔"
                label="Policija"
                number={activeCountry.police}
                countryFlag={activeCountry.flag}
              />
              <EmergencyCallButton
                emoji="🚑"
                label="Reševalci"
                number={activeCountry.ambulance}
                countryFlag={activeCountry.flag}
              />
              <EmergencyCallButton
                emoji="🚒"
                label="Gasilci"
                number={activeCountry.fire}
                countryFlag={activeCountry.flag}
              />
              <EmergencyCallButton
                emoji="🆘"
                label="Splošna številka"
                number={activeCountry.general}
                countryFlag={activeCountry.flag}
              />
            </div>

            {/* 112 is universal in EU - always show prominently */}
            {activeCountry.general === '112' && (
              <div className="mt-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-center">
                <p className="text-xs text-muted-foreground">🇪🇺 Evropska številka za nujne primere</p>
                <a href="tel:112" className="text-3xl font-black text-red-600 dark:text-red-400 hover:underline">
                  112
                </a>
                <p className="text-[10px] text-muted-foreground mt-0.5">Deluje v vseh državah EU</p>
              </div>
            )}
          </div>

          <Separator />

          {/* ─── ICE Contacts ──────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="size-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                ICE Kontakti
              </h3>
            </div>

            {iceContacts && (iceContacts.iceName1 || iceContacts.iceName2) ? (
              <div className="space-y-2">
                {/* Medical info */}
                {(iceContacts.bloodType || iceContacts.allergies) && (
                  <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Droplets className="size-5 text-red-500 flex-shrink-0" />
                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                        {iceContacts.bloodType && (
                          <Badge variant="outline" className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-bold">
                            🩸 {iceContacts.bloodType}
                          </Badge>
                        )}
                        {iceContacts.allergies && (
                          <Badge variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 text-[10px]">
                            ⚠️ {iceContacts.allergies}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ICE contact 1 */}
                {iceContacts.iceName1 && (
                  <IceContactRow
                    name={iceContacts.iceName1}
                    phone={iceContacts.icePhone1}
                    onShare={() => handleShareLocation(iceContacts.icePhone1)}
                  />
                )}

                {/* ICE contact 2 */}
                {iceContacts.iceName2 && (
                  <IceContactRow
                    name={iceContacts.iceName2}
                    phone={iceContacts.icePhone2}
                    onShare={() => handleShareLocation(iceContacts.icePhone2)}
                  />
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/50 border border-dashed border-border text-center">
                <Heart className="size-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Ni nastavljenih ICE kontaktov</p>
                <p className="text-[10px] text-muted-foreground/60">Nastavite v profilu za hitri klic v sili</p>
              </div>
            )}
          </div>

          <Separator />

          {/* ─── Location sharing ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="size-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                Deli lokacijo
              </h3>
            </div>

            {currentLat != null && currentLng != null ? (
              <div className="space-y-2">
                {/* Coordinates display */}
                <div className="p-3 rounded-xl bg-muted/50 border border-border font-mono text-sm text-center">
                  <span className="text-muted-foreground">Lat:</span>{' '}
                  <span className="font-bold">{currentLat.toFixed(6)}</span>
                  <span className="mx-2 text-muted-foreground">|</span>
                  <span className="text-muted-foreground">Lng:</span>{' '}
                  <span className="font-bold">{currentLng.toFixed(6)}</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={handleCopyLocation}
                  >
                    <Copy className="size-4" />
                    {locationCopied ? 'Kopirano!' : 'Kopiraj koordinate'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => handleShareLocation(null)}
                  >
                    <Share2 className="size-4" />
                    Deli lokacijo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-center">
                <MapPin className="size-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xs text-amber-600 dark:text-amber-400">Lokacija ni na voljo</p>
                <p className="text-[10px] text-muted-foreground">Vklopite GPS za deljenje lokacije</p>
              </div>
            )}
          </div>

          <Separator />

          {/* ─── Roadside assistance ───────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="size-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                Pomoč na cesti
              </h3>
              <span className="text-sm">{activeCountry.flag}</span>
            </div>

            <div className="space-y-2">
              {activeCountry.roadsideAssistance.map((service, i) => (
                <a
                  key={i}
                  href={`tel:${service.phone}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border hover:bg-secondary/50 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center justify-center size-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex-shrink-0">
                    <Wrench className="size-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{service.phone}</p>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500 flex-shrink-0">
                    <Phone className="size-4" />
                    <span className="text-[10px] font-bold uppercase">Pokliči</span>
                  </div>
                </a>
              ))}
            </div>

            {/* Other countries roadside assistance (collapsible) */}
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                🌍 Pomoč v drugih državah
              </summary>
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {BALKAN_EMERGENCY.filter(c => c.code !== activeCountry.code).map((country) => (
                  <div key={country.code} className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {country.flag} {country.nameSl}
                    </p>
                    {country.roadsideAssistance.map((service, i) => (
                      <a
                        key={`${country.code}-${i}`}
                        href={`tel:${service.phone}`}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30 border border-border/50 hover:bg-secondary/30 transition-colors"
                      >
                        <Wrench className="size-3 text-amber-500" />
                        <span className="text-xs font-medium flex-1">{service.name}</span>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{service.phone}</span>
                        <Phone className="size-3 text-amber-500" />
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          </div>

          <Separator />

          {/* ─── Emergency numbers for all Balkan countries (collapsible) ── */}
          <details>
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              📋 Vse klicne številke za Balkan
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Država</th>
                    <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">🚔</th>
                    <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">🚑</th>
                    <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">🚒</th>
                    <th className="text-center py-1.5 px-1 font-medium text-muted-foreground">🆘</th>
                  </tr>
                </thead>
                <tbody>
                  {BALKAN_EMERGENCY.map((c) => (
                    <tr
                      key={c.code}
                      className={`border-b border-border/50 ${c.code === activeCountry.code ? 'bg-red-50 dark:bg-red-950/20 font-bold' : ''}`}
                    >
                      <td className="py-1.5 px-2">
                        <span className="mr-1">{c.flag}</span>
                        {c.nameSl}
                      </td>
                      <td className="text-center py-1.5 px-1">
                        <a href={`tel:${c.police}`} className="text-red-600 dark:text-red-400 hover:underline">{c.police}</a>
                      </td>
                      <td className="text-center py-1.5 px-1">
                        <a href={`tel:${c.ambulance}`} className="text-red-600 dark:text-red-400 hover:underline">{c.ambulance}</a>
                      </td>
                      <td className="text-center py-1.5 px-1">
                        <a href={`tel:${c.fire}`} className="text-red-600 dark:text-red-400 hover:underline">{c.fire}</a>
                      </td>
                      <td className="text-center py-1.5 px-1">
                        <a href={`tel:${c.general}`} className="text-red-600 dark:text-red-400 hover:underline">{c.general}</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Footer note */}
          <p className="text-[10px] text-muted-foreground text-center pt-2">
            ⚠️ Klicne številke delujejo tudi brez internetne povezave. Pokličite 112 v katerikoli državi EU.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
