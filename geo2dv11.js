/* =========================================================
   GEO2D EDITOR V3
   - Refactor completo a POO
   - Puntos libres y dependientes
   - Puntos sobre segmento / recta / circunferencia
   - Drag restringido por dependencia
   - lockAspect para geometría correcta
   ========================================================= */
(function (window, document) {
  'use strict';

  /* =========================================================
     UTILIDADES
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
      .replace(/^-+|-+$/g, '') || 'escena';
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

  function sameWorld(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
  }

  function readSceneSource(sceneSource) {
    if (!sceneSource) return null;

    if (typeof sceneSource === 'string') {
      const el = document.querySelector(sceneSource);
      if (!el) throw new Error('No se encontró sceneSource: ' + sceneSource);
      return (el.value !== undefined ? el.value : el.textContent || '').trim();
    }

    if (sceneSource instanceof Element) {
      return (sceneSource.value !== undefined ? sceneSource.value : sceneSource.textContent || '').trim();
    }

    throw new Error('sceneSource inválido.');
  }

  function projectParameter(ax, ay, bx, by, px, py, clampToSegment) {
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    if (len2 < 1e-12) return 0;
    let t = ((px - ax) * vx + (py - ay) * vy) / len2;
    if (clampToSegment) t = clamp(t, 0, 1);
    return t;
  }

  function pointFromParameter(ax, ay, bx, by, t) {
    return {
      x: ax + t * (bx - ax),
      y: ay + t * (by - ay)
    };
  }

  function unescapeHtmlSceneText(text) {
    return String(text || '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  function extractJsonScriptContent(text) {
    const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    let fallback = null;

    while ((match = scriptRe.exec(text))) {
      const attrs = match[1] || '';
      const body = (match[2] || '').trim();
      if (!/\btype\s*=\s*(['"])application\/json\1/i.test(attrs)) continue;

      if (/\bdata-geo2d-scene\b/i.test(attrs)) return body;
      if (fallback === null) fallback = body;
      if (/\bid\s*=\s*(['"])[^'"]*-data\1/i.test(attrs)) return body;
    }

    return fallback;
  }

  function isPointLikeRawType(type) {
    return type === 'point' || type === 'midpoint';
  }

  function getRawObjectRefs(raw) {
    if (!raw || typeof raw !== 'object') return [];

    if (raw.type === 'point' && raw.constraint && raw.constraint.objectId) {
      return [raw.constraint.objectId];
    }

    if (raw.type === 'midpoint') {
      return [raw.p1, raw.p2].filter(Boolean);
    }

    if (raw.type === 'segment' || raw.type === 'line' || raw.type === 'ray') {
      return [raw.p1, raw.p2].filter(Boolean);
    }

    if (raw.type === 'circle') {
      return [raw.center, raw.through].filter(Boolean);
    }

    if (raw.type === 'ellipse') {
      return [raw.center].filter(Boolean);
    }

    if (raw.type === 'polygon') {
      return Array.isArray(raw.points) ? raw.points.filter(Boolean) : [];
    }

    if (raw.type === 'measure') {
      return Array.isArray(raw.of) ? raw.of.filter(Boolean) : [];
    }

    return [];
  }

  function validateScene(scene) {
    const supportedTypes = new Set(['point', 'midpoint', 'segment', 'line', 'ray', 'circle', 'ellipse', 'polygon', 'measure', 'text']);
    const constraintParentType = {
      'on-segment': 'segment',
      'on-line': 'line',
      'on-ray': 'ray',
      'on-circle': 'circle',
      'on-ellipse': 'ellipse'
    };
    const idMap = new Map();

    if (!Array.isArray(scene.objects)) {
      throw new Error('La escena debe incluir una lista de objetos.');
    }

    for (let i = 0; i < scene.objects.length; i++) {
      const raw = scene.objects[i];

      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`El objeto #${i + 1} no es valido.`);
      }

      const id = String(raw.id || '').trim();
      const type = String(raw.type || '').trim();

      if (!id) throw new Error(`El objeto #${i + 1} no tiene id.`);
      if (!supportedTypes.has(type)) throw new Error(`El objeto "${id}" tiene un tipo no soportado: ${type || '(vacio)'}.`);
      if (idMap.has(id)) throw new Error(`Hay un id duplicado: "${id}".`);

      raw.id = id;
      raw.type = type;
      idMap.set(id, raw);
    }

    function requireRef(ownerId, fieldName, refId) {
      const cleanRef = String(refId || '').trim();
      if (!cleanRef) throw new Error(`El objeto "${ownerId}" requiere ${fieldName}.`);
      const target = idMap.get(cleanRef);
      if (!target) throw new Error(`El objeto "${ownerId}" referencia "${cleanRef}" en ${fieldName}, pero no existe.`);
      return target;
    }

    function requirePointRef(ownerId, fieldName, refId) {
      const target = requireRef(ownerId, fieldName, refId);
      if (!isPointLikeRawType(target.type)) {
        throw new Error(`El objeto "${ownerId}" requiere que ${fieldName} apunte a un punto o punto medio.`);
      }
      return target;
    }

    for (const raw of scene.objects) {
      if (raw.type === 'point') {
        if (raw.constraint !== undefined) {
          if (!raw.constraint || typeof raw.constraint !== 'object' || Array.isArray(raw.constraint)) {
            throw new Error(`El punto "${raw.id}" tiene una restriccion invalida.`);
          }

          const kind = String(raw.constraint.kind || '').trim();
          const expectedParentType = constraintParentType[kind];
          if (!expectedParentType) {
            throw new Error(`El punto "${raw.id}" usa una restriccion no soportada: ${kind || '(vacia)'}.`);
          }

          raw.constraint.kind = kind;
          raw.constraint.objectId = String(raw.constraint.objectId || '').trim();

          const parent = requireRef(raw.id, 'constraint.objectId', raw.constraint.objectId);
          if (parent.type !== expectedParentType) {
            throw new Error(`El punto "${raw.id}" requiere un objeto de tipo "${expectedParentType}" en su restriccion.`);
          }
        }

        continue;
      }

      if (raw.type === 'midpoint') {
        requirePointRef(raw.id, 'p1', raw.p1);
        requirePointRef(raw.id, 'p2', raw.p2);
        continue;
      }

      if (raw.type === 'segment' || raw.type === 'line' || raw.type === 'ray') {
        requirePointRef(raw.id, 'p1', raw.p1);
        requirePointRef(raw.id, 'p2', raw.p2);
        continue;
      }

      if (raw.type === 'circle') {
        requirePointRef(raw.id, 'center', raw.center);
        requirePointRef(raw.id, 'through', raw.through);
        continue;
      }

      if (raw.type === 'ellipse') {
        requirePointRef(raw.id, 'center', raw.center);
        raw.rx = safeNumber(raw.rx, NaN);
        raw.ry = safeNumber(raw.ry, NaN);
        raw.rotation = safeNumber(raw.rotation, 0);

        if (!(raw.rx > 1e-9)) {
          throw new Error(`La elipse "${raw.id}" debe tener rx mayor que 0.`);
        }

        if (!(raw.ry > 1e-9)) {
          throw new Error(`La elipse "${raw.id}" debe tener ry mayor que 0.`);
        }

        continue;
      }

      if (raw.type === 'polygon') {
        if (!Array.isArray(raw.points) || raw.points.length < 3) {
          throw new Error(`El poligono "${raw.id}" debe tener al menos 3 puntos.`);
        }

        raw.points.forEach((refId, index) => requirePointRef(raw.id, `points[${index}]`, refId));
        continue;
      }

      if (raw.type === 'measure') {
        raw.measureType = String(raw.measureType || '').trim();
        raw.unit = String(raw.unit || 'deg').trim().toLowerCase();

        if (!['distance', 'angle'].includes(raw.measureType)) {
          throw new Error(`La medida "${raw.id}" usa un tipo no soportado: ${raw.measureType || '(vacio)'}.`);
        }

        if (raw.measureType === 'distance') {
          if (!Array.isArray(raw.of) || raw.of.length !== 2) {
            throw new Error(`La medida "${raw.id}" debe referenciar exactamente 2 puntos.`);
          }

          raw.of.forEach((refId, index) => requirePointRef(raw.id, `of[${index}]`, refId));
          continue;
        }

        if (!Array.isArray(raw.of) || raw.of.length !== 3) {
          throw new Error(`El ángulo "${raw.id}" debe referenciar exactamente 3 puntos.`);
        }

        if (!['deg', 'rad'].includes(raw.unit)) {
          throw new Error(`El ángulo "${raw.id}" usa una unidad no soportada: ${raw.unit || '(vacia)'}.`);
        }

        raw.of.forEach((refId, index) => requirePointRef(raw.id, `of[${index}]`, refId));
        continue;
      }

      if (raw.type === 'text') {
        raw.x = safeNumber(raw.x, NaN);
        raw.y = safeNumber(raw.y, NaN);
        raw.text = String(raw.text ?? raw.label ?? '').trim();

        if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
          throw new Error(`El texto "${raw.id}" debe tener coordenadas validas.`);
        }

        if (!raw.text) {
          throw new Error(`El texto "${raw.id}" debe incluir contenido.`);
        }
      }
    }

    const refsMap = new Map(scene.objects.map(raw => [raw.id, getRawObjectRefs(raw)]));
    const visited = new Set();
    const visiting = new Set();

    function visit(id, trail = []) {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        const cycleStart = trail.indexOf(id);
        const cycle = (cycleStart >= 0 ? trail.slice(cycleStart) : trail).concat(id);
        throw new Error(`Hay una dependencia ciclica: ${cycle.join(' -> ')}.`);
      }

      visiting.add(id);
      const nextTrail = trail.concat(id);

      for (const ref of refsMap.get(id) || []) {
        if (refsMap.has(ref)) visit(ref, nextTrail);
      }

      visiting.delete(id);
      visited.add(id);
    }

    for (const raw of scene.objects) {
      visit(raw.id);
    }

    return scene;
  }

  function prepareScene(scene) {
    const out = ensureScene(scene);

    out.version = Math.max(1, Math.floor(safeNumber(out.version, 1)));
    out.meta = out.meta && typeof out.meta === 'object' ? out.meta : {};
    out.meta.title = String(out.meta.title || 'Escena Geo2D');

    out.viewport = out.viewport && typeof out.viewport === 'object' ? out.viewport : {};
    out.viewport.xMin = safeNumber(out.viewport.xMin, -10);
    out.viewport.xMax = safeNumber(out.viewport.xMax, 10);
    out.viewport.yMin = safeNumber(out.viewport.yMin, -10);
    out.viewport.yMax = safeNumber(out.viewport.yMax, 10);
    out.viewport.showGrid = out.viewport.showGrid !== false;
    out.viewport.showAxes = out.viewport.showAxes !== false;
    out.viewport.lockAspect = out.viewport.lockAspect !== false;

    if (!(out.viewport.xMax > out.viewport.xMin)) {
      throw new Error('El viewport es invalido: xMax debe ser mayor que xMin.');
    }

    if (!(out.viewport.yMax > out.viewport.yMin)) {
      throw new Error('El viewport es invalido: yMax debe ser mayor que yMin.');
    }

    out.style = out.style && typeof out.style === 'object' ? out.style : {};
    out.style.pointRadius = Math.max(1, safeNumber(out.style.pointRadius, 5));
    out.style.pointCaptureRadius = Math.max(out.style.pointRadius, safeNumber(out.style.pointCaptureRadius, 14));
    out.style.strokeWidth = Math.max(1, safeNumber(out.style.strokeWidth, 2));
    out.style.fontSize = Math.max(8, safeNumber(out.style.fontSize, 14));

    return validateScene(out);
  }

  function serializeSceneForHtml(scene) {
    return JSON.stringify(scene, null, 2).replace(/</g, '\\u003c');
  }

  /* =========================================================
     ESCENA
     ========================================================= */
  function ensureScene(scene) {
    const base = {
      version: 1,
      meta: { title: 'Escena Geo2D' },
      viewport: {
        xMin: -10,
        xMax: 10,
        yMin: -10,
        yMax: 10,
        showGrid: true,
        showAxes: true,
        lockAspect: true
      },
      style: {
        pointRadius: 5,
        pointCaptureRadius: 14,
        strokeWidth: 2,
        fontSize: 14
      },
      objects: []
    };

    const out = deepClone(base);

    if (scene && typeof scene === 'object') {
      if (scene.meta) out.meta = { ...out.meta, ...scene.meta };
      if (scene.viewport) out.viewport = { ...out.viewport, ...scene.viewport };
      if (scene.style) out.style = { ...out.style, ...scene.style };
      if (Array.isArray(scene.objects)) out.objects = deepClone(scene.objects);
    }

    return out;
  }

  function parseSceneText(text) {
    let raw = String(text || '').trim();
    if (!raw) throw new Error('No hay contenido.');

    const dataMatch =
      raw.match(/data-scene='([\s\S]*?)'/i) ||
      raw.match(/data-scene="([\s\S]*?)"/i);

    if (dataMatch) {
      raw = unescapeHtmlSceneText(dataMatch[1].trim());
    } else {
      const scriptContent = extractJsonScriptContent(raw);

      if (scriptContent !== null) {
        raw = scriptContent;
      } else if (/^\s*</.test(raw)) {
        throw new Error('No se encontro una escena Geo2D dentro del HTML.');
      }
    }

    try {
      return prepareScene(JSON.parse(raw));
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('El contenido no es un JSON valido.');
      }
      throw err;
    }
  }

  function loadSceneFromOptions(options = {}) {
    if (options.scene) return prepareScene(options.scene);
    if (options.sceneSource) return parseSceneText(readSceneSource(options.sceneSource));
    return defaultScene();
  }

  function jsonPretty(obj) {
    return JSON.stringify(obj, null, 2);
  }

  function defaultScene() {
    return ensureScene({
      meta: { title: 'Nueva escena' },
      objects: [
        { id: 'A', type: 'point', x: -3, y: 1, label: 'A', draggable: true, style: { fill: '#ea580c' } },
        { id: 'B', type: 'point', x: 3, y: 2, label: 'B', draggable: true, style: { fill: '#ea580c' } },
        { id: 'sAB', type: 'segment', p1: 'A', p2: 'B', style: { stroke: '#1976d2' } },
        { id: 'M', type: 'midpoint', p1: 'A', p2: 'B', label: 'M', style: { fill: '#2e7d32' } },
        { id: 'mAB', type: 'measure', measureType: 'distance', of: ['A', 'B'], label: 'AB' }
      ]
    });
  }

  /* =========================================================
     ESTILOS
     ========================================================= */
  function getEditorStyles() {
    return `
      .geo2d-root {
        all: initial !important;
        display: flex !important;
        flex-direction: column !important;
        font-family: Arial, sans-serif !important;
        background-color: #ffffff !important;
        border: 1px solid #d7dce3 !important;
        border-radius: 14px !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .geo2d-root * { box-sizing: border-box !important; }
      .geo2d-toolbar {
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        padding: 12px !important;
        background-color: #f6f8fb !important;
        border-bottom: 1px solid #d7dce3 !important;
      }
      .geo2d-btn {
        background: #ffffff !important;
        border: 1px solid #d7dce3 !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
      }
      .geo2d-toolbar input {
        border: 1px solid #d7dce3 !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        color: #000000 !important;
        background: #fff !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
      }

.geo2d-body {
  display: grid !important;
  grid-template-columns: 180px 1fr 300px !important;
  min-height: 600px !important;
}
@media (max-width: 1100px) {
  .geo2d-body { grid-template-columns: 1fr !important; }
  .geo2d-side,
  .geo2d-right {
    border-right: none !important;
    border-bottom: 1px solid #d7dce3 !important;
  }
}


.geo2d-right {
  border-left: 1px solid #d7dce3 !important;
  background-color: #f9fafb !important;
  padding: 12px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  min-width: 0 !important;
}

.geo2d-section {
  background: #ffffff !important;
  border: 1px solid #d7dce3 !important;
  border-radius: 10px !important;
  padding: 10px !important;
}

.geo2d-object-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  max-height: 320px !important;
  overflow: auto !important;
}

.geo2d-list-group {
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
}

.geo2d-list-title {
  font-size: 12px !important;
  font-weight: bold !important;
  color: #4b5563 !important;
  text-transform: uppercase !important;
}

.geo2d-list-item {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 8px !important;
  padding: 8px 10px !important;
  border: 1px solid #d7dce3 !important;
  border-radius: 8px !important;
  background: #ffffff !important;
  cursor: pointer !important;
  font-size: 13px !important;
  color: #111827 !important;
}

.geo2d-list-item.active {
  border-color: #7c3aed !important;
  background: rgba(124,58,237,0.08) !important;
}

.geo2d-list-item.hidden {
  opacity: 0.6 !important;
}

.geo2d-props {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
}

.geo2d-field {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}

.geo2d-field label {
  font-size: 12px !important;
  color: #4b5563 !important;
  font-weight: bold !important;
}

.geo2d-field input,
.geo2d-field select {
  border: 1px solid #d7dce3 !important;
  border-radius: 8px !important;
  padding: 8px 10px !important;
  font-size: 13px !important;
  color: #111827 !important;
  background: #ffffff !important;
}

.geo2d-check {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-size: 13px !important;
  color: #111827 !important;
}



      .geo2d-side {
        border-right: 1px solid #d7dce3 !important;
        background-color: #f9fafb !important;
        padding: 12px !important;
      }
      .geo2d-title {
        margin: 0 0 12px 0 !important;
        font-size: 12px !important;
        font-weight: bold !important;
        text-transform: uppercase !important;
        font-family: Arial, sans-serif !important;
        color: #000000 !important;
      }
      .geo2d-toolgrid { display: grid !important; gap: 6px !important; }
      .geo2d-toolbtn {
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
        padding: 10px 12px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: 0.1s !important;
        border: 1px solid transparent !important;
      }
      .geo2d-main {
        display: flex !important;
        flex-direction: column !important;
        min-width: 0 !important;
      }
      .geo2d-tabs {
        display: flex !important;
        gap: 4px !important;
        padding: 12px 12px 0 12px !important;
        background-color: #ffffff !important;
        border-bottom: 1px solid #d7dce3 !important;
      }
      .geo2d-tab {
        padding: 8px 16px !important;
        border: 1px solid #d7dce3 !important;
        border-radius: 8px 8px 0 0 !important;
        cursor: pointer !important;
      }
      .geo2d-panels {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        position: relative !important;
        background: #fff !important;
      }
      .geo2d-panel {
        flex: 1 !important;
        flex-direction: column !important;
        height: 100% !important;
        width: 100% !important;
      }
      .geo2d-canvas-wrap {
        flex: 1 !important;
        min-height: 500px !important;
        position: relative !important;
        background: #ffffff !important;
      }
      .geo2d-canvas-wrap svg {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        touch-action: none !important;
      }
      .geo2d-status {
        padding: 8px 12px !important;
        border-top: 1px solid #d7dce3 !important;
        background-color: #f9fafb !important;
        color: #000000 !important;
        font-size: 13px !important;
        font-family: Arial, sans-serif !important;
      }
      .geo2d-json-wrap {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
      }
      .geo2d-json-wrap textarea {
        flex: 1 !important;
        width: 100% !important;
        border: none !important;
        padding: 16px !important;
        font-family: monospace !important;
        font-size: 14px !important;
        color: #000000 !important;
        outline: none !important;
        resize: none !important;
      }
      .geo2d-json-actions {
        display: flex !important;
        gap: 8px !important;
        padding: 12px !important;
        border-top: 1px solid #d7dce3 !important;
        background-color: #f9fafb !important;
      }
      .geo2d-modal-backdrop {
        position: fixed !important;
        inset: 0 !important;
        background-color: rgba(0,0,0,0.5) !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 999999 !important;
        padding: 16px !important;
      }
      .geo2d-modal {
        width: min(900px, 96vw) !important;
        background-color: #ffffff !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }
      .geo2d-modal-head {
        padding: 16px !important;
        border-bottom: 1px solid #d7dce3 !important;
        background-color: #f6f8fb !important;
        color: #000000 !important;
        font-weight: bold !important;
        font-family: Arial, sans-serif !important;
      }
      .geo2d-modal-body textarea {
        width: 100% !important;
        height: 50vh !important;
        border: none !important;
        padding: 16px !important;
        font-family: monospace !important;
        color: #000000 !important;
      }
      .geo2d-modal-foot {
        padding: 16px !important;
        border-top: 1px solid #d7dce3 !important;
        display: flex !important;
        gap: 8px !important;
        background-color: #f6f8fb !important;
      }
      .geo2d-legendline {
        font-size: 12px !important;
        fill: #374151 !important;
        font-family: Arial, sans-serif !important;
      }
      .geo2d-measure-label {
        font-size: 12px !important;
        fill: #374151 !important;
        paint-order: stroke !important;
        stroke: #ffffff !important;
        stroke-width: 3px !important;
        font-weight: bold !important;
        font-family: Arial, sans-serif !important;
      }
      .geo2d-preview-stroke {
        stroke-dasharray: 8 6 !important;
        opacity: 0.9 !important;
      }
    `;
  }

  /* =========================================================
     SVG Y COORDENADAS
     ========================================================= */
  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) el.setAttribute(k, String(v));
    }
    return el;
  }

  function getViewTransform(vp, w, h) {
    const spanX = vp.xMax - vp.xMin;
    const spanY = vp.yMax - vp.yMin;

    if (!vp.lockAspect) {
      return {
        scaleX: w / spanX,
        scaleY: h / spanY,
        offsetX: 0,
        offsetY: 0,
        uniform: false
      };
    }

    const scale = Math.min(w / spanX, h / spanY);
    const drawW = spanX * scale;
    const drawH = spanY * scale;

    return {
      scaleX: scale,
      scaleY: scale,
      offsetX: (w - drawW) / 2,
      offsetY: (h - drawH) / 2,
      uniform: true
    };
  }

  function getDrawableRect(vp, w, h) {
    const t = getViewTransform(vp, w, h);
    return {
      x: t.offsetX,
      y: t.offsetY,
      width: (vp.xMax - vp.xMin) * t.scaleX,
      height: (vp.yMax - vp.yMin) * t.scaleY
    };
  }

  function worldToScreen(vp, w, h, x, y) {
    const t = getViewTransform(vp, w, h);
    return {
      x: t.offsetX + (x - vp.xMin) * t.scaleX,
      y: h - t.offsetY - (y - vp.yMin) * t.scaleY
    };
  }

  function screenToWorld(vp, w, h, sx, sy) {
    const t = getViewTransform(vp, w, h);
    return {
      x: vp.xMin + (sx - t.offsetX) / t.scaleX,
      y: vp.yMin + ((h - t.offsetY) - sy) / t.scaleY
    };
  }

  function viewportZoom(vp, factor, cx, cy) {
    return {
      ...vp,
      xMin: cx + (vp.xMin - cx) * factor,
      xMax: cx + (vp.xMax - cx) * factor,
      yMin: cy + (vp.yMin - cy) * factor,
      yMax: cy + (vp.yMax - cy) * factor
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
    return (n > 5 ? 10 : n > 2 ? 5 : n > 1 ? 2 : 1) * pow;
  }

  function circleScreenRadius(vp, w, h, cx, cy, r) {
    const c = worldToScreen(vp, w, h, cx, cy);
    const ex = worldToScreen(vp, w, h, cx + r, cy);
    const ey = worldToScreen(vp, w, h, cx, cy + r);

    return {
      cx: c.x,
      cy: c.y,
      r: Math.min(Math.abs(ex.x - c.x), Math.abs(ey.y - c.y))
    };
  }

  function isPointInsideViewport(vp, p) {
    return (
      p.x >= vp.xMin - 1e-9 &&
      p.x <= vp.xMax + 1e-9 &&
      p.y >= vp.yMin - 1e-9 &&
      p.y <= vp.yMax + 1e-9
    );
  }

  function lineViewportIntersections(vp, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return [];

    const hits = [];

    function pushHit(t, x, y) {
      if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x < vp.xMin - 1e-9 || x > vp.xMax + 1e-9) return;
      if (y < vp.yMin - 1e-9 || y > vp.yMax + 1e-9) return;
      if (hits.some(hit => dist2(hit.point.x, hit.point.y, x, y) < 1e-12)) return;
      hits.push({ t, point: { x, y } });
    }

    if (Math.abs(dx) > 1e-9) {
      const tMin = (vp.xMin - p1.x) / dx;
      pushHit(tMin, vp.xMin, p1.y + tMin * dy);

      const tMax = (vp.xMax - p1.x) / dx;
      pushHit(tMax, vp.xMax, p1.y + tMax * dy);
    }

    if (Math.abs(dy) > 1e-9) {
      const tBottom = (vp.yMin - p1.y) / dy;
      pushHit(tBottom, p1.x + tBottom * dx, vp.yMin);

      const tTop = (vp.yMax - p1.y) / dy;
      pushHit(tTop, p1.x + tTop * dx, vp.yMax);
    }

    hits.sort((a, b) => a.t - b.t);
    return hits;
  }

  function rayVisibleSegment(vp, p1, p2) {
    const hits = lineViewportIntersections(vp, p1, p2).filter(hit => hit.t >= -1e-9);
    if (!hits.length) return null;

    if (isPointInsideViewport(vp, p1)) {
      return {
        start: { x: p1.x, y: p1.y },
        end: hits[hits.length - 1].point
      };
    }

    if (hits.length >= 2) {
      return {
        start: hits[0].point,
        end: hits[hits.length - 1].point
      };
    }

    return null;
  }

  function ellipsePoint(center, rx, ry, rotation, angle) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    return {
      x: center.x + rx * cosA * cosR - ry * sinA * sinR,
      y: center.y + rx * cosA * sinR + ry * sinA * cosR
    };
  }

  function ellipseLocalCoordinates(center, rotation, x, y) {
    const dx = x - center.x;
    const dy = y - center.y;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    return {
      x: dx * cosR + dy * sinR,
      y: -dx * sinR + dy * cosR
    };
  }

  function ellipseAngleFromWorld(center, rx, ry, rotation, x, y) {
    const local = ellipseLocalCoordinates(center, rotation, x, y);
    const safeRx = Math.max(Math.abs(rx), 1e-9);
    const safeRy = Math.max(Math.abs(ry), 1e-9);
    return Math.atan2(local.y / safeRy, local.x / safeRx);
  }

  function ellipseWorldPoints(center, rx, ry, rotation, steps = 72) {
    const points = [];
    const count = Math.max(12, Math.floor(steps));

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push(ellipsePoint(center, rx, ry, rotation, angle));
    }

    return points;
  }

  function screenPointsPath(points, closed = false) {
    if (!points || !points.length) return '';

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }

    if (closed) d += ' Z';
    return d;
  }

  function p2screenSegmentSquared(sx, sy, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
    const t = clamp(((sx - a.x) * dx + (sy - a.y) * dy) / len2, 0, 1);
    return dist2(sx, sy, a.x + t * dx, a.y + t * dy);
  }

  function p2screenPolylineSquared(sx, sy, points, closed = false) {
    if (!points || points.length < 2) return Infinity;

    let best = Infinity;
    const last = closed ? points.length : points.length - 1;

    for (let i = 0; i < last; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      best = Math.min(best, p2screenSegmentSquared(sx, sy, a, b));
    }

    return best;
  }

  function ellipseScreenPoints(vp, w, h, resolved, steps = 72) {
    return ellipseWorldPoints(resolved.center, resolved.rx, resolved.ry, resolved.rotation, steps)
      .map(p => worldToScreen(vp, w, h, p.x, p.y));
  }

  function textScreenBounds(vp, w, h, resolved, fontSize) {
    const anchor = worldToScreen(vp, w, h, resolved.x, resolved.y);
    const size = Math.max(8, safeNumber(fontSize, 14));
    const width = Math.max(size * 0.7, String(resolved.text || '').length * size * 0.62);
    const height = size * 1.35;

    return {
      anchor,
      x: anchor.x - 4,
      y: anchor.y - size - 4,
      width: width + 8,
      height: height + 8
    };
  }

  function p2rectSquared(sx, sy, rect) {
    const dx =
      sx < rect.x ? rect.x - sx :
      sx > rect.x + rect.width ? sx - (rect.x + rect.width) :
      0;
    const dy =
      sy < rect.y ? rect.y - sy :
      sy > rect.y + rect.height ? sy - (rect.y + rect.height) :
      0;

    return dx * dx + dy * dy;
  }

  function normalizeAngleSigned(angle) {
    let out = safeNumber(angle, 0);
    while (out <= -Math.PI) out += Math.PI * 2;
    while (out > Math.PI) out -= Math.PI * 2;
    return out;
  }

  function resolveAngleMeasureInfo(a, b, c, unit, viewport) {
    const angleAB = Math.atan2(a.y - b.y, a.x - b.x);
    const angleCB = Math.atan2(c.y - b.y, c.x - b.x);
    const signedDelta = normalizeAngleSigned(angleCB - angleAB);
    const delta = Math.abs(signedDelta);

    const span = Math.max(
      1e-6,
      Math.min(
        safeNumber(viewport?.xMax, 10) - safeNumber(viewport?.xMin, -10),
        safeNumber(viewport?.yMax, 10) - safeNumber(viewport?.yMin, -10)
      )
    );
    const leg = Math.min(dist(a.x, a.y, b.x, b.y), dist(c.x, c.y, b.x, b.y));
    const radius = clamp(leg * 0.28, span * 0.03, span * 0.12);

    const startAngle = signedDelta >= 0 ? angleAB : angleCB;
    const bisectorAngle = startAngle + delta / 2;
    const labelDistance = radius * 1.45;
    const value = unit === 'rad' ? delta : (delta * 180) / Math.PI;
    const text =
      unit === 'rad'
        ? `${value.toFixed(3)} rad`
        : `${value.toFixed(1)}°`;

    return {
      vertex: { x: b.x, y: b.y },
      radius,
      startAngle,
      delta,
      anchor: {
        x: b.x + Math.cos(bisectorAngle) * labelDistance,
        y: b.y + Math.sin(bisectorAngle) * labelDistance
      },
      text
    };
  }

  function angleArcWorldPoints(vertex, radius, startAngle, delta, steps = 24) {
    const count = Math.max(6, Math.floor(steps));
    const points = [];

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const angle = startAngle + delta * t;
      points.push({
        x: vertex.x + Math.cos(angle) * radius,
        y: vertex.y + Math.sin(angle) * radius
      });
    }

    return points;
  }

  /* =========================================================
     ESTILOS
     ========================================================= */
  function mergeStyle(sceneLike, rawObj, overrides = {}) {
    return {
      stroke: '#1f2937',
      fill: 'none',
      strokeWidth: sceneLike.style.strokeWidth || 2,
      fontSize: sceneLike.style.fontSize || 14,
      pointRadius: sceneLike.style.pointRadius || 5,
      pointCaptureRadius: sceneLike.style.pointCaptureRadius || 14,
      ...(rawObj.style || {}),
      ...overrides
    };
  }

  function getPointVisibleRadius(sceneLike, rawObj) {
    return safeNumber(rawObj.style?.pointRadius, safeNumber(sceneLike.style?.pointRadius, 5));
  }

  function getPointCaptureRadius(sceneLike, rawObj) {
    return safeNumber(rawObj.style?.pointCaptureRadius, safeNumber(sceneLike.style?.pointCaptureRadius, 14));
  }

  /* =========================================================
     POO - RESTRICCIONES
     ========================================================= */
  class Constraint {
    constructor(raw = {}) {
      this.raw = deepClone(raw || {});
      this.kind = this.raw.kind || '';
      this.objectId = this.raw.objectId || '';
    }

    getRefs() {
      return this.objectId ? [this.objectId] : [];
    }

    resolve() {
      return null;
    }

    project() {}

    toJSON() {
      return deepClone(this.raw);
    }
  }

  class OnSegmentConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'on-segment';
      this.raw.t = safeNumber(this.raw.t, 0.5);
    }

    resolve(model) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'segment') return null;

      const t = clamp(safeNumber(this.raw.t, 0.5), 0, 1);
      return pointFromParameter(parent.p1.x, parent.p1.y, parent.p2.x, parent.p2.y, t);
    }

    project(model, x, y) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'segment') return;

      this.raw.t = projectParameter(parent.p1.x, parent.p1.y, parent.p2.x, parent.p2.y, x, y, true);
    }
  }

  class OnLineConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'on-line';
      this.raw.t = safeNumber(this.raw.t, 0);
    }

    resolve(model) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'line') return null;

      const t = safeNumber(this.raw.t, 0);
      return pointFromParameter(parent.p1.x, parent.p1.y, parent.p2.x, parent.p2.y, t);
    }

    project(model, x, y) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'line') return;

      this.raw.t = projectParameter(parent.p1.x, parent.p1.y, parent.p2.x, parent.p2.y, x, y, false);
    }
  }

  class OnRayConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'on-ray';
      this.raw.t = Math.max(0, safeNumber(this.raw.t, 0));
    }

    resolve(model) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'ray') return null;

      const t = Math.max(0, safeNumber(this.raw.t, 0));
      return pointFromParameter(parent.p1.x, parent.p1.y, parent.p2.x, parent.p2.y, t);
    }

    project(model, x, y) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'ray') return;

      this.raw.t = Math.max(0, projectParameter(parent.p1.x, parent.p1.y, parent.p2.x, parent.p2.y, x, y, false));
    }
  }

  class OnCircleConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'on-circle';
      this.raw.angle = safeNumber(this.raw.angle, 0);
    }

    resolve(model) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'circle') return null;

      const angle = safeNumber(this.raw.angle, 0);
      return {
        x: parent.center.x + parent.radius * Math.cos(angle),
        y: parent.center.y + parent.radius * Math.sin(angle)
      };
    }

    project(model, x, y) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'circle') return;

      this.raw.angle = Math.atan2(y - parent.center.y, x - parent.center.x);
    }
  }

  class OnEllipseConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'on-ellipse';
      this.raw.angle = safeNumber(this.raw.angle, 0);
    }

    resolve(model) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'ellipse') return null;

      return ellipsePoint(
        parent.center,
        safeNumber(parent.rx, 1),
        safeNumber(parent.ry, 1),
        safeNumber(parent.rotation, 0),
        safeNumber(this.raw.angle, 0)
      );
    }

    project(model, x, y) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'ellipse') return;

      this.raw.angle = ellipseAngleFromWorld(
        parent.center,
        safeNumber(parent.rx, 1),
        safeNumber(parent.ry, 1),
        safeNumber(parent.rotation, 0),
        x,
        y
      );
    }
  }

  class ConstraintFactory {
    static fromRaw(raw) {
      if (!raw || !raw.kind) return null;
      if (raw.kind === 'on-segment') return new OnSegmentConstraint(raw);
      if (raw.kind === 'on-line') return new OnLineConstraint(raw);
      if (raw.kind === 'on-ray') return new OnRayConstraint(raw);
      if (raw.kind === 'on-circle') return new OnCircleConstraint(raw);
      if (raw.kind === 'on-ellipse') return new OnEllipseConstraint(raw);
      return new Constraint(raw);
    }
  }

  /* =========================================================
     POO - OBJETOS GEOMÉTRICOS
     ========================================================= */
  class GeoObject {
    constructor(raw = {}) {
      this.raw = deepClone(raw || {});
      this.id = this.raw.id || '';
      this.type = this.raw.type || '';
    }

    isVisible() {
      return this.raw.visible !== false;
    }

    isPointLike() {
      return false;
    }

    getRefs() {
      return [];
    }

    getResolved() {
      return null;
    }

    isDraggable() {
      return false;
    }

    dragTo() {}

    toJSON() {
      return deepClone(this.raw);
    }
  }

  class PointBase extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      if (this.raw.draggable === undefined && this.raw.type === 'point') {
        this.raw.draggable = true;
      }
    }

    isPointLike() {
      return true;
    }

    getPosition() {
      return null;
    }

    isDraggable() {
      return false;
    }

    dragTo() {}
  }

  class FreePoint extends PointBase {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'point';
    }

    getPosition() {
      return {
        x: safeNumber(this.raw.x, 0),
        y: safeNumber(this.raw.y, 0)
      };
    }

    isDraggable() {
      return !!this.raw.draggable;
    }

    dragTo(model, x, y) {
      this.raw.x = x;
      this.raw.y = y;
    }
  }

  class ConstrainedPoint extends PointBase {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'point';
      this.constraint = ConstraintFactory.fromRaw(this.raw.constraint);
    }

    getRefs() {
      return this.constraint ? this.constraint.getRefs() : [];
    }

    getPosition(model) {
      if (!this.constraint) {
        return {
          x: safeNumber(this.raw.x, 0),
          y: safeNumber(this.raw.y, 0)
        };
      }

      const p = this.constraint.resolve(model);
      if (p) return p;

      return {
        x: safeNumber(this.raw.x, 0),
        y: safeNumber(this.raw.y, 0)
      };
    }

    isDraggable() {
      return !!this.raw.draggable;
    }

    dragTo(model, x, y) {
      if (!this.constraint) {
        this.raw.x = x;
        this.raw.y = y;
        return;
      }

      this.constraint.project(model, x, y);
      const snapped = this.constraint.resolve(model);
      if (snapped) {
        this.raw.x = snapped.x;
        this.raw.y = snapped.y;
      }
    }

    toJSON() {
      const out = super.toJSON();
      out.constraint = this.constraint ? this.constraint.toJSON() : undefined;
      return out;
    }
  }

  class MidpointPoint extends PointBase {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'midpoint';
      this.raw.draggable = false;
    }

    getRefs() {
      return [this.raw.p1, this.raw.p2].filter(Boolean);
    }

    getPosition(model) {
      const a = model.getPointPosition(this.raw.p1);
      const b = model.getPointPosition(this.raw.p2);
      if (!a || !b) return null;

      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      };
    }

    isDraggable() {
      return false;
    }
  }

  class SegmentObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'segment';
    }

    getRefs() {
      return [this.raw.p1, this.raw.p2].filter(Boolean);
    }

    getResolved(model) {
      const p1 = model.getPointPosition(this.raw.p1);
      const p2 = model.getPointPosition(this.raw.p2);
      if (!p1 || !p2) return null;
      return { kind: 'segment', p1, p2, ref: this };
    }
  }

  class LineObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'line';
    }

    getRefs() {
      return [this.raw.p1, this.raw.p2].filter(Boolean);
    }

    getResolved(model) {
      const p1 = model.getPointPosition(this.raw.p1);
      const p2 = model.getPointPosition(this.raw.p2);
      if (!p1 || !p2) return null;
      return { kind: 'line', p1, p2, ref: this };
    }
  }

  class RayObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'ray';
    }

    getRefs() {
      return [this.raw.p1, this.raw.p2].filter(Boolean);
    }

    getResolved(model) {
      const p1 = model.getPointPosition(this.raw.p1);
      const p2 = model.getPointPosition(this.raw.p2);
      if (!p1 || !p2) return null;
      return { kind: 'ray', p1, p2, ref: this };
    }
  }

  class CircleObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'circle';
    }

    getRefs() {
      return [this.raw.center, this.raw.through].filter(Boolean);
    }

    getResolved(model) {
      const center = model.getPointPosition(this.raw.center);
      const through = model.getPointPosition(this.raw.through);
      if (!center || !through) return null;

      return {
        kind: 'circle',
        center,
        through,
        radius: dist(center.x, center.y, through.x, through.y),
        ref: this
      };
    }
  }

  class EllipseObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'ellipse';
    }

    getRefs() {
      return [this.raw.center].filter(Boolean);
    }

    getResolved(model) {
      const center = model.getPointPosition(this.raw.center);
      if (!center) return null;

      return {
        kind: 'ellipse',
        center,
        rx: safeNumber(this.raw.rx, 1),
        ry: safeNumber(this.raw.ry, 1),
        rotation: safeNumber(this.raw.rotation, 0),
        ref: this
      };
    }
  }

  class PolygonObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'polygon';
    }

    getRefs() {
      return Array.isArray(this.raw.points) ? [...this.raw.points] : [];
    }

    getResolved(model) {
      const points = (this.raw.points || []).map(id => model.getPointPosition(id)).filter(Boolean);
      if (points.length < 2) return null;
      return { kind: 'polygon', points, ref: this };
    }
  }

  class MeasureObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'measure';
    }

    getRefs() {
      return Array.isArray(this.raw.of) ? [...this.raw.of] : [];
    }

    getResolved() {
      return { kind: 'measure', ref: this };
    }
  }

  class TextObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'text';
    }

    getResolved() {
      return {
        kind: 'text',
        x: safeNumber(this.raw.x, 0),
        y: safeNumber(this.raw.y, 0),
        text: String(this.raw.text ?? this.raw.label ?? ''),
        ref: this
      };
    }

    isDraggable() {
      return this.raw.draggable !== false;
    }

    dragTo(model, x, y) {
      this.raw.x = x;
      this.raw.y = y;
    }
  }

  class UnknownObject extends GeoObject {}

  class GeoFactory {
    static fromRaw(raw) {
      if (!raw || typeof raw !== 'object') return new UnknownObject({});

      if (raw.type === 'point' && raw.constraint) return new ConstrainedPoint(raw);
      if (raw.type === 'point') return new FreePoint(raw);
      if (raw.type === 'midpoint') return new MidpointPoint(raw);
      if (raw.type === 'segment') return new SegmentObject(raw);
      if (raw.type === 'line') return new LineObject(raw);
      if (raw.type === 'ray') return new RayObject(raw);
      if (raw.type === 'circle') return new CircleObject(raw);
      if (raw.type === 'ellipse') return new EllipseObject(raw);
      if (raw.type === 'polygon') return new PolygonObject(raw);
      if (raw.type === 'measure') return new MeasureObject(raw);
      if (raw.type === 'text') return new TextObject(raw);

      return new UnknownObject(raw);
    }
  }

  /* =========================================================
     POO - MODELO DE ESCENA
     ========================================================= */
  class SceneModel {
    constructor(scene) {
      this.replaceScene(scene);
    }

    replaceScene(scene) {
      this.scene = prepareScene(scene);
      this.meta = this.scene.meta;
      this.viewport = this.scene.viewport;
      this.style = this.scene.style;
      this.version = this.scene.version || 1;

      this.objects = [];
      this.objectMap = new Map();

      for (const raw of this.scene.objects) {
        this.addObject(raw);
      }
    }

    addObject(raw) {
      const obj = GeoFactory.fromRaw(raw);
      if (!obj.id) throw new Error('No se puede agregar un objeto sin id.');
      if (this.objectMap.has(obj.id)) throw new Error(`Ya existe un objeto con id "${obj.id}".`);
      this.objects.push(obj);
      this.objectMap.set(obj.id, obj);
      return obj;
    }

    hasId(id) {
      return this.objectMap.has(id);
    }

    getObject(id) {
      return this.objectMap.get(id) || null;
    }

    getPointPosition(id) {
      const obj = this.getObject(id);
      if (!obj || !obj.isPointLike()) return null;
      return obj.getPosition(this);
    }

    getResolvedObject(id) {
      const obj = this.getObject(id);
      if (!obj) return null;

      if (obj.isPointLike()) {
        const p = obj.getPosition(this);
        if (!p) return null;
        return { kind: 'point', x: p.x, y: p.y, ref: obj };
      }

      return obj.getResolved(this);
    }

    allResolved() {
      return this.objects.map(obj => ({
        object: obj,
        resolved: this.getResolvedObject(obj.id)
      }));
    }

    serialize() {
      return ensureScene({
        version: this.version,
        meta: deepClone(this.meta),
        viewport: deepClone(this.viewport),
        style: deepClone(this.style),
        objects: this.objects.map(obj => obj.toJSON())
      });
    }

    removeIds(idsSet) {
      this.objects = this.objects.filter(obj => !idsSet.has(obj.id));
      this.objectMap = new Map(this.objects.map(obj => [obj.id, obj]));
    }
  }

  /* =========================================================
     MEDIDAS
     ========================================================= */
  function resolveMeasure(model, measureObj) {
    const raw = measureObj.raw;
    if (raw.measureType === 'distance' && Array.isArray(raw.of) && raw.of.length === 2) {
      const a = model.getPointPosition(raw.of[0]);
      const b = model.getPointPosition(raw.of[1]);
      if (!a || !b) return null;

      const d = dist(a.x, a.y, b.x, b.y);
      return {
        kind: 'distance',
        anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        text: d.toFixed(2)
      };
    }

    if (raw.measureType === 'angle' && Array.isArray(raw.of) && raw.of.length === 3) {
      const a = model.getPointPosition(raw.of[0]);
      const b = model.getPointPosition(raw.of[1]);
      const c = model.getPointPosition(raw.of[2]);
      if (!a || !b || !c) return null;

      return {
        kind: 'angle',
        ...resolveAngleMeasureInfo(a, b, c, raw.unit || 'deg', model.viewport)
      };
    }

    return null;
  }

  /* =========================================================
     RENDER
     ========================================================= */
  function renderInfiniteLine(group, vp, w, h, p1, p2, attrs) {
    const hits = lineViewportIntersections(vp, p1, p2);
    if (hits.length < 2) return;

    const a = worldToScreen(vp, w, h, hits[0].point.x, hits[0].point.y);
    const b = worldToScreen(vp, w, h, hits[hits.length - 1].point.x, hits[hits.length - 1].point.y);

    group.appendChild(createSvgEl('line', {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      ...attrs
    }));
  }

  function renderRay(group, vp, w, h, p1, p2, attrs) {
    const segment = rayVisibleSegment(vp, p1, p2);
    if (!segment) return;

    const a = worldToScreen(vp, w, h, segment.start.x, segment.start.y);
    const b = worldToScreen(vp, w, h, segment.end.x, segment.end.y);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return;

    const strokeWidth = safeNumber(attrs['stroke-width'], 2);
    const ux = dx / len;
    const uy = dy / len;
    const arrowSize = Math.max(8, strokeWidth * 3 + 4);
    const wing = arrowSize * 0.45;
    const baseX = b.x - ux * arrowSize;
    const baseY = b.y - uy * arrowSize;
    const px = -uy;
    const py = ux;

    group.appendChild(createSvgEl('line', {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      ...attrs
    }));

    group.appendChild(createSvgEl('polygon', {
      points: [
        `${b.x},${b.y}`,
        `${baseX + px * wing},${baseY + py * wing}`,
        `${baseX - px * wing},${baseY - py * wing}`
      ].join(' '),
      fill: attrs.stroke || '#1f2937',
      opacity: attrs.opacity,
      class: attrs.class
    }));
  }

  function toolUsesAnchorPreview(tool) {
    return ['point', 'segment', 'line', 'ray', 'circle', 'ellipse', 'polygon', 'midpoint', 'measure-distance', 'measure-angle', 'text'].includes(tool);
  }

  function getToolPreviewColor(tool) {
    const previewColorMap = {
      point: '#ea580c',
      segment: '#1976d2',
      line: '#2e7d32',
      ray: '#0f766e',
      circle: '#c62828',
      ellipse: '#9333ea',
      polygon: '#ea580c',
      midpoint: '#2e7d32',
      'measure-distance': '#6b7280',
      'measure-angle': '#6b7280',
      text: '#111827'
    };

    return previewColorMap[tool] || '#2563eb';
  }

  function getPreviewAnchor(state, model) {
    if (state._hoverPointId) {
      const p = model.getPointPosition(state._hoverPointId);
      if (p) return { x: p.x, y: p.y, fromPointId: state._hoverPointId };
    }

    if (state._previewWorld) {
      return { x: state._previewWorld.x, y: state._previewWorld.y, fromPointId: null };
    }

    return null;
  }

  function renderSceneToSvg(svg, model, state) {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(300, rect.width || 800);
    const height = Math.max(300, rect.height || 600);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = '';

    const vp = model.viewport;
    const drawRect = getDrawableRect(vp, width, height);

    const pendingPointIds = new Set(state._pendingPoints || []);
    const hoverPointId = state._hoverPointId || null;
    const selectedObjectId = state.selectedObjectId || null;

    const defs = createSvgEl('defs');
    const clipPath = createSvgEl('clipPath', { id: `${state._instanceId}-clip` });
    clipPath.appendChild(createSvgEl('rect', {
      x: drawRect.x,
      y: drawRect.y,
      width: drawRect.width,
      height: drawRect.height
    }));
    defs.appendChild(clipPath);

    const gBackground = createSvgEl('g');
    const gGrid = createSvgEl('g', { 'clip-path': `url(#${state._instanceId}-clip)` });
    const gAxes = createSvgEl('g', { 'clip-path': `url(#${state._instanceId}-clip)` });
    const gShapes = createSvgEl('g', { 'clip-path': `url(#${state._instanceId}-clip)` });
    const gPreview = createSvgEl('g', { 'clip-path': `url(#${state._instanceId}-clip)` });
    const gMeasures = createSvgEl('g', { 'clip-path': `url(#${state._instanceId}-clip)` });
    const gPointTargets = createSvgEl('g', { 'clip-path': `url(#${state._instanceId}-clip)` });
    const gPoints = createSvgEl('g', { 'clip-path': `url(#${state._instanceId}-clip)` });
    const gLabels = createSvgEl('g', { 'clip-path': `url(#${state._instanceId}-clip)` });

    svg.append(defs, gBackground, gGrid, gAxes, gShapes, gPreview, gMeasures, gPointTargets, gPoints, gLabels);

    gBackground.appendChild(createSvgEl('rect', {
      x: 0,
      y: 0,
      width,
      height,
      fill: '#f8fafc'
    }));

    gBackground.appendChild(createSvgEl('rect', {
      x: drawRect.x,
      y: drawRect.y,
      width: drawRect.width,
      height: drawRect.height,
      fill: '#ffffff',
      stroke: '#e5e7eb',
      'stroke-width': 1
    }));

    if (vp.showGrid) {
      const spanX = vp.xMax - vp.xMin;
      const spanY = vp.yMax - vp.yMin;
      const baseStep = vp.lockAspect ? niceStep(Math.min(spanX, spanY)) : null;
      const sx = vp.lockAspect ? baseStep : niceStep(spanX);
      const sy = vp.lockAspect ? baseStep : niceStep(spanY);

      for (let x = Math.ceil(vp.xMin / sx) * sx; x <= vp.xMax + 1e-9; x += sx) {
        const px = worldToScreen(vp, width, height, x, 0).x;
        gGrid.appendChild(createSvgEl('line', {
          x1: px,
          y1: drawRect.y,
          x2: px,
          y2: drawRect.y + drawRect.height,
          stroke: '#edf0f4',
          'stroke-width': 1
        }));
      }

      for (let y = Math.ceil(vp.yMin / sy) * sy; y <= vp.yMax + 1e-9; y += sy) {
        const py = worldToScreen(vp, width, height, 0, y).y;
        gGrid.appendChild(createSvgEl('line', {
          x1: drawRect.x,
          y1: py,
          x2: drawRect.x + drawRect.width,
          y2: py,
          stroke: '#edf0f4',
          'stroke-width': 1
        }));
      }
    }

    if (vp.showAxes) {
      if (vp.xMin <= 0 && vp.xMax >= 0) {
        const px = worldToScreen(vp, width, height, 0, 0).x;
        gAxes.appendChild(createSvgEl('line', {
          x1: px,
          y1: drawRect.y,
          x2: px,
          y2: drawRect.y + drawRect.height,
          stroke: '#9aa4b2',
          'stroke-width': 1.5
        }));
      }

      if (vp.yMin <= 0 && vp.yMax >= 0) {
        const py = worldToScreen(vp, width, height, 0, 0).y;
        gAxes.appendChild(createSvgEl('line', {
          x1: drawRect.x,
          y1: py,
          x2: drawRect.x + drawRect.width,
          y2: py,
          stroke: '#9aa4b2',
          'stroke-width': 1.5
        }));
      }
    }

    for (const { object, resolved } of model.allResolved()) {
      if (!object.isVisible()) continue;
      if (!resolved) continue;

      const style = mergeStyle(model, object.raw);
      const isSelected = object.id === selectedObjectId;


if (resolved.kind === 'segment') {
  const a = worldToScreen(vp, width, height, resolved.p1.x, resolved.p1.y);
  const b = worldToScreen(vp, width, height, resolved.p2.x, resolved.p2.y);

  if (isSelected) {
    gShapes.appendChild(createSvgEl('line', {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 4,
      opacity: 0.25
    }));
  }

  gShapes.appendChild(createSvgEl('line', {
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    stroke: style.stroke,
    'stroke-width': style.strokeWidth
  }));
}




if (resolved.kind === 'line') {
  if (isSelected) {
    renderInfiniteLine(gShapes, vp, width, height, resolved.p1, resolved.p2, {
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 4,
      opacity: 0.25
    });
  }

  renderInfiniteLine(gShapes, vp, width, height, resolved.p1, resolved.p2, {
    stroke: style.stroke,
    'stroke-width': style.strokeWidth
  });
}

if (resolved.kind === 'ray') {
  if (isSelected) {
    renderRay(gShapes, vp, width, height, resolved.p1, resolved.p2, {
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 4,
      opacity: 0.25
    });
  }

  renderRay(gShapes, vp, width, height, resolved.p1, resolved.p2, {
    stroke: style.stroke,
    'stroke-width': style.strokeWidth
  });
}

if (resolved.kind === 'circle') {
  const cs = circleScreenRadius(vp, width, height, resolved.center.x, resolved.center.y, resolved.radius);

  if (isSelected) {
    gShapes.appendChild(createSvgEl('circle', {
      cx: cs.cx,
      cy: cs.cy,
      r: cs.r,
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 4,
      opacity: 0.25,
      fill: 'none'
    }));
  }

  gShapes.appendChild(createSvgEl('circle', {
    cx: cs.cx,
    cy: cs.cy,
    r: cs.r,
    stroke: style.stroke,
    'stroke-width': style.strokeWidth,
    fill: style.fill || 'none'
  }));
}

if (resolved.kind === 'ellipse') {
  const screenPts = ellipseScreenPoints(vp, width, height, resolved, 96);
  const path = screenPointsPath(screenPts, true);

  if (isSelected) {
    gShapes.appendChild(createSvgEl('path', {
      d: path,
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 4,
      opacity: 0.25,
      fill: 'none'
    }));
  }

  gShapes.appendChild(createSvgEl('path', {
    d: path,
    stroke: style.stroke,
    'stroke-width': style.strokeWidth,
    fill: style.fill || 'none'
  }));
}


if (resolved.kind === 'polygon') {
  const pts = resolved.points.map(p => {
    const s = worldToScreen(vp, width, height, p.x, p.y);
    return `${s.x},${s.y}`;
  }).join(' ');

  if (isSelected) {
    gShapes.appendChild(createSvgEl('polygon', {
      points: pts,
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 4,
      opacity: 0.25,
      fill: 'none'
    }));
  }

  gShapes.appendChild(createSvgEl('polygon', {
    points: pts,
    stroke: style.stroke,
    'stroke-width': style.strokeWidth,
    fill: style.fill || 'none'
  }));
}


if (resolved.kind === 'measure' && object instanceof MeasureObject) {
  const info = resolveMeasure(model, object);

  if (info) {
    if (info.kind === 'angle') {
      const armStroke = style.stroke || '#6b7280';
      const armWidth = Math.max(1.5, style.strokeWidth);
      const armStart = {
        x: info.vertex.x + Math.cos(info.startAngle) * info.radius,
        y: info.vertex.y + Math.sin(info.startAngle) * info.radius
      };
      const armEnd = {
        x: info.vertex.x + Math.cos(info.startAngle + info.delta) * info.radius,
        y: info.vertex.y + Math.sin(info.startAngle + info.delta) * info.radius
      };
      const vertexScreen = worldToScreen(vp, width, height, info.vertex.x, info.vertex.y);
      const armStartScreen = worldToScreen(vp, width, height, armStart.x, armStart.y);
      const armEndScreen = worldToScreen(vp, width, height, armEnd.x, armEnd.y);
      const arcPath = screenPointsPath(
        angleArcWorldPoints(info.vertex, info.radius, info.startAngle, info.delta, 28)
          .map(p => worldToScreen(vp, width, height, p.x, p.y)),
        false
      );

      if (isSelected) {
        gMeasures.appendChild(createSvgEl('line', {
          x1: vertexScreen.x,
          y1: vertexScreen.y,
          x2: armStartScreen.x,
          y2: armStartScreen.y,
          stroke: '#7c3aed',
          'stroke-width': armWidth + 3,
          opacity: 0.2
        }));
        gMeasures.appendChild(createSvgEl('line', {
          x1: vertexScreen.x,
          y1: vertexScreen.y,
          x2: armEndScreen.x,
          y2: armEndScreen.y,
          stroke: '#7c3aed',
          'stroke-width': armWidth + 3,
          opacity: 0.2
        }));
        gMeasures.appendChild(createSvgEl('path', {
          d: arcPath,
          stroke: '#7c3aed',
          'stroke-width': armWidth + 3,
          opacity: 0.2,
          fill: 'none'
        }));
      }

      gMeasures.appendChild(createSvgEl('line', {
        x1: vertexScreen.x,
        y1: vertexScreen.y,
        x2: armStartScreen.x,
        y2: armStartScreen.y,
        stroke: armStroke,
        'stroke-width': armWidth
      }));
      gMeasures.appendChild(createSvgEl('line', {
        x1: vertexScreen.x,
        y1: vertexScreen.y,
        x2: armEndScreen.x,
        y2: armEndScreen.y,
        stroke: armStroke,
        'stroke-width': armWidth
      }));
      gMeasures.appendChild(createSvgEl('path', {
        d: arcPath,
        stroke: armStroke,
        'stroke-width': armWidth,
        fill: 'none'
      }));
    }

    const p = worldToScreen(vp, width, height, info.anchor.x, info.anchor.y);

    if (isSelected) {
      gMeasures.appendChild(createSvgEl('circle', {
        cx: p.x,
        cy: p.y,
        r: 8,
        fill: 'rgba(124,58,237,0.12)',
        stroke: '#7c3aed',
        'stroke-width': 2
      }));
    }

    const txt = createSvgEl('text', {
      x: p.x + 8,
      y: p.y - 8,
      class: 'geo2d-measure-label'
    });
    txt.textContent = object.raw.label ? `${object.raw.label}: ${info.text}` : info.text;
    gMeasures.appendChild(txt);
  }
}

if (resolved.kind === 'text') {
  const textValue = String(resolved.text || '');
  const bounds = textScreenBounds(vp, width, height, resolved, style.fontSize);

  if (isSelected) {
    gShapes.appendChild(createSvgEl('rect', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      rx: 6,
      ry: 6,
      fill: 'rgba(124,58,237,0.10)',
      stroke: '#7c3aed',
      'stroke-width': 2
    }));
  }

  const txt = createSvgEl('text', {
    x: bounds.anchor.x,
    y: bounds.anchor.y,
    class: 'geo2d-legendline',
    'font-size': style.fontSize,
    fill: style.fill && style.fill !== 'none' ? style.fill : (style.stroke || '#111827')
  });
  txt.textContent = textValue;
  gLabels.appendChild(txt);
}

 
    }

    const previewAnchor = getPreviewAnchor(state, model);
    const previewColor = getToolPreviewColor(state.activeTool);

    if (
      state.mode !== 'viewer' &&
      toolUsesAnchorPreview(state.activeTool) &&
      previewAnchor &&
      !previewAnchor.fromPointId
    ) {
      const previewScreen = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);
      const previewRadius = safeNumber(model.style?.pointRadius, 5);
      const previewCaptureRadius = safeNumber(model.style?.pointCaptureRadius, 14);

      gPointTargets.appendChild(createSvgEl('circle', {
        cx: previewScreen.x,
        cy: previewScreen.y,
        r: previewCaptureRadius,
        fill: 'rgba(37,99,235,0.08)',
        stroke: previewColor,
        'stroke-width': 1.5,
        class: 'geo2d-preview-stroke'
      }));

      gPreview.appendChild(createSvgEl('circle', {
        cx: previewScreen.x,
        cy: previewScreen.y,
        r: previewRadius,
        fill: '#ffffff',
        stroke: previewColor,
        'stroke-width': 2,
        class: 'geo2d-preview-stroke'
      }));
    }

    if (state.activeTool === 'text' && previewAnchor) {
      const previewScreen = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);
      const txt = createSvgEl('text', {
        x: previewScreen.x,
        y: previewScreen.y,
        class: 'geo2d-legendline geo2d-preview-stroke',
        'font-size': model.style?.fontSize || 14,
        fill: previewColor
      });
      txt.textContent = 'Texto';
      gPreview.appendChild(txt);
    }

    if (state._pendingPoints.length > 0 && previewAnchor) {
      const first = model.getPointPosition(state._pendingPoints[0]);
      const second = state._pendingPoints.length > 1 ? model.getPointPosition(state._pendingPoints[1]) : null;

      if (first && ['segment', 'line', 'ray', 'circle', 'midpoint', 'measure-distance'].includes(state.activeTool)) {
        if (state.activeTool === 'segment' || state.activeTool === 'midpoint' || state.activeTool === 'measure-distance') {
          const a = worldToScreen(vp, width, height, first.x, first.y);
          const b = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);

          gPreview.appendChild(createSvgEl('line', {
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            stroke: previewColor,
            'stroke-width': 2,
            class: 'geo2d-preview-stroke'
          }));
        }

        if (state.activeTool === 'line') {
          renderInfiniteLine(gPreview, vp, width, height, first, previewAnchor, {
            stroke: previewColor,
            'stroke-width': 2,
            class: 'geo2d-preview-stroke'
          });
        }

        if (state.activeTool === 'ray') {
          renderRay(gPreview, vp, width, height, first, previewAnchor, {
            stroke: previewColor,
            'stroke-width': 2,
            class: 'geo2d-preview-stroke'
          });
        }

        if (state.activeTool === 'circle') {
          const radius = dist(first.x, first.y, previewAnchor.x, previewAnchor.y);
          const cs = circleScreenRadius(vp, width, height, first.x, first.y, radius);

          gPreview.appendChild(createSvgEl('circle', {
            cx: cs.cx,
            cy: cs.cy,
            r: cs.r,
            stroke: previewColor,
            'stroke-width': 2,
            fill: 'none',
            class: 'geo2d-preview-stroke'
          }));
        }
      }

      if (state.activeTool === 'measure-angle') {
        if (first && !second) {
          const a = worldToScreen(vp, width, height, first.x, first.y);
          const b = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);

          gPreview.appendChild(createSvgEl('line', {
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            stroke: previewColor,
            'stroke-width': 2,
            class: 'geo2d-preview-stroke'
          }));
        }

        if (first && second) {
          const firstScreen = worldToScreen(vp, width, height, first.x, first.y);
          const secondScreen = worldToScreen(vp, width, height, second.x, second.y);
          const previewScreen = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);
          const info = resolveAngleMeasureInfo(first, second, previewAnchor, 'deg', model.viewport);
          const arcPath = screenPointsPath(
            angleArcWorldPoints(info.vertex, info.radius, info.startAngle, info.delta, 24)
              .map(p => worldToScreen(vp, width, height, p.x, p.y)),
            false
          );

          gPreview.appendChild(createSvgEl('line', {
            x1: secondScreen.x,
            y1: secondScreen.y,
            x2: firstScreen.x,
            y2: firstScreen.y,
            stroke: previewColor,
            'stroke-width': 2,
            class: 'geo2d-preview-stroke'
          }));
          gPreview.appendChild(createSvgEl('line', {
            x1: secondScreen.x,
            y1: secondScreen.y,
            x2: previewScreen.x,
            y2: previewScreen.y,
            stroke: previewColor,
            'stroke-width': 2,
            class: 'geo2d-preview-stroke'
          }));
          gPreview.appendChild(createSvgEl('path', {
            d: arcPath,
            stroke: previewColor,
            'stroke-width': 2,
            fill: 'none',
            class: 'geo2d-preview-stroke'
          }));
        }
      }

      if (state.activeTool === 'polygon') {
        const pts = [];
        for (const id of state._pendingPoints) {
          const p = model.getPointPosition(id);
          if (p) pts.push(p);
        }

        if (pts.length > 0) {
          const screenPts = pts.map(p => worldToScreen(vp, width, height, p.x, p.y));
          const previewScreen = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);
          const polyline = [...screenPts, previewScreen].map(p => `${p.x},${p.y}`).join(' ');

          gPreview.appendChild(createSvgEl('polyline', {
            points: polyline,
            stroke: '#ea580c',
            'stroke-width': 2,
            fill: 'none',
            class: 'geo2d-preview-stroke'
          }));
        }
      }

      if (state.activeTool === 'ellipse' && first) {
        if (!state._toolData?.ellipse) {
          const a = worldToScreen(vp, width, height, first.x, first.y);
          const b = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);

          gPreview.appendChild(createSvgEl('line', {
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            stroke: previewColor,
            'stroke-width': 2,
            class: 'geo2d-preview-stroke'
          }));
        } else {
          const draft = state._toolData.ellipse;
          const local = ellipseLocalCoordinates(first, draft.rotation, previewAnchor.x, previewAnchor.y);
          const ry = Math.abs(local.y);

          if (ry > 1e-9) {
            const screenPts = ellipseWorldPoints(first, draft.rx, ry, draft.rotation, 96)
              .map(p => worldToScreen(vp, width, height, p.x, p.y));

            gPreview.appendChild(createSvgEl('path', {
              d: screenPointsPath(screenPts, true),
              stroke: previewColor,
              'stroke-width': 2,
              fill: 'none',
              class: 'geo2d-preview-stroke'
            }));
          }
        }
      }
    }

    const pointHitList = [];

    for (const obj of model.objects) {
      if (!obj.isVisible() || !obj.isPointLike()) continue;

      const pos = obj.getPosition(model);
      if (!pos) continue;

      const style = mergeStyle(model, obj.raw, { fill: obj.raw.style?.fill || '#ea580c' });
      const p = worldToScreen(vp, width, height, pos.x, pos.y);

      const visibleRadius = getPointVisibleRadius(model, obj.raw);
      const captureRadius = getPointCaptureRadius(model, obj.raw);

      const isPending = pendingPointIds.has(obj.id);
      const isHovered = hoverPointId === obj.id;
      const isSelected = selectedObjectId === obj.id;

      if (isPending) {
        gPointTargets.appendChild(createSvgEl('circle', {
          cx: p.x,
          cy: p.y,
          r: captureRadius,
          fill: 'rgba(234,88,12,0.10)',
          stroke: '#ea580c',
          'stroke-width': 2
        }));
      }

      if (isHovered) {
        gPointTargets.appendChild(createSvgEl('circle', {
          cx: p.x,
          cy: p.y,
          r: captureRadius,
          fill: 'rgba(37,99,235,0.10)',
          stroke: '#2563eb',
          'stroke-width': 2
        }));
      }

      if (isSelected && !isPending && !isHovered) {
  gPointTargets.appendChild(createSvgEl('circle', {
    cx: p.x,
    cy: p.y,
    r: captureRadius,
    fill: 'rgba(124,58,237,0.10)',
    stroke: '#7c3aed',
    'stroke-width': 2
  }));
}

gPoints.appendChild(createSvgEl('circle', {
  cx: p.x,
  cy: p.y,
  r: visibleRadius,
  fill: style.fill,
  stroke: isPending
    ? '#ea580c'
    : isHovered
      ? '#2563eb'
      : isSelected
        ? '#7c3aed'
        : style.stroke,
  'stroke-width': (isPending || isHovered || isSelected) ? 2.5 : 1.5
}));

      pointHitList.push({
        id: obj.id,
        x: p.x,
        y: p.y,
        r: captureRadius,
        visibleRadius,
        draggable: obj.isDraggable()
      });

      if (obj.raw.label) {
        const t = createSvgEl('text', {
          x: p.x + 10,
          y: p.y - 10,
          class: 'geo2d-legendline',
          'font-size': style.fontSize
        });
        t.textContent = obj.raw.label;
        gLabels.appendChild(t);
      }
    }

    state._pointHitList = pointHitList;
    state._svgWidth = width;
    state._svgHeight = height;
  }

  /* =========================================================
     EDITOR / VIEWER
     ========================================================= */
  class Geo2DEditor {
    constructor(target, options = {}) {
      this.targetEl = typeof target === 'string' ? document.querySelector(target) : target;
      if (!this.targetEl) throw new Error('Contenedor no encontrado.');

      if (this.targetEl.__geo2dInstance && typeof this.targetEl.__geo2dInstance.destroy === 'function') {
        this.targetEl.__geo2dInstance.destroy();
      }

      if (this.targetEl.__geo2dShadow) {
        this.shadow = this.targetEl.__geo2dShadow;
        this.shadow.innerHTML = '';
      } else {
        this.shadow = this.targetEl.attachShadow({ mode: 'closed' });
        this.targetEl.__geo2dShadow = this.shadow;
      }

      const styleEl = document.createElement('style');
      styleEl.textContent = getEditorStyles();
      this.shadow.appendChild(styleEl);

      this.options = options;
      this.mode = options.mode || 'editor';
      this.model = new SceneModel(loadSceneFromOptions(options));

      this.activeTab = 'visual';
      this.activeTool = 'move';

      

this._dragInfo = null;
this._viewDragInfo = null;
this._pendingPoints = [];
this._hoverPointId = null;
this._previewWorld = null;
this._toolData = null;
this._instanceId = 'geo2d-' + Math.random().toString(36).slice(2, 10);
this._objectCounter = this.model.objects.length + 1;

this.selectedObjectId = null;
this._selectionCycleIndex = 0;
this._lastHitIds = [];
this._lastHitSx = null;
this._lastHitSy = null;
this._deferredSync = false;





      this.buildLayout();
      this.bindUI();
      this.syncJsonFromScene();
      this.refreshUI();
      this.render();
      this.targetEl.__geo2dInstance = this;
    }

    destroy() {
      if (this._windowPointerUpHandler) {
        window.removeEventListener('pointerup', this._windowPointerUpHandler);
        this._windowPointerUpHandler = null;
      }

      if (this.targetEl && this.targetEl.__geo2dInstance === this) {
        this.targetEl.__geo2dInstance = null;
      }
    }

    buildLayout() {
      this.root = document.createElement('div');
      this.root.className = 'geo2d-root';

      if (this.mode === 'viewer') {
        this.root.innerHTML = `
          <div class="geo2d-canvas-wrap" style="min-height:500px;">
            <svg></svg>
          </div>
          <div class="geo2d-status" data-role="status">Visor listo.</div>
        `;
      } else {
        this.root.innerHTML = `
          <div class="geo2d-toolbar">
            <div class="geo2d-btn" data-action="new"><span class="txt-ncl">Nuevo</span></div>
            <div class="geo2d-btn" data-action="load"><span class="txt-ncl">Cargar</span></div>
            <div class="geo2d-btn" data-action="save"><span class="txt-ncl">Guardar JSON</span></div>
            <div class="geo2d-btn" data-action="publish"><span class="txt-ncl">Publicar HTML</span></div>
            <div class="geo2d-btn" data-action="copyjson"><span class="txt-ncl">Copiar JSON</span></div>
            <span style="flex:1"></span>
            <input type="text" data-role="title" placeholder="Título de la escena" />
          </div>

          

<div class="geo2d-body">
  <div class="geo2d-side">
    <div class="geo2d-title">HERRAMIENTAS</div>
    <div class="geo2d-toolgrid">
      <div class="geo2d-toolbtn" data-tool="move"><span class="txt-ncl">Mover / Vista</span></div>
      <div class="geo2d-toolbtn" data-tool="point"><span class="txt-ncl">Punto</span></div>
      <div class="geo2d-toolbtn" data-tool="segment"><span class="txt-ncl">Segmento</span></div>
      <div class="geo2d-toolbtn" data-tool="line"><span class="txt-ncl">Recta</span></div>
      <div class="geo2d-toolbtn" data-tool="ray"><span class="txt-ncl">Semirrecta</span></div>
      <div class="geo2d-toolbtn" data-tool="circle"><span class="txt-ncl">Circunferencia</span></div>
      <div class="geo2d-toolbtn" data-tool="ellipse"><span class="txt-ncl">Elipse</span></div>
      <div class="geo2d-toolbtn" data-tool="polygon"><span class="txt-ncl">Polígono</span></div>
      <div class="geo2d-toolbtn" data-tool="midpoint"><span class="txt-ncl">Punto medio</span></div>
      <div class="geo2d-toolbtn" data-tool="measure-distance"><span class="txt-ncl">Medir distancia</span></div>
      <div class="geo2d-toolbtn" data-tool="measure-angle"><span class="txt-ncl">Ángulo</span></div>
      <div class="geo2d-toolbtn" data-tool="text"><span class="txt-ncl">Txt</span></div>
      <div class="geo2d-toolbtn" data-tool="delete"><span class="txt-ncl">Borrar</span></div>
    </div>
  </div>

  <div class="geo2d-main">
    <div class="geo2d-tabs">
      <div class="geo2d-tab" data-tab="visual"><span class="txt-ncl">Visual</span></div>
      <div class="geo2d-tab" data-tab="json"><span class="txt-ncl">JSON</span></div>
    </div>

    <div class="geo2d-panels">
      <div class="geo2d-panel" data-panel="visual">
        <div class="geo2d-canvas-wrap"><svg></svg></div>
        <div class="geo2d-status" data-role="status">Listo.</div>
      </div>

      <div class="geo2d-panel" data-panel="json">
        <div class="geo2d-json-wrap">
          <textarea spellcheck="false"></textarea>
          <div class="geo2d-json-actions">
            <div class="geo2d-btn" data-action="apply-json"><span class="txt-ncl">Aplicar cambios</span></div>
            <div class="geo2d-btn" data-action="format-json"><span class="txt-ncl">Formatear JSON</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="geo2d-right">
    <div class="geo2d-section">
      <div class="geo2d-title">OBJETOS DEL ÁREA GRÁFICA</div>
      <div class="geo2d-object-list" data-role="object-list"></div>
    </div>

    <div class="geo2d-section">
      <div class="geo2d-title">PROPIEDADES DEL OBJETO</div>
      <div class="geo2d-props" data-role="object-props">
        <div class="geo2d-field">
          <label>ID</label>
          <input data-role="prop-id" readonly />
        </div>

        <div class="geo2d-field">
          <label>Tipo</label>
          <input data-role="prop-type" readonly />
        </div>

        <div class="geo2d-field">
          <label data-role="prop-label-caption">Nombre / etiqueta</label>
          <input data-role="prop-label" />
        </div>

        <div class="geo2d-field">
          <label>Dependencia / referencias</label>
          <input data-role="prop-parent" readonly />
        </div>

        <div class="geo2d-field" data-role="prop-extra-wrap" style="display:none;">
          <label data-role="prop-extra-caption">Unidad</label>
          <select data-role="prop-extra-select">
            <option value="deg">Grados</option>
            <option value="rad">Radianes</option>
          </select>
        </div>

        <label class="geo2d-check">
          <input type="checkbox" data-role="prop-visible" />
          Visible
        </label>
      </div>
    </div>
  </div>
</div>







          <div class="geo2d-modal-backdrop">
            <div class="geo2d-modal">
              <div class="geo2d-modal-head">Publicar HTML</div>
              <div class="geo2d-modal-body">
                <textarea spellcheck="false" readonly></textarea>
              </div>
              <div class="geo2d-modal-foot">
                <div class="geo2d-btn" data-action="copy-published"><span class="txt-ncl">Copiar HTML</span></div>
                <div class="geo2d-btn" data-action="download-published"><span class="txt-ncl">Descargar HTML</span></div>
                <div class="geo2d-btn" data-action="close-modal"><span class="txt-ncl">Cerrar</span></div>
              </div>
            </div>
          </div>
        `;
      }

      this.shadow.appendChild(this.root);

      this.svg = this.root.querySelector('svg');
      this.statusEl = this.root.querySelector('[data-role="status"]');



this.objectListEl = this.root.querySelector('[data-role="object-list"]');
this.propsWrapEl = this.root.querySelector('[data-role="object-props"]');
this.propIdEl = this.root.querySelector('[data-role="prop-id"]');
this.propTypeEl = this.root.querySelector('[data-role="prop-type"]');
this.propLabelCaptionEl = this.root.querySelector('[data-role="prop-label-caption"]');
this.propLabelEl = this.root.querySelector('[data-role="prop-label"]');
this.propParentEl = this.root.querySelector('[data-role="prop-parent"]');
this.propExtraWrapEl = this.root.querySelector('[data-role="prop-extra-wrap"]');
this.propExtraCaptionEl = this.root.querySelector('[data-role="prop-extra-caption"]');
this.propExtraSelectEl = this.root.querySelector('[data-role="prop-extra-select"]');
this.propVisibleEl = this.root.querySelector('[data-role="prop-visible"]');








      if (this.mode !== 'viewer') {
        this.titleInput = this.root.querySelector('[data-role="title"]');
        this.jsonArea = this.root.querySelector('.geo2d-json-wrap textarea');
        this.modalBackdrop = this.root.querySelector('.geo2d-modal-backdrop');
        this.publishArea = this.root.querySelector('.geo2d-modal textarea');
        this.titleInput.value = this.model.meta.title || '';
      }
    }

refreshUI() {
  if (this.mode === 'viewer') return;

  this.root.querySelectorAll('.geo2d-btn').forEach(btn => {
    btn.style.setProperty('background-color', '#ffffff', 'important');
    const span = btn.querySelector('.txt-ncl');
    if (span) {
      span.style.setProperty('color', '#000000', 'important');
      span.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
      span.style.setProperty('font-size', '14px', 'important');
      span.style.setProperty('font-family', 'Arial, sans-serif', 'important');
      span.style.setProperty('font-weight', 'bold', 'important');
      span.style.setProperty('display', 'inline-block', 'important');
    }
  });

  this.root.querySelectorAll('.geo2d-toolbtn').forEach(btn => {
    const isActive = btn.dataset.tool === this.activeTool;
    btn.style.setProperty('background-color', isActive ? '#ea580c' : '#ffffff', 'important');
    btn.style.setProperty('border', isActive ? '1px solid #ea580c' : '1px solid #d1d5db', 'important');

    const span = btn.querySelector('.txt-ncl');
    if (span) {
      span.style.setProperty('color', isActive ? '#ffffff' : '#000000', 'important');
      span.style.setProperty('-webkit-text-fill-color', isActive ? '#ffffff' : '#000000', 'important');
      span.style.setProperty('font-size', '14px', 'important');
      span.style.setProperty('font-family', 'Arial, sans-serif', 'important');
      span.style.setProperty('font-weight', 'bold', 'important');
      span.style.setProperty('display', 'inline-block', 'important');
    }
  });

  this.root.querySelectorAll('.geo2d-tab').forEach(tab => {
    const isActive = tab.dataset.tab === this.activeTab;
    tab.style.setProperty('background-color', isActive ? '#ffffff' : '#f3f4f6', 'important');
    tab.style.setProperty('border-bottom', isActive ? '1px solid #ffffff' : 'none', 'important');

    const span = tab.querySelector('.txt-ncl');
    if (span) {
      span.style.setProperty('color', '#000000', 'important');
      span.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
      span.style.setProperty('font-size', '14px', 'important');
      span.style.setProperty('font-family', 'Arial, sans-serif', 'important');
      span.style.setProperty('font-weight', isActive ? 'bold' : 'normal', 'important');
      span.style.setProperty('display', 'inline-block', 'important');
    }
  });

  this.root.querySelectorAll('.geo2d-panel').forEach(panel => {
    panel.style.setProperty('display', panel.dataset.panel === this.activeTab ? 'flex' : 'none', 'important');
  });
}

getSelectedObject() {
  if (!this.selectedObjectId) return null;
  return this.model.getObject(this.selectedObjectId) || null;
}

selectObject(id, rerender = true) {
  this.selectedObjectId = (id && this.model.hasId(id)) ? id : null;

  if (rerender) {
    this.render();
  } else {
    this.refreshObjectList();
    this.refreshInspector();
  }
}

getTypeLabel(type) {
  const map = {
    point: 'Punto',
    midpoint: 'Punto medio',
    segment: 'Segmento',
    line: 'Recta',
    ray: 'Semirrecta',
    circle: 'Circunferencia',
    ellipse: 'Elipse',
    polygon: 'Polígono',
    measure: 'Medida',
    text: 'Texto'
  };
  return map[type] || type || 'Objeto';
}

getObjectDisplayText(obj) {
  if (!obj) return '';
  if (obj.raw.type === 'text') return String(obj.raw.text || '').trim();
  return String(obj.raw.label || '').trim();
}

getObjectRefsText(obj) {
  if (!obj) return '—';

  if (obj instanceof ConstrainedPoint && obj.constraint) {
    return `${obj.constraint.kind} → ${obj.constraint.objectId}`;
  }

  if (obj instanceof MidpointPoint) {
    return `${obj.raw.p1 || ''}, ${obj.raw.p2 || ''}`;
  }

  if (obj.raw.type === 'segment' || obj.raw.type === 'line' || obj.raw.type === 'ray') {
    return `${obj.raw.p1 || ''}, ${obj.raw.p2 || ''}`;
  }

  if (obj.raw.type === 'circle') {
    return `${obj.raw.center || ''}, ${obj.raw.through || ''}`;
  }

  if (obj.raw.type === 'ellipse') {
    const rx = safeNumber(obj.raw.rx, 0).toFixed(2);
    const ry = safeNumber(obj.raw.ry, 0).toFixed(2);
    return `${obj.raw.center || ''} | rx=${rx}, ry=${ry}`;
  }

  if (obj.raw.type === 'polygon') {
    return Array.isArray(obj.raw.points) ? obj.raw.points.join(', ') : '—';
  }

  if (obj.raw.type === 'measure') {
    return Array.isArray(obj.raw.of) ? obj.raw.of.join(', ') : '—';
  }

  if (obj.raw.type === 'text') {
    return 'libre';
  }

  return '—';
}

refreshObjectList() {
  if (this.mode === 'viewer' || !this.objectListEl) return;

  const groups = [
    { type: 'point', title: 'Puntos' },
    { type: 'midpoint', title: 'Puntos medios' },
    { type: 'segment', title: 'Segmentos' },
    { type: 'line', title: 'Rectas' },
    { type: 'ray', title: 'Semirrectas' },
    { type: 'circle', title: 'Circunferencias' },
    { type: 'ellipse', title: 'Elipses' },
    { type: 'polygon', title: 'Polígonos' },
    { type: 'measure', title: 'Medidas' },
    { type: 'text', title: 'Textos' }
  ];

  this.objectListEl.innerHTML = '';

  for (const group of groups) {
    const items = this.model.objects.filter(o => o.raw.type === group.type);
    if (!items.length) continue;

    const groupEl = document.createElement('div');
    groupEl.className = 'geo2d-list-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'geo2d-list-title';
    titleEl.textContent = group.title;
    groupEl.appendChild(titleEl);

    for (const obj of items) {
      const itemEl = document.createElement('div');
      itemEl.className = 'geo2d-list-item';
      if (obj.id === this.selectedObjectId) itemEl.classList.add('active');
      if (obj.raw.visible === false) itemEl.classList.add('hidden');

      itemEl.dataset.objectId = obj.id;

      const left = document.createElement('span');
      const label = this.getObjectDisplayText(obj);
      left.textContent = label && label !== obj.id ? `${label} (${obj.id})` : obj.id;

      const right = document.createElement('span');
      right.textContent = obj.raw.visible === false ? 'oculto' : 'visible';

      itemEl.appendChild(left);
      itemEl.appendChild(right);
      groupEl.appendChild(itemEl);
    }

    this.objectListEl.appendChild(groupEl);
  }
}

refreshInspector() {
  if (this.mode === 'viewer' || !this.propsWrapEl) return;

  const obj = this.getSelectedObject();

  if (!obj) {
    this.propIdEl.value = '';
    this.propTypeEl.value = '';
    this.propLabelEl.value = '';
    this.propParentEl.value = '';
    this.propVisibleEl.checked = true;
    if (this.propLabelCaptionEl) this.propLabelCaptionEl.textContent = 'Nombre / etiqueta';
    if (this.propExtraWrapEl) this.propExtraWrapEl.style.display = 'none';
    if (this.propExtraSelectEl) {
      this.propExtraSelectEl.value = 'deg';
      this.propExtraSelectEl.disabled = true;
    }

    this.propLabelEl.disabled = true;
    this.propVisibleEl.disabled = true;
    return;
  }

  this.propIdEl.value = obj.id || '';
  this.propTypeEl.value =
    obj.raw.type === 'measure' && obj.raw.measureType === 'angle'
      ? 'Ángulo'
      : this.getTypeLabel(obj.raw.type);
  this.propLabelEl.value = obj.raw.type === 'text' ? String(obj.raw.text || '') : (obj.raw.label || '');
  this.propParentEl.value = this.getObjectRefsText(obj);
  this.propVisibleEl.checked = obj.raw.visible !== false;
  if (this.propLabelCaptionEl) this.propLabelCaptionEl.textContent = obj.raw.type === 'text' ? 'Texto' : 'Nombre / etiqueta';
  if (this.propExtraWrapEl) this.propExtraWrapEl.style.display = 'none';
  if (this.propExtraSelectEl) {
    this.propExtraSelectEl.disabled = true;
  }

  if (obj.raw.type === 'measure' && obj.raw.measureType === 'angle' && this.propExtraWrapEl && this.propExtraSelectEl) {
    this.propExtraWrapEl.style.display = 'flex';
    if (this.propExtraCaptionEl) this.propExtraCaptionEl.textContent = 'Unidad';
    this.propExtraSelectEl.value = obj.raw.unit === 'rad' ? 'rad' : 'deg';
    this.propExtraSelectEl.disabled = false;
  }

  this.propLabelEl.disabled = false;
  this.propVisibleEl.disabled = false;
}

findObjectsAtScreen(sx, sy) {
  const hits = [];
  const vp = this.model.viewport;

  for (const p of (this._pointHitList || [])) {
    const d2 = dist2(sx, sy, p.x, p.y);
    if (d2 <= p.r * p.r) {
      hits.push({
        id: p.id,
        priority: 0,
        d2
      });
    }
  }

  for (const obj of this.model.objects) {
    if (!obj.isVisible() || obj.isPointLike()) continue;

    const resolved = this.model.getResolvedObject(obj.id);
    if (!resolved) continue;

    let d2 = Infinity;
    let priority = 2;

    if (resolved.kind === 'segment') d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);
    if (resolved.kind === 'line') d2 = this.p2l(sx, sy, resolved.p1, resolved.p2, vp);
    if (resolved.kind === 'ray') d2 = this.p2r(sx, sy, resolved.p1, resolved.p2, vp);

    if (resolved.kind === 'circle') {
      const cs = circleScreenRadius(
        vp,
        this._svgWidth,
        this._svgHeight,
        resolved.center.x,
        resolved.center.y,
        resolved.radius
      );
      d2 = this.p2circleBorderSquared(sx, sy, cs.cx, cs.cy, cs.r);
    }

    if (resolved.kind === 'ellipse') {
      const screenPts = ellipseScreenPoints(vp, this._svgWidth, this._svgHeight, resolved, 96);
      d2 = p2screenPolylineSquared(sx, sy, screenPts, true);
    }

    if (resolved.kind === 'polygon') {
      d2 = this.p2polygonEdgesSquared(sx, sy, resolved.points, vp);
      priority = 3;
    }

    if (resolved.kind === 'measure') {
      const info = resolveMeasure(this.model, obj);
      if (info) {
        const p = worldToScreen(vp, this._svgWidth, this._svgHeight, info.anchor.x, info.anchor.y);
        d2 = dist2(sx, sy, p.x, p.y);
        priority = 1;
      }
    }

    if (resolved.kind === 'text') {
      const style = mergeStyle(this.model, obj.raw);
      d2 = p2rectSquared(sx, sy, textScreenBounds(vp, this._svgWidth, this._svgHeight, resolved, style.fontSize));
      priority = 1;
    }

    if (d2 < 100) {
      hits.push({
        id: obj.id,
        priority,
        d2
      });
    }
  }

  hits.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.d2 - b.d2;
  });

  return hits;
}

