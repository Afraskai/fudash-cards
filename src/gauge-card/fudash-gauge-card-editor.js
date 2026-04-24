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
