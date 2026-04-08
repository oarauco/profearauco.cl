(function (window) {
  'use strict';

  var DC = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);
  var DAB = window.DiarbolAutoBase || (window.DIARBOL && window.DIARBOL.autoBase);

  if (!DC) {
    throw new Error('diarbol-auto-extraccion.js: carga primero diarbol-core.js');
  }

  if (!DAB) {
    throw new Error('diarbol-auto-extraccion.js: carga primero diarbol-auto-base.js');
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  function crearLineasLeafBoxExtraccion(path, totalProb) {
    var seq = (path || []).map(function (p) { return p.label; });
    var lineas = [
      'Secuencia: ' + seq.join('-')
    ];

    var conteos = DC.crearLineaConteosPath(path);
    if (conteos) lineas.push(conteos);

    if (totalProb) {
      lineas.push('P(total) = ' + DC.formatearRacional(totalProb));
    }

    return lineas;
  }

  function crearEstilosBaseExtraccion() {
    return {
      rootNodeStyle: {
        mode: 'circle-label',
        radius: 30,
        fill: '#f8fffd',
        stroke: '#26a69a',
        strokeWidth: 2.5,
        textColor: '#00695c',
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

      elementStyleBase: {
        nodeStyle: {
          fill: '#f8fffd',
          stroke: '#80cbc4',
          textColor: '#00695c'
        },
        edgeStyle: {
          boxFill: '#f8fffd',
          boxStroke: '#80cbc4',
          color: '#4db6ac',
          valueColor: '#00796b'
        },
        leafBoxStyle: {
          fill: '#f8fffd',
          stroke: '#80cbc4',
          titleColor: '#00695c',
          valueColor: '#00796b'
        },
        leafNodeStyle: {
          fill: '#26a69a',
          stroke: '#00796b',
          textColor: '#00695c'
        }
      }
    };
  }

  function crearElementosDefaultExtraccion() {
    return [
      {
        key: 'roja',
        label: 'Roja',
        nodeLabel: 'Rj',
        count: 2,
        nodeStyle: { fill: '#fff5f5', stroke: '#e53935', textColor: '#b71c1c' },
        edgeStyle: { boxFill: '#fff5f5', boxStroke: '#ef9a9a', color: '#ef5350', valueColor: '#c62828' },
        leafBoxStyle: { fill: '#fff1f1', stroke: '#ef5350', titleColor: '#7f0000', valueColor: '#b71c1c' },
        leafNodeStyle: { fill: '#d32f2f', stroke: '#7f0000', textColor: '#7f0000' }
      },
      {
        key: 'azul',
        label: 'Azul',
        nodeLabel: 'Az',
        count: 1,
        nodeStyle: { fill: '#f3f8ff', stroke: '#1e88e5', textColor: '#0d47a1' },
        edgeStyle: { boxFill: '#f3f8ff', boxStroke: '#90caf9', color: '#42a5f5', valueColor: '#1565c0' },
        leafBoxStyle: { fill: '#f3f8ff', stroke: '#90caf9', titleColor: '#0d47a1', valueColor: '#1565c0' },
        leafNodeStyle: { fill: '#1e88e5', stroke: '#0d47a1', textColor: '#0d47a1' }
      }
    ];
  }

  /* =========================================================
     EXTRACCIÓN CON REPOSICIÓN
     ========================================================= */

  function normalizarOpcionesExtraccionConReposicion(opciones) {
    var base = crearEstilosBaseExtraccion();

    var o = DC.mergeProfundo({
      extracciones: 2,
      rootLabel: 'U',
      title: '',
      caption: '',
      theme: 'extraccion',

      rootNodeStyle: base.rootNodeStyle,
      leafNodeStyleBase: base.leafNodeStyleBase,
      elementStyleBase: base.elementStyleBase,

      elementos: crearElementosDefaultExtraccion()
    }, opciones || {});

    o.extracciones = Math.max(1, Math.floor(DC.aNumero(o.extracciones, 2)));

    o.elementos = (Array.isArray(o.elementos) ? o.elementos : []).map(function (item, idx) {
      return DC.normalizarElementoExtraccion(item, idx, o.elementStyleBase);
    });

    if (!o.elementos.length) {
      throw new Error('Extracción con reposición: debes indicar al menos un elemento.');
    }

    var totalCount = DC.totalizarConteos(o.elementos);
    var tieneProbExplicita = o.elementos.some(function (el) { return DC.valorValido(el.prob); });

    if (!tieneProbExplicita && totalCount <= 0) {
      throw new Error('Extracción con reposición: si no das prob explícita, los counts deben sumar más que 0.');
    }

    return o;
  }

  function construirArbolExtraccionConReposicion(opciones) {
    var opts = normalizarOpcionesExtraccionConReposicion(opciones);
    var totalCount = DC.totalizarConteos(opts.elementos);

    var outcomes = opts.elementos.map(function (el) {
      var probR = DC.valorValido(el.prob)
        ? DC.racionalDesdeValor(el.prob)
        : DC.simplificarRacional({ num: el.count, den: totalCount });

      return {
        key: el.key,
        label: el.label,
        nodeLabel: el.nodeLabel,
        _probR: probR,
        edgeValueText: 'P = ' + DC.formatearRacional(probR),
        nodeStyle: DC.clonarProfundo(el.nodeStyle),
        edgeStyle: DC.clonarProfundo(el.edgeStyle),
        leafBoxStyle: DC.clonarProfundo(el.leafBoxStyle),
        leafNodeStyle: DC.mergeProfundo(opts.leafNodeStyleBase, el.leafNodeStyle || {})
      };
    });

    return DAB.construirArbolRepeticiones({
      levels: opts.extracciones,
      rootLabel: opts.rootLabel,
      rootNodeStyle: opts.rootNodeStyle,
      outcomes: outcomes,
      makeLeaf: function (path, totalProb, lastOutcome) {
        return {
          leafBox: {
            lines: crearLineasLeafBoxExtraccion(path, totalProb)
          },
          leafBoxStyle: DC.clonarProfundo(lastOutcome.leafBoxStyle || {}),
          nodeStyle: DC.clonarProfundo(lastOutcome.leafNodeStyle || {})
        };
      }
    });
  }

  function crearConfigExtraccionConReposicion(opciones) {
    var opts = normalizarOpcionesExtraccionConReposicion(opciones);
    var root = construirArbolExtraccionConReposicion(opts);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || (
        'Árbol de trayectorias: extracción con reposición (' +
        opts.extracciones + ' extracción' + (opts.extracciones === 1 ? '' : 'es') + ')'
      ),
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-extraccion.js',
      stageLabels: DC.crearStageLabels(opts.extracciones, 'extracción'),
      root: root
    });
  }

  function dibujarArbolExtraccionConReposicion(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigExtraccionConReposicion(opciones || {}));
  }

  /* =========================================================
     EXTRACCIÓN SIN REPOSICIÓN
     ========================================================= */

  function normalizarOpcionesExtraccionSinReposicion(opciones) {
    var base = crearEstilosBaseExtraccion();

    var o = DC.mergeProfundo({
      extracciones: 2,
      rootLabel: 'U',
      title: '',
      caption: '',
      theme: 'extraccion',

      rootNodeStyle: base.rootNodeStyle,
      leafNodeStyleBase: base.leafNodeStyleBase,
      elementStyleBase: base.elementStyleBase,

      elementos: crearElementosDefaultExtraccion()
    }, opciones || {});

    o.extracciones = Math.max(1, Math.floor(DC.aNumero(o.extracciones, 2)));

    o.elementos = (Array.isArray(o.elementos) ? o.elementos : []).map(function (item, idx) {
      return DC.normalizarElementoExtraccion(item, idx, o.elementStyleBase);
    });

    if (!o.elementos.length) {
      throw new Error('Extracción sin reposición: debes indicar al menos un elemento.');
    }

    var totalCount = DC.totalizarConteos(o.elementos);

    if (totalCount <= 0) {
      throw new Error('Extracción sin reposición: la suma de counts debe ser mayor que 0.');
    }

    if (o.extracciones > totalCount) {
      throw new Error('Extracción sin reposición: no puedes extraer más elementos de los disponibles.');
    }

    return o;
  }

  function construirArbolExtraccionSinReposicion(opciones) {
    var opts = normalizarOpcionesExtraccionSinReposicion(opciones);

    function construirNivel(restantes, depth, path, probAcum) {
      var totalRestante = DC.totalizarConteos(restantes);

      return restantes
        .filter(function (el) { return el.count > 0; })
        .map(function (el) {
          var probPaso = DC.simplificarRacional({ num: el.count, den: totalRestante });
          var probNueva = DC.multiplicarRacionales(probAcum, probPaso);

         
var child = {
  nodeLabel: DC.aTexto(el.nodeLabel, ''),
  edgeLabel: DC.aTexto(el.label, ''),
  edgeValue: 'P = ' + DC.formatearRacional(probPaso),

  value: el.value,
  tipo: DC.aTexto(el.tipo, ''),
  dominio: DC.aTexto(el.dominio, ''),
  meta: DC.esObjetoPlano(el.meta) ? DC.clonarProfundo(el.meta) : {},

  nodeStyle: DC.clonarProfundo(el.nodeStyle),
  edgeStyle: DC.clonarProfundo(el.edgeStyle),
  leafBoxStyle: DC.clonarProfundo(el.leafBoxStyle),
  children: []
};

var nextPath = path.concat([{
  key: el.key,
  label: el.label,
  nodeLabel: el.nodeLabel,
  value: el.value,
  tipo: DC.aTexto(el.tipo, ''),
  dominio: DC.aTexto(el.dominio, ''),
  meta: DC.esObjetoPlano(el.meta) ? DC.clonarProfundo(el.meta) : {}
}]);










          if (depth + 1 >= opts.extracciones) {
            child.leafBox = {
              lines: crearLineasLeafBoxExtraccion(nextPath, probNueva)
            };
            child.nodeStyle = DC.mergeProfundo(opts.leafNodeStyleBase, el.leafNodeStyle || {});
            child.leafBoxStyle = DC.clonarProfundo(el.leafBoxStyle || {});
          } else {
            var nuevosRestantes = DC.clonarItemsConConteo(restantes);
            var idx = nuevosRestantes.findIndex(function (x) { return x.key === el.key; });

            if (idx >= 0) {
              nuevosRestantes[idx].count -= 1;
            }

            child.children = construirNivel(nuevosRestantes, depth + 1, nextPath, probNueva);
          }

          return child;
        });
    }

    return {
      nodeLabel: opts.rootLabel,
      nodeStyle: DC.clonarProfundo(opts.rootNodeStyle),
      children: construirNivel(
        DC.clonarItemsConConteo(opts.elementos),
        0,
        [],
        DC.crearRacionalUno()
      )
    };
  }

  function crearConfigExtraccionSinReposicion(opciones) {
    var opts = normalizarOpcionesExtraccionSinReposicion(opciones);
    var root = construirArbolExtraccionSinReposicion(opts);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || (
        'Árbol de trayectorias: extracción sin reposición (' +
        opts.extracciones + ' extracción' + (opts.extracciones === 1 ? '' : 'es') + ')'
      ),
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-extraccion.js',
      stageLabels: DC.crearStageLabels(opts.extracciones, 'extracción'),
      root: root
    });
  }

  function dibujarArbolExtraccionSinReposicion(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigExtraccionSinReposicion(opciones || {}));
  }

  /* =========================================================
     API PÚBLICA
     ========================================================= */

  var api = {
    normalizarOpcionesExtraccionConReposicion: normalizarOpcionesExtraccionConReposicion,
    construirArbolExtraccionConReposicion: construirArbolExtraccionConReposicion,
    crearConfigExtraccionConReposicion: crearConfigExtraccionConReposicion,
    dibujarExtraccionConReposicion: dibujarArbolExtraccionConReposicion,

    normalizarOpcionesExtraccionSinReposicion: normalizarOpcionesExtraccionSinReposicion,
    construirArbolExtraccionSinReposicion: construirArbolExtraccionSinReposicion,
    crearConfigExtraccionSinReposicion: crearConfigExtraccionSinReposicion,
    dibujarExtraccionSinReposicion: dibujarArbolExtraccionSinReposicion
  };

  window.DiarbolAutoExtraccion = api;

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.autoExtraccion = api;

  /* Alias cómodos */
  window.dibujarArbolExtraccionConReposicion = dibujarArbolExtraccionConReposicion;
  window.dibujarArbolExtraccionSinReposicion = dibujarArbolExtraccionSinReposicion;

  window.dibujarDiarbolExtraccionConReposicion = dibujarArbolExtraccionConReposicion;
  window.dibujarDiarbolExtraccionSinReposicion = dibujarArbolExtraccionSinReposicion;

})(window);
