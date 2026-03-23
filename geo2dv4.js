/* =========================================================
   GEO2D EDITOR V2.1
   - Puntos unificados
   - Captura mejorada
   - Previsualización en vivo
   - openViewer corregido
   - Círculos corregidos con escala no uniforme
   - Polígono cierra al tocar el punto inicial
   ========================================================= */
(function () {
  'use strict';

  /* =========================================================
     UTILIDADES GENERALES
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
      raw = dataMatch[1]
        .trim()
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
    }

    return ensureScene(JSON.parse(raw));
  }

  function loadSceneFromOptions(options = {}) {
    if (options.scene) return ensureScene(options.scene);
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
        grid-template-columns: 180px 1fr !important;
        min-height: 600px !important;
      }
      @media (max-width: 900px) {
        .geo2d-body { grid-template-columns: 1fr !important; }
        .geo2d-side {
          border-right: none !important;
          border-bottom: 1px solid #d7dce3 !important;
        }
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

function circleScreenRadii(vp, w, h, cx, cy, r) {
  const c = worldToScreen(vp, w, h, cx, cy);
  const ex = worldToScreen(vp, w, h, cx + r, cy);
  const ey = worldToScreen(vp, w, h, cx, cy + r);

  return {
    cx: c.x,
    cy: c.y,
    rx: Math.abs(ex.x - c.x),
    ry: Math.abs(ey.y - c.y),
    r: Math.min(Math.abs(ex.x - c.x), Math.abs(ey.y - c.y))
  };
}

  /* =========================================================
     ESTILOS POR OBJETO
     ========================================================= */
  function mergeStyle(scene, obj, overrides = {}) {
    return {
      stroke: '#1f2937',
      fill: 'none',
      strokeWidth: scene.style.strokeWidth || 2,
      fontSize: scene.style.fontSize || 14,
      pointRadius: scene.style.pointRadius || 5,
      pointCaptureRadius: scene.style.pointCaptureRadius || 14,
      ...(obj.style || {}),
      ...overrides
    };
  }

  function getPointVisibleRadius(scene, obj) {
    return safeNumber(obj.style?.pointRadius, safeNumber(scene.style?.pointRadius, 5));
  }

  function getPointCaptureRadius(scene, obj) {
    return safeNumber(obj.style?.pointCaptureRadius, safeNumber(scene.style?.pointCaptureRadius, 14));
  }

  /* =========================================================
     RESOLUCIÓN DE OBJETOS
     ========================================================= */
  function resolveScene(scene) {
    const map = new Map(scene.objects.map(o => [o.id, o]));

    function resolvePointLike(id) {
      const obj = map.get(id);
      if (!obj) return null;

      if (obj.type === 'point') {
        return { kind: 'point', x: obj.x, y: obj.y, ref: obj };
      }

      if (obj.type === 'midpoint') {
        const a = resolvePointLike(obj.p1);
        const b = resolvePointLike(obj.p2);
        if (!a || !b) return null;
        return {
          kind: 'point',
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          ref: obj
        };
      }

      return null;
    }

    function resolveObject(id) {
      const obj = map.get(id);
      if (!obj) return null;

      if (obj.type === 'point' || obj.type === 'midpoint') {
        return resolvePointLike(id);
      }

      if (obj.type === 'segment') {
        const p1 = resolvePointLike(obj.p1);
        const p2 = resolvePointLike(obj.p2);
        if (!p1 || !p2) return null;
        return { kind: 'segment', p1, p2, ref: obj };
      }

      if (obj.type === 'line') {
        const p1 = resolvePointLike(obj.p1);
        const p2 = resolvePointLike(obj.p2);
        if (!p1 || !p2) return null;
        return { kind: 'line', p1, p2, ref: obj };
      }

      if (obj.type === 'circle') {
        const center = resolvePointLike(obj.center);
        const through = resolvePointLike(obj.through);
        if (!center || !through) return null;
        return {
          kind: 'circle',
          center,
          through,
          radius: dist(center.x, center.y, through.x, through.y),
          ref: obj
        };
      }

      if (obj.type === 'polygon') {
        const points = (obj.points || []).map(resolvePointLike).filter(Boolean);
        if (points.length < 2) return null;
        return { kind: 'polygon', points, ref: obj };
      }

      if (obj.type === 'measure') {
        return { kind: 'measure', ref: obj };
      }

      return null;
    }

    function allResolved() {
      return scene.objects.map(object => ({
        object,
        resolved: resolveObject(object.id)
      }));
    }

    return { resolvePointLike, resolveObject, allResolved };
  }

  function resolveMeasure(scene, resolver, obj) {
    if (obj.measureType === 'distance' && Array.isArray(obj.of) && obj.of.length === 2) {
      const a = resolver.resolvePointLike(obj.of[0]);
      const b = resolver.resolvePointLike(obj.of[1]);
      if (!a || !b) return null;

      const d = dist(a.x, a.y, b.x, b.y);
      return {
        anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        text: d.toFixed(2)
      };
    }
    return null;
  }

  function renderInfiniteLine(group, vp, w, h, p1, p2, attrs) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;

    const points = [];

    if (Math.abs(dx) > 1e-9) {
      const t1 = (vp.xMin - p1.x) / dx;
      const y1 = p1.y + t1 * dy;
      if (y1 >= vp.yMin - 1e-9 && y1 <= vp.yMax + 1e-9) points.push({ x: vp.xMin, y: y1 });

      const t2 = (vp.xMax - p1.x) / dx;
      const y2 = p1.y + t2 * dy;
      if (y2 >= vp.yMin - 1e-9 && y2 <= vp.yMax + 1e-9) points.push({ x: vp.xMax, y: y2 });
    }

    if (Math.abs(dy) > 1e-9) {
      const t3 = (vp.yMin - p1.y) / dy;
      const x3 = p1.x + t3 * dx;
      if (x3 >= vp.xMin - 1e-9 && x3 <= vp.xMax + 1e-9) points.push({ x: x3, y: vp.yMin });

      const t4 = (vp.yMax - p1.y) / dy;
      const x4 = p1.x + t4 * dx;
      if (x4 >= vp.xMin - 1e-9 && x4 <= vp.xMax + 1e-9) points.push({ x: x4, y: vp.yMax });
    }

    const unique = [];
    for (const p of points) {
      if (!unique.some(q => dist2(p.x, p.y, q.x, q.y) < 1e-8)) unique.push(p);
    }
    if (unique.length < 2) return;

    const a = worldToScreen(vp, w, h, unique[0].x, unique[0].y);
    const b = worldToScreen(vp, w, h, unique[1].x, unique[1].y);
    group.appendChild(createSvgEl('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...attrs
    }));
  }

  function getPreviewAnchor(state, resolver) {
    if (state._hoverPointId) {
      const p = resolver.resolvePointLike(state._hoverPointId);
      if (p) return { x: p.x, y: p.y, fromPointId: state._hoverPointId };
    }
    if (state._previewWorld) {
      return { x: state._previewWorld.x, y: state._previewWorld.y, fromPointId: null };
    }
    return null;
  }

  /* =========================================================
     RENDERIZADO
     ========================================================= */
  function renderSceneToSvg(svg, scene, state) {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(300, rect.width || 800);
    const height = Math.max(300, rect.height || 600);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = '';

    const vp = scene.viewport;
    const resolver = resolveScene(scene);

    const pendingPointIds = new Set(state._pendingPoints || []);
    const hoverPointId = state._hoverPointId || null;

    const gGrid = createSvgEl('g');
    const gAxes = createSvgEl('g');
    const gShapes = createSvgEl('g');
    const gPreview = createSvgEl('g');
    const gMeasures = createSvgEl('g');
    const gPointTargets = createSvgEl('g');
    const gPoints = createSvgEl('g');
    const gLabels = createSvgEl('g');

    svg.append(gGrid, gAxes, gShapes, gPreview, gMeasures, gPointTargets, gPoints, gLabels);

    if (vp.showGrid) {
      const sx = niceStep(vp.xMax - vp.xMin);
      const sy = niceStep(vp.yMax - vp.yMin);

      for (let x = Math.ceil(vp.xMin / sx) * sx; x <= vp.xMax + 1e-9; x += sx) {
        const px = worldToScreen(vp, width, height, x, 0).x;
        gGrid.appendChild(createSvgEl('line', {
          x1: px, y1: 0, x2: px, y2: height,
          stroke: '#edf0f4', 'stroke-width': 1
        }));
      }

      for (let y = Math.ceil(vp.yMin / sy) * sy; y <= vp.yMax + 1e-9; y += sy) {
        const py = worldToScreen(vp, width, height, 0, y).y;
        gGrid.appendChild(createSvgEl('line', {
          x1: 0, y1: py, x2: width, y2: py,
          stroke: '#edf0f4', 'stroke-width': 1
        }));
      }
    }

    if (vp.showAxes) {
      if (vp.xMin <= 0 && vp.xMax >= 0) {
        const px = worldToScreen(vp, width, height, 0, 0).x;
        gAxes.appendChild(createSvgEl('line', {
          x1: px, y1: 0, x2: px, y2: height,
          stroke: '#9aa4b2', 'stroke-width': 1.5
        }));
      }

      if (vp.yMin <= 0 && vp.yMax >= 0) {
        const py = worldToScreen(vp, width, height, 0, 0).y;
        gAxes.appendChild(createSvgEl('line', {
          x1: 0, y1: py, x2: width, y2: py,
          stroke: '#9aa4b2', 'stroke-width': 1.5
        }));
      }
    }

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
        renderInfiniteLine(gShapes, vp, width, height, resolved.p1, resolved.p2, {
          stroke: style.stroke,
          'stroke-width': style.strokeWidth
        });
      }


