(function (window) {
  'use strict';

  var DC  = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);
  var DT  = window.DiarbolThemes || (window.DIARBOL && window.DIARBOL.themes);
  var DR  = window.DiarbolRender || (window.DIARBOL && window.DIARBOL.render);
  var DAB = window.DiarbolAutoBase || (window.DIARBOL && window.DIARBOL.autoBase);
  var DAR = window.DiarbolAutoRepeticiones || (window.DIARBOL && window.DIARBOL.autoRepeticiones);
  var DAE = window.DiarbolAutoExtraccion || (window.DIARBOL && window.DIARBOL.autoExtraccion);
  var DAV = window.DiarbolAutoEventos || (window.DIARBOL && window.DIARBOL.autoEventos);

  if (!DC) {
    throw new Error('diarbol-auto.js: carga primero diarbol-core.js');
  }
  if (!DT) {
    throw new Error('diarbol-auto.js: carga primero diarbol-themes.js');
  }
  if (!DR) {
    throw new Error('diarbol-auto.js: carga primero diarbol-render.js');
  }
  if (!DAB) {
    throw new Error('diarbol-auto.js: carga primero diarbol-auto-base.js');
  }
  if (!DAR) {
    throw new Error('diarbol-auto.js: carga primero diarbol-auto-repeticiones.js');
  }
  if (!DAE) {
    throw new Error('diarbol-auto.js: carga primero diarbol-auto-extraccion.js');
  }
  if (!DAV) {
    throw new Error('diarbol-auto.js: carga primero diarbol-auto-eventos.js');
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  function version() {
    return '1.0.0';
  }

  function info() {
    return {
      nombre: 'Diarbol',
      version: version(),
      modulos: {
        core: !!DC,
        themes: !!DT,
        render: !!DR,
        autoBase: !!DAB,
        autoRepeticiones: !!DAR,
        autoExtraccion: !!DAE,
        autoEventos: !!DAV
      }
    };
  }

  /* =========================================================
     FACHADA PRINCIPAL
     ========================================================= */

  var api = {
    version: version,
    info: info,

    core: DC,
    themes: DT,
    render: DR,
    base: DAB,

    repeticiones: DAR,
    extraccion: DAE,
    eventos: DAV,

    /* ---------- Render genérico ---------- */
    dibujar: function (contenedor, config) {
      return DR.dibujar(contenedor, config);
    },

    /* ---------- Repeticiones ---------- */
    dibujarMoneda: function (contenedor, opciones) {
      return DAR.dibujarMoneda(contenedor, opciones || {});
    },

    dibujarDado: function (contenedor, opciones) {
      return DAR.dibujarDado(contenedor, opciones || {});
    },

    dibujarRuleta: function (contenedor, opciones) {
      return DAR.dibujarRuleta(contenedor, opciones || {});
    },

    crearConfigMoneda: function (opciones) {
      return DAR.crearConfigMoneda(opciones || {});
    },

    crearConfigDado: function (opciones) {
      return DAR.crearConfigDado(opciones || {});
    },

    crearConfigRuleta: function (opciones) {
      return DAR.crearConfigRuleta(opciones || {});
    },

    /* ---------- Extracción ---------- */
    dibujarExtraccionConReposicion: function (contenedor, opciones) {
      return DAE.dibujarExtraccionConReposicion(contenedor, opciones || {});
    },

    dibujarExtraccionSinReposicion: function (contenedor, opciones) {
      return DAE.dibujarExtraccionSinReposicion(contenedor, opciones || {});
    },

    crearConfigExtraccionConReposicion: function (opciones) {
      return DAE.crearConfigExtraccionConReposicion(opciones || {});
    },

    crearConfigExtraccionSinReposicion: function (opciones) {
      return DAE.crearConfigExtraccionSinReposicion(opciones || {});
    },

    /* ---------- Eventos / estructuras ---------- */
    dibujarBinario: function (contenedor, opciones) {
      return DAV.dibujarBinario(contenedor, opciones || {});
    },

    dibujarConteo: function (contenedor, opciones) {
      return DAV.dibujarConteo(contenedor, opciones || {});
    },

    dibujarEvento: function (contenedor, opciones) {
      return DAV.dibujarEvento(contenedor, opciones || {});
    },

    dibujarExperimentoCompuesto: function (contenedor, opciones) {
      return DAV.dibujarExperimentoCompuesto(contenedor, opciones || {});
    },

    dibujarCasos: function (contenedor, opciones) {
      return DAV.dibujarCasos(contenedor, opciones || {});
    },

    crearConfigBinario: function (opciones) {
      return DAV.crearConfigBinario(opciones || {});
    },

    crearConfigConteo: function (opciones) {
      return DAV.crearConfigConteo(opciones || {});
    },

    crearConfigEvento: function (opciones) {
      return DAV.crearConfigEvento(opciones || {});
    },

    crearConfigExperimentoCompuesto: function (opciones) {
      return DAV.crearConfigExperimentoCompuesto(opciones || {});
    },

    crearConfigCasos: function (opciones) {
      return DAV.crearConfigCasos(opciones || {});
    }
  };

  /* =========================================================
     API PÚBLICA
     ========================================================= */

  window.DiarbolAuto = api;

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.auto = api;

  /* Alias generales cómodos */
  window.dibujarDiarbol = window.dibujarDiarbol || DR.dibujar;

  window.dibujarDiarbolMoneda = api.dibujarMoneda;
  window.dibujarDiarbolDado = api.dibujarDado;
  window.dibujarDiarbolRuleta = api.dibujarRuleta;

  window.dibujarDiarbolExtraccionConReposicion = api.dibujarExtraccionConReposicion;
  window.dibujarDiarbolExtraccionSinReposicion = api.dibujarExtraccionSinReposicion;

  window.dibujarDiarbolBinario = api.dibujarBinario;
  window.dibujarDiarbolConteo = api.dibujarConteo;
  window.dibujarDiarbolEvento = api.dibujarEvento;
  window.dibujarDiarbolExperimentoCompuesto = api.dibujarExperimentoCompuesto;
  window.dibujarDiarbolCasos = api.dibujarCasos;

})(window);

