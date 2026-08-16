import { v2 as cloudinary } from "cloudinary";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Faltan credenciales de Cloudinary");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

/**
 * Sube una imagen (data URI base64, ej. "data:image/png;base64,....") a Cloudinary.
 * Usado para comprobantes de pago QR. Devuelve la URL segura (https).
 */
export async function uploadDataUri(dataUri: string, folder: string): Promise<string> {
  ensureConfigured();
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `pollos-vivi/${folder}`,
    resource_type: "image",
  });
  return result.secure_url;
}
