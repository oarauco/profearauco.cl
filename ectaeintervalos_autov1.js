(function (window, document) {
  "use strict";

  let contadorAutoCanvas = 0;

  const DEFAULT_WIDTH = 760;
  const DEFAULT_HEIGHT = 250;

  const MENSAJE_MOTOR_FALTANTE =
    "recta-intervalos-auto.js: no se encontró window.RectaIntervalos. Asegúrate de cargar antes recta-intervalos-render.js";

  function obtenerAPI() {
    return window.RectaIntervalos || null;
  }

  function motorCompletoDisponible(api) {
    return !!(api && typeof api.crearRectaIntervalos === "function");
  }

  function normalizarRoot(root) {
    if (root && typeof root.querySelectorAll === "function") return root;
    return document;
  }

  function numeroPositivo(v, fallback) {
    const n = Number(v);
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

  function leerNumero(el, nombre, fallback) {
    const raw = el.getAttribute(nombre);
    if (raw === null || raw === "") return fallback;

    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function estimarAlturaCanvas(config, fallbackHeight) {
    const intervals = Array.isArray(config?.intervals) ? config.intervals.length : 0;
    const solutions = Array.isArray(config?.solutions) ? config.solutions.length : 0;
    const style = config && typeof config.style === "object" && config.style
      ? config.style
      : {};

    const intervalHeight = numeroPositivo(style.intervalHeight, 18);
    const baseThicknessStep = numeroPositivo(
      style.baseThicknessStep,
      numeroPositivo(style.layerOffset, 8)
    );
    const solutionHeightExtra = numeroPositivo(style.solutionHeightExtra, 6);
    const solutionLift = Math.max(0, Number(style.solutionLift) || 0);

    const maxBaseHeight =
      intervalHeight + Math.max(0, intervals - 1) * baseThicknessStep;

    const solutionHeight =
      solutions > 0
        ? intervalHeight + solutionHeightExtra + solutionLift
        : 0;

    const extraTop = Math.max(maxBaseHeight, solutionHeight);

    return Math.max(fallbackHeight, Math.ceil(170 + extraTop));
  }

  function asegurarCanvas(contenedor, width, height) {
    let canvas = contenedor.querySelector("canvas.oa-recta-intervalos-auto-canvas");

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "oa-recta-intervalos-auto-canvas";
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
        : `oa_recta_intervalos_canvas_${++contadorAutoCanvas}`;
      canvas.id = base;
    }

    return canvas;
  }

  function obtenerDefinicionDesdeContenedor(contenedor) {
    if (contenedor.classList.contains("recta-intervalos-auto")) {
      return {
        fnName: "crearRectaIntervalos",
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT
      };
    }

    if (contenedor.classList.contains("recta-numerica-auto")) {
      return {
        fnName: "crearRectaIntervalos",
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT
      };
    }

    const tipo = String(contenedor.getAttribute("data-tipo") || "")
      .trim()
      .toLowerCase();

    if (
      tipo === "recta-intervalos" ||
      tipo === "recta" ||
      tipo === "intervalos" ||
      tipo === "recta-numerica"
    ) {
      return {
        fnName: "crearRectaIntervalos",
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT
      };
    }

    return null;
  }

  function inicializarContenedor(contenedor, api, options = {}) {
    const force = !!options.force;

    if (!force && contenedor.getAttribute("data-auto-inicializado") === "1") {
      return true;
    }

    const def = obtenerDefinicionDesdeContenedor(contenedor);
    if (!def) return false;

    const fn = api[def.fnName];
    if (typeof fn !== "function") {
      console.warn(
        `La función ${def.fnName} no está disponible en window.RectaIntervalos.`,
        contenedor
      );
      return false;
    }

    const config = parsearJSONDeAtributo(contenedor, "data-config", {});
    const width = leerNumero(
      contenedor,
      "data-width",
      numeroPositivo(config.width, def.width)
    );

    const fallbackHeight = estimarAlturaCanvas(config, def.height);
    const height = leerNumero(
      contenedor,
      "data-height",
      numeroPositivo(config.height, fallbackHeight)
    );

    const canvas = asegurarCanvas(contenedor, width, height);

    try {
      const ok = fn(canvas.id, config);

      if (ok === false) {
        console.warn("El motor de recta intervalos devolvió false.", contenedor, config);
        contenedor.setAttribute("data-auto-error", "1");
        return false;
      }

      contenedor.setAttribute("data-auto-inicializado", "1");
      contenedor.removeAttribute("data-auto-error");
      return true;
    } catch (error) {
      console.error("Error al inicializar recta-intervalos-auto:", error, contenedor, config);
      contenedor.setAttribute("data-auto-error", "1");
      return false;
    }
  }

  function inicializar(root = document, options = {}) {
    const api = obtenerAPI();
    const rootReal = normalizarRoot(root);

    if (!motorCompletoDisponible(api)) {
      console.error(MENSAJE_MOTOR_FALTANTE);
      return false;
    }

    const selector = [
      ".recta-intervalos-auto",
      ".recta-numerica-auto",
      ".recta-auto[data-tipo]"
    ].join(",");

    rootReal.querySelectorAll(selector).forEach(function (contenedor) {
      inicializarContenedor(contenedor, api, options);
    });

    return true;
  }

  function redibujar(ref) {
    const api = obtenerAPI();

    if (!motorCompletoDisponible(api)) {
      console.error(MENSAJE_MOTOR_FALTANTE);
      return false;
    }

    const contenedor =
      typeof ref === "string" ? document.getElementById(ref) : ref;

    if (!contenedor) return false;

    return inicializarContenedor(contenedor, api, { force: true });
  }

  function reinicializarTodo() {
    return inicializar(document, { force: true });
  }

  function autoInicializar() {
    inicializar(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInicializar);
  } else {
    autoInicializar();
  }

  window.RectaIntervalosAuto = {
    inicializar: inicializar,
    redibujar: redibujar,
    reinicializarTodo: reinicializarTodo,
    autoInicializar: autoInicializar,
    obtenerAPI: obtenerAPI,
    obtenerDefinicionDesdeContenedor: obtenerDefinicionDesdeContenedor
  };
})(window, document);
