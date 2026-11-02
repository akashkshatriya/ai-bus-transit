import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { TripStatusSkeleton } from '../components/SkeletonBlock';
import api from '../services/api';
import { API_BASE, WS_BASE } from '../config';

const ROUTE_LABELS = {
  belman_to_udupi: 'Belman → Udupi',
  udupi_to_belman: 'Udupi → Belman',
};
const PING_INTERVAL_MS = 4000;

// Exponential backoff delays: 1s, 2s, 4s
const BACKOFF_DELAYS = [1000, 2000, 4000];
const MAX_RECONNECT = 3;

// ── helper: human-readable elapsed time ──────────────────────────────────────
function useElapsedTime(startedAt) {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!startedAt) { setElapsed('00:00'); return; }
    const tick = () => {
      const s = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      if (h > 0) setElapsed(`${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`);
      else setElapsed(`${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

export const DriverPage = () => {
  const { user, token, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // ── form ──────────────────────────────────────────────────────────────────
  const [busName, setBusName] = useState('');
  const [busNameTouched, setBusNameTouched] = useState(false);
  const [route, setRoute] = useState('belman_to_udupi');

  // ── trip state ────────────────────────────────────────────────────────────
  const [trip, setTrip] = useState(null);
  const [tripStatus, setTripStatus] = useState('idle'); // idle | starting | active | ending

  // ── GPS / WS state ────────────────────────────────────────────────────────
  const [geoError, setGeoError] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected'); // connecting | open | disconnected | error | reconnecting | failed
  const [wsError, setWsError] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false); // true while a reconnect timeout is in flight

  // ── refs ──────────────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastPingTimeRef = useRef(0);
  const reconnectCountRef = useRef(0);
  const tripRef = useRef(null);

  const elapsed = useElapsedTime(trip?.started_at);
  useEffect(() => { tripRef.current = trip; }, [trip]);

  const handleLogout = () => { logout(); navigate('/', { replace: true }); };

  // ── open (or re-open) the WebSocket ──────────────────────────────────────
  const openWebSocket = useCallback((currentTrip) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const url = `${WS_BASE}/api/v1/trips/ws/driver/${currentTrip.id}?token=${encodeURIComponent(token)}`;
    setWsStatus('connecting');
    setIsReconnecting(false);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      const wasReconnect = reconnectCountRef.current > 0;
      setWsStatus('open');
      setWsError(null);
      setIsReconnecting(false);
      reconnectCountRef.current = 0;
      if (wasReconnect) {
        showToast('WebSocket connection restored', 'success');
      }
    };

    ws.onerror = () => {
      setWsStatus('error');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      const t = tripRef.current;
      if (!t || t.status === 'ended') return; // intentional close

      if (reconnectCountRef.current < MAX_RECONNECT) {
        reconnectCountRef.current += 1;
        const delay = BACKOFF_DELAYS[reconnectCountRef.current - 1] ?? 4000;
        const attempt = reconnectCountRef.current;
        setWsStatus('reconnecting');
        setIsReconnecting(true);
        setWsError(`Connection lost. Reconnecting in ${delay / 1000}s… (${attempt}/${MAX_RECONNECT})`);
        setTimeout(() => {
          if (tripRef.current?.status === 'active') openWebSocket(tripRef.current);
        }, delay);
      } else {
        setWsStatus('failed');
        setIsReconnecting(false);
        setWsError('Live stream disconnected after 3 attempts.');
        showToast('Live stream disconnected. Use the Retry button to reconnect.', 'warning');
      }
    };

    ws.onmessage = () => {};
  }, [token, showToast]);

  // ── manual retry ─────────────────────────────────────────────────────────
  const handleRetryWs = useCallback(() => {
    reconnectCountRef.current = 0;
    setWsError(null);
    if (tripRef.current) openWebSocket(tripRef.current);
  }, [openWebSocket]);

  // ── GPS watch with HTML5 Geolocation / Capacitor Geolocation ──────────────
  const startGeoWatch = useCallback(async (currentTrip) => {
    const send = (lat, lng) => {
      const now = Date.now();
      if (now - lastPingTimeRef.current < PING_INTERVAL_MS) return;
      lastPingTimeRef.current = now;

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = { lat, lng, timestamp: new Date().toISOString() };
        ws.send(JSON.stringify(payload));
        setLastPing({ lat: lat.toFixed(6), lng: lng.toFixed(6), sentAt: new Date().toLocaleTimeString() });
      }
    };

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    // 1. Native mobile device execution via Capacitor
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm && perm.location === 'denied') {
          setGeoError('Location access was denied. Please allow location permissions in device settings.');
          return;
        }

        const watchId = await Geolocation.watchPosition(geoOptions, (pos, err) => {
          if (err) {
            setGeoError(`GPS error: ${err.message || 'Unable to retrieve location'}`);
            return;
          }
          if (pos && pos.coords) {
            setGeoError(null);
            send(pos.coords.latitude, pos.coords.longitude);
          }
        });
        watchIdRef.current = watchId;
      } catch (err) {
        console.warn('Capacitor native geolocation error:', err);
        setGeoError(`Native Geolocation error: ${err.message || 'Failed to start GPS'}`);
      }
      return;
    }

    // 2. Standard HTML5 Geolocation API on Browser/Desktop
    if (!navigator.geolocation) {
      setGeoError('HTML5 Geolocation is not supported by your browser.');
      return;
    }

    const handleSuccess = (pos) => {
      if (pos && pos.coords) {
        setGeoError(null);
        send(pos.coords.latitude, pos.coords.longitude);
      }
    };

    const handleError = (err) => {
      if (err.code === 1) { // PERMISSION_DENIED
        setGeoError('Location access was denied. Please allow location access in your browser to stream GPS.');
      } else if (err.code === 2) { // POSITION_UNAVAILABLE
        setGeoError('GPS position unavailable. Please ensure location services are enabled on your device.');
      } else if (err.code === 3) { // TIMEOUT
        setGeoError('Location request timed out. Acquiring high-accuracy GPS fix...');
      } else {
        setGeoError(`Geolocation error: ${err.message || 'Unable to retrieve location'}`);
      }
    };

    // Immediate fix + continuous live stream
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
    watchIdRef.current = watchId;
  }, []);

  const stopGeoWatch = async () => {
    if (watchIdRef.current !== null) {
      try {
        if (Capacitor.isNativePlatform() && typeof watchIdRef.current === 'string') {
          await Geolocation.clearWatch({ id: watchIdRef.current });
        } else if (navigator.geolocation && typeof watchIdRef.current === 'number') {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      } catch (err) {
        console.warn('Error clearing geolocation watch:', err);
      }
      watchIdRef.current = null;
    }
  };

  // ── START TRIP ────────────────────────────────────────────────────────────
  const handleStartTrip = async () => {
    if (!busName.trim()) return;
    setTripStatus('starting');
    setGeoError(null);
    setWsError(null);

    try {
      const res = await api.post('/api/v1/trips/start', { bus_name: busName.trim(), route });
      const newTrip = { ...res.data, status: 'active' };
      setTrip(newTrip);
      setTripStatus('active');

      openWebSocket(newTrip);
      startGeoWatch(newTrip);
      showToast(`Trip started — streaming GPS for ${busName.trim()}`, 'success');
    } catch (err) {
      console.error('Failed to start trip:', err);
      setTripStatus('idle');
      const msg = err?.response?.data?.detail || 'Failed to start trip.';
      setWsError(msg);
      showToast(msg, 'error');
    }
  };

  // ── END TRIP ──────────────────────────────────────────────────────────────
  const handleEndTrip = async () => {
    if (!trip) return;
    setTripStatus('ending');
    stopGeoWatch();

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close(1000, 'Trip ended by driver');
      wsRef.current = null;
    }

    try {
      await api.post(`/api/v1/trips/${trip.id}/end`);
    } catch (err) {
      console.warn('End trip error (ignoring):', err?.response?.data);
    }

    showToast('Trip ended successfully', 'success');
    setTrip(null);
    setTripStatus('idle');
    setWsStatus('disconnected');
    setLastPing(null);
    setWsError(null);
    setGeoError(null);
    setIsReconnecting(false);
    reconnectCountRef.current = 0;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGeoWatch();
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, []);

  // ── render ────────────────────────────────────────────────────────────────
  const isActive = tripStatus === 'active';
  const isStarting = tripStatus === 'starting';
  const isEnding = tripStatus === 'ending';

  const wsStatusBadge = {
    connecting:   { color: 'text-olive-deep bg-beige border-beige', dot: 'bg-primary animate-pulse', label: 'Connecting…' },
    open:         { color: 'text-olive-deep bg-sage-light border-primary', dot: 'bg-primary animate-pulse', label: 'Live' },
    disconnected: { color: 'text-ink-soft bg-surface border-beige', dot: 'bg-ink-soft', label: 'Disconnected' },
    reconnecting: { color: 'text-olive-deep bg-beige border-beige', dot: 'bg-primary animate-pulse', label: 'Reconnecting…' },
    error:        { color: 'text-surface bg-olive-deep border-olive-deep', dot: 'bg-surface animate-pulse', label: 'Error' },
    failed:       { color: 'text-surface bg-olive-deep border-olive-deep', dot: 'bg-surface', label: 'Failed' },
  }[wsStatus] || { color: 'text-ink-soft bg-surface border-beige', dot: 'bg-ink-soft', label: wsStatus };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-cream border border-beige shadow-soft">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-sage-light border border-beige flex items-center justify-center text-2xl sm:text-3xl shadow-soft shrink-0">
            🚌
          </div>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <h1 className="text-xl sm:text-3xl font-heading font-black text-olive-deep">Driver Console</h1>
              <span className="px-2.5 py-0.5 bg-sage-light border border-primary text-olive-deep rounded-full text-xs font-mono font-semibold uppercase">
                Driver
              </span>
            </div>
            <p className="text-ink-soft text-sm mt-1">
              Welcome, <span className="font-semibold text-olive-deep" id="driver-user-name">{user?.name || user?.email}</span>
            </p>
          </div>
        </div>
        <Button id="driver-logout-btn" variant="outline" onClick={handleLogout}
          className="border-beige text-olive-deep hover:bg-btn-secondary text-xs px-4 py-2 self-start sm:self-center">
          Logout
        </Button>
      </div>

      {/* ── Error Banners ──────────────────────────────────────────────── */}
      {geoError && (
        <div className="p-4 rounded-xl bg-beige border border-beige text-olive-deep text-sm flex items-start space-x-3">
          <span className="text-xl">📍</span>
          <div>
            <p className="font-semibold text-olive-deep">Location Access Required</p>
            <p className="text-xs mt-0.5 text-ink-soft">{geoError}</p>
          </div>
        </div>
      )}

      {/* WS reconnecting banner */}
      {wsError && wsStatus !== 'failed' && (
        <div className="p-4 rounded-xl bg-beige border border-beige text-olive-deep text-sm flex items-center space-x-3">
          <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
          <div>
            <p className="font-semibold text-olive-deep">Reconnecting…</p>
            <p className="text-xs mt-0.5 text-ink-soft">{wsError}</p>
          </div>
        </div>
      )}

      {/* WS permanently failed banner + Retry button */}
      {wsStatus === 'failed' && (
        <div className="p-4 rounded-xl bg-olive-deep border border-olive-deep text-surface text-sm flex items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <span className="text-xl">⚡</span>
            <div>
              <p className="font-semibold text-surface">Live Stream Disconnected</p>
              <p className="text-xs mt-0.5 text-surface/80">
                Could not reconnect after 3 attempts. GPS is no longer streaming.
              </p>
            </div>
          </div>
          <button
            onClick={handleRetryWs}
            className="shrink-0 px-4 py-2 rounded-btn bg-surface text-olive-deep text-xs font-bold hover:bg-cream transition-colors cursor-pointer whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Trip Form ────────────────────────────────────────────────── */}
        <Card title="Trip Setup">
          <div className="space-y-4">
            <div>
              <label htmlFor="bus-name-input" className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5">
                Bus Name / Number
              </label>
              <input
                id="bus-name-input"
                type="text"
                value={busName}
                onChange={(e) => setBusName(e.target.value)}
                onBlur={() => setBusNameTouched(true)}
                placeholder="e.g. KA-21 F 1234"
                disabled={isActive || isStarting || isEnding}
                className={`w-full px-4 py-2.5 bg-field border rounded-btn text-ink placeholder-ink-soft focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors shadow-sm ${
                  busNameTouched && !busName.trim() ? 'border-olive-deep' : 'border-beige'
                }`}
              />
              {/* Validation hint */}
              {busNameTouched && !busName.trim() && !isActive && (
                <p className="text-[11px] text-olive-deep mt-1 font-semibold">Bus name is required to start a trip.</p>
              )}
            </div>

            <div>
              <label htmlFor="route-select" className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5">
                Route
              </label>
              <select
                id="route-select"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                disabled={isActive || isStarting || isEnding}
                className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors cursor-pointer shadow-sm"
              >
                <option value="belman_to_udupi">Belman → Udupi</option>
                <option value="udupi_to_belman">Udupi → Belman</option>
              </select>
            </div>

            {!isActive ? (
              <Button
                id="start-trip-btn"
                onClick={handleStartTrip}
                disabled={isStarting || isEnding || !busName.trim()}
                className="w-full bg-primary hover:bg-primary-hover text-white shadow-soft py-3"
              >
                {isStarting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Starting Trip…</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Start Trip</span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                id="end-trip-btn"
                onClick={handleEndTrip}
                disabled={isEnding}
                variant="danger"
                className="w-full py-3"
              >
                {isEnding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Ending Trip…</span>
                  </>
                ) : (
                  <>
                    <span>🛑</span>
                    <span>End Trip</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>

        {/* ── Live Status Panel ────────────────────────────────────────── */}
        <Card title="Live Trip Status">
          {/* Skeleton while starting (between button tap and WS open) */}
          {isStarting && <TripStatusSkeleton />}

          {/* Idle state */}
          {!isActive && !isStarting && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-sage-light border border-beige flex items-center justify-center text-3xl mb-3 shadow-soft">
                📡
              </div>
              <p className="text-ink-soft text-sm">No active trip.<br/>Fill the form and tap <strong className="text-olive-deep">Start Trip</strong>.</p>
            </div>
          )}

          {/* Active trip details */}
          {isActive && (
            <div className="space-y-4">
              {/* Status row */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-soft font-semibold uppercase tracking-wider">Status</span>
                <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-semibold bg-sage-light border-primary text-olive-deep">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Trip Active</span>
                </span>
              </div>

              {/* Bus / Route */}
              <div className="p-3 rounded-xl bg-surface border border-beige space-y-2 text-sm shadow-soft">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Bus</span>
                  <span className="font-semibold text-olive-deep">{trip?.bus_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Route</span>
                  <span className="font-semibold text-olive-deep text-right max-w-[60%]">{ROUTE_LABELS[trip?.route] || trip?.route}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Trip ID</span>
                  <span className="font-mono text-xs text-ink-soft">#{trip?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Elapsed</span>
                  <span className="font-mono text-olive-deep text-sm font-bold">{elapsed}</span>
                </div>
              </div>

              {/* WebSocket status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-beige shadow-soft">
                <span className="text-xs text-ink-soft font-semibold uppercase tracking-wider">WebSocket</span>
                <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${wsStatusBadge.color}`}>
                  <span className={`w-2 h-2 rounded-full ${wsStatusBadge.dot}`} />
                  <span>{wsStatusBadge.label}</span>
                </span>
              </div>

              {/* Last GPS ping */}
              <div className="p-3 rounded-xl bg-surface border border-beige shadow-soft">
                <p className="text-xs text-ink-soft font-semibold uppercase tracking-wider mb-2">Last GPS Ping</p>
                {lastPing ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Latitude</span>
                      <span className="font-mono text-ink">{lastPing.lat}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Longitude</span>
                      <span className="font-mono text-ink">{lastPing.lng}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Sent at</span>
                      <span className="font-mono text-xs text-ink-soft">{lastPing.sentAt}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-ink-soft italic">
                    {geoError ? 'Location unavailable' : 'Waiting for GPS fix…'}
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Geolocation Info (idle state hint) ──────────────────────────── */}
      {!isActive && !isStarting && (
        <Card>
          <div className="flex items-start space-x-4 p-2">
            <div className="w-10 h-10 rounded-xl bg-sage-light border border-beige flex items-center justify-center text-xl shrink-0 shadow-soft">
              ℹ️
            </div>
            <div>
              <p className="text-sm font-semibold text-olive-deep">How GPS Streaming Works</p>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                When you tap <strong className="text-olive-deep">Start Trip</strong>, your browser will ask for location permission.
                Once granted, your position is streamed every ~4 seconds over a WebSocket connection to the server
                and broadcast in real-time to all passengers watching your route.
                The <strong className="text-olive-deep">End Trip</strong> button stops streaming and marks the trip as complete.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default DriverPage;
