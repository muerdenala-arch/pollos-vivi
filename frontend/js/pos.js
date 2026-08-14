/**
 * pos.js — Lógica principal del POS (Pantalla del Cajero).
 * Productos con presa se muestran como variantes directas (sin modal, sin iconos).
 * Un clic = directo al carrito.
 */

import { Categorias, Productos } from './api.js';
import { showToast, formatBs } from './utils.js';

// ─── Estado ───────────────────────────────────────────────────────────────────

let cart = [];
let categorias = [];
let productos = [];
let selectedCatId = null;
let activePedidoId = null;

// ─── Inicialización ───────────────────────────────────────────────────────────

async function init() {
  await Promise.all([loadCategorias(), loadProductos()]);
  
  const urlParams = new URLSearchParams(window.location.search);
  const pIdStr = urlParams.get('pedido_id');
  if (pIdStr) {
    await loadExistingPedido(parseInt(pIdStr));
  }
  
  renderCart();
  setupUI();
}

async function loadExistingPedido(id) {
  try {
    const { Pedidos } = await import('./api.js');
    const pedido = await Pedidos.obtener(id);
    if (pedido.estado !== 'Pendiente') {
      showToast('El pedido ya está pagado o cancelado', 'error');
      return;
    }
    
    cart.length = 0;
    pedido.detalles.forEach(d => {
      const p = productos.find(x => x.id === d.producto_id);
      if (!p) return;
      const key = d.presa_id ? `${d.producto_id}-${d.presa_id}` : `${d.producto_id}-null`;
      let presaObj = null;
      if (d.presa_id && p.presas_disponibles) {
        presaObj = p.presas_disponibles.find(x => x.id === d.presa_id);
      }
      cart.push({
        key,
        nombre: d.presa_id && d.nombre_presa_snapshot ? `${d.nombre_producto_snapshot} — ${d.nombre_presa_snapshot}` : d.nombre_producto_snapshot,
        precio_unitario: parseFloat(d.precio_unitario),
        cantidad: d.cantidad,
        producto: p,
        presa: presaObj
      });
    });
    setActivePedidoId(pedido.id);
    showToast(`Pedido #${pedido.id} reanudado`, 'success');
  } catch(e) {
    showToast('Error reanudando pedido: ' + e.message, 'error');
  }
}

async function loadCategorias() {
  try {
    categorias = await Categorias.listar();
    renderCategorias();
  } catch (e) {
    showToast('Error cargando categorías: ' + e.message, 'error');
  }
}

async function loadProductos(categoriaId = null) {
  try {
    productos = await Productos.listar(categoriaId);
    renderProductos(productos);
  } catch (e) {
    showToast('Error cargando productos: ' + e.message, 'error');
  }
}

// ─── Categorías ───────────────────────────────────────────────────────────────

function renderCategorias() {
  const container = document.getElementById('cat-list');
  if (!container) return;
  container.innerHTML = '';

  const todos = document.createElement('button');
  todos.className = 'cat-btn active';
  todos.textContent = 'Todos';
  todos.onclick = () => {
    selectedCatId = null;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    todos.classList.add('active');
    renderProductos(productos);
  };
  container.appendChild(todos);

  categorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.id = `cat-btn-${cat.id}`;
    btn.textContent = cat.nombre;
    btn.onclick = () => {
      selectedCatId = cat.id;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filtered = productos.filter(p => p.categoria_id === cat.id);
      renderProductos(filtered);
    };
    container.appendChild(btn);
  });
}

// ─── Render de Productos como Variantes ───────────────────────────────────────
/**
 * Para productos SIN presa → 1 tarjeta con el nombre del producto.
 * Para productos CON presa → N tarjetas, una por cada presa disponible.
 *   Nombre de la tarjeta: "[Nombre Producto] [Nombre Presa]"
 *   Ejemplo: "Cuarto de Pollo" + "Pierna" → tarjeta "Cuarto Pierna"
 */
function buildVariantes(lista) {
  const variantes = [];
  lista.forEach(producto => {
    if (producto.requiere_presa && producto.presas_disponibles?.length > 0) {
      producto.presas_disponibles.forEach(presa => {
        // Construir nombre corto: primera palabra del producto + nombre presa
        // Ej: "Cuarto de Pollo" + "Pierna" → "Cuarto Pierna"
        const palabras = producto.nombre.split(' ');
        const nombreCorto = palabras[0]; // "Cuarto", "Medio", "Pollo"
        const precio = parseFloat(producto.precio_base) + parseFloat(presa.recargo);
        variantes.push({
          id: `${producto.id}-${presa.id}`,
          nombre: `${nombreCorto} ${presa.nombre}`,
          nombreCompleto: `${producto.nombre} — ${presa.nombre}`,
          precio,
          producto,
          presa,
          tienePresa: true,
        });
      });
    } else {
      variantes.push({
        id: `${producto.id}-null`,
        nombre: producto.nombre,
        nombreCompleto: producto.nombre,
        precio: parseFloat(producto.precio_base),
        producto,
        presa: null,
        tienePresa: false,
      });
    }
  });
  return variantes;
}

