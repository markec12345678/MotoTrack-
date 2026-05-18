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
}

const BALKAN_TOURS: TourRoute[] = [
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
]

interface BalkanToursProps {
  onSelectTour?: (waypoints: { lat: number; lng: number }[]) => void
  onStartNavigation?: (destination: { lat: number; lng: number; name: string }) => void
}

export default function BalkanTours({ onSelectTour, onStartNavigation }: BalkanToursProps) {
  const [expandedTour, setExpandedTour] = useState<string | null>(null)
  const [loadingTour, setLoadingTour] = useState<string | null>(null)
  const [selectedTour, setSelectedTour] = useState<string | null>(null)

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Mountain className="size-5 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Balkanske ture</h3>
        <Badge variant="secondary" className="text-[9px]">{BALKAN_TOURS.length} rut</Badge>
      </div>

      {BALKAN_TOURS.map(tour => {
        const isExpanded = expandedTour === tour.id
        return (
          <Card key={tour.id} className={`transition-all ${selectedTour === tour.id ? 'ring-2 ring-primary' : ''}`}>
            <CardContent className="p-3 space-y-2">
              {/* Tour header */}
              <button
                onClick={() => setExpandedTour(isExpanded ? null : tour.id)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">{tour.countryFlag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{tour.name}</p>
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
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Pot ({tour.waypoints.length} točk)</p>
                    <div className="space-y-0.5">
                      {tour.waypoints.map((wp, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="size-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate">{wp.name}</span>
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
                      <span key={i} className="text-[9px] bg-muted/50 px-1.5 py-0.5 rounded">#{tag}</span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 text-xs gap-1"
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
