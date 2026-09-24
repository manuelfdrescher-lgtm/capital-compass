// Lädt offizielle Unternehmenslogos von Wikimedia Commons (via Wikidata,
// Property P154 "Logo") und speichert sie lokal unter public/logos/.
// SVG bevorzugt, sonst PNG-Thumbnail. Pflegt public/logos/logos.json
// (Key → Datei, Quelle, Lizenzhinweis). Die Website referenziert Logos
// ausschließlich lokal, nie über externe URLs.
//
// Aufruf:  npm run logos            (Startbestand + alle Keys aus Editionen)
//          npm run logos -- --force (auch vorhandene neu laden)
//          npm run logos -- --only=autozone,whirlpool (nur diese Keys)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logoDir = join(root, "public", "logos");
const logosJsonPath = join(logoDir, "logos.json");
mkdirSync(logoDir, { recursive: true });

const UA = "CapitalMarketDaily/1.0 (persönliches Bildungsprojekt; Logo-Abruf für lokale Nutzung)";

// Startbestand: Key → Suchbegriff auf Wikidata (englische Unternehmensseite)
const SEED = {
  "samsung": "Samsung Electronics",
  "sk-hynix": "SK Hynix",
  "broadcom": "Broadcom",
  "apple": "Apple Inc.",
  "deutz": "Deutz AG",
  "nordex": "Nordex",
  "siltronic": "Siltronic",
  "astrazeneca": "AstraZeneca",
  "pepsico": "PepsiCo",
  "levi-strauss": "Levi Strauss & Co.",
  "infineon": "Infineon Technologies",
  "volkswagen": "Volkswagen",
  "delta": "Delta Air Lines",
  "rheinmetall": "Rheinmetall",
  "conocophillips": "ConocoPhillips",
  "marathon-petroleum": "Marathon Petroleum",
  "micron": "Micron Technology",
  "asml": "ASML Holding",
  "nvidia": "Nvidia",
  "microsoft": "Microsoft",
  "alphabet": "Alphabet Inc.",
  "meta": "Meta Platforms",
  "jpmorgan": "JPMorgan Chase",
  "goldman-sachs": "Goldman Sachs",
  "jenoptik": "Jenoptik",
  "siemens-energy": "Siemens Energy",
  "hochtief": "Hochtief",
  "vossloh": "Vossloh",
  "easyjet": "EasyJet",
  "bayer": "Bayer",
  "commerzbank": "Commerzbank",
  "qiagen": "Qiagen",
  "lang-schwarz": "Lang & Schwarz",
  "shein": "Shein",
  "delta-air-lines": "Delta Air Lines",
  "unicredit": "UniCredit",
  "wd-40": "WD-40 Company",
  "fresenius": "Fresenius SE",
};

// Manuelle Override-Zuordnung auf konkrete Wikimedia-Commons-Dateien.
// Nötig, wo die automatische Wikidata-Suche das falsche oder ein veraltetes
// Logo liefert (z. B. Meta -> altes Facebook-Wortbild) oder gar keins findet.
// Diese Keys werden bei jedem Lauf neu geladen (Vorrang vor der Automatik).
const MANUAL_COMMONS = {
  meta: "Meta Platforms Inc. logo.svg",
  shein: "Shein Logo 2017.svg",
  fresenius: "Fresenius Logo.svg",
  exxonmobil: "Exxon Mobil Logo.svg",
  frontline: "Frontline Logo.svg",
  mcdonalds: "McDonald's Golden Arches.svg", // Wikidata liefert sonst die Hochformat-Variante mit Slogan
};

// Bekannte Markenfarben für den typografischen Fallback-Chip
const BRAND_COLORS = {
  "samsung": "#1428a0",
  "sk-hynix": "#e2231a",
  "apple": "#555555",
  "nvidia": "#76b900",
  "meta": "#0866ff",
  "delta": "#c8102e",
  "volkswagen": "#001e50",
  "deutz": "#005ca9",
  "nordex": "#00a651",
  "levi-strauss": "#c41230",
  "pepsico": "#004b93",
  "astrazeneca": "#830051",
  "rheinmetall": "#1f3b73",
};

function loadLogosJson() {
  if (existsSync(logosJsonPath)) return JSON.parse(readFileSync(logosJsonPath, "utf8"));
  return {};
}

// Alle logoKeys aus den Editionen einsammeln (Name als Suchbegriff-Fallback)
function collectKeysFromEditions() {
  const dir = join(root, "content", "editions");
  const found = {};
  if (!existsSync(dir)) return found;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const ed = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const pairs = [];
    for (const a of ed.articles ?? []) {
      for (const g of a.gewinnerVerlierer ?? []) pairs.push([g.logoKey, g.firma]);
      if (a.company?.logoKey) pairs.push([a.company.logoKey, a.company.name]);
    }
    for (const p of ed.stockPicks ?? []) pairs.push([p.logoKey, p.name]);
    for (const [key, name] of pairs) {
      if (key && !found[key]) found[key] = name;
    }
  }
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url, attempt = 1) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 429 && attempt <= 4) {
    // Rate-Limit: warten und erneut versuchen (Retry-After respektieren)
    const wait = Number(res.headers.get("retry-after")) * 1000 || attempt * 5000;
    await sleep(wait);
    return api(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  return res.json();
}

// Nur Kandidaten, deren Label wirklich zur gesuchten Firma passt.
// Ein falsches Logo (Tochterfirma, Namensvetter) ist schlimmer als der
// typografische Fallback-Chip.
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/\b(ag|se|inc\.?|co\.?|plc|holding|aktiengesellschaft|&)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function findWikidataEntity(searchTerm) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchTerm)}&language=en&type=item&limit=5&format=json&origin=*`;
  const data = await api(url);
  const want = normalize(searchTerm);
  return (data.search ?? [])
    .filter((s) => {
      const labels = [s.label, ...(s.aliases ?? [])].filter(Boolean).map(normalize);
      return labels.some((l) => l === want);
    })
    .map((s) => s.id);
}

async function getLogoFilename(qid) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=P154&format=json&origin=*`;
  const data = await api(url);
  const claims = data.claims?.P154 ?? [];
  return claims[0]?.mainsnak?.datavalue?.value ?? null;
}

