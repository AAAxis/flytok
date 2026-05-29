import React from 'react';

/** Roamerz bird symbol — same glyph as the favicon / ScrollBird. */
function Bird({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logoBird" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <g transform="translate(16,16) scale(0.78)">
        <ellipse cx="0" cy="0" rx="7" ry="4" fill="url(#logoBird)" />
        <path d="M-2 0 C-10 -6 -16 -2 -12 2 C-8 0 -4 2 -2 0 Z" fill="#38bdf8" />
        <path d="M2 0 C10 -6 16 -2 12 2 C8 0 4 2 2 0 Z" fill="#38bdf8" />
        <circle cx="4" cy="-1" r="1.1" fill="#fff" />
      </g>
    </svg>
  );
}

export default function Logo({ size = 'md', showText = true }) {
  const sizes = {
    sm: { icon: 'w-4 h-4', text: 'text-lg', container: 'gap-1.5', ring: 'w-7 h-7' },
    md: { icon: 'w-5 h-5', text: 'text-xl', container: 'gap-2', ring: 'w-9 h-9' },
    lg: { icon: 'w-6 h-6', text: 'text-2xl', container: 'gap-2.5', ring: 'w-11 h-11' },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center ${s.container}`}>
      <div className={`${s.ring} rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 p-[2px] shadow-lg shadow-sky-500/30`}>
        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
          <Bird className={s.icon} />
        </div>
      </div>
      {showText && (
        <div className="flex items-baseline">
          <span className={`${s.text} font-extrabold text-white`}>Roam</span>
          <span className={`${s.text} font-extrabold text-sky-400`}>erz</span>
        </div>
      )}
    </div>
  );
}