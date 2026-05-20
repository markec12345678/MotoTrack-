'use client'

import React, { useState, useMemo } from 'react'
import {
  X,
  MapPin,
  Clock,
  FileText,
  Car,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Globe,
  CreditCard,
  Shield,
  Phone,
} from 'lucide-react'

// ===== BALKAN BORDER CROSSING GUIDE =====
// Essential info for motorcyclists crossing borders in the Balkans
// Documents needed, wait times, fees, restrictions

interface BorderCrossing {
  id: string
  from: string
  to: string
  fromFlag: string
  toFlag: string
  name: string
  type: 'road' | 'highway' | 'minor'
  documents: string[]
  fees: { description: string; amount: string; currency: string }[]
  waitTime: string
  restrictions: string[]
  tips: string[]
  vignette?: { required: boolean; price?: string; duration?: string; url?: string }
  phone?: string
  hours: string
  gps?: { lat: number; lng: number }
}

const BORDER_CROSSINGS: BorderCrossing[] = [
  // Slovenia - Croatia
  {
    id: 'si-hr-macelj',
    from: 'Slovenija', to: 'Hrvaška', fromFlag: '🇸🇮', toFlag: '🇭🇷',
    name: 'Macelj (A2)',
    type: 'highway',
    documents: ['Osebna izkaznica ali potni list', 'Prometna dovoljenja', 'Zavarovanje (zeleni karton ali HR zavarovanje)'],
    fees: [{ description: 'Avtocestna vinjeta HR', amount: '9.40', currency: 'EUR' }],
    waitTime: '15-45 min (poletni vikendi: 1-2h)',
    restrictions: [],
    tips: ['Kupite HR vinjeto na prvem bencinskem po meji', 'V sezonah se izogibajte sobotnim dopoldnevom'],
    vignette: { required: true, price: '9.40 EUR/teden', duration: '1 teden', url: 'https://hac.hr' },
    hours: '24h',
    gps: { lat: 46.3280, lng: 15.7850 },
  },
  {
    id: 'si-hr-gruskovje',
    from: 'Slovenija', to: 'Hrvaška', fromFlag: '🇸🇮', toFlag: '🇭🇷',
    name: 'Gruškovje',
    type: 'road',
    documents: ['Osebna izkaznica ali potni list', 'Zavarovanje'],
    fees: [],
    waitTime: '5-15 min',
    restrictions: [],
    tips: ['Manj prometa kot Macelj', 'Primerno za lokalne rute'],
    hours: '24h',
    gps: { lat: 46.2570, lng: 16.0350 },
  },
  // Slovenia - Hungary
  {
    id: 'si-hu-letsenye',
    from: 'Slovenija', to: 'Madžarska', fromFlag: '🇸🇮', toFlag: '🇭🇺',
    name: 'Letenye (M7)',
    type: 'highway',
    documents: ['Potni list (priporočljiv)', 'Zavarovanje (zeleni karton)'],
    fees: [{ description: 'Madžarska vinjeta', amount: '6400', currency: 'HUF (~16 EUR)' }],
    waitTime: '5-20 min',
    restrictions: [],
    tips: ['HU vinjeta obvezna za avtoceste', 'Lahko kupite na spletu pred potjo'],
    vignette: { required: true, price: '~16 EUR/10 dni', duration: '10 dni', url: 'https://ematrica.nemzetiutdij.hu' },
    hours: '24h',
    gps: { lat: 46.6400, lng: 16.6800 },
  },
  // Croatia - Bosnia
  {
    id: 'hr-ba-brodsobinovci',
    from: 'Hrvaška', to: 'BiH', fromFlag: '🇭🇷', toFlag: '🇧🇦',
    name: 'Brod / Brod (A3)',
    type: 'highway',
    documents: ['Potni list (OBAVEZEN za BiH!)', 'Zeleni karton', 'Prometna dovoljenja'],
    fees: [],
    waitTime: '30-60 min',
    restrictions: ['Osebna izkaznica NI dovoljena za BiH!', 'Potni list obvezen'],
    tips: ['Potni list MORA biti veljaven vsaj 3 mesece po vstopu', 'Zeleni karton obvezen - preverite veljavnost!'],
    hours: '24h',
    gps: { lat: 45.1650, lng: 18.0250 },
  },
  {
    id: 'hr-ba-metkovic',
    from: 'Hrvaška', to: 'BiH', fromFlag: '🇭🇷', toFlag: '🇧🇦',
    name: 'Metković',
    type: 'road',
    documents: ['Potni list', 'Zeleni karton'],
    fees: [],
    waitTime: '15-30 min',
    restrictions: ['Potni list obvezen'],
    tips: ['Primerno za Pelješac → Mostar ruto', 'Krajše čakanje kot Brod'],
    hours: '24h',
    gps: { lat: 43.0500, lng: 17.6500 },
  },
  // Croatia - Montenegro
  {
    id: 'hr-me-debeli-brijeg',
    from: 'Hrvaška', to: 'Črna gora', fromFlag: '🇭🇷', toFlag: '🇲🇪',
    name: 'Debeli Brijeg / Karasovići',
    type: 'highway',
    documents: ['Osebna izkaznica ali potni list', 'Zeleni karton'],
    fees: [{ description: 'Cestnina Črna gora (avtocesta)', amount: '3.50', currency: 'EUR' }],
    waitTime: '30-90 min (sezona!)',
    restrictions: [],
    tips: ['V poletni sezoni zelo dolgo čakanje!', 'Odhod zjutraj pred 6:00 = brez čakanja', 'Zeleni karton obvezen za ME'],
    hours: '24h',
    gps: { lat: 42.4900, lng: 18.9300 },
  },
  // Montenegro - Albania
  {
    id: 'me-al-sukobin',
    from: 'Črna gora', to: 'Albanija', fromFlag: '🇲🇪', toFlag: '🇦🇱',
    name: 'Sukobin / Muriqan',
    type: 'road',
    documents: ['Potni list', 'Zeleni karton ali albansko zavarovanje na meji'],
    fees: [{ description: 'Albansko zavarovanje (če nimate zelenega kartona)', amount: '15-25', currency: 'EUR' }],
    waitTime: '15-45 min',
    restrictions: ['Zeleni karton ALI nakup lokalnega zavarovanja'],
    tips: ['Zavarovanje lahko kupite na meji', 'Ceste v AL so slabše kvalitete - previdno!', 'Nimate zelenega kartona? Kupite na meji za ~20 EUR'],
    hours: '24h',
    gps: { lat: 42.0800, lng: 19.4000 },
  },
  // Serbia - North Macedonia
  {
    id: 'rs-mk-presevo',
    from: 'Srbija', to: 'Severna Makedonija', fromFlag: '🇷🇸', toFlag: '🇲🇰',
    name: 'Preševo / Tabanovce',
    type: 'highway',
    documents: ['Osebna izkaznica ali potni list', 'Zeleni karton'],
    fees: [{ description: 'Makedonska vinjeta', amount: '7', currency: 'EUR' }],
    waitTime: '15-30 min',
    restrictions: [],
    tips: ['MK vinjeta obvezna za avtoceste', 'Kupite na prvem bencinskem po meji'],
    vignette: { required: true, price: '~7 EUR/teden', duration: '1 teden' },
    hours: '24h',
    gps: { lat: 42.3500, lng: 21.9500 },
  },
  // Bulgaria - Greece
  {
    id: 'bg-gr-kulata',
    from: 'Bolgarija', to: 'Grčija', fromFlag: '🇧🇬', toFlag: '🇬🇷',
    name: 'Kulata / Promachonas',
    type: 'highway',
    documents: ['Osebna izkaznica ali potni list', 'Zeleni karton'],
    fees: [],
    waitTime: '10-30 min',
    restrictions: [],
    tips: ['EU meja - enostaven prehod', 'Grške ceste so odlične za motoriste'],
    hours: '24h',
    gps: { lat: 41.3800, lng: 23.4400 },
  },
  // Romania - Bulgaria
  {
    id: 'ro-bg-vidin',
    from: 'Romunija', to: 'Bolgarija', fromFlag: '🇷🇴', toFlag: '🇧🇬',
    name: 'Vidin / Calafat (most)',
    type: 'highway',
    documents: ['Potni list', 'Zeleni karton', 'BG vinjeta'],
    fees: [{ description: 'Bolgarska vinjeta', amount: '15', currency: 'BGN (~8 EUR)' }, { description: 'Mostnina', amount: '6', currency: 'EUR' }],
    waitTime: '15-30 min',
    restrictions: [],
    tips: ['Nov most - enostaven prehod', 'BG vinjeta obvezna!'],
    vignette: { required: true, price: '~8 EUR/teden', duration: '1 teden', url: 'https://bgtoll.bg' },
    hours: '24h',
    gps: { lat: 43.9900, lng: 22.8700 },
  },
  // Serbia - Bosnia
  {
    id: 'rs-ba-sid',
    from: 'Srbija', to: 'BiH', fromFlag: '🇷🇸', toFlag: '🇧🇦',
    name: 'Šid / Šamac',
    type: 'highway',
    documents: ['Potni list', 'Zeleni karton'],
    fees: [],
    waitTime: '15-30 min',
    restrictions: ['Potni list obvezen za BiH'],
    tips: ['Potni list MORA biti veljaven!', 'Preverite zeleni karton pred potjo'],
    hours: '24h',
    gps: { lat: 45.1300, lng: 19.2300 },
  },
]

