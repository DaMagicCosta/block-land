// Profilbild mit der Kamera aufnehmen.
//
// Das Bild bleibt auf dem Gerät (siehe setzeAvatarFoto in state.js) — es geht NICHT in den
// Familien-Sync. Kinderfotos haben in einem Drive-Ordner nichts verloren, jedenfalls nicht,
// ohne dass jemand das ausdrücklich so wollte.
//
// Gespeichert wird ein quadratischer JPEG-Ausschnitt, 256×256 — das reicht für einen Avatar
// und hält die Data-URL bei ~20 KB. localStorage hat rund 5 MB, das darf ein Foto nicht fressen.

import { oeffneModal } from './modal.js';
import { setzeAvatarFoto } from './state.js';

const KANTE = 256;
const QUALITAET = 0.8;

// Schneidet mittig ein Quadrat aus dem Video und skaliert es auf KANTE×KANTE.
// Ohne den Zuschnitt wäre das Bild verzerrt — Kameras liefern 4:3 oder 16:9.
function macheQuadrat(video) {
  const canvas = document.createElement('canvas');
  canvas.width = KANTE;
  canvas.height = KANTE;
  const ctx = canvas.getContext('2d');

  const breite = video.videoWidth;
  const hoehe = video.videoHeight;
  const seite = Math.min(breite, hoehe);
  const x = (breite - seite) / 2;
  const y = (hoehe - seite) / 2;

  // Spiegeln: Die Selfie-Vorschau ist gespiegelt (sonst greift man beim Posieren falsch).
  // Das Foto muss genauso aussehen wie die Vorschau, sonst wirkt es „falsch herum".
  ctx.translate(KANTE, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, x, y, seite, seite, 0, 0, KANTE, KANTE);

  return canvas.toDataURL('image/jpeg', QUALITAET);
}

// Öffnet die Kamera, lässt ein Foto aufnehmen und speichert es beim Profil.
// onFertig() wird nur gerufen, wenn wirklich ein Bild übernommen wurde.
export function oeffneKamera(profileId, onFertig) {
  let stream = null;

  const modal = oeffneModal({
    klassen: 'modal-backdrop--eltern',
    inhaltHtml: '<div class="modal modal--eltern"></div>',
    onClose: () => { if (stream) stream.getTracks().forEach(t => t.stop()); },   // Kamera IMMER freigeben
  });
  if (!modal) return;

  modal.inhalt.innerHTML = `
    <div class="eltern__kopf">📷 Foto machen</div>
    <div class="kamera">
      <video class="kamera__video" autoplay playsinline muted></video>
      <canvas class="kamera__vorschau" hidden></canvas>
      <p class="kamera__status">Kamera wird gestartet …</p>
      <div class="kamera__knoepfe">
        <button class="eltern__primary kamera__ausloeser" disabled>📸 Klick!</button>
        <button class="eltern__primary kamera__uebernehmen" hidden>✓ Das nehme ich</button>
        <button class="eltern__sekundaer kamera__nochmal" hidden>↺ Nochmal</button>
        <button class="eltern__sekundaer kamera__abbruch">Abbrechen</button>
      </div>
    </div>
  `;

  const video = modal.inhalt.querySelector('.kamera__video');
  const vorschau = modal.inhalt.querySelector('.kamera__vorschau');
  const status = modal.inhalt.querySelector('.kamera__status');
  const ausloeser = modal.inhalt.querySelector('.kamera__ausloeser');
  const uebernehmen = modal.inhalt.querySelector('.kamera__uebernehmen');
  const nochmal = modal.inhalt.querySelector('.kamera__nochmal');
  const abbruch = modal.inhalt.querySelector('.kamera__abbruch');

  let bild = null;

  function fehler(text) {
    status.textContent = text;
    status.classList.add('kamera__status--fehler');
    video.hidden = true;
    ausloeser.hidden = true;
  }

  (async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      fehler('Dieser Browser kann keine Kamera öffnen.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      video.srcObject = stream;
      status.textContent = 'Schau in die Kamera und drück auf Klick!';
      ausloeser.disabled = false;
    } catch (err) {
      // Häufigster Fall: Kind/Eltern haben die Browser-Nachfrage abgelehnt.
      if (err.name === 'NotAllowedError') fehler('Die Kamera ist nicht erlaubt. Frag deine Eltern.');
      else if (err.name === 'NotFoundError') fehler('Ich finde keine Kamera an diesem Gerät.');
      else fehler(`Die Kamera geht nicht: ${err.name}`);
    }
  })();

  ausloeser.addEventListener('click', () => {
    if (!video.videoWidth) return;   // Stream noch nicht bereit
    bild = macheQuadrat(video);

    // Standbild zeigen, Video anhalten — das Kind soll sehen, was es bekommt.
    const ctx = vorschau.getContext('2d');
    vorschau.width = KANTE; vorschau.height = KANTE;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = bild;

    video.hidden = true;
    vorschau.hidden = false;
    ausloeser.hidden = true;
    uebernehmen.hidden = false;
    nochmal.hidden = false;
    status.textContent = 'Gefällt dir das Bild?';
  });

  nochmal.addEventListener('click', () => {
    bild = null;
    video.hidden = false;
    vorschau.hidden = true;
    ausloeser.hidden = false;
    uebernehmen.hidden = true;
    nochmal.hidden = true;
    status.textContent = 'Schau in die Kamera und drück auf Klick!';
  });

  uebernehmen.addEventListener('click', () => {
    if (!bild) return;
    if (!setzeAvatarFoto(profileId, bild)) {
      fehler('Das Bild passt nicht mehr in den Speicher.');
      return;
    }
    modal.schliessen();     // onClose stoppt die Kamera
    onFertig?.();
  });

  abbruch.addEventListener('click', () => modal.schliessen());
}
