(function (window) {
  'use strict';

  var DC = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);
  var DT = window.DiarbolThemes || (window.DIARBOL && window.DIARBOL.themes);
  var DR = window.DiarbolRender || (window.DIARBOL && window.DIARBOL.render);

  if (!DC) {
    throw new Error('diarbol-auto-base.js: carga primero diarbol-core.js');
  }

  if (!DT) {
    throw new Error('diarbol-auto-base.js: carga primero diarbol-themes.js');
  }

  if (!DR) {
    throw new Error('diarbol-auto-base.js: carga primero diarbol-render.js');
  }

  /* =========================================================
     RENDER
     ========================================================= */

  function obtenerFuncionRender() {
    if (window.dibujarDiarbol && typeof window.dibujarDiarbol === 'function') {
      return window.dibujarDiarbol;
    }

    if (DR && typeof DR.dibujar === 'function') {
      return DR.dibujar;
    }

    if (window.dibujarTrayectoriasProbabilidades &&
        typeof window.dibujarTrayectoriasProbabilidades === 'function') {
      return window.dibujarTrayectoriasProbabilidades;
    }

    return null;
  }

  function assertRenderDisponible() {
    if (!obtenerFuncionRender()) {
      throw new Error('diarbol-auto-base.js: no está disponible el render. Carga primero diarbol-render.js');
    }
  }

  function dibujarDesdeConfig(contenedor, cfg) {
    var render = obtenerFuncionRender();
    if (!render) {
      throw new Error('diarbol-auto-base.js: no hay función de render disponible.');
    }
    return render(contenedor, cfg);
  }

  /* =========================================================
     OVERRIDES Y CONFIG COMÚN
     ========================================================= */

  function aplicarOverridesComunes(cfg, opciones) {
    opciones = opciones || {};

    if (DC.valorValido(opciones.title)) cfg.title = opciones.title;
    if (DC.valorValido(opciones.caption)) cfg.caption = opciones.caption;
    if (DC.valorValido(opciones.width)) cfg.width = opciones.width;
    if (DC.valorValido(opciones.height)) cfg.height = opciones.height;
    if (Array.isArray(opciones.stageLabels)) cfg.stageLabels = opciones.stageLabels;

    [
      'layout',
      'titleStyle',
      'stageLabelStyle',
      'captionStyle',
      'nodeStyle',
      'edgeStyle',
      'leafBoxStyle',
      'interaction'
    ].forEach(function (k) {
      if (DC.esObjetoPlano(opciones[k])) {
        cfg[k] = DC.mergeProfundo(cfg[k] || {}, opciones[k]);
      }
    });

    if (DC.esObjetoPlano(opciones.configOverrides)) {
      cfg = DC.mergeProfundo(cfg, opciones.configOverrides);
    }

    return cfg;
  }

  function crearConfigComun(opciones, extra) {
    var opts = opciones || {};
    var ext = extra || {};
    var themeCfg = DT.resolverTema(ext.theme || opts.theme || 'base');
    var cfg = DC.mergeProfundo(themeCfg, {
      title: ext.title || '',
      caption: ext.caption || '',
      stageLabels: Array.isArray(ext.stageLabels) ? ext.stageLabels : [],
      root: ext.root || null
    });

    cfg = aplicarOverridesComunes(cfg, opts);

    if (ext.root) {
      cfg.root = ext.root;
    }

    return cfg;
  }

  /* =========================================================
     HELPERS DE CONSTRUCCIÓN DE ÁRBOLES
     ========================================================= */

  function construirArbolRepeticiones(opciones) {
    var niveles = Math.max(1, DC.aNumero(opciones && opciones.levels, 1));
    var outcomes = Array.isArray(opciones && opciones.outcomes) ? opciones.outcomes : [];

    function crearSubarbol(depth, path, probAcum) {
      return outcomes.map(function (outcome) {
        var nextPath = path.concat([outcome]);
        var nextProb = outcome && outcome._probR
          ? DC.multiplicarRacionales(probAcum, outcome._probR)
          : null;

       var child = {
  nodeLabel: DC.aTexto(
    outcome && (outcome.nodeLabel || outcome.shortLabel || outcome.label),
    ''
  ),
  edgeLabel: DC.aTexto(
    outcome && (outcome.edgeLabel || outcome.label),
    ''
  ),
  edgeValue: DC.aTexto(outcome && outcome.edgeValueText, ''),

  value: outcome ? outcome.value : undefined,
  tipo: DC.aTexto(outcome && outcome.tipo, ''),
  dominio: DC.aTexto(outcome && outcome.dominio, ''),
  meta: DC.esObjetoPlano(outcome && outcome.meta)
    ? DC.clonarProfundo(outcome.meta)
    : {},

  nodeStyle: DC.clonarProfundo((outcome && outcome.nodeStyle) || {}),
  edgeStyle: DC.clonarProfundo((outcome && outcome.edgeStyle) || {}),
  leafBoxStyle: DC.clonarProfundo((outcome && outcome.leafBoxStyle) || {}),
  children: []
};

        if (depth + 1 >= niveles) {
          if (typeof opciones.makeLeaf === 'function') {
            var leafData = opciones.makeLeaf(nextPath, nextProb, outcome, depth + 1) || {};

            if (leafData.leafBox) {
              child.leafBox = leafData.leafBox;
            }

            if (leafData.leafBoxStyle) {
              child.leafBoxStyle = DC.mergeProfundo(child.leafBoxStyle, leafData.leafBoxStyle);
            }

            if (leafData.nodeStyle) {
              child.nodeStyle = DC.mergeProfundo(child.nodeStyle, leafData.nodeStyle);
            }

            if (leafData.edgeStyle) {
              child.edgeStyle = DC.mergeProfundo(child.edgeStyle, leafData.edgeStyle);
            }
          }
        } else {
          child.children = crearSubarbol(depth + 1, nextPath, nextProb);
        }

        return child;
      });
    }

    return {
      nodeLabel: DC.aTexto(opciones && opciones.rootLabel, ''),
      nodeStyle: DC.clonarProfundo((opciones && opciones.rootNodeStyle) || {}),
      children: crearSubarbol(0, [], DC.crearRacionalUno())
    };
  }

  /* =========================================================
     HELPERS GENÉRICOS DE HOJAS / RAMAS
     ========================================================= */

  function empujarLineas(destino, extra) {
    if (!Array.isArray(destino) || !Array.isArray(extra)) return destino;

    extra.forEach(function (linea) {
      if (!DC.valorValido(linea)) return;
      destino.push(String(linea));
    });

    return destino;
  }

  function crearLineaSecuencia(path) {
    var seq = (path || []).map(function (p) {
      return DC.aTexto(p && (p.edgeLabel || p.label || p.nodeLabel), '');
    }).filter(Boolean);

    return seq.length ? ('Secuencia: ' + seq.join('-')) : '';
  }

  function productoNumericoLista(lista) {
    if (!Array.isArray(lista) || !lista.length) return null;

    var valido = true;
    var acc = 1;

    lista.forEach(function (n) {
      var v = Number(n);
      if (!isFinite(v)) {
        valido = false;
        return;
      }
      acc *= v;
    });

    return valido ? acc : null;
  }

  function crearLineasLeafGenericas(path, totalProb, opciones) {
    var opts = opciones || {};
    var lineas = [];
    var sec = crearLineaSecuencia(path);
    var extra;

    if (sec) lineas.push(sec);

    if (opts.mostrarConteos) {
      var conteos = DC.crearLineaConteosPath(path);
      if (conteos) lineas.push(conteos);
    }

    if (typeof opts.crearLineasLeaf === 'function') {
      extra = opts.crearLineasLeaf(path, totalProb) || [];
      if (!Array.isArray(extra)) extra = [extra];
      empujarLineas(lineas, extra);
    }

    if (totalProb && opts.mostrarProbTotal !== false) {
      lineas.push('P(total) = ' + DC.formatearRacional(totalProb));
    }

    return lineas;
  }

function normalizarRamaGenerica(rama, idx, estiloBase) {
  estiloBase = DC.esObjetoPlano(estiloBase) ? estiloBase : {};

  var fallbackLabel = 'Opción ' + (idx + 1);
  var rawLabel = DC.aTexto(rama && rama.label, fallbackLabel);

  return {
    key: DC.aTexto(rama && rama.key, rawLabel.toLowerCase()),
    label: rawLabel,
    nodeLabel: DC.aTexto(rama && rama.nodeLabel, rawLabel.slice(0, 2)),

    value: rama ? rama.value : undefined,
    tipo: DC.aTexto(rama && rama.tipo, ''),
    dominio: DC.aTexto(rama && rama.dominio, ''),
    meta: DC.esObjetoPlano(rama && rama.meta) ? DC.clonarProfundo(rama.meta) : {},

    prob: DC.valorValido(rama && rama.prob) ? rama.prob : '',
    count: Math.max(0, Math.floor(DC.aNumero(rama && rama.count, 0))),
    edgeValue: DC.aTexto(rama && rama.edgeValue, ''),
    leafLines: Array.isArray(rama && rama.leafLines) ? rama.leafLines.slice() : [],

    nodeStyle: DC.mergeProfundo(
      estiloBase.nodeStyle || {},
      DC.esObjetoPlano(rama && rama.nodeStyle) ? rama.nodeStyle : {}
    ),

    edgeStyle: DC.mergeProfundo(
      estiloBase.edgeStyle || {},
      DC.esObjetoPlano(rama && rama.edgeStyle) ? rama.edgeStyle : {}
    ),

    leafBoxStyle: DC.mergeProfundo(
      estiloBase.leafBoxStyle || {},
      DC.esObjetoPlano(rama && rama.leafBoxStyle) ? rama.leafBoxStyle : {}
    ),

    leafNodeStyle: DC.mergeProfundo(
      estiloBase.leafNodeStyle || {},
      DC.esObjetoPlano(rama && rama.leafNodeStyle) ? rama.leafNodeStyle : {}
    )
  };
}

  function crearTextoValorRama(rama, probR, modoConteo) {
    if (DC.valorValido(rama && rama.edgeValue)) return String(rama.edgeValue);
    if (probR) return 'P = ' + DC.formatearRacional(probR);
    if (modoConteo && rama && rama.count > 0) return '×' + rama.count;
    if (rama && rama.count > 0) return 'n = ' + rama.count;
    return '';
  }

  /* =========================================================
     API PÚBLICA
     ========================================================= */

  var api = {
    assertRenderDisponible: assertRenderDisponible,
    obtenerFuncionRender: obtenerFuncionRender,
    dibujarDesdeConfig: dibujarDesdeConfig,

    aplicarOverridesComunes: aplicarOverridesComunes,
    crearConfigComun: crearConfigComun,

    construirArbolRepeticiones: construirArbolRepeticiones,

    empujarLineas: empujarLineas,
    crearLineaSecuencia: crearLineaSecuencia,
    productoNumericoLista: productoNumericoLista,
    crearLineasLeafGenericas: crearLineasLeafGenericas,
    normalizarRamaGenerica: normalizarRamaGenerica,
    crearTextoValorRama: crearTextoValorRama
  };

  window.DiarbolAutoBase = api;

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.autoBase = api;

})(window);
