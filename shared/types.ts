import type { DispatchMode, ItemPedido } from "./catalog";

export type UserRole = "admin" | "cajero";
export type OrderStatus = "Pendiente" | "Pagado" | "Preparando" | "Entregado" | "Cancelado";
export type PaymentMethod = "Efectivo" | "QR";
export type RegisterStatus = "open" | "closed";

export interface Branch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface AppUser {
  id: number;
  name: string;
  role: UserRole;
  branch_id: number | null;
  status: boolean;
  color: string;
  protected: boolean;
}

export interface CashRegister {
  id: number;
  cashier_id: number;
  branch_id: number;
  opening_amount: number;
  closing_amount: number | null;
  opened_at: string;
  closed_at: string | null;
  status: RegisterStatus;
}

export interface Order {
  id: number;
  ticket_number: string;
  branch_id: number;
  cashier_id: number | null;
  cash_register_id: number | null;
  order_type: DispatchMode;
  items: ItemPedido[];
  total: number;
  payment_method: PaymentMethod | null;
  receipt_url: string | null;
  status: OrderStatus;
  created_at: string;
}

export interface QrCode {
  id: number;
  alias: string;
  bank_or_holder: string | null;
  image_url: string;
  branch_id: number | null;
  active: boolean;
  is_default: boolean;
}

export interface StockItem {
  id: number;
  branch_id: number;
  item_name: string;
  quantity: number;
  min_stock: number;
  unit: string;
}

export interface AuthResponse {
  token: string;
  user: AppUser;
  branch: Branch | null;
}
