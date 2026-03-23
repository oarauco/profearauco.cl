  /* ================================================================== */
  /* FUNCIONES DE GRÁFICOS                           */
  /* ================================================================== */




// Dibuja un gráfico de barras.
// - eje Y parte en 0 por defecto
// - permite minY, maxY y ticksY manuales
// - ajusta automáticamente el ancho según la cantidad de categorías
// - permite etiquetas horizontales (1) o verticales (0)
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
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  if (!Array.isArray(frecuencias) || !Array.isArray(etiquetasX)) return;
  if (frecuencias.length === 0 || frecuencias.length !== etiquetasX.length) return;

  const margen = { top: 20, right: 20, bottom: posicionEtiquetas === 0 ? 85 : 50, left: 50 };
  const anchoBarra = 28;
  const separacion = 18;
  const n = frecuencias.length;

  const anchoGrafico = n * anchoBarra + (n - 1) * separacion;
  const anchoSVG = margen.left + anchoGrafico + margen.right;
  const altoSVG = 260;
  const alto = altoSVG - margen.top - margen.bottom;
  const baseY = margen.top + alto;

  const maxDatoY = Math.max(...frecuencias);

  if (!Number.isFinite(minY)) minY = 0;

  if (!Number.isFinite(maxY)) {
    if (maxDatoY <= 5) {
      maxY = Math.ceil(maxDatoY);
    } else {
      const potencia = Math.pow(10, Math.floor(Math.log10(maxDatoY)));
      const proporcion = maxDatoY / potencia;

      if (proporcion <= 1) maxY = 1 * potencia;
      else if (proporcion <= 2) maxY = 2 * potencia;
      else if (proporcion <= 5) maxY = 5 * potencia;
      else maxY = 10 * potencia;

      if (maxY < maxDatoY) {
        if (maxY === 1 * potencia) maxY = 2 * potencia;
        else if (maxY === 2 * potencia) maxY = 5 * potencia;
        else maxY = 10 * potencia;
      }
    }
  }

  if (minY === maxY) maxY = minY + 1;

  if (minY > maxY) {
    const aux = minY;
    minY = maxY;
    maxY = aux;
  }

  if (!Number.isInteger(ticksY) || ticksY <= 0) {
    const rangoEstimado = maxY - minY;
    if (rangoEstimado <= 5) ticksY = Math.max(1, Math.round(rangoEstimado));
    else if (rangoEstimado <= 10) ticksY = 5;
    else if (rangoEstimado <= 20) ticksY = 4;
    else ticksY = 5;
  }

  const rangoY = (maxY - minY) || 1;
  const pasoY = rangoY / ticksY;

  const escalaY = valor =>
    margen.top + alto - ((valor - minY) / rangoY) * alto;

  function formatearNumero(valor) {
    const redondeado = Math.round(valor * 100) / 100;
    if (Number.isInteger(redondeado)) return String(redondeado);
    return String(redondeado).replace(".", ",");
  }

  let svg = `<svg viewBox="0 0 ${anchoSVG} ${altoSVG}" style="width:${anchoSVG}px; height:${altoSVG}px;">`;

  // Fondo
  svg += `<rect x="0" y="0" width="${anchoSVG}" height="${altoSVG}" fill="white" />`;

  // Líneas guía horizontales
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left}" y1="${y}" x2="${margen.left + anchoGrafico}" y2="${y}" stroke="#e0e0e0" />`;
  }

  // Ejes
  svg += `<line x1="${margen.left}" y1="${margen.top}" x2="${margen.left}" y2="${baseY}" stroke="#000" />`;
  svg += `<line x1="${margen.left}" y1="${baseY}" x2="${margen.left + anchoGrafico}" y2="${baseY}" stroke="#000" />`;

  // Etiquetas eje Y
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left - 5}" y1="${y}" x2="${margen.left}" y2="${y}" stroke="#000" />`;
    svg += `<text x="${margen.left - 10}" y="${y}" font-size="10" text-anchor="end" dominant-baseline="middle">${formatearNumero(valY)}</text>`;
  }

  // Barras y etiquetas X
  frecuencias.forEach((frec, i) => {
    const x = margen.left + i * (anchoBarra + separacion);
    const y = escalaY(frec);
    const altura = escalaY(minY) - y;
    const etiqueta = etiquetasX[i];

    svg += `<rect x="${x}" y="${y}" width="${anchoBarra}" height="${altura}" fill="${color || "#cccccc"}" />`;
    svg += `<text x="${x + anchoBarra / 2}" y="${y - 5}" font-size="10" text-anchor="middle">${frec}</text>`;

    if (posicionEtiquetas === 0) {
      svg += `<text x="${x + anchoBarra / 2}" y="${baseY + 8}" font-size="10" text-anchor="end" transform="rotate(-90 ${x + anchoBarra / 2},${baseY + 8})">${etiqueta}</text>`;
    } else {
      svg += `<text x="${x + anchoBarra / 2}" y="${baseY + 18}" font-size="10" text-anchor="middle">${etiqueta}</text>`;
    }
  });

  svg += `</svg>`;
  contenedor.innerHTML = svg;
}





  /* ================================================================== */





