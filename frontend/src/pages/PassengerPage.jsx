import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { PredictionSkeleton, MapLoadingSkeleton } from '../components/SkeletonBlock';
import { UserIcon, MapIcon, EtaIcon } from '../components/Icons';
import api from '../services/api';
import { API_BASE, WS_BASE } from '../config';

const ROUTE_OPTIONS = [
  { value: 'belman_to_udupi', label: 'Belman → Udupi', from: 'Belman', to: 'Udupi' },
  { value: 'udupi_to_belman', label: 'Udupi → Belman', from: 'Udupi', to: 'Belman' },
];

const ROUTE_LABELS = {
  belman_to_udupi: 'Belman → Udupi',
  udupi_to_belman: 'Udupi → Belman',
};

// Official coordinates for all 9 stops from the dataset
const STOPS_COORDINATES = [
  { name: 'Belman', lat: 13.168989, lng: 74.872811, isTerminal: true },
  { name: 'Jantra', lat: 13.187486, lng: 74.866609, isTerminal: false },
  { name: 'Shirva', lat: 13.216301, lng: 74.825964, isTerminal: false },
  { name: 'Bantakal', lat: 13.252413, lng: 74.794802, isTerminal: false },
  { name: 'SMVITM', lat: 13.255359, lng: 74.785722, isTerminal: false },
  { name: 'Shankarpura', lat: 13.259668, lng: 74.770217, isTerminal: false },
  { name: 'Subhasnagar', lat: 13.272116, lng: 74.767386, isTerminal: false },
  { name: 'Katpadi', lat: 13.284498, lng: 74.748133, isTerminal: false },
  { name: 'Udupi', lat: 13.342464, lng: 74.747357, isTerminal: true },
];

const MAP_CENTER = [13.2557, 74.8101];
const MAP_ZOOM = 12;

// Exponential backoff delays: 1s, 2s, 4s
const BACKOFF_DELAYS = [1000, 2000, 4000];
const MAX_RECONNECT = 3;

// Custom Stop Pin Icon
const createStopIcon = (stopName, isTerminal) => {
  return L.divIcon({
    className: 'custom-stop-marker-wrapper',
    html: `
      <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <!-- Stop label -->
        <div style="padding: 2px 6px; margin-bottom: 2px; background-color: #FAF9F6; border: 1px solid #D8D0BE; color: #424936; border-radius: 6px; font-size: 10px; font-weight: 600; white-space: nowrap; box-shadow: 0 1px 3px rgba(66,73,54,0.08); pointer-events: none;">
          ${stopName}
        </div>
        <!-- Dot -->
        <div style="width: 14px; height: 14px; border-radius: 9999px; background-color: ${isTerminal ? '#737B52' : '#FAF9F6'}; border: 2.5px solid #424936; box-shadow: 0 1px 4px rgba(66,73,54,0.15); display: flex; align-items: center; justify-content: center;">
          <div style="width: 4px; height: 4px; border-radius: 9999px; background-color: ${isTerminal ? '#FAF9F6' : '#737B52'};"></div>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32],
  });
};

// Custom animated Bus DivIcon creator
const createBusIcon = (busName) => {
  return L.divIcon({
    className: 'custom-bus-marker-wrapper',
    html: `
      <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <!-- Bus name badge -->
        <div style="padding: 2px 8px; margin-bottom: 4px; background-color: #F0EDE4; border: 1px solid #D8D0BE; border-radius: 8px; font-size: 11px; font-weight: 700; color: #424936; box-shadow: 0 2px 6px rgba(66,73,54,0.12); white-space: nowrap; pointer-events: none;">
          🚌 ${busName || 'Bus'}
        </div>
        <!-- Pulse radar -->
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; width: 32px; height: 32px; border-radius: 9999px; background-color: rgba(115, 123, 82, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="width: 30px; height: 30px; border-radius: 10px; background-color: #737B52; border: 2px solid #FAF9F6; box-shadow: 0 2px 8px rgba(66,73,54,0.25); display: flex; align-items: center; justify-content: center; font-size: 14px;">
            🚍
          </div>
        </div>
        <!-- Pin point -->
        <div style="width: 8px; height: 8px; background-color: #737B52; transform: rotate(45deg); margin-top: -4px; box-shadow: 0 2px 4px rgba(66,73,54,0.15);"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -48],
  });
};

