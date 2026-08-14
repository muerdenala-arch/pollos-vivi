@echo off
echo ================================================
echo   Sistema POS - Pollo y Salchipapas
echo   Ing. Rodrigo Zambrana Martinez
echo ================================================
echo.

:: Verificar que Python esté disponible
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no está instalado o no está en el PATH.
    pause
    exit /b 1
)

:: Ir al directorio del backend
cd /d "%~dp0backend"

:: Crear entorno virtual si no existe
if not exist "venv\" (
    echo [1/4] Creando entorno virtual Python...
    python -m venv venv
)

:: Activar entorno virtual
echo [2/4] Activando entorno virtual...
call venv\Scripts\activate.bat

:: Instalar dependencias
echo [3/4] Instalando dependencias...
pip install -r requirements.txt --quiet

:: Copiar .env si no existe
if not exist ".env" (
    echo [!] Archivo .env no encontrado. Copiando desde .env.example...
    copy .env.example .env
    echo [!] IMPORTANTE: Edita el archivo backend\.env con tu DATABASE_URL y SECRET_KEY.
    pause
)

:: Crear directorio de uploads
if not exist "uploads\" mkdir uploads
if not exist "uploads\comprobantes\" mkdir uploads\comprobantes

:: Iniciar servidor FastAPI
echo [4/4] Iniciando servidor FastAPI en http://localhost:8000 ...
echo.
echo  Swagger UI:   http://localhost:8000/docs
echo  POS Cajero:   http://localhost:8000/static/index.html
echo  Panel Admin:  http://localhost:8000/static/admin.html
echo  Pantalla QR:  http://localhost:8000/static/cliente.html
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
