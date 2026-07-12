# The Capital Compass

Automatisierte Zeitungs-Plattform: „A Daily Briefing on Markets, Business and the Global Economy“, das persönliche Kapitalmarkt-Briefing für Manuel Drescher. Zwei Vollausgaben täglich (morgens und abends) plus Intraday-Updates im 3-Stunden-Rhythmus (10, 13, 16, 19 Uhr), unter anderem mit Sichtung der WirtschaftsWoche über den eingeloggten Chrome-Browser. Jede Ausgabe wird von einer Agenten-Redaktion erzeugt, als JSON abgelegt, gegen ein striktes Schema validiert, als statische Zeitungs-Website gerendert und auf GitHub Pages veröffentlicht.

Verifikationsanspruch: Unsicherheiten werden vor Veröffentlichung ausgeräumt, nicht ausgewiesen. Was sich nicht doppelt belegen lässt, erscheint nicht.

**Zweck ist Bildung und Kapitalmarktverständnis. Es ist ausdrücklich keine Anlageberatung:** keine Kauf-, Verkaufs- oder Halteempfehlungen, keine Trading-Signale. Chancen und Risiken erscheinen nur als analytische Lernpunkte. Dieser Hinweis steht im Footer jeder Seite.

---

## Wie alles zusammenspielt

```
                    05:00 / 20:30 UTC (GitHub-Actions-Cron)
                                   │
                                   ▼
                  scripts/edition.mjs  ──  npm run edition -- --slot morning|evening
                                   │
   1. Marktdaten      scripts/fetch-market-data.mjs   (Alpha Vantage, Budget 10/12 Abrufe)
   2. Redaktion       Claude Code + Subagents unter .claude/agents/
                      (news-curator → sector-sweep → macro/equity-analyst
                       → stock-picker → fact-checker → skeptic → editor)
   3. Ergebnis        content/editions/JJJJ-MM-TT-<slot>.json
   4. Validierung     scripts/validate.mjs (Zod-Schema; invalide = kein Release)
   5. Logos           scripts/fetch-logos.mjs (Wikimedia Commons, lokal gespeichert)
   6. Build           Astro → dist/  + Pagefind-Suchindex
   7. Design-QA       scripts/design-qa.mjs (Playwright-Screenshots hell/dunkel)
   8. Commit + Push   → Workflow deploy.yml → GitHub Pages
```

## Schnellstart (lokal)

```bash
npm install                 # einmalig
npm run dev                 # Entwicklung: http://localhost:4321
npm run build               # validiert, baut nach dist/, erzeugt Suchindex
npm run preview             # gebaute Seite lokal ansehen
```

Für die Design-QA einmalig den Browser installieren:

```bash
npx playwright install chromium
npm run design-qa           # Screenshots nach qa/screenshots/, Befunde in der Konsole
```

## Eine echte Ausgabe erzeugen

