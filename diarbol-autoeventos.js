(function (window) {
  'use strict';

  var DC = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);
  var DAB = window.DiarbolAutoBase || (window.DIARBOL && window.DIARBOL.autoBase);

  if (!DC) {
    throw new Error('diarbol-auto-eventos.js: carga primero diarbol-core.js');
  }

  if (!DAB) {
    throw new Error('diarbol-auto-eventos.js: carga primero diarbol-auto-base.js');
  }

  /* =========================================================
     BINARIO
     ========================================================= */

  function normalizarOpcionesBinario(opciones) {
    var o = DC.mergeProfundo({
      niveles: 3,
      rootLabel: 'B',
      title: '',
      caption: '',
      theme: 'binario',

      rootNodeStyle: {
        mode: 'circle-label',
        radius: 30,
        fill: '#f5f7f8',
        stroke: '#455a64',
        strokeWidth: 2.5,
        textColor: '#263238',
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

      ramaA: {
        label: 'A',
        nodeLabel: 'A',
        prob: '1/2',
        nodeStyle: {
          fill: '#f7fbfc',
          stroke: '#90a4ae',
          textColor: '#37474f'
        },
        edgeStyle: {
          boxFill: '#f7fbfc',
          boxStroke: '#cfd8dc',
          color: '#90a4ae',
          valueColor: '#455a64'
        },
        leafBoxStyle: {
          fill: '#f7fbfc',
          stroke: '#cfd8dc',
          titleColor: '#263238',
          valueColor: '#455a64'
        },
        leafNodeStyle: {
          fill: '#546e7a',
          stroke: '#455a64',
          textColor: '#263238'
        }
      },

      ramaB: {
        label: 'B',
        nodeLabel: 'B',
        prob: '1/2',
        nodeStyle: {
          fill: '#f7fbfc',
          stroke: '#90a4ae',
          textColor: '#37474f'
        },
        edgeStyle: {
          boxFill: '#f7fbfc',
          boxStroke: '#cfd8dc',
          color: '#90a4ae',
          valueColor: '#455a64'
        },
        leafBoxStyle: {
          fill: '#f7fbfc',
          stroke: '#cfd8dc',
          titleColor: '#263238',
          valueColor: '#455a64'
        },
        leafNodeStyle: {
          fill: '#546e7a',
          stroke: '#455a64',
          textColor: '#263238'
        }
      }
    }, opciones || {});

    o.niveles = Math.max(1, Math.floor(DC.aNumero(o.niveles, 3)));

    o.ramaA = DAB.normalizarRamaGenerica(
      o.ramaA,
      0,
      { nodeStyle: {}, edgeStyle: {}, leafBoxStyle: {}, leafNodeStyle: {} }
    );

    o.ramaB = DAB.normalizarRamaGenerica(
      o.ramaB,
      1,
      { nodeStyle: {}, edgeStyle: {}, leafBoxStyle: {}, leafNodeStyle: {} }
    );

    return o;
  }

  function construirArbolBinario(opciones) {
    var opts = normalizarOpcionesBinario(opciones);

    var outcomes = [opts.ramaA, opts.ramaB].map(function (rama) {
      var probR = DC.racionalDesdeValor(rama.prob);

return {
  key: rama.key,
  label: rama.label,
  nodeLabel: rama.nodeLabel,

  value: rama.value,
  tipo: DC.aTexto(rama.tipo, ''),
  dominio: DC.aTexto(rama.dominio, ''),
  meta: DC.esObjetoPlano(rama.meta) ? DC.clonarProfundo(rama.meta) : {},

  _probR: probR,
  edgeValueText: DAB.crearTextoValorRama(rama, probR, false),
  nodeStyle: DC.clonarProfundo(rama.nodeStyle),
  edgeStyle: DC.clonarProfundo(rama.edgeStyle),
  leafBoxStyle: DC.clonarProfundo(rama.leafBoxStyle),
  leafNodeStyle: DC.mergeProfundo(opts.leafNodeStyleBase, rama.leafNodeStyle || {})
};
    });

    return DAB.construirArbolRepeticiones({
      levels: opts.niveles,
      rootLabel: opts.rootLabel,
      rootNodeStyle: opts.rootNodeStyle,
      outcomes: outcomes,
      makeLeaf: function (path, totalProb, lastOutcome) {
        return {
          leafBox: {
            lines: DAB.crearLineasLeafGenericas(path, totalProb, {
              mostrarConteos: true,
              mostrarProbTotal: true
            })
          },
          leafBoxStyle: DC.clonarProfundo(lastOutcome.leafBoxStyle || {}),
          nodeStyle: DC.clonarProfundo(lastOutcome.leafNodeStyle || {})
        };
      }
    });
  }

  function crearConfigBinario(opciones) {
    var opts = normalizarOpcionesBinario(opciones);
    var root = construirArbolBinario(opts);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || ('Árbol binario (' + opts.niveles + ' nivel' + (opts.niveles === 1 ? '' : 'es') + ')'),
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-eventos.js',
      stageLabels: DC.crearStageLabels(opts.niveles, 'nivel'),
      root: root
    });
  }

  function dibujarArbolBinario(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigBinario(opciones || {}));
  }

  /* =========================================================
     CONTEO
     ========================================================= */

  function normalizarOpcionesConteo(opciones) {
    var o = DC.mergeProfundo({
      rootLabel: 'C',
      title: '',
      caption: '',
      theme: 'conteo',

      rootNodeStyle: {
        mode: 'circle-label',
        radius: 30,
        fill: '#fdfaf8',
        stroke: '#6d4c41',
        strokeWidth: 2.5,
        textColor: '#4e342e',
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

      branchStyleBase: {
        nodeStyle: {
          fill: '#fdfaf8',
          stroke: '#bcaaa4',
          textColor: '#5d4037'
        },
        edgeStyle: {
          boxFill: '#fdfaf8',
          boxStroke: '#d7ccc8',
          color: '#bcaaa4',
          valueColor: '#6d4c41'
        },
        leafBoxStyle: {
          fill: '#fdfaf8',
          stroke: '#d7ccc8',
          titleColor: '#4e342e',
          valueColor: '#6d4c41'
        },
        leafNodeStyle: {
          fill: '#8d6e63',
          stroke: '#6d4c41',
          textColor: '#4e342e'
        }
      },

      etapas: []
    }, opciones || {});

    if (!Array.isArray(o.etapas) || !o.etapas.length) {
      throw new Error('Conteo: debes indicar etapas.');
    }

    o.etapas = o.etapas.map(function (etapa, idxEtapa) {
      var ramas = Array.isArray(etapa && (etapa.ramas || etapa.outcomes))
        ? (etapa.ramas || etapa.outcomes)
        : [];

      if (!ramas.length) {
        throw new Error('Conteo: la etapa ' + (idxEtapa + 1) + ' no tiene ramas.');
      }

      return {
        nombre: DC.aTexto(etapa && etapa.nombre, (idxEtapa + 1) + '° etapa'),
        ramas: ramas.map(function (rama, idxRama) {
          return DAB.normalizarRamaGenerica(rama, idxRama, o.branchStyleBase);
        })
      };
    });

    return o;
  }

  function construirArbolConteo(opciones) {
    var opts = normalizarOpcionesConteo(opciones);

    function construirNivel(depth, path) {
      var etapa = opts.etapas[depth];

      return etapa.ramas.map(function (rama) {
        var pathStep = {
          key: rama.key,
          label: rama.label,
          nodeLabel: rama.nodeLabel,
          etapa: etapa.nombre,
          count: rama.count,
          edgeLabel: rama.label
        };

        var nextPath = path.concat([pathStep]);

        var child = {
          nodeLabel: DC.aTexto(rama.nodeLabel, ''),
          edgeLabel: DC.aTexto(rama.label, ''),
          edgeValue: DAB.crearTextoValorRama(rama, null, true),
          nodeStyle: DC.clonarProfundo(rama.nodeStyle),
          edgeStyle: DC.clonarProfundo(rama.edgeStyle),
          leafBoxStyle: DC.clonarProfundo(rama.leafBoxStyle),
          children: []
        };

        if (depth + 1 >= opts.etapas.length) {
          var leafLines = DAB.crearLineasLeafGenericas(nextPath, null, {
            mostrarConteos: true,
            mostrarProbTotal: false
          });

          DAB.empujarLineas(leafLines, rama.leafLines || []);

          child.leafBox = { lines: leafLines };
          child.nodeStyle = DC.mergeProfundo(opts.leafNodeStyleBase, rama.leafNodeStyle || {});
          child.leafBoxStyle = DC.clonarProfundo(rama.leafBoxStyle || {});
        } else {
          child.children = construirNivel(depth + 1, nextPath);
        }

        return child;
      });
    }

    return {
      nodeLabel: opts.rootLabel,
      nodeStyle: DC.clonarProfundo(opts.rootNodeStyle),
      children: construirNivel(0, [])
    };
  }

  function crearConfigConteo(opciones) {
    var opts = normalizarOpcionesConteo(opciones);
    var root = construirArbolConteo(opts);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || 'Árbol de conteo',
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-eventos.js',
      stageLabels: DC.crearStageLabels(opts.etapas.length, 'etapa'),
      root: root
    });
  }

  function dibujarArbolConteo(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigConteo(opciones || {}));
  }

  /* =========================================================
     EVENTO
     ========================================================= */

  function normalizarOpcionesEvento(opciones) {
    var o = DC.mergeProfundo({
      rootLabel: 'E',
      title: '',
      caption: '',
      theme: 'evento',
      stageLabels: [],

      rootNodeStyle: {
        mode: 'circle-label',
        radius: 30,
        fill: '#f6f2ff',
        stroke: '#5e35b1',
        strokeWidth: 2.5,
        textColor: '#4527a0',
        fontSize: 15,
        fontWeight: 700
      },

      root: null,
      arbol: null
    }, opciones || {});

    if (!o.root && DC.esObjetoPlano(o.arbol)) {
      o.root = o.arbol;
    }

    if (!DC.esObjetoPlano(o.root)) {
      throw new Error('Evento: debes indicar root (o arbol) con la estructura del render.');
    }

    return o;
  }

  function construirArbolEvento(opciones) {
    var opts = normalizarOpcionesEvento(opciones);
    var root = DC.clonarProfundo(opts.root);

    if (!DC.valorValido(root.nodeLabel)) {
      root.nodeLabel = opts.rootLabel;
    }

    if (!DC.esObjetoPlano(root.nodeStyle)) {
      root.nodeStyle = DC.clonarProfundo(opts.rootNodeStyle);
    }

    return root;
  }

  function crearConfigEvento(opciones) {
    var opts = normalizarOpcionesEvento(opciones);
    var root = construirArbolEvento(opts);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || 'Árbol de evento',
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-eventos.js',
      stageLabels: Array.isArray(opts.stageLabels) ? opts.stageLabels : [],
      root: root
    });
  }

  function dibujarArbolEvento(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigEvento(opciones || {}));
  }

  /* =========================================================
     EXPERIMENTO COMPUESTO
     ========================================================= */

