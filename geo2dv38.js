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
      if (!el) throw new Error('No se encontrÃ³ sceneSource: ' + sceneSource);
      const attrScene = el.getAttribute && (el.getAttribute('data-scene') || el.getAttribute('data-geo2d-scene'));
      if (attrScene) return attrScene.trim();
      return (el.value !== undefined ? el.value : el.textContent || '').trim();
    }

    if (sceneSource instanceof Element) {
      const attrScene = sceneSource.getAttribute && (sceneSource.getAttribute('data-scene') || sceneSource.getAttribute('data-geo2d-scene'));
      if (attrScene) return attrScene.trim();
      return (sceneSource.value !== undefined ? sceneSource.value : sceneSource.textContent || '').trim();
    }

    throw new Error('sceneSource invÃ¡lido.');
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

  function isLineLikeRawType(type) {
    return type === 'line' || type === 'parallel-line' || type === 'perpendicular-line';
  }

  function isVectorRawType(type) {
    return type === 'vector' || type === 'equipollent-vector';
  }

  function isDirectionalRawType(type) {
    return type === 'segment' || type === 'ray' || isLineLikeRawType(type);
  }

  function isIntersectableRawType(type) {
    return (
      isDirectionalRawType(type) ||
      type === 'circle' ||
      type === 'circle-radius' ||
      type === 'ellipse' ||
      type === 'polyline' ||
      type === 'polygon'
    );
  }

  const FREE_POINT_FILL = '#ea580c';
  const DEPENDENT_POINT_FILL = '#16a34a';
  const MOBILE_LAYOUT_BREAKPOINT = 820;
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
    'area',
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
    area: '#14b8a6',
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
    area: {
      idPrefix: 'area',
      type: 'area',
      style: Object.freeze({ stroke: 'none', fill: 'rgba(20,184,166,0.18)' })
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

  function getRawObjectRefs(raw) {
    if (!raw || typeof raw !== 'object') return [];

    if (raw.type === 'point' && raw.constraint) {
      if (raw.constraint.kind === 'intersection') {
        return [raw.constraint.objectId, raw.constraint.objectId2].filter(Boolean);
      }
      if (raw.constraint.objectId) {
        return [raw.constraint.objectId];
      }
    }

    if (raw.type === 'midpoint') {
      return [raw.p1, raw.p2].filter(Boolean);
    }

    if (raw.type === 'segment' || raw.type === 'line' || raw.type === 'ray') {
      return [raw.p1, raw.p2].filter(Boolean);
    }

    if (raw.type === 'parallel-line' || raw.type === 'perpendicular-line') {
      return [raw.point, raw.objectId].filter(Boolean);
    }

    if (raw.type === 'circle') {
      return [raw.center, raw.through].filter(Boolean);
    }

    if (raw.type === 'circle-radius') {
      return [raw.center].filter(Boolean);
    }

    if (raw.type === 'ellipse') {
      return [raw.center].filter(Boolean);
    }

    if (raw.type === 'vector') {
      return [raw.p1, raw.p2].filter(Boolean);
    }

    if (raw.type === 'equipollent-vector') {
      return [raw.point, raw.vectorId].filter(Boolean);
    }

    if (raw.type === 'polyline' || raw.type === 'area' || raw.type === 'polygon') {
      return Array.isArray(raw.points) ? raw.points.filter(Boolean) : [];
    }

    if (raw.type === 'measure') {
      return Array.isArray(raw.of) ? raw.of.filter(Boolean) : [];
    }

    return [];
  }

  function validateScene(scene) {
    const supportedTypes = new Set([
      'point',
      'midpoint',
      'segment',
      'line',
      'ray',
      'vector',
      'equipollent-vector',
      'parallel-line',
      'perpendicular-line',
      'circle',
      'circle-radius',
      'ellipse',
      'polyline',
      'area',
      'polygon',
      'measure',
      'text'
    ]);
    const constraintParentType = {
      'on-segment': 'segment',
      'on-line': 'line',
      'on-ray': 'ray',
      'on-circle': 'circle',
      'on-ellipse': 'ellipse',
      'vector-end': 'vector'
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
      if (!isPointLikeRawType(target.type)) {
        throw new Error(`El objeto "${ownerId}" requiere que ${fieldName} apunte a un punto o punto medio.`);
      }
      return target;
    }

    function normalizeAndValidateEdgeIndex(ownerId, fieldName, target, edgeIndex, allowOmitted = false) {
      const normalized = normalizeEdgeIndex(edgeIndex);
      if (normalized === null) {
        if (allowOmitted) return null;
        throw new Error(`El objeto "${ownerId}" requiere ${fieldName} para identificar un segmento valido.`);
      }

      const maxEdges = target.type === 'polygon' ? target.points.length : target.points.length - 1;
      if (normalized < 0 || normalized >= maxEdges) {
        throw new Error(`El objeto "${ownerId}" usa ${fieldName} fuera de rango.`);
      }

      return normalized;
    }

    for (const raw of scene.objects) {
      if (raw.type === 'point') {
        if (raw.constraint !== undefined) {
          if (!raw.constraint || typeof raw.constraint !== 'object' || Array.isArray(raw.constraint)) {
            throw new Error(`El punto "${raw.id}" tiene una restriccion invalida.`);
          }

          const kind = String(raw.constraint.kind || '').trim();
          if (kind === 'intersection') {
            raw.constraint.kind = kind;
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

            if (!isIntersectableRawType(first.type) || !isIntersectableRawType(second.type)) {
              throw new Error(`El punto "${raw.id}" requiere dos objetos intersectables.`);
            }

            if (isSegmentChainResolvedKind(first.type)) {
              if (raw.constraint.edgeIndex !== null) {
                raw.constraint.edgeIndex = normalizeAndValidateEdgeIndex(raw.id, 'constraint.edgeIndex', first, raw.constraint.edgeIndex, true);
              }
            } else if (raw.constraint.edgeIndex !== null) {
              throw new Error(`El punto "${raw.id}" solo puede usar constraint.edgeIndex sobre poligonales o poligonos.`);
            }

            if (isSegmentChainResolvedKind(second.type)) {
              if (raw.constraint.edgeIndex2 !== null) {
                raw.constraint.edgeIndex2 = normalizeAndValidateEdgeIndex(raw.id, 'constraint.edgeIndex2', second, raw.constraint.edgeIndex2, true);
              }
            } else if (raw.constraint.edgeIndex2 !== null) {
              throw new Error(`El punto "${raw.id}" solo puede usar constraint.edgeIndex2 sobre poligonales o poligonos.`);
            }

            if (!Number.isFinite(raw.constraint.pickX) || !Number.isFinite(raw.constraint.pickY)) {
              throw new Error(`El punto "${raw.id}" requiere una referencia de seleccion valida.`);
            }

            raw.draggable = false;
            continue;
          }

          const expectedParentType = constraintParentType[kind];
          if (!expectedParentType) {
            throw new Error(`El punto "${raw.id}" usa una restriccion no soportada: ${kind || '(vacia)'}.`);
          }

          raw.constraint.kind = kind;
          raw.constraint.objectId = String(raw.constraint.objectId || '').trim();

          const parent = requireRef(raw.id, 'constraint.objectId', raw.constraint.objectId);
          const parentTypeOk =
            kind === 'on-line'
              ? isLineLikeRawType(parent.type)
              : kind === 'on-segment'
                ? parent.type === 'segment' || parent.type === 'polyline' || parent.type === 'polygon'
              : kind === 'on-circle'
                ? parent.type === 'circle' || parent.type === 'circle-radius'
              : kind === 'vector-end'
                ? isVectorRawType(parent.type)
               : parent.type === expectedParentType;

          if (!parentTypeOk) {
            throw new Error(`El punto "${raw.id}" requiere un objeto compatible en su restriccion.`);
          }

          if (kind === 'vector-end') {
            raw.draggable = false;
          } else if (kind === 'on-segment' && (parent.type === 'polyline' || parent.type === 'polygon')) {
            raw.constraint.edgeIndex = normalizeAndValidateEdgeIndex(raw.id, 'constraint.edgeIndex', parent, raw.constraint.edgeIndex, false);
          }
        } else {
          raw.x = safeNumber(raw.x, NaN);
          raw.y = safeNumber(raw.y, NaN);

          if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
            throw new Error(`El punto libre "${raw.id}" debe tener coordenadas validas.`);
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

      if (raw.type === 'parallel-line' || raw.type === 'perpendicular-line') {
        requirePointRef(raw.id, 'point', raw.point);
        const parent = requireRef(raw.id, 'objectId', raw.objectId);
        if (parent.type === 'polyline' || parent.type === 'polygon') {
          raw.edgeIndex = normalizeAndValidateEdgeIndex(raw.id, 'edgeIndex', parent, raw.edgeIndex, false);
        } else if (!isDirectionalRawType(parent.type)) {
          throw new Error(`La recta derivada "${raw.id}" debe referenciar un segmento, recta, semirrecta o una arista de poligonal/poligono.`);
        }
        continue;
      }

      if (raw.type === 'circle') {
        requirePointRef(raw.id, 'center', raw.center);
        requirePointRef(raw.id, 'through', raw.through);
        continue;
      }

      if (raw.type === 'circle-radius') {
        requirePointRef(raw.id, 'center', raw.center);
        raw.radius = safeNumber(raw.radius, NaN);

        if (!(raw.radius > 1e-9)) {
          throw new Error(`La circunferencia "${raw.id}" debe tener radio mayor que 0.`);
        }

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

      if (raw.type === 'vector') {
        requirePointRef(raw.id, 'p1', raw.p1);
        requirePointRef(raw.id, 'p2', raw.p2);
        continue;
      }

      if (raw.type === 'equipollent-vector') {
        requirePointRef(raw.id, 'point', raw.point);
        const baseVector = requireRef(raw.id, 'vectorId', raw.vectorId);
        if (!isVectorRawType(baseVector.type)) {
          throw new Error(`El vector equipolente "${raw.id}" debe referenciar un vector.`);
        }
        continue;
      }

      if (raw.type === 'polyline') {
        if (!Array.isArray(raw.points) || raw.points.length < 2) {
          throw new Error(`La poligonal "${raw.id}" debe tener al menos 2 puntos.`);
        }

        raw.points.forEach((refId, index) => requirePointRef(raw.id, `points[${index}]`, refId));
        continue;
      }

      if (raw.type === 'area') {
        if (!Array.isArray(raw.points) || raw.points.length < 3) {
          throw new Error(`El area "${raw.id}" debe tener al menos 3 puntos.`);
        }

        raw.points.forEach((refId, index) => requirePointRef(raw.id, `points[${index}]`, refId));
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

  function getLegacyTypeFromConstructionObject(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';

    const kind = String(raw.kind || '').trim();
    const defKind = String(raw.def?.kind || '').trim();

    if (kind === 'point') {
      if (defKind === 'free' || defKind === 'on-object' || defKind === 'intersection' || defKind === 'vector-end') return 'point';
      if (defKind === 'midpoint') return 'midpoint';
    }

    if (kind === 'segment' && defKind === 'between-points') return 'segment';
    if (kind === 'ray' && defKind === 'from-point-through-point') return 'ray';
    if (kind === 'vector' && defKind === 'between-points') return 'vector';
    if (kind === 'vector' && defKind === 'equipollent-from-point') return 'equipollent-vector';

    if (kind === 'line') {
      if (defKind === 'through-two-points') return 'line';
      if (defKind === 'parallel-through-point') return 'parallel-line';
      if (defKind === 'perpendicular-through-point') return 'perpendicular-line';
    }

    if (kind === 'circle' && defKind === 'center-through-point') return 'circle';
    if (kind === 'circle' && defKind === 'center-radius') return 'circle-radius';
    if (kind === 'ellipse' && defKind === 'center-radii-rotation') return 'ellipse';
    if (kind === 'polyline' && defKind === 'through-points') return 'polyline';
    if (kind === 'area' && defKind === 'through-points') return 'area';
    if (kind === 'polygon' && defKind === 'through-points') return 'polygon';
    if (kind === 'measure' && (defKind === 'distance' || defKind === 'angle')) return 'measure';
    if (kind === 'text' && defKind === 'free-text') return 'text';

    return '';
  }

  function copyConstructionPresentationToLegacy(raw, out) {
    if (raw.label !== undefined) out.label = String(raw.label);
    if (raw.visible === false) out.visible = false;
    if (raw.style && typeof raw.style === 'object' && !Array.isArray(raw.style)) out.style = deepClone(raw.style);
    if (raw.draggable !== undefined) out.draggable = !!raw.draggable;
    return out;
  }

  function copyLegacyPresentationToConstruction(raw, out) {
    if (raw.label !== undefined && raw.label !== '') out.label = String(raw.label);
    if (raw.visible === false) out.visible = false;
    if (raw.style && typeof raw.style === 'object' && !Array.isArray(raw.style) && Object.keys(raw.style).length) {
      out.style = deepClone(raw.style);
    }
    if (raw.draggable !== undefined) out.draggable = !!raw.draggable;
    return out;
  }

  function copyOptionalEdgeIndex(source, target, sourceKey = 'edgeIndex', targetKey = 'edgeIndex') {
    const edgeIndex = normalizeEdgeIndex(source?.[sourceKey]);
    if (edgeIndex !== null) target[targetKey] = edgeIndex;
    return target;
  }

  function convertConstructionObjectToLegacy(raw, byId) {
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

    const out = copyConstructionPresentationToLegacy(raw, { id });

    if (kind === 'point' && defKind === 'free') {
      out.type = 'point';
      out.x = safeNumber(def.x, 0);
      out.y = safeNumber(def.y, 0);
      return out;
    }

    if (kind === 'point' && defKind === 'midpoint') {
      out.type = 'midpoint';
      out.p1 = String(def.p1 || '').trim();
      out.p2 = String(def.p2 || '').trim();
      return out;
    }

    if (kind === 'point' && defKind === 'on-object') {
      const objectId = String(def.objectId || '').trim();
      const target = byId.get(objectId);
      if (!target) throw new Error(`El punto "${id}" referencia "${objectId}", pero no existe.`);

      const targetType = getLegacyTypeFromConstructionObject(target);
      let constraintKind = '';

      if (targetType === 'segment' || targetType === 'polyline' || targetType === 'polygon') constraintKind = 'on-segment';
      if (targetType === 'line' || targetType === 'parallel-line' || targetType === 'perpendicular-line') constraintKind = 'on-line';
      if (targetType === 'ray') constraintKind = 'on-ray';
      if (targetType === 'circle' || targetType === 'circle-radius') constraintKind = 'on-circle';
      if (targetType === 'ellipse') constraintKind = 'on-ellipse';

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

      if (constraintKind === 'on-segment' && (targetType === 'polyline' || targetType === 'polygon')) {
        copyOptionalEdgeIndex(def, out.constraint);
      }

      return out;
    }

    if (kind === 'point' && defKind === 'intersection') {
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

    if (kind === 'point' && defKind === 'vector-end') {
      const vectorId = String(def.vectorId || '').trim();
      const target = byId.get(vectorId);
      if (!target) throw new Error(`El punto "${id}" referencia "${vectorId}", pero no existe.`);

      const targetType = getLegacyTypeFromConstructionObject(target);
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

    if (kind === 'segment' && defKind === 'between-points') {
      out.type = 'segment';
      out.p1 = String(def.p1 || '').trim();
      out.p2 = String(def.p2 || '').trim();
      return out;
    }

    if (kind === 'ray' && defKind === 'from-point-through-point') {
      out.type = 'ray';
      out.p1 = String(def.origin || '').trim();
      out.p2 = String(def.through || '').trim();
      return out;
    }

    if (kind === 'vector' && defKind === 'between-points') {
      out.type = 'vector';
      out.p1 = String(def.p1 || '').trim();
      out.p2 = String(def.p2 || '').trim();
      return out;
    }

    if (kind === 'vector' && defKind === 'equipollent-from-point') {
      out.type = 'equipollent-vector';
      out.point = String(def.point || '').trim();
      out.vectorId = String(def.vectorId || '').trim();
      return out;
    }

    if (kind === 'line' && defKind === 'through-two-points') {
      out.type = 'line';
      out.p1 = String(def.p1 || '').trim();
      out.p2 = String(def.p2 || '').trim();
      return out;
    }

    if (kind === 'line' && defKind === 'parallel-through-point') {
      out.type = 'parallel-line';
      out.objectId = String(def.objectId || '').trim();
      out.point = String(def.point || '').trim();
      copyOptionalEdgeIndex(def, out);
      return out;
    }

    if (kind === 'line' && defKind === 'perpendicular-through-point') {
      out.type = 'perpendicular-line';
      out.objectId = String(def.objectId || '').trim();
      out.point = String(def.point || '').trim();
      copyOptionalEdgeIndex(def, out);
      return out;
    }

    if (kind === 'circle' && defKind === 'center-through-point') {
      out.type = 'circle';
      out.center = String(def.center || '').trim();
      out.through = String(def.through || '').trim();
      return out;
    }

    if (kind === 'circle' && defKind === 'center-radius') {
      out.type = 'circle-radius';
      out.center = String(def.center || '').trim();
      out.radius = safeNumber(def.radius, 0);
      return out;
    }

    if (kind === 'ellipse' && defKind === 'center-radii-rotation') {
      out.type = 'ellipse';
      out.center = String(def.center || '').trim();
      out.rx = safeNumber(def.rx, 0);
      out.ry = safeNumber(def.ry, 0);
      out.rotation = safeNumber(def.rotation, 0);
      return out;
    }

    if (kind === 'polyline' && defKind === 'through-points') {
      out.type = 'polyline';
      out.points = Array.isArray(def.points) ? deepClone(def.points) : [];
      return out;
    }

    if (kind === 'area' && defKind === 'through-points') {
      out.type = 'area';
      out.points = Array.isArray(def.points) ? deepClone(def.points) : [];
      return out;
    }

    if (kind === 'polygon' && defKind === 'through-points') {
      out.type = 'polygon';
      out.points = Array.isArray(def.points) ? deepClone(def.points) : [];
      return out;
    }

    if (kind === 'measure' && (defKind === 'distance' || defKind === 'angle')) {
      out.type = 'measure';
      out.measureType = defKind;
      out.of = Array.isArray(def.of) ? deepClone(def.of) : [];
      if (defKind === 'angle') out.unit = String(def.unit || 'deg').trim().toLowerCase();
      return out;
    }

    if (kind === 'text' && defKind === 'free-text') {
      out.type = 'text';
      out.x = safeNumber(def.x, 0);
      out.y = safeNumber(def.y, 0);
      out.text = String(def.text ?? '');
      return out;
    }

    throw new Error(`El objeto "${id}" usa una construcción no soportada: ${kind}/${defKind}.`);
  }

  function convertConstructionSceneToLegacy(scene) {
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
        : scene.viewport && typeof scene.viewport === 'object' && !Array.isArray(scene.viewport)
          ? deepClone(scene.viewport)
          : {},
      style: scene.style && typeof scene.style === 'object' && !Array.isArray(scene.style) ? deepClone(scene.style) : {},
      objects: sourceObjects.map(raw => convertConstructionObjectToLegacy(raw, byId))
    };
  }

  function buildConstructionObjectFromLegacy(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    let out = null;

    if (raw.type === 'point' && raw.constraint) {
      const constraint = raw.constraint || {};
      if (constraint.kind === 'intersection') {
        out = {
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
      } else if (constraint.kind === 'vector-end') {
        out = {
          id: raw.id,
          kind: 'point',
          def: {
            kind: 'vector-end',
            vectorId: constraint.objectId
          }
        };
      } else {
        const mode = (constraint.kind === 'on-circle' || constraint.kind === 'on-ellipse') ? 'angle' : 't';
        out = {
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
      }
    } else if (raw.type === 'point') {
      out = {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'free',
          x: safeNumber(raw.x, 0),
          y: safeNumber(raw.y, 0)
        }
      };
    } else if (raw.type === 'midpoint') {
      out = {
        id: raw.id,
        kind: 'point',
        def: {
          kind: 'midpoint',
          p1: raw.p1,
          p2: raw.p2
        }
      };
    } else if (raw.type === 'segment') {
      out = {
        id: raw.id,
        kind: 'segment',
        def: {
          kind: 'between-points',
          p1: raw.p1,
          p2: raw.p2
        }
      };
    } else if (raw.type === 'ray') {
      out = {
        id: raw.id,
        kind: 'ray',
        def: {
          kind: 'from-point-through-point',
          origin: raw.p1,
          through: raw.p2
        }
      };
    } else if (raw.type === 'vector') {
      out = {
        id: raw.id,
        kind: 'vector',
        def: {
          kind: 'between-points',
          p1: raw.p1,
          p2: raw.p2
        }
      };
    } else if (raw.type === 'equipollent-vector') {
      out = {
        id: raw.id,
        kind: 'vector',
        def: {
          kind: 'equipollent-from-point',
          point: raw.point,
          vectorId: raw.vectorId
        }
      };
    } else if (raw.type === 'line') {
      out = {
        id: raw.id,
        kind: 'line',
        def: {
          kind: 'through-two-points',
          p1: raw.p1,
          p2: raw.p2
        }
      };
    } else if (raw.type === 'parallel-line') {
      out = {
        id: raw.id,
        kind: 'line',
        def: {
          kind: 'parallel-through-point',
          objectId: raw.objectId,
          point: raw.point
        }
      };
      copyOptionalEdgeIndex(raw, out.def);
    } else if (raw.type === 'perpendicular-line') {
      out = {
        id: raw.id,
        kind: 'line',
        def: {
          kind: 'perpendicular-through-point',
          objectId: raw.objectId,
          point: raw.point
        }
      };
      copyOptionalEdgeIndex(raw, out.def);
    } else if (raw.type === 'circle') {
      out = {
        id: raw.id,
        kind: 'circle',
        def: {
          kind: 'center-through-point',
          center: raw.center,
          through: raw.through
        }
      };
    } else if (raw.type === 'circle-radius') {
      out = {
        id: raw.id,
        kind: 'circle',
        def: {
          kind: 'center-radius',
          center: raw.center,
          radius: safeNumber(raw.radius, 0)
        }
      };
    } else if (raw.type === 'ellipse') {
      out = {
        id: raw.id,
        kind: 'ellipse',
        def: {
          kind: 'center-radii-rotation',
          center: raw.center,
          rx: safeNumber(raw.rx, 0),
          ry: safeNumber(raw.ry, 0),
          rotation: safeNumber(raw.rotation, 0)
        }
      };
    } else if (raw.type === 'polyline') {
      out = {
        id: raw.id,
        kind: 'polyline',
        def: {
          kind: 'through-points',
          points: Array.isArray(raw.points) ? deepClone(raw.points) : []
        }
      };
    } else if (raw.type === 'area') {
      out = {
        id: raw.id,
        kind: 'area',
        def: {
          kind: 'through-points',
          points: Array.isArray(raw.points) ? deepClone(raw.points) : []
        }
      };
    } else if (raw.type === 'polygon') {
      out = {
        id: raw.id,
        kind: 'polygon',
        def: {
          kind: 'through-points',
          points: Array.isArray(raw.points) ? deepClone(raw.points) : []
        }
      };
    } else if (raw.type === 'measure') {
      const measureKind = raw.measureType === 'angle' ? 'angle' : 'distance';
      out = {
        id: raw.id,
        kind: 'measure',
        def: {
          kind: measureKind,
          of: Array.isArray(raw.of) ? deepClone(raw.of) : []
        }
      };
      if (measureKind === 'angle') out.def.unit = String(raw.unit || 'deg').trim().toLowerCase();
    } else if (raw.type === 'text') {
      out = {
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

    if (!out) return null;

    return copyLegacyPresentationToConstruction(raw, out);
  }

  function serializeConstructionScene(sceneLike) {
    const meta = sceneLike?.meta && typeof sceneLike.meta === 'object' && !Array.isArray(sceneLike.meta)
      ? deepClone(sceneLike.meta)
      : { title: 'Escena Geo2D' };
    const viewSource = sceneLike?.view && typeof sceneLike.view === 'object' && !Array.isArray(sceneLike.view)
      ? sceneLike.view
      : sceneLike?.viewport;
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
        .map(obj => buildConstructionObjectFromLegacy(typeof obj?.toJSON === 'function' ? obj.toJSON() : obj))
        .filter(Boolean)
    };
  }

  function prepareScene(scene) {
    const normalized = sceneUsesConstructionSchema(scene) ? convertConstructionSceneToLegacy(scene) : scene;
    const out = ensureScene(normalized);

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
.geo2d-root.geo2d-tools-collapsed .geo2d-side {
  padding: 10px !important;
}
.geo2d-root.geo2d-tools-collapsed .geo2d-pane-head strong {
  display: none !important;
}
@media (max-width: 820px) {
  .geo2d-body { grid-template-columns: 1fr !important; }
  .geo2d-root.geo2d-tools-collapsed .geo2d-body { grid-template-columns: 1fr !important; }
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
    return ellipseWorldPoints(resolved.center, resolved.rx, resolved.ry, resolved.rotation, steps)
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

    const origin = ellipseLocalCoordinates(
      ellipseResolved.center,
      ellipseResolved.rotation,
      line.p.x,
      line.p.y
    );
    const direction = ellipseLocalCoordinates(
      { x: 0, y: 0 },
      ellipseResolved.rotation,
      line.dx,
      line.dy
    );
    const rx = Math.max(Math.abs(ellipseResolved.rx), 1e-9);
    const ry = Math.max(Math.abs(ellipseResolved.ry), 1e-9);
    const invRx2 = 1 / (rx * rx);
    const invRy2 = 1 / (ry * ry);

    const a = direction.x * direction.x * invRx2 + direction.y * direction.y * invRy2;
    const b = 2 * (origin.x * direction.x * invRx2 + origin.y * direction.y * invRy2);
    const c = origin.x * origin.x * invRx2 + origin.y * origin.y * invRy2 - 1;
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
      : ellipseWorldPoints(resolvedA.center, resolvedA.rx, resolvedA.ry, resolvedA.rotation, 240);

    const pointsB = resolvedB.kind === 'circle'
      ? circleWorldPoints(resolvedB.center, resolvedB.radius, 240)
      : ellipseWorldPoints(resolvedB.center, resolvedB.rx, resolvedB.ry, resolvedB.rotation, 240);

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

  function resolveObjectIntersections(resolvedA, resolvedB, options = {}) {
    if (!resolvedA || !resolvedB) return [];

    const edgeIndexA = normalizeEdgeIndex(options.edgeIndexA);
    const edgeIndexB = normalizeEdgeIndex(options.edgeIndexB);
    const restrictedA = resolveSegmentLikeReference(resolvedA, edgeIndexA);
    const restrictedB = resolveSegmentLikeReference(resolvedB, edgeIndexB);

    let hits = [];
    if (restrictedA && isLinearResolvedKind(resolvedB.kind)) {
      hits = linearLinearIntersections(restrictedA, resolvedB);
    } else if (restrictedB && isLinearResolvedKind(resolvedA.kind)) {
      hits = linearLinearIntersections(resolvedA, restrictedB);
    } else if (restrictedA && resolvedB.kind === 'circle') {
      hits = linearCircleIntersections(restrictedA, resolvedB);
    } else if (restrictedB && resolvedA.kind === 'circle') {
      hits = linearCircleIntersections(restrictedB, resolvedA);
    } else if (restrictedA && resolvedB.kind === 'ellipse') {
      hits = linearEllipseIntersections(restrictedA, resolvedB);
    } else if (restrictedB && resolvedA.kind === 'ellipse') {
      hits = linearEllipseIntersections(restrictedB, resolvedA);
    } else if (restrictedA && restrictedB) {
      const hit = segmentIntersectionPointWorld(restrictedA.p1, restrictedA.p2, restrictedB.p1, restrictedB.p2);
      hits = hit ? [hit] : [];
    } else if (isLinearResolvedKind(resolvedA.kind) && isLinearResolvedKind(resolvedB.kind)) {
      hits = linearLinearIntersections(resolvedA, resolvedB);
    } else if (isSegmentChainResolvedKind(resolvedA.kind) && isLinearResolvedKind(resolvedB.kind)) {
      hits = segmentChainIntersections(resolvedA, resolvedB, { edgeIndex: edgeIndexA });
    } else if (isSegmentChainResolvedKind(resolvedB.kind) && isLinearResolvedKind(resolvedA.kind)) {
      hits = segmentChainIntersections(resolvedB, resolvedA, { edgeIndex: edgeIndexB });
    } else if (isLinearResolvedKind(resolvedA.kind) && resolvedB.kind === 'circle') {
      hits = linearCircleIntersections(resolvedA, resolvedB);
    } else if (isLinearResolvedKind(resolvedB.kind) && resolvedA.kind === 'circle') {
      hits = linearCircleIntersections(resolvedB, resolvedA);
    } else if (isSegmentChainResolvedKind(resolvedA.kind) && resolvedB.kind === 'circle') {
      hits = segmentChainIntersections(resolvedA, resolvedB, { edgeIndex: edgeIndexA });
    } else if (isSegmentChainResolvedKind(resolvedB.kind) && resolvedA.kind === 'circle') {
      hits = segmentChainIntersections(resolvedB, resolvedA, { edgeIndex: edgeIndexB });
    } else if (isLinearResolvedKind(resolvedA.kind) && resolvedB.kind === 'ellipse') {
      hits = linearEllipseIntersections(resolvedA, resolvedB);
    } else if (isLinearResolvedKind(resolvedB.kind) && resolvedA.kind === 'ellipse') {
      hits = linearEllipseIntersections(resolvedB, resolvedA);
    } else if (isSegmentChainResolvedKind(resolvedA.kind) && resolvedB.kind === 'ellipse') {
      hits = segmentChainIntersections(resolvedA, resolvedB, { edgeIndex: edgeIndexA });
    } else if (isSegmentChainResolvedKind(resolvedB.kind) && resolvedA.kind === 'ellipse') {
      hits = segmentChainIntersections(resolvedB, resolvedA, { edgeIndex: edgeIndexB });
    } else if (resolvedA.kind === 'circle' && resolvedB.kind === 'circle') {
      hits = circleCircleIntersections(resolvedA, resolvedB);
    } else if (isSegmentChainResolvedKind(resolvedA.kind) && isSegmentChainResolvedKind(resolvedB.kind)) {
      hits = segmentChainIntersections(resolvedA, resolvedB, {
        edgeIndex: edgeIndexA,
        otherEdgeIndex: edgeIndexB
      });
    } else if (isCurveResolvedKind(resolvedA.kind) && isCurveResolvedKind(resolvedB.kind)) {
      hits = curveCurveApproxIntersections(resolvedA, resolvedB);
    }

    return sortWorldPoints(dedupeWorldPoints(hits));
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

  class ConstraintFactory {
    static fromRaw(raw) {
      if (!raw || !raw.kind) return null;
      if (raw.kind === 'on-segment') return new OnSegmentConstraint(raw);
      if (raw.kind === 'on-line') return new OnLineConstraint(raw);
      if (raw.kind === 'on-ray') return new OnRayConstraint(raw);
      if (raw.kind === 'on-circle') return new OnCircleConstraint(raw);
      if (raw.kind === 'on-ellipse') return new OnEllipseConstraint(raw);
      if (raw.kind === 'intersection') return new IntersectionConstraint(raw);
      if (raw.kind === 'vector-end') return new VectorEndConstraint(raw);
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

  class AreaObject extends GeoObject {
    constructor(raw = {}) {
      super(raw);
      this.raw.type = 'area';
    }

    getRefs() {
      return Array.isArray(this.raw.points) ? [...this.raw.points] : [];
    }

    getResolved(model) {
      const points = (this.raw.points || []).map(id => model.getPointPosition(id)).filter(Boolean);
      if (points.length < 3) return null;
      return { kind: 'area', points, ref: this };
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
      if (raw.type === 'vector') return new VectorObject(raw);
      if (raw.type === 'equipollent-vector') return new EquipollentVectorObject(raw);
      if (raw.type === 'parallel-line') return new ParallelLineObject(raw);
      if (raw.type === 'perpendicular-line') return new PerpendicularLineObject(raw);
      if (raw.type === 'circle') return new CircleObject(raw);
      if (raw.type === 'circle-radius') return new CircleRadiusObject(raw);
      if (raw.type === 'ellipse') return new EllipseObject(raw);
      if (raw.type === 'polyline') return new PolylineObject(raw);
      if (raw.type === 'area') return new AreaObject(raw);
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

    serialize() {
      return serializeConstructionScene({
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
          { id: 'area', label: 'Área' },
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

    if (sceneVp.showGrid) {
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

    if (sceneVp.showAxes) {
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
      const isHoveredObject = object.id === hoverObjectId && object.id !== selectedObjectId;
      const isToolReference = object.id === toolReferenceObjectId && object.id !== selectedObjectId;
      const shapeStroke = getShapeStroke(style, isSelected, isHoveredObject, isToolReference);


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
    stroke: shapeStroke.stroke,
    'stroke-width': shapeStroke.strokeWidth
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
    stroke: shapeStroke.stroke,
    'stroke-width': shapeStroke.strokeWidth
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
    stroke: shapeStroke.stroke,
    'stroke-width': shapeStroke.strokeWidth
  });
}

if (resolved.kind === 'vector') {
  if (isSelected) {
    renderVector(gShapes, vp, width, height, resolved.p1, resolved.p2, {
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 4,
      opacity: 0.25
    });
  }

  renderVector(gShapes, vp, width, height, resolved.p1, resolved.p2, {
    stroke: shapeStroke.stroke,
    'stroke-width': shapeStroke.strokeWidth
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
    stroke: shapeStroke.stroke,
    'stroke-width': shapeStroke.strokeWidth,
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
    stroke: shapeStroke.stroke,
    'stroke-width': shapeStroke.strokeWidth,
    fill: style.fill || 'none'
  }));
}


if (resolved.kind === 'polyline') {
  const pts = resolved.points.map(p => {
    const s = worldToScreen(vp, width, height, p.x, p.y);
    return `${s.x},${s.y}`;
  }).join(' ');

  if (isSelected) {
    gShapes.appendChild(createSvgEl('polyline', {
      points: pts,
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 4,
      opacity: 0.25,
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

if (resolved.kind === 'area') {
  const screenPts = resolved.points.map(p => worldToScreen(vp, width, height, p.x, p.y));
  const path = screenPointsPath(screenPts, true);

  if (isSelected) {
    gShapes.appendChild(createSvgEl('path', {
      d: path,
      stroke: '#7c3aed',
      'stroke-width': style.strokeWidth + 3,
      fill: 'rgba(124,58,237,0.12)'
    }));
  }

  gShapes.appendChild(createSvgEl('path', {
    d: path,
    stroke: shapeStroke.stroke === 'none' ? 'none' : shapeStroke.stroke,
    'stroke-width': shapeStroke.strokeWidth,
    fill: style.fill && style.fill !== 'none' ? style.fill : 'rgba(20,184,166,0.18)'
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
    stroke: shapeStroke.stroke,
    'stroke-width': shapeStroke.strokeWidth,
    fill: style.fill || 'none'
  }));
}


if (resolved.kind === 'measure' && object instanceof MeasureObject) {
  const info = resolveMeasure(model, object, vp);

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
      !previewAnchor.fromPointId &&
      (
        !['parallel-line', 'perpendicular-line'].includes(state.activeTool) ||
        state._toolData?.referenceObjectId
      ) &&
      (
        state.activeTool !== 'vector-equipollent' ||
        state._toolData?.vectorObjectId
      )
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

    if (
      previewAnchor &&
      state._toolData?.referenceObjectId &&
      (state.activeTool === 'parallel-line' || state.activeTool === 'perpendicular-line')
    ) {
      const referenceResolved = model.getResolvedObject(state._toolData.referenceObjectId);
      const reference = resolveSegmentLikeReference(referenceResolved, state._toolData.referenceEdgeIndex) || referenceResolved;
      if (reference && ['segment', 'line', 'ray'].includes(reference.kind)) {
        let dx = reference.p2.x - reference.p1.x;
        let dy = reference.p2.y - reference.p1.y;

        if (state.activeTool === 'perpendicular-line') {
          const nextDx = -dy;
          const nextDy = dx;
          dx = nextDx;
          dy = nextDy;
        }

        if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) {
          renderInfiniteLine(gPreview, vp, width, height, previewAnchor, {
            x: previewAnchor.x + dx,
            y: previewAnchor.y + dy
          }, {
            stroke: previewColor,
            'stroke-width': 2,
            class: 'geo2d-preview-stroke'
          });
        }
      }
    }

    if (
      state.activeTool === 'intersect' &&
      state._toolData?.intersectionObjectId &&
      state._hoverObjectId &&
      state._hoverObjectId !== state._toolData.intersectionObjectId &&
      state._previewWorld
    ) {
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
        const previewScreen = worldToScreen(vp, width, height, previewPoint.x, previewPoint.y);
        const previewRadius = safeNumber(model.style?.pointRadius, 5);
        const previewCaptureRadius = safeNumber(model.style?.pointCaptureRadius, 14);

        gPointTargets.appendChild(createSvgEl('circle', {
          cx: previewScreen.x,
          cy: previewScreen.y,
          r: previewCaptureRadius,
          fill: 'rgba(22,163,74,0.08)',
          stroke: '#16a34a',
          'stroke-width': 1.5,
          class: 'geo2d-preview-stroke'
        }));

        gPreview.appendChild(createSvgEl('circle', {
          cx: previewScreen.x,
          cy: previewScreen.y,
          r: previewRadius,
          fill: '#ffffff',
          stroke: '#16a34a',
          'stroke-width': 2.5,
          class: 'geo2d-preview-stroke'
        }));
      }
    }

    if (state.activeTool === 'vector-equipollent' && previewAnchor && state._toolData?.vectorObjectId) {
      const baseVector = model.getResolvedObject(state._toolData.vectorObjectId);
      if (baseVector && baseVector.kind === 'vector') {
        const dx = baseVector.p2.x - baseVector.p1.x;
        const dy = baseVector.p2.y - baseVector.p1.y;
        renderVector(gPreview, vp, width, height, previewAnchor, {
          x: previewAnchor.x + dx,
          y: previewAnchor.y + dy
        }, {
          stroke: previewColor,
          'stroke-width': 2,
          class: 'geo2d-preview-stroke'
        });
      }
    }

    if (state._pendingPoints.length > 0 && previewAnchor) {
      const first = model.getPointPosition(state._pendingPoints[0]);
      const second = state._pendingPoints.length > 1 ? model.getPointPosition(state._pendingPoints[1]) : null;

      if (first && ['segment', 'line', 'ray', 'vector', 'circle', 'midpoint', 'measure-distance'].includes(state.activeTool)) {
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

        if (state.activeTool === 'vector') {
          renderVector(gPreview, vp, width, height, first, previewAnchor, {
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

      if (['polyline', 'area', 'polygon'].includes(state.activeTool)) {
        const pts = [];
        for (const id of state._pendingPoints) {
          const p = model.getPointPosition(id);
          if (p) pts.push(p);
        }

        if (pts.length > 0) {
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
              stroke: previewColor,
              'stroke-width': 2,
              fill: 'none',
              class: 'geo2d-preview-stroke'
            }));
          } else {
            gPreview.appendChild(createSvgEl('polygon', {
              points: pointsAttr,
              stroke: previewColor,
              'stroke-width': 2,
              fill: state.activeTool === 'area' ? 'rgba(20,184,166,0.12)' : 'rgba(234,88,12,0.10)',
              class: 'geo2d-preview-stroke'
            }));
          }
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

      for (let i = 0; i < last; i++) {
        const p1 = resolved.points[i];
        const p2 = resolved.points[(i + 1) % resolved.points.length];
        const d2 = this.p2s(sx, sy, p1, p2, vp);
        if (!best || d2 < best.d2) {
          best = { edgeIndex: i, d2, p1, p2 };
        }
      }

      return best;
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
        if (hit.d2 < 100) hits.push({ id: obj.id, priority: hit.priority, d2: hit.d2 });
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

      if (resolved.kind === 'segment') d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);
      if (resolved.kind === 'line') d2 = this.p2l(sx, sy, resolved.p1, resolved.p2, vp);
      if (resolved.kind === 'ray') d2 = this.p2r(sx, sy, resolved.p1, resolved.p2, vp);
      if (resolved.kind === 'vector') d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);

      if (resolved.kind === 'circle') {
        const cs = circleScreenRadius(vp, this.width, this.height, resolved.center.x, resolved.center.y, resolved.radius);
        d2 = this.p2circleBorderSquared(sx, sy, cs.cx, cs.cy, cs.r);
      }

      if (resolved.kind === 'ellipse') {
        const screenPts = ellipseScreenPoints(vp, this.width, this.height, resolved, 96);
        d2 = p2screenPolylineSquared(sx, sy, screenPts, true);
      }

      if (resolved.kind === 'polyline') {
        d2 = this.p2polylineEdgesSquared(sx, sy, resolved.points, vp, false);
        priority = 3;
      }

      if (resolved.kind === 'area' || resolved.kind === 'polygon') {
        d2 = includeInterior && this.pointInWorldPolygonScreen(sx, sy, resolved.points, vp)
          ? 0
          : this.p2polylineEdgesSquared(sx, sy, resolved.points, vp, true);
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

    nearestAnchorObjectAtScreen(sx, sy, world) {
      const vp = this.getScreenViewport();
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

        if (isSegmentChainResolvedKind(resolved.kind)) {
          const edgeHit = this.getNearestBoundaryEdgeHit(resolved, sx, sy, vp);
          if (edgeHit) {
            d2 = edgeHit.d2;
            if (d2 < bestD2) {
              constraint = {
                kind: 'on-segment',
                objectId: obj.id,
                edgeIndex: edgeHit.edgeIndex,
                t: projectParameter(edgeHit.p1.x, edgeHit.p1.y, edgeHit.p2.x, edgeHit.p2.y, world.x, world.y, true)
              };
            }
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
          const cs = circleScreenRadius(vp, this.width, this.height, resolved.center.x, resolved.center.y, resolved.radius);
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
          const screenPts = ellipseScreenPoints(vp, this.width, this.height, resolved, 96);
          d2 = p2screenPolylineSquared(sx, sy, screenPts, true);
          if (d2 < bestD2) {
            constraint = {
              kind: 'on-ellipse',
              objectId: obj.id,
              angle: ellipseAngleFromWorld(resolved.center, resolved.rx, resolved.ry, resolved.rotation, world.x, world.y)
            };
          }
        }

        if (constraint && d2 < 100 && d2 < bestD2) {
          best = { object: obj, constraint, d2 };
          bestD2 = d2;
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
        if (!resolved) continue;

        let d2 = Infinity;
        let edgeIndex = null;
        if (resolved.kind === 'segment') d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);
        if (resolved.kind === 'line') d2 = this.p2l(sx, sy, resolved.p1, resolved.p2, vp);
        if (resolved.kind === 'ray') d2 = this.p2r(sx, sy, resolved.p1, resolved.p2, vp);
        if (isSegmentChainResolvedKind(resolved.kind)) {
          const edgeHit = this.getNearestBoundaryEdgeHit(resolved, sx, sy, vp);
          if (edgeHit) {
            d2 = edgeHit.d2;
            edgeIndex = edgeHit.edgeIndex;
          }
        }

        if (d2 < 100 && d2 < bestD2) {
          best = { id: obj.id, edgeIndex };
          bestD2 = d2;
        }
      }

      return best;
    }

    nearestVectorAtScreen(sx, sy) {
      const vp = this.getScreenViewport();
      let best = null;
      let bestD2 = Infinity;

      for (const obj of this.model.objects) {
        if (!obj.isVisible() || !isVectorRawType(obj.raw.type)) continue;
        const resolved = this.model.getResolvedObject(obj.id);
        if (!resolved || resolved.kind !== 'vector') continue;

        const d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);
        if (d2 < 100 && d2 < bestD2) {
          best = obj;
          bestD2 = d2;
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
        if (!resolved || !['segment', 'line', 'ray', 'circle', 'ellipse', 'polyline', 'polygon'].includes(resolved.kind)) continue;

        let d2 = Infinity;
        let edgeIndex = null;
        if (resolved.kind === 'segment') d2 = this.p2s(sx, sy, resolved.p1, resolved.p2, vp);
        if (resolved.kind === 'line') d2 = this.p2l(sx, sy, resolved.p1, resolved.p2, vp);
        if (resolved.kind === 'ray') d2 = this.p2r(sx, sy, resolved.p1, resolved.p2, vp);
        if (isSegmentChainResolvedKind(resolved.kind)) {
          const edgeHit = this.getNearestBoundaryEdgeHit(resolved, sx, sy, vp);
          if (edgeHit) {
            d2 = edgeHit.d2;
            edgeIndex = edgeHit.edgeIndex;
          }
        }

        if (resolved.kind === 'circle') {
          const cs = circleScreenRadius(vp, this.width, this.height, resolved.center.x, resolved.center.y, resolved.radius);
          d2 = this.p2circleBorderSquared(sx, sy, cs.cx, cs.cy, cs.r);
        }

        if (resolved.kind === 'ellipse') {
          const screenPts = ellipseScreenPoints(vp, this.width, this.height, resolved, 96);
          d2 = p2screenPolylineSquared(sx, sy, screenPts, true);
        }

        if (d2 < 100 && d2 < bestD2) {
          best = { id: obj.id, edgeIndex };
          bestD2 = d2;
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
    { id: 'points', label: 'PUNTOS', types: Object.freeze(['point', 'midpoint']) },
    { id: 'lines', label: 'RECTAS', types: Object.freeze(['line', 'parallel-line', 'perpendicular-line', 'ray']) },
    { id: 'segments', label: 'SEGMENTOS Y VECTORES', types: Object.freeze(['segment', 'vector', 'equipollent-vector']) },
    { id: 'curves', label: 'CURVAS', types: Object.freeze(['circle', 'circle-radius', 'ellipse']) },
    { id: 'figures', label: 'FIGURAS', types: Object.freeze(['polyline', 'area', 'polygon']) },
    { id: 'measures', label: 'MEDIDAS', types: Object.freeze(['measure']) },
    { id: 'texts', label: 'TEXTOS', types: Object.freeze(['text']) },
    { id: 'others', label: 'OTROS', types: Object.freeze([]) }
  ]);

  function getObjectListGroup(raw) {
    const type = raw?.type || raw?.kind || '';
    return OBJECT_LIST_GROUPS.find(group => group.types.includes(type)) || OBJECT_LIST_GROUPS[OBJECT_LIST_GROUPS.length - 1];
  }

  function getObjectTypeLabel(raw) {
    const type = raw?.type || raw?.kind || '';
    if (type === 'point') return raw.constraint ? 'Punto dependiente' : 'Punto';
    if (type === 'midpoint') return 'Punto medio';
    if (type === 'segment') return 'Segmento';
    if (type === 'line') return 'Recta';
    if (type === 'parallel-line') return 'Recta paralela';
    if (type === 'perpendicular-line') return 'Recta perpendicular';
    if (type === 'ray') return 'Semirrecta';
    if (type === 'vector') return 'Vector libre';
    if (type === 'equipollent-vector') return 'Vector equipolente';
    if (type === 'circle') return 'Circunferencia (C,P)';
    if (type === 'circle-radius') return 'Circunferencia (C,r)';
    if (type === 'ellipse') return 'Elipse';
    if (type === 'polyline') return 'Poligonal';
    if (type === 'area') return 'Area';
    if (type === 'polygon') return 'Poligono';
    if (type === 'measure') return raw.measureType === 'angle' ? 'Angulo' : 'Medida de distancia';
    if (type === 'text') return 'Texto';
    return type || 'Objeto';
  }

  function describeObjectRefs(raw) {
    const refs = getRawObjectRefs(raw);
    return refs.length ? refs.join(', ') : '—';
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
      if (tool === 'area') return 'Area';
      return 'Poligono';
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
      editor.selectedObjectId = picked.id;
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
        editor.setStatus('El texto no puede quedar vacio.', true);
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
      editor.selectedObjectId = id;
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
        editor.setStatus('Elipse: define la direccion y longitud del semieje X.');
        return;
      }

      const center = this.model.getPointPosition(editor._pendingPoints[0]);
      if (!center) {
        editor.resetConstructionState();
        editor.renderAndSync();
        editor.setStatus('No se pudo resolver el centro de la elipse.', true);
        return;
      }

      const snapped = editor.getSnappedWorldPosition(world, sx, sy);

      if (!editor._toolData?.ellipse) {
        const rx = dist(center.x, center.y, snapped.x, snapped.y);
        if (!(rx > 1e-9)) {
          editor.setStatus('El semieje X debe ser mayor que 0.', true);
          return;
        }

        editor._toolData = {
          ellipse: {
            rx,
            rotation: Math.atan2(snapped.y - center.y, snapped.x - center.x)
          }
        };
        editor._previewWorld = { x: snapped.x, y: snapped.y };
        editor.render();
        editor.setStatus('Elipse: define ahora el semieje Y.');
        return;
      }

      const draft = editor._toolData.ellipse;
      const local = ellipseLocalCoordinates(center, draft.rotation, snapped.x, snapped.y);
      const ry = Math.abs(local.y);

      if (!(ry > 1e-9)) {
        editor.setStatus('El semieje Y debe ser mayor que 0.', true);
        return;
      }

      this.model.addObject({
        id: editor.nextId('e'),
        type: 'ellipse',
        center: editor._pendingPoints[0],
        rx: draft.rx,
        ry,
        rotation: draft.rotation,
        style: { stroke: '#9333ea' }
      });

      editor.resetConstructionState();
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
        editor.setStatus('El radio debe ser un numero mayor que 0.', true);
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
          editor.setStatus('Interseccion: selecciona el primer objeto.', true);
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
        editor.setStatus('Interseccion: selecciona el segundo objeto.');
        return;
      }

      const firstObjectId = editor._toolData.intersectionObjectId;
      const secondObject = editor.findNearestIntersectableObjectAtScreen(sx, sy, firstObjectId);
      if (!secondObject) {
        editor.setStatus('Interseccion: selecciona un segundo objeto compatible.', true);
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
      editor.selectedObjectId = pointId;
      editor.renderAndSync();
      editor.setStatus(
        intersections.length > 1
          ? 'Punto de interseccion creado. Se eligio el mas cercano al clic.'
          : 'Punto de interseccion creado.'
      );
    }

    handleDerivedLineClick(world, sx, sy) {
      const editor = this.editor;
      const isParallel = this.activeTool === 'parallel-line';

      if (!editor._toolData?.referenceObjectId) {
        const referenceObject = editor.findNearestDirectionalObjectAtScreen(sx, sy);
        if (!referenceObject) {
          editor.setStatus('Selecciona un segmento, recta, semirrecta o una arista de poligonal/poligono.', true);
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
            ? 'Paralela: selecciona el punto por donde pasara la recta.'
            : 'Perpendicular: selecciona el punto por donde pasara la recta.'
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
      editor.selectedObjectId = endPointId;
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
        editor.setStatus('Angulo: selecciona el vertice.');
        return;
      }

      if (editor._pendingPoints.length === 2) {
        editor.renderAndSync();
        editor.setStatus('Angulo: selecciona el tercer punto.');
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
        editor.setStatus('Angulo creado.');
      }
    }

    getSecondPointPromptForTool() {
      if (this.activeTool === 'ray') return 'Semirrecta: selecciona un punto de direccion.';
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
      editor.setStatus(tool === 'polygon' ? 'Poligono creado.' : `${label} creada.`);
    }
  }

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
      this._selectionCycleIndex = 0;
      this._lastHitIds = [];
      this._lastHitSx = null;
      this._lastHitSy = null;
      this._deferredSync = false;
      this.undoStack = [];
      this.redoStack = [];
      this._historyLimit = 120;
      this._historySignature = '';
      this._publishedHtml = { explore: '', locked: '' };
      this.toolPanelOpen = true;
      this.rightPanelOpen = { objects: true, properties: true };

      this.buildLayout();
      this.bindUI();
      this.syncJsonFromScene();
      this.refreshUI();
      this.render();
      this.resetHistory();
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
                  <strong class="geo2d-section-title">Objetos del area grafica</strong>
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
                  <label class="geo2d-field"><span>ID</span><input class="geo2d-prop-id" type="text" readonly></label>
                  <label class="geo2d-field"><span>Tipo</span><input class="geo2d-prop-type" type="text" readonly></label>
                  <label class="geo2d-field"><span>Nombre / etiqueta</span><input class="geo2d-prop-label" type="text"></label>
                  <label class="geo2d-field"><span>Dependencia / referencias</span><input class="geo2d-prop-refs" type="text" readonly></label>
                  <label class="geo2d-field geo2d-prop-extra-wrap"><span>Unidad</span>
                    <select class="geo2d-prop-extra"><option value="deg">Grados</option><option value="rad">Radianes</option></select>
                  </label>
                  <label class="geo2d-check"><input class="geo2d-prop-visible" type="checkbox"> Visible</label>
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
      this.propExtraWrapEl = this.root.querySelector('.geo2d-prop-extra-wrap');
      this.propExtraSelectEl = this.root.querySelector('.geo2d-prop-extra');
      this.modalBackdrop = this.root.querySelector('.geo2d-modal-backdrop');
      this.publishArea = this.root.querySelector('.geo2d-publish-area');

      this.hiddenFileInput = document.createElement('input');
      this.hiddenFileInput.type = 'file';
      this.hiddenFileInput.accept = '.json,.geo2d.json,application/json';
      this.hiddenFileInput.style.display = 'none';
      this.root.appendChild(this.hiddenFileInput);
    }

    bindUI() {
      if (this.mode !== 'viewer') {
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

        this.objectListEl?.addEventListener('click', (e) => {
          const item = e.target.closest('[data-object-id]');
          if (item) this.selectObject(item.dataset.objectId);
        });

        this.titleInput?.addEventListener('input', () => {
          this.model.meta.title = this.titleInput.value || 'Escena Geo2D';
          this.syncJsonFromScene();
        });
        this.titleInput?.addEventListener('change', () => this.commitHistoryState());

        this.propLabelEl?.addEventListener('input', () => {
          const obj = this.getSelectedObject();
          if (!obj) return;
          if (obj.raw.type === 'text') obj.raw.text = this.propLabelEl.value;
          else obj.raw.label = this.propLabelEl.value;
          this.renderAndSync(false);
        });
        this.propLabelEl?.addEventListener('change', () => this.commitHistoryState());

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

        this.hiddenFileInput.addEventListener('change', () => {
          const file = this.hiddenFileInput.files && this.hiddenFileInput.files[0];
          if (!file) return;
          file.text().then(text => this.loadSceneFromText(text));
          this.hiddenFileInput.value = '';
        });
      }

      this.svg.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      this.svg.addEventListener('pointermove', (e) => this.onPointerMove(e));
      this.svg.addEventListener('pointerup', (e) => this.onPointerUp(e));
      this.svg.addEventListener('pointercancel', (e) => this.onPointerUp(e));
      this.svg.addEventListener('pointerleave', () => {
        if (!this._dragInfo && !this._viewDragInfo) this.clearHoverAndPreview();
      });
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
      this._deferredSync = true;
    }

    renderAndSync(commit = true) {
      this.render();
      this.syncJsonFromScene();
      if (commit) this.commitHistoryState();
    }

    flushDeferredSync() {
      if (!this._deferredSync) return;
      this._deferredSync = false;
      this.syncJsonFromScene();
      this.refreshUI();
    }

    syncJsonFromScene() {
      if (this.titleInput) this.titleInput.value = this.model.meta.title || 'Nueva escena';
      if (this.jsonArea) this.jsonArea.value = jsonPretty(this.model.serialize());
    }

    applySceneState(scene, options = {}) {
      this.model.replaceScene(scene);
      this.hitTester = new Geo2DHitTester(this);
      this.construction = new Geo2DConstructionControllerV2(this);
      this._objectCounter = this.model.objects.length + 1;
      this.resetConstructionState();
      if (options.clearSelection) this.selectedObjectId = null;
      if (options.selectedObjectId !== undefined) this.selectedObjectId = options.selectedObjectId;
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
      return {
        scene: this.model.serialize(),
        selectedObjectId: this.selectedObjectId,
        activeTab: this.activeTab
      };
    }

    applyHistoryEntry(entry) {
      if (!entry || !entry.scene) return;
      this.applySceneState(entry.scene, {
        clearSelection: true,
        selectedObjectId: entry.selectedObjectId,
        activeTab: entry.activeTab,
        syncJson: true
      });
    }

    commitHistoryState() {
      if (this.mode === 'viewer') return false;
      const entry = this.createHistoryEntry();
      const signature = JSON.stringify(entry.scene);
      if (signature === this._historySignature) return false;
      this.undoStack.push(entry);
      if (this.undoStack.length > this._historyLimit) this.undoStack.shift();
      this.redoStack = [];
      this._historySignature = signature;
      this.refreshUI();
      return true;
    }

    resetHistory() {
      if (this.mode === 'viewer') return;
      const entry = this.createHistoryEntry();
      this.undoStack = [entry];
      this.redoStack = [];
      this._historySignature = JSON.stringify(entry.scene);
    }

    undoLastChange() {
      if (this.mode === 'viewer' || this.undoStack.length <= 1) return;
      const current = this.createHistoryEntry();
      const previous = this.undoStack[this.undoStack.length - 2];
      this.redoStack.push(current);
      this.undoStack.pop();
      this._historySignature = JSON.stringify(previous.scene);
      this.applyHistoryEntry(previous);
      this.setStatus('Cambio deshecho.');
    }

    redoLastChange() {
      if (this.mode === 'viewer' || !this.redoStack.length) return;
      const next = this.redoStack.pop();
      this.undoStack.push(deepClone(next));
      this._historySignature = JSON.stringify(next.scene);
      this.applyHistoryEntry(next);
      this.setStatus('Cambio rehecho.');
    }

    refreshUI() {
      if (this.mode === 'viewer') return;
      if (this.svg && this.jsonArea) {
        this.svg.style.display = this.activeTab === 'visual' ? 'block' : 'none';
        this.jsonArea.style.display = this.activeTab === 'json' ? 'block' : 'none';
      }

      this.root.querySelectorAll('.geo2d-tab').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === this.activeTab));
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

      this.root.classList.toggle('geo2d-tools-collapsed', this.toolPanelOpen === false);
      const toolsContent = this.root.querySelector('[data-section-content="tools"]');
      const toolsToggle = this.root.querySelector('[data-role="tools-toggle"]');
      if (toolsContent) toolsContent.style.setProperty('display', this.toolPanelOpen === false ? 'none' : 'grid', 'important');
      if (toolsToggle) toolsToggle.textContent = this.toolPanelOpen === false ? '+' : '-';

      const undoBtn = this.root.querySelector('[data-action="undo"]');
      const redoBtn = this.root.querySelector('[data-action="redo"]');
      if (undoBtn) undoBtn.disabled = this.undoStack.length <= 1;
      if (redoBtn) redoBtn.disabled = !this.redoStack.length;
      this.root.querySelectorAll('[data-right-section]').forEach(section => {
        const key = section.dataset.rightSection;
        const isOpen = this.rightPanelOpen?.[key] !== false;
        const content = section.querySelector('[data-section-content]');
        const toggle = section.querySelector('[data-role$="-toggle"]');
        if (content) content.style.setProperty('display', isOpen ? 'flex' : 'none', 'important');
        if (toggle) toggle.textContent = isOpen ? '-' : '+';
      });

      this.refreshObjectList();
      this.refreshProperties();
    }

    refreshObjectList() {
      if (!this.objectListEl) return;
      if (!this.model.objects.length) {
        this.objectListEl.innerHTML = '<div class="geo2d-object-empty">Sin objetos.</div>';
        return;
      }

      const buckets = new Map(OBJECT_LIST_GROUPS.map(group => [group.id, { group, objects: [] }]));
      for (const obj of this.model.objects) {
        const group = getObjectListGroup(obj.raw);
        buckets.get(group.id).objects.push(obj);
      }

      this.objectListEl.innerHTML = [...buckets.values()]
        .filter(bucket => bucket.objects.length)
        .map(bucket => `
          <div class="geo2d-object-group">
            <div class="geo2d-object-group-title">${escapeHtml(bucket.group.label)}</div>
            ${bucket.objects.map(obj => {
              const isVisible = obj.raw.visible !== false;
              return `
                <button type="button" class="geo2d-object-item${obj.id === this.selectedObjectId ? ' is-active' : ''}${isVisible ? '' : ' is-hidden'}" data-object-id="${escapeHtml(obj.id)}">
                  <span>${escapeHtml(obj.id)}</span>
                  <span class="geo2d-object-state">${isVisible ? 'visible' : 'oculto'}</span>
                </button>
              `;
            }).join('')}
          </div>
        `).join('');
    }

    refreshProperties() {
      const obj = this.getSelectedObject();
      const fields = [this.propIdEl, this.propTypeEl, this.propLabelEl, this.propRefsEl, this.propVisibleEl, this.propExtraSelectEl].filter(Boolean);
      fields.forEach(field => { field.disabled = !obj; });

      if (!this.propLabelEl || !this.propVisibleEl) return;
      if (!obj) {
        if (this.propIdEl) this.propIdEl.value = '';
        if (this.propTypeEl) this.propTypeEl.value = '';
        this.propLabelEl.value = '';
        if (this.propRefsEl) this.propRefsEl.value = '';
        this.propVisibleEl.checked = false;
        if (this.propExtraSelectEl) this.propExtraSelectEl.value = 'deg';
        return;
      }

      if (this.propIdEl) this.propIdEl.value = obj.id;
      if (this.propTypeEl) this.propTypeEl.value = getObjectTypeLabel(obj.raw);
      this.propLabelEl.value = obj.raw.type === 'text' ? (obj.raw.text || '') : (obj.raw.label || '');
      if (this.propRefsEl) this.propRefsEl.value = describeObjectRefs(obj.raw);
      this.propVisibleEl.checked = obj.raw.visible !== false;
      if (this.propExtraWrapEl && this.propExtraSelectEl) {
        const isAngle = obj.raw.type === 'measure' && obj.raw.measureType === 'angle';
        this.propExtraWrapEl.style.display = 'flex';
        this.propExtraSelectEl.disabled = !isAngle;
        this.propExtraSelectEl.value = isAngle && obj.raw.unit === 'rad' ? 'rad' : 'deg';
      }
    }

    handleAction(action) {
      try {
        switch (action) {
          case 'new':
            this.applySceneState(defaultScene(), { clearSelection: true, syncJson: true, resetHistory: true, status: 'Nueva escena.' });
            break;
          case 'load':
            this.hiddenFileInput?.click();
            break;
          case 'save':
            downloadTextFile(`${slugify(this.model.meta.title)}.geo2d.json`, jsonPretty(this.model.serialize()));
            this.setStatus('Guardado.');
            break;
          case 'copyjson':
            copyTextToClipboard(jsonPretty(this.model.serialize())).then(() => this.setStatus('Copiado.'));
            break;
          case 'apply-json':
            this.applyJsonToScene();
            break;
          case 'format-json':
            if (this.jsonArea) {
              this.jsonArea.value = jsonPretty(serializeConstructionScene(parseSceneText(this.jsonArea.value)));
              this.setStatus('Formateado.');
            }
            break;
          case 'publish':
            this._publishedHtml.explore = this.publishScene('explore');
            this._publishedHtml.locked = this.publishScene('locked');
            if (this.publishArea) this.publishArea.value = this._publishedHtml.explore;
            if (this.modalBackdrop) this.modalBackdrop.style.setProperty('display', 'flex', 'important');
            this.setStatus('HTML generado.');
            break;
          case 'undo':
            this.undoLastChange();
            break;
          case 'redo':
            this.redoLastChange();
            break;
          case 'toggle-tools-panel':
            this.toolPanelOpen = this.toolPanelOpen === false;
            this.refreshUI();
            break;
          case 'toggle-objects-panel':
            this.rightPanelOpen.objects = this.rightPanelOpen.objects === false;
            this.refreshUI();
            break;
          case 'toggle-properties-panel':
            this.rightPanelOpen.properties = this.rightPanelOpen.properties === false;
            this.refreshUI();
            break;
          case 'copy-published-locked':
            if (this.publishArea) this.publishArea.value = this._publishedHtml.locked || this.publishScene('locked');
            copyTextToClipboard(this.publishArea?.value || '').then(() => this.setStatus('HTML locked copiado.'));
            break;
          case 'copy-published-interactive':
            if (this.publishArea) this.publishArea.value = this._publishedHtml.explore || this.publishScene('explore');
            copyTextToClipboard(this.publishArea?.value || '').then(() => this.setStatus('HTML interactive copiado.'));
            break;
          case 'close-modal':
            if (this.modalBackdrop) this.modalBackdrop.style.setProperty('display', 'none', 'important');
            break;
        }
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
      const sceneAttr = serializeSceneForDataAttr(this.model.serialize());
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

    selectObject(id, render = true) {
      this.selectedObjectId = id && this.model.hasId(id) ? id : null;
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
      const ids = hits.map(h => h.id);
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
      this.selectObject(ids[this._selectionCycleIndex]);
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

    collectDependentIds(rootId) {
      const ids = new Set([rootId]);
      let changed = true;

      while (changed) {
        changed = false;
        for (const obj of this.model.objects) {
          if (ids.has(obj.id)) continue;
          const refs = getRawObjectRefs(obj.raw);
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

      if (this._dragInfo) {
        const obj = this.model.getObject(this._dragInfo.objectId);
        if (obj?.isDraggable()) {
          obj.dragTo(this.model, info.world.x, info.world.y);
          this.renderDuringInteraction();
        }
        e?.preventDefault?.();
        return;
      }

      if (this._viewDragInfo) {
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
        e?.preventDefault?.();
        return;
      }

      if (this.mode !== 'viewer' && this.activeTab === 'visual') {
        this.updateHoverAndPreview(info.sx, info.sy, info.world);
      }
    }

    onPointerUp(e) {
      const hadInteraction = !!(this._dragInfo || this._viewDragInfo);
      if (!hadInteraction) return;

      this._dragInfo = null;
      this._viewDragInfo = null;
      this.releasePointer(e);

      if (this.mode === 'viewer') this.render();
      else this.renderAndSync();

      e?.preventDefault?.();
    }

    getMouseWorld(e) {
      const r = this.svg.getBoundingClientRect();
      return screenToWorld(this.model.viewport, this._svgWidth || r.width, this._svgHeight || r.height, e.clientX - r.left, e.clientY - r.top);
    }

    findNearestPointAtScreen(sx, sy) { return this.hitTester.nearestPointAtScreen(sx, sy); }
    getScreenViewport() { return this.hitTester.getScreenViewport(); }
    p2s(sx, sy, p1, p2, vp) { return this.hitTester.p2s(sx, sy, p1, p2, vp); }
    p2l(sx, sy, p1, p2, vp) { return this.hitTester.p2l(sx, sy, p1, p2, vp); }
    p2r(sx, sy, p1, p2, vp) { return this.hitTester.p2r(sx, sy, p1, p2, vp); }
    p2circleBorderSquared(sx, sy, cx, cy, r) { return this.hitTester.p2circleBorderSquared(sx, sy, cx, cy, r); }
    p2polylineEdgesSquared(sx, sy, points, vp, closed = false) { return this.hitTester.p2polylineEdgesSquared(sx, sy, points, vp, closed); }
    getNearestBoundaryEdgeHit(resolved, sx, sy, vp) { return this.hitTester.getNearestBoundaryEdgeHit(resolved, sx, sy, vp); }
    pointInWorldPolygonScreen(sx, sy, points, vp) { return this.hitTester.pointInWorldPolygonScreen(sx, sy, points, vp); }
    findNearestAnchorObjectAtScreen(sx, sy, world) { return this.hitTester.nearestAnchorObjectAtScreen(sx, sy, world); }
    findNearestDirectionalObjectAtScreen(sx, sy) { return this.hitTester.nearestDirectionalObjectAtScreen(sx, sy); }
    findNearestVectorAtScreen(sx, sy) { return this.hitTester.nearestVectorAtScreen(sx, sy); }
    findNearestIntersectableObjectAtScreen(sx, sy, excludeId = null) { return this.hitTester.nearestIntersectableObjectAtScreen(sx, sy, excludeId); }
    getHoveredObjectForTool(sx, sy) { return this.hitTester.hoveredObjectForTool(sx, sy); }
    findNearestNonPointObjectAtScreen(sx, sy) { return this.hitTester.nearestNonPointObjectAtScreen(sx, sy); }

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

    addFreePoint(x, y, sync = true) {
      const id = this.generatePointName();
      this.model.addObject({ id, type: 'point', x, y, label: id, draggable: true, style: { fill: FREE_POINT_FILL } });
      if (sync) this.renderAndSync();
      return id;
    }

    addConstrainedPoint(constraintRaw, sync = true, options = {}) {
      const id = this.generatePointName();
      this.model.addObject({
        id,
        type: 'point',
        label: id,
        draggable: options.draggable !== undefined ? !!options.draggable : true,
        style: options.style ? deepClone(options.style) : { fill: DEPENDENT_POINT_FILL },
        constraint: deepClone(constraintRaw)
      });
      if (sync) this.renderAndSync();
      return id;
    }

    addVectorEndPoint(vectorId, sync = true) {
      return this.addConstrainedPoint({ kind: 'vector-end', objectId: vectorId }, sync, {
        draggable: false,
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
