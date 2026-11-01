document.addEventListener("DOMContentLoaded", function () {

    const contadores = document.querySelectorAll(".contador");

    const observer = new IntersectionObserver((entries, observer) => {

        entries.forEach(entry => {

            if (!entry.isIntersecting) {
                return;
            }

            const contador = entry.target;
            const objetivo = parseInt(contador.dataset.target);

            let numeroActual = 0;

            const duracion = 1800;
            const incremento = objetivo / (duracion / 16);

            function actualizarContador() {

                numeroActual += incremento;

                if (numeroActual >= objetivo) {
                    contador.textContent = objetivo;
                    return;
                }

                contador.textContent = Math.floor(numeroActual);

                requestAnimationFrame(actualizarContador);
            }

            actualizarContador();

            observer.unobserve(contador);
        });

    }, {
        threshold: 0.5
    });


    contadores.forEach(contador => {
        observer.observe(contador);
    });

});

// =========================================
// BOTÓN VOLVER ARRIBA
// =========================================

document.addEventListener("DOMContentLoaded", function () {

  const scrollTopButton = document.getElementById("scrollTop");

  if (!scrollTopButton) return;

  let ultimaPosicion = window.scrollY;

  window.addEventListener("scroll", function () {

    const posicionActual = window.scrollY;

    if (
      posicionActual > ultimaPosicion &&
      posicionActual > 300
    ) {
      scrollTopButton.classList.add("show");
    }

    if (posicionActual < ultimaPosicion) {
      scrollTopButton.classList.remove("show");
    }

    ultimaPosicion = posicionActual;
  });

  scrollTopButton.addEventListener("click", function () {

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  });

});

document.addEventListener("DOMContentLoaded", function() {
	const carrusel = document.getElementById("carrusel");
	const track = document.getElementById("carruselTrack");
	const btnNext = document.getElementById("btnNext");
	const btnPrev = document.getElementById("btnPrev");
	const indicadores = document.getElementById("indicadores"); /* ===================================================== CONFIGURACIÓN ====================================================== */
	const productos = Array.from(track.querySelectorAll(".producto"));
	const totalProductos = productos.length;
	let posicion = 0;
	let intervalo;
	let cantidadVisible = obtenerCantidadVisible();
	let anchoProducto = 0; /* ===================================================== DETERMINAR CUÁNTOS PRODUCTOS SE MUESTRAN ====================================================== */
	function obtenerCantidadVisible() {
		const ancho = window.innerWidth;
		if (ancho <= 500) {
			return 1;
		}
		if (ancho <= 750) {
			return 2;
		}
		if (ancho <= 1000) {
			return 3;
		}
		return 4;
	} /* ===================================================== CALCULAR ANCHO ====================================================== */
	function calcularAncho() {
		cantidadVisible = obtenerCantidadVisible();
		const estilos = window.getComputedStyle(track);
		const gap = parseFloat(estilos.gap) || 0;
		anchoProducto = productos[0].getBoundingClientRect().width + gap;
	} /* ===================================================== MOVER CARRUSEL ====================================================== */
	function moverCarrusel() {
		calcularAncho();
		track.style.transform = `translateX(-${posicion * anchoProducto}px)`;
		actualizarIndicadores();
	} /* ===================================================== SIGUIENTE ====================================================== */
	function siguiente() {
		posicion++; /* * Cuando llegamos a la posición donde ya no * caben los productos, regresamos al inicio. */
		const maximo = totalProductos - cantidadVisible;
		if (posicion > maximo) { /* * Primero quitamos la transición. */
			track.style.transition = "none";
			posicion = 0;
			track.style.transform = "translateX(0)"; /* * Forzamos al navegador a actualizar * el cambio antes de activar nuevamente * la animación. */
			track.offsetHeight;
			track.style.transition = "transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)";
			actualizarIndicadores();
			return;
		}
		moverCarrusel();
	} /* ===================================================== ANTERIOR ====================================================== */
	function anterior() {
		if (posicion <= 0) { /* * Vamos al final. */
			posicion = totalProductos - cantidadVisible;
			track.style.transition = "none";
			track.style.transform = `translateX(-${posicion * anchoProducto}px)`;
			track.offsetHeight;
			track.style.transition = "transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)";
			actualizarIndicadores();
			return;
		}
		posicion--;
		moverCarrusel();
	} /* ===================================================== AUTO PLAY ====================================================== */
	function iniciarAutoPlay() {
		detenerAutoPlay();
		intervalo = setInterval(siguiente, 3000);
	}

	function detenerAutoPlay() {
		if (intervalo) {
			clearInterval(intervalo);
		}
	} /* ===================================================== INDICADORES ====================================================== */
	function crearIndicadores() {
		indicadores.innerHTML = "";
		const cantidadPaginas = totalProductos - cantidadVisible + 1;
		for (let i = 0; i < cantidadPaginas; i++) {
			const indicador = document.createElement("button");
			indicador.className = "indicador";
			indicador.setAttribute("aria-label", `Ir al producto ${i + 1}`);
			indicador.addEventListener("click", function() {
				posicion = i;
				moverCarrusel();
				iniciarAutoPlay();
			});
			indicadores.appendChild(indicador);
		}
		actualizarIndicadores();
	}

	function actualizarIndicadores() {
		const elementos = indicadores.querySelectorAll(".indicador");
		elementos.forEach(function(elemento, indice) {
			elemento.classList.toggle("activo", indice === posicion);
		});
	} /* ===================================================== EVENTOS ====================================================== */
	btnNext.addEventListener("click", function() {
		siguiente();
		iniciarAutoPlay();
	});
	btnPrev.addEventListener("click", function() {
		anterior();
		iniciarAutoPlay();
	}); /* * Pausar cuando el usuario coloca el mouse * sobre el carrusel. */
	carrusel.addEventListener("mouseenter", detenerAutoPlay);
	carrusel.addEventListener("mouseleave", iniciarAutoPlay); /* ===================================================== SOPORTE PARA TECLADO ====================================================== */
	document.addEventListener("keydown", function(evento) {
		if (evento.key === "ArrowRight") {
			siguiente();
			iniciarAutoPlay();
		}
		if (evento.key === "ArrowLeft") {
			anterior();
			iniciarAutoPlay();
		}
	}); /* ===================================================== RESPONSIVE ====================================================== */
	window.addEventListener("resize", function() {
		calcularAncho();
		crearIndicadores();
		moverCarrusel();
	}); /* ===================================================== INICIALIZAR ====================================================== */
	calcularAncho();
	crearIndicadores();
	moverCarrusel();
	iniciarAutoPlay();
});

