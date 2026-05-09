/* Math-io Moodle motor v2.0.0
   Baterías por nivel + cierre final + soporte [m]LaTeX[/m] */
(function () {
'use strict';

const MATHIO_CSS = `
        .mathio-juego { position: relative; width: 100%; height: min(76vh, 720px); min-height: 560px; margin: 0 auto; overflow: hidden; background-color: #111118; color: white; font-family: 'Segoe UI', sans-serif; user-select: none; touch-action: none; border-radius: 18px; box-shadow: 0 12px 28px rgba(0,0,0,.22); }
        .mathio-juego:fullscreen { height: 100vh !important; width: 100vw !important; max-width: none !important; max-height: none !important; border-radius: 0 !important; margin: 0 !important; }
        .mathio-juego:-webkit-full-screen { height: 100vh !important; width: 100vw !important; max-width: none !important; max-height: none !important; border-radius: 0 !important; margin: 0 !important; }
        .mathio-juego canvas { display: block; width: 100%; height: 100%; cursor: grab; }
        .mathio-juego canvas:active { cursor: grabbing; }
        .mathio-juego .mathio-ui-container { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: min(78%, 520px); text-align: center; pointer-events: none; z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .mathio-juego .mathio-score-display { position: relative; width: min(260px, 76vw); height: 12px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 2px 8px rgba(0,0,0,0.35); font-size: 9px; line-height: 12px; font-weight: 800; color: rgba(255,255,255,0.88); text-shadow: 0 1px 2px rgba(0,0,0,0.85); }
        .mathio-juego .mathio-score-display::before { content: ""; position: absolute; inset: 0 auto 0 0; width: var(--mathio-preview, 0%); background: rgba(76,201,240,0.46); border-radius: inherit; transition: width 0.16s ease; }
        .mathio-juego .mathio-score-display::after { content: ""; position: absolute; inset: 0 auto 0 0; width: var(--mathio-progress, 0%); background: linear-gradient(90deg, #2ed573, #f1c40f); border-radius: inherit; transition: width 0.22s ease; }
        .mathio-juego .mathio-score-display span { position: relative; z-index: 1; }
        .mathio-juego .mathio-target-expression { font-size: 26px; background: rgba(0,0,0,0.78); padding: 7px 22px; border-radius: 16px; display: inline-block; font-weight: bold; box-shadow: 0 0 13px rgba(255,255,255,0.1); letter-spacing: 1px; max-width: 100%; }
        .mathio-juego .mathio-instructions { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); max-width: min(680px, calc(100% - 44px)); padding: 8px 14px; border-radius: 999px; background: rgba(0,0,0,0.46); color: rgba(255,255,255,0.82); text-align: center; font-size: 14px; line-height: 1.3; pointer-events: none; z-index: 10; opacity: 0; transition: opacity .35s ease; }
        .mathio-juego .mathio-instructions.is-visible { opacity: 1; }
        .mathio-juego .mathio-flash-screen { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: #ff4757; opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 5; }
        .mathio-juego .mathio-fullscreen-btn { position: absolute; bottom: 15px; right: 15px; width: 45px; height: 45px; background: rgba(0,0,0,0.4); color: white; border: 2px solid rgba(255,255,255,0.3); border-radius: 12px; font-size: 24px; cursor: pointer; z-index: 20; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; backdrop-filter: blur(4px); }
        .mathio-juego .mathio-fullscreen-btn:hover { background: rgba(0,0,0,0.8); border-color: white; transform: scale(1.1); }
        .mathio-juego .formula-piece { position: relative; display: inline-block; padding: 0 1px; border-radius: 6px; transition: text-shadow .18s ease, transform .18s ease, background-color .18s ease; }
        .mathio-juego .formula-piece.identity-pulse { animation: pulso-identidad-formula 0.9s ease-in-out infinite; background-color: rgba(255,255,255,0.08); outline: 1px solid currentColor; outline-offset: 3px; }
        .mathio-juego .mathio-math-fallback { font-family: Cambria Math, Georgia, serif; font-weight: 700; }
        @keyframes pulso-identidad-formula { 0%, 100% { transform: scale(1); text-shadow: 0 0 4px currentColor; } 50% { transform: scale(1.12); text-shadow: 0 0 16px currentColor, 0 0 26px currentColor; } }
`;

function inyectarCSSMathIO() {
    if (document.getElementById('mathio2-moodle-css-v1')) return;
    const style = document.createElement('style');
    style.id = 'mathio2-moodle-css-v1';
    style.textContent = MATHIO_CSS;
    document.head.appendChild(style);
}

function leerNivelesDesdeHTML(root) {
    const jsonEl = root.querySelector('script[type="application/json"][data-mathio-json]');
    if (!jsonEl) return [];
    try {
        const data = JSON.parse(jsonEl.textContent.trim());
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.niveles)) return data.niveles;
        return [];
    } catch (err) { console.error('[Math-io] JSON inválido.', err); return []; }
}

const COMANDOS_LATEX_AMABLES = [
    'frac', 'dfrac', 'tfrac', 'sqrt', 'root', 'sum', 'prod', 'int', 'lim',
    'cdot', 'times', 'div', 'pm', 'mp', 'le', 'leq', 'ge', 'geq', 'neq',
    'approx', 'infty', 'pi', 'theta', 'alpha', 'beta', 'gamma', 'delta',
    'epsilon', 'lambda', 'mu', 'rho', 'sigma', 'tau', 'phi', 'omega',
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln',
    'left', 'right', 'overline', 'bar', 'hat', 'vec'
];
const MAPA_LATEX_FALLBACK = {
    cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', ge: '≥',
    neq: '≠', approx: '≈', infty: '∞', pi: 'π', theta: 'θ', alpha: 'α',
    beta: 'β', gamma: 'γ', delta: 'δ', lambda: 'λ', mu: 'μ', sigma: 'σ',
    omega: 'ω'
};

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function escaparAtributo(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function normalizarLatexAmable(valor) {
    let latex = String(valor ?? '').trim().replace(/\\\\([a-zA-Z]+)/g, "\\$1");
    COMANDOS_LATEX_AMABLES.forEach(cmd => {
        const re = new RegExp(`(^|[^\\\\])\\b${cmd}\\b`, 'g');
        latex = latex.replace(re, `$1\\${cmd}`);
    });
    return latex;
}

function convertirMarcadoresLatex(texto, reemplazarInline, reemplazarDisplay) {
    return String(texto ?? '')
        .replace(/\[M\]([\s\S]*?)\[\/M\]/g, (_m, contenido) => reemplazarDisplay(normalizarLatexAmable(contenido)))
        .replace(/\[m\]([\s\S]*?)\[\/m\]/gi, (_m, contenido) => reemplazarInline(normalizarLatexAmable(contenido)))
        .replace(/\\\[([\s\S]*?)\\\]/g, (_m, contenido) => reemplazarDisplay(normalizarLatexAmable(contenido)))
        .replace(/\\\(([\s\S]*?)\\\)/g, (_m, contenido) => reemplazarInline(normalizarLatexAmable(contenido)));
}

function reemplazarComandoUnArgumento(latex, comando, formato) {
    let re = new RegExp(`\\\\${comando}\\s*\\{([^{}]+)\\}`, 'g');
    let previo;
    do {
        previo = latex;
        latex = latex.replace(re, (_, a) => formato(a));
    } while (latex !== previo);
    return latex;
}

function latexAFallback(latex) {
    let salida = normalizarLatexAmable(latex);
    let previo;
    do {
        previo = salida;
        salida = salida.replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_, a, b) => `${a}/${b}`);
    } while (salida !== previo);
    salida = reemplazarComandoUnArgumento(salida, 'sqrt', a => `√(${a})`);
    Object.entries(MAPA_LATEX_FALLBACK).forEach(([cmd, simbolo]) => {
        salida = salida.replace(new RegExp(`\\\\${cmd}\\b`, 'g'), simbolo);
    });
    salida = salida.replace(/\\(sin|cos|tan|log|ln)\b/g, '$1');
    return salida.replace(/\\/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

function fragmentosDesdeMarcadores(texto, color = 'white', id = undefined) {
    const source = String(texto ?? '');
    const fragmentos = [];
    const re = /\[M\]([\s\S]*?)\[\/M\]|\[m\]([\s\S]*?)\[\/m\]|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/gi;
    let cursor = 0;
    let match;
    while ((match = re.exec(source))) {
        if (match.index > cursor) fragmentos.push({ text: source.slice(cursor, match.index), color, id, math: false });
        const latex = normalizarLatexAmable(match[1] || match[2] || match[3] || match[4]);
        fragmentos.push({ text: latexAFallback(latex), latex, color, id, math: true, displayMode: !!(match[1] || match[3]) });
        cursor = match.index + match[0].length;
    }
    if (cursor < source.length) fragmentos.push({ text: source.slice(cursor), color, id, math: false });
    if (fragmentos.length === 0) fragmentos.push({ text: source, color, id, math: false });
    return fragmentos;
}

function textoPlanoParaMedida(texto) {
    return fragmentosDesdeMarcadores(texto).map(f => f.text).join('');
}

function renderMathHTML(latex, displayMode = false) {
    const normalizado = normalizarLatexAmable(latex);
    if (window.katex && typeof window.katex.renderToString === 'function') {
        try {
            return window.katex.renderToString(normalizado, { throwOnError: false, displayMode, output: 'html' });
        } catch (err) {
            console.warn('[Math-io] KaTeX no pudo renderizar:', normalizado, err);
        }
    }
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') return displayMode ? `\\[${normalizado}\\]` : `\\(${normalizado}\\)`;
    return `<span class="mathio-math-fallback">${escaparHTML(latexAFallback(normalizado))}</span>`;
}

function renderMarcadoresHTML(texto) {
    return fragmentosDesdeMarcadores(texto).map(f => f.math ? renderMathHTML(f.latex, f.displayMode) : escaparHTML(f.text)).join('');
}

function renderizarLatexDOM(contenedor) {
    if (!contenedor) return;
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
        window.MathJax.typesetPromise([contenedor]).catch(() => {});
    }
}

