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
  ressort: z.enum(["titelseite", "news", "politik", "unternehmen", "makro", "lernecke"]),
  kicker: nonEmpty,
  headline: nonEmpty,
  dek: nonEmpty,
  subject: z.string().optional(), // konkretes Unternehmen/Thema für "Kurz notiert"
  image: ArticleImageSchema.optional(),
  body: z.array(nonEmpty).min(1),
  mechanik: z.string().optional(),
  sapBezug: z.string().optional(), // 2 bis 4 Sätze: Bezug der Nachricht zu SAP und „All in on AI“ (SAP-Schwerpunkt bis 12.02.2027)
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
  // Markt-Einordnung: Marktgröße / warum diese Nische unterpenetriert bzw.
  // aufstrebend ist / warum diese Firma darin führend ist ("McKinsey-Tiefe").
  // Ab schemaVersion 2 redaktionelle Pflicht (siehe editorialChecks).
  marktEinordnung: z.string().optional(),
  counterarguments: z.array(nonEmpty).min(2),
  catalysts: z.array(nonEmpty).min(1),
  // Confidence-Label entfällt redaktionell (nur noch hohe Überzeugung wird
  // überhaupt publiziert) und wird auf dem Frontend nicht mehr angezeigt.
  // Optional statt required aus Kompatibilität mit älteren Ausgaben.
  confidence: z.enum(["hoch", "mittel", "niedrig"]).optional(),
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

// Lernecke-Tiefenrubrik (schemaVersion >= 2): ein Modell/Konzept aus VWL, BWL
// oder Politikwissenschaft, von Grund auf erklärt und auf ein Ereignis DIESER
// Ausgabe angewendet. Zusätzlich zu (nicht statt) den kurzen learningNotes.
// Array-Länge (min. 3, max. 5) und Mindest-Zeichenlängen von erklaerung/
// anwendung werden NICHT hier, sondern in editorialChecks geprüft (siehe dort).
export const LerneckeEintragSchema = z.object({
  disziplin: z.enum(["VWL", "BWL", "Politikwissenschaft"]),
  modell: nonEmpty,
  erklaerung: nonEmpty,
  anwendung: nonEmpty,
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
    // Schema-Generation: alte Editionen ohne dieses Feld gelten implizit als
    // Version 1 (unverändertes Verhalten). Neue Ausgaben setzen explizit 2,
    // wodurch die zusätzlichen, strengeren editorialChecks-Regeln greifen.
    schemaVersion: z.number().int().default(1),
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
  // Neue Tiefenrubrik ab schemaVersion 2 (additiv zu learningNotes, siehe
  // LerneckeEintragSchema oben). Min./Max.-Länge und Zeichenfloors werden in
  // editorialChecks geprüft, nicht hier.
  lernecke: z.array(LerneckeEintragSchema).optional(),
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

  // Ab schemaVersion 2 gelten zusätzliche, strengere Redaktionsregeln.
  // Intraday-Updates (slot startet mit "update-") sind von den
  // Mindest-Artikelzahlen pro Ressort ausgenommen.
  if ((edition.edition.schemaVersion ?? 1) >= 2) {
    if (!edition.edition.slot.startsWith("update-")) {
      const pflichtRessorts = ["news", "politik", "unternehmen", "makro"];
      for (const ressort of pflichtRessorts) {
        const anzahl = edition.articles.filter((a) => a.ressort === ressort).length;
        if (anzahl < 3) {
          errors.push(
            `Ressort "${ressort}": mindestens 3 Artikel nötig (hat ${anzahl}).`
          );
        }
      }
    }

    if (!edition.lernecke || edition.lernecke.length < 3) {
      errors.push(
        `"lernecke": mindestens 3 Einträge nötig (hat ${edition.lernecke?.length ?? 0}).`
      );
    } else if (edition.lernecke.length > 5) {
      errors.push(
        `"lernecke": höchstens 5 Einträge erlaubt (hat ${edition.lernecke.length}).`
      );
    } else {
      for (const eintrag of edition.lernecke) {
        if (eintrag.erklaerung.length < 280) {
          errors.push(
            `"lernecke" – Modell "${eintrag.modell}": "erklaerung" muss mindestens 280 Zeichen lang sein (hat ${eintrag.erklaerung.length}).`
          );
        }
        if (eintrag.anwendung.length < 140) {
          errors.push(
            `"lernecke" – Modell "${eintrag.modell}": "anwendung" muss mindestens 140 Zeichen lang sein (hat ${eintrag.anwendung.length}).`
          );
        }
      }
    }

    for (const eintrag of edition.branchenMonitor) {
      if (!eintrag.istZustand || eintrag.istZustand.length < 260) {
        errors.push(
          `Branchen-Monitor "${eintrag.sektor}": "istZustand" muss mindestens 260 Zeichen lang sein (hat ${eintrag.istZustand?.length ?? 0}).`
        );
      }
    }

    for (const pick of edition.stockPicks) {
      if (!pick.marktEinordnung || pick.marktEinordnung.length < 200) {
        errors.push(
          `Aktie "${pick.name}": "marktEinordnung" muss mindestens 200 Zeichen lang sein (hat ${pick.marktEinordnung?.length ?? 0}).`
        );
      }
      if (pick.thesis.length < 400) {
        errors.push(
          `Aktie "${pick.name}": "thesis" muss mindestens 400 Zeichen lang sein (hat ${pick.thesis.length}).`
        );
      }
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
