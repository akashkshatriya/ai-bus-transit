import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export const ToastContext = createContext(null);

let _nextId = 1;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const showToast = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = _nextId++;
      setToasts((prev) => {
        // keep max 3 visible
        const next = prev.length >= 3 ? prev.slice(1) : prev;
        return [...next, { id, message, type }];
      });
      timersRef.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// ── styles per type ──────────────────────────────────────────────────────────
const TYPE_STYLES = {
  success: {
    border: 'border-primary',
    bg: 'bg-sage-light',
    text: 'text-olive-deep',
    icon: '✅',
    bar: 'bg-primary',
    close: 'text-olive-deep/70 hover:text-olive-deep',
  },
  error: {
    border: 'border-olive-deep',
    bg: 'bg-olive-deep',
    text: 'text-surface',
    icon: '❌',
    bar: 'bg-surface',
    close: 'text-surface/80 hover:text-surface',
  },
  warning: {
    border: 'border-beige',
    bg: 'bg-beige',
    text: 'text-olive-deep',
    icon: '⚠️',
    bar: 'bg-primary',
    close: 'text-olive-deep/70 hover:text-olive-deep',
  },
  info: {
    border: 'border-beige',
    bg: 'bg-cream',
    text: 'text-olive-deep',
    icon: 'ℹ️',
    bar: 'bg-primary',
    close: 'text-ink-soft hover:text-ink',
  },
};

function ToastContainer({ toasts, dismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 max-w-[calc(100vw-2rem)] w-80 pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, dismiss }) {
  const s = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-xl border ${s.border} ${s.bg} shadow-soft backdrop-blur-md flex items-start gap-3 p-3.5 animate-slideIn`}
    >
      <span className="text-base leading-none mt-0.5 shrink-0">{s.icon}</span>
      <p className={`text-xs font-semibold leading-relaxed flex-1 ${s.text}`}>{toast.message}</p>
      <button
        onClick={() => dismiss(toast.id)}
        className={`shrink-0 ${s.close || 'text-ink-soft hover:text-ink'} transition-colors text-sm leading-none mt-0.5 cursor-pointer`}
        aria-label="Dismiss"
      >
        ✕
      </button>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-beige/40">
        <div className={`h-full ${s.bar} opacity-60 animate-toastProgress`} />
      </div>
    </div>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