interface BorderGuideProps {
  isOpen: boolean
  onClose: () => void
  currentCountry?: string
}

export default function BorderGuide({
  isOpen,
  onClose,
  currentCountry,
}: BorderGuideProps) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'highway' | 'road'>('all')

  const filteredCrossings = useMemo(() => {
    let results = BORDER_CROSSINGS
    if (filterType !== 'all') {
      results = results.filter(c => c.type === filterType)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.from.toLowerCase().includes(q) ||
        c.to.toLowerCase().includes(q)
      )
    }
    return results
  }, [search, filterType])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Mejni prehodi Balkan</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Išči po državah ali prehodih..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />

          {/* Filter */}
          <div className="flex items-center gap-2">
            {(['all', 'highway', 'road'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterType === type
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {type === 'all' ? 'Vsi' : type === 'highway' ? 'Avtocesta' : 'Lokalna cesta'}
              </button>
            ))}
          </div>

          {/* Important notice */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Pomembno:</strong> Za BiH je potni list OBAVEZEN (osebna izkaznica ni dovoljena!). 
              Zeleni karton je obvezen za vse ne-EU države. Preverite veljavnost dokumentov pred potjo!
            </p>
          </div>

          {/* Border crossings list */}
          <div className="space-y-2">
            {filteredCrossings.map(crossing => (
              <div
                key={crossing.id}
                className="rounded-xl border border-border/50 overflow-hidden"
              >
                {/* Summary row */}
                <button
                  onClick={() => setExpanded(expanded === crossing.id ? null : crossing.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-xl">{crossing.fromFlag}→{crossing.toFlag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{crossing.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        crossing.type === 'highway' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {crossing.type === 'highway' ? 'Avtocesta' : 'Lokalna'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{crossing.hours}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    <span>{crossing.waitTime.split(' ')[0]}</span>
                  </div>
                  {expanded === crossing.id ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </button>

                {/* Expanded details */}
                {expanded === crossing.id && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                    {/* Documents */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <FileText className="size-3" /> Dokumenti
                      </h4>
                      <ul className="space-y-1">
                        {crossing.documents.map((doc, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{doc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Restrictions */}
                    {crossing.restrictions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="size-3" /> Omejitve
                        </h4>
                        <ul className="space-y-1">
                          {crossing.restrictions.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                              <span className="mt-0.5">⚠️</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Fees */}
                    {crossing.fees.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <CreditCard className="size-3" /> Stroški
                        </h4>
                        {crossing.fees.map((fee, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span>{fee.description}</span>
                            <span className="font-bold">{fee.amount} {fee.currency}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Vignette */}
                    {crossing.vignette?.required && (
                      <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Car className="size-3" /> Vinjeta obvezna
                        </h4>
                        <p className="text-xs">{crossing.vignette.price} ({crossing.vignette.duration})</p>
                        {crossing.vignette.url && (
                          <a
                            href={crossing.vignette.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline"
                          >
                            Kupi na spletu →
                          </a>
                        )}
                      </div>
                    )}

                    {/* Wait time */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Clock className="size-3" /> Čakalna doba
                      </h4>
                      <p className="text-xs">{crossing.waitTime}</p>
                    </div>

                    {/* Tips */}
                    <div>
                      <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        💡 Nasveti
                      </h4>
                      <ul className="space-y-1">
                        {crossing.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                            <span className="mt-0.5">✓</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Phone */}
                    {crossing.phone && (
                      <a
                        href={`tel:${crossing.phone}`}
                        className="flex items-center gap-2 text-xs text-primary"
                      >
                        <Phone className="size-3" />
                        {crossing.phone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredCrossings.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Ni najdenih prehodov za &quot;{search}&quot;
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
