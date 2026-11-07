#!/bin/bash
# Einziger Einstiegspunkt für den täglichen, unbeaufsichtigten Deploy-Lauf
# (geplante Aufgabe „capital-compass-deploy“). Die Aufgabe führt Shell-
# Befehle nur über dieses Skript aus; genau dafür ist es in
# BPS/Claude/.claude/settings.local.json freigegeben. So kann kein Lauf an
# einer Rückfrage hängen bleiben.
#
# Aufruf aus dem Ordner BPS/Claude:
#   bash capital-market-daily/scripts/automatik.sh <schritt> [argumente]
# Das Datum ist immer heute, außer DATUM=JJJJ-MM-TT steht als letztes Argument.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 1
export GIT_AUTHOR_NAME="Manuel Drescher" GIT_AUTHOR_EMAIL="manueldrescher@MacBook-Pro-6.local"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
REMOTE="https://github.com/manuelfdrescher-lgtm/capital-compass.git"
LIVE="https://manuelfdrescher-lgtm.github.io/capital-compass"

schritt="${1:-hilfe}"; shift || true
DATUM="$(date +%Y-%m-%d)"
for a in "$@"; do [[ "$a" =~ ^DATUM=([0-9]{4}-[0-9]{2}-[0-9]{2})$ ]] && DATUM="${BASH_REMATCH[1]}"; done
MMTT="${DATUM:5:2}${DATUM:8:2}"
EIN="incoming/$DATUM-morning.json"
AUSGABE="content/editions/$DATUM-morning.json"

case "$schritt" in
  status)
    echo "Datum: $DATUM"
    [ -f "$AUSGABE" ] && echo "AUSGABE_SCHON_IM_REPO: $AUSGABE" || echo "AUSGABE_FEHLT_IM_REPO"
    [ -f "$EIN" ] && echo "INCOMING_VORHANDEN: $EIN" || echo "INCOMING_FEHLT"
    ls -t ~/Downloads/"$DATUM"-morning*.json 2>/dev/null | head -3 | sed 's/^/DOWNLOAD: /' || true
    ls ~/Downloads/cc-art-"$MMTT"-*.png 2>/dev/null | wc -l | sed 's/^ */BILDER_IN_DOWNLOADS: /'
    echo "Letzte Ausgaben im Repo:"; ls content/editions | tail -3
    ;;

  holen)
    f="$(ls -t ~/Downloads/"$DATUM"-morning*.json 2>/dev/null | head -1)"
    [ -z "$f" ] && { echo "FEHLER: keine Datei $DATUM-morning*.json in ~/Downloads"; exit 1; }
    cp "$f" "$EIN" && python3 -c "import json,sys; e=json.load(open(sys.argv[1])); print('OK', sys.argv[1], len(e['articles']), 'Artikel')" "$EIN"
    ;;

  umlaute-bericht)
    python3 scripts/fix-umlauts.py "$EIN" report
    echo "Entscheidungen als JSON nach qa/manuell-$DATUM.json schreiben (leerer Wert = unverändert), dann: umlaute-anwenden"
    ;;

  umlaute-anwenden)
    m="qa/manuell-$DATUM.json"; [ -f "$m" ] || echo '{}' > "$m"
    python3 scripts/fix-umlauts.py "$EIN" apply "$m"
    rest="$(grep -o -E '\b(fuer|ueber|Ueber|waehrend|koennen|muessen|moeglich|Aenderung|Laender|Groesse|haelt|faellt|stuetzt|Gebuehr)\b' "$EIN" | sort | uniq -c)"
    [ -n "$rest" ] && { echo "UMLAUT-RESTE:"; echo "$rest"; } || echo "KEINE_UMLAUT_RESTE"
    ;;

  bilder-liste)
    # Kontaktbogen der heruntergeladenen Bilder in Prompt-Reihenfolge, mit
    # Nummern, dazu die Artikel-Reihenfolge der Ausgabe.
    python3 -I - "$MMTT" "$EIN" <<'PY'
