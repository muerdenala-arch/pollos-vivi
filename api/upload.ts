import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandling } from "./_lib/http";
import { getAuthUser } from "./_lib/auth";
import { uploadDataUri } from "./_lib/cloudinary";

export const config = {
  api: {
    bodyParser: { sizeLimit: "8mb" }, // fotos de comprobantes QR
  },
};

/** Sube comprobantes de pago (capturas QR) a Cloudinary. Requiere sesión. */
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
