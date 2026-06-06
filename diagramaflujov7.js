/* =========================================================
   DIAGRAMAFLUJOV7 — versión unificada
   Integra:
   - Ramificación real para múltiples salidas principales
   - Lectura ampliada de opciones desde data-*
   - Layout de laterales más robusto
   - Render SVG y autorender controlado
   ========================================================= */
(function (window, document) {
  "use strict";

  const COLORES_NODO = {
    inicio: { fill: "#10281f", fill2: "#163b2d", stroke: "#27f3a2", text: "#eafff7", accent: "#50ffb8" },
    fin: { fill: "#10281f", fill2: "#163b2d", stroke: "#27f3a2", text: "#eafff7", accent: "#50ffb8" },
    proceso: { fill: "#101b35", fill2: "#162b55", stroke: "#54a8ff", text: "#eef7ff", accent: "#60d6ff" },
    decision: { fill: "#2a1d10", fill2: "#44270f", stroke: "#ff9f1c", text: "#fff4df", accent: "#ffd166" },
    resultado: { fill: "#22113d", fill2: "#32165f", stroke: "#a56cff", text: "#f5edff", accent: "#c084fc" },
    referencia: { fill: "#2b260d", fill2: "#403714", stroke: "#ffe45e", text: "#fffad7", accent: "#facc15" },
    nota: { fill: "#111827", fill2: "#1f2937", stroke: "#94a3b8", text: "#eff6ff", accent: "#cbd5e1" },
    error: { fill: "#35111d", fill2: "#571728", stroke: "#ff4d7d", text: "#fff0f4", accent: "#ff7aa2" }
  };

  const COLORES_CONEXION = {
    flujo: "#8fa3bd",
    decision: "#ff9f1c",
    caso: "#a56cff",
    anotacion: "#7dd3fc",
    retorno: "#ff4d7d",
    referencia: "#ffe45e"
  };

  const SVG_NS = "http://www.w3.org/2000/svg";
  let instanciaRender = 0;

  const CONFIG_DEFAULT = {
    anchoNodo: 210,
    altoNodo: 72,
    anchoDecision: 220,
    altoDecision: 100,
    anchoNota: 180,
    altoNota: 60,
    separacionVertical: 120,
    separacionHorizontal: 90,
    margenX: 56,
    margenY: 56,
    fontFamily: "Inter, Segoe UI, Roboto, Arial, Helvetica, sans-serif",
    fontSize: 15,
    strokeWidth: 2.25,
    radio: 22,
    radioNodo: 14,
    lateralCodo: 28,
    lateralGap: 42,
    lateralSeparacionVertical: 14,
    lateralBusquedaIntentos: 24,
    lateralMargenSolapeEstructura: 12,
    lateralMargenSolapeLaterales: 8,
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
    ajustarNodoFinalAbajo: true,
    distanciaExtraNodoFinal: 20,
    centrarNodoFinal: true,
    etiquetaMinWidth: 30,
    etiquetaCharWidth: 8,
    etiquetaPaddingX: 12,
    etiquetaHeight: 22,
    etiquetaRadius: 6,
    etiquetaOffsetY: 8,
    etiquetaFontDelta: 2,
    etiquetaTextBaselineAdjust: 4,
    etiquetaOpacity: 0.96,
    fondoDiagrama: "#1A202C",
    fondoDiagrama2: "#f7fdff",
    fondoPatron: "#38bdf8",
    fondoPatronSecundario: "#7c3aed",
    fondoPatronOpacity: 0.22,
    sombraNodos: true,
    sombraColor: "#22d3ee",
    sombraOpacity: 0.28,
    gradienteNodos: true,
    bordeSuaveNodos: true,
    bordeSuaveColor: "#bffcff",
    bordeSuaveOpacity: 0.32,
    mostrarAcentoNodos: true,
    anchoAcentoNodo: 5,
    conexionWidth: 3.2,
    conexionOpacity: 0.62,
    brilloConexiones: true,
    conexionHoverWidthExtra: 2.2,
    conexionHoverOpacity: 1,
    arrastreRutasLigeras: true,
    interactivoMover: true,
    cursorMover: "grab",
    cursorMoviendo: "grabbing",
    viewportAncho: 800,
    viewportAlto: 800,
    viewportPadding: 42,
    zoomMin: 0.35,
    zoomMax: 3,
    zoomPaso: 1.18,
    controlesZoom: true,
    tituloColor: "#eaf7ff",
    tituloSubrayado: "#38bdf8",
    etiquetaFill: "#0d1728",
    etiquetaStroke: "#6ee7ff",
    etiquetaShadow: true,
    controlFill: "rgba(8, 17, 31, 0.86)",
    controlStroke: "#38bdf8",
    controlText: "#eaf7ff",
    marcoStroke: "#8bdcf5",
    marcoShadow: "0 18px 48px rgba(14, 116, 144, 0.18), 0 0 30px rgba(56, 189, 248, 0.20)",
    markerRefX: 9,
    markerRefY: 5,
    markerWidth: 7,
    markerHeight: 7,
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
    if (tipo === "decision") return { width: cfg.anchoDecision, height: cfg.altoDecision };
    if (esTipoLateral(tipo)) return { width: cfg.anchoNota, height: cfg.altoNota };
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
      if (candidata.length <= maxCharsPorLinea) actual = candidata;
      else {
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
    esLateral() { return esTipoLateral(this.tipo); }
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
    esAnotacion() { return this.semantica === "anotacion"; }
    esReferencia() { return this.semantica === "referencia"; }
    esCaso() { return this.semantica === "caso"; }
    esFlujo() { return this.semantica === "flujo"; }
    esPrincipal() { return this.esFlujo() || this.esCaso(); }
  }

  class FlujoDiagrama {
    constructor(data, config) {
      this.titulo = data.titulo || "";
      this.config = config;
      this.nodos = new Map();
      this.conexiones = [];
      this.raiz = null;
      (data.nodos || []).forEach(n => this.nodos.set(n.id, new FlujoNodo(n, config)));
      (data.conexiones || []).forEach(c => this.conexiones.push(new FlujoConexion(c)));
      this.construirRelaciones();
      this.resolverRaiz();
    }
    static desdeJSON(data, config) { return new FlujoDiagrama(data, config); }
    getNodo(id) { return this.nodos.get(id) || null; }
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
        if (nodo.tipo === "inicio") { this.raiz = nodo; return; }
      }
      for (const nodo of this.nodos.values()) {
        if (!nodo.esLateral() && nodo.entradas.length === 0) { this.raiz = nodo; return; }
      }
    }
  }

  /*
  Reemplazo completo de la clase FlujoLayout para flujomate.

  Enfoque:
  - Detecta un tronco principal priorizando conexiones "flujo".
  - Mantiene ese tronco en una columna central.
  - Trata ramas alternativas como laterales del tronco, no como hijos simetricos.
  - Las reconvergencias reutilizan nodos ya ubicados y no ensanchan el layout.
  - Las anotaciones/referencias siguen ubicandose con el mecanismo lateral existente.

  Uso:
  - Sustituye la clase FlujoLayout original por esta version.
  - No hace falta cambiar el JSON de entrada.
*/

class FlujoLayout {
  constructor(diagrama) {
    this.diagrama = diagrama;
    this.cfg = diagrama.config;
    this.posiciones = new Map();
    this.hijosLayout = new Map();

    this.tronco = [];
    this.troncoSet = new Set();
    this.indiceTronco = new Map();
    this.rolesConexion = new Map();
    this.infoNodos = new Map();
    this.niveles = new Map();
    this.rowHeights = new Map();
    this.rowTops = new Map();

    this.maxAnchoEstructura = Math.max(
      this.cfg.anchoNodo || 0,
      this.cfg.anchoDecision || 0,
      this.cfg.anchoNota || 0
    );
  }

  getNodo(id) {
    return this.diagrama.getNodo(id);
  }

  esConexionLateral(conexion) {
    return !!conexion && (conexion.esAnotacion() || conexion.esReferencia());
  }

  esConexionEstructural(conexion) {
    return !!conexion && conexion.esPrincipal();
  }

  esNodoEstructural(nodo) {
    return !!nodo && !nodo.esLateral();
  }

  salidasEstructurales(nodo) {
    if (!nodo) return [];
    return (nodo.salidas || []).filter(conexion => {
      if (!this.esConexionEstructural(conexion)) return false;
      const destino = this.getNodo(conexion.hacia);
      return this.esNodoEstructural(destino);
    });
  }

  entradasEstructurales(nodo) {
    if (!nodo) return [];
    return (nodo.entradas || []).filter(conexion => {
      if (!this.esConexionEstructural(conexion)) return false;
      const origen = this.getNodo(conexion.desde);
      return this.esNodoEstructural(origen);
    });
  }

  puntajeSemantica(conexion) {
    if (!conexion) return 0;
    if (conexion.esFlujo()) return 180;
    if (conexion.esCaso()) return 90;
    return 10;
  }

  puntuarCaminoPrincipalDesde(nodoId, memo = new Map(), visitando = new Set()) {
    if (memo.has(nodoId)) return memo.get(nodoId);
    if (visitando.has(nodoId)) return { score: 0, length: 0 };

    const nodo = this.getNodo(nodoId);
    if (!nodo) return { score: 0, length: 0 };

    visitando.add(nodoId);

    const salidas = this.salidasEstructurales(nodo);
    if (!salidas.length) {
      const base = {
        score: nodo.tipo === "fin" ? 600 : 0,
        length: 1
      };
      memo.set(nodoId, base);
      visitando.delete(nodoId);
      return base;
    }

    let mejor = { score: nodo.tipo === "fin" ? 600 : 0, length: 1 };

    salidas.forEach(conexion => {
      const destino = this.getNodo(conexion.hacia);
      if (!destino) return;

      const futuro = this.puntuarCaminoPrincipalDesde(destino.id, memo, visitando);
      const entradasDestino = this.entradasEstructurales(destino).length;
      const estabilidad = entradasDestino <= 1 ? 24 : 8;
      const fin = destino.tipo === "fin" ? 250 : 0;
      const score =
        this.puntajeSemantica(conexion) +
        estabilidad +
        fin +
        futuro.score +
        futuro.length * 7;
      const length = futuro.length + 1;

      if (
        score > mejor.score ||
        (score === mejor.score && length > mejor.length)
      ) {
        mejor = { score, length };
      }
    });

    memo.set(nodoId, mejor);
    visitando.delete(nodoId);
    return mejor;
  }

  compararCandidatasTronco(a, b, visitados) {
    const scoreA = this.puntuarCaminoPrincipalDesde(a.destino.id);
    const scoreB = this.puntuarCaminoPrincipalDesde(b.destino.id);

    if (visitados.has(a.destino.id) && !visitados.has(b.destino.id)) return 1;
    if (!visitados.has(a.destino.id) && visitados.has(b.destino.id)) return -1;

    const semA = this.puntajeSemantica(a.conexion);
    const semB = this.puntajeSemantica(b.conexion);
    if (semA !== semB) return semB - semA;

    if (scoreA.score !== scoreB.score) return scoreB.score - scoreA.score;
    if (scoreA.length !== scoreB.length) return scoreB.length - scoreA.length;

    const entradasA = this.entradasEstructurales(a.destino).length;
    const entradasB = this.entradasEstructurales(b.destino).length;
    if (entradasA !== entradasB) return entradasA - entradasB;

    return String(a.destino.id).localeCompare(String(b.destino.id));
  }

  detectarTroncoPrincipal() {
    this.tronco = [];
    this.troncoSet = new Set();
    this.indiceTronco = new Map();

    const raiz = this.diagrama.raiz;
    if (!raiz) return;

    const visitados = new Set();
    let actual = raiz;
    let guard = 0;
    const maxPasos = this.diagrama.nodos.size + 4;

    while (actual && !visitados.has(actual.id) && guard < maxPasos) {
      this.tronco.push(actual.id);
      this.troncoSet.add(actual.id);
      this.indiceTronco.set(actual.id, this.tronco.length - 1);
      visitados.add(actual.id);

      if (actual.tipo === "fin") break;

      const candidatas = this.salidasEstructurales(actual)
        .map(conexion => ({
          conexion,
          destino: this.getNodo(conexion.hacia)
        }))
        .filter(item => item.destino && !item.destino.esLateral())
        .sort((a, b) => this.compararCandidatasTronco(a, b, visitados));

      const siguiente = candidatas.find(item => !visitados.has(item.destino.id));
      if (!siguiente) break;

      actual = siguiente.destino;
      guard++;
    }
  }

  clasificarConexiones() {
    this.rolesConexion.clear();

    this.diagrama.conexiones.forEach(conexion => {
      let rol = "secundaria";
      const desdeTronco = this.troncoSet.has(conexion.desde);
      const haciaTronco = this.troncoSet.has(conexion.hacia);

      if (conexion.esAnotacion()) rol = "anotacion";
      else if (conexion.esReferencia()) rol = "referencia";
      else if (
        desdeTronco &&
        haciaTronco &&
        this.indiceTronco.get(conexion.hacia) === this.indiceTronco.get(conexion.desde) + 1
      ) {
        rol = "tronco";
      } else if (
        haciaTronco &&
        (!desdeTronco ||
          this.indiceTronco.get(conexion.hacia) > this.indiceTronco.get(conexion.desde) + 1)
      ) {
        rol = "reconvergencia";
      } else if (conexion.esPrincipal()) {
        rol = "rama";
      }

      this.rolesConexion.set(conexion, rol);
    });
  }

  rolConexion(conexion) {
    return this.rolesConexion.get(conexion) || "secundaria";
  }

  inicializarInfoNodos() {
    this.infoNodos.clear();

    this.diagrama.nodos.forEach(nodo => {
      const infoBase = {
        id: nodo.id,
        role: nodo.esLateral() ? "lateral" : "rama",
        side: null,
        lane: 1,
        depth: 0,
        anchorId: null,
        anchorIndex: null,
        rejoinId: null,
        rejoinIndex: null,
        groupId: null,
        level: 0
      };

      if (this.troncoSet.has(nodo.id)) {
        infoBase.role = "tronco";
        infoBase.side = "center";
        infoBase.anchorId = nodo.id;
        infoBase.anchorIndex = this.indiceTronco.get(nodo.id);
        infoBase.groupId = "tronco:" + nodo.id;
      }

      this.infoNodos.set(nodo.id, infoBase);
    });
  }

  obtenerRaicesDeRama() {
    const raices = [];

    this.tronco.forEach((troncoId, indice) => {
      const nodo = this.getNodo(troncoId);
      if (!nodo) return;

      const salidas = this.salidasEstructurales(nodo)
        .filter(conexion => this.rolConexion(conexion) === "rama")
        .filter(conexion => !this.troncoSet.has(conexion.hacia));

      const unicas = [];
      const vistos = new Set();
      salidas.forEach(conexion => {
        if (vistos.has(conexion.hacia)) return;
        vistos.add(conexion.hacia);
        unicas.push(conexion);
      });

      const ladoPreferido = indice % 2 === 0 ? "right" : "left";

      unicas.forEach((conexion, idx) => {
        const lado =
          idx % 2 === 0
            ? ladoPreferido
            : (ladoPreferido === "right" ? "left" : "right");
        const lane = Math.floor(idx / 2) + 1;

        raices.push({
          id: conexion.hacia,
          rootId: conexion.hacia,
          sourceId: troncoId,
          sourceIndex: indice,
          side: lado,
          lane,
          depth: 1,
          groupId: String(troncoId) + "::" + String(conexion.hacia)
        });
      });
    });

    return raices;
  }

  debeReemplazarContextoRama(existente, candidato) {
    if (!existente) return true;
    if (existente.role === "tronco" || existente.role === "lateral") return false;
    if (existente.anchorId == null) return true;

    if (candidato.anchorIndex < existente.anchorIndex) return true;
    if (candidato.anchorIndex > existente.anchorIndex) return false;

    if (candidato.depth < existente.depth) return true;
    if (candidato.depth > existente.depth) return false;

    if (candidato.side === existente.side && candidato.lane < existente.lane) return true;

    return false;
  }

  propagarContextoRama(raices) {
    const cola = raices.slice();
    let guard = 0;
    const maxPasos = this.diagrama.nodos.size * 8 + 10;

    while (cola.length && guard < maxPasos) {
      const actual = cola.shift();
      const nodo = this.getNodo(actual.id);
      if (!nodo || nodo.esLateral() || this.troncoSet.has(nodo.id)) {
        guard++;
        continue;
      }

      const existente = this.infoNodos.get(nodo.id);
      const candidato = {
        ...existente,
        role: "rama",
        side: actual.side,
        lane: actual.lane,
        depth: actual.depth,
        anchorId: actual.sourceId,
        anchorIndex: actual.sourceIndex,
        groupId: actual.groupId
      };

      if (!this.debeReemplazarContextoRama(existente, candidato)) {
        guard++;
        continue;
      }

      this.infoNodos.set(nodo.id, candidato);

      this.salidasEstructurales(nodo).forEach(conexion => {
        const destino = this.getNodo(conexion.hacia);
        if (!destino || destino.esLateral()) return;
        if (this.troncoSet.has(destino.id)) return;

        cola.push({
          id: destino.id,
          rootId: actual.rootId,
          sourceId: actual.sourceId,
          sourceIndex: actual.sourceIndex,
          side: actual.side,
          lane: actual.lane,
          depth: actual.depth + 1,
          groupId: actual.groupId
        });
      });

      guard++;
    }
  }

  reconvergenciaMasCercanaDesde(nodoId, minIndex, memo = new Map(), visitando = new Set()) {
    const clave = String(nodoId) + "|" + String(minIndex);
    if (memo.has(clave)) return memo.get(clave);
    if (visitando.has(clave)) return null;

    const nodo = this.getNodo(nodoId);
    if (!nodo) return null;

    visitando.add(clave);

    let mejor = null;

    this.salidasEstructurales(nodo).forEach(conexion => {
      const destino = this.getNodo(conexion.hacia);
      if (!destino || destino.esLateral()) return;

      if (this.troncoSet.has(destino.id)) {
        const idx = this.indiceTronco.get(destino.id);
        if (idx > minIndex && (mejor == null || idx < mejor)) mejor = idx;
        return;
      }

      const sub = this.reconvergenciaMasCercanaDesde(destino.id, minIndex, memo, visitando);
      if (sub != null && (mejor == null || sub < mejor)) mejor = sub;
    });

    visitando.delete(clave);
    memo.set(clave, mejor);
    return mejor;
  }

  resolverReconvergenciasDeRama() {
    const memo = new Map();

    this.diagrama.nodos.forEach(nodo => {
      if (!nodo || nodo.esLateral() || this.troncoSet.has(nodo.id)) return;

      const info = this.infoNodos.get(nodo.id);
      if (!info || info.anchorIndex == null) return;

      const rejoinIndex = this.reconvergenciaMasCercanaDesde(nodo.id, info.anchorIndex, memo);
      if (rejoinIndex == null) return;

      info.rejoinIndex = rejoinIndex;
      info.rejoinId = this.tronco[rejoinIndex] || null;
      this.infoNodos.set(nodo.id, info);
    });
  }

  completarNodosSinContexto() {
    let cambio = true;
    let guard = 0;
    const maxPasos = this.diagrama.nodos.size * 4 + 4;

    while (cambio && guard < maxPasos) {
      cambio = false;

      this.diagrama.nodos.forEach(nodo => {
        if (!nodo || nodo.esLateral() || this.troncoSet.has(nodo.id)) return;

        const info = this.infoNodos.get(nodo.id);
        if (info && info.anchorId != null) return;

        const entradas = this.entradasEstructurales(nodo);
        for (const conexion of entradas) {
          const infoOrigen = this.infoNodos.get(conexion.desde);
          if (!infoOrigen || infoOrigen.anchorId == null) continue;

          this.infoNodos.set(nodo.id, {
            ...info,
            role: "rama",
            side: infoOrigen.side || "right",
            lane: infoOrigen.lane || 1,
            depth: (infoOrigen.depth || 0) + 1,
            anchorId: infoOrigen.anchorId,
            anchorIndex: infoOrigen.anchorIndex,
            groupId: infoOrigen.groupId
          });
          cambio = true;
          break;
        }
      });

      guard++;
    }

    this.diagrama.nodos.forEach(nodo => {
      if (!nodo || nodo.esLateral() || this.troncoSet.has(nodo.id)) return;

      const info = this.infoNodos.get(nodo.id);
      if (info && info.anchorId != null) return;

      this.infoNodos.set(nodo.id, {
        ...info,
        role: "rama",
        side: "right",
        lane: 1,
        depth: 1,
        anchorId: this.tronco[0] || null,
        anchorIndex: 0,
        groupId: "fallback"
      });
    });
  }

  prepararEstructuraSemantica() {
    this.detectarTroncoPrincipal();
    this.clasificarConexiones();
    this.inicializarInfoNodos();

    const raices = this.obtenerRaicesDeRama();
    this.propagarContextoRama(raices);
    this.completarNodosSinContexto();
    this.resolverReconvergenciasDeRama();
  }

  nivelDesdeEntradas(nodoId, memo = new Map(), visitando = new Set()) {
    if (memo.has(nodoId)) return memo.get(nodoId);
    if (visitando.has(nodoId)) return 0;

    const nodo = this.getNodo(nodoId);
    if (!nodo || nodo.esLateral()) return 0;

    visitando.add(nodoId);

    const entradas = this.entradasEstructurales(nodo);
    let nivel = nodo.id === (this.diagrama.raiz && this.diagrama.raiz.id) ? 0 : 0;

    if (entradas.length) {
      nivel = entradas.reduce((max, conexion) => {
        const previo = this.nivelDesdeEntradas(conexion.desde, memo, visitando) + 1;
        return Math.max(max, previo);
      }, 0);
    }

    visitando.delete(nodoId);
    memo.set(nodoId, nivel);
    return nivel;
  }

  calcularNiveles() {
    this.niveles.clear();
    const memo = new Map();

    this.diagrama.nodos.forEach(nodo => {
      if (!nodo || nodo.esLateral()) return;
      this.niveles.set(nodo.id, this.nivelDesdeEntradas(nodo.id, memo));
    });

    let cambio = true;
    let guard = 0;
    const maxPasos = this.diagrama.nodos.size * 3 + 3;

    while (cambio && guard < maxPasos) {
      cambio = false;

      this.diagrama.conexiones.forEach(conexion => {
        if (!this.esConexionEstructural(conexion)) return;

        const desde = this.getNodo(conexion.desde);
        const hacia = this.getNodo(conexion.hacia);
        if (!this.esNodoEstructural(desde) || !this.esNodoEstructural(hacia)) return;

        const nivelDesde = this.niveles.get(desde.id) || 0;
        const nivelHacia = this.niveles.get(hacia.id) || 0;
        const requerido = nivelDesde + 1;

        if (nivelHacia < requerido) {
          this.niveles.set(hacia.id, requerido);
          cambio = true;
        }
      });

      guard++;
    }

    this.tronco.forEach((id, idx) => {
      const nivelActual = this.niveles.get(id) || 0;
      if (idx === 0) return;
      const previo = this.niveles.get(this.tronco[idx - 1]) || 0;
      if (nivelActual < previo + 1) {
        this.niveles.set(id, previo + 1);
      }
    });

    this.infoNodos.forEach((info, id) => {
      info.level = this.niveles.get(id) || 0;
      this.infoNodos.set(id, info);
    });
  }

  prepararFilas() {
    this.rowHeights.clear();
    this.rowTops.clear();

    const niveles = Array.from(this.niveles.values())
      .filter(n => Number.isFinite(n))
      .sort((a, b) => a - b);

    const unicos = Array.from(new Set(niveles));

    unicos.forEach(nivel => {
      let maxAlto = 0;
      this.diagrama.nodos.forEach(nodo => {
        if (!nodo || nodo.esLateral()) return;
        if ((this.niveles.get(nodo.id) || 0) !== nivel) return;
        maxAlto = Math.max(maxAlto, nodo.alto);
      });
      this.rowHeights.set(nivel, maxAlto || this.cfg.altoNodo);
    });

    let cursorY = this.cfg.margenY;
    unicos.forEach(nivel => {
      this.rowTops.set(nivel, cursorY);
      cursorY += (this.rowHeights.get(nivel) || this.cfg.altoNodo) + this.cfg.separacionVertical;
    });
  }

  yParaNodo(nodo) {
    const nivel = this.niveles.get(nodo.id) || 0;
    const top = this.rowTops.get(nivel) || this.cfg.margenY;
    const altoFila = this.rowHeights.get(nivel) || nodo.alto;
    return top + Math.max(0, (altoFila - nodo.alto) / 2);
  }

  centroDePosicion(pos) {
    return pos.x + pos.width / 2;
  }

  offsetBaseRama() {
    return Math.ceil(this.maxAnchoEstructura / 2 + this.cfg.separacionHorizontal * 0.95);
  }

  offsetPasoProfundidad() {
    return Math.max(28, Math.round(this.cfg.separacionHorizontal * 0.42));
  }

  offsetPasoLane() {
    return Math.max(34, Math.round(this.cfg.separacionHorizontal * 0.58));
  }

  offsetIdealNodoRama(nodo) {
    const info = this.infoNodos.get(nodo.id) || {};
    const lado = info.side === "left" ? -1 : 1;

    let magnitud =
      this.offsetBaseRama() +
      Math.max(0, (info.lane || 1) - 1) * this.offsetPasoLane() +
      Math.max(0, Math.min((info.depth || 1) - 1, 2)) * this.offsetPasoProfundidad();

    if (info.rejoinIndex != null && info.anchorIndex != null) {
      const span = info.rejoinIndex - info.anchorIndex;
      if (span <= 1) magnitud *= 0.72;
      else if (span === 2) magnitud *= 0.82;
      else if (span === 3) magnitud *= 0.9;
    }

    const padresRama = this.entradasEstructurales(nodo)
      .map(conexion => this.posiciones.get(conexion.desde))
      .filter(Boolean)
      .filter(pos => Math.abs(this.centroDePosicion(pos)) > 1);

    if (padresRama.length) {
      const promedioMagnitud =
        padresRama.reduce((acc, pos) => acc + Math.abs(this.centroDePosicion(pos)), 0) /
        padresRama.length;
      magnitud = Math.max(this.offsetBaseRama(), Math.min(magnitud, promedioMagnitud + 26));
    }

    return lado * magnitud;
  }

  haySolapeRect(rectA, rectB, margenX = 12, margenY = 10) {
    if (!rectA || !rectB) return false;
    return !(
      rectA.x + rectA.width + margenX <= rectB.x ||
      rectB.x + rectB.width + margenX <= rectA.x ||
      rectA.y + rectA.height + margenY <= rectB.y ||
      rectB.y + rectB.height + margenY <= rectA.y
    );
  }

  haySolapeConPosicionados(rect, excluirId) {
    for (const [id, pos] of this.posiciones.entries()) {
      if (id === excluirId) continue;
      const nodo = this.getNodo(id);
      if (!nodo || nodo.esLateral()) continue;
      if (this.haySolapeRect(rect, pos, 12, 8)) return true;
    }
    return false;
  }

  resolverCentroXSinSolape(nodo, centroDeseado, lado) {
    const signo = lado === "left" ? -1 : 1;
    const minimo = this.offsetBaseRama();
    const paso = Math.max(14, Math.round(this.cfg.separacionHorizontal * 0.28));
    const y = this.yParaNodo(nodo);

    let centro = centroDeseado;
    if (signo < 0) centro = Math.min(centro, -minimo);
    else centro = Math.max(centro, minimo);

    for (let guard = 0; guard < 60; guard++) {
      const rect = {
        x: centro - nodo.ancho / 2,
        y,
        width: nodo.ancho,
        height: nodo.alto
      };
      if (!this.haySolapeConPosicionados(rect, nodo.id)) return centro;
      centro += signo * paso;
    }

    return centro;
  }

  ubicarTronco(centroX) {
    this.tronco.forEach(id => {
      const nodo = this.getNodo(id);
      if (!nodo) return;

      const y = this.yParaNodo(nodo);
      const x = centroX - nodo.ancho / 2;

      this.posiciones.set(id, { x, y, width: nodo.ancho, height: nodo.alto });
      nodo.x = x;
      nodo.y = y;
    });
  }

  ordenarNodosDeRamaParaUbicar() {
    const lista = [];

    this.diagrama.nodos.forEach(nodo => {
      if (!nodo || nodo.esLateral() || this.troncoSet.has(nodo.id)) return;
      const info = this.infoNodos.get(nodo.id) || {};
      lista.push({
        nodo,
        level: this.niveles.get(nodo.id) || 0,
        anchorIndex: info.anchorIndex != null ? info.anchorIndex : Number.MAX_SAFE_INTEGER,
        depth: info.depth || 0,
        lane: info.lane || 1,
        side: info.side || "right"
      });
    });

    lista.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      if (a.anchorIndex !== b.anchorIndex) return a.anchorIndex - b.anchorIndex;
      if (a.side !== b.side) return a.side === "left" ? -1 : 1;
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.lane !== b.lane) return a.lane - b.lane;
      return String(a.nodo.id).localeCompare(String(b.nodo.id));
    });

    return lista.map(item => item.nodo);
  }

  ubicarRamas() {
    const nodos = this.ordenarNodosDeRamaParaUbicar();

    nodos.forEach(nodo => {
      const info = this.infoNodos.get(nodo.id) || {};
      const lado = info.side || "right";
      const centroDeseado = this.offsetIdealNodoRama(nodo);
      const centro = this.resolverCentroXSinSolape(nodo, centroDeseado, lado);
      const y = this.yParaNodo(nodo);

      const x = centro - nodo.ancho / 2;
      this.posiciones.set(nodo.id, { x, y, width: nodo.ancho, height: nodo.alto });
      nodo.x = x;
      nodo.y = y;
    });
  }

  compactarRamasHaciaTronco() {
    const candidatos = [];

    this.diagrama.nodos.forEach(nodo => {
      if (!nodo || nodo.esLateral() || this.troncoSet.has(nodo.id)) return;
      const pos = this.posiciones.get(nodo.id);
      const info = this.infoNodos.get(nodo.id) || {};
      if (!pos || !info.side) return;
      candidatos.push({ nodo, pos, info });
    });

    candidatos.sort((a, b) => {
      const ca = Math.abs(this.centroDePosicion(a.pos));
      const cb = Math.abs(this.centroDePosicion(b.pos));
      return cb - ca;
    });

    const paso = Math.max(8, Math.round(this.cfg.separacionHorizontal * 0.16));
    const minimo = this.offsetBaseRama() * 0.9;

    candidatos.forEach(item => {
      const { nodo, info } = item;
      const pos = this.posiciones.get(nodo.id);
      if (!pos) return;

      const signo = info.side === "left" ? -1 : 1;
      let centro = this.centroDePosicion(pos);

      for (let guard = 0; guard < 40; guard++) {
        const siguienteCentro = centro - signo * paso;
        if (signo < 0 && siguienteCentro > -minimo) break;
        if (signo > 0 && siguienteCentro < minimo) break;

        const rect = {
          x: siguienteCentro - nodo.ancho / 2,
          y: pos.y,
          width: nodo.ancho,
          height: nodo.alto
        };

        if (this.haySolapeConPosicionados(rect, nodo.id)) break;

        pos.x = rect.x;
        nodo.x = rect.x;
        centro = siguienteCentro;
      }
    });
  }

  estimarAnchoGlobal() {
    let minX = Infinity;
    let maxX = -Infinity;

    this.diagrama.nodos.forEach(nodo => {
      if (!nodo || nodo.esLateral()) return;

      let center = 0;
      if (this.troncoSet.has(nodo.id)) center = 0;
      else center = this.offsetIdealNodoRama(nodo);

      minX = Math.min(minX, center - nodo.ancho / 2);
      maxX = Math.max(maxX, center + nodo.ancho / 2);
    });

    if (!isFinite(minX) || !isFinite(maxX)) return this.cfg.anchoNodo;
    return (maxX - minX) + this.cfg.margenX * 2;
  }

  estimarAltoGlobal() {
    let maxY = this.cfg.margenY;

    this.diagrama.nodos.forEach(nodo => {
      if (!nodo || nodo.esLateral()) return;
      maxY = Math.max(maxY, this.yParaNodo(nodo) + nodo.alto);
    });

    return maxY + this.cfg.margenY;
  }

  medir(nodo) {
    this.prepararEstructuraSemantica();
    this.calcularNiveles();
    this.prepararFilas();

    if (nodo) {
      nodo.subtreeWidth = this.estimarAnchoGlobal();
      nodo.subtreeHeight = this.estimarAltoGlobal();
    }
  }

  ubicar() {
    this.posiciones.clear();
    this.ubicarTronco(0);
    this.ubicarRamas();
    this.compactarRamasHaciaTronco();
  }

  lateralesAsociados(nodo) {
    if (!nodo) return [];
    return nodo.entradas
      .filter(c => c.esAnotacion() || c.esReferencia())
      .map(c => this.diagrama.getNodo(c.desde))
      .filter(n => n && n.esLateral());
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
      if (!nodo || nodo.esLateral()) continue;
      if (this.haySolape(rect, pos, this.cfg.lateralMargenSolapeEstructura)) return true;
    }
    return false;
  }

  haySolapeConLaterales(rect, excluirIds = []) {
    const excluidos = new Set(excluirIds);
    for (const [id, pos] of this.posiciones.entries()) {
      if (excluidos.has(id)) continue;
      const nodo = this.diagrama.getNodo(id);
      if (!nodo || !nodo.esLateral()) continue;
      if (this.haySolape(rect, pos, this.cfg.lateralMargenSolapeLaterales)) return true;
    }
    return false;
  }

  buscarYLibreParaLateral(x, yBase, ancho, alto, excluirIds = []) {
    const candidatos = [yBase];
    const paso = this.cfg.lateralSeparacionVertical;
    const maxIntentos = this.cfg.lateralBusquedaIntentos;
    for (let i = 1; i <= maxIntentos; i++) {
      candidatos.push(yBase + i * paso);
      candidatos.push(yBase - i * paso);
    }
    for (const y of candidatos) {
      const rect = { x, y, width: ancho, height: alto };
      if (y < this.cfg.margenY) continue;
      if (!this.haySolapeConEstructura(rect, excluirIds) && !this.haySolapeConLaterales(rect, excluirIds)) return y;
    }
    return yBase;
  }

  ubicarLaterales() {
    const grupos = new Map();
    this.diagrama.conexiones.forEach(c => {
      if (!(c.esAnotacion() || c.esReferencia())) return;
      const lateral = this.diagrama.getNodo(c.desde);
      const asociado = this.diagrama.getNodo(c.hacia);
      if (!lateral || !asociado || !lateral.esLateral()) return;
      if (!grupos.has(asociado.id)) grupos.set(asociado.id, []);
      grupos.get(asociado.id).push({ conexion: c, lateral, asociado });
    });

    grupos.forEach(items => {
      if (!items.length) return;

      const asociado = items[0].asociado;
      const posAsociado = this.posiciones.get(asociado.id);
      if (!posAsociado) return;

      const separacion = this.cfg.lateralSeparacionVertical || 14;
      items.sort((a, b) => {
        const pa = a.conexion.esReferencia() ? 0 : 1;
        const pb = b.conexion.esReferencia() ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return String(a.lateral.id).localeCompare(String(b.lateral.id));
      });

      const altoTotal = items.reduce(
        (acc, item, idx) => acc + item.lateral.alto + (idx > 0 ? separacion : 0),
        0
      );

      const yCentroGrupoIdeal =
        posAsociado.y + posAsociado.height / 2 - altoTotal / 2;

      const xDerecha =
        posAsociado.x + asociado.ancho + this.cfg.lateralCodo + this.cfg.lateralGap;

      const maxAnchoLateral = Math.max.apply(
        null,
        items.map(item => item.lateral.ancho)
      );

      const xIzquierda =
        posAsociado.x - this.cfg.lateralCodo - this.cfg.lateralGap - maxAnchoLateral;

      const idsGrupo = items.map(item => item.lateral.id);
      let cursorY = yCentroGrupoIdeal;

      items.forEach((item, idx) => {
        const lateral = item.lateral;
        const yIdeal = cursorY;
        const excluirIds = idsGrupo.slice(idx + 1);

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

    this.diagrama.nodos.forEach(nodo => {
      const pos = this.posiciones.get(nodo.id);
      if (!pos || !nodo.esLateral()) return;
      nodo.x = pos.x;
      nodo.y = pos.y;
    });
  }

  centroEjePrincipal() {
    for (const id of this.tronco) {
      const pos = this.posiciones.get(id);
      if (pos) return this.centroDePosicion(pos);
    }
    return null;
  }

  ajustarNodoFinal() {
    if (!this.cfg.ajustarNodoFinalAbajo) return;

    const nodosFin = Array.from(this.diagrama.nodos.values()).filter(n => n.tipo === "fin");
    if (!nodosFin.length) return;

    let fondoMaximo = -Infinity;
    this.posiciones.forEach((pos, id) => {
      const nodo = this.diagrama.getNodo(id);
      if (!nodo || nodo.tipo === "fin") return;
      fondoMaximo = Math.max(fondoMaximo, pos.y + pos.height);
    });

    if (!isFinite(fondoMaximo)) return;

    const nuevaYBase = fondoMaximo + this.cfg.distanciaExtraNodoFinal;
    const centroPrincipal = this.centroEjePrincipal();

    nodosFin.forEach(nodo => {
      const pos = this.posiciones.get(nodo.id);
      if (!pos) return;

      if (pos.y < nuevaYBase) {
        pos.y = nuevaYBase;
        nodo.y = pos.y;
      }

      if (this.cfg.centrarNodoFinal && centroPrincipal != null) {
        pos.x = centroPrincipal - pos.width / 2;
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
      return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
    }

    return {
      width: (maxX - minX) + 2 * this.cfg.margenX,
      height: (maxY - minY) + 2 * this.cfg.margenY,
      offsetX: this.cfg.margenX - minX,
      offsetY: this.cfg.margenY - minY
    };
  }

  calcular() {
    if (!this.diagrama.raiz) {
      return { posiciones: this.posiciones, width: 0, height: 0 };
    }

    this.medir(this.diagrama.raiz);
    this.ubicar();
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
}

  function idSVG(cfg, base) {
    return "flujomate-" + cfg._uid + "-" + base;
  }

  function definirMarcadores(svg, cfg) {
    const defs = crearSVG("defs");

    const bgGrad = crearSVG("linearGradient", {
      id: idSVG(cfg, "arena-bg"),
      x1: "0%",
      y1: "0%",
      x2: "100%",
      y2: "100%"
    });
    bgGrad.appendChild(crearSVG("stop", { offset: "0%", "stop-color": cfg.fondoDiagrama2 || cfg.fondoDiagrama }));
    bgGrad.appendChild(crearSVG("stop", { offset: "52%", "stop-color": cfg.fondoDiagrama }));
    bgGrad.appendChild(crearSVG("stop", { offset: "100%", "stop-color": "#c7f0ff" }));
    defs.appendChild(bgGrad);

    defs.appendChild(crearSVG("filter", {
      id: idSVG(cfg, "shadow"),
      x: "-18%",
      y: "-22%",
      width: "136%",
      height: "150%"
    }));
    const shadow = defs.lastChild;
    shadow.appendChild(crearSVG("feDropShadow", {
      dx: "0",
      dy: "8",
      stdDeviation: "8",
      "flood-color": cfg.sombraColor,
      "flood-opacity": String(cfg.sombraOpacity)
    }));




const connectionGlow = crearSVG("filter", {
  id: idSVG(cfg, "connection-glow"),
  filterUnits: "userSpaceOnUse",
  x: "-50000",
  y: "-50000",
  width: "100000",
  height: "100000"
});











    connectionGlow.appendChild(crearSVG("feDropShadow", {
      dx: "0",
      dy: "0",
      stdDeviation: "3",
      "flood-color": "#7dd3fc",
      "flood-opacity": "0.55"
    }));
    defs.appendChild(connectionGlow);

    const pattern = crearSVG("pattern", {
      id: idSVG(cfg, "grid"),
      width: "32",
      height: "32",
      patternUnits: "userSpaceOnUse"
    });
    pattern.appendChild(crearSVG("path", {
      d: "M 32 0 L 0 0 0 32",
      fill: "none",
      stroke: cfg.fondoPatron,
      "stroke-width": "1",
      opacity: String(cfg.fondoPatronOpacity)
    }));
    pattern.appendChild(crearSVG("path", {
      d: "M 16 0 L 16 32 M 0 16 L 32 16",
      fill: "none",
      stroke: cfg.fondoPatronSecundario,
      "stroke-width": "0.5",
      opacity: String(Math.max(0, cfg.fondoPatronOpacity - 0.08))
    }));
    defs.appendChild(pattern);

    const style = crearSVG("style");
    style.textContent =
      ".flujomate-conexion{transition:opacity .18s ease,stroke-width .18s ease;}" +
      ".flujomate-conexion-activa{opacity:1;stroke-dasharray:10 8;animation:flujomateCargaRuta .9s linear infinite;}" +
      ".flujomate-conexion-atenuada{opacity:.18;}" +
      "@keyframes flujomateCargaRuta{to{stroke-dashoffset:-36;}}";
    defs.appendChild(style);

    Object.entries(COLORES_NODO).forEach(([tipo, estilo]) => {
      const grad = crearSVG("linearGradient", {
        id: idSVG(cfg, "node-" + tipo),
        x1: "0%",
        y1: "0%",
        x2: "100%",
        y2: "100%"
      });
      grad.appendChild(crearSVG("stop", { offset: "0%", "stop-color": estilo.fill2 || estilo.fill }));
      grad.appendChild(crearSVG("stop", { offset: "100%", "stop-color": estilo.fill }));
      defs.appendChild(grad);
    });

    Object.entries(COLORES_CONEXION).forEach(([semantica, color]) => {
      const marker = crearSVG("marker", {
        id: idSVG(cfg, "arrow-" + semantica),
        viewBox: "0 0 10 10",
        refX: String(cfg.markerRefX),
        refY: String(cfg.markerRefY),
        markerWidth: String(cfg.markerWidth),
        markerHeight: String(cfg.markerHeight),
        orient: "auto-start-reverse"
      });
      marker.appendChild(crearSVG("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
      defs.appendChild(marker);
    });
    svg.appendChild(defs);
  }

  function markerPorColor(color, cfg) {
    const entrada = Object.entries(COLORES_CONEXION).find(([, value]) => value === color);
    const semantica = entrada ? entrada[0] : "flujo";
    return "url(#" + idSVG(cfg, "arrow-" + semantica) + ")";
  }

  function fillNodo(tipo, estilo, cfg) {
    if (!cfg.gradienteNodos) return estilo.fill;
    return "url(#" + idSVG(cfg, "node-" + tipo) + ")";
  }

  function dibujarFondoSVG(svg, width, height, cfg) {
    const fondo = crearSVG("rect", {
      x: -50000,
      y: -50000,
      width: 100000,
      height: 100000,
      fill: "url(#" + idSVG(cfg, "arena-bg") + ")"
    });
    svg.appendChild(fondo);
    svg.appendChild(crearSVG("rect", {
      x: -50000,
      y: -50000,
      width: 100000,
      height: 100000,
      fill: "url(#" + idSVG(cfg, "grid") + ")"
    }));
  }

  function puntoBordeRombo(pos, haciaX, haciaY) {
    const cx = pos.x + pos.width / 2;
    const cy = pos.y + pos.height / 2;
    const dx = haciaX - cx;
    const dy = haciaY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const rx = pos.width / 2;
    const ry = pos.height / 2;
    const denom = Math.abs(dx) / rx + Math.abs(dy) / ry;
    const t = denom === 0 ? 0 : 1 / denom;
    return { x: cx + dx * t, y: cy + dy * t };
  }

  function puntoSalida(pos, nodo, posDestino, conexion) {
    const semantica = conexion?.semantica || "flujo";
    if (semantica === "anotacion" || semantica === "referencia") {
      const cxDestino = posDestino.x + posDestino.width / 2;
      const cxOrigen = pos.x + pos.width / 2;
      return { x: cxDestino < cxOrigen ? pos.x : pos.x + pos.width, y: pos.y + pos.height / 2 };
    }
    const cxDestino = posDestino.x + posDestino.width / 2;
    const cyDestino = posDestino.y + posDestino.height / 2;
    if (nodo?.tipo === "decision") return puntoBordeRombo(pos, cxDestino, cyDestino);
    const cx = pos.x + pos.width / 2;
    const cy = pos.y + pos.height / 2;
    const dx = cxDestino - cx;
    const dy = cyDestino - cy;
    if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? pos.x + pos.width : pos.x, y: cy };
    return { x: cx, y: dy > 0 ? pos.y + pos.height : pos.y };
  }

  function puntoEntrada(pos, nodo, posOrigen, conexion) {
    const semantica = conexion?.semantica || "flujo";
    if (semantica === "anotacion" || semantica === "referencia") {
      const cxOrigen = posOrigen.x + posOrigen.width / 2;
      const cxDestino = pos.x + pos.width / 2;
      return { x: cxOrigen < cxDestino ? pos.x : pos.x + pos.width, y: pos.y + pos.height / 2 };
    }
    const cxOrigen = posOrigen.x + posOrigen.width / 2;
    const cyOrigen = posOrigen.y + posOrigen.height / 2;
    if (nodo?.tipo === "decision") return puntoBordeRombo(pos, cxOrigen, cyOrigen);
    const cx = pos.x + pos.width / 2;
    const cy = pos.y + pos.height / 2;
    const dx = cxOrigen - cx;
    const dy = cyOrigen - cy;
    if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? pos.x + pos.width : pos.x, y: cy };
    return { x: cx, y: dy > 0 ? pos.y + pos.height : pos.y };
  }

  function escapeDiagonalRombo(punto, posOtroNodo, cfg) {
    const d = cfg.romboDiagonalSalida || 10;
    const cxOtro = posOtroNodo.x + posOtroNodo.width / 2;
    const cyOtro = posOtroNodo.y + posOtroNodo.height / 2;
    const dx = cxOtro - punto.x;
    const dy = cyOtro - punto.y;
    let ex = punto.x;
    let ey = punto.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      ex += dx >= 0 ? d : -d;
      ey += dy >= 0 ? d * 0.5 : -d * 0.5;
    } else {
      ex += dx >= 0 ? d * 0.5 : -d * 0.5;
      ey += dy >= 0 ? d : -d;
    }
    return { x: ex, y: ey };
  }

  function clonarPunto(p) { return { x: p.x, y: p.y }; }
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

  function rutaAPath(puntos) {
    if (!puntos || !puntos.length) return "";
    let d = "M " + puntos[0].x + " " + puntos[0].y;
    for (let i = 1; i < puntos.length; i++) d += " L " + puntos[i].x + " " + puntos[i].y;
    return d;
  }

  function segmentosDeRuta(puntos) {
    const segs = [];
    for (let i = 0; i < puntos.length - 1; i++) {
      const a = puntos[i], b = puntos[i + 1];
      if (a.x === b.x && a.y === b.y) continue;
      segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return segs;
  }
  function esVertical(seg) { return seg.x1 === seg.x2; }
  function esHorizontal(seg) { return seg.y1 === seg.y2; }
  function rangosSeSolapan(a1, a2, b1, b2, margen = 0) {
    const minA = Math.min(a1, a2), maxA = Math.max(a1, a2), minB = Math.min(b1, b2), maxB = Math.max(b1, b2);
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
    return false;
  }
  function segmentoChocaRect(seg, rect, padding = 0) {
    const rx1 = rect.x - padding, ry1 = rect.y - padding, rx2 = rect.x + rect.width + padding, ry2 = rect.y + rect.height + padding;
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
        if (segmentoChocaRect(seg, rect, cfg.conexionMargenNodo)) return true;
      }
    }
    return false;
  }
  function rutaChocaConOtras(segmentos, rutasOcupadas, cfg) {
    if (!rutasOcupadas || !rutasOcupadas.length) return false;
    for (const ruta of rutasOcupadas) {
      for (const segA of segmentos) {
        for (const segB of ruta.segmentos) {
          if (segmentosSeSolapan(segA, segB, cfg.conexionSeparacionMin)) return true;
        }
      }
    }
    return false;
  }
  function registrarRutaOcupada(segmentos, rutasOcupadas) {
    if (!rutasOcupadas) return;
    rutasOcupadas.push({ segmentos: segmentos.slice() });
  }
  function construirRutaOrtogonal(a, b, offsetY) {
    return [clonarPunto(a), { x: a.x, y: offsetY }, { x: b.x, y: offsetY }, clonarPunto(b)];
  }
  function construirRutaHorizontalVertical(a, b, offsetX) {
    return [clonarPunto(a), { x: offsetX, y: a.y }, { x: offsetX, y: b.y }, clonarPunto(b)];
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
      if (!rutaChocaConNodos(segs, layout, conexion, cfg) && !rutaChocaConOtras(segs, rutasOcupadas, cfg)) return limpia;
    }
    return simplificarRuta(candidatos[0]);
  }

  function dibujarTexto(grupo, x, y, lineas, color, cfg) {
    const text = crearSVG("text", {
      x, y,
      "text-anchor": "middle",
      "font-family": cfg.fontFamily,
      "font-size": cfg.fontSize,
      "font-weight": "750",
      "letter-spacing": "0",
      "paint-order": "stroke",
      stroke: "#020617",
      "stroke-width": "0.45",
      fill: color
    });
    lineas.forEach(function (linea, idx) {
      const tspan = crearSVG("tspan", { x, dy: idx === 0 ? "0" : "1.25em" });
      tspan.textContent = linea;
      text.appendChild(tspan);
    });
    grupo.appendChild(text);
    return text;
  }

  function dibujarNodo(svg, nodo, pos, cfg) {
    const estilo = COLORES_NODO[nodo.tipo] || COLORES_NODO.proceso;
    const grupo = crearSVG("g", { class: "flujomate-nodo flujomate-" + nodo.tipo, "data-id": nodo.id });
    if (cfg.sombraNodos) grupo.setAttribute("filter", "url(#" + idSVG(cfg, "shadow") + ")");
    if (nodo.tipo === "decision") {
      const cx = pos.x + pos.width / 2;
      const cy = pos.y + pos.height / 2;
      const puntos = [[cx, pos.y], [pos.x + pos.width, cy], [cx, pos.y + pos.height], [pos.x, cy]].map(p => p.join(",")).join(" ");
      grupo.appendChild(crearSVG("polygon", {
        points: puntos,
        fill: fillNodo(nodo.tipo, estilo, cfg),
        stroke: estilo.stroke,
        "stroke-width": cfg.strokeWidth,
        "stroke-linejoin": "round"
      }));
      if (cfg.mostrarAcentoNodos) {
        grupo.appendChild(crearSVG("circle", {
          cx,
          cy: pos.y + 18,
          r: 4,
          fill: estilo.accent,
          opacity: "0.9"
        }));
      }
    } else {
      grupo.appendChild(crearSVG("rect", {
        x: pos.x, y: pos.y, width: pos.width, height: pos.height,
        rx: (nodo.tipo === "inicio" || nodo.tipo === "fin") ? cfg.radio : cfg.radioNodo,
        ry: (nodo.tipo === "inicio" || nodo.tipo === "fin") ? cfg.radio : cfg.radioNodo,
        fill: fillNodo(nodo.tipo, estilo, cfg),
        stroke: estilo.stroke,
        "stroke-width": nodo.tipo === "resultado" ? cfg.strokeWidth + 1 : cfg.strokeWidth,
        "stroke-dasharray": nodo.tipo === "referencia" ? "6 4" : ""
      }));
      if (cfg.bordeSuaveNodos) {
        grupo.appendChild(crearSVG("rect", {
          x: pos.x + 1.5,
          y: pos.y + 1.5,
          width: Math.max(0, pos.width - 3),
          height: Math.max(0, pos.height - 3),
          rx: Math.max(0, ((nodo.tipo === "inicio" || nodo.tipo === "fin") ? cfg.radio : cfg.radioNodo) - 2),
          ry: Math.max(0, ((nodo.tipo === "inicio" || nodo.tipo === "fin") ? cfg.radio : cfg.radioNodo) - 2),
          fill: "none",
          stroke: cfg.bordeSuaveColor,
          "stroke-width": "1",
          opacity: String(cfg.bordeSuaveOpacity)
        }));
      }
      if (cfg.mostrarAcentoNodos) {
        const accentX = pos.x + 12;
        const accentY = pos.y + 12;
        const accentH = Math.max(12, pos.height - 24);
        grupo.appendChild(crearSVG("rect", {
          x: accentX,
          y: accentY,
          width: cfg.anchoAcentoNodo,
          height: accentH,
          rx: cfg.anchoAcentoNodo / 2,
          ry: cfg.anchoAcentoNodo / 2,
          fill: estilo.accent,
          opacity: "0.9"
        }));
      }
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
    const ancho = Math.max(cfg.etiquetaMinWidth, texto.length * cfg.etiquetaCharWidth + cfg.etiquetaPaddingX);
    const alto = cfg.etiquetaHeight;
    svg.appendChild(crearSVG("rect", {
      x: x - ancho / 2, y: y - alto / 2, width: ancho, height: alto,
      rx: cfg.etiquetaRadius,
      ry: cfg.etiquetaRadius,
      fill: cfg.etiquetaFill,
      stroke: cfg.etiquetaStroke,
      "stroke-width": "1",
      opacity: String(cfg.etiquetaOpacity),
      filter: cfg.etiquetaShadow ? "url(#" + idSVG(cfg, "connection-glow") + ")" : ""
    }));
    const label = crearSVG("text", {
      x, y: y + cfg.etiquetaTextBaselineAdjust,
      "text-anchor": "middle",
      "font-family": cfg.fontFamily,
      "font-size": Math.max(12, cfg.fontSize - cfg.etiquetaFontDelta),
      "font-weight": "700",
      "paint-order": "stroke",
      stroke: "#020617",
      "stroke-width": "0.5",
      fill: color
    });
    label.textContent = texto;
    svg.appendChild(label);
  }

  function limpiarGrupo(grupo) {
    while (grupo && grupo.firstChild) grupo.removeChild(grupo.firstChild);
  }

  function claveConexion(idx) {
    return "conexion-" + idx;
  }

  function crearEstadoConexiones(capa, diagrama) {
    limpiarGrupo(capa);
    const estado = {
      capa,
      grupos: new Map(),
      indicesPorNodo: new Map()
    };
    (diagrama.conexiones || []).forEach((conexion, idx) => {
      const clave = claveConexion(idx);
      const grupo = crearSVG("g", {
        class: "flujomate-conexion-grupo",
        "data-key": clave,
        "data-desde": conexion.desde,
        "data-hacia": conexion.hacia
      });
      estado.grupos.set(clave, grupo);
      capa.appendChild(grupo);

      [conexion.desde, conexion.hacia].forEach(idNodo => {
        if (!estado.indicesPorNodo.has(idNodo)) estado.indicesPorNodo.set(idNodo, []);
        estado.indicesPorNodo.get(idNodo).push(idx);
      });
    });
    return estado;
  }

  function renderizarConexionPorIndice(estado, diagrama, layout, cfg, idx, rutasOcupadas, opciones) {
    const conexion = diagrama.conexiones[idx];
    if (!conexion || !estado) return;
    const grupo = estado.grupos.get(claveConexion(idx));
    if (!grupo) return;
    limpiarGrupo(grupo);
    const desde = layout.posiciones.get(conexion.desde);
    const hacia = layout.posiciones.get(conexion.hacia);
    if (!desde || !hacia) return;
    dibujarConexion(grupo, conexion, desde, hacia, cfg, layout, diagrama, rutasOcupadas || [], opciones || {});
  }

  function renderizarConexiones(capa, diagrama, layout, cfg, estado, opciones) {
    const estadoFinal = estado || crearEstadoConexiones(capa, diagrama);
    const rutasOcupadas = [];
    (diagrama.conexiones || []).forEach((c, idx) => {
      renderizarConexionPorIndice(estadoFinal, diagrama, layout, cfg, idx, rutasOcupadas, opciones);
    });
    return estadoFinal;
  }

  function actualizarConexionesDeNodo(estado, idNodo, diagrama, layout, cfg, opciones) {
    if (!estado || !idNodo) return;
    const indices = estado.indicesPorNodo.get(idNodo) || [];
    indices.forEach(idx => {
      renderizarConexionPorIndice(estado, diagrama, layout, cfg, idx, [], opciones || {});
    });
  }

  function renderizarNodos(capa, diagrama, layout, cfg) {
    limpiarGrupo(capa);
    diagrama.nodos.forEach(nodo => {
      const pos = layout.posiciones.get(nodo.id);
      if (!pos) return;
      dibujarNodo(capa, nodo, pos, cfg);
    });
  }

  function clonarPosiciones(posiciones) {
    const copia = new Map();
    posiciones.forEach((pos, id) => copia.set(id, Object.assign({}, pos)));
    return copia;
  }

  function restaurarPosiciones(destino, origen, diagrama) {
    origen.forEach((posOriginal, id) => {
      const actual = destino.get(id);
      if (!actual) return;
      Object.assign(actual, posOriginal);
      const nodo = diagrama.getNodo(id);
      if (nodo) {
        nodo.x = actual.x;
        nodo.y = actual.y;
      }
    });
  }

  function resaltarConexionesNodo(capaConexiones, idNodo, cfg) {
    if (!capaConexiones || !idNodo) return;
    capaConexiones.querySelectorAll(".flujomate-conexion").forEach(path => {
      const conectado = path.getAttribute("data-desde") === idNodo || path.getAttribute("data-hacia") === idNodo;
      path.classList.toggle("flujomate-conexion-activa", conectado);
      path.classList.toggle("flujomate-conexion-atenuada", !conectado);
      path.setAttribute("stroke-width", conectado ? cfg.conexionWidth + cfg.conexionHoverWidthExtra : cfg.conexionWidth);
      path.setAttribute("opacity", conectado ? cfg.conexionHoverOpacity : cfg.conexionOpacity);
    });
  }

  function limpiarResaltadoConexiones(capaConexiones, cfg) {
    if (!capaConexiones) return;
    capaConexiones.querySelectorAll(".flujomate-conexion").forEach(path => {
      path.classList.remove("flujomate-conexion-activa", "flujomate-conexion-atenuada");
      path.setAttribute("stroke-width", cfg.conexionWidth);
      path.setAttribute("opacity", String(cfg.conexionOpacity));
    });
  }

  function habilitarHoverNodos(capaNodos, capaConexiones, cfg) {
    capaNodos.querySelectorAll(".flujomate-nodo").forEach(grupo => {
      grupo.addEventListener("pointerenter", function () {
        resaltarConexionesNodo(capaConexiones, grupo.getAttribute("data-id"), cfg);
      });
      grupo.addEventListener("pointerleave", function () {
        limpiarResaltadoConexiones(capaConexiones, cfg);
      });
    });
  }

  function calcularBoundsContenido(layout, padding) {
    const pad = padding || 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    layout.posiciones.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });
    if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 };
    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(1, maxX - minX + pad * 2),
      height: Math.max(1, maxY - minY + pad * 2)
    };
  }

  function aplicarCamara(svg, camara) {
    svg.setAttribute("viewBox", [camara.x, camara.y, camara.width, camara.height].join(" "));
  }

  function crearCamaraInicial(svg, layout, cfg) {
    const bounds = calcularBoundsContenido(layout, cfg.viewportPadding);
    const aspect = cfg.viewportAncho / cfg.viewportAlto;
    let width = bounds.width;
    let height = bounds.height;
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    const camara = {
      x: bounds.x + bounds.width / 2 - width / 2,
      y: bounds.y + bounds.height / 2 - height / 2,
      width,
      height,
      baseWidth: width
    };
    aplicarCamara(svg, camara);
    return camara;
  }

  function enfocarContenido(svg, layout, cfg, camara) {
    const bounds = calcularBoundsContenido(layout, cfg.viewportPadding);
    enfocarBounds(svg, cfg, camara, bounds);
  }

  function enfocarBounds(svg, cfg, camara, bounds) {
    const aspect = cfg.viewportAncho / cfg.viewportAlto;
    let width = bounds.width;
    let height = bounds.height;
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    camara.x = bounds.x + bounds.width / 2 - width / 2;
    camara.y = bounds.y + bounds.height / 2 - height / 2;
    camara.width = width;
    camara.height = height;
    camara.baseWidth = width;
    aplicarCamara(svg, camara);
  }

  function enfocarElementoSVG(svg, elemento, cfg, camara) {
    if (!elemento || typeof elemento.getBBox !== "function") {
      enfocarContenido(svg, { posiciones: new Map() }, cfg, camara);
      return;
    }
    let bbox;
    try { bbox = elemento.getBBox(); }
    catch (e) { bbox = null; }
    if (!bbox || !Number.isFinite(bbox.x)) return;
    enfocarBounds(svg, cfg, camara, {
      x: bbox.x - cfg.viewportPadding,
      y: bbox.y - cfg.viewportPadding,
      width: Math.max(1, bbox.width + cfg.viewportPadding * 2),
      height: Math.max(1, bbox.height + cfg.viewportPadding * 2)
    });
  }

  function zoomCamara(svg, camara, cfg, factor, centro) {
    const minWidth = camara.baseWidth / cfg.zoomMax;
    const maxWidth = camara.baseWidth / cfg.zoomMin;
    const nextWidth = Math.min(maxWidth, Math.max(minWidth, camara.width / factor));
    const nextHeight = nextWidth * (cfg.viewportAlto / cfg.viewportAncho);
    const c = centro || { x: camara.x + camara.width / 2, y: camara.y + camara.height / 2 };
    const relX = (c.x - camara.x) / camara.width;
    const relY = (c.y - camara.y) / camara.height;
    camara.x = c.x - nextWidth * relX;
    camara.y = c.y - nextHeight * relY;
    camara.width = nextWidth;
    camara.height = nextHeight;
    aplicarCamara(svg, camara);
  }

  function crearBotonControl(texto, titulo, cfg, onClick) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = texto;
      boton.title = titulo;
      boton.setAttribute("aria-label", titulo);
    boton.style.width = "36px";
    boton.style.height = "36px";
    boton.style.minWidth = texto.length > 3 ? "64px" : "36px";
    boton.style.border = "1px solid " + cfg.controlStroke;
    boton.style.background = cfg.controlFill;
    boton.style.color = cfg.controlText;
    boton.style.borderRadius = "9px";
    boton.style.font = "800 13px Inter, Segoe UI, Arial, sans-serif";
    boton.style.letterSpacing = "0";
    boton.style.cursor = "pointer";
    boton.style.textTransform = texto.length > 2 ? "uppercase" : "none";
    boton.style.boxShadow = "0 0 18px rgba(56, 189, 248, 0.20), inset 0 0 16px rgba(56, 189, 248, 0.12)";
    boton.addEventListener("mouseenter", () => {
      boton.style.background = "rgba(14, 31, 55, 0.96)";
      boton.style.boxShadow = "0 0 24px rgba(56, 189, 248, 0.34), inset 0 0 18px rgba(56, 189, 248, 0.18)";
    });
    boton.addEventListener("mouseleave", () => {
      boton.style.background = cfg.controlFill;
      boton.style.boxShadow = "0 0 18px rgba(56, 189, 248, 0.20), inset 0 0 16px rgba(56, 189, 248, 0.12)";
    });
    boton.addEventListener("click", onClick);
    return boton;
  }

  function crearMarcoGrafico(svg, layout, cfg, camara, onFit, onReset) {
    const marco = document.createElement("div");
    marco.className = "flujomate-marco";
    marco.style.position = "relative";
    marco.style.width = cfg.viewportAncho + "px";
    marco.style.maxWidth = "100%";
    marco.style.height = cfg.viewportAlto + "px";
    marco.style.margin = "0 auto";
    marco.style.border = "1px solid " + cfg.marcoStroke;
    marco.style.borderRadius = "18px";
    marco.style.overflow = "hidden";
    marco.style.background = cfg.fondoDiagrama;
    marco.style.boxShadow = cfg.marcoShadow;
    marco.appendChild(svg);

    if (cfg.controlesZoom) {
      const controles = document.createElement("div");
      controles.className = "flujomate-controles-zoom";
      controles.style.position = "absolute";
      controles.style.right = "12px";
      controles.style.top = "12px";
      controles.style.display = "flex";
      controles.style.gap = "8px";
      controles.style.zIndex = "2";
      controles.style.padding = "8px";
      controles.style.border = "1px solid rgba(125, 211, 252, 0.24)";
      controles.style.borderRadius = "14px";
      controles.style.background = "rgba(3, 7, 18, 0.42)";
      controles.style.backdropFilter = "blur(8px)";
      controles.appendChild(crearBotonControl("+", "Acercar", cfg, () => zoomCamara(svg, camara, cfg, cfg.zoomPaso)));
      controles.appendChild(crearBotonControl("-", "Alejar", cfg, () => zoomCamara(svg, camara, cfg, 1 / cfg.zoomPaso)));
      controles.appendChild(crearBotonControl("Fit", "Encajar diagrama", cfg, () => {
        if (typeof onFit === "function") onFit();
        else enfocarContenido(svg, layout, cfg, camara);
      }));
      controles.appendChild(crearBotonControl("Reset", "Resetear posiciones", cfg, () => {
        if (typeof onReset !== "function") return;
        const confirmar = window.confirm("¿Seguro que quieres resetear el diagrama? Se perderán los ajustes manuales de posición.");
        if (confirmar) onReset();
      }));
      marco.appendChild(controles);
    }

    return marco;
  }

  function habilitarZoomRueda(svg, cfg, camara) {
    svg.addEventListener("wheel", function (evento) {
      evento.preventDefault();
      const centro = puntoEventoSVG(svg, evento);
      const factor = evento.deltaY < 0 ? cfg.zoomPaso : 1 / cfg.zoomPaso;
      zoomCamara(svg, camara, cfg, factor, centro);
    }, { passive: false });
  }

  function habilitarPanFondo(svg, camara) {
    let pan = null;

    svg.addEventListener("pointerdown", function (evento) {
      if (evento.target.closest && evento.target.closest(".flujomate-nodo")) return;
      if (evento.button != null && evento.button !== 0) return;
      const p = puntoEventoSVG(svg, evento);
      pan = {
        pointerId: evento.pointerId,
        startX: p.x,
        startY: p.y,
        camX: camara.x,
        camY: camara.y
      };
      svg.setPointerCapture(evento.pointerId);
      svg.style.cursor = "move";
    });

    svg.addEventListener("pointermove", function (evento) {
      if (!pan || pan.pointerId !== evento.pointerId) return;
      const p = puntoEventoSVG(svg, evento);
      camara.x = pan.camX - (p.x - pan.startX);
      camara.y = pan.camY - (p.y - pan.startY);
      aplicarCamara(svg, camara);
    });

    function terminarPan(evento) {
      if (!pan || pan.pointerId !== evento.pointerId) return;
      pan = null;
      svg.style.cursor = "";
    }

    svg.addEventListener("pointerup", terminarPan);
    svg.addEventListener("pointercancel", terminarPan);
  }

  function pedirFrame(callback) {
    if (window.requestAnimationFrame) return window.requestAnimationFrame(callback);
    return window.setTimeout(callback, 16);
  }

  function cancelarFrame(id) {
    if (id == null) return;
    if (window.cancelAnimationFrame) window.cancelAnimationFrame(id);
    else window.clearTimeout(id);
  }

  function puntoEventoSVG(svg, evento) {
    const pt = svg.createSVGPoint();
    pt.x = evento.clientX;
    pt.y = evento.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function habilitarArrastreNodos(svg, capaNodos, capaConexiones, estadoConexiones, diagrama, layout, cfg) {
    if (!cfg.interactivoMover) return;

    let drag = null;
    const estiloUsuarioOriginal = document.body ? document.body.style.userSelect : "";

    function actualizarArrastreDesdeEvento(evento) {
      if (!drag || drag.pointerId !== evento.pointerId) return;
      const pos = layout.posiciones.get(drag.id);
      const nodo = diagrama.getNodo(drag.id);
      if (!pos || !nodo) return;

      evento.preventDefault();
      evento.stopPropagation();
      const p = puntoEventoSVG(svg, evento);
      const dx = p.x - drag.startMouseX;
      const dy = p.y - drag.startMouseY;

      pos.x = drag.startX + dx;
      pos.y = drag.startY + dy;
      nodo.x = pos.x;
      nodo.y = pos.y;
      drag.grupo.setAttribute("transform", "translate(" + dx + " " + dy + ")");
      programarActualizacionArrastre();
    }

    function removerSeguimientoGlobal() {
      window.removeEventListener("pointermove", actualizarArrastreDesdeEvento, true);
      window.removeEventListener("pointerup", finalizarArrastre, true);
      window.removeEventListener("pointercancel", finalizarArrastre, true);
      window.removeEventListener("blur", finalizarArrastre, true);
      if (document.body) document.body.style.userSelect = estiloUsuarioOriginal;
      svg.style.cursor = "";
    }

    function instalarSeguimientoGlobal() {
      window.addEventListener("pointermove", actualizarArrastreDesdeEvento, true);
      window.addEventListener("pointerup", finalizarArrastre, true);
      window.addEventListener("pointercancel", finalizarArrastre, true);
      window.addEventListener("blur", finalizarArrastre, true);
      if (document.body) document.body.style.userSelect = "none";
      svg.style.cursor = cfg.cursorMoviendo;
    }

    function finalizarArrastre() {
      if (!drag) return;
      removerSeguimientoGlobal();
      cancelarFrame(drag.frameId);
      if (drag.grupo) {
        drag.grupo.removeAttribute("transform");
        drag.grupo.style.cursor = cfg.cursorMover;
        try { drag.grupo.releasePointerCapture(drag.pointerId); } catch (e) {}
      }
      try { svg.releasePointerCapture(drag.pointerId); } catch (e) {}
      limpiarResaltadoConexiones(capaConexiones, cfg);
      renderizarConexiones(capaConexiones, diagrama, layout, cfg, estadoConexiones);
      renderizarNodos(capaNodos, diagrama, layout, cfg);
      habilitarArrastreNodos(svg, capaNodos, capaConexiones, estadoConexiones, diagrama, layout, cfg);
      habilitarHoverNodos(capaNodos, capaConexiones, cfg);
      drag = null;
    }

    function programarActualizacionArrastre() {
      if (!drag || drag.frameId != null) return;
      drag.frameId = pedirFrame(function () {
        if (!drag) return;
        drag.frameId = null;
        actualizarConexionesDeNodo(
          estadoConexiones,
          drag.id,
          diagrama,
          layout,
          cfg,
          { arrastreLigero: cfg.arrastreRutasLigeras }
        );
        resaltarConexionesNodo(capaConexiones, drag.id, cfg);
      });
    }

    capaNodos.querySelectorAll(".flujomate-nodo").forEach(grupo => {
      grupo.style.cursor = cfg.cursorMover;
      grupo.style.touchAction = "none";

      grupo.addEventListener("pointerdown", function (evento) {
        const id = grupo.getAttribute("data-id");
        const pos = layout.posiciones.get(id);
        if (!id || !pos) return;

        evento.preventDefault();
        evento.stopPropagation();
        try { grupo.setPointerCapture(evento.pointerId); } catch (e) {}
        try { svg.setPointerCapture(evento.pointerId); } catch (e) {}
        capaNodos.appendChild(grupo);

        const p = puntoEventoSVG(svg, evento);
        drag = {
          id,
          grupo,
          pointerId: evento.pointerId,
          startMouseX: p.x,
          startMouseY: p.y,
          startX: pos.x,
          startY: pos.y,
          frameId: null
        };
        grupo.style.cursor = cfg.cursorMoviendo;
        instalarSeguimientoGlobal();
        resaltarConexionesNodo(capaConexiones, id, cfg);
      });

      grupo.addEventListener("pointermove", function (evento) {
        if (!drag || drag.grupo !== grupo || drag.pointerId !== evento.pointerId) return;
        actualizarArrastreDesdeEvento(evento);
      });

      grupo.addEventListener("pointerup", finalizarArrastre);
      grupo.addEventListener("pointercancel", finalizarArrastre);
    });
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

function mejorCandidatoValido(
  candidatos,
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
) {
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
      const score = largo + giros * 20;

      if (score < mejorScore) {
        mejorScore = score;
        mejor = rutaFinal;
      }
    }
  }

  return mejor;
}

