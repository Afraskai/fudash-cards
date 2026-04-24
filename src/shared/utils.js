// FuDash Shared Utilities
// Gemeinsamer Namespace + Formatierungs-Helfer fuer alle Karten.
// Wird als erstes in dist/fudash-cards.js konkateniert.

const FuDash = (window.FuDash = window.FuDash || {});
FuDash.VERSION = "0.9.0";

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
