# FuDash Cards

Moderne, im **Material-3-Stil** gehaltene Custom-Cards für Home Assistant.
Aktuell enthaltene Karten:

- **`fudash-bar-card`** – horizontaler Segment-Balken im "Fuel-Used"-Stil,
  perfekt für Hauslast / Solar / Netzbezug auf einen Blick.
- **`fudash-gauge-card`** – minimalistische Radial-Gauge (3/4-Kreis)
  mit optionalem Dreieck-Marker.
- **`fudash-donut-card`** – Donut-/Pie-Diagramm für Anteile (z. B.
  Strommix, Verteilungen), mit Center-Label (Summe oder freie Entity)
  und Klick-More-Info pro Slice.
- **`fudash-stat-card`** – kompakte KPI-Kachel mit großer Einzelzahl,
  Trend-Sparkline (Linie oder Balken, live umschaltbar) und Delta-Chip
  (Vergleich zum Zeitraum-Anfang).

Die Karten nutzen konsequent die HA-CSS-Variablen (`--ha-card-*`,
`--primary-color`, `--success-color`, …) und fügen sich dadurch in jedes
Theme (hell/dunkel, Community-Themes) ein, als wären sie Standard.

## Installation via HACS (empfohlen)

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/)

1. In HACS: **Frontend → drei Punkte oben rechts → Benutzerdefinierte
   Repositories**.
2. **Repository** `https://github.com/florre/fudash-cards` hinzufügen,
   Typ **Dashboard**.
3. **FuDash Cards** im HACS-Frontend-Store suchen → **Herunterladen**.
4. Home Assistant neu laden (Browser-Cache leeren, Strg+F5).
5. Karten tauchen im Dashboard-Editor unter *Karte hinzufügen* als
   `fudash-bar-card`, `fudash-gauge-card`, `fudash-donut-card` und
   `fudash-stat-card` auf.

Updates werden ab sofort automatisch von HACS angezeigt, sobald ein
neuer `v*`-Tag im Repo veröffentlicht wird.

**Minimal benötigte HA-Version**: 2024.8.0 (wegen `ha-form`-Selector-API).

## Installation (manuell, ohne HACS)

1. Datei `dist/fudash-cards.js` auf den Home-Assistant-Server kopieren, in
   den Ordner `/config/www/` (z. B. über *File Editor*, *Samba* oder
   *Studio Code Server*).
2. In Home Assistant:
   **Einstellungen → Dashboards → Drei-Punkte-Menü oben rechts →
   Ressourcen → Ressource hinzufügen**
   - **URL**: `/local/fudash-cards.js`
   - **Typ**: `JavaScript-Modul`
3. Browser-Cache leeren (Strg+F5 / Cmd+Shift+R).
4. Im Dashboard-Editor auf *Karte hinzufügen* klicken und nach *FuDash*
   suchen – beide Karten tauchen im Picker auf.

> Nach jedem Update der JS-Datei das Cache-Busting in der Ressource
> anpassen (z. B. `/local/fudash-cards.js?v=0.1.1`) oder Cache leeren.

## Schnellstart: Energie-Dashboard

```yaml
type: custom:fudash-bar-card
title: Energie aktuell
entities:
  - entity: sensor.solar_power
    name: Solar
    max: 8000
    color: success
  - entity: sensor.house_load
    name: Hauslast
    max: 8000
    warn: 4000
    crit: 6500
  - entity: sensor.grid_power
    name: Netzbezug
    max: 6000
    warn: 2000
    crit: 4000
```

```yaml
type: custom:fudash-gauge-card
entity: sensor.house_load
name: Hauslast
min: 0
max: 8000
warn: 4000
crit: 6500
size: 200
```

Mehr Beispiele: [`examples/lovelace-examples.yaml`](examples/lovelace-examples.yaml).

## Konfiguration

### `fudash-bar-card`

| Option       | Typ       | Default  | Beschreibung |
|--------------|-----------|----------|--------------|
| `title`      | String    | –        | Optionaler Karten-Titel. |
| `entities`   | Liste     | **Pflicht** | Mindestens eine Entity (siehe unten). |
| `segments`   | Zahl      | `40`     | Anzahl Segmente pro Balken. Wird bei schmalen Spalten automatisch reduziert. |
| `gap`        | Zahl (px) | `2`      | Abstand zwischen Segmenten. |
| `height`     | Zahl (px) | `28`     | Balkenhöhe. |
| `animate`    | Bool      | `true`   | Sanftes Einblenden / Farbwechsel. |
| `value_color`| String    | `auto`   | `auto` \| `success` \| `warn` \| `crit` \| `primary` \| beliebige CSS-Farbe. |

