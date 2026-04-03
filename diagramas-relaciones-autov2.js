(function (window, document) {
  "use strict";

  let contadorAutoCanvas = 0;

  const MENSAJE_MOTOR_FALTANTE =
    "diagramas-relaciones-auto.js: no se encontró window.DiagramasRelaciones. Asegúrate de cargar antes diagramas-relaciones.js";

  function obtenerAPI() {
    return window.DiagramasRelaciones || null;
  }

  function motorCompletoDisponible(api) {
    return !!(
      api &&
      typeof api.crearDiagramaSagital === "function" &&
      typeof api.crearDiagramaComposicion === "function" &&
      typeof api.crearDiagramaAutoSagital === "function" &&
      typeof api.crearGrafoRelacion === "function"
    );
  }

  function normalizarRoot(root) {
    if (root && typeof root.querySelectorAll === "function") return root;
    return document;
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

  function asegurarCanvas(contenedor, width, height) {
    let canvas = contenedor.querySelector("canvas.oa-diagrama-auto-canvas");

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "oa-diagrama-auto-canvas";
      contenedor.innerHTML = "";
      contenedor.appendChild(canvas);
    }

    canvas.width = width;
    canvas.height = height;
    canvas.style.display = "block";
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    canvas.style.margin = "0 auto";

    if (!canvas.id) {
      const base = contenedor.id
        ? `${contenedor.id}__canvas`
        : `oa_auto_canvas_${++contadorAutoCanvas}`;
      canvas.id = base;
    }

    return canvas;
  }

  function obtenerDefinicionDesdeContenedor(contenedor) {
    if (contenedor.classList.contains("diagrama-sagital-auto")) {
      return {
        fnName: "crearDiagramaSagital",
        width: 620,
        height: 420
      };
    }

    if (contenedor.classList.contains("diagrama-composicion-auto")) {
      return {
        fnName: "crearDiagramaComposicion",
        width: 700,
        height: 460
      };
    }

    if (contenedor.classList.contains("diagrama-autosagital-auto")) {
      return {
        fnName: "crearDiagramaAutoSagital",
        width: 650,
        height: 440
      };
    }

    if (contenedor.classList.contains("grafo-relacion-auto")) {
      return {
        fnName: "crearGrafoRelacion",
        width: 620,
        height: 420
      };
    }

    const tipo = (contenedor.getAttribute("data-tipo") || "")
      .trim()
      .toLowerCase();

    if (tipo === "sagital") {
      return { fnName: "crearDiagramaSagital", width: 620, height: 420 };
    }

    if (tipo === "composicion") {
      return { fnName: "crearDiagramaComposicion", width: 700, height: 460 };
    }

    if (tipo === "autosagital") {
      return { fnName: "crearDiagramaAutoSagital", width: 650, height: 440 };
    }

    if (tipo === "grafo" || tipo === "grafo-relacion") {
      return { fnName: "crearGrafoRelacion", width: 620, height: 420 };
    }

    return null;
  }

  function inicializarContenedor(contenedor, api) {
    const def = obtenerDefinicionDesdeContenedor(contenedor);
    if (!def) return false;

    const fn = api[def.fnName];
    if (typeof fn !== "function") {
      console.warn(
        `La función ${def.fnName} no está disponible en window.DiagramasRelaciones.`,
        contenedor
      );
      return false;
    }

    const config = parsearJSONDeAtributo(contenedor, "data-config", {});
    const width = leerNumero(
      contenedor,
      "data-width",
      config.width || def.width
    );
    const height = leerNumero(
      contenedor,
      "data-height",
      config.height || def.height
    );

    const canvas = asegurarCanvas(contenedor, width, height);
    fn(canvas.id, config);

    contenedor.setAttribute("data-auto-inicializado", "1");
    return true;
  }

  function inicializar(root = document) {
    const api = obtenerAPI();
    const rootReal = normalizarRoot(root);

    if (!motorCompletoDisponible(api)) {
      console.error(MENSAJE_MOTOR_FALTANTE);
      return false;
    }

    const selector = [
      ".diagrama-sagital-auto",
      ".diagrama-composicion-auto",
      ".diagrama-autosagital-auto",
      ".grafo-relacion-auto",
      ".diagrama-auto[data-tipo]"
    ].join(",");

    rootReal.querySelectorAll(selector).forEach(function (contenedor) {
      inicializarContenedor(contenedor, api);
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

    return inicializarContenedor(contenedor, api);
  }

  function autoInicializar() {
    inicializar(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInicializar);
  } else {
    autoInicializar();
  }

  window.DiagramasRelacionesAuto = {
    inicializar: inicializar,
    redibujar: redibujar,
    autoInicializar: autoInicializar,
    obtenerAPI: obtenerAPI
  };
})(window, document);