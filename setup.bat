@echo off
setlocal EnableDelayedExpansion

echo.
echo  ============================================================
echo   Vande Bharat MVIS - POC Setup
echo   Installs all dependencies for every service
echo  ============================================================
echo.

:: ── Locate Python ────────────────────────────────────────────────────────────
set PYTHON=
for %%P in (python python3) do (
    if "!PYTHON!"=="" (
        where %%P >nul 2>&1
        if !errorlevel! == 0 (
            set PYTHON=%%P
        )
    )
)
if "!PYTHON!"=="" (
    echo [ERROR] Python not found in PATH.
    echo         Install Python 3.10+ from https://www.python.org/downloads/
    echo         and make sure to tick "Add Python to PATH" during install.
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('!PYTHON! --version 2^>^&1') do echo [OK] Found !PYTHON! - %%V

:: ── Locate Node / npm ────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found in PATH.
    echo         Install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('node --version') do echo [OK] Found Node.js %%V
for /f "tokens=*" %%V in ('npm --version')  do echo [OK] Found npm v%%V

echo.
echo  ── Step 1 / 5 : Root (concurrently) ────────────────────────
echo.
call npm install
if %errorlevel% neq 0 ( echo [ERROR] Root npm install failed. & pause & exit /b 1 )
echo [OK] Root packages installed.

echo.
echo  ── Step 2 / 5 : Frontend (React / Vite) ────────────────────
echo.
pushd ui
call npm install
if %errorlevel% neq 0 ( echo [ERROR] Frontend npm install failed. & popd & pause & exit /b 1 )
popd
echo [OK] Frontend packages installed.

echo.
echo  ── Step 3 / 5 : Backend - FastAPI  (port 8000) ─────────────
echo.
pushd backend
if not exist venv (
    echo Creating virtual environment...
    !PYTHON! -m venv venv
    if !errorlevel! neq 0 ( echo [ERROR] venv creation failed. & popd & pause & exit /b 1 )
)
echo Installing Python packages...
call venv\Scripts\pip install --upgrade pip -q
call venv\Scripts\pip install -r requirements.txt
if %errorlevel% neq 0 ( echo [ERROR] Backend pip install failed. & popd & pause & exit /b 1 )
popd
echo [OK] Backend (FastAPI) packages installed.

echo.
echo  ── Step 4 / 5 : YOLO Service (port 5001) ───────────────────
echo.
pushd backend\YOLO
if not exist venv (
    echo Creating virtual environment...
    !PYTHON! -m venv venv
    if !errorlevel! neq 0 ( echo [ERROR] venv creation failed. & popd & pause & exit /b 1 )
)
echo Installing Python packages (ultralytics + torch may take a few minutes)...
call venv\Scripts\pip install --upgrade pip -q
call venv\Scripts\pip install -r requirements.txt
if %errorlevel% neq 0 ( echo [ERROR] YOLO pip install failed. & popd & pause & exit /b 1 )
popd
echo [OK] YOLO service packages installed.

echo.
echo  ── Step 5 / 5 : OCR Service (port 5000) ────────────────────
echo.
pushd backend\OCR
if not exist venv (
    echo Creating virtual environment...
    !PYTHON! -m venv venv
    if !errorlevel! neq 0 ( echo [ERROR] venv creation failed. & popd & pause & exit /b 1 )
)
echo Installing Python packages (PaddleOCR may take a few minutes)...
call venv\Scripts\pip install --upgrade pip -q
call venv\Scripts\pip install -r requirements.txt
if %errorlevel% neq 0 ( echo [ERROR] OCR pip install failed. & popd & pause & exit /b 1 )
popd
echo [OK] OCR service packages installed.

echo.
echo  ============================================================
echo   All dependencies installed successfully!
echo.
echo   To start all services run:
echo       npm start
echo.
echo   Individual services:
echo       npm run backend    FastAPI       http://localhost:8000
echo       npm run yolo       YOLO          http://localhost:5001
echo       npm run ocr        OCR           http://localhost:5000
echo       npm run frontend   React/Vite    http://localhost:5173
echo  ============================================================
echo.
pause
