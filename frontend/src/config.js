// Dynamic API and WebSocket Base URLs
// Automatically resolves to current device/host IP (e.g. 192.168.x.x or localhost)

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  const hostname = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${hostname}:8000`;
};

export const getWsBaseUrl = () => {
  const envWsUrl = import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_WS_URL;
  if (envWsUrl && !envWsUrl.includes('localhost') && !envWsUrl.includes('127.0.0.1')) {
    return envWsUrl;
  }
  const hostname = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${hostname}:8000`;
};

export const API_BASE = getApiBaseUrl();
export const WS_BASE = getWsBaseUrl();
