/**
 * caja.js — Módulo de Apertura y Cierre de Caja.
 * 
 * Guarda el estado en localStorage para persistir entre recargas.
 * El POS queda bloqueado hasta que se haga la apertura del día.
 */

const CAJA_KEY = 'pos_caja_estado';

/** @returns {{ abierta: boolean, monto_inicial: number, fecha: string, hora: string } | null} */
function getCajaState() {
  try {
    const raw = localStorage.getItem(CAJA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Verifica si la caja está abierta HOY */
export function cajaAbierta() {
  const state = getCajaState();
  if (!state || !state.abierta) return false;
  // Verificar que la apertura sea del día de hoy
  const hoy = new Date().toISOString().split('T')[0];
  return state.fecha === hoy;
}

/** Abre la caja con el monto declarado */
export function abrirCaja(montoInicial) {
  const ahora = new Date();
  const estado = {
    abierta: true,
    monto_inicial: parseFloat(montoInicial),
    fecha: ahora.toISOString().split('T')[0],
    hora: ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
    cajero: sessionStorage.getItem('pos_nombre') || 'Cajero',
  };
  localStorage.setItem(CAJA_KEY, JSON.stringify(estado));
  return estado;
}

/** Cierra la caja */
export function cerrarCaja() {
  const state = getCajaState();
  if (state) {
    state.abierta = false;
    state.hora_cierre = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem(CAJA_KEY, JSON.stringify(state));
  }
}

export { getCajaState };
