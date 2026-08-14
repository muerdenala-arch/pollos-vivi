-- Script de datos iniciales (SEED) para el Sistema POS
-- Ejecutar DESPUÉS de aplicar schema.sql

-- ── Usuario Admin por defecto ─────────────────────────────────────────────────
-- Contraseña: admin123 (hashear en producción via bcrypt)
-- IMPORTANTE: Cambiar la contraseña luego de la primera sesión.
-- Hash bcrypt de "admin123":
INSERT INTO usuarios (nombre, username, hashed_password, rol) VALUES
('Administrador', 'admin', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'admin');

-- Usuario Cajero de prueba (contraseña: cajero123)
INSERT INTO usuarios (nombre, username, hashed_password, rol) VALUES
('Cajero Principal', 'cajero', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'cajero');

-- ── Categorías ────────────────────────────────────────────────────────────────
INSERT INTO categorias (nombre, descripcion) VALUES
('Pollos',      'Cuartos, medios y pollos enteros'),
('Salchipapas', 'Salchipapas simples y especiales'),
('Bebidas',     'Gaseosas, jugos y refrescos'),
('Extras',      'Adicionales y acompañamientos');

-- ── Presas ────────────────────────────────────────────────────────────────────
INSERT INTO presas (nombre, recargo) VALUES
('Pierna',  0.00),
('Pecho',   0.00),
('Ala',     0.00),
('Mixto',   0.00);

-- ── Productos de Pollo ────────────────────────────────────────────────────────
INSERT INTO productos (categoria_id, nombre, precio_base, requiere_presa) VALUES
(1, 'Cuarto de Pollo',    20.00, TRUE),
(1, 'Medio Pollo',        38.00, TRUE),
(1, 'Pollo Entero',       72.00, FALSE);

-- ── Salchipapas ───────────────────────────────────────────────────────────────
INSERT INTO productos (categoria_id, nombre, precio_base, requiere_presa) VALUES
(2, 'Salchipapa Simple',   15.00, FALSE),
(2, 'Salchipapa Especial', 20.00, FALSE),
(2, 'Salchipapa Familiar', 35.00, FALSE);

-- ── Bebidas ───────────────────────────────────────────────────────────────────
INSERT INTO productos (categoria_id, nombre, precio_base, requiere_presa) VALUES
(3, 'Gaseosa Personal',  5.00, FALSE),
(3, 'Gaseosa 1.5L',     10.00, FALSE),
(3, 'Jugo Natural',      8.00, FALSE);

-- ── Extras ────────────────────────────────────────────────────────────────────
INSERT INTO productos (categoria_id, nombre, precio_base, requiere_presa) VALUES
(4, 'Ensalada',    5.00, FALSE),
(4, 'Porción Papa', 8.00, FALSE);

-- ── Asociar presas a productos que las requieren ──────────────────────────────
-- Cuarto de Pollo (id=1) acepta todas las presas
INSERT INTO producto_presas (producto_id, presa_id)
SELECT 1, id FROM presas;

-- Medio Pollo (id=2) acepta todas las presas
INSERT INTO producto_presas (producto_id, presa_id)
SELECT 2, id FROM presas;