function normalizarOpcionesExperimentoCompuesto(opciones) {
  var o = DC.mergeProfundo({
    rootLabel: 'E',
    title: '',
    caption: '',
    theme: 'experimento',
    stageLabels: [],
    mostrarConteos: true,
    mostrarProbTotal: true,
    crearLineasLeaf: null,

    rootNodeStyle: {
      mode: 'circle-label',
      radius: 30,
      fill: '#f6f2ff',
      stroke: '#5e35b1',
      strokeWidth: 2.5,
      textColor: '#4527a0',
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

    branchStyleBase: {
      nodeStyle: {
        fill: '#faf7ff',
        stroke: '#9575cd',
        textColor: '#4527a0'
      },
      edgeStyle: {
        boxFill: '#faf7ff',
        boxStroke: '#d1c4e9',
        color: '#9575cd',
        valueColor: '#5e35b1'
      },
      leafBoxStyle: {
        fill: '#faf7ff',
        stroke: '#d1c4e9',
        titleColor: '#4527a0',
        valueColor: '#5e35b1'
      },
      leafNodeStyle: {
        fill: '#7e57c2',
        stroke: '#5e35b1',
        textColor: '#4527a0'
      }
    },

    etapas: []
  }, opciones || {});

  if (!Array.isArray(o.etapas) || !o.etapas.length) {
    throw new Error('Experimento compuesto: debes indicar etapas.');
  }

  o.etapas = o.etapas.map(function (etapa, idxEtapa) {
    var ramas = Array.isArray(etapa && (etapa.ramas || etapa.outcomes))
      ? (etapa.ramas || etapa.outcomes)
      : [];

    if (!ramas.length) {
      throw new Error('Experimento compuesto: la etapa ' + (idxEtapa + 1) + ' no tiene ramas.');
    }

    return {
      nombre: DC.aTexto(etapa && etapa.nombre, (idxEtapa + 1) + '° etapa'),
      ramas: ramas.map(function (rama, idxRama) {
        return DAB.normalizarRamaGenerica(rama, idxRama, o.branchStyleBase);
      })
    };
  });

  return o;
}

function construirArbolExperimentoCompuesto(opciones) {
  var opts = normalizarOpcionesExperimentoCompuesto(opciones);

  function construirNivel(depth, path, probAcum) {
    var etapa = opts.etapas[depth];
    var totalCount = DC.totalizarConteos(etapa.ramas);

    return etapa.ramas.map(function (rama) {
      var probR = DC.valorValido(rama.prob)
        ? DC.racionalDesdeValor(rama.prob)
        : (rama.count > 0 && totalCount > 0
            ? DC.simplificarRacional({ num: rama.count, den: totalCount })
            : null);

      var nextProb = (probAcum && probR)
        ? DC.multiplicarRacionales(probAcum, probR)
        : null;

      var textoProb = DAB.crearTextoValorRama(rama, probR, false);

      var pathStep = {
        key: rama.key,
        label: rama.label,
        nodeLabel: rama.nodeLabel,
        value: rama.value,
        tipo: DC.aTexto(rama.tipo, ''),
        dominio: DC.aTexto(rama.dominio, ''),
        meta: DC.esObjetoPlano(rama.meta) ? DC.clonarProfundo(rama.meta) : {},
        etapa: etapa.nombre,
        count: rama.count,
        prob: rama.prob,
        edgeLabel: rama.label,
        edgeValue: textoProb
      };

      var nextPath = path.concat([pathStep]);

      var child = {
        nodeLabel: DC.aTexto(rama.nodeLabel, ''),
        edgeLabel: DC.aTexto(rama.label, ''),
        edgeValue: textoProb,

        value: rama.value,
        tipo: DC.aTexto(rama.tipo, ''),
        dominio: DC.aTexto(rama.dominio, ''),
        meta: DC.esObjetoPlano(rama.meta) ? DC.clonarProfundo(rama.meta) : {},

        nodeStyle: DC.clonarProfundo(rama.nodeStyle),
        edgeStyle: DC.clonarProfundo(rama.edgeStyle),
        leafBoxStyle: DC.clonarProfundo(rama.leafBoxStyle),
        children: []
      };

      if (depth + 1 >= opts.etapas.length) {
        var leafLines = DAB.crearLineasLeafGenericas(nextPath, nextProb, {
          mostrarConteos: opts.mostrarConteos,
          mostrarProbTotal: opts.mostrarProbTotal,
          crearLineasLeaf: opts.crearLineasLeaf
        });

        DAB.empujarLineas(leafLines, rama.leafLines || []);

        child.leafBox = { lines: leafLines };
        child.nodeStyle = DC.mergeProfundo(opts.leafNodeStyleBase, rama.leafNodeStyle || {});
        child.leafBoxStyle = DC.clonarProfundo(rama.leafBoxStyle || {});
      } else {
        child.children = construirNivel(depth + 1, nextPath, nextProb);
      }

      return child;
    });
  }

  return {
    nodeLabel: opts.rootLabel,
    nodeStyle: DC.clonarProfundo(opts.rootNodeStyle),
    children: construirNivel(0, [], DC.crearRacionalUno())
  };
}

function crearConfigExperimentoCompuesto(opciones) {
  var opts = normalizarOpcionesExperimentoCompuesto(opciones);
  var root = construirArbolExperimentoCompuesto(opts);

  return DAB.crearConfigComun(opts, {
    theme: opts.theme,
    title: opts.title || 'Árbol de experimento compuesto',
    caption: opts.caption || 'Generado automáticamente desde diarbol-auto-eventos.js',
    stageLabels: Array.isArray(opts.stageLabels) && opts.stageLabels.length
      ? opts.stageLabels
      : DC.crearStageLabels(opts.etapas.length, 'etapa'),
    root: root
  });
}

  function dibujarArbolExperimentoCompuesto(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigExperimentoCompuesto(opciones || {}));
  }

  /* =========================================================
     CASOS
     ========================================================= */

  function normalizarPasoCaso(paso, idx, estiloBase) {
    if (typeof paso === 'string' || typeof paso === 'number') {
      return DAB.normalizarRamaGenerica(
        { label: String(paso), nodeLabel: String(paso).slice(0, 2) },
        idx,
        estiloBase
      );
    }

    return DAB.normalizarRamaGenerica(paso, idx, estiloBase);
  }

  function normalizarOpcionesCasos(opciones) {
    var o = DC.mergeProfundo({
      rootLabel: 'C',
      title: '',
      caption: '',
      theme: 'casos',

      rootNodeStyle: {
        mode: 'circle-label',
        radius: 30,
        fill: '#f7f8ff',
        stroke: '#3949ab',
        strokeWidth: 2.5,
        textColor: '#283593',
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

      branchStyleBase: {
        nodeStyle: {
          fill: '#f7f8ff',
          stroke: '#9fa8da',
          textColor: '#283593'
        },
        edgeStyle: {
          boxFill: '#f7f8ff',
          boxStroke: '#c5cae9',
          color: '#9fa8da',
          valueColor: '#3949ab'
        },
        leafBoxStyle: {
          fill: '#f7f8ff',
          stroke: '#c5cae9',
          titleColor: '#283593',
          valueColor: '#3949ab'
        },
        leafNodeStyle: {
          fill: '#5c6bc0',
          stroke: '#3949ab',
          textColor: '#283593'
        }
      },

      casos: []
    }, opciones || {});

    if (!Array.isArray(o.casos) || !o.casos.length) {
      throw new Error('Casos: debes indicar un arreglo casos.');
    }

    o.casos = o.casos.map(function (caso, idxCaso) {
      var camino = Array.isArray(caso && (caso.camino || caso.path))
        ? (caso.camino || caso.path)
        : [];

      if (!camino.length) {
        throw new Error('Casos: el caso ' + (idxCaso + 1) + ' no tiene camino.');
      }

      return {
        prob: DC.valorValido(caso && caso.prob) ? caso.prob : '',
        lines: Array.isArray(caso && caso.lines) ? caso.lines.slice() : [],
        leafBoxStyle: DC.esObjetoPlano(caso && caso.leafBoxStyle) ? caso.leafBoxStyle : {},
        leafNodeStyle: DC.esObjetoPlano(caso && caso.leafNodeStyle) ? caso.leafNodeStyle : {},
        camino: camino.map(function (paso, idxPaso) {
          return normalizarPasoCaso(paso, idxPaso, o.branchStyleBase);
        })
      };
    });

    return o;
  }

  function construirArbolCasos(opciones) {
    var opts = normalizarOpcionesCasos(opciones);

    function crearNodoDesdePaso(paso, esHoja, caso) {
      var nodo = {
        nodeLabel: DC.aTexto(paso.nodeLabel, ''),
        edgeLabel: DC.aTexto(paso.label, ''),
        edgeValue: DAB.crearTextoValorRama(
          paso,
          DC.valorValido(paso.prob) ? DC.racionalDesdeValor(paso.prob) : null,
          false
        ),
        nodeStyle: DC.clonarProfundo(paso.nodeStyle),
        edgeStyle: DC.clonarProfundo(paso.edgeStyle),
        leafBoxStyle: DC.clonarProfundo(paso.leafBoxStyle),
        children: []
      };

      if (esHoja) {
        var probTotal = DC.valorValido(caso.prob) ? DC.racionalDesdeValor(caso.prob) : null;
        var pathData = caso.camino.map(function (x) {
          return {
            key: x.key,
            label: x.label,
            nodeLabel: x.nodeLabel,
            edgeLabel: x.label
          };
        });

        var leafLines = DAB.crearLineasLeafGenericas(pathData, probTotal, {
          mostrarConteos: true,
          mostrarProbTotal: !!probTotal
        });

        DAB.empujarLineas(leafLines, caso.lines || []);

        nodo.leafBox = { lines: leafLines };
        nodo.nodeStyle = DC.mergeProfundo(
          DC.mergeProfundo(opts.leafNodeStyleBase, paso.leafNodeStyle || {}),
          caso.leafNodeStyle || {}
        );
        nodo.leafBoxStyle = DC.mergeProfundo(
          DC.clonarProfundo(paso.leafBoxStyle || {}),
          caso.leafBoxStyle || {}
        );
      }

      return nodo;
    }

    function buscarHijoCompatible(lista, paso) {
      for (var i = 0; i < lista.length; i++) {
        var it = lista[i];
        if (it._mergeKey === paso.key && it.edgeLabel === paso.label && it.nodeLabel === paso.nodeLabel) {
          return it;
        }
      }
      return null;
    }

    var root = {
      nodeLabel: opts.rootLabel,
      nodeStyle: DC.clonarProfundo(opts.rootNodeStyle),
      children: []
    };

    opts.casos.forEach(function (caso) {
      var childrenActual = root.children;

      caso.camino.forEach(function (paso, idxPaso) {
        var esHoja = idxPaso === caso.camino.length - 1;
        var existente = buscarHijoCompatible(childrenActual, paso);

        if (!existente) {
          existente = crearNodoDesdePaso(paso, esHoja, caso);
          existente._mergeKey = paso.key;
          childrenActual.push(existente);
        } else if (esHoja) {
          existente.leafBox = existente.leafBox || {};
          existente.leafBox.lines = (existente.leafBox.lines || []).slice();

          var probTotal = DC.valorValido(caso.prob) ? DC.racionalDesdeValor(caso.prob) : null;
          var pathData = caso.camino.map(function (x) {
            return {
              key: x.key,
              label: x.label,
              nodeLabel: x.nodeLabel,
              edgeLabel: x.label
            };
          });

          var leafLines = DAB.crearLineasLeafGenericas(pathData, probTotal, {
            mostrarConteos: true,
            mostrarProbTotal: !!probTotal
          });

          DAB.empujarLineas(leafLines, caso.lines || []);

          existente.leafBox.lines = leafLines;
          existente.nodeStyle = DC.mergeProfundo(
            DC.mergeProfundo(opts.leafNodeStyleBase, paso.leafNodeStyle || {}),
            caso.leafNodeStyle || {}
          );
          existente.leafBoxStyle = DC.mergeProfundo(
            DC.clonarProfundo(paso.leafBoxStyle || {}),
            caso.leafBoxStyle || {}
          );
        }

        childrenActual = existente.children;
      });
    });

    function limpiarMergeKeys(nodo) {
      delete nodo._mergeKey;
      (nodo.children || []).forEach(limpiarMergeKeys);
      return nodo;
    }

    return limpiarMergeKeys(root);
  }

  function crearConfigCasos(opciones) {
    var opts = normalizarOpcionesCasos(opciones);
    var root = construirArbolCasos(opts);

    function profundidadMaxima(nodo) {
      if (!nodo || !Array.isArray(nodo.children) || !nodo.children.length) return 0;
      var max = 0;
      nodo.children.forEach(function (child) {
        max = Math.max(max, 1 + profundidadMaxima(child));
      });
      return max;
    }

    var profundidadMax = profundidadMaxima(root);

    return DAB.crearConfigComun(opts, {
      theme: opts.theme,
      title: opts.title || 'Árbol de casos',
      caption: opts.caption || 'Generado automáticamente desde diarbol-auto-eventos.js',
      stageLabels: DC.crearStageLabels(profundidadMax, 'etapa'),
      root: root
    });
  }

  function dibujarArbolCasos(contenedor, opciones) {
    DAB.assertRenderDisponible();
    return DAB.dibujarDesdeConfig(contenedor, crearConfigCasos(opciones || {}));
  }

  /* =========================================================
     API PÚBLICA
     ========================================================= */

  var api = {
    normalizarOpcionesBinario: normalizarOpcionesBinario,
    construirArbolBinario: construirArbolBinario,
    crearConfigBinario: crearConfigBinario,
    dibujarBinario: dibujarArbolBinario,

    normalizarOpcionesConteo: normalizarOpcionesConteo,
    construirArbolConteo: construirArbolConteo,
    crearConfigConteo: crearConfigConteo,
    dibujarConteo: dibujarArbolConteo,

    normalizarOpcionesEvento: normalizarOpcionesEvento,
    construirArbolEvento: construirArbolEvento,
    crearConfigEvento: crearConfigEvento,
    dibujarEvento: dibujarArbolEvento,

    normalizarOpcionesExperimentoCompuesto: normalizarOpcionesExperimentoCompuesto,
    construirArbolExperimentoCompuesto: construirArbolExperimentoCompuesto,
    crearConfigExperimentoCompuesto: crearConfigExperimentoCompuesto,
    dibujarExperimentoCompuesto: dibujarArbolExperimentoCompuesto,

    normalizarOpcionesCasos: normalizarOpcionesCasos,
    construirArbolCasos: construirArbolCasos,
    crearConfigCasos: crearConfigCasos,
    dibujarCasos: dibujarArbolCasos
  };

  window.DiarbolAutoEventos = api;

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.autoEventos = api;

  window.dibujarArbolBinario = dibujarArbolBinario;
  window.dibujarArbolConteo = dibujarArbolConteo;
  window.dibujarArbolEvento = dibujarArbolEvento;
  window.dibujarArbolExperimentoCompuesto = dibujarArbolExperimentoCompuesto;
  window.dibujarArbolCasos = dibujarArbolCasos;

  window.dibujarDiarbolBinario = dibujarArbolBinario;
  window.dibujarDiarbolConteo = dibujarArbolConteo;
  window.dibujarDiarbolEvento = dibujarArbolEvento;
  window.dibujarDiarbolExperimentoCompuesto = dibujarArbolExperimentoCompuesto;
  window.dibujarDiarbolCasos = dibujarArbolCasos;

})(window);