function dibujarPictograma(contenedorId, datos, icono, valorPorIcono, color) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor || !Array.isArray(datos) || !icono) return;

  valorPorIcono = Number(valorPorIcono);
  if (!Number.isFinite(valorPorIcono) || valorPorIcono <= 0) return;

  const datosValidos = datos
    .filter(item =>
      item &&
      typeof item.label !== "undefined" &&
      Number.isFinite(Number(item.valor)) &&
      Number(item.valor) >= 0
    )
    .map(item => ({
      label: String(item.label),
      valor: Number(item.valor)
    }));

  if (datosValidos.length === 0) return;

  const colorIcono = color || "#666";
  const tamañoIcono = 24;

  let tablaHTML = `<table class="tabla-pictograma" style="border-collapse:collapse; width:100%;">`;
  let defsSVG = `<svg width="0" height="0" style="position:absolute;"><defs>`;

  datosValidos.forEach((item, index) => {
    const numIconosCompletos = Math.floor(item.valor / valorPorIcono);
    const valorRestante = item.valor - (numIconosCompletos * valorPorIcono);
    const fraccionIcono = Math.max(0, Math.min(1, valorRestante / valorPorIcono));

    let iconosHTML = "";

    for (let i = 0; i < numIconosCompletos; i++) {
      iconosHTML += `
        <svg width="${tamañoIcono}" height="${tamañoIcono}" viewBox="0 0 24 24" fill="${colorIcono}" style="margin-right:4px;">
          <path d="${icono}"></path>
        </svg>`;
    }

    if (fraccionIcono > 0) {
      const clipId = `clip-${contenedorId}-${index}`;
      defsSVG += `
        <clipPath id="${clipId}">
          <rect x="0" y="0" width="${24 * fraccionIcono}" height="24"></rect>
        </clipPath>`;

      iconosHTML += `
        <svg width="${tamañoIcono}" height="${tamañoIcono}" viewBox="0 0 24 24" fill="${colorIcono}" style="margin-right:4px;">
          <g clip-path="url(#${clipId})">
            <path d="${icono}"></path>
          </g>
        </svg>`;
    }

    if (!iconosHTML) {
      iconosHTML = `<span style="color:#666;">0</span>`;
    }

    tablaHTML += `
      <tr>
        <td style="padding:8px; text-align:right; font-weight:bold; width:30%;">${item.label}</td>
        <td style="padding:8px; text-align:left;">${iconosHTML}</td>
      </tr>`;
  });

  defsSVG += `</defs></svg>`;
  tablaHTML += `</table>`;

  contenedor.innerHTML = defsSVG + tablaHTML;
}


  /* ================================================================== */



// Dibuja un histograma con barras juntas.
// Por defecto, el eje Y parte en 0.
// Permite fijar minY, maxY y ticksY manualmente.
function dibujarHistograma(contenedorId, frecuencias, limites, color, minY = null, maxY = null, ticksY = null) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  if (!Array.isArray(frecuencias) || !Array.isArray(limites)) return;
  if (frecuencias.length === 0 || limites.length !== frecuencias.length + 1) return;

  const margen = { top: 20, right: 20, bottom: 40, left: 50 };
  const anchoSVG = 400;
  const altoSVG = 220;
  const ancho = anchoSVG - margen.left - margen.right;
  const alto = altoSVG - margen.top - margen.bottom;

  const maxDatoY = Math.max(...frecuencias);

  // minY por defecto
  if (!Number.isFinite(minY)) minY = 0;

  // maxY automático "bonito"
  if (!Number.isFinite(maxY)) {
    if (maxDatoY <= 5) {
      maxY = Math.ceil(maxDatoY);
    } else {
      const potencia = Math.pow(10, Math.floor(Math.log10(maxDatoY)));
      const proporcion = maxDatoY / potencia;

      if (proporcion <= 1) maxY = 1 * potencia;
      else if (proporcion <= 2) maxY = 2 * potencia;
      else if (proporcion <= 5) maxY = 5 * potencia;
      else maxY = 10 * potencia;

      if (maxY < maxDatoY) {
        if (maxY === 1 * potencia) maxY = 2 * potencia;
        else if (maxY === 2 * potencia) maxY = 5 * potencia;
        else maxY = 10 * potencia;
      }
    }
  }

  if (minY === maxY) maxY = minY + 1;

  if (minY > maxY) {
    const aux = minY;
    minY = maxY;
    maxY = aux;
  }

  // ticksY automático
  if (!Number.isInteger(ticksY) || ticksY <= 0) {
    const rangoEstimado = maxY - minY;
    if (rangoEstimado <= 5) ticksY = Math.max(1, Math.round(rangoEstimado));
    else if (rangoEstimado <= 10) ticksY = 5;
    else if (rangoEstimado <= 20) ticksY = 4;
    else ticksY = 5;
  }

  const rangoY = (maxY - minY) || 1;
  const pasoY = rangoY / ticksY;
  const anchoBarra = ancho / frecuencias.length;

  const escalaY = valor =>
    margen.top + alto - ((valor - minY) / rangoY) * alto;

  function formatearNumero(valor) {
    const redondeado = Math.round(valor * 100) / 100;
    if (Number.isInteger(redondeado)) return String(redondeado);
    return String(redondeado).replace(".", ",");
  }

  let svg = `<svg viewBox="0 0 ${anchoSVG} ${altoSVG}" style="width:${anchoSVG}px; height:${altoSVG}px;">`;

  // Fondo
  svg += `<rect x="0" y="0" width="${anchoSVG}" height="${altoSVG}" fill="white" />`;

  // Líneas guía horizontales
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left}" y1="${y}" x2="${margen.left + ancho}" y2="${y}" stroke="#e0e0e0" />`;
  }

  // Ejes
  svg += `<line x1="${margen.left}" y1="${margen.top}" x2="${margen.left}" y2="${margen.top + alto}" stroke="black" />`;
  svg += `<line x1="${margen.left}" y1="${margen.top + alto}" x2="${margen.left + ancho}" y2="${margen.top + alto}" stroke="black" />`;

  // Etiquetas y marcas del eje Y
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left - 5}" y1="${y}" x2="${margen.left}" y2="${y}" stroke="black" />`;
    svg += `<text x="${margen.left - 10}" y="${y}" font-size="10" text-anchor="end" dominant-baseline="middle">${formatearNumero(valY)}</text>`;
  }

  // Barras y frecuencias
  frecuencias.forEach((frec, i) => {
    const x = margen.left + i * anchoBarra;
    const y = escalaY(frec);
    const altura = escalaY(minY) - y;

    svg += `<rect x="${x}" y="${y}" width="${anchoBarra}" height="${altura}" fill="${color || '#cccccc'}" stroke="#333" stroke-width="1" />`;
    svg += `<text x="${x + anchoBarra / 2}" y="${y - 5}" font-size="10" text-anchor="middle">${frec}</text>`;
  });

  // Límites del eje X
  limites.forEach((limite, i) => {
    const x = margen.left + i * anchoBarra;
    svg += `<line x1="${x}" y1="${margen.top + alto}" x2="${x}" y2="${margen.top + alto + 5}" stroke="black" />`;
    svg += `<text x="${x}" y="${margen.top + alto + 18}" font-size="10" text-anchor="middle">${limite}</text>`;
  });

  svg += `</svg>`;
  contenedor.innerHTML = svg;
}






  /* ================================================================== */







