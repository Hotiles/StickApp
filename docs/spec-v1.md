# Stickapp — Specifikation v1

> Arbetsnamn: **Stickan** (byt gärna — se Öppna frågor)
> Status: Utkast för granskning
> Målgrupp: Två användare (fru + syster), ingen publik lansering

---

## 1. Mål och principer

- **Local-first PWA** — samma arkitektur som Lilla loggen: IndexedDB, offline-first, ingen backend i v1, hostas på GitHub Pages.
- **Enhandsvänlig** där det spelar roll (räknare), men mönstervyn får vara tvåhandsvänlig.
- **Svensk UI** rakt igenom.
- **Backup från dag ett** (Nivå 1: export/import) — inte en efterhandslösning.
- **Sync-förberedd datamodell** (Nivå 2-redo): varje post har `id` (UUID) och `updatedAt` (ISO 8601), soft delete via `deletedAt`. Ingen sync byggs i v1, men inget ska behöva migreras om/när den kommer.

## 2. Teknikval

| Område | Val | Motivering |
|---|---|---|
| Ramverk | React + Vite | Samma som Lilla loggen, känd stack |
| PDF-rendering | pdf.js (Mozilla) | Renderar till canvas, full kontroll för band-overlay |
| Lagring | IndexedDB (via `idb`-wrapper) | Blobs för PDF/foton, strukturerad data för resten |
| Persistens | `navigator.storage.persist()` vid första start | Skydd mot utrymmesrensning |
| Hosting | GitHub Pages | Gratis, känt flöde |
| Service worker | Cache-first med cache-bump-disciplin | Samma konvention som Lilla loggen |
| Zip (export) | `fflate` eller `client-zip` | Liten, snabb, körs i browsern |

**Inga externa tjänster i v1.** Inga analytics, inga fonter från CDN.

## 3. Datamodell

Alla entiteter har: `id: string (UUID v4)`, `createdAt`, `updatedAt`, `deletedAt: string | null`.

### 3.1 `folder` — mapp för mönster
```
name: string          // användarens eget namn, t.ex. "Sockor"
sortOrder: number
```

### 3.2 `pattern` — sparat mönster (PDF)
```
folderId: string | null   // null = "Osorterat"
name: string
fileBlobId: string        // pekare till blob-store
fileSize: number
pageCount: number
```

### 3.3 `project` — pågående eller färdigt projekt
```
name: string
status: 'pågående' | 'färdigt'
patternId: string | null

// Återuppta-state (uppdateras löpande):
viewState: {
  page: number
  zoom: number
  scrollX: number, scrollY: number
  band: {
    orientation: 'horisontell' | 'vertikal'
    positionByPage: { [page: number]: number }  // position per sida
    visible: boolean
  }
}

counters: [
  { id, label: string, value: number }   // default 3 st: "Varv", "Räknare 2", "Räknare 3"
]

// Projektinfo (fylls i främst vid färdigt projekt):
yarn: string              // garn (fritext: märke, färg, kvalitet)
yarnAmount: string        // garnåtgång, t.ex. "3 nystan / 150 g"
needleSize: string        // stickstorlek
madeSize: string          // vilken storlek man stickade
difficulty: 1–5 | null    // svårighetsgrad
notes: string             // fritext: ändringar, tips till sig själv
photoBlobIds: string[]    // foton (komprimerade)
```

### 3.4 `blob` — separat blob-store
PDF:er och foton lagras i egen object store, refereras via id. Foton komprimeras vid import (max ~1600 px längsta sida, JPEG ~0.8) innan lagring.

### 3.5 `settings`
```
lastBackupAt: string | null
lastOpenedProjectId: string | null
```

## 4. Vyer

### 4.1 Hem
- Lista pågående projekt överst (tryck → öppnar exakt där man var).
- Genvägar: "Nytt projekt", "Mönster", "Färdiga projekt".
- Diskret backup-påminnelse om `lastBackupAt` > 30 dagar eller null.

### 4.2 Mönsterbibliotek
- Mappar (skapa, döp om, ta bort — borttagning flyttar mönster till Osorterat).
- Importera PDF via filväljare eller delningsark (Web Share Target där det stöds; annars filväljare).
- Mönster kan öppnas fristående (utan projekt) för bläddring.

### 4.3 Projektvy (kärnan)
Två lägen i samma vy:

