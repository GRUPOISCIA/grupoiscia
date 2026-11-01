(() => {
  const form = document.getElementById("contactForm");
  const submitButton = document.getElementById("contactSubmit");
  const captchaError = document.getElementById("captchaError");
  const formStatus = document.getElementById("formStatus");

  if (!form || !submitButton || !captchaError) {
    return;
  }

  const statusMessages = {
    ok: "Tu mensaje se envió correctamente.",
    error: "No se pudo procesar el formulario. Inténtalo de nuevo.",
    datos: "Revisa que todos los campos estén completos y sean válidos.",
    correo: "El correo electrónico no tiene un formato válido.",
    telefono: "El teléfono no tiene un formato válido.",
    recaptcha_config:
      "El formulario aún no está configurado en el servidor. Contacta al administrador del sitio.",
    recaptcha:
      "No se pudo validar reCAPTCHA. Vuelve a confirmarlo e intenta de nuevo.",
    mail: "El formulario fue validado, pero no se pudo enviar el correo. Contacta al administrador.",
  };
  const status = new URLSearchParams(window.location.search).get("estado");
  if (
    formStatus &&
    status &&
    Object.prototype.hasOwnProperty.call(statusMessages, status)
  ) {
    formStatus.textContent = statusMessages[status];
    formStatus.classList.add(status === "ok" ? "is-success" : "is-error");
  }

  let captchaVerified = false;

  const updateSubmitState = () => {
    const phone = form.elements.namedItem("telefono");
    if (phone instanceof HTMLInputElement) {
      phone.setCustomValidity("");
      const value = phone.value.trim();
      if (value && !/^\+?[0-9\s().-]{10,20}$/.test(value)) {
        phone.setCustomValidity("Ingresa un teléfono válido.");
      }
    }

    for (const field of form.querySelectorAll(
      "input[required], select[required], textarea[required]",
    )) {
      if (field.value.trim() === "") {
        field.setCustomValidity("Completa este campo.");
      } else if (field !== phone) {
        field.setCustomValidity("");
      }
    }

    submitButton.disabled = !form.checkValidity() || !captchaVerified;
  };

  form.addEventListener("input", updateSubmitState);
  form.addEventListener("change", updateSubmitState);
  form.addEventListener("submit", (event) => {
    updateSubmitState();

    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
      return;
    }

    if (!captchaVerified) {
      event.preventDefault();
      captchaError.textContent = "Confirma que no eres un robot.";
      return;
    }

    submitButton.disabled = true;
    const label = submitButton.querySelector("span");
    if (label) {
      label.textContent = "Enviando...";
    }
  });

  window.recaptchaValido = (token) => {
    captchaVerified = Boolean(token);
    captchaError.textContent = "";
    updateSubmitState();
  };

  window.recaptchaExpirado = () => {
    captchaVerified = false;
    captchaError.textContent = "La confirmación expiró. Vuelve a completarla.";
    updateSubmitState();
  };

  window.recaptchaError = () => {
    captchaVerified = false;
    captchaError.textContent =
      "No se pudo cargar reCAPTCHA. Recarga la página e inténtalo de nuevo.";
    updateSubmitState();
  };

  updateSubmitState();
})();
