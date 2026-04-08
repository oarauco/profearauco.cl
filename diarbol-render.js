(function (window, document) {
  'use strict';

  var DC = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);

  if (!DC) {
    throw new Error('diarbol-render.js: carga primero diarbol-core.js');
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var contadorDiarbol = 0;

  /* =========================================================
     UTILIDADES SVG Y DOM
     ========================================================= */

  function obtenerContenedor(contenedor) {
    if (typeof contenedor === 'string') {
      return document.querySelector(contenedor);
    }
    return contenedor || null;
  }

  function crearSVG(tag) {
    return document.createElementNS(SVG_NS, tag);
  }

  function setAttrs(el, attrs) {
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] !== undefined && attrs[k] !== null) {
        el.setAttribute(k, String(attrs[k]));
      }
    });
    return el;
  }

  function nodoSVG(tag, attrs, parent) {
    var el = crearSVG(tag);
    setAttrs(el, attrs || {});
    if (parent) parent.appendChild(el);
    return el;
  }

  function puntoInterpolado(x1, y1, x2, y2, t) {
    return {
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t
    };
  }

  function vectorNormal(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;

    return {
      x: -dy / len,
      y: dx / len
    };
  }

  function setTransition(el) {
    if (!el) return;
    el.style.transition =
      'opacity .18s ease, stroke .18s ease, fill .18s ease, stroke-width .18s ease';
  }

  function setOpacity(el, value) {
    if (!el) return;
    el.style.opacity = value;
  }

  function aproximarAnchoTexto(texto, fontSize, fontWeight) {
    var txt = DC.aTexto(texto, '');
    if (!txt) return 0;

    var factor = 0.56;
    var fw = String(fontWeight || '');

    if (fw === '600' || fw === '700' || fw.toLowerCase() === 'bold') {
      factor = 0.60;
    }

    return Math.max(fontSize * 0.9, txt.length * fontSize * factor);
  }

  /* =========================================================
     CONFIGURACIÓN
     ========================================================= */

  function configPorDefecto() {
    return {
      title: '',
      caption: '',
      width: 980,
      height: 560,
      stageLabels: [],

      layout: {
        paddingTop: 24,
        paddingRight: 32,
        paddingBottom: 28,
        paddingLeft: 32,
        levelGap: null,
        minLevelGap: 120,
        leafGap: 92,
        leafBoxGap: 28
      },

      titleStyle: {
        color: '#b85a00',
        fontSize: 26,
        fontWeight: 700
      },

      stageLabelStyle: {
        color: '#0b6b62',
        fontSize: 15,
        fontWeight: 700
      },

      captionStyle: {
        color: '#666666',
        fontSize: 12
      },

      nodeStyle: {
        mode: 'circle-label',   // point | point-label | circle | circle-label
        radius: 28,
        pointRadius: 5,
        fill: '#ffffff',
        stroke: '#666666',
        strokeWidth: 2,
        textColor: '#2e2e2e',
        fontSize: 14,
        fontWeight: 700,
        pointLabelDx: 10,
        pointLabelDy: 4
      },

      edgeStyle: {
        color: '#8a8a8a',
        width: 2,

        labelColor: '#2e2e2e',
        valueColor: '#b85a00',

        fontSize: 13,
        valueFontSize: 13,
        fontWeight: 600,
        valueFontWeight: 700,

        labelMode: 'split',     // split | stacked

        labelT: 0.72,
        valueT: 0.42,

        labelOffset: -18,
        valueOffset: 14,

        backdropColor: '#ffffff',
        backdropWidth: 4,

        showBox: true,
        boxT: 0.58,
        boxOffset: 0,
        boxFill: '#ffffff',
        boxStroke: '#d7d7d7',
        boxStrokeWidth: 1.3,
        boxRadius: 10,
        boxPaddingX: 10,
        boxPaddingY: 8,
        boxGap: 4,
        boxMinWidth: 74
      },

      leafBoxStyle: {
        show: true,
        width: 220,
        minHeight: 64,
        fill: '#fffaf3',
        stroke: '#e1c39e',
        strokeWidth: 1.5,
        radius: 12,
        paddingX: 12,
        paddingY: 10,
        lineGap: 7,
        titleColor: '#2e2e2e',
        valueColor: '#b85a00',
        titleFontSize: 14,
        valueFontSize: 13,
        titleFontWeight: 700,
        valueFontWeight: 600
      },

interaction: {
  mode: 'interactive',   // 'interactive' | 'capture'
  enableHover: true,
  highlightPathOnHover: true,
  highlightColor: '#4caf50',
  dimOthers: true,
  activeLeafFill: '#f3fbf3',
  activeTextColorOnNode: '#ffffff',
  dimOpacity: 0.18
},

      root: null
    };
  }

  function normalizarConfig(config) {
    var defaults = configPorDefecto();
    var cfg = DC.mergeProfundo(defaults, config || {});

    cfg.width = Math.max(320, DC.aNumero(cfg.width, defaults.width));
    cfg.height = Math.max(240, DC.aNumero(cfg.height, defaults.height));

    cfg.layout.paddingTop = Math.max(0, DC.aNumero(cfg.layout.paddingTop, defaults.layout.paddingTop));
    cfg.layout.paddingRight = Math.max(0, DC.aNumero(cfg.layout.paddingRight, defaults.layout.paddingRight));
    cfg.layout.paddingBottom = Math.max(0, DC.aNumero(cfg.layout.paddingBottom, defaults.layout.paddingBottom));
    cfg.layout.paddingLeft = Math.max(0, DC.aNumero(cfg.layout.paddingLeft, defaults.layout.paddingLeft));
    cfg.layout.minLevelGap = Math.max(40, DC.aNumero(cfg.layout.minLevelGap, defaults.layout.minLevelGap));
    cfg.layout.leafGap = Math.max(28, DC.aNumero(cfg.layout.leafGap, defaults.layout.leafGap));
    cfg.layout.leafBoxGap = Math.max(8, DC.aNumero(cfg.layout.leafBoxGap, defaults.layout.leafBoxGap));
    cfg.layout.levelGap = DC.valorValido(cfg.layout.levelGap)
      ? Math.max(20, DC.aNumero(cfg.layout.levelGap, defaults.layout.minLevelGap))
      : null;

    cfg.nodeStyle.radius = Math.max(8, DC.aNumero(cfg.nodeStyle.radius, defaults.nodeStyle.radius));
    cfg.nodeStyle.pointRadius = Math.max(2, DC.aNumero(cfg.nodeStyle.pointRadius, defaults.nodeStyle.pointRadius));
    cfg.nodeStyle.pointLabelDx = DC.aNumero(cfg.nodeStyle.pointLabelDx, defaults.nodeStyle.pointLabelDx);
    cfg.nodeStyle.pointLabelDy = DC.aNumero(cfg.nodeStyle.pointLabelDy, defaults.nodeStyle.pointLabelDy);

    cfg.edgeStyle.width = Math.max(1, DC.aNumero(cfg.edgeStyle.width, defaults.edgeStyle.width));
    cfg.edgeStyle.labelT = Math.max(0, Math.min(1, DC.aNumero(cfg.edgeStyle.labelT, defaults.edgeStyle.labelT)));
    cfg.edgeStyle.valueT = Math.max(0, Math.min(1, DC.aNumero(cfg.edgeStyle.valueT, defaults.edgeStyle.valueT)));
    cfg.edgeStyle.labelOffset = DC.aNumero(cfg.edgeStyle.labelOffset, defaults.edgeStyle.labelOffset);
    cfg.edgeStyle.valueOffset = DC.aNumero(cfg.edgeStyle.valueOffset, defaults.edgeStyle.valueOffset);
    cfg.edgeStyle.boxT = Math.max(0, Math.min(1, DC.aNumero(cfg.edgeStyle.boxT, defaults.edgeStyle.boxT)));
    cfg.edgeStyle.boxOffset = DC.aNumero(cfg.edgeStyle.boxOffset, defaults.edgeStyle.boxOffset);
    cfg.edgeStyle.boxStrokeWidth = Math.max(0, DC.aNumero(cfg.edgeStyle.boxStrokeWidth, defaults.edgeStyle.boxStrokeWidth));
    cfg.edgeStyle.boxRadius = Math.max(0, DC.aNumero(cfg.edgeStyle.boxRadius, defaults.edgeStyle.boxRadius));
    cfg.edgeStyle.boxPaddingX = Math.max(2, DC.aNumero(cfg.edgeStyle.boxPaddingX, defaults.edgeStyle.boxPaddingX));
    cfg.edgeStyle.boxPaddingY = Math.max(2, DC.aNumero(cfg.edgeStyle.boxPaddingY, defaults.edgeStyle.boxPaddingY));
    cfg.edgeStyle.boxGap = Math.max(0, DC.aNumero(cfg.edgeStyle.boxGap, defaults.edgeStyle.boxGap));
    cfg.edgeStyle.boxMinWidth = Math.max(20, DC.aNumero(cfg.edgeStyle.boxMinWidth, defaults.edgeStyle.boxMinWidth));

    cfg.leafBoxStyle.width = Math.max(120, DC.aNumero(cfg.leafBoxStyle.width, defaults.leafBoxStyle.width));
    cfg.leafBoxStyle.minHeight = Math.max(24, DC.aNumero(cfg.leafBoxStyle.minHeight, defaults.leafBoxStyle.minHeight));
    cfg.leafBoxStyle.paddingX = Math.max(4, DC.aNumero(cfg.leafBoxStyle.paddingX, defaults.leafBoxStyle.paddingX));
    cfg.leafBoxStyle.paddingY = Math.max(4, DC.aNumero(cfg.leafBoxStyle.paddingY, defaults.leafBoxStyle.paddingY));
    cfg.leafBoxStyle.lineGap = Math.max(0, DC.aNumero(cfg.leafBoxStyle.lineGap, defaults.leafBoxStyle.lineGap));

    cfg.interaction.dimOpacity = Math.max(0, Math.min(1, DC.aNumero(cfg.interaction.dimOpacity, defaults.interaction.dimOpacity)));

cfg.interaction.mode = DC.aTexto(cfg.interaction.mode, defaults.interaction.mode).trim().toLowerCase();
if (cfg.interaction.mode !== 'interactive' && cfg.interaction.mode !== 'capture') {
  cfg.interaction.mode = defaults.interaction.mode;
}

cfg.interaction.enableHover = cfg.interaction.enableHover !== false;

if (cfg.interaction.mode === 'capture') {
  cfg.interaction.enableHover = false;
  cfg.interaction.highlightPathOnHover = false;
}


    if (!cfg.root) {
      throw new Error('diarbol-render.js: falta config.root');
    }

    return cfg;
  }

  /* =========================================================
     NORMALIZACIÓN DEL ÁRBOL
     ========================================================= */

