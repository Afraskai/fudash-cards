# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/)
und das Projekt nutzt [Semantic Versioning](https://semver.org/lang/de/).

## [0.9.0] – 2026-04-24

### Hinzugefügt
- **Shared Action-Handler** (`src/shared/action-handler.js`). Alle Karten
  unterstuetzen ab sofort die Standard-HA-Felder `tap_action`,
  `hold_action` und `double_tap_action` mit den Action-Typen `more-info`,
  `toggle`, `call-service`, `navigate`, `url` und `none`.
  - Long-Press ab 500 ms, Double-Tap-Fenster 250 ms, Move-Toleranz 8 px.
  - Keyboard-Fallback (Enter/Space) fuer a11y bleibt erhalten.
  - Bar-Card und Donut-Card unterstuetzen **per-Entity-Overrides**
    (`entities[i].tap_action` etc.) zusaetzlich zu Karten-Defaults.
  - Ohne Config-Block bleibt das bisherige Verhalten unveraendert
    (Default `tap_action: more-info` auf das Zeilen-Entity).
- **Editor-Unterstuetzung**: neuer ausklappbarer Block "Interaktionen"
  mit `ui_action`-Selector in allen vier Karten-Editoren.

### Geändert
- `FuDash.BaseCard._fireMoreInfo` entfernt (wurde nirgendwo mehr
  referenziert). Karten nutzen `FuDash.bindActions(...)`.

### Infrastruktur
- **HACS-Integration**: `hacs.json` im Repo-Root (Filename
  `fudash-cards.js`, `render_readme: true`, Min-HA-Version `2024.8.0`).
- **Release-Workflow** `.github/workflows/release.yml`: bei Tag-Push
  `v*` wird `build.sh` ausgefuehrt, der passende Changelog-Abschnitt
  extrahiert und als GitHub-Release mit `dist/fudash-cards.js`-Asset
  veroeffentlicht.
- README um Abschnitt **„Installation via HACS (empfohlen)"** ergaenzt.

## [0.8.0] – 2026-04-24

### Entfernt
- **BREAKING**: `fudash-chart-card` wurde komplett aus dem Repo entfernt
  (inkl. Editor, Doku-Abschnitt, Registrierung, Build-Eintrag und
  zugehoerige Helfer `lttb`, `_timeWeightedBuckets`, `_linearPath`,
  `_niceTicks`, `_niceTimeTicks`, `_timeFormatter`, `_nearestByT`).
  Bestehende Dashboard-Eintraege mit `type: custom:fudash-chart-card`
  werden nicht mehr gerendert und muessen entfernt werden.
- Der noch genutzte Sparkline-Helfer `FuDash._monotonePath` wurde in
  `src/shared/sparkline.js` verschoben und steht der Stat-Card
  weiterhin zur Verfuegung.

## [0.7.0] – 2026-04-22

### Geändert
- **Einheitliches Segment-Design** im Bar-Card-Stil für alle Ring- und
  Diagramm-Karten.
- **Donut-Card**: Der durchgehende Ring ist jetzt aus einzelnen Bogen-
  Segmenten mit Lücken aufgebaut. Neue Optionen `segments` (12–240) und
  `segment_gap` (Grad). Die Segmentanzahl wird automatisch an den
  Umfang angepasst, damit Balken klein genug lesbar bleiben.
- **Gauge-Card**: Der 3/4-Arc besteht nun ebenfalls aus einzelnen
  Segmenten. Der Füllstand wird durch aktivierte Segmente dargestellt;
  das "letzte" Segment wird als weicher Übergang eingeblendet. Neue
  Optionen `segments` (6–120) und `segment_gap`.

### Hinzugefügt
- **Stat-Card**: Sparkline hat jetzt denselben **Linie ↔ Balken-
  Umschalter** wie die Chart-Card (`chart_type`, `show_type_toggle`,
  `bar_width`, `bar_gap`). Der Balken-Modus nutzt Zeit-Buckets und eine
  NaN-sichere Parameter-Parsung. Editor-Felder sind modus-spezifisch
  sichtbar. Klicks auf den Toggle oeffnen nicht mehr versehentlich den
  More-Info-Dialog.
- **Gauge- und Donut-Card**: Robuste, NaN-sichere Parsung der Config-
  Felder `segments` und `segment_gap` (wie bei Chart-/Stat-Card).

- **Chart-Card**: Umschalter **Linie ↔ Balken** direkt rechts oben in
  der Karte (ohne Editor-Wechsel). Neue Config-Felder:
  - `chart_type: line | bar` – Start-Typ (Default `line`).
  - `show_type_toggle: true | false` – Umschalter ein-/ausblenden.
  - `bar_width` (px, Default 6) – Balkenbreite, orientiert sich an den
    Segmenten der Bar-Card.
  - `bar_gap` (px, Default 2) – Abstand zwischen Balken einer Gruppe.
  Der Bar-Modus verwendet **gleichmaessige Zeit-Buckets** (statt LTTB),
  damit Balken ohne Luecken ueber den gesamten Zeitraum verteilt sind.
  Pro Bucket wird der letzte bekannte Sensor-Wert zur Bucket-Mitte
  uebernommen (step-korrekte Darstellung fuer Zustandswerte).

## [0.6.0] – 2026-04-21

### Hinzugefügt
- **Neue Karte**: `fudash-stat-card` – kompakte KPI-Kachel.
  - **Große Einzelzahl** mit Einheit, Name/Untertitel darüber.
  - **Trend-Sparkline** (optional) zeichnet die letzten `hours` Stunden
    als monotone, glatte Mini-Linie mit Endpunkt-Glanzpunkt.
  - **Delta-Chip** (optional) vergleicht aktuellen Wert mit dem ersten
    Wert im Zeitraum; zeigt ↑/↓/→ plus Prozent, farbig (grün/rot/grau).
  - **Auto-Nachkommastellen** abhängig von der Größenordnung
    (100+ → 0 Stellen, 10+ → 1, sonst 2).
  - Wiederverwendung von `FuDash.fetchSeries` und `_monotonePath` aus
    der Chart-Card – kein neuer Overhead.
  - Ganze Karte ist fokussier- und klickbar (öffnet Verlauf).
- Zwei neue Beispiele in `examples/lovelace-examples.yaml` (KPI-Reihe
  aus 3 Stat-Cards + kompakte Variante ohne Sparkline).

## [0.5.0] – 2026-04-21

### Hinzugefügt
- **Neue Karte**: `fudash-donut-card` – Donut-/Pie-Diagramm für Anteile.
  - **`inner_radius`** in Prozent: 0 = Pie, 65 = klassischer Donut,
    >80 = dünner Ring.
  - **Center-Label**: Summe (Default), freie Entity (`center: sensor.xyz`)
    oder ausgeblendet (`show_total: false`). `center_label` setzt den
    Untertitel.
  - **Legende** mit Live-Werten **und optional Prozenten** (`show_percent`).
    Klick auf Legende oder Slice öffnet den More-Info-/Verlaufs-Dialog.
  - **Nur positive Werte** werden als Slice geplottet; `0`/`unavailable`
    tauchen in der Legende auf, zählen aber nicht zur Prozentverteilung.
  - Slices sind **per Tab fokussierbar** (Enter/Space öffnet Dialog)
    mit sichtbarem Glow-Focus.
- Zwei neue Beispiele in `examples/lovelace-examples.yaml` (Strommix,
  Raumtemperaturen als Pie).

## [0.4.1] – 2026-04-21

### Hinzugefügt (Chart-Card)
- **`line_width`** (global): Strichstärke 0,5–6 px einstellbar; pro Serie
  weiterhin über `series[].line_width` überschreibbar.
- **`decimals`** (global): Nachkommastellen für Y-Achse, Tooltip und
  Legende. Ohne Angabe wird automatisch anhand der Achsen-Schrittweite
  gerundet (z. B. 0 Nachkommastellen bei W, 1 bei kW).
- **`show_legend`** (global): Legende unter dem Chart ausblendbar.
- Neue Beispiele in `examples/lovelace-examples.yaml` mit
  `sensor.solarleistung_total` und `sensor.load_power`.

## [0.4.0] – 2026-04-21

### Hinzugefügt
- **Neue Karte**: `fudash-chart-card` – Multi-Serien-Zeitreihen-Chart im
  FuDash-Stil.
  - **Zeitraum** 1–168 h (bis zu 7 Tage) konfigurierbar.
  - **Datenquelle automatisch**: bis 24 h Roh-Historie
    (`history/history_during_period`), darüber vorverdichtete
    Long-Term-Statistics (`recorder/statistics_during_period`, 5-Minuten-
    bzw. Stunden-Buckets).
  - **LTTB-Downsampling** (Largest-Triangle-Three-Buckets) liefert
    visuell treue Kurven auch bei tausenden Rohpunkten.
  - **Kurven-Glättung** via monotoner kubischer Spline (Fritsch-Carlson) –
    keine Überschwinger bei Datenspitzen.
  - **Serientypen**: `area`, `line`, `line+area`, `area-only`.
  - **Tooltip** mit vertikalem Cursor und Werten aller Serien zum
    Zeitpunkt; **Legende** mit Live-Werten.
  - **Klick auf Legende** öffnet More-Info/Verlauf der Entity.
  - **Farb-Presets** (die gleichen 19 wie in Bar/Gauge) oder beliebige
    CSS-Farben.
  - **Automatisches Refresh** alle 60 s (konfigurierbar).

## [0.3.0] – 2026-04-21

### Hinzugefügt
- **Beide Karten**: Klick öffnet den HA-More-Info-Dialog der Entity (mit
  Verlauf/History-Graph).
  - **Gauge**: Klick auf die gesamte Karte.
  - **Bar**: Klick auf die jeweilige Entity-Zeile (jede Zeile für sich).
- **A11y**: Zeilen/Karten sind per Tab fokussierbar, Enter/Space öffnet
  den Dialog. Sichtbarer Focus-Ring in der Primärfarbe.
- **Hover-Feedback**: dezente Highlight-Animation beim Darüberfahren.

## [0.2.1] – 2026-04-21

### Hinzugefügt
- **Gauge**: neuer Schalter `show_range` (Default `true`) blendet die
  Min/Max-Beschriftung unter dem Gauge ein bzw. aus. Der bestehende
  Schalter `show_numbers` steuert jetzt ausschließlich den Wert in der
  Mitte des Gauges.

## [0.2.0] – 2026-04-21

### Entfernt
- **BREAKING**: Halbkreis-Form (`shape: semi`) wurde entfernt. Die Gauge
  ist jetzt immer ein 3/4-Kreis. Die Option `shape` im YAML und im Editor
  existiert nicht mehr. Vorhandene Konfigurationen mit `shape: semi` oder
  `shape: arc` laufen weiter (der Wert wird ignoriert).

## [0.1.2] – 2026-04-21

### Geändert
- **Gauge (Halbkreis)**: Wert-Label sitzt jetzt als normales Flow-Element
  UNTER dem Arc (nicht mehr absolut platziert im Bogen). Schriftgröße
  skaliert proportional zur Gauge-Größe (`size * 0.13`) – wirkt deutlich
  ausbalancierter.
- **Gauge-Marker**: Kreis → gefülltes **Dreieck** außerhalb des Arcs,
  nach innen zeigend. Sieht nicht mehr wie ein Slider-Knopf aus.

## [0.1.1] – 2026-04-21

### Geändert
- **Gauge**: Zeiger-Strich ersetzt durch modernen Arc-Marker (ringförmiger
  Punkt direkt auf dem farbigen Balken).
- **Gauge**: Karte ist jetzt responsive – Größe ist Maximalbreite statt
  Fixbreite; Zahlen skalieren via Container-Queries und rutschen nicht mehr
  aus dem Rahmen bei größeren `size`-Werten.
- **Gauge**: Wert-Schriftgröße im Halbkreis reduziert (mehr Platz-Balance).
- **Gauge**: Layout-Optionen (`grid_min_columns: 2`) – Karte passt jetzt
  auch in schmale Spalten im Sections-Dashboard.
- **Editoren**: Farb-Dropdown mit 19 modernen Presets (blue, indigo, teal,
  cyan, green, lime, amber, orange, red, pink, rose, purple, slate, …).
- **Editor (Gauge)**: Warn-/Krit-Labels zeigen die Farbe in Klammern.
- **Bar**: Layout-Optionen (`grid_min_columns: 3`) und neues
  `value_color`-Feld im Editor als Standardfarbe für alle Balken.

## [0.1.0] – 2026-04-21

### Hinzugefügt
- `fudash-bar-card`: horizontaler Segment-Balken im "Fuel-Used"-Stil mit
  mehreren Entities, optionalen `warn`/`crit`-Schwellen, responsiver
  Segmentzahl und Material-3-Theme-Integration.
- `fudash-gauge-card`: moderne Radial-Gauge als 3/4-Kreis oder Halbkreis,
  optional mit Zeiger, mit Warn/Crit-Schwellen und HA-Theme-Variablen.
- Visuelle Editoren für beide Karten auf Basis von `ha-form`.
- Build-Skript `build.sh`, das `src/`-Dateien zu `dist/fudash-cards.js`
  konkateniert (keine externen Build-Tools nötig).
- Beispiel-Dashboard-YAML unter `examples/lovelace-examples.yaml`.
