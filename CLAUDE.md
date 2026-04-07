# homeschirm – Claude Projektkontext

## Projektubersicht

Weather-Display-Anwendung fur ein **Waveshare 7.3" 7-Farben E-Paper Display** (epd7in3f).
Lauft auf einem **Raspberry Pi** mit angeschlossenem Display.

**Ablauf:**
1. DWD MOSMIX S Forecast laden (KMZ) → Station `P860`
2. KML parsen → Forecast-Daten aufbereiten (8 Tage)
3. PNG rendern via Node.js `canvas` (800x480px)
4. PNG → BMP konvertieren (ImageMagick `convert`)
5. BMP ans Display senden (Python / waveshare-Bibliothek)

---

## Stack

- **Runtime:** Node.js >= 21
- **Wichtige Pakete:** `canvas`, `node-cron`, `node-xml-stream`, `suncalc`
- **Python:** nur fur Display-Ausgabe (`python_src/display_bitmap.py`)
- **Fonts:** Cozette (`CozetteVector.ttf`), Minerva (`MINERVA1.otf`)

---

## Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/index.js` | Einstiegspunkt, Cron-Job (jede Stunde :46) |
| `src/config.js` | Konfiguration (Station, Farben, Pfade, Cron) |
| `src/lib/dwdForecast.js` | DWD-Download, KMZ-Entpacken, KML-Parsen |
| `src/lib/prepareData.js` | Datenaufbereitung fur 8 Tage |
| `src/lib/draw.js` | Canvas-Rendering → PNG erzeugen |
| `src/lib/finalize.js` | PNG→BMP Konvertierung + Display-Push |
| `src/lib/tools.js` | Hilfsfunktionen (cmd, msToHumanReadable) |
| `python_src/display_bitmap.py` | BMP aufs E-Ink Display senden |
| `data/` | Temporare Dateien (data.json, mosmix.kml/.kmz, screen.png/.bmp) |

---

## Display & Farben

Das Waveshare 7.3" epd7in3f unterstutzt **exakt 7 Farben**:

| Name | Hex | Verwendung |
|------|-----|------------|
| `white` | `#fff` | Hintergrund, Tag |
| `black` | `#000` | Nacht, Rahmen, Nulllinie |
| `red` | `#f00` | Temperaturkurve |
| `green` | `#0f0` | (reserve) |
| `blue` | `#00f` | Niederschlag |
| `yellow` | `#ff0` | Sonnenstunden |
| `orange` | `#ff8000` | Highlights, Uberlauf |

**Wichtig:** Im PNG nur diese 7 Farben verwenden. Beim BMP-Export wird auf die Display-Palette gemappt – alle anderen Farben werden gedithert und konnen falsch aussehen.
Die Palette ist in `src/config.js` unter `displayColors` definiert.

---

## Entwicklung

### Lokal (nur PNG erzeugen)
```bash
npm run dev
# Ausgabe: data/screen.png
# Display-Push wird NICHT ausgefuhrt (NODE_ENV=development)
```

### BMP prufen (nach PNG-Erzeugung)
```bash
convert data/screen.png data/screen.bmp
# Prufen ob Farben korrekt gemappt werden
```

### Auf dem Raspberry Pi
```bash
npm start
# Erzeugt PNG, konvertiert zu BMP, sendet ans Display
```

---

## Deployment

```bash
# Auf dem Pi:
cd ~/homeschirm
git pull
# Dienst neustarten (z.B. systemd oder manuell):
npm start
```

---

## Regeln

- **Code NICHT ausfuehren:** Claude fuehrt `npm run dev`, `npm start` o.ae. NICHT selbst aus. Der User testet selbst.

---

## Bekannte Probleme / TODOs

- **`fillRectHatching()`** ist leer/nicht implementiert
- **Test-Code** noch vorhanden: hardcoded Text "Hurra!", Testkreis mit fixem Datum (10-11-24)

---

## Fokus / Naechste Schritte

- **Display-Layout verbessern:** Wochentage, bessere Typografie, Wettersymbole, mehr Informationen
- **7-Farben-Palette korrekt nutzen:** Sicherstellen dass alle Farben im PNG aus `displayColors` stammen und korrekt aufs BMP-Display gemappt werden

---

## Datenstruktur

```js
// actData (aus data/data.json)
{
  issueTime: "ISO-String",   // Ausgabezeitpunkt des DWD-Modells
  updateTime: "ISO-String",  // Letzter lokaler Abruf
  coords: { lat, lon, h },   // Koordinaten der Station P860
  days: [                    // 8 Tage × 24 Stunden = 192 Eintrager
    {
      day: "2024-10-9",
      hour: 12,
      timeStep: "ISO-String",
      issueTime: "ISO-String",
      forecast: {
        TTT,    // Temperatur in Kelvin
        Td,     // Taupunkt
        RR1c,   // Niederschlag kg/m² letzte Stunde
        SunD1,  // Sonnenscheindauer in Sekunden pro Stunde
        FF, DD, // Wind (m/s, Grad)
        N,      // Bedeckungsgrad %
        PPPP,   // Luftdruck Pa
        // ... weitere MOSMIX-Elemente
      }
    }
  ]
}
```
