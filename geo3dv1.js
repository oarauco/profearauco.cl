(function (window, document) {
  'use strict';

  const VERSION = '0.4.3';
  const STYLE_ELEMENT_ID = 'geo3d-runtime-styles';
  const MOUNTED = new WeakMap();
  const DEFAULT_POINT_SIZE = 0.15;
  const POINT_ALPHABET = Object.freeze('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  const TYPE_LABELS = Object.freeze({
    ortoedro: 'Ortoedro',
    squarePyramid: 'Piramide cuadrada',
    cylinder: 'Cilindro',
    cone: 'Cono',
    sphere: 'Esfera',
    point: 'Punto',
    vector: 'Vector',
    plane: 'Plano',
    segment: 'Arista',
    polygon: 'Cara'
  });
  const DEFAULT_COLORS = Object.freeze({
    ortoedro: '#f59e0b',
    squarePyramid: '#f97316',
    cylinder: '#0284c7',
    cone: '#7c3aed',
    sphere: '#16a34a',
    point: '#dc2626',
    vector: '#0891b2',
    plane: '#94a3b8'
  });

  const EDITOR_TOOL_GROUPS = Object.freeze([
    Object.freeze({
      id: 'solids',
      label: 'Solidos',
      items: Object.freeze([
        Object.freeze({ id: 'ortoedro', label: 'Ortoedro' }),
        Object.freeze({ id: 'squarePyramid', label: 'Piramide' }),
        Object.freeze({ id: 'cylinder', label: 'Cilindro' }),
        Object.freeze({ id: 'cone', label: 'Cono' }),
        Object.freeze({ id: 'sphere', label: 'Esfera' })
      ])
    }),
    Object.freeze({
      id: 'elements',
      label: 'Elementos',
      items: Object.freeze([
        Object.freeze({ id: 'point', label: 'Punto Libre' }),
        Object.freeze({ id: 'vector', label: 'Vector' }),
        Object.freeze({ id: 'plane', label: 'Plano XY' })
      ])
    }),
    Object.freeze({
      id: 'actions',
      label: 'Acciones',
      items: Object.freeze([
        Object.freeze({ id: 'duplicate-selected', label: 'Duplicar' }),
        Object.freeze({ id: 'delete-selected', label: 'Eliminar' }),
        Object.freeze({ id: 'center-view', label: 'Recentrar Vista' })
      ])
    })
  ]);

  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
  function safeNumber(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function normalizeText(value, fallback) { return String(value == null ? '' : value).trim() || fallback; }
  
  function normalizeId(value, fallback) { return normalizeText(value, fallback).replace(/\s+/g, '_'); }
  function normalizeColor(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? value : fallback; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function formatNumber(value, digits) { return !Number.isFinite(value) ? '-' : String(Number(value.toFixed(digits == null ? 2 : digits))); }
  function normalizeVec3(value, fallback) {
    const base = value && typeof value === 'object' ? value : {}; const d = fallback || { x: 0, y: 0, z: 0 };
    return { x: safeNumber(base.x, d.x), y: safeNumber(base.y, d.y), z: safeNumber(base.z, d.z) };
  }

  function createUniqueObjectId(baseType, usedIds) {
    let candidateBase = TYPE_LABELS[baseType] ? TYPE_LABELS[baseType].split(' ')[0] : 'Obj';
    if (!usedIds.has(candidateBase)) { usedIds.add(candidateBase); return candidateBase; }
    let suffix = 1;
    while (usedIds.has(candidateBase + '_' + suffix)) suffix++;
    const finalId = candidateBase + '_' + suffix;
    usedIds.add(finalId);
    return finalId;
  }

  function pickNextFreePointId(usedIds) {
    for (let i = 0; i < POINT_ALPHABET.length; i++) {
      if (!usedIds.has(POINT_ALPHABET[i])) return POINT_ALPHABET[i];
    }
    let s = 1;
    while (usedIds.has('P_' + s)) s++;
    return 'P_' + s;
  }

  function reserveUniquePointId(preferredId, usedIds) {
    let candidate = normalizeId(preferredId, '');
    if (!candidate || usedIds.has(candidate)) candidate = pickNextFreePointId(usedIds);
    usedIds.add(candidate);
    return candidate;
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (err) {
        console.warn('Geo3D: Fallo al usar la API del portapapeles, usando método de respaldo.', err);
      }
    }
    // Respaldo para navegadores antiguos o falta de permisos HTTPs
    const area = document.createElement('textarea'); area.value = text; 
    area.style.position = 'fixed'; area.style.opacity = '0'; // Hacerlo invisible
    document.body.appendChild(area); area.select(); 
    try { document.execCommand('copy'); } catch(e) {} 
    area.remove();
  }

  function matCoordsToThree(x, y, z) { return new window.THREE.Vector3(safeNumber(y, 0), safeNumber(z, 0), safeNumber(x, 0)); }
  function matVecToThree(vector) { return matCoordsToThree(vector.x, vector.y, vector.z); }
  function threeVecToMat(vector) { return { x: safeNumber(vector.z, 0), y: safeNumber(vector.x, 0), z: safeNumber(vector.y, 0) }; }

  function createSceneShell(options) {
    const raw = options && typeof options === 'object' ? options : {};
    const viewRaw = raw.view && typeof raw.view === 'object' ? raw.view : {};
    return {
      title: normalizeText(raw.title, 'Editor Geo3D Semantico'),
      view: { grid: viewRaw.grid !== false, axes: viewRaw.axes !== false, labels: viewRaw.labels !== false, background: normalizeColor(viewRaw.background, '#f3f4f6') },
      objects:[]
    };
  }

  function normalizeObject(raw, usedIds) {
    if (!raw || typeof raw !== 'object') return null;
    const type = String(raw.type || '').trim();
    if (!TYPE_LABELS[type]) return null;

    let finalId = raw.id;
    if (!raw.derived) {
      if (type === 'point') finalId = reserveUniquePointId(raw.id, usedIds);
      else {
        if (raw.id && !usedIds.has(raw.id)) { finalId = raw.id; usedIds.add(finalId); }
        else finalId = createUniqueObjectId(type, usedIds);
      }
    }

    const base = {
      id: finalId, type: type, 
      label: raw.derived ? normalizeText(raw.label, finalId) : finalId,
      labelFormat: raw.labelFormat || 'name',
      visible: raw.visible !== false, color: normalizeColor(raw.color, DEFAULT_COLORS[type] || '#333333'),
      opacity: clamp(safeNumber(raw.opacity, type === 'plane' ? 0.18 : (type === 'polygon' ? 0.5 : 0.86)), 0.05, 1),
      showLabel: raw.showLabel !== false, derived: !!raw.derived, parentId: raw.parentId || null
    };

    if (raw.anchor) base.anchor = String(raw.anchor);
    if (raw.start) base.start = String(raw.start);
    if (raw.end) base.end = String(raw.end);

    if (type === 'ortoedro') return Object.assign(base, { position: normalizeVec3(raw.position || raw.center), width: Math.max(0.2, safeNumber(raw.width, 4)), length: Math.max(0.2, safeNumber(raw.length, 3)), height: Math.max(0.2, safeNumber(raw.height, 2.5)), showPoints: raw.showPoints !== false, showEdges: raw.showEdges !== false, showFaces: raw.showFaces !== false });
    if (type === 'squarePyramid') return Object.assign(base, { position: normalizeVec3(raw.position || raw.center), size: Math.max(0.2, safeNumber(raw.size, 4)), height: Math.max(0.2, safeNumber(raw.height, 4)), showPoints: raw.showPoints !== false, showEdges: raw.showEdges !== false, showFaces: raw.showFaces !== false });
    if (type === 'cylinder' || type === 'cone') return Object.assign(base, { position: normalizeVec3(raw.position || raw.center), radius: Math.max(0.1, safeNumber(raw.radius, 1.5)), height: Math.max(0.2, safeNumber(raw.height, 3)), radialSegments: clamp(Math.round(safeNumber(raw.radialSegments, 32)), 8, 128) });
    if (type === 'sphere') return Object.assign(base, { position: normalizeVec3(raw.position || raw.center, {x:0,y:0,z:1.5}), radius: Math.max(0.1, safeNumber(raw.radius, 1.6)) });
    if (type === 'point') return Object.assign(base, { position: normalizeVec3(raw.position), size: clamp(safeNumber(raw.size, DEFAULT_POINT_SIZE), 0.01, 0.8) });
    if (type === 'vector') return Object.assign(base, { origin: normalizeVec3(raw.origin), dx: safeNumber(raw.dx, 2), dy: safeNumber(raw.dy, 2), dz: safeNumber(raw.dz, 2) });
    if (type === 'plane') return Object.assign(base, { position: normalizeVec3(raw.position || raw.center), plane: String(raw.plane || 'xy').trim().toLowerCase(), width: Math.max(0.2, safeNumber(raw.width, 10)), height: Math.max(0.2, safeNumber(raw.height, 10)) });
    if (type === 'segment') return Object.assign(base, { startPos: normalizeVec3(raw.startPos), endPos: normalizeVec3(raw.endPos) });
    if (type === 'polygon') return Object.assign(base, { vertices: Array.isArray(raw.vertices) ? raw.vertices.map(function(v) { return normalizeVec3(v); }) :[] });
    return null;
  }

  function normalizeScene(raw) {
    const scene = createSceneShell(raw);
    const objectsRaw = Array.isArray(raw && raw.objects) ? raw.objects :[];
    const usedIds = new Set();
    objectsRaw.forEach(function(object) {
      const normalized = normalizeObject(object, usedIds);
      if (normalized) scene.objects.push(normalized);
    });
    return scene;
  }

  function exportScene(scene) { return deepClone(scene); }
  function createEmptyScene(options) { return normalizeScene(createSceneShell(options)); }
  function objectTypeLabel(type) { return TYPE_LABELS[typeof type === 'object' ? type.type : type] || type; }

  // UTILIDADES MATEMÁTICAS (Área Polígonos 3D)
  function calculatePolygonArea(vertices) {
    if (!vertices || vertices.length < 3) return 0;
    let area = 0;
    // Usamos el teorema de Stokes (producto cruz) para calcular el área de un polígono 3D no coplanar perfecto
    for (let i = 0; i < vertices.length; i++) {
      let v1 = vertices[i];
      let v2 = vertices[(i + 1) % vertices.length];
      area += (v1.x * v2.y - v2.x * v1.y) + (v1.y * v2.z - v2.y * v1.z) + (v1.z * v2.x - v2.z * v1.x);
    }
    return Math.abs(area / 2.0);
  }

  function getPolygonCenter(vertices) {
    if (!vertices || vertices.length === 0) return {x:0, y:0, z:0};
    let sum = {x:0, y:0, z:0};
    vertices.forEach(function(v) { sum.x += v.x; sum.y += v.y; sum.z += v.z; });
    return { x: sum.x / vertices.length, y: sum.y / vertices.length, z: sum.z / vertices.length };
  }


  function resolveDependencies(scene) {
    const computed = new Map(), results =[], overrides = new Map();
    scene.objects.forEach(function(o) { if (o.derived) overrides.set(o.id, o); });
    const globalUsedIds = new Set();
    scene.objects.forEach(function(o) { if (!o.derived && (o.type === 'point' || o.label)) globalUsedIds.add(o.label || o.id); });

    scene.objects.filter(function(o) { return o.type === 'point' && !o.derived; }).forEach(function(p) {
      const comp = deepClone(p); comp.absPosition = normalizeVec3(p.position);
      computed.set(p.id, comp); results.push(comp);
    });

    function getAnchorPos(obj) { return (obj.anchor && computed.has(obj.anchor)) ? Object.assign({}, computed.get(obj.anchor).absPosition) : normalizeVec3(obj.position); }

    scene.objects.filter(function(o) { return o.type !== 'point' && !o.derived; }).forEach(function(obj) {
      const comp = deepClone(obj);
      if (obj.type === 'vector') {
        let absStart = normalizeVec3(obj.origin);
        if (obj.start && computed.has(obj.start)) absStart = Object.assign({}, computed.get(obj.start).absPosition);
        else if (obj.anchor && computed.has(obj.anchor)) absStart = Object.assign({}, computed.get(obj.anchor).absPosition);
        
        let absEnd = { x: absStart.x + obj.dx, y: absStart.y + obj.dy, z: absStart.z + obj.dz };
        if (obj.end && computed.has(obj.end)) {
          absEnd = Object.assign({}, computed.get(obj.end).absPosition);
          comp.dx = absEnd.x - absStart.x; comp.dy = absEnd.y - absStart.y; comp.dz = absEnd.z - absStart.z;
        }
        comp.absStart = absStart; comp.absEnd = absEnd;
        computed.set(comp.id, comp); results.push(comp);
      } else {
        comp.absPosition = getAnchorPos(obj);
        computed.set(comp.id, comp); results.push(comp);
        generateSubElements(comp, globalUsedIds).forEach(function(sub) {
          const merged = Object.assign({}, sub, overrides.get(sub.id) || {});
          
          // PROPAGACIÓN DE ETIQUETA HACIA ABAJO (Los vértices heredan el tipo de etiqueta de su padre)
          if (comp.labelFormat && (sub.type === 'point' || sub.type === 'polygon')) {
             if (!overrides.get(sub.id) || !overrides.get(sub.id).labelFormat) {
                merged.labelFormat = comp.labelFormat; 
             }
          }

          computed.set(merged.id, merged); results.push(merged);
        });
      }
    });
    return results;
  }

  function generateSubElements(comp, globalUsedIds) {
    const subs =[], p = comp.absPosition;
    let baseFaceOpacity = (comp.opacity === 1) ? 0.5 : comp.opacity * 0.8;

    if (comp.type === 'ortoedro') {
      const w = comp.width, l = comp.length, h = comp.height;
      const v =[{x:p.x, y:p.y, z:p.z},{x:p.x+w, y:p.y, z:p.z},{x:p.x+w, y:p.y+l, z:p.z},{x:p.x, y:p.y+l, z:p.z},{x:p.x, y:p.y, z:p.z+h},{x:p.x+w, y:p.y, z:p.z+h},{x:p.x+w, y:p.y+l, z:p.z+h},{x:p.x, y:p.y+l, z:p.z+h}];
      const names = [];
      for(let i=0; i<8; i++) names.push(reserveUniquePointId('', globalUsedIds));
      
      for(let i=0; i<names.length; i++) subs.push({ id: comp.id + '_V_' + i, type: 'point', derived: true, parentId: comp.id, absPosition: v[i], label: names[i], labelFormat: comp.labelFormat, visible: comp.showPoints, color: comp.color, size: DEFAULT_POINT_SIZE });
      const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
      for(let i=0; i<edges.length; i++) subs.push({ id: comp.id + '_A_' + i, type: 'segment', derived: true, parentId: comp.id, startPos: v[edges[i][0]], endPos: v[edges[i][1]], label: 'Arista ' + names[edges[i][0]] + names[edges[i][1]], visible: comp.showEdges, color: '#334155' });
      const faces = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
      const faceNames =['Base','Tope','Frontal','Derecha','Trasera','Izquierda'];
      for(let i=0; i<faces.length; i++) subs.push({ id: comp.id + '_C_' + i, type: 'polygon', derived: true, parentId: comp.id, vertices: faces[i].map(function(idx){ return v[idx]; }), label: 'Cara ' + faceNames[i], visible: comp.showFaces, showLabel: false, color: comp.color, opacity: baseFaceOpacity });
    } else if (comp.type === 'squarePyramid') {
      const s = comp.size, h = comp.height;
      const v =[{x:p.x-s/2, y:p.y-s/2, z:p.z},{x:p.x+s/2, y:p.y-s/2, z:p.z},{x:p.x+s/2, y:p.y+s/2, z:p.z},{x:p.x-s/2, y:p.y+s/2, z:p.z},{x:p.x, y:p.y, z:p.z+h}];
      const names = [];
      for(let i=0; i<5; i++) names.push(reserveUniquePointId('', globalUsedIds));

      for(let i=0; i<names.length; i++) subs.push({ id: comp.id + '_V_' + i, type: 'point', derived: true, parentId: comp.id, absPosition: v[i], label: names[i], labelFormat: comp.labelFormat, visible: comp.showPoints, color: comp.color, size: DEFAULT_POINT_SIZE });
      const edges = [[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]];
      for(let i=0; i<edges.length; i++) subs.push({ id: comp.id + '_A_' + i, type: 'segment', derived: true, parentId: comp.id, startPos: v[edges[i][0]], endPos: v[edges[i][1]], label: 'Arista ' + names[edges[i][0]] + names[edges[i][1]], visible: comp.showEdges, color: '#334155' });
      const faces = [[3,2,1,0],[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
      const faceNames =['Base','Frontal','Derecha','Trasera','Izquierda'];
      for(let i=0; i<faces.length; i++) subs.push({ id: comp.id + '_C_' + i, type: 'polygon', derived: true, parentId: comp.id, vertices: faces[i].map(function(idx){ return v[idx]; }), label: 'Cara ' + faceNames[i], visible: comp.showFaces, showLabel: false, color: comp.color, opacity: baseFaceOpacity });
    }
    return subs;
  }

  function createPolygonGeometry(vertices) {
    const geom = new window.THREE.BufferGeometry();
    const pts = vertices.map(function(v){ return matVecToThree(v); });
    const indices =[];
    for (let i = 1; i < pts.length - 1; i++) indices.push(0, i, i + 1);
    geom.setFromPoints(pts); geom.setIndex(indices); geom.computeVertexNormals();
    return geom;
  }

  function buildEditorToolMenuHtml() {
    return EDITOR_TOOL_GROUPS.map(function(g) {
      let itemsHtml = g.items.map(function(t) { return `<button type="button" class="geo3d-toolbtn" data-tool="${t.id}">${escapeHtml(t.label)}</button>`; }).join('');
      return `<div class="geo3d-toolgroup"><div class="geo3d-toolgroup-head"><strong>${escapeHtml(g.label)}</strong></div><div class="geo3d-toolgroup-items">${itemsHtml}</div></div>`;
    }).join('');
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ELEMENT_ID)) return;
    const style = document.createElement('style'); style.id = STYLE_ELEMENT_ID;
    
    style.textContent = `
.geo3d-root { box-sizing: border-box; color: #0f172a; font-family: "Trebuchet MS", sans-serif; background: #f8fafc; border: 1px solid #d7deea; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; width: 100%; height: 100vh; min-height: 600px; }
.geo3d-root:fullscreen { border: none; border-radius: 0; width: 100vw; height: 100vh; max-height: none; }
.geo3d-root:-webkit-full-screen { border: none; border-radius: 0; width: 100vw; height: 100vh; max-height: none; }
.geo3d-root * { box-sizing: border-box; }
.geo3d-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px 14px; background: linear-gradient(180deg, #ffffff, #f8fafc); border-bottom: 1px solid #d7deea; flex-shrink: 0; }
.geo3d-btn, .geo3d-toolbtn { border: 1px solid #cfd8e3; background: #ffffff; color: #0f172a; border-radius: 10px; padding: 8px 12px; cursor: pointer; transition: 0.1s; }
.geo3d-btn:hover, .geo3d-toolbtn:hover { border-color: #f59e0b; background: #fffaf0; }
.geo3d-title, .geo3d-field input, .geo3d-field select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; width: 100%; font: inherit; background: #fff; }

.geo3d-body { position: relative; display: block; flex: 1; min-height: 0; overflow: hidden; }
.geo3d-side { position: absolute; left: 0; top: 0; bottom: 0; width: 250px; background: rgba(251,253,255,0.95); padding: 14px; border-right: 1px solid #d7deea; display: flex; flex-direction: column; gap: 14px; overflow-y: hidden; z-index: 10; transform: translateX(-235px); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease; box-shadow: 2px 0 15px rgba(15,23,42,0); }
.geo3d-side::after { content: '▶'; position: absolute; right: 4px; top: 50%; transform: translateY(-50%); font-size: 10px; color: #64748b; pointer-events: none; transition: opacity 0.2s; }
.geo3d-side:hover { transform: translateX(0); box-shadow: 2px 0 15px rgba(15,23,42,0.1); overflow-y: auto; }
.geo3d-side:hover::after { opacity: 0; }
.geo3d-main { position: absolute; inset: 0; width: 100%; height: 100%; }
.geo3d-right { position: absolute; right: 0; top: 0; bottom: 0; width: 300px; background: rgba(251,253,255,0.95); padding: 14px; border-left: 1px solid #d7deea; display: flex; flex-direction: column; gap: 14px; overflow-y: hidden; z-index: 10; transform: translateX(285px); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease; box-shadow: -2px 0 15px rgba(15,23,42,0); }
.geo3d-right::before { content: '◀'; position: absolute; left: 4px; top: 50%; transform: translateY(-50%); font-size: 10px; color: #64748b; pointer-events: none; transition: opacity 0.2s; z-index: 11; }
.geo3d-right:hover { transform: translateX(0); box-shadow: -2px 0 15px rgba(15,23,42,0.1); overflow-y: auto; }
.geo3d-right:hover::before { opacity: 0; }
.geo3d-panel-half, .geo3d-panel-large { transition: flex 0.4s cubic-bezier(0.4, 0, 0.2, 1); min-height: 0; } 
.geo3d-panel-half { flex: 1; } 
.geo3d-panel-large { flex: 1.5; } 

@media (max-width: 900px) {
  .geo3d-body { display: flex; flex-direction: column; overflow-y: auto; position: relative; }
  .geo3d-side, .geo3d-right { position: relative; width: 100%; flex: none; transform: none; box-shadow: none; left: auto; right: auto; z-index: 1; overflow: visible; }
  .geo3d-side::after, .geo3d-right::before { display: none; }
  .geo3d-side { border-right: none; border-bottom: 1px solid #d7deea; }
  .geo3d-right { border-left: none; border-top: 1px solid #d7deea; }
  .geo3d-main { position: relative; inset: auto; min-height: 500px; flex: none; }
  .geo3d-right:has(.geo3d-section:hover) .geo3d-section, .geo3d-right:has(.geo3d-section:hover) .geo3d-section:not(:hover) { flex: auto; }
  .geo3d-right:has(.geo3d-section:hover) .geo3d-section:not(:hover) .geo3d-section-content { opacity: 1; pointer-events: auto; overflow-y: auto; }
}

.geo3d-section { background: #ffffff; border: 1px solid #d7deea; border-radius: 12px; box-shadow: 0 16px 40px rgba(15,23,42,0.08); display: flex; flex-direction: column; overflow: hidden; height: 100%; }
.geo3d-section-head { padding: 10px 14px; border-bottom: 1px solid #d7deea; background: #f8fafc; font-size: 13px; font-weight: bold; color: #64748b; text-transform: uppercase; flex-shrink: 0; }
.geo3d-section-content { padding: 12px; overflow-y: auto; flex: 1; min-height: 0; transition: opacity 0.2s ease; }

.geo3d-right:has(.geo3d-section:hover) .geo3d-section:hover { flex: 1 1 100%; }
.geo3d-right:has(.geo3d-section:hover) .geo3d-section:not(:hover) { flex: 0 0 42px; }
.geo3d-right:has(.geo3d-section:hover) .geo3d-section:not(:hover) .geo3d-section-content { opacity: 0; pointer-events: none; overflow: hidden; }

.geo3d-canvas-wrap { position: absolute; inset: 0; background: #e2e8f0; width: 100%; height: 100%; overflow: hidden; }
.geo3d-canvas-wrap canvas { display: block; width: 100%; height: 100%; outline: none; }
.geo3d-object-list { display: flex; flex-direction: column; gap: 6px; }
.geo3d-object-item { display: flex; justify-content: space-between; align-items: center; border: 1px solid #d7deea; padding: 8px 10px; border-radius: 8px; cursor: pointer; background: #fff; }
.geo3d-object-item.is-active { border-color: #f59e0b; background: #fff7ed; }
.geo3d-object-main span { font-size: 11px; color: #64748b; }
.geo3d-props { display: flex; flex-direction: column; gap: 10px; }
.geo3d-field span { font-size: 12px; color: #64748b; margin-bottom: 4px; display: block; }
.geo3d-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.geo3d-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

.geo3d-label { background: rgba(255,255,255,0.9); border: 1px solid #94a3b8; border-radius: 4px; padding: 2px 6px; font-size: 12px; pointer-events: none; margin-top: -15px; }

/* NUEVO: Etiqueta Inversa para las Caras (Polígonos) */
.geo3d-label-body { background: transparent !important; border: none !important; font-weight: 800 !important; font-size: 13px !important; margin-top: 0 !important; text-shadow: 1px 1px 0 rgba(255,255,255,0.8), -1px -1px 0 rgba(255,255,255,0.8), 1px -1px 0 rgba(255,255,255,0.8), -1px 1px 0 rgba(255,255,255,0.8); }
.geo3d-label-face { background: transparent !important; border: none !important; color: #ffffff !important; font-weight: 800 !important; font-size: 13px !important; margin-top: 0 !important; text-shadow: 1px 1px 0 rgba(15,23,42,0.6), -1px -1px 0 rgba(15,23,42,0.6), 1px -1px 0 rgba(15,23,42,0.6), -1px 1px 0 rgba(15,23,42,0.6); }

.geo3d-axis-label { background: transparent !important; border: none !important; font-weight: 900 !important; font-size: 14px !important; margin-top: 0 !important; text-shadow: 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff; }

.geo3d-prop-subtitle { font-size: 11px; text-transform: uppercase; color: #f59e0b; font-weight: bold; border-bottom: 1px solid #d7deea; padding-bottom: 4px; margin-top: 6px; }
.geo3d-hidden { display: none !important; }
.geo3d-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.48); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.geo3d-modal { width: 800px; max-width: 90%; background: #fff; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
.geo3d-modal-head, .geo3d-modal-foot { padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #d7deea; }
.geo3d-modal-foot { border-top: 1px solid #d7deea; display: flex; justify-content: flex-end; gap: 10px; padding: 12px 16px; }
.geo3d-publish-area { width: 100%; height: 300px; border: none; padding: 16px; font-family: monospace; resize: none; outline: none; }
    `;
    document.head.appendChild(style);
  }

  function ensureThreeGlobals() {
    if (typeof window.THREE === 'undefined') throw new Error('Geo3D: Three.js no cargado.');
    if (typeof window.THREE.OrbitControls === 'undefined') throw new Error('Geo3D: OrbitControls no cargado.');
    if (typeof window.THREE.TransformControls === 'undefined') throw new Error('Geo3D: TransformControls no cargado.');
  }

  function createCssLabel(text, type) {
    if (typeof window.THREE.CSS2DObject === 'undefined') return null;
    const el = document.createElement('div'); 
    if (type === 'axis') el.className = 'geo3d-label geo3d-axis-label';
    else if (type === 'body') el.className = 'geo3d-label geo3d-label-body';
    else if (type === 'face') el.className = 'geo3d-label geo3d-label-face';
    else el.className = 'geo3d-label';
    el.textContent = text;
    return new window.THREE.CSS2DObject(el);
  }

  function clearObject3DTree(root) {
    if (!root) return;
    while (root.children.length > 0) { 
      const child = root.children[0];
      clearObject3DTree(child); 
      root.remove(child); 
    }
    if (root.element && root.element.parentNode) root.element.parentNode.removeChild(root.element);
    if (root.geometry) root.geometry.dispose();
    if (root.material) { if (Array.isArray(root.material)) { root.material.forEach(function(m) { m.dispose(); }); } else { root.material.dispose(); } }
  }

  class Geo3DApp {
    constructor(target, scene, options) {
      ensureStyles(); ensureThreeGlobals();
      this.target = typeof target === 'string' ? document.querySelector(target) : target;
      this.mode = (options && options.mode === 'viewer') ? 'viewer' : 'editor';
      this.sceneData = normalizeScene(scene || createEmptyScene());
      this.computedObjects =[]; this.showDependents = false;
      this.selectedId = this.sceneData.objects.length > 0 ? this.sceneData.objects[0].id : null;
      this.objectViews = new Map(); this.selectables =[];
      this.raycaster = new window.THREE.Raycaster(); this.pointer = new window.THREE.Vector2();
      this.isSyncing = false;
    }

    mount() {
      this.target.innerHTML = ''; this.buildRoot(); this.initThree(); this.bindEvents(); this.rebuildAll();
      MOUNTED.set(this.target, this); return this;
    }

    buildRoot() {
      this.root = document.createElement('div');
      this.root.className = 'geo3d-root geo3d-' + this.mode;
      if (this.mode === 'editor') {
        this.root.innerHTML = `
          <div class="geo3d-toolbar">
            <button class="geo3d-btn" data-action="new">Nuevo</button>
            <button class="geo3d-btn" data-action="publish">Publicar HTML</button>
            <button class="geo3d-btn" data-action="copyjson">Copiar JSON (IA)</button>
            <button class="geo3d-btn" data-action="fullscreen">Pantalla Completa ⛶</button>
            <input class="geo3d-title" type="text" value="${escapeHtml(this.sceneData.title)}">
          </div>
          <div class="geo3d-body">
            <aside class="geo3d-side">
              <section class="geo3d-section">
                <div class="geo3d-section-head">Herramientas</div>
                <div class="geo3d-section-content">${buildEditorToolMenuHtml()}</div>
              </section>
            </aside>
            <main class="geo3d-main"><div class="geo3d-canvas-wrap"></div></main>
            <aside class="geo3d-right">
              <section class="geo3d-section geo3d-panel-half">
                <div class="geo3d-section-head">Visibilidad y Objetos</div>
                <div class="geo3d-section-content">
                  <label style="font-size:12px; display:block; margin-bottom:8px;"><input type="checkbox" id="geo3d-show-grid" ${this.sceneData.view.grid ? 'checked' : ''}> Mostrar Grilla (Plano XY)</label>
                  <label style="font-size:12px; display:block; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid #d7deea;"><input type="checkbox" id="geo3d-show-axes" ${this.sceneData.view.axes ? 'checked' : ''}> Mostrar Ejes X, Y, Z</label>
                  <label style="font-size:12px; display:block; margin-bottom:10px;"><input type="checkbox" id="geo3d-show-deps"> Ver Elementos Secundarios</label>
                  <div class="geo3d-object-list"></div>
                </div>
              </section>
              <section class="geo3d-section geo3d-panel-large">
                <div class="geo3d-section-head">Propiedades</div>
                <div class="geo3d-section-content geo3d-props"></div>
              </section>
            </aside>
          </div>
          <div class="geo3d-modal-backdrop geo3d-hidden">
            <div class="geo3d-modal">
              <div class="geo3d-modal-head">Publicar HTML</div>
              <textarea class="geo3d-publish-area" spellcheck="false"></textarea>
              <div class="geo3d-modal-foot"><button class="geo3d-btn" data-action="copy-published">Copiar Código</button><button class="geo3d-btn" data-action="close-modal">Cerrar</button></div>
            </div>
          </div>
        `;
        this.objectListEl = this.root.querySelector('.geo3d-object-list');
        this.propsEl = this.root.querySelector('.geo3d-props');
      } else {
        this.root.innerHTML = `<div class="geo3d-canvas-wrap" style="height:100vh;"></div>`;
      }
      this.target.appendChild(this.root);
      this.canvasWrap = this.root.querySelector('.geo3d-canvas-wrap');
    }

    initThree() {
      this.scene3 = new window.THREE.Scene(); this.scene3.background = new window.THREE.Color(this.sceneData.view.background);
      this.renderer = new window.THREE.WebGLRenderer({ antialias: true }); this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.canvasWrap.appendChild(this.renderer.domElement);
      
      if (typeof window.THREE.CSS2DRenderer !== 'undefined') {
        this.labelRenderer = new window.THREE.CSS2DRenderer();
        this.labelRenderer.domElement.style.position = 'absolute'; this.labelRenderer.domElement.style.top = '0px'; this.labelRenderer.domElement.style.left = '0px';
        this.labelRenderer.domElement.style.width = '100%'; this.labelRenderer.domElement.style.height = '100%'; this.labelRenderer.domElement.style.pointerEvents = 'none'; 
        this.canvasWrap.appendChild(this.labelRenderer.domElement);
      }
      
      this.camera = new window.THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 2000); 
      this.camera.position.copy(matCoordsToThree(0, -18, 9)); 
      this.camera.up.copy(matCoordsToThree(0, 0, 1)); 
      this.camera.lookAt(matCoordsToThree(0, 0, 0));
      
      this.controls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.scene3.add(new window.THREE.AmbientLight(0xffffff, 0.9));
      const dirLight = new window.THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(9, 16, 12); this.scene3.add(dirLight);
      
      this.helperGroup = new window.THREE.Group(); this.objectGroup = new window.THREE.Group(); this.selectionHelperGroup = new window.THREE.Group();
      this.scene3.add(this.helperGroup, this.objectGroup, this.selectionHelperGroup);

      this.transformControl = new window.THREE.TransformControls(this.camera, this.renderer.domElement);
      this.transformControl.setMode('translate'); this.transformControl.space = 'world';
      const self = this;
      this.transformControl.addEventListener('dragging-changed', function(e) { self.controls.enabled = !e.value; });
      this.transformControl.addEventListener('change', function() {
        if (self.isSyncing || !self.transformControl.object) return;
        const pt = self.sceneData.objects.find(function(o) { return o.id === self.transformControl.object.userData.objectId; });
        if (pt && pt.type === 'point' && !pt.derived) {
          const pos = threeVecToMat(self.transformControl.object.position); pt.position = { x: pos.x, y: pos.y, z: pos.z };
          self.updateComputedPositions();
        }
      });
      this.scene3.add(this.transformControl);
      
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(function() { self.resize(); });
        this.resizeObserver.observe(this.canvasWrap);
      } else {
        window.addEventListener('resize', function() { self.resize(); }); 
      }
      this.resize();
    }

    renameNode(oldId, newName) {
      if (oldId === newName) return;
      const target = this.sceneData.objects.find(function(o) { return o.id === oldId; });
      if (!target) return;

      if (target.derived) {
         let override = this.sceneData.objects.find(function(o) { return o.id === oldId && o.derived; });
         if (!override) {
            override = { id: oldId, type: target.type, derived: true, parentId: target.parentId };
            this.sceneData.objects.push(override);
         }
         override.label = newName;
         return;
      }

      const existing = this.sceneData.objects.find(function(o) { return o.id === newName && !o.derived; });
      if (existing) {
         const usedIds = new Set(this.sceneData.objects.map(function(o) { return o.id; }));
         let freeId = existing.type === 'point' ? pickNextFreePointId(usedIds) : createUniqueObjectId(existing.type, usedIds);
         this.updateReferences(existing.id, freeId);
         existing.id = freeId;
         existing.label = freeId;
      }

      this.updateReferences(target.id, newName);
      target.id = newName;
      target.label = newName;
    }

    updateReferences(oldId, newId) {
      this.sceneData.objects.forEach(function(o) {
         if (o.anchor === oldId) o.anchor = newId;
         if (o.start === oldId) o.start = newId;
         if (o.end === oldId) o.end = newId;
         if (o.parentId === oldId) o.parentId = newId;
      });
    }

    bindEvents() {
      const self = this;
      this.root.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (btn) {
          const act = btn.dataset.action;
          if (act === 'copyjson') copyTextToClipboard(JSON.stringify(exportScene(self.sceneData), null, 2));
          if (act === 'new') { self.sceneData = createEmptyScene(); self.rebuildAll(); }
          if (act === 'publish') {
            const area = self.root.querySelector('.geo3d-publish-area');
            if (area) { area.value = publishHtml(exportScene(self.sceneData)); self.root.querySelector('.geo3d-modal-backdrop').classList.remove('geo3d-hidden'); }
          }
          if (act === 'close-modal') self.root.querySelector('.geo3d-modal-backdrop').classList.add('geo3d-hidden');
          if (act === 'copy-published') copyTextToClipboard(self.root.querySelector('.geo3d-publish-area').value);
          if (act === 'duplicate-selected' && self.selectedId) {
             const obj = self.sceneData.objects.find(function(o) { return o.id === self.selectedId; });
             if (obj && !obj.derived) {
               const clone = deepClone(obj); clone.id += '_copia'; if (clone.position) clone.position.x += 1;
               self.sceneData.objects.push(clone); self.selectedId = clone.id; self.rebuildAll();
             }
          }
        if (act === 'fullscreen') {
          if (!document.fullscreenElement) {
            self.root.requestFullscreen().catch(function(e){ console.warn('Geo3D: Error al iniciar pantalla completa.', e); });
          } else if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
        }
        const toolBtn = e.target.closest('[data-tool]'); if (toolBtn) self.handleTool(toolBtn.dataset.tool);
        const objBtn = e.target.closest('[data-object-id]'); if (objBtn) self.selectObject(objBtn.dataset.objectId);
      });
      
      this.root.addEventListener('change', function(e) {
        if (e.target.id === 'geo3d-show-deps') { self.showDependents = e.target.checked; self.renderObjectList(); }
        if (e.target.id === 'geo3d-show-grid') { self.sceneData.view.grid = e.target.checked; self.refreshSceneHelpers(); }
        if (e.target.id === 'geo3d-show-axes') { self.sceneData.view.axes = e.target.checked; self.refreshSceneHelpers(); }
        if (e.target.classList.contains('geo3d-title')) { self.sceneData.title = e.target.value; }
      });
      
      this.renderer.domElement.addEventListener('pointerdown', function(e) {
        if (self.transformControl.dragging) return;
        const rect = self.renderer.domElement.getBoundingClientRect();
        self.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; self.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        self.raycaster.setFromCamera(self.pointer, self.camera);
        const hits = self.raycaster.intersectObjects(self.selectables, true);
        if (hits.length > 0) {
          let curr = hits[0].object; while (curr && !curr.userData.objectId) curr = curr.parent;
          if (curr) {
            let targetId = curr.userData.objectId;
            // Si hacemos clic en un sub-elemento (cara, arista) pero no estamos en modo "Ver Elementos Secundarios", seleccionamos al padre.
            if (!self.showDependents) {
              const comp = self.computedObjects.find(function(c) { return c.id === targetId; });
              if (comp && comp.derived && comp.parentId) targetId = comp.parentId;
            }
            self.selectObject(targetId);
          }
        }
      });
    }

    handleTool(toolId) {
      if (toolId === 'delete-selected') {
        if (!this.selectedId) return;
        const targetId = this.selectedId;
        this.sceneData.objects = this.sceneData.objects.filter(function(o) { return o.id !== targetId && o.parentId !== targetId; });
        this.selectedId = null; this.rebuildAll(); return;
      }
      if (toolId === 'center-view') { 
        this.controls.target.copy(matCoordsToThree(0, 0, 0)); 
        this.camera.position.copy(matCoordsToThree(0, -18, 9)); 
        this.camera.up.copy(matCoordsToThree(0, 0, 1)); 
        this.controls.update(); 
        return; 
      }
      
      const usedIds = new Set(this.sceneData.objects.map(function(o) { return o.id; }));
      let newId = toolId === 'point' ? pickNextFreePointId(usedIds) : createUniqueObjectId(toolId, usedIds);

      let obj = { id: newId, type: toolId, label: newId };
      if (toolId === 'point') obj.position = {x:0, y:0, z:0};
      else if (toolId === 'vector') { obj.origin = {x:0,y:0,z:0}; obj.dx=2; obj.dy=2; obj.dz=2; }
      else if (toolId === 'ortoedro') { obj.width=3; obj.length=2; obj.height=2; }
      else if (toolId === 'plane') { obj.width=10; obj.height=10; obj.plane='xy'; }
      
      this.sceneData.objects.push(normalizeObject(obj, usedIds)); this.selectedId = obj.id; this.rebuildAll();
    }

    rebuildAll() {
      this.computedObjects = resolveDependencies(this.sceneData);
      this.objectViews.forEach(function(v) { if (v.dispose) v.dispose(); }); this.objectViews.clear(); this.selectables =[];
      clearObject3DTree(this.objectGroup); clearObject3DTree(this.selectionHelperGroup);
      
      const self = this;
      this.computedObjects.forEach(function(comp) {
        const view = self.buildObjectView(comp); self.objectViews.set(comp.id, view);
        self.objectGroup.add(view.group); if (view.selectionHelper) self.selectionHelperGroup.add(view.selectionHelper);
        self.selectables.push(...view.selectables);
      });
      
      this.refreshSceneHelpers(); this.selectObject(this.selectedId);
      if (this.mode === 'editor') { this.renderObjectList(); this.renderProperties(); }
    }

    getLabelPosition(comp) {
      if (comp.type === 'vector') {
        const sx = comp.absStart.x, sy = comp.absStart.y, sz = comp.absStart.z;
        const ex = comp.absEnd.x, ey = comp.absEnd.y, ez = comp.absEnd.z;
        return { x: (sx + ex) / 2, y: (sy + ey) / 2, z: (sz + ez) / 2 + 0.3 };
      }
      if (comp.type === 'ortoedro') return { x: comp.absPosition.x + comp.width / 2, y: comp.absPosition.y + comp.length / 2, z: comp.absPosition.z + comp.height / 2 };
      if (['squarePyramid', 'cylinder', 'cone'].indexOf(comp.type) !== -1) return { x: comp.absPosition.x, y: comp.absPosition.y, z: comp.absPosition.z + comp.height / 2 };
      if (comp.type === 'polygon') return getPolygonCenter(comp.vertices);
      return comp.absPosition;
    }

    getLabelText(comp) {
      const format = comp.labelFormat || 'name';
      const nameStr = escapeHtml(comp.label || comp.id);
      
      if (comp.type === 'point') {
        const coords = `(${formatNumber(comp.absPosition.x)}, ${formatNumber(comp.absPosition.y)}, ${formatNumber(comp.absPosition.z)})`;
        if (format === 'value') return coords;
        if (format === 'both') return `${nameStr} ${coords}`;
        return nameStr;
      }
      if (comp.type === 'ortoedro') {
        const vol = comp.width * comp.length * comp.height;
        if (format === 'value') return `V: ${formatNumber(vol)}`;
        if (format === 'both') return `${nameStr} (V: ${formatNumber(vol)})`;
        return nameStr;
      }
      if (comp.type === 'polygon') {
        const area = calculatePolygonArea(comp.vertices);
        if (format === 'value') return `A: ${formatNumber(area)}`;
        if (format === 'both') return `${nameStr} (A: ${formatNumber(area)})`;
        return nameStr;
      }
      return nameStr;
    }

    updateComputedPositions() {
      this.isSyncing = true; this.computedObjects = resolveDependencies(this.sceneData);
      const self = this;
      this.computedObjects.forEach(function(comp) {
        const view = self.objectViews.get(comp.id); if (!view) return;
        if (comp.type === 'point' || comp.type === 'sphere' || comp.type === 'plane') { view.coreObject.position.copy(matVecToThree(comp.absPosition)); }
        else if (comp.type === 'vector') {
          const start = matVecToThree(comp.absStart), end = matVecToThree(comp.absEnd), delta = new window.THREE.Vector3().subVectors(end, start);
          let len = delta.length(), dir = new window.THREE.Vector3(0,0,1);
          if (len > 0.0001) dir = delta.clone().normalize(); else len = 0.001;
          view.coreObject.position.copy(start); view.coreObject.setDirection(dir); view.coreObject.setLength(len, Math.min(len * 0.18, 0.9), Math.min(len * 0.08, 0.45));
        } else if (['ortoedro', 'squarePyramid', 'cylinder', 'cone'].indexOf(comp.type) !== -1) {
           if (comp.type==='ortoedro') view.coreObject.position.copy(matCoordsToThree(comp.absPosition.x + comp.width/2, comp.absPosition.y + comp.length/2, comp.absPosition.z + comp.height/2));
           else view.coreObject.position.copy(matCoordsToThree(comp.absPosition.x, comp.absPosition.y, comp.absPosition.z + comp.height/2));
        } else if (comp.type === 'segment') {
           view.coreObject.geometry.dispose(); view.coreObject.geometry = new window.THREE.BufferGeometry().setFromPoints([matVecToThree(comp.startPos), matVecToThree(comp.endPos)]);
        } else if (comp.type === 'polygon' && view.coreObject) {
           view.coreObject.geometry.dispose(); view.coreObject.geometry = createPolygonGeometry(comp.vertices);
        }
        
        clearObject3DTree(view.labelGroup);
        if (comp.showLabel !== false && comp.visible && comp.type !== 'segment') {
           let lblType = 'point';
           if (['ortoedro', 'squarePyramid', 'cylinder', 'cone', 'sphere'].indexOf(comp.type) !== -1) lblType = 'body';
           if (comp.type === 'polygon') lblType = 'face';

           const label = createCssLabel(self.getLabelText(comp), lblType);
           if (label) {
             const lblPos = self.getLabelPosition(comp);
             label.position.copy(matCoordsToThree(lblPos.x, lblPos.y, lblPos.z)); view.labelGroup.add(label);
           }
        }
      });
      this.refreshSelectionHelpers(); if (this.mode === 'editor') this.renderProperties(); this.isSyncing = false;
    }

    buildObjectView(comp) {
      const group = new window.THREE.Group(), labelGroup = new window.THREE.Group(), selectables =[];
      let coreObject = null, selectionHelper = null;
      const mat = new window.THREE.MeshPhongMaterial({ color: comp.color, transparent: comp.opacity < 0.99, opacity: comp.opacity });

      if (comp.type === 'point') { coreObject = new window.THREE.Mesh(new window.THREE.SphereGeometry(comp.size || 0.15, 16, 12), mat); coreObject.position.copy(matVecToThree(comp.absPosition)); }
      else if (comp.type === 'ortoedro') { coreObject = new window.THREE.Mesh(new window.THREE.BoxGeometry(comp.length, comp.height, comp.width), mat); coreObject.position.copy(matCoordsToThree(comp.absPosition.x + comp.width/2, comp.absPosition.y + comp.length/2, comp.absPosition.z + comp.height/2)); }
      else if (comp.type === 'squarePyramid') { coreObject = new window.THREE.Mesh(new window.THREE.ConeGeometry(comp.size / Math.sqrt(2), comp.height, 4), mat); coreObject.rotation.y = Math.PI / 4; coreObject.position.copy(matCoordsToThree(comp.absPosition.x, comp.absPosition.y, comp.absPosition.z + comp.height/2)); }
      else if (comp.type === 'cylinder') { coreObject = new window.THREE.Mesh(new window.THREE.CylinderGeometry(comp.radius, comp.radius, comp.height, comp.radialSegments), mat); coreObject.position.copy(matCoordsToThree(comp.absPosition.x, comp.absPosition.y, comp.absPosition.z + comp.height/2)); }
      else if (comp.type === 'cone') { coreObject = new window.THREE.Mesh(new window.THREE.ConeGeometry(comp.radius, comp.height, comp.radialSegments), mat); coreObject.position.copy(matCoordsToThree(comp.absPosition.x, comp.absPosition.y, comp.absPosition.z + comp.height/2)); }
      else if (comp.type === 'sphere') { coreObject = new window.THREE.Mesh(new window.THREE.SphereGeometry(comp.radius, 32, 24), mat); coreObject.position.copy(matVecToThree(comp.absPosition)); }
      else if (comp.type === 'plane') { coreObject = new window.THREE.Mesh(new window.THREE.PlaneGeometry(comp.width, comp.height), mat); coreObject.position.copy(matVecToThree(comp.absPosition)); if(comp.plane==='xy') coreObject.rotation.x = -Math.PI/2; else if(comp.plane==='xz') coreObject.rotation.y = Math.PI/2; coreObject.renderOrder = -1; }
      else if (comp.type === 'vector') {
        const start = matVecToThree(comp.absStart), end = matVecToThree(comp.absEnd), delta = new window.THREE.Vector3().subVectors(end, start);
        let len = delta.length(), dir = new window.THREE.Vector3(0,0,1);
        if (len > 0.0001) dir = delta.clone().normalize(); else len = 0.001;
        coreObject = new window.THREE.ArrowHelper(dir, start, len, comp.color, Math.min(len * 0.18, 0.9), Math.min(len * 0.08, 0.45)); selectables.push(coreObject.line, coreObject.cone);
      } else if (comp.type === 'segment') { coreObject = new window.THREE.Line(new window.THREE.BufferGeometry().setFromPoints([matVecToThree(comp.startPos), matVecToThree(comp.endPos)]), new window.THREE.LineBasicMaterial({ color: comp.color, linewidth: 2 })); }
      else if (comp.type === 'polygon') { coreObject = new window.THREE.Mesh(createPolygonGeometry(comp.vertices), new window.THREE.MeshPhongMaterial({ color: comp.color, transparent: true, opacity: comp.opacity, side: window.THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })); }

      if (coreObject) { coreObject.userData.objectId = comp.id; if (comp.type !== 'vector') selectables.push(coreObject); group.add(coreObject); }
      group.visible = comp.visible !== false;

      if (comp.showLabel !== false && comp.visible && comp.type !== 'segment') {
         let lblType = 'point';
         if (['ortoedro', 'squarePyramid', 'cylinder', 'cone', 'sphere'].indexOf(comp.type) !== -1) lblType = 'body';
         if (comp.type === 'polygon') lblType = 'face';

         const label = createCssLabel(this.getLabelText(comp), lblType);
         if (label) {
           const lblPos = this.getLabelPosition(comp);
           label.position.copy(matCoordsToThree(lblPos.x, lblPos.y, lblPos.z)); labelGroup.add(label);
         }
      }
      group.add(labelGroup);

      if (comp.type !== 'segment' && comp.type !== 'polygon') { selectionHelper = new window.THREE.BoxHelper(group, 0xf59e0b); selectionHelper.visible = false; selectionHelper.userData.objectId = comp.id; }
      return { group: group, coreObject: coreObject, labelGroup: labelGroup, selectionHelper: selectionHelper, selectables: selectables };
    }

    selectObject(id) {
      this.selectedId = id; this.transformControl.detach();
      if (this.selectedId) {
        const self = this;
        const comp = this.computedObjects.find(function(c) { return c.id === self.selectedId; });
        if (comp && comp.type === 'point' && !comp.derived) { const view = this.objectViews.get(this.selectedId); if (view && view.coreObject) this.transformControl.attach(view.coreObject); }
      }
      this.refreshSelectionHelpers();
      if (this.mode === 'editor') { this.renderObjectList(); this.renderProperties(); }
    }

    createMathAxes(size) {
      const group = new window.THREE.Group();
      const axes = [
        { label: 'X', from: { x: 0, y: 0, z: 0 }, to: { x: size, y: 0, z: 0 }, color: '#ef4444' },
        { label: 'Y', from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: size, z: 0 }, color: '#16a34a' },
        { label: 'Z', from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: size }, color: '#2563eb' }
      ];
      axes.forEach(function (axis) {
        const geometry = new window.THREE.BufferGeometry().setFromPoints([matVecToThree(axis.from), matVecToThree(axis.to)]);
        const material = new window.THREE.LineBasicMaterial({ color: axis.color, linewidth: 2 });
        group.add(new window.THREE.Line(geometry, material));
        const label = createCssLabel(axis.label, 'axis');
        if (label) {
          label.position.copy(matCoordsToThree(axis.to.x, axis.to.y, axis.to.z + 0.3));
          label.element.style.color = axis.color;
          group.add(label);
        }
      });
      return group;
    }

    refreshSceneHelpers() { 
      clearObject3DTree(this.helperGroup); 
      if (this.sceneData.view.grid) {
        this.helperGroup.add(new window.THREE.GridHelper(20, 20, 0x94a3b8, 0xcbd5e1)); 
      }
      if (this.sceneData.view.axes) {
        this.helperGroup.add(this.createMathAxes(10));
      }
    }

    refreshSelectionHelpers() {
      const self = this;
      this.selectionHelperGroup.children.forEach(function(h) { h.visible = (h.userData.objectId === self.selectedId); if (h.visible) h.update(); });
      this.objectViews.forEach(function(v, id) {
         const comp = self.computedObjects.find(function(c) { return c.id === id; });
         if(comp && comp.type === 'segment') v.coreObject.material.color.set(id === self.selectedId ? '#f59e0b' : comp.color);
         if(comp && comp.type === 'polygon') { v.coreObject.material.color.set(id === self.selectedId ? '#f59e0b' : comp.color); v.coreObject.material.opacity = id === self.selectedId ? 0.8 : comp.opacity; }
      });
    }

    renderObjectList() {
      if (!this.objectListEl) return;
      const self = this; let html = '';
      this.computedObjects.forEach(function(obj) {
        if (!self.showDependents && obj.derived) return;
        const isActive = obj.id === self.selectedId ? 'is-active' : '';
        const style = obj.derived ? 'style="margin-left: 20px; width: calc(100% - 20px); opacity: 0.85;"' : '';
        html += `<div class="geo3d-object-item ${isActive}" data-object-id="${obj.id}" ${style}><span class="geo3d-object-main"><strong>${escapeHtml(obj.label || obj.id)}</strong><br><span>${escapeHtml(objectTypeLabel(obj.type))}</span></span></div>`;
      });
      this.objectListEl.innerHTML = html;
    }

    renderProperties() {
      if (!this.propsEl) return;
      const self = this;
      const comp = this.computedObjects.find(function(c) { return c.id === self.selectedId; });
      if (!comp) { this.propsEl.innerHTML = '<div style="color:#64748b; font-size:13px;">Selecciona un objeto.</div>'; return; }

      const isFree = !comp.derived, freePoints = this.computedObjects.filter(function(o) { return o.type === 'point' && !o.derived; });
      function pointsOptions(sel) { return freePoints.map(function(p) { return `<option value="${p.id}" ${(sel === p.id) ? 'selected' : ''}>${p.id}</option>`; }).join(''); }

      let html = '';
      if (!isFree) html += `<div class="geo3d-prop-subtitle">Derivado de: ${comp.parentId}</div>`;
      
      const nameVal = comp.derived ? (comp.label || comp.id) : comp.id;
      html += `<label class="geo3d-field"><span>Nombre</span><input type="text" data-action-rename="true" value="${nameVal}"></label>`;
      
      if (comp.type === 'point' || comp.type === 'ortoedro' || comp.type === 'polygon') {
        const f = comp.labelFormat || 'name';
        html += `<label class="geo3d-field"><span>Formato Etiqueta 3D</span><select data-prop="labelFormat">
                    <option value="name" ${f==='name'?'selected':''}>Solo Nombre</option>
                    <option value="value" ${f==='value'?'selected':''}>${comp.type === 'point' ? 'Solo Coordenadas' : 'Solo Valores'}</option>
                    <option value="both" ${f==='both'?'selected':''}>Nombre y Valores</option>
                 </select></label>`;
      }

      html += `<label class="geo3d-field"><span>Color</span><input type="color" data-prop="color" value="${comp.color}"></label>`;

      if (['ortoedro', 'squarePyramid', 'cylinder', 'cone', 'sphere', 'plane', 'polygon'].indexOf(comp.type) !== -1) {
         html += `<label class="geo3d-field"><span>Opacidad (Transparencia)</span><input type="range" min="0.1" max="1" step="0.1" data-prop="opacity" value="${comp.opacity}"></label>`;
      }
      
      if (comp.type === 'polygon' || comp.type === 'segment' || ['ortoedro', 'squarePyramid', 'cylinder', 'cone', 'sphere', 'point'].indexOf(comp.type) !== -1) {
         html += `<label style="font-size:12px; display:block; margin-top:10px;"><input type="checkbox" data-prop-bool="showLabel" ${comp.showLabel ? 'checked' : ''}> Mostrar Etiqueta en 3D</label>`;
      }

      if (comp.type === 'point' && isFree) {
         html += `<div class="geo3d-prop-subtitle">Posición Absoluta</div><div class="geo3d-grid3"><label class="geo3d-field"><span>x</span><input type="number" step="0.5" data-prop="x" value="${formatNumber(comp.absPosition.x)}"></label><label class="geo3d-field"><span>y</span><input type="number" step="0.5" data-prop="y" value="${formatNumber(comp.absPosition.y)}"></label><label class="geo3d-field"><span>z</span><input type="number" step="0.5" data-prop="z" value="${formatNumber(comp.absPosition.z)}"></label></div>`;
      } else if (comp.type === 'vector') {
         html += `<div class="geo3d-prop-subtitle">Definición Semántica</div><label class="geo3d-field"><span>Punto Inicio (Origen)</span><select data-prop="start"><option value="">Usar Coordenadas</option>${pointsOptions(comp.start)}</select></label><label class="geo3d-field"><span>Punto Fin (Destino)</span><select data-prop="end"><option value="">Usar Componentes</option>${pointsOptions(comp.end)}</select></label><div class="geo3d-prop-subtitle">Componentes Espaciales</div><div class="geo3d-grid3"><label class="geo3d-field"><span>dx</span><input type="number" step="0.5" data-prop="dx" value="${formatNumber(comp.dx)}" ${comp.end ? 'readonly' : ''}></label><label class="geo3d-field"><span>dy</span><input type="number" step="0.5" data-prop="dy" value="${formatNumber(comp.dy)}" ${comp.end ? 'readonly' : ''}></label><label class="geo3d-field"><span>dz</span><input type="number" step="0.5" data-prop="dz" value="${formatNumber(comp.dz)}" ${comp.end ? 'readonly' : ''}></label></div>`;
      } else if (['ortoedro', 'squarePyramid', 'cylinder', 'cone', 'sphere'].indexOf(comp.type) !== -1) {
         html += `<div class="geo3d-prop-subtitle">Anclaje Espacial</div><label class="geo3d-field"><span>Anclar al Punto:</span><select data-prop="anchor"><option value="">Ninguno (Libre)</option>${pointsOptions(comp.anchor)}</select></label><div class="geo3d-prop-subtitle">Dimensiones</div><div class="geo3d-grid2">`;
         if (comp.type === 'ortoedro') { html += `<label class="geo3d-field"><span>Ancho</span><input type="number" step="0.5" data-prop="width" value="${comp.width}"></label><label class="geo3d-field"><span>Largo</span><input type="number" step="0.5" data-prop="length" value="${comp.length}"></label>`; }
         if (comp.type === 'squarePyramid') { html += `<label class="geo3d-field"><span>Lado Base</span><input type="number" step="0.5" data-prop="size" value="${comp.size}"></label>`; }
         if (['cylinder','cone','sphere'].indexOf(comp.type) !== -1) { html += `<label class="geo3d-field"><span>Radio</span><input type="number" step="0.5" data-prop="radius" value="${comp.radius}"></label>`; }
         if (['ortoedro', 'squarePyramid', 'cylinder', 'cone'].indexOf(comp.type) !== -1) { html += `<label class="geo3d-field"><span>Alto</span><input type="number" step="0.5" data-prop="height" value="${comp.height}"></label>`; }
         html += `</div>`;
      } else if (comp.type === 'plane') {
         html += `<div class="geo3d-prop-subtitle">Plano Base</div><div class="geo3d-grid2"><label class="geo3d-field"><span>Ancho</span><input type="number" step="0.5" data-prop="width" value="${comp.width}"></label><label class="geo3d-field"><span>Largo</span><input type="number" step="0.5" data-prop="height" value="${comp.height}"></label></div>`;
      }

      const subs = self.computedObjects.filter(function(o) { return o.parentId === comp.id; });
      const subPts = subs.filter(function(o) { return o.type === 'point'; });
      if (subPts.length > 0) {
        html += `<div class="geo3d-prop-subtitle">Vértices Absolutos</div><div style="background:#f8fafc; border:1px solid #d7deea; border-radius:8px; padding:8px; margin-top:4px;">`;
        subPts.forEach(function(pt) {
          html += `<div style="font-size:12px; font-family:monospace; color:#0f172a; padding:2px 0;"><b>${escapeHtml(pt.label)}</b> = (${formatNumber(pt.absPosition.x)}, ${formatNumber(pt.absPosition.y)}, ${formatNumber(pt.absPosition.z)})</div>`;
        });
        html += `</div>`;
      }

      if (comp.type === 'segment') {
         const dx = comp.endPos.x - comp.startPos.x, dy = comp.endPos.y - comp.startPos.y, dz = comp.endPos.z - comp.startPos.z;
         html += `<div class="geo3d-prop-subtitle">Medición</div><div style="font-size:13px; color:#0f172a;"><b>Longitud:</b> ${formatNumber(Math.sqrt(dx*dx + dy*dy + dz*dz), 3)}</div>`;
      }
      if (comp.type === 'vector') {
         const mag = Math.sqrt(comp.dx*comp.dx + comp.dy*comp.dy + comp.dz*comp.dz);
         html += `<div class="geo3d-prop-subtitle">Cálculo Vectorial</div><div style="font-size:13px; color:#0f172a;"><b>Módulo ||v||:</b> ${formatNumber(mag, 3)}</div>`;
      }
      if (comp.type === 'polygon') {
         const area = calculatePolygonArea(comp.vertices);
         html += `<div class="geo3d-prop-subtitle">Medición Superficie</div><div style="font-size:13px; color:#0f172a;"><b>Área:</b> ${formatNumber(area, 3)}</div>`;
      }

      this.propsEl.innerHTML = html;
      
      const renameInput = this.propsEl.querySelector('[data-action-rename="true"]');
      if (renameInput) {
         renameInput.addEventListener('change', function(e) {
            let newName = normalizeId(e.target.value, comp.id);
            if (newName && newName !== comp.id) { self.renameNode(comp.id, newName); self.rebuildAll(); }
         });
      }

      const inputs = this.propsEl.querySelectorAll('[data-prop]');
      for(let i=0; i<inputs.length; i++){
        inputs[i].addEventListener('change', function(e) {
          const input = e.target; const prop = input.getAttribute('data-prop');
          let source = self.sceneData.objects.find(function(c) { return c.id === comp.id; });
          if (!source && comp.derived) { source = { id: comp.id, type: comp.type, derived: true, parentId: comp.parentId }; self.sceneData.objects.push(source); }
          
          if (prop === 'x' || prop === 'y' || prop === 'z') {
            if (!source.position) source.position = {x:0, y:0, z:0};
            source.position[prop] = safeNumber(input.value, source.position[prop]);
          } else if (prop === 'start' || prop === 'end' || prop === 'anchor') {
            if (input.value) source[prop] = input.value; else delete source[prop];
          } else { source[prop] = input.type === 'number' ? safeNumber(input.value, comp[prop]) : input.value; }
          self.rebuildAll();
        });
      }
      
      const boolInputs = this.propsEl.querySelectorAll('[data-prop-bool]');
      for(let i=0; i<boolInputs.length; i++){
        boolInputs[i].addEventListener('change', function(e) {
          const input = e.target; const prop = input.getAttribute('data-prop-bool');
          let source = self.sceneData.objects.find(function(c) { return c.id === comp.id; });
          if (!source && comp.derived) { source = { id: comp.id, type: comp.type, derived: true, parentId: comp.parentId }; self.sceneData.objects.push(source); }
          source[prop] = input.checked;
          self.rebuildAll();
        });
      }
    }

    resize() {
      if (!this.canvasWrap || !this.camera || !this.renderer) return;
      const w = this.canvasWrap.clientWidth;
      const h = this.canvasWrap.clientHeight;
      if (w === 0 || h === 0) return;

      this.renderer.setSize(w, h, false);
      if (this.labelRenderer) { this.labelRenderer.setSize(w, h); }
      
      const aspect = w / h;
      const radius = 8;
      this.camera.left = -radius * aspect; this.camera.right = radius * aspect; this.camera.top = radius; this.camera.bottom = -radius; this.camera.updateProjectionMatrix();
    }

    animate() {
      const self = this;
      window.requestAnimationFrame(function() { self.animate(); });
      this.controls.update(); this.renderer.render(this.scene3, this.camera);
      if (this.labelRenderer && this.sceneData.view.labels) { this.labelRenderer.render(this.scene3, this.camera); }
    }
  }

  function mountEditor(target, scene, options) {
    const opts = Object.assign({}, options || {}, { mode: 'editor' });
    const app = new Geo3DApp(target, scene, opts);
    app.mount(); app.animate(); return app;
  }

  function publishHtml(scene) {
    const jsonStr = escapeHtml(JSON.stringify(scene, null, 2));
    return `<div id="geo3d-viewer" style="width:100%; height:600px;"></div>
<textarea id="geo3d-data" hidden>${jsonStr}</textarea>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/renderers/CSS2DRenderer.js"></script>
<script src="geo3dv1.js"></script>
<script>
  window.onload = function() {
    var data = JSON.parse(document.getElementById("geo3d-data").value);
    window.Geo3D.mountEditor("#geo3d-viewer", data, {mode:"viewer"});
  };
</script>`;
  }

  window.Geo3D = Object.freeze({ mountEditor: mountEditor, publishHtml: publishHtml });
})(window, document);