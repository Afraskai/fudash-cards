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
