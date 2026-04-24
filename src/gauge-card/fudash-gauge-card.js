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
