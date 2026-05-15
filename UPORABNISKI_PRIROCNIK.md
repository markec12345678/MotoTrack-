# 🏍️ MotoTrack — Uporabniški priročnik

**MotoTrack** je brezplačna aplikacija za GPS sledenje, načrtovanje in raziskovanje motociklističnih poti po Sloveniji in Balkanu. Navdihnjena po aplikaciji REVER, prilagojena za balkanske motoriste.

---

## 📋 Kazalo

1. [Prvi koraki](#1-prvi-koraki)
2. [Zemljevid](#2-zemljevid)
3. [Načrtuj pot](#3-načrtuj-pot)
4. [Sledi vožnji](#4-sledi-vožnji)
5. [Raziskuj](#5-raziskuj)
6. [Profil](#6-profil)
7. [Napredne funkcije](#7-napredne-funkcije)
8. [AI pomočnik (MotoChat)](#8-ai-pomočnik-motochat)
9. [PWA — Namestitev na telefon](#9-pwa--namestitev-na-telefon)
10. [Varnost in zasebnost](#10-varnost-in-zasebnost)
11. [Tehnični podatki](#11-tehnični-podatki)

---

## 1. Prvi koraki

### Namestitev

1. Odprite **MotoTrack** v brskalniku na telefonu ali računalniku
2. Pri prvem odprtju se aplikacija samodejno napolni z demo podatki (3 uporabniki, 10 voženj, 6 rut, 20 zanimivosti)
3. Za najboljšo izkušnjo dodajte aplikacijo na domači zaslon (glejte [PWA namestitev](#9-pwa--namestitev-na-telefon))

### Navigacija

Aplikacija ima **5 glavnih zavihkov** v spodnji navigacijski vrstici:

| Zavihek | Ikona | Opis |
|---------|-------|------|
| **Zemljevid** | 🗺️ | Interaktivni zemljevid z vožnjami, rutami in POI |
| **Načrtuj** | 🛤️ | Načrtovanje novih poti z waypointi |
| **Sledi** | ▶️ | GPS sledenje vožnje v realnem času |
| **Raziskuj** | 🧭 | Skupnost, izzivi, dogodki, balkanske ceste |
| **Profil** | 👤 | Osebni podatki, nastavitve, statistika |

### Hitri dostop

- **FAB gumb** (oranžni krožec s ▶️) na zemljevidu — hitri prehod na sledenje
- **✨ gumb** v zgornji vrstici — napredne funkcije (ROI, Video, V živo, Sync)
- **🔔 ikona** — obvestila
- **🌙/☀️ ikona** — preklop teme (temna/svetla)
- **SOS gumb** — pomoč v sili (vedno vidno)

---

## 2. Zemljevid

### Osnovne funkcije

- **Interaktivni zemljevid** z Leaflet knjižnico — podpira več stilov (ulice, satelit, teren, temno, topografsko)
- **Plavajoče kartice** prikazujejo najbližje vožnje in rute
- **Klik na kartico** odpre podrobnosti z vremenskimi podatki in komentarji

### Sloji na zemljevidu

Vklopite/izklopite lahko naslednje sloje:

| Sloj | Ikona | Opis |
|------|-------|------|
| POI | ⛽🍽️🏍️ | Bencinske črpalke, restavracije, moto srečanja, parkirišča, hoteli, servisi |
| Nevarnosti | ⚠️ | Hitrostne pasti, plazovita območja, zdrsne ceste, divjad, gradbišča |
| Gorivo | ⛽ | Prikaz stanja goriva in dosega |
| Parkirišča | 🅿️ | Lokacija parkiranega motocikla |
| V živo | 🔴 | Dejavni motoristi v realnem času (LiveRIDE) |
| Kvaliteta cest | 🟢🟡🔴 | Ocene cestnih površin s strani uporabnikov |
| Promet | 🚧 | Prometne informacije in zastoji |

### Stil zemljevida

S klikom na ikono slojev izberete med:
- **Ulice** — privzeto, OpenStreetMap
- **Satelit** — satelitski posnetki
- **Teren** — topografski zemljevid
- **Temno** — temna tema za nočno vožnjo
- **Topo** — detailni topografski podatki

### 3D pogled

Kliknite **3D gumb** za 3D prikaz zemljevida z MapLibre GL. Primerno za ogled gorskih prelazov in terena.

---

## 3. Načrtuj pot

### Ustvarjanje nove rute

1. Kliknite na zavihek **Načrtuj**
2. **Kliknite na zemljevid** za dodajanje waypointov
3. Vsak waypoint je označen s številko
4. Razdalja se samodejno izračuna med waypointi

### Načini načrtovanja

| Način | Opis | Največ točk |
|-------|------|-------------|
| **Asfaltirano** | Standardne ceste, izogibanje avtocestam | 25 |
| **Vijugasto** | Iskanje najbolj zavitih cest (Twisty routing) | 25 |
| **Terensko** | Off-road poti, makadamske ceste | 100 |

### Možnosti usmerjanja

- **Izogibaj avtocestam** — načrtuje pot brez avtocest
- **Izogibaj cestnini** — brez plačljivih cest

### Shrani ruto

1. Vnesite **naslov** rute
2. Izberite **kategorijo** (Slikovito, Vijugasto, Terensko, Mesto)
3. Izberite **zahtevnost** (Lahko, Srednje, Težko)
4. Kliknite **Shrani ruto**

### Dodatne funkcije načrtovanja

- **Twisty Route Generator** — samodejno generira vijugasto pot iz začetne točke
- **Round Trip Generator** — krožna tura iz izbrane lokacije
- **GPX uvoz** — uvozite GPX datoteko iz drugih aplikacij
- **Balkanske ceste** — izbor iz 53 kuriranih motociklističnih cest po Balkanu

---

## 4. Sledi vožnji

### Začetek sledenja

1. Kliknite zavihek **Sledi** ali **FAB gumb** na zemljevidu
2. Pritisnite **▶️ Začni** za začetek GPS sledenja
3. Aplikacija pridobiva lokacijo vsakih 5 sekund z visoko natančnostjo

### Med vožnjo

Prikazani podatki v realnem času:
- **Trenutna hitrost** (km/h)
- **Razdalja** (km)
- **Trajanje** (ure:minute:sekunde)
- **Najvišja hitrost** (km/h)
- **Višina** (m)
- **Višinski profil** — graf spremembe višine

### Samodejni premor

Ko hitrost pade pod **5 km/h** za več kot 5 sekund, se snemanje samodejno ustavi (auto-pause). Ko spet dosežete hitrost nad pragom, se snemanje nadaljuje.

### Ustavljanje in shranjevanje

1. Pritisnite **⏹️ Ustavi** za konec snemanja
2. Pritisnite **💾 Shrani vožnjo** za shranjevanje
3. Vožnja se shrani z vsemi GPS podatki in statistiko

### Napredne funkcije med vožnjo

- **🎙️ Glasna navigacija** — TTS navodila v slovenščini (vklopite v nastavitvah)
- **⚡ Opozorila o hitrosti** — opozori, ko presežete nastavljeno omejitev
- **🚨 Zaznavanje trčenja** — samodejno pošlje SOS ob zaznanem trčenju
- **📐 Nagib klanca** — merjenje nagiba motocikla v ovinkih
- **🛡️ Wakelock** — zaslon ostane vklopljen med vožnjo

---

## 5. Raziskuj

### Vodilni položaji (Leaderboard)

Tekmovanje z drugimi motoristi po:
- Skupna razdalja
- Število voženj
- Višinska razlika
- Povprečna hitrost

### Izzivi (Challenges)

Aktivni izzivi za motivacijo:
- **Mesečni km** — prevozite 500 km v mesecu
- **Vikend bojevnik** — 5 voženj v tednu
- **Alpski osvajalec** — 3000m višine v mesecu
- **Veriga dni** — vozite 7 dni zapored
- **Hitrostni kralj** — povprečna hitrost nad 60 km/h

Za vsak izziv se prislužite **točke** in **dosežke**.

### Skupnosti

Pridružite se motociklističnim skupnostim:
- 🏔️ **Alpski motoristi** — gorski prelazi vsako soboto
- 🌊 **Soški jezdeci** — ture po Soški dolini
- 🏖️ **Obalni rajderji** — slovenska obala
- 🏍️ **Enduro Slovenija** — off-road pustolovščine
- 🌙 **Nočni jezdeci Ljubljana** — nočne vožnje

### Balkanske ceste

53 kuriranih motociklističnih cest po Balkanu z ocenami:
- 🇸🇮 Slovenija — Vršič, Soška dolina, Obala, Pohorje
- 🇭🇷 Hrvaška — Jadranska magistrala, Gorski kotar, Lika
- 🇧🇦 BiH — Čabulja, Prenj, Vlašić
- 🇲🇪 Črna gora — Lovćen, Durmitor, Piva
- 🇷🇸 Srbija — Zlatibor, Tara, Kopaonik
- 🇲🇰 Severna Makedonija — Ohrid, Mavrovo
- 🇦🇱 Albanija — SH8 obala, Valbona
- 🇧🇬 Bolgarija — Trakijski prelazi, Rila
- 🇷🇴 Romunija — Transfăgărășan, Transalpina

### Dogodki

17 motociklističnih dogodkov po Balkanu:
- Moto srečanja, rallyji, dirke, razstave, dobrodelne vožnje, festivali

### Kampi

15 motociklističnih kampingov:
- Moto-prijazni kampi z ocenami, cenami in sezonami odprtosti

### Servisi

Iskanje najbližjih servisov in trgovin:
- Avtorizirani servisi (BMW, Honda, Yamaha...)
- Prodajalne delov
- Pnevmatike
- Tehnični pregledi

---

## 6. Profil

### Osebni podatki

- **Ime in e-pošta**
- **Motocikel** — model vašega motocikla
- **Bio** — kratek opis
- **Avatar** — samodejno generiran

### Statistika

- Skupno število voženj in rut
- Skupna prevožena razdalja (km)
- Skupna višinska razlika (m)
- Povprečna hitrost

### Nastavitve

| Nastavitev | Opis | Privzeto |
|-----------|------|----------|
| Enota sistema | Metrično (km) / Imperialno (mi) | Metrično |
| Samodejni premor | Ustavi snemanje pri nizki hitrosti | Vklopljeno |
| Prag samodejnega premora | Hitrost v km/h za premor | 5 km/h |
| Skrij začetek/konec | Zamegli lokacijo začetka/konca vožnje | Izklopljeno |
| Wakelock | Zaslon ostane vklopljen med vožnjo | Vklopljeno |
| Izogibaj cestnini | Pri načrtovanju rut | Izklopljeno |
| Omejitev hitrosti | Opozorilo pri prekoračitvi | 90 km/h |
| Zvočno opozorilo hitrosti | Predvajaj zvok pri opozorilu | Vklopljeno |

### Gorivo

- **Velikost rezervoarja** (litri)
- **Poraba goriva** (L/100km)
- **Trenutno stanje goriva** (litri)
- **Doseg** — preostali kilometri z trenutnim gorivom
- **Zadnje točenje** — datum in lokacija

### V sili (ICE)

Podatki za nujne primere:
- **ICE stik 1** — ime in telefon
- **ICE stik 2** — ime in telefon
- **Krvna skupina**
- **Alergije**

### Vzdrževanje

- Opomniki za vzdrževanje (zamenjava olja, pnevmatik, verige...)
- RAZDALJA ali časovni intervali
- Trenutna kilometrina

### Stroški

Sledenje stroškom:
- Gorivo, vzdrževanje, zavarovanje, deli, cestnina, parkiranje, ostalo

### Zasebne cone

- Določite območja (npr. dom, služba), kjer se lokacija zamegli
- Polmer prilagodite (privzeto 200m)

### Moje vožnje in rute

- Seznam vseh shranjenih voženj in rut
- Brisanje posameznih vnosov
- Ogled podrobnosti z višinskim profilom

---

## 7. Napredne funkcije

Dostopate do njih prek **✨ gumba** v zgornji vrstici.

### 🧠 Pametna priporočila

AI-podprta priporočila rut glede na:
- Trenutno lokacijo
- Vremenske razmere
- Vaše preference
- ROI oceno poti

### 📊 ROI analiza rute

**Return on Investment** analiza za vsako ruto:
- Ocenjenost pokrajine (1-10)
- Vijugavost (1-10)
- Kvaliteta ceste (1-10)
- Vremenska primernost (1-10)
- Učinkovitost goriva (1-10)
- Časovna učinkovitost (1-10)
- Skupni ROI (0-100)

Vključuje tudi:
- **Primerjava rut** — primerjaj dve ruti po vseh parametrih
- **Vremenska priporočila** — kdaj je najboljši čas za ruto
- **Strošek goriva** — ocenjen strošek v EUR

### 🎥 Video sinhronizacija

Povezava GoPro/Action Cam posnetkov z vožnjami:
- Nalaganje video datotek
- GPS sinhronizacija — poravnava videa s potjo
- Samodejno zaznavanje **poudarjenih trenutkov** (visoka hitrost, veliki nagibi)
- **Telemetrični prekrivni sloj** — prikaz hitrosti, višine, G-sile na videu

### 📡 V živo (Live Tracking)

Delite svojo lokacijo v realnem času:
- Ustvarite **sejo sledenja** — dobite deljno povezavo
- Družina/prijatelji vidijo vašo lokacijo na zemljevidu
- Prikaz hitrosti in smeri vožnje
- **Povezava za deljenje** — pošljite SOS ali deljno povezavo

### 🔄 Offline sinhronizacija

PWA podpora za delo brez interneta:
- Spremembe se shranijo v čakalno vrsto
- Ko je povezava ponovno vzpostavljena, se podatki sinhronizirajo
- Stanje čakalne vrste — prikaz čakajočih operacij

---

## 8. AI pomočnik (MotoChat)

MotoTrack vključuje **AI klepet** za pomoč pri načrtovanju poti in odgovarjanje na vprašanja.

### Kako uporabljati

1. Kliknite **klepet ikono** (spodaj desno)
2. Vpišite vprašanje ali prošnjo v slovenščini
3. AI vam bo odgovoril s predlogi rut, vremena, nasveti

### Primeri vprašanj

- *"Katera ruta je najboljša za vikend izlet iz Ljubljane?"*
- *"Kakšno bo vreme v Bovcu ta vikend?"*
- *"Predlagaj mi vijugasto pot z lepimi razgledi"*
- *"Kje so najbližje bencinske črpalke na poti proti Obali?"*
- *"Katera cesta je najboljša za enduro vožnjo?"*

### Iskanje po spletu

MotoChat lahko išče tudi po spletu za:
- Aktualne cestne razmere
- Vremenske opozorila
- Novice o cestnih zapirah

---

## 9. PWA — Namestitev na telefon

MotoTrack je **Progressive Web App** — deluje kot domača aplikacija.

### Android (Chrome)

1. Odprite MotoTrack v Chrome
2. Pritisnite **⋮** (meni) → **Dodaj na domači zaslon**
3. Potrdite namestitev
4. Aplikacija se pojavi na domačem zaslonu z ikono

### iOS (Safari)

1. Odprite MotoTrack v Safari
2. Pritisnite **Deli** (ikona skupna) → **Na domači zaslon**
3. Poimenujte aplikacijo in pritisnite **Dodaj**
4. Aplikacija se pojavi na domačem zaslonu

### Hitri dostop (PWA bližnjice)

Na Androidu lahko dolgo pritisnete na ikono za hitri dostop do:
- **Sledi vožnji** — takoj začnete snemanje
- **Načrtuj pot** — načrtovanje nove rute
- **Raziskuj** — brskanje po rutah

### Offline podpora

Aplikacija deluje tudi brez internetne povezave:
- Zemljevid se predpomni
- Spremembe se shranijo lokalno
- Ob ponovni povezavi se podatki sinhronizirajo

---

## 10. Varnost in zasebnost

### SOS gumb

- Vedno vidno na zaslonu (plavajoča ikona)
- Pritisnite za pošiljanje **SOS alarma** z vašo lokacijo
- Pošlje obvestilo ICE stikom
- Podpira tudi samodejno zaznavanje trčenja

### Zasebne cone

- Določite območja, kjer se lokacija zamegli
- Idealno za skrivanje domačega naslova
- Deluje za začetek in konec vožnje

### Skrij začetek/konec

- V nastavitvah vklopite **Skrij začetek/konec**
- Lokaciji začetka in konca vožnje se zameglita z naključnim odmikom

### Samodejno zaznavanje trčenja

- Aplikacija zazna nenadno spremembo hitrosti (G-sila)
- Samodejno pošlje SOS alarm
- Obvešča ICE stike z lokacijo

---

## 11. Tehnični podatki

### Tehnološki sklad

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
| **Socket.IO** | Realnočasovna komunikacija (Live Tracking) |
| **Recharts** | Grafi in diagrami |
| **Framer Motion** | Animacije |
| **z-ai-web-dev-sdk** | AI funkcionalnosti (LLM, TTS, Image Gen, Web Search) |
| **PWA** | Namestitev kot aplikacija |

### Podatkovna baza

- **30+ modelov** — Uporabniki, Vožnje, Rute, POI, Nevarnosti, Skupnosti, Izzivi, Dosežki, Točke, Stroški, Vzdrževanje, Skupinske vožnje, Dogodki, Kampi, Video posnetki, ROI ocene, itd.
- **SQLite** za razvoj, **Turso** za produkcijo
- Prisma ORM z migracijami

### API končne točke

Aplikacija vključuje **80+ API končnih točk** za vse funkcionalnosti:

- `/api/rides` — CRUD za vožnje
- `/api/routes` — CRUD za rute
- `/api/users` — uporabniki
- `/api/chat` — AI klepet (LLM)
- `/api/tts` — besedilo v govor
- `/api/ride-card` — generiranje deljnih kartic
- `/api/web-search` — iskanje po spletu
- `/api/weather` — vremenski podatki
- `/api/navigation` — turn-by-turn navigacija
- `/api/balkan-roads` — kurirane balkanske ceste
- `/api/events` — motociklistični dogodki
- `/api/camps` — kampi za motoriste
- `/api/seed` — inicializacija demo podatkov (POST only)
- ...in mnoge druge

### Demov podatki

Pri prvem odprtju se naložijo:
- **3 uporabniki** — Miran M. (BMW R1250GS), Luka K. (Yamaha Ténéré 700), Ana S. (Honda CB500X)
- **10 voženj** po Sloveniji
- **6 rut** z različnimi kategorijami
- **20 POI** — bencinske črpalke, restavracije, moto srečanja
- **8 nevarnosti** — hitrostne pasti, plazovi, zdrsne ceste
- **5 skupnosti**
- **5 izzivov**
- **7 dosežkov**

---

## ❓ Pogosta vprašanja

**Ali je MotoTrack brezplačen?**
Da, vse funkcije so brezplačne. Brez naročnine, brez oglasov, brez plačljivih funkcij.

**Ali deluje brez interneta?**
Da, kot PWA aplikacija deluje tudi offline. Spremembe se sinhronizirajo ob ponovni povezavi.

**Ali lahko uvozim GPX datoteke?**
Da, v zavihku Načrtuj kliknite GPX uvoz. Podprte so .gpx datoteke z trasami in rutami.

**Ali lahko delim svojo lokacijo v živo?**
Da, v naprednih funkcijah (✨) → V živo ustvarite sejo sledenja in delite povezavo.

**Kako deluje AI pomočnik?**
MotoChat uporablja veliki jezikovni model (LLM) za odgovarjanje na vprašanja v slovenščini. Lahko išče tudi po spletu za aktualne informacije.

**Ali so moji podatki varni?**
Da, zasebne cone zameglijo občutljive lokacije. SOS funkcija je na voljo 24/7. Priporočamo vklop skrivanja začetka/konca voženj.

---

## 📞 Podpora

Za vprašanja, predloge ali prijavo napac kontaktirajte nas prek GitHub Issues.

---

*MotoTrack — Zgrajen z ❤️ za balkanske motoriste* 🏍️
