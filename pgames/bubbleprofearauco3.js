/* ============================================================
   BUBBLE PROFEARAUCO 2
   Relectura arcade del motor Bubble Profearauco.
   (Con Generador Procedural de Sonido - Web Audio API)
   ============================================================ */

(function () {
  "use strict";

  const PREFIJO_UI = "juegosprofearauco";
  const ANGULO_MINIMO = -Math.PI + 0.28;
  const ANGULO_MAXIMO = -0.28;
  const MAX_CATEGORIAS_POR_DEFECTO = 3;
  const ID_ESTILOS_BUBBLE2 = "juegosprofearauco-bubble2-inline";
  const PASO_GIRO_CONTROL = Math.PI / 42;
  const RETRASO_GIRO_SOSTENIDO = 220;
  const CANTIDAD_COLA_SIGUIENTES = 2;

  const CONFIG_POR_DEFECTO = {
    columnas: 8,
    filasVisibles: 12,
    filasIniciales: 4,
    tamanoBurbuja: 42,
    nivelInicial: 1,
    tema: "arauco-dark"
  };

  const PESOS_GLOBALIDAD_TABLERO = {
    1: 1.35,
    2: 0.1,
    3: 0.018
  };

  const PESOS_GLOBALIDAD_DISPARO = {
    1: 1.1,
    2: 0.18,
    3: 0.04
  };

  const TEMAS = {
    "arauco-dark": {
      fondoCanvas: "#050505",
      panelCanvas: "#091109",
      bordeCanvas: "#ff6200",
      bordeInterior: "#123d22",
      guias: "rgba(76, 175, 80, 0.18)",
      burbuja: "#35552f",
      burbujaBrillo: "#4d7a43",
      burbujaBorde: "#f5f5f5",
      textoBurbuja: "#f5f5f5",
      canon: "#ff6200",
      canonBorde: "#fce4cf",
      punteria: "rgba(255, 98, 0, 0.75)",
      lineaPeligro: "rgba(255, 98, 0, 0.45)",
      textoSecundario: "#cfe8d4"
    }
  };

  const ESTILOS_COMODIN = {
    1: {
      relleno: "#35552f",
      brillo: "#4d7a43",
      borde: "#f5f5f5",
      halo: null
    },
    2: {
      relleno: "#42703b",
      brillo: "#6db35e",
      borde: "#ecffb8",
      halo: "rgba(140, 255, 168, 0.28)"
    },
    3: {
      relleno: "#6d6b25",
      brillo: "#c1b84a",
      borde: "#ffd8a0",
      halo: "rgba(255, 170, 77, 0.34)"
    },
    4: {
      relleno: "#8f4d19",
      brillo: "#ff9a4d",
      borde: "#fff0c2",
      halo: "rgba(255, 142, 64, 0.42)"
    }
  };

  /* ============================================================
     SISTEMA DE AUDIO PROCEDURAL (WEB AUDIO API)
     ============================================================ */
  class BubbleAudio {
    constructor() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = AudioContext ? new AudioContext() : null;
      this.habilitado = false;
    }

    iniciar() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.habilitado = true;
    }

    _tocarTono(frecuenciaInicial, frecuenciaFinal, duracion, tipoOnda = 'sine', volumen = 0.1) {
      if (!this.habilitado || !this.ctx) return;

      const osc = this.ctx.createOscillator();
      const ganancia = this.ctx.createGain();

      osc.type = tipoOnda;
      osc.connect(ganancia);
      ganancia.connect(this.ctx.destination);

      const ahora = this.ctx.currentTime;
      
      ganancia.gain.setValueAtTime(0, ahora);
      ganancia.gain.linearRampToValueAtTime(volumen, ahora + duracion * 0.1);
      ganancia.gain.exponentialRampToValueAtTime(0.001, ahora + duracion);

      osc.frequency.setValueAtTime(frecuenciaInicial, ahora);
      if (frecuenciaFinal) {
        osc.frequency.exponentialRampToValueAtTime(frecuenciaFinal, ahora + duracion);
      }

      osc.start(ahora);
      osc.stop(ahora + duracion);
    }

    playDisparo() {
      this._tocarTono(200, 400, 0.15, 'triangle', 0.15);
    }

    playPop(combo = 0) {
      const baseFreq = 600 + (combo * 50); 
      this._tocarTono(baseFreq, baseFreq * 1.5, 0.08, 'sine', 0.2);
    }

    playCaida() {
      this._tocarTono(500, 100, 0.3, 'square', 0.05);
    }

    playVictoria() {
      setTimeout(() => this._tocarTono(440, 0, 0.2, 'sine', 0.2), 0);
      setTimeout(() => this._tocarTono(554, 0, 0.2, 'sine', 0.2), 150);
      setTimeout(() => this._tocarTono(659, 0, 0.4, 'sine', 0.2), 300);
    }

    playDerrota() {
      this._tocarTono(200, 50, 0.8, 'sawtooth', 0.2);
    }
  }

  function claseUI(sufijo) {
    return `${PREFIJO_UI}-${sufijo}`;
  }

  function selectorClaseUI(sufijo) {
    return `.${claseUI(sufijo)}`;
  }

  function buscarPorClase(contenedor, sufijo) {
    return contenedor.querySelector(selectorClaseUI(sufijo));
  }

  function mezclar(arreglo) {
    const copia = [...arreglo];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  function clamp(valor, minimo, maximo) {
    return Math.min(Math.max(valor, minimo), maximo);
  }

  function numeroSeguro(valor, fallback, minimo) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return fallback;
    if (typeof minimo === "number") return Math.max(numero, minimo);
    return numero;
  }

  function enteroSeguro(valor, fallback, minimo) {
    return Math.round(numeroSeguro(valor, fallback, minimo));
  }

  function arregloUnico(arreglo) {
    const vistos = new Set();
    const salida =[];
    arreglo.forEach((item) => {
      if (vistos.has(item)) return;
      vistos.add(item);
      salida.push(item);
    });
    return salida;
  }

  function claveCelda(fila, columna) {
    return `${fila}:${columna}`;
  }

  function elegirItemPonderado(items, obtenerPeso) {
    if (!Array.isArray(items) || items.length === 0) return null;

    let total = 0;
    const pesos = items.map((item, indice) => {
      const peso = Math.max(0, Number(obtenerPeso(item, indice)) || 0);
      total += peso;
      return peso;
    });

    if (total <= 0) {
      return items[Math.floor(Math.random() * items.length)] || null;
    }

    let umbral = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      umbral -= pesos[i];
      if (umbral <= 0) return items[i];
    }
    return items[items.length - 1] || null;
  }

  function obtenerEstiloComodin(cantidadCategorias) {
    return ESTILOS_COMODIN[Math.min(4, Math.max(1, cantidadCategorias || 1))];
  }

  const COMANDOS_LATEX_AMIGABLES = [
    "frac", "sqrt", "root", "sum", "prod", "int", "lim", "log", "ln",
    "sin", "cos", "tan", "cot", "sec", "csc",
    "alpha", "beta", "gamma", "delta", "epsilon", "theta", "lambda", "mu",
    "pi", "rho", "sigma", "tau", "phi", "omega",
    "leq", "geq", "neq", "cdot", "times", "div", "pm", "mp", "infty",
    "left", "right", "overline", "bar", "hat", "vec"
  ];

  const REGEX_COMANDOS_LATEX_AMIGABLES = new RegExp("(^|[^\\\\])\\b(" + COMANDOS_LATEX_AMIGABLES.join("|") + ")\\b", "g");

  function normalizarLatexAmigable(expresion) {
    return String(expresion || "")
      .trim()
      .replace(/\\\\([a-zA-Z]+)/g, "\\$1")
      .replace(REGEX_COMANDOS_LATEX_AMIGABLES, function (_coincidencia, prefijo, comando) {
        return prefijo + "\\" + comando;
      });
  }

  function convertirMarcadoresLatex(texto, reemplazarInline, reemplazarDisplay) {
    return String(texto || "")
      .replace(/\[M\]([\s\S]*?)\[\/M\]/g, function (_coincidencia, contenido) {
        return reemplazarDisplay(normalizarLatexAmigable(contenido));
      })
      .replace(/\[m\]([\s\S]*?)\[\/m\]/g, function (_coincidencia, contenido) {
        return reemplazarInline(normalizarLatexAmigable(contenido));
      })
      .replace(/\\\[([\s\S]*?)\\\]/g, function (_coincidencia, contenido) {
        return reemplazarDisplay(normalizarLatexAmigable(contenido));
      })
      .replace(/\\\(([\s\S]*?)\\\)/g, function (_coincidencia, contenido) {
        return reemplazarInline(normalizarLatexAmigable(contenido));
      });
  }

  function prepararTextoMatematico(texto) {
    return convertirMarcadoresLatex(
      texto,
      function (latex) { return "\\(" + latex + "\\)"; },
      function (latex) { return "\\[" + latex + "\\]"; }
    );
  }

  function obtenerLatexCanvas(texto) {
    const limpio = String(texto || "").trim();
    const patrones = [
      /^\[m\]([\s\S]*?)\[\/m\]$/i,
      /^\\\(([\s\S]*?)\\\)$/,
      /^\[M\]([\s\S]*?)\[\/M\]$/i,
      /^\\\[([\s\S]*?)\\\]$/
    ];
    for (let i = 0; i < patrones.length; i++) {
      const coincidencia = limpio.match(patrones[i]);
      if (coincidencia) return normalizarLatexAmigable(coincidencia[1]);
    }
    return "";
  }

  function latexAtextoPlano(latex) {
    return String(latex || "")
      .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1/$2")
      .replace(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)")
      .replace(/\\([a-zA-Z]+)/g, "$1")
      .replace(/[{}]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function limpiarTextoCanvas(texto) {
    const latex = obtenerLatexCanvas(texto);
    if (latex) return latexAtextoPlano(latex);
    return String(texto || "")
      .replace(/\[M\]|\[\/M\]|\[m\]|\[\/m\]/g, "")
      .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizarLatexDataset(valor) {
    if (typeof valor === "string") {
      return convertirMarcadoresLatex(
        valor,
        function (latex) { return "[m]" + latex + "[/m]"; },
        function (latex) { return "[M]" + latex + "[/M]"; }
      );
    }
    if (Array.isArray(valor)) return valor.map(normalizarLatexDataset);
    if (valor && typeof valor === "object") {
      Object.keys(valor).forEach((clave) => {
        valor[clave] = normalizarLatexDataset(valor[clave]);
      });
    }
    return valor;
  }

  function renderizarLatex(contenedor) {
    if (window.katex && typeof window.katex.renderToString === "function") {
      const walker = document.createTreeWalker(contenedor, NodeFilter.SHOW_TEXT, {
        acceptNode: function (nodo) {
          const padre = nodo.parentElement;
          if (!padre || padre.closest(".katex")) return NodeFilter.FILTER_REJECT;
          return /\\\(|\\\[/.test(nodo.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const nodos = [];
      while (walker.nextNode()) nodos.push(walker.currentNode);

      nodos.forEach(function (nodo) {
        const texto = nodo.nodeValue || "";
        const fragmento = document.createDocumentFragment();
        const regex = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
        let ultimoIndice = 0;
        let coincidencia;

        while ((coincidencia = regex.exec(texto))) {
          if (coincidencia.index > ultimoIndice) {
            fragmento.appendChild(document.createTextNode(texto.slice(ultimoIndice, coincidencia.index)));
          }

          const displayMode = typeof coincidencia[1] !== "undefined";
          const latex = normalizarLatexAmigable(displayMode ? coincidencia[1] : coincidencia[2]);
          const plantilla = document.createElement("template");
          plantilla.innerHTML = window.katex.renderToString(latex, {
            displayMode,
            throwOnError: false,
            output: "html"
          });
          fragmento.appendChild(plantilla.content.cloneNode(true));
          ultimoIndice = regex.lastIndex;
        }

        if (ultimoIndice < texto.length) {
          fragmento.appendChild(document.createTextNode(texto.slice(ultimoIndice)));
        }
        nodo.parentNode.replaceChild(fragmento, nodo);
      });
      return;
    }
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise([contenedor]).catch(function () {});
    }
  }

  function inyectarEstilosBubble2() {
    if (document.getElementById(ID_ESTILOS_BUBBLE2)) return;

    const style = document.createElement("style");
    style.id = ID_ESTILOS_BUBBLE2;
    style.textContent = `
      .${claseUI("app")}.${claseUI("bubble2-root")} {
        width: fit-content;
        max-width: min(1180px, calc(100% - 2rem));
        margin: 1.5rem auto;
        padding: 1.4rem;
        background: #020402;
        color: #f5f5f5;
        border: 4px solid #ff6200;
        border-radius: 22px;
        box-shadow: 0 0 22px rgba(255, 98, 0, 0.25);
        font-family: Arial, sans-serif;
        box-sizing: border-box;
      }
      .${claseUI("bubble2-root")} *,
      .${claseUI("bubble2-root")} *::before,
      .${claseUI("bubble2-root")} *::after {
        box-sizing: border-box;
      }
      .${claseUI("bubble2-root")} button {
        font: inherit;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")} {
        position: relative;
        width: 100%;
        gap: 1rem;
        padding: 1.2rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen {
        width: 100vw;
        height: 100svh;
        max-width: none;
        max-height: none;
        padding: 1rem;
        overflow: auto;
        border-radius: 0;
        box-sizing: border-box;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-header")} {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.9rem;
        flex-wrap: wrap;
        padding-right: 9.2rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-heading")} {
        display: grid;
        gap: 0;
        min-width: 0;
      }
      .${claseUI("bubble2-root")} .${claseUI("titulo")} {
        margin: 0;
        color: #4caf50;
        font-size: 1.8rem;
        font-weight: 800;
        line-height: 1.2;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-fullscreen")} {
        position: absolute;
        top: 1.2rem;
        right: 1.2rem;
        z-index: 5;
        padding: 0.42rem 0.78rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 98, 0, 0.48);
        background: rgba(8, 14, 8, 0.9);
        color: #f5f5f5;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition:
          transform 120ms ease,
          filter 120ms ease,
          border-color 120ms ease;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-fullscreen")}:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
        border-color: rgba(255, 98, 0, 0.72);
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-fullscreen")}:active {
        transform: translateY(1px);
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-subtitulo")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-marcadores")} {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        gap: 0.55rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-stage-marcadores")} {
        grid-area: marcadores;
        margin-bottom: 0;
        width: fit-content;
        max-width: 100%;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-categorias-activas")} {
        grid-area: activas;
        display: flex;
        flex-wrap: wrap;
        gap: 0.42rem;
        width: fit-content;
        max-width: 100%;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-chip")} {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.42rem 0.7rem;
        border-radius: 999px;
        border: 1px solid rgba(76, 175, 80, 0.42);
        background: rgba(10, 18, 10, 0.92);
        color: #f5f5f5;
        font-size: 0.88rem;
        font-weight: 700;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-chip")} small {
        color: #8cd996;
        font-size: 0.72rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-shell")} {
        display: grid;
        width: fit-content;
        max-width: 100%;
        grid-template-columns: max-content;
        grid-template-areas:
          "marcadores"
          "activas"
          "board";
        column-gap: 0;
        row-gap: 0.42rem;
        align-items: start;
        justify-content: start;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-stage")} {
        display: contents;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-stage-head")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-objetivo-card")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-kicker")} {
        color: #ff6200;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-objetivo-texto")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-presion")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-presion-head")} {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-presion-valor")} {
        color: #ffd4b8;
        font-size: 0.9rem;
        font-weight: 700;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-barra")} {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-barra-relleno")} {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #4caf50, #ff6200);
        transition: width 180ms ease;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-canvas-wrap")} {
        position: relative;
        width: fit-content;
        max-width: 100%;
        overflow: hidden;
        border-radius: 24px;
        background: radial-gradient(circle at top, rgba(255, 98, 0, 0.08), rgba(0, 0, 0, 0) 45%);
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-board-shell")} {
        grid-area: board;
        align-self: start;
        justify-self: start;
        display: flex;
        justify-content: center;
        width: fit-content;
        max-width: 100%;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-presion-borde")} {
        position: absolute;
        top: 10px;
        left: 18px;
        right: 18px;
        z-index: 2;
        height: 7px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.5);
        box-shadow:
          0 0 0 1px rgba(255, 98, 0, 0.36),
          0 0 18px rgba(255, 98, 0, 0.12);
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-presion-borde-relleno")} {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #4caf50 0%, #a0d24d 55%, #ff6200 100%);
        transition: width 180ms ease;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble-canvas")} {
        display: block;
        width: auto;
        max-width: 100%;
        height: auto;
        background: #050505;
        border: 3px solid #ff6200;
        border-radius: 12px;
        box-shadow: inset 0 0 0 2px rgba(18, 61, 34, 0.85);
        cursor: crosshair;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-toast")} {
        position: absolute;
        top: 0.9rem;
        left: 50%;
        z-index: 3;
        max-width: min(88%, 420px);
        padding: 0.7rem 0.95rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 98, 0, 0.28);
        background: rgba(10, 14, 10, 0.94);
        color: #f6f6f6;
        text-align: center;
        font-size: 0.9rem;
        line-height: 1.25;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
        transform: translate(-50%, -12px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease, transform 160ms ease;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-toast")}.is-visible {
        opacity: 1;
        transform: translate(-50%, 0);
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-toast")}[data-tipo="warn"] {
        border-color: rgba(255, 98, 0, 0.5);
        color: #ffd4b8;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-toast")}[data-tipo="ok"] {
        border-color: rgba(76, 175, 80, 0.55);
        color: #ddffe2;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-overlay")} {
        position: absolute;
        inset: 0;
        z-index: 4;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: linear-gradient(180deg, rgba(2, 6, 2, 0.2), rgba(2, 6, 2, 0.75));
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-overlay")}[hidden],
      .${claseUI("bubble2-root")} .${claseUI("bubble2-toast")}[hidden] {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-overlay-card")} {
        width: min(92%, 420px);
        padding: 1.15rem 1.1rem;
        border-radius: 22px;
        border: 1px solid rgba(255, 98, 0, 0.28);
        background: rgba(8, 12, 8, 0.95);
        text-align: center;
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.36);
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-overlay-card")} h3 {
        margin: 0 0 0.45rem;
        color: #ff6200;
        font-size: 1.55rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-overlay-card")} p {
        margin: 0;
        color: #f5f5f5;
        line-height: 1.4;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-chip-categoria")} {
        display: inline-flex;
        align-items: center;
        padding: 0.34rem 0.64rem;
        border-radius: 999px;
        border: 1px solid rgba(76, 175, 80, 0.35);
        background: rgba(8, 14, 8, 0.88);
        color: #f5f5f5;
        font-size: 0.8rem;
        line-height: 1.1;
        white-space: nowrap;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-sidepanel")} {
        display: none;
        grid-area: side;
      }
      .${claseUI("bubble2-root")} .${claseUI("feedback")} {
        display: none;
        margin-top: 1.2rem;
        min-height: 42px;
        padding: 0.9rem 1rem;
        background: #0b110d;
        color: #f5f5f5;
        border: 1px solid #29352c;
        border-radius: 12px;
        font-size: 1rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("bubble2-pad")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("controles")} {
        margin-top: 0.85rem;
        display: flex;
        justify-content: center;
        gap: 0.55rem;
        flex-wrap: wrap;
      }
      .${claseUI("bubble2-root")} .${claseUI("controles")} button {
        padding: 0.5rem 0.9rem;
        border: none;
        border-radius: 999px;
        background: rgba(255, 98, 0, 0.88);
        color: #111;
        font-weight: 800;
        font-size: 0.84rem;
        cursor: pointer;
        box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
      }
      .${claseUI("bubble2-root")} .${claseUI("controles")} button:hover {
        filter: brightness(1.12);
        transform: translateY(-1px);
      }
      .${claseUI("bubble2-root")} .${claseUI("controles")} button:active {
        transform: translateY(1px);
        box-shadow: none;
      }
      .${claseUI("dataset")},
      .${claseUI("bubble2-dataset")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape {
        min-height: 100svh;
        padding: 0.68rem;
        gap: 0.58rem;
        overflow: hidden;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-header")} {
        gap: 0.55rem;
        align-items: center;
        padding-right: 6.4rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("titulo")} {
        font-size: clamp(1rem, 3vw, 1.22rem);
        line-height: 1.02;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-fullscreen")} {
        top: 0.68rem;
        right: 0.68rem;
        padding: 0.28rem 0.58rem;
        font-size: 0.72rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-shell")} {
        width: 100%;
        max-width: none;
        grid-template-columns: 1fr;
        column-gap: 0;
        row-gap: 0.34rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-stage-marcadores")} {
        width: 100%;
        gap: 0.34rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-categorias-activas")} {
        width: 100%;
        gap: 0.28rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-chip")} {
        padding: 0.28rem 0.5rem;
        gap: 0.24rem;
        font-size: 0.72rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-chip")} small {
        font-size: 0.58rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-board-shell")} {
        width: 100%;
        min-width: 0;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-canvas-wrap")} {
        width: 100%;
        border-radius: 18px;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble-canvas")} {
        width: 100%;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-chip-categoria")} {
        padding: 0.22rem 0.48rem;
        font-size: 0.68rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("bubble2-toast")} {
        top: 0.58rem;
        max-width: min(74%, 260px);
        padding: 0.5rem 0.72rem;
        font-size: 0.74rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("controles")} {
        margin-top: 0.42rem;
        gap: 0.36rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-landscape .${claseUI("controles")} button {
        padding: 0.42rem 0.7rem;
        font-size: 0.74rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-mobile-portrait {
        gap: 0.8rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        overflow: hidden;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-heading")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-header")} {
        padding-right: 6.9rem;
        min-height: 0;
        gap: 0;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-shell")} {
        width: fit-content;
        height: 100%;
        max-width: 100%;
        grid-template-columns: max-content clamp(250px, 23vw, 320px);
        grid-template-areas: "board side";
        justify-content: start;
        justify-items: start;
        column-gap: clamp(0.9rem, 1.6vw, 1.4rem);
        row-gap: 0;
        align-items: stretch;
        min-height: 0;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-stage-marcadores")},
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-categorias-activas")},
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("controles")} {
        display: none;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-board-shell")} {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-canvas-wrap")} {
        width: auto;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        aspect-ratio: var(--bp-canvas-ratio, 1 / 1);
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble-canvas")} {
        width: auto;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel")} {
        grid-area: side;
        display: flex;
        flex-direction: column;
        align-self: stretch;
        justify-content: flex-start;
        gap: 1rem;
        min-width: 0;
        width: clamp(250px, 23vw, 320px);
        padding: 0.12rem 0 0.12rem 0;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel-title")} {
        color: #58c957;
        font-size: clamp(1.22rem, 2.35vw, 2rem);
        font-weight: 700;
        line-height: 1.05;
        word-break: break-word;
        max-width: 11ch;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel-title")} .MathJax {
        font-size: 1em !important;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel-stats")} {
        display: flex;
        flex-wrap: wrap;
        gap: 0.62rem 0.72rem;
        align-items: flex-start;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel-stats")} .${claseUI("bubble2-chip")} {
        min-width: 0;
        padding: 0.54rem 0.82rem;
        font-size: 0.92rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel-categorias")} {
        display: flex;
        flex-wrap: wrap;
        gap: 0.62rem 0.72rem;
        align-items: flex-start;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel-categorias")} .${claseUI("bubble2-chip-categoria")} {
        font-size: 0.9rem;
        padding: 0.48rem 0.88rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel-controles")} {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        align-items: flex-end;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-landscape .${claseUI("bubble2-sidepanel-controles")} button {
        padding: 0.58rem 0.8rem;
        border: none;
        border-radius: 999px;
        background: rgba(255, 98, 0, 0.86);
        color: #111;
        font-weight: 800;
        font-size: 0.84rem;
        cursor: pointer;
        box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
        width: min(100%, 170px);
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-header")} {
        padding-right: 6.2rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-shell")} {
        width: 100%;
        grid-template-columns: minmax(0, 1fr) 154px;
        column-gap: 0.48rem;
        align-items: stretch;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-board-shell")} {
        justify-self: stretch;
        width: 100%;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-canvas-wrap")} {
        height: 100%;
        max-width: 100%;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel")} {
        width: 154px;
        gap: 0.56rem;
        padding-top: 0;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel-title")} {
        font-size: 0.86rem;
        line-height: 0.98;
        max-width: 7.4ch;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel-stats")} {
        gap: 0.34rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel-stats")} .${claseUI("bubble2-chip")} {
        padding: 0.32rem 0.5rem;
        font-size: 0.74rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel-stats")} .${claseUI("bubble2-chip")} small {
        font-size: 0.54rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel-categorias")} {
        gap: 0.3rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel-categorias")} .${claseUI("bubble2-chip-categoria")} {
        padding: 0.28rem 0.5rem;
        font-size: 0.7rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel-controles")} {
        gap: 0.4rem;
      }
      .${claseUI("bubble2-root")} .${claseUI("panel")}.is-fullscreen.is-mobile-landscape .${claseUI("bubble2-sidepanel-controles")} button {
        width: 100%;
        padding: 0.42rem 0.58rem;
        font-size: 0.68rem;
      }
      @media (max-width: 960px) {
        .${claseUI("bubble2-root")} .${claseUI("bubble2-shell")} {
          width: 100%;
          grid-template-columns: 1fr;
          grid-template-areas:
            "marcadores"
            "activas"
            "board";
          gap: 0.85rem;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-board-shell")} {
          width: 100%;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-canvas-wrap")} {
          width: 100%;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble-canvas")} {
          width: 100%;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-categorias-activas")} {
          width: 100%;
        }
      }
      @media (max-width: 640px) {
        .${claseUI("app")}.${claseUI("bubble2-root")} {
          padding: 1rem;
          border-radius: 16px;
        }
        .${claseUI("bubble2-root")} .${claseUI("titulo")} {
          font-size: 1.45rem;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-header")} {
          padding-right: 7rem;
        }
        .${claseUI("bubble2-root")} .${claseUI("panel")} {
          padding: 1rem;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-fullscreen")} {
          padding: 0.36rem 0.66rem;
          font-size: 0.76rem;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-presion-borde")} {
          top: 8px;
          left: 14px;
          right: 14px;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-chip")} {
          font-size: 0.8rem;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-toast")} {
          top: 0.7rem;
          font-size: 0.82rem;
        }
        .${claseUI("bubble2-root")} .${claseUI("bubble2-overlay-card")} h3 {
          font-size: 1.3rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizarJSONBubble(textoOriginal) {
    let texto = String(textoOriginal || "").trim();
    try {
      return JSON.parse(texto);
    } catch (errorOriginal) {
      const reparado = texto.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      try {
        return JSON.parse(reparado);
      } catch (errorReparado) {
        errorReparado.message = "JSON invalido incluso despues de intentar reparar barras de LaTeX. " + errorReparado.message;
        throw errorReparado;
      }
    }
  }

  function obtenerNivelesNormalizados(nodo, contexto) {
    if (Array.isArray(nodo.niveles)) {
      const niveles = arregloUnico(
        nodo.niveles.map((nivel) => enteroSeguro(nivel, NaN, 1)).filter(Number.isFinite)
      );
      if (!niveles.length) throw new Error(`${contexto}: el arreglo 'niveles' no tiene valores validos.`);
      return niveles;
    }
    if (typeof nodo.nivel !== "undefined") {
      return [enteroSeguro(nodo.nivel, NaN, 1)].filter(Number.isFinite);
    }
    return [1];
  }

  function normalizarNiveles(niveles) {
    if (!Array.isArray(niveles) || niveles.length === 0) {
      throw new Error("Bubble Profearauco: el dataset debe incluir al menos un nivel.");
    }
    const ids = new Set();
    return niveles.map((nivel, indice) => {
      if (!nivel || typeof nivel !== "object") throw new Error(`Bubble Profearauco: el nivel ${indice + 1} no es valido.`);
      const id = enteroSeguro(nivel.id, indice + 1, 1);
      if (ids.has(id)) throw new Error(`Bubble Profearauco: el nivel ${id} esta repetido.`);
      ids.add(id);
      return {
        id,
        nombre: String(nivel.nombre || `Nivel ${id}`),
        descensoCadaTiros: enteroSeguro(nivel.descensoCadaTiros, 0, 0),
        maxCategorias: enteroSeguro(nivel.maxCategorias, MAX_CATEGORIAS_POR_DEFECTO, 1),
        orden: indice
      };
    });
  }

  function normalizarValores(valores) {
    if (!Array.isArray(valores) || valores.length === 0) throw new Error("Bubble Profearauco: el dataset debe incluir un arreglo 'valores'.");
    const ids = new Set();
    return valores.map((valor, indice) => {
      if (!valor || typeof valor !== "object") throw new Error(`Bubble Profearauco: el valor ${indice + 1} no es valido.`);
      const id = String(valor.id || "").trim();
      const texto = String(typeof valor.texto !== "undefined" ? valor.texto : "").trim();
      if (!id) throw new Error(`Bubble Profearauco: el valor ${indice + 1} no tiene id.`);
      if (ids.has(id)) throw new Error(`Bubble Profearauco: el valor '${id}' esta repetido.`);
      if (!texto) throw new Error(`Bubble Profearauco: el valor '${id}' no tiene texto.`);
      ids.add(id);
      return {
        id,
        texto,
        textoHTML: prepararTextoMatematico(texto),
        textoCanvas: limpiarTextoCanvas(texto),
        textoLatex: obtenerLatexCanvas(texto)
      };
    });
  }

  function normalizarCategorias(categorias) {
    if (!Array.isArray(categorias) || categorias.length === 0) throw new Error("Bubble Profearauco: el dataset debe incluir un arreglo 'categorias'.");
    const ids = new Set();
    return categorias.map((categoria, indice) => {
      if (!categoria || typeof categoria !== "object") throw new Error(`Bubble Profearauco: la categoria ${indice + 1} no es valida.`);
      const id = String(categoria.id || "").trim();
      if (!id) throw new Error(`Bubble Profearauco: la categoria ${indice + 1} no tiene id.`);
      if (ids.has(id)) throw new Error(`Bubble Profearauco: la categoria '${id}' esta repetida.`);
      ids.add(id);
      const valores = arregloUnico(
        (Array.isArray(categoria.valores) ? categoria.valores :[])
          .map((valorId) => String(valorId || "").trim())
          .filter(Boolean)
      );
      if (!valores.length) throw new Error(`Bubble Profearauco: la categoria '${id}' no tiene valores.`);
      const niveles = obtenerNivelesNormalizados(categoria, `Bubble Profearauco: la categoria '${id}'`);
      const nombre = String(categoria.nombre || id);
      return { id, nombre, nombreHTML: prepararTextoMatematico(nombre), niveles, valores };
    });
  }

  function normalizarDatasetBubble(dataset) {
    if (!dataset || typeof dataset !== "object") throw new Error("Bubble Profearauco: no se recibio dataset.");
    const normalizado = {
      titulo: String(dataset.titulo || "Bubble Profearauco"),
      config: dataset.config && typeof dataset.config === "object" ? { ...dataset.config } : {},
      niveles: normalizarNiveles(dataset.niveles),
      valores: normalizarValores(dataset.valores),
      categorias: normalizarCategorias(dataset.categorias)
    };
    const valoresIds = new Set(normalizado.valores.map((v) => v.id));
    const nivelesIds = new Set(normalizado.niveles.map((n) => n.id));

    normalizado.categorias.forEach((categoria) => {
      categoria.niveles.forEach((nivelId) => {
        if (!nivelesIds.has(nivelId)) throw new Error(`Bubble Profearauco: la categoria '${categoria.id}' referencia el nivel inexistente '${nivelId}'.`);
      });
      categoria.valores.forEach((valorId) => {
        if (!valoresIds.has(valorId)) throw new Error(`Bubble Profearauco: la categoria '${categoria.id}' referencia el valor inexistente '${valorId}'.`);
      });
    });

    normalizado.tituloHTML = prepararTextoMatematico(normalizado.titulo);
    return normalizado;
  }

  class JuegoBubbleProfearauco {
    constructor(contenedor, dataset, opciones = {}) {
      this.contenedor = contenedor;
      this.dataset = normalizarDatasetBubble(dataset);
      this.config = this.resolverConfig(opciones);
      this.tema = this.resolverTema(this.config.tema);

      this.valoresPorId = Object.create(null);
      this.categoriasPorId = Object.create(null);
      this.categoriasPorValor = Object.create(null);
      this.nivelesPorId = Object.create(null);
      this.construirIndices();

      this.audio = new BubbleAudio(); // <-- INICIALIZACIÓN DEL SISTEMA DE AUDIO

      this.canvas = null;
      this.ctx = null;
      this.elPanel = null;
      this.elCanvasWrap = null;
      this.elTiros = null;
      this.elCategorias = null;
      this.elFeedback = null;
      this.elToast = null;
      this.elOverlay = null;
      this.elOverlayTitulo = null;
      this.elOverlayTexto = null;
      this.elPresionTexto = null;
      this.elPresionBarra = null;
      this.elPuntaje = null;
      this.elNivel = null;
      this.elCategoriasTotal = null;
      this.elPuntajeSide = null;
      this.elNivelSide = null;
      this.elCategoriasTotalSide = null;
      this.elTirosSide = null;
      this.elCategoriasSide = null;
      this.botonReiniciar = null;
      this.botonReiniciarJuego = null;
      this.botonReiniciarSide = null;
      this.botonReiniciarJuegoSide = null;
      this.botonFullscreen = null;
      this.toastTimer = null;
      this.transitionTimer = null;
      this.cacheLatexCanvas = new Map();
      
      this.animacionesExplosion =[];
      this.animacionesCaida =[];
      this.animacionesImpacto =[];
      this.animacionesTexto =[];
      this.animacionesCelebracion =[];
      this.sacudida = { tiempo: 0, duracion: 0, intensidad: 0 };
      this.geometria = null;
      this.indiceNivelActual = 0;
      this.nivelActual = null;
      this.categoriasActivas =[];
      this.categoriasActivasSet = new Set();
      this.valoresActivos =[];
      this.valoresActivosSet = new Set();
      this.tablero =[];
      this.puntaje = 0;
      this.tirosNivel = 0;
      this.statsNivel = null;
      this.oportunidadDisparoActual = null;
      this.descensoAcumulado = 0;
      this.nivelResuelto = false;
      this.estaDerrotado = false;
      this.proyectilActual = null;
      this.colaSiguientes =[];
      this.animationFrameId = null;
      this.ultimoTimestamp = 0;
      
      this.punteria = { angle: -Math.PI / 2, x: 0, y: 0 };
      this.controlGiro = { direccion: 0, timer: null, pasos: 0 };
      this.touchControl = { id: null, zona: null };

      this.manejarClick = this.manejarClick.bind(this);
      this.manejarTouchStart = this.manejarTouchStart.bind(this);
      this.manejarTouchMove = this.manejarTouchMove.bind(this);
      this.manejarTouchEnd = this.manejarTouchEnd.bind(this);
      this.manejarTeclaDown = this.manejarTeclaDown.bind(this);
      this.manejarTeclaUp = this.manejarTeclaUp.bind(this);
      this.reiniciarNivel = this.reiniciarNivel.bind(this);
      this.reiniciarJuego = this.reiniciarJuego.bind(this);
      this.alternarPantallaCompleta = this.alternarPantallaCompleta.bind(this);
      this.manejarCambioFullscreen = this.manejarCambioFullscreen.bind(this);
      this.actualizarModoPantalla = this.actualizarModoPantalla.bind(this);
      this.tick = this.tick.bind(this);
    }

    resolverConfig(opciones) {
      const base = { ...CONFIG_POR_DEFECTO, ...this.dataset.config, ...opciones };
      const filasVisibles = enteroSeguro(base.filasVisibles, CONFIG_POR_DEFECTO.filasVisibles, 6);
      return {
        columnas: enteroSeguro(base.columnas, CONFIG_POR_DEFECTO.columnas, 5),
        filasVisibles,
        filasIniciales: clamp(enteroSeguro(base.filasIniciales, CONFIG_POR_DEFECTO.filasIniciales, 1), 1, filasVisibles),
        tamanoBurbuja: enteroSeguro(base.tamanoBurbuja, CONFIG_POR_DEFECTO.tamanoBurbuja, 26),
        nivelInicial: enteroSeguro(base.nivelInicial, CONFIG_POR_DEFECTO.nivelInicial, 1),
        tema: typeof base.tema === "string" ? base.tema : CONFIG_POR_DEFECTO.tema
      };
    }

    construirIndices() {
      this.dataset.valores.forEach((valor) => { this.valoresPorId[valor.id] = valor; });
      this.dataset.niveles.forEach((nivel) => { this.nivelesPorId[nivel.id] = nivel; });
      this.dataset.categorias.forEach((categoria) => {
        this.categoriasPorId[categoria.id] = categoria;
        categoria.valores.forEach((valorId) => {
          if (!this.categoriasPorValor[valorId]) this.categoriasPorValor[valorId] = [];
          this.categoriasPorValor[valorId].push(categoria.id);
        });
      });
    }

    resolverTema(tema) {
      if (typeof tema === "string") return TEMAS[tema] || TEMAS["arauco-dark"];
      return { ...TEMAS["arauco-dark"], ...tema };
    }

    iniciar() {
      inyectarEstilosBubble2();
      this.construirInterfaz();
      this.registrarEventos();
      document.addEventListener("fullscreenchange", this.manejarCambioFullscreen);
      window.addEventListener("resize", this.actualizarModoPantalla);
      window.addEventListener("orientationchange", this.actualizarModoPantalla);
      this.iniciarNivelPorId(this.config.nivelInicial);
      this.actualizarModoPantalla();
      this.comenzarLoop();
      return this;
    }

    destruir() {
      this.detenerLoop();
      this.desregistrarEventos();
      document.removeEventListener("fullscreenchange", this.manejarCambioFullscreen);
      window.removeEventListener("resize", this.actualizarModoPantalla);
      window.removeEventListener("orientationchange", this.actualizarModoPantalla);
      if (this.toastTimer) { window.clearTimeout(this.toastTimer); this.toastTimer = null; }
      if (this.transitionTimer) { window.clearTimeout(this.transitionTimer); this.transitionTimer = null; }
      this.contenedor.innerHTML = "";
    }

    async alternarPantallaCompleta() {
      if (!this.elPanel || !document.fullscreenEnabled) return;
      try {
        if (document.fullscreenElement === this.elPanel) {
          await document.exitFullscreen();
          return;
        }
        if (!document.fullscreenElement) {
          await this.elPanel.requestFullscreen();
        }
      } catch (error) {
        console.error("Bubble 2 fullscreen:", error);
      }
    }

    manejarCambioFullscreen() {
      const activa = document.fullscreenElement === this.elPanel;
      if (this.elPanel) this.elPanel.classList.toggle("is-fullscreen", activa);
      if (this.botonFullscreen) {
        this.botonFullscreen.textContent = activa ? "Salir pantalla completa" : "Pantalla completa";
      }
      this.actualizarModoPantalla();
    }

    actualizarModoPantalla() {
      if (!this.elPanel) return;
      const ancho = window.innerWidth || document.documentElement.clientWidth || 0;
      const alto = window.innerHeight || document.documentElement.clientHeight || 0;
      const esLandscape = ancho > alto;
      const esMovil = ("ontouchstart" in window || navigator.maxTouchPoints > 0) && Math.max(ancho, alto) <= 1100;

      this.elPanel.classList.toggle("is-landscape", esLandscape);
      this.elPanel.classList.toggle("is-portrait", !esLandscape);
      this.elPanel.classList.toggle("is-mobile-landscape", esMovil && esLandscape);
      this.elPanel.classList.toggle("is-mobile-portrait", esMovil && !esLandscape);
    }

    construirInterfaz() {
      this.contenedor.classList.add(claseUI("app"));
      this.contenedor.classList.add(claseUI("bubble2-root"));
      // Mismo HTML original
      this.contenedor.innerHTML = `
        <div class="${claseUI("panel")}">
          <div class="${claseUI("bubble2-header")}">
            <div class="${claseUI("bubble2-heading")}">
              <h2 class="${claseUI("titulo")}"></h2>
            </div>
            <button type="button" class="${claseUI("bubble2-fullscreen")}" data-bp-fullscreen>Pantalla completa</button>
          </div>
          <div class="${claseUI("bubble2-shell")}">
            <section class="${claseUI("bubble2-stage")}">
              <div class="${claseUI("bubble2-stage-marcadores")} ${claseUI("bubble2-marcadores")}">
                <span class="${claseUI("bubble2-chip")}"><small>Puntaje</small><strong data-bp-puntaje>0</strong></span>
                <span class="${claseUI("bubble2-chip")}"><small>Nivel</small><strong data-bp-nivel>-</strong></span>
                <span class="${claseUI("bubble2-chip")}"><small>Categorias</small><strong data-bp-categorias-total>0</strong></span>
                <span class="${claseUI("bubble2-chip")}"><small>Tiros</small><strong data-bp-tiros>0</strong></span>
              </div>
              <div class="${claseUI("bubble2-categorias-activas")}" data-bp-categorias></div>
              <div class="${claseUI("bubble-tablero")} ${claseUI("bubble2-board-shell")}">
                <div class="${claseUI("bubble2-canvas-wrap")}">
                  <div class="${claseUI("bubble2-presion-borde")}" aria-hidden="true">
                    <div class="${claseUI("bubble2-presion-borde-relleno")}" data-bp-presion-barra></div>
                  </div>
                  <canvas class="${claseUI("bubble-canvas")}" data-bp-canvas></canvas>
                  <div class="${claseUI("bubble2-toast")}" data-bp-toast hidden></div>
                  <div class="${claseUI("bubble2-overlay")}" data-bp-overlay hidden>
                    <div class="${claseUI("bubble2-overlay-card")}">
                      <h3 data-bp-overlay-titulo></h3>
                      <p data-bp-overlay-texto></p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <aside class="${claseUI("bubble2-sidepanel")}">
              <div class="${claseUI("bubble2-sidepanel-title")}"></div>
              <div class="${claseUI("bubble2-sidepanel-stats")}">
                <span class="${claseUI("bubble2-chip")}"><small>Nivel</small><strong data-bp-side-nivel>-</strong></span>
                <span class="${claseUI("bubble2-chip")}"><small>Puntaje</small><strong data-bp-side-puntaje>0</strong></span>
                <span class="${claseUI("bubble2-chip")}"><small>Tiros</small><strong data-bp-side-tiros>0</strong></span>
                <span class="${claseUI("bubble2-chip")}"><small>Categorias</small><strong data-bp-side-categorias-total>0</strong></span>
              </div>
              <div class="${claseUI("bubble2-sidepanel-categorias")}" data-bp-side-categorias></div>
              <div class="${claseUI("bubble2-sidepanel-controles")}">
                <button type="button" data-bp-side-reiniciar>Reiniciar nivel</button>
                <button type="button" data-bp-side-reiniciar-juego>Reiniciar juego</button>
              </div>
            </aside>
          </div>
          <div class="${claseUI("feedback")}" data-bp-feedback></div>
          <div class="${claseUI("bubble2-pad")}">
            <button type="button" class="${claseUI("bubble2-pad-boton")}" data-bp-giro-izquierda aria-label="Girar a la izquierda">←</button>
            <button type="button" class="${claseUI("bubble2-pad-boton")}" data-accion="disparo" data-bp-disparo aria-label="Disparar burbuja">↑</button>
            <button type="button" class="${claseUI("bubble2-pad-boton")}" data-bp-giro-derecha aria-label="Girar a la derecha">→</button>
          </div>
          <div class="${claseUI("controles")}">
            <button type="button" data-bp-reiniciar>Reiniciar nivel</button>
            <button type="button" data-bp-reiniciar-juego>Reiniciar juego</button>
          </div>
        </div>
      `;

      buscarPorClase(this.contenedor, "titulo").innerHTML = this.dataset.tituloHTML;
      const sideTitle = buscarPorClase(this.contenedor, "bubble2-sidepanel-title");
      if (sideTitle) {
        sideTitle.innerHTML = this.dataset.tituloHTML.replace(/^\s*Bubble\s+Profearauco:\s*/i, "Bubble: ");
      }

      this.elPanel = this.contenedor.querySelector(selectorClaseUI("panel"));
      this.elCanvasWrap = this.contenedor.querySelector(selectorClaseUI("bubble2-canvas-wrap"));
      this.canvas = this.contenedor.querySelector("[data-bp-canvas]");
      this.ctx = this.canvas.getContext("2d");
      this.elTiros = this.contenedor.querySelector("[data-bp-tiros]");
      this.elCategorias = this.contenedor.querySelector("[data-bp-categorias]");
      this.elFeedback = this.contenedor.querySelector("[data-bp-feedback]");
      this.elToast = this.contenedor.querySelector("[data-bp-toast]");
      this.elOverlay = this.contenedor.querySelector("[data-bp-overlay]");
      this.elOverlayTitulo = this.contenedor.querySelector("[data-bp-overlay-titulo]");
      this.elOverlayTexto = this.contenedor.querySelector("[data-bp-overlay-texto]");
      this.elPresionBarra = this.contenedor.querySelector("[data-bp-presion-barra]");
      this.elPuntaje = this.contenedor.querySelector("[data-bp-puntaje]");
      this.elNivel = this.contenedor.querySelector("[data-bp-nivel]");
      this.elCategoriasTotal = this.contenedor.querySelector("[data-bp-categorias-total]");
      this.elPuntajeSide = this.contenedor.querySelector("[data-bp-side-puntaje]");
      this.elNivelSide = this.contenedor.querySelector("[data-bp-side-nivel]");
      this.elCategoriasTotalSide = this.contenedor.querySelector("[data-bp-side-categorias-total]");
      this.elTirosSide = this.contenedor.querySelector("[data-bp-side-tiros]");
      this.elCategoriasSide = this.contenedor.querySelector("[data-bp-side-categorias]");
      this.botonGiroIzquierda = this.contenedor.querySelector("[data-bp-giro-izquierda]");
      this.botonDisparo = this.contenedor.querySelector("[data-bp-disparo]");
      this.botonGiroDerecha = this.contenedor.querySelector("[data-bp-giro-derecha]");
      this.botonReiniciar = this.contenedor.querySelector("[data-bp-reiniciar]");
      this.botonReiniciarJuego = this.contenedor.querySelector("[data-bp-reiniciar-juego]");
      this.botonReiniciarSide = this.contenedor.querySelector("[data-bp-side-reiniciar]");
      this.botonReiniciarJuegoSide = this.contenedor.querySelector("[data-bp-side-reiniciar-juego]");
      this.botonFullscreen = this.contenedor.querySelector("[data-bp-fullscreen]");

      this.calcularGeometria();

      this.botonReiniciar.addEventListener("click", this.reiniciarNivel);
      this.botonReiniciarJuego.addEventListener("click", this.reiniciarJuego);
      if (this.botonReiniciarSide) this.botonReiniciarSide.addEventListener("click", this.reiniciarNivel);
      if (this.botonReiniciarJuegoSide) this.botonReiniciarJuegoSide.addEventListener("click", this.reiniciarJuego);
      if (this.botonFullscreen) this.botonFullscreen.addEventListener("click", this.alternarPantallaCompleta);
      this.manejarCambioFullscreen();
      renderizarLatex(this.contenedor);
    }

    calcularGeometria() {
      const radio = this.config.tamanoBurbuja / 2;
      const diametro = this.config.tamanoBurbuja;
      const pasoVertical = radio * Math.sqrt(3);
      const padding = radio + 18;
      const anchoBurbujeo = diametro * this.config.columnas + radio;
      const altoBurbujeo = diametro + (this.config.filasVisibles - 1) * pasoVertical;
      const altoCanon = diametro * 2.8;
      const anchoCanvas = Math.ceil(anchoBurbujeo + padding * 2);
      const altoCanvas = Math.ceil(padding + altoBurbujeo + altoCanon);

      this.canvas.width = anchoCanvas;
      this.canvas.height = altoCanvas;
      if (this.elPanel) {
        this.elPanel.style.setProperty("--bp-canvas-ratio", `${anchoCanvas} / ${altoCanvas}`);
      }

      this.geometria = {
        radio,
        diametro,
        pasoVertical,
        padding,
        origenX: padding,
        origenY: padding,
        anchoBurbujeo,
        altoBurbujeo,
        centroCanon: { x: anchoCanvas / 2, y: padding + altoBurbujeo + radio * 1.45 },
        lineaPeligroY: padding + altoBurbujeo - diametro * 0.2
      };

      this.punteria.angle = -Math.PI / 2;
      this.sincronizarPunteriaDesdeAngulo();
    }

    sincronizarPunteriaDesdeAngulo() {
      if (!this.geometria) return;
      const largo = Math.max(90, this.config.tamanoBurbuja * 3.2);
      this.punteria.x = this.geometria.centroCanon.x + Math.cos(this.punteria.angle) * largo;
      this.punteria.y = this.geometria.centroCanon.y + Math.sin(this.punteria.angle) * largo;
    }

    registrarEventos() {
      if (!this.canvas) return;
      this.canvas.addEventListener("click", this.manejarClick);
      this.canvas.addEventListener("touchstart", this.manejarTouchStart, { passive: false });
      this.canvas.addEventListener("touchmove", this.manejarTouchMove, { passive: false });
      this.canvas.addEventListener("touchend", this.manejarTouchEnd, { passive: false });
      this.canvas.addEventListener("touchcancel", this.manejarTouchEnd, { passive: false });
      document.addEventListener("keydown", this.manejarTeclaDown);
      document.addEventListener("keyup", this.manejarTeclaUp);

      if (this.botonGiroIzquierda) this.botonGiroIzquierda.addEventListener("pointerdown", this.manejarControlIzquierdaDown.bind(this));
      if (this.botonGiroDerecha) this.botonGiroDerecha.addEventListener("pointerdown", this.manejarControlDerechaDown.bind(this));
      if (this.botonDisparo) this.botonDisparo.addEventListener("pointerdown", this.manejarControlDisparo.bind(this));

      window.addEventListener("pointerup", this.manejarControlPointerUp.bind(this));
      window.addEventListener("pointercancel", this.manejarControlPointerUp.bind(this));
    }

    desregistrarEventos() {
      if (!this.canvas) return;
      this.canvas.removeEventListener("click", this.manejarClick);
      this.canvas.removeEventListener("touchstart", this.manejarTouchStart);
      this.canvas.removeEventListener("touchmove", this.manejarTouchMove);
      this.canvas.removeEventListener("touchend", this.manejarTouchEnd);
      this.canvas.removeEventListener("touchcancel", this.manejarTouchEnd);
      document.removeEventListener("keydown", this.manejarTeclaDown);
      document.removeEventListener("keyup", this.manejarTeclaUp);
      // Faltarían bind refs de control, pero como es al destruir se asume limpieza del nodo
      this.detenerGiroSostenido();
    }

    comenzarLoop() {
      if (this.animationFrameId !== null) return;
      this.ultimoTimestamp = 0;
      this.animationFrameId = window.requestAnimationFrame(this.tick);
    }

    detenerLoop() {
      if (this.animationFrameId !== null) {
        window.cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.ultimoTimestamp = 0;
    }

    tick(timestamp) {
      if (!this.ultimoTimestamp) this.ultimoTimestamp = timestamp;
      const dt = Math.min((timestamp - this.ultimoTimestamp) / 1000, 0.05);
      this.ultimoTimestamp = timestamp;
      this.actualizar(dt);
      this.dibujar();
      this.animationFrameId = window.requestAnimationFrame(this.tick);
    }

    actualizar(dt) {
      this.actualizarAnimaciones(dt);
      if (!this.proyectilActual || !this.proyectilActual.enMovimiento) return;
      this.actualizarProyectil(dt);
    }

    actualizarAnimaciones(dt) {
      if (this.sacudida.tiempo < this.sacudida.duracion) {
        this.sacudida.tiempo += dt;
        const progreso = clamp(this.sacudida.tiempo / Math.max(0.001, this.sacudida.duracion), 0, 1);
        const fuerza = this.sacudida.intensidad * (1 - progreso);
        const ox = (Math.random() * 2 - 1) * fuerza;
        const oy = (Math.random() * 2 - 1) * fuerza;
        if (this.elCanvasWrap) this.elCanvasWrap.style.transform = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px)`;
      } else if (this.elCanvasWrap && this.elCanvasWrap.style.transform) {
        this.elCanvasWrap.style.transform = "";
      }
      if (this.animacionesExplosion.length) {
        this.animacionesExplosion = this.animacionesExplosion.filter((animacion) => {
          animacion.tiempo += dt;
          return animacion.tiempo < animacion.duracion;
        });
      }
      if (this.animacionesImpacto.length) {
        this.animacionesImpacto = this.animacionesImpacto.filter((animacion) => {
          animacion.tiempo += dt;
          return animacion.tiempo < animacion.duracion;
        });
      }
      if (this.animacionesTexto.length) {
        this.animacionesTexto = this.animacionesTexto.filter((animacion) => {
          animacion.tiempo += dt;
          animacion.y -= animacion.velocidad * dt;
          return animacion.tiempo < animacion.duracion;
        });
      }
      if (this.animacionesCelebracion.length) {
        this.animacionesCelebracion = this.animacionesCelebracion.filter((animacion) => {
          animacion.tiempo += dt;
          animacion.vy += animacion.gravedad * dt;
          animacion.x += animacion.vx * dt;
          animacion.y += animacion.vy * dt;
          animacion.rotacion += animacion.velocidadRotacion * dt;
          return animacion.tiempo < animacion.duracion;
        });
      }
      if (this.animacionesCaida.length) {
        this.animacionesCaida = this.animacionesCaida.filter((animacion) => {
          animacion.vy += animacion.gravedad * dt;
          animacion.x += animacion.vx * dt;
          animacion.y += animacion.vy * dt;
          animacion.rotacion += animacion.velocidadRotacion * dt;
          animacion.tiempo += dt;
          return animacion.y - animacion.radio < this.canvas.height + animacion.radio * 2;
        });
      }
    }

    registrarCelebracionNivel() {
      if (!this.geometria) return;
      const centro = this.geometria.centroCanon;
      const centroTablero = {
        x: this.geometria.origenX + this.geometria.anchoBurbujeo / 2,
        y: this.geometria.origenY + this.geometria.altoBurbujeo * 0.36
      };
      const colores = ["#4caf50", "#7fdc6a", "#ff6200", "#ffd36a", "#f5f5f5"];
      const total = 18;

      for (let i = 0; i < total; i++) {
        const desdeCanon = i < 11;
        const origen = desdeCanon ? centro : centroTablero;
        const anguloBase = desdeCanon ? -Math.PI / 2 : -Math.PI + (Math.PI * 2 * (i - 11)) / Math.max(1, total - 11);
        const angulo = anguloBase + (Math.random() - 0.5) * (desdeCanon ? 1.45 : 0.9);
        const velocidad = this.geometria.radio * (desdeCanon ? 11 : 8) * (0.72 + Math.random() * 0.58);
        this.animacionesCelebracion.push({
          x: origen.x,
          y: origen.y,
          vx: Math.cos(angulo) * velocidad,
          vy: Math.sin(angulo) * velocidad,
          gravedad: this.geometria.radio * (7.5 + Math.random() * 4),
          radio: this.geometria.radio * (0.18 + Math.random() * 0.22),
          color: colores[i % colores.length],
          borde: i % 3 === 0 ? "#fff4cf" : "rgba(255, 255, 255, 0.72)",
          tiempo: 0,
          duracion: 1.35 + Math.random() * 0.35,
          rotacion: Math.random() * Math.PI,
          velocidadRotacion: (Math.random() - 0.5) * 4
        });
      }

      this.registrarTextoFlotante("NIVEL LIMPIO", centroTablero.x, centroTablero.y, {
        color: "#fff2a8",
        borde: "rgba(4, 8, 4, 0.85)",
        tamano: Math.max(20, Math.floor(this.geometria.radio * 1.12)),
        duracion: 1.35,
        velocidad: 18
      });
      this.sacudir(7, 0.28);
    }

    sacudir(intensidad = 4, duracion = 0.16) {
      this.sacudida = {
        tiempo: 0,
        duracion: Math.max(0.04, duracion),
        intensidad: Math.max(this.sacudida.intensidad || 0, intensidad)
      };
    }

    registrarTextoFlotante(texto, x, y, opciones = {}) {
      if (!texto || !this.geometria) return;
      this.animacionesTexto.push({
        texto,
        x,
        y,
        tiempo: 0,
        duracion: opciones.duracion || 0.9,
        velocidad: opciones.velocidad || 34,
        color: opciones.color || "#ffe6c8",
        borde: opciones.borde || "rgba(0, 0, 0, 0.75)",
        tamano: opciones.tamano || Math.max(15, Math.floor(this.geometria.radio * 0.72))
      });
    }

    registrarImpactoBurbuja(fila, columna, acierto = false) {
      if (!this.geometria) return;
      const posicion = this.celdaAPosicion(fila, columna);
      this.animacionesImpacto.push({
        x: posicion.x,
        y: posicion.y,
        radio: this.geometria.radio,
        tiempo: 0,
        duracion: acierto ? 0.38 : 0.32,
        color: acierto ? "rgba(255, 226, 140, 0.95)" : "rgba(255, 98, 0, 0.72)",
        acierto
      });
      this.sacudir(acierto ? 6.5 : 3.5, acierto ? 0.2 : 0.16);
    }

    registrarExplosionBurbuja(burbuja, fila, columna) {
      if (!this.geometria) return;
      const posicion = this.celdaAPosicion(fila, columna);
      const radio = this.geometria.radio;
      const estilo = obtenerEstiloComodin(Array.isArray(burbuja.categorias) ? burbuja.categorias.length : 1);
      const particulas = Array.from({ length: 12 }, (_, indice) => ({
        angulo: (Math.PI * 2 * indice) / 12 + (Math.random() - 0.5) * 0.28,
        distancia: radio * (0.9 + Math.random() * 0.9),
        radio: radio * (0.12 + Math.random() * 0.12),
        chispa: indice % 3 === 0
      }));
      this.animacionesExplosion.push({ x: posicion.x, y: posicion.y, radio, estilo, tiempo: 0, duracion: 0.42, particulas });
    }

    registrarCaidaBurbuja(burbuja, fila, columna) {
      if (!this.geometria) return;
      const posicion = this.celdaAPosicion(fila, columna);
      const radio = this.geometria.radio;
      this.animacionesCaida.push({
        burbuja: { ...burbuja, categorias: Array.isArray(burbuja.categorias) ?[...burbuja.categorias] :[] },
        x: posicion.x, y: posicion.y, radio,
        vx: (Math.random() - 0.5) * 55, vy: 35 + Math.random() * 35, gravedad: 480 + Math.random() * 120,
        rotacion: 0, velocidadRotacion: (Math.random() - 0.5) * 1.8, tiempo: 0
      });
    }

    iniciarNivelPorId(nivelId) {
      const indice = this.dataset.niveles.findIndex((nivel) => nivel.id === nivelId);
      this.iniciarNivel(indice >= 0 ? indice : 0);
    }

    iniciarNivel(indiceNivel) {
      this.detenerGiroSostenido();
      if (this.transitionTimer) { window.clearTimeout(this.transitionTimer); this.transitionTimer = null; }
      this.indiceNivelActual = clamp(indiceNivel, 0, this.dataset.niveles.length - 1);
      this.nivelActual = this.dataset.niveles[this.indiceNivelActual];
      this.categoriasActivas = this.seleccionarCategoriasDelNivel(this.nivelActual);
      this.categoriasActivasSet = new Set(this.categoriasActivas.map((c) => c.id));
      this.valoresActivos = this.construirValoresActivos(this.categoriasActivas);
      this.valoresActivosSet = new Set(this.valoresActivos);

      if (!this.valoresActivos.length) throw new Error(`Bubble Profearauco: el nivel ${this.nivelActual.id} no tiene valores utiles.`);

      this.tablero = this.generarEscenaInicial();
      this.tirosNivel = 0;
      this.statsNivel = {
        tiros: 0,
        efectivos: 0,
        preparacion: 0,
        secos: 0,
        oportunidades: 0,
        maxCombo: 0,
        maxColgantes: 0
      };
      this.oportunidadDisparoActual = null;
      this.descensoAcumulado = 0;
      this.nivelResuelto = false;
      this.estaDerrotado = false;
      this.animacionesExplosion = [];
      this.animacionesCaida =[];
      this.animacionesImpacto =[];
      this.animacionesTexto =[];
      this.animacionesCelebracion =[];
      this.sacudida = { tiempo: 0, duracion: 0, intensidad: 0 };
      if (this.elCanvasWrap) this.elCanvasWrap.style.transform = "";
      this.colaSiguientes =[];
      this.proyectilActual = this.crearProyectilEnCanon(this.elegirSiguienteValorUtil());
      this.rellenarColaSiguientes();

      this.actualizarHUD();
      this.renderizarCategoriasActivas();
      this.ocultarToast();
      this.actualizarEstadoOverlay();
      this.dibujar();
    }

    reiniciarNivel() {
      if (!this.nivelActual) return;
      this.iniciarNivel(this.indiceNivelActual);
    }

    reiniciarJuego() {
      this.puntaje = 0;
      this.iniciarNivelPorId(this.config.nivelInicial);
    }

    programarSiguienteNivel() {
      if (this.indiceNivelActual >= this.dataset.niveles.length - 1 || this.transitionTimer) return;
      this.transitionTimer = window.setTimeout(() => {
        this.transitionTimer = null;
        this.iniciarNivel(this.indiceNivelActual + 1);
      }, 1900);
    }

    seleccionarCategoriasDelNivel(nivel) {
      const categoriasElegibles = this.dataset.categorias.filter((categoria) => categoria.niveles.includes(nivel.id));
      if (!categoriasElegibles.length) throw new Error(`Bubble Profearauco: no hay categorias disponibles para el nivel ${nivel.id}.`);
      if (categoriasElegibles.length <= nivel.maxCategorias) return categoriasElegibles;
      return mezclar(categoriasElegibles).slice(0, nivel.maxCategorias);
    }

    construirValoresActivos(categoriasActivas) {
      const ids = new Set();
      categoriasActivas.forEach((categoria) => {
        categoria.valores.forEach((valorId) => ids.add(valorId));
      });
      return Array.from(ids).filter((valorId) => this.valoresPorId[valorId]);
    }

    obtenerCeldasIniciales() {
      const filas = Math.min(this.config.filasIniciales, this.config.filasVisibles);
      const celdas =[];
      for (let fila = 0; fila < filas; fila++) {
        const huecoAleatorio = fila > 0 && this.config.columnas > 5 && Math.random() > 0.55 ? Math.floor(Math.random() * this.config.columnas) : -1;
        for (let columna = 0; columna < this.config.columnas; columna++) {
          if (columna === huecoAleatorio) continue;
          celdas.push({ fila, columna });
        }
      }
      return celdas;
    }

    calcularCuotasMinimasPorCategoria(totalCeldas) {
      const cantidadCategorias = this.categoriasActivas.length || 1;
      const cuotaIdeal = totalCeldas / cantidadCategorias;
      const cuotaMinima = totalCeldas >= cantidadCategorias ? Math.max(1, Math.floor(cuotaIdeal * 0.8)) : 0;
      const cuotas = Object.create(null);
      this.categoriasActivas.forEach((categoria) => { cuotas[categoria.id] = cuotaMinima; });
      return cuotas;
    }

    contarVecinosCompatibles(fila, columna, categoriaId) {
      let coincidenciasSemilla = 0;
      let coincidenciasCategoria = 0;
      this.obtenerVecinosCelda(fila, columna).forEach((vecino) => {
        const burbuja = this.tablero[vecino.fila][vecino.columna];
        if (!burbuja) return;
        if (burbuja.categoriaSemilla === categoriaId) coincidenciasSemilla++;
        if (burbuja.categorias.includes(categoriaId)) coincidenciasCategoria++;
      });
      return { coincidenciasSemilla, coincidenciasCategoria };
    }

    elegirCategoriaSemillaParaCelda(fila, columna, conteos, cuotasMinimas) {
      const categoriasPendientes = this.categoriasActivas.filter((categoria) => (conteos[categoria.id] || 0) < (cuotasMinimas[categoria.id] || 0));
      const candidatas = categoriasPendientes.length ? categoriasPendientes : this.categoriasActivas;
      const maxConteo = Math.max(0, ...this.categoriasActivas.map((categoria) => conteos[categoria.id] || 0));

      return elegirItemPonderado(candidatas, (categoria) => {
        const conteo = conteos[categoria.id] || 0;
        const deficitMinimo = Math.max(0, (cuotasMinimas[categoria.id] || 0) - conteo);
        const balance = 1 + Math.max(0, maxConteo - conteo) * 0.45;
        const vecinos = this.contarVecinosCompatibles(fila, columna, categoria.id);
        const agrupacion = 1 + vecinos.coincidenciasSemilla * 0.55 + Math.max(0, vecinos.coincidenciasCategoria - vecinos.coincidenciasSemilla) * 0.18;
        const impulsoMinimo = deficitMinimo > 0 ? 3 + deficitMinimo : 1;
        return impulsoMinimo * balance * agrupacion;
      });
    }

    obtenerCategoriasActivasDeValor(valorId) {
      return (this.categoriasPorValor[valorId] ||[]).filter((categoriaId) => this.categoriasActivasSet.has(categoriaId));
    }

    calcularPesoRarezaValor(valorId, opciones = {}) {
      const categoriasActivas = this.obtenerCategoriasActivasDeValor(valorId);
      const globalidad = Math.max(1, categoriasActivas.length);
      if (opciones.paraDisparo) {
        return PESOS_GLOBALIDAD_DISPARO[globalidad] || PESOS_GLOBALIDAD_DISPARO[3] / Math.pow(2.7, globalidad - 3);
      }
      return PESOS_GLOBALIDAD_TABLERO[globalidad] || PESOS_GLOBALIDAD_TABLERO[3] / Math.pow(3.4, globalidad - 3);
    }

    elegirValorDesdeBolsa(bolsa, opciones = {}) {
      if (!Array.isArray(bolsa) || bolsa.length === 0) return null;

      return elegirItemPonderado(bolsa, (valorId) => {
        let peso = this.calcularPesoRarezaValor(valorId, opciones);
        if (typeof opciones.fila === "number" && typeof opciones.columna === "number") {
          const vecinos = this.obtenerVecinosCelda(opciones.fila, opciones.columna);
          let vecinosMismoValor = 0;
          let vecinosCompatibles = 0;
          vecinos.forEach((vecino) => {
            const burbuja = this.tablero[vecino.fila][vecino.columna];
            if (!burbuja) return;
            if (burbuja.valorId === valorId) vecinosMismoValor++;
            if (opciones.categoriaId && burbuja.categorias.includes(opciones.categoriaId)) vecinosCompatibles++;
          });
          peso *= 1 + vecinosMismoValor * 0.2 + vecinosCompatibles * 0.1;
        }
        return peso;
      });
    }

    elegirValorParaCategoria(categoria, opciones = {}) {
      const categoriaNormalizada = typeof categoria === "string" ? this.categoriasPorId[categoria] : categoria;
      if (!categoriaNormalizada) return null;
      const bolsa = categoriaNormalizada.valores.filter((valorId) => this.valoresActivosSet.has(valorId));
      return this.elegirValorDesdeBolsa(bolsa, { ...opciones, categoriaId: categoriaNormalizada.id });
    }

    crearTableroVacio() {
      return Array.from({ length: this.config.filasVisibles }, () => Array.from({ length: this.config.columnas }, () => null));
    }

    generarEscenaInicial() {
      const tablero = this.crearTableroVacio();
      const celdas = this.obtenerCeldasIniciales();
      const cuotasMinimas = this.calcularCuotasMinimasPorCategoria(celdas.length);
      const conteos = Object.create(null);

      this.tablero = tablero;
      this.categoriasActivas.forEach((categoria) => { conteos[categoria.id] = 0; });

      celdas.forEach(({ fila, columna }) => {
        const categoria = this.elegirCategoriaSemillaParaCelda(fila, columna, conteos, cuotasMinimas);
        const valorId = this.elegirValorParaCategoria(categoria, { fila, columna });
        tablero[fila][columna] = this.crearBurbujaDesdeValorId(valorId, fila, columna, categoria.id);
        conteos[categoria.id] = (conteos[categoria.id] || 0) + 1;
      });
      return this.tablero;
    }

    crearBurbujaDesdeValorId(valorId, fila, columna, categoriaSemilla = null) {
      const valor = this.valoresPorId[valorId];
      const categoriasActivas = this.obtenerCategoriasActivasDeValor(valorId);
      return {
        valorId, texto: valor.texto, textoHTML: valor.textoHTML, textoCanvas: valor.textoCanvas, textoLatex: valor.textoLatex,
        categorias: categoriasActivas, categoriaSemilla, fila, columna, conectadaAlTecho: fila === 0
      };
    }

    elegirSiguienteValorUtil(valoresDisponibles = null) {
      const valoresUtiles = Array.isArray(valoresDisponibles) ? valoresDisponibles : this.obtenerValoresUtilesEnEscena();
      const bolsa = valoresUtiles.length ? valoresUtiles : this.valoresActivos;
      return this.elegirValorDesdeBolsa(bolsa, { paraDisparo: true });
    }

    rellenarColaSiguientes(cantidadObjetivo = CANTIDAD_COLA_SIGUIENTES) {
      while (this.colaSiguientes.length < cantidadObjetivo) {
        const valorId = this.elegirSiguienteValorUtil();
        if (!valorId) break;
        this.colaSiguientes.push(valorId);
      }
    }

    obtenerValoresUtilesEnEscena() {
      const categoriasPresentes = new Set();
      this.tablero.forEach((fila) => {
        fila.forEach((burbuja) => {
          if (!burbuja) return;
          burbuja.categorias.forEach((categoriaId) => categoriasPresentes.add(categoriaId));
        });
      });

      if (!categoriasPresentes.size) return[...this.valoresActivos];
      const valores = new Set();
      this.categoriasActivas.forEach((categoria) => {
        if (!categoriasPresentes.has(categoria.id)) return;
        categoria.valores.forEach((valorId) => valores.add(valorId));
      });
      return Array.from(valores);
    }

    crearProyectilEnCanon(valorId) {
      if (!valorId) return null;
      const valor = this.valoresPorId[valorId];
      const categoriasActivas = this.obtenerCategoriasActivasDeValor(valorId);
      return {
        valorId, texto: valor.texto, textoHTML: valor.textoHTML, textoCanvas: valor.textoCanvas, textoLatex: valor.textoLatex,
        categorias: categoriasActivas, categoriaSemilla: null,
        x: this.geometria.centroCanon.x, y: this.geometria.centroCanon.y, vx: 0, vy: 0, enMovimiento: false
      };
    }

    actualizarHUD() {
      if (!this.nivelActual) return;
      this.elPuntaje.textContent = String(this.puntaje);
      this.elNivel.textContent = String(this.nivelActual.id);
      this.elCategoriasTotal.textContent = String(this.categoriasActivas.length);
      this.elTiros.textContent = String(this.tirosNivel);
      if (this.elPuntajeSide) this.elPuntajeSide.textContent = String(this.puntaje);
      if (this.elNivelSide) this.elNivelSide.textContent = String(this.nivelActual.id);
      if (this.elCategoriasTotalSide) this.elCategoriasTotalSide.textContent = String(this.categoriasActivas.length);
      if (this.elTirosSide) this.elTirosSide.textContent = String(this.tirosNivel);

      if (this.nivelActual.descensoCadaTiros > 0) {
        const restantes = this.nivelActual.descensoCadaTiros - (this.tirosNivel % this.nivelActual.descensoCadaTiros || 0);
        const progreso = ((this.tirosNivel % this.nivelActual.descensoCadaTiros) / this.nivelActual.descensoCadaTiros) * 100;
        this.elPresionBarra.style.width = `${Math.max(6, progreso)}%`;
      } else {
        this.elPresionBarra.style.width = "8%";
      }
      this.actualizarEstadoOverlay();
    }

    renderizarCategoriasActivas() {
      const html = this.categoriasActivas.map((categoria) => `<span class="${claseUI("bubble2-chip-categoria")}">${categoria.nombreHTML}</span>`).join("");
      this.elCategorias.innerHTML = html;
      if (this.elCategoriasSide) this.elCategoriasSide.innerHTML = html;
      renderizarLatex(this.elCategorias);
      if (this.elCategoriasSide) renderizarLatex(this.elCategoriasSide);
    }

    renderizarSiguienteBurbuja() { return; }

    actualizarEstadoOverlay() {
      if (!this.elOverlay) return;

      if (this.nivelResuelto) {
        if (this.elOverlay.hidden === true) {
          this.audio.playVictoria(); // <-- SONIDO DE VICTORIA
        }
        const ultimoNivel = this.indiceNivelActual >= this.dataset.niveles.length - 1;
        this.elOverlayTitulo.textContent = ultimoNivel ? "Bubble completado" : "Nivel limpio";
        this.elOverlayTexto.textContent = ultimoNivel
          ? "Limpiaste la ultima escena. Puedes reiniciar o volver a jugar desde el nivel 1."
          : "La escena quedo despejada. El siguiente nivel cargara en un instante.";
        this.elOverlay.hidden = false;
        return;
      }

      if (this.estaDerrotado) {
        if (this.elOverlay.hidden === true) {
          this.audio.playDerrota(); // <-- SONIDO DE DERROTA
        }
        this.elOverlayTitulo.textContent = "Linea de peligro";
        this.elOverlayTexto.textContent = "La masa de burbujas alcanzo el limite. Reinicia el nivel para intentarlo de nuevo.";
        this.elOverlay.hidden = false;
        return;
      }

      this.elOverlay.hidden = true;
    }

    ocultarToast() {
      if (!this.elToast) return;
      if (this.toastTimer) { window.clearTimeout(this.toastTimer); this.toastTimer = null; }
      this.elToast.classList.remove("is-visible");
      this.elToast.hidden = true;
    }

    mostrarFeedback(mensaje, tipo = "info", persistente = false) {
      if (!this.elToast) return;
      if (!mensaje) { this.ocultarToast(); return; }
      if (this.toastTimer) { window.clearTimeout(this.toastTimer); this.toastTimer = null; }
      this.elToast.dataset.tipo = tipo;
      this.elToast.textContent = mensaje;
      this.elToast.hidden = false;
      this.elToast.classList.add("is-visible");
      if (!persistente) {
        this.toastTimer = window.setTimeout(() => { this.ocultarToast(); }, 1800);
      }
    }

    coordenadasLocales(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const escalaX = this.canvas.width / rect.width;
      const escalaY = this.canvas.height / rect.height;
      return { x: (clientX - rect.left) * escalaX, y: (clientY - rect.top) * escalaY };
    }

    manejarClick(evento) {
      this.audio.iniciar(); // <-- INICIALIZAR AUDIO
      const punto = this.coordenadasLocales(evento.clientX, evento.clientY);
      this.actualizarPunteriaDesdePunto(punto.x, punto.y);
      this.disparar();
    }

    resolverZonaTactil(punto) {
      if (!this.geometria) return null;
      const centro = this.geometria.centroCanon;
      const dxCanon = Math.abs(punto.x - centro.x);
      const dyCanon = Math.abs(punto.y - centro.y);
      const zonaDisparo = dxCanon <= this.geometria.diametro * 1.6 && punto.y >= centro.y - this.geometria.radio * 1.75 && dyCanon <= this.geometria.diametro * 1.9;
      if (zonaDisparo) return "disparo";
      const tercioIzquierdo = punto.x <= this.canvas.width * 0.36 && punto.y <= this.geometria.lineaPeligroY + this.geometria.diametro * 2.4;
      const tercioDerecho = punto.x >= this.canvas.width * 0.64 && punto.y <= this.geometria.lineaPeligroY + this.geometria.diametro * 2.4;
      if (tercioIzquierdo) return "izquierda";
      if (tercioDerecho) return "derecha";
      return null;
    }

    manejarTouchStart(evento) {
      this.audio.iniciar(); // <-- INICIALIZAR AUDIO
      const touch = evento.changedTouches[0];
      if (!touch) return;
      const punto = this.coordenadasLocales(touch.clientX, touch.clientY);
      const zona = this.resolverZonaTactil(punto);
      this.touchControl.id = touch.identifier;
      this.touchControl.zona = zona;

      if (zona === "izquierda") this.iniciarGiroSostenido(-1, null, evento);
      else if (zona === "derecha") this.iniciarGiroSostenido(1, null, evento);
      else if (zona === "disparo") this.disparar();

      if (evento.cancelable) evento.preventDefault();
    }

    manejarTouchMove(evento) {
      const touch = Array.from(evento.changedTouches ||[]).find((entrada) => entrada.identifier === this.touchControl.id);
      if (!touch) return;
      const punto = this.coordenadasLocales(touch.clientX, touch.clientY);
      const zona = this.resolverZonaTactil(punto);
      if (zona !== this.touchControl.zona) {
        this.detenerGiroSostenido();
        if (zona === "izquierda") this.iniciarGiroSostenido(-1, null, evento);
        else if (zona === "derecha") this.iniciarGiroSostenido(1, null, evento);
        this.touchControl.zona = zona;
      }
      if (evento.cancelable) evento.preventDefault();
    }

    manejarTouchEnd(evento) {
      const touch = Array.from(evento.changedTouches ||[]).find((entrada) => entrada.identifier === this.touchControl.id);
      if (!touch) return;
      this.detenerGiroSostenido();
      this.touchControl.id = null;
      this.touchControl.zona = null;
      if (evento.cancelable) evento.preventDefault();
    }

    manejarTeclaDown(evento) {
      this.audio.iniciar(); // <-- INICIALIZAR AUDIO (Para quienes juegan solo con teclado)
      
      if (evento.repeat && (evento.key === "ArrowLeft" || evento.key === "ArrowRight")) return;
      if (evento.key === "ArrowLeft") { this.iniciarGiroSostenido(-1, this.botonGiroIzquierda, evento); return; }
      if (evento.key === "ArrowRight") { this.iniciarGiroSostenido(1, this.botonGiroDerecha, evento); return; }
      if (evento.key === "ArrowUp" || evento.key === " " || evento.key === "Enter") {
        if (evento.cancelable) evento.preventDefault();
        this.disparar();
      }
    }

    manejarTeclaUp(evento) {
      if ((evento.key === "ArrowLeft" && this.controlGiro.direccion < 0) || (evento.key === "ArrowRight" && this.controlGiro.direccion > 0)) {
        this.detenerGiroSostenido();
      }
    }

    manejarControlIzquierdaDown(evento) { this.iniciarGiroSostenido(-1, this.botonGiroIzquierda, evento); }
    manejarControlDerechaDown(evento) { this.iniciarGiroSostenido(1, this.botonGiroDerecha, evento); }
    manejarControlPointerUp() { this.detenerGiroSostenido(); }
    manejarControlDisparo(evento) {
      if (evento && evento.cancelable) evento.preventDefault();
      if (this.botonDisparo) {
        this.botonDisparo.classList.add("is-hold");
        window.setTimeout(() => { if (this.botonDisparo) this.botonDisparo.classList.remove("is-hold"); }, 120);
      }
      this.disparar();
    }

    iniciarGiroSostenido(direccion, boton, evento) {
      if (evento && evento.cancelable) evento.preventDefault();
      this.detenerGiroSostenido();
      this.controlGiro.direccion = direccion;
      this.controlGiro.pasos = 0;
      this.controlGiro.boton = boton || null;
      if (this.controlGiro.boton) this.controlGiro.boton.classList.add("is-hold");
      this.aplicarPasoDeGiro(direccion, 1);
      this.controlGiro.timer = window.setTimeout(() => this.ejecutarGiroSostenido(), RETRASO_GIRO_SOSTENIDO);
    }

    ejecutarGiroSostenido() {
      if (!this.controlGiro.direccion) return;
      this.controlGiro.pasos += 1;
      const acelerado = this.controlGiro.pasos >= 4;
      this.aplicarPasoDeGiro(this.controlGiro.direccion, acelerado ? 1.35 : 1);
      const intervalo = acelerado ? 55 : 95;
      this.controlGiro.timer = window.setTimeout(() => this.ejecutarGiroSostenido(), intervalo);
    }

    detenerGiroSostenido() {
      if (this.controlGiro.timer) { window.clearTimeout(this.controlGiro.timer); this.controlGiro.timer = null; }
      if (this.controlGiro.boton) this.controlGiro.boton.classList.remove("is-hold");
      this.controlGiro.direccion = 0;
      this.controlGiro.pasos = 0;
      this.controlGiro.boton = null;
      this.touchControl.zona = null;
    }

    aplicarPasoDeGiro(direccion, multiplicador = 1) {
      if (!this.geometria) return;
      this.punteria.angle = clamp(this.punteria.angle + direccion * PASO_GIRO_CONTROL * multiplicador, ANGULO_MINIMO, ANGULO_MAXIMO);
      this.sincronizarPunteriaDesdeAngulo();
      this.dibujar();
    }

    puedeDisparar() {
      return Boolean(this.proyectilActual && !this.proyectilActual.enMovimiento && !this.nivelResuelto && !this.estaDerrotado);
    }

    disparar() {
      if (!this.puedeDisparar()) return false;

      this.audio.playDisparo(); // <-- SONIDO DE DISPARO

      const velocidad = Math.max(420, this.config.tamanoBurbuja * 18);
      this.oportunidadDisparoActual = this.evaluarOportunidadDeReventar(this.proyectilActual);
      this.proyectilActual.vx = Math.cos(this.punteria.angle) * velocidad;
      this.proyectilActual.vy = Math.sin(this.punteria.angle) * velocidad;
      this.proyectilActual.enMovimiento = true;
      this.tirosNivel++;
      if (this.statsNivel) {
        this.statsNivel.tiros++;
        if (this.oportunidadDisparoActual && this.oportunidadDisparoActual.existe) this.statsNivel.oportunidades++;
      }
      return true;
    }

    actualizarPunteriaDesdePunto(x, y) {
      if (!this.geometria) return;
      const dx = x - this.geometria.centroCanon.x;
      const dy = Math.min(y - this.geometria.centroCanon.y, -8);
      const angulo = clamp(Math.atan2(dy, dx), ANGULO_MINIMO, ANGULO_MAXIMO);
      this.punteria = { x, y, angle: angulo };
      this.dibujar();
    }

    obtenerDesplazamientoFila(fila) {
      return fila % 2 === 0 ? 0 : this.geometria.radio;
    }

    celdaAPosicion(fila, columna) {
      return {
        x: this.geometria.origenX + this.geometria.radio + columna * this.geometria.diametro + this.obtenerDesplazamientoFila(fila),
        y: this.geometria.origenY + this.geometria.radio + fila * this.geometria.pasoVertical + this.descensoAcumulado
      };
    }

    obtenerVecinosCelda(fila, columna) {
      const offsets = fila % 2 === 0
        ? [[0, -1], [0, 1],[-1, -1], [-1, 0], [1, -1], [1, 0]]
        : [[0, -1],[0, 1], [-1, 0], [-1, 1], [1, 0],[1, 1]];
      return offsets
        .map(([df, dc]) => ({ fila: fila + df, columna: columna + dc }))
        .filter((celda) => this.esCeldaValida(celda.fila, celda.columna));
    }

    esCeldaValida(fila, columna) {
      return fila >= 0 && fila < this.config.filasVisibles && columna >= 0 && columna < this.config.columnas;
    }

    esCeldaLibre(fila, columna) {
      return this.esCeldaValida(fila, columna) && !this.tablero[fila][columna];
    }

    celdaTieneVecino(fila, columna) {
      return this.obtenerVecinosCelda(fila, columna).some((vecino) => Boolean(this.tablero[vecino.fila][vecino.columna]));
    }

    recolectarGrupoSimulado(filaInicial, columnaInicial, categorias) {
      const categoriasSet = new Set(Array.isArray(categorias) ? categorias : []);
      if (!categoriasSet.size || !this.esCeldaLibre(filaInicial, columnaInicial)) return [];

      let mejorGrupo = [];
      categoriasSet.forEach((categoriaId) => {
        const visitadas = new Set();
        const pendientes = [{ fila: filaInicial, columna: columnaInicial }];
        const grupo = [];

        while (pendientes.length) {
          const actual = pendientes.pop();
          const clave = claveCelda(actual.fila, actual.columna);
          if (visitadas.has(clave)) continue;
          visitadas.add(clave);

          const esCeldaInsertada = actual.fila === filaInicial && actual.columna === columnaInicial;
          const burbuja = esCeldaInsertada ? null : this.tablero[actual.fila][actual.columna];
          const coincide = esCeldaInsertada ? categoriasSet.has(categoriaId) : Boolean(burbuja && burbuja.categorias.includes(categoriaId));
          if (!coincide) continue;

          grupo.push({ fila: actual.fila, columna: actual.columna });
          this.obtenerVecinosCelda(actual.fila, actual.columna).forEach((vecino) => {
            const claveVecina = claveCelda(vecino.fila, vecino.columna);
            if (!visitadas.has(claveVecina)) pendientes.push(vecino);
          });
        }

        if (grupo.length > mejorGrupo.length) mejorGrupo = grupo;
      });

      return mejorGrupo;
    }

    evaluarOportunidadDeReventar(burbuja) {
      if (!burbuja || !this.geometria) return { existe: false, celda: null, grupo: 0 };

      let mejor = { existe: false, celda: null, grupo: 0, trayectoria: null };
      for (let fila = 0; fila < this.config.filasVisibles; fila++) {
        for (let columna = 0; columna < this.config.columnas; columna++) {
          if (!this.esCeldaLibre(fila, columna)) continue;
          if (fila !== 0 && !this.celdaTieneVecino(fila, columna)) continue;

          const grupo = this.recolectarGrupoSimulado(fila, columna, burbuja.categorias);
          if (grupo.length < 3 || grupo.length <= mejor.grupo) continue;

          const posicion = this.celdaAPosicion(fila, columna);
          const trayectoria = this.obtenerTrayectoriaAccesibleA(posicion.x, posicion.y);
          if (!trayectoria) continue;

          mejor = {
            existe: true,
            celda: { fila, columna },
            grupo: grupo.length,
            trayectoria
          };
        }
      }
      return mejor;
    }

    obtenerTrayectoriaAccesibleA(x, y) {
      const origen = this.geometria.centroCanon;
      const objetivo = { x, y };
      const directa = this.trayectoriaDespejada(origen, objetivo, objetivo);
      if (directa) return { tipo: "directa" };

      const radio = this.geometria.radio;
      const paredIzquierda = this.geometria.origenX + radio;
      const paredDerecha = this.geometria.origenX + this.geometria.anchoBurbujeo - radio;
      const ancho = paredDerecha - paredIzquierda;
      const lados = [
        { nombre: "izquierda", paredX: paredIzquierda },
        { nombre: "derecha", paredX: paredDerecha }
      ];

      for (let cantidadRebotes = 1; cantidadRebotes <= 3; cantidadRebotes++) {
        for (let ladoIndice = 0; ladoIndice < lados.length; ladoIndice++) {
          const ladoInicial = lados[ladoIndice];
          const trayectoria = this.construirTrayectoriaConRebotes(objetivo, ladoInicial, cantidadRebotes, paredIzquierda, paredDerecha, ancho);
          if (trayectoria && this.trayectoriaPorSegmentosDespejada([origen, ...trayectoria.puntos, objetivo], objetivo)) {
            return { tipo: `rebote-${cantidadRebotes}-${ladoInicial.nombre}` };
          }
        }
      }

      return null;
    }

    construirTrayectoriaConRebotes(objetivo, ladoInicial, cantidadRebotes, paredIzquierda, paredDerecha, ancho) {
      const origen = this.geometria.centroCanon;
      const secuencia = [];
      for (let i = 0; i < cantidadRebotes; i++) {
        const usaInicial = i % 2 === 0;
        const paredX = ladoInicial.nombre === "izquierda"
          ? (usaInicial ? paredIzquierda : paredDerecha)
          : (usaInicial ? paredDerecha : paredIzquierda);
        secuencia.push({ nombre: paredX === paredIzquierda ? "izquierda" : "derecha", paredX });
      }

      let virtualX = objetivo.x;
      for (let i = secuencia.length - 1; i >= 0; i--) {
        virtualX = 2 * secuencia[i].paredX - virtualX;
      }

      const dxVirtual = virtualX - origen.x;
      if (Math.abs(dxVirtual) < 0.001) return null;

      const puntos = [];
      let tAnterior = 0;
      for (let i = 0; i < secuencia.length; i++) {
        const paredVirtualX = ladoInicial.nombre === "izquierda"
          ? paredIzquierda - ancho * i
          : paredDerecha + ancho * i;
        const t = (paredVirtualX - origen.x) / dxVirtual;
        if (t <= tAnterior || t >= 1) return null;

        const punto = {
          x: secuencia[i].paredX,
          y: origen.y + (objetivo.y - origen.y) * t
        };
        if (punto.y <= this.geometria.origenY || punto.y >= origen.y) return null;
        puntos.push(punto);
        tAnterior = t;
      }

      return { puntos };
    }

    trayectoriaPorSegmentosDespejada(puntos, objetivo) {
      for (let i = 0; i < puntos.length - 1; i++) {
        if (!this.trayectoriaDespejada(puntos[i], puntos[i + 1], objetivo)) return false;
      }
      return true;
    }

    trayectoriaDespejada(inicio, fin, objetivo) {
      const dx = fin.x - inicio.x;
      const dy = fin.y - inicio.y;
      const longitud2 = dx * dx + dy * dy;
      if (longitud2 <= 1) return false;

      const angulo = Math.atan2(dy, dx);
      if (inicio === this.geometria.centroCanon && (angulo < ANGULO_MINIMO || angulo > ANGULO_MAXIMO)) return false;

      const longitud = Math.sqrt(longitud2);
      const margenObjetivo = this.geometria.diametro * 1.15;
      const radioColision = this.geometria.radio * 1.62;

      for (let fila = 0; fila < this.tablero.length; fila++) {
        for (let columna = 0; columna < this.tablero[fila].length; columna++) {
          if (!this.tablero[fila][columna]) continue;
          const posicion = this.celdaAPosicion(fila, columna);
          const t = clamp(((posicion.x - inicio.x) * dx + (posicion.y - inicio.y) * dy) / longitud2, 0, 1);
          const puntoX = inicio.x + dx * t;
          const puntoY = inicio.y + dy * t;
          const distancia2 = (posicion.x - puntoX) * (posicion.x - puntoX) + (posicion.y - puntoY) * (posicion.y - puntoY);
          const distanciaAlObjetivo = Math.hypot(posicion.x - objetivo.x, posicion.y - objetivo.y);
          if (distancia2 <= radioColision * radioColision && distanciaAlObjetivo > margenObjetivo) return false;
        }
      }
      return true;
    }

    buscarCeldaLibreMasCercana(x, y) {
      const candidatosPrimarios = [];
      const candidatosSecundarios =[];

      for (let fila = 0; fila < this.config.filasVisibles; fila++) {
        for (let columna = 0; columna < this.config.columnas; columna++) {
          if (!this.esCeldaLibre(fila, columna)) continue;
          const posicion = this.celdaAPosicion(fila, columna);
          const candidato = {
            fila, columna,
            distancia2: (posicion.x - x) * (posicion.x - x) + (posicion.y - y) * (posicion.y - y)
          };
          if (fila === 0 || this.celdaTieneVecino(fila, columna)) candidatosPrimarios.push(candidato);
          else candidatosSecundarios.push(candidato);
        }
      }
      const ordenar = (a, b) => a.distancia2 - b.distancia2;
      candidatosPrimarios.sort(ordenar);
      candidatosSecundarios.sort(ordenar);
      return candidatosPrimarios[0] || candidatosSecundarios[0] || null;
    }

    actualizarProyectil(dt) {
      if (!this.proyectilActual || !this.proyectilActual.enMovimiento) return;
      this.proyectilActual.x += this.proyectilActual.vx * dt;
      this.proyectilActual.y += this.proyectilActual.vy * dt;
      this.resolverReboteEnParedes();

      if (this.detectarChoqueConTecho()) {
        this.fijarProyectilEnTablero();
        return;
      }
      const choque = this.detectarChoqueConTablero();
      if (choque) {
        this.fijarProyectilEnTablero();
      }
    }

    resolverReboteEnParedes() {
      const radio = this.geometria.radio;
      const limiteIzquierdo = this.geometria.origenX + radio;
      const limiteDerecho = this.geometria.origenX + this.geometria.anchoBurbujeo - radio;
      if (this.proyectilActual.x <= limiteIzquierdo) {
        this.proyectilActual.x = limiteIzquierdo;
        this.proyectilActual.vx = Math.abs(this.proyectilActual.vx);
      } else if (this.proyectilActual.x >= limiteDerecho) {
        this.proyectilActual.x = limiteDerecho;
        this.proyectilActual.vx = -Math.abs(this.proyectilActual.vx);
      }
    }

    detectarChoqueConTecho() {
      return this.proyectilActual.y - this.geometria.radio <= this.geometria.origenY + this.descensoAcumulado;
    }

    detectarChoqueConTablero() {
      const distanciaChoque = this.geometria.diametro - 2;
      const distanciaChoque2 = distanciaChoque * distanciaChoque;

      for (let fila = 0; fila < this.tablero.length; fila++) {
        for (let columna = 0; columna < this.tablero[fila].length; columna++) {
          const burbuja = this.tablero[fila][columna];
          if (!burbuja) continue;
          const posicion = this.celdaAPosicion(fila, columna);
          const dx = this.proyectilActual.x - posicion.x;
          const dy = this.proyectilActual.y - posicion.y;
          if (dx * dx + dy * dy <= distanciaChoque2) return burbuja;
        }
      }
      return null;
    }

    fijarProyectilEnTablero() {
      if (!this.proyectilActual) return;
      const celda = this.buscarCeldaLibreMasCercana(this.proyectilActual.x, this.proyectilActual.y);

      if (!celda) {
        const valorActual = this.proyectilActual.valorId;
        this.proyectilActual = this.crearProyectilEnCanon(valorActual);
        this.mostrarFeedback("No se encontro una celda libre para fijar la burbuja.", "warn");
        return;
      }

      const burbuja = this.crearBurbujaDesdeValorId(this.proyectilActual.valorId, celda.fila, celda.columna);
      this.tablero[celda.fila][celda.columna] = burbuja;
      
      const valorSugerido = this.colaSiguientes.shift() || this.elegirSiguienteValorUtil();
      this.resolverPostImpacto(burbuja);

      if (!this.nivelResuelto && !this.estaDerrotado) {
        this.prepararProximoTurno(valorSugerido);
      } else {
        this.proyectilActual = null;
        this.colaSiguientes =[];
        this.renderizarSiguienteBurbuja();
      }
      this.actualizarHUD();
    }

    prepararProximoTurno(valorSugerido) {
      const valoresUtiles = this.obtenerValoresUtilesEnEscena();
      const bolsaActual = valoresUtiles.length ? valoresUtiles : this.valoresActivos;
      const valorActual = bolsaActual.includes(valorSugerido) ? valorSugerido : this.elegirSiguienteValorUtil(bolsaActual);
      this.proyectilActual = this.crearProyectilEnCanon(valorActual);
      this.rellenarColaSiguientes();
      this.renderizarSiguienteBurbuja();
    }

    resolverPostImpacto(burbujaInsertada) {
      const grupos = this.buscarGruposQueRevientan(burbujaInsertada);
      let explotadas = 0;
      let colgantes = 0;
      let huboDescenso = false;
      const oportunidad = this.oportunidadDisparoActual || { existe: false };
      let mayorGrupoPreparado = 0;

      this.registrarImpactoBurbuja(burbujaInsertada.fila, burbujaInsertada.columna, grupos.length > 0);

      if (grupos.length) {
        explotadas = this.reventarGrupos(grupos);
        colgantes = this.hacerCaerColgantes();
      } else {
        mayorGrupoPreparado = this.obtenerMayorGrupoDeBurbuja(burbujaInsertada);
      }

      this.registrarResultadoDisparo({
        burbuja: burbujaInsertada,
        grupos,
        explotadas,
        colgantes,
        oportunidad,
        mayorGrupoPreparado
      });
      this.oportunidadDisparoActual = null;

      if (this.tableroEstaVacio()) {
        this.nivelResuelto = true;
        this.registrarCelebracionNivel();
        if (this.indiceNivelActual >= this.dataset.niveles.length - 1) {
          return explotadas || colgantes ? `Escena limpia. Reventaste ${explotadas} burbujas y cayeron ${colgantes}. Juego completado.` : "Escena limpia. Juego completado.";
        }
        this.programarSiguienteNivel();
        return explotadas || colgantes ? `Escena limpia. Reventaste ${explotadas} burbujas y cayeron ${colgantes}. El siguiente nivel cargara enseguida.` : "Escena limpia. El siguiente nivel cargara enseguida.";
      }

      if (this.verificarDerrotaPorLineaInferior()) {
        this.estaDerrotado = true;
        return "La masa de burbujas alcanzo la linea de peligro. Reinicia el nivel.";
      }

      huboDescenso = this.descenderTableroSiCorresponde();

      if (this.verificarDerrotaPorLineaInferior()) {
        this.estaDerrotado = true;
        return huboDescenso ? "El techo bajo y la escena alcanzo la linea de peligro. Reinicia el nivel." : "La masa de burbujas alcanzo la linea de peligro. Reinicia el nivel.";
      }

      const partes =[`Burbuja fijada en fila ${burbujaInsertada.fila + 1}, columna ${burbujaInsertada.columna + 1}.`];
      if (explotadas > 0) partes.push(`Reventaste ${explotadas} burbujas.`);
      if (colgantes > 0) partes.push(`Cayeron ${colgantes} colgantes.`);
      if (huboDescenso) partes.push("El techo bajo una fila.");
      if (explotadas === 0 && colgantes === 0 && !huboDescenso) partes.push("No hubo grupo suficiente para reventar.");
      return partes.join(" ");
    }

    buscarGruposQueRevientan(burbujaInsertada) {
      const grupos =[];
      burbujaInsertada.categorias.forEach((categoriaId) => {
        const grupo = this.recolectarGrupoPorCategoria(burbujaInsertada.fila, burbujaInsertada.columna, categoriaId);
        if (grupo.length >= 3) grupos.push(grupo);
      });
      return grupos;
    }

    obtenerMayorGrupoDeBurbuja(burbuja) {
      if (!burbuja || !Array.isArray(burbuja.categorias)) return 0;
      return burbuja.categorias.reduce((mayor, categoriaId) => {
        const grupo = this.recolectarGrupoPorCategoria(burbuja.fila, burbuja.columna, categoriaId);
        return Math.max(mayor, grupo.length);
      }, 0);
    }

    registrarResultadoDisparo(resultado) {
      if (!resultado || !this.statsNivel) return;
      const fueEfectivo = resultado.explotadas > 0 || resultado.colgantes > 0;
      const huboOportunidad = Boolean(resultado.oportunidad && resultado.oportunidad.existe);

      if (fueEfectivo) {
        this.statsNivel.efectivos++;
        this.statsNivel.maxCombo = Math.max(this.statsNivel.maxCombo, resultado.grupos.length || 0);
        this.statsNivel.maxColgantes = Math.max(this.statsNivel.maxColgantes, resultado.colgantes || 0);
        if (resultado.explotadas >= 3) this.mostrarFeedback("Buen disparo", "ok");
        return;
      }

      if (huboOportunidad) {
        this.statsNivel.secos++;
        const celda = resultado.oportunidad.celda;
        const detalle = celda ? `Habia jugada en fila ${celda.fila + 1}, columna ${celda.columna + 1}.` : "Habia una jugada disponible.";
        this.mostrarFeedback(`Oportunidad perdida. ${detalle}`, "warn");
        const posicion = this.celdaAPosicion(resultado.burbuja.fila, resultado.burbuja.columna);
        this.registrarTextoFlotante("Oportunidad perdida", posicion.x, posicion.y - this.geometria.radio * 1.2, {
          color: "#ffd4b8",
          duracion: 0.95,
          velocidad: 28,
          tamano: Math.max(13, Math.floor(this.geometria.radio * 0.56))
        });
        return;
      }

      this.statsNivel.preparacion++;
      if (resultado.mayorGrupoPreparado >= 2) {
        this.mostrarFeedback("Preparando jugada", "info");
      }
    }

    recolectarGrupoPorCategoria(filaInicial, columnaInicial, categoriaId) {
      const inicio = this.esCeldaValida(filaInicial, columnaInicial) && this.tablero[filaInicial][columnaInicial];
      if (!inicio || !inicio.categorias.includes(categoriaId)) return [];

      const visitadas = new Set();
      const pendientes =[{ fila: filaInicial, columna: columnaInicial }];
      const grupo =[];

      while (pendientes.length) {
        const actual = pendientes.pop();
        const clave = claveCelda(actual.fila, actual.columna);
        if (visitadas.has(clave)) continue;
        visitadas.add(clave);

        const burbuja = this.tablero[actual.fila][actual.columna];
        if (!burbuja || !burbuja.categorias.includes(categoriaId)) continue;

        grupo.push({ fila: actual.fila, columna: actual.columna, burbuja });
        this.obtenerVecinosCelda(actual.fila, actual.columna).forEach((vecino) => {
          const claveVecina = claveCelda(vecino.fila, vecino.columna);
          if (!visitadas.has(claveVecina)) pendientes.push(vecino);
        });
      }
      return grupo;
    }

    reventarGrupos(grupos) {
      const celdasAEliminar = new Map();

      grupos.forEach((grupo) => {
        grupo.forEach((entrada) => {
          celdasAEliminar.set(claveCelda(entrada.fila, entrada.columna), entrada);
        });
      });

      let delay = 0;
      let index = 0;
      let sumaX = 0;
      let sumaY = 0;

      celdasAEliminar.forEach((entrada) => {
        const posicion = this.celdaAPosicion(entrada.fila, entrada.columna);
        sumaX += posicion.x;
        sumaY += posicion.y;
        this.registrarExplosionBurbuja(entrada.burbuja, entrada.fila, entrada.columna);
        this.tablero[entrada.fila][entrada.columna] = null;

        // <-- SONIDO DE EXPLOSIÓN EN CASCADA
        setTimeout(() => {
            this.audio.playPop(index);
        }, delay);
        delay += 40;
        index++;
      });

      const cantidad = celdasAEliminar.size;
      this.sumarPuntajeExplosion(cantidad, grupos.length);
      if (cantidad) {
        const centroX = sumaX / cantidad;
        const centroY = sumaY / cantidad;
        const bonus = cantidad * 10 + Math.max(0, grupos.length - 1) * 8;
        const texto = grupos.length > 1 ? `COMBO x${grupos.length} +${bonus}` : `+${bonus}`;
        this.registrarTextoFlotante(texto, centroX, centroY - this.geometria.radio * 0.6, {
          color: grupos.length > 1 ? "#fff2a8" : "#ffe6c8",
          tamano: Math.max(16, Math.floor(this.geometria.radio * (grupos.length > 1 ? 0.8 : 0.7))),
          duracion: grupos.length > 1 ? 1.1 : 0.85,
          velocidad: grupos.length > 1 ? 42 : 34
        });
        this.sacudir(grupos.length > 1 ? 8 : 5.5, grupos.length > 1 ? 0.26 : 0.18);
      }
      return cantidad;
    }

    marcarConectadasAlTecho() {
      const pendientes =[];
      for (let fila = 0; fila < this.tablero.length; fila++) {
        for (let columna = 0; columna < this.tablero[fila].length; columna++) {
          const burbuja = this.tablero[fila][columna];
          if (burbuja) burbuja.conectadaAlTecho = false;
        }
      }

      for (let columna = 0; columna < this.config.columnas; columna++) {
        const burbuja = this.tablero[0][columna];
        if (!burbuja) continue;
        burbuja.conectadaAlTecho = true;
        pendientes.push({ fila: 0, columna });
      }

      while (pendientes.length) {
        const actual = pendientes.pop();
        this.obtenerVecinosCelda(actual.fila, actual.columna).forEach((vecino) => {
          const burbuja = this.tablero[vecino.fila][vecino.columna];
          if (!burbuja || burbuja.conectadaAlTecho) return;
          burbuja.conectadaAlTecho = true;
          pendientes.push(vecino);
        });
      }
    }

    obtenerColgantes() {
      const colgantes =[];
      for (let fila = 0; fila < this.tablero.length; fila++) {
        for (let columna = 0; columna < this.tablero[fila].length; columna++) {
          const burbuja = this.tablero[fila][columna];
          if (burbuja && !burbuja.conectadaAlTecho) {
            colgantes.push({ fila, columna, burbuja });
          }
        }
      }
      return colgantes;
    }

    hacerCaerColgantes() {
      this.marcarConectadasAlTecho();
      const colgantes = this.obtenerColgantes();

      if (colgantes.length > 0) {
        this.audio.playCaida(); // <-- SONIDO DE CAÍDA
      }

      colgantes.forEach((entrada) => {
        this.registrarCaidaBurbuja(entrada.burbuja, entrada.fila, entrada.columna);
        this.tablero[entrada.fila][entrada.columna] = null;
      });

      if (colgantes.length) this.sumarPuntajeColgantes(colgantes.length);
      if (colgantes.length) {
        const centro = this.geometria ? this.geometria.centroCanon : { x: 0, y: 0 };
        this.registrarTextoFlotante(`Caida +${colgantes.length * 15}`, centro.x, this.geometria.lineaPeligroY - this.geometria.radio, {
          color: "#ddffe2",
          duracion: 1,
          velocidad: 38
        });
        this.sacudir(5, 0.2);
      }
      return colgantes.length;
    }

    sumarPuntajeExplosion(cantidad, grupos) {
      if (!cantidad) return;
      this.puntaje += cantidad * 10 + Math.max(0, grupos - 1) * 8;
    }

    sumarPuntajeColgantes(cantidad) {
      if (!cantidad) return;
      this.puntaje += cantidad * 15;
    }

    descenderTableroSiCorresponde() {
      if (!this.nivelActual || this.nivelActual.descensoCadaTiros <= 0 || this.tirosNivel <= 0 || this.tirosNivel % this.nivelActual.descensoCadaTiros !== 0) return false;
      this.descensoAcumulado += this.geometria.pasoVertical;
      return true;
    }

    obtenerFactorPresionCritica() {
      if (!this.nivelActual || this.nivelActual.descensoCadaTiros <= 1 || this.nivelResuelto || this.estaDerrotado) return 0;
      const avance = this.tirosNivel % this.nivelActual.descensoCadaTiros;
      if (avance === 0) return 0;
      const restante = this.nivelActual.descensoCadaTiros - avance;
      if (restante > 2) return 0;
      return restante === 1 ? 1 : 0.42;
    }

    verificarDerrotaPorLineaInferior() {
      const limite = this.geometria.lineaPeligroY;
      for (let fila = 0; fila < this.tablero.length; fila++) {
        for (let columna = 0; columna < this.tablero[fila].length; columna++) {
          if (!this.tablero[fila][columna]) continue;
          const posicion = this.celdaAPosicion(fila, columna);
          if (posicion.y + this.geometria.radio >= limite) return true;
        }
      }
      return false;
    }

    tableroEstaVacio() {
      return this.tablero.every((fila) => fila.every((burbuja) => !burbuja));
    }

    dibujar() {
      if (!this.ctx || !this.geometria) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.dibujarFondo();
      this.dibujarGuiasHexagonales();
      this.dibujarLineaPeligro();
      this.dibujarTablero();
      this.dibujarAnimacionesImpacto();
      this.dibujarAnimacionesExplosion();
      this.dibujarAnimacionesCaida();
      this.dibujarAnimacionesCelebracion();
      this.dibujarAnimacionesTexto();
      this.dibujarLineaPunteria();
      this.dibujarCanon();
      this.dibujarColaSiguientes();
      this.dibujarProyectilActual();
    }

    dibujarFondo() {
      const ctx = this.ctx;
      const geom = this.geometria;
      ctx.fillStyle = this.tema.fondoCanvas;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = this.tema.panelCanvas;
      ctx.fillRect(geom.origenX - geom.radio * 0.55, geom.origenY - geom.radio * 0.55, geom.anchoBurbujeo + geom.radio * 1.1, geom.altoBurbujeo + geom.radio * 0.9);
      ctx.strokeStyle = this.tema.bordeInterior;
      ctx.lineWidth = 2;
      ctx.strokeRect(geom.origenX - geom.radio * 0.55, geom.origenY - geom.radio * 0.55, geom.anchoBurbujeo + geom.radio * 1.1, geom.altoBurbujeo + geom.radio * 0.9);
      ctx.strokeStyle = this.tema.bordeCanvas;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
    }

    dibujarGuiasHexagonales() {
      const ctx = this.ctx;
      const radioGuia = this.geometria.radio * 0.92;
      ctx.save();
      ctx.strokeStyle = this.tema.guias;
      ctx.lineWidth = 1;
      for (let fila = 0; fila < this.config.filasVisibles; fila++) {
        for (let columna = 0; columna < this.config.columnas; columna++) {
          const posicion = this.celdaAPosicion(fila, columna);
          ctx.beginPath();
          ctx.arc(posicion.x, posicion.y, radioGuia, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    dibujarLineaPeligro() {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = this.tema.lineaPeligro;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(this.geometria.origenX - 8, this.geometria.lineaPeligroY);
      ctx.lineTo(this.geometria.origenX + this.geometria.anchoBurbujeo + 8, this.geometria.lineaPeligroY);
      ctx.stroke();
      ctx.restore();
    }

    dibujarTablero() {
      const factorPresion = this.obtenerFactorPresionCritica();
      const tiempo = this.ultimoTimestamp || 0;
      for (let fila = 0; fila < this.tablero.length; fila++) {
        for (let columna = 0; columna < this.tablero[fila].length; columna++) {
          const burbuja = this.tablero[fila][columna];
          if (!burbuja) continue;
          const posicion = this.celdaAPosicion(fila, columna);
          let x = posicion.x;
          let y = posicion.y;
          let rotacion = 0;
          if (factorPresion > 0) {
            const semilla = fila * 17.7 + columna * 11.3;
            const amplitud = this.geometria.radio * 0.035 * factorPresion;
            x += Math.sin(tiempo * 0.045 + semilla) * amplitud;
            y += Math.cos(tiempo * 0.052 + semilla * 0.7) * amplitud;
            rotacion = Math.sin(tiempo * 0.038 + semilla) * 0.018 * factorPresion;
          }
          this.dibujarBurbuja(burbuja, x, y, { rotacion, tension: factorPresion });
        }
      }
    }

    dibujarBurbuja(burbuja, x, y, opciones = {}) {
      const ctx = this.ctx;
      const radio = this.geometria.radio;
      const alpha = typeof opciones.alpha === "number" ? opciones.alpha : 1;
      const escala = typeof opciones.escala === "number" ? opciones.escala : 1;
      const rotacion = typeof opciones.rotacion === "number" ? opciones.rotacion : 0;
      const tension = typeof opciones.tension === "number" ? opciones.tension : 0;
      const estilo = obtenerEstiloComodin(Array.isArray(burbuja.categorias) ? burbuja.categorias.length : 1);

      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(x, y);
      ctx.rotate(rotacion);
      ctx.scale(escala, escala);

      const gradiente = ctx.createRadialGradient(-radio * 0.32, -radio * 0.34, radio * 0.15, 0, 0, radio);
      gradiente.addColorStop(0, estilo.brillo);
      gradiente.addColorStop(1, estilo.relleno);

      if (estilo.halo) {
        ctx.beginPath();
        ctx.arc(0, 0, radio * 1.22, 0, Math.PI * 2);
        ctx.fillStyle = estilo.halo;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(0, 0, radio, 0, Math.PI * 2);
      ctx.fillStyle = gradiente;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = estilo.borde;
      ctx.stroke();

      if (tension > 0) {
        ctx.globalAlpha = clamp(alpha * tension * 0.22, 0, 0.3);
        ctx.lineWidth = Math.max(1, radio * 0.08);
        ctx.strokeStyle = "#ffb347";
        ctx.shadowColor = "rgba(255, 98, 0, 0.42)";
        ctx.shadowBlur = radio * 0.35 * tension;
        ctx.beginPath();
        ctx.arc(0, 0, radio * 1.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.shadowBlur = 0;
      }

      this.dibujarTextoBurbuja(burbuja, 0, 0, radio);
      ctx.restore();
    }

    obtenerImagenLatexBurbuja(latex, radio) {
      if (!latex || !window.katex || typeof window.katex.renderToString !== "function") return null;

      const color = this.tema.textoBurbuja || "#f5f5f5";
      const tamano = Math.max(14, Math.floor(radio * 0.72));
      const anchoMaximo = Math.max(20, Math.floor(radio * 1.68));
      const altoMaximo = Math.max(20, Math.floor(radio * 1.32));
      const clave = [latex, color, tamano, anchoMaximo, altoMaximo].join("|");
      const cacheado = this.cacheLatexCanvas.get(clave);
      if (cacheado) return cacheado;

      const registro = { estado: "cargando", imagen: null, ancho: anchoMaximo, alto: altoMaximo };
      this.cacheLatexCanvas.set(clave, registro);

      try {
        const host = document.createElement("div");
        host.style.position = "absolute";
        host.style.left = "-10000px";
        host.style.top = "-10000px";
        host.style.visibility = "hidden";
        host.style.color = color;
        host.style.fontSize = tamano + "px";
        host.style.lineHeight = "1";
        host.innerHTML = window.katex.renderToString(latex, {
          displayMode: false,
          throwOnError: false,
          output: "mathml"
        });
        document.body.appendChild(host);
        const rect = host.getBoundingClientRect();
        const escala = Math.min(1, anchoMaximo / Math.max(1, rect.width), altoMaximo / Math.max(1, rect.height));
        const ancho = Math.max(1, Math.ceil(rect.width * escala) + 4);
        const alto = Math.max(1, Math.ceil(rect.height * escala) + 4);
        const html = host.innerHTML;
        document.body.removeChild(host);

        const svg = [
          '<svg xmlns="http://www.w3.org/2000/svg" width="' + ancho + '" height="' + alto + '" viewBox="0 0 ' + ancho + ' ' + alto + '">',
          '<foreignObject x="0" y="0" width="100%" height="100%">',
          '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + ancho + 'px;height:' + alto + 'px;display:flex;align-items:center;justify-content:center;color:' + color + ';font-size:' + tamano + 'px;line-height:1;transform:scale(' + escala + ');transform-origin:center center;">',
          html,
          '</div>',
          '</foreignObject>',
          '</svg>'
        ].join("");

        const imagen = new Image();
        imagen.onload = () => {
          registro.estado = "listo";
          registro.imagen = imagen;
          registro.ancho = ancho;
          registro.alto = alto;
          this.dibujar();
        };
        imagen.onerror = () => {
          registro.estado = "error";
        };
        imagen.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      } catch (error) {
        registro.estado = "error";
        console.warn("Bubble 2 KaTeX canvas:", error);
      }

      return registro;
    }

    dibujarTextoBurbuja(burbuja, x, y, radio) {
      const ctx = this.ctx;
      const latex = burbuja && burbuja.textoLatex ? burbuja.textoLatex : "";
      if (latex) {
        const renderLatex = this.obtenerImagenLatexBurbuja(latex, radio);
        if (renderLatex && renderLatex.estado === "listo" && renderLatex.imagen) {
          ctx.drawImage(renderLatex.imagen, x - renderLatex.ancho / 2, y - renderLatex.alto / 2, renderLatex.ancho, renderLatex.alto);
          return;
        }
      }

      let tamano = Math.max(10, Math.floor(radio * 0.78));
      const anchoMaximo = radio * 1.6;
      const textoPlano = String((burbuja && burbuja.textoCanvas) || "");
      ctx.fillStyle = this.tema.textoBurbuja;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      do {
        ctx.font = `800 ${tamano}px Arial`;
        tamano--;
      } while (tamano > 10 && ctx.measureText(textoPlano).width > anchoMaximo);
      ctx.fillText(textoPlano, x, y);
    }

    dibujarCanon() {
      const ctx = this.ctx;
      const centro = this.geometria.centroCanon;
      const radioBase = this.geometria.radio * 0.95;
      const largoCanon = this.geometria.radio * 1.9;
      const puntaX = centro.x + Math.cos(this.punteria.angle) * largoCanon;
      const puntaY = centro.y + Math.sin(this.punteria.angle) * largoCanon;

      ctx.save();
      ctx.lineWidth = this.geometria.radio * 0.46;
      ctx.strokeStyle = this.tema.canon;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(centro.x, centro.y);
      ctx.lineTo(puntaX, puntaY);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centro.x, centro.y, radioBase, 0, Math.PI * 2);
      ctx.fillStyle = this.tema.canon;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.tema.canonBorde;
      ctx.stroke();
      ctx.restore();
    }

    dibujarLineaPunteria() {
      const ctx = this.ctx;
      const centro = this.geometria.centroCanon;
      const largo = Math.max(140, this.geometria.radio * 7.5);
      const x = centro.x + Math.cos(this.punteria.angle) * largo;
      const y = centro.y + Math.sin(this.punteria.angle) * largo;

      ctx.save();
      ctx.strokeStyle = this.tema.punteria;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(centro.x, centro.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    }

    dibujarProyectilActual() {
      if (!this.proyectilActual) return;
      this.dibujarBurbuja(this.proyectilActual, this.proyectilActual.x, this.proyectilActual.y);
    }

    dibujarColaSiguientes() {
      if (!this.colaSiguientes.length || !this.geometria) return;
      const centro = this.geometria.centroCanon;
      const diametro = this.geometria.diametro;
      const configuracion =[
        { dx: -diametro * 1.38, dy: this.geometria.radio * 0.62, escala: 0.76, alpha: 0.92 },
        { dx: -diametro * 2.18, dy: this.geometria.radio * 1.02, escala: 0.62, alpha: 0.76 }
      ];

      this.colaSiguientes.slice(0, CANTIDAD_COLA_SIGUIENTES).forEach((valorId, indice) => {
        const valor = this.crearProyectilEnCanon(valorId);
        const vista = configuracion[indice] || configuracion[configuracion.length - 1];
        this.dibujarBurbuja(valor, centro.x + vista.dx, centro.y + vista.dy, { alpha: vista.alpha, escala: vista.escala });
      });
    }

    dibujarAnimacionesExplosion() {
      if (!this.animacionesExplosion.length) return;
      const ctx = this.ctx;
      this.animacionesExplosion.forEach((animacion) => {
        const progreso = clamp(animacion.tiempo / animacion.duracion, 0, 1);
        const alpha = 1 - progreso;
        const radioAnillo = animacion.radio * (0.55 + progreso * 0.95);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = animacion.estilo.halo || animacion.estilo.brillo;
        ctx.shadowBlur = animacion.radio * 0.7 * alpha;
        ctx.lineWidth = Math.max(1.2, animacion.radio * 0.16 * alpha);
        ctx.strokeStyle = animacion.estilo.borde;
        ctx.beginPath();
        ctx.arc(animacion.x, animacion.y, radioAnillo, 0, Math.PI * 2);
        ctx.stroke();

        animacion.particulas.forEach((particula) => {
          const distancia = particula.distancia * progreso;
          const px = animacion.x + Math.cos(particula.angulo) * distancia;
          const py = animacion.y + Math.sin(particula.angulo) * distancia;
          ctx.beginPath();
          ctx.fillStyle = particula.chispa ? "#ffe6a3" : animacion.estilo.brillo;
          ctx.arc(px, py, Math.max(1.5, particula.radio * (1 - progreso * 0.55)), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      });
    }

    dibujarAnimacionesImpacto() {
      if (!this.animacionesImpacto.length) return;
      const ctx = this.ctx;
      this.animacionesImpacto.forEach((animacion) => {
        const progreso = clamp(animacion.tiempo / animacion.duracion, 0, 1);
        const alpha = 1 - progreso;
        const radio = animacion.radio * (0.82 + progreso * (animacion.acierto ? 0.85 : 0.45));

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = animacion.color;
        ctx.lineWidth = Math.max(1, animacion.radio * (animacion.acierto ? 0.14 : 0.09) * alpha);
        ctx.shadowColor = animacion.color;
        ctx.shadowBlur = animacion.radio * (animacion.acierto ? 0.8 : 0.35) * alpha;
        ctx.beginPath();
        ctx.arc(animacion.x, animacion.y, radio, 0, Math.PI * 2);
        ctx.stroke();

        if (animacion.acierto) {
          ctx.globalAlpha = alpha * 0.18;
          ctx.fillStyle = animacion.color;
          ctx.beginPath();
          ctx.arc(animacion.x, animacion.y, radio * 0.82, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    dibujarAnimacionesTexto() {
      if (!this.animacionesTexto.length) return;
      const ctx = this.ctx;
      this.animacionesTexto.forEach((animacion) => {
        const progreso = clamp(animacion.tiempo / animacion.duracion, 0, 1);
        const alpha = progreso < 0.18 ? progreso / 0.18 : 1 - Math.max(0, progreso - 0.72) / 0.28;
        const escala = 0.86 + Math.min(1, progreso / 0.22) * 0.14;

        ctx.save();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.translate(animacion.x, animacion.y);
        ctx.scale(escala, escala);
        ctx.font = `900 ${animacion.tamano}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(3, animacion.tamano * 0.22);
        ctx.strokeStyle = animacion.borde;
        ctx.fillStyle = animacion.color;
        ctx.shadowColor = "rgba(255, 98, 0, 0.55)";
        ctx.shadowBlur = 10;
        ctx.strokeText(animacion.texto, 0, 0);
        ctx.fillText(animacion.texto, 0, 0);
        ctx.restore();
      });
    }

    dibujarAnimacionesCelebracion() {
      if (!this.animacionesCelebracion.length) return;
      const ctx = this.ctx;
      this.animacionesCelebracion.forEach((animacion) => {
        const progreso = clamp(animacion.tiempo / animacion.duracion, 0, 1);
        const alpha = 1 - Math.max(0, progreso - 0.72) / 0.28;
        const pulso = 1 + Math.sin(progreso * Math.PI) * 0.22;

        ctx.save();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.translate(animacion.x, animacion.y);
        ctx.rotate(animacion.rotacion);
        ctx.scale(pulso, pulso);
        ctx.shadowColor = animacion.color;
        ctx.shadowBlur = animacion.radio * 1.2 * alpha;

        const gradiente = ctx.createRadialGradient(-animacion.radio * 0.35, -animacion.radio * 0.35, animacion.radio * 0.1, 0, 0, animacion.radio);
        gradiente.addColorStop(0, "#ffffff");
        gradiente.addColorStop(0.28, animacion.color);
        gradiente.addColorStop(1, "rgba(20, 42, 20, 0.9)");
        ctx.fillStyle = gradiente;
        ctx.beginPath();
        ctx.arc(0, 0, animacion.radio, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = Math.max(1, animacion.radio * 0.18);
        ctx.strokeStyle = animacion.borde;
        ctx.stroke();

        if (progreso < 0.55) {
          ctx.globalAlpha = clamp(alpha * 0.38, 0, 0.38);
          ctx.strokeStyle = animacion.color;
          ctx.lineWidth = Math.max(1, animacion.radio * 0.12);
          ctx.beginPath();
          ctx.arc(0, 0, animacion.radio * (1.5 + progreso * 2.2), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    dibujarAnimacionesCaida() {
      if (!this.animacionesCaida.length) return;
      this.animacionesCaida.forEach((animacion) => {
        const alpha = clamp(1 - (animacion.y - this.geometria.origenY) / (this.canvas.height - this.geometria.origenY + animacion.radio), 0.18, 1);
        this.dibujarBurbuja(animacion.burbuja, animacion.x, animacion.y, { alpha, rotacion: animacion.rotacion, escala: 1 });
      });
    }
  }

  function crear(selectorOContenedor, dataset, opciones = {}) {
    let contenedor = selectorOContenedor;
    if (typeof selectorOContenedor === "string") {
      contenedor = document.querySelector(selectorOContenedor);
    }
    if (!(contenedor instanceof HTMLElement)) {
      throw new Error("Bubble Profearauco 2: el contenedor no es valido.");
    }
    const juego = new JuegoBubbleProfearauco(contenedor, dataset, opciones);
    return juego.iniciar();
  }

  window.BubbleProfearauco2 = {
    crear,
    temas: TEMAS,
    utilidades: { mezclar, limpiarTextoCanvas, prepararTextoMatematico, normalizarLatexDataset, normalizarJSONBubble, normalizarDatasetBubble, normalizarLatexAmigable, obtenerLatexCanvas }
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".juegosprofearauco-bubble2-auto").forEach(function (root) {
    if (root.dataset.bubble2Renderizado === "1") return;

    const datasetBox = root.querySelector(".juegosprofearauco-bubble2-dataset") || root.querySelector(".juegosprofearauco-dataset");
    if (!datasetBox) {
      root.innerHTML = "<p><strong>Error:</strong> No se encontro el dataset del Bubble 2.</p>";
      return;
    }

    if (!window.BubbleProfearauco2) {
      root.innerHTML = "<p><strong>Error:</strong> No se encontro el motor BubbleProfearauco2.</p>";
      return;
    }

    let dataset;
    try {
      dataset = window.BubbleProfearauco2.utilidades.normalizarJSONBubble(datasetBox.value);
      dataset = window.BubbleProfearauco2.utilidades.normalizarLatexDataset(dataset);
    } catch (error) {
      root.innerHTML = "<p><strong>Error:</strong> El dataset del Bubble 2 no tiene formato JSON valido.</p><p>Revisa comas, comillas dobles y barras invertidas de LaTeX.</p>";
      console.error("Error JSON Bubble Profearauco 2:", error);
      return;
    }

    root.dataset.bubble2Renderizado = "1";
    root.innerHTML = "";

    window.BubbleProfearauco2.crear(root, dataset, {
      columnas: Number(root.dataset.columnas || dataset.config?.columnas || 8),
      filasVisibles: Number(root.dataset.filasVisibles || dataset.config?.filasVisibles || 12),
      filasIniciales: Number(root.dataset.filasIniciales || dataset.config?.filasIniciales || 4),
      tamanoBurbuja: Number(root.dataset.tamanoBurbuja || dataset.config?.tamanoBurbuja || 42),
      nivelInicial: Number(root.dataset.nivelInicial || dataset.config?.nivelInicial || 1),
      tema: root.dataset.tema || dataset.config?.tema || "arauco-dark"
    });
  });
});
