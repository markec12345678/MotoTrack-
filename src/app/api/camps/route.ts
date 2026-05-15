import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function haversineKm(lat1: number, lon1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lng2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Seed camps - 15+ motorcycle-friendly campsites across the Balkans
const SEED_CAMPS = [
  { name: 'Kamp Adria', description: 'Kamp ob obali v Ankaranu z razgledom na Jadransko morje. Idealno izhodišče za obalne vožnje po Slovenski rivieri.', lat: 45.5880, lng: 13.7620, country: 'SI', address: 'Ankaran 12, 6280 Ankaran', phone: '+386 5 662 1200', website: 'https://kamp-adria.si', email: 'info@kamp-adria.si', rating: 4.5, priceRange: 'mid', amenities: JSON.stringify(['wifi', 'showers', 'kitchen', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'Apr-Oct' },
  { name: 'Kamp Zlatorog', description: 'Kamp ob Bohinjskem jezeru z razgledi na Julijske Alpe. Popolna baza za Vršič, Mangart in Soško dolino.', lat: 46.2980, lng: 13.8720, country: 'SI', address: 'Ukanc 57, 4265 Bohinjsko jezero', phone: '+386 4 572 3200', website: 'https://kamp-zlatorog.si', email: 'info@kamp-zlatorog.si', rating: 4.8, priceRange: 'mid', amenities: JSON.stringify(['wifi', 'showers', 'kitchen', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'May-Oct' },
  { name: 'Kamp Plitvice', description: 'Kamp v bližini narodnega parka Plitviška jezera. Narava, slapovi in odlične ceste za motoriste.', lat: 44.8650, lng: 15.5820, country: 'HR', address: 'Plitvička Jezera 1', phone: '+385 53 751 015', website: 'https://kamp-plitvice.hr', email: 'info@kamp-plitvice.hr', rating: 4.3, priceRange: 'mid', amenities: JSON.stringify(['wifi', 'showers', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'Apr-Oct' },
  { name: 'Kamp Krka', description: 'Kamp ob reki Krki pri Ločah. Mirna okolica z naravnimi bazeni in odličnimi cestami v okolici.', lat: 45.9450, lng: 15.2950, country: 'HR', address: 'Loče 15, 46000 Osijek', phone: '+385 31 280 100', website: 'https://kamp-krka.hr', email: 'info@kamp-krka.hr', rating: 4.0, priceRange: 'budget', amenities: JSON.stringify(['showers', 'kitchen', 'parking', 'water']), motoFriendly: true, openSeason: 'May-Sep' },
  { name: 'Kamp Bled', description: 'Kamp ob Blejskem jezeru s pogledom na otok in grad. Odlična izhodiščna točka za gorske prelaze.', lat: 46.3620, lng: 14.0950, country: 'SI', address: 'Cesta svobode 12, 4260 Bled', phone: '+386 4 574 1200', website: 'https://kamp-bled.si', email: 'info@kamp-bled.si', rating: 4.6, priceRange: 'premium', amenities: JSON.stringify(['wifi', 'showers', 'kitchen', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'Celo leto' },
  { name: 'Kamp Soča', description: 'Kamp ob Soči v Trenti z neposrednim dostopom do reke. Najlepša izhodiščna točka za Soško dolino.', lat: 46.3350, lng: 13.7520, country: 'SI', address: 'Trenta 22, 5230 Bovec', phone: '+386 5 388 1200', website: 'https://kamp-soca.si', email: 'info@kamp-soca.si', rating: 4.7, priceRange: 'mid', amenities: JSON.stringify(['wifi', 'showers', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'May-Oct' },
  { name: 'Kamp Vransko Jezero', description: 'Kamp ob Vranskem jezeru blizu Zadra. Ribolov, kolesarjenje in motoristične ceste v bližini.', lat: 43.8950, lng: 15.5780, country: 'HR', address: 'Vrana 5, 23211 Vransko Jezero', phone: '+385 23 385 010', website: 'https://kamp-vransko-jezero.hr', email: 'info@kamp-vransko.hr', rating: 4.1, priceRange: 'budget', amenities: JSON.stringify(['showers', 'parking', 'water', 'electricity']), motoFriendly: true, openSeason: 'Apr-Oct' },
  { name: 'Kamp Dubrovnik', description: 'Kamp v bližini Dubrovnika s pogledom na Elafitske otoke. Odličen za obalne vožnje po južni Dalmaciji.', lat: 42.6480, lng: 18.0940, country: 'HR', address: 'Solitudo bb, 20000 Dubrovnik', phone: '+385 20 442 120', website: 'https://kamp-dubrovnik.hr', email: 'info@kamp-dubrovnik.hr', rating: 4.4, priceRange: 'premium', amenities: JSON.stringify(['wifi', 'showers', 'kitchen', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'Apr-Oct' },
  { name: 'Kamp Kotor', description: 'Kamp v Kotorskem zalivu s pogledom na serpentine. Edinstvena lokacija za motoriste.', lat: 42.4560, lng: 18.7890, country: 'ME', address: 'Dobrota 25, 85330 Kotor', phone: '+382 32 315 010', website: 'https://kamp-kotor.me', email: 'info@kamp-kotor.me', rating: 4.5, priceRange: 'mid', amenities: JSON.stringify(['wifi', 'showers', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'May-Oct' },
  { name: 'Kamp Budva', description: 'Kamp ob Budvanski rivieri z mediteranskim vzdušjem. Blizu vijugastih obalnih cest.', lat: 42.2850, lng: 18.8400, country: 'ME', address: 'Becošći bb, 85310 Budva', phone: '+382 33 401 200', website: 'https://kamp-budva.me', email: 'info@kamp-budva.me', rating: 4.2, priceRange: 'budget', amenities: JSON.stringify(['showers', 'parking', 'water', 'kitchen']), motoFriendly: true, openSeason: 'May-Sep' },
  { name: 'Kamp Ohrid', description: 'Kamp ob Ohridskem jezeru s pogledom na vodno gladino in gorje. Ena najboljših lokacij v Makedoniji.', lat: 41.1250, lng: 20.8020, country: 'MK', address: 'Lagadin bb, 6000 Ohrid', phone: '+389 46 262 100', website: 'https://kamp-ohrid.mk', email: 'info@kamp-ohrid.mk', rating: 4.3, priceRange: 'budget', amenities: JSON.stringify(['showers', 'parking', 'water', 'electricity', 'kitchen']), motoFriendly: true, openSeason: 'May-Oct' },
  { name: 'Kamp Sarajevo', description: 'Kamp v bližini Sarajeva z dostopom do gorskih cest proti Ivan Sedlu in Bjelašnici.', lat: 43.8563, lng: 18.4131, country: 'BA', address: 'Ilidža bb, 71000 Sarajevo', phone: '+387 33 762 100', website: null, email: null, rating: 3.8, priceRange: 'budget', amenities: JSON.stringify(['showers', 'parking', 'water']), motoFriendly: true, openSeason: 'Celo leto' },
  { name: 'Kamp Tirana', description: 'Kamp na obrobju Tirane z dostopom do albanskih cest. Idealno za začetek raziskovanja Albanije.', lat: 41.3275, lng: 19.8187, country: 'AL', address: 'Rruga e Kavajës, Tirana', phone: '+355 4 222 100', website: null, email: null, rating: 3.5, priceRange: 'budget', amenities: JSON.stringify(['showers', 'parking', 'water', 'electricity']), motoFriendly: true, openSeason: 'Celo leto' },
  { name: 'Kamp Transfagarasan', description: 'Kamp ob vznožju Transfăgărășan z razgledi na Fagaraške gore. Popolna baza za legendarno cesto.', lat: 45.6100, lng: 24.6500, country: 'RO', address: 'Cârțișoara, Sibiu County', phone: '+40 269 552 100', website: 'https://kamp-transfagarasan.ro', email: 'info@kamp-transfagarasan.ro', rating: 4.4, priceRange: 'mid', amenities: JSON.stringify(['wifi', 'showers', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'Jun-Sep' },
  { name: 'Kamp Balaton', description: 'Kamp ob Blatnem jezeru z vinogradi in mediteranskim vzdušjem. Priljubljena motoristična destinacija.', lat: 46.9200, lng: 17.8800, country: 'HU', address: 'Balatonfüred, Veszprém', phone: '+36 87 342 100', website: 'https://kamp-balaton.hu', email: 'info@kamp-balaton.hu', rating: 4.2, priceRange: 'mid', amenities: JSON.stringify(['wifi', 'showers', 'kitchen', 'parking', 'electricity', 'water']), motoFriendly: true, openSeason: 'May-Sep' },
]

async function seedCamps() {
  try {
    const count = await db.campSite.count()
    if (count > 0) return // Already seeded

    for (const camp of SEED_CAMPS) {
      await db.campSite.create({ data: camp })
    }
    console.log(`Seeded ${SEED_CAMPS.length} camps`)
  } catch (error) {
    console.error('Camp seed error:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auto-seed if empty
    await seedCamps()

    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius = parseFloat(searchParams.get('radius') || '50')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (country) where.country = country

    let camps = await db.campSite.findMany({
      where,
      orderBy: { rating: 'desc' },
      take: limit * 3,
    })

    // Filter by distance if lat/lng provided
    if (lat && lng) {
      camps = camps.filter(c => haversineKm(lat, lng, c.lat, c.lng) <= radius)
    }

    const result = camps.slice(0, limit).map(c => ({
      ...c,
      amenities: c.amenities ? JSON.parse(c.amenities) : [],
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Camps fetch error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju kampov' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, lat, lng, country, address, phone, website, email, rating, priceRange, amenities, motoFriendly, openSeason } = body

    if (!name || !lat || !lng || !country) {
      return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })
    }

    const camp = await db.campSite.create({
      data: {
        name,
        description: description || null,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        country,
        address: address || null,
        phone: phone || null,
        website: website || null,
        email: email || null,
        rating: rating ? parseFloat(rating) : 0,
        priceRange: priceRange || null,
        amenities: amenities ? JSON.stringify(amenities) : null,
        motoFriendly: motoFriendly !== false,
        openSeason: openSeason || null,
      },
    })

    return NextResponse.json({ data: { ...camp, amenities: camp.amenities ? JSON.parse(camp.amenities) : [] } }, { status: 201 })
  } catch (error) {
    console.error('Camp create error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju kampa' }, { status: 500 })
  }
}
