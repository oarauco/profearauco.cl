(function () {
  "use strict";

  const VERSION = "1.9.0";
  const MOTOR = "FraccionRect";
  const CSS_ID = "fraccion-rect-css-v190";

  const CFG = {
    unidadAnchoIdeal: 150,
    unidadAltoIdeal: 120,
    celdaAnchoMin: 15,
    celdaAltoMin: 15,

    espacioEntreUnidades: "1rem",

    bordePx: 2,
    radioPx: 10,
    colorBorde: "#26332d",

    colorRellenoPositivo: "rgba(76, 175, 80, 0.78)",
    colorRellenoNegativo: "rgba(255, 98, 0, 0.78)",

    colorAreaF1: "rgba(173, 205, 172, 0.8)",
    colorAreaF2: "rgba(255, 206, 86, 0.4)",
    colorAreaInterseccion: "rgba(76, 175, 80, 0.78)",
    colorBordeArea: "rgb(33, 31, 31)",
    colorBordeAreaResalte: "#000000",

    lineaVerticalPx: 2,
    lineaHorizontalContinuaPx: 1.5,
    lineaHorizontalPunteadaPx: 2,

    etiquetaUnidad: true,
    textoUnidad: "Unidad",

    etiquetaFraccion: "ninguna",
    etiquetaDivision: "proceso",

    denominadorMaximo: 220
  };

  if (window[MOTOR] && window[MOTOR].version === VERSION) {
    window[MOTOR].renderAll();
    return;
  }

  function inyectarCSS() {
    if (document.getElementById(CSS_ID)) return;

    [
      "fraccion-rect-css-v1",
      "fraccion-rect-css-v11",
      "fraccion-rect-css-v12",
      "fraccion-rect-css-v13",
      "fraccion-rect-css-v14",
      "fraccion-rect-css-v15",
      "fraccion-rect-css-v16",
      "fraccion-rect-css-v17",
      "fraccion-rect-css-v171",
      "fraccion-rect-css-v180",
      "fraccion-rect-css-v190"
    ].forEach(function (id) {
      const anterior = document.getElementById(id);
      if (anterior) anterior.remove();
    });

    const style = document.createElement("style");
    style.id = CSS_ID;

    style.textContent = `
.fraccion-rect.fraccion-rect--rendered {
  margin: 1rem 0;
  font-family: inherit;
}

.fraccion-rect__bloque {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: fit-content;
  max-width: 100%;
}

.fraccion-rect__zona {
  display: flex;
  flex-wrap: wrap;
  gap: var(--fr-gap, 1rem);
  align-items: flex-start;
}

.fraccion-rect__unidad {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: center;
}

.fraccion-rect__unidad-etiqueta {
  font-size: 0.85rem;
  opacity: 0.8;
  text-align: center;
  line-height: 1.2;
}

.fraccion-rect__etiqueta {
  width: 100%;
  margin-top: 0.45rem;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  box-sizing: border-box;
}

.fraccion-rect__grid {
  --fr-cols: 1;
  --fr-rows: 1;
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--fr-cols), 1fr);
  grid-template-rows: repeat(var(--fr-rows), 1fr);
  max-width: 100%;
  overflow: hidden;
  background: transparent;
  box-sizing: border-box;
}

.fraccion-rect__celda {
  background: transparent;
  box-sizing: border-box;
}

.fraccion-rect__linea-v {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  z-index: 3;
  pointer-events: none;
}

.fraccion-rect__linea-h {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  z-index: 2;
  pointer-events: none;
}

.fraccion-rect__error {
  border: 1px solid rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.06);
  color: #7f1d1d;
  border-radius: 10px;
  padding: 0.75rem 1rem;
}

.fraccion-area.fraccion-area--rendered {
  margin: 1rem 0;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: fit-content;
}

.fraccion-area__contenedor {
  display: grid;
  gap: var(--fr-gap, 1rem);
}

.fraccion-area__grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  grid-template-rows: repeat(var(--rows), 1fr);
  border: 2px solid var(--border-color, #26332d);
  background-color: transparent;
  border-radius: 4px;
}

.fraccion-area__celda {
  background-color: transparent;
  box-sizing: border-box;
}

.fraccion-area__etiqueta {
  font-size: 1rem;
  font-weight: bold;
  color: #333;
}


.fraccion-division.fraccion-division--rendered {
  margin: 1rem 0;
  font-family: inherit;
  max-width: 100%;
}

.fraccion-division__bloque {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: fit-content;
  max-width: 100%;
}

.fraccion-division__tabla {
  display: grid;
  grid-template-columns: auto auto auto auto;
  gap: 0.55rem 0.85rem;
  align-items: center;
  max-width: 100%;
  overflow-x: auto;
  padding-bottom: 0.15rem;
}

.fraccion-division__encabezado {
  font-size: 0.86rem;
  font-weight: 700;
  text-align: center;
  opacity: 0.85;
  white-space: nowrap;
}

.fraccion-division__fila-titulo {
  font-size: 0.9rem;
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}

.fraccion-division__fraccion {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.fraccion-division__rotulo {
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
}

.fraccion-division__conteo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.fraccion-division__bloques {
  --fr-count-cols: 1;
  display: grid;
  grid-template-columns: repeat(var(--fr-count-cols), 1fr);
  gap: 3px;
  width: fit-content;
  max-width: 100%;
  box-sizing: border-box;
}

.fraccion-division__bloque-celda {
  width: 22px;
  height: 22px;
  border: 1.5px solid var(--fr-border, #26332d);
  border-radius: 4px;
  background: var(--fr-fill, rgba(76, 175, 80, 0.78));
  box-sizing: border-box;
}

.fraccion-division__bloques-vacio {
  min-width: 56px;
  min-height: 22px;
  border: 1.5px dashed var(--fr-border, #26332d);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  opacity: 0.8;
}

.fraccion-division__resultado {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
  background: rgba(76, 175, 80, 0.08);
  border: 1px solid rgba(76, 175, 80, 0.22);
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
}

`;

    document.head.appendChild(style);
  }

  function crear(tag, clase, texto) {
    const el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) {
      el.textContent = String(texto);
    }
    return el;
  }

  function mcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);

    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }

    return a || 1;
  }

  function mcm(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);

    if (a === 0 || b === 0) return 0;

    return Math.abs(a / mcd(a, b) * b);
  }

  function factorParCercano(n) {
    const raiz = Math.floor(Math.sqrt(n));

    for (let f = raiz; f >= 1; f--) {
      if (n % f === 0) {
        const otro = n / f;

        return {
          filas: Math.min(f, otro),
          columnas: Math.max(f, otro)
        };
      }
    }

    return {
      filas: 1,
      columnas: n
    };
  }

  function limpiarTexto(texto) {
    return String(texto || "")
      .replace(/\u00A0/g, " ")
      .trim()
      .replace(/[−–—]/g, "-")
      .replace(/\s+/g, " ");
  }

  function limpiarModo(texto) {
    return limpiarTexto(texto).toLowerCase().replace(/\s+/g, "");
  }

  function parsearGrid(texto) {
    const limpio = limpiarTexto(texto);

    if (!limpio) return null;

    const m = limpio.match(/^(\d+)\s*[x×]\s*(\d+)$/i);

    if (!m) {
      throw new Error("data-grid inválido. Usa un formato como 6x4, 12x8 o 1x3.");
    }

    const columnas = Number(m[1]);
    const filas = Number(m[2]);

    if (!Number.isInteger(columnas) || !Number.isInteger(filas) || columnas <= 0 || filas <= 0) {
      throw new Error("data-grid debe usar columnas y filas enteras positivas.");
    }

    if (columnas * filas > CFG.denominadorMaximo) {
      throw new Error("Grilla demasiado grande para esta visualización.");
    }

    return { columnas, filas, totalCeldas: columnas * filas };
  }

  function normalizarRecorrido(texto, valorPorDefecto) {
    const modo = limpiarModo(texto);

    if (!modo) return valorPorDefecto || "columnas";

    if (["fila", "filas", "porfila", "porfilas", "horizontal", "horizontales"].includes(modo)) {
      return "filas";
    }

    if (["columna", "columnas", "porcolumna", "porcolumnas", "vertical", "verticales"].includes(modo)) {
      return "columnas";
    }

    throw new Error("data-recorrido inválido. Usa filas o columnas.");
  }

  function parsearEnteroPositivoOpcional(valor, nombre) {
    const limpio = limpiarTexto(valor);

    if (!limpio) return null;

    if (!/^\d+$/.test(limpio)) {
      throw new Error(nombre + " debe ser un entero positivo.");
    }

    const n = Number(limpio);

    if (n <= 0) {
      throw new Error(nombre + " debe ser mayor que 0.");
    }

    return n;
  }

  function normalizarEtiqueta(texto) {
    const modo = limpiarModo(texto || CFG.etiquetaFraccion);

    if (!modo || ["ninguna", "no", "false", "0", "oculta", "ocultar"].includes(modo)) {
      return "ninguna";
    }

    if (["true", "si", "sí", "equivalencia", "equivalente", "igualdad"].includes(modo)) {
      return "equivalencia";
    }

    if (["original", "fraccion", "fracción"].includes(modo)) {
      return "original";
    }

    if (["visual", "vista", "representacion", "representación"].includes(modo)) {
      return "visual";
    }

    throw new Error("data-etiqueta inválido. Usa ninguna, original, visual o equivalencia.");
  }

  function formatearFraccion(numerador, denominador) {
    return numerador + "/" + denominador;
  }

  function mismaFraccion(n1, d1, n2, d2) {
    return n1 * d2 === n2 * d1;
  }

  function parsearCantidad(contenido) {
    const limpio = limpiarTexto(contenido).replace(/\s*\/\s*/g, "/");

    const mixto = limpio.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);

    if (mixto) {
      const enteroTexto = mixto[1];
      const entero = Number(enteroTexto);
      const parteNumerador = Number(mixto[2]);
      const denominador = Number(mixto[3]);

      if (denominador === 0) {
        throw new Error("El denominador no puede ser 0.");
      }

      const signo = enteroTexto.startsWith("-") ? -1 : 1;
      const enteroAbs = Math.abs(entero);
      const numerador = signo * (enteroAbs * denominador + parteNumerador);

      return {
        numerador,
        denominador,
        tipoEntrada: "mixto"
      };
    }

    const fraccion = limpio.match(/^([+-]?\d+)\/([+-]?\d+)$/);

    if (fraccion) {
      let numerador = Number(fraccion[1]);
      let denominador = Number(fraccion[2]);

      if (denominador === 0) {
        throw new Error("El denominador no puede ser 0.");
      }

      if (denominador < 0) {
        numerador *= -1;
        denominador *= -1;
      }

      return {
        numerador,
        denominador,
        tipoEntrada: "fraccion"
      };
    }

    throw new Error("data-fraccion inválido. Usa formatos como 2/3, -2/3 o 1 1/3.");
  }

  function normalizarModoFraccion(texto) {
    const modo = limpiarModo(texto);

    if (!modo || ["fraccion", "fracción", "normal", "auto"].includes(modo)) {
      return "fraccion";
    }

    if (["simplifica", "simplificar", "simplificacion", "simplificación"].includes(modo)) {
      return "simplifica";
    }

    throw new Error("data-modo inválido. Usa fraccion o simplifica.");
  }

  function parsearEspecificacionFraccion(valorFraccion, modoAtributo) {
    const contenido = limpiarTexto(valorFraccion);

    if (!contenido) {
      throw new Error('Falta data-fraccion. Usa, por ejemplo, data-fraccion="3/4".');
    }

    const modo = normalizarModoFraccion(modoAtributo);
    const cantidad = parsearCantidad(contenido);

    if (!Number.isInteger(cantidad.numerador) || !Number.isInteger(cantidad.denominador)) {
      throw new Error("La fracción debe usar números enteros.");
    }

    if (cantidad.denominador > CFG.denominadorMaximo) {
      throw new Error("Denominador demasiado grande para esta visualización.");
    }

    return {
      modo,
      numerador: cantidad.numerador,
      denominador: cantidad.denominador,
      tipoEntrada: cantidad.tipoEntrada
    };
  }

  function analizar(numerador, denominador, modo) {
    const signo = numerador < 0 ? -1 : 1;
    const numeradorAbs = Math.abs(numerador);

    const g = mcd(numeradorAbs, denominador);

    let columnas;
    let filas;
    let tipoLineasHorizontales;

    /*
      Casos especiales:
      1) 0/b debe usar la factorización del denominador.
      2) kb/b, cuando la fracción es un entero exacto, también debe usar
         la factorización del denominador para que cada unidad completa
         se vea igual que 1/b, 2/b, ..., b/b.
    */
    const esCero = numeradorAbs === 0;
    const esEnteroExacto = numeradorAbs > 0 && numeradorAbs % denominador === 0;

    if (esCero || esEnteroExacto) {
      const par = factorParCercano(denominador);

      columnas = par.columnas;
      filas = par.filas;

      if (filas > 1) {
        tipoLineasHorizontales = "continua";
      } else {
        tipoLineasHorizontales = "ninguna";
      }
    } else if (g > 1) {
      columnas = denominador / g;
      filas = g;

      if (modo === "simplifica") {
        tipoLineasHorizontales = "punteada";
      } else {
        tipoLineasHorizontales = "continua";
      }
    } else {
      const par = factorParCercano(denominador);

      columnas = par.columnas;
      filas = par.filas;

      if (filas > 1) {
        tipoLineasHorizontales = "continua";
      } else {
        tipoLineasHorizontales = "ninguna";
      }
    }

    const enteros = Math.floor(numeradorAbs / denominador);
    const resto = numeradorAbs % denominador;

    let totalUnidades = enteros;

    if (resto > 0 || numeradorAbs === 0) {
      totalUnidades += 1;
    }

    return {
      modo,
      numerador,
      numeradorAbs,
      denominador,
      signo,
      g,
      columnas,
      filas,
      tipoLineasHorizontales,
      enteros,
      resto,
      totalUnidades
    };
  }

  function calcularTamanoUnidad(columnas, filas) {
    const ancho = Math.max(
      CFG.unidadAnchoIdeal,
      columnas * CFG.celdaAnchoMin
    );

    const alto = Math.max(
      CFG.unidadAltoIdeal,
      filas * CFG.celdaAltoMin
    );

    return { ancho, alto };
  }

  function calcularOrdenCelda(r, c, columnas, filas, recorrido, maxPorFila) {
    if (recorrido === "filas") {
      if (maxPorFila && maxPorFila < columnas) {
        const anchoBloque = maxPorFila;
        const bloque = Math.floor(c / anchoBloque);
        const posicionEnBloque = c % anchoBloque;

        return bloque * filas * anchoBloque + r * anchoBloque + posicionEnBloque;
      }

      return r * columnas + c;
    }

    return c * filas + r;
  }

  function crearUnidad(opciones) {
    const columnas = opciones.columnas;
    const filas = opciones.filas;
    const celdasPintadas = opciones.celdasPintadas;
    const tipoLineasHorizontales = opciones.tipoLineasHorizontales;
    const indice = opciones.indice;
    const totalUnidades = opciones.totalUnidades;
    const denominador = opciones.denominador;
    const denominadorVisual = opciones.denominadorVisual || columnas * filas;
    const colorRelleno = opciones.colorRelleno;
    const recorrido = opciones.recorrido || "columnas";
    const maxPorFila = opciones.maxPorFila || null;

    const unidad = crear("div", "fraccion-rect__unidad");

    if (CFG.etiquetaUnidad && totalUnidades > 1) {
      unidad.appendChild(
        crear(
          "div",
          "fraccion-rect__unidad-etiqueta",
          CFG.textoUnidad + " " + indice
        )
      );
    }

    const grid = crear("div", "fraccion-rect__grid");

    grid.style.setProperty("--fr-cols", columnas);
    grid.style.setProperty("--fr-rows", filas);

    const tamano = calcularTamanoUnidad(columnas, filas);

    grid.style.width = tamano.ancho + "px";
    grid.style.height = tamano.alto + "px";

    grid.style.border = CFG.bordePx + "px solid " + CFG.colorBorde;
    grid.style.borderRadius = CFG.radioPx + "px";

    grid.setAttribute(
      "aria-label",
      "Rectángulo dividido visualmente en " + denominadorVisual +
        " partes, que representa una unidad de denominador " + denominador +
        ", con " + celdasPintadas + " partes visuales marcadas."
    );

    for (let r = 0; r < filas; r++) {
      for (let c = 0; c < columnas; c++) {
        const celda = crear("div", "fraccion-rect__celda");

        const orden = calcularOrdenCelda(
          r,
          c,
          columnas,
          filas,
          recorrido,
          maxPorFila
        );

        if (orden < celdasPintadas) {
          celda.style.background = colorRelleno;
        }

        grid.appendChild(celda);
      }
    }

    for (let c = 1; c < columnas; c++) {
      const linea = crear("div", "fraccion-rect__linea-v");
      linea.style.left = (100 * c / columnas) + "%";
      linea.style.borderLeft =
        CFG.lineaVerticalPx + "px solid " + CFG.colorBorde;
      grid.appendChild(linea);
    }

    if (tipoLineasHorizontales !== "ninguna") {
      for (let r = 1; r < filas; r++) {
        const linea = crear("div", "fraccion-rect__linea-h");
        linea.style.top = (100 * r / filas) + "%";

        if (tipoLineasHorizontales === "punteada") {
          linea.style.borderTop =
            CFG.lineaHorizontalPunteadaPx + "px dotted " + CFG.colorBorde;
        } else {
          linea.style.borderTop =
            CFG.lineaHorizontalContinuaPx + "px solid " + CFG.colorBorde;
        }

        grid.appendChild(linea);
      }
    }

    unidad.appendChild(grid);

    return unidad;
  }

  function prepararDatosVisuales(datos, gridVisual) {
    if (!gridVisual) {
      return Object.assign({}, datos, {
        denominadorVisual: datos.denominador,
        celdasPorUnidad: datos.denominador,
        restoVisual: datos.resto,
        usaGridVisual: false
      });
    }

    const totalCeldas = gridVisual.totalCeldas;
    const restoVisualExacto = datos.resto * totalCeldas / datos.denominador;

    if (!Number.isInteger(restoVisualExacto)) {
      throw new Error(
        "La fracción " + formatearFraccion(datos.numerador, datos.denominador) +
          " no se puede representar con celdas completas en una grilla " +
          gridVisual.columnas + "x" + gridVisual.filas + "."
      );
    }

    return Object.assign({}, datos, {
      columnas: gridVisual.columnas,
      filas: gridVisual.filas,
      denominadorVisual: totalCeldas,
      celdasPorUnidad: totalCeldas,
      restoVisual: restoVisualExacto,
      tipoLineasHorizontales: gridVisual.filas > 1 ? "continua" : "ninguna",
      usaGridVisual: true
    });
  }

  function crearEtiqueta(datos, tipoEtiqueta) {
    if (tipoEtiqueta === "ninguna") return null;

    const originalNum = datos.numerador;
    const originalDen = datos.denominador;
    const visualNumAbs = datos.enteros * datos.celdasPorUnidad + datos.restoVisual;
    const visualNum = datos.signo < 0 ? -visualNumAbs : visualNumAbs;
    const visualDen = datos.denominadorVisual;

    let texto;

    if (tipoEtiqueta === "original") {
      texto = formatearFraccion(originalNum, originalDen);
    } else if (tipoEtiqueta === "visual") {
      texto = formatearFraccion(visualNum, visualDen);
    } else {
      if (mismaFraccion(originalNum, originalDen, visualNum, visualDen)) {
        if (originalNum === visualNum && originalDen === visualDen) {
          texto = formatearFraccion(originalNum, originalDen);
        } else {
          texto = formatearFraccion(originalNum, originalDen) + " = " +
            formatearFraccion(visualNum, visualDen);
        }
      } else {
        texto = formatearFraccion(originalNum, originalDen);
      }
    }

    return crear("div", "fraccion-rect__etiqueta", texto);
  }

  function renderizarElemento(el) {
    inyectarCSS();

    const fuente = el.getAttribute("data-fraccion") || "";
    const modoAtributo = el.getAttribute("data-modo") || "";

    el.classList.add("fraccion-rect--rendered");
    el.innerHTML = "";

    try {
      const spec = parsearEspecificacionFraccion(fuente, modoAtributo);
      const gridVisual = parsearGrid(el.getAttribute("data-grid") || "");
      const recorrido = normalizarRecorrido(
        el.getAttribute("data-recorrido") || "",
        gridVisual ? "filas" : "columnas"
      );
      const maxPorFila = parsearEnteroPositivoOpcional(
        el.getAttribute("data-max-por-fila") || "",
        "data-max-por-fila"
      );
      const tipoEtiqueta = normalizarEtiqueta(el.getAttribute("data-etiqueta") || "");

      if (maxPorFila && recorrido !== "filas") {
        throw new Error("data-max-por-fila requiere data-recorrido=\"filas\".");
      }

      if (gridVisual && maxPorFila && maxPorFila > gridVisual.columnas) {
        throw new Error("data-max-por-fila no puede ser mayor que las columnas de data-grid.");
      }

      const datosBase = analizar(
        spec.numerador,
        spec.denominador,
        spec.modo
      );

      const datos = prepararDatosVisuales(datosBase, gridVisual);

      const colorRelleno =
        datos.signo < 0
          ? CFG.colorRellenoNegativo
          : CFG.colorRellenoPositivo;

      const bloque = crear("div", "fraccion-rect__bloque");
      const zona = crear("div", "fraccion-rect__zona");
      zona.style.setProperty("--fr-gap", CFG.espacioEntreUnidades);

      for (let i = 1; i <= datos.totalUnidades; i++) {
        let pintadas;

        if (i <= datos.enteros) {
          pintadas = datos.celdasPorUnidad;
        } else {
          pintadas = datos.restoVisual;
        }

        zona.appendChild(
          crearUnidad({
            columnas: datos.columnas,
            filas: datos.filas,
            denominador: datos.denominador,
            denominadorVisual: datos.denominadorVisual,
            celdasPintadas: pintadas,
            tipoLineasHorizontales: datos.tipoLineasHorizontales,
            indice: i,
            totalUnidades: datos.totalUnidades,
            colorRelleno,
            recorrido,
            maxPorFila
          })
        );
      }

      bloque.appendChild(zona);

      const etiqueta = crearEtiqueta(datos, tipoEtiqueta);
      if (etiqueta) {
        bloque.appendChild(etiqueta);
      }

      el.appendChild(bloque);
    } catch (error) {
      el.appendChild(
        crear("div", "fraccion-rect__error", error.message)
      );
    }
  }

  function normalizarModeloDivision(texto) {
    const modo = limpiarModo(texto);

    if (!modo || ["mcm", "denominadorcomun", "denominadorcomún", "comun", "común"].includes(modo)) {
      return "mcm";
    }

    throw new Error('data-modelo inválido para división. Usa "mcm" o "denominador-comun".');
  }

  function normalizarEtiquetaDivision(texto) {
    const modo = limpiarModo(texto || CFG.etiquetaDivision);

    if (!modo || ["ninguna", "no", "false", "0", "oculta", "ocultar"].includes(modo)) {
      return "ninguna";
    }

    if (["resultado", "res", "final"].includes(modo)) {
      return "resultado";
    }

    if (["true", "si", "sí", "proceso", "completa", "completo", "detalle", "detallada"].includes(modo)) {
      return "proceso";
    }

    throw new Error('data-etiqueta inválido para división. Usa ninguna, resultado o proceso.');
  }

  function parsearDivisionDesdeAtributos(el) {
    const valorDividendo = el.getAttribute("data-dividendo") || "";
    const valorDivisor = el.getAttribute("data-divisor") || "";

    if (!limpiarTexto(valorDividendo) || !limpiarTexto(valorDivisor)) {
      throw new Error('Faltan data-dividendo y data-divisor. Ejemplo: data-dividendo="2/3" data-divisor="1/6".');
    }

    const dividendo = parsearCantidad(valorDividendo);
    const divisor = parsearCantidad(valorDivisor);

    if (divisor.numerador === 0) {
      throw new Error("No se puede dividir por 0.");
    }

    if (dividendo.denominador > CFG.denominadorMaximo || divisor.denominador > CFG.denominadorMaximo) {
      throw new Error("Denominador demasiado grande para esta visualización.");
    }

    return { dividendo, divisor };
  }

  function formatearResultadoDivision(numerador, denominador) {
    if (denominador < 0) {
      numerador *= -1;
      denominador *= -1;
    }

    const g = mcd(numerador, denominador);
    const n = numerador / g;
    const d = denominador / g;

    if (d === 1) return String(n);

    const fraccion = formatearFraccion(n, d);
    const absN = Math.abs(n);

    if (absN > d) {
      const entero = Math.trunc(absN / d);
      const resto = absN % d;
      const signo = n < 0 ? "-" : "";

      if (resto === 0) return String(n / d);

      return fraccion + " = " + signo + entero + " " + resto + "/" + d;
    }

    return fraccion;
  }

  function crearVisualFraccionDivision(numerador, denominador, rotulo) {
    const contenedor = crear("div", "fraccion-division__fraccion");
    contenedor.appendChild(crear("div", "fraccion-division__rotulo", rotulo));

    const datosBase = analizar(numerador, denominador, "fraccion");
    const datos = prepararDatosVisuales(datosBase, null);
    const colorRelleno = datos.signo < 0 ? CFG.colorRellenoNegativo : CFG.colorRellenoPositivo;
    const zona = crear("div", "fraccion-rect__zona");
    zona.style.setProperty("--fr-gap", CFG.espacioEntreUnidades);

    for (let i = 1; i <= datos.totalUnidades; i++) {
      const pintadas = i <= datos.enteros ? datos.celdasPorUnidad : datos.restoVisual;

      zona.appendChild(
        crearUnidad({
          columnas: datos.columnas,
          filas: datos.filas,
          denominador: datos.denominador,
          denominadorVisual: datos.denominadorVisual,
          celdasPintadas: pintadas,
          tipoLineasHorizontales: datos.tipoLineasHorizontales,
          indice: i,
          totalUnidades: datos.totalUnidades,
          colorRelleno,
          recorrido: "filas",
          maxPorFila: null
        })
      );
    }

    contenedor.appendChild(zona);
    return contenedor;
  }

  function crearConteoBloques(cantidad, rotulo, colorRelleno) {
    const contenedor = crear("div", "fraccion-division__conteo");
    contenedor.appendChild(crear("div", "fraccion-division__rotulo", rotulo));

    const cantidadAbs = Math.abs(cantidad);

    if (cantidadAbs === 0) {
      const vacio = crear("div", "fraccion-division__bloques-vacio", "0");
      vacio.style.setProperty("--fr-border", CFG.colorBorde);
      contenedor.appendChild(vacio);
      return contenedor;
    }

    const columnas = Math.min(cantidadAbs, 12);
    const bloques = crear("div", "fraccion-division__bloques");
    bloques.style.setProperty("--fr-count-cols", columnas);

    for (let i = 0; i < cantidadAbs; i++) {
      const celda = crear("div", "fraccion-division__bloque-celda");
      celda.style.setProperty("--fr-border", CFG.colorBorde);
      celda.style.setProperty("--fr-fill", colorRelleno);
      bloques.appendChild(celda);
    }

    contenedor.appendChild(bloques);
    return contenedor;
  }

  function crearEtiquetaDivision(datos, tipoEtiqueta) {
    if (tipoEtiqueta === "ninguna") return null;

    const resultado = formatearResultadoDivision(datos.resultadoNumerador, datos.resultadoDenominador);
    const original = formatearFraccion(datos.dividendo.numerador, datos.dividendo.denominador) +
      " ÷ " + formatearFraccion(datos.divisor.numerador, datos.divisor.denominador);

    if (tipoEtiqueta === "resultado") {
      return crear("div", "fraccion-division__resultado", original + " = " + resultado);
    }

    const mismoDenominador = datos.dividendo.denominador === datos.divisor.denominador;
    let texto;

    if (mismoDenominador) {
      texto = "Como tienen el mismo denominador (" + datos.denominadorComun + 
        "), dividimos directamente los numeradores: " + 
        datos.dividendoComun + " ÷ " + datos.divisorComun + " = " + resultado;
    } else {
      texto =
        "MCM(" + datos.dividendo.denominador + ", " + datos.divisor.denominador + ") = " + datos.denominadorComun +
        " · " + formatearFraccion(datos.dividendo.numerador, datos.dividendo.denominador) +
        " = " + formatearFraccion(datos.dividendoComun, datos.denominadorComun) +
        " y " + formatearFraccion(datos.divisor.numerador, datos.divisor.denominador) +
        " = " + formatearFraccion(datos.divisorComun, datos.denominadorComun) +
        " · Entonces " + datos.dividendoComun + " ÷ " + datos.divisorComun + " = " + resultado;
    }

    return crear("div", "fraccion-division__resultado", texto);
  }

  function renderizarElementoDivision(el) {
    inyectarCSS();

    el.classList.add("fraccion-division--rendered");
    el.innerHTML = "";

    try {
      const modelo = normalizarModeloDivision(el.getAttribute("data-modelo") || "");
      const tipoEtiqueta = normalizarEtiquetaDivision(el.getAttribute("data-etiqueta") || "");

      if (modelo !== "mcm") {
        throw new Error('Modelo de división no disponible. Usa data-modelo="mcm".');
      }

      const parsed = parsearDivisionDesdeAtributos(el);
      const dividendo = parsed.dividendo;
      const divisor = parsed.divisor;
      const denominadorComun = mcm(dividendo.denominador, divisor.denominador);

      if (denominadorComun <= 0 || denominadorComun > CFG.denominadorMaximo) {
        throw new Error("El MCM de los denominadores es demasiado grande para esta visualización.");
      }

      const dividendoComun = dividendo.numerador * (denominadorComun / dividendo.denominador);
      const divisorComun = divisor.numerador * (denominadorComun / divisor.denominador);
      const resultadoNumerador = dividendo.numerador * divisor.denominador;
      const resultadoDenominador = dividendo.denominador * divisor.numerador;
      const colorDividendo = dividendo.numerador < 0 ? CFG.colorRellenoNegativo : CFG.colorRellenoPositivo;
      const colorDivisor = divisor.numerador < 0 ? CFG.colorRellenoNegativo : CFG.colorRellenoPositivo;
      const mismoDenominador = dividendo.denominador === divisor.denominador;

      const datos = {
        dividendo,
        divisor,
        denominadorComun,
        dividendoComun,
        divisorComun,
        resultadoNumerador,
        resultadoDenominador
      };

      const bloque = crear("div", "fraccion-division__bloque");
      const tabla = crear("div", "fraccion-division__tabla");
      tabla.style.gridTemplateColumns = mismoDenominador ? "auto auto auto" : "auto auto auto auto";

      tabla.appendChild(crear("div", "fraccion-division__encabezado", ""));
      if (!mismoDenominador) {
        tabla.appendChild(crear("div", "fraccion-division__encabezado", "Original"));
        tabla.appendChild(crear("div", "fraccion-division__encabezado", "Denominador común"));
      } else {
        tabla.appendChild(crear("div", "fraccion-division__encabezado", "Fracción"));
      }
      tabla.appendChild(crear("div", "fraccion-division__encabezado", "Comparación"));

      tabla.appendChild(crear("div", "fraccion-division__fila-titulo", "Dividendo"));
      if (!mismoDenominador) {
        tabla.appendChild(
          crearVisualFraccionDivision(
            dividendo.numerador,
            dividendo.denominador,
            formatearFraccion(dividendo.numerador, dividendo.denominador)
          )
        );
      }
      tabla.appendChild(
        crearVisualFraccionDivision(
          dividendoComun,
          denominadorComun,
          formatearFraccion(dividendoComun, denominadorComun)
        )
      );
      tabla.appendChild(
        crearConteoBloques(
          Math.abs(dividendoComun),
          Math.abs(dividendoComun) + " bloques",
          colorDividendo
        )
      );

      tabla.appendChild(crear("div", "fraccion-division__fila-titulo", "Divisor"));
      if (!mismoDenominador) {
        tabla.appendChild(
          crearVisualFraccionDivision(
            divisor.numerador,
            divisor.denominador,
            formatearFraccion(divisor.numerador, divisor.denominador)
          )
        );
      }
      tabla.appendChild(
        crearVisualFraccionDivision(
          divisorComun,
          denominadorComun,
          formatearFraccion(divisorComun, denominadorComun)
        )
      );
      tabla.appendChild(
        crearConteoBloques(
          Math.abs(divisorComun),
          Math.abs(divisorComun) + " bloques",
          colorDivisor
        )
      );

      bloque.appendChild(tabla);

      const etiqueta = crearEtiquetaDivision(datos, tipoEtiqueta);
      if (etiqueta) {
        bloque.appendChild(etiqueta);
      }

      el.appendChild(bloque);
    } catch (error) {
      el.appendChild(crear("div", "fraccion-rect__error", error.message));
    }
  }

  function parsearProductoDesdeAtributos(el) {
    const valor1 = el.getAttribute("data-factor-1") || "";
    const valor2 = el.getAttribute("data-factor-2") || "";

    if (!limpiarTexto(valor1) || !limpiarTexto(valor2)) {
      throw new Error('Faltan data-factor-1 y data-factor-2. Ejemplo: data-factor-1="2/5" data-factor-2="3/4".');
    }

    const f1 = parsearCantidad(valor1);
    const f2 = parsearCantidad(valor2);
    return { f1, f2 };
  }

  function renderizarElementoArea(el) {
    inyectarCSS();

    el.classList.add("fraccion-area--rendered");
    el.innerHTML = "";

    try {
      const prod = parsearProductoDesdeAtributos(el);
      const f1 = prod.f1;
      const f2 = prod.f2;

      // Para que A * B represente "A de B", la base son las columnas (B) y el corte son las filas (A)
      const base = f2;
      const corte = f1;

      const numBase = Math.abs(base.numerador);
      const numCorte = Math.abs(corte.numerador);
      const uCols = Math.max(1, Math.ceil(numBase / base.denominador));
      const uRows = Math.max(1, Math.ceil(numCorte / corte.denominador));

      const contenedor = crear("div", "fraccion-area__contenedor");
      contenedor.style.gridTemplateColumns = `repeat(${uCols}, 1fr)`;
      contenedor.style.setProperty("--fr-gap", CFG.espacioEntreUnidades);

      const baseWidth = Math.max(100, base.denominador * CFG.celdaAnchoMin);
      const baseHeight = Math.max(100, corte.denominador * CFG.celdaAltoMin);

      for (let ur = 0; ur < uRows; ur++) {
        for (let uc = 0; uc < uCols; uc++) {
          const grid = crear("div", "fraccion-area__grid");
          grid.style.setProperty("--cols", base.denominador);
          grid.style.setProperty("--rows", corte.denominador);
          grid.style.setProperty("--border-color", CFG.colorBordeArea);
          
          grid.style.width = baseWidth + "px";
          grid.style.height = baseHeight + "px";

          for (let r = 0; r < corte.denominador; r++) {
            for (let c = 0; c < base.denominador; c++) {
              const celda = crear("div", "fraccion-area__celda");
              
              const colGlobal = uc * base.denominador + c;
              const rowGlobal = ur * corte.denominador + r;

              const enBase = colGlobal < numBase;
              const enCorte = rowGlobal < numCorte;
              const esInterseccion = enBase && enCorte;

              if (esInterseccion) {
                celda.style.backgroundColor = CFG.colorAreaInterseccion;
              } else if (enBase) {
                celda.style.backgroundColor = CFG.colorAreaF1;
              }
              
              // Dibujar bordes internos pedagógicos
              if (c < base.denominador - 1) {
                const esFronteraVertical = enBase && c === numBase - 1;
                const colorVert = esFronteraVertical ? CFG.colorBordeAreaResalte : CFG.colorBordeArea;
                celda.style.borderRight = `1.5px solid ${colorVert}`;
              }
              if (r < corte.denominador - 1) {
                if (enBase) {
                  celda.style.borderBottom = `1.5px solid ${CFG.colorBordeAreaResalte}`;
                } else {
                  celda.style.borderBottom = `1.5px dotted ${CFG.colorBordeArea}`;
                }
              }

              // Contorno exterior para la base (las tiras horizontales resultantes)
              if (enBase) {
                if (c === 0) celda.style.borderLeft = `1.5px solid ${CFG.colorBordeAreaResalte}`;
                if (r === 0) celda.style.borderTop = `1.5px solid ${CFG.colorBordeAreaResalte}`;
                if (c === base.denominador - 1 && c === numBase - 1) celda.style.borderRight = `1.5px solid ${CFG.colorBordeAreaResalte}`;
                if (r === corte.denominador - 1) celda.style.borderBottom = `1.5px solid ${CFG.colorBordeAreaResalte}`;
              }

              grid.appendChild(celda);
            }
          }
          contenedor.appendChild(grid);
        }
      }
      el.appendChild(contenedor);

      const num1 = Math.abs(f1.numerador);
      const num2 = Math.abs(f2.numerador);
      const numRes = num1 * num2;
      const denRes = f1.denominador * f2.denominador;
      const eq = crear("div", "fraccion-area__etiqueta", 
        `${num1}/${f1.denominador} × ${num2}/${f2.denominador} = ${numRes}/${denRes}`
      );
      el.appendChild(eq);

    } catch (error) {
      el.appendChild(crear("div", "fraccion-rect__error", error.message));
    }
  }

  function renderAll() {
    const elementos = document.querySelectorAll(".fraccion-rect");
    elementos.forEach(renderizarElemento);

    const elementosArea = document.querySelectorAll(".fraccion-area");
    elementosArea.forEach(renderizarElementoArea);

    const elementosDivision = document.querySelectorAll(".fraccion-division");
    elementosDivision.forEach(renderizarElementoDivision);
  }

  window[MOTOR] = {
    version: VERSION,
    config: CFG,
    render: renderizarElemento,
    renderArea: renderizarElementoArea,
    renderDivision: renderizarElementoDivision,
    renderAll: renderAll,
    parsearGrid: parsearGrid,
    normalizarModoFraccion: normalizarModoFraccion,
    parsearEspecificacionFraccion: parsearEspecificacionFraccion,
    parsearProductoDesdeAtributos: parsearProductoDesdeAtributos,
    parsearDivisionDesdeAtributos: parsearDivisionDesdeAtributos,
    prepararDatosVisuales: prepararDatosVisuales,
    gcd: mcd,
    lcm: mcm,
    factorParCercano: factorParCercano
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAll);
  } else {
    renderAll();
  }
})();
