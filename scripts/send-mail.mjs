// Verschickt nach jeder fertigen Ausgabe eine E-Mail mit Titelseiten-Teaser
// und Link zur Live-Ausgabe. Kostenlos über Gmail-SMTP mit einem
// App-Passwort (kein bezahlter Dienst). Bricht die Pipeline nie ab: fehlen
// die Umgebungsvariablen, wird der Versand nur übersprungen und gewarnt.
//
// Benötigte Umgebungsvariablen (lokal in .env, nie committen):
//   GMAIL_USER           Absender-Adresse, z. B. deine@gmail.com
//   GMAIL_APP_PASSWORD   16-stelliges App-Passwort (myaccount.google.com/apppasswords)
//   MAIL_TO              Empfänger, Standard: manuel.f.drescher@gmail.com
import nodemailer from "nodemailer";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// .env von Hand einlesen (kein zusätzliches dotenv-Paket nötig)
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const slug = getArg("slug");
if (!slug) {
  console.error("Aufruf: node scripts/send-mail.mjs --slug JJJJ-MM-TT-slot");
  process.exit(1);
}

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const MAIL_TO = process.env.MAIL_TO || "manuel.f.drescher@gmail.com";
const SITE_URL = process.env.SITE_URL || "https://manuelfdrescher-lgtm.github.io/capital-compass";

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn("⚠️  GMAIL_USER/GMAIL_APP_PASSWORD nicht gesetzt (.env fehlt) — Mailversand übersprungen.");
  process.exit(0);
}

const editionPath = join(root, "content", "editions", `${slug}.json`);
if (!existsSync(editionPath)) {
  console.error(`❌ Edition nicht gefunden: ${editionPath}`);
  process.exit(1);
}
const edition = JSON.parse(readFileSync(editionPath, "utf8"));

const leitartikel = edition.articles.find((a) => a.ressort === "titelseite") ?? edition.articles[0];
const weitere = edition.articles.filter((a) => a !== leitartikel).slice(0, 4);
const editionUrl = `${SITE_URL}/ausgabe/${slug}/`;

const tilesHtml = edition.market.tiles
  .slice(0, 8)
  .map((t) => {
    const color = t.direction === "up" ? "#2f5d38" : t.direction === "down" ? "#8a2430" : "#6d675c";
    const arrow = t.direction === "up" ? "▲" : t.direction === "down" ? "▼" : "◆";
    return `<td style="padding:8px 12px;border:1px solid #e5ded0;font-family:Arial,sans-serif">
      <div style="font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#6d675c">${t.label}</div>
      <div style="font-size:16px;font-weight:700;color:#111">${t.value}</div>
      ${t.delta ? `<div style="font-size:12px;color:${color}">${arrow} ${t.delta}</div>` : ""}
    </td>`;
  })
  .join("");

const weitereHtml = weitere
  .map(
    (a) => `<tr><td style="padding:10px 0;border-top:1px solid #e5ded0">
      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#7b1e2a">${a.kicker}</div>
      <div style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#111;margin-top:2px">${a.headline}</div>
      <div style="font-family:Georgia,serif;font-size:13px;color:#6d675c;font-style:italic;margin-top:2px">${a.dek}</div>
    </td></tr>`
  )
  .join("");

const html = `
<div style="max-width:600px;margin:0 auto;background:#f4efe6;padding:24px 20px;font-family:Georgia,serif;color:#111">
  <div style="text-align:center;border-bottom:3px double #111;padding-bottom:12px;margin-bottom:16px">
    <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.2em;color:#7b1e2a">THE CAPITAL COMPASS</div>
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#6d675c">${edition.edition.dataAsOf}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px"><tr>${tilesHtml}</tr></table>

  <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#7b1e2a">${leitartikel.kicker}</div>
  <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;line-height:1.2;margin:6px 0">${leitartikel.headline}</div>
  <div style="font-family:Georgia,serif;font-size:15px;color:#6d675c;font-style:italic;margin-bottom:16px">${leitartikel.dek}</div>

  <table style="width:100%;border-collapse:collapse">${weitereHtml}</table>

  <div style="text-align:center;margin:28px 0">
    <a href="${editionUrl}" style="display:inline-block;background:#111;color:#f4efe6;font-family:Arial,sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;padding:12px 28px;text-decoration:none">Vollständige Ausgabe lesen</a>
  </div>

  <div style="text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#6d675c;border-top:1px solid #e5ded0;padding-top:12px">
    Bildung, keine Anlageberatung. Keine Kauf-, Verkaufs- oder Halteempfehlungen.
  </div>
</div>`;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

const subject = `The Capital Compass — ${leitartikel.headline}`;
await transporter.sendMail({
  from: `The Capital Compass <${GMAIL_USER}>`,
  to: MAIL_TO,
  subject,
  html,
});

console.log(`✅ Mail verschickt an ${MAIL_TO}: "${subject}"`);
