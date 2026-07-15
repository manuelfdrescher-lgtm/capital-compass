// Design-QA: rendert die gebaute Seite headless (Playwright), macht
// Screenshots aller Ressorts in hell und dunkel (Desktop + Mobil) und
// prüft automatisch auf Layout-Probleme. Kein Release mit Layout-Fehlern.
//
// Voraussetzung: npm run build (dist/ vorhanden) und einmalig
//                npx playwright install chromium
// Aufruf:       npm run design-qa
// Screenshots:  qa/screenshots/
// Exit-Code 1 bei Befunden.
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = join(root, "qa", "screenshots");
mkdirSync(shotDir, { recursive: true });

if (!existsSync(join(root, "dist"))) {
  console.error("❌ dist/ fehlt. Erst `npm run build` ausführen.");
  process.exit(1);
}

const PORT = 4322;
const repo = process.env.GITHUB_REPOSITORY;
const base = repo ? `/${repo.split("/")[1]}` : "";

// Neueste Ausgabe für die Detailseite ermitteln – kanonische Reihenfolge
// (nach Datum, innerhalb eines Tages nach Slot) statt naivem Dateinamen-Sort,
// damit die QA immer die tatsächlich jüngste Ausgabe (z. B. Abend > Morgen) trifft.
const { getAllEditions } = await import("../src/lib/editions.mjs");
const editionSlugs = getAllEditions().map((e) => e.slug);

const PAGES = [
  { path: "/", name: "titelseite" },
  { path: "/news/", name: "news" },
  { path: "/politik/", name: "politik" },
  { path: "/branchen-monitor/", name: "branchen-monitor" },
  { path: "/unternehmen/", name: "unternehmen" },
  { path: "/drei-aktien/", name: "drei-aktien" },
  { path: "/lernecke/", name: "lernecke" },
  { path: "/archiv/", name: "archiv" },
  ...(editionSlugs[0] ? [{ path: `/ausgabe/${editionSlugs[0]}/`, name: "ausgabe" }] : []),
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobil", width: 390, height: 844 },
];
const SCHEMES = ["light", "dark"];

// Preview-Server starten
console.log("▶ Starte Preview-Server …");
const server = spawn("npx", ["astro", "preview", "--port", String(PORT)], {
  cwd: root,
  stdio: "pipe",
});
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Preview-Server startete nicht (Timeout)")), 30000);
  server.stdout.on("data", (d) => {
    if (String(d).includes(String(PORT))) { clearTimeout(timeout); resolve(); }
  });
  server.on("exit", (code) => reject(new Error(`Preview-Server beendet (Exit ${code})`)));
}).catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});

const findings = [];
const browser = await chromium.launch();

try {
  for (const scheme of SCHEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));
      page.on("requestfailed", (req) => {
        // Pagefind fehlt im Dev-Fall bewusst; alles andere zählt
        if (!req.url().includes("/pagefind/")) {
          consoleErrors.push(`Request fehlgeschlagen: ${req.url()}`);
        }
      });

      for (const p of PAGES) {
        const url = `http://localhost:${PORT}${base}${p.path}`;
        consoleErrors.length = 0;
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
        } catch (err) {
          findings.push(`${p.name} [${scheme}/${vp.name}]: Seite lädt nicht (${err.message})`);
          continue;
        }

        // Aufklapp-Elemente öffnen, damit auch deren Layout geprüft wird
        await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
        await page.waitForTimeout(150);

        // Lazy geladene Bilder (loading="lazy", z. B. Logo-Chips tief auf der
        // Seite) erzwingen: durchscrollen und auf vollständiges Laden warten,
        // damit Full-Page-Screenshots keine leeren Chips zeigen.
        await page.evaluate(async () => {
          const step = window.innerHeight;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 30));
          }
          window.scrollTo(0, 0);
        });
        await page.evaluate(() =>
          Promise.all(
            Array.from(document.images)
              .filter((img) => !img.complete)
              .map((img) => new Promise((r) => { img.onload = img.onerror = r; }))
          )
        );
        await page.waitForTimeout(200);

        // Horizontales Überlaufen (Seite darf nie seitlich scrollen)
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth > doc.clientWidth + 1 ? doc.scrollWidth - doc.clientWidth : 0;
        });
        if (overflow > 0) {
          findings.push(`${p.name} [${scheme}/${vp.name}]: horizontales Überlaufen um ${overflow}px`);
        }

        for (const e of consoleErrors) {
          findings.push(`${p.name} [${scheme}/${vp.name}]: ${e}`);
        }

        const file = join(shotDir, `${p.name}--${scheme}--${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`  📸 ${p.name} (${scheme}, ${vp.name})`);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}

console.log(`\nScreenshots: ${shotDir}`);
if (findings.length > 0) {
  console.error(`\n❌ ${findings.length} Befund(e):`);
  for (const f of findings) console.error(`  – ${f}`);
  console.error("\nKein Release mit Layout-Fehlern: Befunde beheben, dann erneut prüfen.");
  process.exit(1);
}
console.log("✅ Keine automatischen Befunde. Screenshots zusätzlich mit Redakteursblick prüfen.");
