# Content-Schema für Editionen

Jede Ausgabe liegt als JSON unter `content/editions/JJJJ-MM-TT-<slot>.json`.
Slots: `morning` und `evening` (Vollausgaben mit Alpha-Vantage-Budget) sowie
`update-10`, `update-13`, `update-16`, `update-19` (Intraday-Updates im
3-Stunden-Rhythmus, ohne neues Kursdaten-Budget).
Maschinelle Validierung: `src/lib/edition-schema.mjs` (Zod). Invalide Dateien brechen den
Build mit klarer Fehlermeldung ab – fehlerhafte Daten gehen nie live.
Prüfen per `npm run validate` (alle Editionen) oder `npm run ingest <datei>` (eine Datei).
Ab `edition.schemaVersion: 2` (siehe unten) gelten zusätzliche, strengere Redaktionsregeln
(Mindestartikelzahl je Ressort, Lernecke-Pflicht, Tiefen-Mindestlängen). Ausgaben ohne
dieses Feld gelten automatisch als `schemaVersion: 1` und bleiben unverändert wie bisher
gültig – die Alt-Editionen unter `content/editions/` müssen dafür nicht angefasst werden.

## Grundregeln

- Alle Texte auf Deutsch, Zahlen im deutschen Format als fertige Strings (`"7.543,64"`, `"+0,81 %"`).
- Fakten, Interpretation und Unsicherheit strikt trennen. Keine Anlageempfehlungen.
- Charts ausschließlich aus belegten Zahlen. Fehlende Daten heißen ausdrücklich
  `"keine Sektordaten belegt"` oder tragen `approx: true`.
- Markt-Kacheln (`market.tiles[].value`): **niemals** "ca." als Text in den Wert schreiben,
  das übernimmt die Anzeige automatisch aus `approx: true`. Sonst erscheint "ca. ca. …".
  `edition.dataAsOf` bleibt ein kurzer Satz (Datenstand), keine Methodik-Absätze – die
  gehören ins `verificationLog`.
- `sektorCheck` enthält, wenn vorhanden, **alle 11 GICS-Sektoren** (Energie, Grundstoffe,
  Industrie, Zyklischer Konsum, Basiskonsum, Gesundheit, Finanzen, Informationstechnologie,
  Kommunikation, Versorger, Immobilien). `branchenMonitor` immer genau diese 11.
