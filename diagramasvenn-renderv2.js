(function (window, document) {
  "use strict";

  let contadorAutoCanvas = 0;

  const COLORES = {
    bordeUniverso: "#adb5bd",
    fondoUniverso: "#f8f9fa",
    texto: "#212529",
    textoSuave: "#6c757d",
    card: "rgba(152, 117, 167, 0.64)",
    A: "#d86b6b",
    B: "#72ad68",
    C: "#6e9ed8",
    AFill: "rgba(216, 107, 107, 0.03)",
    BFill: "rgba(114, 173, 104, 0.03)",
    CFill: "rgba(110, 158, 216, 0.03)",
  };

  const PALETA_REGIONES = {
    dos: {
      A_only: "rgba(244, 199, 199, 0.65)",
      B_only: "rgba(210, 234, 201, 0.65)",
      AB: "rgba(251, 240, 186, 0.78)",
      OUT: "rgba(255,255,255,0)",
    },
    tres: {
      A_only: "rgba(244, 199, 199, 0.65)",
      B_only: "rgba(210, 234, 201, 0.65)",
      C_only: "rgba(205, 225, 248, 0.65)",
      AB_only: "rgba(251, 240, 186, 0.78)",
      AC_only: "rgba(235, 212, 240, 0.78)",
      BC_only: "rgba(209, 239, 239, 0.78)",
      ABC: "rgba(204, 182, 170, 0.82)",
      OUT: "rgba(255,255,255,0)",
    },
  };

  const __oaConjuntosCanvasState = new WeakMap();
  let __oaDragGlobalInstalado = false;
  let __oaDragActivo = null;

  function obtenerDimensionesCanvas(canvas) {
    return {
      width: Number(canvas.dataset.logicalWidth) || canvas.width,
      height: Number(canvas.dataset.logicalHeight) || canvas.height,
      dpr: Number(canvas.dataset.dpr) || 1,
    };
  }

  function posCanvasDesdeEvento(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const { width, height } = obtenerDimensionesCanvas(canvas);

    return {
      x: ((evt.clientX - rect.left) * width) / rect.width,
      y: ((evt.clientY - rect.top) * height) / rect.height,
    };
  }

  function hitBox(p, box) {
    return (
      p.x >= box.x &&
      p.x <= box.x + box.w &&
      p.y >= box.y &&
      p.y <= box.y + box.h
    );
  }

  function prepararContexto(ctx, canvas) {
    const { dpr } = obtenerDimensionesCanvas(canvas);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cajasSeSuperponen(a, b) {
    return !(
      a.x + a.w <= b.x ||
      b.x + b.w <= a.x ||
      a.y + a.h <= b.y ||
      b.y + b.h <= a.y
    );
  }

  function ajustarTextoConElipsis(ctx, texto, maxWidth) {
    const original = String(texto);
    if (ctx.measureText(original).width <= maxWidth) return original;

    let t = original;
    const elipsis = "…";

    while (t.length > 1 && ctx.measureText(t + elipsis).width > maxWidth) {
      t = t.slice(0, -1);
    }

    return t + elipsis;
  }

  function asegurarListenersGlobalesArrastre() {
    if (__oaDragGlobalInstalado) return;
    __oaDragGlobalInstalado = true;

    window.addEventListener("mousemove", (evt) => {
      if (!__oaDragActivo) return;

      const { canvas, st, clave, startX, startY, baseDX, baseDY } = __oaDragActivo;

      if (!canvas || !canvas.isConnected) {
        __oaDragActivo = null;
        return;
      }

      const p = posCanvasDesdeEvento(canvas, evt);

      if (!st.cardOffsets) st.cardOffsets = {};

      st.cardOffsets[clave] = {
        dx: baseDX + (p.x - startX),
        dy: baseDY + (p.y - startY),
      };

      if (typeof st.redraw === "function") st.redraw();
    });

    window.addEventListener("mouseup", () => {
      if (!__oaDragActivo) return;

      const { canvas } = __oaDragActivo;
      __oaDragActivo = null;

      if (canvas && canvas.isConnected) {
        canvas.style.cursor = "default";
      }
    });
  }

  function obtenerEstadoCanvas(canvas) {
    let st = __oaConjuntosCanvasState.get(canvas);

    if (!st) {
      st = {
        cardOffsets: {},
        cardBoxes: {},
        elementBoxes: {},
        drag: null,
        redraw: null,
        _installed: false,
      };
      __oaConjuntosCanvasState.set(canvas, st);
    }

    if (!st.elementBoxes) st.elementBoxes = {};
    if (!st.cardBoxes) st.cardBoxes = {};
    if (!st.cardOffsets) st.cardOffsets = {};

    if (!st._installed) instalarArrastreCardinalidad(canvas, st);

    return st;
  }

  function instalarArrastreCardinalidad(canvas, st) {
    st._installed = true;
    asegurarListenersGlobalesArrastre();

    canvas.addEventListener("mousedown", (evt) => {
      const p = posCanvasDesdeEvento(canvas, evt);

      for (const [clave, box] of Object.entries(st.cardBoxes || {})) {
        if (hitBox(p, box)) {
          const off = st.cardOffsets[clave] || { dx: 0, dy: 0 };

          __oaDragActivo = {
            canvas,
            st,
            clave,
            startX: p.x,
            startY: p.y,
            baseDX: off.dx,
            baseDY: off.dy,
          };

          canvas.style.cursor = "grabbing";
          evt.preventDefault();
          return;
        }
      }
    });

    canvas.addEventListener("mousemove", (evt) => {
      const p = posCanvasDesdeEvento(canvas, evt);
      const encima = Object.values(st.cardBoxes || {}).some((box) => hitBox(p, box));
      const arrastrando = __oaDragActivo && __oaDragActivo.canvas === canvas;

      canvas.style.cursor = arrastrando ? "grabbing" : encima ? "grab" : "default";
    });

    canvas.addEventListener("mouseleave", () => {
      if (!__oaDragActivo || __oaDragActivo.canvas !== canvas) {
        canvas.style.cursor = "default";
      }
    });
  }

  function valorValido(v) {
    return v !== undefined && v !== null && v !== "";
  }

  function aTexto(v) {
    return String(v);
  }

  function limpiarLista(lista) {
    return [...new Set((lista || []).filter(valorValido).map(aTexto))];
  }

  function normalizarToken(v) {
    return String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function leerNumero(el, nombre, fallback) {
    const raw = el.getAttribute(nombre);
    if (raw === null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function parsearJSONDeAtributo(el, nombre, fallback = {}) {
    const raw = el.getAttribute(nombre);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error(`Error al parsear ${nombre} en`, el, error);
      return fallback;
    }
  }

  function asegurarCanvas(contenedor, width, height) {
    let canvas = contenedor.querySelector("canvas.oa-conjuntos-auto-canvas");

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "oa-conjuntos-auto-canvas";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    canvas.dataset.logicalWidth = String(width);
    canvas.dataset.logicalHeight = String(height);
    canvas.dataset.dpr = String(dpr);

    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.maxWidth = `${width}px`;
    canvas.style.height = "auto";
    canvas.style.aspectRatio = `${width} / ${height}`;
    canvas.style.margin = "0 auto";

    if (!canvas.id) {
      const base = contenedor.id
        ? `${contenedor.id}__canvas`
        : `oa_conjuntos_canvas_${++contadorAutoCanvas}`;
      canvas.id = base;
    }

    return canvas;
  }

  function pathCirculo(x, y, r) {
    const p = new Path2D();
    p.arc(x, y, r, 0, Math.PI * 2);
    return p;
  }

  function pathRect(x, y, w, h) {
    const p = new Path2D();
    p.rect(x, y, w, h);
    return p;
  }

  function centroRect(rect) {
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }

  function setDesdeLista(lista) {
    return new Set(limpiarLista(lista));
  }

  function unirListas(...listas) {
    return limpiarLista(listas.flat());
  }

  function filtrarSegunReferencia(referencia, predicado) {
    return (referencia || []).filter(predicado).map(aTexto);
  }

  function redondeado(ctx, x, y, w, h, r = 6) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function cajaCentrada(cx, cy, w, h) {
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  function cajaUtil(box) {
    return !!box && box.w > 8 && box.h > 8;
  }

  function colorCardinalidadPorRegion(clave) {
    const mapa = {
      A_only: "rgb(200, 55, 55)",
      B_only: "rgb(40, 145, 55)",
      AB: "rgb(185, 145, 0)",
      C_only: "rgb(55, 110, 210)",
      AB_only: "rgb(185, 145, 0)",
      AC_only: "rgb(170, 60, 170)",
      BC_only: "rgb(0, 145, 155)",
      ABC: "rgb(120, 95, 35)",
      OUT: "rgb(110, 110, 110)",
    };

    return mapa[clave] || "rgb(123, 31, 162)";
  }

  function dist2(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
  }

  function puntoDentroCirculo(x, y, circulo, margen = 5) {
    const r = Math.max(0, circulo.r - margen);
    return dist2(x, y, circulo.x, circulo.y) <= r * r;
  }

  function puntoFueraCirculo(x, y, circulo, margen = 5) {
    const r = circulo.r + margen;
    return dist2(x, y, circulo.x, circulo.y) >= r * r;
  }

  function obtenerPredicadoRegion(escena, clave, margen = 5) {
    const tieneC = !!escena.C;

    return function (x, y) {
      const inA = puntoDentroCirculo(x, y, escena.A, margen);
      const outA = puntoFueraCirculo(x, y, escena.A, margen);

      const inB = puntoDentroCirculo(x, y, escena.B, margen);
      const outB = puntoFueraCirculo(x, y, escena.B, margen);

      const inC = tieneC ? puntoDentroCirculo(x, y, escena.C, margen) : false;
      const outC = tieneC ? puntoFueraCirculo(x, y, escena.C, margen) : true;

      switch (clave) {
        case "A_only":
          return inA && outB && outC;
        case "B_only":
          return inB && outA && outC;
        case "C_only":
          return inC && outA && outB;
        case "AB":
          return inA && inB;
        case "AB_only":
          return inA && inB && outC;
        case "AC_only":
          return inA && inC && outB;
        case "BC_only":
          return inB && inC && outA;
        case "ABC":
          return inA && inB && inC;
        case "OUT":
          return outA && outB && outC;
        default:
          return false;
      }
    };
  }

  function rectCabeEnRegion(cx, cy, w, h, predicado) {
    const puntos = [
      [cx, cy],
      [cx - w / 2, cy - h / 2],
      [cx + w / 2, cy - h / 2],
      [cx - w / 2, cy + h / 2],
      [cx + w / 2, cy + h / 2],
      [cx, cy - h / 2],
      [cx, cy + h / 2],
      [cx - w / 2, cy],
      [cx + w / 2, cy],
    ];

    return puntos.every(([x, y]) => predicado(x, y));
  }

  function seSuperponeSlot(cx, cy, w, h, usados) {
    return usados.some((u) => {
      return (
        Math.abs(cx - u.x) < (w + u.w) / 2 &&
        Math.abs(cy - u.y) < (h + u.h) / 2
      );
    });
  }

  function obtenerAreaBusquedaRegion(escena, clave) {
    const pad = 10;

    if (clave === "OUT") {
      return {
        x0: escena.rect.x + pad,
        y0: escena.rect.y + pad,
        x1: escena.rect.x + escena.rect.w - pad,
        y1: escena.rect.y + escena.rect.h - pad,
      };
    }

    const circulos = [];
    if (["A_only", "AB", "AB_only", "AC_only", "ABC"].includes(clave)) circulos.push(escena.A);
    if (["B_only", "AB", "AB_only", "BC_only", "ABC"].includes(clave)) circulos.push(escena.B);
    if (escena.C && ["C_only", "AC_only", "BC_only", "ABC"].includes(clave)) circulos.push(escena.C);

    if (!circulos.length) {
      return {
        x0: escena.rect.x + pad,
        y0: escena.rect.y + pad,
        x1: escena.rect.x + escena.rect.w - pad,
        y1: escena.rect.y + escena.rect.h - pad,
      };
    }

    return {
      x0: Math.max(escena.rect.x + pad, Math.min(...circulos.map((c) => c.x - c.r)) - pad),
      y0: Math.max(escena.rect.y + pad, Math.min(...circulos.map((c) => c.y - c.r)) - pad),
      x1: Math.min(escena.rect.x + escena.rect.w - pad, Math.max(...circulos.map((c) => c.x + c.r)) + pad),
      y1: Math.min(escena.rect.y + escena.rect.h - pad, Math.max(...circulos.map((c) => c.y + c.r)) + pad),
    };
  }

  function radioAdaptativoPorCantidad(n, opciones = {}) {
    const minR = opciones.minR || 76;
    const maxR = opciones.maxR || 148;
    const base = opciones.base || 60;
    const factor = opciones.factor || 18;
    const r = base + factor * Math.ceil(Math.sqrt(Math.max(1, n)));
    return Math.max(minR, Math.min(maxR, r));
  }

  function resolverGridParaCaja(n, w, h, gapX = 6, gapY = 6) {
    const colsBase = Math.ceil(Math.sqrt(Math.max(1, n)));
    let cols = colsBase;
    let rows = Math.ceil(n / cols);
    while (cols > 1) {
      const cellW = (w - gapX * (cols - 1)) / cols;
      const cellH = (h - gapY * (rows - 1)) / rows;
      if (cellW >= 10 && cellH >= 12) break;
      cols -= 1;
      rows = Math.ceil(n / cols);
    }
    return { cols, rows };
  }

  function clamp(valor, min, max) {
    return Math.max(min, Math.min(max, valor));
  }

  function estimarCajaRegion(n, opciones = {}) {
    if (!n || n <= 0) {
      return { cols: 0, rows: 0, w: 0, h: 0 };
    }

    const stepX = opciones.stepX ?? 18;
    const stepY = opciones.stepY ?? 22;
    const gapX = opciones.gapX ?? 10;
    const gapY = opciones.gapY ?? 10;
    const padX = opciones.padX ?? 10;
    const padY = opciones.padY ?? 8;

    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);

    return {
      cols,
      rows,
      w: cols * stepX + (cols - 1) * gapX + 2 * padX,
      h: rows * stepY + (rows - 1) * gapY + 2 * padY,
    };
  }

  function ajustarLadosTriangulo(a, b, c) {
    const eps = 4;

    if (a + b <= c) c = a + b - eps;
    if (a + c <= b) b = a + c - eps;
    if (b + c <= a) a = b + c - eps;

    return [a, b, c];
  }

  function puntoMedio(p, q) {
    return {
      x: (p.x + q.x) / 2,
      y: (p.y + q.y) / 2,
    };
  }

  function alejarDesde(puntoBase, puntoReferencia, distancia) {
    const dx = puntoBase.x - puntoReferencia.x;
    const dy = puntoBase.y - puntoReferencia.y;
    const norma = Math.hypot(dx, dy) || 1;

    return {
      x: puntoBase.x + (dx / norma) * distancia,
      y: puntoBase.y + (dy / norma) * distancia,
    };
  }

  function dibujarUniverso(ctx, rect, nombre = "U") {
    ctx.save();
    ctx.fillStyle = COLORES.fondoUniverso;
    ctx.strokeStyle = COLORES.bordeUniverso;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORES.texto;
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(nombre, rect.x + 10, rect.y - 8);
    ctx.restore();
  }

  function dibujarCirculoConjunto(ctx, circulo, colorBorde, colorFondo) {
    ctx.save();
    ctx.fillStyle = colorFondo;
    ctx.strokeStyle = colorBorde;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(circulo.x, circulo.y, circulo.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function dibujarEtiquetaConjunto(ctx, x, y, texto, color, cardTexto = "") {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = color;
    ctx.fillText(texto, x, y);
    if (cardTexto) {
      ctx.font = "bold 13px Arial";
      ctx.fillStyle = COLORES.card;
      ctx.fillText(cardTexto, x, y + 18);
    }
    ctx.restore();
  }

  function dibujarBloqueTexto(ctx, x, y, lineas, opciones = {}) {
    if (!lineas || !lineas.length) return;
    const font = opciones.font || "13px Arial";
    const color = opciones.color || COLORES.texto;
    const lineHeight = opciones.lineHeight || 16;
    const align = opciones.align || "center";
    const paddingX = opciones.paddingX || 6;
    const paddingY = opciones.paddingY || 4;
    const bg = opciones.background || "rgba(255,255,255,0.70)";
    ctx.save();
    ctx.font = font;
    const widths = lineas.map((linea) => ctx.measureText(linea).width);
    const maxWidth = Math.max(...widths, 0);
    const totalHeight = lineas.length * lineHeight;
    let left = x - maxWidth / 2 - paddingX;
    if (align === "left") left = x - paddingX;
    if (align === "right") left = x - maxWidth - paddingX;
    const top = y - totalHeight / 2 - paddingY;
    ctx.fillStyle = bg;
    ctx.fillRect(left, top, maxWidth + paddingX * 2, totalHeight + paddingY * 2);
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = font;
    lineas.forEach((linea, i) => {
      ctx.fillText(linea, x, y - totalHeight / 2 + i * lineHeight + lineHeight / 2);
    });
    ctx.restore();
  }

  function encontrarPosicionCardinalidadEnRegion(
    escena,
    clave,
    w,
    h,
    canvas,
    config = {},
    regionBox = null
  ) {
    const st = obtenerEstadoCanvas(canvas);

    if (!st.elementBoxes) st.elementBoxes = {};
    if (!st.cardBoxes) st.cardBoxes = {};
    if (!st.cardOffsets) st.cardOffsets = {};

    const margen = config.margenRegionPx ?? 5;
    const paso = config.pasoBusquedaCardinalidadPx ?? 4;

    const predicado = obtenerPredicadoRegion(escena, clave, margen);
    const area = obtenerAreaBusquedaRegion(escena, clave);

    const anchor = escena.anchors?.[clave] || {
      x: regionBox ? regionBox.x + regionBox.w / 2 : escena.rect.x + escena.rect.w / 2,
      y: regionBox ? regionBox.y + regionBox.h / 2 : escena.rect.y + escena.rect.h / 2,
    };

    const elementos = st.elementBoxes?.[clave] || [];

    const otrasCards = Object.entries(st.cardBoxes || {})
      .filter(([k]) => k !== clave)
      .map(([, box]) => box)
      .filter(Boolean);

    const candidatos = [];

    for (let y = area.y0 + h / 2; y <= area.y1 - h / 2; y += paso) {
      for (let x = area.x0 + w / 2; x <= area.x1 - w / 2; x += paso) {
        if (!rectCabeEnRegion(x, y, w, h, predicado)) continue;

        const caja = {
          x: x - w / 2,
          y: y - h / 2,
          w,
          h,
        };

        const chocaElementos = elementos.some((el) => cajasSeSuperponen(caja, el));
        const chocaCards = otrasCards.some((card) => cajasSeSuperponen(caja, card));

        const penalizacionElementos = chocaElementos ? 1000000 : 0;
        const penalizacionCards = chocaCards ? 600000 : 0;

        const score =
          penalizacionElementos +
          penalizacionCards +
          dist2(x, y, anchor.x, anchor.y);

        candidatos.push({ x, y, score });
      }
    }

    if (!candidatos.length) {
      return { x: anchor.x, y: anchor.y };
    }

    candidatos.sort((a, b) => a.score - b.score);

    return { x: candidatos[0].x, y: candidatos[0].y };
  }

  function dibujarCardinalidadMovible(
    ctx,
    canvas,
    escena,
    clave,
    regionBox,
    cantidad,
    config = {},
  ) {
    if (!config.mostrarCardinalidad) return;
    if (!cajaUtil(regionBox)) return;

    const mostrarCeros = !!config.mostrarCardinalidadCero;
    if (cantidad === 0 && !mostrarCeros) return;

    const st = obtenerEstadoCanvas(canvas);
    const offset = st.cardOffsets[clave] || { dx: 0, dy: 0 };

    const prefijo =
      config.prefijoCardinalidad !== undefined
        ? String(config.prefijoCardinalidad)
        : "#";

    const texto = `${prefijo}${cantidad}`;
    const colorTexto =
      config.colorCardinalidad || colorCardinalidadPorRegion(clave);

    const fontElementosPx = config.fontElementosPx ?? 16;
    const fontCardinalidadPx =
      config.fontCardinalidadPx ?? Math.max(10, fontElementosPx - 4);

    ctx.save();
    ctx.font = config.fontCardinalidad || `italic bold ${fontCardinalidadPx}px Arial`;

    const padX = 6;
    const padY = 4;
    const w = ctx.measureText(texto).width + padX * 2;
    const h = fontCardinalidadPx + padY * 2;

    const posBase = encontrarPosicionCardinalidadEnRegion(
      escena,
      clave,
      w,
      h,
      canvas,
      config,
      regionBox
    );

    const x = posBase.x + offset.dx;
    const y = posBase.y + offset.dy;

    redondeado(ctx, x - w / 2, y - h / 2, w, h, 6);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill();

    ctx.fillStyle = colorTexto;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, x, y + 0.5);

    st.cardBoxes[clave] = {
      x: x - w / 2,
      y: y - h / 2,
      w,
      h,
    };

    ctx.restore();
  }

  function dibujarElementosEnRegionGrid(ctx, canvas, escena, clave, elementos, config = {}) {
    const mostrarElementos = config.mostrarElementos !== false;
    const mostrarVacios = !!config.mostrarRegionesVacias;

    const st = obtenerEstadoCanvas(canvas);
    if (!st.elementBoxes) st.elementBoxes = {};
    st.elementBoxes[clave] = [];

    if (!mostrarElementos) return;

    if (!elementos.length) {
      if (!mostrarVacios) return;

      const anchor = escena.anchors?.[clave];
      if (!anchor) return;

      ctx.save();
      ctx.fillStyle = "rgba(108,117,125,0.8)";
      ctx.font = "italic 16px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("∅", anchor.x, anchor.y);
      ctx.restore();
      return;
    }

    const margen = config.margenRegionPx ?? 5;
    const paso = config.pasoBusquedaPx ?? 5;

    const fontPx = config.fontElementosPx ?? 16;
    const padX = config.paddingElementoX ?? 4;
    const padY = config.paddingElementoY ?? 4;
    const maxAnchoTexto = config.maxAnchoTextoElementoPx ?? 72;

    ctx.save();
    ctx.font = `${fontPx}px Arial`;

    const textosRender = elementos.map((el) =>
      ajustarTextoConElipsis(ctx, String(el), maxAnchoTexto)
    );

    const anchos = textosRender.map((txt) => ctx.measureText(txt).width);
    const maxTextW = Math.max(...anchos, 10);

    const slotW = Math.ceil(maxTextW + padX * 2);
    const slotH = Math.ceil(fontPx + padY * 2);

    const predicado = obtenerPredicadoRegion(escena, clave, margen);
    const area = obtenerAreaBusquedaRegion(escena, clave);

    const candidatos = [];

    for (let y = area.y0 + slotH / 2; y <= area.y1 - slotH / 2; y += paso) {
      for (let x = area.x0 + slotW / 2; x <= area.x1 - slotW / 2; x += paso) {
        if (rectCabeEnRegion(x, y, slotW, slotH, predicado)) {
          candidatos.push({ x, y, w: slotW, h: slotH });
        }
      }
    }

    candidatos.sort((a, b) => {
      if (Math.abs(a.y - b.y) > paso / 2) return a.y - b.y;
      return a.x - b.x;
    });

    const usados = [];
    const elegidos = [];

    for (const c of candidatos) {
      if (!seSuperponeSlot(c.x, c.y, c.w, c.h, usados)) {
        usados.push(c);
        elegidos.push(c);
        if (elegidos.length >= elementos.length) break;
      }
    }

    if (elegidos.length < elementos.length) {
      ctx.restore();

      if ((config.fontElementosPx ?? 16) > 12) {
        dibujarElementosEnRegionGrid(ctx, canvas, escena, clave, elementos, {
          ...config,
          fontElementosPx: (config.fontElementosPx ?? 16) - 1,
        });
      } else {
        console.warn(`No caben todos los elementos en la región ${clave}`, {
          clave,
          elementos,
        });
      }
      return;
    }

    ctx.fillStyle = config.colorElemento || "#495057";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    textosRender.forEach((txt, i) => {
      ctx.fillText(txt, elegidos[i].x, elegidos[i].y);
    });

    st.elementBoxes[clave] = elegidos.map((slot) => ({
      x: slot.x - slot.w / 2,
      y: slot.y - slot.h / 2,
      w: slot.w,
      h: slot.h,
    }));

    ctx.restore();
  }

  function normalizarConjuntos2(config = {}) {
    const A = limpiarLista(config?.conjuntos?.A || config.A || []);
    const B = limpiarLista(config?.conjuntos?.B || config.B || []);
    const universo = unirListas(config.universo || [], A, B);
    return {
      A,
      B,
      universo,
      setA: setDesdeLista(A),
      setB: setDesdeLista(B),
      setU: setDesdeLista(universo),
    };
  }

  function normalizarConjuntos3(config = {}) {
    const A = limpiarLista(config?.conjuntos?.A || config.A || []);
    const B = limpiarLista(config?.conjuntos?.B || config.B || []);
    const C = limpiarLista(config?.conjuntos?.C || config.C || []);
    const universo = unirListas(config.universo || [], A, B, C);
    return {
      A,
      B,
      C,
      universo,
      setA: setDesdeLista(A),
      setB: setDesdeLista(B),
      setC: setDesdeLista(C),
      setU: setDesdeLista(universo),
    };
  }

  function derivarRegiones2(config = {}) {
    const { setA, setB, universo } = normalizarConjuntos2(config);
    return {
      A_only: filtrarSegunReferencia(
        universo,
        (x) => setA.has(aTexto(x)) && !setB.has(aTexto(x)),
      ),
      B_only: filtrarSegunReferencia(
        universo,
        (x) => setB.has(aTexto(x)) && !setA.has(aTexto(x)),
      ),
      AB: filtrarSegunReferencia(
        universo,
        (x) => setA.has(aTexto(x)) && setB.has(aTexto(x)),
      ),
      OUT: filtrarSegunReferencia(
        universo,
        (x) => !setA.has(aTexto(x)) && !setB.has(aTexto(x)),
      ),
    };
  }

  function derivarRegiones3(config = {}) {
    const { setA, setB, setC, universo } = normalizarConjuntos3(config);
    return {
      A_only: filtrarSegunReferencia(
        universo,
        (x) =>
          setA.has(aTexto(x)) && !setB.has(aTexto(x)) && !setC.has(aTexto(x)),
      ),
      B_only: filtrarSegunReferencia(
        universo,
        (x) =>
          setB.has(aTexto(x)) && !setA.has(aTexto(x)) && !setC.has(aTexto(x)),
      ),
      C_only: filtrarSegunReferencia(
        universo,
        (x) =>
          setC.has(aTexto(x)) && !setA.has(aTexto(x)) && !setB.has(aTexto(x)),
      ),
      AB_only: filtrarSegunReferencia(
        universo,
        (x) =>
          setA.has(aTexto(x)) && setB.has(aTexto(x)) && !setC.has(aTexto(x)),
      ),
      AC_only: filtrarSegunReferencia(
        universo,
        (x) =>
          setA.has(aTexto(x)) && setC.has(aTexto(x)) && !setB.has(aTexto(x)),
      ),
      BC_only: filtrarSegunReferencia(
        universo,
        (x) =>
          setB.has(aTexto(x)) && setC.has(aTexto(x)) && !setA.has(aTexto(x)),
      ),
      ABC: filtrarSegunReferencia(
        universo,
        (x) =>
          setA.has(aTexto(x)) && setB.has(aTexto(x)) && setC.has(aTexto(x)),
      ),
      OUT: filtrarSegunReferencia(
        universo,
        (x) =>
          !setA.has(aTexto(x)) && !setB.has(aTexto(x)) && !setC.has(aTexto(x)),
      ),
    };
  }

  function detectarRelacionLogica2(config = {}) {
    const { setA, setB } = normalizarConjuntos2(config);
    const A = [...setA];
    const B = [...setB];
    const AenB = A.every((x) => setB.has(x));
    const BenA = B.every((x) => setA.has(x));
    const interseccionVacia = A.every((x) => !setB.has(x));
    if (AenB && BenA) return "coincidentes";
    if (AenB) return "A_en_B";
    if (BenA) return "B_en_A";
    if (interseccionVacia) return "disjuntos";
    return "superpuestos";
  }

  function normalizarRelacionGrafica(v) {
    const t = normalizarToken(v);
    const mapa = {
      coincidentes: "coincidentes",
      iguales: "coincidentes",
      igualdad: "coincidentes",
      aenb: "A_en_B",
      aenbsubconjunto: "A_en_B",
      subconjuntoaenb: "A_en_B",
      bena: "B_en_A",
      benasubconjunto: "B_en_A",
      subconjuntobena: "B_en_A",
      disjuntos: "disjuntos",
      separados: "disjuntos",
      superpuestos: "superpuestos",
      interseccion: "superpuestos",
      traslapados: "superpuestos",
    };
    return mapa[t] || "superpuestos";
  }

  function resolverLayout2(config = {}) {
    const layout = normalizarToken(config.layout || "auto");
    const logica = detectarRelacionLogica2(config);
    if (layout === "manual") {
      const manual = normalizarRelacionGrafica(
        config.relacionGrafica || config.layoutManual || "superpuestos",
      );
      return { grafica: manual, logica };
    }
    return { grafica: logica, logica };
  }

  function advertirSiInconsistente(config = {}, layoutInfo) {
    if (normalizarToken(config.layout || "auto") !== "manual") return;
    if (!config.validarConsistenciaVisual) return;
    if (layoutInfo.grafica === layoutInfo.logica) return;
    console.warn(
      `La relación gráfica manual (${layoutInfo.grafica}) no coincide con la relación lógica detectada (${layoutInfo.logica}).`,
      config,
    );
  }

  function crearCanvasTemporal(canvas) {
    const { width, height, dpr } = obtenerDimensionesCanvas(canvas);
    const temp = document.createElement("canvas");

    temp.width = Math.round(width * dpr);
    temp.height = Math.round(height * dpr);
    temp.dataset.logicalWidth = String(width);
    temp.dataset.logicalHeight = String(height);
    temp.dataset.dpr = String(dpr);

    return temp;
  }

  function pintarRegion(
    ctx,
    canvas,
    pathUniverso,
    incluir = [],
    excluir = [],
    color,
  ) {
    const temp = crearCanvasTemporal(canvas);
    const tctx = temp.getContext("2d");

    prepararContexto(tctx, temp);

    tctx.fillStyle = color;
    tctx.fill(pathUniverso);

    incluir.forEach((path) => {
      tctx.globalCompositeOperation = "destination-in";
      tctx.fill(path);
    });

    excluir.forEach((path) => {
      tctx.globalCompositeOperation = "destination-out";
      tctx.fill(path);
    });

    tctx.globalCompositeOperation = "source-over";

    const { width, height } = obtenerDimensionesCanvas(canvas);
    ctx.drawImage(temp, 0, 0, width, height);
  }

  function textoOperacion2(operacion = "union") {
    const mapa = {
      A: "A",
      B: "B",
      union: "A ∪ B",
      interseccion: "A ∩ B",
      diferenciaAB: "A − B",
      diferenciaBA: "B − A",
      diferenciaSimetrica: "A △ B",
      complementoA: "Aᶜ",
      complementoB: "Bᶜ",
      exterior: "U − (A ∪ B)",
      universo: "U",
      ninguna: "Sin sombreado",
    };
    return mapa[operacion] || operacion;
  }

  function textoOperacion3(operacion = "unionABC") {
    const mapa = {
      A: "A",
      B: "B",
      C: "C",
      unionABC: "A ∪ B ∪ C",
      unionAB: "A ∪ B",
      unionAC: "A ∪ C",
      unionBC: "B ∪ C",
      interseccionAB: "A ∩ B",
      interseccionAC: "A ∩ C",
      interseccionBC: "B ∩ C",
      interseccionABC: "A ∩ B ∩ C",
      diferenciaA_BC: "A − (B ∪ C)",
      diferenciaB_AC: "B − (A ∪ C)",
      diferenciaC_AB: "C − (A ∪ B)",
      complementoA: "Aᶜ",
      complementoB: "Bᶜ",
      complementoC: "Cᶜ",
      exterior: "U − (A ∪ B ∪ C)",
      universo: "U",
      ninguna: "Sin sombreado",
    };
    return mapa[operacion] || operacion;
  }

  function regionesActivasOperacion2(operacion, regionesActivas) {
    if (Array.isArray(regionesActivas) && regionesActivas.length) return regionesActivas;
    const token = normalizarToken(operacion || "union");
    const mapa = {
      a: ["A_only", "AB"],
      b: ["B_only", "AB"],
      union: ["A_only", "B_only", "AB"],
      interseccion: ["AB"],
      diferenciaab: ["A_only"],
      diferenciaba: ["B_only"],
      diferenciasimetrica: ["A_only", "B_only"],
      simetrica: ["A_only", "B_only"],
      complementoa: ["B_only", "OUT"],
      complementob: ["A_only", "OUT"],
      exterior: ["OUT"],
      universo: ["A_only", "B_only", "AB", "OUT"],
      ninguna: [],
    };
    return mapa[token] || mapa.union;
  }

  function regionesActivasOperacion3(operacion, regionesActivas) {
    if (Array.isArray(regionesActivas) && regionesActivas.length) return regionesActivas;
    const todasInternas = [
      "A_only",
      "B_only",
      "C_only",
      "AB_only",
      "AC_only",
      "BC_only",
      "ABC",
    ];
    const token = normalizarToken(operacion || "unionabc");
    const mapa = {
      a: ["A_only", "AB_only", "AC_only", "ABC"],
      b: ["B_only", "AB_only", "BC_only", "ABC"],
      c: ["C_only", "AC_only", "BC_only", "ABC"],
      unionabc: todasInternas,
      union: todasInternas,
      unionab: ["A_only", "B_only", "AB_only", "AC_only", "BC_only", "ABC"],
      unionac: ["A_only", "C_only", "AB_only", "AC_only", "BC_only", "ABC"],
      unionbc: ["B_only", "C_only", "AB_only", "AC_only", "BC_only", "ABC"],
      interseccionab: ["AB_only", "ABC"],
      interseccionac: ["AC_only", "ABC"],
      interseccionbc: ["BC_only", "ABC"],
      interseccionabc: ["ABC"],
      diferenciaabc: ["A_only"],
      diferenciaa_bc: ["A_only"],
      diferenciabac: ["B_only"],
      diferenciab_ac: ["B_only"],
      diferenciacab: ["C_only"],
      diferenciac_ab: ["C_only"],
      complementoa: ["B_only", "C_only", "BC_only", "OUT"],
      complementob: ["A_only", "C_only", "AC_only", "OUT"],
      complementoc: ["A_only", "B_only", "AB_only", "OUT"],
      exterior: ["OUT"],
      universo: [...todasInternas, "OUT"],
      ninguna: [],
    };
    return mapa[token] || mapa.unionabc;
  }

  function obtenerEscena2(canvas, layoutGrafica, config = {}) {
    const { width, height } = obtenerDimensionesCanvas(canvas);
    const rect = { x: 36, y: 54, w: width - 72, h: height - 118 };
    const { A: listaA, B: listaB } = normalizarConjuntos2(config);
    const regiones = derivarRegiones2(config);
    const totalA = listaA.length;
    const totalB = listaB.length;
    let rA = radioAdaptativoPorCantidad(totalA);
    let rB = radioAdaptativoPorCantidad(totalB);
    const cargaMax = Math.max(
      regiones.A_only.length,
      regiones.B_only.length,
      regiones.AB.length,
      1,
    );
    const extra = Math.max(0, Math.ceil(Math.sqrt(cargaMax)) - 2) * 4;
    rA += extra;
    rB += extra;
    const centro = centroRect(rect);
    let A;
    let B;

    switch (layoutGrafica) {
      case "disjuntos": {
        const gap = 34;
        A = { x: centro.x - (rA + gap / 2), y: centro.y, r: rA };
        B = { x: centro.x + (rB + gap / 2), y: centro.y, r: rB };
        break;
      }
      case "A_en_B": {
        const inner = radioAdaptativoPorCantidad(totalA, {
          minR: 54,
          maxR: 92,
          base: 42,
          factor: 14,
        });
        const outer = Math.max(
          radioAdaptativoPorCantidad(totalB, {
            minR: 92,
            maxR: 150,
            base: 62,
            factor: 18,
          }),
          inner + 34,
        );
        B = { x: centro.x, y: centro.y, r: outer };
        A = { x: centro.x - 22, y: centro.y - 2, r: inner };
        break;
      }
      case "B_en_A": {
        const inner = radioAdaptativoPorCantidad(totalB, {
          minR: 54,
          maxR: 92,
          base: 42,
          factor: 14,
        });
        const outer = Math.max(
          radioAdaptativoPorCantidad(totalA, {
            minR: 92,
            maxR: 150,
            base: 62,
            factor: 18,
          }),
          inner + 34,
        );
        A = { x: centro.x, y: centro.y, r: outer };
        B = { x: centro.x + 22, y: centro.y - 2, r: inner };
        break;
      }
      case "coincidentes":
        A = { x: centro.x, y: centro.y, r: Math.max(rA, rB) };
        B = { x: centro.x, y: centro.y, r: Math.max(rA, rB) };
        break;
      case "superpuestos":
      default: {
        const dist = Math.max(52, Math.min(120, (rA + rB) * 0.72));
        A = { x: centro.x - dist / 2, y: centro.y, r: rA };
        B = { x: centro.x + dist / 2, y: centro.y, r: rB };
        break;
      }
    }

    const overlapW = Math.max(
      54,
      Math.min(110, A.r + B.r - Math.abs(B.x - A.x) - 18),
    );

    const anchors = {
      OUT: { x: rect.x + 56, y: rect.y + 32 },
      A_only: { x: A.x - A.r * 0.5, y: A.y },
      B_only: { x: B.x + B.r * 0.5, y: B.y },
      AB: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 },
      labelA: { x: A.x, y: A.y - A.r - 26 },
      labelB: { x: B.x, y: B.y - B.r - 26 },
    };

    if (layoutGrafica === "disjuntos") {
      anchors.AB = { x: centro.x, y: centro.y };
    }
    if (layoutGrafica === "B_en_A") {
      anchors.labelA = { x: A.x, y: A.y - A.r - 26 };
      anchors.labelB = { x: B.x, y: B.y - B.r - 18 };
    }
    if (layoutGrafica === "A_en_B") {
      anchors.labelB = { x: B.x, y: B.y - B.r - 26 };
      anchors.labelA = { x: A.x, y: A.y - A.r - 18 };
    }

    const regionBoxes = {
      OUT: cajaCentrada(anchors.OUT.x, anchors.OUT.y, 82, 56),
      A_only: cajaCentrada(
        anchors.A_only.x,
        anchors.A_only.y,
        Math.max(72, Math.min(120, A.r * 0.88)),
        Math.max(54, Math.min(96, A.r * 0.62)),
      ),
      B_only: cajaCentrada(
        anchors.B_only.x,
        anchors.B_only.y,
        Math.max(72, Math.min(120, B.r * 0.88)),
        Math.max(54, Math.min(96, B.r * 0.62)),
      ),
      AB: cajaCentrada(
        anchors.AB.x,
        anchors.AB.y,
        layoutGrafica === "disjuntos" ? 60 : overlapW,
        layoutGrafica === "disjuntos" ? 46 : 70,
      ),
    };

    if (layoutGrafica === "disjuntos") {
      regionBoxes.A_only = cajaCentrada(
        A.x,
        A.y,
        Math.max(52, Math.min(82, A.r * 0.55)),
        Math.max(42, Math.min(64, A.r * 0.42)),
      );
      regionBoxes.B_only = cajaCentrada(
        B.x,
        B.y,
        Math.max(52, Math.min(82, B.r * 0.55)),
        Math.max(42, Math.min(64, B.r * 0.42)),
      );
      regionBoxes.AB = cajaCentrada(centro.x, centro.y, 0, 0);
    }

    if (layoutGrafica === "A_en_B") {
      regionBoxes.AB = cajaCentrada(
        A.x,
        A.y,
        Math.max(46, A.r * 1.0),
        Math.max(38, A.r * 0.72),
      );
      regionBoxes.B_only = cajaCentrada(
        B.x + B.r * 0.52,
        B.y,
        Math.max(46, B.r * 0.28),
        Math.max(54, B.r * 0.58),
      );
      regionBoxes.A_only = cajaCentrada(A.x, A.y, 0, 0);
    }

    if (layoutGrafica === "B_en_A") {
      regionBoxes.AB = cajaCentrada(
        B.x,
        B.y,
        Math.max(46, B.r * 1.0),
        Math.max(38, B.r * 0.72),
      );
      regionBoxes.A_only = cajaCentrada(
        A.x - A.r * 0.52,
        A.y,
        Math.max(46, A.r * 0.28),
        Math.max(54, A.r * 0.58),
      );
      regionBoxes.B_only = cajaCentrada(B.x, B.y, 0, 0);
    }

    if (layoutGrafica === "coincidentes") {
      regionBoxes.A_only = cajaCentrada(A.x - 44, A.y - 18, 74, 54);
      regionBoxes.B_only = cajaCentrada(B.x + 44, B.y + 18, 74, 54);
      regionBoxes.AB = cajaCentrada(
        A.x,
        A.y,
        Math.max(74, A.r * 0.92),
        Math.max(58, A.r * 0.68),
      );
    }

    return {
      rect,
      pathUniverso: pathRect(rect.x, rect.y, rect.w, rect.h),
      pathA: pathCirculo(A.x, A.y, A.r),
      pathB: pathCirculo(B.x, B.y, B.r),
      A,
      B,
      anchors,
      regionBoxes,
    };
  }

  function obtenerEscena3(canvas, config = {}) {
    const { width, height } = obtenerDimensionesCanvas(canvas);

    const rect = {
      x: 34,
      y: 54,
      w: width - 68,
      h: height - 120,
    };

    const regiones = derivarRegiones3(config);

    const nAonly = regiones.A_only.length;
    const nBonly = regiones.B_only.length;
    const nConly = regiones.C_only.length;
    const nAB = regiones.AB_only.length;
    const nAC = regiones.AC_only.length;
    const nBC = regiones.BC_only.length;
    const nABC = regiones.ABC.length;

    const nA = nAonly + nAB + nAC + nABC;
    const nB = nBonly + nAB + nBC + nABC;
    const nC = nConly + nAC + nBC + nABC;

    const cajaA = estimarCajaRegion(nA, { stepX: 16, stepY: 20, gapX: 8, gapY: 8, padX: 18, padY: 18 });
    const cajaB = estimarCajaRegion(nB, { stepX: 16, stepY: 20, gapX: 8, gapY: 8, padX: 18, padY: 18 });
    const cajaC = estimarCajaRegion(nC, { stepX: 16, stepY: 20, gapX: 8, gapY: 8, padX: 18, padY: 18 });

    let rA = clamp(Math.hypot(cajaA.w * 0.52, cajaA.h * 0.55) + 24, 76, 155);
    let rB = clamp(Math.hypot(cajaB.w * 0.52, cajaB.h * 0.55) + 24, 76, 155);
    let rC = clamp(Math.hypot(cajaC.w * 0.52, cajaC.h * 0.55) + 24, 76, 155);

    const pesoABC = nABC >= 6 ? 2.8 : nABC >= 4 ? 2.2 : 1.6;

    const iAB = nAB + pesoABC * nABC;
    const iAC = nAC + pesoABC * nABC;
    const iBC = nBC + pesoABC * nABC;

    let lambdaAB = clamp(1.16 - 0.11 * Math.log1p(iAB), 0.78, 1.16);
    let lambdaAC = clamp(1.16 - 0.11 * Math.log1p(iAC), 0.78, 1.16);
    let lambdaBC = clamp(1.16 - 0.11 * Math.log1p(iBC), 0.78, 1.16);

    let dAB = lambdaAB * ((rA + rB) / 2);
    let dAC = lambdaAC * ((rA + rC) / 2);
    let dBC = lambdaBC * ((rB + rC) / 2);

    [dAB, dAC, dBC] = ajustarLadosTriangulo(dAB, dAC, dBC);

    if (nABC >= 5) {
      dAB *= 0.84;
      dAC *= 0.84;
      dBC *= 0.84;
      rA += 8;
      rB += 8;
      rC += 8;
    }

    let A = { x: 0, y: 0, r: rA };
    let B = { x: dAB, y: 0, r: rB };

    const xCrel = (dAC * dAC - dBC * dBC + dAB * dAB) / (2 * dAB);
    const yCrel = Math.sqrt(Math.max(0, dAC * dAC - xCrel * xCrel));

    let C = { x: xCrel, y: yCrel, r: rC };

    const minX = Math.min(A.x - rA, B.x - rB, C.x - rC);
    const maxX = Math.max(A.x + rA, B.x + rB, C.x + rC);
    const minY = Math.min(A.y - rA, B.y - rB, C.y - rC);
    const maxY = Math.max(A.y + rA, B.y + rB, C.y + rC);

    const geomW = maxX - minX;
    const geomH = maxY - minY;

    const scale = Math.min(1, (rect.w - 30) / geomW, (rect.h - 36) / geomH);

    A = { x: A.x * scale, y: A.y * scale, r: rA * scale };
    B = { x: B.x * scale, y: B.y * scale, r: rB * scale };
    C = { x: C.x * scale, y: C.y * scale, r: rC * scale };

    const minX2 = Math.min(A.x - A.r, B.x - B.r, C.x - C.r);
    const maxX2 = Math.max(A.x + A.r, B.x + B.r, C.x + C.r);
    const minY2 = Math.min(A.y - A.r, B.y - B.r, C.y - C.r);
    const maxY2 = Math.max(A.y + A.r, B.y + B.r, C.y + C.r);

    const offsetX = rect.x + rect.w / 2 - (minX2 + maxX2) / 2;
    const offsetY = rect.y + rect.h / 2 - (minY2 + maxY2) / 2 + 8;

    A.x += offsetX;
    A.y += offsetY;
    B.x += offsetX;
    B.y += offsetY;
    C.x += offsetX;
    C.y += offsetY;

    const centroABC = {
      x: (A.x + B.x + C.x) / 3,
      y: (A.y + B.y + C.y) / 3 - 8,
    };

    const midAB = puntoMedio(A, B);
    const midAC = puntoMedio(A, C);
    const midBC = puntoMedio(B, C);

    const anchors = {
      OUT: { x: rect.x + 52, y: rect.y + 34 },

      A_only: alejarDesde(A, puntoMedio(B, C), A.r * 0.34),
      B_only: alejarDesde(B, puntoMedio(A, C), B.r * 0.34),
      C_only: alejarDesde(C, puntoMedio(A, B), C.r * 0.34),

      AB_only: alejarDesde(midAB, C, Math.min(A.r, B.r, C.r) * 0.16),
      AC_only: alejarDesde(midAC, B, Math.min(A.r, B.r, C.r) * 0.16),
      BC_only: alejarDesde(midBC, A, Math.min(A.r, B.r, C.r) * 0.16),

      ABC: centroABC,

      labelA: { x: A.x - 16, y: A.y - A.r - 18 },
      labelB: { x: B.x + 16, y: B.y - B.r - 18 },
      labelC: { x: C.x, y: C.y + C.r + 28 },
    };

    const boxAonly = estimarCajaRegion(nAonly);
    const boxBonly = estimarCajaRegion(nBonly);
    const boxConly = estimarCajaRegion(nConly);
    const boxAB = estimarCajaRegion(nAB);
    const boxAC = estimarCajaRegion(nAC);
    const boxBC = estimarCajaRegion(nBC);
    const boxABC = estimarCajaRegion(nABC);

    const regionBoxes = {
      OUT: cajaCentrada(anchors.OUT.x, anchors.OUT.y, 82, 56),

      A_only: cajaCentrada(
        anchors.A_only.x,
        anchors.A_only.y,
        Math.max(54, boxAonly.w),
        Math.max(40, boxAonly.h)
      ),

      B_only: cajaCentrada(
        anchors.B_only.x,
        anchors.B_only.y,
        Math.max(54, boxBonly.w),
        Math.max(40, boxBonly.h)
      ),

      C_only: cajaCentrada(
        anchors.C_only.x,
        anchors.C_only.y,
        Math.max(54, boxConly.w),
        Math.max(40, boxConly.h)
      ),

      AB_only: cajaCentrada(
        anchors.AB_only.x,
        anchors.AB_only.y,
        Math.max(44, boxAB.w),
        Math.max(34, boxAB.h)
      ),

      AC_only: cajaCentrada(
        anchors.AC_only.x,
        anchors.AC_only.y,
        Math.max(44, boxAC.w),
        Math.max(34, boxAC.h)
      ),

      BC_only: cajaCentrada(
        anchors.BC_only.x,
        anchors.BC_only.y,
        Math.max(44, boxBC.w),
        Math.max(34, boxBC.h)
      ),

      ABC: cajaCentrada(
        anchors.ABC.x,
        anchors.ABC.y,
        Math.max(72, boxABC.w + 18),
        Math.max(54, boxABC.h + 14)
      ),
    };

    return {
      rect,
      pathUniverso: pathRect(rect.x, rect.y, rect.w, rect.h),
      pathA: pathCirculo(A.x, A.y, A.r),
      pathB: pathCirculo(B.x, B.y, B.r),
      pathC: pathCirculo(C.x, C.y, C.r),
      A,
      B,
      C,
      anchors,
      regionBoxes,
    };
  }

  function sombrearRegiones2(ctx, canvas, escena, regionesActivas, colorOperacion) {
    const defs = {
      A_only: { include: [escena.pathA], exclude: [escena.pathB] },
      B_only: { include: [escena.pathB], exclude: [escena.pathA] },
      AB: { include: [escena.pathA, escena.pathB], exclude: [] },
      OUT: { include: [], exclude: [escena.pathA, escena.pathB] },
    };

    regionesActivas.forEach((clave) => {
      const def = defs[clave];
      if (!def) return;
      const color =
        colorOperacion ||
        PALETA_REGIONES.dos[clave] ||
        "rgba(255, 193, 7, 0.38)";
      pintarRegion(
        ctx,
        canvas,
        escena.pathUniverso,
        def.include,
        def.exclude,
        color,
      );
    });
  }

  function sombrearRegiones3(ctx, canvas, escena, regionesActivas, colorOperacion) {
    const defs = {
      A_only: {
        include: [escena.pathA],
        exclude: [escena.pathB, escena.pathC],
      },
      B_only: {
        include: [escena.pathB],
        exclude: [escena.pathA, escena.pathC],
      },
      C_only: {
        include: [escena.pathC],
        exclude: [escena.pathA, escena.pathB],
      },
      AB_only: {
        include: [escena.pathA, escena.pathB],
        exclude: [escena.pathC],
      },
      AC_only: {
        include: [escena.pathA, escena.pathC],
        exclude: [escena.pathB],
      },
      BC_only: {
        include: [escena.pathB, escena.pathC],
        exclude: [escena.pathA],
      },
      ABC: { include: [escena.pathA, escena.pathB, escena.pathC], exclude: [] },
      OUT: { include: [], exclude: [escena.pathA, escena.pathB, escena.pathC] },
    };

    regionesActivas.forEach((clave) => {
      const def = defs[clave];
      if (!def) return;
      const color =
        colorOperacion ||
        PALETA_REGIONES.tres[clave] ||
        "rgba(255, 193, 7, 0.38)";
      pintarRegion(
        ctx,
        canvas,
        escena.pathUniverso,
        def.include,
        def.exclude,
        color,
      );
    });
  }

  function dibujarPieOperacion(ctx, canvas, texto, cantidad, config = {}) {
    if (
      config.mostrarNombreOperacion === false &&
      !config.mostrarCardinalidadOperacion
    ) return;

    const lineas = [];

    if (config.mostrarNombreOperacion !== false) lineas.push(texto);

    if (config.mostrarCardinalidadOperacion) {
      const prefijo = valorValido(config.prefijoCardinalidadOperacion)
        ? String(config.prefijoCardinalidadOperacion)
        : "#";
      lineas.push(`${prefijo}${cantidad}`);
    }

    if (!lineas.length) return;

    const { width, height } = obtenerDimensionesCanvas(canvas);

    dibujarBloqueTexto(ctx, width / 2, height - 28, lineas, {
      font: "bold 14px Arial",
      color: COLORES.texto,
      background: "rgba(255,255,255,0.82)",
      lineHeight: 18,
    });
  }

  function dibujarCardinalidadesConjuntos2(ctx, escena, config = {}) {
    if (!config.mostrarCardinalidadConjuntos) return;
    const { A, B } = normalizarConjuntos2(config);

    const fmtA = valorValido(config.formatoCardinalidadConjunto)
      ? String(config.formatoCardinalidadConjunto)
          .replace("{nombre}", config.nombreA || "A")
          .replace("{n}", A.length)
      : `n(${config.nombreA || "A"})=${A.length}`;

    const fmtB = valorValido(config.formatoCardinalidadConjunto)
      ? String(config.formatoCardinalidadConjunto)
          .replace("{nombre}", config.nombreB || "B")
          .replace("{n}", B.length)
      : `n(${config.nombreB || "B"})=${B.length}`;

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelA.x,
      escena.anchors.labelA.y,
      config.nombreA || "A",
      COLORES.A,
      fmtA,
    );

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelB.x,
      escena.anchors.labelB.y,
      config.nombreB || "B",
      COLORES.B,
      fmtB,
    );
  }

  function dibujarEtiquetasSimples2(ctx, escena, config = {}) {
    if (config.mostrarEtiquetas === false) return;
    if (config.mostrarCardinalidadConjuntos) return;

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelA.x,
      escena.anchors.labelA.y,
      config.nombreA || "A",
      COLORES.A,
    );

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelB.x,
      escena.anchors.labelB.y,
      config.nombreB || "B",
      COLORES.B,
    );
  }

  function dibujarCardinalidadesConjuntos3(ctx, escena, config = {}) {
    if (!config.mostrarCardinalidadConjuntos) return;
    const { A, B, C } = normalizarConjuntos3(config);
    const plantilla = valorValido(config.formatoCardinalidadConjunto)
      ? String(config.formatoCardinalidadConjunto)
      : "n({nombre})={n}";

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelA.x,
      escena.anchors.labelA.y,
      config.nombreA || "A",
      COLORES.A,
      plantilla.replace("{nombre}", config.nombreA || "A").replace("{n}", A.length),
    );

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelB.x,
      escena.anchors.labelB.y,
      config.nombreB || "B",
      COLORES.B,
      plantilla.replace("{nombre}", config.nombreB || "B").replace("{n}", B.length),
    );

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelC.x,
      escena.anchors.labelC.y,
      config.nombreC || "C",
      COLORES.C,
      plantilla.replace("{nombre}", config.nombreC || "C").replace("{n}", C.length),
    );
  }

  function dibujarEtiquetasSimples3(ctx, escena, config = {}) {
    if (config.mostrarEtiquetas === false) return;
    if (config.mostrarCardinalidadConjuntos) return;

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelA.x,
      escena.anchors.labelA.y,
      config.nombreA || "A",
      COLORES.A,
    );

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelB.x,
      escena.anchors.labelB.y,
      config.nombreB || "B",
      COLORES.B,
    );

    dibujarEtiquetaConjunto(
      ctx,
      escena.anchors.labelC.x,
      escena.anchors.labelC.y,
      config.nombreC || "C",
      COLORES.C,
    );
  }

  function dibujarRegiones2(ctx, canvas, escena, regiones, config = {}) {
    Object.entries(regiones).forEach(([clave, elementos]) => {
      dibujarElementosEnRegionGrid(ctx, canvas, escena, clave, elementos, config);

      const box = escena.regionBoxes?.[clave];
      if (!cajaUtil(box)) return;

      dibujarCardinalidadMovible(
        ctx,
        canvas,
        escena,
        clave,
        box,
        elementos.length,
        config
      );
    });
  }

  function dibujarRegiones3(ctx, canvas, escena, regiones, config = {}) {
    const orden = [
      "ABC",
      "AB_only",
      "AC_only",
      "BC_only",
      "A_only",
      "B_only",
      "C_only",
      "OUT"
    ];

    orden.forEach((clave) => {
      const elementos = regiones[clave] || [];

      dibujarElementosEnRegionGrid(ctx, canvas, escena, clave, elementos, config);

      const box = escena.regionBoxes?.[clave];
      if (!cajaUtil(box)) return;

      dibujarCardinalidadMovible(
        ctx,
        canvas,
        escena,
        clave,
        box,
        elementos.length,
        config
      );
    });
  }

  function dibujarContornos2(ctx, escena, layoutGrafica) {
    dibujarCirculoConjunto(ctx, escena.A, COLORES.A, COLORES.AFill);
    if (layoutGrafica === "coincidentes") {
      ctx.save();
      ctx.strokeStyle = COLORES.B;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.arc(escena.B.x, escena.B.y, escena.B.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      dibujarCirculoConjunto(ctx, escena.B, COLORES.B, COLORES.BFill);
    }
  }

  function dibujarContornos3(ctx, escena) {
    dibujarCirculoConjunto(ctx, escena.A, COLORES.A, COLORES.AFill);
    dibujarCirculoConjunto(ctx, escena.B, COLORES.B, COLORES.BFill);
    dibujarCirculoConjunto(ctx, escena.C, COLORES.C, COLORES.CFill);
  }

  function crearDiagramaConjuntos2(canvasId, config = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const st = obtenerEstadoCanvas(canvas);

    st.redraw = () => crearDiagramaConjuntos2(canvasId, config);
    st.cardBoxes = {};
    st.elementBoxes = {};

    const layoutInfo = resolverLayout2(config);
    advertirSiInconsistente(config, layoutInfo);

    const escena = obtenerEscena2(canvas, layoutInfo.grafica, config);
    const regiones = derivarRegiones2(config);
    const operacion = config.operacion || "union";
    const activas = regionesActivasOperacion2(
      operacion,
      config.regionesActivas,
    );

    const cantidadOperacion = activas.reduce(
      (acc, clave) => acc + (regiones[clave]?.length || 0),
      0,
    );

    prepararContexto(ctx, canvas);

    dibujarUniverso(ctx, escena.rect, config.nombreUniverso || "U");
    sombrearRegiones2(ctx, canvas, escena, activas, config.colorOperacion);
    dibujarContornos2(ctx, escena, layoutInfo.grafica);
    dibujarEtiquetasSimples2(ctx, escena, config);
    dibujarCardinalidadesConjuntos2(ctx, escena, config);
    dibujarRegiones2(ctx, canvas, escena, regiones, config);
    dibujarPieOperacion(
      ctx,
      canvas,
      textoOperacion2(operacion),
      cantidadOperacion,
      config,
    );
  }

  function crearDiagramaConjuntos3(canvasId, config = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const st = obtenerEstadoCanvas(canvas);

    st.redraw = () => crearDiagramaConjuntos3(canvasId, config);
    st.cardBoxes = {};
    st.elementBoxes = {};

    const escena = obtenerEscena3(canvas, config);
    const regiones = derivarRegiones3(config);
    const operacion = config.operacion || "unionABC";
    const activas = regionesActivasOperacion3(
      operacion,
      config.regionesActivas,
    );

    const cantidadOperacion = activas.reduce(
      (acc, clave) => acc + (regiones[clave]?.length || 0),
      0,
    );

    prepararContexto(ctx, canvas);

    dibujarUniverso(ctx, escena.rect, config.nombreUniverso || "U");
    sombrearRegiones3(ctx, canvas, escena, activas, config.colorOperacion);
    dibujarContornos3(ctx, escena);
    dibujarEtiquetasSimples3(ctx, escena, config);
    dibujarCardinalidadesConjuntos3(ctx, escena, config);
    dibujarRegiones3(ctx, canvas, escena, regiones, config);
    dibujarPieOperacion(
      ctx,
      canvas,
      textoOperacion3(operacion),
      cantidadOperacion,
      config,
    );
  }

  function crearDiagramaConjuntos(canvasId, config = {}) {
    const modo = normalizarToken(config.modo || config.tipo || "conjuntos2");
    if (modo === "conjuntos3" || modo === "venn3" || modo === "3") {
      crearDiagramaConjuntos3(canvasId, config);
      return;
    }
    crearDiagramaConjuntos2(canvasId, config);
  }

  const api = Object.freeze({
    COLORES,
    PALETA_REGIONES,
    obtenerDimensionesCanvas,
    prepararContexto,
    leerNumero,
    parsearJSONDeAtributo,
    asegurarCanvas,
    normalizarToken,
    normalizarConjuntos2,
    normalizarConjuntos3,
    derivarRegiones2,
    derivarRegiones3,
    detectarRelacionLogica2,
    resolverLayout2,
    obtenerEscena2,
    obtenerEscena3,
    crearDiagramaConjuntos,
    crearDiagramaConjuntos2,
    crearDiagramaConjuntos3
  });

  window.DiagramasVenn = Object.assign(
    {},
    window.DiagramasVenn || {},
    api
  );

  //modo compatibilidad

  const EXPORTAR_GLOBALES_LEGACY = true;

  if (EXPORTAR_GLOBALES_LEGACY) {
    if (typeof window.crearDiagramaConjuntos !== "function") {
      window.crearDiagramaConjuntos = crearDiagramaConjuntos;
    }
    if (typeof window.crearDiagramaConjuntos2 !== "function") {
      window.crearDiagramaConjuntos2 = crearDiagramaConjuntos2;
    }
    if (typeof window.crearDiagramaConjuntos3 !== "function") {
      window.crearDiagramaConjuntos3 = crearDiagramaConjuntos3;
    }
    if (typeof window.detectarRelacionConjuntos2 !== "function") {
      window.detectarRelacionConjuntos2 = detectarRelacionLogica2;
    }
    if (typeof window.derivarRegionesConjuntos2 !== "function") {
      window.derivarRegionesConjuntos2 = derivarRegiones2;
    }
    if (typeof window.derivarRegionesConjuntos3 !== "function") {
      window.derivarRegionesConjuntos3 = derivarRegiones3;
    }
  }

})(window, document);
