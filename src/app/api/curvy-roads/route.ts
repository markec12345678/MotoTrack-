import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/curvy-roads - Returns road segments with curvature/color coding (Calimoto-style)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')

    const curvyRoads = [
      // 🇸🇮 Slovenia
      { id: 'si-1', name: 'Prelaz Vršič', country: 'SI', curvature: 5, color: '#ef4444', segments: [[46.35, 13.75], [46.38, 13.74], [46.41, 13.735], [46.4333, 13.7333], [46.45, 13.72]], lengthKm: 14, description: '50 klancev — najzahtevnejši prelaz v Sloveniji' },
      { id: 'si-2', name: 'Prelaz Mangart', country: 'SI', curvature: 5, color: '#dc2626', segments: [[46.42, 13.6], [46.43, 13.61], [46.44, 13.62], [46.45, 13.6333]], lengthKm: 12, description: 'Najvišji cestni prelaz v Sloveniji (2055m)' },
      { id: 'si-3', name: 'Prelaz Predel', country: 'SI', curvature: 4, color: '#f97316', segments: [[46.35, 13.55], [46.36, 13.55], [46.37, 13.56], [46.3833, 13.5667]], lengthKm: 11, description: 'Strme serpentine ob reki Soči' },
      { id: 'si-4', name: 'Soška dolina', country: 'SI', curvature: 3, color: '#eab308', segments: [[46.15, 13.6], [46.2, 13.58], [46.25, 13.57], [46.3, 13.58], [46.35, 13.57]], lengthKm: 40, description: 'Scenična dolina ob reki Soči' },
      { id: 'si-5', name: 'Jezersko - Preval', country: 'SI', curvature: 4, color: '#f97316', segments: [[46.38, 14.8], [46.39, 14.82], [46.4, 14.85], [46.41, 14.87]], lengthKm: 16, description: 'Gorski prelaz z lepimi zavoji' },
      { id: 'si-6', name: 'Pokljuka', country: 'SI', curvature: 3, color: '#eab308', segments: [[46.35, 14.05], [46.36, 14.08], [46.37, 14.1], [46.38, 14.12]], lengthKm: 18, description: 'Gozdna cesta na Pokljuko' },
      { id: 'si-7', name: 'Gorjanci', country: 'SI', curvature: 3, color: '#eab308', segments: [[45.85, 15.1], [45.82, 15.13], [45.8, 15.1667], [45.78, 15.2]], lengthKm: 22, description: 'Krasne vijugaste ceste Gorjancev' },
      { id: 'si-8', name: 'Pohorje', country: 'SI', curvature: 3, color: '#eab308', segments: [[46.5, 15.55], [46.52, 15.53], [46.54, 15.5]], lengthKm: 20, description: 'Gozdne klance Pohorja' },
      { id: 'si-9', name: 'Cerkno - Škofja Loka', country: 'SI', curvature: 2, color: '#22c55e', segments: [[46.1167, 14.05], [46.13, 14.08], [46.15, 14.12], [46.17, 14.15]], lengthKm: 25, description: 'Slikovite ceste Škofjeloškega' },
      { id: 'si-10', name: 'Slovenska obala', country: 'SI', curvature: 2, color: '#22c55e', segments: [[45.58, 13.73], [45.55, 13.76], [45.53, 13.8], [45.51, 13.83]], lengthKm: 30, description: 'Obalna cesta s pogledom na Jadran' },
      // 🇭🇷 Croatia
      { id: 'hr-1', name: 'Jadranska magistrala', country: 'HR', curvature: 3, color: '#eab308', segments: [[45.32, 14.45], [45.2, 14.58], [45.08, 14.65], [44.9, 14.8], [44.7, 14.9]], lengthKm: 150, description: 'Legendarne obalne krivine ob Jadranu' },
      { id: 'hr-2', name: 'Gorski kotar', country: 'HR', curvature: 4, color: '#f97316', segments: [[45.45, 14.65], [45.43, 14.7], [45.4, 14.75], [45.38, 14.8]], lengthKm: 35, description: 'Gorski prelazi z ostrimi zavoji' },
      { id: 'hr-3', name: 'Pelješac', country: 'HR', curvature: 4, color: '#f97316', segments: [[42.98, 17.35], [42.95, 17.4], [42.92, 17.5], [42.88, 17.55]], lengthKm: 60, description: 'Vijugasta cesta po polotoku z vinogradi' },
      { id: 'hr-4', name: 'Lika - Velebit', country: 'HR', curvature: 4, color: '#f97316', segments: [[44.5, 15.5], [44.45, 15.55], [44.4, 15.6], [44.35, 15.65]], lengthKm: 45, description: 'Prelazi čez Velebit' },
      // 🇧🇦 BiH
      { id: 'ba-1', name: 'Čabulja', country: 'BA', curvature: 4, color: '#f97316', segments: [[43.3, 17.1], [43.28, 17.13], [43.26, 17.16]], lengthKm: 20, description: 'Gorske ceste Hercegovine' },
      { id: 'ba-2', name: 'Prenj', country: 'BA', curvature: 5, color: '#ef4444', segments: [[43.6, 17.9], [43.58, 17.93], [43.56, 17.96], [43.54, 17.99]], lengthKm: 25, description: 'Zahtevni gorski prelazi Prenja' },
      // 🇲🇪 Montenegro
      { id: 'me-1', name: 'Kotor serpentine', country: 'ME', curvature: 5, color: '#dc2626', segments: [[42.42, 18.77], [42.43, 18.78], [42.45, 18.79], [42.47, 18.78], [42.49, 18.76]], lengthKm: 15, description: '25 serpentin nad Kotorskim zalivom!' },
      { id: 'me-2', name: 'Lovćen', country: 'ME', curvature: 4, color: '#f97316', segments: [[42.38, 18.83], [42.37, 18.85], [42.36, 18.87]], lengthKm: 18, description: 'Gorska cesta na Lovćen' },
      { id: 'me-3', name: 'Piva canyon', country: 'ME', curvature: 5, color: '#ef4444', segments: [[43.3, 18.8], [43.28, 18.83], [43.26, 18.86], [43.24, 18.89]], lengthKm: 30, description: 'Kanjon Pive — ozke vijugaste ceste' },
      // 🇷🇸 Serbia
      { id: 'rs-1', name: 'Zlatibor', country: 'RS', curvature: 3, color: '#eab308', segments: [[43.7, 19.7], [43.68, 19.73], [43.66, 19.76]], lengthKm: 25, description: 'Gorske ceste Zlatibora' },
      { id: 'rs-2', name: 'Tara', country: 'RS', curvature: 4, color: '#f97316', segments: [[43.9, 19.5], [43.88, 19.53], [43.86, 19.56]], lengthKm: 20, description: 'Vijugaste ceste ob kanjonu Tare' },
      // 🇲🇰 North Macedonia
      { id: 'mk-1', name: 'Ohrid - Struga', country: 'MK', curvature: 3, color: '#eab308', segments: [[41.12, 20.8], [41.1, 20.75], [41.08, 20.7]], lengthKm: 30, description: 'Obalna cesta ob Ohridskem jezeru' },
      { id: 'mk-2', name: 'Mavrovo', country: 'MK', curvature: 4, color: '#f97316', segments: [[41.65, 20.73], [41.63, 20.76], [41.61, 20.79]], lengthKm: 22, description: 'Gorske ceste naravnega parka Mavrovo' },
      // 🇦🇱 Albania
      { id: 'al-1', name: 'SH8 Obala', country: 'AL', curvature: 4, color: '#f97316', segments: [[40.1, 19.5], [40.05, 19.55], [40.0, 19.6], [39.95, 19.65]], lengthKm: 50, description: 'Albanska obalna cesta — episka!' },
      { id: 'al-2', name: 'Valbona', country: 'AL', curvature: 5, color: '#ef4444', segments: [[42.4, 19.9], [42.38, 19.93], [42.36, 19.96]], lengthKm: 18, description: 'Gorski prelazi Prokletij' },
      { id: 'al-3', name: 'Theth', country: 'AL', curvature: 5, color: '#dc2626', segments: [[42.35, 19.75], [42.33, 19.78], [42.31, 19.81]], lengthKm: 15, description: 'Ozke gorske ceste do Thetha' },
      // 🇧🇬 Bulgaria
      { id: 'bg-1', name: 'Rila', country: 'BG', curvature: 4, color: '#f97316', segments: [[42.1, 23.5], [42.08, 23.53], [42.06, 23.56]], lengthKm: 22, description: 'Gorske ceste Rile' },
      { id: 'bg-2', name: 'Rodopi', country: 'BG', curvature: 4, color: '#f97316', segments: [[41.7, 24.8], [41.68, 24.83], [41.66, 24.86], [41.64, 24.89]], lengthKm: 35, description: 'Vijugaste ceste Rodopov' },
      // 🇷🇴 Romania
      { id: 'ro-1', name: 'Transfăgărășan', country: 'RO', curvature: 5, color: '#dc2626', segments: [[45.59, 24.62], [45.57, 24.64], [45.55, 24.66], [45.53, 24.68], [45.51, 24.7]], lengthKm: 90, description: 'Eden najbolj vijugastih cest na svetu!' },
      { id: 'ro-2', name: 'Transalpina', country: 'RO', curvature: 5, color: '#dc2626', segments: [[45.6, 23.6], [45.58, 23.63], [45.56, 23.66], [45.54, 23.69]], lengthKm: 80, description: 'Najvišja cesta v Romuniji — episka!' },
      { id: 'ro-3', name: 'Transbucegi', country: 'RO', curvature: 4, color: '#f97316', segments: [[45.4, 25.4], [45.38, 25.42], [45.36, 25.44]], lengthKm: 30, description: 'Gorski prelazi Bucegijev' },
      // 🇬🇷 Greece
      { id: 'gr-1', name: 'Meteora', country: 'GR', curvature: 3, color: '#eab308', segments: [[39.72, 21.63], [39.7, 21.65], [39.68, 21.67]], lengthKm: 15, description: 'Ceste ob meteoritskih stenah' },
      { id: 'gr-2', name: 'Pindos', country: 'GR', curvature: 4, color: '#f97316', segments: [[39.8, 21.2], [39.78, 21.23], [39.76, 21.26], [39.74, 21.29]], lengthKm: 35, description: 'Vijugaste ceste Pindosa' },
    ]

    const filtered = country
      ? curvyRoads.filter(r => r.country.toLowerCase() === country.toLowerCase())
      : curvyRoads

    return NextResponse.json({
      success: true,
      data: filtered,
      meta: {
        total: filtered.length,
        curvatureScale: {
          1: { label: 'Ravno', color: '#22c55e' },
          2: { label: 'Rahlo vijugasto', color: '#22c55e' },
          3: { label: 'Zmerno vijugasto', color: '#eab308' },
          4: { label: 'Vijugasto', color: '#f97316' },
          5: { label: 'Ekstremno vijugasto', color: '#ef4444' },
        },
      },
    })
  } catch (error) {
    console.error('Curvy roads error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch curvy roads' }, { status: 500 })
  }
}
