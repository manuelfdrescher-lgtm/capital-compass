# Content-Schema für Editionen

Jede Ausgabe liegt als JSON unter `content/editions/JJJJ-MM-TT-<slot>.json`.
Slots: `morning` und `evening` (Vollausgaben mit Alpha-Vantage-Budget) sowie
`update-10`, `update-13`, `update-16`, `update-19` (Intraday-Updates im
3-Stunden-Rhythmus, ohne neues Kursdaten-Budget).
Maschinelle Validierung: `src/lib/edition-schema.mjs` (Zod). Invalide Dateien brechen den
Build mit klarer Fehlermeldung ab – fehlerhafte Daten gehen nie live.
Prüfen per `npm run validate` (alle Editionen) oder `npm run ingest <datei>` (eine Datei).

## Grundregeln

- Alle Texte auf Deutsch, Zahlen im deutschen Format als fertige Strings (`"7.543,64"`, `"+0,81 %"`).
- Fakten, Interpretation und Unsicherheit strikt trennen. Keine Anlageempfehlungen.
- Charts ausschließlich aus belegten Zahlen. Fehlende Daten heißen ausdrücklich
  `"keine Sektordaten belegt"` oder tragen `approx: true`.
- `sektorCheck` enthält, wenn vorhanden, **alle 11 GICS-Sektoren** (Energie, Grundstoffe,
  Industrie, Zyklischer Konsum, Basiskonsum, Gesundheit, Finanzen, Informationstechnologie,
  Kommunikation, Versorger, Immobilien). `branchenMonitor` immer genau diese 11.
- `stockPicks` enthält genau 3 Titel, `learningNotes` 3 bis 5 Punkte.
- News-Artikel (`ressort: "news"`) brauchen eine `mechanik`-Box,
  Unternehmens-Artikel (`ressort: "unternehmen"`) ein `company`-Objekt.
- Jeder Artikel braucht mindestens eine Quelle mit Tier-Kennzeichnung
  (1 = Primärquelle, 2 = Qualitätsmedien, 3 = nur Hypothesen).

## Struktur (kommentiertes Beispiel)

