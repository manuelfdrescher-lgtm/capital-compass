// Welcher Fonds steht hinter welchem Sektorwert? scripts/fetch-history.mjs
// lädt die Kursreihen über die Kürzel der SPDR-Select-Sector-Fonds und legt
// das Kürzel je Sektor in content/market-history.json ab (Feld "sektoren",
// Eintrag "symbol"). Hier steht zu jedem Kürzel der offizielle Fondsname
// und der Index, den der Fonds abbildet. Seit dem 1. Dezember 2025 tragen
// die elf Fonds "State Street" im Namen. Jeder Select Sector Index ist ein
// Teilindex des S&P 500, zusammen decken die elf Indizes den S&P 500 ab.

export const SEKTORFONDS = {
  XLE: { fonds: "State Street Energy Select Sector SPDR ETF", index: "Energy Select Sector Index" },
  XLB: { fonds: "State Street Materials Select Sector SPDR ETF", index: "Materials Select Sector Index" },
  XLI: { fonds: "State Street Industrial Select Sector SPDR ETF", index: "Industrial Select Sector Index" },
  XLY: { fonds: "State Street Consumer Discretionary Select Sector SPDR ETF", index: "Consumer Discretionary Select Sector Index" },
  XLP: { fonds: "State Street Consumer Staples Select Sector SPDR ETF", index: "Consumer Staples Select Sector Index" },
  XLV: { fonds: "State Street Health Care Select Sector SPDR ETF", index: "Health Care Select Sector Index" },
  XLF: { fonds: "State Street Financial Select Sector SPDR ETF", index: "Financial Select Sector Index" },
  XLK: { fonds: "State Street Technology Select Sector SPDR ETF", index: "Technology Select Sector Index" },
  XLC: { fonds: "State Street Communication Services Select Sector SPDR ETF", index: "Communication Services Select Sector Index" },
  XLU: { fonds: "State Street Utilities Select Sector SPDR ETF", index: "Utilities Select Sector Index" },
  XLRE: { fonds: "State Street Real Estate Select Sector SPDR ETF", index: "Real Estate Select Sector Index" },
};

// Ein Satz für die Zeile unter dem Hantel-Diagramm. Fehlt ein Kürzel in der
// Liste, nennt die Zeile nur das Kürzel aus den Daten.
export function fondsZeile(sektor, symbol) {
  const f = symbol ? SEKTORFONDS[symbol] : null;
  if (f) return `${sektor}: ${f.fonds} (${symbol}), bildet den ${f.index} ab.`;
  if (symbol) return `${sektor}: Sektorfonds mit dem Kürzel ${symbol}.`;
  return `${sektor}: Zu diesem Wert ist kein Fonds hinterlegt.`;
}

export const FONDS_HINWEIS = "Antippen eines Sektors zeigt den Fonds und den Index hinter dem Wert.";
