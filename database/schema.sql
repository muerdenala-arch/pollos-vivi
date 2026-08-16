-- ═══════════════════════════════════════════════════════════════════════════
-- Esquema PostgreSQL (Neon) — Sistema POS Pollos Vivi v2.0
-- Arquitectura: Vercel Serverless (/api) + Neon Postgres + Cloudinary.
--
-- Tablas pedidas: branches, users, cash_registers, orders, stock_inventory.
-- El catálogo de venta (categories, products, presas) vive en sus propias
-- tablas, administrable desde el panel — mismos productos/precios/presas que
-- tenía el sistema anterior, solo que ahora editables en vez de fijos en
-- código (ver database/migration_002_catalog.sql para el detalle histórico).
-- Cada pedido guarda un snapshot congelado de esos ítems en `orders.items`,
-- calculado y validado siempre en el servidor contra estas tablas.
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
-- `color` es un token de acento (nombre de color) para el avatar en el panel;
-- `protected` evita borrar/bloquear al admin sembrado por el sistema.
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    role       user_role NOT NULL DEFAULT 'cajero',
    pin_hash   VARCHAR(255) NOT NULL,
    branch_id  INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    status     BOOLEAN NOT NULL DEFAULT TRUE,
    color      VARCHAR(20) NOT NULL DEFAULT 'primary',
    protected  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);

-- ── Catálogo (categorías, productos, presas) — administrable desde el panel ──
CREATE TABLE IF NOT EXISTS categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS presas (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(50) NOT NULL,
    recargo NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
    id             SERIAL PRIMARY KEY,
    category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name           VARCHAR(150) NOT NULL,
    base_price     NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    requiere_presa BOOLEAN NOT NULL DEFAULT FALSE,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_presas (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    presa_id   INTEGER NOT NULL REFERENCES presas(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, presa_id)
);

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

-- ── Códigos QR de pago (múltiples, administrables) ────────────────────────
-- Sin ningún QR "de fábrica": el admin sube el/los suyos desde el panel
-- (imagen a Cloudinary). `is_default` marca cuál se preselecciona al
-- cajero cuando hay más de uno activo (exclusividad resuelta en la app,
-- no con constraint — ver api/qr-codes.ts).
CREATE TABLE IF NOT EXISTS qr_codes (
    id             SERIAL PRIMARY KEY,
    alias          VARCHAR(100) NOT NULL,
    bank_or_holder VARCHAR(150),
    image_url      VARCHAR(500) NOT NULL,
    branch_id      INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    is_default     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qr_codes_branch ON qr_codes(branch_id, active);

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
