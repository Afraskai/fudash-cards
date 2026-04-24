// Visueller Editor fuer die Stat-Card.

FuDash.StatEditor = class FudashStatCardEditor extends HTMLElement {
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
        entity: "Entity",
        name: "Anzeigename",
        unit: "Einheit (optional)",
        color: "Farbe",
        hours: "Trend-Zeitraum (Stunden)",
        decimals: "Nachkommastellen (0-6, leer = auto)",
        show_trend: "Sparkline anzeigen",
        show_delta: "Delta-Anzeige",
        show_stats: "Min/\u00D8/Max anzeigen",
        chart_type: "Sparkline-Darstellung (Start-Typ)",
        show_type_toggle: "Umschalter Linie/Balken anzeigen",
        bar_width: "Balkenbreite (px)",
        bar_gap: "Balkenluecke (px)",
        refresh_interval: "Aktualisierungsintervall (Sek.)",
        ...FuDash.ACTION_LABELS,
      }[s.name] || s.name);
    this._form.computeHelper = (s) =>
      ({
        hours: "1-168 h. Bestimmt Trend und Delta-Referenzpunkt.",
        decimals:
          "Leer lassen fuer automatisch (abhaengig von der Groessenordnung).",
        bar_width:
          "Nur im Balken-Modus. Die Datenpunkt-Dichte passt sich automatisch an.",
      }[s.name]);
  }

  _schema() {
    const colorOptions = FuDash.COLOR_OPTIONS || [
      { value: "primary", label: "primary" },
    ];
    // Modus-spezifische Felder nur anzeigen, wenn sie auch wirken.
    const isBar =
      String(this._config?.chart_type || "bar").toLowerCase() !== "line";
    const showTrend = this._config?.show_trend !== false;

    const commonGrid = {
      type: "grid",
      name: "",
      schema: [
        {
          name: "hours",
          default: 24,
          selector: { number: { min: 1, max: 168, step: 1, mode: "box" } },
        },
        {
          name: "decimals",
          selector: { number: { min: 0, max: 6, step: 1, mode: "box" } },
        },
        { name: "show_trend", default: true, selector: { boolean: {} } },
        { name: "show_delta", default: true, selector: { boolean: {} } },
        { name: "show_stats", default: true, selector: { boolean: {} } },
        {
          name: "color",
          default: "primary",
          selector: { select: { mode: "dropdown", options: colorOptions } },
        },
        {
          name: "refresh_interval",
          default: 120,
          selector: { number: { min: 30, max: 600, step: 10, mode: "box" } },
        },
      ],
    };

    const sparkRow = showTrend
      ? {
          type: "grid",
          name: "",
          schema: [
            {
              name: "chart_type",
              default: "bar",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "line", label: "Linie" },
                    { value: "bar", label: "Balken" },
                  ],
                },
              },
            },
            {
              name: "show_type_toggle",
              default: true,
              selector: { boolean: {} },
            },
            ...(isBar
              ? [
                  {
                    name: "bar_width",
                    default: 3,
                    selector: { number: { min: 1, max: 20, step: 1, mode: "slider" } },
                  },
                  {
                    name: "bar_gap",
                    default: 1,
                    selector: { number: { min: 0, max: 8, step: 1, mode: "slider" } },
                  },
                ]
              : []),
          ],
        }
      : null;

    return [
      {
        name: "entity",
        selector: { entity: { filter: { domain: ["sensor", "input_number", "number"] } } },
      },
      { name: "name", selector: { text: {} } },
      { name: "unit", selector: { text: {} } },
      commonGrid,
      ...(sparkRow ? [sparkRow] : []),
      FuDash.ACTIONS_SCHEMA,
    ];
  }
};
