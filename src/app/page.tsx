'use client'

import Image from 'next/image'
import {
  Map,
  MapPin,
  Calendar,
  Navigation,
  Users,
  Mountain,
  Star,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Check,
  X,
  ChevronRight,
  Download,
  BarChart3,
  ShieldCheck,
  Wifi,
  WifiOff,
  Smartphone,
  Globe,
  Route,
  MessageCircle,
  ExternalLink,
  Trophy,
  Zap,
  DollarSign,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'

/* ------------------------------------------------------------------ */
/*  NAV ITEMS                                                          */
/* ------------------------------------------------------------------ */
const navItems = [
  { id: 'about', label: 'O aplikaciji' },
  { id: 'features', label: 'Funkcije' },
  { id: 'pro', label: 'REVER Pro' },
  { id: 'reviews', label: 'Ocene' },
  { id: 'proscons', label: 'Prednosti/Slabosti' },
  { id: 'alternatives', label: 'Alternativ' },
  { id: 'conclusion', label: 'Sklep' },
]

/* ------------------------------------------------------------------ */
/*  KEY FEATURES                                                       */
/* ------------------------------------------------------------------ */
const features = [
  {
    icon: Map,
    title: 'Raziskovanje',
    emoji: '🗺️',
    description:
      'Odkrijte najboljše ceste, dirkališča in terenske poti. Več kot 3.000 zemljevid motociklističnih potovanj po vsem svetu.',
  },
  {
    icon: MapPin,
    title: 'Sledenje',
    emoji: '📍',
    description:
      'Beležite vožnje kjerkoli na svetu. Deluje brez mobilnega signala, samodejno premor, sledi razdalji, trajanju, nadmorski višini in hitrosti.',
  },
  {
    icon: Calendar,
    title: 'Načrtovanje',
    emoji: '🗓️',
    description:
      'Kliknite potekalne točke, povlecite za spremembo poti, možnost »Izogni se avtocestam«, priporočila Butler Map za slikovite in vijugaste ceste.',
  },
  {
    icon: Navigation,
    title: 'Navigacija',
    emoji: '🧭',
    description:
      'Zemljevidi brez povezave, navodila po ovinkih, glasovno vodenje, deluje v načinu letala.',
  },
  {
    icon: Users,
    title: 'Skupnost',
    emoji: '👥',
    description:
      'Sledenje prijateljev v živo, izzivi, deljenje voženj, javno ali zasebno po želji.',
  },
  {
    icon: Mountain,
    title: 'Butler Maps',
    emoji: '🏔️',
    description:
      'Premium priporočila slikovitih cest (ocene G1–G6), poudarja epične ceste z najboljšimi ovinki in razgledi.',
  },
]

/* ------------------------------------------------------------------ */
/*  PRO VS FREE                                                        */
/* ------------------------------------------------------------------ */
const freeFeatures = [
  'Sledenje voženj',
  'Osnovno načrtovanje poti',
  'Javne vožnje skupnosti',
  'Raziskovanje zemljevidov',
  'Deljenje voženj',
]
const proFeatures = [
  'Butler Map prekrivnosti',
  'Vijugasto usmerjanje',
  'Zemljevidi brez povezave',
  'Glasovna navigacija',
  'Apple CarPlay podpora',
  'Sledenje prijateljev v živo',
  'Izzivi in tekmovanja',
  'Napredna analitika voženj',
]

/* ------------------------------------------------------------------ */
/*  REVIEWS                                                            */
/* ------------------------------------------------------------------ */
const reviews = [
  {
    type: 'positive' as const,
    text: 'Obožujem sledenje mojih voženj s REVER... sledilni sistem/GPS je zelo natančen.',
    author: 'KTMColorado',
    source: 'App Store',
  },
  {
    type: 'positive' as const,
    text: 'Po odkritju te aplikacije sem načrtoval več kot 20.000 km voženj.',
    author: 'Uporabnik',
    source: 'Google Play',
  },
  {
    type: 'positive' as const,
    text: 'Aplikacija je intuitivna in enostavna za razumevanje. GPS sledenje je hitro in tekoče.',
    author: 'Team819s',
    source: 'App Store',
  },
  {
    type: 'positive' as const,
    text: 'Navigacija v vaši roki, na vašem telefonu, enostavna in intuitivna za uporabo.',
    author: 'ADVrider',
    source: 'Forum',
  },
  {
    type: 'negative' as const,
    text: 'Uporabniški vmesnik je v najboljšem primeru neroden, večina iskalne funkcionalnosti se zdi izjemno skopa.',
    author: 'Reddit uporabnik',
    source: 'Reddit',
  },
  {
    type: 'negative' as const,
    text: 'Nisem bil impresioniran, me je pripeljal na preveč stranskih cest, se zmedel, ko sem bil izven poti.',
    author: 'Forum uporabnik',
    source: 'Forum',
  },
  {
    type: 'mixed' as const,
    text: 'REVER Pro je precej dober. Uporabljam ga vzporedno z GPS napravo med vožnjo.',
    author: 'Facebook uporabnik',
    source: 'Facebook',
  },
]

/* ------------------------------------------------------------------ */
/*  PROS & CONS                                                        */
/* ------------------------------------------------------------------ */
const pros = [
  'Brezplačna osnovna različica',
  'Deluje brez povezave',
  'Velika skupnost uporabnikov',
  'Integracija z Butler Maps',
  'Enostavno načrtovanje poti',
  'Sledenje voženj brez mobilnega signala',
  'Podpora Apple CarPlay',
]
const cons = [
  'Vmesnik je včasih neroden',
  'Pro funkcije za plačilom (40 $/leto)',
  'Navigacija je lahko netočna izven poti',
  'Omejena iskalna funkcionalnost',
  'Nekatere funkcije samo na določenih platformah',
]

/* ------------------------------------------------------------------ */
/*  ALTERNATIVES                                                       */
/* ------------------------------------------------------------------ */
const alternatives = [
  {
    name: 'Kurviger',
    description: 'Zmogljive funkcije tudi v brezplačni različici, majhna plačila za dodatne možnosti.',
    pros: ['Močno načrtovanje poti', 'Brezplačna različica', 'Prilagodljive nastavitve'],
    cons: ['Manjša skupnost', 'Manj socialnih funkcij'],
    rating: 3.5,
  },
  {
    name: 'Google Maps',
    description: 'Brezplačen, a ni specializiran za motoriste.',
    pros: ['Popolnoma brezplačen', 'Zanesljiva navigacija', 'Velika baza podatkov'],
    cons: ['Ni specializiran za motoriste', 'Brez vijugastih poti', 'Brez sledenja voženj'],
    rating: 3,
  },
  {
    name: 'Calimoto',
    description: 'Poudarek na vijugastih cestah in socialnih funkcijah.',
    pros: ['Vijugaste ceste', 'Socialne funkcije', 'Skupnost motoristov'],
    cons: ['Manjše zemljevidi brez povezave', 'Plačljive napredne funkcije'],
    rating: 3.5,
  },
  {
    name: 'OsmAnd',
    description: 'Odprtokoden, zemljevidi brez povezave, kompleksen uporabniški vmesnik.',
    pros: ['Odprta koda', 'Brezplačni zemljevidi brez povezave', 'Zelo prilagodljiv'],
    cons: ['Kompleksen vmesnik', 'Strma krivulja učenja', 'Manj intuitiven'],
    rating: 3,
  },
]

/* ------------------------------------------------------------------ */
/*  HELPER: Review icon                                                */
/* ------------------------------------------------------------------ */
function ReviewIcon({ type }: { type: 'positive' | 'negative' | 'mixed' }) {
  if (type === 'positive')
    return <ThumbsUp className="size-5 text-emerald-400" />
  if (type === 'negative')
    return <ThumbsDown className="size-5 text-red-400" />
  return <Minus className="size-5 text-amber-400" />
}

function ReviewBadge({ type }: { type: 'positive' | 'negative' | 'mixed' }) {
  if (type === 'positive')
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        Pozitivno
      </Badge>
    )
  if (type === 'negative')
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        Negativno
      </Badge>
    )
  return (
    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
      Mešano
    </Badge>
  )
}