const KATEX_CSS_ID = 'mathio2-katex-css';
const KATEX_JS_ID = 'mathio2-katex-js';
let katexLoaderPromise = null;

function leerConfigKatex(root) {
    const globalConfig = window.MathIO2Katex || window.MathIOKatex || {};
    return {
        css: root?.dataset?.mathioKatexCss || globalConfig.css || globalConfig.katexCss || '',
        js: root?.dataset?.mathioKatexJs || globalConfig.js || globalConfig.katexJs || ''
    };
}

function montarKatexSiConfigurado(root) {
    if (window.katex && typeof window.katex.renderToString === 'function') return Promise.resolve(true);
    const config = leerConfigKatex(root);
    if (!config.js) return Promise.resolve(false);
    if (katexLoaderPromise) return katexLoaderPromise;

    if (config.css && !document.getElementById(KATEX_CSS_ID)) {
        const link = document.createElement('link');
        link.id = KATEX_CSS_ID;
        link.rel = 'stylesheet';
        link.href = config.css;
        document.head.appendChild(link);
    }

    katexLoaderPromise = new Promise(resolve => {
        const existente = document.getElementById(KATEX_JS_ID);
        if (existente) {
            if (window.katex && typeof window.katex.renderToString === 'function') {
                resolve(true);
                return;
            }
            existente.addEventListener('load', () => {
                const cargado = !!(window.katex && typeof window.katex.renderToString === 'function');
                if (!cargado) katexLoaderPromise = null;
                resolve(cargado);
            }, { once: true });
            existente.addEventListener('error', () => {
                katexLoaderPromise = null;
                resolve(false);
            }, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = KATEX_JS_ID;
        script.src = config.js;
        script.async = true;
        script.onload = () => {
            const cargado = !!(window.katex && typeof window.katex.renderToString === 'function');
            if (!cargado) katexLoaderPromise = null;
            resolve(cargado);
        };
        script.onerror = () => {
            console.warn('[Math-io] No se pudo cargar KaTeX desde:', config.js);
            katexLoaderPromise = null;
            resolve(false);
        };
        document.head.appendChild(script);
    });

    return katexLoaderPromise;
}

function iniciarMathIO(root) {
    if (!root || root.dataset.mathioIniciado === '1') return;
    root.dataset.mathioIniciado = '1';

const cleanupTasks = [];
let destroyed = false;
let frameId = null;

function escuchar(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanupTasks.push(() => target.removeEventListener(type, handler, options));
}

function programarTimeout(callback, delay) {
    let cancelar;
    const id = setTimeout(() => {
        const idx = cleanupTasks.indexOf(cancelar);
        if (idx !== -1) cleanupTasks.splice(idx, 1);
        if (!destroyed) callback();
    }, delay);
    cancelar = () => clearTimeout(id);
    cleanupTasks.push(cancelar);
    return id;
}

function limpiarMathIO() {
    if (destroyed) return;
    destroyed = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    while (cleanupTasks.length) {
        try { cleanupTasks.pop()(); } catch (err) { console.warn('[Math-io] Error al limpiar recurso.', err); }
    }
    if (audioCtx && audioCtx.state !== 'closed' && typeof audioCtx.close === 'function') {
        const closePromise = audioCtx.close();
        if (closePromise && typeof closePromise.catch === 'function') closePromise.catch(() => {});
    }
    delete root.dataset.mathioIniciado;
    delete root.__mathioCleanup;
}

root.__mathioCleanup = limpiarMathIO;
const cleanupInterval = setInterval(() => { if (!document.documentElement.contains(root)) limpiarMathIO(); }, 2000);
cleanupTasks.push(() => clearInterval(cleanupInterval));

// --- MOTOR DE AUDIO ---
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function obtenerAudioContext() {
    if (!AudioContextClass) return null;
    if (!audioCtx) {
        try { audioCtx = new AudioContextClass(); }
        catch (err) { console.warn('[Math-io] Audio no disponible.', err); return null; }
    }
    if (audioCtx.state === 'suspended') {
        const resumePromise = audioCtx.resume();
        if (resumePromise && typeof resumePromise.catch === 'function') resumePromise.catch(() => {});
    }
    return audioCtx;
}

function playFireworksSound(ctxAudio) {
    const bursts = [0, 220, 470, 760, 1080, 1350];
    bursts.forEach((delay, index) => {
        programarTimeout(() => {
            if (gameState !== 'WIN') return;
            if (!ctxAudio || ctxAudio.state === 'closed') return;
            const now = ctxAudio.currentTime;
            const base = 240 + index * 55 + Math.random() * 90;

            const whistle = ctxAudio.createOscillator();
            const whistleGain = ctxAudio.createGain();
            whistle.type = 'sine';
            whistle.frequency.setValueAtTime(base, now);
            whistle.frequency.exponentialRampToValueAtTime(base * 2.4, now + 0.16);
            whistleGain.gain.setValueAtTime(0.001, now);
            whistleGain.gain.exponentialRampToValueAtTime(0.09, now + 0.03);
            whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            whistle.connect(whistleGain); whistleGain.connect(ctxAudio.destination);
            whistle.start(now); whistle.stop(now + 0.2);

            const duration = 0.55;
            const buffer = ctxAudio.createBuffer(1, Math.floor(ctxAudio.sampleRate * duration), ctxAudio.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                const fade = 1 - i / data.length;
                data[i] = (Math.random() * 2 - 1) * fade * fade;
            }
            const noise = ctxAudio.createBufferSource();
            const filter = ctxAudio.createBiquadFilter();
            const gain = ctxAudio.createGain();
            noise.buffer = buffer;
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(base * 3, now + 0.16);
            filter.Q.setValueAtTime(0.8, now + 0.16);
            gain.gain.setValueAtTime(0.001, now + 0.14);
            gain.gain.exponentialRampToValueAtTime(0.2, now + 0.19);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.67);
            noise.connect(filter); filter.connect(gain); gain.connect(ctxAudio.destination);
            noise.start(now + 0.14); noise.stop(now + 0.7);
        }, delay);
    });
}

function playSound(type) {
    const ctxAudio = obtenerAudioContext();
    if (!ctxAudio) return;
    if (type === 'fireworks') { playFireworksSound(ctxAudio); return; }
    const osc = ctxAudio.createOscillator(); const gain = ctxAudio.createGain();
    osc.connect(gain); gain.connect(ctxAudio.destination);
    const now = ctxAudio.currentTime;

    if (type === 'eat') { osc.type = 'sine'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.1); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
    else if (type === 'error') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(50, now + 0.4); gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.4); osc.start(now); osc.stop(now + 0.4); }
    else if (type === 'complete') { osc.type = 'square'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(659, now + 0.15); gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3); }
    else if (type === 'pop') { osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
    else if (type === 'throw') { osc.type = 'sine'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(100, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
    else if (type === 'gameover') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(30, now + 1.2); gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2); osc.start(now); osc.stop(now + 1.2); }
}

// --- SETUP DEL JUEGO ---
const canvas = root.querySelector('[data-mathio-canvas]'); const ctx = canvas.getContext('2d');
const targetExpression = root.querySelector('[data-mathio-target]'); const scoreDisplay = root.querySelector('[data-mathio-score]');
const flashScreen = root.querySelector('[data-mathio-flash]');
const instructionDisplay = root.querySelector('[data-mathio-instructions]');

const fsBtn = document.createElement('button'); fsBtn.className = 'mathio-fullscreen-btn'; fsBtn.innerHTML = '⛶'; fsBtn.title = 'Pantalla completa'; root.appendChild(fsBtn);
cleanupTasks.push(() => fsBtn.remove());
escuchar(fsBtn, 'click', () => { if (!document.fullscreenElement && !document.webkitFullscreenElement) { if (root.requestFullscreen) root.requestFullscreen(); else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen(); } else { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } });
const manejarCambioFullscreen = () => { const isFS = document.fullscreenElement === root || document.webkitFullscreenElement === root; fsBtn.innerHTML = isFS ? '✖' : '⛶'; programarTimeout(() => { redimensionarCanvas(); actualizarDispensadorYRelativos(); }, 100); };
escuchar(document, 'fullscreenchange', manejarCambioFullscreen); escuchar(document, 'webkitfullscreenchange', manejarCambioFullscreen);

function redimensionarCanvas() { canvas.width = Math.max(320, Math.floor(root.clientWidth || 900)); canvas.height = Math.max(420, Math.floor(root.clientHeight || 600)); }
redimensionarCanvas();

const PALETA_PRIMARIA = ["#ff4757", "#1e90ff", "#2ed573", "#ffa502", "#ff6b81", "#9c88ff"];
const PALETA_SECUNDARIA = ["#16a085", "#8e44ad", "#d35400", "#c0392b", "#2980b9", "#27ae60"];
const COLORES_FUEGOS = ["#f1c40f", "#ff4757", "#1e90ff", "#2ed573", "#ff6b81", "#ffffff"];

