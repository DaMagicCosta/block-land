// Generator für das ZR-10-Fundament (Würfel-Teich). Vier Formen, eine je Stufe:
// 1 subitizing, 2 zerlegung, 3 verliebte (zu 10), 4 rechnen (+/- bis 10).
// Pure (node-testbar). Liefert immer { aufgabentyp:'rechnen10', stufe, form, ergebnis,
// text, vorlese_text, antwort_optionen } + form-spezifische Felder.

export function generiereRechnen10Aufgabe(stufenConfig, distraktorConfig) {
  switch (stufenConfig.nr) {
    case 2:  return zerlegung(stufenConfig, distraktorConfig);
    case 3:  return verliebte(stufenConfig, distraktorConfig);
    case 4:  return rechnen(stufenConfig, distraktorConfig);
    default: return subitizing(stufenConfig, distraktorConfig);
  }
}

function subitizing(cfg, dcfg) {
  const ziel = zufallsZahl(cfg.ziel_min ?? 1, cfg.ziel_max ?? 10);
  return basis('subitizing', cfg.nr, {
    ziel, ergebnis: ziel,
    text: 'Wie viele?',
    vorlese_text: 'Wie viele Punkte siehst du?',
    antwort_optionen: optionenUm(ziel, dcfg),
  });
}

function zerlegung(cfg, dcfg) {
  const ganze = zufallsZahl(cfg.ganze_min ?? 4, cfg.ganze_max ?? 10);
  const teil_a = zufallsZahl(1, ganze - 1);
  const ergebnis = ganze - teil_a;
  return basis('zerlegung', cfg.nr, {
    ganze, teil_a, ergebnis,
    text: `${teil_a} + ⬚ = ${ganze}`,
    vorlese_text: `${teil_a} plus wie viel ist ${ganze}?`,
    antwort_optionen: optionenUm(ergebnis, dcfg),
  });
}

function verliebte(cfg, dcfg) {
  const teil_a = zufallsZahl(cfg.teil_min ?? 1, cfg.teil_max ?? 9);
  const ergebnis = 10 - teil_a;
  return basis('verliebte', cfg.nr, {
    ganze: 10, teil_a, ergebnis,
    text: `${teil_a} + ⬚ = 10`,
    vorlese_text: `${teil_a} plus wie viel ist zehn?`,
    antwort_optionen: optionenUm(ergebnis, dcfg),
  });
}

function rechnen(cfg, dcfg) {
  const istPlus = Math.random() < 0.5;
  let a, b, ergebnis, operator;
  if (istPlus) {
    a = zufallsZahl(1, 9);
    b = zufallsZahl(1, 10 - a);   // a + b <= 10
    ergebnis = a + b; operator = '+';
  } else {
    a = zufallsZahl(2, 10);
    b = zufallsZahl(1, a);        // a - b >= 0
    ergebnis = a - b; operator = '−';
  }
  return basis('rechnen', cfg.nr, {
    a, b, operator, ergebnis,
    text: `${a} ${operator} ${b} = ⬚`,
    vorlese_text: `${a} ${istPlus ? 'plus' : 'minus'} ${b}`,
    antwort_optionen: optionenUm(ergebnis, dcfg),
  });
}

function basis(form, nr, extra) {
  return { aufgabentyp: 'rechnen10', stufe: nr, form, ...extra };
}

// 5 Optionen rund um `richtig`, geklemmt auf [0,10], inkl. richtig, gemischt.
function optionenUm(richtig, dcfg) {
  const anzahl = (dcfg && dcfg.anzahl ? dcfg.anzahl + 1 : 5);
  const optionen = new Set([richtig]);
  let abstand = 1;
  while (optionen.size < anzahl && abstand <= 10) {
    for (const k of [richtig - abstand, richtig + abstand]) {
      if (optionen.size < anzahl && k >= 0 && k <= 10) optionen.add(k);
    }
    abstand++;
  }
  return mische(Array.from(optionen).slice(0, anzahl));
}

function zufallsZahl(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mische(arr) {
  const kopie = [...arr];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}
