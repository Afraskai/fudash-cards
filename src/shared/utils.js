// FuDash Shared Utilities
// Gemeinsamer Namespace + Formatierungs-Helfer fuer alle Karten.
// Wird als erstes in dist/fudash-cards.js konkateniert.

const FuDash = (window.FuDash = window.FuDash || {});
FuDash.VERSION = "0.12.1";

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
  { value: "auto", label: "Auto (by threshold)" },
  { value: "primary", label: "Primary" },
  { value: "success", label: "Green (success)" },
  { value: "warn", label: "Yellow (warning)" },
  { value: "crit", label: "Red (critical)" },
  { value: "blue", label: "Blue" },
  { value: "indigo", label: "Indigo" },
  { value: "teal", label: "Teal" },
  { value: "cyan", label: "Cyan" },
  { value: "green", label: "Green" },
  { value: "lime", label: "Lime" },
  { value: "amber", label: "Amber" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "pink", label: "Pink" },
  { value: "rose", label: "Rose" },
  { value: "purple", label: "Purple" },
  { value: "slate", label: "Slate" },
  { value: "muted", label: "Grey" },
];

// Wandelt einen Farb-Namen aus COLOR_PRESETS oder eine freie CSS-Farbe
// (#rrggbb, var(--…), oklch(…), rgb(…)) in einen fuer CSS direkt
// verwendbaren String um. Unbekannte / leere Werte liefern null.
FuDash.resolvePresetColor = (name) => {
  if (!name) return null;
  return FuDash.COLOR_PRESETS[name] || String(name);
};

// Dreifarben-Gradient (low -> mid -> high) ueber CSS color-mix().
// Liefert einen CSS-Farb-String, der im Browser interpoliert wird.
// Klemmt value auf [low, high]; liefert null bei ungueltigen Eingaben.
FuDash.dynamicGradientColor = ({ value, low, mid, high, cLow, cMid, cHigh }) => {
  if (!Number.isFinite(value)) return null;
  const lo = Number(low);
  const md = Number(mid);
  const hi = Number(high);
  if (!Number.isFinite(lo) || !Number.isFinite(md) || !Number.isFinite(hi)) {
    return null;
  }
  // Sortier-Checks: low <= mid <= high.
  if (lo > md || md > hi) return null;
  const colorLow = FuDash.resolvePresetColor(cLow);
  const colorMid = FuDash.resolvePresetColor(cMid);
  const colorHigh = FuDash.resolvePresetColor(cHigh);
  if (!colorLow || !colorMid || !colorHigh) return null;

  // Klemmen.
  if (value <= lo) return colorLow;
  if (value >= hi) return colorHigh;

  // Segment bestimmen und Mischanteil in % berechnen.
  // Sonderfall: lo == md (nur zwei Farben zwischen mid und high).
  // Sonderfall: md == hi (nur zwei Farben zwischen low und mid).
  if (value <= md) {
    if (md === lo) return colorMid;
    const t = ((value - lo) / (md - lo)) * 100;
    const pct = Math.max(0, Math.min(100, t)).toFixed(2);
    return `color-mix(in oklch, ${colorLow}, ${colorMid} ${pct}%)`;
  }
  if (hi === md) return colorMid;
  const t = ((value - md) / (hi - md)) * 100;
  const pct = Math.max(0, Math.min(100, t)).toFixed(2);
  return `color-mix(in oklch, ${colorMid}, ${colorHigh} ${pct}%)`;
};

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