let score = 0; let puntajeNivel = 0; let currentLevelIndex = 0; let currentExerciseIndex = 0; let lives = 3; let gameState = 'PLAYING'; // PLAYING, GAMEOVER, TRANSITION, WIN
let previewProgresoActivo = true;
let particles = []; let floatingTexts = []; let shakeTime = 0;
let mouse = { x: canvas.width/2, y: canvas.height/2, isDown: false }; let isTouch = false; let touchOffset = 0; 
let draggedBubble = null; let uidCounter = 0;
const RADIO_PIEZA_BASE = 25; const RADIO_BURBUJA_BASE = 35;
const TIEMPO_SIMPLIFICACION_UNITARIA = 5000; const VELOCIDAD_DESINFLADO_UNITARIO = 0.045; const EXTRA_RADIO_CAPA_UNITARIA = 12;
const DURACION_PULSO_IDENTIDAD = 1600; const DURACION_PULSO_CONTACTO = 260;
const FACTOR_TRAGADO_CRUDO = 0.68; const FACTOR_TRAGADO_BURBUJA = 0.76; const FACTOR_SOLAPE_BURBUJA = 0.42;
const LECTURA_BOOST_MAX = 0.38; const LECTURA_BOOST_DECAY = 0.965;
let identidadActiva = { ids: new Set(), hasta: 0, sosteniendo: false, clave: '' };

function nuevoUid(prefix = 'obj') { return `${prefix}_${++uidCounter}`; }

const niveles = leerNivelesDesdeHTML(root);
if (!Array.isArray(niveles) || niveles.length === 0) { console.error('[Math-io] JSON inválido'); limpiarMathIO(); return; }

let nivelActual, levelData, alimentos = [], floatingBubbles = [];
const DISPENSADOR = { x: 120, y: canvas.height - 120, r: 50 };
let dispensadorBubble = null;
let ultimoHTMLObjetivo = '';

function construirHTMLObjetivo() {
    if (!levelData) return '';
    let html = renderMarcadoresHTML(levelData.template);
    levelData.piezas.forEach(p => {
        if (!p.es_trampa) html = html.replace(new RegExp(`\\{${p.id}\\}`, "g"), `<span class="formula-piece" data-piece-id="${escaparAtributo(p.id)}" style="color:${escaparAtributo(p.color)}">${renderMarcadoresHTML(p.text)}</span>`);
    });
    return html;
}

function actualizarObjetivoHTML() {
    const html = construirHTMLObjetivo();
    targetExpression.innerHTML = html;
    ultimoHTMLObjetivo = html;
    renderizarLatexDOM(targetExpression);
    aplicarPulsoFormula();
}

function programarReintentosLatexDOM() {
    [250, 800, 1600, 3200].forEach(delay => {
        programarTimeout(() => {
            if (!levelData || (!window.katex && !window.MathJax)) return;
            const html = construirHTMLObjetivo();
            if (html !== ultimoHTMLObjetivo) {
                targetExpression.innerHTML = html;
                ultimoHTMLObjetivo = html;
                aplicarPulsoFormula();
            }
            renderizarLatexDOM(targetExpression);
        }, delay);
    });
}

function actualizarDispensadorYRelativos() { DISPENSADOR.y = canvas.height - 120; DISPENSADOR.x = Math.min(120, Math.max(75, canvas.width * 0.12)); if (dispensadorBubble && !draggedBubble) { dispensadorBubble.x = DISPENSADOR.x; dispensadorBubble.y = DISPENSADOR.y; } }

function createEmptyBubble(x, y) { return { uid: nuevoUid('bubble'), x, y, r: 35, vx: 0, vy: 0, lastVx: 0, lastVy: 0, wX: 1, wY: 1, angle: 0, inside: [], wrapper: null, activeRecipe: null, isCraftedBubble: false, text: "", targetR: null, lastUnitarySimplifyAt: performance.now(), unitaryVisualDepth: null, touchLock: new Set(), readBoost: 0 }; }

const mathCanvasCache = new Map();
let mathMeasureBox = null;
function obtenerMedidorMath() {
    if (mathMeasureBox) return mathMeasureBox;
    mathMeasureBox = document.createElement('div');
    mathMeasureBox.style.cssText = 'position:absolute;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none;white-space:nowrap;';
    document.body.appendChild(mathMeasureBox);
    cleanupTasks.push(() => mathMeasureBox && mathMeasureBox.remove());
    return mathMeasureBox;
}

function obtenerImagenMathCanvas(fragmento, fontSize) {
    if (!fragmento || !fragmento.math || !window.katex || typeof window.katex.renderToString !== 'function') return null;
    const color = fragmento.color || 'white';
    const key = `${fragmento.latex}|${color}|${fontSize}`;
    const existente = mathCanvasCache.get(key);
    if (existente) return existente.status === 'ready' ? existente : null;

    let katexHTML = '';
    try { katexHTML = window.katex.renderToString(fragmento.latex, { throwOnError: false, displayMode: false, output: 'mathml' }); }
    catch (err) { console.warn('[Math-io] KaTeX no pudo renderizar en canvas:', fragmento.latex, err); return null; }

    const medidor = obtenerMedidorMath();
    const span = document.createElement('span');
    span.style.cssText = `font-size:${fontSize}px;font-weight:700;color:${color};`;
    span.innerHTML = katexHTML;
    medidor.appendChild(span);
    const rect = span.getBoundingClientRect();
    const width = Math.max(12, Math.ceil(rect.width + 8));
    const height = Math.max(12, Math.ceil(rect.height + 8));
    span.remove();

    const html = `<div xmlns="http://www.w3.org/1999/xhtml" style="display:inline-block;font-size:${fontSize}px;font-weight:700;color:${escaparAtributo(color)};line-height:1.15;padding:4px;">${katexHTML}</div>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${html}</foreignObject></svg>`;
    const img = new Image();
    const entry = { status: 'loading', img, width, height };
    mathCanvasCache.set(key, entry);
    img.onload = () => { entry.status = 'ready'; };
    img.onerror = () => { entry.status = 'error'; };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return null;
}

function indiceCircular(index, total) { return ((index % total) + total) % total; }
function ejerciciosNivel(nivel) { return Array.isArray(nivel && nivel.ejercicios) ? nivel.ejercicios : []; }
function valorNivel(nivel) { return Math.max(1, Number(nivel && nivel.valor_nivel) || indiceCircular(currentLevelIndex, niveles.length) + 1); }
function preguntasBuenasMinimo(nivel) { return Math.max(1, Number(nivel && nivel.n_preguntas_buenas_minimo) || 1); }
function puntajePreguntaNivel(nivel) { return Math.max(1, Number(nivel && nivel.puntaje_por_pregunta) || 30 * valorNivel(nivel)); }
function puntajeParaPasar(nivel) { return Math.max(1, Number(nivel && nivel.puntaje_para_pasar) || puntajePreguntaNivel(nivel) * preguntasBuenasMinimo(nivel)); }
function puntajePorEjercicio(nivel, ejercicio) { return Math.max(1, Number(ejercicio && ejercicio.puntaje) || puntajePreguntaNivel(nivel)); }
function penalizacionPorError(nivel) { return Math.max(0, Number(nivel && nivel.penalizacion_error) || 10 * valorNivel(nivel)); }
function recetaMasterActual() { return levelData && Array.isArray(levelData.recetas) ? levelData.recetas.find(r => r.id === 'master') : null; }
function unidadesReceta(receta) {
    if (!receta) return [];
    const ids = Array.isArray(receta.ordenOriginal) ? receta.ordenOriginal : (Array.isArray(receta.orden) ? receta.orden : receta.requeridos);
    return [...(ids || []), receta.envoltorio].filter(Boolean);
}
function recolectarCreditosAceptados(obj, creditos) {
    if (!obj) return;
    if (obj.id) creditos.push(obj.id);
    if (obj.wrapper && obj.wrapper.id) creditos.push(obj.wrapper.id);
    if (Array.isArray(obj.inside)) obj.inside.forEach(sub => recolectarCreditosAceptados(sub, creditos));
}
function creditoPreviewPregunta() {
    if (!previewProgresoActivo) return 0;
    const rec = recetaMasterActual();
    const unidades = unidadesReceta(rec);
    if (!rec || unidades.length === 0) return 0;
    const aceptados = [];
    floatingBubbles.forEach(b => recolectarCreditosAceptados(b, aceptados));
    if (draggedBubble) recolectarCreditosAceptados(draggedBubble, aceptados);
    const restantes = [...unidades];
    let completados = 0;
    aceptados.forEach(id => {
        const idx = restantes.indexOf(id);
        if (idx !== -1) { completados++; restantes.splice(idx, 1); }
    });
    return puntajePorEjercicio(nivelActual, levelData) * Math.min(1, completados / unidades.length);
}
function textoScore() {
    const meta = puntajeParaPasar(nivelActual);
    const progreso = Math.min(puntajeNivel, meta);
    return `${progreso}/${meta}`;
}
function actualizarScoreDisplay() {
    const meta = puntajeParaPasar(nivelActual);
    const progreso = Math.min(puntajeNivel, meta);
    const preview = Math.min(meta, progreso + creditoPreviewPregunta());
    const porcentaje = Math.max(0, Math.min(100, (progreso / meta) * 100));
    const previewPorcentaje = Math.max(porcentaje, Math.min(100, (preview / meta) * 100));
    scoreDisplay.style.setProperty('--mathio-progress', `${porcentaje}%`);
    scoreDisplay.style.setProperty('--mathio-preview', `${previewPorcentaje}%`);
    scoreDisplay.innerHTML = `<span>${textoScore()}</span>`;
}
function validarNivel(nivel, index) {
    const ejercicios = ejerciciosNivel(nivel);
    if (ejercicios.length === 0) { console.error(`[Math-io] Nivel ${index + 1} sin ejercicios.`); return false; }
    return ejercicios.every((ejercicio, i) => {
        const ok = ejercicio && Array.isArray(ejercicio.piezas) && Array.isArray(ejercicio.recetas) && typeof ejercicio.template === 'string';
        if (!ok) console.error(`[Math-io] Ejercicio inválido en nivel ${index + 1}, posición ${i + 1}.`);
        return ok;
    });
}
function seleccionarSiguienteEjercicio() {
    const total = ejerciciosNivel(nivelActual).length;
    if (total <= 1) { currentExerciseIndex = 0; return; }
    if (nivelActual.modo === 'aleatorio') {
        let siguiente = Math.floor(Math.random() * total);
        if (siguiente === currentExerciseIndex) siguiente = (siguiente + 1) % total;
        currentExerciseIndex = siguiente;
        return;
    }
    currentExerciseIndex = (currentExerciseIndex + 1) % total;
}

