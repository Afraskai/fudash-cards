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
