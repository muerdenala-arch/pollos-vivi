/**
 * pagos.js — Flujos de cobro: QR estático y Efectivo.
 */

import { Pedidos, Pagos } from './api.js';
import { cart, getCartTotal, clearCart, setActivePedidoId } from './pos.js';
import { showModal, hideModal, showToast, showPaidFlash, formatBs } from './utils.js';
import { posWS } from './websocket.js';
import { API_BASE } from './api.js';

let currentPedidoId = null;

// ─── Inicializar Pagos ────────────────────────────────────────────────────────

export function initPagos() {
  // Escuchar pagos confirmados por WebSocket
  posWS.on('pago_completado', (data) => {
    if (data.pedido_id === currentPedidoId) {
      onPagoConfirmado(data);
    }
  });

  posWS.on('pago_fallido', (data) => {
    showToast('❌ Pago fallido. Intenta de nuevo.', 'error', 5000);
    hideModal('modal-qr');
  });

  // Botones de cobro
  document.getElementById('btn-cobrar-efectivo')?.addEventListener('click', iniciarPagoEfectivo);
  document.getElementById('btn-cobrar-qr')?.addEventListener('click', iniciarPagoQR);

  // Botón confirmar efectivo
  document.getElementById('confirm-efectivo-btn')?.addEventListener('click', confirmarEfectivo);

  // Monto recibido → calcular cambio en tiempo real
  document.getElementById('monto-recibido-input')?.addEventListener('input', calcularCambio);

  // Botón comprobante manual
  document.getElementById('btn-comprobante')?.addEventListener('click', () => {
    document.getElementById('comprobante-file')?.click();
  });
  document.getElementById('comprobante-file')?.addEventListener('change', subirComprobante);

  // Cerrar modales al click en overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideModal(overlay.id);
    });
  });
}

// ─── Crear Pedido ─────────────────────────────────────────────────────────────

async function crearPedidoSiNecesario() {
  if (currentPedidoId) return currentPedidoId;

  const items = cart.map(i => ({
    producto_id: i.producto.id,
    presa_id: i.presa?.id || null,
    cantidad: i.cantidad,
  }));

  try {
    const pedido = await Pedidos.crear(items);
    currentPedidoId = pedido.id;
    setActivePedidoId(pedido.id);

    // Actualizar número de pedido en UI
    const badge = document.getElementById('order-number');
    if (badge) badge.innerHTML = `Pedido <strong>#${pedido.id}</strong>`;

    return pedido.id;
  } catch (e) {
    showToast('Error al crear pedido: ' + e.message, 'error');
    throw e;
  }
}

// ─── Pago con QR ─────────────────────────────────────────────────────────────

async function iniciarPagoQR() {
  if (cart.length === 0) return;

  try {
    const pedidoId = await crearPedidoSiNecesario();
    const qrData = await Pagos.iniciarQR(pedidoId);

    // Mostrar modal QR
    const totalEl = document.getElementById('qr-total-amount');
    const qrImg = document.getElementById('qr-image');
    if (totalEl) totalEl.textContent = `Bs. ${formatBs(qrData.total)}`;
    if (qrImg) {
      qrImg.src = `${API_BASE}${qrData.qr_image_url}`;
      qrImg.style.display = 'block';
    }

    // Mostrar estado de espera
    document.getElementById('qr-waiting')?.classList.remove('hidden');
    document.getElementById('qr-paid')?.classList.add('hidden');

    showModal('modal-qr');

    // Reconectar WS al pedido específico (para pantalla cliente también)
    posWS.connect();

  } catch (e) {
    showToast('Error iniciando pago QR: ' + e.message, 'error');
  }
}

// ─── Pago con Efectivo ────────────────────────────────────────────────────────

async function iniciarPagoEfectivo() {
  if (cart.length === 0) return;

  const total = getCartTotal();
  const totalEl = document.getElementById('efectivo-total');
  if (totalEl) totalEl.textContent = `Bs. ${total.toFixed(2)}`;

  const input = document.getElementById('monto-recibido-input');
  if (input) { input.value = ''; }

  const cambioEl = document.getElementById('efectivo-cambio-section');
  if (cambioEl) cambioEl.classList.add('hidden');

  showModal('modal-efectivo');
}

function calcularCambio() {
  const input = document.getElementById('monto-recibido-input');
  const cambioSection = document.getElementById('efectivo-cambio-section');
  const cambioEl = document.getElementById('cambio-amount');
  const confirmBtn = document.getElementById('confirm-efectivo-btn');

  const monto = parseFloat(input?.value || 0);
  const total = getCartTotal();

  if (monto >= total) {
    const cambio = monto - total;
    if (cambioEl) cambioEl.textContent = `Bs. ${cambio.toFixed(2)}`;
    if (cambioSection) cambioSection.classList.remove('hidden');
    if (confirmBtn) confirmBtn.disabled = false;
  } else {
    if (cambioSection) cambioSection.classList.add('hidden');
    if (confirmBtn) confirmBtn.disabled = true;
  }
}

async function confirmarEfectivo() {
  const input = document.getElementById('monto-recibido-input');
  const monto = parseFloat(input?.value || 0);
  const confirmBtn = document.getElementById('confirm-efectivo-btn');

  try {
    confirmBtn.disabled = true;
    const pedidoId = await crearPedidoSiNecesario();
    await Pagos.registrarEfectivo(pedidoId, monto);

    hideModal('modal-efectivo');
    onPagoConfirmado({ pedido_id: pedidoId, metodo: 'Efectivo' });
  } catch (e) {
    showToast('Error registrando pago: ' + e.message, 'error');
    confirmBtn.disabled = false;
  }
}

// ─── Comprobante Manual (Fallback) ────────────────────────────────────────────

async function subirComprobante(event) {
  const file = event.target.files[0];
  if (!file || !currentPedidoId) return;

  try {
    showToast('Subiendo comprobante...', 'info');
    await Pagos.subirComprobante(currentPedidoId, file);
    hideModal('modal-qr');
    onPagoConfirmado({ pedido_id: currentPedidoId, metodo: 'Comprobante' });
  } catch (e) {
    showToast('Error subiendo comprobante: ' + e.message, 'error');
  }
}

// ─── Pago Confirmado ──────────────────────────────────────────────────────────

function onPagoConfirmado(data) {
  showPaidFlash();
  showToast(`✅ Pedido #${data.pedido_id} PAGADO (${data.metodo})`, 'success', 5000);

  // Actualizar estado del QR modal si está abierto
  document.getElementById('qr-waiting')?.classList.add('hidden');
  document.getElementById('qr-paid')?.classList.remove('hidden');

  // Actualizar badge de estado en header
  const estadoEl = document.getElementById('pedido-estado');
  if (estadoEl) estadoEl.innerHTML = `<span class="badge badge-success">✅ PAGADO</span>`;

  setTimeout(() => {
    hideModal('modal-qr');
    clearCart();
    currentPedidoId = null;
  }, 2500);
}

export { currentPedidoId };
