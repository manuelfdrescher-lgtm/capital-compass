// Zod-Schema für Editions-JSONs. Einzige Quelle der Wahrheit:
// wird sowohl vom Astro-Build (src/lib/editions.mjs) als auch von den
// CLI-Skripten (scripts/validate.mjs, scripts/ingest.mjs, scripts/edition.mjs)
// importiert. Invalide Editionen brechen den Build ab.
// Menschlich lesbare Beschreibung: content/SCHEMA.md
import { z } from "zod";

export const GICS_SEKTOREN = [
  "Energie",
  "Grundstoffe",
  "Industrie",
  "Zyklischer Konsum",
  "Basiskonsum",
  "Gesundheit",
  "Finanzen",
  "Informationstechnologie",
  "Kommunikation",
  "Versorger",
  "Immobilien",
];

const nonEmpty = z.string().min(1);

export const MarketTileSchema = z.object({
  label: nonEmpty,
  value: nonEmpty,
  delta: z.string().optional(),
  direction: z.enum(["up", "down", "flat"]),
  approx: z.boolean().default(false),
  note: z.string().optional(),
});

export const SektorCheckSchema = z.object({
  sektor: z.enum(GICS_SEKTOREN),
  betroffenheit: z.enum(["direkt", "indirekt", "kaum"]),
  richtung: z.enum(["positiv", "negativ", "gemischt", "neutral"]),
  mechanismus: nonEmpty,
  teilbranchen: z.string().optional(),
});

export const GewinnerVerliererSchema = z.object({
  firma: nonEmpty,
  logoKey: z.string().optional(),
  bewegung: nonEmpty,
  warum: nonEmpty,
});

export const SeriesPointSchema = z.object({
  t: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Datum als JJJJ-MM-TT"),
  v: z.number(),
});

export const ChartSchema = z.object({
  type: z.enum(["bar", "line"]),
  title: nonEmpty,
  subtitle: z.string().optional(),
  unit: z.string().default(""),
  source: nonEmpty,
  allPositive: z.boolean().default(false),
  // Werte sind absolute Niveaus (z. B. KGV, Inflationsrate), keine
  // Veränderungen: dann kein "+"-Vorzeichen an die Wertelabels setzen.
  absolute: z.boolean().default(false),
  // Balken-Chart: [["Label", 2.8], ...]
  data: z.array(z.tuple([z.string(), z.number()])).optional(),
  // Linien-Chart: [{t, v}, ...]
  series: z.array(SeriesPointSchema).optional(),
}).refine(
  (c) => (c.type === "bar" ? (c.data?.length ?? 0) > 0 : (c.series?.length ?? 0) > 1),
  { message: "bar braucht data[], line braucht series[] mit mindestens 2 Punkten" }
);

export const CompanySchema = z.object({
  name: nonEmpty,
  ticker: nonEmpty,
  exchange: z.string().optional(),
  logoKey: z.string().optional(),
  whatTheyDo: nonEmpty,
  whyItMatters: nonEmpty,
  keyMetrics: z.array(z.tuple([z.string(), z.string()])).min(1),
  priceSeries: z.array(SeriesPointSchema).optional(),
  priceSeriesSource: z.string().optional(),
});

export const FactcheckSchema = z.object({
  claim: nonEmpty,
  verdict: z.enum(["bestätigt", "unsicher", "ungeprüft"]),
  evidence: nonEmpty,
});

export const SourceSchema = z.object({
  title: nonEmpty,
  url: z.string().url().or(z.literal("")),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const ArticleImageSchema = z.object({
  file: nonEmpty, // Datei unter public/images/, nur lokale Referenzen
  alt: nonEmpty,
  caption: z.string().optional(),
  credit: z.string().optional(),
});

export const ArticleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id als kleingeschriebener Slug"),
  ressort: z.enum(["titelseite", "news", "politik", "unternehmen", "makro", "aktien", "lernecke"]),
  kicker: nonEmpty,
  headline: nonEmpty,
  dek: nonEmpty,
  subject: z.string().optional(), // konkretes Unternehmen/Thema für "Kurz notiert"
  image: ArticleImageSchema.optional(),
  body: z.array(nonEmpty).min(1),
  mechanik: z.string().optional(),
  vertiefung: z
    .object({ titel: nonEmpty, absaetze: z.array(nonEmpty).min(1) })
    .optional(),
  sektorCheck: z.array(SektorCheckSchema).optional(),
  gewinnerVerlierer: z.array(GewinnerVerliererSchema).optional(),
  lehre: z.string().optional(),
  charts: z.array(ChartSchema).optional(),
  company: CompanySchema.optional(),
  factcheck: FactcheckSchema.optional(),
  sources: z.array(SourceSchema).min(1),
});

