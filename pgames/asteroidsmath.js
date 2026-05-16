(function() {
    'use strict';

    const ASTEROIDS_MATEMATICO_CSS = `.jpa-asteroids-root {
    --bg-color: #0f172a;
    --panel-bg: #1e293b;
    --text-color: #f8fafc;
    --accent-color: #38bdf8;
    --error-color: #f43f5e;
    --success-color: #4ade80;
    --warning-color: #fbbf24;
    margin: 0 auto;
    padding: 0;
    display: flex;
    width: 100%;
    height: clamp(560px, 78vh, 820px);
    min-height: 560px;
    background-color: var(--bg-color);
    color: var(--text-color);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    position: relative;
    border-radius: 14px;
    isolation: isolate;
}
.jpa-asteroids-root,
.jpa-asteroids-root * {
    box-sizing: border-box;
}
.jpa-asteroids-root:fullscreen {
    width: 100vw;
    height: 100vh;
    min-height: 100vh;
    border-radius: 0;
}
.jpa-asteroids-root:-webkit-full-screen {
    width: 100vw;
    height: 100vh;
    min-height: 100vh;
    border-radius: 0;
}
.jpa-asteroids-root #sidebar {
    width: 300px;
    background-color: var(--panel-bg);
    padding: 20px;
    box-shadow: 2px 0 10px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    gap: 15px;
    z-index: 10;
    flex: 0 0 300px;
}
.jpa-asteroids-root h1 {
    font-size: 1.5rem;
    color: var(--accent-color);
    margin: 0;
    text-align: center;
    line-height: 1.2;
}
.jpa-asteroids-root .pregunta-box {
    background-color: rgba(56, 189, 248, 0.1);
    border: 1px solid var(--accent-color);
    padding: 15px;
    border-radius: 8px;
    font-size: 1.1rem;
    text-align: center;
    font-weight: bold;
}
.jpa-asteroids-root .controles-box {
    background-color: #334155;
    padding: 10px;
    border-radius: 8px;
    font-size: 0.85rem;
    text-align: left;
    color: #cbd5e1;
}
.jpa-asteroids-root .controles-box ul {
    margin: 5px 0 0 0;
    padding-left: 20px;
}
.jpa-asteroids-root .shield-container {
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.jpa-asteroids-root .shield-bar-bg {
    width: 100%;
    height: 20px;
    background-color: #334155;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #475569;
}
.jpa-asteroids-root .shield-bar-fill {
    height: 100%;
    width: 100%;
    background: linear-gradient(90deg, #38bdf8, #818cf8);
    transition: width 0.1s linear, background 0.3s ease;
}
.jpa-asteroids-root .stats {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 1.2rem;
    background-color: #0f172a;
    padding: 10px;
    border-radius: 8px;
}
.jpa-asteroids-root .stats span {
    font-weight: bold;
}
.jpa-asteroids-root #puntaje {
    color: var(--success-color);
}
.jpa-asteroids-root #objetivo {
    color: var(--warning-color);
}
.jpa-asteroids-root #mensaje {
    min-height: 24px;
    text-align: center;
    font-weight: bold;
    transition: color 0.3s;
}
.jpa-asteroids-root #game-container {
    flex-grow: 1;
    position: relative;
    background: radial-gradient(circle at center, #1e293b 0%, #020617 100%);
    min-width: 0;
}
.jpa-asteroids-root canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: crosshair;
}
.jpa-asteroids-root #overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(2, 6, 23, 0.85);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 20;
    color: white;
    padding: 1.5rem;
    text-align: center;
}
.jpa-asteroids-root #overlay h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin: 0 0 20px 0;
    text-align: center;
    line-height: 1.1;
}
.jpa-asteroids-root #overlay p {
    font-size: 1.2rem;
    margin-bottom: 30px;
    text-align: center;
}
.jpa-asteroids-root button {
    padding: 15px 30px;
    font-size: 1.2rem;
    font-weight: bold;
    background-color: var(--accent-color);
    color: #0f172a;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
    font-family: inherit;
}
.jpa-asteroids-root button:hover {
    background-color: #7dd3fc;
}
.jpa-asteroids-root .btn-sidebar {
    padding: 10px;
    font-size: 1rem;
    width: 100%;
    margin-top: auto;
}
.jpa-asteroids-root .jpa-asteroids-json {
    display: none !important;
}
@media (max-width: 768px) {
    .jpa-asteroids-root {
        flex-direction: column;
        height: 85vh;
        min-height: 620px;
    }
    .jpa-asteroids-root #sidebar {
        width: 100%;
        height: auto;
        max-height: 35vh;
        overflow-y: auto;
        flex-direction: row;
        flex-wrap: wrap;
        padding: 10px;
        flex: 0 0 auto;
    }
    .jpa-asteroids-root #sidebar > * {
        flex: 1 1 45%;
        margin: 0;
    }
    .jpa-asteroids-root h1 {
        font-size: 1.2rem;
        width: 100%;
        flex: 1 1 100%;
    }
    .jpa-asteroids-root .btn-sidebar {
        flex: 1 1 100%;
        margin-top: 10px;
    }
    .jpa-asteroids-root .controles-box {
        display: none;
    }
}`;

    function injectAsteroidsMatematicoCSS() {
        const styleId = 'jpa-asteroids-matematico-css-en-js';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = ASTEROIDS_MATEMATICO_CSS;
        document.head.appendChild(style);
    }

    function initAsteroidsMatematico(root) {
        if (!root || root.dataset.asteroidsInicializado === '1') return;
        root.dataset.asteroidsInicializado = '1';
        injectAsteroidsMatematicoCSS();

        const $id = (id) => root.querySelector('#' + id);


        
// ==========================================
// FUNCIONES DE PANTALLA COMPLETA
// ==========================================
function toggleFullScreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (root.requestFullscreen) root.requestFullscreen();
        else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
    // Evita que el botón de pantalla completa conserve el foco.
    // Si el botón queda enfocado, la tecla Espacio puede volver a activarlo.
    setTimeout(() => root.focus({ preventScroll: true }), 0);
}
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
function updateFullscreenButton() {
    const btn = $id('fullscreen-btn');
    if (!btn) return;
    const estaEnPantallaCompleta = document.fullscreenElement === root || document.webkitFullscreenElement === root;
    if (estaEnPantallaCompleta) btn.innerText = "🗗 Salir Pant. Completa";
    else btn.innerText = "⛶ Pantalla Completa";
}

// ==========================================
        // 0. SINTETIZADOR DE AUDIO
        // ==========================================
        let audioCtx; let engineOsc, engineGain, engineFilter;
        let lastEngineThrustState = null; let lastEnginePlayState = null;

        const SFX = {
            init: () => {
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === 'suspended') audioCtx.resume();
                SFX.initEngine();
            },
            initEngine: () => {
                if (!audioCtx || engineOsc) return;
                engineOsc = audioCtx.createOscillator(); engineGain = audioCtx.createGain(); engineFilter = audioCtx.createBiquadFilter();
                engineOsc.type = 'sawtooth'; engineOsc.frequency.setValueAtTime(45, audioCtx.currentTime); 
                engineFilter.type = 'lowpass'; engineFilter.frequency.setValueAtTime(250, audioCtx.currentTime);
                engineGain.gain.setValueAtTime(0, audioCtx.currentTime); 
                engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(audioCtx.destination);
                engineOsc.start();
            },
            updateEngine: (isThrusting, isPlaying) => {
                if (!engineGain || !engineOsc) return;
                if (lastEngineThrustState === isThrusting && lastEnginePlayState === isPlaying) return;
                lastEngineThrustState = isThrusting; lastEnginePlayState = isPlaying;
                const now = audioCtx.currentTime;
                if (!isPlaying) { engineGain.gain.setTargetAtTime(0, now, 0.1); return; }
                if (isThrusting) {
                    engineGain.gain.setTargetAtTime(0.08, now, 0.1); engineOsc.frequency.setTargetAtTime(90, now, 0.2); engineFilter.frequency.setTargetAtTime(400, now, 0.2);
                } else {
                    engineGain.gain.setTargetAtTime(0.02, now, 0.3); engineOsc.frequency.setTargetAtTime(40, now, 0.3); engineFilter.frequency.setTargetAtTime(200, now, 0.3);
                }
            },
            playTone: (freq, type, duration, vol=0.1) => {
                if (!audioCtx) return;
                const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
                osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                gain.gain.setValueAtTime(vol, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(); osc.stop(audioCtx.currentTime + duration);
            },
            shoot: () => {
                if (!audioCtx) return;
                const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
                osc.type = 'square'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.1);
            },
            correct: () => { SFX.playTone(440, 'sine', 0.2); setTimeout(() => SFX.playTone(554, 'sine', 0.2), 100); setTimeout(() => SFX.playTone(659, 'sine', 0.4), 200); },
            incorrect: () => { SFX.playTone(200, 'sawtooth', 0.3, 0.15); setTimeout(() => SFX.playTone(180, 'sawtooth', 0.4, 0.15), 150); },
            heal: () => { SFX.playTone(800, 'sine', 0.1); setTimeout(() => SFX.playTone(1200, 'sine', 0.3), 100); },
            damage: () => SFX.playTone(100, 'square', 0.2, 0.2),
            explosion: () => {
                if (!audioCtx) return;
                const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
                osc.type = 'square'; osc.frequency.setValueAtTime(100, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.3);
            },
            gameOver: () => { SFX.playTone(300, 'sawtooth', 0.3); setTimeout(() => SFX.playTone(250, 'sawtooth', 0.3), 200); setTimeout(() => SFX.playTone(200, 'sawtooth', 0.6), 400); },
            levelComplete: () => { SFX.playTone(440, 'square', 0.2); setTimeout(() => SFX.playTone(440, 'square', 0.2), 200); setTimeout(() => SFX.playTone(659, 'square', 0.5), 400); }
        };

        // ==========================================
        // 1. DATASET DE NIVELES (JSON)
        // ==========================================
        const niveles = JSON.parse(root.querySelector('.jpa-asteroids-json').value);

        // ==========================================
        // 2. VARIABLES GLOBALES, ESCALA Y EVENTOS
        // ==========================================
        const canvas = $id('gameCanvas'); const ctx = canvas.getContext('2d');
        const controlesBox = root.querySelector('.controles-box');
        if (controlesBox) {
            controlesBox.innerHTML = '<b>CONTROLES:</b><ul><li><b>PC:</b> Flechas/WASD para volar, Espacio para disparar.</li><li><b>Táctil:</b> Mantén y arrastra desde cualquier punto para volar. Mientras más lejos del centro inicial, más acelera. Doble toque para disparar.</li></ul>';
        }
        let width, height;
        let scaleFactor = 1; // Factor maestro de escala (Magia para móviles)

        let indiceNivelActual = 0; let nivelJSON; let gameState = 'START'; let animationFrameId;
        let nave; let balas = []; let asteroides = []; let particulas = [];
        let itemsCuracion = []; let seleccionados = []; let atraccionesActivas = []; let estrellas = [];
        let estadoParejas = {}; let puntaje = 0; let lastDisplayedShield = 100; 

        // Entradas táctiles: joystick invisible relativo + doble toque para disparar.
        // El punto donde se apoya el dedo se convierte en el centro del control.
        const pointer = {
            x: 0,
            y: 0,
            originX: 0,
            originY: 0,
            isDown: false,
            moved: false,
            downTime: 0,
            lastTapTime: 0,
            pointerId: null
        };

        function getCanvasPoint(event) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
        }

        function resetPointer() {
            pointer.isDown = false;
            pointer.moved = false;
            pointer.pointerId = null;
        }

        function clamp01(value) {
            return Math.max(0, Math.min(1, value));
        }

        function getTouchJoystick() {
            const dx = pointer.x - pointer.originX;
            const dy = pointer.y - pointer.originY;
            const dist = Math.hypot(dx, dy);

            // Joystick invisible con potencia progresiva.
            // deadZone: evita que un leve movimiento active la nave.
            // fullPowerRadius: distancia a la que se alcanza la potencia máxima.
            const deadZone = Math.max(20, 30 * scaleFactor);
            const fullPowerRadius = Math.max(105, 165 * scaleFactor);
            const rawPower = clamp01((dist - deadZone) / (fullPowerRadius - deadZone));

            // Curva suave: cerca del centro acelera poco; lejos acelera bastante.
            // Se deja una potencia mínima pequeña para que al salir de la zona muerta responda.
            const easedPower = rawPower * rawPower;
            const power = rawPower > 0 ? Math.max(0.12, easedPower) : 0;

            return {
                dx,
                dy,
                dist,
                deadZone,
                fullPowerRadius,
                rawPower,
                power,
                active: pointer.isDown && rawPower > 0
            };
        }

        canvas.addEventListener('pointerdown', e => {
            e.preventDefault();
            e.stopPropagation();
            root.focus({ preventScroll: true });

            const now = Date.now();
            const pos = getCanvasPoint(e);

            pointer.isDown = true;
            pointer.moved = false;
            pointer.downTime = now;
            pointer.pointerId = e.pointerId;
            pointer.originX = pos.x;
            pointer.originY = pos.y;
            pointer.x = pos.x;
            pointer.y = pos.y;

            if (canvas.setPointerCapture && e.pointerId !== undefined) {
                try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
            }

            // Disparo táctil: doble toque en cualquier parte de la pantalla.
            // Dispara hacia donde ya apunta la nave; no gira hacia el punto tocado.
            if (now - pointer.lastTapTime < 320 && gameState === 'PLAYING' && nave) {
                nave.shoot();
                pointer.lastTapTime = 0;
            } else {
                pointer.lastTapTime = now;
            }
        }, { passive: false });
        
        canvas.addEventListener('pointermove', e => {
            if (!pointer.isDown) return;
            if (pointer.pointerId !== null && e.pointerId !== pointer.pointerId) return;
            e.preventDefault();
            e.stopPropagation();

            const pos = getCanvasPoint(e);
            pointer.x = pos.x;
            pointer.y = pos.y;

            const joy = getTouchJoystick();
            if (joy.dist > joy.deadZone) pointer.moved = true;
        }, { passive: false });
        
        canvas.addEventListener('pointerup', e => {
            if (pointer.pointerId !== null && e.pointerId !== pointer.pointerId) return;
            e.preventDefault();
            e.stopPropagation();
            resetPointer();
        }, { passive: false });
        canvas.addEventListener('pointercancel', resetPointer);

        // Teclado
        const keys = {};

        // Moodle puede usar Espacio, flechas u otras teclas para abrir paneles laterales
        // o mover el foco. Mientras el juego está activo, esas teclas quedan reservadas
        // para el juego y se cancelan antes de que Moodle las capture.
        root.setAttribute('tabindex', '0');

        const GAME_KEY_CODES = new Set([
            'Space',
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'KeyW', 'KeyA', 'KeyS', 'KeyD'
        ]);

        function isEditableTarget(target) {
            if (!target) return false;
            const tag = (target.tagName || '').toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
        }

        function isRootFullscreen() {
            return document.fullscreenElement === root || document.webkitFullscreenElement === root;
        }

        function shouldCaptureGameKey(event) {
            if (!GAME_KEY_CODES.has(event.code)) return false;
            if (isEditableTarget(event.target)) return false;

            const active = document.activeElement;
            const focusInsideGame = active === root || root.contains(active);
            const eventInsideGame = event.target === root || root.contains(event.target);

            return isRootFullscreen() || focusInsideGame || eventInsideGame || gameState === 'PLAYING';
        }

        function handleGameKeyDown(event) {
            if (!shouldCaptureGameKey(event)) return;
            keys[event.code] = true;
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }

        function handleGameKeyUp(event) {
            if (!shouldCaptureGameKey(event)) return;
            keys[event.code] = false;
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }

        window.addEventListener('keydown', handleGameKeyDown, true);
        window.addEventListener('keyup', handleGameKeyUp, true);

        root.addEventListener('pointerdown', () => root.focus({ preventScroll: true }));

        // ==========================================
        // 3. CLASES DEL JUEGO (Con scaleFactor)
        // ==========================================
        class Nave {
            constructor(x, y, maxEscudo) {
                this.x = x; this.y = y; this.vx = 0; this.vy = 0;
                this.angle = -Math.PI / 2; this.turnSpeed = 0.08; this.friction = 0.95; 
                this.cooldown = 0; 
                this.escudoMaximo = maxEscudo; this.escudo = maxEscudo; this.invulnerable = 0; 
            }
            
            get radius() { return 15 * scaleFactor; } // Radio dinámico
            get thrust() { return 0.4 * scaleFactor; } // Propulsión dinámica
            get maxSpeed() { return 8 * scaleFactor; } // Límite de velocidad dinámica

            update() {
                if (gameState !== 'PLAYING') return;
                let isThrusting = keys['ArrowUp'] || keys['KeyW'];
                let thrustPower = isThrusting ? 1 : 0;

                // Control táctil con joystick invisible relativo.
                // El dedo no arrastra la nave: define dirección y potencia desde el punto inicial del toque.
                if (pointer.isDown) {
                    const joy = getTouchJoystick();
                    if (joy.active) {
                        const targetAngle = Math.atan2(joy.dy, joy.dx);
                        let diff = targetAngle - this.angle;
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        this.angle += diff * 0.15;
                        isThrusting = true;
                        thrustPower = Math.max(thrustPower, joy.power);
                    }
                } else {
                    if (keys['ArrowLeft'] || keys['KeyA']) this.angle -= this.turnSpeed;
                    if (keys['ArrowRight'] || keys['KeyD']) this.angle += this.turnSpeed;
                }
                
                SFX.updateEngine(isThrusting, true);
                let drain = nivelJSON.configuracion.drenajeEnergiaReposo;
                
                if (isThrusting) {
                    // En táctil, la aceleración y el gasto de energía dependen de la distancia al centro del joystick.
                    drain *= 1 + (1.5 * thrustPower); 
                    this.vx += Math.cos(this.angle) * this.thrust * thrustPower;
                    this.vy += Math.sin(this.angle) * this.thrust * thrustPower;
                    if(Math.random() < 0.2 + 0.4 * thrustPower) particulas.push(new Particula(this.x - Math.cos(this.angle) * this.radius, this.y - Math.sin(this.angle) * this.radius, '#f97316', true));
                }
                
                // Límite de Velocidad (Control)
                let currentSpeed = Math.hypot(this.vx, this.vy);
                if (currentSpeed > this.maxSpeed) {
                    let ratio = this.maxSpeed / currentSpeed;
                    this.vx *= ratio; this.vy *= ratio;
                }
                
                this.escudo -= drain; if (this.escudo <= 0) { this.escudo = 0; terminarJuego(false); }
                actualizarUIContinua();

                this.vx *= this.friction; this.vy *= this.friction; this.x += this.vx; this.y += this.vy;

                // Rebote Bordes
                if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.5; }
                if (this.x > width - this.radius) { this.x = width - this.radius; this.vx *= -0.5; }
                if (this.y < this.radius) { this.y = this.radius; this.vy *= -0.5; }
                if (this.y > height - this.radius) { this.y = height - this.radius; this.vy *= -0.5; }

                if (this.cooldown > 0) this.cooldown--; if (this.invulnerable > 0) this.invulnerable--;
                if (keys['Space'] && this.cooldown === 0) this.shoot();
            }

            shoot() {
                if(this.cooldown > 0) return;
                SFX.shoot();
                let noseX = this.x + Math.cos(this.angle) * this.radius * 1.5; 
                let noseY = this.y + Math.sin(this.angle) * this.radius * 1.5;
                balas.push(new Bala(noseX, noseY, this.angle)); this.cooldown = 15;
            }

            recibirDano(cantidad) {
                if (this.invulnerable > 0) return;
                SFX.damage(); this.escudo -= cantidad; if (this.escudo < 0) this.escudo = 0; this.invulnerable = 60; 
                crearExplosion(this.x, this.y, '#38bdf8'); actualizarUIContinua();
                if (this.escudo === 0) terminarJuego(false);
            }

            curar(cantidad) {
                SFX.heal(); this.escudo += cantidad; if (this.escudo > this.escudoMaximo) this.escudo = this.escudoMaximo;
                crearExplosion(this.x, this.y, '#4ade80'); mostrarMensaje(`+${cantidad} Energía`, "var(--success-color)"); actualizarUIContinua();
            }

            draw() {
                ctx.save(); ctx.translate(this.x, this.y);
                if (this.escudo > 0) {
                    ctx.beginPath(); ctx.arc(0, 0, this.radius + (12 * scaleFactor), 0, Math.PI * 2);
                    let alpha = (this.invulnerable > 0) ? (Math.sin(Date.now() / 50) * 0.3 + 0.3) : 0.2;
                    let pct = this.escudo / this.escudoMaximo;
                    if (pct > 0.5) { ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`; ctx.strokeStyle = `rgba(56, 189, 248, ${alpha + 0.4})`; } 
                    else if (pct > 0.25) { ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`; ctx.strokeStyle = `rgba(251, 191, 36, ${alpha + 0.4})`; } 
                    else {
                        let alertAlpha = alpha + (Math.sin(Date.now() / 100) * 0.2);
                        ctx.fillStyle = `rgba(244, 63, 94, ${alertAlpha})`; ctx.strokeStyle = `rgba(244, 63, 94, ${alertAlpha + 0.4})`;
                    }
                    ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
                }
                ctx.rotate(this.angle); 
                ctx.scale(scaleFactor, scaleFactor); // Escala el gráfico vectorial internamente
                
                ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-15, 12); ctx.lineTo(-10, 0); ctx.lineTo(-15, -12); ctx.closePath();
                if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) ctx.fillStyle = '#f43f5e'; else ctx.fillStyle = '#f8fafc';
                ctx.fill(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.stroke();
                
                const joyForFlame = getTouchJoystick();
                const flamePower = (keys['ArrowUp'] || keys['KeyW']) ? 1 : joyForFlame.power;
                if (flamePower > 0) {
                    const flameLength = 12 + 16 * flamePower;
                    const flameWobble = 4 + 7 * flamePower;
                    ctx.beginPath();
                    ctx.moveTo(-10, 0);
                    ctx.lineTo(-10 - flameLength, (Math.random() - 0.5) * flameWobble);
                    ctx.lineTo(-12, (Math.random() - 0.5) * 5);
                    ctx.fillStyle = '#fbbf24';
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        class ItemCuracion {
            constructor(x, y, valor) {
                this.x = x; this.y = y; this.valor = valor; 
                this.vx = (Math.random() - 0.5) * 3 * scaleFactor; this.vy = (Math.random() - 0.5) * 3 * scaleFactor; this.life = 600; 
            }
            get radius() { return 12 * scaleFactor; }
            update() {
                if (gameState !== 'PLAYING') return;
                this.x += this.vx; this.y += this.vy; this.life--;
                if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
                if (this.x > width - this.radius) { this.x = width - this.radius; this.vx *= -1; }
                if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
                if (this.y > height - this.radius) { this.y = height - this.radius; this.vy *= -1; }
            }
            draw() {
                if (this.life < 120 && Math.floor(this.life / 10) % 2 === 0) return;
                ctx.save(); ctx.translate(this.x, this.y); ctx.scale(scaleFactor, scaleFactor);
                ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.fillStyle = '#4ade80'; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 15; ctx.fill(); ctx.shadowBlur = 0;
                ctx.fillStyle = '#0f172a'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', 0, 1);
                ctx.restore();
            }
        }

        class Bala {
            constructor(x, y, angle) { 
                this.x = x; this.y = y; 
                let baseSpeed = 12 * scaleFactor;
                this.vx = Math.cos(angle) * baseSpeed; this.vy = Math.sin(angle) * baseSpeed; this.life = 60; 
            }
            get radius() { return 4 * scaleFactor; }
            update() { this.x += this.vx; this.y += this.vy; this.life--; }
            draw() { 
                ctx.save(); ctx.translate(this.x, this.y); ctx.scale(scaleFactor, scaleFactor);
                ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); 
                ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0; 
                ctx.restore();
            }
        }

        class Asteroide {
            constructor(x, y, vx, vy, id, idPareja, texto) {
                this.x = x; this.y = y; this.vx = vx; this.vy = vy;
                this.id = id; this.idPareja = idPareja; this.texto = texto; 
                this.baseRadius = 40; // Tamaño lógico base
                this.estado = 'normal'; this.rotation = Math.random() * Math.PI * 2; this.vRot = (Math.random() - 0.5) * 0.05;
                this.offsets = Array.from({length: 8}, () => Math.random() * 0.4 + 0.8);
            }
            get radius() { return this.baseRadius * scaleFactor; }
            
            update() {
                if (gameState !== 'PLAYING') return;
                let speed = Math.hypot(this.vx, this.vy); 
                let velBase = nivelJSON.configuracion.velocidadAsteroides * scaleFactor; // Velocidad responsiva
                
                if (speed > velBase) { this.vx *= 0.98; this.vy *= 0.98; } 
                else if (speed > 0 && speed < velBase - 0.2) { let ratio = (speed + 0.05) / speed; this.vx *= ratio; this.vy *= ratio; }
                
                this.x += this.vx; this.y += this.vy; this.rotation += this.vRot;
                if (this.x - this.radius < 0) { this.x = this.radius; this.vx *= -1; }
                if (this.x + this.radius > width) { this.x = width - this.radius; this.vx *= -1; }
                if (this.y - this.radius < 0) { this.y = this.radius; this.vy *= -1; }
                if (this.y + this.radius > height) { this.y = height - this.radius; this.vy *= -1; }
            }
            draw() {
                ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation); ctx.scale(scaleFactor, scaleFactor);
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    let angle = (i / 8) * Math.PI * 2; let r = this.baseRadius * this.offsets[i]; 
                    let px = Math.cos(angle) * r; let py = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fillStyle = '#334155'; ctx.fill();
                if (this.estado === 'seleccionado') { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 15; } 
                else { ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.shadowBlur = 0; }
                ctx.stroke(); ctx.restore(); 
                
                // Texto alineado (sin rotar)
                ctx.save(); ctx.translate(this.x, this.y); ctx.scale(scaleFactor, scaleFactor);
                ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
                ctx.fillText(this.texto, 0, 0);
                ctx.restore();
            }
        }

        class Particula {
            constructor(x, y, color, cortaVida = false) {
                this.x = x; this.y = y; 
                this.vx = (Math.random() - 0.5) * 8 * scaleFactor; this.vy = (Math.random() - 0.5) * 8 * scaleFactor;
                this.life = 1.0; this.decay = cortaVida ? 0.05 : 0.02; this.color = color; 
                this.size = (Math.random() * 4 + 2) * scaleFactor;
            }
            update() { if (gameState !== 'PLAYING') return; this.x += this.vx; this.y += this.vy; this.life -= this.decay; }
            draw() { ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0; }
        }

        // ==========================================
        // 4. INICIALIZACIÓN Y ESCALADO (Magia UI)
        // ==========================================
        function initStars() {
            estrellas = [];
            for(let i=0; i<150; i++) estrellas.push({ x: Math.random() * width, y: Math.random() * height, size: Math.random() * 1.5 + 0.5, layer: Math.floor(Math.random() * 3) + 1 });
        }
        function resize() { 
            width = canvas.parentElement.clientWidth; height = canvas.parentElement.clientHeight; canvas.width = width; canvas.height = height; 
            
            // Factor base: Diseñado para una pantalla lógica de 800px. 
            // Math.min asegura que si estás en celular (ej. 390x844), achique todo.
            scaleFactor = Math.min(width, height) / 800;
            // Limitamos para que no sea absurdamente chico ni gigante
            scaleFactor = Math.max(0.4, Math.min(scaleFactor, 1.3));

            if(estrellas.length === 0) initStars();
        }
        window.addEventListener('resize', resize);

        function iniciarPrimerNivel() { root.focus({ preventScroll: true }); SFX.init(); cargarNivel(0); }

        function cargarNivel(index) {
            if (index >= niveles.length) {
                SFX.updateEngine(false, false); SFX.levelComplete();
                $id('overlay-title').innerText = "¡JUEGO COMPLETADO!"; $id('overlay-title').style.color = "var(--success-color)";
                $id('overlay-desc').innerText = "¡Eres un maestro matemático arcade!";
                $id('overlay-btn').innerText = "Volver a jugar"; $id('overlay-btn').onclick = () => cargarNivel(0);
                $id('overlay').style.display = 'flex'; return;
            }
            indiceNivelActual = index; nivelJSON = niveles[indiceNivelActual];
            puntaje = 0; asteroides = []; balas = []; particulas = []; itemsCuracion = []; seleccionados = []; atraccionesActivas = []; estadoParejas = {}; 
            $id('overlay').style.display = 'none'; resize();
            nave = new Nave(width / 2, height / 2, nivelJSON.configuracion.escudoMaximo); lastDisplayedShield = nave.escudo;
            $id('titulo-nivel').innerText = nivelJSON.titulo; $id('pregunta-lateral').innerText = nivelJSON.preguntaLateral;
            $id('objetivo').innerText = nivelJSON.configuracion.puntajeObjetivo; $id('puntaje').innerText = puntaje;
            actualizarUIContinua();
            nivelJSON.parejasDataset.forEach(p => estadoParejas[p.idPareja] = 'disponible');
            for (let i = 0; i < nivelJSON.configuracion.parejasIniciales; i++) spawnPareja();
            gameState = 'PLAYING'; if (!animationFrameId) loop();
        }

        function actualizarUIContinua() {
            let porcentaje = Math.max(0, (nave.escudo / nave.escudoMaximo) * 100); let fill = $id('shield-fill'); fill.style.width = porcentaje + "%";
            if (porcentaje > 50) fill.style.background = "linear-gradient(90deg, #38bdf8, #818cf8)"; else if (porcentaje > 25) fill.style.background = "linear-gradient(90deg, #fbbf24, #f59e0b)"; else fill.style.background = "linear-gradient(90deg, #f43f5e, #e11d48)";
            let roundedShield = Math.round(porcentaje);
            if(roundedShield !== lastDisplayedShield) { $id('shield-text').innerText = roundedShield + "%"; lastDisplayedShield = roundedShield; }
        }

        function terminarJuego(victoria) {
            gameState = victoria ? 'LEVEL_COMPLETE' : 'GAMEOVER'; SFX.updateEngine(false, false); 
            const overlay = $id('overlay'); const title = $id('overlay-title'); const desc = $id('overlay-desc'); const btn = $id('overlay-btn');
            overlay.style.display = 'flex';
            if (victoria) {
                SFX.levelComplete(); title.innerText = "¡Nivel Superado!"; title.style.color = "var(--success-color)"; desc.innerText = `Alcanzaste el objetivo de ${nivelJSON.configuracion.puntajeObjetivo} puntos.`; btn.innerText = "Siguiente Nivel"; btn.onclick = () => cargarNivel(indiceNivelActual + 1);
            } else {
                SFX.gameOver(); title.innerText = "Nave Destruida"; title.style.color = "var(--error-color)"; desc.innerText = "Te quedaste sin energía."; btn.innerText = "Reintentar Nivel"; btn.onclick = () => cargarNivel(indiceNivelActual);
            }
        }

        function getParejasActivasCount() { return Object.values(estadoParejas).filter(e => e === 'activa').length; }
        
        function spawnPareja() {
            const disponibles = nivelJSON.parejasDataset.filter(p => estadoParejas[p.idPareja] === 'disponible');
            if (disponibles.length === 0) {
                if (nivelJSON.configuracion.modoReposicion === "puede_repetirse") { nivelJSON.parejasDataset.forEach(p => { if (estadoParejas[p.idPareja] !== 'activa') estadoParejas[p.idPareja] = 'disponible'; }); return spawnPareja(); } return;
            }
            const pareja = disponibles[Math.floor(Math.random() * disponibles.length)]; estadoParejas[pareja.idPareja] = 'activa'; 
            const velBase = nivelJSON.configuracion.velocidadAsteroides * scaleFactor;
            pareja.asteroides.forEach(astData => {
                let x, y; do { x = Math.random() * (width - 100) + 50; y = Math.random() * (height - 100) + 50; } while (Math.hypot(x - nave.x, y - nave.y) < 150 * scaleFactor); // Evitar spawn encima de la nave
                asteroides.push(new Asteroide(x, y, (Math.random() - 0.5) * velBase * 2, (Math.random() - 0.5) * velBase * 2, astData.id, pareja.idPareja, astData.texto));
            });
        }

        function crearExplosion(x, y, color) { for (let i = 0; i < 30; i++) particulas.push(new Particula(x, y, color)); }
        function mostrarMensaje(texto, color) { const msg = $id('mensaje'); msg.innerText = texto; msg.style.color = color; setTimeout(() => { if(msg.innerText === texto) msg.innerText = ''; }, 2000); }

        function evaluarSeleccion() {
            if (seleccionados.length !== 2) return; const [a, b] = seleccionados;
            if (a.idPareja === b.idPareja) {
                SFX.correct(); mostrarMensaje("¡Correcto! Se atraen", "var(--success-color)");
                a.estado = 'normal'; b.estado = 'normal'; atraccionesActivas.push({ a, b });
            } else {
                SFX.incorrect(); mostrarMensaje("¡Error! Se repelen", "var(--error-color)");
                a.estado = 'normal'; b.estado = 'normal';
                let dx = b.x - a.x; let dy = b.y - a.y; let dist = Math.hypot(dx, dy) || 1; let fuerza = nivelJSON.configuracion.fuerzaRepulsion * scaleFactor;
                a.vx = -(dx / dist) * fuerza; a.vy = -(dy / dist) * fuerza; b.vx = (dx / dist) * fuerza;  b.vy = (dy / dist) * fuerza;
                if (Math.random() < nivelJSON.configuracion.probabilidadSpawnPorError) {
                    if (getParejasActivasCount() < nivelJSON.configuracion.maxParejasActivas) { setTimeout(() => spawnPareja(), 500); mostrarMensaje("¡Atrajiste más asteroides!", "var(--error-color)"); }
                }
            }
            seleccionados = [];
        }

        // ==========================================
        // 5. MOTOR FÍSICO
        // ==========================================
        function updatePhysics() {
            if (gameState !== 'PLAYING') { estrellas.forEach(s => { s.y += 0.1 * s.layer; if (s.y > height) s.y = 0; }); return; }
            nave.update();
            estrellas.forEach(s => {
                s.x -= nave.vx * (s.layer * 0.15); s.y -= nave.vy * (s.layer * 0.15); s.y += 0.1 * s.layer;
                if (s.x < 0) s.x = width; if (s.x > width) s.x = 0; if (s.y < 0) s.y = height; if (s.y > height) s.y = 0;
            });
            asteroides.forEach(ast => {
                let dist = Math.hypot(nave.x - ast.x, nave.y - ast.y);
                if (dist < ast.radius + nave.radius) {
                    let angleRebote = Math.atan2(nave.y - ast.y, nave.x - ast.x);
                    nave.vx += Math.cos(angleRebote) * 5 * scaleFactor; nave.vy += Math.sin(angleRebote) * 5 * scaleFactor;
                    ast.vx -= Math.cos(angleRebote) * 2 * scaleFactor; ast.vy -= Math.sin(angleRebote) * 2 * scaleFactor; 
                    nave.recibirDano(nivelJSON.configuracion.dañoChoque);
                }
            });
            for (let i = itemsCuracion.length - 1; i >= 0; i--) {
                let item = itemsCuracion[i]; item.update(); if (item.life <= 0) { itemsCuracion.splice(i, 1); continue; }
                if (Math.hypot(nave.x - item.x, nave.y - item.y) < nave.radius + item.radius) { nave.curar(item.valor); itemsCuracion.splice(i, 1); }
            }
            for (let i = balas.length - 1; i >= 0; i--) {
                let b = balas[i]; b.update(); if (b.life <= 0) { balas.splice(i, 1); continue; }
                for (let j = 0; j < asteroides.length; j++) {
                    let ast = asteroides[j]; if (atraccionesActivas.some(par => par.a === ast || par.b === ast)) continue;
                    if (Math.hypot(b.x - ast.x, b.y - ast.y) < ast.radius) {
                        crearExplosion(b.x, b.y, '#fbbf24'); balas.splice(i, 1); 
                        if (ast.estado === 'seleccionado') { ast.estado = 'normal'; seleccionados = seleccionados.filter(s => s !== ast); } 
                        else { if (seleccionados.length < 2) { ast.estado = 'seleccionado'; seleccionados.push(ast); evaluarSeleccion(); } }
                        break; 
                    }
                }
            }
            asteroides.forEach(ast => ast.update());
            for (let i = atraccionesActivas.length - 1; i >= 0; i--) {
                let p = atraccionesActivas[i]; let dx = p.b.x - p.a.x; let dy = p.b.y - p.a.y; let dist = Math.hypot(dx, dy);
                if (dist < p.a.radius + p.b.radius) {
                    SFX.explosion(); let centroX = (p.a.x + p.b.x) / 2; let centroY = (p.a.y + p.b.y) / 2;
                    crearExplosion(centroX, centroY, '#4ade80'); itemsCuracion.push(new ItemCuracion(centroX, centroY, nivelJSON.configuracion.potenciaRecuperacion));
                    puntaje += 100; $id('puntaje').innerText = puntaje;
                    asteroides = asteroides.filter(ast => ast !== p.a && ast !== p.b);
                    if(nivelJSON.configuracion.modoReposicion === "sin_repetir_en_nivel") estadoParejas[p.a.idPareja] = 'resuelta'; else estadoParejas[p.a.idPareja] = 'disponible';
                    atraccionesActivas.splice(i, 1);
                    if (puntaje >= nivelJSON.configuracion.puntajeObjetivo) terminarJuego(true); else if (getParejasActivasCount() < nivelJSON.configuracion.parejasIniciales) spawnPareja();
                } else {
                    let fuerza = nivelJSON.configuracion.fuerzaAtraccion * scaleFactor; p.a.vx *= 0.95; p.a.vy *= 0.95; p.b.vx *= 0.95; p.b.vy *= 0.95;
                    p.a.vx += (dx / dist) * fuerza; p.a.vy += (dy / dist) * fuerza; p.b.vx -= (dx / dist) * fuerza; p.b.vy -= (dy / dist) * fuerza;
                }
            }
            for (let i = particulas.length - 1; i >= 0; i--) { particulas[i].update(); if (particulas[i].life <= 0) particulas.splice(i, 1); }
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#ffffff';
            estrellas.forEach(s => { ctx.globalAlpha = s.layer / 3; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1.0;
            atraccionesActivas.forEach(p => { ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)'; ctx.lineWidth = 3; ctx.stroke(); });
            itemsCuracion.forEach(i => i.draw()); balas.forEach(b => b.draw()); asteroides.forEach(ast => ast.draw()); particulas.forEach(p => p.draw());
            if (gameState === 'PLAYING') nave.draw();
        }

        function loop() { updatePhysics(); draw(); animationFrameId = requestAnimationFrame(loop); }
        $id('fullscreen-btn').onclick = toggleFullScreen;
        $id('overlay-btn').onclick = iniciarPrimerNivel;
        resize();
    }

    function bootAsteroidsMatematico() {
        document.querySelectorAll('.jpa-asteroids-root[data-asteroids-matematico]').forEach(initAsteroidsMatematico);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAsteroidsMatematico);
    } else {
        bootAsteroidsMatematico();
    }
})();