// Dibuja un gráfico circular con leyenda.
// Espera un arreglo de objetos con esta forma:
// [{ label: "A", valor: 10, color: "#ff6200" }, ...]
function dibujarGraficoCircular(contenedorId, datos) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor || !Array.isArray(datos) || datos.length === 0) return;

  // Filtra datos válidos
  const datosValidos = datos
    .filter(item =>
      item &&
      typeof item.label !== "undefined" &&
      Number.isFinite(Number(item.valor)) &&
      Number(item.valor) >= 0
    )
    .map(item => ({
      label: String(item.label),
      valor: Number(item.valor),
      color: item.color || null
    }));

  if (datosValidos.length === 0) return;

  const total = datosValidos.reduce((sum, item) => sum + item.valor, 0);

  // Si el total es 0, mostrar mensaje simple
  if (total <= 0) {
    contenedor.innerHTML = `<div style="padding:12px; border:1px solid #ccc; border-radius:8px;">No hay datos suficientes para construir el gráfico circular.</div>`;
    return;
  }

  const tamaño = 200;
  const centro = tamaño / 2;
  const radio = tamaño / 2 - 10;

  const coloresPorDefecto = [
    "#3f51b5", "#ff5722", "#009688", "#ffc107",
    "#9c27b0", "#4caf50", "#2196f3", "#795548"
  ];

  let anguloInicio = -90;
  let svg = `<svg viewBox="0 0 ${tamaño} ${tamaño}" style="width:${tamaño}px; height:${tamaño}px;">`;
  let leyendaHTML = `<div style="margin-left:20px; display:flex; flex-direction:column; justify-content:center;">`;

  function formatearPorcentaje(p) {
    const valor = p * 100;
    return Number.isInteger(valor) ? `${valor}%` : `${valor.toFixed(1).replace(".", ",")}%`;
  }

  datosValidos.forEach((item, index) => {
    const porcentaje = item.valor / total;

    // Si el valor es 0, no dibuja sector, pero sí puede aparecer en leyenda
    const colorSector = item.color || coloresPorDefecto[index % coloresPorDefecto.length];

    if (item.valor > 0) {
      const anguloFin = anguloInicio + (porcentaje * 360);

      const x1 = centro + radio * Math.cos(Math.PI / 180 * anguloInicio);
      const y1 = centro + radio * Math.sin(Math.PI / 180 * anguloInicio);
      const x2 = centro + radio * Math.cos(Math.PI / 180 * anguloFin);
      const y2 = centro + radio * Math.sin(Math.PI / 180 * anguloFin);

      const arcoGrande = porcentaje > 0.5 ? 1 : 0;

      // Caso especial: círculo completo
      if (porcentaje >= 0.999999) {
        svg += `<circle cx="${centro}" cy="${centro}" r="${radio}" fill="${colorSector}"></circle>`;
      } else {
        const pathData = `M ${centro},${centro} L ${x1},${y1} A ${radio},${radio} 0 ${arcoGrande},1 ${x2},${y2} Z`;
        svg += `<path d="${pathData}" fill="${colorSector}"></path>`;
      }

      anguloInicio = anguloFin;
    }

    leyendaHTML += `
      <div style="display:flex; align-items:center; margin-bottom:5px;">
        <span style="width:12px; height:12px; background-color:${colorSector}; margin-right:8px; border-radius:2px;"></span>
        <span>${item.label} (${formatearPorcentaje(porcentaje)})</span>
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




  /* ================================================================== */



function dibujarGraficoCaja(contenedorId, datos, color) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor || !datos || typeof datos !== "object") return;

  let { min, q1, mediana, q3, max, limiteMin, limiteMax, salto } = datos;

  min = Number(min);
  q1 = Number(q1);
  mediana = Number(mediana);
  q3 = Number(q3);
  max = Number(max);

  if (![min, q1, mediana, q3, max].every(Number.isFinite)) return;
  if (!(min <= q1 && q1 <= mediana && mediana <= q3 && q3 <= max)) return;

  // Formato de número para etiquetas
  function formatearNumero(valor) {
    const redondeado = Math.round(valor * 100) / 100;
    if (Number.isInteger(redondeado)) return String(redondeado);
    return String(redondeado).replace(".", ",");
  }

  // Estimación de salto "bonito"
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

  // Si no se entregan límites, se calculan
  const rangoDatos = max - min || 1;
  if (!Number.isFinite(limiteMin)) limiteMin = Math.floor((min - 0.1 * rangoDatos) * 100) / 100;
  if (!Number.isFinite(limiteMax)) limiteMax = Math.ceil((max + 0.1 * rangoDatos) * 100) / 100;

  if (limiteMin === limiteMax) {
    limiteMin -= 1;
    limiteMax += 1;
  }

  if (limiteMin > limiteMax) {
    const aux = limiteMin;
    limiteMin = limiteMax;
    limiteMax = aux;
  }

  // Asegurar que el resumen quede dentro de los límites
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

  const colorCaja = color || "rgba(255, 159, 64, 0.5)";

  let svg = `<svg viewBox="0 0 ${anchoSVG} ${alturaSVG}" style="width:${anchoSVG}px; height:${alturaSVG}px;">`;

  // Fondo
  svg += `<rect x="0" y="0" width="${anchoSVG}" height="${alturaSVG}" fill="white" />`;

  // Líneas guía y marcas del eje
  const primerTick = Math.ceil(limiteMin / salto) * salto;
  for (let v = primerTick; v <= limiteMax + 1e-9; v += salto) {
    const x = escalaX(v);
    svg += `<line x1="${x}" y1="${margen.top}" x2="${x}" y2="${ejeY}" stroke="#e0e0e0" />`;
    svg += `<line x1="${x}" y1="${ejeY}" x2="${x}" y2="${ejeY + 5}" stroke="#000" />`;
    svg += `<text x="${x}" y="${ejeY + 18}" font-size="10" text-anchor="middle">${formatearNumero(v)}</text>`;
  }

  // Eje horizontal
  svg += `<line x1="${margen.left}" y1="${ejeY}" x2="${anchoSVG - margen.right}" y2="${ejeY}" stroke="#000" />`;

  // Caja
  const xQ1 = escalaX(q1);
  const xQ3 = escalaX(q3);
  svg += `<rect x="${xQ1}" y="${cajaY}" width="${xQ3 - xQ1}" height="${cajaAltura}" fill="${colorCaja}" stroke="#333" />`;

  // Mediana
  const xMediana = escalaX(mediana);
  svg += `<line x1="${xMediana}" y1="${cajaY}" x2="${xMediana}" y2="${cajaY + cajaAltura}" stroke="#111" stroke-width="2" />`;

  // Bigotes
  const xMin = escalaX(min);
  const xMax = escalaX(max);
  svg += `<line x1="${xMin}" y1="${yCentro}" x2="${xQ1}" y2="${yCentro}" stroke="#333" />`;
  svg += `<line x1="${xQ3}" y1="${yCentro}" x2="${xMax}" y2="${yCentro}" stroke="#333" />`;

  // Extremos
  svg += `<line x1="${xMin}" y1="${cajaY + 8}" x2="${xMin}" y2="${cajaY + cajaAltura - 8}" stroke="#333" />`;
  svg += `<line x1="${xMax}" y1="${cajaY + 8}" x2="${xMax}" y2="${cajaY + cajaAltura - 8}" stroke="#333" />`;

  svg += `</svg>`;
  contenedor.innerHTML = svg;
}


  /* ================================================================== */

// Dibuja una ojiva de frecuencia acumulada.
// Acepta dos formatos:
// 1) limites y frecAcumuladas con el mismo largo
// 2) limites con un elemento más que frecAcumuladas
//    En ese caso agrega automáticamente el punto inicial con frecuencia 0.
// Permite etiquetar ejes con etiquetasEjes = { x: "...", y: "..." }
function dibujarOjiva(contenedorId, limites, frecAcumuladas, color, minY = null, maxY = null, ticksY = null, etiquetasEjes = {}) {
  const contenedor = document.getElementById(contenedorId);
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
    console.error("Error en ojiva: la longitud de limites no coincide con la de frecuencias acumuladas.", { limites, frecAcumuladas });
    return;
  }

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

  if (!Number.isFinite(minY)) minY = 0;

  if (!Number.isFinite(maxY)) {
    if (maxDatoY <= 5) {
      maxY = Math.ceil(maxDatoY);
    } else {
      const potencia = Math.pow(10, Math.floor(Math.log10(maxDatoY)));
      const proporcion = maxDatoY / potencia;

      if (proporcion <= 1) maxY = 1 * potencia;
      else if (proporcion <= 2) maxY = 2 * potencia;
      else if (proporcion <= 5) maxY = 5 * potencia;
      else maxY = 10 * potencia;

      if (maxY < maxDatoY) {
        if (maxY === 1 * potencia) maxY = 2 * potencia;
        else if (maxY === 2 * potencia) maxY = 5 * potencia;
        else maxY = 10 * potencia;
      }
    }
  }

  if (minY === maxY) maxY = minY + 1;

  if (minY > maxY) {
    const aux = minY;
    minY = maxY;
    maxY = aux;
  }

  if (!Number.isInteger(ticksY) || ticksY <= 0) {
    const rangoEstimado = maxY - minY;
    if (rangoEstimado <= 5) ticksY = Math.max(1, Math.round(rangoEstimado));
    else if (rangoEstimado <= 10) ticksY = 5;
    else if (rangoEstimado <= 20) ticksY = 4;
    else ticksY = 5;
  }

  const rangoX = (maxX - minX) || 1;
  const rangoY = (maxY - minY) || 1;
  const pasoY = rangoY / ticksY;

  const escalaX = val => margen.left + ((val - minX) / rangoX) * ancho;
  const escalaY = val => margen.top + alto - ((val - minY) / rangoY) * alto;

  function formatearNumero(valor) {
    const redondeado = Math.round(valor * 100) / 100;
    if (Number.isInteger(redondeado)) return String(redondeado);
    return String(redondeado).replace(".", ",");
  }

  let svg = `<svg viewBox="0 0 ${anchoSVG} ${altoSVG}" style="width:${anchoSVG}px; height:${altoSVG}px;">`;

  // Fondo
  svg += `<rect x="0" y="0" width="${anchoSVG}" height="${altoSVG}" fill="white" />`;

  // Líneas guía horizontales
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left}" y1="${y}" x2="${margen.left + ancho}" y2="${y}" stroke="#e0e0e0" />`;
  }

  // Ejes
  svg += `<line x1="${margen.left}" y1="${margen.top}" x2="${margen.left}" y2="${margen.top + alto}" stroke="black" />`;
  svg += `<line x1="${margen.left}" y1="${margen.top + alto}" x2="${margen.left + ancho}" y2="${margen.top + alto}" stroke="black" />`;

  // Marcas y etiquetas eje Y
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left - 5}" y1="${y}" x2="${margen.left}" y2="${y}" stroke="black" />`;
    svg += `<text x="${margen.left - 10}" y="${y}" font-size="10" text-anchor="end" dominant-baseline="middle">${formatearNumero(valY)}</text>`;
  }

  // Etiquetas eje X
  xDatos.forEach(x => {
    const px = escalaX(x);
    svg += `<line x1="${px}" y1="${margen.top + alto}" x2="${px}" y2="${margen.top + alto + 5}" stroke="black" />`;
    svg += `<text x="${px}" y="${margen.top + alto + 18}" font-size="10" text-anchor="middle">${formatearNumero(x)}</text>`;
  });

  // Línea de la ojiva
  const puntos = yDatos.map((y, i) => `${escalaX(xDatos[i])},${escalaY(y)}`).join(" ");
  svg += `<polyline points="${puntos}" fill="none" stroke="${color || "#4bc0c0"}" stroke-width="2.5" />`;

  // Puntos
  yDatos.forEach((y, i) => {
    svg += `<circle cx="${escalaX(xDatos[i])}" cy="${escalaY(y)}" r="3.5" fill="${color || "#4bc0c0"}" />`;
  });

  // Títulos de ejes
  svg += `<text x="${margen.left + ancho / 2}" y="${altoSVG - 8}" font-size="12" text-anchor="middle">${ejeX}</text>`;
  svg += `<text transform="rotate(-90)" x="${-(margen.top + alto / 2)}" y="18" font-size="12" text-anchor="middle">${ejeY}</text>`;

  svg += `</svg>`;
  contenedor.innerHTML = svg;
}


  /* ================================================================== */



