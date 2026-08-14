/**
 * Lógica de impresión de tickets
 */
import { formatFecha, formatBs } from './utils.js';
import { TicketConfig } from './api.js';

/**
 * Genera el HTML para el ticket
 */
function generarHTMLTicket(config, pedido, metodo_pago) {
  const is80 = config.ancho_papel === '80';
  const widthPx = is80 ? '300px' : '220px'; // 80mm ~ 300px, 58mm ~ 220px en la impresora
  const fontSize = is80 ? '14px' : '12px';

  let itemsHTML = '';
  pedido.detalles.forEach(d => {
    itemsHTML += `
      <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
        <span>${d.cantidad}x ${d.producto_nombre}</span>
        <span>${formatBs(d.subtotal)}</span>
      </div>
    `;
    if (d.presas_detalle) {
      itemsHTML += `<div style="font-size:0.9em; padding-left:10px; color:#333; margin-bottom:4px;">- ${d.presas_detalle}</div>`;
    }
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ticket #${pedido.id}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: monospace; /* Fuente clásica de ticketera */
          font-size: ${fontSize};
          color: #000;
          width: ${widthPx};
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .dashed-line { border-top: 1px dashed #000; margin: 8px 0; }
        .header h1 { margin: 0; font-size: 1.5em; text-transform: uppercase; }
        .ticket-number { font-size: 2em; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        th { border-bottom: 1px solid #000; text-align: left; font-size: 0.9em; padding-bottom: 2px; }
      </style>
    </head>
    <body>
      <div class="header text-center">
        <h1>${config.nombre_local || 'POLLOS VIVI'}</h1>
        ${config.direccion ? `<div>${config.direccion}</div>` : ''}
        ${config.telefono ? `<div>Tel: ${config.telefono}</div>` : ''}
        <div>Fecha: ${formatFecha(new Date().toISOString())}</div>
      </div>
      
      <div class="dashed-line"></div>
      
      <div class="text-center">
        <div>TICKET NO.</div>
        <div class="bold ticket-number">#${pedido.id}</div>
      </div>
      
      <div class="dashed-line"></div>
      
      <div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #000; margin-bottom:4px; font-weight:bold; font-size:0.9em;">
          <span>CANT DESCRIPCION</span>
          <span>TOTAL</span>
        </div>
        ${itemsHTML}
      </div>
      
      <div class="dashed-line"></div>
      
      <div style="display:flex; justify-content:space-between; font-size:1.2em; font-weight:bold;">
        <span>TOTAL:</span>
        <span>${formatBs(pedido.total)}</span>
      </div>
      <div class="text-right" style="margin-top:4px;">
        Pago: <span class="bold">${metodo_pago.toUpperCase()}</span>
      </div>
      
      <div class="dashed-line"></div>
      
      <div class="text-center" style="white-space: pre-wrap; margin-top:10px;">
        ${config.pie_pagina || '¡Gracias por su preferencia!'}
      </div>
      
      <!-- Espacio al final para asegurar corte de papel -->
      <div style="height: 40px;"></div>
    </body>
    </html>
  `;
}

/**
 * Imprime el ticket de forma silenciosa usando un iframe.
 * @param {Object} pedido Objeto del pedido con id, total, detalles[]
 * @param {string} metodo_pago 'EFECTIVO' o 'QR'
 */
export async function imprimirTicket(pedido, metodo_pago) {
  try {
    const config = await TicketConfig.obtener();
    const html = generarHTMLTicket(config, pedido, metodo_pago);

    // Crear un iframe temporal oculto
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Esperar a que el iframe cargue y luego invocar print
    iframe.onload = function() {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      
      // Remover el iframe después de un tiempo para no ensuciar el DOM
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 5000);
    };

  } catch (err) {
    console.error("Error al imprimir el ticket:", err);
  }
}
