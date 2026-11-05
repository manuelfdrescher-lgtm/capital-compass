// Lädt Kursverläufe für die interaktiven Charts über die kostenlose
// Yahoo-Finance-Chart-API und schreibt sie in eine Editions-Datei:
//   1) content/market-history.json: Leitindizes, SAP, Rohstoffe, Devisen,
//      Bitcoin (5 Jahre: letztes Jahr täglich, davor ein Wert je Woche).
//      Eine Datei für die jeweils neueste Ausgabe, wird täglich überschrieben.
//   2) stockPicks[].priceSeries: Kursverlauf der drei Aktien in Euro
// Aufruf: node scripts/fetch-history.mjs content/editions/<datei>.json
// Nicht fatal: Was nicht geladen werden kann, fehlt einfach im Chart.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = process.argv[2];
if (!file) {
  console.error("Aufruf: node scripts/fetch-history.mjs content/editions/<datei>.json");
  process.exit(1);
}

// Yahoo antwortet auf lange Browser-Kennungen mit 429, auf die kurze Form nicht.
const HEADERS = { "User-Agent": "Mozilla/5.0" };
const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GICS-Sektoren, gemessen an den US-Sektorfonds (SPDR Select Sector)
const SEKTOREN = [
  ["Energie", "XLE"],
  ["Grundstoffe", "XLB"],
  ["Industrie", "XLI"],
  ["Zyklischer Konsum", "XLY"],
  ["Basiskonsum", "XLP"],
  ["Gesundheit", "XLV"],
  ["Finanzen", "XLF"],
  ["Informationstechnologie", "XLK"],
  ["Kommunikation", "XLC"],
  ["Versorger", "XLU"],
  ["Immobilien", "XLRE"],
  ["Gesamtmarkt", "SPY"], // Maßstab: S&P 500
];

const INSTRUMENTE = [
  { key: "dax", label: "DAX", symbol: "^GDAXI", unit: " Pkt." },
  { key: "sap", label: "SAP-Aktie", symbol: "SAP.DE", unit: " €" },
  { key: "eurostoxx", label: "Euro Stoxx 50", symbol: "^STOXX50E", unit: " Pkt." },
  { key: "sp500", label: "S&P 500", symbol: "^GSPC", unit: " Pkt." },
  { key: "nasdaq100", label: "Nasdaq 100", symbol: "^NDX", unit: " Pkt." },
  { key: "gold", label: "Gold", symbol: "GC=F", unit: " $/Unze" },
  { key: "brent", label: "Öl (Brent)", symbol: "BZ=F", unit: " $/Barrel" },
  { key: "eurusd", label: "EUR/USD", symbol: "EURUSD=X", unit: " $" },
  { key: "bitcoin", label: "Bitcoin", symbol: "BTC-EUR", unit: " €" },
];

async function getJson(path) {
  for (let versuch = 0; versuch < 5; versuch++) {
    try {
      const res = await fetch(`https://${HOSTS[versuch % 2]}${path}`, { headers: HEADERS });
      if (res.ok) return await res.json();
      await sleep(res.status === 429 ? 2500 * (versuch + 1) : 600);
    } catch {
      await sleep(600);
    }
  }
  return null;
}

