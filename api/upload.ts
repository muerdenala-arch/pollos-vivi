import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "./_lib/http";
import { getAuthUser } from "./_lib/auth";
import { uploadDataUri } from "./_lib/cloudinary";

/**
 * Sube comprobantes de pago (capturas QR) a Cloudinary. Requiere sesión.
 * Nota: el límite de tamaño del body lo impone la plataforma de Vercel
 * (~4.5 MB por request en funciones serverless estándar); no hay forma de
 * ampliarlo desde código en este tipo de función.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  getAuthUser(req);

  const { dataUri, folder } = req.body ?? {};
  if (!dataUri || typeof dataUri !== "string" || !dataUri.startsWith("data:image/")) {
    res.status(400).json({ error: "Se esperaba una imagen en formato data URI" });
    return;
  }

  const url = await uploadDataUri(dataUri, folder === "qr" ? "qr" : "comprobantes");
  res.status(200).json({ url });
}

export default withErrorHandling(handler);