if (!niveles.every(validarNivel)) { limpiarMathIO(); return; }

function initLevel(index, reiniciarPuntajeNivel = true) {
    gameState = 'PLAYING';
    currentLevelIndex = index;
    nivelActual = niveles[indiceCircular(currentLevelIndex, niveles.length)];
    previewProgresoActivo = true;
    if (reiniciarPuntajeNivel) {
        puntajeNivel = 0;
        currentExerciseIndex = 0;
        mostrarInstruccionNivel(nivelActual);
    }
    const ejercicios = ejerciciosNivel(nivelActual);
    levelData = JSON.parse(JSON.stringify(ejercicios[indiceCircular(currentExerciseIndex, ejercicios.length)]));
    alimentos = []; floatingBubbles = []; floatingTexts = []; draggedBubble = null; particles = []; shakeTime = 0;
    actualizarDispensadorYRelativos();
    dispensadorBubble = createEmptyBubble(DISPENSADOR.x, DISPENSADOR.y);
    actualizarScoreDisplay();
    
    let colPrimarios = [...PALETA_PRIMARIA].sort(() => 0.5 - Math.random()); let colSecundarios = [...PALETA_SECUNDARIA].sort(() => 0.5 - Math.random());
    let colorMap = {}; levelData.piezas.forEach(p => { colorMap[p.id] = colPrimarios.pop() || colSecundarios.pop() || "#333333"; p.color = colorMap[p.id]; });

    actualizarObjetivoHTML(); programarReintentosLatexDOM(); limpiarPulsoIdentidad(true);

    levelData.piezas.forEach(p => {
        let ang = Math.random() * Math.PI * 2; let speed = Math.random() * 1.5 + 0.8; 
        alimentos.push({ uid: nuevoUid('pieza'), id: p.id, text: p.text, color: p.color, es_trampa: p.es_trampa, x: Math.random() * (canvas.width - 300) + 150, y: Math.random() * (canvas.height - 300) + 150, r: 25, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, wX: 1, wY: 1, angle: ang, readBoost: 0 });
    });
}

function spawnParticles(x, y, color, count) { for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 1, color, size: Math.random()*5 + 3 }); }
function spawnFloatingText(x, y, text, color) { floatingTexts.push({ x, y, text, color, life: 1.0, vy: -1.5 }); }
function inflarParaLectura(obj, cantidad = LECTURA_BOOST_MAX) {
    if (!obj) return;
    obj.readBoost = Math.max(obj.readBoost || 0, cantidad);
}
function actualizarBoostLectura(obj) {
    if (!obj || !obj.readBoost) return;
    obj.readBoost *= LECTURA_BOOST_DECAY;
    if (obj.readBoost < 0.01) obj.readBoost = 0;
}
function spawnFirework(x, y, color, count = 42) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.18;
        const speed = 2.5 + Math.random() * 8;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color, size: Math.random() * 4 + 2 });
    }
}

function iniciarCelebracionFinal() {
    gameState = 'WIN';
    draggedBubble = null; mouse.isDown = false; touchOffset = 0;
    playSound('fireworks');
    scoreDisplay.style.setProperty('--mathio-progress', '100%');
    scoreDisplay.innerHTML = `<span>${score}</span>`;
    for (let i = 0; i < 7; i++) {
        programarTimeout(() => {
            if (gameState !== 'WIN') return;
            const x = canvas.width * (0.16 + Math.random() * 0.68);
            const y = canvas.height * (0.18 + Math.random() * 0.44);
            spawnFirework(x, y, COLORES_FUEGOS[i % COLORES_FUEGOS.length], 48);
            const textoFinal = i === 0 ? "Has ganado" : (i === 3 ? "Todos los niveles" : "");
            if (textoFinal) spawnFloatingText(x, y, textoFinal, COLORES_FUEGOS[i % COLORES_FUEGOS.length]);
        }, i * 260);
    }
}

function recuperarVidaPorNivel() {
    lives = Math.min(3, lives + 1);
}

function instruccionNivel(nivel) {
    if (!nivel || !nivel.instruccion) return null;
    if (typeof nivel.instruccion === 'string') return { texto: nivel.instruccion, duracion: 4200 };
    return {
        texto: nivel.instruccion.texto || '',
        duracion: Math.max(1200, Number(nivel.instruccion.duracion) || 4200)
    };
}

function mostrarInstruccionNivel(nivel) {
    if (!instructionDisplay) return;
    instructionDisplay.classList.remove('is-visible');
    const instruccion = instruccionNivel(nivel);
    if (!instruccion || !instruccion.texto) {
        instructionDisplay.textContent = '';
        return;
    }
    instructionDisplay.textContent = instruccion.texto;
    requestAnimationFrame(() => instructionDisplay.classList.add('is-visible'));
    programarTimeout(() => instructionDisplay.classList.remove('is-visible'), instruccion.duracion);
}

function aplicarPulsoFormula() { const activos = identidadActiva.ids || new Set(); targetExpression.querySelectorAll('.formula-piece').forEach(span => span.classList.toggle('identity-pulse', activos.has(span.dataset.pieceId))); }
function limpiarPulsoIdentidad(forzar = false) { if (forzar || identidadActiva.ids.size > 0 || identidadActiva.sosteniendo) { identidadActiva = { ids: new Set(), hasta: 0, sosteniendo: false, clave: '' }; aplicarPulsoFormula(); } }
function activarPulsoIdentidad(ids, opciones = {}) {
    const clave = [...new Set((ids || []).filter(Boolean))].sort().join('|'); if (!clave) return;
    const ahora = performance.now(); const sosteniendo = !!opciones.sosteniendo;
    if (identidadActiva.clave !== clave || identidadActiva.sosteniendo !== sosteniendo) { identidadActiva.ids = new Set(clave.split('|')); identidadActiva.clave = clave; identidadActiva.sosteniendo = sosteniendo; aplicarPulsoFormula(); }
    identidadActiva.hasta = ahora + (opciones.duracion ?? (sosteniendo ? DURACION_PULSO_CONTACTO : DURACION_PULSO_IDENTIDAD));
}
function soltarPulsoIdentidad() { if (identidadActiva.ids.size > 0) { identidadActiva.sosteniendo = false; identidadActiva.hasta = performance.now() + DURACION_PULSO_IDENTIDAD; aplicarPulsoFormula(); } }
function actualizarPulsoIdentidad() { if (identidadActiva.ids.size > 0 && !identidadActiva.sosteniendo && performance.now() > identidadActiva.hasta) limpiarPulsoIdentidad(true); }
function identidadEstaActiva(id) { return !!id && identidadActiva.ids && identidadActiva.ids.has(id); }

function idsIdentidadObjeto(obj, tipo) { const ids = []; recolectarIdsIdentidad(obj, tipo, ids); return [...new Set(ids.filter(Boolean))]; }
function recolectarIdsIdentidad(obj, tipo, ids) {
    if (!obj) return;
    if (tipo === 'crafteado' && esBurbujaUnitaria(obj, 'crafteado')) { const efectiva = piezaEfectiva(obj, 'crafteado'); if (efectiva.objetoFinal) recolectarIdsIdentidad(efectiva.objetoFinal, efectiva.tipoFinal, ids); else if (efectiva.id) ids.push(efectiva.id); return; }
    if (esObjetoBurbuja(obj)) { if (obj.wrapper && obj.wrapper.id) ids.push(obj.wrapper.id); if (Array.isArray(obj.inside)) obj.inside.forEach(sub => recolectarIdsIdentidad(sub, esObjetoBurbuja(sub) ? 'crafteado' : 'crudo', ids)); if ((!obj.inside || obj.inside.length === 0) && obj.id) ids.push(obj.id); return; }
    if (obj.id) ids.push(obj.id);
}

function objetoCrudoBajoPuntero(x, y) { for (let i = alimentos.length - 1; i >= 0; i--) { if (Math.hypot(x - alimentos[i].x, y - alimentos[i].y) <= alimentos[i].r) return alimentos[i]; } return null; }

function fallar(razon, errX, errY) {
    playSound('error'); shakeTime = 15;
    let fx = errX || (draggedBubble ? draggedBubble.x : canvas.width/2);
    let fy = errY || (draggedBubble ? draggedBubble.y : canvas.height/2);
    spawnParticles(fx, fy, "#ff4757", 30);
    spawnFloatingText(fx, fy - 40, razon || "¡Error!", "#ff4757");

    flashScreen.style.opacity = '0.5'; programarTimeout(() => flashScreen.style.opacity = '0', 200);
    if(draggedBubble && draggedBubble !== dispensadorBubble) floatingBubbles.push(draggedBubble); // Drop it back
    draggedBubble = null; touchOffset = 0; mouse.isDown = false;

    lives--;
    if (lives <= 0) {
        gameState = 'GAMEOVER'; playSound('gameover');
        programarTimeout(() => { lives = 3; score = 0; puntajeNivel = 0; currentLevelIndex = 0; currentExerciseIndex = 0; initLevel(0); }, 3000);
    } else {
        const penalizacion = penalizacionPorError(nivelActual);
        score = Math.max(0, score - penalizacion); puntajeNivel = Math.max(0, puntajeNivel - penalizacion);
        spawnFloatingText(fx, fy - 70, `-${penalizacion}`, "#ff9f43");
    }
    actualizarScoreDisplay();
}

