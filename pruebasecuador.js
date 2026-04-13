(function (window, document) {
  "use strict";

  function textoSeguro(valor, fallback = "") {
    return (valor ?? "").toString().trim() || fallback;
  }

  function numeroSeguro(valor, fallback = 0) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : fallback;
  }

  function contarPreguntasDesde(contenedor) {
    const raiz = contenedor.closest(".evaluacion-completa") || document;
    return raiz.querySelectorAll(".bloque-pregunta").length;
  }

  function calcularPuntosAprobar(puntajeMaximo, porcentajeAprobacion) {
    return Math.ceil((puntajeMaximo * porcentajeAprobacion) / 100);
  }

  function construirTabla(config, totalPreguntas) {
    const puntajeMaximo = totalPreguntas * config.puntosPorPregunta;
    const puntosAprobar = calcularPuntosAprobar(
      puntajeMaximo,
      config.porcentajeAprobacion
    );

    return `
      <table class="${config.claseTabla}" style="border-collapse:collapse; width:${config.anchoTabla}; height:${config.altoTabla};" border="0" cellspacing="0" cellpadding="0">
        <colgroup>
          <col style="width:16.2%;">
          <col style="width:22.8%;">
          <col style="width:17.2%;">
          <col style="width:21.9%;">
          <col style="width:21.9%;">
        </colgroup>
        <tbody>
          <tr>
            <td bgcolor="${config.colorEncabezado}">Profesor(a/as/es):</td>
            <td>${config.profesor}</td>
            <td bgcolor="${config.colorEncabezado}" colspan="3">Datos estudiante(s).</td>
          </tr>

          <tr>
            <td bgcolor="${config.colorEncabezado}">Asignatura:</td>
            <td>${config.asignatura}</td>
            <td bgcolor="${config.colorEncabezado}">Nombre(s):</td>
            <td colspan="2">&nbsp;</td>
          </tr>

          <tr>
            <td bgcolor="${config.colorEncabezado}">Curso y nivel:</td>
            <td>${config.cursoNivel}</td>
            <td bgcolor="${config.colorEncabezado}">N° Lista:</td>
            <td bgcolor="${config.colorEncabezado}">Curso y letra.</td>
            <td bgcolor="${config.colorEncabezado}">Fecha de aplicación.</td>
          </tr>

          <tr>
            <td bgcolor="${config.colorEncabezado}">Tipo evaluación:</td>
            <td>${config.tipoEvaluacion}</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>

          <tr>
            <td bgcolor="${config.colorEncabezado}">Unidad</td>
            <td>${config.unidad}</td>
            <td bgcolor="${config.colorEncabezado}">Datos evaluación.</td>
            <td bgcolor="${config.colorEncabezado}">Puntaje Obtenido.</td>
            <td bgcolor="${config.colorEncabezado}">Calificación.</td>
          </tr>

          <tr>
            <td bgcolor="${config.colorEncabezado}">Instrumento</td>
            <td>${config.instrumento}</td>
            <td bgcolor="${config.colorEncabezado}">&nbsp;</td>
            <td>&nbsp;</td>
            <td rowspan="3">&nbsp;</td>
          </tr>

          <tr>
            <td bgcolor="${config.colorEncabezado}">code/version</td>
            <td>${config.codeVersion}</td>
            <td bgcolor="${config.colorEncabezado}">Puntaje máximo:</td>
            <td>${puntajeMaximo} puntos.</td>
          </tr>

          <tr>
            <td bgcolor="${config.colorEncabezado}">Tiempo a rendir:</td>
            <td>${config.tiempo}</td>
            <td bgcolor="${config.colorEncabezado}">Puntos aprobación:</td>
            <td>${puntosAprobar} puntos.</td>
          </tr>

          <tr>
            <td bgcolor="${config.colorEncabezado}">N°(s) Obj Plan Estudio</td>
            <td colspan="4">${config.objPlan}</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  function leerConfiguracion(el) {
    return {
      establecimiento: textoSeguro(el.dataset.establecimiento, "Liceo República del Ecuador"),
      profesor: textoSeguro(el.dataset.profesor, "Oscar Arauco"),
      asignatura: textoSeguro(el.dataset.asignatura, "Matemática"),
      cursoNivel: textoSeguro(el.dataset.cursoNivel, ""),
      tipoEvaluacion: textoSeguro(el.dataset.tipoEvaluacion, "Prueba selección múltiple"),
      unidad: textoSeguro(el.dataset.unidad, ""),
      instrumento: textoSeguro(el.dataset.instrumento, ""),
      codeVersion: textoSeguro(el.dataset.codeVersion, ""),
      tiempo: textoSeguro(el.dataset.tiempo, ""),
      objPlan: textoSeguro(el.dataset.objPlan, "OAs"),
      puntosPorPregunta: numeroSeguro(el.dataset.puntosPorPregunta, 1),
      porcentajeAprobacion: numeroSeguro(el.dataset.porcentajeAprobacion, 60),
      anchoTabla: textoSeguro(el.dataset.anchoTabla, "100%"),
      altoTabla: textoSeguro(el.dataset.altoTabla, "auto"),
      claseTabla: textoSeguro(el.dataset.claseTabla, "tfacil tabla-portada-evaluacion"),
      colorEncabezado: textoSeguro(el.dataset.colorEncabezado, "#f5ccb6")
    };
  }

  function renderizarPortada(el) {
    if (!el || el.dataset.portadaRenderizada === "true") return;

    const config = leerConfiguracion(el);
    const totalPreguntas = contarPreguntasDesde(el);

    el.innerHTML = construirTabla(config, totalPreguntas);
    el.dataset.portadaRenderizada = "true";
  }

  function inicializarPortadas(root = document) {
    root.querySelectorAll(".portada-evaluacion").forEach(renderizarPortada);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      inicializarPortadas(document);
    });
  } else {
    inicializarPortadas(document);
  }

  window.inicializarPortadasEvaluacion = inicializarPortadas;

})(window, document);
