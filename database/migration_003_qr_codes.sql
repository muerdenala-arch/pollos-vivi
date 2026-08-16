-- Migración 003 — Códigos QR de pago (múltiples, administrables)
-- Reemplaza el QR estático único (public/qr-pago.jpg) por N códigos QR
-- (uno por banco/billetera), igual que en el POS de referencia.

CREATE TABLE IF NOT EXISTS qr_codes (
    id             SERIAL PRIMARY KEY,
    alias          VARCHAR(100) NOT NULL,        -- ej. "Yape", "Cuenta Principal"
    bank_or_holder VARCHAR(150),                  -- ej. "BMSC — Titular Juan Pérez"
    image_url      VARCHAR(500) NOT NULL,         -- Cloudinary
    branch_id      INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qr_codes_branch ON qr_codes(branch_id, active);

-- Semilla: el QR que ya estaba en uso (public/qr-pago.jpg), para no dejar
-- el sistema sin ningún QR configurado tras la migración.
INSERT INTO qr_codes (alias, bank_or_holder, image_url, branch_id, active)
VALUES ('QR Principal', 'Pollos Vivi', '/qr-pago.jpg', 1, TRUE);