- `stockPicks` enthält genau 3 Titel, `learningNotes` 3 bis 5 Punkte.
- Umfang und Tiefe (redaktionelle Pflicht, ab schemaVersion 2, nur für Vollausgaben
  `morning`/`evening`, nicht für die Intraday-Slots `update-*`): statt einer pauschalen
  Gesamtzahl gilt ein Mindest-Artikelbudget **je Ressort**: mindestens 3 Artikel in
  jedem von `news`, `politik`, `unternehmen`, `makro` (Details siehe „Redaktionelle
  Zusatzprüfungen" unten). `titelseite` bleibt bei genau 1 Leitartikel; `lernecke` hat
  keine Mindestzahl an Artikeln (dafür aber die eigene `edition.lernecke`-Struktur,
  s. u.). An echten nachrichtenarmen Tagen lieber kleinere, aber reale Geschichten
  ergänzen, statt einen Ressort-Eimer mit erfundenem Inhalt aufzufüllen, nur um die
  Mindestzahl zu erreichen – diese Sicherung bleibt ausdrücklich bestehen. Jeder
  Artikel ordnet ein (Mechanismus, Kontext, Restrisiko), keine bloße
  Nachrichten-Wiedergabe. Jeder `branchenMonitor`-Eintrag bekommt zusätzlich zu `lage`
  (Tagesnachricht) ein `istZustand`-Feld: 5 bis 8 Sätze strukturelle Einordnung des
  Sektors unabhängig von der Tagesnachricht (Bewertungsniveau, Zyklusphase,
  strukturelle Treiber der nächsten Quartale, wo hilfreich verankert in einschlägigen
  ökonomischen Rahmenkonzepten). Das ist der „kleine einordnende Artikel je Industrie",
  den Leser*innen unabhängig vom Tagesgeschehen verstehen können sollen.
- News-Artikel (`ressort: "news"`) brauchen eine `mechanik`-Box,
  Unternehmens-Artikel (`ressort: "unternehmen"`) ein `company`-Objekt.
- Jeder Artikel braucht mindestens eine Quelle mit Tier-Kennzeichnung
  (1 = Primärquelle, 2 = Qualitätsmedien, 3 = nur Hypothesen).
- Sprachregel: Namentlich genannte Personen bekommen bei Erstnennung im Artikel
  Rolle/Titel/Zugehörigkeit mit – z. B. „VW-Chef Oliver Blume" statt nacktem „Blume",
  „Fed-Chef Jerome Powell", „EZB-Präsidentin Christine Lagarde", „IBM-CEO Arvind
  Krishna". Leser*innen dürfen nie raten müssen, wer gemeint ist oder warum die Person
  relevant ist.
- Bilder (redaktionelle Pflicht für JEDEN Artikel, nicht nur Leitartikel/große
  Meldungen): `image` mit `file` (nur lokale `.jpg`/`.png` unter `public/images/`,
  **niemals** `.svg`), `alt`, `caption`, `credit`.
  **Jeder Artikel bekommt ein eigenes, für seine Geschichte neu erzeugtes Bild.**
  Keine Wiederverwendung von Bestandsmotiven aus `public/images/` und keine
  geteilten Generikbilder über mehrere Artikel hinweg – auch nicht bei
  wiederkehrenden Themen. Zwei Artikel derselben Ausgabe dürfen nie dieselbe
  Bilddatei referenzieren. Der Dateiname beschreibt das konkrete Motiv
  (z. B. `oeltanker-hormus-sonnenuntergang.jpg`), nicht die generische Kategorie.
  Details und Ablauf: siehe `.claude/agents/editor.md`.

## Struktur (kommentiertes Beispiel)

```jsonc
{
  "edition": {
    "number": 5,                       // fortlaufende Ausgabennummer, ganzzahlig
    "date": "2026-07-11",              // JJJJ-MM-TT
    "slot": "morning",                 // "morning" | "evening"
    "schemaVersion": 2,                 // optional, Ganzzahl, Default 1 (Feld fehlt = 1). schemaVersion 2 schaltet die strengeren Redaktionsregeln scharf: Mindestartikelzahl je Ressort (news/politik/unternehmen/makro, nur morning/evening), `lernecke` Pflicht (3–5 Einträge), Tiefen-Mindestlängen bei `stockPicks` (thesis/marktEinordnung) und `branchenMonitor[].istZustand`. Diese Regeln leben ausschließlich in `editorialChecks()`, nicht im Zod-Schema selbst – Alt-Editionen ohne `schemaVersion` (= automatisch 1) bleiben unverändert gültig; neue Ausgaben setzen ab sofort ausdrücklich "schemaVersion": 2.
    "dataAsOf": "Kurse: US-Schluss 10. Juli; News bis 06:15 MESZ",  // EIN kurzer Satz; wird auf der Seite NICHT angezeigt (nur Metadaten), Methodik-Details gehören ins verificationLog
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
        "approx": true,                // true = Kachel zeigt automatisch "ca. " vor dem Wert
        "note": "Schlusskurs Vortag"   // optional, z. B. Datenstand
      }
    ]
  },

  "articles": [
    {
      "id": "opec-foerderkuerzung",    // Slug: a-z, 0-9, Bindestrich
      "ressort": "titelseite",         // titelseite | news | politik | unternehmen | makro | lernecke — "aktien" wurde entfernt (keine eigene Rendering-Seite im Code, faktisch tot, in keiner veröffentlichten Ausgabe genutzt); Kursbewegungs-/Aktienmarkt-Meldungen laufen künftig unter "news"
      "kicker": "Geopolitik · Energie",
      "headline": "…",                 // berichtet die Nachricht selbst, keine Meta-Bezüge
      "dek": "…",                      // Unterzeile
      "image": {                       // Pflicht für JEDEN Artikel (nicht mehr nur Leitartikel/große Meldungen)
        "file": "zentralbank-fassade.jpg", // liegt unter public/images/, nur lokale Dateien, NIE .svg (Bildbank-Strategie: Bestandsbilder bevorzugt wiederverwenden, siehe unten)
        "alt": "…",
        "caption": "…",                // optional
        "credit": "Bild: The Capital Compass / KI-generiert"   // optional, aber Standardwert für alle Bilder dieser Bank
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
      "tagesWert": "Mi +2,8 %",        // belegt oder wörtlich "keine Sektordaten belegt"
      "istZustand": "5 bis 8 Sätze strukturelle Einordnung UNABHÄNGIG von der Tagesnachricht: aktuelles Bewertungsniveau, Zyklusphase (früh/spät im Zyklus, Überkapazität/Knappheit), strukturelle Treiber der nächsten Quartale – wo hilfreich, verankert in einschlägigen ökonomischen Rahmenkonzepten (z. B. Angebot/Nachfrage-Elastizität, Kapitalzyklus-Theorie, Porters Five Forces). Redaktionelle Pflicht ab schemaVersion 2: mind. 260 Zeichen, geprüft in editorialChecks (nicht im Zod-Schema selbst). Für Altausgaben (schemaVersion 1) bleibt das kürzere 2-bis-4-Sätze-Format technisch gültig, da die Längenprüfung nur ab schemaVersion 2 greift."
    }
  ],

  "stockPicks": [                      // genau 3, als Analyse-Fallstudien, nie Empfehlung
    {
      "name": "…", "ticker": "…", "logoKey": "…",
      "marketCapEUR": "9,81 Mrd. €",   // Börsenwert unter 10 Mrd. €
      "capSource": "Quelle für den Börsenwert",
      "marktEinordnung": "…",         // NEU: Marktgröße/TAM des Nischenmarkts, warum die Nische aufstrebend/unterpenetriert ist, warum genau diese Firma darin Marktführer ist — die "McKinsey-Report"-Einordnungsdaten hinter der These. Ab schemaVersion 2 Pflicht, mind. 200 Zeichen (editorialChecks).
      "thesis": "…",                  // echte Investment-These mit Substanz; ab schemaVersion 2 mind. 400 Zeichen (editorialChecks) statt der bisherigen losen Richtgröße "2 bis 4 Sätze"
      "counterarguments": ["mind. 2 starke Gegenargumente"],
      "catalysts": ["…"]
      // "confidence" (früher: "hoch" | "mittel" | "niedrig") wird für neue Ausgaben nicht mehr erzeugt.
      // Begründung des Herausgebers: die Publikationslatte liegt jetzt so hoch, dass nur noch
      // Ideen mit durchgehend hoher Überzeugung überhaupt aufgenommen werden – ein "confidence:
      // niedrig/mittel"-Etikett würde dem Aufnahmekriterium selbst widersprechen ("dann will ich
      // die Aktie ja gar nicht erst auf die Watchlist packen"). Das Feld wird im Zod-Schema nur
      // optional (nicht entfernt), damit Altausgaben mit vorhandenem "confidence"-Wert weiter
      // gültig bleiben; auf der Seite wird das Badge unabhängig davon nicht mehr angezeigt.
      // Echte Risikotransparenz bleibt unverändert: "counterarguments" (min. 2) und "catalysts"
      // (min. 1) sind weiterhin Pflicht, ebenso der Fallstudien-Disclaimer bei den Stock Picks.
    }
  ],

  "watchlist": [
    { "what": "…", "when": "…", "bullishIf": "…", "bearishIf": "…" }
  ],

  "learningNotes": ["3 bis 5 übertragbare Kapitalmarkt-Prinzipien"],  // unverändert: knappe Ein-Satz-Übersicht zum schnellen Scannen

  "lernecke": [                        // NEU, ab schemaVersion 2 redaktionelle Pflicht (3–5 Einträge). Getrennt von und zusätzlich zu "learningNotes" oben, das unverändert die knappe Ein-Satz-Übersicht bleibt. Die "lernecke" ist die akademische Vertiefung: ein gedachtes "Team aus VWL-, BWL- und Politikwissenschaftsprofessor*innen" führt pro Ausgabe echte akademische Modelle von Grund auf ein, erklärt sie laienverständlich – und wendet sie konkret auf ein Ereignis DIESER Ausgabe an. Kein Einzeiler, sondern ein kurzer, eigenständiger Absatz pro Punkt.
    {
      "disziplin": "VWL",              // "VWL" | "BWL" | "Politikwissenschaft"
      "modell": "Phillips-Kurve",       // Name des Modells/Konzepts, z. B. auch "Prinzipal-Agent-Theorie", "Median-Wähler-Theorem", "Zinsparität", "Efficient Market Hypothesis", "Komparativer Kostenvorteil"
      "erklaerung": "Die Theorie selbst, von Grund auf für Laien erklärt – mehrere Sätze bzw. ein kurzer Absatz, kein Einzeiler. Ab schemaVersion 2: mind. 280 Zeichen (editorialChecks).",
      "anwendung": "Konkrete Anwendung dieses Modells auf ein Ereignis DIESER spezifischen Ausgabe. Ab schemaVersion 2: mind. 140 Zeichen (editorialChecks)."
    }
    // insgesamt mind. 3, höchstens 5 Einträge (ab schemaVersion 2, sonst optional/technisch frei)
  ],

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

Diese gelten für **alle** Ausgaben, unabhängig von `schemaVersion`:

- Mindestens ein Artikel mit `ressort: "titelseite"` (Leitartikel).
- `sektorCheck` hat, wenn gesetzt, genau 11 Einträge.
- `branchenMonitor`: alle 11 GICS-Sektoren, keiner doppelt.
- `stockPicks`: genau 3; jede mit mindestens 2 Gegenargumenten und mindestens 1 Katalysator.

Zusätzlich, **nur wenn `edition.schemaVersion >= 2`** (implementiert in `editorialChecks()`
in `src/lib/edition-schema.mjs`, nicht im Zod-Schema selbst — alte Ausgaben mit
`schemaVersion` 1 oder ohne das Feld sind davon unberührt):

- Nur für die Vollausgaben-Slots `morning`/`evening` (nicht für die Intraday-Slots
  `update-*`): mindestens 3 Artikel je Ressort in **jedem** von `news`, `politik`,
  `unternehmen`, `makro`. Das ersetzt die frühere pauschale Vorgabe „7 bis 9 Artikel
  gesamt" durch klar geprüfte Mindestwerte pro Bucket. An echten nachrichtenarmen
  Tagen gilt weiterhin: lieber kleinere, aber reale Meldungen ergänzen, als einen
  Ressort-Eimer mit erfundenem Inhalt aufzufüllen, nur um die Mindestzahl zu erreichen
  — diese Sicherung bleibt ausdrücklich bestehen und wird durch die Mindestwerte nicht
  aufgehoben.
- `edition.lernecke`: mindestens 3, höchstens 5 Einträge; jede `erklaerung` mind. 280
  Zeichen, jede `anwendung` mind. 140 Zeichen.
- Jeder `stockPicks`-Eintrag: `marktEinordnung` vorhanden und mind. 200 Zeichen;
  `thesis` mind. 400 Zeichen (verschärft in Code die bisherige lose Richtgröße „2 bis 4
  Sätze"). `counterarguments` (min. 2) und `catalysts` (min. 1) bleiben unverändert
  Pflicht, unabhängig von `schemaVersion`.
- Jeder `branchenMonitor`-Eintrag: `istZustand` vorhanden und mind. 260 Zeichen.
