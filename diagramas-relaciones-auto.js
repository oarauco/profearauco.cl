(() => {
  "use strict";

  let contadorAutoCanvas = 0;

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
        fn: "crearDiagramaSagital",
        width: 620,
        height: 420,
      };
    }

    if (contenedor.classList.contains("diagrama-composicion-auto")) {
      return {
        fn: "crearDiagramaComposicion",
        width: 700,
        height: 460,
      };
    }

    if (contenedor.classList.contains("diagrama-autosagital-auto")) {
      return {
        fn: "crearDiagramaAutoSagital",
        width: 650,
        height: 440,
      };
    }

    if (contenedor.classList.contains("grafo-relacion-auto")) {
      return {
        fn: "crearGrafoRelacion",
        width: 620,
        height: 420,
      };
    }

    const tipo = (contenedor.getAttribute("data-tipo") || "")
      .trim()
      .toLowerCase();

    if (tipo === "sagital") {
      return { fn: "crearDiagramaSagital", width: 620, height: 420 };
    }
    if (tipo === "composicion") {
      return { fn: "crearDiagramaComposicion", width: 700, height: 460 };
    }
    if (tipo === "autosagital") {
      return { fn: "crearDiagramaAutoSagital", width: 650, height: 440 };
    }
    if (tipo === "grafo" || tipo === "grafo-relacion") {
      return { fn: "crearGrafoRelacion", width: 620, height: 420 };
    }

    return null;
  }

  function inicializarContenedor(contenedor) {
    const def = obtenerDefinicionDesdeContenedor(contenedor);
    if (!def) return;

    const fn = window[def.fn];
    if (typeof fn !== "function") {
      console.warn(
        `La función ${def.fn} no está disponible. Asegúrate de cargar antes el script motor.`,
        contenedor,
      );
      return;
    }

    const config = parsearJSONDeAtributo(contenedor, "data-config", {});
    const width = leerNumero(
      contenedor,
      "data-width",
      config.width || def.width,
    );
    const height = leerNumero(
      contenedor,
      "data-height",
      config.height || def.height,
    );

    const canvas = asegurarCanvas(contenedor, width, height);
    fn(canvas.id, config);

    contenedor.setAttribute("data-auto-inicializado", "1");
  }

  function inicializarDiagramasAuto(root = document) {
    const selector = [
      ".diagrama-sagital-auto",
      ".diagrama-composicion-auto",
      ".diagrama-autosagital-auto",
      ".grafo-relacion-auto",
      ".diagrama-auto[data-tipo]",
    ].join(",");

    root.querySelectorAll(selector).forEach(inicializarContenedor);
  }

  function redibujarDiagramaAuto(ref) {
    const contenedor =
      typeof ref === "string" ? document.getElementById(ref) : ref;

    if (!contenedor) return;
    inicializarContenedor(contenedor);
  }

  window.inicializarDiagramasAuto = inicializarDiagramasAuto;
  window.redibujarDiagramaAuto = redibujarDiagramaAuto;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      inicializarDiagramasAuto();
    });
  } else {
    inicializarDiagramasAuto();
  }
})();
