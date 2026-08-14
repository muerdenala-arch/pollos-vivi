/**
 * api.js — Cliente HTTP centralizado para el Sistema POS
 * Maneja auth headers, errores y base URL de forma consistente.
 */

// Usar el mismo origen cuando el frontend se sirve desde FastAPI (/static).
// Fallback a localhost:8000 solo si se abre el HTML directamente (file://).
const API_BASE =
  window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null'
    ? 'http://localhost:8000'
    : window.location.origin;

/**
 * Obtiene el token JWT del sessionStorage.
 */
function getToken() {
  return sessionStorage.getItem('pos_token');
}

/**
 * Guarda los datos de sesión.
 */
function saveSession(data) {
  sessionStorage.setItem('pos_token', data.access_token);
  sessionStorage.setItem('pos_rol', data.rol);
  sessionStorage.setItem('pos_nombre', data.nombre);
}

/**
 * Limpia la sesión y redirige al login.
 */
function logout() {
  sessionStorage.clear();
  window.location.href = '/static/login.html';
}

/**
 * Retorna los headers comunes para todas las requests autenticadas.
 */
function authHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
    ...extra,
  };
}

/**
 * Fetch con manejo centralizado de errores y auth.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const headers = { ...(options.headers || {}) };

  // FormData necesita que el navegador establezca multipart/form-data con boundary.
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Sesión expirada
  if (res.status === 401) {
    logout();
    return;
  }

  // Errores del servidor
  if (!res.ok) {
    let errorMsg = `Error ${res.status}`;
    try {
      const err = await res.json();
      errorMsg = err.detail || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

// ─── API de Autenticación ─────────────────────────────────────────────────────

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

// ─── API de Catálogo ──────────────────────────────────────────────────────────

const Categorias = {
  async listar(soloActivas = true) {
    return apiFetch(`/api/v1/categorias?solo_activas=${soloActivas}`);
  },
  async crear(data) {
    return apiFetch('/api/v1/categorias', { method: 'POST', body: JSON.stringify(data) });
  },
  async actualizar(id, data) {
    return apiFetch(`/api/v1/categorias/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async eliminar(id) {
    return apiFetch(`/api/v1/categorias/${id}`, { method: 'DELETE' });
  },
};

const Presas = {
  async listar(soloActivas = true) {
    return apiFetch(`/api/v1/presas?solo_activas=${soloActivas}`);
  },
  async crear(data) {
    return apiFetch('/api/v1/presas', { method: 'POST', body: JSON.stringify(data) });
  },
  async actualizar(id, data) {
    return apiFetch(`/api/v1/presas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
};

const Productos = {
  async listar(categoriaId = null, soloActivos = true) {
    let url = `/api/v1/productos?solo_activos=${soloActivos}`;
    if (categoriaId) url += `&categoria_id=${categoriaId}`;
    return apiFetch(url);
  },
  async obtener(id) {
    return apiFetch(`/api/v1/productos/${id}`);
  },
  async crear(data) {
    return apiFetch('/api/v1/productos', { method: 'POST', body: JSON.stringify(data) });
  },
  async actualizar(id, data) {
    return apiFetch(`/api/v1/productos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async eliminar(id) {
    return apiFetch(`/api/v1/productos/${id}`, { method: 'DELETE' });
  },
};

// ─── API de Pedidos ───────────────────────────────────────────────────────────

const Pedidos = {
  async crear(items) {
    return apiFetch('/api/v1/pedidos', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },
  async listar(estado = null) {
    let url = '/api/v1/pedidos';
    if (estado) url += `?estado=${estado}`;
    return apiFetch(url);
  },
  async obtener(id) {
    return apiFetch(`/api/v1/pedidos/${id}`);
  },
  async actualizarEstado(id, estado) {
    return apiFetch(`/api/v1/pedidos/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
  },
};

// ─── API de Pagos ─────────────────────────────────────────────────────────────

const Pagos = {
  async iniciarQR(pedidoId) {
    return apiFetch(`/api/v1/pagos/qr/${pedidoId}`, { method: 'POST' });
  },
  async registrarEfectivo(pedidoId, montoRecibido) {
    return apiFetch(`/api/v1/pagos/efectivo/${pedidoId}`, {
      method: 'POST',
      body: JSON.stringify({ monto_recibido: montoRecibido }),
    });
  },
  async subirComprobante(pedidoId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch(`/api/v1/pagos/comprobante/${pedidoId}`, {
      method: 'POST',
      body: formData,
    });
  },
};

// ─── API de Reportes ──────────────────────────────────────────────────────────

const Reportes = {
  async resumenDia(fecha = null) {
    let url = '/api/v1/reportes/ventas/dia';
    if (fecha) url += `?fecha=${fecha}`;
    return apiFetch(url);
  },
  async historialPedidos(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/v1/reportes/pedidos/historial${q ? '?' + q : ''}`);
  },
};

export {
  API_BASE, getToken, saveSession, logout, authHeaders,
  Auth, Categorias, Presas, Productos, Pedidos, Pagos, Reportes,
};
