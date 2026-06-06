(function (window) {
  "use strict";

  /* ========================================================================== */
  /* UTILIDADES                                                                 */
  /* ========================================================================== */ 

  const TEMA_PREMIUM = Object.freeze({
    fondo: "#ffffff",
    texto: "#243241",
    textoSuave: "#64748b",
    eje: "#708090",
    grilla: "#e8edf3",
    borde: "#c8d2de",
    colores: [
      "#356f9f",
      "#4f9d69",
      "#c95056",
      "#7a68b3",
      "#d28a39",
      "#2f8f9d",
      "#a1588f",
      "#607d3b"
    ]
  });

  function obtenerContenedor(contenedorId) {
    if (!contenedorId) return null;
    return document.getElementById(contenedorId);
  }

  function formatearNumero(valor) {
    const redondeado = Math.round(Number(valor) * 100) / 100;
    if (Number.isInteger(redondeado)) return String(redondeado);
    return String(redondeado).replace(".", ",");
  }

  function escaparHTML(valor) {
    return String(valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizarColor(valor, fallback) {
    const texto = String(valor || "").trim();
    const colorValido =
      /^#[0-9a-fA-F]{3,8}$/.test(texto) ||
      /^[a-zA-Z]+$/.test(texto) ||
      /^rgba?\([0-9\s.,%+-]+\)$/.test(texto) ||
      /^hsla?\([0-9\s.,%+-]+\)$/.test(texto);

    return colorValido ? texto : fallback;
  }

  function normalizarPathSVG(valor) {
    const texto = String(valor || "").trim();
    return /^[MmZzLlHhVvCcSsQqTtAa0-9,\s.\-+eE]+$/.test(texto) ? texto : "";
  }

  function normalizarIdFragment(valor) {
    return String(valor || "grafico").replace(/[^a-zA-Z0-9_-]/g, "-");
  }

  function limitarNumero(valor, fallback, min, max) {
    if (valor === null || valor === undefined || valor === "") return fallback;

    const numero = Number(valor);
    if (!Number.isFinite(numero)) return fallback;
    return Math.min(max, Math.max(min, numero));
  }

  function calcularPasoSeguro(min, max, stepManual, ticksManual, ticksPorDefecto = 5) {
    const rango = Math.abs(max - min) || 1;
    const divisionesMaximas = 40;

    if (Number.isFinite(stepManual) && stepManual > 0 && rango / stepManual <= divisionesMaximas) {
      return stepManual;
    }

    const ticks = Number.isInteger(ticksManual)
      ? Math.min(divisionesMaximas, Math.max(1, ticksManual))
      : ticksPorDefecto;

    return rango / ticks;
  }

  function calcularMaxYBonito(maxDatoY) {
    if (!Number.isFinite(maxDatoY)) return 1;

    if (maxDatoY <= 5) {
      return Math.ceil(maxDatoY);
    }

    const potencia = Math.pow(10, Math.floor(Math.log10(maxDatoY)));
    const proporcion = maxDatoY / potencia;

    let maxY;
    if (proporcion <= 1) maxY = 1 * potencia;
    else if (proporcion <= 2) maxY = 2 * potencia;
    else if (proporcion <= 5) maxY = 5 * potencia;
    else maxY = 10 * potencia;

    if (maxY < maxDatoY) {
      if (maxY === 1 * potencia) maxY = 2 * potencia;
      else if (maxY === 2 * potencia) maxY = 5 * potencia;
      else maxY = 10 * potencia;
    }

    return maxY;
  }

  function normalizarRangoY(minY, maxY, maxDatoY) {
    if (!Number.isFinite(minY)) minY = 0;
    if (!Number.isFinite(maxY)) maxY = calcularMaxYBonito(maxDatoY);

    if (minY === maxY) maxY = minY + 1;

    if (minY > maxY) {
      const aux = minY;
      minY = maxY;
      maxY = aux;
    }

    return { minY, maxY };
  }

  function calcularTicksY(minY, maxY, ticksY) {
    if (Number.isInteger(ticksY) && ticksY > 0) return ticksY;

    const rangoEstimado = maxY - minY;

    if (rangoEstimado <= 5) return Math.max(1, Math.round(rangoEstimado));
    if (rangoEstimado <= 10) return 5;
    if (rangoEstimado <= 20) return 4;
    if (rangoEstimado <= 50) return 5;

    return 5;
  }

  function normalPDF(x, media = 0, desviacion = 1) {
    const z = (x - media) / desviacion;
    return Math.exp(-0.5 * z * z) / (desviacion * Math.sqrt(2 * Math.PI));
  }

  function calcularCombinacion(n, k) {
    if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) return 0;

    k = Math.min(k, n - k);
    let resultado = 1;

    for (let i = 1; i <= k; i++) {
      resultado = (resultado * (n - k + i)) / i;
    }

    return resultado;
  }

  function calcularRegresionLineal(datos) {
    const n = datos.length;
    if (n < 2) return null;

    const sumaX = datos.reduce((sum, d) => sum + d.x, 0);
    const sumaY = datos.reduce((sum, d) => sum + d.y, 0);
    const mediaX = sumaX / n;
    const mediaY = sumaY / n;

    let ssXX = 0;
    let ssYY = 0;
    let ssXY = 0;

    datos.forEach((d) => {
      const dx = d.x - mediaX;
      const dy = d.y - mediaY;
      ssXX += dx * dx;
      ssYY += dy * dy;
      ssXY += dx * dy;
    });

    if (ssXX === 0 || ssYY === 0) return null;

    const pendiente = ssXY / ssXX;
    const intercepto = mediaY - pendiente * mediaX;
    const r = ssXY / Math.sqrt(ssXX * ssYY);

    return { pendiente, intercepto, r };
  }

  function crearSVGBase(anchoSVG, altoSVG) {
    return `
      <svg viewBox="0 0 ${anchoSVG} ${altoSVG}" role="img" style="width:100%; max-width:${anchoSVG}px; height:auto; display:block; font-family:Inter, Segoe UI, Arial, sans-serif;">
        <rect x="0" y="0" width="${anchoSVG}" height="${altoSVG}" fill="${TEMA_PREMIUM.fondo}" />
      `;
  }

  function lineaGrilla(x1, y1, x2, y2) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${TEMA_PREMIUM.grilla}" stroke-width="1" />`;
  }

  function lineaEje(x1, y1, x2, y2) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${TEMA_PREMIUM.eje}" stroke-width="1.2" stroke-linecap="round" />`;
  }

  function textoSVG(x, y, contenido, opciones = {}) {
    const anchor = opciones.anchor || "middle";
    const size = opciones.size || 11;
    const color = opciones.color || TEMA_PREMIUM.texto;
    const baseline = opciones.baseline ? ` dominant-baseline="${opciones.baseline}"` : "";
    const transform = opciones.transform ? ` transform="${opciones.transform}"` : "";

    return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}"${baseline}${transform}>${escaparHTML(contenido)}</text>`;
  }

  function tituloSVG(contenido) {
    return `<title>${escaparHTML(contenido)}</title>`;
  }

  /* ========================================================================== */
  /* GRÁFICO DE BARRAS                                                          */
  /* ========================================================================== */

  function dibujarGraficoBarra(
    contenedorId,
    frecuencias,
    etiquetasX,
    color,
    minY = null,
    maxY = null,
    ticksY = null,
    posicionEtiquetas = 1
  ) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor) return;
    if (!Array.isArray(frecuencias) || !Array.isArray(etiquetasX)) return;
    if (frecuencias.length === 0 || frecuencias.length !== etiquetasX.length) return;

    const margen = {
      top: 20,
      right: 20,
      bottom: posicionEtiquetas === 0 ? 85 : 50,
      left: 50
    };

    const anchoBarra = 28;
    const separacion = 18;
    const n = frecuencias.length;

    const anchoGrafico = n * anchoBarra + (n - 1) * separacion;
    const anchoSVG = margen.left + anchoGrafico + margen.right;
    const altoSVG = 260;
    const alto = altoSVG - margen.top - margen.bottom;
    const baseY = margen.top + alto;

    const maxDatoY = Math.max(...frecuencias);
    const rango = normalizarRangoY(minY, maxY, maxDatoY);
    minY = rango.minY;
    maxY = rango.maxY;
    ticksY = calcularTicksY(minY, maxY, ticksY);

    const rangoY = (maxY - minY) || 1;
    const pasoY = rangoY / ticksY;

    const escalaY = (valor) =>
      margen.top + alto - ((valor - minY) / rangoY) * alto;

    const colorBarra = normalizarColor(color, TEMA_PREMIUM.colores[0]);
    let svg = crearSVGBase(anchoSVG, altoSVG);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaGrilla(margen.left, y, margen.left + anchoGrafico, y);
    }

    svg += lineaEje(margen.left, margen.top, margen.left, baseY);
    svg += lineaEje(margen.left, baseY, margen.left + anchoGrafico, baseY);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaEje(margen.left - 5, y, margen.left, y);
      svg += textoSVG(margen.left - 10, y, formatearNumero(valY), {
        anchor: "end",
        baseline: "middle",
        color: TEMA_PREMIUM.textoSuave
      });
    }

    frecuencias.forEach((frec, i) => {
      const x = margen.left + i * (anchoBarra + separacion);
      const y = escalaY(frec);
      const altura = escalaY(minY) - y;
      const etiqueta = etiquetasX[i];

      svg += `<rect x="${x}" y="${y}" width="${anchoBarra}" height="${altura}" rx="3" fill="${colorBarra}" opacity="0.92">${tituloSVG(`${etiquetasX[i]}: ${formatearNumero(frec)}`)}</rect>`;
      svg += textoSVG(x + anchoBarra / 2, y - 6, formatearNumero(frec), {
        size: 10,
        color: TEMA_PREMIUM.texto
      });

      if (posicionEtiquetas === 0) {
        svg += textoSVG(x + anchoBarra / 2, baseY + 8, etiqueta, {
          anchor: "end",
          color: TEMA_PREMIUM.textoSuave,
          transform: `rotate(-90 ${x + anchoBarra / 2},${baseY + 8})`
        });
      } else {
        svg += textoSVG(x + anchoBarra / 2, baseY + 18, etiqueta, {
          color: TEMA_PREMIUM.textoSuave
        });
      }
    });

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  /* ========================================================================== */
  /* GRÁFICO DE BARRAS MÚLTIPLES                                                */
  /* ========================================================================== */

  function dibujarGraficoBarrasMultiples(contenedorId, series, etiquetasX, opciones = {}) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor) return;
    if (!Array.isArray(series) || !Array.isArray(etiquetasX)) return;
    if (series.length < 2 || etiquetasX.length === 0) return;

    const seriesValidas = series
      .map((serie, index) => {
        const valoresRaw = Array.isArray(serie)
          ? serie
          : serie && Array.isArray(serie.valores)
            ? serie.valores
            : null;

        if (!valoresRaw || valoresRaw.length !== etiquetasX.length) return null;

        const valores = valoresRaw.map(Number);
        if (!valores.every(Number.isFinite)) return null;

        return {
          nombre: serie.nombre || serie.label || serie.etiqueta || `Serie ${index + 1}`,
          color: normalizarColor(serie.color, TEMA_PREMIUM.colores[index % TEMA_PREMIUM.colores.length]),
          valores
        };
      })
      .filter(Boolean);

    if (seriesValidas.length < 2) return;

    opciones = opciones && typeof opciones === "object" ? opciones : {};

    const posicionEtiquetas = Number.isInteger(opciones.posicionEtiquetas)
      ? opciones.posicionEtiquetas
      : 1;

    let minY = Number.isFinite(opciones.minY) ? Number(opciones.minY) : null;
    let maxY = Number.isFinite(opciones.maxY) ? Number(opciones.maxY) : null;
    let ticksY =
      Number.isInteger(opciones.ticksY) && opciones.ticksY > 0
        ? opciones.ticksY
        : null;

    const margen = {
      top: 42,
      right: 20,
      bottom: posicionEtiquetas === 0 ? 92 : 62,
      left: 50
    };

    const cantidadSeries = seriesValidas.length;
    const anchoBarra = Math.max(10, Math.min(18, 42 / cantidadSeries));
    const separacionInterna = cantidadSeries > 3 ? 4 : 6;
    const separacionGrupo = 22;
    const anchoGrupo = cantidadSeries * anchoBarra + (cantidadSeries - 1) * separacionInterna;
    const n = etiquetasX.length;

    const anchoGrafico = n * anchoGrupo + (n - 1) * separacionGrupo;
    const anchoSVG = margen.left + anchoGrafico + margen.right;
    const altoSVG = 280;
    const alto = altoSVG - margen.top - margen.bottom;
    const baseY = margen.top + alto;

    const maxDatoY = Math.max(...seriesValidas.flatMap((serie) => serie.valores));
    const rango = normalizarRangoY(minY, maxY, maxDatoY);
    minY = rango.minY;
    maxY = rango.maxY;
    ticksY = calcularTicksY(minY, maxY, ticksY);

    const rangoY = (maxY - minY) || 1;
    const pasoY = rangoY / ticksY;
    const escalaY = (valor) =>
      margen.top + alto - ((valor - minY) / rangoY) * alto;

    let svg = crearSVGBase(anchoSVG, altoSVG);

    let leyendaX = margen.left;
    seriesValidas.forEach((serie) => {
      svg += `<rect x="${leyendaX}" y="14" width="10" height="10" rx="2" fill="${serie.color}" />`;
      svg += textoSVG(leyendaX + 16, 23, serie.nombre, {
        anchor: "start",
        color: TEMA_PREMIUM.textoSuave
      });
      leyendaX += Math.max(86, String(serie.nombre).length * 7 + 34);
    });

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaGrilla(margen.left, y, margen.left + anchoGrafico, y);
    }

    svg += lineaEje(margen.left, margen.top, margen.left, baseY);
    svg += lineaEje(margen.left, baseY, margen.left + anchoGrafico, baseY);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaEje(margen.left - 5, y, margen.left, y);
      svg += textoSVG(margen.left - 10, y, formatearNumero(valY), {
        anchor: "end",
        baseline: "middle",
        color: TEMA_PREMIUM.textoSuave
      });
    }

    etiquetasX.forEach((etiqueta, i) => {
      const xGrupo = margen.left + i * (anchoGrupo + separacionGrupo);
      seriesValidas.forEach((serie, serieIndex) => {
        const x = xGrupo + serieIndex * (anchoBarra + separacionInterna);
        const y = escalaY(serie.valores[i]);
        const altura = escalaY(minY) - y;

        svg += `<rect x="${x}" y="${y}" width="${anchoBarra}" height="${altura}" rx="3" fill="${serie.color}" opacity="0.92">${tituloSVG(`${etiqueta} - ${serie.nombre}: ${formatearNumero(serie.valores[i])}`)}</rect>`;

        if (cantidadSeries <= 3) {
          svg += textoSVG(x + anchoBarra / 2, y - 6, formatearNumero(serie.valores[i]), {
            size: 10,
            color: TEMA_PREMIUM.texto
          });
        }
      });

      const xEtiqueta = xGrupo + anchoGrupo / 2;
      if (posicionEtiquetas === 0) {
        svg += textoSVG(xEtiqueta, baseY + 8, etiqueta, {
          anchor: "end",
          color: TEMA_PREMIUM.textoSuave,
          transform: `rotate(-90 ${xEtiqueta},${baseY + 8})`
        });
      } else {
        svg += textoSVG(xEtiqueta, baseY + 20, etiqueta, {
          color: TEMA_PREMIUM.textoSuave
        });
      }
    });

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  function dibujarGraficoBarrasDobles(
    contenedorId,
    serieA,
    serieB,
    etiquetasX,
    opciones = {}
  ) {
    opciones = opciones && typeof opciones === "object" ? opciones : {};

    return dibujarGraficoBarrasMultiples(
      contenedorId,
      [
        {
          nombre: opciones.nombreA || opciones.etiquetaA || "Serie A",
          color: opciones.colorA || TEMA_PREMIUM.colores[0],
          valores: serieA
        },
        {
          nombre: opciones.nombreB || opciones.etiquetaB || "Serie B",
          color: opciones.colorB || TEMA_PREMIUM.colores[2],
          valores: serieB
        }
      ],
      etiquetasX,
      opciones
    );
  }

  /* ========================================================================== */
  /* PICTOGRAMA                                                                 */
  /* ========================================================================== */

  function dibujarPictograma(contenedorId, datos, icono, valorPorIcono, color) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor || !Array.isArray(datos) || !icono) return;

    valorPorIcono = Number(valorPorIcono);
    if (!Number.isFinite(valorPorIcono) || valorPorIcono <= 0) return;

    const datosValidos = datos
      .filter(
        (item) =>
          item &&
          typeof item.label !== "undefined" &&
          Number.isFinite(Number(item.valor)) &&
          Number(item.valor) >= 0
      )
      .map((item) => ({
        label: String(item.label),
        valor: Number(item.valor)
      }));

    if (datosValidos.length === 0) return;

    const iconoSeguro = normalizarPathSVG(icono);
    if (!iconoSeguro) return;

    const colorIcono = normalizarColor(color, TEMA_PREMIUM.colores[0]);
    const tamañoIcono = 24;

    let tablaHTML = `<table class="tabla-pictograma" style="border-collapse:collapse; width:100%; font-family:Inter, Segoe UI, Arial, sans-serif; color:${TEMA_PREMIUM.texto};">`;
    let defsSVG = `<svg width="0" height="0" style="position:absolute;"><defs>`;

    datosValidos.forEach((item, index) => {
      const numIconosCompletos = Math.floor(item.valor / valorPorIcono);
      const valorRestante = item.valor - numIconosCompletos * valorPorIcono;
      const fraccionIcono = Math.max(0, Math.min(1, valorRestante / valorPorIcono));

      let iconosHTML = "";

      for (let i = 0; i < numIconosCompletos; i++) {
        iconosHTML += `
          <svg width="${tamañoIcono}" height="${tamañoIcono}" viewBox="0 0 24 24" fill="${colorIcono}" style="margin-right:4px;">
            ${tituloSVG(`${item.label}: ${formatearNumero(item.valor)}`)}
            <path d="${iconoSeguro}"></path>
          </svg>`;
      }

      if (fraccionIcono > 0) {
        const clipId = `clip-${normalizarIdFragment(contenedorId)}-${index}`;
        defsSVG += `
          <clipPath id="${clipId}">
            <rect x="0" y="0" width="${24 * fraccionIcono}" height="24"></rect>
          </clipPath>`;

        iconosHTML += `
          <svg width="${tamañoIcono}" height="${tamañoIcono}" viewBox="0 0 24 24" fill="${colorIcono}" style="margin-right:4px;">
            ${tituloSVG(`${item.label}: ${formatearNumero(item.valor)}`)}
            <g clip-path="url(#${clipId})">
              <path d="${iconoSeguro}"></path>
            </g>
          </svg>`;
      }

      if (!iconosHTML) {
        iconosHTML = `<span style="color:${TEMA_PREMIUM.textoSuave};">0</span>`;
      }

      tablaHTML += `
        <tr>
          <td style="padding:9px 10px; text-align:right; font-weight:600; width:30%; border-bottom:1px solid ${TEMA_PREMIUM.grilla};">${escaparHTML(item.label)}</td>
          <td style="padding:9px 10px; text-align:left; border-bottom:1px solid ${TEMA_PREMIUM.grilla};">${iconosHTML}</td>
        </tr>`;
    });

    defsSVG += `</defs></svg>`;
    tablaHTML += `</table>`;

    contenedor.innerHTML = defsSVG + tablaHTML;
  }

  /* ========================================================================== */
  /* HISTOGRAMA                                                                 */
  /* ========================================================================== */

  function dibujarHistograma(
    contenedorId,
    frecuencias,
    limites,
    color,
    minY = null,
    maxY = null,
    ticksY = null
  ) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor) return;
    if (!Array.isArray(frecuencias) || !Array.isArray(limites)) return;
    if (frecuencias.length === 0 || limites.length !== frecuencias.length + 1) return;

    const margen = { top: 20, right: 20, bottom: 40, left: 50 };
    const anchoSVG = 400;
    const altoSVG = 220;
    const ancho = anchoSVG - margen.left - margen.right;
    const alto = altoSVG - margen.top - margen.bottom;

    const maxDatoY = Math.max(...frecuencias);
    const rango = normalizarRangoY(minY, maxY, maxDatoY);
    minY = rango.minY;
    maxY = rango.maxY;
    ticksY = calcularTicksY(minY, maxY, ticksY);

    const rangoY = (maxY - minY) || 1;
    const pasoY = rangoY / ticksY;
    const anchoBarra = ancho / frecuencias.length;

    const escalaY = (valor) =>
      margen.top + alto - ((valor - minY) / rangoY) * alto;

    const colorBarra = normalizarColor(color, TEMA_PREMIUM.colores[1]);
    let svg = crearSVGBase(anchoSVG, altoSVG);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaGrilla(margen.left, y, margen.left + ancho, y);
    }

    svg += lineaEje(margen.left, margen.top, margen.left, margen.top + alto);
    svg += lineaEje(margen.left, margen.top + alto, margen.left + ancho, margen.top + alto);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaEje(margen.left - 5, y, margen.left, y);
      svg += textoSVG(margen.left - 10, y, formatearNumero(valY), {
        anchor: "end",
        baseline: "middle",
        color: TEMA_PREMIUM.textoSuave
      });
    }

    frecuencias.forEach((frec, i) => {
      const x = margen.left + i * anchoBarra;
      const y = escalaY(frec);
      const altura = escalaY(minY) - y;

      svg += `<rect x="${x}" y="${y}" width="${anchoBarra}" height="${altura}" fill="${colorBarra}" stroke="${TEMA_PREMIUM.borde}" stroke-width="1" opacity="0.92">${tituloSVG(`${formatearNumero(limites[i])} - ${formatearNumero(limites[i + 1])}: ${formatearNumero(frec)}`)}</rect>`;
      svg += textoSVG(x + anchoBarra / 2, y - 6, formatearNumero(frec));
    });

    limites.forEach((limite, i) => {
      const x = margen.left + i * anchoBarra;
      svg += lineaEje(x, margen.top + alto, x, margen.top + alto + 5);
      svg += textoSVG(x, margen.top + alto + 18, formatearNumero(limite), {
        color: TEMA_PREMIUM.textoSuave
      });
    });

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  /* ========================================================================== */
  /* GRÁFICO CIRCULAR                                                           */
  /* ========================================================================== */

  function dibujarGraficoCircular(contenedorId, datos) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor || !Array.isArray(datos) || datos.length === 0) return;

    const datosValidos = datos
      .filter(
        (item) =>
          item &&
          typeof item.label !== "undefined" &&
          Number.isFinite(Number(item.valor)) &&
          Number(item.valor) >= 0
      )
      .map((item) => ({
        label: String(item.label),
        valor: Number(item.valor),
        color: normalizarColor(item.color, "")
      }));

    if (datosValidos.length === 0) return;

    const total = datosValidos.reduce((sum, item) => sum + item.valor, 0);

    if (total <= 0) {
      contenedor.innerHTML = `<div style="padding:12px; border:1px solid ${TEMA_PREMIUM.borde}; border-radius:8px; color:${TEMA_PREMIUM.textoSuave}; font-family:Inter, Segoe UI, Arial, sans-serif;">No hay datos suficientes para construir el gráfico circular.</div>`;
      return;
    }

    const tamaño = 200;
    const centro = tamaño / 2;
    const radio = tamaño / 2 - 10;

    const coloresPorDefecto = TEMA_PREMIUM.colores;

    let anguloInicio = -90;
    let svg = `<svg viewBox="0 0 ${tamaño} ${tamaño}" role="img" style="width:100%; max-width:${tamaño}px; height:auto; display:block; font-family:Inter, Segoe UI, Arial, sans-serif;">`;
    let leyendaHTML = `<div style="margin-left:20px; display:flex; flex-direction:column; justify-content:center; gap:6px; color:${TEMA_PREMIUM.texto}; font-family:Inter, Segoe UI, Arial, sans-serif;">`;

    function formatearPorcentaje(p) {
      const valor = p * 100;
      return Number.isInteger(valor)
        ? `${valor}%`
        : `${valor.toFixed(1).replace(".", ",")}%`;
    }

    datosValidos.forEach((item, index) => {
      const porcentaje = item.valor / total;
      const colorSector =
        item.color || coloresPorDefecto[index % coloresPorDefecto.length];

      if (item.valor > 0) {
        const anguloFin = anguloInicio + porcentaje * 360;

        const x1 = centro + radio * Math.cos((Math.PI / 180) * anguloInicio);
        const y1 = centro + radio * Math.sin((Math.PI / 180) * anguloInicio);
        const x2 = centro + radio * Math.cos((Math.PI / 180) * anguloFin);
        const y2 = centro + radio * Math.sin((Math.PI / 180) * anguloFin);

        const arcoGrande = porcentaje > 0.5 ? 1 : 0;

        if (porcentaje >= 0.999999) {
          svg += `<circle cx="${centro}" cy="${centro}" r="${radio}" fill="${colorSector}">${tituloSVG(`${item.label}: ${formatearNumero(item.valor)} (${formatearPorcentaje(porcentaje)})`)}</circle>`;
        } else {
          const pathData = `M ${centro},${centro} L ${x1},${y1} A ${radio},${radio} 0 ${arcoGrande},1 ${x2},${y2} Z`;
          svg += `<path d="${pathData}" fill="${colorSector}" stroke="${TEMA_PREMIUM.fondo}" stroke-width="1.5">${tituloSVG(`${item.label}: ${formatearNumero(item.valor)} (${formatearPorcentaje(porcentaje)})`)}</path>`;
        }

        anguloInicio = anguloFin;
      }

      leyendaHTML += `
        <div style="display:flex; align-items:center; font-size:14px;">
          <span style="width:11px; height:11px; background-color:${colorSector}; margin-right:8px; border-radius:3px;"></span>
          <span>${escaparHTML(item.label)} <span style="color:${TEMA_PREMIUM.textoSuave};">(${formatearPorcentaje(porcentaje)})</span></span>
        </div>
      `;
    });

    svg += `</svg>`;
    leyendaHTML += `</div>`;

    contenedor.style.display = "flex";
    contenedor.style.alignItems = "center";
    contenedor.style.flexWrap = "wrap";
    contenedor.innerHTML = svg + leyendaHTML;
  }

  /* ========================================================================== */
  /* GRÁFICO DE CAJA                                                            */
  /* ========================================================================== */

  function dibujarGraficoCaja(contenedorId, datos, color) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor || !datos || typeof datos !== "object") return;

    let { min, q1, mediana, q3, max, limiteMin, limiteMax, salto } = datos;

    min = Number(min);
    q1 = Number(q1);
    mediana = Number(mediana);
    q3 = Number(q3);
    max = Number(max);

    if (![min, q1, mediana, q3, max].every(Number.isFinite)) return;
    if (!(min <= q1 && q1 <= mediana && mediana <= q3 && q3 <= max)) return;

    function estimarSalto(rango) {
      if (rango <= 0) return 1;
      const bruto = rango / 5;
      const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
      const proporcion = bruto / potencia;

      if (proporcion <= 1) return 1 * potencia;
      if (proporcion <= 2) return 2 * potencia;
      if (proporcion <= 5) return 5 * potencia;
      return 10 * potencia;
    }

    const rangoDatos = max - min || 1;

    if (!Number.isFinite(limiteMin)) {
      limiteMin = Math.floor((min - 0.1 * rangoDatos) * 100) / 100;
    }
    if (!Number.isFinite(limiteMax)) {
      limiteMax = Math.ceil((max + 0.1 * rangoDatos) * 100) / 100;
    }

    if (limiteMin === limiteMax) {
      limiteMin -= 1;
      limiteMax += 1;
    }

    if (limiteMin > limiteMax) {
      const aux = limiteMin;
      limiteMin = limiteMax;
      limiteMax = aux;
    }

    limiteMin = Math.min(limiteMin, min);
    limiteMax = Math.max(limiteMax, max);

    const rangoTotal = limiteMax - limiteMin || 1;

    if (!Number.isFinite(salto) || salto <= 0) {
      salto = estimarSalto(rangoTotal);
    }

    const alturaSVG = 170;
    const anchoSVG = 420;
    const margen = { top: 20, right: 20, bottom: 45, left: 25 };
    const anchoGrafico = anchoSVG - margen.left - margen.right;

    const ejeY = 110;
    const cajaY = 55;
    const cajaAltura = 45;
    const yCentro = cajaY + cajaAltura / 2;

    const escalaX = (valor) =>
      margen.left + ((valor - limiteMin) / rangoTotal) * anchoGrafico;

    const colorCaja = normalizarColor(color, "rgba(210, 138, 57, 0.52)");

    let svg = crearSVGBase(anchoSVG, alturaSVG);

    const primerTick = Math.ceil(limiteMin / salto) * salto;

    for (let v = primerTick; v <= limiteMax + 1e-9; v += salto) {
      const x = escalaX(v);
      svg += lineaGrilla(x, margen.top, x, ejeY);
      svg += lineaEje(x, ejeY, x, ejeY + 5);
      svg += textoSVG(x, ejeY + 18, formatearNumero(v), {
        color: TEMA_PREMIUM.textoSuave
      });
    }

    svg += lineaEje(margen.left, ejeY, anchoSVG - margen.right, ejeY);

    const xQ1 = escalaX(q1);
    const xQ3 = escalaX(q3);
    const xMediana = escalaX(mediana);
    const xMin = escalaX(min);
    const xMax = escalaX(max);

    svg += `<rect x="${xQ1}" y="${cajaY}" width="${xQ3 - xQ1}" height="${cajaAltura}" rx="3" fill="${colorCaja}" stroke="${TEMA_PREMIUM.eje}" stroke-width="1.2">${tituloSVG(`Q1: ${formatearNumero(q1)}, Mediana: ${formatearNumero(mediana)}, Q3: ${formatearNumero(q3)}`)}</rect>`;
    svg += `<line x1="${xMediana}" y1="${cajaY}" x2="${xMediana}" y2="${cajaY + cajaAltura}" stroke="${TEMA_PREMIUM.texto}" stroke-width="2" stroke-linecap="round">${tituloSVG(`Mediana: ${formatearNumero(mediana)}`)}</line>`;

    svg += `<line x1="${xMin}" y1="${yCentro}" x2="${xQ1}" y2="${yCentro}" stroke="${TEMA_PREMIUM.eje}" stroke-width="1.2" stroke-linecap="round" />`;
    svg += `<line x1="${xQ3}" y1="${yCentro}" x2="${xMax}" y2="${yCentro}" stroke="${TEMA_PREMIUM.eje}" stroke-width="1.2" stroke-linecap="round" />`;

    svg += `<line x1="${xMin}" y1="${cajaY + 8}" x2="${xMin}" y2="${cajaY + cajaAltura - 8}" stroke="${TEMA_PREMIUM.eje}" stroke-width="1.2" stroke-linecap="round">${tituloSVG(`Minimo: ${formatearNumero(min)}`)}</line>`;
    svg += `<line x1="${xMax}" y1="${cajaY + 8}" x2="${xMax}" y2="${cajaY + cajaAltura - 8}" stroke="${TEMA_PREMIUM.eje}" stroke-width="1.2" stroke-linecap="round">${tituloSVG(`Maximo: ${formatearNumero(max)}`)}</line>`;

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  /* ========================================================================== */
  /* OJIVA                                                                      */
  /* ========================================================================== */

  function dibujarOjiva(
    contenedorId,
    limites,
    frecAcumuladas,
    color,
    minY = null,
    maxY = null,
    ticksY = null,
    etiquetasEjes = {}
  ) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor) return;
    if (!Array.isArray(limites) || !Array.isArray(frecAcumuladas)) return;
    if (limites.length === 0 || frecAcumuladas.length === 0) return;

    let xDatos = [];
    let yDatos = [];

    if (limites.length === frecAcumuladas.length) {
      xDatos = [...limites];
      yDatos = [...frecAcumuladas];
    } else if (limites.length === frecAcumuladas.length + 1) {
      xDatos = [...limites];
      yDatos = [0, ...frecAcumuladas];
    } else {
      console.error(
        "Error en ojiva: la longitud de limites no coincide con la de frecuencias acumuladas.",
        { limites, frecAcumuladas }
      );
      return;
    }

    xDatos = xDatos.map(Number);
    yDatos = yDatos.map(Number);
    if (!xDatos.every(Number.isFinite) || !yDatos.every(Number.isFinite)) return;

    const margen = { top: 20, right: 20, bottom: 50, left: 60 };
    const anchoSVG = 400;
    const altoSVG = 240;
    const ancho = anchoSVG - margen.left - margen.right;
    const alto = altoSVG - margen.top - margen.bottom;

    const ejeX = etiquetasEjes?.x || "Límite superior";
    const ejeY = etiquetasEjes?.y || "Frecuencia acumulada";

    const minX = Math.min(...xDatos);
    const maxX = Math.max(...xDatos);
    const maxDatoY = Math.max(...yDatos);

    const rango = normalizarRangoY(minY, maxY, maxDatoY);
    minY = rango.minY;
    maxY = rango.maxY;
    ticksY = calcularTicksY(minY, maxY, ticksY);

    const rangoX = (maxX - minX) || 1;
    const rangoY = (maxY - minY) || 1;
    const pasoY = rangoY / ticksY;

    const escalaX = (val) => margen.left + ((val - minX) / rangoX) * ancho;
    const escalaY = (val) => margen.top + alto - ((val - minY) / rangoY) * alto;

    const colorOjiva = normalizarColor(color, TEMA_PREMIUM.colores[3]);
    let svg = crearSVGBase(anchoSVG, altoSVG);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaGrilla(margen.left, y, margen.left + ancho, y);
    }

    svg += lineaEje(margen.left, margen.top, margen.left, margen.top + alto);
    svg += lineaEje(margen.left, margen.top + alto, margen.left + ancho, margen.top + alto);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaEje(margen.left - 5, y, margen.left, y);
      svg += textoSVG(margen.left - 10, y, formatearNumero(valY), {
        anchor: "end",
        baseline: "middle",
        color: TEMA_PREMIUM.textoSuave
      });
    }

    xDatos.forEach((x) => {
      const px = escalaX(x);
      svg += lineaEje(px, margen.top + alto, px, margen.top + alto + 5);
      svg += textoSVG(px, margen.top + alto + 18, formatearNumero(x), {
        color: TEMA_PREMIUM.textoSuave
      });
    });

    const puntos = yDatos
      .map((y, i) => `${escalaX(xDatos[i])},${escalaY(y)}`)
      .join(" ");

    svg += `<polyline points="${puntos}" fill="none" stroke="${colorOjiva}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;

    yDatos.forEach((y, i) => {
      svg += `<circle cx="${escalaX(xDatos[i])}" cy="${escalaY(y)}" r="3.8" fill="${colorOjiva}" stroke="${TEMA_PREMIUM.fondo}" stroke-width="1.2">${tituloSVG(`${formatearNumero(xDatos[i])}: ${formatearNumero(y)}`)}</circle>`;
    });

    svg += textoSVG(margen.left + ancho / 2, altoSVG - 8, ejeX, { size: 13 });
    svg += textoSVG(-(margen.top + alto / 2), 18, ejeY, {
      size: 13,
      transform: "rotate(-90)"
    });

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  /* ========================================================================== */
  /* DISPERSIÓN                                                                 */
  /* ========================================================================== */

  function dibujarGraficoDispersion(contenedorId, datos, etiquetas, color) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor || !Array.isArray(datos) || datos.length === 0) return;

    const datosValidos = datos
      .filter(
        (d) =>
          d &&
          Number.isFinite(Number(d.x)) &&
          Number.isFinite(Number(d.y))
      )
      .map((d) => ({
        x: Number(d.x),
        y: Number(d.y)
      }));

    if (datosValidos.length === 0) return;

    etiquetas = etiquetas && typeof etiquetas === "object" ? etiquetas : {};

    const margen = { top: 20, right: 20, bottom: 55, left: 70 };
    const anchoSVG = limitarNumero(etiquetas.anchoSVG, 640, 220, 1600);
    const altoSVG = limitarNumero(etiquetas.altoSVG, 420, 180, 1200);
    const ancho = anchoSVG - margen.left - margen.right;
    const alto = altoSVG - margen.top - margen.bottom;

    const ejeX = etiquetas.x || "X";
    const ejeY = etiquetas.y || "Y";

    let minX = Number.isFinite(etiquetas.minX)
      ? Number(etiquetas.minX)
      : Math.min(...datosValidos.map((d) => d.x));

    let maxX = Number.isFinite(etiquetas.maxX)
      ? Number(etiquetas.maxX)
      : Math.max(...datosValidos.map((d) => d.x));

    let minY = Number.isFinite(etiquetas.minY)
      ? Number(etiquetas.minY)
      : Math.min(...datosValidos.map((d) => d.y));

    let maxY = Number.isFinite(etiquetas.maxY)
      ? Number(etiquetas.maxY)
      : Math.max(...datosValidos.map((d) => d.y));

    if (!Number.isFinite(etiquetas.minX) || !Number.isFinite(etiquetas.maxX)) {
      const rangoX = maxX - minX;
      const padX = rangoX === 0 ? 1 : rangoX * 0.05;
      minX -= padX;
      maxX += padX;
    }

    if (!Number.isFinite(etiquetas.minY) || !Number.isFinite(etiquetas.maxY)) {
      const rangoY = maxY - minY;
      const padY = rangoY === 0 ? 1 : rangoY * 0.05;
      minY -= padY;
      maxY += padY;
    }

    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    if (minX > maxX) {
      const aux = minX;
      minX = maxX;
      maxX = aux;
    }

    if (minY > maxY) {
      const aux = minY;
      minY = maxY;
      maxY = aux;
    }

    const rangoX = (maxX - minX) || 1;
    const rangoY = (maxY - minY) || 1;
    const pasoX = calcularPasoSeguro(minX, maxX, Number(etiquetas.stepX), etiquetas.ticksX);
    const pasoY = calcularPasoSeguro(minY, maxY, Number(etiquetas.stepY), etiquetas.ticksY);

    const escalaX = (val) => margen.left + ((val - minX) / rangoX) * ancho;
    const escalaY = (val) => margen.top + alto - ((val - minY) / rangoY) * alto;

    const colorPuntos = normalizarColor(color, TEMA_PREMIUM.colores[2]);

    let svg = crearSVGBase(anchoSVG, altoSVG);

    for (let valX = minX; valX <= maxX + 1e-9; valX += pasoX) {
      const x = escalaX(valX);
      svg += lineaGrilla(x, margen.top, x, margen.top + alto);
      svg += lineaEje(x, margen.top + alto, x, margen.top + alto + 5);
      svg += textoSVG(x, margen.top + alto + 18, formatearNumero(valX), {
        color: TEMA_PREMIUM.textoSuave
      });
    }

    for (let valY = minY; valY <= maxY + 1e-9; valY += pasoY) {
      const y = escalaY(valY);
      svg += lineaGrilla(margen.left, y, margen.left + ancho, y);
      svg += lineaEje(margen.left - 5, y, margen.left, y);
      svg += textoSVG(margen.left - 10, y, formatearNumero(valY), {
        anchor: "end",
        baseline: "middle",
        color: TEMA_PREMIUM.textoSuave
      });
    }

    svg += lineaEje(margen.left, margen.top, margen.left, margen.top + alto);
    svg += lineaEje(margen.left, margen.top + alto, margen.left + ancho, margen.top + alto);

    svg += textoSVG(margen.left + ancho / 2, margen.top + alto + 40, ejeX, { size: 13 });
    svg += textoSVG(-(margen.top + alto / 2), margen.left - 40, ejeY, {
      size: 13,
      transform: "rotate(-90)"
    });

    if (etiquetas.mostrarRegresion === true) {
      const regresion = calcularRegresionLineal(datosValidos);

      if (regresion) {
        const yInicio = regresion.pendiente * minX + regresion.intercepto;
        const yFin = regresion.pendiente * maxX + regresion.intercepto;
        const colorLinea = normalizarColor(etiquetas.colorRegresion, TEMA_PREMIUM.colores[0]);

        svg += `<line x1="${escalaX(minX)}" y1="${escalaY(yInicio)}" x2="${escalaX(maxX)}" y2="${escalaY(yFin)}" stroke="${colorLinea}" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 4">${tituloSVG(`y = ${formatearNumero(regresion.pendiente)}x + ${formatearNumero(regresion.intercepto)}, r = ${formatearNumero(regresion.r)}`)}</line>`;

        if (etiquetas.mostrarEcuacion !== false) {
          svg += textoSVG(margen.left + ancho - 4, margen.top + 14, `r = ${formatearNumero(regresion.r)}`, {
            anchor: "end",
            size: 12,
            color: TEMA_PREMIUM.textoSuave
          });
        }
      }
    }

    datosValidos.forEach((d) => {
      const radioPunto = limitarNumero(etiquetas.radioPunto, 4.5, 1, 20);
      svg += `<circle cx="${escalaX(d.x)}" cy="${escalaY(d.y)}" r="${radioPunto}" fill="${colorPuntos}" stroke="${TEMA_PREMIUM.fondo}" stroke-width="1.2" opacity="0.9">${tituloSVG(`${formatearNumero(d.x)}, ${formatearNumero(d.y)}`)}</circle>`;
    });

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  function dibujarGraficoDispersionRegresion(contenedorId, datos, etiquetas = {}, color) {
    etiquetas = etiquetas && typeof etiquetas === "object" ? etiquetas : {};
    return dibujarGraficoDispersion(
      contenedorId,
      datos,
      {
        ...etiquetas,
        mostrarRegresion: true
      },
      color
    );
  }

  /* ========================================================================== */
  /* GRÁFICO DE LÍNEAS / POLÍGONO DE FRECUENCIAS                                */
  /* ========================================================================== */

  function dibujarGraficoLineas(contenedorId, etiquetasX, valoresY, etiquetasEjes, color) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor) return;
    if (!Array.isArray(etiquetasX) || !Array.isArray(valoresY)) return;
    if (etiquetasX.length !== valoresY.length || etiquetasX.length === 0) return;

    etiquetasEjes = etiquetasEjes && typeof etiquetasEjes === "object" ? etiquetasEjes : {};

    const valoresNumericos = valoresY.map(Number);
    if (!valoresNumericos.every(Number.isFinite)) return;

    const margen = { top: 20, right: 20, bottom: 50, left: 60 };
    const anchoSVG = 400;
    const altoSVG = 300;
    const ancho = anchoSVG - margen.left - margen.right;
    const alto = altoSVG - margen.top - margen.bottom;

    const ejeX = etiquetasEjes.x || "Marca de clase";
    const ejeY = etiquetasEjes.y || "Frecuencia";

    const minYManual = Number.isFinite(etiquetasEjes.minY) ? Number(etiquetasEjes.minY) : null;
    const maxYManual = Number.isFinite(etiquetasEjes.maxY) ? Number(etiquetasEjes.maxY) : null;
    const ticksYManual =
      Number.isInteger(etiquetasEjes.ticksY) && etiquetasEjes.ticksY > 0
        ? etiquetasEjes.ticksY
        : null;

    const marcasX = etiquetasX.map((v) => {
      const n = parseFloat(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    });

    const usarEscalaNumericaX = marcasX.every((v) => v !== null);

    const minX = usarEscalaNumericaX ? Math.min(...marcasX) : 0;
    const maxX = usarEscalaNumericaX ? Math.max(...marcasX) : etiquetasX.length - 1;

    const maxDatoY = Math.max(...valoresNumericos);

    let minY = minYManual !== null ? minYManual : 0;
    let maxY = maxYManual !== null ? maxYManual : calcularMaxYBonito(maxDatoY);

    if (minY === maxY) maxY = minY + 1;

    if (minY > maxY) {
      const aux = minY;
      minY = maxY;
      maxY = aux;
    }

    let ticksY = ticksYManual !== null ? ticksYManual : calcularTicksY(minY, maxY, null);

    const rangoX = (maxX - minX) || 1;
    const rangoY = (maxY - minY) || 1;
    const pasoY = rangoY / ticksY;

    const escalaX = usarEscalaNumericaX
      ? (valor) => margen.left + ((valor - minX) / rangoX) * ancho
      : (indice) =>
          margen.left +
          (etiquetasX.length === 1 ? ancho / 2 : (indice * ancho) / (etiquetasX.length - 1));

    const escalaY = (valor) =>
      margen.top + alto - ((valor - minY) / rangoY) * alto;

    const colorLinea = normalizarColor(color, TEMA_PREMIUM.colores[0]);
    let svg = crearSVGBase(anchoSVG, altoSVG);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaGrilla(margen.left, y, margen.left + ancho, y);
    }

    svg += lineaEje(margen.left, margen.top, margen.left, margen.top + alto);
    svg += lineaEje(margen.left, margen.top + alto, margen.left + ancho, margen.top + alto);

    for (let i = 0; i <= ticksY; i++) {
      const valY = minY + i * pasoY;
      const y = escalaY(valY);
      svg += lineaEje(margen.left - 5, y, margen.left, y);
      svg += textoSVG(margen.left - 10, y, formatearNumero(valY), {
        anchor: "end",
        baseline: "middle",
        color: TEMA_PREMIUM.textoSuave
      });
    }

    etiquetasX.forEach((etiqueta, i) => {
      const x = usarEscalaNumericaX ? escalaX(marcasX[i]) : escalaX(i);
      svg += lineaEje(x, margen.top + alto, x, margen.top + alto + 5);
      svg += textoSVG(x, margen.top + alto + 18, etiqueta, {
        color: TEMA_PREMIUM.textoSuave
      });
    });

    svg += textoSVG(margen.left + ancho / 2, altoSVG - 8, ejeX, { size: 13 });
    svg += textoSVG(-(margen.top + alto / 2), 18, ejeY, {
      size: 13,
      transform: "rotate(-90)"
    });

    const puntos = valoresNumericos
      .map((v, i) => {
        const x = usarEscalaNumericaX ? escalaX(marcasX[i]) : escalaX(i);
        const y = escalaY(v);
        return `${x},${y}`;
      })
      .join(" ");

    svg += `<polyline points="${puntos}" fill="none" stroke="${colorLinea}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;

    valoresNumericos.forEach((v, i) => {
      const x = usarEscalaNumericaX ? escalaX(marcasX[i]) : escalaX(i);
      const y = escalaY(v);
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="${colorLinea}" stroke="${TEMA_PREMIUM.fondo}" stroke-width="1.2">${tituloSVG(`${etiquetasX[i]}: ${formatearNumero(v)}`)}</circle>`;
    });

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  function dibujarPoligonoFrecuencia(contenedorId, marcasClase, frecuencias, etiquetasEjes, color) {
    return dibujarGraficoLineas(contenedorId, marcasClase, frecuencias, etiquetasEjes, color);
  }

  /* ========================================================================== */
  /* DISTRIBUCIÓN BINOMIAL                                                       */
  /* ========================================================================== */

  function dibujarDistribucionBinomial(contenedorId, n, p, opciones = {}) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor) return;

    n = Number(n);
    p = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > 80) return;
    if (!Number.isFinite(p) || p < 0 || p > 1) return;

    opciones = opciones && typeof opciones === "object" ? opciones : {};

    const probabilidades = [];
    for (let k = 0; k <= n; k++) {
      probabilidades.push(calcularCombinacion(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k));
    }

    const color = normalizarColor(opciones.color, TEMA_PREMIUM.colores[0]);
    const colorDestacado = normalizarColor(opciones.colorDestacado, TEMA_PREMIUM.colores[2]);
    const destacarDesde = Number.isFinite(opciones.destacarDesde) ? Number(opciones.destacarDesde) : null;
    const destacarHasta = Number.isFinite(opciones.destacarHasta) ? Number(opciones.destacarHasta) : null;

    const margen = { top: 24, right: 20, bottom: 44, left: 58 };
    const anchoSVG = Math.max(420, margen.left + (n + 1) * 22 + margen.right);
    const altoSVG = 260;
    const ancho = anchoSVG - margen.left - margen.right;
    const alto = altoSVG - margen.top - margen.bottom;
    const baseY = margen.top + alto;
    const maxProbabilidad = Math.max(...probabilidades);
    const maxY = maxProbabilidad < 1
      ? Math.min(1, Math.ceil(maxProbabilidad * 10) / 10 || 0.1)
      : calcularMaxYBonito(maxProbabilidad);
    const ticksY = 5;
    const escalaX = (k) => margen.left + (k * ancho) / Math.max(1, n);
    const escalaY = (valor) => margen.top + alto - (valor / maxY) * alto;
    const anchoBarra = Math.max(5, Math.min(18, ancho / (n + 1) - 4));

    let svg = crearSVGBase(anchoSVG, altoSVG);

    for (let i = 0; i <= ticksY; i++) {
      const valY = (maxY * i) / ticksY;
      const y = escalaY(valY);
      svg += lineaGrilla(margen.left, y, margen.left + ancho, y);
      svg += lineaEje(margen.left - 5, y, margen.left, y);
      svg += textoSVG(margen.left - 10, y, formatearNumero(valY), {
        anchor: "end",
        baseline: "middle",
        color: TEMA_PREMIUM.textoSuave
      });
    }

    svg += lineaEje(margen.left, margen.top, margen.left, baseY);
    svg += lineaEje(margen.left, baseY, margen.left + ancho, baseY);

    probabilidades.forEach((prob, k) => {
      const xCentro = escalaX(k);
      const x = xCentro - anchoBarra / 2;
      const y = escalaY(prob);
      const altura = baseY - y;
      const destacado =
        destacarDesde !== null &&
        destacarHasta !== null &&
        k >= destacarDesde &&
        k <= destacarHasta;

      svg += `<rect x="${x}" y="${y}" width="${anchoBarra}" height="${altura}" rx="3" fill="${destacado ? colorDestacado : color}" opacity="0.92">${tituloSVG(`P(X=${k}) = ${formatearNumero(prob)}`)}</rect>`;

      if (n <= 25 || k % Math.ceil(n / 12) === 0) {
        svg += lineaEje(xCentro, baseY, xCentro, baseY + 5);
        svg += textoSVG(xCentro, baseY + 18, k, { color: TEMA_PREMIUM.textoSuave });
      }
    });

    svg += textoSVG(margen.left + ancho / 2, altoSVG - 8, "k", { size: 13 });
    svg += textoSVG(-(margen.top + alto / 2), 18, "P(X = k)", {
      size: 13,
      transform: "rotate(-90)"
    });

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  /* ========================================================================== */
  /* DISTRIBUCIÓN NORMAL                                                         */
  /* ========================================================================== */

  function dibujarDistribucionNormal(contenedorId, media = 0, desviacion = 1, opciones = {}) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor) return;

    media = Number(media);
    desviacion = Number(desviacion);
    if (!Number.isFinite(media) || !Number.isFinite(desviacion) || desviacion <= 0) return;

    opciones = opciones && typeof opciones === "object" ? opciones : {};

    const minX = Number.isFinite(opciones.minX) ? Number(opciones.minX) : media - 4 * desviacion;
    const maxX = Number.isFinite(opciones.maxX) ? Number(opciones.maxX) : media + 4 * desviacion;
    const sombrearDesde = Number.isFinite(opciones.sombrearDesde) ? Number(opciones.sombrearDesde) : null;
    const sombrearHasta = Number.isFinite(opciones.sombrearHasta) ? Number(opciones.sombrearHasta) : null;
    const areas = Array.isArray(opciones.areas)
      ? opciones.areas
          .map((area) => ({
            desde: Number(area.desde),
            hasta: Number(area.hasta)
          }))
          .filter((area) => Number.isFinite(area.desde) && Number.isFinite(area.hasta))
      : [];
    const rangosSombreado = areas.length > 0
      ? areas
      : sombrearDesde !== null && sombrearHasta !== null
        ? [{ desde: sombrearDesde, hasta: sombrearHasta }]
        : [];
    const colorCurva = normalizarColor(opciones.color, TEMA_PREMIUM.colores[0]);
    const colorArea = normalizarColor(opciones.colorArea, "rgba(53, 111, 159, 0.24)");

    if (minX >= maxX) return;

    const margen = { top: 22, right: 20, bottom: 44, left: 48 };
    const anchoSVG = 520;
    const altoSVG = 260;
    const ancho = anchoSVG - margen.left - margen.right;
    const alto = altoSVG - margen.top - margen.bottom;
    const baseY = margen.top + alto;
    const maxY = normalPDF(media, media, desviacion);
    const escalaX = (x) => margen.left + ((x - minX) / (maxX - minX)) * ancho;
    const escalaY = (y) => margen.top + alto - (y / maxY) * alto;

    const puntos = [];
    const puntosAreas = rangosSombreado.map(() => []);
    const pasos = 160;

    for (let i = 0; i <= pasos; i++) {
      const x = minX + ((maxX - minX) * i) / pasos;
      const y = normalPDF(x, media, desviacion);
      puntos.push(`${escalaX(x)},${escalaY(y)}`);

      rangosSombreado.forEach((rango, index) => {
        if (
          x >= Math.min(rango.desde, rango.hasta) &&
          x <= Math.max(rango.desde, rango.hasta)
        ) {
          puntosAreas[index].push({ x, y });
        }
      });
    }

    let svg = crearSVGBase(anchoSVG, altoSVG);

    svg += lineaEje(margen.left, baseY, margen.left + ancho, baseY);
    svg += lineaEje(margen.left, margen.top, margen.left, baseY);

    puntosAreas.forEach((puntosArea, index) => {
      if (puntosArea.length <= 1) return;

      const rango = rangosSombreado[index];
      const area = [
        `${escalaX(puntosArea[0].x)},${baseY}`,
        ...puntosArea.map((punto) => `${escalaX(punto.x)},${escalaY(punto.y)}`),
        `${escalaX(puntosArea[puntosArea.length - 1].x)},${baseY}`
      ].join(" ");
      svg += `<polygon points="${area}" fill="${colorArea}">${tituloSVG(`Area sombreada: ${formatearNumero(Math.min(rango.desde, rango.hasta))} a ${formatearNumero(Math.max(rango.desde, rango.hasta))}`)}</polygon>`;
    });

    svg += `<polyline points="${puntos.join(" ")}" fill="none" stroke="${colorCurva}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;

    for (let z = -3; z <= 3; z++) {
      const xVal = media + z * desviacion;
      if (xVal < minX || xVal > maxX) continue;
      const x = escalaX(xVal);
      svg += lineaEje(x, baseY, x, baseY + 5);
      svg += textoSVG(x, baseY + 18, z === 0 ? "μ" : `${z > 0 ? "+" : ""}${z}σ`, {
        color: TEMA_PREMIUM.textoSuave
      });
    }

    svg += textoSVG(margen.left + ancho / 2, altoSVG - 8, opciones.ejeX || "Valor", { size: 13 });
    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  /* ========================================================================== */
  /* INTERVALO DE CONFIANZA                                                      */
  /* ========================================================================== */

  function dibujarIntervaloConfianza(contenedorId, estimacion, limiteInferior, limiteSuperior, opciones = {}) {
    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor) return;

    estimacion = Number(estimacion);
    limiteInferior = Number(limiteInferior);
    limiteSuperior = Number(limiteSuperior);
    if (![estimacion, limiteInferior, limiteSuperior].every(Number.isFinite)) return;

    if (limiteInferior > limiteSuperior) {
      const aux = limiteInferior;
      limiteInferior = limiteSuperior;
      limiteSuperior = aux;
    }

    opciones = opciones && typeof opciones === "object" ? opciones : {};

    const margen = { top: 38, right: 28, bottom: 44, left: 44 };
    const anchoSVG = 460;
    const altoSVG = 150;
    const ancho = anchoSVG - margen.left - margen.right;
    const ejeY = 72;
    const rango = limiteSuperior - limiteInferior || 1;
    const minX = Number.isFinite(opciones.minX) ? Number(opciones.minX) : limiteInferior - 0.2 * rango;
    const maxX = Number.isFinite(opciones.maxX) ? Number(opciones.maxX) : limiteSuperior + 0.2 * rango;
    const color = normalizarColor(opciones.color, TEMA_PREMIUM.colores[0]);
    const escalaX = (valor) => margen.left + ((valor - minX) / (maxX - minX || 1)) * ancho;

    let svg = crearSVGBase(anchoSVG, altoSVG);

    svg += lineaEje(margen.left, ejeY, margen.left + ancho, ejeY);
    svg += `<line x1="${escalaX(limiteInferior)}" y1="${ejeY}" x2="${escalaX(limiteSuperior)}" y2="${ejeY}" stroke="${color}" stroke-width="5" stroke-linecap="round">${tituloSVG(`IC: [${formatearNumero(limiteInferior)}, ${formatearNumero(limiteSuperior)}]`)}</line>`;
    svg += `<circle cx="${escalaX(estimacion)}" cy="${ejeY}" r="6" fill="${color}" stroke="${TEMA_PREMIUM.fondo}" stroke-width="2">${tituloSVG(`Estimacion: ${formatearNumero(estimacion)}`)}</circle>`;

    [limiteInferior, estimacion, limiteSuperior].forEach((valor) => {
      const x = escalaX(valor);
      svg += lineaEje(x, ejeY + 10, x, ejeY + 16);
      svg += textoSVG(x, ejeY + 32, formatearNumero(valor), {
        color: TEMA_PREMIUM.textoSuave
      });
    });

    svg += textoSVG(margen.left + ancho / 2, 22, opciones.titulo || "Intervalo de confianza", {
      size: 13,
      color: TEMA_PREMIUM.texto
    });

    svg += `</svg>`;
    contenedor.innerHTML = svg;
  }

  /* ========================================================================== */
  /* PRUEBA DE HIPÓTESIS                                                         */
  /* ========================================================================== */

  function dibujarPruebaHipotesis(contenedorId, opciones = {}) {
    opciones = opciones && typeof opciones === "object" ? opciones : {};

    const tipo = opciones.tipo || "bilateral";
    const media = Number.isFinite(opciones.media) ? Number(opciones.media) : 0;
    const desviacion = Number.isFinite(opciones.desviacion) && opciones.desviacion > 0
      ? Number(opciones.desviacion)
      : 1;
    const estadistico = Number.isFinite(opciones.estadistico) ? Number(opciones.estadistico) : null;
    const critico = Number.isFinite(opciones.critico) ? Math.abs(Number(opciones.critico)) : 1.96;

    let areas = [
      {
        desde: media + critico * desviacion,
        hasta: media + 4 * desviacion
      }
    ];

    if (tipo === "izquierda") {
      areas = [
        {
          desde: media - 4 * desviacion,
          hasta: media - critico * desviacion
        }
      ];
    }

    if (tipo === "bilateral") {
      areas = [
        {
          desde: media - 4 * desviacion,
          hasta: media - critico * desviacion
        },
        {
          desde: media + critico * desviacion,
          hasta: media + 4 * desviacion
        }
      ];
    }

    dibujarDistribucionNormal(contenedorId, media, desviacion, {
      minX: media - 4 * desviacion,
      maxX: media + 4 * desviacion,
      areas,
      color: opciones.color || TEMA_PREMIUM.colores[0],
      colorArea: opciones.colorArea || "rgba(201, 80, 86, 0.25)",
      ejeX: opciones.ejeX || "Estadistico"
    });

    const contenedor = obtenerContenedor(contenedorId);
    if (!contenedor || estadistico === null) return;

    const marca = document.createElement("div");
    marca.style.cssText = "font-family:Inter, Segoe UI, Arial, sans-serif; color:#64748b; font-size:12px; margin-top:4px;";
    marca.textContent = `Estadistico observado: ${formatearNumero(estadistico)}`;
    contenedor.appendChild(marca);
  }

  /* ========================================================================== */
  /* EXPORTACIÓN                                                                */
  /* ========================================================================== */

  const api = Object.freeze({
    dibujarGraficoBarra,
    dibujarGraficoBarrasMultiples,
    dibujarGraficoBarrasDobles,
    dibujarPictograma,
    dibujarHistograma,
    dibujarGraficoCircular,
    dibujarGraficoCaja,
    dibujarOjiva,
    dibujarGraficoDispersion,
    dibujarGraficoDispersionRegresion,
    dibujarGraficoLineas,
    dibujarPoligonoFrecuencia,
    dibujarDistribucionBinomial,
    dibujarDistribucionNormal,
    dibujarIntervaloConfianza,
    dibujarPruebaHipotesis
  });

  // Namespace oficial del módulo
  window.GrafiEstadistik = Object.assign(
    {},
    window.GrafiEstadistik || {},
    api
  );

  // Compatibilidad legacy opcional.
  // Déjalo en true por ahora si tienes llamadas antiguas tipo:
  // dibujarGraficoBarra(...)
  // Cuando todo use window.GrafiEstadistik..., lo cambias a false.
  const EXPORTAR_GLOBALES_LEGACY = true;

  if (EXPORTAR_GLOBALES_LEGACY) {
    Object.keys(api).forEach(function (nombre) {
      if (typeof window[nombre] !== "function") {
        window[nombre] = api[nombre];
      }
    });
  }

})(window);
