/*! fudash-cards - Home Assistant Custom Cards
 *  License: MIT
 *  Built: 2026-04-24T14:20:25Z
 *  Source: https://github.com/ (siehe README)
 */
(function () {
'use strict';

// ===== src/shared/utils.js =====
// FuDash Shared Utilities
// Gemeinsamer Namespace + Formatierungs-Helfer fuer alle Karten.
// Wird als erstes in dist/fudash-cards.js konkateniert.

const FuDash = (window.FuDash = window.FuDash || {});
FuDash.VERSION = "0.9.1";

// Custom-Event-Helfer (bubbles + composed, damit HA-Editor das mitbekommt)
FuDash.fireEvent = (node, type, detail = {}) => {
  const event = new Event(type, { bubbles: true, composed: true });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};

FuDash.getState = (hass, entityId) => {
  if (!hass || !entityId) return null;
  return hass.states?.[entityId] || null;
};

FuDash.parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

FuDash.isUnavailable = (state) =>
  !state || state.state === "unavailable" || state.state === "unknown";

FuDash.formatNumber = (hass, value, options = {}) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const locale = hass?.locale?.language || navigator.language || "de";
  try {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      ...options,
    }).format(value);
  } catch {
    return String(value);
  }
};

FuDash.escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// Moderne Farbpalette. Semantische Tokens (primary/success/warn/crit)
// mappen auf HA-Theme-Variablen, die Design-Tokens (indigo, teal, ...)
// nutzen feste Hex-Werte, die auf hellen wie dunklen Themes funktionieren.
FuDash.COLOR_PRESETS = {
  primary: "var(--primary-color)",
  success: "var(--fudash-success)",
  warn: "var(--fudash-warn)",
  crit: "var(--fudash-crit)",
  muted: "var(--fudash-muted)",
  blue: "#2196f3",
  indigo: "#5c6bc0",
  teal: "#26a69a",
  cyan: "#00bcd4",
  green: "#43a047",
  lime: "#9ccc65",
  amber: "#ffb300",
  orange: "#fb8c00",
  red: "#e53935",
  pink: "#ec407a",
  rose: "#f43f5e",
  purple: "#ab47bc",
  slate: "#64748b",
};

// Auswahlliste fuer Editoren (bleibt in Sync mit COLOR_PRESETS).
FuDash.COLOR_OPTIONS = [
  { value: "auto", label: "Auto (nach Schwelle)" },
  { value: "primary", label: "Primaerfarbe" },
  { value: "success", label: "Gruen (Erfolg)" },
  { value: "warn", label: "Gelb (Warnung)" },
  { value: "crit", label: "Rot (Kritisch)" },
  { value: "blue", label: "Blau" },
  { value: "indigo", label: "Indigo" },
  { value: "teal", label: "Teal" },
  { value: "cyan", label: "Cyan" },
  { value: "green", label: "Gruen" },
  { value: "lime", label: "Limette" },
  { value: "amber", label: "Amber" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Rot" },
  { value: "pink", label: "Pink" },
  { value: "rose", label: "Rose" },
  { value: "purple", label: "Violett" },
  { value: "slate", label: "Slate" },
  { value: "muted", label: "Grau" },
];

// Klassifiziert einen Wert anhand optionaler warn/crit-Schwellen und
// liefert ein semantisches CSS-Farb-Token.
FuDash.resolveColor = (config, value) => {
  const forced = config.color || config.value_color;
  if (forced && forced !== "auto") {
    return FuDash.COLOR_PRESETS[forced] || forced;
  }
  const warn = Number(config.warn);
  const crit = Number(config.crit);
  if (Number.isFinite(crit) && value >= crit) return "var(--fudash-crit)";
  if (Number.isFinite(warn) && value >= warn) return "var(--fudash-warn)";
  return "var(--fudash-success)";
};

// ===== src/shared/theme.js =====
// FuDash gemeinsames Stylesheet (Material-3-inspirierte Tokens,
// gemappt auf Home-Assistant-CSS-Variablen, damit jedes Theme greift).

FuDash.sharedStyles = `
  :host {
    --fudash-ease: cubic-bezier(0.2, 0, 0, 1);
    --fudash-radius: var(--ha-card-border-radius, 12px);
    --fudash-success: var(--success-color, #43a047);
    --fudash-warn: var(--warning-color, #f9a825);
    --fudash-crit: var(--error-color, #e53935);
    --fudash-track: color-mix(in srgb, var(--primary-text-color, #fff) 14%, transparent);
    --fudash-muted: var(--secondary-text-color, #8a8a8a);
    display: block;
  }

  ha-card {
    padding: 16px;
    display: block;
    border-radius: var(--fudash-radius);
  }

  .fudash-title {
    font-size: 1rem;
    font-weight: 500;
    color: var(--primary-text-color);
    margin: 0 0 12px 0;
    text-align: center;
    letter-spacing: 0.1px;
  }

  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
  }
`;

// ===== src/shared/base-card.js =====
// Basisklasse fuer alle FuDash-Karten.
// Kuemmert sich um Shadow-DOM, setConfig-Validierung und hass-Lifecycle.
// Abgeleitete Klassen ueberschreiben _render() (initiales DOM) und
// _update() (billiges Attribut-Update bei neuem hass).

FuDash.BaseCard = class FudashBaseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._rendered = false;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("FuDash: Konfiguration fehlt oder ist ungueltig");
    }
    this._config = config;
    this._rendered = false;
    if (this.isConnected) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._rendered) this._render();
    else this._update();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    if (this._config && !this._rendered) this._render();
  }

  getCardSize() {
    return 2;
  }

  // Wird von abgeleiteten Klassen ueberschrieben.
  _render() {}
  _update() {}
};

// ===== src/shared/action-handler.js =====
// FuDash Action-Handler
// Gemeinsame Klick-/Long-Press-/Double-Tap-Logik fuer alle Karten.
// Config-kompatibel zu den Standard-HA-Karten:
//   tap_action / hold_action / double_tap_action mit Feldern
//   action ("more-info" | "toggle" | "call-service" | "navigate" | "url" | "none")
//   entity / service / service_data (oder data) / target
//   navigation_path / url_path

FuDash.DEFAULT_TAP_ACTION = Object.freeze({ action: "more-info" });
FuDash.DEFAULT_HOLD_ACTION = Object.freeze({ action: "none" });
FuDash.DEFAULT_DOUBLE_TAP_ACTION = Object.freeze({ action: "none" });

FuDash.ACTION_TYPES = [
  "more-info",
  "toggle",
  "call-service",
  "navigate",
  "url",
  "none",
];

// Wiederverwendbares Schema-Fragment fuer ha-form (Editor-Support).
// Expandable-Block "Interaktionen" mit drei ui_action-Selektoren.
FuDash.ACTIONS_SCHEMA = Object.freeze({
  type: "expandable",
  name: "interactions",
  title: "Interaktionen",
  icon: "mdi:gesture-tap",
  schema: [
    { name: "tap_action", selector: { ui_action: {} } },
    { name: "hold_action", selector: { ui_action: {} } },
    { name: "double_tap_action", selector: { ui_action: {} } },
  ],
});

// Labels fuer computeLabel, damit die Felder auf Deutsch angezeigt werden.
FuDash.ACTION_LABELS = Object.freeze({
  interactions: "Interaktionen",
  tap_action: "Aktion bei Klick",
  hold_action: "Aktion bei Long-Press",
  double_tap_action: "Aktion bei Doppel-Klick",
});

// Fuehrt genau eine Action aus. Wird von bindActions intern aufgerufen,
// kann aber auch direkt genutzt werden (z. B. fuer Unit-Tests).
FuDash.handleAction = function (host, entityId, cfg) {
  if (!cfg) return;
  const type = cfg.action || "none";
  if (type === "none") return;
  const hass = host?._hass || host?.hass;

  switch (type) {
    case "more-info": {
      const eid = cfg.entity || entityId;
      if (!eid) return;
      FuDash.fireEvent(host, "hass-more-info", { entityId: eid });
      return;
    }
    case "toggle": {
      const eid = cfg.entity || entityId;
      if (!eid || !hass) return;
      // homeassistant.toggle funktioniert fuer die meisten Domains
      // (light, switch, input_boolean, fan, cover, media_player, ...).
      hass.callService("homeassistant", "toggle", { entity_id: eid });
      return;
    }
    case "call-service": {
      if (!cfg.service || !hass) return;
      const dot = String(cfg.service).indexOf(".");
      if (dot <= 0) return;
      const domain = cfg.service.slice(0, dot);
      const svc = cfg.service.slice(dot + 1);
      const data = cfg.service_data || cfg.data || {};
      hass.callService(domain, svc, data, cfg.target);
      return;
    }
    case "navigate": {
      if (!cfg.navigation_path) return;
      window.history.pushState(null, "", cfg.navigation_path);
      FuDash.fireEvent(window, "location-changed", { replace: false });
      return;
    }
    case "url": {
      if (!cfg.url_path) return;
      window.open(cfg.url_path, "_blank", "noopener");
      return;
    }
    default:
      return;
  }
};

