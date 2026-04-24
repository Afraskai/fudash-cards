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
