# Running the Application

Make sure you have completed `INSTALL.md` (or run `setup.bat`) before continuing.

---

## Option A — Start Everything at Once (recommended)

From the `POC/` root folder:

```bash
npm start
```

This starts all four services in parallel using `concurrently`:

| Label | Service | URL |
|-------|---------|-----|
| `BACKEND` | FastAPI detection stream | http://localhost:8000 |
| `YOLO` | YOLO defect detection | http://localhost:5002 |
| `OCR` | Train number OCR | http://localhost:5000 |
| `FRONTEND` | React UI (Vite) | http://localhost:5173 |

Each service's logs are colour-coded in the terminal. Open **http://localhost:5173** in your browser.

---

## Option B — Start Services Individually

Open a separate terminal for each service.

### Frontend
```bash
cd ui
npm run dev
```
Open http://localhost:5173

### FastAPI Backend
```bash
cd backend
venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

### YOLO Service
```bash
cd backend\YOLO
venv\Scripts\python.exe server.py
```

### OCR Service
```bash
cd backend\OCR
venv\Scripts\python.exe server.py
```

---

## Pipeline Workflow

Once the UI is open, the pipeline runs in four stages:

```
S1  Video Framing     Upload a video and extract frames at a set interval / FPS
        ↓
S2  Bogie No. OCR     Upload the same video/image — detects the bogie number
        ↓
S3  Detection         YOLO runs defect detection on the extracted frames
        ↓
S4  Inspection Output Review detections, approve/flag results, export JSON or CSV
```

Use the **S1 / S2 / S3 / S4** buttons in the top-right corner to jump between stages during development.

---

## Health Checks

Verify each service is up before using the UI:

```bash
# FastAPI
curl http://localhost:8000/health

# YOLO  (expects a POST, a GET returns 405 — that means it is running)
curl http://localhost:5002/api/yolo/predict

# OCR   (same — 405 means it is running)
curl http://localhost:5000/api/ocr/image
```

---

## Common Issues

| Symptom | Fix |
|---------|-----|
| `venv\Scripts\python.exe` not found | Run `setup.bat` or follow `INSTALL.md` to create the venv |
| Port already in use | Kill the process on that port: `netstat -ano \| findstr :<PORT>` then `taskkill /PID <PID> /F` |
| OCR server crashes on startup | GPU / CUDA not available — replace `paddlepaddle-gpu` with `paddlepaddle` in `backend/OCR/requirements.txt` and reinstall |
| YOLO model not found | Place `best.pt` in `backend/models/` |
| Frontend shows blank page | Make sure `npm install` was run inside `ui/` |
| `concurrently` not found | Run `npm install` in the `POC/` root folder |
