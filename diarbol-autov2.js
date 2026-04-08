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
















