# Anleitung Morgenlauf The Capital Compass

Diese Datei ist die maßgebliche Anleitung für den täglichen Morgenlauf (geplante Aufgabe capital-compass-morgenlauf-2). Sie liegt im Arbeitsordner, damit der Lauf sie ohne Rückfrage lesen kann.

Du veröffentlichst die heutige Ausgabe der Zeitung „The Capital Compass“. Das entspricht Manuels Auftrag „deploy die neueste Ausgabe“. Du arbeitest allein, niemand schaut zu, und niemand beantwortet Rückfragen. Antworte auf Deutsch.

## Grundregeln für den unbeaufsichtigten Lauf
- Shell-Befehle führst du AUSSCHLIESSLICH so aus, aus dem Arbeitsordner heraus: `bash capital-market-daily/scripts/automatik.sh <schritt>`. Keine anderen Shell-Befehle, kein `cd`, keine Pipes, keine Verkettungen. Alles Nötige kann das Skript.
- Dateien schreibst oder änderst du nur in `capital-market-daily/qa/`, `capital-market-daily/incoming/`, `capital-market-daily/content/editions/` und in der Projektnotiz (siehe unten). Bilder siehst du dir mit Read an.
- Warte nie auf eine Freigabe oder Antwort. Wird eine Aktion abgelehnt, wiederhole sie nicht unverändert. Brich den betroffenen Schritt ab und melde es in der Zusammenfassung.
- Lange Schritte (einspielen, qa, veroeffentlichen, live) mit Zeitlimit 600000 ms starten.
- Sparsam arbeiten: keine Subagenten, keine Workflows. Keine Design- oder Code-Änderungen an der Website.

## Vorab
1. Lies die Projektnotiz: /Users/manueldrescher/.claude/projects/-Users-manueldrescher-Library-Mobile-Documents-com-apple-CloudDocs-HHL-Courses-4th-term-BPS-Claude/memory/capital-market-daily.md
2. `bash capital-market-daily/scripts/automatik.sh status`. Steht dort AUSGABE_SCHON_IM_REPO, ist nichts zu tun: kurz melden und beenden.

## Schritt 1: Ausgabe aus Cowork holen
- In Claude in Chrome einen neuen Tab öffnen: https://claude.ai/scheduled-task/trig_01EP9p4PF9iiYmi4BLQHS8Zy („The Capital Compass -- Tagesausgabe“, läuft täglich gegen 5:00).
- Im Verlauf den Lauf von heute („Heute um …“) öffnen. Schnellster Weg (erprobt am 19.11.2026): Im Chat gibt es einen Link mit dem Text `<HEUTE>-morning.json`. Seine Adresse per JavaScript lesen (`[...document.querySelectorAll('a')].filter(a => /<HEUTE>-morning\.json/.test(a.innerText))`), den Inhalt mit `fetch(href, {credentials: 'include'})` holen, mit `JSON.parse` prüfen (Datum `edition.date` muss `<HEUTE>` sein) und als Download mit Dateinamen `<HEUTE>-morning.json` auslösen. Klappt das nicht, das Kärtchen `<HEUTE> morning` (Code · JSON) anklicken, rechts in der Vorschau das Menü neben „Kopieren“ öffnen und „Als JSON herunterladen“ wählen.
- Den Cowork-Tab danach sofort schließen.
- Ist der Lauf noch nicht fertig, alle 10 Minuten erneut nachsehen, höchstens 60 Minuten. Gibt es keinen Lauf von heute oder keine Datei, melden und beenden.
- `bash capital-market-daily/scripts/automatik.sh holen`

## Schritt 1b: Presse-Abgleich mit Handelsblatt, WirtschaftsWoche und Financial Times (Pflicht)
Manuel ist bei allen dreien in Chrome eingeloggt. Das ist ihm sehr wichtig.
- In einem eigenen Tab neu laden und bis unten durchscrollen: https://www.handelsblatt.com/ , https://www.handelsblatt.com/themen/sap , https://www.wiwo.de/ , https://www.wiwo.de/themen/sap , https://www.ft.com/ , https://www.ft.com/stream/166623cd-685e-4fc3-946d-9e67c9a4041d . Schlagzeilen per JavaScript aus den Links lesen. In `browser_batch` wird jede Ausgabe nach rund 800 Zeichen abgeschnitten, also in Stücken abholen. Volltexte mit `get_page_text` außerhalb des Batches lesen.
- Mit den Artikeln der Ausgabe vergleichen und bis zu 6 Stücke der letzten 48 Stunden ganz lesen, SAP immer zuerst.
- In `capital-market-daily/incoming/<HEUTE>-morning.json` die betroffenen Artikel ergänzen oder korrigieren: neue Fakten in eigenen Worten als Absatz in `body`, die Quelle in `sources` als `{"title": "Handelsblatt: <Titel> (TT.MM.JJJJ)", "url": "<Adresse ohne Parameter>", "tier": 2}`. Weichen Zahlen ab, beide mit Quelle nennen. Nur Quellen eintragen, die du gelesen hast. Keine längeren wörtlichen Übernahmen, höchstens kurze Zitate von Personen.
- Stil: wie Handelsblatt, WirtschaftsWoche und FT, also klar, konkret und faktenstark, dabei etwas einfacher und erklärender. Fachbegriffe beim ersten Auftreten kurz erklären. Keine Wörter „sondern“ und „nicht nur“, keine Gedankenstriche, keine Anrede mit du, kein Hinweis auf Logins oder Bezahlschranken.
- Ist eine Seite nicht lesbar oder ausgeloggt, weitermachen und das in der Zusammenfassung melden.

