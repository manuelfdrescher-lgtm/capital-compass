# Repariert die ASCII-Ersatzschreibung von Umlauten (fuer, ueber, gross ...) in einem
# von Cowork gelieferten Editions-JSON. Wörterbuch = alle bereits korrigierten
# Ausgaben unter content/editions/. Nur eindeutige Fälle werden automatisch ersetzt;
# mehrdeutige und unbekannte Wörter listet der Report zur manuellen Entscheidung.
#
#   python3 scripts/fix-umlauts.py <datei.json> report
#   python3 scripts/fix-umlauts.py <datei.json> apply <manuell.json>
#
# manuell.json: {"Wort": "Ersatz", "LegitimesWort": ""}  (leerer Ersatz = unverändert lassen)
# Artikel-ids, URLs, Ticker, Dateinamen und Enum-Felder werden nie angefasst.
import json, re, sys, glob, collections
SKIP_KEYS = {"id","url","href","logoKey","ticker","type","direction","richtung","betroffenheit","verdict",
             "slot","tier","file","slug","ressort","schemaVersion","date","generatedAt","sektor","sector","exchange","isin","currency"}
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
def translit(w):
    return (w.replace("ä","ae").replace("ö","oe").replace("ü","ue").replace("ß","ss")
             .replace("Ä","Ae").replace("Ö","Oe").replace("Ü","Ue"))
def walk(o, fn, key=None):
    if isinstance(o, dict): return {k: walk(v, fn, k) for k, v in o.items()}
    if isinstance(o, list): return [walk(v, fn, key) for v in o]
    if isinstance(o, str) and key not in SKIP_KEYS: return fn(o)
    return o
def strings(o, key=None):
    if isinstance(o, dict):
        for k, v in o.items(): yield from strings(v, k)
    elif isinstance(o, list):
        for v in o: yield from strings(v, key)
    elif isinstance(o, str) and key not in SKIP_KEYS: yield o

# Korpus aus allen korrigierten Ausgaben
corpus = collections.Counter()
for f in sorted(glob.glob("content/editions/*.json")):
    d = json.load(open(f, encoding="utf-8"))
    for s in strings(d): corpus.update(WORD.findall(s))
plain = {w for w in corpus if not re.search("[äöüßÄÖÜ]", w)}
umap = collections.defaultdict(collections.Counter)
for w, n in corpus.items():
    if re.search("[äöüßÄÖÜ]", w):
        t = translit(w)
        umap[t][w] += n
        # Groß-/Kleinschreibung am Satzanfang mitnehmen
        umap[t[:1].upper()+t[1:]][w[:1].upper()+w[1:]] += n
        umap[t[:1].lower()+t[1:]][w[:1].lower()+w[1:]] += n

path = sys.argv[1]; mode = sys.argv[2] if len(sys.argv) > 2 else "report"
manual = json.load(open(sys.argv[3], encoding="utf-8")) if len(sys.argv) > 3 else {}
d = json.load(open(path, encoding="utf-8"))
cand = collections.Counter()
for s in strings(d):
    for w in WORD.findall(s):
        if re.search(r"ae|oe|ue|ss|Ae|Oe|Ue", w): cand[w] += 1

auto, ambiguous, unknown = {}, {}, {}
for w, n in cand.items():
    if w in manual: continue
    if w in umap:
        best = umap[w].most_common(1)[0][0]
        if w in plain and corpus[w] > 0:
            ambiguous[w] = (best, corpus[w], umap[w][best], n)
        else:
            auto[w] = best
    elif w in plain:
        pass  # legitimes Wort, im Korpus so belegt (neue, dass, Steuer ...)
    else:
        unknown[w] = n

if mode == "report":
    print(f"Kandidaten: {len(cand)} | automatisch: {len(auto)} | mehrdeutig: {len(ambiguous)} | unbekannt: {len(unknown)}")
    print("\n== MEHRDEUTIG (Wort | Umlautform | Korpus ascii | Korpus umlaut | hier) ==")
    for w,(b,a,u,n) in sorted(ambiguous.items()): print(f"  {w} | {b} | {a} | {u} | {n}")
    print("\n== UNBEKANNT ==")
    print("  " + ", ".join(sorted(unknown)))
else:
    table = dict(auto); table.update({k: v for k, v in manual.items() if v})
    rx = re.compile(r"(?<![A-Za-zÄÖÜäöüß])(" + "|".join(sorted(map(re.escape, table), key=len, reverse=True)) + r")(?![A-Za-zÄÖÜäöüß])")
    count = collections.Counter()
    def fix(s):
        def rep(m): count[m.group(1)] += 1; return table[m.group(1)]
        return rx.sub(rep, s)
    ids_before = [a["id"] for a in d["articles"]]
    d2 = walk(d, fix)
    assert [a["id"] for a in d2["articles"]] == ids_before
    json.dump(d2, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    t = json.dumps(d2, ensure_ascii=False)
    print("Ersetzungen:", sum(count.values()), "| Wortformen:", len(count))
    print("Umlaute jetzt:", {c: t.count(c) for c in "äöüßÄÖÜ"})