// --- INPUT ---
function puntoCanvasDesdeCliente(clientX, clientY) { const rect = canvas.getBoundingClientRect(); return { x: (clientX - rect.left) * (canvas.width / Math.max(1, rect.width)), y: (clientY - rect.top) * (canvas.height / Math.max(1, rect.height)) }; }

function inputStart(x, y, touchMode) {
    if (gameState === 'WIN') { score = 0; puntajeNivel = 0; lives = 3; currentLevelIndex = 0; currentExerciseIndex = 0; initLevel(0); return; }
    if (gameState !== 'PLAYING') return;
    obtenerAudioContext();
    mouse.x = x; mouse.y = y; mouse.isDown = true; isTouch = touchMode;
    
    if (Math.hypot(mouse.x - DISPENSADOR.x, mouse.y - DISPENSADOR.y) < DISPENSADOR.r) {
        draggedBubble = dispensadorBubble; draggedBubble.touchLock = new Set(); limpiarPulsoIdentidad(true);
        inflarParaLectura(draggedBubble, 0.2);
        dispensadorBubble = createEmptyBubble(DISPENSADOR.x, DISPENSADOR.y); return;
    }
    for (let i = floatingBubbles.length - 1; i >= 0; i--) {
        let b = floatingBubbles[i];
        if (Math.hypot(mouse.x - b.x, mouse.y - b.y) < b.r) {
            draggedBubble = b; draggedBubble.touchLock = new Set();
            inflarParaLectura(draggedBubble);
            activarPulsoIdentidad(idsIdentidadObjeto(b, 'crafteado'), { sosteniendo: true }); floatingBubbles.splice(i, 1); return;
        }
    }
    const pieza = objetoCrudoBajoPuntero(mouse.x, mouse.y);
    if (pieza) { inflarParaLectura(pieza); activarPulsoIdentidad(idsIdentidadObjeto(pieza, 'crudo'), { sosteniendo: true }); }
}
function inputMove(x, y) { mouse.x = x; mouse.y = y; }
function inputEnd() {
    if (gameState !== 'PLAYING') return;
    mouse.isDown = false; soltarPulsoIdentidad();
    if (draggedBubble) {
        draggedBubble.vx = draggedBubble.lastVx * 1.5; draggedBubble.vy = draggedBubble.lastVy * 1.5;
        let speed = Math.hypot(draggedBubble.vx, draggedBubble.vy);
        if (speed > 25) { draggedBubble.vx = (draggedBubble.vx/speed)*25; draggedBubble.vy = (draggedBubble.vy/speed)*25; }
        if (speed > 5) playSound('throw');
        floatingBubbles.push(draggedBubble); draggedBubble = null; 
        
        let vacias = floatingBubbles.filter(b => b.inside.length === 0 && !b.isCraftedBubble);
        if (vacias.length > 3) { let vieja = vacias[0]; playSound('pop'); spawnParticles(vieja.x, vieja.y, "#3498db", 15); floatingBubbles = floatingBubbles.filter(b => b !== vieja); }
        actualizarScoreDisplay();
    }
}

escuchar(canvas, 'mousedown', e => { const p = puntoCanvasDesdeCliente(e.clientX, e.clientY); inputStart(p.x, p.y, false); });
escuchar(window, 'mousemove', e => { const p = puntoCanvasDesdeCliente(e.clientX, e.clientY); inputMove(p.x, p.y); });
escuchar(window, 'mouseup', inputEnd);
escuchar(canvas, 'touchstart', e => { e.preventDefault(); const p = puntoCanvasDesdeCliente(e.touches[0].clientX, e.touches[0].clientY); inputStart(p.x, p.y, true); }, {passive: false});
escuchar(window, 'touchmove', e => { if (!e.touches.length) return; e.preventDefault(); const p = puntoCanvasDesdeCliente(e.touches[0].clientX, e.touches[0].clientY); inputMove(p.x, p.y); }, {passive: false});
escuchar(window, 'touchend', inputEnd);

// --- FÍSICAS ---
function aplicarFisicaAero(obj) {
    obj.x += obj.vx; obj.y += obj.vy; let speed = Math.hypot(obj.vx, obj.vy);
    if (speed < 0.01) { let ang = Math.random() * Math.PI * 2; obj.vx = Math.cos(ang); obj.vy = Math.sin(ang); speed = 1; }
    let newSpeed = Math.max(speed * 0.985, 0.8); obj.vx = (obj.vx / speed) * newSpeed; obj.vy = (obj.vy / speed) * newSpeed;
    if (obj.x - obj.r < 0) { obj.x = obj.r; obj.vx *= -1; } if (obj.x + obj.r > canvas.width) { obj.x = canvas.width - obj.r; obj.vx *= -1; }
    if (obj.y - obj.r < 0) { obj.y = obj.r; obj.vy *= -1; } if (obj.y + obj.r > canvas.height) { obj.y = canvas.height - obj.r; obj.vy *= -1; }
    if (newSpeed > 1.5) obj.angle = Math.atan2(obj.vy, obj.vx);
    let targetWX = 1 + Math.min(newSpeed * 0.015, 0.3); let targetWY = 1 / targetWX;
    obj.wX += (targetWX - obj.wX) * 0.1; obj.wY += (targetWY - obj.wY) * 0.1;
}

function fisicaColisionBurbujas(lista1, lista2) {
    let todos = [...lista1, ...lista2];
    for (let i=0; i<todos.length; i++) {
        for (let j=i+1; j<todos.length; j++) {
            let a = todos[i], b = todos[j], dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
            if (dist < a.r + b.r) {
                if (dist === 0) { dx = 0.01; dy = 0; dist = 0.01; }
                let overlap = (a.r + b.r - dist) / 2; let nx = dx/dist, ny = dy/dist;
                a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
                let tx = a.vx; a.vx = b.vx; b.vx = tx; let ty = a.vy; a.vy = b.vy; b.vy = ty;
            }
        }
    }
}

function update() {
    // Actualizaciones visuales que NO se pausan
    for (let i = particles.length - 1; i >= 0; i--) { let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.03; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = floatingTexts.length - 1; i >= 0; i--) { let ft = floatingTexts[i]; ft.y += ft.vy; ft.life -= 0.015; if (ft.life <= 0) floatingTexts.splice(i, 1); }
    alimentos.forEach(actualizarBoostLectura); floatingBubbles.forEach(actualizarBoostLectura); if (draggedBubble) actualizarBoostLectura(draggedBubble);
    actualizarPulsoIdentidad();

    if (gameState === 'TRANSITION' && draggedBubble) {
        draggedBubble.wX += (1 - draggedBubble.wX) * 0.16;
        draggedBubble.wY += (1 - draggedBubble.wY) * 0.16;
        draggedBubble.angle *= 0.94;
    }

    if (gameState !== 'PLAYING') return; // Pausa físicas aquí

    alimentos.forEach(aplicarFisicaAero); floatingBubbles.forEach(aplicarFisicaAero);
    floatingBubbles.forEach(actualizarSimplificacionUnitaria); fisicaColisionBurbujas(alimentos, floatingBubbles);

    let targetOffset = (isTouch && draggedBubble) ? -90 : 0; touchOffset += (targetOffset - touchOffset) * 0.15;

    if (draggedBubble) {
        let prevX = draggedBubble.x; let prevY = draggedBubble.y;
        draggedBubble.x += (mouse.x - draggedBubble.x) * 0.25; draggedBubble.y += (mouse.y + touchOffset - draggedBubble.y) * 0.25;
        draggedBubble.lastVx = draggedBubble.x - prevX; draggedBubble.lastVy = draggedBubble.y - prevY;
        let speed = Math.hypot(draggedBubble.lastVx, draggedBubble.lastVy);
        if (speed > 0.5) draggedBubble.angle = Math.atan2(draggedBubble.lastVy, draggedBubble.lastVx);
        let targetWX = 1 + Math.min(speed * 0.02, 0.4); let targetWY = 1 / targetWX;
        draggedBubble.wX += (targetWX - draggedBubble.wX) * 0.2; draggedBubble.wY += (targetWY - draggedBubble.wY) * 0.2;
        actualizarSimplificacionUnitaria(draggedBubble); comprobarComer();
    }
}

function umbralTragado(obj, tipo) {
    if (tipo === 'crafteado') { const solapeMinimo = Math.max(18, Math.min(obj.r * FACTOR_SOLAPE_BURBUJA, draggedBubble.r * FACTOR_SOLAPE_BURBUJA, 42)); return Math.max(22, draggedBubble.r + obj.r - solapeMinimo); }
    return Math.max(16, draggedBubble.r * FACTOR_TRAGADO_CRUDO);
}

