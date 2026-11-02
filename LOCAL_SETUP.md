# Local Setup & Operational Guide: Bus Tracking & ML ETA Prediction System

This guide outlines the complete setup, configuration, running, and troubleshooting procedures for running the Bus Tracking & Machine Learning Arrival Prediction platform on Windows localhost.

---

## 1. Project Overview & Architecture

- **Backend:** FastAPI (Python 3.13 / 3.14), SQLAlchemy ORM, Uvicorn, WebSockets.
- **Frontend:** React 19, Vite, Tailwind CSS v4, React-Leaflet, Axios, Lucide Icons.
- **Machine Learning Engine:** Scikit-Learn (`RandomForestRegressor` for arrival delays, `GradientBoostingClassifier` for crowd levels), NumPy, Pandas, Joblib.
- **Database:** SQLite (`bus_tracker.db` pre-populated with users, stops, and timetable data).
- **Mobile Container:** Capacitor (Android targets configured).

---

## 2. Software Requirements & System Prerequisites

| Tool | Recommended / Detected Version | Purpose |
|---|---|---|
| **Python** | Python 3.13 or 3.14 (64-bit) | FastAPI backend & ML inference |
| **Node.js** | Node.js v20.x or v22.x | Frontend build tool and Vite dev server |
| **npm** | npm 10.x | Node package manager (`npm.cmd` on Windows) |
| **Git** | Git 2.x | Version control |
| **SQLite3** | Embedded (Standard Python library) | Local persistence (`bus_tracker.db`) |

---

## 3. Environment Variables Configuration

### Backend (`backend/.env`)
Ensure the following variables are defined in `backend/.env`:
```env
SECRET_KEY=dev_secret_key_bus_tracker_987654321
DATABASE_URL=sqlite:///./bus_tracker.db
CORS_ORIGINS=http://localhost:5173,capacitor://localhost,http://localhost,http://127.0.0.1:5173
```

### Frontend (`frontend/.env`)
Ensure the following variables are defined in `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

---

## 4. Dependencies Installation

### Backend
1. Open PowerShell or Command Prompt and navigate to `backend`:
   ```powershell
   cd backend
   ```
2. Create or activate the virtual environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1   # or .venv\Scripts\activate.bat in cmd
   ```
3. Install required packages:
   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

### Frontend
1. Navigate to `frontend`:
   ```powershell
   cd frontend
   ```
2. Install dependencies:
   ```powershell
   npm.cmd install
   ```

---

## 5. Starting the Application

### Option A: One-Click Startup (Recommended)
Double-click `start-dev.bat` in the project folder (or run `.\start-dev.bat` from your terminal).
This will:
1. Verify virtualenv and `node_modules`.
2. Launch the FastAPI backend on port `8000` in a dedicated console window.
3. Launch the Vite React frontend on port `5173` in a dedicated console window.

To stop both services, simply run:
```powershell
.\stop-dev.bat
```

### Option B: Manual Command-Line Startup

#### Terminal 1 — Backend:
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Terminal 2 — Frontend:
```powershell
cd frontend
npm.cmd run dev
```

---

## 6. Access Endpoints & URLs

| Interface | URL | Description |
|---|---|---|
| **Frontend Web Application** | [http://localhost:5173](http://localhost:5173) | Passenger & Driver interactive portals |
| **Backend API Health Check** | [http://localhost:8000/health](http://localhost:8000/health) | Verifies server readiness |
| **Interactive API Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI for testing all REST endpoints |
| **Alternative Docs (ReDoc)** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Clean schema & data contract reference |

---

## 7. Testing & Verification Commands

### Run ML & Route Pipeline Validation
Runs 40 test cases covering route timetable lookups, intermediate stops, delays, passenger wait times, and crowd classifications:
```powershell
cd backend
.\.venv\Scripts\python.exe test_pipeline_validation.py
```

### Frontend Type-Check & Production Build
```powershell
cd frontend
npm.cmd run build
```

---

## 8. Common Troubleshooting & Solutions

### 1. PowerShell Execution Policy Restriction on `npm`
- **Symptom:** `File npm.ps1 cannot be loaded because running scripts is disabled on this system.`
- **Fix:** Use `npm.cmd` instead of `npm` in PowerShell, or execute through `start-dev.bat`.

### 2. Port Already in Use (8000 or 5173)
- **Symptom:** `[Errno 10048] error while attempting to bind on address ('0.0.0.0', 8000)` or Vite switches to 5174.
- **Fix:** Run `.\stop-dev.bat` to release lingering processes, or run:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
  ```

### 3. Model Unpickling Version Warnings
- **Symptom:** `InconsistentVersionWarning: Trying to unpickle estimator ... from version 1.9.0 when using version 1.9.1.`
- **Status:** Expected and harmless. The models are fully functional and pass all 40/40 pipeline tests. To retrain cleanly using your current library version:
  ```powershell
  cd backend
  .\.venv\Scripts\python.exe scripts\train_models.py
  ```

### 4. Database Reset / Migrations
- The app automatically initializes tables on startup via `Base.metadata.create_all(bind=engine)`.
- If you ever need to reset the SQLite database, simply delete `backend/bus_tracker.db` and re-run the backend.
