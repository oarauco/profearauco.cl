(function (window, document) {
  "use strict";

  function normalizarToken(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
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
        : `oa_conjuntos_canvas_${Math.random().toString(36).slice(2, 10)}`;
      canvas.id = base;
    }

    return canvas;
  }

  function obtenerAPI() {
    const api = window.DiagramasVenn || {};

    return {
      crearDiagramaConjuntos: api.crearDiagramaConjuntos || window.crearDiagramaConjuntos,
      crearDiagramaConjuntos2: api.crearDiagramaConjuntos2 || window.crearDiagramaConjuntos2,
      crearDiagramaConjuntos3: api.crearDiagramaConjuntos3 || window.crearDiagramaConjuntos3
    };
  }

  function obtenerDefinicionDesdeContenedor(contenedor) {
    if (contenedor.classList.contains("diagrama-conjuntos2-auto")) {
      return {
        fnName: "crearDiagramaConjuntos2",
        width: 760,
        height: 500
      };
    }

    if (contenedor.classList.contains("diagrama-conjuntos3-auto")) {
      return {
        fnName: "crearDiagramaConjuntos3",
        width: 800,
        height: 560
      };
    }

    const tipo = normalizarToken(contenedor.getAttribute("data-tipo") || "");

    if (tipo === "conjuntos2" || tipo === "venn2" || tipo === "2") {
      return {
        fnName: "crearDiagramaConjuntos2",
        width: 500,
        height: 500
      };
    }

    if (tipo === "conjuntos3" || tipo === "venn3" || tipo === "3") {
      return {
        fnName: "crearDiagramaConjuntos3",
        width: 500,
        height: 560
      };
    }

    return null;
  }

  function inicializarContenedorConjuntos(contenedor) {
    const def = obtenerDefinicionDesdeContenedor(contenedor);
    if (!def) return;

    const api = obtenerAPI();
    const fn = api[def.fnName];

    if (typeof fn !== "function") {
      console.warn(`La función ${def.fnName} no está disponible.`, contenedor);
      return;
    }

    const config = parsearJSONDeAtributo(contenedor, "data-config", {});
    const width = leerNumero(contenedor, "data-width", config.width || def.width);
    const height = leerNumero(contenedor, "data-height", config.height || def.height);

    const canvas = asegurarCanvas(contenedor, width, height);
    fn(canvas.id, config);

    contenedor.setAttribute("data-auto-inicializado", "1");
  }

  function inicializarDiagramasConjuntosAuto(root = document) {
    const selector = [
      ".diagrama-conjuntos2-auto",
      ".diagrama-conjuntos3-auto",
      ".diagrama-conjuntos-auto[data-tipo]"
    ].join(",");

    root.querySelectorAll(selector).forEach(inicializarContenedorConjuntos);
  }

  function redibujarDiagramaConjuntos(ref) {
    const contenedor =
      typeof ref === "string"
        ? document.getElementById(ref)
        : ref;

    if (!contenedor) return;

    inicializarContenedorConjuntos(contenedor);
  }

  function iniciarCuandoEsteListo() {
    inicializarDiagramasConjuntosAuto();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarCuandoEsteListo);
  } else {
    iniciarCuandoEsteListo();
  }

  window.inicializarDiagramasConjuntosAuto = inicializarDiagramasConjuntosAuto;
  window.redibujarDiagramaConjuntos = redibujarDiagramaConjuntos;

  window.DiagramasVennAuto = {
    obtenerDefinicionDesdeContenedor,
    inicializarContenedorConjuntos,
    inicializarDiagramasConjuntosAuto,
    redibujarDiagramaConjuntos
  };

})(window, document);
