// Editions-Pipeline: erzeugt eine komplette Ausgabe von Datenbeschaffung
// bis Deploy-fähigem Commit.
//
//   npm run edition -- --slot morning|evening
//   Optionen: --date JJJJ-MM-TT (Standard: heute, Europe/Berlin)
//             --no-push   (committen, aber nicht pushen)
//             --no-commit (nur erzeugen und validieren)
//             --skip-market-data (ohne Alpha Vantage, z. B. ohne API-Key)
//
// Ablauf:
//   1. Markt-Schnappschuss von Alpha Vantage (Budget: 10 morgens / 12 abends)
//   2. Agenten-Redaktion über Claude Code (Subagents unter .claude/agents/)
//   3. Zod-Validierung (invalide Ausgaben gehen nie live)
//   4. Fehlende Logos nachladen, Build mit richtigem Pages-Basispfad
//   5. Quellcode committen + pushen (main)
//   6. Gebaute Seite live schalten (gh-pages-Zweig)
//   7. Live-Erreichbarkeit selbst verifizieren (nie nur behaupten)
//   8. Mail an manuel.f.drescher@gmail.com (kostenlos, Gmail-SMTP; übersprungen ohne Zugangsdaten)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, mkdtempSync, cpSync, writeFileSync as wf } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name) => args.includes(`--${name}`);

const SLOTS = ["morning", "update-10", "update-13", "update-16", "update-19", "evening"];
const slot = getArg("slot");
if (!SLOTS.includes(slot ?? "")) {
  console.error(`Aufruf: npm run edition -- --slot ${SLOTS.join("|")} [--date JJJJ-MM-TT] [--no-push] [--no-commit] [--skip-market-data]`);
  process.exit(1);
}
// Intraday-Updates laufen ohne Alpha-Vantage-Budget (siehe lib/alphavantage.mjs)
const isUpdate = slot.startsWith("update-");

// Datum in Europe/Berlin (die Zeitung lebt in deutscher Zeit)
const berlinDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
const date = getArg("date") ?? berlinDate;
const slug = `${date}-${slot}`;
const editionPath = join(root, "content", "editions", `${slug}.json`);

if (existsSync(editionPath)) {
  console.error(`❌ ${editionPath} existiert bereits. Mit anderem --date/--slot aufrufen oder Datei löschen.`);
  process.exit(1);
}

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n▶ ${cmd} ${cmdArgs.join(" ")}`);
  execFileSync(cmd, cmdArgs, { cwd: root, stdio: "inherit", ...opts });
}

// Kontext: letzte Ausgabe (für den Berichtszeitraum und die Ausgabennummer)
const editionsDir = join(root, "content", "editions");
const existing = existsSync(editionsDir)
  ? readdirSync(editionsDir).filter((f) => f.endsWith(".json")).sort()
  : [];
let lastEditionInfo = "Es gibt noch keine frühere Ausgabe. Berichtszeitraum: die letzten 24 Stunden.";
let nextNumber = 1;
for (const f of existing) {
  try {
    const ed = JSON.parse(readFileSync(join(editionsDir, f), "utf8"));
    if (ed.edition?.number >= nextNumber) nextNumber = ed.edition.number + 1;
    if (!ed.edition?.isExample) {
      lastEditionInfo = `Letzte Ausgabe: ${ed.edition.date} (${ed.edition.slot}), erzeugt ${ed.edition.generatedAt}. Berichtszeitraum: alles seitdem.`;
    }
  } catch { /* invalide Altdatei ignorieren */ }
}

// ---------- Phase 1: Marktdaten ----------
if (isUpdate) {
  console.log("ℹ️  Intraday-Update: kein Alpha-Vantage-Abruf. Markt-Kacheln aus der letzten Vollausgabe übernehmen (mit Stand-Hinweis) oder mit approx:true aus Tier-1/2-Quellen belegen.");
} else if (!has("skip-market-data")) {
  if (!process.env.ALPHAVANTAGE_API_KEY) {
    console.error("❌ ALPHAVANTAGE_API_KEY fehlt. Entweder setzen oder mit --skip-market-data starten (Kacheln werden dann als Datenlücken geführt).");
    process.exit(1);
  }
  run("node", ["scripts/fetch-market-data.mjs", "--slug", slug, "--slot", slot]);
} else {
  console.log("⚠️  --skip-market-data: Markt-Kacheln müssen aus Tier-1/2-Quellen mit approx:true belegt oder als Lücke geführt werden.");
}

// ---------- Phase 2: Agenten-Redaktion über Claude Code ----------
const marketDataPath = join(root, ".cache", `market-data-${slug}.json`);
const prompt = `Du bist Chefredakteur von The Capital Compass (Ex-Wall-Street-Journal, jetzt das bessere Konkurrenzprodukt) und produzierst die Ausgabe ${slug} (Ausgabennummer ${nextNumber}).