function dibujarGraficoDispersion(contenedorId, datos, etiquetas, color) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor || !Array.isArray(datos) || datos.length === 0) return;

  const datosValidos = datos.filter(d =>
    d &&
    Number.isFinite(Number(d.x)) &&
    Number.isFinite(Number(d.y))
  ).map(d => ({
    x: Number(d.x),
    y: Number(d.y)
  }));

  if (datosValidos.length === 0) return;

  etiquetas = etiquetas && typeof etiquetas === "object" ? etiquetas : {};

  const margen = { top: 20, right: 20, bottom: 50, left: 60 };
  const anchoSVG = 400;
  const altoSVG = 300;
  const ancho = anchoSVG - margen.left - margen.right;
  const alto = altoSVG - margen.top - margen.bottom;

  const ejeX = etiquetas.x || "X";
  const ejeY = etiquetas.y || "Y";

  let minX = Number.isFinite(etiquetas.minX) ? Number(etiquetas.minX) : Math.min(...datosValidos.map(d => d.x));
  let maxX = Number.isFinite(etiquetas.maxX) ? Number(etiquetas.maxX) : Math.max(...datosValidos.map(d => d.x));
  let minY = Number.isFinite(etiquetas.minY) ? Number(etiquetas.minY) : Math.min(...datosValidos.map(d => d.y));
  let maxY = Number.isFinite(etiquetas.maxY) ? Number(etiquetas.maxY) : Math.max(...datosValidos.map(d => d.y));

  // Si no son manuales, agrega un pequeño margen visual
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

  if (minX === maxX) { minX -= 1; maxX += 1; }
  if (minY === maxY) { minY -= 1; maxY += 1; }

  if (minX > maxX) { const aux = minX; minX = maxX; maxX = aux; }
  if (minY > maxY) { const aux = minY; minY = maxY; maxY = aux; }

  let ticksX = Number.isInteger(etiquetas.ticksX) && etiquetas.ticksX > 0 ? etiquetas.ticksX : 5;
  let ticksY = Number.isInteger(etiquetas.ticksY) && etiquetas.ticksY > 0 ? etiquetas.ticksY : 5;

  const rangoX = (maxX - minX) || 1;
  const rangoY = (maxY - minY) || 1;
  const pasoX = rangoX / ticksX;
  const pasoY = rangoY / ticksY;

  const escalaX = val => margen.left + ((val - minX) / rangoX) * ancho;
  const escalaY = val => margen.top + alto - ((val - minY) / rangoY) * alto;

  function formatearNumero(valor) {
    const redondeado = Math.round(valor * 100) / 100;
    if (Number.isInteger(redondeado)) return String(redondeado);
    return String(redondeado).replace(".", ",");
  }

  const colorPuntos = color || "steelblue";

  let svg = `<svg viewBox="0 0 ${anchoSVG} ${altoSVG}" style="width:${anchoSVG}px; height:${altoSVG}px;">`;

  // Fondo
  svg += `<rect x="0" y="0" width="${anchoSVG}" height="${altoSVG}" fill="white" />`;

  // Líneas guía verticales + etiquetas X
  for (let i = 0; i <= ticksX; i++) {
    const valX = minX + i * pasoX;
    const x = escalaX(valX);
    svg += `<line x1="${x}" y1="${margen.top}" x2="${x}" y2="${margen.top + alto}" stroke="#e0e0e0" />`;
    svg += `<line x1="${x}" y1="${margen.top + alto}" x2="${x}" y2="${margen.top + alto + 5}" stroke="black" />`;
    svg += `<text x="${x}" y="${margen.top + alto + 18}" font-size="10" text-anchor="middle">${formatearNumero(valX)}</text>`;
  }

  // Líneas guía horizontales + etiquetas Y
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left}" y1="${y}" x2="${margen.left + ancho}" y2="${y}" stroke="#e0e0e0" />`;
    svg += `<line x1="${margen.left - 5}" y1="${y}" x2="${margen.left}" y2="${y}" stroke="black" />`;
    svg += `<text x="${margen.left - 10}" y="${y}" font-size="10" text-anchor="end" dominant-baseline="middle">${formatearNumero(valY)}</text>`;
  }

  // Ejes
  svg += `<line x1="${margen.left}" y1="${margen.top}" x2="${margen.left}" y2="${margen.top + alto}" stroke="black" />`;
  svg += `<line x1="${margen.left}" y1="${margen.top + alto}" x2="${margen.left + ancho}" y2="${margen.top + alto}" stroke="black" />`;

  // Títulos de ejes
  svg += `<text x="${margen.left + ancho / 2}" y="${margen.top + alto + 40}" font-size="12" text-anchor="middle">${ejeX}</text>`;
  svg += `<text transform="rotate(-90)" x="${-(margen.top + alto / 2)}" y="${margen.left - 40}" font-size="12" text-anchor="middle">${ejeY}</text>`;

  // Puntos
  datosValidos.forEach(d => {
    svg += `<circle cx="${escalaX(d.x)}" cy="${escalaY(d.y)}" r="4" fill="${colorPuntos}" opacity="0.75" />`;
  });

  svg += `</svg>`;
  contenedor.innerHTML = svg;
}





  /* ================================================================== */




 // Dibuja un polígono de frecuencias o gráfico de líneas.
