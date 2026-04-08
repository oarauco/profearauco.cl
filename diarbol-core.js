(function (window) {
  'use strict';

  if (!window) {
    throw new Error('diarbol-core.js: window no está disponible.');
  }

  /* =========================================================
     UTILIDADES INTERNAS
     ========================================================= */

  function valorValido(v) {
    return v !== undefined && v !== null && v !== '';
  }

  function esObjetoPlano(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function aNumero(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function aTexto(v, fallback) {
    return valorValido(v) ? String(v) : (fallback || '');
  }

function clonarProfundo(obj) {
  if (obj === undefined || obj === null) return obj;

  var tipo = typeof obj;

  if (tipo === 'function') return obj;
  if (tipo !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(function(item) {
      return clonarProfundo(item);
    });
  }

  var copia = {};
  Object.keys(obj).forEach(function(k) {
    copia[k] = clonarProfundo(obj[k]);
  });

  return copia;
}

  function mergeProfundo(base, extra) {
    var salida = esObjetoPlano(base) || Array.isArray(base)
      ? clonarProfundo(base)
      : {};

    if (!esObjetoPlano(extra)) return salida;

    Object.keys(extra).forEach(function (k) {
      if (esObjetoPlano(extra[k]) && esObjetoPlano(salida[k])) {
        salida[k] = mergeProfundo(salida[k], extra[k]);
      } else {
        salida[k] = clonarProfundo(extra[k]);
      }
    });

    return salida;
  }

  function capitalizar(txt) {
    txt = aTexto(txt, '');
    if (!txt) return '';
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  /* =========================================================
     RACIONALES
     ========================================================= */

  function mcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);

    while (b) {
      var t = b;
      b = a % b;
      a = t;
    }

    return a || 1;
  }

  function simplificarRacional(r) {
    if (!r) return null;
    if (!isFinite(r.num) || !isFinite(r.den) || r.den === 0) return null;

    var signo = r.den < 0 ? -1 : 1;
    var num = r.num * signo;
    var den = r.den * signo;
    var d = mcd(num, den);

    return {
      num: num / d,
      den: den / d
    };
  }

  function racionalDesdeNumero(n) {
    if (!isFinite(n)) return null;

    var s = String(n);

    if (s.indexOf('e') >= 0 || s.indexOf('E') >= 0) {
      return null;
    }

    if (s.indexOf('.') === -1) {
      return { num: Number(s), den: 1 };
    }

    var partes = s.split('.');
    var enteros = partes[0];
    var dec = partes[1] || '';
    var den = Math.pow(10, dec.length);
    var num = Number(enteros + dec);

    return simplificarRacional({ num: num, den: den });
  }

  function racionalDesdeValor(v) {
    if (typeof v === 'number') {
      return racionalDesdeNumero(v);
    }

    if (!valorValido(v)) return null;

    var txt = String(v).trim().replace(',', '.');

    if (!txt) return null;

    if (txt.indexOf('/') >= 0) {
      var partes = txt.split('/');
      if (partes.length !== 2) return null;

      var num = Number(partes[0].trim());
      var den = Number(partes[1].trim());

      if (!isFinite(num) || !isFinite(den) || den === 0) {
        return null;
      }

      return simplificarRacional({ num: num, den: den });
    }

    var n = Number(txt);
    if (!isFinite(n)) return null;

    return racionalDesdeNumero(n);
  }

  function multiplicarRacionales(a, b) {
    if (!a || !b) return null;

    return simplificarRacional({
      num: a.num * b.num,
      den: a.den * b.den
    });
  }




function dividirRacionales(a, b) {
  if (!a || !b || b.num === 0) return null;

  return simplificarRacional({
    num: a.num * b.den,
    den: a.den * b.num
  });
}

function sumarRacionales(a, b) {
  if (!a && !b) return null;
  if (!a) return simplificarRacional(b);
  if (!b) return simplificarRacional(a);

  return simplificarRacional({
    num: a.num * b.den + b.num * a.den,
    den: a.den * b.den
  });
}

function compararRacionales(a, b) {
  if (!a || !b) return false;

  var sa = simplificarRacional(a);
  var sb = simplificarRacional(b);

  if (!sa || !sb) return false;
  return sa.num === sb.num && sa.den === sb.den;
}

function decimalDesdeRacional(r) {
  if (!r || !isFinite(r.num) || !isFinite(r.den) || r.den === 0) return null;
  return r.num / r.den;
}










  function formatearRacional(r) {
    if (!r) return '';

    var s = simplificarRacional(r);
    if (!s) return '';

    if (s.den === 1) return String(s.num);
    return s.num + '/' + s.den;
  }

  function crearRacionalUno() {
    return { num: 1, den: 1 };
  }

  /* =========================================================
     CONTEOS Y ETIQUETAS
     ========================================================= */

  function contarPorClave(lista, getKey) {
    var out = {};

    (lista || []).forEach(function (item) {
      var k = String(getKey(item));
      out[k] = (out[k] || 0) + 1;
    });

    return out;
  }

  function crearStageLabels(cantidad, nombreEtapa) {
    cantidad = Math.max(0, Math.floor(aNumero(cantidad, 0)));
    nombreEtapa = aTexto(nombreEtapa, 'etapa');

    return Array.from({ length: cantidad + 2 }, function (_, i) {
      if (i === 0) return 'Inicio';
      if (i <= cantidad) return i + '° ' + nombreEtapa;
      return 'Resultado final';
    });
  }

  function crearLineaConteosPath(path) {
    var orden = [];
    var counts = {};

    (path || []).forEach(function (p) {
      var lbl = aTexto(p && p.label, '');
      if (!lbl) return;

      if (!counts[lbl]) orden.push(lbl);
      counts[lbl] = (counts[lbl] || 0) + 1;
    });

    if (!orden.length) return '';

    return 'Conteos: ' + orden.map(function (lbl) {
      return lbl + '=' + counts[lbl];
    }).join(', ');
  }

  function totalizarConteos(items) {
    return (items || []).reduce(function (acc, item) {
      return acc + Math.max(0, Math.floor(aNumero(item && item.count, 0)));
    }, 0);
  }

  function clonarItemsConConteo(items) {
    return (items || []).map(function (item) {
      return clonarProfundo(item);
    });
  }

  /* =========================================================
     NORMALIZADORES BASE
     ========================================================= */

 function normalizarElementoExtraccion(item, idx, estiloBase) {
  estiloBase = esObjetoPlano(estiloBase) ? estiloBase : {};

  var fallbackLabel = 'Elemento ' + (idx + 1);

  return {
    key: aTexto(
      item && item.key,
      aTexto(item && item.label, fallbackLabel).toLowerCase()
    ),

    label: aTexto(item && item.label, fallbackLabel),

    nodeLabel: aTexto(
      item && item.nodeLabel,
      aTexto(item && item.label, fallbackLabel).slice(0, 2)
    ),

    value: item ? item.value : undefined,
    tipo: aTexto(item && item.tipo, ''),
    dominio: aTexto(item && item.dominio, ''),
    meta: esObjetoPlano(item && item.meta) ? clonarProfundo(item.meta) : {},

    count: Math.max(0, Math.floor(aNumero(item && item.count, 0))),
    prob: valorValido(item && item.prob) ? item.prob : '',

    nodeStyle: mergeProfundo(
      estiloBase.nodeStyle || {},
      esObjetoPlano(item && item.nodeStyle) ? item.nodeStyle : {}
    ),

    edgeStyle: mergeProfundo(
      estiloBase.edgeStyle || {},
      esObjetoPlano(item && item.edgeStyle) ? item.edgeStyle : {}
    ),

    leafBoxStyle: mergeProfundo(
      estiloBase.leafBoxStyle || {},
      esObjetoPlano(item && item.leafBoxStyle) ? item.leafBoxStyle : {}
    ),

    leafNodeStyle: mergeProfundo(
      estiloBase.leafNodeStyle || {},
      esObjetoPlano(item && item.leafNodeStyle) ? item.leafNodeStyle : {}
    )
  };
}



  /* =========================================================
     API PÚBLICA
     ========================================================= */

  var api = {
    valorValido: valorValido,
    esObjetoPlano: esObjetoPlano,
    aNumero: aNumero,
    aTexto: aTexto,
    clonarProfundo: clonarProfundo,
    mergeProfundo: mergeProfundo,
    capitalizar: capitalizar,

    mcd: mcd,
    simplificarRacional: simplificarRacional,
    racionalDesdeNumero: racionalDesdeNumero,
    racionalDesdeValor: racionalDesdeValor,
    multiplicarRacionales: multiplicarRacionales,
    dividirRacionales: dividirRacionales,
    sumarRacionales: sumarRacionales,
    compararRacionales: compararRacionales,
    decimalDesdeRacional: decimalDesdeRacional,
    formatearRacional: formatearRacional,
    crearRacionalUno: crearRacionalUno,

    contarPorClave: contarPorClave,
    crearStageLabels: crearStageLabels,
    crearLineaConteosPath: crearLineaConteosPath,
    totalizarConteos: totalizarConteos,
    clonarItemsConConteo: clonarItemsConConteo,

    normalizarElementoExtraccion: normalizarElementoExtraccion
  };

  window.DiarbolCore = api;

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.core = api;

})(window);
