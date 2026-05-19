/**
 * Glowing 3D-layered SVG icons for the WhyRoamerz cards.
 * Each icon:
 *  - Has multi-stop gradients for depth
 *  - Has a soft glow filter
 *  - Spins / pulses on hover via CSS class `.icon-hovered`
 */

const BASE = 48;

// Shared glow filter definition
function Defs({ id, color }) {
  return (
    <defs>
      <filter id={`glow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <radialGradient id={`orb-${id}`} cx="50%" cy="35%" r="60%">
        <stop offset="0%" stopColor={color} stopOpacity="0.9" />
        <stop offset="100%" stopColor={color} stopOpacity="0.25" />
      </radialGradient>
    </defs>
  );
}

// ── Watch: video frame with play triangle ────────────────────────────────────
export function WatchIcon({ hovered }) {
  return (
    <svg width={BASE} height={BASE} viewBox="0 0 48 48" fill="none"
      style={{ transition: 'transform 0.5s ease', transform: hovered ? 'scale(1.18)' : 'scale(1)' }}>
      <Defs id="watch" color="#38bdf8" />
      {/* Frame */}
      <rect x="4" y="10" width="40" height="28" rx="4"
        fill="url(#orb-watch)" filter="url(#glow-watch)"
        stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.7" />
      {/* Screen shine */}
      <rect x="6" y="12" width="18" height="6" rx="2" fill="white" fillOpacity="0.08" />
      {/* Play triangle */}
      <polygon points="19,17 19,31 33,24"
        fill="#fff" opacity="0.95"
        filter="url(#glow-watch)" />
      {/* Record dot */}
      <circle cx="40" cy="13" r="2.5" fill="#f87171" opacity="0.85" />
    </svg>
  );
}

// ── Explore: glowing map pin with compass ring ───────────────────────────────
export function ExploreIcon({ hovered }) {
  return (
    <svg width={BASE} height={BASE} viewBox="0 0 48 48" fill="none"
      style={{
        transition: 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1)',
        transform: hovered ? 'rotate(20deg) scale(1.18)' : 'rotate(0deg) scale(1)',
      }}>
      <Defs id="explore" color="#34d399" />
      {/* Compass outer ring */}
      <circle cx="24" cy="22" r="14" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.5"
        fill="url(#orb-explore)" filter="url(#glow-explore)" />
      {/* Pin body */}
      <path d="M24 8 C18 8 14 13 14 18 C14 25 24 36 24 36 C24 36 34 25 34 18 C34 13 30 8 24 8Z"
        fill="url(#orb-explore)" stroke="#34d399" strokeWidth="1.2"
        filter="url(#glow-explore)" />
      {/* Pin inner dot */}
      <circle cx="24" cy="18" r="4" fill="white" fillOpacity="0.9" />
      {/* Compass ticks */}
      {[0, 90, 180, 270].map(a => (
        <line key={a}
          x1={24 + 11 * Math.cos((a - 90) * Math.PI / 180)}
          y1={22 + 11 * Math.sin((a - 90) * Math.PI / 180)}
          x2={24 + 14 * Math.cos((a - 90) * Math.PI / 180)}
          y2={22 + 14 * Math.sin((a - 90) * Math.PI / 180)}
          stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.7" />
      ))}
    </svg>
  );
}

// ── Match: sparkling star + AI shimmer waves ─────────────────────────────────
export function MatchIcon({ hovered }) {
  return (
    <svg width={BASE} height={BASE} viewBox="0 0 48 48" fill="none"
      style={{
        transition: 'transform 0.5s ease',
        transform: hovered ? 'scale(1.2) rotate(-10deg)' : 'scale(1)',
        filter: hovered ? 'drop-shadow(0 0 8px rgba(167,139,250,0.9))' : 'none',
      }}>
      <Defs id="match" color="#a78bfa" />
      {/* Outer glow orb */}
      <circle cx="24" cy="24" r="16" fill="url(#orb-match)" filter="url(#glow-match)" opacity="0.6" />
      {/* Big star */}
      <path d="M24 8 L26.5 19 L38 19 L29 26.5 L32 38 L24 31 L16 38 L19 26.5 L10 19 L21.5 19Z"
        fill="#c4b5fd" stroke="#7c3aed" strokeWidth="0.8"
        filter="url(#glow-match)" />
      {/* Small sparkles */}
      <circle cx="10" cy="12" r="2" fill="#e9d5ff" opacity="0.8" />
      <circle cx="38" cy="10" r="1.5" fill="#e9d5ff" opacity="0.7" />
      <circle cx="40" cy="34" r="1.8" fill="#e9d5ff" opacity="0.6" />
      {/* AI wave lines */}
      <path d="M8 38 Q12 34 16 38 Q20 42 24 38" stroke="#a78bfa" strokeWidth="1.2" strokeOpacity="0.6" fill="none" />
      <path d="M24 38 Q28 34 32 38 Q36 42 40 38" stroke="#a78bfa" strokeWidth="1.2" strokeOpacity="0.4" fill="none" />
    </svg>
  );
}

// ── Share: paper plane with glowing trail ────────────────────────────────────
export function ShareIcon({ hovered }) {
  return (
    <svg width={BASE} height={BASE} viewBox="0 0 48 48" fill="none"
      style={{
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        transform: hovered ? 'translateX(6px) translateY(-6px) scale(1.15)' : 'translate(0,0) scale(1)',
        filter: hovered ? 'drop-shadow(0 0 10px rgba(56,189,248,0.8))' : 'none',
      }}>
      <Defs id="share" color="#38bdf8" />
      {/* Trail lines */}
      <line x1="6" y1="30" x2="18" y2="28" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.4" strokeDasharray="2 3" />
      <line x1="6" y1="36" x2="16" y2="32" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="2 4" />
      {/* Plane body */}
      <path d="M8 24 L42 12 L30 42 L22 30Z"
        fill="url(#orb-share)" stroke="#38bdf8" strokeWidth="1.2"
        filter="url(#glow-share)" />
      {/* Fold line */}
      <line x1="22" y1="30" x2="42" y2="12" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />
      {/* Nose highlight */}
      <circle cx="40" cy="13" r="2" fill="white" fillOpacity="0.7" />
    </svg>
  );
}

// ── Plan: calendar with route dotted line ────────────────────────────────────
export function PlanIcon({ hovered }) {
  return (
    <svg width={BASE} height={BASE} viewBox="0 0 48 48" fill="none"
      style={{
        transition: 'transform 0.45s ease',
        transform: hovered ? 'scale(1.16) rotateY(15deg)' : 'scale(1)',
        filter: hovered ? 'drop-shadow(0 0 8px rgba(251,191,36,0.7))' : 'none',
      }}>
      <Defs id="plan" color="#fbbf24" />
      {/* Calendar body */}
      <rect x="6" y="12" width="36" height="30" rx="4" fill="url(#orb-plan)"
        stroke="#fbbf24" strokeWidth="1.3" strokeOpacity="0.7" filter="url(#glow-plan)" />
      {/* Header strip */}
      <rect x="6" y="12" width="36" height="10" rx="4" fill="#fbbf24" fillOpacity="0.35" />
      {/* Binding pins */}
      <rect x="14" y="8" width="3" height="8" rx="1.5" fill="#fbbf24" strokeOpacity="0.8" />
      <rect x="31" y="8" width="3" height="8" rx="1.5" fill="#fbbf24" strokeOpacity="0.8" />
      {/* Grid dots */}
      {[16,24,32].map(x => [26,32,38].map(y => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="white" fillOpacity="0.4" />
      )))}
      {/* Route line */}
      <path d="M16 26 Q24 20 32 26 Q38 30 32 38" stroke="#fbbf24" strokeWidth="1.5"
        strokeDasharray="2.5 2.5" fill="none" strokeLinecap="round" opacity="0.8" />
      <circle cx="16" cy="26" r="2.5" fill="#fbbf24" opacity="0.9" />
      <circle cx="32" cy="38" r="2.5" fill="#fbbf24" opacity="0.9" />
    </svg>
  );
}

// ── Save: heart with bookmark ribbon ────────────────────────────────────────
export function SaveIcon({ hovered }) {
  return (
    <svg width={BASE} height={BASE} viewBox="0 0 48 48" fill="none"
      style={{
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        transform: hovered ? 'scale(1.22)' : 'scale(1)',
        filter: hovered ? 'drop-shadow(0 0 10px rgba(244,114,182,0.85))' : 'none',
      }}>
      <Defs id="save" color="#f472b6" />
      {/* Heart */}
      <path d="M24 38 C24 38 8 28 8 18 C8 13 12 9 17 9 C20 9 22.5 10.5 24 13 C25.5 10.5 28 9 31 9 C36 9 40 13 40 18 C40 28 24 38 24 38Z"
        fill="url(#orb-save)" stroke="#f472b6" strokeWidth="1.2"
        filter="url(#glow-save)" />
      {/* Inner highlight */}
      <path d="M16 14 C14 16 13 19 14 22" stroke="white" strokeWidth="1.2" strokeOpacity="0.4"
        strokeLinecap="round" fill="none" />
      {/* Bookmark ribbon */}
      <path d="M30 6 L30 22 L26 18 L22 22 L22 6Z"
        fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.8" opacity="0.92" />
    </svg>
  );
}