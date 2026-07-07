/*
 * Uppdateringsflödet för appen.
 * Ny sw.js upptäcks → installeras → hamnar i "waiting" → bannern visas →
 * användaren trycker "Uppdatera" → SKIP_WAITING → controllerchange → reload.
 * Tack vare network-first på HTML ger även en vanlig omladdning senaste
 * versionen; bannern finns för att man ska slippa veta det.
 */

let waitingWorker = null;
let updateRequested = false;
const listeners = new Set();

function setWaiting(worker) {
  waitingWorker = worker;
  for (const cb of listeners) cb(Boolean(waitingWorker));
}

/** Prenumerera på "ny version väntar". Returnerar avregistreringsfunktion. */
export function subscribeToUpdates(cb) {
  listeners.add(cb);
  cb(Boolean(waitingWorker));
  return () => listeners.delete(cb);
}

/** Aktivera den väntande versionen; sidan laddas om via controllerchange. */
export function applyUpdate() {
  if (!waitingWorker) return;
  updateRequested = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Be webbläsaren leta efter ny sw.js nu ("Sök efter uppdatering" i
 * Inställningar). Returnerar true om en ny version hittades/laddas ner.
 */
export async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  await registration.update();
  return Boolean(registration.installing || registration.waiting);
}

function watchRegistration(registration) {
  // En version kan redan ligga och vänta sedan förra besöket
  if (registration.waiting) setWaiting(registration.waiting);

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      // "installed" med en aktiv controller = uppdatering, inte förstainstallation
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }
    });
  });
}

export function registerServiceWorker() {
  // Bara i produktion — stör utvecklingsläget annars
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('load', async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register('./sw.js');
    } catch {
      return;
    }

    watchRegistration(registration);

    // PWA:er stängs sällan helt — leta efter ny version när appen tas fram
    // igen och som fallback en gång i timmen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
    setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
  });

  // Ladda om först när användaren själv valt att uppdatera — inte vid
  // förstainstallationens clients.claim() eller uppdateringar från andra flikar.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested) return;
    updateRequested = false;
    window.location.reload();
  });
}