// Bindet Pointer- und Keyboard-Listener an ein Element und feuert die
// passende Action. Der Resolver wird bei jedem Event frisch ausgewertet,
// damit per-Zeile-Entities (Bar/Donut) ohne Re-Bind funktionieren.
//
//   FuDash.bindActions(rowEl, cardInstance, () => ({
//     entity: "sensor.xy",
//     tap_action: {...}, hold_action: {...}, double_tap_action: {...},
//   }), { shouldIgnore: (ev) => ev.target.closest(".inner-toggle") });
FuDash.bindActions = function (element, host, resolver, options = {}) {
  const HOLD_MS = 500;
  const DOUBLE_WINDOW_MS = 250;
  const MOVE_TOL_PX = 8;

  let startX = 0;
  let startY = 0;
  let holdTimer = null;
  let held = false;
  let lastTapAt = 0;
  let pendingTapTimer = null;

  const getCfg = () => {
    const r = resolver() || {};
    return {
      entity: r.entity,
      tap: r.tap_action || FuDash.DEFAULT_TAP_ACTION,
      hold: r.hold_action || FuDash.DEFAULT_HOLD_ACTION,
      dbl: r.double_tap_action || FuDash.DEFAULT_DOUBLE_TAP_ACTION,
    };
  };

  const hasRealAction = (cfg) => !!cfg && cfg.action && cfg.action !== "none";

  const clearHold = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };
  const clearPendingTap = () => {
    if (pendingTapTimer) {
      clearTimeout(pendingTapTimer);
      pendingTapTimer = null;
    }
  };

  const shouldSkip = (ev) =>
    !!(options.shouldIgnore && options.shouldIgnore(ev));

  element.addEventListener("pointerdown", (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    if (shouldSkip(ev)) return;
    held = false;
    startX = ev.clientX;
    startY = ev.clientY;
    const { hold, entity } = getCfg();
    if (hasRealAction(hold)) {
      clearHold();
      holdTimer = setTimeout(() => {
        held = true;
        holdTimer = null;
        // Optional: HA-Haptic-Feedback. Ignoriert, wenn nicht unterstuetzt.
        FuDash.fireEvent(host, "haptic", "long");
        FuDash.handleAction(host, entity, hold);
      }, HOLD_MS);
    }
  });

  element.addEventListener("pointermove", (ev) => {
    if (!holdTimer) return;
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > MOVE_TOL_PX) {
      clearHold();
    }
  });

  element.addEventListener("pointercancel", () => {
    clearHold();
    held = false;
  });

  element.addEventListener("pointerleave", () => {
    clearHold();
  });

  element.addEventListener("pointerup", (ev) => {
    if (shouldSkip(ev)) return;
    clearHold();
    if (held) {
      // War ein Long-Press, Tap unterdruecken.
      held = false;
      return;
    }
    const { tap, dbl, entity } = getCfg();
    const now = Date.now();

    if (hasRealAction(dbl)) {
      if (now - lastTapAt < DOUBLE_WINDOW_MS) {
        // Zweiter Tap im Fenster -> Double-Tap, pending Single-Tap verwerfen.
        lastTapAt = 0;
        clearPendingTap();
        FuDash.handleAction(host, entity, dbl);
        return;
      }
      lastTapAt = now;
      // Single-Tap verzoegern, falls gleich noch ein zweiter Tap kommt.
      clearPendingTap();
      pendingTapTimer = setTimeout(() => {
        pendingTapTimer = null;
        FuDash.handleAction(host, entity, tap);
      }, DOUBLE_WINDOW_MS);
    } else {
      FuDash.handleAction(host, entity, tap);
    }
  });

  // Keyboard-Fallback fuer a11y: Enter / Space triggert Tap-Action.
  element.addEventListener("keydown", (ev) => {
    if (shouldSkip(ev)) return;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      const { tap, entity } = getCfg();
      FuDash.handleAction(host, entity, tap);
    }
  });
};

// ===== src/shared/sparkline.js =====
// Gemeinsame Sparkline-Helfer fuer FuDash-Karten.
// Aktuell genutzt von der Stat-Card fuer die Trend-Sparkline.

