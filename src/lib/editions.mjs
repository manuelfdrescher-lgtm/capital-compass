// Lädt und validiert alle Editionen zur Build-Zeit.
// Invalide Editionen werfen hier und brechen den Astro-Build ab.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseEdition } from "./edition-schema.mjs";
import { SLOT_ORDER } from "./format.mjs";

const dir = join(process.cwd(), "content", "editions");

let cache = null;

export function getAllEditions() {
  if (cache) return cache;
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".json"))
    : [];
  if (files.length === 0) {
    throw new Error("Keine Editionen unter content/editions/ gefunden.");
  }
  const editions = files.map((file) => {
    const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const data = parseEdition(json, file);
    return { slug: file.replace(/\.json$/, ""), data };
  });
  // Neueste zuerst: nach Datum, innerhalb eines Tages nach Slot-Reihenfolge
  editions.sort((a, b) => {
    if (a.data.edition.date !== b.data.edition.date) {
      return a.data.edition.date < b.data.edition.date ? 1 : -1;
    }
    return SLOT_ORDER.indexOf(b.data.edition.slot) - SLOT_ORDER.indexOf(a.data.edition.slot);
  });
  cache = editions;
  return editions;
}

export function getLatestEdition() {
  return getAllEditions()[0];
}

export function getLogos() {
  const path = join(process.cwd(), "public", "logos", "logos.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8"));
}

// Kursverläufe für den interaktiven Markt-Chart der neuesten Ausgabe
// (scripts/fetch-history.mjs). Fehlt die Datei, entfällt der Chart.
export function getMarketHistory() {
  const path = join(process.cwd(), "content", "market-history.json");
  if (!existsSync(path)) return null;
  const json = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(json.reihen) && json.reihen.length > 0 ? json : null;
}