function normalizarNodoEntrada(nodo) {
  var meta = (nodo && DC.esObjetoPlano(nodo.meta)) ? DC.clonarProfundo(nodo.meta) : {};

  return {
    nodeLabel: DC.aTexto(nodo && nodo.nodeLabel, ''),
    edgeLabel: DC.aTexto(nodo && nodo.edgeLabel, ''),
    edgeValue: DC.aTexto(nodo && nodo.edgeValue, ''),

    /* NUEVO: metadata semántica */
    value: nodo ? nodo.value : undefined,
    tipo: DC.aTexto(nodo && nodo.tipo, ''),
    dominio: DC.aTexto(nodo && nodo.dominio, ''),
    meta: meta,

    nodeStyle: DC.esObjetoPlano(nodo && nodo.nodeStyle) ? nodo.nodeStyle : {},
    edgeStyle: DC.esObjetoPlano(nodo && nodo.edgeStyle) ? nodo.edgeStyle : {},
    leafBoxStyle: DC.esObjetoPlano(nodo && nodo.leafBoxStyle) ? nodo.leafBoxStyle : {},
    leafBox: nodo && DC.esObjetoPlano(nodo.leafBox) ? nodo.leafBox : null,
    children: Array.isArray(nodo && nodo.children)
      ? nodo.children.map(normalizarNodoEntrada)
      : []
  };
}









  function crearEstadoInicial(cfg) {
    return {
      cfg: cfg,
      nodes: [],
      leaves: [],
      maxDepth: 0,

      totalHeight: cfg.height,
      levelGap: 0,
      leafBoxX: null,

      maxLeafBoxWidth: 0,
      maxLeafBoxHalfHeight: 0,
      maxNodeRadius: 0,

      contentTop: 0,
      contentBottom: 0
    };
  }

  function construirArbol(nodoEntrada, parent, state) {
    var nodo = normalizarNodoEntrada(nodoEntrada || {});

    nodo.id = 'diarbol-' + (++contadorDiarbol);
    nodo.parent = parent || null;
    nodo.depth = parent ? parent.depth + 1 : 0;
    nodo.children = (nodo.children || []).map(function (child) {
      return construirArbol(child, nodo, state);
    });
    nodo.isLeaf = nodo.children.length === 0;

    state.nodes.push(nodo);
    if (nodo.isLeaf) state.leaves.push(nodo);
    state.maxDepth = Math.max(state.maxDepth, nodo.depth);

    return nodo;
  }

  /* =========================================================
     RESOLUCIÓN DE ESTILOS
     ========================================================= */

  function resolverEstiloNodo(node, cfg) {
    return DC.mergeProfundo(cfg.nodeStyle, node.nodeStyle || {});
  }

  function resolverEstiloRama(node, cfg) {
    return DC.mergeProfundo(cfg.edgeStyle, node.edgeStyle || {});
  }

  function resolverEstiloLeafBox(node, cfg) {
    return DC.mergeProfundo(cfg.leafBoxStyle, node.leafBoxStyle || {});
  }

  /* =========================================================
     MEDICIÓN
     ========================================================= */

  function obtenerLineasLeafBox(leafBox) {
    if (leafBox && Array.isArray(leafBox.lines) && leafBox.lines.length) {
      return leafBox.lines.map(function (x) { return String(x); });
    }

    if (leafBox && (DC.valorValido(leafBox.title) || DC.valorValido(leafBox.value))) {
      var out = [];
      if (DC.valorValido(leafBox.title)) out.push(String(leafBox.title));
      if (DC.valorValido(leafBox.value)) out.push(String(leafBox.value));
      return out;
    }

    return [];
  }

  function calcularAlturaLeafBox(lines, lbs) {
    if (!lbs.show || !lines || !lines.length) return 0;

    var total = lbs.paddingY * 2;

    lines.forEach(function (_, i) {
      total += (i === 0 ? lbs.titleFontSize : lbs.valueFontSize);
      if (i < lines.length - 1) total += lbs.lineGap;
    });

    return Math.max(lbs.minHeight, total);
  }

  function medirCajaRama(edgeLabel, edgeValue, es) {
    var label = DC.aTexto(edgeLabel, '');
    var value = DC.aTexto(edgeValue, '');

    if (!label && !value) return null;

    var lines = [];

    if (label) {
      lines.push({
        kind: 'label',
        text: label,
        fontSize: es.fontSize,
        fontWeight: es.fontWeight,
        color: es.labelColor
      });
    }

    if (value) {
      lines.push({
        kind: 'value',
        text: value,
        fontSize: es.valueFontSize,
        fontWeight: es.valueFontWeight,
        color: es.valueColor
      });
    }

    var maxWidth = 0;
    var totalHeight = es.boxPaddingY * 2;

    lines.forEach(function (ln, i) {
      maxWidth = Math.max(maxWidth, aproximarAnchoTexto(ln.text, ln.fontSize, ln.fontWeight));
      totalHeight += ln.fontSize;
      if (i < lines.length - 1) totalHeight += es.boxGap;
    });

    return {
      width: Math.max(es.boxMinWidth, maxWidth + es.boxPaddingX * 2),
      height: totalHeight,
      lines: lines
    };
  }

  function medirArbol(state, cfg) {
    state.maxNodeRadius = 0;
    state.maxLeafBoxWidth = 0;
    state.maxLeafBoxHalfHeight = 0;

    state.nodes.forEach(function (node) {
      var ns = resolverEstiloNodo(node, cfg);
      var radio = (ns.mode === 'point' || ns.mode === 'point-label')
        ? ns.pointRadius
        : ns.radius;

      state.maxNodeRadius = Math.max(state.maxNodeRadius, radio);
    });

    state.leaves.forEach(function (leaf) {
      var lbs = resolverEstiloLeafBox(leaf, cfg);
      var lines = obtenerLineasLeafBox(leaf.leafBox);

      leaf._leafBoxLines = lines;
      leaf._leafBoxHeight = calcularAlturaLeafBox(lines, lbs);
      leaf._leafBoxWidth = (lbs.show && lines.length) ? lbs.width : 0;

      state.maxLeafBoxWidth = Math.max(state.maxLeafBoxWidth, leaf._leafBoxWidth);
      state.maxLeafBoxHalfHeight = Math.max(state.maxLeafBoxHalfHeight, leaf._leafBoxHeight / 2);
    });
  }

  /* =========================================================
     LAYOUT
     ========================================================= */

  function calcularAlturasCabecera(cfg) {
    return {
      titleHeight: cfg.title ? (cfg.titleStyle.fontSize + 10) : 0,
      stageHeight: (cfg.stageLabels && cfg.stageLabels.length)
        ? (cfg.stageLabelStyle.fontSize + 16)
        : 0,
      captionHeight: cfg.caption ? (cfg.captionStyle.fontSize + 12) : 0
    };
  }

  function resolverSeparacionNiveles(state, cfg, usableWidth) {
    if (state.maxDepth <= 0) return 0;

    var maxGapQueCabe = usableWidth / state.maxDepth;

    if (DC.valorValido(cfg.layout.levelGap)) {
      return Math.max(0, Math.min(cfg.layout.levelGap, maxGapQueCabe));
    }

    return Math.max(0, maxGapQueCabe);
  }

  function asignarPosicionesVerticalesHojas(state, yTop, yBottom) {
    if (state.leaves.length === 0) return;

    if (state.leaves.length === 1) {
      state.leaves[0].y = (yTop + yBottom) / 2;
      return;
    }

    var usable = yBottom - yTop;
    var realGap = usable / (state.leaves.length - 1);

    state.leaves.forEach(function (leaf, i) {
      leaf.y = yTop + i * realGap;
    });
  }

  function asignarPosicionesArbol(root, state, cfg) {
    function recorrer(node) {
      node.x = cfg.layout.paddingLeft + node.depth * state.levelGap;

      if (node.isLeaf) return node.y;

      var suma = 0;
      node.children.forEach(function (child) {
        suma += recorrer(child);
      });

      node.y = suma / node.children.length;
      return node.y;
    }

    recorrer(root);
  }

  function calcularLayout(root, state, cfg) {
    medirArbol(state, cfg);

    var hh = calcularAlturasCabecera(cfg);

    var topSafety = Math.max(state.maxNodeRadius, state.maxLeafBoxHalfHeight) + 10;
    var bottomSafety = Math.max(state.maxNodeRadius, state.maxLeafBoxHalfHeight) + 10;

    var contentTop = cfg.layout.paddingTop + hh.titleHeight + hh.stageHeight + topSafety;
    var contentBottomReserve = cfg.layout.paddingBottom + hh.captionHeight + bottomSafety;

    var minTreeHeight = contentTop + contentBottomReserve;
    if (state.leaves.length > 1) {
      minTreeHeight += cfg.layout.leafGap * (state.leaves.length - 1);
    }

    var totalHeight = Math.max(cfg.height, minTreeHeight);
    var yTop = contentTop;
    var yBottom = totalHeight - contentBottomReserve;

    asignarPosicionesVerticalesHojas(state, yTop, yBottom);

    var reserveLeafBox = state.maxLeafBoxWidth > 0
      ? state.maxLeafBoxWidth + cfg.layout.leafBoxGap
      : 0;

    var usableWidth = cfg.width - cfg.layout.paddingLeft - cfg.layout.paddingRight - reserveLeafBox;
    usableWidth = Math.max(0, usableWidth);

    state.levelGap = resolverSeparacionNiveles(state, cfg, usableWidth);
    state.totalHeight = totalHeight;
    state.contentTop = contentTop;
    state.contentBottom = totalHeight - contentBottomReserve;
    state.leafBoxX = state.maxLeafBoxWidth > 0
      ? cfg.layout.paddingLeft + state.maxDepth * state.levelGap + cfg.layout.leafBoxGap
      : null;

    asignarPosicionesArbol(root, state, cfg);
  }

  /* =========================================================
     ESCENA SVG
     ========================================================= */

  function crearEscenaSVG(cfg, state) {
    return nodoSVG('svg', {
      viewBox: '0 0 ' + cfg.width + ' ' + state.totalHeight,
      width: '100%',
      height: 'auto',
      class: 'diarbol-root',
      role: 'img',
      'aria-label': cfg.title || 'Diagrama de árbol'
    });
  }

  function agregarEstilosSVG(svg) {
    var style = nodoSVG('style', {}, svg);
    style.textContent =
      '.diarbol-root text{font-family:Arial,Helvetica,sans-serif;}' +
      '.diarbol-title{paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round;}' +
      '.diarbol-stage-label{paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round;}' +
      '.diarbol-edge-label,.diarbol-edge-value{paint-order:stroke;stroke-linejoin:round;}' +
      '.diarbol-hit{fill:transparent;cursor:pointer;outline:none;}';
  }

  function crearGruposEscena(svg) {
    return {
      edges: nodoSVG('g', {}, svg),
      edgeLabels: nodoSVG('g', {}, svg),
      nodes: nodoSVG('g', {}, svg),
      leafBoxes: nodoSVG('g', {}, svg),
      hits: nodoSVG('g', {}, svg),
      overlay: nodoSVG('g', {}, svg)
    };
  }

  /* =========================================================
     DIBUJO DE CABECERA
     ========================================================= */

  function dibujarCabecera(group, cfg, state) {
    var yActual = cfg.layout.paddingTop;

    if (cfg.title) {
      var title = nodoSVG('text', {
        x: cfg.layout.paddingLeft,
        y: yActual + cfg.titleStyle.fontSize,
        class: 'diarbol-title',
        fill: cfg.titleStyle.color,
        'font-size': cfg.titleStyle.fontSize,
        'font-weight': cfg.titleStyle.fontWeight
      }, group);
      title.textContent = cfg.title;
      yActual += cfg.titleStyle.fontSize + 10;
    }

    if (cfg.stageLabels && cfg.stageLabels.length) {
      var xs = [];
      var i;

      for (i = 0; i <= state.maxDepth; i++) {
        xs.push(cfg.layout.paddingLeft + i * state.levelGap);
      }

      if (state.leafBoxX !== null) {
        xs.push(state.leafBoxX + state.maxLeafBoxWidth / 2);
      }

      cfg.stageLabels.forEach(function (txt, idx) {
        if (idx >= xs.length) return;

        var stage = nodoSVG('text', {
          x: xs[idx],
          y: yActual + cfg.stageLabelStyle.fontSize,
          'text-anchor': 'middle',
          class: 'diarbol-stage-label',
          fill: cfg.stageLabelStyle.color,
          'font-size': cfg.stageLabelStyle.fontSize,
          'font-weight': cfg.stageLabelStyle.fontWeight
        }, group);

        stage.textContent = txt;
      });

      yActual += cfg.stageLabelStyle.fontSize + 16;
    }

    if (cfg.caption) {
      var cap = nodoSVG('text', {
        x: cfg.layout.paddingLeft,
        y: state.totalHeight - cfg.layout.paddingBottom,
        fill: cfg.captionStyle.color,
        'font-size': cfg.captionStyle.fontSize
      }, group);
      cap.textContent = cfg.caption;
    }
  }

  /* =========================================================
     DIBUJO DE RAMAS
     ========================================================= */

  function inicializarVisualesNodo(node) {
    node._edge = null;
    node._edgeOriginal = null;

    node._edgeBoxRect = null;
    node._edgeBoxOriginal = null;

    node._edgeLabelEl = null;
    node._edgeLabelOriginal = null;

    node._edgeValueEl = null;
    node._edgeValueOriginal = null;

    node._circle = null;
    node._nodeOriginal = null;

    node._nodeTextEl = null;
    node._nodeTextOriginal = null;

    node._leafBoxRect = null;
    node._leafBoxOriginal = null;

    node._leafTextEls = [];
    node._leafHit = null;
  }

  function dibujarLineaRama(group, parentNode, childNode, cfg) {
    var es = resolverEstiloRama(childNode, cfg);

    childNode._edge = nodoSVG('line', {
      x1: parentNode.x,
      y1: parentNode.y,
      x2: childNode.x,
      y2: childNode.y,
      stroke: es.color,
      'stroke-width': es.width,
      fill: 'none'
    }, group);

    childNode._edgeOriginal = {
      color: es.color,
      width: es.width
    };

    setTransition(childNode._edge);
  }

  function dibujarCajaRama(group, childNode, centerX, centerY, es, boxData) {
    childNode._edgeBoxRect = nodoSVG('rect', {
      x: centerX - boxData.width / 2,
      y: centerY - boxData.height / 2,
      width: boxData.width,
      height: boxData.height,
      rx: es.boxRadius,
      ry: es.boxRadius,
      fill: es.boxFill,
      stroke: es.boxStroke,
      'stroke-width': es.boxStrokeWidth
    }, group);

    childNode._edgeBoxOriginal = {
      fill: es.boxFill,
      stroke: es.boxStroke,
      strokeWidth: es.boxStrokeWidth
    };

    setTransition(childNode._edgeBoxRect);

    var cursorY = centerY - boxData.height / 2 + es.boxPaddingY;

    boxData.lines.forEach(function (ln) {
      cursorY += ln.fontSize;

      var textEl = nodoSVG('text', {
        x: centerX,
        y: cursorY,
        'text-anchor': 'middle',
        class: ln.kind === 'label' ? 'diarbol-edge-label' : 'diarbol-edge-value',
        fill: ln.color,
        'font-size': ln.fontSize,
        'font-weight': ln.fontWeight,
        stroke: es.backdropColor,
        'stroke-width': es.backdropWidth
      }, group);

      textEl.textContent = ln.text;
      setTransition(textEl);

      if (ln.kind === 'label') {
        childNode._edgeLabelEl = textEl;
        childNode._edgeLabelOriginal = { fill: ln.color };
      } else {
        childNode._edgeValueEl = textEl;
        childNode._edgeValueOriginal = { fill: ln.color };
      }

      cursorY += es.boxGap;
    });
  }

  function dibujarTextosRamaSueltos(group, parentNode, childNode, cfg) {
    var es = resolverEstiloRama(childNode, cfg);
    var x1 = parentNode.x;
    var y1 = parentNode.y;
    var x2 = childNode.x;
    var y2 = childNode.y;

    var label = DC.aTexto(childNode.edgeLabel, '');
    var value = DC.aTexto(childNode.edgeValue, '');

    if (!label && !value) return;

    var normal = vectorNormal(x1, y1, x2, y2);

    if (es.labelMode === 'stacked') {
      var base = puntoInterpolado(x1, y1, x2, y2, es.labelT);
      var bx = base.x + normal.x * es.labelOffset;
      var by = base.y + normal.y * es.labelOffset;

      if (label) {
        childNode._edgeLabelEl = nodoSVG('text', {
          x: bx,
          y: by,
          'text-anchor': 'middle',
          class: 'diarbol-edge-label',
          fill: es.labelColor,
          'font-size': es.fontSize,
          'font-weight': es.fontWeight,
          stroke: es.backdropColor,
          'stroke-width': es.backdropWidth
        }, group);
        childNode._edgeLabelEl.textContent = label;
        childNode._edgeLabelOriginal = { fill: es.labelColor };
        setTransition(childNode._edgeLabelEl);
      }

      if (value) {
        childNode._edgeValueEl = nodoSVG('text', {
          x: bx,
          y: by + es.valueFontSize + 4,
          'text-anchor': 'middle',
          class: 'diarbol-edge-value',
          fill: es.valueColor,
          'font-size': es.valueFontSize,
          'font-weight': es.valueFontWeight,
          stroke: es.backdropColor,
          'stroke-width': es.backdropWidth
        }, group);
        childNode._edgeValueEl.textContent = value;
        childNode._edgeValueOriginal = { fill: es.valueColor };
        setTransition(childNode._edgeValueEl);
      }

      return;
    }

    if (label) {
      var p1 = puntoInterpolado(x1, y1, x2, y2, es.labelT);
      childNode._edgeLabelEl = nodoSVG('text', {
        x: p1.x + normal.x * es.labelOffset,
        y: p1.y + normal.y * es.labelOffset,
        'text-anchor': 'middle',
        class: 'diarbol-edge-label',
        fill: es.labelColor,
        'font-size': es.fontSize,
        'font-weight': es.fontWeight,
        stroke: es.backdropColor,
        'stroke-width': es.backdropWidth
      }, group);
      childNode._edgeLabelEl.textContent = label;
      childNode._edgeLabelOriginal = { fill: es.labelColor };
      setTransition(childNode._edgeLabelEl);
    }

    if (value) {
      var p2 = puntoInterpolado(x1, y1, x2, y2, es.valueT);
      childNode._edgeValueEl = nodoSVG('text', {
        x: p2.x + normal.x * es.valueOffset,
        y: p2.y + normal.y * es.valueOffset,
        'text-anchor': 'middle',
        class: 'diarbol-edge-value',
        fill: es.valueColor,
        'font-size': es.valueFontSize,
        'font-weight': es.valueFontWeight,
        stroke: es.backdropColor,
        'stroke-width': es.backdropWidth
      }, group);
      childNode._edgeValueEl.textContent = value;
      childNode._edgeValueOriginal = { fill: es.valueColor };
      setTransition(childNode._edgeValueEl);
    }
  }

  function dibujarDecoracionRama(group, parentNode, childNode, cfg) {
    var es = resolverEstiloRama(childNode, cfg);
    var label = DC.aTexto(childNode.edgeLabel, '');
    var value = DC.aTexto(childNode.edgeValue, '');

    if (!label && !value) return;

    if (es.showBox) {
      var base = puntoInterpolado(parentNode.x, parentNode.y, childNode.x, childNode.y, es.boxT);
      var normal = vectorNormal(parentNode.x, parentNode.y, childNode.x, childNode.y);
      var cx = base.x + normal.x * es.boxOffset;
      var cy = base.y + normal.y * es.boxOffset;
      var boxData = medirCajaRama(label, value, es);

      if (boxData) {
        dibujarCajaRama(group, childNode, cx, cy, es, boxData);
      }
      return;
    }

    dibujarTextosRamaSueltos(group, parentNode, childNode, cfg);
  }

  /* =========================================================
     DIBUJO DE NODOS
     ========================================================= */

  function dibujarNodo(group, node, cfg) {
    var ns = resolverEstiloNodo(node, cfg);
    var mode = ns.mode;

    if (mode === 'point' || mode === 'point-label') {
      node._circle = nodoSVG('circle', {
        cx: node.x,
        cy: node.y,
        r: ns.pointRadius,
        fill: ns.fill,
        stroke: ns.stroke,
        'stroke-width': ns.strokeWidth
      }, group);

      node._nodeOriginal = {
        fill: ns.fill,
        stroke: ns.stroke,
        strokeWidth: ns.strokeWidth
      };

      setTransition(node._circle);

      if (mode === 'point-label' && node.nodeLabel) {
        node._nodeTextEl = nodoSVG('text', {
          x: node.x + ns.pointRadius + ns.pointLabelDx,
          y: node.y + ns.pointLabelDy,
          'text-anchor': 'start',
          fill: ns.textColor,
          'font-size': ns.fontSize,
          'font-weight': ns.fontWeight
        }, group);

        node._nodeTextEl.textContent = node.nodeLabel;
        node._nodeTextOriginal = { fill: ns.textColor };
        setTransition(node._nodeTextEl);
      }

      return;
    }

    node._circle = nodoSVG('circle', {
      cx: node.x,
      cy: node.y,
      r: ns.radius,
      fill: ns.fill,
      stroke: ns.stroke,
      'stroke-width': ns.strokeWidth
    }, group);

    node._nodeOriginal = {
      fill: ns.fill,
      stroke: ns.stroke,
      strokeWidth: ns.strokeWidth
    };

    setTransition(node._circle);

    if (mode === 'circle-label' && node.nodeLabel) {
      node._nodeTextEl = nodoSVG('text', {
        x: node.x,
        y: node.y + ns.fontSize * 0.35,
        'text-anchor': 'middle',
        fill: ns.textColor,
        'font-size': ns.fontSize,
        'font-weight': ns.fontWeight
      }, group);

      node._nodeTextEl.textContent = node.nodeLabel;
      node._nodeTextOriginal = { fill: ns.textColor };
      setTransition(node._nodeTextEl);
    }
  }

  /* =========================================================
     DIBUJO DE CAJAS FINALES
     ========================================================= */

  function dibujarLeafBox(group, hitGroup, node, cfg, state) {
    if (!node.isLeaf) return;

    var lbs = resolverEstiloLeafBox(node, cfg);
    var lines = node._leafBoxLines || [];

    if (!lbs.show || !lines.length || state.leafBoxX === null) return;

    var boxX = state.leafBoxX;
    var boxY = node.y - node._leafBoxHeight / 2;

    node._leafBoxRect = nodoSVG('rect', {
      x: boxX,
      y: boxY,
      width: lbs.width,
      height: node._leafBoxHeight,
      rx: lbs.radius,
      ry: lbs.radius,
      fill: lbs.fill,
      stroke: lbs.stroke,
      'stroke-width': lbs.strokeWidth
    }, group);

    node._leafBoxOriginal = {
      fill: lbs.fill,
      stroke: lbs.stroke,
      strokeWidth: lbs.strokeWidth
    };

    setTransition(node._leafBoxRect);

    node._leafTextEls = [];

    var yCursor = boxY + lbs.paddingY;

    lines.forEach(function (line, i) {
      var fontSize = i === 0 ? lbs.titleFontSize : lbs.valueFontSize;
      var fontWeight = i === 0 ? lbs.titleFontWeight : lbs.valueFontWeight;
      var fill = i === 0 ? lbs.titleColor : lbs.valueColor;

      yCursor += fontSize;

      var textEl = nodoSVG('text', {
        x: boxX + lbs.paddingX,
        y: yCursor,
        fill: fill,
        'font-size': fontSize,
        'font-weight': fontWeight
      }, group);

      textEl.textContent = line;
      textEl._originalFill = fill;
      setTransition(textEl);

      node._leafTextEls.push(textEl);
      yCursor += lbs.lineGap;
    });

    node._leafHit = nodoSVG('rect', {
      x: boxX,
      y: boxY,
      width: lbs.width,
      height: node._leafBoxHeight,
      rx: lbs.radius,
      ry: lbs.radius,
      class: 'diarbol-hit',
      tabindex: '0',
      'aria-label': lines.join(' | ')
    }, hitGroup);
  }

  /* =========================================================
     DIBUJO DE LA ESCENA COMPLETA
     ========================================================= */

  function dibujarEscena(groups, root, state, cfg) {
    state.nodes.forEach(function (node) {
      inicializarVisualesNodo(node);
    });

    state.nodes.forEach(function (node) {
      if (!node.parent) return;
      dibujarLineaRama(groups.edges, node.parent, node, cfg);
    });

    state.nodes.forEach(function (node) {
      if (!node.parent) return;
      dibujarDecoracionRama(groups.edgeLabels, node.parent, node, cfg);
    });

    state.nodes.forEach(function (node) {
      dibujarNodo(groups.nodes, node, cfg);
    });

    state.leaves.forEach(function (leaf) {
      dibujarLeafBox(groups.leafBoxes, groups.hits, leaf, cfg, state);
    });

    dibujarCabecera(groups.overlay, cfg, state);
  }

  /* =========================================================
     INTERACCIÓN
     ========================================================= */

  function obtenerElementosVisuales(node) {
    var out = [
      node._edge,
      node._edgeBoxRect,
      node._edgeLabelEl,
      node._edgeValueEl,
      node._circle,
      node._nodeTextEl,
      node._leafBoxRect
    ];

    (node._leafTextEls || []).forEach(function (el) {
      out.push(el);
    });

    return out.filter(Boolean);
  }

  function aplicarOpacidadNodo(node, value) {
    obtenerElementosVisuales(node).forEach(function (el) {
      setOpacity(el, value);
    });
  }

  function restaurarNodoVisual(node) {
    if (node._edge && node._edgeOriginal) {
      node._edge.setAttribute('stroke', node._edgeOriginal.color);
      node._edge.setAttribute('stroke-width', node._edgeOriginal.width);
    }

    if (node._edgeBoxRect && node._edgeBoxOriginal) {
      node._edgeBoxRect.setAttribute('fill', node._edgeBoxOriginal.fill);
      node._edgeBoxRect.setAttribute('stroke', node._edgeBoxOriginal.stroke);
      node._edgeBoxRect.setAttribute('stroke-width', node._edgeBoxOriginal.strokeWidth);
    }

    if (node._edgeLabelEl && node._edgeLabelOriginal) {
      node._edgeLabelEl.setAttribute('fill', node._edgeLabelOriginal.fill);
    }

    if (node._edgeValueEl && node._edgeValueOriginal) {
      node._edgeValueEl.setAttribute('fill', node._edgeValueOriginal.fill);
    }

    if (node._circle && node._nodeOriginal) {
      node._circle.setAttribute('fill', node._nodeOriginal.fill);
      node._circle.setAttribute('stroke', node._nodeOriginal.stroke);
      node._circle.setAttribute('stroke-width', node._nodeOriginal.strokeWidth);
    }

    if (node._nodeTextEl && node._nodeTextOriginal) {
      node._nodeTextEl.setAttribute('fill', node._nodeTextOriginal.fill);
    }

    if (node._leafBoxRect && node._leafBoxOriginal) {
      node._leafBoxRect.setAttribute('fill', node._leafBoxOriginal.fill);
      node._leafBoxRect.setAttribute('stroke', node._leafBoxOriginal.stroke);
      node._leafBoxRect.setAttribute('stroke-width', node._leafBoxOriginal.strokeWidth);
    }

    (node._leafTextEls || []).forEach(function (el) {
      if (DC.valorValido(el._originalFill)) {
        el.setAttribute('fill', el._originalFill);
      }
    });

    aplicarOpacidadNodo(node, '1');
  }

  function activarNodoVisual(node, cfg) {
    var hc = cfg.interaction.highlightColor;

    if (node._edge) {
      var w = node._edgeOriginal ? node._edgeOriginal.width : 2;
      node._edge.setAttribute('stroke', hc);
      node._edge.setAttribute('stroke-width', w + 1.4);
    }

    if (node._edgeBoxRect) {
      node._edgeBoxRect.setAttribute('stroke', hc);
      node._edgeBoxRect.setAttribute('fill', '#ffffff');
    }

    if (node._edgeLabelEl) {
      node._edgeLabelEl.setAttribute('fill', hc);
    }

    if (node._edgeValueEl) {
      node._edgeValueEl.setAttribute('fill', hc);
    }

    if (node._circle) {
      node._circle.setAttribute('fill', hc);
      node._circle.setAttribute('stroke', hc);
    }

    if (node._nodeTextEl) {
      node._nodeTextEl.setAttribute('fill', cfg.interaction.activeTextColorOnNode);
    }

    if (node._leafBoxRect) {
      node._leafBoxRect.setAttribute('fill', cfg.interaction.activeLeafFill);
      node._leafBoxRect.setAttribute('stroke', hc);
    }

    aplicarOpacidadNodo(node, '1');
  }

  function rutaHastaRaiz(node) {
    var out = [];
    var actual = node;

    while (actual) {
      out.push(actual);
      actual = actual.parent;
    }

    return out.reverse();
  }

