document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const topButton = document.getElementById("top");

  /* ==================== MENÚ MÓVIL ==================== */
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.innerHTML = isOpen
        ? '<i class="fa fa-times"></i>'
        : '<i class="fa fa-bars"></i>';
    });

    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.innerHTML = '<i class="fa fa-bars"></i>';
      });
    });
  }

  /* ==================== BOTÓN SUBIR ==================== */
  const updateTopButton = () => {
    if (!topButton) return;
    topButton.classList.toggle("show", window.scrollY > 450);
  };

  window.addEventListener("scroll", updateTopButton, { passive: true });
  updateTopButton();

  if (topButton) {
    topButton.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  }

  /* ==================== ANIMACIONES AL HACER SCROLL ==================== */
  const animatedElements = document.querySelectorAll(
    ".history-content, .history-highlight, .purpose-card, " +
    ".mission-card, .value-card, .area-item, .about-hero-card"
  );

  animatedElements.forEach((element) => {
    element.classList.add("reveal");
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px"
      }
    );

    animatedElements.forEach((element) => observer.observe(element));
  } else {
    animatedElements.forEach((element) => {
      element.classList.add("visible");
    });
  }

  /* ==================== DESPLAZAMIENTO A SECCIONES ==================== */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");

      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);

      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
});