function comprobarComer() {
    let comestibles = [...alimentos.map(a => ({ ref: a, tipo: 'crudo' })), ...floatingBubbles.map(b => ({ ref: b, tipo: 'crafteado' }))];
    let candidatos = []; let contactoIdentidad = null;

    for (let item of comestibles) {
        let obj = item.ref; if (!obj.uid) obj.uid = nuevoUid(item.tipo);
        if (!draggedBubble.touchLock) draggedBubble.touchLock = new Set();
        if (draggedBubble.touchLock.has(obj.uid)) continue;
        if (item.tipo === 'crafteado' && obj.inside.length === 0 && !obj.isCraftedBubble) continue;

        const dist = Math.hypot(draggedBubble.x - obj.x, draggedBubble.y - obj.y);
        if (dist < draggedBubble.r + obj.r) { if (!contactoIdentidad || dist < contactoIdentidad.dist) contactoIdentidad = { obj, tipo: item.tipo, dist }; }
        const umbral = umbralTragado(obj, item.tipo);
        if (dist < umbral) candidatos.push({ obj, tipo: item.tipo, dist, umbral });
    }

    if (contactoIdentidad && candidatos.length === 0 && mouse.isDown && !identidadActiva.sosteniendo) activarPulsoIdentidad(idsIdentidadObjeto(contactoIdentidad.obj, contactoIdentidad.tipo), { duracion: DURACION_PULSO_CONTACTO });
    if (candidatos.length === 0) return;
    candidatos.sort((a, b) => (a.dist / a.umbral) - (b.dist / b.umbral));
    procesarComida(candidatos[0].obj, candidatos[0].tipo);
}

// --- LÓGICA DE RECETAS v1.2 (RESTAURADA) ---
function esObjetoBurbuja(obj) { return !!(obj && Array.isArray(obj.inside)); }
function prepararReceta(receta) { let rec = JSON.parse(JSON.stringify(receta)); if (!rec.ordenOriginal) rec.ordenOriginal = Array.isArray(rec.orden) ? [...rec.orden] : [...rec.requeridos]; return rec; }
function clonarParaInterior(obj) { if (!obj) return obj; let copia = { ...obj }; if (Array.isArray(obj.inside)) copia.inside = obj.inside.map(clonarParaInterior); if (obj.wrapper) copia.wrapper = { ...obj.wrapper }; if (obj.activeRecipe) copia.activeRecipe = JSON.parse(JSON.stringify(obj.activeRecipe)); copia.uid = nuevoUid('interior'); copia.touchLock = new Set(); return copia; }
function esBurbujaUnitaria(obj, tipo) { return tipo === 'crafteado' && obj && Array.isArray(obj.inside) && obj.inside.length === 1 && !obj.wrapper && !obj.isCraftedBubble; }

function piezaEfectiva(obj, tipo) {
    let actual = obj; let tipoActual = tipo; let colorHeredado = obj ? obj.color : undefined; let sourceUid = obj ? obj.uid : undefined; let profundidad = 0;
    while (esBurbujaUnitaria(actual, tipoActual) && profundidad < 30) { colorHeredado = actual.color || colorHeredado; sourceUid = actual.uid || sourceUid; actual = actual.inside[0]; tipoActual = esObjetoBurbuja(actual) ? 'crafteado' : 'crudo'; profundidad++; }
    let texto = ''; if (actual) texto = actual.text || textoVisibleBurbuja(actual);
    return { id: actual ? actual.id : undefined, text: texto, color: (actual && actual.color) || colorHeredado, sourceUid: sourceUid, desdeBurbujaUnitaria: profundidad > 0, profundidadUnitaria: profundidad, objetoFinal: actual, tipoFinal: tipoActual };
}

function textoVisibleBurbuja(obj) { if (!obj) return ''; if (!esObjetoBurbuja(obj)) return obj.text || ''; if (obj.text && obj.isCraftedBubble) return obj.text; let rec = obj.activeRecipe; let sep = rec ? rec.separador : ' + '; return piezasOrdenadasPorReceta(obj, rec).map(textoMatematicoPieza).join(sep); }
function textoMatematicoPieza(pieza) { return piezaEfectiva(pieza, esObjetoBurbuja(pieza) ? 'crafteado' : 'crudo').text || ''; }
function textoVisualPieza(pieza) { return textoMatematicoPieza(pieza); }

function indiceOrdenReceta(pieza, rec) { if (!rec || !Array.isArray(rec.ordenOriginal)) return 9999; let efectiva = piezaEfectiva(pieza, esObjetoBurbuja(pieza) ? 'crafteado' : 'crudo'); let idx = rec.ordenOriginal.indexOf(efectiva.id); return idx === -1 ? 9999 : idx; }
function piezasOrdenadasPorReceta(burbuja, rec) { return burbuja.inside.map((pieza, posicionOriginal) => ({ pieza, posicionOriginal })).sort((a, b) => { let ia = indiceOrdenReceta(a.pieza, rec); let ib = indiceOrdenReceta(b.pieza, rec); if (ia !== ib) return ia - ib; return a.posicionOriginal - b.posicionOriginal; }).map(item => item.pieza); }
function copiaMatematicaDesdePieza(pieza) { return { id: pieza.id, text: pieza.text, color: pieza.color, sourceUid: pieza.sourceUid }; }
function copiaInteriorDesdeObjeto(obj, tipo, pieza) { if (tipo === 'crafteado' && esBurbujaUnitaria(obj, tipo)) return clonarParaInterior(obj); return copiaMatematicaDesdePieza(pieza); }
function radioObjetivoParaTexto(texto) { return Math.max(RADIO_PIEZA_BASE, Math.min(95, 18 + textoPlanoParaMedida(texto).length * 6.8)); }

function inicializarProfundidadVisualUnitaria(burbuja) { let efectiva = piezaEfectiva(burbuja, 'crafteado'); if (burbuja.unitaryVisualDepth === null || burbuja.unitaryVisualDepth === undefined) burbuja.unitaryVisualDepth = Math.max(0, efectiva.profundidadUnitaria); return efectiva; }
function simplificarUnNivelUnitario(burbuja) { if (!esBurbujaUnitaria(burbuja, 'crafteado')) return; inicializarProfundidadVisualUnitaria(burbuja); if (burbuja.unitaryVisualDepth > 0) burbuja.unitaryVisualDepth--; burbuja.lastUnitarySimplifyAt = performance.now(); }
function actualizarSimplificacionUnitaria(burbuja) {
    if (!burbuja || !esObjetoBurbuja(burbuja)) return;
    if (!esBurbujaUnitaria(burbuja, 'crafteado')) { burbuja.targetR = null; burbuja.unitaryVisualDepth = null; burbuja.lastUnitarySimplifyAt = performance.now(); return; }
    let efectiva = inicializarProfundidadVisualUnitaria(burbuja); let baseR = radioObjetivoParaTexto(efectiva.text) + 10;
    if (!burbuja.lastUnitarySimplifyAt) burbuja.lastUnitarySimplifyAt = performance.now();
    if (performance.now() - burbuja.lastUnitarySimplifyAt >= TIEMPO_SIMPLIFICACION_UNITARIA) simplificarUnNivelUnitario(burbuja);
    burbuja.targetR = baseR + (burbuja.unitaryVisualDepth || 0) * EXTRA_RADIO_CAPA_UNITARIA; burbuja.r += (burbuja.targetR - burbuja.r) * VELOCIDAD_DESINFLADO_UNITARIO;
}

function consumirObjetoFisico(obj, tipo) { if (draggedBubble && draggedBubble.touchLock && obj && obj.uid) draggedBubble.touchLock.add(obj.uid); if (tipo === 'crudo') alimentos = alimentos.filter(a => a !== obj); else floatingBubbles = floatingBubbles.filter(b => b !== obj); }
function quitarPrimerRequerido(lista, id) { let copia = [...lista]; let idx = copia.indexOf(id); if (idx !== -1) copia.splice(idx, 1); return copia; }
function esBurbujaCompletaDeReceta(obj, tipo) { return tipo === 'crafteado' && obj && obj.isCraftedBubble === true && typeof obj.id === 'string' && obj.id.length > 0; }
function recetaPadreAceptaSiguiente(receta, idActual, piezaSiguiente, objSiguiente, tipoSiguiente) {
    if (!receta || !Array.isArray(receta.requeridos)) return false; if (!idActual || !piezaSiguiente || !piezaSiguiente.id) return false; if (!receta.requeridos.includes(idActual)) return false;
    let restantes = quitarPrimerRequerido(receta.requeridos, idActual); let idSiguiente = piezaSiguiente.id;
    let siguienteEsHermanaCompleta = esBurbujaCompletaDeReceta(objSiguiente, tipoSiguiente); let siguienteEsBurbujaIncompletaMayor = tipoSiguiente === 'crafteado' && !siguienteEsHermanaCompleta && !piezaSiguiente.desdeBurbujaUnitaria;
    if (siguienteEsHermanaCompleta) return restantes.includes(idSiguiente); if (siguienteEsBurbujaIncompletaMayor) return false;
    if (restantes.includes(idSiguiente)) return true; if (restantes.length === 0 && receta.envoltorio === idSiguiente) return true; return false;
}

function promoverBurbujaTerminadaARecetaPadre(objSiguiente, tipoSiguiente, piezaSiguiente) {
    if (!draggedBubble || !draggedBubble.isCraftedBubble || !draggedBubble.id) return false;
    let idActual = draggedBubble.id; let recetaPadre = levelData.recetas.find(r => recetaPadreAceptaSiguiente(r, idActual, piezaSiguiente, objSiguiente, tipoSiguiente));
    if (!recetaPadre) return false;
    let burbujaActualComoPieza = clonarParaInterior(draggedBubble); let rec = prepararReceta(recetaPadre); rec.requeridos = quitarPrimerRequerido(rec.requeridos, idActual);
    draggedBubble.activeRecipe = rec; draggedBubble.inside = [burbujaActualComoPieza]; draggedBubble.wrapper = null; draggedBubble.text = ''; draggedBubble.isCraftedBubble = false; draggedBubble.id = undefined; draggedBubble.unitaryVisualDepth = null; draggedBubble.lastUnitarySimplifyAt = performance.now();
    return true;
}

