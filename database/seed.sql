-- Datos iniciales — ejecutar DESPUÉS de schema.sql
-- Los PIN se hashean en el propio SQL con pgcrypto (bcrypt), compatible con
-- bcryptjs en las funciones /api. CAMBIAR los PIN por defecto en producción.

INSERT INTO branches (name, address, phone, is_active) VALUES
('Sucursal Principal', 'Av. Principal S/N', '70000000', TRUE);

-- Admin: PIN 1234 — protegido (no se puede borrar/bloquear desde el panel)
INSERT INTO users (name, role, pin_hash, branch_id, status, color, protected) VALUES
('Administrador', 'admin', crypt('1234', gen_salt('bf')), 1, TRUE, 'primary', TRUE);

-- Cajero: PIN 1111
INSERT INTO users (name, role, pin_hash, branch_id, status, color) VALUES
('Cajero Principal', 'cajero', crypt('1111', gen_salt('bf')), 1, TRUE, 'secondary');

-- Stock básico de referencia (ajustar a la realidad del local)
INSERT INTO stock_inventory (branch_id, item_name, quantity, min_stock, unit) VALUES
(1, 'Pollo (unidades)', 40, 10, 'unidad'),
(1, 'Papa (kg)',         25, 5,  'kg'),
(1, 'Aceite (L)',        10, 2,  'L'),
(1, 'Envases delivery',  100, 20, 'unidad');

-- ── Catálogo (categorías, productos, presas) ──────────────────────────────
INSERT INTO categories (id, name, sort_order) VALUES
    (1, 'Pollos', 1), (2, 'Salchipapas', 2), (3, 'Bebidas', 3), (4, 'Extras', 4);
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

INSERT INTO presas (id, name, recargo) VALUES
    (1, 'Pierna', 0), (2, 'Pecho', 0), (3, 'Ala', 0), (4, 'Mixto', 0);
SELECT setval('presas_id_seq', (SELECT MAX(id) FROM presas));

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
    (11, 4, 'Porción Papa', 8.00, FALSE);
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

INSERT INTO product_presas (product_id, presa_id)
    SELECT p.id, pr.id FROM products p CROSS JOIN presas pr WHERE p.id IN (1, 2);

-- ── QR de pago ─────────────────────────────────────────────────────────────
-- Sin semilla: no hay ningún QR "de fábrica". Se agregan desde el panel
-- admin (pestaña "Códigos QR"), subiendo la imagen real a Cloudinary.
