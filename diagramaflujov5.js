(function (window, document) {

  "use strict";



  const COLORES_NODO = {

    inicio: { fill: "#e6f4ea", stroke: "#2e7d32", text: "#1b1b1b" },

    fin: { fill: "#e6f4ea", stroke: "#2e7d32", text: "#1b1b1b" },

    proceso: { fill: "#e8f1ff", stroke: "#1565c0", text: "#1b1b1b" },

    decision: { fill: "#ffe8cc", stroke: "#ef6c00", text: "#1b1b1b" },

    resultado: { fill: "#f3e8ff", stroke: "#7b1fa2", text: "#1b1b1b" },

    referencia: { fill: "#fff8cc", stroke: "#f9a825", text: "#1b1b1b" },

    nota: { fill: "#f1f3f5", stroke: "#6c757d", text: "#1b1b1b" },

    error: { fill: "#fde7e9", stroke: "#c62828", text: "#1b1b1b" }

  };



  const COLORES_CONEXION = {

    flujo: "#666",

    decision: "#ef6c00",

    caso: "#7b1fa2",

    anotacion: "#888",

    retorno: "#c62828",

    referencia: "#f9a825"

  };



  const SVG_NS = "http://www.w3.org/2000/svg";



const CONFIG_DEFAULT = {
  anchoNodo: 210,
  altoNodo: 72,
  anchoDecision: 220,
  altoDecision: 100,
  anchoNota: 180,
  altoNota: 60,

  separacionVertical: 120,
  separacionHorizontal: 90,
  margenX: 40,
  margenY: 40,

  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: 15,
  strokeWidth: 2,

  radio: 16,
  radioNodo: 8,

  // Laterales
  lateralCodo: 28,
  lateralGap: 42,
  lateralSeparacionVertical: 14,
  lateralBusquedaIntentos: 24,
  lateralMargenSolapeEstructura: 12,
  lateralMargenSolapeLaterales: 8,

  // Conexiones
  conexionOffset: 20,
  retornoCurvaExtraX: 50,
  colectorSeparacionMin: 28,
  colectorFactorVertical: 0.25,
  colectorAjusteSalidaY: 10,
  romboDiagonalSalida: 25,
  conexionSeparacionMin: 3,
  conexionZonaLibreFlecha: 20,
  conexionRutaIntentos: 20,
  conexionPasoAlternativo: 10,
  conexionMargenNodo: 4,


  // Ajustes de layout
  ajustarNodoFinalAbajo: true,
distanciaExtraNodoFinal: 20,
centrarNodoFinal: true,

  // Etiquetas
  etiquetaMinWidth: 30,
  etiquetaCharWidth: 8,
  etiquetaPaddingX: 12,
  etiquetaHeight: 22,
  etiquetaRadius: 6,
  etiquetaOffsetY: 8,
  etiquetaFontDelta: 2,
  etiquetaTextBaselineAdjust: 4,
  etiquetaOpacity: 0.92,

  // Marcadores
  markerRefX: 9,
  markerRefY: 5,
  markerWidth: 7,
  markerHeight: 7,

  // Texto
  maxCharsDecision: 18,
  maxCharsNodo: 24
};



  function crearSVG(tag, attrs) {

    const el = document.createElementNS(SVG_NS, tag);

    if (attrs) {

      Object.keys(attrs).forEach(function (k) {

        if (attrs[k] !== "" && attrs[k] != null) el.setAttribute(k, attrs[k]);

      });

    }

    return el;

  }



  function esTipoLateral(tipo) {

    return tipo === "nota" || tipo === "error" || tipo === "referencia";

  }



  function obtenerTamanoNodoPorTipo(tipo, cfg) {

    if (tipo === "decision") {

      return { width: cfg.anchoDecision, height: cfg.altoDecision };

    }

    if (esTipoLateral(tipo)) {

      return { width: cfg.anchoNota, height: cfg.altoNota };

    }

    return { width: cfg.anchoNodo, height: cfg.altoNodo };

  }



  function medirLineasTexto(texto, maxCharsPorLinea) {

    const limpio = String(texto || "").replace(/\s+/g, " ").trim();

    if (!limpio) return [""];

    const palabras = limpio.split(" ");

    const lineas = [];

    let actual = "";



    palabras.forEach(function (palabra) {

      const candidata = actual ? actual + " " + palabra : palabra;

      if (candidata.length <= maxCharsPorLinea) {

        actual = candidata;

      } else {

        if (actual) lineas.push(actual);

        actual = palabra;

      }

    });



    if (actual) lineas.push(actual);

    return lineas;

  }



  class FlujoNodo {

    constructor(data, config) {

      this.id = data.id;

      this.tipo = data.tipo;

      this.texto = data.texto || "";

      this.meta = data.meta || {};

      this.config = config;

      const t = obtenerTamanoNodoPorTipo(this.tipo, config);

      this.ancho = data.ancho || t.width;

      this.alto = data.alto || t.height;

      this.x = 0;

      this.y = 0;

      this.salidas = [];

      this.entradas = [];

      this.subtreeWidth = this.ancho;

      this.subtreeHeight = this.alto;

    }



    esLateral() {

      return esTipoLateral(this.tipo);

    }



    getCaja() {

      return {

        x: this.x,

        y: this.y,

        width: this.ancho,

        height: this.alto

      };

    }

  }



  class FlujoConexion {

    constructor(data) {

      this.desde = data.desde;

      this.hacia = data.hacia;

      this.semantica = data.semantica || "flujo";

      this.etiqueta = data.etiqueta || "";

      this.estilo = data.estilo || "solida";

      this.meta = data.meta || {};

    }



    esAnotacion() {

      return this.semantica === "anotacion";

    }



    esReferencia() {

      return this.semantica === "referencia";

    }



    esCaso() {

      return this.semantica === "caso";

    }



    esFlujo() {

      return this.semantica === "flujo";

    }

  }



  class FlujoDiagrama {

    constructor(data, config) {

      this.titulo = data.titulo || "";

      this.config = config;

      this.nodos = new Map();

      this.conexiones = [];

      this.raiz = null;



      (data.nodos || []).forEach(n => {

        this.nodos.set(n.id, new FlujoNodo(n, config));

      });



      (data.conexiones || []).forEach(c => {

        this.conexiones.push(new FlujoConexion(c));

      });



      this.construirRelaciones();

      this.resolverRaiz();

    }



    static desdeJSON(data, config) {

      return new FlujoDiagrama(data, config);

    }



    getNodo(id) {

      return this.nodos.get(id) || null;

    }



    getConexionesDesde(id) {

      return this.conexiones.filter(c => c.desde === id);

    }



    getConexionesHacia(id) {

      return this.conexiones.filter(c => c.hacia === id);

    }



    construirRelaciones() {

      this.conexiones.forEach(c => {

        const desde = this.getNodo(c.desde);

        const hacia = this.getNodo(c.hacia);

        if (desde) desde.salidas.push(c);

        if (hacia) hacia.entradas.push(c);

      });

    }



    resolverRaiz() {

      for (const nodo of this.nodos.values()) {

        if (nodo.tipo === "inicio") {

          this.raiz = nodo;

          return;

        }

      }

      for (const nodo of this.nodos.values()) {

        if (!nodo.esLateral() && nodo.entradas.length === 0) {

          this.raiz = nodo;

          return;

        }

      }

    }

  }



  // --- NUEVA CLASE LAYOUT (Reemplaza a la anterior) ---

class FlujoLayout {
  constructor(diagrama) {
    this.diagrama = diagrama;
    this.cfg = diagrama.config;
    this.posiciones = new Map();
    this.hijosLayout = new Map();
  }

  construirArbolLayout() {
    const visitados = new Set();
    const cola = [];

    if (this.diagrama.raiz) {
      cola.push(this.diagrama.raiz.id);
      visitados.add(this.diagrama.raiz.id);
    }

    while (cola.length > 0) {
      const actualId = cola.shift();
      const nodo = this.diagrama.getNodo(actualId);
      if (!nodo) continue;

      const hijosValidos = [];

      const salidas = nodo.salidas.filter(c => !c.esAnotacion() && !c.esReferencia());

      salidas.forEach(c => {
        const destino = this.diagrama.getNodo(c.hacia);
        if (destino && !destino.esLateral() && !visitados.has(destino.id)) {
          visitados.add(destino.id);
          hijosValidos.push(destino);
          cola.push(destino.id);
        }
      });

      this.hijosLayout.set(actualId, hijosValidos);
    }
  }

  lateralesAsociados(nodo) {
    if (!nodo) return [];

    return nodo.entradas
      .filter(c => c.esAnotacion() || c.esReferencia())
      .map(c => this.diagrama.getNodo(c.desde))
      .filter(n => n && n.esLateral());
  }

  anchoLateralAsociado(nodo) {
    if (!nodo) return 0;

    const laterales = this.lateralesAsociados(nodo);
    if (laterales.length === 0) return 0;

    const maxAnchoLateral = Math.max.apply(null, laterales.map(n => n.ancho));
    return this.cfg.lateralCodo + this.cfg.lateralGap + maxAnchoLateral;
  }

medir(nodo, visitando = new Set()) {
  if (!nodo) return;

  if (visitando.has(nodo.id)) {
    console.warn("flujomate: ciclo detectado en medir() en nodo", nodo.id);
    nodo.subtreeWidth = nodo.ancho;
    nodo.subtreeHeight = nodo.alto;
    return;
  }

  if (nodo._medido) return;

  visitando.add(nodo.id);

  const hijos = this.hijosLayout.get(nodo.id) || [];
  const extraLateral = this.anchoLateralAsociado(nodo);

  if (hijos.length === 0) {
    nodo.subtreeWidth = nodo.ancho + extraLateral;
    nodo.subtreeHeight = nodo.alto;
    nodo._medido = true;
    visitando.delete(nodo.id);
    return;
  }

  hijos.forEach(h => this.medir(h, visitando));

  const conexionesLayout = nodo.salidas.filter(c => hijos.some(h => h.id === c.hacia));

  if (conexionesLayout.length > 1 && conexionesLayout.every(c => c.esCaso())) {
    const totalWidth =
      hijos.reduce((acc, h) => acc + h.subtreeWidth, 0) +
      this.cfg.separacionHorizontal * (hijos.length - 1);

    const maxHeight = Math.max.apply(null, hijos.map(h => h.subtreeHeight));

    nodo.subtreeWidth = Math.max(nodo.ancho + extraLateral, totalWidth);
    nodo.subtreeHeight = nodo.alto + this.cfg.separacionVertical + maxHeight;
    nodo._medido = true;
    visitando.delete(nodo.id);
    return;
  }

  const hijo = hijos[0];
  nodo.subtreeWidth = Math.max(nodo.ancho + extraLateral, hijo.subtreeWidth);
  nodo.subtreeHeight = nodo.alto + this.cfg.separacionVertical + hijo.subtreeHeight;

  nodo._medido = true;
  visitando.delete(nodo.id);
}

ubicar(nodo, centroX, y, visitando = new Set()) {
  if (!nodo) return;

  if (visitando.has(nodo.id)) {
    console.warn("flujomate: ciclo detectado en ubicar() en nodo", nodo.id);
    return;
  }

  visitando.add(nodo.id);

  const extraLateral = this.anchoLateralAsociado(nodo);
  const anchoReservadoNodo = nodo.ancho + extraLateral;

  nodo.x = centroX - anchoReservadoNodo / 2;
  nodo.y = y;

  this.posiciones.set(nodo.id, {
    x: nodo.x,
    y: nodo.y,
    width: nodo.ancho,
    height: nodo.alto
  });

  const hijos = this.hijosLayout.get(nodo.id) || [];
  if (hijos.length === 0) {
    visitando.delete(nodo.id);
    return;
  }

  const yHijos = y + nodo.alto + this.cfg.separacionVertical;
  const conexionesLayout = nodo.salidas.filter(c => hijos.some(h => h.id === c.hacia));

  if (conexionesLayout.length > 1 && conexionesLayout.every(c => c.esCaso())) {
    const totalWidth =
      hijos.reduce((acc, h) => acc + h.subtreeWidth, 0) +
      this.cfg.separacionHorizontal * (hijos.length - 1);

    let cursorLeft = centroX - totalWidth / 2;
    const hijosUbicados = [];

    hijos.forEach(h => {
      const centroHijo = cursorLeft + h.subtreeWidth / 2;
      this.ubicar(h, centroHijo, yHijos, visitando);
      hijosUbicados.push(h);
      cursorLeft += h.subtreeWidth + this.cfg.separacionHorizontal;
    });

    let minX = Infinity;
    let maxX = -Infinity;

    hijosUbicados.forEach(h => {
      const pos = this.posiciones.get(h.id);
      if (!pos) return;
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + h.subtreeWidth);
    });

    if (isFinite(minX) && isFinite(maxX)) {
      const centroReal = (minX + maxX) / 2;

      nodo.x = centroReal - anchoReservadoNodo / 2;

      this.posiciones.set(nodo.id, {
        x: nodo.x,
        y: nodo.y,
        width: nodo.ancho,
        height: nodo.alto
      });
    }

    visitando.delete(nodo.id);
    return;
  }

  this.ubicar(hijos[0], centroX, yHijos, visitando);

  visitando.delete(nodo.id);
}

ubicarLaterales() {
  const grupos = new Map();

  // 1) Agrupar laterales por nodo asociado
  this.diagrama.conexiones.forEach(c => {
    if (!(c.esAnotacion() || c.esReferencia())) return;

    const lateral = this.diagrama.getNodo(c.desde);
    const asociado = this.diagrama.getNodo(c.hacia);

    if (!lateral || !asociado) return;
    if (!lateral.esLateral()) return;

    if (!grupos.has(asociado.id)) {
      grupos.set(asociado.id, []);
    }

    grupos.get(asociado.id).push({
      conexion: c,
      lateral: lateral,
      asociado: asociado
    });
  });

  // 2) Ubicar cada grupo
  grupos.forEach(items => {
    if (!items || items.length === 0) return;

    const asociado = items[0].asociado;
    const posAsociado = this.posiciones.get(asociado.id);
    if (!posAsociado) return;

    const separacion = this.cfg.lateralSeparacionVertical || 14;

    // Orden estable
    items.sort((a, b) => {
      const pa = a.conexion.esReferencia() ? 0 : 1;
      const pb = b.conexion.esReferencia() ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(a.lateral.id).localeCompare(String(b.lateral.id));
    });

    const altoTotal = items.reduce((acc, item, idx) => {
      return acc + item.lateral.alto + (idx > 0 ? separacion : 0);
    }, 0);

    const yCentroGrupoIdeal =
      posAsociado.y + posAsociado.height / 2 - altoTotal / 2;

    // Posiciones base
    const xDerecha =
      posAsociado.x +
      asociado.ancho +
      this.cfg.lateralCodo +
      this.cfg.lateralGap;


    const maxAnchoLateral = Math.max.apply(
       null,
       items.map(item => item.lateral.ancho)
    );

   const xIzquierda =
  posAsociado.x -
  this.cfg.lateralCodo -
  this.cfg.lateralGap -
  maxAnchoLateral;

    const idsGrupo = items.map(item => item.lateral.id);

    let cursorY = yCentroGrupoIdeal;

    items.forEach((item, idx) => {
      const lateral = item.lateral;
      const yIdeal = cursorY;

      const excluirIds = idsGrupo.slice(idx + 1);

      // --- Intento 1: DERECHA ---
      let yLibre = this.buscarYLibreParaLateral(
        xDerecha,
        yIdeal,
        lateral.ancho,
        lateral.alto,
        excluirIds
      );

      const rectDerecha = {
        x: xDerecha,
        y: yLibre,
        width: lateral.ancho,
        height: lateral.alto
      };

      const chocaDerecha =
        this.haySolapeConEstructura(rectDerecha, excluirIds) ||
        this.haySolapeConLaterales(rectDerecha, excluirIds);

      let xFinal = xDerecha;
      let yFinal = yLibre;

      // --- Intento 2: IZQUIERDA ---
      if (chocaDerecha) {
        const yIzq = this.buscarYLibreParaLateral(
          xIzquierda,
          yIdeal,
          lateral.ancho,
          lateral.alto,
          excluirIds
        );

        const rectIzquierda = {
          x: xIzquierda,
          y: yIzq,
          width: lateral.ancho,
          height: lateral.alto
        };

        const chocaIzquierda =
          this.haySolapeConEstructura(rectIzquierda, excluirIds) ||
          this.haySolapeConLaterales(rectIzquierda, excluirIds);

        if (!chocaIzquierda) {
          xFinal = xIzquierda;
          yFinal = yIzq;
        } else {
          // --- Fallback: derecha forzada ---
          xFinal = xDerecha;
          yFinal = yIdeal;
        }
      }

      this.posiciones.set(lateral.id, {
        x: xFinal,
        y: yFinal,
        width: lateral.ancho,
        height: lateral.alto
      });

      cursorY += lateral.alto + separacion;
    });
  });

  // 3) Sincronizar nodos
  this.diagrama.nodos.forEach(nodo => {
    const pos = this.posiciones.get(nodo.id);
    if (!pos) return;
    if (!nodo.esLateral()) return;

    nodo.x = pos.x;
    nodo.y = pos.y;
  });
}


ajustarNodoFinal() {
  if (!this.cfg.ajustarNodoFinalAbajo) return;

  const nodosFin = Array.from(this.diagrama.nodos.values()).filter(n => n.tipo === "fin");
  if (nodosFin.length === 0) return;

  let fondoMaximo = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;

  // 1) Calcular fondo y ancho del diagrama (sin contar el fin)
  this.posiciones.forEach((pos, id) => {
    const nodo = this.diagrama.getNodo(id);
    if (!nodo) return;
    if (nodo.tipo === "fin") return;

    fondoMaximo = Math.max(fondoMaximo, pos.y + pos.height);
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + pos.width);
  });

  if (!isFinite(fondoMaximo)) return;

  const nuevaYBase = fondoMaximo + this.cfg.distanciaExtraNodoFinal;

  // Centro horizontal del diagrama
  const centroGlobal =
    isFinite(minX) && isFinite(maxX)
      ? (minX + maxX) / 2
      : null;

  // 2) Aplicar ajustes al nodo fin
  nodosFin.forEach(nodo => {
    const pos = this.posiciones.get(nodo.id);
    if (!pos) return;

    // Bajar
    if (pos.y < nuevaYBase) {
      pos.y = nuevaYBase;
      nodo.y = pos.y;
    }

    // Centrar (solo si está activado)
    if (this.cfg.centrarNodoFinal && centroGlobal != null) {
      pos.x = centroGlobal - pos.width / 2;
      nodo.x = pos.x;
    }
  });
}


calcularDimensiones() {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  this.posiciones.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  });

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return {
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0
    };
  }

  const width = (maxX - minX) + 2 * this.cfg.margenX;
  const height = (maxY - minY) + 2 * this.cfg.margenY;

  return {
    width: width,
    height: height,
    offsetX: this.cfg.margenX - minX,
    offsetY: this.cfg.margenY - minY
  };
}

  centrarGlobal() {
    let minX = Infinity;
    let maxX = -Infinity;

    this.posiciones.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + pos.width);
    });

    if (!isFinite(minX) || !isFinite(maxX)) return;

    const centroActual = (minX + maxX) / 2;
    const centroDeseado = this.cfg.margenX + (maxX - minX) / 2;
    const delta = centroDeseado - centroActual;

    this.posiciones.forEach(pos => {
      pos.x += delta;
    });

    this.diagrama.nodos.forEach(nodo => {
      const pos = this.posiciones.get(nodo.id);
      if (!pos) return;
      nodo.x = pos.x;
      nodo.y = pos.y;
    });
  }


