# 🚌 Bus Tracking & ML ETA Prediction System

A full-stack real-time bus tracking and machine learning arrival prediction platform for the **Belman ↔ Udupi** corridor.

---

## 🏗️ Architecture

- **Frontend:** React 19 (Vite, Tailwind CSS, React-Leaflet, WebSockets, Lucide Icons)
- **Mobile Container:** Capacitor (Android Native, `@capacitor/geolocation`)
- **Backend:** FastAPI (Python 3.13), SQLAlchemy (SQLite), Uvicorn, WebSockets
- **Machine Learning:** Scikit-Learn (`RandomForestRegressor` for Delays, `GradientBoostingClassifier` for Crowd Level)
- **Corridor & Fleet:** 9 stops (*Belman, Jantra, Shirva, Bantakal, SMVITM, Shankarpura, Subhasnagara, Katpadi, Udupi*) across 18 unique buses.

---

## 🚀 Part 1: Backend Deployment Guide

### A. Environment Configuration (`backend/.env`)
Create/edit `backend/.env` with your deployment variables:

```env
SECRET_KEY=your_production_secret_key_change_me
DATABASE_URL=sqlite:///./bus_tracker.db
CORS_ORIGINS=http://localhost:5173,capacitor://localhost,http://localhost,https://your-frontend-domain.com
```

> **Database Note:** SQLite is preconfigured and optimal for demo, development, and single-instance deployments. For high-concurrency production deployments with dozens of drivers streaming simultaneous GPS updates, simply update `DATABASE_URL` to a PostgreSQL connection string (e.g. `postgresql://user:password@host:5432/dbname`) without modifying any application code.

### B. Docker Build & Run
To run the backend inside Docker:

```bash
cd backend
docker build -t bus-tracker-api .
docker run -d -p 8000:8000 --name bus-tracker-backend bus-tracker-api
```

Health check verification:
```bash
curl http://localhost:8000/health
# Output: {"status": "ok"}
```

---

## 📱 Part 2: Capacitor Android Mobile App (Target: Vivo Y31 / Android)

### A. Environment Setup (`frontend/.env.production`)
Before building the APK, configure `frontend/.env.production` to point to your deployed backend or local Wi-Fi IP:

```env
# For local testing on Vivo Y31 over the same Wi-Fi network:
VITE_API_BASE_URL=http://192.168.1.XXX:8000
VITE_WS_BASE_URL=ws://192.168.1.XXX:8000

# For cloud production deployment:
# VITE_API_BASE_URL=https://your-backend-api.onrender.com
# VITE_WS_BASE_URL=wss://your-backend-api.onrender.com
```

### B. Build Web Assets & Sync to Android

```bash
cd frontend
npm run build
npx cap sync android
```

### C. Run / Install on Device (Vivo Y31)

1. **Via Android Studio:**
   ```bash
   npx cap open android
   ```
   - Connect your **Vivo Y31** via USB and enable **USB Debugging** in *Developer Options*.
   - Click the green **Run ▶** button in Android Studio to install the app on the phone.

2. **Via Command Line:**
   ```bash
   npx cap run android
   ```

---

## 📍 Native Permissions & Features

- **Native Geolocation:** Powered by `@capacitor/geolocation` with native permission dialogs.
- **Configured Android Permissions (`AndroidManifest.xml`):**
  - `android.permission.INTERNET`
  - `android.permission.ACCESS_FINE_LOCATION`
  - `android.permission.ACCESS_COARSE_LOCATION`
  - `android.hardware.location.gps`
  - `android:usesCleartextTraffic="true"` (for local HTTP network testing)
