import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Seed events - 15+ Balkan motorcycle events for 2025-2026
const SEED_EVENTS = [
  { title: 'Moto Srečanje Ljubljana 2025', description: 'Letno motoristično srečanje v Ljubljani z vožnjami po okoliških prelazih in druženjem.', date: new Date('2025-06-14'), endDate: new Date('2025-06-15'), lat: 46.0569, lng: 14.5058, location: 'Ljubljana, BTC', country: 'SI', category: 'meet', website: 'https://moto-ljubljana.si', organizerName: 'Moto Klub Ljubljana', contactEmail: 'info@moto-ljubljana.si', isFeatured: true, isPublic: true },
  { title: 'Adriatic Moto Rally', description: 'Mednarodni rally ob jadranski obali od Reke do Dubrovnika. 3 dni vožnje po najlepših obalnih cestah.', date: new Date('2025-07-04'), endDate: new Date('2025-07-06'), lat: 45.3271, lng: 14.4423, location: 'Rijeka, Hotel Continental', country: 'HR', category: 'rally', website: 'https://adriatic-moto-rally.hr', organizerName: 'HR Moto Club', contactEmail: 'rally@adriatic-moto.hr', isFeatured: true, isPublic: true },
  { title: 'Kotor Moto Fest', description: 'Festival motoristov v Kotorju s serpentinami, pogledi na Boko Kotorsko in zabavo ob morju.', date: new Date('2025-08-22'), endDate: new Date('2025-08-24'), lat: 42.4244, lng: 18.7712, location: 'Kotor, Stari Grad', country: 'ME', category: 'festival', website: 'https://kotor-moto-fest.me', organizerName: 'Kotor Riders', contactEmail: 'fest@kotor-moto.me', isFeatured: true, isPublic: true },
  { title: 'Transfagarasan Moto Meeting', description: 'Srečanje na legendarni Transfăgărăšan cesti. Skupinska vožnja na 2034m nadmorske višine.', date: new Date('2025-07-19'), endDate: new Date('2025-07-20'), lat: 45.5900, lng: 24.6200, location: 'Bâlea Lac, Făgăraș', country: 'RO', category: 'meet', website: 'https://transfagarasan-moto.ro', organizerName: 'Romania Moto Adventures', contactEmail: 'info@transfagarasan-moto.ro', isFeatured: true, isPublic: true },
  { title: 'Balkan Moto Tour', description: '7-dnevna turneja čez 5 držav Balkana: Slovenija, Hrvaška, Bosna, Črna gora, Albanija. Čudovite ceste in kultura.', date: new Date('2025-09-06'), endDate: new Date('2025-09-12'), lat: 46.0569, lng: 14.5058, location: 'Ljubljana (start)', country: 'SI', category: 'tour', website: 'https://balkan-moto-tour.com', organizerName: 'Balkan Moto Tours', contactEmail: 'tours@balkan-moto.com', isFeatured: true, isPublic: true },
  { title: 'Albanian Riviera Ride', description: 'Vožnja po albanski rivieri od Vlore do Sarande. Kristalno čisto morje in vijugaste ceste.', date: new Date('2025-06-28'), endDate: new Date('2025-06-29'), lat: 40.0500, lng: 19.7500, location: 'Vlorë, Albania', country: 'AL', category: 'tour', website: 'https://albania-riviera-ride.al', organizerName: 'Albania Riders', contactEmail: 'ride@albania-riders.al', isFeatured: false, isPublic: true },
  { title: 'Pannonia Moto Fest', description: 'Motoristični festival ob Blatnem jezeru z glasbo, hrano in skupinskimi vožnjami.', date: new Date('2025-08-09'), endDate: new Date('2025-08-10'), lat: 46.9000, lng: 17.9000, location: 'Balatonfüred, Hungary', country: 'HU', category: 'festival', website: 'https://pannonia-moto-fest.hu', organizerName: 'Pannonia Riders', contactEmail: 'fest@pannonia-moto.hu', isFeatured: false, isPublic: true },
  { title: 'Grossglockner Moto Day', description: 'Skupinska vožnja na Grossglockner - ena najbolj znanih gorskih cest v Evropi. Srečanje na vrhu.', date: new Date('2025-07-26'), lat: 47.0800, lng: 12.8300, location: 'Zell am See, Austria', country: 'AT', category: 'meet', website: 'https://glockner-moto-day.at', organizerName: 'Alpen Riders', contactEmail: 'day@glockner-moto.at', isFeatured: true, isPublic: true },
  { title: 'Bulgaria Moto Rally', description: 'Rally v Rodopih z vožnjami po gorskih prelazih in nočnim taborom pod zvezdami.', date: new Date('2025-08-02'), endDate: new Date('2025-08-03'), lat: 41.6500, lng: 24.6500, location: 'Pamporovo, Bulgaria', country: 'BG', category: 'rally', website: 'https://bulgaria-moto-rally.bg', organizerName: 'Bulgaria Moto Club', contactEmail: 'rally@bg-moto.bg', isFeatured: false, isPublic: true },
  { title: 'Greek Isles Moto Tour', description: 'Turneja po grških cestah od Aten do Meteore. Zgodovina, ceste in mediteranska hrana.', date: new Date('2025-09-20'), endDate: new Date('2025-09-23'), lat: 39.7200, lng: 21.6300, location: 'Meteora, Greece', country: 'GR', category: 'tour', website: 'https://greek-moto-tour.gr', organizerName: 'Hellenic Riders', contactEmail: 'tour@greek-riders.gr', isFeatured: false, isPublic: true },
  { title: 'Bosnian Mountain Ride', description: 'Vožnja po bosanskih gorah od Sarajeva do Jajca. Zgodovinski kraji in gorske ceste.', date: new Date('2025-07-12',), lat: 44.0500, lng: 17.5500, location: 'Jajce, BiH', country: 'BA', category: 'tour', website: null, organizerName: 'Bosnia Moto', contactEmail: null, isFeatured: false, isPublic: true },
  { title: 'Macedonia Lake Run', description: 'Vožnja ob Ohridskem jezeru s pogledom na gorje in starodavne cerkve.', date: new Date('2025-08-16'), lat: 41.1200, lng: 20.8000, location: 'Ohrid, Macedonia', country: 'MK', category: 'meet', website: null, organizerName: 'Macedonia Riders', contactEmail: null, isFeatured: false, isPublic: true },
  { title: 'Serbian Enduro Challenge', description: 'Enduro izziv v narodnem parku Tara. Terenske poti za izkušene motoriste.', date: new Date('2025-09-13',), endDate: new Date('2025-09-14'), lat: 43.9500, lng: 19.5500, location: 'Tara NP, Serbia', country: 'RS', category: 'race', website: null, organizerName: 'Serbia Enduro Club', contactEmail: null, isFeatured: false, isPublic: true },
  { title: 'Slovenian Alps Moto Meet', description: 'Srečanje v Kranjski Gori z vožnjami na Vršič, Mangart in Soško dolino.', date: new Date('2025-06-21'), endDate: new Date('2025-06-22'), lat: 46.4833, lng: 13.7833, location: 'Kranjska Gora', country: 'SI', category: 'meet', website: 'https://alps-moto-meet.si', organizerName: 'Moto Klub Alpe', contactEmail: 'alpe@moto-klub.si', isFeatured: false, isPublic: true },
  { title: 'Croatian Coast Cruise', description: 'Skupinska vožnja po D8 obalni cesti od Senja do Zadra. Najlepša obalna cesta Evrope.', date: new Date('2025-07-05'), endDate: new Date('2025-07-06'), lat: 44.1500, lng: 15.2000, location: 'Senj, Croatia', country: 'HR', category: 'tour', website: null, organizerName: 'Coastal Riders HR', contactEmail: null, isFeatured: false, isPublic: true },
  // 2026 events
  { title: 'Moto Srečanje Ljubljana 2026', description: 'Letno motoristično srečanje v Ljubljani z vožnjami po okoliških prelazih.', date: new Date('2026-06-13'), endDate: new Date('2026-06-14'), lat: 46.0569, lng: 14.5058, location: 'Ljubljana, BTC', country: 'SI', category: 'meet', website: 'https://moto-ljubljana.si', organizerName: 'Moto Klub Ljubljana', contactEmail: 'info@moto-ljubljana.si', isFeatured: false, isPublic: true },
  { title: 'Adriatic Moto Rally 2026', description: 'Drugo letno izdaja mednarodnega rallyja ob jadranski obali.', date: new Date('2026-07-03'), endDate: new Date('2026-07-05'), lat: 45.3271, lng: 14.4423, location: 'Rijeka', country: 'HR', category: 'rally', website: 'https://adriatic-moto-rally.hr', organizerName: 'HR Moto Club', contactEmail: 'rally@adriatic-moto.hr', isFeatured: false, isPublic: true },
]