Entity-Eintrag (`entities[].*`):

| Feld    | Typ    | Pflicht | Beschreibung |
|---------|--------|---------|--------------|
| `entity`| String | **ja**  | Entity-ID, z. B. `sensor.solar_power`. |
| `name`  | String | nein    | Anzeigename; sonst `friendly_name` der Entity. |
| `min`   | Zahl   | nein    | Skalenstart (Default `0`). |
| `max`   | Zahl   | nein    | Skalenende (Default `100`). |
| `warn`  | Zahl   | nein    | Ab diesem Wert Segmente gelb. |
| `crit`  | Zahl   | nein    | Ab diesem Wert Segmente rot. |
| `color` | String | nein    | Wie `value_color`, aber pro Entity. |
| `unit`  | String | nein    | Überschreibt die Einheit der Entity. |

### `fudash-gauge-card`

| Option         | Typ     | Default | Beschreibung |
|----------------|---------|---------|--------------|
| `entity`       | String  | **Pflicht** | Entity-ID. |
| `name`         | String  | –       | Anzeigename. |
| `min` / `max`  | Zahl    | `0` / `100` | Skala. |
| `warn` / `crit`| Zahl    | –       | Farbwechsel-Schwellen. |
| `needle`       | Bool    | `false` | Zeigt ein Dreieck-Marker außerhalb des Arcs als Positionsanzeige. |
| `size`         | Zahl    | `180`   | Größe in Pixel. |
| `segments`     | Zahl    | `36`    | Anzahl Segmente im 3/4-Arc (6–120). Wird bei kleinen Größen automatisch gedeckelt. |
| `segment_gap`  | Zahl    | `1.5`   | Lücke zwischen Segmenten in Grad (0–8). |
| `show_numbers` | Bool    | `true`  | Wert + Einheit in der Mitte des Gauges anzeigen. |
| `show_range`   | Bool    | `true`  | Min/Max-Beschriftung an den Arc-Endpunkten anzeigen. |
| `color`        | String  | `auto`  | wie bei Bar-Card. |
| `unit`         | String  | –       | Überschreibt Entity-Einheit. |

### `fudash-donut-card`

| Option          | Typ     | Default | Beschreibung |
|-----------------|---------|---------|--------------|
| `title`         | String  | –       | Optionaler Titel. |
| `size`          | Zahl    | `200`   | Durchmesser des Donuts in Pixel. |
| `inner_radius`  | Zahl    | `65`    | Innenradius in % (0 = Pie, 65 = Donut, >80 = dünner Ring). |
| `segments`      | Zahl    | `60`    | Anzahl Ring-Segmente (12–240). Wird automatisch an den Umfang angepasst. |
| `segment_gap`   | Zahl    | `2`     | Lücke zwischen Segmenten in Grad (0–10). |
| `show_total`    | Bool    | `true`  | Summe aller Werte in der Mitte anzeigen. |
| `center`        | String  | –       | Optional: Entity-ID, deren Wert groß in der Mitte steht (statt Summe). |
| `center_label`  | String  | `Gesamt`| Untertitel unter dem Center-Wert. |
| `show_legend`   | Bool    | `true`  | Legende unter dem Donut. |
| `show_percent`  | Bool    | `true`  | Prozente in der Legende. |
| `entities`      | Liste   | **Pflicht** | Mindestens einen Eintrag (siehe unten). |

Entity-Eintrag (`entities[].*`):

| Feld     | Typ    | Pflicht | Beschreibung |
|----------|--------|---------|--------------|
| `entity` | String | **ja**  | Entity-ID. |
| `name`   | String | nein    | Anzeigename. |
| `color`  | String | nein    | Preset-Name oder beliebige CSS-Farbe. |
| `unit`   | String | nein    | Überschreibt Entity-Einheit. |

Nur **positive** Werte werden als Slice geplottet. Entities mit Wert `0`
oder `unavailable` tauchen in der Legende auf, zählen aber nicht zur
Summe/Prozentverteilung.

### `fudash-stat-card`

