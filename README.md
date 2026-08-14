# 🍗 Sistema POS — Pollo & Salchipapas

**Sistema de Gestión y Punto de Venta (POS) Web**  
**Ingeniero:** Rodrigo Zambrana Martinez  
**Versión:** 1.0.0 | **Stack:** FastAPI + PostgreSQL + Vanilla HTML/CSS/JS

---

## 📁 Estructura del Proyecto

```
Sistema_Pollo/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + WebSocket
│   │   ├── config.py            # Variables de entorno
│   │   ├── database.py          # SQLAlchemy engine
│   │   ├── models.py            # ORM (Usuarios, Productos, Pedidos, Pagos)
│   │   ├── schemas.py           # Validación Pydantic
│   │   ├── routers/
│   │   │   ├── auth.py          # Login JWT + Crear usuarios
│   │   │   ├── categorias.py    # CRUD Categorías
│   │   │   ├── productos.py     # CRUD Productos + Presas
│   │   │   ├── pedidos.py       # Crear y gestionar pedidos
│   │   │   ├── pagos.py         # QR, Efectivo, Comprobante
│   │   │   ├── reportes.py      # Ventas del día + Historial
│   │   │   └── webhooks.py      # Confirmación pago QR (pasarela)
│   │   └── services/
│   │       ├── auth_service.py  # JWT, bcrypt, guards de rol
│   │       ├── qr_service.py    # Servicio QR estático
│   │       └── ws_manager.py    # WebSocket en tiempo real
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── login.html               # 🔐 Login (cajero y admin)
│   ├── index.html               # 🖥️  POS Principal (Cajero)
│   ├── admin.html               # ⚙️  Panel Administración
│   ├── cliente.html             # 📱 Pantalla del Cliente (QR)
│   ├── css/
│   │   ├── main.css             # Design System global
│   │   ├── login.css
│   │   ├── pos.css
│   │   └── admin.css
│   └── js/
│       ├── api.js               # Cliente HTTP centralizado
│       ├── websocket.js         # Cliente WebSocket
│       ├── pos.js               # Lógica carrito y catálogo
│       ├── pagos.js             # Flujos de cobro
│       └── utils.js             # Utilidades compartidas
│
├── database/
│   ├── schema.sql               # Esquema PostgreSQL completo
│   └── seed.sql                 # Datos iniciales de prueba
│
└── iniciar_servidor.bat         # ▶️  Inicio rápido (Windows)
```

---

## 🚀 Instalación y Puesta en Marcha

### Requisitos Previos
- Python 3.10+ instalado
- PostgreSQL 14+ en ejecución
- (Opcional) pgAdmin o DBeaver para gestionar la BD

### Paso 1: Configurar la Base de Datos

```sql
-- En PostgreSQL, crear la base de datos:
CREATE DATABASE pos_pollo;

-- Aplicar el esquema:
\i database/schema.sql

-- (Opcional) Cargar datos de prueba:
\i database/seed.sql
```

### Paso 2: Configurar Variables de Entorno

```bash
# Copiar el archivo de configuración:
copy backend\.env.example backend\.env

# Editar backend\.env con tu editor:
# DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/pos_pollo
# SECRET_KEY=genera_una_clave_aleatoria_segura
```

### Paso 3: Iniciar el Sistema

**Opción A — Doble clic:**
```
iniciar_servidor.bat
```

**Opción B — Manual:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Paso 4: Acceder al Sistema

| Pantalla | URL |
|---|---|
| 📖 Documentación API | http://localhost:8000/docs |
| 🔐 Login | http://localhost:8000/static/login.html |
| 🖥️ POS Cajero | http://localhost:8000/static/index.html |
| ⚙️ Administración | http://localhost:8000/static/admin.html |
| 📱 Pantalla Cliente | http://localhost:8000/static/cliente.html |

### Credenciales por Defecto (datos seed)

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `cajero` | `cajero123` | Cajero |

> ⚠️ **Cambia las contraseñas en producción** usando el endpoint `POST /api/v1/auth/usuarios`.

---

## 💡 Flujo de Uso

### Flujo del Cajero
1. Iniciar sesión en `/login.html`
2. En la pantalla POS:
   - Seleccionar categoría (izquierda)
   - Tocar producto → Si requiere presa, seleccionarla en el modal
   - Revisar carrito (derecha) con totales automáticos en **Bs.**
3. Cobrar:
   - **Efectivo:** Ingresar monto recibido → El sistema calcula cambio
   - **QR:** Se muestra el código QR del negocio → Al recibir el pago, el estado se actualiza automáticamente por WebSocket

### Configurar el QR de Pago (Admin)
1. Entrar al Panel Admin → "Configurar QR"
2. Subir la imagen de tu código QR de Yape/Plin/BCP
3. El QR aparecerá en la pantalla del cliente al cobrar

---

## 🔧 Endpoints Principales (API)

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/v1/auth/login` | Login, retorna JWT |
| GET | `/api/v1/categorias` | Lista categorías |
| GET | `/api/v1/productos` | Lista productos con presas |
| POST | `/api/v1/pedidos` | Crear pedido (calcula precios desde BD) |
| POST | `/api/v1/pagos/efectivo/{id}` | Registrar pago en efectivo |
| POST | `/api/v1/pagos/qr/{id}` | Iniciar cobro con QR |
| POST | `/api/v1/webhooks/pagos/qr` | Webhook de pasarela (confirmar pago) |
| GET | `/api/v1/reportes/ventas/dia` | Resumen de ventas del día |
| WS | `ws://localhost:8000/ws` | WebSocket tiempo real (cajero) |

---

## 🔮 Próximos Pasos (Roadmap)

- [ ] Conectar pasarela QR dinámica real (Yape/Plin Business API)
- [ ] Módulo de Alembic para migraciones versionadas
- [ ] Tests unitarios con pytest
- [ ] Dockerizar para despliegue en la nube
- [ ] Dashboard con gráficos de ventas semanales/mensuales
