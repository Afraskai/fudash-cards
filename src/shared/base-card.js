// Basisklasse fuer alle FuDash-Karten.
// Kuemmert sich um Shadow-DOM, setConfig-Validierung und hass-Lifecycle.
// Abgeleitete Klassen ueberschreiben _render() (initiales DOM) und
// _update() (billiges Attribut-Update bei neuem hass).

FuDash.BaseCard = class FudashBaseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._rendered = false;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("FuDash: Konfiguration fehlt oder ist ungueltig");
    }
    this._config = config;
    this._rendered = false;
    if (this.isConnected) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._rendered) this._render();
    else this._update();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    if (this._config && !this._rendered) this._render();
  }

  getCardSize() {
    return 2;
  }

  // Wird von abgeleiteten Klassen ueberschrieben.
  _render() {}
  _update() {}
};
