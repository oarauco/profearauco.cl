(function (window) {
  'use strict';

  var DC = window.DiarbolCore || (window.DIARBOL && window.DIARBOL.core);

  if (!DC) {
    throw new Error('diarbol-themes.js: carga primero diarbol-core.js');
  }

  var THEMES = {};
  var ALIASES = {};

  /* =========================================================
     HELPERS
     ========================================================= */

  function normalizarNombre(nombre, fallback) {
    return DC.aTexto(nombre, fallback || '')
      .trim()
      .toLowerCase();
  }

  function crearTema(base, extra) {
    return DC.mergeProfundo(base, extra || {});
  }

  function temaBase() {
    return {
      width: 980,
      height: 560,

      layout: {
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

      edgeStyle: {
        showBox: true,
        boxT: 0.58,
        boxMinWidth: 74
      },

      interaction: {
        highlightPathOnHover: true,
        dimOthers: true,
        dimOpacity: 0.18
      }
    };
  }

  function nombreCanonico(nombreTema) {
    var n = normalizarNombre(nombreTema, 'base');

    if (ALIASES[n]) return ALIASES[n];
    if (THEMES[n]) return n;

    return 'base';
  }

  /* =========================================================
     TEMAS
     ========================================================= */

  THEMES.base = temaBase();

  THEMES.moneda = crearTema(THEMES.base, {
    width: 1180,
    height: 900,

    titleStyle: {
      color: '#b85a00'
    },

    stageLabelStyle: {
      color: '#0b6b62'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.58,
      boxFill: '#ffffff',
      boxStroke: '#d7d7d7'
    },

    leafBoxStyle: {
      show: true,
      width: 230,
      minHeight: 70,
      fill: '#fffaf3',
      stroke: '#e1c39e'
    },

    interaction: {
      highlightColor: '#4caf50',
      activeLeafFill: '#f3fbf3'
    }
  });

  THEMES.ruleta = crearTema(THEMES.base, {
    width: 1400,
    height: 1100,

    titleStyle: {
      color: '#7b1fa2'
    },

    stageLabelStyle: {
      color: '#1565c0'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.56,
      boxFill: '#ffffff',
      boxStroke: '#d7d7d7',
      boxMinWidth: 90
    },

    leafBoxStyle: {
      show: true,
      width: 255,
      minHeight: 76,
      fill: '#faf7ff',
      stroke: '#d1c4e9'
    },

    interaction: {
      highlightColor: '#ff9800',
      activeLeafFill: '#fff8e8'
    }
  });

  THEMES.dado = crearTema(THEMES.base, {
    width: 1320,
    height: 980,

    layout: {
      minLevelGap: 175,
      leafGap: 92,
      leafBoxGap: 34
    },

    titleStyle: {
      color: '#1565c0'
    },

    stageLabelStyle: {
      color: '#6a1b9a'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.57,
      boxFill: '#ffffff',
      boxStroke: '#bbdefb',
      boxMinWidth: 82
    },

    leafBoxStyle: {
      show: true,
      width: 235,
      minHeight: 72,
      fill: '#f7fbff',
      stroke: '#90caf9'
    },

    interaction: {
      highlightColor: '#1e88e5',
      activeLeafFill: '#eef7ff'
    }
  });

  THEMES.extraccion = crearTema(THEMES.base, {
    width: 1320,
    height: 980,

    layout: {
      minLevelGap: 180,
      leafGap: 96,
      leafBoxGap: 36
    },

    titleStyle: {
      color: '#8d6e63'
    },

    stageLabelStyle: {
      color: '#00695c'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.57,
      boxFill: '#ffffff',
      boxStroke: '#d7ccc8',
      boxMinWidth: 92
    },

    leafBoxStyle: {
      show: true,
      width: 245,
      minHeight: 74,
      fill: '#fffaf3',
      stroke: '#d7ccc8'
    },

    interaction: {
      highlightColor: '#26a69a',
      activeLeafFill: '#f1fbfa'
    }
  });

  /* Temas que en tu auto ya estaban siendo llamados,
     pero antes no estaban formalizados en TP_AUTO_THEMES */

  THEMES.evento = crearTema(THEMES.base, {
    width: 1100,
    height: 760,

    titleStyle: {
      color: '#5e35b1'
    },

    stageLabelStyle: {
      color: '#4527a0'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.58,
      boxFill: '#faf7ff',
      boxStroke: '#d1c4e9',
      boxMinWidth: 84
    },

    leafBoxStyle: {
      show: true,
      width: 235,
      minHeight: 72,
      fill: '#faf7ff',
      stroke: '#d1c4e9'
    },

    interaction: {
      highlightColor: '#7e57c2',
      activeLeafFill: '#f7f2ff'
    }
  });

  THEMES.experimento = crearTema(THEMES.base, {
    width: 1180,
    height: 860,

    titleStyle: {
      color: '#5e35b1'
    },

    stageLabelStyle: {
      color: '#4527a0'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.58,
      boxFill: '#faf7ff',
      boxStroke: '#d1c4e9',
      boxMinWidth: 84
    },

    leafBoxStyle: {
      show: true,
      width: 235,
      minHeight: 72,
      fill: '#faf7ff',
      stroke: '#d1c4e9'
    },

    interaction: {
      highlightColor: '#7e57c2',
      activeLeafFill: '#f7f2ff'
    }
  });

  THEMES.binario = crearTema(THEMES.base, {
    width: 1080,
    height: 760,

    titleStyle: {
      color: '#455a64'
    },

    stageLabelStyle: {
      color: '#37474f'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.58,
      boxFill: '#f8fbfc',
      boxStroke: '#cfd8dc',
      boxMinWidth: 80
    },

    leafBoxStyle: {
      show: true,
      width: 225,
      minHeight: 70,
      fill: '#f8fbfc',
      stroke: '#cfd8dc'
    },

    interaction: {
      highlightColor: '#546e7a',
      activeLeafFill: '#f1f6f8'
    }
  });

  THEMES.conteo = crearTema(THEMES.base, {
    width: 1120,
    height: 780,

    titleStyle: {
      color: '#6d4c41'
    },

    stageLabelStyle: {
      color: '#5d4037'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.58,
      boxFill: '#fdfaf8',
      boxStroke: '#d7ccc8',
      boxMinWidth: 84
    },

    leafBoxStyle: {
      show: true,
      width: 235,
      minHeight: 72,
      fill: '#fdfaf8',
      stroke: '#d7ccc8'
    },

    interaction: {
      highlightColor: '#8d6e63',
      activeLeafFill: '#faf6f3'
    }
  });

  THEMES.casos = crearTema(THEMES.base, {
    width: 1120,
    height: 780,

    titleStyle: {
      color: '#3949ab'
    },

    stageLabelStyle: {
      color: '#283593'
    },

    edgeStyle: {
      showBox: true,
      boxT: 0.58,
      boxFill: '#f7f8ff',
      boxStroke: '#c5cae9',
      boxMinWidth: 84
    },

    leafBoxStyle: {
      show: true,
      width: 235,
      minHeight: 72,
      fill: '#f7f8ff',
      stroke: '#c5cae9'
    },

    interaction: {
      highlightColor: '#5c6bc0',
      activeLeafFill: '#f1f3ff'
    }
  });

  /* =========================================================
     ALIASES
     ========================================================= */

  ALIASES['default'] = 'base';
  ALIASES['defecto'] = 'base';

  ALIASES['extraccion-con-reposicion'] = 'extraccion';
  ALIASES['extraccion-sin-reposicion'] = 'extraccion';
  ALIASES['urna'] = 'extraccion';

  ALIASES['experimento-compuesto'] = 'experimento';
  ALIASES['compuesto'] = 'experimento';

  ALIASES['caso'] = 'casos';

  /* =========================================================
     API
     ========================================================= */

  function resolverTema(nombreTema, overrides) {
    var canonico = nombreCanonico(nombreTema);
    var tema = DC.clonarProfundo(THEMES[canonico] || THEMES.base);

    if (DC.esObjetoPlano(overrides)) {
      tema = DC.mergeProfundo(tema, overrides);
    }

    return tema;
  }

  function obtenerTema(nombreTema) {
    return resolverTema(nombreTema);
  }

  function registrarTema(nombre, config, heredaDe) {
    var nombreNormalizado = normalizarNombre(nombre);

    if (!nombreNormalizado) {
      throw new Error('diarbol-themes.js: el nombre del tema es obligatorio.');
    }

    if (!DC.esObjetoPlano(config)) {
      throw new Error('diarbol-themes.js: config debe ser un objeto plano.');
    }

    var base = resolverTema(heredaDe || 'base');
    THEMES[nombreNormalizado] = DC.mergeProfundo(base, config);

    return DC.clonarProfundo(THEMES[nombreNormalizado]);
  }

  function registrarAlias(alias, destino) {
    var a = normalizarNombre(alias);
    var d = nombreCanonico(destino);

    if (!a) {
      throw new Error('diarbol-themes.js: el alias es obligatorio.');
    }

    ALIASES[a] = d;
    return d;
  }

  function listarTemas() {
    return Object.keys(THEMES).sort();
  }

  function listarAliases() {
    return DC.clonarProfundo(ALIASES);
  }

  var api = {
    resolverTema: resolverTema,
    obtenerTema: obtenerTema,
    registrarTema: registrarTema,
    registrarAlias: registrarAlias,
    listarTemas: listarTemas,
    listarAliases: listarAliases
  };

  window.DiarbolThemes = api;

  window.DIARBOL = window.DIARBOL || {};
  window.DIARBOL.themes = api;

})(window);
