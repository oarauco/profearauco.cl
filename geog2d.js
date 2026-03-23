/* =========================================================
   GEO2D EDITOR V1 (MODO 'CLOSED SHADOW' + ALTO CONTRASTE)
   ---------------------------------------------------------
   Un solo script JavaScript que:
   - crea el layout encapsulado en un Shadow DOM CERRADO.
   - Usa colores de alto contraste para burlar la accesibilidad de Moodle.
   - renderiza una escena geométrica 2D en SVG.
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     PARTE 1. UTILIDADES GENERALES
     ========================================================= */

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist2(x1, y1, x2, y2) { const dx = x2 - x1; const dy = y2 - y1; return dx * dx + dy * dy; }
  function dist(x1, y1, x2, y2) { return Math.sqrt(dist2(x1, y1, x2, y2)); }
  function safeNumber(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function slugify(text) {
    return String(text || 'escena-geo2d').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'escena-geo2d';
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
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
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
      version: 1, meta: { title: 'Escena Geo2D', author: '', description: '' },
      viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10, showGrid: true, showAxes: true, lockAspect: false },
      style: { pointRadius: 5, strokeWidth: 2, fontSize: 14 }, objects: []
    };
    const out = deepClone(base);
    if (scene && typeof scene === 'object') {
      if (typeof scene.version === 'number') out.version = scene.version;
      if (scene.meta) out.meta = { ...out.meta, ...scene.meta };
      if (scene.viewport) out.viewport = { ...out.viewport, ...scene.viewport };
      if (scene.style) out.style = { ...out.style, ...scene.style };
      if (Array.isArray(scene.objects)) out.objects = deepClone(scene.objects);
    }
    return out;
  }

  function parseSceneText(text) {
    let raw = String(text || '').trim();
    if (!raw) throw new Error('No hay contenido para cargar.');
    const scriptMatch = raw.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch) raw = scriptMatch[1].trim();
    const dataMatch = raw.match(/data-scene='([\s\S]*?)'/i) || raw.match(/data-scene="([\s\S]*?)"/i);
    if (dataMatch) raw = dataMatch[1].trim().replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    return ensureScene(JSON.parse(raw));
  }

  function jsonPretty(obj) { return JSON.stringify(obj, null, 2); }

  function defaultScene() {
    return ensureScene({
      meta: { title: 'Nueva escena' },
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
     PARTE 2. ESTILOS AISLADOS (ALTO CONTRASTE)
     ========================================================= */
  function getEditorStyles() {
    return `
      .geo2d-root {
        all: initial !important; 
        display: flex !important;
        flex-direction: column !important;
        font-family: 'Segoe UI', Arial, sans-serif !important;
        background-color: #ffffff !important;
        border: 1px solid #d7dce3 !important;
        border-radius: 14px !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .geo2d-root * { box-sizing: border-box !important; }

      /* Reset anti-Moodle estricto para textos */
      .txt {
        font-family: 'Segoe UI', Arial, sans-serif !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.5 !important;
        letter-spacing: normal !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      /* Toolbar */
      .geo2d-toolbar {
        display: flex !important; gap: 8px !important; flex-wrap: wrap !important; align-items: center !important;
        padding: 12px !important; background-color: #f6f8fb !important; border-bottom: 1px solid #d7dce3 !important;
      }
      .geo2d-btn {
        background-color: #ffffff !important; 
        border: 1px solid #d7dce3 !important; border-radius: 8px !important; padding: 8px 12px !important;
        cursor: pointer !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;
      }
      .geo2d-btn .txt { color: #111827 !important; -webkit-text-fill-color: #111827 !important; }
      .geo2d-btn:hover { background-color: #f3f4f6 !important; }
      
      .geo2d-toolbar input {
        border: 1px solid #d7dce3 !important; border-radius: 8px !important; padding: 8px 12px !important; 
        color: #111827 !important; background: #fff !important; font-family: inherit !important; font-size: 14px !important;
      }

      /* Body */
      .geo2d-body { display: grid !important; grid-template-columns: 180px 1fr !important; min-height: 600px !important; }
      @media (max-width: 900px) { .geo2d-body { grid-template-columns: 1fr !important; } .geo2d-side { border-right: none !important; border-bottom: 1px solid #d7dce3 !important; } }

      /* Sidebar */
      .geo2d-side { border-right: 1px solid #d7dce3 !important; background-color: #f9fafb !important; padding: 12px !important; }
      .geo2d-side h3 { margin: 0 0 12px 0 !important; font-size: 12px !important; color: #4b5563 !important; -webkit-text-fill-color: #4b5563 !important; text-transform: uppercase !important; font-weight: 700 !important; }
      
      .geo2d-toolgrid { display: grid !important; gap: 6px !important; }
      
      /* Botones de herramienta (Estado inactivo: Alto contraste) */
      .geo2d-toolbtn {
        display: flex !important; align-items: center !important; width: 100% !important;
        padding: 10px 12px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important;
        background-color: #ffffff !important; cursor: pointer !important; transition: 0.1s !important;
      }
      .geo2d-toolbtn .txt { color: #111827 !important; -webkit-text-fill-color: #111827 !important; }
      
      /* Botones de herramienta (Estado activo: Naranja) */
      .geo2d-toolbtn.active { background-color: #ea580c !important; border-color: #ea580c !important; box-shadow: 0 2px 6px rgba(234,88,12,.30) !important; }
      .geo2d-toolbtn.active .txt { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }

      /* Tabs */
      .geo2d-main { display: flex !important; flex-direction: column !important; min-width: 0 !important; }
      .geo2d-tabs { display: flex !important; gap: 4px !important; padding: 12px 12px 0 12px !important; background-color: #ffffff !important; border-bottom: 1px solid #d7dce3 !important; }
      
      .geo2d-tab {
        padding: 8px 16px !important; background-color: #f3f4f6 !important; border: 1px solid #d7dce3 !important;
        border-bottom: none !important; border-radius: 8px 8px 0 0 !important; cursor: pointer !important;
      }
      .geo2d-tab .txt { color: #4b5563 !important; -webkit-text-fill-color: #4b5563 !important; }
      
      .geo2d-tab.active { background-color: #ffffff !important; margin-bottom: -1px !important; border-bottom: 1px solid #ffffff !important; }
      .geo2d-tab.active .txt { color: #111827 !important; -webkit-text-fill-color: #111827 !important; font-weight: 700 !important; }

      /* Panels */
      .geo2d-panels { flex: 1 !important; display: flex !important; flex-direction: column !important; position: relative !important; background: #fff !important; }
      .geo2d-panel { display: none !important; flex: 1 !important; flex-direction: column !important; height: 100% !important; width: 100% !important; }
      .geo2d-panel.active { display: flex !important; }

      .geo2d-canvas-wrap { flex: 1 !important; min-height: 500px !important; position: relative !important; }
      .geo2d-canvas-wrap svg { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; touch-action: none !important;}
      
      .geo2d-status { padding: 8px 12px !important; border-top: 1px solid #d7dce3 !important; background-color: #f9fafb !important; color: #4b5563 !important; -webkit-text-fill-color: #4b5563 !important; font-size: 13px !important; }

      .geo2d-json-wrap { flex: 1 !important; display: flex !important; flex-direction: column !important; }
      .geo2d-json-wrap textarea { flex: 1 !important; width: 100% !important; border: none !important; padding: 16px !important; font-family: Consolas, monospace !important; font-size: 14px !important; color: #111827 !important; -webkit-text-fill-color: #111827 !important; outline: none !important; resize: none !important; }
      .geo2d-json-actions { display: flex !important; gap: 8px !important; padding: 12px !important; border-top: 1px solid #d7dce3 !important; background-color: #f9fafb !important; }

      /* Modals */
      .geo2d-modal-backdrop { position: fixed !important; inset: 0 !important; background-color: rgba(0,0,0,0.5) !important; display: none !important; align-items: center !important; justify-content: center !important; z-index: 999999 !important; padding: 16px !important; }
      .geo2d-modal-backdrop.open { display: flex !important; }
      .geo2d-modal { width: min(900px, 96vw) !important; background-color: #ffffff !important; border-radius: 12px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important; display: flex !important; flex-direction: column !important; overflow: hidden !important; }
      .geo2d-modal-head { padding: 16px !important; border-bottom: 1px solid #d7dce3 !important; background-color: #f6f8fb !important; color: #111827 !important; font-weight: bold !important; }
      .geo2d-modal-body textarea { width: 100% !important; height: 50vh !important; border: none !important; padding: 16px !important; font-family: Consolas, monospace !important; color: #111827 !important; }
      .geo2d-modal-foot { padding: 16px !important; border-top: 1px solid #d7dce3 !important; display: flex !important; gap: 8px !important; background-color: #f6f8fb !important; }
      
      .geo2d-legendline { font-size: 12px !important; fill: #374151 !important; font-family: Arial, sans-serif !important; }
      .geo2d-measure-label { font-size: 12px !important; fill: #374151 !important; paint-order: stroke !important; stroke: #ffffff !important; stroke-width: 3px !important; font-weight: bold !important; font-family: Arial, sans-serif !important; }
      .geo2d-hidden { display: none !important; }
    `;
  }

  /* =========================================================
     PARTE 3. MOTOR DE COORDENADAS Y SVG
     ========================================================= */

  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null) el.setAttribute(k, String(v));
    }
    return el;
  }

  function worldToScreen(vp, w, h, x, y) {
    return { x: (x - vp.xMin) / (vp.xMax - vp.xMin) * w, y: h - (y - vp.yMin) / (vp.yMax - vp.yMin) * h };
  }

  function screenToWorld(vp, w, h, sx, sy) {
    return { x: vp.xMin + (sx / w) * (vp.xMax - vp.xMin), y: vp.yMin + ((h - sy) / h) * (vp.yMax - vp.yMin) };
  }

  function viewportZoom(vp, factor, cx, cy) {
    return {
      ...vp,
      xMin: cx + (vp.xMin - cx) * factor, xMax: cx + (vp.xMax - cx) * factor,
      yMin: cy + (vp.yMin - cy) * factor, yMax: cy + (vp.yMax - cy) * factor
    };
  }

  function viewportPan(vp, dx, dy) {
    return { ...vp, xMin: vp.xMin + dx, xMax: vp.xMax + dx, yMin: vp.yMin + dy, yMax: vp.yMax + dy };
  }

  function niceStep(span) {
    const target = span / 10;
    const pow = Math.pow(10, Math.floor(Math.log10(target || 1)));
    const n = target / pow;
    return (n > 5 ? 10 : n > 2 ? 5 : n > 1 ? 2 : 1) * pow;
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
      stroke: '#222', fill: 'none', strokeWidth: globalStyle.strokeWidth || 2,
      pointRadius: globalStyle.pointRadius || 5, fontSize: globalStyle.fontSize || 14,
      ...obj.style, ...extra
    };
  }

  function extendLineToViewport(vp, p1, p2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y, eps = 1e-9, pts = [];
    if (Math.abs(dx) > eps) {
      const y1 = p1.y + ((vp.xMin - p1.x) / dx) * dy;
      if (y1 >= vp.yMin - eps && y1 <= vp.yMax + eps) pts.push({ x: vp.xMin, y: y1 });
      const y2 = p1.y + ((vp.xMax - p1.x) / dx) * dy;
      if (y2 >= vp.yMin - eps && y2 <= vp.yMax + eps) pts.push({ x: vp.xMax, y: y2 });
    }
    if (Math.abs(dy) > eps) {
      const x3 = p1.x + ((vp.yMin - p1.y) / dy) * dx;
      if (x3 >= vp.xMin - eps && x3 <= vp.xMax + eps) pts.push({ x: x3, y: vp.yMin });
      const x4 = p1.x + ((vp.yMax - p1.y) / dy) * dx;
      if (x4 >= vp.xMin - eps && x4 <= vp.xMax + eps) pts.push({ x: x4, y: vp.yMax });
    }
    const unique = [];
    for (const p of pts) { if (!unique.some(q => dist2(p.x, p.y, q.x, q.y) < 1e-12)) unique.push(p); }
    return unique.length >= 2 ? [unique[0], unique[1]] : null;
  }

  function resolveScene(scene) {
    const map = buildObjectMap(scene);
    const cache = new Map();

    function getPointLike(id) {
      const res = resolveObject(id);
      return res && res.kind === 'point' ? res : null;
    }

    function resolveObject(id) {
      if (cache.has(id)) return cache.get(id);
      const obj = map.get(id);
      if (!obj) return null;

      let result = null;
      switch (obj.type) {
        case 'point': result = { kind: 'point', x: safeNumber(obj.x), y: safeNumber(obj.y), source: obj }; break;
        case 'segment': {
          const p1 = getPointLike(obj.p1), p2 = getPointLike(obj.p2);
          if (p1 && p2) result = { kind: 'segment', p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y }, source: obj };
          break;
        }
        case 'line': {
          const p1 = getPointLike(obj.p1), p2 = getPointLike(obj.p2);
          if (p1 && p2 && dist2(p1.x, p1.y, p2.x, p2.y) > 1e-12) result = { kind: 'line', p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y }, source: obj };
          break;
        }
        case 'circle': {
          const center = getPointLike(obj.center), through = getPointLike(obj.through);
          if (center && through) result = { kind: 'circle', center: { x: center.x, y: center.y }, radius: dist(center.x, center.y, through.x, through.y), source: obj };
          break;
        }
        case 'polygon': {
          const pts = []; let ok = true;
          for (const pid of obj.points || []) {
            const p = getPointLike(pid);
            if (!p) { ok = false; break; }
            pts.push({ x: p.x, y: p.y });
          }
          if (ok && pts.length >= 2) result = { kind: 'polygon', points: pts, source: obj };
          break;
        }
        case 'midpoint': {
          const p1 = getPointLike(obj.p1), p2 = getPointLike(obj.p2);
          if (p1 && p2) result = { kind: 'point', x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, source: obj };
          break;
        }
        case 'measure': result = { kind: 'measure', source: obj }; break;
      }
      cache.set(id, result);
      return result;
    }

    return {
      resolveObject,
      getObjectById(id) { return map.get(id) || null; },
      allResolved() { return scene.objects.map(obj => ({ object: obj, resolved: resolveObject(obj.id) })); }
    };
  }

  function resolveMeasure(scene, resolver, obj) {
    const type = obj.measureType;
    const ids = obj.of || [];
    if (type === 'distance' && ids.length >= 2) {
      const a = resolver.resolveObject(ids[0]), b = resolver.resolveObject(ids[1]);
      if (a && b && a.kind === 'point' && b.kind === 'point') {
        return { text: dist(a.x, a.y, b.x, b.y).toFixed(2), anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      }
    }
    return null;
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

    const gGrid = createSvgEl('g'), gAxes = createSvgEl('g'), gShapes = createSvgEl('g');
    const gMeasures = createSvgEl('g'), gPoints = createSvgEl('g'), gLabels = createSvgEl('g');
    svg.append(gGrid, gAxes, gShapes, gMeasures, gPoints, gLabels);

    if (vp.showGrid) {
      const sx = niceStep(vp.xMax - vp.xMin), sy = niceStep(vp.yMax - vp.yMin);
      for (let x = Math.ceil(vp.xMin / sx) * sx; x <= vp.xMax + 1e-9; x += sx) {
        const p = worldToScreen(vp, width, height, x, 0);
        gGrid.appendChild(createSvgEl('line', { x1: p.x, y1: 0, x2: p.x, y2: height, stroke: '#edf0f4', 'stroke-width': 1 }));
      }
      for (let y = Math.ceil(vp.yMin / sy) * sy; y <= vp.yMax + 1e-9; y += sy) {
        const p = worldToScreen(vp, width, height, 0, y);
        gGrid.appendChild(createSvgEl('line', { x1: 0, y1: p.y, x2: width, y2: p.y, stroke: '#edf0f4', 'stroke-width': 1 }));
      }
    }

    if (vp.showAxes) {
      if (vp.xMin <= 0 && vp.xMax >= 0) {
        const p = worldToScreen(vp, width, height, 0, 0);
        gAxes.appendChild(createSvgEl('line', { x1: p.x, y1: 0, x2: p.x, y2: height, stroke: '#9aa4b2', 'stroke-width': 1.5 }));
      }
      if (vp.yMin <= 0 && vp.yMax >= 0) {
        const p = worldToScreen(vp, width, height, 0, 0);
        gAxes.appendChild(createSvgEl('line', { x1: 0, y1: p.y, x2: width, y2: p.y, stroke: '#9aa4b2', 'stroke-width': 1.5 }));
      }
    }

    for (const { object: obj, resolved } of resolver.allResolved()) {
      if (!obj.visible && obj.visible !== undefined) continue;
      if (!resolved) continue;

      const style = mergeStyle(scene, obj);
      if (resolved.kind === 'segment') {
        const a = worldToScreen(vp, width, height, resolved.p1.x, resolved.p1.y), b = worldToScreen(vp, width, height, resolved.p2.x, resolved.p2.y);
        gShapes.appendChild(createSvgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: style.stroke, 'stroke-width': style.strokeWidth }));
      }
      if (resolved.kind === 'line') {
        const ext = extendLineToViewport(vp, resolved.p1, resolved.p2);
        if (ext) {
          const a = worldToScreen(vp, width, height, ext[0].x, ext[0].y), b = worldToScreen(vp, width, height, ext[1].x, ext[1].y);
          gShapes.appendChild(createSvgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: style.stroke, 'stroke-width': style.strokeWidth }));
        }
      }
      if (resolved.kind === 'circle') {
        const c = worldToScreen(vp, width, height, resolved.center.x, resolved.center.y), edge = worldToScreen(vp, width, height, resolved.center.x + resolved.radius, resolved.center.y);
        gShapes.appendChild(createSvgEl('circle', { cx: c.x, cy: c.y, r: Math.abs(edge.x - c.x), stroke: style.stroke, 'stroke-width': style.strokeWidth, fill: style.fill || 'none' }));
      }
      if (resolved.kind === 'polygon') {
        const pts = resolved.points.map(p => { const s = worldToScreen(vp, width, height, p.x, p.y); return `${s.x},${s.y}`; }).join(' ');
        gShapes.appendChild(createSvgEl('polygon', { points: pts, stroke: style.stroke, 'stroke-width': style.strokeWidth, fill: style.fill || 'none' }));
      }
      if (obj.type === 'measure') {
        const valueInfo = resolveMeasure(scene, resolver, obj);
        if (valueInfo) {
          const p = worldToScreen(vp, width, height, valueInfo.anchor.x, valueInfo.anchor.y);
          const txt = createSvgEl('text', { x: p.x + 8, y: p.y - 8, class: 'geo2d-measure-label' });
          txt.textContent = obj.label ? `${obj.label}: ${valueInfo.text}` : valueInfo.text;
          gMeasures.appendChild(txt);
        }
      }
    }

    const pointHitList = [];
    for (const { object: obj, resolved } of resolver.allResolved()) {
      if (!obj.visible && obj.visible !== undefined) continue;
      if (!resolved || resolved.kind !== 'point') continue;

      const style = mergeStyle(scene, obj, { fill: obj.style?.fill || '#ea580c' });
      const p = worldToScreen(vp, width, height, resolved.x, resolved.y);

      const c = createSvgEl('circle', { cx: p.x, cy: p.y, r: style.pointRadius, fill: style.fill, stroke: style.stroke, 'stroke-width': 1.5 });
      c.dataset.objectId = obj.id;
      gPoints.appendChild(c);

      pointHitList.push({ id: obj.id, x: p.x, y: p.y, r: style.pointRadius + 8, draggable: !!obj.draggable && obj.type === 'point' });

      if (obj.label) {
        const t = createSvgEl('text', { x: p.x + 10, y: p.y - 10, class: 'geo2d-legendline', 'font-size': style.fontSize });
        t.textContent = obj.label;
        gLabels.appendChild(t);
      }
    }

    state._pointHitList = pointHitList;
    state._svgWidth = width;
    state._svgHeight = height;
  }

  /* =========================================================
     PARTE 6. CLASE PRINCIPAL DEL EDITOR (CLOSED SHADOW DOM)
     ========================================================= */

  class Geo2DEditor {
    constructor(target, options = {}) {
      this.targetEl = typeof target === 'string' ? document.querySelector(target) : target;
      if (!this.targetEl) throw new Error('No se encontró el contenedor.');

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
      this.scene = ensureScene(options.scene || defaultScene());

      this.activeTab = 'visual';
      this.activeTool = 'move';
      this._dragInfo = null;
      this._viewDragInfo = null;
      this._pendingPoints = [];
      this._objectCounter = this.scene.objects.length + 1;

      this.buildLayout();
      this.refreshToolButtons();
      this.bindUI();
      this.syncJsonFromScene();
      this.render();
    }

    buildLayout() {
      this.root = document.createElement('div');
      this.root.className = 'geo2d-root';

      this.root.innerHTML = `
        <div class="geo2d-toolbar">
          <div class="geo2d-btn" data-action="new"><span class="txt">Nuevo</span></div>
          <div class="geo2d-btn" data-action="load"><span class="txt">Cargar</span></div>
          <div class="geo2d-btn" data-action="save"><span class="txt">Guardar JSON</span></div>
          <div class="geo2d-btn" data-action="publish"><span class="txt">Publicar HTML</span></div>
          <div class="geo2d-btn" data-action="copyjson"><span class="txt">Copiar JSON</span></div>
          <span style="flex:1"></span>
          <input type="text" data-role="title" placeholder="Título de la escena" />
        </div>

        <div class="geo2d-body">
          <aside class="geo2d-side">
            <h3>Herramientas</h3>
            <div class="geo2d-toolgrid">
              <div class="geo2d-toolbtn active" data-tool="move"><span class="txt">Mover / Vista</span></div>
              <div class="geo2d-toolbtn" data-tool="point"><span class="txt">Punto</span></div>
              <div class="geo2d-toolbtn" data-tool="segment"><span class="txt">Segmento</span></div>
              <div class="geo2d-toolbtn" data-tool="line"><span class="txt">Recta</span></div>
              <div class="geo2d-toolbtn" data-tool="circle"><span class="txt">Circunferencia</span></div>
              <div class="geo2d-toolbtn" data-tool="polygon"><span class="txt">Polígono</span></div>
              <div class="geo2d-toolbtn" data-tool="midpoint"><span class="txt">Punto medio</span></div>
              <div class="geo2d-toolbtn" data-tool="measure-distance"><span class="txt">Medir distancia</span></div>
              <div class="geo2d-toolbtn" data-tool="delete"><span class="txt">Borrar</span></div>
            </div>
          </aside>

          <main class="geo2d-main">
            <div class="geo2d-tabs">
              <div class="geo2d-tab active" data-tab="visual"><span class="txt">Visual</span></div>
              <div class="geo2d-tab" data-tab="json"><span class="txt">JSON</span></div>
            </div>

            <div class="geo2d-panels">
              <div class="geo2d-panel active" data-panel="visual">
                <div class="geo2d-canvas-wrap">
                  <svg></svg>
                </div>
                <div class="geo2d-status" data-role="status">Listo.</div>
              </div>

              <div class="geo2d-panel" data-panel="json">
                <div class="geo2d-json-wrap">
                  <textarea spellcheck="false"></textarea>
                  <div class="geo2d-json-actions">
                    <div class="geo2d-btn" data-action="apply-json"><span class="txt">Aplicar cambios</span></div>
                    <div class="geo2d-btn" data-action="format-json"><span class="txt">Formatear JSON</span></div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

        <div class="geo2d-modal-backdrop">
          <div class="geo2d-modal">
            <div class="geo2d-modal-head">Publicar HTML</div>
            <div class="geo2d-modal-body">
              <textarea spellcheck="false" readonly></textarea>
            </div>
            <div class="geo2d-modal-foot">
              <div class="geo2d-btn" data-action="copy-published"><span class="txt">Copiar HTML</span></div>
              <div class="geo2d-btn" data-action="download-published"><span class="txt">Descargar HTML</span></div>
              <div class="geo2d-btn" data-action="close-modal"><span class="txt">Cerrar</span></div>
            </div>
          </div>
        </div>
      `;

      this.shadow.appendChild(this.root);

      this.svg = this.root.querySelector('svg');
      this.statusEl = this.root.querySelector('[data-role="status"]');
      this.titleInput = this.root.querySelector('[data-role="title"]');
      this.jsonArea = this.root.querySelector('.geo2d-json-wrap textarea');
      this.modalBackdrop = this.root.querySelector('.geo2d-modal-backdrop');
      this.publishArea = this.root.querySelector('.geo2d-modal textarea');

      this.titleInput.value = this.scene.meta.title || '';
    }

    bindUI() {
      this.root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action], [data-tool], [data-tab]');
        if (!btn) return;
        if (btn.dataset.action) this.handleAction(btn.dataset.action);
        if (btn.dataset.tool) this.setTool(btn.dataset.tool);
        if (btn.dataset.tab) this.setTab(btn.dataset.tab);
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
          this.setStatus('Error: ' + err.message, true);
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

    setStatus(text, isError = false) {
      this.statusEl.textContent = text;
      this.statusEl.style.color = isError ? '#c62828' : '#4b5563';
    }

    setTab(tab) {
      this.activeTab = tab;
      this.root.querySelectorAll('.geo2d-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
      this.root.querySelectorAll('.geo2d-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
    }

    setTool(tool) {
      this.activeTool = tool;
      this._pendingPoints = [];
      this.refreshToolButtons();
      this.setStatus('Herramienta: ' + tool);
    }

    nextId(prefix) {
      let id; do { id = `${prefix}${this._objectCounter++}`; } while (this.scene.objects.some(o => o.id === id)); return id;
    }

    syncJsonFromScene() { this.jsonArea.value = jsonPretty(this.scene); }

    applyJsonToScene() {
      this.scene = parseSceneText(this.jsonArea.value);
      this.titleInput.value = this.scene.meta.title || '';
      this._pendingPoints = [];
      this.render();
      this.setStatus('JSON aplicado.');
    }

    render() { renderSceneToSvg(this.svg, this.scene, this); this.refreshToolButtons(); }
    renderAndSync() { this.render(); this.syncJsonFromScene(); }

    refreshToolButtons() {
      this.root.querySelectorAll('.geo2d-toolbtn').forEach(btn => btn.classList.toggle('active', btn.dataset.tool === this.activeTool));
    }

    handleAction(action) {
      switch (action) {
        case 'new': this.scene = defaultScene(); this.titleInput.value = this.scene.meta.title; this._pendingPoints = []; this.renderAndSync(); this.setStatus('Nueva escena.'); break;
        case 'load': if (confirm('Aceptar = abrir archivo\nCancelar = pegar código manualmente')) this.hiddenFileInput.click(); else { const raw = prompt('Pega el JSON:'); if (raw) this.loadSceneFromText(raw); } break;
        case 'save': downloadTextFile(`${slugify(this.scene.meta.title)}.geo2d.json`, jsonPretty(this.scene), 'application/json'); this.setStatus('Guardado.'); break;
        case 'copyjson': copyTextToClipboard(jsonPretty(this.scene)).then(() => this.setStatus('Copiado.')).catch(() => this.setStatus('Error al copiar.', true)); break;
        case 'publish': this.publishArea.value = this.publishScene(); this.modalBackdrop.classList.add('open'); this.setStatus('HTML generado.'); break;
        case 'apply-json': try { this.applyJsonToScene(); } catch (err) { this.setStatus('Error: ' + err.message, true); } break;
        case 'format-json': try { this.jsonArea.value = jsonPretty(parseSceneText(this.jsonArea.value)); this.setStatus('Formateado.'); } catch (err) { this.setStatus('Error: ' + err.message, true); } break;
        case 'copy-published': copyTextToClipboard(this.publishArea.value).then(() => this.setStatus('HTML copiado.')); break;
        case 'download-published': downloadTextFile(`${slugify(this.scene.meta.title)}.html`, this.publishArea.value, 'text/html'); break;
        case 'close-modal': this.modalBackdrop.classList.remove('open'); break;
      }
    }

    loadSceneFromText(text) {
      try { this.scene = parseSceneText(text); this.titleInput.value = this.scene.meta.title || ''; this._pendingPoints = []; this.renderAndSync(); this.setStatus('Cargada.'); }
      catch (err) { this.setStatus('Error: ' + err.message, true); }
    }

    publishScene() {
      const id = 'geo2d-' + Math.random().toString(36).slice(2, 8);
      return [
        `<div class="geo2d-viewer" id="${id}"></div>`,
        `<script type="application/json" id="${id}-data">${jsonPretty(this.scene)}</script>`,
        `<script>window.Geo2D && Geo2D.openViewer({ target: "#${id}", sceneSource: "#${id}-data" });</script>`
      ].join('\n');
    }

    getMouseWorld(e) {
      const r = this.svg.getBoundingClientRect();
      return screenToWorld(this.scene.viewport, this._svgWidth || r.width, this._svgHeight || r.height, e.clientX - r.left, e.clientY - r.top);
    }

    findNearestPointAtScreen(sx, sy) {
      let best = null, bestD2 = Infinity;
      for (const p of (this._pointHitList || [])) {
        const d2 = dist2(sx, sy, p.x, p.y);
        if (d2 <= p.r * p.r && d2 < bestD2) { best = p; bestD2 = d2; }
      }
      return best;
    }

    onPointerDown(e) {
      if (this.mode === 'viewer') return;
      const rect = this.svg.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const world = screenToWorld(this.scene.viewport, this._svgWidth || rect.width, this._svgHeight || rect.height, sx, sy);
      const nearPoint = this.findNearestPointAtScreen(sx, sy);

      if (this.activeTool === 'move') {
        if (nearPoint && nearPoint.draggable) { this._dragInfo = { pointId: nearPoint.id }; this.svg.setPointerCapture(e.pointerId); }
        else { this._viewDragInfo = { startX: sx, startY: sy, vp: deepClone(this.scene.viewport) }; this.svg.setPointerCapture(e.pointerId); }
        return;
      }
      if (this.activeTool === 'point') return this.addPoint(world.x, world.y);
      if (this.activeTool === 'delete') return this.deleteObjectAndDependents(nearPoint ? nearPoint.id : (this.findNearestNonPointObjectAtScreen(sx, sy)?.id));
      this.handleConstructionClick(world, nearPoint);
    }

    onPointerMove(e) {
      const rect = this.svg.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const world = screenToWorld(this.scene.viewport, this._svgWidth || rect.width, this._svgHeight || rect.height, sx, sy);
      if (this._dragInfo) {
        const obj = this.scene.objects.find(o => o.id === this._dragInfo.pointId);
        if (obj && obj.draggable) { obj.x = world.x; obj.y = world.y; this.renderAndSync(); }
      } else if (this._viewDragInfo) {
        const start = screenToWorld(this._viewDragInfo.vp, this._svgWidth || rect.width, this._svgHeight || rect.height, this._viewDragInfo.startX, this._viewDragInfo.startY);
        this.scene.viewport = viewportPan(this._viewDragInfo.vp, start.x - world.x, start.y - world.y);
        this.renderAndSync();
      }
    }

    onPointerUp() { this._dragInfo = null; this._viewDragInfo = null; }

    handleConstructionClick(world, nearPoint) {
      const selectedId = nearPoint ? nearPoint.id : this.addPoint(world.x, world.y, false);
      if (!selectedId) return;
      if (this.activeTool === 'polygon') { this._pendingPoints.push(selectedId); return this.setStatus(`Polígono: ${this._pendingPoints.length} ptos.`); }
      
      this._pendingPoints.push(selectedId);
      if (this._pendingPoints.length === 2) {
        const [a, b] = this._pendingPoints;
        if (this.activeTool === 'segment') this.scene.objects.push({ id: this.nextId('s'), type: 'segment', p1: a, p2: b, style: { stroke: '#1976d2' } });
        if (this.activeTool === 'line') this.scene.objects.push({ id: this.nextId('r'), type: 'line', p1: a, p2: b, style: { stroke: '#2e7d32' } });
        if (this.activeTool === 'circle') this.scene.objects.push({ id: this.nextId('c'), type: 'circle', center: a, through: b, style: { stroke: '#c62828' } });
        if (this.activeTool === 'midpoint') this.scene.objects.push({ id: this.nextId('M'), type: 'midpoint', p1: a, p2: b, label: 'M', style: { fill: '#2e7d32' } });
        if (this.activeTool === 'measure-distance') this.scene.objects.push({ id: this.nextId('m'), type: 'measure', measureType: 'distance', of: [a, b] });
        this._pendingPoints = []; this.renderAndSync();
      }
    }

    finishPendingPolygon() {
      const unique = [...new Set(this._pendingPoints)];
      if (unique.length >= 3) {
        this.scene.objects.push({ id: this.nextId('poly'), type: 'polygon', points: unique, style: { stroke: '#ea580c', fill: 'rgba(234,88,12,0.18)' } });
        this._pendingPoints = []; this.renderAndSync(); this.setStatus('Polígono creado.');
      }
    }

    addPoint(x, y, sync = true) {
      const id = this.generatePointName();
      this.scene.objects.push({ id, type: 'point', x, y, label: id, draggable: true, style: { fill: '#ea580c' } });
      if (sync) this.renderAndSync();
      return id;
    }

    generatePointName() {
      for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!this.scene.objects.some(o => o.id === char)) return char;
      return this.nextId('P');
    }

    deleteObjectAndDependents(id) {
      const dependents = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const obj of this.scene.objects) {
          if (dependents.has(obj.id)) continue;
          const refs = [obj.p1, obj.p2, obj.center, obj.through, obj.ref, ...(obj.points||[]), ...(obj.of||[])];
          if (refs.some(r => dependents.has(r))) { dependents.add(obj.id); changed = true; }
        }
      }
      this.scene.objects = this.scene.objects.filter(o => !dependents.has(o.id));
      this.renderAndSync();
    }

    findNearestNonPointObjectAtScreen(sx, sy) {
      const resolver = resolveScene(this.scene), vp = this.scene.viewport;
      let best = null, bestD2 = Infinity;
      for (const obj of this.scene.objects) {
        if (['point','midpoint','intersection'].includes(obj.type)) continue;
        const resolved = resolver.resolveObject(obj.id);
        if (!resolved) continue;
        let d2 = Infinity;
        if (resolved.kind === 'segment') d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);
        if (resolved.kind === 'line') d2 = this.p2l(sx, sy, resolved.p1, resolved.p2, vp);
        if (resolved.kind === 'circle') {
          const c = worldToScreen(vp, this._svgWidth, this._svgHeight, resolved.center.x, resolved.center.y);
          const e = worldToScreen(vp, this._svgWidth, this._svgHeight, resolved.center.x + resolved.radius, resolved.center.y);
          const r = Math.abs(e.x - c.x), d = Math.sqrt(dist2(sx, sy, c.x, c.y));
          d2 = (d - r) * (d - r);
        }
        if (d2 < 100 && d2 < bestD2) { best = obj; bestD2 = d2; }
      }
      return best;
    }

    p2s(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this._svgWidth, this._svgHeight, p1.x, p1.y), b = worldToScreen(vp, this._svgWidth, this._svgHeight, p2.x, p2.y);
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      const t = clamp(((sx - a.x) * dx + (sy - a.y) * dy) / len2, 0, 1);
      return dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2l(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this._svgWidth, this._svgHeight, p1.x, p1.y), b = worldToScreen(vp, this._svgWidth, this._svgHeight, p2.x, p2.y);
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      const t = ((sx - a.x) * dx + (sy - a.y) * dy) / len2;
      return dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }
  }

  /* =========================================================
     PARTE 7. VISOR SIMPLE (TAMBIÉN BLINDADO)
     ========================================================= */

  class Geo2DViewer {
    constructor(target, options = {}) {
      this.targetEl = typeof target === 'string' ? document.querySelector(target) : target;
      if (!this.targetEl) throw new Error('No se encontró el contenedor del visor.');

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

      let scene = options.scene || null;
      if (!scene && options.sceneSource) {
        const sourceEl = typeof options.sceneSource === 'string' ? document.querySelector(options.sceneSource) : options.sceneSource;
        if (sourceEl) scene = parseSceneText(sourceEl.textContent);
      }
      this.scene = ensureScene(scene || defaultScene());

      this.root = document.createElement('div');
      this.root.className = 'geo2d-root';
      this.root.innerHTML = `
        <div class="geo2d-toolbar">
          <strong><span class="txt">${String(this.scene.meta.title || '').replace(/</g, '&lt;')}</span></strong>
          <span style="flex:1"></span>
          <div class="geo2d-btn" data-action="copyjson"><span class="txt">Copiar código</span></div>
        </div>
        <div class="geo2d-canvas-wrap" style="min-height:520px"><svg></svg></div>
      `;
      this.shadow.appendChild(this.root);
      this.svg = this.root.querySelector('svg');

      this.root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (btn && btn.dataset.action === 'copyjson') copyTextToClipboard(jsonPretty(this.scene));
      });

      this.bindViewInteractions();
      this.render();
    }

    bindViewInteractions() {
      this.svg.addEventListener('pointerdown', (e) => {
        const rect = this.svg.getBoundingClientRect();
        this._viewDragInfo = { startX: e.clientX - rect.left, startY: e.clientY - rect.top, vp: deepClone(this.scene.viewport) };
        this.svg.setPointerCapture(e.pointerId);
      });
      this.svg.addEventListener('pointermove', (e) => {
        if (!this._viewDragInfo) return;
        const rect = this.svg.getBoundingClientRect();
        const start = screenToWorld(this._viewDragInfo.vp, this._svgWidth || rect.width, this._svgHeight || rect.height, this._viewDragInfo.startX, this._viewDragInfo.startY);
        const curr = screenToWorld(this._viewDragInfo.vp, this._svgWidth || rect.width, this._svgHeight || rect.height, e.clientX - rect.left, e.clientY - rect.top);
        this.scene.viewport = viewportPan(this._viewDragInfo.vp, start.x - curr.x, start.y - curr.y);
        this.render();
      });
      window.addEventListener('pointerup', () => this._viewDragInfo = null);
      this.svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = this.svg.getBoundingClientRect(), p = screenToWorld(this.scene.viewport, this._svgWidth || r.width, this._svgHeight || r.height, e.clientX - r.left, e.clientY - r.top);
        this.scene.viewport = viewportZoom(this.scene.viewport, e.deltaY < 0 ? 0.9 : 1.1, p.x, p.y);
        this.render();
      }, { passive: false });
    }
    render() { renderSceneToSvg(this.svg, this.scene, this); }
  }

  /* =========================================================
     PARTE 8. EXPORTAR OBJETO GLOBAL Y AUTO-INIT
     ========================================================= */

  window.Geo2D = {
    openEditor(options = {}) { return new Geo2DEditor(options.target || options.container || '#geo2d-editor', { ...options, mode: 'editor' }); },
    openViewer(options = {}) { return new Geo2DViewer(options.target || options.container || '#geo2d-viewer', { ...options, mode: 'viewer' }); },
    parseSceneText, ensureScene, defaultScene,
    publishScene(scene, id = 'geo2d-' + Math.random().toString(36).slice(2, 8)) {
      return `<div class="geo2d-viewer" id="${id}"></div><script type="application/json" id="${id}-data">${jsonPretty(ensureScene(scene))}</script><script>window.Geo2D && Geo2D.openViewer({ target: "#${id}", sceneSource: "#${id}-data" });</script>`;
    }
  };

  function autoInit() {
    document.querySelectorAll('[data-geo2d-editor]').forEach(el => {
      if (el.__geo2dMounted) return; el.__geo2dMounted = true;
      let scene = null;
      try { const raw = el.getAttribute('data-scene'); if (raw) scene = parseSceneText(raw); } catch (_) {}
      Geo2D.openEditor({ target: el, scene: scene || defaultScene() });
    });
    document.querySelectorAll('[data-geo2d-viewer]').forEach(el => {
      if (el.__geo2dMounted) return; el.__geo2dMounted = true;
      let scene = null;
      try {
        const sourceSel = el.getAttribute('data-scene-source'), raw = el.getAttribute('data-scene');
        if (sourceSel) scene = parseSceneText(document.querySelector(sourceSel)?.textContent);
        else if (raw) scene = parseSceneText(raw);
      } catch (_) {}
      Geo2D.openViewer({ target: el, scene: scene || defaultScene() });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit);
  else autoInit();

})();