// Pensada principalmente para polígonos de frecuencia:
// - eje Y parte en 0 por defecto
// - maxY se estima automáticamente de forma "bonita"
// - ticksY se estima automáticamente
// - minY, maxY y ticksY pueden fijarse manualmente en etiquetasEjes
function dibujarGraficoLineas(contenedorId, etiquetasX, valoresY, etiquetasEjes, color) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  if (!Array.isArray(etiquetasX) || !Array.isArray(valoresY)) return;
  if (etiquetasX.length !== valoresY.length || etiquetasX.length === 0) return;

  const margen = { top: 20, right: 20, bottom: 50, left: 60 };
  const anchoSVG = 400;
  const altoSVG = 300;
  const ancho = anchoSVG - margen.left - margen.right;
  const alto = altoSVG - margen.top - margen.bottom;

  const ejeX = etiquetasEjes?.x || "Marca de clase";
  const ejeY = etiquetasEjes?.y || "Frecuencia";

  // Opciones manuales
  const minYManual = Number.isFinite(etiquetasEjes?.minY) ? etiquetasEjes.minY : null;
  const maxYManual = Number.isFinite(etiquetasEjes?.maxY) ? etiquetasEjes.maxY : null;
  const ticksYManual = Number.isInteger(etiquetasEjes?.ticksY) && etiquetasEjes.ticksY > 0
    ? etiquetasEjes.ticksY
    : null;

  // Convierte etiquetas X tipo "4,5" o "14.5" a número si se puede
  const marcasX = etiquetasX.map(v => {
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

  const usarEscalaNumericaX = marcasX.every(v => v !== null);

  const minX = usarEscalaNumericaX ? Math.min(...marcasX) : 0;
  const maxX = usarEscalaNumericaX ? Math.max(...marcasX) : (etiquetasX.length - 1);

  const maxDatoY = Math.max(...valoresY);

  // Estimación automática de maxY "bonito"
  let maxYAuto;
  if (maxDatoY <= 5) {
    maxYAuto = Math.ceil(maxDatoY);
  } else {
    const potencia = Math.pow(10, Math.floor(Math.log10(maxDatoY)));
    const proporcion = maxDatoY / potencia;

    if (proporcion <= 1) maxYAuto = 1 * potencia;
    else if (proporcion <= 2) maxYAuto = 2 * potencia;
    else if (proporcion <= 5) maxYAuto = 5 * potencia;
    else maxYAuto = 10 * potencia;

    // Si quedó por debajo por algún redondeo raro, subir un escalón
    if (maxYAuto < maxDatoY) {
      if (maxYAuto === 1 * potencia) maxYAuto = 2 * potencia;
      else if (maxYAuto === 2 * potencia) maxYAuto = 5 * potencia;
      else maxYAuto = 10 * potencia;
    }
  }

  // Eje Y: por defecto parte en 0
  let minY = minYManual !== null ? minYManual : 0;
  let maxY = maxYManual !== null ? maxYManual : maxYAuto;

  // Si el máximo manual o automático queda igual al mínimo, corregir
  if (minY === maxY) maxY = minY + 1;

  // Si vienen invertidos, intercambiar
  if (minY > maxY) {
    const aux = minY;
    minY = maxY;
    maxY = aux;
  }

  // Estimación automática de ticks
  let ticksY;
  if (ticksYManual !== null) {
    ticksY = ticksYManual;
  } else {
    const rangoEstimado = maxY - minY;
    if (rangoEstimado <= 5) ticksY = Math.max(1, Math.round(rangoEstimado));
    else if (rangoEstimado <= 10) ticksY = 5;
    else if (rangoEstimado <= 20) ticksY = 4;
    else if (rangoEstimado <= 50) ticksY = 5;
    else ticksY = 5;
  }

  const rangoX = (maxX - minX) || 1;
  const rangoY = (maxY - minY) || 1;
  const pasoY = rangoY / ticksY;

  const escalaX = usarEscalaNumericaX
    ? valor => margen.left + ((valor - minX) / rangoX) * ancho
    : indice => margen.left + (etiquetasX.length === 1 ? ancho / 2 : (indice * ancho / (etiquetasX.length - 1)));

  const escalaY = valor =>
    margen.top + alto - ((valor - minY) / rangoY) * alto;

  function formatearNumero(valor) {
    const redondeado = Math.round(valor * 100) / 100;
    if (Number.isInteger(redondeado)) return String(redondeado);
    return String(redondeado).replace(".", ",");
  }

  let svg = `<svg viewBox="0 0 ${anchoSVG} ${altoSVG}" style="width:${anchoSVG}px; height:${altoSVG}px;">`;

  // Fondo
  svg += `<rect x="0" y="0" width="${anchoSVG}" height="${altoSVG}" fill="white" />`;

  // Líneas guía horizontales
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left}" y1="${y}" x2="${margen.left + ancho}" y2="${y}" stroke="#e0e0e0" />`;
  }

  // Ejes
  svg += `<line x1="${margen.left}" y1="${margen.top}" x2="${margen.left}" y2="${margen.top + alto}" stroke="black" />`;
  svg += `<line x1="${margen.left}" y1="${margen.top + alto}" x2="${margen.left + ancho}" y2="${margen.top + alto}" stroke="black" />`;

  // Marcas y etiquetas eje Y
  for (let i = 0; i <= ticksY; i++) {
    const valY = minY + i * pasoY;
    const y = escalaY(valY);
    svg += `<line x1="${margen.left - 5}" y1="${y}" x2="${margen.left}" y2="${y}" stroke="black" />`;
    svg += `<text x="${margen.left - 10}" y="${y}" font-size="10" text-anchor="end" dominant-baseline="middle">${formatearNumero(valY)}</text>`;
  }

  // Etiquetas eje X
  etiquetasX.forEach((etiqueta, i) => {
    const x = usarEscalaNumericaX ? escalaX(marcasX[i]) : escalaX(i);
    svg += `<line x1="${x}" y1="${margen.top + alto}" x2="${x}" y2="${margen.top + alto + 5}" stroke="black" />`;
    svg += `<text x="${x}" y="${margen.top + alto + 18}" font-size="10" text-anchor="middle">${etiqueta}</text>`;
  });

  // Títulos de ejes
  svg += `<text x="${margen.left + ancho / 2}" y="${altoSVG - 8}" font-size="12" text-anchor="middle">${ejeX}</text>`;
  svg += `<text transform="rotate(-90)" x="${-(margen.top + alto / 2)}" y="18" font-size="12" text-anchor="middle">${ejeY}</text>`;

  // Línea del polígono
  const puntos = valoresY.map((v, i) => {
    const x = usarEscalaNumericaX ? escalaX(marcasX[i]) : escalaX(i);
    const y = escalaY(v);
    return `${x},${y}`;
  }).join(" ");

  svg += `<polyline points="${puntos}" fill="none" stroke="${color || "#1976d2"}" stroke-width="2.5" />`;

  // Puntos
  valoresY.forEach((v, i) => {
    const x = usarEscalaNumericaX ? escalaX(marcasX[i]) : escalaX(i);
    const y = escalaY(v);
    svg += `<circle cx="${x}" cy="${y}" r="4" fill="${color || "#1976d2"}" />`;
  });

  svg += `</svg>`;
  contenedor.innerHTML = svg;
}
  /* ================================================================== */
  /* EJECUCIÓN AUTOMÁTICA                            */
  /* ================================================================== */
  document.addEventListener('DOMContentLoaded', function() {
    
    // Botones de solución
    document.querySelectorAll('.boton-solucion').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const bloque = btn.closest('.ejercicio'); if (!bloque) return;
        const solucion = bloque.querySelector('.solucion'); if (solucion) { const mostrar = solucion.hidden; solucion.hidden = !mostrar; btn.textContent = mostrar ? 'Ocultar solución' : 'Mostrar solución'; }
      });
    });

    // Carga automática de todos los tipos de gráficos



  /* ================================================================== */

