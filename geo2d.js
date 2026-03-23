/* =========================================================
   GEO2D EDITOR V1
   ---------------------------------------------------------
   Un solo script JavaScript que:
   - crea el layout del editor
   - renderiza una escena geométrica 2D en SVG
   - permite edición visual básica
   - permite edición JSON
   - permite cargar / guardar / publicar
   - expone comandos simples como:
       Geo2D.openEditor(...)
       Geo2D.openViewer(...)
   ---------------------------------------------------------
   NOTA HONESTA:
   Esta V1 es funcional y está pensada como base real.
   Incluye:
   - puntos
   - segmentos
   - rectas
   - circunferencias
   - polígonos
   - puntos medios
   - medidas simples
   - edición visual
   - edición JSON
   - publicación HTML
   ---------------------------------------------------------
   Está comentada por bloques para que sea fácil de seguir.
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     PARTE 1. UTILIDADES GENERALES
     ========================================================= */

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function dist2(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  function dist(x1, y1, x2, y2) {
    return Math.sqrt(dist2(x1, y1, x2, y2));
  }

  function safeNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function slugify(text) {
    return String(text || 'escena-geo2d')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'escena-geo2d';
  }

  function downloadTextFile(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return Promise.resolve();
  }

  function ensureScene(scene) {
    const base = {
      version: 1,
      meta: {
        title: 'Escena Geo2D',
        author: '',
        description: ''
      },
      viewport: {
        xMin: -10,
        xMax: 10,
        yMin: -10,
        yMax: 10,
        showGrid: true,
        showAxes: true,
        lockAspect: false
      },
      style: {
        pointRadius: 5,
        strokeWidth: 2,
        fontSize: 14
      },
      objects: []
    };

    const out = deepClone(base);

    if (scene && typeof scene === 'object') {
      if (typeof scene.version === 'number') out.version = scene.version;
      if (scene.meta && typeof scene.meta === 'object') {
        out.meta = { ...out.meta, ...scene.meta };
      }
      if (scene.viewport && typeof scene.viewport === 'object') {
        out.viewport = { ...out.viewport, ...scene.viewport };
      }
      if (scene.style && typeof scene.style === 'object') {
        out.style = { ...out.style, ...scene.style };
      }
      if (Array.isArray(scene.objects)) {
        out.objects = deepClone(scene.objects);
      }
    }

    return out;
  }

  function parseSceneText(text) {
    let raw = String(text || '').trim();

    if (!raw) {
      throw new Error('No hay contenido para cargar.');
    }

    const scriptJsonMatch = raw.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (scriptJsonMatch) {
      raw = scriptJsonMatch[1].trim();
    }

    const dataSceneMatch = raw.match(/data-scene='([\s\S]*?)'/i) || raw.match(/data-scene="([\s\S]*?)"/i);
    if (dataSceneMatch) {
      raw = dataSceneMatch[1].trim();
      raw = raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    }

    const scene = JSON.parse(raw);
    return ensureScene(scene);
  }

  function jsonPretty(obj) {
    return JSON.stringify(obj, null, 2);
  }

  function defaultScene() {
    return ensureScene({
      meta: {
        title: 'Nueva escena'
      },
      objects: [
        { id: 'A', type: 'point', x: -3, y: 1, label: 'A', draggable: true, style: { fill: '#ff6200' } },
        { id: 'B', type: 'point', x: 3, y: 2, label: 'B', draggable: true, style: { fill: '#ff6200' } },
        { id: 'sAB', type: 'segment', p1: 'A', p2: 'B', style: { stroke: '#1976d2' } },
        { id: 'M', type: 'midpoint', p1: 'A', p2: 'B', label: 'M', style: { fill: '#2e7d32' } },
        { id: 'mAB', type: 'measure', measureType: 'distance', of: ['A', 'B'], label: 'AB' }
      ]
    });
  }

  /* =========================================================
     PARTE 2. ESTILOS CSS DEL EDITOR
     ========================================================= */

function injectStylesOnce() {
    if (document.getElementById('geo2d-editor-styles')) return;

    const style = document.createElement('style');
    style.id = 'geo2d-editor-styles';
    style.textContent = `
      /* =========================================================
         RESET Y VARIABLES BLINDADAS CONTRA MOODLE
         ========================================================= */
      div.geo2d-root {
        --geo-border: #d7dce3;
        --geo-bg: #ffffff;
        --geo-soft: #f6f8fb;
        --geo-text: #1f2937;
        --geo-muted: #6b7280;
        --geo-primary: #ff6200;       /* Tu naranja institucional */
        --geo-primary-light: #fff0e6; /* Naranja muy suave */
        
        all: initial !important; /* Reseteo total del contenedor */
        display: block !important;
        font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important;
        color: var(--geo-text) !important;
        background-color: var(--geo-bg) !important;
        border: 1px solid var(--geo-border) !important;
        border-radius: 14px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        width: 100% !important;
        line-height: 1.5 !important;
      }

   div.geo2d-root *,
div.geo2d-root *::before,
div.geo2d-root *::after {
  box-sizing: border-box !important;
}

div.geo2d-root button {
  font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important;
}

      /* =========================================================
         BARRA SUPERIOR (TOOLBAR)
         ========================================================= */
      div.geo2d-root .geo2d-toolbar {
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        padding: 12px !important;
        background-color: var(--geo-soft) !important;
        border-bottom: 1px solid var(--geo-border) !important;
      }

      div.geo2d-root .geo2d-toolbar button,
      div.geo2d-root .geo2d-toolbar select,
      div.geo2d-root .geo2d-toolbar input[type="text"] {
        appearance: none !important;
        background-color: #ffffff !important;
        color: var(--geo-text) !important;
        border: 1px solid var(--geo-border) !important;
        border-radius: 10px !important;
        padding: 8px 12px !important;
        font-size: 14px !important;
        font-family: inherit !important;
        cursor: pointer !important;
        margin: 0 !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }

      div.geo2d-root .geo2d-toolbar button:hover {
        background-color: #f0f0f0 !important;
      }

      /* =========================================================
         MENÚ LATERAL DE HERRAMIENTAS
         ========================================================= */
      div.geo2d-root .geo2d-body {
        display: grid !important;
        grid-template-columns: 180px 1fr !important;
        min-height: 640px !important;
      }

      div.geo2d-root .geo2d-side {
        border-right: 1px solid var(--geo-border) !important;
        background-color: #fbfcfe !important;
        padding: 12px !important;
      }

      div.geo2d-root .geo2d-side h3 {
        margin: 0 0 10px 0 !important;
        font-size: 13px !important;
        color: var(--geo-muted) !important;
        text-transform: uppercase !important;
        letter-spacing: .05em !important;
        font-weight: bold !important;
        border: none !important;
        padding: 0 !important;
        background: transparent !important;
      }

      div.geo2d-root .geo2d-toolgrid {
        display: grid !important;
        gap: 8px !important;
      }


/* --- BOTONES DE HERRAMIENTA (INACTIVOS) --- */
div.geo2d-root .geo2d-side .geo2d-toolgrid > button,
div.geo2d-root .geo2d-side .geo2d-toolgrid > button[data-tool],
div.geo2d-root .geo2d-side .geo2d-toolgrid > button:not(.active) {
  appearance: none !important;
  -webkit-appearance: none !important;
  display: block !important;
  width: 100% !important;
  min-height: 42px !important;
  padding: 10px 12px !important;
  margin: 0 !important;

  background: #fff0e6 !important;
  background-color: #fff0e6 !important;
  background-image: none !important;

  color: #ff6200 !important;
  -webkit-text-fill-color: #ff6200 !important;

  border: 1px solid #d7dce3 !important;
  border-radius: 10px !important;

  text-align: left !important;
  font: 600 14px/1.25 'Segoe UI', Arial, Helvetica, sans-serif !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  text-indent: 0 !important;
  white-space: normal !important;

  opacity: 1 !important;
  box-shadow: none !important;
  text-shadow: none !important;
  filter: none !important;
}

/* Hover botones inactivos */
div.geo2d-root .geo2d-side .geo2d-toolgrid > button:hover:not(.active) {
  background: #ffe0cc !important;
  background-color: #ffe0cc !important;
  color: #ff6200 !important;
  -webkit-text-fill-color: #ff6200 !important;
}

/* --- BOTONES DE HERRAMIENTA (ACTIVOS) --- */
div.geo2d-root .geo2d-side .geo2d-toolgrid > button.active,
div.geo2d-root .geo2d-side .geo2d-toolgrid > button[data-tool].active {
  background: #ff6200 !important;
  background-color: #ff6200 !important;
  background-image: none !important;

  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;

  border-color: #ff6200 !important;
  opacity: 1 !important;
  box-shadow: 0 2px 6px rgba(255, 98, 0, 0.30) !important;
}








      /* =========================================================
         ÁREA PRINCIPAL Y PESTAÑAS (TABS)
         ========================================================= */
      div.geo2d-root .geo2d-main {
        display: grid !important;
        grid-template-rows: auto 1fr !important;
        min-width: 0 !important;
      }

      div.geo2d-root .geo2d-tabs {
        display: flex !important;
        gap: 8px !important;
        padding: 12px 12px 0 12px !important;
        background-color: #ffffff !important;
        margin: 0 !important;
        border: none !important;
      }

      div.geo2d-root .geo2d-tab {
        appearance: none !important;
        background-color: #f7f9fc !important;
        color: var(--geo-muted) !important;
        border: 1px solid var(--geo-border) !important;
        border-bottom: none !important;
        border-radius: 10px 10px 0 0 !important;
        padding: 8px 16px !important;
        font-size: 14px !important;
        font-weight: normal !important;
        cursor: pointer !important;
        margin: 0 !important;
      }

      div.geo2d-root .geo2d-tab.active {
        background-color: #ffffff !important;
        color: var(--geo-text) !important;
        font-weight: bold !important;
        border-bottom: 1px solid #ffffff !important;
        margin-bottom: -1px !important; /* Solapa el borde inferior */
        z-index: 2 !important;
        position: relative !important;
      }

      /* =========================================================
         PANELES DE CONTENIDO (LIENZO SVG Y JSON)
         ========================================================= */
      div.geo2d-root .geo2d-panels {
        border-top: 1px solid var(--geo-border) !important;
        min-height: 0 !important;
        display: grid !important;
        background-color: #ffffff !important;
      }

      div.geo2d-root .geo2d-panel {
        display: none !important;
        min-height: 0 !important;
      }

      div.geo2d-root .geo2d-panel.active {
        display: block !important;
      }

      div.geo2d-root .geo2d-visual-wrap {
        display: grid !important;
        grid-template-rows: 1fr auto !important;
        height: 100% !important;
      }

      div.geo2d-root .geo2d-canvas-wrap {
        min-height: 500px !important;
        background-color: #ffffff !important;
        position: relative !important;
      }

      div.geo2d-root .geo2d-canvas-wrap svg {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        background-color: transparent !important;
        touch-action: none !important;
      }

      div.geo2d-root .geo2d-status {
        padding: 10px 12px !important;
        border-top: 1px solid var(--geo-border) !important;
        background-color: #fafbfd !important;
        color: var(--geo-muted) !important;
        font-size: 13px !important;
        margin: 0 !important;
      }

      div.geo2d-root .geo2d-json-wrap {
        display: grid !important;
        grid-template-rows: 1fr auto !important;
        height: 100% !important;
      }

      div.geo2d-root .geo2d-json-wrap textarea {
        width: 100% !important;
        min-height: 500px !important;
        resize: vertical !important;
        border: none !important;
        outline: none !important;
        padding: 16px !important;
        font-family: Consolas, Monaco, 'Courier New', monospace !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        background-color: #ffffff !important;
        color: var(--geo-text) !important;
        margin: 0 !important;
      }

      div.geo2d-root .geo2d-json-actions {
        display: flex !important;
        gap: 8px !important;
        padding: 12px !important;
        border-top: 1px solid var(--geo-border) !important;
        background-color: #fafbfd !important;
      }

      div.geo2d-root .geo2d-json-actions button {
        appearance: none !important;
        background-color: #ffffff !important;
        color: var(--geo-text) !important;
        border: 1px solid var(--geo-border) !important;
        border-radius: 8px !important;
        padding: 6px 12px !important;
        cursor: pointer !important;
      }

      /* =========================================================
         ELEMENTOS SVG (Textos)
         ========================================================= */
      div.geo2d-root .geo2d-legendline {
        font-size: 12px !important;
        fill: #374151 !important;
        font-family: Arial, sans-serif !important;
      }

      div.geo2d-root .geo2d-measure-label {
        font-size: 12px !important;
        fill: #374151 !important;
        paint-order: stroke !important;
        stroke: #ffffff !important;
        stroke-width: 3px !important;
        font-family: Arial, sans-serif !important;
        font-weight: bold !important;
      }

      /* =========================================================
         MODAL DE PUBLICACIÓN
         ========================================================= */
      .geo2d-modal-backdrop {
        position: fixed !important;
        inset: 0 !important;
        background-color: rgba(0,0,0,0.5) !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 999999 !important; /* Muy alto para superar Moodle */
        padding: 16px !important;
      }

      .geo2d-modal-backdrop.open {
        display: flex !important;
      }

      .geo2d-modal {
        width: min(900px, 96vw) !important;
        max-height: 90vh !important;
        background-color: #ffffff !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important;
        display: grid !important;
        grid-template-rows: auto 1fr auto !important;
        overflow: hidden !important;
      }

      .geo2d-modal-head,
      .geo2d-modal-foot {
        padding: 16px !important;
        border-bottom: 1px solid #d7dce3 !important;
        background-color: #f6f8fb !important;
      }

      .geo2d-modal-foot {
        border-bottom: none !important;
        border-top: 1px solid #d7dce3 !important;
        display: flex !important;
        gap: 8px !important;
      }

      .geo2d-modal-foot button {
        appearance: none !important;
        background-color: #ffffff !important;
        color: #1f2937 !important;
        border: 1px solid #d7dce3 !important;
        border-radius: 8px !important;
        padding: 8px 16px !important;
        cursor: pointer !important;
      }

      .geo2d-modal textarea {
        width: 100% !important;
        height: 50vh !important;
        border: none !important;
        outline: none !important;
        resize: none !important;
        padding: 16px !important;
        background-color: #ffffff !important;
        color: #1f2937 !important;
        font-family: Consolas, monospace !important;
        font-size: 14px !important;
      }

      .geo2d-hidden {
        display: none !important;
      }

      /* =========================================================
         RESPONSIVE
         ========================================================= */
      @media (max-width: 900px) {
        div.geo2d-root .geo2d-body {
          grid-template-columns: 1fr !important;
        }
        div.geo2d-root .geo2d-side {
          border-right: none !important;
          border-bottom: 1px solid #d7dce3 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }


   
  /* =========================================================
     PARTE 3. MOTOR DE COORDENADAS Y SVG
     ========================================================= */

  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }

  function worldToScreen(vp, w, h, x, y) {
    const sx = (x - vp.xMin) / (vp.xMax - vp.xMin) * w;
    const sy = h - (y - vp.yMin) / (vp.yMax - vp.yMin) * h;
    return { x: sx, y: sy };
  }

  function screenToWorld(vp, w, h, sx, sy) {
    const x = vp.xMin + (sx / w) * (vp.xMax - vp.xMin);
    const y = vp.yMin + ((h - sy) / h) * (vp.yMax - vp.yMin);
    return { x, y };
  }

  function viewportZoom(vp, factor, cx, cy) {
    const nxMin = cx + (vp.xMin - cx) * factor;
    const nxMax = cx + (vp.xMax - cx) * factor;
    const nyMin = cy + (vp.yMin - cy) * factor;
    const nyMax = cy + (vp.yMax - cy) * factor;
    return {
      ...vp,
      xMin: nxMin,
      xMax: nxMax,
      yMin: nyMin,
      yMax: nyMax
    };
  }

  function viewportPan(vp, dx, dy) {
    return {
      ...vp,
      xMin: vp.xMin + dx,
      xMax: vp.xMax + dx,
      yMin: vp.yMin + dy,
      yMax: vp.yMax + dy
    };
  }

  function niceStep(span) {
    const target = span / 10;
    const pow = Math.pow(10, Math.floor(Math.log10(target || 1)));
    const n = target / pow;
    let nice = 1;
    if (n > 5) nice = 10;
    else if (n > 2) nice = 5;
    else if (n > 1) nice = 2;
    return nice * pow;
  }

  /* =========================================================
     PARTE 4. RESOLUCIÓN DE OBJETOS GEOMÉTRICOS
     ========================================================= */

  function buildObjectMap(scene) {
    const map = new Map();
    scene.objects.forEach(obj => map.set(obj.id, obj));
    return map;
  }

  function mergeStyle(scene, obj, extra = {}) {
    const globalStyle = scene.style || {};
    return {
      stroke: '#222',
      fill: 'none',
      strokeWidth: globalStyle.strokeWidth || 2,
      pointRadius: globalStyle.pointRadius || 5,
      fontSize: globalStyle.fontSize || 14,
      ...obj.style,
      ...extra
    };
  }

  function extendLineToViewport(vp, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const eps = 1e-9;
    const pts = [];

    if (Math.abs(dx) > eps) {
      const t1 = (vp.xMin - p1.x) / dx;
      const y1 = p1.y + t1 * dy;
      if (y1 >= vp.yMin - eps && y1 <= vp.yMax + eps) pts.push({ x: vp.xMin, y: y1 });

      const t2 = (vp.xMax - p1.x) / dx;
      const y2 = p1.y + t2 * dy;
      if (y2 >= vp.yMin - eps && y2 <= vp.yMax + eps) pts.push({ x: vp.xMax, y: y2 });
    }

    if (Math.abs(dy) > eps) {
      const t3 = (vp.yMin - p1.y) / dy;
      const x3 = p1.x + t3 * dx;
      if (x3 >= vp.xMin - eps && x3 <= vp.xMax + eps) pts.push({ x: x3, y: vp.yMin });

      const t4 = (vp.yMax - p1.y) / dy;
      const x4 = p1.x + t4 * dx;
      if (x4 >= vp.xMin - eps && x4 <= vp.xMax + eps) pts.push({ x: x4, y: vp.yMax });
    }

    const unique = [];
    for (const p of pts) {
      if (!unique.some(q => dist2(p.x, p.y, q.x, q.y) < 1e-12)) unique.push(p);
    }

    if (unique.length < 2) return null;
    return [unique[0], unique[1]];
  }

  function intersectionLineLine(a1, a2, b1, b2) {
    const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
    if (Math.abs(d) < 1e-12) return null;

    const x =
      ((a1.x * a2.y - a1.y * a2.x) * (b1.x - b2.x) -
       (a1.x - a2.x) * (b1.x * b2.y - b1.y * b2.x)) / d;

    const y =
      ((a1.x * a2.y - a1.y * a2.x) * (b1.y - b2.y) -
       (a1.y - a2.y) * (b1.x * b2.y - b1.y * b2.x)) / d;

    return { x, y };
  }

  function intersectionLineCircle(p1, p2, c, r) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - c.x;
    const fy = p1.y - c.y;

    const A = dx * dx + dy * dy;
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - r * r;
    const disc = B * B - 4 * A * C;

    if (disc < -1e-12) return [];
    if (Math.abs(disc) < 1e-12) {
      const t = -B / (2 * A);
      return [{ x: p1.x + t * dx, y: p1.y + t * dy }];
    }
    const s = Math.sqrt(Math.max(0, disc));
    const t1 = (-B - s) / (2 * A);
    const t2 = (-B + s) / (2 * A);
    return [
      { x: p1.x + t1 * dx, y: p1.y + t1 * dy },
      { x: p1.x + t2 * dx, y: p1.y + t2 * dy }
    ];
  }

  function intersectionCircleCircle(c1, r1, c2, r2) {
    const d = dist(c1.x, c1.y, c2.x, c2.y);
    if (d < 1e-12) return [];
    if (d > r1 + r2 + 1e-12) return [];
    if (d < Math.abs(r1 - r2) - 1e-12) return [];

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = r1 * r1 - a * a;
    if (h2 < -1e-12) return [];

    const h = Math.sqrt(Math.max(0, h2));
    const xm = c1.x + a * (c2.x - c1.x) / d;
    const ym = c1.y + a * (c2.y - c1.y) / d;

    if (h < 1e-12) return [{ x: xm, y: ym }];

    const rx = -(c2.y - c1.y) * (h / d);
    const ry =  (c2.x - c1.x) * (h / d);

    return [
      { x: xm + rx, y: ym + ry },
      { x: xm - rx, y: ym - ry }
    ];
  }

  function resolveScene(scene) {
    const map = buildObjectMap(scene);
    const cache = new Map();

    function getPointLike(id) {
      const res = resolveObject(id);
      if (!res) return null;
      if (res.kind === 'point') return res;
      return null;
    }

    function resolveObject(id) {
      if (cache.has(id)) return cache.get(id);
      const obj = map.get(id);
      if (!obj) return null;

      let result = null;

      switch (obj.type) {
        case 'point': {
          result = {
            kind: 'point',
            x: safeNumber(obj.x),
            y: safeNumber(obj.y),
            source: obj
          };
          break;
        }

        case 'segment': {
          const p1 = getPointLike(obj.p1);
          const p2 = getPointLike(obj.p2);
          if (p1 && p2) {
            result = {
              kind: 'segment',
              p1: { x: p1.x, y: p1.y },
              p2: { x: p2.x, y: p2.y },
              source: obj
            };
          }
          break;
        }

        case 'line': {
          const p1 = getPointLike(obj.p1);
          const p2 = getPointLike(obj.p2);
          if (p1 && p2 && dist2(p1.x, p1.y, p2.x, p2.y) > 1e-12) {
            result = {
              kind: 'line',
              p1: { x: p1.x, y: p1.y },
              p2: { x: p2.x, y: p2.y },
              source: obj
            };
          }
          break;
        }

        case 'ray': {
          const p1 = getPointLike(obj.p1);
          const p2 = getPointLike(obj.p2);
          if (p1 && p2 && dist2(p1.x, p1.y, p2.x, p2.y) > 1e-12) {
            result = {
              kind: 'ray',
              p1: { x: p1.x, y: p1.y },
              p2: { x: p2.x, y: p2.y },
              source: obj
            };
          }
          break;
        }

        case 'circle': {
          const center = getPointLike(obj.center);
          const through = getPointLike(obj.through);
          if (center && through) {
            result = {
              kind: 'circle',
              center: { x: center.x, y: center.y },
              radius: dist(center.x, center.y, through.x, through.y),
              source: obj
            };
          }
          break;
        }

        case 'circleRadius': {
          const center = getPointLike(obj.center);
          if (center) {
            result = {
              kind: 'circle',
              center: { x: center.x, y: center.y },
              radius: Math.max(0, safeNumber(obj.radius)),
              source: obj
            };
          }
          break;
        }

        case 'polygon': {
          const pts = [];
          let ok = true;
          for (const pid of obj.points || []) {
            const p = getPointLike(pid);
            if (!p) {
              ok = false;
              break;
            }
            pts.push({ x: p.x, y: p.y });
          }
          if (ok && pts.length >= 2) {
            result = {
              kind: 'polygon',
              points: pts,
              source: obj
            };
          }
          break;
        }

        case 'midpoint': {
          const p1 = getPointLike(obj.p1);
          const p2 = getPointLike(obj.p2);
          if (p1 && p2) {
            result = {
              kind: 'point',
              x: (p1.x + p2.x) / 2,
              y: (p1.y + p2.y) / 2,
              source: obj
            };
          }
          break;
        }

        case 'parallel': {
          const through = getPointLike(obj.through);
          const ref = resolveObject(obj.ref);
          if (through && ref && (ref.kind === 'line' || ref.kind === 'segment' || ref.kind === 'ray')) {
            const dx = ref.p2.x - ref.p1.x;
            const dy = ref.p2.y - ref.p1.y;
            result = {
              kind: 'line',
              p1: { x: through.x, y: through.y },
              p2: { x: through.x + dx, y: through.y + dy },
              source: obj
            };
          }
          break;
        }

        case 'perpendicular': {
          const through = getPointLike(obj.through);
          const ref = resolveObject(obj.ref);
          if (through && ref && (ref.kind === 'line' || ref.kind === 'segment' || ref.kind === 'ray')) {
            const dx = ref.p2.x - ref.p1.x;
            const dy = ref.p2.y - ref.p1.y;
            result = {
              kind: 'line',
              p1: { x: through.x, y: through.y },
              p2: { x: through.x - dy, y: through.y + dx },
              source: obj
            };
          }
          break;
        }

        case 'intersection': {
          const [aId, bId] = obj.of || [];
          const A = resolveObject(aId);
          const B = resolveObject(bId);
          const idx = safeNumber(obj.index, 0);

          let pts = [];

          if (A && B) {
            if ((A.kind === 'line' || A.kind === 'segment' || A.kind === 'ray') &&
                (B.kind === 'line' || B.kind === 'segment' || B.kind === 'ray')) {
              const p = intersectionLineLine(A.p1, A.p2, B.p1, B.p2);
              if (p) pts = [p];
            } else if ((A.kind === 'line' || A.kind === 'segment' || A.kind === 'ray') && B.kind === 'circle') {
              pts = intersectionLineCircle(A.p1, A.p2, B.center, B.radius);
            } else if (A.kind === 'circle' && (B.kind === 'line' || B.kind === 'segment' || B.kind === 'ray')) {
              pts = intersectionLineCircle(B.p1, B.p2, A.center, A.radius);
            } else if (A.kind === 'circle' && B.kind === 'circle') {
              pts = intersectionCircleCircle(A.center, A.radius, B.center, B.radius);
            }
          }

          if (pts[idx]) {
            result = {
              kind: 'point',
              x: pts[idx].x,
              y: pts[idx].y,
              source: obj
            };
          }
          break;
        }

        case 'measure': {
          result = {
            kind: 'measure',
            source: obj
          };
          break;
        }
      }

      cache.set(id, result);
      return result;
    }

    return {
      resolveObject,
      getObjectById(id) {
        return map.get(id) || null;
      },
      allResolved() {
        return scene.objects.map(obj => ({
          object: obj,
          resolved: resolveObject(obj.id)
        }));
      }
    };
  }

  /* =========================================================
     PARTE 5. RENDERIZADO DE LA ESCENA
     ========================================================= */

  function renderSceneToSvg(svg, scene, state) {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(100, rect.width || svg.clientWidth || 800);
    const height = Math.max(100, rect.height || svg.clientHeight || 520);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = '';

    const vp = scene.viewport;
    const resolver = resolveScene(scene);

    // --- fondo y grupos
    const gGrid = createSvgEl('g');
    const gAxes = createSvgEl('g');
    const gShapes = createSvgEl('g');
    const gMeasures = createSvgEl('g');
    const gPoints = createSvgEl('g');
    const gLabels = createSvgEl('g');

    svg.append(gGrid, gAxes, gShapes, gMeasures, gPoints, gLabels);

    // --- grilla
    if (vp.showGrid) {
      const sx = niceStep(vp.xMax - vp.xMin);
      const sy = niceStep(vp.yMax - vp.yMin);

      for (let x = Math.ceil(vp.xMin / sx) * sx; x <= vp.xMax + 1e-9; x += sx) {
        const p = worldToScreen(vp, width, height, x, 0);
        gGrid.appendChild(createSvgEl('line', {
          x1: p.x, y1: 0, x2: p.x, y2: height,
          stroke: '#edf0f4', 'stroke-width': 1
        }));
      }

      for (let y = Math.ceil(vp.yMin / sy) * sy; y <= vp.yMax + 1e-9; y += sy) {
        const p = worldToScreen(vp, width, height, 0, y);
        gGrid.appendChild(createSvgEl('line', {
          x1: 0, y1: p.y, x2: width, y2: p.y,
          stroke: '#edf0f4', 'stroke-width': 1
        }));
      }
    }

    // --- ejes
    if (vp.showAxes) {
      if (vp.xMin <= 0 && vp.xMax >= 0) {
        const p = worldToScreen(vp, width, height, 0, 0);
        gAxes.appendChild(createSvgEl('line', {
          x1: p.x, y1: 0, x2: p.x, y2: height,
          stroke: '#9aa4b2', 'stroke-width': 1.5
        }));
      }
      if (vp.yMin <= 0 && vp.yMax >= 0) {
        const p = worldToScreen(vp, width, height, 0, 0);
        gAxes.appendChild(createSvgEl('line', {
          x1: 0, y1: p.y, x2: width, y2: p.y,
          stroke: '#9aa4b2', 'stroke-width': 1.5
        }));
      }
    }

    // --- objetos no punto
    for (const { object: obj, resolved } of resolver.allResolved()) {
      if (!obj.visible && obj.visible !== undefined) continue;
      if (!resolved) continue;

      const style = mergeStyle(scene, obj);

      if (resolved.kind === 'segment') {
        const a = worldToScreen(vp, width, height, resolved.p1.x, resolved.p1.y);
        const b = worldToScreen(vp, width, height, resolved.p2.x, resolved.p2.y);
        gShapes.appendChild(createSvgEl('line', {
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          stroke: style.stroke, 'stroke-width': style.strokeWidth
        }));
      }

      if (resolved.kind === 'line') {
        const ext = extendLineToViewport(vp, resolved.p1, resolved.p2);
        if (ext) {
          const a = worldToScreen(vp, width, height, ext[0].x, ext[0].y);
          const b = worldToScreen(vp, width, height, ext[1].x, ext[1].y);
          gShapes.appendChild(createSvgEl('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            stroke: style.stroke, 'stroke-width': style.strokeWidth
          }));
        }
      }

      if (resolved.kind === 'ray') {
        const ext = extendLineToViewport(vp, resolved.p1, resolved.p2);
        if (ext) {
          const dir = { x: resolved.p2.x - resolved.p1.x, y: resolved.p2.y - resolved.p1.y };
          const candidates = ext.filter(pt => {
            const tx = pt.x - resolved.p1.x;
            const ty = pt.y - resolved.p1.y;
            return tx * dir.x + ty * dir.y >= -1e-9;
          });
          if (candidates.length >= 1) {
            const far = candidates.sort((u, v) =>
              dist2(resolved.p1.x, resolved.p1.y, v.x, v.y) - dist2(resolved.p1.x, resolved.p1.y, u.x, u.y)
            )[0];
            const a = worldToScreen(vp, width, height, resolved.p1.x, resolved.p1.y);
            const b = worldToScreen(vp, width, height, far.x, far.y);
            gShapes.appendChild(createSvgEl('line', {
              x1: a.x, y1: a.y, x2: b.x, y2: b.y,
              stroke: style.stroke, 'stroke-width': style.strokeWidth
            }));
          }
        }
      }

      if (resolved.kind === 'circle') {
        const c = worldToScreen(vp, width, height, resolved.center.x, resolved.center.y);
        const edge = worldToScreen(vp, width, height, resolved.center.x + resolved.radius, resolved.center.y);
        const rpx = Math.abs(edge.x - c.x);
        gShapes.appendChild(createSvgEl('circle', {
          cx: c.x, cy: c.y, r: rpx,
          stroke: style.stroke, 'stroke-width': style.strokeWidth,
          fill: style.fill || 'none'
        }));
      }

      if (resolved.kind === 'polygon') {
        const pts = resolved.points.map(p => {
          const s = worldToScreen(vp, width, height, p.x, p.y);
          return `${s.x},${s.y}`;
        }).join(' ');
        gShapes.appendChild(createSvgEl('polygon', {
          points: pts,
          stroke: style.stroke,
          'stroke-width': style.strokeWidth,
          fill: style.fill || 'none'
        }));
      }

      if (obj.type === 'measure') {
        const label = obj.label || '';
        const valueInfo = resolveMeasure(scene, resolver, obj);
        if (valueInfo) {
          const p = worldToScreen(vp, width, height, valueInfo.anchor.x, valueInfo.anchor.y);
          const txt = createSvgEl('text', {
            x: p.x + 8,
            y: p.y - 8,
            class: 'geo2d-measure-label'
          });
          txt.textContent = label ? `${label}: ${valueInfo.text}` : valueInfo.text;
          gMeasures.appendChild(txt);
        }
      }
    }

    // --- puntos y etiquetas
    const pointHitList = [];

    for (const { object: obj, resolved } of resolver.allResolved()) {
      if (!obj.visible && obj.visible !== undefined) continue;
      if (!resolved) continue;
      if (resolved.kind !== 'point') continue;

      const style = mergeStyle(scene, obj, { fill: obj.style?.fill || '#ff6200' });
      const p = worldToScreen(vp, width, height, resolved.x, resolved.y);

      const c = createSvgEl('circle', {
        cx: p.x, cy: p.y, r: style.pointRadius,
        fill: style.fill || '#ff6200',
        stroke: style.stroke || '#222',
        'stroke-width': 1.5
      });

      c.dataset.objectId = obj.id;
      gPoints.appendChild(c);

      pointHitList.push({
        id: obj.id,
        x: p.x,
        y: p.y,
        r: style.pointRadius + 8,
        draggable: !!obj.draggable && obj.type === 'point'
      });

      if (obj.label) {
        const t = createSvgEl('text', {
          x: p.x + 10,
          y: p.y - 10,
          class: 'geo2d-legendline',
          'font-size': style.fontSize
        });
        t.textContent = obj.label;
        gLabels.appendChild(t);
      }
    }

    state._pointHitList = pointHitList;
    state._svgWidth = width;
    state._svgHeight = height;
  }

  function resolveMeasure(scene, resolver, obj) {
    const type = obj.measureType;
    const ids = obj.of || [];

    if (type === 'distance' && ids.length >= 2) {
      const a = resolver.resolveObject(ids[0]);
      const b = resolver.resolveObject(ids[1]);
      if (a && b && a.kind === 'point' && b.kind === 'point') {
        const d = dist(a.x, a.y, b.x, b.y);
        return {
          text: d.toFixed(2),
          anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        };
      }
    }

    if (type === 'slope' && ids.length >= 2) {
      const a = resolver.resolveObject(ids[0]);
      const b = resolver.resolveObject(ids[1]);
      if (a && b && a.kind === 'point' && b.kind === 'point') {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const text = Math.abs(dx) < 1e-12 ? 'indefinida' : (dy / dx).toFixed(2);
        return {
          text,
          anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        };
      }
    }

    if (type === 'area' && ids.length >= 1) {
      const poly = resolver.resolveObject(ids[0]);
      if (poly && poly.kind === 'polygon' && poly.points.length >= 3) {
        let area = 0;
        let cx = 0;
        let cy = 0;
        const pts = poly.points;
        for (let i = 0; i < pts.length; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];
          const cross = p1.x * p2.y - p2.x * p1.y;
          area += cross;
          cx += (p1.x + p2.x) * cross;
          cy += (p1.y + p2.y) * cross;
        }
        area /= 2;
        const A = Math.abs(area);
        const denom = area * 6 || 1;
        return {
          text: A.toFixed(2),
          anchor: { x: cx / denom, y: cy / denom }
        };
      }
    }

    if (type === 'perimeter' && ids.length >= 1) {
      const poly = resolver.resolveObject(ids[0]);
      if (poly && poly.kind === 'polygon' && poly.points.length >= 2) {
        let per = 0;
        const pts = poly.points;
        for (let i = 0; i < pts.length; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];
          per += dist(p1.x, p1.y, p2.x, p2.y);
        }
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        return {
          text: per.toFixed(2),
          anchor: { x: cx, y: cy }
        };
      }
    }

    return null;
  }

  /* =========================================================
     PARTE 6. CLASE PRINCIPAL DEL EDITOR
     ========================================================= */

  class Geo2DEditor {
    constructor(target, options = {}) {
      injectStylesOnce();

      this.targetEl = typeof target === 'string'
        ? document.querySelector(target)
        : target;

      if (!this.targetEl) {
        throw new Error('No se encontró el contenedor del editor.');
      }

      this.options = options;
      this.mode = options.mode || 'editor';
      this.scene = ensureScene(options.scene || defaultScene());

      this.activeTab = 'visual';
      this.activeTool = 'move';
      this._dragInfo = null;
      this._viewDragInfo = null;
      this._pendingPoints = [];
      this._objectCounter = this.scene.objects.length + 1;

      this.buildLayout();
      this.bindUI();
      this.syncJsonFromScene();
      this.render();
    }

    /* ---------------------------------------------------------
       SUBPARTE 6.1. CONSTRUCCIÓN DEL LAYOUT
       --------------------------------------------------------- */

    buildLayout() {
      this.root = document.createElement('div');
      this.root.className = 'geo2d-root';

      this.root.innerHTML = `
        <div class="geo2d-toolbar">
          <button data-action="new">Nuevo</button>
          <button data-action="load">Cargar</button>
          <button data-action="save">Guardar JSON</button>
          <button data-action="publish">Publicar HTML</button>
          <button data-action="copyjson">Copiar JSON</button>
          <span style="flex:1"></span>
          <input type="text" data-role="title" placeholder="Título de la escena" />
        </div>

        <div class="geo2d-body">
          <aside class="geo2d-side">
            <h3>Herramientas</h3>
            <div class="geo2d-toolgrid">
              <button data-tool="move">Mover / Vista</button>
              <button data-tool="point">Punto</button>
              <button data-tool="segment">Segmento</button>
              <button data-tool="line">Recta</button>
              <button data-tool="circle">Circunferencia</button>
              <button data-tool="polygon">Polígono</button>
              <button data-tool="midpoint">Punto medio</button>
              <button data-tool="measure-distance">Medir distancia</button>
              <button data-tool="delete">Borrar</button>
            </div>
          </aside>

          <main class="geo2d-main">
            <div class="geo2d-tabs">
              <button class="geo2d-tab active" data-tab="visual">Visual</button>
              <button class="geo2d-tab" data-tab="json">JSON</button>
            </div>

            <div class="geo2d-panels">
              <section class="geo2d-panel active" data-panel="visual">
                <div class="geo2d-visual-wrap">
                  <div class="geo2d-canvas-wrap">
                    <svg></svg>
                  </div>
                  <div class="geo2d-status" data-role="status">Listo.</div>
                </div>
              </section>

              <section class="geo2d-panel" data-panel="json">
                <div class="geo2d-json-wrap">
                  <textarea spellcheck="false"></textarea>
                  <div class="geo2d-json-actions">
                    <button data-action="apply-json">Aplicar cambios</button>
                    <button data-action="format-json">Formatear JSON</button>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>

        <div class="geo2d-modal-backdrop">
          <div class="geo2d-modal">
            <div class="geo2d-modal-head"><strong>Publicar HTML</strong></div>
            <div class="geo2d-modal-body">
              <textarea spellcheck="false" readonly></textarea>
            </div>
            <div class="geo2d-modal-foot">
              <button data-action="copy-published">Copiar HTML</button>
              <button data-action="download-published">Descargar HTML</button>
              <button data-action="close-modal">Cerrar</button>
            </div>
          </div>
        </div>
      `;

      this.targetEl.innerHTML = '';
      this.targetEl.appendChild(this.root);

      this.svg = this.root.querySelector('svg');
      this.statusEl = this.root.querySelector('[data-role="status"]');
      this.titleInput = this.root.querySelector('[data-role="title"]');
      this.jsonArea = this.root.querySelector('.geo2d-json-wrap textarea');
      this.modalBackdrop = this.root.querySelector('.geo2d-modal-backdrop');
      this.publishArea = this.root.querySelector('.geo2d-modal textarea');

      this.titleInput.value = this.scene.meta.title || '';
    }

    /* ---------------------------------------------------------
       SUBPARTE 6.2. EVENTOS DE INTERFAZ
       --------------------------------------------------------- */

    bindUI() {
      this.root.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const tool = btn.dataset.tool;
        const tab = btn.dataset.tab;

        if (action) this.handleAction(action);
        if (tool) this.setTool(tool);
        if (tab) this.setTab(tab);
      });

      this.titleInput.addEventListener('input', () => {
        this.scene.meta.title = this.titleInput.value || 'Escena Geo2D';
        this.syncJsonFromScene();
      });

      this.bindSvgInteractions();
      this.bindFileLoad();
    }

    bindFileLoad() {
      this.hiddenFileInput = document.createElement('input');
      this.hiddenFileInput.type = 'file';
      this.hiddenFileInput.accept = '.json,.txt,.html';
      this.hiddenFileInput.className = 'geo2d-hidden';
      this.root.appendChild(this.hiddenFileInput);

      this.hiddenFileInput.addEventListener('change', async () => {
        const file = this.hiddenFileInput.files && this.hiddenFileInput.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          this.loadSceneFromText(text);
        } catch (err) {
          this.setStatus('Error al cargar archivo: ' + err.message, true);
        } finally {
          this.hiddenFileInput.value = '';
        }
      });
    }

    bindSvgInteractions() {
      this.svg.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.svg.addEventListener('pointermove', (e) => this.onPointerMove(e));
      window.addEventListener('pointerup', (e) => this.onPointerUp(e));

      this.svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const p = this.getMouseWorld(e);
        const factor = e.deltaY < 0 ? 0.9 : 1.1;
        this.scene.viewport = viewportZoom(this.scene.viewport, factor, p.x, p.y);
        this.renderAndSync();
      }, { passive: false });

      this.svg.addEventListener('dblclick', (e) => {
        if (this.activeTool === 'polygon' && this._pendingPoints.length >= 3) {
          this.finishPendingPolygon();
          e.preventDefault();
        }
      });
    }

    /* ---------------------------------------------------------
       SUBPARTE 6.3. GESTIÓN DE ESTADO GENERAL
       --------------------------------------------------------- */

    setStatus(text, isError = false) {
      this.statusEl.textContent = text;
      this.statusEl.style.color = isError ? '#c62828' : '#6b7280';
    }

    setTab(tab) {
      this.activeTab = tab;
      this.root.querySelectorAll('.geo2d-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
      this.root.querySelectorAll('.geo2d-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.panel === tab);
      });
    }

    setTool(tool) {
      this.activeTool = tool;
      this._pendingPoints = [];
      this.root.querySelectorAll('[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
      });
      this.setStatus('Herramienta activa: ' + this.toolLabel(tool));
    }

    toolLabel(tool) {
      const map = {
        move: 'Mover / Vista',
        point: 'Punto',
        segment: 'Segmento',
        line: 'Recta',
        circle: 'Circunferencia',
        polygon: 'Polígono',
        midpoint: 'Punto medio',
        'measure-distance': 'Medir distancia',
        delete: 'Borrar'
      };
      return map[tool] || tool;
    }

    nextId(prefix) {
      let id;
      do {
        id = `${prefix}${this._objectCounter++}`;
      } while (this.scene.objects.some(o => o.id === id));
      return id;
    }

    syncJsonFromScene() {
      this.jsonArea.value = jsonPretty(this.scene);
    }

    applyJsonToScene() {
      const parsed = parseSceneText(this.jsonArea.value);
      this.scene = parsed;
      this.titleInput.value = this.scene.meta.title || '';
      this._pendingPoints = [];
      this.render();
      this.setStatus('JSON aplicado correctamente.');
    }

    render() {
      renderSceneToSvg(this.svg, this.scene, this);
      this.refreshToolButtons();
    }

    renderAndSync() {
      this.render();
      this.syncJsonFromScene();
    }

    refreshToolButtons() {
      this.root.querySelectorAll('[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === this.activeTool);
      });
    }

    /* ---------------------------------------------------------
       SUBPARTE 6.4. ACCIONES DE BOTONES
       --------------------------------------------------------- */

    handleAction(action) {
      switch (action) {
        case 'new':
          this.scene = defaultScene();
          this.titleInput.value = this.scene.meta.title || '';
          this._pendingPoints = [];
          this.renderAndSync();
          this.setStatus('Se creó una nueva escena.');
          break;

        case 'load': {
          const useFile = confirm('Aceptar = abrir archivo\nCancelar = pegar código manualmente');
          if (useFile) {
            this.hiddenFileInput.click();
          } else {
            const raw = prompt('Pega aquí el JSON o el bloque HTML publicado:');
            if (raw && raw.trim()) {
              this.loadSceneFromText(raw);
            }
          }
          break;
        }

        case 'save': {
          const title = slugify(this.scene.meta.title || 'escena-geo2d');
          downloadTextFile(`${title}.geo2d.json`, jsonPretty(this.scene), 'application/json');
          this.setStatus('Escena guardada como JSON.');
          break;
        }

        case 'copyjson':
          copyTextToClipboard(jsonPretty(this.scene))
            .then(() => this.setStatus('JSON copiado al portapapeles.'))
            .catch(() => this.setStatus('No se pudo copiar el JSON.', true));
          break;

        case 'publish': {
          const html = this.publishScene();
          this.publishArea.value = html;
          this.modalBackdrop.classList.add('open');
          this.setStatus('HTML publicado generado.');
          break;
        }

        case 'apply-json':
          try {
            this.applyJsonToScene();
          } catch (err) {
            this.setStatus('Error al aplicar JSON: ' + err.message, true);
          }
          break;

        case 'format-json':
          try {
            const parsed = parseSceneText(this.jsonArea.value);
            this.jsonArea.value = jsonPretty(parsed);
            this.setStatus('JSON formateado.');
          } catch (err) {
            this.setStatus('No se pudo formatear: ' + err.message, true);
          }
          break;

        case 'copy-published':
          copyTextToClipboard(this.publishArea.value)
            .then(() => this.setStatus('HTML publicado copiado.'))
            .catch(() => this.setStatus('No se pudo copiar el HTML.', true));
          break;

        case 'download-published': {
          const title = slugify(this.scene.meta.title || 'escena-geo2d');
          downloadTextFile(`${title}.published.html`, this.publishArea.value, 'text/html');
          this.setStatus('HTML publicado descargado.');
          break;
        }

        case 'close-modal':
          this.modalBackdrop.classList.remove('open');
          break;
      }
    }

    loadSceneFromText(text) {
      try {
        this.scene = parseSceneText(text);
        this.titleInput.value = this.scene.meta.title || '';
        this._pendingPoints = [];
        this.renderAndSync();
        this.setStatus('Escena cargada correctamente.');
      } catch (err) {
        this.setStatus('Error al cargar escena: ' + err.message, true);
      }
    }

    publishScene() {
      const sceneText = jsonPretty(this.scene);
      const id = 'geo2d-' + Math.random().toString(36).slice(2, 8);

      return [
        `<div class="geo2d-viewer" id="${id}"></div>`,
        `<script type="application/json" id="${id}-data">`,
        sceneText,
        `</script>`,
        `<script>`,
        `  window.Geo2D && Geo2D.openViewer({ target: "#${id}", sceneSource: "#${id}-data" });`,
        `</script>`
      ].join('\n');
    }

    /* ---------------------------------------------------------
       SUBPARTE 6.5. INTERACCIÓN CON EL SVG
       --------------------------------------------------------- */

    getMouseWorld(e) {
      const r = this.svg.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      return screenToWorld(this.scene.viewport, this._svgWidth || r.width, this._svgHeight || r.height, sx, sy);
    }

    findNearestPointAtScreen(sx, sy) {
      const list = this._pointHitList || [];
      let best = null;
      let bestD2 = Infinity;
      for (const p of list) {
        const d2 = dist2(sx, sy, p.x, p.y);
        if (d2 <= p.r * p.r && d2 < bestD2) {
          best = p;
          bestD2 = d2;
        }
      }
      return best;
    }

    onPointerDown(e) {
      if (this.mode === 'viewer') return;

      const rect = this.svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(this.scene.viewport, this._svgWidth || rect.width, this._svgHeight || rect.height, sx, sy);
      const nearPoint = this.findNearestPointAtScreen(sx, sy);

      if (this.activeTool === 'move') {
        if (nearPoint && nearPoint.draggable) {
          this._dragInfo = {
            pointId: nearPoint.id
          };
          this.svg.setPointerCapture(e.pointerId);
          this.setStatus('Arrastrando punto ' + nearPoint.id);
        } else {
          this._viewDragInfo = {
            startX: sx,
            startY: sy,
            vp: deepClone(this.scene.viewport)
          };
          this.svg.setPointerCapture(e.pointerId);
          this.setStatus('Arrastrando vista...');
        }
        return;
      }

      if (this.activeTool === 'point') {
        this.addPoint(world.x, world.y);
        return;
      }

      if (this.activeTool === 'delete') {
        if (nearPoint) {
          this.deleteObjectAndDependents(nearPoint.id);
        } else {
          const hitObj = this.findNearestNonPointObjectAtScreen(sx, sy);
          if (hitObj) this.deleteObjectAndDependents(hitObj.id);
        }
        return;
      }

      if (this.activeTool === 'segment' || this.activeTool === 'line' || this.activeTool === 'circle' || this.activeTool === 'polygon' || this.activeTool === 'midpoint' || this.activeTool === 'measure-distance') {
        this.handleConstructionClick(world, nearPoint);
      }
    }

    onPointerMove(e) {
      const rect = this.svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(this.scene.viewport, this._svgWidth || rect.width, this._svgHeight || rect.height, sx, sy);

      if (this._dragInfo) {
        const obj = this.scene.objects.find(o => o.id === this._dragInfo.pointId);
        if (obj && obj.type === 'point' && obj.draggable) {
          obj.x = world.x;
          obj.y = world.y;
          this.renderAndSync();
        }
        return;
      }

      if (this._viewDragInfo) {
        const startWorld = screenToWorld(this._viewDragInfo.vp, this._svgWidth || rect.width, this._svgHeight || rect.height, this._viewDragInfo.startX, this._viewDragInfo.startY);
        const currentWorld = screenToWorld(this._viewDragInfo.vp, this._svgWidth || rect.width, this._svgHeight || rect.height, sx, sy);
        const dx = startWorld.x - currentWorld.x;
        const dy = startWorld.y - currentWorld.y;
        this.scene.viewport = viewportPan(this._viewDragInfo.vp, dx, dy);
        this.renderAndSync();
      }
    }

    onPointerUp() {
      this._dragInfo = null;
      this._viewDragInfo = null;
    }

    /* ---------------------------------------------------------
       SUBPARTE 6.6. HERRAMIENTAS DE CONSTRUCCIÓN
       --------------------------------------------------------- */

    handleConstructionClick(world, nearPoint) {
      const selectedId = nearPoint ? nearPoint.id : this.addPoint(world.x, world.y, false);

      if (!selectedId) return;

      if (this.activeTool === 'polygon') {
        this._pendingPoints.push(selectedId);
        this.setStatus(`Polígono: ${this._pendingPoints.length} punto(s). Doble clic para cerrar.`);
        return;
      }

      this._pendingPoints.push(selectedId);

      if (this.activeTool === 'segment' && this._pendingPoints.length === 2) {
        const [a, b] = this._pendingPoints;
        this.scene.objects.push({
          id: this.nextId('s'),
          type: 'segment',
          p1: a,
          p2: b,
          style: { stroke: '#1976d2' }
        });
        this._pendingPoints = [];
        this.renderAndSync();
        this.setStatus('Segmento creado.');
      }

      if (this.activeTool === 'line' && this._pendingPoints.length === 2) {
        const [a, b] = this._pendingPoints;
        this.scene.objects.push({
          id: this.nextId('r'),
          type: 'line',
          p1: a,
          p2: b,
          style: { stroke: '#2e7d32' }
        });
        this._pendingPoints = [];
        this.renderAndSync();
        this.setStatus('Recta creada.');
      }

      if (this.activeTool === 'circle' && this._pendingPoints.length === 2) {
        const [center, through] = this._pendingPoints;
        this.scene.objects.push({
          id: this.nextId('c'),
          type: 'circle',
          center,
          through,
          style: { stroke: '#c62828' }
        });
        this._pendingPoints = [];
        this.renderAndSync();
        this.setStatus('Circunferencia creada.');
      }

      if (this.activeTool === 'midpoint' && this._pendingPoints.length === 2) {
        const [p1, p2] = this._pendingPoints;
        this.scene.objects.push({
          id: this.nextId('M'),
          type: 'midpoint',
          p1,
          p2,
          label: 'M',
          style: { fill: '#2e7d32' }
        });
        this._pendingPoints = [];
        this.renderAndSync();
        this.setStatus('Punto medio creado.');
      }

      if (this.activeTool === 'measure-distance' && this._pendingPoints.length === 2) {
        const [p1, p2] = this._pendingPoints;
        this.scene.objects.push({
          id: this.nextId('m'),
          type: 'measure',
          measureType: 'distance',
          of: [p1, p2],
          label: `${p1}${p2}`
        });
        this._pendingPoints = [];
        this.renderAndSync();
        this.setStatus('Medida de distancia creada.');
      }
    }

    finishPendingPolygon() {
      const unique = [];
      for (const id of this._pendingPoints) {
        if (!unique.includes(id)) unique.push(id);
      }
      if (unique.length >= 3) {
        this.scene.objects.push({
          id: this.nextId('poly'),
          type: 'polygon',
          points: unique,
          style: {
            stroke: '#ff6200',
            fill: 'rgba(255,98,0,0.18)'
          }
        });
        this._pendingPoints = [];
        this.renderAndSync();
        this.setStatus('Polígono creado.');
      } else {
        this.setStatus('Se necesitan al menos 3 puntos distintos para un polígono.', true);
      }
    }

    addPoint(x, y, sync = true) {
      const id = this.generatePointName();
      this.scene.objects.push({
        id,
        type: 'point',
        x,
        y,
        label: id,
        draggable: true,
        style: { fill: '#ff6200' }
      });
      if (sync) {
        this.renderAndSync();
        this.setStatus(`Punto ${id} creado.`);
      }
      return id;
    }

    generatePointName() {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < letters.length; i++) {
        const candidate = letters[i];
        if (!this.scene.objects.some(o => o.id === candidate)) return candidate;
      }
      return this.nextId('P');
    }

    deleteObjectAndDependents(id) {
      const dependents = new Set([id]);

      let changed = true;
      while (changed) {
        changed = false;
        for (const obj of this.scene.objects) {
          if (dependents.has(obj.id)) continue;
          const refs = this.objectReferences(obj);
          if (refs.some(r => dependents.has(r))) {
            dependents.add(obj.id);
            changed = true;
          }
        }
      }

      const before = this.scene.objects.length;
      this.scene.objects = this.scene.objects.filter(o => !dependents.has(o.id));
      const removed = before - this.scene.objects.length;

      if (removed > 0) {
        this.renderAndSync();
        this.setStatus(`Se eliminaron ${removed} objeto(s).`);
      }
    }

    objectReferences(obj) {
      const refs = [];

      ['p1', 'p2', 'center', 'through', 'ref'].forEach(k => {
        if (typeof obj[k] === 'string') refs.push(obj[k]);
      });

      if (Array.isArray(obj.points)) refs.push(...obj.points.filter(v => typeof v === 'string'));
      if (Array.isArray(obj.of)) refs.push(...obj.of.filter(v => typeof v === 'string'));

      return refs;
    }

    findNearestNonPointObjectAtScreen(sx, sy) {
      const resolver = resolveScene(this.scene);
      const vp = this.scene.viewport;
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.scene.objects) {
        if (obj.type === 'point' || obj.type === 'midpoint' || obj.type === 'intersection') continue;
        const resolved = resolver.resolveObject(obj.id);
        if (!resolved) continue;

        let d2 = Infinity;

        if (resolved.kind === 'segment') {
          d2 = this.pointToSegmentScreenDistance2(sx, sy, resolved.p1, resolved.p2, vp);
        } else if (resolved.kind === 'line') {
          d2 = this.pointToLineScreenDistance2(sx, sy, resolved.p1, resolved.p2, vp);
        } else if (resolved.kind === 'circle') {
          d2 = this.pointToCircleScreenDistance2(sx, sy, resolved.center, resolved.radius, vp);
        } else if (resolved.kind === 'polygon') {
          for (let i = 0; i < resolved.points.length; i++) {
            const a = resolved.points[i];
            const b = resolved.points[(i + 1) % resolved.points.length];
            d2 = Math.min(d2, this.pointToSegmentScreenDistance2(sx, sy, a, b, vp));
          }
        }

        if (d2 < 100 && d2 < bestD2) {
          best = obj;
          bestD2 = d2;
        }
      }

      return best;
    }

    pointToSegmentScreenDistance2(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this._svgWidth, this._svgHeight, p1.x, p1.y);
      const b = worldToScreen(vp, this._svgWidth, this._svgHeight, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      let t = ((sx - a.x) * dx + (sy - a.y) * dy) / len2;
      t = clamp(t, 0, 1);
      const x = a.x + t * dx;
      const y = a.y + t * dy;
      return dist2(sx, sy, x, y);
    }

    pointToLineScreenDistance2(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this._svgWidth, this._svgHeight, p1.x, p1.y);
      const b = worldToScreen(vp, this._svgWidth, this._svgHeight, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      const t = ((sx - a.x) * dx + (sy - a.y) * dy) / len2;
      const x = a.x + t * dx;
      const y = a.y + t * dy;
      return dist2(sx, sy, x, y);
    }

    pointToCircleScreenDistance2(sx, sy, center, radius, vp) {
      const c = worldToScreen(vp, this._svgWidth, this._svgHeight, center.x, center.y);
      const e = worldToScreen(vp, this._svgWidth, this._svgHeight, center.x + radius, center.y);
      const r = Math.abs(e.x - c.x);
      const d = Math.sqrt(dist2(sx, sy, c.x, c.y));
      return (d - r) * (d - r);
    }
  }

  /* =========================================================
     PARTE 7. VISOR SIMPLE
     ========================================================= */

  class Geo2DViewer {
    constructor(target, options = {}) {
      injectStylesOnce();

      this.targetEl = typeof target === 'string'
        ? document.querySelector(target)
        : target;

      if (!this.targetEl) {
        throw new Error('No se encontró el contenedor del visor.');
      }

      let scene = options.scene || null;

      if (!scene && options.sceneSource) {
        const sourceEl = typeof options.sceneSource === 'string'
          ? document.querySelector(options.sceneSource)
          : options.sceneSource;
        if (sourceEl) {
          scene = parseSceneText(sourceEl.textContent);
        }
      }

      this.scene = ensureScene(scene || defaultScene());

      this.root = document.createElement('div');
      this.root.className = 'geo2d-root';
      this.root.innerHTML = `
        <div class="geo2d-toolbar">
          <strong>${escapeHtml(this.scene.meta.title || 'Visor Geo2D')}</strong>
          <span style="flex:1"></span>
          <button data-action="copyjson">Copiar código</button>
        </div>
        <div class="geo2d-canvas-wrap" style="min-height:520px">
          <svg></svg>
        </div>
      `;

      this.targetEl.innerHTML = '';
      this.targetEl.appendChild(this.root);

      this.svg = this.root.querySelector('svg');

      this.root.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.action === 'copyjson') {
          copyTextToClipboard(jsonPretty(this.scene));
        }
      });

      this.bindViewInteractions();
      this.render();
    }

    bindViewInteractions() {
      this._viewDragInfo = null;

      this.svg.addEventListener('pointerdown', (e) => {
        const rect = this.svg.getBoundingClientRect();
        this._viewDragInfo = {
          startX: e.clientX - rect.left,
          startY: e.clientY - rect.top,
          vp: deepClone(this.scene.viewport)
        };
        this.svg.setPointerCapture(e.pointerId);
      });

      this.svg.addEventListener('pointermove', (e) => {
        if (!this._viewDragInfo) return;
        const rect = this.svg.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        const startWorld = screenToWorld(this._viewDragInfo.vp, this._svgWidth || rect.width, this._svgHeight || rect.height, this._viewDragInfo.startX, this._viewDragInfo.startY);
        const currentWorld = screenToWorld(this._viewDragInfo.vp, this._svgWidth || rect.width, this._svgHeight || rect.height, sx, sy);

        this.scene.viewport = viewportPan(this._viewDragInfo.vp, startWorld.x - currentWorld.x, startWorld.y - currentWorld.y);
        this.render();
      });

      window.addEventListener('pointerup', () => {
        this._viewDragInfo = null;
      });

      this.svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.svg.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const p = screenToWorld(this.scene.viewport, this._svgWidth || rect.width, this._svgHeight || rect.height, sx, sy);
        const factor = e.deltaY < 0 ? 0.9 : 1.1;
        this.scene.viewport = viewportZoom(this.scene.viewport, factor, p.x, p.y);
        this.render();
      }, { passive: false });
    }

    render() {
      renderSceneToSvg(this.svg, this.scene, this);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* =========================================================
     PARTE 8. OBJETO GLOBAL PÚBLICO
     ========================================================= */

  const Geo2D = {
    openEditor(options = {}) {
      const target = options.target || options.container || '#geo2d-editor';
      return new Geo2DEditor(target, { ...options, mode: 'editor' });
    },

    openViewer(options = {}) {
      const target = options.target || options.container || '#geo2d-viewer';
      return new Geo2DViewer(target, { ...options, mode: 'viewer' });
    },

    parseSceneText,
    ensureScene,
    defaultScene,

    publishScene(scene, id = 'geo2d-' + Math.random().toString(36).slice(2, 8)) {
      const finalScene = ensureScene(scene);
      return [
        `<div class="geo2d-viewer" id="${id}"></div>`,
        `<script type="application/json" id="${id}-data">`,
        jsonPretty(finalScene),
        `</script>`,
        `<script>`,
        `  window.Geo2D && Geo2D.openViewer({ target: "#${id}", sceneSource: "#${id}-data" });`,
        `</script>`
      ].join('\n');
    }
  };

  window.Geo2D = Geo2D;

  /* =========================================================
     PARTE 9. AUTO-INICIALIZACIÓN OPCIONAL
     ---------------------------------------------------------
     Si hay elementos con:
       data-geo2d-editor
       data-geo2d-viewer
     se montan automáticamente.
     ========================================================= */

  function autoInit() {
    document.querySelectorAll('[data-geo2d-editor]').forEach(el => {
      if (el.__geo2dMounted) return;
      el.__geo2dMounted = true;

      let scene = null;
      const raw = el.getAttribute('data-scene');
      if (raw) {
        try { scene = parseSceneText(raw); } catch (_) {}
      }

      Geo2D.openEditor({
        target: el,
        scene: scene || defaultScene()
      });
    });

    document.querySelectorAll('[data-geo2d-viewer]').forEach(el => {
      if (el.__geo2dMounted) return;
      el.__geo2dMounted = true;

      let scene = null;
      const sourceSel = el.getAttribute('data-scene-source');
      const raw = el.getAttribute('data-scene');

      try {
        if (sourceSel) {
          const sourceEl = document.querySelector(sourceSel);
          if (sourceEl) scene = parseSceneText(sourceEl.textContent);
        } else if (raw) {
          scene = parseSceneText(raw);
        }
      } catch (_) {}

      Geo2D.openViewer({
        target: el,
        scene: scene || defaultScene()
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