Voraussetzungen: Umgebungsvariable `ALPHAVANTAGE_API_KEY` (kostenlos: <https://www.alphavantage.co/support/#api-key>) und ein eingeloggtes Claude Code (lokal) bzw. `ANTHROPIC_API_KEY` (in GitHub Actions).

```bash
npm run edition -- --slot morning     # Morgenausgabe
npm run edition -- --slot evening     # Abendausgabe

# nützliche Optionen
npm run edition -- --slot evening --no-push       # committen, nicht pushen
npm run edition -- --slot evening --no-commit     # nur erzeugen + validieren
npm run edition -- --slot evening --skip-market-data   # ohne Alpha Vantage
```

Die Pipeline bricht hart ab, wenn das erzeugte JSON das Schema verletzt. Fehlerhafte Daten gehen nie live.

## Intraday-Updates (3-Stunden-Rhythmus, lokal)

Zwischen den Vollausgaben aktualisiert sich die Zeitung um 10, 13, 16 und 19 Uhr:

```bash
npm run edition -- --slot update-13     # Beispiel: 13-Uhr-Update
```

Updates verbrauchen kein Alpha-Vantage-Budget (Markt-Kacheln kommen mit Stand-Hinweis aus der letzten Vollausgabe) und sichten die WirtschaftsWoche über den eingeloggten Chrome. Weil der Chrome-Zugriff nur lokal existiert, laufen Updates auf dem Laptop: In einer offenen Claude-Code-Session im Projektordner ist dafür ein wiederkehrender Zeitplan eingerichtet (täglich 10:04, 13:04, 16:04, 19:04 Uhr; läuft, solange die Session offen ist, und erlischt nach 7 Tagen). Neu scharfschalten: Claude im Projektordner öffnen und sagen „richte den 3-Stunden-Update-Zeitplan wieder ein".

## Extern angelieferte Ausgaben (Claude-Cowork-Prozess)

Editions-JSONs im Schema von `content/SCHEMA.md` können direkt einsortiert werden:

```bash
npm run ingest pfad/zur/ausgabe.json              # validieren + einsortieren
npm run ingest pfad/zur/ausgabe.json -- --commit  # zusätzlich committen
git push                                          # veröffentlichen
```

## Automatischer Betrieb: bewusst session-basiert, nicht GitHub Actions

Eine vollautomatische Cloud-Pipeline über GitHub Actions würde einen bezahlten `ANTHROPIC_API_KEY` benötigen (separates Abrechnungskonto, keine Nutzung des normalen Claude-Abos). Realistische Kosten bei 2 Ausgaben täglich mit gründlicher Websuche: grob **200–330 €/Monat**. Bewusste Entscheidung: **kein bezahlter API-Zugang**, daher kein `.github/workflows/`-Automatismus.

Stattdessen läuft die Redaktion **innerhalb einer Claude-Code-Sitzung** (das bestehende Abo deckt das ab, keine Zusatzkosten), ausgelöst durch einen wiederkehrenden Weckruf. Ein einziger Aufruf erledigt alles bis zur fertigen, live verifizierten und per Mail verschickten Ausgabe:

```bash
node scripts/edition.mjs --slot morning     # oder evening, update-10/13/16/19
```

Das Skript erzeugt die Ausgabe, validiert, baut, deployt automatisch auf GitHub Pages, **prüft selbst per HTTP-Abruf, dass die Seite wirklich live ist**, und verschickt danach die E-Mail (siehe unten). Kein manuelles Copy-Paste von Deploy-Befehlen mehr nötig.

**Einschränkung:** Der Weckruf-Mechanismus ist an eine offene Claude-Code-Sitzung gebunden und verfällt nach etwa 7 Tagen bzw. Sitzungsende — kein echter Autopilot, der auch bei geschlossenem Laptop läuft. Neu scharfschalten: Claude im Projektordner öffnen und sagen „richte den Update-Zeitplan wieder ein".

### Automatischer Mailversand (kostenlos über Gmail)

Jede fertige Ausgabe wird automatisch per Mail an `manuel.f.drescher@gmail.com` verschickt (Titelseiten-Teaser, Markt-Kacheln, Link zur Live-Ausgabe). Läuft über Gmail-SMTP mit einem App-Passwort, keine Kosten, kein Drittanbieter. Einmalig einzurichten:

1. Auf [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) ein App-Passwort für „Mail" erzeugen (2-Faktor-Anmeldung muss aktiv sein).
2. Im Projektordner eine Datei `.env` anlegen (wird nie committet, steht in `.gitignore`) mit zwei Zeilen:
   ```
   GMAIL_USER=deine-adresse@gmail.com
   GMAIL_APP_PASSWORD=das-16-stellige-app-passwort
   ```

Ohne `.env` wird der Mailversand automatisch übersprungen, der Rest der Pipeline läuft trotzdem normal durch.

## Datenquellen und Verifikationsregeln

- **Kursdaten:** Alpha Vantage. Hartes Budget je Ausgabe: 10 Abrufe morgens, 12 abends, strikt sequenziell (1 Abruf/Sekunde). Der Budgetstand liegt je Ausgabe unter `.cache/av-budget-*.json`, damit alle Skripte dasselbe Budget teilen. Prioritäten: Index-Näherungen über liquide ETFs (SPY/QQQ/DIA/IWM, gekennzeichnet mit `approx`), 10-jährige US-Rendite, EUR/USD, Öl (WTI), Bitcoin, Top-Gewinner/Verlierer, danach 2 bis 3 Tageskursreihen plus Kennzahlen für die Fokus-Unternehmen. DAX und VIX liefert der Free Tier nicht; sie erscheinen nur mit `approx: true` aus Tier-1/2-Quellen oder als ausgewiesene Datenlücke.
- **News:** Quellenhierarchie strikt. Tier 1 = Unternehmensmeldungen, Filings, Earnings Releases, Zentralbanken, Behörden, offizielle Statistik. Tier 2 = Reuters, Bloomberg, FT, WSJ, Handelsblatt, CNBC und vergleichbare. Tier 3 (Blogs, Social Media, Foren) liefert nur Hypothesen, nie Faktenbasis.
- **Verifikation:** Jede auffällige Schlagzeilen-Zahl wird gegen eine zweite unabhängige Quelle geprüft (bevorzugt Primärquelle). Unsicherheiten werden vor Veröffentlichung ausgeräumt; was sich nicht bestätigen lässt, fliegt raus. Das Faktencheck-Protokoll (`verificationLog`) ist die interne Qualitätsakte jeder Ausgabe, `uncertain` und `gaps` müssen bei Abgabe leer sein. Quellen mit Tier-Kennzeichnung stehen aufklappbar an jedem Artikel. Charts entstehen ausschließlich aus belegten Zahlen.
- **WirtschaftsWoche:** Läuft die Redaktion lokal mit Chrome-Zugriff (claude-in-chrome, eingeloggtes Konto), sichtet der news-curator zusätzlich wiwo.de (Unternehmen, Finanzen, Politik) als Tier-2-Quelle. In GitHub Actions entfällt dieser Schritt automatisch.

## Die Agenten-Redaktion

Alle Rollen liegen als Claude-Code-Subagents unter `.claude/agents/`:

| Agent | Rolle |
|---|---|
| `news-curator` | Sammelt und priorisiert alle relevanten Meldungen inkl. deutscher Politik und WiWo-Sichtung (keine Obergrenze) |
| `fact-checker` | Zweitquellen-Prüfung jeder auffälligen Zahl; räumt Unsicherheiten aus, hat Veto |
| `sector-sweep` | Prüft je große Meldung alle 11 GICS-Sektoren (Betroffenheit, Richtung, Mechanismus, Teilbranchen) |
| `macro-analyst` | Transmissionskanäle für Makro/Politik/Geopolitik, Geldpolitik-Vertiefungen |
| `equity-analyst` | Earnings und Firmennews durch Umsatz, Marge, Cashflow, Bilanz, Bewertung |
| `skeptic` | Stärkstes Gegenargument je These, Confidence-Ratings, prüft auf Kausalität/Einpreisung/Base Rates |
| `stock-picker` | Drei Aktien des Tages (< 10 Mrd. € Börsenwert, belegt), führt `content/stock-picks-log.md` |
| `editor` | Chefredaktion: finale Artikel, Editions-JSON, Qualitätsliste |
| `design-qa` | Playwright-Screenshots hell/dunkel, behebt Layout-Fehler vor dem Release |

## Content-Schema

Menschlich lesbar: [`content/SCHEMA.md`](content/SCHEMA.md). Maschinell: `src/lib/edition-schema.mjs` (Zod, einzige Quelle der Wahrheit für Website und Pipeline). Editionen liegen unter `content/editions/JJJJ-MM-TT-<slot>.json` (Slots: `morning`, `update-10`, `update-13`, `update-16`, `update-19`, `evening`) und sind unter `/ausgabe/<slug>/` dauerhaft erreichbar. Leitartikel und große Meldungen tragen Artikelbilder (gestochene SVG-Tafeln unter `public/images/`, nur lokale Dateien).

Die mitgelieferte Ausgabe `2026-07-10-morning.json` ist eine **klar markierte Beispiel-Ausgabe** (Banner auf jeder Seite, `isExample: true`, fiktive Quellen), damit Design und Build sofort prüfbar sind. Sie kann nach der ersten echten Ausgabe gelöscht werden.

## Logos

`npm run logos` lädt Logos über Wikidata (Property P154) von Wikimedia Commons, SVG bevorzugt, und speichert sie lokal unter `public/logos/` samt `logos.json` (Key → Datei, Quelle, Lizenzhinweis). Die Website referenziert ausschließlich lokale Dateien. Ohne auffindbares Logo zeigt die Seite einen typografischen Marken-Chip (Initialen auf Markenfarbe, sonst Tinte). Jeder Editions-Lauf ergänzt fehlende Logos automatisch. Lizenz- und Markenhinweise stehen je Eintrag in `logos.json` und im Footer.

## Design

Zeitungscharakter: Serifen-Masthead in Versalien mit Doppellinien und Drei-Spalten-Datumszeile, Source Serif 4 für Headlines und Fließtext, schmale Sans (Archivo Narrow) für Kicker, Chips, Tabellen und Charts, Initialbuchstabe und Zweispalter im Leitartikel. Farbwelt hell: Papier `#faf7f0`, Tinte `#1a1712`, Akzentrot `#8f1f1f`, Akzentblau `#1c5cab`. Dark Mode über `prefers-color-scheme` mit eigener dunkler Papier-Palette. Charts sind frameworkfreies SVG direkt aus den JSON-Daten: Balken (positiv Blau `#2a78d6`, negativ Rot `#e34948`) und Linien-Charts mit Fadenkreuz (Datum + Wert beim Überfahren), jeweils mit Quellenzeile und aufklappbarer Datentabelle, Zahlen in Tabellenziffern. Dazu: Druck-Stylesheet, Skip-Link, aria-Labels für Charts, client-seitige Suche (Pagefind) im Archiv.

## Verzeichnisstruktur

```
capital-market-daily/
├── .claude/agents/          # die 9 Redaktions-Agenten
├── .github/workflows/       # deploy.yml, edition.yml (Cron)
├── content/
│   ├── SCHEMA.md            # Content-Schema, menschlich lesbar
│   ├── stock-picks-log.md   # Wiederholungs-Sperre der Drei Aktien
│   └── editions/            # eine JSON-Datei je Ausgabe
├── public/logos/            # lokale Logos + logos.json (Lizenzhinweise)
├── qa/screenshots/          # Design-QA-Screenshots (nicht versioniert)
├── scripts/
│   ├── edition.mjs          # Pipeline-Orchestrator (npm run edition)
│   ├── fetch-market-data.mjs / fetch-company-data.mjs / lib/alphavantage.mjs
│   ├── fetch-logos.mjs      # npm run logos
│   ├── ingest.mjs           # npm run ingest <datei>
│   ├── validate.mjs         # npm run validate
│   └── design-qa.mjs        # npm run design-qa
└── src/                     # Astro: Layout, Komponenten, Seiten, Schema
```
