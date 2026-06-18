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

  function parsePositiveNumber(value, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function parseAspectRatio(value, fallback = null) {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    const fraction = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)$/);
    if (fraction) {
      const w = Number(fraction[1]);
      const h = Number(fraction[2]);
      return w > 0 && h > 0 ? w / h : fallback;
    }
    return parsePositiveNumber(text, fallback);
  }

  function attrPositiveNumber(el, names, fallback = null) {
    if (!el || typeof el.getAttribute !== 'function') return fallback;
    for (const name of names) {
      const value = parsePositiveNumber(el.getAttribute(name), null);
      if (value !== null) return value;
    }
    return fallback;
  }

  function attrAspectRatio(el, names, fallback = null) {
    if (!el || typeof el.getAttribute !== 'function') return fallback;
    for (const name of names) {
      const value = parseAspectRatio(el.getAttribute(name), null);
      if (value !== null) return value;
    }
    return fallback;
  }

  function classListContains(el, className) {
    return !!el?.classList?.contains?.(className);
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

  function readEmbeddedSceneNodeText(node) {
    if (!node) return null;
    const attrScene = readEmbeddedSceneAttr(node);
    if (attrScene) return attrScene;
    const raw = node.value !== undefined ? node.value : node.textContent || '';
    const text = String(raw || '').trim();
    return text || null;
  }

  function findEmbeddedSceneNode(el) {
    if (!el || typeof el.querySelector !== 'function') return null;
    return el.querySelector(
      '[data-geo2d-scene],' +
      'script[type="application/json"][data-geo2d-scene],' +
      'textarea[data-geo2d-scene],' +
      'template[data-geo2d-scene]'
    );
  }

  function readEmbeddedSceneText(el) {
    const direct = readEmbeddedSceneAttr(el);
    if (direct) return direct;
    const nested = findEmbeddedSceneNode(el);
    return nested ? readEmbeddedSceneNodeText(nested) : null;
  }

  function readSceneSource(sceneSource) {
    if (!sceneSource) return null;

    if (typeof sceneSource === 'string') {
      const el = document.querySelector(sceneSource);
      if (!el) throw new Error('No se encontró sceneSource: ' + sceneSource);
      const embeddedScene = readEmbeddedSceneText(el);
      if (embeddedScene) return embeddedScene;
      return (el.value !== undefined ? el.value : el.textContent || '').trim();
    }

    if (sceneSource instanceof Element) {
      const embeddedScene = readEmbeddedSceneText(sceneSource);
      if (embeddedScene) return embeddedScene;
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

  const GeoMath = {
    clamp,
    dist2,
    dist,
    sameWorld,
    projectParameter,
    pointFromParameter
  };

  const DomUtils = {
    slugify,
    downloadTextFile,
    copyTextToClipboard,
    escapeHtml: function(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  const SceneParser = {
    resolveSceneSourceElement,
    readEmbeddedSceneAttr,
    readEmbeddedSceneNodeText,
    findEmbeddedSceneNode,
    readEmbeddedSceneText,
    readSceneSource,
    unescapeHtmlSceneText,
    extractJsonScriptContent
  };

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

  function isNumberRawType(type) {
    return hasInternalObjectFamily(type, 'number');
  }

  function isTransformRawType(type) {
    return hasInternalObjectFamily(type, 'transform');
  }

  function isTransformableRawType(type) {
    return isPointLikeRawType(type) ||
      isDirectionalRawType(type) ||
      type === 'circle' ||
      type === 'circle-radius' ||
      type === 'polygon' ||
      type === 'regular-polygon';
  }

  const FREE_POINT_FILL = '#ea580c';
  const DEPENDENT_POINT_FILL = '#16a34a';
  const MOBILE_LAYOUT_BREAKPOINT = 820;
  const MIN_VIEWPORT_SPAN = 1e-3;
  const MAX_VIEWPORT_SPAN = 1e6;
  const WHEEL_ZOOM_HISTORY_DELAY = 250;
  const VIEW_OBJECT_ID = '__geo2d_view__';
  const ANGLE_GREEK_LABELS = Object.freeze(['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'λ', 'μ', 'ν', 'ξ', 'π', 'ρ', 'σ', 'τ', 'φ', 'χ', 'ψ', 'ω']);
  const ANGLE_GREEK_LABEL_SET = new Set(ANGLE_GREEK_LABELS);
  const PROPERTY_EXTRA_UNIT_OPTIONS = Object.freeze([
    Object.freeze({ value: 'deg', label: 'Grados' }),
    Object.freeze({ value: 'rad', label: 'Radianes' })
  ]);
  const PROPERTY_EXTRA_BISECTOR_MODE_OPTIONS = Object.freeze([
    Object.freeze({ value: 'normal', label: 'Normal' }),
    Object.freeze({ value: 'concave', label: 'Cóncavo' })
  ]);
  const ANCHOR_PREVIEW_TOOLS = new Set([
    'point',
    'segment',
    'line',
    'parallel-line',
    'perpendicular-line',
    'ray',
    'bisector-ray',
    'vector',
    'vector-equipollent',
    'circle',
    'circle-radius',
    'circle-arc',
    'circular-sector',
    'ellipse',
    'polyline',
    'polygon',
    'regular-polygon',
    'midpoint',
    'intersect',
    'number',
    'measure-distance',
    'measure-angle',
    'angle-measure',
    'text'
  ]);
  const TOOL_PREVIEW_COLORS = Object.freeze({
    point: '#ea580c',
    segment: '#1976d2',
    line: '#2e7d32',
    'parallel-line': '#0284c7',
    'perpendicular-line': '#b45309',
    ray: '#0f766e',
    'bisector-ray': '#0891b2',
    vector: '#7c3aed',
    'vector-equipollent': '#7c3aed',
    circle: '#c62828',
    'circle-radius': '#dc2626',
    'circle-arc': '#0ea5e9',
    'circular-sector': '#0891b2',
    ellipse: '#9333ea',
    polyline: '#0ea5e9',
    polygon: '#ea580c',
    'regular-polygon': '#f97316',
    midpoint: '#2e7d32',
    intersect: '#16a34a',
    number: '#6b7280',
    'measure-distance': '#6b7280',
    'measure-angle': '#6b7280',
    'angle-measure': '#6b7280',
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

  function buildAngleGreekSelectOptionsHtml() {
    const options = ['<option value="">—</option>'];
    for (const symbol of ANGLE_GREEK_LABELS) {
      options.push(`<option value="${symbol}">${symbol}</option>`);
    }
    return options.join('');
  }

  const ANGLE_GREEK_SELECT_OPTIONS_HTML = buildAngleGreekSelectOptionsHtml();

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
      return cleanObjectRefs([
        raw.constraint.objectId,
        raw.constraint.objectId2,
        raw.constraint.select?.by === 'nearest-to-point' ? raw.constraint.select.point : ''
      ]);
    }
    if (raw.constraint.kind === 'regular-polygon-vertex') {
      return cleanObjectRefs([raw.constraint.objectId]);
    }
    return raw.constraint.objectId ? [raw.constraint.objectId] : [];
  }

  function getTwoPointRawObjectRefs(raw) {
    return cleanObjectRefs([raw.p1, raw.p2]);
  }

  function getAngleThreePointRawObjectRefs(raw) {
    return cleanObjectRefs([raw.p1, raw.vertex, raw.p2]);
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

  function getCircleRadiusRawObjectRefs(raw) {
    return cleanObjectRefs([raw.center, raw.radiusRef]);
  }

  function getCircularArcRawObjectRefs(raw) {
    return cleanObjectRefs([raw.center, raw.start, raw.end]);
  }

  function getEllipseRawObjectRefs(raw) {
    return cleanObjectRefs([raw.center, raw.vertex, raw.coVertex]);
  }

  function getRegularPolygonRawObjectRefs(raw) {
    return cleanObjectRefs([raw.center, raw.vertex, raw.radiusRef]);
  }

  function getAngleRawObjectRefs(raw) {
    if (getAngleDefinitionKind(raw) === 'vertex-ray-measure') {
      return cleanObjectRefs([raw.p1, raw.vertex, raw.measureRef]);
    }
    return cleanObjectRefs([raw.p1, raw.vertex, raw.p2]);
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

  function getNumberRawObjectRefs(raw) {
    if (!raw || typeof raw !== 'object') return [];
    const kind = String(raw.numberKind || '').trim();
    if (kind === 'distance') return cleanObjectRefs([raw.p1, raw.p2]);
    if (kind === 'angle') return cleanObjectRefs([raw.p1, raw.vertex, raw.p2]);
    if (kind === 'area') return cleanObjectRefs([raw.objectId]);
    return [];
  }

  function getTransformRawObjectRefs(raw) {
    if (!raw || typeof raw !== 'object') return [];
    const kind = String(raw.transformKind || raw.kind || '').trim();
    if (kind === 'translation') return cleanObjectRefs([raw.vectorId]);
    if (kind === 'rotation') return cleanObjectRefs([raw.center, raw.angleRef]);
    if (kind === 'reflection') return cleanObjectRefs([raw.axis]);
    if (kind === 'central-symmetry') return cleanObjectRefs([raw.center]);
    if (kind === 'homothety') return cleanObjectRefs([raw.center, raw.factorRef]);
    return [];
  }

  function getImageRawObjectRefs(raw) {
    return cleanObjectRefs([
      raw.objectId,
      raw.transformId,
      ...(Array.isArray(raw.imagePoints) ? raw.imagePoints : [])
    ]);
  }

  function uniqueObjectIds(ids) {
    const out = [];
    const seen = new Set();
    for (const id of ids || []) {
      const cleanId = String(id || '').trim();
      if (!cleanId || seen.has(cleanId)) continue;
      seen.add(cleanId);
      out.push(cleanId);
    }
    return out;
  }

  function getDefiningPointIdsForRaw(raw) {
    const type = InternalObjectAdapter.type(raw);
    if (isPointLikeRawType(type)) return uniqueObjectIds([raw.id]);
    if (type === 'segment' || type === 'line' || type === 'ray' || type === 'vector') {
      return uniqueObjectIds([raw.p1, raw.p2]);
    }
    if (type === 'circle') return uniqueObjectIds([raw.center, raw.through]);
    if (type === 'circle-radius') return uniqueObjectIds([raw.center]);
    if (type === 'circle-arc' || type === 'circular-sector') return uniqueObjectIds([raw.center, raw.start, raw.end]);
    if (type === 'polygon' || type === 'polyline') return uniqueObjectIds(raw.points);
    if (type === 'regular-polygon') return uniqueObjectIds([raw.center, raw.vertex, ...(Array.isArray(raw.points) ? raw.points : [])]);
    return [];
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

  function getNumberInterval(raw) {
    const min = safeNumber(raw?.min, -Infinity);
    const max = safeNumber(raw?.max, Infinity);
    return {
      min: Number.isFinite(min) ? min : -Infinity,
      max: Number.isFinite(max) ? max : Infinity
    };
  }

  function clampNumberToInterval(value, raw) {
    const { min, max } = getNumberInterval(raw);
    return Math.max(min, Math.min(max, value));
  }

  function describePointRefs(raw) {
    const c = raw.constraint;
    if (!c) return 'Punto libre';
    if (c.kind === 'intersection') {
      const nearestSuffix = c.select?.by === 'nearest-to-point' && c.select.point
        ? ` cerca de ${c.select.point}`
        : '';
      return `Interseccion de ${joinObjectIds([c.objectId, c.objectId2])}${nearestSuffix}`;
    }
    if (c.kind === 'vector-end') return `Extremo dependiente de ${c.objectId || '—'}`;
    if (c.kind === 'regular-polygon-vertex') {
      return `Vértice ${safeNumber(c.index, 0) + 1} de ${c.objectId || '—'}`;
    }
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

  function describeBisectorRayRefs(raw) {
    return `Bisectriz ${getBisectorModeLabel(raw.mode)} del ángulo ${joinObjectIds([raw.p1, raw.vertex, raw.p2])}`;
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

  function describeAngleRefs(raw) {
    if (getAngleDefinitionKind(raw) === 'vertex-ray-measure') {
      const measureText = String(raw.measureRef || '').trim()
        ? `medida ${String(raw.measureRef || '').trim()}`
        : `${formatNumberShort(raw.measureValue)} ${getAngleUnit(raw) === 'rad' ? 'rad' : 'deg'}`;
      return `Ángulo desde ${joinObjectIds([raw.p1, raw.vertex])}, ${measureText}, dirección ${normalizeAngleDirection(raw.direction, 'ccw')}`;
    }
    return `Ángulo ${joinObjectIds([raw.p1, raw.vertex, raw.p2])}`;
  }

  function describeCircleRadiusRefs(raw) {
    if (String(raw.radiusRef || '').trim()) {
      return `Centro ${raw.center || '—'}, radio ${raw.radiusRef}`;
    }
    return `Centro ${raw.center || '—'}, radio ${formatNumberShort(raw.radius) || '—'}`;
  }

  function describeCircularArcRefs(raw) {
    const direction = normalizeAngleDirection(raw.direction, 'ccw') === 'cw' ? 'horaria' : 'antihoraria';
    return `Centro ${raw.center || '-'}, inicio ${raw.start || '-'}, fin ${raw.end || '-'}, direccion ${direction}`;
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

  function describeRegularPolygonRefs(raw) {
    if (String(raw?.radiusRef || '').trim() || Number.isFinite(safeNumber(raw?.radius, NaN))) {
      const radiusText = String(raw?.radiusRef || '').trim() || formatNumberShort(raw?.radius) || '-';
      return `Polígono regular: centro ${raw.center || '-'}, radio ${radiusText}, ${safeNumber(raw.sides, 0)} lados`;
    }
    return `Polígono regular: centro ${raw.center || '—'}, vértice ${raw.vertex || '—'}, ${safeNumber(raw.sides, 0)} lados`;
  }

  function getNumberKindLabel(value) {
    const cleanValue = String(value || '').trim().toLowerCase();
    if (cleanValue === 'independent') return 'independiente';
    if (cleanValue === 'distance') return 'distancia';
    if (cleanValue === 'angle') return 'ángulo';
    if (cleanValue === 'area') return 'área';
    return cleanValue || 'número';
  }

  function describeNumberRefs(raw) {
    const kind = String(raw?.numberKind || '').trim().toLowerCase();
    if (kind === 'independent') {
      return `Número independiente = ${formatNumberShort(raw.value) || '0'} (paso ${formatNumberShort(raw.step) || '1'})`;
    }
    if (kind === 'distance') {
      return `Distancia ${joinObjectIds([raw.p1, raw.p2])}`;
    }
    if (kind === 'angle') {
      return `Ángulo ${joinObjectIds([raw.p1, raw.vertex, raw.p2])}`;
    }
    if (kind === 'area') {
      return `Área de ${raw.objectId || '-'}`;
    }
    return 'Número';
  }

  function isPolygonHostRawType(type) {
    return type === 'polygon' || type === 'regular-polygon';
  }

  function getTransformKindLabel(value) {
    const cleanValue = String(value || '').trim().toLowerCase();
    if (cleanValue === 'translation') return 'traslacion';
    if (cleanValue === 'rotation') return 'rotacion';
    if (cleanValue === 'reflection') return 'reflexion axial';
    if (cleanValue === 'central-symmetry') return 'simetria central';
    if (cleanValue === 'homothety') return 'homotecia';
    return cleanValue || 'transformacion';
  }

  function describeTransformRefs(raw) {
    const kind = String(raw?.transformKind || '').trim().toLowerCase();
    if (kind === 'translation') return `Traslacion por vector ${raw.vectorId || '-'}`;
    if (kind === 'rotation') {
      const angleText = String(raw.angleRef || '').trim()
        ? raw.angleRef
        : `${formatNumberShort(raw.angle)} ${raw.unit === 'rad' ? 'rad' : 'deg'}`;
      return `Rotacion centro ${raw.center || '-'}, angulo ${angleText}`;
    }
    if (kind === 'reflection') return `Reflexion axial respecto de ${raw.axis || '-'}`;
    if (kind === 'central-symmetry') return `Simetria central respecto de ${raw.center || '-'}`;
    if (kind === 'homothety') {
      const factorText = String(raw.factorRef || '').trim()
        ? raw.factorRef
        : formatNumberShort(raw.factor);
      return `Homotecia centro ${raw.center || '-'}, constante ${factorText || '-'}`;
    }
    return `Transformacion: ${joinObjectIds(getTransformRawObjectRefs(raw))}`;
  }

  function describeImageRefs(raw) {
    return `Imagen de ${raw.objectId || '-'} por ${raw.transformId || '-'}`;
  }

  function getPolygonEdgeCount(raw) {
    if (Array.isArray(raw?.points) && raw.points.length) return raw.points.length;
    if (raw?.type === 'regular-polygon') return Math.max(0, Math.floor(safeNumber(raw.sides, 0)));
    return 0;
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

  function getAreaBearingRawType(raw) {
    return String(raw?.type || '').trim();
  }

  function isCurveAreaRawType(type) {
    return type === 'circle' || type === 'circle-radius' || type === 'ellipse' || type === 'circular-sector';
  }

  function normalizeCurveAreaParts(raw, defaultVisible = false) {
    if (!raw || typeof raw !== 'object') return;

    const parts = raw.parts && typeof raw.parts === 'object' && !Array.isArray(raw.parts)
      ? raw.parts
      : {};
    const fill = parts.fill && typeof parts.fill === 'object' && !Array.isArray(parts.fill)
      ? parts.fill
      : {};

    raw.parts = {
      ...parts,
      fill: {
        ...fill,
        visible: fill.visible !== undefined ? fill.visible !== false : !!defaultVisible
      }
    };
  }

  function isCurveAreaVisible(raw, defaultVisible = false) {
    return raw?.parts?.fill?.visible !== undefined
      ? raw.parts.fill.visible !== false
      : !!defaultVisible;
  }

  function setCurveAreaVisible(raw, value, defaultVisible = false) {
    normalizeCurveAreaParts(raw, defaultVisible);
    raw.parts.fill.visible = !!value;
  }

  function isAngleRaw(raw) {
    return getAreaBearingRawType(raw) === 'angle';
  }

  function normalizeAngleParts(raw, defaultVisible = true) {
    if (!raw || typeof raw !== 'object') return;

    const parts = raw.parts && typeof raw.parts === 'object' && !Array.isArray(raw.parts)
      ? raw.parts
      : {};
    const fill = parts.fill && typeof parts.fill === 'object' && !Array.isArray(parts.fill)
      ? parts.fill
      : {};
    const arc = parts.arc && typeof parts.arc === 'object' && !Array.isArray(parts.arc)
      ? parts.arc
      : {};
    const arms = parts.arms && typeof parts.arms === 'object' && !Array.isArray(parts.arms)
      ? parts.arms
      : {};

    raw.parts = {
      ...parts,
      arc: {
        ...arc,
        visible: arc.visible !== undefined ? arc.visible !== false : true
      },
      arms: {
        ...arms,
        visible: arms.visible === true
      },
      fill: {
        ...fill,
        visible: fill.visible !== undefined ? fill.visible !== false : !!defaultVisible
      }
    };
  }

  function normalizeAngleMeasure(raw, defaultVisible = true) {
    if (!raw || typeof raw !== 'object') return;

    const measure = raw.measure && typeof raw.measure === 'object' && !Array.isArray(raw.measure)
      ? raw.measure
      : {};
    const unit = getAngleDefinitionKind(raw) === 'vertex-ray-measure'
      ? (raw.unit === 'rad' ? 'rad' : 'deg')
      : (String(measure.unit || 'deg').trim().toLowerCase() === 'rad' ? 'rad' : 'deg');

    raw.measure = {
      ...measure,
      visible: measure.visible !== undefined ? measure.visible !== false : !!defaultVisible,
      unit
    };
    if (getAngleDefinitionKind(raw) === 'vertex-ray-measure') {
      raw.unit = unit;
    }
  }

  function isAngleSectorVisible(raw, defaultVisible = true) {
    return raw?.parts?.fill?.visible !== undefined
      ? raw.parts.fill.visible !== false
      : !!defaultVisible;
  }

  function setAngleSectorVisible(raw, value, defaultVisible = true) {
    normalizeAngleParts(raw, defaultVisible);
    raw.parts.fill.visible = !!value;
  }

  function isAngleArcVisible(raw) {
    return raw?.parts?.arc?.visible !== false;
  }

  function setAngleArcVisible(raw, value) {
    normalizeAngleParts(raw, true);
    raw.parts.arc.visible = !!value;
  }

  function isAngleArmsVisible(raw) {
    return raw?.parts?.arms?.visible === true;
  }

  function setAngleArmsVisible(raw, value) {
    normalizeAngleParts(raw, true);
    raw.parts.arms.visible = !!value;
  }

  function isAngleMeasureVisible(raw, defaultVisible = true) {
    return raw?.measure?.visible !== undefined
      ? raw.measure.visible !== false
      : !!defaultVisible;
  }

  function setAngleMeasureVisible(raw, value, defaultVisible = true) {
    normalizeAngleMeasure(raw, defaultVisible);
    raw.measure.visible = !!value;
  }

  function getAngleDefinitionKind(raw) {
    const cleanValue = String(raw?.angleKind || raw?.defKind || '').trim().toLowerCase();
    if (cleanValue === 'vertex-ray-measure') return 'vertex-ray-measure';
    if (cleanValue === 'three-points') return 'three-points';
    return String(raw?.measureRef || '').trim() || raw?.measureValue !== undefined || String(raw?.derivedPoints?.p2 || '').trim()
      ? 'vertex-ray-measure'
      : 'three-points';
  }

  function getAngleUnit(raw) {
    if (getAngleDefinitionKind(raw) === 'vertex-ray-measure') {
      return raw?.unit === 'rad' ? 'rad' : 'deg';
    }
    return raw?.measure?.unit === 'rad' ? 'rad' : 'deg';
  }

  function normalizeAngleDirection(value, fallback = 'ccw') {
    const cleanValue = String(value || '').trim().toLowerCase();
    if (!cleanValue) return fallback;
    if (cleanValue === 'ccw') return 'ccw';
    if (cleanValue === 'cw') return 'cw';
    throw new Error(`Direccion angular no soportada: ${value || '(vacia)'}.`);
  }

  function getAngleFullTurn(unit = 'deg') {
    return unit === 'rad' ? Math.PI * 2 : 360;
  }

  function isConcaveAngleMeasure(value, unit = 'deg') {
    const numericValue = safeNumber(value, NaN);
    if (!Number.isFinite(numericValue)) return false;
    return numericValue > getAngleFullTurn(unit) / 2 + 1e-9;
  }

  function validateAngleMeasureValue(value, unit, label = 'angulo') {
    const numericValue = safeNumber(value, NaN);
    const fullTurn = getAngleFullTurn(unit);
    if (!(numericValue > 1e-9) || !(numericValue < fullTurn - 1e-9)) {
      throw new Error(`El ${label} requiere una medida mayor que 0 y menor que una vuelta completa.`);
    }
    return numericValue;
  }

  function convertAngleValueUnit(value, fromUnit, toUnit) {
    const numericValue = safeNumber(value, NaN);
    if (!Number.isFinite(numericValue)) return NaN;
    if (fromUnit === toUnit) return numericValue;
    return fromUnit === 'rad'
      ? radiansToDegrees(numericValue)
      : (numericValue * Math.PI) / 180;
  }

  function isObjectAreaVisible(raw) {
    const type = getAreaBearingRawType(raw);
    if (isPolygonHostRawType(type)) return isPolygonFillVisible(raw);
    if (objectSupportsArea(raw)) return isCurveAreaVisible(raw, false);
    return false;
  }

  function setObjectAreaVisible(raw, value) {
    const type = getAreaBearingRawType(raw);
    if (isPolygonHostRawType(type)) {
      setPolygonFillVisible(raw, value);
      return true;
    }
    if (objectSupportsArea(raw) && !isPolygonHostRawType(type)) {
      setCurveAreaVisible(raw, value, false);
      return true;
    }
    return false;
  }

  function isAreaBearingRawType(type) {
    return objectSupportsArea(type);
  }

  function resolvedAreaValue(resolved) {
    if (!resolved) return NaN;
    if (resolved.kind === 'polygon') return polygonArea(resolved.points);
    if (resolved.kind === 'circle') return Math.PI * safeNumber(resolved.radius, 0) * safeNumber(resolved.radius, 0);
    if (resolved.kind === 'ellipse') return Math.PI * safeNumber(resolved.rx, 0) * safeNumber(resolved.ry, 0);
    if (resolved.kind === 'circular-sector') return safeNumber(resolved.sectorArea, NaN);
    return NaN;
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

  /* legacy describeMeasureRefs removed
    removed
      ? `Ángulo ${joinObjectIds(ids)}`
      : `Distancia ${joinObjectIds(ids)}`;
  */

  function describeTextRefs() {
    return 'Texto libre';
  }

  function describeMeasureRefs(raw) {
    return `Distancia ${joinObjectIds(Array.isArray(raw.of) ? raw.of : [])}`;
  }

  function getGreekAngleLabelValue(value) {
    const cleanValue = String(value || '').trim();
    return ANGLE_GREEK_LABEL_SET.has(cleanValue) ? cleanValue : '';
  }

  function nextAvailableGreekAngleLabel(model) {
    const used = new Set();
    for (const obj of (model?.objects || [])) {
      const raw = InternalObjectAdapter.raw(obj);
      if (!isAngleRaw(raw)) continue;
      const label = String(raw.label || '').trim();
      if (ANGLE_GREEK_LABEL_SET.has(label)) used.add(label);
    }
    return ANGLE_GREEK_LABELS.find(symbol => !used.has(symbol)) || '';
  }

  function normalizeAngleMode(value, fallback = 'normal') {
    return normalizeBisectorMode(value, fallback);
  }

  function normalizeIntersectionSelect(value, fallback = null) {
    if (value === undefined || value === null || value === false) return fallback;
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Selector de interseccion invalido.');
    }

    const by = String(value.by || '').trim().toLowerCase();
    if (!by) return fallback;
    if (by !== 'nearest-to-point') {
      throw new Error(`Selector de interseccion no soportado: ${value.by || '(vacio)'}.`);
    }

    const point = String(value.point || '').trim();
    if (!point) {
      throw new Error('Selector nearest-to-point requiere un punto de referencia.');
    }

    return { by, point };
  }

  function hasFiniteIntersectionHint(raw = {}) {
    return Number.isFinite(raw.pickX) && Number.isFinite(raw.pickY);
  }

  function normalizeBisectorMode(value, fallback = 'normal') {
    const cleanValue = String(value || '').trim().toLowerCase();
    if (!cleanValue) return fallback;
    if (cleanValue === 'normal') return 'normal';
    if (cleanValue === 'concave') return 'concave';
    throw new Error(`Modo de bisectriz no soportado: ${value || '(vacío)'}.`);
  }

  function getBisectorModeLabel(value) {
    return normalizeBisectorMode(value, 'normal') === 'concave' ? 'cóncavo' : 'normal';
  }

  function buildSelectOptionsHtml(options = []) {
    return options.map(option => `<option value="${DomUtils.escapeHtml(option.value)}">${DomUtils.escapeHtml(option.label)}</option>`).join('');
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
    'vector-end': 'vector',
    'angle-terminal-point': 'angle',
    'regular-polygon-vertex': 'regular-polygon'
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

    function requireNumberRef(ownerId, fieldName, refId) {
      const target = requireRef(ownerId, fieldName, refId);
      if (!isNumberRawType(InternalObjectAdapter.type(target))) {
        throw new Error(`El objeto "${ownerId}" requiere que ${fieldName} apunte a un número.`);
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
      const maxEdges = isPolygonHostRawType(targetType) ? target.points.length : target.points.length - 1;
      if (normalized < 0 || normalized >= maxEdges) {
        throw new Error(`El objeto "${ownerId}" usa ${fieldName} fuera de rango.`);
      }

      return normalized;
    }

    return {
      idMap,
      normalizeAndValidateEdgeIndex,
      requireNumberRef,
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

  function validateBisectorRayObject(raw, { requirePointRef }) {
    requirePointRef(raw.id, 'p1', raw.p1);
    requirePointRef(raw.id, 'vertex', raw.vertex);
    requirePointRef(raw.id, 'p2', raw.p2);
    raw.mode = normalizeBisectorMode(raw.mode, 'normal');
    if (raw.derivedPoints && typeof raw.derivedPoints === 'object' && !Array.isArray(raw.derivedPoints)) {
      raw.derivedPoints.point = String(raw.derivedPoints.point || '').trim();
    }
    if (raw.p1 === raw.vertex) {
      throw new Error(`La bisectriz "${raw.id}" requiere que p1 sea distinto del vértice.`);
    }
    if (raw.p2 === raw.vertex) {
      throw new Error(`La bisectriz "${raw.id}" requiere que p2 sea distinto del vértice.`);
    }
  }

  function validateDerivedLineObject(raw, { normalizeAndValidateEdgeIndex, requirePointRef, requireRef }) {
    requirePointRef(raw.id, 'point', raw.point);
    const parent = requireRef(raw.id, 'objectId', raw.objectId);
    const parentType = InternalObjectAdapter.type(parent);
    if (parentType === 'polyline' || isPolygonHostRawType(parentType)) {
      raw.edgeIndex = normalizeAndValidateEdgeIndex(raw.id, 'edgeIndex', parent, raw.edgeIndex, false);
    } else if (!isDirectionalRawType(parentType)) {
      throw new Error(`La recta derivada "${raw.id}" debe referenciar un segmento, recta, semirrecta o una arista de poligonal/poligono.`);
    }
  }

  function validateCircleObject(raw, { requirePointRef }) {
    requirePointRef(raw.id, 'center', raw.center);
    requirePointRef(raw.id, 'through', raw.through);
    normalizeCurveAreaParts(raw, false);
  }

  function validateCircleRadiusObject(raw, { requireNumberRef, requirePointRef }) {
    requirePointRef(raw.id, 'center', raw.center);
    raw.radiusRef = String(raw.radiusRef || '').trim();
    if (raw.radiusRef) {
      requireNumberRef(raw.id, 'radiusRef', raw.radiusRef);
      delete raw.radius;
    } else {
      raw.radius = safeNumber(raw.radius, NaN);
      if (!(raw.radius > 1e-9)) {
        throw new Error(`La circunferencia "${raw.id}" debe tener radio mayor que 0.`);
      }
    }

    normalizeCurveAreaParts(raw, false);
  }

  function validateCircularArcObject(raw, { requirePointRef }) {
    requirePointRef(raw.id, 'center', raw.center);
    requirePointRef(raw.id, 'start', raw.start);
    requirePointRef(raw.id, 'end', raw.end);
    raw.direction = normalizeAngleDirection(raw.direction, 'ccw');

    const ids = [raw.center, raw.start, raw.end].map(id => String(id || '').trim());
    if (ids[0] === ids[1] || ids[0] === ids[2]) {
      throw new Error(`El arco "${raw.id}" requiere puntos de inicio y fin distintos del centro.`);
    }
  }

  function validateCircularSectorObject(raw, context) {
    validateCircularArcObject(raw, context);
    normalizeCurveAreaParts(raw, true);
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

    normalizeCurveAreaParts(raw, false);
  }

  function validateRegularPolygonObject(raw, { requireNumberRef, requirePointRef }) {
    requirePointRef(raw.id, 'center', raw.center);
    raw.sides = Math.floor(safeNumber(raw.sides, NaN));
    if (!(raw.sides >= 3)) {
      throw new Error(`El polígono regular "${raw.id}" debe tener al menos 3 lados.`);
    }

    raw.vertex = String(raw.vertex || '').trim();
    raw.radiusRef = String(raw.radiusRef || '').trim();
    raw.orientationAngle = safeNumber(raw.orientationAngle, NaN);
    const usesOrientedRadius = !!raw.radiusRef || Number.isFinite(safeNumber(raw.radius, NaN)) || Number.isFinite(raw.orientationAngle);

    if (usesOrientedRadius) {
      if (raw.radiusRef) {
        requireNumberRef(raw.id, 'radiusRef', raw.radiusRef);
        delete raw.radius;
      } else {
        raw.radius = safeNumber(raw.radius, NaN);
        if (!(raw.radius > 1e-9)) {
          throw new Error(`El polígono regular "${raw.id}" requiere un radio mayor que 0.`);
        }
      }
      if (!Number.isFinite(raw.orientationAngle)) {
        throw new Error(`El polígono regular "${raw.id}" requiere orientationAngle válido.`);
      }
      delete raw.vertex;
    } else {
      requirePointRef(raw.id, 'vertex', raw.vertex);
    }

    raw.points = Array.isArray(raw.points) ? raw.points.map(id => String(id || '').trim()).filter(Boolean) : [];
    if (raw.points.length !== raw.sides) {
      throw new Error(`El polígono regular "${raw.id}" debe listar ${raw.sides} vértice(s).`);
    }
    if (!usesOrientedRadius && raw.points[0] !== String(raw.vertex || '').trim()) {
      throw new Error(`El polígono regular "${raw.id}" debe usar su vértice inicial como primer elemento de points.`);
    }
    if (new Set(raw.points).size !== raw.points.length) {
      throw new Error(`El polígono regular "${raw.id}" no puede repetir vértices.`);
    }

    for (let index = 0; index < raw.points.length; index++) {
      requirePointRef(raw.id, `points[${index}]`, raw.points[index]);
    }

    normalizePolygonParts(raw);
  }

  function validateRegularPolygonVertexConstraint(raw, { requireRef }) {
    raw.constraint.objectId = String(raw.constraint.objectId || '').trim();
    const parent = requireRef(raw.id, 'constraint.objectId', raw.constraint.objectId);
    if (InternalObjectAdapter.type(parent) !== 'regular-polygon') {
      throw new Error(`El punto "${raw.id}" requiere un polígono regular compatible en su restricción.`);
    }

    raw.constraint.index = Math.floor(safeNumber(raw.constraint.index, NaN));
    const sides = Math.floor(safeNumber(parent.sides, NaN));
    if (!(raw.constraint.index >= 0) || !(raw.constraint.index < sides)) {
      throw new Error(`El punto "${raw.id}" requiere un índice de vértice regular válido.`);
    }

    raw.draggable = false;
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

  /* legacy validateMeasureObject removed
    raw.measureType = 'distance';
    delete raw.unit;
    delete raw.concave;

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
    normalizeAngleMeasureParts(raw, true);
  */

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

  function validateMeasureObject(raw, { requirePointRef }) {
    raw.measureType = 'distance';
    delete raw.unit;
    delete raw.concave;
    if (!Array.isArray(raw.of) || raw.of.length !== 2) {
      throw new Error(`La medida "${raw.id}" debe referenciar exactamente 2 puntos.`);
    }
    raw.of.forEach((refId, index) => requirePointRef(raw.id, `of[${index}]`, refId));
  }

  function validateNumberObject(raw, { requirePointRef, requireRef }) {
    raw.numberKind = String(raw.numberKind || raw.kind || '').trim().toLowerCase();
    if (!raw.numberKind) raw.numberKind = 'independent';

    if (raw.numberKind === 'independent') {
      raw.value = safeNumber(raw.value, NaN);
      raw.step = safeNumber(raw.step, 1);
      raw.min = safeNumber(raw.min, NaN);
      raw.max = safeNumber(raw.max, NaN);
      if (!Number.isFinite(raw.min)) delete raw.min;
      if (!Number.isFinite(raw.max)) delete raw.max;
      if (Number.isFinite(raw.min) && Number.isFinite(raw.max) && raw.min > raw.max) {
        const tmp = raw.min;
        raw.min = raw.max;
        raw.max = tmp;
      }
      if (!Number.isFinite(raw.value)) {
        throw new Error(`El número "${raw.id}" requiere un valor válido.`);
      }
      raw.value = clampNumberToInterval(raw.value, raw);
      if (!(raw.step > 0)) {
        raw.step = 1;
      }
      return;
    }

    if (raw.numberKind === 'distance') {
      requirePointRef(raw.id, 'p1', raw.p1);
      requirePointRef(raw.id, 'p2', raw.p2);
      return;
    }

    if (raw.numberKind === 'angle') {
      raw.p1 = String(raw.p1 || '').trim();
      raw.vertex = String(raw.vertex || '').trim();
      raw.p2 = String(raw.p2 || '').trim();
      raw.mode = normalizeAngleMode(raw.mode, 'normal');
      raw.unit = raw.unit === 'rad' ? 'rad' : 'deg';
      requirePointRef(raw.id, 'p1', raw.p1);
      requirePointRef(raw.id, 'vertex', raw.vertex);
      requirePointRef(raw.id, 'p2', raw.p2);
      return;
    }

    if (raw.numberKind === 'area') {
      raw.objectId = String(raw.objectId || '').trim();
      const target = requireRef(raw.id, 'objectId', raw.objectId);
      if (!isAreaBearingRawType(InternalObjectAdapter.type(target))) {
        throw new Error(`El número "${raw.id}" requiere un objeto con área en objectId.`);
      }
      return;
    }

    throw new Error(`El número "${raw.id}" usa un tipo no soportado: ${raw.numberKind || '(vacío)'}.`);
  }

  function validateTransformObject(raw, { requireNumberRef, requirePointRef, requireRef }) {
    raw.transformKind = String(raw.transformKind || raw.kind || '').trim().toLowerCase();

    if (raw.transformKind === 'translation') {
      const vector = requireRef(raw.id, 'vectorId', raw.vectorId);
      if (!isVectorRawType(InternalObjectAdapter.type(vector))) {
        throw new Error(`La transformacion "${raw.id}" requiere un vector en vectorId.`);
      }
      return;
    }

    if (raw.transformKind === 'rotation') {
      requirePointRef(raw.id, 'center', raw.center);
      raw.angleRef = String(raw.angleRef || '').trim();
      raw.unit = raw.unit === 'rad' ? 'rad' : 'deg';
      raw.direction = normalizeAngleDirection(raw.direction, 'ccw');
      if (raw.angleRef) {
        requireNumberRef(raw.id, 'angleRef', raw.angleRef);
        delete raw.angle;
      } else {
        raw.angle = validateAngleMeasureValue(raw.angle, raw.unit, `rotacion "${raw.id}"`);
      }
      return;
    }

    if (raw.transformKind === 'reflection') {
      const axis = requireRef(raw.id, 'axis', raw.axis);
      if (!isDirectionalRawType(InternalObjectAdapter.type(axis))) {
        throw new Error(`La transformacion "${raw.id}" requiere una recta, segmento o semirrecta en axis.`);
      }
      return;
    }

    if (raw.transformKind === 'central-symmetry') {
      requirePointRef(raw.id, 'center', raw.center);
      return;
    }

    if (raw.transformKind === 'homothety') {
      requirePointRef(raw.id, 'center', raw.center);
      raw.factorRef = String(raw.factorRef || '').trim();
      if (raw.factorRef) {
        requireNumberRef(raw.id, 'factorRef', raw.factorRef);
        delete raw.factor;
      } else {
        raw.factor = safeNumber(raw.factor, NaN);
        if (!Number.isFinite(raw.factor) || Math.abs(raw.factor) <= 1e-9) {
          throw new Error(`La homotecia "${raw.id}" requiere una constante distinta de 0.`);
        }
      }
      return;
    }

    throw new Error(`La transformacion "${raw.id}" usa un tipo no soportado: ${raw.transformKind || '(vacio)'}.`);
  }

  function validateImageObject(raw, { requireRef }) {
    const source = requireRef(raw.id, 'objectId', raw.objectId);
    const transform = requireRef(raw.id, 'transformId', raw.transformId);
    if (InternalObjectAdapter.type(raw) === 'image-point' && !isPointLikeRawType(InternalObjectAdapter.type(source))) {
      throw new Error(`El punto imagen "${raw.id}" requiere un punto en objectId.`);
    }
    if (!isTransformableRawType(InternalObjectAdapter.type(source))) {
      throw new Error(`La imagen "${raw.id}" requiere un objeto transformable en objectId.`);
    }
    if (!isTransformRawType(InternalObjectAdapter.type(transform))) {
      throw new Error(`La imagen "${raw.id}" requiere una transformacion en transformId.`);
    }
    raw.imagePoints = Array.isArray(raw.imagePoints)
      ? raw.imagePoints.map(value => String(value || '').trim()).filter(Boolean)
      : [];
    for (let index = 0; index < raw.imagePoints.length; index++) {
      const imagePoint = requireRef(raw.id, `imagePoints[${index}]`, raw.imagePoints[index]);
      if (!isPointLikeRawType(InternalObjectAdapter.type(imagePoint))) {
        throw new Error(`La imagen "${raw.id}" requiere puntos validos en imagePoints.`);
      }
    }
    raw.sourceKind = String(raw.sourceKind || InternalObjectAdapter.type(source) || '').trim();
    raw.draggable = false;
  }

  function validateAngleObject(raw, { requireNumberRef, requirePointRef }) {
    raw.angleKind = getAngleDefinitionKind(raw);
    raw.p1 = String(raw.p1 || '').trim();
    raw.vertex = String(raw.vertex || '').trim();

    requirePointRef(raw.id, 'p1', raw.p1);
    requirePointRef(raw.id, 'vertex', raw.vertex);

    if (raw.p1 === raw.vertex) {
      throw new Error(`El ángulo "${raw.id}" requiere un vértice distinto de su primer rayo.`);
    }

    if (raw.angleKind === 'vertex-ray-measure') {
      raw.measureRef = String(raw.measureRef || '').trim();
      raw.unit = raw.unit === 'rad' ? 'rad' : 'deg';
      raw.direction = normalizeAngleDirection(raw.direction, 'ccw');
      if (raw.measureRef) {
        requireNumberRef(raw.id, 'measureRef', raw.measureRef);
        delete raw.measureValue;
      } else {
        raw.measureValue = validateAngleMeasureValue(raw.measureValue, raw.unit, `ángulo "${raw.id}"`);
      }
      if (raw.derivedPoints && typeof raw.derivedPoints === 'object' && !Array.isArray(raw.derivedPoints)) {
        raw.derivedPoints = {
          p2: String(raw.derivedPoints.p2 || '').trim()
        };
      }
      delete raw.p2;
      delete raw.mode;
    } else {
      raw.p2 = String(raw.p2 || '').trim();
      raw.mode = normalizeAngleMode(raw.mode, 'normal');
      requirePointRef(raw.id, 'p2', raw.p2);
      if (raw.p2 === raw.vertex) {
        throw new Error(`El ángulo "${raw.id}" requiere un vértice distinto de sus brazos.`);
      }
      delete raw.measureRef;
      delete raw.measureValue;
      delete raw.direction;
      delete raw.derivedPoints;
      delete raw.unit;
    }

    normalizeAngleParts(raw, true);
    normalizeAngleMeasure(raw, true);
  }

  function validatePointIntersectionConstraint(raw, { normalizeAndValidateEdgeIndex, requireRef }) {
    raw.constraint.objectId = String(raw.constraint.objectId || '').trim();
    raw.constraint.objectId2 = String(raw.constraint.objectId2 || '').trim();
    raw.constraint.edgeIndex = normalizeEdgeIndex(raw.constraint.edgeIndex);
    raw.constraint.edgeIndex2 = normalizeEdgeIndex(raw.constraint.edgeIndex2);
    raw.constraint.pickX = safeNumber(raw.constraint.pickX, NaN);
    raw.constraint.pickY = safeNumber(raw.constraint.pickY, NaN);
    raw.constraint.select = normalizeIntersectionSelect(raw.constraint.select, null);

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

    if (raw.constraint.select?.by === 'nearest-to-point') {
      const refPoint = requireRef(raw.id, 'constraint.select.point', raw.constraint.select.point);
      const refType = InternalObjectAdapter.type(refPoint);
      if (!isPointLikeRawType(refType)) {
        throw new Error(`El punto "${raw.id}" requiere un punto valido en constraint.select.point.`);
      }
    }

    if (Number.isFinite(raw.constraint.pickX) !== Number.isFinite(raw.constraint.pickY)) {
      throw new Error(`El punto "${raw.id}" requiere un hint completo en constraint.pickX/pickY.`);
    }

    raw.draggable = false;
  }

  function isPointOnSegmentTargetType(type) {
    return type === 'segment' || type === 'polyline' || isPolygonHostRawType(type);
  }

  function isPointOnLineTargetType(type) {
    return isLineLikeRawType(type);
  }

  function isPointOnRayTargetType(type) {
    return type === 'ray' || type === 'bisector-ray';
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
      : kind === 'on-ray'
        ? isPointOnRayTargetType(parentType)
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
    } else if (kind === 'vector-end' || kind === 'angle-terminal-point') {
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

      if (kind === 'regular-polygon-vertex') {
        validateRegularPolygonVertexConstraint(raw, validationContext);
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
    const objects = Array.isArray(scene.objects) ? scene.objects : [];
    if (objects.some(raw => raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.type === 'string' && typeof raw.kind !== 'string')) {
      return false;
    }

    return objects.some(raw => (
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
    'point:angle-terminal-point': 'point',
    'point:ellipse-derived-point': 'point',
    'point:regular-polygon-vertex': 'point',
    'point:image-of': 'image-point',
    'point:midpoint': 'midpoint',
    'segment:between-points': 'segment',
    'segment:image-of': 'image-object',
    'ray:from-point-through-point': 'ray',
    'ray:angle-bisector': 'bisector-ray',
    'vector:between-points': 'vector',
    'vector:equipollent-from-point': 'equipollent-vector',
    'line:through-two-points': 'line',
    'line:parallel-through-point': 'parallel-line',
    'line:perpendicular-through-point': 'perpendicular-line',
    'line:image-of': 'image-object',
    'circle:center-through-point': 'circle',
    'circle:center-radius': 'circle-radius',
    'circle:image-of': 'image-object',
    'arc:center-start-end': 'circle-arc',
    'sector:center-start-end': 'circular-sector',
    'ellipse:center-vertex-covertex': 'ellipse',
    'polyline:through-points': 'polyline',
    'polygon:through-points': 'polygon',
    'polygon:regular-center-vertex': 'regular-polygon',
    'polygon:regular-center-radius': 'regular-polygon',
    'polygon:image-of': 'image-object',
    'transform:translation': 'transform',
    'transform:rotation': 'transform',
    'transform:reflection': 'transform',
    'transform:central-symmetry': 'transform',
    'transform:homothety': 'transform',
    'measure:distance': 'measure',
    'number:independent': 'number',
    'number:distance': 'number',
    'number:angle': 'number',
    'number:area': 'number',
    'angle:three-points': 'angle',
    'angle:vertex-ray-measure': 'angle',
    'text:free-text': 'text'
  });

  function getInternalTypeFromConstructionObject(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
    return CONSTRUCTION_TO_INTERNAL_TYPES[getConstructionTypeKey(raw.kind, raw.def?.kind)] || '';
  }

  function copyConstructionPresentationToInternal(raw, out) {
    if (raw.label !== undefined) out.label = String(raw.label);
    if (raw.labelPosition !== undefined) out.labelPosition = String(raw.labelPosition || '');
    if (raw.labelOffset && typeof raw.labelOffset === 'object' && !Array.isArray(raw.labelOffset)) {
      out.labelOffset = deepClone(raw.labelOffset);
    }
    if (raw.visible === false) out.visible = false;
    if (raw.style && typeof raw.style === 'object' && !Array.isArray(raw.style)) out.style = deepClone(raw.style);
    if (raw.draggable !== undefined) out.draggable = !!raw.draggable;
    if (raw.parts && typeof raw.parts === 'object' && !Array.isArray(raw.parts)) out.parts = deepClone(raw.parts);
    return out;
  }

  function copyInternalPresentationToConstruction(raw, out) {
    if (raw.label !== undefined && raw.label !== '') out.label = String(raw.label);
    if (raw.labelPosition !== undefined && raw.labelPosition !== '') out.labelPosition = String(raw.labelPosition);
    if (raw.labelOffset && typeof raw.labelOffset === 'object' && !Array.isArray(raw.labelOffset)) {
      out.labelOffset = deepClone(raw.labelOffset);
    }
    if (raw.visible === false) out.visible = false;
    if (raw.style && typeof raw.style === 'object' && !Array.isArray(raw.style) && Object.keys(raw.style).length) {
      out.style = deepClone(raw.style);
    }
    if (raw.draggable !== undefined) out.draggable = !!raw.draggable;
    if (
      (isAreaBearingRawType(InternalObjectAdapter.type(raw)) || isAngleRaw(raw)) &&
      raw.parts &&
      typeof raw.parts === 'object' &&
      !Array.isArray(raw.parts)
    ) {
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
    if (isPointOnRayTargetType(targetType)) return 'on-ray';
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
    const hintX = safeNumber(hint.x, NaN);
    const hintY = safeNumber(hint.y, NaN);
    const select = normalizeIntersectionSelect(def.select, null);
    if (select && !byId.get(select.point)) throw new Error(`El punto "${id}" referencia "${select.point}", pero no existe.`);
    out.type = 'point';
    out.draggable = false;
    out.constraint = {
      kind: 'intersection',
      objectId,
      objectId2,
      ...(select ? { select } : {}),
      ...(Number.isFinite(hintX) && Number.isFinite(hintY) ? { pickX: hintX, pickY: hintY } : {})
    };
    copyOptionalEdgeIndex(def, out.constraint);
    copyOptionalEdgeIndex(def, out.constraint, 'edgeIndex2', 'edgeIndex2');
    out.x = Number.isFinite(hintX) ? hintX : 0;
    out.y = Number.isFinite(hintY) ? hintY : 0;
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

  function importAngleTerminalPointConstruction({ byId, def, id, out }) {
    const angleId = String(def.angleId || def.objectId || '').trim();
    const target = byId.get(angleId);
    if (!target) throw new Error(`El punto "${id}" referencia "${angleId}", pero no existe.`);

    const targetType = getInternalTypeFromConstructionObject(target);
    if (targetType !== 'angle') {
      throw new Error(`El punto "${id}" requiere un angulo compatible en "${angleId}".`);
    }

    out.type = 'point';
    out.draggable = false;
    out.constraint = {
      kind: 'angle-terminal-point',
      objectId: angleId
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

  function importRegularPolygonVertexPointConstruction({ byId, def, id, out }) {
    const polygonId = String(def.polygonId || def.objectId || '').trim();
    const target = byId.get(polygonId);
    if (!target) throw new Error(`El punto "${id}" referencia "${polygonId}", pero no existe.`);

    const targetType = getInternalTypeFromConstructionObject(target);
    if (targetType !== 'regular-polygon') {
      throw new Error(`El punto "${id}" requiere un polígono regular compatible en "${polygonId}".`);
    }

    out.type = 'point';
    out.draggable = false;
    out.constraint = {
      kind: 'regular-polygon-vertex',
      objectId: polygonId,
      index: Math.floor(safeNumber(def.index, 0))
    };
    return out;
  }

  function importImagePointConstruction({ byId, def, id, out }) {
    const objectId = String(def.objectId || '').trim();
    const transformId = String(def.transform || def.transformId || '').trim();
    const source = byId.get(objectId);
    const transform = byId.get(transformId);
    if (!source) throw new Error(`El punto "${id}" referencia "${objectId}", pero no existe.`);
    if (!transform) throw new Error(`El punto "${id}" referencia "${transformId}", pero no existe.`);

    out.type = 'image-point';
    out.objectId = objectId;
    out.transformId = transformId;
    out.sourceKind = getInternalTypeFromConstructionObject(source) || 'point';
    out.draggable = false;
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

  function importBisectorRayConstruction({ def, out }) {
    out.type = 'bisector-ray';
    out.p1 = String(def.p1 || '').trim();
    out.vertex = String(def.vertex || '').trim();
    out.p2 = String(def.p2 || '').trim();
    out.mode = normalizeBisectorMode(def.mode, 'normal');
    if (def.derivedPoints && typeof def.derivedPoints === 'object' && !Array.isArray(def.derivedPoints)) {
      out.derivedPoints = {
        point: String(def.derivedPoints.point || '').trim()
      };
    }
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
    out.radiusRef = String(def.radiusRef || '').trim();
    if (out.radiusRef) delete out.radius;
    else out.radius = safeNumber(def.radius, 0);
    return out;
  }

  function importCircularArcConstruction({ def, out }, type) {
    out.type = type;
    out.center = String(def.center || '').trim();
    out.start = String(def.start || '').trim();
    out.end = String(def.end || '').trim();
    out.direction = normalizeAngleDirection(def.direction, 'ccw');
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

  function importRegularPolygonConstruction({ def, out }) {
    out.type = 'regular-polygon';
    out.center = String(def.center || '').trim();
    out.vertex = String(def.vertex || '').trim();
    out.radiusRef = String(def.radiusRef || '').trim();
    if (out.radiusRef) delete out.radius;
    else if (def.radius !== undefined) out.radius = safeNumber(def.radius, NaN);
    out.orientationAngle = safeNumber(def.orientationAngle, NaN);
    out.sides = Math.floor(safeNumber(def.sides, 0));
    out.points = Array.isArray(def.points) ? deepClone(def.points) : [];
    return out;
  }

  function importPointListConstruction({ def, out }, type) {
    out.type = type;
    out.points = Array.isArray(def.points) ? deepClone(def.points) : [];
    return out;
  }

  function importImageObjectConstruction({ byId, kind, def, id, out }) {
    const objectId = String(def.objectId || '').trim();
    const transformId = String(def.transform || def.transformId || '').trim();
    const source = byId.get(objectId);
    const transform = byId.get(transformId);
    if (!source) throw new Error(`El objeto "${id}" referencia "${objectId}", pero no existe.`);
    if (!transform) throw new Error(`El objeto "${id}" referencia "${transformId}", pero no existe.`);

    out.type = 'image-object';
    out.objectId = objectId;
    out.transformId = transformId;
    out.sourceKind = getInternalTypeFromConstructionObject(source) || String(kind || '').trim();
    out.imagePoints = Array.isArray(def.imagePoints) ? deepClone(def.imagePoints).map(value => String(value || '').trim()).filter(Boolean) : [];
    return out;
  }

  function importTransformConstruction({ def, defKind, out }) {
    out.type = 'transform';
    out.transformKind = String(defKind || '').trim().toLowerCase();

    if (out.transformKind === 'translation') {
      out.vectorId = String(def.vector || def.vectorId || '').trim();
      return out;
    }

    if (out.transformKind === 'rotation') {
      out.center = String(def.center || '').trim();
      out.angleRef = String(def.angleRef || '').trim();
      if (out.angleRef) delete out.angle;
      else out.angle = safeNumber(def.angle, NaN);
      out.unit = def.unit === 'rad' ? 'rad' : 'deg';
      out.direction = normalizeAngleDirection(def.direction, 'ccw');
      return out;
    }

    if (out.transformKind === 'reflection') {
      out.axis = String(def.axis || '').trim();
      return out;
    }

    if (out.transformKind === 'central-symmetry') {
      out.center = String(def.center || '').trim();
      return out;
    }

    if (out.transformKind === 'homothety') {
      out.center = String(def.center || '').trim();
      out.factorRef = String(def.factorRef || '').trim();
      if (out.factorRef) delete out.factor;
      else out.factor = safeNumber(def.factor ?? def.k, NaN);
      return out;
    }

    return out;
  }

  function importMeasureConstruction({ def, defKind, out }) {
    out.type = 'measure';
    out.measureType = 'distance';
    out.of = Array.isArray(def.of) ? deepClone(def.of) : [];
    return out;
  }

  function importNumberConstruction({ def, defKind, out }) {
    out.type = 'number';
    out.numberKind = String(defKind || '').trim().toLowerCase();

    if (out.numberKind === 'independent') {
      out.value = safeNumber(def.value, 0);
      out.step = safeNumber(def.step, 1);
      if (Number.isFinite(safeNumber(def.min, NaN))) out.min = safeNumber(def.min, NaN);
      if (Number.isFinite(safeNumber(def.max, NaN))) out.max = safeNumber(def.max, NaN);
      return out;
    }

    if (out.numberKind === 'distance') {
      out.p1 = String(def.p1 || '').trim();
      out.p2 = String(def.p2 || '').trim();
      return out;
    }

    if (out.numberKind === 'angle') {
      out.p1 = String(def.p1 || '').trim();
      out.vertex = String(def.vertex || '').trim();
      out.p2 = String(def.p2 || '').trim();
      out.mode = normalizeAngleMode(def.mode, 'normal');
      out.unit = def.unit === 'rad' ? 'rad' : 'deg';
      return out;
    }

    if (out.numberKind === 'area') {
      out.objectId = String(def.objectId || '').trim();
      return out;
    }

    return out;
  }

  function importAngleConstruction({ def, out }) {
    out.type = 'angle';
    out.angleKind = String(def.kind || '').trim() || 'three-points';
    out.p1 = String(def.p1 || '').trim();
    out.vertex = String(def.vertex || '').trim();
    if (out.angleKind === 'vertex-ray-measure') {
      out.measureRef = String(def.measureRef || '').trim();
      if (out.measureRef) delete out.measureValue;
      else out.measureValue = safeNumber(def.measureValue, NaN);
      out.unit = def.unit === 'rad' ? 'rad' : 'deg';
      out.direction = normalizeAngleDirection(def.direction, 'ccw');
      if (def.derivedPoints && typeof def.derivedPoints === 'object' && !Array.isArray(def.derivedPoints)) {
        out.derivedPoints = {
          p2: String(def.derivedPoints.p2 || '').trim()
        };
      }
    } else {
      out.p2 = String(def.p2 || '').trim();
      out.mode = normalizeAngleMode(def.mode, 'normal');
    }
    out.measure = deepClone(
      def.measure && typeof def.measure === 'object' && !Array.isArray(def.measure)
        ? def.measure
        : {}
    );
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
    'point:angle-terminal-point': importAngleTerminalPointConstruction,
    'point:ellipse-derived-point': importEllipseDerivedPointConstruction,
    'point:regular-polygon-vertex': importRegularPolygonVertexPointConstruction,
    'point:image-of': importImagePointConstruction,
    'segment:between-points': ctx => importTwoPointConstruction(ctx, 'segment'),
    'segment:image-of': importImageObjectConstruction,
    'ray:from-point-through-point': importRayConstruction,
    'ray:angle-bisector': importBisectorRayConstruction,
    'vector:between-points': ctx => importTwoPointConstruction(ctx, 'vector'),
    'vector:equipollent-from-point': importEquipollentVectorConstruction,
    'line:through-two-points': ctx => importTwoPointConstruction(ctx, 'line'),
    'line:parallel-through-point': ctx => importDerivedLineConstruction(ctx, 'parallel-line'),
    'line:perpendicular-through-point': ctx => importDerivedLineConstruction(ctx, 'perpendicular-line'),
    'line:image-of': importImageObjectConstruction,
    'circle:center-through-point': importCircleConstruction,
    'circle:center-radius': importCircleRadiusConstruction,
    'circle:image-of': importImageObjectConstruction,
    'arc:center-start-end': ctx => importCircularArcConstruction(ctx, 'circle-arc'),
    'sector:center-start-end': ctx => importCircularArcConstruction(ctx, 'circular-sector'),
    'ellipse:center-vertex-covertex': importEllipseConstruction,
    'polyline:through-points': ctx => importPointListConstruction(ctx, 'polyline'),
    'polygon:through-points': ctx => importPointListConstruction(ctx, 'polygon'),
    'polygon:regular-center-vertex': importRegularPolygonConstruction,
    'polygon:regular-center-radius': importRegularPolygonConstruction,
    'polygon:image-of': importImageObjectConstruction,
    'transform:translation': importTransformConstruction,
    'transform:rotation': importTransformConstruction,
    'transform:reflection': importTransformConstruction,
    'transform:central-symmetry': importTransformConstruction,
    'transform:homothety': importTransformConstruction,
    'measure:distance': importMeasureConstruction,
    'number:independent': importNumberConstruction,
    'number:distance': importNumberConstruction,
    'number:angle': importNumberConstruction,
    'number:area': importNumberConstruction,
    'angle:three-points': importAngleConstruction,
    'angle:vertex-ray-measure': importAngleConstruction,
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
      const hintX = safeNumber(constraint.pickX, NaN);
      const hintY = safeNumber(constraint.pickY, NaN);
      const out = {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'intersection',
          objectId: constraint.objectId,
          objectId2: constraint.objectId2
        }
      };
      if (constraint.select) out.def.select = deepClone(constraint.select);
      if (Number.isFinite(hintX) && Number.isFinite(hintY)) {
        out.def.hint = {
          x: hintX,
          y: hintY
        };
      }
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

    if (constraint.kind === 'angle-terminal-point') {
      return {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'angle-terminal-point',
          angleId: constraint.objectId
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

    if (constraint.kind === 'regular-polygon-vertex') {
      return {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'regular-polygon-vertex',
          polygonId: constraint.objectId,
          index: Math.floor(safeNumber(constraint.index, 0))
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

  function buildBisectorRayConstruction(raw) {
    const out = {
      id: raw.id,
      kind: 'ray',
      def: {
        kind: 'angle-bisector',
        p1: raw.p1,
        vertex: raw.vertex,
        p2: raw.p2,
        mode: normalizeBisectorMode(raw.mode, 'normal')
      }
    };
    if (raw.derivedPoints && typeof raw.derivedPoints === 'object' && !Array.isArray(raw.derivedPoints)) {
      out.def.derivedPoints = {
        point: String(raw.derivedPoints.point || '').trim()
      };
    }
    return out;
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
    const out = {
      id: raw.id,
      kind: 'circle',
      def: {
        kind: 'center-radius',
        center: raw.center
      }
    };
    if (String(raw.radiusRef || '').trim()) out.def.radiusRef = String(raw.radiusRef || '').trim();
    else out.def.radius = safeNumber(raw.radius, 0);
    return out;
  }

  function buildCircularArcConstruction(raw, kind) {
    return {
      id: raw.id,
      kind,
      def: {
        kind: 'center-start-end',
        center: raw.center,
        start: raw.start,
        end: raw.end,
        direction: normalizeAngleDirection(raw.direction, 'ccw')
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

  function buildRegularPolygonConstruction(raw) {
    const orientedMode = String(raw?.radiusRef || '').trim() || Number.isFinite(safeNumber(raw?.radius, NaN));
    const out = {
      id: raw.id,
      kind: 'polygon',
      def: {
        kind: orientedMode ? 'regular-center-radius' : 'regular-center-vertex',
        center: raw.center,
        sides: Math.floor(safeNumber(raw.sides, 0)),
        points: Array.isArray(raw.points) ? deepClone(raw.points) : []
      }
    };
    if (orientedMode) {
      if (String(raw.radiusRef || '').trim()) out.def.radiusRef = String(raw.radiusRef || '').trim();
      else out.def.radius = safeNumber(raw.radius, 0);
      out.def.orientationAngle = safeNumber(raw.orientationAngle, 0);
    } else {
      out.def.vertex = raw.vertex;
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
    return {
      id: raw.id,
      kind: 'measure',
      def: {
        kind: 'distance',
        of: Array.isArray(raw.of) ? deepClone(raw.of) : []
      }
    };
  }

  function buildNumberConstruction(raw) {
    const out = {
      id: raw.id,
      kind: 'number',
      def: {
        kind: String(raw.numberKind || 'independent').trim().toLowerCase() || 'independent'
      }
    };
    if (out.def.kind === 'independent') {
      out.def.value = safeNumber(raw.value, 0);
      out.def.step = safeNumber(raw.step, 1);
      if (Number.isFinite(safeNumber(raw.min, NaN))) out.def.min = safeNumber(raw.min, NaN);
      if (Number.isFinite(safeNumber(raw.max, NaN))) out.def.max = safeNumber(raw.max, NaN);
      return out;
    }
    if (out.def.kind === 'distance') {
      out.def.p1 = String(raw.p1 || '').trim();
      out.def.p2 = String(raw.p2 || '').trim();
      return out;
    }
    if (out.def.kind === 'angle') {
      out.def.p1 = String(raw.p1 || '').trim();
      out.def.vertex = String(raw.vertex || '').trim();
      out.def.p2 = String(raw.p2 || '').trim();
      out.def.mode = normalizeAngleMode(raw.mode, 'normal');
      out.def.unit = raw.unit === 'rad' ? 'rad' : 'deg';
      return out;
    }
    if (out.def.kind === 'area') {
      out.def.objectId = String(raw.objectId || '').trim();
    }
    return out;
  }

  function buildAngleConstruction(raw) {
    const angleKind = getAngleDefinitionKind(raw);
    const out = {
      id: raw.id,
      kind: 'angle',
      def: {
        kind: angleKind,
        p1: String(raw.p1 || '').trim(),
        vertex: String(raw.vertex || '').trim()
      }
    };

    if (angleKind === 'vertex-ray-measure') {
      if (String(raw.measureRef || '').trim()) out.def.measureRef = String(raw.measureRef || '').trim();
      else out.def.measureValue = safeNumber(raw.measureValue, 0);
      out.def.unit = getAngleUnit(raw);
      out.def.direction = normalizeAngleDirection(raw.direction, 'ccw');
      if (raw.derivedPoints && typeof raw.derivedPoints === 'object' && !Array.isArray(raw.derivedPoints)) {
        out.def.derivedPoints = {
          p2: String(raw.derivedPoints.p2 || '').trim()
        };
      }
      if (!isAngleMeasureVisible(raw, true)) {
        out.def.measure = { visible: false };
      }
      return out;
    }

    out.def.p2 = String(raw.p2 || '').trim();
    out.def.measure = {
      unit: getAngleUnit(raw)
    };
    const mode = normalizeAngleMode(raw.mode, 'normal');
    if (mode !== 'normal') out.def.mode = mode;
    if (!isAngleMeasureVisible(raw, true)) out.def.measure.visible = false;
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

  function getImageConstructionKind(raw) {
    const sourceKind = String(raw?.sourceKind || '').trim();
    if (sourceKind === 'segment') return 'segment';
    if (sourceKind === 'line' || sourceKind === 'parallel-line' || sourceKind === 'perpendicular-line') return 'line';
    if (sourceKind === 'circle' || sourceKind === 'circle-radius') return 'circle';
    if (sourceKind === 'polygon' || sourceKind === 'regular-polygon') return 'polygon';
    return 'polygon';
  }

  function buildImagePointConstruction(raw) {
    return {
      id: raw.id,
      kind: 'point',
      def: {
        kind: 'image-of',
        objectId: String(raw.objectId || '').trim(),
        transform: String(raw.transformId || '').trim()
      }
    };
  }

  function buildImageObjectConstruction(raw) {
    const out = {
      id: raw.id,
      kind: getImageConstructionKind(raw),
      def: {
        kind: 'image-of',
        objectId: String(raw.objectId || '').trim(),
        transform: String(raw.transformId || '').trim()
      }
    };
    if (Array.isArray(raw.imagePoints) && raw.imagePoints.length) {
      out.def.imagePoints = deepClone(raw.imagePoints);
    }
    return out;
  }

  function buildTransformConstruction(raw) {
    const kind = String(raw.transformKind || '').trim().toLowerCase();
    const out = {
      id: raw.id,
      kind: 'transform',
      def: {
        kind
      }
    };

    if (kind === 'translation') {
      out.def.vector = String(raw.vectorId || '').trim();
    } else if (kind === 'rotation') {
      out.def.center = String(raw.center || '').trim();
      if (String(raw.angleRef || '').trim()) out.def.angleRef = String(raw.angleRef || '').trim();
      else out.def.angle = safeNumber(raw.angle, 0);
      out.def.unit = raw.unit === 'rad' ? 'rad' : 'deg';
      out.def.direction = normalizeAngleDirection(raw.direction, 'ccw');
    } else if (kind === 'reflection') {
      out.def.axis = String(raw.axis || '').trim();
    } else if (kind === 'central-symmetry') {
      out.def.center = String(raw.center || '').trim();
    } else if (kind === 'homothety') {
      out.def.center = String(raw.center || '').trim();
      if (String(raw.factorRef || '').trim()) out.def.factorRef = String(raw.factorRef || '').trim();
      else out.def.factor = safeNumber(raw.factor, 1);
    }

    return out;
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
    out.viewport.gridStrokeWidth = Math.max(0.1, safeNumber(out.viewport.gridStrokeWidth, 1));
    out.viewport.axisStrokeWidth = Math.max(0.1, safeNumber(out.viewport.axisStrokeWidth, 1.5));
    out.viewport.gridDarkness = Math.max(0, Math.min(100, safeNumber(out.viewport.gridDarkness, 0)));
    out.viewport.axisDarkness = Math.max(0, Math.min(100, safeNumber(out.viewport.axisDarkness, 0)));
    out.viewport.showXAxisLabels = out.viewport.showXAxisLabels === true;
    out.viewport.showYAxisLabels = out.viewport.showYAxisLabels === true;
    out.viewport.xAxisLabelStep = Math.max(0.000001, safeNumber(out.viewport.xAxisLabelStep, 1));
    out.viewport.yAxisLabelStep = Math.max(0.000001, safeNumber(out.viewport.yAxisLabelStep, 1));

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

  function serializeSceneForHtmlBlock(scene) {
    return JSON.stringify(scene, null, 2)
      .replace(/&/g, '&amp;')
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
      gridStrokeWidth: 1,
      axisStrokeWidth: 1.5,
      gridDarkness: 0,
      axisDarkness: 0,
      showXAxisLabels: false,
      xAxisLabelStep: 1,
      showYAxisLabels: false,
      yAxisLabelStep: 1,
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
    const viewportSource = source.viewport || source.view;

    return {
      version: DEFAULT_INTERNAL_SCENE.version,
      meta: mergeSceneSection(DEFAULT_INTERNAL_SCENE.meta, source.meta),
      viewport: mergeSceneSection(DEFAULT_INTERNAL_SCENE.viewport, viewportSource),
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
      raw = SceneParser.unescapeHtmlSceneText(dataMatch[1].trim());
    } else {
      const scriptContent = SceneParser.extractJsonScriptContent(raw);

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
    if (options.sceneSource) return parseSceneText(SceneParser.readSceneSource(options.sceneSource));
    if (options.target || options.container) {
      const embedded = SceneParser.readEmbeddedSceneText(SceneParser.resolveSceneSourceElement(options.target || options.container));
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
      .geo2d-root.geo2d-viewer-root {
        border-radius: 8px !important;
        overflow: hidden !important;
      }
      .geo2d-mainpanel {
        width: 100% !important;
        min-width: 0 !important;
      }
      .geo2d-root.geo2d-print-compact {
        border: none !important;
        border-radius: 0 !important;
        background: transparent !important;
      }
      .geo2d-root.geo2d-print-compact .geo2d-status {
        display: none !important;
      }
      .geo2d-root.geo2d-print-compact .geo2d-svg {
        max-width: 100% !important;
      }
      @media print {
        :host(.geo2d-print-compact),
        :host([data-print-height]),
        :host([data-viewer-height]) {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .geo2d-root.geo2d-viewer-root .geo2d-status {
          display: none !important;
        }
        .geo2d-root.geo2d-print-compact {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
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

      .geo2d-field input[type="color"] {
        padding: 2px 4px !important;
        height: 36px !important;
        width: 100% !important;
        cursor: pointer !important;
      }

.geo2d-check {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-size: 13px !important;
  color: #111827 !important;
}

.geo2d-prop-angle-wrap,
.geo2d-prop-area-wrap,
.geo2d-prop-number-wrap,
.geo2d-prop-notables-wrap,
.geo2d-prop-param-wrap,
.geo2d-prop-view-wrap {
  display: none !important;
  border-top: 1px solid #e5e7eb !important;
  padding-top: 10px !important;
  gap: 10px !important;
  flex-direction: column !important;
  min-width: 0 !important;
}

.geo2d-prop-view-wrap .geo2d-field,
.geo2d-prop-view-wrap .geo2d-check {
  width: 100% !important;
  box-sizing: border-box !important;
}

.geo2d-prop-view-wrap .geo2d-field input {
  width: 100% !important;
  box-sizing: border-box !important;
}

.geo2d-number-controls {
  display: grid !important;
  grid-template-columns: auto minmax(0, 1fr) auto !important;
  gap: 8px !important;
  align-items: center !important;
}

.geo2d-number-btn {
  min-width: 36px !important;
  min-height: 36px !important;
  border: 1px solid #d7dce3 !important;
  border-radius: 10px !important;
  background: #ffffff !important;
  color: #111827 !important;
  font-size: 18px !important;
  line-height: 1 !important;
  cursor: pointer !important;
}

.geo2d-number-btn:disabled {
  opacity: 0.5 !important;
  cursor: default !important;
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
      .geo2d-param-body {
        padding: 16px !important;
        display: grid !important;
        gap: 12px !important;
        color: #111827 !important;
      }
      .geo2d-param-mode {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
      }
      .geo2d-param-choice {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        border: 1px solid #d7dce3 !important;
        border-radius: 8px !important;
        padding: 10px !important;
        background: #ffffff !important;
        font-size: 13px !important;
      }
      .geo2d-param-field {
        display: grid !important;
        gap: 6px !important;
      }
      .geo2d-param-field span {
        font-size: 12px !important;
        font-weight: bold !important;
        color: #4b5563 !important;
      }
      .geo2d-param-field input,
      .geo2d-param-field select {
        width: 100% !important;
        box-sizing: border-box !important;
        border: 1px solid #d7dce3 !important;
        border-radius: 8px !important;
        padding: 8px 10px !important;
        font-size: 13px !important;
        color: #111827 !important;
        background: #ffffff !important;
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

  function darkenHexColor(hex, amount) {
    const clean = String(hex || '').trim();
    const match = clean.match(/^#([0-9a-fA-F]{6})$/);
    if (!match) return clean || '#000000';

    const t = Math.max(0, Math.min(100, safeNumber(amount, 0))) / 100;
    const n = parseInt(match[1], 16);
    const r = Math.round(((n >> 16) & 255) * (1 - t));
    const g = Math.round(((n >> 8) & 255) * (1 - t));
    const b = Math.round((n & 255) * (1 - t));
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
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

  function resolveRegularPolygonPoints(center, vertex, sides) {
    if (!center || !vertex) return null;
    const count = Math.floor(safeNumber(sides, NaN));
    if (!(count >= 3)) return null;

    const dx = vertex.x - center.x;
    const dy = vertex.y - center.y;
    const radius = Math.hypot(dx, dy);
    if (!(radius > 1e-9)) return null;

    const startAngle = Math.atan2(dy, dx);
    const step = (Math.PI * 2) / count;
    const points = [];

    for (let index = 0; index < count; index++) {
      const angle = startAngle + step * index;
      points.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      });
    }

    return points;
  }

  function resolveRegularPolygonVertexFromOrientation(center, radius, orientationAngle) {
    if (!center) return null;
    const nextRadius = safeNumber(radius, NaN);
    const nextAngle = safeNumber(orientationAngle, NaN);
    if (!(nextRadius > 1e-9) || !Number.isFinite(nextAngle)) return null;
    return {
      x: center.x + Math.cos(nextAngle) * nextRadius,
      y: center.y + Math.sin(nextAngle) * nextRadius
    };
  }

  function radiansToDegrees(value) {
    return safeNumber(value, 0) * 180 / Math.PI;
  }

  function perimeterOfPointLoop(points, closed = false) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    let total = 0;
    const last = closed ? points.length : points.length - 1;
    for (let index = 0; index < last; index++) {
      const a = points[index];
      const b = closed ? points[(index + 1) % points.length] : points[index + 1];
      total += dist(a.x, a.y, b.x, b.y);
    }
    return total;
  }

  function resolveEllipseDerivedPoint(ellipseResolved, role) {
    if (!ellipseResolved || ellipseResolved.kind !== 'ellipse') return null;
    if (role === 'antiVertex') return ellipseResolved.antiVertex || null;
    if (role === 'antiCoVertex') return ellipseResolved.antiCoVertex || null;
    return null;
  }

  function ellipseAxisOrientationSign(center, vertex, coVertex) {
    const value = cross2(
      vertex.x - center.x,
      vertex.y - center.y,
      coVertex.x - center.x,
      coVertex.y - center.y
    );
    return value < 0 ? -1 : 1;
  }

  function perpendicularCoVertexForAxis(center, vertex, radius, orientation = 1) {
    if (!center || !vertex || !(radius > 1e-9)) return null;
    const dx = vertex.x - center.x;
    const dy = vertex.y - center.y;
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) return null;

    return {
      x: center.x + (-dy / len) * radius * orientation,
      y: center.y + (dx / len) * radius * orientation
    };
  }

  function perpendicularVertexForCoAxis(center, coVertex, radius, orientation = 1) {
    if (!center || !coVertex || !(radius > 1e-9)) return null;
    const dx = coVertex.x - center.x;
    const dy = coVertex.y - center.y;
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) return null;

    return {
      x: center.x + (dy / len) * radius * orientation,
      y: center.y + (-dx / len) * radius * orientation
    };
  }

  function projectPointToEllipseCoVertexAxis(center, vertex, point) {
    if (!center || !vertex || !point) return null;

    const dx = vertex.x - center.x;
    const dy = vertex.y - center.y;
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) return null;

    const nx = -dy / len;
    const ny = dx / len;
    const signedDistance = (point.x - center.x) * nx + (point.y - center.y) * ny;
    if (Math.abs(signedDistance) <= 1e-9) return null;

    return {
      x: center.x + nx * signedDistance,
      y: center.y + ny * signedDistance
    };
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

  function pickUniqueClosestWorldPoint(points, target, epsilon = 1e-9) {
    if (!points || !points.length) return null;
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return null;

    const eps = Math.max(0, safeNumber(epsilon, 1e-9));
    let best = points[0];
    let bestDistance = dist(points[0].x, points[0].y, target.x, target.y);
    let tied = false;

    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const distance = dist(point.x, point.y, target.x, target.y);
      if (distance < bestDistance - eps) {
        best = point;
        bestDistance = distance;
        tied = false;
        continue;
      }

      if (Math.abs(distance - bestDistance) <= eps) {
        tied = true;
      }
    }

    return tied ? null : best;
  }

  function screenTextBoundsFromAnchor(anchor, text, fontSize, options = {}) {
    const size = Math.max(8, safeNumber(fontSize, 14));
    const widthFactor = safeNumber(options.widthFactor, 0.62);
    const padX = safeNumber(options.padX, 4);
    const padTop = safeNumber(options.padTop, 4);
    const padBottom = safeNumber(options.padBottom, 4);
    const width = Math.max(size * 0.7, String(text || '').length * size * widthFactor);
    const height = size * 1.35;

    return {
      anchor,
      x: anchor.x - padX,
      y: anchor.y - size - padTop,
      width: width + padX * 2,
      height: height + padTop + padBottom
    };
  }

  function textScreenBounds(vp, w, h, resolved, fontSize) {
    const anchor = worldToScreen(vp, w, h, resolved.x, resolved.y);
    return screenTextBoundsFromAnchor(anchor, resolved.text || '', fontSize);
  }

  const LABEL_POSITION_PRESETS = Object.freeze({
    right: Object.freeze({ x: 10, y: 0 }),
    left: Object.freeze({ x: -10, y: 0 }),
    above: Object.freeze({ x: 0, y: -12 }),
    below: Object.freeze({ x: 0, y: 14 }),
    'upper-right': Object.freeze({ x: 10, y: -10 }),
    'upper-left': Object.freeze({ x: -10, y: -10 }),
    'lower-right': Object.freeze({ x: 10, y: 14 }),
    'lower-left': Object.freeze({ x: -10, y: 14 })
  });

  function getStoredLabelOffset(raw) {
    const offset = raw?.labelOffset;
    if (offset && typeof offset === 'object' && !Array.isArray(offset)) {
      return {
        x: safeNumber(offset.x, 0),
        y: safeNumber(offset.y, 0)
      };
    }
    return { x: 0, y: 0 };
  }

  function getLabelOffset(raw, defaultX = 10, defaultY = -10) {
    const preset = LABEL_POSITION_PRESETS[String(raw?.labelPosition || '').trim().toLowerCase()];
    const base = preset || { x: defaultX, y: defaultY };
    const extra = getStoredLabelOffset(raw);
    return {
      x: base.x + extra.x,
      y: base.y + extra.y
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

  function resolveMeasuredAngleValue(model, raw) {
    const unit = getAngleUnit(raw);
    if (String(raw.measureRef || '').trim()) {
      const value = model.getNumberValue(raw.measureRef);
      const numericValue = safeNumber(value, NaN);
      const fullTurn = getAngleFullTurn(unit);
      return numericValue > 1e-9 && numericValue < fullTurn - 1e-9 ? numericValue : NaN;
    }
    const numericValue = safeNumber(raw.measureValue, NaN);
    const fullTurn = getAngleFullTurn(unit);
    return numericValue > 1e-9 && numericValue < fullTurn - 1e-9 ? numericValue : NaN;
  }

  function resolveMeasuredAngleTerminalPoint(vertex, firstPoint, measureValue, unit = 'deg', direction = 'ccw') {
    if (!vertex || !firstPoint) return null;
    const dx = firstPoint.x - vertex.x;
    const dy = firstPoint.y - vertex.y;
    const radius = Math.hypot(dx, dy);
    if (!(radius > 1e-9)) return null;

    const baseAngle = Math.atan2(dy, dx);
    const delta = unit === 'rad' ? safeNumber(measureValue, 0) : (safeNumber(measureValue, 0) * Math.PI) / 180;
    const signedDelta = normalizeAngleDirection(direction, 'ccw') === 'cw' ? -delta : delta;
    const nextAngle = baseAngle + signedDelta;
    return {
      x: vertex.x + Math.cos(nextAngle) * radius,
      y: vertex.y + Math.sin(nextAngle) * radius
    };
  }

  function resolveAngleMeasureInfo(a, b, c, unit, viewport, options = {}) {
    const angleAB = Math.atan2(a.y - b.y, a.x - b.x);
    const angleCB = Math.atan2(c.y - b.y, c.x - b.x);
    const signedDelta = normalizeAngleSigned(angleCB - angleAB);
    const minorDelta = Math.abs(signedDelta);
    const mode = normalizeAngleMode(options.mode ?? (options.concave === true ? 'concave' : 'normal'), 'normal');
    const concave = mode === 'concave';

    const span = Math.max(
      1e-6,
      Math.min(
        safeNumber(viewport?.xMax, 10) - safeNumber(viewport?.xMin, -10),
        safeNumber(viewport?.yMax, 10) - safeNumber(viewport?.yMin, -10)
      )
    );
    const leg = Math.min(dist(a.x, a.y, b.x, b.y), dist(c.x, c.y, b.x, b.y));
    const delta = concave ? (Math.PI * 2) - minorDelta : minorDelta;
    const radius = concave
      ? clamp(leg * 0.42, span * 0.05, span * 0.18)
      : clamp(leg * 0.28, span * 0.03, span * 0.12);

    const startAngle = concave
      ? (signedDelta >= 0 ? angleCB : angleAB)
      : (signedDelta >= 0 ? angleAB : angleCB);
    const bisectorAngle = startAngle + delta / 2;
    const labelDistance = radius * (concave ? 1.18 : 1.45);
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
      concave,
      mode,
      value,
      unit,
      anchor: {
        x: b.x + Math.cos(bisectorAngle) * labelDistance,
        y: b.y + Math.sin(bisectorAngle) * labelDistance
      },
      text
    };
  }

  function resolveBisectorRayPoints(a, b, c, mode = 'normal') {
    if (!a || !b || !c) return null;

    const ux = a.x - b.x;
    const uy = a.y - b.y;
    const vx = c.x - b.x;
    const vy = c.y - b.y;
    const uLen = Math.sqrt(ux * ux + uy * uy);
    const vLen = Math.sqrt(vx * vx + vy * vy);
    if (uLen <= 1e-9 || vLen <= 1e-9) return null;

    const uNormX = ux / uLen;
    const uNormY = uy / uLen;
    const vNormX = vx / vLen;
    const vNormY = vy / vLen;
    const cross = uNormX * vNormY - uNormY * vNormX;
    if (Math.abs(cross) <= 1e-9) return null;

    const bisectorMode = normalizeBisectorMode(mode, 'normal');
    const sx = uNormX + vNormX;
    const sy = uNormY + vNormY;
    const sLen = Math.sqrt(sx * sx + sy * sy);
    if (sLen <= 1e-9) return null;
    const dirX = bisectorMode === 'concave' ? -sx / sLen : sx / sLen;
    const dirY = bisectorMode === 'concave' ? -sy / sLen : sy / sLen;

    return {
      p1: { x: b.x, y: b.y },
      p2: { x: b.x + dirX, y: b.y + dirY }
    };
  }

  function resolveBisectorDerivedPointDistance(a, vertex, c) {
    if (!a || !vertex || !c) return 1;
    const av = dist(a.x, a.y, vertex.x, vertex.y);
    const cv = dist(c.x, c.y, vertex.x, vertex.y);
    const average = (av + cv) / 2;
    return average > 1e-9 ? average : 1;
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

  function circularArcDelta(startAngle, endAngle, direction = 'ccw') {
    let delta = safeNumber(endAngle, 0) - safeNumber(startAngle, 0);
    if (normalizeAngleDirection(direction, 'ccw') === 'cw') {
      while (delta > 0) delta -= Math.PI * 2;
      while (delta <= -Math.PI * 2) delta += Math.PI * 2;
      return delta;
    }

    while (delta < 0) delta += Math.PI * 2;
    while (delta >= Math.PI * 2) delta -= Math.PI * 2;
    return delta;
  }

  function resolveCircularArcGeometry(center, start, end, direction = 'ccw') {
    if (!center || !start || !end) return null;
    const radius = dist(center.x, center.y, start.x, start.y);
    const endRadius = dist(center.x, center.y, end.x, end.y);
    if (!(radius > 1e-9) || !(endRadius > 1e-9)) return null;

    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    const normalizedDirection = normalizeAngleDirection(direction, 'ccw');
    const delta = circularArcDelta(startAngle, endAngle, normalizedDirection);
    const endOnCircle = {
      x: center.x + Math.cos(startAngle + delta) * radius,
      y: center.y + Math.sin(startAngle + delta) * radius
    };
    const angleRad = Math.abs(delta);

    return {
      center,
      start,
      end,
      endOnCircle,
      radius,
      startAngle,
      endAngle: startAngle + delta,
      delta,
      direction: normalizedDirection,
      angleRad,
      angleDeg: radiansToDegrees(angleRad),
      arcLength: radius * angleRad,
      sectorArea: 0.5 * radius * radius * angleRad
    };
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

  function resolveTransform(model, raw) {
    const kind = String(raw?.transformKind || '').trim().toLowerCase();

    if (kind === 'translation') {
      const vector = model.getResolvedObject(raw.vectorId);
      if (!vector || vector.kind !== 'vector') return null;
      const dx = vector.p2.x - vector.p1.x;
      const dy = vector.p2.y - vector.p1.y;
      return {
        kind,
        applyPoint: point => ({ x: point.x + dx, y: point.y + dy })
      };
    }

    if (kind === 'rotation') {
      const center = model.getPointPosition(raw.center);
      const angleValue = String(raw.angleRef || '').trim()
        ? model.getNumberValue(raw.angleRef)
        : safeNumber(raw.angle, NaN);
      if (!center || !Number.isFinite(angleValue)) return null;
      const angle = (raw.unit === 'rad' ? angleValue : (angleValue * Math.PI) / 180) *
        (normalizeAngleDirection(raw.direction, 'ccw') === 'cw' ? -1 : 1);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        kind,
        applyPoint: point => {
          const dx = point.x - center.x;
          const dy = point.y - center.y;
          return {
            x: center.x + dx * cos - dy * sin,
            y: center.y + dx * sin + dy * cos
          };
        }
      };
    }

    if (kind === 'reflection') {
      const axis = model.getResolvedObject(raw.axis);
      if (!axis || !['segment', 'line', 'ray'].includes(axis.kind)) return null;
      const ax = axis.p1.x;
      const ay = axis.p1.y;
      const vx = axis.p2.x - axis.p1.x;
      const vy = axis.p2.y - axis.p1.y;
      const len2 = vx * vx + vy * vy;
      if (len2 < 1e-12) return null;
      return {
        kind,
        applyPoint: point => {
          const t = ((point.x - ax) * vx + (point.y - ay) * vy) / len2;
          const px = ax + t * vx;
          const py = ay + t * vy;
          return {
            x: 2 * px - point.x,
            y: 2 * py - point.y
          };
        }
      };
    }

    if (kind === 'central-symmetry') {
      const center = model.getPointPosition(raw.center);
      if (!center) return null;
      return {
        kind,
        applyPoint: point => ({
          x: 2 * center.x - point.x,
          y: 2 * center.y - point.y
        })
      };
    }

    if (kind === 'homothety') {
      const center = model.getPointPosition(raw.center);
      const factor = String(raw.factorRef || '').trim()
        ? model.getNumberValue(raw.factorRef)
        : safeNumber(raw.factor, NaN);
      if (!center || !Number.isFinite(factor) || Math.abs(factor) <= 1e-9) return null;
      return {
        kind,
        applyPoint: point => ({
          x: center.x + factor * (point.x - center.x),
          y: center.y + factor * (point.y - center.y)
        })
      };
    }

    return null;
  }

  function transformResolvedObject(resolved, transform) {
    if (!resolved || !transform || typeof transform.applyPoint !== 'function') return null;
    const mapPoint = point => point ? transform.applyPoint(point) : null;

    if (resolved.kind === 'point') {
      const point = mapPoint(resolved);
      return point ? { kind: 'point', ...point } : null;
    }

    if (['segment', 'line', 'ray', 'vector'].includes(resolved.kind)) {
      const p1 = mapPoint(resolved.p1);
      const p2 = mapPoint(resolved.p2);
      if (!p1 || !p2) return null;
      return { ...resolved, kind: resolved.kind, p1, p2 };
    }

    if (resolved.kind === 'circle') {
      const center = mapPoint(resolved.center);
      if (!center) return null;
      return {
        ...resolved,
        kind: 'circle',
        center,
        ...(resolved.through ? { through: mapPoint(resolved.through) } : {})
      };
    }

    if (resolved.kind === 'polygon' || resolved.kind === 'polyline') {
      const points = (resolved.points || []).map(mapPoint).filter(Boolean);
      if (points.length < (resolved.kind === 'polygon' ? 3 : 2)) return null;
      return {
        ...resolved,
        kind: resolved.kind,
        points
      };
    }

    return null;
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
      this.raw.pickX = safeNumber(this.raw.pickX, NaN);
      this.raw.pickY = safeNumber(this.raw.pickY, NaN);
      this.raw.select = normalizeIntersectionSelect(this.raw.select, null);
    }

    getRefs() {
      return cleanObjectRefs([
        this.raw.objectId,
        this.raw.objectId2,
        this.raw.select?.by === 'nearest-to-point' ? this.raw.select.point : ''
      ]);
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
      if (hits.length === 1) return hits[0];

      if (this.raw.select?.by === 'nearest-to-point') {
        const targetPoint = model.getResolvedObject(this.raw.select.point);
        if (targetPoint && targetPoint.kind === 'point') {
          const selected = pickUniqueClosestWorldPoint(hits, {
            x: targetPoint.x,
            y: targetPoint.y
          });
          if (selected) return selected;
        }
      }

      if (!hasFiniteIntersectionHint(this.raw)) return null;

      return pickClosestWorldPoint(hits, {
        x: this.raw.pickX,
        y: this.raw.pickY
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

  class AngleTerminalPointConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'angle-terminal-point';
      this.raw.objectId = String(this.raw.objectId || '').trim();
    }

    resolve(model) {
      const angle = model.getResolvedObject(this.raw.objectId);
      if (!angle || angle.kind !== 'angle') return null;
      return angle.p2 ? { x: angle.p2.x, y: angle.p2.y } : null;
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

  class RegularPolygonVertexConstraint extends Constraint {
    constructor(raw = {}) {
      super(raw);
      this.raw.kind = 'regular-polygon-vertex';
      this.raw.objectId = String(this.raw.objectId || '').trim();
      this.raw.index = Math.floor(safeNumber(this.raw.index, 1));
    }

    resolve(model) {
      const polygon = model.getResolvedObject(this.raw.objectId);
      if (!polygon || polygon.kind !== 'polygon' || !Array.isArray(polygon.points)) return null;
      const index = Math.floor(safeNumber(this.raw.index, -1));
      if (index < 0 || index >= polygon.points.length) return null;
      return polygon.points[index] || null;
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
    'angle-terminal-point': AngleTerminalPointConstraint,
    'ellipse-derived-point': EllipseDerivedPointConstraint,
    'regular-polygon-vertex': RegularPolygonVertexConstraint
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

  class BisectorRayObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'bisector-ray';
    }

    getRefs() {
      return [this.raw.p1, this.raw.vertex, this.raw.p2].filter(Boolean);
    }

    getResolved(model) {
      const p1 = model.getPointPosition(this.raw.p1);
      const vertex = model.getPointPosition(this.raw.vertex);
      const p2 = model.getPointPosition(this.raw.p2);
      const ray = resolveBisectorRayPoints(p1, vertex, p2, this.raw.mode);
      return ray ? { kind: 'ray', ...ray, ref: this } : null;
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
      normalizeCurveAreaParts(this.raw, false);
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
        fillVisible: isCurveAreaVisible(this.raw, false),
        ref: this
      };
    }
  }

  class CircleRadiusObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'circle-radius';
      normalizeCurveAreaParts(this.raw, false);
    }

    getRefs() {
      return getCircleRadiusRawObjectRefs(this.raw);
    }

    getResolved(model) {
      const center = model.getPointPosition(this.raw.center);
      if (!center) return null;
      const radius = String(this.raw.radiusRef || '').trim()
        ? model.getNumberValue(this.raw.radiusRef)
        : safeNumber(this.raw.radius, 1);
      if (!(radius > 1e-9)) return null;

      return {
        kind: 'circle',
        center,
        radius,
        fillVisible: isCurveAreaVisible(this.raw, false),
        ref: this
      };
    }
  }

  class CircularArcObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'circle-arc';
      this.raw.direction = normalizeAngleDirection(this.raw.direction, 'ccw');
    }

    getRefs() {
      return getCircularArcRawObjectRefs(this.raw);
    }

    getResolved(model) {
      const center = model.getPointPosition(this.raw.center);
      const start = model.getPointPosition(this.raw.start);
      const end = model.getPointPosition(this.raw.end);
      const geometry = resolveCircularArcGeometry(center, start, end, this.raw.direction);
      if (!geometry) return null;
      return {
        kind: 'circle-arc',
        ...geometry,
        ref: this
      };
    }
  }

  class CircularSectorObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'circular-sector';
      this.raw.direction = normalizeAngleDirection(this.raw.direction, 'ccw');
      normalizeCurveAreaParts(this.raw, true);
    }

    getRefs() {
      return getCircularArcRawObjectRefs(this.raw);
    }

    getResolved(model) {
      const center = model.getPointPosition(this.raw.center);
      const start = model.getPointPosition(this.raw.start);
      const end = model.getPointPosition(this.raw.end);
      const geometry = resolveCircularArcGeometry(center, start, end, this.raw.direction);
      if (!geometry) return null;
      return {
        kind: 'circular-sector',
        ...geometry,
        fillVisible: isCurveAreaVisible(this.raw, true),
        ref: this
      };
    }
  }

  class EllipseObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'ellipse';
      normalizeCurveAreaParts(this.raw, false);
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
        fillVisible: isCurveAreaVisible(this.raw, false),
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

  class RegularPolygonObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'regular-polygon';
      normalizePolygonParts(this.raw);
    }

    getRefs() {
      return getRegularPolygonRawObjectRefs(this.raw);
    }

    getResolved(model) {
      const center = model.getPointPosition(this.raw.center);
      const vertex = String(this.raw.vertex || '').trim()
        ? model.getPointPosition(this.raw.vertex)
        : resolveRegularPolygonVertexFromOrientation(
          center,
          String(this.raw.radiusRef || '').trim()
            ? model.getNumberValue(this.raw.radiusRef)
            : safeNumber(this.raw.radius, NaN),
          this.raw.orientationAngle
        );
      const points = resolveRegularPolygonPoints(center, vertex, this.raw.sides);
      if (!points) return null;

      const sides = Math.floor(safeNumber(this.raw.sides, points.length));
      const circumradius = dist(center.x, center.y, vertex.x, vertex.y);
      const sideLength = points.length >= 2 ? dist(points[0].x, points[0].y, points[1].x, points[1].y) : 0;
      const apothem = circumradius * Math.cos(Math.PI / sides);
      const perimeter = sideLength * sides;

      normalizePolygonParts(this.raw);
      return {
        kind: 'polygon',
        center,
        vertex,
        sides,
        circumradius,
        sideLength,
        apothem,
        perimeter,
        centralAngle: (Math.PI * 2) / sides,
        points,
        edgeVisibility: this.raw.parts.edges.map(edge => edge.visible !== false),
        fillVisible: isPolygonFillVisible(this.raw),
        ref: this
      };
    }
  }

  class AngleObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'angle';
    }

    getRefs() {
      return getAngleRawObjectRefs(this.raw);
    }

    getResolved(model) {
      return resolveAngle(model, this);
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

  class NumberObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'number';
      this.raw.numberKind = String(this.raw.numberKind || 'independent').trim().toLowerCase() || 'independent';
    }

    getRefs() {
      return getNumberRawObjectRefs(this.raw);
    }

    getResolved(model) {
      const resolved = resolveNumber(model, this);
      return resolved ? { ...resolved, ref: this } : null;
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

  class TransformObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'transform';
      this.raw.transformKind = String(this.raw.transformKind || '').trim().toLowerCase();
    }

    getRefs() {
      return getTransformRawObjectRefs(this.raw);
    }

    getResolved(model) {
      const transform = resolveTransform(model, this.raw);
      return transform ? {
        kind: 'transform',
        transformKind: this.raw.transformKind,
        ref: this,
        applyPoint: transform.applyPoint
      } : null;
    }
  }

  class ImagePointObject extends PointBase {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'image-point';
      this.raw.draggable = false;
    }

    getRefs() {
      return getImageRawObjectRefs(this.raw);
    }

    getPosition(model) {
      const source = model.getResolvedObject(this.raw.objectId);
      const transformObj = model.getObject(this.raw.transformId);
      const transform = transformObj ? resolveTransform(model, transformObj.raw) : null;
      const transformed = transformResolvedObject(source, transform);
      return transformed && transformed.kind === 'point'
        ? { x: transformed.x, y: transformed.y }
        : null;
    }

    isDraggable() {
      return false;
    }
  }

  class ImageObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'image-object';
    }

    getRefs() {
      return getImageRawObjectRefs(this.raw);
    }

    getResolved(model) {
      const source = model.getResolvedObject(this.raw.objectId);
      const transformObj = model.getObject(this.raw.transformId);
      const transform = transformObj ? resolveTransform(model, transformObj.raw) : null;
      const transformed = transformResolvedObject(source, transform);
      return transformed ? { ...transformed, ref: this } : null;
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
    'image-point': Object.freeze({
      create: raw => new ImagePointObject(raw),
      toConstruction: buildImagePointConstruction,
      validate: validateImageObject,
      refs: getImageRawObjectRefs,
      typeLabel: 'Punto imagen',
      describeRefs: describeImageRefs,
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
    'bisector-ray': Object.freeze({
      create: raw => new BisectorRayObject(raw),
      toConstruction: buildBisectorRayConstruction,
      validate: validateBisectorRayObject,
      refs: getAngleThreePointRawObjectRefs,
      typeLabel: 'Bisectriz',
      describeRefs: describeBisectorRayRefs,
      group: 'lines',
      families: Object.freeze(['directional', 'intersectable']),
      getNotableEntries: (editor, raw) => editor.getBisectorDerivedPointEntries(raw),
      notableTitle: 'Punto bisectriz',
      getPropertyPanelState: (editor, obj) => ({
        isBisector: true,
        showExtra: true,
        extraLabel: 'Modo',
        extraValue: normalizeBisectorMode(obj.raw.mode, 'normal'),
        extraOptions: PROPERTY_EXTRA_BISECTOR_MODE_OPTIONS,
        bisectorMode: normalizeBisectorMode(obj.raw.mode, 'normal')
      })
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
      families: Object.freeze(['intersectable']),
      supportsArea: true,
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'circle') return null;
        const radius = safeNumber(resolved.radius, 0);
        return {
          radius,
          diameter: radius * 2,
          circumference: Math.PI * radius * 2,
          area: Math.PI * radius * radius
        };
      }
    }),
    'circle-radius': Object.freeze({
      create: raw => new CircleRadiusObject(raw),
      toConstruction: buildCircleRadiusConstruction,
      validate: validateCircleRadiusObject,
      refs: getCircleRadiusRawObjectRefs,
      typeLabel: 'Circunferencia (C,r)',
      describeRefs: describeCircleRadiusRefs,
      group: 'curves',
      families: Object.freeze(['intersectable']),
      supportsArea: true,
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'circle') return null;
        const radius = safeNumber(resolved.radius, 0);
        return {
          radius,
          diameter: radius * 2,
          circumference: Math.PI * radius * 2,
          area: Math.PI * radius * radius
        };
      }
    }),
    'circle-arc': Object.freeze({
      create: raw => new CircularArcObject(raw),
      toConstruction: raw => buildCircularArcConstruction(raw, 'arc'),
      validate: validateCircularArcObject,
      refs: getCircularArcRawObjectRefs,
      typeLabel: 'Arco de circunferencia',
      describeRefs: describeCircularArcRefs,
      group: 'curves',
      families: Object.freeze([]),
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'circle-arc') return null;
        return {
          radius: safeNumber(resolved.radius, 0),
          angleDeg: safeNumber(resolved.angleDeg, 0),
          angleRad: safeNumber(resolved.angleRad, 0),
          arcLength: safeNumber(resolved.arcLength, 0)
        };
      }
    }),
    'circular-sector': Object.freeze({
      create: raw => new CircularSectorObject(raw),
      toConstruction: raw => buildCircularArcConstruction(raw, 'sector'),
      validate: validateCircularSectorObject,
      refs: getCircularArcRawObjectRefs,
      typeLabel: 'Sector circular',
      describeRefs: describeCircularArcRefs,
      group: 'curves',
      families: Object.freeze([]),
      supportsArea: true,
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'circular-sector') return null;
        const radius = safeNumber(resolved.radius, 0);
        const arcLength = safeNumber(resolved.arcLength, 0);
        return {
          radius,
          angleDeg: safeNumber(resolved.angleDeg, 0),
          angleRad: safeNumber(resolved.angleRad, 0),
          arcLength,
          area: safeNumber(resolved.sectorArea, 0),
          perimeter: 2 * radius + arcLength
        };
      }
    }),
    ellipse: Object.freeze({
      create: raw => new EllipseObject(raw),
      toConstruction: buildEllipseConstruction,
      validate: validateEllipseObject,
      refs: getEllipseRawObjectRefs,
      typeLabel: 'Elipse',
      describeRefs: describeEllipseRefs,
      group: 'curves',
      families: Object.freeze(['intersectable']),
      supportsArea: true,
      getNotableEntries: (editor, raw) => editor.getEllipseNotablePointEntries(raw),
      notableTitle: 'Puntos notables',
      getDerivedEntities: raw => ({
        notablePoints: {
          center: String(raw.center || '').trim(),
          vertex: String(raw.vertex || '').trim(),
          coVertex: String(raw.coVertex || '').trim(),
          antiVertex: String(raw.derivedPoints?.antiVertex || '').trim(),
          antiCoVertex: String(raw.derivedPoints?.antiCoVertex || '').trim()
        }
      }),
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'ellipse') return null;
        const rx = safeNumber(resolved.rx, 0);
        const ry = safeNumber(resolved.ry, 0);
        return {
          semiMajorRadius: rx,
          semiMinorRadius: ry,
          majorAxisLength: rx * 2,
          minorAxisLength: ry * 2,
          rotationRad: safeNumber(resolved.rotation, 0),
          rotationDeg: radiansToDegrees(resolved.rotation),
          area: Math.PI * rx * ry
        };
      }
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
      families: Object.freeze(['intersectable']),
      supportsArea: true,
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'polygon') return null;
        return {
          area: polygonArea(resolved.points),
          perimeter: perimeterOfPointLoop(resolved.points, true),
          sides: Array.isArray(resolved.points) ? resolved.points.length : 0
        };
      }
    }),
    'regular-polygon': Object.freeze({
      create: raw => new RegularPolygonObject(raw),
      toConstruction: buildRegularPolygonConstruction,
      validate: validateRegularPolygonObject,
      refs: getRegularPolygonRawObjectRefs,
      typeLabel: 'Polígono regular',
      describeRefs: describeRegularPolygonRefs,
      group: 'figures',
      families: Object.freeze(['intersectable']),
      supportsArea: true,
      getNotableEntries: (editor, raw) => editor.getRegularPolygonNotablePointEntries(raw),
      notableTitle: 'Puntos notables',
      getDerivedEntities: raw => {
        const pointIds = Array.isArray(raw.points) ? raw.points.map(id => String(id || '').trim()).filter(Boolean) : [];
        const baseVertexId = String(raw.vertex || '').trim() || pointIds[0] || '';
        return {
          notablePoints: {
            center: String(raw.center || '').trim(),
            vertex: baseVertexId,
            vertices: pointIds,
            derivedVertices: pointIds.slice(1)
          },
          points: pointIds,
          derivedVertices: pointIds.slice(1)
        };
      },
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'polygon') return null;
        const sides = Math.floor(safeNumber(resolved.sides, Array.isArray(resolved.points) ? resolved.points.length : 0));
        const sideLength = safeNumber(resolved.sideLength, 0);
        const circumradius = safeNumber(resolved.circumradius, 0);
        const apothem = safeNumber(resolved.apothem, 0);
        const perimeter = safeNumber(resolved.perimeter, sideLength * sides);
        const area = Number.isFinite(resolvedAreaValue(resolved)) ? resolvedAreaValue(resolved) : polygonArea(resolved.points);
        const centralAngle = safeNumber(resolved.centralAngle, sides > 0 ? (Math.PI * 2) / sides : 0);
        const interiorAngle = sides > 2 ? ((sides - 2) * Math.PI) / sides : 0;
        const exteriorAngle = sides > 0 ? (Math.PI * 2) / sides : 0;
        return {
          sides,
          sideLength,
          radius: circumradius,
          circumradius,
          inradius: apothem,
          apothem,
          perimeter,
          area,
          centralAngleRad: centralAngle,
          centralAngleDeg: radiansToDegrees(centralAngle),
          interiorAngleRad: interiorAngle,
          interiorAngleDeg: radiansToDegrees(interiorAngle),
          exteriorAngleRad: exteriorAngle,
          exteriorAngleDeg: radiansToDegrees(exteriorAngle)
        };
      }
    }),
    'image-object': Object.freeze({
      create: raw => new ImageObject(raw),
      toConstruction: buildImageObjectConstruction,
      validate: validateImageObject,
      refs: getImageRawObjectRefs,
      typeLabel: raw => `Imagen de ${getObjectTypeLabel({ type: raw?.sourceKind || '' })}`,
      describeRefs: describeImageRefs,
      group: 'transforms',
      families: Object.freeze(['directional', 'intersectable'])
    }),
    angle: Object.freeze({
      create: raw => new AngleObject(raw),
      toConstruction: buildAngleConstruction,
      validate: validateAngleObject,
      refs: getAngleRawObjectRefs,
      typeLabel: 'Ángulo',
      describeRefs: describeAngleRefs,
      group: 'measures',
      getNotableEntries: (editor, raw) => editor.getAngleDerivedPointEntries(raw),
      notableTitle: 'Punto terminal',
      getDerivedEntities: raw => getAngleDefinitionKind(raw) === 'vertex-ray-measure'
        ? {
          notablePoints: {
            terminalPoint: String(raw.derivedPoints?.p2 || '').trim()
          }
        }
        : {},
      getPropertyPanelState: (editor, obj, resolved) => ({
        isAngle: true,
        showExtra: true,
        extraLabel: 'Unidad',
        extraValue: getAngleUnit(obj.raw),
        extraOptions: PROPERTY_EXTRA_UNIT_OPTIONS,
        unit: getAngleUnit(obj.raw),
        angleConcave: normalizeAngleMode(resolved?.mode || obj.raw.mode, 'normal') === 'concave',
        angleArmsVisible: isAngleArmsVisible(obj.raw),
        angleArcVisible: isAngleArcVisible(obj.raw),
        angleSectorVisible: isAngleSectorVisible(obj.raw, true),
        angleMeasureVisible: isAngleMeasureVisible(obj.raw, true),
        angleGreekLabel: getGreekAngleLabelValue(obj.raw.label || '')
      }),
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'angle') return null;
        const valueRad = safeNumber(resolved.value, 0) * (resolved.unit === 'rad' ? 1 : Math.PI / 180);
        const valueDeg = resolved.unit === 'rad'
          ? radiansToDegrees(safeNumber(resolved.value, 0))
          : safeNumber(resolved.value, 0);
        return {
          mode: normalizeAngleMode(resolved.mode, 'normal'),
          valueDeg,
          valueRad
        };
      }
    }),
    measure: Object.freeze({
      create: raw => new MeasureObject(raw),
      toConstruction: buildMeasureConstruction,
      validate: validateMeasureObject,
      refs: getMeasureRawObjectRefs,
      typeLabel: 'Medida de distancia',
      describeRefs: describeMeasureRefs,
      group: 'measures'
    }),
    number: Object.freeze({
      create: raw => new NumberObject(raw),
      toConstruction: buildNumberConstruction,
      validate: validateNumberObject,
      refs: getNumberRawObjectRefs,
      typeLabel: raw => String(raw?.numberKind || '').trim().toLowerCase() === 'independent'
        ? 'Número independiente'
        : `Número dependiente (${getNumberKindLabel(raw?.numberKind)})`,
      describeRefs: describeNumberRefs,
      group: 'numbers',
      families: Object.freeze(['number']),
      getPropertyPanelState: (editor, obj) => {
        const isIndependentNumber = String(obj.raw.numberKind || '').trim().toLowerCase() === 'independent';
        return {
          isNumber: true,
          isIndependentNumber,
          numberValue: formatNumberShort(editor.model.getNumberValue(obj.id)),
          numberStep: isIndependentNumber ? formatNumberShort(obj.raw.step) : '',
          numberMin: isIndependentNumber && Number.isFinite(safeNumber(obj.raw.min, NaN)) ? formatNumberShort(obj.raw.min) : '',
          numberMax: isIndependentNumber && Number.isFinite(safeNumber(obj.raw.max, NaN)) ? formatNumberShort(obj.raw.max) : ''
        };
      },
      getComputedProperties: (raw, resolved) => {
        if (resolved?.kind !== 'number') return null;
        return {
          source: String(resolved.source || raw.numberKind || 'independent'),
          editable: resolved.editable === true,
          value: safeNumber(resolved.value, NaN),
          step: resolved.editable === true ? safeNumber(resolved.step, 1) : undefined,
          min: resolved.editable === true ? resolved.min : undefined,
          max: resolved.editable === true ? resolved.max : undefined,
          unit: String(resolved.unit || '')
        };
      }
    }),
    text: Object.freeze({
      create: raw => new TextObject(raw),
      toConstruction: buildTextConstruction,
      validate: validateTextObject,
      refs: getNoRawObjectRefs,
      typeLabel: 'Texto',
      describeRefs: describeTextRefs,
      group: 'texts'
    }),
    transform: Object.freeze({
      create: raw => new TransformObject(raw),
      toConstruction: buildTransformConstruction,
      validate: validateTransformObject,
      refs: getTransformRawObjectRefs,
      typeLabel: raw => `Transformacion (${getTransformKindLabel(raw?.transformKind)})`,
      describeRefs: describeTransformRefs,
      group: 'transforms',
      families: Object.freeze(['transform'])
    })
  });

  function getInternalObjectRegistryEntry(value) {
    const type = typeof value === 'string'
      ? value
      : InternalObjectAdapter.type(value);
    return INTERNAL_OBJECT_REGISTRY[type] || null;
  }

  function getObjectNotableEntries(editor, value) {
    const raw = InternalObjectAdapter.raw(value);
    const getter = getInternalObjectRegistryEntry(raw)?.getNotableEntries;
    return getter ? getter(editor, raw) : [];
  }

  function getObjectNotableTitle(value) {
    return getInternalObjectRegistryEntry(value)?.notableTitle || 'Puntos notables';
  }

  function getObjectDerivedEntities(value) {
    const raw = InternalObjectAdapter.raw(value);
    const getter = getInternalObjectRegistryEntry(raw)?.getDerivedEntities;
    return getter ? getter(raw) : {};
  }

  function getObjectComputedProperties(value, resolved) {
    const raw = InternalObjectAdapter.raw(value);
    if (!resolved) return null;
    const getter = getInternalObjectRegistryEntry(raw)?.getComputedProperties;
    return getter ? getter(raw, resolved) : null;
  }

  function objectSupportsArea(value) {
    return getInternalObjectRegistryEntry(value)?.supportsArea === true;
  }

  function getObjectPropertyPanelState(editor, value, resolved) {
    const getter = getInternalObjectRegistryEntry(value)?.getPropertyPanelState;
    return getter ? (getter(editor, value, resolved) || {}) : {};
  }

  function createEmptyPropertyPanelState() {
    return {
      obj: null,
      id: '',
      type: '',
      typeLabel: '',
      label: '',
      color: '#000000',
      refs: '',
      visible: false,
      isNumber: false,
      isIndependentNumber: false,
      isAngle: false,
      isBisector: false,
      isPolygon: false,
      isView: false,
      hasArea: false,
      isEllipse: false,
      isPart: false,
      labelEditable: false,
      angleConcave: false,
      angleArmsVisible: false,
      angleArcVisible: true,
      angleSectorVisible: true,
      angleMeasureVisible: true,
      angleGreekLabel: '',
      numberValue: '',
      numberStep: '',
      numberMin: '',
      numberMax: '',
      areaVisible: false,
      areaColor: '#ea580c',
      areaValue: '',
      notablePoints: [],
      showNotables: false,
      notableTitle: 'Puntos notables',
      showExtra: false,
      extraLabel: 'Unidad',
      extraValue: 'deg',
      extraOptions: PROPERTY_EXTRA_UNIT_OPTIONS,
      showNumericParam: false,
      numericParamTitle: 'Parámetro',
      numericParamValueLabel: 'Valor',
      numericParamMode: 'value',
      numericParamValue: '',
      numericParamRef: '',
      numericParamAllowRef: true,
      numericParamUnlockable: false,
      numericParamUnlocked: true,
      bisectorMode: 'normal',
      unit: 'deg',
      viewAxesVisible: true,
      viewAxisWidth: 1.5,
      viewAxisDarkness: 0,
      viewGridVisible: true,
      viewGridWidth: 1,
      viewGridDarkness: 0,
      viewXLabelsVisible: false,
      viewXStep: 1,
      viewYLabelsVisible: false,
      viewYStep: 1,
      viewGlobalFontSize: 14
    };
  }

  function isViewObjectId(id) {
    return String(id || '') === VIEW_OBJECT_ID;
  }

  function getRawNumericParameterState(raw) {
    const type = InternalObjectAdapter.type(raw);
    if (type === 'circle-radius') {
      return {
        title: 'Radio',
        valueLabel: 'Radio',
        valueKey: 'radius',
        refKey: 'radiusRef',
        allowRef: true,
        validate: value => Number.isFinite(value) && value > 1e-9
      };
    }
    if (type === 'angle' && getAngleDefinitionKind(raw) === 'vertex-ray-measure') {
      return {
        title: 'Medida angular',
        valueLabel: raw.unit === 'rad' ? 'Medida (rad)' : 'Medida (grados)',
        valueKey: 'measureValue',
        refKey: 'measureRef',
        allowRef: true,
        validate: value => {
          try {
            validateAngleMeasureValue(value, getAngleUnit(raw), 'angulo');
            return true;
          } catch (error) {
            return false;
          }
        }
      };
    }
    if (type === 'transform') {
      const kind = String(raw.transformKind || '').trim().toLowerCase();
      if (kind === 'rotation') {
        return {
          title: 'Ángulo de rotación',
          valueLabel: raw.unit === 'rad' ? 'Ángulo (rad)' : 'Ángulo (grados)',
          valueKey: 'angle',
          refKey: 'angleRef',
          allowRef: true,
          validate: value => Number.isFinite(value) && value > 1e-9 && value < (raw.unit === 'rad' ? Math.PI * 2 : 360) - 1e-9
        };
      }
      if (kind === 'homothety') {
        return {
          title: 'Constante homotética',
          valueLabel: 'Constante k',
          valueKey: 'factor',
          refKey: 'factorRef',
          allowRef: true,
          validate: value => Number.isFinite(value) && Math.abs(value) > 1e-9
        };
      }
    }
    if (type === 'regular-polygon') {
      return {
        title: 'Número de lados',
        valueLabel: 'Lados',
        valueKey: 'sides',
        refKey: '',
        allowRef: false,
        unlockable: true,
        validate: value => Number.isInteger(value) && value >= 3
      };
    }
    return null;
  }

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

    getNumberValue(id) {
      const resolved = this.getResolvedObject(id);
      if (!resolved || resolved.kind !== 'number') return NaN;
      return safeNumber(resolved.value, NaN);
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

    getComputedProperties(id) {
      const obj = this.getObject(id);
      if (!obj) return null;
      const raw = InternalObjectAdapter.raw(obj);
      const resolved = this.getResolvedObject(id);
      return getComputedPropertiesForObject(raw, resolved);
    }

    inspectObject(id) {
      const obj = this.getObject(id);
      if (!obj) return null;
      const raw = InternalObjectAdapter.raw(obj);
      const resolved = this.getResolvedObject(id);
      return {
        id: obj.id,
        type: InternalObjectAdapter.type(raw),
        label: String(raw.label || ''),
        visible: InternalObjectAdapter.isVisible(raw),
        refs: deepClone(InternalObjectAdapter.refs(raw)),
        derived: getDerivedNamedEntities(raw),
        computed: getComputedPropertiesForObject(raw, resolved),
        resolved: toPublicResolvedSnapshot(resolved)
      };
    }
  }

  function toPublicResolvedSnapshot(resolved) {
    if (!resolved || typeof resolved !== 'object') return resolved;
    const { ref, ...rest } = resolved;
    return deepClone(rest);
  }

  function getDerivedNamedEntities(raw) {
    return getObjectDerivedEntities(raw);
  }

  function getComputedPropertiesForObject(raw, resolved) {
    const computed = getObjectComputedProperties(raw, resolved);
    if (computed) return computed;

    if (resolved?.kind === 'polyline') {
      return {
        length: perimeterOfPointLoop(resolved.points, false),
        vertices: Array.isArray(resolved.points) ? resolved.points.length : 0
      };
    }

    return null;
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

    return null;
  }

  function formatResolvedNumberText(resolved) {
    if (!resolved || resolved.kind !== 'number') return '';
    const value = safeNumber(resolved.value, NaN);
    if (!Number.isFinite(value)) return '';
    if (resolved.unit === 'rad') return `${value.toFixed(3)} rad`;
    if (resolved.unit === 'deg') return `${value.toFixed(1)}°`;
    return formatNumberShort(value);
  }

  function resolveNumber(model, numberObj, viewportOverride = null) {
    const raw = numberObj.raw;
    const kind = String(raw.numberKind || 'independent').trim().toLowerCase() || 'independent';

    if (kind === 'independent') {
      const value = safeNumber(raw.value, NaN);
      if (!Number.isFinite(value)) return null;
      const step = safeNumber(raw.step, 1);
      const { min, max } = getNumberInterval(raw);
      return {
        kind: 'number',
        source: kind,
        value: clampNumberToInterval(value, raw),
        step: step > 0 ? step : 1,
        min,
        max,
        editable: true,
        unit: '',
        text: formatNumberShort(clampNumberToInterval(value, raw))
      };
    }

    if (kind === 'distance') {
      const a = model.getPointPosition(raw.p1);
      const b = model.getPointPosition(raw.p2);
      if (!a || !b) return null;
      const value = dist(a.x, a.y, b.x, b.y);
      return {
        kind: 'number',
        source: kind,
        value,
        editable: false,
        unit: '',
        text: formatNumberShort(value)
      };
    }

    if (kind === 'angle') {
      const a = model.getPointPosition(raw.p1);
      const b = model.getPointPosition(raw.vertex);
      const c = model.getPointPosition(raw.p2);
      if (!a || !b || !c) return null;
      const unit = raw.unit === 'rad' ? 'rad' : 'deg';
      const info = resolveAngleMeasureInfo(a, b, c, unit, viewportOverride || model.viewport, {
        mode: raw.mode
      });
      return {
        kind: 'number',
        source: kind,
        value: safeNumber(info.value, NaN),
        editable: false,
        unit,
        text: info.text,
        mode: info.mode
      };
    }

    if (kind === 'area') {
      const resolved = model.getResolvedObject(raw.objectId);
      const value = resolvedAreaValue(resolved);
      if (!Number.isFinite(value)) return null;
      return {
        kind: 'number',
        source: kind,
        value,
        editable: false,
        unit: '',
        text: formatNumberShort(value)
      };
    }

    return null;
  }

  function resolveAngle(model, angleObj, viewportOverride = null) {
    const raw = angleObj.raw;
    const a = model.getPointPosition(raw.p1);
    const b = model.getPointPosition(raw.vertex);
    const angleKind = getAngleDefinitionKind(raw);
    const measuredValue = angleKind === 'vertex-ray-measure'
      ? resolveMeasuredAngleValue(model, raw)
      : NaN;
    if (angleKind === 'vertex-ray-measure' && !Number.isFinite(measuredValue)) return null;
    const c = angleKind === 'vertex-ray-measure'
      ? resolveMeasuredAngleTerminalPoint(
        b,
        a,
        measuredValue,
        getAngleUnit(raw),
        raw.direction
      )
      : model.getPointPosition(raw.p2);
    if (!a || !b || !c) return null;
    const mode = angleKind === 'vertex-ray-measure'
      ? (isConcaveAngleMeasure(measuredValue, getAngleUnit(raw)) ? 'concave' : 'normal')
      : normalizeAngleMode(raw.mode, 'normal');

    return {
      kind: 'angle',
      angleKind,
      p1: a,
      vertexPoint: b,
      p2: c,
      sectorVisible: isAngleSectorVisible(raw, true),
      arcVisible: isAngleArcVisible(raw),
      armsVisible: isAngleArmsVisible(raw),
      measureVisible: isAngleMeasureVisible(raw, true),
      label: String(raw.label || '').trim(),
      ...resolveAngleMeasureInfo(a, b, c, getAngleUnit(raw), viewportOverride || model.viewport, {
        mode
      })
    };
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
    if (GeoMath.dist2(a.x, a.y, b.x, b.y) < 1e-9) return;

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

  function getClosedShapeFill(resolved, style) {
    if (resolved?.fillVisible === false) return 'none';
    if (style?.fill && style.fill !== 'none') return style.fill;
    if (resolved?.kind === 'circle') return 'rgba(198,40,40,0.14)';
    if (resolved?.kind === 'ellipse') return 'rgba(147,51,234,0.14)';
    if (resolved?.kind === 'circular-sector') return 'rgba(14,165,233,0.16)';
    return 'none';
  }

  function renderResolvedCircle(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;
    const cs = circleScreenRadius(vp, width, height, resolved.center.x, resolved.center.y, resolved.radius);
    const fill = getClosedShapeFill(resolved, style);

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
      fill
    }));
  }

  function getCircularArcScreenPath(resolved, vp, width, height, steps = 64) {
    const points = angleArcWorldPoints(resolved.center, resolved.radius, resolved.startAngle, resolved.delta, steps)
      .map(p => worldToScreen(vp, width, height, p.x, p.y));
    return {
      points,
      path: screenPointsPath(points, false)
    };
  }

  function renderResolvedCircleArc(ctx) {
    const { gShapes, vp, width, height, resolved, isSelected, shapeStroke, style } = ctx;
    const { path } = getCircularArcScreenPath(resolved, vp, width, height, 64);

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
      fill: 'none'
    }));
  }

  function renderResolvedCircularSector(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;
    const centerScreen = worldToScreen(vp, width, height, resolved.center.x, resolved.center.y);
    const startScreen = worldToScreen(vp, width, height, resolved.start.x, resolved.start.y);
    const { points, path: arcPath } = getCircularArcScreenPath(resolved, vp, width, height, 64);
    if (!points.length) return;

    const sectorPath = `M ${centerScreen.x} ${centerScreen.y} L ${startScreen.x} ${startScreen.y} ${arcPath.slice(1)} Z`;
    const fill = getClosedShapeFill(resolved, style);

    if (isSelected) {
      gShapes.appendChild(createSvgEl('path', {
        d: sectorPath,
        ...selectedStrokeAttrs(style),
        fill: 'none'
      }));
    }

    gShapes.appendChild(createSvgEl('path', {
      d: sectorPath,
      stroke: shapeStroke.stroke,
      'stroke-width': shapeStroke.strokeWidth,
      fill
    }));
  }

  function renderResolvedEllipse(ctx) {
    const { gShapes, vp, width, height, resolved, style, isSelected, shapeStroke } = ctx;
    const screenPts = ellipseScreenPoints(vp, width, height, resolved, 96);
    const path = screenPointsPath(screenPts, true);
    const fill = getClosedShapeFill(resolved, style);

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
      fill
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

  function renderResolvedAngle(ctx) {
    const { gMeasures, model, object, vp, width, height, style, isSelected } = ctx;
    if (!(object instanceof AngleObject)) return;

    const info = resolveAngle(model, object, vp);
    if (!info) return;

    const armStroke = style.stroke || '#6b7280';
    const angleFill = style.fill || 'rgba(107,114,128,0.16)';
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
    const arcPoints = angleArcWorldPoints(info.vertex, info.radius, info.startAngle, info.delta, 28)
      .map(p => worldToScreen(vp, width, height, p.x, p.y));
    const arcPath = screenPointsPath(arcPoints, false);
    const sectorPath = `M ${vertexScreen.x} ${vertexScreen.y} L ${armStartScreen.x} ${armStartScreen.y} ${arcPath.slice(1)} Z`;

    if (isSelected) {
      if (info.sectorVisible) {
        gMeasures.appendChild(createSvgEl('path', {
          d: sectorPath,
          fill: 'rgba(124,58,237,0.12)',
          stroke: 'none'
        }));
      }
      gMeasures.appendChild(createSvgEl('path', {
        d: arcPath,
        stroke: '#7c3aed',
        'stroke-width': armWidth + 3,
        opacity: 0.2,
        fill: 'none'
      }));
      if (info.armsVisible) {
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
      }
    }

    if (info.sectorVisible) {
      gMeasures.appendChild(createSvgEl('path', {
        d: sectorPath,
        fill: angleFill,
        stroke: 'none'
      }));
    }

    if (info.armsVisible) {
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
    }

    if (info.arcVisible) {
      gMeasures.appendChild(createSvgEl('path', {
        d: arcPath,
        stroke: armStroke,
        'stroke-width': armWidth,
        fill: 'none'
      }));
    }

    if (!info.measureVisible) return;
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

    const labelOffset = getLabelOffset(object.raw, 8, -8);
    const txt = createSvgEl('text', {
      x: p.x + labelOffset.x,
      y: p.y + labelOffset.y,
      class: 'geo2d-measure-label'
    });
    txt.textContent = info.label ? `${info.label}: ${info.text}` : info.text;
    gMeasures.appendChild(txt);
  }

  function renderResolvedMeasure(ctx) {
    const { gMeasures, model, object, vp, width, height, isSelected } = ctx;
    if (!(object instanceof MeasureObject)) return;

    const info = resolveMeasure(model, object, vp);
    if (!info) return;

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

    const labelOffset = getLabelOffset(object.raw, 8, -8);
    const txt = createSvgEl('text', {
      x: p.x + labelOffset.x,
      y: p.y + labelOffset.y,
      class: 'geo2d-measure-label'
    });
    txt.textContent = object.raw.label ? `${object.raw.label}: ${info.text}` : info.text;
    gMeasures.appendChild(txt);
  }

  function getVisibleNumberLegendIndex(model, objectId) {
    let index = 0;
    for (const obj of model.objects || []) {
      if (InternalObjectAdapter.type(obj) !== 'number' || !obj.isVisible()) continue;
      if (obj.id === objectId) return index;
      index += 1;
    }
    return -1;
  }

  function numberLegendScreenBounds(ctx, content) {
    const { model, style, object } = ctx;
    const index = Math.max(0, getVisibleNumberLegendIndex(model, object.id));
    const fontSize = Math.max(8, safeNumber(style.fontSize, 14));
    const x = 16;
    const y = 24 + index * (fontSize + 18);
    const labelOffset = getLabelOffset(object.raw, 0, 0);
    const anchor = {
      x: x + labelOffset.x,
      y: y + labelOffset.y
    };
    return screenTextBoundsFromAnchor(anchor, content, fontSize, {
      widthFactor: 0.64,
      padX: 6,
      padTop: 5,
      padBottom: 5
    });
  }

  function renderResolvedNumber(ctx) {
    const { gMeasures, object, resolved, style, isSelected } = ctx;
    if (!(object instanceof NumberObject)) return;
    const label = String(object.raw.label || object.id || '').trim();
    const valueText = formatResolvedNumberText(resolved);
    if (!valueText) return;
    const content = label ? `${label} = ${valueText}` : valueText;
    const bounds = numberLegendScreenBounds(ctx, content);

    if (isSelected) {
      gMeasures.appendChild(createSvgEl('rect', {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rx: 8,
        ry: 8,
        fill: 'rgba(124,58,237,0.12)',
        stroke: '#7c3aed',
        'stroke-width': 2
      }));
    }

    const txt = createSvgEl('text', {
      x: bounds.anchor.x,
      y: bounds.anchor.y,
      class: 'geo2d-measure-label',
      fill: style.fill && style.fill !== 'none' ? style.fill : (style.stroke || '#111827')
    });
    txt.textContent = content;
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
    'circle-arc': renderResolvedCircleArc,
    'circular-sector': renderResolvedCircularSector,
    ellipse: renderResolvedEllipse,
    polyline: renderResolvedPolyline,
    polygon: renderResolvedPolygon,
    angle: renderResolvedAngle,
    measure: renderResolvedMeasure,
    number: renderResolvedNumber,
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
    if (state.activeTool === 'ellipse' && state._pendingPoints.length >= 2) {
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
      const radius = GeoMath.dist(first.x, first.y, previewAnchor.x, previewAnchor.y);
      const cs = circleScreenRadius(vp, width, height, first.x, first.y, radius);

      gPreview.appendChild(createSvgEl('circle', {
        cx: cs.cx,
        cy: cs.cy,
        r: cs.r,
        ...previewStrokeAttrs(previewColor),
        fill: 'none'
      }));
    }

    if (state.activeTool === 'regular-polygon') {
      const sides = Math.max(3, Math.floor(safeNumber(state._toolData?.regularPolygonSides, 5)));
      const points = resolveRegularPolygonPoints(first, previewAnchor, sides);
      if (!points) return;

      gPreview.appendChild(createSvgEl('polygon', {
        points: screenPointList(points, vp, width, height),
        ...previewStrokeAttrs(previewColor),
        fill: 'rgba(234,88,12,0.10)'
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

  function renderCircularArcPreview(ctx, first, second) {
    const { state, previewAnchor, previewColor, gPreview, vp, width, height } = ctx;
    if (!previewAnchor || !first) return;

    const centerScreen = worldToScreen(vp, width, height, first.x, first.y);
    const currentScreen = worldToScreen(vp, width, height, previewAnchor.x, previewAnchor.y);

    if (!second) {
      gPreview.appendChild(createSvgEl('line', {
        x1: centerScreen.x,
        y1: centerScreen.y,
        x2: currentScreen.x,
        y2: currentScreen.y,
        ...previewStrokeAttrs(previewColor)
      }));
      return;
    }

    const geometry = resolveCircularArcGeometry(first, second, previewAnchor, 'ccw');
    if (!geometry) return;

    const startScreen = worldToScreen(vp, width, height, geometry.start.x, geometry.start.y);
    const endScreen = worldToScreen(vp, width, height, geometry.endOnCircle.x, geometry.endOnCircle.y);
    const arcPoints = angleArcWorldPoints(geometry.center, geometry.radius, geometry.startAngle, geometry.delta, 48)
      .map(point => worldToScreen(vp, width, height, point.x, point.y));
    const arcPath = screenPointsPath(arcPoints, false);

    if (state.activeTool === 'circular-sector') {
      const sectorPath = `M ${centerScreen.x} ${centerScreen.y} L ${startScreen.x} ${startScreen.y} ${arcPath.slice(1)} Z`;
      gPreview.appendChild(createSvgEl('path', {
        d: sectorPath,
        ...previewStrokeAttrs(previewColor),
        fill: 'rgba(8,145,178,0.12)'
      }));
      return;
    }

    gPreview.appendChild(createSvgEl('line', {
      x1: centerScreen.x,
      y1: centerScreen.y,
      x2: startScreen.x,
      y2: startScreen.y,
      ...previewStrokeAttrs(previewColor)
    }));
    gPreview.appendChild(createSvgEl('line', {
      x1: centerScreen.x,
      y1: centerScreen.y,
      x2: endScreen.x,
      y2: endScreen.y,
      ...previewStrokeAttrs(previewColor)
    }));
    gPreview.appendChild(createSvgEl('path', {
      d: arcPath,
      ...previewStrokeAttrs(previewColor),
      fill: 'none'
    }));
  }

  function renderBisectorRayPreview(ctx, first, second) {
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

      const bisectorRay = resolveBisectorRayPoints(first, second, previewAnchor, 'normal');
      if (bisectorRay) {
        renderRay(gPreview, vp, width, height, bisectorRay.p1, bisectorRay.p2, previewStrokeAttrs(previewColor));
      }
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

    const projectedCoVertex = projectPointToEllipseCoVertexAxis(first, second, previewAnchor);
    const draft = resolveEllipseGeometryFromPoints(first, second, projectedCoVertex);
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
    if (first && ['segment', 'line', 'ray', 'vector', 'circle', 'midpoint', 'measure-distance', 'angle-measure', 'regular-polygon'].includes(state.activeTool)) {
      renderPendingLinePreview(ctx, first);
    }

    if (state.activeTool === 'circle-arc' || state.activeTool === 'circular-sector') {
      renderCircularArcPreview(ctx, first, second);
    }

    if (state.activeTool === 'measure-angle') {
      renderMeasureAnglePreview(ctx, first, second);
    }

    if (state.activeTool === 'bisector-ray') {
      renderBisectorRayPreview(ctx, first, second);
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
    'circle-arc': renderPendingToolPreview,
    'circular-sector': renderPendingToolPreview,
    midpoint: renderPendingToolPreview,
    'measure-distance': renderPendingToolPreview,
    'measure-angle': renderPendingToolPreview,
    'angle-measure': renderPendingToolPreview,
    'bisector-ray': renderPendingToolPreview,
    polyline: renderPendingToolPreview,
    polygon: renderPendingToolPreview,
    'regular-polygon': renderPendingToolPreview,
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
    const labelOffset = getLabelOffset(obj.raw, 10, -10);

    const label = createSvgEl('text', {
      x: screenPoint.x + labelOffset.x,
      y: screenPoint.y + labelOffset.y,
      class: 'geo2d-legendline',
      'font-size': fontSize
    });
    label.textContent = obj.raw.label;
    group.appendChild(label);
  }

  function getPointLayerRank(obj) {
    const raw = InternalObjectAdapter.raw(obj);
    const type = InternalObjectAdapter.type(raw);
    return type === 'point' && !raw.constraint ? 2 : 1;
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
      layerRank: getPointLayerRank(obj),
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
    const strokeWidth = Math.max(0.1, safeNumber(sceneVp.gridStrokeWidth, 1));
    const strokeColor = darkenHexColor('#edf0f4', sceneVp.gridDarkness);

    for (let x = Math.ceil(vp.xMin / sx) * sx; x <= vp.xMax + 1e-9; x += sx) {
      const px = worldToScreen(vp, width, height, x, 0).x;
      group.appendChild(createSvgEl('line', {
        x1: px,
        y1: drawRect.y,
        x2: px,
        y2: drawRect.y + drawRect.height,
        stroke: strokeColor,
        'stroke-width': strokeWidth
      }));
    }

    for (let y = Math.ceil(vp.yMin / sy) * sy; y <= vp.yMax + 1e-9; y += sy) {
      const py = worldToScreen(vp, width, height, 0, y).y;
      group.appendChild(createSvgEl('line', {
        x1: drawRect.x,
        y1: py,
        x2: drawRect.x + drawRect.width,
        y2: py,
        stroke: strokeColor,
        'stroke-width': strokeWidth
      }));
    }
  }

  function renderAxes(group, sceneVp, vp, width, height, drawRect) {
    if (!sceneVp.showAxes) return;

    const strokeWidth = Math.max(0.1, safeNumber(sceneVp.axisStrokeWidth, 1.5));
    const strokeColor = darkenHexColor('#9aa4b2', sceneVp.axisDarkness);
    let axisX = null;
    let axisY = null;

    if (vp.xMin <= 0 && vp.xMax >= 0) {
      axisX = worldToScreen(vp, width, height, 0, 0).x;
      group.appendChild(createSvgEl('line', {
        x1: axisX,
        y1: drawRect.y,
        x2: axisX,
        y2: drawRect.y + drawRect.height,
        stroke: strokeColor,
        'stroke-width': strokeWidth
      }));
    }

    if (vp.yMin <= 0 && vp.yMax >= 0) {
      axisY = worldToScreen(vp, width, height, 0, 0).y;
      group.appendChild(createSvgEl('line', {
        x1: drawRect.x,
        y1: axisY,
        x2: drawRect.x + drawRect.width,
        y2: axisY,
        stroke: strokeColor,
        'stroke-width': strokeWidth
      }));
    }

    const fontAttrs = {
      fill: '#64748b',
      'font-size': 11,
      'font-family': 'system-ui, -apple-system, Segoe UI, sans-serif',
      'pointer-events': 'none'
    };

    if (sceneVp.showXAxisLabels && axisY !== null) {
      const step = Math.max(0.000001, safeNumber(sceneVp.xAxisLabelStep, niceStep(vp.xMax - vp.xMin)));
      const labelY = axisY + 15 <= drawRect.y + drawRect.height - 3 ? axisY + 15 : axisY - 6;
      let count = 0;
      for (let x = Math.ceil(vp.xMin / step) * step; x <= vp.xMax + 1e-9 && count < 200; x += step, count++) {
        if (Math.abs(x) < 1e-10) continue;
        const px = worldToScreen(vp, width, height, x, 0).x;
        const label = createSvgEl('text', {
          ...fontAttrs,
          x: px,
          y: labelY,
          'text-anchor': 'middle'
        });
        label.textContent = formatNumberShort(x);
        group.appendChild(label);
      }
    }

    if (sceneVp.showYAxisLabels && axisX !== null) {
      const step = Math.max(0.000001, safeNumber(sceneVp.yAxisLabelStep, niceStep(vp.yMax - vp.yMin)));
      const labelsOnRight = axisX + 8 <= drawRect.x + drawRect.width - 18;
      const labelX = labelsOnRight ? axisX + 7 : axisX - 7;
      let count = 0;
      for (let y = Math.ceil(vp.yMin / step) * step; y <= vp.yMax + 1e-9 && count < 200; y += step, count++) {
        if (Math.abs(y) < 1e-10) continue;
        const py = worldToScreen(vp, width, height, 0, y).y;
        const label = createSvgEl('text', {
          ...fontAttrs,
          x: labelX,
          y: py + 4,
          'text-anchor': labelsOnRight ? 'start' : 'end'
        });
        label.textContent = formatNumberShort(y);
        group.appendChild(label);
      }
    }
  }

  function getEditorToolGroups() {
    return [
      {
        id: 'general',
        label: 'GENERAL',
        tools: [
          { id: 'move', label: 'Mover zona' },
          { id: 'text', label: 'Texto' },
          { id: 'view', label: 'Vista' },
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
          { id: 'bisector-ray', label: 'Bisectriz' },
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
          { id: 'circle-arc', label: 'Arco' },
          { id: 'circular-sector', label: 'Sector circular' },
          { id: 'ellipse', label: 'Elipse' }
        ]
      },
      {
        id: 'figures',
        label: 'FIGURAS',
        tools: [
          { id: 'polyline', label: 'Poligonal' },
          { id: 'polygon', label: 'Polígono' },
          { id: 'regular-polygon', label: 'Polígono regular' }
        ]
      },
      {
        id: 'transforms',
        label: 'TRANSFORMACIONES',
        tools: [
          { id: 'transform-translation', label: 'Traslación' },
          { id: 'transform-rotation', label: 'Rotación' },
          { id: 'transform-reflection', label: 'Reflexión axial' },
          { id: 'transform-central-symmetry', label: 'Simetría central' },
          { id: 'transform-homothety', label: 'Homotecia' }
        ]
      },
      {
        id: 'measures',
        label: 'MEDIDAS',
        tools: [
          { id: 'number', label: 'Numero' },
          { id: 'measure-distance', label: 'Medir distancia' },
          { id: 'measure-angle', label: 'Ángulo' },
          { id: 'angle-measure', label: 'Ángulo (medida)' }
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

  function getEditorToolLabel(toolId) {
    for (const group of getEditorToolGroups()) {
      const tool = group.tools.find(entry => entry.id === toolId);
      if (tool) return tool.label;
    }
    return String(toolId || '');
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
            <button type="button" class="geo2d-toolbtn" data-tool="${DomUtils.escapeHtml(tool.id)}"><span class="txt-ncl">${DomUtils.escapeHtml(tool.label)}</span></button>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderSceneToSvg(svg, model, state) {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(state._minSvgWidth || 300, rect.width || 800);
    const height = Math.max(state._minSvgHeight || 300, rect.height || 600);
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
    const pointObjects = model.objects
      .filter(obj => obj.isVisible() && obj.isPointLike())
      .sort((a, b) => getPointLayerRank(a) - getPointLayerRank(b));

    for (const obj of pointObjects) {
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
        const d2 = GeoMath.dist2(sx, sy, p.x, p.y);
        const layerRank = safeNumber(p.layerRank, 0);
        const bestLayerRank = safeNumber(best?.layerRank, 0);
        if (
          d2 <= p.r * p.r &&
          (d2 < bestD2 - 1e-9 || (Math.abs(d2 - bestD2) <= 1e-9 && layerRank > bestLayerRank))
        ) {
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
      if (len2 < 1e-9) return GeoMath.dist2(sx, sy, a.x, a.y);
      const t = GeoMath.clamp(((sx - a.x) * dx + (sy - a.y) * dy) / len2, 0, 1);
      return GeoMath.dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2l(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this.width, this.height, p1.x, p1.y);
      const b = worldToScreen(vp, this.width, this.height, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return GeoMath.dist2(sx, sy, a.x, a.y);
      const t = ((sx - a.x) * dx + (sy - a.y) * dy) / len2;
      return GeoMath.dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2r(sx, sy, p1, p2, vp) {
      const a = worldToScreen(vp, this.width, this.height, p1.x, p1.y);
      const b = worldToScreen(vp, this.width, this.height, p2.x, p2.y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return GeoMath.dist2(sx, sy, a.x, a.y);
      const t = Math.max(0, ((sx - a.x) * dx + (sy - a.y) * dy) / len2);
      return GeoMath.dist2(sx, sy, a.x + t * dx, a.y + t * dy);
    }

    p2circleBorderSquared(sx, sy, cx, cy, r) {
      const d = Math.sqrt(GeoMath.dist2(sx, sy, cx, cy));
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

      if (resolved.kind === 'circle-arc' || resolved.kind === 'circular-sector') {
        const screenPts = angleArcWorldPoints(resolved.center, resolved.radius, resolved.startAngle, resolved.delta, 64)
          .map(point => worldToScreen(vp, this.width, this.height, point.x, point.y));
        return {
          d2: p2screenPolylineSquared(sx, sy, screenPts, false),
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

    getPointLabelHit(sx, sy, obj, vp) {
      if (!obj?.isVisible?.() || !obj.isPointLike?.()) return null;
      const label = String(obj.raw?.label || '').trim();
      if (!label) return null;

      const pos = obj.getPosition(this.model);
      if (!pos) return null;

      const style = mergeStyle(this.model, obj.raw, { fill: obj.raw.style?.fill || '#ea580c' });
      const screenPoint = worldToScreen(vp, this.width, this.height, pos.x, pos.y);
      const labelOffset = getLabelOffset(obj.raw, 10, -10);
      const bounds = screenTextBoundsFromAnchor({
        x: screenPoint.x + labelOffset.x,
        y: screenPoint.y + labelOffset.y
      }, label, style.fontSize);
      const d2 = p2rectSquared(sx, sy, bounds);
      if (d2 >= 100) return null;

      return {
        id: obj.id,
        d2,
        partKind: 'label'
      };
    }

    getObjectLabelHit(sx, sy, resolved, obj, vp) {
      if (!obj?.isVisible?.() || !resolved) return null;
      const style = mergeStyle(this.model, obj.raw);
      let bounds = null;

      if (resolved.kind === 'angle') {
        const info = resolveAngle(this.model, obj, vp);
        if (!info?.measureVisible) return null;
        const labelOffset = getLabelOffset(obj.raw, 8, -8);
        const anchor = worldToScreen(vp, this.width, this.height, info.anchor.x, info.anchor.y);
        const content = info.label ? `${info.label}: ${info.text}` : info.text;
        bounds = screenTextBoundsFromAnchor({
          x: anchor.x + labelOffset.x,
          y: anchor.y + labelOffset.y
        }, content, style.fontSize);
      } else if (resolved.kind === 'measure') {
        const info = resolveMeasure(this.model, obj, vp);
        if (!info) return null;
        const labelOffset = getLabelOffset(obj.raw, 8, -8);
        const anchor = worldToScreen(vp, this.width, this.height, info.anchor.x, info.anchor.y);
        const content = obj.raw.label ? `${obj.raw.label}: ${info.text}` : info.text;
        bounds = screenTextBoundsFromAnchor({
          x: anchor.x + labelOffset.x,
          y: anchor.y + labelOffset.y
        }, content, style.fontSize);
      } else if (resolved.kind === 'number') {
        const label = String(obj.raw.label || obj.id || '').trim();
        const valueText = formatResolvedNumberText(resolved);
        if (!valueText) return null;
        const content = label ? `${label} = ${valueText}` : valueText;
        bounds = numberLegendScreenBounds({
          model: this.model,
          style,
          object: obj
        }, content);
      } else {
        return null;
      }

      const d2 = p2rectSquared(sx, sy, bounds);
      if (d2 >= 100) return null;
      return {
        id: obj.id,
        d2,
        partKind: 'label'
      };
    }

    draggableLabelAtScreen(sx, sy) {
      const vp = this.getScreenViewport();
      let best = null;

      for (const obj of this.model.objects) {
        if (!obj?.isVisible?.()) continue;
        let hit = null;
        if (obj.isPointLike?.()) {
          hit = this.getPointLabelHit(sx, sy, obj, vp);
        } else {
          const resolved = this.model.getResolvedObject(obj.id);
          if (!resolved) continue;
          hit = this.getObjectLabelHit(sx, sy, resolved, obj, vp);
        }
        if (!hit) continue;
        if (!best || hit.d2 < best.d2) best = hit;
      }

      return best;
    }

    selectionHitsAtScreen(sx, sy) {
      const hits = [];
      const vp = this.getScreenViewport();

      for (const p of (this.editor._pointHitList || [])) {
        const d2 = GeoMath.dist2(sx, sy, p.x, p.y);
        if (d2 <= p.r * p.r) {
          hits.push({
            id: p.id,
            priority: safeNumber(p.layerRank, 0) >= 2 ? -1 : 0,
            d2
          });
        }
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
        resolved.kind === 'circle-arc' ||
        resolved.kind === 'circular-sector' ||
        resolved.kind === 'ellipse'
      ) {
        d2 = boundaryHit.d2;
      }

      if (resolved.kind === 'polyline') {
        d2 = boundaryHit.d2;
        priority = 3;
      }

      if (resolved.kind === 'circle') {
        const cs = circleScreenRadius(vp, this.width, this.height, resolved.center.x, resolved.center.y, resolved.radius);
        const inside = GeoMath.dist2(sx, sy, cs.cx, cs.cy) <= cs.r * cs.r;
        if (includeInterior && resolved.fillVisible !== false && boundaryHit.d2 >= 100 && inside) {
          return { d2: 0, priority: 4 };
        }
      }

      if (resolved.kind === 'ellipse') {
        const screenPts = ellipseScreenPoints(vp, this.width, this.height, resolved, 96);
        if (includeInterior && resolved.fillVisible !== false && boundaryHit.d2 >= 100 && pointInScreenPolygon(sx, sy, screenPts)) {
          return { d2: 0, priority: 4 };
        }
      }

      if (resolved.kind === 'circular-sector') {
        const centerScreen = worldToScreen(vp, this.width, this.height, resolved.center.x, resolved.center.y);
        const arcPts = angleArcWorldPoints(resolved.center, resolved.radius, resolved.startAngle, resolved.delta, 64)
          .map(point => worldToScreen(vp, this.width, this.height, point.x, point.y));
        if (
          includeInterior &&
          resolved.fillVisible !== false &&
          boundaryHit.d2 >= 100 &&
          pointInScreenPolygon(sx, sy, [centerScreen, ...arcPts])
        ) {
          return { d2: 0, priority: 4 };
        }
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

      if (resolved.kind === 'angle' || resolved.kind === 'measure') {
        const info = resolved.kind === 'angle'
          ? resolveAngle(this.model, obj, vp)
          : resolveMeasure(this.model, obj, vp);
        if (info) {
          d2 = Infinity;
          if (resolved.kind === 'angle' && info.measureVisible) {
            const p = worldToScreen(vp, this.width, this.height, info.anchor.x, info.anchor.y);
            d2 = GeoMath.dist2(sx, sy, p.x, p.y);
          } else if (resolved.kind === 'measure') {
            const p = worldToScreen(vp, this.width, this.height, info.anchor.x, info.anchor.y);
            d2 = GeoMath.dist2(sx, sy, p.x, p.y);
          }
          if (resolved.kind === 'angle') {
            const armStart = {
              x: info.vertex.x + Math.cos(info.startAngle) * info.radius,
              y: info.vertex.y + Math.sin(info.startAngle) * info.radius
            };
            const armEnd = {
              x: info.vertex.x + Math.cos(info.startAngle + info.delta) * info.radius,
              y: info.vertex.y + Math.sin(info.startAngle + info.delta) * info.radius
            };
            const arcPts = angleArcWorldPoints(info.vertex, info.radius, info.startAngle, info.delta, 28)
              .map(point => worldToScreen(vp, this.width, this.height, point.x, point.y));
            if (info.armsVisible) {
              d2 = Math.min(
                d2,
                this.p2s(sx, sy, info.vertex, armStart, vp),
                this.p2s(sx, sy, info.vertex, armEnd, vp)
              );
            }
            if (info.arcVisible) {
              d2 = Math.min(d2, p2screenPolylineSquared(sx, sy, arcPts, false));
            }
            if (info.sectorVisible) {
              const vertexScreen = worldToScreen(vp, this.width, this.height, info.vertex.x, info.vertex.y);
              if (pointInScreenPolygon(sx, sy, [vertexScreen, ...arcPts])) {
                d2 = 0;
              }
            }
          }
          priority = 1;
        }
      }

      if (resolved.kind === 'text') {
        const style = mergeStyle(this.model, obj.raw);
        d2 = p2rectSquared(sx, sy, textScreenBounds(vp, this.width, this.height, resolved, style.fontSize));
        priority = 1;
      }

      if (resolved.kind === 'number') {
        const style = mergeStyle(this.model, obj.raw);
        const label = String(obj.raw.label || obj.id || '').trim();
        const valueText = formatResolvedNumberText(resolved);
        const content = label ? `${label} = ${valueText}` : valueText;
        d2 = p2rectSquared(sx, sy, numberLegendScreenBounds({
          model: this.model,
          style,
          object: obj
        }, content));
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
          t: GeoMath.projectParameter(p1.x, p1.y, p2.x, p2.y, world.x, world.y, true)
        };
      }

      if (isSegmentChainResolvedKind(resolved.kind)) {
        if (!hit.p1 || !hit.p2 || hit.edgeIndex === null || hit.edgeIndex === undefined) return null;
        return {
          kind: 'on-segment',
          objectId: obj.id,
          edgeIndex: hit.edgeIndex,
          t: GeoMath.projectParameter(hit.p1.x, hit.p1.y, hit.p2.x, hit.p2.y, world.x, world.y, true)
        };
      }

      if (resolved.kind === 'line') {
        const p1 = hit.p1 || resolved.p1;
        const p2 = hit.p2 || resolved.p2;
        if (!p1 || !p2) return null;
        return {
          kind: 'on-line',
          objectId: obj.id,
          t: GeoMath.projectParameter(p1.x, p1.y, p2.x, p2.y, world.x, world.y, false)
        };
      }

      if (resolved.kind === 'ray') {
        const p1 = hit.p1 || resolved.p1;
        const p2 = hit.p2 || resolved.p2;
        if (!p1 || !p2) return null;
        return {
          kind: 'on-ray',
          objectId: obj.id,
          t: Math.max(0, GeoMath.projectParameter(p1.x, p1.y, p2.x, p2.y, world.x, world.y, false))
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

    nearestTransformableObjectAtScreen(sx, sy) {
      const nearPoint = this.nearestPointAtScreen(sx, sy);
      if (nearPoint) {
        const pointObj = this.model.getObject(nearPoint.id);
        if (pointObj && isTransformableRawType(InternalObjectAdapter.type(pointObj))) {
          return pointObj;
        }
      }

      const vp = this.getScreenViewport();
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || obj.isPointLike()) continue;
        if (!isTransformableRawType(InternalObjectAdapter.type(obj))) continue;
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

      if (String(editor.activeTool || '').startsWith('transform-')) {
        if (!editor._toolData?.transformSourceId) return this.nearestTransformableObjectAtScreen(sx, sy);
        if (editor.activeTool === 'transform-translation') return this.nearestVectorAtScreen(sx, sy);
        if (editor.activeTool === 'transform-reflection') return this.nearestDirectionalObjectAtScreen(sx, sy);
      }

      return this.nearestNonPointObjectAtScreen(sx, sy);
    }
  }

  const OBJECT_LIST_GROUPS = Object.freeze([
    { id: 'points', label: 'PUNTOS' },
    { id: 'lines', label: 'RECTAS' },
    { id: 'segments', label: 'SEGMENTOS Y VECTORES' },
    { id: 'curves', label: 'CURVAS' },
    { id: 'figures', label: 'FIGURAS' },
    { id: 'transforms', label: 'TRANSFORMACIONES' },
    { id: 'numbers', label: 'NÚMEROS' },
    { id: 'measures', label: 'MEDIDAS' },
    { id: 'texts', label: 'TEXTOS' },
    { id: 'others', label: 'OTROS' }
  ]);

  function getObjectListGroup(value) {
    const type = InternalObjectAdapter.type(value);
    const groupId = INTERNAL_OBJECT_REGISTRY[type]?.group || 'others';
    return OBJECT_LIST_GROUPS.find(group => group.id === groupId) || OBJECT_LIST_GROUPS[OBJECT_LIST_GROUPS.length - 1];
  }

  /* =========================================================
     SISTEMA DE HERRAMIENTAS (STRATEGY PATTERN)
     ========================================================= */
  class Geo2DTool {
    constructor(editor) {
      this.editor = editor;
    }
    get model() { return this.editor.model; }
    onClick(world, sx, sy) {}
    reset() {}
  }

  class PointTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      editor.resetConstructionState();
      editor.selectObject(picked.id, false);
      editor.renderAndSync();
      editor.setStatus(picked.created ? 'Punto creado.' : 'Punto seleccionado.');
    }
  }

  class NumberTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const id = editor.nextId('n');
      this.model.addObject({
        id,
        type: 'number',
        numberKind: 'independent',
        value: 1,
        step: 1,
        label: id,
        visible: true
      });

      editor.resetConstructionState();
      editor.selectObject(id, false);
      editor.renderAndSync();
      editor.setStatus('Numero creado.');
    }
  }

  class TextTool extends Geo2DTool {
    onClick(world, sx, sy) {
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
  }

  class TwoPointTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      const id = picked?.id;
      if (!id) return;

      editor._hoverObjectId = null;
      editor._hoverObjectEdgeIndex = null;
      editor._pendingPoints.push(id);
      editor._hoverPointId = id;
      editor._previewWorld = { x: world.x, y: world.y };
      editor._toolData = null;

      if (editor._pendingPoints.length === 1) {
        editor.renderAndSync();
        editor.setStatus(this.getPrompt());
        return;
      }

      if (editor._pendingPoints.length === 2) {
        const [a, b] = editor._pendingPoints;
        const newId = this.addTwoPointObject(a, b);
        editor.resetConstructionState();
        if (newId) editor.selectObject(newId, false);
        editor.renderAndSync();
        editor.setStatus('Objeto creado.');
      }
    }

    getPrompt() {
      if (this.editor.activeTool === 'ray') return 'Semirrecta: selecciona un punto de dirección.';
      if (this.editor.activeTool === 'vector') return 'Vector libre: selecciona el punto final.';
      return 'Selecciona el segundo punto.';
    }

    addTwoPointObject(a, b) {
      const spec = TWO_POINT_CONSTRUCTION_SPECS[this.editor.activeTool];
      if (!spec) return false;

      const id = this.editor.nextId(spec.idPrefix);
      this.model.addObject({
        id,
        ...spec.build(a, b)
      });
      return id;
    }
  }

  class DerivedLineTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const isParallel = editor.activeTool === 'parallel-line';

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

      const lineId = editor.nextId(isParallel ? 'par' : 'per');
      this.model.addObject({
        id: lineId,
        type: editor.activeTool,
        point: picked.id,
        objectId: editor._toolData.referenceObjectId,
        ...(editor._toolData.referenceEdgeIndex !== null ? { edgeIndex: editor._toolData.referenceEdgeIndex } : {}),
        style: { stroke: isParallel ? '#0284c7' : '#b45309' }
      });

      editor.resetConstructionState();
      editor.selectObject(lineId, false);
      editor.renderAndSync();
      editor.setStatus(isParallel ? 'Recta paralela creada.' : 'Recta perpendicular creada.');
    }
  }

  class CircleRadiusTool extends Geo2DTool {
    async onClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      const radiusConfig = await editor.openNumberParameterDialog({
        title: 'Circunferencia (C,r)',
        valueLabel: 'Radio',
        variableLabel: 'Variable radio',
        defaultValue: '5',
        validateValue: value => Number.isFinite(value) && value > 1e-9,
        errorMessage: 'Indica un radio positivo.'
      });
      if (!radiusConfig) {
        if (picked.created) this.model.removeIds(new Set([picked.id]));
        editor.resetConstructionState();
        editor.renderAndSync();
        editor.setStatus('Circunferencia (C,r) cancelada.');
        return;
      }

      const circleObjectByRadius = {
        id: editor.nextId('cr'),
        type: 'circle-radius',
        center: picked.id,
        style: { stroke: '#dc2626' }
      };
      if (radiusConfig.mode === 'ref') {
        circleObjectByRadius.radiusRef = radiusConfig.refId;
      } else {
        circleObjectByRadius.radius = radiusConfig.value;
      }

      this.model.addObject(circleObjectByRadius);

      editor.resetConstructionState();
      editor.selectObject(circleObjectByRadius.id, false);
      editor.renderAndSync();
      editor.setStatus('Circunferencia (C,r) creada.');
    }
  }

  class CircularArcTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      editor._hoverObjectId = null;
      editor._hoverObjectEdgeIndex = null;
      editor._pendingPoints.push(picked.id);
      editor._hoverPointId = picked.id;
      editor._previewWorld = { x: world.x, y: world.y };
      editor._toolData = null;

      const isSector = editor.activeTool === 'circular-sector';
      const label = isSector ? 'Sector circular' : 'Arco';

      if (editor._pendingPoints.length === 1) {
        editor.renderAndSync();
        editor.setStatus(`${label}: selecciona el punto inicial.`);
        return;
      }

      if (editor._pendingPoints.length === 2) {
        editor.renderAndSync();
        editor.setStatus(`${label}: selecciona el punto final.`);
        return;
      }

      if (editor._pendingPoints.length === 3) {
        const [center, start, end] = editor._pendingPoints;
        const objectId = editor.nextId(isSector ? 'sec' : 'arc');
        this.model.addObject({
          id: objectId,
          type: isSector ? 'circular-sector' : 'circle-arc',
          center,
          start,
          end,
          direction: 'ccw',
          ...(isSector ? { parts: { fill: { visible: true } } } : {}),
          style: isSector
            ? { stroke: '#0891b2', fill: 'rgba(8,145,178,0.18)' }
            : { stroke: '#0ea5e9' }
        });

        editor.resetConstructionState();
        editor.selectObject(objectId, false);
        editor.renderAndSync();
        editor.setStatus(`${label} creado.`);
      }
    }
  }

  class EllipseTool extends Geo2DTool {
    onClick(world, sx, sy) {
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
      const projectedCoVertex = projectPointToEllipseCoVertexAxis(center, vertex, snapped);
      const draft = resolveEllipseGeometryFromPoints(center, vertex, projectedCoVertex);
      if (!draft) {
        editor.setStatus('El covértice debe estar separado del eje centro-vértice.', true);
        return;
      }

      const nearPoint = editor.findNearestPointAtScreen(sx, sy);
      let coVertexId = nearPoint?.id || null;
      if (coVertexId) {
        const nearPosition = this.model.getPointPosition(coVertexId);
        const alreadyOnAxis = nearPosition && GeoMath.dist(nearPosition.x, nearPosition.y, projectedCoVertex.x, projectedCoVertex.y) <= 1e-7;
        if (!alreadyOnAxis && !editor.moveFreePointRaw(coVertexId, projectedCoVertex)) {
          coVertexId = null;
        }
      }
      if (!coVertexId) {
        coVertexId = editor.addFreePoint(projectedCoVertex.x, projectedCoVertex.y, false);
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
  }

  class RegularPolygonTool extends Geo2DTool {
    async promptRegularPolygonSides() {
      const result = await this.editor.openNumberParameterDialog({
        title: 'Poligono regular',
        valueLabel: 'Numero de lados',
        variableLabel: 'Variable lados',
        defaultValue: '5',
        validateValue: value => Number.isInteger(value) && value >= 3,
        errorMessage: 'Indica un numero entero de lados mayor o igual a 3.'
      });
      if (!result) return null;
      const value = result.mode === 'ref'
        ? this.model.getNumberValue(result.refId)
        : result.value;
      const sides = Math.floor(safeNumber(value, NaN));
      return sides >= 3 ? sides : null;
    }

    async onClick(world, sx, sy) {
      const editor = this.editor;

      if (editor._pendingPoints.length === 0) {
        const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
        if (!picked?.id) return;
        const sides = await this.promptRegularPolygonSides();
        if (sides === null) {
          if (picked.created) {
            this.model.removeIds(new Set([picked.id]));
          }
          editor.resetConstructionState();
          editor.renderAndSync();
          editor.setStatus('Polígono regular cancelado.');
          return;
        }
        editor._pendingPoints = [picked.id];
        editor._hoverPointId = picked.id;
        editor._previewWorld = null;
        editor._toolData = { regularPolygonSides: sides };
        editor.renderAndSync();
        editor.setStatus('Polígono regular: marca un vértice.');
        return;
      }

      const centerId = editor._pendingPoints[0];
      const center = this.model.getPointPosition(centerId);
      if (!center) {
        editor.resetConstructionState();
        editor.renderAndSync();
        editor.setStatus('No se pudo resolver el centro del polígono regular.', true);
        return;
      }

      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      const vertex = this.model.getPointPosition(picked.id);
      if (!vertex || GeoMath.dist(center.x, center.y, vertex.x, vertex.y) <= 1e-9) {
        editor.setStatus('El vértice debe ser distinto del centro.', true);
        return;
      }

      const sides = Math.max(3, Math.floor(safeNumber(editor._toolData?.regularPolygonSides, 5)));

      const polygonId = editor.nextId('rpoly');
      const pointIds = [picked.id];
      this.model.addObject({
        id: polygonId,
        type: 'regular-polygon',
        center: centerId,
        vertex: picked.id,
        sides,
        points: [],
        style: { stroke: '#ea580c', fill: 'rgba(234,88,12,0.18)' }
      });

      for (let index = 1; index < sides; index++) {
        pointIds.push(editor.addRegularPolygonDerivedPoint(polygonId, index, null, false));
      }

      const polygon = this.model.getObject(polygonId);
      if (polygon) polygon.raw.points = pointIds;

      editor.resetConstructionState();
      editor.selectObject(polygonId, false);
      editor.renderAndSync();
      editor.setStatus('Polígono regular creado.');
    }
  }

  class TransformTool extends Geo2DTool {
    getTransformKind() {
      if (this.editor.activeTool === 'transform-translation') return 'translation';
      if (this.editor.activeTool === 'transform-rotation') return 'rotation';
      if (this.editor.activeTool === 'transform-reflection') return 'reflection';
      if (this.editor.activeTool === 'transform-central-symmetry') return 'central-symmetry';
      if (this.editor.activeTool === 'transform-homothety') return 'homothety';
      return '';
    }

    getSourcePrompt() {
      return 'Transformacion: selecciona el objeto original.';
    }

    getParameterPrompt() {
      const kind = this.getTransformKind();
      if (kind === 'translation') return 'Traslacion: selecciona el vector.';
      if (kind === 'rotation') return 'Rotacion: selecciona el centro.';
      if (kind === 'reflection') return 'Reflexion axial: selecciona el eje.';
      if (kind === 'central-symmetry') return 'Simetria central: selecciona el centro.';
      if (kind === 'homothety') return 'Homotecia: selecciona el centro.';
      return 'Selecciona la referencia de transformacion.';
    }

    async promptRotationAngle() {
      const result = await this.editor.openNumberParameterDialog({
        title: 'Rotacion',
        valueLabel: 'Angulo en grados',
        variableLabel: 'Variable angulo',
        defaultValue: '90',
        validateValue: value => Number.isFinite(value) && value > 1e-9 && value < 360 - 1e-9,
        errorMessage: 'Indica un angulo valido entre 0 y 360 grados.'
      });
      if (!result) return null;
      return result.mode === 'ref'
        ? { angleRef: result.refId }
        : { angle: result.value };
    }

    async promptHomothetyFactor() {
      const result = await this.editor.openNumberParameterDialog({
        title: 'Homotecia',
        valueLabel: 'Constante homotetica k',
        variableLabel: 'Variable k',
        defaultValue: '2',
        validateValue: value => Number.isFinite(value) && Math.abs(value) > 1e-9,
        errorMessage: 'Indica una constante homotetica distinta de 0.'
      });
      if (!result) return null;
      return result.mode === 'ref'
        ? { factorRef: result.refId }
        : { factor: result.value };
    }

    createImage(transformRaw) {
      const editor = this.editor;
      const sourceId = editor._toolData?.transformSourceId;
      if (!sourceId) return;

      const transformId = editor.nextId('t');
      this.model.addObject({
        id: transformId,
        type: 'transform',
        visible: false,
        ...transformRaw
      });
      const imageId = editor.addImageOfObject(sourceId, transformId, false);

      editor.resetConstructionState();
      if (imageId) editor.selectObject(imageId, false);
      editor.renderAndSync();
      editor.setStatus('Imagen transformada creada.');
    }

    async onClick(world, sx, sy) {
      const editor = this.editor;
      const kind = this.getTransformKind();
      if (!kind) return;

      if (!editor._toolData?.transformSourceId) {
        const source = editor.findNearestTransformableObjectAtScreen(sx, sy);
        if (!source) {
          editor.setStatus(this.getSourcePrompt(), true);
          return;
        }
        editor._toolData = { transformSourceId: source.id };
        editor._hoverPointId = source.isPointLike?.() ? source.id : null;
        editor._hoverObjectId = source.isPointLike?.() ? null : source.id;
        editor._hoverObjectEdgeIndex = null;
        editor.render();
        editor.setStatus(this.getParameterPrompt());
        return;
      }

      if (kind === 'translation') {
        const vector = editor.findNearestVectorAtScreen(sx, sy);
        if (!vector) {
          editor.setStatus('Traslacion: selecciona un vector.', true);
          return;
        }
        this.createImage({
          transformKind: 'translation',
          vectorId: vector.id
        });
        return;
      }

      if (kind === 'reflection') {
        const axis = editor.findNearestDirectionalObjectAtScreen(sx, sy);
        if (!axis) {
          editor.setStatus('Reflexion axial: selecciona una recta, segmento o semirrecta.', true);
          return;
        }
        this.createImage({
          transformKind: 'reflection',
          axis: axis.id
        });
        return;
      }

      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      if (kind === 'central-symmetry') {
        this.createImage({
          transformKind: 'central-symmetry',
          center: picked.id
        });
        return;
      }

      if (kind === 'homothety') {
        const factorConfig = await this.promptHomothetyFactor();
        if (!factorConfig) {
          if (picked.created) this.model.removeIds(new Set([picked.id]));
          editor.resetConstructionState();
          editor.renderAndSync();
          editor.setStatus('Homotecia cancelada.');
          return;
        }
        this.createImage({
          transformKind: 'homothety',
          center: picked.id,
          ...factorConfig
        });
        return;
      }

      if (kind === 'rotation') {
        const angleConfig = await this.promptRotationAngle();
        if (!angleConfig) {
          if (picked.created) this.model.removeIds(new Set([picked.id]));
          editor.resetConstructionState();
          editor.renderAndSync();
          editor.setStatus('Rotacion cancelada.');
          return;
        }
        this.createImage({
          transformKind: 'rotation',
          center: picked.id,
          ...angleConfig,
          unit: 'deg',
          direction: 'ccw'
        });
      }
    }
  }

  class IntersectionTool extends Geo2DTool {
    onClick(world, sx, sy) {
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
  }

  class EquipollentVectorTool extends Geo2DTool {
    onClick(world, sx, sy) {
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
  }

  class FigureTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      const id = picked?.id;
      if (!id) return;

      editor._hoverObjectId = null;
      editor._hoverObjectEdgeIndex = null;

      const firstId = editor._pendingPoints[0];
      const lastId = editor._pendingPoints[editor._pendingPoints.length - 1];
      const minPoints = editor.activeTool === 'polyline' ? 2 : 3;

      if (editor._pendingPoints.length >= minPoints && id === firstId) {
        const points = [...editor._pendingPoints];
        const spec = FIGURE_CONSTRUCTION_SPECS[editor.activeTool];
        if (!spec) return;

        const polyId = editor.nextId(spec.idPrefix);
        this.model.addObject({
          id: polyId,
          type: spec.type,
          points,
          style: deepClone(spec.style)
        });

        const label = editor.activeTool === 'polyline' ? 'Poligonal' : 'Polígono';
        editor.resetConstructionState();
        editor.selectObject(polyId, false);
        editor.renderAndSync();
        editor.setStatus(editor.activeTool === 'polygon' ? 'Polígono creado.' : `${label} creada.`);
        return;
      }

      if (lastId !== id) editor._pendingPoints.push(id);

      editor._hoverPointId = id;
      editor._previewWorld = { x: world.x, y: world.y };
      editor._toolData = null;
      editor.renderAndSync();
      
      const toolLabel = editor.activeTool === 'polyline' ? 'Poligonal' : 'Polígono';
      editor.setStatus(
        editor.activeTool === 'polyline'
          ? `Poligonal: ${editor._pendingPoints.length} punto(s). Haz clic en el punto inicial para terminar.`
          : `${toolLabel}: ${editor._pendingPoints.length} punto(s). Haz clic en el punto inicial para cerrar.`
      );
    }
  }

  class AngleTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      editor._hoverObjectId = null;
      editor._hoverObjectEdgeIndex = null;
      editor._pendingPoints.push(picked.id);
      editor._hoverPointId = picked.id;
      editor._previewWorld = { x: world.x, y: world.y };
      editor._toolData = null;

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
        const greekLabel = nextAvailableGreekAngleLabel(this.model);
        const angleId = editor.nextId('ang');
        this.model.addObject({
          id: angleId,
          type: 'angle',
          p1: a,
          vertex: b,
          p2: c,
          mode: 'normal',
          measure: { unit: 'deg', visible: true },
          parts: { arc: { visible: true }, arms: { visible: false }, fill: { visible: true } },
          ...(greekLabel ? { label: greekLabel } : {}),
          style: { stroke: '#6b7280' }
        });

        editor.resetConstructionState();
        editor.selectObject(angleId, false);
        editor.renderAndSync();
        editor.setStatus('Ángulo creado.');
      }
    }
  }

  class AngleByMeasureTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      editor._hoverObjectId = null;
      editor._hoverObjectEdgeIndex = null;
      editor._pendingPoints.push(picked.id);
      editor._hoverPointId = picked.id;
      editor._previewWorld = { x: world.x, y: world.y };
      editor._toolData = null;

      if (editor._pendingPoints.length === 1) {
        editor.renderAndSync();
        editor.setStatus('Ángulo (medida): selecciona un punto del primer rayo.');
        return;
      }

      if (editor._pendingPoints.length === 2) {
        const [vertexId, p1Id] = editor._pendingPoints;
        if (vertexId === p1Id) {
          editor._pendingPoints.pop();
          editor.renderAndSync();
          editor.setStatus('Ángulo (medida): el punto del rayo debe ser distinto del vértice.', true);
          return;
        }

        let previousValue = '60';
        while (true) {
          const rawMeasure = prompt('Medida angular o id de numero (ccw):', previousValue);
          if (rawMeasure === null) {
            editor.resetConstructionState();
            editor.renderAndSync();
            editor.setStatus('Ángulo (medida) cancelado.');
            return;
          }

          const measureToken = String(rawMeasure || '').trim();
          if (!measureToken) {
            editor.setStatus('Debes indicar una medida angular o el id de un numero.', true);
            continue;
          }

          previousValue = measureToken;
          let angleDef;
          const existingObject = this.model.getObject(measureToken);
          if (existingObject) {
            if (InternalObjectAdapter.type(existingObject) !== 'number') {
              editor.setStatus(`"${measureToken}" existe, pero no es un numero.`, true);
              continue;
            }
            angleDef = { measureRef: measureToken };
          } else {
            const numericValue = safeNumber(measureToken.replace(',', '.'), NaN);
            try {
              angleDef = { measureValue: validateAngleMeasureValue(numericValue, 'deg', 'angulo') };
            } catch (error) {
              editor.setStatus(`No existe un numero con id "${measureToken}" y tampoco es una medida angular valida.`, true);
              continue;
            }
          }

          const angleId = editor.nextId('ang');
          const greekLabel = nextAvailableGreekAngleLabel(this.model);
          const terminalPointId = editor.generateAuxiliaryPointName('P', new Set([angleId]));
          this.model.addObject({
            id: angleId,
            type: 'angle',
            angleKind: 'vertex-ray-measure',
            p1: p1Id,
            vertex: vertexId,
            ...angleDef,
            unit: 'deg',
            direction: 'ccw',
            derivedPoints: { p2: terminalPointId },
            measure: { visible: true, unit: 'deg' },
            parts: { arc: { visible: true }, arms: { visible: false }, fill: { visible: true } },
            ...(greekLabel ? { label: greekLabel } : {}),
            style: { stroke: '#6b7280' }
          });
          editor.addAngleTerminalPoint(angleId, terminalPointId, false, { visible: true });

          editor.resetConstructionState();
          editor.selectObject(angleId, false);
          editor.renderAndSync();
          editor.setStatus('Ángulo creado.');
          return;
        }
      }
    }
  }

  class BisectorTool extends Geo2DTool {
    onClick(world, sx, sy) {
      const editor = this.editor;
      const picked = editor.pickOrCreateAnchorPoint(world, sx, sy);
      if (!picked?.id) return;

      editor._hoverObjectId = null;
      editor._hoverObjectEdgeIndex = null;
      editor._pendingPoints.push(picked.id);
      editor._hoverPointId = picked.id;
      editor._previewWorld = { x: world.x, y: world.y };
      editor._toolData = null;

      if (editor._pendingPoints.length === 1) {
        editor.renderAndSync();
        editor.setStatus('Bisectriz: selecciona el vértice.');
        return;
      }

      if (editor._pendingPoints.length === 2) {
        const [a, b] = editor._pendingPoints;
        if (a === b) {
          editor._pendingPoints.pop();
          editor.renderAndSync();
          editor.setStatus('Bisectriz: el vértice debe ser distinto del primer punto.', true);
          return;
        }
        editor.renderAndSync();
        editor.setStatus('Bisectriz: selecciona el tercer punto.');
        return;
      }

      if (editor._pendingPoints.length === 3) {
        const [a, b, c] = editor._pendingPoints;
        if (b === c) {
          editor._pendingPoints.pop();
          editor.renderAndSync();
          editor.setStatus('Bisectriz: el tercer punto debe ser distinto del vértice.', true);
          return;
        }

        const first = this.model.getPointPosition(a);
        const vertex = this.model.getPointPosition(b);
        const third = this.model.getPointPosition(c);
        if (!resolveBisectorRayPoints(first, vertex, third)) {
          editor._pendingPoints.pop();
          editor.renderAndSync();
          editor.setStatus('No se pudo construir la bisectriz del ángulo normal con esos puntos.', true);
          return;
        }

        const bisectorId = editor.nextId('bis');
        const bisectorPointId = editor.generateAuxiliaryPointName('P', new Set([bisectorId]));
        const defaultT = resolveBisectorDerivedPointDistance(first, vertex, third);

        this.model.addObject({
          id: bisectorId,
          type: 'bisector-ray',
          p1: a,
          vertex: b,
          p2: c,
          mode: 'normal',
          derivedPoints: { point: bisectorPointId },
          style: { stroke: '#0891b2' }
        });
        editor.addBisectorDerivedPoint(bisectorId, defaultT, bisectorPointId, false, { visible: true });

        editor.resetConstructionState();
        editor.selectObject(bisectorId, false);
        editor.renderAndSync();
        editor.setStatus('Bisectriz creada.');
      }
    }
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
      this.tools = {
        point: new PointTool(editor),
        number: new NumberTool(editor),
        text: new TextTool(editor),
        segment: new TwoPointTool(editor),
        line: new TwoPointTool(editor),
        ray: new TwoPointTool(editor),
        vector: new TwoPointTool(editor),
        circle: new TwoPointTool(editor),
        midpoint: new TwoPointTool(editor),
        'measure-distance': new TwoPointTool(editor),
        'parallel-line': new DerivedLineTool(editor),
        'perpendicular-line': new DerivedLineTool(editor),
        'circle-radius': new CircleRadiusTool(editor),
        'circle-arc': new CircularArcTool(editor),
        'circular-sector': new CircularArcTool(editor),
        ellipse: new EllipseTool(editor),
        'regular-polygon': new RegularPolygonTool(editor),
        'transform-translation': new TransformTool(editor),
        'transform-rotation': new TransformTool(editor),
        'transform-reflection': new TransformTool(editor),
        'transform-central-symmetry': new TransformTool(editor),
        'transform-homothety': new TransformTool(editor),
        intersect: new IntersectionTool(editor),
        'vector-equipollent': new EquipollentVectorTool(editor),
        polyline: new FigureTool(editor),
        polygon: new FigureTool(editor),
        'measure-angle': new AngleTool(editor),
        'angle-measure': new AngleByMeasureTool(editor),
        'bisector-ray': new BisectorTool(editor)
      };
    }

    get model() {
      return this.editor.model;
    }

    get activeTool() {
      return this.editor.activeTool;
    }

    dispatchClick(world, sx, sy) {
      const toolInstance = this.tools[this.activeTool];
      if (toolInstance) {
        return toolInstance.onClick(world, sx, sy);
      }
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
      DomUtils.downloadTextFile(`${DomUtils.slugify(editor.model.meta.title)}.geo2d.json`, jsonPretty(editor.model.serializeConstruction()));
      editor.setStatus('Guardado.');
    },
    copyjson: editor => {
      DomUtils.copyTextToClipboard(jsonPretty(editor.model.serializeConstruction())).then(() => editor.setStatus('Copiado.'));
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
      DomUtils.copyTextToClipboard(editor.publishArea?.value || '').then(() => editor.setStatus('HTML locked copiado.'));
    },
    'copy-published-interactive': editor => {
      if (editor.publishArea) editor.publishArea.value = editor._publishedHtml.explore || editor.publishScene('explore');
      DomUtils.copyTextToClipboard(editor.publishArea?.value || '').then(() => editor.setStatus('HTML interactive copiado.'));
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
        ? normalizeViewerMode(options.viewerMode || this.targetEl.getAttribute?.('data-viewer-mode') || this.targetEl.getAttribute?.('data-geo2d-mode') || this.targetEl.getAttribute?.('data-mode'))
        : 'editor';
      this.viewerPrintCompact = this.mode === 'viewer' && (
        options.printCompact === true ||
        options.compact === true ||
        classListContains(this.targetEl, 'geo2d-print-compact') ||
        this.targetEl.hasAttribute?.('data-print-compact') ||
        this.targetEl.hasAttribute?.('data-print-height')
      );
      this.viewerHeight = this.mode === 'viewer'
        ? parsePositiveNumber(
            options.printHeight ?? options.viewerHeight ?? options.height,
            attrPositiveNumber(this.targetEl, ['data-print-height', 'data-viewer-height', 'data-height'], null)
          )
        : null;
      this.viewerAspectRatio = this.mode === 'viewer'
        ? parseAspectRatio(
            options.printAspectRatio ?? options.viewerAspectRatio ?? options.aspectRatio,
            attrAspectRatio(this.targetEl, ['data-print-aspect-ratio', 'data-viewer-aspect-ratio', 'data-aspect-ratio'], null)
          )
        : null;
      if (this.mode === 'viewer' && this.viewerPrintCompact && !this.viewerHeight && !this.viewerAspectRatio) {
        this.viewerHeight = 180;
      }
      this._minSvgWidth = this.mode === 'viewer' && this.viewerPrintCompact ? 120 : 300;
      this._minSvgHeight = this.mode === 'viewer' && this.viewerPrintCompact ? 80 : 300;
      this.model = new SceneModel(loadSceneFromOptions(options));
      this.hitTester = new Geo2DHitTester(this);
      this.construction = new Geo2DConstructionControllerV2(this);

      this.activeTab = 'visual';
      this.activeTool = 'move';
      this.openToolGroup = getToolGroupForTool(this.activeTool);
      this._dragInfo = null;
      this._labelDragInfo = null;
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
      this._lastScrolledSelectionKey = null;
      this._unlockedParameterObjectId = null;
      this._resizeObserver = null;
      this._resizeFrame = null;
      this._cancelResizeFrame = null;
      this._viewportHistoryTimer = null;
      this._keyboardHandler = null;
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
      if (this._keyboardHandler) {
        document.removeEventListener('keydown', this._keyboardHandler);
        this._keyboardHandler = null;
      }
      if (this.shadow) this.shadow.innerHTML = '';
      if (this.targetEl?.__geo2dInstance === this) this.targetEl.__geo2dInstance = null;
    }

    targetRequestsLockedViewer() {
      const attrMode = this.targetEl?.getAttribute?.('data-viewer-mode') ||
        this.targetEl?.getAttribute?.('data-geo2d-mode') ||
        this.targetEl?.getAttribute?.('data-mode');
      return normalizeViewerMode(attrMode) === 'locked';
    }

    isViewerLocked() {
      return this.mode === 'viewer' && (this.viewerMode === 'locked' || this.targetRequestsLockedViewer());
    }

    isViewerExplore() {
      return this.mode === 'viewer' && this.viewerMode === 'explore';
    }

    getViewerSvgHeightFallback() {
      return Math.round(parsePositiveNumber(this.viewerHeight, null) || (this.viewerPrintCompact ? 180 : 600));
    }

    getViewerSvgHeightForWidth(width) {
      if (this.viewerAspectRatio) {
        const targetWidth = parsePositiveNumber(width, null);
        if (targetWidth) return Math.max(this._minSvgHeight || 1, Math.round(targetWidth / this.viewerAspectRatio));
      }
      return this.getViewerSvgHeightFallback();
    }

    applyViewerSvgSize() {
      if (this.mode !== 'viewer' || !this.svg) return;
      const rect = this.svg.getBoundingClientRect?.();
      const height = this.getViewerSvgHeightForWidth(rect?.width || 0);
      this.svg.style.width = '100%';
      this.svg.style.height = `${height}px`;
      this.svg.style.display = 'block';
      if (this.viewerPrintCompact) this.svg.style.maxHeight = `${height}px`;
    }

    buildLayout() {
      this.root = document.createElement('div');
      this.root.className = 'geo2d-root';
      if (this.mode === 'viewer') this.root.classList.add('geo2d-viewer-root');
      if (this.viewerPrintCompact) this.root.classList.add('geo2d-print-compact');
      this.shadow.appendChild(this.root);

      if (this.mode === 'viewer') {
        const initialHeight = this.getViewerSvgHeightFallback();
        this.root.innerHTML = `
          <div class="geo2d-mainpanel" style="width:100%;">
            <svg class="geo2d-svg" style="width:100%;height:${initialHeight}px;display:block;"></svg>
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
                  <label class="geo2d-field geo2d-prop-color-wrap"><span>Color</span><input class="geo2d-prop-color" type="color"></label>
                  <label class="geo2d-field geo2d-prop-label-wrap"><span>Nombre / etiqueta</span><input class="geo2d-prop-label" type="text"></label>
                  <label class="geo2d-field geo2d-prop-refs-wrap"><span>Dependencia / referencias</span><input class="geo2d-prop-refs" type="text" readonly></label>
                  <label class="geo2d-field geo2d-prop-extra-wrap"><span>Unidad</span>
                    <select class="geo2d-prop-extra">${buildSelectOptionsHtml(PROPERTY_EXTRA_UNIT_OPTIONS)}</select>
                  </label>
                  <div class="geo2d-prop-param-wrap">
                    <div class="geo2d-prop-subtitle geo2d-prop-param-title">Parámetro</div>
                    <label class="geo2d-check geo2d-prop-param-unlock-wrap"><input class="geo2d-prop-param-unlock" type="checkbox"> Editar parámetro</label>
                    <label class="geo2d-field geo2d-prop-param-mode-wrap"><span>Tipo</span>
                      <select class="geo2d-prop-param-mode">
                        <option value="value">Número directo</option>
                        <option value="ref">Variable existente</option>
                      </select>
                    </label>
                    <label class="geo2d-field geo2d-prop-param-value-wrap"><span class="geo2d-prop-param-value-label">Valor</span><input class="geo2d-prop-param-value" type="number" step="any"></label>
                    <label class="geo2d-field geo2d-prop-param-ref-wrap"><span>Variable</span><select class="geo2d-prop-param-ref"></select></label>
                  </div>
                  <div class="geo2d-prop-angle-wrap">
                    <div class="geo2d-prop-subtitle">Ángulo</div>
                    <label class="geo2d-check"><input class="geo2d-prop-angle-concave" type="checkbox"> Ángulo cóncavo</label>
                    <div class="geo2d-prop-subtitle">Partes visibles</div>
                    <label class="geo2d-check"><input class="geo2d-prop-angle-arms-visible" type="checkbox"> Brazos visibles</label>
                    <label class="geo2d-check"><input class="geo2d-prop-angle-arc-visible" type="checkbox"> Arco visible</label>
                    <label class="geo2d-check"><input class="geo2d-prop-angle-sector-visible" type="checkbox"> Sector visible</label>
                    <label class="geo2d-check"><input class="geo2d-prop-angle-measure-visible" type="checkbox"> Medida visible</label>
                    <label class="geo2d-field"><span>Nombre griego</span>
                      <select class="geo2d-prop-angle-greek">${ANGLE_GREEK_SELECT_OPTIONS_HTML}</select>
                    </label>
                  </div>
                  <label class="geo2d-check geo2d-prop-visible-wrap"><input class="geo2d-prop-visible" type="checkbox"> Visible</label>
                  <div class="geo2d-prop-number-wrap">
                    <div class="geo2d-prop-subtitle">Número</div>
                    <label class="geo2d-field geo2d-prop-number-min-wrap"><span>Mínimo</span><input class="geo2d-prop-number-min" type="number" step="any" placeholder="-inf"></label>
                    <label class="geo2d-field geo2d-prop-number-max-wrap"><span>Máximo</span><input class="geo2d-prop-number-max" type="number" step="any" placeholder="+inf"></label>
                    <div class="geo2d-number-controls">
                      <button type="button" class="geo2d-number-btn geo2d-prop-number-dec">-</button>
                      <input class="geo2d-prop-number-value" type="number" step="any">
                      <button type="button" class="geo2d-number-btn geo2d-prop-number-inc">+</button>
                    </div>
                    <label class="geo2d-field geo2d-prop-number-step-wrap"><span>Paso</span><input class="geo2d-prop-number-step" type="number" step="any"></label>
                  </div>
                  <div class="geo2d-prop-area-wrap">
                    <div class="geo2d-prop-subtitle">Área</div>
                    <label class="geo2d-check"><input class="geo2d-prop-area-visible" type="checkbox"> Área visible</label>
                    <label class="geo2d-field geo2d-prop-area-color-wrap"><span>Color de área</span><input class="geo2d-prop-area-color" type="color"></label>
                    <label class="geo2d-field"><span>Valor área</span><input class="geo2d-prop-area-value" type="text" readonly></label>
                  </div>
                  <div class="geo2d-prop-notables-wrap">
                    <div class="geo2d-prop-subtitle">Puntos notables</div>
                    <div class="geo2d-prop-notables-list"></div>
                  </div>
                  <div class="geo2d-prop-view-wrap">
                    <div class="geo2d-prop-subtitle">Vista</div>
                    <label class="geo2d-check"><input class="geo2d-prop-view-axes-visible" type="checkbox"> Activar ejes</label>
                    <label class="geo2d-field"><span>Grosor ejes</span><input class="geo2d-prop-view-axis-width" type="number" min="0.1" step="0.1"></label>
                    <label class="geo2d-field"><span>Oscuridad ejes</span><input class="geo2d-prop-view-axis-darkness" type="number" min="0" max="100" step="1"></label>
                    <label class="geo2d-check"><input class="geo2d-prop-view-grid-visible" type="checkbox"> Activar grilla</label>
                    <label class="geo2d-field"><span>Grosor grilla</span><input class="geo2d-prop-view-grid-width" type="number" min="0.1" step="0.1"></label>
                    <label class="geo2d-field"><span>Oscuridad grilla</span><input class="geo2d-prop-view-grid-darkness" type="number" min="0" max="100" step="1"></label>
                    <label class="geo2d-check"><input class="geo2d-prop-view-x-labels-visible" type="checkbox"> Numerar eje x</label>
                    <label class="geo2d-field"><span>Saltos eje x</span><input class="geo2d-prop-view-x-step" type="number" min="0.000001" step="any"></label>
                    <label class="geo2d-check"><input class="geo2d-prop-view-y-labels-visible" type="checkbox"> Numerar eje y</label>
                    <label class="geo2d-field"><span>Saltos eje y</span><input class="geo2d-prop-view-y-step" type="number" min="0.000001" step="any"></label>
                    <label class="geo2d-field"><span>Tamaño texto global</span><input class="geo2d-prop-view-global-font-size" type="number" min="8" step="1"></label>
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
      this.applyViewerSvgSize();
      this.jsonArea = this.root.querySelector('.geo2d-jsonarea');
      this.statusEl = this.root.querySelector('.geo2d-status');
      this.objectListEl = this.root.querySelector('.geo2d-object-list');
      this.propIdEl = this.root.querySelector('.geo2d-prop-id');
      this.propTypeEl = this.root.querySelector('.geo2d-prop-type');
      this.propColorEl = this.root.querySelector('.geo2d-prop-color');
      this.propLabelEl = this.root.querySelector('.geo2d-prop-label');
      this.propRefsEl = this.root.querySelector('.geo2d-prop-refs');
      this.propVisibleEl = this.root.querySelector('.geo2d-prop-visible');
      this.propIdWrapEl = this.root.querySelector('.geo2d-prop-id-wrap');
      this.propTypeWrapEl = this.root.querySelector('.geo2d-prop-type-wrap');
      this.propColorWrapEl = this.root.querySelector('.geo2d-prop-color-wrap');
      this.propLabelWrapEl = this.root.querySelector('.geo2d-prop-label-wrap');
      this.propRefsWrapEl = this.root.querySelector('.geo2d-prop-refs-wrap');
      this.propVisibleWrapEl = this.root.querySelector('.geo2d-prop-visible-wrap');
      this.propExtraWrapEl = this.root.querySelector('.geo2d-prop-extra-wrap');
      this.propExtraLabelEl = this.propExtraWrapEl?.querySelector('span') || null;
      this.propExtraSelectEl = this.root.querySelector('.geo2d-prop-extra');
      this.propParamWrapEl = this.root.querySelector('.geo2d-prop-param-wrap');
      this.propParamTitleEl = this.root.querySelector('.geo2d-prop-param-title');
      this.propParamUnlockWrapEl = this.root.querySelector('.geo2d-prop-param-unlock-wrap');
      this.propParamUnlockEl = this.root.querySelector('.geo2d-prop-param-unlock');
      this.propParamModeWrapEl = this.root.querySelector('.geo2d-prop-param-mode-wrap');
      this.propParamModeEl = this.root.querySelector('.geo2d-prop-param-mode');
      this.propParamValueWrapEl = this.root.querySelector('.geo2d-prop-param-value-wrap');
      this.propParamValueLabelEl = this.root.querySelector('.geo2d-prop-param-value-label');
      this.propParamValueEl = this.root.querySelector('.geo2d-prop-param-value');
      this.propParamRefWrapEl = this.root.querySelector('.geo2d-prop-param-ref-wrap');
      this.propParamRefEl = this.root.querySelector('.geo2d-prop-param-ref');
      this.propAngleWrapEl = this.root.querySelector('.geo2d-prop-angle-wrap');
      this.propAngleConcaveEl = this.root.querySelector('.geo2d-prop-angle-concave');
      this.propAngleArmsVisibleEl = this.root.querySelector('.geo2d-prop-angle-arms-visible');
      this.propAngleArcVisibleEl = this.root.querySelector('.geo2d-prop-angle-arc-visible');
      this.propAngleSectorVisibleEl = this.root.querySelector('.geo2d-prop-angle-sector-visible');
      this.propAngleMeasureVisibleEl = this.root.querySelector('.geo2d-prop-angle-measure-visible');
      this.propAngleGreekEl = this.root.querySelector('.geo2d-prop-angle-greek');
      this.propNumberWrapEl = this.root.querySelector('.geo2d-prop-number-wrap');
      this.propNumberMinWrapEl = this.root.querySelector('.geo2d-prop-number-min-wrap');
      this.propNumberMinEl = this.root.querySelector('.geo2d-prop-number-min');
      this.propNumberMaxWrapEl = this.root.querySelector('.geo2d-prop-number-max-wrap');
      this.propNumberMaxEl = this.root.querySelector('.geo2d-prop-number-max');
      this.propNumberValueEl = this.root.querySelector('.geo2d-prop-number-value');
      this.propNumberStepWrapEl = this.root.querySelector('.geo2d-prop-number-step-wrap');
      this.propNumberStepEl = this.root.querySelector('.geo2d-prop-number-step');
      this.propNumberDecEl = this.root.querySelector('.geo2d-prop-number-dec');
      this.propNumberIncEl = this.root.querySelector('.geo2d-prop-number-inc');
      this.propAreaWrapEl = this.root.querySelector('.geo2d-prop-area-wrap');
      this.propAreaVisibleEl = this.root.querySelector('.geo2d-prop-area-visible');
      this.propAreaColorEl = this.root.querySelector('.geo2d-prop-area-color');
      this.propAreaValueEl = this.root.querySelector('.geo2d-prop-area-value');
      this.propNotablesWrapEl = this.root.querySelector('.geo2d-prop-notables-wrap');
      this.propNotablesTitleEl = this.propNotablesWrapEl?.querySelector('.geo2d-prop-subtitle') || null;
      this.propNotablesListEl = this.root.querySelector('.geo2d-prop-notables-list');
      this.propViewWrapEl = this.root.querySelector('.geo2d-prop-view-wrap');
      this.propViewAxesVisibleEl = this.root.querySelector('.geo2d-prop-view-axes-visible');
      this.propViewAxisWidthEl = this.root.querySelector('.geo2d-prop-view-axis-width');
      this.propViewAxisDarknessEl = this.root.querySelector('.geo2d-prop-view-axis-darkness');
      this.propViewGridVisibleEl = this.root.querySelector('.geo2d-prop-view-grid-visible');
      this.propViewGridWidthEl = this.root.querySelector('.geo2d-prop-view-grid-width');
      this.propViewGridDarknessEl = this.root.querySelector('.geo2d-prop-view-grid-darkness');
      this.propViewXLabelsVisibleEl = this.root.querySelector('.geo2d-prop-view-x-labels-visible');
      this.propViewXStepEl = this.root.querySelector('.geo2d-prop-view-x-step');
      this.propViewYLabelsVisibleEl = this.root.querySelector('.geo2d-prop-view-y-labels-visible');
      this.propViewYStepEl = this.root.querySelector('.geo2d-prop-view-y-step');
      this.propViewGlobalFontSizeEl = this.root.querySelector('.geo2d-prop-view-global-font-size');
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
      this.propColorEl?.addEventListener('input', () => {
        this.updateSelectedObjectColor(this.propColorEl.value);
      });
      this.propColorEl?.addEventListener('change', () => this.commitHistoryState());

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

      this.propParamUnlockEl?.addEventListener('change', () => {
        this.updateSelectedParameterUnlock(this.propParamUnlockEl.checked);
      });
      this.propParamModeEl?.addEventListener('change', () => {
        this.updateSelectedNumericParameterMode(this.propParamModeEl.value);
      });
      this.propParamValueEl?.addEventListener('input', () => {
        this.updateSelectedNumericParameterValue(this.propParamValueEl.value);
      });
      this.propParamValueEl?.addEventListener('change', () => this.commitHistoryState());
      this.propParamRefEl?.addEventListener('change', () => {
        this.updateSelectedNumericParameterRef(this.propParamRefEl.value);
      });

      this.propAngleConcaveEl?.addEventListener('change', () => {
        this.updateSelectedAngleConcavity(this.propAngleConcaveEl.checked);
      });

      this.propAngleArmsVisibleEl?.addEventListener('change', () => {
        this.updateSelectedAngleArmsVisibility(this.propAngleArmsVisibleEl.checked);
      });

      this.propAngleArcVisibleEl?.addEventListener('change', () => {
        this.updateSelectedAngleArcVisibility(this.propAngleArcVisibleEl.checked);
      });

      this.propAngleSectorVisibleEl?.addEventListener('change', () => {
        this.updateSelectedAngleSectorVisibility(this.propAngleSectorVisibleEl.checked);
      });

      this.propAngleMeasureVisibleEl?.addEventListener('change', () => {
        this.updateSelectedAngleMeasureVisibility(this.propAngleMeasureVisibleEl.checked);
      });

      this.propAngleGreekEl?.addEventListener('change', () => {
        this.updateSelectedAngleGreekLabel(this.propAngleGreekEl.value);
      });

      this.propAreaVisibleEl?.addEventListener('change', () => {
        this.updateSelectedObjectAreaVisibility(this.propAreaVisibleEl.checked);
      });

      this.propAreaColorEl?.addEventListener('input', () => {
        this.updateSelectedObjectAreaColor(this.propAreaColorEl.value);
      });
      this.propAreaColorEl?.addEventListener('change', () => this.commitHistoryState());

      this.propNumberValueEl?.addEventListener('input', () => {
        this.updateSelectedNumberValue(this.propNumberValueEl.value);
      });
      this.propNumberValueEl?.addEventListener('change', () => this.commitHistoryState());

      this.propNumberStepEl?.addEventListener('input', () => {
        this.updateSelectedNumberStep(this.propNumberStepEl.value);
      });
      this.propNumberStepEl?.addEventListener('change', () => this.commitHistoryState());

      this.propNumberMinEl?.addEventListener('input', () => {
        this.updateSelectedNumberInterval('min', this.propNumberMinEl.value);
      });
      this.propNumberMinEl?.addEventListener('change', () => this.commitHistoryState());

      this.propNumberMaxEl?.addEventListener('input', () => {
        this.updateSelectedNumberInterval('max', this.propNumberMaxEl.value);
      });
      this.propNumberMaxEl?.addEventListener('change', () => this.commitHistoryState());

      this.propNumberDecEl?.addEventListener('click', () => {
        this.nudgeSelectedNumber(-1);
      });

      this.propNumberIncEl?.addEventListener('click', () => {
        this.nudgeSelectedNumber(1);
      });

      this.propNotablesListEl?.addEventListener('change', (e) => {
        const input = e.target.closest('[data-notable-visible]');
        if (!input) return;
        this.updateSelectedNotablePointVisibility(input.dataset.notableVisible, input.checked);
      });

      this.propNotablesListEl?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-notable-select]');
        if (!btn || btn.disabled) return;
        this.selectObject(btn.dataset.notableSelect);
      });

      this.propViewAxesVisibleEl?.addEventListener('change', () => {
        this.updateSelectedViewBoolean('showAxes', this.propViewAxesVisibleEl.checked);
      });
      this.propViewAxisWidthEl?.addEventListener('input', () => {
        this.updateSelectedViewNumber('axisStrokeWidth', this.propViewAxisWidthEl.value, 1.5);
      });
      this.propViewAxisWidthEl?.addEventListener('change', () => this.commitHistoryState());
      this.propViewAxisDarknessEl?.addEventListener('input', () => {
        this.updateSelectedViewNumber('axisDarkness', this.propViewAxisDarknessEl.value, 0);
      });
      this.propViewAxisDarknessEl?.addEventListener('change', () => this.commitHistoryState());

      this.propViewGridVisibleEl?.addEventListener('change', () => {
        this.updateSelectedViewBoolean('showGrid', this.propViewGridVisibleEl.checked);
      });
      this.propViewGridWidthEl?.addEventListener('input', () => {
        this.updateSelectedViewNumber('gridStrokeWidth', this.propViewGridWidthEl.value, 1);
      });
      this.propViewGridWidthEl?.addEventListener('change', () => this.commitHistoryState());
      this.propViewGridDarknessEl?.addEventListener('input', () => {
        this.updateSelectedViewNumber('gridDarkness', this.propViewGridDarknessEl.value, 0);
      });
      this.propViewGridDarknessEl?.addEventListener('change', () => this.commitHistoryState());

      this.propViewXLabelsVisibleEl?.addEventListener('change', () => {
        this.updateSelectedViewBoolean('showXAxisLabels', this.propViewXLabelsVisibleEl.checked);
      });
      this.propViewXStepEl?.addEventListener('input', () => {
        this.updateSelectedViewNumber('xAxisLabelStep', this.propViewXStepEl.value, 1);
      });
      this.propViewXStepEl?.addEventListener('change', () => this.commitHistoryState());

      this.propViewYLabelsVisibleEl?.addEventListener('change', () => {
        this.updateSelectedViewBoolean('showYAxisLabels', this.propViewYLabelsVisibleEl.checked);
      });
      this.propViewYStepEl?.addEventListener('input', () => {
        this.updateSelectedViewNumber('yAxisLabelStep', this.propViewYStepEl.value, 1);
      });
      this.propViewYStepEl?.addEventListener('change', () => this.commitHistoryState());

      this.propViewGlobalFontSizeEl?.addEventListener('input', () => {
        this.updateSelectedViewStyleNumber('fontSize', this.propViewGlobalFontSizeEl.value, 14);
      });
      this.propViewGlobalFontSizeEl?.addEventListener('change', () => this.commitHistoryState());
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
      this.bindKeyboardEvents();
    }

    bindKeyboardEvents() {
      if (this.mode === 'viewer' || this._keyboardHandler) return;

      this._keyboardHandler = (e) => {
        // No interceptar eventos si el usuario escribe en un campo de texto
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        // Ctrl+Z / Cmd+Z (Deshacer) y Ctrl+Shift+Z (Rehacer)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          if (e.shiftKey) this.redoLastChange();
          else this.undoLastChange();
          e.preventDefault();
        }
        // Ctrl+Y / Cmd+Y (Rehacer)
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          this.redoLastChange();
          e.preventDefault();
        }
        // Escape (Cancelar construcción en curso o deseleccionar)
        else if (e.key === 'Escape') {
          if (this._pendingPoints.length > 0 || this._toolData) {
            this.activateTool(this.activeTool);
          } else {
            this.activateTool('move');
            this.selectObject(null);
          }
          e.preventDefault();
        }
        // Shift+Backspace (Borrar objeto seleccionado)
        else if (e.key === 'Backspace' && e.shiftKey) {
          if (this.selectedObjectId && !this.isViewSelected()) {
            const ids = this.collectDependentIds(this.selectedObjectId);
            this.model.removeIds(ids);
            this.selectedObjectId = null;
            this.selectedPart = null;
            this.resetConstructionState();
            this.renderAndSync();
            this.setStatus(ids.size > 1 ? `Borrados ${ids.size} objetos.` : 'Objeto borrado.');
            e.preventDefault();
          }
        }
      };

      document.addEventListener('keydown', this._keyboardHandler);
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
        this.applyViewerSvgSize();
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
      if (this.selectedObjectId && !this.model.hasId(this.selectedObjectId) && !isViewObjectId(this.selectedObjectId)) this.selectedObjectId = null;
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
      
      const prevScroll = this.objectListEl.scrollTop;
      const viewActive = isViewObjectId(this.selectedObjectId);
      const viewHtml = `
        <div class="geo2d-object-group">
          <div class="geo2d-object-group-title">VISTA</div>
          <button type="button" class="geo2d-object-item${viewActive ? ' is-active' : ''}" data-object-id="${VIEW_OBJECT_ID}">
            <span>Zona gráfica</span>
            <span class="geo2d-object-state">config</span>
          </button>
        </div>
      `;

      if (!this.model.objects.length) {
        this.objectListEl.innerHTML = `${viewHtml}<div class="geo2d-object-empty">Sin objetos.</div>`;
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

        if (isPolygonHostRawType(InternalObjectAdapter.type(obj))) {
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

      const objectGroupsHtml = [...buckets.values()]
        .filter(bucket => bucket.entries.length)
        .map(bucket => `
          <div class="geo2d-object-group">
            <div class="geo2d-object-group-title">${DomUtils.escapeHtml(bucket.group.label)}</div>
            ${bucket.entries.map(entry => {
              const selectionPart = entry.part || null;
              const isActive =
                entry.objectId === this.selectedObjectId &&
                this.getSelectionKey(entry.objectId, selectionPart) === this.getSelectionKey(this.selectedObjectId, this.selectedPart);
          const partKindAttr = selectionPart ? ` data-part-kind="${DomUtils.escapeHtml(selectionPart.kind)}"` : '';
              const edgeIndexAttr = selectionPart?.edgeIndex !== undefined && selectionPart?.edgeIndex !== null
            ? ` data-edge-index="${DomUtils.escapeHtml(selectionPart.edgeIndex)}"`
                : '';
              return `
            <button type="button" class="geo2d-object-item${selectionPart ? ' is-part' : ''}${isActive ? ' is-active' : ''}${entry.visible ? '' : ' is-hidden'}" data-object-id="${DomUtils.escapeHtml(entry.objectId)}"${partKindAttr}${edgeIndexAttr}>
              <span>${DomUtils.escapeHtml(entry.label)}</span>
                  <span class="geo2d-object-state">${entry.visible ? 'visible' : 'oculto'}</span>
                </button>
              `;
            }).join('')}
          </div>
        `).join('');
      this.objectListEl.innerHTML = viewHtml + objectGroupsHtml;

      const currentSelectionKey = this.getSelectionKey(this.selectedObjectId, this.selectedPart);
      
      if (currentSelectionKey && this._lastScrolledSelectionKey !== currentSelectionKey) {
        const activeItem = this.objectListEl.querySelector('.is-active');
        if (activeItem) {
          activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        this._lastScrolledSelectionKey = currentSelectionKey;
      } else {
        this.objectListEl.scrollTop = prevScroll;
      }
    }

    getSelectedObjectPropertyState() {
      if (this.isViewSelected()) {
        const vp = this.model.viewport || {};
        return {
          ...createEmptyPropertyPanelState(),
          obj: { id: VIEW_OBJECT_ID },
          id: 'vista',
          type: 'view',
          typeLabel: 'Vista',
          refs: 'Zona grafica de la escena',
          visible: true,
          isView: true,
          labelEditable: false,
          viewAxesVisible: vp.showAxes !== false,
          viewAxisWidth: Math.max(0.1, safeNumber(vp.axisStrokeWidth, 1.5)),
          viewAxisDarkness: Math.max(0, Math.min(100, safeNumber(vp.axisDarkness, 0))),
          viewGridVisible: vp.showGrid !== false,
          viewGridWidth: Math.max(0.1, safeNumber(vp.gridStrokeWidth, 1)),
          viewGridDarkness: Math.max(0, Math.min(100, safeNumber(vp.gridDarkness, 0))),
          viewXLabelsVisible: vp.showXAxisLabels === true,
          viewXStep: Math.max(0.000001, safeNumber(vp.xAxisLabelStep, 1)),
          viewYLabelsVisible: vp.showYAxisLabels === true,
          viewYStep: Math.max(0.000001, safeNumber(vp.yAxisLabelStep, 1)),
          viewGlobalFontSize: Math.max(8, safeNumber(this.model.style?.fontSize, 14))
        };
      }

      const obj = this.getSelectedObject();
      if (!obj) {
        return createEmptyPropertyPanelState();
      }

      const type = InternalObjectAdapter.type(obj);
      const isPolygon = isPolygonHostRawType(type);
      const isEllipse = type === 'ellipse';
      const hasArea = objectSupportsArea(obj);
      const selectedPart = isPolygon ? this.normalizeSelectedPart(this.selectedPart) : null;
      const resolved = this.model.getResolvedObject(obj.id);
      const areaNumber = hasArea ? resolvedAreaValue(resolved) : NaN;
      const areaValue = Number.isFinite(areaNumber) ? formatNumberShort(areaNumber) : '';
      const notablePoints = getObjectNotableEntries(this, obj);
      const notableTitle = getObjectNotableTitle(obj);
      const showNotables = notablePoints.length > 0;
      const typeState = getObjectPropertyPanelState(this, obj, resolved);
      const numericParamConfig = getRawNumericParameterState(obj.raw);
      const numericParamUnlocked = !numericParamConfig?.unlockable || this._unlockedParameterObjectId === obj.id;
      const numericParamRef = numericParamConfig?.refKey ? String(obj.raw[numericParamConfig.refKey] || '').trim() : '';
      const numericParamState = numericParamConfig ? {
        showNumericParam: true,
        numericParamTitle: numericParamConfig.title,
        numericParamValueLabel: numericParamConfig.valueLabel,
        numericParamMode: numericParamRef ? 'ref' : 'value',
        numericParamValue: formatNumberShort(obj.raw[numericParamConfig.valueKey]),
        numericParamRef,
        numericParamAllowRef: numericParamConfig.allowRef !== false,
        numericParamUnlockable: numericParamConfig.unlockable === true,
        numericParamUnlocked
      } : {};

      const style = obj.raw.style || {};
      let rawColor = style.stroke || '#1f2937';
      if (type === 'point' || type === 'midpoint') rawColor = style.fill || '#ea580c';
      else if (type === 'text') rawColor = style.fill || '#111827';
      const hexMatch = String(rawColor).match(/#[0-9a-fA-F]{6}/);
      const color = hexMatch ? hexMatch[0].toLowerCase() : '#000000';

      let areaColor = '#ea580c';
      if (type === 'circle' || type === 'circle-radius') areaColor = '#c62828';
      else if (type === 'ellipse') areaColor = '#9333ea';

      if (style.fill && style.fill !== 'none') {
        const hexMatchFill = style.fill.match(/^#([0-9a-fA-F]{6})/);
        const rgbMatchFill = style.fill.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (hexMatchFill) areaColor = '#' + hexMatchFill[1].toLowerCase();
        else if (rgbMatchFill) {
          const r = parseInt(rgbMatchFill[1]).toString(16).padStart(2, '0');
          const g = parseInt(rgbMatchFill[2]).toString(16).padStart(2, '0');
          const b = parseInt(rgbMatchFill[3]).toString(16).padStart(2, '0');
          areaColor = `#${r}${g}${b}`;
        }
      }

      if (selectedPart) {
        const isPolygonFillPart = selectedPart.kind === 'polygon-fill';
        return {
          ...createEmptyPropertyPanelState(),
          obj,
          id: getPolygonPartLabel(obj.raw, selectedPart),
          type,
          typeLabel: getPolygonPartTypeLabel(selectedPart),
          refs: describePolygonPart(obj.raw, selectedPart),
          visible: isPolygonPartVisible(obj.raw, selectedPart),
          color,
          isPolygon: isPolygonFillPart,
          hasArea: isPolygonFillPart,
          isPart: true,
          areaVisible: isPolygonFillPart ? isObjectAreaVisible(obj.raw) : false,
          areaColor,
          areaValue: isPolygonFillPart ? areaValue : ''
        };
      }

      return {
        ...createEmptyPropertyPanelState(),
        obj,
        id: obj.id,
        type,
        typeLabel: getObjectTypeLabel(obj),
        label: type === 'text' ? (obj.raw.text || '') : (obj.raw.label || ''),
        color,
        refs: describeObjectRefs(obj),
        visible: InternalObjectAdapter.isVisible(obj),
        isPolygon,
        hasArea,
        isEllipse,
        isPart: false,
        labelEditable: true,
        areaVisible: hasArea ? isObjectAreaVisible(obj.raw) : false,
        areaColor,
        areaValue,
        notablePoints,
        showNotables,
        notableTitle,
        ...numericParamState,
        ...typeState
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

    getAngleDerivedPointEntries(raw) {
      if (!raw || InternalObjectAdapter.type(raw) !== 'angle' || getAngleDefinitionKind(raw) !== 'vertex-ray-measure') return [];

      const id = String(raw.derivedPoints?.p2 || '').trim();
      const point = id ? this.model.getObject(id) : null;
      const isPoint = !!point?.isPointLike?.();
      return [{
        key: 'terminalPoint',
        label: 'Punto terminal',
        id,
        exists: isPoint,
        visible: isPoint ? InternalObjectAdapter.isVisible(point) : false
      }];
    }

    getBisectorDerivedPointEntries(raw) {
      if (!raw || InternalObjectAdapter.type(raw) !== 'bisector-ray') return [];

      const id = String(raw.derivedPoints?.point || '').trim();
      const point = id ? this.model.getObject(id) : null;
      const isPoint = !!point?.isPointLike?.();
      return [{
        key: 'bisectorPoint',
        label: 'Punto bisectriz',
        id,
        exists: isPoint,
        visible: isPoint ? InternalObjectAdapter.isVisible(point) : false
      }];
    }

    getRegularPolygonNotablePointEntries(raw) {
      if (!raw || InternalObjectAdapter.type(raw) !== 'regular-polygon') return [];

      const pointIds = Array.isArray(raw.points)
        ? raw.points.map(id => String(id || '').trim()).filter(Boolean)
        : [];
      const defs = [
        { key: 'center', label: 'Centro', id: raw.center },
        ...pointIds.map((id, index) => ({
          key: index === 0 ? 'vertex' : `vertex-${index}`,
          label: index === 0 ? 'Vértice base' : `Vértice ${index + 1}`,
          id
        }))
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

    renderNotablePointEntries(entries = []) {
      if (!this.propNotablesListEl) return;

      this.propNotablesListEl.innerHTML = entries.map(entry => {
        const id = entry.id || '—';
        const disabled = !entry.exists;
        return `
          <div class="geo2d-notable-row">
            <button type="button" class="geo2d-notable-main" data-notable-select="${DomUtils.escapeHtml(entry.id)}"${disabled ? ' disabled' : ''}>
              <span class="geo2d-notable-role">${DomUtils.escapeHtml(entry.label)}</span>
              <span class="geo2d-notable-id">${DomUtils.escapeHtml(id)}</span>
            </button>
            <label class="geo2d-check geo2d-notable-visible">
              <input type="checkbox" data-notable-visible="${DomUtils.escapeHtml(entry.id)}"${entry.visible ? ' checked' : ''}${disabled ? ' disabled' : ''}>
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

    updateSelectedObjectColor(value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;
      if (this.selectedPart) return false;

      if (!obj.raw.style) obj.raw.style = {};
      const type = InternalObjectAdapter.type(obj);

      if (type === 'point' || type === 'midpoint' || type === 'text') {
        obj.raw.style.fill = value;
        if (type !== 'text') obj.raw.style.stroke = value;
      } else {
        obj.raw.style.stroke = value;
      }

      this.renderAndSync(false);
      return true;
    }

    updateSelectedObjectVisibility(value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;

      if (this.selectedPart && isPolygonHostRawType(InternalObjectAdapter.type(obj))) {
        if (!setPolygonPartVisible(obj.raw, this.selectedPart, value)) return false;
        this.renderAndSync();
        return true;
      }

      obj.raw.visible = !!value;
      this.renderAndSync();
      return true;
    }

    updateSelectedParameterUnlock(value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;
      const config = getRawNumericParameterState(obj.raw);
      if (!config?.unlockable) return false;
      this._unlockedParameterObjectId = value ? obj.id : null;
      this.refreshProperties();
      return true;
    }

    getSelectedNumericParameterConfig() {
      const obj = this.getSelectedObject();
      if (!obj || this.selectedPart) return null;
      const config = getRawNumericParameterState(obj.raw);
      if (!config) return null;
      if (config.unlockable && this._unlockedParameterObjectId !== obj.id) return null;
      return { obj, config };
    }

    updateSelectedNumericParameterMode(mode) {
      const info = this.getSelectedNumericParameterConfig();
      if (!info) return false;
      const { obj, config } = info;
      const nextMode = mode === 'ref' && config.allowRef !== false ? 'ref' : 'value';
      if (nextMode === 'ref') {
        const refId = this.propParamRefEl?.value || this.getNumberParameterOptions()[0]?.id || '';
        if (!refId) {
          this.refreshProperties();
          return false;
        }
        obj.raw[config.refKey] = refId;
        delete obj.raw[config.valueKey];
      } else {
        const current = this.model.getResolvedObject(obj.id);
        const fallback = config.valueKey === 'sides' ? 5 : 1;
        obj.raw[config.valueKey] = safeNumber(current?.[config.valueKey] ?? current?.value ?? obj.raw[config.valueKey], fallback);
        if (config.refKey) delete obj.raw[config.refKey];
      }
      this.renderAndSync();
      return true;
    }

    updateSelectedNumericParameterValue(value) {
      const info = this.getSelectedNumericParameterConfig();
      if (!info) return false;
      const { obj, config } = info;
      const nextValue = safeNumber(String(value ?? '').replace(',', '.'), NaN);
      if (!config.validate(nextValue)) return false;
      if (config.valueKey === 'sides') {
        this.updateRegularPolygonSides(obj, Math.floor(nextValue));
      } else {
        obj.raw[config.valueKey] = nextValue;
      }
      if (config.refKey) delete obj.raw[config.refKey];
      this.renderAndSync(false);
      return true;
    }

    updateSelectedNumericParameterRef(refId) {
      const info = this.getSelectedNumericParameterConfig();
      if (!info) return false;
      const { obj, config } = info;
      if (config.allowRef === false || !config.refKey) return false;
      const cleanRef = String(refId || '').trim();
      const refObj = cleanRef ? this.model.getObject(cleanRef) : null;
      if (!refObj || InternalObjectAdapter.type(refObj) !== 'number') return false;
      obj.raw[config.refKey] = cleanRef;
      delete obj.raw[config.valueKey];
      this.renderAndSync();
      return true;
    }

    updateRegularPolygonSides(obj, sides) {
      if (!obj || InternalObjectAdapter.type(obj) !== 'regular-polygon') return false;
      const nextSides = Math.max(3, Math.floor(safeNumber(sides, 3)));
      const raw = obj.raw;
      const points = Array.isArray(raw.points) ? raw.points.slice() : [];
      const vertexId = String(raw.vertex || points[0] || '').trim();
      raw.sides = nextSides;
      if (!vertexId) return true;
      raw.vertex = vertexId;
      raw.points = [vertexId];
      const removeIds = new Set(points.slice(nextSides).filter(Boolean));
      if (removeIds.size) this.model.removeIds(removeIds);
      const reserved = new Set([obj.id, ...this.model.objects.map(item => item.id)]);
      for (let index = 1; index < nextSides; index++) {
        let pointId = points[index];
        if (!pointId || !this.model.hasId(pointId)) {
          pointId = this.generateAuxiliaryPointName('P', reserved);
          reserved.add(pointId);
          this.addRegularPolygonDerivedPoint(obj.id, index, pointId, false);
        }
        raw.points.push(pointId);
      }
      normalizePolygonParts(raw);
      return true;
    }

    updateSelectedViewBoolean(key, value) {
      if (!this.isViewSelected()) return false;
      const allowed = new Set(['showAxes', 'showGrid', 'showXAxisLabels', 'showYAxisLabels']);
      if (!allowed.has(key)) return false;
      this.model.viewport[key] = !!value;
      this.renderAndSync();
      return true;
    }

    updateSelectedViewNumber(key, value, fallback = 1) {
      if (!this.isViewSelected()) return false;
      const allowed = new Set(['axisStrokeWidth', 'gridStrokeWidth', 'axisDarkness', 'gridDarkness', 'xAxisLabelStep', 'yAxisLabelStep']);
      if (!allowed.has(key)) return false;
      const nextValue = safeNumber(String(value ?? '').replace(',', '.'), NaN);
      if (!Number.isFinite(nextValue)) return false;
      this.model.viewport[key] = nextValue;
      if (key === 'axisStrokeWidth' || key === 'gridStrokeWidth') {
        if (!(nextValue > 0)) return false;
        this.model.viewport[key] = Math.max(0.1, this.model.viewport[key]);
      } else if (key === 'axisDarkness' || key === 'gridDarkness') {
        this.model.viewport[key] = Math.max(0, Math.min(100, this.model.viewport[key]));
      } else {
        if (!(nextValue > 0)) return false;
        this.model.viewport[key] = Math.max(0.000001, this.model.viewport[key]);
      }
      if (!Number.isFinite(this.model.viewport[key])) this.model.viewport[key] = fallback;
      this.renderAndSync(false);
      return true;
    }

    updateSelectedViewStyleNumber(key, value, fallback = 14) {
      if (!this.isViewSelected()) return false;
      if (key !== 'fontSize') return false;
      const nextValue = safeNumber(String(value ?? '').replace(',', '.'), NaN);
      if (!(nextValue > 0)) return false;
      if (!this.model.style) this.model.style = {};
      this.model.style.fontSize = Math.max(8, nextValue);
      if (!Number.isFinite(this.model.style.fontSize)) this.model.style.fontSize = fallback;
      this.renderAndSync(false);
      return true;
    }

    updateSelectedNumberValue(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'number') return false;
      if (String(obj.raw.numberKind || '').trim().toLowerCase() !== 'independent') return false;
      const nextValue = safeNumber(String(value ?? '').replace(',', '.'), NaN);
      if (!Number.isFinite(nextValue)) return false;
      obj.raw.value = clampNumberToInterval(nextValue, obj.raw);
      this.renderAndSync(false);
      return true;
    }

    updateSelectedNumberStep(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'number') return false;
      if (String(obj.raw.numberKind || '').trim().toLowerCase() !== 'independent') return false;
      const nextStep = safeNumber(String(value ?? '').replace(',', '.'), NaN);
      if (!(nextStep > 0)) return false;
      obj.raw.step = nextStep;
      this.renderAndSync(false);
      return true;
    }

    updateSelectedNumberInterval(key, value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'number') return false;
      if (String(obj.raw.numberKind || '').trim().toLowerCase() !== 'independent') return false;
      if (key !== 'min' && key !== 'max') return false;

      const token = String(value ?? '').trim().replace(',', '.');
      if (!token) delete obj.raw[key];
      else {
        const nextValue = safeNumber(token, NaN);
        if (!Number.isFinite(nextValue)) return false;
        obj.raw[key] = nextValue;
      }

      if (Number.isFinite(safeNumber(obj.raw.min, NaN)) && Number.isFinite(safeNumber(obj.raw.max, NaN)) && obj.raw.min > obj.raw.max) {
        const otherKey = key === 'min' ? 'max' : 'min';
        obj.raw[otherKey] = obj.raw[key];
      }

      obj.raw.value = clampNumberToInterval(safeNumber(obj.raw.value, 1), obj.raw);
      this.renderAndSync(false);
      return true;
    }

    nudgeSelectedNumber(direction) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'number') return false;
      if (String(obj.raw.numberKind || '').trim().toLowerCase() !== 'independent') return false;
      const dir = safeNumber(direction, 0);
      if (!dir) return false;
      const step = safeNumber(obj.raw.step, 1);
      obj.raw.value = clampNumberToInterval(safeNumber(obj.raw.value, 0) + step * dir, obj.raw);
      this.renderAndSync();
      return true;
    }

    updateSelectedObjectExtra(value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;
      const type = InternalObjectAdapter.type(obj);
      if (type === 'angle') {
        if (getAngleDefinitionKind(obj.raw) === 'vertex-ray-measure') {
          const nextUnit = value === 'rad' ? 'rad' : 'deg';
          const previousUnit = getAngleUnit(obj.raw);
          if (!String(obj.raw.measureRef || '').trim() && Number.isFinite(safeNumber(obj.raw.measureValue, NaN))) {
            obj.raw.measureValue = convertAngleValueUnit(obj.raw.measureValue, previousUnit, nextUnit);
          }
          obj.raw.unit = nextUnit;
          normalizeAngleMeasure(obj.raw, true);
          this.renderAndSync();
          return true;
        }
        normalizeAngleMeasure(obj.raw, true);
        obj.raw.measure.unit = value === 'rad' ? 'rad' : 'deg';
        this.renderAndSync();
        return true;
      }
      if (type === 'bisector-ray') {
        obj.raw.mode = normalizeBisectorMode(value, 'normal');
        this.renderAndSync();
        return true;
      }
      return false;
    }

    updateSelectedAngleConcavity(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'angle') return false;
      if (getAngleDefinitionKind(obj.raw) === 'vertex-ray-measure') {
        if (String(obj.raw.measureRef || '').trim()) {
          this.refreshProperties();
          this.setStatus('La concavidad de este ángulo depende de su medida numérica.', true);
          return false;
        }
        const unit = getAngleUnit(obj.raw);
        const currentValue = validateAngleMeasureValue(obj.raw.measureValue, unit, `ángulo "${obj.id}"`);
        const isCurrentlyConcave = isConcaveAngleMeasure(currentValue, unit);
        if (!!value === isCurrentlyConcave) return false;
        obj.raw.measureValue = getAngleFullTurn(unit) - currentValue;
        this.renderAndSync();
        return true;
      }
      obj.raw.mode = value === true ? 'concave' : 'normal';
      this.renderAndSync();
      return true;
    }

    updateSelectedAngleSectorVisibility(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'angle') return false;

      setAngleSectorVisible(obj.raw, value, true);
      this.renderAndSync();
      return true;
    }

    updateSelectedAngleArmsVisibility(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'angle') return false;

      setAngleArmsVisible(obj.raw, value);
      this.renderAndSync();
      return true;
    }

    updateSelectedAngleArcVisibility(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'angle') return false;

      setAngleArcVisible(obj.raw, value);
      this.renderAndSync();
      return true;
    }

    updateSelectedAngleMeasureVisibility(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'angle') return false;

      setAngleMeasureVisible(obj.raw, value, true);
      this.renderAndSync();
      return true;
    }

    updateSelectedAngleGreekLabel(value) {
      const obj = this.getSelectedObject();
      if (!obj || InternalObjectAdapter.type(obj) !== 'angle') return false;

      const symbol = getGreekAngleLabelValue(value);
      if (symbol) obj.raw.label = symbol;
      else delete obj.raw.label;
      this.renderAndSync();
      return true;
    }

    updateSelectedObjectAreaVisibility(value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;

      const type = InternalObjectAdapter.type(obj);
      const selectedPart = isPolygonHostRawType(type) ? this.normalizeSelectedPart(this.selectedPart) : null;
      if (selectedPart && selectedPart.kind !== 'polygon-fill') return false;
      if (selectedPart && !isPolygonHostRawType(type)) return false;
      if (!setObjectAreaVisible(obj.raw, value)) return false;

      this.renderAndSync();
      return true;
    }

    updateSelectedNotablePointVisibility(pointId, value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;

      const entries = getObjectNotableEntries(this, obj);
      if (!entries.length) return false;

      const id = String(pointId || '').trim();
      const allowedIds = new Set(entries.map(entry => entry.id).filter(Boolean));
      if (!allowedIds.has(id)) return false;

      const point = this.model.getObject(id);
      if (!point?.isPointLike?.()) return false;

      point.raw.visible = !!value;
      this.renderAndSync();
      return true;
    }

    updateSelectedObjectAreaColor(value) {
      const obj = this.getSelectedObject();
      if (!obj) return false;

      const type = InternalObjectAdapter.type(obj);
      const selectedPart = isPolygonHostRawType(type) ? this.normalizeSelectedPart(this.selectedPart) : null;
      if (selectedPart && selectedPart.kind !== 'polygon-fill') return false;
      if (selectedPart && !isPolygonHostRawType(type)) return false;

      if (!obj.raw.style) obj.raw.style = {};
      let color = String(value || '').trim();
      if (color.match(/^#[0-9a-fA-F]{6}$/)) {
        color = color + '2e'; // Conserva la transparencia parcial del ~18% por defecto.
      }
      obj.raw.style.fill = color;

      this.renderAndSync(false);
      return true;
    }

    setPropertyRowVisible(row, visible, display = 'flex') {
      if (!row) return;
      row.style.setProperty('display', visible ? display : 'none', 'important');
    }

    setPropertyExtraConfig(label, options, value) {
      if (this.propExtraLabelEl) this.propExtraLabelEl.textContent = label || 'Unidad';
      if (!this.propExtraSelectEl) return;
      this.propExtraSelectEl.innerHTML = buildSelectOptionsHtml(options || PROPERTY_EXTRA_UNIT_OPTIONS);
      this.propExtraSelectEl.value = value;
    }

    refreshProperties() {
      const state = this.getSelectedObjectPropertyState();
      const fields = [
        this.propIdEl,
        this.propTypeEl,
        this.propColorEl,
        this.propLabelEl,
        this.propRefsEl,
        this.propVisibleEl,
        this.propExtraSelectEl,
        this.propAngleConcaveEl,
        this.propAngleArmsVisibleEl,
        this.propAngleArcVisibleEl,
        this.propAngleSectorVisibleEl,
        this.propAngleMeasureVisibleEl,
        this.propAngleGreekEl,
        this.propNumberValueEl,
        this.propNumberStepEl,
      this.propNumberMinEl,
      this.propNumberMaxEl,
      this.propParamUnlockEl,
      this.propParamModeEl,
      this.propParamValueEl,
      this.propParamRefEl,
      this.propNumberDecEl,
        this.propNumberIncEl,
        this.propAreaVisibleEl,
        this.propAreaColorEl,
        this.propAreaValueEl,
        this.propViewAxesVisibleEl,
        this.propViewAxisWidthEl,
        this.propViewAxisDarknessEl,
        this.propViewGridVisibleEl,
        this.propViewGridWidthEl,
        this.propViewGridDarknessEl,
        this.propViewXLabelsVisibleEl,
        this.propViewXStepEl,
        this.propViewYLabelsVisibleEl,
        this.propViewYStepEl,
        this.propViewGlobalFontSizeEl
      ].filter(Boolean);
      fields.forEach(field => { field.disabled = !state.obj; });
      if (this.propLabelEl) this.propLabelEl.disabled = !state.obj || state.labelEditable === false;

      if (!this.propLabelEl || !this.propVisibleEl) return;
      if (!state.obj) {
        this.setPropertyRowVisible(this.propIdWrapEl, false);
        this.setPropertyRowVisible(this.propTypeWrapEl, false);
        this.setPropertyRowVisible(this.propColorWrapEl, false);
        this.setPropertyRowVisible(this.propLabelWrapEl, false);
        this.setPropertyRowVisible(this.propRefsWrapEl, false);
        this.setPropertyRowVisible(this.propVisibleWrapEl, false);
        this.setPropertyRowVisible(this.propExtraWrapEl, false);
        this.setPropertyRowVisible(this.propParamWrapEl, false);
        this.setPropertyRowVisible(this.propAngleWrapEl, false);
        this.setPropertyRowVisible(this.propNumberWrapEl, false);
        this.setPropertyRowVisible(this.propAreaWrapEl, false);
        this.setPropertyRowVisible(this.propNotablesWrapEl, false);
        this.setPropertyRowVisible(this.propViewWrapEl, false);
        if (this.propIdEl) this.propIdEl.value = '';
        if (this.propTypeEl) this.propTypeEl.value = '';
        if (this.propColorEl) this.propColorEl.value = '#000000';
        this.propLabelEl.value = '';
        if (this.propRefsEl) this.propRefsEl.value = '';
        this.propVisibleEl.checked = false;
        this.setPropertyExtraConfig('Unidad', PROPERTY_EXTRA_UNIT_OPTIONS, 'deg');
        if (this.propParamTitleEl) this.propParamTitleEl.textContent = 'Parámetro';
        if (this.propParamModeEl) this.propParamModeEl.value = 'value';
        if (this.propParamValueEl) this.propParamValueEl.value = '';
        if (this.propParamRefEl) this.propParamRefEl.innerHTML = '';
        if (this.propParamUnlockEl) this.propParamUnlockEl.checked = false;
        if (this.propAngleConcaveEl) this.propAngleConcaveEl.checked = false;
        if (this.propAngleArmsVisibleEl) this.propAngleArmsVisibleEl.checked = false;
        if (this.propAngleArcVisibleEl) this.propAngleArcVisibleEl.checked = true;
        if (this.propAngleSectorVisibleEl) this.propAngleSectorVisibleEl.checked = true;
        if (this.propAngleMeasureVisibleEl) this.propAngleMeasureVisibleEl.checked = true;
        if (this.propAngleGreekEl) this.propAngleGreekEl.value = '';
        if (this.propNumberValueEl) this.propNumberValueEl.value = '';
        if (this.propNumberStepEl) this.propNumberStepEl.value = '';
        if (this.propNumberMinEl) this.propNumberMinEl.value = '';
        if (this.propNumberMaxEl) this.propNumberMaxEl.value = '';
        if (this.propAreaVisibleEl) this.propAreaVisibleEl.checked = false;
        if (this.propAreaColorEl) this.propAreaColorEl.value = '#ea580c';
        if (this.propAreaValueEl) this.propAreaValueEl.value = '';
        if (this.propViewAxesVisibleEl) this.propViewAxesVisibleEl.checked = true;
        if (this.propViewAxisWidthEl) this.propViewAxisWidthEl.value = '1.5';
        if (this.propViewAxisDarknessEl) this.propViewAxisDarknessEl.value = '0';
        if (this.propViewGridVisibleEl) this.propViewGridVisibleEl.checked = true;
        if (this.propViewGridWidthEl) this.propViewGridWidthEl.value = '1';
        if (this.propViewGridDarknessEl) this.propViewGridDarknessEl.value = '0';
        if (this.propViewXLabelsVisibleEl) this.propViewXLabelsVisibleEl.checked = false;
        if (this.propViewXStepEl) this.propViewXStepEl.value = '1';
        if (this.propViewYLabelsVisibleEl) this.propViewYLabelsVisibleEl.checked = false;
        if (this.propViewYStepEl) this.propViewYStepEl.value = '1';
        if (this.propViewGlobalFontSizeEl) this.propViewGlobalFontSizeEl.value = '14';
        if (this.propNotablesTitleEl) this.propNotablesTitleEl.textContent = 'Puntos notables';
        this.renderNotablePointEntries([]);
        return;
      }

      this.setPropertyRowVisible(this.propIdWrapEl, !state.isView);
      this.setPropertyRowVisible(this.propTypeWrapEl, !state.isView);
      this.setPropertyRowVisible(this.propColorWrapEl, !state.isPart && !state.isView);
      this.setPropertyRowVisible(this.propLabelWrapEl, state.labelEditable !== false);
      this.setPropertyRowVisible(this.propRefsWrapEl, !state.isView);
      this.setPropertyRowVisible(this.propVisibleWrapEl, !state.isView);
      this.setPropertyRowVisible(this.propExtraWrapEl, state.showExtra);
      this.setPropertyRowVisible(this.propParamWrapEl, state.showNumericParam);
      this.setPropertyRowVisible(this.propAngleWrapEl, state.isAngle);
      this.setPropertyRowVisible(this.propNumberWrapEl, state.isNumber);
      this.setPropertyRowVisible(this.propAreaWrapEl, state.hasArea);
      this.setPropertyRowVisible(this.propNotablesWrapEl, state.showNotables);
      this.setPropertyRowVisible(this.propViewWrapEl, state.isView);
      if (this.propIdEl) this.propIdEl.value = state.id;
      if (this.propTypeEl) this.propTypeEl.value = state.typeLabel;
      if (this.propColorEl) this.propColorEl.value = state.color;
      this.propLabelEl.value = state.label;
      if (this.propRefsEl) this.propRefsEl.value = state.refs;
      this.propVisibleEl.checked = state.visible;
      if (this.propExtraWrapEl && this.propExtraSelectEl) {
        this.setPropertyExtraConfig(state.extraLabel, state.extraOptions, state.extraValue);
        this.propExtraSelectEl.disabled = !state.showExtra;
      }
      if (this.propParamWrapEl) {
        const unlocked = state.numericParamUnlocked !== false;
        if (this.propParamTitleEl) this.propParamTitleEl.textContent = state.numericParamTitle || 'Parámetro';
        this.setPropertyRowVisible(this.propParamUnlockWrapEl, state.numericParamUnlockable);
        if (this.propParamUnlockEl) {
          this.propParamUnlockEl.checked = unlocked;
          this.propParamUnlockEl.disabled = !state.showNumericParam;
        }
        this.setPropertyRowVisible(this.propParamModeWrapEl, state.showNumericParam && unlocked);
        this.setPropertyRowVisible(this.propParamValueWrapEl, state.showNumericParam && unlocked && state.numericParamMode !== 'ref');
        this.setPropertyRowVisible(this.propParamRefWrapEl, state.showNumericParam && unlocked && state.numericParamMode === 'ref');
        if (this.propParamValueLabelEl) this.propParamValueLabelEl.textContent = state.numericParamValueLabel || 'Valor';
        if (this.propParamModeEl) {
          this.propParamModeEl.value = state.numericParamMode || 'value';
          this.propParamModeEl.disabled = !unlocked;
          const refOption = this.propParamModeEl.querySelector('option[value="ref"]');
          if (refOption) refOption.disabled = state.numericParamAllowRef === false || this.getNumberParameterOptions().length === 0;
        }
        if (this.propParamValueEl) {
          this.propParamValueEl.value = state.numericParamValue || '';
          this.propParamValueEl.disabled = !unlocked;
        }
        if (this.propParamRefEl) {
          this.propParamRefEl.innerHTML = this.getNumberParameterOptions().map(entry =>
            `<option value="${DomUtils.escapeHtml(entry.id)}">${DomUtils.escapeHtml(entry.label)}</option>`
          ).join('');
          this.propParamRefEl.value = state.numericParamRef || '';
          this.propParamRefEl.disabled = !unlocked || state.numericParamAllowRef === false;
        }
      }
      if (this.propAngleConcaveEl) {
        this.propAngleConcaveEl.disabled = !state.isAngle;
        this.propAngleConcaveEl.checked = state.angleConcave;
      }
      if (this.propAngleArmsVisibleEl) {
        this.propAngleArmsVisibleEl.disabled = !state.isAngle;
        this.propAngleArmsVisibleEl.checked = state.angleArmsVisible;
      }
      if (this.propAngleArcVisibleEl) {
        this.propAngleArcVisibleEl.disabled = !state.isAngle;
        this.propAngleArcVisibleEl.checked = state.angleArcVisible;
      }
      if (this.propAngleSectorVisibleEl) {
        this.propAngleSectorVisibleEl.disabled = !state.isAngle;
        this.propAngleSectorVisibleEl.checked = state.angleSectorVisible;
      }
      if (this.propAngleMeasureVisibleEl) {
        this.propAngleMeasureVisibleEl.disabled = !state.isAngle;
        this.propAngleMeasureVisibleEl.checked = state.angleMeasureVisible;
      }
      if (this.propAngleGreekEl) {
        this.propAngleGreekEl.disabled = !state.isAngle;
        this.propAngleGreekEl.value = state.angleGreekLabel;
      }
      if (this.propNumberValueEl) {
        this.propNumberValueEl.disabled = !state.isIndependentNumber;
        this.propNumberValueEl.value = state.numberValue;
      }
      if (this.propNumberStepWrapEl) {
        this.setPropertyRowVisible(this.propNumberStepWrapEl, state.isIndependentNumber);
      }
      if (this.propNumberMinWrapEl) {
        this.setPropertyRowVisible(this.propNumberMinWrapEl, state.isIndependentNumber);
      }
      if (this.propNumberMaxWrapEl) {
        this.setPropertyRowVisible(this.propNumberMaxWrapEl, state.isIndependentNumber);
      }
      if (this.propNumberStepEl) {
        this.propNumberStepEl.disabled = !state.isIndependentNumber;
        this.propNumberStepEl.value = state.numberStep;
      }
      if (this.propNumberMinEl) {
        this.propNumberMinEl.disabled = !state.isIndependentNumber;
        this.propNumberMinEl.value = state.numberMin;
      }
      if (this.propNumberMaxEl) {
        this.propNumberMaxEl.disabled = !state.isIndependentNumber;
        this.propNumberMaxEl.value = state.numberMax;
      }
      if (this.propNumberDecEl) this.propNumberDecEl.disabled = !state.isIndependentNumber;
      if (this.propNumberIncEl) this.propNumberIncEl.disabled = !state.isIndependentNumber;
      if (this.propAreaVisibleEl) {
        this.propAreaVisibleEl.disabled = !state.hasArea;
        this.propAreaVisibleEl.checked = state.areaVisible;
      }
      if (this.propAreaColorEl) {
        this.propAreaColorEl.disabled = !state.hasArea;
        this.propAreaColorEl.value = state.areaColor;
      }
      if (this.propAreaValueEl) this.propAreaValueEl.value = state.areaValue;
      if (this.propViewAxesVisibleEl) {
        this.propViewAxesVisibleEl.disabled = !state.isView;
        this.propViewAxesVisibleEl.checked = state.viewAxesVisible;
      }
      if (this.propViewAxisWidthEl) {
        this.propViewAxisWidthEl.disabled = !state.isView;
        this.propViewAxisWidthEl.value = state.viewAxisWidth;
      }
      if (this.propViewAxisDarknessEl) {
        this.propViewAxisDarknessEl.disabled = !state.isView;
        this.propViewAxisDarknessEl.value = state.viewAxisDarkness;
      }
      if (this.propViewGridVisibleEl) {
        this.propViewGridVisibleEl.disabled = !state.isView;
        this.propViewGridVisibleEl.checked = state.viewGridVisible;
      }
      if (this.propViewGridWidthEl) {
        this.propViewGridWidthEl.disabled = !state.isView;
        this.propViewGridWidthEl.value = state.viewGridWidth;
      }
      if (this.propViewGridDarknessEl) {
        this.propViewGridDarknessEl.disabled = !state.isView;
        this.propViewGridDarknessEl.value = state.viewGridDarkness;
      }
      if (this.propViewXLabelsVisibleEl) {
        this.propViewXLabelsVisibleEl.disabled = !state.isView;
        this.propViewXLabelsVisibleEl.checked = state.viewXLabelsVisible;
      }
      if (this.propViewXStepEl) {
        this.propViewXStepEl.disabled = !state.isView;
        this.propViewXStepEl.value = state.viewXStep;
      }
      if (this.propViewYLabelsVisibleEl) {
        this.propViewYLabelsVisibleEl.disabled = !state.isView;
        this.propViewYLabelsVisibleEl.checked = state.viewYLabelsVisible;
      }
      if (this.propViewYStepEl) {
        this.propViewYStepEl.disabled = !state.isView;
        this.propViewYStepEl.value = state.viewYStep;
      }
      if (this.propViewGlobalFontSizeEl) {
        this.propViewGlobalFontSizeEl.disabled = !state.isView;
        this.propViewGlobalFontSizeEl.value = state.viewGlobalFontSize;
      }
      if (this.propNotablesTitleEl) this.propNotablesTitleEl.textContent = state.notableTitle || 'Puntos notables';
      this.renderNotablePointEntries(state.showNotables ? state.notablePoints : []);
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
      const sceneText = serializeSceneForHtmlBlock(this.model.serializeConstruction());
      const mode = normalizeViewerMode(viewerMode);
      return `<div class="geo2d-viewer" id="${id}" data-geo2d-viewer data-viewer-mode="${mode}"><textarea data-geo2d-scene style="display:none;">${sceneText}</textarea></div>`;
    }

    activateTool(tool) {
      this.activeTool = tool;
      this.openToolGroup = getToolGroupForTool(tool);
      this.resetConstructionState();
      this.resetSelectionCycle();
      this.clearHoverAndPreview();
      if (tool === 'view') {
        this.selectObject(VIEW_OBJECT_ID, false);
        this.refreshUI();
        this.setStatus('Vista seleccionada.');
        return;
      }
      this.refreshUI();
      this.setStatus('Herramienta: ' + getEditorToolLabel(tool));
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
      const previousId = this.selectedObjectId;
      this.selectedObjectId = id && (this.model.hasId(id) || isViewObjectId(id)) ? id : null;
      this.selectedPart = null;
      if (this.selectedObjectId && this.selectedObjectId !== previousId) {
        if (this.rightPanelOpen) this.rightPanelOpen.properties = true;
      }
      this.refreshUI();
      if (render) this.render();
    }

    selectObjectPart(id, part = null, render = true) {
      const previousKey = this.getSelectionKey(this.selectedObjectId, this.selectedPart);
      this.selectedObjectId = id && (this.model.hasId(id) || isViewObjectId(id)) ? id : null;
      this.selectedPart = this.selectedObjectId ? this.normalizeSelectedPart(part) : null;
      if (this.isViewSelected()) this.selectedPart = null;
      const nextKey = this.getSelectionKey(this.selectedObjectId, this.selectedPart);
      if (nextKey && nextKey !== previousKey) {
        if (this.rightPanelOpen) this.rightPanelOpen.properties = true;
      }
      this.refreshUI();
      if (render) this.render();
    }

    getSelectedObject() {
      return this.selectedObjectId && !this.isViewSelected() ? this.model.getObject(this.selectedObjectId) : null;
    }

    isViewSelected() {
      return isViewObjectId(this.selectedObjectId);
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
        GeoMath.dist2(sx, sy, this._lastHitSx, this._lastHitSy) < 36;
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

      this._dragInfo = {
        objectId,
        pointerId: e?.pointerId,
        ellipseAdjustments: this.getEllipseDragAdjustmentsForPoint(objectId)
      };
      this._labelDragInfo = null;
      this._viewDragInfo = null;
      this.selectObject(objectId, false);
      this.capturePointer(e);
      return true;
    }

    startLabelDrag(objectId, info, e) {
      const obj = this.model.getObject(objectId);
      if (!obj) return false;

      this._labelDragInfo = {
        objectId,
        pointerId: e?.pointerId,
        startSx: info?.sx,
        startSy: info?.sy,
        originalOffset: getStoredLabelOffset(obj.raw)
      };
      this._dragInfo = null;
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
      this._labelDragInfo = null;
      this.capturePointer(e);
    }

    handleMovePointerDown(info, e) {
      const labelHit = this.findDraggableLabelAtScreen(info.sx, info.sy);
      if (labelHit && this.startLabelDrag(labelHit.id, info, e)) return;

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

    handleLabelDragPointerMove(info) {
      if (!this._labelDragInfo) return false;

      const obj = this.model.getObject(this._labelDragInfo.objectId);
      if (obj) {
        const dx = safeNumber(info?.sx, this._labelDragInfo.startSx) - safeNumber(this._labelDragInfo.startSx, 0);
        const dy = safeNumber(info?.sy, this._labelDragInfo.startSy) - safeNumber(this._labelDragInfo.startSy, 0);
        obj.raw.labelOffset = {
          x: Math.round(this._labelDragInfo.originalOffset.x + dx),
          y: Math.round(this._labelDragInfo.originalOffset.y + dy)
        };
        this.renderDuringInteraction();
      }

      return true;
    }

    handleObjectDragPointerMove(info) {
      if (!this._dragInfo) return false;

      const obj = this.model.getObject(this._dragInfo.objectId);
      if (obj?.isDraggable()) {
        obj.dragTo(this.model, info.world.x, info.world.y);
        this.applyEllipseDragAdjustments(this._dragInfo.ellipseAdjustments);
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

    getEllipseDragAdjustmentsForPoint(pointId) {
      const id = String(pointId || '').trim();
      if (!id) return [];

      const adjustments = [];
      for (const obj of this.model.objects) {
        if (InternalObjectAdapter.type(obj) !== 'ellipse') continue;

        const raw = obj.raw;
        const role = raw.center === id
          ? 'center'
          : raw.vertex === id
            ? 'vertex'
            : raw.coVertex === id
              ? 'coVertex'
              : null;
        if (!role) continue;

        const center = this.model.getPointPosition(raw.center);
        const vertex = this.model.getPointPosition(raw.vertex);
        const coVertex = this.model.getPointPosition(raw.coVertex);
        if (!center || !vertex || !coVertex) continue;

        const vertexRadius = GeoMath.dist(center.x, center.y, vertex.x, vertex.y);
        const coVertexRadius = GeoMath.dist(center.x, center.y, coVertex.x, coVertex.y);
        if (!(vertexRadius > 1e-9) || !(coVertexRadius > 1e-9)) continue;

        adjustments.push({
          ellipseId: obj.id,
          role,
          centerId: raw.center,
          vertexId: raw.vertex,
          coVertexId: raw.coVertex,
          initialCenter: { x: center.x, y: center.y },
          initialVertex: { x: vertex.x, y: vertex.y },
          initialCoVertex: { x: coVertex.x, y: coVertex.y },
          vertexRadius,
          coVertexRadius,
          orientation: ellipseAxisOrientationSign(center, vertex, coVertex)
        });
      }

      return adjustments;
    }

    moveFreePointRaw(pointId, point) {
      if (!point) return false;
      const obj = this.model.getObject(pointId);
      if (!obj?.isPointLike?.()) return false;
      if (InternalObjectAdapter.type(obj) !== 'point' || obj.raw.constraint) return false;
      if (!obj.isDraggable()) return false;

      obj.raw.x = point.x;
      obj.raw.y = point.y;
      return true;
    }

    applyEllipseDragAdjustments(adjustments = []) {
      if (!Array.isArray(adjustments) || !adjustments.length) return false;

      let changed = false;

      for (const adjustment of adjustments) {
        if (adjustment.role !== 'center') continue;

        const center = this.model.getPointPosition(adjustment.centerId);
        if (!center || !adjustment.initialCenter || !adjustment.initialVertex || !adjustment.initialCoVertex) continue;

        const dx = center.x - adjustment.initialCenter.x;
        const dy = center.y - adjustment.initialCenter.y;
        changed = this.moveFreePointRaw(adjustment.vertexId, {
          x: adjustment.initialVertex.x + dx,
          y: adjustment.initialVertex.y + dy
        }) || changed;
        changed = this.moveFreePointRaw(adjustment.coVertexId, {
          x: adjustment.initialCoVertex.x + dx,
          y: adjustment.initialCoVertex.y + dy
        }) || changed;
      }

      for (const adjustment of adjustments) {
        if (adjustment.role === 'center') continue;

        const center = this.model.getPointPosition(adjustment.centerId);
        if (!center) continue;

        if (adjustment.role === 'vertex') {
          const vertex = this.model.getPointPosition(adjustment.vertexId);
          const nextCoVertex = perpendicularCoVertexForAxis(center, vertex, adjustment.coVertexRadius, adjustment.orientation);
          changed = this.moveFreePointRaw(adjustment.coVertexId, nextCoVertex) || changed;
          continue;
        }

        if (adjustment.role === 'coVertex') {
          const coVertex = this.model.getPointPosition(adjustment.coVertexId);
          const nextVertex = perpendicularVertexForCoAxis(center, coVertex, adjustment.vertexRadius, adjustment.orientation);
          changed = this.moveFreePointRaw(adjustment.vertexId, nextVertex) || changed;
        }
      }

      return changed;
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
      const hadInteraction = !!(this._dragInfo || this._labelDragInfo || this._viewDragInfo);
      if (!hadInteraction) return false;

      this._dragInfo = null;
      this._labelDragInfo = null;
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
          if (ids.has(obj.id)) {
            const raw = InternalObjectAdapter.raw(obj);
            if (Array.isArray(raw?.imagePoints)) {
              for (const pointId of raw.imagePoints) {
                if (pointId && !ids.has(pointId)) {
                  ids.add(pointId);
                  changed = true;
                }
              }
            }
            continue;
          }
          const refs = InternalObjectAdapter.refs(obj);
          const rawType = InternalObjectAdapter.type(obj);
          const hasRegularPolygonVertexMembership =
            rawType === 'regular-polygon' &&
            Array.isArray(obj.raw.points) &&
            obj.raw.points.some(pointId => ids.has(pointId));
          if (refs.some(refId => ids.has(refId)) || hasRegularPolygonVertexMembership) {
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
      if (this.isViewerLocked()) {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        return;
      }

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
      if (this.isViewerLocked()) {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        return;
      }
      const info = this.getSvgPointerInfo(e);

      if (this.handleLabelDragPointerMove(info)) {
        e?.preventDefault?.();
        return;
      }

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
      if (this.isViewerLocked()) {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        return;
      }
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
    findDraggableLabelAtScreen(sx, sy) { return this.hitTester.draggableLabelAtScreen(sx, sy); }
    findNearestAnchorObjectAtScreen(sx, sy, world) { return this.hitTester.nearestAnchorObjectAtScreen(sx, sy, world); }
    findNearestDirectionalObjectAtScreen(sx, sy) { return this.hitTester.nearestDirectionalObjectAtScreen(sx, sy); }
    findNearestVectorAtScreen(sx, sy) { return this.hitTester.nearestVectorAtScreen(sx, sy); }
    findNearestIntersectableObjectAtScreen(sx, sy, excludeId = null) { return this.hitTester.nearestIntersectableObjectAtScreen(sx, sy, excludeId); }
    findNearestTransformableObjectAtScreen(sx, sy) { return this.hitTester.nearestTransformableObjectAtScreen(sx, sy); }
    getHoveredObjectForTool(sx, sy) { return this.hitTester.hoveredObjectForTool(sx, sy); }

    getNumberParameterOptions() {
      return this.model.objects
        .filter(obj => InternalObjectAdapter.type(obj) === 'number')
        .map(obj => {
          const value = this.model.getNumberValue(obj.id);
          const labelValue = Number.isFinite(value) ? ` = ${formatNumberShort(value)}` : '';
          return {
            id: obj.id,
            label: `${obj.id}${labelValue}`,
            value
          };
        });
    }

    openNumberParameterDialog(config = {}) {
      if (!this.root || this.mode === 'viewer') return Promise.resolve(null);

      const numbers = this.getNumberParameterOptions();
      const title = String(config.title || 'Parametro numerico');
      const valueLabel = String(config.valueLabel || 'Valor');
      const variableLabel = String(config.variableLabel || 'Variable');
      const defaultValue = String(config.defaultValue ?? '1');
      const validateValue = typeof config.validateValue === 'function'
        ? config.validateValue
        : value => Number.isFinite(value);
      const refModeAvailable = numbers.length > 0;

      return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'geo2d-modal-backdrop';
        backdrop.style.setProperty('display', 'flex', 'important');

        const variableOptions = numbers.map(entry => `
          <option value="${DomUtils.escapeHtml(entry.id)}">${DomUtils.escapeHtml(entry.label)}</option>
        `).join('');

        backdrop.innerHTML = `
          <div class="geo2d-modal" role="dialog" aria-modal="true">
            <div class="geo2d-modal-head">${DomUtils.escapeHtml(title)}</div>
            <div class="geo2d-param-body">
              <div class="geo2d-param-mode">
                <label class="geo2d-param-choice">
                  <input type="radio" name="geo2d-param-mode" value="value" checked>
                  <span>Numero directo</span>
                </label>
                <label class="geo2d-param-choice">
                  <input type="radio" name="geo2d-param-mode" value="ref"${refModeAvailable ? '' : ' disabled'}>
                  <span>${DomUtils.escapeHtml(variableLabel)}</span>
                </label>
              </div>
              <label class="geo2d-param-field" data-param-field="value">
                <span>${DomUtils.escapeHtml(valueLabel)}</span>
                <input class="geo2d-param-value" type="number" step="any" value="${DomUtils.escapeHtml(defaultValue)}">
              </label>
              <label class="geo2d-param-field" data-param-field="ref">
                <span>Numero existente</span>
                <select class="geo2d-param-ref"${refModeAvailable ? '' : ' disabled'}>
                  ${refModeAvailable ? variableOptions : '<option value="">Sin numeros existentes</option>'}
                </select>
              </label>
            </div>
            <div class="geo2d-modal-foot">
              <button type="button" class="geo2d-btn" data-param-action="ok">Aceptar</button>
              <button type="button" class="geo2d-btn" data-param-action="cancel">Cancelar</button>
            </div>
          </div>
        `;

        const cleanup = value => {
          backdrop.remove();
          resolve(value);
        };
        const valueInput = backdrop.querySelector('.geo2d-param-value');
        const refSelect = backdrop.querySelector('.geo2d-param-ref');
        const modeInputs = Array.from(backdrop.querySelectorAll('input[name="geo2d-param-mode"]'));
        const valueField = backdrop.querySelector('[data-param-field="value"]');
        const refField = backdrop.querySelector('[data-param-field="ref"]');

        const getMode = () => modeInputs.find(input => input.checked)?.value || 'value';
        const refreshMode = () => {
          const mode = getMode();
          valueField.style.setProperty('display', mode === 'value' ? 'grid' : 'none', 'important');
          refField.style.setProperty('display', mode === 'ref' ? 'grid' : 'none', 'important');
        };

        modeInputs.forEach(input => input.addEventListener('change', refreshMode));
        backdrop.addEventListener('click', e => {
          const action = e.target.closest('[data-param-action]')?.dataset.paramAction;
          if (!action) return;
          if (action === 'cancel') {
            cleanup(null);
            return;
          }
          if (getMode() === 'ref') {
            const refId = String(refSelect?.value || '').trim();
            cleanup(refId ? { mode: 'ref', refId } : null);
            return;
          }
          const value = safeNumber(String(valueInput?.value ?? '').replace(',', '.'), NaN);
          if (!validateValue(value)) {
            this.setStatus(config.errorMessage || 'Valor numerico invalido.', true);
            valueInput?.focus?.();
            return;
          }
          cleanup({ mode: 'value', value });
        });
        backdrop.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(null);
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            backdrop.querySelector('[data-param-action="ok"]')?.click();
          }
        });

        this.root.appendChild(backdrop);
        refreshMode();
        valueInput?.focus?.();
        valueInput?.select?.();
      });
    }

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
      if (Object.prototype.hasOwnProperty.call(nextState, 'previewWorld') && !GeoMath.sameWorld(this._previewWorld, nextState.previewWorld)) {
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

    addRegularPolygonDerivedPoint(polygonId, index, id = null, sync = true, options = {}) {
      return this.addConstrainedPoint({ kind: 'regular-polygon-vertex', objectId: polygonId, index }, sync, {
        id: id || this.generatePointName(),
        draggable: false,
        visible: options.visible !== false,
        style: { fill: DEPENDENT_POINT_FILL }
      });
    }

    addBisectorDerivedPoint(bisectorId, t = 1, id = null, sync = true, options = {}) {
      return this.addConstrainedPoint({ kind: 'on-ray', objectId: bisectorId, t }, sync, {
        id: id || this.generateAuxiliaryPointName('P'),
        draggable: true,
        visible: options.visible !== false,
        style: { fill: DEPENDENT_POINT_FILL }
      });
    }

    addAngleTerminalPoint(angleId, id = null, sync = true, options = {}) {
      return this.addConstrainedPoint({ kind: 'angle-terminal-point', objectId: angleId }, sync, {
        id: id || this.generateAuxiliaryPointName('P'),
        draggable: false,
        visible: options.visible !== false,
        style: { fill: DEPENDENT_POINT_FILL }
      });
    }

    addImageOfObject(objectId, transformId, sync = true, options = {}) {
      const source = this.model.getObject(objectId);
      if (!source) return null;
      const sourceType = InternalObjectAdapter.type(source);
      const isPointImage = isPointLikeRawType(sourceType);
      const id = options.id || this.nextId('img');
      const createdIds = [];
      const imageObj = this.model.addObject({
        id,
        type: isPointImage ? 'image-point' : 'image-object',
        objectId,
        transformId,
        sourceKind: sourceType,
        ...(!isPointImage ? { imagePoints: [] } : {}),
        label: options.label !== undefined ? String(options.label) : id,
        draggable: false,
        style: options.style ? deepClone(options.style) : {
          stroke: '#16a34a',
          fill: isPointImage ? DEPENDENT_POINT_FILL : 'rgba(22,163,74,0.12)'
        }
      });
      createdIds.push(id);

      if (!isPointImage) {
        const reserved = new Set([id]);
        for (const pointId of getDefiningPointIdsForRaw(source.raw)) {
          const imagePointId = this.generateAuxiliaryPointName(`${pointId}i`, reserved);
          reserved.add(imagePointId);
          this.model.addObject({
            id: imagePointId,
            type: 'image-point',
            objectId: pointId,
            transformId,
            sourceKind: 'point',
            label: imagePointId,
            draggable: false,
            style: { fill: DEPENDENT_POINT_FILL }
          });
          createdIds.push(imagePointId);
          if (Array.isArray(imageObj.raw.imagePoints)) imageObj.raw.imagePoints.push(imagePointId);
        }
      }

      if (sync) this.renderAndSync();
      return options.returnAll === true ? createdIds : id;
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

    dispatchConstructionToolClick(world, sx, sy) { return this.construction.dispatchClick(world, sx, sy); }
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeBuilderId(id, fieldName = 'id') {
    const cleanId = String(id || '').trim();
    if (!cleanId) throw new Error(`Geo2D.Builder requiere ${fieldName}.`);
    return cleanId;
  }

  function normalizeBuilderRef(refId, fieldName) {
    return normalizeBuilderId(refId, fieldName);
  }

  function normalizeBuilderPointArgs(xOrOptions, y, options = {}) {
    if (isPlainObject(xOrOptions)) {
      const config = { ...xOrOptions };
      const x = safeNumber(config.x, NaN);
      const yValue = safeNumber(config.y, NaN);
      delete config.x;
      delete config.y;
      return { x, y: yValue, options: config };
    }

    return {
      x: safeNumber(xOrOptions, NaN),
      y: safeNumber(y, NaN),
      options: isPlainObject(options) ? { ...options } : {}
    };
  }

  function normalizeBuilderTextArgs(xOrOptions, y, text, options = {}) {
    if (isPlainObject(xOrOptions)) {
      const config = { ...xOrOptions };
      const x = safeNumber(config.x, NaN);
      const yValue = safeNumber(config.y, NaN);
      const textValue = String(config.text ?? '');
      delete config.x;
      delete config.y;
      delete config.text;
      return { x, y: yValue, text: textValue, options: config };
    }

    return {
      x: safeNumber(xOrOptions, NaN),
      y: safeNumber(y, NaN),
      text: String(text ?? ''),
      options: isPlainObject(options) ? { ...options } : {}
    };
  }

  function normalizeBuilderPointList(pointsOrOptions) {
    const points = Array.isArray(pointsOrOptions)
      ? pointsOrOptions
      : Array.isArray(pointsOrOptions?.points)
        ? pointsOrOptions.points
        : null;
    if (!points) throw new Error('Geo2D.Builder requiere una lista de puntos.');
    return points.map((refId, index) => normalizeBuilderRef(refId, `points[${index}]`));
  }

  function normalizeBuilderAngleUnit(value, fallback = 'deg') {
    const cleanValue = String(value ?? fallback).trim().toLowerCase();
    return cleanValue === 'rad' ? 'rad' : 'deg';
  }

  function normalizeBuilderIntersectionSelect(value) {
    const normalized = normalizeIntersectionSelect(value, null);
    if (!normalized) return null;
    return {
      by: normalized.by,
      point: normalizeBuilderRef(normalized.point, 'select.point')
    };
  }

  const REGULAR_POLYGON_ORIENTATION_PRESETS = Object.freeze({
    'vertex-right': { mode: 'vertex', angleRad: 0 },
    'vertex-up': { mode: 'vertex', angleRad: Math.PI / 2 },
    'vertex-left': { mode: 'vertex', angleRad: Math.PI },
    'vertex-down': { mode: 'vertex', angleRad: -Math.PI / 2 },
    'side-right': { mode: 'side', angleRad: 0 },
    'side-up': { mode: 'side', angleRad: Math.PI / 2 },
    'side-left': { mode: 'side', angleRad: Math.PI },
    'side-down': { mode: 'side', angleRad: -Math.PI / 2 }
  });

  function normalizeRegularPolygonOrientationMode(value, fallback = 'vertex') {
    const cleanValue = String(value ?? fallback).trim().toLowerCase();
    if (!cleanValue) return fallback;
    if (cleanValue === 'vertex' || cleanValue === 'side') return cleanValue;
    throw new Error('Geo2D.Builder requiere orientationMode "vertex" o "side".');
  }

  function normalizeRegularPolygonOrientationPreset(value) {
    const cleanValue = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    const preset = REGULAR_POLYGON_ORIENTATION_PRESETS[cleanValue];
    if (!preset) {
      throw new Error(`Geo2D.Builder no reconoce la orientación "${value}".`);
    }
    return preset;
  }

  function resolveRegularPolygonBuilderOrientation(options = {}, sides = 0) {
    const hasPreset = options.orientation !== undefined && String(options.orientation || '').trim();
    const hasAngle = options.orientationAngle !== undefined;
    const hasMode = options.orientationMode !== undefined;
    const hasUnit = options.unit !== undefined;
    const oriented = !!hasPreset || hasAngle || hasMode;
    if (!oriented) return null;

    if (hasPreset && (hasAngle || hasMode || hasUnit)) {
      throw new Error('Geo2D.Builder no puede mezclar orientation con orientationMode/orientationAngle/unit.');
    }

    if (hasPreset) {
      const preset = normalizeRegularPolygonOrientationPreset(options.orientation);
      return preset.mode === 'side'
        ? preset.angleRad - (Math.PI / Math.max(1, sides))
        : preset.angleRad;
    }

    const mode = normalizeRegularPolygonOrientationMode(options.orientationMode, 'vertex');
    const unit = normalizeBuilderAngleUnit(options.unit, 'deg');
    const angleValue = safeNumber(options.orientationAngle !== undefined ? options.orientationAngle : 0, NaN);
    if (!Number.isFinite(angleValue)) {
      throw new Error('Geo2D.Builder requiere orientationAngle válido para el polígono regular orientado.');
    }
    const angleRad = unit === 'rad' ? angleValue : (angleValue * Math.PI) / 180;
    return mode === 'side'
      ? angleRad - (Math.PI / Math.max(1, sides))
      : angleRad;
  }

  function applyBuilderPresentation(raw, options = {}, defaults = {}) {
    const out = deepClone(raw);
    const presentation = isPlainObject(options) ? options : {};
    const label = presentation.label !== undefined ? presentation.label : defaults.label;
    const labelPosition = presentation.labelPosition !== undefined ? presentation.labelPosition : defaults.labelPosition;
    const labelOffset = isPlainObject(presentation.labelOffset) ? presentation.labelOffset : defaults.labelOffset;
    const visible = presentation.visible !== undefined ? !!presentation.visible : defaults.visible;
    const draggable = presentation.draggable !== undefined ? !!presentation.draggable : defaults.draggable;
    const style = isPlainObject(presentation.style) ? presentation.style : defaults.style;
    const parts = isPlainObject(presentation.parts) ? presentation.parts : defaults.parts;

    if (label !== undefined && label !== null && label !== false && String(label).trim()) {
      out.label = String(label).trim();
    }
    if (labelPosition !== undefined && labelPosition !== null && String(labelPosition).trim()) {
      out.labelPosition = String(labelPosition).trim();
    }
    if (isPlainObject(labelOffset)) {
      out.labelOffset = {
        x: safeNumber(labelOffset.x, 0),
        y: safeNumber(labelOffset.y, 0)
      };
    }
    if (visible === false) out.visible = false;
    if (visible === true && out.visible !== undefined) delete out.visible;
    if (draggable !== undefined) out.draggable = !!draggable;
    if (style && Object.keys(style).length) out.style = deepClone(style);
    if (parts && Object.keys(parts).length) out.parts = deepClone(parts);
    return out;
  }

  const BUILDER_REF_STRING_KEYS = new Set([
    'p1',
    'p2',
    'origin',
    'through',
    'center',
    'vertex',
    'coVertex',
    'point',
    'vectorId',
    'radiusRef',
    'objectId',
    'objectId2',
    'ellipseId',
    'polygonId',
    'transform',
    'transformId',
    'vector',
    'axis',
    'angleRef'
  ]);
  const BUILDER_REF_ARRAY_KEYS = new Set(['points', 'of']);

  function inferBuilderAutoIdPrefix(id, fallback = 'o') {
    const cleanId = String(id || '').trim();
    const alphaPrefix = cleanId.match(/^[A-Za-z]+/);
    if (alphaPrefix?.[0]) return alphaPrefix[0];
    const trimmed = cleanId.replace(/\d+$/, '');
    return trimmed || fallback;
  }

  function renameBuilderRefValue(value, oldId, newId) {
    return String(value || '').trim() === oldId ? newId : value;
  }

  function renameBuilderRefsInDef(def, oldId, newId) {
    if (!def || typeof def !== 'object') return;

    Object.keys(def).forEach(key => {
      const value = def[key];

      if (BUILDER_REF_STRING_KEYS.has(key) && typeof value === 'string') {
        def[key] = renameBuilderRefValue(value, oldId, newId);
        return;
      }

      if (BUILDER_REF_ARRAY_KEYS.has(key) && Array.isArray(value)) {
        def[key] = value.map(item => (typeof item === 'string' ? renameBuilderRefValue(item, oldId, newId) : item));
        return;
      }

      if (key === 'derivedPoints' && isPlainObject(value)) {
        Object.keys(value).forEach(role => {
          if (typeof value[role] === 'string') {
            value[role] = renameBuilderRefValue(value[role], oldId, newId);
          }
        });
        return;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        renameBuilderRefsInDef(value, oldId, newId);
      }
    });
  }

  function defaultConstructionScene() {
    return serializeConstructionScene(defaultScene());
  }

  function getDefiningPointIdsForConstruction(raw) {
    const kind = String(raw?.kind || '').trim();
    const defKind = String(raw?.def?.kind || '').trim();
    const def = raw?.def || {};

    if (kind === 'point') return uniqueObjectIds([raw.id]);
    if (kind === 'segment' || kind === 'vector') return uniqueObjectIds([def.p1, def.p2]);
    if (kind === 'line' && defKind === 'through-two-points') return uniqueObjectIds([def.p1, def.p2]);
    if (kind === 'ray' && defKind === 'from-point-through-point') return uniqueObjectIds([def.origin, def.through]);
    if (kind === 'circle' && defKind === 'center-through-point') return uniqueObjectIds([def.center, def.through]);
    if (kind === 'circle' && defKind === 'center-radius') return uniqueObjectIds([def.center]);
    if (kind === 'polygon' && defKind === 'through-points') return uniqueObjectIds(def.points);
    if (kind === 'polygon' && (defKind === 'regular-center-vertex' || defKind === 'regular-center-radius')) {
      return uniqueObjectIds([def.center, def.vertex, ...(Array.isArray(def.points) ? def.points : [])]);
    }
    return [];
  }

  /* =========================================================
     API BUILDER (Geo2D.Builder)
     Interfaz fluida (chaining) para construir escenas
     programáticamente en código de forma encadenada y limpia.
     ========================================================= */
  class Geo2DBuilder {
    constructor(options = {}) {
      this.__geo2dBuilder = true;
      this._scene = defaultConstructionScene();
      this._scene.meta = { ...(this._scene.meta || {}) };
      this._scene.view = { ...(this._scene.view || {}) };
      this._scene.style = { ...(this._scene.style || {}) };
      this._scene.objects = [];

      if (isPlainObject(options.meta)) this.meta(options.meta);
      if (options.title !== undefined) this.title(options.title);
      if (isPlainObject(options.view)) this.view(options.view);
      if (isPlainObject(options.style)) this.style(options.style);
    }

    static scene(options = {}) {
      return new Geo2DBuilder(options);
    }

    title(value) {
      this._scene.meta.title = String(value || 'Escena Geo2D');
      return this;
    }

    meta(options = {}) {
      if (!isPlainObject(options)) return this;
      this._scene.meta = { ...this._scene.meta, ...deepClone(options) };
      return this;
    }

    view(options = {}) {
      if (!isPlainObject(options)) return this;
      this._scene.view = { ...this._scene.view, ...deepClone(options) };
      return this;
    }

    style(options = {}) {
      if (!isPlainObject(options)) return this;
      this._scene.style = { ...this._scene.style, ...deepClone(options) };
      return this;
    }

    hasId(id) {
      const cleanId = String(id || '').trim();
      return !!cleanId && this._scene.objects.some(obj => obj.id === cleanId);
    }

    getObject(id) {
      const cleanId = String(id || '').trim();
      return this._scene.objects.find(obj => obj.id === cleanId) || null;
    }

    requireAvailableId(id, fieldName = 'id') {
      const cleanId = normalizeBuilderId(id, fieldName);
      if (this.hasId(cleanId)) {
        throw new Error(`Geo2D.Builder encontró un id duplicado: "${cleanId}".`);
      }
      return cleanId;
    }

    nextAvailableId(prefix = 'o', reserved = [], options = {}) {
      const rawBase = String(prefix || 'o').trim() || 'o';
      const base = options.uppercase === true ? rawBase.toUpperCase() : rawBase;
      const reservedSet = new Set(
        (Array.isArray(reserved) ? reserved : [reserved])
          .map(value => String(value || '').trim())
          .filter(Boolean)
      );
      for (let i = 1; i < 1000000; i++) {
        const id = `${base}${i}`;
        if (!this.hasId(id) && !reservedSet.has(id)) return id;
      }
      throw new Error('Geo2D.Builder no pudo generar un id auxiliar libre.');
    }

    nextPointId(prefix = 'P', reserved = []) {
      return this.nextAvailableId(prefix, reserved, { uppercase: true });
    }

    nextSiblingId(sourceId, reserved = []) {
      return this.nextAvailableId(inferBuilderAutoIdPrefix(sourceId, 'o'), reserved);
    }

    renameObjectId(oldId, newId, options = {}) {
      const fromId = normalizeBuilderId(oldId, 'oldId');
      const toId = normalizeBuilderId(newId, 'newId');
      if (fromId === toId) return toId;

      const target = this.getObject(fromId);
      if (!target) throw new Error(`Geo2D.Builder no encontró "${fromId}" para renombrar.`);
      if (this.hasId(toId)) throw new Error(`Geo2D.Builder no puede renombrar "${fromId}" a "${toId}" porque ya existe.`);

      for (const obj of this._scene.objects) {
        if (obj.id === fromId) obj.id = toId;
        if (options.syncLabel !== false && String(obj.label || '').trim() === fromId) {
          obj.label = toId;
        }
        if (isPlainObject(obj.def)) renameBuilderRefsInDef(obj.def, fromId, toId);
      }

      return toId;
    }

    claimAutoRenameId(preferredId, options = {}) {
      const desiredId = normalizeBuilderId(preferredId, options.fieldName || 'rename');
      const reserved = new Set(
        (Array.isArray(options.reserved) ? options.reserved : [options.reserved])
          .map(value => String(value || '').trim())
          .filter(Boolean)
      );
      reserved.add(desiredId);

      if (this.hasId(desiredId)) {
        const displacedId = this.nextSiblingId(desiredId, Array.from(reserved));
        this.renameObjectId(desiredId, displacedId, { syncLabel: true });
      }

      return desiredId;
    }

    pushObject(raw) {
      const out = deepClone(raw);
      out.id = this.requireAvailableId(out.id);
      this._scene.objects.push(out);
      return out;
    }

    setVisibility(value, ids = []) {
      const visible = !!value;
      const list = Array.isArray(ids) ? ids : [ids];
      for (const id of list) {
        const obj = this.getObject(id);
        if (!obj) throw new Error(`Geo2D.Builder no encontró "${id}".`);
        if (visible) delete obj.visible;
        else obj.visible = false;
      }
      return this;
    }

    show(...ids) {
      return this.setVisibility(true, ids.flat());
    }

    hide(...ids) {
      return this.setVisibility(false, ids.flat());
    }

    label(id, value) {
      const obj = this.getObject(id);
      if (!obj) throw new Error(`Geo2D.Builder no encontró "${id}".`);
      const text = String(value ?? '').trim();
      if (!text) delete obj.label;
      else obj.label = text;
      return this;
    }

    addPointObject(id, def, options = {}, defaults = {}) {
      this.pushObject(applyBuilderPresentation({
        id,
        kind: 'point',
        def
      }, options, defaults));
      return this;
    }

    point(id, xOrOptions, y, options = {}) {
      const pointId = this.requireAvailableId(id);
      const normalized = normalizeBuilderPointArgs(xOrOptions, y, options);
      if (!Number.isFinite(normalized.x) || !Number.isFinite(normalized.y)) {
        throw new Error(`Geo2D.Builder requiere coordenadas válidas para "${pointId}".`);
      }

      return this.addPointObject(pointId, {
        kind: 'free',
        x: normalized.x,
        y: normalized.y
      }, normalized.options, { label: pointId, draggable: true });
    }

    pointOn(id, options = {}) {
      const pointId = this.requireAvailableId(id);
      const objectId = normalizeBuilderRef(options.objectId, 'objectId');
      const mode = String(options.mode || options.paramMode || 't').trim();
      const value = safeNumber(
        options.value !== undefined ? options.value : options.param,
        0
      );
      const def = {
        kind: 'on-object',
        objectId,
        param: {
          mode: mode === 'angle' ? 'angle' : 't',
          value
        }
      };
      copyOptionalEdgeIndex(options, def);
      return this.addPointObject(pointId, def, options, { label: pointId, draggable: true });
    }

    midpoint(id, options = {}) {
      const pointId = this.requireAvailableId(id);
      return this.addPointObject(pointId, {
        kind: 'midpoint',
        p1: normalizeBuilderRef(options.p1, 'p1'),
        p2: normalizeBuilderRef(options.p2, 'p2')
      }, options, { label: pointId, draggable: false });
    }

    number(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const config = isPlainObject(options) ? options : {};
      const rawKind = String(
        config.kind
        || config.measure
        || (
          config.objectId !== undefined ? 'area'
          : config.vertex !== undefined || (Array.isArray(config.of) && config.of.length === 3) ? 'angle'
          : config.p1 !== undefined || config.p2 !== undefined || (Array.isArray(config.of) && config.of.length === 2) ? 'distance'
          : 'independent'
        )
      ).trim().toLowerCase();

      if (rawKind === 'independent') {
        const def = {
          kind: 'independent',
          value: safeNumber(config.value, 1),
          step: safeNumber(config.step, 1)
        };
        if (Number.isFinite(safeNumber(config.min, NaN))) def.min = safeNumber(config.min, NaN);
        if (Number.isFinite(safeNumber(config.max, NaN))) def.max = safeNumber(config.max, NaN);
        this.pushObject(applyBuilderPresentation({
          id: objectId,
          kind: 'number',
          def
        }, config, { label: objectId }));
        return this;
      }

      if (rawKind === 'distance') {
        const of = Array.isArray(config.of) ? config.of : [config.p1, config.p2];
        this.pushObject(applyBuilderPresentation({
          id: objectId,
          kind: 'number',
          def: {
            kind: 'distance',
            p1: normalizeBuilderRef(of[0], 'p1'),
            p2: normalizeBuilderRef(of[1], 'p2')
          }
        }, config, { label: objectId }));
        return this;
      }

      if (rawKind === 'angle') {
        const of = Array.isArray(config.of) ? config.of : [config.p1, config.vertex, config.p2];
        this.pushObject(applyBuilderPresentation({
          id: objectId,
          kind: 'number',
          def: {
            kind: 'angle',
            p1: normalizeBuilderRef(of[0], 'p1'),
            vertex: normalizeBuilderRef(of[1], 'vertex'),
            p2: normalizeBuilderRef(of[2], 'p2'),
            mode: config.concave === true ? 'concave' : 'normal',
            unit: normalizeBuilderAngleUnit(config.unit, 'deg')
          }
        }, config, { label: objectId }));
        return this;
      }

      if (rawKind === 'area') {
        this.pushObject(applyBuilderPresentation({
          id: objectId,
          kind: 'number',
          def: {
            kind: 'area',
            objectId: normalizeBuilderRef(config.objectId, 'objectId')
          }
        }, config, { label: objectId }));
        return this;
      }

      throw new Error(`Geo2D.Builder no soporta el tipo de número "${rawKind}".`);
    }

    intersection(id, options = {}) {
      const pointId = this.requireAvailableId(id);
      const hintX = safeNumber(options.x ?? options.hint?.x, NaN);
      const hintY = safeNumber(options.y ?? options.hint?.y, NaN);
      const select = normalizeBuilderIntersectionSelect(options.select);
      const def = {
        kind: 'intersection',
        objectId: normalizeBuilderRef(options.objectId, 'objectId'),
        objectId2: normalizeBuilderRef(options.objectId2, 'objectId2')
      };
      if (select) def.select = select;
      if (Number.isFinite(hintX) && Number.isFinite(hintY)) {
        def.hint = {
          x: hintX,
          y: hintY
        };
      }
      copyOptionalEdgeIndex(options, def);
      copyOptionalEdgeIndex(options, def, 'edgeIndex2', 'edgeIndex2');
      return this.addPointObject(pointId, def, options, { label: pointId, draggable: false });
    }

    vectorEndPoint(id, vectorId, options = {}) {
      const pointId = this.requireAvailableId(id);
      return this.addPointObject(pointId, {
        kind: 'vector-end',
        vectorId: normalizeBuilderRef(vectorId, 'vectorId')
      }, options, { label: pointId, draggable: false });
    }

    ellipseDerivedPoint(id, options = {}) {
      const pointId = this.requireAvailableId(id);
      return this.addPointObject(pointId, {
        kind: 'ellipse-derived-point',
        ellipseId: normalizeBuilderRef(options.ellipseId, 'ellipseId'),
        role: String(options.role || '').trim()
      }, options, { label: pointId, draggable: false, visible: false });
    }

    addTwoPointObject(id, kind, defKind, refs, options = {}) {
      const objectId = this.requireAvailableId(id);
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind,
        def: {
          kind: defKind,
          ...refs
        }
      }, options));
      return this;
    }

    segment(id, options = {}) {
      return this.addTwoPointObject(id, 'segment', 'between-points', {
        p1: normalizeBuilderRef(options.p1, 'p1'),
        p2: normalizeBuilderRef(options.p2, 'p2')
      }, options);
    }

    line(id, options = {}) {
      return this.addTwoPointObject(id, 'line', 'through-two-points', {
        p1: normalizeBuilderRef(options.p1, 'p1'),
        p2: normalizeBuilderRef(options.p2, 'p2')
      }, options);
    }

    ray(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'ray',
        def: {
          kind: 'from-point-through-point',
          origin: normalizeBuilderRef(options.origin, 'origin'),
          through: normalizeBuilderRef(options.through, 'through')
        }
      }, options));
      return this;
    }

    bisectorRay(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const p1Id = normalizeBuilderRef(options.p1, 'p1');
      const vertexId = normalizeBuilderRef(options.vertex, 'vertex');
      const p2Id = normalizeBuilderRef(options.p2, 'p2');
      const derivedConfig = options.derived === false
        ? false
        : isPlainObject(options.derived)
          ? options.derived
          : {};
      const renameConfig = isPlainObject(options.rename) ? options.rename : {};
      const bisectorObject = applyBuilderPresentation({
        id: objectId,
        kind: 'ray',
        def: {
          kind: 'angle-bisector',
          p1: p1Id,
          vertex: vertexId,
          p2: p2Id,
          mode: normalizeBisectorMode(options.mode, 'normal')
        }
      }, options);

      if (derivedConfig !== false) {
        const reservedRenameIds = [];
        if (renameConfig.point !== undefined) {
          reservedRenameIds.push(normalizeBuilderId(renameConfig.point, 'rename.point'));
        }
        const protectedIds = new Set([objectId, p1Id, vertexId, p2Id]);
        for (const reservedId of reservedRenameIds) {
          if (protectedIds.has(reservedId)) {
            throw new Error(`Geo2D.Builder no puede usar "${reservedId}" en rename.point porque ya forma parte de la definición base de "${objectId}".`);
          }
        }

        const pointId = renameConfig.point !== undefined
          ? this.claimAutoRenameId(renameConfig.point, {
            fieldName: 'rename.point',
            reserved: reservedRenameIds
          })
          : derivedConfig.point
            ? this.requireAvailableId(derivedConfig.point, 'derived.point')
            : this.nextPointId('P', reservedRenameIds);
        bisectorObject.def.derivedPoints = { point: pointId };
        this.pushObject(bisectorObject);

        const model = createModel(this._scene);
        const first = model.getPointPosition(p1Id);
        const vertex = model.getPointPosition(vertexId);
        const third = model.getPointPosition(p2Id);
        const defaultT = resolveBisectorDerivedPointDistance(first, vertex, third);
        this.addPointObject(pointId, {
          kind: 'on-object',
          objectId: objectId,
          param: {
            mode: 't',
            value: defaultT
          }
        }, {}, { label: pointId, draggable: true, visible: true });
        return this;
      }

      this.pushObject(bisectorObject);
      return this;
    }

    vector(id, options = {}) {
      return this.addTwoPointObject(id, 'vector', 'between-points', {
        p1: normalizeBuilderRef(options.p1, 'p1'),
        p2: normalizeBuilderRef(options.p2, 'p2')
      }, options);
    }

    equipollentVector(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'vector',
        def: {
          kind: 'equipollent-from-point',
          point: normalizeBuilderRef(options.point, 'point'),
          vectorId: normalizeBuilderRef(options.vectorId, 'vectorId')
        }
      }, options));
      return this;
    }

    parallelLine(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const def = {
        kind: 'parallel-through-point',
        objectId: normalizeBuilderRef(options.objectId, 'objectId'),
        point: normalizeBuilderRef(options.point, 'point')
      };
      copyOptionalEdgeIndex(options, def);
      this.pushObject(applyBuilderPresentation({ id: objectId, kind: 'line', def }, options));
      return this;
    }

    perpendicularLine(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const def = {
        kind: 'perpendicular-through-point',
        objectId: normalizeBuilderRef(options.objectId, 'objectId'),
        point: normalizeBuilderRef(options.point, 'point')
      };
      copyOptionalEdgeIndex(options, def);
      this.pushObject(applyBuilderPresentation({ id: objectId, kind: 'line', def }, options));
      return this;
    }

    circleCP(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'circle',
        def: {
          kind: 'center-through-point',
          center: normalizeBuilderRef(options.center, 'center'),
          through: normalizeBuilderRef(options.through, 'through')
        }
      }, options));
      return this;
    }

    circleCR(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const hasRadiusRef = options.radiusRef !== undefined;
      const hasRadius = options.radius !== undefined;
      if (hasRadiusRef && hasRadius) {
        throw new Error(`Geo2D.Builder no puede usar radius y radiusRef a la vez en "${objectId}".`);
      }
      let circleRadiusDef;
      if (hasRadiusRef) {
        circleRadiusDef = { radiusRef: normalizeBuilderRef(options.radiusRef, 'radiusRef') };
      } else if (typeof options.radius === 'string') {
        const radiusToken = String(options.radius).trim();
        if (!radiusToken) {
          throw new Error(`Geo2D.Builder requiere radius o radiusRef para "${objectId}".`);
        }
        const existingObject = this.getObject(radiusToken);
        if (existingObject) {
          if (String(existingObject.kind || '').trim().toLowerCase() !== 'number') {
            throw new Error(`Geo2D.Builder encontró "${radiusToken}", pero no es un number.`);
          }
          circleRadiusDef = { radiusRef: radiusToken };
        } else {
          const parsedRadius = safeNumber(radiusToken.replace(',', '.'), NaN);
          circleRadiusDef = Number.isFinite(parsedRadius)
            ? { radius: parsedRadius }
            : { radiusRef: normalizeBuilderRef(radiusToken, 'radius') };
        }
      } else {
        circleRadiusDef = { radius: safeNumber(options.radius, NaN) };
      }
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'circle',
        def: {
          kind: 'center-radius',
          center: normalizeBuilderRef(options.center, 'center'),
          ...circleRadiusDef
        }
      }, options));
      return this;
    }

    circleArc(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'arc',
        def: {
          kind: 'center-start-end',
          center: normalizeBuilderRef(options.center, 'center'),
          start: normalizeBuilderRef(options.start, 'start'),
          end: normalizeBuilderRef(options.end, 'end'),
          direction: normalizeAngleDirection(options.direction, 'ccw')
        }
      }, options));
      return this;
    }

    circularSector(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'sector',
        def: {
          kind: 'center-start-end',
          center: normalizeBuilderRef(options.center, 'center'),
          start: normalizeBuilderRef(options.start, 'start'),
          end: normalizeBuilderRef(options.end, 'end'),
          direction: normalizeAngleDirection(options.direction, 'ccw')
        }
      }, options));
      return this;
    }

    ellipse(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const centerId = normalizeBuilderRef(options.center, 'center');
      const vertexId = normalizeBuilderRef(options.vertex, 'vertex');
      const coVertexId = normalizeBuilderRef(options.coVertex, 'coVertex');
      const derivedConfig = options.derived === false
        ? false
        : isPlainObject(options.derived)
          ? options.derived
          : {};
      const renameConfig = isPlainObject(options.rename) ? options.rename : {};
      const ellipseObject = applyBuilderPresentation({
        id: objectId,
        kind: 'ellipse',
        def: {
          kind: 'center-vertex-covertex',
          center: centerId,
          vertex: vertexId,
          coVertex: coVertexId
        }
      }, options);

      if (derivedConfig !== false) {
        const reservedRenameIds = [];
        if (renameConfig.antiVertex !== undefined) {
          reservedRenameIds.push(normalizeBuilderId(renameConfig.antiVertex, 'rename.antiVertex'));
        }
        if (renameConfig.antiCoVertex !== undefined) {
          reservedRenameIds.push(normalizeBuilderId(renameConfig.antiCoVertex, 'rename.antiCoVertex'));
        }
        const protectedIds = new Set([objectId, centerId, vertexId, coVertexId]);
        for (const reservedId of reservedRenameIds) {
          if (protectedIds.has(reservedId)) {
            throw new Error(`Geo2D.Builder no puede usar "${reservedId}" en rename porque ya forma parte de la definición base de "${objectId}".`);
          }
        }

        const antiVertexId = renameConfig.antiVertex !== undefined
          ? this.claimAutoRenameId(renameConfig.antiVertex, {
            fieldName: 'rename.antiVertex',
            reserved: reservedRenameIds
          })
          : derivedConfig.antiVertex
            ? this.requireAvailableId(derivedConfig.antiVertex, 'derived.antiVertex')
            : this.nextPointId('P', reservedRenameIds);
        const antiCoVertexId = renameConfig.antiCoVertex !== undefined
          ? this.claimAutoRenameId(renameConfig.antiCoVertex, {
            fieldName: 'rename.antiCoVertex',
            reserved: reservedRenameIds.concat([antiVertexId])
          })
          : derivedConfig.antiCoVertex
            ? this.requireAvailableId(derivedConfig.antiCoVertex, 'derived.antiCoVertex')
            : this.nextPointId('P', reservedRenameIds.concat([antiVertexId]));

        if (antiVertexId === antiCoVertexId) {
          throw new Error('Geo2D.Builder requiere ids distintos para antiVertex y antiCoVertex.');
        }

        ellipseObject.def.derivedPoints = {
          antiVertex: antiVertexId,
          antiCoVertex: antiCoVertexId
        };
        this.pushObject(ellipseObject);
        this.addPointObject(antiVertexId, {
          kind: 'ellipse-derived-point',
          ellipseId: objectId,
          role: 'antiVertex'
        }, {}, { label: antiVertexId, draggable: false, visible: false });
        this.addPointObject(antiCoVertexId, {
          kind: 'ellipse-derived-point',
          ellipseId: objectId,
          role: 'antiCoVertex'
        }, {}, { label: antiCoVertexId, draggable: false, visible: false });
        return this;
      }

      this.pushObject(ellipseObject);
      return this;
    }

    regularPolygon(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const sides = Math.floor(safeNumber(options.sides, NaN));
      if (!(sides >= 3)) {
        throw new Error(`Geo2D.Builder requiere al menos 3 lados para "${objectId}".`);
      }

      const renameConfig = isPlainObject(options.rename) ? options.rename : {};
      const derivedConfig = isPlainObject(options.derived) ? options.derived : {};
      const orientationAngle = resolveRegularPolygonBuilderOrientation(options, sides);
      const orientedMode = Number.isFinite(orientationAngle);
      const renameVertices = Array.isArray(renameConfig.vertices) ? renameConfig.vertices : [];
      const derivedVertices = Array.isArray(derivedConfig.vertices) ? derivedConfig.vertices : [];
      if (renameVertices.length > sides - 1) {
        throw new Error(`Geo2D.Builder recibió demasiados nombres en rename.vertices para "${objectId}".`);
      }
      if (derivedVertices.length > sides - 1) {
        throw new Error(`Geo2D.Builder recibió demasiados ids en derived.vertices para "${objectId}".`);
      }

      const normalizedRenameVertices = renameVertices.map((value, index) => normalizeBuilderId(value, `rename.vertices[${index}]`));
      if (new Set(normalizedRenameVertices).size !== normalizedRenameVertices.length) {
        throw new Error(`Geo2D.Builder requiere nombres distintos en rename.vertices para "${objectId}".`);
      }

      const normalizedDerivedVertices = derivedVertices.map((value, index) => normalizeBuilderId(value, `derived.vertices[${index}]`));
      if (new Set(normalizedDerivedVertices).size !== normalizedDerivedVertices.length) {
        throw new Error(`Geo2D.Builder requiere ids distintos en derived.vertices para "${objectId}".`);
      }

      const centerId = normalizeBuilderRef(options.center, 'center');
      let vertexId = null;
      let orientedRadiusDef = null;

      if (orientedMode) {
        const hasRadiusRef = options.radiusRef !== undefined;
        const hasRadius = options.radius !== undefined;
        if (hasRadiusRef && hasRadius) {
          throw new Error(`Geo2D.Builder no puede usar radius y radiusRef a la vez en "${objectId}".`);
        }

        if (renameConfig.vertex !== undefined && options.vertex !== undefined) {
          throw new Error(`Geo2D.Builder no puede usar vertex y rename.vertex a la vez en "${objectId}".`);
        }

        const reservedVertexIds = normalizedRenameVertices.concat([objectId, centerId]);
        const explicitVertexId = options.vertex !== undefined
          ? normalizeBuilderId(options.vertex, 'vertex')
          : renameConfig.vertex !== undefined
            ? normalizeBuilderId(renameConfig.vertex, 'rename.vertex')
            : '';
        if (explicitVertexId && (explicitVertexId === objectId || explicitVertexId === centerId)) {
          throw new Error(`Geo2D.Builder no puede usar "${explicitVertexId}" como vértice base orientado de "${objectId}".`);
        }
        const preferredVertexId = options.vertex !== undefined
          ? this.requireAvailableId(explicitVertexId, 'vertex')
          : renameConfig.vertex !== undefined
            ? this.claimAutoRenameId(explicitVertexId, {
              fieldName: 'rename.vertex',
              reserved: reservedVertexIds
            })
            : this.nextPointId('P', reservedVertexIds);

        if (hasRadiusRef) {
          orientedRadiusDef = { radiusRef: normalizeBuilderRef(options.radiusRef, 'radiusRef') };
        } else if (typeof options.radius === 'string') {
          const radiusToken = String(options.radius).trim();
          if (!radiusToken) {
            throw new Error(`Geo2D.Builder requiere radius o radiusRef para "${objectId}".`);
          }
          const existingObject = this.getObject(radiusToken);
          if (existingObject) {
            if (String(existingObject.kind || '').trim().toLowerCase() !== 'number') {
              throw new Error(`Geo2D.Builder encontró "${radiusToken}", pero no es un number.`);
            }
            orientedRadiusDef = { radiusRef: radiusToken };
          } else {
            const parsedRadius = safeNumber(radiusToken.replace(',', '.'), NaN);
            if (!(parsedRadius > 1e-9)) {
              throw new Error(`Geo2D.Builder requiere radius positivo para el polígono regular orientado "${objectId}".`);
            }
            orientedRadiusDef = { radius: parsedRadius };
          }
        } else {
          const radius = safeNumber(options.radius, NaN);
          if (!(radius > 1e-9)) {
            throw new Error(`Geo2D.Builder requiere radius positivo para el polígono regular orientado "${objectId}".`);
          }
          orientedRadiusDef = { radius };
        }

        vertexId = preferredVertexId;
      } else {
        if (renameConfig.vertex !== undefined) {
          throw new Error(`Geo2D.Builder solo permite rename.vertex en el modo orientado de "${objectId}".`);
        }
        vertexId = normalizeBuilderRef(options.vertex, 'vertex');
      }

      const protectedIds = new Set([objectId, centerId, vertexId]);
      for (const renameId of normalizedRenameVertices) {
        if (protectedIds.has(renameId)) {
          throw new Error(`Geo2D.Builder no puede usar "${renameId}" en rename.vertices porque ya forma parte de la definición base de "${objectId}".`);
        }
      }

      const pointIds = [vertexId];
      const reservedRenameIds = normalizedRenameVertices.slice();

      for (let index = 1; index < sides; index++) {
        const renameId = normalizedRenameVertices[index - 1];
        const derivedId = normalizedDerivedVertices[index - 1];
        let pointId;

        if (renameId) {
          pointId = this.claimAutoRenameId(renameId, {
            fieldName: `rename.vertices[${index - 1}]`,
            reserved: reservedRenameIds.concat(pointIds)
          });
        } else if (derivedId) {
          pointId = this.requireAvailableId(derivedId, `derived.vertices[${index - 1}]`);
        } else {
          pointId = this.nextPointId('P', reservedRenameIds.concat(pointIds));
        }

        pointIds.push(pointId);
      }

      const polygonObject = applyBuilderPresentation({
        id: objectId,
        kind: 'polygon',
        def: {
          kind: orientedMode ? 'regular-center-radius' : 'regular-center-vertex',
          center: centerId,
          sides,
          points: pointIds,
          ...(orientedMode
            ? {
              ...orientedRadiusDef,
              orientationAngle
            }
            : {
              vertex: vertexId
            })
        }
      }, options);

      this.pushObject(polygonObject);

      for (let index = orientedMode ? 0 : 1; index < pointIds.length; index++) {
        const pointId = pointIds[index];
        this.addPointObject(pointId, {
          kind: 'regular-polygon-vertex',
          polygonId: objectId,
          index
        }, {}, { label: pointId, draggable: false });
      }

      return this;
    }

    polyline(id, pointsOrOptions, options = {}) {
      const objectId = this.requireAvailableId(id);
      const points = normalizeBuilderPointList(pointsOrOptions);
      const config = Array.isArray(pointsOrOptions)
        ? options
        : pointsOrOptions;
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'polyline',
        def: {
          kind: 'through-points',
          points
        }
      }, config));
      return this;
    }

    polygon(id, pointsOrOptions, options = {}) {
      const objectId = this.requireAvailableId(id);
      const points = normalizeBuilderPointList(pointsOrOptions);
      const config = Array.isArray(pointsOrOptions)
        ? options
        : pointsOrOptions;
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'polygon',
        def: {
          kind: 'through-points',
          points
        }
      }, config));
      return this;
    }

    transform(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const config = isPlainObject(options) ? options : {};
      const kind = String(config.kind || config.type || '').trim().toLowerCase();
      const def = { kind };

      if (kind === 'translation') {
        def.vector = normalizeBuilderRef(config.vector || config.vectorId, 'vector');
      } else if (kind === 'rotation') {
        def.center = normalizeBuilderRef(config.center, 'center');
        if (config.angleRef !== undefined) {
          def.angleRef = normalizeBuilderRef(config.angleRef, 'angleRef');
        } else {
          def.angle = safeNumber(config.angle, NaN);
        }
        def.unit = normalizeBuilderAngleUnit(config.unit, 'deg');
        def.direction = normalizeAngleDirection(config.direction, 'ccw');
      } else if (kind === 'reflection') {
        def.axis = normalizeBuilderRef(config.axis, 'axis');
      } else if (kind === 'central-symmetry') {
        def.center = normalizeBuilderRef(config.center, 'center');
      } else if (kind === 'homothety') {
        def.center = normalizeBuilderRef(config.center, 'center');
        if (config.factorRef !== undefined) {
          def.factorRef = normalizeBuilderRef(config.factorRef, 'factorRef');
        } else {
          def.factor = safeNumber(config.factor ?? config.k, NaN);
        }
      } else {
        throw new Error(`Geo2D.Builder no soporta la transformacion "${kind || '(vacia)'}".`);
      }

      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'transform',
        def
      }, config, { label: objectId, visible: false }));
      return this;
    }

    translation(id, options = {}) {
      return this.transform(id, { ...options, kind: 'translation' });
    }

    rotation(id, options = {}) {
      return this.transform(id, { ...options, kind: 'rotation' });
    }

    reflection(id, options = {}) {
      return this.transform(id, { ...options, kind: 'reflection' });
    }

    centralSymmetry(id, options = {}) {
      return this.transform(id, { ...options, kind: 'central-symmetry' });
    }

    homothety(id, options = {}) {
      return this.transform(id, { ...options, kind: 'homothety' });
    }

    imageOf(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const config = isPlainObject(options) ? options : {};
      const sourceId = normalizeBuilderRef(config.objectId || config.of || config.source, 'objectId');
      const transformId = normalizeBuilderRef(config.transform || config.transformId, 'transform');
      const source = this.getObject(sourceId);
      if (!source) throw new Error(`Geo2D.Builder no encontro "${sourceId}".`);

      const sourceKind = String(source.kind || '').trim();
      const constructionKind =
        sourceKind === 'point' ? 'point'
        : sourceKind === 'segment' ? 'segment'
        : sourceKind === 'line' ? 'line'
        : sourceKind === 'circle' ? 'circle'
        : sourceKind === 'polygon' ? 'polygon'
        : '';
      if (!constructionKind) {
        throw new Error(`Geo2D.Builder no puede transformar "${sourceId}" como imagen semantica.`);
      }

      const imagePointIds = [];
      if (constructionKind !== 'point') {
        const reserved = [objectId];
        const definingPointIds = getDefiningPointIdsForConstruction(source);
        for (const pointId of definingPointIds) {
          const imagePointId = this.nextAvailableId(`${pointId}i`, reserved);
          reserved.push(imagePointId);
          imagePointIds.push({ sourceId: pointId, imagePointId });
        }
      }

      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: constructionKind,
        def: {
          kind: 'image-of',
          objectId: sourceId,
          transform: transformId,
          ...(imagePointIds.length ? { imagePoints: imagePointIds.map(entry => entry.imagePointId) } : {})
        }
      }, config, {
        label: objectId,
        draggable: false,
        style: { stroke: '#16a34a', fill: 'rgba(22,163,74,0.12)' }
      }));

      if (imagePointIds.length) {
        for (const entry of imagePointIds) {
          this.pushObject(applyBuilderPresentation({
            id: entry.imagePointId,
            kind: 'point',
            def: {
              kind: 'image-of',
              objectId: entry.sourceId,
              transform: transformId
            }
          }, {}, {
            label: entry.imagePointId,
            draggable: false,
            style: { fill: DEPENDENT_POINT_FILL }
          }));
        }
      }
      return this;
    }

    measureDistance(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const of = Array.isArray(options)
        ? options
        : Array.isArray(options.of)
          ? options.of
          : [options.p1, options.p2];
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'measure',
        def: {
          kind: 'distance',
          of: of.map((refId, index) => normalizeBuilderRef(refId, `of[${index}]`))
        }
      }, isPlainObject(options) ? options : {}));
      return this;
    }

    angle(id, options = {}) {
      const objectId = this.requireAvailableId(id);
      const config = isPlainObject(options) ? options : {};
      const presentation = { ...config };
      if (config.sectorVisible !== undefined) {
        const parts = isPlainObject(config.parts) ? deepClone(config.parts) : {};
        const fill = parts.fill && typeof parts.fill === 'object' && !Array.isArray(parts.fill) ? parts.fill : {};
        parts.fill = { ...fill, visible: !!config.sectorVisible };
        presentation.parts = parts;
      }
      const renameConfig = isPlainObject(config.rename) ? config.rename : {};
      const derivedConfig = isPlainObject(config.derived) ? config.derived : {};
      const hasMeasuredDefinition = config.measure !== undefined || config.measureRef !== undefined;

      if (hasMeasuredDefinition) {
        if (config.p2 !== undefined) {
          throw new Error(`Geo2D.Builder no puede mezclar p2 con measure/measureRef en "${objectId}".`);
        }

        const p1 = normalizeBuilderRef(config.p1, 'p1');
        const vertex = normalizeBuilderRef(config.vertex, 'vertex');
        const reservedRenameIds = [objectId, p1, vertex];
        const derivedPointId = renameConfig.p2 !== undefined
          ? this.claimAutoRenameId(renameConfig.p2, {
            fieldName: 'rename.p2',
            reserved: reservedRenameIds
          })
          : derivedConfig.p2 !== undefined
            ? this.requireAvailableId(derivedConfig.p2, 'derived.p2')
            : this.nextPointId('P', reservedRenameIds);
        const unit = normalizeBuilderAngleUnit(config.unit, 'deg');
        let measureRef = '';
        let measureValue = NaN;

        if (config.measureRef !== undefined && config.measure !== undefined) {
          throw new Error(`Geo2D.Builder no puede usar measure y measureRef a la vez en "${objectId}".`);
        }

        if (config.measureRef !== undefined) {
          measureRef = normalizeBuilderRef(config.measureRef, 'measureRef');
        } else if (typeof config.measure === 'string') {
          const measureToken = String(config.measure).trim();
          if (!measureToken) {
            throw new Error(`Geo2D.Builder requiere measure o measureRef para "${objectId}".`);
          }
          const existingObject = this.getObject(measureToken);
          if (existingObject) {
            if (String(existingObject.kind || '').trim().toLowerCase() !== 'number') {
              throw new Error(`Geo2D.Builder encontró "${measureToken}", pero no es un number.`);
            }
            measureRef = measureToken;
          } else {
            const parsedValue = safeNumber(measureToken.replace(',', '.'), NaN);
            if (!Number.isFinite(parsedValue)) {
              measureRef = measureToken;
            } else {
              measureValue = validateAngleMeasureValue(parsedValue, unit, `angulo "${objectId}"`);
            }
          }
        } else {
          measureValue = validateAngleMeasureValue(config.measure, unit, `angulo "${objectId}"`);
        }

        this.pushObject(applyBuilderPresentation({
          id: objectId,
          kind: 'angle',
          def: {
            kind: 'vertex-ray-measure',
            p1,
            vertex,
            ...(measureRef ? { measureRef } : { measureValue }),
            unit,
            direction: normalizeAngleDirection(config.direction, 'ccw'),
            derivedPoints: {
              p2: derivedPointId
            },
            ...(config.measureVisible === false ? { measure: { visible: false } } : {})
          }
        }, presentation));
        this.addPointObject(derivedPointId, {
          kind: 'angle-terminal-point',
          angleId: objectId
        }, {}, { label: derivedPointId, draggable: false, visible: true, style: { fill: DEPENDENT_POINT_FILL } });
        return this;
      }

      const of = Array.isArray(options)
        ? options
        : Array.isArray(options.of)
          ? options.of
          : [options.p1, options.vertex, options.p2];
      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'angle',
        def: {
          kind: 'three-points',
          p1: normalizeBuilderRef(of[0], 'p1'),
          vertex: normalizeBuilderRef(of[1], 'vertex'),
          p2: normalizeBuilderRef(of[2], 'p2'),
          ...(config.concave === true ? { mode: 'concave' } : {}),
          measure: {
            unit: String(config.unit || 'deg').trim().toLowerCase() === 'rad' ? 'rad' : 'deg',
            ...(config.measureVisible === false ? { visible: false } : {})
          }
        }
      }, presentation));
      return this;
    }

    text(id, xOrOptions, y, text, options = {}) {
      const objectId = this.requireAvailableId(id);
      const normalized = normalizeBuilderTextArgs(xOrOptions, y, text, options);
      if (!Number.isFinite(normalized.x) || !Number.isFinite(normalized.y)) {
        throw new Error(`Geo2D.Builder requiere coordenadas válidas para el texto "${objectId}".`);
      }
      if (!String(normalized.text || '').trim()) {
        throw new Error(`Geo2D.Builder requiere texto para "${objectId}".`);
      }

      this.pushObject(applyBuilderPresentation({
        id: objectId,
        kind: 'text',
        def: {
          kind: 'free-text',
          x: normalized.x,
          y: normalized.y,
          text: normalized.text
        }
      }, normalized.options));
      return this;
    }

    toJSON() {
      return deepClone(this._scene);
    }

    build() {
      return serializeConstructionScene(readSceneInput(this.toJSON()));
    }

    publishHtml(options = {}) {
      return publishHtml(this.build(), options);
    }
  }

  function normalizePublicScene(sceneLike) {
    if (!sceneLike) return null;
    if (sceneLike.__geo2dBuilder === true && typeof sceneLike.build === 'function') {
      return sceneLike.build();
    }
    if (isPlainObject(sceneLike)) return sceneLike;
    throw new Error('Geo2D requiere una escena válida o un Geo2D.Builder.');
  }

  function createModel(sceneLike) {
    return new SceneModel(readSceneInput(normalizePublicScene(sceneLike)));
  }

  function resolveObject(sceneLike, id) {
    return toPublicResolvedSnapshot(createModel(sceneLike).getResolvedObject(id));
  }

  function getComputedProperties(sceneLike, id) {
    return createModel(sceneLike).getComputedProperties(id);
  }

  function getNumberValue(sceneLike, id) {
    return createModel(sceneLike).getNumberValue(id);
  }

  function inspectObject(sceneLike, id) {
    return createModel(sceneLike).inspectObject(id);
  }

  function resolvePublicTarget(target, fallbackSelector) {
    if (!target && fallbackSelector) return SceneParser.resolveSceneSourceElement(fallbackSelector);
    return SceneParser.resolveSceneSourceElement(target);
  }

  function getMounted(target) {
    const host = resolvePublicTarget(target);
    return host?.__geo2dInstance || null;
  }

  function whenMounted(target, options = {}) {
    const timeoutMs = Math.max(0, safeNumber(options.timeoutMs, 4000));
    const intervalMs = Math.max(16, safeNumber(options.intervalMs, 80));

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      function check() {
        try {
          const instance = getMounted(target);
          if (instance) {
            resolve(instance);
            return;
          }

          if (Date.now() - startedAt >= timeoutMs) {
            reject(new Error('Geo2D no encontró una instancia montada a tiempo.'));
            return;
          }

          window.setTimeout(check, intervalMs);
        } catch (err) {
          reject(err);
        }
      }

      check();
    });
  }

  function replaceScene(target, sceneLike, options = {}) {
    const instance = getMounted(target);
    if (!instance) throw new Error('Geo2D no encontró una instancia montada para reemplazar la escena.');

    instance.applySceneState(normalizePublicScene(sceneLike), {
      clearSelection: true,
      syncJson: true,
      ...(isPlainObject(options) ? options : {})
    });

    return instance;
  }

  function buildViewerDataAttrs(options = {}) {
    const attrs = [];
    const printCompact = options.printCompact === true || options.compact === true;
    const printHeight = parsePositiveNumber(options.printHeight, null);
    const viewerHeight = parsePositiveNumber(options.viewerHeight ?? options.height, null);
    const printAspectRatio = parseAspectRatio(options.printAspectRatio, null);
    const viewerAspectRatio = parseAspectRatio(options.viewerAspectRatio ?? options.aspectRatio, null);

    if (printCompact) attrs.push('data-print-compact="true"');
    if (printHeight !== null) attrs.push(`data-print-height="${DomUtils.escapeHtml(printHeight)}"`);
    else if (viewerHeight !== null) attrs.push(`data-viewer-height="${DomUtils.escapeHtml(viewerHeight)}"`);
    if (printAspectRatio !== null) attrs.push(`data-print-aspect-ratio="${DomUtils.escapeHtml(printAspectRatio)}"`);
    else if (viewerAspectRatio !== null) attrs.push(`data-viewer-aspect-ratio="${DomUtils.escapeHtml(viewerAspectRatio)}"`);

    return attrs.length ? ' ' + attrs.join(' ') : '';
  }

  function publishHtml(sceneLike, options = {}) {
    const scene = normalizePublicScene(sceneLike);
    const id = normalizeBuilderId(
      options.id || ('geo2d-' + Math.random().toString(36).slice(2, 8)),
      'options.id'
    );
    const mode = normalizeViewerMode(options.mode || options.viewerMode);
    const classTokens = String(options.className || 'geo2d-viewer').trim().split(/\s+/).filter(Boolean);
    if ((options.printCompact === true || options.compact === true) && !classTokens.includes('geo2d-print-compact')) {
      classTokens.push('geo2d-print-compact');
    }
    const className = classTokens.join(' ') || 'geo2d-viewer';
    const sceneText = serializeSceneForHtmlBlock(scene);
    const dataAttrs = buildViewerDataAttrs(options);
    return `<div class="${DomUtils.escapeHtml(className)}" id="${DomUtils.escapeHtml(id)}" data-geo2d-viewer data-viewer-mode="${mode}"${dataAttrs}><textarea data-geo2d-scene style="display:none;">${sceneText}</textarea></div>`;
  }

  function mountViewer(target, sceneLike, options = {}) {
    return new Geo2DEditor(
      target || options.target || options.container || '#geo2d-viewer',
      {
        ...options,
        mode: 'viewer',
        viewerMode: normalizeViewerMode(options.mode || options.viewerMode),
        ...(sceneLike ? { scene: normalizePublicScene(sceneLike) } : {})
      }
    );
  }

  function mountEditor(target, sceneLike, options = {}) {
    return new Geo2DEditor(
      target || options.target || options.container || '#geo2d-editor',
      {
        ...options,
        mode: 'editor',
        ...(sceneLike ? { scene: normalizePublicScene(sceneLike) } : {})
      }
    );
  }

  function autoMount(root = document) {
  const base = root && typeof root.querySelectorAll === 'function'
    ? root
    : document;

  base.querySelectorAll('[data-geo2d-editor]').forEach(el => {
    if (!el.__geo2dMounted) {
      try {
        window.Geo2D.mountEditor(el, null, {
          target: el,
          sceneSource: SceneParser.readEmbeddedSceneText(el) ? el : undefined
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
        window.Geo2D.mountViewer(el, null, {
          target: el,
          viewerMode: normalizeViewerMode(el.getAttribute('data-viewer-mode') || el.getAttribute('data-geo2d-mode') || el.getAttribute('data-mode')),
          sceneSource: SceneParser.readEmbeddedSceneText(el) ? el : undefined
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
    SceneModel,
    Builder: Geo2DBuilder,
    createModel,
    resolveObject,
    getComputedProperties,
    getNumberValue,
    inspectObject,
    getMounted,
    whenMounted,
    replaceScene,
    publishHtml,
    mountEditor,
    mountViewer,
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
