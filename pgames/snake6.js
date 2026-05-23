

/* ============================================================
     SNAKE MATEMÁTICO v0.3 - CON AUDIO PROCEDURAL Y BGM
     Motor reutilizable + autorender para Moodle / Profe Arauco.

     Mejoras añadidas:
     - Sintetizador de audio procedural (Web Audio API)
     - Música de fondo (BGM) retro de 8-bits dinámica y suave.
     - Botón de control de volumen (Mute/Unmute)
     - Tonos dinámicos según racha de aciertos
     - Acepta [m]...[/m] y [M]...[/M] dentro del JSON.
     - Repara LaTeX escrito con barra simple dentro del textarea.
     ============================================================ */

(function () {
  "use strict";

  const PALETA_ALTERNATIVAS =[
    { id: "rojo", nombre: "Rojo", hex: "#e53935" },
    { id: "azul", nombre: "Azul", hex: "#1e88e5" },
    { id: "verde", nombre: "Verde", hex: "#43a047" },
    { id: "naranja", nombre: "Naranja", hex: "#fb8c00" },
    { id: "morado", nombre: "Morado", hex: "#8e24aa" },
    { id: "cian", nombre: "Cian", hex: "#00acc1" },
    { id: "rosado", nombre: "Rosado", hex: "#d81b60" },
    { id: "amarillo", nombre: "Amarillo", hex: "#fdd835" },
    { id: "lima", nombre: "Lima", hex: "#7cb342" },
    { id: "indigo", nombre: "Índigo", hex: "#3949ab" },
    { id: "cafe", nombre: "Café", hex: "#6d4c41" },
    { id: "gris", nombre: "Gris", hex: "#757575" },
    { id: "turquesa", nombre: "Turquesa", hex: "#00897b" },
    { id: "granate", nombre: "Granate", hex: "#c2185b" },
    { id: "violeta", nombre: "Violeta", hex: "#5e35b1" },
    { id: "oliva", nombre: "Oliva", hex: "#827717" }
  ];

  const PALETA_ALTERNATIVAS_SNAKE3 =[
    { id: "rojo", nombre: "Rojo", hex: "#ff4d4f" },
    { id: "azul", nombre: "Azul", hex: "#2f7cff" },
    { id: "verde", nombre: "Verde", hex: "#32d26a" },
    { id: "naranja", nombre: "Naranja", hex: "#ff8a1f" },
    { id: "morado", nombre: "Morado", hex: "#9b59ff" },
    { id: "cian", nombre: "Cian", hex: "#00cfd5" },
    { id: "rosado", nombre: "Rosado", hex: "#ff4fa3" },
    { id: "amarillo", nombre: "Amarillo", hex: "#ffd43b" }
  ];

  const TEMAS = {
    "arauco-dark": {
      fondoTablero: "#050505",
      grilla: "#123d22",
      bordeTablero: "#ff6200",
      snakeCabeza: "#ff6200",
      snakeCuerpo: "#4caf50",
      snakeBorde: "#e8ffe8",
      bordeObjeto: "#f5f5f5",
      fondoPanel: "#101510",
      bordePanel: "#4caf50",
      texto: "#f5f5f5",
      textoSuave: "#cfcfcf",
      correcto: "#4caf50",
      incorrecto: "#ff6200"
    },
    "arauco-arcade": {
      fondoTablero: "#030603",
      grilla: "#184a25",
      bordeTablero: "#ff7a00",
      snakeCabeza: "#ff7a00",
      snakeCuerpo: "#60d76f",
      snakeBorde: "#f6fff2",
      bordeObjeto: "#fff4dc",
      fondoPanel: "#09120b",
      bordePanel: "#60d76f",
      texto: "#f5f5f5",
      textoSuave: "#d8ead8",
      correcto: "#78ff8a",
      incorrecto: "#ff8d3a"
    }
  };

  const VELOCIDADES = {
    lenta: 260,
    media: 180,
    rapida: 120
  };

  const DIRECCIONES_POR_TECLA = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 }
  };

  const PREFIJO_UI = "juegosprofearauco";

  function claseUI(sufijo) {
    return `${PREFIJO_UI}-${sufijo}`;
  }

  function selectorClaseUI(sufijo) {
    return `.${claseUI(sufijo)}`;
  }

  function buscarPorClase(contenedor, sufijo) {
    return contenedor.querySelector(selectorClaseUI(sufijo));
  }

  function trazarRectRedondeado(ctx, x, y, ancho, alto, radio) {
    const r = Math.min(radio, ancho / 2, alto / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + ancho, y, x + ancho, y + alto, r);
    ctx.arcTo(x + ancho, y + alto, x, y + alto, r);
    ctx.arcTo(x, y + alto, x, y, r);
    ctx.arcTo(x, y, x + ancho, y, r);
    ctx.closePath();
  }

  function inyectarEstilosSnake3() {
    if (document.getElementById("snake3-profearauco-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "snake3-profearauco-style";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Press+Start+2P&display=swap');

      /* Scoped body reset applied only in standalone / dedicated pages or iframes */
      body.snake3-standalone-body {
        background-color: #030603 !important;
        color: #f5f5f5 !important;
        font-family: 'Outfit', sans-serif !important;
        min-height: 100vh !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        overflow: hidden !important;
        padding: 1rem !important;
        margin: 0 !important;
      }

      /* Scoped CSS reset to avoid breaking Moodle host container styles */
      .juegosprofearauco-snake3-root * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      /* Ocultar elementos DOM del motor que ya no usaremos */
      .juegosprofearauco-snake3-dataset,
      .juegosprofearauco-dataset {
        display: none !important;
      }

      /* Contenedor principal centrado */
      .juegosprofearauco-snake3-root {
        width: 100%;
        max-width: 1920px; /* Aumentado a 1920px para que luzca espectacular en pantallas grandes y TV 4K */
        height: auto;
        aspect-ratio: 16 / 9;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        box-sizing: border-box;
      }

      /* El lienzo (Canvas) 16:9 */
      .juegosprofearauco-snake3-root canvas {
        width: 100%;
        height: 100%;
        display: block;
        background-color: #040804;
        border-radius: 20px;
        box-shadow: 
          0 18px 54px rgba(0, 0, 0, 0.6),
          0 0 0 1px rgba(96, 215, 111, 0.15);
        cursor: default;
        transition: border-radius 0.2s ease;
        box-sizing: border-box;
      }

      /* Sobrescribir límites al entrar en modo pantalla completa */
      .juegosprofearauco-snake3-root:fullscreen {
        max-width: none !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: #030603 !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      /* Escalado responsivo perfecto 16:9 sin distorsión en 4K */
      .juegosprofearauco-snake3-root:fullscreen canvas {
        width: min(100vw, 177.78vh) !important;
        height: min(100vh, 56.25vw) !important;
        border-radius: 0px !important;
        box-shadow: none !important;
      }

      /* Soporte para navegadores basados en Webkit (Safari, Chrome antiguos) */
      .juegosprofearauco-snake3-root:-webkit-full-screen {
        max-width: none !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: #030603 !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .juegosprofearauco-snake3-root:-webkit-full-screen canvas {
        width: min(100vw, 177.78vh) !important;
        height: min(100vh, 56.25vw) !important;
        border-radius: 0px !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);

    // Apply standalone layout on body if running dedicated or in iframe
    if (document.body && !document.body.classList.contains("snake3-standalone-body")) {
      const isStandalone = window.self === window.top || document.querySelectorAll('body > *:not(script):not(style)').length <= 2;
      if (isStandalone) {
        document.body.classList.add("snake3-standalone-body");
      }
    }
  }

  // --- SINTETIZADOR DE AUDIO PROCEDURAL ---
  class SintetizadorSnake {
    constructor() {
      this.ctx = null;
      this.habilitado = true;
      
      // Control de la música de fondo
      this.bgmActivo = false;
      this.intervaloBgm = null;
      this.siguienteTiempoNota = 0;
      this.indiceNotaActual = 0;
      this.nodosBgm = [];
      this.secuenciaBgm = [
        // Arpegio retro: La menor
        220.00, 261.63, 329.63, 440.00,
        // Mi menor
        164.81, 196.00, 246.94, 329.63,
        // Fa mayor
        174.61, 220.00, 261.63, 349.23,
        // Sol mayor
        196.00, 246.94, 293.66, 392.00
      ];
    }

    inicializar() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    // --- MÉTODOS DE BGM (Música de fondo) ---
    iniciarMusica() {
      if (!this.ctx || !this.habilitado || this.bgmActivo) return;
      this.bgmActivo = true;
      
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      this.siguienteTiempoNota = this.ctx.currentTime + 0.1;
      this.indiceNotaActual = 0;
      
      this.planificarMusica();
      this.intervaloBgm = setInterval(() => this.planificarMusica(), 250);
    }

    planificarMusica() {
      if (!this.bgmActivo || !this.ctx) return;

      const ahora = this.ctx.currentTime;
      // Limpiamos los nodos que ya terminaron de reproducirse
      this.nodosBgm = this.nodosBgm.filter(nodo => nodo.stopTime > ahora);

      const lookahead = 0.5; // Segundos que planifica a futuro
      const duracionNota = 0.18; // Velocidad del arpegio
      
      while (this.siguienteTiempoNota < ahora + lookahead) {
        const frecuencia = this.secuenciaBgm[this.indiceNotaActual];
        this.tocarNotaBgm(frecuencia, this.siguienteTiempoNota, duracionNota);
        
        this.siguienteTiempoNota += duracionNota;
        this.indiceNotaActual = (this.indiceNotaActual + 1) % this.secuenciaBgm.length;
      }
    }

    tocarNotaBgm(frecuencia, tiempo, duracion) {
      if (!this.ctx) return;

      const oscilador = this.ctx.createOscillator();
      const filtro = this.ctx.createBiquadFilter();
      const ganancia = this.ctx.createGain();

      oscilador.type = 'square'; 
      oscilador.frequency.value = frecuencia;

      // Filtro pasa-bajos para darle suavidad y calidez al 8-bit
      filtro.type = 'lowpass';
      filtro.frequency.value = 600;

      // Volumen muy sutil para la música de fondo
      const volMax = 0.025; 
      ganancia.gain.setValueAtTime(0, tiempo);
      ganancia.gain.linearRampToValueAtTime(volMax, tiempo + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.001, tiempo + duracion - 0.01);

      oscilador.connect(filtro);
      filtro.connect(ganancia);
      ganancia.connect(this.ctx.destination);

      oscilador.start(tiempo);
      oscilador.stop(tiempo + duracion);

      this.nodosBgm.push({ osc: oscilador, stopTime: tiempo + duracion });
    }

    detenerMusica() {
      this.bgmActivo = false;
      if (this.intervaloBgm) {
        clearInterval(this.intervaloBgm);
        this.intervaloBgm = null;
      }
      // Forzar parada de las notas programadas inmediatamente
      this.nodosBgm.forEach(nodo => {
        try { nodo.osc.stop(); } catch(e) {}
      });
      this.nodosBgm = [];
    }

    // --- MÉTODOS SFX (Efectos de Sonido) ---
    tocarTono(frecuencia, tipoOnda, duracion, volumen = 0.1) {
      if (!this.ctx || !this.habilitado) return;

      const oscilador = this.ctx.createOscillator();
      const ganancia = this.ctx.createGain();

      oscilador.type = tipoOnda;
      oscilador.frequency.setValueAtTime(frecuencia, this.ctx.currentTime);

      ganancia.gain.setValueAtTime(volumen, this.ctx.currentTime);
      ganancia.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duracion);

      oscilador.connect(ganancia);
      ganancia.connect(this.ctx.destination);

      oscilador.start(this.ctx.currentTime);
      oscilador.stop(this.ctx.currentTime + duracion);
    }

    playAparicion() {
      this.tocarTono(600, 'sine', 0.05, 0.05);
    }

    playCorrecto(racha = 0) {
      const limiteRacha = Math.min(racha, 12);
      const tonoBase = 440 + (limiteRacha * 25);
      this.tocarTono(tonoBase, 'triangle', 0.1, 0.15);
      setTimeout(() => this.tocarTono(tonoBase * 1.5, 'triangle', 0.15, 0.15), 100);
    }

    playIncorrecto() {
      this.tocarTono(150, 'sawtooth', 0.3, 0.15);
      setTimeout(() => this.tocarTono(100, 'sawtooth', 0.4, 0.15), 150);
    }

    playChoque() {
      this.tocarTono(120, 'square', 0.2, 0.15);
    }

    playGameOver() {
      this.tocarTono(200, 'square', 0.2, 0.2);
      setTimeout(() => this.tocarTono(150, 'square', 0.2, 0.2), 200);
      setTimeout(() => this.tocarTono(100, 'square', 0.6, 0.2), 400);
    }
  }

  function obtenerTouchPorIdentificador(lista, identificador) {
    if (identificador === null || typeof identificador === "undefined") {
      return lista[0] || null;
    }

    for (let i = 0; i < lista.length; i++) {
      if (lista[i].identifier === identificador) {
        return lista[i];
      }
    }

    return null;
  }

  function mezclar(arreglo) {
    const copia = [...arreglo];

    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] =[copia[j], copia[i]];
    }

    return copia;
  }

  function tomarAleatorios(arreglo, cantidad) {
    return mezclar(arreglo).slice(0, cantidad);
  }

  function distanciaManhattan(origen, destino) {
    if (!origen || !destino) {
      return 0;
    }

    return Math.abs(origen.x - destino.x) + Math.abs(origen.y - destino.y);
  }

  function normalizarDataset(dataset) {
    if (!dataset) {
      throw new Error("Snake Matemático: no se recibió dataset.");
    }

    if (Array.isArray(dataset)) {
      return {
        titulo: "Snake 3 Profearauco",
        preguntas: dataset
      };
    }

    if (!Array.isArray(dataset.preguntas)) {
      throw new Error("Snake Matemático: el dataset debe tener un arreglo llamado 'preguntas'.");
    }

    return dataset;
  }

  function validarPregunta(pregunta) {
    if (!pregunta || !pregunta.enunciado) {
      return false;
    }

    if (!Array.isArray(pregunta.opciones) || pregunta.opciones.length < 2) {
      return false;
    }

    const correctas = pregunta.opciones.filter((opcion) => opcion.correcta === true);

    return correctas.length === 1;
  }

  function obtenerNivel(pregunta) {
    return Number(pregunta.nivel || pregunta.dificultad || 1);
  }

  function crearColaPorNivel(preguntas, configuracion) {
    const grupos = {};

    preguntas.forEach((pregunta) => {
      const nivel = obtenerNivel(pregunta);

      if (!grupos[nivel]) {
        grupos[nivel] = [];
      }

      grupos[nivel].push(pregunta);
    });

    const nivelesOrdenados = Object.keys(grupos)
      .map(Number)
      .sort((a, b) => a - b);

    const cola =[];

    nivelesOrdenados.forEach((nivel) => {
      let preguntasNivel = grupos[nivel];

      if (configuracion.mezclarDentroDelNivel !== false) {
        preguntasNivel = mezclar(preguntasNivel);
      }

      if (
        configuracion.preguntasPorNivel &&
        typeof configuracion.preguntasPorNivel[nivel] === "number"
      ) {
        preguntasNivel = preguntasNivel.slice(0, configuracion.preguntasPorNivel[nivel]);
      }

      cola.push(...preguntasNivel);
    });

    return cola;
  }

  function prepararTextoMatematico(texto) {
    return String(texto || "")
      .replace(/\[M\]([\s\S]*?)\[\/M\]/g, "\\[$1\\]")
      .replace(/\[m\]([\s\S]*?)\[\/m\]/g, "\\($1\\)");
  }

  function normalizarLatexDataset(valor) {
    if (typeof valor === "string") {
      return prepararTextoMatematico(valor);
    }

    if (Array.isArray(valor)) {
      return valor.map(normalizarLatexDataset);
    }

    if (valor && typeof valor === "object") {
      Object.keys(valor).forEach(function (clave) {
        valor[clave] = normalizarLatexDataset(valor[clave]);
      });
    }

    return valor;
  }

  function renderizarLatex(contenedor) {
    if (
      window.MathJax &&
      typeof window.MathJax.typesetPromise === "function"
    ) {
      window.MathJax.typesetPromise([contenedor]).catch(function () {});
    }
  }

  function normalizarJSONSnake(textoOriginal) {
    let texto = String(textoOriginal || "").trim();

    try {
      return JSON.parse(texto);
    } catch (errorOriginal) {
      const reparado = texto
        .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

      try {
        return JSON.parse(reparado);
      } catch (errorReparado) {
        errorReparado.message =
          "JSON inválido incluso después de intentar reparar barras de LaTeX. " +
          errorReparado.message;
        throw errorReparado;
      }
    }
  }

  class JuegoSnakeMatematico {
    constructor(contenedor, dataset, opciones = {}) {
      this.contenedor = contenedor;
      this.dataset = normalizarDataset(dataset);
      this.sintetizador = new SintetizadorSnake();

      this.config = {
        columnas: Number(opciones.columnas || 26),
        filas: Number(opciones.filas || 15),
        tamanoCelda: Number(opciones.tamanoCelda || 30),
        velocidad: opciones.velocidad || "media",
        vidasIniciales: Number(opciones.vidas || 3),
        alternativas: Number(opciones.alternativas || 3),
        puntosCorrecto: Number(opciones.puntosCorrecto || 10),
        puntosIncorrecto: Number(opciones.puntosIncorrecto || -5),
        crecimientoCorrecto: Number(opciones.crecimientoCorrecto || 1),
        mezclarDentroDelNivel: opciones.mezclarDentroDelNivel !== false,
        preguntasPorNivel: opciones.preguntasPorNivel || null,
        paleta: opciones.paleta || PALETA_ALTERNATIVAS_SNAKE3,
        tema: opciones.tema || "arauco-dark"
      };

      this.tema = this.resolverTema(this.config.tema);

      this.canvas = null;
      this.ctx = null;
      this.elShell = null;

      this.colaPreguntas = [];
      this.preguntaActual = null;
      this.escenaActual = null;
      this.preguntasTotales = 0;
      this.preguntasResueltas = 0;
      this.rachaActual = 0;
      this.mejorRacha = 0;
      this.snakeEnvenenadoHasta = 0;

      this.snake = [];
      this.direccion = { x: 1, y: 0 };
      this.siguienteDireccion = { x: 1, y: 0 };
      this.crecimientoPendiente = 0;
      this.puntaje = 0;
      this.vidas = this.config.vidasIniciales;
      this.enEjecucion = false;
      this.finalizado = false;
      this.intervalo = null;
      this.touchInicio = null;
      this.touchActivoId = null;

      // Layout & coordinates based on user mockup (1280x720 resolution)
      this.boardOffset = { x: 40, y: 130 };
      this.hoveredBoton = null;
      this.botones = {
        iniciar: { x1: 860, y1: 630, x2: 975, y2: 680, label: "Iniciar" },
        sonido: { x1: 990, y1: 630, x2: 1105, y2: 680, label: "Sonido" },
        reiniciar: { x1: 1120, y1: 630, x2: 1240, y2: 680, label: "Reiniciar" },
        fullscreen: { x1: 40, y1: 630, x2: 230, y2: 680, label: "Pantalla completa" }
      };

      this.manejarTecla = this.manejarTecla.bind(this);
      this.manejarTouchStart = this.manejarTouchStart.bind(this);
      this.manejarTouchMove = this.manejarTouchMove.bind(this);
      this.manejarTouchEnd = this.manejarTouchEnd.bind(this);
      this.manejarTouchCancel = this.manejarTouchCancel.bind(this);
      this.alternarPantallaCompleta = this.alternarPantallaCompleta.bind(this);
      this.manejarCambioFullscreen = this.manejarCambioFullscreen.bind(this);
      this.actualizarModoPantalla = this.actualizarModoPantalla.bind(this);
      this.manejarMouseMove = this.manejarMouseMove.bind(this);
      this.manejarClick = this.manejarClick.bind(this);
    }

    resolverTema(tema) {
      if (typeof tema === "string") {
        return TEMAS[tema] || TEMAS["arauco-dark"];
      }
      return {
        ...TEMAS["arauco-dark"],
        ...tema
      };
    }

    async alternarPantallaCompleta() {
      if (!this.elShell) return;
      try {
        if (document.fullscreenElement === this.elShell) {
          await document.exitFullscreen();
          return;
        }
        if (!document.fullscreenElement) {
          await this.elShell.requestFullscreen();
        }
      } catch (error) {
        console.error("Snake 3 fullscreen:", error);
      }
    }

    manejarCambioFullscreen() {
      const activa = document.fullscreenElement === this.elShell;
      if (this.elShell) {
        this.elShell.classList.toggle("is-fullscreen", activa);
      }
      this.dibujar();
    }

    actualizarModoPantalla() {
      // Scale-to-fit is handled elegantly by CSS aspect-ratio on container
    }

    iniciar() {
      this.construirInterfaz();
      this.reiniciar();
      this.iniciarRenderLoop();
      document.addEventListener("keydown", this.manejarTecla);
      document.addEventListener("fullscreenchange", this.manejarCambioFullscreen);
      return this;
    }

    destruir() {
      this.detener();
      document.removeEventListener("keydown", this.manejarTecla);
      document.removeEventListener("fullscreenchange", this.manejarCambioFullscreen);
      this.canvas.removeEventListener("mousemove", this.manejarMouseMove);
      this.canvas.removeEventListener("mousedown", this.manejarClick);
      this.desregistrarControlesTouch();
      this.contenedor.innerHTML = "";
    }

    construirInterfaz() {
      inyectarEstilosSnake3();

      this.contenedor.classList.add(claseUI("app"));
      this.contenedor.classList.add("juegosprofearauco-snake3-root");

      this.contenedor.innerHTML = `<canvas></canvas>`;
      this.canvas = this.contenedor.querySelector("canvas");
      this.ctx = this.canvas.getContext("2d");

      // Set logical aspect ratio 16:9
      this.canvas.width = 1280;
      this.canvas.height = 720;

      this.elShell = this.contenedor;

      this.registrarControlesTouch();

      this.canvas.addEventListener("mousemove", this.manejarMouseMove);
      this.canvas.addEventListener("mousedown", this.manejarClick);
      this.canvas.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches[0]) {
          const rect = this.canvas.getBoundingClientRect();
          const mx = ((e.touches[0].clientX - rect.left) / rect.width) * 1280;
          const my = ((e.touches[0].clientY - rect.top) / rect.height) * 720;
          
          this.sintetizador.inicializar();
          
          for (const [key, btn] of Object.entries(this.botones)) {
            if (mx >= btn.x1 && mx <= btn.x2 && my >= btn.y1 && my <= btn.y2) {
              this.ejecutarAccionBoton(key);
              e.preventDefault();
              break;
            }
          }
        }
      }, { passive: false });
    }

    registrarControlesTouch() {
      if (!this.canvas) return;
      this.canvas.addEventListener("touchstart", this.manejarTouchStart, { passive: false });
      this.canvas.addEventListener("touchmove", this.manejarTouchMove, { passive: false });
      this.canvas.addEventListener("touchend", this.manejarTouchEnd, { passive: false });
      this.canvas.addEventListener("touchcancel", this.manejarTouchCancel);
    }

    desregistrarControlesTouch() {
      if (!this.canvas) return;
      this.canvas.removeEventListener("touchstart", this.manejarTouchStart);
      this.canvas.removeEventListener("touchmove", this.manejarTouchMove);
      this.canvas.removeEventListener("touchend", this.manejarTouchEnd);
      this.canvas.removeEventListener("touchcancel", this.manejarTouchCancel);
    }

    reiniciar() {
      this.detener();

      const preguntasValidas = this.dataset.preguntas.filter(validarPregunta);

      this.colaPreguntas = crearColaPorNivel(preguntasValidas, {
        mezclarDentroDelNivel: this.config.mezclarDentroDelNivel,
        preguntasPorNivel: this.config.preguntasPorNivel
      });

      this.puntaje = 0;
      this.vidas = this.config.vidasIniciales;
      this.finalizado = false;
      this.crecimientoPendiente = 0;
      this.preguntasTotales = this.colaPreguntas.length;
      this.preguntasResueltas = 0;
      this.rachaActual = 0;
      this.mejorRacha = 0;
      this.snakeEnvenenadoHasta = 0;
      this.reiniciarSnake();
      this.limpiarVisualesTablero();
      this.cargarSiguientePregunta();
    }

    comenzar() {
      if (this.finalizado) return;

      this.enEjecucion = true;
      const demora = VELOCIDADES[this.config.velocidad] || VELOCIDADES.media;
      clearInterval(this.intervalo);

      this.sintetizador.iniciarMusica();

      this.intervalo = setInterval(() => {
        this.actualizar();
      }, demora);
      this.dibujar();
    }

    detener() {
      this.enEjecucion = false;
      clearInterval(this.intervalo);
      this.intervalo = null;
      
      this.sintetizador.detenerMusica();
      this.dibujar();
    }

    finalizar(mensaje) {
      this.detener();
      this.finalizado = true;
      this.dibujar();
    }

    reiniciarSnake() {
      const y = Math.floor(this.config.filas / 2);
      this.snake = [
        { x: 5, y },
        { x: 4, y },
        { x: 3, y }
      ];
      this.direccion = { x: 1, y: 0 };
      this.siguienteDireccion = { x: 1, y: 0 };
    }

    cargarSiguientePregunta() {
      if (this.colaPreguntas.length === 0) {
        this.sintetizador.playAparicion();
        this.finalizar("Actividad completada.");
        return;
      }

      this.preguntaActual = this.colaPreguntas.shift();
      this.escenaActual = this.crearEscena(this.preguntaActual);
      this.sintetizador.playAparicion();
      this.dibujar();
    }

    crearEscena(pregunta) {
      const correcta = pregunta.opciones.find((opcion) => opcion.correcta === true);
      let opciones = mezclar(pregunta.opciones).slice(0, this.config.alternativas);

      if (!opciones.some((opcion) => opcion.correcta === true)) {
        opciones.pop();
        opciones.push(correcta);
      }

      opciones = mezclar(opciones);
      const colores = tomarAleatorios(this.config.paleta, opciones.length);
      const posicionesReservadas = [];

      const objetos = opciones.map((opcion, indice) => {
        const posicion = this.buscarPosicionLibre(posicionesReservadas);
        posicionesReservadas.push(posicion);

        return {
          id: `objeto-${indice}`,
          opcion,
          color: colores[indice],
          posicion
        };
      });

      return {
        pregunta,
        objetos
      };
    }

    buscarPosicionLibre(posicionesReservadas = []) {
      let posicion = null;
      let intentos = 0;
      const cabeza = this.snake[0];
      const distanciaMinimaCabeza = 5;

      do {
        posicion = {
          x: Math.floor(Math.random() * this.config.columnas),
          y: Math.floor(Math.random() * this.config.filas)
        };
        intentos++;
      } while (
        (
          !this.esPosicionLibre(posicion, posicionesReservadas) ||
          (cabeza &&
            intentos < 220 &&
            distanciaManhattan(posicion, cabeza) <= distanciaMinimaCabeza)
        ) &&
        intentos < 300
      );

      return posicion;
    }

    esPosicionLibre(posicion, posicionesReservadas = []) {
      const chocaSnake = this.snake.some(
        (parte) => parte.x === posicion.x && parte.y === posicion.y
      );

      if (chocaSnake) return false;

      if (this.escenaActual && Array.isArray(this.escenaActual.objetos)) {
        const chocaObjeto = this.escenaActual.objetos.some(
          (objeto) =>
            objeto.posicion.x === posicion.x &&
            objeto.posicion.y === posicion.y
        );
        if (chocaObjeto) return false;
      }

      const chocaReservada = posicionesReservadas.some(
        (reservada) => reservada.x === posicion.x && reservada.y === posicion.y
      );

      return !chocaReservada;
    }

    limpiarVisualesTablero() {
      this.snakeEnvenenadoHasta = 0;
    }

    activarEnvenenamiento(duracion = 1000) {
      this.snakeEnvenenadoHasta = Date.now() + duracion;
    }

    estaEnvenenado() {
      return Date.now() < this.snakeEnvenenadoHasta;
    }

    intentarCambiarDireccion(nuevaDireccion) {
      if (!nuevaDireccion) return false;

      const esOpuesta =
        nuevaDireccion.x + this.direccion.x === 0 &&
        nuevaDireccion.y + this.direccion.y === 0;

      if (esOpuesta) return false;

      this.siguienteDireccion = nuevaDireccion;
      return true;
    }

    manejarTecla(evento) {
      const tecla = evento.key.toLowerCase();
      const nuevaDireccion = DIRECCIONES_POR_TECLA[tecla];

      if (!nuevaDireccion) return;

      this.intentarCambiarDireccion(nuevaDireccion);
      evento.preventDefault();
    }

    manejarTouchStart(evento) {
      const touch = evento.changedTouches[0];
      if (!touch) return;

      this.touchActivoId = touch.identifier;
      this.touchInicio = {
        x: touch.clientX,
        y: touch.clientY
      };

      if (evento.cancelable) evento.preventDefault();
    }

    manejarTouchMove(evento) {
      if (!this.touchInicio) return;
      if (evento.cancelable) evento.preventDefault();
    }

    manejarTouchEnd(evento) {
      if (!this.touchInicio) return;

      const touch = obtenerTouchPorIdentificador(
        evento.changedTouches,
        this.touchActivoId
      );

      if (!touch) {
        this.limpiarGestoTouch();
        return;
      }

      const dx = touch.clientX - this.touchInicio.x;
      const dy = touch.clientY - this.touchInicio.y;
      const umbral = Math.max(18, Math.round(this.config.tamanoCelda * 0.75));

      if (Math.abs(dx) >= umbral || Math.abs(dy) >= umbral) {
        const nuevaDireccion = Math.abs(dx) > Math.abs(dy)
          ? { x: dx > 0 ? 1 : -1, y: 0 }
          : { x: 0, y: dy > 0 ? 1 : -1 };

        this.intentarCambiarDireccion(nuevaDireccion);
      }

      this.limpiarGestoTouch();
      if (evento.cancelable) evento.preventDefault();
    }

    manejarTouchCancel() {
      this.limpiarGestoTouch();
    }

    limpiarGestoTouch() {
      this.touchInicio = null;
      this.touchActivoId = null;
    }

    actualizar() {
      if (!this.enEjecucion || this.finalizado) return;

      this.direccion = this.siguienteDireccion;
      const cabeza = this.snake[0];

      const nuevaCabeza = {
        x: cabeza.x + this.direccion.x,
        y: cabeza.y + this.direccion.y
      };

      if (this.chocaConMuro(nuevaCabeza) || this.chocaConsigoMismo(nuevaCabeza)) {
        this.gestionarChoque();
        return;
      }

      this.snake.unshift(nuevaCabeza);
      const objetoComido = this.obtenerObjetoEn(nuevaCabeza);

      if (objetoComido) {
        this.gestionarComida(objetoComido);
      }

      if (this.crecimientoPendiente > 0) {
        this.crecimientoPendiente--;
      } else {
        this.snake.pop();
      }

      this.dibujar();
    }

    chocaConMuro(posicion) {
      return (
        posicion.x < 0 ||
        posicion.y < 0 ||
        posicion.x >= this.config.columnas ||
        posicion.y >= this.config.filas
      );
    }

    chocaConsigoMismo(posicion) {
      return this.snake.some(
        (parte) => parte.x === posicion.x && parte.y === posicion.y
      );
    }

    obtenerObjetoEn(posicion) {
      if (!this.escenaActual) return null;
      return this.escenaActual.objetos.find(
        (objeto) =>
          objeto.posicion.x === posicion.x &&
          objeto.posicion.y === posicion.y
      );
    }

    gestionarChoque() {
      this.vidas--;
      this.rachaActual = 0;

      if (this.vidas <= 0) {
        this.sintetizador.playGameOver();
        this.finalizar("Juego terminado. Te quedaste sin vidas.");
        return;
      }

      this.sintetizador.playChoque();
      this.reiniciarSnake();
      this.dibujar();
    }

    gestionarComida(objeto) {
      const esCorrecta = objeto.opcion.correcta === true;

      if (esCorrecta) {
        this.rachaActual++;
        this.sintetizador.playCorrecto(this.rachaActual);
        this.puntaje += this.config.puntosCorrecto;
        this.crecimientoPendiente += this.config.crecimientoCorrecto;
        this.preguntasResueltas++;
        this.mejorRacha = Math.max(this.mejorRacha, this.rachaActual);

        setTimeout(() => {
          if (!this.finalizado) {
            this.cargarSiguientePregunta();
            this.dibujar();
          }
        }, 650);

        return;
      }

      this.puntaje += this.config.puntosIncorrecto;
      this.vidas--;
      this.rachaActual = 0;
      this.activarEnvenenamiento(1000);

      if (this.vidas <= 0) {
        this.sintetizador.playGameOver();
        this.finalizar("Juego terminado. Te quedaste sin vidas.");
      } else {
        this.sintetizador.playIncorrecto();
      }
    }

    manejarMouseMove(evento) {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = ((evento.clientX - rect.left) / rect.width) * 1280;
      const my = ((evento.clientY - rect.top) / rect.height) * 720;

      let hoverPrevio = this.hoveredBoton;
      this.hoveredBoton = null;

      for (const [key, btn] of Object.entries(this.botones)) {
        if (mx >= btn.x1 && mx <= btn.x2 && my >= btn.y1 && my <= btn.y2) {
          this.hoveredBoton = key;
          break;
        }
      }

      if (this.hoveredBoton) {
        this.canvas.style.cursor = "pointer";
      } else {
        this.canvas.style.cursor = "default";
      }

      if (hoverPrevio !== this.hoveredBoton) {
        this.dibujar();
      }
    }

    manejarClick(evento) {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = ((evento.clientX - rect.left) / rect.width) * 1280;
      const my = ((evento.clientY - rect.top) / rect.height) * 720;

      this.sintetizador.inicializar();

      for (const [key, btn] of Object.entries(this.botones)) {
        if (mx >= btn.x1 && mx <= btn.x2 && my >= btn.y1 && my <= btn.y2) {
          this.ejecutarAccionBoton(key);
          break;
        }
      }
    }

    ejecutarAccionBoton(key) {
      if (key === "iniciar") {
        if (this.finalizado) return;
        if (this.enEjecucion) {
          this.detener();
        } else {
          this.comenzar();
        }
      } else if (key === "sonido") {
        this.sintetizador.habilitado = !this.sintetizador.habilitado;
        if (this.sintetizador.habilitado && this.enEjecucion && !this.finalizado) {
          this.sintetizador.iniciarMusica();
        } else {
          this.sintetizador.detenerMusica();
        }
        this.dibujar();
      } else if (key === "reiniciar") {
        this.reiniciar();
        this.dibujar();
      } else if (key === "fullscreen") {
        this.alternarPantallaCompleta();
      }
    }

    iniciarRenderLoop() {
      const loop = () => {
        if (this.canvas && document.body.contains(this.canvas)) {
          this.dibujar();
          requestAnimationFrame(loop);
        }
      };
      requestAnimationFrame(loop);
    }

    limpiarCaracteresMatematicos(texto) {
      return String(texto || "")
        .replace(/\[M\]|\[\/M\]|\[m\]|\[\/m\]/g, "")
        .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
        .replace(/\\times/g, "×")
        .replace(/\\div/g, "÷")
        .replace(/\\cdot/g, "·")
        .replace(/\\minus/g, "−")
        .trim();
    }

    parseMathText(text) {
      let cleanText = String(text || "")
        .replace(/\[M\]|\[\/M\]|\[m\]|\[\/m\]/g, "")
        .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
        .replace(/\\times/g, "×")
        .replace(/\\div/g, "÷")
        .replace(/\\cdot/g, "·")
        .replace(/\\minus/g, "−")
        .replace(/\\le/g, "≤")
        .replace(/\\ge/g, "≥")
        .replace(/\\pm/g, "±")
        .replace(/\\neq/g, "≠")
        .replace(/\\approx/g, "≈")
        .replace(/\\infty/g, "∞")
        .replace(/\\pi/g, "π")
        .replace(/\\alpha/g, "α")
        .replace(/\\beta/g, "β")
        .replace(/\\theta/g, "θ")
        .replace(/\\gamma/g, "γ")
        .replace(/\\Delta/g, "Δ")
        .replace(/\\sigma/g, "σ")
        .replace(/\\sin|\\sen/g, "sen")
        .replace(/\\cos/g, "cos")
        .replace(/\\tan/g, "tan")
        .trim();

      return this.tokenize(cleanText);
    }

    tokenize(str) {
      let tokens = [];
      let i = 0;

      while (i < str.length) {
        if (str.startsWith("\\frac", i)) {
          let firstBraceOpen = str.indexOf("{", i + 5);
          if (firstBraceOpen !== -1) {
            let numEnd = this.findMatchingBrace(str, firstBraceOpen);
            if (numEnd !== -1) {
              let secondBraceOpen = str.indexOf("{", numEnd + 1);
              if (secondBraceOpen !== -1) {
                let denEnd = this.findMatchingBrace(str, secondBraceOpen);
                if (denEnd !== -1) {
                  const numStr = str.substring(firstBraceOpen + 1, numEnd);
                  const denStr = str.substring(secondBraceOpen + 1, denEnd);
                  
                  tokens.push({
                    type: "fraction",
                    num: this.tokenize(numStr),
                    den: this.tokenize(denStr)
                  });
                  
                  i = denEnd + 1;
                  continue;
                }
              }
            }
          }
        }

        if (str.startsWith("\\sqrt", i)) {
          let braceOpen = str.indexOf("{", i + 5);
          if (braceOpen !== -1) {
            let matchingEnd = this.findMatchingBrace(str, braceOpen);
            if (matchingEnd !== -1) {
              const contentStr = str.substring(braceOpen + 1, matchingEnd);
              tokens.push({
                type: "sqrt",
                content: this.tokenize(contentStr)
              });
              i = matchingEnd + 1;
              continue;
            }
          }
        }

        if (str[i] === "^") {
          let lastToken = tokens.pop();
          let base = lastToken ? (lastToken.type === "text" ? lastToken.value : lastToken) : "";
          
          let power = "";
          let nextChar = str[i + 1];
          let endIdx = i + 1;
          
          if (nextChar === "{") {
            let matchingEnd = this.findMatchingBrace(str, i + 1);
            if (matchingEnd !== -1) {
              power = str.substring(i + 2, matchingEnd);
              endIdx = matchingEnd + 1;
            }
          } else {
            let match = /[a-zA-Z0-9]+/.exec(str.substring(i + 1));
            if (match) {
              power = match[0];
              endIdx = i + 1 + power.length;
            }
          }

          if (typeof base === "string" && base.length > 0) {
            let lastChar = base[base.length - 1];
            let remainingBase = base.substring(0, base.length - 1);
            if (remainingBase.length > 0) {
              tokens.push({ type: "text", value: remainingBase });
            }
            tokens.push({
              type: "exponent",
              base: { type: "text", value: lastChar },
              power: this.tokenize(power)
            });
          } else {
            tokens.push({
              type: "exponent",
              base: base || { type: "text", value: "" },
              power: this.tokenize(power)
            });
          }

          i = endIdx;
          continue;
        }

        if (str[i] === "_") {
          let lastToken = tokens.pop();
          let base = lastToken ? (lastToken.type === "text" ? lastToken.value : lastToken) : "";
          
          let sub = "";
          let nextChar = str[i + 1];
          let endIdx = i + 1;
          
          if (nextChar === "{") {
            let matchingEnd = this.findMatchingBrace(str, i + 1);
            if (matchingEnd !== -1) {
              sub = str.substring(i + 2, matchingEnd);
              endIdx = matchingEnd + 1;
            }
          } else {
            let match = /[a-zA-Z0-9]+/.exec(str.substring(i + 1));
            if (match) {
              sub = match[0];
              endIdx = i + 1 + sub.length;
            }
          }

          if (typeof base === "string" && base.length > 0) {
            let lastChar = base[base.length - 1];
            let remainingBase = base.substring(0, base.length - 1);
            if (remainingBase.length > 0) {
              tokens.push({ type: "text", value: remainingBase });
            }
            tokens.push({
              type: "subscript",
              base: { type: "text", value: lastChar },
              sub: this.tokenize(sub)
            });
          } else {
            tokens.push({
              type: "subscript",
              base: base || { type: "text", value: "" },
              sub: this.tokenize(sub)
            });
          }

          i = endIdx;
          continue;
        }

        let char = str[i];
        let lastToken = tokens[tokens.length - 1];
        if (lastToken && lastToken.type === "text") {
          lastToken.value += char;
        } else {
          tokens.push({ type: "text", value: char });
        }
        i++;
      }

      return tokens;
    }

    findMatchingBrace(str, openIndex) {
      let count = 1;
      for (let j = openIndex + 1; j < str.length; j++) {
        if (str[j] === "{") count++;
        else if (str[j] === "}") count--;
        if (count === 0) return j;
      }
      return -1;
    }

    hasExponent(tokens) {
      if (!Array.isArray(tokens)) return false;
      return tokens.some(token => {
        if (token.type === "exponent") return true;
        if (token.type === "fraction") {
          return this.hasExponent(token.num) || this.hasExponent(token.den);
        }
        if (token.type === "sqrt") {
          return this.hasExponent(token.content);
        }
        return false;
      });
    }

    hasFraction(tokens) {
      if (!Array.isArray(tokens)) return false;
      return tokens.some(token => {
        if (token.type === "fraction") return true;
        if (token.type === "exponent") {
          return this.hasFraction([token.base]) || this.hasFraction(token.power);
        }
        if (token.type === "subscript") {
          return this.hasFraction([token.base]) || this.hasFraction(token.sub);
        }
        if (token.type === "sqrt") {
          return this.hasFraction(token.content);
        }
        return false;
      });
    }

    renderTokens(ctx, tokens, x, y, size, color, draw = true) {
      let currentX = x;

      tokens.forEach((token) => {
        if (token.type === "text") {
          ctx.save();
          ctx.font = `600 ${size}px Outfit`;
          ctx.fillStyle = color || "#ffffff";
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          
          if (draw) {
            ctx.fillText(token.value, currentX, y);
          }
          currentX += ctx.measureText(token.value).width;
          ctx.restore();
        } 
        else if (token.type === "fraction") {
          ctx.save();
          ctx.font = `600 ${size * 0.7}px Outfit`;
          
          const numW = this.renderTokens(ctx, token.num, 0, 0, size * 0.7, color, false);
          const denW = this.renderTokens(ctx, token.den, 0, 0, size * 0.7, color, false);
          const fracW = Math.max(numW, denW) + 12;

          if (draw) {
            // Dynamic offsets to prevent overlapping in nested fractions or exponents
            let numOffset = size * 0.42;
            if (this.hasFraction(token.num)) {
              numOffset = size * 0.72;
            } else if (this.hasExponent(token.num)) {
              numOffset = size * 0.52;
            }

            let denOffset = size * 0.52;
            if (this.hasFraction(token.den)) {
              denOffset = size * 0.78;
            } else if (this.hasExponent(token.den)) {
              denOffset = size * 0.62;
            }

            this.renderTokens(ctx, token.num, currentX + (fracW - numW) / 2, y - numOffset, size * 0.7, color, true);
            this.renderTokens(ctx, token.den, currentX + (fracW - denW) / 2, y + denOffset, size * 0.7, color, true);

            ctx.beginPath();
            ctx.moveTo(currentX + 2, y);
            ctx.lineTo(currentX + fracW - 2, y);
            ctx.strokeStyle = color || "#ffffff";
            ctx.lineWidth = Math.max(1.5, size * 0.05);
            ctx.stroke();
          }

          currentX += fracW;
          ctx.restore();
        } 
        else if (token.type === "exponent") {
          const baseW = this.renderTokens(ctx, [token.base], currentX, y, size, color, draw);
          currentX += baseW;

          ctx.save();
          const powerW = this.renderTokens(ctx, token.power, currentX, y - size * 0.35, size * 0.65, color, draw);
          currentX += powerW;
          ctx.restore();
        }
        else if (token.type === "subscript") {
          const baseW = this.renderTokens(ctx, [token.base], currentX, y, size, color, draw);
          currentX += baseW;

          ctx.save();
          const subW = this.renderTokens(ctx, token.sub, currentX, y + size * 0.35, size * 0.65, color, draw);
          currentX += subW;
          ctx.restore();
        }
        else if (token.type === "sqrt") {
          ctx.save();
          const contentW = this.renderTokens(ctx, token.content, 0, 0, size, color, false);
          const sqrtW = contentW + 14;

          if (draw) {
            ctx.beginPath();
            ctx.strokeStyle = color || "#ffffff";
            ctx.lineWidth = Math.max(1.5, size * 0.05);
            
            const startX = currentX;
            const symW = 10;
            
            // Dynamic radical symbol boundary heights based on complex content layout
            let topY = y - size * 0.55;
            if (this.hasFraction(token.content)) {
              topY = this.hasExponent(token.content) ? y - size * 0.95 : y - size * 0.82;
            } else if (this.hasExponent(token.content)) {
              topY = y - size * 0.72;
            }

            let botY = y + size * 0.45;
            if (this.hasFraction(token.content)) {
              botY = this.hasExponent(token.content) ? y + size * 0.78 : y + size * 0.68;
            } else if (this.hasExponent(token.content)) {
              botY = y + size * 0.52;
            }
            
            ctx.moveTo(startX, y + size * 0.05);
            ctx.lineTo(startX + symW * 0.3, y + size * 0.05);
            ctx.lineTo(startX + symW * 0.6, botY);
            ctx.lineTo(startX + symW, topY);
            ctx.lineTo(startX + sqrtW - 2, topY);
            ctx.stroke();

            this.renderTokens(ctx, token.content, currentX + symW + 2, y, size, color, true);
          }

          currentX += sqrtW;
          ctx.restore();
        }
      });

      return currentX - x;
    }

    dibujarTextoMatematico(ctx, texto, x, y, size, color, align = "left") {
      ctx.save();
      
      const tokens = this.parseMathText(texto);

      let drawX = x;
      if (align === "center") {
        const totalW = this.renderTokens(ctx, tokens, 0, 0, size, color, false);
        drawX = x - totalW / 2;
      } else if (align === "right") {
        const totalW = this.renderTokens(ctx, tokens, 0, 0, size, color, false);
        drawX = x - totalW;
      }

      this.renderTokens(ctx, tokens, drawX, y, size, color, true);

      ctx.restore();
    }

    dibujar() {
      if (!this.ctx) return;

      const ctx = this.ctx;
      const celda = this.config.tamanoCelda;

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw general deep background
      ctx.fillStyle = "#030603";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.dibujarTablero(ctx, celda);
      this.dibujarObjetos(ctx, celda);
      this.dibujarSnake(ctx, celda);
      this.dibujarObjetosEnLeyenda(ctx);
      
      // Draw math equation on the top left
      if (this.preguntaActual) {
        this.dibujarTextoMatematico(ctx, this.preguntaActual.enunciado, 40, 50, 42, "#ffffff", "left");
      }

      // Draw HUD (top right capsules)
      this.dibujarHUD(ctx);

      // Draw virtual buttons
      for (const [key, btn] of Object.entries(this.botones)) {
        this.dibujarBotonCanvas(ctx, key, btn);
      }

      // Draw status overlays on top of the board
      if (this.finalizado) {
        this.dibujarGameOverBox(ctx);
      } else if (!this.enEjecucion) {
        this.dibujarPausaBox(ctx);
      }
    }

    dibujarTablero(ctx, celda) {
      const bx = this.boardOffset.x;
      const by = this.boardOffset.y;
      const bw = this.config.columnas * celda;
      const bh = this.config.filas * celda;

      // Board grid background
      ctx.fillStyle = this.tema.fondoTablero;
      ctx.fillRect(bx, by, bw, bh);

      // Draw grid lines
      ctx.strokeStyle = this.tema.grilla;
      ctx.lineWidth = 1;

      for (let x = 0; x <= this.config.columnas; x++) {
        ctx.beginPath();
        ctx.moveTo(bx + x * celda, by);
        ctx.lineTo(bx + x * celda, by + bh);
        ctx.stroke();
      }

      for (let y = 0; y <= this.config.filas; y++) {
        ctx.beginPath();
        ctx.moveTo(bx, by + y * celda);
        ctx.lineTo(bx + bw, by + y * celda);
        ctx.stroke();
      }

      // Board border (orange neon border)
      ctx.strokeStyle = this.tema.bordeTablero;
      ctx.lineWidth = 6;
      ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
    }

    dibujarHUD(ctx) {
      // 1. Puntaje: X: 875, Y: 32, W: 120 (Top right)
      this.dibujarPildoraHUD(ctx, 875, 32, 120, 36, "Puntaje", String(this.puntaje), "#ffb04a");
      // 2. Vidas: X: 1005, Y: 32, W: 110 (Top right)
      this.dibujarPildoraHUD(ctx, 1005, 32, 110, 36, "Vidas", String(this.vidas), "#ffb04a");
      // 3. Nivel: X: 1125, Y: 32, W: 115 (Top right, aligns with legend right border at X: 1240)
      this.dibujarPildoraHUD(ctx, 1125, 32, 115, 36, "Nivel", String(this.preguntaActual ? obtenerNivel(this.preguntaActual) : "-"), "#ffb04a");
      
      // 4. Progreso: X: 360, Y: 637, W: 150 (Bottom center)
      const progVal = `${this.preguntasResueltas}/${this.preguntasTotales}`;
      this.dibujarPildoraHUD(ctx, 360, 637, 150, 36, "Progreso", progVal, "#ffb04a");
      // 5. Racha: X: 520, Y: 637, W: 105 (Bottom center)
      this.dibujarPildoraHUD(ctx, 520, 637, 105, 36, "Racha", String(this.rachaActual), "#ffb04a");
    }

    dibujarPildoraHUD(ctx, x, y, w, h, label, valor, colorValor) {
      ctx.save();
      // Capsule border and back shadow
      ctx.fillStyle = "rgba(10, 18, 11, 0.8)";
      ctx.strokeStyle = "rgba(96, 215, 111, 0.25)";
      ctx.lineWidth = 1.8;
      trazarRectRedondeado(ctx, x, y, w, h, h / 2);
      ctx.fill();
      ctx.stroke();

      // Label text
      ctx.font = "600 15px Outfit";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 15, y + h / 2);

      // Value text
      ctx.font = "bold 16px Outfit";
      ctx.fillStyle = colorValor || "#ffb04a";
      const labelWidth = ctx.measureText(label).width;
      ctx.fillText(valor, x + 15 + labelWidth + 6, y + h / 2);
      ctx.restore();
    }

    dibujarObjetosEnLeyenda(ctx) {
      if (!this.escenaActual) return;

      const lx = 860;
      const ly = 130;
      const lw = 380;
      const lh = 450;

      // Draw container box
      ctx.save();
      ctx.fillStyle = "rgba(10, 18, 11, 0.6)";
      ctx.strokeStyle = "rgba(96, 215, 111, 0.15)";
      ctx.lineWidth = 2;
      trazarRectRedondeado(ctx, lx, ly, lw, lh, 20);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Title Alternatives
      ctx.font = "bold 26px Outfit";
      ctx.fillStyle = "#ff7a00";
      ctx.textAlign = "left";
      ctx.fillText("Alternativas", lx + 30, ly + 50);

      // Alternatives loop
      this.escenaActual.objetos.forEach((objeto, indice) => {
        const itemY = ly + 110 + indice * 60;
        const cx = lx + 45;
        const cy = itemY;
        const r = 13;

        // Glowing circle
        ctx.save();
        ctx.shadowColor = objeto.color.hex;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = objeto.color.hex;
        ctx.fill();
        ctx.restore();

        // White border
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text
        this.dibujarTextoMatematico(ctx, objeto.opcion.texto, lx + 75, cy, 38, "#ffffff", "left");
      });
    }

    dibujarBotonCanvas(ctx, key, btn) {
      const isHovered = this.hoveredBoton === key;
      ctx.save();

      if (isHovered) {
        ctx.shadowColor = key === "fullscreen" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 122, 0, 0.4)";
        ctx.shadowBlur = 12;
      }

      const w = btn.x2 - btn.x1;
      const h = btn.y2 - btn.y1;

      if (key === "fullscreen") {
        ctx.fillStyle = "#040804";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.8;
      } else {
        ctx.fillStyle = isHovered ? "#ff9a33" : "#ff7a00";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 1;
      }

      trazarRectRedondeado(ctx, btn.x1, btn.y1, w, h, h / 2);
      ctx.fill();
      if (key === "fullscreen") {
        ctx.stroke();
      }
      ctx.restore();

      // Label text
      ctx.font = "bold 16px Outfit";
      ctx.fillStyle = key === "fullscreen" ? "#ffffff" : "#101010";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let label = btn.label;
      if (key === "iniciar") {
        label = this.finalizado ? "Finalizado" : this.enEjecucion ? "Pausar" : this.snake.length > 3 ? "Continuar" : "Iniciar";
      } else if (key === "sonido") {
        label = this.sintetizador.habilitado ? "🔊 Sonido" : "🔇 Mudo";
      }

      ctx.fillText(label, btn.x1 + w / 2, btn.y1 + h / 2);
    }

    dibujarPausaBox(ctx) {
      const bx = this.boardOffset.x;
      const by = this.boardOffset.y;
      const bw = this.config.columnas * this.config.tamanoCelda;
      const bh = this.config.filas * this.config.tamanoCelda;

      ctx.save();
      ctx.fillStyle = "rgba(4, 8, 4, 0.75)";
      trazarRectRedondeado(ctx, bx, by, bw, bh, 6);
      ctx.fill();

      ctx.font = "bold 32px Outfit";
      ctx.fillStyle = "#ff7a00";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSADO", bx + bw / 2, by + bh / 2 - 20);

      ctx.font = "600 16px Outfit";
      ctx.fillStyle = "#a2bfa5";
      ctx.fillText("PRESIONA EL BOTÓN 'INICIAR' PARA JUGAR", bx + bw / 2, by + bh / 2 + 25);
      ctx.restore();
    }

    dibujarGameOverBox(ctx) {
      const bx = this.boardOffset.x;
      const by = this.boardOffset.y;
      const bw = this.config.columnas * this.config.tamanoCelda;
      const bh = this.config.filas * this.config.tamanoCelda;

      ctx.save();
      ctx.fillStyle = "rgba(4, 8, 4, 0.88)";
      trazarRectRedondeado(ctx, bx, by, bw, bh, 6);
      ctx.fill();

      ctx.font = "bold 34px Outfit";
      ctx.fillStyle = "#ff4d4f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const titulo = this.vidas <= 0 ? "¡JUEGO TERMINADO!" : "¡ACTIVIDAD COMPLETADA!";
      ctx.fillText(titulo, bx + bw / 2, by + bh / 2 - 40);

      ctx.font = "600 22px Outfit";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Puntaje Final: ${this.puntaje}`, bx + bw / 2, by + bh / 2 + 10);
      ctx.fillText(`Mejor Racha: ${this.mejorRacha}`, bx + bw / 2, by + bh / 2 + 45);

      ctx.font = "500 15px Outfit";
      ctx.fillStyle = "#8fa090";
      ctx.fillText("HAZ CLIC EN 'REINICIAR' PARA JUGAR OTRA VEZ", bx + bw / 2, by + bh / 2 + 95);
      ctx.restore();
    }

    dibujarSnake(ctx, celda) {
      const envenenado = this.estaEnvenenado();

      this.snake.forEach((parte, indice) => {
        const x = this.boardOffset.x + parte.x * celda + 2;
        const y = this.boardOffset.y + parte.y * celda + 2;
        const ancho = celda - 4;
        const alto = celda - 4;
        const esCabeza = indice === 0;
        const gradiente = ctx.createLinearGradient(x, y, x + ancho, y + alto);

        if (envenenado && esCabeza) {
          gradiente.addColorStop(0, "#ff9a7f");
          gradiente.addColorStop(1, "#d62f2f");
        } else if (envenenado) {
          gradiente.addColorStop(0, "#ff8877");
          gradiente.addColorStop(1, "#b32020");
        } else if (esCabeza) {
          gradiente.addColorStop(0, "#ffb04a");
          gradiente.addColorStop(1, this.tema.snakeCabeza);
        } else {
          gradiente.addColorStop(0, "#75e781");
          gradiente.addColorStop(1, this.tema.snakeCuerpo);
        }

        ctx.save();
        ctx.shadowColor = envenenado
          ? "rgba(255, 72, 72, 0.42)"
          : esCabeza
            ? "rgba(255, 122, 0, 0.45)"
            : "rgba(96, 215, 111, 0.26)";
        ctx.shadowBlur = envenenado ? 14 : esCabeza ? 16 : 10;
        ctx.fillStyle = gradiente;
        trazarRectRedondeado(ctx, x, y, ancho, alto, esCabeza ? 8 : 6);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = envenenado ? "#ffe5e1" : this.tema.snakeBorde;
        ctx.lineWidth = esCabeza ? 2 : 1.2;
        trazarRectRedondeado(ctx, x, y, ancho, alto, esCabeza ? 8 : 6);
        ctx.stroke();

        if (esCabeza) {
          const centroX = x + ancho / 2;
          const centroY = y + alto / 2;
          const offsetX = this.direccion.x * 4;
          const offsetY = this.direccion.y * 4;
          const normalX = this.direccion.y * 3;
          const normalY = this.direccion.x * 3;
          const ojo1x = centroX + offsetX + normalX;
          const ojo1y = centroY + offsetY + normalY;
          const ojo2x = centroX + offsetX - normalX;
          const ojo2y = centroY + offsetY - normalY;

          ctx.strokeStyle = "#101010";
          ctx.fillStyle = "#101010";

          if (envenenado) {
            const tamX = 2.2;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(ojo1x - tamX, ojo1y - tamX);
            ctx.lineTo(ojo1x + tamX, ojo1y + tamX);
            ctx.moveTo(ojo1x + tamX, ojo1y - tamX);
            ctx.lineTo(ojo1x - tamX, ojo1y + tamX);
            ctx.moveTo(ojo2x - tamX, ojo2y - tamX);
            ctx.lineTo(ojo2x + tamX, ojo2y + tamX);
            ctx.moveTo(ojo2x + tamX, ojo2y - tamX);
            ctx.lineTo(ojo2x - tamX, ojo2y + tamX);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(ojo1x, ojo1y, 1.8, 0, Math.PI * 2);
            ctx.arc(ojo2x, ojo2y, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }

    dibujarObjetos(ctx, celda) {
      if (!this.escenaActual) return;

      const pulso = 0.9 + Math.sin(Date.now() / 180) * 0.08;

      this.escenaActual.objetos.forEach((objeto) => {
        const cx = this.boardOffset.x + objeto.posicion.x * celda + celda / 2;
        const cy = this.boardOffset.y + objeto.posicion.y * celda + celda / 2;
        const radio = celda * 0.34 * pulso;
        const radioBorde = Math.max(2, radio - 1.25);

        ctx.save();
        ctx.shadowColor = objeto.color.hex;
        ctx.shadowBlur = 18;

        ctx.beginPath();
        ctx.arc(cx, cy, radio, 0, Math.PI * 2);
        ctx.fillStyle = objeto.color.hex;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, radio * 0.56, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, radioBorde, 0, Math.PI * 2);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = this.tema.bordeObjeto;
        ctx.stroke();
      });
    }
  }

  function crear(selectorOContenedor, dataset, opciones = {}) {
    let contenedor = selectorOContenedor;

    if (typeof selectorOContenedor === "string") {
      contenedor = document.querySelector(selectorOContenedor);
    }

    if (!(contenedor instanceof HTMLElement)) {
      throw new Error("Snake Matemático: el contenedor no es válido.");
    }

    const juego = new JuegoSnakeMatematico(contenedor, dataset, opciones);
    return juego.iniciar();
  }

  window.SnakeMatematico3 = {
    crear,
    temas: TEMAS,
    paletaSnake3: PALETA_ALTERNATIVAS_SNAKE3,
    paletaAlternativas: PALETA_ALTERNATIVAS,
    utilidades: {
      mezclar,
      tomarAleatorios,
      crearColaPorNivel,
      prepararTextoMatematico,
      normalizarLatexDataset,
      normalizarJSONSnake
    }
  };
})();

/* ============================================================
     SNAKE MATEMÁTICO - AUTORENDER MOODLE v0.2
     Colocar después del motor SnakeMatematico.
     ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".juegosprofearauco-snake3-auto").forEach(function (root) {
    if (root.dataset.snake3Renderizado === "1") {
      return;
    }

    const datasetBox =
      root.querySelector(".juegosprofearauco-snake3-dataset") ||
      root.querySelector(".juegosprofearauco-dataset");

    if (!datasetBox) {
      root.innerHTML = "<p><strong>Error:</strong> No se encontró el dataset del Snake.</p>";
      return;
    }

    if (!window.SnakeMatematico3) {
      root.innerHTML = "<p><strong>Error:</strong> No se encontro el motor SnakeMatematico3.</p>";
      return;
    }

    let dataset;
    let preguntasPorNivel = null;

    try {
      dataset = window.SnakeMatematico3.utilidades.normalizarJSONSnake(datasetBox.value);
      dataset = window.SnakeMatematico3.utilidades.normalizarLatexDataset(dataset);
    } catch (error) {
      root.innerHTML =
        "<p><strong>Error:</strong> El dataset del Snake no tiene formato JSON válido.</p>" +
        "<p>Revisa comas, comillas dobles y barras invertidas de LaTeX.</p>";
      console.error("Error JSON Snake 2:", error);
      return;
    }

    if (root.dataset.preguntasPorNivel) {
      try {
        preguntasPorNivel = JSON.parse(root.dataset.preguntasPorNivel);
      } catch (error) {
        root.innerHTML =
          "<p><strong>Error:</strong> data-preguntas-por-nivel no tiene formato JSON válido.</p>";
        console.error("Error data-preguntas-por-nivel:", error);
        return;
      }
    }

    root.dataset.snake3Renderizado = "1";
    root.innerHTML = "";

    window.SnakeMatematico3.crear(root, dataset, {
      velocidad: root.dataset.velocidad || "media",
      vidas: Number(root.dataset.vidas || 3),
      alternativas: Number(root.dataset.alternativas || 3),
      columnas: Number(root.dataset.columnas || 24),
      filas: Number(root.dataset.filas || 18),
      tamanoCelda: Number(root.dataset.tamanoCelda || 24),
      tema: root.dataset.tema || "arauco-arcade",
      preguntasPorNivel
    });
  });
});
