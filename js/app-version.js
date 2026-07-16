// Ermittelt die auf DIESEM Gerät aktive App-Version (= Service-Worker-Cache-Version,
// z.B. "v77"). Bewusst die Wahrheit vom Gerät statt vom Server: Die Anzeige existiert
// für den Verdacht „läuft hier ein alter Stand?" — da wäre die Server-Version die
// falsche Auskunft. Anzeige: Eltern-Bereich (Fußzeile), siehe eltern.js.

function kuerze(cacheName) {
  return String(cacheName).replace(/^block-land-/, '');
}

function versionsNummer(cacheName) {
  const m = String(cacheName).match(/^block-land-v(\d+)$/);
  return m ? Number(m[1]) : -1;
}

// „v77" — oder null, wenn (noch) kein Service Worker aktiv ist (z.B. allererster Start).
export async function holeAppVersion() {
  // 1) Den aktiven Service Worker direkt fragen (autoritativ).
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sw = reg?.active;
    if (sw) {
      const antwort = await new Promise((resolve) => {
        const kanal = new MessageChannel();
        const timer = setTimeout(() => resolve(null), 800);   // alter SW ohne Handler antwortet nie
        kanal.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data); };
        sw.postMessage('version?', [kanal.port2]);
      });
      if (antwort?.typ === 'sw-version' && antwort.version) return kuerze(antwort.version);
    }
  } catch { /* weiter zum Fallback */ }

  // 2) Fallback für SW-Stände vor dem Antwort-Handler (v76 und älter): Cache-Namen.
  try {
    const namen = (await caches.keys()).filter(k => versionsNummer(k) >= 0);
    if (namen.length) {
      namen.sort((a, b) => versionsNummer(a) - versionsNummer(b));
      return kuerze(namen[namen.length - 1]);
    }
  } catch { /* kein Cache-Zugriff */ }
  return null;
}
