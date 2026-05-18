'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MapPin,
  Navigation2,
  Clock,
  Mountain,
  Star,
  ChevronDown,
  ChevronUp,
  Route as RouteIcon,
  Loader2,
  Zap,
  Compass,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

// ===== PREDEFINED BALKAN TOUR ROUTES =====
// These are complete navigable routes with key waypoints
// Based on forum research: motorcyclists want built-in known routes (like BDR in the US)

interface TourRoute {
  id: string
  name: string
  nameEn: string
  country: string
  countryFlag: string
  distance: number // km
  duration: number // minutes
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  description: string
  highlights: string[]
  waypoints: { lat: number; lng: number; name: string }[]
  bestSeason: string
  rating: number
  tags: string[]
  isIconic?: boolean // Flag for the 5 new iconic routes
}

const BALKAN_TOURS: TourRoute[] = [
  // ===== ORIGINAL 10 TOURS =====
  {
    id: 'slo-vrsic-pass',
    name: 'Prelaz Vršič & Soška dolina',
    nameEn: 'Vršič Pass & Soča Valley',
    country: 'SI',
    countryFlag: '🇸🇮',
    distance: 85,
    duration: 150,
    difficulty: 'medium',
    description: 'Legendarna ruta čez 50 zavijalk Vršiča (1611m) dol v smaragdno Soško dolino. Najboljša motoristična ruta v Sloveniji.',
    highlights: ['50 serpentín Vršiča', 'Smaraždna reka Soča', 'Spomenik Juliusu Kugyju', 'Trenta dolina', 'Bovej'],
    waypoints: [
      { lat: 46.2489, lng: 13.8622, name: 'Kranjska Gora' },
      { lat: 46.2442, lng: 13.8178, name: 'Vršič - ruska kapelica' },
      { lat: 46.2417, lng: 13.7694, name: 'Vršič - prelaz (1611m)' },
      { lat: 46.2278, lng: 13.7269, name: 'Trenta' },
      { lat: 46.2022, lng: 13.6633, name: 'Soča vas' },
      { lat: 46.1847, lng: 13.6281, name: 'Bovec' },
    ],
    bestSeason: 'Maj - Oktober',
    rating: 9.5,
    tags: ['gorski prehod', 'serpentine', 'reka', 'priljubljena'],
  },
  {
    id: 'slo-jadran-coast',
    name: 'Jadranska obala',
    nameEn: 'Adriatic Coast Run',
    country: 'SI',
    countryFlag: '🇸🇮',
    distance: 95,
    duration: 120,
    difficulty: 'easy',
    description: 'Obalna ruta od Kopra do Pirana z razgledi na Jadransko morje. Sproščujoča vožnja ob obali z odličnimi postanki za kavico.',
    highlights: ['Koper - staro mesto', 'Izola - ribiško mestece', 'Portorož - plaža', 'Piran - Tartini trg', 'Sečovlje soline'],
    waypoints: [
      { lat: 45.5481, lng: 13.7303, name: 'Koper' },
      { lat: 45.5331, lng: 13.6603, name: 'Izola' },
      { lat: 45.5153, lng: 13.5964, name: 'Portorož' },
      { lat: 45.5294, lng: 13.5681, name: 'Piran' },
      { lat: 45.4872, lng: 13.5328, name: 'Sečovlje soline' },
    ],
    bestSeason: 'Marec - November',
    rating: 7.5,
    tags: ['obala', 'morje', 'sproščena', 'kava'],
  },
  {
    id: 'hrv-gorski-kotar',
    name: 'Gorski Kotar',
    nameEn: 'Gorski Kotar Mountain Loop',
    country: 'HR',
    countryFlag: '🇭🇷',
    distance: 120,
    duration: 180,
    difficulty: 'medium',
    description: 'Hrvaška "Švica" — gozdne ceste skozi Gorski Kotar, eden najlepših naravnih območij na Hrvaškem. Vijugaste ceste skozi goste gozdove.',
    highlights: ['Risnjak narodni park', 'Lokvarsko jezero', 'Fužine', 'Delnice', 'Jezero Bajer'],
    waypoints: [
      { lat: 45.3608, lng: 14.4353, name: 'Rijeka' },
      { lat: 45.4269, lng: 14.6414, name: 'Delnice' },
      { lat: 45.4375, lng: 14.7078, name: 'Lokvarsko jezero' },
      { lat: 45.4383, lng: 14.5267, name: 'Fužine' },
      { lat: 45.4492, lng: 14.4628, name: 'Jezero Bajer' },
      { lat: 45.3608, lng: 14.4353, name: 'Rijeka' },
    ],
    bestSeason: 'April - Oktober',
    rating: 8.0,
    tags: ['gozd', 'jezera', 'vijugaste', 'narava'],
  },
  {
    id: 'hrv-jadranska-magistrala',
    name: 'Jadranska magistrala',
    nameEn: 'Adriatic Highway',
    country: 'HR',
    countryFlag: '🇭🇷',
    distance: 180,
    duration: 240,
    difficulty: 'easy',
    description: 'Slavna Jadranska magistrala — obalna cesta od Senja do Zadarja z osupljivimi razgledi na otoke in modro morje.',
    highlights: ['Senj - Nehaj grad', 'Karlobag', 'Pag most', 'Zadar - Morske orglje', 'Razgledi na otoke'],
    waypoints: [
      { lat: 44.9928, lng: 14.8986, name: 'Senj' },
      { lat: 44.5217, lng: 15.0847, name: 'Karlobag' },
      { lat: 44.4369, lng: 14.9533, name: 'Pag most' },
      { lat: 44.3072, lng: 15.2392, name: 'Zadar' },
    ],
    bestSeason: 'Marec - November',
    rating: 9.0,
    tags: ['obala', 'morje', 'razgledi', 'klasika'],
  },
  {
    id: 'mne-kotor-serpentine',
    name: 'Kotor serpentine',
    nameEn: 'Kotor Serpentine',
    country: 'ME',
    countryFlag: '🇲🇪',
    distance: 45,
    duration: 90,
    difficulty: 'hard',
    description: 'Ena najbolj dramatičnih cest na svetu — 25 ozkih serpentín iz Kotorskega zaliva (0m) do Njeguške planote (900m). Navor za izkušene motoriste!',
    highlights: ['25 serpentín', 'Razgled na Boko Kotorsko', 'Njeguši - sir in pršut', 'Kotor - staro mesto UNESCO'],
    waypoints: [
      { lat: 42.4247, lng: 18.7714, name: 'Kotor' },
      { lat: 42.4378, lng: 18.7822, name: 'Kotor serpentine - začetek' },
      { lat: 42.4600, lng: 18.8167, name: 'Njeguši' },
      { lat: 42.4694, lng: 18.8408, name: 'Bukovica' },
    ],
    bestSeason: 'Maj - September',
    rating: 10.0,
    tags: ['serpentine', 'klanec', 'razgled', 'adrenalin', 'UNESCO'],
  },
  {
    id: 'rou-transfagarasan',
    name: 'Transfăgărășan',
    nameEn: 'Transfăgărășan Highway',
    country: 'RO',
    countryFlag: '🇷🇴',
    distance: 150,
    duration: 240,
    difficulty: 'hard',
    description: 'Edna najbolj znanih cest na svetu — "Cesta do neba" čez Făgăraș gore do 2042m. Več kot 100 zavijalk, predori in osupljivi razgledi. Top Gearjeva najljubša cesta.',
    highlights: ['2042m najvišja točka', 'Predor Capra', 'Bâlea jezero', '100+ serpentín', 'Vidikovci na Făgăraš'],
    waypoints: [
      { lat: 45.6319, lng: 24.9767, name: 'Curtea de Argeș' },
      { lat: 45.5917, lng: 24.6306, name: 'Bâlea Cascadă' },
      { lat: 45.6017, lng: 24.5844, name: 'Bâlea Lac (2042m)' },
      { lat: 45.6211, lng: 24.4964, name: 'Predor Capra' },
      { lat: 45.5719, lng: 24.3197, name: 'Cârțișoara' },
    ],
    bestSeason: 'Julij - Oktober (zaprt pozimi)',
    rating: 10.0,
    tags: ['gorski prehod', 'serpentine', 'legendarna', 'razgledi', 'Top Gear'],
  },
  {
    id: 'rou-transalpina',
    name: 'Transalpina',
    nameEn: 'Transalpina Highway',
    country: 'RO',
    countryFlag: '🇷🇴',
    distance: 140,
    duration: 210,
    difficulty: 'hard',
    description: 'Najvišja cesta v Romuniji (2145m na prelazu Urdele). Manj znana kot Transfăgărășan, a po mnenju mnogih še lepša. Vijugaste ceste skozi nekropšene gore.',
    highlights: ['2145m najvišja točka', 'Prelaz Urdele', 'Rânca smučišče', 'Oașa jezero', 'Netaknjena narava'],
    waypoints: [
      { lat: 45.5600, lng: 23.6167, name: 'Sebeș' },
      { lat: 45.5300, lng: 23.7000, name: 'Oașa jezero' },
      { lat: 45.4917, lng: 23.7233, name: 'Prelaz Urdele (2145m)' },
      { lat: 45.4383, lng: 23.7917, name: 'Rânca' },
      { lat: 45.3883, lng: 23.9250, name: 'Novaci' },
    ],
    bestSeason: 'Julij - Oktober (zaprt pozimi)',
    rating: 9.5,
    tags: ['gorski prehod', 'višina', 'netaknjena', 'razgledi'],
  },
  {
    id: 'alb-sh8-coast',
    name: 'SH8 Obala',
    nameEn: 'Albanian Riviera (SH8)',
    country: 'AL',
    countryFlag: '🇦🇱',
    distance: 130,
    duration: 180,
    difficulty: 'medium',
    description: 'Albanska riviera — SH8 cesta vzdolž Jonskega morja. Kristalno čisto morje, osamljene plaže, gorski razgledi. Celo Evropejci še ne poznajo!',
    highlights: ['Llogara prelaz (1027m)', 'Dhermi plaža', 'Himara', 'Saranda', 'Razgled na Krf'],
    waypoints: [
      { lat: 40.3319, lng: 19.4919, name: 'Vlorë' },
      { lat: 40.1972, lng: 19.5761, name: 'Llogara prelaz' },
      { lat: 40.1222, lng: 19.5689, name: 'Dhërmi' },
      { lat: 40.0994, lng: 19.7444, name: 'Himarë' },
      { lat: 39.8783, lng: 20.0050, name: 'Sarandë' },
    ],
    bestSeason: 'Maj - Oktober',
    rating: 9.0,
    tags: ['obala', 'morje', 'novi odkritje', 'plaža', 'razgledi'],
  },
  {
    id: 'bul-shipka-pass',
    name: 'Prelaz Šipka',
    nameEn: 'Shipka Pass & Valley of Roses',
    country: 'BG',
    countryFlag: '🇧🇬',
    distance: 110,
    duration: 150,
    difficulty: 'medium',
    description: 'Zgodovinski prelaz Šipka (1330m) skozi Balkansko gorovje. V spomladanskem času pelje skozi Dolino vrtnic — edinstven prizor rožnih polj.',
    highlights: ['Prelaz Šipka (1330m)', 'Spomenik Šipka', 'Dolina vrtnic', 'Kazanlak', 'Etar muzej'],
    waypoints: [
      { lat: 42.6244, lng: 25.3522, name: 'Gabrovo' },
      { lat: 42.6956, lng: 25.3214, name: 'Prelaz Šipka' },
      { lat: 42.6133, lng: 25.3953, name: 'Šipka spomenik' },
      { lat: 42.5544, lng: 25.3567, name: 'Kazanlak' },
      { lat: 42.5967, lng: 25.4778, name: 'Etar muzej' },
    ],
    bestSeason: 'Maj - Oktober (junij = vrtnice!)',
    rating: 8.0,
    tags: ['zgodovina', 'vrtnice', 'gorski prehod', 'kultura'],
  },
  {
    id: 'slo-jezersko-pokljuka',
    name: 'Jezersko & Pokljuka',
    nameEn: 'Jezersko & Pokljuka Loop',
    country: 'SI',
    countryFlag: '🇸🇮',
    distance: 70,
    duration: 120,
    difficulty: 'medium',
    description: 'Ruta čez Jezersko v Avstrijo in nazaj čez Pokljuko. Gorski prelazi, gozdne ceste in osupljivi razgledi na Gorenjsko.',
    highlights: ['Jezersko - planinsko mesto', 'Prelaz Seeberg', 'Pokljuka - biatlon', 'Razgled na Triglav', 'Gozdne ceste'],
    waypoints: [
      { lat: 46.3783, lng: 14.5333, name: 'Preddvor' },
      { lat: 46.4017, lng: 14.5800, name: 'Jezersko' },
      { lat: 46.4233, lng: 14.5639, name: 'Prelaz Seeberg' },
      { lat: 46.3717, lng: 14.0233, name: 'Pokljuka' },
      { lat: 46.3517, lng: 14.0767, name: 'Goreljek' },
    ],
    bestSeason: 'Maj - Oktober',
    rating: 8.0,
    tags: ['gorski prehod', 'gozd', 'razgledi', 'Triglav'],
  },

  // ===== 5 NEW ICONIC BALKAN TOUR ROUTES =====
  // Extended routes with detailed GPS waypoints for real navigation

  {
    id: 'slo-soca-vrsic-loop',
    name: 'Soška dolina & Vršič',
    nameEn: 'Soča Valley & Vršič Full Loop',
    country: 'SI',
    countryFlag: '🇸🇮',
    distance: 120,
    duration: 210,
    difficulty: 'hard',
    description: 'Polni krog Soške doline in Vršiča — od Tolmina ob smaragdni Soči, čez Kobarid in Bovec, na Vršič (1611m) in nazaj skozi Trento. Najlepša slovenska motoristična ruta!',
    highlights: ['Smaragdna Soča', 'Kobarid - muzej', 'Bovec - adrenalinski park', 'Vršič 50 serpentín', 'Kranjska Gora', 'Trenta dolina', 'Slap Boka'],
    waypoints: [
      { lat: 46.1850, lng: 13.7300, name: 'Tolmin' },
      { lat: 46.2180, lng: 13.6600, name: 'Kamno ob Soči' },
      { lat: 46.2450, lng: 13.5800, name: 'Kobarid' },
      { lat: 46.2700, lng: 13.5700, name: 'Slap Boka' },
      { lat: 46.3050, lng: 13.5600, name: 'Žaga' },
      { lat: 46.3350, lng: 13.5550, name: 'Bovec' },
      { lat: 46.3800, lng: 13.6400, name: 'Trenta - začetek klanca' },
      { lat: 46.4330, lng: 13.7330, name: 'Vršič - prelaz (1611m)' },
      { lat: 46.4150, lng: 13.7800, name: 'Vršič - ruska kapelica' },
      { lat: 46.4800, lng: 13.7900, name: 'Kranjska Gora' },
      { lat: 46.3700, lng: 13.7500, name: 'Trenta vas' },
      { lat: 46.3350, lng: 13.5550, name: 'Bovec (konec)' },
    ],
    bestSeason: 'Maj - Oktober',
    rating: 9.8,
    tags: ['ikonična', 'serpentine', 'reka', 'gorski prehod', 'zanka'],
    isIconic: true,
  },
  {
    id: 'mne-kotor-lovcen-skadar',
    name: 'Crna Gora Loop',
    nameEn: 'Montenegro Loop: Kotor-Lovćen-Skadar',
    country: 'ME',
    countryFlag: '🇲🇪',
    distance: 140,
    duration: 300,
    difficulty: 'expert',
    description: 'Ekstremna črnogorska zanka — Kotor serpentine, Lovćen narodni park, Cetinje, Skadransko jezero in Budva riviera. Navor in lepotica v enem!',
    highlights: ['Kotor serpentine (25 ovinkov)', 'Lovćen (1749m)', 'Mauzolej Njegoš', 'Cetinje - stara prestolnica', 'Skadransko jezero', 'Budva riviera', 'Sveti Stefan razgled'],
    waypoints: [
      { lat: 42.4250, lng: 18.7700, name: 'Kotor' },
      { lat: 42.4100, lng: 18.7750, name: 'Kotor - serpentine začetek' },
      { lat: 42.3800, lng: 18.8000, name: 'Kotor serpentine - sredina' },
      { lat: 42.3600, lng: 18.8500, name: 'Njeguši' },
      { lat: 42.3800, lng: 18.8700, name: 'Lovćen - Mauzolej Njegoš' },
      { lat: 42.3950, lng: 18.8900, name: 'Ivanova Korita' },
      { lat: 42.3900, lng: 18.9100, name: 'Cetinje' },
      { lat: 42.3500, lng: 19.0200, name: 'Rijeka Crnojevića' },
      { lat: 42.2500, lng: 19.1500, name: 'Virpazar - Skadransko jezero' },
      { lat: 42.2600, lng: 19.0500, name: 'Sutomore' },
      { lat: 42.2800, lng: 18.8400, name: 'Budva' },
      { lat: 42.4250, lng: 18.7700, name: 'Kotor (konec)' },
    ],
    bestSeason: 'Maj - September',
    rating: 9.9,
    tags: ['ikonična', 'serpentine', 'narodni park', 'jezero', 'obala', 'zanka'],
    isIconic: true,
  },
  {
    id: 'rou-transfagarasan-full',
    name: 'Transfăgărășan Celotna',
    nameEn: 'Transfăgărășan Full Route',
    country: 'RO',
    countryFlag: '🇷🇴',
    distance: 170,
    duration: 330,
    difficulty: 'expert',
    description: 'Celotna Transfăgărășan od Băile Olănești preko Curtea de Argeș do vrha pri Bâlea Lake (2034m) in naprej do Sibiuja. Top Gearjeva najljubša cesta — vsestranska!',
    highlights: ['Bâlea Lake (2034m)', 'Predor Capra (900m)', 'Piscul Negru', 'Curtea de Argeș samostan', 'Cârțișoara vas', 'Sibiu - Evropska prestolnica kulture'],
    waypoints: [
      { lat: 45.4300, lng: 24.2100, name: 'Băile Olănești' },
      { lat: 45.3800, lng: 24.3500, name: 'Titești' },
      { lat: 45.2900, lng: 24.5100, name: 'Perișani' },
      { lat: 45.1400, lng: 24.6800, name: 'Curtea de Argeș' },
      { lat: 45.4400, lng: 24.6200, name: 'Arefu' },
      { lat: 45.5900, lng: 24.6200, name: 'Piscul Negru' },
      { lat: 45.6000, lng: 24.6400, name: 'Bâlea Lake (2034m)' },
      { lat: 45.6100, lng: 24.5800, name: 'Predor Capra' },
      { lat: 45.6300, lng: 24.5000, name: 'Bâlea Cascadă' },
      { lat: 45.7700, lng: 24.6100, name: 'Cârțișoara' },
      { lat: 45.7900, lng: 24.1500, name: 'Sibiu' },
    ],
    bestSeason: 'Julij - Oktober (zaprt pozimi!)',
    rating: 10.0,
    tags: ['ikonična', 'gorski prehod', 'serpentine', 'legendarna', 'Top Gear'],
    isIconic: true,
  },
  {
    id: 'alb-riviera-vlore-sarande',
    name: 'Albanska riviera',
    nameEn: 'Albanian Riviera: Vlorë-Sarandë',
    country: 'AL',
    countryFlag: '🇦🇱',
    distance: 150,
    duration: 270,
    difficulty: 'medium',
    description: 'Albanska riviera — spektakularna SH8 cesta od Vlorëja čez Llogara prelaz (1027m) vzdolž Jonskega morja do Sarandëja in Ksamila. Kristalno čisto morje in divji razgledi!',
    highlights: ['Llogara prelaz (1027m)', 'Dhërmi - modra jama', 'Himarë - grad', 'Lukova plaža', 'Sarandë - obala', 'Ksamil - otoki', 'Razgled na Krf'],
    waypoints: [
      { lat: 40.4700, lng: 19.4900, name: 'Vlorë' },
      { lat: 40.3800, lng: 19.5200, name: 'Orikum' },
      { lat: 40.1800, lng: 19.5800, name: 'Llogara prelaz (1027m)' },
      { lat: 40.1500, lng: 19.5900, name: 'Llogara - razgled na morje' },
      { lat: 40.1100, lng: 19.6200, name: 'Dhërmi' },
      { lat: 40.1000, lng: 19.6800, name: 'Gjipe plaža' },
      { lat: 40.0800, lng: 19.7400, name: 'Himarë' },
      { lat: 40.0300, lng: 19.8300, name: 'Lukova' },
      { lat: 39.9500, lng: 19.9200, name: 'Borsh' },
      { lat: 39.8700, lng: 20.0100, name: 'Sarandë' },
      { lat: 39.7700, lng: 20.0000, name: 'Ksamil' },
    ],
    bestSeason: 'Maj - Oktober',
    rating: 9.2,
    tags: ['ikonična', 'obala', 'morje', 'prelaz', 'plaža', 'razgledi'],
    isIconic: true,
  },
  {
    id: 'bul-rhodope-pamporovo-dospat',
    name: 'Rodopske gore',
    nameEn: 'Rhodope Mountains: Pamporovo-Dospat',
    country: 'BG',
    countryFlag: '🇧🇬',
    distance: 130,
    duration: 270,
    difficulty: 'hard',
    description: 'Rodopske gore — divje gozdne ceste od Pamporova skozi Shiroka Laka, Devin, Yagodino jamo in Trigrad sotesko. Samotne ceste, jame in osupljiva narava!',
    highlights: ['Shiroka Laka - arhitektura', 'Devin - vroči izviri', 'Yagodina jama', 'Trigrad soteska', 'Buynovo soteska', 'Dospat jezero', 'Orlovo oko razgled'],
    waypoints: [
      { lat: 41.6500, lng: 24.7000, name: 'Pamporovo' },
      { lat: 41.6400, lng: 24.6600, name: 'Stoikite' },
      { lat: 41.6300, lng: 24.5500, name: 'Shiroka Laka' },
      { lat: 41.6700, lng: 24.4800, name: 'Gela' },
      { lat: 41.7200, lng: 24.4000, name: 'Devin' },
      { lat: 41.7000, lng: 24.3800, name: 'Trigradska reka' },
      { lat: 41.6600, lng: 24.3500, name: 'Yagodina jama' },
      { lat: 41.6300, lng: 24.3700, name: 'Trigrad' },
      { lat: 41.6400, lng: 24.4000, name: 'Buynovo soteska' },
      { lat: 41.6800, lng: 24.3000, name: 'Beden' },
      { lat: 41.6400, lng: 24.1600, name: 'Dospat' },
    ],
    bestSeason: 'Maj - Oktober',
    rating: 9.1,
    tags: ['ikonična', 'gozd', 'jama', 'soteska', 'jezero', 'samotna'],
    isIconic: true,
  },
]

