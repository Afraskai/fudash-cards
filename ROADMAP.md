# FuDash – Roadmap

Stand: **24. April 2026**, aktuelle Version: **v0.9.0**

Persönliche Planungs-Notiz, was als Nächstes in FuDash einfließen soll.
Reihenfolge nicht streng bindend – bei Bedarf umsortieren.

---

## Erledigt (Phase 1 – die 4 Karten)

- [x] **Bar-Card** – horizontaler Fuel-Used-Balken
- [x] **Gauge-Card** – Material-3-Radial-Gauge
- [x] **Donut-Card** – Anteile / Verteilungen mit Center-Label
- [x] **Stat-Card** – KPI mit Sparkline + Delta-Chip

> Hinweis: Die frühere `fudash-chart-card` wurde in v0.8.0 aus dem Repo
> entfernt (zu komplex, zu viele Edge-Cases). Zeitreihen-Visualisierung
> erfolgt über die HA-Standard-`history-graph-card` oder andere Cards.

---

## Phase 2 – Qualität & Release

### 1. Shared Action-Handler ✅ (v0.9.0)
Umgesetzt in `src/shared/action-handler.js`:
- `FuDash.bindActions(element, host, resolver, options)` mit
  Pointer-Events, Long-Press 500 ms, Double-Tap-Fenster 250 ms,
  Move-Toleranz 8 px, Keyboard-Fallback (Enter/Space).
- Action-Typen: `more-info`, `toggle`, `call-service`, `navigate`,
  `url`, `none`.
- Alle vier Karten refaktoriert. Bar- und Donut-Card unterstützen
  per-Entity-Overrides (`entities[i].tap_action`).
- Editor-Support: ausklappbarer Block „Interaktionen" mit
  `ui_action`-Selector in allen vier Editoren.

---

### 2. HACS-Integration ✅ (v0.9.0)
Umgesetzt:
- `hacs.json` mit Min-HA-Version `2024.8.0`, `filename: fudash-cards.js`
  und `render_readme: true` (README wird im HACS-Store angezeigt).
- `.github/workflows/release.yml`: bei Tag-Push `v*` wird `build.sh`
  ausgeführt, der passende Changelog-Abschnitt per `awk` aus
  `CHANGELOG.md` extrahiert und als Release-Beschreibung genutzt,
  `dist/fudash-cards.js` als Release-Asset angehängt.
- README-Abschnitt „Installation via HACS (empfohlen)" mit Badge und
  Schritt-für-Schritt-Anleitung.
- `info.md` absichtlich ausgelassen (RENDER_README vermeidet
  Doppelpflege).

**Nachfolgender Rollout**:
1. Repo `Afraskai/fudash-cards` auf GitHub anlegen (public).
2. Lokalen Stand pushen.
3. `git tag v0.9.0 && git push origin v0.9.0` → Workflow erzeugt
   Release automatisch.
4. Repo in HACS als „Benutzerdefiniertes Repository" (Typ
   *Dashboard*) hinzufügen.

---

### 3. Mehrsprachigkeit
Erst *nach* Shared Action-Handler, da der auch neue Strings mitbringt.

**Scope**:
- `src/translations/de.json`, `src/translations/en.json`
- Helfer `FuDash.t(key, fallback)` im `shared/utils.js`
- Alle UI-Strings auslagern (Editor-Labels, Helper, Fehlermeldungen,
  "Gesamt", "keine Daten", "Verlauf anzeigen", Delta-Tooltip …)
- Sprache aus `hass.locale.language` ziehen, Fallback `en`

**Geschätzter Aufwand**: mittel – touch in allen Editoren + Karten.

---

### 4. Playwright-Smoketests
Automatische Regressions-Absicherung.

**Scope**:
- `tests/` mit Playwright-Setup
- HA-Demo-Instanz per Docker-Compose (`ha-demo` Image)
- Dashboard mit allen 5 Karten
- Smoketests:
  - Rendert jede Karte ohne Konsolen-Fehler
  - Klick öffnet More-Info-Dialog
  - Editor öffnet sich und speichert eine Änderung
- CI-Integration: GitHub-Action, die bei PRs läuft

**Geschätzter Aufwand**: groß (Infrastruktur); lohnt erst ab stabilem
Featureset.

---

## Phase 3 – Polish (nach Feedback aus dem Alltag)

### Donut-Card
- [ ] **Animation** beim Initial-Render (Slices wachsen aus dem Zentrum)
- [ ] **Hover-Highlight** mit "explode"-Effekt des aktiven Slices

### Stat-Card
- [ ] **Mehrere Vergleichsfenster** (`compare: [24h, 7d]`) zeigt zwei Deltas
- [ ] **Min/Max-Annotation** im Sparkline-Hintergrund

### Editor-UX (alle Karten)
- [ ] **Custom Entity-Liste** statt YAML-Objekt-Editor (Bar, Donut).
  Expansion-Panels pro Eintrag mit `ha-entity-picker`, Löschen-Button
  und "+ Eintrag hinzufügen". Drag-Sort optional.

---

## Phase 4 – Ideen-Pool (keine Priorität)

- **Neue Karte**: `fudash-schedule-card` – Tages-/Wochenplan-Visualisierung
  (z. B. WP-Sperrzeiten, Wallbox-Zeitfenster)
- **Neue Karte**: `fudash-flow-card` – Energiefluss-Sankey-Diagramm
  (Solar → Haus / Netz / Batterie) als animierter Fluss
- **Design-Token-System** – zentrale Farb-Definitionen als CSS-Custom-Props
  im Root, damit Nutzer FuDash in Sekunden umfärben können
- **Theme-Presets** – Beispiel-Themes, die alle FuDash-Karten konsistent
  einfärben (z. B. "FuDash Dark Blue", "FuDash Solarpunk")

---

## Offene Entscheidungen

- [x] **GitHub-Repo-Name**: `Afraskai/fudash-cards` (festgelegt, v0.9.0).
- [x] **License**: `LICENSE`-Datei (MIT) ist bereits im Repo vorhanden.
- [x] **Minimale HA-Version**: `2024.8.0` (in `hacs.json` gesetzt).

- [ ] **Deutsch-zuerst-Positionierung**: Mehrsprachigkeit (Phase 2 #3)
  wurde bewusst zurückgestellt — Projekt bleibt auf Deutsch. Bei
  Interesse internationaler Nutzer später reaktivieren.