if (resolved.kind === 'circle') {
  const cs = circleScreenRadii(
    vp,
    width,
    height,
    resolved.center.x,
    resolved.center.y,
    resolved.radius
  );

  gShapes.appendChild(createSvgEl('circle', {
    cx: cs.cx,
    cy: cs.cy,
    r: cs.r,
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
        gShapes.appendChild(createSvgEl('polygon', {
          points: pts,
          stroke: style.stroke,
          'stroke-width': style.strokeWidth,
          fill: style.fill || 'none'
        }));
      }

      if (obj.type === 'measure') {
        const vInfo = resolveMeasure(scene, resolver, obj);
        if (vInfo) {
          const p = worldToScreen(vp, width, height, vInfo.anchor.x, vInfo.anchor.y);
          const txt = createSvgEl('text', {
            x: p.x + 8,
            y: p.y - 8,
            class: 'geo2d-measure-label'
          });
          txt.textContent = obj.label ? `${obj.label}: ${vInfo.text}` : vInfo.text;
          gMeasures.appendChild(txt);
        }
      }
    }

    const previewAnchor = getPreviewAnchor(state, resolver);

    if (state._pendingPoints.length > 0 && previewAnchor) {
      const first = resolver.resolvePointLike(state._pendingPoints[0]);

      if (first && ['segment', 'line', 'circle', 'midpoint', 'measure-distance'].includes(state.activeTool)) {
        const styleMap = {
          segment: '#1976d2',
          line: '#2e7d32',
          circle: '#c62828',
          midpoint: '#2e7d32',
          'measure-distance': '#6b7280'
        };
        const previewColor = styleMap[state.activeTool] || '#2563eb';

        if (state.activeTool === 'segment' || state.activeTool === 'midpoint' || state.activeTool === 'measure-distance') {
          const a = worldToScreen(vp, width, height, first.x, first.y);
          const b = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);
          gPreview.appendChild(createSvgEl('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
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

        
      if (state.activeTool === 'circle') {
        const radius = dist(first.x, first.y, previewAnchor.x, previewAnchor.y);
       const cs = circleScreenRadii(vp, width, height, first.x, first.y, radius);

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

      if (state.activeTool === 'polygon') {
        const pts = [];

        for (const id of state._pendingPoints) {
          const p = resolver.resolvePointLike(id);
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
    }

    const pointHitList = [];

    for (const { object: obj, resolved } of resolver.allResolved()) {
      if (!obj.visible && obj.visible !== undefined) continue;
      if (!resolved || resolved.kind !== 'point') continue;

      const style = mergeStyle(scene, obj, { fill: obj.style?.fill || '#ea580c' });
      const p = worldToScreen(vp, width, height, resolved.x, resolved.y);

      const visibleRadius = getPointVisibleRadius(scene, obj);
      const captureRadius = getPointCaptureRadius(scene, obj);

      const isPending = pendingPointIds.has(obj.id);
      const isHovered = hoverPointId === obj.id;

      if (isPending) {
        gPointTargets.appendChild(createSvgEl('circle', {
          cx: p.x, cy: p.y, r: captureRadius,
          fill: 'rgba(234,88,12,0.10)',
          stroke: '#ea580c',
          'stroke-width': 2
        }));
      }

      if (isHovered) {
        gPointTargets.appendChild(createSvgEl('circle', {
          cx: p.x, cy: p.y, r: captureRadius,
          fill: 'rgba(37,99,235,0.10)',
          stroke: '#2563eb',
          'stroke-width': 2
        }));
      }

      const pointCircle = createSvgEl('circle', {
        cx: p.x,
        cy: p.y,
        r: visibleRadius,
        fill: style.fill,
        stroke: isPending ? '#ea580c' : isHovered ? '#2563eb' : style.stroke,
        'stroke-width': isPending || isHovered ? 2.5 : 1.5
      });

      pointCircle.dataset.objectId = obj.id;
      gPoints.appendChild(pointCircle);

      pointHitList.push({
        id: obj.id,
        x: p.x,
        y: p.y,
        r: captureRadius,
        visibleRadius,
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

  /* =========================================================
     EDITOR / VIEWER
     ========================================================= */
  class Geo2DEditor {
    constructor(target, options = {}) {
      this.targetEl = typeof target === 'string' ? document.querySelector(target) : target;
      if (!this.targetEl) throw new Error('Contenedor no encontrado.');

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
      this.scene = loadSceneFromOptions(options);

      this.activeTab = 'visual';
      this.activeTool = 'move';

      this._dragInfo = null;
      this._viewDragInfo = null;
      this._pendingPoints = [];
      this._hoverPointId = null;
      this._previewWorld = null;
      this._objectCounter = this.scene.objects.length + 1;

      this.buildLayout();
      this.bindUI();
      this.syncJsonFromScene();
      this.refreshUI();
      this.render();
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
                <div class="geo2d-toolbtn" data-tool="circle"><span class="txt-ncl">Circunferencia</span></div>
                <div class="geo2d-toolbtn" data-tool="polygon"><span class="txt-ncl">Polígono</span></div>
                <div class="geo2d-toolbtn" data-tool="midpoint"><span class="txt-ncl">Punto medio</span></div>
                <div class="geo2d-toolbtn" data-tool="measure-distance"><span class="txt-ncl">Medir distancia</span></div>
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

      if (this.mode !== 'viewer') {
        this.titleInput = this.root.querySelector('[data-role="title"]');
        this.jsonArea = this.root.querySelector('.geo2d-json-wrap textarea');
        this.modalBackdrop = this.root.querySelector('.geo2d-modal-backdrop');
        this.publishArea = this.root.querySelector('.geo2d-modal textarea');
        this.titleInput.value = this.scene.meta.title || '';
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
            this.refreshUI();
            this.render();
            this.setStatus('Herramienta: ' + this.activeTool);
          }

          if (btn.dataset.tab) {
            this.activeTab = btn.dataset.tab;
            this.refreshUI();
          }
        });

        this.titleInput.addEventListener('input', () => {
          this.scene.meta.title = this.titleInput.value || 'Escena Geo2D';
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
      window.addEventListener('pointerup', () => this.onPointerUp());

      this.svg.addEventListener('wheel', e => {
        e.preventDefault();
        const mw = this.getMouseWorld(e);
        this.scene.viewport = viewportZoom(this.scene.viewport, e.deltaY < 0 ? 0.9 : 1.1, mw.x, mw.y);
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
      } while (this.scene.objects.some(o => o.id === id));
      return id;
    }

    syncJsonFromScene() {
      if (this.mode === 'viewer' || !this.jsonArea) return;
      this.jsonArea.value = jsonPretty(this.scene);
    }

    applyJsonToScene() {
      this.scene = parseSceneText(this.jsonArea.value);
      this.titleInput.value = this.scene.meta.title || '';
      this._pendingPoints = [];
      this._hoverPointId = null;
      this._previewWorld = null;
      this.render();
      this.setStatus('JSON aplicado.');
    }

    render() {
      renderSceneToSvg(this.svg, this.scene, this);
      this.refreshUI();
    }

    renderAndSync() {
      this.render();
      this.syncJsonFromScene();
    }

    handleAction(action) {
      switch (action) {
        case 'new':
          this.scene = defaultScene();
          this.titleInput.value = this.scene.meta.title;
          this._pendingPoints = [];
          this._hoverPointId = null;
          this._previewWorld = null;
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
          downloadTextFile(`${slugify(this.scene.meta.title)}.geo2d.json`, jsonPretty(this.scene));
          this.setStatus('Guardado.');
          break;

        case 'copyjson':
          copyTextToClipboard(jsonPretty(this.scene)).then(() => this.setStatus('Copiado.'));
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
          downloadTextFile(`${slugify(this.scene.meta.title)}.html`, this.publishArea.value, 'text/html');
          break;

        case 'close-modal':
          this.modalBackdrop.style.setProperty('display', 'none', 'important');
          break;
      }
    }

    loadSceneFromText(text) {
      try {
        this.scene = parseSceneText(text);
        if (this.mode !== 'viewer') this.titleInput.value = this.scene.meta.title || '';
        this._pendingPoints = [];
        this._hoverPointId = null;
        this._previewWorld = null;
        this.renderAndSync();
        this.setStatus('Cargada.');
      } catch (err) {
        this.setStatus('Error: ' + err.message, true);
      }
    }

    publishScene() {
      const id = 'geo2d-' + Math.random().toString(36).slice(2, 8);
      return `<div class="geo2d-viewer" id="${id}"></div>
<script type="application/json" id="${id}-data">${jsonPretty(this.scene)}<\/script>
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
        this.scene.viewport,
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

      const needsPreview =
        this.mode !== 'viewer' &&
        this._pendingPoints.length > 0 &&
        ['segment', 'line', 'circle', 'polygon', 'midpoint', 'measure-distance'].includes(this.activeTool);

      const nextPreview = needsPreview ? { x: world.x, y: world.y } : null;

      if (!sameWorld(this._previewWorld, nextPreview)) {
        this._previewWorld = nextPreview;
        dirty = true;
      }

      if (dirty) this.render();
    }

    pickOrCreateAnchorPoint(world, sx, sy) {
      const nearPoint = this.findNearestPointAtScreen(sx, sy);
      if (nearPoint) {
        return { id: nearPoint.id, created: false, point: nearPoint };
      }

      const id = this.addPoint(world.x, world.y, false);
      return { id, created: true, point: null };
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
          vp: deepClone(this.scene.viewport)
        };
        this.svg.setPointerCapture(e.pointerId);
        return;
      }

      if (this.activeTool === 'move') {
        if (nearPoint && nearPoint.draggable) {
          this._dragInfo = { pointId: nearPoint.id };
          this.svg.setPointerCapture(e.pointerId);
        } else {
          this._viewDragInfo = {
            startX: sx,
            startY: sy,
            vp: deepClone(this.scene.viewport)
          };
          this.svg.setPointerCapture(e.pointerId);
        }
        return;
      }

      if (this.activeTool === 'point') {
        const picked = this.pickOrCreateAnchorPoint(world, sx, sy);
        this._pendingPoints = [picked.id];
        this._hoverPointId = picked.id;
        this._previewWorld = null;

        if (picked.created) {
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

      this.handleConstructionClick(world, sx, sy);
    }

    onPointerMove(e) {
      const rect = this.svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = this.getMouseWorld(e);

      if (this._dragInfo) {
        const obj = this.scene.objects.find(o => o.id === this._dragInfo.pointId);
        if (obj && obj.draggable) {
          obj.x = world.x;
          obj.y = world.y;
          this.renderAndSync();
        }
        return;
      }

      if (this._viewDragInfo) {
        const start = screenToWorld(
          this._viewDragInfo.vp,
          this._svgWidth || rect.width,
          this._svgHeight || rect.height,
          this._viewDragInfo.startX,
          this._viewDragInfo.startY
        );

        this.scene.viewport = viewportPan(
          this._viewDragInfo.vp,
          start.x - world.x,
          start.y - world.y
        );

        this.renderAndSync();
        return;
      }

      this.updateHoverAndPreview(sx, sy, world);
    }

    onPointerUp() {
      this._dragInfo = null;
      this._viewDragInfo = null;
    }

    handleConstructionClick(world, sx, sy) {
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
        this.renderAndSync();
        this.setStatus(`Polígono: ${this._pendingPoints.length} punto(s). Haz clic en el punto inicial o doble clic para cerrar.`);
        return;
      }

      this._pendingPoints.push(id);
      this._hoverPointId = id;
      this._previewWorld = { x: world.x, y: world.y };

      if (this._pendingPoints.length === 1) {
        this.renderAndSync();
        this.setStatus('Selecciona el segundo punto.');
        return;
      }

      if (this._pendingPoints.length === 2) {
        const [a, b] = this._pendingPoints;

        if (this.activeTool === 'segment') {
          this.scene.objects.push({
            id: this.nextId('s'),
            type: 'segment',
            p1: a,
            p2: b,
            style: { stroke: '#1976d2' }
          });
        }

        if (this.activeTool === 'line') {
          this.scene.objects.push({
            id: this.nextId('r'),
            type: 'line',
            p1: a,
            p2: b,
            style: { stroke: '#2e7d32' }
          });
        }

        if (this.activeTool === 'circle') {
          this.scene.objects.push({
            id: this.nextId('c'),
            type: 'circle',
            center: a,
            through: b,
            style: { stroke: '#c62828' }
          });
        }

        if (this.activeTool === 'midpoint') {
          this.scene.objects.push({
            id: this.nextId('M'),
            type: 'midpoint',
            p1: a,
            p2: b,
            label: 'M',
            style: { fill: '#2e7d32' }
          });
        }

        if (this.activeTool === 'measure-distance') {
          this.scene.objects.push({
            id: this.nextId('m'),
            type: 'measure',
            measureType: 'distance',
            of: [a, b]
          });
        }

        this._pendingPoints = [];
        this._previewWorld = null;
        this.renderAndSync();
        this.setStatus('Objeto creado.');
      }
    }

    finishPendingPolygon() {
      const unq = [...new Set(this._pendingPoints)];
      if (unq.length >= 3) {
        this.scene.objects.push({
          id: this.nextId('poly'),
          type: 'polygon',
          points: unq,
          style: {
            stroke: '#ea580c',
            fill: 'rgba(234,88,12,0.18)'
          }
        });

        this._pendingPoints = [];
        this._hoverPointId = null;
        this._previewWorld = null;
        this.renderAndSync();
        this.setStatus('Polígono creado.');
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
        style: { fill: '#ea580c' }
      });

      if (sync) this.renderAndSync();
      return id;
    }

    generatePointName() {
      for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (!this.scene.objects.some(o => o.id === c)) return c;
      }
      return this.nextId('P');
    }

    deleteObjectAndDependents(id) {
      if (!id) return;

      const deps = new Set([id]);
      let changed = true;

      while (changed) {
        changed = false;
        for (const obj of this.scene.objects) {
          if (deps.has(obj.id)) continue;

          const refs = [
            obj.p1,
            obj.p2,
            obj.center,
            obj.through,
            obj.ref,
            ...(obj.points || []),
            ...(obj.of || [])
          ];

          if (refs.some(r => deps.has(r))) {
            deps.add(obj.id);
            changed = true;
          }
        }
      }

      this.scene.objects = this.scene.objects.filter(o => !deps.has(o.id));
      this._pendingPoints = this._pendingPoints.filter(pid => !deps.has(pid));
      this._hoverPointId = deps.has(this._hoverPointId) ? null : this._hoverPointId;
      this.renderAndSync();
      this.setStatus('Objeto borrado.');
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

    p2ellipseBorderSquared(sx, sy, cx, cy, rx, ry) {
      if (rx < 1e-9 || ry < 1e-9) return dist2(sx, sy, cx, cy);

      const nx = (sx - cx) / rx;
      const ny = (sy - cy) / ry;
      const t = Math.atan2(ny, nx);

      const bx = cx + rx * Math.cos(t);
      const by = cy + ry * Math.sin(t);

      return dist2(sx, sy, bx, by);
    }

    findNearestNonPointObjectAtScreen(sx, sy) {
      const res = resolveScene(this.scene);
      const vp = this.scene.viewport;

      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.scene.objects) {
        if (['point', 'midpoint', 'intersection'].includes(obj.type)) continue;

        const r = res.resolveObject(obj.id);
        if (!r) continue;

        let d2 = Infinity;

        if (r.kind === 'segment') {
          d2 = this.p2s(sx, sy, r.p1, r.p2, vp);
        }

        if (r.kind === 'line') {
          d2 = this.p2l(sx, sy, r.p1, r.p2, vp);
        }

        if (r.kind === 'circle') {
          const cs = circleScreenRadii(
            vp,
            this._svgWidth,
            this._svgHeight,
            r.center.x,
            r.center.y,
            r.radius
          );

          d2 = this.p2ellipseBorderSquared(sx, sy, cs.cx, cs.cy, cs.rx, cs.ry);
        }

        if (d2 < 100 && d2 < bestD2) {
          best = obj;
          bestD2 = d2;
        }
      }

      return best;
    }
  }

  /* =========================================================
     API PÚBLICA
     ========================================================= */
  window.Geo2D = {
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
    }
  };

  /* =========================================================
     AUTO-MONTAJE OPCIONAL
     ========================================================= */
  window.addEventListener('load', () => {
    document.querySelectorAll('[data-geo2d-editor]').forEach(el => {
      if (!el.__geo2dMounted) {
        el.__geo2dMounted = true;
        window.Geo2D.openEditor({ target: el });
      }
    });

    document.querySelectorAll('[data-geo2d-viewer]').forEach(el => {
      if (!el.__geo2dMounted) {
        el.__geo2dMounted = true;
        window.Geo2D.openViewer({ target: el });
      }
    });
  });
})();
