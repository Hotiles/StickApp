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