calcular() {
  if (!this.diagrama.raiz) {
    return { posiciones: this.posiciones, width: 0, height: 0 };
  }

  this.construirArbolLayout();

  this.diagrama.nodos.forEach(n => {
    n._medido = false;
  });

  this.medir(this.diagrama.raiz);

  const centroInicial = this.cfg.margenX + this.diagrama.raiz.subtreeWidth / 2;


this.ubicar(this.diagrama.raiz, centroInicial, this.cfg.margenY);
this.ubicarLaterales();
this.ajustarNodoFinal();

const dims = this.calcularDimensiones();







  this.posiciones.forEach(pos => {
    pos.x += dims.offsetX;
    pos.y += dims.offsetY;
  });

  this.diagrama.nodos.forEach(nodo => {
    const pos = this.posiciones.get(nodo.id);
    if (!pos) return;
    nodo.x = pos.x;
    nodo.y = pos.y;
  });

  return {
    posiciones: this.posiciones,
    width: dims.width,
    height: dims.height
  };
}





haySolape(rectA, rectB, margen = 10) {
  if (!rectA || !rectB) return false;

  return !(
    rectA.x + rectA.width + margen <= rectB.x ||
    rectB.x + rectB.width + margen <= rectA.x ||
    rectA.y + rectA.height + margen <= rectB.y ||
    rectB.y + rectB.height + margen <= rectA.y
  );
}

