/**
 * utils.js — Utilidades compartidas entre todos los módulos del frontend.
 */

/**
 * Formatea un número como precio en Bolivianos (2 decimales).
 */
export function formatBs(value) {
  return parseFloat(value).toFixed(2);
}

/**
 * Muestra un modal por su ID.
 */
export function showModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('active');
}

/**
 * Oculta un modal por su ID.
 */
export function hideModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('active');
}

/**
 * Muestra un toast de notificación.
 * @param {string} message - Mensaje a mostrar
 * @param {'info'|'success'|'error'} type - Tipo de toast
 * @param {number} duration - Duración en ms (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const icons = { info: 'ℹ️', success: '✅', error: '❌' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/**
 * Flash visual verde cuando se confirma un pago.
 */
export function showPaidFlash() {
  const div = document.createElement('div');
  div.className = 'paid-flash';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 800);
}

/**
 * Formatea una fecha ISO como string legible en español.
 */
export function formatFecha(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Genera un badge HTML de estado de pedido.
 */
export function estadoBadge(estado) {
  const map = {
    'Pendiente':  ['badge-warning', '⏳'],
    'Pagado':     ['badge-success', '✅'],
    'Preparando': ['badge-info',    '👨‍🍳'],
    'Entregado':  ['badge-success', '📦'],
    'Cancelado':  ['badge-danger',  '❌'],
  };
  const [cls, icon] = map[estado] || ['badge-info', '?'];
  return `<span class="badge ${cls}">${icon} ${estado}</span>`;
}

/**
 * Verifica si el usuario está autenticado, si no redirige al login.
 */
export function requireAuth() {
  const token = sessionStorage.getItem('pos_token');
  if (!token) {
    window.location.href = '/static/login.html';
    return false;
  }
  return true;
}

/**
 * Verifica si el usuario tiene rol de admin.
 */
export function requireAdmin() {
  const rol = sessionStorage.getItem('pos_rol');
  if (!requireAuth()) return false;
  if (rol !== 'admin') {
    alert('Acceso restringido: se requiere rol de Administrador.');
    window.location.href = '/static/index.html';
    return false;
  }
  return true;
}
