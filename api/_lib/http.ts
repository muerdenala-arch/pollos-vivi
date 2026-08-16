import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AuthError } from "./auth";

/** Envuelve un handler async, atrapa errores y responde JSON consistente. */
export function withErrorHandling(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // CORS básico — el front y la API viven en el mismo dominio en producción,
    // pero se habilita para desarrollo local con `vite dev` en otro puerto.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    try {
      await handler(req, res);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : "Error interno";
      // eslint-disable-next-line no-console
      console.error("[api] error:", err);
      res.status(400).json({ error: message });
    }
  };
}