haySolapeConEstructura(rect, excluirIds = []) {
  const excluidos = new Set(excluirIds);

  for (const [id, pos] of this.posiciones.entries()) {
    if (excluidos.has(id)) continue;

    const nodo = this.diagrama.getNodo(id);
    if (!nodo) continue;

    if (nodo.esLateral()) continue;

    if (this.haySolape(rect, pos, this.cfg.lateralMargenSolapeEstructura)) {
      return true;
    }
  }

  return false;
}



haySolapeConLaterales(rect, excluirIds = []) {
  const excluidos = new Set(excluirIds);

  for (const [id, pos] of this.posiciones.entries()) {
    if (excluidos.has(id)) continue;

    const nodo = this.diagrama.getNodo(id);
    if (!nodo) continue;
    if (!nodo.esLateral()) continue;

    if (this.haySolape(rect, pos, this.cfg.lateralMargenSolapeLaterales)) {
      return true;
    }
  }

  return false;
}




buscarYLibreParaLateral(x, yBase, ancho, alto, excluirIds = []) {
  const candidatos = [];
  const paso = this.cfg.lateralSeparacionVertical;
  const maxIntentos = this.cfg.lateralBusquedaIntentos;

  candidatos.push(yBase);

  for (let i = 1; i <= maxIntentos; i++) {
    candidatos.push(yBase + i * paso);
    candidatos.push(yBase - i * paso);
  }

  for (const y of candidatos) {
    const rect = { x, y, width: ancho, height: alto };

    if (y < this.cfg.margenY) continue;

    const chocaEstructura = this.haySolapeConEstructura(rect, excluirIds);
    const chocaLaterales = this.haySolapeConLaterales(rect, excluirIds);

    if (!chocaEstructura && !chocaLaterales) {
      return y;
    }
  }

  console.warn("flujomate: no se encontró posición libre para lateral", {
    x,
    yBase,
    ancho,
    alto,
    excluirIds
  });

  return yBase;
}














}

  // --- FIN DE LA NUEVA CLASE LAYOUT ---



