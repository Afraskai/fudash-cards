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
