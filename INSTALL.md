# Installation Guide

Run `setup.bat` first. If it fails, follow these steps manually.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.10 or higher | https://www.python.org/downloads/ |
| Node.js | 18 or higher | https://nodejs.org/ |
| Git | any | https://git-scm.com/ |

> **Windows**: when installing Python, tick **"Add Python to PATH"**.  
> Verify both are on PATH before continuing:
> ```
> python --version
> node --version
> ```

---

## Step 1 — Root (concurrently)

From the `POC/` root folder:

```bash
npm install
```

Installs `concurrently`, which is used to start all services with one command.

---

## Step 2 — Frontend

```bash
cd ui
npm install
cd ..
```

Installs React 19, Vite, Tailwind CSS, and Framer Motion.

---

## Step 3 — Backend (FastAPI · port 8000)

```bash
cd backend
python -m venv venv
venv\Scripts\pip install --upgrade pip
venv\Scripts\pip install -r requirements.txt
cd ..
```

**Packages installed:** `fastapi`, `uvicorn`, `opencv-python`, `numpy`, `requests`

---

## Step 4 — YOLO Service (port 5001)

```bash
cd backend\YOLO
python -m venv venv
venv\Scripts\pip install --upgrade pip
venv\Scripts\pip install -r requirements.txt
cd ..\..
```

**Packages installed:** `ultralytics`, `opencv-python`, `numpy`, `flask`, `flask-cors`

> `ultralytics` pulls in PyTorch. This step may take several minutes depending on your connection.  
> If you have an NVIDIA GPU and want GPU inference, install the CUDA-enabled torch first:
> ```
> venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
> ```
> Then install the rest of the requirements.

---

## Step 5 — OCR Service (port 5000)

```bash
cd backend\OCR
python -m venv venv
venv\Scripts\pip install --upgrade pip
venv\Scripts\pip install -r requirements.txt
cd ..\..
```

**Packages installed:** `paddlepaddle-gpu`, `paddleocr`, `opencv-python`, `numpy`, `flask`, `flask-cors`

> `paddlepaddle-gpu` requires a CUDA-compatible GPU and matching CUDA toolkit.  
> For CPU-only machines replace `paddlepaddle-gpu` with `paddlepaddle` in `backend/OCR/requirements.txt` before running the install.

---

## Verify Installation

After all steps, your folder structure should contain these virtual environments:

```
POC/
├── node_modules/          ← root npm packages
├── backend/
│   ├── venv/              ← FastAPI venv
│   └── YOLO/
│       └── venv/          ← YOLO venv
│   └── OCR/
│       └── venv/          ← OCR venv
└── ui/
    └── node_modules/      ← frontend npm packages
```

Once all venvs exist, proceed to `RUN.md`.