function definirMarcadores(svg, cfg) {
  const defs = crearSVG("defs");

  Object.entries(COLORES_CONEXION).forEach(([semantica, color]) => {
    const marker = crearSVG("marker", {
      id: "flujomate-arrow-" + semantica,
      viewBox: "0 0 10 10",
      refX: String(cfg.markerRefX),
      refY: String(cfg.markerRefY),
      markerWidth: String(cfg.markerWidth),
      markerHeight: String(cfg.markerHeight),
      orient: "auto-start-reverse"
    });

    marker.appendChild(crearSVG("path", {
      d: "M 0 0 L 10 5 L 0 10 z",
      fill: color
    }));

    defs.appendChild(marker);
  });

  svg.appendChild(defs);
}



function markerPorColor(color) {
  const entrada = Object.entries(COLORES_CONEXION).find(([, value]) => value === color);
  const semantica = entrada ? entrada[0] : "flujo";
  return "url(#flujomate-arrow-" + semantica + ")";
}




function puntoBordeRombo(pos, haciaX, haciaY) {
  const cx = pos.x + pos.width / 2;
  const cy = pos.y + pos.height / 2;

  const dx = haciaX - cx;
  const dy = haciaY - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const rx = pos.width / 2;
  const ry = pos.height / 2;

  const denom = Math.abs(dx) / rx + Math.abs(dy) / ry;
  const t = denom === 0 ? 0 : 1 / denom;

  return {
    x: cx + dx * t,
    y: cy + dy * t
  };
}







function puntoSalida(pos, nodo, posDestino, conexion) {
  const semantica = conexion?.semantica || "flujo";

  if (semantica === "anotacion" || semantica === "referencia") {
    const cxDestino = posDestino.x + posDestino.width / 2;
    const cxOrigen = pos.x + pos.width / 2;

    return {
      x: cxDestino < cxOrigen ? pos.x : pos.x + pos.width,
      y: pos.y + pos.height / 2
    };
  }

  const cxDestino = posDestino.x + posDestino.width / 2;
  const cyDestino = posDestino.y + posDestino.height / 2;

  if (nodo?.tipo === "decision") {
    return puntoBordeRombo(pos, cxDestino, cyDestino);
  }

  const cx = pos.x + pos.width / 2;
  const cy = pos.y + pos.height / 2;
  const dx = cxDestino - cx;
  const dy = cyDestino - cy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: dx > 0 ? pos.x + pos.width : pos.x,
      y: cy
    };
  }

  return {
    x: cx,
    y: dy > 0 ? pos.y + pos.height : pos.y
  };
}







function puntoEntrada(pos, nodo, posOrigen, conexion) {
  const semantica = conexion?.semantica || "flujo";

  if (semantica === "anotacion" || semantica === "referencia") {
    const cxOrigen = posOrigen.x + posOrigen.width / 2;
    const cxDestino = pos.x + pos.width / 2;

    return {
      x: cxOrigen < cxDestino ? pos.x : pos.x + pos.width,
      y: pos.y + pos.height / 2
    };
  }

  const cxOrigen = posOrigen.x + posOrigen.width / 2;
  const cyOrigen = posOrigen.y + posOrigen.height / 2;

  if (nodo?.tipo === "decision") {
    return puntoBordeRombo(pos, cxOrigen, cyOrigen);
  }

  const cx = pos.x + pos.width / 2;
  const cy = pos.y + pos.height / 2;
  const dx = cxOrigen - cx;
  const dy = cyOrigen - cy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: dx > 0 ? pos.x + pos.width : pos.x,
      y: cy
    };
  }

  return {
    x: cx,
    y: dy > 0 ? pos.y + pos.height : pos.y
  };
}


function escapeDiagonalRombo(punto, posOtroNodo, cfg, esSalida = true) {
  const d = cfg.romboDiagonalSalida || 10;

  const cxOtro = posOtroNodo.x + posOtroNodo.width / 2;
  const cyOtro = posOtroNodo.y + posOtroNodo.height / 2;

  const dx = cxOtro - punto.x;
  const dy = cyOtro - punto.y;

  let ex = punto.x;
  let ey = punto.y;

  // Elegimos una pequeña diagonal en la dirección general del otro nodo.
  // No queremos una diagonal enorme, solo un "despegue" visual del rombo.
  if (Math.abs(dx) > Math.abs(dy)) {
    ex += dx >= 0 ? d : -d;
    ey += dy >= 0 ? d * 0.5 : -d * 0.5;
  } else {
    ex += dx >= 0 ? d * 0.5 : -d * 0.5;
    ey += dy >= 0 ? d : -d;
  }

  return { x: ex, y: ey };
}


function clonarPunto(p) {
  return { x: p.x, y: p.y };
}

function segmentosDeRuta(puntos) {
  const segs = [];
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i];
    const b = puntos[i + 1];
    if (a.x === b.x && a.y === b.y) continue;
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  return segs;
}

function esVertical(seg) {
  return seg.x1 === seg.x2;
}

function esHorizontal(seg) {
  return seg.y1 === seg.y2;
}

function recortarSegmentoFinal(seg, recorte) {
  if (recorte <= 0) return seg;

  if (esVertical(seg)) {
    const dir = seg.y2 >= seg.y1 ? 1 : -1;
    const largo = Math.abs(seg.y2 - seg.y1);
    if (largo <= recorte) return null;
    return {
      x1: seg.x1,
      y1: seg.y1,
      x2: seg.x2,
      y2: seg.y2 - dir * recorte
    };
  }

  if (esHorizontal(seg)) {
    const dir = seg.x2 >= seg.x1 ? 1 : -1;
    const largo = Math.abs(seg.x2 - seg.x1);
    if (largo <= recorte) return null;
    return {
      x1: seg.x1,
      y1: seg.y1,
      x2: seg.x2 - dir * recorte,
      y2: seg.y2
    };
  }

  return seg;
}

function rangosSeSolapan(a1, a2, b1, b2, margen = 0) {
  const minA = Math.min(a1, a2);
  const maxA = Math.max(a1, a2);
  const minB = Math.min(b1, b2);
  const maxB = Math.max(b1, b2);
  return !(maxA + margen < minB || maxB + margen < minA);
}