document.querySelectorAll('.grafico-barra-auto').forEach(function(div) {
  try {
    const id = div.id;
    const frecuencias = div.dataset.frecuencias ? JSON.parse(div.dataset.frecuencias) : [];
    const etiquetasX = div.dataset.etiquetas ? JSON.parse(div.dataset.etiquetas) : [];
    const color = div.dataset.color || '#ccc';
    const minY = div.dataset.minY !== undefined ? parseFloat(div.dataset.minY) : null;
    const maxY = div.dataset.maxY !== undefined ? parseFloat(div.dataset.maxY) : null;
    const ticksY = div.dataset.ticksY !== undefined ? parseInt(div.dataset.ticksY, 10) : null;
    const posicionEtiquetas = div.dataset.posicionEtiquetas !== undefined ? parseInt(div.dataset.posicionEtiquetas, 10) : 1;

    if (
      id &&
      Array.isArray(frecuencias) &&
      Array.isArray(etiquetasX) &&
      frecuencias.length === etiquetasX.length &&
      frecuencias.length > 0
    ) {
      dibujarGraficoBarra(id, frecuencias, etiquetasX, color, minY, maxY, ticksY, posicionEtiquetas);
    }
  } catch (e) {
    console.error('Error en gráfico de barras:', e, div);
  }
});


  /* ================================================================== */


