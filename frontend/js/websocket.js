/**
 * websocket.js — Cliente WebSocket para actualizaciones en tiempo real.
 * La pantalla del cajero y la pantalla del cliente usan este módulo.
 */

import { API_BASE } from './api.js';

const WS_BASE = API_BASE.replace('http', 'ws');

class POSWebSocket {
  constructor() {
    this._ws = null;
    this._handlers = {};
    this._reconnectDelay = 2000;
    this._maxReconnect = 10;
    this._reconnectCount = 0;
    this._manualClose = false;
  }

  /**
   * Conecta al WebSocket global (cajero).
   */
  connect() {
    this._manualClose = false;
    this._openConnection('/ws');
  }

  /**
   * Conecta al WebSocket de un pedido específico (pantalla cliente).
   */
  connectPedido(pedidoId) {
    this._manualClose = false;
    this._openConnection(`/ws/pedido/${pedidoId}`);
  }

  _openConnection(path) {
    try {
      this._ws = new WebSocket(`${WS_BASE}${path}`);

      this._ws.onopen = () => {
        console.log('🔌 WebSocket conectado:', path);
        this._reconnectCount = 0;
        this._emit('connected');
      };

      this._ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WS mensaje:', data);
          this._emit(data.evento, data);
          this._emit('message', data);
        } catch (e) {
          console.warn('WS: mensaje no JSON:', event.data);
        }
      };

      this._ws.onclose = () => {
        this._emit('disconnected');
        if (!this._manualClose && this._reconnectCount < this._maxReconnect) {
          this._reconnectCount++;
          console.log(`🔄 Reconectando WS en ${this._reconnectDelay}ms... (${this._reconnectCount}/${this._maxReconnect})`);
          setTimeout(() => this._openConnection(path), this._reconnectDelay);
        }
      };

      this._ws.onerror = (err) => {
        console.warn('⚠️ WS error:', err);
        this._emit('error', err);
      };
    } catch (e) {
      console.error('❌ No se pudo crear WebSocket:', e);
    }
  }

  /**
   * Registra un handler para un evento específico.
   * Eventos: 'connected', 'disconnected', 'pago_completado', 'pago_fallido', 'message', 'error'
   */
  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
    return this; // Chainable
  }

  _emit(event, data) {
    (this._handlers[event] || []).forEach(fn => fn(data));
  }

  disconnect() {
    this._manualClose = true;
    if (this._ws) this._ws.close();
  }

  isConnected() {
    return this._ws && this._ws.readyState === WebSocket.OPEN;
  }
}

export const posWS = new POSWebSocket();
