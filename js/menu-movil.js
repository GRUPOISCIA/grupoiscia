/* Menú móvil y tablet — Grupo ISCIA
   Súbelo a /js/menu-movil.js e inclúyelo en cada página con:
   <script src="/js/menu-movil.js" defer></script>
   No requiere cambiar el HTML del encabezado: crea el botón por sí solo. */
(function () {
  var header = document.querySelector(".site-header");
  var nav = header && header.querySelector(".main-nav");
  if (!header || !nav) return;
  var MQ = window.matchMedia("(max-width: 992px)");
  var inner = header.querySelector(".header-inner") || header;

  // Botón hamburguesa
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mm-toggle";
  btn.setAttribute("aria-label", "Abrir menú");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = "<span></span><span></span><span></span>";
  if (!nav.id) nav.id = "menu-principal";
  btn.setAttribute("aria-controls", nav.id);
  inner.appendChild(btn);

  // WhatsApp dentro del menú (en móvil el botón del encabezado se oculta)
  var wa = header.querySelector(".header-button");
  if (wa) {
    var copia = wa.cloneNode(true);
    copia.className = "mm-wa";
    nav.appendChild(copia);
  }

  // Si el encabezado no es fijo, lo vuelve pegajoso para que no se pierda al bajar
  var pos = getComputedStyle(header).position;
  if (pos === "static" || pos === "relative") header.classList.add("mm-sticky");

  function colores() {
    var m = (getComputedStyle(header).backgroundColor.match(/[\d.]+/g) || []).map(Number);
    var rgb = m.length >= 3 && (m.length < 4 || m[3] > 0.05) ? m.slice(0, 3) : [11, 20, 38];
    var oscuro = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255 < 0.55;
    header.style.setProperty("--mm-bg", "rgb(" + rgb.join(",") + ")");
    header.style.setProperty("--mm-fg", oscuro ? "#ffffff" : "#0b2545");
  }
  function altura() {
    header.style.setProperty("--mm-h", Math.round(header.getBoundingClientRect().bottom) + "px");
  }
  function abrir(v) {
    header.classList.toggle("mm-abierto", v);
    btn.setAttribute("aria-expanded", String(v));
    btn.setAttribute("aria-label", v ? "Cerrar menú" : "Abrir menú");
    document.body.classList.toggle("mm-lock", v);
    if (v) { colores(); altura(); }
    else nav.querySelectorAll(".nav-dropdown.mm-open").forEach(function (d) { d.classList.remove("mm-open"); });
  }

  btn.addEventListener("click", function () { abrir(!header.classList.contains("mm-abierto")); });

  // Fase de captura: toma el control del toque en "Servicios" solo en móvil/tablet
  nav.addEventListener("click", function (e) {
    var t = e.target.closest(".nav-dropdown-toggle");
    if (t && !MQ.matches) { e.preventDefault(); return; }  // en PC el menú abre con el cursor; evita recargar la página
    if (!MQ.matches) return;
    if (t) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var abierto = t.closest(".nav-dropdown").classList.toggle("mm-open");
      t.setAttribute("aria-expanded", String(abierto));
      return;
    }
    if (e.target.closest("a")) abrir(false);
  }, true);

  document.addEventListener("click", function (e) {
    if (header.classList.contains("mm-abierto") && !header.contains(e.target)) abrir(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && header.classList.contains("mm-abierto")) { abrir(false); btn.focus(); }
  });
  function cambio() { if (!MQ.matches) abrir(false); else altura(); }
  window.addEventListener("resize", cambio);
  window.addEventListener("orientationchange", cambio);

  colores();
  altura();
})();