function segmentosSeSolapan(segA, segB, tolerancia = 3) {
  if (esVertical(segA) && esVertical(segB)) {
    if (Math.abs(segA.x1 - segB.x1) > tolerancia) return false;
    return rangosSeSolapan(segA.y1, segA.y2, segB.y1, segB.y2, tolerancia);
  }

  if (esHorizontal(segA) && esHorizontal(segB)) {
    if (Math.abs(segA.y1 - segB.y1) > tolerancia) return false;
    return rangosSeSolapan(segA.x1, segA.x2, segB.x1, segB.x2, tolerancia);
  }

  // Cruce perpendicular: no lo consideramos "solape"
  return false;
}

function segmentoChocaRect(seg, rect, padding = 0) {
  const rx1 = rect.x - padding;
  const ry1 = rect.y - padding;
  const rx2 = rect.x + rect.width + padding;
  const ry2 = rect.y + rect.height + padding;

  if (esVertical(seg)) {
    const x = seg.x1;
    if (x < rx1 || x > rx2) return false;
    return rangosSeSolapan(seg.y1, seg.y2, ry1, ry2, 0);
  }

  if (esHorizontal(seg)) {
    const y = seg.y1;
    if (y < ry1 || y > ry2) return false;
    return rangosSeSolapan(seg.x1, seg.x2, rx1, rx2, 0);
  }

  return false;
}

function rutaChocaConNodos(segmentos, layout, conexion, cfg) {
  const excluir = new Set([conexion.desde, conexion.hacia]);

  for (const seg of segmentos) {
    for (const [id, rect] of layout.posiciones.entries()) {
      if (excluir.has(id)) continue;
      if (segmentoChocaRect(seg, rect, cfg.conexionMargenNodo)) {
        return true;
      }
    }
  }

  return false;
}

function rutaChocaConOtras(segmentos, rutasOcupadas, cfg) {
  if (!rutasOcupadas || rutasOcupadas.length === 0) return false;

  const segsPropios = segmentos.slice();
  if (segsPropios.length > 0) {
    const ultimo = recortarSegmentoFinal(
      segsPropios[segsPropios.length - 1],
      cfg.conexionZonaLibreFlecha
    );

    if (ultimo) {
      segsPropios[segsPropios.length - 1] = ultimo;
    } else {
      segsPropios.pop();
    }
  }

  for (const ruta of rutasOcupadas) {
    for (const segA of segsPropios) {
      for (const segB of ruta.segmentos) {
        if (segmentosSeSolapan(segA, segB, cfg.conexionSeparacionMin)) {
          return true;
        }
      }
    }
  }

  return false;
}

function registrarRutaOcupada(segmentos, rutasOcupadas, cfg) {
  if (!rutasOcupadas) return;

  const segs = segmentos.slice();
  if (segs.length > 0) {
    const ultimo = recortarSegmentoFinal(
      segs[segs.length - 1],
      cfg.conexionZonaLibreFlecha
    );

    if (ultimo) {
      segs[segs.length - 1] = ultimo;
    } else {
      segs.pop();
    }
  }

  rutasOcupadas.push({ segmentos: segs });
}

function rutaAPath(puntos) {
  if (!puntos || puntos.length === 0) return "";
  let d = "M " + puntos[0].x + " " + puntos[0].y;
  for (let i = 1; i < puntos.length; i++) {
    d += " L " + puntos[i].x + " " + puntos[i].y;
  }
  return d;
}

function construirRutaOrtogonal(a, b, offsetY) {
  return [
    clonarPunto(a),
    { x: a.x, y: offsetY },
    { x: b.x, y: offsetY },
    clonarPunto(b)
  ];
}

function construirRutaHorizontalVertical(a, b, offsetX) {
  return [
    clonarPunto(a),
    { x: offsetX, y: a.y },
    { x: offsetX, y: b.y },
    clonarPunto(b)
  ];
}


function construirRuta4TramosHVH(a, b, x1, yMid) {
  return [
    clonarPunto(a),
    { x: x1, y: a.y },
    { x: x1, y: yMid },
    { x: b.x, y: yMid },
    clonarPunto(b)
  ];
}

function construirRuta4TramosVHV(a, b, y1, xMid) {
  return [
    clonarPunto(a),
    { x: a.x, y: y1 },
    { x: xMid, y: y1 },
    { x: xMid, y: b.y },
    clonarPunto(b)
  ];
}

function construirRuta5TramosHVHV(a, b, x1, y1, x2) {
  return [
    clonarPunto(a),
    { x: x1, y: a.y },
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: b.y },
    clonarPunto(b)
  ];
}

function construirRuta5TramosVHVH(a, b, y1, x1, y2) {
  return [
    clonarPunto(a),
    { x: a.x, y: y1 },
    { x: x1, y: y1 },
    { x: x1, y: y2 },
    { x: b.x, y: y2 },
    clonarPunto(b)
  ];
}



function generarCandidatos3Tramos(a, b, cfg) {
  const candidatos = [];

  const baseY = a.y + (b.y >= a.y ? cfg.conexionOffset : -cfg.conexionOffset);
  const baseX = a.x + (b.x >= a.x ? cfg.conexionOffset : -cfg.conexionOffset);

  candidatos.push(construirRutaOrtogonal(a, b, baseY));
  candidatos.push(construirRutaHorizontalVertical(a, b, baseX));

  for (let i = 1; i <= cfg.conexionRutaIntentos; i++) {
    const paso = cfg.conexionPasoAlternativo * i;

    candidatos.push(construirRutaOrtogonal(a, b, baseY + paso));
    candidatos.push(construirRutaOrtogonal(a, b, baseY - paso));
    candidatos.push(construirRutaHorizontalVertical(a, b, baseX + paso));
    candidatos.push(construirRutaHorizontalVertical(a, b, baseX - paso));
  }

  return candidatos;
}

function generarCandidatos4Tramos(a, b, cfg) {
  const candidatos = [];

  for (let i = 1; i <= cfg.conexionRutaIntentos; i++) {
    const paso = cfg.conexionPasoAlternativo * i;

    const x1a = a.x + paso;
    const x1b = a.x - paso;
    const y1a = a.y + paso;
    const y1b = a.y - paso;

    const yMid1 = b.y - paso;
    const yMid2 = b.y + paso;
    const xMid1 = b.x - paso;
    const xMid2 = b.x + paso;

    candidatos.push(construirRuta4TramosHVH(a, b, x1a, yMid1));
    candidatos.push(construirRuta4TramosHVH(a, b, x1a, yMid2));
    candidatos.push(construirRuta4TramosHVH(a, b, x1b, yMid1));
    candidatos.push(construirRuta4TramosHVH(a, b, x1b, yMid2));

    candidatos.push(construirRuta4TramosVHV(a, b, y1a, xMid1));
    candidatos.push(construirRuta4TramosVHV(a, b, y1a, xMid2));
    candidatos.push(construirRuta4TramosVHV(a, b, y1b, xMid1));
    candidatos.push(construirRuta4TramosVHV(a, b, y1b, xMid2));
  }

  return candidatos;
}

