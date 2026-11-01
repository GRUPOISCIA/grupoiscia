(function () {
  'use strict';

  /*
   * DETALLE DE PRODUCTO
   * Compatible con el catálogo actual de la tienda:
   * #productsGrid y #soldOutGrid.
   *
   * No reemplaza el carrito ni el sistema de catálogo existente.
   * Únicamente añade la interacción de abrir el detalle al hacer clic.
   */

  var productos = [];
  var productoActual = null;
  var cantidad = 1;

  function $(id) {
    return document.getElementById(id);
  }

  function normalizar(valor) {
    return String(valor == null ? '' : valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function dinero(valor) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(Number(valor) || 0);
  }

  function texto(valor) {
    return String(valor == null ? '' : valor).trim();
  }

  function cargarCatalogoParaDetalle() {
    return fetch('/api/pedidos/?a=catalogo&_detalle=1', {
      cache: 'no-store',
      credentials: 'same-origin'
    })
    .then(function (respuesta) {
      if (!respuesta.ok) throw new Error('No se pudo obtener el catálogo');
      return respuesta.json();
    })
    .then(function (datos) {
      productos = Array.isArray(datos.productos) ? datos.productos : [];
      return productos;
    })
    .catch(function (error) {
      console.warn('Detalle de producto: no fue posible cargar el catálogo.', error);
      return [];
    });
  }

  function encontrarProductoEnTarjeta(tarjeta) {
    if (!tarjeta) return null;

    /* 1. Si la tarjeta ya contiene un id o sku, lo usamos. */
    var posibles = [
      tarjeta.getAttribute('data-product-id'),
      tarjeta.getAttribute('data-id'),
      tarjeta.getAttribute('data-producto-id'),
      tarjeta.getAttribute('data-sku')
    ].filter(Boolean);

    for (var i = 0; i < posibles.length; i++) {
      var valor = normalizar(posibles[i]);
      var porId = productos.find(function (p) {
        return normalizar(p.id) === valor || normalizar(p.sku) === valor;
      });
      if (porId) return porId;
    }

    /* 2. Buscar por SKU visible. */
    var contenido = normalizar(tarjeta.textContent);
    var porSku = productos.find(function (p) {
      return p.sku && contenido.indexOf(normalizar(p.sku)) !== -1;
    });
    if (porSku) return porSku;

    /* 3. Buscar por nombre visible. */
    var nombres = productos
      .filter(function (p) { return p.nombre; })
      .sort(function (a, b) {
        return texto(b.nombre).length - texto(a.nombre).length;
      });

    var porNombre = nombres.find(function (p) {
      return contenido.indexOf(normalizar(p.nombre)) !== -1;
    });

    return porNombre || null;
  }

  function abrirDetalle(producto) {
    if (!producto) return;

    var dialogo = $('dProducto');
    if (!dialogo) return;

    productoActual = producto;
    cantidad = 1;

    var imagen = $('productoDetalleImagen');
    var placeholder = $('productoDetallePlaceholder');
    var categoria = $('productoDetalleCategoria');
    var titulo = $('productoDetalleTitulo');
    var sku = $('productoDetalleSku');
    var descripcion = $('productoDetalleDescripcion');
    var precio = $('productoDetallePrecio');
    var stock = $('productoDetalleStock');
    var boton = $('productoAgregarCarrito');

    categoria.textContent = texto(producto.categoria);
    categoria.hidden = !producto.categoria;

    titulo.textContent = texto(producto.nombre);

    sku.textContent = producto.sku ? 'Clave: ' + producto.sku : '';
    sku.hidden = !producto.sku;

    descripcion.textContent =
      texto(producto.descripcion) ||
      'Este producto no cuenta con una descripción adicional.';

    precio.textContent = dinero(producto.precio);

    var existencia = Math.max(0, Number(producto.stock) || 0);

    stock.classList.toggle('agotado', existencia <= 0);
    stock.textContent = existencia > 0
      ? 'Disponible · ' + existencia + ' pieza' + (existencia === 1 ? '' : 's')
      : 'Agotado por ahora';

    if (producto.imagen) {
      imagen.src = producto.imagen;
      imagen.alt = texto(producto.nombre) || 'Producto';
      imagen.hidden = false;
      placeholder.hidden = true;
    } else {
      imagen.removeAttribute('src');
      imagen.alt = '';
      imagen.hidden = true;
      placeholder.textContent = (texto(producto.nombre).slice(0, 2) || '--').toUpperCase();
      placeholder.hidden = false;
    }

    $('productoCantidad').textContent = '1';
    $('productoCantidadMenos').disabled = true;
    $('productoCantidadMas').disabled = existencia <= 1;
    boton.disabled = existencia <= 0;
    boton.textContent = existencia > 0 ? 'Agregar al carrito' : 'Agotado';

    if (typeof dialogo.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal();
    } else {
      dialogo.setAttribute('open', '');
    }
  }

  function cerrarDetalle() {
    var dialogo = $('dProducto');
    if (!dialogo) return;

    if (typeof dialogo.close === 'function' && dialogo.open) {
      dialogo.close();
    } else {
      dialogo.removeAttribute('open');
    }

    productoActual = null;
  }

  function actualizarCantidad() {
    if (!productoActual) return;

    var stock = Math.max(0, Number(productoActual.stock) || 0);
    var maximo = Math.min(stock, 20);

    cantidad = Math.max(1, Math.min(cantidad, maximo || 1));

    $('productoCantidad').textContent = String(cantidad);
    $('productoCantidadMenos').disabled = cantidad <= 1;
    $('productoCantidadMas').disabled = cantidad >= maximo;
  }

  function agregarDesdeDetalle() {
    if (!productoActual) return;

    var stock = Math.max(0, Number(productoActual.stock) || 0);
    if (stock <= 0) return;

    /*
     * Si el sistema existente expone agregar(p,cant), no es global.
     * Por eso intentamos primero los nombres públicos más comunes.
     */
    if (typeof window.agregarProductoAlCarrito === 'function') {
      window.agregarProductoAlCarrito(productoActual, cantidad);
      cerrarDetalle();
      return;
    }

    if (typeof window.agregarAlCarrito === 'function') {
      window.agregarAlCarrito(productoActual, cantidad);
      cerrarDetalle();
      return;
    }

    /*
     * Compatibilidad directa con el carrito actual si utiliza
     * localStorage. No altera el catálogo.
     */
    var claves = ['carrito', 'cart', 'tienda_carrito', 'cartItems'];
    var guardado = false;

    for (var i = 0; i < claves.length && !guardado; i++) {
      try {
        var actual = localStorage.getItem(claves[i]);
        if (!actual) continue;

        var datos = JSON.parse(actual);
        if (Array.isArray(datos)) {
          var encontrado = datos.find(function (x) {
            return String(x.id) === String(productoActual.id);
          });

          if (encontrado) {
            encontrado.cantidad = Math.min(
              (Number(encontrado.cantidad) || 0) + cantidad,
              stock,
              20
            );
          } else {
            datos.push({
              id: productoActual.id,
              cantidad: cantidad
            });
          }

          localStorage.setItem(claves[i], JSON.stringify(datos));
          guardado = true;
        }
      } catch (e) {}
    }

    /*
     * Si el carrito existente no expone una función global ni un
     * formato de localStorage compatible, al menos disparamos un
     * evento para que otros módulos puedan recibir el producto.
     */
    if (!guardado) {
      document.dispatchEvent(new CustomEvent('producto:agregar', {
        detail: {
          producto: productoActual,
          cantidad: cantidad
        }
      }));
    }

    cerrarDetalle();
  }

  function obtenerTarjetaDesdeClick(elemento) {
    var grid = $('productsGrid');
    var soldOut = $('soldOutGrid');

    if (!grid && !soldOut) return null;

    var tarjeta = elemento.closest(
      'article.card, article.product-card, .product-card, .product, .card'
    );

    if (!tarjeta) return null;

    if (grid && grid.contains(tarjeta)) return tarjeta;
    if (soldOut && soldOut.contains(tarjeta)) return tarjeta;

    return null;
  }

  function instalarDelegacion() {
    document.addEventListener('click', function (evento) {
      var elemento = evento.target;

      /*
       * No interceptar botones de compra/carrito.
       */
      if (elemento.closest(
        'button, a, input, select, textarea, [data-add-cart], .btn-pri, .add-to-cart'
      )) {
        /*
         * Excepto los botones que ya forman parte del nombre o imagen
         * del producto y que explícitamente son para abrir detalle.
         */
        var abrirExplicito = elemento.closest(
          '[data-product-detail], .card-img, .product-image, .product-name, .product-title'
        );
        if (!abrirExplicito) return;
      }

      var tarjeta = obtenerTarjetaDesdeClick(elemento);
      if (!tarjeta) return;

      var producto = encontrarProductoEnTarjeta(tarjeta);
      if (!producto) {
        console.warn('Detalle de producto: no se pudo identificar el producto seleccionado.');
        return;
      }

      evento.preventDefault();
      evento.stopPropagation();
      abrirDetalle(producto);
    }, true);
  }

  function instalarControles() {
    var cerrar = document.querySelector('[data-cerrar-producto]');
    if (cerrar) cerrar.addEventListener('click', cerrarDetalle);

    var dialogo = $('dProducto');
    if (dialogo) {
      dialogo.addEventListener('click', function (evento) {
        if (evento.target === dialogo) cerrarDetalle();
      });
    }

    var menos = $('productoCantidadMenos');
    var mas = $('productoCantidadMas');

    if (menos) {
      menos.addEventListener('click', function () {
        cantidad--;
        actualizarCantidad();
      });
    }

    if (mas) {
      mas.addEventListener('click', function () {
        cantidad++;
        actualizarCantidad();
      });
    }

    var agregar = $('productoAgregarCarrito');
    if (agregar) agregar.addEventListener('click', agregarDesdeDetalle);

    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') cerrarDetalle();
    });
  }

  function iniciar() {
    instalarDelegacion();
    instalarControles();

    /*
     * El catálogo puede cargarse después mediante app.js.
     * Esperamos a que exista productsGrid y a que las tarjetas
     * aparezcan, pero la delegación anterior ya queda instalada.
     */
    cargarCatalogoParaDetalle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
