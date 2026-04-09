(function (window, document) {
  "use strict";

  let yaInicializado = false;

  function actualizarTextoBoton(boton, estaVisible) {
    if (!boton) return;
    boton.textContent = estaVisible ? "Ocultar solución" : "Mostrar solución";
  }

  function obtenerElementosRelacionados(boton) {
    if (!boton) return null;

    const bloque = boton.closest(".ejercicio");
    if (!bloque) return null;

    const solucion = bloque.querySelector(".solucion");
    if (!solucion) return null;

    return { bloque, solucion };
  }

  function alternarSolucionDesdeBoton(boton) {
    const elementos = obtenerElementosRelacionados(boton);
    if (!elementos) return;

    const { solucion } = elementos;

    const estaVisible = !solucion.hidden;
    const nuevaVisibilidad = !estaVisible;

    solucion.hidden = !nuevaVisibilidad;
    actualizarTextoBoton(boton, nuevaVisibilidad);
  }

  function manejarClick(evento) {
    const boton = evento.target.closest(".boton-solucion");
    if (!boton) return;

    alternarSolucionDesdeBoton(boton);
  }

  function sincronizarBotonesExistentes(root = document) {
    root.querySelectorAll(".boton-solucion").forEach(function (boton) {
      const elementos = obtenerElementosRelacionados(boton);
      if (!elementos) return;

      const { solucion } = elementos;
      const estaVisible = !solucion.hidden;

      actualizarTextoBoton(boton, estaVisible);
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
