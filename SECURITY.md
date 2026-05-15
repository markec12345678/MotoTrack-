# 🔒 Security Policy — MotoTrack

## Podprte različice

Trenutno podpiramo varnostne posodobitve za naslednje različice:

| Različica | Podprta          |
| ---------- | ---------------- |
| 1.x.x      | ✅ Da            |
| < 1.0      | ❌ Ne            |

## Poročanje o ranljivostih

Če odkrijete varnostno ranljivost v MotoTrack, vas prosimo, da o njej poročate odgovorno.

### 📧 Kako poročati

**NE objavljajte** varnostnih ranljivosti v javnih GitHub Issues.

Namesto tega pošljite poročilo na:

- 📧 **E-pošta:** markec.mototrack@gmail.com
- 📝 **Zadeva:** `[SECURITY] Opis ranljivosti`

### 📋 Kaj vključiti v poročilo

Prosimo, vključite čim več naslednjih informacij:

1. **Vrsta ranljivosti** (npr. XSS, SQL injection, CSRF, itd.)
2. **Poti do ogrožene datoteke** (npr. `src/app/api/...`)
3. **Koraki za reprodukcijo** — podrobna navodila
4. **Dokaz koncepta (PoC)** — če je mogoče
5. **Vpliv** — kaj bi napadalec lahko storil
6. **Predlagana rešitev** — če imate predlog

### ⏱️ Časovni okvir odziva

| Faza | Čas |
|------|-----|
| Potrditev prejema poročila | 48 ur |
| Ocenitev in triaža | 5 delovnih dni |
| Rešitev (patch) | 14 delovnih dni (kritične ranljivosti) |
| Javna objava | Po izdaji popravka |

### 🏆 Priznanje

Odgovorni raziskovalci varnosti bodo navedeni v:

- Seznamu zahval v RELEASES.md
- GitHub Security Advisory (če je primerno)

## Varnostne najboljše prakse za MotoTrack

### 🔐 Za razvijalce

- Nikoli ne shranjujte API ključev, gesel ali tokenov v kodo
- Uporabljajte `.env.local` za lokalne skrivnosti
- Preverjajte vse uporabniške vnose na strežniški strani
- Uporabljajte parameterizirane poizvedbe (Prisma ORM to počne samodejno)
- Redno posodabljajte odvisnosti z `bun update`

### 🛡️ Za uporabnike

- Ne delite svojih API ključev z nikomer
- Uporabljajte HTTPS povezave (Vercel to zagotavlja samodejno)
- Redno posodabljajte aplikacijo (PWA se posodobi samodejno)
- Prijavite sumljivo aktivnost na varnostni e-poštni naslov

## Znane varnostne mere

MotoTrack uporablja naslednje varnostne ukrepe:

- ✅ **Prisma ORM** — zaščita pred SQL injection
- ✅ **Environment Variables** — skrivnosti niso v kodi
- ✅ **HTTPS** — šifrirana komunikacija (via Vercel)
- ✅ **Input Validation** — preverjanje vhodnih podatkov
- ✅ **CORS Protection** — zaščita pred nepooblaščenimi zahtevki
- ✅ **Rate Limiting** — omejevanje števila zahtevkov na API
- ✅ **Content Security Policy** — zaščita pred XSS
- ✅ **PWA Security** — Service Worker deluje le preko HTTPS

## Licence tretjih oseb

MotoTrack uporablja odprtokodne knjižnice. Seznam vseh odvisnosti in njihovih licenc je na voljo v `package.json`.

---

*Varnost je naša prioriteta* 🔒  
*MotoTrack — Made by Markec*
