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

  function normalizeViewerMode(value) {
    const mode = String(value || 'explore').trim().toLowerCase();
    if (mode === 'locked') return 'locked';
    return 'explore';
  }

  function resolveSceneSourceElement(sceneSource) {
    if (!sceneSource) return null;

    if (typeof sceneSource === 'string') {
      const el = document.querySelector(sceneSource);
      if (!el) throw new Error('No se encontró sceneSource: ' + sceneSource);
      return el;
    }

    if (sceneSource instanceof Element) {
      return sceneSource;
    }

    throw new Error('sceneSource inválido.');
  }

  function readEmbeddedSceneAttr(el) {
    if (!el || !el.getAttribute) return null;
    return (el.getAttribute('data-scene') || el.getAttribute('data-geo2d-scene') || '').trim() || null;
  }

  function readSceneSource(sceneSource) {
    if (!sceneSource) return null;

    if (typeof sceneSource === 'string') {
      const el = document.querySelector(sceneSource);
      if (!el) throw new Error('No se encontró sceneSource: ' + sceneSource);
      const attrScene = el.getAttribute && (el.getAttribute('data-scene') || el.getAttribute('data-geo2d-scene'));
      if (attrScene) return attrScene.trim();
      return (el.value !== undefined ? el.value : el.textContent || '').trim();
    }

    if (sceneSource instanceof Element) {
      const attrScene = sceneSource.getAttribute && (sceneSource.getAttribute('data-scene') || sceneSource.getAttribute('data-geo2d-scene'));
      if (attrScene) return attrScene.trim();
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

  function hasInternalObjectFamily(type, family) {
    return !!INTERNAL_OBJECT_REGISTRY[String(type || '').trim()]?.families?.includes(family);
  }

  function isPointLikeRawType(type) {
    return hasInternalObjectFamily(type, 'pointLike');
  }

  function isLineLikeRawType(type) {
    return hasInternalObjectFamily(type, 'lineLike');
  }

  function isVectorRawType(type) {
    return hasInternalObjectFamily(type, 'vector');
  }

  function isDirectionalRawType(type) {
    return hasInternalObjectFamily(type, 'directional');
  }

  function isIntersectableRawType(type) {
    return hasInternalObjectFamily(type, 'intersectable');
  }

  const FREE_POINT_FILL = '#ea580c';
  const DEPENDENT_POINT_FILL = '#16a34a';
  const MOBILE_LAYOUT_BREAKPOINT = 820;
  const MIN_VIEWPORT_SPAN = 1e-3;
  const MAX_VIEWPORT_SPAN = 1e6;
  const WHEEL_ZOOM_HISTORY_DELAY = 250;
  const ANCHOR_PREVIEW_TOOLS = new Set([
    'point',
    'segment',
    'line',
    'parallel-line',
    'perpendicular-line',
    'ray',
    'vector',
    'vector-equipollent',
    'circle',
    'circle-radius',
    'ellipse',
    'polyline',
    'polygon',
    'midpoint',
    'intersect',
    'measure-distance',
    'measure-angle',
    'text'
  ]);
  const TOOL_PREVIEW_COLORS = Object.freeze({
    point: '#ea580c',
    segment: '#1976d2',
    line: '#2e7d32',
    'parallel-line': '#0284c7',
    'perpendicular-line': '#b45309',
    ray: '#0f766e',
    vector: '#7c3aed',
    'vector-equipollent': '#7c3aed',
    circle: '#c62828',
    'circle-radius': '#dc2626',
    ellipse: '#9333ea',
    polyline: '#0ea5e9',
    polygon: '#ea580c',
    midpoint: '#2e7d32',
    intersect: '#16a34a',
    'measure-distance': '#6b7280',
    'measure-angle': '#6b7280',
    text: '#111827'
  });
  const TWO_POINT_CONSTRUCTION_SPECS = Object.freeze({
    segment: {
      idPrefix: 's',
      build: (a, b) => ({ type: 'segment', p1: a, p2: b, style: { stroke: '#1976d2' } })
    },
    line: {
      idPrefix: 'r',
      build: (a, b) => ({ type: 'line', p1: a, p2: b, style: { stroke: '#2e7d32' } })
    },
    ray: {
      idPrefix: 'sr',
      build: (a, b) => ({ type: 'ray', p1: a, p2: b, style: { stroke: '#0f766e' } })
    },
    vector: {
      idPrefix: 'v',
      build: (a, b) => ({ type: 'vector', p1: a, p2: b, style: { stroke: '#7c3aed' } })
    },
    circle: {
      idPrefix: 'c',
      build: (a, b) => ({ type: 'circle', center: a, through: b, style: { stroke: '#c62828' } })
    },
    midpoint: {
      idPrefix: 'M',
      build: (a, b) => ({ type: 'midpoint', p1: a, p2: b, label: 'M', style: { fill: DEPENDENT_POINT_FILL } })
    },
    'measure-distance': {
      idPrefix: 'm',
      build: (a, b) => ({ type: 'measure', measureType: 'distance', of: [a, b] })
    }
  });
  const FIGURE_CONSTRUCTION_SPECS = Object.freeze({
    polyline: {
      idPrefix: 'pline',
      type: 'polyline',
      style: Object.freeze({ stroke: '#0ea5e9', fill: 'none' })
    },
    polygon: {
      idPrefix: 'poly',
      type: 'polygon',
      style: Object.freeze({ stroke: '#ea580c', fill: 'rgba(234,88,12,0.18)' })
    }
  });

  function normalizePointSemanticStyle(raw) {
    if (!raw || typeof raw !== 'object') return;
    if (raw.type !== 'point' && raw.type !== 'midpoint') return;

    if (!raw.style || typeof raw.style !== 'object' || Array.isArray(raw.style)) {
      raw.style = {};
    }

    const isDependent = raw.type === 'midpoint' || (raw.type === 'point' && !!raw.constraint);
    const fill = typeof raw.style.fill === 'string' ? raw.style.fill.trim().toLowerCase() : '';
    const freeFill = FREE_POINT_FILL.toLowerCase();

    if (!fill) {
      raw.style.fill = isDependent ? DEPENDENT_POINT_FILL : FREE_POINT_FILL;
      return;
    }

    if (isDependent && fill === freeFill) {
      raw.style.fill = DEPENDENT_POINT_FILL;
    }
  }

  function cleanObjectRefs(refs) {
    return refs.filter(Boolean);
  }

  function getPointRawObjectRefs(raw) {
    if (!raw.constraint) return [];
    if (raw.constraint.kind === 'intersection') {
      return cleanObjectRefs([raw.constraint.objectId, raw.constraint.objectId2]);
    }
    return raw.constraint.objectId ? [raw.constraint.objectId] : [];
  }

  function getTwoPointRawObjectRefs(raw) {
    return cleanObjectRefs([raw.p1, raw.p2]);
  }

  function getDerivedLineRawObjectRefs(raw) {
    return cleanObjectRefs([raw.point, raw.objectId]);
  }

  function getCircleRawObjectRefs(raw) {
    return cleanObjectRefs([raw.center, raw.through]);
  }

  function getCenterRawObjectRefs(raw) {
    return cleanObjectRefs([raw.center]);
  }

  function getEllipseRawObjectRefs(raw) {
    return cleanObjectRefs([raw.center, raw.vertex, raw.coVertex]);
  }

  function getEquipollentVectorRawObjectRefs(raw) {
    return cleanObjectRefs([raw.point, raw.vectorId]);
  }

  function getPointSequenceRawObjectRefs(raw) {
    return Array.isArray(raw.points) ? raw.points.filter(Boolean) : [];
  }

  function getMeasureRawObjectRefs(raw) {
    return Array.isArray(raw.of) ? raw.of.filter(Boolean) : [];
  }

  function getNoRawObjectRefs() {
    return [];
  }

  function joinObjectIds(ids) {
    return ids.filter(Boolean).join(', ') || '—';
  }

  function formatNumberShort(value) {
    const n = safeNumber(value, NaN);
    if (!Number.isFinite(n)) return '';
    return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  function describePointRefs(raw) {
    const c = raw.constraint;
    if (!c) return 'Punto libre';
    if (c.kind === 'intersection') return `Intersección de ${joinObjectIds([c.objectId, c.objectId2])}`;
    if (c.kind === 'vector-end') return `Extremo dependiente de ${c.objectId || '—'}`;
    if (c.kind) {
      const edge = c.edgeIndex !== undefined && c.edgeIndex !== null ? `, segmento ${Number(c.edgeIndex) + 1}` : '';
      return `Punto sobre ${c.objectId || '—'}${edge}`;
    }
    return `Punto dependiente: ${joinObjectIds(getPointRawObjectRefs(raw))}`;
  }

  function describeMidpointRefs(raw) {
    return `Punto medio de ${joinObjectIds([raw.p1, raw.p2])}`;
  }

  function describeSegmentRefs(raw) {
    return `Segmento entre ${joinObjectIds([raw.p1, raw.p2])}`;
  }

  function describeLineRefs(raw) {
    return `Recta por ${joinObjectIds([raw.p1, raw.p2])}`;
  }

  function describeRayRefs(raw) {
    return `Semirrecta con origen ${raw.p1 || '—'} y dirección ${raw.p2 || '—'}`;
  }

  function describeVectorRefs(raw) {
    return `Vector de ${raw.p1 || '—'} a ${raw.p2 || '—'}`;
  }

  function describeEquipollentVectorRefs(raw) {
    return `Equipolente a ${raw.vectorId || '—'} desde ${raw.point || '—'}`;
  }

  function describeParallelLineRefs(raw) {
    return `Paralela a ${raw.objectId || '—'} por ${raw.point || '—'}`;
  }

  function describePerpendicularLineRefs(raw) {
    return `Perpendicular a ${raw.objectId || '—'} por ${raw.point || '—'}`;
  }

  function describeCircleRefs(raw) {
    return `Centro ${raw.center || '—'}, pasa por ${raw.through || '—'}`;
  }

  function describeCircleRadiusRefs(raw) {
    return `Centro ${raw.center || '—'}, radio ${formatNumberShort(raw.radius) || '—'}`;
  }

  function describeEllipseRefs(raw) {
    return `Centro ${raw.center || '—'}, vértice ${raw.vertex || '—'}, covértice ${raw.coVertex || '—'}`;
  }

  function describePolylineRefs(raw) {
    return `Vértices: ${joinObjectIds(Array.isArray(raw.points) ? raw.points : [])}`;
  }

  function describePolygonRefs(raw) {
    return `Polígono por ${joinObjectIds(Array.isArray(raw.points) ? raw.points : [])}`;
  }

  function getPolygonEdgeCount(raw) {
    return Array.isArray(raw?.points) ? raw.points.length : 0;
  }

  function normalizePolygonParts(raw) {
    if (!raw || typeof raw !== 'object') return;

    const edgeCount = getPolygonEdgeCount(raw);
    const parts = raw.parts && typeof raw.parts === 'object' && !Array.isArray(raw.parts)
      ? raw.parts
      : {};
    const fill = parts.fill && typeof parts.fill === 'object' && !Array.isArray(parts.fill)
      ? parts.fill
      : {};
    const sourceEdges = Array.isArray(parts.edges) ? parts.edges : [];

    raw.parts = {
      fill: {
        visible: fill.visible !== false
      },
      edges: Array.from({ length: edgeCount }, (_, index) => {
        const source = sourceEdges[index];
        return {
          visible: !(source && typeof source === 'object' && source.visible === false)
        };
      })
    };
  }

  function isPolygonFillVisible(raw) {
    return raw?.parts?.fill?.visible !== false;
  }

  function isPolygonEdgeVisible(raw, edgeIndex) {
    const index = normalizeEdgeIndex(edgeIndex);
    if (index === null) return false;
    if (index < 0 || index >= getPolygonEdgeCount(raw)) return false;
    return raw?.parts?.edges?.[index]?.visible !== false;
  }

  function setPolygonFillVisible(raw, value) {
    normalizePolygonParts(raw);
    raw.parts.fill.visible = !!value;
  }

  function setPolygonEdgeVisible(raw, edgeIndex, value) {
    normalizePolygonParts(raw);
    const index = normalizeEdgeIndex(edgeIndex);
    if (index === null || !raw.parts.edges[index]) return false;
    raw.parts.edges[index].visible = !!value;
    return true;
  }

  function getPolygonEdgePointIds(raw, edgeIndex) {
    const points = Array.isArray(raw?.points) ? raw.points : [];
    const index = normalizeEdgeIndex(edgeIndex);
    if (index === null || !points.length || index < 0 || index >= points.length) return [];
    return [points[index], points[(index + 1) % points.length]].filter(Boolean);
  }

  function getPolygonPartLabel(raw, part) {
    if (!part) return raw?.id || '';
    if (part.kind === 'polygon-edge') {
      const [a, b] = getPolygonEdgePointIds(raw, part.edgeIndex);
      return `${raw.id} lado ${safeNumber(part.edgeIndex, 0) + 1}${a && b ? ` (${a}-${b})` : ''}`;
    }
    return raw?.id || '';
  }

  function getPolygonPartTypeLabel(part) {
    if (part?.kind === 'polygon-fill') return 'Área interior';
    if (part?.kind === 'polygon-edge') return 'Segmento de polígono';
    return 'Polígono';
  }

  function describePolygonPart(raw, part) {
    if (part?.kind === 'polygon-fill') return `Área interior de ${raw.id}`;
    if (part?.kind === 'polygon-edge') {
      const [a, b] = getPolygonEdgePointIds(raw, part.edgeIndex);
      return `Lado ${safeNumber(part.edgeIndex, 0) + 1} de ${raw.id}: ${joinObjectIds([a, b])}`;
    }
    return describePolygonRefs(raw);
  }

  function isPolygonPartVisible(raw, part) {
    if (part?.kind === 'polygon-fill') return isPolygonFillVisible(raw);
    if (part?.kind === 'polygon-edge') return isPolygonEdgeVisible(raw, part.edgeIndex);
    return InternalObjectAdapter.isVisible(raw);
  }

  function setPolygonPartVisible(raw, part, value) {
    if (part?.kind === 'polygon-fill') {
      setPolygonFillVisible(raw, value);
      return true;
    }

    if (part?.kind === 'polygon-edge') {
      return setPolygonEdgeVisible(raw, part.edgeIndex, value);
    }

    return false;
  }

  function polygonSignedArea(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    let sum = 0;

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      sum += safeNumber(a.x, 0) * safeNumber(b.y, 0) - safeNumber(b.x, 0) * safeNumber(a.y, 0);
    }

    return sum / 2;
  }

  function polygonArea(points) {
    return Math.abs(polygonSignedArea(points));
  }

  function describeMeasureRefs(raw) {
    const ids = Array.isArray(raw.of) ? raw.of : [];
    return raw.measureType === 'angle'
      ? `Ángulo ${joinObjectIds(ids)}`
      : `Distancia ${joinObjectIds(ids)}`;
  }

  function describeTextRefs() {
    return 'Texto libre';
  }

  function getRawObjectRefs(raw) {
    if (!raw || typeof raw !== 'object') return [];

    const getRefs = INTERNAL_OBJECT_REGISTRY[String(raw.type || '').trim()]?.refs;
    return getRefs ? getRefs(raw) : [];
  }

  const InternalObjectAdapter = Object.freeze({
    raw(value) {
      return value && value.raw ? value.raw : value;
    },

    type(value) {
      const raw = InternalObjectAdapter.raw(value);
      return String(raw?.type || '').trim();
    },

    refs(value) {
      return getRawObjectRefs(InternalObjectAdapter.raw(value));
    },

    isVisible(value) {
      const raw = InternalObjectAdapter.raw(value);
      return raw?.visible !== false;
    },

    toConstruction(value) {
      const raw = typeof value?.toJSON === 'function'
        ? value.toJSON()
        : InternalObjectAdapter.raw(value);
      return buildConstructionObjectFromInternal(raw);
    },

    fromConstruction(raw, byId) {
      return importConstructionObjectToInternal(raw, byId);
    }
  });

  const CONSTRAINT_PARENT_TYPE = Object.freeze({
    'on-segment': 'segment',
    'on-line': 'line',
    'on-ray': 'ray',
    'on-circle': 'circle',
    'on-ellipse': 'ellipse',
    'ellipse-derived-point': 'ellipse',
    'vector-end': 'vector'
  });

  const ELLIPSE_DERIVED_POINT_ROLES = new Set(['antiVertex', 'antiCoVertex']);

  function createSceneValidationContext(scene) {
    const idMap = new Map();

    if (!Array.isArray(scene.objects)) {
      throw new Error('La escena debe incluir una lista de objetos.');
    }

    for (let i = 0; i < scene.objects.length; i++) {
      const raw = scene.objects[i];

      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`El objeto #${i + 1} no es válido.`);
      }

      const id = String(raw.id || '').trim();
      const type = InternalObjectAdapter.type(raw);

      if (!id) throw new Error(`El objeto #${i + 1} no tiene id.`);
      if (!SUPPORTED_INTERNAL_OBJECT_TYPES.has(type)) throw new Error(`El objeto "${id}" tiene un tipo no soportado: ${type || '(vacío)'}.`);
      if (idMap.has(id)) throw new Error(`Hay un id duplicado: "${id}".`);

      raw.id = id;
      raw.type = type;
      normalizePointSemanticStyle(raw);
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
      if (!isPointLikeRawType(InternalObjectAdapter.type(target))) {
        throw new Error(`El objeto "${ownerId}" requiere que ${fieldName} apunte a un punto o punto medio.`);
      }
      return target;
    }

    function normalizeAndValidateEdgeIndex(ownerId, fieldName, target, edgeIndex, allowOmitted = false) {
      const normalized = normalizeEdgeIndex(edgeIndex);
      if (normalized === null) {
        if (allowOmitted) return null;
        throw new Error(`El objeto "${ownerId}" requiere ${fieldName} para identificar un segmento válido.`);
      }

      const targetType = InternalObjectAdapter.type(target);
      const maxEdges = targetType === 'polygon' ? target.points.length : target.points.length - 1;
      if (normalized < 0 || normalized >= maxEdges) {
        throw new Error(`El objeto "${ownerId}" usa ${fieldName} fuera de rango.`);
      }

      return normalized;
    }

    return {
      idMap,
      normalizeAndValidateEdgeIndex,
      requirePointRef,
      requireRef
    };
  }

  function validateMidpointObject(raw, { requirePointRef }) {
    requirePointRef(raw.id, 'p1', raw.p1);
    requirePointRef(raw.id, 'p2', raw.p2);
  }

  function validateTwoPointObject(raw, { requirePointRef }) {
    requirePointRef(raw.id, 'p1', raw.p1);
    requirePointRef(raw.id, 'p2', raw.p2);
  }

  function validateDerivedLineObject(raw, { normalizeAndValidateEdgeIndex, requirePointRef, requireRef }) {
    requirePointRef(raw.id, 'point', raw.point);
    const parent = requireRef(raw.id, 'objectId', raw.objectId);
    const parentType = InternalObjectAdapter.type(parent);
    if (parentType === 'polyline' || parentType === 'polygon') {
      raw.edgeIndex = normalizeAndValidateEdgeIndex(raw.id, 'edgeIndex', parent, raw.edgeIndex, false);
    } else if (!isDirectionalRawType(parentType)) {
      throw new Error(`La recta derivada "${raw.id}" debe referenciar un segmento, recta, semirrecta o una arista de poligonal/poligono.`);
    }
  }

  function validateCircleObject(raw, { requirePointRef }) {
    requirePointRef(raw.id, 'center', raw.center);
    requirePointRef(raw.id, 'through', raw.through);
  }

  function validateCircleRadiusObject(raw, { requirePointRef }) {
    requirePointRef(raw.id, 'center', raw.center);
    raw.radius = safeNumber(raw.radius, NaN);

    if (!(raw.radius > 1e-9)) {
      throw new Error(`La circunferencia "${raw.id}" debe tener radio mayor que 0.`);
    }
  }

  function validateEllipseObject(raw, { requirePointRef }) {
    requirePointRef(raw.id, 'center', raw.center);
    requirePointRef(raw.id, 'vertex', raw.vertex);
    requirePointRef(raw.id, 'coVertex', raw.coVertex);

    const ids = [raw.center, raw.vertex, raw.coVertex].map(id => String(id || '').trim());
    if (new Set(ids).size !== ids.length) {
      throw new Error(`La elipse "${raw.id}" requiere centro, vértice y covértice distintos.`);
    }

    if (raw.derivedPoints && typeof raw.derivedPoints === 'object' && !Array.isArray(raw.derivedPoints)) {
      raw.derivedPoints.antiVertex = String(raw.derivedPoints.antiVertex || '').trim();
      raw.derivedPoints.antiCoVertex = String(raw.derivedPoints.antiCoVertex || '').trim();
    }
  }

  function validateEquipollentVectorObject(raw, { requirePointRef, requireRef }) {
    requirePointRef(raw.id, 'point', raw.point);
    const baseVector = requireRef(raw.id, 'vectorId', raw.vectorId);
    if (!isVectorRawType(InternalObjectAdapter.type(baseVector))) {
      throw new Error(`El vector equipolente "${raw.id}" debe referenciar un vector.`);
    }
  }

  function validatePointSequenceObject(raw, { requirePointRef }, minPoints, message) {
    if (!Array.isArray(raw.points) || raw.points.length < minPoints) {
      throw new Error(message(raw));
    }

    raw.points.forEach((refId, index) => requirePointRef(raw.id, `points[${index}]`, refId));
  }

  function validatePolylineObject(raw, validationContext) {
    validatePointSequenceObject(raw, validationContext, 2, value => `La poligonal "${value.id}" debe tener al menos 2 puntos.`);
  }

  function validatePolygonObject(raw, validationContext) {
    validatePointSequenceObject(raw, validationContext, 3, value => `El polígono "${value.id}" debe tener al menos 3 puntos.`);
    normalizePolygonParts(raw);
  }

  function validateMeasureObject(raw, { requirePointRef }) {
    raw.measureType = String(raw.measureType || '').trim();
    raw.unit = String(raw.unit || 'deg').trim().toLowerCase();

    if (!['distance', 'angle'].includes(raw.measureType)) {
      throw new Error(`La medida "${raw.id}" usa un tipo no soportado: ${raw.measureType || '(vacío)'}.`);
    }

    if (raw.measureType === 'distance') {
      if (!Array.isArray(raw.of) || raw.of.length !== 2) {
        throw new Error(`La medida "${raw.id}" debe referenciar exactamente 2 puntos.`);
      }

      raw.of.forEach((refId, index) => requirePointRef(raw.id, `of[${index}]`, refId));
      return;
    }

    if (!Array.isArray(raw.of) || raw.of.length !== 3) {
      throw new Error(`El ángulo "${raw.id}" debe referenciar exactamente 3 puntos.`);
    }

    if (!['deg', 'rad'].includes(raw.unit)) {
      throw new Error(`El ángulo "${raw.id}" usa una unidad no soportada: ${raw.unit || '(vacía)'}.`);
    }

    raw.of.forEach((refId, index) => requirePointRef(raw.id, `of[${index}]`, refId));
  }

  function validateTextObject(raw) {
    raw.x = safeNumber(raw.x, NaN);
    raw.y = safeNumber(raw.y, NaN);
    raw.text = String(raw.text ?? raw.label ?? '').trim();

    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
      throw new Error(`El texto "${raw.id}" debe tener coordenadas válidas.`);
    }

    if (!raw.text) {
      throw new Error(`El texto "${raw.id}" debe incluir contenido.`);
    }
  }

  function validatePointIntersectionConstraint(raw, { normalizeAndValidateEdgeIndex, requireRef }) {
    raw.constraint.objectId = String(raw.constraint.objectId || '').trim();
    raw.constraint.objectId2 = String(raw.constraint.objectId2 || '').trim();
    raw.constraint.edgeIndex = normalizeEdgeIndex(raw.constraint.edgeIndex);
    raw.constraint.edgeIndex2 = normalizeEdgeIndex(raw.constraint.edgeIndex2);
    raw.constraint.pickX = safeNumber(raw.constraint.pickX, NaN);
    raw.constraint.pickY = safeNumber(raw.constraint.pickY, NaN);

    const first = requireRef(raw.id, 'constraint.objectId', raw.constraint.objectId);
    const second = requireRef(raw.id, 'constraint.objectId2', raw.constraint.objectId2);

    if (first.id === second.id) {
      throw new Error(`El punto "${raw.id}" requiere dos objetos distintos para intersectar.`);
    }

    const firstType = InternalObjectAdapter.type(first);
    const secondType = InternalObjectAdapter.type(second);

    if (!isIntersectableRawType(firstType) || !isIntersectableRawType(secondType)) {
      throw new Error(`El punto "${raw.id}" requiere dos objetos intersectables.`);
    }

    if (isSegmentChainResolvedKind(firstType)) {
      if (raw.constraint.edgeIndex !== null) {
        raw.constraint.edgeIndex = normalizeAndValidateEdgeIndex(raw.id, 'constraint.edgeIndex', first, raw.constraint.edgeIndex, true);
      }
    } else if (raw.constraint.edgeIndex !== null) {
      throw new Error(`El punto "${raw.id}" solo puede usar constraint.edgeIndex sobre poligonales o poligonos.`);
    }

    if (isSegmentChainResolvedKind(secondType)) {
      if (raw.constraint.edgeIndex2 !== null) {
        raw.constraint.edgeIndex2 = normalizeAndValidateEdgeIndex(raw.id, 'constraint.edgeIndex2', second, raw.constraint.edgeIndex2, true);
      }
    } else if (raw.constraint.edgeIndex2 !== null) {
      throw new Error(`El punto "${raw.id}" solo puede usar constraint.edgeIndex2 sobre poligonales o poligonos.`);
    }

    if (!Number.isFinite(raw.constraint.pickX) || !Number.isFinite(raw.constraint.pickY)) {
      throw new Error(`El punto "${raw.id}" requiere una referencia de selección válida.`);
    }

    raw.draggable = false;
  }

  function isPointOnSegmentTargetType(type) {
    return type === 'segment' || type === 'polyline' || type === 'polygon';
  }

  function isPointOnLineTargetType(type) {
    return isLineLikeRawType(type);
  }

  function isPointOnCircleTargetType(type) {
    return type === 'circle' || type === 'circle-radius';
  }

  function isPointOnEllipseTargetType(type) {
    return type === 'ellipse';
  }

  function isPointConstraintParentCompatible(kind, parentType, expectedParentType) {
    return kind === 'on-line'
      ? isPointOnLineTargetType(parentType)
      : kind === 'on-segment'
        ? isPointOnSegmentTargetType(parentType)
      : kind === 'on-circle'
        ? isPointOnCircleTargetType(parentType)
      : kind === 'on-ellipse'
        ? isPointOnEllipseTargetType(parentType)
      : kind === 'vector-end'
        ? isVectorRawType(parentType)
       : parentType === expectedParentType;
  }

  function validateAttachedPointConstraint(raw, { normalizeAndValidateEdgeIndex, requireRef }, kind) {
    const expectedParentType = CONSTRAINT_PARENT_TYPE[kind];
    if (!expectedParentType) {
      throw new Error(`El punto "${raw.id}" usa una restricción no soportada: ${kind || '(vacía)'}.`);
    }

    raw.constraint.objectId = String(raw.constraint.objectId || '').trim();

    const parent = requireRef(raw.id, 'constraint.objectId', raw.constraint.objectId);
    const parentType = InternalObjectAdapter.type(parent);

    if (!isPointConstraintParentCompatible(kind, parentType, expectedParentType)) {
      throw new Error(`El punto "${raw.id}" requiere un objeto compatible en su restricción.`);
    }

    if (kind === 'ellipse-derived-point') {
      raw.constraint.role = String(raw.constraint.role || '').trim();
      if (!ELLIPSE_DERIVED_POINT_ROLES.has(raw.constraint.role)) {
        throw new Error(`El punto "${raw.id}" requiere un rol de elipse válido.`);
      }
      raw.draggable = false;
    } else if (kind === 'vector-end') {
      raw.draggable = false;
    } else if (kind === 'on-segment' && isSegmentChainResolvedKind(parentType)) {
      raw.constraint.edgeIndex = normalizeAndValidateEdgeIndex(raw.id, 'constraint.edgeIndex', parent, raw.constraint.edgeIndex, false);
    }
  }

  function validatePointObject(raw, validationContext) {
    if (raw.constraint !== undefined) {
      if (!raw.constraint || typeof raw.constraint !== 'object' || Array.isArray(raw.constraint)) {
        throw new Error(`El punto "${raw.id}" tiene una restricción inválida.`);
      }

      const kind = String(raw.constraint.kind || '').trim();
      raw.constraint.kind = kind;

      if (kind === 'intersection') {
        validatePointIntersectionConstraint(raw, validationContext);
        return;
      }

      validateAttachedPointConstraint(raw, validationContext, kind);
      return;
    }

    raw.x = safeNumber(raw.x, NaN);
    raw.y = safeNumber(raw.y, NaN);

    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
      throw new Error(`El punto libre "${raw.id}" debe tener coordenadas válidas.`);
    }
  }

  function validateSceneObjects(scene, validationContext) {
    for (const raw of scene.objects) {
      const type = InternalObjectAdapter.type(raw);
      const validateObject = INTERNAL_OBJECT_REGISTRY[type]?.validate;
      if (validateObject) {
        validateObject(raw, validationContext);
        continue;
      }

    }
  }

  function validateScene(scene) {
    const validationContext = createSceneValidationContext(scene);
    validateSceneObjects(scene, validationContext);
    validateSceneDependencyGraph(scene);
    return scene;
  }

  function validateSceneDependencyGraph(scene) {
    const refsMap = new Map(scene.objects.map(raw => [raw.id, InternalObjectAdapter.refs(raw)]));
    const visited = new Set();
    const visiting = new Set();

    function visit(id, trail = []) {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        const cycleStart = trail.indexOf(id);
        const cycle = (cycleStart >= 0 ? trail.slice(cycleStart) : trail).concat(id);
        throw new Error(`Hay una dependencia cíclica: ${cycle.join(' -> ')}.`);
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
  }

  function sceneUsesConstructionSchema(scene) {
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) return false;
    if (scene.view && !scene.viewport) return true;

    return Array.isArray(scene.objects) && scene.objects.some(raw => (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      typeof raw.kind === 'string' &&
      raw.def &&
      typeof raw.def === 'object' &&
      !Array.isArray(raw.def)
    ));
  }

  function getConstructionTypeKey(kind, defKind) {
    return `${String(kind || '').trim()}:${String(defKind || '').trim()}`;
  }

  const CONSTRUCTION_TO_INTERNAL_TYPES = Object.freeze({
    'point:free': 'point',
    'point:on-object': 'point',
    'point:intersection': 'point',
    'point:vector-end': 'point',
    'point:ellipse-derived-point': 'point',
    'point:midpoint': 'midpoint',
    'segment:between-points': 'segment',
    'ray:from-point-through-point': 'ray',
    'vector:between-points': 'vector',
    'vector:equipollent-from-point': 'equipollent-vector',
    'line:through-two-points': 'line',
    'line:parallel-through-point': 'parallel-line',
    'line:perpendicular-through-point': 'perpendicular-line',
    'circle:center-through-point': 'circle',
    'circle:center-radius': 'circle-radius',
    'ellipse:center-vertex-covertex': 'ellipse',
    'polyline:through-points': 'polyline',
    'polygon:through-points': 'polygon',
    'measure:distance': 'measure',
    'measure:angle': 'measure',
    'text:free-text': 'text'
  });

  function getInternalTypeFromConstructionObject(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
    return CONSTRUCTION_TO_INTERNAL_TYPES[getConstructionTypeKey(raw.kind, raw.def?.kind)] || '';
  }

  function copyConstructionPresentationToInternal(raw, out) {
    if (raw.label !== undefined) out.label = String(raw.label);
    if (raw.visible === false) out.visible = false;
    if (raw.style && typeof raw.style === 'object' && !Array.isArray(raw.style)) out.style = deepClone(raw.style);
    if (raw.draggable !== undefined) out.draggable = !!raw.draggable;
    if (raw.parts && typeof raw.parts === 'object' && !Array.isArray(raw.parts)) out.parts = deepClone(raw.parts);
    return out;
  }

  function copyInternalPresentationToConstruction(raw, out) {
    if (raw.label !== undefined && raw.label !== '') out.label = String(raw.label);
    if (raw.visible === false) out.visible = false;
    if (raw.style && typeof raw.style === 'object' && !Array.isArray(raw.style) && Object.keys(raw.style).length) {
      out.style = deepClone(raw.style);
    }
    if (raw.draggable !== undefined) out.draggable = !!raw.draggable;
    if (InternalObjectAdapter.type(raw) === 'polygon' && raw.parts && typeof raw.parts === 'object' && !Array.isArray(raw.parts)) {
      out.parts = deepClone(raw.parts);
    }
    return out;
  }

  function copyOptionalEdgeIndex(source, target, sourceKey = 'edgeIndex', targetKey = 'edgeIndex') {
    const edgeIndex = normalizeEdgeIndex(source?.[sourceKey]);
    if (edgeIndex !== null) target[targetKey] = edgeIndex;
    return target;
  }

  function getConstructionImportContext(raw, byId) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Hay un objeto de construcción inválido.');
    }

    const id = String(raw.id || '').trim();
    const kind = String(raw.kind || '').trim();
    const def = raw.def && typeof raw.def === 'object' && !Array.isArray(raw.def) ? raw.def : null;
    const defKind = String(def?.kind || '').trim();

    if (!id) throw new Error('Hay un objeto de construcción sin id.');
    if (!kind) throw new Error(`El objeto "${id}" no define kind.`);
    if (!def) throw new Error(`El objeto "${id}" no define def.`);
    if (!defKind) throw new Error(`El objeto "${id}" no define def.kind.`);

    return {
      raw,
      byId,
      id,
      kind,
      def,
      defKind,
      out: copyConstructionPresentationToInternal(raw, { id })
    };
  }

  function getPointOnObjectConstraintKind(targetType) {
    if (isPointOnSegmentTargetType(targetType)) return 'on-segment';
    if (isPointOnLineTargetType(targetType)) return 'on-line';
    if (targetType === 'ray') return 'on-ray';
    if (isPointOnCircleTargetType(targetType)) return 'on-circle';
    if (isPointOnEllipseTargetType(targetType)) return 'on-ellipse';
    return '';
  }

  function importFreePointConstruction({ def, out }) {
    out.type = 'point';
    out.x = safeNumber(def.x, 0);
    out.y = safeNumber(def.y, 0);
    return out;
  }

  function importMidpointConstruction({ def, out }) {
    out.type = 'midpoint';
    out.p1 = String(def.p1 || '').trim();
    out.p2 = String(def.p2 || '').trim();
    return out;
  }

  function importPointOnObjectConstruction({ byId, def, id, out }) {
    const objectId = String(def.objectId || '').trim();
    const target = byId.get(objectId);
    if (!target) throw new Error(`El punto "${id}" referencia "${objectId}", pero no existe.`);

    const targetType = getInternalTypeFromConstructionObject(target);
    const constraintKind = getPointOnObjectConstraintKind(targetType);

    if (!constraintKind) {
      throw new Error(`El punto "${id}" no puede construirse sobre "${objectId}".`);
    }

    const param = def.param && typeof def.param === 'object' && !Array.isArray(def.param) ? def.param : {};
    out.type = 'point';
    out.constraint = {
      kind: constraintKind,
      objectId
    };

    if (constraintKind === 'on-circle' || constraintKind === 'on-ellipse') {
      out.constraint.angle = safeNumber(param.value, 0);
    } else {
      out.constraint.t = safeNumber(param.value, 0);
    }

    if (constraintKind === 'on-segment' && isSegmentChainResolvedKind(targetType)) {
      copyOptionalEdgeIndex(def, out.constraint);
    }

    return out;
  }

  function importIntersectionPointConstruction({ byId, def, id, out }) {
    const objectId = String(def.objectId || '').trim();
    const objectId2 = String(def.objectId2 || '').trim();
    if (!byId.get(objectId)) throw new Error(`El punto "${id}" referencia "${objectId}", pero no existe.`);
    if (!byId.get(objectId2)) throw new Error(`El punto "${id}" referencia "${objectId2}", pero no existe.`);

    const hint = def.hint && typeof def.hint === 'object' && !Array.isArray(def.hint) ? def.hint : {};
    out.type = 'point';
    out.draggable = false;
    out.constraint = {
      kind: 'intersection',
      objectId,
      objectId2,
      pickX: safeNumber(hint.x, 0),
      pickY: safeNumber(hint.y, 0)
    };
    copyOptionalEdgeIndex(def, out.constraint);
    copyOptionalEdgeIndex(def, out.constraint, 'edgeIndex2', 'edgeIndex2');
    out.x = safeNumber(hint.x, 0);
    out.y = safeNumber(hint.y, 0);
    return out;
  }

  function importVectorEndPointConstruction({ byId, def, id, out }) {
    const vectorId = String(def.vectorId || '').trim();
    const target = byId.get(vectorId);
    if (!target) throw new Error(`El punto "${id}" referencia "${vectorId}", pero no existe.`);

    const targetType = getInternalTypeFromConstructionObject(target);
    if (!isVectorRawType(targetType)) {
      throw new Error(`El punto "${id}" requiere un vector compatible en "${vectorId}".`);
    }

    out.type = 'point';
    out.draggable = false;
    out.constraint = {
      kind: 'vector-end',
      objectId: vectorId
    };
    return out;
  }

  function importEllipseDerivedPointConstruction({ byId, def, id, out }) {
    const ellipseId = String(def.ellipseId || def.objectId || '').trim();
    const target = byId.get(ellipseId);
    if (!target) throw new Error(`El punto "${id}" referencia "${ellipseId}", pero no existe.`);

    const targetType = getInternalTypeFromConstructionObject(target);
    if (targetType !== 'ellipse') {
      throw new Error(`El punto "${id}" requiere una elipse compatible en "${ellipseId}".`);
    }

    out.type = 'point';
    out.draggable = false;
    out.constraint = {
      kind: 'ellipse-derived-point',
      objectId: ellipseId,
      role: String(def.role || '').trim()
    };
    return out;
  }

  function importTwoPointConstruction({ def, out }, type) {
    out.type = type;
    out.p1 = String(def.p1 || '').trim();
    out.p2 = String(def.p2 || '').trim();
    return out;
  }

  function importRayConstruction({ def, out }) {
    out.type = 'ray';
    out.p1 = String(def.origin || '').trim();
    out.p2 = String(def.through || '').trim();
    return out;
  }

  function importEquipollentVectorConstruction({ def, out }) {
    out.type = 'equipollent-vector';
    out.point = String(def.point || '').trim();
    out.vectorId = String(def.vectorId || '').trim();
    return out;
  }

  function importDerivedLineConstruction({ def, out }, type) {
    out.type = type;
    out.objectId = String(def.objectId || '').trim();
    out.point = String(def.point || '').trim();
    copyOptionalEdgeIndex(def, out);
    return out;
  }

  function importCircleConstruction({ def, out }) {
    out.type = 'circle';
    out.center = String(def.center || '').trim();
    out.through = String(def.through || '').trim();
    return out;
  }

  function importCircleRadiusConstruction({ def, out }) {
    out.type = 'circle-radius';
    out.center = String(def.center || '').trim();
    out.radius = safeNumber(def.radius, 0);
    return out;
  }

  function importEllipseConstruction({ def, out }) {
    out.type = 'ellipse';
    out.center = String(def.center || '').trim();
    out.vertex = String(def.vertex || '').trim();
    out.coVertex = String(def.coVertex || '').trim();
    if (def.derivedPoints && typeof def.derivedPoints === 'object' && !Array.isArray(def.derivedPoints)) {
      out.derivedPoints = {
        antiVertex: String(def.derivedPoints.antiVertex || '').trim(),
        antiCoVertex: String(def.derivedPoints.antiCoVertex || '').trim()
      };
    }
    return out;
  }

  function importPointListConstruction({ def, out }, type) {
    out.type = type;
    out.points = Array.isArray(def.points) ? deepClone(def.points) : [];
    return out;
  }

  function importMeasureConstruction({ def, defKind, out }) {
    out.type = 'measure';
    out.measureType = defKind;
    out.of = Array.isArray(def.of) ? deepClone(def.of) : [];
    if (defKind === 'angle') out.unit = String(def.unit || 'deg').trim().toLowerCase();
    return out;
  }

  function importTextConstruction({ def, out }) {
    out.type = 'text';
    out.x = safeNumber(def.x, 0);
    out.y = safeNumber(def.y, 0);
    out.text = String(def.text ?? '');
    return out;
  }

  const CONSTRUCTION_TO_INTERNAL_IMPORTERS = Object.freeze({
    'point:free': importFreePointConstruction,
    'point:midpoint': importMidpointConstruction,
    'point:on-object': importPointOnObjectConstruction,
    'point:intersection': importIntersectionPointConstruction,
    'point:vector-end': importVectorEndPointConstruction,
    'point:ellipse-derived-point': importEllipseDerivedPointConstruction,
    'segment:between-points': ctx => importTwoPointConstruction(ctx, 'segment'),
    'ray:from-point-through-point': importRayConstruction,
    'vector:between-points': ctx => importTwoPointConstruction(ctx, 'vector'),
    'vector:equipollent-from-point': importEquipollentVectorConstruction,
    'line:through-two-points': ctx => importTwoPointConstruction(ctx, 'line'),
    'line:parallel-through-point': ctx => importDerivedLineConstruction(ctx, 'parallel-line'),
    'line:perpendicular-through-point': ctx => importDerivedLineConstruction(ctx, 'perpendicular-line'),
    'circle:center-through-point': importCircleConstruction,
    'circle:center-radius': importCircleRadiusConstruction,
    'ellipse:center-vertex-covertex': importEllipseConstruction,
    'polyline:through-points': ctx => importPointListConstruction(ctx, 'polyline'),
    'polygon:through-points': ctx => importPointListConstruction(ctx, 'polygon'),
    'measure:distance': importMeasureConstruction,
    'measure:angle': importMeasureConstruction,
    'text:free-text': importTextConstruction
  });

  function importConstructionObjectToInternal(raw, byId) {
    const ctx = getConstructionImportContext(raw, byId);
    const importer = CONSTRUCTION_TO_INTERNAL_IMPORTERS[getConstructionTypeKey(ctx.kind, ctx.defKind)];
    if (!importer) {
      throw new Error(`El objeto "${ctx.id}" usa una construcción no soportada: ${ctx.kind}/${ctx.defKind}.`);
    }
    return importer(ctx);
  }

  function importConstructionSceneToInternal(scene) {
    const sourceObjects = Array.isArray(scene.objects) ? scene.objects : [];
    const byId = new Map();

    for (const raw of sourceObjects) {
      const id = String(raw?.id || '').trim();
      if (id) byId.set(id, raw);
    }

    return {
      version: Math.max(2, Math.floor(safeNumber(scene.version, 2))),
      meta: scene.meta && typeof scene.meta === 'object' && !Array.isArray(scene.meta) ? deepClone(scene.meta) : {},
      viewport: scene.view && typeof scene.view === 'object' && !Array.isArray(scene.view)
        ? deepClone(scene.view)
        : {},
      style: scene.style && typeof scene.style === 'object' && !Array.isArray(scene.style) ? deepClone(scene.style) : {},
      objects: sourceObjects.map(raw => InternalObjectAdapter.fromConstruction(raw, byId))
    };
  }

  function buildPointConstruction(raw) {
    if (!raw.constraint) {
      return {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'free',
          x: safeNumber(raw.x, 0),
          y: safeNumber(raw.y, 0)
        }
      };
    }

    const constraint = raw.constraint || {};
    if (constraint.kind === 'intersection') {
      const out = {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'intersection',
          objectId: constraint.objectId,
          objectId2: constraint.objectId2,
          hint: {
            x: safeNumber(constraint.pickX, safeNumber(raw.x, 0)),
            y: safeNumber(constraint.pickY, safeNumber(raw.y, 0))
          }
        }
      };
      copyOptionalEdgeIndex(constraint, out.def);
      copyOptionalEdgeIndex(constraint, out.def, 'edgeIndex2', 'edgeIndex2');
      return out;
    }

    if (constraint.kind === 'vector-end') {
      return {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'vector-end',
          vectorId: constraint.objectId
        }
      };
    }

    if (constraint.kind === 'ellipse-derived-point') {
      return {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'ellipse-derived-point',
          ellipseId: constraint.objectId,
          role: String(constraint.role || '').trim()
        }
      };
    }

    const mode = (constraint.kind === 'on-circle' || constraint.kind === 'on-ellipse') ? 'angle' : 't';
    const out = {
      id: raw.id,
      kind: 'point',
      def: {
        kind: 'on-object',
        objectId: constraint.objectId,
        param: {
          mode,
          value: safeNumber(mode === 'angle' ? constraint.angle : constraint.t, 0)
        }
      }
    };
    copyOptionalEdgeIndex(constraint, out.def);
    return out;
  }

  function buildMidpointConstruction(raw) {
    return {
      id: raw.id,
      kind: 'point',
      def: {
        kind: 'midpoint',
        p1: raw.p1,
        p2: raw.p2
      }
    };
  }

  function buildSegmentConstruction(raw) {
    return {
      id: raw.id,
      kind: 'segment',
      def: {
        kind: 'between-points',
        p1: raw.p1,
        p2: raw.p2
      }
    };
  }

  function buildLineConstruction(raw) {
    return {
      id: raw.id,
      kind: 'line',
      def: {
        kind: 'through-two-points',
        p1: raw.p1,
        p2: raw.p2
      }
    };
  }

  function buildRayConstruction(raw) {
    return {
      id: raw.id,
      kind: 'ray',
      def: {
        kind: 'from-point-through-point',
        origin: raw.p1,
        through: raw.p2
      }
    };
  }

  function buildVectorConstruction(raw) {
    return {
      id: raw.id,
      kind: 'vector',
      def: {
        kind: 'between-points',
        p1: raw.p1,
        p2: raw.p2
      }
    };
  }

  function buildEquipollentVectorConstruction(raw) {
    return {
      id: raw.id,
      kind: 'vector',
      def: {
        kind: 'equipollent-from-point',
        point: raw.point,
        vectorId: raw.vectorId
      }
    };
  }

  function buildDerivedLineConstruction(raw, defKind) {
    const out = {
      id: raw.id,
      kind: 'line',
      def: {
        kind: defKind,
        objectId: raw.objectId,
        point: raw.point
      }
    };
    copyOptionalEdgeIndex(raw, out.def);
    return out;
  }

  function buildCircleConstruction(raw) {
    return {
      id: raw.id,
      kind: 'circle',
      def: {
        kind: 'center-through-point',
        center: raw.center,
        through: raw.through
      }
    };
  }

  function buildCircleRadiusConstruction(raw) {
    return {
      id: raw.id,
      kind: 'circle',
      def: {
        kind: 'center-radius',
        center: raw.center,
        radius: safeNumber(raw.radius, 0)
      }
    };
  }

  function buildEllipseConstruction(raw) {
    const out = {
      id: raw.id,
      kind: 'ellipse',
      def: {
        kind: 'center-vertex-covertex',
        center: raw.center,
        vertex: raw.vertex,
        coVertex: raw.coVertex
      }
    };

    if (raw.derivedPoints && typeof raw.derivedPoints === 'object' && !Array.isArray(raw.derivedPoints)) {
      out.def.derivedPoints = {
        antiVertex: String(raw.derivedPoints.antiVertex || '').trim(),
        antiCoVertex: String(raw.derivedPoints.antiCoVertex || '').trim()
      };
    }

    return out;
  }

  function buildPointSequenceConstruction(raw, kind) {
    return {
      id: raw.id,
      kind,
      def: {
        kind: 'through-points',
        points: Array.isArray(raw.points) ? deepClone(raw.points) : []
      }
    };
  }

  function buildMeasureConstruction(raw) {
    const measureKind = raw.measureType === 'angle' ? 'angle' : 'distance';
    const out = {
      id: raw.id,
      kind: 'measure',
      def: {
        kind: measureKind,
        of: Array.isArray(raw.of) ? deepClone(raw.of) : []
      }
    };
    if (measureKind === 'angle') out.def.unit = String(raw.unit || 'deg').trim().toLowerCase();
    return out;
  }

  function buildTextConstruction(raw) {
    return {
      id: raw.id,
      kind: 'text',
      def: {
        kind: 'free-text',
        x: safeNumber(raw.x, 0),
        y: safeNumber(raw.y, 0),
        text: String(raw.text ?? raw.label ?? '')
      }
    };
  }

  function buildConstructionObjectFromInternal(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const builder = INTERNAL_OBJECT_REGISTRY[InternalObjectAdapter.type(raw)]?.toConstruction;
    const out = builder ? builder(raw) : null;
    return out ? copyInternalPresentationToConstruction(raw, out) : null;
  }

  function serializeConstructionScene(sceneLike) {
    const meta = sceneLike?.meta && typeof sceneLike.meta === 'object' && !Array.isArray(sceneLike.meta)
      ? deepClone(sceneLike.meta)
      : { title: 'Escena Geo2D' };
    const viewSource = sceneLike?.viewport;
    const style = sceneLike?.style && typeof sceneLike.style === 'object' && !Array.isArray(sceneLike.style)
      ? deepClone(sceneLike.style)
      : {};
    const objects = Array.isArray(sceneLike?.objects) ? sceneLike.objects : [];

    return {
      version: 2,
      meta,
      view: viewSource && typeof viewSource === 'object' && !Array.isArray(viewSource) ? deepClone(viewSource) : {},
      style,
      objects: objects
        .map(obj => InternalObjectAdapter.toConstruction(obj))
        .filter(Boolean)
    };
  }

  function readConstructionSceneInput(scene) {
    if (!sceneUsesConstructionSchema(scene)) {
      throw new Error('El JSON de Geo2D debe usar el formato de construcción v2 (kind/def).');
    }
    return prepareInternalScene(importConstructionSceneToInternal(scene));
  }

  function readSceneForModel(scene) {
    return sceneUsesConstructionSchema(scene)
      ? readConstructionSceneInput(scene)
      : prepareInternalScene(scene);
  }

  function prepareInternalScene(scene) {
    const out = ensureScene(scene);

    out.version = Math.max(2, Math.floor(safeNumber(out.version, 2)));
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
      throw new Error('El viewport es inválido: xMax debe ser mayor que xMin.');
    }

    if (!(out.viewport.yMax > out.viewport.yMin)) {
      throw new Error('El viewport es inválido: yMax debe ser mayor que yMin.');
    }

    out.style = out.style && typeof out.style === 'object' ? out.style : {};
    out.style.pointRadius = Math.max(1, safeNumber(out.style.pointRadius, 5));
    out.style.pointCaptureRadius = Math.max(out.style.pointRadius, safeNumber(out.style.pointCaptureRadius, 14));
    out.style.strokeWidth = Math.max(1, safeNumber(out.style.strokeWidth, 2));
    out.style.fontSize = Math.max(8, safeNumber(out.style.fontSize, 14));

    return validateScene(out);
  }

  function readSceneInput(scene) {
    return readConstructionSceneInput(scene);
  }

  function serializeSceneForDataAttr(scene) {
    return JSON.stringify(scene)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* =========================================================
     ESCENA
     ========================================================= */
  const DEFAULT_INTERNAL_SCENE = Object.freeze({
    version: 2,
    meta: Object.freeze({ title: 'Escena Geo2D' }),
    viewport: Object.freeze({
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
      showGrid: true,
      showAxes: true,
      lockAspect: true
    }),
    style: Object.freeze({
      pointRadius: 5,
      pointCaptureRadius: 14,
      strokeWidth: 2,
      fontSize: 14
    })
  });

  function mergeSceneSection(defaults, value) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...defaults, ...value }
      : { ...defaults };
  }

  function ensureScene(scene) {
    const source = scene && typeof scene === 'object' && !Array.isArray(scene) ? scene : {};

    return {
      version: DEFAULT_INTERNAL_SCENE.version,
      meta: mergeSceneSection(DEFAULT_INTERNAL_SCENE.meta, source.meta),
      viewport: mergeSceneSection(DEFAULT_INTERNAL_SCENE.viewport, source.viewport),
      style: mergeSceneSection(DEFAULT_INTERNAL_SCENE.style, source.style),
      objects: Array.isArray(source.objects) ? deepClone(source.objects) : []
    };
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
      return readSceneInput(JSON.parse(raw));
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('El contenido no es un JSON válido.');
      }
      throw err;
    }
  }

  function loadSceneFromOptions(options = {}) {
    if (options.scene) return readSceneInput(options.scene);
    if (options.sceneSource) return parseSceneText(readSceneSource(options.sceneSource));
    if (options.target || options.container) {
      const embedded = readEmbeddedSceneAttr(resolveSceneSourceElement(options.target || options.container));
      if (embedded) return parseSceneText(embedded);
    }
    return defaultScene();
  }

  function jsonPretty(obj) {
    return JSON.stringify(obj, null, 2);
  }

  function defaultScene() {
    return ensureScene({
      meta: { title: 'Nueva escena' },
      objects: []
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
  grid-template-columns: 220px 1fr 300px !important;
  min-height: 600px !important;
}
.geo2d-root.geo2d-tools-collapsed .geo2d-body {
  grid-template-columns: 56px 1fr 300px !important;
}
.geo2d-root.geo2d-right-collapsed .geo2d-body {
  grid-template-columns: 220px 1fr 56px !important;
}
.geo2d-root.geo2d-tools-collapsed.geo2d-right-collapsed .geo2d-body {
  grid-template-columns: 56px 1fr 56px !important;
}
.geo2d-root.geo2d-tools-collapsed .geo2d-side {
  padding: 10px !important;
}
.geo2d-root.geo2d-tools-collapsed .geo2d-pane-head strong {
  display: none !important;
}
.geo2d-root.geo2d-right-collapsed .geo2d-right {
  padding: 10px !important;
}
.geo2d-root.geo2d-right-collapsed .geo2d-right .geo2d-section-title {
  display: none !important;
}
@media (max-width: 820px) {
  .geo2d-body { grid-template-columns: 1fr !important; }
  .geo2d-root.geo2d-tools-collapsed .geo2d-body { grid-template-columns: 1fr !important; }
  .geo2d-root.geo2d-right-collapsed .geo2d-body { grid-template-columns: 1fr !important; }
  .geo2d-root.geo2d-tools-collapsed.geo2d-right-collapsed .geo2d-body { grid-template-columns: 1fr !important; }
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

.geo2d-object-group,
.geo2d-list-group {
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
}

.geo2d-object-group-title,
.geo2d-list-title {
  font-size: 12px !important;
  font-weight: bold !important;
  color: #4b5563 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.04em !important;
  margin: 4px 0 2px 0 !important;
}

.geo2d-object-item,
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
  width: 100% !important;
  font-family: Arial, sans-serif !important;
  appearance: none !important;
  text-align: left !important;
}

.geo2d-object-item.is-active,
.geo2d-list-item.active {
  border-color: #7c3aed !important;
  background: rgba(124,58,237,0.08) !important;
}

.geo2d-object-item.is-hidden,
.geo2d-list-item.hidden {
  opacity: 0.6 !important;
}

.geo2d-object-item.is-part {
  padding-left: 18px !important;
  font-size: 12.5px !important;
}

.geo2d-object-state {
  color: #4b5563 !important;
  font-size: 12px !important;
  white-space: nowrap !important;
}

.geo2d-object-empty {
  color: #6b7280 !important;
  font-size: 13px !important;
  padding: 8px 0 !important;
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

.geo2d-prop-area-wrap,
.geo2d-prop-notables-wrap {
  display: none !important;
  border-top: 1px solid #e5e7eb !important;
  padding-top: 10px !important;
  gap: 10px !important;
  flex-direction: column !important;
}

.geo2d-prop-subtitle {
  font-size: 12px !important;
  font-weight: bold !important;
  text-transform: uppercase !important;
  letter-spacing: 0.04em !important;
  color: #4b5563 !important;
}

.geo2d-prop-notables-list {
  display: grid !important;
  gap: 8px !important;
}

.geo2d-notable-row {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto !important;
  align-items: center !important;
  gap: 8px !important;
  border: 1px solid #d7dce3 !important;
  border-radius: 10px !important;
  padding: 8px 10px !important;
  background: #ffffff !important;
}

.geo2d-notable-main {
  border: 0 !important;
  background: transparent !important;
  padding: 0 !important;
  cursor: pointer !important;
  text-align: left !important;
  min-width: 0 !important;
  font-family: Arial, sans-serif !important;
}

.geo2d-notable-main:disabled {
  cursor: default !important;
  opacity: 0.55 !important;
}

.geo2d-notable-role {
  display: block !important;
  font-size: 12px !important;
  color: #4b5563 !important;
}

.geo2d-notable-id {
  display: block !important;
  font-size: 13px !important;
  font-weight: bold !important;
  color: #111827 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

.geo2d-notable-visible {
  white-space: nowrap !important;
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
      .geo2d-pane-head,
      .geo2d-section-head {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 8px !important;
        margin-bottom: 12px !important;
      }
      .geo2d-pane-title {
        font-size: 12px !important;
        font-weight: bold !important;
        text-transform: uppercase !important;
        font-family: Arial, sans-serif !important;
        color: #000000 !important;
        min-width: 0 !important;
      }
      .geo2d-pane-toggle {
        width: 28px !important;
        height: 28px !important;
        border-radius: 8px !important;
        border: 1px solid #d7dce3 !important;
        background: #ffffff !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: Arial, sans-serif !important;
        font-size: 16px !important;
        font-weight: bold !important;
        color: #111827 !important;
        padding: 0 !important;
        line-height: 1 !important;
      }
      .geo2d-pane-toggle:hover {
        background: #f3f4f6 !important;
      }
      .geo2d-section-content {
        display: block !important;
      }
      .geo2d-section-title {
        font-size: 13px !important;
        font-weight: bold !important;
        text-transform: uppercase !important;
        letter-spacing: 0.04em !important;
        color: #111827 !important;
      }
      .geo2d-btn.is-disabled {
        opacity: 0.45 !important;
        pointer-events: none !important;
      }
      .geo2d-toolgrid {
        display: grid !important;
        gap: 8px !important;
      }
      .geo2d-toolgroup {
        background: #ffffff !important;
        border: 1px solid #d7dce3 !important;
        border-radius: 10px !important;
        overflow: hidden !important;
      }
      .geo2d-toolgroup-head {
        width: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 8px !important;
        padding: 11px 12px !important;
        border: none !important;
        cursor: pointer !important;
        background: #eef2f7 !important;
        text-align: left !important;
        color: #111827 !important;
        font-weight: bold !important;
        letter-spacing: 0.03em !important;
      }
      .geo2d-toolgroup.is-open .geo2d-toolgroup-head {
        background: #111827 !important;
        color: #ffffff !important;
      }
      .geo2d-toolgroup-icon {
        min-width: 18px !important;
        text-align: center !important;
        font-size: 16px !important;
        font-weight: bold !important;
        color: #4b5563 !important;
      }
      .geo2d-toolgroup.is-open .geo2d-toolgroup-icon {
        color: #ffffff !important;
      }
      .geo2d-toolgroup-items {
        display: none !important;
        gap: 6px !important;
        padding: 8px !important;
        background: #ffffff !important;
      }
      .geo2d-toolbtn {
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
        padding: 10px 12px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: 0.1s !important;
        border: 1px solid transparent !important;
        background: #ffffff !important;
        color: #111827 !important;
        font: inherit !important;
        text-align: left !important;
        appearance: none !important;
      }
      .geo2d-toolbtn:hover,
      .geo2d-toolbtn:focus-visible {
        background: #fff7ed !important;
        border-color: #fdba74 !important;
        outline: none !important;
      }
      .geo2d-toolbtn.is-active {
        background: #f45113 !important;
        border-color: #f45113 !important;
        color: #ffffff !important;
        font-weight: bold !important;
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
      .geo2d-hidden {
        display: none !important;
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

  function getRenderableViewport(vp, w, h) {
    if (!vp || !vp.lockAspect || !(w > 0) || !(h > 0)) return vp;

    const spanX = vp.xMax - vp.xMin;
    const spanY = vp.yMax - vp.yMin;
    if (!(spanX > 1e-9) || !(spanY > 1e-9)) return vp;

    const viewportAspect = w / h;
    const worldAspect = spanX / spanY;
    const cx = (vp.xMin + vp.xMax) / 2;
    const cy = (vp.yMin + vp.yMax) / 2;

    if (viewportAspect > worldAspect + 1e-9) {
      const halfY = spanY / 2;
      const halfX = halfY * viewportAspect;
      return {
        ...vp,
        xMin: cx - halfX,
        xMax: cx + halfX
      };
    }

    if (viewportAspect < worldAspect - 1e-9) {
      const halfX = spanX / 2;
      const halfY = halfX / viewportAspect;
      return {
        ...vp,
        yMin: cy - halfY,
        yMax: cy + halfY
      };
    }

    return vp;
  }

  function getViewTransform(vp, w, h) {
    const renderVp = getRenderableViewport(vp, w, h);
    const spanX = renderVp.xMax - renderVp.xMin;
    const spanY = renderVp.yMax - renderVp.yMin;

    return {
      scaleX: w / spanX,
      scaleY: h / spanY,
      offsetX: 0,
      offsetY: 0,
      uniform: !!vp.lockAspect,
      view: renderVp
    };
  }

  function getDrawableRect(vp, w, h) {
    return {
      x: 0,
      y: 0,
      width: w,
      height: h
    };
  }

  function worldToScreen(vp, w, h, x, y) {
    const t = getViewTransform(vp, w, h);
    const view = t.view || vp;
    return {
      x: t.offsetX + (x - view.xMin) * t.scaleX,
      y: h - t.offsetY - (y - view.yMin) * t.scaleY
    };
  }

  function screenToWorld(vp, w, h, sx, sy) {
    const t = getViewTransform(vp, w, h);
    const view = t.view || vp;
    return {
      x: view.xMin + (sx - t.offsetX) / t.scaleX,
      y: view.yMin + ((h - t.offsetY) - sy) / t.scaleY
    };
  }

  function viewportZoomAt(vp, factor, cx, cy) {
    if (!vp) return vp;

    const spanX = safeNumber(vp.xMax, 10) - safeNumber(vp.xMin, -10);
    const spanY = safeNumber(vp.yMax, 10) - safeNumber(vp.yMin, -10);
    if (!(spanX > 1e-12) || !(spanY > 1e-12)) return vp;

    const minFactor = Math.max(MIN_VIEWPORT_SPAN / spanX, MIN_VIEWPORT_SPAN / spanY);
    const maxFactor = Math.min(MAX_VIEWPORT_SPAN / spanX, MAX_VIEWPORT_SPAN / spanY);
    if (!(maxFactor >= minFactor)) return vp;

    const zoomFactor = clamp(safeNumber(factor, 1), minFactor, maxFactor);
    const anchorX = safeNumber(cx, (vp.xMin + vp.xMax) / 2);
    const anchorY = safeNumber(cy, (vp.yMin + vp.yMax) / 2);

    return {
      ...vp,
      xMin: anchorX + (vp.xMin - anchorX) * zoomFactor,
      xMax: anchorX + (vp.xMax - anchorX) * zoomFactor,
      yMin: anchorY + (vp.yMin - anchorY) * zoomFactor,
      yMax: anchorY + (vp.yMax - anchorY) * zoomFactor
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

  function resolveEllipseGeometryFromPoints(center, vertex, coVertex) {
    if (!center || !vertex || !coVertex) return null;

    const axisX = {
      x: vertex.x - center.x,
      y: vertex.y - center.y
    };
    const axisY = {
      x: coVertex.x - center.x,
      y: coVertex.y - center.y
    };
    const rx = Math.hypot(axisX.x, axisX.y);
    const ry = Math.hypot(axisY.x, axisY.y);
    const determinant = cross2(axisX.x, axisX.y, axisY.x, axisY.y);
    if (!(rx > 1e-9) || !(ry > 1e-9) || Math.abs(determinant) <= 1e-9) return null;

    const rotation = Math.atan2(axisX.y, axisX.x);
    const antiVertex = {
      x: center.x * 2 - vertex.x,
      y: center.y * 2 - vertex.y
    };
    const antiCoVertex = {
      x: center.x * 2 - coVertex.x,
      y: center.y * 2 - coVertex.y
    };

    return {
      center,
      vertex,
      coVertex,
      antiVertex,
      antiCoVertex,
      axisX,
      axisY,
      determinant,
      rx,
      ry,
      rotation
    };
  }

  function resolveEllipseDerivedPoint(ellipseResolved, role) {
    if (!ellipseResolved || ellipseResolved.kind !== 'ellipse') return null;
    if (role === 'antiVertex') return ellipseResolved.antiVertex || null;
    if (role === 'antiCoVertex') return ellipseResolved.antiCoVertex || null;
    return null;
  }

  function ellipsePointFromResolved(resolved, angle) {
    if (!resolved || !resolved.center) return null;

    if (resolved.axisX && resolved.axisY) {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      return {
        x: resolved.center.x + resolved.axisX.x * cosA + resolved.axisY.x * sinA,
        y: resolved.center.y + resolved.axisX.y * cosA + resolved.axisY.y * sinA
      };
    }

    return ellipsePoint(
      resolved.center,
      safeNumber(resolved.rx, 1),
      safeNumber(resolved.ry, 1),
      safeNumber(resolved.rotation, 0),
      angle
    );
  }

  function ellipseUnitLocalFromWorld(resolved, x, y) {
    if (!resolved || !resolved.center) return null;

    if (resolved.axisX && resolved.axisY) {
      const det = cross2(resolved.axisX.x, resolved.axisX.y, resolved.axisY.x, resolved.axisY.y);
      if (Math.abs(det) <= 1e-12) return null;

      const dx = x - resolved.center.x;
      const dy = y - resolved.center.y;
      return {
        x: cross2(dx, dy, resolved.axisY.x, resolved.axisY.y) / det,
        y: cross2(resolved.axisX.x, resolved.axisX.y, dx, dy) / det
      };
    }

    const local = ellipseLocalCoordinates(resolved.center, safeNumber(resolved.rotation, 0), x, y);
    return {
      x: local.x / Math.max(Math.abs(safeNumber(resolved.rx, 1)), 1e-9),
      y: local.y / Math.max(Math.abs(safeNumber(resolved.ry, 1)), 1e-9)
    };
  }

  function ellipseDirectionUnitLocal(resolved, dx, dy) {
    if (!resolved) return null;

    if (resolved.axisX && resolved.axisY) {
      const det = cross2(resolved.axisX.x, resolved.axisX.y, resolved.axisY.x, resolved.axisY.y);
      if (Math.abs(det) <= 1e-12) return null;

      return {
        x: cross2(dx, dy, resolved.axisY.x, resolved.axisY.y) / det,
        y: cross2(resolved.axisX.x, resolved.axisX.y, dx, dy) / det
      };
    }

    const local = ellipseLocalCoordinates({ x: 0, y: 0 }, safeNumber(resolved.rotation, 0), dx, dy);
    return {
      x: local.x / Math.max(Math.abs(safeNumber(resolved.rx, 1)), 1e-9),
      y: local.y / Math.max(Math.abs(safeNumber(resolved.ry, 1)), 1e-9)
    };
  }

  function ellipseAngleFromResolved(resolved, x, y) {
    const local = ellipseUnitLocalFromWorld(resolved, x, y);
    if (!local) return 0;
    return Math.atan2(local.y, local.x);
  }

  function ellipseWorldPointsFromResolved(resolved, steps = 72) {
    const points = [];
    const count = Math.max(12, Math.floor(steps));

    for (let i = 0; i < count; i++) {
      const point = ellipsePointFromResolved(resolved, (i / count) * Math.PI * 2);
      if (point) points.push(point);
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

  function pointInScreenPolygon(sx, sy, points) {
    if (!points || points.length < 3) return false;
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;
      const intersects = ((yi > sy) !== (yj > sy)) &&
        (sx < ((xj - xi) * (sy - yi)) / ((yj - yi) || 1e-12) + xi);
      if (intersects) inside = !inside;
    }

    return inside;
  }

  function ellipseScreenPoints(vp, w, h, resolved, steps = 72) {
    return ellipseWorldPointsFromResolved(resolved, steps)
      .map(p => worldToScreen(vp, w, h, p.x, p.y));
  }

  function isLinearResolvedKind(kind) {
    return kind === 'segment' || kind === 'line' || kind === 'ray';
  }

  function isSegmentChainResolvedKind(kind) {
    return kind === 'polyline' || kind === 'polygon';
  }

  function normalizeEdgeIndex(value) {
    if (value === undefined || value === null || value === '') return null;
    const index = Math.floor(safeNumber(value, NaN));
    return Number.isFinite(index) ? index : null;
  }

  function isCurveResolvedKind(kind) {
    return kind === 'circle' || kind === 'ellipse';
  }

  function isHitTestDirectionalResolvedKind(kind) {
    return isLinearResolvedKind(kind) || isSegmentChainResolvedKind(kind);
  }

  function isHitTestIntersectableResolvedKind(kind) {
    return isHitTestDirectionalResolvedKind(kind) || isCurveResolvedKind(kind);
  }

  function cross2(ax, ay, bx, by) {
    return ax * by - ay * bx;
  }

  function isParamWithinRange(t, min, max, tol = 1e-9) {
    return t >= min - tol && t <= max + tol;
  }

  function linearResolvedToParametric(resolved) {
    if (!resolved || !isLinearResolvedKind(resolved.kind)) return null;
    const dx = resolved.p2.x - resolved.p1.x;
    const dy = resolved.p2.y - resolved.p1.y;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;

    return {
      p: resolved.p1,
      dx,
      dy,
      tMin: resolved.kind === 'segment' ? 0 : 0,
      tMax: resolved.kind === 'segment' ? 1 : Infinity,
      unboundedNegative: resolved.kind === 'line'
    };
  }

  function resolvedToBoundarySegments(resolved) {
    if (!resolved || !isSegmentChainResolvedKind(resolved.kind) || !Array.isArray(resolved.points)) return [];
    const points = resolved.points;
    if (points.length < 2) return [];
    const segments = [];
    const limit = resolved.kind === 'polygon' ? points.length : points.length - 1;

    for (let i = 0; i < limit; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      if (!p1 || !p2) continue;
      if (dist2(p1.x, p1.y, p2.x, p2.y) < 1e-18) continue;
      segments.push({
        kind: 'segment',
        p1,
        p2,
        ref: resolved.ref
      });
    }

    return segments;
  }

  function resolveSegmentLikeReference(resolved, edgeIndex = null) {
    if (!resolved) return null;
    if (resolved.kind === 'segment') return resolved;
    if (!isSegmentChainResolvedKind(resolved.kind)) return null;

    const normalizedEdgeIndex = normalizeEdgeIndex(edgeIndex);
    if (normalizedEdgeIndex === null) return null;

    const segments = resolvedToBoundarySegments(resolved);
    if (normalizedEdgeIndex < 0 || normalizedEdgeIndex >= segments.length) return null;
    return {
      ...segments[normalizedEdgeIndex],
      parentKind: resolved.kind,
      edgeIndex: normalizedEdgeIndex
    };
  }

  function dedupeWorldPoints(points, tol = 1e-7) {
    const out = [];
    for (const point of points || []) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      if (out.some(other => dist2(point.x, point.y, other.x, other.y) <= tol * tol)) continue;
      out.push({ x: point.x, y: point.y });
    }
    return out;
  }

  function sortWorldPoints(points) {
    return [...(points || [])].sort((a, b) => {
      if (Math.abs(a.x - b.x) > 1e-7) return a.x - b.x;
      return a.y - b.y;
    });
  }

  function circleWorldPoints(center, radius, steps = 144) {
    const points = [];
    const count = Math.max(24, Math.floor(steps));

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      });
    }

    return points;
  }

  function segmentIntersectionPointWorld(a1, a2, b1, b2) {
    const rx = a2.x - a1.x;
    const ry = a2.y - a1.y;
    const sx = b2.x - b1.x;
    const sy = b2.y - b1.y;
    const denom = cross2(rx, ry, sx, sy);
    const qpx = b1.x - a1.x;
    const qpy = b1.y - a1.y;

    if (Math.abs(denom) < 1e-9) return null;

    const t = cross2(qpx, qpy, sx, sy) / denom;
    const u = cross2(qpx, qpy, rx, ry) / denom;

    if (!isParamWithinRange(t, 0, 1) || !isParamWithinRange(u, 0, 1)) return null;

    return {
      x: a1.x + t * rx,
      y: a1.y + t * ry
    };
  }

  function closedPolylineIntersections(pointsA, pointsB) {
    const hits = [];
    if (!pointsA || !pointsB || pointsA.length < 2 || pointsB.length < 2) return hits;

    for (let i = 0; i < pointsA.length; i++) {
      const a1 = pointsA[i];
      const a2 = pointsA[(i + 1) % pointsA.length];

      for (let j = 0; j < pointsB.length; j++) {
        const b1 = pointsB[j];
        const b2 = pointsB[(j + 1) % pointsB.length];
        const hit = segmentIntersectionPointWorld(a1, a2, b1, b2);
        if (hit) hits.push(hit);
      }
    }

    return dedupeWorldPoints(hits, 1e-4);
  }

  function linearLinearIntersections(resolvedA, resolvedB) {
    const a = linearResolvedToParametric(resolvedA);
    const b = linearResolvedToParametric(resolvedB);
    if (!a || !b) return [];

    const denom = cross2(a.dx, a.dy, b.dx, b.dy);
    const qpx = b.p.x - a.p.x;
    const qpy = b.p.y - a.p.y;
    if (Math.abs(denom) < 1e-9) return [];

    const ta = cross2(qpx, qpy, b.dx, b.dy) / denom;
    const tb = cross2(qpx, qpy, a.dx, a.dy) / denom;

    const aMin = a.unboundedNegative ? -Infinity : a.tMin;
    const bMin = b.unboundedNegative ? -Infinity : b.tMin;

    if (!isParamWithinRange(ta, aMin, a.tMax) || !isParamWithinRange(tb, bMin, b.tMax)) {
      return [];
    }

    return [{
      x: a.p.x + ta * a.dx,
      y: a.p.y + ta * a.dy
    }];
  }

  function linearCircleIntersections(lineResolved, circleResolved) {
    const line = linearResolvedToParametric(lineResolved);
    if (!line || !circleResolved || circleResolved.kind !== 'circle') return [];

    const fx = line.p.x - circleResolved.center.x;
    const fy = line.p.y - circleResolved.center.y;
    const a = line.dx * line.dx + line.dy * line.dy;
    const b = 2 * (fx * line.dx + fy * line.dy);
    const c = fx * fx + fy * fy - circleResolved.radius * circleResolved.radius;
    const disc = b * b - 4 * a * c;
    if (disc < -1e-9) return [];

    const hits = [];
    const sqrtDisc = Math.sqrt(Math.max(0, disc));
    const values = Math.abs(sqrtDisc) < 1e-9
      ? [(-b) / (2 * a)]
      : [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)];

    const min = line.unboundedNegative ? -Infinity : line.tMin;
    for (const t of values) {
      if (!isParamWithinRange(t, min, line.tMax)) continue;
      hits.push({
        x: line.p.x + t * line.dx,
        y: line.p.y + t * line.dy
      });
    }

    return dedupeWorldPoints(hits);
  }

  function linearEllipseIntersections(lineResolved, ellipseResolved) {
    const line = linearResolvedToParametric(lineResolved);
    if (!line || !ellipseResolved || ellipseResolved.kind !== 'ellipse') return [];

    const origin = ellipseUnitLocalFromWorld(ellipseResolved, line.p.x, line.p.y);
    const direction = ellipseDirectionUnitLocal(ellipseResolved, line.dx, line.dy);
    if (!origin || !direction) return [];

    const a = direction.x * direction.x + direction.y * direction.y;
    const b = 2 * (origin.x * direction.x + origin.y * direction.y);
    const c = origin.x * origin.x + origin.y * origin.y - 1;
    const disc = b * b - 4 * a * c;
    if (disc < -1e-9) return [];

    const hits = [];
    const sqrtDisc = Math.sqrt(Math.max(0, disc));
    const values = Math.abs(sqrtDisc) < 1e-9
      ? [(-b) / (2 * a)]
      : [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)];

    const min = line.unboundedNegative ? -Infinity : line.tMin;
    for (const t of values) {
      if (!isParamWithinRange(t, min, line.tMax)) continue;
      hits.push({
        x: line.p.x + t * line.dx,
        y: line.p.y + t * line.dy
      });
    }

    return dedupeWorldPoints(hits);
  }

  function circleCircleIntersections(circleA, circleB) {
    if (!circleA || !circleB || circleA.kind !== 'circle' || circleB.kind !== 'circle') return [];

    const dx = circleB.center.x - circleA.center.x;
    const dy = circleB.center.y - circleA.center.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const r0 = circleA.radius;
    const r1 = circleB.radius;

    if (d < 1e-9 && Math.abs(r0 - r1) < 1e-9) return [];
    if (d > r0 + r1 + 1e-9) return [];
    if (d < Math.abs(r0 - r1) - 1e-9) return [];
    if (d < 1e-9) return [];

    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h2 = r0 * r0 - a * a;
    if (h2 < -1e-9) return [];

    const h = Math.sqrt(Math.max(0, h2));
    const xm = circleA.center.x + (a * dx) / d;
    const ym = circleA.center.y + (a * dy) / d;
    const rx = -dy * (h / d);
    const ry = dx * (h / d);

    if (h < 1e-9) {
      return [{ x: xm, y: ym }];
    }

    return dedupeWorldPoints([
      { x: xm + rx, y: ym + ry },
      { x: xm - rx, y: ym - ry }
    ]);
  }

  function curveCurveApproxIntersections(resolvedA, resolvedB) {
    const pointsA = resolvedA.kind === 'circle'
      ? circleWorldPoints(resolvedA.center, resolvedA.radius, 240)
      : ellipseWorldPointsFromResolved(resolvedA, 240);

    const pointsB = resolvedB.kind === 'circle'
      ? circleWorldPoints(resolvedB.center, resolvedB.radius, 240)
      : ellipseWorldPointsFromResolved(resolvedB, 240);

    return closedPolylineIntersections(pointsA, pointsB);
  }

  function segmentChainIntersections(chainResolved, otherResolved, options = {}) {
    const edgeIndex = normalizeEdgeIndex(options.edgeIndex);
    const segments = edgeIndex === null
      ? resolvedToBoundarySegments(chainResolved)
      : [resolveSegmentLikeReference(chainResolved, edgeIndex)].filter(Boolean);
    if (!segments.length || !otherResolved) return [];

    const otherEdgeIndex = normalizeEdgeIndex(options.otherEdgeIndex);

    const hits = [];
    for (const segment of segments) {
      if (isLinearResolvedKind(otherResolved.kind)) {
        hits.push(...linearLinearIntersections(segment, otherResolved));
      } else if (otherResolved.kind === 'circle') {
        hits.push(...linearCircleIntersections(segment, otherResolved));
      } else if (otherResolved.kind === 'ellipse') {
        hits.push(...linearEllipseIntersections(segment, otherResolved));
      } else if (isSegmentChainResolvedKind(otherResolved.kind)) {
        const otherSegments = otherEdgeIndex === null
          ? resolvedToBoundarySegments(otherResolved)
          : [resolveSegmentLikeReference(otherResolved, otherEdgeIndex)].filter(Boolean);
        for (const otherSegment of otherSegments) {
          const hit = segmentIntersectionPointWorld(segment.p1, segment.p2, otherSegment.p1, otherSegment.p2);
          if (hit) hits.push(hit);
        }
      }
    }

    return dedupeWorldPoints(hits);
  }

  function normalizeIntersectionHits(hits) {
    return sortWorldPoints(dedupeWorldPoints(hits));
  }

  function resolveRestrictedSegmentIntersections(resolvedA, resolvedB, restrictedA, restrictedB) {
    if (restrictedA && isLinearResolvedKind(resolvedB.kind)) {
      return linearLinearIntersections(restrictedA, resolvedB);
    }

    if (restrictedB && isLinearResolvedKind(resolvedA.kind)) {
      return linearLinearIntersections(resolvedA, restrictedB);
    }

    if (restrictedA && resolvedB.kind === 'circle') {
      return linearCircleIntersections(restrictedA, resolvedB);
    }

    if (restrictedB && resolvedA.kind === 'circle') {
      return linearCircleIntersections(restrictedB, resolvedA);
    }

    if (restrictedA && resolvedB.kind === 'ellipse') {
      return linearEllipseIntersections(restrictedA, resolvedB);
    }

    if (restrictedB && resolvedA.kind === 'ellipse') {
      return linearEllipseIntersections(restrictedB, resolvedA);
    }

    if (restrictedA && restrictedB) {
      const hit = segmentIntersectionPointWorld(restrictedA.p1, restrictedA.p2, restrictedB.p1, restrictedB.p2);
      return hit ? [hit] : [];
    }

    return null;
  }

  function resolveLinearFamilyIntersections(resolvedA, resolvedB, edgeIndexA, edgeIndexB) {
    if (isLinearResolvedKind(resolvedA.kind) && isLinearResolvedKind(resolvedB.kind)) {
      return linearLinearIntersections(resolvedA, resolvedB);
    }

    if (isSegmentChainResolvedKind(resolvedA.kind) && isLinearResolvedKind(resolvedB.kind)) {
      return segmentChainIntersections(resolvedA, resolvedB, { edgeIndex: edgeIndexA });
    }

    if (isSegmentChainResolvedKind(resolvedB.kind) && isLinearResolvedKind(resolvedA.kind)) {
      return segmentChainIntersections(resolvedB, resolvedA, { edgeIndex: edgeIndexB });
    }

    return null;
  }

  function resolveCircleFamilyIntersections(resolvedA, resolvedB, edgeIndexA, edgeIndexB) {
    if (isLinearResolvedKind(resolvedA.kind) && resolvedB.kind === 'circle') {
      return linearCircleIntersections(resolvedA, resolvedB);
    }

    if (isLinearResolvedKind(resolvedB.kind) && resolvedA.kind === 'circle') {
      return linearCircleIntersections(resolvedB, resolvedA);
    }

    if (isSegmentChainResolvedKind(resolvedA.kind) && resolvedB.kind === 'circle') {
      return segmentChainIntersections(resolvedA, resolvedB, { edgeIndex: edgeIndexA });
    }

    if (isSegmentChainResolvedKind(resolvedB.kind) && resolvedA.kind === 'circle') {
      return segmentChainIntersections(resolvedB, resolvedA, { edgeIndex: edgeIndexB });
    }

    if (resolvedA.kind === 'circle' && resolvedB.kind === 'circle') {
      return circleCircleIntersections(resolvedA, resolvedB);
    }

    return null;
  }

  function resolveEllipseFamilyIntersections(resolvedA, resolvedB, edgeIndexA, edgeIndexB) {
    if (isLinearResolvedKind(resolvedA.kind) && resolvedB.kind === 'ellipse') {
      return linearEllipseIntersections(resolvedA, resolvedB);
    }

    if (isLinearResolvedKind(resolvedB.kind) && resolvedA.kind === 'ellipse') {
      return linearEllipseIntersections(resolvedB, resolvedA);
    }

    if (isSegmentChainResolvedKind(resolvedA.kind) && resolvedB.kind === 'ellipse') {
      return segmentChainIntersections(resolvedA, resolvedB, { edgeIndex: edgeIndexA });
    }

    if (isSegmentChainResolvedKind(resolvedB.kind) && resolvedA.kind === 'ellipse') {
      return segmentChainIntersections(resolvedB, resolvedA, { edgeIndex: edgeIndexB });
    }

    return null;
  }

  function resolveSegmentChainFamilyIntersections(resolvedA, resolvedB, edgeIndexA, edgeIndexB) {
    if (isSegmentChainResolvedKind(resolvedA.kind) && isSegmentChainResolvedKind(resolvedB.kind)) {
      return segmentChainIntersections(resolvedA, resolvedB, {
        edgeIndex: edgeIndexA,
        otherEdgeIndex: edgeIndexB
      });
    }

    return null;
  }

  function resolveCurveFamilyIntersections(resolvedA, resolvedB) {
    if (isCurveResolvedKind(resolvedA.kind) && isCurveResolvedKind(resolvedB.kind)) {
      return curveCurveApproxIntersections(resolvedA, resolvedB);
    }

    return null;
  }

  const INTERSECTION_RESOLVERS = Object.freeze([
    context => resolveRestrictedSegmentIntersections(
      context.resolvedA,
      context.resolvedB,
      context.restrictedA,
      context.restrictedB
    ),
    context => resolveLinearFamilyIntersections(
      context.resolvedA,
      context.resolvedB,
      context.edgeIndexA,
      context.edgeIndexB
    ),
    context => resolveCircleFamilyIntersections(
      context.resolvedA,
      context.resolvedB,
      context.edgeIndexA,
      context.edgeIndexB
    ),
    context => resolveEllipseFamilyIntersections(
      context.resolvedA,
      context.resolvedB,
      context.edgeIndexA,
      context.edgeIndexB
    ),
    context => resolveSegmentChainFamilyIntersections(
      context.resolvedA,
      context.resolvedB,
      context.edgeIndexA,
      context.edgeIndexB
    ),
    context => resolveCurveFamilyIntersections(context.resolvedA, context.resolvedB)
  ]);

  function runIntersectionResolvers(context) {
    for (const resolveIntersections of INTERSECTION_RESOLVERS) {
      const hits = resolveIntersections(context);
      if (hits !== null && hits !== undefined) return hits;
    }

    return [];
  }

  function resolveObjectIntersections(resolvedA, resolvedB, options = {}) {
    if (!resolvedA || !resolvedB) return [];

    const edgeIndexA = normalizeEdgeIndex(options.edgeIndexA);
    const edgeIndexB = normalizeEdgeIndex(options.edgeIndexB);
    const restrictedA = resolveSegmentLikeReference(resolvedA, edgeIndexA);
    const restrictedB = resolveSegmentLikeReference(resolvedB, edgeIndexB);

    return normalizeIntersectionHits(
      runIntersectionResolvers({
        resolvedA,
        resolvedB,
        edgeIndexA,
        edgeIndexB,
        restrictedA,
        restrictedB
      })
    );
  }

  function pickClosestWorldPoint(points, target) {
    if (!points || !points.length) return null;
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return points[0];

    let best = points[0];
    let bestD2 = dist2(points[0].x, points[0].y, target.x, target.y);

    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const d2 = dist2(point.x, point.y, target.x, target.y);
      if (d2 < bestD2) {
        best = point;
        bestD2 = d2;
      }
    }

    return best;
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
      this.raw.edgeIndex = normalizeEdgeIndex(this.raw.edgeIndex);
    }

    resolve(model) {
      const parent = model.getResolvedObject(this.objectId);
      const segment = resolveSegmentLikeReference(parent, this.raw.edgeIndex);
      if (!segment) return null;

      const t = clamp(safeNumber(this.raw.t, 0.5), 0, 1);
      return pointFromParameter(segment.p1.x, segment.p1.y, segment.p2.x, segment.p2.y, t);
    }

    project(model, x, y) {
      const parent = model.getResolvedObject(this.objectId);
      const segment = resolveSegmentLikeReference(parent, this.raw.edgeIndex);
      if (!segment) return;

      this.raw.t = projectParameter(segment.p1.x, segment.p1.y, segment.p2.x, segment.p2.y, x, y, true);
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

      return ellipsePointFromResolved(parent, safeNumber(this.raw.angle, 0));
    }

    project(model, x, y) {
      const parent = model.getResolvedObject(this.objectId);
      if (!parent || parent.kind !== 'ellipse') return;

      this.raw.angle = ellipseAngleFromResolved(parent, x, y);
    }
  }

  class IntersectionConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'intersection';
      this.raw.objectId = String(this.raw.objectId || '').trim();
      this.raw.objectId2 = String(this.raw.objectId2 || '').trim();
      this.raw.edgeIndex = normalizeEdgeIndex(this.raw.edgeIndex);
      this.raw.edgeIndex2 = normalizeEdgeIndex(this.raw.edgeIndex2);
      this.raw.pickX = safeNumber(this.raw.pickX, 0);
      this.raw.pickY = safeNumber(this.raw.pickY, 0);
    }

    getRefs() {
      return [this.raw.objectId, this.raw.objectId2].filter(Boolean);
    }

    resolve(model) {
      const first = model.getResolvedObject(this.raw.objectId);
      const second = model.getResolvedObject(this.raw.objectId2);
      if (!first || !second) return null;

      const hits = resolveObjectIntersections(first, second, {
        edgeIndexA: this.raw.edgeIndex,
        edgeIndexB: this.raw.edgeIndex2
      });
      if (!hits.length) return null;

      return pickClosestWorldPoint(hits, {
        x: safeNumber(this.raw.pickX, 0),
        y: safeNumber(this.raw.pickY, 0)
      });
    }

    project() {}
  }

  class VectorEndConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'vector-end';
      this.raw.objectId = String(this.raw.objectId || '').trim();
    }

    resolve(model) {
      const vector = model.getResolvedObject(this.raw.objectId);
      if (!vector || vector.kind !== 'vector') return null;
      return {
        x: vector.p2.x,
        y: vector.p2.y
      };
    }

    project() {}
  }

  class EllipseDerivedPointConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'ellipse-derived-point';
      this.raw.objectId = String(this.raw.objectId || '').trim();
      this.raw.role = String(this.raw.role || '').trim();
    }

    resolve(model) {
      const ellipse = model.getResolvedObject(this.raw.objectId);
      return resolveEllipseDerivedPoint(ellipse, this.raw.role);
    }

    project() {}
  }

  const CONSTRAINT_CLASS_REGISTRY = Object.freeze({
    'on-segment': OnSegmentConstraint,
    'on-line': OnLineConstraint,
    'on-ray': OnRayConstraint,
    'on-circle': OnCircleConstraint,
    'on-ellipse': OnEllipseConstraint,
    intersection: IntersectionConstraint,
    'vector-end': VectorEndConstraint,
    'ellipse-derived-point': EllipseDerivedPointConstraint
  });

  class ConstraintFactory {
    static fromRaw(raw) {
      if (!raw || !raw.kind) return null;

      const ConstraintClass = CONSTRAINT_CLASS_REGISTRY[String(raw.kind || '').trim()];
      return new (ConstraintClass || Constraint)(raw);
    }
  }

  /* =========================================================
     POO - OBJETOS GEOMÉTRICOS
     ========================================================= */
  class GeoObject {
    constructor(raw = {}) {
      this.raw = deepClone(raw || {});
      this.id = this.raw.id || '';
      this.type = InternalObjectAdapter.type(this.raw);
    }

    isVisible() {
      return InternalObjectAdapter.isVisible(this.raw);
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
      return null;
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

  class VectorObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'vector';
    }

    getRefs() {
      return [this.raw.p1, this.raw.p2].filter(Boolean);
    }

    getResolved(model) {
      const p1 = model.getPointPosition(this.raw.p1);
      const p2 = model.getPointPosition(this.raw.p2);
      if (!p1 || !p2) return null;
      return { kind: 'vector', p1, p2, ref: this };
    }
  }

  class EquipollentVectorObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'equipollent-vector';
    }

    getRefs() {
      return [this.raw.point, this.raw.vectorId].filter(Boolean);
    }

    getResolved(model) {
      const start = model.getPointPosition(this.raw.point);
      const base = model.getResolvedObject(this.raw.vectorId);
      if (!start || !base || base.kind !== 'vector') return null;

      const dx = base.p2.x - base.p1.x;
      const dy = base.p2.y - base.p1.y;
      return {
        kind: 'vector',
        p1: start,
        p2: { x: start.x + dx, y: start.y + dy },
        ref: this
      };
    }
  }

  class DerivedLineObject extends GeoObject {
    getRefs() {
      return [this.raw.point, this.raw.objectId].filter(Boolean);
    }

    getBaseDirection(model) {
      const point = model.getPointPosition(this.raw.point);
      const base = model.getResolvedObject(this.raw.objectId);
      const segmentLike = resolveSegmentLikeReference(base, this.raw.edgeIndex);
      const directionalBase = segmentLike || base;
      if (!point || !directionalBase || !['segment', 'line', 'ray'].includes(directionalBase.kind)) return null;

      const dx = directionalBase.p2.x - directionalBase.p1.x;
      const dy = directionalBase.p2.y - directionalBase.p1.y;
      if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;

      return { point, dx, dy };
    }
  }

  class ParallelLineObject extends DerivedLineObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'parallel-line';
    }

    getResolved(model) {
      const info = this.getBaseDirection(model);
      if (!info) return null;
      return {
        kind: 'line',
        p1: info.point,
        p2: { x: info.point.x + info.dx, y: info.point.y + info.dy },
        ref: this
      };
    }
  }

  class PerpendicularLineObject extends DerivedLineObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'perpendicular-line';
    }

    getResolved(model) {
      const info = this.getBaseDirection(model);
      if (!info) return null;
      return {
        kind: 'line',
        p1: info.point,
        p2: { x: info.point.x - info.dy, y: info.point.y + info.dx },
        ref: this
      };
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

  class CircleRadiusObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'circle-radius';
    }

    getRefs() {
      return [this.raw.center].filter(Boolean);
    }

    getResolved(model) {
      const center = model.getPointPosition(this.raw.center);
      if (!center) return null;

      return {
        kind: 'circle',
        center,
        radius: Math.max(1e-9, safeNumber(this.raw.radius, 1)),
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
      return getEllipseRawObjectRefs(this.raw);
    }

    getResolved(model) {
      const center = model.getPointPosition(this.raw.center);
      const vertex = model.getPointPosition(this.raw.vertex);
      const coVertex = model.getPointPosition(this.raw.coVertex);
      const geometry = resolveEllipseGeometryFromPoints(center, vertex, coVertex);
      if (!geometry) return null;

      return {
        kind: 'ellipse',
        ...geometry,
        ref: this
      };
    }
  }

  class PolylineObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'polyline';
    }

    getRefs() {
      return Array.isArray(this.raw.points) ? [...this.raw.points] : [];
    }

    getResolved(model) {
      const points = (this.raw.points || []).map(id => model.getPointPosition(id)).filter(Boolean);
      if (points.length < 2) return null;
      return { kind: 'polyline', points, ref: this };
    }
  }

  class PolygonObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'polygon';
      normalizePolygonParts(this.raw);
    }

    getRefs() {
      return Array.isArray(this.raw.points) ? [...this.raw.points] : [];
    }

    getEdgeRefs(edgeIndex) {
      return getPolygonEdgePointIds(this.raw, edgeIndex);
    }

    getResolved(model) {
      const points = (this.raw.points || []).map(id => model.getPointPosition(id)).filter(Boolean);
      if (points.length < 3) return null;
      normalizePolygonParts(this.raw);
      return {
        kind: 'polygon',
        points,
        fillVisible: isPolygonFillVisible(this.raw),
        edgeVisibility: this.raw.parts.edges.map(edge => edge.visible !== false),
        ref: this
      };
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

  const INTERNAL_OBJECT_REGISTRY = Object.freeze({
    point: Object.freeze({
      create: raw => (raw.constraint ? new ConstrainedPoint(raw) : new FreePoint(raw)),
      toConstruction: buildPointConstruction,
      validate: validatePointObject,
      refs: getPointRawObjectRefs,
      typeLabel: raw => (raw.constraint ? 'Punto dependiente' : 'Punto'),
      describeRefs: describePointRefs,
      group: 'points',
      families: Object.freeze(['pointLike'])
    }),
    midpoint: Object.freeze({
      create: raw => new MidpointPoint(raw),
      toConstruction: buildMidpointConstruction,
      validate: validateMidpointObject,
      refs: getTwoPointRawObjectRefs,
      typeLabel: 'Punto medio',
      describeRefs: describeMidpointRefs,
      group: 'points',
      families: Object.freeze(['pointLike'])
    }),
    segment: Object.freeze({
      create: raw => new SegmentObject(raw),
      toConstruction: buildSegmentConstruction,
      validate: validateTwoPointObject,
      refs: getTwoPointRawObjectRefs,
      typeLabel: 'Segmento',
      describeRefs: describeSegmentRefs,
      group: 'segments',
      families: Object.freeze(['directional', 'intersectable'])
    }),
    line: Object.freeze({
      create: raw => new LineObject(raw),
      toConstruction: buildLineConstruction,
      validate: validateTwoPointObject,
      refs: getTwoPointRawObjectRefs,
      typeLabel: 'Recta',
      describeRefs: describeLineRefs,
      group: 'lines',
      families: Object.freeze(['lineLike', 'directional', 'intersectable'])
    }),
    ray: Object.freeze({
      create: raw => new RayObject(raw),
      toConstruction: buildRayConstruction,
      validate: validateTwoPointObject,
      refs: getTwoPointRawObjectRefs,
      typeLabel: 'Semirrecta',
      describeRefs: describeRayRefs,
      group: 'lines',
      families: Object.freeze(['directional', 'intersectable'])
    }),
    vector: Object.freeze({
      create: raw => new VectorObject(raw),
      toConstruction: buildVectorConstruction,
      validate: validateTwoPointObject,
      refs: getTwoPointRawObjectRefs,
      typeLabel: 'Vector libre',
      describeRefs: describeVectorRefs,
      group: 'segments',
      families: Object.freeze(['vector'])
    }),
    'equipollent-vector': Object.freeze({
      create: raw => new EquipollentVectorObject(raw),
      toConstruction: buildEquipollentVectorConstruction,
      validate: validateEquipollentVectorObject,
      refs: getEquipollentVectorRawObjectRefs,
      typeLabel: 'Vector equipolente',
      describeRefs: describeEquipollentVectorRefs,
      group: 'segments',
      families: Object.freeze(['vector'])
    }),
    'parallel-line': Object.freeze({
      create: raw => new ParallelLineObject(raw),
      toConstruction: raw => buildDerivedLineConstruction(raw, 'parallel-through-point'),
      validate: validateDerivedLineObject,
      refs: getDerivedLineRawObjectRefs,
      typeLabel: 'Recta paralela',
      describeRefs: describeParallelLineRefs,
      group: 'lines',
      families: Object.freeze(['lineLike', 'directional', 'intersectable'])
    }),
    'perpendicular-line': Object.freeze({
      create: raw => new PerpendicularLineObject(raw),
      toConstruction: raw => buildDerivedLineConstruction(raw, 'perpendicular-through-point'),
      validate: validateDerivedLineObject,
      refs: getDerivedLineRawObjectRefs,
      typeLabel: 'Recta perpendicular',
      describeRefs: describePerpendicularLineRefs,
      group: 'lines',
      families: Object.freeze(['lineLike', 'directional', 'intersectable'])
    }),
    circle: Object.freeze({
      create: raw => new CircleObject(raw),
      toConstruction: buildCircleConstruction,
      validate: validateCircleObject,
      refs: getCircleRawObjectRefs,
      typeLabel: 'Circunferencia (C,P)',
      describeRefs: describeCircleRefs,
      group: 'curves',
      families: Object.freeze(['intersectable'])
    }),
    'circle-radius': Object.freeze({
      create: raw => new CircleRadiusObject(raw),
      toConstruction: buildCircleRadiusConstruction,
      validate: validateCircleRadiusObject,
      refs: getCenterRawObjectRefs,
      typeLabel: 'Circunferencia (C,r)',
      describeRefs: describeCircleRadiusRefs,
      group: 'curves',
      families: Object.freeze(['intersectable'])
    }),
    ellipse: Object.freeze({
      create: raw => new EllipseObject(raw),
      toConstruction: buildEllipseConstruction,
      validate: validateEllipseObject,
      refs: getEllipseRawObjectRefs,
      typeLabel: 'Elipse',
      describeRefs: describeEllipseRefs,
      group: 'curves',
      families: Object.freeze(['intersectable'])
    }),
    polyline: Object.freeze({
      create: raw => new PolylineObject(raw),
      toConstruction: raw => buildPointSequenceConstruction(raw, 'polyline'),
      validate: validatePolylineObject,
      refs: getPointSequenceRawObjectRefs,
      typeLabel: 'Poligonal',
      describeRefs: describePolylineRefs,
      group: 'figures',
      families: Object.freeze(['intersectable'])
    }),
    polygon: Object.freeze({
      create: raw => new PolygonObject(raw),
      toConstruction: raw => buildPointSequenceConstruction(raw, 'polygon'),
      validate: validatePolygonObject,
      refs: getPointSequenceRawObjectRefs,
      typeLabel: 'Polígono',
      describeRefs: describePolygonRefs,
      group: 'figures',
      families: Object.freeze(['intersectable'])
    }),
    measure: Object.freeze({
      create: raw => new MeasureObject(raw),
      toConstruction: buildMeasureConstruction,
      validate: validateMeasureObject,
      refs: getMeasureRawObjectRefs,
      typeLabel: raw => (raw.measureType === 'angle' ? 'Ángulo' : 'Medida de distancia'),
      describeRefs: describeMeasureRefs,
      group: 'measures'
    }),
    text: Object.freeze({
      create: raw => new TextObject(raw),
      toConstruction: buildTextConstruction,
      validate: validateTextObject,
      refs: getNoRawObjectRefs,
      typeLabel: 'Texto',
      describeRefs: describeTextRefs,
      group: 'texts'
    })
  });

  const SUPPORTED_INTERNAL_OBJECT_TYPES = new Set(Object.keys(INTERNAL_OBJECT_REGISTRY));

  class GeoFactory {
    static fromRaw(raw) {
      if (!raw || typeof raw !== 'object') return new UnknownObject({});

      const createObject = INTERNAL_OBJECT_REGISTRY[InternalObjectAdapter.type(raw)]?.create;
      return createObject ? createObject(raw) : new UnknownObject(raw);
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
      this.scene = readSceneForModel(scene);
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
      normalizePointSemanticStyle(raw);
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

    serializeInternal() {
      return {
        version: this.version,
        meta: deepClone(this.meta),
        viewport: deepClone(this.viewport),
        style: deepClone(this.style),
        objects: this.objects.map(obj => obj.toJSON())
      };
    }

    serializeConstruction() {
      return serializeConstructionScene(this.serializeInternal());
    }

    serialize() {
      return this.serializeConstruction();
    }

    removeIds(idsSet) {
      this.objects = this.objects.filter(obj => !idsSet.has(obj.id));
      this.objectMap = new Map(this.objects.map(obj => [obj.id, obj]));
    }
  }

  /* =========================================================
     MEDIDAS
     ========================================================= */
  function resolveMeasure(model, measureObj, viewportOverride = null) {
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
        ...resolveAngleMeasureInfo(a, b, c, raw.unit || 'deg', viewportOverride || model.viewport)
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

    appendArrowHead(group, a, b, attrs);
    appendArrowHead(group, b, a, attrs);
  }

  function appendArrowHead(group, tip, from, attrs) {
    const dx = tip.x - from.x;
    const dy = tip.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return;

    const strokeWidth = safeNumber(attrs['stroke-width'], 2);
    const ux = dx / len;
    const uy = dy / len;
    const arrowSize = Math.max(8, strokeWidth * 3 + 4);
    const wing = arrowSize * 0.45;
    const baseX = tip.x - ux * arrowSize;
    const baseY = tip.y - uy * arrowSize;
    const px = -uy;
    const py = ux;

    group.appendChild(createSvgEl('polygon', {
      points: [
        `${tip.x},${tip.y}`,
        `${baseX + px * wing},${baseY + py * wing}`,
        `${baseX - px * wing},${baseY - py * wing}`
      ].join(' '),
      fill: attrs.stroke || '#1f2937',
      opacity: attrs.opacity,
      class: attrs.class
    }));
  }

  function renderRay(group, vp, w, h, p1, p2, attrs) {
    const segment = rayVisibleSegment(vp, p1, p2);
    if (!segment) return;

    const a = worldToScreen(vp, w, h, segment.start.x, segment.start.y);
    const b = worldToScreen(vp, w, h, segment.end.x, segment.end.y);
    if (dist2(a.x, a.y, b.x, b.y) < 1e-9) return;

    group.appendChild(createSvgEl('line', {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      ...attrs
    }));

    appendArrowHead(group, b, a, attrs);
  }

  function renderVector(group, vp, w, h, p1, p2, attrs) {
    const a = worldToScreen(vp, w, h, p1.x, p1.y);
    const b = worldToScreen(vp, w, h, p2.x, p2.y);
    if (dist2(a.x, a.y, b.x, b.y) < 1e-9) return;

    group.appendChild(createSvgEl('line', {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      ...attrs
    }));

    appendArrowHead(group, b, a, attrs);
  }

  function selectedStrokeAttrs(style, extraWidth = 4, opacity = 0.25) {
    return {
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + extraWidth,
      opacity
    };
  }

  function screenPointList(points, vp, width, height) {
    return points.map(p => {
      const s = worldToScreen(vp, width, height, p.x, p.y);
      return `${s.x},${s.y}`;
    }).join(' ');
  }

  function renderResolvedSegment(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;
    const a = worldToScreen(vp, width, height, resolved.p1.x, resolved.p1.y);
    const b = worldToScreen(vp, width, height, resolved.p2.x, resolved.p2.y);

    if (isSelected) {
      gShapes.appendChild(createSvgEl('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        ...selectedStrokeAttrs(style)
      }));
    }

    gShapes.appendChild(createSvgEl('line', {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: shapeStroke.stroke,
      'stroke-width': shapeStroke.strokeWidth
    }));
  }

  function renderResolvedLine(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;

    if (isSelected) {
      renderInfiniteLine(gShapes, vp, width, height, resolved.p1, resolved.p2, selectedStrokeAttrs(style));
    }

    renderInfiniteLine(gShapes, vp, width, height, resolved.p1, resolved.p2, {
      stroke: shapeStroke.stroke,
      'stroke-width': shapeStroke.strokeWidth
    });
  }

  function renderResolvedRay(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;

    if (isSelected) {
      renderRay(gShapes, vp, width, height, resolved.p1, resolved.p2, selectedStrokeAttrs(style));
    }

    renderRay(gShapes, vp, width, height, resolved.p1, resolved.p2, {
      stroke: shapeStroke.stroke,
      'stroke-width': shapeStroke.strokeWidth
    });
  }

  function renderResolvedVector(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;

    if (isSelected) {
      renderVector(gShapes, vp, width, height, resolved.p1, resolved.p2, selectedStrokeAttrs(style));
    }

    renderVector(gShapes, vp, width, height, resolved.p1, resolved.p2, {
      stroke: shapeStroke.stroke,
      'stroke-width': shapeStroke.strokeWidth
    });
  }

  function renderResolvedCircle(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;
    const cs = circleScreenRadius(vp, width, height, resolved.center.x, resolved.center.y, resolved.radius);

    if (isSelected) {
      gShapes.appendChild(createSvgEl('circle', {
        cx: cs.cx,
        cy: cs.cy,
        r: cs.r,
        ...selectedStrokeAttrs(style),
        fill: 'none'
      }));
    }

    gShapes.appendChild(createSvgEl('circle', {
      cx: cs.cx,
      cy: cs.cy,
      r: cs.r,
      stroke: shapeStroke.stroke,
      'stroke-width': shapeStroke.strokeWidth,
      fill: style.fill || 'none'
    }));
  }

  function renderResolvedEllipse(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;
    const screenPts = ellipseScreenPoints(vp, width, height, resolved, 96);
    const path = screenPointsPath(screenPts, true);

    if (isSelected) {
      gShapes.appendChild(createSvgEl('path', {
        d: path,
        ...selectedStrokeAttrs(style),
        fill: 'none'
      }));
    }

    gShapes.appendChild(createSvgEl('path', {
      d: path,
      stroke: shapeStroke.stroke,
      'stroke-width': shapeStroke.strokeWidth,
      fill: style.fill || 'none'
    }));
  }

  function renderResolvedPolyline(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;
    const pts = screenPointList(resolved.points, vp, width, height);

    if (isSelected) {
      gShapes.appendChild(createSvgEl('polyline', {
        points: pts,
        ...selectedStrokeAttrs(style),
        fill: 'none'
      }));
    }

    gShapes.appendChild(createSvgEl('polyline', {
      points: pts,
      stroke: shapeStroke.stroke,
      'stroke-width': shapeStroke.strokeWidth,
      fill: 'none'
    }));
  }

  function renderResolvedPolygon(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, selectedPart, shapeStroke } = ctx;
    const screenPts = resolved.points.map(p => worldToScreen(vp, width, height, p.x, p.y));
    const pts = screenPts.map(p => `${p.x},${p.y}`).join(' ');
    const selectedFill = isSelected && selectedPart?.kind === 'polygon-fill';
    const selectedEdgeIndex = isSelected && selectedPart?.kind === 'polygon-edge'
      ? normalizeEdgeIndex(selectedPart.edgeIndex)
      : null;
    const selectedWhole = isSelected && !selectedPart;

    if (resolved.fillVisible !== false) {
      gShapes.appendChild(createSvgEl('polygon', {
        points: pts,
        stroke: 'none',
        'stroke-width': 0,
        fill: style.fill || 'rgba(234,88,12,0.18)'
      }));

      if (selectedFill || selectedWhole) {
        gShapes.appendChild(createSvgEl('polygon', {
          points: pts,
          stroke: '#7c3aed',
          'stroke-width': style.strokeWidth + 2,
          fill: 'rgba(124,58,237,0.12)'
        }));
      }
    }

    const edgeVisibility = Array.isArray(resolved.edgeVisibility) ? resolved.edgeVisibility : [];
    for (let i = 0; i < screenPts.length; i++) {
      if (edgeVisibility[i] === false) continue;
      const a = screenPts[i];
      const b = screenPts[(i + 1) % screenPts.length];
      const isSelectedEdge = selectedWhole || selectedEdgeIndex === i;

      if (isSelectedEdge) {
        gShapes.appendChild(createSvgEl('line', {
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          stroke: '#7c3aed',
          'stroke-width': style.strokeWidth + 4,
          'stroke-linecap': 'round'
        }));
      }

      gShapes.appendChild(createSvgEl('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        stroke: shapeStroke.stroke,
        'stroke-width': shapeStroke.strokeWidth,
        'stroke-linecap': 'round'
      }));
    }
  }

  function renderResolvedMeasure(ctx) {
    const { gMeasures, model, object, vp, width, height, style, isSelected } = ctx;
    if (!(object instanceof MeasureObject)) return;

    const info = resolveMeasure(model, object, vp);
    if (!info) return;

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

  function renderResolvedText(ctx) {
    const { gShapes, gLabels, vp, width, height, resolved, style, isSelected } = ctx;
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

  const SVG_RENDERER_REGISTRY = Object.freeze({
    segment: renderResolvedSegment,
    line: renderResolvedLine,
    ray: renderResolvedRay,
    vector: renderResolvedVector,
    circle: renderResolvedCircle,
    ellipse: renderResolvedEllipse,
    polyline: renderResolvedPolyline,
    polygon: renderResolvedPolygon,
    measure: renderResolvedMeasure,
    text: renderResolvedText
  });

  function renderResolvedObjectToSvg(context) {
    const renderResolved = SVG_RENDERER_REGISTRY[context.resolved?.kind];
    if (renderResolved) renderResolved(context);
  }

  function toolUsesAnchorPreview(tool) {
    return ANCHOR_PREVIEW_TOOLS.has(tool);
  }

  function getToolPreviewColor(tool) {
    return TOOL_PREVIEW_COLORS[tool] || '#2563eb';
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

  function previewStrokeAttrs(previewColor, strokeWidth = 2) {
    return {
      stroke: previewColor,
      'stroke-width': strokeWidth,
      class: 'geo2d-preview-stroke'
    };
  }

  function appendPreviewPoint(ctx, point, options = {}) {
    const { gPreview, gPointTargets, model, vp, width, height } = ctx;
    if (!point) return;

    const previewScreen = worldToScreen(vp, width, height, point.x, point.y);
    const previewRadius = safeNumber(model.style?.pointRadius, 5);
    const previewCaptureRadius = safeNumber(model.style?.pointCaptureRadius, 14);
    const stroke = options.stroke || ctx.previewColor;

    gPointTargets.appendChild(createSvgEl('circle', {
      cx: previewScreen.x,
      cy: previewScreen.y,
      r: previewCaptureRadius,
      fill: options.captureFill || 'rgba(37,99,235,0.08)',
      stroke,
      'stroke-width': options.captureStrokeWidth || 1.5,
      class: 'geo2d-preview-stroke'
    }));

    gPreview.appendChild(createSvgEl('circle', {
      cx: previewScreen.x,
      cy: previewScreen.y,
      r: previewRadius,
      fill: '#ffffff',
      stroke,
      'stroke-width': options.strokeWidth || 2,
      class: 'geo2d-preview-stroke'
    }));
  }

  function shouldRenderAnchorPointPreview(ctx) {
    const { state, previewAnchor } = ctx;
    if (state.mode === 'viewer') return false;
    if (!toolUsesAnchorPreview(state.activeTool)) return false;
    if (!previewAnchor || previewAnchor.fromPointId) return false;
    if (
      ['parallel-line', 'perpendicular-line'].includes(state.activeTool) &&
      !state._toolData?.referenceObjectId
    ) {
      return false;
    }
    if (state.activeTool === 'vector-equipollent' && !state._toolData?.vectorObjectId) {
      return false;
    }
    return true;
  }

  function renderAnchorPointPreview(ctx) {
    if (shouldRenderAnchorPointPreview(ctx)) appendPreviewPoint(ctx, ctx.previewAnchor);
  }

  function renderTextPreview(ctx) {
    const { state, previewAnchor, previewColor, gPreview, model, vp, width, height } = ctx;
    if (state.activeTool !== 'text' || !previewAnchor) return;

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

  function renderDerivedLinePreview(ctx) {
    const { state, model, previewAnchor, previewColor, gPreview, vp, width, height } = ctx;
    if (
      !previewAnchor ||
      !state._toolData?.referenceObjectId ||
      (state.activeTool !== 'parallel-line' && state.activeTool !== 'perpendicular-line')
    ) {
      return;
    }

    const referenceResolved = model.getResolvedObject(state._toolData.referenceObjectId);
    const reference = resolveSegmentLikeReference(referenceResolved, state._toolData.referenceEdgeIndex) || referenceResolved;
    if (!reference || !['segment', 'line', 'ray'].includes(reference.kind)) return;

    let dx = reference.p2.x - reference.p1.x;
    let dy = reference.p2.y - reference.p1.y;

    if (state.activeTool === 'perpendicular-line') {
      const nextDx = -dy;
      const nextDy = dx;
      dx = nextDx;
      dy = nextDy;
    }

    if (Math.abs(dx) <= 1e-9 && Math.abs(dy) <= 1e-9) return;
    renderInfiniteLine(gPreview, vp, width, height, previewAnchor, {
      x: previewAnchor.x + dx,
      y: previewAnchor.y + dy
    }, previewStrokeAttrs(previewColor));
  }

  function renderIntersectionPreview(ctx) {
    const { state, model } = ctx;
    if (
      state.activeTool !== 'intersect' ||
      !state._toolData?.intersectionObjectId ||
      !state._hoverObjectId ||
      state._hoverObjectId === state._toolData.intersectionObjectId ||
      !state._previewWorld
    ) {
      return;
    }

    const first = model.getResolvedObject(state._toolData.intersectionObjectId);
    const second = model.getResolvedObject(state._hoverObjectId);
    const previewPoint = pickClosestWorldPoint(
      resolveObjectIntersections(first, second, {
        edgeIndexA: state._toolData.intersectionEdgeIndex,
        edgeIndexB: state._hoverObjectEdgeIndex
      }),
      state._previewWorld
    );

    if (previewPoint) {
      appendPreviewPoint(ctx, previewPoint, {
        captureFill: 'rgba(22,163,74,0.08)',
        stroke: '#16a34a',
        strokeWidth: 2.5
      });
    }
  }

  function renderEquipollentVectorPreview(ctx) {
    const { state, model, previewAnchor, previewColor, gPreview, vp, width, height } = ctx;
    if (state.activeTool !== 'vector-equipollent' || !previewAnchor || !state._toolData?.vectorObjectId) return;

    const baseVector = model.getResolvedObject(state._toolData.vectorObjectId);
    if (!baseVector || baseVector.kind !== 'vector') return;

    const dx = baseVector.p2.x - baseVector.p1.x;
    const dy = baseVector.p2.y - baseVector.p1.y;
    renderVector(gPreview, vp, width, height, previewAnchor, {
      x: previewAnchor.x + dx,
      y: previewAnchor.y + dy
    }, previewStrokeAttrs(previewColor));
  }

  function getPendingPreviewPoints(ctx) {
    const { state, model } = ctx;
    const first = model.getPointPosition(state._pendingPoints[0]);
    const second = state._pendingPoints.length > 1 ? model.getPointPosition(state._pendingPoints[1]) : null;
    return { first, second };
  }

  function renderPendingLinePreview(ctx, first) {
    const { state, previewAnchor, previewColor, gPreview, vp, width, height } = ctx;
    if (!first || !previewAnchor) return;

    if (state.activeTool === 'segment' || state.activeTool === 'midpoint' || state.activeTool === 'measure-distance') {
      const a = worldToScreen(vp, width, height, first.x, first.y);
      const b = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);

      gPreview.appendChild(createSvgEl('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        ...previewStrokeAttrs(previewColor)
      }));
    }

    if (state.activeTool === 'line') {
      renderInfiniteLine(gPreview, vp, width, height, first, previewAnchor, previewStrokeAttrs(previewColor));
    }

    if (state.activeTool === 'ray') {
      renderRay(gPreview, vp, width, height, first, previewAnchor, previewStrokeAttrs(previewColor));
    }

    if (state.activeTool === 'vector') {
      renderVector(gPreview, vp, width, height, first, previewAnchor, previewStrokeAttrs(previewColor));
    }

    if (state.activeTool === 'circle') {
      const radius = dist(first.x, first.y, previewAnchor.x, previewAnchor.y);
      const cs = circleScreenRadius(vp, width, height, first.x, first.y, radius);

      gPreview.appendChild(createSvgEl('circle', {
        cx: cs.cx,
        cy: cs.cy,
        r: cs.r,
        ...previewStrokeAttrs(previewColor),
        fill: 'none'
      }));
    }
  }

  function renderMeasureAnglePreview(ctx, first, second) {
    const { previewAnchor, previewColor, gPreview, vp, width, height } = ctx;
    if (!previewAnchor) return;

    if (first && !second) {
      const a = worldToScreen(vp, width, height, first.x, first.y);
      const b = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);

      gPreview.appendChild(createSvgEl('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        ...previewStrokeAttrs(previewColor)
      }));
    }

    if (first && second) {
      const firstScreen = worldToScreen(vp, width, height, first.x, first.y);
      const secondScreen = worldToScreen(vp, width, height, second.x, second.y);
      const previewScreen = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);
      const info = resolveAngleMeasureInfo(first, second, previewAnchor, 'deg', vp);
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
        ...previewStrokeAttrs(previewColor)
      }));
      gPreview.appendChild(createSvgEl('line', {
        x1: secondScreen.x,
        y1: secondScreen.y,
        x2: previewScreen.x,
        y2: previewScreen.y,
        ...previewStrokeAttrs(previewColor)
      }));
      gPreview.appendChild(createSvgEl('path', {
        d: arcPath,
        ...previewStrokeAttrs(previewColor),
        fill: 'none'
      }));
    }
  }

  function renderFigurePreview(ctx) {
    const { state, model, previewAnchor, previewColor, gPreview, vp, width, height } = ctx;
    if (!previewAnchor) return;

    const pts = [];
    for (const id of state._pendingPoints) {
      const p = model.getPointPosition(id);
      if (p) pts.push(p);
    }

    if (!pts.length) return;

    const screenPts = pts.map(p => worldToScreen(vp, width, height, p.x, p.y));
    const previewScreen = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);
    const closesOnFirst =
      state.activeTool === 'polyline' &&
      state._pendingPoints.length >= 2 &&
      state._hoverPointId &&
      state._hoverPointId === state._pendingPoints[0];
    const previewPts = closesOnFirst ? screenPts : [...screenPts, previewScreen];
    const pointsAttr = previewPts.map(p => `${p.x},${p.y}`).join(' ');

    if (state.activeTool === 'polyline') {
      gPreview.appendChild(createSvgEl('polyline', {
        points: pointsAttr,
        ...previewStrokeAttrs(previewColor),
        fill: 'none'
      }));
      return;
    }

    gPreview.appendChild(createSvgEl('polygon', {
      points: pointsAttr,
      ...previewStrokeAttrs(previewColor),
      fill: 'rgba(234,88,12,0.10)'
    }));
  }

  function renderEllipsePreview(ctx, first, second) {
    const { state, previewAnchor, previewColor, gPreview, vp, width, height } = ctx;
    if (!first || !previewAnchor) return;

    if (!second) {
      const a = worldToScreen(vp, width, height, first.x, first.y);
      const b = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);

      gPreview.appendChild(createSvgEl('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        ...previewStrokeAttrs(previewColor)
      }));
      return;
    }

    const draft = resolveEllipseGeometryFromPoints(first, second, previewAnchor);
    if (!draft) return;

    const screenPts = ellipseWorldPointsFromResolved({ kind: 'ellipse', ...draft }, 96)
      .map(p => worldToScreen(vp, width, height, p.x, p.y));

    gPreview.appendChild(createSvgEl('path', {
      d: screenPointsPath(screenPts, true),
      ...previewStrokeAttrs(previewColor),
      fill: 'none'
    }));

    appendPreviewPoint(ctx, draft.coVertex);
  }

  function renderPendingToolPreview(ctx) {
    const { state, previewAnchor } = ctx;
    if (!state._pendingPoints.length || !previewAnchor) return;

    const { first, second } = getPendingPreviewPoints(ctx);
    if (first && ['segment', 'line', 'ray', 'vector', 'circle', 'midpoint', 'measure-distance'].includes(state.activeTool)) {
      renderPendingLinePreview(ctx, first);
    }

    if (state.activeTool === 'measure-angle') {
      renderMeasureAnglePreview(ctx, first, second);
    }

    if (['polyline', 'polygon'].includes(state.activeTool)) {
      renderFigurePreview(ctx);
    }

    if (state.activeTool === 'ellipse' && first) {
      renderEllipsePreview(ctx, first, second);
    }
  }

  const PREVIEW_RENDERER_REGISTRY = Object.freeze({
    text: renderTextPreview,
    'parallel-line': renderDerivedLinePreview,
    'perpendicular-line': renderDerivedLinePreview,
    intersect: renderIntersectionPreview,
    'vector-equipollent': renderEquipollentVectorPreview,
    segment: renderPendingToolPreview,
    line: renderPendingToolPreview,
    ray: renderPendingToolPreview,
    vector: renderPendingToolPreview,
    circle: renderPendingToolPreview,
    midpoint: renderPendingToolPreview,
    'measure-distance': renderPendingToolPreview,
    'measure-angle': renderPendingToolPreview,
    polyline: renderPendingToolPreview,
    polygon: renderPendingToolPreview,
    ellipse: renderPendingToolPreview
  });

  function renderPreviewToSvg(context) {
    renderAnchorPointPreview(context);
    const renderPreview = PREVIEW_RENDERER_REGISTRY[context.state.activeTool];
    if (renderPreview) renderPreview(context);
  }

  function appendPointTargetHighlight(group, screenPoint, captureRadius, attrs) {
    group.appendChild(createSvgEl('circle', {
      cx: screenPoint.x,
      cy: screenPoint.y,
      r: captureRadius,
      ...attrs
    }));
  }

  function appendPointShape(group, screenPoint, visibleRadius, style, flags) {
    const { isPending, isHovered, isSelected } = flags;
    const stroke = isPending
      ? '#ea580c'
      : isHovered
        ? '#2563eb'
        : isSelected
          ? '#7c3aed'
          : style.stroke;

    group.appendChild(createSvgEl('circle', {
      cx: screenPoint.x,
      cy: screenPoint.y,
      r: visibleRadius,
      fill: style.fill,
      stroke,
      'stroke-width': (isPending || isHovered || isSelected) ? 2.5 : 1.5
    }));
  }

  function appendPointLabel(group, obj, screenPoint, fontSize) {
    if (!obj.raw.label) return;

    const label = createSvgEl('text', {
      x: screenPoint.x + 10,
      y: screenPoint.y - 10,
      class: 'geo2d-legendline',
      'font-size': fontSize
    });
    label.textContent = obj.raw.label;
    group.appendChild(label);
  }

  function renderPointObjectToSvg(ctx) {
    const {
      model,
      obj,
      vp,
      width,
      height,
      gPointTargets,
      gPoints,
      gLabels,
      pendingPointIds,
      hoverPointId,
      selectedObjectId
    } = ctx;
    const pos = obj.getPosition(model);
    if (!pos) return null;

    const style = mergeStyle(model, obj.raw, { fill: obj.raw.style?.fill || '#ea580c' });
    const screenPoint = worldToScreen(vp, width, height, pos.x, pos.y);
    const visibleRadius = getPointVisibleRadius(model, obj.raw);
    const captureRadius = getPointCaptureRadius(model, obj.raw);
    const isPending = pendingPointIds.has(obj.id);
    const isHovered = hoverPointId === obj.id;
    const isSelected = selectedObjectId === obj.id;

    if (isPending) {
      appendPointTargetHighlight(gPointTargets, screenPoint, captureRadius, {
        fill: 'rgba(234,88,12,0.10)',
        stroke: '#ea580c',
        'stroke-width': 2
      });
    }

    if (isHovered) {
      appendPointTargetHighlight(gPointTargets, screenPoint, captureRadius, {
        fill: 'rgba(37,99,235,0.10)',
        stroke: '#2563eb',
        'stroke-width': 2
      });
    }

    if (isSelected && !isPending && !isHovered) {
      appendPointTargetHighlight(gPointTargets, screenPoint, captureRadius, {
        fill: 'rgba(124,58,237,0.10)',
        stroke: '#7c3aed',
        'stroke-width': 2
      });
    }

    appendPointShape(gPoints, screenPoint, visibleRadius, style, { isPending, isHovered, isSelected });
    appendPointLabel(gLabels, obj, screenPoint, style.fontSize);

    return {
      id: obj.id,
      x: screenPoint.x,
      y: screenPoint.y,
      r: captureRadius,
      visibleRadius,
      draggable: obj.isDraggable()
    };
  }

  function renderBackground(group, width, height, drawRect) {
    group.appendChild(createSvgEl('rect', {
      x: 0,
      y: 0,
      width,
      height,
      fill: '#f8fafc'
    }));

    group.appendChild(createSvgEl('rect', {
      x: drawRect.x,
      y: drawRect.y,
      width: drawRect.width,
      height: drawRect.height,
      fill: '#ffffff',
      stroke: '#e5e7eb',
      'stroke-width': 1
    }));
  }

  function renderGrid(group, sceneVp, vp, width, height, drawRect) {
    if (!sceneVp.showGrid) return;

    const spanX = vp.xMax - vp.xMin;
    const spanY = vp.yMax - vp.yMin;
    const baseStep = vp.lockAspect ? niceStep(Math.min(spanX, spanY)) : null;
    const sx = vp.lockAspect ? baseStep : niceStep(spanX);
    const sy = vp.lockAspect ? baseStep : niceStep(spanY);

    for (let x = Math.ceil(vp.xMin / sx) * sx; x <= vp.xMax + 1e-9; x += sx) {
      const px = worldToScreen(vp, width, height, x, 0).x;
      group.appendChild(createSvgEl('line', {
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
      group.appendChild(createSvgEl('line', {
        x1: drawRect.x,
        y1: py,
        x2: drawRect.x + drawRect.width,
        y2: py,
        stroke: '#edf0f4',
        'stroke-width': 1
      }));
    }
  }

  function renderAxes(group, sceneVp, vp, width, height, drawRect) {
    if (!sceneVp.showAxes) return;

    if (vp.xMin <= 0 && vp.xMax >= 0) {
      const px = worldToScreen(vp, width, height, 0, 0).x;
      group.appendChild(createSvgEl('line', {
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
      group.appendChild(createSvgEl('line', {
        x1: drawRect.x,
        y1: py,
        x2: drawRect.x + drawRect.width,
        y2: py,
        stroke: '#9aa4b2',
        'stroke-width': 1.5
      }));
    }
  }

  function getEditorToolGroups() {
    return [
      {
        id: 'general',
        label: 'GENERAL',
        tools: [
          { id: 'move', label: 'Mover / Vista' },
          { id: 'text', label: 'Texto' },
          { id: 'delete', label: 'Borrar' }
        ]
      },
      {
        id: 'points',
        label: 'PUNTOS',
        tools: [
          { id: 'point', label: 'Punto' },
          { id: 'midpoint', label: 'Punto medio' },
          { id: 'intersect', label: 'Intersección' }
        ]
      },
      {
        id: 'lines',
        label: 'LINEAS',
        tools: [
          { id: 'segment', label: 'Segmento' },
          { id: 'line', label: 'Recta' },
          { id: 'parallel-line', label: 'Paralela' },
          { id: 'perpendicular-line', label: 'Perpendicular' },
          { id: 'ray', label: 'Semirrecta' },
          { id: 'vector', label: 'Vector libre' },
          { id: 'vector-equipollent', label: 'Vector equipolente' }
        ]
      },
      {
        id: 'curves',
        label: 'CURVAS',
        tools: [
          { id: 'circle', label: 'Circunferencia (C,P)' },
          { id: 'circle-radius', label: 'Circunferencia (C,r)' },
          { id: 'ellipse', label: 'Elipse' }
        ]
      },
      {
        id: 'figures',
        label: 'FIGURAS',
        tools: [
          { id: 'polyline', label: 'Poligonal' },
          { id: 'polygon', label: 'Polígono' }
        ]
      },
      {
        id: 'measures',
        label: 'MEDIDAS',
        tools: [
          { id: 'measure-distance', label: 'Medir distancia' },
          { id: 'measure-angle', label: 'Ángulo' }
        ]
      }
    ];
  }

  function getToolGroupForTool(toolId) {
    for (const group of getEditorToolGroups()) {
      if (group.tools.some(tool => tool.id === toolId)) return group.id;
    }
    return 'general';
  }

  function buildEditorToolMenuHtml() {
    return getEditorToolGroups().map(group => `
      <div class="geo2d-toolgroup" data-tool-group="${group.id}">
        <button type="button" class="geo2d-toolgroup-head" data-tool-group-toggle="${group.id}" aria-expanded="false">
          <span class="txt-ncl">${group.label}</span>
          <span class="geo2d-toolgroup-icon" data-role="tool-group-icon">+</span>
        </button>
        <div class="geo2d-toolgroup-items">
          ${group.tools.map(tool => `
            <button type="button" class="geo2d-toolbtn" data-tool="${escapeHtml(tool.id)}"><span class="txt-ncl">${escapeHtml(tool.label)}</span></button>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderSceneToSvg(svg, model, state) {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(300, rect.width || 800);
    const height = Math.max(300, rect.height || 600);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = '';

    const sceneVp = model.viewport;
    const vp = getRenderableViewport(sceneVp, width, height);
    const drawRect = getDrawableRect(vp, width, height);

    const pendingPointIds = new Set(state._pendingPoints || []);
    const hoverPointId = state._hoverPointId || null;
    const hoverObjectId = state._hoverObjectId || null;
    const selectedObjectId = state.selectedObjectId || null;
    const selectedPart = state.selectedPart || null;
    const toolReferenceObjectId =
      state._toolData?.referenceObjectId ||
      state._toolData?.intersectionObjectId ||
      state._toolData?.vectorObjectId ||
      null;

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

    function getShapeStroke(style, isSelected, isHoveredObject, isToolReference) {
      if (isSelected) {
        return { stroke: style.stroke, strokeWidth: style.strokeWidth };
      }
      if (isToolReference) {
        return {
          stroke: '#f59e0b',
          strokeWidth: style.strokeWidth + 1.25
        };
      }
      if (isHoveredObject) {
        return {
          stroke: '#2563eb',
          strokeWidth: style.strokeWidth + 1.5
        };
      }
      return { stroke: style.stroke, strokeWidth: style.strokeWidth };
    }

    renderBackground(gBackground, width, height, drawRect);
    renderGrid(gGrid, sceneVp, vp, width, height, drawRect);
    renderAxes(gAxes, sceneVp, vp, width, height, drawRect);

    for (const { object, resolved } of model.allResolved()) {
      if (!object.isVisible()) continue;
      if (!resolved) continue;

      const style = mergeStyle(model, object.raw);
      const isSelected = object.id === selectedObjectId;
      const objectSelectedPart = isSelected ? selectedPart : null;
      const isHoveredObject = object.id === hoverObjectId && object.id !== selectedObjectId;
      const isToolReference = object.id === toolReferenceObjectId && object.id !== selectedObjectId;
      const shapeStroke = getShapeStroke(style, isSelected, isHoveredObject, isToolReference);

      renderResolvedObjectToSvg({
        model,
        object,
        resolved,
        style,
        shapeStroke,
        isSelected,
        selectedPart: objectSelectedPart,
        vp,
        width,
        height,
        gShapes,
        gMeasures,
        gLabels
      });
    }

    const previewAnchor = getPreviewAnchor(state, model);
    const previewColor = getToolPreviewColor(state.activeTool);
    renderPreviewToSvg({
      state,
      model,
      vp,
      width,
      height,
      gPreview,
      gPointTargets,
      previewAnchor,
      previewColor
    });

    const pointHitList = [];

    for (const obj of model.objects) {
      if (!obj.isVisible() || !obj.isPointLike()) continue;

      const hit = renderPointObjectToSvg({
        model,
        obj,
        vp,
        width,
        height,
        gPointTargets,
        gPoints,
        gLabels,
        pendingPointIds,
        hoverPointId,
        selectedObjectId
      });
      if (hit) pointHitList.push(hit);
    }

    state._pointHitList = pointHitList;
    state._svgWidth = width;
    state._svgHeight = height;
  }

  /* =========================================================
     EDITOR / VIEWER
     ========================================================= */
  class Geo2DHitTester {
    constructor(editor) {
      this.editor = editor;
    }

    get model() {
      return this.editor.model;
    }

    get width() {
      return this.editor._svgWidth || 0;
    }

    get height() {
      return this.editor._svgHeight || 0;
    }

    getScreenViewport() {
      return getRenderableViewport(
        this.model.viewport,
        this.width,
        this.height
      ) || this.model.viewport;
    }

    nearestPointAtScreen(sx, sy) {
      let best = null;
      let bestD2 = Infinity;

      for (const p of (this.editor._pointHitList || [])) {
        const d2 = dist2(sx, sy, p.x, p.y);
        if (d2 <= p.r * p.r && d2 < bestD2) {
          best = p;
          bestD2 = d2;
        }
      }

      return best;
    }

    p2s(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this.width, this.height, p1.x, p1.y);
      const b = worldToScreen(vp, this.width, this.height, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      const t = clamp(((sx - a.x) * dx + (sy - a.y) * dy) / len2, 0, 1);
      return dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2l(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this.width, this.height, p1.x, p1.y);
      const b = worldToScreen(vp, this.width, this.height, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return dist2(sx, sy, a.x, a.y);
      const t = ((sx - a.x) * dx + (sy - a.y) * dy) / len2;
      return dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2r(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this.width, this.height, p1.x, p1.y);
      const b = worldToScreen(vp, this.width, this.height, p2.x, p2.y);
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

    p2polylineEdgesSquared(sx, sy, points, vp, closed = false) {
      if (!points || points.length < 2) return Infinity;
      let best = Infinity;
      const last = closed ? points.length : points.length - 1;

      for (let i = 0; i < last; i++) {
        const a = points[i];
        const b = closed ? points[(i + 1) % points.length] : points[i + 1];
        best = Math.min(best, this.p2s(sx, sy, a, b, vp));
      }

      return best;
    }

    getNearestBoundaryEdgeHit(resolved, sx, sy, vp) {
      if (!resolved || !isSegmentChainResolvedKind(resolved.kind) || !Array.isArray(resolved.points) || resolved.points.length < 2) {
        return null;
      }

      let best = null;
      const last = resolved.kind === 'polygon' ? resolved.points.length : resolved.points.length - 1;
      const edgeVisibility = Array.isArray(resolved.edgeVisibility) ? resolved.edgeVisibility : null;

      for (let i = 0; i < last; i++) {
        if (edgeVisibility && edgeVisibility[i] === false) continue;
        const p1 = resolved.points[i];
        const p2 = resolved.points[(i + 1) % resolved.points.length];
        const d2 = this.p2s(sx, sy, p1, p2, vp);
        if (!best || d2 < best.d2) {
          best = { edgeIndex: i, d2, p1, p2 };
        }
      }

      return best;
    }

    getObjectBoundaryHit(sx, sy, resolved, vp) {
      if (!resolved) return { d2: Infinity, edgeIndex: null };

      if (resolved.kind === 'segment' || resolved.kind === 'vector') {
        return {
          d2: this.p2s(sx, sy, resolved.p1, resolved.p2, vp),
          edgeIndex: null,
          p1: resolved.p1,
          p2: resolved.p2
        };
      }

      if (resolved.kind === 'line') {
        return {
          d2: this.p2l(sx, sy, resolved.p1, resolved.p2, vp),
          edgeIndex: null,
          p1: resolved.p1,
          p2: resolved.p2
        };
      }

      if (resolved.kind === 'ray') {
        return {
          d2: this.p2r(sx, sy, resolved.p1, resolved.p2, vp),
          edgeIndex: null,
          p1: resolved.p1,
          p2: resolved.p2
        };
      }

      if (isSegmentChainResolvedKind(resolved.kind)) {
        const edgeHit = this.getNearestBoundaryEdgeHit(resolved, sx, sy, vp);
        return edgeHit || { d2: Infinity, edgeIndex: null };
      }

      if (resolved.kind === 'circle') {
        const cs = circleScreenRadius(vp, this.width, this.height, resolved.center.x, resolved.center.y, resolved.radius);
        return {
          d2: this.p2circleBorderSquared(sx, sy, cs.cx, cs.cy, cs.r),
          edgeIndex: null
        };
      }

      if (resolved.kind === 'ellipse') {
        const screenPts = ellipseScreenPoints(vp, this.width, this.height, resolved, 96);
        return {
          d2: p2screenPolylineSquared(sx, sy, screenPts, true),
          edgeIndex: null
        };
      }

      return { d2: Infinity, edgeIndex: null };
    }

    pointInWorldPolygonScreen(sx, sy, points, vp) {
      if (!points || points.length < 3) return false;
      const screenPts = points.map(p => worldToScreen(vp, this.width, this.height, p.x, p.y));
      return pointInScreenPolygon(sx, sy, screenPts);
    }

    selectionHitsAtScreen(sx, sy) {
      const hits = [];
      const vp = this.getScreenViewport();

      for (const p of (this.editor._pointHitList || [])) {
        const d2 = dist2(sx, sy, p.x, p.y);
        if (d2 <= p.r * p.r) hits.push({ id: p.id, priority: 0, d2 });
      }

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || obj.isPointLike()) continue;
        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved) continue;

        const hit = this.getObjectHitDistance(sx, sy, resolved, obj, vp, true);
        if (hit.d2 < 100) {
          hits.push({
            id: obj.id,
            priority: hit.priority,
            d2: hit.d2,
            partKind: hit.partKind || null,
            edgeIndex: hit.edgeIndex ?? null
          });
        }
      }

      hits.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.d2 - b.d2;
      });

      return hits;
    }

    getObjectHitDistance(sx, sy, resolved, obj, vp, includeInterior = true) {
      let d2 = Infinity;
      let priority = 2;
      const boundaryHit = this.getObjectBoundaryHit(sx, sy, resolved, vp);

      if (
        resolved.kind === 'segment' ||
        resolved.kind === 'line' ||
        resolved.kind === 'ray' ||
        resolved.kind === 'vector' ||
        resolved.kind === 'circle' ||
        resolved.kind === 'ellipse'
      ) {
        d2 = boundaryHit.d2;
      }

      if (resolved.kind === 'polyline') {
        d2 = boundaryHit.d2;
        priority = 3;
      }

      if (resolved.kind === 'polygon') {
        const hitsVisibleEdge = boundaryHit.edgeIndex !== null && boundaryHit.edgeIndex !== undefined && boundaryHit.d2 < 100;
        if (hitsVisibleEdge) {
          d2 = boundaryHit.d2;
          priority = 2;
          return {
            d2,
            priority,
            partKind: 'polygon-edge',
            edgeIndex: boundaryHit.edgeIndex
          };
        }

        if (includeInterior && resolved.fillVisible !== false && this.pointInWorldPolygonScreen(sx, sy, resolved.points, vp)) {
          d2 = 0;
          priority = 4;
          return {
            d2,
            priority,
            partKind: 'polygon-fill',
            edgeIndex: null
          };
        }

        d2 = boundaryHit.d2;
        priority = 3;
      }

      if (resolved.kind === 'measure') {
        const info = resolveMeasure(this.model, obj, vp);
        if (info) {
          const p = worldToScreen(vp, this.width, this.height, info.anchor.x, info.anchor.y);
          d2 = dist2(sx, sy, p.x, p.y);
          priority = 1;
        }
      }

      if (resolved.kind === 'text') {
        const style = mergeStyle(this.model, obj.raw);
        d2 = p2rectSquared(sx, sy, textScreenBounds(vp, this.width, this.height, resolved, style.fontSize));
        priority = 1;
      }

      return { d2, priority };
    }

    buildAnchorConstraintFromHit(resolved, obj, hit, world) {
      if (!resolved || !obj || !hit || !world) return null;

      if (resolved.kind === 'segment') {
        const p1 = hit.p1 || resolved.p1;
        const p2 = hit.p2 || resolved.p2;
        if (!p1 || !p2) return null;
        return {
          kind: 'on-segment',
          objectId: obj.id,
          t: projectParameter(p1.x, p1.y, p2.x, p2.y, world.x, world.y, true)
        };
      }

      if (isSegmentChainResolvedKind(resolved.kind)) {
        if (!hit.p1 || !hit.p2 || hit.edgeIndex === null || hit.edgeIndex === undefined) return null;
        return {
          kind: 'on-segment',
          objectId: obj.id,
          edgeIndex: hit.edgeIndex,
          t: projectParameter(hit.p1.x, hit.p1.y, hit.p2.x, hit.p2.y, world.x, world.y, true)
        };
      }

      if (resolved.kind === 'line') {
        const p1 = hit.p1 || resolved.p1;
        const p2 = hit.p2 || resolved.p2;
        if (!p1 || !p2) return null;
        return {
          kind: 'on-line',
          objectId: obj.id,
          t: projectParameter(p1.x, p1.y, p2.x, p2.y, world.x, world.y, false)
        };
      }

      if (resolved.kind === 'ray') {
        const p1 = hit.p1 || resolved.p1;
        const p2 = hit.p2 || resolved.p2;
        if (!p1 || !p2) return null;
        return {
          kind: 'on-ray',
          objectId: obj.id,
          t: Math.max(0, projectParameter(p1.x, p1.y, p2.x, p2.y, world.x, world.y, false))
        };
      }

      if (resolved.kind === 'circle') {
        return {
          kind: 'on-circle',
          objectId: obj.id,
          angle: Math.atan2(world.y - resolved.center.y, world.x - resolved.center.x)
        };
      }

      if (resolved.kind === 'ellipse') {
        return {
          kind: 'on-ellipse',
          objectId: obj.id,
          angle: ellipseAngleFromResolved(resolved, world.x, world.y)
        };
      }

      return null;
    }

    nearestAnchorObjectAtScreen(sx, sy, world) {
      const vp = this.getScreenViewport();
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || obj.isPointLike()) continue;
        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved || !isHitTestIntersectableResolvedKind(resolved.kind)) continue;

        const hit = this.getObjectBoundaryHit(sx, sy, resolved, vp);
        if (hit.d2 < 100 && hit.d2 < bestD2) {
          const constraint = this.buildAnchorConstraintFromHit(resolved, obj, hit, world);
          if (!constraint) continue;
          best = { object: obj, constraint, d2: hit.d2 };
          bestD2 = hit.d2;
        }
      }

      return best;
    }

    nearestDirectionalObjectAtScreen(sx, sy) {
      const vp = this.getScreenViewport();
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || obj.isPointLike()) continue;
        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved || !isHitTestDirectionalResolvedKind(resolved.kind)) continue;

        const hit = this.getObjectBoundaryHit(sx, sy, resolved, vp);
        if (hit.d2 < 100 && hit.d2 < bestD2) {
          best = { id: obj.id, edgeIndex: hit.edgeIndex };
          bestD2 = hit.d2;
        }
      }

      return best;
    }

    nearestVectorAtScreen(sx, sy) {
      const vp = this.getScreenViewport();
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || !isVectorRawType(InternalObjectAdapter.type(obj))) continue;
        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved || resolved.kind !== 'vector') continue;

        const hit = this.getObjectBoundaryHit(sx, sy, resolved, vp);
        if (hit.d2 < 100 && hit.d2 < bestD2) {
          best = obj;
          bestD2 = hit.d2;
        }
      }

      return best;
    }

    nearestIntersectableObjectAtScreen(sx, sy, excludeId = null) {
      const vp = this.getScreenViewport();
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || obj.isPointLike() || obj.id === excludeId) continue;
        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved || !isHitTestIntersectableResolvedKind(resolved.kind)) continue;

        const hit = this.getObjectBoundaryHit(sx, sy, resolved, vp);
        if (hit.d2 < 100 && hit.d2 < bestD2) {
          best = { id: obj.id, edgeIndex: hit.edgeIndex };
          bestD2 = hit.d2;
        }
      }

      return best;
    }

    nearestNonPointObjectAtScreen(sx, sy) {
      const vp = this.getScreenViewport();
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || obj.isPointLike()) continue;
        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved) continue;

        const hit = this.getObjectHitDistance(sx, sy, resolved, obj, vp, true);
        if (hit.d2 < 100 && hit.d2 < bestD2) {
          best = obj;
          bestD2 = hit.d2;
        }
      }

      return best;
    }

    hoveredObjectForTool(sx, sy) {
      const editor = this.editor;
      if (
        (editor.activeTool === 'parallel-line' || editor.activeTool === 'perpendicular-line') &&
        !editor._toolData?.referenceObjectId
      ) {
        return this.nearestDirectionalObjectAtScreen(sx, sy);
      }

      if (editor.activeTool === 'intersect') {
        return this.nearestIntersectableObjectAtScreen(sx, sy, editor._toolData?.intersectionObjectId || null);
      }

      if (editor.activeTool === 'vector-equipollent') {
        if (!editor._toolData?.vectorObjectId) return this.nearestVectorAtScreen(sx, sy);
        return this.model.getObject(editor._toolData.vectorObjectId);
      }

      return this.nearestNonPointObjectAtScreen(sx, sy);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const OBJECT_LIST_GROUPS = Object.freeze([
    { id: 'points', label: 'PUNTOS' },
    { id: 'lines', label: 'RECTAS' },
    { id: 'segments', label: 'SEGMENTOS Y VECTORES' },
    { id: 'curves', label: 'CURVAS' },
    { id: 'figures', label: 'FIGURAS' },
    { id: 'measures', label: 'MEDIDAS' },
    { id: 'texts', label: 'TEXTOS' },
    { id: 'others', label: 'OTROS' }
  ]);

  function getObjectListGroup(value) {
    const type = InternalObjectAdapter.type(value);
    const groupId = INTERNAL_OBJECT_REGISTRY[type]?.group || 'others';
    return OBJECT_LIST_GROUPS.find(group => group.id === groupId) || OBJECT_LIST_GROUPS[OBJECT_LIST_GROUPS.length - 1];
  }

  function getObjectTypeLabel(value) {
    const raw = InternalObjectAdapter.raw(value);
    const type = InternalObjectAdapter.type(raw);
    const typeLabel = INTERNAL_OBJECT_REGISTRY[type]?.typeLabel;
    if (typeof typeLabel === 'function') return typeLabel(raw);
    if (typeLabel) return typeLabel;
    return type || 'Objeto';
  }

  function describeObjectRefs(value) {
    const raw = InternalObjectAdapter.raw(value);
    if (!raw || typeof raw !== 'object') return '—';
    const type = InternalObjectAdapter.type(raw);
    const describeRefs = INTERNAL_OBJECT_REGISTRY[type]?.describeRefs;
    if (describeRefs) return describeRefs(raw);
    return joinObjectIds(InternalObjectAdapter.refs(raw));
  }

  class Geo2DConstructionControllerV2 {
    constructor(editor) {
      this.editor = editor;
    }

    get model() {
      return this.editor.model;
    }

    get activeTool() {
      return this.editor.activeTool;
    }

    isFigureTool(tool = this.activeTool) {
      return !!FIGURE_CONSTRUCTION_SPECS[tool];
    }

    minPointsForFigureTool(tool = this.activeTool) {
      return tool === 'polyline' ? 2 : 3;
    }

    getFigureToolLabel(tool = this.activeTool) {
      if (tool === 'polyline') return 'Poligonal';
      return 'Polígono';
    }

    dispatchClick(world, sx, sy) {
      switch (this.activeTool) {
        case 'point':
          return this.handlePointClick(world, sx, sy);
        case 'text':
          return this.handleTextClick(world, sx, sy);
        case 'ellipse':
          return this.handleEllipseClick(world, sx, sy);
        case 'circle-radius':
          return this.handleCircleRadiusClick(world, sx, sy);
        case 'intersect':
          return this.handleIntersectionClick(world, sx, sy);
        case 'parallel-line':
        case 'perpendicular-line':
          return this.handleDerivedLineClick(world, sx, sy);
        case 'vector-equipollent':
          return this.handleEquipollentVectorClick(world, sx, sy);
        default:
          return this.handlePointSequenceClick(world, sx, sy);
      }
    }

    handlePointClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      editor.resetConstructionState();
      editor.selectObject(picked.id, false);
      editor.renderAndSync();
      editor.setStatus(picked.created ? 'Punto creado.' : 'Punto seleccionado.');
    }

    handleTextClick(world, sx, sy) {
      const editor = this.editor;
      const snapped = editor.getSnappedWorldPosition(world, sx, sy);
      const rawText = prompt('Texto:', 'Texto');
      if (rawText === null) {
        editor.setStatus('Texto cancelado.');
        return;
      }

      const text = String(rawText).trim();
      if (!text) {
        editor.setStatus('El texto no puede quedar vacío.', true);
        return;
      }

      const id = editor.nextId('txt');
      this.model.addObject({
        id,
        type: 'text',
        x: snapped.x,
        y: snapped.y,
        text,
        draggable: true,
        style: { fill: '#111827' }
      });

      editor.resetConstructionState();
      editor.selectObject(id, false);
      editor.renderAndSync();
      editor.setStatus('Texto creado.');
    }

    handleEllipseClick(world, sx, sy) {
      const editor = this.editor;

      if (editor._pendingPoints.length === 0) {
        const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
        if (!picked?.id) return;
        editor._pendingPoints = [picked.id];
        editor._hoverPointId = picked.id;
        editor._previewWorld = null;
        editor._toolData = null;
        editor.renderAndSync();
        editor.setStatus('Elipse: marca el vértice.');
        return;
      }

      const center = this.model.getPointPosition(editor._pendingPoints[0]);
      if (!center) {
        editor.resetConstructionState();
        editor.renderAndSync();
        editor.setStatus('No se pudo resolver el centro de la elipse.', true);
        return;
      }

      if (editor._pendingPoints.length === 1) {
        const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
        if (!picked?.id) return;

        const vertex = this.model.getPointPosition(picked.id);
        if (!vertex || dist(center.x, center.y, vertex.x, vertex.y) <= 1e-9) {
          editor.setStatus('El vértice debe ser distinto del centro.', true);
          return;
        }

        editor._pendingPoints = [editor._pendingPoints[0], picked.id];
        editor._hoverPointId = picked.id;
        editor._previewWorld = null;
        editor._toolData = null;
        editor.renderAndSync();
        editor.setStatus('Elipse: marca el covértice.');
        return;
      }

      const vertexId = editor._pendingPoints[1];
      const vertex = this.model.getPointPosition(vertexId);
      const snapped = editor.getSnappedWorldPosition(world, sx, sy);
      const draft = resolveEllipseGeometryFromPoints(center, vertex, snapped);
      if (!draft) {
        editor.setStatus('El covértice debe definir un semieje Y mayor que 0.', true);
        return;
      }

      const nearPoint = editor.findNearestPointAtScreen(sx, sy);
      let coVertexId = nearPoint?.id || null;
      if (!coVertexId) {
        const anchorObject = editor.findNearestAnchorObjectAtScreen(sx, sy, world);
        coVertexId = anchorObject?.constraint
          ? editor.addConstrainedPoint(anchorObject.constraint, false)
          : editor.addFreePoint(draft.coVertex.x, draft.coVertex.y, false);
      }

      const ellipseId = editor.nextId('e');
      const reservedAuxIds = new Set();
      const antiVertexId = editor.generateAuxiliaryPointName('P', reservedAuxIds);
      reservedAuxIds.add(antiVertexId);
      const antiCoVertexId = editor.generateAuxiliaryPointName('P', reservedAuxIds);

      this.model.addObject({
        id: ellipseId,
        type: 'ellipse',
        center: editor._pendingPoints[0],
        vertex: vertexId,
        coVertex: coVertexId,
        derivedPoints: {
          antiVertex: antiVertexId,
          antiCoVertex: antiCoVertexId
        },
        style: { stroke: '#9333ea' }
      });
      editor.addEllipseDerivedPoint(ellipseId, 'antiVertex', antiVertexId, false);
      editor.addEllipseDerivedPoint(ellipseId, 'antiCoVertex', antiCoVertexId, false);

      editor.resetConstructionState();
      editor.selectObject(ellipseId, false);
      editor.renderAndSync();
      editor.setStatus('Elipse creada.');
    }

    handleCircleRadiusClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      const rawRadius = prompt('Radio de la circunferencia:', '5');
      if (rawRadius === null) {
        editor.setStatus('Circunferencia (C,r) cancelada.');
        return;
      }

      const radius = safeNumber(String(rawRadius).replace(',', '.'), NaN);
      if (!(radius > 1e-9)) {
        editor.setStatus('El radio debe ser un número mayor que 0.', true);
        return;
      }

      this.model.addObject({
        id: editor.nextId('cr'),
        type: 'circle-radius',
        center: picked.id,
        radius,
        style: { stroke: '#dc2626' }
      });

      editor.resetConstructionState();
      editor.renderAndSync();
      editor.setStatus('Circunferencia (C,r) creada.');
    }

    handleIntersectionClick(world, sx, sy) {
      const editor = this.editor;

      if (!editor._toolData?.intersectionObjectId) {
        const firstObject = editor.findNearestIntersectableObjectAtScreen(sx, sy);
        if (!firstObject) {
          editor.setStatus('Intersección: selecciona el primer objeto.', true);
          return;
        }

        editor._toolData = {
          intersectionObjectId: firstObject.id,
          intersectionEdgeIndex: normalizeEdgeIndex(firstObject.edgeIndex)
        };
        editor._hoverPointId = null;
        editor._hoverObjectId = firstObject.id;
        editor._hoverObjectEdgeIndex = normalizeEdgeIndex(firstObject.edgeIndex);
        editor._previewWorld = { x: world.x, y: world.y };
        editor.render();
        editor.setStatus('Intersección: selecciona el segundo objeto.');
        return;
      }

      const firstObjectId = editor._toolData.intersectionObjectId;
      const secondObject = editor.findNearestIntersectableObjectAtScreen(sx, sy, firstObjectId);
      if (!secondObject) {
        editor.setStatus('Intersección: selecciona un segundo objeto compatible.', true);
        return;
      }

      const intersections = editor.getIntersectionCandidates(firstObjectId, secondObject.id, {
        edgeIndex: editor._toolData.intersectionEdgeIndex,
        edgeIndex2: secondObject.edgeIndex
      });
      if (!intersections.length) {
        editor.setStatus('Esos objetos no se intersectan.', true);
        return;
      }

      const chosenPoint = pickClosestWorldPoint(intersections, world);
      const pointId = editor.addIntersectionPoint(firstObjectId, secondObject.id, chosenPoint, false, {
        edgeIndex: editor._toolData.intersectionEdgeIndex,
        edgeIndex2: secondObject.edgeIndex
      });

      editor.resetConstructionState();
      editor.selectObject(pointId, false);
      editor.renderAndSync();
      editor.setStatus(
        intersections.length > 1
          ? 'Punto de intersección creado. Se eligió el más cercano al clic.'
          : 'Punto de intersección creado.'
      );
    }

    handleDerivedLineClick(world, sx, sy) {
      const editor = this.editor;
      const isParallel = this.activeTool === 'parallel-line';

      if (!editor._toolData?.referenceObjectId) {
        const referenceObject = editor.findNearestDirectionalObjectAtScreen(sx, sy);
        if (!referenceObject) {
          editor.setStatus('Selecciona un segmento, recta, semirrecta o una arista de poligonal/polígono.', true);
          return;
        }

        editor._toolData = {
          referenceObjectId: referenceObject.id,
          referenceEdgeIndex: normalizeEdgeIndex(referenceObject.edgeIndex)
        };
        editor._hoverPointId = null;
        editor._hoverObjectId = referenceObject.id;
        editor._hoverObjectEdgeIndex = normalizeEdgeIndex(referenceObject.edgeIndex);
        editor._previewWorld = { x: world.x, y: world.y };
        editor.render();
        editor.setStatus(
          isParallel
            ? 'Paralela: selecciona el punto por donde pasará la recta.'
            : 'Perpendicular: selecciona el punto por donde pasará la recta.'
        );
        return;
      }

      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      this.model.addObject({
        id: editor.nextId(isParallel ? 'par' : 'per'),
        type: this.activeTool,
        point: picked.id,
        objectId: editor._toolData.referenceObjectId,
        ...(editor._toolData.referenceEdgeIndex !== null ? { edgeIndex: editor._toolData.referenceEdgeIndex } : {}),
        style: {
          stroke: isParallel ? '#0284c7' : '#b45309'
        }
      });

      editor.resetConstructionState();
      editor.renderAndSync();
      editor.setStatus(isParallel ? 'Recta paralela creada.' : 'Recta perpendicular creada.');
    }

    handleEquipollentVectorClick(world, sx, sy) {
      const editor = this.editor;

      if (!editor._toolData?.vectorObjectId) {
        const baseVector = editor.findNearestVectorAtScreen(sx, sy);
        if (!baseVector) {
          editor.setStatus('Vector equipolente: selecciona un vector de referencia.', true);
          return;
        }

        editor._hoverPointId = null;
        editor._hoverObjectId = baseVector.id;
        editor._hoverObjectEdgeIndex = null;
        editor._previewWorld = { x: world.x, y: world.y };
        editor._toolData = { vectorObjectId: baseVector.id };
        editor.render();
        editor.setStatus('Vector equipolente: selecciona el punto inicial.');
        return;
      }

      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      const vectorId = editor.nextId('veq');
      this.model.addObject({
        id: vectorId,
        type: 'equipollent-vector',
        point: picked.id,
        vectorId: editor._toolData.vectorObjectId,
        style: { stroke: '#8b5cf6' }
      });
      const endPointId = editor.addVectorEndPoint(vectorId, false);

      editor.resetConstructionState();
      editor.selectObject(endPointId, false);
      editor.renderAndSync();
      editor.setStatus('Vector equipolente creado con punto final dependiente.');
    }

    handleFigurePoint(id, world) {
      const editor = this.editor;
      const firstId = editor._pendingPoints[0];
      const lastId = editor._pendingPoints[editor._pendingPoints.length - 1];

      if (editor._pendingPoints.length >= this.minPointsForFigureTool() && id === firstId) {
        this.finishPendingFigure();
        return;
      }

      if (lastId !== id) editor._pendingPoints.push(id);

      editor._hoverPointId = id;
      editor._previewWorld = { x: world.x, y: world.y };
      editor._toolData = null;
      editor.renderAndSync();
      editor.setStatus(
        this.activeTool === 'polyline'
          ? `Poligonal: ${editor._pendingPoints.length} punto(s). Haz clic en el punto inicial para terminar.`
          : `${this.getFigureToolLabel()}: ${editor._pendingPoints.length} punto(s). Haz clic en el punto inicial para cerrar.`
      );
    }

    handleAngleMeasurePoint() {
      const editor = this.editor;

      if (editor._pendingPoints.length === 1) {
        editor.renderAndSync();
        editor.setStatus('Ángulo: selecciona el vértice.');
        return;
      }

      if (editor._pendingPoints.length === 2) {
        editor.renderAndSync();
        editor.setStatus('Ángulo: selecciona el tercer punto.');
        return;
      }

      if (editor._pendingPoints.length === 3) {
        const [a, b, c] = editor._pendingPoints;
        this.model.addObject({
          id: editor.nextId('ang'),
          type: 'measure',
          measureType: 'angle',
          unit: 'deg',
          of: [a, b, c],
          style: { stroke: '#6b7280' }
        });

        editor.resetConstructionState();
        editor.renderAndSync();
        editor.setStatus('Ángulo creado.');
      }
    }

    getSecondPointPromptForTool() {
      if (this.activeTool === 'ray') return 'Semirrecta: selecciona un punto de dirección.';
      if (this.activeTool === 'vector') return 'Vector libre: selecciona el punto final.';
      return 'Selecciona el segundo punto.';
    }

    addTwoPointObject(a, b) {
      const spec = TWO_POINT_CONSTRUCTION_SPECS[this.activeTool];
      if (!spec) return false;

      this.model.addObject({
        id: this.editor.nextId(spec.idPrefix),
        ...spec.build(a, b)
      });
      return true;
    }

    handleTwoPointPoint() {
      const editor = this.editor;

      if (editor._pendingPoints.length === 1) {
        editor.renderAndSync();
        editor.setStatus(this.getSecondPointPromptForTool());
        return;
      }

      if (editor._pendingPoints.length === 2) {
        const [a, b] = editor._pendingPoints;
        this.addTwoPointObject(a, b);
        editor.resetConstructionState();
        editor.renderAndSync();
        editor.setStatus('Objeto creado.');
      }
    }

    handlePointSequenceClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      const id = picked.id;
      if (!id) return;

      editor._hoverObjectId = null;
      editor._hoverObjectEdgeIndex = null;

      if (this.isFigureTool()) {
        this.handleFigurePoint(id, world);
        return;
      }

      editor._pendingPoints.push(id);
      editor._hoverPointId = id;
      editor._previewWorld = { x: world.x, y: world.y };
      editor._toolData = null;

      if (this.activeTool === 'measure-angle') {
        this.handleAngleMeasurePoint();
        return;
      }

      this.handleTwoPointPoint();
    }

    finishPendingFigure() {
      const editor = this.editor;
      const points = [...editor._pendingPoints];
      const tool = this.activeTool;
      const minPoints = this.minPointsForFigureTool(tool);
      if (points.length < minPoints) return;

      const spec = FIGURE_CONSTRUCTION_SPECS[tool];
      if (!spec) return;

      this.model.addObject({
        id: editor.nextId(spec.idPrefix),
        type: spec.type,
        points,
        style: deepClone(spec.style)
      });

      const label = this.getFigureToolLabel(tool);
      editor.resetConstructionState();
      editor.renderAndSync();
      editor.setStatus(tool === 'polygon' ? 'Polígono creado.' : `${label} creada.`);
    }
  }

  class Geo2DHistoryController {
    constructor(editor, options = {}) {
      this.editor = editor;
      this.undoStack = [];
      this.redoStack = [];
      this.limit = Math.max(1, Math.floor(safeNumber(options.limit, 120)));
      this.signature = '';
    }

    canUse() {
      return this.editor.mode !== 'viewer';
    }

    createEntry() {
      return {
        scene: this.editor.model.serializeConstruction(),
        selectedObjectId: this.editor.selectedObjectId,
        selectedPart: this.editor.selectedPart ? deepClone(this.editor.selectedPart) : null,
        activeTab: this.editor.activeTab
      };
    }

    createSignature(entry) {
      return JSON.stringify(entry?.scene || null);
    }

    applyEntry(entry) {
      if (!entry || !entry.scene) return;
      this.editor.applySceneState(entry.scene, {
        clearSelection: true,
        selectedObjectId: entry.selectedObjectId,
        selectedPart: entry.selectedPart,
        activeTab: entry.activeTab,
        syncJson: true
      });
    }

    pushUndo(entry) {
      this.undoStack.push(entry);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
      this.signature = this.createSignature(entry);
    }

    replace(entry) {
      this.undoStack = [entry];
      this.redoStack = [];
      this.signature = this.createSignature(entry);
    }

    restore(entry) {
      this.signature = this.createSignature(entry);
      this.applyEntry(entry);
    }

    commit() {
      if (!this.canUse()) return false;
      const entry = this.createEntry();
      const signature = this.createSignature(entry);
      if (signature === this.signature) return false;
      this.pushUndo(entry);
      this.redoStack = [];
      this.editor.refreshUI();
      return true;
    }

    reset() {
      if (!this.canUse()) return;
      this.replace(this.createEntry());
    }

    undo() {
      if (!this.canUse() || !this.canUndo()) return;
      const current = this.createEntry();
      const previous = this.undoStack[this.undoStack.length - 2];
      this.redoStack.push(current);
      this.undoStack.pop();
      this.restore(previous);
      this.editor.setStatus('Cambio deshecho.');
    }

    redo() {
      if (!this.canUse() || !this.canRedo()) return;
      const next = this.redoStack.pop();
      this.undoStack.push(deepClone(next));
      this.restore(next);
      this.editor.setStatus('Cambio rehecho.');
    }

    canUndo() {
      return this.undoStack.length > 1;
    }

    canRedo() {
      return this.redoStack.length > 0;
    }
  }

  const EDITOR_ACTION_HANDLERS = Object.freeze({
    new: editor => {
      editor.applySceneState(defaultScene(), {
        clearSelection: true,
        syncJson: true,
        resetHistory: true,
        status: 'Nueva escena.'
      });
    },
    load: editor => {
      editor.hiddenFileInput?.click();
    },
    save: editor => {
      downloadTextFile(`${slugify(editor.model.meta.title)}.geo2d.json`, jsonPretty(editor.model.serializeConstruction()));
      editor.setStatus('Guardado.');
    },
    copyjson: editor => {
      copyTextToClipboard(jsonPretty(editor.model.serializeConstruction())).then(() => editor.setStatus('Copiado.'));
    },
    'apply-json': editor => {
      editor.applyJsonToScene();
    },
    'format-json': editor => {
      if (!editor.jsonArea) return;
      editor.jsonArea.value = jsonPretty(serializeConstructionScene(parseSceneText(editor.jsonArea.value)));
      editor.setStatus('Formateado.');
    },
    publish: editor => {
      editor._publishedHtml.explore = editor.publishScene('explore');
      editor._publishedHtml.locked = editor.publishScene('locked');
      if (editor.publishArea) editor.publishArea.value = editor._publishedHtml.explore;
      if (editor.modalBackdrop) editor.modalBackdrop.style.setProperty('display', 'flex', 'important');
      editor.setStatus('HTML generado.');
    },
    undo: editor => {
      editor.undoLastChange();
    },
    redo: editor => {
      editor.redoLastChange();
    },
    'toggle-tools-panel': editor => {
      editor.toolPanelOpen = editor.toolPanelOpen === false;
      editor.renderAfterLayoutChange();
    },
    'toggle-objects-panel': editor => {
      editor.rightPanelOpen.objects = editor.rightPanelOpen.objects === false;
      editor.renderAfterLayoutChange();
    },
    'toggle-properties-panel': editor => {
      editor.rightPanelOpen.properties = editor.rightPanelOpen.properties === false;
      editor.renderAfterLayoutChange();
    },
    'copy-published-locked': editor => {
      if (editor.publishArea) editor.publishArea.value = editor._publishedHtml.locked || editor.publishScene('locked');
      copyTextToClipboard(editor.publishArea?.value || '').then(() => editor.setStatus('HTML locked copiado.'));
    },
    'copy-published-interactive': editor => {
      if (editor.publishArea) editor.publishArea.value = editor._publishedHtml.explore || editor.publishScene('explore');
      copyTextToClipboard(editor.publishArea?.value || '').then(() => editor.setStatus('HTML interactive copiado.'));
    },
    'close-modal': editor => {
      if (editor.modalBackdrop) editor.modalBackdrop.style.setProperty('display', 'none', 'important');
    }
  });

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
      this.viewerMode = this.mode === 'viewer'
        ? normalizeViewerMode(options.viewerMode || this.targetEl.getAttribute?.('data-viewer-mode') || this.targetEl.getAttribute?.('data-mode'))
        : 'editor';
      this.model = new SceneModel(loadSceneFromOptions(options));
      this.hitTester = new Geo2DHitTester(this);
      this.construction = new Geo2DConstructionControllerV2(this);

      this.activeTab = 'visual';
      this.activeTool = 'move';
      this.openToolGroup = getToolGroupForTool(this.activeTool);
      this._dragInfo = null;
      this._viewDragInfo = null;
      this._pendingPoints = [];
      this._hoverPointId = null;
      this._hoverObjectId = null;
      this._hoverObjectEdgeIndex = null;
      this._previewWorld = null;
      this._toolData = null;
      this._pointHitList = [];
      this._svgWidth = 0;
      this._svgHeight = 0;
      this._objectCounter = this.model.objects.length + 1;
      this.selectedObjectId = null;
      this.selectedPart = null;
      this._selectionCycleIndex = 0;
      this._lastHitIds = [];
      this._lastHitSx = null;
      this._lastHitSy = null;
      this._resizeObserver = null;
      this._resizeFrame = null;
      this._cancelResizeFrame = null;
      this._viewportHistoryTimer = null;
      this.history = new Geo2DHistoryController(this, { limit: 120 });
      this._publishedHtml = { explore: '', locked: '' };
      this.toolPanelOpen = true;
      this.rightPanelOpen = { objects: true, properties: true };

      this.buildLayout();
      this.bindUI();
      this.syncJsonFromScene();
      this.refreshUI();
      this.render();
      this.resetHistory();
      this.installResizeObserver();
      this.targetEl.__geo2dInstance = this;
    }

    get model() {
      return this._model;
    }

    set model(value) {
      this._model = value;
    }

    get activeTool() {
      return this._activeTool;
    }

    set activeTool(value) {
      this._activeTool = value;
    }

    destroy() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
      if (this._resizeFrame && this._cancelResizeFrame) {
        this._cancelResizeFrame(this._resizeFrame);
        this._resizeFrame = null;
      }
      this.cancelViewportHistoryCommit();
      if (this.shadow) this.shadow.innerHTML = '';
      if (this.targetEl?.__geo2dInstance === this) this.targetEl.__geo2dInstance = null;
    }

    isViewerLocked() {
      return this.mode === 'viewer' && this.viewerMode === 'locked';
    }

    isViewerExplore() {
      return this.mode === 'viewer' && this.viewerMode === 'explore';
    }

    buildLayout() {
      this.root = document.createElement('div');
      this.root.className = 'geo2d-root';
      this.shadow.appendChild(this.root);

      if (this.mode === 'viewer') {
        this.root.innerHTML = `
          <div class="geo2d-mainpanel" style="width:100%;">
            <svg class="geo2d-svg" style="width:100%;height:600px;display:block;"></svg>
            <div class="geo2d-status">Listo.</div>
          </div>
        `;
      } else {
        this.root.innerHTML = `
          <div class="geo2d-toolbar">
            <button class="geo2d-btn" data-action="new">Nuevo</button>
            <button class="geo2d-btn" data-action="load">Cargar</button>
            <button class="geo2d-btn" data-action="save">Guardar JSON</button>
            <button class="geo2d-btn" data-action="publish">Publicar HTML</button>
            <button class="geo2d-btn" data-action="copyjson">Copiar JSON</button>
            <button class="geo2d-btn" data-action="undo">Deshacer</button>
            <button class="geo2d-btn" data-action="redo">Rehacer</button>
            <input class="geo2d-title" type="text" />
          </div>
          <div class="geo2d-body">
            <aside class="geo2d-side">
              <div class="geo2d-pane-head">
                <strong class="geo2d-section-title">Herramientas</strong>
                <button type="button" class="geo2d-pane-toggle" data-action="toggle-tools-panel" data-role="tools-toggle">-</button>
              </div>
              <div class="geo2d-toolgrid" data-section-content="tools">${buildEditorToolMenuHtml()}</div>
            </aside>
            <main class="geo2d-mainpanel">
              <div class="geo2d-tabs">
                <button class="geo2d-tab" data-tab="visual">Visual</button>
                <button class="geo2d-tab" data-tab="json">JSON</button>
              </div>
              <svg class="geo2d-svg" style="width:100%;height:700px;display:block;"></svg>
              <textarea class="geo2d-jsonarea" spellcheck="false" style="display:none;"></textarea>
              <div class="geo2d-status">Listo.</div>
            </main>
            <aside class="geo2d-right">
              <section class="geo2d-section" data-right-section="objects">
                <div class="geo2d-section-head">
                  <strong class="geo2d-section-title">Objetos del área gráfica</strong>
                  <button type="button" class="geo2d-pane-toggle" data-action="toggle-objects-panel" data-role="objects-toggle">-</button>
                </div>
                <div class="geo2d-section-content geo2d-object-list" data-section-content="objects"></div>
              </section>
              <section class="geo2d-section" data-right-section="properties">
                <div class="geo2d-section-head">
                  <strong class="geo2d-section-title">Propiedades del objeto</strong>
                  <button type="button" class="geo2d-pane-toggle" data-action="toggle-properties-panel" data-role="properties-toggle">-</button>
                </div>
                <div class="geo2d-section-content geo2d-props" data-section-content="properties">
                  <label class="geo2d-field geo2d-prop-id-wrap"><span>ID</span><input class="geo2d-prop-id" type="text" readonly></label>
                  <label class="geo2d-field geo2d-prop-type-wrap"><span>Tipo</span><input class="geo2d-prop-type" type="text" readonly></label>
                  <label class="geo2d-field geo2d-prop-label-wrap"><span>Nombre / etiqueta</span><input class="geo2d-prop-label" type="text"></label>
                  <label class="geo2d-field geo2d-prop-refs-wrap"><span>Dependencia / referencias</span><input class="geo2d-prop-refs" type="text" readonly></label>
                  <label class="geo2d-field geo2d-prop-extra-wrap"><span>Unidad</span>
                    <select class="geo2d-prop-extra"><option value="deg">Grados</option><option value="rad">Radianes</option></select>
                  </label>
                  <label class="geo2d-check geo2d-prop-visible-wrap"><input class="geo2d-prop-visible" type="checkbox"> Visible</label>
                  <div class="geo2d-prop-area-wrap">
                    <div class="geo2d-prop-subtitle">Área</div>
                    <label class="geo2d-check"><input class="geo2d-prop-area-visible" type="checkbox"> Área visible</label>
                    <label class="geo2d-field"><span>Valor área</span><input class="geo2d-prop-area-value" type="text" readonly></label>
                  </div>
                  <div class="geo2d-prop-notables-wrap">
                    <div class="geo2d-prop-subtitle">Puntos notables</div>
                    <div class="geo2d-prop-notables-list"></div>
                  </div>
                </div>
              </section>
            </aside>
          </div>
          <div class="geo2d-modal-backdrop">
            <div class="geo2d-modal">
              <div class="geo2d-modal-head">Publicar HTML</div>
              <div class="geo2d-modal-body">
                <textarea class="geo2d-publish-area"></textarea>
              </div>
              <div class="geo2d-modal-foot">
                <button class="geo2d-btn" data-action="copy-published-locked">Copy locked</button>
                <button class="geo2d-btn" data-action="copy-published-interactive">Copy interactive</button>
                <button class="geo2d-btn" data-action="close-modal">Cerrar</button>
              </div>
            </div>
          </div>
        `;
      }

      this.titleInput = this.root.querySelector('.geo2d-title');
      this.svg = this.root.querySelector('.geo2d-svg');
      this.jsonArea = this.root.querySelector('.geo2d-jsonarea');
      this.statusEl = this.root.querySelector('.geo2d-status');
      this.objectListEl = this.root.querySelector('.geo2d-object-list');
      this.propIdEl = this.root.querySelector('.geo2d-prop-id');
      this.propTypeEl = this.root.querySelector('.geo2d-prop-type');
      this.propLabelEl = this.root.querySelector('.geo2d-prop-label');
      this.propRefsEl = this.root.querySelector('.geo2d-prop-refs');
      this.propVisibleEl = this.root.querySelector('.geo2d-prop-visible');
      this.propIdWrapEl = this.root.querySelector('.geo2d-prop-id-wrap');
      this.propTypeWrapEl = this.root.querySelector('.geo2d-prop-type-wrap');
      this.propLabelWrapEl = this.root.querySelector('.geo2d-prop-label-wrap');
      this.propRefsWrapEl = this.root.querySelector('.geo2d-prop-refs-wrap');
      this.propVisibleWrapEl = this.root.querySelector('.geo2d-prop-visible-wrap');
      this.propExtraWrapEl = this.root.querySelector('.geo2d-prop-extra-wrap');
      this.propExtraSelectEl = this.root.querySelector('.geo2d-prop-extra');
      this.propAreaWrapEl = this.root.querySelector('.geo2d-prop-area-wrap');
      this.propAreaVisibleEl = this.root.querySelector('.geo2d-prop-area-visible');
      this.propAreaValueEl = this.root.querySelector('.geo2d-prop-area-value');
      this.propNotablesWrapEl = this.root.querySelector('.geo2d-prop-notables-wrap');
      this.propNotablesListEl = this.root.querySelector('.geo2d-prop-notables-list');
      this.modalBackdrop = this.root.querySelector('.geo2d-modal-backdrop');
      this.publishArea = this.root.querySelector('.geo2d-publish-area');

      this.hiddenFileInput = document.createElement('input');
      this.hiddenFileInput.type = 'file';
      this.hiddenFileInput.accept = '.json,.geo2d.json,application/json';
      this.hiddenFileInput.style.display = 'none';
      this.root.appendChild(this.hiddenFileInput);
    }

    bindToolbarAndTabs() {
      this.root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action], [data-tool], [data-tab], [data-tool-group-toggle]');
        if (!btn) return;
        if (btn.dataset.action) this.handleAction(btn.dataset.action);
        if (btn.dataset.toolGroupToggle) {
          this.openToolGroup = btn.dataset.toolGroupToggle;
          this.refreshUI();
        }
        if (btn.dataset.tool) this.activateTool(btn.dataset.tool);
        if (btn.dataset.tab) {
          this.activeTab = btn.dataset.tab;
          this.refreshUI();
        }
      });
    }

    bindObjectList() {
      this.objectListEl?.addEventListener('click', (e) => {
        const item = e.target.closest('[data-object-id]');
        if (!item) return;

        const part = item.dataset.partKind
          ? {
            kind: item.dataset.partKind,
            edgeIndex: item.dataset.edgeIndex !== undefined ? safeNumber(item.dataset.edgeIndex, null) : null
          }
          : null;
        this.selectObjectPart(item.dataset.objectId, part);
      });
    }

    bindTitleInput() {
      this.titleInput?.addEventListener('input', () => {
        this.model.meta.title = this.titleInput.value || 'Escena Geo2D';
        this.syncJsonFromScene();
      });
      this.titleInput?.addEventListener('change', () => this.commitHistoryState());
    }

    bindPropertyInputs() {
      this.propLabelEl?.addEventListener('input', () => {
        this.updateSelectedObjectLabel(this.propLabelEl.value);
      });
      this.propLabelEl?.addEventListener('change', () => this.commitHistoryState());

      this.propVisibleEl?.addEventListener('change', () => {
        this.updateSelectedObjectVisibility(this.propVisibleEl.checked);
      });

      this.propExtraSelectEl?.addEventListener('change', () => {
        this.updateSelectedObjectExtra(this.propExtraSelectEl.value);
      });

      this.propAreaVisibleEl?.addEventListener('change', () => {
        this.updateSelectedPolygonAreaVisibility(this.propAreaVisibleEl.checked);
      });

      this.propNotablesListEl?.addEventListener('change', (e) => {
        const input = e.target.closest('[data-notable-visible]');
        if (!input) return;
        this.updateEllipseNotablePointVisibility(input.dataset.notableVisible, input.checked);
      });

      this.propNotablesListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-notable-select]');
        if (!btn || btn.disabled) return;
        this.selectObject(btn.dataset.notableSelect);
      });
    }

    bindFileInput() {
      this.hiddenFileInput.addEventListener('change', () => {
        const file = this.hiddenFileInput.files && this.hiddenFileInput.files[0];
        if (!file) return;
        file.text().then(text => this.loadSceneFromText(text));
        this.hiddenFileInput.value = '';
      });
    }

    bindSvgPointerEvents() {
      this.svg.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.svg.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.svg.addEventListener('pointerup', (e) => this.onPointerUp(e));
      this.svg.addEventListener('pointercancel', (e) => this.onPointerUp(e));
      this.svg.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      this.svg.addEventListener('pointerleave', () => {
        if (!this._dragInfo && !this._viewDragInfo) this.clearHoverAndPreview();
      });
    }

    bindUI() {
      if (this.mode !== 'viewer') {
        this.bindToolbarAndTabs();
        this.bindObjectList();
        this.bindTitleInput();
        this.bindPropertyInputs();
        this.bindFileInput();
      }

      this.bindSvgPointerEvents();
    }

    setStatus(message, isError = false) {
      if (!this.statusEl) return;
      this.statusEl.textContent = message || '';
      this.statusEl.style.color = isError ? '#b91c1c' : '#111827';
    }

    nextId(prefix = 'o') {
      let id;
      do {
        id = `${prefix}${this._objectCounter++}`;
      } while (this.model.hasId(id));
      return id;
    }

    render() {
      if (!this.svg) return;
      renderSceneToSvg(this.svg, this.model, this);
      this.refreshUI();
    }

    renderDuringInteraction() {
      renderSceneToSvg(this.svg, this.model, this);
    }

    scheduleRender() {
      if (this._resizeFrame || !this.svg) return;
      const schedule = window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : (fn) => window.setTimeout(fn, 0);
      this._cancelResizeFrame = window.cancelAnimationFrame
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);
      this._resizeFrame = schedule(() => {
        this._resizeFrame = null;
        this.render();
      });
    }

    renderAfterLayoutChange() {
      this.refreshUI();
      this.scheduleRender();
    }

    cancelViewportHistoryCommit() {
      if (!this._viewportHistoryTimer) return;
      const clear = window.clearTimeout
        ? window.clearTimeout.bind(window)
        : clearTimeout;
      clear(this._viewportHistoryTimer);
      this._viewportHistoryTimer = null;
    }

    queueViewportHistoryCommit() {
      if (this.mode === 'viewer') return;
      this.cancelViewportHistoryCommit();
      const schedule = window.setTimeout
        ? window.setTimeout.bind(window)
        : setTimeout;
      this._viewportHistoryTimer = schedule(() => {
        this._viewportHistoryTimer = null;
        this.commitHistoryState();
      }, WHEEL_ZOOM_HISTORY_DELAY);
    }

    installResizeObserver() {
      if (typeof window.ResizeObserver !== 'function' || !this.svg) return;
      let lastWidth = 0;
      let lastHeight = 0;
      this._resizeObserver = new window.ResizeObserver(() => {
        const rect = this.svg.getBoundingClientRect();
        const width = Math.round(rect.width || 0);
        const height = Math.round(rect.height || 0);
        if (Math.abs(width - lastWidth) < 1 && Math.abs(height - lastHeight) < 1) return;
        lastWidth = width;
        lastHeight = height;
        this.scheduleRender();
      });
      this._resizeObserver.observe(this.svg);
    }

    renderAndSync(commit = true) {
      this.render();
      this.syncJsonFromScene();
      if (commit) this.commitHistoryState();
    }

    syncJsonFromScene() {
      if (this.titleInput) this.titleInput.value = this.model.meta.title || 'Nueva escena';
      if (this.jsonArea) this.jsonArea.value = jsonPretty(this.model.serializeConstruction());
    }

    applySceneState(scene, options = {}) {
      this.model.replaceScene(scene);
      this.hitTester = new Geo2DHitTester(this);
      this.construction = new Geo2DConstructionControllerV2(this);
      this._objectCounter = this.model.objects.length + 1;
      this.resetConstructionState();
      if (options.clearSelection) {
        this.selectedObjectId = null;
        this.selectedPart = null;
      }
      if (options.selectedObjectId !== undefined) this.selectedObjectId = options.selectedObjectId;
      if (options.selectedPart !== undefined) this.selectedPart = this.normalizeSelectedPart(options.selectedPart);
      if (this.selectedObjectId && !this.model.hasId(this.selectedObjectId)) this.selectedObjectId = null;
      if (!this.selectedObjectId) this.selectedPart = null;
      this.resetSelectionCycle();
      if (options.activeTab) this.activeTab = options.activeTab;
      this.render();
      if (options.syncJson !== false) this.syncJsonFromScene();
      if (options.resetHistory) this.resetHistory();
      if (options.status) this.setStatus(options.status);
    }

    applyJsonToScene() {
      if (!this.jsonArea) return;
      this.applySceneState(parseSceneText(this.jsonArea.value), {
        clearSelection: true,
        syncJson: true,
        resetHistory: true,
        status: 'JSON aplicado.'
      });
    }

    createHistoryEntry() {
      return this.history.createEntry();
    }

    createHistorySignature(entry) {
      return this.history.createSignature(entry);
    }

    canUseHistory() {
      return this.history.canUse();
    }

    pushUndoHistoryEntry(entry) {
      this.history.pushUndo(entry);
    }

    replaceHistory(entry) {
      this.history.replace(entry);
    }

    restoreHistoryEntry(entry) {
      this.history.restore(entry);
    }

    applyHistoryEntry(entry) {
      this.history.applyEntry(entry);
    }

    commitHistoryState() {
      return this.history.commit();
    }

    resetHistory() {
      this.history.reset();
    }

    undoLastChange() {
      this.history.undo();
    }

    redoLastChange() {
      this.history.redo();
    }

    refreshTabs() {
      if (this.svg && this.jsonArea) {
        this.svg.style.display = this.activeTab === 'visual' ? 'block' : 'none';
        this.jsonArea.style.display = this.activeTab === 'json' ? 'block' : 'none';
      }

      this.root.querySelectorAll('.geo2d-tab').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === this.activeTab));
    }

    refreshToolButtons() {
      this.root.querySelectorAll('.geo2d-toolbtn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tool === this.activeTool));
      this.root.querySelectorAll('.geo2d-toolgroup').forEach(group => {
        const isOpen = group.dataset.toolGroup === this.openToolGroup;
        group.classList.toggle('is-open', isOpen);
        const items = group.querySelector('.geo2d-toolgroup-items');
        const icon = group.querySelector('[data-role="tool-group-icon"]');
        const head = group.querySelector('.geo2d-toolgroup-head');
        if (items) items.style.setProperty('display', isOpen ? 'grid' : 'none', 'important');
        if (icon) icon.textContent = isOpen ? '-' : '+';
        if (head) head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }

    refreshToolPanel() {
      this.root.classList.toggle('geo2d-tools-collapsed', this.toolPanelOpen === false);
      const toolsContent = this.root.querySelector('[data-section-content="tools"]');
      const toolsToggle = this.root.querySelector('[data-role="tools-toggle"]');
      if (toolsContent) toolsContent.style.setProperty('display', this.toolPanelOpen === false ? 'none' : 'grid', 'important');
      if (toolsToggle) {
        toolsToggle.textContent = this.toolPanelOpen === false ? '+' : '-';
        toolsToggle.setAttribute('aria-expanded', this.toolPanelOpen === false ? 'false' : 'true');
      }
    }

    refreshRightPanel() {
      const isRightCollapsed =
        this.rightPanelOpen?.objects === false &&
        this.rightPanelOpen?.properties === false;
      this.root.classList.toggle('geo2d-right-collapsed', isRightCollapsed);

      this.root.querySelectorAll('[data-right-section]').forEach(section => {
        const key = section.dataset.rightSection;
        const isOpen = this.rightPanelOpen?.[key] !== false;
        const content = section.querySelector('[data-section-content]');
        const toggle = section.querySelector('[data-role$="-toggle"]');
        if (content) content.style.setProperty('display', isOpen ? 'flex' : 'none', 'important');
        if (toggle) {
          toggle.textContent = isOpen ? '-' : '+';
          toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
      });
    }

    refreshHistoryButtons() {
      const undoBtn = this.root.querySelector('[data-action="undo"]');
      const redoBtn = this.root.querySelector('[data-action="redo"]');
      if (undoBtn) undoBtn.disabled = !this.history.canUndo();
      if (redoBtn) redoBtn.disabled = !this.history.canRedo();
    }

    refreshUI() {
      if (this.mode === 'viewer') return;
      this.refreshTabs();
      this.refreshToolButtons();
      this.refreshToolPanel();
      this.refreshRightPanel();
      this.refreshHistoryButtons();

      this.refreshObjectList();
      this.refreshProperties();
    }

    refreshObjectList() {
      if (!this.objectListEl) return;
      if (!this.model.objects.length) {
        this.objectListEl.innerHTML = '<div class="geo2d-object-empty">Sin objetos.</div>';
        return;
      }

      const buckets = new Map(OBJECT_LIST_GROUPS.map(group => [group.id, { group, entries: [] }]));
      for (const obj of this.model.objects) {
        const group = getObjectListGroup(obj);
        const raw = obj.raw;
        buckets.get(group.id).entries.push({
          objectId: obj.id,
          part: null,
          label: obj.id,
          visible: InternalObjectAdapter.isVisible(obj)
        });

        if (InternalObjectAdapter.type(obj) === 'polygon') {
          normalizePolygonParts(raw);

          for (let edgeIndex = 0; edgeIndex < getPolygonEdgeCount(raw); edgeIndex++) {
            const part = { kind: 'polygon-edge', edgeIndex };
            buckets.get('segments').entries.push({
              objectId: obj.id,
              part,
              label: getPolygonPartLabel(raw, part),
              visible: raw.visible !== false && isPolygonEdgeVisible(raw, edgeIndex)
            });
          }
        }
      }

      this.objectListEl.innerHTML = [...buckets.values()]
        .filter(bucket => bucket.entries.length)
        .map(bucket => `
          <div class="geo2d-object-group">
            <div class="geo2d-object-group-title">${escapeHtml(bucket.group.label)}</div>
            ${bucket.entries.map(entry => {
              const selectionPart = entry.part || null;
              const isActive =
                entry.objectId === this.selectedObjectId &&
                this.getSelectionKey(entry.objectId, selectionPart) === this.getSelectionKey(this.selectedObjectId, this.selectedPart);
              const partKindAttr = selectionPart ? ` data-part-kind="${escapeHtml(selectionPart.kind)}"` : '';
              const edgeIndexAttr = selectionPart?.edgeIndex !== undefined && selectionPart?.edgeIndex !== null
                ? ` data-edge-index="${escapeHtml(selectionPart.edgeIndex)}"`
                : '';
              return `
                <button type="button" class="geo2d-object-item${selectionPart ? ' is-part' : ''}${isActive ? ' is-active' : ''}${entry.visible ? '' : ' is-hidden'}" data-object-id="${escapeHtml(entry.objectId)}"${partKindAttr}${edgeIndexAttr}>
                  <span>${escapeHtml(entry.label)}</span>
                  <span class="geo2d-object-state">${entry.visible ? 'visible' : 'oculto'}</span>
                </button>
              `;
            }).join('')}
          </div>
        `).join('');
    }

    getSelectedObjectPropertyState() {
      const obj = this.getSelectedObject();
      if (!obj) {
        return {
          obj: null,
          id: '',
          type: '',
          typeLabel: '',
          label: '',
          refs: '',
          visible: false,
          isAngle: false,
          isPolygon: false,
          isEllipse: false,
          isPart: false,
          labelEditable: false,
          areaVisible: false,
          areaValue: '',
          notablePoints: [],
          unit: 'deg'
        };
      }

      const type = InternalObjectAdapter.type(obj);
      const isAngle = type === 'measure' && obj.raw.measureType === 'angle';
      const isPolygon = type === 'polygon';
      const isEllipse = type === 'ellipse';
      const selectedPart = type === 'polygon' ? this.normalizeSelectedPart(this.selectedPart) : null;
      let areaValue = '';
      if (isPolygon) {
        const resolved = this.model.getResolvedObject(obj.id);
        areaValue = resolved?.kind === 'polygon' ? formatNumberShort(polygonArea(resolved.points)) : '';
      }

      if (selectedPart) {
        const isPolygonFillPart = selectedPart.kind === 'polygon-fill';
        return {
          obj,
          id: getPolygonPartLabel(obj.raw, selectedPart),
          type,
          typeLabel: getPolygonPartTypeLabel(selectedPart),
          label: '',
          refs: describePolygonPart(obj.raw, selectedPart),
          visible: isPolygonPartVisible(obj.raw, selectedPart),
          isAngle: false,
          isPolygon: isPolygonFillPart,
          isEllipse: false,
          isPart: true,
          labelEditable: false,
          areaVisible: isPolygonFillPart ? isPolygonFillVisible(obj.raw) : false,
          areaValue: isPolygonFillPart ? areaValue : '',
          notablePoints: [],
          unit: 'deg'
        };
      }

      return {
        obj,
        id: obj.id,
        type,
        typeLabel: getObjectTypeLabel(obj),
        label: type === 'text' ? (obj.raw.text || '') : (obj.raw.label || ''),
        refs: describeObjectRefs(obj),
        visible: InternalObjectAdapter.isVisible(obj),
        isAngle,
        isPolygon,
        isEllipse,
        isPart: false,
        labelEditable: true,
        areaVisible: isPolygon ? isPolygonFillVisible(obj.raw) : false,
        areaValue,
        notablePoints: isEllipse ? this.getEllipseNotablePointEntries(obj.raw) : [],
        unit: isAngle && obj.raw.unit === 'rad' ? 'rad' : 'deg'
      };
    }

    getEllipseNotablePointEntries(raw) {
      if (!raw || InternalObjectAdapter.type(raw) !== 'ellipse') return [];

      const defs = [
        { key: 'center', label: 'Centro', id: raw.center },
        { key: 'vertex', label: 'Vértice', id: raw.vertex },
        { key: 'coVertex', label: 'Covértice', id: raw.coVertex },
        { key: 'antiVertex', label: 'Antivértice', id: raw.derivedPoints?.antiVertex },
        { key: 'antiCoVertex', label: 'Anticovértice', id: raw.derivedPoints?.antiCoVertex }
      ];

      return defs.map(def => {
        const id = String(def.id || '').trim();
        const point = id ? this.model.getObject(id) : null;
        const isPoint = !!point?.isPointLike?.();
        return {
          ...def,
          id,
          exists: isPoint,
          visible: isPoint ? InternalObjectAdapter.isVisible(point) : false
        };
      });
    }

    renderEllipseNotablePointEntries(entries = []) {
      if (!this.propNotablesListEl) return;

      this.propNotablesListEl.innerHTML = entries.map(entry => {
        const id = entry.id || '—';
        const disabled = !entry.exists;
        return `
          <div class="geo2d-notable-row">
            <button type="button" class="geo2d-notable-main" data-notable-select="${escapeHtml(entry.id)}"${disabled ? ' disabled' : ''}>
              <span class="geo2d-notable-role">${escapeHtml(entry.label)}</span>
              <span class="geo2d-notable-id">${escapeHtml(id)}</span>
            </button>
            <label class="geo2d-check geo2d-notable-visible">
              <input type="checkbox" data-notable-visible="${escapeHtml(entry.id)}"${entry.visible ? ' checked' : ''}${disabled ? ' disabled' : ''}>
              Visible
            </label>
          </div>
        `;
      }).join('');
    }

    updateSelectedObjectLabel(value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;
      if (this.selectedPart) return false;

      if (InternalObjectAdapter.type(obj) === 'text') obj.raw.text = value;
      else obj.raw.label = value;
      this.renderAndSync(false);
      return true;
    }

    updateSelectedObjectVisibility(value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;

      if (this.selectedPart && InternalObjectAdapter.type(obj) === 'polygon') {
        if (!setPolygonPartVisible(obj.raw, this.selectedPart, value)) return false;
        this.renderAndSync();
        return true;
      }

      obj.raw.visible = !!value;
      this.renderAndSync();
      return true;
    }

    updateSelectedObjectExtra(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'measure' || obj.raw.measureType !== 'angle') return false;

      obj.raw.unit = value === 'rad' ? 'rad' : 'deg';
      this.renderAndSync();
      return true;
    }

    updateSelectedPolygonAreaVisibility(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'polygon') return false;
      const selectedPart = this.normalizeSelectedPart(this.selectedPart);
      if (selectedPart && selectedPart.kind !== 'polygon-fill') return false;

      setPolygonFillVisible(obj.raw, value);
      this.renderAndSync();
      return true;
    }

    updateEllipseNotablePointVisibility(pointId, value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'ellipse') return false;

      const id = String(pointId || '').trim();
      const allowedIds = new Set(this.getEllipseNotablePointEntries(obj.raw).map(entry => entry.id).filter(Boolean));
      if (!allowedIds.has(id)) return false;

      const point = this.model.getObject(id);
      if (!point?.isPointLike?.()) return false;

      point.raw.visible = !!value;
      this.renderAndSync();
      return true;
    }

    setPropertyRowVisible(row, visible, display = 'flex') {
      if (!row) return;
      row.style.setProperty('display', visible ? display : 'none', 'important');
    }

    refreshProperties() {
      const state = this.getSelectedObjectPropertyState();
      const fields = [this.propIdEl, this.propTypeEl, this.propLabelEl, this.propRefsEl, this.propVisibleEl, this.propExtraSelectEl, this.propAreaVisibleEl, this.propAreaValueEl].filter(Boolean);
      fields.forEach(field => { field.disabled = !state.obj; });
      if (this.propLabelEl) this.propLabelEl.disabled = !state.obj || state.labelEditable === false;

      if (!this.propLabelEl || !this.propVisibleEl) return;
      if (!state.obj) {
        this.setPropertyRowVisible(this.propIdWrapEl, false);
        this.setPropertyRowVisible(this.propTypeWrapEl, false);
        this.setPropertyRowVisible(this.propLabelWrapEl, false);
        this.setPropertyRowVisible(this.propRefsWrapEl, false);
        this.setPropertyRowVisible(this.propVisibleWrapEl, false);
        this.setPropertyRowVisible(this.propExtraWrapEl, false);
        this.setPropertyRowVisible(this.propAreaWrapEl, false);
        this.setPropertyRowVisible(this.propNotablesWrapEl, false);
        if (this.propIdEl) this.propIdEl.value = '';
        if (this.propTypeEl) this.propTypeEl.value = '';
        this.propLabelEl.value = '';
        if (this.propRefsEl) this.propRefsEl.value = '';
        this.propVisibleEl.checked = false;
        if (this.propExtraSelectEl) this.propExtraSelectEl.value = 'deg';
        if (this.propAreaVisibleEl) this.propAreaVisibleEl.checked = false;
        if (this.propAreaValueEl) this.propAreaValueEl.value = '';
        this.renderEllipseNotablePointEntries([]);
        return;
      }

      this.setPropertyRowVisible(this.propIdWrapEl, true);
      this.setPropertyRowVisible(this.propTypeWrapEl, true);
      this.setPropertyRowVisible(this.propLabelWrapEl, state.labelEditable !== false);
      this.setPropertyRowVisible(this.propRefsWrapEl, true);
      this.setPropertyRowVisible(this.propVisibleWrapEl, true);
      this.setPropertyRowVisible(this.propExtraWrapEl, state.isAngle);
      this.setPropertyRowVisible(this.propAreaWrapEl, state.isPolygon);
      this.setPropertyRowVisible(this.propNotablesWrapEl, state.isEllipse);
      if (this.propIdEl) this.propIdEl.value = state.id;
      if (this.propTypeEl) this.propTypeEl.value = state.typeLabel;
      this.propLabelEl.value = state.label;
      if (this.propRefsEl) this.propRefsEl.value = state.refs;
      this.propVisibleEl.checked = state.visible;
      if (this.propExtraWrapEl && this.propExtraSelectEl) {
        this.propExtraSelectEl.disabled = !state.isAngle;
        this.propExtraSelectEl.value = state.unit;
      }
      if (this.propAreaVisibleEl) {
        this.propAreaVisibleEl.disabled = !state.isPolygon;
        this.propAreaVisibleEl.checked = state.areaVisible;
      }
      if (this.propAreaValueEl) this.propAreaValueEl.value = state.areaValue;
      this.renderEllipseNotablePointEntries(state.isEllipse ? state.notablePoints : []);
    }

    handleAction(action) {
      try {
        const handler = EDITOR_ACTION_HANDLERS[action];
        if (handler) handler(this);
      } catch (err) {
        this.setStatus('Error: ' + err.message, true);
      }
    }

    loadSceneFromText(text) {
      try {
        this.applySceneState(parseSceneText(text), { clearSelection: true, syncJson: true, resetHistory: true, status: 'Cargada.' });
      } catch (err) {
        this.setStatus('Error: ' + err.message, true);
      }
    }

    publishScene(viewerMode = 'explore') {
      const id = 'geo2d-' + Math.random().toString(36).slice(2, 8);
      const sceneAttr = serializeSceneForDataAttr(this.model.serializeConstruction());
      const mode = normalizeViewerMode(viewerMode);
      return `<div class="geo2d-viewer" id="${id}" data-geo2d-viewer data-viewer-mode="${mode}" data-scene="${sceneAttr}"></div>`;
    }

    activateTool(tool) {
      this.activeTool = tool;
      this.openToolGroup = getToolGroupForTool(tool);
      this.resetConstructionState();
      this.resetSelectionCycle();
      this.clearHoverAndPreview();
      this.refreshUI();
      this.setStatus('Herramienta: ' + tool);
    }

    normalizeSelectedPart(part) {
      if (!part || typeof part !== 'object') return null;

      if (part.kind === 'polygon-fill') {
        return { kind: 'polygon-fill' };
      }

      if (part.kind === 'polygon-edge') {
        const edgeIndex = normalizeEdgeIndex(part.edgeIndex);
        return edgeIndex === null ? null : { kind: 'polygon-edge', edgeIndex };
      }

      return null;
    }

    getSelectionKey(id, part = null) {
      const cleanPart = this.normalizeSelectedPart(part);
      if (!cleanPart) return String(id || '');
      if (cleanPart.kind === 'polygon-fill') return `${id}:fill`;
      if (cleanPart.kind === 'polygon-edge') return `${id}:edge:${cleanPart.edgeIndex}`;
      return String(id || '');
    }

    selectObject(id, render = true) {
      this.selectedObjectId = id && this.model.hasId(id) ? id : null;
      this.selectedPart = null;
      this.refreshUI();
      if (render) this.render();
    }

    selectObjectPart(id, part = null, render = true) {
      this.selectedObjectId = id && this.model.hasId(id) ? id : null;
      this.selectedPart = this.selectedObjectId ? this.normalizeSelectedPart(part) : null;
      this.refreshUI();
      if (render) this.render();
    }

    getSelectedObject() {
      return this.selectedObjectId ? this.model.getObject(this.selectedObjectId) : null;
    }

    resetSelectionCycle() {
      this._selectionCycleIndex = 0;
      this._lastHitIds = [];
      this._lastHitSx = null;
      this._lastHitSy = null;
    }

    findObjectsAtScreen(sx, sy) {
      return this.hitTester.selectionHitsAtScreen(sx, sy);
    }

    selectFromHits(hits, sx, sy) {
      if (!hits.length) {
        this.selectObject(null);
        this.resetSelectionCycle();
        return;
      }
      const ids = hits.map(h => this.getSelectionKey(h.id, h.partKind ? { kind: h.partKind, edgeIndex: h.edgeIndex } : null));
      const sameSet =
        this._lastHitIds.length === ids.length &&
        this._lastHitIds.every((id, i) => id === ids[i]) &&
        this._lastHitSx !== null &&
        this._lastHitSy !== null &&
        dist2(sx, sy, this._lastHitSx, this._lastHitSy) < 36;
      this._selectionCycleIndex = sameSet && ids.length > 1 ? (this._selectionCycleIndex + 1) % ids.length : 0;
      this._lastHitIds = ids;
      this._lastHitSx = sx;
      this._lastHitSy = sy;
      const hit = hits[this._selectionCycleIndex];
      this.selectObjectPart(hit.id, hit.partKind ? { kind: hit.partKind, edgeIndex: hit.edgeIndex } : null);
    }

    getSvgPointerInfo(e) {
      const r = this.svg.getBoundingClientRect();
      const width = Math.max(1, r.width || this._svgWidth || 800);
      const height = Math.max(1, r.height || this._svgHeight || 600);
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      return {
        sx,
        sy,
        width,
        height,
        world: screenToWorld(this.model.viewport, width, height, sx, sy)
      };
    }

    capturePointer(e) {
      if (e?.pointerId !== undefined && this.svg?.setPointerCapture) {
        try { this.svg.setPointerCapture(e.pointerId); } catch (_) {}
      }
    }

    releasePointer(e) {
      if (e?.pointerId !== undefined && this.svg?.releasePointerCapture) {
        try { this.svg.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    }

    startObjectDrag(objectId, e) {
      const obj = this.model.getObject(objectId);
      if (!obj || !obj.isDraggable()) return false;

      this._dragInfo = { objectId, pointerId: e?.pointerId };
      this._viewDragInfo = null;
      this.selectObject(objectId, false);
      this.capturePointer(e);
      return true;
    }

    startViewDrag(info, e) {
      this._viewDragInfo = {
        pointerId: e?.pointerId,
        startViewport: deepClone(this.model.viewport),
        startWorld: info.world
      };
      this._dragInfo = null;
      this.capturePointer(e);
    }

    handleMovePointerDown(info, e) {
      const nearPoint = this.findNearestPointAtScreen(info.sx, info.sy);
      if (nearPoint && this.startObjectDrag(nearPoint.id, e)) return;

      const hits = this.findObjectsAtScreen(info.sx, info.sy);
      if (hits.length) {
        const hitObject = this.model.getObject(hits[0].id);
        if (hitObject?.isDraggable() && this.startObjectDrag(hitObject.id, e)) return;
        if (this.mode !== 'viewer') this.selectFromHits(hits, info.sx, info.sy);
        return;
      }

      if (this.mode !== 'viewer') this.selectObject(null);
      this.startViewDrag(info, e);
    }

    handleObjectDragPointerMove(info) {
      if (!this._dragInfo) return false;

      const obj = this.model.getObject(this._dragInfo.objectId);
      if (obj?.isDraggable()) {
        obj.dragTo(this.model, info.world.x, info.world.y);
        this.renderDuringInteraction();
      }

      return true;
    }

    handleViewPointerMove(info) {
      if (!this._viewDragInfo) return false;

      const startViewport = this._viewDragInfo.startViewport;
      const currentFromStart = screenToWorld(startViewport, info.width, info.height, info.sx, info.sy);
      const dx = this._viewDragInfo.startWorld.x - currentFromStart.x;
      const dy = this._viewDragInfo.startWorld.y - currentFromStart.y;
      this.model.viewport = {
        ...startViewport,
        xMin: startViewport.xMin + dx,
        xMax: startViewport.xMax + dx,
        yMin: startViewport.yMin + dy,
        yMax: startViewport.yMax + dy
      };
      this.renderDuringInteraction();

      return true;
    }

    zoomViewportAtPointer(info, deltaY) {
      if (!info || !Number.isFinite(deltaY) || Math.abs(deltaY) < 1e-9) return false;

      const normalizedDelta = clamp(deltaY, -600, 600);
      const zoomFactor = Math.exp(normalizedDelta * 0.0015);
      if (Math.abs(zoomFactor - 1) < 1e-6) return false;

      const previous = this.model.viewport;
      const next = viewportZoomAt(previous, zoomFactor, info.world.x, info.world.y);
      if (
        !next ||
        (
          Math.abs(next.xMin - previous.xMin) < 1e-12 &&
          Math.abs(next.xMax - previous.xMax) < 1e-12 &&
          Math.abs(next.yMin - previous.yMin) < 1e-12 &&
          Math.abs(next.yMax - previous.yMax) < 1e-12
        )
      ) {
        return false;
      }

      this.model.viewport = next;

      if (this.mode === 'viewer') {
        this.render();
      } else {
        this.renderDuringInteraction();
        this.syncJsonFromScene();
        this.queueViewportHistoryCommit();
      }

      return true;
    }

    finishPointerInteraction(e) {
      const hadInteraction = !!(this._dragInfo || this._viewDragInfo);
      if (!hadInteraction) return false;

      this._dragInfo = null;
      this._viewDragInfo = null;
      this.releasePointer(e);

      if (this.mode === 'viewer') this.render();
      else this.renderAndSync();

      return true;
    }

    collectDependentIds(rootId) {
      const ids = new Set([rootId]);
      let changed = true;

      while (changed) {
        changed = false;
        for (const obj of this.model.objects) {
          if (ids.has(obj.id)) continue;
          const refs = InternalObjectAdapter.refs(obj);
          if (refs.some(refId => ids.has(refId))) {
            ids.add(obj.id);
            changed = true;
          }
        }
      }

      return ids;
    }

    deleteAtScreen(sx, sy) {
      const hits = this.findObjectsAtScreen(sx, sy);
      if (!hits.length) {
        this.setStatus('Borrar: selecciona un objeto.', true);
        return;
      }

      const rootId = hits[0].id;
      const ids = this.collectDependentIds(rootId);
      this.model.removeIds(ids);
      this.selectedObjectId = null;
      this.selectedPart = null;
      this.resetConstructionState();
      this.renderAndSync();
      this.setStatus(ids.size > 1 ? `Borrado ${rootId} y ${ids.size - 1} dependiente(s).` : `Borrado ${rootId}.`);
    }

    onPointerDown(e) {
      if (e?.button !== undefined && e.button > 0) return;
      if (this.activeTab && this.activeTab !== 'visual') return;
      if (this.isViewerLocked()) return;

      const info = this.getSvgPointerInfo(e);

      if (this.mode === 'viewer' || this.activeTool === 'move') {
        this.handleMovePointerDown(info, e);
        e?.preventDefault?.();
        return;
      }

      if (this.activeTool === 'delete') {
        this.deleteAtScreen(info.sx, info.sy);
        e?.preventDefault?.();
        return;
      }

      this.dispatchConstructionToolClick(info.world, info.sx, info.sy);
      e?.preventDefault?.();
    }

    onPointerMove(e) {
      if (this.isViewerLocked()) return;
      const info = this.getSvgPointerInfo(e);

      if (this.handleObjectDragPointerMove(info)) {
        e?.preventDefault?.();
        return;
      }

      if (this.handleViewPointerMove(info)) {
        e?.preventDefault?.();
        return;
      }

      if (this.mode !== 'viewer' && this.activeTab === 'visual') {
        this.updateHoverAndPreview(info.sx, info.sy, info.world);
      }
    }

    onWheel(e) {
      if (this.isViewerLocked()) return;
      if (this.activeTab && this.activeTab !== 'visual') return;
      e?.preventDefault?.();

      const info = this.getSvgPointerInfo(e);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? info.height : 1;
      const deltaY = safeNumber(e.deltaY, 0) * unit;

      this.zoomViewportAtPointer(info, deltaY);
    }

    onPointerUp(e) {
      if (this.finishPointerInteraction(e)) e?.preventDefault?.();
    }

    findNearestPointAtScreen(sx, sy) { return this.hitTester.nearestPointAtScreen(sx, sy); }
    findNearestAnchorObjectAtScreen(sx, sy, world) { return this.hitTester.nearestAnchorObjectAtScreen(sx, sy, world); }
    findNearestDirectionalObjectAtScreen(sx, sy) { return this.hitTester.nearestDirectionalObjectAtScreen(sx, sy); }
    findNearestVectorAtScreen(sx, sy) { return this.hitTester.nearestVectorAtScreen(sx, sy); }
    findNearestIntersectableObjectAtScreen(sx, sy, excludeId = null) { return this.hitTester.nearestIntersectableObjectAtScreen(sx, sy, excludeId); }
    getHoveredObjectForTool(sx, sy) { return this.hitTester.hoveredObjectForTool(sx, sy); }

    setHoverPreviewState(nextState = {}) {
      let dirty = false;
      if (Object.prototype.hasOwnProperty.call(nextState, 'hoverPointId') && nextState.hoverPointId !== this._hoverPointId) {
        this._hoverPointId = nextState.hoverPointId;
        dirty = true;
      }
      if (Object.prototype.hasOwnProperty.call(nextState, 'hoverObjectId') && nextState.hoverObjectId !== this._hoverObjectId) {
        this._hoverObjectId = nextState.hoverObjectId;
        dirty = true;
      }
      if (Object.prototype.hasOwnProperty.call(nextState, 'hoverObjectEdgeIndex') && nextState.hoverObjectEdgeIndex !== this._hoverObjectEdgeIndex) {
        this._hoverObjectEdgeIndex = nextState.hoverObjectEdgeIndex;
        dirty = true;
      }
      if (Object.prototype.hasOwnProperty.call(nextState, 'previewWorld') && !sameWorld(this._previewWorld, nextState.previewWorld)) {
        this._previewWorld = nextState.previewWorld;
        dirty = true;
      }
      return dirty;
    }

    clearHoverAndPreview() {
      const dirty = this.setHoverPreviewState({ hoverPointId: null, hoverObjectId: null, hoverObjectEdgeIndex: null, previewWorld: null });
      if (dirty) this.render();
    }

    updateHoverAndPreview(sx, sy, world) {
      const nearPoint = this.findNearestPointAtScreen(sx, sy);
      const hoveredObject = this.getHoveredObjectForTool(sx, sy);
      let nextHoverObjectId = null;
      let nextHoverObjectEdgeIndex = null;
      if (hoveredObject && (!nearPoint || ['intersect', 'vector-equipollent', 'parallel-line', 'perpendicular-line'].includes(this.activeTool))) {
        nextHoverObjectId = hoveredObject.id;
        nextHoverObjectEdgeIndex = normalizeEdgeIndex(hoveredObject.edgeIndex);
      }
      let nextPreview = null;
      if (this.mode !== 'viewer' && toolUsesAnchorPreview(this.activeTool) && !nearPoint) {
        const snapped = this.getSnappedWorldPosition(world, sx, sy);
        nextPreview = { x: snapped.x, y: snapped.y };
      }
      const dirty = this.setHoverPreviewState({
        hoverPointId: nearPoint ? nearPoint.id : null,
        hoverObjectId: nextHoverObjectId,
        hoverObjectEdgeIndex: nextHoverObjectEdgeIndex,
        previewWorld: nextPreview
      });
      if (dirty) this.render();
    }

    generatePointName() {
      for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (!this.model.hasId(c)) return c;
      }
      return this.nextId('P');
    }

    generateAuxiliaryPointName(prefix = 'P', reserved = new Set()) {
      const cleanPrefix = String(prefix || 'P').trim().toUpperCase() || 'P';
      for (let i = 1; i < 1000000; i++) {
        const id = `${cleanPrefix}${i}`;
        if (!this.model.hasId(id) && !reserved.has(id)) return id;
      }
      return this.nextId(cleanPrefix);
    }

    addFreePoint(x, y, sync = true) {
      const id = this.generatePointName();
      this.model.addObject({ id, type: 'point', x, y, label: id, draggable: true, style: { fill: FREE_POINT_FILL } });
      if (sync) this.renderAndSync();
      return id;
    }

    addConstrainedPoint(constraintRaw, sync = true, options = {}) {
      const id = options.id || this.generatePointName();
      const raw = {
        id,
        type: 'point',
        label: options.label !== undefined ? String(options.label) : id,
        draggable: options.draggable !== undefined ? !!options.draggable : true,
        style: options.style ? deepClone(options.style) : { fill: DEPENDENT_POINT_FILL },
        constraint: deepClone(constraintRaw)
      };
      if (options.visible !== undefined) raw.visible = !!options.visible;
      this.model.addObject(raw);
      if (sync) this.renderAndSync();
      return id;
    }

    addVectorEndPoint(vectorId, sync = true) {
      return this.addConstrainedPoint({ kind: 'vector-end', objectId: vectorId }, sync, {
        draggable: false,
        style: { fill: DEPENDENT_POINT_FILL }
      });
    }

    addEllipseDerivedPoint(ellipseId, role, id = null, sync = true, options = {}) {
      return this.addConstrainedPoint({ kind: 'ellipse-derived-point', objectId: ellipseId, role }, sync, {
        id: id || this.generateAuxiliaryPointName('P'),
        draggable: false,
        visible: options.visible === true,
        style: { fill: DEPENDENT_POINT_FILL }
      });
    }

    addIntersectionPoint(objectId, objectId2, point, sync = true, options = {}) {
      const id = this.generatePointName();
      const edgeIndex = normalizeEdgeIndex(options.edgeIndex);
      const edgeIndex2 = normalizeEdgeIndex(options.edgeIndex2);
      this.model.addObject({
        id,
        type: 'point',
        x: point.x,
        y: point.y,
        label: id,
        draggable: false,
        style: { fill: DEPENDENT_POINT_FILL },
        constraint: {
          kind: 'intersection',
          objectId,
          objectId2,
          ...(edgeIndex !== null ? { edgeIndex } : {}),
          ...(edgeIndex2 !== null ? { edgeIndex2 } : {}),
          pickX: point.x,
          pickY: point.y
        }
      });
      if (sync) this.renderAndSync();
      return id;
    }

    getIntersectionCandidates(objectId, objectId2, options = {}) {
      const first = this.model.getResolvedObject(objectId);
      const second = this.model.getResolvedObject(objectId2);
      if (!first || !second) return [];
      return resolveObjectIntersections(first, second, {
        edgeIndexA: normalizeEdgeIndex(options.edgeIndex),
        edgeIndexB: normalizeEdgeIndex(options.edgeIndex2)
      });
    }

    pickOrCreateAnchorPoint(world, sx, sy) {
      const nearPoint = this.findNearestPointAtScreen(sx, sy);
      if (nearPoint) return { id: nearPoint.id, created: false, constrained: false, point: nearPoint };
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
        if (snapped) return { x: snapped.x, y: snapped.y, fromPointId: null, constraint: anchorObject.constraint };
      }
      return { x: world.x, y: world.y, fromPointId: null, constraint: null };
    }

    resetConstructionState() {
      this._pendingPoints = [];
      this._hoverPointId = null;
      this._hoverObjectId = null;
      this._hoverObjectEdgeIndex = null;
      this._previewWorld = null;
      this._toolData = null;
    }

    isFigureTool(tool = this.activeTool) { return this.construction.isFigureTool(tool); }
    minPointsForFigureTool(tool = this.activeTool) { return this.construction.minPointsForFigureTool(tool); }
    getFigureToolLabel(tool = this.activeTool) { return this.construction.getFigureToolLabel(tool); }
    dispatchConstructionToolClick(world, sx, sy) { return this.construction.dispatchClick(world, sx, sy); }
    finishPendingFigure() { return this.construction.finishPendingFigure(); }
  }

function autoMount(root = document) {
  const base = root && typeof root.querySelectorAll === 'function'
    ? root
    : document;

  base.querySelectorAll('[data-geo2d-editor]').forEach(el => {
    if (!el.__geo2dMounted) {
      try {
        window.Geo2D.openEditor({
          target: el,
          sceneSource: (el.getAttribute('data-scene') || el.getAttribute('data-geo2d-scene')) ? el : undefined
        });
        el.__geo2dMounted = true;
      } catch (err) {
        console.error('Geo2D no pudo montar un editor automaticamente.', err);
      }
    }
  });

  base.querySelectorAll('[data-geo2d-viewer]').forEach(el => {
    if (!el.__geo2dMounted) {
      try {
        window.Geo2D.openViewer({
          target: el,
          sceneSource: (el.getAttribute('data-scene') || el.getAttribute('data-geo2d-scene')) ? el : undefined
        });
        el.__geo2dMounted = true;
      } catch (err) {
        console.error('Geo2D no pudo montar un visor automaticamente.', err);
      }
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
