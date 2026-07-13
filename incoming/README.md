# incoming/

Ablage für extern angelieferte Editions-JSONs (z. B. aus einem Claude-Cowork-
Prozess), solange keine direkte GitHub-Anbindung aus Cowork besteht.

Ablauf:

1. Externe Redaktion liefert ein Editions-JSON nach Schema `content/SCHEMA.md`.
2. Datei hier ablegen (Drag-and-drop), Dateiname beliebig.
3. Einsortieren: `npm run ingest incoming/<datei>.json` (optional `-- --commit`).
4. `ingest.mjs` validiert gegen das Schema, sortiert nach
   `content/editions/JJJJ-MM-TT-<slot>.json` ein und lädt fehlende Logos nach.
5. Danach `npm run build` (schreibt automatisch `public/content-index.json`
   neu) und regulär deployen.

Vor jedem externen Lauf sollte `content-index.json` von der Live-Seite
abgerufen werden, um die kanonische Ausgabennummer und den Archivstand zu
übernehmen: https://manuelfdrescher-lgtm.github.io/capital-market-daily/content-index.json
