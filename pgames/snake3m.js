

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
      .juegosprofearauco-snake3-root {
        width: 100%;
      }

      .juegosprofearauco-snake3-root .${claseUI("panel")} {
        max-width: none;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
      }

      .juegosprofearauco-snake3-shell {
        position: relative;
        width: min(100%, 1280px);
        max-height: calc(100svh - 24px);
        aspect-ratio: 16 / 9;
        margin: 0 auto;
        padding: 1rem;
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr) auto;
        gap: 0.8rem;
        box-sizing: border-box;
        overflow: hidden;
        border-radius: 26px;
        border: 4px solid #ff7a00;
        background:
          radial-gradient(circle at top left, rgba(255, 122, 0, 0.08), transparent 24%),
          radial-gradient(circle at bottom right, rgba(96, 215, 111, 0.08), transparent 20%),
          linear-gradient(180deg, #061006 0%, #040804 100%);
        box-shadow:
          0 0 0 2px rgba(17, 58, 28, 0.9) inset,
          0 18px 54px rgba(0, 0, 0, 0.35);
      }

      .juegosprofearauco-snake3-shell.is-fullscreen {
        width: 100vw;
        height: 100svh;
        max-height: none;
        aspect-ratio: auto;
        border-radius: 0;
      }

      .juegosprofearauco-snake3-fullscreen {
        position: absolute;
        top: 0.9rem;
        right: 0.9rem;
        z-index: 6;
        padding: 0.42rem 0.75rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 122, 0, 0.58);
        background: rgba(5, 12, 6, 0.88);
        color: #f5f5f5;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
      }

      .juegosprofearauco-snake3-topbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: 1rem;
        padding-right: 6.8rem;
      }

      .juegosprofearauco-snake3-title {
        margin: 0;
        color: #58c957;
        font-size: clamp(1.2rem, 2.25vw, 2.1rem);
        line-height: 1.05;
      }

      .juegosprofearauco-snake3-hud {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.45rem;
      }

      .juegosprofearauco-snake3-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.34rem 0.62rem;
        border-radius: 999px;
        border: 1px solid rgba(96, 215, 111, 0.42);
        background: rgba(5, 12, 6, 0.82);
        color: #f5f5f5;
        font-size: 0.8rem;
      }

      .juegosprofearauco-snake3-chip strong {
        color: #ffb04a;
      }

      .juegosprofearauco-snake3-question {
        min-height: 0;
        padding: 0.68rem 0.85rem;
        border-left: 4px solid rgba(255, 122, 0, 0.96);
        border-radius: 0 18px 18px 0;
        background: rgba(8, 18, 10, 0.88);
        color: #f5f5f5;
        line-height: 1.2;
        box-shadow: 0 0 18px rgba(0, 0, 0, 0.22);
      }

      .juegosprofearauco-snake3-main {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(220px, 0.72fr);
        gap: 0.85rem;
        align-items: stretch;
      }

      .juegosprofearauco-snake3-board {
        position: relative;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.35rem;
        border-radius: 22px;
        background: rgba(3, 7, 4, 0.72);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        overflow: hidden;
      }

      .juegosprofearauco-snake3-board canvas {
        display: block;
        width: auto;
        height: auto;
        max-width: 100%;
        max-height: 100%;
        border: 4px solid #ff7a00;
        background: #030603;
        box-shadow: inset 0 0 0 2px rgba(24, 74, 37, 0.86);
      }

      .juegosprofearauco-snake3-options {
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: 0.82rem;
        border-radius: 22px;
        background: rgba(6, 15, 8, 0.92);
        border: 1px solid rgba(96, 215, 111, 0.3);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        overflow: auto;
      }

      .juegosprofearauco-snake3-options h3 {
        margin: 0 0 0.6rem;
        color: #ff7a00;
        font-size: 1.18rem;
      }

      .juegosprofearauco-snake3-root .${claseUI("leyenda-fila")} {
        gap: 0.58rem;
        padding: 0.46rem 0;
      }

      .juegosprofearauco-snake3-root .${claseUI("bolita")} {
        width: 20px;
        height: 20px;
      }

      .juegosprofearauco-snake3-root .${claseUI("texto-opcion")} {
        font-size: 0.98rem;
        line-height: 1.18;
      }

      .juegosprofearauco-snake3-bottombar {
        display: flex;
        justify-content: center;
        gap: 0.75rem;
      }

      .juegosprofearauco-snake3-button {
        min-width: 120px;
        padding: 0.8rem 1.25rem;
        border: 0;
        border-radius: 999px;
        background: #ff7a00;
        color: #101010;
        font-size: 1rem;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(255, 122, 0, 0.2);
        transition: transform 0.1s, background 0.2s;
      }

      .juegosprofearauco-snake3-button:active {
        transform: scale(0.96);
      }

      .juegosprofearauco-snake3-button.is-muted {
        background: #555;
        color: #ddd;
        box-shadow: 0 5px 12px rgba(0, 0, 0, 0.3);
      }

      .juegosprofearauco-snake3-overlay-final {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(3, 9, 4, 0.72);
        backdrop-filter: blur(2px);
      }

      .juegosprofearauco-snake3-overlay-final[hidden] {
        display: none !important;
      }

      .juegosprofearauco-snake3-overlay-caja {
        max-width: min(82%, 520px);
        padding: 1rem 1.1rem;
        border: 1px solid rgba(255, 122, 0, 0.65);
        border-radius: 20px;
        background: rgba(10, 19, 11, 0.92);
        color: #f5f5f5;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.38rem;
        text-align: center;
        box-shadow: 0 0 24px rgba(0, 0, 0, 0.3);
      }

      .juegosprofearauco-snake3-overlay-titulo {
        font-size: 1.24rem;
        font-weight: 800;
        color: #ffb04a;
      }

      .juegosprofearauco-snake3-overlay-detalle {
        font-size: 0.96rem;
        color: #f5f5f5;
      }

      @media (max-width: 960px), (max-aspect-ratio: 10/9) {
        .juegosprofearauco-snake3-shell {
          aspect-ratio: 10 / 16;
          padding: 0.8rem;
          gap: 0.6rem;
        }

        .juegosprofearauco-snake3-topbar {
          grid-template-columns: 1fr;
          gap: 0.6rem;
          padding-right: 5.6rem;
        }

        .juegosprofearauco-snake3-hud {
          justify-content: flex-start;
        }

        .juegosprofearauco-snake3-main {
          grid-template-columns: 1fr;
          grid-template-rows: minmax(0, 1fr) auto;
          gap: 0.6rem;
        }

        .juegosprofearauco-snake3-bottombar {
          gap: 0.55rem;
        }

        .juegosprofearauco-snake3-button {
          min-width: 0;
          flex: 1 1 0;
          padding: 0.72rem 0.5rem;
          font-size: 0.9rem;
        }
      }

      @media (max-width: 640px) {
        .juegosprofearauco-snake3-shell {
          max-height: none;
          min-height: 100svh;
          aspect-ratio: auto;
          border-radius: 0;
          padding: 0.72rem;
        }

        .juegosprofearauco-snake3-fullscreen {
          top: 0.72rem;
          right: 0.72rem;
          padding: 0.34rem 0.6rem;
          font-size: 0.74rem;
        }

        .juegosprofearauco-snake3-title {
          font-size: 1.08rem;
        }

        .juegosprofearauco-snake3-chip {
          font-size: 0.72rem;
          padding: 0.26rem 0.48rem;
        }

        .juegosprofearauco-snake3-question {
          padding: 0.58rem 0.7rem;
          font-size: 0.92rem;
        }

        .juegosprofearauco-snake3-root .${claseUI("texto-opcion")} {
          font-size: 0.9rem;
        }

        .juegosprofearauco-snake3-overlay-caja {
          max-width: 90%;
          padding: 0.85rem 0.92rem;
        }

        .juegosprofearauco-snake3-overlay-titulo {
          font-size: 1.05rem;
        }

        .juegosprofearauco-snake3-overlay-detalle {
          font-size: 0.86rem;
        }
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape {
        width: 100%;
        height: 100%;
        max-height: none;
        min-height: 100svh;
        aspect-ratio: auto;
        border-radius: 0;
        padding: 0.65rem;
        gap: 0.55rem;
        grid-template-rows: auto auto minmax(0, 1fr) auto;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-topbar {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.6rem;
        padding-right: 5.6rem;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-title {
        font-size: 0.98rem;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-hud {
        justify-content: flex-end;
        gap: 0.34rem;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-chip {
        padding: 0.2rem 0.42rem;
        font-size: 0.68rem;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-question {
        padding: 0.48rem 0.62rem;
        font-size: 0.84rem;
        line-height: 1.12;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-main {
        grid-template-columns: minmax(0, 1.45fr) minmax(190px, 0.8fr);
        grid-template-rows: minmax(0, 1fr);
        gap: 0.55rem;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-board {
        padding: 0.22rem;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-options {
        padding: 0.62rem;
        border-radius: 18px;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-options h3 {
        margin-bottom: 0.42rem;
        font-size: 0.96rem;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .${claseUI("leyenda-fila")} {
        gap: 0.45rem;
        padding: 0.32rem 0;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .${claseUI("texto-opcion")} {
        font-size: 0.8rem;
        line-height: 1.06;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-bottombar {
        gap: 0.5rem;
      }

      .juegosprofearauco-snake3-shell.is-mobile-landscape .juegosprofearauco-snake3-button {
        min-width: 116px;
        padding: 0.6rem 0.9rem;
        font-size: 0.88rem;
      }
    `;

    document.head.appendChild(style);
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
      this.sintetizador = new SintetizadorSnake(); // INICIALIZA EL SINTETIZADOR

      this.config = {
        columnas: Number(opciones.columnas || 24),
        filas: Number(opciones.filas || 18),
        tamanoCelda: Number(opciones.tamanoCelda || 24),
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

      this.elShell = null;
      this.canvas = null;
      this.ctx = null;
      this.elOverlayFinal = null;
      this.elPregunta = null;
      this.elLeyenda = null;
      this.elPuntaje = null;
      this.elVidas = null;
      this.elNivel = null;
      this.elProgreso = null;
      this.elRacha = null;
      this.botonInicio = null;
      this.botonReiniciar = null;
      this.botonFullscreen = null;
      this.botonSonido = null;

      this.colaPreguntas =[];
      this.preguntaActual = null;
      this.escenaActual = null;
      this.preguntasTotales = 0;
      this.preguntasResueltas = 0;
      this.rachaActual = 0;
      this.mejorRacha = 0;
      this.snakeEnvenenadoHasta = 0;

      this.snake =[];
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

      this.manejarTecla = this.manejarTecla.bind(this);
      this.manejarTouchStart = this.manejarTouchStart.bind(this);
      this.manejarTouchMove = this.manejarTouchMove.bind(this);
      this.manejarTouchEnd = this.manejarTouchEnd.bind(this);
      this.manejarTouchCancel = this.manejarTouchCancel.bind(this);
      this.alternarPantallaCompleta = this.alternarPantallaCompleta.bind(this);
      this.manejarCambioFullscreen = this.manejarCambioFullscreen.bind(this);
      this.actualizarModoPantalla = this.actualizarModoPantalla.bind(this);
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
      if (!this.elShell) {
        return;
      }

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

      if (this.botonFullscreen) {
        this.botonFullscreen.textContent = activa
          ? "Salir pantalla completa"
          : "Pantalla completa";
      }

      this.actualizarModoPantalla();
    }

    actualizarModoPantalla() {
      if (!this.elShell) {
        return;
      }

      const ancho = window.innerWidth || document.documentElement.clientWidth || 0;
      const alto = window.innerHeight || document.documentElement.clientHeight || 0;
      const esLandscape = ancho > alto;
      const esMovil =
        ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
        Math.max(ancho, alto) <= 1100;

      this.elShell.classList.toggle("is-mobile-landscape", esMovil && esLandscape);
      this.elShell.classList.toggle("is-mobile-portrait", esMovil && !esLandscape);
    }

    iniciar() {
      inyectarEstilosSnake3();
      this.construirInterfaz();
      this.reiniciar();
      this.dibujar();
      document.addEventListener("keydown", this.manejarTecla);
      document.addEventListener("fullscreenchange", this.manejarCambioFullscreen);
      window.addEventListener("resize", this.actualizarModoPantalla);
      window.addEventListener("orientationchange", this.actualizarModoPantalla);
      this.actualizarModoPantalla();
      return this;
    }

    destruir() {
      this.detener();
      document.removeEventListener("keydown", this.manejarTecla);
      document.removeEventListener("fullscreenchange", this.manejarCambioFullscreen);
      window.removeEventListener("resize", this.actualizarModoPantalla);
      window.removeEventListener("orientationchange", this.actualizarModoPantalla);
      this.desregistrarControlesTouch();
      this.contenedor.innerHTML = "";
    }

    construirInterfaz() {
      this.contenedor.classList.add(claseUI("app"));
      this.contenedor.classList.add("juegosprofearauco-snake3-root");

      this.contenedor.innerHTML = `
        <div class="${claseUI("panel")}">
          <div class="juegosprofearauco-snake3-shell" data-sm-shell>
            <button
              type="button"
              class="juegosprofearauco-snake3-fullscreen"
              data-sm-fullscreen
            >
              Pantalla completa
            </button>
            <div class="juegosprofearauco-snake3-topbar">
              <h2 class="${claseUI("titulo")} juegosprofearauco-snake3-title"></h2>
              <div class="juegosprofearauco-snake3-hud">
                <span class="juegosprofearauco-snake3-chip">Puntaje <strong data-sm-puntaje>0</strong></span>
                <span class="juegosprofearauco-snake3-chip">Vidas <strong data-sm-vidas>0</strong></span>
                <span class="juegosprofearauco-snake3-chip">Nivel <strong data-sm-nivel>-</strong></span>
                <span class="juegosprofearauco-snake3-chip">Progreso <strong data-sm-progreso>0/0</strong></span>
                <span class="juegosprofearauco-snake3-chip">Racha <strong data-sm-racha>0</strong></span>
              </div>
            </div>
            <div class="juegosprofearauco-snake3-question" data-sm-pregunta></div>
            <div class="juegosprofearauco-snake3-main">
              <div class="juegosprofearauco-snake3-board">
                <div class="juegosprofearauco-snake3-overlay-final" data-sm-overlay-final hidden></div>
                <canvas data-sm-canvas></canvas>
              </div>
              <aside class="juegosprofearauco-snake3-options">
                <h3>Alternativas</h3>
                <div data-sm-leyenda></div>
              </aside>
            </div>
            <div class="juegosprofearauco-snake3-bottombar">
              <button type="button" class="juegosprofearauco-snake3-button" data-sm-iniciar>Iniciar</button>
              <button type="button" class="juegosprofearauco-snake3-button" data-sm-sonido>🔊 Sonido</button>
              <button type="button" class="juegosprofearauco-snake3-button" data-sm-reiniciar>Reiniciar</button>
            </div>
          </div>
        </div>
      `;

      buscarPorClase(this.contenedor, "titulo").textContent =
        this.dataset.titulo || "Snake 3 Profearauco";

      this.elShell = this.contenedor.querySelector("[data-sm-shell]");
      this.elOverlayFinal = this.contenedor.querySelector("[data-sm-overlay-final]");
      this.canvas = this.contenedor.querySelector("[data-sm-canvas]");
      this.ctx = this.canvas.getContext("2d");
      this.canvas.width = this.config.columnas * this.config.tamanoCelda;
      this.canvas.height = this.config.filas * this.config.tamanoCelda;
      this.registrarControlesTouch();

      this.elPregunta = this.contenedor.querySelector("[data-sm-pregunta]");
      this.elLeyenda = this.contenedor.querySelector("[data-sm-leyenda]");
      this.elPuntaje = this.contenedor.querySelector("[data-sm-puntaje]");
      this.elVidas = this.contenedor.querySelector("[data-sm-vidas]");
      this.elNivel = this.contenedor.querySelector("[data-sm-nivel]");
      this.elProgreso = this.contenedor.querySelector("[data-sm-progreso]");
      this.elRacha = this.contenedor.querySelector("[data-sm-racha]");
      this.botonInicio = this.contenedor.querySelector("[data-sm-iniciar]");
      this.botonReiniciar = this.contenedor.querySelector("[data-sm-reiniciar]");
      this.botonFullscreen = this.contenedor.querySelector("[data-sm-fullscreen]");
      this.botonSonido = this.contenedor.querySelector("[data-sm-sonido]");

      this.botonInicio.addEventListener("click", () => {
        this.sintetizador.inicializar(); // Habilita el contexto de audio tras interacción del usuario
        if (this.finalizado) {
          return;
        }

        if (this.enEjecucion) {
          this.detener();
          this.botonInicio.textContent = "Continuar";
        } else {
          this.comenzar();
          this.botonInicio.textContent = "Pausar";
        }
      });

      this.botonSonido.addEventListener("click", () => {
        this.sintetizador.habilitado = !this.sintetizador.habilitado;
        this.botonSonido.textContent = this.sintetizador.habilitado ? "🔊 Sonido" : "🔇 Mudo";
        this.botonSonido.classList.toggle("is-muted", !this.sintetizador.habilitado);
        
        // Retomar o parar BGM dinámicamente si el juego está activo
        if (this.sintetizador.habilitado && this.enEjecucion && !this.finalizado) {
          this.sintetizador.iniciarMusica();
        } else {
          this.sintetizador.detenerMusica();
        }
      });

      this.botonReiniciar.addEventListener("click", () => {
        this.reiniciar();
        this.dibujar();
      });
      this.botonFullscreen.addEventListener("click", this.alternarPantallaCompleta);
      this.manejarCambioFullscreen();
    }

    registrarControlesTouch() {
      if (!this.canvas) {
        return;
      }

      this.canvas.addEventListener("touchstart", this.manejarTouchStart, {
        passive: false
      });
      this.canvas.addEventListener("touchmove", this.manejarTouchMove, {
        passive: false
      });
      this.canvas.addEventListener("touchend", this.manejarTouchEnd, {
        passive: false
      });
      this.canvas.addEventListener("touchcancel", this.manejarTouchCancel);
    }

    desregistrarControlesTouch() {
      if (!this.canvas) {
        return;
      }

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
      this.actualizarMarcadores();

      if (this.botonInicio) {
        this.botonInicio.textContent = "Iniciar";
      }
    }

    comenzar() {
      if (this.finalizado) {
        return;
      }

      this.enEjecucion = true;
      this.actualizarMarcadores();
      const demora = VELOCIDADES[this.config.velocidad] || VELOCIDADES.media;
      clearInterval(this.intervalo);

      this.sintetizador.iniciarMusica(); // <-- INICIAR BGM

      this.intervalo = setInterval(() => {
        this.actualizar();
      }, demora);
    }

    detener() {
      this.enEjecucion = false;
      clearInterval(this.intervalo);
      this.intervalo = null;
      
      this.sintetizador.detenerMusica(); // <-- DETENER BGM
      this.actualizarMarcadores();
    }

    finalizar(mensaje) {
      this.detener();
      this.finalizado = true;
      this.mostrarOverlayFinal(mensaje || "Juego terminado.");

      if (this.botonInicio) {
        this.botonInicio.textContent = "Finalizado";
      }

      this.actualizarMarcadores();
      this.dibujar();
    }

    reiniciarSnake() {
      const y = Math.floor(this.config.filas / 2);

      this.snake =[
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
        this.actualizarMarcadores();
        return;
      }

      this.preguntaActual = this.colaPreguntas.shift();
      this.escenaActual = this.crearEscena(this.preguntaActual);

      // Reproduce el pequeño sonido al cargar los items
      this.sintetizador.playAparicion();

      const preguntaHtml = prepararTextoMatematico(this.preguntaActual.enunciado);

      this.elPregunta.innerHTML = preguntaHtml;
      this.elNivel.textContent = String(obtenerNivel(this.preguntaActual));

      this.renderizarLeyenda();
      this.actualizarMarcadores();
      renderizarLatex(this.contenedor);
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
      const posicionesReservadas =[];

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

    buscarPosicionLibre(posicionesReservadas =[]) {
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

    esPosicionLibre(posicion, posicionesReservadas =[]) {
      const chocaSnake = this.snake.some(
        (parte) => parte.x === posicion.x && parte.y === posicion.y
      );

      if (chocaSnake) {
        return false;
      }

      if (this.escenaActual && Array.isArray(this.escenaActual.objetos)) {
        const chocaObjeto = this.escenaActual.objetos.some(
          (objeto) =>
            objeto.posicion.x === posicion.x &&
            objeto.posicion.y === posicion.y
        );

        if (chocaObjeto) {
          return false;
        }
      }

      const chocaReservada = posicionesReservadas.some(
        (reservada) => reservada.x === posicion.x && reservada.y === posicion.y
      );

      if (chocaReservada) {
        return false;
      }

      return true;
    }

    renderizarLeyenda() {
      this.elLeyenda.innerHTML = "";

      this.escenaActual.objetos.forEach((objeto) => {
        const fila = document.createElement("div");
        fila.className = claseUI("leyenda-fila");

        const bolita = document.createElement("span");
        bolita.className = claseUI("bolita");
        bolita.style.backgroundColor = objeto.color.hex;

        const texto = document.createElement("span");
        texto.className = claseUI("texto-opcion");
        texto.innerHTML = prepararTextoMatematico(objeto.opcion.texto);

        fila.appendChild(bolita);
        fila.appendChild(texto);
        this.elLeyenda.appendChild(fila);
      });
    }

    actualizarMarcadores() {
      this.elPuntaje.textContent = String(this.puntaje);
      this.elVidas.textContent = String(this.vidas);
      this.elProgreso.textContent = `${this.preguntasResueltas}/${this.preguntasTotales}`;
      this.elRacha.textContent = String(this.rachaActual);
    }

    limpiarVisualesTablero() {
      this.snakeEnvenenadoHasta = 0;

      if (this.elOverlayFinal) {
        this.elOverlayFinal.hidden = true;
        this.elOverlayFinal.innerHTML = "";
      }
    }

    mostrarOverlayFinal(mensaje) {
      if (!this.elOverlayFinal) {
        return;
      }

      const partes = String(mensaje || "Juego terminado.")
        .split(".")
        .map((parte) => parte.trim())
        .filter(Boolean);
      const titulo = partes[0] || "Juego terminado";
      const detalle = partes.slice(1).join(". ");

      this.elOverlayFinal.innerHTML = `
        <div class="juegosprofearauco-snake3-overlay-caja" role="status" aria-live="polite">
          <div class="juegosprofearauco-snake3-overlay-titulo">${titulo}</div>
          ${detalle ? `<div class="juegosprofearauco-snake3-overlay-detalle">${detalle}</div>` : ""}
        </div>
      `;
      this.elOverlayFinal.hidden = false;
    }

    activarEnvenenamiento(duracion = 1000) {
      this.snakeEnvenenadoHasta = Date.now() + duracion;
    }

    estaEnvenenado() {
      return Date.now() < this.snakeEnvenenadoHasta;
    }

    intentarCambiarDireccion(nuevaDireccion) {
      if (!nuevaDireccion) {
        return false;
      }

      const esOpuesta =
        nuevaDireccion.x + this.direccion.x === 0 &&
        nuevaDireccion.y + this.direccion.y === 0;

      if (esOpuesta) {
        return false;
      }

      this.siguienteDireccion = nuevaDireccion;
      return true;
    }

    manejarTecla(evento) {
      const tecla = evento.key.toLowerCase();
      const nuevaDireccion = DIRECCIONES_POR_TECLA[tecla];

      if (!nuevaDireccion) {
        return;
      }

      this.intentarCambiarDireccion(nuevaDireccion);
      evento.preventDefault();
    }

    manejarTouchStart(evento) {
      const touch = evento.changedTouches[0];

      if (!touch) {
        return;
      }

      this.touchActivoId = touch.identifier;
      this.touchInicio = {
        x: touch.clientX,
        y: touch.clientY
      };

      if (evento.cancelable) {
        evento.preventDefault();
      }
    }

    manejarTouchMove(evento) {
      if (!this.touchInicio) {
        return;
      }

      if (evento.cancelable) {
        evento.preventDefault();
      }
    }

    manejarTouchEnd(evento) {
      if (!this.touchInicio) {
        return;
      }

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

      if (evento.cancelable) {
        evento.preventDefault();
      }
    }

    manejarTouchCancel() {
      this.limpiarGestoTouch();
    }

    limpiarGestoTouch() {
      this.touchInicio = null;
      this.touchActivoId = null;
    }

    actualizar() {
      if (!this.enEjecucion || this.finalizado) {
        return;
      }

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
      if (!this.escenaActual) {
        return null;
      }

      return this.escenaActual.objetos.find(
        (objeto) =>
          objeto.posicion.x === posicion.x &&
          objeto.posicion.y === posicion.y
      );
    }

    gestionarChoque() {
      this.vidas--;
      this.rachaActual = 0;
      this.actualizarMarcadores();

      if (this.vidas <= 0) {
        this.sintetizador.playGameOver(); // AUDIO GAME OVER
        this.finalizar("Juego terminado. Te quedaste sin vidas.");
        return;
      }

      this.sintetizador.playChoque(); // AUDIO CHOQUE LIGERO
      this.reiniciarSnake();
      this.dibujar();
    }

    gestionarComida(objeto) {
      const esCorrecta = objeto.opcion.correcta === true;

      if (esCorrecta) {
        this.rachaActual++;
        this.sintetizador.playCorrecto(this.rachaActual); // AUDIO CORRECTO CON ESCALADA DE TONO

        this.puntaje += this.config.puntosCorrecto;
        this.crecimientoPendiente += this.config.crecimientoCorrecto;
        this.preguntasResueltas++;
        this.mejorRacha = Math.max(this.mejorRacha, this.rachaActual);

        this.actualizarMarcadores();

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
      this.actualizarMarcadores();

      if (this.vidas <= 0) {
        this.sintetizador.playGameOver(); // AUDIO GAME OVER
        this.finalizar("Juego terminado. Te quedaste sin vidas.");
      } else {
        this.sintetizador.playIncorrecto(); // AUDIO INCORRECTO
      }
    }

    dibujar() {
      if (!this.ctx) {
        return;
      }

      const ctx = this.ctx;
      const celda = this.config.tamanoCelda;

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.dibujarTablero(ctx, celda);
      this.dibujarObjetos(ctx, celda);
      this.dibujarSnake(ctx, celda);
    }

    dibujarTablero(ctx, celda) {
      ctx.fillStyle = this.tema.fondoTablero;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.strokeStyle = this.tema.grilla;
      ctx.lineWidth = 1;

      for (let x = 0; x <= this.config.columnas; x++) {
        ctx.beginPath();
        ctx.moveTo(x * celda, 0);
        ctx.lineTo(x * celda, this.canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y <= this.config.filas; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * celda);
        ctx.lineTo(this.canvas.width, y * celda);
        ctx.stroke();
      }

      ctx.strokeStyle = this.tema.bordeTablero;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
    }

    dibujarSnake(ctx, celda) {
      const envenenado = this.estaEnvenenado();

      this.snake.forEach((parte, indice) => {
        const x = parte.x * celda + 2;
        const y = parte.y * celda + 2;
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
      if (!this.escenaActual) {
        return;
      }

      const pulso = 0.9 + Math.sin(Date.now() / 180) * 0.08;

      this.escenaActual.objetos.forEach((objeto) => {
        const cx = objeto.posicion.x * celda + celda / 2;
        const cy = objeto.posicion.y * celda + celda / 2;
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