selectFromHits(hits, sx, sy) {
  if (!hits.length) {
    this.selectObject(null);
    this._lastHitIds = [];
    this._selectionCycleIndex = 0;
    this._lastHitSx = null;
    this._lastHitSy = null;
    return;
  }

  const ids = hits.map(h => h.id);

  const sameSet =
    this._lastHitIds.length === ids.length &&
    this._lastHitIds.every((id, i) => id === ids[i]) &&
    this._lastHitSx !== null &&
    this._lastHitSy !== null &&
    dist2(sx, sy, this._lastHitSx, this._lastHitSy) < 36;

  if (sameSet && ids.length > 1) {
    this._selectionCycleIndex = (this._selectionCycleIndex + 1) % ids.length;
  } else {
    this._selectionCycleIndex = 0;
  }

  this._lastHitIds = ids;
  this._lastHitSx = sx;
  this._lastHitSy = sy;

  this.selectObject(ids[this._selectionCycleIndex]);
}

bindUI() {
  if (this.mode !== 'viewer') {
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action], [data-tool], [data-tab]');
      if (!btn) return;

      if (btn.dataset.action) this.handleAction(btn.dataset.action);

      if (btn.dataset.tool) {
        this.activeTool = btn.dataset.tool;
        this._pendingPoints = [];
        this._hoverPointId = null;
        this._previewWorld = null;
        this._toolData = null;
        this.refreshUI();
        this.render();
        this.setStatus('Herramienta: ' + this.activeTool);
      }

      if (btn.dataset.tab) {
        this.activeTab = btn.dataset.tab;
        this.refreshUI();
      }
    });

    this.objectListEl?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-object-id]');
      if (!item) return;
      this.selectObject(item.dataset.objectId);
    });

    this.propLabelEl?.addEventListener('input', () => {
      const obj = this.getSelectedObject();
      if (!obj) return;
      if (obj.raw.type === 'text') {
        obj.raw.text = this.propLabelEl.value;
      } else {
        obj.raw.label = this.propLabelEl.value;
      }
      this.renderAndSync();
    });

    this.propVisibleEl?.addEventListener('change', () => {
      const obj = this.getSelectedObject();
      if (!obj) return;
      obj.raw.visible = !!this.propVisibleEl.checked;
      this.renderAndSync();
    });

    this.propExtraSelectEl?.addEventListener('change', () => {
      const obj = this.getSelectedObject();
      if (!obj || obj.raw.type !== 'measure' || obj.raw.measureType !== 'angle') return;
      obj.raw.unit = this.propExtraSelectEl.value === 'rad' ? 'rad' : 'deg';
      this.renderAndSync();
    });

    this.titleInput.addEventListener('input', () => {
      this.model.meta.title = this.titleInput.value || 'Escena Geo2D';
      this.syncJsonFromScene();
    });

    this.bindFileLoad();
  }

  this.bindSvgInteractions();
}

    bindFileLoad() {
      this.hiddenFileInput = document.createElement('input');
      this.hiddenFileInput.type = 'file';
      this.hiddenFileInput.accept = '.json,.txt,.html';
      this.hiddenFileInput.className = 'geo2d-hidden';
      this.root.appendChild(this.hiddenFileInput);

      this.hiddenFileInput.addEventListener('change', async () => {
        const file = this.hiddenFileInput.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          this.loadSceneFromText(text);
        } catch (err) {
          this.setStatus('Error: ' + err.message, true);
        } finally {
          this.hiddenFileInput.value = '';
        }
      });
    }

    bindSvgInteractions() {
      this.svg.addEventListener('pointerdown', e => this.onPointerDown(e));
      this.svg.addEventListener('pointermove', e => this.onPointerMove(e));
      this.svg.addEventListener('pointerleave', () => this.clearHoverAndPreview());
      this._windowPointerUpHandler = () => this.onPointerUp();
      window.addEventListener('pointerup', this._windowPointerUpHandler);

      this.svg.addEventListener('wheel', e => {
        e.preventDefault();

        const rect = this.svg.getBoundingClientRect();
        const w = this._svgWidth || rect.width;
        const h = this._svgHeight || rect.height;

        const sxRaw = e.clientX - rect.left;
        const syRaw = e.clientY - rect.top;
        const drawRect = getDrawableRect(this.model.viewport, w, h);

        const sx = clamp(sxRaw, drawRect.x, drawRect.x + drawRect.width);
        const sy = clamp(syRaw, drawRect.y, drawRect.y + drawRect.height);

        const mw = screenToWorld(this.model.viewport, w, h, sx, sy);
        const delta = clamp(e.deltaY, -80, 80);
        const factor = Math.exp(delta * 0.0015);

        this.model.viewport = viewportZoom(this.model.viewport, factor, mw.x, mw.y);
        this.renderAndSync();
      }, { passive: false });

      this.svg.addEventListener('dblclick', e => {
        if (this.mode !== 'viewer' && this.activeTool === 'polygon' && this._pendingPoints.length >= 3) {
          this.finishPendingPolygon();
          e.preventDefault();
        }
      });
    }

    setStatus(text, isError = false) {
      if (!this.statusEl) return;
      this.statusEl.textContent = text;
      this.statusEl.style.color = isError ? '#c62828' : '#000000';
    }

    nextId(prefix) {
      let id;
      do {
        id = `${prefix}${this._objectCounter++}`;
      } while (this.model.hasId(id));
      return id;
    }

    syncJsonFromScene() {
      if (this.mode === 'viewer' || !this.jsonArea) return;
      this._deferredSync = false;
      this.jsonArea.value = jsonPretty(this.model.serialize());
    }

    renderAndSync() {
      this._deferredSync = false;
      this.render();
      this.syncJsonFromScene();
    }

    renderDuringInteraction() {
      this.render();
      if (this.mode !== 'viewer') this._deferredSync = true;
    }

    flushDeferredSync() {
      if (!this._deferredSync) return;
      this.syncJsonFromScene();
    }

    applyJsonToScene() {
      this.model.replaceScene(parseSceneText(this.jsonArea.value));
      this.titleInput.value = this.model.meta.title || '';
      this._pendingPoints = [];
      this._hoverPointId = null;
      this._previewWorld = null;
      this._toolData = null;
      this.selectedObjectId = null;
      this.render();
      this.setStatus('JSON aplicado.');
    }

        render() {
        renderSceneToSvg(this.svg, this.model, this);
        this.refreshUI();

       if (this.mode !== 'viewer') {
        this.refreshObjectList();
        this.refreshInspector();
      }
    }

    handleAction(action) {
      switch (action) {
        case 'new':
          this.model.replaceScene(defaultScene());
          this.titleInput.value = this.model.meta.title;
          this._pendingPoints = [];
          this._hoverPointId = null;
          this._previewWorld = null;
          this._toolData = null;
          this.selectedObjectId = null;
          this.renderAndSync();
          this.setStatus('Nueva escena.');
          break;

        case 'load':
          if (confirm('Aceptar = abrir archivo\nCancelar = pegar código')) {
            this.hiddenFileInput.click();
          } else {
            const raw = prompt('Pega el JSON:');
            if (raw) this.loadSceneFromText(raw);
          }
          break;

        case 'save':
          downloadTextFile(`${slugify(this.model.meta.title)}.geo2d.json`, jsonPretty(this.model.serialize()));
          this.setStatus('Guardado.');
          break;

        case 'copyjson':
          copyTextToClipboard(jsonPretty(this.model.serialize())).then(() => this.setStatus('Copiado.'));
          break;

        case 'publish':
          this.publishArea.value = this.publishScene();
          this.modalBackdrop.style.setProperty('display', 'flex', 'important');
          this.setStatus('HTML generado.');
          break;

        case 'apply-json':
          try {
            this.applyJsonToScene();
          } catch (err) {
            this.setStatus('Error: ' + err.message, true);
          }
          break;

        case 'format-json':
          try {
            this.jsonArea.value = jsonPretty(parseSceneText(this.jsonArea.value));
            this.setStatus('Formateado.');
          } catch (err) {
            this.setStatus('Error: ' + err.message, true);
          }
          break;

        case 'copy-published':
          copyTextToClipboard(this.publishArea.value).then(() => this.setStatus('HTML copiado.'));
          break;

        case 'download-published':
          downloadTextFile(`${slugify(this.model.meta.title)}.html`, this.publishArea.value, 'text/html');
          break;

        case 'close-modal':
          this.modalBackdrop.style.setProperty('display', 'none', 'important');
          break;
      }
    }

    loadSceneFromText(text) {
      try {
        this.model.replaceScene(parseSceneText(text));
        if (this.mode !== 'viewer') this.titleInput.value = this.model.meta.title || '';
        this._pendingPoints = [];
        this._hoverPointId = null;
        this._previewWorld = null;
        this._toolData = null;
        this.selectedObjectId = null;
        this.renderAndSync();
        this.setStatus('Cargada.');
      } catch (err) {
        this.setStatus('Error: ' + err.message, true);
      }
    }

    publishScene() {
      const id = 'geo2d-' + Math.random().toString(36).slice(2, 8);
      const sceneJson = serializeSceneForHtml(this.model.serialize());
      return `<div class="geo2d-viewer" id="${id}"></div>
<script type="application/json" id="${id}-data" data-geo2d-scene="true">${sceneJson}<\/script>
<script>
window.Geo2D && window.Geo2D.openViewer({
  target: "#${id}",
  sceneSource: "#${id}-data"
});
<\/script>`;
    }

    getMouseWorld(e) {
      const r = this.svg.getBoundingClientRect();
      return screenToWorld(
        this.model.viewport,
        this._svgWidth || r.width,
        this._svgHeight || r.height,
        e.clientX - r.left,
        e.clientY - r.top
      );
    }

    findNearestPointAtScreen(sx, sy) {
      let best = null;
      let bestD2 = Infinity;

      for (const p of (this._pointHitList || [])) {
        const d2 = dist2(sx, sy, p.x, p.y);
        if (d2 <= p.r * p.r && d2 < bestD2) {
          best = p;
          bestD2 = d2;
        }
      }

      return best;
    }

    clearHoverAndPreview() {
      let dirty = false;

      if (this._hoverPointId !== null) {
        this._hoverPointId = null;
        dirty = true;
      }

      if (this._previewWorld !== null) {
        this._previewWorld = null;
        dirty = true;
      }

      if (dirty) this.render();
    }

    updateHoverAndPreview(sx, sy, world) {
      let dirty = false;

      const nearPoint = this.findNearestPointAtScreen(sx, sy);
      const nextHoverId = nearPoint ? nearPoint.id : null;

      if (nextHoverId !== this._hoverPointId) {
        this._hoverPointId = nextHoverId;
        dirty = true;
      }

      let nextPreview = null;

      if (this.mode !== 'viewer' && toolUsesAnchorPreview(this.activeTool) && !nearPoint) {
        const snapped = this.getSnappedWorldPosition(world, sx, sy);
        nextPreview = { x: snapped.x, y: snapped.y };
      }

      if (!sameWorld(this._previewWorld, nextPreview)) {
        this._previewWorld = nextPreview;
        dirty = true;
      }

      if (dirty) this.render();
    }

    generatePointName() {
      for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (!this.model.hasId(c)) return c;
      }
      return this.nextId('P');
    }

    addFreePoint(x, y, sync = true) {
      const id = this.generatePointName();
      this.model.addObject({
        id,
        type: 'point',
        x,
        y,
        label: id,
        draggable: true,
        style: { fill: '#ea580c' }
      });

      if (sync) this.renderAndSync();
      return id;
    }

    addConstrainedPoint(constraintRaw, sync = true) {
      const id = this.generatePointName();
      this.model.addObject({
        id,
        type: 'point',
        label: id,
        draggable: true,
        style: { fill: '#ea580c' },
        constraint: deepClone(constraintRaw)
      });

      if (sync) this.renderAndSync();
      return id;
    }

    p2s(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this._svgWidth, this._svgHeight, p1.x, p1.y);
      const b = worldToScreen(vp, this._svgWidth, this._svgHeight, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      const t = clamp(((sx - a.x) * dx + (sy - a.y) * dy) / len2, 0, 1);
      return dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2l(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this._svgWidth, this._svgHeight, p1.x, p1.y);
      const b = worldToScreen(vp, this._svgWidth, this._svgHeight, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      const t = ((sx - a.x) * dx + (sy - a.y) * dy) / len2;
      return dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2r(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this._svgWidth, this._svgHeight, p1.x, p1.y);
      const b = worldToScreen(vp, this._svgWidth, this._svgHeight, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      const t = Math.max(0, ((sx - a.x) * dx + (sy - a.y) * dy) / len2);
      return dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2circleBorderSquared(sx, sy, cx, cy, r) {
      const d = Math.sqrt(dist2(sx, sy, cx, cy));
      return Math.pow(d - r, 2);
    }

    p2polygonEdgesSquared(sx, sy, points, vp) {
      if (!points || points.length < 2) return Infinity;
      let best = Infinity;

      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        best = Math.min(best, this.p2s(sx, sy, a, b, vp));
      }

      return best;
    }

    findNearestAnchorObjectAtScreen(sx, sy, world) {
      const vp = this.model.viewport;
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || obj.isPointLike()) continue;

        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved) continue;

        let d2 = Infinity;
        let constraint = null;

        if (resolved.kind === 'segment') {
          d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);
          if (d2 < bestD2) {
            constraint = {
              kind: 'on-segment',
              objectId: obj.id,
              t: projectParameter(resolved.p1.x, resolved.p1.y, resolved.p2.x, resolved.p2.y, world.x, world.y, true)
            };
          }
        }

        if (resolved.kind === 'line') {
          d2 = this.p2l(sx, sy, resolved.p1, resolved.p2, vp);
          if (d2 < bestD2) {
            constraint = {
              kind: 'on-line',
              objectId: obj.id,
              t: projectParameter(resolved.p1.x, resolved.p1.y, resolved.p2.x, resolved.p2.y, world.x, world.y, false)
            };
          }
        }

        if (resolved.kind === 'ray') {
          d2 = this.p2r(sx, sy, resolved.p1, resolved.p2, vp);
          if (d2 < bestD2) {
            constraint = {
              kind: 'on-ray',
              objectId: obj.id,
              t: Math.max(0, projectParameter(resolved.p1.x, resolved.p1.y, resolved.p2.x, resolved.p2.y, world.x, world.y, false))
            };
          }
        }

        if (resolved.kind === 'circle') {
          const cs = circleScreenRadius(vp, this._svgWidth, this._svgHeight, resolved.center.x, resolved.center.y, resolved.radius);
          d2 = this.p2circleBorderSquared(sx, sy, cs.cx, cs.cy, cs.r);

          if (d2 < bestD2) {
            constraint = {
              kind: 'on-circle',
              objectId: obj.id,
              angle: Math.atan2(world.y - resolved.center.y, world.x - resolved.center.x)
            };
          }
        }

        if (resolved.kind === 'ellipse') {
          const screenPts = ellipseScreenPoints(vp, this._svgWidth, this._svgHeight, resolved, 96);
          d2 = p2screenPolylineSquared(sx, sy, screenPts, true);

          if (d2 < bestD2) {
            constraint = {
              kind: 'on-ellipse',
              objectId: obj.id,
              angle: ellipseAngleFromWorld(
                resolved.center,
                resolved.rx,
                resolved.ry,
                resolved.rotation,
                world.x,
                world.y
              )
            };
          }
        }

        if (constraint && d2 < 100 && d2 < bestD2) {
          best = {
            object: obj,
            constraint,
            d2
          };
          bestD2 = d2;
        }
      }

      return best;
    }

    pickOrCreateAnchorPoint(world, sx, sy) {
      const nearPoint = this.findNearestPointAtScreen(sx, sy);
      if (nearPoint) {
        return { id: nearPoint.id, created: false, constrained: false, point: nearPoint };
      }

      const anchorObject = this.findNearestAnchorObjectAtScreen(sx, sy, world);
      if (anchorObject) {
        const id = this.addConstrainedPoint(anchorObject.constraint, false);
        return { id, created: true, constrained: true, point: null };
      }

      const id = this.addFreePoint(world.x, world.y, false);
      return { id, created: true, constrained: false, point: null };
    }

    getSnappedWorldPosition(world, sx, sy) {
      const nearPoint = this.findNearestPointAtScreen(sx, sy);
      if (nearPoint) {
        const point = this.model.getPointPosition(nearPoint.id);
        if (point) return { x: point.x, y: point.y, fromPointId: nearPoint.id };
      }

      const anchorObject = this.findNearestAnchorObjectAtScreen(sx, sy, world);
      if (anchorObject?.constraint) {
        const previewConstraint = ConstraintFactory.fromRaw(anchorObject.constraint);
        const snapped = previewConstraint ? previewConstraint.resolve(this.model) : null;
        if (snapped) {
          return { x: snapped.x, y: snapped.y, fromPointId: null, constraint: anchorObject.constraint };
        }
      }

      return { x: world.x, y: world.y, fromPointId: null, constraint: null };
    }

    resetConstructionState() {
      this._pendingPoints = [];
      this._hoverPointId = null;
      this._previewWorld = null;
      this._toolData = null;
    }

    addTextObject(x, y, text, sync = true) {
      const cleanText = String(text || '').trim();
      if (!cleanText) return null;

      const id = this.nextId('txt');
      this.model.addObject({
        id,
        type: 'text',
        x,
        y,
        text: cleanText,
        draggable: true,
        style: { fill: '#111827' }
      });

      if (sync) this.renderAndSync();
      return id;
    }

    findNearestNonPointObjectAtScreen(sx, sy) {
      const vp = this.model.viewport;
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || obj.isPointLike()) continue;

        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved) continue;

        let d2 = Infinity;

        if (resolved.kind === 'segment') d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);
        if (resolved.kind === 'line') d2 = this.p2l(sx, sy, resolved.p1, resolved.p2, vp);
        if (resolved.kind === 'ray') d2 = this.p2r(sx, sy, resolved.p1, resolved.p2, vp);

        if (resolved.kind === 'circle') {
          const cs = circleScreenRadius(vp, this._svgWidth, this._svgHeight, resolved.center.x, resolved.center.y, resolved.radius);
          d2 = this.p2circleBorderSquared(sx, sy, cs.cx, cs.cy, cs.r);
        }

        if (resolved.kind === 'ellipse') {
          const screenPts = ellipseScreenPoints(vp, this._svgWidth, this._svgHeight, resolved, 96);
          d2 = p2screenPolylineSquared(sx, sy, screenPts, true);
        }

        if (resolved.kind === 'polygon') {
          d2 = this.p2polygonEdgesSquared(sx, sy, resolved.points, vp);
        }

        if (resolved.kind === 'measure') {
          const info = resolveMeasure(this.model, obj);
          if (info) {
            const p = worldToScreen(vp, this._svgWidth, this._svgHeight, info.anchor.x, info.anchor.y);
            d2 = dist2(sx, sy, p.x, p.y);
          }
        }

        if (resolved.kind === 'text') {
          const style = mergeStyle(this.model, obj.raw);
          d2 = p2rectSquared(sx, sy, textScreenBounds(vp, this._svgWidth, this._svgHeight, resolved, style.fontSize));
        }

        if (d2 < 100 && d2 < bestD2) {
          best = obj;
          bestD2 = d2;
        }
      }

      return best;
    }

    deleteObjectAndDependents(id) {
      if (!id) return;

      const deps = new Set([id]);
      let changed = true;

      while (changed) {
        changed = false;

        for (const obj of this.model.objects) {
          if (deps.has(obj.id)) continue;
          const refs = obj.getRefs();

          if (refs.some(ref => deps.has(ref))) {
            deps.add(obj.id);
            changed = true;
          }
        }
      }

      
this.model.removeIds(deps);
this._pendingPoints = this._pendingPoints.filter(pid => !deps.has(pid));
this._hoverPointId = deps.has(this._hoverPointId) ? null : this._hoverPointId;
if (this._pendingPoints.length === 0) this._toolData = null;
this.selectedObjectId = deps.has(this.selectedObjectId) ? null : this.selectedObjectId;
this.renderAndSync();
this.setStatus('Objeto borrado.');



    }

    onPointerDown(e) {
      const rect = this.svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.getMouseWorld(e);
      const nearPoint = this.findNearestPointAtScreen(sx, sy);

      if (this.mode === 'viewer') {
        this._viewDragInfo = {
          startX: sx,
          startY: sy,
          vp: deepClone(this.model.viewport)
        };
        this.svg.setPointerCapture(e.pointerId);
        return;
      }


if (this.activeTool === 'move') {
  const drawRect = getDrawableRect(
    this.model.viewport,
    this._svgWidth || rect.width,
    this._svgHeight || rect.height
  );

  const insideDrawArea =
    sx >= drawRect.x &&
    sx <= drawRect.x + drawRect.width &&
    sy >= drawRect.y &&
    sy <= drawRect.y + drawRect.height;

  const hits = this.findObjectsAtScreen(sx, sy);
  this.selectFromHits(hits, sx, sy);

  if (nearPoint && nearPoint.draggable) {
    this._dragInfo = { objectId: nearPoint.id };
    this.svg.setPointerCapture(e.pointerId);
  } else {
    const draggableHit = hits.find(hit => {
      const obj = this.model.getObject(hit.id);
      return obj && obj.isDraggable && obj.isDraggable();
    });

    if (draggableHit) {
      this._dragInfo = { objectId: draggableHit.id };
      this.svg.setPointerCapture(e.pointerId);
      return;
    } else if (insideDrawArea) {
      this._viewDragInfo = {
        startX: sx,
        startY: sy,
        vp: deepClone(this.model.viewport)
      };
      this.svg.setPointerCapture(e.pointerId);
    }
  }

  return;
}





      if (this.activeTool === 'point') {
        const picked = this.pickOrCreateAnchorPoint(world, sx, sy);
        this._pendingPoints = [picked.id];
        this._hoverPointId = picked.id;
        this._previewWorld = null;
        this._toolData = null;

        if (picked.created && picked.constrained) {
          this.renderAndSync();
          this.setStatus(`Punto dependiente creado: ${picked.id}`);
        } else if (picked.created) {
          this.renderAndSync();
          this.setStatus(`Punto creado: ${picked.id}`);
        } else {
          this.render();
          this.setStatus(`Punto reutilizado: ${picked.id}`);
        }

        return;
      }

      if (this.activeTool === 'delete') {
        return this.deleteObjectAndDependents(
          nearPoint ? nearPoint.id : this.findNearestNonPointObjectAtScreen(sx, sy)?.id
        );
      }

      if (this.activeTool === 'text') {
        const anchor = this.getSnappedWorldPosition(world, sx, sy);
        const text = prompt('Texto libre:');
        if (text === null) {
          this.setStatus('Texto cancelado.');
          return;
        }

        const id = this.addTextObject(anchor.x, anchor.y, text, false);
        if (!id) {
          this.setStatus('El texto no puede estar vacío.', true);
          return;
        }

        this.selectObject(id, false);
        this.renderAndSync();
        this.setStatus(`Texto creado: ${id}`);
        return;
      }

      this.handleConstructionClick(world, sx, sy);
    }

    onPointerMove(e) {
      const rect = this.svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.getMouseWorld(e);

      if (this._dragInfo) {
        const obj = this.model.getObject(this._dragInfo.objectId);

        if (obj && obj.isDraggable()) {
          obj.dragTo(this.model, world.x, world.y);
          this.renderDuringInteraction();
        }

        return;
      }

      if (this._viewDragInfo) {
        const baseVp = this._viewDragInfo.vp;
        const w = this._svgWidth || rect.width;
        const h = this._svgHeight || rect.height;
        const t = getViewTransform(baseVp, w, h);

        const dxScreen = sx - this._viewDragInfo.startX;
        const dyScreen = sy - this._viewDragInfo.startY;

        const dxWorld = dxScreen / t.scaleX;
        const dyWorld = dyScreen / t.scaleY;

        this.model.viewport = viewportPan(baseVp, -dxWorld, dyWorld);
        this.renderDuringInteraction();
        return;
      }

      this.updateHoverAndPreview(sx, sy, world);
    }

    onPointerUp() {
      this._dragInfo = null;
      this._viewDragInfo = null;
      this.flushDeferredSync();
    }

    handleEllipseConstructionClick(world, sx, sy) {
      if (this._pendingPoints.length === 0) {
        const picked = this.pickOrCreateAnchorPoint(world, sx, sy);
        this._pendingPoints = [picked.id];
        this._hoverPointId = picked.id;
        this._previewWorld = null;
        this._toolData = null;
        this.renderAndSync();
        this.setStatus('Elipse: define la dirección y longitud del semieje X.');
        return;
      }

      const center = this.model.getPointPosition(this._pendingPoints[0]);
      if (!center) {
        this.resetConstructionState();
        this.renderAndSync();
        this.setStatus('No se pudo resolver el centro de la elipse.', true);
        return;
      }

      const snapped = this.getSnappedWorldPosition(world, sx, sy);

      if (!this._toolData?.ellipse) {
        const rx = dist(center.x, center.y, snapped.x, snapped.y);
        if (!(rx > 1e-9)) {
          this.setStatus('El semieje X debe ser mayor que 0.', true);
          return;
        }

        this._toolData = {
          ellipse: {
            rx,
            rotation: Math.atan2(snapped.y - center.y, snapped.x - center.x)
          }
        };
        this._previewWorld = { x: snapped.x, y: snapped.y };
        this.render();
        this.setStatus('Elipse: define ahora el semieje Y.');
        return;
      }

      const draft = this._toolData.ellipse;
      const local = ellipseLocalCoordinates(center, draft.rotation, snapped.x, snapped.y);
      const ry = Math.abs(local.y);

      if (!(ry > 1e-9)) {
        this.setStatus('El semieje Y debe ser mayor que 0.', true);
        return;
      }

      this.model.addObject({
        id: this.nextId('e'),
        type: 'ellipse',
        center: this._pendingPoints[0],
        rx: draft.rx,
        ry,
        rotation: draft.rotation,
        style: { stroke: '#9333ea' }
      });

      this.resetConstructionState();
      this.renderAndSync();
      this.setStatus('Elipse creada.');
    }

    handleConstructionClick(world, sx, sy) {
      if (this.activeTool === 'ellipse') {
        this.handleEllipseConstructionClick(world, sx, sy);
        return;
      }

      const picked = this.pickOrCreateAnchorPoint(world, sx, sy);
      const id = picked.id;
      if (!id) return;

      if (this.activeTool === 'polygon') {
        const firstId = this._pendingPoints[0];
        const lastId = this._pendingPoints[this._pendingPoints.length - 1];

        if (this._pendingPoints.length >= 3 && id === firstId) {
          this.finishPendingPolygon();
          return;
        }

        if (lastId !== id) {
          this._pendingPoints.push(id);
        }

        this._hoverPointId = id;
        this._previewWorld = { x: world.x, y: world.y };
        this._toolData = null;
        this.renderAndSync();
        this.setStatus(`Polígono: ${this._pendingPoints.length} punto(s). Haz clic en el punto inicial o doble clic para cerrar.`);
        return;
      }

      this._pendingPoints.push(id);
      this._hoverPointId = id;
      this._previewWorld = { x: world.x, y: world.y };
      this._toolData = null;

      if (this.activeTool === 'measure-angle') {
        if (this._pendingPoints.length === 1) {
          this.renderAndSync();
          this.setStatus('Ángulo: selecciona el vértice.');
          return;
        }

        if (this._pendingPoints.length === 2) {
          this.renderAndSync();
          this.setStatus('Ángulo: selecciona el tercer punto.');
          return;
        }

        if (this._pendingPoints.length === 3) {
          const [a, b, c] = this._pendingPoints;
          this.model.addObject({
            id: this.nextId('ang'),
            type: 'measure',
            measureType: 'angle',
            unit: 'deg',
            of: [a, b, c],
            style: { stroke: '#6b7280' }
          });

          this.resetConstructionState();
          this.renderAndSync();
          this.setStatus('Ángulo creado.');
        }
        return;
      }

      if (this._pendingPoints.length === 1) {
        this.renderAndSync();
        if (this.activeTool === 'ray') {
          this.setStatus('Semirrecta: selecciona un punto de dirección.');
        } else {
          this.setStatus('Selecciona el segundo punto.');
        }
        return;
      }

      if (this._pendingPoints.length === 2) {
        const [a, b] = this._pendingPoints;

        if (this.activeTool === 'segment') {
          this.model.addObject({
            id: this.nextId('s'),
            type: 'segment',
            p1: a,
            p2: b,
            style: { stroke: '#1976d2' }
          });
        }

        if (this.activeTool === 'line') {
          this.model.addObject({
            id: this.nextId('r'),
            type: 'line',
            p1: a,
            p2: b,
            style: { stroke: '#2e7d32' }
          });
        }

        if (this.activeTool === 'ray') {
          this.model.addObject({
            id: this.nextId('sr'),
            type: 'ray',
            p1: a,
            p2: b,
            style: { stroke: '#0f766e' }
          });
        }

        if (this.activeTool === 'circle') {
          this.model.addObject({
            id: this.nextId('c'),
            type: 'circle',
            center: a,
            through: b,
            style: { stroke: '#c62828' }
          });
        }

        if (this.activeTool === 'midpoint') {
          this.model.addObject({
            id: this.nextId('M'),
            type: 'midpoint',
            p1: a,
            p2: b,
            label: 'M',
            style: { fill: '#2e7d32' }
          });
        }

        if (this.activeTool === 'measure-distance') {
          this.model.addObject({
            id: this.nextId('m'),
            type: 'measure',
            measureType: 'distance',
            of: [a, b]
          });
        }

        this.resetConstructionState();
        this.renderAndSync();
        this.setStatus('Objeto creado.');
      }
    }

    finishPendingPolygon() {
      const unq = [...new Set(this._pendingPoints)];

      if (unq.length >= 3) {
        this.model.addObject({
          id: this.nextId('poly'),
          type: 'polygon',
          points: unq,
          style: {
            stroke: '#ea580c',
            fill: 'rgba(234,88,12,0.18)'
          }
        });

        this.resetConstructionState();
        this.renderAndSync();
        this.setStatus('Polígono creado.');
      }
    }
  }

  /* =========================================================
   API PÚBLICA
   ========================================================= */
function autoMount(root = document) {
  const base = root && typeof root.querySelectorAll === 'function'
    ? root
    : document;

  base.querySelectorAll('[data-geo2d-editor]').forEach(el => {
    if (!el.__geo2dMounted) {
      el.__geo2dMounted = true;
      window.Geo2D.openEditor({ target: el });
    }
  });

  base.querySelectorAll('[data-geo2d-viewer]').forEach(el => {
    if (!el.__geo2dMounted) {
      el.__geo2dMounted = true;
      window.Geo2D.openViewer({ target: el });
    }
  });
}

const api = Object.freeze({
  Geo2DEditor,

  openEditor(options = {}) {
    return new Geo2DEditor(
      options.target || options.container || '#geo2d-editor',
      { ...options, mode: 'editor' }
    );
  },

  openViewer(options = {}) {
    return new Geo2DEditor(
      options.target || options.container || '#geo2d-viewer',
      { ...options, mode: 'viewer' }
    );
  },

  autoMount
});

window.Geo2D = Object.assign({}, window.Geo2D || {}, api);

/* =========================================================
   AUTO-MONTAJE OPCIONAL
   ========================================================= */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    autoMount(document);
  });
} else {
  autoMount(document);
}

})(window, document);