// Monotone kubische Spline (Fritsch-Carlson) als SVG-Bezier-Pfad.
// Vorteil gegenueber Catmull-Rom: keine Ueberschwinger bei Datenspitzen.
FuDash._monotonePath = (pts) => {
  const n = pts.length;
  if (n < 2) return "";
  if (n === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  const dx = new Array(n - 1);
  const dy = new Array(n - 1);
  const m = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1);
  }
  m[0] = dy[0];
  m[n - 1] = dy[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (dy[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / dy[i];
    const b = m[i + 1] / dy[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * dy[i];
      m[i + 1] = t * b * dy[i];
    }
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const c1x = pts[i].x + h / 3;
    const c1y = pts[i].y + (m[i] * h) / 3;
    const c2x = pts[i + 1].x - h / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * h) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
};

// ===== src/shared/history.js =====
// History-/Statistics-Fetcher fuer Home Assistant.
// - kurze Zeitraeume (<= HISTORY_MAX_HOURS): history/history_during_period
//   (Roh-State-Changes, voller Detailgrad)
// - laengere Zeitraeume: recorder/statistics_during_period
//   (auf 5-Minuten- bzw. Stunden-Buckets vorverdichtet, schonend fuer die DB)
// Cache auf Modulebene, damit mehrere Karten denselben Sensor nur einmal
// anfragen.

const HISTORY_MAX_HOURS = 24;

const cache = new Map(); // key = entityId+range+bucket -> { expires, promise }
const CACHE_TTL_MS = 30_000;

const cacheKey = (entityId, hours, bucket) => `${entityId}|${hours}|${bucket}`;

const pickStatisticsPeriod = (hours) => {
  // HA unterstuetzt "5minute", "hour", "day", "week", "month".
  if (hours <= 48) return "5minute";
  if (hours <= 24 * 14) return "hour";
  return "day";
};

// Rohe History (nur State-Changes) - voller Detailgrad.
const fetchRawHistory = async (hass, entityId, startIso, endIso) => {
  const res = await hass.callWS({
    type: "history/history_during_period",
    start_time: startIso,
    end_time: endIso,
    entity_ids: [entityId],
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
  const rows = res?.[entityId] || [];
  const out = [];
  for (const row of rows) {
    const v = parseFloat(row.s);
    if (!Number.isFinite(v)) continue;
    out.push({ t: row.lu ? row.lu * 1000 : Date.parse(row.lc || 0), v });
  }
  return out.sort((a, b) => a.t - b.t);
};

// Aggregierte Statistiken - HA Recorder Long-Term-Statistics.
const fetchStatistics = async (hass, entityId, startIso, endIso, period) => {
  const res = await hass.callWS({
    type: "recorder/statistics_during_period",
    start_time: startIso,
    end_time: endIso,
    statistic_ids: [entityId],
    period,
    units: {},
    types: ["mean", "state"],
  });
  const rows = res?.[entityId] || [];
  const out = [];
  for (const row of rows) {
    const v = row.mean ?? row.state;
    if (!Number.isFinite(v)) continue;
    const t = typeof row.start === "number" ? row.start : Date.parse(row.start);
    out.push({ t, v });
  }
  return out;
};

// Oeffentliche API: holt Punkte fuer eine Entity ueber die letzten 'hours' Stunden.
// Bei hours <= 24 kommen Roh-State-Changes, sonst Long-Term-Statistics.
FuDash.fetchSeries = async (hass, entityId, hours) => {
  if (!hass || !entityId) return [];
  const now = Date.now();
  const start = now - hours * 3_600_000;
  const useStats = hours > HISTORY_MAX_HOURS;
  const bucket = useStats ? pickStatisticsPeriod(hours) : "raw";
  const key = cacheKey(entityId, hours, bucket);
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.promise;

  const startIso = new Date(start).toISOString();
  const endIso = new Date(now).toISOString();
  const promise = useStats
    ? fetchStatistics(hass, entityId, startIso, endIso, bucket)
    : fetchRawHistory(hass, entityId, startIso, endIso);
  cache.set(key, { expires: now + CACHE_TTL_MS, promise });
  try {
    return await promise;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
};

// Erlaubt z.B. dem Editor, den Cache zu leeren, wenn sich Entities aendern.
FuDash.clearSeriesCache = () => cache.clear();

// ===== src/bar-card/fudash-bar-card.js =====
// fudash-bar-card
// Horizontaler Segment-Balken im "Daily Fuel Used"-Stil.
// Mehrere Entities pro Karte, responsive Segmentzahl, Warn/Crit-Schwellen.

FuDash.BarCard = class FudashBarCard extends FuDash.BaseCard {
  static getStubConfig(hass, entities) {
    const picks = (entities || [])
      .filter((e) => typeof e === "string" && e.startsWith("sensor."))
      .slice(0, 3);
    return {
      title: "Energie",
      entities: picks.length
        ? picks.map((e) => ({ entity: e, max: 5000 }))
        : [{ entity: "", max: 5000 }],
      segments: 40,
      gap: 2,
      height: 28,
      animate: true,
    };
  }

  static async getConfigElement() {
    return document.createElement("fudash-bar-card-editor");
  }

  getCardSize() {
    return 1 + (this._config?.entities?.length || 1);
  }

  // HA-Section-Layout (12-Spalten-Grid). Bar-Card ist bevorzugt breit,
  // funktioniert aber auch ab 3 Spalten.
  getLayoutOptions() {
    const rows = (this._config?.entities?.length || 1) + (this._config?.title ? 1 : 0);
    return {
      grid_columns: 6,
      grid_rows: Math.max(2, rows),
      grid_min_columns: 3,
      grid_min_rows: 1,
    };
  }

  getGridOptions() {
    return this.getLayoutOptions();
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error('FuDash: "entities" muss mindestens einen Eintrag enthalten');
    }
    for (const [i, entry] of config.entities.entries()) {
      if (!entry || typeof entry !== "object" || !entry.entity) {
        throw new Error(`FuDash: entities[${i}].entity fehlt`);
      }
    }
    super.setConfig(config);
  }

  disconnectedCallback() {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
  }

  _render() {
    const c = this._config;
    const title = c.title
      ? `<div class="fudash-title">${FuDash.escapeHtml(c.title)}</div>`
      : "";
    const rows = c.entities
      .map(
        (_, i) => `
      <div class="row" data-idx="${i}" tabindex="0" role="button" aria-label="Verlauf anzeigen">
        <div class="head"><span class="name"></span></div>
        <div class="body">
          <div class="bar" role="meter"></div>
          <span class="value"></span>
        </div>
      </div>`
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${FuDash.sharedStyles}${this._styles()}</style>
      <ha-card>
        ${title}
        <div class="rows">${rows}</div>
      </ha-card>
    `;

    const initialSegs = Math.max(8, Number(c.segments) || 40);
    this.shadowRoot.querySelectorAll(".bar").forEach((bar) => {
      this._fillSegments(bar, initialSegs);
    });

    // Tap/Hold/Double-Tap pro Zeile. Per-Entity-Actions ueberschreiben
    // Karten-Defaults; ohne Config-Block oeffnet ein Klick den
    // More-Info-Dialog des Zeilen-Entity.
    this.shadowRoot.querySelectorAll(".row").forEach((row) => {
      const idx = Number(row.dataset.idx);
      FuDash.bindActions(row, this, () => {
        const entry = this._config.entities[idx] || {};
        return {
          entity: entry.entity,
          tap_action: entry.tap_action || this._config.tap_action,
          hold_action: entry.hold_action || this._config.hold_action,
          double_tap_action:
            entry.double_tap_action || this._config.double_tap_action,
        };
      });
    });

    this._rendered = true;
    this._observeResize();
    this._update();
  }

  _styles() {
    const height = Number(this._config.height) || 28;
    const gap = Number.isFinite(Number(this._config.gap))
      ? Number(this._config.gap)
      : 2;
    const animate = this._config.animate !== false;
    return `
      .rows { display: flex; flex-direction: column; gap: 12px; }
      .row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        cursor: pointer;
        border-radius: 8px;
        padding: 4px 6px;
        margin: -4px -6px;
        transition: background 180ms var(--fudash-ease);
      }
      .row:hover {
        background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      }
      .row:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 1px;
      }
      .head { display: flex; justify-content: space-between; align-items: baseline; }
      .name {
        font-size: 0.9rem;
        color: var(--primary-text-color);
        font-weight: 500;
        letter-spacing: 0.1px;
      }
      .body {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .bar {
        display: flex;
        gap: ${gap}px;
        height: ${height}px;
        align-items: stretch;
        min-width: 0;
      }
      .seg {
        flex: 1 1 0;
        min-width: 2px;
        border-radius: 2px;
        background: var(--fudash-track);
        ${animate ? "transition: background 350ms var(--fudash-ease);" : ""}
      }
      .seg.on {
        background: var(--seg-color, var(--fudash-success));
        box-shadow: 0 0 6px
          color-mix(in srgb, var(--seg-color, var(--fudash-success)) 35%, transparent);
      }
      .value {
        font-size: 1.4rem;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: var(--val-color, var(--primary-text-color));
        white-space: nowrap;
        min-width: 3.5em;
        text-align: right;
        line-height: 1;
      }
      .value .unit {
        font-size: 0.65em;
        color: var(--fudash-muted);
        margin-left: 3px;
        font-weight: 400;
      }
      .row.unavailable .value { color: var(--fudash-muted); }
      .row.unavailable .seg { background: var(--fudash-track); box-shadow: none; }
    `;
  }

  _fillSegments(bar, count) {
    bar.textContent = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const d = document.createElement("div");
      d.className = "seg";
      frag.appendChild(d);
    }
    bar.appendChild(frag);
  }

  _observeResize() {
    if (this._ro) this._ro.disconnect();
    this._ro = new ResizeObserver(() => this._fitSegments());
    this.shadowRoot.querySelectorAll(".bar").forEach((b) => this._ro.observe(b));
  }

  _fitSegments() {
    const desired = Math.max(8, Number(this._config.segments) || 40);
    const gap = Number.isFinite(Number(this._config.gap))
      ? Number(this._config.gap)
      : 2;
    let changed = false;
    this.shadowRoot.querySelectorAll(".bar").forEach((bar) => {
      const width = bar.clientWidth;
      if (!width) return;
      let target = desired;
      const perSeg = (width - gap * (desired - 1)) / desired;
      if (perSeg < 4) {
        target = Math.max(8, Math.floor((width + gap) / (4 + gap)));
      }
      if (bar.children.length !== target) {
        this._fillSegments(bar, target);
        changed = true;
      }
    });
    if (changed) this._update();
  }

  _update() {
    if (!this._rendered || !this._hass) return;
    const rows = this.shadowRoot.querySelectorAll(".row");
    this._config.entities.forEach((entry, i) => {
      const row = rows[i];
      if (!row) return;
      const state = FuDash.getState(this._hass, entry.entity);
      const nameEl = row.querySelector(".name");
      const valEl = row.querySelector(".value");
      const bar = row.querySelector(".bar");

      nameEl.textContent =
        entry.name || state?.attributes?.friendly_name || entry.entity || "—";

      if (FuDash.isUnavailable(state)) {
        row.classList.add("unavailable");
        valEl.textContent = "–";
        bar.setAttribute("aria-valuetext", "nicht verfuegbar");
        bar.querySelectorAll(".seg").forEach((s) => s.classList.remove("on"));
        return;
      }
      row.classList.remove("unavailable");

      const value = FuDash.parseNumber(state.state) ?? 0;
      const min = Number(entry.min) || 0;
      const max = Number(entry.max) || 100;
      const unit =
        entry.unit || state.attributes?.unit_of_measurement || "";
      const pct =
        max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
      const segCount = bar.children.length;
      const activeRaw = pct * segCount;
      const active = Math.round(activeRaw);

      const color = FuDash.resolveColor(
        { ...this._config, ...entry },
        value
      );
      bar.style.setProperty("--seg-color", color);
      valEl.style.setProperty("--val-color", color);

      const segs = bar.children;
      for (let j = 0; j < segs.length; j++) {
        const on = j < active;
        const el = segs[j];
        if (el.classList.contains("on") !== on) {
          el.classList.toggle("on", on);
        }
      }

      bar.setAttribute("aria-valuenow", String(value));
      bar.setAttribute("aria-valuemin", String(min));
      bar.setAttribute("aria-valuemax", String(max));
      bar.setAttribute(
        "aria-valuetext",
        `${FuDash.formatNumber(this._hass, value)}${unit ? " " + unit : ""}`
      );

      valEl.textContent = "";
      const num = document.createElement("span");
      num.textContent = FuDash.formatNumber(this._hass, value);
      valEl.appendChild(num);
      if (unit) {
        const u = document.createElement("span");
        u.className = "unit";
        u.textContent = unit;
        valEl.appendChild(u);
      }
    });
  }
};

// ===== src/bar-card/fudash-bar-card-editor.js =====
// Visueller Editor fuer fudash-bar-card.
// Nutzt HAs vorhandene <ha-form>-Komponente, daher kein Lit noetig.
// Die verschachtelte entities-Liste wird ueber den object-Selector als
// YAML-Block editiert (pragmatisch und robust fuer Phase 1).

FuDash.BarEditor = class FudashBarEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._form = null;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _ensureForm() {
    if (this._form) return;
    this._form = document.createElement("ha-form");
    this._form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...(ev.detail?.value || {}) };
      FuDash.fireEvent(this, "config-changed", { config: this._config });
    });
    this.appendChild(this._form);
  }

  _render() {
    if (!this._hass) return;
    this._ensureForm();
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = this._schema();
    this._form.computeLabel = (s) =>
      ({
        title: "Titel",
        segments: "Segmente",
        gap: "Abstand zwischen Segmenten (px)",
        height: "Balkenhoehe (px)",
        animate: "Animation beim Aenderungswert",
        value_color: "Standardfarbe (alle Balken)",
        entities: "Entities (YAML-Liste)",
        ...FuDash.ACTION_LABELS,
      }[s.name] || s.name);
    this._form.computeHelper = (s) =>
      ({
        entities:
          "Jeder Eintrag: entity (Pflicht), name, max, warn, crit, color.",
        value_color:
          "Wird verwendet, wenn ein Entity-Eintrag keine eigene 'color'-Option hat.",
      }[s.name]);
  }

  _schema() {
    return [
      { name: "title", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: "segments",
            default: 40,
            selector: { number: { min: 8, max: 80, step: 1, mode: "slider" } },
          },
          {
            name: "gap",
            default: 2,
            selector: { number: { min: 0, max: 8, step: 1, mode: "slider" } },
          },
          {
            name: "height",
            default: 28,
            selector: { number: { min: 12, max: 64, step: 1, mode: "slider" } },
          },
          { name: "animate", default: true, selector: { boolean: {} } },
        ],
      },
      {
        name: "value_color",
        default: "auto",
        selector: {
          select: {
            mode: "dropdown",
            options: FuDash.COLOR_OPTIONS,
          },
        },
      },
      { name: "entities", selector: { object: {} } },
      FuDash.ACTIONS_SCHEMA,
    ];
  }
};

// ===== src/gauge-card/fudash-gauge-card.js =====
// fudash-gauge-card
// Moderne Radial-Gauge als 3/4-Kreis im Material-3-Stil.

FuDash.GaugeCard = class FudashGaugeCard extends FuDash.BaseCard {
  static getStubConfig(hass, entities) {
    const pick = (entities || []).find(
      (e) => typeof e === "string" && e.startsWith("sensor.")
    );
    return {
      entity: pick || "",
      name: "",
      min: 0,
      max: 100,
      needle: false,
      size: 180,
      segments: 36,
      segment_gap: 1.5,
      show_numbers: true,
      show_range: true,
    };
  }

  static async getConfigElement() {
    return document.createElement("fudash-gauge-card-editor");
  }

  getCardSize() {
    return 3;
  }

  // HA-Section-Layout (12-Spalten-Grid). Gauge darf schmal werden.
  getLayoutOptions() {
    return {
      grid_columns: 3,
      grid_rows: 3,
      grid_min_columns: 2,
      grid_min_rows: 2,
    };
  }

  getGridOptions() {
    return this.getLayoutOptions();
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('FuDash: Feld "entity" ist erforderlich');
    }
    super.setConfig(config);
  }

  _render() {
    const c = this._config;
    const size = Math.max(100, Number(c.size) || 180);

    // 3/4-Kreis: 270 Grad offen nach unten, Start 225 Grad, Ende 135 Grad (+360).
    const sweep = 270;
    const startAngle = 225;
    const stroke = Math.max(8, Math.round(size * 0.08));
    const r = (size - stroke) / 2;
    const cx = size / 2;
    const cy = size / 2;

    // Segmentanzahl: per Config, aber passend zum Umfang gedeckelt.
    // NaN-sichere Parsung (Number() kann NaN zurueckgeben, || faengt das
    // zwar fuer segments ab, fuer segment_gap nutzen wir isFinite).
    const segmentsRaw = Number(c.segments);
    const configured = Number.isFinite(segmentsRaw) && segmentsRaw > 0
      ? Math.max(6, Math.min(120, segmentsRaw))
      : 36;
    const arcLen = (Math.PI * r * sweep) / 180;
    const maxBySize = Math.max(6, Math.floor(arcLen / 6));
    const segCount = Math.min(configured, maxBySize);
    const gapRaw = Number(c.segment_gap);
    const gapDeg = Number.isFinite(gapRaw)
      ? Math.max(0, Math.min(8, gapRaw))
      : 1.5;
    const segSweep = (sweep - gapDeg * (segCount - 1)) / segCount;
    const segPaths = [];
    for (let i = 0; i < segCount; i++) {
      const a0 = startAngle + i * (segSweep + gapDeg);
      const a1 = a0 + segSweep;
      const p0 = this._polar(cx, cy, r, a0);
      const p1 = this._polar(cx, cy, r, a1);
      const large = segSweep > 180 ? 1 : 0;
      segPaths.push(`M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`);
    }

    const showNumbers = c.show_numbers !== false;
    const showRange = c.show_range !== false;

    // Dreieck-Marker knapp ausserhalb des Arcs, nach innen zeigend.
    const triOuter = r + stroke * 0.55 + 3;
    const triInner = triOuter - stroke * 0.95;
    const triHalfBase = stroke * 0.55;
    const triPath =
      `M ${cx - triHalfBase} ${cy - triOuter} ` +
      `L ${cx + triHalfBase} ${cy - triOuter} ` +
      `L ${cx} ${cy - triInner} Z`;

    // Min/Max-Beschriftung an den Arc-Endpunkten: geometrisch leicht
    // nach aussen versetzt, damit die Zahlen dicht am jeweiligen
    // Balkenende sitzen und mitskalieren.
    const showMinMax =
      showRange &&
      (Number.isFinite(Number(c.min)) || Number.isFinite(Number(c.max)));
    const rangeOutset = stroke * 0.9 + 8;
    const pMin = this._polar(cx, cy, r + rangeOutset, startAngle);
    const pMax = this._polar(cx, cy, r + rangeOutset, startAngle + sweep);
    const rangeSvg = showMinMax
      ? `<text class="range-label" x="${pMin.x.toFixed(
          1
        )}" y="${pMin.y.toFixed(
          1
        )}" text-anchor="middle" dominant-baseline="hanging">${FuDash.formatNumber(
          null,
          Number(c.min) || 0
        )}</text>` +
        `<text class="range-label" x="${pMax.x.toFixed(
          1
        )}" y="${pMax.y.toFixed(
          1
        )}" text-anchor="middle" dominant-baseline="hanging">${FuDash.formatNumber(
          null,
          Number(c.max) || 100
        )}</text>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>${FuDash.sharedStyles}${this._styles(size, stroke)}</style>
      <ha-card tabindex="0" role="button" aria-label="Verlauf anzeigen">
        <div class="wrap">
          <div class="name"></div>
          <div class="gauge">
            <svg viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet" role="meter">
              ${segPaths
                .map(
                  (d, i) =>
                    // stroke-linecap "butt" ist wichtig: "round" wuerde die
                    // Caps so weit ueber die Arc-Endpunkte verlaengern,
                    // dass die Segmentluecken bei duennen Spalten komplett
                    // verschluckt werden.
                    `<path class="seg" data-i="${i}" d="${d}" stroke-width="${stroke}" fill="none" stroke-linecap="butt"></path>`
                )
                .join("")}
              ${c.needle ? `<path class="marker" d="${triPath}"></path>` : ""}
              ${rangeSvg}
            </svg>
            ${showNumbers ? `<div class="label"><div class="value"></div><div class="unit"></div></div>` : ""}
          </div>
        </div>
      </ha-card>
    `;

    this._geom = { startAngle, sweep, cx, cy, r, segCount };
    this._rendered = true;

    const card = this.shadowRoot.querySelector("ha-card");
    FuDash.bindActions(card, this, () => ({
      entity: this._config.entity,
      tap_action: this._config.tap_action,
      hold_action: this._config.hold_action,
      double_tap_action: this._config.double_tap_action,
    }));

    this._update();
  }

  _styles(size, stroke) {
    // Schriftgroessen skalieren ueber Container-Queries (cqi = 1 % der
    // Container-Inline-Groesse).
    const valueCqi = 20;
    const unitCqi = 9;
    return `
      ha-card {
        cursor: pointer;
        transition: transform 200ms var(--fudash-ease),
                    box-shadow 200ms var(--fudash-ease);
      }
      ha-card:hover { transform: translateY(-1px); }
      ha-card:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
      .wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; }
      .name {
        font-size: 0.95rem;
        color: var(--primary-text-color);
        font-weight: 500;
        letter-spacing: 0.1px;
      }
      .gauge {
        position: relative;
        width: 100%;
        max-width: ${size}px;
        aspect-ratio: 1 / 1;
        container-type: inline-size;
      }
      svg { display: block; width: 100%; height: 100%; overflow: visible; }
      .seg {
        stroke: var(--fudash-track);
        transition: stroke 350ms var(--fudash-ease), opacity 200ms;
      }
      .seg.on {
        stroke: var(--gauge-color, var(--fudash-success));
      }
      .marker {
        fill: var(--gauge-color, var(--fudash-success));
        stroke: none;
        transform-origin: ${size / 2}px ${size / 2}px;
        transition: transform 600ms var(--fudash-ease),
                    fill 400ms var(--fudash-ease);
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
      }
      .label {
        position: absolute;
        left: 0; right: 0;
        top: 50%;
        transform: translateY(-50%);
        text-align: center;
        pointer-events: none;
        padding: 0 6%;
      }
      .label .value {
        font-size: ${valueCqi}cqi;
        font-weight: 500;
        color: var(--gauge-color, var(--primary-text-color));
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
        transition: color 400ms var(--fudash-ease);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .label .unit {
        font-size: ${unitCqi}cqi;
        color: var(--fudash-muted);
        margin-top: 2px;
        white-space: nowrap;
      }
      .range-label {
        fill: var(--fudash-muted);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
      }
      .unavailable .value { color: var(--fudash-muted); }
      .unavailable .seg { stroke: var(--fudash-track); }
      .unavailable .marker { fill: var(--fudash-track); }
      .unavailable .range-label { fill: var(--fudash-track); }
    `;
  }

  _polar(cx, cy, r, angleDeg) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  _update() {
    if (!this._rendered || !this._hass) return;
    const c = this._config;
    const state = FuDash.getState(this._hass, c.entity);
    const sr = this.shadowRoot;
    const wrap = sr.querySelector(".wrap");
    const nameEl = sr.querySelector(".name");
    const valueEl = sr.querySelector(".value");
    const unitEl = sr.querySelector(".unit");
    const segs = sr.querySelectorAll(".seg");
    const marker = sr.querySelector(".marker");

    nameEl.textContent =
      c.name || state?.attributes?.friendly_name || c.entity || "—";

    const svg = sr.querySelector("svg");
    if (FuDash.isUnavailable(state)) {
      wrap.classList.add("unavailable");
      if (valueEl) valueEl.textContent = "–";
      if (unitEl) unitEl.textContent = "";
      segs.forEach((el) => el.classList.remove("on"));
      if (svg) svg.setAttribute("aria-valuetext", "nicht verfuegbar");
      if (marker) marker.style.transform = `rotate(${this._geom.startAngle}deg)`;
      return;
    }
    wrap.classList.remove("unavailable");

    const value = FuDash.parseNumber(state.state) ?? 0;
    const min = Number(c.min) || 0;
    const max = Number.isFinite(Number(c.max)) ? Number(c.max) : 100;
    const unit = c.unit || state.attributes?.unit_of_measurement || "";
    const pct = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    const color = FuDash.resolveColor(c, value);

    this.style.setProperty("--gauge-color", color);

    if (valueEl) valueEl.textContent = FuDash.formatNumber(this._hass, value);
    if (unitEl) unitEl.textContent = unit;

    // Aktive Segmente kontinuierlich: Bruchteil wird per Opazitaet
    // des "letzten" Segments sanft gemischt, damit Anstieg nicht hart wirkt.
    const activeRaw = pct * this._geom.segCount;
    const fullActive = Math.floor(activeRaw);
    const partial = activeRaw - fullActive;
    segs.forEach((el, i) => {
      const on = i < fullActive;
      el.classList.toggle("on", on || (i === fullActive && partial > 0));
      if (i === fullActive && partial > 0) {
        el.style.opacity = String(0.25 + partial * 0.75);
      } else {
        el.style.opacity = "";
      }
    });
    if (svg) {
      svg.setAttribute("aria-valuenow", String(value));
      svg.setAttribute("aria-valuemin", String(min));
      svg.setAttribute("aria-valuemax", String(max));
      svg.setAttribute(
        "aria-valuetext",
        `${FuDash.formatNumber(this._hass, value)}${unit ? " " + unit : ""}`
      );
    }

    if (marker) {
      // Dreieck wird bei angle=0 (oben) gezeichnet. Um es an den Arc-Anfang
      // zu setzen, rotieren wir um startAngle; pct fuegt die Positions-
      // Drehung hinzu - Marker sitzt dadurch exakt auf der Arc-Spitze.
      const rot = this._geom.startAngle + this._geom.sweep * pct;
      marker.style.transform = `rotate(${rot}deg)`;
    }
  }
};

// ===== src/gauge-card/fudash-gauge-card-editor.js =====
// Visueller Editor fuer fudash-gauge-card.

FuDash.GaugeEditor = class FudashGaugeEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._form = null;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _ensureForm() {
    if (this._form) return;
    this._form = document.createElement("ha-form");
    this._form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...(ev.detail?.value || {}) };
      FuDash.fireEvent(this, "config-changed", { config: this._config });
    });
    this.appendChild(this._form);
  }

  _render() {
    if (!this._hass) return;
    this._ensureForm();
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = this._schema();
    this._form.computeLabel = (s) =>
      ({
        entity: "Entity",
        name: "Anzeigename",
        min: "Min",
        max: "Max",
        warn: "Warn-Schwelle (gelb)",
        crit: "Krit-Schwelle (rot)",
        needle: "Marker anzeigen",
        size: "Groesse (px)",
        show_numbers: "Wert in der Mitte anzeigen",
        show_range: "Min/Max unter dem Gauge anzeigen",
        segments: "Segmentanzahl",
        segment_gap: "Segmentluecke (Grad)",
        color: "Farbe",
        unit: "Einheit (ueberschreibt Entity-Einheit)",
        ...FuDash.ACTION_LABELS,
      }[s.name] || s.name);
  }

  _schema() {
    return [
      {
        name: "entity",
        selector: {
          entity: {
            domain: ["sensor", "input_number", "number", "counter"],
          },
        },
      },
      { name: "name", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "min", default: 0, selector: { number: { mode: "box" } } },
          { name: "max", default: 100, selector: { number: { mode: "box" } } },
        ],
      },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "warn", selector: { number: { mode: "box" } } },
          { name: "crit", selector: { number: { mode: "box" } } },
        ],
      },
      {
        name: "color",
        default: "auto",
        selector: {
          select: {
            mode: "dropdown",
            options: FuDash.COLOR_OPTIONS,
          },
        },
      },
      { name: "needle", default: false, selector: { boolean: {} } },
      { name: "show_numbers", default: true, selector: { boolean: {} } },
      { name: "show_range", default: true, selector: { boolean: {} } },
      {
        name: "size",
        default: 180,
        selector: { number: { min: 100, max: 400, step: 10, mode: "slider" } },
      },
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: "segments",
            default: 36,
            selector: { number: { min: 6, max: 120, step: 1, mode: "slider" } },
          },
          {
            name: "segment_gap",
            default: 1.5,
            selector: { number: { min: 0, max: 8, step: 0.5, mode: "slider" } },
          },
        ],
      },
      { name: "unit", selector: { text: {} } },
      FuDash.ACTIONS_SCHEMA,
    ];
  }
};

// ===== src/donut-card/fudash-donut-card.js =====
// fudash-donut-card
// Ring-/Donut-Diagramm fuer Anteile (z.B. Stromverteilung, Raumtemperaturen).
// - Jede Entity ist ein Slice; Groesse = aktueller Wert (nur positive Werte).
// - Innenradius konfigurierbar (0 = Pie, 65% = Donut).
// - Center-Label zeigt wahlweise Summe, fixen Text oder einen Entity-Wert.
// - Klick auf Slice oder Legenden-Eintrag oeffnet More-Info.

FuDash.DonutCard = class FudashDonutCard extends FuDash.BaseCard {
  static getStubConfig(hass, entities) {
    const picks = (entities || [])
      .filter((e) => typeof e === "string" && e.startsWith("sensor."))
      .slice(0, 3);
    return {
      title: "Verteilung",
      size: 200,
      inner_radius: 65,
      segments: 60,
      segment_gap: 2,
      show_total: true,
      show_legend: true,
      show_percent: true,
      entities: picks.length
        ? picks.map((e, i) => ({
            entity: e,
            color: ["indigo", "amber", "teal", "red", "green"][i] || "primary",
          }))
        : [{ entity: "", color: "primary" }],
    };
  }

  static async getConfigElement() {
    return document.createElement("fudash-donut-card-editor");
  }

  getCardSize() {
    const rows = Math.ceil((Number(this._config?.size) || 200) / 50);
    return rows + (this._config?.show_legend !== false ? 1 : 0);
  }

  getLayoutOptions() {
    const size = Number(this._config?.size) || 200;
    return {
      grid_columns: 6,
      grid_rows: Math.ceil(size / 56) + (this._config?.show_legend !== false ? 2 : 1),
      grid_min_columns: 3,
      grid_min_rows: 3,
    };
  }

  getGridOptions() {
    return this.getLayoutOptions();
  }

  setConfig(config) {
    if (
      !config ||
      !Array.isArray(config.entities) ||
      config.entities.length === 0
    ) {
      throw new Error('FuDash: "entities" muss mindestens einen Eintrag enthalten');
    }
    for (const [i, entry] of config.entities.entries()) {
      if (!entry || typeof entry !== "object" || !entry.entity) {
        throw new Error(`FuDash: entities[${i}].entity fehlt`);
      }
    }
    super.setConfig(config);
  }

  disconnectedCallback() {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
  }

  _render() {
    const c = this._config;
    const showLegend = c.show_legend !== false;
    this.shadowRoot.innerHTML = `
      <style>${FuDash.sharedStyles}${this._styles()}</style>
      <ha-card>
        ${c.title ? `<div class="fudash-title">${FuDash.escapeHtml(c.title)}</div>` : ""}
        <div class="wrap">
          <div class="donut-wrap">
            <svg class="donut" preserveAspectRatio="xMidYMid meet" aria-label="Anteile"></svg>
            <div class="center">
              <div class="center-value"></div>
              <div class="center-label"></div>
            </div>
          </div>
          ${showLegend ? `<div class="legend"></div>` : ""}
        </div>
      </ha-card>`;
    this._rendered = true;

    this._ro = new ResizeObserver(() => this._draw());
    this._ro.observe(this.shadowRoot.querySelector(".donut-wrap"));
    this._renderLegend();
    this._draw();
  }

  _update() {
    this._updateLegendValues();
    this._draw();
  }

  _styles() {
    const size = Math.max(100, Number(this._config.size) || 200);
    return `
      .wrap {
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
      }
      .donut-wrap {
        position: relative;
        width: ${size}px;
        max-width: 100%;
        aspect-ratio: 1 / 1;
      }
      svg.donut {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }
      .seg {
        transition: fill 350ms var(--fudash-ease), opacity 200ms;
      }
      .seg.off { fill: var(--fudash-track); }
      .seg.on { cursor: pointer; }
      .seg.on:hover { opacity: 0.85; }
      .seg.on:focus-visible { outline: none; }
      .center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: none;
        padding: 0 12%;
        text-align: center;
      }
      .center-value {
        font-size: clamp(1.1rem, 18cqw, 1.8rem);
        font-weight: 600;
        color: var(--primary-text-color);
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
      }
      .center-label {
        font-size: clamp(0.7rem, 9cqw, 0.85rem);
        color: var(--fudash-muted);
        margin-top: 2px;
      }
      .donut-wrap { container-type: inline-size; }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        justify-content: center;
        width: 100%;
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 6px;
        transition: background 180ms var(--fudash-ease);
        font-size: 0.85rem;
        color: var(--primary-text-color);
      }
      .legend-item:hover {
        background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      }
      .legend-item:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 1px;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .legend-name { font-weight: 500; }
      .legend-val, .legend-pct {
        color: var(--fudash-muted);
        font-variant-numeric: tabular-nums;
      }
    `;
  }

  _renderLegend() {
    const c = this._config;
    const leg = this.shadowRoot.querySelector(".legend");
    if (!leg) return;
    leg.innerHTML = c.entities
      .map((e, i) => {
        const color =
          FuDash.COLOR_PRESETS[e.color] || e.color || "var(--primary-color)";
        return `
          <div class="legend-item" data-idx="${i}" tabindex="0" role="button" aria-label="Verlauf anzeigen">
            <span class="legend-dot" style="background:${color}"></span>
            <span class="legend-name"></span>
            <span class="legend-val"></span>
            <span class="legend-pct"></span>
          </div>`;
      })
      .join("");
    this.shadowRoot.querySelectorAll(".legend-item").forEach((el) => {
      const idx = Number(el.dataset.idx);
      FuDash.bindActions(el, this, () => {
        const entry = this._config.entities[idx] || {};
        return {
          entity: entry.entity,
          tap_action: entry.tap_action || this._config.tap_action,
          hold_action: entry.hold_action || this._config.hold_action,
          double_tap_action:
            entry.double_tap_action || this._config.double_tap_action,
        };
      });
    });
    this._updateLegendValues();
  }

  // Liest Rohwerte aus hass; liefert zusaetzlich Summe zur %-Berechnung.
  _collectValues() {
    const c = this._config;
    const raw = c.entities.map((e) => {
      const st = FuDash.getState(this._hass, e.entity);
      if (FuDash.isUnavailable(st)) return { v: 0, state: st, entry: e };
      const v = FuDash.parseNumber(st.state);
      // Nur positive Werte werden als Anteil geplottet.
      return { v: Number.isFinite(v) && v > 0 ? v : 0, state: st, entry: e };
    });
    const total = raw.reduce((a, b) => a + b.v, 0);
    return { raw, total };
  }

  _updateLegendValues() {
    if (!this._rendered || !this._hass) return;
    if (this._config.show_legend === false) return;
    const { raw, total } = this._collectValues();
    const showPct = this._config.show_percent !== false;
    const items = this.shadowRoot.querySelectorAll(".legend-item");
    raw.forEach(({ v, state, entry }, i) => {
      const el = items[i];
      if (!el) return;
      const name = entry.name || state?.attributes?.friendly_name || entry.entity;
      const unit = entry.unit || state?.attributes?.unit_of_measurement || "";
      el.querySelector(".legend-name").textContent = `${name}:`;
      const valEl = el.querySelector(".legend-val");
      const pctEl = el.querySelector(".legend-pct");
      if (FuDash.isUnavailable(state)) {
        valEl.textContent = "–";
        pctEl.textContent = "";
      } else {
        valEl.textContent = `${FuDash.formatNumber(this._hass, v)}${unit ? " " + unit : ""}`;
        pctEl.textContent =
          showPct && total > 0
            ? `(${FuDash.formatNumber(this._hass, (v / total) * 100, {
                maximumFractionDigits: 0,
              })}\u202F%)`
            : "";
      }
    });
  }

  _draw() {
    if (!this._rendered || !this._hass) return;
    const svg = this.shadowRoot.querySelector("svg.donut");
    const wrap = this.shadowRoot.querySelector(".donut-wrap");
    const w = wrap.clientWidth;
    if (w < 20) return;

    const size = w;
    const cx = size / 2;
    const cy = size / 2;
    const padding = 2;
    const rOuter = size / 2 - padding;
    const innerPct = Math.max(0, Math.min(92, Number(this._config.inner_radius) || 65));
    const rInner = (rOuter * innerPct) / 100;

    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

    const { raw, total } = this._collectValues();
    const c = this._config;

    // Segmentanzahl skaliert automatisch mit dem Durchmesser, damit die
    // Balken bei grossen und kleinen Karten gleich gut lesbar bleiben.
    // NaN-sichere Parsung (fehlt das Feld in der Config, greift Default).
    const segmentsRaw = Number(c.segments);
    const configured = Number.isFinite(segmentsRaw) && segmentsRaw > 0
      ? Math.max(12, Math.min(240, segmentsRaw))
      : 60;
    const perimeter = 2 * Math.PI * ((rOuter + rInner) / 2);
    const maxByPerimeter = Math.max(12, Math.floor(perimeter / 6));
    const segments = Math.min(configured, maxByPerimeter);
    const gapRaw = Number(c.segment_gap);
    const gapDeg = Number.isFinite(gapRaw)
      ? Math.max(0, Math.min(10, gapRaw))
      : 2;
    const gapRad = (gapDeg * Math.PI) / 180;
    const segAngle = (Math.PI * 2) / segments;
    const startOffset = -Math.PI / 2;

    // Slice-Winkelbereiche (auf den gleichen Start-Offset bezogen, damit
    // Segmentzuordnung per Winkelvergleich funktioniert).
    const sliceRanges = [];
    if (total > 0) {
      let angle = 0;
      raw.forEach(({ v, entry }, i) => {
        if (v <= 0) return;
        const slice = (v / total) * Math.PI * 2;
        const color =
          FuDash.COLOR_PRESETS[entry.color] || entry.color || "var(--primary-color)";
        sliceRanges.push({ start: angle, end: angle + slice, idx: i, color });
        angle += slice;
      });
    }

    const parts = [];
    for (let k = 0; k < segments; k++) {
      const a0 = startOffset + k * segAngle + gapRad / 2;
      const a1 = startOffset + (k + 1) * segAngle - gapRad / 2;
      if (a1 <= a0) continue;
      const d = FuDash._donutSlicePath(cx, cy, rOuter, rInner, a0, a1);
      const midRel = (k + 0.5) * segAngle; // 0..2π relativ
      const hit = sliceRanges.find((r) => midRel >= r.start && midRel < r.end);
      if (hit) {
        parts.push(
          `<path class="seg on" data-idx="${hit.idx}" d="${d}" fill="${hit.color}" tabindex="0" role="button"><title></title></path>`
        );
      } else {
        parts.push(`<path class="seg off" d="${d}"/>`);
      }
    }
    svg.innerHTML = parts.join("");

    svg.querySelectorAll(".seg.on").forEach((el) => {
      const idx = Number(el.dataset.idx);
      const entry = c.entities[idx];
      if (!entry) return;
      const state = FuDash.getState(this._hass, entry.entity);
      const name = entry.name || state?.attributes?.friendly_name || entry.entity;
      const titleEl = el.querySelector("title");
      if (titleEl) titleEl.textContent = name;
      el.setAttribute("aria-label", `${name} - Verlauf anzeigen`);
      FuDash.bindActions(el, this, () => {
        const eCfg = this._config.entities[idx] || {};
        return {
          entity: eCfg.entity,
          tap_action: eCfg.tap_action || this._config.tap_action,
          hold_action: eCfg.hold_action || this._config.hold_action,
          double_tap_action:
            eCfg.double_tap_action || this._config.double_tap_action,
        };
      });
    });

    if (total <= 0) {
      this._renderCenterEmpty();
    } else {
      this._renderCenter(total, raw);
    }
  }

  _renderCenter(total, raw) {
    const c = this._config;
    const valEl = this.shadowRoot.querySelector(".center-value");
    const labEl = this.shadowRoot.querySelector(".center-label");
    if (!valEl || !labEl) return;

    // center: "total" (Default) | "none" | Entity-ID
    const mode = c.center || (c.show_total === false ? "none" : "total");
    if (mode === "none") {
      valEl.textContent = "";
      labEl.textContent = "";
      return;
    }
    if (mode === "total") {
      const unit = this._commonUnit(raw);
      valEl.textContent = `${FuDash.formatNumber(this._hass, total)}${unit ? " " + unit : ""}`;
      labEl.textContent = c.center_label || "Gesamt";
      return;
    }
    // Entity-spezifischer Center-Wert
    const st = FuDash.getState(this._hass, mode);
    if (FuDash.isUnavailable(st)) {
      valEl.textContent = "–";
      labEl.textContent = c.center_label || "";
      return;
    }
    const v = FuDash.parseNumber(st.state);
    const unit = st.attributes?.unit_of_measurement || "";
    valEl.textContent =
      v == null
        ? st.state
        : `${FuDash.formatNumber(this._hass, v)}${unit ? " " + unit : ""}`;
    labEl.textContent =
      c.center_label || st.attributes?.friendly_name || mode;
  }

  _renderCenterEmpty() {
    const valEl = this.shadowRoot.querySelector(".center-value");
    const labEl = this.shadowRoot.querySelector(".center-label");
    if (valEl) valEl.textContent = "–";
    if (labEl) labEl.textContent = this._config.center_label || "keine Daten";
  }

  // Liefert Einheit zurueck, wenn alle Entities dieselbe haben.
  _commonUnit(raw) {
    const units = new Set(
      raw
        .map(({ entry, state }) => entry.unit || state?.attributes?.unit_of_measurement)
        .filter(Boolean)
    );
    return units.size === 1 ? [...units][0] : "";
  }
};

// SVG-Pfad fuer ein Donut-Slice. Winkel in Radiant, 0 = 3-Uhr-Position
// (SVG-Standard). _draw() nutzt -PI/2 als Startoffset, damit optisch oben
// begonnen wird.
FuDash._donutSlicePath = (cx, cy, rO, rI, a0, a1) => {
  const x1o = cx + rO * Math.cos(a0);
  const y1o = cy + rO * Math.sin(a0);
  const x2o = cx + rO * Math.cos(a1);
  const y2o = cy + rO * Math.sin(a1);
  const x1i = cx + rI * Math.cos(a0);
  const y1i = cy + rI * Math.sin(a0);
  const x2i = cx + rI * Math.cos(a1);
  const y2i = cy + rI * Math.sin(a1);
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  if (rI <= 0.01) {
    return (
      `M ${cx} ${cy} L ${x1o} ${y1o}` +
      ` A ${rO} ${rO} 0 ${largeArc} 1 ${x2o} ${y2o} Z`
    );
  }
  return (
    `M ${x1o} ${y1o}` +
    ` A ${rO} ${rO} 0 ${largeArc} 1 ${x2o} ${y2o}` +
    ` L ${x2i} ${y2i}` +
    ` A ${rI} ${rI} 0 ${largeArc} 0 ${x1i} ${y1i} Z`
  );
};

// ===== src/donut-card/fudash-donut-card-editor.js =====
// Visueller Editor fuer die Donut-Card.
// Struktur analog zum Chart-Editor: globale Optionen via ha-form,
// Entities als YAML-Liste (kleine Liste, daher noch kein Listen-UI).

FuDash.DonutEditor = class FudashDonutCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._form = null;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _ensureForm() {
    if (this._form) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-form { display: block; }
      </style>
    `;
    const form = document.createElement("ha-form");
    form.addEventListener("value-changed", (ev) => {
      const next = { ...this._config, ...ev.detail.value };
      this._config = next;
      FuDash.fireEvent(this, "config-changed", { config: next });
    });
    this._form = form;
    this.shadowRoot.appendChild(form);
  }

  _render() {
    this._ensureForm();
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = this._schema();
    this._form.computeLabel = (s) =>
      ({
        title: "Titel",
        size: "Groesse (px)",
        inner_radius: "Innenradius (%)  (0 = Pie)",
        segments: "Segmentanzahl",
        segment_gap: "Segmentluecke (Grad)",
        show_total: "Summe in der Mitte anzeigen",
        center: "Center-Entity (optional, statt Summe)",
        center_label: "Center-Untertitel",
        show_legend: "Legende anzeigen",
        show_percent: "Prozente in der Legende",
        entities: "Entities (YAML-Liste)",
        ...FuDash.ACTION_LABELS,
      }[s.name] || s.name);
    this._form.computeHelper = (s) =>
      ({
        inner_radius:
          "0 = Pie-Chart, 65 = klassischer Donut, >80 = duenner Ring.",
        center:
          "Leer lassen fuer Summe. Optional Entity-ID, deren Wert gross in der Mitte steht.",
        entities:
          "Jeder Eintrag: entity (Pflicht), name, color, unit.",
      }[s.name]);
  }

  _schema() {
    return [
      { name: "title", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: "size",
            default: 200,
            selector: { number: { min: 100, max: 500, step: 10, mode: "slider" } },
          },
          {
            name: "inner_radius",
            default: 65,
            selector: { number: { min: 0, max: 92, step: 1, mode: "slider" } },
          },
          {
            name: "segments",
            default: 60,
            selector: { number: { min: 12, max: 240, step: 1, mode: "slider" } },
          },
          {
            name: "segment_gap",
            default: 2,
            selector: { number: { min: 0, max: 10, step: 0.5, mode: "slider" } },
          },
          { name: "show_total", default: true, selector: { boolean: {} } },
          { name: "show_legend", default: true, selector: { boolean: {} } },
          { name: "show_percent", default: true, selector: { boolean: {} } },
        ],
      },
      {
        name: "center",
        selector: { entity: { filter: { domain: ["sensor", "input_number", "number"] } } },
      },
      { name: "center_label", selector: { text: {} } },
      { name: "entities", selector: { object: {} } },
      FuDash.ACTIONS_SCHEMA,
    ];
  }
};

