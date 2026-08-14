"""
FastAPI App Principal — Sistema POS Pollo & Salchipapas
Ing. Rodrigo Zambrana Martinez

MEJORAS:
- CORS configurable desde .env (arregla la combinación inválida
  allow_origins=["*"] + allow_credentials=True que los navegadores rechazan).
- Compresión GZip: respuestas grandes (catálogo, historial) viajan comprimidas.
- Health-check /health con verificación real de la base de datos.
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from .config import get_settings
from .database import engine
from .models import Base
from .services.ws_manager import manager
from .routers import auth, categorias, productos, pedidos, pagos, webhooks, reportes, config

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: crear tablas si no existen y directorios de uploads."""
    try:
        Base.metadata.create_all(bind=engine)
        print("[OK] Tablas de PostgreSQL verificadas/creadas")
    except OperationalError as e:
        safe_err = str(e).encode('ascii', errors='replace').decode('ascii')
        print(f"[WARN] No se pudo conectar a PostgreSQL: {safe_err}")
        print("   Verifica DATABASE_URL en el archivo .env")

    # Crear directorios necesarios
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(f"{settings.upload_dir}/comprobantes").mkdir(parents=True, exist_ok=True)
    print(f"[OK] Directorio de uploads: {settings.upload_dir}")

    yield
    print("[--] Sistema POS apagado.")


class CachedStaticFiles(StaticFiles):
    """
    StaticFiles con Cache-Control. Evita que el navegador tenga que volver a
    pedir el logo, el QR de pago, el CSS y el JS en cada navegación entre
    páginas (login -> index -> admin son recargas completas de página).
    """

    def __init__(self, *args, cache_max_age: int = 3600, **kwargs):
        super().__init__(*args, **kwargs)
        self._cache_max_age = cache_max_age

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers.setdefault("Cache-Control", f"public, max-age={self._cache_max_age}")
        return response


app = FastAPI(
    title="Sistema POS — Pollo & Salchipapas",
    description="API REST + WebSocket para gestión de punto de venta. Ing. Rodrigo Zambrana Martinez.",
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Si CORS_ORIGINS = "*" (desarrollo): sin credenciales (combo válido y suficiente,
# porque la app autentica con Bearer token en el header, no con cookies).
# Si se configuran dominios concretos: se habilitan credenciales.
_origins = settings.cors_origins_list
_allow_credentials = _origins != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Compresión GZip (respuestas > 1 KB) ──────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1024)

# ─── Archivos estáticos ───────────────────────────────────────────────────────
frontend_path = Path(__file__).parent.parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/static", CachedStaticFiles(directory=str(frontend_path), cache_max_age=3600), name="static")

uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", CachedStaticFiles(directory=str(uploads_path), cache_max_age=300), name="uploads")

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(pedidos.router)
app.include_router(pagos.router)
app.include_router(webhooks.router)
app.include_router(reportes.router)
app.include_router(config.router)


# ─── WebSocket Endpoints ──────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_global(websocket: WebSocket):
    """
    WebSocket global — Pantalla del cajero y pantalla del cliente se conectan aquí.
    Recibe eventos: pago_completado, pago_fallido.
    """
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Mantener conexión viva
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.websocket("/ws/pedido/{pedido_id}")
async def websocket_pedido(websocket: WebSocket, pedido_id: int):
    """WebSocket específico por pedido — Pantalla del cliente con QR."""
    await manager.connect(websocket, pedido_id=pedido_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, pedido_id=pedido_id)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": settings.app_name, "version": "1.1.0", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health():
    """Health-check con verificación real de la conexión a la base de datos."""
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {"status": "healthy" if db_ok else "degraded", "database": "ok" if db_ok else "down"}
