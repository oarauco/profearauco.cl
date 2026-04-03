(function (window, document) {
  "use strict";

  /* =========================================================
     UTILIDADES DE PARSEO
     ========================================================= */

  function valorValido(v) {
    return v !== undefined && v !== null && v !== "";
  }

  function normalizarTexto(txt) {
    return String(txt == null ? "" : txt)
      .trim()
      .toLowerCase()
      .replace(/[−–—]/g, "-")
      .replace(/,/g, ".")
      .replace(/\s+/g, "");
  }

  function mcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  function parseConstExpr(txt) {
    if (!valorValido(txt)) return NaN;

    const s = normalizarTexto(txt);
    if (!s) return NaN;

    if (s === "infinity" || s === "+infinity" || s === "inf" || s === "+inf") {
      return Infinity;
    }
    if (s === "-infinity" || s === "-inf") {
      return -Infinity;
    }

    if (s === "pi" || s === "+pi" || s === "π" || s === "+π") return Math.PI;
    if (s === "-pi" || s === "-π") return -Math.PI;
    if (s === "e" || s === "+e") return Math.E;
    if (s === "-e") return -Math.E;

    const mConst = s.match(/^([+-]?\d*\.?\d*)\*?(pi|π|e)(?:\/([+-]?\d*\.?\d*))?$/i);
    if (mConst) {
      const a =
        mConst[1] === "" || mConst[1] === "+" || mConst[1] === "-"
          ? (mConst[1] === "-" ? -1 : 1)
          : Number(mConst[1]);

      const c = /pi|π/i.test(mConst[2]) ? Math.PI : Math.E;
      const b = mConst[3] ? Number(mConst[3]) : 1;
      const val = (a * c) / b;
      return Number.isFinite(val) ? val : NaN;
    }

    const mFrac = s.match(/^([+-]?\d*\.?\d+)\/([+-]?\d*\.?\d+)$/);
    if (mFrac) {
      const a = Number(mFrac[1]);
      const b = Number(mFrac[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return NaN;
      return a / b;
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function parseRange(range) {
    if (!Array.isArray(range) || range.length !== 2) {
      return [-5, 5];
    }

    const a = parseConstExpr(range[0]);
    const b = parseConstExpr(range[1]);

    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
      return [-5, 5];
    }

    return a < b ? [a, b] : [b, a];
  }

  function parseStep(raw) {
    const s = normalizarTexto(raw || "1");
    const val = parseConstExpr(s);

    if (!Number.isFinite(val) || val <= 0) {
      return { val: 1, mode: "num", raw: "1", fractionDenominator: 1 };
    }

    let fractionDenominator = null;
    const mFrac = s.match(/^([+-]?\d*\.?\d+)\/([+-]?\d*\.?\d+)$/);
    if (mFrac) {
      const den = Number(mFrac[2]);
      if (Number.isFinite(den) && den > 0) {
        fractionDenominator = den;
      }
    }

    return {
      val,
      mode: s.includes("pi") || s.includes("π")
        ? "pi"
        : s.includes("e")
          ? "e"
          : "num",
      raw: s,
      fractionDenominator: fractionDenominator || 1
    };
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function trimNum(v, p = 6) {
    return Number(v.toFixed(p)).toString().replace(/\.0+$/, "");
  }

  function almostEqual(a, b, eps = 1e-9) {
    return Math.abs(a - b) <= eps;
  }

  function enteroPositivo(v, fallback) {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  }

  function numeroPositivo(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function approxFrac(k) {
    const dens = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
    let best = {
      n: Math.round(k),
      d: 1,
      err: Math.abs(k - Math.round(k))
    };

    for (const d of dens) {
      const n = Math.round(k * d);
      const err = Math.abs(k - n / d);
      if (err < best.err - 1e-10) {
        best = { n, d, err };
      }
    }

    return best;
  }

  function formatMultiple(value, C, symbol) {
    const k = value / C;
    const frac = approxFrac(k);
    const n = frac.n;
    const d = frac.d;

    const sign = n < 0 ? "−" : "";
    const nn = Math.abs(n);

    if (nn === 0) return "0";
    if (d === 1) return nn === 1 ? sign + symbol : sign + nn + symbol;
    return (nn === 1 ? sign + symbol : sign + nn + symbol) + "/" + d;
  }

  function formatFractionWithDenominator(value, denominator) {
    const scaled = Math.round(value * denominator);
    if (!almostEqual(value * denominator, scaled, 1e-7)) {
      return trimNum(value);
    }

    if (scaled === 0) return "0";

    const sign = scaled < 0 ? "−" : "";
    const numAbs = Math.abs(scaled);
    const g = mcd(numAbs, denominator);
    const n = numAbs / g;
    const d = denominator / g;

    if (d === 1) return sign + String(n);
    return sign + n + "/" + d;
  }

  function construirSetEtiquetas(labelValues) {
    if (!Array.isArray(labelValues) || !labelValues.length) return null;

    const valores = labelValues
      .map(parseConstExpr)
      .filter(Number.isFinite);

    return valores.length ? valores : null;
  }

  function debeEtiquetarse(valor, etiquetasPermitidas) {
    if (!etiquetasPermitidas) return true;
    return etiquetasPermitidas.some((v) => almostEqual(v, valor, 1e-8));
  }

  function makeFormatter(cfg) {
    if (cfg.majorStep.mode === "pi") {
      return function (v) {
        return formatMultiple(v, Math.PI, "π");
      };
    }

    if (cfg.majorStep.mode === "e") {
      return function (v) {
        return formatMultiple(v, Math.E, "e");
      };
    }

    const labelMode = cfg.labelMode || "auto";
    const useFraction =
      labelMode === "fraction" ||
      (labelMode === "auto" && cfg.majorStep.raw.includes("/"));

    if (useFraction) {
      const den = Math.max(1, cfg.majorStep.fractionDenominator || 1);
      return function (v) {
        return formatFractionWithDenominator(v, den);
      };
    }

    return function (v) {
      return trimNum(v);
    };
  }

  function compareExtended(a, b) {
    if (a === b) return 0;
    if (a === -Infinity || b === Infinity) return -1;
    if (a === Infinity || b === -Infinity) return 1;
    if (Number.isFinite(a) && Number.isFinite(b) && almostEqual(a, b)) return 0;
    return a < b ? -1 : 1;
  }

  function valorDentroDeRango(v, min, max) {
    if (!Number.isFinite(v)) return false;
    return compareExtended(v, min) >= 0 && compareExtended(v, max) <= 0;
  }

  /* =========================================================
     CANVAS / CONTEXTO
     ========================================================= */

  function obtenerCanvasYContexto(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    return { canvas, ctx };
  }

  function obtenerDimensionesCanvas(canvas) {
    return {
      width: Number(canvas.dataset.logicalWidth) || canvas.width,
      height: Number(canvas.dataset.logicalHeight) || canvas.height,
      dpr: Number(canvas.dataset.dpr) || 1
    };
  }

  function prepararContexto(ctx, canvas) {
    const { dpr } = obtenerDimensionesCanvas(canvas);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* =========================================================
     CONFIG
     ========================================================= */

  function normalizarIntervalo(raw, fallbackColor, index) {
    let from = parseConstExpr(raw?.from);
    let to = parseConstExpr(raw?.to);
    let leftClosed = !!raw?.leftClosed;
    let rightClosed = !!raw?.rightClosed;

    if (Number.isFinite(from) && Number.isFinite(to) && to < from) {
      const tmp = from;
      from = to;
      to = tmp;

      const tmpClosed = leftClosed;
      leftClosed = rightClosed;
      rightClosed = tmpClosed;
    }

    return {
      id: String(raw?.id || `I${index + 1}`),
      from,
      to,
      leftClosed,
      rightClosed,
      color: raw?.color || fallbackColor,
      stroke: raw?.stroke || null,
      lineWidth: numeroPositivo(raw?.lineWidth, 1.2)
    };
  }

  function normalizarTipoSolucion(tipo) {
    const t = normalizarTexto(tipo || "union");

    if (t === "union" || t === "unión" || t === "u" || t === "∪") {
      return "union";
    }

    if (
      t === "intersection" ||
      t === "interseccion" ||
      t === "intersección" ||
      t === "intersect" ||
      t === "i" ||
      t === "∩"
    ) {
      return "intersection";
    }

    return "union";
  }



function normalizarSolucion(raw, style, index) {
  const type = normalizarTipoSolucion(raw?.type);

  const defaultFill =
    type === "intersection"
      ? style.intersectionFill
      : style.unionFill;

  const defaultStroke =
    type === "intersection"
      ? style.intersectionStroke
      : style.unionStroke;

  const defaultPointFill =
    type === "intersection"
      ? style.intersectionPointFill
      : style.unionPointFill;

  const defaultPointStroke =
    type === "intersection"
      ? style.intersectionPointStroke
      : style.unionPointStroke;

  return {
    id: String(raw?.id || `S${index + 1}`),
    type,
    of: Array.isArray(raw?.of) ? raw.of.slice() : [],
    fill: raw?.fill || raw?.color || defaultFill,
    stroke: raw?.stroke || defaultStroke,

    pointClosedFill: raw?.pointClosedFill || raw?.pointColor || defaultPointFill,
    pointOpenFill: raw?.pointOpenFill || "#fff",
    pointStroke: raw?.pointStroke || raw?.pointColor || defaultPointStroke,

    lineWidth: numeroPositivo(raw?.lineWidth, style.solutionLineWidth),
    heightExtra: numeroPositivo(raw?.heightExtra, style.solutionHeightExtra),
    pointRadius: numeroPositivo(raw?.pointRadius, style.solutionPointRadius),
    showEmptyText: raw?.showEmptyText !== false,
    emptyText: String(raw?.emptyText || style.emptySolutionText || "∅")
  };
}





  function normalizarConfig(config = {}) {
    const range = parseRange(config.range || ["-5", "5"]);
    const step = parseStep(config.majorStep || "1");

 



const style = {
  axisColor: "#222",
  tickColor: "#222",
  labelColor: "#222",

  /* intervalos base: naranjo pastel */
  intervalStroke: "rgba(230,145,56,0.55)",
  intervalFill: "rgba(255,183,77,0.30)",

  pointClosedFill: "#000",
  pointOpenFill: "#fff",
  pointStroke: "#000",

  axisWidth: 2,
  majorTickWidth: 2,
  minorTickWidth: 1.2,
  intervalHeight: 30,
  pointRadius: 6,

  /* base */
  layerOffset: 8,
  baseThicknessStep: 12,

 /* solución */
unionFill: "rgba(129,199,132,0.22)",
unionStroke: "rgba(102,187,106,0.38)",
unionPointFill: "#66bb6a",
unionPointStroke: "#66bb6a",

intersectionFill: "rgba(76,175,80,0.28)",
intersectionStroke: "rgba(56,142,60,0.42)",
intersectionPointFill: "#388e3c",
intersectionPointStroke: "#388e3c",

solutionLineWidth: 1.0,
solutionHeightExtra: 14,
solutionPointRadius: 7,
solutionLift: 0,

  emptySolutionText: "∅",
  emptySolutionColor: "#444",
  emptySolutionFont: "16px Arial",

  font: "14px Arial",

  ...(config.style || {})
};









    const intervals = Array.isArray(config.intervals)
      ? config.intervals.map((it, i) => normalizarIntervalo(it, style.intervalFill, i))
      : [];

    const solutions = Array.isArray(config.solutions)
      ? config.solutions.map((sol, i) => normalizarSolucion(sol, style, i))
      : [];

    return {
      range,
      lineMode: ["finite", "infinite", "ray-left", "ray-right"].includes(config.lineMode)
        ? config.lineMode
        : "finite",

      majorStep: step,
      minorDivisions: enteroPositivo(config.minorDivisions, 2),

      labelMode: ["auto", "decimal", "fraction"].includes(config.labelMode)
        ? config.labelMode
        : "auto",

      showMajorTicks: config.showMajorTicks !== false,
      showMinorTicks: config.showMinorTicks !== false,
      showMajorLabels: config.showMajorLabels !== false,
      showMinorLabels: !!config.showMinorLabels,
      showEndLabels: config.showEndLabels !== false,
      hideEndLabelsWhenMajorLabels: config.hideEndLabelsWhenMajorLabels !== false,
      showArrows: config.showArrows !== false,

      labelValues: construirSetEtiquetas(config.labelValues),

      style,
      intervals,
      solutions
    };
  }

  /* =========================================================
     DIBUJO BASE
     ========================================================= */

  function dibujarFlecha(ctx, xDesde, yDesde, xHasta, yHasta, color, lineWidth) {
    const headlen = 10;
    const angle = Math.atan2(yHasta - yDesde, xHasta - xDesde);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xHasta, yHasta);
    ctx.lineTo(
      xHasta - headlen * Math.cos(angle - Math.PI / 6),
      yHasta - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(xHasta, yHasta);
    ctx.lineTo(
      xHasta - headlen * Math.cos(angle + Math.PI / 6),
      yHasta - headlen * Math.sin(angle + Math.PI / 6)
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  function dibujarPuntoIntervalo(ctx, x, y, cerrado, styleOverride = {}) {
    const pointRadius = numeroPositivo(styleOverride.pointRadius, 6);
    const pointClosedFill = styleOverride.pointClosedFill || "#000";
    const pointOpenFill = styleOverride.pointOpenFill || "#fff";
    const pointStroke = styleOverride.pointStroke || "#000";
    const pointLineWidth = numeroPositivo(styleOverride.pointLineWidth, 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, pointRadius, 0, Math.PI * 2);

    ctx.fillStyle = cerrado ? pointClosedFill : pointOpenFill;
    ctx.fill();

    ctx.strokeStyle = pointStroke;
    ctx.lineWidth = pointLineWidth;
    ctx.stroke();
    ctx.restore();
  }




  function dibujarTexto(ctx, texto, x, y, style, align = "center") {
    ctx.save();
    ctx.font = style.font;
    ctx.fillStyle = style.labelColor;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(texto, x, y);
    ctx.restore();
  }

  function dibujarTextoLibre(ctx, texto, x, y, opts = {}) {
    ctx.save();
    ctx.font = opts.font || "14px Arial";
    ctx.fillStyle = opts.color || "#222";
    ctx.textAlign = opts.align || "center";
    ctx.textBaseline = opts.baseline || "middle";
    ctx.fillText(texto, x, y);
    ctx.restore();
  }


function dibujarBanda(ctx, x1, x2, yBottom, bandHeight, opts = {}) {
  if (!(Number.isFinite(x1) && Number.isFinite(x2) && Number.isFinite(yBottom) && Number.isFinite(bandHeight))) {
    return;
  }

  if (x2 < x1) {
    const tmp = x1;
    x1 = x2;
    x2 = tmp;
  }

  if (almostEqual(x1, x2, 1e-9)) return;

  const yTop = yBottom - bandHeight;
  const omitLeftBorder = !!opts.omitLeftBorder;
  const omitRightBorder = !!opts.omitRightBorder;

  ctx.save();

  ctx.fillStyle = opts.fill || "rgba(0,0,0,0.15)";
  ctx.fillRect(x1, yTop, x2 - x1, bandHeight);

  ctx.strokeStyle = opts.stroke || "#000";
  ctx.lineWidth = numeroPositivo(opts.lineWidth, 1.2);

  ctx.beginPath();

  if (!omitLeftBorder) {
    ctx.moveTo(x1, yBottom);
    ctx.lineTo(x1, yTop);
  }

  ctx.moveTo(x1, yTop);
  ctx.lineTo(x2, yTop);

  if (!omitRightBorder) {
    ctx.moveTo(x2, yTop);
    ctx.lineTo(x2, yBottom);
  }

  ctx.moveTo(x1, yBottom);
  ctx.lineTo(x2, yBottom);

  ctx.stroke();
  ctx.restore();
}








  function generarTicks(min, max, step) {
    const out = [];
    if (!Number.isFinite(step) || step <= 0) return out;

    const start = Math.ceil((min - 1e-12) / step) * step;

    for (let v = start; v <= max + 1e-12; v += step) {
      const vv = Math.abs(v) < 1e-12 ? 0 : v;
      out.push(vv);
    }

    return out;
  }

  function esMajorTick(v, majorStep) {
    const q = v / majorStep;
    return almostEqual(q, Math.round(q), 1e-8);
  }

  /* =========================================================
     LÓGICA DE INTERVALOS
     ========================================================= */

  function intervaloASegmento(it) {
    const fromValido = Number.isFinite(it.from) || it.from === -Infinity;
    const toValido = Number.isFinite(it.to) || it.to === Infinity;

    if (!fromValido || !toValido) return null;

    let from = it.from;
    let to = it.to;
    let leftClosed = !!it.leftClosed;
    let rightClosed = !!it.rightClosed;

    if (compareExtended(from, to) > 0) {
      const tmp = from;
      from = to;
      to = tmp;

      const tmpClosed = leftClosed;
      leftClosed = rightClosed;
      rightClosed = tmpClosed;
    }

    return {
      from,
      to,
      leftClosed,
      rightClosed
    };
  }

  function resolverReferenciasIntervalos(refs, intervals) {
    if (!Array.isArray(refs) || refs.length === 0) {
      return intervals.slice();
    }

    const usados = [];

    refs.forEach((ref) => {
      let encontrado = null;

      if (typeof ref === "number" && Number.isInteger(ref)) {
        encontrado = intervals[ref] || intervals[ref - 1] || null;
      } else {
        const key = String(ref);
        encontrado = intervals.find((it) => it.id === key) || null;
      }

      if (encontrado) usados.push(encontrado);
    });

    return usados;
  }

  function unirSegmentos(segmentos) {
    if (!segmentos.length) return [];

    const ordenados = segmentos
      .slice()
      .sort((a, b) => {
        const c = compareExtended(a.from, b.from);
        if (c !== 0) return c;

        if (a.leftClosed !== b.leftClosed) return a.leftClosed ? -1 : 1;

        const c2 = compareExtended(a.to, b.to);
        if (c2 !== 0) return c2;

        if (a.rightClosed !== b.rightClosed) return a.rightClosed ? -1 : 1;
        return 0;
      });

    const out = [];
    let actual = { ...ordenados[0] };

    for (let i = 1; i < ordenados.length; i += 1) {
      const seg = ordenados[i];
      const cmpInicioConFinActual = compareExtended(seg.from, actual.to);

      const seUnen =
        cmpInicioConFinActual < 0 ||
        (cmpInicioConFinActual === 0 && (actual.rightClosed || seg.leftClosed));

      if (!seUnen) {
        out.push(actual);
        actual = { ...seg };
        continue;
      }

      if (compareExtended(seg.from, actual.from) === 0) {
        actual.leftClosed = actual.leftClosed || seg.leftClosed;
      }

      const cmpFin = compareExtended(seg.to, actual.to);
      if (cmpFin > 0) {
        actual.to = seg.to;
        actual.rightClosed = seg.rightClosed;
      } else if (cmpFin === 0) {
        actual.rightClosed = actual.rightClosed || seg.rightClosed;
      }
    }

    out.push(actual);
    return out;
  }

  function intersectarSegmentos(segmentos) {
    if (!segmentos.length) return [];

    let actual = { ...segmentos[0] };

    for (let i = 1; i < segmentos.length; i += 1) {
      const seg = segmentos[i];

      const cmpInicio = compareExtended(seg.from, actual.from);
      if (cmpInicio > 0) {
        actual.from = seg.from;
        actual.leftClosed = seg.leftClosed;
      } else if (cmpInicio === 0) {
        actual.leftClosed = actual.leftClosed && seg.leftClosed;
      }

      const cmpFin = compareExtended(seg.to, actual.to);
      if (cmpFin < 0) {
        actual.to = seg.to;
        actual.rightClosed = seg.rightClosed;
      } else if (cmpFin === 0) {
        actual.rightClosed = actual.rightClosed && seg.rightClosed;
      }

      const cmp = compareExtended(actual.from, actual.to);
      if (cmp > 0) return [];
      if (cmp === 0 && !(actual.leftClosed && actual.rightClosed)) return [];
    }

    return [actual];
  }

  function resolverSolucion(solucion, intervals) {
    const seleccionados = resolverReferenciasIntervalos(solucion.of, intervals);
    const segmentos = seleccionados
      .map(intervaloASegmento)
      .filter(Boolean);

    if (!segmentos.length) return [];

    if (solucion.type === "intersection") {
      return intersectarSegmentos(segmentos);
    }

    return unirSegmentos(segmentos);
  }

function clampedSegmentForDrawing(seg, rangeMin, rangeMax) {
  if (!seg) return null;

  if (compareExtended(seg.to, rangeMin) < 0) return null;
  if (compareExtended(seg.from, rangeMax) > 0) return null;

  if (compareExtended(seg.to, rangeMin) === 0 && !seg.rightClosed) return null;
  if (compareExtended(seg.from, rangeMax) === 0 && !seg.leftClosed) return null;

  const clippedLeft = compareExtended(seg.from, rangeMin) < 0;
  const clippedRight = compareExtended(seg.to, rangeMax) > 0;

  const drawFrom = seg.from === -Infinity ? rangeMin : clamp(seg.from, rangeMin, rangeMax);
  const drawTo = seg.to === Infinity ? rangeMax : clamp(seg.to, rangeMin, rangeMax);

  if (compareExtended(drawFrom, drawTo) > 0) return null;

  return {
    ...seg,
    drawFrom,
    drawTo,
    clippedLeft,
    clippedRight
  };
}

  /* =========================================================
     MOTOR PRINCIPAL
     ========================================================= */

  function crearRectaIntervalos(canvasId, config = {}) {
    const data = obtenerCanvasYContexto(canvasId);
    if (!data) return false;

    const { canvas, ctx } = data;
    const cfg = normalizarConfig(config);
    const { width, height } = obtenerDimensionesCanvas(canvas);

    prepararContexto(ctx, canvas);

    const style = cfg.style;
    const rangeMin = cfg.range[0];
    const rangeMax = cfg.range[1];

    const padLeft = 42;
    const padRight = 42;
    const padBottom = 38;

    const usableX0 = padLeft;
    const usableX1 = width - padRight;
    const usableW = usableX1 - usableX0;

    const baseCount = cfg.intervals.length;
const solutionCount = cfg.solutions.length;



const baseThicknessStep = numeroPositivo(
  style.baseThicknessStep,
  numeroPositivo(style.layerOffset, 8)
);

const maxBaseExtra = Math.max(0, baseCount - 1) * baseThicknessStep;
const maxBaseHeight = style.intervalHeight + maxBaseExtra;

const solutionHeightBase = style.intervalHeight + style.solutionHeightExtra;

const neededTopBase = maxBaseHeight;
const neededTopSolutions =
  solutionCount > 0
    ? maxBaseHeight + style.solutionLift + solutionHeightBase
    : 0;








    const neededTop = Math.max(neededTopBase, neededTopSolutions);
    const axisYPreferido = Math.round(height * 0.72);
    const axisYMin = neededTop + 18;
    const axisYMax = height - padBottom - 16;

    let axisY = axisYPreferido;
    if (axisY < axisYMin) axisY = axisYMin;
    if (axisY > axisYMax) axisY = axisYMax;

    function xToPx(x) {
      return usableX0 + ((x - rangeMin) / (rangeMax - rangeMin)) * usableW;
    }

    function pxInRange(px) {
      return px >= usableX0 - 1e-9 && px <= usableX1 + 1e-9;
    }

    const majorStepVal = cfg.majorStep.val;
    const minorStepVal = majorStepVal / cfg.minorDivisions;
    const formatter = makeFormatter(cfg);

    const majorTicks = generarTicks(rangeMin, rangeMax, majorStepVal);
    const minorTicks = generarTicks(rangeMin, rangeMax, minorStepVal);

    /* -------------------------
       Intervalos base escalonados
       ------------------------- */


cfg.intervals.forEach((it, index) => {
  const seg = intervaloASegmento(it);
  if (!seg) return;

  const drawSeg = clampedSegmentForDrawing(seg, rangeMin, rangeMax);
  if (!drawSeg) return;

  /* todos pegados a la recta original */
  const yBottom = axisY;

  /* los intervalos anteriores crecen hacia arriba */
  const extraHeight = (baseCount - 1 - index) * baseThicknessStep;
  const bandHeight = style.intervalHeight + extraHeight;

  const x1 = xToPx(drawSeg.drawFrom);
  const x2 = xToPx(drawSeg.drawTo);

  if (!almostEqual(x1, x2, 1e-9)) {
  dibujarBanda(ctx, x1, x2, yBottom, bandHeight, {
  fill: it.color || style.intervalFill,
  stroke: it.stroke || style.intervalStroke,
  lineWidth: it.lineWidth,
  omitLeftBorder: drawSeg.clippedLeft,
  omitRightBorder: drawSeg.clippedRight
});
  }

  if (Number.isFinite(seg.from) && valorDentroDeRango(seg.from, rangeMin, rangeMax)) {
    dibujarPuntoIntervalo(ctx, xToPx(seg.from), yBottom, seg.leftClosed, {
      pointRadius: style.pointRadius,
      pointClosedFill: style.pointClosedFill,
      pointOpenFill: style.pointOpenFill,
      pointStroke: it.stroke || style.pointStroke,
      pointLineWidth: 2
    });
  }

  if (Number.isFinite(seg.to) && valorDentroDeRango(seg.to, rangeMin, rangeMax)) {
    dibujarPuntoIntervalo(ctx, xToPx(seg.to), yBottom, seg.rightClosed, {
      pointRadius: style.pointRadius,
      pointClosedFill: style.pointClosedFill,
      pointOpenFill: style.pointOpenFill,
      pointStroke: it.stroke || style.pointStroke,
      pointLineWidth: 2
    });
  }
});









    /* -------------------------
       Capas de solución
       ------------------------- */

cfg.solutions.forEach((sol) => {
  const segmentos = resolverSolucion(sol, cfg.intervals);

  const solutionBottom = axisY;
const solutionHeight = Math.max(
  style.intervalHeight + sol.heightExtra,
  maxBaseHeight + 12
);
  const solutionTop = solutionBottom - solutionHeight;

if (!segmentos.length) {
  if (sol.type === "intersection" && sol.showEmptyText) {
    dibujarTextoLibre(
      ctx,
      sol.emptyText,
      (usableX0 + usableX1) / 2,
      solutionTop + solutionHeight / 2,
      {
        font: style.emptySolutionFont,
        color: sol.pointStroke || style.intersectionPointStroke || style.emptySolutionColor,
        align: "center",
        baseline: "middle"
      }
    );
  }
  return;
}

  segmentos.forEach((seg) => {
    const drawSeg = clampedSegmentForDrawing(seg, rangeMin, rangeMax);
    if (!drawSeg) return;

    const x1 = xToPx(drawSeg.drawFrom);
    const x2 = xToPx(drawSeg.drawTo);

    if (!almostEqual(x1, x2, 1e-9)) {
      dibujarBanda(ctx, x1, x2, solutionBottom, solutionHeight, {
        fill: sol.fill,
        stroke: sol.stroke,
        lineWidth: sol.lineWidth,
        omitLeftBorder: drawSeg.clippedLeft,
        omitRightBorder: drawSeg.clippedRight
      });
    }

    if (Number.isFinite(seg.from) && valorDentroDeRango(seg.from, rangeMin, rangeMax)) {
      dibujarPuntoIntervalo(ctx, xToPx(seg.from), solutionTop, seg.leftClosed, {
        pointRadius: sol.pointRadius,
        pointClosedFill: sol.pointClosedFill,
        pointOpenFill: sol.pointOpenFill,
        pointStroke: sol.pointStroke,
        pointLineWidth: 2
      });
    }

    if (Number.isFinite(seg.to) && valorDentroDeRango(seg.to, rangeMin, rangeMax)) {
      dibujarPuntoIntervalo(ctx, xToPx(seg.to), solutionTop, seg.rightClosed, {
        pointRadius: sol.pointRadius,
        pointClosedFill: sol.pointClosedFill,
        pointOpenFill: sol.pointOpenFill,
        pointStroke: sol.pointStroke,
        pointLineWidth: 2
      });
    }
  });
});







    /* -------------------------
       Recta base
       ------------------------- */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(usableX0, axisY);
    ctx.lineTo(usableX1, axisY);
    ctx.strokeStyle = style.axisColor;
    ctx.lineWidth = style.axisWidth;
    ctx.stroke();
    ctx.restore();

    if (cfg.showArrows) {
      if (cfg.lineMode === "infinite" || cfg.lineMode === "ray-left") {
        dibujarFlecha(ctx, usableX0 + 16, axisY, usableX0, axisY, style.axisColor, style.axisWidth);
      }
      if (cfg.lineMode === "infinite" || cfg.lineMode === "ray-right") {
        dibujarFlecha(ctx, usableX1 - 16, axisY, usableX1, axisY, style.axisColor, style.axisWidth);
      }
    }

    /* -------------------------
       Ticks y etiquetas menores
       ------------------------- */
    if (cfg.showMinorTicks || cfg.showMinorLabels) {
      minorTicks.forEach((v) => {
        if (esMajorTick(v, majorStepVal)) return;

        const x = xToPx(v);
        if (!pxInRange(x)) return;

        if (cfg.showMinorTicks) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, axisY - 5);
          ctx.lineTo(x, axisY + 5);
          ctx.strokeStyle = style.tickColor;
          ctx.lineWidth = style.minorTickWidth;
          ctx.stroke();
          ctx.restore();
        }

        if (cfg.showMinorLabels && debeEtiquetarse(v, cfg.labelValues)) {
          dibujarTexto(ctx, formatter(v), x, axisY + 10, style);
        }
      });
    }

    /* -------------------------
       Ticks y etiquetas mayores
       ------------------------- */
    if (cfg.showMajorTicks || cfg.showMajorLabels) {
      majorTicks.forEach((v) => {
        const x = xToPx(v);
        if (!pxInRange(x)) return;

        if (cfg.showMajorTicks) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, axisY - 9);
          ctx.lineTo(x, axisY + 9);
          ctx.strokeStyle = style.tickColor;
          ctx.lineWidth = style.majorTickWidth;
          ctx.stroke();
          ctx.restore();
        }

        if (cfg.showMajorLabels && debeEtiquetarse(v, cfg.labelValues)) {
          dibujarTexto(ctx, formatter(v), x, axisY + 12, style);
        }
      });
    }

    /* -------------------------
       Etiquetas de extremos
       ------------------------- */
    if (cfg.showEndLabels) {
      const extremoIzquierdoCoincide =
        cfg.hideEndLabelsWhenMajorLabels &&
        cfg.showMajorLabels &&
        esMajorTick(rangeMin, majorStepVal) &&
        debeEtiquetarse(rangeMin, cfg.labelValues);

      const extremoDerechoCoincide =
        cfg.hideEndLabelsWhenMajorLabels &&
        cfg.showMajorLabels &&
        esMajorTick(rangeMax, majorStepVal) &&
        debeEtiquetarse(rangeMax, cfg.labelValues);

      if (!extremoIzquierdoCoincide) {
        dibujarTexto(ctx, formatter(rangeMin), usableX0, axisY + 12, style, "left");
      }

      if (!extremoDerechoCoincide) {
        dibujarTexto(ctx, formatter(rangeMax), usableX1, axisY + 12, style, "right");
      }
    }

    return true;
  }

  function crearRectaSimple(canvasId, config = {}) {
    return crearRectaIntervalos(canvasId, {
      ...config,
      intervals: Array.isArray(config.intervals) ? config.intervals : [],
      solutions: Array.isArray(config.solutions) ? config.solutions : []
    });
  }

  /* =========================================================
     API PÚBLICA
     ========================================================= */

  const api = Object.freeze({
    parseConstExpr,
    parseRange,
    parseStep,
    normalizarConfig,
    crearRectaIntervalos,
    crearRectaSimple
  });

  window.RectaIntervalos = Object.assign({}, window.RectaIntervalos || {}, api);
})(window, document);
