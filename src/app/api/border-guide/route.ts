import { NextResponse } from 'next/server'

// Balkan border crossing data for the Border Guide feature
// Provides documents, fees, wait times, and tips for motorcyclists

interface BorderCrossing {
  id: string
  from: string
  to: string
  fromCode: string
  toCode: string
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
  {
    id: 'si-hr-macelj',
    from: 'Slovenija', to: 'Hrvaška', fromCode: 'SI', toCode: 'HR',
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
    from: 'Slovenija', to: 'Hrvaška', fromCode: 'SI', toCode: 'HR',
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
  {
    id: 'si-hu-letsenye',
    from: 'Slovenija', to: 'Madžarska', fromCode: 'SI', toCode: 'HU',
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
  {
    id: 'hr-ba-brodsobinovci',
    from: 'Hrvaška', to: 'BiH', fromCode: 'HR', toCode: 'BA',
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
    from: 'Hrvaška', to: 'BiH', fromCode: 'HR', toCode: 'BA',
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
  {
    id: 'hr-me-debeli-brijeg',
    from: 'Hrvaška', to: 'Črna gora', fromCode: 'HR', toCode: 'ME',
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
  {
    id: 'me-al-sukobin',
    from: 'Črna gora', to: 'Albanija', fromCode: 'ME', toCode: 'AL',
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
  {
    id: 'rs-mk-presevo',
    from: 'Srbija', to: 'Severna Makedonija', fromCode: 'RS', toCode: 'MK',
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
  {
    id: 'bg-gr-kulata',
    from: 'Bolgarija', to: 'Grčija', fromCode: 'BG', toCode: 'GR',
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
  {
    id: 'ro-bg-vidin',
    from: 'Romunija', to: 'Bolgarija', fromCode: 'RO', toCode: 'BG',
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
  {
    id: 'rs-ba-sid',
    from: 'Srbija', to: 'BiH', fromCode: 'RS', toCode: 'BA',
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
  {
    id: 'si-at-sentilj',
    from: 'Slovenija', to: 'Avstrija', fromCode: 'SI', toCode: 'AT',
    name: 'Šentilj / Spielfeld (A1)',
    type: 'highway',
    documents: ['Osebna izkaznica ali potni list', 'Zavarovanje'],
    fees: [{ description: 'Avstrijska vinjeta', amount: '9.90', currency: 'EUR' }],
    waitTime: '5-15 min',
    restrictions: [],
    tips: ['AT vinjeta obvezna za avtoceste', 'Kupite na spletu ali na bencinskem pred mejo'],
    vignette: { required: true, price: '9.90 EUR/10 dni', duration: '10 dni', url: 'https://asfinag.at' },
    hours: '24h',
    gps: { lat: 46.6800, lng: 15.6500 },
  },
  {
    id: 'si-it-ratece',
    from: 'Slovenija', to: 'Italija', fromCode: 'SI', toCode: 'IT',
    name: 'Rateče / Fusine Laghi',
    type: 'road',
    documents: ['Osebna izkaznica ali potni list', 'Zavarovanje (zeleni karton)'],
    fees: [],
    waitTime: '5-10 min',
    restrictions: [],
    tips: ['Schengen meja - brez kontrolo', 'Odlična ruta za Julian Alps → Dolomiti'],
    hours: '24h',
    gps: { lat: 46.5000, lng: 13.7200 },
  },
  {
    id: 'hr-sr-backi-breg',
    from: 'Hrvaška', to: 'Srbija', fromCode: 'HR', toCode: 'RS',
    name: 'Bajakovo / Šid',
    type: 'highway',
    documents: ['Potni list', 'Zeleni karton'],
    fees: [],
    waitTime: '20-45 min',
    restrictions: [],
    tips: ['Kupite srbsko zavarovanje če nimate zelenega kartona', 'Avtocesta A3 → A1 proti Beogradu'],
    hours: '24h',
    gps: { lat: 45.0800, lng: 19.0400 },
  },
]

// Vignette summary for quick reference
const VIGNETTE_SUMMARY = [
  { country: 'Hrvaška', code: 'HR', required: true, price: '9.40 EUR/teden', url: 'https://hac.hr' },
  { country: 'Madžarska', code: 'HU', required: true, price: '~16 EUR/10 dni', url: 'https://ematrica.nemzetiutdij.hu' },
  { country: 'Avstrija', code: 'AT', required: true, price: '9.90 EUR/10 dni', url: 'https://asfinag.at' },
  { country: 'Bolgarija', code: 'BG', required: true, price: '~8 EUR/teden', url: 'https://bgtoll.bg' },
  { country: 'Severna Makedonija', code: 'MK', required: true, price: '~7 EUR/teden', url: '' },
  { country: 'Slovenija', code: 'SI', required: true, price: '15 EUR/mesec', url: 'https://evinjeta.dars.si' },
  { country: 'Srbija', code: 'RS', required: false, price: 'Cestnina po odsekih', url: '' },
  { country: 'Črna gora', code: 'ME', required: false, price: 'Cestnina po odsekih', url: '' },
  { country: 'BiH', code: 'BA', required: false, price: 'Brez vinjete', url: '' },
  { country: 'Albanija', code: 'AL', required: false, price: 'Brez vinjete', url: '' },
  { country: 'Grčija', code: 'GR', required: false, price: 'Cestnina po odsekih', url: '' },
  { country: 'Romunija', code: 'RO', required: true, price: '~4 EUR/teden', url: 'https://roviniete.ro' },
  { country: 'Italija', code: 'IT', required: false, price: 'Cestnina po odsekih', url: '' },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type')

  let results = BORDER_CROSSINGS

  if (from) {
    results = results.filter(c => c.fromCode.toLowerCase() === from.toLowerCase())
  }

  if (to) {
    results = results.filter(c => c.toCode.toLowerCase() === to.toLowerCase())
  }

  if (type && (type === 'highway' || type === 'road' || type === 'minor')) {
    results = results.filter(c => c.type === type)
  }

  return NextResponse.json({
    crossings: results,
    vignettes: VIGNETTE_SUMMARY,
    total: results.length,
  })
}
