/**
 * pagos.js — Flujos de cobro: QR estático y Efectivo.
 * v1.2: Botón "Confirmar Pago QR" directo sin espera de webhook.
 *       Verificación de apertura de caja antes de cualquier pago.
 */

import { Pedidos, Pagos } from './api.js';
import { cart, getCartTotal, clearCart, setActivePedidoId } from './pos.js';
import { showModal, hideModal, showToast, showPaidFlash, formatBs } from './utils.js';
import { posWS } from './websocket.js';
import { API_BASE } from './api.js';
import { cajaAbierta } from './caja.js';
import { imprimirTicket } from './ticket.js';

let currentPedidoId = null;

// ─── Inicializar Pagos ────────────────────────────────────────────────────────

export function initPagos() {
  // Escuchar pagos confirmados por WebSocket (pasarela externa)
  posWS.on('pago_completado', (data) => {
    if (data.pedido_id === currentPedidoId) {
      onPagoConfirmado(data);
    }
  });

  posWS.on('pago_fallido', () => {
    showToast('❌ Pago fallido. Intenta de nuevo.', 'error', 5000);
  });

  // Botones de cobro
  document.getElementById('btn-cobrar-efectivo')?.addEventListener('click', iniciarPagoEfectivo);
  document.getElementById('btn-cobrar-qr')?.addEventListener('click', iniciarPagoQR);

  // Botón confirmar efectivo
  document.getElementById('confirm-efectivo-btn')?.addEventListener('click', confirmarEfectivo);

  // Monto recibido → calcular cambio en tiempo real
  document.getElementById('monto-recibido-input')?.addEventListener('input', calcularCambio);

  // Botón "Confirmar Pago QR" — registra el pago directamente sin webhook
  document.getElementById('btn-confirmar-pago-qr')?.addEventListener('click', confirmarPagoQRManual);

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

// ─── Verificar caja abierta ───────────────────────────────────────────────────

function verificarCaja() {
  if (!cajaAbierta()) {
    showToast('⚠️ Debe realizar la Apertura de Caja antes de cobrar.', 'error', 5000);
    return false;
  }
  return true;
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
  if (!verificarCaja()) return;

  try {
    const pedidoId = await crearPedidoSiNecesario();
    await Pagos.iniciarQR(pedidoId);

    // Mostrar total en modal QR
    const total = getCartTotal();
    const totalEl = document.getElementById('qr-total-amount');
    if (totalEl) totalEl.textContent = total.toFixed(2);

    // Resetear estado del modal
    document.getElementById('qr-waiting')?.classList.add('hidden');
    document.getElementById('qr-paid')?.classList.add('hidden');
    const confirmBtn = document.getElementById('btn-confirmar-pago-qr');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.classList.remove('hidden');
    }

    showModal('modal-qr');
    posWS.connect();

  } catch (e) {
    showToast('Error iniciando pago QR: ' + e.message, 'error');
  }
}

// ─── Confirmar pago QR manualmente (el cajero presiona cuando el cliente pagó) ─

async function confirmarPagoQRManual() {
  if (!currentPedidoId) return;
  const btn = document.getElementById('btn-confirmar-pago-qr');
  if (btn) btn.disabled = true;

  try {
    // Subir comprobante vacío para marcar como pagado, o simplemente
    // usar el endpoint de efectivo con el total exacto (monto_recibido = total)
    const total = getCartTotal();
    await Pagos.registrarEfectivo(currentPedidoId, total, 'QR');

    onPagoConfirmado({ pedido_id: currentPedidoId, metodo: 'QR' });
  } catch (e) {
    showToast('Error confirmando pago: ' + e.message, 'error');
    if (btn) btn.disabled = false;
  }
}

// ─── Pago con Efectivo ────────────────────────────────────────────────────────

async function iniciarPagoEfectivo() {
  if (cart.length === 0) return;
  if (!verificarCaja()) return;

  const total = getCartTotal();
  const totalEl = document.getElementById('efectivo-total');
  if (totalEl) totalEl.textContent = `Bs. ${total.toFixed(2)}`;

  const input = document.getElementById('monto-recibido-input');
  if (input) { input.value = ''; }

  const cambioEl = document.getElementById('efectivo-cambio-section');
  if (cambioEl) cambioEl.classList.add('hidden');

  const confirmBtn = document.getElementById('confirm-efectivo-btn');
  if (confirmBtn) confirmBtn.disabled = true;

  showModal('modal-efectivo');
  // Focus en el input
  setTimeout(() => input?.focus(), 120);
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
    if (confirmBtn) confirmBtn.disabled = false;
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
    onPagoConfirmado({ pedido_id: currentPedidoId, metodo: 'QR' });
  } catch (e) {
    showToast('Error subiendo comprobante: ' + e.message, 'error');
  }
}

// ─── Pago Confirmado ──────────────────────────────────────────────────────────

function onPagoConfirmado(data) {
  showPaidFlash();
  showToast(`✅ Pedido #${data.pedido_id} PAGADO — ${data.metodo}`, 'success', 4000);

  document.getElementById('qr-waiting')?.classList.add('hidden');
  document.getElementById('qr-paid')?.classList.remove('hidden');

  const estadoEl = document.getElementById('pedido-estado');
  if (estadoEl) estadoEl.innerHTML = `<span class="badge badge-success">✅ PAGADO</span>`;

  // Imprimir ticket automáticamente sin bloquear el flujo visual
  Pedidos.obtener(data.pedido_id)
    .then(pedidoCompleto => {
      imprimirTicket(pedidoCompleto, data.metodo);
    })
    .catch(err => console.error("No se pudo obtener pedido para imprimir", err));

  setTimeout(() => {
    hideModal('modal-qr');
    hideModal('modal-efectivo');
    clearCart();
    currentPedidoId = null;
  }, 1800);
}

export { currentPedidoId };