// Custom passenger marker
const createPassengerIcon = () => {
  return L.divIcon({
    className: 'custom-passenger-marker-wrapper',
    html: `
      <div style="transform: translate(-50%, -50%); position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <span style="position: absolute; width: 32px; height: 32px; border-radius: 9999px; background-color: rgba(115, 123, 82, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="width: 16px; height: 16px; border-radius: 9999px; background-color: #737B52; border: 2.5px solid #FAF9F6; box-shadow: 0 2px 8px rgba(66,73,54,0.3); position: relative; z-index: 10;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// Component to dynamically re-center map
function MapViewController({ activeTrips = [], stops = [], passengerLocation, isFollowingRef }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Listen for manual drag to pause auto-following
    const handleDragStart = () => {
      if (isFollowingRef && isFollowingRef.current) {
        isFollowingRef.current = false;
      }
    };
    map.on('dragstart', handleDragStart);
    return () => {
      map.off('dragstart', handleDragStart);
    };
  }, [map, isFollowingRef]);

  useEffect(() => {
    if (!map) return;

    // Follow passenger if they haven't manually dragged
    if (passengerLocation && isFollowingRef?.current) {
      map.setView([passengerLocation.lat, passengerLocation.lng], 16, { animate: true });
      return;
    }

    // Default bounds logic if not following passenger
    if (!passengerLocation) {
      const bounds = L.latLngBounds();

      // Add all stops to bounds
      stops.forEach(stop => bounds.extend([stop.lat, stop.lng]));

      // Add all active buses to bounds
      activeTrips.forEach(trip => {
        if (trip.lat && trip.lng) {
          bounds.extend([trip.lat, trip.lng]);
        }
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
      }
    }
  }, [activeTrips, stops, passengerLocation, map, isFollowingRef]);
  return null;
}

// Relative time formatter helper
function formatTimeAgo(dateStr) {
  if (!dateStr) return 'just now';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// Animated marker component with smooth interpolation
function AnimatedBusMarker({ trip, targetLat, targetLng }) {
  const [currentPos, setCurrentPos] = useState([targetLat, targetLng]);
  const startPosRef = useRef([targetLat, targetLng]);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);
  const DURATION_MS = 2500;

  useEffect(() => {
    const fromLat = currentPos[0];
    const fromLng = currentPos[1];
    startPosRef.current = [fromLat, fromLng];
    startTimeRef.current = performance.now();

    const animate = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      const ease = progress * (2 - progress);

      const lat = fromLat + (targetLat - fromLat) * ease;
      const lng = fromLng + (targetLng - fromLng) * ease;
      setCurrentPos([lat, lng]);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [targetLat, targetLng]);

  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(trip.updated_at));

  useEffect(() => {
    const id = setInterval(() => {
      setTimeAgo(formatTimeAgo(trip.updated_at));
    }, 1000);
    return () => clearInterval(id);
  }, [trip.updated_at]);

  return (
    <Marker position={currentPos} icon={createBusIcon(trip.bus_name)}>
      <Popup className="custom-leaflet-popup">
        <div className="p-2 space-y-1.5 min-w-[160px] text-ink">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🚌</span>
            <div>
              <h4 className="font-heading font-bold text-sm text-olive-deep leading-tight">{trip.bus_name}</h4>
              <span className="text-[10px] font-mono text-olive-deep bg-sage-light px-1.5 py-0.5 rounded font-semibold border border-primary">
                Trip #{trip.trip_id || trip.id}
              </span>
            </div>
          </div>
          <div className="pt-1 border-t border-beige text-xs space-y-0.5">
            <div className="flex justify-between text-ink-soft">
              <span>Route:</span>
              <span className="font-medium text-olive-deep">{ROUTE_LABELS[trip.route] || trip.route}</span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Status:</span>
              <span className="text-olive-deep font-semibold flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1 animate-pulse" />
                Live Moving
              </span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Updated:</span>
              <span className="font-mono text-ink-soft text-[11px]">{timeAgo}</span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// ── Stops list ───────────────────────────────────────────────────────────────
const ALL_STOPS = [
  'Belman', 'Jantra', 'Shirva', 'Bantakal', 'SMVITM',
  'Shankarpura', 'Subhasnagara', 'Katpadi', 'Udupi',
];

const CROWD_STYLES = {
  Low: { bg: 'bg-sage-light', border: 'border-primary', text: 'text-olive-deep', dot: 'bg-primary', label: 'Low Crowd' },
  Medium: { bg: 'bg-beige', border: 'border-beige', text: 'text-olive-deep', dot: 'bg-olive-deep', label: 'Medium Crowd' },
  High: { bg: 'bg-olive-deep', border: 'border-olive-deep', text: 'text-surface', dot: 'bg-surface', label: 'High Crowd' },
};

// ── PredictionTab sub-component ──────────────────────────────────────────────
function PredictionTab() {
  const { showToast } = useToast();
  const [predStop, setPredStop] = useState(ALL_STOPS[0]);
  const [predRoute, setPredRoute] = useState('belman_to_udupi');
  const [predTime, setPredTime] = useState('08:30');
  const [predTimeError, setPredTimeError] = useState(null);
  const [predDayType, setPredDayType] = useState('Weekday');

  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState(null);
  const [predResult, setPredResult] = useState(null);

  // Validate HH:MM format
  const validateTime = (val) => {
    if (!val) return 'Please enter a reference time.';
    if (!/^\d{2}:\d{2}$/.test(val)) return 'Time must be in HH:MM format.';
    const [h, m] = val.split(':').map(Number);
    if (h > 23 || m > 59) return 'Invalid time value.';
    return null;
  };

  const handlePredict = async () => {
    const timeErr = validateTime(predTime);
    if (timeErr) {
      setPredTimeError(timeErr);
      return;
    }
    setPredTimeError(null);
    setPredLoading(true);
    setPredError(null);
    setPredResult(null);

    try {
      const res = await api.post('/api/v1/predict', {
        stop_name: predStop,
        route: predRoute,
        time: predTime,
        day_type: predDayType,
      });
      setPredResult(res.data);
      if (res.data.no_prediction) {
        showToast('No service scheduled for this stop/time — see details below', 'info');
      } else {
        showToast('Prediction ready', 'success');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let msg;
      if (Array.isArray(detail)) {
        msg = detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
      } else {
        msg = detail || err.message || 'Prediction request failed.';
      }
      setPredError(msg);
      showToast('Prediction failed — check your connection', 'error');
    } finally {
      setPredLoading(false);
    }
  };

  const crowdStyle = predResult ? (CROWD_STYLES[predResult.predicted_crowd_level] || CROWD_STYLES.Low) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Prediction Form */}
      <Card title="Predict Bus Arrival & Crowd" className="lg:col-span-2">
        <div className="space-y-4">
          {/* Stop selector */}
          <div>
            <label htmlFor="pred-stop" className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5">
              Bus Stop
            </label>
            <select
              id="pred-stop"
              value={predStop}
              onChange={(e) => setPredStop(e.target.value)}
              className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 text-sm transition-colors cursor-pointer shadow-sm"
            >
              {ALL_STOPS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Route selector */}
          <div>
            <label htmlFor="pred-route" className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5">
              Route
            </label>
            <select
              id="pred-route"
              value={predRoute}
              onChange={(e) => setPredRoute(e.target.value)}
              className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 text-sm transition-colors cursor-pointer shadow-sm"
            >
              {ROUTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Time picker */}
          <div>
            <label htmlFor="pred-time" className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5">
              Your Reference Time
            </label>
            <input
              id="pred-time"
              type="time"
              value={predTime}
              onChange={(e) => { setPredTime(e.target.value); setPredTimeError(null); }}
              className={`w-full px-4 py-2.5 bg-field border rounded-btn text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 text-sm transition-colors shadow-sm ${predTimeError ? 'border-olive-deep' : 'border-beige'
                }`}
            />
            {predTimeError && (
              <p className="text-[11px] text-olive-deep font-semibold mt-1">{predTimeError}</p>
            )}
          </div>

          {/* Day type toggle */}
          <div>
            <label className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5">
              Day Type
            </label>
            <div className="flex rounded-btn overflow-hidden border border-beige bg-surface">
              <button
                type="button"
                id="pred-weekday-btn"
                onClick={() => setPredDayType('Weekday')}
                className={`flex-1 px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${predDayType === 'Weekday'
                    ? 'bg-primary text-white shadow-soft'
                    : 'bg-surface text-ink-soft hover:bg-btn-secondary hover:text-olive-deep'
                  }`}
              >
                Weekday
              </button>
              <button
                type="button"
                id="pred-weekend-btn"
                onClick={() => setPredDayType('Weekend')}
                className={`flex-1 px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${predDayType === 'Weekend'
                    ? 'bg-primary text-white shadow-soft'
                    : 'bg-surface text-ink-soft hover:bg-btn-secondary hover:text-olive-deep'
                  }`}
              >
                Weekend
              </button>
            </div>
          </div>

          {/* Submit */}
          <Button
            id="pred-submit-btn"
            onClick={handlePredict}
            disabled={predLoading || !predTime}
            className="w-full bg-primary hover:bg-primary-hover text-white shadow-soft py-3 cursor-pointer"
          >
            {predLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Predicting...</span>
              </>
            ) : (
              <>
                <span>🤖</span>
                <span>Get Prediction</span>
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Result Panel */}
      <div className="lg:col-span-3 space-y-4">
        {/* Error banner */}
        {predError && (
          <div className="p-4 rounded-xl bg-olive-deep border border-olive-deep text-surface text-sm flex items-start space-x-3 shadow-soft">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-surface">Prediction Failed</p>
              <p className="text-xs mt-0.5 text-surface/80">{predError}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!predResult && !predError && !predLoading && (
          <Card>
            <div className="py-14 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sage-light border border-beige flex items-center justify-center text-3xl mx-auto shadow-soft">
                🤖
              </div>
              <div>
                <h3 className="text-base font-heading font-bold text-olive-deep">ML ETA Prediction Engine</h3>
                <p className="text-xs text-ink-soft mt-2 max-w-sm mx-auto leading-relaxed">
                  Select a stop, route, time, and day type, then tap <strong className="text-olive-deep">Get Prediction</strong> to see the
                  estimated arrival and crowd level — plus any currently live bus on that route.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Full-card loading skeleton while predicting */}
        {predLoading && (
          <Card title="Prediction Result">
            <PredictionSkeleton />
          </Card>
        )}

        {predResult && !predLoading && (
          <>
            {/* ── No prediction available ──────────────────────────────── */}
            {predResult.no_prediction ? (
              <Card>
                <div className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-beige border border-beige flex items-center justify-center text-3xl mx-auto shadow-soft">
                    🗓️
                  </div>
                  <div>
                    <h3 className="text-base font-heading font-bold text-olive-deep">No Service at This Time</h3>
                    <p className="text-xs text-ink-soft mt-2 max-w-md mx-auto leading-relaxed">
                      {predResult.no_prediction_reason || 'Insufficient historical data for this combination of stop, route, time, and day type.'}
                    </p>
                    <p className="text-[11px] text-ink-soft mt-3">
                      Try a different time or day type — buses typically run 05:00–21:00 on this corridor.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                {/* ── Card 1: ML Prediction Result ─────────────────────── */}
                <Card title="Prediction Result">
                  <div className="space-y-4">
                    {/* Next Bus */}
                    <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-surface border border-beige shadow-soft">
                      <div>
                        <p className="text-[10px] text-ink-soft uppercase tracking-wider font-semibold">Next Bus</p>
                        <p className="text-xs text-ink-soft mt-0.5">Scheduled next bus for this route &amp; stop</p>
                      </div>
                      {predResult.next_bus_name ? (
                        <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sage-light border border-primary text-olive-deep font-bold text-sm whitespace-nowrap shadow-soft">
                          <span>🚌</span>
                          <span>{predResult.next_bus_name}</span>
                        </span>
                      ) : (
                        <span className="text-ink-soft italic text-xs">Unknown</span>
                      )}
                    </div>

                    {/* Normal Arrival + Predicted Arrival */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-surface border border-beige space-y-1 text-center shadow-soft">
                        <p className="text-[10px] text-ink-soft uppercase tracking-wider font-semibold">Normal Arrival</p>
                        <p className="text-xs text-ink-soft">Historical schedule</p>
                        <p className="text-2xl font-black text-ink font-mono tracking-tight">
                          {predResult.normal_arrival_time}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface border border-primary space-y-1 text-center shadow-soft">
                        <p className="text-[10px] text-olive-deep uppercase tracking-wider font-bold">Predicted Arrival</p>
                        <p className="text-xs text-ink-soft">ML estimated</p>
                        <p className="text-2xl font-black text-olive-deep font-mono tracking-tight">
                          {predResult.predicted_arrival_time}
                        </p>
                      </div>
                    </div>

                    {/* Bus Delay + Passenger Wait */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-surface border border-beige space-y-1 text-center shadow-soft">
                        <p className="text-[10px] text-ink-soft uppercase tracking-wider font-semibold">Bus Delay</p>
                        <p className="text-xs text-ink-soft">Predicted − Normal</p>
                        <p className="text-2xl font-black font-mono tracking-tight text-olive-deep">
                          {Math.round(predResult.bus_delay_minutes) > 0
                            ? `+${Math.round(predResult.bus_delay_minutes)} min`
                            : '0 min'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface border border-primary space-y-1 text-center shadow-soft">
                        <p className="text-[10px] text-olive-deep uppercase tracking-wider font-bold">Your Waiting Time</p>
                        <p className="text-xs text-ink-soft">From your reference time</p>
                        <p className="text-2xl font-black text-olive-deep font-mono tracking-tight">
                          {Math.round(predResult.passenger_wait_minutes)} min
                        </p>
                      </div>
                    </div>

                    {/* Crowd level badge */}
                    {crowdStyle && (
                      <div className={`p-4 rounded-xl border ${crowdStyle.bg} ${crowdStyle.border} flex items-center justify-between shadow-soft`}>
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-xl ${crowdStyle.bg} border ${crowdStyle.border} flex items-center justify-center text-xl`}>
                            {predResult.predicted_crowd_level === 'Low' ? '😊' :
                              predResult.predicted_crowd_level === 'Medium' ? '😐' : '😰'}
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${crowdStyle.text}`}>{crowdStyle.label}</p>
                            <p className="text-[11px] opacity-80 text-ink-soft">Predicted crowd at this stop</p>
                          </div>
                        </div>
                        <span className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-bold ${crowdStyle.bg} ${crowdStyle.border} ${crowdStyle.text}`}>
                          <span className={`w-2 h-2 rounded-full ${crowdStyle.dot} animate-pulse`} />
                          <span>{predResult.predicted_crowd_level}</span>
                        </span>
                      </div>
                    )}

                  </div>
                </Card>

                {/* ── Card 2: Live Bus (conditional) ──────────────────── */}
                {predResult.live_bus ? (
                  <Card title="Live Bus on This Route">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-2 text-olive-deep font-bold text-base">
                          <span>🚌</span>
                          <span>{predResult.live_bus.bus_name}</span>
                        </span>
                        <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sage-light border border-primary text-olive-deep text-xs font-bold">
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <span>LIVE</span>
                        </span>
                      </div>

                      {predResult.live_bus.last_lat != null && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="p-2 rounded-lg bg-surface border border-beige">
                            <p className="text-ink-soft">Latitude</p>
                            <p className="text-olive-deep font-semibold">{Number(predResult.live_bus.last_lat).toFixed(4)}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-surface border border-beige">
                            <p className="text-ink-soft">Longitude</p>
                            <p className="text-olive-deep font-semibold">{Number(predResult.live_bus.last_lng).toFixed(4)}</p>
                          </div>
                        </div>
                      )}

                      {predResult.live_bus.updated_at && (
                        <p className="text-[11px] text-ink-soft flex items-center justify-between">
                          <span>Last GPS update:</span>
                          <span className="text-olive-deep font-mono font-medium">
                            {formatTimeAgo(predResult.live_bus.updated_at)} ({new Date(predResult.live_bus.updated_at).toLocaleTimeString()})
                          </span>
                        </p>
                      )}

                      <p className="text-[11px] text-ink-soft leading-relaxed">
                        This bus is currently broadcasting live GPS on this route. The historical prediction above
                        reflects typical patterns — the actual bus may differ.
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="p-4 rounded-xl bg-surface border border-beige flex items-center space-x-3 shadow-soft">
                    <div className="w-9 h-9 rounded-xl bg-cream border border-beige flex items-center justify-center text-lg shrink-0">
                      📡
                    </div>
                    <div>
                      <p className="text-olive-deep text-sm font-semibold">No bus currently live on this route</p>
                      <p className="text-[11px] text-ink-soft mt-0.5">
                        Showing historical prediction only. When a driver starts a trip on this route it will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ── Main PassengerPage component ─────────────────────────────────────────────
export const PassengerPage = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('map');
  const [selectedRoute, setSelectedRoute] = useState('belman_to_udupi');
  const [activeTrips, setActiveTrips] = useState({});

  // Map loading state — true until snapshot received OR 6s timeout
  const [mapLoading, setMapLoading] = useState(true);
  const mapLoadTimeoutRef = useRef(null);

  const [wsStatus, setWsStatus] = useState('disconnected');
  const [wsError, setWsError] = useState(null);
  const [wsRetryFailed, setWsRetryFailed] = useState(false); // true after MAX_RECONNECT exhausted

  // ── Passenger Live Location State ──────────────────────────────────────────
  const [liveLocationEnabled, setLiveLocationEnabled] = useState(false);
  const [passengerLocation, setPassengerLocation] = useState(null);
  const [passengerGeoError, setPassengerGeoError] = useState(null);

  const passengerWatchIdRef = useRef(null);
  const isFollowingRef = useRef(true);

  useEffect(() => {
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    const startWatch = async () => {
      // 1. Native mobile device via Capacitor
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await Geolocation.requestPermissions();
          if (perm && perm.location === 'denied') {
            setPassengerGeoError('Location access denied. Please allow permissions in device settings.');
            return;
          }

          const watchId = await Geolocation.watchPosition(geoOptions, (pos, err) => {
            if (err) {
              setPassengerGeoError(`Location error: ${err.message || 'Unable to retrieve location'}`);
              return;
            }
            if (pos && pos.coords) {
              setPassengerGeoError(null);
              setPassengerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }
          });
          passengerWatchIdRef.current = watchId;
        } catch (err) {
          console.warn('Capacitor native geolocation error:', err);
          setPassengerGeoError(`Native Geolocation error: ${err.message || 'Failed to start GPS'}`);
        }
        return;
      }

      // 2. Standard HTML5 Geolocation API on Browser/Desktop
      if (!navigator.geolocation) {
        setPassengerGeoError('HTML5 Geolocation is not supported by your browser.');
        return;
      }

      const handleSuccess = (pos) => {
        if (pos && pos.coords) {
          setPassengerGeoError(null);
          setPassengerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      };

      const handleError = (err) => {
        if (err.code === 1) { // PERMISSION_DENIED
          setPassengerGeoError('Location access was denied. Please allow location permissions in your browser.');
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setPassengerGeoError('GPS position unavailable. Please ensure location services are enabled on your device.');
        } else if (err.code === 3) { // TIMEOUT
          setPassengerGeoError('Location request timed out. Acquiring high-accuracy GPS fix...');
        } else {
          setPassengerGeoError(`Location error: ${err.message || 'Unable to retrieve location'}`);
        }
      };

      // Immediate fix + continuous live stream
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
      const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
      passengerWatchIdRef.current = watchId;
    };

    if (liveLocationEnabled) {
      isFollowingRef.current = true; // reset following when turned on
      startWatch();
    } else {
      // Clean up watch
      setPassengerLocation(null);
      setPassengerGeoError(null);
      if (passengerWatchIdRef.current !== null) {
        if (Capacitor.isNativePlatform() && typeof passengerWatchIdRef.current === 'string') {
          Geolocation.clearWatch({ id: passengerWatchIdRef.current }).catch(console.warn);
        } else if (navigator.geolocation && typeof passengerWatchIdRef.current === 'number') {
          navigator.geolocation.clearWatch(passengerWatchIdRef.current);
        }
        passengerWatchIdRef.current = null;
      }
    }

    return () => {
      if (passengerWatchIdRef.current !== null) {
        if (Capacitor.isNativePlatform() && typeof passengerWatchIdRef.current === 'string') {
          Geolocation.clearWatch({ id: passengerWatchIdRef.current }).catch(console.warn);
        } else if (navigator.geolocation && typeof passengerWatchIdRef.current === 'number') {
          navigator.geolocation.clearWatch(passengerWatchIdRef.current);
        }
        passengerWatchIdRef.current = null;
      }
    };
  }, [liveLocationEnabled]);
  // ───────────────────────────────────────────────────────────────────────────

  const wsRef = useRef(null);
  const reconnectCountRef = useRef(0);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  // REST initial fetch for fallback & sync
  const fetchActiveTripsRest = useCallback(async (route) => {
    try {
      const res = await api.get(`/api/v1/trips/active?route=${route}`);
      const tripMap = {};
      res.data.forEach((t) => {
        if (t.lat !== null && t.lng !== null) {
          tripMap[t.id] = {
            trip_id: t.id,
            bus_name: t.bus_name,
            route: t.route,
            lat: t.lat,
            lng: t.lng,
            updated_at: t.updated_at,
          };
        }
      });
      setActiveTrips((prev) => ({ ...prev, ...tripMap }));
    } catch (err) {
      console.warn('Could not fetch active trips via REST:', err);
    }
  }, []);

  // Connect WebSocket for route — with exponential backoff + Retry
  const connectWebSocket = useCallback((route) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const url = `${WS_BASE}/api/v1/trips/ws/passenger/live?route=${encodeURIComponent(route)}`;
    setWsStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('open');
      setWsError(null);
      setWsRetryFailed(false);
      reconnectCountRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Case 1: Initial Snapshot
        if (message.type === 'snapshot' && Array.isArray(message.data)) {
          const snapshotMap = {};
          message.data.forEach((t) => {
            if (t.lat !== undefined && t.lng !== undefined) {
              snapshotMap[t.trip_id || t.id] = t;
            }
          });
          setActiveTrips(snapshotMap);
          setMapLoading(false); // snapshot received — hide skeleton
        }
        // Case 2: Array snapshot directly
        else if (Array.isArray(message)) {
          const snapshotMap = {};
          message.forEach((t) => {
            if (t.lat !== undefined && t.lng !== undefined) {
              snapshotMap[t.trip_id || t.id] = t;
            }
          });
          setActiveTrips(snapshotMap);
          setMapLoading(false);
        }
        // Case 3: Live location update
        else if (message.trip_id && message.lat !== undefined && message.lng !== undefined) {
          setActiveTrips((prev) => ({
            ...prev,
            [message.trip_id]: {
              trip_id: message.trip_id,
              bus_name: message.bus_name || prev[message.trip_id]?.bus_name || 'Bus',
              route: message.route || prev[message.trip_id]?.route || route,
              lat: message.lat,
              lng: message.lng,
              updated_at: message.timestamp || new Date().toISOString(),
            },
          }));
          setMapLoading(false);
        }
        // Case 4: Trip ended notification
        else if (message.type === 'trip_ended' && message.trip_id) {
          setActiveTrips((prev) => {
            const next = { ...prev };
            delete next[message.trip_id];
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      setWsStatus('error');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');

      if (reconnectCountRef.current < MAX_RECONNECT) {
        reconnectCountRef.current += 1;
        const delay = BACKOFF_DELAYS[reconnectCountRef.current - 1] ?? 4000;
        const attempt = reconnectCountRef.current;
        setWsStatus('reconnecting');
        setWsError(`Live stream lost. Reconnecting in ${delay / 1000}s… (${attempt}/${MAX_RECONNECT})`);

        setTimeout(() => {
          connectWebSocket(route);
        }, delay);
      } else {
        setWsStatus('failed');
        setWsRetryFailed(true);
        setWsError(null);
        setMapLoading(false); // stop blocking map even if WS failed
        showToast('Lost connection to live stream', 'warning');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  // Manual retry
  const handleRetryWs = () => {
    reconnectCountRef.current = 0;
    setWsRetryFailed(false);
    connectWebSocket(selectedRoute);
  };

  // On route or tab change
  useEffect(() => {
    if (activeTab !== 'map') return;

    setActiveTrips({});
    setMapLoading(true);
    reconnectCountRef.current = 0;
    setWsRetryFailed(false);

    // Safety timeout: if no snapshot in 6s, hide skeleton anyway
    if (mapLoadTimeoutRef.current) clearTimeout(mapLoadTimeoutRef.current);
    mapLoadTimeoutRef.current = setTimeout(() => setMapLoading(false), 6000);

    fetchActiveTripsRest(selectedRoute);
    connectWebSocket(selectedRoute);

    return () => {
      if (mapLoadTimeoutRef.current) clearTimeout(mapLoadTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [activeTab, selectedRoute, fetchActiveTripsRest, connectWebSocket]);

  const activeTripList = Object.values(activeTrips);

  const wsStatusBadge = {
    connecting: { color: 'text-olive-deep bg-beige border-beige', dot: 'bg-primary animate-pulse', label: 'Connecting…' },
    open: { color: 'text-olive-deep bg-sage-light border-primary', dot: 'bg-primary animate-pulse', label: 'Live Stream' },
    disconnected: { color: 'text-ink-soft bg-surface border-beige', dot: 'bg-ink-soft', label: 'Disconnected' },
    reconnecting: { color: 'text-olive-deep bg-beige border-beige', dot: 'bg-primary animate-pulse', label: 'Reconnecting…' },
    error: { color: 'text-surface bg-olive-deep border-olive-deep', dot: 'bg-surface animate-pulse', label: 'Connection Error' },
    failed: { color: 'text-surface bg-olive-deep border-olive-deep', dot: 'bg-surface', label: 'Disconnected' },
  }[wsStatus] || { color: 'text-ink-soft bg-surface border-beige', dot: 'bg-ink-soft', label: wsStatus };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-cream border border-beige shadow-soft">
        <div className="flex items-center space-x-4">
          <UserIcon size={48} className="shadow-soft shrink-0" />
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <h1 className="text-xl sm:text-3xl font-heading font-black text-olive-deep">Passenger Portal</h1>
              <span className="px-2.5 py-0.5 bg-sage-light border border-primary text-olive-deep rounded-full text-xs font-mono font-semibold uppercase">
                Passenger
              </span>
            </div>
            <p className="text-ink-soft text-sm mt-1">
              Welcome back, <span className="font-semibold text-olive-deep" id="passenger-user-name">{user?.name || user?.email}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            id="passenger-logout-btn"
            variant="outline"
            onClick={handleLogout}
            className="border-beige text-olive-deep hover:bg-btn-secondary text-xs px-4 py-2 self-start sm:self-center"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-beige space-x-2 overflow-x-auto">
        <button
          type="button"
          id="tab-live-map"
          onClick={() => setActiveTab('map')}
          className={`px-4 sm:px-5 py-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'map'
              ? 'border-primary text-olive-deep bg-sage-light/60 rounded-t-xl font-bold'
              : 'border-transparent text-ink-soft hover:text-olive-deep hover:bg-cream rounded-t-xl font-bold'
            }`}
        >
          <MapIcon size={20} />
          <span>Live Bus Map</span>
          {activeTripList.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] bg-primary text-white rounded-full font-mono font-extrabold shadow-soft">
              {activeTripList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="tab-prediction"
          onClick={() => setActiveTab('predict')}
          className={`px-4 sm:px-5 py-3 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'predict'
              ? 'border-primary text-olive-deep bg-sage-light/60 rounded-t-xl font-bold'
              : 'border-transparent text-ink-soft hover:text-olive-deep hover:bg-cream rounded-t-xl font-bold'
            }`}
        >
          <EtaIcon size={20} />
          <span>ML ETA Prediction</span>
        </button>
      </div>

      {/* Tab 1: Live Map View */}
      {activeTab === 'map' && (
        <div className="space-y-6">
          {/* Controls & Route Selector Bar */}
          <div className="p-4 rounded-2xl bg-cream border border-beige flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-soft">
            <div className="flex flex-col xs:flex-row xs:items-center gap-3">
              <label htmlFor="passenger-route-select" className="text-xs font-bold text-olive-deep uppercase tracking-wider whitespace-nowrap">
                Select Route:
              </label>
              <select
                id="passenger-route-select"
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="px-4 py-2.5 bg-field border border-beige rounded-btn text-sm font-semibold text-olive-deep focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors cursor-pointer shadow-sm"
              >
                {ROUTE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-3 self-end sm:self-center flex-wrap gap-y-2">
              {/* Live Location Toggle */}
              <button
                onClick={() => setLiveLocationEnabled(!liveLocationEnabled)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer transition-colors ${liveLocationEnabled
                    ? 'bg-sage-light border-primary text-olive-deep'
                    : 'bg-btn-secondary border-beige text-ink-soft hover:bg-sage-light/50 hover:text-olive-deep'
                  }`}
              >
                <span>📍</span>
                <span>{liveLocationEnabled ? 'Following Me' : 'Follow Me'}</span>
              </button>

              {/* WS Status Badge */}
              <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${wsStatusBadge.color}`}>
                <span className={`w-2 h-2 rounded-full ${wsStatusBadge.dot}`} />
                <span>{wsStatusBadge.label}</span>
              </div>

              {/* Active buses count */}
              <div className="px-3 py-1 bg-surface border border-beige rounded-full text-xs font-medium text-ink flex items-center space-x-1.5 shadow-sm">
                <span className="text-olive-deep font-bold font-mono">{activeTripList.length}</span>
                <span>active {activeTripList.length === 1 ? 'bus' : 'buses'}</span>
              </div>
            </div>
          </div>

          {/* Passenger Geolocation Error Banner */}
          {passengerGeoError && (
            <div className="p-3.5 rounded-xl bg-beige border border-beige text-olive-deep text-xs flex items-center space-x-2.5">
              <span className="text-lg">📍</span>
              <span>{passengerGeoError}</span>
            </div>
          )}

          {/* WebSocket reconnecting banner */}
          {wsError && wsStatus === 'reconnecting' && (
            <div className="p-3.5 rounded-xl bg-beige border border-beige text-olive-deep text-xs flex items-center space-x-2.5">
              <div className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
              <span>{wsError}</span>
            </div>
          )}

          {/* WebSocket permanently failed banner + Retry */}
          {wsRetryFailed && (
            <div className="p-4 rounded-xl bg-olive-deep border border-olive-deep text-surface text-sm flex items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <span className="text-xl">⚡</span>
                <div>
                  <p className="font-semibold text-surface">Live Stream Disconnected</p>
                  <p className="text-xs mt-0.5 text-surface/80">Could not reconnect. Bus positions may be stale.</p>
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

          {/* Leaflet Map & Active Buses Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Map Container */}
            <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-beige shadow-soft relative bg-cream">
              <div className="h-[360px] sm:h-[520px] w-full relative z-0">
                <MapContainer
                  center={MAP_CENTER}
                  zoom={MAP_ZOOM}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                >
                  <MapViewController
                    activeTrips={activeTripList}
                    stops={STOPS_COORDINATES}
                    passengerLocation={liveLocationEnabled ? passengerLocation : null}
                    isFollowingRef={isFollowingRef}
                  />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Render passenger's real-time location marker if enabled */}
                  {liveLocationEnabled && passengerLocation && (
                    <Marker
                      position={[passengerLocation.lat, passengerLocation.lng]}
                      icon={createPassengerIcon()}
                    >
                      <Popup className="custom-leaflet-popup">
                        <div className="p-1 text-xs text-center font-bold text-olive-deep">
                          📍 You are here
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Render bus stop markers along the corridor */}
                  {STOPS_COORDINATES.map((stop) => (
                    <Marker
                      key={stop.name}
                      position={[stop.lat, stop.lng]}
                      icon={createStopIcon(stop.name, stop.isTerminal)}
                    >
                      <Popup className="custom-leaflet-popup">
                        <div className="p-1 text-xs">
                          <p className="font-bold text-olive-deep">🚏 {stop.name} Stop</p>
                          <p className="text-[10px] text-ink-soft">
                            {stop.isTerminal ? 'Terminal Station' : 'Intermediate Stop'}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* Render animated live bus markers */}
                  {activeTripList.map((trip) => (
                    <AnimatedBusMarker
                      key={trip.trip_id || trip.id}
                      trip={trip}
                      targetLat={trip.lat}
                      targetLng={trip.lng}
                    />
                  ))}
                </MapContainer>

                {/* Map loading skeleton — prevents flash of "no buses" empty state */}
                {mapLoading && <MapLoadingSkeleton />}

                {/* Empty state overlay — only shown after loading is done */}
                {!mapLoading && activeTripList.length === 0 && (
                  <div
                    id="passenger-empty-state"
                    className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-cream/70 backdrop-blur-xs pointer-events-none"
                  >
                    <div className="p-6 rounded-2xl bg-cream border border-beige shadow-soft text-center max-w-sm pointer-events-auto">
                      <div className="w-12 h-12 rounded-2xl bg-sage-light border border-beige flex items-center justify-center text-2xl mx-auto mb-3 shadow-soft">
                        🚏
                      </div>
                      <h3 className="text-base font-heading font-bold text-olive-deep mb-1">
                        No buses currently active on this route
                      </h3>
                      <p className="text-xs text-ink-soft leading-relaxed">
                        Active buses broadcasting GPS location on <strong className="text-olive-deep">{ROUTE_LABELS[selectedRoute]}</strong> will automatically appear in real-time.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar: Active Buses on Route List */}
            <div className="lg:col-span-1 space-y-4">
              <Card title="Active Buses">
                {activeTripList.length === 0 ? (
                  <div className="py-8 text-center text-ink-soft text-xs">
                    <span className="text-2xl block mb-2 opacity-50">📡</span>
                    {mapLoading ? 'Loading…' : 'Waiting for active driver streams…'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeTripList.map((trip) => (
                      <div
                        key={trip.trip_id || trip.id}
                        className="p-3 rounded-xl bg-surface border border-beige hover:border-primary/50 transition-colors space-y-1.5 shadow-soft"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-olive-deep flex items-center space-x-1.5">
                            <span>🚌</span>
                            <span>{trip.bus_name}</span>
                          </span>
                          <span className="text-[10px] font-mono text-olive-deep bg-sage-light px-2 py-0.5 rounded-full border border-primary font-semibold">
                            LIVE
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-soft space-y-0.5 font-mono">
                          <div className="flex justify-between">
                            <span>Lat:</span>
                            <span className="text-olive-deep">{Number(trip.lat).toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Lng:</span>
                            <span className="text-olive-deep">{Number(trip.lng).toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-beige text-[10px] text-ink-soft">
                            <span>Updated:</span>
                            <span>{formatTimeAgo(trip.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Corridor Guide Card */}
              <Card title="Corridor Info">
                <div className="space-y-2 text-xs text-ink-soft leading-relaxed">
                  <div className="flex justify-between py-1 border-b border-beige">
                    <span className="text-ink-soft">Start / End:</span>
                    <span className="font-semibold text-olive-deep">Belman ↔ Udupi</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-beige">
                    <span className="text-ink-soft">Telemetry:</span>
                    <span className="text-olive-deep font-semibold">WebSocket GPS</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-ink-soft">Animation:</span>
                    <span className="text-olive-deep font-semibold">Smooth interpolation</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: ML ETA Prediction */}
      {activeTab === 'predict' && (
        <PredictionTab />
      )}
    </div>
  );
};

export default PassengerPage;