document.querySelectorAll('.pictograma-auto').forEach(function(div) {
  try {
    const id = div.id;
    const datos = div.dataset.datos ? JSON.parse(div.dataset.datos) : [];
    const icono = div.dataset.icono || "";
    const valorPorIcono = div.dataset.valorPorIcono !== undefined ? parseFloat(div.dataset.valorPorIcono) : null;
    const color = div.dataset.color || "#666";

    if (id && Array.isArray(datos) && icono && Number.isFinite(valorPorIcono) && valorPorIcono > 0) {
      dibujarPictograma(id, datos, icono, valorPorIcono, color);
    }
  } catch (e) {
    console.error("Error en pictograma:", e, div);
  }
});


  /* ================================================================== */



document.querySelectorAll('.histograma-auto').forEach(function(div) {
  try {
    const id = div.id;
    const f = JSON.parse(div.dataset.frecuencias);
    const l = JSON.parse(div.dataset.limites);
    const c = div.dataset.color || '#ccc';
    const minY = div.dataset.minY !== undefined ? parseFloat(div.dataset.minY) : null;
    const maxY = div.dataset.maxY !== undefined ? parseFloat(div.dataset.maxY) : null;
    const ticksY = div.dataset.ticksY !== undefined ? parseInt(div.dataset.ticksY, 10) : null;

    if (id && f && l) {
      dibujarHistograma(id, f, l, c, minY, maxY, ticksY);
    }
  } catch (e) {
    console.error('Error en histograma:', e, div);
  }
});


  /* ================================================================== */

