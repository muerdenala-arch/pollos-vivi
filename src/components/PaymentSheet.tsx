import { useEffect, useRef, useState } from "react";
import { useCart } from "../context/CartContext";
import { api, ApiError } from "../lib/api";
import { useToast } from "./Toast";
import type { Order, PaymentMethod, QrCode } from "@shared/types";

const bs = (n: number) => `Bs. ${n.toFixed(2)}`;

export function PaymentSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { lines, orderType, total, clear } = useCart();
  const { show } = useToast();
  const [method, setMethod] = useState<PaymentMethod>("Efectivo");
  const [receiptDataUri, setReceiptDataUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [selectedQr, setSelectedQr] = useState<QrCode | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<QrCode[]>("/qr-codes").then((codes) => {
      setQrCodes(codes);
      setSelectedQr(codes[0] ?? null);
    }).catch(() => {});
  }, []);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setReceiptDataUri(reader.result as string);
    reader.readAsDataURL(file);
  };

  const confirmar = async () => {
    if (method === "QR" && !receiptDataUri) {
      setError("Sube la captura del comprobante para pagos por QR");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const order = await api.post<Order>("/orders", {
        order_type: orderType,
        items: lines.map((l) => ({ productoId: l.productoId, presaId: l.presaId, cantidad: l.cantidad })),
      });

      let receiptUrl: string | null = null;
      if (method === "QR" && receiptDataUri) {
        const up = await api.post<{ url: string }>("/upload", { dataUri: receiptDataUri, folder: "comprobantes" });
        receiptUrl = up.url;
      }

      await api.patch<Order>(`/orders/${order.id}`, {
        status: "Pagado",
        payment_method: method,
        receipt_url: receiptUrl,
      });

      show(`✅ Pedido ${order.ticket_number} cobrado`);
      clear();
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo procesar el cobro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="cart-backdrop" onClick={onClose} style={{ zIndex: 50 }} />
      <aside className="cart-sheet" style={{ zIndex: 51, maxWidth: 480, margin: "0 auto", right: 0 }}>
        <div className="cart-sheet-handle" />
        <div className="cart-header">
          <span className="cart-title">💳 Cobrar {bs(total)}</span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="cart-body">
          <div className="payment-methods">
            <button className={`payment-method-btn ${method === "Efectivo" ? "active" : ""}`} onClick={() => setMethod("Efectivo")}>
              💵 Efectivo
            </button>
            <button className={`payment-method-btn ${method === "QR" ? "active" : ""}`} onClick={() => setMethod("QR")}>
              📱 QR
            </button>
          </div>

          {method === "QR" && (
            <div className="qr-preview">
              {qrCodes.length > 1 && (
                <div className="payment-methods" style={{ marginBottom: 0 }}>
                  {qrCodes.map((qr) => (
                    <button
                      key={qr.id}
                      className={`payment-method-btn ${selectedQr?.id === qr.id ? "active" : ""}`}
                      onClick={() => setSelectedQr(qr)}
                    >
                      {qr.alias}
                    </button>
                  ))}
                </div>
              )}
              {selectedQr ? (
                <>
                  <img src={selectedQr.image_url} alt={selectedQr.alias} className="upload-preview" style={{ maxWidth: 220 }} />
                  {selectedQr.bank_or_holder && (
                    <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>{selectedQr.bank_or_holder}</p>
                  )}
                </>
              ) : (
                <p style={{ color: "var(--color-danger)", fontSize: "0.85rem" }}>
                  No hay ningún QR configurado — agrégalo desde el panel admin.
                </p>
              )}
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
                Escanea el QR del local y luego sube la captura de tu comprobante.
              </p>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <button className="upload-box" onClick={() => fileInput.current?.click()}>
                {receiptDataUri ? "Cambiar comprobante" : "📷 Subir comprobante"}
              </button>
              {receiptDataUri && <img className="upload-preview" src={receiptDataUri} alt="Comprobante" />}
            </div>
          )}
        </div>

        <div className="cart-footer">
          {error && <div className="pin-error">{error}</div>}
          <button className="btn btn-primary" onClick={confirmar} disabled={submitting}>
            {submitting ? "Procesando…" : `Confirmar cobro ${bs(total)}`}
          </button>
        </div>
      </aside>
    </>
  );
}
