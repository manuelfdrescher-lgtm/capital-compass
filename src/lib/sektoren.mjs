// Kennzahlen je Sektor aus den Kursreihen der Sektorfonds
// (content/market-history.json, Feld "sektoren"): Veränderung über
// 1 Tag, 1 Woche, 1 Monat, 1 Jahr und ein Mini-Verlauf über 3 Monate.

const TAG = 86400000;
const ms = (t) => Date.parse(`${t.slice(0, 10)}T00:00:00Z`);

function wertVor(series, tage) {
  const grenze = ms(series[series.length - 1].t) - tage * TAG;
  let p = series[0];
  for (const q of series) {
    if (ms(q.t) <= grenze) p = q;
    else break;
  }
  return p;
}

export function sektorKennzahlen(eintrag) {
  const s = eintrag?.series;
  if (!s || s.length < 3) return null;
  const z = s[s.length - 1];
  const pct = (a) => ((z.v - a.v) / a.v) * 100;
  const spanne = (ms(z.t) - ms(s[0].t)) / TAG;
  return {
    stand: z.t,
    symbol: eintrag.symbol,
    source: eintrag.source,
    d1: pct(s[s.length - 2]),
    w1: pct(wertVor(s, 7)),
    m1: pct(wertVor(s, 30)),
    j1: spanne >= 360 ? pct(wertVor(s, 365)) : null,
    spark: sparkline(s.filter((p) => ms(p.t) >= ms(z.t) - 92 * TAG)),
  };
}

// Mini-Verlauf als SVG-Pfad in einer 120x32-Box
function sparkline(teil, W = 120, H = 32) {
  const vs = teil.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const spanne = max - min || 1;
  const pts = teil.map((p, i) => [
    (i / (teil.length - 1)) * W,
    2 + (1 - (p.v - min) / spanne) * (H - 4),
  ]);
  const pfad = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const flaeche = `${pfad} L${W},${H} L0,${H} Z`;
  const letzter = pts[pts.length - 1];
  return { pfad, flaeche, ende: { x: letzter[0], y: letzter[1] }, plus: teil[teil.length - 1].v >= teil[0].v };
}

export function prozentKurz(v) {
  if (v == null || !Number.isFinite(v)) return "–";
  const s = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v));
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${s} %`;
}
