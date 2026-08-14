-- ═══════════════════════════════════════════════════════════════════════════
-- Esquema PostgreSQL — Sistema POS (Pollo & Salchipapas)
-- Ing. Rodrigo Zambrana Martinez  |  v1.1.0
--
-- Este esquema está SINCRONIZADO con los modelos SQLAlchemy (app/models.py).
-- Nota: la app también puede crear las tablas automáticamente al iniciar
-- (Base.metadata.create_all), pero este archivo sirve como fuente de verdad
-- documentada y para despliegues manuales. Ejecutar seed.sql DESPUÉS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tipos ENUM (coinciden con los Enum de Python) ──────────────────────────
CREATE TYPE rol_usuario  AS ENUM ('admin', 'cajero');
CREATE TYPE estado_pedido AS ENUM ('Pendiente', 'Pagado', 'Preparando', 'Entregado', 'Cancelado');
CREATE TYPE metodo_pago   AS ENUM ('Efectivo', 'QR');
CREATE TYPE estado_pago   AS ENUM ('Pendiente', 'Completado', 'Fallido', 'Anulado');

-- ── Usuarios ───────────────────────────────────────────────────────────────
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    rol             rol_usuario  NOT NULL DEFAULT 'cajero',
    activo          BOOLEAN      DEFAULT TRUE,
    creado_en       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_usuarios_username ON usuarios(username);

-- ── Categorías ─────────────────────────────────────────────────────────────
CREATE TABLE categorias (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo      BOOLEAN DEFAULT TRUE,
    creado_en   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Productos ──────────────────────────────────────────────────────────────
CREATE TABLE productos (
    id             SERIAL PRIMARY KEY,
    categoria_id   INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre         VARCHAR(150) NOT NULL,
    precio_base    DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    requiere_presa BOOLEAN DEFAULT FALSE,   -- TRUE para productos de pollo
    activo         BOOLEAN DEFAULT TRUE,
    creado_en      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_productos_categoria_id ON productos(categoria_id);

-- ── Presas ─────────────────────────────────────────────────────────────────
CREATE TABLE presas (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(50) NOT NULL UNIQUE,   -- Pierna, Pecho, Ala, Mixto
    recargo DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    activo  BOOLEAN DEFAULT TRUE
);

-- ── Producto ↔ Presa (qué presas admite cada producto) ─────────────────────
CREATE TABLE producto_presas (
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    presa_id    INTEGER REFERENCES presas(id)    ON DELETE CASCADE,
    PRIMARY KEY (producto_id, presa_id)
);

-- ── Pedidos ────────────────────────────────────────────────────────────────
CREATE TABLE pedidos (
    id              SERIAL PRIMARY KEY,
    cajero_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    estado          estado_pedido NOT NULL DEFAULT 'Pendiente',
    metodo_pago     metodo_pago,             -- NULL hasta el cobro
    total           DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    comprobante_url VARCHAR(500),            -- Foto comprobante (fallback)
    creado_en       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pedidos_cajero_id     ON pedidos(cajero_id);
CREATE INDEX idx_pedidos_estado        ON pedidos(estado);
CREATE INDEX idx_pedidos_creado_en     ON pedidos(creado_en);
CREATE INDEX idx_pedidos_estado_fecha  ON pedidos(estado, creado_en);  -- Reportes

-- ── Detalle de pedidos (precios y nombres CONGELADOS) ──────────────────────
CREATE TABLE detalle_pedidos (
    id                       SERIAL PRIMARY KEY,
    pedido_id                INTEGER NOT NULL REFERENCES pedidos(id)   ON DELETE CASCADE,
    producto_id              INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    presa_id                 INTEGER REFERENCES presas(id)             ON DELETE RESTRICT,
    cantidad                 INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario          DECIMAL(10, 2) NOT NULL,  -- base + recargo (congelado)
    subtotal                 DECIMAL(12, 2) NOT NULL,
    nombre_producto_snapshot VARCHAR(200) NOT NULL,    -- Snapshot histórico
    nombre_presa_snapshot    VARCHAR(100)
);
CREATE INDEX idx_detalle_pedido_id   ON detalle_pedidos(pedido_id);
CREATE INDEX idx_detalle_producto_id ON detalle_pedidos(producto_id);
CREATE INDEX idx_detalle_presa_id    ON detalle_pedidos(presa_id);

-- ── Pagos ──────────────────────────────────────────────────────────────────
CREATE TABLE pagos (
    id             SERIAL PRIMARY KEY,
    pedido_id      INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    monto          DECIMAL(12, 2) NOT NULL,
    metodo         metodo_pago NOT NULL,
    estado         estado_pago DEFAULT 'Pendiente',
    transaccion_id VARCHAR(255) UNIQUE,   -- ID de la pasarela
    creado_en      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pagos_pedido_id   ON pagos(pedido_id);
CREATE INDEX idx_pagos_transaccion ON pagos(transaccion_id);
