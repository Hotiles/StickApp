---
name: verify
description: Bygg, kör och verifiera Stickan (PWA) i en riktig webbläsare — inklusive service worker-uppdateringsflödet.
---

# Verifiera Stickan

## Bygg & kör

```bash
npm ci                 # om node_modules saknas
npm test               # enhetstester (merge-logiken)
npm run build          # stämplar sw.js med unik version (se vite.config.js)
npx vite preview --port 4173 --strictPort   # serverar dist/ (kör i bakgrunden)
```

Service workern registreras bara i produktionsbygge — `npm run dev` har ingen SW.

## Driv i webbläsare (Playwright)

Chromium finns förinstallerad; starta med
`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`
(installera `playwright` i en scratch-katalog, inte i projektet).

Appen är en hash-routad SPA: `#/installningar`, `#/monster` osv.

## Verifiera uppdateringsflödet

1. Ladda `http://localhost:4173/`, vänta ~1,5 s så SW hinner installeras.
2. "Deploya" ny version: kör `npm run build` igen (ny stämpel ⇒ byte-skild sw.js).
3. Gå till `#/installningar`, klicka **Sök efter uppdatering** → `.update-banner`
   ska dyka upp (vänta in 0,25 s-animationen före skärmdump).
4. Klicka **Uppdatera** i bannern → sidan laddas om; kontrollera via
   `caches.keys()` att bara den nya `stickan-<version>`-cachen finns kvar
   (`stickan-shared` får finnas).
5. Probes som ska hålla: sök igen utan ny build ⇒ "Du har redan den senaste
   versionen", ingen banner; ändra `dist/index.html` och gör vanlig reload ⇒
   ny HTML direkt (network-first); `context.setOffline(true)` + reload ⇒
   appen renderar ur cachen.

## Gotchas

- `page.waitForFunction` med async-callback resolvar direkt (Promise är
  truthy) — polla med `page.evaluate` i stället.
- Förstainstallationen får inte visa bannern och inte trigga någon reload.