interface BalkanToursProps {
  onSelectTour?: (waypoints: { lat: number; lng: number }[]) => void
  onStartNavigation?: (destination: { lat: number; lng: number; name: string }) => void
  onLoadToPlan?: (waypoints: { lat: number; lng: number }[], name: string) => void
}

export default function BalkanTours({ onSelectTour, onStartNavigation, onLoadToPlan }: BalkanToursProps) {
  const [expandedTour, setExpandedTour] = useState<string | null>(null)
  const [loadingTour, setLoadingTour] = useState<string | null>(null)
  const [selectedTour, setSelectedTour] = useState<string | null>(null)
  const [showIconicFirst, setShowIconicFirst] = useState(true)

  const handleSelectTour = useCallback((tour: TourRoute) => {
    setSelectedTour(tour.id)
    onSelectTour?.(tour.waypoints.map(w => ({ lat: w.lat, lng: w.lng })))
    toast.success(`Ruta "${tour.name}" naložena! ${tour.waypoints.length} točk, ${tour.distance} km`)
  }, [onSelectTour])

  const handleNavigateToStart = useCallback((tour: TourRoute) => {
    const start = tour.waypoints[0]
    onStartNavigation?.({ lat: start.lat, lng: start.lng, name: start.name })
    toast.info(`Navigacija do ${start.name}...`)
  }, [onStartNavigation])

  const handleLoadToPlan = useCallback((tour: TourRoute) => {
    const waypoints = tour.waypoints.map(w => ({ lat: w.lat, lng: w.lng }))
    onLoadToPlan?.(waypoints, tour.name)
    toast.success(`🗺️ Ruta "${tour.name}" naložena v Načrtuj!`)
  }, [onLoadToPlan])

  const difficultyColor = (d: string) => {
    switch (d) {
      case 'easy': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'hard': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'expert': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const difficultyLabel = (d: string) => {
    switch (d) {
      case 'easy': return 'Lahko'
      case 'medium': return 'Srednje'
      case 'hard': return 'Težko'
      case 'expert': return 'Expert'
      default: return d
    }
  }

  // Sort: iconic tours first when filter is on
  const sortedTours = showIconicFirst
    ? [...BALKAN_TOURS].sort((a, b) => (b.isIconic ? 1 : 0) - (a.isIconic ? 1 : 0))
    : BALKAN_TOURS

  const iconicCount = BALKAN_TOURS.filter(t => t.isIconic).length

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Mountain className="size-5 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Balkanske ture</h3>
          <Badge variant="secondary" className="text-[9px]">{BALKAN_TOURS.length} rut</Badge>
        </div>
        <button
          onClick={() => setShowIconicFirst(!showIconicFirst)}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-colors ${
            showIconicFirst
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Sparkles className="size-3" />
          Ikonične prve
        </button>
      </div>

      {/* Iconic tours highlight banner */}
      {iconicCount > 0 && (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg p-3 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-4 text-primary" />
            <span className="text-xs font-bold text-primary">{iconicCount} ikoničnih tur z GPS točkami</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Naložite v Načrtuj za navigacijo z dejanskimi GPS koordinatami!
          </p>
        </div>
      )}

      {sortedTours.map(tour => {
        const isExpanded = expandedTour === tour.id
        const isIconic = tour.isIconic
        return (
          <Card key={tour.id} className={`transition-all ${selectedTour === tour.id ? 'ring-2 ring-primary' : ''} ${isIconic ? 'border-primary/30' : ''}`}>
            <CardContent className={`p-3 space-y-2 ${isIconic ? '' : ''}`}>
              {/* Iconic badge strip */}
              {isIconic && (
                <div className="flex items-center gap-1.5 -mt-1 -mx-1 mb-1">
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-primary via-primary/60 to-transparent rounded-full" />
                  <span className="text-[8px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="size-2.5" />
                    Ikonična
                  </span>
                  <div className="flex-1 h-0.5 bg-gradient-to-l from-primary via-primary/60 to-transparent rounded-full" />
                </div>
              )}

              {/* Tour header */}
              <button
                onClick={() => setExpandedTour(isExpanded ? null : tour.id)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">{tour.countryFlag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${isIconic ? 'font-bold' : 'font-medium'}`}>{tour.name}</p>
                      <Badge className={`text-[9px] px-1.5 py-0 border ${difficultyColor(tour.difficulty)}`}>
                        {difficultyLabel(tour.difficulty)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tour.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <RouteIcon className="size-3" />
                        {tour.distance} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        ~{Math.floor(tour.duration / 60)}h {tour.duration % 60}min
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="size-3 text-amber-400" />
                        {tour.rating}
                      </span>
                      {isIconic && (
                        <span className="flex items-center gap-1 text-primary">
                          <MapPin className="size-3" />
                          {tour.waypoints.length} GPS
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="size-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="space-y-2 mt-1 pt-2 border-t border-border/50">
                  {/* Highlights */}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Zanimivosti</p>
                    <div className="flex flex-wrap gap-1">
                      {tour.highlights.map((h, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">
                          {h}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Waypoints */}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
                      Pot ({tour.waypoints.length} točk{isIconic ? ' · GPS navigacija' : ''})
                    </p>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                      {tour.waypoints.map((wp, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={`size-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${
                            i === 0
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : i === tour.waypoints.length - 1
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-primary/20 text-primary'
                          }`}>
                            {i + 1}
                          </span>
                          <span className="truncate">{wp.name}</span>
                          <span className="text-[8px] text-muted-foreground ml-auto flex-shrink-0">
                            {wp.lat.toFixed(3)}, {wp.lng.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Season & Tags */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>📅 {tour.bestSeason}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tour.tags.map((tag, i) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${
                        tag === 'ikonična' ? 'bg-primary/20 text-primary font-medium' : 'bg-muted/50'
                      }`}>#{tag}</span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {isIconic && onLoadToPlan && (
                      <Button
                        size="sm"
                        className="flex-1 text-xs gap-1"
                        onClick={() => handleLoadToPlan(tour)}
                      >
                        <Compass className="size-3" />
                        Naloži v Načrtuj
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={isIconic && onLoadToPlan ? 'outline' : 'default'}
                      className={`text-xs gap-1 ${!isIconic || !onLoadToPlan ? 'flex-1' : ''}`}
                      onClick={() => handleSelectTour(tour)}
                    >
                      <Zap className="size-3" />
                      Naloži ruto
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => handleNavigateToStart(tour)}
                    >
                      <Navigation2 className="size-3" />
                      Na začetek
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