| Option             | Typ     | Default | Beschreibung |
|--------------------|---------|---------|--------------|
| `entity`           | String  | **Pflicht** | Entity-ID. |
| `name`             | String  | –       | Anzeigename (sonst `friendly_name`). |
| `unit`             | String  | –       | Überschreibt Entity-Einheit. |
| `color`            | String  | `primary` | Farbe für Sparkline und Delta-Glow (Preset oder CSS). |
| `hours`            | Zahl    | `24`    | Zeitraum für Trend und Delta-Referenz (1–168 h). |
| `decimals`         | Zahl    | *auto*  | Nachkommastellen; leer = automatisch je nach Größenordnung. |
| `show_trend`       | Bool    | `true`  | Sparkline unter dem Wert anzeigen. |
| `show_delta`       | Bool    | `true`  | Delta-Chip (↑/↓/→ mit %) oben rechts. |
| `chart_type`       | String  | `bar`   | Sparkline als `line` oder `bar`. UI-Toggle überschreibt das live. |
| `show_type_toggle` | Bool    | `true`  | Linie/Balken-Umschalter rechts oben ein-/ausblenden. |
| `bar_width`        | Zahl    | `3`     | Balkenbreite in px (1–20). Nur im Balken-Modus. |
| `bar_gap`          | Zahl    | `1`     | Lücke zwischen Balken in px (0–8). |
| `refresh_interval` | Zahl    | `120`   | Sekunden zwischen automatischen Re-Fetches. |

Das Delta vergleicht den **aktuellen Wert** mit dem **ersten Datenpunkt**
im Zeitraum. Ab 24 h werden automatisch Long-Term-Statistics verwendet.

## Interaktionen (tap / hold / double-tap)

Alle vier Karten unterstützen die gleichen `tap_action`-, `hold_action`-
und `double_tap_action`-Felder wie die offiziellen HA-Karten. Ohne
Config-Block öffnet ein Klick den *More-Info*-Dialog der Entity
(Default).

Unterstützte Action-Typen: `more-info`, `toggle`, `call-service`,
`navigate`, `url`, `none`.

```yaml
type: custom:fudash-gauge-card
entity: sensor.house_load
tap_action:
  action: navigate
  navigation_path: /lovelace/energie
hold_action:
  action: more-info
double_tap_action:
  action: call-service
  service: script.turn_on
  service_data:
    entity_id: script.toggle_kueche
```

Bei Bar- und Donut-Card lassen sich die Actions **pro Entity**
überschreiben (`entities[i].tap_action` etc.); fehlt der Block fällt die
Karte auf die globalen Defaults zurück.

Gesten-Timings: Long-Press ab 500 ms, Double-Tap-Fenster 250 ms,
Bewegung > 8 px bricht den Long-Press ab. Keyboard (Enter/Space)
triggert die Tap-Action.

## Entwicklung

```bash
# Nach Änderungen in src/ die Single-File-Auslieferung neu bauen:
./build.sh
# Danach dist/fudash-cards.js nach /config/www/ deployen.
```

Das Build-Skript konkateniert die `src/`-Module in der richtigen
Reihenfolge in eine einzige IIFE-gewrappte Datei – **kein Node, kein
Bundler nötig**, nur `bash` und `cat`.

Projektstruktur:

```
src/
  shared/       utils, theme, base-card, Daten-Fetching (History/LTS)
  bar-card/     Card + ha-form-basierter Editor
  gauge-card/   Card + ha-form-basierter Editor
  donut-card/   Card + ha-form-basierter Editor
  stat-card/    Card + ha-form-basierter Editor (KPI + Sparkline)
  fudash-cards.js   Registrierung bei customElements + window.customCards
dist/
  fudash-cards.js   Fertige Auslieferungsdatei
```

## Barrierefreiheit

- Balken und Gauge nutzen `role="meter"` mit `aria-valuenow/min/max/valuetext`.
- Bei `unavailable` / `unknown` werden Farben zurückgesetzt und ein
  sprechender `aria-valuetext` gesetzt.
- `prefers-reduced-motion` wird respektiert (keine Transitions).

## Roadmap

Erledigt seit Phase 1:

- Donut-Card mit Segment-Design.
- Stat-Card inkl. Sparkline (Linie/Balken) und Delta-Chip.
- Einheitliches Segment-Look in Bar, Donut, Gauge und Stat.

Geplant:

- Energiefluss-Card.
- HACS-Manifest + Release-Tags.

## Lizenz

MIT – siehe [`LICENSE`](LICENSE).
