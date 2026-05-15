# 🏍️ MotoTrack — GPS Sledenje za Motoriste

**MotoTrack** je brezplačna aplikacija za GPS sledenje, načrtovanje in raziskovanje motociklističnih poti po Sloveniji in Balkanu. Navdihnjena po aplikaciji REVER, prilagojena za balkanske motoriste.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000)](https://mototrack-gamma.vercel.app)
[![Balkan Motorists](https://img.shields.io/badge/For-Balkan%20Riders-orange)](https://mototrack-gamma.vercel.app)

---

## 🌟 Ključne funkcije

### 🗺️ Zemljevid
- Interaktivni zemljevid z Leaflet (2D) in MapLibre GL (3D pogled)
- Več stilov: ulice, satelit, teren, temno, topografsko, OSM
- Sloji: POI, nevarnosti, gorivo, parkirišča, v živo, kvaliteta cest, promet
- Plavajoče kartice z vožnjami in rutami
- 3D zemljevid z reliefnim prikazom
- Nočni način vožnje (rdeč filter za varnejšo vožnjo)

### 🛤️ Načrtuj pot
- Načrtovanje z waypointi na zemljevidu
- Tri načini: asfaltirano, vijugasto (Twisty), terensko (Off-road)
- Twisty Route Generator — samodejna vijugasta pot
- Round Trip Generator — krožna tura
- GPX uvoz iz drugih aplikacij
- GPX izvoz in PDF izvoz poti
- 53 kuriranih balkanskih cest
- Vreme ob poti — vremenski pogoji vzdolž celotne rute

### ▶️ Sledi vožnji
- GPS sledenje v realnem času z visoko natančnostjo
- Trenutna hitrost, razdalja, trajanje, višina, najvišja hitrost
- Višinski profil v živo
- Samodejni premor (auto-pause) pri nizki hitrosti
- Wake Lock — zaslon ostane vklopljen med vožnjo
- Glasna navigacija (TTS v slovenščini)
- Opozorila o hitrosti (nastavljiva meja, zvočni alarm)
- Zaznavanje trčenja — samodejno SOS ob trku
- Merjenje nagiba klanca (Lean Angle)
- Replay voženj — predvajanje preteklih voženj na zemljevidu
- 3D Replay — trodimenzionalni ogled vožnje
- Twistiness Score — ocena vijugavosti poti
- Touring Score — ocena primernosti za turizem
- Statistika voženj (Ride Stats Dashboard) — grafi in povzetki

### 🧭 Raziskuj
- Vodilni položaji (Leaderboard)
- Izzivi (Challenges) s točkami in dosežki
- Skupnosti (5 motociklističnih skupnosti)
- 53 balkanskih cest z ocenami (10 držav)
- 17 motociklističnih dogodkov
- 15 moto-prijaznih kampingov
- Iskanje servisov in trgovin
- Socialni Feed — aktivnosti prijateljev
- Primerjava voženj (Compare Rides)
- Celozaslonski način

### 👤 Profil
- Osebni podatki in statistika
- Nastavitve goriva (rezervoar, poraba, doseg, trenutno gorivo)
- Pametna poraba (Smart Consumption) — izračun dosega
- ICE stiki (v sili) — krvna skupina, alergije
- Vzdrževanje in opomniki (Maintenance Reminders)
- Sledenje stroškom (gorivo, servis, zavarovanje, deli...)
- Zasebne cone — skrivanje lokacije doma/sluzbe
- Seznam voženj in rut
- Priljubljene (Favorites) — shranjevanje za kasneje
- Večdnevna potovanja (Multi-day Trips)
- Garaža — upravljanje motornih koles
- Dosežki (Achievements) — gamifikacija
- Točke in ravni (Points & Levels)
- Ocenjevanje cest (Road Ratings)

### 🧠 AI pomočnik (MotoChat)
- AI klepet v slovenščini za načrtovanje poti
- Iskanje po spletu za aktualne informacije
- Vremenske napovedi in cestne razmere
- Predlogi rut in prelazov
- Predvožnjeni seznam (Pre-Ride Checklist) — AI-generirana kontrolna lista
- Vremenska primernost (Weather Suitability) — ocena ugodnosti za vožnjo

### 📊 Napredne funkcije
- **ROI analiza** — ocena vrednosti poti (pokrajina, vijugavost, kvaliteta, vreme, gorivo, čas)
- **Video sinhronizacija** — povezava GoPro/Action Cam posnetkov z GPS sledi
- **Live Tracking** — deljenje lokacije v realnem času
- **Offline sinhronizacija** — PWA podpora za delo brez interneta
- **Deljne kartice voženj** — AI-generirane slike za socialna omrežja
- **Iskanje po vsem** (Global Search) — Ctrl+K za hitro iskanje
- **Obvestila** — zvonec z realno-časovnimi obvestili
- **SOS gumb** — enoprstitisk klic na pomoč z lokacijo
- **OBD povezava** — povezava z diagnostiko motornega kolesa
- **Bluetooth čelada** — upravljanje povezave s čelado
- **Prometna obvestila** — realno-časovni prometni podatki
- **Gorivo v bližini** — iskanje bencinskih servisov
- **Cene goriva** — prikaz aktualnih cen goriva
- **Pametna priporočila** — AI-generirani predlogi poti
- **Gradientna analiza** — podroben višinski profil
- **Grupne vožnje** — organizacija skupinskih voženj
- **Prijatelji** — sistem prijateljev in sledenje
- **Kino (Cinema)** — predvajanje voženj kot animacijo

---

## 📸 Galerija

<p align="center">
  <img src="public/screenshots/map.jpg" alt="Zemljevid" width="220" />
  <img src="public/screenshots/motochat.jpg" alt="AI Chat — MotoChat" width="220" />
  <img src="public/screenshots/cinema.jpg" alt="Cinema Mode" width="220" />
  <img src="public/screenshots/stats.jpg" alt="Statistika voženj" width="220" />
  <img src="public/screenshots/plan.jpg" alt="Načrtovanje poti" width="220" />
  <img src="public/screenshots/track.jpg" alt="Sledenje vožnji" width="220" />
  <img src="public/screenshots/explore.jpg" alt="Raziskuj" width="220" />
  <img src="public/screenshots/profile.jpg" alt="Profil" width="220" />
</p>

---

## 🚀 Hitri začetek

### Namestitev

```bash
# Kloniraj repozitorij
git clone https://github.com/markec12345678/MotoTrack-.git
cd MotoTrack-

# Namesti odvisnosti
bun install

# Nastavi environment variables
cp .env.example .env
# Uredi .env s svojimi podatki

# Ustvari podatkovno bazo
bun run db:push

# Zaženi razvojni strežnik
bun run dev
```

### Environment Variables

```env
# Lokalni razvoj (SQLite)
DATABASE_URL=file:./db/custom.db

# Turso (produkcija na Vercelu)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# AI Klepet (neobvezno)
OPENROUTER_API_KEY=your-openrouter-key
```

---

## 🛠️ Tehnološki sklad

| Tehnologija | Namen |
|-------------|-------|
| **Next.js 16** | Ogrodje aplikacije (App Router) |
| **TypeScript 5** | Jezik s tipi |
| **Tailwind CSS 4** | Oblikovanje |
| **shadcn/ui** | UI komponente (New York style) |
| **Prisma ORM** | Dostop do podatkovne baze |
| **SQLite / Turso** | Podatkovna baza |
| **Leaflet** | 2D zemljevid |
| **MapLibre GL** | 3D zemljevid |
| **Socket.IO** | Realnočasovna komunikacija |
| **Recharts** | Grafi in diagrami |
| **Framer Motion** | Animacije |
| **Zustand** | Upravljanje stanja |
| **z-ai-web-dev-sdk** | AI funkcionalnosti (LLM, TTS, Image Gen, Web Search) |
| **PWA** | Namestitev kot aplikacija |

---

## 📱 PWA Namestitev

MotoTrack je **Progressive Web App** — deluje kot domača aplikacija na telefonu.

### Android (Chrome)
1. Odprite MotoTrack v Chrome
2. Pritisnite ⋮ → **Dodaj na domači zaslon**

### iOS (Safari)
1. Odprite MotoTrack v Safari
2. Pritisnite Deli → **Na domači zaslon**

---

## 📂 Struktura projekta

```
src/
├── app/
│   ├── page.tsx          # Glavna stran (vse funkcionalnosti)
│   ├── layout.tsx        # Root layout (theme, PWA, error boundary)
│   ├── globals.css       # Globalni stili
│   └── api/              # 104 API končnih točk
│       ├── achievements/ # Dosežki in gamifikacija
│       ├── balkan-roads/ # Kurirane balkanske ceste
│       ├── bluetooth/    # Bluetooth čelada
│       ├── camps/        # Kampi za motoriste
│       ├── challenges/   # Izzivi
│       ├── chat/         # AI klepet (LLM)
│       ├── cinema/       # Predvajanje voženj
│       ├── comments/     # Komentarji
│       ├── communities/  # Skupnosti
│       ├── compare/      # Primerjava voženj
│       ├── crash-detection/ # Zaznavanje trčenja
│       ├── emergency-contacts/ # ICE stiki
│       ├── events/       # Motociklistični dogodki
│       ├── expenses/     # Sledenje stroškom
│       ├── favorites/    # Priljubljene
│       ├── feed/         # Socialni Feed
│       ├── friends/      # Prijatelji
│       ├── fuel/         # Gorivo in poraba
│       ├── fuel-prices/  # Cene goriva
│       ├── gpx/          # GPX uvoz/izvoz/PDF
│       ├── group-rides/  # Grupne vožnje
│       ├── hazards/      # Nevarnosti na cesti
│       ├── leaderboard/  # Vodilni položaji
│       ├── lean-angle/   # Nagib klanca
│       ├── live-tracking/ # Live tracking
│       ├── maintenance/  # Vzdrževanje
│       ├── map-styles/   # Stili zemljevida
│       ├── navigation/   # Turn-by-turn navigacija
│       ├── notifications/ # Obvestila
│       ├── obd/          # OBD diagnostika
│       ├── offline-maps/ # Offline zemljevidi
│       ├── offroad-route/ # Terenske poti
│       ├── parking/      # Parkirišča
│       ├── photos/       # Fotografije
│       ├── points/       # Točke in ravni
│       ├── pois/         # Zanimive točke
│       ├── privacy-zones/ # Zasebne cone
│       ├── ride-animation/ # Animacija voženj
│       ├── ride-card/    # Generiranje deljnih kartic
│       ├── rides/        # CRUD za vožnje
│       ├── road-conditions/ # Cestne razmere
│       ├── road-ratings/ # Ocene cest
│       ├── round-trip/   # Krožna tura
│       ├── route-recommendations/ # Priporočila rut
│       ├── route-roi/    # ROI analiza rut
│       ├── routes/       # CRUD za rute
│       ├── seed/         # Seed podatki
│       ├── service-centers/ # Servisi
│       ├── services/     # Iskanje servisov
│       ├── settings/     # Nastavitve
│       ├── share/        # Deljenje
│       ├── smart-consumption/ # Pametna poraba
│       ├── sos/          # SOS klic na pomoč
│       ├── speed-settings/ # Nastavitve hitrosti
│       ├── stats/        # Statistika
│       ├── sync-queue/   # Offline sinhronizacija
│       ├── touring-score/ # Touring Score
│       ├── traffic/      # Promet
│       ├── trips/        # Večdnevna potovanja
│       ├── tts/          # Besedilo v govor
│       ├── twisty-route/ # Vijugasta pot
│       ├── user/         # Trenutni uporabnik
│       ├── users/        # Uporabniki
│       ├── videos/       # Video posnetki
│       ├── weather/      # Vremenski podatki
│       ├── weather-alerts/ # Vremenska opozorila
│       ├── weather-along-route/ # Vreme ob poti
│       └── web-search/   # Iskanje po spletu
├── components/
│   ├── tabs/             # Zavihki (Zemljevid, Načrtuj, Sledi, Raziskuj, Profil)
│   ├── moto-map.tsx      # Interaktivni zemljevid
│   ├── moto-chat.tsx     # AI klepet komponenta
│   ├── route-roi-panel.tsx # ROI analiza panel
│   ├── video-sync-panel.tsx # Video sinhronizacija
│   ├── live-tracking-panel.tsx # Live tracking
│   ├── ride-replay-player.tsx # Replay voženj
│   ├── ride-replay-3d.tsx # 3D Replay
│   ├── twistiness-score.tsx # Twistiness Score
│   ├── touring-score.tsx # Touring Score
│   ├── bike-garage.tsx   # Garaža (upravljanje motociklov)
│   ├── weather-along-route-ui.tsx # Vreme ob poti
│   ├── pre-ride-checklist.tsx # Predvožnjeni seznam
│   ├── weather-suitability.tsx # Vremenska primernost
│   ├── ride-stats-dashboard.tsx # Statistika voženj
│   ├── nearby-roads-panel.tsx # Ceste v bližini
│   ├── road-conditions-panel.tsx # Cestne razmere
│   ├── crash-detection.tsx # Zaznavanje trčenja
│   ├── sos-button.tsx    # SOS gumb
│   ├── obd-connector.tsx # OBD povezava
│   ├── bluetooth-helmet.tsx # Bluetooth čelada
│   ├── lean-angle-display.tsx # Nagib klanca
│   ├── global-search.tsx # Globalno iskanje (Ctrl+K)
│   ├── notification-bell.tsx # Obvestila
│   ├── night-mode-toggle.tsx # Nočni način
│   ├── fuel-finder.tsx   # Iskanje goriva
│   ├── fuel-price-card.tsx # Cene goriva
│   ├── smart-consumption-panel.tsx # Pametna poraba
│   ├── smart-recommendations-panel.tsx # Pametna priporočila
│   ├── gradient-analysis.tsx # Gradientna analiza
│   ├── traffic-alerts.tsx # Prometna obvestila
│   ├── challenges-panel.tsx # Izzivi
│   ├── achievements-panel.tsx # Dosežki
│   ├── points-panel.tsx  # Točke in ravni
│   ├── pwa-install-prompt.tsx # PWA namestitev
│   ├── app-share-button.tsx # Deljenje aplikacije
│   ├── error-boundary.tsx # Error boundary
│   ├── features/         # Funkcijski panoji
│   └── ui/               # shadcn/ui komponente
├── hooks/                # React hooks (use-settings, use-debounce, use-mobile)
├── lib/                  # Utility funkcije (db, utils, offline-protocol, notifications)
└── ...
```

---

## 🗄️ Podatkovna baza

34 Prisma modelov za popolno funkcionalnost:

| Model | Namen |
|-------|-------|
| User | Uporabniki z nastavitvami, ICE, gorivo |
| Ride | GPS vožnje s track podatki |
| Route | Načrtovane poti z waypointi |
| Comment | Komentarji na vožnje/rute |
| Like | Všečki na rutah |
| Poi | Zanimive točke |
| Achievement | Dosežki |
| Community | Skupnosti |
| CommunityMember | Člani skupnosti |
| Hazard | Nevarnosti na cesti |
| Friendship | Prijatelji |
| Notification | Obvestila |
| SosAlert | SOS klici |
| Photo | Fotografije |
| RoadRating | Ocene cest |
| Trip | Večdnevna potovanja |
| TripDay | Dnevi potovanja |
| Expense | Stroški |
| MaintenanceReminder | Opomniki vzdrževanja |
| GroupRide | Grupne vožnje |
| GroupRideParticipant | Udeleženci |
| LiveTrackingSession | Live tracking seje |
| LiveTrackingViewer | Ogledovalci |
| CrashEvent | Trki |
| LeanAngleSession | Nagib seje |
| GpxImport | GPX uvozi |
| Challenge | Izzivi |
| ChallengeParticipant | Udeleženci izzivov |
| MapStyleConfig | Nastavitve zemljevida |
| ServiceCenter | Servisi |
| UserPoints | Točke uporabnikov |
| PointsTransaction | Transakcije točk |
| Favorite | Priljubljene |
| SocialActivity | Socialni Feed |
| ActivityLike | Všečki na Feed |
| OfflineMap | Offline zemljevidi |
| PrivacyZone | Zasebne cone |
| MotoEvent | Motociklistični dogodki |
| CampSite | Kampi |
| VideoFootage | Video posnetki |
| VideoHighlight | Video izseki |
| RouteRoiScore | ROI ocene |
| OfflineSyncQueue | Offline sinhronizacija |

---

## 🌍 Balkanske ceste

53 kuriranih motociklističnih cest po 10 državah:

- 🇸🇮 **Slovenija** — Vršič, Soška dolina, Obala, Pohorje, Jezersko, Pokljuka
- 🇭🇷 **Hrvaška** — Jadranska magistrala, Gorski kotar, Lika, Pelješac
- 🇧🇦 **BiH** — Čabulja, Prenj, Vlašić
- 🇲🇪 **Črna gora** — Lovćen, Durmitor, Piva, Kotor serpentine
- 🇷🇸 **Srbija** — Zlatibor, Tara, Kopaonik
- 🇲🇰 **Severna Makedonija** — Ohrid, Mavrovo
- 🇦🇱 **Albanija** — SH8 obala, Valbona, Theth
- 🇧🇬 **Bolgarija** — Trakijski prelazi, Rila, Rodopi
- 🇷🇴 **Romunija** — Transfăgărășan, Transalpina, Transbucegi
- 🇬🇷 **Grčija** — Meteora, Pindos

---

## ❓ Pogosta vprašanja

**Ali je MotoTrack brezplačen?**
Da, vse funkcije so brezplačne. Brez naročnine, brez oglasov, brez plačljivih funkcij.

**Ali deluje brez interneta?**
Da, kot PWA aplikacija deluje tudi offline. Spremembe se sinhronizirajo ob ponovni povezavi.

**Ali lahko uvozim GPX datoteke?**
Da, v zavihku Načrtuj kliknite GPX uvoz. Podprt je tudi izvoz in PDF.

**Kako deluje AI pomočnik?**
MotoChat uporablja veliki jezikovni model za odgovarjanje v slovenščini. Lahko išče tudi po spletu za aktualne informacije.

**Kako deluje SOS gumb?**
SOS gumb pošlje lokacijo in obvestilo ICE stikom. Ob trku se aktivira samodejno.

**Ali podpira več motornih koles?**
Da, v Garaži lahko upravljate več motornih koles z nastavitvami za vsako.

---

## ❤️ Podpri projekt

MotoTrack je brezplačen in odprtokoden. Če ti aplikacija pomaga, lahko podpreš razvoj z:

- [GitHub Sponsors](https://github.com/sponsors/markec12345678)
- [Buy Me a Coffee](https://www.buymeacoffee.com/markec)
- Deljenjem aplikacije s prijatelji motoristi 🏍️

---

## 📄 Licenca

MIT License

---

*MotoTrack — Zgrajen z ❤️ za balkanske motoriste* 🏍️  
*Made by Markec*