function generarCandidatos5Tramos(a, b, cfg) {
  const candidatos = [];

  for (let i = 1; i <= cfg.conexionRutaIntentos; i++) {
    const paso = cfg.conexionPasoAlternativo * i;

    const x1a = a.x + paso;
    const x1b = a.x - paso;
    const x2a = b.x - paso;
    const x2b = b.x + paso;

    const y1a = a.y + paso;
    const y1b = a.y - paso;
    const y2a = b.y - paso;
    const y2b = b.y + paso;

    candidatos.push(construirRuta5TramosHVHV(a, b, x1a, y1a, x2a));
    candidatos.push(construirRuta5TramosHVHV(a, b, x1a, y1b, x2a));
    candidatos.push(construirRuta5TramosHVHV(a, b, x1b, y1a, x2b));
    candidatos.push(construirRuta5TramosHVHV(a, b, x1b, y1b, x2b));

    candidatos.push(construirRuta5TramosVHVH(a, b, y1a, x1a, y2a));
    candidatos.push(construirRuta5TramosVHVH(a, b, y1a, x1b, y2a));
    candidatos.push(construirRuta5TramosVHVH(a, b, y1b, x1a, y2b));
    candidatos.push(construirRuta5TramosVHVH(a, b, y1b, x1b, y2b));
  }

  return candidatos;
}


function medirRuta(puntos) {
  let largo = 0;
  let giros = 0;

  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i];
    const b = puntos[i + 1];
    largo += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    if (i >= 1) {
      const p = puntos[i - 1];
      const dir1 = (a.x === p.x) ? "V" : "H";
      const dir2 = (b.x === a.x) ? "V" : "H";
      if (dir1 !== dir2) giros++;
    }
  }

  return { largo, giros };
}


function mejorCandidatoValido(candidatos, a, a2, b2, b, nodoDesde, nodoHacia, layout, conexion, rutasOcupadas, cfg) {
  let mejor = null;
  let mejorScore = Infinity;

  for (const rutaCentro of candidatos) {
    const puntos = [];
    puntos.push(clonarPunto(a));
    if (nodoDesde?.tipo === "decision") puntos.push(clonarPunto(a2));
    puntos.push(...rutaCentro.slice(1, -1));
    if (nodoHacia?.tipo === "decision") puntos.push(clonarPunto(b2));
    puntos.push(clonarPunto(b));

    const rutaFinal = simplificarRuta(puntos);
    const segs = segmentosDeRuta(rutaFinal);

    const chocaNodos = rutaChocaConNodos(segs, layout, conexion, cfg);
    const chocaRutas = rutaChocaConOtras(segs, rutasOcupadas, cfg);

    if (!chocaNodos && !chocaRutas) {
      const { largo, giros } = medirRuta(rutaFinal);
      const score = largo + giros * 20; // penaliza giros

      if (score < mejorScore) {
        mejorScore = score;
        mejor = rutaFinal;
      }
    }
  }

  return mejor;
}







function simplificarRuta(puntos) {
  if (!puntos || puntos.length <= 2) return puntos || [];

  const salida = [puntos[0]];
  for (let i = 1; i < puntos.length - 1; i++) {
    const p0 = salida[salida.length - 1];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];

    const colinealVertical = p0.x === p1.x && p1.x === p2.x;
    const colinealHorizontal = p0.y === p1.y && p1.y === p2.y;

    if (colinealVertical || colinealHorizontal) continue;
    salida.push(p1);
  }
  salida.push(puntos[puntos.length - 1]);
  return salida;
}

function elegirRutaSinChoque(a, b, layout, conexion, rutasOcupadas, cfg) {
  const candidatos = [];

  const baseY = a.y + (b.y >= a.y ? cfg.conexionOffset : -cfg.conexionOffset);
  const baseX = a.x + (b.x >= a.x ? cfg.conexionOffset : -cfg.conexionOffset);

  candidatos.push(construirRutaOrtogonal(a, b, baseY));
  candidatos.push(construirRutaHorizontalVertical(a, b, baseX));

  for (let i = 1; i <= cfg.conexionRutaIntentos; i++) {
    const paso = cfg.conexionPasoAlternativo * i;

    candidatos.push(construirRutaOrtogonal(a, b, baseY + paso));
    candidatos.push(construirRutaOrtogonal(a, b, baseY - paso));
    candidatos.push(construirRutaHorizontalVertical(a, b, baseX + paso));
    candidatos.push(construirRutaHorizontalVertical(a, b, baseX - paso));
  }

  for (const ruta of candidatos) {
    const limpia = simplificarRuta(ruta);
    const segs = segmentosDeRuta(limpia);

    const chocaNodos = rutaChocaConNodos(segs, layout, conexion, cfg);
    const chocaRutas = rutaChocaConOtras(segs, rutasOcupadas, cfg);

    if (!chocaNodos && !chocaRutas) {
      return limpia;
    }
  }

  return simplificarRuta(candidatos[0]);
}



function elegirRutaCompletaSinChoque(a, a2, b2, b, nodoDesde, nodoHacia, layout, conexion, rutasOcupadas, cfg) {
  const candidatos3 = generarCandidatos3Tramos(a2, b2, cfg);
  const ruta3 = mejorCandidatoValido(
    candidatos3, a, a2, b2, b, nodoDesde, nodoHacia, layout, conexion, rutasOcupadas, cfg
  );
  if (ruta3) return ruta3;

  const candidatos4 = generarCandidatos4Tramos(a2, b2, cfg);
  const ruta4 = mejorCandidatoValido(
    candidatos4, a, a2, b2, b, nodoDesde, nodoHacia, layout, conexion, rutasOcupadas, cfg
  );
  if (ruta4) return ruta4;

  const candidatos5 = generarCandidatos5Tramos(a2, b2, cfg);
  const ruta5 = mejorCandidatoValido(
    candidatos5, a, a2, b2, b, nodoDesde, nodoHacia, layout, conexion, rutasOcupadas, cfg
  );
  if (ruta5) return ruta5;

  const fallbackCentro = simplificarRuta(candidatos3[0] || [a2, b2]);
  const fallback = [];
  fallback.push(clonarPunto(a));
  if (nodoDesde?.tipo === "decision") fallback.push(clonarPunto(a2));
  fallback.push(...fallbackCentro.slice(1, -1));
  if (nodoHacia?.tipo === "decision") fallback.push(clonarPunto(b2));
  fallback.push(clonarPunto(b));

  return simplificarRuta(fallback);
}






  function dibujarTexto(grupo, x, y, lineas, color, cfg) {

    const text = crearSVG("text", {

      x: x,

      y: y,

      "text-anchor": "middle",

      "font-family": cfg.fontFamily,

      "font-size": cfg.fontSize,

      fill: color

    });



    lineas.forEach(function (linea, idx) {

      const tspan = crearSVG("tspan", {

        x: x,

        dy: idx === 0 ? "0" : "1.25em"

      });

      tspan.textContent = linea;

      text.appendChild(tspan);

    });



    grupo.appendChild(text);

    return text;

  }



 function dibujarNodo(svg, nodo, pos, cfg) {
  const estilo = COLORES_NODO[nodo.tipo] || COLORES_NODO.proceso;

  const grupo = crearSVG("g", {
    class: "flujomate-nodo flujomate-" + nodo.tipo,
    "data-id": nodo.id
  });

  if (nodo.tipo === "decision") {
    const cx = pos.x + pos.width / 2;
    const cy = pos.y + pos.height / 2;

    const puntos = [
      [cx, pos.y],
      [pos.x + pos.width, cy],
      [cx, pos.y + pos.height],
      [pos.x, cy]
    ].map(p => p.join(",")).join(" ");

    grupo.appendChild(crearSVG("polygon", {
      points: puntos,
      fill: estilo.fill,
      stroke: estilo.stroke,
      "stroke-width": cfg.strokeWidth
    }));
  } else {
    grupo.appendChild(crearSVG("rect", {
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      rx: (nodo.tipo === "inicio" || nodo.tipo === "fin") ? cfg.radio : cfg.radioNodo,
      ry: (nodo.tipo === "inicio" || nodo.tipo === "fin") ? cfg.radio : cfg.radioNodo,
      fill: estilo.fill,
      stroke: estilo.stroke,
      "stroke-width": nodo.tipo === "resultado" ? cfg.strokeWidth + 1 : cfg.strokeWidth,
      "stroke-dasharray": nodo.tipo === "referencia" ? "6 4" : ""
    }));
  }

  const maxChars = nodo.tipo === "decision" ? cfg.maxCharsDecision : cfg.maxCharsNodo;
  const lineas = medirLineasTexto(nodo.texto, maxChars);

  const alturaTexto = (lineas.length - 1) * (cfg.fontSize * 1.25);
  const xTexto = pos.x + pos.width / 2;
  const yTexto = pos.y + pos.height / 2 - alturaTexto / 2;

  dibujarTexto(grupo, xTexto, yTexto, lineas, estilo.text, cfg);
  svg.appendChild(grupo);
}