${lastEditionInfo}

ARBEITSAUFTRAG (Reihenfolge einhalten, Subagents über das Task-Tool aufrufen):
1. Lies content/SCHEMA.md (Zielformat) und ${existsSync(marketDataPath) ? `.cache/market-data-${slug}.json (belegte Marktdaten samt Budget-Restinfo und Datenlücken)` : "beachte: es gibt KEINE Alpha-Vantage-Daten für diese Ausgabe; übernimm die Markt-Kacheln der letzten Vollausgabe mit ehrlichem Stand-Hinweis oder belege sie mit approx:true aus Tier-1/2-Quellen"}.
2. BREITE Quellensichtung, nicht nur eine Zeitung: Handelsblatt, FAZ, Süddeutsche, WirtschaftsWoche, manager magazin, Börsen-Zeitung, Spiegel, Tagesschau, onvista sowie international Reuters, Bloomberg, FT, WSJ, CNBC, Nikkei, SCMP per Websuche durchgehen. Steht ein eingeloggter Chrome (claude-in-chrome) bereit, zusätzlich die Paywall-Häuser (WirtschaftsWoche, Handelsblatt, FAZ, FT, WSJ) direkt sichten; fällt der Browser aus, dieselben Häuser über die Websuche abdecken.
3. Subagent news-curator: alle kapitalmarktrelevanten Meldungen seit der letzten Ausgabe sammeln und priorisieren (keine Obergrenze, mindestens genug für 7 bis 9 Artikel in der finalen Ausgabe — bei dünnem Nachrichtenaufkommen auch kleinere echte Meldungen, Termine und Sekundärthemen aufnehmen statt die Ausgabe dünn zu lassen), inklusive deutscher Politik mit Marktbezug (Ressort politik); Fokus-Unternehmen vorschlagen.
4. ${isUpdate ? "Intraday-Update: keine neuen Alpha-Vantage-Abrufe. Vorhandene .cache/company-*-Dateien des Tages wiederverwenden." : `Für 2 bis 3 Fokus-Unternehmen echte Kursdaten holen: node scripts/fetch-company-data.mjs --slug ${slug} --slot ${slot} --ticker SYMBOL (2 Abrufe je Unternehmen; Restbudget beachten, bei knappem Budget --series-only nutzen; US-Ticker funktionieren am zuverlässigsten, deutsche mit Suffix wie DEZ.DEX).`}
5. Subagent sector-sweep: für jede große Meldung alle 11 GICS-Sektoren prüfen (sektorCheck-Blöcke) und den branchenMonitor mit 11 Sektoren bauen — jeder Eintrag zusätzlich mit istZustand (strukturelle Einordnung des Sektors unabhängig von der Tagesnachricht: Bewertungsniveau, Zyklusphase, strukturelle Treiber der nächsten Quartale).
6. Subagent macro-analyst: Makro-/Geopolitik-/Politik-Einordnung über Transmissionskanäle, bei Geldpolitik die Tiefer-verstehen-Box, Watchlist-Vorschläge.
7. Subagent equity-analyst: Unternehmens-Artikel-Zuarbeit, company-Blöcke aus den .cache/company-*-Dateien, Finance-Link-Vorschlag.
8. Subagent stock-picker: Drei Aktien des Tages (unter 10 Mrd. Euro Börsenwert, belegt; content/stock-picks-log.md lesen und fortschreiben).
9. Subagent fact-checker: jede auffällige Zahl gegen eine zweite unabhängige Quelle prüfen. Unsicherheiten werden AUSGERÄUMT (nachrecherchieren bis bestätigt oder widerlegt); was sich nicht bestätigen lässt, fliegt raus. Sein Veto gilt. Ziel: verificationLog.uncertain und .gaps sind leer.
10. Subagent skeptic: zentrale Thesen challengen; Gegenargumente und Confidence sichtbar einarbeiten.
11. Als editor die finale Ausgabe schreiben: Leitartikel und große Meldungen mit Artikelbild (image-Block). Bilder NIEMALS als SVG-Zeichnung: entweder ein vorhandenes fotorealistisches Bild aus public/images/ thematisch passend wiederverwenden, oder (falls claude-in-chrome verfügbar) ein neues fotorealistisches Foto über den ChatGPT-Bild-Workflow erzeugen; ist beides nicht möglich, image-Feld ganz weglassen. Nur lokale Dateien, nie SVG als Bild. JSON nach content/editions/${slug}.json (edition.number = ${nextNumber}, edition.date = "${date}", edition.slot = "${slot}", edition.isExample = false, edition.generatedAt = aktuelle ISO-Zeit, edition.dataAsOf = ehrliche Beschreibung des Datenstands).
12. node scripts/validate.mjs ausführen und Fehler beheben, bis die Validierung grün ist.
13. node scripts/fetch-logos.mjs ausführen (Original-Logos für alle neuen Firmen nachladen; erst nach diesem Schritt ist die Logo-Pflicht erfüllt).
14. npm run build ausführen; bei Build-Fehlern die Ursache beheben.
15. Subagent design-qa: node scripts/design-qa.mjs ausführen, Screenshots prüfen, Layout-Fehler beheben. Kein Release mit Layout-Fehlern.

