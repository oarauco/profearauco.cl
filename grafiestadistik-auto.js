(function (window, document) {
  "use strict";

  function obtenerAPI() {
    const api = window.GrafiEstadistik || {};

    return {
      dibujarGraficoBarra: api.dibujarGraficoBarra || window.dibujarGraficoBarra,
      dibujarPictograma: api.dibujarPictograma || window.dibujarPictograma,
      dibujarHistograma: api.dibujarHistograma || window.dibujarHistograma,
      dibujarGraficoCircular: api.dibujarGraficoCircular || window.dibujarGraficoCircular,
      dibujarGraficoCaja: api.dibujarGraficoCaja || window.dibujarGraficoCaja,
      dibujarOjiva: api.dibujarOjiva || window.dibujarOjiva,
      dibujarGraficoDispersion: api.dibujarGraficoDispersion || window.dibujarGraficoDispersion,
      dibujarGraficoLineas: api.dibujarGraficoLineas || window.dibujarGraficoLineas
    };
  }

  function parsearJSONAttr(el, nombre, fallback) {
    const raw = el.dataset[nombre];
    if (raw === undefined || raw === null || raw === "") return fallback;

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error(`Error al parsear data-${nombre}:`, error, el);
      return fallback;
    }
  }

  function parsearNumeroAttr(el, nombre, fallback = null) {
    const raw = el.dataset[nombre];
    if (raw === undefined || raw === null || raw === "") return fallback;

    const valor = parseFloat(raw);
    return Number.isFinite(valor) ? valor : fallback;
  }

  function parsearEnteroAttr(el, nombre, fallback = null) {
    const raw = el.dataset[nombre];
    if (raw === undefined || raw === null || raw === "") return fallback;

    const valor = parseInt(raw, 10);
    return Number.isInteger(valor) ? valor : fallback;
  }

  function inicializarGraficosBarra(api) {
    document.querySelectorAll(".grafico-barra-auto").forEach(function (div) {
      try {
        const id = div.id;
        const frecuencias = parsearJSONAttr(div, "frecuencias", []);
        const etiquetasX = parsearJSONAttr(div, "etiquetas", []);
        const color = div.dataset.color || "#ccc";
        const minY = parsearNumeroAttr(div, "minY", null);
        const maxY = parsearNumeroAttr(div, "maxY", null);
        const ticksY = parsearEnteroAttr(div, "ticksY", null);
        const posicionEtiquetas = parsearEnteroAttr(div, "posicionEtiquetas", 1);

        if (
          id &&
          Array.isArray(frecuencias) &&
          Array.isArray(etiquetasX) &&
          frecuencias.length === etiquetasX.length &&
          frecuencias.length > 0
        ) {
          api.dibujarGraficoBarra(
            id,
            frecuencias,
            etiquetasX,
            color,
            minY,
            maxY,
            ticksY,
            posicionEtiquetas
          );
        }
      } catch (error) {
        console.error("Error en gráfico de barras:", error, div);
      }
    });
  }

  function inicializarPictogramas(api) {
    document.querySelectorAll(".pictograma-auto").forEach(function (div) {
      try {
        const id = div.id;
        const datos = parsearJSONAttr(div, "datos", []);
        const icono = div.dataset.icono || "";
        const valorPorIcono = parsearNumeroAttr(div, "valorPorIcono", null);
        const color = div.dataset.color || "#666";

        if (
          id &&
          Array.isArray(datos) &&
          datos.length > 0 &&
          icono &&
          Number.isFinite(valorPorIcono) &&
          valorPorIcono > 0
        ) {
          api.dibujarPictograma(id, datos, icono, valorPorIcono, color);
        }
      } catch (error) {
        console.error("Error en pictograma:", error, div);
      }
    });
  }

  function inicializarHistogramas(api) {
    document.querySelectorAll(".histograma-auto").forEach(function (div) {
      try {
        const id = div.id;
        const frecuencias = parsearJSONAttr(div, "frecuencias", []);
        const limites = parsearJSONAttr(div, "limites", []);
        const color = div.dataset.color || "#ccc";
        const minY = parsearNumeroAttr(div, "minY", null);
        const maxY = parsearNumeroAttr(div, "maxY", null);
        const ticksY = parsearEnteroAttr(div, "ticksY", null);

        if (
          id &&
          Array.isArray(frecuencias) &&
          Array.isArray(limites) &&
          frecuencias.length > 0 &&
          limites.length === frecuencias.length + 1
        ) {
          api.dibujarHistograma(id, frecuencias, limites, color, minY, maxY, ticksY);
        }
      } catch (error) {
        console.error("Error en histograma:", error, div);
      }
    });
  }

  function inicializarGraficosCirculares(api) {
    document.querySelectorAll(".grafico-circular-auto").forEach(function (div) {
      try {
        const id = div.id;
        const datos = parsearJSONAttr(div, "datos", []);

        if (id && Array.isArray(datos) && datos.length > 0) {
          api.dibujarGraficoCircular(id, datos);
        }
      } catch (error) {
        console.error("Error en gráfico circular:", error, div);
      }
    });
  }

  function inicializarGraficosCaja(api) {
    document.querySelectorAll(".caja-auto").forEach(function (div) {
      try {
        const id = div.id;
        const valores = parsearJSONAttr(div, "valores", null);
        const color = div.dataset.color || "rgba(255, 159, 64, 0.5)";

        if (id && valores && typeof valores === "object") {
          api.dibujarGraficoCaja(id, valores, color);
        }
      } catch (error) {
        console.error("Error en gráfico de caja:", error, div);
      }
    });
  }

  function inicializarOjivas(api) {
    document.querySelectorAll(".ojiva-auto").forEach(function (div) {
      try {
        const id = div.id;
        const limites = parsearJSONAttr(div, "limites", []);
        const frecuenciasAcumuladas = parsearJSONAttr(div, "frecuenciasAcumuladas", []);
        const color = div.dataset.color || "#4bc0c0";
        const minY = parsearNumeroAttr(div, "minY", null);
        const maxY = parsearNumeroAttr(div, "maxY", null);
        const ticksY = parsearEnteroAttr(div, "ticksY", null);

        let etiquetasEjes = parsearJSONAttr(div, "etiquetasEjes", {});
        etiquetasEjes = {
          x: etiquetasEjes.x || div.dataset.etiquetaX || "Valor observado",
          y: etiquetasEjes.y || div.dataset.etiquetaY || "Frecuencia acumulada"
        };

        if (
          id &&
          Array.isArray(limites) &&
          Array.isArray(frecuenciasAcumuladas) &&
          limites.length > 0 &&
          frecuenciasAcumuladas.length > 0
        ) {
          api.dibujarOjiva(
            id,
            limites,
            frecuenciasAcumuladas,
            color,
            minY,
            maxY,
            ticksY,
            etiquetasEjes
          );
        }
      } catch (error) {
        console.error("Error en ojiva:", error, div);
      }
    });
  }

  function inicializarGraficosDispersion(api) {
    document.querySelectorAll(".grafico-dispersion-auto").forEach(function (div) {
      try {
        const id = div.id;
        const puntos = parsearJSONAttr(div, "puntos", []);
        const etiquetas = parsearJSONAttr(div, "etiquetas", {});
        const color = div.dataset.color || "steelblue";

        if (id && Array.isArray(puntos) && puntos.length > 0) {
          api.dibujarGraficoDispersion(id, puntos, etiquetas, color);
        }
      } catch (error) {
        console.error("Error en gráfico de dispersión:", error, div);
      }
    });
  }

  function inicializarGraficosLineas(api) {
    document.querySelectorAll(".grafico-lineas-auto").forEach(function (div) {
      try {
        const id = div.id;
        const etiquetasX = parsearJSONAttr(div, "etiquetasX", []);
        const valoresY = parsearJSONAttr(div, "valoresY", []);
        const etiquetasEjes = parsearJSONAttr(div, "etiquetasEjes", {});
        const color = div.dataset.color || "#3e95cd";

        if (
          id &&
          Array.isArray(etiquetasX) &&
          Array.isArray(valoresY) &&
          etiquetasX.length === valoresY.length &&
          etiquetasX.length > 0
        ) {
          api.dibujarGraficoLineas(id, etiquetasX, valoresY, etiquetasEjes, color);
        }
      } catch (error) {
        console.error("Error en gráfico de líneas:", error, div);
      }
    });
  }

  function inicializarTodo() {
    const api = obtenerAPI();

    if (
      !api.dibujarGraficoBarra ||
      !api.dibujarPictograma ||
      !api.dibujarHistograma ||
      !api.dibujarGraficoCircular ||
      !api.dibujarGraficoCaja ||
      !api.dibujarOjiva ||
      !api.dibujarGraficoDispersion ||
      !api.dibujarGraficoLineas
    ) {
      console.error(
        "grafiestadistik-auto.js: no se encontró el motor completo. Asegúrate de cargar antes grafiestadistik-motor.js"
      );
      return;
    }

    inicializarGraficosBarra(api);
    inicializarPictogramas(api);
    inicializarHistogramas(api);
    inicializarGraficosCirculares(api);
    inicializarGraficosCaja(api);
    inicializarOjivas(api);
    inicializarGraficosDispersion(api);
    inicializarGraficosLineas(api);
  }

  document.addEventListener("DOMContentLoaded", inicializarTodo);

})(window, document);
