// FuDash gemeinsames Stylesheet (Material-3-inspirierte Tokens,
// gemappt auf Home-Assistant-CSS-Variablen, damit jedes Theme greift).

FuDash.sharedStyles = `
  :host {
    --fudash-ease: cubic-bezier(0.2, 0, 0, 1);
    --fudash-radius: var(--ha-card-border-radius, 12px);
    --fudash-success: var(--success-color, #43a047);
    --fudash-warn: var(--warning-color, #f9a825);
    --fudash-crit: var(--error-color, #e53935);
    --fudash-track: color-mix(in srgb, var(--primary-text-color, #fff) 14%, transparent);
    --fudash-muted: var(--secondary-text-color, #8a8a8a);
    display: block;
  }

  ha-card {
    padding: 16px;
    display: block;
    border-radius: var(--fudash-radius);
  }

  .fudash-title {
    font-size: 1rem;
    font-weight: 500;
    color: var(--primary-text-color);
    margin: 0 0 12px 0;
    text-align: center;
    letter-spacing: 0.1px;
  }

  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
  }
`;
