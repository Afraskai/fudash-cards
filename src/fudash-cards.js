// Registrierung aller FuDash-Karten + HA-Custom-Card-Picker-Eintrag.
// Wird als LETZTE Datei in dist/fudash-cards.js konkateniert.

if (!customElements.get("fudash-bar-card")) {
  customElements.define("fudash-bar-card", FuDash.BarCard);
}
if (!customElements.get("fudash-bar-card-editor")) {
  customElements.define("fudash-bar-card-editor", FuDash.BarEditor);
}
if (!customElements.get("fudash-gauge-card")) {
  customElements.define("fudash-gauge-card", FuDash.GaugeCard);
}
if (!customElements.get("fudash-gauge-card-editor")) {
  customElements.define("fudash-gauge-card-editor", FuDash.GaugeEditor);
}
if (!customElements.get("fudash-donut-card")) {
  customElements.define("fudash-donut-card", FuDash.DonutCard);
}
if (!customElements.get("fudash-donut-card-editor")) {
  customElements.define("fudash-donut-card-editor", FuDash.DonutEditor);
}
if (!customElements.get("fudash-stat-card")) {
  customElements.define("fudash-stat-card", FuDash.StatCard);
}
if (!customElements.get("fudash-stat-card-editor")) {
  customElements.define("fudash-stat-card-editor", FuDash.StatEditor);
}

window.customCards = window.customCards || [];
const addCard = (def) => {
  if (!window.customCards.some((c) => c.type === def.type)) {
    window.customCards.push(def);
  }
};
addCard({
  type: "fudash-bar-card",
  name: "FuDash Bar",
  description:
    "Segmentierter horizontaler Balken im Fuel-Used-Stil, z. B. fuer Hauslast / Solar / Netzbezug.",
  preview: true,
});
addCard({
  type: "fudash-gauge-card",
  name: "FuDash Gauge",
  description: "Moderne Material-3-Radial-Gauge.",
  preview: true,
});
addCard({
  type: "fudash-donut-card",
  name: "FuDash Donut",
  description:
    "Donut-/Pie-Diagramm fuer Anteile (z. B. Strommix, Verteilungen) mit Center-Label.",
  preview: true,
});
addCard({
  type: "fudash-stat-card",
  name: "FuDash Stat",
  description:
    "Kompakte KPI-Karte mit grosser Einzelzahl, Trend-Sparkline und Delta.",
  preview: true,
});

console.info(
  `%c FUDASH-CARDS %c ${FuDash.VERSION} `,
  "color:#fff;background:#0a84ff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:600",
  "color:#fff;background:#303030;padding:2px 6px;border-radius:0 4px 4px 0"
);
