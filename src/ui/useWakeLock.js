import { useEffect } from 'react';

/*
 * Håller skärmen vaken (Screen Wake Lock API) så länge komponenten är
 * monterad och `enabled` är sant — soffläget: man tittar på mönstret i
 * tjugo minuter utan att röra skärmen. Systemet släpper låset när appen
 * göms, så vi tar tillbaka det på visibilitychange. Tyst no-op i
 * webbläsare utan stöd.
 */
export function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock = null;
    let active = true;

    async function acquire() {
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (active) lock = acquired;
        else acquired.release().catch(() => {});
      } catch {
        // Nekad (t.ex. energisparläge) — då får skärmen slockna som vanligt.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') acquire();
    }

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}
