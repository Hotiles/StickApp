# Stickan 🧶

En local-first PWA för stickare: spara mönster-PDF:er, följ var du är med ett
markeringsband, räkna varv med stora knappar och dokumentera färdiga projekt.
Byggd enligt specifikationen v1 — helt offline, ingen backend, all data
stannar på enheten.

## Funktioner

- **Mönsterbibliotek** — importera PDF:er (filväljare eller dela-till-appen via
  Web Share Target), sortera i mappar, öppna fristående för bläddring.
- **Projektvyn** — pdf.js-rendering med pinch-zoom, panorering, sidbläddring
  (knappar + svep vid översiktszoom, dubbeltryck för snabbzoom) och **bandet**:
  en halvtransparent pastellrosa markering som dras med fingret, följer
  dokumentkoordinater vid zoom och sparas per sida.
- **Räknare** — tre som standard (går att lägga till upp till sex eller ta
  bort), stora tryckytor med haptik. Långtryck ger meny: Backa 1 / Nollställ /
  Byt namn / Lägg till / Ta bort.
- **Återuppta** — sida, zoom, scroll, band och räknare sparas löpande
  (debounce ~500 ms + flush när appen göms), så du hamnar exakt där du var.
- **Färdiga projekt** — galleri med foton (komprimeras vid import), garn,
  garnåtgång, stickor, storlek, svårighetsgrad och anteckningar.
- **Backup** — zip med `data.json` + alla blobbar, delas via delningsarket
  eller laddas ner. Återställning med förhandsvisning och två lägen:
  **Ersätt allt** eller **Slå ihop** (nyast vinner — samma logik som en
  framtida sync kommer använda, enhetstestad redan nu).
- **Utseende** — självhostad displayserif (Fraunces), mörkt läge som följer
  systemet (med dämpad PDF-rendering för kvällsstickning), PDF-miniatyrer i
  bibliotek och projektkort, garnfärg per projekt som tonar kort och räknare,
  "Fortsätt sticka"-hjältekort, skelett-laddare och illustrerade tomma
  tillstånd.
- **Smartare räknare** — mål ("varv 47 av 120") med progresslinje,
  upprepningar ("ökning var 6:e varv") som lyser upp på åtgärdsvarvet,
  tick-animation, tiotalsfirande och synlig backa-knapp.
- **Deadline** — datum + etikett per projekt med nedräkning på kortet.
- **Delningskort** — färdiga projekt som genererad bild (foto, garn, stickor,
  svårighetsgrad) att skicka via delningsarket.
- **Garnkorgen** — inventarie över garnet hemma med foto, färg och mängd.
- **Måttbanken** — personer och deras mått ("mammas fotlängd 24 cm").
- **Masktäthet** — provlapp + önskat mått → maskor och varv.
- **Ditt stickår** — statistik: färdiga projekt, räknade varv, foton m.m.

## Teknik

| Område | Val |
|---|---|
| Ramverk | React 18 + Vite |
| PDF | pdf.js (`pdfjs-dist`) |
| Lagring | IndexedDB via `idb` — all åtkomst genom `src/storage/storage.js` |
| Zip | `fflate` |
| Hosting | GitHub Pages (workflow i `.github/workflows/deploy.yml`) |
| Routing | Egen hash-router (funkar på statisk hosting utan serverkonfig) |

Sync-förberedelser (Nivå 2) är på plats: alla entiteter har UUID,
`createdAt`/`updatedAt` (ISO 8601) och soft delete via `deletedAt`; blobbar
refereras alltid via id; merge-logiken finns i `src/storage/merge.js`.

## Utveckling

```bash
npm install
npm run dev        # utvecklingsserver
npm test           # enhetstester (merge-logiken)
npm run build      # produktionsbygge till dist/
```

## Deploy

Push till `main` bygger, kör testerna och publicerar till GitHub Pages
automatiskt. Bygget stämplar service workerns `CACHE_VERSION` med
commit-SHA:n (se `stampServiceWorkerVersion` i `vite.config.js`), så varje
deploy blir en ny service worker-version — ingen manuell cache-bump behövs.
Aktivera Pages i repo-inställningarna: **Settings → Pages → Source: GitHub
Actions** (en gång).

Uppdateringar når användarna så här: HTML serveras network-first (en vanlig
omladdning ger alltid senaste versionen), och när en ny service worker
laddats ner visar appen en banner med en ”Uppdatera”-knapp. Under
Inställningar → Om finns även ”Sök efter uppdatering” för installerade
PWA:er som aldrig stängs helt.

Installera på telefonen: öppna sidan i Safari/Chrome → ”Lägg till på
hemskärmen”.

## Beslut kring öppna frågor i specen

1. **Appnamn:** arbetsnamnet ”Stickan” används tills ni bestämt er — bara att
   söka/ersätta i `manifest.webmanifest`, `index.html` och `HomeView.jsx`.
2. **Bandets tjocklek:** justerbar i Inställningar (10–60 pt), liksom
   opaciteten.
3. **Långtryck:** menyvarianten (säkrare) — ”Backa 1” ligger överst i menyn.
4. **Antal räknare:** 3 som standard, men 1–6 stöds via långtrycksmenyn.

## Kända begränsningar (v1)

- Web Share Target kräver att appen är installerad som PWA och stöds inte i
  iOS Safari — filväljaren är alltid fallback.
- Ingen molnsync — dela data mellan enheter via backup-zip tills vidare.
- Endast PDF som mönsterformat (bilder kan bli v1.1).