async function getFileInfo(filename) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${filename}`)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=256&format=json&origin=*`;
  const data = await api(url);
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  return {
    url: info.url,
    thumbUrl: info.thumburl,
    descriptionUrl: info.descriptionurl,
    license: meta.LicenseShortName?.value ?? "Lizenz siehe Commons-Dateiseite",
    artist: meta.Artist?.value?.replace(/<[^>]+>/g, "").trim() || undefined,
  };
}

async function download(url, dest, attempt = 1) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 429 && attempt <= 4) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || attempt * 5000;
    await sleep(wait);
    return download(url, dest, attempt + 1);
  }
  if (!res.ok) throw new Error(`Download fehlgeschlagen (HTTP ${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

async function fetchFromCommonsFile(key, filename, name, logos) {
  const info = await getFileInfo(filename);
  if (!info) throw new Error(`Commons-Datei nicht gefunden: ${filename}`);
  const isSvg = filename.toLowerCase().endsWith(".svg");
  const ext = isSvg ? "svg" : "png";
  const file = `${key}.${ext}`;
  const srcUrl = isSvg ? info.url : (info.thumbUrl ?? info.url);
  await download(srcUrl, join(logoDir, file));
  logos[key] = {
    file,
    name,
    source: info.descriptionUrl,
    license: info.license,
    ...(info.artist ? { artist: info.artist } : {}),
    note: "Logo von Wikimedia Commons (manuell verifizierte Datei); Markenrechte beim jeweiligen Unternehmen.",
    ...(BRAND_COLORS[key] ? { brandColor: BRAND_COLORS[key] } : {}),
  };
  console.log(`✅ ${key} ← ${filename} (manuell, ${info.license})`);
  return true;
}

async function fetchLogo(key, searchTerm, logos) {
  // Manuelle Override-Datei hat Vorrang (korrigiert falsche/veraltete Automatik-Treffer)
  if (MANUAL_COMMONS[key]) {
    return fetchFromCommonsFile(key, MANUAL_COMMONS[key], searchTerm, logos);
  }
  // Wikidata-Kandidaten durchgehen, erster mit Logo-Property gewinnt
  const qids = await findWikidataEntity(searchTerm);
  for (const qid of qids) {
    const filename = await getLogoFilename(qid);
    if (!filename) continue;
    const info = await getFileInfo(filename);
    if (!info) continue;

    const isSvg = filename.toLowerCase().endsWith(".svg");
    const ext = isSvg ? "svg" : "png";
    const file = `${key}.${ext}`;
    const srcUrl = isSvg ? info.url : (info.thumbUrl ?? info.url);
    await download(srcUrl, join(logoDir, file));

    logos[key] = {
      file,
      name: searchTerm,
      source: info.descriptionUrl,
      license: info.license,
      ...(info.artist ? { artist: info.artist } : {}),
      note: "Logo von Wikimedia Commons; Markenrechte beim jeweiligen Unternehmen. Nutzung hier nur zur redaktionellen Kennzeichnung.",
      ...(BRAND_COLORS[key] ? { brandColor: BRAND_COLORS[key] } : {}),
    };
    console.log(`✅ ${key} ← ${filename} (${info.license})`);
    return true;
  }
  return false;
}

const force = process.argv.includes("--force");
const logos = loadLogosJson();
const allWanted = { ...SEED, ...collectKeysFromEditions() };
// --only=key1,key2 beschränkt den Lauf auf einzelne Keys (spart die langen
// Wiederholungsversuche für die vielen Keys ohne Commons-Logo).
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice(7).split(",").filter(Boolean)) : null;
const wanted = only
  ? Object.fromEntries(Object.entries(allWanted).filter(([key]) => only.has(key)))
  : allWanted;

let ok = 0, failed = 0, skipped = 0;
for (const [key, searchTerm] of Object.entries(wanted)) {
  // Manuelle Overrides immer neu laden; sonst überspringen, wenn schon vorhanden.
  if (!force && !MANUAL_COMMONS[key] && logos[key]?.file && existsSync(join(logoDir, logos[key].file))) {
    skipped++;
    continue;
  }
  try {
    const success = await fetchLogo(key, searchTerm, logos);
    if (success) {
      ok++;
    } else {
      failed++;
      // Fallback dokumentieren: kein Logo gefunden → typografischer Marken-Chip
      logos[key] = {
        file: null,
        name: searchTerm,
        note: "Kein Logo auf Wikimedia Commons gefunden; Website zeigt typografischen Marken-Chip.",
        ...(BRAND_COLORS[key] ? { brandColor: BRAND_COLORS[key] } : {}),
      };
      console.warn(`⚠️  ${key}: kein Logo gefunden, Fallback-Chip wird genutzt.`);
    }
  } catch (err) {
    failed++;
    console.warn(`⚠️  ${key}: ${err.message}`);
  }
  // Höflich zu den Wikimedia-APIs sein (Rate-Limit ist streng)
  await sleep(1500);
}

writeFileSync(logosJsonPath, JSON.stringify(logos, null, 2) + "\n");
console.log(`\nFertig: ${ok} geladen, ${skipped} bereits vorhanden, ${failed} ohne Logo (Fallback-Chip).`);
console.log(`Verzeichnis: public/logos/, Index: public/logos/logos.json`);