</script>



<!-- XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX-->
<!-- DIARBOL EVENTOS -->

<script>

(function (window) {
  'use strict';

  var DC = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);

  if (!DC) {
    throw new Error('diarbol-eventos.js: carga primero diarbol-core.js');
  }

  /* =========================================================
     VALIDACIÓN Y STORE
     ========================================================= */

  function assertInstanciaValida(instancia) {
    if (!instancia || !Array.isArray(instancia.nodes) || !Array.isArray(instancia.leaves)) {
      throw new Error('DiarbolEventos: la instancia no es válida. Debe venir de dibujarDiarbol(...) o de un módulo auto.');
    }
  }

  function asegurarStore(instancia) {
    assertInstanciaValida(instancia);

    if (!instancia._diarbolEventos) {
      instancia._diarbolEventos = {
        contextos: null,
        eventos: {},
        resaltadoActual: null
      };
    }

    return instancia._diarbolEventos;
  }

  /* =========================================================
     HELPERS DE ÁRBOL / HOJAS
     ========================================================= */

  function rutaHastaRaiz(node) {
    var out = [];
    var actual = node;

    while (actual) {
      out.push(actual);
      actual = actual.parent;
    }

    return out.reverse();
  }

  function obtenerLineasLeaf(node) {
    if (node && Array.isArray(node._leafBoxLines)) {
      return node._leafBoxLines.slice();
    }

    if (node && node.leafBox && Array.isArray(node.leafBox.lines)) {
      return node.leafBox.lines.map(function (x) { return String(x); });
    }

    return [];
  }

  function extraerPrimerRacionalDeTexto(texto) {
    if (!DC.valorValido(texto)) return null;

    var txt = String(texto).replace(/,/g, '.');

    var frac = txt.match(/(-?\d+)\s*\/\s*(-?\d+)/);
    if (frac) {
      return DC.racionalDesdeValor(frac[1] + '/' + frac[2]);
    }

    var dec = txt.match(/(-?\d+(?:\.\d+)?)/);
    if (dec) {
      return DC.racionalDesdeValor(dec[1]);
    }

    return null;
  }

  function extraerProbDesdeEdgeValue(node) {
    if (!node) return null;
    return extraerPrimerRacionalDeTexto(node.edgeValue);
  }

  function extraerProbTotalDesdeLeaf(node) {
    var lines = obtenerLineasLeaf(node);
    var i;

    for (i = 0; i < lines.length; i += 1) {
      if (/P\s*\(\s*total\s*\)/i.test(lines[i])) {
        return extraerPrimerRacionalDeTexto(lines[i]);
      }
    }

    return null;
  }

  function contarPorEtiqueta(labels) {
    var out = {};

    (labels || []).forEach(function (lbl) {
      var k = DC.aTexto(lbl, '');
      if (!k) return;
      out[k] = (out[k] || 0) + 1;
    });

    return out;
  }

  function contarNumericos(labels) {
    var nums = (labels || [])
      .map(function (x) { return Number(x); })
      .filter(function (n) { return isFinite(n); });

    if (!nums.length) return null;

    return {
      numeros: nums,
      suma: nums.reduce(function (acc, n) { return acc + n; }, 0),
      producto: nums.reduce(function (acc, n) { return acc * n; }, 1),
      minimo: Math.min.apply(null, nums),
      maximo: Math.max.apply(null, nums)
    };
  }

function construirContextoHoja(leaf) {
  var path = rutaHastaRaiz(leaf);
  var ramas = path.slice(1);

  var labels = ramas.map(function (n) {
    return DC.aTexto(n && n.edgeLabel, '');
  });

  var nodeLabels = ramas.map(function (n) {
    return DC.aTexto(n && n.nodeLabel, '');
  });

  var branchProbList = ramas.map(extraerProbDesdeEdgeValue);
  var probPath = DC.crearRacionalUno();
  var probValida = true;
  var i;

  function inferirTipoDesdeValor(v) {
    if (typeof v === 'boolean') return 'booleano';
    if (typeof v === 'number' && isFinite(v)) {
      return Math.floor(v) === v ? 'entero' : 'numero';
    }
    if (typeof v === 'string') return 'texto';
    return 'categoria';
  }

  function convertirTextoAVlor(txt) {
    var s = DC.aTexto(txt, '').trim();

    if (!s) return '';

    if (/^(true|false)$/i.test(s)) {
      return s.toLowerCase() === 'true';
    }

    var n = Number(s.replace(',', '.'));
    if (isFinite(n)) return n;

    return s;
  }

  function construirSteps() {
    return ramas.map(function (rama, idx) {
      var value;
      var tipo;
      var dominio;

      if (rama && rama.value !== undefined) {
        value = rama.value;
      } else if (DC.valorValido(rama && rama.nodeLabel)) {
        value = convertirTextoAVlor(rama.nodeLabel);
      } else {
        value = convertirTextoAVlor(rama && rama.edgeLabel);
      }

      tipo = DC.aTexto(rama && rama.tipo, inferirTipoDesdeValor(value));
      dominio = DC.aTexto(rama && rama.dominio, '');

      return {
        index: idx + 1,
        label: DC.aTexto(rama && rama.edgeLabel, ''),
        nodeLabel: DC.aTexto(rama && rama.nodeLabel, ''),
        value: value,
        tipo: tipo,
        dominio: dominio,
        meta: (rama && DC.esObjetoPlano(rama.meta)) ? DC.clonarProfundo(rama.meta) : {}
      };
    });
  }

  function normalizarPos(pos) {
    var p = Math.floor(Number(pos));
    if (!isFinite(p) || p < 1 || p > steps.length) return null;
    return p;
  }

  function stepEn(pos) {
    var p = normalizarPos(pos);
    return p ? steps[p - 1] : null;
  }

  function labelEn(pos) {
    var step = stepEn(pos);
    return step ? step.label : '';
  }

  function nodeLabelEn(pos) {
    var step = stepEn(pos);
    return step ? step.nodeLabel : '';
  }

  function valorEn(pos) {
    var step = stepEn(pos);
    return step ? step.value : null;
  }

  function tipoEn(pos) {
    var step = stepEn(pos);
    return step ? step.tipo : '';
  }

  function dominioEn(pos) {
    var step = stepEn(pos);
    return step ? step.dominio : '';
  }

  function normalizarPosiciones(posiciones) {
    if (!Array.isArray(posiciones)) return [];
    return posiciones
      .map(normalizarPos)
      .filter(function (p) { return !!p; });
  }

  function valoresEn(posiciones) {
    return normalizarPosiciones(posiciones).map(function (p) {
      return valorEn(p);
    });
  }

  function valoresNumericosEn(posiciones) {
    return valoresEn(posiciones)
      .map(function (v) { return Number(v); })
      .filter(function (n) { return isFinite(n); });
  }

  function sumaEn(posiciones) {
    var nums = valoresNumericosEn(posiciones);
    if (!nums.length) return null;
    return nums.reduce(function (acc, n) { return acc + n; }, 0);
  }

  function productoEn(posiciones) {
    var nums = valoresNumericosEn(posiciones);
    if (!nums.length) return null;
    return nums.reduce(function (acc, n) { return acc * n; }, 1);
  }

  function contarPorValor(stepsList) {
    var out = {};
    stepsList.forEach(function (step) {
      var k = String(step.value);
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  for (i = 0; i < branchProbList.length; i += 1) {
    if (!branchProbList[i]) {
      probValida = false;
      break;
    }
    probPath = DC.multiplicarRacionales(probPath, branchProbList[i]);
  }

  if (!probValida) {
    probPath = extraerProbTotalDesdeLeaf(leaf);
  }

  var steps = construirSteps();
  var numeros = steps
    .map(function (s) { return Number(s.value); })
    .filter(function (n) { return isFinite(n); });

  return {
    leaf: leaf,
    path: path,
    ramas: ramas,

    /* compatibilidad */
    labels: labels,
    nodeLabels: nodeLabels,

    /* nuevo núcleo semántico */
    steps: steps,

    depth: leaf.depth,
    conteos: contarPorEtiqueta(labels),
    conteosValores: contarPorValor(steps),
    leafLines: obtenerLineasLeaf(leaf),
    probR: probPath,
    probTexto: probPath ? DC.formatearRacional(probPath) : '',

    numeros: numeros.length ? numeros : null,
    suma: numeros.length ? numeros.reduce(function (acc, n) { return acc + n; }, 0) : null,
    producto: numeros.length ? numeros.reduce(function (acc, n) { return acc * n; }, 1) : null,
    minimo: numeros.length ? Math.min.apply(null, numeros) : null,
    maximo: numeros.length ? Math.max.apply(null, numeros) : null,

    primeraEtiqueta: labels.length ? labels[0] : '',
    ultimaEtiqueta: labels.length ? labels[labels.length - 1] : '',

    /* API NUEVA 1-based */
    stepEn: stepEn,
    labelEn: labelEn,
    nodeLabelEn: nodeLabelEn,
    valorEn: valorEn,
    tipoEn: tipoEn,
    dominioEn: dominioEn,
    valoresEn: valoresEn,
    valoresNumericosEn: valoresNumericosEn,
    sumaEn: sumaEn,
    productoEn: productoEn,

    /* compatibilidad antigua opcional */
    textoEn0: function (idx0) {
      idx0 = Math.floor(Number(idx0));
      if (!isFinite(idx0) || idx0 < 0 || idx0 >= labels.length) return '';
      return labels[idx0];
    },

    valorEn0: function (idx0) {
      idx0 = Math.floor(Number(idx0));
      if (!isFinite(idx0) || idx0 < 0 || idx0 >= steps.length) return null;
      return steps[idx0].value;
    }
  };
}

  function obtenerContextos(instancia) {
    var store = asegurarStore(instancia);

    if (!store.contextos) {
      store.contextos = instancia.leaves.map(construirContextoHoja);
    }

    return store.contextos;
  }

  function obtenerContextoPorLeaf(instancia, leaf) {
    var contextos = obtenerContextos(instancia);
    var i;

    for (i = 0; i < contextos.length; i += 1) {
      if (contextos[i].leaf === leaf) return contextos[i];
    }

    return null;
  }

  /* =========================================================
     EVENTOS
     ========================================================= */

  function definirEvento(instancia, nombre, criterio, meta) {
    var store = asegurarStore(instancia);
    var key = DC.aTexto(nombre, '').trim();
    var contextos;

    if (!key) {
      throw new Error('DiarbolEventos.definirEvento: falta nombre del evento.');
    }

    if (typeof criterio !== 'function') {
      throw new Error('DiarbolEventos.definirEvento: el criterio debe ser una función.');
    }

    contextos = obtenerContextos(instancia);

    var seleccionados = contextos.filter(function (ctx, idx) {
      return !!criterio(ctx, idx, contextos, instancia);
    });

    store.eventos[key] = {
      nombre: key,
      criterio: criterio,
      meta: DC.esObjetoPlano(meta) ? DC.clonarProfundo(meta) : {},
      contextos: seleccionados,
      hojas: seleccionados.map(function (ctx) { return ctx.leaf; }),
      totalContextos: contextos.length
    };

    return store.eventos[key];
  }

  function obtenerEvento(instancia, nombre) {
    var store = asegurarStore(instancia);
    var key = DC.aTexto(nombre, '').trim();
    return store.eventos[key] || null;
  }

  function listarEventos(instancia) {
    var store = asegurarStore(instancia);
    return Object.keys(store.eventos);
  }

  function eventoDesdeReferencia(instancia, ref) {
    if (typeof ref === 'string') {
      var ev = obtenerEvento(instancia, ref);
      if (!ev) {
        throw new Error('DiarbolEventos: no existe el evento "' + ref + '".');
      }
      return ev;
    }

    if (ref && Array.isArray(ref.contextos)) return ref;

    throw new Error('DiarbolEventos: referencia de evento no válida.');
  }

  function conjuntoLeafIds(evento) {
    var out = {};
    (evento.hojas || []).forEach(function (leaf) {
      out[leaf.id] = true;
    });
    return out;
  }

  function resumirProbabilidadDeContextos(contextos) {
    var total = null;
    var i;

    for (i = 0; i < contextos.length; i += 1) {
      if (!contextos[i].probR) {
        return null;
      }
      total = DC.sumarRacionales(total, contextos[i].probR);
    }

    return total;
  }

  function construirObjetoProbabilidad(r) {
    if (!r) return null;
    var s = DC.simplificarRacional(r);
    if (!s) return null;

    return {
      num: s.num,
      den: s.den,
      texto: DC.formatearRacional(s),
      decimal: DC.decimalDesdeRacional(s)
    };
  }

  function resumenEvento(instancia, nombreOEvento) {
    var evento = eventoDesdeReferencia(instancia, nombreOEvento);
    var totalHojas = obtenerContextos(instancia).length;
    var prob = resumirProbabilidadDeContextos(evento.contextos || []);

    return {
      nombre: evento.nombre,
      hojasFavorables: (evento.hojas || []).length,
      hojasTotales: totalHojas,
      probabilidad: construirObjetoProbabilidad(prob),
      contextos: evento.contextos.slice(),
      hojas: evento.hojas.slice()
    };
  }

  function probabilidadEvento(instancia, nombreOEvento) {
    return resumenEvento(instancia, nombreOEvento).probabilidad;
  }

  function unionEventos(instancia, eventoA, eventoB, nombreSalida, meta) {
    var evA = eventoDesdeReferencia(instancia, eventoA);
    var evB = eventoDesdeReferencia(instancia, eventoB);
    var idsA = conjuntoLeafIds(evA);
    var idsB = conjuntoLeafIds(evB);

    return definirEvento(instancia, nombreSalida, function (ctx) {
      return !!idsA[ctx.leaf.id] || !!idsB[ctx.leaf.id];
    }, DC.mergeProfundo({ operacion: 'union', de: [evA.nombre, evB.nombre] }, meta || {}));
  }

  function interseccionEventos(instancia, eventoA, eventoB, nombreSalida, meta) {
    var evA = eventoDesdeReferencia(instancia, eventoA);
    var evB = eventoDesdeReferencia(instancia, eventoB);
    var idsA = conjuntoLeafIds(evA);
    var idsB = conjuntoLeafIds(evB);

    return definirEvento(instancia, nombreSalida, function (ctx) {
      return !!idsA[ctx.leaf.id] && !!idsB[ctx.leaf.id];
    }, DC.mergeProfundo({ operacion: 'interseccion', de: [evA.nombre, evB.nombre] }, meta || {}));
  }

  function complementoEvento(instancia, eventoBase, nombreSalida, meta) {
    var ev = eventoDesdeReferencia(instancia, eventoBase);
    var ids = conjuntoLeafIds(ev);

    return definirEvento(instancia, nombreSalida, function (ctx) {
      return !ids[ctx.leaf.id];
    }, DC.mergeProfundo({ operacion: 'complemento', de: [ev.nombre] }, meta || {}));
  }

  function probabilidadCondicional(instancia, eventoA, eventoB) {
    var evA = eventoDesdeReferencia(instancia, eventoA);
    var evB = eventoDesdeReferencia(instancia, eventoB);
    var idsA = conjuntoLeafIds(evA);

    var inter = evB.contextos.filter(function (ctx) {
      return !!idsA[ctx.leaf.id];
    });

    var pInter = resumirProbabilidadDeContextos(inter);
    var pB = resumirProbabilidadDeContextos(evB.contextos || []);
    var resultado = DC.dividirRacionales(pInter, pB);

    return {
      evento: evA.nombre,
      condicion: evB.nombre,
      interseccion: construirObjetoProbabilidad(pInter),
      base: construirObjetoProbabilidad(pB),
      resultado: construirObjetoProbabilidad(resultado)
    };
  }



function diferenciaEventos(instancia, eventoA, eventoB, nombreSalida, meta) {
  var evA = eventoDesdeReferencia(instancia, eventoA);
  var evB = eventoDesdeReferencia(instancia, eventoB);
  var idsB = conjuntoLeafIds(evB);

  return definirEvento(instancia, nombreSalida, function (ctx) {
    return !!conjuntoLeafIds(evA)[ctx.leaf.id] && !idsB[ctx.leaf.id];
  }, DC.mergeProfundo({ operacion: 'diferencia', de: [evA.nombre, evB.nombre] }, meta || {}));
}

function definirEventoDesdeExpresion(instancia, nombre, expresion, meta) {
  var DCR = window.DiarbolCriterios || (window.DIARBOL && window.DIARBOL.criterios);

  if (!DCR) {
    throw new Error('DiarbolEventos.definirEventoDesdeExpresion: carga primero diarbol-criterios.js');
  }

  var criterio = DCR.crearCriterio(expresion);

  return definirEvento(
    instancia,
    nombre,
    criterio,
    DC.mergeProfundo({ expresion: DC.clonarProfundo(expresion) }, meta || {})
  );
}

function resolverEventoCompuesto(instancia, spec) {
  if (typeof spec === 'string') {
    return eventoDesdeReferencia(instancia, spec);
  }

  if (!DC.esObjetoPlano(spec)) {
    throw new Error('DiarbolEventos: expresión compuesta inválida.');
  }

  var keys = Object.keys(spec).filter(function (k) { return spec[k] !== undefined; });
  if (keys.length !== 1) {
    throw new Error('DiarbolEventos: la expresión compuesta debe tener una sola clave principal.');
  }

  var key = keys[0];

  if (key === 'event') {
    return eventoDesdeReferencia(instancia, spec.event);
  }

  if (key === 'union') {
    var uA = resolverEventoCompuesto(instancia, spec.union[0]);
    var uB = resolverEventoCompuesto(instancia, spec.union[1]);
    var idsUA = conjuntoLeafIds(uA);
    var idsUB = conjuntoLeafIds(uB);

    return {
      nombre: '(' + uA.nombre + ' ∪ ' + uB.nombre + ')',
      contextos: obtenerContextos(instancia).filter(function (ctx) {
        return !!idsUA[ctx.leaf.id] || !!idsUB[ctx.leaf.id];
      }),
      hojas: obtenerContextos(instancia).filter(function (ctx) {
        return !!idsUA[ctx.leaf.id] || !!idsUB[ctx.leaf.id];
      }).map(function (ctx) { return ctx.leaf; })
    };
  }

  if (key === 'intersection') {
    var iA = resolverEventoCompuesto(instancia, spec.intersection[0]);
    var iB = resolverEventoCompuesto(instancia, spec.intersection[1]);
    var idsIA = conjuntoLeafIds(iA);
    var idsIB = conjuntoLeafIds(iB);

    return {
      nombre: '(' + iA.nombre + ' ∩ ' + iB.nombre + ')',
      contextos: obtenerContextos(instancia).filter(function (ctx) {
        return !!idsIA[ctx.leaf.id] && !!idsIB[ctx.leaf.id];
      }),
      hojas: obtenerContextos(instancia).filter(function (ctx) {
        return !!idsIA[ctx.leaf.id] && !!idsIB[ctx.leaf.id];
      }).map(function (ctx) { return ctx.leaf; })
    };
  }

  if (key === 'complement') {
    var cA = resolverEventoCompuesto(instancia, spec.complement);
    var idsC = conjuntoLeafIds(cA);

    return {
      nombre: '(' + cA.nombre + ')c',
      contextos: obtenerContextos(instancia).filter(function (ctx) {
        return !idsC[ctx.leaf.id];
      }),
      hojas: obtenerContextos(instancia).filter(function (ctx) {
        return !idsC[ctx.leaf.id];
      }).map(function (ctx) { return ctx.leaf; })
    };
  }

  if (key === 'difference') {
    var dA = resolverEventoCompuesto(instancia, spec.difference[0]);
    var dB = resolverEventoCompuesto(instancia, spec.difference[1]);
    var idsDA = conjuntoLeafIds(dA);
    var idsDB = conjuntoLeafIds(dB);

    return {
      nombre: '(' + dA.nombre + ' \\ ' + dB.nombre + ')',
      contextos: obtenerContextos(instancia).filter(function (ctx) {
        return !!idsDA[ctx.leaf.id] && !idsDB[ctx.leaf.id];
      }),
      hojas: obtenerContextos(instancia).filter(function (ctx) {
        return !!idsDA[ctx.leaf.id] && !idsDB[ctx.leaf.id];
      }).map(function (ctx) { return ctx.leaf; })
    };
  }

  throw new Error('DiarbolEventos: operador compuesto no reconocido: ' + key);
}

function definirEventoCompuesto(instancia, nombre, spec, meta) {
  var resuelto = resolverEventoCompuesto(instancia, spec);
  var ids = conjuntoLeafIds(resuelto);

  return definirEvento(instancia, nombre, function (ctx) {
    return !!ids[ctx.leaf.id];
  }, DC.mergeProfundo({ compuesto: DC.clonarProfundo(spec) }, meta || {}));
}






  /* =========================================================
     RESALTADO VISUAL
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

  function setOpacity(el, value) {
    if (!el) return;
    el.style.opacity = value;
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

  function activarNodoVisual(node, opciones) {
    var color = DC.aTexto(opciones.color, '#ff9800');
    var activeLeafFill = DC.aTexto(opciones.activeLeafFill, '#fff8e8');
    var activeTextColorOnNode = DC.aTexto(opciones.activeTextColorOnNode, '#ffffff');

    if (node._edge) {
      var w = node._edgeOriginal ? node._edgeOriginal.width : 2;
      node._edge.setAttribute('stroke', color);
      node._edge.setAttribute('stroke-width', w + 1.4);
    }

    if (node._edgeBoxRect) {
      node._edgeBoxRect.setAttribute('stroke', color);
      node._edgeBoxRect.setAttribute('fill', '#ffffff');
    }

    if (node._edgeLabelEl) {
      node._edgeLabelEl.setAttribute('fill', color);
    }

    if (node._edgeValueEl) {
      node._edgeValueEl.setAttribute('fill', color);
    }

    if (node._circle) {
      node._circle.setAttribute('fill', color);
      node._circle.setAttribute('stroke', color);
    }

    if (node._nodeTextEl) {
      node._nodeTextEl.setAttribute('fill', activeTextColorOnNode);
    }

    if (node._leafBoxRect) {
      node._leafBoxRect.setAttribute('fill', activeLeafFill);
      node._leafBoxRect.setAttribute('stroke', color);
    }

    aplicarOpacidadNodo(node, '1');
  }

  function limpiarResaltado(instancia) {
    var store = asegurarStore(instancia);

    instancia.nodes.forEach(function (node) {
      restaurarNodoVisual(node);
    });

    store.resaltadoActual = null;
    return instancia;
  }

  function resaltarEvento(instancia, nombreOEvento, opciones) {
    var evento = eventoDesdeReferencia(instancia, nombreOEvento);
    var optsBase = {
      color: instancia.options && instancia.options.interaction
        ? instancia.options.interaction.highlightColor
        : '#ff9800',
      activeLeafFill: instancia.options && instancia.options.interaction
        ? instancia.options.interaction.activeLeafFill
        : '#fff8e8',
      activeTextColorOnNode: instancia.options && instancia.options.interaction
        ? instancia.options.interaction.activeTextColorOnNode
        : '#ffffff',
      dimOthers: true,
      dimOpacity: instancia.options && instancia.options.interaction
        ? DC.aNumero(instancia.options.interaction.dimOpacity, 0.18)
        : 0.18
    };

    var opts = DC.mergeProfundo(optsBase, opciones || {});
    var activos = {};
    var store = asegurarStore(instancia);

    (evento.hojas || []).forEach(function (leaf) {
      rutaHastaRaiz(leaf).forEach(function (node) {
        activos[node.id] = true;
      });
    });

    instancia.nodes.forEach(function (node) {
      restaurarNodoVisual(node);

      if (activos[node.id]) {
        activarNodoVisual(node, opts);
      } else if (opts.dimOthers) {
        aplicarOpacidadNodo(node, String(opts.dimOpacity));
      }
    });

    store.resaltadoActual = {
      nombre: evento.nombre,
      opciones: DC.clonarProfundo(opts)
    };

    return instancia;
  }

  /* =========================================================
     API
     ========================================================= */

  var api = {
    crearContextosHojas: obtenerContextos,
    obtenerContextoPorLeaf: obtenerContextoPorLeaf,
    definirEvento: definirEvento,
    obtenerEvento: obtenerEvento,
    listarEventos: listarEventos,
    resumenEvento: resumenEvento,
    probabilidadEvento: probabilidadEvento,
    unionEventos: unionEventos,
    interseccionEventos: interseccionEventos,
    complementoEvento: complementoEvento,
   diferenciaEventos: diferenciaEventos,
   definirEventoDesdeExpresion: definirEventoDesdeExpresion,
   definirEventoCompuesto: definirEventoCompuesto,
    probabilidadCondicional: probabilidadCondicional,
    resaltarEvento: resaltarEvento,
    limpiarResaltado: limpiarResaltado
  };

  window.DiarbolEventos = api;

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.eventosSemanticos = api;

})(window);

