// Rubriken für Kopfleiste und Dock. Auf der Seite einer Ausgabe aus dem Archiv
// führen die Rubriken zu den Abschnitten derselben Ausgabe. So bleibt man beim
// gewählten Tag und springt nicht zur neuesten Ausgabe zurück.
const LISTE = [
  { key: "titelseite", label: "Titelseite", bild: "topthemen", pfad: "" },
  { key: "news", label: "News", bild: "news", pfad: "news/" },
  { key: "politik", label: "Politik", bild: "politik", pfad: "politik/" },
  { key: "branchen-monitor", label: "Branchen-Monitor", bild: "branchen", pfad: "branchen-monitor/" },
  { key: "unternehmen", label: "Unternehmen", bild: "unternehmen", pfad: "unternehmen/" },
  { key: "drei-aktien", label: "Drei Aktien", bild: "aktien", pfad: "drei-aktien/" },
  { key: "lernecke", label: "Lernecke", bild: "lernecke", pfad: "lernecke/" },
  { key: "archiv", label: "Archiv", bild: "archiv", pfad: "archiv/" },
];

export function rubriken(base, ausgabe) {
  return LISTE.map((r) => ({
    ...r,
    href: ausgabe && r.key !== "archiv" ? `${base}/ausgabe/${ausgabe}/#${r.key}` : `${base}/${r.pfad}`,
  }));
}