// ===== src/stat-card/fudash-stat-card.js =====
// fudash-stat-card
// Grosse Einzelzahl fuer einen Sensor mit optionaler Trend-Sparkline
// und Delta-Anzeige gegenueber dem Wert vor 'hours' Stunden.
//
// Typische Verwendung:
//   - Uebersichtskacheln ("Aktuelle PV-Leistung", "Raumtemperatur")
//   - KPI-Reihen oben in Dashboards, mehrere Stat-Cards nebeneinander
//
// Wiederverwendete Helfer:
//   FuDash.fetchSeries  (History/Statistics)
//   FuDash._monotonePath (Sparkline, shared/sparkline.js)

FuDash.StatCard = class FudashStatCard extends FuDash.BaseCard {
  static getStubConfig(hass, entities) {
    const pick = (entities || []).find(
      (e) => typeof e === "string" && e.startsWith("sensor.")
    );
    return {
      entity: pick || "",
      name: "",
      hours: 24,
      show_trend: true,
      show_delta: true,
      show_stats: true,
      chart_type: "bar",
      show_type_toggle: true,
      bar_width: 3,
      bar_gap: 1,
      color: "primary",
    };
  }

  static async getConfigElement() {
    return document.createElement("fudash-stat-card-editor");
  }

  getCardSize() {
    return this._config?.show_trend === false ? 1 : 2;
  }

  getLayoutOptions() {
    return {
      grid_columns: 3,
      grid_rows: this._config?.show_trend === false ? 1 : 2,
      grid_min_columns: 2,
      grid_min_rows: 1,
    };
  }

  getGridOptions() {
    return this.getLayoutOptions();
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('FuDash: "entity" ist Pflicht');
    }
    // Toggle-Zustand ueber Config-Reloads halten (siehe Chart-Card).
    // Muss VOR super.setConfig gesetzt werden, weil super._render triggert.
    const nextConfigType = this._resolveChartType(config);
    if (this._chartType == null || this._configChartType !== nextConfigType) {
      this._chartType = nextConfigType;
    }
    this._configChartType = nextConfigType;

    super.setConfig(config);
    this._seriesData = null;
    this._lastFetchKey = null;
    this._startRefreshTimer();
  }

  _resolveChartType(config) {
    // Default: Balken (passt zum restlichen Segment-Design von FuDash).
    const t = String(config?.chart_type || "bar").toLowerCase();
    return t === "line" ? "line" : "bar";
  }

  connectedCallback() {
    super.connectedCallback();
    this._startRefreshTimer();
  }

  disconnectedCallback() {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  _startRefreshTimer() {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    if (!this._config) return;
    // Nur laden, wenn Trend oder Delta gebraucht werden.
    if (
      this._config.show_trend === false &&
      this._config.show_delta === false &&
      this._config.show_stats === false
    ) {
      return;
    }
    const sec = Math.max(30, Number(this._config.refresh_interval) || 120);
    this._refreshTimer = setInterval(() => {
      this._lastFetchKey = null;
      this._fetchAndDraw();
    }, sec * 1000);
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!this._rendered) {
      this._render();
      this._fetchAndDraw();
    } else {
      this._updateLive();
      if (first) this._fetchAndDraw();
    }
  }

  get hass() {
    return this._hass;
  }

  _render() {
    const c = this._config;
    const showTrend = c.show_trend !== false;
    const showDelta = c.show_delta !== false;
    const showStats = c.show_stats !== false;
    const showToggle = showTrend && c.show_type_toggle !== false;
    this.shadowRoot.innerHTML = `
      <style>${FuDash.sharedStyles}${this._styles()}</style>
      <ha-card tabindex="0" role="button" aria-label="Verlauf anzeigen">
        <div class="top">
          <span class="name"></span>
          <span class="top-right">
            ${showDelta ? `<span class="delta" hidden></span>` : ""}
            ${
              showToggle
                ? `<div class="type-toggle" role="group" aria-label="Darstellung">
                     <button type="button" class="tgl" data-type="line" title="Linie">
                       <svg viewBox="0 0 24 16" aria-hidden="true"><path d="M1 13 L6 8 L11 11 L16 4 L23 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                     </button>
                     <button type="button" class="tgl" data-type="bar" title="Balken">
                       <svg viewBox="0 0 24 16" aria-hidden="true"><rect x="2" y="8" width="3" height="6" rx="1"/><rect x="7" y="5" width="3" height="9" rx="1"/><rect x="12" y="9" width="3" height="5" rx="1"/><rect x="17" y="3" width="3" height="11" rx="1"/></svg>
                     </button>
                   </div>`
                : ""
            }
          </span>
        </div>
        <div class="main">
          <span class="value"></span><span class="unit"></span>
        </div>
        ${showTrend ? `<svg class="spark" preserveAspectRatio="none"></svg>` : ""}
        ${
          showStats
            ? `<div class="stats" hidden>
                 <div class="stat" data-kind="min"><span class="stat-label">Min</span><span class="stat-value"></span></div>
                 <div class="stat" data-kind="avg"><span class="stat-label">\u00D8</span><span class="stat-value"></span></div>
                 <div class="stat" data-kind="max"><span class="stat-label">Max</span><span class="stat-value"></span></div>
               </div>`
            : ""
        }
      </ha-card>
    `;
    this._rendered = true;

    const card = this.shadowRoot.querySelector("ha-card");
    // Klicks auf den Sparkline-Toggle nicht als Karten-Tap werten.
    FuDash.bindActions(
      card,
      this,
      () => ({
        entity: this._config.entity,
        tap_action: this._config.tap_action,
        hold_action: this._config.hold_action,
        double_tap_action: this._config.double_tap_action,
      }),
      { shouldIgnore: (ev) => !!ev.target.closest(".type-toggle") }
    );

    this._bindTypeToggle();

    if (showTrend) {
      this._ro = new ResizeObserver(() => this._drawSparkline());
      this._ro.observe(this.shadowRoot.querySelector(".spark"));
    }

    this._updateLive();
  }

  _bindTypeToggle() {
    const toggles = this.shadowRoot.querySelectorAll(".type-toggle .tgl");
    if (!toggles.length) return;
    toggles.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.type === this._chartType);
      btn.setAttribute(
        "aria-pressed",
        btn.dataset.type === this._chartType ? "true" : "false"
      );
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const next = btn.dataset.type === "bar" ? "bar" : "line";
        if (next === this._chartType) return;
        this._chartType = next;
        toggles.forEach((b) => {
          const on = b.dataset.type === next;
          b.classList.toggle("active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        this._drawSparkline();
      });
    });
  }

  _styles() {
    const c = this._config;
    const color =
      FuDash.COLOR_PRESETS[c.color] || c.color || "var(--primary-color)";
    return `
      ha-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px 16px 12px;
        cursor: pointer;
        transition: background 180ms var(--fudash-ease),
                    box-shadow 180ms var(--fudash-ease);
      }
      ha-card:hover {
        background: color-mix(in srgb, var(--primary-text-color) 4%, var(--ha-card-background, var(--card-background-color)));
      }
      ha-card:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        min-height: 1.2em;
      }
      .top-right {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .type-toggle {
        display: inline-flex;
        background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
        border-radius: 999px;
        padding: 2px;
        gap: 2px;
      }
      .type-toggle .tgl {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 18px;
        border-radius: 999px;
        cursor: pointer;
        color: var(--fudash-muted);
        transition: background 180ms var(--fudash-ease), color 180ms var(--fudash-ease);
      }
      .type-toggle .tgl svg { width: 14px; height: 10px; }
      .type-toggle .tgl:hover { color: var(--primary-text-color); }
      .type-toggle .tgl.active {
        background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
        color: var(--primary-text-color);
        box-shadow: 0 1px 2px rgba(0,0,0,0.22);
      }
      .type-toggle .tgl:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 1px;
      }
      .name {
        color: var(--fudash-muted);
        font-size: 0.85rem;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .delta {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 1px 7px;
        border-radius: 999px;
        font-variant-numeric: tabular-nums;
        background: color-mix(in srgb, currentColor 12%, transparent);
      }
      .delta[data-trend="up"]  { color: var(--success-color, #2e7d32); }
      .delta[data-trend="down"]{ color: var(--error-color,  #c62828); }
      .delta[data-trend="flat"]{ color: var(--fudash-muted); }
      .main {
        display: flex;
        align-items: baseline;
        gap: 4px;
        line-height: 1.05;
      }
      .value {
        font-size: clamp(1.8rem, 8vw, 2.2rem);
        font-weight: 600;
        color: var(--primary-text-color);
        font-variant-numeric: tabular-nums;
      }
      .unit {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--fudash-muted);
      }
      svg.spark {
        width: 100%;
        height: 40px;
        display: block;
        overflow: visible;
        margin-top: 2px;
      }
      .spark-line  { fill: none; stroke: ${color}; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
      .spark-area  { fill: ${color}; opacity: 0.18; stroke: none; }
      .spark-dot   { fill: ${color}; stroke: var(--ha-card-background, var(--card-background-color, #1c1c1c)); stroke-width: 2; }
      .spark-bar   { fill: ${color}; stroke: none; }
      .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        margin-top: 4px;
        padding-top: 6px;
        border-top: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
      }
      .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        min-width: 0;
      }
      .stat-label {
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--fudash-muted);
      }
      .stat-value {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--primary-text-color);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .stat[data-kind="min"] .stat-value { color: var(--info-color, #0288d1); }
      .stat[data-kind="max"] .stat-value { color: var(--warning-color, #ed6c02); }
    `;
  }

  // Aktualisiert Name / Wert / Einheit aus dem Live-hass. Delta und
  // Sparkline werden getrennt via _drawSparkline/_updateDelta aus der
  // History aktualisiert.
  _updateLive() {
    if (!this._rendered || !this._hass) return;
    const c = this._config;
    const state = FuDash.getState(this._hass, c.entity);
    const nameEl = this.shadowRoot.querySelector(".name");
    const valEl = this.shadowRoot.querySelector(".value");
    const unitEl = this.shadowRoot.querySelector(".unit");
    const fallbackName =
      state?.attributes?.friendly_name || c.entity || "–";
    nameEl.textContent = c.name || fallbackName;

    if (FuDash.isUnavailable(state)) {
      valEl.textContent = "–";
      unitEl.textContent = "";
      return;
    }

    const v = FuDash.parseNumber(state.state);
    const unit = c.unit || state.attributes?.unit_of_measurement || "";
    const fmtOpts = this._numberFormatOpts(v);
    valEl.textContent =
      v == null ? state.state : FuDash.formatNumber(this._hass, v, fmtOpts);
    unitEl.textContent = unit ? ` ${unit}` : "";
    this._currentValue = v;
    this._drawSparkline(); // zeichnet Endpunkt neu
  }

  _numberFormatOpts(sample) {
    const d = this._config?.decimals;
    if (d !== "auto" && d !== undefined && d !== null) {
      const n = Math.max(0, Math.min(6, Number(d) || 0));
      return { minimumFractionDigits: n, maximumFractionDigits: n };
    }
    if (!Number.isFinite(sample)) return { maximumFractionDigits: 1 };
    const abs = Math.abs(sample);
    if (abs >= 100) return { maximumFractionDigits: 0 };
    if (abs >= 10) return { maximumFractionDigits: 1 };
    return { maximumFractionDigits: 2 };
  }

  async _fetchAndDraw() {
    if (!this._hass || !this._config) return;
    const c = this._config;
    if (
      c.show_trend === false &&
      c.show_delta === false &&
      c.show_stats === false
    ) {
      return;
    }
    const hours = Math.max(1, Math.min(168, Number(c.hours) || 24));
    const key = `${hours}|${c.entity}`;
    if (this._lastFetchKey === key && this._seriesData) {
      this._drawSparkline();
      this._updateDelta();
      this._updateStats();
      return;
    }
    this._lastFetchKey = key;
    try {
      this._seriesData = await FuDash.fetchSeries(this._hass, c.entity, hours);
      this._drawSparkline();
      this._updateDelta();
      this._updateStats();
    } catch (err) {
      console.warn("FuDash: Stat-Card fetch fehlgeschlagen", err);
    }
  }

  _drawSparkline() {
    if (this._config.show_trend === false) return;
    const svg = this.shadowRoot.querySelector("svg.spark");
    if (!svg) return;
    const data = this._seriesData || [];
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    if (width < 10 || height < 10 || data.length < 2) {
      svg.innerHTML = "";
      return;
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    // Endpunkt: wenn live-Wert vorhanden, an current time andocken.
    const pts = data.map((p) => ({ t: p.t, v: p.v }));
    const now = Date.now();
    if (Number.isFinite(this._currentValue)) {
      pts.push({ t: now, v: this._currentValue });
    }
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const p of pts) {
      if (p.v < vMin) vMin = p.v;
      if (p.v > vMax) vMax = p.v;
    }
    if (vMin === vMax) {
      vMin -= 1;
      vMax += 1;
    }
    const pad = 3;
    const tMin = pts[0].t;
    const tMax = pts[pts.length - 1].t;
    const xScale = (t) => ((t - tMin) / (tMax - tMin)) * width;
    const yScale = (v) =>
      pad + (1 - (v - vMin) / (vMax - vMin)) * (height - 2 * pad);

    const chartType = this._chartType || "line";
    if (chartType === "bar") {
      this._drawSparkBars(svg, pts, width, height, tMin, tMax, xScale, yScale);
      return;
    }

    const xy = pts.map((p) => ({ x: xScale(p.t), y: yScale(p.v) }));
    const line = FuDash._monotonePath(xy);
    const area = line + ` L ${xy[xy.length - 1].x} ${height} L ${xy[0].x} ${height} Z`;
    const last = xy[xy.length - 1];
    svg.innerHTML =
      `<path class="spark-area" d="${area}"/>` +
      `<path class="spark-line" d="${line}"/>` +
      `<circle class="spark-dot" cx="${last.x}" cy="${last.y}" r="2.6"/>`;
  }

  _drawSparkBars(svg, pts, width, height, tMin, tMax, xScale, yScale) {
    const c = this._config;
    // NaN-sichere Balken-Parameter (siehe Chart-Card).
    const barWidthRaw = Number(c.bar_width);
    const barWidth = Number.isFinite(barWidthRaw) && barWidthRaw > 0
      ? Math.min(20, barWidthRaw)
      : 3;
    const barGapRaw = Number(c.bar_gap);
    const barGap = Number.isFinite(barGapRaw)
      ? Math.max(0, Math.min(8, barGapRaw))
      : 1;

    const slotMin = barWidth + barGap;
    const buckets = Math.max(2, Math.min(120, Math.floor(width / slotMin)));
    const bucketMs = (tMax - tMin) / buckets;

    // Sortierte Rohdaten fuer Binaersuche.
    const sorted = pts.slice().sort((a, b) => a.t - b.t);
    const bars = [];
    for (let b = 0; b < buckets; b++) {
      const tCenter = tMin + (b + 0.5) * bucketMs;
      let lo = 0;
      let hi = sorted.length - 1;
      let res = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid].t <= tCenter) {
          res = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (res < 0 && sorted.length) res = 0;
      if (res >= 0) bars.push({ t: tCenter, v: sorted[res].v });
    }
    if (!bars.length) {
      svg.innerHTML = "";
      return;
    }

    const slotW = width / buckets;
    const effBarW = Math.max(1, Math.min(barWidth, slotW - Math.max(1, barGap)));
    const radius = Math.min(effBarW / 2, 1.5);
    const baseline = height;
    const parts = bars.map((p) => {
      const cx = xScale(p.t);
      const y = yScale(p.v);
      const top = Math.min(y, baseline - 1);
      const h = Math.max(1, baseline - top);
      const x = cx - effBarW / 2;
      return `<rect class="spark-bar" x="${x.toFixed(2)}" y="${top.toFixed(
        2
      )}" width="${effBarW.toFixed(2)}" height="${h.toFixed(
        2
      )}" rx="${radius.toFixed(2)}"/>`;
    });
    svg.innerHTML = parts.join("");
  }

  _updateDelta() {
    if (this._config.show_delta === false) return;
    const el = this.shadowRoot.querySelector(".delta");
    if (!el) return;
    const data = this._seriesData || [];
    const current = this._currentValue;
    if (!Number.isFinite(current) || data.length < 2) {
      el.hidden = true;
      return;
    }
    // Referenzwert = erster Punkt im Zeitraum.
    const reference = data[0].v;
    if (!Number.isFinite(reference)) {
      el.hidden = true;
      return;
    }
    const diff = current - reference;
    const pct = reference !== 0 ? (diff / Math.abs(reference)) * 100 : null;

    // Schwellwert fuer "flat": 1% (konfigurierbar waere overkill).
    let trend = "flat";
    if (pct !== null && Math.abs(pct) >= 1) trend = diff > 0 ? "up" : "down";
    else if (pct === null && Math.abs(diff) > 0) trend = diff > 0 ? "up" : "down";

    const arrow = trend === "up" ? "\u2191" : trend === "down" ? "\u2193" : "\u2192";
    const label =
      pct !== null
        ? `${arrow} ${FuDash.formatNumber(this._hass, pct, {
            maximumFractionDigits: Math.abs(pct) >= 10 ? 0 : 1,
            signDisplay: "never",
          })}\u202F%`
        : `${arrow} ${FuDash.formatNumber(this._hass, Math.abs(diff))}`;
    el.textContent = label;
    el.dataset.trend = trend;
    el.title = `Vergleich zum Wert vor ${this._config.hours || 24}\u202Fh`;
    el.hidden = false;
  }

  // Min/Mittelwert/Max ueber den gewaehlten Zeitraum. Einbezogen wird
  // auch der aktuelle Live-Wert, damit die Anzeige mit der Sparkline
  // konsistent ist (siehe _drawSparkline).
  _updateStats() {
    if (this._config.show_stats === false) return;
    const box = this.shadowRoot.querySelector(".stats");
    if (!box) return;
    const data = this._seriesData || [];
    const values = [];
    for (const p of data) {
      if (Number.isFinite(p.v)) values.push(p.v);
    }
    if (Number.isFinite(this._currentValue)) values.push(this._currentValue);
    if (values.length < 2) {
      box.hidden = true;
      return;
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const avg = sum / values.length;
    const unit = this.shadowRoot.querySelector(".unit")?.textContent || "";
    const fmt = (v) =>
      FuDash.formatNumber(this._hass, v, this._numberFormatOpts(v));
    const setStat = (kind, value, title) => {
      const el = box.querySelector(`.stat[data-kind="${kind}"] .stat-value`);
      if (!el) return;
      el.textContent = `${fmt(value)}${unit}`;
      el.parentElement.title = title;
    };
    const hours = this._config.hours || 24;
    setStat("min", min, `Minimum der letzten ${hours}\u202Fh`);
    setStat("avg", avg, `Mittelwert der letzten ${hours}\u202Fh`);
    setStat("max", max, `Maximum der letzten ${hours}\u202Fh`);
    box.hidden = false;
  }
};