function renderProductos(lista) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const variantes = buildVariantes(lista);

  if (variantes.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--color-text-3);">
        <p style="font-size:1.5rem;margin-bottom:0.5rem;">Sin productos</p>
        <p style="font-size:0.875rem;">No hay productos en esta categoría</p>
      </div>`;
    return;
  }

  variantes.forEach(v => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.id = `prod-card-${v.id}`;

    // Diseño simple sin iconos: solo nombre y precio
    card.innerHTML = `
      <div class="product-name" style="font-size: 1.1rem;">${v.nombre}</div>
      <div class="product-price">Bs. ${v.precio.toFixed(2)}</div>
    `;

    card.onclick = () => {
      addToCart(v);
      // Feedback visual
      card.classList.add('card-pulse');
      setTimeout(() => card.classList.remove('card-pulse'), 300);
    };
    grid.appendChild(card);
  });
}

// ─── Carrito ──────────────────────────────────────────────────────────────────

function addToCart(variante) {
  const existing = cart.find(i => i.key === variante.id);
  if (existing) {
    existing.cantidad++;
  } else {
    cart.push({
      key: variante.id,
      nombre: variante.nombreCompleto,
      precio_unitario: variante.precio,
      cantidad: 1,
      producto: variante.producto,
      presa: variante.presa,
    });
  }
  renderCart();
  showToast(`+ ${variante.nombre}`, 'info', 1500);
}

function removeFromCart(key) {
  const index = cart.findIndex(i => i.key === key);
  if (index !== -1) {
    cart.splice(index, 1);
  }
  renderCart();
}

function changeQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    removeFromCart(key);
    return;
  }
  renderCart();
}

function clearCart() {
  cart.length = 0;
  activePedidoId = null;
  updateOrderBadge(null);
  renderCart();
}

function getCartTotal() {
  return cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const countEl   = document.getElementById('cart-count');
  const totalEl   = document.getElementById('cart-total');
  const subtotalEl = document.getElementById('cart-subtotal');
  const cobrarBtns = document.querySelectorAll('.cobrar-btn');
  if (!container) return;

  const total     = getCartTotal();
  const itemCount = cart.reduce((s, i) => s + i.cantidad, 0);

  if (countEl)   countEl.textContent   = itemCount;
  if (totalEl)   totalEl.textContent   = `Bs. ${total.toFixed(2)}`;
  if (subtotalEl) subtotalEl.textContent = `Bs. ${total.toFixed(2)}`;
  cobrarBtns.forEach(btn => { btn.disabled = cart.length === 0; });

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p style="font-size:var(--font-size-sm);">El carrito está vacío</p>
        <p style="font-size:var(--font-size-xs)">Toca un producto para agregarlo</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  cart.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="cart-item-name">${item.nombre}</span>
        <button class="cart-item-remove" onclick="window.posRemove('${item.key}')" title="Eliminar">✕</button>
      </div>
      <div class="cart-item-row">
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="window.posQty('${item.key}', -1)">−</button>
          <span class="qty-value">${item.cantidad}</span>
          <button class="qty-btn" onclick="window.posQty('${item.key}', 1)">+</button>
        </div>
        <div class="cart-item-subtotal">Bs. ${(item.precio_unitario * item.cantidad).toFixed(2)}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

// Exponer al HTML
window.posRemove = (key) => removeFromCart(key);
window.posQty   = (key, delta) => changeQty(key, delta);

function updateOrderBadge(id) {
  const badge = document.getElementById('order-number');
  if (badge) badge.innerHTML = id ? `Pedido <strong>#${id}</strong>` : 'Nuevo Pedido';
}

// ─── Búsqueda ─────────────────────────────────────────────────────────────────

function setupUI() {
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      const base = selectedCatId
        ? productos.filter(p => p.categoria_id === selectedCatId)
        : productos;
      
      const variantesFiltradas = buildVariantes(base).filter(v => 
        v.nombreCompleto.toLowerCase().includes(term) || v.nombre.toLowerCase().includes(term)
      );
      
      const grid = document.getElementById('products-grid');
      grid.innerHTML = '';
      if (variantesFiltradas.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--color-text-3);"><p>Sin resultados</p></div>`;
        return;
      }

      variantesFiltradas.forEach(v => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.id = `prod-card-${v.id}`;
        card.innerHTML = `
          <div class="product-name" style="font-size: 1.1rem;">${v.nombre}</div>
          <div class="product-price">Bs. ${v.precio.toFixed(2)}</div>
        `;
        card.onclick = () => {
          addToCart(v);
          card.classList.add('card-pulse');
          setTimeout(() => card.classList.remove('card-pulse'), 300);
        };
        grid.appendChild(card);
      });
    });
  }

  const clearBtn = document.getElementById('clear-cart-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (cart.length === 0) return;
    if (confirm('¿Limpiar el carrito?')) clearCart();
  });

  const cancelBtn = document.getElementById('cancel-order-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', async () => {
    if (!activePedidoId) return;
    if (confirm('¿Estás seguro de anular/borrar este pedido?')) {
      try {
        const { Pedidos } = await import('./api.js');
        await Pedidos.actualizarEstado(activePedidoId, 'Cancelado');
        showToast('Pedido cancelado correctamente', 'success');
        clearCart();
      } catch(e) {
        showToast('Error cancelando pedido: ' + e.message, 'error');
      }
    }
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { cart, getCartTotal, clearCart, activePedidoId, init as initPOS };

export function setActivePedidoId(id) {
  activePedidoId = id;
  updateOrderBadge(id);
  const cancelBtn = document.getElementById('cancel-order-btn');
  if (cancelBtn) {
    if (id) cancelBtn.classList.remove('hidden');
    else cancelBtn.classList.add('hidden');
  }
}
