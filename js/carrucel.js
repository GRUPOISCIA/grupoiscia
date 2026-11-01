document.addEventListener("DOMContentLoaded", () => {

    const carousel = document.querySelector(".hosting-carousel");

    if (!carousel) return;


    /* =====================================================
       ELEMENTOS
    ===================================================== */

    const viewport = carousel.querySelector(
        ".hosting-carousel__viewport"
    );

    const track = carousel.querySelector(
        ".hosting-carousel__track"
    );

    const cards = Array.from(
        carousel.querySelectorAll(".hosting-card")
    );

    const prevButton = carousel.querySelector(
        ".hosting-carousel__btn--prev"
    );

    const nextButton = carousel.querySelector(
        ".hosting-carousel__btn--next"
    );

    const dotsContainer = document.querySelector(
        ".hosting-carousel__dots"
    );


    if (!viewport || !track || !cards.length) {
        return;
    }


    /* =====================================================
       CONFIGURACIÓN
    ===================================================== */

    const AUTO_PLAY_TIME = 5000;

    let currentIndex = 0;
    let autoPlay = null;
    let isPaused = false;


    /* =====================================================
       OBTENER ESPACIO DE UNA TARJETA
    ===================================================== */

    function getCardWidth() {

        if (!cards[0]) {
            return 0;
        }

        const cardWidth = cards[0].offsetWidth;

        const trackStyle = window.getComputedStyle(track);

        const gap = parseFloat(trackStyle.columnGap) || 0;

        return cardWidth + gap;
    }


    /* =====================================================
       CANTIDAD DE TARJETAS VISIBLES
    ===================================================== */

    function getVisibleCards() {

        const viewportWidth = viewport.offsetWidth;

        const cardWidth = cards[0].offsetWidth;

        const trackStyle = window.getComputedStyle(track);

        const gap = parseFloat(trackStyle.columnGap) || 0;

        if (!cardWidth) {
            return 1;
        }

        return Math.max(
            1,
            Math.floor(
                (viewportWidth + gap) /
                (cardWidth + gap)
            )
        );
    }


    /* =====================================================
       MAXIMO INDICE
    ===================================================== */

    function getMaxIndex() {

        const visibleCards = getVisibleCards();

        return Math.max(
            0,
            cards.length - visibleCards
        );
    }


    /* =====================================================
       CREAR INDICADORES
    ===================================================== */

    function createDots() {

        if (!dotsContainer) {
            return;
        }

        dotsContainer.innerHTML = "";

        const totalSlides = getMaxIndex() + 1;

        for (let i = 0; i < totalSlides; i++) {

            const dot = document.createElement("button");

            dot.type = "button";

            dot.className =
                "hosting-carousel__dot";

            dot.setAttribute(
                "aria-label",
                `Ir al grupo ${i + 1}`
            );

            dot.addEventListener(
                "click",
                () => {

                    currentIndex = i;

                    updateCarousel();

                    restartAutoPlay();

                }
            );

            dotsContainer.appendChild(dot);
        }

        updateDots();
    }


    /* =====================================================
       ACTUALIZAR INDICADORES
    ===================================================== */

    function updateDots() {

        if (!dotsContainer) {
            return;
        }

        const dots = dotsContainer.querySelectorAll(
            ".hosting-carousel__dot"
        );

        dots.forEach((dot, index) => {

            dot.classList.toggle(
                "active",
                index === currentIndex
            );

        });
    }


    /* =====================================================
       MOVER CARRUSEL
    ===================================================== */

    function updateCarousel() {

        const maxIndex = getMaxIndex();

        if (currentIndex > maxIndex) {
            currentIndex = 0;
        }

        if (currentIndex < 0) {
            currentIndex = maxIndex;
        }

        const distance =
            currentIndex * getCardWidth();

        track.style.transform =
            `translate3d(-${distance}px, 0, 0)`;

        updateDots();
    }


    /* =====================================================
       SIGUIENTE
    ===================================================== */

    function nextSlide() {

        const maxIndex = getMaxIndex();

        currentIndex++;

        if (currentIndex > maxIndex) {
            currentIndex = 0;
        }

        updateCarousel();
    }


    /* =====================================================
       ANTERIOR
    ===================================================== */

    function previousSlide() {

        const maxIndex = getMaxIndex();

        currentIndex--;

        if (currentIndex < 0) {
            currentIndex = maxIndex;
        }

        updateCarousel();
    }


    /* =====================================================
       AUTOPLAY
    ===================================================== */

    function startAutoPlay() {

        stopAutoPlay();

        autoPlay = setInterval(() => {

            if (!isPaused) {
                nextSlide();
            }

        }, AUTO_PLAY_TIME);
    }


    /* =====================================================
       DETENER AUTOPLAY
    ===================================================== */

    function stopAutoPlay() {

        if (autoPlay) {

            clearInterval(autoPlay);

            autoPlay = null;
        }
    }


    /* =====================================================
       REINICIAR AUTOPLAY
    ===================================================== */

    function restartAutoPlay() {

        stopAutoPlay();

        startAutoPlay();
    }


    /* =====================================================
       PAUSAR CON EL CURSOR
    ===================================================== */

    carousel.addEventListener(
        "mouseenter",
        () => {

            isPaused = true;

            stopAutoPlay();
        }
    );


    /* =====================================================
       CONTINUAR AL RETIRAR CURSOR
    ===================================================== */

    carousel.addEventListener(
        "mouseleave",
        () => {

            isPaused = false;

            startAutoPlay();
        }
    );


    /* =====================================================
       BOTON SIGUIENTE
    ===================================================== */

    if (nextButton) {

        nextButton.addEventListener(
            "click",
            () => {

                nextSlide();

                restartAutoPlay();

            }
        );
    }


    /* =====================================================
       BOTON ANTERIOR
    ===================================================== */

    if (prevButton) {

        prevButton.addEventListener(
            "click",
            () => {

                previousSlide();

                restartAutoPlay();

            }
        );
    }


    /* =====================================================
       REDIMENSIONAMIENTO
    ===================================================== */

    let resizeTimer;

    window.addEventListener(
        "resize",
        () => {

            clearTimeout(resizeTimer);

            resizeTimer = setTimeout(() => {

                currentIndex = Math.min(
                    currentIndex,
                    getMaxIndex()
                );

                createDots();

                updateCarousel();

            }, 150);
        }
    );


    /* =====================================================
       INICIALIZAR
    ===================================================== */

    createDots();

    updateCarousel();

    startAutoPlay();

});