// ===== src/stat-card/fudash-stat-card-editor.js =====
// Visueller Editor fuer die Stat-Card.

FuDash.StatEditor = class FudashStatCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._form = null;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _ensureForm() {
    if (this._form) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-form { display: block; }
      </style>
    `;
    const form = document.createElement("ha-form");
    form.addEventListener("value-changed", (ev) => {
      const next = { ...this._config, ...ev.detail.value };
      this._config = next;
      FuDash.fireEvent(this, "config-changed", { config: next });
    });
    this._form = form;
    this.shadowRoot.appendChild(form);
  }

  _render() {
    this._ensureForm();
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = this._schema();
    this._form.computeLabel = (s) =>
      ({
        entity: "Entity",
        name: "Anzeigename",
        unit: "Einheit (optional)",
        color: "Farbe",
        hours: "Trend-Zeitraum (Stunden)",
        decimals: "Nachkommastellen (0-6, leer = auto)",
        show_trend: "Sparkline anzeigen",
        show_delta: "Delta-Anzeige",
        show_stats: "Min/\u00D8/Max anzeigen",
        chart_type: "Sparkline-Darstellung (Start-Typ)",
        show_type_toggle: "Umschalter Linie/Balken anzeigen",
        bar_width: "Balkenbreite (px)",
        bar_gap: "Balkenluecke (px)",
        refresh_interval: "Aktualisierungsintervall (Sek.)",
        ...FuDash.ACTION_LABELS,
      }[s.name] || s.name);
    this._form.computeHelper = (s) =>
      ({
        hours: "1-168 h. Bestimmt Trend und Delta-Referenzpunkt.",
        decimals:
          "Leer lassen fuer automatisch (abhaengig von der Groessenordnung).",
        bar_width:
          "Nur im Balken-Modus. Die Datenpunkt-Dichte passt sich automatisch an.",
      }[s.name]);
  }

  _schema() {
    const colorOptions = FuDash.COLOR_OPTIONS || [
      { value: "primary", label: "primary" },
    ];
    // Modus-spezifische Felder nur anzeigen, wenn sie auch wirken.
    const isBar =
      String(this._config?.chart_type || "bar").toLowerCase() !== "line";
    const showTrend = this._config?.show_trend !== false;

    const commonGrid = {
      type: "grid",
      name: "",
      schema: [
        {
          name: "hours",
          default: 24,
          selector: { number: { min: 1, max: 168, step: 1, mode: "box" } },
        },
        {
          name: "decimals",
          selector: { number: { min: 0, max: 6, step: 1, mode: "box" } },
        },
        { name: "show_trend", default: true, selector: { boolean: {} } },
        { name: "show_delta", default: true, selector: { boolean: {} } },
        { name: "show_stats", default: true, selector: { boolean: {} } },
        {
          name: "color",
          default: "primary",
          selector: { select: { mode: "dropdown", options: colorOptions } },
        },
        {
          name: "refresh_interval",
          default: 120,
          selector: { number: { min: 30, max: 600, step: 10, mode: "box" } },
        },
      ],
    };

    const sparkRow = showTrend
      ? {
          type: "grid",
          name: "",
          schema: [
            {
              name: "chart_type",
              default: "bar",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "line", label: "Linie" },
                    { value: "bar", label: "Balken" },
                  ],
                },
              },
            },
            {
              name: "show_type_toggle",
              default: true,
              selector: { boolean: {} },
            },
            ...(isBar
              ? [
                  {
                    name: "bar_width",
                    default: 3,
                    selector: { number: { min: 1, max: 20, step: 1, mode: "slider" } },
                  },
                  {
                    name: "bar_gap",
                    default: 1,
                    selector: { number: { min: 0, max: 8, step: 1, mode: "slider" } },
                  },
                ]
              : []),
          ],
        }
      : null;

    return [
      {
        name: "entity",
        selector: { entity: { filter: { domain: ["sensor", "input_number", "number"] } } },
      },
      { name: "name", selector: { text: {} } },
      { name: "unit", selector: { text: {} } },
      commonGrid,
      ...(sparkRow ? [sparkRow] : []),
      FuDash.ACTIONS_SCHEMA,
    ];
  }
};

// ===== src/fudash-cards.js =====
// Registrierung aller FuDash-Karten + HA-Custom-Card-Picker-Eintrag.
// Wird als LETZTE Datei in dist/fudash-cards.js konkateniert.

if (!customElements.get("fudash-bar-card")) {
  customElements.define("fudash-bar-card", FuDash.BarCard);
}
if (!customElements.get("fudash-bar-card-editor")) {
  customElements.define("fudash-bar-card-editor", FuDash.BarEditor);
}
if (!customElements.get("fudash-gauge-card")) {
  customElements.define("fudash-gauge-card", FuDash.GaugeCard);
}
if (!customElements.get("fudash-gauge-card-editor")) {
  customElements.define("fudash-gauge-card-editor", FuDash.GaugeEditor);
}
if (!customElements.get("fudash-donut-card")) {
  customElements.define("fudash-donut-card", FuDash.DonutCard);
}
if (!customElements.get("fudash-donut-card-editor")) {
  customElements.define("fudash-donut-card-editor", FuDash.DonutEditor);
}
if (!customElements.get("fudash-stat-card")) {
  customElements.define("fudash-stat-card", FuDash.StatCard);
}
if (!customElements.get("fudash-stat-card-editor")) {
  customElements.define("fudash-stat-card-editor", FuDash.StatEditor);
}

window.customCards = window.customCards || [];
const addCard = (def) => {
  if (!window.customCards.some((c) => c.type === def.type)) {
    window.customCards.push(def);
  }
};
addCard({
  type: "fudash-bar-card",
  name: "FuDash Bar",
  description:
    "Segmentierter horizontaler Balken im Fuel-Used-Stil, z. B. fuer Hauslast / Solar / Netzbezug.",
  preview: true,
});
addCard({
  type: "fudash-gauge-card",
  name: "FuDash Gauge",
  description: "Moderne Material-3-Radial-Gauge.",
  preview: true,
});
addCard({
  type: "fudash-donut-card",
  name: "FuDash Donut",
  description:
    "Donut-/Pie-Diagramm fuer Anteile (z. B. Strommix, Verteilungen) mit Center-Label.",
  preview: true,
});
addCard({
  type: "fudash-stat-card",
  name: "FuDash Stat",
  description:
    "Kompakte KPI-Karte mit grosser Einzelzahl, Trend-Sparkline und Delta.",
  preview: true,
});

console.info(
  `%c FUDASH-CARDS %c ${FuDash.VERSION} `,
  "color:#fff;background:#0a84ff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:600",
  "color:#fff;background:#303030;padding:2px 6px;border-radius:0 4px 4px 0"
);
})();
