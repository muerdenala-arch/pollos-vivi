-- ═══════════════════════════════════════════════════════════════════════════
-- Esquema PostgreSQL (Neon) — Sistema POS Pollos Vivi v2.0
-- Arquitectura: Vercel Serverless (/api) + Neon Postgres + Cloudinary.
--
-- Tablas pedidas: branches, users, cash_registers, orders, stock_inventory.
-- El catálogo de venta (categorías, productos, presas y sus precios) NO vive
-- en tablas propias: se mantiene tal cual estaba (mismos productos, mismos
-- precios, mismas presas) como fuente única en shared/catalog.ts, compartida
-- entre frontend y backend, para no alterar las reglas de negocio existentes.
-- Cada pedido guarda un snapshot congelado de esos ítems en `orders.items`.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'cajero');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_type AS ENUM ('Mesa', 'Llevar', 'Delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('Pendiente', 'Pagado', 'Preparando', 'Entregado', 'Cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('Efectivo', 'QR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE register_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Sucursales ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    address    VARCHAR(200),
    phone      VARCHAR(50),
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Usuarios (cajeros / admins) ────────────────────────────────────────────
-- El PIN nunca se guarda en texto plano: `pin_hash` es bcrypt del PIN numérico.
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    role       user_role NOT NULL DEFAULT 'cajero',
    pin_hash   VARCHAR(255) NOT NULL,
    branch_id  INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    status     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);

-- ── Caja / Arqueo de turno ─────────────────────────────────────────────────
-- Corrige el hallazgo de la auditoría: antes vivía solo en localStorage del
-- navegador del cajero. Ahora es la fuente de verdad, persistida y auditable.
CREATE TABLE IF NOT EXISTS cash_registers (
    id              SERIAL PRIMARY KEY,
    cashier_id      INTEGER NOT NULL REFERENCES users(id),
    branch_id       INTEGER NOT NULL REFERENCES branches(id),
    opening_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    closing_amount  NUMERIC(10, 2),
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    status          register_status NOT NULL DEFAULT 'open'
);
-- Un cajero no puede tener dos cajas abiertas a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_register_per_cashier
    ON cash_registers(cashier_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_cash_registers_branch ON cash_registers(branch_id, status);

-- ── Pedidos ────────────────────────────────────────────────────────────────
-- `items` guarda snapshot congelado: [{product_id, product_name, presa_name,
-- unit_price, quantity, subtotal}], calculado y validado SIEMPRE en el
-- servidor (api/orders) contra shared/catalog.ts — el cliente nunca envía
-- precios de confianza, igual que en el sistema anterior.
CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    ticket_number    VARCHAR(20) NOT NULL UNIQUE,
    branch_id        INTEGER NOT NULL REFERENCES branches(id),
    cashier_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    cash_register_id INTEGER REFERENCES cash_registers(id) ON DELETE SET NULL,
    order_type       order_type NOT NULL DEFAULT 'Llevar',
    items            JSONB NOT NULL,
    total            NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method   payment_method,
    receipt_url      VARCHAR(500),
    status           order_status NOT NULL DEFAULT 'Pendiente',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_branch_fecha ON orders(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_cash_register ON orders(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ── Inventario / Stock ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_inventory (
    id         SERIAL PRIMARY KEY,
    branch_id  INTEGER NOT NULL REFERENCES branches(id),
    item_name  VARCHAR(150) NOT NULL,
    quantity   NUMERIC(10, 2) NOT NULL DEFAULT 0,
    min_stock  NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit       VARCHAR(20) NOT NULL DEFAULT 'unidad',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_branch ON stock_inventory(branch_id);
