import type { Order, Branch } from "@shared/types";

const bs = (n: number) => `Bs. ${Number(n).toFixed(2)}`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/**
 * Imprime el ticket de un pedido cobrado en una impresora térmica (58/80mm).
 * Usa un iframe oculto en vez de renderizar el ticket con React + CSS
 * @media print: así la impresión no depende del ciclo de vida del sheet de
 * pago (que se cierra/desmonta justo después de confirmar el cobro).
 */
export function printTicket(order: Order, branch: Branch | null, cashierName: string) {
  const fecha = new Date(order.created_at || Date.now());
  const lineas = order.items
    .map((item) => {
      const nombre = escapeHtml(
        `${item.cantidad}x ${item.productoNombre}${item.presaNombre ? ` (${item.presaNombre})` : ""}`
      );
      return `<div class="line"><span>${nombre}</span><span>${bs(item.subtotal)}</span></div>`;
    })
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(order.ticket_number)}</title>
<style>
  @page { margin: 0; }
  body { width: 80mm; margin: 0; padding: 4mm; font-family: "Courier New", Courier, monospace;
         font-size: 11px; line-height: 1.4; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: 14px; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .line { display: flex; justify-content: space-between; gap: 6px; }
</style></head><body>
  <div class="center bold big">Pollos Vivi</div>
  ${branch?.name ? `<div class="center">${escapeHtml(branch.name)}</div>` : ""}
  ${branch?.address ? `<div class="center">${escapeHtml(branch.address)}</div>` : ""}
  <div class="sep"></div>
  <div>Pedido: ${escapeHtml(order.ticket_number)}</div>
  <div>Fecha: ${escapeHtml(fecha.toLocaleString("es-BO"))}</div>
  <div>Tipo: ${escapeHtml(order.order_type)}</div>
  <div>Cajero: ${escapeHtml(cashierName)}</div>
  <div class="sep"></div>
  ${lineas}
  <div class="sep"></div>
  <div class="line bold big"><span>TOTAL</span><span>${bs(order.total)}</span></div>
  <div>Pago: ${escapeHtml(order.payment_method ?? "—")}</div>
  <div class="sep"></div>
  <div class="center">¡Gracias por su compra!</div>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    cleanup();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  win.onafterprint = cleanup;
  // Respaldo: algunos navegadores móviles no disparan onafterprint.
  setTimeout(cleanup, 15000);

  win.focus();
  win.print();
}
