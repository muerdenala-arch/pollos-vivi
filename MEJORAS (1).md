# 🚀 Mejoras aplicadas — Sistema POS v1.1.0

Documento de todos los cambios realizados sobre tu sistema original.
**Ningún endpoint, función ni acceso fue eliminado.** Se verificó de punta a
punta (crear catálogo → pedido → cobro → reporte) que todo sigue 100% funcional.

---

## 🔴 Correcciones críticas

### 1. `database/schema.sql` sincronizado con los modelos
El `schema.sql` original estaba **desincronizado** y creaba una base de datos
rota. Se regeneró por completo para coincidir exactamente con `app/models.py`:
- Se agregó la tabla **`usuarios`** (faltaba por completo).
- Se agregó la columna **`productos.requiere_presa`** (tu lógica de pedidos la usa).
- Se agregaron **`detalle_pedidos.nombre_producto_snapshot`** y **`nombre_presa_snapshot`**.
- Se agregó **`pedidos.cajero_id`**.
- Se corrigieron los tipos **ENUM** (`metodo_pago`, `estado_pago`, `rol_usuario`)
  para que coincidan con los Enum de Python.
- `pedidos.metodo_pago` ahora es NULL hasta el cobro (antes era NOT NULL, lo que
  impedía crear pedidos).

### 2. Archivos reconstruidos
`config.py` y `qr_service.py` no venían legibles en el `.rar` (compresión RAR5).
Se reconstruyeron a partir de su uso en el resto del código.
> ⚠️ **Revisa que coincidan con tus versiones originales**, sobre todo la ruta
> del QR en `qr_service.py` y las variables de `config.py`.

---

## ⚡ Rendimiento

### 3. Fin de la consulta N+1 al crear pedidos
En `crear_pedido`, antes se hacía 1 consulta por producto y 1 por presa **dentro
del bucle** (carrito de 8 ítems = hasta 16 viajes a la BD). Ahora se traen todos
los productos y presas en **2 consultas en bloque** con `IN (...)`.

### 4. Reportes con agregación en SQL (antes en Python)
`resumen_ventas_dia` cargaba TODOS los pedidos del día a memoria y los sumaba con
bucles de Python. Ahora los totales (COUNT, SUM por estado y por método de pago)
se calculan **dentro de PostgreSQL** con `SUM`/`CASE`, en 2 consultas agregadas.

### 5. Filtros por rango de fecha (usan índice)
Antes: `cast(creado_en, Date) == fecha` → anulaba el índice, escaneaba toda la
tabla. Ahora: `creado_en >= inicio AND creado_en < fin` → usa el índice nuevo.

### 6. `selectinload` en vez de `joinedload` para colecciones
En pedidos (`detalles`) e historial, `joinedload` sobre una relación
uno-a-muchos combinado con `.limit()` puede devolver un número incorrecto de
filas. Se cambió a `selectinload`, que es correcto y más eficiente para
colecciones. Igual para `productos.presas_disponibles` (muchos-a-muchos).

### 7. Índices nuevos en la base de datos
- `pedidos.creado_en` (lo usan todos los reportes)
- `pedidos(estado, creado_en)` — índice compuesto para filtros combinados
- `pedidos.estado`, `pedidos.cajero_id`
- `pagos.pedido_id` (usado en el JOIN de reportes)
- `detalle_pedidos.pedido_id`, `producto_id`, `presa_id`
- `productos.categoria_id`

### 8. Compresión GZip
Las respuestas grandes (catálogo, historial de pedidos) ahora viajan comprimidas
al navegador (> 1 KB), reduciendo el tiempo de carga en el POS.

---

## 🎨 Diseño y utilidad

### 9. CORS configurable y correcto
Antes: `allow_origins=["*"]` + `allow_credentials=True` es una combinación
**inválida** que los navegadores rechazan. Ahora se lee desde `.env`
(`CORS_ORIGINS`). En desarrollo (`*`) funciona con Bearer token; en producción
puedes poner tus dominios reales y se activan credenciales automáticamente.

### 10. Health-check real
`/health` ahora verifica de verdad la conexión a la base de datos y responde
`degraded` si está caída (útil para monitoreo).

### 11. Limpieza de archivos duplicados
Se eliminaron `backend/models.py` y `backend/webhook.py`, que eran copias
huérfanas y sin uso (los reales están en `backend/app/`).

### 12. `.gitignore`
Nuevo archivo para no subir a git: `venv/`, `__pycache__/`, `.env` (¡tiene tu
contraseña!) y los comprobantes subidos.

### 13. Robustez de conexión
`pool_recycle=1800` en el engine para evitar cortes tras conexiones inactivas.

---

## 🔐 Seguridad — ACCIÓN REQUERIDA DE TU PARTE

1. **`SECRET_KEY` sigue con el valor de ejemplo** (`CAMBIA_ESTO_...`). Genera una
   clave real y ponla en tu `.env`:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```
2. Tu `.env` contiene la contraseña de la base de datos. Ya está en `.gitignore`,
   pero si alguna vez lo subiste a git, **cambia esa contraseña**.
3. En producción, activa la validación de firma HMAC en el webhook
   (`routers/webhooks.py`, ya está comentado dónde).

---

## ▶️ Cómo levantar el sistema (recordatorio)

El entregable **no incluye** la carpeta `venv/` (nunca debe compartirse; es
pesada y específica de cada máquina). Recréala así:

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Luego abre: http://localhost:8000/static/login.html

---

# 🎨 Rediseño del Frontend (v1.1 "Brasa")

Se modernizó por completo la capa visual **sin tocar el JavaScript ni cambiar
un solo ID o nombre de clase** — por lo que toda la funcionalidad se conserva
idéntica. Solo cambió el CSS (y los estilos incrustados de `cliente.html`).

### Nueva identidad visual
- **Paleta cálida "espresso + brasa + miel"** en lugar del azul-pizarra frío
  anterior. Es más apetitosa y apropiada para un negocio de comida, y se lee
  mejor bajo la luz de un local.
- **Tipografía con carácter:** se sumó *Bricolage Grotesque* como fuente
  *display* para la marca, títulos, precios y totales (el "héroe" de un POS),
  manteniendo *Inter* para la interfaz.
- **Acento brasa (#ee5d29) + miel dorada (#f7b32b)** con degradados y un halo
  ambiental sutil de fondo.

### Detalles y calidad
- **Números tabulares** en precios y totales (ya no "saltan" al cambiar).
- **Micro-interacciones** afinadas: elevación en tarjetas de producto, halo al
  pasar el cursor, resalte al agregar al carrito (`card-pulse`, que además
  faltaba en el CSS y el JS ya la usaba).
- **Foco visible por teclado** en todos los controles (accesibilidad).
- **Soporte de `prefers-reduced-motion`**: respeta a quienes prefieren menos
  animación.
- **Diseño responsivo**: el POS y el panel admin ahora se adaptan a pantallas
  más angostas (tablets).
- Se corrigió un bug: `cliente.html` usaba la animación `fadeInUp` que no estaba
  disponible ahí; se movieron las animaciones comunes a `main.css`.

### Archivos afectados (solo CSS + estilos incrustados)
`css/main.css`, `css/pos.css`, `css/login.css`, `css/admin.css`,
y el bloque `<style>` de `cliente.html`.
