// Gemeinsame Sparkline-Helfer fuer FuDash-Karten.
// Aktuell genutzt von der Stat-Card fuer die Trend-Sparkline.

// Monotone kubische Spline (Fritsch-Carlson) als SVG-Bezier-Pfad.
// Vorteil gegenueber Catmull-Rom: keine Ueberschwinger bei Datenspitzen.
FuDash._monotonePath = (pts) => {
  const n = pts.length;
  if (n < 2) return "";
  if (n === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  const dx = new Array(n - 1);
  const dy = new Array(n - 1);
  const m = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1);
  }
  m[0] = dy[0];
  m[n - 1] = dy[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (dy[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / dy[i];
    const b = m[i + 1] / dy[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * dy[i];
      m[i + 1] = t * b * dy[i];
    }
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const c1x = pts[i].x + h / 3;
    const c1y = pts[i].y + (m[i] * h) / 3;
    const c2x = pts[i + 1].x - h / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * h) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
};
