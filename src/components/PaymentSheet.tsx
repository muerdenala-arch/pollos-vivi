import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { useToast } from "./Toast";
import { printTicket } from "../lib/printTicket";
import type { Order, PaymentMethod, QrCode } from "@shared/types";

const bs = (n: number) => `Bs. ${n.toFixed(2)}`;

interface PaymentSheetProps {
  onClose: () => void;
  onDone: () => void;
  /** Si se pasa, cobra un pedido ya guardado (Pendiente) en vez del carrito actual. */
  existingOrder?: Order;
}

export function PaymentSheet({ onClose, onDone, existingOrder }: PaymentSheetProps) {
  const { lines, orderType, total: cartTotal, clear } = useCart();
  const { branch, user } = useAuth();
  const total = existingOrder ? Number(existingOrder.total) : cartTotal;
  const { show } = useToast();
  const [method, setMethod] = useState<PaymentMethod>("Efectivo");
  const [receiptDataUri, setReceiptDataUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [selectedQr, setSelectedQr] = useState<QrCode | null>(null);
  const [zoomed, setZoomed] = useState(false);
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
      const order =
        existingOrder ??
        (await api.post<Order>("/orders", {
          order_type: orderType,
          items: lines.map((l) => ({ productoId: l.productoId, presaId: l.presaId, cantidad: l.cantidad })),
        }));

      let receiptUrl: string | null = null;
      if (method === "QR" && receiptDataUri) {
        const up = await api.post<{ url: string }>("/upload", { dataUri: receiptDataUri, folder: "comprobantes" });
        receiptUrl = up.url;
      }

      const cobrado = await api.patch<Order>(`/orders/${order.id}`, {
        status: "Pagado",
        payment_method: method,
        receipt_url: receiptUrl,
      });

      show(`✅ Pedido ${order.ticket_number} cobrado`);
      printTicket(cobrado, branch, user?.name ?? "—");
      if (!existingOrder) clear();
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
            <PaymentMethodTab label="💵 Efectivo" active={method === "Efectivo"} onClick={() => setMethod("Efectivo")} group="method" />
            <PaymentMethodTab label="📱 QR" active={method === "QR"} onClick={() => setMethod("QR")} group="method" />
          </div>

          {method === "QR" && (
            <div className="qr-preview">
              {qrCodes.length > 1 && (
                <div className="payment-methods" style={{ marginBottom: 0 }}>
                  {qrCodes.map((qr) => (
                    <PaymentMethodTab
                      key={qr.id}
                      label={qr.alias}
                      active={selectedQr?.id === qr.id}
                      onClick={() => setSelectedQr(qr)}
                      group="qr"
                    />
                  ))}
                </div>
              )}
              {selectedQr ? (
                <>
                  <button
                    onClick={() => setZoomed(true)}
                    style={{ display: "block", padding: 0, borderRadius: "var(--radius-md)", overflow: "hidden" }}
                    title="Toca para ampliar"
                  >
                    <img src={selectedQr.image_url} alt={selectedQr.alias} className="upload-preview" style={{ maxWidth: 220, display: "block" }} />
                  </button>
                  <p style={{ fontSize: "0.72rem", color: "var(--color-text-faint)" }}>Toca el QR para ampliarlo</p>
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
          <motion.button
            className="btn btn-primary btn-cobrar"
            onClick={confirmar}
            disabled={submitting}
            whileTap={!submitting ? { scale: 0.97 } : undefined}
          >
            {submitting ? "Procesando…" : `Confirmar cobro ${bs(total)}`}
          </motion.button>
        </div>
      </aside>

      <AnimatePresence>
        {zoomed && selectedQr && (
          <motion.div
            onClick={() => setZoomed(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 60,
              background: "rgba(0,0,0,0.85)",
              display: "grid", placeItems: "center",
              padding: "2rem",
            }}
          >
            <motion.img
              src={selectedQr.image_url}
              alt={selectedQr.alias}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              style={{ maxWidth: "min(90vw, 420px)", maxHeight: "80vh", borderRadius: "var(--radius-md)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PaymentMethodTab({
  label,
  active,
  onClick,
  group,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  group: string;
}) {
  return (
    <button className={`payment-method-btn ${active ? "active" : ""}`} onClick={onClick}>
      {active && (
        <motion.span
          layoutId={`payment-indicator-${group}`}
          className="pill-indicator"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      {label}
    </button>
  );
}
