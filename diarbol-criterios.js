(function (window) {
  'use strict';

  var DC = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);

  if (!DC) {
    throw new Error('diarbol-criterios.js: carga primero diarbol-core.js');
  }

  var TIPOS = {
    entero: {
      nombre: 'entero',
      admite: {
        eq: true, ne: true,
        lt: true, lte: true, gt: true, gte: true,
        even: true, odd: true,
        sum: true, prod: true,
        in: true, notIn: true
      }
    },
    numero: {
      nombre: 'numero',
      admite: {
        eq: true, ne: true,
        lt: true, lte: true, gt: true, gte: true,
        even: false, odd: false,
        sum: true, prod: true,
        in: true, notIn: true
      }
    },
    racional: {
      nombre: 'racional',
      admite: {
        eq: true, ne: true,
        lt: true, lte: true, gt: true, gte: true,
        even: false, odd: false,
        sum: true, prod: true,
        in: true, notIn: true
      }
    },
    texto: {
      nombre: 'texto',
      admite: {
        eq: true, ne: true,
        lt: false, lte: false, gt: false, gte: false,
        even: false, odd: false,
        sum: false, prod: false,
        in: true, notIn: true
      }
    },
    categoria: {
      nombre: 'categoria',
      admite: {
        eq: true, ne: true,
        lt: false, lte: false, gt: false, gte: false,
        even: false, odd: false,
        sum: false, prod: false,
        in: true, notIn: true
      }
    },
    booleano: {
      nombre: 'booleano',
      admite: {
        eq: true, ne: true,
        lt: false, lte: false, gt: false, gte: false,
        even: false, odd: false,
        sum: false, prod: false,
        in: true, notIn: true
      }
    }
  };

  function registrarTipo(nombre, config) {
    var key = DC.aTexto(nombre, '').trim();
    if (!key) {
      throw new Error('DiarbolCriterios.registrarTipo: falta nombre.');
    }
    if (!DC.esObjetoPlano(config)) {
      throw new Error('DiarbolCriterios.registrarTipo: config inválida.');
    }
    TIPOS[key] = DC.mergeProfundo({ nombre: key, admite: {} }, config);
    return TIPOS[key];
  }

  function listarTipos() {
    return Object.keys(TIPOS).sort();
  }

  function obtenerTipo(nombre) {
    var key = DC.aTexto(nombre, '').trim();
    return TIPOS[key] || null;
  }

  function inferirTipoDesdeValor(value) {
    if (typeof value === 'boolean') return 'booleano';
    if (typeof value === 'number' && isFinite(value)) {
      return Math.floor(value) === value ? 'entero' : 'numero';
    }
    if (typeof value === 'string') return 'texto';
    return 'categoria';
  }

  function convertirTextoAVlor(texto) {
    var txt = DC.aTexto(texto, '').trim();
    if (!txt) return '';

    if (/^(true|false)$/i.test(txt)) {
      return txt.toLowerCase() === 'true';
    }

    var n = Number(txt.replace(',', '.'));
    if (isFinite(n)) return n;

    return txt;
  }

  function construirStepFallback(ctx, pos) {
    var idx = pos - 1;
    var label = Array.isArray(ctx.labels) ? DC.aTexto(ctx.labels[idx], '') : '';
    var nodeLabel = Array.isArray(ctx.nodeLabels) ? DC.aTexto(ctx.nodeLabels[idx], '') : '';

    var value = '';
    if (DC.valorValido(nodeLabel)) {
      value = convertirTextoAVlor(nodeLabel);
    } else {
      value = convertirTextoAVlor(label);
    }

    return {
      label: label,
      nodeLabel: nodeLabel,
      value: value,
      tipo: inferirTipoDesdeValor(value),
      dominio: ''
    };
  }

  function obtenerStep(ctx, pos) {
    var p = Math.floor(Number(pos));

    if (!isFinite(p) || p < 1) {
      throw new Error('DiarbolCriterios: la posición debe ser 1, 2, 3, ...');
    }

    if (Array.isArray(ctx.steps) && ctx.steps[p - 1]) {
      var step = ctx.steps[p - 1];
      return {
        label: DC.aTexto(step.label, ''),
        nodeLabel: DC.aTexto(step.nodeLabel, ''),
        value: step.value,
        tipo: DC.aTexto(step.tipo, inferirTipoDesdeValor(step.value)),
        dominio: DC.aTexto(step.dominio, '')
      };
    }

    return construirStepFallback(ctx, p);
  }

  function esNumeroValido(x) {
    return typeof x === 'number' && isFinite(x);
  }

  function esEnteroValido(x) {
    return esNumeroValido(x) && Math.floor(x) === x;
  }

  function assertNumero(x, nombre) {
    if (!esNumeroValido(x)) {
      throw new Error('DiarbolCriterios: "' + nombre + '" requiere valor numérico.');
    }
  }

  function assertEntero(x, nombre) {
    if (!esEnteroValido(x)) {
      throw new Error('DiarbolCriterios: "' + nombre + '" requiere valor entero.');
    }
  }

  function claveUnica(obj) {
    var keys = Object.keys(obj || {}).filter(function (k) {
      return obj[k] !== undefined;
    });

    if (keys.length !== 1) {
      throw new Error('DiarbolCriterios: la expresión debe tener exactamente una clave principal.');
    }

    return keys[0];
  }

  /* =========================================================
     VALIDACIÓN
     ========================================================= */

  function validarExprValor(expr) {
    if (!DC.esObjetoPlano(expr)) {
      throw new Error('DiarbolCriterios: expresión de valor inválida.');
    }

    var key = claveUnica(expr);

    if (key === 'pos') {
      if (!isFinite(Number(expr.pos)) || Number(expr.pos) < 1) {
        throw new Error('DiarbolCriterios: "pos" debe ser >= 1.');
      }
      return true;
    }

    if (key === 'const') {
      return true;
    }

    if (key === 'sum' || key === 'prod') {
      if (!Array.isArray(expr[key]) || !expr[key].length) {
        throw new Error('DiarbolCriterios: "' + key + '" debe ser un arreglo no vacío.');
      }
      expr[key].forEach(validarExprValor);
      return true;
    }

    throw new Error('DiarbolCriterios: operador de valor no reconocido: ' + key);
  }

  function validarPredicado(pred) {
    if (!DC.esObjetoPlano(pred)) {
      throw new Error('DiarbolCriterios: predicado inválido.');
    }

    var key = claveUnica(pred);

    if (key === 'and' || key === 'or') {
      if (!Array.isArray(pred[key]) || !pred[key].length) {
        throw new Error('DiarbolCriterios: "' + key + '" debe ser un arreglo no vacío.');
      }
      pred[key].forEach(validarPredicado);
      return true;
    }

    if (key === 'not') {
      validarPredicado(pred.not);
      return true;
    }

    if (key === 'even' || key === 'odd') {
      validarExprValor(pred[key]);
      return true;
    }

    if (key === 'eq' || key === 'ne' || key === 'lt' || key === 'lte' || key === 'gt' || key === 'gte') {
      if (!Array.isArray(pred[key]) || pred[key].length !== 2) {
        throw new Error('DiarbolCriterios: "' + key + '" debe tener exactamente 2 argumentos.');
      }
      validarExprValor(pred[key][0]);
      validarExprValor(pred[key][1]);
      return true;
    }

    if (key === 'in' || key === 'notIn') {
      if (!Array.isArray(pred[key]) || pred[key].length !== 2 || !Array.isArray(pred[key][1])) {
        throw new Error('DiarbolCriterios: "' + key + '" debe tener forma [expr, arreglo].');
      }
      validarExprValor(pred[key][0]);
      return true;
    }

    throw new Error('DiarbolCriterios: predicado no reconocido: ' + key);
  }

  /* =========================================================
     EVALUACIÓN
     ========================================================= */

  function evaluarExprValor(expr, ctx) {
    var key = claveUnica(expr);

    if (key === 'pos') {
      return obtenerStep(ctx, expr.pos).value;
    }

    if (key === 'const') {
      return expr.const;
    }

    if (key === 'sum') {
      return expr.sum.reduce(function (acc, sub) {
        var val = evaluarExprValor(sub, ctx);
        assertNumero(val, 'sum');
        return acc + val;
      }, 0);
    }

    if (key === 'prod') {
      return expr.prod.reduce(function (acc, sub) {
        var val = evaluarExprValor(sub, ctx);
        assertNumero(val, 'prod');
        return acc * val;
      }, 1);
    }

    throw new Error('DiarbolCriterios: operador de valor no soportado: ' + key);
  }

  function evaluarPredicado(pred, ctx) {
    var key = claveUnica(pred);

    if (key === 'and') {
      return pred.and.every(function (sub) {
        return !!evaluarPredicado(sub, ctx);
      });
    }

    if (key === 'or') {
      return pred.or.some(function (sub) {
        return !!evaluarPredicado(sub, ctx);
      });
    }

    if (key === 'not') {
      return !evaluarPredicado(pred.not, ctx);
    }

    if (key === 'even') {
      var valEven = evaluarExprValor(pred.even, ctx);
      assertEntero(valEven, 'even');
      return valEven % 2 === 0;
    }

    if (key === 'odd') {
      var valOdd = evaluarExprValor(pred.odd, ctx);
      assertEntero(valOdd, 'odd');
      return Math.abs(valOdd % 2) === 1;
    }

    if (key === 'eq') {
      return evaluarExprValor(pred.eq[0], ctx) === evaluarExprValor(pred.eq[1], ctx);
    }

    if (key === 'ne') {
      return evaluarExprValor(pred.ne[0], ctx) !== evaluarExprValor(pred.ne[1], ctx);
    }

    if (key === 'lt') {
      var ltA = evaluarExprValor(pred.lt[0], ctx);
      var ltB = evaluarExprValor(pred.lt[1], ctx);
      assertNumero(ltA, 'lt');
      assertNumero(ltB, 'lt');
      return ltA < ltB;
    }

    if (key === 'lte') {
      var lteA = evaluarExprValor(pred.lte[0], ctx);
      var lteB = evaluarExprValor(pred.lte[1], ctx);
      assertNumero(lteA, 'lte');
      assertNumero(lteB, 'lte');
      return lteA <= lteB;
    }

    if (key === 'gt') {
      var gtA = evaluarExprValor(pred.gt[0], ctx);
      var gtB = evaluarExprValor(pred.gt[1], ctx);
      assertNumero(gtA, 'gt');
      assertNumero(gtB, 'gt');
      return gtA > gtB;
    }

    if (key === 'gte') {
      var gteA = evaluarExprValor(pred.gte[0], ctx);
      var gteB = evaluarExprValor(pred.gte[1], ctx);
      assertNumero(gteA, 'gte');
      assertNumero(gteB, 'gte');
      return gteA >= gteB;
    }

    if (key === 'in') {
      var inVal = evaluarExprValor(pred.in[0], ctx);
      return pred.in[1].some(function (x) { return x === inVal; });
    }

    if (key === 'notIn') {
      var notInVal = evaluarExprValor(pred.notIn[0], ctx);
      return !pred.notIn[1].some(function (x) { return x === notInVal; });
    }

    throw new Error('DiarbolCriterios: predicado no soportado: ' + key);
  }

  function crearCriterio(predicado) {
    validarPredicado(predicado);

    return function (ctx) {
      return !!evaluarPredicado(predicado, ctx);
    };
  }

  var api = {
    registrarTipo: registrarTipo,
    listarTipos: listarTipos,
    obtenerTipo: obtenerTipo,
    inferirTipoDesdeValor: inferirTipoDesdeValor,
    obtenerStep: obtenerStep,

    validarExprValor: validarExprValor,
    validarPredicado: validarPredicado,

    evaluarExprValor: evaluarExprValor,
    evaluarPredicado: evaluarPredicado,

    crearCriterio: crearCriterio
  };

  window.DiarbolCriterios = api;
  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.criterios = api;

})(window);