function instalarInteraccion(svg, state, cfg) {
  if (!cfg.interaction) return;
  if (cfg.interaction.mode === 'capture') return;
  if (cfg.interaction.enableHover === false) return;
  if (!cfg.interaction.highlightPathOnHover) return;

    function limpiar() {
      state.nodes.forEach(function (node) {
        restaurarNodoVisual(node);
      });
    }

    function resaltarHoja(leaf) {
      var activos = {};
      rutaHastaRaiz(leaf).forEach(function (node) {
        activos[node.id] = true;
      });

      state.nodes.forEach(function (node) {
        restaurarNodoVisual(node);

        if (activos[node.id]) {
          activarNodoVisual(node, cfg);
        } else if (cfg.interaction.dimOthers) {
          aplicarOpacidadNodo(node, String(cfg.interaction.dimOpacity));
        }
      });
    }

    state.leaves.forEach(function (leaf) {
      var targets = [];

      if (leaf._leafHit) targets.push(leaf._leafHit);
      if (leaf._leafBoxRect) targets.push(leaf._leafBoxRect);
      if (leaf._circle) targets.push(leaf._circle);
      if (leaf._edge) targets.push(leaf._edge);
      if (leaf._edgeBoxRect) targets.push(leaf._edgeBoxRect);
      if (leaf._edgeLabelEl) targets.push(leaf._edgeLabelEl);
      if (leaf._edgeValueEl) targets.push(leaf._edgeValueEl);

      (leaf._leafTextEls || []).forEach(function (el) {
        targets.push(el);
      });

      targets.forEach(function (el) {
        el.addEventListener('mouseenter', function () {
          resaltarHoja(leaf);
        });
        el.addEventListener('mouseleave', limpiar);
        el.addEventListener('focus', function () {
          resaltarHoja(leaf);
        });
        el.addEventListener('blur', limpiar);
      });
    });

    svg.addEventListener('mouseleave', limpiar);
  }

  /* =========================================================
     RENDER PRINCIPAL
     ========================================================= */

  function renderizarDiarbol(contenedor, config) {
    var host = obtenerContenedor(contenedor);
    if (!host) {
      throw new Error('No se encontró el contenedor para diarbol-render.js');
    }

    var cfg = normalizarConfig(config || {});
    var state = crearEstadoInicial(cfg);
    var root = construirArbol(cfg.root, null, state);

    calcularLayout(root, state, cfg);

    host.innerHTML = '';

    var svg = crearEscenaSVG(cfg, state);
    agregarEstilosSVG(svg);

    var groups = crearGruposEscena(svg);
    dibujarEscena(groups, root, state, cfg);

    host.appendChild(svg);
    instalarInteraccion(svg, state, cfg);

    return {
      svg: svg,
      root: root,
      nodes: state.nodes,
      leaves: state.leaves,
      options: cfg,
      state: state
    };
  }

  /* =========================================================
     API PÚBLICA
     ========================================================= */

  window.dibujarDiarbol = renderizarDiarbol;

  window.DiarbolRender = {
    dibujar: renderizarDiarbol
  };

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.render = window.DiarbolRender;

  /* Alias de compatibilidad */
  window.dibujarTrayectoriasProbabilidades = renderizarDiarbol;

})(window, document);
