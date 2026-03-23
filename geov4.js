/* =========================================================
   GEO2D EDITOR V2 (CONEXIÓN DINÁMICA Y SNAP INTELIGENTE)
   ========================================================= */
(function () {
  'use strict';

  // --- Utilidades ---
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
  function dist(x1, y1, x2, y2) { return Math.sqrt(dist2(x1, y1, x2, y2)); }
  function safeNumber(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function slugify(text) { return String(text || 'escena').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'escena'; }

  function downloadTextFile(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return Promise.resolve();
  }

  // --- Lógica de Escena ---
  function ensureScene(scene) {
    const base = {
      version: 1, meta: { title: 'Nueva Escena' },
      viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10, showGrid: true, showAxes: true },
      style: { pointRadius: 5, strokeWidth: 2, fontSize: 14 }, objects: []
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
    if (!raw) throw new Error('Contenido vacío');
    const dataMatch = raw.match(/data-scene='([\s\S]*?)'/i) || raw.match(/data-scene="([\s\S]*?)"/i);
    if (dataMatch) raw = dataMatch[1].trim().replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    return ensureScene(JSON.parse(raw));
  }

  // --- Renderizado y Proyección ---
  function worldToScreen(vp, w, h, x, y) { 
    return { x: (x - vp.xMin) / (vp.xMax - vp.xMin) * w, y: h - (y - vp.yMin) / (vp.yMax - vp.yMin) * h }; 
  }
  function screenToWorld(vp, w, h, sx, sy) { 
    return { x: vp.xMin + (sx / w) * (vp.xMax - vp.xMin), y: vp.yMin + ((h - sy) / h) * (vp.yMax - vp.yMin) }; 
  }

  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
    return el;
  }

  function resolveScene(scene) {
    const map = new Map();
    scene.objects.forEach(obj => map.set(obj.id, obj));
    const cache = new Map();

    function resolveObject(id) {
      if (cache.has(id)) return cache.get(id);
      const obj = map.get(id); if (!obj) return null;
      let res = null;
      switch (obj.type) {
        case 'point': res = { kind: 'point', x: safeNumber(obj.x), y: safeNumber(obj.y), source: obj }; break;
        case 'midpoint': {
          const p1 = resolveObject(obj.p1), p2 = resolveObject(obj.p2);
          if (p1?.kind === 'point' && p2?.kind === 'point') res = { kind: 'point', x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, source: obj };
          break;
        }
        case 'segment': {
          const p1 = resolveObject(obj.p1), p2 = resolveObject(obj.p2);
          if (p1?.kind === 'point' && p2?.kind === 'point') res = { kind: 'segment', p1, p2, source: obj };
          break;
        }
        case 'circle': {
          const c = resolveObject(obj.center), t = resolveObject(obj.through);
          if (c?.kind === 'point' && t?.kind === 'point') res = { kind: 'circle', center: c, radius: dist(c.x, c.y, t.x, t.y), source: obj };
          break;
        }
        case 'line': {
          const p1 = resolveObject(obj.p1), p2 = resolveObject(obj.p2);
          if (p1?.kind === 'point' && p2?.kind === 'point') res = { kind: 'line', p1, p2, source: obj };
          break;
        }
        case 'polygon': {
          const pts = (obj.points || []).map(id => resolveObject(id)).filter(r => r?.kind === 'point');
          if (pts.length >= 2) res = { kind: 'polygon', points: pts, source: obj };
          break;
        }
        case 'measure': {
          const p1 = resolveObject(obj.of?.[0]), p2 = resolveObject(obj.of?.[1]);
          if (p1?.kind === 'point' && p2?.kind === 'point') res = { kind: 'measure', p1, p2, source: obj };
          break;
        }
      }
      cache.set(id, res); return res;
    }
    return { resolveObject, all: () => scene.objects.map(o => ({ obj: o, res: resolveObject(o.id) })) };
  }

  // --- Componente Principal ---
  class Geo2DEditor {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      this.scene = ensureScene(options.scene);
      this.activeTool = 'move';
      this.activeTab = 'visual';
      this._pendingIds = [];
      this._hoveredId = null;
      this._dragInfo = null;
      this._viewDrag = null;

      this.initLayout();
      this.bindEvents();
      this.render();
    }

    initLayout() {
      if (this.container.__geoShadow) this.shadow = this.container.__geoShadow;
      else this.shadow = this.container.attachShadow({ mode: 'open' });
      this.shadow.innerHTML = `
        <style>
          :host { display: block; font-family: system-ui, -apple-system, sans-serif; border: 1px solid #d1d5db; border-radius: 12px; overflow: hidden; background: #fff; user-select: none; }
          .toolbar { display: flex; gap: 8px; padding: 10px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
          .main-area { display: grid; grid-template-columns: 200px 1fr; height: 600px; }
          .sidebar { background: #f3f4f6; border-right: 1px solid #e5e7eb; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
          .canvas-container { position: relative; overflow: hidden; background: #fff; cursor: crosshair; }
          svg { width: 100%; height: 100%; display: block; touch-action: none; }
          .btn { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; font-weight: 500; }
          .btn:hover { background: #f9fafb; }
          .btn.active { background: #ea580c; color: #fff; border-color: #ea580c; }
          .status { padding: 6px 12px; font-size: 12px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
          .hidden { display: none; }
          .json-panel { width: 100%; height: 100%; box-sizing: border-box; border: none; padding: 15px; font-family: monospace; resize: none; outline: none; }
        </style>
        <div class="toolbar">
          <button class="btn" data-action="new">Nuevo</button>
          <button class="btn" data-action="copy">Copiar JSON</button>
          <button class="btn" data-action="load">Cargar</button>
          <span style="flex:1"></span>
          <div style="display:flex; gap:4px">
            <button class="btn" data-tab="visual">Visual</button>
            <button class="btn" data-tab="json">JSON</button>
          </div>
        </div>
        <div class="main-area">
          <div class="sidebar">
            <div style="font-size:11px; color:#6b7280; margin-bottom:4px; font-weight:bold;">HERRAMIENTAS</div>
            <button class="btn" data-tool="move">Mover / Vista</button>
            <button class="btn" data-tool="point">Punto</button>
            <button class="btn" data-tool="segment">Segmento</button>
            <button class="btn" data-tool="circle">Circunferencia</button>
            <button class="btn" data-tool="line">Recta</button>
            <button class="btn" data-tool="polygon">Polígono</button>
            <button class="btn" data-tool="midpoint">Punto Medio</button>
            <button class="btn" data-tool="delete">Borrar</button>
          </div>
          <div class="canvas-container">
            <svg id="geo-svg"></svg>
            <textarea class="json-panel hidden" spellcheck="false"></textarea>
          </div>
        </div>
        <div class="status">Listo</div>
      `;
      this.svg = this.shadow.querySelector('#geo-svg');
      this.status = this.shadow.querySelector('.status');
      this.jsonArea = this.shadow.querySelector('.json-panel');
    }

    bindEvents() {
      this.shadow.addEventListener('click', e => {
        const tool = e.target.closest('[data-tool]')?.dataset.tool;
        const action = e.target.closest('[data-action]')?.dataset.action;
        const tab = e.target.closest('[data-tab]')?.dataset.tab;

        if (tool) { this.activeTool = tool; this._pendingIds = []; this.updateUI(); }
        if (tab) { 
          this.activeTab = tab; 
          if (tab === 'json') {
            this.jsonArea.value = JSON.stringify(this.scene, null, 2);
            this.jsonArea.classList.remove('hidden');
          } else {
            try { this.scene = ensureScene(JSON.parse(this.jsonArea.value)); } catch(e){}
            this.jsonArea.classList.add('hidden');
          }
          this.render(); this.updateUI(); 
        }
        if (action === 'new') { this.scene = ensureScene(); this.render(); }
        if (action === 'copy') { copyTextToClipboard(JSON.stringify(this.scene, null, 2)); this.log('Copiado al portapapeles'); }
      });

      this.svg.addEventListener('pointerdown', e => this.onDown(e));
      this.svg.addEventListener('pointermove', e => this.onMove(e));
      window.addEventListener('pointerup', () => this.onUp());
      this.svg.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.1 : 0.9;
        const m = this.getMouse(e);
        const vp = this.scene.viewport;
        this.scene.viewport = {
          ...vp,
          xMin: m.x + (vp.xMin - m.x) * factor, xMax: m.x + (vp.xMax - m.x) * factor,
          yMin: m.y + (vp.yMin - m.y) * factor, yMax: m.y + (vp.yMax - m.y) * factor
        };
        this.render();
      }, { passive: false });
    }

    getMouse(e) {
      const r = this.svg.getBoundingClientRect();
      return screenToWorld(this.scene.viewport, r.width, r.height, e.clientX - r.left, e.clientY - r.top);
    }

    log(msg) { this.status.textContent = msg; }

    updateUI() {
      this.shadow.querySelectorAll('.btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === this.activeTool));
      this.shadow.querySelectorAll('.btn[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === this.activeTab));
    }

    // --- Lógica de Interacción Mejorada ---
    onDown(e) {
      if (this.activeTab === 'json') return;
      const m = this.getMouse(e);
      const hitId = this.findNearPoint(e);

      if (this.activeTool === 'move') {
        if (hitId && this.scene.objects.find(o => o.id === hitId && o.type === 'point')) {
          this._dragInfo = { id: hitId };
        } else {
          const r = this.svg.getBoundingClientRect();
          this._viewDrag = { x: e.clientX, y: e.clientY, vp: deepClone(this.scene.viewport) };
        }
        return;
      }

      if (this.activeTool === 'delete') {
        if (hitId) {
          this.scene.objects = this.scene.objects.filter(o => o.id !== hitId && o.p1 !== hitId && o.p2 !== hitId && o.center !== hitId && o.through !== hitId && !(o.points || []).includes(hitId));
          this.render();
        }
        return;
      }

      // Herramientas de construcción: Snapping automático
      const id = hitId || this.addPoint(m.x, m.y);
      this._pendingIds.push(id);
      this.log(`Seleccionado: ${this._pendingIds.join(' -> ')}`);

      this.processConstruction();
      this.render();
    }

    processConstruction() {
      const p = this._pendingIds;
      const tool = this.activeTool;
      let newObj = null;

      if (tool === 'point' && p.length === 1) { this._pendingIds = []; return; }
      if (p.length < 2) return;

      if (tool === 'segment') newObj = { type: 'segment', p1: p[0], p2: p[1], style: { stroke: '#2563eb' } };
      if (tool === 'line') newObj = { type: 'line', p1: p[0], p2: p[1], style: { stroke: '#059669' } };
      if (tool === 'circle') newObj = { type: 'circle', center: p[0], through: p[1], style: { stroke: '#dc2626' } };
      if (tool === 'midpoint') newObj = { type: 'midpoint', p1: p[0], p2: p[1], label: 'M', style: { fill: '#7c3aed' } };
      if (tool === 'polygon' && p[p.length - 1] === p[0] && p.length > 3) {
         newObj = { type: 'polygon', points: p.slice(0, -1), style: { fill: 'rgba(234,88,12,0.2)', stroke: '#ea580c' } };
      }

      if (newObj) {
        newObj.id = tool.substring(0, 2) + Math.random().toString(36).slice(2, 5);
        this.scene.objects.push(newObj);
        this._pendingIds = [];
        this.log('Objeto creado.');
      }
    }

    onMove(e) {
      const m = this.getMouse(e);
      
      // Feedback visual de Hover (Snapping)
      const near = this.findNearPoint(e);
      if (this._hoveredId !== near) {
        this._hoveredId = near;
        this.render();
      }

      if (this._dragInfo) {
        const obj = this.scene.objects.find(o => o.id === this._dragInfo.id);
        if (obj) { obj.x = m.x; obj.y = m.y; this.render(); }
      } else if (this._viewDrag) {
        const r = this.svg.getBoundingClientRect();
        const dx = (e.clientX - this._viewDrag.x) * (this._viewDrag.vp.xMax - this._viewDrag.vp.xMin) / r.width;
        const dy = (e.clientY - this._viewDrag.y) * (this._viewDrag.vp.yMax - this._viewDrag.vp.yMin) / r.height;
        this.scene.viewport.xMin = this._viewDrag.vp.xMin - dx;
        this.scene.viewport.xMax = this._viewDrag.vp.xMax - dx;
        this.scene.viewport.yMin = this._viewDrag.vp.yMin + dy;
        this.scene.viewport.yMax = this._viewDrag.vp.yMax + dy;
        this.render();
      }
    }

    onUp() { this._dragInfo = null; this._viewDrag = null; }

    findNearPoint(e) {
      const r = this.svg.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const resolver = resolveScene(this.scene);
      let bestId = null, minDist = 15; // Radio de captura en pixeles

      resolver.all().forEach(({ obj, res }) => {
        if (res?.kind === 'point') {
          const screen = worldToScreen(this.scene.viewport, r.width, r.height, res.x, res.y);
          const d = dist(sx, sy, screen.x, screen.y);
          if (d < minDist) { minDist = d; bestId = obj.id; }
        }
      });
      return bestId;
    }

    addPoint(x, y) {
      const id = this.nextPointName();
      this.scene.objects.push({ id, type: 'point', x, y, label: id, style: { fill: '#ea580c' } });
      return id;
    }

    nextPointName() {
      const used = new Set(this.scene.objects.map(o => o.id));
      for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!used.has(char)) return char;
      return "P" + Math.floor(Math.random() * 999);
    }

    // --- Renderizado Core ---
    render() {
      const r = this.svg.getBoundingClientRect();
      const w = r.width || 800, h = r.height || 600;
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.svg.innerHTML = '';

      const vp = this.scene.viewport;
      const res = resolveScene(this.scene);

      // 1. Grid
      if (vp.showGrid) {
        const step = 1;
        for (let x = Math.ceil(vp.xMin); x <= vp.xMax; x += step) {
          const s = worldToScreen(vp, w, h, x, 0);
          this.svg.appendChild(createSvgEl('line', { x1: s.x, y1: 0, x2: s.x, y2: h, stroke: '#f3f4f6' }));
        }
        for (let y = Math.ceil(vp.yMin); y <= vp.yMax; y += step) {
          const s = worldToScreen(vp, w, h, 0, y);
          this.svg.appendChild(createSvgEl('line', { x1: 0, y1: s.y, x2: w, y2: s.y, stroke: '#f3f4f6' }));
        }
      }

      // 2. Objetos
      res.all().forEach(({ obj, res }) => {
        if (!res) return;
        const st = { stroke: '#374151', strokeWidth: 2, fill: 'none', ...obj.style };
        
        if (res.kind === 'segment' || res.kind === 'line') {
          let p1 = worldToScreen(vp, w, h, res.p1.x, res.p1.y);
          let p2 = worldToScreen(vp, w, h, res.p2.x, res.p2.y);
          if (res.kind === 'line') { // Extender linea
            const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.sqrt(dx*dx + dy*dy);
            p1 = { x: p1.x - dx/len*2000, y: p1.y - dy/len*2000 };
            p2 = { x: p2.x + dx/len*2000, y: p2.y + dy/len*2000 };
          }
          this.svg.appendChild(createSvgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: st.stroke, 'stroke-width': st.strokeWidth }));
        }

        if (res.kind === 'circle') {
          const c = worldToScreen(vp, w, h, res.center.x, res.center.y);
          const rPx = res.radius * w / (vp.xMax - vp.xMin);
          this.svg.appendChild(createSvgEl('circle', { cx: c.x, cy: c.y, r: Math.abs(rPx), stroke: st.stroke, 'stroke-width': st.strokeWidth, fill: st.fill }));
        }

        if (res.kind === 'polygon') {
          const points = res.points.map(p => {
            const s = worldToScreen(vp, w, h, p.x, p.y);
            return `${s.x},${s.y}`;
          }).join(' ');
          this.svg.appendChild(createSvgEl('polygon', { points, fill: st.fill, stroke: st.stroke, 'stroke-width': st.strokeWidth }));
        }
      });

      // 3. Puntos (Encima de todo)
      res.all().forEach(({ obj, res }) => {
        if (res?.kind === 'point') {
          const s = worldToScreen(vp, w, h, res.x, res.y);
          const isHover = obj.id === this._hoveredId || this._pendingIds.includes(obj.id);
          const circle = createSvgEl('circle', {
            cx: s.x, cy: s.y, r: isHover ? 7 : 5,
            fill: isHover ? '#000' : (obj.style?.fill || '#ea580c'),
            stroke: '#fff', 'stroke-width': 2
          });
          this.svg.appendChild(circle);
          if (obj.label) {
            const txt = createSvgEl('text', { x: s.x + 8, y: s.y - 8, 'font-size': '12', 'font-weight': 'bold' });
            txt.textContent = obj.label;
            this.svg.appendChild(txt);
          }
        }
      });
    }
  }

  window.Geo2D = { openEditor: (target, opt) => new Geo2DEditor(target, opt) };

  // Auto-montar
  document.querySelectorAll('[data-geo2d-editor]').forEach(el => Geo2D.openEditor(el));
})();