## Schritt 2: Umlaute
- `bash capital-market-daily/scripts/automatik.sh umlaute-bericht`
- Die mehrdeutigen und unbekannten Wörter selbst entscheiden und als JSON-Objekt nach `capital-market-daily/qa/manuell-<HEUTE>.json` schreiben (Wort → Ersetzung, leerer Wert = unverändert, z. B. „verteuert“; Eigennamen wie „Mueller Water Products“ leer lassen).
- `bash capital-market-daily/scripts/automatik.sh umlaute-anwenden`. Meldet es UMLAUT-RESTE, die Datei `capital-market-daily/qa/manuell-<HEUTE>.json` ergänzen und wiederholen.

## Schritt 3: Ein eigenes Bild je Artikel (Pflicht)
- Jeder Artikel bekommt ein eigens für seine Geschichte neu erzeugtes Foto aus ChatGPT (chatgpt.com in Chrome, Manuels Plus-Konto). Nie Bilder wiederverwenden, keine Zeichnungen, keine Bildbank.
- Tempo: Drei ChatGPT-Tabs mit je einem neuen Chat öffnen und die Artikel gleichmäßig in Ausgabe-Reihenfolge verteilen (etwa Tab 1: Artikel 1 bis 5, Tab 2: 6 bis 10, Tab 3: 11 bis 14). Jeder Tab rechnet sein Bild parallel, in jedem Tab erst das nächste Bild schicken, wenn das vorige fertig ist. Das spart rund zwei Drittel der Zeit. Absenden nach dem Tippen per JavaScript mit dem Knopf `button[aria-label="Send"]`, weil Return in parallelen Tabs manchmal nichts bewirkt. Danach prüfen, dass das Eingabefeld leer ist.
- Für jeden Artikel ein Prompt, jeder beginnt mit „New unrelated image.“: „New unrelated image. Generate a photorealistic editorial news photograph, 3:2 landscape, for a finance newspaper. [KONKRETE SZENE ZUM ARTIKEL]. Cinematic documentary photography, natural light, muted desaturated grade, shallow depth of field, ultra sharp. No legible text, no numbers, no brand logos.“ Bei Politik- und Ländermotiven zusätzlich „no flags“.
- Eingabe: Fokus per JavaScript `document.querySelector('[contenteditable="true"][aria-label="Ask ChatGPT"]').focus()`, Prompt tippen, Return. Pro Bild rund 2 Minuten warten, erst dann den nächsten Prompt. Nie neu laden, solange ein Bild rechnet.
- Download direkt im Chat: Für jedes fertige Bild (img mit alt „Generated image …“, naturalWidth über 500) per JavaScript `fetch(img.src).then(r => r.blob())` und einen Download-Link mit Dateinamen `cc-art-<MMTT>-<NN>.png` in Prompt-Reihenfolge auslösen (NN = 01, 02, …). ChatGPT blendet Bilder außerhalb des Sichtbereichs aus und zeigt manche doppelt: nach senkrechter Position ordnen, Dubletten an gleicher Position nur einmal zählen, notfalls scrollen.
- Fertig ist ein Bild erst, wenn nach dem letzten Prompt (Text beginnt mit „New unrelated image“) ein Knopf `button[aria-label="Copy image"]` steht; per XPath und `compareDocumentPosition` prüfen. Bilder zu zählen ist unzuverlässig, weil ChatGPT ältere ausblendet. Ein einzelner JavaScript-Aufruf darf höchstens rund 40 Sekunden warten (Zeitlimit 45 s), sonst in mehreren Aufrufen warten.
- Muss ein Bild ersetzt werden, vorher `bash capital-market-daily/scripts/automatik.sh bild-weg <NN>` ausführen. Das schiebt die alte Datei beiseite, sonst benennt Chrome den neuen Download um.
- Jeden ChatGPT-Tab schließen, sobald sein letztes Bild geladen ist (Manuels Wunsch: Tabs immer schließen, sobald die Arbeit darin erledigt ist; gilt auch für Cowork- und Presse-Tabs).
- `bash capital-market-daily/scripts/automatik.sh bilder-liste` erzeugt einen Kontaktbogen mit Nummern und listet die Artikel. Den Kontaktbogen mit Read ansehen und prüfen, dass Bild NN zu Artikel NN passt. Anatomie-Prüfung (Pflicht, Manuels ausdrücklicher Wunsch): Jedes Bild mit Menschen einzeln und groß ansehen. Arme, Handgelenke, Hände, Finger und Körperhaltung müssen zueinander passen; wer nach vorn gerichtet ist und nach hinten greift, muss Arm und Handgelenk sichtbar drehen. Passt etwas nicht, das Bild im selben Tab neu erzeugen und mit derselben Nummer ersetzen. In jeden Prompt mit Menschen den Zusatz „Anatomically correct arms, wrists and hands, natural body posture.“ aufnehmen.
- Zuordnung als JSON-Liste nach `capital-market-daily/qa/bilder-<HEUTE>.json` schreiben: `[{"id": "<artikel-id>", "nr": 1, "datei": "<motiv-slug>", "alt": "<Bildbeschreibung>", "caption": "<Bildunterschrift>"}, …]`. Der Dateiname beschreibt das Motiv.
- `bash capital-market-daily/scripts/automatik.sh bilder` muss BILDER_OK melden.

