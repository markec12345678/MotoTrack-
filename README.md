# 🏍️ MotoTrack — GPS Sledenje za Motoriste

**MotoTrack** je brezplačna aplikacija za GPS sledenje, načrtovanje in raziskovanje motociklističnih poti po Sloveniji in Balkanu. Navdihnjena po aplikaciji REVER, prilagojena za balkanske motoriste.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2d3748?logo=prisma)
![PWA](https://img.shields.io/badge/PWA-Ready-purple)

---

## 🌟 Ključne funkcije

### 🗺️ Zemljevid
- Interaktivni zemljevid z Leaflet (2D) in MapLibre GL (3D)
- Več stilov: ulice, satelit, teren, temno, topografsko
- Sloji: POI, nevarnosti, gorivo, parkirišča, v živo, kvaliteta cest, promet
- Plavajoče kartice z vožnjami in rutami

### 🛤️ Načrtuj pot
- Načrtovanje z waypointi na zemljevidu
- Tri načini: asfaltirano, vijugasto (Twisty), terensko (Off-road)
- Twisty Route Generator — samodejna vijugasta pot
- Round Trip Generator — krožna tura
- GPX uvoz iz drugih aplikacij
- 53 kuriranih balkanskih cest

### ▶️ Sledi vožnji
- GPS sledenje v realnem času z visoko natančnostjo
- Trenutna hitrost, razdalja, trajanje, višina, najvišja hitrost
- Višinski profil v živo
- Samodejni premor (auto-pause)
- Glasna navigacija (TTS v slovenščini)
- Opozorila o hitrosti
- Zaznavanje trčenja
- Merjenje nagiba klanca

### 🧭 Raziskuj
- Vodilni položaji (Leaderboard)
- Izzivi (Challenges) s točkami in dosežki
- Skupnosti (5 motociklističnih skupnosti)
- 53 balkanskih cest z ocenami (10 držav)
- 17 motociklističnih dogodkov
- 15 moto-prijaznih kampingov
- Iskanje servisov in trgovin

### 👤 Profil
- Osebni podatki in statistika
- Nastavitve goriva (rezervoar, poraba, doseg)
- ICE stiki (v sili)
- Vzdrževanje in opomniki
- Sledenje stroškom
- Zasebne cone
- Seznam voženj in rut

### 🧠 AI pomočnik (MotoChat)
- AI klepet v slovenščini za načrtovanje poti
- Iskanje po spletu za aktualne informacije
- Vremenske napovedi in cestne razmere
- Predlogi rut in prelazov

### 📊 Napredne funkcije
- **ROI analiza** — ocena vrednosti poti (pokrajina, vijugavost, kvaliteta, vreme, gorivo, čas)
- **Video sinhronizacija** — povezava GoPro/Action Cam posnetkov z GPS sledi
- **Live Tracking** — deljenje lokacije v realnem času
- **Offline sinhronizacija** — PWA podpora za delo brez interneta
- **Deljne kartice voženj** — AI-generirane slike za socialna omrežja

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
| **shadcn/ui** | UI komponente |
| **Prisma ORM** | Dostop do podatkovne baze |
| **SQLite / Turso** | Podatkovna baza |
| **Leaflet** | 2D zemljevid |
| **MapLibre GL** | 3D zemljevid |
| **Socket.IO** | Realnočasovna komunikacija |
| **Recharts** | Grafi in diagrami |
| **Framer Motion** | Animacije |
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
│   └── api/              # 80+ API končnih točk
│       ├── chat/         # AI klepet (LLM)
│       ├── tts/          # Besedilo v govor
│       ├── ride-card/    # Generiranje deljnih kartic
│       ├── web-search/   # Iskanje po spletu
│       ├── route-roi/    # ROI analiza rut
│       ├── rides/        # CRUD za vožnje
│       ├── routes/       # CRUD za rute
│       ├── weather/      # Vremenski podatki
│       ├── navigation/   # Turn-by-turn navigacija
│       ├── balkan-roads/ # Kurirane balkanske ceste
│       ├── events/       # Motociklistični dogodki
│       ├── camps/        # Kampi za motoriste
│       └── ...           # In mnoge druge
├── components/
│   ├── tabs/             # Zavihki (Zemljevid, Načrtuj, Sledi, Raziskuj, Profil)
│   ├── moto-map.tsx      # Interaktivni zemljevid
│   ├── moto-chat.tsx     # AI klepet komponenta
│   ├── route-roi-panel.tsx # ROI analiza panel
│   ├── video-sync-panel.tsx # Video sinhronizacija
│   ├── live-tracking-panel.tsx # Live tracking
│   └── ui/               # shadcn/ui komponente
├── hooks/                # React hooks
├── lib/                  # Utility funkcije (db, utils)
└── ...
```

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
Da, v zavihku Načrtuj kliknite GPX uvoz.

**Kako deluje AI pomočnik?**
MotoChat uporablja veliki jezikovni model za odgovarjanje v slovenščini. Lahko išče tudi po spletu za aktualne informacije.

---

## 📄 Licenca

MIT License

---

*MotoTrack — Zgrajen z ❤️ za balkanske motoriste* 🏍️