document.querySelectorAll('.grafico-circular-auto').forEach(function(div) {
  try {
    const id = div.id;
    const d = div.dataset.datos ? JSON.parse(div.dataset.datos) : [];

    if (id && Array.isArray(d) && d.length > 0) {
      dibujarGraficoCircular(id, d);
    }
  } catch (e) {
    console.error('Error en gráfico circular:', e, div);
  }
});


  /* ================================================================== */


document.querySelectorAll('.caja-auto').forEach(function(div) {
  try {
    const id = div.id;
    const d = div.dataset.valores ? JSON.parse(div.dataset.valores) : null;
    const c = div.dataset.color || 'rgba(255, 159, 64, 0.5)';

    if (id && d && typeof d === 'object') {
      dibujarGraficoCaja(id, d, c);
    }
  } catch (e) {
    console.error('Error en gráfico de caja:', e, div);
  }
});


  /* ================================================================== */


document.querySelectorAll('.ojiva-auto').forEach(function(div) {
  try {
    const id = div.id;
    const limites = div.dataset.limites ? JSON.parse(div.dataset.limites) : [];
    const frecAcumuladas = div.dataset.frecuenciasAcumuladas ? JSON.parse(div.dataset.frecuenciasAcumuladas) : [];
    const color = div.dataset.color || '#4bc0c0';
    const minY = div.dataset.minY !== undefined ? parseFloat(div.dataset.minY) : null;
    const maxY = div.dataset.maxY !== undefined ? parseFloat(div.dataset.maxY) : null;
    const ticksY = div.dataset.ticksY !== undefined ? parseInt(div.dataset.ticksY, 10) : null;

    let etiquetasEjes = {};

    if (div.dataset.etiquetasEjes) {
      etiquetasEjes = JSON.parse(div.dataset.etiquetasEjes);
    }

    etiquetasEjes = {
      x: etiquetasEjes.x || div.dataset.etiquetaX || "Valor observado",
      y: etiquetasEjes.y || div.dataset.etiquetaY || "Frecuencia acumulada"
    };

    if (
      id &&
      Array.isArray(limites) &&
      Array.isArray(frecAcumuladas) &&
      limites.length > 0 &&
      frecAcumuladas.length > 0
    ) {
      dibujarOjiva(id, limites, frecAcumuladas, color, minY, maxY, ticksY, etiquetasEjes);
    }
  } catch (e) {
    console.error('Error en ojiva:', e, div);
  }
});



  /* ================================================================== */

document.querySelectorAll('.grafico-dispersion-auto').forEach(function(div) {
  try {
    const id = div.id;
    const d = div.dataset.puntos ? JSON.parse(div.dataset.puntos) : [];
    const e = div.dataset.etiquetas ? JSON.parse(div.dataset.etiquetas) : {};
    const c = div.dataset.color || 'steelblue';

    if (id && Array.isArray(d) && d.length > 0) {
      dibujarGraficoDispersion(id, d, e, c);
    }
  } catch (e) {
    console.error('Error en gráfico de dispersión:', e, div);
  }
});


  /* ================================================================== */

document.querySelectorAll('.grafico-lineas-auto').forEach(function(div) {
  try {
    const id = div.id;
    const etiquetasX = div.dataset.etiquetasX ? JSON.parse(div.dataset.etiquetasX) : [];
    const valoresY = div.dataset.valoresY ? JSON.parse(div.dataset.valoresY) : [];
    const etiquetasEjes = div.dataset.etiquetasEjes ? JSON.parse(div.dataset.etiquetasEjes) : {};
    const color = div.dataset.color || '#3e95cd';

    if (
      id &&
      Array.isArray(etiquetasX) &&
      Array.isArray(valoresY) &&
      etiquetasX.length === valoresY.length &&
      etiquetasX.length > 0
    ) {
      dibujarGraficoLineas(id, etiquetasX, valoresY, etiquetasEjes, color);
    }
  } catch (e) {
    console.error('Error en gráfico de líneas:', e, div);
  }
});


  });
