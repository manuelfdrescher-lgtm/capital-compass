// Gemeinsame Rechenlogik für den interaktiven Kurs-Chart (KursChart.astro):
// Zeitraum-Ausschnitt, Skalen, Pfade und Achsenbeschriftung. Wird auf dem
// Server (erste Ansicht ohne JavaScript) und im Browser (Umschalten,
// Überfahren) genutzt, damit beide Ansichten exakt gleich aussehen.

// Formate: breit (Markt-Chart), normal (Artikel), kompakt (Aktienkarten).
export const FORMATE = {
  breit: { w: 960, h: 320 },
  normal: { w: 760, h: 320 },
  kompakt: { w: 520, h: 300 },
};
export const PAD = { top: 16, right: 18, bottom: 32, left: 64 };

export const SPANNEN = [
  { key: "1M", label: "1 Monat", tage: 31 },
  { key: "3M", label: "3 Monate", tage: 92 },
  { key: "6M", label: "6 Monate", tage: 183 },
  { key: "1J", label: "1 Jahr", tage: 366 },
  { key: "3J", label: "3 Jahre", tage: 1096 },
  { key: "5J", label: "5 Jahre", tage: 1827 },
];

const TAG = 86400000;
const ms = (t) => Date.parse(`${t.slice(0, 10)}T00:00:00Z`);

export function spanneTage(series) {
  if (series.length < 2) return 0;
  return (ms(series[series.length - 1].t) - ms(series[0].t)) / TAG;
}

// Zeiträume, für die genug Daten da sind; "Max" kommt immer dazu.
export function verfuegbareSpannen(series) {
  const tage = spanneTage(series);
  const liste = SPANNEN.filter((s) => tage >= s.tage * 0.85);
  return [...liste, { key: "Max", label: "gesamter Zeitraum", tage: Infinity }];
}

export function ausschnitt(series, spanneKey) {
  const s = SPANNEN.find((x) => x.key === spanneKey);
  if (!s || series.length === 0) return series;
  const grenze = ms(series[series.length - 1].t) - s.tage * TAG;
  const teil = series.filter((p) => ms(p.t) >= grenze);
  return teil.length >= 2 ? teil : series.slice(-2);
}

function schoeneSchritte(min, max, anzahl = 5) {
  const roh = (max - min) / anzahl || 1;
  const pot = Math.pow(10, Math.floor(Math.log10(roh)));
  const schritt = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((s) => s >= roh) ?? 10 * pot;
  const start = Math.floor(min / schritt) * schritt;
  const ende = Math.ceil(max / schritt) * schritt;
  const werte = [];
  for (let v = start; v <= ende + schritt / 2; v += schritt) werte.push(Number(v.toPrecision(12)));
  return werte;
}

export function nachkomma(v) {
  const a = Math.abs(v);
  return a >= 1000 ? 0 : a >= 10 ? 2 : 4;
}

export function zahl(v, stellen = nachkomma(v)) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen }).format(v);
}

export function prozent(v) {
  const s = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v));
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${s} %`;
}

const MONATE = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];

export function datumLang(t) {
  const [j, m, d] = t.slice(0, 10).split("-");
  return `${d}.${m}.${j}`;
}

function datumAchse(t, tage) {
  const [j, m, d] = t.slice(0, 10).split("-");
  if (tage <= 100) return `${d}.${m}.`;
  if (tage <= 800) return `${MONATE[Number(m) - 1]} ${j.slice(2)}`;
  return j;
}

// Alle Geometrie-Daten für einen Ausschnitt.
export function geometrie(teil, W = FORMATE.normal.w, H = FORMATE.normal.h) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const werte = teil.map((p) => p.v);
  let min = Math.min(...werte);
  let max = Math.max(...werte);
  if (min === max) { min -= 1; max += 1; }
  const ticks = schoeneSchritte(min - (max - min) * 0.04, max + (max - min) * 0.04);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const t0 = ms(teil[0].t);
  const t1 = ms(teil[teil.length - 1].t);
  const dt = t1 - t0 || 1;
  const x = (t) => PAD.left + ((ms(t) - t0) / dt) * plotW;
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const punkte = teil.map((p) => ({ x: Number(x(p.t).toFixed(1)), y: Number(y(p.v).toFixed(1)), t: p.t, v: p.v }));
  const pfad = punkte.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const boden = (H - PAD.bottom).toFixed(1);
  const flaeche = `${pfad} L${punkte[punkte.length - 1].x},${boden} L${punkte[0].x},${boden} Z`;
  const schritt = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const stellen = schritt >= 1 ? 0 : schritt >= 0.1 ? 1 : schritt >= 0.01 ? 2 : 3;
  const gitter = ticks.map((v) => ({ y: Number(y(v).toFixed(1)), label: zahl(v, stellen) }));
  const tage = dt / TAG;
  // Vier Beschriftungen in gleichen Zeitabständen (nicht nach Punktindex,
  // sonst ballen sie sich im täglich aufgelösten letzten Jahr).
  const naechsterIndex = (ziel) => {
    let best = 0;
    for (let i = 1; i < teil.length; i++) if (Math.abs(ms(teil[i].t) - ziel) < Math.abs(ms(teil[best].t) - ziel)) best = i;
    return best;
  };
  const idx = [...new Set([0, 1, 2, 3].map((k) => naechsterIndex(t0 + (dt * k) / 3)))];
  const xTicks = idx.map((i, k) => ({
    x: punkte[i].x,
    label: datumAchse(teil[i].t, tage),
    anker: k === 0 ? "start" : k === idx.length - 1 ? "end" : "middle",
  }));
  return { punkte, pfad, flaeche, gitter, xTicks };
}
