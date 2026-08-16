-- Migración 002 — Catálogo administrable
-- Antes el catálogo (categorías/productos/presas) vivía fijo en shared/catalog.ts.
-- Ahora pasa a la base de datos para poder editarlo desde el panel admin,
-- igual que en el POS de referencia (juguería). Ejecutar sobre una base que
-- ya tiene schema.sql + seed.sql aplicados.

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
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name            VARCHAR(150) NOT NULL,
    base_price      NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    requiere_presa  BOOLEAN NOT NULL DEFAULT FALSE,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_presas (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    presa_id   INTEGER NOT NULL REFERENCES presas(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, presa_id)
);

-- Personal: se agregan campos de identidad visual y protección, como en la
-- referencia (avatar de color, y el admin sembrado no se puede borrar/bloquear).
ALTER TABLE users ADD COLUMN IF NOT EXISTS color VARCHAR(20) NOT NULL DEFAULT 'primary';
ALTER TABLE users ADD COLUMN IF NOT EXISTS protected BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET protected = TRUE WHERE role = 'admin' AND protected = FALSE
    AND id = (SELECT MIN(id) FROM users WHERE role = 'admin');

-- ── Seed: mismo catálogo que ya estaba en shared/catalog.ts, ahora en BD ──
INSERT INTO categories (id, name, sort_order) VALUES
    (1, 'Pollos', 1), (2, 'Salchipapas', 2), (3, 'Bebidas', 3), (4, 'Extras', 4)
ON CONFLICT (id) DO NOTHING;
SELECT setval('categories_id_seq', GREATEST((SELECT MAX(id) FROM categories), 1));

INSERT INTO presas (id, name, recargo) VALUES
    (1, 'Pierna', 0), (2, 'Pecho', 0), (3, 'Ala', 0), (4, 'Mixto', 0)
ON CONFLICT (id) DO NOTHING;
SELECT setval('presas_id_seq', GREATEST((SELECT MAX(id) FROM presas), 1));

INSERT INTO products (id, category_id, name, base_price, requiere_presa) VALUES
    (1, 1, 'Cuarto de Pollo', 20.00, TRUE),
    (2, 1, 'Medio Pollo', 38.00, TRUE),
    (3, 1, 'Pollo Entero', 72.00, FALSE),
    (4, 2, 'Salchipapa Simple', 15.00, FALSE),
    (5, 2, 'Salchipapa Especial', 20.00, FALSE),
    (6, 2, 'Salchipapa Familiar', 35.00, FALSE),
    (7, 3, 'Gaseosa Personal', 5.00, FALSE),
    (8, 3, 'Gaseosa 1.5L', 10.00, FALSE),
    (9, 3, 'Jugo Natural', 8.00, FALSE),
    (10, 4, 'Ensalada', 5.00, FALSE),
    (11, 4, 'Porción Papa', 8.00, FALSE)
ON CONFLICT (id) DO NOTHING;
SELECT setval('products_id_seq', GREATEST((SELECT MAX(id) FROM products), 1));

INSERT INTO product_presas (product_id, presa_id)
    SELECT p.id, pr.id FROM products p CROSS JOIN presas pr WHERE p.id IN (1, 2)
ON CONFLICT DO NOTHING;
