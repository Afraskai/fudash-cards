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
        title: "Title",
        segments: "Segments",
        gap: "Gap between segments (px)",
        height: "Bar height (px)",
        animate: "Animate value changes",
        value_color: "Default color (all bars)",
        entities: "Entities (YAML list)",
        ...FuDash.ACTION_LABELS,
      }[s.name] || s.name);
    this._form.computeHelper = (s) =>
      ({
        entities:
          "Each entry: entity (required), name, max, warn, crit, color.",
        value_color:
          "Used when an entity entry has no own 'color' option.",
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
