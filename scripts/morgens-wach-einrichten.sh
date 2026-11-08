#!/bin/bash
# Einmalig mit sudo starten. Hält den Mac morgens von 5:30 bis 7:15 Uhr wach,
# auch bei geschlossenem Deckel, damit der Veröffentlichungslauf (Chrome,
# ChatGPT-Bilder) ohne Aufklappen läuft. Außerhalb des Fensters schläft der Mac
# normal. Unter 20 Prozent Akku ohne Netzteil bleibt er auch morgens im Schlaf.
#   sudo bash morgens-wach-einrichten.sh        einrichten
#   sudo bash morgens-wach-einrichten.sh aus    alles wieder entfernen
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Bitte mit sudo starten."; exit 1; }

ORDNER="/Library/Scripts/CapitalCompass"
SKRIPT="$ORDNER/wachfenster.sh"
NAME="de.capitalcompass.wachfenster"
PLIST="/Library/LaunchDaemons/$NAME.plist"

if [ "${1:-}" = "aus" ]; then
  launchctl bootout "system/$NAME" 2>/dev/null || true
  rm -f "$PLIST" "$SKRIPT"
  rmdir "$ORDNER" 2>/dev/null || true
  pmset -a disablesleep 0
  pmset repeat cancel
  echo "Entfernt. Der Mac schläft wieder normal."
  exit 0
fi

mkdir -p "$ORDNER"
cat > "$SKRIPT" <<'SKRIPT_ENDE'
#!/bin/bash
minute=$((10#$(date +%H) * 60 + 10#$(date +%M)))
batt="$(/usr/bin/pmset -g batt)"
akku="$(echo "$batt" | /usr/bin/grep -Eo '[0-9]+%' | /usr/bin/head -1 | /usr/bin/tr -d '%')"
if [ "$minute" -ge 330 ] && [ "$minute" -lt 435 ] && { echo "$batt" | /usr/bin/grep -q "AC Power" || [ "${akku:-100}" -ge 20 ]; }; then
  /usr/bin/pmset -a disablesleep 1
  /usr/bin/caffeinate -u -t 5 &
else
  /usr/bin/pmset -a disablesleep 0
fi
SKRIPT_ENDE
chmod 755 "$SKRIPT"
chown -R root:wheel "$ORDNER"

cat > "$PLIST" <<PLIST_ENDE
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$NAME</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$SKRIPT</string></array>
  <key>RunAtLoad</key><true/>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>5</integer><key>Minute</key><integer>30</integer></dict>
    <dict><key>Hour</key><integer>5</integer><key>Minute</key><integer>35</integer></dict>
    <dict><key>Hour</key><integer>5</integer><key>Minute</key><integer>40</integer></dict>
    <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>15</integer></dict>
  </array>
</dict>
</plist>
PLIST_ENDE
chown root:wheel "$PLIST"
chmod 644 "$PLIST"

launchctl bootout "system/$NAME" 2>/dev/null || true
launchctl bootstrap system "$PLIST"
pmset repeat wakeorpoweron MTWRFSU 05:31:00

echo "Eingerichtet."
pmset -g sched | head -4
launchctl print "system/$NAME" 2>/dev/null | grep -E "state =|last exit" | head -2
