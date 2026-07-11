let aktivesBackdrop = null;

// Für Auffrisch-Entscheidungen von außen (Sync-Pull): rendert nicht mitten in eine Aufgabe.
export function istModalOffen() { return aktivesBackdrop !== null; }

// backdropSchliesst: false → Klick/Tipp neben das Modal schließt NICHT (nur Button/Escape).
// Für Bereiche mit Zugangs-Hürde (Eltern-PIN), damit ein Wisch-Versehen nicht rauswirft.
export function oeffneModal({ inhaltHtml, onClose, klassen = '', backdropSchliesst = true }) {
  if (aktivesBackdrop) return null; // Mehrfach-Guard

  const backdrop = document.createElement('div');
  backdrop.className = `modal-backdrop ${klassen}`.trim();
  backdrop.innerHTML = inhaltHtml;

  function schliessen() {
    if (backdrop !== aktivesBackdrop) return;
    backdrop.remove();
    document.removeEventListener('keydown', escHandler);
    aktivesBackdrop = null;
    if (onClose) onClose();
  }

  function escHandler(e) {
    if (e.key === 'Escape') schliessen();
  }

  backdrop.addEventListener('click', (e) => {
    if (backdropSchliesst && e.target === backdrop) schliessen();
  });
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(backdrop);
  aktivesBackdrop = backdrop;

  return {
    backdrop,
    schliessen,
    inhalt: backdrop.firstElementChild,
  };
}

export function schliesseAlleModals() {
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  aktivesBackdrop = null;
}