function elegirRutaCompletaSinChoque(
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
) {
  const candidatos3 = generarCandidatos3Tramos(a2, b2, cfg);
  const ruta3 = mejorCandidatoValido(
    candidatos3,
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
  if (ruta3) return ruta3;

  const candidatos4 = generarCandidatos4Tramos(a2, b2, cfg);
  const ruta4 = mejorCandidatoValido(
    candidatos4,
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
  if (ruta4) return ruta4;

  const candidatos5 = generarCandidatos5Tramos(a2, b2, cfg);
  const ruta5 = mejorCandidatoValido(
    candidatos5,
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

function elegirRutaArrastreLigera(a, a2, b2, b, nodoDesde, nodoHacia) {
  const inicio = nodoDesde?.tipo === "decision" ? clonarPunto(a2) : clonarPunto(a);
  const fin = nodoHacia?.tipo === "decision" ? clonarPunto(b2) : clonarPunto(b);
  const dx = Math.abs(fin.x - inicio.x);
  const dy = Math.abs(fin.y - inicio.y);
  const centroX = (inicio.x + fin.x) / 2;
  const centroY = (inicio.y + fin.y) / 2;
  const puntos = [clonarPunto(a)];

  if (nodoDesde?.tipo === "decision") puntos.push(clonarPunto(a2));
  if (dx > dy) {
    puntos.push({ x: centroX, y: inicio.y });
    puntos.push({ x: centroX, y: fin.y });
  } else {
    puntos.push({ x: inicio.x, y: centroY });
    puntos.push({ x: fin.x, y: centroY });
  }
  if (nodoHacia?.tipo === "decision") puntos.push(clonarPunto(b2));
  puntos.push(clonarPunto(b));

  return simplificarRuta(puntos);
}



function dibujarConexion(svg, conexion, posDesde, posHacia, cfg, layout, diagrama, rutasOcupadas, opciones) {
  if (!svg || !conexion || !posDesde || !posHacia) return;

  const semantica = conexion.semantica || "flujo";
  const estilo = conexion.estilo || "solida";
  const etiqueta = conexion.etiqueta || "";
  const color = COLORES_CONEXION[semantica] || "#666";
  const arrastreLigero = !!(opciones && opciones.arrastreLigero);

  const nodoDesde = diagrama ? diagrama.getNodo(conexion.desde) : null;
  const nodoHacia = diagrama ? diagrama.getNodo(conexion.hacia) : null;

  const a = puntoSalida(posDesde, nodoDesde, posHacia, conexion);
  const b = puntoEntrada(posHacia, nodoHacia, posDesde, conexion);

  const a2 = nodoDesde?.tipo === "decision"
    ? escapeDiagonalRombo(a, posHacia, cfg)
    : a;

  const b2 = nodoHacia?.tipo === "decision"
    ? escapeDiagonalRombo(b, posDesde, cfg)
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

  } else if (semantica === "anotacion" || semantica === "referencia") {
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

    registrarRutaOcupada(segmentosDeRuta(puntos), rutasOcupadas);

  } else {
    const rutaFinal = arrastreLigero
      ? elegirRutaArrastreLigera(a, a2, b2, b, nodoDesde, nodoHacia)
      : elegirRutaCompletaSinChoque(
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
    if (!arrastreLigero) registrarRutaOcupada(segs, rutasOcupadas);

    if (rutaFinal.length >= 3) {
      const mid = rutaFinal[Math.floor(rutaFinal.length / 2)];
      etiquetaX = mid.x;
      etiquetaY = mid.y - cfg.etiquetaOffsetY;
    }
  }

  const pathConexion = crearSVG("path", {
    class: "flujomate-conexion",
    "data-desde": conexion.desde,
    "data-hacia": conexion.hacia,
    "data-semantica": semantica,
    d: d,
    fill: "none",
    stroke: color,
    "stroke-width": cfg.conexionWidth,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    opacity: String(cfg.conexionOpacity),
    filter: cfg.brilloConexiones ? "url(#" + idSVG(cfg, "connection-glow") + ")" : "",
    "stroke-dasharray":
      (semantica === "anotacion" ||
       semantica === "referencia" ||
       estilo === "punteada") ? "6 4" : "",
    "marker-end": markerPorColor(color, cfg)
  });
  pathConexion.style.setProperty("--flujomate-conexion-width", String(cfg.conexionWidth));
  svg.appendChild(pathConexion);

  if (etiqueta) {
    dibujarEtiquetaConexion(svg, etiquetaX, etiquetaY, etiqueta, color, cfg);
  }
}

  function leerJSONDesdeContenedor(el) {
    const dataJson = el.getAttribute("data-json");
    if (dataJson) {
      try { return JSON.parse(dataJson); }
      catch (e) { console.error("flujomate: JSON inválido en data-json", e); }
    }
    const script = el.querySelector('script[type="application/json"]');
    if (script) {
      try { return JSON.parse(script.textContent); }
      catch (e) { console.error("flujomate: JSON inválido en <script>", e); }
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
      anchoNodo: "anchoNodo",
      altoNodo: "altoNodo",
      anchoDecision: "anchoDecision",
      altoDecision: "altoDecision",
      anchoNota: "anchoNota",
      altoNota: "altoNota",
      ajustarNodoFinalAbajo: "ajustarNodoFinalAbajo",
      centrarNodoFinal: "centrarNodoFinal",
      distanciaExtraNodoFinal: "distanciaExtraNodoFinal",
      romboDiagonalSalida: "romboDiagonalSalida",
      conexionRutaIntentos: "conexionRutaIntentos",
      conexionPasoAlternativo: "conexionPasoAlternativo",
      conexionMargenNodo: "conexionMargenNodo",
      conexionWidth: "conexionWidth",
      conexionOpacity: "conexionOpacity",
      brilloConexiones: "brilloConexiones",
      conexionSeparacionMin: "conexionSeparacionMin",
      conexionZonaLibreFlecha: "conexionZonaLibreFlecha",
      conexionOffset: "conexionOffset",
      lateralGap: "lateralGap",
      lateralSeparacionVertical: "lateralSeparacionVertical",
      lateralBusquedaIntentos: "lateralBusquedaIntentos",
      lateralCodo: "lateralCodo",
      separacionHorizontal: "separacionHorizontal",
      separacionVertical: "separacionVertical",
      margenX: "margenX",
      margenY: "margenY",
      maxCharsNodo: "maxCharsNodo",
      maxCharsDecision: "maxCharsDecision",
      interactivoMover: "interactivoMover",
      viewportAncho: "viewportAncho",
      viewportAlto: "viewportAlto",
      viewportPadding: "viewportPadding",
      zoomMin: "zoomMin",
      zoomMax: "zoomMax",
      zoomPaso: "zoomPaso",
      controlesZoom: "controlesZoom",
      arrastreRutasLigeras: "arrastreRutasLigeras",
      fondoPatronOpacity: "fondoPatronOpacity"
    };
    const opciones = {};
    Object.keys(mapa).forEach(function (claveDataset) {
      if (el.dataset[claveDataset] != null) opciones[mapa[claveDataset]] = convertirValorData(el.dataset[claveDataset]);
    });
    return opciones;
  }

  function renderizarFlujoEnContenedor(contenedor, data, opciones) {
    if (!contenedor) return null;
    contenedor.innerHTML = "";
    if (!data || !Array.isArray(data.nodos)) {
      contenedor.textContent = "flujomate: data inválida o sin nodos.";
      return null;
    }
    const cfg = Object.assign({}, CONFIG_DEFAULT, opciones || {});
    cfg._uid = "r" + (++instanciaRender);
    const diagrama = FlujoDiagrama.desdeJSON(data, cfg);
    if (!diagrama.raiz) {
      contenedor.textContent = "flujomate: no se encontró nodo raíz.";
      return null;
    }
    const layout = new FlujoLayout(diagrama).calcular();
    if (!layout || !layout.posiciones || layout.posiciones.size === 0) {
      contenedor.textContent = "flujomate: el layout no generó posiciones.";
      return null;
    }
    const posicionesIniciales = clonarPosiciones(layout.posiciones);
    if (data.titulo) {
      const titulo = document.createElement("div");
      titulo.className = "flujomate-titulo";
      titulo.textContent = data.titulo;
      titulo.style.fontFamily = cfg.fontFamily;
      titulo.style.fontSize = "22px";
      titulo.style.fontWeight = "800";
      titulo.style.color = cfg.tituloColor;
      titulo.style.letterSpacing = "0";
      titulo.style.margin = "0 auto 14px";
      titulo.style.maxWidth = cfg.viewportAncho + "px";
      titulo.style.lineHeight = "1.2";
      titulo.style.padding = "8px 12px";
      titulo.style.borderLeft = "5px solid " + cfg.tituloSubrayado;
      titulo.style.background = "linear-gradient(90deg, rgba(56, 189, 248, 0.14), rgba(124, 58, 237, 0.04))";
      titulo.style.borderRadius = "12px";
      titulo.style.textShadow = "0 0 18px rgba(56, 189, 248, 0.36)";
      contenedor.appendChild(titulo);
    }
    const svg = crearSVG("svg", {
      width: cfg.viewportAncho,
      height: cfg.viewportAlto,
      role: "img",
      "aria-label": data.titulo || "Diagrama de flujo matemático"
    });
    const camara = crearCamaraInicial(svg, layout, cfg);
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "hidden";
    svg.style.userSelect = "none";
    svg.style.webkitUserSelect = "none";
    definirMarcadores(svg, cfg);
    dibujarFondoSVG(svg, layout.width, layout.height, cfg);
    const capaContenido = crearSVG("g", { class: "flujomate-capa-contenido" });
    const capaConexiones = crearSVG("g", { class: "flujomate-capa-conexiones" });
    const capaNodos = crearSVG("g", { class: "flujomate-capa-nodos" });
    capaContenido.appendChild(capaConexiones);
    capaContenido.appendChild(capaNodos);
    svg.appendChild(capaContenido);
    const estadoConexiones = crearEstadoConexiones(capaConexiones, diagrama);
    renderizarConexiones(capaConexiones, diagrama, layout, cfg, estadoConexiones);
    renderizarNodos(capaNodos, diagrama, layout, cfg);
    habilitarArrastreNodos(svg, capaNodos, capaConexiones, estadoConexiones, diagrama, layout, cfg);
    habilitarHoverNodos(capaNodos, capaConexiones, cfg);
    habilitarZoomRueda(svg, cfg, camara);
    habilitarPanFondo(svg, camara);
    const enfocarTodo = () => enfocarContenido(svg, layout, cfg, camara);
    const resetearTodo = () => {
      restaurarPosiciones(layout.posiciones, posicionesIniciales, diagrama);
      limpiarResaltadoConexiones(capaConexiones, cfg);
      renderizarConexiones(capaConexiones, diagrama, layout, cfg, estadoConexiones);
      renderizarNodos(capaNodos, diagrama, layout, cfg);
      habilitarArrastreNodos(svg, capaNodos, capaConexiones, estadoConexiones, diagrama, layout, cfg);
      habilitarHoverNodos(capaNodos, capaConexiones, cfg);
      enfocarTodo();
    };
    const marco = crearMarcoGrafico(svg, layout, cfg, camara, enfocarTodo, resetearTodo);
    contenedor.appendChild(marco);
    enfocarTodo();
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise([contenedor]).catch(() => {});
    }
    return {
      svg,
      marco,
      layout,
      diagrama,
      enfocar: enfocarTodo,
      resetear: resetearTodo,
      zoom: factor => zoomCamara(svg, camara, cfg, factor),
      actualizarConexiones: () => renderizarConexiones(capaConexiones, diagrama, layout, cfg, estadoConexiones)
    };
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
    FlujoNodo,
    FlujoConexion,
    FlujoDiagrama,
    FlujoLayout,
    leerJSONDesdeContenedor,
    leerOpcionesDesdeDataset
  };

  document.addEventListener("DOMContentLoaded", function () {
    autoRenderizar(".flujomate");
  });

})(window, document);
