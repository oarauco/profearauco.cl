(() => {
  "use strict";
  /* ========================= Utilidades generales ========================= */ 
  function esValorValido(
    v,
  ) {
    return v !== undefined && v !== null && v !== "";
  }
  function aTexto(v) {
    return String(v);
  }
  function limpiarLista(lista) {
    return [...new Set((lista || []).filter(esValorValido).map(aTexto))];
  }
  function extraerElementosDesdePares(pares, indice) {
    return limpiarLista((pares || []).map((par) => par?.[indice]));
  }
  function clavePar(a, b) {
    return `${aTexto(a)}|||${aTexto(b)}`;
  }
  function construirSetPares(pares) {
    const set = new Set();
    (pares || []).forEach((par) => {
      const a = par?.[0];
      const b = par?.[1];
      if (esValorValido(a) && esValorValido(b)) {
        set.add(clavePar(a, b));
      }
    });
    return set;
  }
  function obtenerCanvasYContexto(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    return { canvas, ctx };
  }
  function resolverSuspensivosColumna(config, sufijo) {
    const legacyMostrar = !!config[`mostrarSuspensivos${sufijo}`];
    const legacyTexto = config[`textoSuspensivos${sufijo}`];
    return {
      inicio: !!config[`mostrarSuspensivosInicio${sufijo}`],
      fin: !!config[`mostrarSuspensivosFin${sufijo}`] || legacyMostrar,
      textoInicio:
        config[`textoSuspensivosInicio${sufijo}`] ||
        legacyTexto ||
        config.textoSuspensivos ||
        "⋮",
      textoFin:
        config[`textoSuspensivosFin${sufijo}`] ||
        legacyTexto ||
        config.textoSuspensivos ||
        "⋮",
    };
  }
  /* ========================= Helpers de dibujo base ========================= */ 
  function calcularNodosVerticales(
    elementos,
    centroX,
    yTop,
    altoConjunto,
    opciones = {},
  ) {
    const nodos = {};
    const cantidad = Math.max(elementos.length, 1);
    const margenSuperior = opciones.margenSuperior || 0;
    const margenInferior = opciones.margenInferior || 0;
    const altoUtil = Math.max(
      60,
      altoConjunto - margenSuperior - margenInferior,
    );
    const espacio = altoUtil / (cantidad + 1);
    elementos.forEach((el, index) => {
      nodos[el] = {
        x: centroX,
        y: yTop + margenSuperior + espacio * (index + 1),
        etiqueta: el,
      };
    });
    return nodos;
  }
  function calcularNodosCirculares(elementos, centroX, centroY, radio) {
    const nodos = {};
    const n = Math.max(elementos.length, 1);
    elementos.forEach((el, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      nodos[el] = {
        x: centroX + radio * Math.cos(ang),
        y: centroY + radio * Math.sin(ang),
        etiqueta: el,
      };
    });
    return nodos;
  }
  function dibujarConjunto(ctx, x, y, ancho, alto, nombre, opciones = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y + alto / 2, ancho / 2, alto / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = opciones.fillStyle || "rgba(248, 249, 250, 0.92)";
    ctx.fill();
    ctx.lineWidth = opciones.lineWidth || 2;
    ctx.strokeStyle = opciones.strokeStyle || "#adb5bd";
    ctx.stroke();
    ctx.fillStyle = opciones.textColor || "#000";
    ctx.font = opciones.font || "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(nombre || "", x, y - 15);
    ctx.restore();
  }
  function dibujarNodo(
    ctx,
    nodo,
    radioNodo,
    colorFondo,
    colorBorde,
    opciones = {},
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(nodo.x, nodo.y, radioNodo, 0, Math.PI * 2);
    ctx.fillStyle = colorFondo;
    ctx.fill();
    ctx.lineWidth = opciones.lineWidth || 2;
    ctx.strokeStyle = colorBorde;
    ctx.stroke();
    ctx.fillStyle = opciones.textColor || "#000";
    ctx.font = opciones.font || "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(nodo.etiqueta, nodo.x, nodo.y);
    ctx.restore();
  }
  function dibujarEtiquetaRelacion(ctx, texto, x, y, opciones = {}) {
    if (!texto) return;
    ctx.save();
    ctx.fillStyle = opciones.color || "#212529";
    ctx.font = opciones.font || "italic 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, x, y);
    ctx.restore();
  }
  function dibujarSuspensivos(ctx, x, y, texto = "⋮", opciones = {}) {
    ctx.save();
    ctx.fillStyle = opciones.color || "#6c757d";
    ctx.font = opciones.font || "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texto, x, y);
    ctx.restore();
  }
  function dibujarPuntaFlecha(
    ctx,
    xDesde,
    yDesde,
    xHasta,
    yHasta,
    headlen = 10,
    color = "#495057",
    lineWidth = 2,
  ) {
    const angle = Math.atan2(yHasta - yDesde, xHasta - xDesde);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xHasta, yHasta);
    ctx.lineTo(
      xHasta - headlen * Math.cos(angle - Math.PI / 6),
      yHasta - headlen * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(xHasta, yHasta);
    ctx.lineTo(
      xHasta - headlen * Math.cos(angle + Math.PI / 6),
      yHasta - headlen * Math.sin(angle + Math.PI / 6),
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }
  function dibujarFlechaRecta(ctx, origen, destino, radioNodo, opciones = {}) {
    const headlen = opciones.headlen || 12;
    const lineWidth = opciones.lineWidth || 2;
    const color = opciones.color || "#495057";
    const dashed = !!opciones.dashed;
    const dx = destino.x - origen.x;
    const dy = destino.y - origen.y;
    const angle = Math.atan2(dy, dx);
    const x1 = origen.x + radioNodo * Math.cos(angle);
    const y1 = origen.y + radioNodo * Math.sin(angle);
    const x2 = destino.x - radioNodo * Math.cos(angle);
    const y2 = destino.y - radioNodo * Math.sin(angle);
    ctx.save();
    ctx.beginPath();
    if (dashed) ctx.setLineDash([8, 4]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
    dibujarPuntaFlecha(ctx, x1, y1, x2, y2, headlen, color, lineWidth);
  }
  function dibujarFlechaCurva(ctx, origen, destino, radioNodo, opciones = {}) {
    const color = opciones.color || "#495057";
    const lineWidth = opciones.lineWidth || 2;
    const headlen = opciones.headlen || 10;
    const curvatura = opciones.curvatura || 34;
    const dx = destino.x - origen.x;
    const dy = destino.y - origen.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const mx = (origen.x + destino.x) / 2;
    const my = (origen.y + destino.y) / 2;
    const cx = mx + nx * curvatura;
    const cy = my + ny * curvatura;
    const angInicio = Math.atan2(cy - origen.y, cx - origen.x);
    const angFinal = Math.atan2(destino.y - cy, destino.x - cx);
    const x1 = origen.x + radioNodo * Math.cos(angInicio);
    const y1 = origen.y + radioNodo * Math.sin(angInicio);
    const x2 = destino.x - radioNodo * Math.cos(angFinal);
    const y2 = destino.y - radioNodo * Math.sin(angFinal);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
    dibujarPuntaFlecha(ctx, cx, cy, x2, y2, headlen, color, lineWidth);
  }
  function dibujarLazo(ctx, nodo, radioNodo, opciones = {}) {
    const color = opciones.color || "#495057";
    const lineWidth = opciones.lineWidth || 2;
    const headlen = opciones.headlen || 10;
    const loopR = opciones.loopRadius || radioNodo * 0.9;
    const loopCx = nodo.x + radioNodo * 0.9;
    const loopCy = nodo.y - radioNodo * 1.25;
    const angIni = Math.PI * 0.2;
    const angFin = Math.PI * 1.95;
    ctx.save();
    ctx.beginPath();
    ctx.arc(loopCx, loopCy, loopR, angIni, angFin, true);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
    const xEnd = loopCx + loopR * Math.cos(angIni);
    const yEnd = loopCy + loopR * Math.sin(angIni);
    const xPrev = loopCx + loopR * Math.cos(angIni + 0.22);
    const yPrev = loopCy + loopR * Math.sin(angIni + 0.22);
    dibujarPuntaFlecha(
      ctx,
      xPrev,
      yPrev,
      xEnd,
      yEnd,
      headlen,
      color,
      lineWidth,
    );
  }
  /* ========================= Normalizadores ========================= */ 
  function obtenerElementosSagital(
    config,
  ) {
    const elementosA =
      config.elementosA && config.elementosA.length
        ? limpiarLista(config.elementosA)
        : extraerElementosDesdePares(config.pares, 0);
    const elementosB =
      config.elementosB && config.elementosB.length
        ? limpiarLista(config.elementosB)
        : extraerElementosDesdePares(config.pares, 1);
    return { elementosA, elementosB };
  }
  function obtenerElementosComposicion(config) {
    const elementosA =
      config.elementosA && config.elementosA.length
        ? limpiarLista(config.elementosA)
        : extraerElementosDesdePares(config.paresAB, 0);
    const elementosB =
      config.elementosB && config.elementosB.length
        ? limpiarLista(config.elementosB)
        : limpiarLista([
            ...extraerElementosDesdePares(config.paresAB, 1),
            ...extraerElementosDesdePares(config.paresBC, 0),
          ]);
    const elementosC =
      config.elementosC && config.elementosC.length
        ? limpiarLista(config.elementosC)
        : extraerElementosDesdePares(config.paresBC, 1);
    return { elementosA, elementosB, elementosC };
  }
  function obtenerParesCompuestos(paresAB, paresBC) {
    const resultado = [];
    const vistos = new Set();
    (paresAB || []).forEach(([a, b]) => {
      if (!esValorValido(a) || !esValorValido(b)) return;
      (paresBC || []).forEach(([b2, c]) => {
        if (!esValorValido(b2) || !esValorValido(c)) return;
        if (aTexto(b) === aTexto(b2)) {
          const clave = clavePar(a, c);
          if (!vistos.has(clave)) {
            vistos.add(clave);
            resultado.push([aTexto(a), aTexto(c)]);
          }
        }
      });
    });
    return resultado;
  }
  /* ========================= 1) Diagrama sagital A -> B ========================= */ 
  window.crearDiagramaSagital =
    function (canvasId, config = {}) {
      const data = obtenerCanvasYContexto(canvasId);
      if (!data) return;
      const { canvas, ctx } = data;
      const radioNodo = config.radioNodo || 20;
      const altoConjunto = config.altoConjunto || 300;
      const anchoConjunto = config.anchoConjunto || 140;
      const yTop = config.yTop || 50;
      const centroAx = config.centroAx || 150;
      const centroBx = config.centroBx || 450;
      const suspA = resolverSuspensivosColumna(config, "A");
      const suspB = resolverSuspensivosColumna(config, "B");
      const { elementosA, elementosB } = obtenerElementosSagital(config);
      const nodosA = calcularNodosVerticales(
        elementosA,
        centroAx,
        yTop,
        altoConjunto,
        {
          margenSuperior: suspA.inicio ? 38 : 0,
          margenInferior: suspA.fin ? 38 : 0,
        },
      );
      const nodosB = calcularNodosVerticales(
        elementosB,
        centroBx,
        yTop,
        altoConjunto,
        {
          margenSuperior: suspB.inicio ? 38 : 0,
          margenInferior: suspB.fin ? 38 : 0,
        },
      );
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dibujarConjunto(
        ctx,
        centroAx,
        yTop,
        anchoConjunto,
        altoConjunto,
        config.nombreA || "A",
      );
      dibujarConjunto(
        ctx,
        centroBx,
        yTop,
        anchoConjunto,
        altoConjunto,
        config.nombreB || "B",
      );
      dibujarEtiquetaRelacion(
        ctx,
        config.nombreRelacion || "",
        (centroAx + centroBx) / 2,
        yTop + 25,
      );
      (config.pares || []).forEach((par) => {
        const a = par?.[0];
        const b = par?.[1];
        if (!esValorValido(a) || !esValorValido(b)) return;
        const origen = nodosA[aTexto(a)];
        const destino = nodosB[aTexto(b)];
        if (origen && destino) {
          dibujarFlechaRecta(ctx, origen, destino, radioNodo, {
            color: config.colorFlecha || "#495057",
            lineWidth: config.grosorFlecha || 2,
          });
        }
      });
      Object.values(nodosA).forEach((nodo) =>
        dibujarNodo(ctx, nodo, radioNodo, "#e7f1ff", "#0d6efd"),
      );
      Object.values(nodosB).forEach((nodo) =>
        dibujarNodo(ctx, nodo, radioNodo, "#d1e7dd", "#198754"),
      );
      if (suspA.inicio)
        dibujarSuspensivos(ctx, centroAx, yTop + 24, suspA.textoInicio);
      if (suspA.fin)
        dibujarSuspensivos(
          ctx,
          centroAx,
          yTop + altoConjunto - 24,
          suspA.textoFin,
        );
      if (suspB.inicio)
        dibujarSuspensivos(ctx, centroBx, yTop + 24, suspB.textoInicio);
      if (suspB.fin)
        dibujarSuspensivos(
          ctx,
          centroBx,
          yTop + altoConjunto - 24,
          suspB.textoFin,
        );
    };
  /* ========================= 2) Composición A -> B -> C ========================= */ 
  window.crearDiagramaComposicion =
    function (canvasId, config = {}) {
      const data = obtenerCanvasYContexto(canvasId);
      if (!data) return;
      const { canvas, ctx } = data;
      const radioNodo = config.radioNodo || 18;
      const altoConjunto = config.altoConjunto || 300;
      const anchoConjunto = config.anchoConjunto || 130;
      const yTop = config.yTop || (config.nombreCompuesta ? 70 : 50);
      const centroAx = config.centroAx || 120;
      const centroBx = config.centroBx || 320;
      const centroCx = config.centroCx || 520;
      const suspA = resolverSuspensivosColumna(config, "A");
      const suspB = resolverSuspensivosColumna(config, "B");
      const suspC = resolverSuspensivosColumna(config, "C");
      const { elementosA, elementosB, elementosC } =
        obtenerElementosComposicion(config);
      const nodosA = calcularNodosVerticales(
        elementosA,
        centroAx,
        yTop,
        altoConjunto,
        {
          margenSuperior: suspA.inicio ? 38 : 0,
          margenInferior: suspA.fin ? 38 : 0,
        },
      );
      const nodosB = calcularNodosVerticales(
        elementosB,
        centroBx,
        yTop,
        altoConjunto,
        {
          margenSuperior: suspB.inicio ? 38 : 0,
          margenInferior: suspB.fin ? 38 : 0,
        },
      );
      const nodosC = calcularNodosVerticales(
        elementosC,
        centroCx,
        yTop,
        altoConjunto,
        {
          margenSuperior: suspC.inicio ? 38 : 0,
          margenInferior: suspC.fin ? 38 : 0,
        },
      );
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dibujarConjunto(
        ctx,
        centroAx,
        yTop,
        anchoConjunto,
        altoConjunto,
        config.nombreA || "A",
      );
      dibujarConjunto(
        ctx,
        centroBx,
        yTop,
        anchoConjunto,
        altoConjunto,
        config.nombreB || "B",
      );
      dibujarConjunto(
        ctx,
        centroCx,
        yTop,
        anchoConjunto,
        altoConjunto,
        config.nombreC || "C",
      );
      dibujarEtiquetaRelacion(
        ctx,
        config.nombreRelacionAB || "g",
        (centroAx + centroBx) / 2,
        yTop + 20,
        { font: "italic 15px Arial", color: "#495057" },
      );
      dibujarEtiquetaRelacion(
        ctx,
        config.nombreRelacionBC || "f",
        (centroBx + centroCx) / 2,
        yTop + 20,
        { font: "italic 15px Arial", color: "#495057" },
      );
      if (config.nombreCompuesta) {
        dibujarEtiquetaRelacion(
          ctx,
          config.nombreCompuesta,
          (centroAx + centroCx) / 2,
          config.yTituloCompuesta || 24,
          {
            font: config.fontTituloCompuesta || "bold 24px Arial",
            color: config.colorTituloCompuesta || "#dc3545",
          },
        );
      }
      (config.paresAB || []).forEach((par) => {
        const a = par?.[0];
        const b = par?.[1];
        if (!esValorValido(a) || !esValorValido(b)) return;
        const origen = nodosA[aTexto(a)];
        const destino = nodosB[aTexto(b)];
        if (origen && destino) {
          dibujarFlechaRecta(ctx, origen, destino, radioNodo, {
            color: config.colorFlechaAB || "#495057",
            lineWidth: config.grosorFlechaAB || 2,
          });
        }
      });
      (config.paresBC || []).forEach((par) => {
        const b = par?.[0];
        const c = par?.[1];
        if (!esValorValido(b) || !esValorValido(c)) return;
        const origen = nodosB[aTexto(b)];
        const destino = nodosC[aTexto(c)];
        if (origen && destino) {
          dibujarFlechaRecta(ctx, origen, destino, radioNodo, {
            color: config.colorFlechaBC || "#495057",
            lineWidth: config.grosorFlechaBC || 2,
          });
        }
      });
      if (config.mostrarCompuesta) {
        const paresCompuestos =
          config.paresCompuestos ||
          obtenerParesCompuestos(config.paresAB, config.paresBC);
        paresCompuestos.forEach((par) => {
          const a = par?.[0];
          const c = par?.[1];
          if (!esValorValido(a) || !esValorValido(c)) return;
          const origen = nodosA[aTexto(a)];
          const destino = nodosC[aTexto(c)];
          if (origen && destino) {
            dibujarFlechaRecta(ctx, origen, destino, radioNodo, {
              color: config.colorFlechaCompuesta || "#dc3545",
              lineWidth: config.grosorFlechaCompuesta || 2.3,
              dashed: true,
              headlen: 11,
            });
          }
        });
      }
      Object.values(nodosA).forEach((nodo) =>
        dibujarNodo(ctx, nodo, radioNodo, "#e7f1ff", "#0d6efd"),
      );
      Object.values(nodosB).forEach((nodo) =>
        dibujarNodo(ctx, nodo, radioNodo, "#fff3cd", "#fd7e14"),
      );
      Object.values(nodosC).forEach((nodo) =>
        dibujarNodo(ctx, nodo, radioNodo, "#d1e7dd", "#198754"),
      );
      if (suspA.inicio)
        dibujarSuspensivos(ctx, centroAx, yTop + 24, suspA.textoInicio);
      if (suspA.fin)
        dibujarSuspensivos(
          ctx,
          centroAx,
          yTop + altoConjunto - 24,
          suspA.textoFin,
        );
      if (suspB.inicio)
        dibujarSuspensivos(ctx, centroBx, yTop + 24, suspB.textoInicio);
      if (suspB.fin)
        dibujarSuspensivos(
          ctx,
          centroBx,
          yTop + altoConjunto - 24,
          suspB.textoFin,
        );
      if (suspC.inicio)
        dibujarSuspensivos(ctx, centroCx, yTop + 24, suspC.textoInicio);
      if (suspC.fin)
        dibujarSuspensivos(
          ctx,
          centroCx,
          yTop + altoConjunto - 24,
          suspC.textoFin,
        );
    };
  /* ========================= 3) Auto-sagital A x A ========================= */ 
  window.crearDiagramaAutoSagital =
    function (canvasId, config = {}) {
      const nombre = config.nombreA || config.nombreConjunto || "A";
      const elementos = limpiarLista(config.elementos || []);
      window.crearDiagramaSagital(canvasId, {
        nombreA: nombre,
        nombreB: nombre,
        nombreRelacion: config.nombreRelacion || "R",
        elementosA: elementos,
        elementosB: elementos,
        pares: (config.pares || [])
          .filter((par) => esValorValido(par?.[0]) && esValorValido(par?.[1]))
          .map((par) => [aTexto(par[0]), aTexto(par[1])]),
        radioNodo: config.radioNodo,
        altoConjunto: config.altoConjunto,
        anchoConjunto: config.anchoConjunto,
        yTop: config.yTop,
        centroAx: config.centroAx,
        centroBx: config.centroBx,
        colorFlecha: config.colorFlecha,
        grosorFlecha: config.grosorFlecha,
        mostrarSuspensivosInicioA:
          config.mostrarSuspensivosInicioA ??
          config.mostrarSuspensivosInicio ??
          false,
        mostrarSuspensivosFinA:
          config.mostrarSuspensivosFinA ??
          config.mostrarSuspensivosFin ??
          config.mostrarSuspensivosA ??
          config.mostrarSuspensivos ??
          false,
        mostrarSuspensivosInicioB:
          config.mostrarSuspensivosInicioB ??
          config.mostrarSuspensivosInicio ??
          false,
        mostrarSuspensivosFinB:
          config.mostrarSuspensivosFinB ??
          config.mostrarSuspensivosFin ??
          config.mostrarSuspensivosB ??
          config.mostrarSuspensivos ??
          false,
        textoSuspensivosInicioA:
          config.textoSuspensivosInicioA ||
          config.textoSuspensivosInicio ||
          config.textoSuspensivos ||
          "⋮",
        textoSuspensivosFinA:
          config.textoSuspensivosFinA ||
          config.textoSuspensivosFin ||
          config.textoSuspensivos ||
          "⋮",
        textoSuspensivosInicioB:
          config.textoSuspensivosInicioB ||
          config.textoSuspensivosInicio ||
          config.textoSuspensivos ||
          "⋮",
        textoSuspensivosFinB:
          config.textoSuspensivosFinB ||
          config.textoSuspensivosFin ||
          config.textoSuspensivos ||
          "⋮",
      });
    };
  /* ========================= 4) Grafo de relación sobre A ========================= */ 
  window.crearGrafoRelacion =
    function (canvasId, config = {}) {
      const data = obtenerCanvasYContexto(canvasId);
      if (!data) return;
      const { canvas, ctx } = data;
      const radioNodo = config.radioNodo || 22;
      const centroX = config.centroX || canvas.width / 2;
      const centroY = config.centroY || canvas.height / 2 + 10;
      const radioGrafo =
        config.radioGrafo || Math.min(canvas.width, canvas.height) * 0.3;
      const elementos = [
        ...new Set(
          (config.elementos && config.elementos.length
            ? config.elementos
            : (config.pares || []).flat()
          )
            .filter(esValorValido)
            .map(aTexto),
        ),
      ];
      const pares = (config.pares || [])
        .filter((par) => esValorValido(par?.[0]) && esValorValido(par?.[1]))
        .map((par) => [aTexto(par[0]), aTexto(par[1])]);
      const setPares = construirSetPares(pares);
      const nodos = calcularNodosCirculares(
        elementos,
        centroX,
        centroY,
        radioGrafo,
      );
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (config.nombreRelacion) {
        dibujarEtiquetaRelacion(
          ctx,
          config.nombreRelacion,
          canvas.width / 2,
          24,
          { font: "italic 16px Arial" },
        );
      }
      pares.forEach(([a, b]) => {
        const origen = nodos[a];
        const destino = nodos[b];
        if (!origen || !destino) return;
        if (a === b) {
          dibujarLazo(ctx, origen, radioNodo, {
            color: config.colorFlecha || "#495057",
            lineWidth: config.grosorFlecha || 2,
          });
          return;
        }
        const hayInversa = setPares.has(clavePar(b, a));
        if (hayInversa) {
          const signo = a.localeCompare(b) < 0 ? -1 : 1;
          dibujarFlechaCurva(ctx, origen, destino, radioNodo, {
            color: config.colorFlecha || "#495057",
            lineWidth: config.grosorFlecha || 2,
            curvatura: signo * (config.curvatura || 34),
          });
        } else {
          dibujarFlechaRecta(ctx, origen, destino, radioNodo, {
            color: config.colorFlecha || "#495057",
            lineWidth: config.grosorFlecha || 2,
          });
        }
      });
      Object.values(nodos).forEach((nodo) => {
        dibujarNodo(
          ctx,
          nodo,
          radioNodo,
          config.colorNodo || "#e7f1ff",
          config.colorBordeNodo || "#0d6efd",
        );
      });
    };


 /* ========================= Exportación oficial ========================= */
  const api = Object.freeze({
    crearDiagramaSagital: window.crearDiagramaSagital,
    crearDiagramaComposicion: window.crearDiagramaComposicion,
    crearDiagramaAutoSagital: window.crearDiagramaAutoSagital,
    crearGrafoRelacion: window.crearGrafoRelacion
  });

  window.DiagramasRelaciones = Object.assign(
    {},
    window.DiagramasRelaciones || {},
    api
  );


 // Compatibilidad legacy temporal.
  // Déjalo así por ahora, porque tu HTML o scripts viejos
  // podrían seguir llamando funciones globales.


  const EXPORTAR_GLOBALES_LEGACY = true;

  if (!EXPORTAR_GLOBALES_LEGACY) {
    delete window.crearDiagramaSagital;
    delete window.crearDiagramaComposicion;
    delete window.crearDiagramaAutoSagital;
    delete window.crearGrafoRelacion;
  }

})(window, document);