import type { ReactNode } from "react";
import type { OrderStatus } from "@shared/types";

const STATUS_STYLE: Record<OrderStatus, string> = {
  Pendiente: "badge-info",
  Pagado: "badge-success",
  Preparando: "badge-gold",
  Entregado: "badge-muted",
  Cancelado: "badge-danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function Badge({ tone, children }: { tone: "info" | "success" | "gold" | "danger" | "muted"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