// gesamtrendite: Schlusskurse inklusive Dividenden (adjclose), damit
// dividendenstarke Sektoren nicht schlechter aussehen, als sie sind.
async function verlauf(symbol, gesamtrendite = false) {
  const j = await getJson(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`);
  const r = j?.chart?.result?.[0];
  if (!r?.timestamp) return null;
  const closes = (gesamtrendite ? r.indicators?.adjclose?.[0]?.adjclose : null) ?? r.indicators?.quote?.[0]?.close ?? [];
  const punkte = [];
  r.timestamp.forEach((ts, i) => {
    const v = closes[i];
    if (v == null || !Number.isFinite(v)) return;
    const t = new Date(ts * 1000).toISOString().slice(0, 10);
    if (punkte.length && punkte[punkte.length - 1].t === t) punkte[punkte.length - 1].v = v;
    else punkte.push({ t, v });
  });
  return { currency: r.meta?.currency ?? null, punkte };
}

// Letztes Jahr täglich, davor nur der letzte Handelstag jeder Woche.
function ausduennen(punkte) {
  if (punkte.length === 0) return punkte;
  const ende = new Date(punkte[punkte.length - 1].t);
  ende.setFullYear(ende.getFullYear() - 1);
  const schnitt = ende.toISOString().slice(0, 10);
  const woche = (t) => Math.floor((Date.parse(t) / 86400000 + 3) / 7);
  const out = [];
  for (const p of punkte) {
    const vorher = out[out.length - 1];
    if (p.t < schnitt && vorher && vorher.t < schnitt && woche(vorher.t) === woche(p.t)) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

const runden = (v) => Number(v.toFixed(Math.abs(v) >= 100 ? 2 : 4));

// Umrechnung in Euro mit dem Tageskurs (Yahoo-Paar EUR<Währung>=X).
async function inEuro(punkte, waehrung) {
  let faktor = 1;
  let cur = waehrung;
  if (cur === "GBp" || cur === "GBX") { faktor = 0.01; cur = "GBP"; }
  if (cur === "ZAc") { faktor = 0.01; cur = "ZAR"; }
  if (cur === "EUR") return punkte.map((p) => ({ t: p.t, v: p.v * faktor }));
  const fx = await verlauf(`EUR${cur}=X`);
  if (!fx || fx.punkte.length === 0) return null;
  const kurse = fx.punkte;
  let k = 0;
  return punkte.map((p) => {
    while (k + 1 < kurse.length && kurse[k + 1].t <= p.t) k++;
    return { t: p.t, v: (p.v * faktor) / kurse[k].v };
  });
}

async function symbolFuer(pick) {
  const j = await getJson(`/v1/finance/search?q=${encodeURIComponent(pick.name)}&quotesCount=10&newsCount=0`);
  const quotes = (j?.quotes ?? []).filter((q) => q.quoteType === "EQUITY" && q.symbol);
  const ticker = String(pick.ticker ?? "").toUpperCase();
  return (
    quotes.find((q) => q.symbol.toUpperCase() === ticker) ??
    quotes.find((q) => q.symbol.toUpperCase().split(".")[0] === ticker) ??
    quotes[0]
  )?.symbol ?? null;
}

const json = JSON.parse(readFileSync(file, "utf8"));

const history = [];
for (const inst of INSTRUMENTE) {
  const r = await verlauf(inst.symbol);
  await sleep(350);
  if (!r || r.punkte.length < 30) {
    console.warn(`⚠️  ${inst.label}: kein Verlauf geladen`);
    continue;
  }
  history.push({
    key: inst.key,
    label: inst.label,
    unit: inst.unit,
    source: `Yahoo Finance (${inst.symbol}), Schlusskurse`,
    series: ausduennen(r.punkte).map((p) => ({ t: p.t, v: runden(p.v) })),
  });
  console.log(`✓ ${inst.label}: ${r.punkte.length} Tage`);
}
const sektoren = {};
for (const [name, symbol] of SEKTOREN) {
  const r = await verlauf(symbol, true);
  await sleep(300);
  if (!r || r.punkte.length < 30) {
    console.warn(`⚠️  Sektor ${name} (${symbol}): kein Verlauf geladen`);
    continue;
  }
  const grenze = new Date(Date.parse(r.punkte[r.punkte.length - 1].t) - 400 * 86400000).toISOString().slice(0, 10);
  sektoren[name] = {
    symbol,
    source: `Yahoo Finance (${symbol}, SPDR), Gesamtrendite inkl. Dividenden in US-Dollar`,
    series: r.punkte.filter((p) => p.t >= grenze).map((p) => ({ t: p.t, v: runden(p.v) })),
  };
  console.log(`✓ Sektor ${name} (${symbol})`);
}

if (history.length > 0 || Object.keys(sektoren).length > 0) {
  const ziel = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "market-history.json");
  writeFileSync(ziel, JSON.stringify({ stand: json.edition?.date ?? null, reihen: history, sektoren }));
  console.log("✓ content/market-history.json geschrieben");
}

for (const pick of json.stockPicks ?? []) {
  const symbol = await symbolFuer(pick);
  if (!symbol) {
    console.warn(`⚠️  ${pick.name}: kein Börsensymbol gefunden`);
    continue;
  }
  const r = await verlauf(symbol);
  await sleep(350);
  if (!r || r.punkte.length < 30) {
    console.warn(`⚠️  ${pick.name} (${symbol}): kein Verlauf geladen`);
    continue;
  }
  const euro = await inEuro(r.punkte, r.currency ?? "EUR");
  if (!euro) {
    console.warn(`⚠️  ${pick.name}: keine Umrechnung in Euro möglich (${r.currency})`);
    continue;
  }
  pick.priceSeries = ausduennen(euro).map((p) => ({ t: p.t, v: runden(p.v) }));
  pick.priceUnit = " €";
  pick.priceSeriesSource = `Yahoo Finance (${symbol}), Schlusskurse${r.currency === "EUR" ? "" : ", zum Tageskurs in Euro umgerechnet"}`;
  console.log(`✓ ${pick.name} (${symbol}, ${r.currency}): ${r.punkte.length} Tage`);
}

writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
console.log(`✅ Kursverläufe in ${file} geschrieben.`);
