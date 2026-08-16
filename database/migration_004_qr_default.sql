-- Migración 004 — QR por defecto
-- Agrega la bandera de "QR por defecto" (el que se le muestra al cajero
-- primero cuando hay varios activos). Solo puede haber uno a la vez; se
-- controla desde la aplicación (api/qr-codes.ts), no con un constraint,
-- porque Postgres no soporta índices únicos parciales condicionados a otra
-- fila fácilmente sin WHERE — se resuelve en transacción en el backend.

ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Si ya hay códigos activos y ninguno por defecto, marca el primero como tal.
UPDATE qr_codes SET is_default = TRUE
WHERE id = (SELECT id FROM qr_codes WHERE active = TRUE ORDER BY id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM qr_codes WHERE is_default = TRUE);