function procesarComida(obj, tipo) {
    let pieza = piezaEfectiva(obj, tipo);
    let isTrap = (tipo === 'crudo') ? alimentos.find(a => a.id === pieza.id)?.es_trampa : false;

    if (draggedBubble.isCraftedBubble) {
        if (!promoverBurbujaTerminadaARecetaPadre(obj, tipo, pieza)) {
            return fallar(isTrap ? "¡Es una trampa!" : "¡No encaja aquí!", obj.x, obj.y);
        }
    }

    if (!draggedBubble.activeRecipe) {
        if(isTrap) return fallar("¡Es una trampa!", obj.x, obj.y);
        let receta = levelData.recetas.find(r => r.requeridos.includes(pieza.id));
        if (receta) { draggedBubble.activeRecipe = prepararReceta(receta); }
        else if (tipo === 'crafteado' && !obj.isCraftedBubble) { absorberBurbuja(obj); return; }
        else { return fallar("¡Pieza incorrecta!", obj.x, obj.y); }
    }

    let rec = draggedBubble.activeRecipe;
    if (rec.requeridos.length > 0) {
        let pos = rec.requeridos.indexOf(pieza.id);
        if (pos !== -1) {
            comerExitoso(obj, pieza, rec, tipo, pos);
            if (rec.requeridos.length === 0 && !rec.envoltorio) finalizarReceta();
        } else {
             return fallar(isTrap ? "¡Es una trampa!" : "¡Orden incorrecto!", obj.x, obj.y);
        }
    } else if (rec.envoltorio) {
        if (pieza.id === rec.envoltorio) {
            draggedBubble.wrapper = copiaMatematicaDesdePieza(pieza); rec.envoltorio = null; comerExitoso(obj, pieza, rec, tipo, -1); finalizarReceta();
        } else {
             return fallar(isTrap ? "¡Es una trampa!" : "¡Coeficiente incorrecto!", obj.x, obj.y);
        }
    }
}

function absorberBurbuja(obj) {
    playSound('eat'); spawnParticles(obj.x, obj.y, obj.color || "#fff", 20); draggedBubble.wX = 0.5; draggedBubble.wY = 1.5; draggedBubble.r = Math.sqrt(Math.pow(draggedBubble.r, 2) + Math.pow(obj.r, 2)) + 2;
    floatingBubbles = floatingBubbles.filter(b => b !== obj);
    draggedBubble.activeRecipe = obj.activeRecipe ? JSON.parse(JSON.stringify(obj.activeRecipe)) : null;
    if (draggedBubble.activeRecipe && !draggedBubble.activeRecipe.ordenOriginal) { draggedBubble.activeRecipe.ordenOriginal = Array.isArray(draggedBubble.activeRecipe.orden) ? [...draggedBubble.activeRecipe.orden] : [...draggedBubble.activeRecipe.requeridos]; }
    draggedBubble.inside = obj.inside.map(clonarParaInterior); draggedBubble.wrapper = obj.wrapper ? { ...obj.wrapper } : null; draggedBubble.id = obj.id; draggedBubble.isCraftedBubble = obj.isCraftedBubble; draggedBubble.text = obj.text; draggedBubble.unitaryVisualDepth = null; draggedBubble.lastUnitarySimplifyAt = performance.now();
    inflarParaLectura(draggedBubble);
    actualizarScoreDisplay();
}

function comerExitoso(obj, pieza, rec, tipo, posRequerido) {
    playSound('eat'); spawnParticles(obj.x, obj.y, pieza.color || obj.color || "#fff", 20); draggedBubble.wX = 0.5; draggedBubble.wY = 1.5; draggedBubble.r = Math.sqrt(Math.pow(draggedBubble.r, 2) + Math.pow(obj.r, 2)) + 2;
    consumirObjetoFisico(obj, tipo);
    if (posRequerido !== -1) { draggedBubble.inside.push(copiaInteriorDesdeObjeto(obj, tipo, pieza)); rec.requeridos.splice(posRequerido, 1); draggedBubble.unitaryVisualDepth = null; draggedBubble.lastUnitarySimplifyAt = performance.now(); }
    inflarParaLectura(draggedBubble);
    actualizarScoreDisplay();
}

function finalizarReceta() {
    let rec = draggedBubble.activeRecipe; 
    let p_open = (rec.parentesis) ? rec.parentesis[0] : "("; let p_close = (rec.parentesis) ? rec.parentesis[1] : ")";
    let txtInterno = piezasOrdenadasPorReceta(draggedBubble, rec).map(textoMatematicoPieza).join(rec.separador);
    draggedBubble.text = draggedBubble.wrapper ? `${draggedBubble.wrapper.text}${p_open}${txtInterno}${p_close}` : txtInterno;

    if (rec.id === "master") {
        gameState = 'TRANSITION';
        const puntosGanados = puntajePorEjercicio(nivelActual, levelData);
        previewProgresoActivo = false;
        playSound('complete'); actualizarScoreDisplay();
        inflarParaLectura(draggedBubble, 0.24);
        draggedBubble.isCraftedBubble = true; spawnParticles(draggedBubble.x, draggedBubble.y, "#f1c40f", 50);
        programarTimeout(() => {
            score += puntosGanados; puntajeNivel += puntosGanados; actualizarScoreDisplay();
            const nivelCompletado = puntajeNivel >= puntajeParaPasar(nivelActual);
            const juegoCompletado = nivelCompletado && currentLevelIndex >= niveles.length - 1;
            if (nivelCompletado) recuperarVidaPorNivel();
            spawnFloatingText(draggedBubble.x, draggedBubble.y - 60, juegoCompletado ? "Has ganado" : (nivelCompletado ? "Nivel superado" : `+${puntosGanados}`), "#f1c40f");
            programarTimeout(() => {
                if (juegoCompletado) iniciarCelebracionFinal();
                else if (nivelCompletado) initLevel(currentLevelIndex + 1, true);
                else { seleccionarSiguienteEjercicio(); initLevel(currentLevelIndex, false); }
            }, 1250);
        }, 220);
    } else { draggedBubble.id = rec.id; draggedBubble.isCraftedBubble = true; }
}

// --- RENDERIZADO v1.2 (RESTAURADO) ---
function drawMembrane(x, y, r, wX, wY, angle, fillStyle, strokeStyle, lineDash) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(wX, wY); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = fillStyle; ctx.fill(); ctx.strokeStyle = strokeStyle; ctx.lineWidth = 3; if (lineDash) ctx.setLineDash(lineDash); ctx.stroke(); ctx.restore();
}
function drawText(x, y, text, color = "white", id = undefined, radio = RADIO_PIEZA_BASE) { dibujarFragmentosCentrados(x, y, fragmentosDesdeMarcadores(text, color, id), radio); }

function fragmentosPieza(pieza) {
    if (!pieza) return [];
    if (esObjetoBurbuja(pieza)) {
        if (esBurbujaUnitaria(pieza, 'crafteado')) return fragmentosPieza(piezaEfectiva(pieza, 'crafteado').objetoFinal || pieza.inside[0]);
        if (pieza.text && pieza.isCraftedBubble) return fragmentosDesdeMarcadores(pieza.text, pieza.color || "white", pieza.id);
        let rec = pieza.activeRecipe; let partes = [];
        if (pieza.wrapper) partes.push(...fragmentosDesdeMarcadores(pieza.wrapper.text, pieza.wrapper.color || "white", pieza.wrapper.id), { text: (rec && rec.parentesis ? rec.parentesis[0] : "("), color: "white" });
        let lista = piezasOrdenadasPorReceta(pieza, rec);
        lista.forEach((sub, i) => { if (i > 0) partes.push({ text: rec ? rec.separador : " + ", color: "white" }); partes.push(...fragmentosPieza(sub)); });
        if (pieza.wrapper) partes.push({ text: (rec && rec.parentesis ? rec.parentesis[1] : ")"), color: "white" }); return partes;
    }
    return fragmentosDesdeMarcadores(pieza.text || "", pieza.color || "white", pieza.id);
}

function fragmentosVisualesBurbuja(pb) {
    if (esBurbujaUnitaria(pb, 'crafteado')) { let efectiva = piezaEfectiva(pb, 'crafteado'); return fragmentosDesdeMarcadores(efectiva.text || '', efectiva.color || "white", efectiva.id); }
    let rec = pb.activeRecipe; if (pb.text && pb.isCraftedBubble && (!rec || !Array.isArray(pb.inside) || pb.inside.length === 0)) return fragmentosDesdeMarcadores(pb.text, "white");
    let partes = []; let p_open = (rec && rec.parentesis) ? rec.parentesis[0] : "("; let p_close = (rec && rec.parentesis) ? rec.parentesis[1] : ")"; let sep = rec ? rec.separador : " + ";
    if (pb.wrapper) partes.push(...fragmentosDesdeMarcadores(pb.wrapper.text, pb.wrapper.color || "white", pb.wrapper.id), { text: p_open, color: "white" });
    let lista = piezasOrdenadasPorReceta(pb, rec); lista.forEach((pieza, i) => { if (i > 0) partes.push({ text: sep, color: "white" }); partes.push(...fragmentosPieza(pieza)); });
    if (pb.wrapper) partes.push({ text: p_close, color: "white" }); if (!pb.wrapper && rec && rec.requeridos.length === 0 && lista.length > 1) { partes.unshift({ text: p_open, color: "white" }); partes.push({ text: p_close, color: "white" }); }
    return partes;
}