**Mönsterläge (huvudytan):**
- pdf.js-canvas med pinch-zoom och panorering.
- **Bandet:** halvtransparent pastellrosa överstrykning (`rgba(244, 194, 219, 0.4)`, justerbar opacitet i inställningar), helt rak, dras med fingret. Knapp för att växla horisontell/vertikal. Position sparas per sida. Kan döljas.
- Sidbläddring med tydliga knappar + svep.
- Allt state (sida, zoom, scroll, band) sparas debounce:at (~500 ms) till `viewState` → återuppta funkar alltid, även efter att appen dödats.

**Räknarpanel (dockad nertill, alltid synlig i mönsterläge):**
- 3 räknare, stora tryckytor (min 64 px höjd).
- Tryck = +1 med haptik/visuell feedback.
- Långtryck (~500 ms) → liten meny: **Backa 1** / **Nollställ** / **Byt namn**.
- Etiketter redigerbara (t.ex. "Varv", "Mönsterrapport", "Ökningar").

### 4.4 Färdiga projekt
- Galleri med foto + namn.
- Detaljvy: foton, garn, garnåtgång, stickor, storlek, svårighetsgrad (1–5), anteckningar.
- "Markera som färdigt" från pågående projekt → formulär för att fylla i detaljerna.

### 4.5 Inställningar / Backup
- **Säkerhetskopiera nu** → zip med `data.json` (all strukturerad data) + `blobs/` (PDF:er, foton) → delas via delningsarket (sparas till iCloud/Google Drive/Filer).
- **Återställ från backup** → filväljare, validering, förhandsvisning ("Innehåller 4 mönster, 7 projekt — ersätt allt / slå ihop?").
- Slå ihop-läget använder `id` + `updatedAt` (nyast vinner) — samma logik som framtida sync, så den byggs och testas redan här.

## 5. Nivå 2-förberedelser (byggs INTE i v1, men inget får blockera dem)

- [x] UUID + `updatedAt` + soft delete på alla entiteter (§3)
- [x] Merge-logik "nyast vinner" finns redan i backup-import (§4.5)
- [ ] All datalagring går genom ett `storage.js`-lager — inga direkta IndexedDB-anrop från komponenter. Sync blir då ett tillägg bakom samma interface.
- [ ] Blobs refereras alltid via id, aldrig inline — kan flyttas till t.ex. Supabase Storage utan modelländring.
- Kandidat vid behov: **Supabase** (gratisnivå, auth + Postgres + Storage). Beslut skjuts tills behovet finns.

## 6. Komponentstruktur (förslag)

```
src/
  app/            App.jsx, router, service worker-registrering
  storage/        db.js (idb-setup), storage.js (API-lager), backup.js
  pdf/            PdfViewer.jsx, usePdfDocument.js, BandOverlay.jsx
  counters/       CounterPanel.jsx, Counter.jsx
  projects/       ProjectList.jsx, ProjectView.jsx, FinishForm.jsx, ProjectDetails.jsx
  patterns/       PatternLibrary.jsx, FolderList.jsx, ImportPattern.jsx
  settings/       Settings.jsx, BackupRestore.jsx
  ui/             gemensamma komponenter (knappar, modal, långtrycksmeny)
```

## 7. Risker & spikes (görs först)

1. **pdf.js-prestanda på riktiga mobiler** med stora mönster-PDF:er (20+ MB, högupplösta diagram). Testa render-tid, minne, zoom-flyt på fruns och systerns faktiska telefoner. *Mitigering:* rendera endast aktuell sida + förhandsrendera ±1, cachea renderade sidor som bitmap i minnet.
2. **Band-overlay + pinch-zoom-samspel** — bandet ska följa dokumentkoordinater (inte skärmkoordinater) så det sitter kvar på rätt rad vid zoom.
3. **IndexedDB-utrymme på iOS** — verifiera `persist()` + mät faktisk kvot med `navigator.storage.estimate()`, visa använd lagring i inställningar.
4. **Web Share Target-stöd** för PDF-import varierar — filväljaren är alltid fallback.

## 8. Utanför scope (v1)

- Molnsync och konton (Nivå 2)
- Delning av projekt mellan användare (löses tills vidare via backup-zip)
- Radräkning via mönstertolkning/OCR
- Garnlager ("stash")
- Stöd för andra filformat än PDF (bilder som mönster kan bli v1.1)

## 9. Öppna frågor

1. **Appnamn?** (Arbetsnamn "Stickan". Andra kandidater: "Maskan", "Stickboken", "Räta & Aviga".)
2. Ska bandet ha justerbar tjocklek, eller räcker en fast höjd (~en diagramrad)?
3. Långtrycksmeny (säkrare) vs. direkt backning vid långtryck (som systern skrev) — stäm av med henne.
4. Vill de kunna ha fler/färre än 3 räknare per projekt, eller är exakt 3 rätt?