carrusel.addEventListener("mouseenter", () => {
    detenerMovimiento();
});

carrusel.addEventListener("mouseleave", () => {
    iniciarMovimiento();
});

document.addEventListener("DOMContentLoaded", () => {

    const banner = document.getElementById("cookieBanner");
    const modal = document.getElementById("cookieModal");

    const accept = document.getElementById("cookieAccept");
    const reject = document.getElementById("cookieReject");
    const config = document.getElementById("cookieConfig");

    const save = document.getElementById("cookieSave");
    const acceptAll = document.getElementById("cookieAcceptAll");

    const close = document.getElementById("cookieClose");
    const overlay = document.getElementById("cookieModalOverlay");

    const analyticsCheckbox =
        document.getElementById("cookieAnalytics");

    const metaCheckbox =
        document.getElementById("cookieMeta");


    /*
     * =====================================================
     * CONFIGURACIÓN
     * =====================================================
     */

    const CONFIG = {

        // Reemplaza por tu ID de Google Analytics
        googleAnalyticsId: "G-XXXXXXXXXX",

        // Reemplaza por tu ID de Meta Pixel
        metaPixelId: "XXXXXXXXXXXXXXX"

    };


    /*
     * =====================================================
     * STORAGE
     * =====================================================
     */

    const STORAGE_KEY = "computec_cookie_consent";


    /*
     * =====================================================
     * OBTENER CONSENTIMIENTO
     * =====================================================
     */

    function getConsent() {

        try {

            return JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            );

        } catch (error) {

            return null;

        }

    }


    /*
     * =====================================================
     * GUARDAR CONSENTIMIENTO
     * =====================================================
     */

    function saveConsent(preferences) {

        const consent = {

            necessary: true,

            analytics: Boolean(preferences.analytics),

            marketing: Boolean(preferences.marketing),

            date: new Date().toISOString()

        };


        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(consent)
        );


        loadServices(consent);


        hideBanner();

        hideModal();

    }


    /*
     * =====================================================
     * OCULTAR BANNER
     * =====================================================
     */

    function hideBanner() {

        banner.classList.remove(
            "cookie-banner--visible"
        );

    }


    /*
     * =====================================================
     * MOSTRAR BANNER
     * =====================================================
     */

    function showBanner() {

        banner.classList.add(
            "cookie-banner--visible"
        );

    }


    /*
     * =====================================================
     * MODAL
     * =====================================================
     */

    function showModal() {

        modal.classList.add(
            "cookie-modal--visible"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "cookie-modal-open"
        );

    }


    function hideModal() {

        modal.classList.remove(
            "cookie-modal--visible"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "cookie-modal-open"
        );

    }


    /*
     * =====================================================
     * GOOGLE ANALYTICS
     * =====================================================
     */

    function loadGoogleAnalytics() {

        if (
            !CONFIG.googleAnalyticsId ||
            CONFIG.googleAnalyticsId === "G-EEKPZDZRZG"
        ) {

            console.warn(
                "Google Analytics: falta configurar el ID."
            );

            return;

        }


        if (
            document.querySelector(
                'script[data-cookie-service="google-analytics"]'
            )
        ) {

            return;

        }


        const script = document.createElement("script");

        script.async = true;

        script.src =
            "https://www.googletagmanager.com/gtag/js?id=" +
            encodeURIComponent(
                CONFIG.googleAnalyticsId
            );

        script.dataset.cookieService =
            "google-analytics";


        document.head.appendChild(script);


        window.dataLayer =
            window.dataLayer || [];


        function gtag() {

            window.dataLayer.push(arguments);

        }


        window.gtag = gtag;


        gtag(
            "js",
            new Date()
        );


        gtag(
            "config",
            CONFIG.googleAnalyticsId
        );

    }


    /*
     * =====================================================
     * META PIXEL
     * =====================================================
     */

    function loadMetaPixel() {

        if (
            !CONFIG.metaPixelId ||
            CONFIG.metaPixelId === "1356974562922460"
        ) {

            console.warn(
                "Meta Pixel: falta configurar el ID."
            );

            return;

        }


        if (
            window.fbq &&
            document.querySelector(
                'script[data-cookie-service="meta-pixel"]'
            )
        ) {

            return;

        }


        !function(f,b,e,v,n,t,s) {

            if(f.fbq)return;

            n=f.fbq=function(){

                n.callMethod ?
                    n.callMethod.apply(n,arguments) :
                    n.queue.push(arguments);

            };


            if(!f._fbq)f._fbq=n;

            n.push=n;

            n.loaded=true;

            n.version="2.0";

            n.queue=[];


            t=b.createElement(e);

            t.async=true;

            t.src=v;

            t.dataset.cookieService =
                "meta-pixel";


            s=b.getElementsByTagName(e)[0];

            s.parentNode.insertBefore(
                t,
                s
            );

        }(
            window,
            document,
            "script",
            "https://connect.facebook.net/en_US/fbevents.js"
        );


        fbq(
            "init",
            CONFIG.metaPixelId
        );


        fbq(
            "track",
            "PageView"
        );

    }


    /*
     * =====================================================
     * CARGAR SERVICIOS
     * =====================================================
     */

    function loadServices(consent) {

        if (!consent) {
            return;
        }


        if (consent.analytics) {

            loadGoogleAnalytics();

        }


        if (consent.marketing) {

            loadMetaPixel();

        }

    }


    /*
     * =====================================================
     * ACEPTAR TODO
     * =====================================================
     */

    accept.addEventListener(
        "click",
        () => {

            saveConsent({

                analytics: true,

                marketing: true

            });

        }
    );


    /*
     * =====================================================
     * RECHAZAR
     * =====================================================
     */

    reject.addEventListener(
        "click",
        () => {

            saveConsent({

                analytics: false,

                marketing: false

            });

        }
    );


    /*
     * =====================================================
     * CONFIGURAR
     * =====================================================
     */

    config.addEventListener(
        "click",
        () => {

            showModal();

        }
    );


    /*
     * =====================================================
     * GUARDAR PREFERENCIAS
     * =====================================================
     */

    save.addEventListener(
        "click",
        () => {

            saveConsent({

                analytics:
                    analyticsCheckbox.checked,

                marketing:
                    metaCheckbox.checked

            });

        }
    );


    /*
     * =====================================================
     * ACEPTAR TODAS DESDE MODAL
     * =====================================================
     */

    acceptAll.addEventListener(
        "click",
        () => {

            analyticsCheckbox.checked = true;

            metaCheckbox.checked = true;


            saveConsent({

                analytics: true,

                marketing: true

            });

        }
    );


    /*
     * =====================================================
     * CERRAR MODAL
     * =====================================================
     */

    close.addEventListener(
        "click",
        hideModal
    );


    overlay.addEventListener(
        "click",
        hideModal
    );


    /*
     * =====================================================
     * INICIALIZAR
     * =====================================================
     */

    const existingConsent = getConsent();


    if (existingConsent) {

        analyticsCheckbox.checked =
            Boolean(existingConsent.analytics);

        metaCheckbox.checked =
            Boolean(existingConsent.marketing);


        loadServices(existingConsent);

    } else {

        setTimeout(() => {

            showBanner();

        }, 500);

    }

});