function dibujarFragmentosCentrados(x, y, fragmentos, radio) {
    fragmentos = fragmentos.filter(f => f && f.text !== undefined && f.text !== null && String(f.text).length > 0); if (fragmentos.length === 0) return;
    let textoPlano = fragmentos.map(f => f.text).join(""); let fontSize = 22; if (textoPlano.length > 18) fontSize = 18; if (textoPlano.length > 30) fontSize = 14;
    const anchoFragmento = f => {
        const imgMath = obtenerImagenMathCanvas(f, fontSize);
        if (imgMath) return imgMath.width;
        ctx.font = f.math ? `bold ${fontSize}px 'Cambria Math', Georgia, serif` : `bold ${fontSize}px Arial`;
        return ctx.measureText(f.text).width;
    };
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; let maxWidth = Math.max(40, radio * 1.75); let total = fragmentos.reduce((sum, f) => sum + anchoFragmento(f), 0);
    while (total > maxWidth && fontSize > 10) { fontSize -= 1; total = fragmentos.reduce((sum, f) => sum + anchoFragmento(f), 0); }
    let cursor = x - total / 2;
    fragmentos.forEach(f => {
        const activo = identidadEstaActiva(f.id); ctx.save();
        if (activo) { const pulso = 0.55 + 0.45 * Math.sin(performance.now() / 140); ctx.shadowColor = f.color || "white"; ctx.shadowBlur = 10 + 12 * pulso; ctx.fillStyle = f.color || "white"; } else { ctx.fillStyle = f.color || "white"; }
        const imgMath = obtenerImagenMathCanvas(f, fontSize);
        const ancho = imgMath ? imgMath.width : anchoFragmento(f);
        if (imgMath) {
            ctx.drawImage(imgMath.img, cursor, y - imgMath.height / 2, imgMath.width, imgMath.height);
        } else {
            ctx.font = f.math ? `bold ${fontSize}px 'Cambria Math', Georgia, serif` : `bold ${fontSize}px Arial`;
            ctx.fillText(f.text, cursor, y);
        }
        ctx.restore(); cursor += ancho;
    }); ctx.textAlign = "center";
}

function dibujarHaloIdentidad(obj, ids, escala = 1) {
    if (!ids || !ids.some(identidadEstaActiva)) return; const pulso = 0.55 + 0.45 * Math.sin(performance.now() / 135); ctx.save(); ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.r + 7 + 4 * pulso, 0, Math.PI * 2);
    ctx.strokeStyle = obj.color || "#ffffff"; ctx.globalAlpha = 0.35 + 0.35 * pulso; ctx.lineWidth = 3 * escala; ctx.shadowColor = obj.color || "#ffffff"; ctx.shadowBlur = 14 + 10 * pulso; ctx.stroke(); ctx.restore();
}

function drawObj(obj) {
    const escalaLectura = 1 + (obj.readBoost || 0);
    const radioVisual = obj.r * escalaLectura;
    dibujarHaloIdentidad(obj, [obj.id]); drawMembrane(obj.x, obj.y, radioVisual, obj.wX, obj.wY, obj.angle, obj.color || "#444", "white", null);
    if (identidadEstaActiva(obj.id)) { ctx.save(); const pulso = 0.55 + 0.45 * Math.sin(performance.now() / 140); ctx.shadowColor = obj.color || "white"; ctx.shadowBlur = 12 + 12 * pulso; drawText(obj.x, obj.y, obj.text, "white", obj.id, radioVisual); ctx.restore(); } else { drawText(obj.x, obj.y, obj.text, "white", obj.id, radioVisual); }
}

function drawBubble(pb, isDispenser = false) {
    let fill = isDispenser ? "rgba(52, 152, 219, 0.2)" : "rgba(255, 255, 255, 0.1)"; let stroke = isDispenser ? "#3498db" : "#ffffff";
    let rec = pb.activeRecipe; let dash = (rec && rec.requeridos.length === 0 && rec.envoltorio) ? [8, 6] : null;
    const escalaLectura = isDispenser ? 1 : 1 + (pb.readBoost || 0);
    const radioVisual = pb.r * escalaLectura;
    if (!isDispenser) dibujarHaloIdentidad(pb, idsIdentidadObjeto(pb, 'crafteado'), 0.9);
    drawMembrane(pb.x, pb.y, radioVisual, pb.wX, pb.wY, pb.angle, fill, stroke, dash);
    if (isDispenser) { ctx.fillStyle = "white"; ctx.font = "14px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("NUEVA", pb.x, pb.y - 10); ctx.fillText("BURBUJA", pb.x, pb.y + 10); } else {
        let texto = pb.text;
        if (!pb.isCraftedBubble) {
            if (esBurbujaUnitaria(pb, 'crafteado')) { texto = piezaEfectiva(pb, 'crafteado').text || ''; } else {
                let p_open = (rec && rec.parentesis) ? rec.parentesis[0] : "("; let p_close = (rec && rec.parentesis) ? rec.parentesis[1] : ")"; let sep = rec ? rec.separador : " + "; 
                let txtInterno = piezasOrdenadasPorReceta(pb, rec).map(textoVisualPieza).join(sep);
                texto = pb.wrapper ? `${pb.wrapper.text}${p_open} ${txtInterno} ${p_close}` : (rec && rec.requeridos.length===0 ? `${p_open} ${txtInterno} ${p_close}` : txtInterno);
            }
        }
        let fragmentos = fragmentosVisualesBurbuja(pb);
        if (fragmentos.length > 0) dibujarFragmentosCentrados(pb.x, pb.y, fragmentos, radioVisual); else { ctx.fillStyle = "white"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(texto, pb.x, pb.y); }
    }
}

function drawHUD() {
    ctx.font = "24px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    let corazones = "❤️".repeat(Math.max(0, lives)) + "🤍".repeat(Math.max(0, 3 - lives)); ctx.fillText(corazones, 14, 12);
    const nivelVisible = indiceCircular(currentLevelIndex, niveles.length) + 1;
    ctx.fillStyle = "white"; ctx.font = "bold 17px 'Segoe UI'"; ctx.textAlign = "right"; ctx.fillText(`Nivel ${nivelVisible} / ${niveles.length}`, canvas.width - 14, 14);
}

function draw() {
    actualizarScoreDisplay();
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save();
    if (shakeTime > 0) { ctx.translate((Math.random()-0.5)*15, (Math.random()-0.5)*15); shakeTime--; }

    drawHUD();

    ctx.beginPath(); ctx.arc(DISPENSADOR.x, DISPENSADOR.y, DISPENSADOR.r + 20, 0, Math.PI*2); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();
    drawBubble(dispensadorBubble, true);
    alimentos.forEach(a => drawObj(a));
    floatingBubbles.forEach(b => drawBubble(b));
    if (draggedBubble) drawBubble(draggedBubble);

    particles.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); });

    floatingTexts.forEach(ft => {
        ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color; ctx.font = "bold 20px 'Segoe UI'"; ctx.textAlign = "center";
        ctx.lineWidth = 3; ctx.strokeStyle = "black"; ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillText(ft.text, ft.x, ft.y);
    });
    ctx.globalAlpha = 1; ctx.restore();

    if (gameState === 'GAMEOVER') {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff4757"; ctx.font = "bold 48px 'Segoe UI'"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2 - 20);
        ctx.fillStyle = "white"; ctx.font = "20px 'Segoe UI'"; ctx.fillText("Reiniciando...", canvas.width/2, canvas.height/2 + 30);
    } else if (gameState === 'WIN') {
        ctx.fillStyle = "rgba(0, 0, 0, 0.74)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const glow = 0.6 + 0.4 * Math.sin(performance.now() / 180);
        ctx.fillStyle = "#f1c40f"; ctx.shadowColor = "#f1c40f"; ctx.shadowBlur = 18 + 16 * glow;
        ctx.font = "bold 54px 'Segoe UI'"; ctx.fillText("HAS GANADO", canvas.width/2, canvas.height/2 - 54);
        ctx.shadowBlur = 0; ctx.fillStyle = "white"; ctx.font = "24px 'Segoe UI'";
        ctx.fillText("Completaste todos los niveles", canvas.width/2, canvas.height/2 + 4);
        ctx.fillStyle = "#b8bfcc"; ctx.font = "18px 'Segoe UI'";
        ctx.fillText(`Puntaje final: ${score}`, canvas.width/2, canvas.height/2 + 42);
        ctx.fillText("Toca o haz clic para jugar otra vez", canvas.width/2, canvas.height/2 + 78);
    }
}

function gameLoop() { if (destroyed) return; update(); draw(); frameId = requestAnimationFrame(gameLoop); }
montarKatexSiConfigurado(root).then(cargado => {
    if (!cargado || destroyed) return;
    mathCanvasCache.clear();
    actualizarObjetivoHTML();
}).catch(err => console.warn('[Math-io] Error al montar KaTeX.', err));
initLevel(0); gameLoop();
escuchar(window, 'resize', () => { redimensionarCanvas(); actualizarDispensadorYRelativos(); });

}

function iniciarTodosMathIO() { inyectarCSSMathIO(); document.querySelectorAll('[data-mathio-game]').forEach(iniciarMathIO); }
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', iniciarTodosMathIO); } else { iniciarTodosMathIO(); }
window.MathIO2Inicializar = iniciarTodosMathIO;
if (!window.MathIOInicializar) window.MathIOInicializar = iniciarTodosMathIO;
})();
