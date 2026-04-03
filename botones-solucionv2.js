(function (window, document) {
  "use strict";

  let yaInicializado = false;

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

  function sincronizarBotonesExistentes(root = document) {
    root.querySelectorAll(".boton-solucion").forEach(function (boton) {
      const bloque = boton.closest(".ejercicio");
      if (!bloque) return;

      const solucion = bloque.querySelector(".solucion");
      if (!solucion) return;

      actualizarTextoBoton(boton, solucion.hidden);
    });
  }

  function inicializarBotonesSolucion(root = document) {
    if (!yaInicializado) {
      document.addEventListener("click", manejarClick);
      yaInicializado = true;
    }

    sincronizarBotonesExistentes(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      inicializarBotonesSolucion(document);
    });
  } else {
    inicializarBotonesSolucion(document);
  }

  window.BotonesSolucion = {
    inicializar: inicializarBotonesSolucion,
    sincronizar: sincronizarBotonesExistentes,
    alternar: alternarSolucionDesdeBoton
  };
})(window, document);