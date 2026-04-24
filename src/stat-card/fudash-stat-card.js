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
