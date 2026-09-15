// Holt die letzten Meldungen der Fehler-Raupe aus dem Familien-Blatt (über das Apps Script).
// Aufruf:  node tools/hole-meldungen.mjs [anzahl=5] [--roh]
//
// URL und Familien-Schlüssel stehen NICHT im Repo (öffentlich!), sondern in einer Datei im
// Benutzerordner:  ~/.blockland-sync.json  →  { "url": "https://script.google.com/.../exec", "schluessel": "…" }
// Ohne --roh wird kompakt ausgegeben: Kopf, Aufgabe, Knöpfe, gespeicherte Reihe, letzte Schritte.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const pfad = join(homedir(), '.blockland-sync.json');
let cfg;
try {
  cfg = JSON.parse(readFileSync(pfad, 'utf8'));
} catch {
  console.error(`Konfiguration fehlt oder ist kaputt: ${pfad}\nInhalt: { "url": "…/exec", "schluessel": "…" }`);
  process.exit(2);
}
if (!cfg.url || !cfg.schluessel) { console.error(`url oder schluessel fehlt in ${pfad}`); process.exit(2); }

const anzahl = Number(process.argv.find(a => /^\d+$/.test(a)) ?? 5);
const roh = process.argv.includes('--roh');
const res = await fetch(`${cfg.url}?schluessel=${encodeURIComponent(cfg.schluessel)}&meldungen=${anzahl}`);
const text = await res.text();
let json;
try { json = JSON.parse(text); } catch {
  console.error(`Keine JSON-Antwort (HTTP ${res.status}) — Apps Script neu bereitgestellt?\n${text.slice(0, 300)}`);
  process.exit(1);
}
if (!json.ok) { console.error(`Abgelehnt: ${json.fehler ?? 'unbekannt'}`); process.exit(1); }
if (json.meldungen === undefined) { console.error('Das Apps Script kennt die Abfrage noch nicht — neue Version bereitstellen.'); process.exit(1); }
if (roh) { console.log(JSON.stringify(json, null, 2)); process.exit(0); }

console.log(`${json.meldungen.length} von ${json.gesamt ?? '?'} Meldungen, neueste zuerst\n`);
for (const { meldung: m, ts, kind, grund } of json.meldungen) {
  if (!m) continue;
  console.log(`━━ ${new Date(ts).toLocaleString('de-AT')} · ${kind} · ${grund} · ${m.fassung ?? ''} · ${m.bildschirm ?? ''} ${m.land ?? ''} · ${m.himmel ?? ''} · ${m.bildschirmGroesse ?? ''}`);
  if (m.aufgabeText) console.log(`   Aufgabe:  ${m.aufgabeText}`);
  if (m.knoepfe?.length) console.log(`   Knöpfe:   ${m.knoepfe.map(k => `${k.text}${k.sichtbar ? '' : '(!Bild)'}`).join(' | ')}`);
  const a = m.reihe?.aufgabe;
  if (a) {
    console.log(`   Reihe:    ${m.reihe.position}/${m.reihe.laenge} · ${a.aufgabentyp} Stufe ${a.stufe} · ${a.text} → ${a.ergebnis} · Angebot [${(a.antwort_optionen ?? []).join(', ')}]`
      + ` · Fehlversuche ${m.reihe.fehlversuche ?? 0}${a.box ? ` · Fehler-Box Fach ${a.box.fach}` : ''}`);
  }
  const letzte = (m.protokoll ?? []).slice(-12);
  if (letzte.length) console.log(`   Letzte Schritte:\n${letzte.map(e => `     +${e.t}s ${e.art.padEnd(8)} ${e.text}`).join('\n')}`);
  console.log('');
}
