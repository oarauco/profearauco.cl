(function (window, document) {
  "use strict";

  function actualizarTextoBoton(boton, mostrar) {
    boton.textContent = mostrar ? "Ocultar solución" : "Mostrar solución";
  }

  function alternarSolucionDesdeBoton(boton) {
    if (!boton) return;

    const bloque = boton.closest(".ejercicio");
    if (!bloque) return;

    const solucion = bloque.querySelector(".solucion");
    if (!solucion) return;

    const mostrar = solucion.hidden;
    solucion.hidden = !mostrar;

    actualizarTextoBoton(boton, mostrar);
  }

  function manejarClick(evento) {
    const boton = evento.target.closest(".boton-solucion");
    if (!boton) return;

    alternarSolucionDesdeBoton(boton);
  }

  function sincronizarBotonesExistentes() {
    document.querySelectorAll(".boton-solucion").forEach(function (boton) {
      const bloque = boton.closest(".ejercicio");
      if (!bloque) return;

      const solucion = bloque.querySelector(".solucion");
      if (!solucion) return;

      actualizarTextoBoton(boton, solucion.hidden);
    });
  }

  function inicializarBotonesSolucion() {
    document.addEventListener("click", manejarClick);
    sincronizarBotonesExistentes();
  }

  document.addEventListener("DOMContentLoaded", inicializarBotonesSolucion);

  window.BotonesSolucion = {
    inicializar: inicializarBotonesSolucion,
    sincronizar: sincronizarBotonesExistentes,
    alternar: alternarSolucionDesdeBoton
  };

})(window, document);
