// BusTracker icon set: olive, cream and amber. Inline SVG, no dependencies.
// Usage: import { BusLogo, LockIcon, UserIcon, MapIcon, EtaIcon, AssistantIcon } from "./Icons";
//        <BusLogo size={40} />   <MapIcon size={20} />

const OLIVE = "#566038";
const OLIVE_LIGHT = "#6B7347";
const SAGE = "#E3E7D6";
const SAGE_EDGE = "#CDD3B7";
const AMBER = "#E3A93B";

export function BusLogo({ size = 40, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label="BusTracker">
      <rect width="48" height="48" rx="12" fill={OLIVE_LIGHT} />
      <path d="M20 11.5a5.5 5.5 0 0 1 8 0" fill="none" stroke={AMBER} strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 8.2a10.5 10.5 0 0 1 15 0" fill="none" stroke={AMBER} strokeWidth="2" strokeLinecap="round" />
      <rect x="15" y="35" width="5" height="5" rx="2" fill="#C9D0B0" />
      <rect x="28" y="35" width="5" height="5" rx="2" fill="#C9D0B0" />
      <rect x="12" y="15" width="24" height="21" rx="5" fill="#FFFFFF" />
      <rect x="15.5" y="18.5" width="17" height="8.5" rx="2" fill={OLIVE_LIGHT} />
      <rect x="15.5" y="29" width="17" height="2" rx="1" fill={AMBER} />
      <circle cx="18" cy="33.4" r="1.5" fill={AMBER} />
      <circle cx="30" cy="33.4" r="1.5" fill={AMBER} />
    </svg>
  );
}

export function LockIcon({ size = 48, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="47" height="47" rx="11.5" fill={SAGE} stroke={SAGE_EDGE} />
      <path d="M17.5 22v-4.5a6.5 6.5 0 0 1 13 0V22" fill="none" stroke={OLIVE} strokeWidth="3" strokeLinecap="round" />
      <rect x="13" y="22" width="22" height="16" rx="4.5" fill={OLIVE} />
      <circle cx="24" cy="28.6" r="2.6" fill={AMBER} />
      <rect x="23.1" y="29.5" width="1.8" height="4.5" rx="0.9" fill={AMBER} />
    </svg>
  );
}

export function UserIcon({ size = 48, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="47" height="47" rx="11.5" fill={SAGE} stroke={SAGE_EDGE} />
      <circle cx="24" cy="18.5" r="6.5" fill={OLIVE} />
      <path d="M11.5 38c0-7.2 5.6-11.5 12.5-11.5S36.5 30.8 36.5 38z" fill={OLIVE} />
      <path d="M19.5 28.5q4.5 3.6 9 0" fill="none" stroke={AMBER} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Small line icons for tabs and buttons (24 x 24)
export function MapIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" fill="none" stroke={OLIVE} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 4v13.5M15 6.5V20" fill="none" stroke={OLIVE} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="11.5" r="2" fill={AMBER} />
    </svg>
  );
}

export function EtaIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke={OLIVE} strokeWidth="1.8" />
      <path d="M12 7.5V12l3.2 2" fill="none" stroke={AMBER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AssistantIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V17h-.5A2.5 2.5 0 0 1 4 14.5z" fill="none" stroke={OLIVE} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 7.6l.95 2.45 2.45.95-2.45.95L12 14.4l-.95-2.45L8.6 11l2.45-.95z" fill={AMBER} />
    </svg>
  );
}
