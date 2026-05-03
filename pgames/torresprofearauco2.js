/* ============================================================
   TORRE PROFEARAUCO 2
   Cinta, torres ordenables y control de calidad.
   Con soporte de Efectos de Sonido (Web Audio API)
   ============================================================ */

(function () {
  "use strict";

  const PREFIJO_UI = "juegosprofearauco";
  const DURACIONES_POR_VELOCIDAD = {
    lenta: 30,
    media: 22,
    rapida: 16
  };

  const CONFIG_POR_DEFECTO = {
    nivelInicial: 1,
    tema: "arauco-dark"
  };
  const UMBRAL_SWIPE_BARRA_TOUCH = 24;
  const UMBRAL_DOBLE_TOQUE_MS = 360;

  // --- MOTOR DE AUDIO SINTETIZADO ---
  class TorreAudio {
    constructor() {
      this.ctx = null;
      this.machineNode = null;
      this.silenciado = false;
      this.iniciado = false;
    }

    init() {
      if (this.iniciado) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.iniciado = true;
    }

    _resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    // Click/Snap rápido al soltar una ficha
    playClick() {
      if (this.silenciado || !this.ctx) return;
      this._resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.06);
      
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.06);
    }

    // Acorde/Campanazo de éxito
    playSuccess() {
      if (this.silenciado || !this.ctx) return;
      this._resume();
      const t = this.ctx.currentTime;
      
      // Acorde armónico: Tónica, Quinta, Octava
      const freqs =[523.25, 783.99, 1046.50];
      
      freqs.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0.25 / (i + 1), t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(t);
        osc.stop(t + 1.2);
      });
    }

    // Alarma estilo sierra en fallo
    playFallo() {
      if (this.silenciado || !this.ctx) return;
      this._resume();
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.setValueAtTime(160, t + 0.1);
      osc.frequency.setValueAtTime(120, t + 0.2);
      osc.frequency.setValueAtTime(160, t + 0.3);
      
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.5);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.5);
    }

    // Zumbido de máquina con LFO
    startMachine() {
      if (this.silenciado || !this.ctx || this.machineNode) return;
      this._resume();
      
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      osc.type = 'square';
      osc.frequency.value = 40; // Frecuencia muy baja (motor/zumbido)
      
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      
      // LFO para darle un pulso rítmico a la máquina
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 6; // Velocidad del pulso
      lfoGain.gain.value = 100;
      
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      // Entrada suave
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.5);
      
      osc.start(t);
      lfo.start(t);
      
      this.machineNode = {
        osc, lfo, gain, filter, lfoGain,
        stop: () => {
          try { osc.stop(); lfo.stop(); } catch(e){}
          osc.disconnect(); lfo.disconnect(); gain.disconnect(); filter.disconnect(); lfoGain.disconnect();
        }
      };
    }

    stopMachine() {
      if (this.machineNode && this.ctx) {
        const t = this.ctx.currentTime;
        this.machineNode.gain.gain.cancelScheduledValues(t);
        this.machineNode.gain.gain.linearRampToValueAtTime(0.001, t + 0.3);
        const mn = this.machineNode;
        setTimeout(() => {
          if (mn.stop) mn.stop();
        }, 350);
        this.machineNode = null;
      }
    }

    toggleMute() {
      this.silenciado = !this.silenciado;
      if (this.silenciado) this.stopMachine();
      return this.silenciado;
    }
  }
  // ------------------------------

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

    if (!Number.isFinite(numero)) {
      return fallback;
    }

    if (typeof minimo === "number") {
      return Math.max(numero, minimo);
    }

    return numero;
  }

  function enteroSeguro(valor, fallback, minimo) {
    return Math.round(numeroSeguro(valor, fallback, minimo));
  }

  function formatearSegundos(valor) {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return "-";
    }

    return `${Math.max(0, numero).toFixed(1)}s`;
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
      Object.keys(valor).forEach((clave) => {
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

  function inyectarEstilosTorre2() {
    if (document.getElementById("torreprofearauco2-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "torreprofearauco2-style";
    style.textContent = `
      .juegosprofearauco-torre2-root {
        --torre2-verde: #6be082;
        --torre2-naranjo: #ff8a1f;
        --torre2-panel: rgba(8, 18, 10, 0.92);
        --torre2-borde: rgba(107, 224, 130, 0.28);
        --torre2-maquina-w: clamp(92px, 12vw, 128px);
        --torre2-zona-w: clamp(108px, 14vw, 150px);
        --torre2-torre-max: clamp(108px, 18vw, 210px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel {
        position: relative;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-fullscreen,
      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-mute {
        position: absolute;
        top: 1rem;
        z-index: 8;
        padding: 0.42rem 0.8rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 138, 31, 0.45);
        background: rgba(8, 18, 10, 0.92);
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
      
      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-fullscreen { right: 1rem; }
      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-mute { right: 10.4rem; }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-fullscreen:hover,
      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-mute:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
        border-color: rgba(255, 138, 31, 0.72);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-fullscreen:active,
      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-mute:active {
        transform: translateY(1px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-superior {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        padding-right: 14rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-pregunta.juegosprofearauco-torre-consigna {
        display: none;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-bottomhud {
        display: none;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-bottomhud span {
        display: inline-flex;
        align-items: center;
        gap: 0.26rem;
        padding: 0.28rem 0.58rem;
        border-radius: 999px;
        background: rgba(8, 17, 10, 0.92);
        border: 1px solid rgba(107, 224, 130, 0.22);
        color: #f1f8f2;
        font-size: 0.76rem;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.025);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre2-bottomhud strong {
        color: var(--torre2-naranjo);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-cinta {
        flex: 1 1 auto;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-pista {
        width: 100%;
        aspect-ratio: 4 / 3;
        min-height: 0;
        height: auto;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-maquina {
        width: var(--torre2-maquina-w);
        padding: clamp(0.68rem, 1vw, 0.9rem) clamp(0.62rem, 0.95vw, 0.85rem);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-maquina strong,
      .juegosprofearauco-torre2-root .juegosprofearauco-torre-sismica strong {
        font-size: clamp(0.88rem, 1.35vw, 1rem);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-maquina span,
      .juegosprofearauco-torre2-root .juegosprofearauco-torre-sismica span {
        font-size: clamp(0.72rem, 1.05vw, 0.85rem);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-maquina-engranes {
        height: clamp(46px, 6vw, 58px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-maquina-engranaje-grande {
        width: clamp(28px, 3.4vw, 36px);
        height: clamp(28px, 3.4vw, 36px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-maquina-engranaje-medio {
        left: clamp(34px, 4.2vw, 42px);
        bottom: clamp(15px, 2vw, 18px);
        width: clamp(20px, 2.4vw, 24px);
        height: clamp(20px, 2.4vw, 24px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-maquina-engranaje-chico {
        left: clamp(56px, 6vw, 68px);
        width: clamp(16px, 2vw, 20px);
        height: clamp(16px, 2vw, 20px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-maquina-salida {
        left: calc(var(--torre2-maquina-w) - 46px);
        width: clamp(16px, 2vw, 20px);
        height: clamp(18px, 2.5vw, 24px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-semilla {
        left: calc(var(--torre2-maquina-w) - 24px);
        top: clamp(132px, 15vw, 152px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-sismica {
        width: var(--torre2-zona-w);
        padding: clamp(5.2rem, 8vw, 6rem) clamp(0.55rem, 0.9vw, 0.75rem) clamp(3rem, 5vw, 3.7rem);
        gap: 0.16rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-carril {
        z-index: 3;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-sismica::before {
        bottom: 0;
        border-radius: 14px;
        background:
          linear-gradient(180deg, rgba(255, 98, 0, 0.08) 0%, rgba(255, 98, 0, 0.02) 28%, rgba(0, 0, 0, 0) 70%),
          repeating-linear-gradient(
            90deg,
            rgba(255, 120, 32, 0.085) 0,
            rgba(255, 120, 32, 0.085) 14px,
            rgba(255, 120, 32, 0.02) 14px,
            rgba(255, 120, 32, 0.02) 28px
          );
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-sismica::after {
        left: 50%;
        right: auto;
        top: clamp(26px, 3.2vw, 36px);
        bottom: 0;
        width: clamp(38px, 34%, 56px);
        transform: translateX(-50%);
        border-radius: 999px;
        background:
          radial-gradient(circle at 50% 0%, rgba(255, 240, 240, 0.98) 0, rgba(255, 122, 122, 0.56) 16%, rgba(255, 68, 68, 0.2) 32%, transparent 56%),
          linear-gradient(
            180deg,
            rgba(255, 92, 92, 0.34) 0%,
            rgba(255, 70, 70, 0.18) 18%,
            rgba(255, 48, 48, 0.08) 52%,
            rgba(255, 48, 48, 0.01) 100%
          );
        opacity: 0.26;
        filter: blur(0.35px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-sismica strong,
      .juegosprofearauco-torre2-root .juegosprofearauco-torre-sismica span {
        text-shadow:
          0 2px 10px rgba(0, 0, 0, 0.72),
          0 0 10px rgba(0, 0, 0, 0.38);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-tenaza {
        left: calc(100% - 18px - (var(--torre2-zona-w) / 2));
        right: auto;
        width: clamp(78px, 10vw, 110px);
        height: clamp(22px, 3vw, 28px);
        transform: translateX(-50%) translateY(0);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-viaje {
        bottom: clamp(50px, 6vw, 58px);
        gap: clamp(0.28rem, 0.6vw, 0.48rem);
        max-width: min(calc(100% - var(--torre2-zona-w) - 54px), var(--torre2-torre-max));
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-stack {
        min-height: clamp(210px, 32vw, 320px);
        gap: clamp(0.24rem, 0.55vw, 0.45rem);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-base {
        padding: clamp(0.38rem, 0.7vw, 0.5rem) clamp(0.56rem, 0.9vw, 0.8rem);
        border-radius: clamp(11px, 1.5vw, 14px);
        font-size: clamp(0.66rem, 0.95vw, 0.76rem);
        border: 1px solid rgba(107, 224, 130, 0.22);
        background: linear-gradient(180deg, rgba(18, 34, 24, 0.98) 0%, rgba(11, 21, 14, 0.98) 100%);
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,0.02),
          0 8px 16px rgba(0, 0, 0, 0.24);
      }

     .juegosprofearauco-torre2-root .juegosprofearauco-torre-barra {
        min-height: clamp(42px, 5.6vw, 58px);
        padding: clamp(0.5rem, 0.85vw, 0.75rem) clamp(0.7rem, 1.1vw, 1rem);
        gap: 0;
        justify-content: center;
        text-align: center;
        border-radius: clamp(11px, 1.5vw, 14px);
        border: 1px solid rgba(107, 224, 130, 0.14);
        border-left: 5px solid #58db73;
        background: linear-gradient(180deg, rgba(31, 66, 38, 0.98) 0%, rgba(18, 39, 24, 0.98) 100%);
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,0.025),
          0 8px 16px rgba(0, 0, 0, 0.24);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-barra:hover {
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,0.03),
          0 10px 18px rgba(0, 0, 0, 0.28);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-barra-tactil-activa {
        border-color: rgba(125, 255, 154, 0.42);
        border-left-color: #88ff9b;
        background: linear-gradient(180deg, rgba(47, 100, 58, 0.98) 0%, rgba(23, 53, 31, 0.98) 100%);
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,0.03),
          0 0 0 2px rgba(107, 224, 130, 0.3),
          0 0 18px rgba(107, 224, 130, 0.18),
          0 10px 18px rgba(0, 0, 0, 0.28);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-barra-drop-target {
        box-shadow:
          inset 0 0 0 1px rgba(255, 184, 110, 0.24),
          0 0 0 1px rgba(255, 98, 0, 0.55),
          0 10px 20px rgba(255, 98, 0, 0.16);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-barra-ghost {
        box-shadow:
          inset 0 0 0 1px rgba(255, 184, 110, 0.18),
          0 18px 30px rgba(0, 0, 0, 0.42),
          0 0 0 1px rgba(255, 98, 0, 0.28);
      }



      .juegosprofearauco-torre2-root .juegosprofearauco-torre-barra-texto {
        font-size: clamp(0.78rem, 1.3vw, 0.98rem);
        line-height: 1.18;
      }

      .juegosprofearauco-torre2-estado {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }

      .juegosprofearauco-torre2-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: clamp(0.34rem, 0.7vw, 0.42rem) clamp(0.56rem, 1vw, 0.7rem);
        border-radius: 999px;
        background: rgba(8, 17, 10, 0.92);
        border: 1px solid rgba(107, 224, 130, 0.18);
        color: #e6f4e8;
        font-size: clamp(0.72rem, 0.95vw, 0.84rem);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
      }

      .juegosprofearauco-torre2-chip strong {
        color: #ffffff;
      }

      .juegosprofearauco-torre2-chip[data-estado="activo"] {
        border-color: rgba(107, 224, 130, 0.28);
      }

      .juegosprofearauco-torre2-chip[data-estado="timeoff"] {
        border-color: rgba(255, 177, 74, 0.36);
        color: #ffe4bf;
      }

      .juegosprofearauco-torre2-chip[data-estado="finalizado"] {
        border-color: rgba(255, 138, 31, 0.36);
        color: #ffd4af;
      }

      .juegosprofearauco-torre2-chip.ok {
        border-color: rgba(120, 255, 138, 0.28);
        color: #c8ffd1;
      }

      .juegosprofearauco-torre2-chip.fail {
        border-color: rgba(255, 177, 74, 0.32);
        color: #ffd6a4;
      }

      .juegosprofearauco-torre2-medidor,
      .juegosprofearauco-torre2-resumen {
        padding: 0.72rem 0.82rem;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(11, 28, 15, 0.96) 0%, rgba(7, 15, 9, 0.96) 100%);
        border: 1px solid var(--torre2-borde);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
      }

      .juegosprofearauco-torre2-medidor-head {
        display: flex;
        justify-content: space-between;
        gap: 0.8rem;
        align-items: baseline;
        margin-bottom: 0.45rem;
      }

      .juegosprofearauco-torre2-medidor-head span,
      .juegosprofearauco-torre2-resumen span {
        color: #d3e7d7;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .juegosprofearauco-torre2-medidor-head strong,
      .juegosprofearauco-torre2-resumen strong {
        color: #f5f5f5;
        font-size: 0.95rem;
      }

      .juegosprofearauco-torre2-barras-maquina {
        position: absolute;
        left: calc(var(--torre2-maquina-w) + 42px);
        top: 22px;
        width: min(340px, calc(100% - var(--torre2-maquina-w) - var(--torre2-zona-w) - 88px));
        display: flex;
        flex-direction: column;
        gap: 0.46rem;
        z-index: 2;
        pointer-events: none;
      }

      .juegosprofearauco-torre2-barra-linea {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.55rem;
      }

      .juegosprofearauco-torre2-barra-linea span,
      .juegosprofearauco-torre2-barra-linea strong {
        font-size: 0.8rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .juegosprofearauco-torre2-barra-linea span {
        color: #8fd89a;
      }

      .juegosprofearauco-torre2-barra-linea strong {
        color: #f7f7f7;
        font-weight: 800;
      }

      .juegosprofearauco-torre2-pista {
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.08);
      }

      .juegosprofearauco-torre2-barra {
        height: 100%;
        width: 0%;
        border-radius: inherit;
        transition: width 140ms linear, background 160ms ease;
      }

      .juegosprofearauco-torre2-barra-nivel {
        background: linear-gradient(90deg, #78ff8a 0%, #35c86a 100%);
      }

      .juegosprofearauco-torre2-barra-torre {
        background: linear-gradient(90deg, #ffb14a 0%, #ff7a00 100%);
      }

      .juegosprofearauco-torre2-resumen {
        min-width: 180px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.28rem;
      }

      .juegosprofearauco-torre2-balance {
        display: flex;
        gap: 0.42rem;
        flex-wrap: wrap;
        margin-top: 0.15rem;
      }

      .juegosprofearauco-torre2-balance b {
        display: inline-flex;
        align-items: center;
        gap: 0.24rem;
        padding: 0.18rem 0.5rem;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
        font-size: 0.82rem;
        color: #f5f5f5;
      }

      .juegosprofearauco-torre2-balance b.ok {
        color: #8bff9f;
      }

      .juegosprofearauco-torre2-balance b.fail {
        color: #ffb15f;
      }

      .juegosprofearauco-torre2-toast {
        position: absolute;
        left: 50%;
        top: 78px;
        transform: translateX(-50%);
        z-index: 4;
        max-width: min(68%, 440px);
        padding: 0.55rem 0.85rem;
        border-radius: 999px;
        background: rgba(6, 15, 8, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #f5f5f5;
        text-align: center;
        font-size: clamp(0.78rem, 1.1vw, 0.92rem);
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(3px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .juegosprofearauco-torre2-toast[data-visible="1"] {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .juegosprofearauco-torre2-toast--info {
        border-color: rgba(107, 224, 130, 0.2);
      }

      .juegosprofearauco-torre2-toast--warn {
        border-color: rgba(255, 177, 74, 0.35);
        color: #ffd59b;
      }

      .juegosprofearauco-torre2-toast--success {
        border-color: rgba(120, 255, 138, 0.35);
        color: #c7ffd0;
      }

      .juegosprofearauco-torre2-toast--error {
        border-color: rgba(255, 122, 0, 0.4);
        color: #ffd0a1;
      }

      .juegosprofearauco-torre2-overlay {
        position: absolute;
        inset: 22px 26px 32px 26px;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        opacity: 0;
        transform: scale(0.98);
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .juegosprofearauco-torre2-overlay[data-visible="1"] {
        opacity: 1;
        transform: scale(1);
      }

      .juegosprofearauco-torre2-overlay-card {
        width: min(520px, 100%);
        padding: 1rem 1.05rem;
        border-radius: 22px;
        background:
          linear-gradient(180deg, rgba(13, 24, 16, 0.96) 0%, rgba(7, 12, 8, 0.98) 100%);
        border: 1px solid rgba(255, 138, 31, 0.28);
        box-shadow:
          0 18px 44px rgba(0, 0, 0, 0.4),
          inset 0 0 0 1px rgba(255,255,255,0.03);
        text-align: center;
      }

      .juegosprofearauco-torre2-overlay-card span {
        display: inline-block;
        margin-bottom: 0.45rem;
        padding: 0.18rem 0.62rem;
        border-radius: 999px;
        background: rgba(255, 138, 31, 0.12);
        color: #ffba75;
        font-size: 0.78rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .juegosprofearauco-torre2-overlay-card strong {
        display: block;
        color: #ffffff;
        font-size: 1.38rem;
        line-height: 1.15;
      }

      .juegosprofearauco-torre2-overlay-card p {
        margin: 0.45rem 0 0;
        color: #d6e5d8;
        font-size: 0.95rem;
      }

      .juegosprofearauco-torre2-overlay-stats {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.9rem;
      }

      .juegosprofearauco-torre2-overlay-stats b {
        display: inline-flex;
        align-items: center;
        gap: 0.28rem;
        padding: 0.35rem 0.62rem;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        color: #ffffff;
        font-size: 0.84rem;
      }

      .juegosprofearauco-torre2-overlay-stats b.ok {
        color: #8bff9f;
      }

      .juegosprofearauco-torre2-overlay-stats b.fail {
        color: #ffbb72;
      }

      .juegosprofearauco-torre2-sidebar {
        gap: 0.8rem;
      }

      .juegosprofearauco-torre2-sidecard {
        display: flex;
        flex-direction: column;
        gap: 0.72rem;
        padding: 0.9rem;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(10, 21, 12, 0.96) 0%, rgba(8, 16, 10, 0.96) 100%);
        border: 1px solid rgba(107, 224, 130, 0.22);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
      }

      .juegosprofearauco-torre2-linea {
        display: flex;
        flex-direction: column;
        gap: 0.24rem;
      }

      .juegosprofearauco-torre2-linea span {
        color: #72d978;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .juegosprofearauco-torre2-linea strong {
        color: #f3f8f4;
        font-size: 0.98rem;
        line-height: 1.28;
        font-weight: 700;
      }

      .juegosprofearauco-torre2-mini-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .juegosprofearauco-torre2-mini-grid b {
        display: inline-flex;
        align-items: center;
        gap: 0.28rem;
        padding: 0.3rem 0.56rem;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(107, 224, 130, 0.12);
        color: #dff0e2;
        font-size: 0.79rem;
        font-weight: 700;
      }

      .juegosprofearauco-torre2-mini-grid b strong {
        color: #ffffff;
        font-size: 0.8rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-feedback {
        display: none;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-viaje-enfoque {
        filter: drop-shadow(0 0 18px rgba(107, 224, 130, 0.18));
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen {
        width: 100vw;
        height: 100svh;
        max-width: none;
        max-height: none;
        padding: 0.9rem;
        overflow: hidden;
        border-radius: 0;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr) auto;
        gap: 0.72rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-superior {
        gap: 0.55rem;
        padding-right: 8.2rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-titulo {
        font-size: clamp(0.94rem, 2vw, 1.34rem);
        line-height: 1;
        max-width: 12ch;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-marcadores {
        gap: 0.34rem 0.46rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-marcadores span {
        font-size: 0.76rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-marcadores span:nth-child(n+4) {
        display: none;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-torre2-estado {
        display: none;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-pregunta.juegosprofearauco-torre-consigna {
        padding: 0.45rem 0.78rem;
        font-size: 0.86rem;
        line-height: 1.15;
        min-height: 0;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-controles {
        margin-top: 0;
        gap: 0.55rem;
        justify-content: center;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-controles button {
        padding: 0.66rem 1rem;
        font-size: 0.88rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen:not(.is-finalizado) [data-tp-siguiente] {
        display: none;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-zona.juegosprofearauco-torre-zona,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-torre-cinta {
        min-height: 0;
        height: 100%;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen .juegosprofearauco-torre-pista {
        height: 100%;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape {
        padding: 0.68rem;
        gap: 0.5rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-superior {
        gap: 0.5rem;
        padding-right: 7.1rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-titulo {
        font-size: clamp(0.84rem, 2.5vw, 1.08rem);
        line-height: 1.02;
        max-width: 8ch;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-marcadores {
        display: none;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-marcadores {
        gap: 0.3rem 0.45rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-marcadores span {
        font-size: 0.7rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre2-estado {
        gap: 0.3rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre2-chip {
        padding: 0.24rem 0.46rem;
        font-size: 0.67rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-pregunta.juegosprofearauco-torre-consigna {
        font-size: 0.84rem;
        padding: 0.5rem 0.72rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre2-fullscreen {
        top: 0.68rem;
        right: 0.68rem;
        padding: 0.3rem 0.58rem;
        font-size: 0.72rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre2-mute {
        top: 0.68rem;
        right: 6.8rem;
        padding: 0.3rem 0.58rem;
        font-size: 0.72rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-controles {
        gap: 0.45rem;
        margin-top: 0;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-controles button {
        padding: 0.58rem 0.95rem;
        font-size: 0.84rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre2-bottomhud {
        display: flex;
        position: absolute;
        top: 3rem;
        right: 0.68rem;
        z-index: 7;
        width: 96px;
        flex-direction: column;
        align-items: stretch;
        gap: 0.26rem;
        margin-top: 0;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre2-bottomhud span {
        font-size: 0.64rem;
        justify-content: space-between;
        padding: 0.24rem 0.42rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-superior {
        gap: 0.18rem;
        padding-right: 5.8rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-titulo {
        font-size: 0.82rem;
        line-height: 1;
        max-width: 7.5ch;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-marcadores {
        display: none;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-marcadores {
        gap: 0.26rem 0.32rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-marcadores span {
        font-size: 0.66rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre2-fullscreen {
        top: 0.68rem;
        right: 0.68rem;
        padding: 0.32rem 0.56rem;
        font-size: 0.72rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre2-mute {
        top: 0.68rem;
        left: 0.68rem;
        right: auto;
        padding: 0.32rem 0.56rem;
        font-size: 0.72rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-controles button {
        padding: 0.56rem 0.82rem;
        font-size: 0.8rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre2-bottomhud {
        display: flex;
        position: absolute;
        left: 50%;
        bottom: 2.6rem;
        z-index: 7;
        transform: translateX(-50%);
        flex-wrap: nowrap;
        justify-content: center;
        align-items: flex-start;
        align-content: flex-start;
        gap: 0.22rem;
        margin-top: 0;
        width: auto;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre2-bottomhud span {
        flex: 0 0 auto;
        min-height: 0;
        font-size: 0.52rem;
        justify-content: center;
        min-width: max-content;
        padding: 0.18rem 0.34rem;
        line-height: 1;
        white-space: nowrap;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-maquina strong,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-sismica strong,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-maquina strong,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-sismica strong {
        font-size: 0.82rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-maquina span,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-sismica span,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-maquina span,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-sismica span {
        font-size: 0.64rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-barra-texto,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-barra-texto {
        font-size: 0.61rem;
        line-height: 1.08;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-base,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-base {
        font-size: 0.52rem;
        padding: 0.22rem 0.38rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-barra,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-barra {
        min-height: 34px;
        padding: 0.38rem 0.44rem;
        gap: 0.24rem;
        border-left-width: 4px;
      }



      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-barra-linea span,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-landscape .juegosprofearauco-torre-barra-linea strong,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-barra-linea span,
      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-barra-linea strong {
        font-size: 0.62rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait {
        --torre2-maquina-w: 82px;
        --torre2-zona-w: 88px;
        --torre2-torre-max: clamp(74px, 16vw, 110px);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-zona.juegosprofearauco-torre-zona {
        flex: 1 1 auto;
        min-height: 0;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-pista {
        aspect-ratio: 0.62 / 1;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-maquina {
        padding: 0.56rem 0.5rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre-sismica {
        padding: 4rem 0.4rem 2.55rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre2-barras-maquina {
        left: calc(var(--torre2-maquina-w) + 12px);
        top: 12px;
        width: calc(100% - var(--torre2-maquina-w) - var(--torre2-zona-w) - 24px);
        gap: 0.22rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-torre2-pista {
        height: 8px;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-controles {
        position: absolute;
        left: 50%;
        bottom: 0.38rem;
        z-index: 7;
        transform: translateX(-50%);
        margin-top: 0;
        justify-content: center;
        align-items: center;
        width: auto;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-panel.is-fullscreen.is-mobile-portrait .juegosprofearauco-controles button {
        flex: 0 0 auto;
        width: auto;
        min-width: 0;
        padding: 0.46rem 0.74rem;
        font-size: 0.76rem;
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-viaje[data-modo="estricto"] .juegosprofearauco-torre-base {
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,0.02),
          0 8px 16px rgba(0, 0, 0, 0.24),
          0 0 14px rgba(255, 138, 31, 0.08);
      }

      .juegosprofearauco-torre2-root .juegosprofearauco-torre-viaje[data-modo="laxo"] .juegosprofearauco-torre-base {
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,0.02),
          0 8px 16px rgba(0, 0, 0, 0.24),
          0 0 14px rgba(46, 205, 210, 0.08);
      }

      @media (max-width: 960px) {
        .juegosprofearauco-torre2-root {
          --torre2-maquina-w: 108px;
          --torre2-zona-w: 120px;
          --torre2-torre-max: clamp(92px, 20vw, 170px);
        }

        .juegosprofearauco-torre2-resumen {
          min-width: 0;
        }

        .juegosprofearauco-torre2-barras-maquina {
          left: calc(var(--torre2-maquina-w) + 24px);
          top: 18px;
          width: calc(100% - var(--torre2-maquina-w) - var(--torre2-zona-w) - 48px);
          gap: 0.34rem;
        }

        .juegosprofearauco-torre2-barra-linea {
          gap: 0.38rem;
        }

        .juegosprofearauco-torre2-barra-linea span,
        .juegosprofearauco-torre2-barra-linea strong {
          font-size: 0.68rem;
        }

        .juegosprofearauco-torre2-toast {
          max-width: calc(100% - 120px);
          top: 66px;
          font-size: 0.84rem;
        }

        .juegosprofearauco-torre2-sidecard {
          padding: 0.78rem;
        }

        .juegosprofearauco-torre2-overlay {
          inset: 18px 16px 22px 16px;
        }

        .juegosprofearauco-torre2-overlay-card {
          padding: 0.9rem 0.9rem;
        }

        .juegosprofearauco-torre2-overlay-card strong {
          font-size: 1.18rem;
        }
      }

      @media (max-width: 760px) {
        .juegosprofearauco-torre2-root {
          --torre2-maquina-w: 96px;
          --torre2-zona-w: 104px;
          --torre2-torre-max: clamp(86px, 19vw, 138px);
        }

        .juegosprofearauco-torre2-root .juegosprofearauco-torre-pista {
          aspect-ratio: 1 / 1;
        }

        .juegosprofearauco-torre2-barras-maquina {
          left: calc(var(--torre2-maquina-w) + 18px);
          width: calc(100% - var(--torre2-maquina-w) - var(--torre2-zona-w) - 36px);
          top: 16px;
        }

        .juegosprofearauco-torre2-barra-linea {
          grid-template-columns: minmax(34px, auto) minmax(0, 1fr) auto;
        }

        .juegosprofearauco-torre2-root .juegosprofearauco-torre-viaje {
          max-width: min(calc(100% - var(--torre2-zona-w) - 36px), var(--torre2-torre-max));
        }

        .juegosprofearauco-torre2-toast {
          top: 58px;
          max-width: min(74%, 300px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizarJSONTorre(textoOriginal) {
    let texto = String(textoOriginal || "").trim();

    try {
      return JSON.parse(texto);
    } catch (errorOriginal) {
      const reparado = texto.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

      try {
        return JSON.parse(reparado);
      } catch (errorReparado) {
        errorReparado.message =
          "JSON invalido incluso despues de intentar reparar barras de LaTeX. " +
          errorReparado.message;
        throw errorReparado;
      }
    }
  }

  function moverBarra(lista, indiceOrigen, indiceDestino) {
    const copia = lista.slice();

    if (
      indiceOrigen < 0 ||
      indiceOrigen >= copia.length ||
      indiceDestino < 0 ||
      indiceDestino >= copia.length
    ) {
      return copia;
    }

    const [barra] = copia.splice(indiceOrigen, 1);
    copia.splice(indiceDestino, 0, barra);

    return copia;
  }

  function obtenerOrden(barra) {
    if (typeof barra.grupoOrden !== "undefined") {
      return Number(barra.grupoOrden);
    }

    return Number(barra.claveOrden);
  }

  function estaOrdenada(torre, direccion) {
    return torre.every((barra, indice, arreglo) => {
      if (indice === 0) {
        return true;
      }

      const anterior = obtenerOrden(arreglo[indice - 1]);
      const actual = obtenerOrden(barra);

      if (direccion === "descendente") {
        return anterior >= actual;
      }

      return anterior <= actual;
    });
  }

  function mayorNucleoOrdenado(torre, direccion) {
    if (!torre.length) {
      return { inicio: -1, fin: -1, largo: 0 };
    }

    let mejorInicio = 0;
    let mejorLargo = 1;
    let inicioActual = 0;
    let largoActual = 1;

    for (let i = 1; i < torre.length; i++) {
      const anterior = obtenerOrden(torre[i - 1]);
      const actual = obtenerOrden(torre[i]);
      const ok = direccion === "descendente"
        ? anterior >= actual
        : anterior <= actual;

      if (ok) {
        largoActual++;
      } else {
        if (largoActual > mejorLargo) {
          mejorLargo = largoActual;
          mejorInicio = inicioActual;
        }

        inicioActual = i;
        largoActual = 1;
      }
    }

    if (largoActual > mejorLargo) {
      mejorLargo = largoActual;
      mejorInicio = inicioActual;
    }

    return {
      inicio: mejorInicio,
      fin: mejorInicio + mejorLargo - 1,
      largo: mejorLargo
    };
  }

  function datasetCompatibleConNivel(dataset, nivel) {
    if (dataset.modo !== nivel.modoAceptado) {
      return false;
    }

    if (dataset.modo === "laxo") {
      return dataset.barras.length >= nivel.minPorTorre;
    }

    return (
      dataset.barras.length >= nivel.minPorTorre &&
      dataset.barras.length <= nivel.maxPorTorre
    );
  }

  function normalizarBarra(barra, indice, datasetId) {
    if (!barra || typeof barra !== "object") {
      throw new Error(
        `Torre Profearauco: la barra ${indice + 1} del dataset '${datasetId}' no es valida.`
      );
    }

    const id = String(barra.id || `barra-${indice + 1}`).trim();
    const texto = String(barra.texto || "").trim();
    const tieneGrupo = typeof barra.grupoOrden !== "undefined";
    const tieneClave = typeof barra.claveOrden !== "undefined";

    if (!texto) {
      throw new Error(
        `Torre Profearauco: la barra '${id}' del dataset '${datasetId}' no tiene texto.`
      );
    }

    if (!tieneGrupo && !tieneClave) {
      throw new Error(
        `Torre Profearauco: la barra '${id}' del dataset '${datasetId}' necesita grupoOrden o claveOrden.`
      );
    }

    const grupoOrden = tieneGrupo ? Number(barra.grupoOrden) : undefined;
    const claveOrden = tieneClave ? Number(barra.claveOrden) : undefined;

    if (tieneGrupo && !Number.isFinite(grupoOrden)) {
      throw new Error(
        `Torre Profearauco: grupoOrden invalido en la barra '${id}' del dataset '${datasetId}'.`
      );
    }

    if (tieneClave && !Number.isFinite(claveOrden)) {
      throw new Error(
        `Torre Profearauco: claveOrden invalida en la barra '${id}' del dataset '${datasetId}'.`
      );
    }

    return {
      id,
      texto,
      textoHTML: prepararTextoMatematico(texto),
      grupoOrden,
      claveOrden
    };
  }

  function normalizarDatasetsConTorre(datasets) {
    if (!Array.isArray(datasets) || !datasets.length) {
      throw new Error("Torre Profearauco: el dataset debe incluir 'datasets'.");
    }

    const ids = new Set();

    return datasets.map((dataset, indice) => {
      if (!dataset || typeof dataset !== "object") {
        throw new Error(`Torre Profearauco: el dataset hijo ${indice + 1} no es valido.`);
      }

      const id = String(dataset.id || `dataset-${indice + 1}`).trim();

      if (!id) {
        throw new Error(`Torre Profearauco: el dataset hijo ${indice + 1} no tiene id.`);
      }

      if (ids.has(id)) {
        throw new Error(`Torre Profearauco: el dataset '${id}' esta repetido.`);
      }

      ids.add(id);

      const modo = dataset.modo === "laxo" ? "laxo" : "estricto";
      const direccion = dataset.direccion === "descendente"
        ? "descendente"
        : "ascendente";
      const barrasOriginales = Array.isArray(dataset.barras) ? dataset.barras :[];

      if (!barrasOriginales.length) {
        throw new Error(`Torre Profearauco: el dataset '${id}' no tiene barras.`);
      }

      const barras = barrasOriginales.map((barra, barraIndice) =>
        normalizarBarra(barra, barraIndice, id)
      );

      return {
        id,
        titulo: String(dataset.titulo || id),
        tituloHTML: prepararTextoMatematico(dataset.titulo || id),
        modo,
        bandeja: String(dataset.bandeja || ""),
        bandejaHTML: prepararTextoMatematico(dataset.bandeja || ""),
        consigna: String(
          dataset.consigna || "Reordena la torre antes del control de calidad."
        ),
        consignaHTML: prepararTextoMatematico(
          dataset.consigna || "Reordena la torre antes del control de calidad."
        ),
        direccion,
        barras
      };
    });
  }

  function normalizarNivelesConTorre(niveles) {
    if (!Array.isArray(niveles) || !niveles.length) {
      throw new Error("Torre Profearauco: el dataset debe incluir al menos un nivel.");
    }

    const ids = new Set();

    return niveles.map((nivel, indice) => {
      if (!nivel || typeof nivel !== "object") {
        throw new Error(`Torre Profearauco: el nivel ${indice + 1} no es valido.`);
      }

      const id = enteroSeguro(nivel.id, indice + 1, 1);

      if (ids.has(id)) {
        throw new Error(`Torre Profearauco: el nivel ${id} esta repetido.`);
      }

      ids.add(id);

      const modoAceptado = nivel.modoAceptado === "laxo" ? "laxo" : "estricto";
      const modoFlujo = nivel.modoFlujo === "multitower" ? "multitower" : "singletower";
      const minPorTorre = enteroSeguro(nivel.minPorTorre, 3, 2);
      const maxPorTorre = Math.max(
        minPorTorre,
        enteroSeguro(nivel.maxPorTorre, minPorTorre, minPorTorre)
      );
      const velocidadCinta =["lenta", "media", "rapida"].includes(nivel.velocidadCinta)
        ? nivel.velocidadCinta
        : "media";
      const tiempoBase = DURACIONES_POR_VELOCIDAD[velocidadCinta] || 22;
      const tiempoRecorridoTorre = numeroSeguro(
        nivel.tiempoRecorridoTorre,
        numeroSeguro(nivel.tiempoLimite, tiempoBase, 8),
        8
      );
      const tiempoNivel = numeroSeguro(
        nivel.tiempoNivel,
        Math.max(tiempoRecorridoTorre * 4, 45),
        10
      );
      const tiempoEntreTorres = numeroSeguro(
        nivel.tiempoEntreTorres,
        modoFlujo === "multitower" ? Math.max(4, tiempoRecorridoTorre / 3) : 1.4,
        0
      );

      return {
        id,
        nombre: String(nivel.nombre || `Nivel ${id}`),
        descripcion: String(nivel.descripcion || nivel.info || "").trim(),
        descripcionHTML: prepararTextoMatematico(nivel.descripcion || nivel.info || ""),
        modoAceptado,
        modoFlujo,
        minPorTorre,
        maxPorTorre,
        tiempoNivel,
        tiempoRecorridoTorre,
        tiempoEntreTorres,
        puntuacion: {
          modo:
            nivel.puntuacion && nivel.puntuacion.modo === "parcial"
              ? "parcial"
              : "completa",
          criterio:
            nivel.puntuacion && nivel.puntuacion.criterio
              ? String(nivel.puntuacion.criterio)
              : "nucleo_estable"
        }
      };
    });
  }

  function normalizarDatasetTorre(dataset) {
    if (!dataset || typeof dataset !== "object") {
      throw new Error("Torre Profearauco: no se recibio dataset.");
    }

    return {
      titulo: String(dataset.titulo || "Torre Profearauco"),
      tituloHTML: prepararTextoMatematico(dataset.titulo || "Torre Profearauco"),
      niveles: normalizarNivelesConTorre(dataset.niveles),
      datasets: normalizarDatasetsConTorre(dataset.datasets)
    };
  }

  class JuegoTorreProfearauco {
    constructor(contenedor, dataset, opciones = {}) {
      this.contenedor = contenedor;
      this.datasetRaiz = normalizarDatasetTorre(dataset);
      this.config = this.resolverConfig(opciones);

      this.audio = new TorreAudio(); // Instanciamos el motor de audio

      this.indiceNivelActual = 0;
      this.nivelActual = null;
      this.datasetsCompatibles =[];
      this.ultimoDatasetId = null;
      this.torres =[];
      this.siguienteIdTorre = 1;
      this.torreEnfoqueId = null;
      this.puntaje = 0;
      this.tiempoNivelRestante = 0;
      this.tiempoDespachoRestante = 0;
      this.estadoNivel = "listo";
      this.torresResueltasNivel = 0;
      this.torresExitosasNivel = 0;
      this.torresFallidasNivel = 0;
      this.despachosPendientes = 0;
      this.dragState = null;
      this.touchGesture = null;
      this.touchSelection = null;
      this.touchTapState = null;
      this.timeoutIds =[];
      this.animationFrameId = null;
      this.ultimoTimestamp = 0;

      this.elConsigna = null;
      this.elPanel = null;
      this.elPuntaje = null;
      this.elNivel = null;
      this.elTiempoNivel = null;
      this.elPuntajeBottom = null;
      this.elNivelBottom = null;
      this.elTiempoNivelBottom = null;
      this.elTiempoTorre = null;
      this.elTiempoCarga = null;
      this.elBarras = null;
      this.elResumenNivel = null;
      this.elBarraNivel = null;
      this.elResumenTorre = null;
      this.elBarraTorre = null;
      this.elResumenOk = null;
      this.elResumenFail = null;
      this.elResumenTotal = null;
      this.elChipFase = null;
      this.elChipFlujo = null;
      this.elChipActivas = null;
      this.elOverlay = null;
      this.elOverlayTitle = null;
      this.elOverlayBody = null;
      this.elOverlayOk = null;
      this.elOverlayFail = null;
      this.elOverlayTotal = null;
      this.elPista = null;
      this.elSemillas = null;
      this.elToast = null;
      this.elTrafico = null;
      this.elSismica = null;
      this.elTenaza = null;
      this.elDatasetTitulo = null;
      this.elModo = null;
      this.elDireccion = null;
      this.elPuntuacion = null;
      this.elNivelInfo = null;
      this.elNivelRitmo = null;
      this.elNucleo = null;
      this.elFeedback = null;
      this.botonReiniciar = null;
      this.botonSiguiente = null;
      this.botonPantallaCompleta = null;
      this.botonMute = null;
      this.toastSecuencia = 0;

      this.tick = this.tick.bind(this);
      this.manejarResize = this.manejarResize.bind(this);
      this.alternarPantallaCompleta = this.alternarPantallaCompleta.bind(this);
      this.alternarMute = this.alternarMute.bind(this);
      this.manejarCambioFullscreen = this.manejarCambioFullscreen.bind(this);
      this.actualizarModoPantalla = this.actualizarModoPantalla.bind(this);
      this.manejarPointerDown = this.manejarPointerDown.bind(this);
      this.manejarPointerMove = this.manejarPointerMove.bind(this);
      this.manejarPointerUp = this.manejarPointerUp.bind(this);
      this.reiniciarNivel = this.reiniciarNivel.bind(this);
      this.irASiguienteNivel = this.irASiguienteNivel.bind(this);
    }

    resolverConfig(opciones) {
      const base = {
        ...CONFIG_POR_DEFECTO,
        ...opciones
      };

      return {
        nivelInicial: enteroSeguro(base.nivelInicial, 1, 1),
        tema: typeof base.tema === "string" ? base.tema : "arauco-dark"
      };
    }

    iniciar() {
      inyectarEstilosTorre2();
      this.construirInterfaz();
      this.registrarEventos();
      document.addEventListener("fullscreenchange", this.manejarCambioFullscreen);
      window.addEventListener("orientationchange", this.actualizarModoPantalla);
      this.prepararNivelPorId(this.config.nivelInicial);
      this.actualizarModoPantalla();
      this.manejarResize();
      this.comenzarLoop();
      return this;
    }

    destruir() {
      this.detenerLoop();
      this.limpiarTemporizadores();
      this.finalizarDrag(true);
      this.desregistrarEventos();
      this.audio.stopMachine();
      if(this.audio.ctx) this.audio.ctx.close();
      document.removeEventListener("fullscreenchange", this.manejarCambioFullscreen);
      window.removeEventListener("orientationchange", this.actualizarModoPantalla);
      this.contenedor.innerHTML = "";
    }

    construirInterfaz() {
      this.contenedor.classList.add(claseUI("app"));
      this.contenedor.classList.add("juegosprofearauco-torre2-root");

      this.contenedor.innerHTML = `
        <div class="${claseUI("panel")}">
          <button type="button" class="juegosprofearauco-torre2-fullscreen" data-tp-fullscreen>
            Pantalla completa
          </button>
          <button type="button" class="juegosprofearauco-torre2-mute" data-tp-mute>
            🔊 Sonido
          </button>
          <div class="${claseUI("superior")}">
            <h2 class="${claseUI("titulo")}"></h2>
            <div class="${claseUI("marcadores")}">
              <span>Pts: <strong data-tp-puntaje>0</strong></span>
              <span>Nivel: <strong data-tp-nivel>-</strong></span>
              <span>Tiempo: <strong data-tp-tiempo-nivel>-</strong></span>
              <span>Torre: <strong data-tp-tiempo-torre>-</strong></span>
              <span>Despacho: <strong data-tp-tiempo-carga>-</strong></span>
              <span>Barras: <strong data-tp-barras>-</strong></span>
            </div>
            <div class="juegosprofearauco-torre2-estado">
              <span class="juegosprofearauco-torre2-chip" data-tp-fase-chip data-estado="activo">
                Fase <strong data-tp-fase>Activa</strong>
              </span>
              <span class="juegosprofearauco-torre2-chip">
                Flujo <strong data-tp-flujo>-</strong>
              </span>
              <span class="juegosprofearauco-torre2-chip">
                Activas <strong data-tp-activas>0</strong>
              </span>
              <span class="juegosprofearauco-torre2-chip ok">
                OK <strong data-tp-resumen-ok>0</strong>
              </span>
              <span class="juegosprofearauco-torre2-chip fail">
                FAIL <strong data-tp-resumen-fail>0</strong>
              </span>
              <span class="juegosprofearauco-torre2-chip">
                TOTAL <strong data-tp-resumen-total>0</strong>
              </span>
            </div>
          </div>

          <div class="${claseUI("pregunta")} ${claseUI("torre-consigna")}" data-tp-consigna></div>

          <div class="${claseUI("zona")} ${claseUI("torre-zona")}">
            <section class="${claseUI("torre-cinta")}">
              <div class="${claseUI("torre-pista")}" data-tp-pista>
                <div class="${claseUI("torre-maquina")}">
                  <strong>Maquina</strong>
                  <span>Carga torres en secuencia</span>
                  <div class="${claseUI("torre-maquina-engranes")}" aria-hidden="true">
                    <span class="${claseUI("torre-maquina-engranaje")} ${claseUI("torre-maquina-engranaje-grande")}"></span>
                    <span class="${claseUI("torre-maquina-engranaje")} ${claseUI("torre-maquina-engranaje-medio")}"></span>
                    <span class="${claseUI("torre-maquina-engranaje")} ${claseUI("torre-maquina-engranaje-chico")}"></span>
                  </div>
                  <div class="${claseUI("torre-maquina-salida")}" aria-hidden="true"></div>
                </div>
                <div class="juegosprofearauco-torre2-barras-maquina">
                  <div class="juegosprofearauco-torre2-barra-linea">
                    <span>Nivel</span>
                    <div class="juegosprofearauco-torre2-pista">
                      <div class="juegosprofearauco-torre2-barra juegosprofearauco-torre2-barra-nivel" data-tp-barra-nivel></div>
                    </div>
                    <strong data-tp-resumen-nivel>-</strong>
                  </div>
                  <div class="juegosprofearauco-torre2-barra-linea">
                    <span>Foco</span>
                    <div class="juegosprofearauco-torre2-pista">
                      <div class="juegosprofearauco-torre2-barra juegosprofearauco-torre2-barra-torre" data-tp-barra-torre></div>
                    </div>
                    <strong data-tp-resumen-torre>-</strong>
                  </div>
                </div>

                <div class="${claseUI("torre-carril")}"></div>

                <div class="${claseUI("torre-sismica")}" data-tp-sismica>
                  <strong>Control de calidad</strong>
                  <span>Escaneo infrarrojo</span>
                </div>

                <div class="${claseUI("torre-tenaza")}" data-tp-tenaza></div>

                <div class="${claseUI("torre-semillas")}" data-tp-semillas></div>
                <div class="juegosprofearauco-torre2-toast" data-tp-toast data-visible="0"></div>
                <div class="juegosprofearauco-torre2-overlay" data-tp-overlay data-visible="0">
                  <div class="juegosprofearauco-torre2-overlay-card">
                    <span>Resumen del nivel</span>
                    <strong data-tp-overlay-title>-</strong>
                    <p data-tp-overlay-body>-</p>
                    <div class="juegosprofearauco-torre2-overlay-stats">
                      <b class="ok">OK <strong data-tp-overlay-ok>0</strong></b>
                      <b class="fail">FAIL <strong data-tp-overlay-fail>0</strong></b>
                      <b>TOTAL <strong data-tp-overlay-total>0</strong></b>
                    </div>
                  </div>
                </div>
                <div class="${claseUI("torre-trafico")}" data-tp-trafico></div>
              </div>
            </section>

          </div>

          <div class="juegosprofearauco-torre2-bottomhud">
            <span>Pts: <strong data-tp-bottom-puntaje>0</strong></span>
            <span>Nivel: <strong data-tp-bottom-nivel>-</strong></span>
            <span>Tiempo: <strong data-tp-bottom-tiempo-nivel>-</strong></span>
          </div>

          <div class="${claseUI("feedback")}" data-tp-feedback></div>

          <div class="${claseUI("controles")}">
            <button type="button" data-tp-reiniciar>Reiniciar</button>
            <button type="button" data-tp-siguiente>Siguiente nivel</button>
          </div>
        </div>
      `;

      buscarPorClase(this.contenedor, "titulo").innerHTML = this.datasetRaiz.tituloHTML;

      this.elPanel = this.contenedor.querySelector(selectorClaseUI("panel"));
      this.elConsigna = this.contenedor.querySelector("[data-tp-consigna]");
      this.elPuntaje = this.contenedor.querySelector("[data-tp-puntaje]");
      this.elNivel = this.contenedor.querySelector("[data-tp-nivel]");
      this.elTiempoNivel = this.contenedor.querySelector("[data-tp-tiempo-nivel]");
      this.elPuntajeBottom = this.contenedor.querySelector("[data-tp-bottom-puntaje]");
      this.elNivelBottom = this.contenedor.querySelector("[data-tp-bottom-nivel]");
      this.elTiempoNivelBottom = this.contenedor.querySelector("[data-tp-bottom-tiempo-nivel]");
      this.elTiempoTorre = this.contenedor.querySelector("[data-tp-tiempo-torre]");
      this.elTiempoCarga = this.contenedor.querySelector("[data-tp-tiempo-carga]");
      this.elBarras = this.contenedor.querySelector("[data-tp-barras]");
      this.elResumenNivel = this.contenedor.querySelector("[data-tp-resumen-nivel]");
      this.elBarraNivel = this.contenedor.querySelector("[data-tp-barra-nivel]");
      this.elResumenTorre = this.contenedor.querySelector("[data-tp-resumen-torre]");
      this.elBarraTorre = this.contenedor.querySelector("[data-tp-barra-torre]");
      this.elResumenOk = this.contenedor.querySelector("[data-tp-resumen-ok]");
      this.elResumenFail = this.contenedor.querySelector("[data-tp-resumen-fail]");
      this.elResumenTotal = this.contenedor.querySelector("[data-tp-resumen-total]");
      this.elChipFase = this.contenedor.querySelector("[data-tp-fase-chip]");
      this.elChipFlujo = this.contenedor.querySelector("[data-tp-flujo]");
      this.elChipActivas = this.contenedor.querySelector("[data-tp-activas]");
      this.elPista = this.contenedor.querySelector("[data-tp-pista]");
      this.elSemillas = this.contenedor.querySelector("[data-tp-semillas]");
      this.elToast = this.contenedor.querySelector("[data-tp-toast]");
      this.elOverlay = this.contenedor.querySelector("[data-tp-overlay]");
      this.elOverlayTitle = this.contenedor.querySelector("[data-tp-overlay-title]");
      this.elOverlayBody = this.contenedor.querySelector("[data-tp-overlay-body]");
      this.elOverlayOk = this.contenedor.querySelector("[data-tp-overlay-ok]");
      this.elOverlayFail = this.contenedor.querySelector("[data-tp-overlay-fail]");
      this.elOverlayTotal = this.contenedor.querySelector("[data-tp-overlay-total]");
      this.elTrafico = this.contenedor.querySelector("[data-tp-trafico]");
      this.elSismica = this.contenedor.querySelector("[data-tp-sismica]");
      this.elTenaza = this.contenedor.querySelector("[data-tp-tenaza]");
      this.elDatasetTitulo = this.contenedor.querySelector("[data-tp-dataset-titulo]");
      this.elModo = this.contenedor.querySelector("[data-tp-modo]");
      this.elDireccion = this.contenedor.querySelector("[data-tp-direccion]");
      this.elPuntuacion = this.contenedor.querySelector("[data-tp-puntuacion]");
      this.elNivelInfo = this.contenedor.querySelector("[data-tp-nivel-info]");
      this.elNivelRitmo = this.contenedor.querySelector("[data-tp-nivel-ritmo]");
      this.elNucleo = this.contenedor.querySelector("[data-tp-nucleo]");
      this.elFeedback = this.contenedor.querySelector("[data-tp-feedback]");
      this.botonReiniciar = this.contenedor.querySelector("[data-tp-reiniciar]");
      this.botonSiguiente = this.contenedor.querySelector("[data-tp-siguiente]");
      this.botonPantallaCompleta = this.contenedor.querySelector("[data-tp-fullscreen]");
      this.botonMute = this.contenedor.querySelector("[data-tp-mute]");

      renderizarLatex(this.contenedor);
    }

    registrarEventos() {
      this.elPista.addEventListener("pointerdown", this.manejarPointerDown);
      this.botonReiniciar.addEventListener("click", this.reiniciarNivel);
      this.botonSiguiente.addEventListener("click", this.irASiguienteNivel);
      if (this.botonPantallaCompleta) {
        this.botonPantallaCompleta.addEventListener("click", this.alternarPantallaCompleta);
      }
      if (this.botonMute) {
        this.botonMute.addEventListener("click", this.alternarMute);
      }
      window.addEventListener("resize", this.manejarResize);
    }

    desregistrarEventos() {
      if (this.elPista) {
        this.elPista.removeEventListener("pointerdown", this.manejarPointerDown);
      }

      if (this.botonReiniciar) {
        this.botonReiniciar.removeEventListener("click", this.reiniciarNivel);
      }

      if (this.botonSiguiente) {
        this.botonSiguiente.removeEventListener("click", this.irASiguienteNivel);
      }

      if (this.botonPantallaCompleta) {
        this.botonPantallaCompleta.removeEventListener("click", this.alternarPantallaCompleta);
      }
      
      if (this.botonMute) {
        this.botonMute.removeEventListener("click", this.alternarMute);
      }

      window.removeEventListener("resize", this.manejarResize);
      window.removeEventListener("pointermove", this.manejarPointerMove);
      window.removeEventListener("pointerup", this.manejarPointerUp);
    }

    comenzarLoop() {
      if (this.animationFrameId !== null) {
        return;
      }

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
      if (!this.ultimoTimestamp) {
        this.ultimoTimestamp = timestamp;
      }

      const dt = Math.min((timestamp - this.ultimoTimestamp) / 1000, 0.05);
      this.ultimoTimestamp = timestamp;
      this.actualizar(dt);
      this.animationFrameId = window.requestAnimationFrame(this.tick);
    }

    actualizar(dt) {
      if (!this.nivelActual || this.estadoNivel === "finalizado") {
        return;
      }

      if (this.estadoNivel === "activo") {
        this.tiempoNivelRestante = Math.max(0, this.tiempoNivelRestante - dt);

        if (this.tiempoNivelRestante <= 0) {
          this.entrarEnTimeoff();
        }
      }

      this.actualizarDespacho(dt);
      this.actualizarMovimientoTorres(dt);
      this.actualizarHUD();
      this.actualizarPosicionesTorres();
      this.actualizarAlertaEscaneo();
      this.actualizarPanelTorreEnfoque();

      if (this.estadoNivel === "timeoff" && !this.torres.length) {
        this.finalizarNivel();
      }
    }

    actualizarDespacho(dt) {
      if (this.estadoNivel !== "activo") {
        return;
      }

      if (this.nivelActual.modoFlujo === "multitower") {
        this.tiempoDespachoRestante = Math.max(0, this.tiempoDespachoRestante - dt);

        if (this.tiempoDespachoRestante <= 0) {
          this.despacharTorre();
          this.tiempoDespachoRestante = this.nivelActual.tiempoEntreTorres;
        }

        return;
      }

      if (this.torres.length) {
        return;
      }

      if (this.despachosPendientes) {
        return;
      }

      this.tiempoDespachoRestante = Math.max(0, this.tiempoDespachoRestante - dt);

      if (this.tiempoDespachoRestante <= 0) {
        this.despacharTorre();
      }
    }

    actualizarMovimientoTorres(dt) {
      const aEvaluar =[];

      this.torres.forEach((torre) => {
        if (torre.estado !== "corriendo") {
          return;
        }

        torre.tiempoRestante = Math.max(0, torre.tiempoRestante - dt);
        torre.progreso = clamp(
          1 - torre.tiempoRestante / torre.tiempoTotal,
          0,
          1
        );

        if (torre.tiempoRestante <= 0 || torre.progreso >= 1) {
          torre.progreso = 1;
          aEvaluar.push(torre.id);
        }
      });

      aEvaluar.forEach((torreId) => {
        this.evaluarTorrePorId(torreId);
      });
    }

    iniciarNivelPorId(nivelId) {
      const indice = this.datasetRaiz.niveles.findIndex((nivel) => nivel.id === nivelId);
      this.iniciarNivel(indice >= 0 ? indice : 0);
    }

    prepararNivelPorId(nivelId) {
      const indice = this.datasetRaiz.niveles.findIndex((nivel) => nivel.id === nivelId);
      this.prepararNivel(indice >= 0 ? indice : 0);
    }

    prepararNivel(indiceNivel) {
      this.cancelarInteraccionTactil(true);
      this.finalizarDrag(true);
      this.limpiarTemporizadores();
      this.audio.stopMachine();

      this.indiceNivelActual = clamp(
        indiceNivel,
        0,
        this.datasetRaiz.niveles.length - 1
      );
      this.nivelActual = this.datasetRaiz.niveles[this.indiceNivelActual];
      this.datasetsCompatibles = this.obtenerDatasetsCompatibles(this.nivelActual);

      if (!this.datasetsCompatibles.length) {
        throw new Error(
          `Torre Profearauco: no hay datasets compatibles con el nivel ${this.nivelActual.id}.`
        );
      }

      this.ultimoDatasetId = null;
      this.torres =[];
      this.siguienteIdTorre = 1;
      this.torreEnfoqueId = null;
      this.tiempoNivelRestante = this.nivelActual.tiempoNivel;
      this.tiempoDespachoRestante = 0;
      this.estadoNivel = "listo";
      this.torresResueltasNivel = 0;
      this.torresExitosasNivel = 0;
      this.torresFallidasNivel = 0;
      this.despachosPendientes = 0;

      this.elTrafico.innerHTML = "";
      this.elSemillas.innerHTML = "";
      this.elTenaza.classList.remove(claseUI("torre-tenaza-activa"));
      this.elSismica.classList.remove(claseUI("torre-sismica-alerta"));
      this.elConsigna.textContent = "Pulsa iniciar para cargar la primera torre.";
      this.ocultarOverlayNivel();
      this.renderizarInfoNivel();
      this.botonSiguiente.disabled =
        this.indiceNivelActual >= this.datasetRaiz.niveles.length - 1;

      if (this.botonReiniciar) {
        this.botonReiniciar.textContent = "Iniciar";
      }

      this.mostrarFeedback("Pulsa Iniciar para comenzar el nivel.", "info", true);
      this.actualizarHUD();
      this.actualizarPanelTorreEnfoque();
    }

    iniciarNivel(indiceNivel) {
      this.audio.init(); // Asegurarnos de habilitar el contexto de audio (Autoplay Policy)
      this.cancelarInteraccionTactil(true);
      this.finalizarDrag(true);
      this.limpiarTemporizadores();

      this.indiceNivelActual = clamp(
        indiceNivel,
        0,
        this.datasetRaiz.niveles.length - 1
      );
      this.nivelActual = this.datasetRaiz.niveles[this.indiceNivelActual];
      this.datasetsCompatibles = this.obtenerDatasetsCompatibles(this.nivelActual);

      if (!this.datasetsCompatibles.length) {
        throw new Error(
          `Torre Profearauco: no hay datasets compatibles con el nivel ${this.nivelActual.id}.`
        );
      }

      this.ultimoDatasetId = null;
      this.torres =[];
      this.siguienteIdTorre = 1;
      this.torreEnfoqueId = null;
      this.tiempoNivelRestante = this.nivelActual.tiempoNivel;
      this.tiempoDespachoRestante = 0;
      this.estadoNivel = "activo";
      this.torresResueltasNivel = 0;
      this.torresExitosasNivel = 0;
      this.torresFallidasNivel = 0;
      this.despachosPendientes = 0;

      this.elTrafico.innerHTML = "";
      this.elSemillas.innerHTML = "";
      this.elTenaza.classList.remove(claseUI("torre-tenaza-activa"));
      this.elSismica.classList.remove(claseUI("torre-sismica-alerta"));
      this.elConsigna.textContent = "La maquina prepara la primera torre.";
      this.ocultarOverlayNivel();
      this.renderizarInfoNivel();
      this.botonSiguiente.disabled =
        this.indiceNivelActual >= this.datasetRaiz.niveles.length - 1;

      if (this.botonReiniciar) {
        this.botonReiniciar.textContent = "Reiniciar";
      }
      
      this.audio.startMachine(); // Arranca el sonido del motor de la cinta

      this.mostrarFeedback("Nivel en marcha. La maquina cargara torres segun el flujo definido.", "info");

      if (this.nivelActual.modoFlujo === "multitower") {
        this.despacharTorre();
        this.tiempoDespachoRestante = this.nivelActual.tiempoEntreTorres;
      } else {
        this.despacharTorre();
      }

      this.actualizarHUD();
      this.actualizarPanelTorreEnfoque();
    }

    entrarEnTimeoff() {
      if (this.estadoNivel !== "activo") {
        return;
      }

      this.estadoNivel = "timeoff";
      this.tiempoNivelRestante = 0;
      this.tiempoDespachoRestante = 0;
      this.cancelarInteraccionTactil();
      this.finalizarDrag(true);
      this.audio.stopMachine(); // Apagar sonido del motor
      this.mostrarFeedback("Se termino el tiempo del nivel. La cinta evacua y evalua lo residual.", "warn", true);
    }
    
    alternarMute() {
      const silenciado = this.audio.toggleMute();
      this.botonMute.textContent = silenciado ? "🔇 Mute" : "🔊 Sonido";
      if (!silenciado && this.estadoNivel === "activo") {
        this.audio.startMachine();
      }
    }

    obtenerDatasetsCompatibles(nivel) {
      return this.datasetRaiz.datasets.filter((dataset) =>
        datasetCompatibleConNivel(dataset, nivel)
      );
    }

    seleccionarDatasetCompatible() {
      if (!this.datasetsCompatibles.length) {
        return null;
      }

      if (this.datasetsCompatibles.length === 1) {
        return this.datasetsCompatibles[0];
      }

      const candidatos = this.datasetsCompatibles.filter(
        (dataset) => dataset.id !== this.ultimoDatasetId
      );
      const bolsa = candidatos.length ? candidatos : this.datasetsCompatibles;
      const elegido = bolsa[Math.floor(Math.random() * bolsa.length)];

      this.ultimoDatasetId = elegido.id;
      return elegido;
    }

    clonarBarra(barra) {
      return {
        ...barra
      };
    }

    enteroAleatorio(minimo, maximo) {
      return Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
    }

    generarTorreEstricta(dataset) {
      return dataset.barras.map((barra) => this.clonarBarra(barra));
    }

    generarTorreLaxa(dataset) {
      const maximo = Math.min(this.nivelActual.maxPorTorre, dataset.barras.length);
      const minimo = Math.min(this.nivelActual.minPorTorre, maximo);
      const cantidad = this.enteroAleatorio(minimo, maximo);

      return mezclar(dataset.barras)
        .slice(0, cantidad)
        .map((barra) => this.clonarBarra(barra));
    }

    generarTorreParaDataset(dataset) {
      const barrasBase = dataset.modo === "laxo"
        ? this.generarTorreLaxa(dataset)
        : this.generarTorreEstricta(dataset);

      let mezcla = barrasBase;

      for (let intento = 0; intento < 12; intento++) {
        mezcla = mezclar(mezcla);

        if (!estaOrdenada(mezcla, dataset.direccion)) {
          return mezcla.map((barra) => this.clonarBarra(barra));
        }
      }

      return mezcla.map((barra) => this.clonarBarra(barra));
    }

    crearTorreActiva(dataset) {
      return {
        id: this.siguienteIdTorre++,
        dataset,
        barras: this.generarTorreParaDataset(dataset),
        barrasEstado: Object.create(null),
        nucleo: null,
        tiempoTotal: this.nivelActual.tiempoRecorridoTorre,
        tiempoRestante: this.nivelActual.tiempoRecorridoTorre,
        progreso: 0,
        estado: "corriendo"
      };
    }

    despacharTorre() {
      if (this.estadoNivel !== "activo") {
        return;
      }

      if (this.nivelActual.modoFlujo === "singletower" && this.torres.length) {
        return;
      }

      const dataset = this.seleccionarDatasetCompatible();
      const torre = this.crearTorreActiva(dataset);
      this.despachosPendientes++;
      this.animarDespachoSemilla();

      this.agendar(() => {
        if (!this.nivelActual) {
          return;
        }

        this.despachosPendientes = Math.max(0, this.despachosPendientes - 1);
        this.torres.push(torre);

        if (!this.dragState) {
          this.fijarEnfoque(torre.id);
        }

        this.renderizarTorreDom(torre);
        this.actualizarPosicionTorre(torre);
        this.actualizarPanelTorreEnfoque();
        this.actualizarHUD();
        this.mostrarFeedback("Nueva torre cargada. Reordena antes del control de calidad.", "info");
      }, 260);
    }

    reiniciarNivel() {
      this.audio.init();
      if (!this.nivelActual) {
        return;
      }

      if (this.estadoNivel === "listo") {
        this.iniciarNivel(this.indiceNivelActual);
        return;
      }

      this.iniciarNivel(this.indiceNivelActual);
    }

    irASiguienteNivel() {
      this.audio.init();
      if (this.indiceNivelActual >= this.datasetRaiz.niveles.length - 1) {
        this.mostrarFeedback("No hay mas niveles configurados.", "warn", true);
        return;
      }

      this.prepararNivel(this.indiceNivelActual + 1);
    }

    renderizarInfoNivel() {
      if (!this.nivelActual) {
        return;
      }

      if (!this.elNivelInfo) {
        return;
      }

      const descripcion =
        this.nivelActual.descripcionHTML ||
        `Modo ${this.nivelActual.modoAceptado}, entre ${this.nivelActual.minPorTorre} y ${this.nivelActual.maxPorTorre} barras por torre.`;

      this.elNivelInfo.innerHTML = descripcion;
      if (this.elNivelRitmo) {
        this.elNivelRitmo.textContent =[
          this.nivelActual.modoFlujo,
          `nivel ${formatearSegundos(this.nivelActual.tiempoNivel)}`,
          `torre ${formatearSegundos(this.nivelActual.tiempoRecorridoTorre)}`,
          `despacho ${formatearSegundos(this.nivelActual.tiempoEntreTorres)}`
        ].join(" | ");
      }

      renderizarLatex(this.elNivelInfo);
    }

    obtenerTorreEnfoque() {
      if (this.torreEnfoqueId !== null) {
        const torreEnfoque = this.buscarTorre(this.torreEnfoqueId);

        if (torreEnfoque) {
          return torreEnfoque;
        }
      }

      if (!this.torres.length) {
        return null;
      }

      return this.torres[this.torres.length - 1];
    }

    fijarEnfoque(torreId) {
      this.torreEnfoqueId = torreId;
      this.actualizarEnfoqueVisual();
      this.actualizarPanelTorreEnfoque();
      this.actualizarHUD();
    }

    actualizarPanelTorreEnfoque() {
      if (
        !this.elDatasetTitulo &&
        !this.elModo &&
        !this.elDireccion &&
        !this.elPuntuacion &&
        !this.elNucleo
      ) {
        return;
      }

      const torre = this.obtenerTorreEnfoque();

      if (!torre) {
        this.elConsigna.textContent =
          this.estadoNivel === "finalizado"
            ? "Nivel completado."
            : this.estadoNivel === "timeoff"
              ? "La cinta evalua las ultimas torres."
              : "Esperando la siguiente torre.";
        if (this.elDatasetTitulo) {
          this.elDatasetTitulo.textContent = "-";
        }
        if (this.elModo) {
          this.elModo.textContent = "-";
        }
        if (this.elDireccion) {
          this.elDireccion.textContent = "-";
        }
        if (this.elPuntuacion) {
          this.elPuntuacion.textContent =
            this.nivelActual && this.nivelActual.puntuacion.modo === "parcial"
              ? "Parcial con nucleo estable"
              : "Completa";
        }

        if (this.elNucleo && this.estadoNivel === "timeoff") {
          this.elNucleo.textContent =
            "Ya no puedes mover torres. Solo se evalua lo que sigue en banda.";
        } else if (this.elNucleo && this.estadoNivel === "finalizado") {
          this.elNucleo.textContent =
            `Torres probadas: ${this.torresResueltasNivel}. Resistieron ${this.torresExitosasNivel} y no pasaron ${this.torresFallidasNivel}.`;
        }

        return;
      }

      this.elConsigna.innerHTML = torre.dataset.consignaHTML;
      if (this.elDatasetTitulo) {
        this.elDatasetTitulo.innerHTML = torre.dataset.tituloHTML;
      }
      if (this.elModo) {
        this.elModo.textContent =
          torre.dataset.modo === "estricto" ? "Estricto" : "Laxo";
      }
      if (this.elDireccion) {
        this.elDireccion.textContent =
          torre.dataset.direccion === "descendente"
            ? "Descendente"
            : "Ascendente";
      }
      if (this.elPuntuacion) {
        this.elPuntuacion.textContent =
          this.nivelActual.puntuacion.modo === "parcial"
            ? "Parcial con nucleo estable"
            : "Completa";
      }

      if (this.elNucleo && torre.nucleo && torre.nucleo.largo >= 2) {
        this.elNucleo.textContent =
          `Nucleo estable de ${torre.nucleo.largo} barras consecutivas.`;
      } else if (this.elNucleo && torre.estado === "exito") {
        this.elNucleo.textContent = "Estructura completa estable. La torre supera el escaneo.";
      } else if (this.elNucleo && (torre.estado === "fallo" || torre.estado === "evaluando")) {
        this.elNucleo.textContent = "No se formo un nucleo estable suficiente.";
      } else if (this.elNucleo) {
        this.elNucleo.textContent = "Aun no se ha probado esta torre.";
      }

      renderizarLatex(this.elConsigna);
      if (this.elDatasetTitulo) {
        renderizarLatex(this.elDatasetTitulo);
      }
    }

    obtenerEtiquetaEstadoNivel() {
      if (this.estadoNivel === "finalizado") {
        return "Finalizado";
      }

      if (this.estadoNivel === "timeoff") {
        return "Timeoff";
      }

      if (this.dragState) {
        return "Reordenando";
      }

      return "Activa";
    }

    obtenerEtiquetaFlujo() {
      if (!this.nivelActual) {
        return "-";
      }

      return this.nivelActual.modoFlujo === "multitower"
        ? "Multitower"
        : "Singletower";
    }

    mostrarOverlayNivel(titulo, cuerpo) {
      if (!this.elOverlay) {
        return;
      }

      this.elOverlayTitle.textContent = titulo;
      this.elOverlayBody.textContent = cuerpo;
      this.elOverlayOk.textContent = String(this.torresExitosasNivel);
      this.elOverlayFail.textContent = String(this.torresFallidasNivel);
      this.elOverlayTotal.textContent = String(this.torresResueltasNivel);
      this.elOverlay.dataset.visible = "1";
    }

    ocultarOverlayNivel() {
      if (!this.elOverlay) {
        return;
      }

      this.elOverlay.dataset.visible = "0";
    }

    crearMarkupTorre(torre) {
      const clases = [claseUI("torre-viaje")];

      if (torre.estado === "exito") {
        clases.push(claseUI("torre-viaje-exito"));
      }

      if (torre.estado === "evaluando" || torre.estado === "fallo") {
        clases.push(claseUI("torre-viaje-fallo"));
      }

      if (this.dragState && this.dragState.torreId === torre.id) {
        clases.push(claseUI("torre-viaje-arrastrando"));
      }

      if (this.torreEnfoqueId === torre.id) {
        clases.push(claseUI("torre-viaje-enfoque"));
      }

      const indiceDrop =
        this.dragState && this.dragState.torreId === torre.id &&
        Number.isInteger(this.dragState.destIndex)
          ? this.dragState.destIndex
          : -1;

      const barrasHTML = torre.barras.map((barra, indice) => {
        const clasesBarra =[claseUI("torre-barra")];
        const estadoBarra = torre.barrasEstado[barra.id];

        if (estadoBarra) {
          clasesBarra.push(claseUI(`torre-barra-${estadoBarra}`));
        }

        if (
          this.dragState &&
          this.dragState.torreId === torre.id &&
          this.dragState.originIndex === indice
        ) {
          clasesBarra.push(claseUI("torre-barra-arrastrando"));
        }

        if (
          this.touchSelection &&
          this.touchSelection.torreId === torre.id &&
          this.touchSelection.index === indice
        ) {
          clasesBarra.push(claseUI("torre-barra-tactil-activa"));
        }

        if (
          indiceDrop === indice &&
          (!this.dragState || this.dragState.originIndex !== indice)
        ) {
          clasesBarra.push(claseUI("torre-barra-drop-target"));
        }

        return `
          <div class="${clasesBarra.join(" ")}" data-tp-barra-index="${indice}">
            <div class="${claseUI("torre-barra-texto")}">${barra.textoHTML}</div>
          </div>
        `;
      }).join("");

      return `
        <div class="${clases.join(" ")}" data-tp-torre-id="${torre.id}" data-modo="${torre.dataset.modo}">
          <div class="${claseUI("torre-stack")}" data-tp-stack>
            ${barrasHTML}
          </div>
          <div class="${claseUI("torre-base")}" data-tp-base>
            <span>${torre.dataset.bandejaHTML}</span>
          </div>
        </div>
      `;
    }

    renderizarTorreDom(torre) {
      const markup = this.crearMarkupTorre(torre);
      const existente = this.obtenerElementoTorre(torre.id);

      if (existente) {
        existente.outerHTML = markup;
      } else {
        this.elTrafico.insertAdjacentHTML("beforeend", markup);
      }

      const elemento = this.obtenerElementoTorre(torre.id);

      if (elemento) {
        this.fijarPosicionInmediataTorre(torre, elemento);
        renderizarLatex(elemento);
      }

      this.actualizarEnfoqueVisual();
    }

    fijarPosicionInmediataTorre(torre, elemento) {
      if (!elemento) {
        return;
      }

      elemento.style.transition = "none";
      this.actualizarPosicionTorre(torre);
      elemento.getBoundingClientRect();

      window.requestAnimationFrame(() => {
        if (elemento.isConnected) {
          elemento.style.transition = "";
        }
      });
    }

    actualizarEnfoqueVisual() {
      if (!this.elTrafico) {
        return;
      }

      this.elTrafico
        .querySelectorAll(selectorClaseUI("torre-viaje-enfoque"))
        .forEach((elemento) => elemento.classList.remove(claseUI("torre-viaje-enfoque")));

      if (this.torreEnfoqueId === null) {
        return;
      }

      const elemento = this.obtenerElementoTorre(this.torreEnfoqueId);

      if (elemento) {
        elemento.classList.add(claseUI("torre-viaje-enfoque"));
      }
    }

    actualizarHUD() {
      const torre = this.obtenerTorreEnfoque();
      const tiempoNivelTotal = this.nivelActual ? this.nivelActual.tiempoNivel : 0;
      const nivelPct = tiempoNivelTotal
        ? clamp(this.tiempoNivelRestante / tiempoNivelTotal, 0, 1)
        : 0;
      const torrePct = torre && torre.tiempoTotal
        ? clamp(torre.tiempoRestante / torre.tiempoTotal, 0, 1)
        : 0;

      this.elPuntaje.textContent = String(this.puntaje);
      this.elNivel.textContent = this.nivelActual ? String(this.nivelActual.id) : "-";
      this.elTiempoNivel.textContent = formatearSegundos(this.tiempoNivelRestante);
      if (this.elPuntajeBottom) {
        this.elPuntajeBottom.textContent = String(this.puntaje);
      }
      if (this.elNivelBottom) {
        this.elNivelBottom.textContent = this.nivelActual
          ? String(this.nivelActual.id)
          : "-";
      }
      if (this.elTiempoNivelBottom) {
        this.elTiempoNivelBottom.textContent = formatearSegundos(this.tiempoNivelRestante);
      }
      this.elTiempoTorre.textContent = torre
        ? formatearSegundos(torre.tiempoRestante)
        : "-";
      this.elTiempoCarga.textContent =
        this.estadoNivel === "timeoff"
          ? "timeoff"
          : this.estadoNivel === "finalizado"
            ? "-"
            : formatearSegundos(this.tiempoDespachoRestante);
      this.elBarras.textContent = torre ? String(torre.barras.length) : "-";
      this.elResumenNivel.textContent = `${Math.round(nivelPct * 100)}%`;
      this.elBarraNivel.style.width = `${Math.round(nivelPct * 100)}%`;
      this.elResumenTorre.textContent = torre
        ? `${Math.round(torrePct * 100)}%`
        : this.estadoNivel === "timeoff"
          ? "timeoff"
          : "-";
      this.elBarraTorre.style.width = torre ? `${Math.round(torrePct * 100)}%` : "0%";
      this.elResumenOk.textContent = String(this.torresExitosasNivel);
      this.elResumenFail.textContent = String(this.torresFallidasNivel);
      this.elResumenTotal.textContent = String(this.torresResueltasNivel);
      this.elChipFase.dataset.estado = this.estadoNivel;
      this.elChipFase.querySelector("strong").textContent = this.obtenerEtiquetaEstadoNivel();
      this.elChipFlujo.textContent = this.obtenerEtiquetaFlujo();
      this.elChipActivas.textContent = String(this.torres.length + this.despachosPendientes);

      if (this.elPanel) {
        this.elPanel.classList.toggle("is-finalizado", this.estadoNivel === "finalizado");
      }
    }

    activarBarraTactil(torreId, indice) {
      if (!Number.isInteger(torreId) || !Number.isInteger(indice)) {
        this.touchSelection = null;
        this.touchTapState = null;
        return;
      }

      this.touchSelection = {
        torreId,
        index: indice
      };
      this.touchTapState = null;

      const torre = this.buscarTorre(torreId);

      if (torre) {
        this.renderizarTorreDom(torre);
      }
    }

    aplicarMovimientoBarra(torreId, indiceOrigen, indiceDestino, mostrarMensaje = true) {
      const torre = this.buscarTorre(torreId);

      if (
        !torre ||
        !Number.isInteger(indiceOrigen) ||
        !Number.isInteger(indiceDestino)
      ) {
        return false;
      }

      const destinoAjustado = clamp(indiceDestino, 0, torre.barras.length - 1);

      if (indiceOrigen === destinoAjustado) {
        this.actualizarHUD();
        this.actualizarPanelTorreEnfoque();
        return false;
      }

      torre.barras = moverBarra(torre.barras, indiceOrigen, destinoAjustado);
      
      // AUDIO: CLICK DE FICHA
      this.audio.playClick();

      if (this.touchSelection && this.touchSelection.torreId === torreId) {
        this.touchSelection.index = destinoAjustado;
      }

      this.renderizarTorreDom(torre);
      this.actualizarHUD();
      this.actualizarPanelTorreEnfoque();

      if (mostrarMensaje) {
        this.mostrarFeedback("Torre reajustada. Sigue ordenando antes del control de calidad.", "info");
      }

      return true;
    }

    cancelarInteraccionTactil(limpiarSeleccion = false) {
      if (this.touchGesture) {
        this.touchGesture = null;
        window.removeEventListener("pointermove", this.manejarPointerMove);
        window.removeEventListener("pointerup", this.manejarPointerUp);
      }

      this.touchTapState = null;

      if (limpiarSeleccion) {
        this.touchSelection = null;
      }
    }

    alternarPantallaCompleta() {
      if (!this.elPanel || !document.fullscreenEnabled) {
        return;
      }

      if (document.fullscreenElement === this.elPanel) {
        document.exitFullscreen().catch(() => {});
        return;
      }

      this.elPanel.requestFullscreen().catch(() => {});
    }

    manejarCambioFullscreen() {
      if (!this.elPanel) {
        return;
      }

      const activa = document.fullscreenElement === this.elPanel;
      this.elPanel.classList.toggle("is-fullscreen", activa);

      if (this.botonPantallaCompleta) {
        this.botonPantallaCompleta.textContent = activa
          ? "Salir pantalla completa"
          : "Pantalla completa";
      }

      this.actualizarModoPantalla();
      this.manejarResize();
    }

    actualizarModoPantalla() {
      if (!this.elPanel) {
        return;
      }

      const ancho = window.innerWidth || document.documentElement.clientWidth || 0;
      const alto = window.innerHeight || document.documentElement.clientHeight || 0;
      const esLandscape = ancho > alto;
      const esMovil =
        ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
        Math.max(ancho, alto) <= 1100;

      this.elPanel.classList.toggle("is-landscape", esLandscape);
      this.elPanel.classList.toggle("is-portrait", !esLandscape);
      this.elPanel.classList.toggle("is-mobile-landscape", esMovil && esLandscape);
      this.elPanel.classList.toggle("is-mobile-portrait", esMovil && !esLandscape);
    }

    manejarResize() {
      this.actualizarModoPantalla();
      this.actualizarPosicionesTorres();
      this.actualizarAlertaEscaneo();
    }

    animarDespachoSemilla() {
      if (!this.elSemillas) {
        return;
      }

      const semilla = document.createElement("div");
      semilla.className = claseUI("torre-semilla");
      this.elSemillas.appendChild(semilla);

      this.agendar(() => {
        if (semilla.parentNode) {
          semilla.parentNode.removeChild(semilla);
        }
      }, 520);
    }

    obtenerElementoTorre(torreId) {
      return this.elTrafico.querySelector(`[data-tp-torre-id="${torreId}"]`);
    }

    buscarTorre(torreId) {
      return this.torres.find((torre) => torre.id === torreId) || null;
    }

    obtenerRecorridoDisponible(torreId) {
      const elemento = this.obtenerElementoTorre(torreId);

      if (!this.elPista || !elemento || !this.elSismica) {
        return 0;
      }

      const pistaRect = this.elPista.getBoundingClientRect();
      const torreRect = elemento.getBoundingClientRect();
      const sismicaRect = this.elSismica.getBoundingClientRect();
      const destinoCentro =
        sismicaRect.left - pistaRect.left +
        (sismicaRect.width - torreRect.width) / 2;
      const maximo = this.elPista.clientWidth - elemento.offsetWidth - 24;

      return clamp(destinoCentro - 24, 0, Math.max(0, maximo));
    }

    actualizarPosicionTorre(torre) {
      const elemento = this.obtenerElementoTorre(torre.id);

      if (!elemento) {
        return;
      }

      const x = this.obtenerRecorridoDisponible(torre.id) * torre.progreso;
      elemento.style.transform = `translate3d(${x}px, 0, 0)`;
    }

    actualizarPosicionesTorres() {
      this.torres.forEach((torre) => {
        this.actualizarPosicionTorre(torre);
      });
    }

    actualizarAlertaEscaneo() {
      if (!this.elSismica) {
        return;
      }

      const sismicaRect = this.elSismica.getBoundingClientRect();
      const activa = this.torres.some((torre) => {
        if (torre.estado !== "corriendo" || torre.progreso >= 1) {
          return false;
        }

        const elemento = this.obtenerElementoTorre(torre.id);

        if (!elemento) {
          return false;
        }

        const rect = elemento.getBoundingClientRect();
        const yaEntroAZona = rect.right > sismicaRect.left && rect.left < sismicaRect.right;

        return yaEntroAZona;
      });

      this.elSismica.classList.toggle(claseUI("torre-sismica-alerta"), activa);
    }

    mostrarFeedback(mensaje, tipo = "info", persistente = false) {
      this.elFeedback.textContent = mensaje;
      this.elFeedback.dataset.tipo = tipo;

      if (!this.elToast) {
        return;
      }

      this.toastSecuencia += 1;
      const secuencia = this.toastSecuencia;
      this.elToast.className = `juegosprofearauco-torre2-toast juegosprofearauco-torre2-toast--${tipo}`;
      this.elToast.textContent = mensaje;
      this.elToast.dataset.visible = "1";

      if (!persistente) {
        this.agendar(() => {
          if (this.toastSecuencia === secuencia && this.elToast) {
            this.elToast.dataset.visible = "0";
          }
        }, 1650);
      }
    }

    manejarPointerDown(evento) {
      if (this.estadoNivel !== "activo" || this.dragState || this.touchGesture) {
        return;
      }
      
      this.audio.init();

      const barra = evento.target.closest("[data-tp-barra-index]");
      const torreElementoDirecto = evento.target.closest("[data-tp-torre-id]");

      if (evento.pointerType === "touch") {
        if (!torreElementoDirecto) {
          return;
        }

        const torreId = Number(torreElementoDirecto.dataset.tpTorreId);
        const torre = this.buscarTorre(torreId);

        if (!torre || torre.estado !== "corriendo") {
          return;
        }

        evento.preventDefault();
        this.fijarEnfoque(torreId);

        const indiceOrigen =
          this.touchSelection && this.touchSelection.torreId === torreId
            ? this.touchSelection.index
            : barra
              ? Number(barra.dataset.tpBarraIndex)
              : 0;

        if (!Number.isInteger(indiceOrigen)) {
          return;
        }

        const seleccionActiva =
          this.touchSelection &&
          this.touchSelection.torreId === torreId &&
          this.touchSelection.index === indiceOrigen;

        this.touchGesture = {
          pointerId: evento.pointerId,
          torreId,
          startIndex: indiceOrigen,
          tappedIndex: barra ? Number(barra.dataset.tpBarraIndex) : null,
          startX: evento.clientX,
          startY: evento.clientY,
          canMove: Boolean(seleccionActiva)
        };

        window.addEventListener("pointermove", this.manejarPointerMove);
        window.addEventListener("pointerup", this.manejarPointerUp);
        return;
      }

      if (!barra) {
        return;
      }

      const torreElemento = barra.closest("[data-tp-torre-id]");

      if (!torreElemento) {
        return;
      }

      const torreId = Number(torreElemento.dataset.tpTorreId);
      const indiceOrigen = Number(barra.dataset.tpBarraIndex);
      const torre = this.buscarTorre(torreId);

      if (!torre || torre.estado !== "corriendo" || !Number.isInteger(indiceOrigen)) {
        return;
      }

      evento.preventDefault();
      this.fijarEnfoque(torreId);

      const stack = torreElemento.querySelector("[data-tp-stack]");
      const barraRect = barra.getBoundingClientRect();
      const ghost = barra.cloneNode(true);

      ghost.classList.add(claseUI("torre-barra-ghost"));
      ghost.style.width = `${barraRect.width}px`;
      ghost.style.height = `${barraRect.height}px`;
      ghost.style.left = "0px";
      ghost.style.top = `${barra.offsetTop}px`;

      stack.appendChild(ghost);
      barra.classList.add(claseUI("torre-barra-arrastrando"));
      torreElemento.classList.add(claseUI("torre-viaje-arrastrando"));

      this.dragState = {
        pointerId: evento.pointerId,
        torreId,
        originIndex: indiceOrigen,
        destIndex: indiceOrigen,
        offsetY: evento.clientY - barraRect.top,
        ghost,
        ghostHeight: barraRect.height
      };

      window.addEventListener("pointermove", this.manejarPointerMove);
      window.addEventListener("pointerup", this.manejarPointerUp);
    }

    manejarPointerMove(evento) {
      if (this.touchGesture && evento.pointerId === this.touchGesture.pointerId) {
        evento.preventDefault();
        return;
      }

      if (!this.dragState || evento.pointerId !== this.dragState.pointerId) {
        return;
      }

      const torreElemento = this.obtenerElementoTorre(this.dragState.torreId);
      const stack = torreElemento
        ? torreElemento.querySelector("[data-tp-stack]")
        : null;

      if (!stack) {
        return;
      }

      evento.preventDefault();

      const stackRect = stack.getBoundingClientRect();
      const ghostTop = clamp(
        evento.clientY - stackRect.top - this.dragState.offsetY,
        0,
        Math.max(0, stack.scrollHeight - this.dragState.ghostHeight)
      );

      this.dragState.ghost.style.top = `${ghostTop}px`;
      this.dragState.destIndex = this.calcularIndiceDestino(
        this.dragState.torreId,
        evento.clientY
      );
      this.marcarDropTarget(this.dragState.torreId, this.dragState.destIndex);
    }

    manejarPointerUp(evento) {
      if (this.touchGesture && evento.pointerId === this.touchGesture.pointerId) {
        evento.preventDefault();

        const gesto = this.touchGesture;
        this.touchGesture = null;
        window.removeEventListener("pointermove", this.manejarPointerMove);
        window.removeEventListener("pointerup", this.manejarPointerUp);

        const torre = this.buscarTorre(gesto.torreId);

        if (!torre || torre.estado !== "corriendo") {
          return;
        }

        const deltaY = evento.clientY - gesto.startY;
        const deltaX = evento.clientX - gesto.startX;
        const origen =
          this.touchSelection && this.touchSelection.torreId === gesto.torreId
            ? this.touchSelection.index
            : gesto.startIndex;

        if (
          gesto.canMove &&
          Math.abs(deltaY) >= UMBRAL_SWIPE_BARRA_TOUCH &&
          Math.abs(deltaY) > Math.abs(deltaX)
        ) {
          const destino = clamp(
            origen + (deltaY < 0 ? -1 : 1),
            0,
            torre.barras.length - 1
          );

          this.aplicarMovimientoBarra(gesto.torreId, origen, destino, false);
          this.activarBarraTactil(gesto.torreId, destino);
          return;
        }

        const ahora = Date.now();
        const indiceTocado =
          Number.isInteger(gesto.tappedIndex) ? gesto.tappedIndex : gesto.startIndex;
        const esMismaFichaPendiente =
          this.touchTapState &&
          this.touchTapState.torreId === gesto.torreId &&
          this.touchTapState.index === indiceTocado &&
          ahora - this.touchTapState.timestamp <= UMBRAL_DOBLE_TOQUE_MS;

        if (esMismaFichaPendiente) {
          this.activarBarraTactil(gesto.torreId, indiceTocado);
          return;
        }

        this.touchTapState = {
          torreId: gesto.torreId,
          index: indiceTocado,
          timestamp: ahora
        };
        this.actualizarHUD();
        this.actualizarPanelTorreEnfoque();
        return;
      }

      if (!this.dragState || evento.pointerId !== this.dragState.pointerId) {
        return;
      }

      evento.preventDefault();

      const torreId = this.dragState.torreId;
      const indiceOrigen = this.dragState.originIndex;
      const indiceDestino = this.dragState.destIndex;
      const torre = this.buscarTorre(torreId);

      this.finalizarDrag(false);

      if (torre) {
        this.touchSelection = null;
      }

      this.aplicarMovimientoBarra(torreId, indiceOrigen, indiceDestino, true);
    }

    calcularIndiceDestino(torreId, clientY) {
      const torreElemento = this.obtenerElementoTorre(torreId);

      if (!torreElemento) {
        return -1;
      }

      const barras = Array.from(
        torreElemento.querySelectorAll("[data-tp-barra-index]")
      );
      const origen = this.dragState.originIndex;
      const torre = this.buscarTorre(torreId);
      let destino = torre ? torre.barras.length - 1 : -1;

      for (const barra of barras) {
        const indice = Number(barra.dataset.tpBarraIndex);

        if (indice === origen) {
          continue;
        }

        const rect = barra.getBoundingClientRect();

        if (clientY < rect.top + rect.height / 2) {
          destino = indice;
          break;
        }
      }

      return destino;
    }

    marcarDropTarget(torreId, indice) {
      const torreElemento = this.obtenerElementoTorre(torreId);

      if (!torreElemento) {
        return;
      }

      torreElemento
        .querySelectorAll(selectorClaseUI("torre-barra-drop-target"))
        .forEach((barra) => barra.classList.remove(claseUI("torre-barra-drop-target")));

      if (!Number.isInteger(indice)) {
        return;
      }

      const objetivo = torreElemento.querySelector(
        `[data-tp-barra-index="${indice}"]`
      );

      if (objetivo) {
        objetivo.classList.add(claseUI("torre-barra-drop-target"));
      }
    }

    finalizarDrag(cancelado) {
      if (!this.dragState) {
        return;
      }

      const torreId = this.dragState.torreId;
      const torreElemento = this.obtenerElementoTorre(torreId);

      if (this.dragState.ghost && this.dragState.ghost.parentNode) {
        this.dragState.ghost.parentNode.removeChild(this.dragState.ghost);
      }

      if (torreElemento) {
        torreElemento.classList.remove(claseUI("torre-viaje-arrastrando"));
        this.marcarDropTarget(torreId, -1);
      }

      window.removeEventListener("pointermove", this.manejarPointerMove);
      window.removeEventListener("pointerup", this.manejarPointerUp);

      const torre = this.buscarTorre(torreId);
      this.dragState = null;

      if (torre) {
        this.renderizarTorreDom(torre);
      }

      if (cancelado) {
        this.actualizarPanelTorreEnfoque();
        this.actualizarHUD();
      }
    }

    limpiarTemporizadores() {
      this.timeoutIds.forEach((id) => window.clearTimeout(id));
      this.timeoutIds =[];
    }

    agendar(callback, delay) {
      const id = window.setTimeout(() => {
        this.timeoutIds = this.timeoutIds.filter((actual) => actual !== id);
        callback();
      }, delay);

      this.timeoutIds.push(id);
      return id;
    }

    activarSensor() {
      this.elTenaza.classList.add(claseUI("torre-tenaza-activa"));

      this.agendar(() => {
        this.elTenaza.classList.remove(claseUI("torre-tenaza-activa"));
      }, 720);
    }

    evaluarTorrePorId(torreId) {
      const torre = this.buscarTorre(torreId);

      if (!torre || torre.estado !== "corriendo") {
        return;
      }

      if (this.dragState && this.dragState.torreId === torreId) {
        this.finalizarDrag(true);
      }

      if (this.touchGesture && this.touchGesture.torreId === torreId) {
        this.cancelarInteraccionTactil();
      }

      if (estaOrdenada(torre.barras, torre.dataset.direccion)) {
        this.resolverExito(torre);
        return;
      }

      this.resolverFallo(torre);
    }

    resolverExito(torre) {
      torre.estado = "exito";
      torre.barrasEstado = Object.create(null);
      torre.barras.forEach((barra) => {
        torre.barrasEstado[barra.id] = "exito";
      });

      this.torresResueltasNivel++;
      this.torresExitosasNivel++;
      this.puntaje += 90 + torre.barras.length * 12;
      this.activarSensor();
      this.renderizarTorreDom(torre);
      
      // AUDIO: EXITO
      this.audio.playSuccess();

      if (this.torreEnfoqueId === torre.id) {
        this.actualizarPanelTorreEnfoque();
      }

      this.actualizarHUD();
      this.mostrarFeedback("Torre correcta. El escaneo confirma la estructura.", "success");

      this.agendar(() => {
        this.retirarTorre(torre.id);
      }, 1050);
    }

    resolverFallo(torre) {
      torre.estado = "evaluando";
      torre.nucleo = mayorNucleoOrdenado(torre.barras, torre.dataset.direccion);

      const indicesNucleo = new Set();

      for (let indice = torre.nucleo.inicio; indice <= torre.nucleo.fin; indice++) {
        if (indice >= 0) {
          indicesNucleo.add(indice);
        }
      }

      torre.barrasEstado = Object.create(null);
      torre.barras.forEach((barra, indice) => {
        torre.barrasEstado[barra.id] = indicesNucleo.has(indice) ? "nucleo" : "cae";
      });

      this.torresResueltasNivel++;
      this.torresFallidasNivel++;

      if (
        this.nivelActual.puntuacion.modo === "parcial" &&
        torre.nucleo.largo >= 2
      ) {
        this.puntaje += torre.nucleo.largo * 12;
      }

      this.renderizarTorreDom(torre);
      
      // AUDIO: FALLO
      this.audio.playFallo();

      if (this.torreEnfoqueId === torre.id) {
        this.actualizarPanelTorreEnfoque();
      }

      this.actualizarHUD();
      this.mostrarFeedback(
        torre.nucleo.largo >= 2
          ? "La torre no paso. Se rescata un nucleo estable parcial."
          : "La torre no supero el control de calidad.",
        "error"
      );

      this.agendar(() => {
        const torreActual = this.buscarTorre(torre.id);

        if (!torreActual) {
          return;
        }

        torreActual.barrasEstado = Object.create(null);
        torreActual.barras.forEach((barra, indice) => {
          torreActual.barrasEstado[barra.id] = indicesNucleo.has(indice)
            ? "nucleo-colapsa"
            : "cae";
        });
        torreActual.estado = "fallo";
        this.renderizarTorreDom(torreActual);
      }, 850);

      this.agendar(() => {
        this.retirarTorre(torre.id);
      }, 1600);
    }

    retirarTorre(torreId) {
      if (this.dragState && this.dragState.torreId === torreId) {
        this.finalizarDrag(true);
      }

      if (this.touchGesture && this.touchGesture.torreId === torreId) {
        this.cancelarInteraccionTactil();
      }

      if (this.touchSelection && this.touchSelection.torreId === torreId) {
        this.touchSelection = null;
      }

      if (this.touchTapState && this.touchTapState.torreId === torreId) {
        this.touchTapState = null;
      }

      const indice = this.torres.findIndex((torre) => torre.id === torreId);

      if (indice < 0) {
        return;
      }

      this.torres.splice(indice, 1);

      const elemento = this.obtenerElementoTorre(torreId);

      if (elemento && elemento.parentNode) {
        elemento.parentNode.removeChild(elemento);
      }

      if (this.torreEnfoqueId === torreId) {
        this.torreEnfoqueId = this.torres.length
          ? this.torres[this.torres.length - 1].id
          : null;
      }

      if (
        this.estadoNivel === "activo" &&
        this.nivelActual.modoFlujo === "singletower" &&
        !this.torres.length
      ) {
        this.tiempoDespachoRestante = this.nivelActual.tiempoEntreTorres;
      }

      this.actualizarEnfoqueVisual();
      this.actualizarPanelTorreEnfoque();
      this.actualizarHUD();

      if (this.estadoNivel === "timeoff" && !this.torres.length) {
        this.finalizarNivel();
      }
    }

    finalizarNivel() {
      if (this.estadoNivel === "finalizado") {
        return;
      }

      this.finalizarDrag(true);
      this.limpiarTemporizadores();
      this.estadoNivel = "finalizado";
      this.tiempoNivelRestante = 0;
      this.tiempoDespachoRestante = 0;
      this.despachosPendientes = 0;

      this.audio.stopMachine(); // APAGA MOTOR

      this.elTenaza.classList.remove(claseUI("torre-tenaza-activa"));
      this.elSismica.classList.remove(claseUI("torre-sismica-alerta"));
      this.elSemillas.innerHTML = "";
      this.actualizarHUD();
      this.actualizarPanelTorreEnfoque();
      const tituloCierre =
        this.torresResueltasNivel > 0 && this.torresFallidasNivel === 0
          ? "Nivel limpio"
          : this.torresExitosasNivel === 0
            ? "Nivel comprometido"
            : "Nivel cerrado";
      this.mostrarOverlayNivel(
        tituloCierre,
        `Torres probadas: ${this.torresResueltasNivel}. Resistieron ${this.torresExitosasNivel} y no pasaron ${this.torresFallidasNivel}.`
      );
      this.mostrarFeedback(
        `Nivel cerrado. Torres probadas: ${this.torresResueltasNivel}. Resistieron ${this.torresExitosasNivel} y no pasaron ${this.torresFallidasNivel}.`,
        "info",
        true
      );
    }
  }

  function crear(selectorOContenedor, dataset, opciones = {}) {
    let contenedor = selectorOContenedor;

    if (typeof selectorOContenedor === "string") {
      contenedor = document.querySelector(selectorOContenedor);
    }

    if (!(contenedor instanceof HTMLElement)) {
      throw new Error("Torre Profearauco 2: el contenedor no es valido.");
    }

    return new JuegoTorreProfearauco(contenedor, dataset, opciones).iniciar();
  }

  window.TorreProfearauco2 = {
    crear,
    utilidades: {
      mezclar,
      moverBarra,
      obtenerOrden,
      estaOrdenada,
      mayorNucleoOrdenado,
      prepararTextoMatematico,
      normalizarLatexDataset,
      normalizarJSONTorre,
      normalizarDatasetTorre,
      datasetCompatibleConNivel
    }
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".juegosprofearauco-torre2-auto").forEach(function (root) {
    if (root.dataset.torre2Renderizada === "1") {
      return;
    }

    const datasetBox =
      root.querySelector(".juegosprofearauco-torre2-dataset") ||
      root.querySelector(".juegosprofearauco-torre-dataset") ||
      root.querySelector(".juegosprofearauco-dataset");

    if (!datasetBox) {
      root.innerHTML =
        "<p><strong>Error:</strong> No se encontro el dataset de Torre Profearauco 2.</p>";
      return;
    }

    if (!window.TorreProfearauco2) {
      root.innerHTML =
        "<p><strong>Error:</strong> No se encontro el motor TorreProfearauco2.</p>";
      return;
    }

    let dataset;

    try {
      dataset = window.TorreProfearauco2.utilidades.normalizarJSONTorre(datasetBox.value);
      dataset = window.TorreProfearauco2.utilidades.normalizarLatexDataset(dataset);
    } catch (error) {
      root.innerHTML =
        "<p><strong>Error:</strong> El dataset de Torre Profearauco 2 no tiene formato JSON valido.</p>";
      console.error("Error JSON Torre Profearauco 2:", error);
      return;
    }

    root.dataset.torre2Renderizada = "1";
    root.innerHTML = "";

    window.TorreProfearauco2.crear(root, dataset, {
      nivelInicial: Number(root.dataset.nivelInicial || 1),
      tema: root.dataset.tema || "arauco-dark"
    });
  });
});