## Schritt 4: Einspielen und prüfen
- `bash capital-market-daily/scripts/automatik.sh einspielen` (Ausgabennummer, Logos, Kursverläufe, Validierung, Aktien-Log). Lehnt die Prüfung die Ausgabe ab, steht der Grund in der Ausgabe des Skripts. Persönliche Bezüge (Manuel, Praktikum, Corporate Strategy Group, Anrede mit du) sind verboten, die Zeitung schreibt für alle Leser. Formuliere genau den gemeldeten Satz in `capital-market-daily/incoming/<HEUTE>-morning.json` neutral um, ohne Fakten zu ändern (Beispiel: „Für Manuel ist …“ wird „Für Anleger ist …“), und wiederhole `einspielen`. Andere Inhalte schreibst du nur im Presse-Abgleich aus Schritt 1b selbst.
- Die Ausgabe des Skripts meldet SAP-LEITARTIKEL und SAP-KAESTEN. Fehlt etwas, trotzdem veröffentlichen und deutlich in der Zusammenfassung melden (Regel gilt bis einschließlich 12.02.2027).
- `bash capital-market-daily/scripts/automatik.sh qa`. Meldet die Design-Prüfung Befunde, nicht veröffentlichen und melden.
- Datum im Vorspann (Manuels ausdrücklicher Wunsch): `qa` muss `VORSPANN_DATUM: ok` mit dem heutigen Datum melden. Der Vorspann tippt eine Kopie der Datumszeile im Seitenkopf, und die kommt aus `edition.date` der Ausgabe. Meldet es FALSCH, in `capital-market-daily/incoming/<HEUTE>-morning.json` das Feld `edition.date` auf `<HEUTE>` setzen, `einspielen` und `qa` wiederholen. Nie mit falschem Datum veröffentlichen.

## Schritt 5: Veröffentlichen und live prüfen
- `bash capital-market-daily/scripts/automatik.sh veroeffentlichen "Ausgabe <HEUTE>-morning (Nr. <N>) mit eigenem Bild je Artikel"` muss VEROEFFENTLICHT melden.
- `bash capital-market-daily/scripts/automatik.sh live` muss LIVE_OK melden. Erst dann gilt die Ausgabe als veröffentlicht. Nie nur behaupten. Die Zeile DATUM_LIVE nennt dabei das Datum, das Kopf und Vorspann live zeigen.

## Abschluss
- In der Projektnotiz die Zeile mit der höchsten Ausgabe aktualisieren (Nummer, Datum, Artikelzahl).
- Alle Chrome-Tabs schließen, die du geöffnet hast.
- Einmaliger Ping: Gibt es die Datei `capital-market-daily/qa/ping-datum-erledigt.txt` noch nicht und hat `live` LIVE_OK gemeldet, lade das Tool PushNotification per ToolSearch und schicke Manuel genau einen Satz: „Capital Compass Nr. <N> ist live, und der Vorspann zeigt automatisch das neue Datum (<Datum aus DATUM_LIVE>).“ Lege danach diese Datei mit dem heutigen Datum als Inhalt an. Gibt es das Tool nicht, überspringe den Ping und lege die Datei nicht an.
- In drei bis fünf Sätzen zusammenfassen: Ausgabennummer, Zahl der Artikel und Bilder, SAP-Leitartikel und SAP-Kästen, umformulierte persönliche Bezüge, im Presse-Abgleich geänderte Artikel mit Quellen, Ergebnis der Live-Prüfung, Probleme. Kein Code.