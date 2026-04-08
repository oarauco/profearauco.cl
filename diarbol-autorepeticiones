(function (window) {
  'use strict';

  var DC = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);
  var DAB = window.DiarbolAutoBase || (window.DIARBOL && window.DIARBOL.autoBase);

  if (!DC) {
    throw new Error('diarbol-auto-repeticiones.js: carga primero diarbol-core.js');
  }

  if (!DAB) {
    throw new Error('diarbol-auto-repeticiones.js: carga primero diarbol-auto-base.js');
  }

  /* =========================================================
     MONEDA
     ========================================================= */

  function normalizarOpcionesMoneda(opciones) {
    var o = DC.mergeProfundo({
      lanzamientos: 3,
      rootLabel: 'M',

      caraLabel: 'Cara',
      selloLabel: 'Sello',

      caraNodeLabel: 'C',
      selloNodeLabel: 'S',

      caraProb: '1/2',
      selloProb: '1/2',

      title: '',
      caption: '',
      theme: 'moneda',

      rootNodeStyle: {
        mode: 'circle-label',
        radius: 30,
        fill: '#fff8ef',
        stroke: '#b85a00',
        strokeWidth: 2.5,
        textColor: '#8a4b00',
        fontSize: 15,
        fontWeight: 700
      },

      leafNodeStyleBase: {
        mode: 'point-label',
        pointRadius: 4,
        strokeWidth: 1.5,
        fontSize: 12,
        fontWeight: 700
      },

      caraStyle: {
        nodeStyle: {
          fill: '#f8fff8',
          stroke: '#66bb6a',
          textColor: '#2e7d32'
        },
        edgeStyle: {
          boxFill: '#f8fff8',
          boxStroke: '#9ccc65',
          color: '#81c784',
          valueColor: '#2e7d32'
        },
        leafBoxStyle: {
          fill: '#f1fff1',
          stroke: '#81c784',
          titleColor: '#1b5e20',
          valueColor: '#2e7d32'
        },
        leafNodeStyle: {
          fill: '#43a047',
          stroke: '#2e7d32',
          textColor: '#1b5e20'
        }
      },

      selloStyle: {
        nodeStyle: {
          fill: '#fff8f8',
          stroke: '#ef5350',
          textColor: '#b71c1c'
        },
        edgeStyle: {
          boxFill: '#fff8f8',
          boxStroke: '#ef9a9a',
          color: '#e57373',
          valueColor: '#c62828'
        },
        leafBoxStyle: {
          fill: '#fff5f5',
          stroke: '#ef9a9a',
          titleColor: '#7f0000',
          valueColor: '#c62828'
        },
        leafNodeStyle: {
          fill: '#e53935',
          stroke: '#b71c1c',
          textColor: '#7f0000'
        }
      }
    }, opciones || {});

    o.lanzamientos = Math.max(1, Math.floor(DC.aNumero(o.lanzamientos, 3)));
    return o;
  }

  function crearLineasLeafBoxMoneda(path, totalProb) {
    var seq = (path || []).map(function (p) {
      return p.nodeLabel || p.label;
    });

    var counts = DC.contarPorClave(path, function (p) { return p.key; });
    var nCara = counts.cara || 0;
    var nSello = counts.sello || 0;

    var lineas = [
      'Secuencia: ' + seq.join('-'),
      nCara + ' cara' + (nCara === 1 ? '' : 's') + ' y ' +
      nSello + ' sello' + (nSello === 1 ? '' : 's')
    ];

    if (totalProb) {
      lineas.push('P(total) = ' + DC.formatearRacional(totalProb));
    }

    return lineas;
  }

  function construirArbolMoneda(opciones) {
    var opts = normalizarOpcionesMoneda(opciones);

    var outcomes = [
  {
    key: 'cara',
    label: opts.caraLabel,
    nodeLabel: opts.caraNodeLabel,
    value: 1,
    tipo: 'entero',
    dominio: 'moneda',
    _probR: DC.racionalDesdeValor(opts.caraProb),
    edgeValueText: 'P = ' + DC.aTexto(opts.caraProb, '1/2'),
    nodeStyle: DC.clonarProfundo(opts.caraStyle.nodeStyle),
    edgeStyle: DC.clonarProfundo(opts.caraStyle.edgeStyle),
    leafBoxStyle: DC.clonarProfundo(opts.caraStyle.leafBoxStyle),
    leafNodeStyle: DC.mergeProfundo(opts.leafNodeStyleBase, opts.caraStyle.leafNodeStyle || {})
  },
  {
    key: 'sello',
    label: opts.selloLabel,
    nodeLabel: opts.selloNodeLabel,
    value: 0,
    tipo: 'entero',
    dominio: 'moneda',
    _probR: DC.racionalDesdeValor(opts.selloProb),
    edgeValueText: 'P = ' + DC.aTexto(opts.selloProb, '1/2'),
    nodeStyle: DC.clonarProfundo(opts.selloStyle.nodeStyle),
    edgeStyle: DC.clonarProfundo(opts.selloStyle.edgeStyle),
    leafBoxStyle: DC.clonarProfundo(opts.selloStyle.leafBoxStyle),
    leafNodeStyle: DC.mergeProfundo(opts.leafNodeStyleBase, opts.selloStyle.leafNodeStyle || {})
  }
];

    return DAB.construirArbolRepeticiones({
      levels: opts.lanzamientos,
      rootLabel: opts.rootLabel,
      rootNodeStyle: opts.rootNodeStyle,
      outcomes: outcomes,
      makeLeaf: function (path, totalProb, lastOutcome) {
        return {
          leafBox: {
            lines: crearLineasLeafBoxMoneda(path, totalProb)
          },
          leafBoxStyle: DC.clonarProfundo(lastOutcome.leafBoxStyle || {}),
          nodeStyle: DC.clonarProfundo(lastOutcome.leafNodeStyle || {})
        };
      }
    });
  }

  function crearConfigMoneda(opciones) {
    var opts = normalizarOpcionesMoneda(opciones);
    var root = construirArbolMoneda(opts);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || (
        'Árbol de trayectorias: lanzar una moneda ' +
        opts.lanzamientos + ' vez' + (opts.lanzamientos === 1 ? '' : 'es')
      ),
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-repeticiones.js',
      stageLabels: DC.crearStageLabels(opts.lanzamientos, 'lanzamiento'),
      root: root
    });
  }

  function dibujarArbolMoneda(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigMoneda(opciones || {}));
  }

  /* =========================================================
     DADO
     ========================================================= */

  function normalizarCaraDado(cara, idx, estiloBase) {
    var fallback = String(idx + 1);

    return {
      key: DC.aTexto(cara && cara.key, fallback),
      label: DC.aTexto(cara && cara.label, fallback),
      nodeLabel: DC.aTexto(cara && cara.nodeLabel, DC.aTexto(cara && cara.label, fallback)),
      prob: DC.valorValido(cara && cara.prob) ? cara.prob : '1/6',

      nodeStyle: DC.mergeProfundo(
        estiloBase.nodeStyle || {},
        DC.esObjetoPlano(cara && cara.nodeStyle) ? cara.nodeStyle : {}
      ),

      edgeStyle: DC.mergeProfundo(
        estiloBase.edgeStyle || {},
        DC.esObjetoPlano(cara && cara.edgeStyle) ? cara.edgeStyle : {}
      ),

      leafBoxStyle: DC.mergeProfundo(
        estiloBase.leafBoxStyle || {},
        DC.esObjetoPlano(cara && cara.leafBoxStyle) ? cara.leafBoxStyle : {}
      ),

      leafNodeStyle: DC.mergeProfundo(
        estiloBase.leafNodeStyle || {},
        DC.esObjetoPlano(cara && cara.leafNodeStyle) ? cara.leafNodeStyle : {}
      )
    };
  }

  function normalizarOpcionesDado(opciones) {
    var o = DC.mergeProfundo({
      tiradas: 2,
      rootLabel: 'D',
      title: '',
      caption: '',
      theme: 'dado',

      rootNodeStyle: {
        mode: 'circle-label',
        radius: 30,
        fill: '#eef7ff',
        stroke: '#1565c0',
        strokeWidth: 2.5,
        textColor: '#0d47a1',
        fontSize: 15,
        fontWeight: 700
      },

      leafNodeStyleBase: {
        mode: 'point-label',
        pointRadius: 4,
        strokeWidth: 1.5,
        fontSize: 12,
        fontWeight: 700
      },

      faceStyleBase: {
        nodeStyle: {
          fill: '#f7fbff',
          stroke: '#64b5f6',
          textColor: '#0d47a1'
        },
        edgeStyle: {
          boxFill: '#f7fbff',
          boxStroke: '#90caf9',
          color: '#64b5f6',
          valueColor: '#1565c0'
        },
        leafBoxStyle: {
          fill: '#f7fbff',
          stroke: '#90caf9',
          titleColor: '#0d47a1',
          valueColor: '#1565c0'
        },
        leafNodeStyle: {
          fill: '#1e88e5',
          stroke: '#1565c0',
          textColor: '#0d47a1'
        }
      },

      caras: []
    }, opciones || {});

    o.tiradas = Math.max(1, Math.floor(DC.aNumero(o.tiradas, 2)));

    if (!Array.isArray(o.caras) || !o.caras.length) {
      o.caras = [
        { label: '1' },
        { label: '2' },
        { label: '3' },
        { label: '4' },
        { label: '5' },
        { label: '6' }
      ];
    }

    o.caras = o.caras.map(function (cara, idx) {
      return normalizarCaraDado(cara, idx, o.faceStyleBase);
    });

    return o;
  }

  function crearLineasLeafBoxDado(path, totalProb) {
    var seq = (path || []).map(function (p) { return p.label; });
    var nums = (path || []).map(function (p) { return Number(p.label); });

    var lineas = ['Secuencia: ' + seq.join('-')];

    if (nums.every(isFinite)) {
      var suma = nums.reduce(function (acc, n) { return acc + n; }, 0);
      lineas.push('Suma: ' + suma);
    } else {
      var conteos = DC.crearLineaConteosPath(path);
      if (conteos) lineas.push(conteos);
    }

    if (totalProb) {
      lineas.push('P(total) = ' + DC.formatearRacional(totalProb));
    }

    return lineas;
  }

  function construirArbolDado(opciones) {
    var opts = normalizarOpcionesDado(opciones);

    var outcomes = opts.caras.map(function (cara) {
      return {
        key: cara.key,
        label: cara.label,
        nodeLabel: cara.nodeLabel,
        _probR: DC.racionalDesdeValor(cara.prob),
        edgeValueText: 'P = ' + DC.aTexto(cara.prob, '1/6'),
        nodeStyle: DC.clonarProfundo(cara.nodeStyle),
        edgeStyle: DC.clonarProfundo(cara.edgeStyle),
        leafBoxStyle: DC.clonarProfundo(cara.leafBoxStyle),
        leafNodeStyle: DC.mergeProfundo(opts.leafNodeStyleBase, cara.leafNodeStyle || {})
      };
    });

    return DAB.construirArbolRepeticiones({
      levels: opts.tiradas,
      rootLabel: opts.rootLabel,
      rootNodeStyle: opts.rootNodeStyle,
      outcomes: outcomes,
      makeLeaf: function (path, totalProb, lastOutcome) {
        return {
          leafBox: {
            lines: crearLineasLeafBoxDado(path, totalProb)
          },
          leafBoxStyle: DC.clonarProfundo(lastOutcome.leafBoxStyle || {}),
          nodeStyle: DC.clonarProfundo(lastOutcome.leafNodeStyle || {})
        };
      }
    });
  }

  function crearConfigDado(opciones) {
    var opts = normalizarOpcionesDado(opciones);
    var root = construirArbolDado(opts);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || (
        'Árbol de trayectorias: lanzar un dado ' +
        opts.tiradas + ' vez' + (opts.tiradas === 1 ? '' : 'es')
      ),
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-repeticiones.js',
      stageLabels: DC.crearStageLabels(opts.tiradas, 'tirada'),
      root: root
    });
  }

  function dibujarArbolDado(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigDado(opciones || {}));
  }

  /* =========================================================
     RULETA
     ========================================================= */

  function normalizarSectorRuleta(sector, idx) {
    var label = DC.aTexto(sector && sector.label, 'Sector ' + (idx + 1));
    var nodeLabel = DC.aTexto(sector && sector.nodeLabel, label.slice(0, 2));
    var prob = DC.valorValido(sector && sector.prob) ? sector.prob : '1/4';

    return {
      key: DC.aTexto(sector && sector.key, label.toLowerCase()),
      label: label,
      nodeLabel: nodeLabel,
      prob: prob,
      nodeStyle: DC.esObjetoPlano(sector && sector.nodeStyle) ? sector.nodeStyle : {},
      edgeStyle: DC.esObjetoPlano(sector && sector.edgeStyle) ? sector.edgeStyle : {},
      leafBoxStyle: DC.esObjetoPlano(sector && sector.leafBoxStyle) ? sector.leafBoxStyle : {},
      leafNodeStyle: DC.esObjetoPlano(sector && sector.leafNodeStyle) ? sector.leafNodeStyle : {}
    };
  }

  function normalizarOpcionesRuleta(opciones) {
    var o = DC.mergeProfundo({
      giros: 2,
      rootLabel: 'R',
      title: '',
      caption: '',
      theme: 'ruleta',

      rootNodeStyle: {
        mode: 'circle-label',
        radius: 30,
        fill: '#f7f1ff',
        stroke: '#7b1fa2',
        strokeWidth: 2.5,
        textColor: '#6a1b9a',
        fontSize: 15,
        fontWeight: 700
      },

      leafNodeStyleBase: {
        mode: 'point-label',
        pointRadius: 4,
        strokeWidth: 1.5,
        fontSize: 12,
        fontWeight: 700
      },

      sectores: [
        {
          key: 'rojo',
          label: 'Rojo',
          nodeLabel: 'Ro',
          prob: '1/4',
          nodeStyle: { fill: '#fff5f5', stroke: '#e53935', textColor: '#b71c1c' },
          edgeStyle: { boxFill: '#fff5f5', boxStroke: '#ef9a9a', color: '#ef5350', valueColor: '#c62828' },
          leafBoxStyle: { fill: '#fff1f1', stroke: '#ef5350', titleColor: '#7f0000', valueColor: '#b71c1c' },
          leafNodeStyle: { fill: '#d32f2f', stroke: '#7f0000', textColor: '#7f0000' }
        },
        {
          key: 'azul',
          label: 'Azul',
          nodeLabel: 'Az',
          prob: '1/4',
          nodeStyle: { fill: '#f3f8ff', stroke: '#1e88e5', textColor: '#0d47a1' },
          edgeStyle: { boxFill: '#f3f8ff', boxStroke: '#90caf9', color: '#42a5f5', valueColor: '#1565c0' },
          leafBoxStyle: { fill: '#f3f8ff', stroke: '#90caf9', titleColor: '#0d47a1', valueColor: '#1565c0' },
          leafNodeStyle: { fill: '#1e88e5', stroke: '#1565c0', textColor: '#0d47a1' }
        },
        {
          key: 'verde',
          label: 'Verde',
          nodeLabel: 'Ve',
          prob: '1/4',
          nodeStyle: { fill: '#f5fff7', stroke: '#43a047', textColor: '#1b5e20' },
          edgeStyle: { boxFill: '#f5fff7', boxStroke: '#81c784', color: '#66bb6a', valueColor: '#2e7d32' },
          leafBoxStyle: { fill: '#f1fff4', stroke: '#81c784', titleColor: '#1b5e20', valueColor: '#2e7d32' },
          leafNodeStyle: { fill: '#43a047', stroke: '#2e7d32', textColor: '#1b5e20' }
        },
        {
          key: 'amarillo',
          label: 'Amarillo',
          nodeLabel: 'Am',
          prob: '1/4',
          nodeStyle: { fill: '#fffde7', stroke: '#fdd835', textColor: '#8d6e00' },
          edgeStyle: { boxFill: '#fffde7', boxStroke: '#fdd835', color: '#fbc02d', valueColor: '#f57f17' },
          leafBoxStyle: { fill: '#fffde8', stroke: '#fdd835', titleColor: '#8d6e00', valueColor: '#f57f17' },
          leafNodeStyle: { fill: '#fbc02d', stroke: '#f57f17', textColor: '#8d6e00' }
        }
      ]
    }, opciones || {});

    o.giros = Math.max(1, Math.floor(DC.aNumero(o.giros, 2)));
    o.sectores = (Array.isArray(o.sectores) ? o.sectores : []).map(normalizarSectorRuleta);

    if (!o.sectores.length) {
      throw new Error('Ruleta: debes indicar al menos un sector.');
    }

    return o;
  }

  function crearLineasLeafBoxRuleta(path, totalProb) {
    var seq = (path || []).map(function (p) { return String(p.label).toLowerCase(); });
    var counts = DC.contarPorClave(path, function (p) { return p.key; });
    var distintos = Object.keys(counts).length;
    var iguales = distintos === 1;

    var lineas = [
      'Secuencia: ' + seq.join('-'),
      iguales ? 'Colores iguales' : 'Colores distintos'
    ];

    if (totalProb) {
      lineas.push('P(total) = ' + DC.formatearRacional(totalProb));
    }

    return lineas;
  }

  function construirArbolRuleta(opciones) {
    var opts = normalizarOpcionesRuleta(opciones);

    var outcomes = opts.sectores.map(function (s) {
      return {
        key: s.key,
        label: s.label,
        nodeLabel: s.nodeLabel,
        _probR: DC.racionalDesdeValor(s.prob),
        edgeValueText: 'P = ' + DC.aTexto(s.prob, ''),
        nodeStyle: DC.clonarProfundo(s.nodeStyle),
        edgeStyle: DC.clonarProfundo(s.edgeStyle),
        leafBoxStyle: DC.clonarProfundo(s.leafBoxStyle),
        leafNodeStyle: DC.mergeProfundo(opts.leafNodeStyleBase, s.leafNodeStyle || {})
      };
    });

    return DAB.construirArbolRepeticiones({
      levels: opts.giros,
      rootLabel: opts.rootLabel,
      rootNodeStyle: opts.rootNodeStyle,
      outcomes: outcomes,
      makeLeaf: function (path, totalProb, lastOutcome) {
        return {
          leafBox: {
            lines: crearLineasLeafBoxRuleta(path, totalProb)
          },
          leafBoxStyle: DC.clonarProfundo(lastOutcome.leafBoxStyle || {}),
          nodeStyle: DC.clonarProfundo(lastOutcome.leafNodeStyle || {})
        };
      }
    });
  }

  function crearConfigRuleta(opciones) {
    var opts = normalizarOpcionesRuleta(opciones);
    var root = construirArbolRuleta(opts);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || (
        'Árbol de trayectorias: ruleta de ' +
        opts.sectores.length + ' sectores girada ' +
        opts.giros + ' vez' + (opts.giros === 1 ? '' : 'es')
      ),
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-repeticiones.js',
      stageLabels: DC.crearStageLabels(opts.giros, 'giro'),
      root: root
    });
  }

  function dibujarArbolRuleta(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigRuleta(opciones || {}));
  }

  /* =========================================================
     API PÚBLICA
     ========================================================= */

  var api = {
    normalizarOpcionesMoneda: normalizarOpcionesMoneda,
    construirArbolMoneda: construirArbolMoneda,
    crearConfigMoneda: crearConfigMoneda,
    dibujarMoneda: dibujarArbolMoneda,

    normalizarOpcionesDado: normalizarOpcionesDado,
    construirArbolDado: construirArbolDado,
    crearConfigDado: crearConfigDado,
    dibujarDado: dibujarArbolDado,

    normalizarOpcionesRuleta: normalizarOpcionesRuleta,
    construirArbolRuleta: construirArbolRuleta,
    crearConfigRuleta: crearConfigRuleta,
    dibujarRuleta: dibujarArbolRuleta
  };

  window.DiarbolAutoRepeticiones = api;

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.autoRepeticiones = api;

  /* Alias cómodos */
  window.dibujarArbolMoneda = dibujarArbolMoneda;
  window.dibujarArbolDado = dibujarArbolDado;
  window.dibujarArbolRuleta = dibujarArbolRuleta;

  window.dibujarDiarbolMoneda = dibujarArbolMoneda;
  window.dibujarDiarbolDado = dibujarArbolDado;
  window.dibujarDiarbolRuleta = dibujarArbolRuleta;

})(window);