function dibujarEtiquetaConexion(svg, x, y, texto, color, cfg) {
  if (!texto) return;

  const ancho = Math.max(
    cfg.etiquetaMinWidth,
    texto.length * cfg.etiquetaCharWidth + cfg.etiquetaPaddingX
  );

  const alto = cfg.etiquetaHeight;

  svg.appendChild(crearSVG("rect", {
    x: x - ancho / 2,
    y: y - alto / 2,
    width: ancho,
    height: alto,
    rx: cfg.etiquetaRadius,
    ry: cfg.etiquetaRadius,
    fill: "#ffffff",
    opacity: String(cfg.etiquetaOpacity)
  }));

  const label = crearSVG("text", {
    x: x,
    y: y + cfg.etiquetaTextBaselineAdjust,
    "text-anchor": "middle",
    "font-family": cfg.fontFamily,
    "font-size": Math.max(12, cfg.fontSize - cfg.etiquetaFontDelta),
    fill: color
  });

  label.textContent = texto;
  svg.appendChild(label);
}


function dibujarColectorConvergencia(svg, conexiones, layout, cfg, color) {
  if (!conexiones || conexiones.length < 2) return;

  const destinoId = conexiones[0].hacia;
  const posDestino = layout.posiciones.get(destinoId);
  if (!posDestino) return;

  const entradasValidas = conexiones
    .map(c => ({
      conexion: c,
      posDesde: layout.posiciones.get(c.desde)
    }))
    .filter(item => !!item.posDesde);

  if (entradasValidas.length < 2) return;

  const baseY = Math.min.apply(null, entradasValidas.map(item =>
    item.posDesde.y + item.posDesde.height
  ));

  const yColector = baseY + Math.max(
    cfg.colectorSeparacionMin,
    cfg.separacionVertical * cfg.colectorFactorVertical
  );

  const xs = [];

  entradasValidas.forEach(item => {
    const a = {
      x: item.posDesde.x + item.posDesde.width / 2,
      y: item.posDesde.y + item.posDesde.height - cfg.colectorAjusteSalidaY
    };

    xs.push(a.x);

    svg.appendChild(crearSVG("path", {
      d: "M " + a.x + " " + a.y + " L " + a.x + " " + (yColector - 1),
      fill: "none",
      stroke: color,
      "stroke-width": 2
    }));
  });

  const minX = Math.min.apply(null, xs);
  const maxX = Math.max.apply(null, xs);
  const centroDestino = posDestino.x + posDestino.width / 2;

  svg.appendChild(crearSVG("path", {
    d: "M " + minX + " " + yColector + " L " + maxX + " " + yColector,
    fill: "none",
    stroke: color,
    "stroke-width": 2
  }));

  svg.appendChild(crearSVG("path", {
    d: "M " + centroDestino + " " + yColector + " L " + centroDestino + " " + posDestino.y,
    fill: "none",
    stroke: color,
    "stroke-width": 2,
    "marker-end": markerPorColor(color)
  }));
}


function dibujarConexion(svg, conexion, posDesde, posHacia, cfg, layout, diagrama, colectoresDibujados, rutasOcupadas) {
  if (!svg || !conexion || !posDesde || !posHacia) return;

  const semantica = conexion.semantica || "flujo";
  const estilo = conexion.estilo || "solida";
  const etiqueta = conexion.etiqueta || "";
  const color = COLORES_CONEXION[semantica] || "#666";

  function esAnotacionLocal(c) {
    return (c.semantica || "flujo") === "anotacion";
  }

  function esReferenciaLocal(c) {
    return (c.semantica || "flujo") === "referencia";
  }

  function esFlujoLocal(c) {
    return (c.semantica || "flujo") === "flujo";
  }

  if (diagrama && semantica === "flujo" && colectoresDibujados) {
    const conexionesNormalizadas = Array.isArray(diagrama.conexiones)
      ? diagrama.conexiones
      : [];

    const entradas = conexionesNormalizadas.filter(c =>
      c.hacia === conexion.hacia && esFlujoLocal(c)
    );


/*
    if (entradas.length >= 2) {
      const clave = "colector:" + conexion.hacia;

      if (!colectoresDibujados.has(clave)) {
        dibujarColectorConvergencia(svg, entradas, layout, cfg, color);
        colectoresDibujados.add(clave);
      }

      return;
    }

*/


  }

  const nodoDesde = diagrama ? diagrama.getNodo(conexion.desde) : null;
  const nodoHacia = diagrama ? diagrama.getNodo(conexion.hacia) : null;

  const a = puntoSalida(posDesde, nodoDesde, posHacia, conexion);
  const b = puntoEntrada(posHacia, nodoHacia, posDesde, conexion);

  const a2 = nodoDesde?.tipo === "decision"
    ? escapeDiagonalRombo(a, posHacia, cfg, true)
    : a;

  const b2 = nodoHacia?.tipo === "decision"
    ? escapeDiagonalRombo(b, posDesde, cfg, false)
    : b;

  let d = "";
  let etiquetaX = (a2.x + b2.x) / 2;
  let etiquetaY = (a2.y + b2.y) / 2 - cfg.etiquetaOffsetY;

  if (semantica === "retorno") {
    const mx = Math.max(a2.x, b2.x) + cfg.retornoCurvaExtraX;

    d =
      "M " + a.x + " " + a.y +
      " L " + a2.x + " " + a2.y +
      " C " + mx + " " + a2.y +
      ", " + mx + " " + b2.y +
      ", " + b2.x + " " + b2.y +
      " L " + b.x + " " + b.y;

    etiquetaX = (a2.x + b2.x) / 2 + 20;
    etiquetaY = (a2.y + b2.y) / 2 - 10;

  } else if (esAnotacionLocal(conexion) || esReferenciaLocal(conexion)) {
    const dir = b.x >= a.x ? 1 : -1;
    const x1 = a.x + dir * cfg.lateralCodo;

    const puntos = [
      clonarPunto(a),
      { x: x1, y: a.y },
      { x: x1, y: b.y },
      clonarPunto(b)
    ];

    d = rutaAPath(puntos);
    etiquetaX = x1 + (b.x - x1) / 2;
    etiquetaY = (a.y + b.y) / 2 - cfg.etiquetaOffsetY;

    registrarRutaOcupada(segmentosDeRuta(puntos), rutasOcupadas, cfg);

  } else {
    
const rutaFinal = elegirRutaCompletaSinChoque(
  a,
  a2,
  b2,
  b,
  nodoDesde,
  nodoHacia,
  layout,
  conexion,
  rutasOcupadas,
  cfg
);

d = rutaAPath(rutaFinal);

const segs = segmentosDeRuta(rutaFinal);
registrarRutaOcupada(segs, rutasOcupadas, cfg);






    if (rutaFinal.length >= 3) {
      const mid = rutaFinal[Math.floor(rutaFinal.length / 2)];
      etiquetaX = mid.x;
      etiquetaY = mid.y - cfg.etiquetaOffsetY;
    }
  }

  svg.appendChild(crearSVG("path", {
    d: d,
    fill: "none",
    stroke: color,
    "stroke-width": 2,
    "stroke-dasharray":
      (esAnotacionLocal(conexion) ||
       esReferenciaLocal(conexion) ||
       estilo === "punteada") ? "6 4" : "",
    "marker-end": markerPorColor(color)
  }));

  if (etiqueta) {
    dibujarEtiquetaConexion(svg, etiquetaX, etiquetaY, etiqueta, color, cfg);
  }
}



