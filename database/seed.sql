-- Datos iniciales — ejecutar DESPUÉS de schema.sql
-- Los PIN se hashean en el propio SQL con pgcrypto (bcrypt), compatible con
-- bcryptjs en las funciones /api. CAMBIAR los PIN por defecto en producción.

INSERT INTO branches (name, address, phone, is_active) VALUES
('Sucursal Principal', 'Av. Principal S/N', '70000000', TRUE);

-- Admin: PIN 1234
INSERT INTO users (name, role, pin_hash, branch_id, status) VALUES
('Administrador', 'admin', crypt('1234', gen_salt('bf')), 1, TRUE);

-- Cajero: PIN 1111
INSERT INTO users (name, role, pin_hash, branch_id, status) VALUES
('Cajero Principal', 'cajero', crypt('1111', gen_salt('bf')), 1, TRUE);

-- Stock básico de referencia (ajustar a la realidad del local)
INSERT INTO stock_inventory (branch_id, item_name, quantity, min_stock, unit) VALUES
(1, 'Pollo (unidades)', 40, 10, 'unidad'),
(1, 'Papa (kg)',         25, 5,  'kg'),
(1, 'Aceite (L)',        10, 2,  'L'),
(1, 'Envases delivery',  100, 20, 'unidad');