```jsonc
{
  "edition": {
    "number": 5,                       // fortlaufende Ausgabennummer, ganzzahlig
    "date": "2026-07-11",              // JJJJ-MM-TT
    "slot": "morning",                 // "morning" | "evening"
    "dataAsOf": "Kurse: US-Schluss 10. Juli; News bis 06:15 MESZ",
    "generatedAt": "2026-07-11T05:02:11Z",   // ISO-Zeit
    "isExample": false                 // true nur für Beispiel-/Demodaten
  },

  "market": {
    "tiles": [
      {
        "label": "S&P 500",
        "value": "7.543,64",
        "delta": "+0,81 %",            // optional
        "direction": "up",             // "up" | "down" | "flat"
        "approx": false,               // true = ca.-Angabe aus Sekundärquelle
        "note": "Schlusskurs Vortag"   // optional, z. B. Datenstand
      }
    ]
  },

  "articles": [
    {
      "id": "opec-foerderkuerzung",    // Slug: a-z, 0-9, Bindestrich
      "ressort": "titelseite",         // titelseite | news | politik | unternehmen | makro | aktien | lernecke
      "kicker": "Geopolitik · Energie",
      "headline": "…",                 // berichtet die Nachricht selbst, keine Meta-Bezüge
      "dek": "…",                      // Unterzeile
      "image": {                       // optional; Pflicht für Leitartikel und große Meldungen
        "file": "hbm-speicher.svg",    // liegt unter public/images/, nur lokale Dateien
        "alt": "…",
        "caption": "…",                // optional
        "credit": "Illustration: The Capital Compass"   // optional
      },
      "body": ["Absatz 1", "Absatz 2"],
      "mechanik": "Mechanik einfach erklärt: …",          // optional außer bei news
      "vertiefung": {                  // optional, aufklappbare Theorie-Box
        "titel": "Tiefer verstehen: …",
        "absaetze": ["…"]
      },
      "sektorCheck": [                 // optional; wenn vorhanden: alle 11 Sektoren
        {
          "sektor": "Energie",
          "betroffenheit": "direkt",   // direkt | indirekt | kaum
          "richtung": "positiv",       // positiv | negativ | gemischt | neutral
          "mechanismus": "1–2 laienverständliche Sätze zum Wirkkanal.",
          "teilbranchen": "Ölproduzenten profitieren, Raffinerien gemischt …"
        }
      ],
      "gewinnerVerlierer": [
        { "firma": "ConocoPhillips", "logoKey": "conocophillips", "bewegung": "+2,1 %", "warum": "Einzeiler" }
      ],
      "lehre": "Die Lehre: …",         // optional, Merksatz zwischen Haarlinien
      "charts": [
        {
          "type": "bar",               // "bar" | "line"
          "title": "…",
          "subtitle": "…",             // optional
          "unit": " %",
          "source": "Quellenzeile",
          "allPositive": false,
          "data": [["Label", 2.8]]     // nur bei type "bar"
        },
        {
          "type": "line",
          "title": "…",
          "unit": " USD",
          "source": "Quellenzeile",
          "series": [{ "t": "2026-06-01", "v": 41.2 }]   // nur bei type "line", min. 2 Punkte
        }
      ],
      "company": {                     // Pflicht bei ressort "unternehmen"
        "name": "…", "ticker": "…", "exchange": "…", "logoKey": "…",
        "whatTheyDo": "2–3 einfache Sätze ohne Vorwissen.",
        "whyItMatters": "1–2 Sätze.",
        "keyMetrics": [["Kurs", "9,29 € (+6,0 %)"], ["KGV (Kurs-Gewinn-Verhältnis)", "14"]],
        "priceSeries": [{ "t": "2026-06-01", "v": 8.9 }],  // echter Kursverlauf
        "priceSeriesSource": "Alpha Vantage, TIME_SERIES_DAILY"
      },
      "factcheck": {                   // optional; Pflicht, wenn große Zahl im Spiel
        "claim": "…",
        "verdict": "bestätigt",        // bestätigt | unsicher | ungeprüft
        "evidence": "Quellen und Kurzbegründung"
      },
      "sources": [
        { "title": "…", "url": "https://…", "tier": 1 }
      ]
    }
  ],

  "branchenMonitor": [                 // genau 11 Einträge, jeder GICS-Sektor einmal
    {
      "sektor": "Energie",
      "wasIstDas": "Ein einfacher Satz, was der Sektor ist.",
      "lage": "Wie es ihm durch die Ereignisse der Ausgabe geht.",
      "richtung": "up",                // up | down | neutral
      "tagesWert": "Mi +2,8 %"         // belegt oder wörtlich "keine Sektordaten belegt"
    }
  ],

  "stockPicks": [                      // genau 3, als Analyse-Fallstudien, nie Empfehlung
    {
      "name": "…", "ticker": "…", "logoKey": "…",
      "marketCapEUR": "9,81 Mrd. €",   // Börsenwert unter 10 Mrd. €
      "capSource": "Quelle für den Börsenwert",
      "thesis": "…",
      "counterarguments": ["mind. 2 starke Gegenargumente"],
      "catalysts": ["…"],
      "confidence": "mittel"           // hoch | mittel | niedrig
    }
  ],

  "watchlist": [
    { "what": "…", "when": "…", "bullishIf": "…", "bearishIf": "…" }
  ],

  "learningNotes": ["3 bis 5 übertragbare Kapitalmarkt-Prinzipien"],

  "financeLink": {                     // Lernecke: eine News durch GuV, Bilanz, Cashflow, Bewertung gedacht
    "titel": "Finance Link: …",
    "absaetze": ["…"],
    "anfaengerfehler": "Der typische Anfängerfehler: …"
  },

  "glossar": [
    { "begriff": "KGV (Kurs-Gewinn-Verhältnis)", "erklaerung": "…" }
  ],

  "verificationLog": {                 // interne Qualitätsakte der Ausgabe
    "confirmed": ["…"],
    "uncertain": [],                   // bei Abgabe leer: Unsicherheiten werden ausgeräumt, nicht ausgewiesen
    "gaps": []                         // bei Abgabe leer (Ausnahme: strukturell nicht beschaffbare Daten)
  }
}
```

## Redaktionelle Zusatzprüfungen (brechen den Build ebenfalls ab)

- Mindestens ein Artikel mit `ressort: "titelseite"` (Leitartikel).
- `sektorCheck` hat, wenn gesetzt, genau 11 Einträge.
- `branchenMonitor`: alle 11 GICS-Sektoren, keiner doppelt.
- `stockPicks`: genau 3; jede mit mindestens 2 Gegenargumenten.
