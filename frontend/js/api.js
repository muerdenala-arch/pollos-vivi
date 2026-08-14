/**
 * api.js — Cliente HTTP centralizado para el Sistema POS
 * v1.3: Sesión persistente con localStorage (no se pierde al recargar).
 *       Nuevo módulo Usuarios para gestión de personal.
 */

const API_BASE =
  window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null'
    ? 'http://localhost:8000'
    : window.location.origin;

// ─── Sesión (localStorage para persistencia entre recargas) ───────────────────

function getToken() {
  return localStorage.getItem('pos_token');
}

function saveSession(data) {
  localStorage.setItem('pos_token', data.access_token);
  localStorage.setItem('pos_rol',   data.rol);
  localStorage.setItem('pos_nombre', data.nombre);
}

function logout() {
  // Solo se borran las claves de sesión/autenticación. El estado de caja
  // (pos_caja_estado, ver caja.js) NO se toca: la caja debe seguir ABIERTA
  // aunque el usuario cierre sesión, se recargue la página o se pierda la
  // conexión — únicamente se cierra con el botón manual de "Cierre de Caja".
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_rol');
  localStorage.removeItem('pos_nombre');
  window.location.href = '/static/login.html';
}

// ─── Fetch centralizado ───────────────────────────────────────────────────────

function authHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
    ...extra,
  };
}

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const headers = { ...(options.headers || {}) };
  if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) { logout(); return; }

  if (!res.ok) {
    let errorMsg = `Error ${res.status}`;
    try { const err = await res.json(); errorMsg = err.detail || errorMsg; } catch (_) {}
    throw new Error(errorMsg);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

const Auth = {
  async login(username, password) {
    const formData = new URLSearchParams({ username, password });
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error de autenticación');
    }
    return res.json();
  },
  async me() { return apiFetch('/api/v1/auth/me'); },
};

// ─── Usuarios (gestión de personal — solo admin) ──────────────────────────────

const Usuarios = {
  async listar() {
    return apiFetch('/api/v1/auth/usuarios');
  },
  async crear(data) {
    return apiFetch('/api/v1/auth/usuarios', { method: 'POST', body: JSON.stringify(data) });
  },
  async actualizar(id, data) {
    return apiFetch(`/api/v1/auth/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async cambiarPassword(id, nuevaPassword) {
    return apiFetch(`/api/v1/auth/usuarios/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ nueva_password: nuevaPassword }),
    });
  },
  async desactivar(id) {
    return apiFetch(`/api/v1/auth/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ activo: false }),
    });
  },
  async activar(id) {
    return apiFetch(`/api/v1/auth/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ activo: true }),
    });
  },
};

// ─── Catálogo ─────────────────────────────────────────────────────────────────

const Categorias = {
  async listar(soloActivas = true) { return apiFetch(`/api/v1/categorias?solo_activas=${soloActivas}`); },
  async crear(data) { return apiFetch('/api/v1/categorias', { method: 'POST', body: JSON.stringify(data) }); },
  async actualizar(id, data) { return apiFetch(`/api/v1/categorias/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async eliminar(id) { return apiFetch(`/api/v1/categorias/${id}`, { method: 'DELETE' }); },
};

const Presas = {
  async listar(soloActivas = true) { return apiFetch(`/api/v1/presas?solo_activas=${soloActivas}`); },
  async crear(data) { return apiFetch('/api/v1/presas', { method: 'POST', body: JSON.stringify(data) }); },
  async actualizar(id, data) { return apiFetch(`/api/v1/presas/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
};

const Productos = {
  async listar(categoriaId = null, soloActivos = true) {
    let url = `/api/v1/productos?solo_activos=${soloActivos}`;
    if (categoriaId) url += `&categoria_id=${categoriaId}`;
    return apiFetch(url);
  },
  async obtener(id) { return apiFetch(`/api/v1/productos/${id}`); },
  async crear(data) { return apiFetch('/api/v1/productos', { method: 'POST', body: JSON.stringify(data) }); },
  async actualizar(id, data) { return apiFetch(`/api/v1/productos/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async eliminar(id) { return apiFetch(`/api/v1/productos/${id}`, { method: 'DELETE' }); },
};

// ─── Pedidos ──────────────────────────────────────────────────────────────────

const Pedidos = {
  async crear(items) { return apiFetch('/api/v1/pedidos', { method: 'POST', body: JSON.stringify({ items }) }); },
  async listar(estado = null) {
    let url = '/api/v1/pedidos';
    if (estado) url += `?estado=${estado}`;
    return apiFetch(url);
  },
  async obtener(id) { return apiFetch(`/api/v1/pedidos/${id}`); },
  async actualizarEstado(id, estado) {
    return apiFetch(`/api/v1/pedidos/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) });
  },
};

// ─── Pagos ────────────────────────────────────────────────────────────────────

const Pagos = {
  async iniciarQR(pedidoId) { return apiFetch(`/api/v1/pagos/qr/${pedidoId}`, { method: 'POST' }); },
  async registrarEfectivo(pedidoId, montoRecibido) {
    return apiFetch(`/api/v1/pagos/efectivo/${pedidoId}`, {
      method: 'POST',
      body: JSON.stringify({ monto_recibido: montoRecibido }),
    });
  },
  async subirComprobante(pedidoId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`/api/v1/pagos/comprobante/${pedidoId}`, { method: 'POST', body: formData });
  },
};

// ─── Reportes ─────────────────────────────────────────────────────────────────

const Reportes = {
  /**
   * @param {string|null} fecha - YYYY-MM-DD (solo admin puede elegir otra que no sea hoy).
   * @param {string|null} desde - Timestamp ISO de apertura del turno actual. Si se pasa,
   *   el resumen queda acotado a SOLO ese turno (no mezcla turnos ya cerrados el mismo día).
   */
  async resumenDia(fecha = null, desde = null) {
    const params = new URLSearchParams();
    if (fecha) params.set('fecha', fecha);
    if (desde) params.set('desde', desde);
    const qs = params.toString();
    return apiFetch(`/api/v1/reportes/ventas/dia${qs ? '?' + qs : ''}`);
  },
  async historialPedidos(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/v1/reportes/pedidos/historial${q ? '?' + q : ''}`);
  },
};

// ─── Configuración Ticket ─────────────────────────────────────────────────────

const TicketConfig = {
  async obtener() { return apiFetch('/api/v1/config/ticket'); },
  async guardar(data) { return apiFetch('/api/v1/config/ticket', { method: 'POST', body: JSON.stringify(data) }); },
};

export {
  API_BASE, getToken, saveSession, logout, authHeaders,
  Auth, Usuarios, Categorias, Presas, Productos, Pedidos, Pagos, Reportes, TicketConfig,
};
