# Pollos Vivi — POS v2.0

Sistema de punto de venta mobile-first para pollería, reescrito sobre:

- **Frontend:** React + TypeScript + Vite (SPA), en `/src`.
- **Backend:** funciones serverless de Vercel (Node/TypeScript), en `/api`.
- **Base de datos:** PostgreSQL en Neon (proyecto dedicado, separado de cualquier otro negocio).
- **Imágenes:** Cloudinary (comprobantes de pago QR).
- **Catálogo compartido:** `/shared/catalog.ts` — misma fuente de verdad para frontend y API, migrada 1:1 desde el sistema anterior (mismas categorías, productos, precios y presas).

## Desarrollo local

```bash
npm install
cp .env.example .env   # completar con tus credenciales reales
npm run dev            # sirve el frontend en :5173 (proxy /api → :3000)
```

Para probar las funciones `/api` localmente necesitas `vercel dev` (usa las mismas funciones que en producción) o levantar tu propio runner Node apuntando al puerto 3000.

## Variables de entorno

Ver `.env.example`. Se configuran en Vercel → Project Settings → Environment Variables:

- `DATABASE_URL` — cadena de conexión de Neon.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `JWT_SECRET` — clave para firmar las sesiones.

## Base de datos

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
```

Tablas: `branches`, `users` (PIN hasheado con bcrypt), `cash_registers` (apertura/cierre de caja, ya no vive en localStorage), `orders` (ítems como JSONB, precios recalculados y congelados en el servidor), `stock_inventory`.

## Build / despliegue

```bash
npm run build   # tsc -b (chequea /src y /api) + vite build → dist/
```

`vercel.json` enruta todo lo que no sea `/api/*` a la SPA (`dist/index.html`).

## Usuarios de prueba (seed)

- Admin — PIN `1234`
- Cajero — PIN `1111`

Cambiar estos PIN antes de usar en producción real.

## Fuera de alcance de esta reescritura

Para mantener el foco en lo pedido (endpoints `/api`, Neon, Cloudinary, mobile-first), quedaron fuera del sistema anterior: WebSockets en tiempo real, impresión automática de tickets y reportes avanzados. El módulo de caja/arqueo, en cambio, sí se corrigió: pasó de `localStorage` a la tabla `cash_registers` en Neon.
