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
automatiskt. Workflowen stämplar service workerns `CACHE_VERSION` med
commit-SHA:n, så användarna får nya versioner utan manuell cache-bump.
Aktivera Pages i repo-inställningarna: **Settings → Pages → Source: GitHub
Actions** (en gång).

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

## Teknisk skuld (från teknisk översyn, juli 2026)

Åtgärdat i översynen: cache-stämplingen i deployen (kritisk — uppdateringar
nådde aldrig installerade PWA:er), nätverk-först för navigeringar i service
workern, dynamisk laddning av pdf.js + code-splitting av vyerna, felgräns
(ErrorBoundary), fotoradering efter lyckad sparning i FinishForm,
nollställd vy vid mönsterbyte, importcykeln app/↔patterns bruten,
`user-scalable=no` borttagen och bandet tangentbordsstyrbart.

Kvar att göra, ungefär i prioritetsordning:

1. **Backup utan minnestopp** — `createBackupZip`/`readBackupZip` håller
   hela arkivet + alla blobbar i RAM samtidigt (`zipSync`/`unzipSync`).
   Med ett stort bibliotek riskerar iOS att döda fliken — och backupen är
   enda skyddsnätet. Byt till fflates strömmande `Zip`/`Unzip`.
2. **Transaktionella skrivningar + städning av föräldralösa blobbar** —
   `patch()` är läs-ändra-skriv över två transaktioner och t.ex.
   `deletePattern` (blob-hårdradering + tombstone) är inte atomär. Lägg
   fleroperations-mutationer i en IndexedDB-transaktion och kör en
   städsvep i vilotid som raderar blobbar utan aktiv ägare
   (nåbarhetslogiken finns redan i `merge.js` — extrahera och återanvänd).
3. **Lint + format** — ESLint (särskilt `eslint-plugin-react-hooks` för
   all manuell gest-/pekarkod) och Prettier, som steg i deploy-workflowen.
4. **Fler tester** — `storage.js` med `fake-indexeddb`, `matchPath` i
   routern samt en rundtur backup → återläsning → återställning som
   fångar formatregressioner innan de äter någons data.
5. **Modal-tillgänglighet** — fokusfälla + återställt fokus vid stängning;
   piltangentnavigering i mappraden (`role="tablist"`).
6. **Inställningar i backupen** — bandtjocklek/-opacitet följer inte med
   vid återställning (bara `lastBackupAt` exporteras). Ta med eller
   dokumentera medvetet.
7. **CSP** — appen renderar godtyckliga PDF:er; en
   `Content-Security-Policy`-meta utan externa script-/connect-källor är
   billig härdning (`isEvalSupported: false` är redan satt).
8. **Migrationsmönster i `db.js`** — byt `contains()`-kollarna mot
   `switch (oldVersion)` innan v3, medan historiken är kort.
9. **Statistiken "räknade varv"** — summerar räknarnas *nuvarande* värden,
   så en nollställning raderar historik. Överväg ackumulerande
   `totalTicks` per räknare.
10. **TypeScript eller JSDoc-typedefs** — entitetsformerna (`project`,
    `viewState.band` …) lever bara i konstruktorer och läsande kod; typade
    kontrakt betalar sig när sync (Nivå 2) byggs.
