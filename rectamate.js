(function () {
  "use strict";

  const STYLE_ID = "rectamate-styles";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const DEFAULTS = {
    modo: "recta",
    variante: null,
    meta: {},
    rango: { inicio: 0, fin: 1 },
    step: 1,
    formatoEtiquetas: "auto",
    etiquetasnoenterassimplificar: true,
    etiquetasenterassimplificar: true,
    mostrarTicks: true,
    mostrarEtiquetas: true,
    mostrarExtremos: true,
    mostrarValorCentro: true,
    altura: 230,
    tema: "claro",
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .rectamate-shell {
        --rm-ink: #172033;
        --rm-muted: #667085;
        --rm-line: #98a2b3;
        --rm-soft: #eef2f7;
        --rm-grid: #d7dde8;
        --rm-accent: #0f766e;
        --rm-accent-2: #b42318;
        --rm-warm: #f5b642;
        --rm-bg: #ffffff;
        box-sizing: border-box;
        width: 100%;
        max-width: 960px;
        margin: 18px auto;
        padding: 16px;
        color: var(--rm-ink);
        background: var(--rm-bg);
        border: 1px solid #e4e7ec;
        border-radius: 8px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .rectamate-shell *,
      .rectamate-shell *::before,
      .rectamate-shell *::after {
        box-sizing: border-box;
      }

      .rectamate-title {
        margin: 0 0 10px;
        font-size: 18px;
        line-height: 1.25;
        font-weight: 700;
      }

      .rectamate-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 0 0 10px;
      }

      .rectamate-head .rectamate-title {
        margin: 0;
      }

      .rectamate-zoom-controls {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex: 0 0 auto;
      }

      .rectamate-zoom-button {
        width: 34px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #ffffff;
        color: var(--rm-ink);
        font-size: 16px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
      }

      .rectamate-zoom-button:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }

      .rectamate-zoom-button:focus-visible {
        outline: 3px solid rgba(15, 118, 110, 0.25);
        outline-offset: 2px;
      }

      .rectamate-zoom-reset {
        width: auto;
        min-width: 54px;
        padding: 0 10px;
        font-size: 13px;
      }

      .rectamate-stage {
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
      }

      .rectamate-stage.rm-pan-enabled {
        cursor: grab;
        touch-action: none;
      }

      .rectamate-stage.rm-is-panning {
        cursor: grabbing;
      }

      .rectamate-svg {
        display: block;
        width: 100%;
        min-width: 520px;
        height: auto;
      }

      .rm-axis,
      .rm-tick,
      .rm-subtick,
      .rm-bar-edge {
        vector-effect: non-scaling-stroke;
        stroke-linecap: round;
      }

      .rm-label {
        fill: var(--rm-ink);
        font-size: 15px;
        text-anchor: middle;
        dominant-baseline: central;
      }

      .rm-small-label {
        fill: var(--rm-muted);
        font-size: 13px;
        text-anchor: middle;
        dominant-baseline: central;
      }

      .rm-highlight-label,
      .rm-arrow-label,
      .rm-section-label {
        fill: var(--rm-ink);
        font-size: 15px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
      }

      .rm-highlight-dot {
        fill: var(--rm-bg);
        stroke: var(--rm-current, var(--rm-accent));
        stroke-width: 3;
        vector-effect: non-scaling-stroke;
      }

      .rm-highlight-selectable {
        cursor: pointer;
      }

      .rm-highlight-selected {
        fill: #fff7ed;
        stroke-width: 4;
      }

      .rm-subtick {
        stroke: var(--rm-grid);
        stroke-width: 1.4;
      }

      .rm-highlight-stem {
        stroke: var(--rm-current, var(--rm-accent));
        stroke-width: 2;
        stroke-dasharray: 4 4;
        vector-effect: non-scaling-stroke;
      }

      .rm-arrow-path {
        fill: none;
        stroke: var(--rm-current, var(--rm-accent-2));
        stroke-width: 2.4;
        vector-effect: non-scaling-stroke;
      }

      .rm-bar {
        fill: var(--rm-soft);
        stroke: var(--rm-line);
        stroke-width: 1.4;
        vector-effect: non-scaling-stroke;
      }

      .rm-bar.rm-section-highlight {
        fill: #d1fadf;
        stroke: var(--rm-accent);
        stroke-width: 2;
      }

      .rm-section-brace {
        fill: none;
        stroke: var(--rm-accent);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }

      .rectamate-error {
        color: #b42318;
        background: #fff1f0;
        border: 1px solid #fecdca;
        border-radius: 8px;
        padding: 12px;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) el.setAttribute(key, String(value));
    });
    return el;
  }

  function normalizeDecimalText(value) {
    return String(value).trim().replace(",", ".");
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  function parseNumber(value) {
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && "valor" in value) return parseNumber(value.valor);

    const raw = normalizeDecimalText(value);
    if (!raw) throw new Error("Valor numerico vacio.");

    const frac = raw.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    if (frac) {
      const numerator = Number(frac[1]);
      const denominator = Number(frac[2]);
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
        throw new Error(`Fraccion invalida: ${value}`);
      }
      return numerator / denominator;
    }

    const sqrt = raw.match(/^sqrt\(([-+]?\d+(?:\.\d+)?)\)$/i);
    if (sqrt) return Math.sqrt(Number(sqrt[1]));

    if (/^pi$/i.test(raw)) return Math.PI;

    const number = Number(raw);
    if (!Number.isFinite(number)) throw new Error(`No se pudo interpretar el numero: ${value}`);
    return number;
  }

  function decimalPlaces(value) {
    const text = normalizeDecimalText(value);
    const match = text.match(/\.(\d+)/);
    return match ? match[1].length : 0;
  }

  function fractionFromDecimal(value, maxDenominator = 1000) {
    const sign = value < 0 ? -1 : 1;
    value = Math.abs(value);
    let bestNum = 0;
    let bestDen = 1;
    let bestErr = Infinity;

    for (let den = 1; den <= maxDenominator; den += 1) {
      const num = Math.round(value * den);
      const err = Math.abs(value - num / den);
      if (err < bestErr) {
        bestNum = num;
        bestDen = den;
        bestErr = err;
      }
      if (err < 1e-10) break;
    }

    const divisor = gcd(bestNum, bestDen);
    return { n: sign * (bestNum / divisor), d: bestDen / divisor };
  }

  function booleanOption(config, lowerName, camelName, defaultValue = true) {
    const raw = config[lowerName] !== undefined ? config[lowerName] : config[camelName];
    if (raw === undefined || raw === null) return defaultValue;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    const text = String(raw).trim().toLowerCase();
    if (["false", "0", "no", "off"].includes(text)) return false;
    if (["true", "1", "si", "sí", "yes", "on"].includes(text)) return true;
    return defaultValue;
  }

  function stepDenominator(stepRaw) {
    const raw = normalizeDecimalText(stepRaw);
    if (!raw) return null;

    const frac = raw.match(/^[-+]?\d+(?:\.\d+)?\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    if (frac) {
      const denominator = Number(frac[1]);
      if (Number.isFinite(denominator) && denominator !== 0 && Number.isInteger(denominator)) {
        return Math.abs(denominator);
      }
    }

    const decimalDigits = decimalPlaces(raw);
    if (decimalDigits > 0) return Math.pow(10, decimalDigits);
    return null;
  }

  function unsimplifiedFractionFromStep(value, stepRaw) {
    const denominator = stepDenominator(stepRaw);
    if (!denominator) return null;

    const numerator = Math.round(value * denominator);
    if (Math.abs(value - numerator / denominator) > 1e-9) return null;
    return { n: numerator, d: denominator };
  }

  function formatDecimal(value, placesHint = 4, preservePlaces = false) {
    if (Math.abs(value - Math.round(value)) < 1e-10) return String(Math.round(value));
    const text = preservePlaces
      ? value.toFixed(placesHint)
      : Number(value.toFixed(placesHint)).toString();
    return text.replace(".", ",");
  }

  function latexFraction(n, d) {
    if (d === 1) return String(n);
    if (n < 0) return `-\\frac{${Math.abs(n)}}{${d}}`;
    return `\\frac{${n}}{${d}}`;
  }

  function labelFor(value, config, stepRaw) {
    const mode = labelMode(config);

    if (mode === "decimal") {
      const places = Math.max(decimalPlaces(stepRaw), 1);
      return formatDecimal(value, places, true);
    }

    if (mode === "fraccion" || (mode === "auto" && String(stepRaw).includes("/"))) {
      const isInteger = Math.abs(value - Math.round(value)) < 1e-10;
      const simplifyIntegers = booleanOption(config, "etiquetasenterassimplificar", "etiquetasEnterasSimplificar", true);
      const simplifyNonIntegers = booleanOption(config, "etiquetasnoenterassimplificar", "etiquetasNoEnterasSimplificar", true);
      const shouldSimplify = isInteger ? simplifyIntegers : simplifyNonIntegers;

      if (!shouldSimplify) {
        const rawFrac = unsimplifiedFractionFromStep(value, stepRaw);
        if (rawFrac) return latexFraction(rawFrac.n, rawFrac.d);
      }

      const frac = fractionFromDecimal(value);
      return latexFraction(frac.n, frac.d);
    }

    return formatDecimal(value, Math.max(decimalPlaces(stepRaw), 3));
  }

  function labelMode(config) {
    const variant = String(config.variante || "").toLowerCase();
    if (variant === "decimal") return "decimal";
    if (variant === "fraccion" || variant === "fracción") return "fraccion";
    return config.formatoEtiquetas || "auto";
  }

  function dualLabelsFor(value, config, stepRaw) {
    const decimalConfig = { ...config, variante: "decimal" };
    const fractionConfig = { ...config, variante: "fraccion" };
    const decimal = labelFor(value, decimalConfig, stepRaw);
    const fraction = labelFor(value, fractionConfig, stepRaw);
    if (decimal === fraction) return { primary: decimal, secondary: "" };
    return { primary: decimal, secondary: fraction };
  }

  function isDualVariant(config) {
    const variant = String(config.variante || "").toLowerCase();
    return variant === "dual" || variant === "mixta" || variant === "mixto";
  }

  function displayText(item, config, stepRaw) {
    if (item && typeof item === "object") {
      return item.etiqueta ?? item.label ?? labelFor(parseNumber(item.valor), config, stepRaw);
    }
    return labelFor(parseNumber(item), config, stepRaw);
  }

  function buildScale(config, width, padding) {
    const start = parseNumber(config.rango.inicio);
    const end = parseNumber(config.rango.fin);
    if (end === start) throw new Error("El inicio y el fin del rango no pueden ser iguales.");

    const minX = padding.left;
    const maxX = width - padding.right;
    const span = end - start;
    const x = (value) => minX + ((value - start) / span) * (maxX - minX);

    return { start, end, minX, maxX, span, x };
  }

  function generateTicks(config, scale) {
    const step = Math.abs(parseNumber(config.step));
    if (!Number.isFinite(step) || step <= 0) throw new Error("El step debe ser mayor que cero.");

    if (usesStableTickGrid(config)) {
      const stableStep = config.modo === "barras" ? step : activeTickStep(config, scale, step);
      return generateStableTicks(config, scale, stableStep);
    }

    const ticks = [];
    const direction = scale.end >= scale.start ? 1 : -1;
    const limit = Math.ceil(Math.abs(scale.span / step)) + 2;
    const epsilon = step / 100000;

    for (let i = 0; i <= limit; i += 1) {
      const value = scale.start + direction * step * i;
      if (direction > 0 && value > scale.end + epsilon) break;
      if (direction < 0 && value < scale.end - epsilon) break;
      ticks.push(Number(value.toFixed(12)));
    }

    const last = ticks[ticks.length - 1];
    if (Math.abs(last - scale.end) > epsilon) ticks.push(scale.end);
    return ticks;
  }

  function usesStableTickGrid(config) {
    const interaction = getInteraction(config);
    return Boolean(interaction.pan || interaction.arrastrar || interaction.zoomScroll || interaction.botonesZoom || interaction.zoom);
  }

  function generateStableTicks(config, scale, step) {
    const min = Math.min(scale.start, scale.end);
    const max = Math.max(scale.start, scale.end);
    const anchor = config.tickOrigen !== undefined ? parseNumber(config.tickOrigen) : parseNumber(config.__tickOrigin ?? 0);
    const epsilon = step / 100000;
    const firstIndex = Math.ceil((min - anchor) / step - epsilon);
    const lastIndex = Math.floor((max - anchor) / step + epsilon);
    const ticks = [];

    for (let i = firstIndex; i <= lastIndex; i += 1) {
      ticks.push(Number((anchor + i * step).toFixed(12)));
    }

    if (!ticks.length) ticks.push(Number(((min + max) / 2).toFixed(12)));
    return scale.start <= scale.end ? ticks : ticks.reverse();
  }

  function activeTickStep(config, scale, baseStep = Math.abs(parseNumber(config.step))) {
    if (!usesStableTickGrid(config)) return baseStep;

    const drawableWidth = scale.maxX - scale.minX;
    const interaction = getInteraction(config);
    const parentFraction = Number(interaction.nivelPadreFraccion ?? 1);
    const maxLevels = maxSubtickLevels(config);
    let step = baseStep;

    for (let level = 0; level < maxLevels; level += 1) {
      const width = Math.abs(scale.x(scale.start + step) - scale.x(scale.start));
      if (width <= drawableWidth * parentFraction) break;
      step = cleanStep(step / 10);
    }

    return step;
  }

  function cleanStep(value) {
    return Number(value.toFixed(12));
  }

  function addText(svg, text, x, y, className) {
    const el = svgEl("text", { x, y, class: className });
    el.textContent = text;
    svg.appendChild(el);
    return el;
  }

  function addRotatedText(svg, text, x, y, className, angle = -90) {
    const el = svgEl("text", {
      x,
      y,
      class: className,
      transform: `rotate(${angle} ${x} ${y})`,
    });
    el.textContent = text;
    svg.appendChild(el);
    return el;
  }

  function addLatexForeignObject(svg, text, x, y, width, height, className) {
    const fo = svgEl("foreignObject", {
      x: x - width / 2,
      y: y - height / 2,
      width,
      height,
    });
    const div = document.createElement("div");
    div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    div.className = className;
    div.style.cssText = [
      "width:100%",
      "height:100%",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-size:15px",
      "font-weight:600",
      "line-height:1",
      "white-space:nowrap",
      "color:var(--rm-ink)",
    ].join(";");
    div.textContent = `\\(${text}\\)`;
    fo.appendChild(div);
    svg.appendChild(fo);
    return fo;
  }

  function mathRendererAvailable() {
    return Boolean(
      (window.MathJax && typeof window.MathJax.typesetPromise === "function") ||
      (window.katex && window.renderMathInElement)
    );
  }

  function plainMathText(text) {
    return String(text)
      .replace(/-?\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (match, n, d) => {
        return `${match.startsWith("-") ? "-" : ""}${n}/${d}`;
      })
      .replace(/\\pi/g, "pi")
      .replace(/\\cdot/g, "*")
      .replace(/[{}\\]/g, "");
  }

  function addSmartLabel(svg, text, x, y, className) {
    if (String(text).includes("\\") || String(text).includes("^")) {
      if (!mathRendererAvailable()) {
        return addText(svg, plainMathText(text), x, y, className);
      }
      return addLatexForeignObject(svg, text, x, y, 92, 34, className);
    }
    return addText(svg, text, x, y, className);
  }

  function addNumericLabel(svg, value, config, stepRaw, x, y, className) {
    if (isDualVariant(config)) {
      return addDualNumericLabel(svg, value, config, stepRaw, x, y, className);
    }

    const text = labelFor(value, config, stepRaw);
    if (shouldRotateDecimalLabel(value, text)) {
      return addRotatedText(svg, text, x, y + 18, className);
    }
    return addSmartLabel(svg, text, x, y, className);
  }

  function addDualNumericLabel(svg, value, config, stepRaw, x, y, className) {
    const labels = dualLabelsFor(value, config, stepRaw);
    const group = svgEl("g", { class: "rm-dual-label" });
    svg.appendChild(group);

    const fractionY = y - 17;
    const decimalY = y + 15;

    const addToGroup = (node) => {
      group.appendChild(node);
      return node;
    };

    if (labels.secondary) {
      addToGroup(createSmartLabelNode(labels.secondary, x, fractionY, className));
    }

    if (shouldRotateDecimalLabel(value, labels.primary)) {
      addToGroup(createRotatedTextNode(labels.primary, x, decimalY + 18, className));
    } else {
      addToGroup(createSmartLabelNode(labels.primary, x, decimalY, className));
    }

    return group;
  }

  function createTextNode(text, x, y, className) {
    const el = svgEl("text", { x, y, class: className });
    el.textContent = text;
    return el;
  }

  function createRotatedTextNode(text, x, y, className, angle = -90) {
    const el = svgEl("text", {
      x,
      y,
      class: className,
      transform: `rotate(${angle} ${x} ${y})`,
    });
    el.textContent = text;
    return el;
  }

  function createSmartLabelNode(text, x, y, className) {
    if (String(text).includes("\\") || String(text).includes("^")) {
      const fo = svgEl("foreignObject", {
        x: x - 46,
        y: y - 17,
        width: 92,
        height: 34,
      });
      const div = document.createElement("div");
      div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      div.className = className;
      div.style.cssText = [
        "width:100%",
        "height:100%",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "font-size:15px",
        "font-weight:600",
        "line-height:1",
        "white-space:nowrap",
        "color:var(--rm-ink)",
      ].join(";");
      div.textContent = `\\(${text}\\)`;
      fo.appendChild(div);
      return fo;
    }
    return createTextNode(text, x, y, className);
  }

  function shouldRotateDecimalLabel(value, text) {
    if (Math.abs(value - Math.round(value)) < 1e-10) return false;
    return !String(text).includes("\\");
  }

  function renderRecta(svg, config, scale, ticks, host) {
    const axisY = 124;
    const labelStep = usesStableTickGrid(config)
      ? activeTickStep(config, scale)
      : Math.abs(parseNumber(config.step));
    const axisTail = Number(config.colaEje ?? 28);
    const endMarker = svgEl("marker", {
      id: `rm-axis-arrow-end-${Math.random().toString(36).slice(2)}`,
      viewBox: "0 0 10 10",
      markerWidth: 10,
      markerHeight: 10,
      refX: 9,
      refY: 5,
      orient: "auto",
    });
    endMarker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--rm-line)" }));

    const startMarker = svgEl("marker", {
      id: `rm-axis-arrow-start-${Math.random().toString(36).slice(2)}`,
      viewBox: "0 0 10 10",
      markerWidth: 10,
      markerHeight: 10,
      refX: 1,
      refY: 5,
      orient: "auto",
    });
    startMarker.appendChild(svgEl("path", { d: "M 10 0 L 0 5 L 10 10 z", fill: "var(--rm-line)" }));

    svg.querySelector("defs").appendChild(startMarker);
    svg.querySelector("defs").appendChild(endMarker);

    svg.appendChild(svgEl("line", {
      x1: scale.minX - axisTail,
      y1: axisY,
      x2: scale.maxX + axisTail,
      y2: axisY,
      class: "rm-axis",
      stroke: "var(--rm-line)",
      "stroke-width": 3,
      "marker-start": `url(#${startMarker.id})`,
      "marker-end": `url(#${endMarker.id})`,
    }));

    if (config.mostrarTicks !== false) {
      renderSubticks(svg, config, scale, axisY, labelStep);

      ticks.forEach((value) => {
        const x = scale.x(value);
        svg.appendChild(svgEl("line", {
          x1: x,
          y1: axisY - 11,
          x2: x,
          y2: axisY + 11,
          class: "rm-tick",
          stroke: "var(--rm-line)",
          "stroke-width": 2,
        }));
        if (config.mostrarEtiquetas !== false) {
          addNumericLabel(svg, value, config, labelStep, x, axisY + 42, "rm-small-label");
        }
      });
    }

    (config.destacados || []).forEach((item) => {
      const value = parseNumber(item.valor ?? item);
      if (!isInRange(value, scale)) return;
      const x = scale.x(value);
      const color = item.color || "var(--rm-accent)";
      const isSelectable = usesStableTickGrid(config);
      const isSelected = isSelectable && selectedValue(host) !== null && Math.abs(selectedValue(host) - value) < 1e-10;
      svg.appendChild(svgEl("line", {
        x1: x,
        y1: axisY - 54,
        x2: x,
        y2: axisY - 10,
        class: "rm-highlight-stem",
        style: `--rm-current: ${color}`,
      }));
      svg.appendChild(svgEl("circle", {
        cx: x,
        cy: axisY,
        r: item.radio || 7,
        class: [
          "rm-highlight-dot",
          isSelectable ? "rm-highlight-selectable" : "",
          isSelected ? "rm-highlight-selected" : "",
        ].filter(Boolean).join(" "),
        style: `--rm-current: ${color}`,
        tabindex: isSelectable ? 0 : null,
        role: isSelectable ? "button" : null,
        "aria-label": isSelectable ? `Centrar zoom en ${displayText(item, config, config.step)}` : null,
        "data-rectamate-highlight-value": isSelectable ? value : null,
      }));
      addSmartLabel(svg, displayText(item, config, config.step), x, axisY - 72, "rm-highlight-label");
    });

    renderArrows(svg, config, scale, axisY);
  }

  function renderSubticks(svg, config, scale, axisY, activeStep) {
    if (!usesStableTickGrid(config)) return;

    const drawableWidth = scale.maxX - scale.minX;
    const threshold = subtickThreshold(config, drawableWidth);
    const maxLevels = maxSubtickLevels(config);
    let parentStep = activeStep || activeTickStep(config, scale);
    let parentTicks = generateGridTicks(config, scale, parentStep, true);

    for (let level = 1; level <= maxLevels; level += 1) {
      const parentWidth = Math.abs(scale.x(scale.start + parentStep) - scale.x(scale.start));

      if (parentWidth < threshold) break;

      const substep = parentStep / 10;
      const showLabels = parentWidth >= subtickLabelThreshold(config, drawableWidth);
      const childTicks = generateChildTicksFromParents(parentTicks, substep, scale);

      childTicks.forEach((value) => {
        const x = scale.x(value);
        const height = level === 1 ? 6 : Math.max(3, 6 - level);
        svg.appendChild(svgEl("line", {
          x1: x,
          y1: axisY - height,
          x2: x,
          y2: axisY + height,
          class: "rm-subtick",
        }));

        if (showLabels && config.mostrarEtiquetas !== false) {
          addNumericLabel(svg, value, config, substep, x, axisY + 54 + Math.min(level, 3) * 8, "rm-small-label");
        }
      });

      parentStep = substep;
      parentTicks = mergeTicks(parentTicks, childTicks);
    }
  }

  function subtickThreshold(config, drawableWidth) {
    const interaction = getInteraction(config);
    if (interaction.subtickMinPx !== undefined) return Number(interaction.subtickMinPx);
    const fraction = interaction.subtickFraccion !== undefined ? Number(interaction.subtickFraccion) : 0.2;
    return drawableWidth * fraction;
  }

  function subtickLabelThreshold(config, drawableWidth) {
    const interaction = getInteraction(config);
    if (interaction.subtickLabelMinPx !== undefined) return Number(interaction.subtickLabelMinPx);
    const fraction = interaction.subtickLabelFraccion !== undefined ? Number(interaction.subtickLabelFraccion) : 0.6;
    return drawableWidth * fraction;
  }

  function maxSubtickLevels(config) {
    const interaction = getInteraction(config);
    return Math.max(0, Number(interaction.subtickNivelesMax ?? 6));
  }

  function generateGridTicks(config, scale, step, includeOuter = false) {
    const min = Math.min(scale.start, scale.end);
    const max = Math.max(scale.start, scale.end);
    const anchor = config.tickOrigen !== undefined ? parseNumber(config.tickOrigen) : parseNumber(config.__tickOrigin ?? 0);
    const epsilon = step / 100000;
    const outer = includeOuter ? 1 : 0;
    const firstIndex = Math.ceil((min - anchor) / step - epsilon) - outer;
    const lastIndex = Math.floor((max - anchor) / step + epsilon) + outer;
    const ticks = [];

    for (let i = firstIndex; i <= lastIndex; i += 1) {
      ticks.push(Number((anchor + i * step).toFixed(12)));
    }

    return scale.start <= scale.end ? ticks : ticks.reverse();
  }

  function generateChildTicksFromParents(parentTicks, substep, scale) {
    const min = Math.min(scale.start, scale.end);
    const max = Math.max(scale.start, scale.end);
    const epsilon = substep / 100000;
    const values = new Set();

    parentTicks.forEach((parent) => {
      for (let i = 1; i <= 9; i += 1) {
        const value = Number((parent + substep * i).toFixed(12));
        if (value >= min - epsilon && value <= max + epsilon) {
          values.add(value);
        }
      }
    });

    const ticks = Array.from(values).sort((a, b) => a - b);
    return scale.start <= scale.end ? ticks : ticks.reverse();
  }

  function mergeTicks(parentTicks, childTicks) {
    return Array.from(new Set([...parentTicks, ...childTicks])).sort((a, b) => a - b);
  }

  function renderArrows(svg, config, scale, axisY) {
    const arrows = config.flechas || [];
    if (!arrows.length) return;

    const markerId = `rm-arrow-${Math.random().toString(36).slice(2)}`;
    const marker = svgEl("marker", {
      id: markerId,
      markerWidth: 10,
      markerHeight: 10,
      refX: 8,
      refY: 5,
      orient: "auto",
    });
    marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--rm-accent-2)" }));
    svg.querySelector("defs").appendChild(marker);

    arrows.forEach((arrow, index) => {
      const from = parseNumber(arrow.desde);
      const to = parseNumber(arrow.hasta);
      if (!isInRange(from, scale) || !isInRange(to, scale)) return;

      const x1 = scale.x(from);
      const x2 = scale.x(to);
      const distance = Math.abs(x2 - x1);
      const lift = Number(arrow.altura ?? 38 + index * 18);
      const sweepY = axisY - lift;
      const c1x = x1 + (x2 - x1) * 0.28;
      const c2x = x1 + (x2 - x1) * 0.72;
      const d = `M ${x1} ${axisY - 15} C ${c1x} ${sweepY}, ${c2x} ${sweepY}, ${x2} ${axisY - 15}`;

      svg.appendChild(svgEl("path", {
        d,
        class: "rm-arrow-path",
        style: `--rm-current: ${arrow.color || "var(--rm-accent-2)"}`,
        "marker-end": `url(#${markerId})`,
      }));

      if (arrow.etiqueta) {
        addSmartLabel(svg, arrow.etiqueta, (x1 + x2) / 2, sweepY - 12, "rm-arrow-label");
      }

      if (distance > 24) {
        [x1, x2].forEach((x) => {
          svg.appendChild(svgEl("line", {
            x1: x,
            y1: axisY - 2,
            x2: x,
            y2: axisY - 24,
            class: "rm-tick",
            stroke: "var(--rm-accent-2)",
            "stroke-width": 1.5,
          }));
        });
      }
    });
  }

  function renderBarras(svg, config, scale, ticks) {
    const barY = 86;
    const barH = 64;
    const labelY = 180;
    const centerValueY = barY + barH / 2;
    const sections = [];

    for (let i = 0; i < ticks.length - 1; i += 1) {
      sections.push({ from: ticks[i], to: ticks[i + 1], index: i });
    }

    const highlights = (config.destacarSecciones || []).map((section) => ({
      from: section.desde !== undefined ? parseNumber(section.desde) : null,
      to: section.hasta !== undefined ? parseNumber(section.hasta) : null,
      indices: Array.isArray(section.indices) ? section.indices : null,
      etiqueta: section.etiqueta,
    }));

    sections.forEach((section) => {
      const x1 = scale.x(section.from);
      const x2 = scale.x(section.to);
      const selected = highlights.some((highlight) => sectionHighlighted(section, highlight));
      const rect = svgEl("rect", {
        x: Math.min(x1, x2),
        y: barY,
        width: Math.abs(x2 - x1),
        height: barH,
        rx: 0,
        class: selected ? "rm-bar rm-section-highlight" : "rm-bar",
      });
      svg.appendChild(rect);

      if (config.mostrarValorCentro !== false) {
        const label = sectionLabel(section, config);
        addSmartLabel(svg, label, (x1 + x2) / 2, centerValueY, "rm-section-label");
      }
    });

    if (config.mostrarExtremos !== false) {
      ticks.forEach((value) => {
        const x = scale.x(value);
        svg.appendChild(svgEl("line", {
          x1: x,
          y1: barY + barH,
          x2: x,
          y2: barY + barH + 13,
          class: "rm-bar-edge",
          stroke: "var(--rm-line)",
          "stroke-width": 1.5,
        }));
        addNumericLabel(svg, value, config, config.step, x, labelY, "rm-small-label");
      });
    }

    highlights.forEach((highlight) => {
      if (highlight.from === null || highlight.to === null || !highlight.etiqueta) return;
      const x1 = scale.x(highlight.from);
      const x2 = scale.x(highlight.to);
      const y = barY - 18;
      svg.appendChild(svgEl("path", {
        d: `M ${x1} ${y} C ${x1} ${y - 10}, ${x2} ${y - 10}, ${x2} ${y}`,
        class: "rm-section-brace",
      }));
      addSmartLabel(svg, highlight.etiqueta, (x1 + x2) / 2, y - 24, "rm-highlight-label");
    });
  }

  function sectionLabel(section, config) {
    if (config.etiquetaSeccion) return config.etiquetaSeccion;
    const size = Math.abs(section.to - section.from);
    return labelFor(size, config, config.step);
  }

  function sectionHighlighted(section, highlight) {
    if (highlight.indices) return highlight.indices.includes(section.index);
    if (highlight.from === null || highlight.to === null) return false;
    const a = Math.min(highlight.from, highlight.to);
    const b = Math.max(highlight.from, highlight.to);
    const s1 = Math.min(section.from, section.to);
    const s2 = Math.max(section.from, section.to);
    const eps = 1e-9;
    return s1 >= a - eps && s2 <= b + eps;
  }

  function isInRange(value, scale) {
    const min = Math.min(scale.start, scale.end);
    const max = Math.max(scale.start, scale.end);
    return value >= min - 1e-9 && value <= max + 1e-9;
  }

  function createShell(host, config) {
    host.innerHTML = "";
    const shell = document.createElement("div");
    shell.className = `rectamate-shell rectamate-theme-${config.tema || "claro"}`;

    const head = document.createElement("div");
    head.className = "rectamate-head";

    if (config.titulo) {
      const title = document.createElement("h3");
      title.className = "rectamate-title";
      title.textContent = config.titulo;
      head.appendChild(title);
    }

    if (zoomControlsEnabled(config)) {
      const controls = document.createElement("div");
      controls.className = "rectamate-zoom-controls";
      controls.appendChild(createZoomButton("-", "Alejar", "out"));
      controls.appendChild(createZoomButton("+", "Acercar", "in"));
      controls.appendChild(createZoomButton("Reset", "Restablecer zoom", "reset", "rectamate-zoom-reset"));
      head.appendChild(controls);
    }

    if (head.childNodes.length) {
      shell.appendChild(head);
    }

    const stage = document.createElement("div");
    stage.className = "rectamate-stage";
    shell.appendChild(stage);
    host.appendChild(shell);
    return stage;
  }

  function createZoomButton(text, label, action, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `rectamate-zoom-button ${extraClass}`.trim();
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.dataset.rectamateZoom = action;
    return button;
  }

  function render(host, rawConfig) {
    host.rectaMateBaseConfig = cloneConfig(rawConfig || {});
    host.rectaMateVisibleRange = null;
    host.rectaMateSelectedValue = null;
    renderFromState(host);
  }

  function renderFromState(host) {
    const rawConfig = host.rectaMateBaseConfig || {};
    const visibleRange = host.rectaMateVisibleRange || rawConfig.rango || DEFAULTS.rango;
    const originalRange = rawConfig.rango || DEFAULTS.rango;
    const config = {
      ...DEFAULTS,
      ...rawConfig,
      __tickOrigin: originalRange.inicio,
      rango: { ...DEFAULTS.rango, ...visibleRange },
    };
    const width = Number(config.ancho || 900);
    const height = Number(config.altura || (config.modo === "barras" ? 235 : 230));
    const padding = { left: 64, right: 64 };

    const stage = createShell(host, config);
    const svg = svgEl("svg", {
      class: "rectamate-svg",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": accessibleLabel(config),
    });
    svg.appendChild(svgEl("defs"));

    const scale = buildScale(config, width, padding);
    const ticks = generateTicks(config, scale);

    if (config.modo === "barras") {
      renderBarras(svg, config, scale, ticks);
    } else {
      renderRecta(svg, config, scale, ticks, host);
    }

    stage.appendChild(svg);
    host.rectaMateConfig = config;
    attachZoomControls(host, stage, svg, config, scale, padding, width);
    typeset(stage);
  }

  function cloneConfig(config) {
    return JSON.parse(JSON.stringify(config || {}));
  }

  function getInteraction(config) {
    if (config.interaccion === true) return { botonesZoom: true, zoomScroll: true, pan: true };
    return config.interaccion || {};
  }

  function zoomControlsEnabled(config) {
    const interaction = getInteraction(config);
    return Boolean(interaction.botonesZoom || interaction.zoom || interaction.zoomScroll);
  }

  function scrollZoomEnabled(config) {
    const interaction = getInteraction(config);
    return Boolean(interaction.zoomScroll);
  }

  function panEnabled(config) {
    const interaction = getInteraction(config);
    return Boolean(interaction.pan || interaction.arrastrar);
  }

  function attachZoomControls(host, stage, svg, config, scale, padding, width) {
    attachHighlightSelection(host, svg, config);

    if (zoomControlsEnabled(config)) {
      host.querySelectorAll("[data-rectamate-zoom]").forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.rectamateZoom;
          if (action === "reset") {
            host.rectaMateVisibleRange = null;
            host.rectaMateSelectedValue = null;
          } else {
            const factor = action === "in" ? 0.65 : 1.35;
            host.rectaMateVisibleRange = zoomedRange(host, config, factor, selectedValue(host));
          }
          renderFromState(host);
        });
      });
    }

    if (scrollZoomEnabled(config)) {
      stage.addEventListener("wheel", (event) => {
        event.preventDefault();
        const center = selectedValue(host) ?? valueAtPointer(event, svg, scale, padding, width);
        const factor = scrollZoomFactor(config, event.deltaY);
        host.rectaMateVisibleRange = zoomedRange(host, config, factor, center);
        renderFromState(host);
      }, { passive: false });
    }

    if (panEnabled(config)) {
      stage.classList.add("rm-pan-enabled");
      attachPan(host, stage, svg, config, scale, padding, width);
    }
  }

  function attachHighlightSelection(host, svg, config) {
    svg.querySelectorAll("[data-rectamate-highlight-value]").forEach((node) => {
      const select = (event) => {
        event.stopPropagation();
        const value = parseNumber(node.getAttribute("data-rectamate-highlight-value"));
        clearOtherSelections(host);
        host.rectaMateSelectedValue = value;
        host.rectaMateVisibleRange = centeredRange(host, config, value);
        renderFromState(host);
      };

      node.addEventListener("pointerdown", (event) => event.stopPropagation());
      node.addEventListener("click", select);
      node.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select(event);
      });
    });
  }

  function selectedValue(host) {
    return typeof host?.rectaMateSelectedValue === "number" && Number.isFinite(host.rectaMateSelectedValue)
      ? host.rectaMateSelectedValue
      : null;
  }

  function clearOtherSelections(activeHost) {
    document.querySelectorAll("[data-rectamate], .rectamate").forEach((host) => {
      if (host === activeHost || selectedValue(host) === null) return;
      host.rectaMateSelectedValue = null;
      renderFromState(host);
    });
  }

  function centeredRange(host, config, center) {
    const current = config.rango;
    const start = parseNumber(current.inicio);
    const end = parseNumber(current.fin);
    const span = Math.abs(end - start);
    const bounds = panBounds(host, current, config);
    let min = center - span / 2;
    let max = center + span / 2;

    if (span >= bounds.max - bounds.min) {
      min = bounds.min;
      max = bounds.max;
    } else {
      if (min < bounds.min) {
        max += bounds.min - min;
        min = bounds.min;
      }
      if (max > bounds.max) {
        min -= max - bounds.max;
        max = bounds.max;
      }
    }

    return start <= end ? { inicio: min, fin: max } : { inicio: max, fin: min };
  }

  function panBounds(host, range, config) {
    const original = (host.rectaMateBaseConfig && host.rectaMateBaseConfig.rango) || range;
    const interaction = getInteraction(config || {});
    const originalStart = parseNumber(original.inicio);
    const originalEnd = parseNumber(original.fin);
    const originalSpan = Math.abs(originalEnd - originalStart);
    const panMargin = panEnabled(config || {}) || selectedValue(host) !== null
      ? Number(interaction.panMargen ?? 1)
      : 0;
    return {
      min: Math.min(originalStart, originalEnd) - originalSpan * Math.max(0, panMargin),
      max: Math.max(originalStart, originalEnd) + originalSpan * Math.max(0, panMargin),
    };
  }

  function attachPan(host, stage, svg, config, scale, padding, width) {
    stage.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startRange = { inicio: config.rango.inicio, fin: config.rango.fin };
      const rect = svg.getBoundingClientRect();
      const drawableWidth = rect.width * ((width - padding.left - padding.right) / width);
      stage.classList.add("rm-is-panning");
      stage.setPointerCapture(pointerId);

      const move = (moveEvent) => {
        if (pointerId !== moveEvent.pointerId) return;
        const dx = moveEvent.clientX - startX;
        const deltaValue = -(dx / drawableWidth) * Math.abs(parseNumber(startRange.fin) - parseNumber(startRange.inicio));
        host.rectaMateVisibleRange = shiftedRange(host, startRange, deltaValue, config);
        renderFromState(host);
      };

      const stop = (stopEvent) => {
        if (pointerId !== stopEvent.pointerId) return;
        stage.classList.remove("rm-is-panning");
        if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", stop);
        document.removeEventListener("pointercancel", stop);
      };

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop);
      document.addEventListener("pointercancel", stop);
    });
  }

  function valueAtPointer(event, svg, scale, padding, width) {
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const viewX = ratio * width;
    const drawable = width - padding.left - padding.right;
    const clamped = Math.max(0, Math.min(1, (viewX - padding.left) / drawable));
    return scale.start + clamped * scale.span;
  }

  function scrollZoomFactor(config, deltaY) {
    const interaction = getInteraction(config);
    const base = Number(interaction.zoomScrollFactor ?? interaction.factorZoomScroll ?? 1.06);
    const direction = deltaY < 0 ? -1 : 1;
    const notches = Math.min(4, Math.max(1, Math.abs(deltaY) / 100));
    return Math.pow(base, direction * notches);
  }

  function zoomedRange(host, config, factor, centerValue) {
    const current = config.rango;
    const original = (host.rectaMateBaseConfig && host.rectaMateBaseConfig.rango) || current;
    const currentStart = parseNumber(current.inicio);
    const currentEnd = parseNumber(current.fin);
    const originalStart = parseNumber(original.inicio);
    const originalEnd = parseNumber(original.fin);
    const originalMin = Math.min(originalStart, originalEnd);
    const originalMax = Math.max(originalStart, originalEnd);
    const originalSpan = Math.abs(originalEnd - originalStart);
    const currentSpan = Math.abs(currentEnd - currentStart);
    const interaction = getInteraction(config);
    const minSpan = interaction.minSpan !== undefined ? parseNumber(interaction.minSpan) : originalSpan / 10000;
    const maxSpan = interaction.maxSpan !== undefined ? parseNumber(interaction.maxSpan) : originalSpan;
    const newSpan = Math.max(minSpan, Math.min(maxSpan, currentSpan * factor));
    const center = centerValue ?? (currentStart + currentEnd) / 2;
    let min = center - newSpan / 2;
    let max = center + newSpan / 2;

    if (max - min >= originalSpan) {
      min = originalMin;
      max = originalMax;
    } else {
      if (min < originalMin) {
        max += originalMin - min;
        min = originalMin;
      }
      if (max > originalMax) {
        min -= max - originalMax;
        max = originalMax;
      }
    }

    if (originalStart <= originalEnd) return { inicio: min, fin: max };
    return { inicio: max, fin: min };
  }

  function shiftedRange(host, range, delta, config) {
    const original = (host.rectaMateBaseConfig && host.rectaMateBaseConfig.rango) || range;
    const interaction = getInteraction(config || {});
    const start = parseNumber(range.inicio);
    const end = parseNumber(range.fin);
    const originalStart = parseNumber(original.inicio);
    const originalEnd = parseNumber(original.fin);
    const originalSpan = Math.abs(originalEnd - originalStart);
    const panMargin = interaction.panMargen !== undefined ? Number(interaction.panMargen) : 1;
    const originalMin = Math.min(originalStart, originalEnd) - originalSpan * Math.max(0, panMargin);
    const originalMax = Math.max(originalStart, originalEnd) + originalSpan * Math.max(0, panMargin);
    const span = Math.abs(end - start);
    let min = Math.min(start, end) + delta;
    let max = min + span;

    if (span >= originalMax - originalMin) {
      min = originalMin;
      max = originalMax;
    } else {
      if (min < originalMin) {
        max += originalMin - min;
        min = originalMin;
      }
      if (max > originalMax) {
        min -= max - originalMax;
        max = originalMax;
      }
    }

    if (start <= end) return { inicio: min, fin: max };
    return { inicio: max, fin: min };
  }

  function accessibleLabel(config) {
    const parts = [
      config.titulo,
      config.meta?.objetivo,
      config.meta?.contenido,
    ].filter(Boolean);

    if (parts.length) return parts.join(". ");
    return config.modo === "barras" ? "Grafico de secciones de barras" : "Grafico de recta numerica";
  }

  function renderError(host, error) {
    host.innerHTML = "";
    const box = document.createElement("div");
    box.className = "rectamate-error";
    box.textContent = `RectaMate: ${error.message}`;
    host.appendChild(box);
  }

  function readConfig(host) {
    const script = host.querySelector('script[type="application/json"]');
    if (!script) return {};
    return JSON.parse(script.textContent);
  }

  function typeset(root) {
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise([root]).catch(() => {});
    }
    if (window.katex && window.renderMathInElement) {
      window.renderMathInElement(root, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "$", right: "$", display: false },
        ],
      });
    }
  }

  function init(root = document) {
    injectStyles();
    root.querySelectorAll("[data-rectamate], .rectamate").forEach((host) => {
      try {
        render(host, readConfig(host));
      } catch (error) {
        renderError(host, error);
      }
    });
  }

  window.RectaMate = {
    init,
    render,
    parseNumber,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})();
