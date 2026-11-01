/*
 * Carrusel de banners - Grupo ISCIA
 * Las imágenes se leen de /img/banners/ mediante /api/banners/
 * (sin rutas escritas a mano: subir o borrar imágenes en esa carpeta basta).
 */
(function () {
  'use strict';

  var API = '/api/banners/';
  var INTERVALO = 5000;

  var slider, track, prev, next, dots;
  var lista = [];
  var idx = 0;
  var timer = null;
  var construyendo = false;
  var observador = null;

  function $(id) { return document.getElementById(id); }

  /* Reemplaza un nodo por una copia limpia para descartar escuchas antiguos. */
  function limpio(el, profundo) {
    if (!el || !el.parentNode) return el;
    var copia = el.cloneNode(!!profundo);
    el.parentNode.replaceChild(copia, el);
    return copia;
  }

  function precargar(b) {
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = function () { ok(b); };
      im.onerror = function () {
        console.warn('Banner no encontrado:', b.src);
        ok(null);
      };
      im.src = b.src;
    });
  }

  function mostrar(i) {
    var n = lista.length;
    if (!n) return;
    idx = (i % n + n) % n;
    track.style.transition = 'transform .6s ease';
    track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    Array.prototype.forEach.call(dots.children, function (d, k) {
      d.classList.toggle('active', k === idx);
    });
  }

  function parar() { if (timer) { clearInterval(timer); timer = null; } }

  function iniciarAuto() {
    parar();
    if (lista.length < 2) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer = setInterval(function () { mostrar(idx + 1); }, INTERVALO);
  }

  function dibujar() {
    construyendo = true;
    track.innerHTML = '';
    dots.innerHTML = '';

    lista.forEach(function (b, k) {
      var slide = document.createElement('div');
      slide.className = 'promo-slide';
      var img = document.createElement('img');
      img.src = b.src;
      img.alt = b.alt || 'Promoción';
      img.decoding = 'async';
      if (k > 0) img.loading = 'lazy';
      slide.appendChild(img);
      track.appendChild(slide);

      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'promo-dot';
      d.setAttribute('aria-label', 'Banner ' + (k + 1));
      d.addEventListener('click', function () { mostrar(k); iniciarAuto(); });
      dots.appendChild(d);
    });

    var varios = lista.length > 1;
    prev.style.display = next.style.display = dots.style.display = varios ? '' : 'none';

    mostrar(0);
    iniciarAuto();
    setTimeout(function () { construyendo = false; }, 0);
  }

  function enlazar() {
    prev.addEventListener('click', function () { mostrar(idx - 1); iniciarAuto(); });
    next.addEventListener('click', function () { mostrar(idx + 1); iniciarAuto(); });

    slider.addEventListener('mouseenter', parar);
    slider.addEventListener('mouseleave', iniciarAuto);

    var x0 = null;
    slider.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { mostrar(idx + (dx < 0 ? 1 : -1)); iniciarAuto(); }
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) parar(); else iniciarAuto();
    });

    /* Si otro script vuelve a escribir en el carrusel, se restablece. */
    if (window.MutationObserver) {
      var pendiente = null;
      observador = new MutationObserver(function () {
        if (construyendo || !lista.length) return;
        clearTimeout(pendiente);
        pendiente = setTimeout(dibujar, 50);
      });
      observador.observe(track, { childList: true });
    }
  }

  function iniciar() {
    slider = $('promoSlider');
    if (!slider) return;

    parar();
    track = limpio($('promoTrack'), false);
    prev = limpio($('promoPrev'), true);
    next = limpio($('promoNext'), true);
    dots = limpio($('promoDots'), false);
    if (!track || !prev || !next || !dots) return;

    fetch(API, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        var b = Array.isArray(d.banners) ? d.banners : [];
        if (!d.ok) console.warn('No se encontró la carpeta /img/banners en el servidor.');
        return Promise.all(b.map(precargar));
      })
      .then(function (r) {
        lista = r.filter(Boolean);
        var seccion = $('promociones');
        if (!lista.length) {
          if (seccion) seccion.style.display = 'none';
          return;
        }
        if (seccion) seccion.style.display = '';
        enlazar();
        dibujar();
      })
      .catch(function (e) {
        console.warn('No se pudieron cargar los banners:', e);
      });
  }

  /* Se ejecuta cuando app.js ya terminó su propia inicialización. */
  if (document.readyState === 'complete') iniciar();
  else window.addEventListener('load', iniciar);
})();