function renderizarFlujoEnContenedor(contenedor, data, opciones) {
  if (!contenedor) return null;

  contenedor.innerHTML = "";

  if (!data || !Array.isArray(data.nodos)) {
    contenedor.textContent = "flujomate: data inválida o sin nodos.";
    return null;
  }

  const cfg = Object.assign({}, CONFIG_DEFAULT, opciones || {});
  const diagrama = FlujoDiagrama.desdeJSON(data, cfg);

  if (!diagrama.raiz) {
    const msg = document.createElement("pre");
    msg.textContent =
      "flujomate: no se encontró nodo raíz.\n" +
      "Revisa si existe un nodo tipo 'inicio' o al menos un nodo no lateral sin entradas.";
    contenedor.appendChild(msg);
    return null;
  }

  const layoutEngine = new FlujoLayout(diagrama);
  const layout = layoutEngine.calcular();

  if (!layout || !layout.posiciones || layout.posiciones.size === 0) {
    const msg = document.createElement("pre");
    msg.textContent =
      "flujomate: el layout no generó posiciones.\n" +
      "Raíz detectada: " + diagrama.raiz.id;
    contenedor.appendChild(msg);
    return null;
  }

  if (!(layout.width > 0) || !(layout.height > 0)) {
    const msg = document.createElement("pre");
    msg.textContent =
      "flujomate: dimensiones inválidas del SVG.\n" +
      "width=" + layout.width + ", height=" + layout.height;
    contenedor.appendChild(msg);
    return null;
  }

  if (data.titulo) {
    const titulo = document.createElement("div");
    titulo.className = "flujomate-titulo";
    titulo.textContent = data.titulo;
    titulo.style.fontFamily = cfg.fontFamily;
    titulo.style.fontSize = "20px";
    titulo.style.fontWeight = "700";
    contenedor.appendChild(titulo);
  }

  const svg = crearSVG("svg", {
    width: layout.width,
    height: layout.height,
    viewBox: "0 0 " + layout.width + " " + layout.height,
    role: "img",
    "aria-label": data.titulo || "Diagrama de flujo matemático"
  });

  const title = crearSVG("title");
  title.textContent = data.titulo || "Diagrama de flujo matemático";
  svg.appendChild(title);

  const desc = crearSVG("desc");
  desc.textContent =
    "Diagrama con " +
    diagrama.nodos.size +
    " nodos y " +
    diagrama.conexiones.length +
    " conexiones.";
  svg.appendChild(desc);

  svg.style.display = "block";
  svg.style.margin = "0 auto";
  svg.style.overflow = "visible";

  definirMarcadores(svg, cfg);




const colectoresDibujados = new Set();
const rutasOcupadas = [];

(diagrama.conexiones || []).forEach(c => {
  const desde = layout.posiciones.get(c.desde);
  const hacia = layout.posiciones.get(c.hacia);

  if (!desde || !hacia) return;

  dibujarConexion(
    svg,
    c,
    desde,
    hacia,
    cfg,
    layout,
    diagrama,
    colectoresDibujados,
    rutasOcupadas
  );
});







  diagrama.nodos.forEach(nodo => {
    const pos = layout.posiciones.get(nodo.id);
    if (!pos) return;
    dibujarNodo(svg, nodo, pos, cfg);
  });

  contenedor.appendChild(svg);

  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    window.MathJax.typesetPromise([contenedor]).catch(() => {});
  }

  return { svg: svg, layout: layout, diagrama: diagrama };
}




  function leerJSONDesdeContenedor(el) {

    const dataJson = el.getAttribute("data-json");

    if (dataJson) {

      try {

        return JSON.parse(dataJson);

      } catch (e) {

        console.error("flujomate: JSON inválido en data-json", e);

      }

    }



    const script = el.querySelector('script[type="application/json"]');

    if (script) {

      try {

        return JSON.parse(script.textContent);

      } catch (e) {

        console.error("flujomate: JSON inválido en <script>", e);

      }

    }



    return null;

  }

function convertirValorData(valor) {
  if (valor === "true") return true;
  if (valor === "false") return false;
  if (valor === "null") return null;
  if (valor === "") return "";

  const num = Number(valor);
  if (!Number.isNaN(num) && String(valor).trim() !== "") return num;

  return valor;
}

function leerOpcionesDesdeDataset(el) {
  if (!el) return {};

  const mapa = {
    ajustarNodoFinalAbajo: "ajustarNodoFinalAbajo",
    centrarNodoFinal: "centrarNodoFinal",
    distanciaExtraNodoFinal: "distanciaExtraNodoFinal",
    romboDiagonalSalida: "romboDiagonalSalida",
    conexionRutaIntentos: "conexionRutaIntentos",
    conexionPasoAlternativo: "conexionPasoAlternativo",
    conexionMargenNodo: "conexionMargenNodo",
    conexionSeparacionMin: "conexionSeparacionMin",
    conexionZonaLibreFlecha: "conexionZonaLibreFlecha",
    conexionOffset: "conexionOffset"
  };

  const opciones = {};

  Object.keys(mapa).forEach(function (claveDataset) {
    if (el.dataset[claveDataset] != null) {
      opciones[mapa[claveDataset]] = convertirValorData(el.dataset[claveDataset]);
    }
  });

  return opciones;
}

function autoRenderizar(selector, opciones) {
  const elementos = document.querySelectorAll(selector || ".flujomate");

  elementos.forEach(function (el) {
    const data = leerJSONDesdeContenedor(el);
    if (!data) return;

    const opcionesData = leerOpcionesDesdeDataset(el);
    const opcionesFinales = Object.assign({}, opciones || {}, opcionesData);

    renderizarFlujoEnContenedor(el, data, opcionesFinales);
  });
}



  window.FlujoMate = {

    render: renderizarFlujoEnContenedor,

    auto: autoRenderizar,

    coloresNodo: COLORES_NODO,

    coloresConexion: COLORES_CONEXION,

    FlujoNodo: FlujoNodo,

    FlujoConexion: FlujoConexion,

    FlujoDiagrama: FlujoDiagrama,

    FlujoLayout: FlujoLayout

  };



  document.addEventListener("DOMContentLoaded", function () {

    autoRenderizar(".flujomate");

  });



})(window, document);