export const BranchenMonitorEintragSchema = z.object({
  sektor: z.enum(GICS_SEKTOREN),
  wasIstDas: nonEmpty,
  lage: nonEmpty,
  richtung: z.enum(["up", "down", "neutral"]),
  tagesWert: nonEmpty, // belegter Wert oder ausdrücklich "keine Sektordaten belegt"
  // Strukturelle Einordnung unabhängig von der Tagesnachricht: Bewertungsniveau,
  // Zyklusphase, strukturelle Treiber. Optional aus Kompatibilität mit älteren
  // Ausgaben, aber ab sofort redaktionelle Pflicht (siehe .claude/agents/sector-sweep.md).
  istZustand: z.string().optional(),
});

export const StockPickSchema = z.object({
  name: nonEmpty,
  ticker: nonEmpty,
  logoKey: z.string().optional(),
  marketCapEUR: nonEmpty,
  capSource: nonEmpty,
  thesis: nonEmpty,
  counterarguments: z.array(nonEmpty).min(2),
  catalysts: z.array(nonEmpty).min(1),
  confidence: z.enum(["hoch", "mittel", "niedrig"]),
  whatTheyDo: z.string().optional(),
  priceSeries: z.array(SeriesPointSchema).optional(),
  priceUnit: z.string().optional(),
  priceSeriesSource: z.string().optional(),
});

export const WatchlistItemSchema = z.object({
  what: nonEmpty,
  when: nonEmpty,
  bullishIf: nonEmpty,
  bearishIf: nonEmpty,
});

export const EditionSchema = z.object({
  edition: z.object({
    number: z.number().int().nonnegative(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT"),
    // morning/evening = Vollausgaben; update-10/13/16/19 = Intraday-Updates
    // im 3-Stunden-Rhythmus (u. a. mit WirtschaftsWoche-Sichtung)
    slot: z.enum(["morning", "update-10", "update-13", "update-16", "update-19", "evening"]),
    dataAsOf: nonEmpty,
    generatedAt: nonEmpty,
    isExample: z.boolean().default(false),
  }),
  market: z.object({
    tiles: z.array(MarketTileSchema).min(1),
  }),
  articles: z.array(ArticleSchema).min(1),
  branchenMonitor: z
    .array(BranchenMonitorEintragSchema)
    .length(11, "Branchen-Monitor braucht alle 11 GICS-Sektoren")
    .refine(
      (rows) => new Set(rows.map((r) => r.sektor)).size === 11,
      { message: "Jeder GICS-Sektor genau einmal" }
    ),
  stockPicks: z.array(StockPickSchema).length(3, "Genau drei Aktien des Tages"),
  watchlist: z.array(WatchlistItemSchema).default([]),
  learningNotes: z.array(nonEmpty).min(3).max(5),
  financeLink: z
    .object({
      titel: nonEmpty,
      absaetze: z.array(nonEmpty).min(1),
      anfaengerfehler: nonEmpty,
    })
    .optional(),
  glossar: z.array(z.object({ begriff: nonEmpty, erklaerung: nonEmpty })).min(1),
  verificationLog: z.object({
    confirmed: z.array(nonEmpty),
    uncertain: z.array(nonEmpty),
    gaps: z.array(nonEmpty),
  }),
});

// Zusätzliche redaktionelle Prüfungen, die über reine Typen hinausgehen.
// Liefert eine Liste von Fehlermeldungen (leer = alles gut).
export function editorialChecks(edition) {
  const errors = [];
  const leitartikel = edition.articles.filter((a) => a.ressort === "titelseite");
  if (leitartikel.length === 0) {
    errors.push("Es fehlt ein Leitartikel (ressort: titelseite).");
  }
  for (const a of edition.articles) {
    if (a.ressort === "news" && !a.mechanik) {
      errors.push(`Artikel "${a.id}": News-Artikel brauchen eine "Mechanik einfach erklärt"-Box.`);
    }
    if (a.sektorCheck && a.sektorCheck.length !== 11) {
      errors.push(`Artikel "${a.id}": sektorCheck muss alle 11 GICS-Sektoren enthalten (hat ${a.sektorCheck.length}).`);
    }
    if (a.ressort === "unternehmen" && !a.company) {
      errors.push(`Artikel "${a.id}": Unternehmens-Artikel brauchen ein company-Objekt.`);
    }
  }
  return errors;
}

export function parseEdition(json, fileLabel = "Edition") {
  const result = EditionSchema.safeParse(json);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  – ${i.path.join(".") || "(Wurzel)"}: ${i.message}`)
      .join("\n");
    throw new Error(`❌ ${fileLabel} ist invalide und geht NICHT live:\n${details}`);
  }
  const editorial = editorialChecks(result.data);
  if (editorial.length > 0) {
    throw new Error(
      `❌ ${fileLabel} verletzt Redaktionsregeln:\n${editorial.map((e) => `  – ${e}`).join("\n")}`
    );
  }
  return result.data;
}
