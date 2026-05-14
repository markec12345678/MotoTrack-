import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface BalkanMotoRoad {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  difficulty: 'easy' | 'moderate' | 'challenging' | 'extreme'
  roadType: 'asphalt' | 'mixed' | 'gravel'
  lengthKm: number
  country: string
  rating: number
}

// Curated motorcycle roads across the Balkans - Butler Maps equivalent
const BALKAN_ROADS: BalkanMotoRoad[] = [
  // === SLOVENIA ===
  { id: 'slo-1', name: 'Prelaz Vršič', description: '50 klancev, najzahtevnejši prelaz v Sloveniji. 50 ozkih ovinkov z velikim naklonom.', lat: 46.4333, lng: 13.7333, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 18, country: 'SI', rating: 5 },
  { id: 'slo-2', name: 'Prelaz Mangart', description: 'Najvišji cestni prelaz v Sloveniji (2072m). Osamljenost in razgledi na Julijske Alpe.', lat: 46.4500, lng: 13.6333, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 12, country: 'SI', rating: 5 },
  { id: 'slo-3', name: 'Prelaz Predel', description: 'Strme serpentine na italijanski meji. Klasična motoristična pot.', lat: 46.3833, lng: 13.5667, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 15, country: 'SI', rating: 4 },
  { id: 'slo-4', name: 'Jezersko - Preval', description: 'Zavite gorske ceste z odličnimi razgledi na Kamniške Alpe.', lat: 46.4000, lng: 14.8500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 22, country: 'SI', rating: 4 },
  { id: 'slo-5', name: 'Gorjanci', description: 'Krasne vijugaste ceste skozi gorjanske gozdove na meji s Hrvaško.', lat: 45.8000, lng: 15.1667, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'SI', rating: 4 },
  { id: 'slo-6', name: 'Col - Predmeja', description: 'Vijugaste ceste Notranjske, idealne za sproščeno vožnjo.', lat: 45.7500, lng: 14.2500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 18, country: 'SI', rating: 3 },
  { id: 'slo-7', name: 'Cerkno - Škofja Loka', description: 'Slikovite vijugaste ceste skozi Cerkno hribovje.', lat: 46.1167, lng: 14.0500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 35, country: 'SI', rating: 4 },
  { id: 'slo-8', name: 'Pohorje', description: 'Gozdne klance in razgledne ceste po Pohorju.', lat: 46.5000, lng: 15.5500, difficulty: 'moderate', roadType: 'mixed', lengthKm: 25, country: 'SI', rating: 3 },
  { id: 'slo-9', name: 'Soška dolina', description: 'Znamenita dolina reke Soče z vijugastimi cestami in razgledi na reko turkizno Sočo.', lat: 46.2500, lng: 13.6500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 40, country: 'SI', rating: 5 },

  // === CROATIA ===
  { id: 'hrv-1', name: 'Jadranska magistrala', description: 'Legendarna obalna cesta ob Jadranu z razgledi na otoke in modro morje.', lat: 43.5000, lng: 16.4500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 200, country: 'HR', rating: 5 },
  { id: 'hrv-2', name: 'Prelaz Mali Alan', description: 'Zavita gorska cesta skozi Velebit z razgledi na otoke.', lat: 44.4000, lng: 15.5000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 20, country: 'HR', rating: 5 },
  { id: 'hrv-3', name: 'Paklenica - Velebit', description: 'Gorska cesta skozi narodni park Paklenica z velikim višinskim zamahom.', lat: 44.3500, lng: 15.4500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'HR', rating: 4 },
  { id: 'hrv-4', name: 'Pelješac', description: 'Otoška cesta po polotoku Pelješac z vinogradi in razgledi na Korčulo.', lat: 42.9500, lng: 17.4500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 60, country: 'HR', rating: 4 },
  { id: 'hrv-5', name: 'Delnice - Gorski Kotar', description: 'Gozdne ceste Gorskega Kotarja, zelo priljubljene pri motoristih.', lat: 45.4000, lng: 14.8000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 40, country: 'HR', rating: 4 },

  // === BOSNIA & HERZEGOVINA ===
  { id: 'bih-1', name: 'Prelaz Ivan Sedlo', description: 'Gorski prelaz med Sarajevom in Konjicem z veličastnimi razgledi.', lat: 43.7000, lng: 18.0500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'BA', rating: 4 },
  { id: 'bih-2', name: 'Jablanica - Prozor', description: 'Vijugasta dolinska cesta ob Neretvi z razgledi na reko.', lat: 43.6500, lng: 17.3000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 45, country: 'BA', rating: 3 },
  { id: 'bih-3', name: 'Neum Obala', description: 'Obalna cesta ob edinem bosanskem morju.', lat: 42.9200, lng: 17.6100, difficulty: 'easy', roadType: 'asphalt', lengthKm: 15, country: 'BA', rating: 3 },

  // === MONTENEGRO ===
  { id: 'mne-1', name: 'Kotor Serpentine', description: 'Ena najbolj znanih motorističnih cest na svetu! 25 serpentin čez goro s pogledom na Boko Kotorsko.', lat: 42.4200, lng: 18.7700, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 16, country: 'ME', rating: 5 },
  { id: 'mne-2', name: 'Prelaz Lovćen', description: 'Gorski prelaz v narodnem parku Lovćen z razgledom na Kotorski zaliv.', lat: 42.3800, lng: 18.8500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 20, country: 'ME', rating: 5 },
  { id: 'mne-3', name: 'Durmitor - Žabljak', description: 'Visokogorska cesta v narodnem parku Durmitor z razgledi na ledeniška jezera.', lat: 43.1500, lng: 19.1200, difficulty: 'challenging', roadType: 'mixed', lengthKm: 35, country: 'ME', rating: 4 },
  { id: 'mne-4', name: 'Obala Budve', description: 'Obalna cesta od Budve do Svetega Stefana z mediteranskim vzdušjem.', lat: 42.2800, lng: 18.8400, difficulty: 'easy', roadType: 'asphalt', lengthKm: 20, country: 'ME', rating: 4 },

  // === SERBIA ===
  { id: 'srb-1', name: 'Prelaz Višegrad', description: 'Gorska cesta proti meji z Bosno z razgledi na reko Drino.', lat: 43.7800, lng: 19.2900, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'RS', rating: 3 },
  { id: 'srb-2', name: 'Zlatibor - Mokra Gora', description: 'Priljubljena motoristična pot skozi zahodno Srbijo s slikovitimi vasmi.', lat: 43.7200, lng: 19.7000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 45, country: 'RS', rating: 4 },
  { id: 'srb-3', name: 'Đerdap Klisura', description: 'Cesta ob Donavi skozi Đerdap klisuro - ena najlepših rečnih dolin v Evropi.', lat: 44.6100, lng: 22.3400, difficulty: 'easy', roadType: 'asphalt', lengthKm: 60, country: 'RS', rating: 4 },

  // === NORTH MACEDONIA ===
  { id: 'mkd-1', name: 'Ohridsko jezero', description: 'Obalna cesta ob Ohridskem jezeru z razgledi na vodno gladino in gore.', lat: 41.1200, lng: 20.8000, difficulty: 'easy', roadType: 'asphalt', lengthKm: 40, country: 'MK', rating: 4 },
  { id: 'mkd-2', name: 'Prelaz Gjavica', description: 'Visokogorski prelaz med Ohridom in Bitolo s serpentinami.', lat: 41.2000, lng: 20.6500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'MK', rating: 4 },

  // === ALBANIA ===
  { id: 'alb-1', name: 'Llogara Pass', description: 'Vzpon iz Vlore na 1027m z osupljivimi razgledi na Jonsko morje in otoke.', lat: 40.1800, lng: 19.5800, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 22, country: 'AL', rating: 5 },
  { id: 'alb-2', name: 'Obala Albanije (Riviera)', description: 'Podoben amalfijski obali - vijugasta cesta ob čistem Jonskem morju.', lat: 40.0500, lng: 19.7500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 80, country: 'AL', rating: 5 },
  { id: 'alb-3', name: 'Prelaz Theth', description: 'Osupljiva gorska cesta v severnoalbanskih Alpah. Nedotaknjena narava.', lat: 42.3800, lng: 19.7700, difficulty: 'extreme', roadType: 'gravel', lengthKm: 30, country: 'AL', rating: 5 },
  { id: 'alb-4', name: 'Valbona - Bajram Curri', description: 'Gorska dolina v albanskih Alpah z osupljivimi razgledi.', lat: 42.4500, lng: 19.9500, difficulty: 'challenging', roadType: 'mixed', lengthKm: 25, country: 'AL', rating: 4 },

  // === GREECE ===
  { id: 'grc-1', name: 'Prelaz Katara', description: 'Znameniti prelaz med Epirom in Tesalijo, legendaren med motoristi.', lat: 39.7700, lng: 21.2300, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 30, country: 'GR', rating: 5 },
  { id: 'grc-2', name: 'Peloponeška obala', description: 'Vijugaste obalne ceste Peloponeza z mediteranskim vzdušjem.', lat: 37.6000, lng: 22.8000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 80, country: 'GR', rating: 4 },

  // === BULGARIA ===
  { id: 'bgr-1', name: 'Prelaz Shipka', description: 'Zgodovinski prelaz čez Stara Planino z osupljivimi razgledi in spomenikom.', lat: 42.7100, lng: 25.3300, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'BG', rating: 4 },
  { id: 'bgr-2', name: 'Transbalkanska cesta', description: 'Čez gorski hrbet Stara Planina, zelo priljubljena pri motoristih.', lat: 42.7500, lng: 25.1000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 50, country: 'BG', rating: 4 },

  // === ROMANIA ===
  { id: 'rou-1', name: 'Transfăgărășan', description: 'Ena najbolj znanih cest na svetu! 90 km ovinkov čez Fagaraške gore do 2034m. DN7C.', lat: 45.5900, lng: 24.6200, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 90, country: 'RO', rating: 5 },
  { id: 'rou-2', name: 'Transalpina (DN67C)', description: 'Najvišja cesta v Romuniji (2145m) z osupljivimi gorskimi razgledi. Bolj divja od Transfăgărășan.', lat: 45.4300, lng: 23.7200, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 80, country: 'RO', rating: 5 },
  { id: 'rou-3', name: 'Transbucegi', description: 'Gorska cesta v Bucegi gorah z razgledi na dolino Prahove.', lat: 45.4000, lng: 25.4300, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'RO', rating: 4 },

  // === HUNGARY ===
  { id: 'hun-1', name: 'Visegrádi-hegység', description: 'Vijugaste ceste po gričevju nad Donavo z razgledi na reko.', lat: 47.7800, lng: 18.9700, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 25, country: 'HU', rating: 3 },
  { id: 'hun-2', name: 'Balatonska obala', description: 'Obalna cesta ob Blatnem jezeru z vinogradi in mediteranskim vzdušjem.', lat: 46.9000, lng: 17.9000, difficulty: 'easy', roadType: 'asphalt', lengthKm: 60, country: 'HU', rating: 3 },

  // === AUSTRIA ===
  { id: 'aut-1', name: 'Grossglockner Hochalpenstraße', description: 'Ena najbolj znanih gorskih cest v Evropi. 48 km s 36 ovinki do 2504m.', lat: 47.0800, lng: 12.8300, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 48, country: 'AT', rating: 5 },
  { id: 'aut-2', name: 'Nockalmstraße', description: 'Vijugasta alpska cesta v Koroški z razgledi na Nockberge.', lat: 46.9000, lng: 13.7000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 34, country: 'AT', rating: 4 },
  { id: 'aut-3', name: 'Villacher Alpenstraße', description: 'Alpska cesta nad Villachom z razgledi na Julijske Alpe in Karavanke.', lat: 46.6000, lng: 13.7000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 16, country: 'AT', rating: 4 },

  // === NEW ROADS (10 additional) ===
  // Slovenia - Ljubelj Pass
  { id: 'slo-10', name: 'Prelaz Ljubelj', description: 'Zgodovinski prelaz na avstrijski meji z ozkim predorom in strmimi klanci. Najstarejši cestni prelaz v Sloveniji.', lat: 46.4320, lng: 14.2640, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 14, country: 'SI', rating: 4 },
  // Slovenia - Črni vrh
  { id: 'slo-11', name: 'Črni vrh', description: 'Vijugasta cesta nad Idrijo z razgledi na Idrijsko hribovje in cerkvico na vrhu.', lat: 46.0500, lng: 13.9800, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 20, country: 'SI', rating: 4 },
  // Croatia - D8 Coastal Road
  { id: 'hrv-6', name: 'D8 Obalna cesta (Senj-Zadar)', description: 'Legendarna obalna cesta D8 med Senjom in Zadrom. Razgledi na Velebit in morje.', lat: 44.1500, lng: 15.2000, difficulty: 'easy', roadType: 'asphalt', lengthKm: 110, country: 'HR', rating: 5 },
  // Croatia - Učka Pass
  { id: 'hrv-7', name: 'Prelaz Učka', description: 'Gorski prelaz čez Učko gorovje z osupljivimi razgledi na Kvarner in otoke.', lat: 45.3100, lng: 14.2200, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 18, country: 'HR', rating: 4 },
  // Montenegro - Piva Canyon Road
  { id: 'mne-5', name: 'Pivska klisura', description: 'Vijugasta cesta skozi veličastno Pivsko klisuro ob modrem Pivskem jezeru. Ena najlepših cest v Črni gori.', lat: 43.0500, lng: 18.9500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 45, country: 'ME', rating: 5 },
  // Albania - SH21 Theth-Valbona
  { id: 'alb-5', name: 'SH21 Theth-Valbona', description: 'Novo zgrajena gorska cesta med Theth in Valbono v albanskih Alpah. Osamljenost in razgledi.', lat: 42.4000, lng: 19.8300, difficulty: 'extreme', roadType: 'mixed', lengthKm: 28, country: 'AL', rating: 5 },
  // Romania - Bucegi Mountains Road
  { id: 'rou-4', name: 'Bucegi gorska cesta', description: 'Gorska cesta v Bucegi gorah z razgledom na Babele in Sfinx skalne formacije.', lat: 45.3800, lng: 25.4700, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 30, country: 'RO', rating: 4 },
  // Bulgaria - Rhodope Mountains Road
  { id: 'bgr-3', name: 'Rodopska gorska cesta', description: 'Čudovita cesta skozi Rodope z gostimi gozdovi, razgledi in tradicionalnimi vasmi.', lat: 41.6500, lng: 24.6500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 55, country: 'BG', rating: 4 },
  // Greece - Meteora Road
  { id: 'grc-3', name: 'Meteora cesta', description: 'Cesta do samostanov Meteora - monumentalne skale s samostani na vrhu. Enkraten prizor.', lat: 39.7200, lng: 21.6300, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 15, country: 'GR', rating: 5 },
  // Serbia - Tara National Park Road
  { id: 'srb-4', name: 'Tara - Narodni park', description: 'Gozdna cesta skozi narodni park Tara z razgledi na Drinsko klisuro.', lat: 43.9500, lng: 19.5500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 35, country: 'RS', rating: 4 },
  // Bosnia - Jajce-Travnik Mountain Road
  { id: 'bih-4', name: 'Jajce - Travnik gorska cesta', description: 'Vijugasta gorska cesta med Jajce in Travnikom skozi osrednjobosansko hribovje.', lat: 44.0500, lng: 17.5500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 40, country: 'BA', rating: 4 },
]

const countryNames: Record<string, string> = {
  SI: 'Slovenija', HR: 'Hrvaška', BA: 'Bosna in Hercegovina', ME: 'Črna gora',
  RS: 'Srbija', MK: 'Severna Makedonija', AL: 'Albanija', GR: 'Grčija',
  BG: 'Bolgarija', RO: 'Romunija', HU: 'Madžarska', AT: 'Avstrija',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const difficulty = searchParams.get('difficulty')

    let roads = [...BALKAN_ROADS]

    if (country) {
      roads = roads.filter(r => r.country === country.toUpperCase())
    }
    if (difficulty) {
      roads = roads.filter(r => r.difficulty === difficulty)
    }

    // Add country name to each road
    const result = roads.map(r => ({
      ...r,
      countryName: countryNames[r.country] || r.country,
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Balkan roads error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
