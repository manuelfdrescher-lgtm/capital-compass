// Maße und Inhaltsversion des Marken-Logos: So hat das Bild schon vor dem
// Laden seinen Platz (Vorspann und Layout messen richtig), und ein geändertes
// Logo kommt nie aus dem Zwischenspeicher des Browsers.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export function logoInfo(datei = "masthead-logo.png") {
  const daten = readFileSync(join(process.cwd(), "public", "images", datei));
  const istPng = datei.endsWith(".png");
  return {
    width: istPng ? daten.readUInt32BE(16) : undefined,
    height: istPng ? daten.readUInt32BE(20) : undefined,
    version: createHash("md5").update(daten).digest("hex").slice(0, 8),
  };
}
