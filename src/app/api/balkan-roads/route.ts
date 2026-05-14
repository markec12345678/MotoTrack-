import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface BalkanRoad {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  roadType: string
  lengthKm: number
  country: string
  rating: number
}

const BALKAN_ROADS: BalkanRoad[] = [
  // === SLOVENIA ===
  {
    id: 'si-01',
    name: 'Vršič Pass',
    description: 'The highest mountain pass in Slovenia with 50 hairpin turns, including 24 cobblestone switchbacks on the eastern side. Spectacular Julian Alps scenery.',
    lat: 46.4358,
    lng: 13.7525,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 32,
    country: 'SI',
    rating: 4.9,
  },
  {
    id: 'si-02',
    name: 'Mangart Saddle (Mangartsko Sedlo)',
    description: 'The highest road in Slovenia at 2,072m. Paved road with stunning views of the Mangart peak and the Soča Valley. A must-ride for any motorcyclist.',
    lat: 46.3844,
    lng: 13.6478,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 12,
    country: 'SI',
    rating: 4.8,
  },
  {
    id: 'si-03',
    name: 'Soča Valley Road',
    description: 'Follows the emerald Soča River from Bovec to Kobarid. Beautiful valley riding with winding roads alongside one of Europe\'s most beautiful rivers.',
    lat: 46.2864,
    lng: 13.6519,
    difficulty: 'medium',
    roadType: 'valley',
    lengthKm: 40,
    country: 'SI',
    rating: 4.7,
  },

  // === CROATIA ===
  {
    id: 'hr-01',
    name: 'Adriatic Highway (Jadranska Magistrala)',
    description: 'The legendary coastal road along the Croatian Adriatic. Stunning sea views, winding roads through charming coastal towns, and islands visible across the water.',
    lat: 43.5081,
    lng: 16.4402,
    difficulty: 'medium',
    roadType: 'coastal',
    lengthKm: 180,
    country: 'HR',
    rating: 4.9,
  },
  {
    id: 'hr-02',
    name: 'Senj to Karlobag Coast Road',
    description: 'Dramatic coastal riding on the Velebit mountainside with sheer drops to the sea. One of the most scenic stretches of the Adriatic coast.',
    lat: 44.7053,
    lng: 14.8858,
    difficulty: 'medium',
    roadType: 'coastal',
    lengthKm: 45,
    country: 'HR',
    rating: 4.7,
  },
  {
    id: 'hr-03',
    name: 'Lika Mountain Roads',
    description: 'Interior roads through Lika region with rolling hills, forests, and open sweepers. Great alternative to the busy coast with minimal traffic.',
    lat: 44.8666,
    lng: 15.5833,
    difficulty: 'easy',
    roadType: 'countryside',
    lengthKm: 80,
    country: 'HR',
    rating: 4.3,
  },
  {
    id: 'hr-04',
    name: 'Pelješac Peninsula',
    description: 'Beautiful peninsula road with vineyards, sea views, and the dramatic stretch to the tip at Lovište. Great combination of scenery and curves.',
    lat: 42.9833,
    lng: 17.1833,
    difficulty: 'easy',
    roadType: 'coastal',
    lengthKm: 65,
    country: 'HR',
    rating: 4.5,
  },

  // === BOSNIA & HERZEGOVINA ===
  {
    id: 'ba-01',
    name: 'Mostar to Jablanica (Neretva Canyon)',
    description: 'Stunning road following the Neretva River through a dramatic canyon. Lush green cliffs and the famous emerald river create an unforgettable ride.',
    lat: 43.3438,
    lng: 17.8078,
    difficulty: 'medium',
    roadType: 'canyon',
    lengthKm: 35,
    country: 'BA',
    rating: 4.6,
  },
  {
    id: 'ba-02',
    name: 'Prokoško Lake Road',
    description: 'Mountain road leading to the beautiful Prokoško Lake on Vranica mountain. Challenging terrain with rewarding alpine scenery.',
    lat: 44.0833,
    lng: 17.5833,
    difficulty: 'hard',
    roadType: 'mountain',
    lengthKm: 25,
    country: 'BA',
    rating: 4.4,
  },
  {
    id: 'ba-03',
    name: 'Jajce to Travnik via Vlašić',
    description: 'Mountain road through central Bosnia passing near Vlašić mountain. Beautiful forests and traditional Bosnian villages along the way.',
    lat: 44.2667,
    lng: 17.5000,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 55,
    country: 'BA',
    rating: 4.3,
  },

  // === MONTENEGRO ===
  {
    id: 'me-01',
    name: 'Kotor Serpentine (Kotor-Lovćen)',
    description: 'The famous 25+ hairpin switchbacks climbing from Kotor Bay to the Lovćen mountain plateau. One of the most photographed motorcycle roads in Europe.',
    lat: 42.4167,
    lng: 18.7667,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 22,
    country: 'ME',
    rating: 5.0,
  },
  {
    id: 'me-02',
    name: 'Durmitor Ring (Žabljak - Plužine)',
    description: 'Spectacular circuit around the Durmitor massif with dramatic canyon views, tunnel passages, and pristine mountain lakes.',
    lat: 43.1500,
    lng: 19.1167,
    difficulty: 'hard',
    roadType: 'mountain',
    lengthKm: 85,
    country: 'ME',
    rating: 4.9,
  },
  {
    id: 'me-03',
    name: 'Tara Canyon Road',
    description: 'Road along the deepest canyon in Europe. The Tara River canyon is 1,300m deep and the road offers breathtaking views of this natural wonder.',
    lat: 43.1500,
    lng: 19.3500,
    difficulty: 'medium',
    roadType: 'canyon',
    lengthKm: 40,
    country: 'ME',
    rating: 4.7,
  },

  // === SERBIA ===
  {
    id: 'rs-01',
    name: 'Zlatibor to Mokra Gora (Šargan Eight)',
    description: 'Famous winding road near the Šargan Eight narrow-gauge railway. Beautiful mountain scenery with dense forests and traditional wooden villages.',
    lat: 43.7500,
    lng: 19.8167,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 45,
    country: 'RS',
    rating: 4.6,
  },
  {
    id: 'rs-02',
    name: 'Đerdap Gorge (Iron Gates)',
    description: 'Road along the Danube through the dramatic Iron Gates gorge on the Serbian-Romanian border. The river narrows to just 150m between towering cliffs.',
    lat: 44.6167,
    lng: 22.3500,
    difficulty: 'easy',
    roadType: 'canyon',
    lengthKm: 100,
    country: 'RS',
    rating: 4.5,
  },
  {
    id: 'rs-03',
    name: 'Homolje Mountains',
    description: 'Hidden gem in eastern Serbia with excellent twisty roads through the Homolje mountains. Low traffic, great pavement, and stunning rural scenery.',
    lat: 44.3333,
    lng: 21.7667,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 60,
    country: 'RS',
    rating: 4.4,
  },

  // === NORTH MACEDONIA ===
  {
    id: 'mk-01',
    name: 'Ohrid to Bitola via Galichica',
    description: 'Mountain pass road through Galichica National Park connecting Lake Ohrid and Lake Prespa. Panoramic views of both lakes from 1,500m altitude.',
    lat: 41.0500,
    lng: 20.8500,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 55,
    country: 'MK',
    rating: 4.8,
  },
  {
    id: 'mk-02',
    name: 'Krushevo Road',
    description: 'Road to the highest town in the Balkans (1,350m). Winding mountain road with spectacular views and the historic town of Krushevo at the top.',
    lat: 41.3667,
    lng: 21.2500,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 30,
    country: 'MK',
    rating: 4.5,
  },
  {
    id: 'mk-03',
    name: 'Mavrovo to Debar',
    description: 'Road through Mavrovo National Park with the submerged church in the lake, dense forests, and dramatic mountain scenery all the way to Debar.',
    lat: 41.6000,
    lng: 20.7167,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 40,
    country: 'MK',
    rating: 4.5,
  },

  // === ALBANIA ===
  {
    id: 'al-01',
    name: 'Llogara Pass',
    description: 'Spectacular mountain pass at 1,027m on the Albanian Riviera. Hairpin turns with jaw-dropping views of the Ionian Sea. A true motorcycling paradise.',
    lat: 40.2000,
    lng: 19.5833,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 25,
    country: 'AL',
    rating: 4.9,
  },
  {
    id: 'al-02',
    name: 'SH20 Theth Road',
    description: 'Dramatic road into the Albanian Alps (Accursed Mountains). Recently paved, it winds through some of the most spectacular mountain scenery in Europe.',
    lat: 42.3500,
    lng: 19.7500,
    difficulty: 'expert',
    roadType: 'mountain',
    lengthKm: 30,
    country: 'AL',
    rating: 4.8,
  },
  {
    id: 'al-03',
    name: 'Vjosa Valley',
    description: 'Road along Europe\'s last wild river through southern Albania. Unspoiled nature, traditional villages, and a road that follows the river\'s winding path.',
    lat: 40.4833,
    lng: 20.4333,
    difficulty: 'medium',
    roadType: 'valley',
    lengthKm: 70,
    country: 'AL',
    rating: 4.5,
  },
  {
    id: 'al-04',
    name: 'Albanian Riviera Coast Road',
    description: 'Stunning coastal road from Vlorë to Sarandë along the Ionian Sea. Crystal clear water visible from twisty mountain roads. A Mediterranean gem.',
    lat: 40.1000,
    lng: 19.7000,
    difficulty: 'medium',
    roadType: 'coastal',
    lengthKm: 90,
    country: 'AL',
    rating: 4.8,
  },

  // === GREECE ===
  {
    id: 'gr-01',
    name: 'Vikos Gorge Road (Zagorochoria)',
    description: 'Road through the Zagori region in Epirus with views of Vikos Gorge, the deepest gorge in the world relative to its width. Stone bridges and alpine villages.',
    lat: 39.9500,
    lng: 20.7500,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 50,
    country: 'GR',
    rating: 4.7,
  },
  {
    id: 'gr-02',
    name: 'Katara Pass (Meteora Road)',
    description: 'Mountain pass in the Pindus range connecting Thessaly to Epirus. Dramatic scenery and the route to the famous Meteora monasteries.',
    lat: 39.7500,
    lng: 21.2500,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 40,
    country: 'GR',
    rating: 4.6,
  },
  {
    id: 'gr-03',
    name: 'Peloponnese Coastal Road (Mani Peninsula)',
    description: 'Rugged coastal road through the wild Mani peninsula with tower houses, dramatic cliffs, and the southernmost point of mainland Greece.',
    lat: 36.8000,
    lng: 22.3833,
    difficulty: 'medium',
    roadType: 'coastal',
    lengthKm: 75,
    country: 'GR',
    rating: 4.5,
  },

  // === BULGARIA ===
  {
    id: 'bg-01',
    name: 'Shipka Pass',
    description: 'Historic mountain pass through the Balkan Mountains (Stara Planina). 12km of switchbacks with monuments from the Russo-Turkish War and panoramic views.',
    lat: 42.7167,
    lng: 25.3167,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 30,
    country: 'BG',
    rating: 4.7,
  },
  {
    id: 'bg-02',
    name: 'Transbalkan Road (Rila Monastery)',
    description: 'Scenic mountain road to the famous Rila Monastery through dense forests with excellent curves and minimal traffic on weekdays.',
    lat: 42.1333,
    lng: 23.3333,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 45,
    country: 'BG',
    rating: 4.5,
  },
  {
    id: 'bg-03',
    name: 'Road to Trigrad Gorge',
    description: 'Dramatic road through the Rhodope Mountains to the spectacular Trigrad Gorge. The canyon walls tower hundreds of meters above the road.',
    lat: 41.6333,
    lng: 24.3667,
    difficulty: 'medium',
    roadType: 'canyon',
    lengthKm: 35,
    country: 'BG',
    rating: 4.6,
  },

  // === ROMANIA ===
  {
    id: 'ro-01',
    name: 'Transfăgărășan Highway',
    description: 'The most famous motorcycle road in Romania and one of the best in the world. 90km of twists and turns climbing to 2,042m in the Făgăraș Mountains. Made famous by Top Gear.',
    lat: 45.5944,
    lng: 24.6261,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 90,
    country: 'RO',
    rating: 5.0,
  },
  {
    id: 'ro-02',
    name: 'Transalpina (DN67C)',
    description: 'The highest road in Romania at 2,145m. Even more dramatic than Transfăgărășan with fewer tourists. Spectacular alpine scenery and tight switchbacks.',
    lat: 45.4500,
    lng: 23.6833,
    difficulty: 'expert',
    roadType: 'mountain_pass',
    lengthKm: 110,
    country: 'RO',
    rating: 4.9,
  },
  {
    id: 'ro-03',
    name: 'Transbucegi Road',
    description: 'Mountain road through the Bucegi Mountains offering spectacular views of the Carpathians. Less famous than Transfăgărășan but equally thrilling.',
    lat: 45.4000,
    lng: 25.4500,
    difficulty: 'hard',
    roadType: 'mountain',
    lengthKm: 35,
    country: 'RO',
    rating: 4.6,
  },
  {
    id: 'ro-04',
    name: 'Bicaz Gorge (Cheile Bicazului)',
    description: 'Spectacular limestone gorge road connecting Transylvania to Moldavia. Towering rock walls, tight curves, and the dramatic Red Lake at the eastern end.',
    lat: 46.8000,
    lng: 25.7667,
    difficulty: 'medium',
    roadType: 'canyon',
    lengthKm: 25,
    country: 'RO',
    rating: 4.7,
  },

  // === HUNGARY ===
  {
    id: 'hu-01',
    name: 'Visegrádi-hegység (Visegrád Mountains)',
    description: 'Winding roads through the Visegrád Hills above the Danube Bend. Great views of the river and forests just outside Budapest.',
    lat: 47.7833,
    lng: 18.9833,
    difficulty: 'easy',
    roadType: 'hills',
    lengthKm: 30,
    country: 'HU',
    rating: 4.2,
  },
  {
    id: 'hu-02',
    name: 'Bükk National Park Roads',
    description: 'Forest roads through the Bükk Mountains in northern Hungary. Excellent sweepers and elevation changes through dense beech forests.',
    lat: 48.0667,
    lng: 20.4167,
    difficulty: 'easy',
    roadType: 'forest',
    lengthKm: 45,
    country: 'HU',
    rating: 4.3,
  },

  // === AUSTRIA ===
  {
    id: 'at-01',
    name: 'Grossglockner High Alpine Road',
    description: 'The most famous motorcycle road in Austria. 36 switchbacks climbing to 2,504m with views of Austria\'s highest peak, the Grossglockner (3,798m).',
    lat: 47.0725,
    lng: 12.8283,
    difficulty: 'hard',
    roadType: 'mountain_pass',
    lengthKm: 48,
    country: 'AT',
    rating: 5.0,
  },
  {
    id: 'at-02',
    name: 'Nockalm Road (Nockalmstraße)',
    description: '52 bends through the Nockberge Biosphere Reserve in Carinthia. Sweeping alpine meadows and gentle curves make this a joy to ride.',
    lat: 46.9167,
    lng: 13.7833,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 34,
    country: 'AT',
    rating: 4.6,
  },
  {
    id: 'at-03',
    name: 'Villach Alpine Road (Villacher Alpenstraße)',
    description: 'Scenic mountain road near the Italian and Slovenian borders. Great curves with views of the Karawanks and Julian Alps.',
    lat: 46.6000,
    lng: 13.6500,
    difficulty: 'medium',
    roadType: 'mountain',
    lengthKm: 16,
    country: 'AT',
    rating: 4.4,
  },
]

// GET /api/balkan-roads - Fetch curated motorcycle roads for the Balkans
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const difficulty = searchParams.get('difficulty')

    let filtered = [...BALKAN_ROADS]

    if (country) {
      filtered = filtered.filter((road) => road.country === country.toUpperCase())
    }

    if (difficulty) {
      filtered = filtered.filter((road) => road.difficulty === difficulty.toLowerCase())
    }

    // Sort by rating descending
    filtered.sort((a, b) => b.rating - a.rating)

    return NextResponse.json({
      success: true,
      data: filtered,
      count: filtered.length,
      total: BALKAN_ROADS.length,
      countries: [...new Set(BALKAN_ROADS.map((r) => r.country))].sort(),
    })
  } catch (error) {
    console.error('Fetch Balkan roads error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Balkan roads' },
      { status: 500 }
    )
  }
}
