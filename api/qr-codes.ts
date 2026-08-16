import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "./_lib/http";
import { query, queryOne, withTransaction } from "./_lib/db";
import { getAuthUser, requireAdmin } from "./_lib/auth";

interface QrCodeRow {
  id: number;
  alias: string;
  bank_or_holder: string | null;
  image_url: string;
  branch_id: number | null;
  active: boolean;
  is_default: boolean;
}

const SELECT_QR = `id, alias, bank_or_holder, image_url, branch_id, active, is_default`;

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const user = getAuthUser(req);
    // El POS solo necesita los activos (con el default primero); el panel admin pide todos con ?all=1
    const showAll = req.query.all === "1" && user.role === "admin";
    const rows = showAll
      ? await query<QrCodeRow>(`SELECT ${SELECT_QR} FROM qr_codes ORDER BY is_default DESC, id`)
      : await query<QrCodeRow>(`SELECT ${SELECT_QR} FROM qr_codes WHERE active = TRUE ORDER BY is_default DESC, id`);
    res.status(200).json(rows);
    return;
  }

  if (req.method === "POST") {
    requireAdmin(req);
    const { alias, bank_or_holder, image_url, branch_id, is_default } = req.body ?? {};
    if (!alias || !image_url) {
      res.status(400).json({ error: "alias e image_url son obligatorios" });
      return;
    }
    const row = await withTransaction(async (client) => {
      if (is_default) {
        await client.query(`UPDATE qr_codes SET is_default = FALSE WHERE is_default = TRUE`);
      }
      const inserted = await client.query<QrCodeRow>(
        `INSERT INTO qr_codes (alias, bank_or_holder, image_url, branch_id, is_default)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SELECT_QR}`,
        [alias, bank_or_holder ?? null, image_url, branch_id ?? null, !!is_default]
      );
      return inserted.rows[0];
    });
    res.status(201).json(row);
    return;
  }

  if (req.method === "PATCH") {
    requireAdmin(req);
    const { id, alias, bank_or_holder, image_url, active, is_default } = req.body ?? {};
    if (!id) {
      res.status(400).json({ error: "id es obligatorio" });
      return;
    }
    const row = await withTransaction(async (client) => {
      if (is_default === true) {
        await client.query(`UPDATE qr_codes SET is_default = FALSE WHERE is_default = TRUE AND id <> $1`, [id]);
      }
      const updated = await client.query<QrCodeRow>(
        `UPDATE qr_codes SET
           alias = COALESCE($2, alias),
           bank_or_holder = COALESCE($3, bank_or_holder),
           image_url = COALESCE($4, image_url),
           active = COALESCE($5, active),
           is_default = COALESCE($6, is_default)
         WHERE id = $1
         RETURNING ${SELECT_QR}`,
        [id, alias ?? null, bank_or_holder ?? null, image_url ?? null, active ?? null, is_default ?? null]
      );
      return updated.rows[0];
    });
    if (!row) {
      res.status(404).json({ error: "Código QR no encontrado" });
      return;
    }
    res.status(200).json(row);
    return;
  }

  res.status(405).json({ error: "Método no permitido" });
}

export default withErrorHandling(handler);