VERBINDLICHE REGELN:
- Umfang: ${isUpdate ? "Intraday-Update, Umfang wie gehabt" : "mindestens 7 bis 9 Artikel in dieser Vollausgabe, nicht nur die großen Top-Meldungen"}. Jeder branchenMonitor-Eintrag hat ein istZustand-Feld (siehe Schritt 5).
- Markt-Kacheln: nur belegte Werte aus dem Markt-Schnappschuss oder mit approx:true aus Tier-1/2-Quellen (Quelle in note). Pflicht-Kacheln (genau 12, für ein sauberes 6+6-Layout ohne Restfläche): S&P 500, Nasdaq, Dow, Russell, DAX, VIX (Volatilitätsindex, das Angstbarometer der Wall Street), 10-jährige US-Rendite, US-Hypothekenzins (10 Jahre; ist dieser Tageswert nicht beschaffbar, ehrlich mit Stand-Datum und ggf. Vergleichswert des 30-jährigen Hypothekenzinses ausweisen statt fehlender Angabe), Öl, Leitzins, Bitcoin, EZB-Einlagenzins.
- Charts ausschließlich aus belegten Zahlen (Markt-Schnappschuss, company-Dateien oder verifizierte Zahlen aus Primärquellen). Nie Datenpunkte erfinden.
- Logos ausschließlich lokal aus public/logos/ (Original-Logos über npm run logos); Bilder ausschließlich lokal aus public/images/.
- Sprachregeln aus den Agenten-Prompts gelten für jeden Satz. Keine Anlageempfehlungen.
- Web-Recherche mit heutigem Datum abgleichen: nur Meldungen aus dem Berichtszeitraum.