/* ================================================================== */
/*  PAGE COMPONENT                                                     */
/* ================================================================== */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ============ NAVBAR ============ */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <a href="#hero" className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary">
                <Route className="size-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg tracking-tight">REVER</span>
            </a>
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
                >
                  {item.label}
                </a>
              ))}
            </div>
            {/* Mobile nav dropdown via scroll */}
            <div className="md:hidden flex items-center gap-2 overflow-x-auto custom-scrollbar max-w-[70vw]">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="whitespace-nowrap px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ============ HERO SECTION ============ */}
        <section id="hero" className="relative w-full min-h-[85vh] flex items-center justify-center overflow-hidden">
          <Image
            src="/rever-hero.png"
            alt="REVER - Motoristična aplikacija"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="hero-overlay absolute inset-0" />
          <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto">
            <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 text-sm px-4 py-1.5">
              <Zap className="size-3.5 mr-1.5" />
              Največja GPS skupnost za motoriste
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              REVER{' '}
              <span className="text-primary">— Aplikacija za Motoriste</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Največja GPS skupnost za motocikliste, smučarje in terenske navdušence
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="text-base px-8 orange-glow">
                <Download className="size-5 mr-2" />
                Prenesi aplikacijo
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 border-primary/30 hover:bg-primary/10">
                <BarChart3 className="size-5 mr-2" />
                Oglej si analizo
              </Button>
            </div>
            <div className="mt-12 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Smartphone className="size-4" />
                iOS &amp; Android
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="size-4" />
                3.000+ zemljevidov
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="size-4" />
                Milijoni uporabnikov
              </div>
            </div>
          </div>
        </section>

        {/* ============ O APLIKACIJI ============ */}
        <section id="about" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <Route className="size-3.5 mr-1.5" />
                O aplikaciji
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Kaj je <span className="text-primary">REVER</span>?
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <Card className="border-primary/10 orange-glow">
                <CardContent className="p-6 space-y-4">
                  <p className="text-lg leading-relaxed">
                    <strong className="text-primary">REVER</strong> je največja GPS aplikacija na svetu za motocikliste, voznike smučarskih vozil in terenske navdušence. Ime izhaja iz angleške besede <em>&quot;rev&quot;</em> — kot opis vrtenja motorja (revving).
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Na voljo je na platformah iOS in Android, ponuja pa več kot 3.000 zemljevidov motociklističnih potovanj po vsem svetu. REVER je na voljo kot spletna aplikacija in mobilna aplikacija, kar uporabnikom omogoča načrtovanje poti na računalniku in sledenje na telefonu.
                  </p>
                  <Separator className="my-4" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-primary" />
                      <span>iOS &amp; Android</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-primary" />
                      <span>Spletna aplikacija</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-primary" />
                      <span>3.000+ zemljevidov</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-primary" />
                      <span>GPS sledenje</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-primary" />
                      <span>Butler Maps integracija</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-primary" />
                      <span>Skupnost uporabnikov</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="relative flex items-center justify-center">
                <div className="relative w-full max-w-sm mx-auto">
                  <Image
                    src="/rever-app.png"
                    alt="REVER aplikacija na telefonu"
                    width={400}
                    height={800}
                    className="rounded-2xl shadow-2xl border border-primary/10"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ KLJUČNE FUNKCIJE ============ */}
        <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/30">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <Zap className="size-3.5 mr-1.5" />
                Ključne funkcije
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Vse, kar <span className="text-primary">motorist</span> potrebuje
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                REVER ponuja obsežen nabor funkcij za raziskovanje, sledenje, načrtovanje in navigacijo — vse v eni aplikaciji.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <Card
                  key={f.title}
                  className="group hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                        <f.icon className="size-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{f.emoji} {f.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    <CardDescription className="text-sm leading-relaxed">
                      {f.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ============ REVER PRO ============ */}
        <section id="pro" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <ShieldCheck className="size-3.5 mr-1.5" />
                Premium naročnina
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                REVER <span className="text-primary">Pro</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Primerjajte brezplačno in premium različico ter izberite pravo za vas.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Free card */}
              <Card className="relative">
                <CardHeader>
                  <Badge className="w-fit bg-muted text-muted-foreground border-muted-foreground/20">
                    Brezplačno
                  </Badge>
                  <CardTitle className="text-2xl mt-2">0 €</CardTitle>
                  <CardDescription>Začetna izkušnja za vsakega motorista</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <ul className="space-y-3">
                    {freeFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button variant="outline" className="w-full">
                    Brezplačna različica
                  </Button>
                </CardFooter>
              </Card>

              {/* Pro card */}
              <Card className="relative border-primary/30 orange-glow">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    <Star className="size-3 mr-1" />
                    Priporočeno
                  </Badge>
                </div>
                <CardHeader>
                  <Badge className="w-fit bg-primary/20 text-primary border-primary/30">
                    Pro
                  </Badge>
                  <CardTitle className="text-2xl mt-2">
                    ~40 €<span className="text-base font-normal text-muted-foreground">/leto</span>
                  </CardTitle>
                  <CardDescription>Popolna izkušnja za resne motoriste</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <ul className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                    {proFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="size-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button className="w-full" size="lg">
                    <Zap className="size-4 mr-2" />
                    Nadgradi na Pro
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>

        {/* ============ OCENE IN MNENJA ============ */}
        <section id="reviews" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/30">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <MessageCircle className="size-3.5 mr-1.5" />
                Ocene in mnenja
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Kaj pravijo <span className="text-primary">uporabniki</span>
              </h2>
            </div>

            <Tabs defaultValue="all" className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList>
                  <TabsTrigger value="all">Vse</TabsTrigger>
                  <TabsTrigger value="positive">Pozitivno</TabsTrigger>
                  <TabsTrigger value="negative">Negativno</TabsTrigger>
                  <TabsTrigger value="mixed">Mešano</TabsTrigger>
                </TabsList>
              </div>

              {['all', 'positive', 'negative', 'mixed'].map((tab) => (
                <TabsContent key={tab} value={tab}>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reviews
                      .filter((r) => tab === 'all' || r.type === tab)
                      .map((r, i) => (
                        <Card key={i} className="hover:border-primary/20 transition-colors">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <ReviewBadge type={r.type} />
                              <ReviewIcon type={r.type} />
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 pt-0">
                            <p className="text-sm leading-relaxed italic">
                              &ldquo;{r.text}&rdquo;
                            </p>
                          </CardContent>
                          <CardFooter className="p-6 pt-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{r.author}</span>
                              <span>·</span>
                              <span>{r.source}</span>
                            </div>
                          </CardFooter>
                        </Card>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </section>

        {/* ============ PREDNOSTI IN SLABOSTI ============ */}
        <section id="proscons" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <BarChart3 className="size-3.5 mr-1.5" />
                Prednosti in slabosti
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Uravnotežen <span className="text-primary">pregled</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Prednosti */}
              <Card className="border-emerald-500/20">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-500/10">
                      <ThumbsUp className="size-5 text-emerald-400" />
                    </div>
                    <CardTitle className="text-xl text-emerald-400">Prednosti</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <ul className="space-y-3">
                    {pros.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm">
                        <Check className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Slabosti */}
              <Card className="border-red-500/20">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-xl bg-red-500/10">
                      <ThumbsDown className="size-5 text-red-400" />
                    </div>
                    <CardTitle className="text-xl text-red-400">Slabosti</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <ul className="space-y-3">
                    {cons.map((c) => (
                      <li key={c} className="flex items-start gap-2.5 text-sm">
                        <X className="size-4 text-red-400 mt-0.5 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ============ PRIMERJAVA Z ALTERNATIVAMI ============ */}
        <section id="alternatives" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/30">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <ChevronRight className="size-3.5 mr-1.5" />
                Primerjava
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Alternativne <span className="text-primary">aplikacije</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Kako se REVER primerja z drugimi priljubljenimi aplikacijami za motoriste?
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {alternatives.map((alt) => (
                <Card key={alt.name} className="hover:border-primary/20 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">{alt.name}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      {alt.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    {/* Rating */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`size-3.5 ${
                              i < Math.floor(alt.rating)
                                ? 'text-primary fill-primary'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{alt.rating}/5</span>
                    </div>
                    {/* Pros */}
                    <div>
                      <p className="text-xs font-medium text-emerald-400 mb-1.5">Prednosti</p>
                      <ul className="space-y-1">
                        {alt.pros.map((p) => (
                          <li key={p} className="flex items-start gap-1.5 text-xs">
                            <Check className="size-3 text-emerald-400 mt-0.5 shrink-0" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Cons */}
                    <div>
                      <p className="text-xs font-medium text-red-400 mb-1.5">Slabosti</p>
                      <ul className="space-y-1">
                        {alt.cons.map((c) => (
                          <li key={c} className="flex items-start gap-1.5 text-xs">
                            <X className="size-3 text-red-400 mt-0.5 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ============ SKLEP ============ */}
        <section id="conclusion" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <Trophy className="size-3.5 mr-1.5" />
                Sklep
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Naša <span className="text-primary">ocena</span>
              </h2>
            </div>

            <div className="max-w-3xl mx-auto">
              <Card className="orange-glow border-primary/20">
                <CardHeader className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-8 ${
                          i < 4 ? 'text-primary fill-primary' : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  <CardTitle className="text-4xl font-extrabold text-primary">4 / 5</CardTitle>
                  <CardDescription className="text-base mt-2">
                    REVER je odlična izbira za večino motoristov
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-6">
                  {/* Best for */}
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ThumbsUp className="size-4 text-emerald-400" />
                      <h4 className="font-semibold text-emerald-400">Najboljši za</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <Route className="size-3 mr-1" />
                        Avanturistične voznike
                      </Badge>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <Calendar className="size-3 mr-1" />
                        Načrtovalce poti
                      </Badge>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        <Users className="size-3 mr-1" />
                        Socialne voznike
                      </Badge>
                    </div>
                  </div>

                  {/* Not ideal for */}
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="size-4 text-red-400" />
                      <h4 className="font-semibold text-red-400">Ni idealen za</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                        <Navigation className="size-3 mr-1" />
                        Tiste, ki želijo turn-by-turn kot Google Maps
                      </Badge>
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                        <DollarSign className="size-3 mr-1" />
                        Proračunsko zavedne z naprednimi potrebami
                      </Badge>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Povzetek</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      REVER je vsekakor ena najboljših aplikacij za motoriste na trgu. Njena moč leži v integraciji z Butler Maps, veliki skupnosti uporabnikov in zmožnosti delovanja brez povezave. Brezplačna različica ponuja dovolj funkcij za osnovno uporabo, Pro različica pa odpre vrata do napredne navigacije in ekskluzivnih vsebin. Čeprav UI občasno razočara in navigacija ni na ravni namenskih GPS naprav, je za večino motoristov REVER odlična izbira.
                    </p>
                  </div>

                  {/* Quick score breakdown */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Hitri pregled ocen</h4>
                    {[
                      { label: 'Funkcionalnost', value: 85 },
                      { label: 'Uporabniški vmesnik', value: 65 },
                      { label: 'Navigacija', value: 70 },
                      { label: 'Skupnost', value: 90 },
                      { label: 'Vrednost za denar', value: 75 },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{item.label}</span>
                          <span className="text-primary font-medium">{item.value}%</span>
                        </div>
                        <Progress value={item.value} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="mt-auto border-t border-border/50 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Route className="size-4 text-primary" />
              <span>© 2025 REVER Analiza | Podatki pridobljeni s spleta</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://www.rever.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Globe className="size-3.5" />
                rever.co
                <ExternalLink className="size-3" />
              </a>
              <Separator orientation="vertical" className="h-4" />
              <a
                href="https://play.google.com/store/apps/details?id=co.rever.motorcycle"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Smartphone className="size-3.5" />
                Play Store
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
