export function PuzzleIcon3D() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.4" />
        </linearGradient>
        <filter id="pglow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Shadow */}
      <ellipse cx="18" cy="33" rx="10" ry="2.5" fill="rgba(0,0,0,0.35)" />
      {/* Main piece - bottom face (dark) */}
      <path d="M8 22 L18 28 L28 22 L18 16 Z" fill="#b45309" />
      {/* Main piece - right face */}
      <path d="M18 28 L28 22 L28 14 L18 20 Z" fill="#d97706" />
      {/* Main piece - top face */}
      <path d="M8 14 L18 20 L28 14 L18 8 Z" fill="url(#pg1)" filter="url(#pglow)" />
      {/* Nub top */}
      <circle cx="18" cy="5.5" r="3.5" fill="url(#pg1)" />
      <circle cx="18" cy="5.5" r="3.5" fill="url(#pg2)" />
      {/* Nub right */}
      <circle cx="30.5" cy="18" r="3.5" fill="#d97706" />
      {/* Highlight */}
      <path d="M10 14 L18 9.5 L26 14" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function StackIcon3D() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sl1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="sl2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
        <linearGradient id="sl3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <ellipse cx="18" cy="34" rx="10" ry="2" fill="rgba(0,0,0,0.3)" />
      {/* Bottom layer */}
      <path d="M6 24 L18 30 L30 24 L18 18 Z" fill="#0e7490" />
      <path d="M6 21 L18 27 L30 21 L18 15 Z" fill="url(#sl3)" />
      <path d="M6 21 L6 24 L18 30 L18 27 Z" fill="#075985" />
      <path d="M30 21 L30 24 L18 30 L18 27 Z" fill="#0c4a6e" />
      {/* Mid layer */}
      <path d="M6 16 L18 22 L30 16 L18 10 Z" fill="#0891b2" />
      <path d="M6 13 L18 19 L30 13 L18 7 Z" fill="url(#sl2)" />
      <path d="M6 13 L6 16 L18 22 L18 19 Z" fill="#0c7a9a" />
      <path d="M30 13 L30 16 L18 22 L18 19 Z" fill="#065f7a" />
      {/* Top layer */}
      <path d="M6 8 L18 14 L30 8 L18 2 Z" fill="url(#sl1)" />
      <path d="M6 8 L6 11 L18 17 L18 14 Z" fill="#0891b2" />
      <path d="M30 8 L30 11 L18 17 L18 14 Z" fill="#0369a1" />
      {/* Highlights */}
      <path d="M9 8 L18 3.5 L27 8" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

export function WrenchIcon3D() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wl1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="30%" stopColor="#94a3b8" />
          <stop offset="60%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="wl2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <filter id="wglow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="18" cy="34" rx="8" ry="1.8" fill="rgba(0,0,0,0.3)" />
      {/* Handle */}
      <rect x="14" y="14" width="8" height="16" rx="2" fill="url(#wl1)" />
      <rect x="15.5" y="14" width="2" height="16" rx="1" fill="rgba(255,255,255,0.35)" />
      {/* Head */}
      <rect x="9" y="6" width="18" height="11" rx="3" fill="url(#wl1)" filter="url(#wglow)" />
      <rect x="9" y="6" width="18" height="5" rx="3" fill="url(#wl2)" />
      {/* Jaw gap */}
      <rect x="9" y="9.5" width="5" height="4" rx="1" fill="#0f172a" />
      <rect x="22" y="9.5" width="5" height="4" rx="1" fill="#0f172a" />
      {/* Highlight */}
      <path d="M11 7.5 L25 7.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function QuestionOrbIcon3D() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="qg1" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b0764" />
        </radialGradient>
        <radialGradient id="qglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <filter id="qblur">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      {/* Glow halo */}
      <circle cx="18" cy="18" r="16" fill="url(#qglow)" filter="url(#qblur)" />
      {/* Shadow */}
      <ellipse cx="18" cy="33.5" rx="9" ry="2" fill="rgba(0,0,0,0.35)" />
      {/* Orb */}
      <circle cx="18" cy="17" r="14" fill="url(#qg1)" />
      {/* Rim light */}
      <circle cx="18" cy="17" r="14" fill="none" stroke="rgba(196,181,253,0.4)" strokeWidth="0.8" />
      {/* Top specular */}
      <ellipse cx="14" cy="11" rx="4" ry="2.5" fill="rgba(255,255,255,0.3)" transform="rotate(-20 14 11)" />
      {/* ? mark */}
      <text x="18" y="23" textAnchor="middle" fontSize="16" fontWeight="900" fill="white"
        style={{ filter: 'drop-shadow(0 0 6px rgba(196,181,253,0.9))' }}>?</text>
    </svg>
  );
}