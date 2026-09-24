// Nimmt extern angelieferte Editions-JSONs an (z. B. aus einem
// Claude-Cowork-Prozess), validiert sie gegen das Schema und sortiert
// sie unter content/editions/ ein.
//
//   npm run ingest <datei.json>
//   Optionen: --commit (direkt committen)
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseEdition } from "../src/lib/edition-schema.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const doCommit = process.argv.includes("--commit");

const src = args[0];
if (!src) {
  console.error("Aufruf: npm run ingest <datei.json> [-- --commit]");
  process.exit(1);
}
if (!existsSync(src)) {
  console.error(`❌ Datei nicht gefunden: ${src}`);
  process.exit(1);
}

let json;
try {
  json = JSON.parse(readFileSync(src, "utf8"));
} catch (err) {
  console.error(`❌ Kein gültiges JSON: ${err.message}`);
  process.exit(1);
}

// Die Ausgabennummer ist website-kanonisch und wird IMMER hier neu vergeben,
// nie von der liefernden Quelle übernommen (Cowork-Läufe ohne Zugriff auf
// content-index.json haben wiederholt eigene, falsche Nummern vergeben).
const editionsDir = join(root, "content", "editions");
let nextNumber = 1;
if (existsSync(editionsDir)) {
  for (const f of readdirSync(editionsDir).filter((f) => f.endsWith(".json"))) {
    try {
      const ed = JSON.parse(readFileSync(join(editionsDir, f), "utf8"));
      if (ed.edition?.number >= nextNumber) nextNumber = ed.edition.number + 1;
    } catch { /* invalide Altdatei ignorieren */ }
  }
}
if (json.edition && json.edition.number !== nextNumber) {
  console.log(`ℹ️  Ausgabennummer der Quelle (${json.edition.number}) überschrieben mit kanonischer Nummer ${nextNumber}.`);
  json.edition.number = nextNumber;
}

let edition;
try {
  edition = parseEdition(json, src);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const slug = `${edition.edition.date}-${edition.edition.slot}`;
const dest = join(root, "content", "editions", `${slug}.json`);
if (existsSync(dest)) {
  console.error(`❌ Es gibt bereits eine Ausgabe ${slug} (${dest}). Erst entfernen, dann erneut einsortieren.`);
  process.exit(1);
}

writeFileSync(dest, JSON.stringify(json, null, 2) + "\n");
console.log(`✅ Valide. Einsortiert als content/editions/${slug}.json (Ausgabe Nr. ${edition.edition.number}, ${edition.articles.length} Artikel).`);

// Fehlende Logos gleich mitziehen, aber nur für die Firmen dieser Ausgabe
// (ein Vollabruf fragt jedes Mal alle Keys ohne Commons-Logo erneut an und
// dauert dann rund 20 Minuten).
const logoKeys = [...new Set(JSON.stringify(json).match(/"logoKey":\s*"[^"]+"/g) ?? [])]
  .map((m) => m.replace(/^"logoKey":\s*"|"$/g, ""));
try {
  if (logoKeys.length > 0) {
    execFileSync("node", ["scripts/fetch-logos.mjs", `--only=${logoKeys.join(",")}`], { cwd: root, stdio: "inherit" });
  }
} catch {
  console.warn("⚠️  Logo-Abruf fehlgeschlagen; Fallback-Chips greifen.");
}

if (doCommit) {
  execFileSync("git", ["add", "content/", "public/logos/"], { cwd: root, stdio: "inherit" });
  execFileSync("git", ["commit", "-m", `Ausgabe ${slug} (extern angeliefert)`], { cwd: root, stdio: "inherit" });
  console.log("✅ Committet. Zum Veröffentlichen: git push");
}
