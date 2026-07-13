// Rückkanal für externe Redaktionsprozesse (z. B. Claude Cowork): schreibt
// public/content-index.json mit der kanonischen Ausgabenzählung der
// Website. Externe Prozesse rufen diese Datei vor jedem Lauf ab, um
// Ausgabennummer und Archivstand zu übernehmen, statt eine eigene,
// abweichende Zählung zu führen.
//
//   node scripts/build-content-index.mjs
//   Wird von npm run build automatisch mit ausgeführt.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const editionsDir = join(root, "content", "editions");
const REPO = "manuelfdrescher-lgtm/capital-market-daily";

const files = readdirSync(editionsDir).filter((f) => f.endsWith(".json"));
const editions = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(join(editionsDir, f), "utf8"));
  if (d.edition?.isExample) continue;
  const slug = f.replace(/\.json$/, "");
  const lead = d.articles?.find((a) => a.ressort === "titelseite") ?? d.articles?.[0];
  editions.push({
    number: d.edition.number,
    date: d.edition.date,
    slot: d.edition.slot,
    url: `https://${REPO.split("/")[0]}.github.io/${REPO.split("/")[1]}/ausgabe/${slug}/`,
    headline: lead?.headline ?? "",
  });
}
editions.sort((a, b) => a.number - b.number);

// Stock-Picks-Log mitliefern: verhindert, dass externe Redaktionsprozesse
// (ohne Zugriff auf content/stock-picks-log.md) dieselbe Aktie innerhalb
// der 30-Tage-Sperrfrist ein zweites Mal auswählen.
const pickLine = /^-\s*(\d{4}-\d{2}-\d{2}-[\w-]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/;
const picksLogPath = join(root, "content", "stock-picks-log.md");
let recentStockPicks = [];
try {
  recentStockPicks = readFileSync(picksLogPath, "utf8")
    .split("\n")
    .map((l) => l.match(pickLine))
    .filter(Boolean)
    .map((m) => ({ slug: m[1], name: m[2].replace(/_\(.*\)_$/, "").trim(), confidence: m[3].replace(/_\(.*\)_$/, "").trim() }));
} catch { /* Log fehlt (noch) nicht kritisch */ }

const out = { editions, recentStockPicks, lastUpdated: new Date().toISOString() };
mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "content-index.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`✅ public/content-index.json geschrieben (${editions.length} Ausgabe(n), höchste Nr. ${editions.at(-1)?.number ?? 0}, ${recentStockPicks.length} Stock-Pick(s)).`);