import glob, json, os, sys
from PIL import Image, ImageDraw
mmtt, ein = sys.argv[1], sys.argv[2]
bilder = sorted(glob.glob(os.path.expanduser(f"~/Downloads/cc-art-{mmtt}-*.png")))
print(f"{len(bilder)} Bilder")
for b in bilder: print("  ", os.path.basename(b), os.path.getsize(b) // 1024, "KB")
if bilder:
    w, h = 300, 200
    spalten = 5
    bogen = Image.new("RGB", (spalten * (w + 8), ((len(bilder) + spalten - 1) // spalten) * (h + 8)), "white")
    for i, b in enumerate(bilder):
        im = Image.open(b).convert("RGB"); im.thumbnail((w, h))
        x, y = (i % spalten) * (w + 8), (i // spalten) * (h + 8)
        bogen.paste(im, (x, y))
        ImageDraw.Draw(bogen).rectangle([x, y, x + 34, y + 22], fill="black")
        ImageDraw.Draw(bogen).text((x + 6, y + 5), f"{i + 1:02d}", fill="white")
    os.makedirs("qa", exist_ok=True)
    ziel = f"qa/kontaktbogen-{mmtt}.jpg"; bogen.save(ziel, quality=85)
    print("KONTAKTBOGEN:", os.path.abspath(ziel))
if os.path.exists(ein):
    e = json.load(open(ein))
    print("Artikel in Reihenfolge:")
    for i, a in enumerate(e["articles"], 1): print(f"  {i:02d} {a['id']} | {a['headline'][:70]}")
PY
    ;;

  bilder)
    # Zuordnung aus qa/bilder-<DATUM>.json:
    # [{"id": "artikel-id", "nr": 1, "datei": "motiv-slug", "alt": "...", "caption": "..."}, ...]
    z="qa/bilder-$DATUM.json"; [ -f "$z" ] || { echo "FEHLER: $z fehlt"; exit 1; }
    python3 -I - "$z" "$EIN" "$MMTT" <<'PY'
import json, os, subprocess, sys
z, ein, mmtt = sys.argv[1:4]
zuordnung = json.load(open(z)); e = json.load(open(ein))
artikel = {a["id"]: a for a in e["articles"]}
fehler = 0
for b in zuordnung:
    png = os.path.expanduser(f"~/Downloads/cc-art-{mmtt}-{int(b['nr']):02d}.png")
    jpg = f"public/images/{b['datei']}.jpg"
    if b["id"] not in artikel or not os.path.exists(png):
        print("FEHLER:", b["id"], png); fehler += 1; continue
    subprocess.run(["sips", "-Z", "1400", "-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", jpg], check=True, capture_output=True)
    artikel[b["id"]]["image"] = {"file": f"{b['datei']}.jpg", "alt": b["alt"], "caption": b["caption"], "credit": "Bild: KI-generiert (redaktionelle Illustration)"}
json.dump(e, open(ein, "w"), ensure_ascii=False, indent=2)
ohne = [a["id"] for a in e["articles"] if not a.get("image")]
dateien = {a["image"]["file"] for a in e["articles"] if a.get("image")}
print("Artikel:", len(e["articles"]), "| eindeutige Bilder:", len(dateien), "| ohne Bild:", ohne or "keine")
print("BILDER_OK" if not ohne and len(dateien) == len(e["articles"]) and not fehler else "BILDER_FEHLER")
PY
    ;;

  einspielen)
    node scripts/ingest.mjs "$EIN" || { echo "FEHLER: Ingest abgelehnt (Meldungen oben). Betroffene Stelle in $EIN korrigieren und einspielen wiederholen."; exit 1; }
    node scripts/validate.mjs | tail -3 || { echo "FEHLER: Validierung"; exit 1; }
    python3 -I - "$AUSGABE" "$DATUM" <<'PY'
import json, sys, re
datei, datum = sys.argv[1:3]
e = json.load(open(datei))
leit = e["articles"][0]
sap = "SAP" in (leit.get("kicker", "") + leit["headline"])
andere = [a for a in e["articles"][1:] if a.get("ressort") != "lernecke"]
mit = sum(1 for a in andere if (a.get("sapBezug") or "").strip())
print(f"SAP-LEITARTIKEL: {'ja' if sap else 'NEIN'} ({leit['headline'][:60]})")
print(f"SAP-KAESTEN: {mit} von {len(andere)}")
log = open("content/stock-picks-log.md").read()
neu = []
for p in e.get("stockPicks", []):
    if f"{datum}-morning | {p['name']}" in log: continue
    these = re.split(r"(?<=[.!?])\s", p.get("thesis", "").strip())[0][:140].rstrip(".")
    cap = (p.get("marketCapEUR") or "").replace("ca. ", "rund ").replace(" EUR", " €")
    neu.append(f"- {datum}-morning | {p['name']} ({p['ticker']}) | — _({cap}; {these})_")
if neu:
    with open("content/stock-picks-log.md", "a") as f: f.write("\n".join(neu) + "\n")
print("PICKS_EINGETRAGEN:", len(neu))
PY
    ;;

  qa)
    unset GITHUB_REPOSITORY
    npm run build >/tmp/cc-build.log 2>&1 || { tail -20 /tmp/cc-build.log; echo "FEHLER: Build"; exit 1; }
    node scripts/design-qa.mjs 2>&1 | tail -4
    ;;

  veroeffentlichen)
    msg="${1:-Ausgabe $DATUM-morning mit eigenem Bild je Artikel}"
    [[ "$msg" == DATUM=* ]] && msg="Ausgabe $DATUM-morning mit eigenem Bild je Artikel"
    git add -A
    git diff --cached --quiet || git commit -q -m "$msg" || { echo "FEHLER: Commit"; exit 1; }
    git push -q origin main 2>&1 | tail -2
    # dist frisch anlegen: iCloud legt sonst Doppel an ("x 2") und lässt Dateien aus
    rm -rf dist
    GITHUB_REPOSITORY="manuelfdrescher-lgtm/capital-compass" npm run build >/tmp/cc-build.log 2>&1 || { tail -20 /tmp/cc-build.log; echo "FEHLER: Build mit Basispfad"; exit 1; }
    cd dist || exit 1
    rm -rf .git && git init -q && git checkout -q -b gh-pages && touch .nojekyll
    git add -A && git commit -q -m "Deploy $DATUM" || { echo "FEHLER: gh-pages-Commit"; exit 1; }
    git config http.postBuffer 524288000; git config http.version HTTP/1.1
    git push -f -q "$REMOTE" gh-pages 2>&1 || { sleep 20; git push -f -q "$REMOTE" HEAD:refs/heads/gh-pages 2>&1; }
    lokal="$(git rev-parse --short HEAD)"; fern="$(git ls-remote "$REMOTE" gh-pages | cut -c1-7)"
    echo "gh-pages lokal $lokal, GitHub $fern"
    [ "$lokal" = "$fern" ] && echo "VEROEFFENTLICHT" || { echo "FEHLER: GitHub-Stand weicht ab"; exit 1; }
    ;;

  live)
    python3 -I - "$AUSGABE" "$DATUM" "$LIVE" <<'PY'