async function seedEvents() {
  try {
    const count = await db.motoEvent.count()
    if (count > 0) return // Already seeded

    for (const event of SEED_EVENTS) {
      await db.motoEvent.create({ data: event })
    }
    console.log(`Seeded ${SEED_EVENTS.length} moto events`)
  } catch (error) {
    console.error('Event seed error:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auto-seed if empty
    await seedEvents()

    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const category = searchParams.get('category')
    const upcoming = searchParams.get('upcoming') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { isPublic: true }
    if (country) where.country = country
    if (category) where.category = category
    if (upcoming) where.date = { gte: new Date().toISOString() }

    const events = await db.motoEvent.findMany({
      where,
      orderBy: { date: 'asc' },
      take: limit,
    })

    return NextResponse.json({ data: events })
  } catch (error) {
    console.error('Events fetch error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju dogodkov' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, date, endDate, lat, lng, location, country, category, website, organizerName, contactEmail, createdBy } = body

    if (!title || !date || !lat || !lng || !location || !country) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    const event = await db.motoEvent.create({
      data: {
        title,
        description: description || null,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        location,
        country,
        category: category || 'meet',
        website: website || null,
        organizerName: organizerName || null,
        contactEmail: contactEmail || null,
        createdBy: createdBy || null,
      },
    })

    return NextResponse.json({ data: event }, { status: 201 })
  } catch (error) {
    console.error('Event create error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju dogodka' }, { status: 500 })
  }
}