Am Ende: kurze Zusammenfassung der Ausgabe (Leitartikel-These, Anzahl Artikel, Ergebnis der Verifikation).`;

console.log("\n▶ Starte Agenten-Redaktion (Claude Code) …");
const claudeArgs = [
  "-p", prompt,
  "--permission-mode", "acceptEdits",
  "--allowedTools", "Task,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,TodoWrite,Bash(node scripts/*),Bash(npm run *),Bash(npx astro *),mcp__claude-in-chrome",
];
const claudeResult = spawnSync("claude", claudeArgs, { cwd: root, stdio: "inherit", env: process.env });
if (claudeResult.status !== 0) {
  console.error(`❌ Agenten-Redaktion fehlgeschlagen (Exit ${claudeResult.status}).`);
  process.exit(1);
}

// ---------- Phase 3: harte Validierung (unabhängig vom Agenten) ----------
if (!existsSync(editionPath)) {
  console.error(`❌ Die Redaktion hat ${editionPath} nicht erzeugt.`);
  process.exit(1);
}
run("node", ["scripts/validate.mjs"]);

// ---------- Phase 4: Logos + Build (mit richtigem Pages-Basispfad) ----------
run("node", ["scripts/fetch-logos.mjs"]);
run("npm", ["run", "build"], {
  env: { ...process.env, GITHUB_REPOSITORY: "manuelfdrescher-lgtm/capital-compass" },
});

// ---------- Phase 5: Quellcode committen + pushen (main, gesichert bei GitHub) ----------
if (has("no-commit")) {
  console.log(`\n✅ Ausgabe ${slug} erzeugt und validiert (ohne Commit).`);
  process.exit(0);
}
run("git", ["add", "content/", "public/logos/", "public/images/"]);
run("git", ["commit", "-m", `Ausgabe ${slug}`]);
if (has("no-push")) {
  console.log("\n✅ Committet (ohne Push/Deploy/Mail).");
  process.exit(0);
}
run("git", ["push"]);

// ---------- Phase 6: gebaute Seite live schalten (gh-pages-Zweig) ----------
wf(join(root, "dist", ".nojekyll"), "");
const tmp = mkdtempSync(join(tmpdir(), "cmd-deploy-"));
cpSync(join(root, "dist"), tmp, { recursive: true });
run("git", ["init", "-q", "-b", "gh-pages"], { cwd: tmp });
run("git", ["config", "http.postBuffer", "524288000"], { cwd: tmp });
run("git", ["config", "http.version", "HTTP/1.1"], { cwd: tmp });
run("git", ["-c", "user.name=Capital Compass Redaktion", "-c", "user.email=actions@users.noreply.github.com", "add", "-A"], { cwd: tmp });
run("git", ["-c", "user.name=Capital Compass Redaktion", "-c", "user.email=actions@users.noreply.github.com", "commit", "-q", "-m", `Deploy: ${slug}`], { cwd: tmp });
run("git", ["remote", "add", "origin", "https://github.com/manuelfdrescher-lgtm/capital-compass.git"], { cwd: tmp });
run("git", ["push", "-f", "origin", "gh-pages"], { cwd: tmp });

// ---------- Phase 7: live verifizieren (nie nur behaupten) ----------
const editionUrl = `https://manuelfdrescher-lgtm.github.io/capital-compass/ausgabe/${slug}/`;
console.log(`\n▶ Verifiziere live: ${editionUrl}`);
let live = false;
for (let i = 0; i < 8; i++) {
  await new Promise((r) => setTimeout(r, 15000));
  try {
    const res = await fetch(editionUrl);
    if (res.ok) { live = true; break; }
  } catch { /* weiter versuchen */ }
  console.log(`   … noch nicht live (Versuch ${i + 1}/8)`);
}
if (!live) {
  console.error(`❌ Ausgabe nach 2 Minuten nicht live erreichbar: ${editionUrl}`);
  process.exit(1);
}
console.log(`✅ Live bestätigt: ${editionUrl}`);

// ---------- Phase 8: E-Mail (kostenlos über Gmail-SMTP, überspringt sich selbst ohne Zugangsdaten) ----------
run("node", ["scripts/send-mail.mjs", "--slug", slug]);

console.log(`\n✅ Ausgabe ${slug} vollständig: erzeugt, validiert, live, Mail verschickt (falls konfiguriert).`);