import json, sys, time, urllib.request, datetime
datei, datum, live = sys.argv[1:4]
e = json.load(open(datei))
tage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
monate = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
d = datetime.date.fromisoformat(datum)
text = f"{tage[d.weekday()]}, {d.day}. {monate[d.month - 1]} {d.year}"
def holen(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r: return r.status, r.read()
html = ""
for versuch in range(30):  # bis zu 5 Minuten auf GitHub Pages warten
    try:
        _, roh = holen(f"{live}/?v={int(time.time())}"); html = roh.decode("utf-8")
        if text in html: break
    except Exception: pass
    time.sleep(10)
ok = True
print("DATUM_LIVE:", "ja" if text in html else "NEIN", f"({text})"); ok &= text in html
leit = e["articles"][0]["id"]
erster = html.find('class="artikel artikel--leit"')
print("LEITARTIKEL_VORN:", "ja" if erster >= 0 and f'id="{leit}"' in html[erster:erster + 300] else "NEIN")
reste = [w for w in [" fuer ", " ueber ", " waehrend "] if w in html]
print("UMLAUTE:", "ok" if not reste else f"RESTE {reste}"); ok &= not reste
for a in e["articles"]:
    f = a.get("image", {}).get("file")
    try:
        status, inhalt = holen(f"{live}/images/{f}")
        gut = status == 200 and len(inhalt) > 50_000
    except Exception:
        gut = False
    if not gut: print("BILD_FEHLT:", f); ok = False
print("LIVE_OK" if ok else "LIVE_FEHLER")
PY
    ;;

  *)
    echo "Schritte: status | holen | umlaute-bericht | umlaute-anwenden | bilder-liste | bilder | einspielen | qa | veroeffentlichen \"<Commit-Text>\" | live   (optional DATUM=JJJJ-MM-TT)"
    ;;
esac
