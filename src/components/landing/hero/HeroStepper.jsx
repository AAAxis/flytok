import { useEffect, useState } from 'react';

const steps = [
  {
    label: 'Imagine',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <defs>
          <radialGradient id="ig" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>
        </defs>
        <circle cx="11" cy="9" r="5" fill="url(#ig)" opacity={active ? 1 : 0.6} />
        <rect x="9.5" y="14" width="3" height="2" rx="1" fill="#fbbf24" opacity={active ? 1 : 0.5} />
        <rect x="10" y="16.5" width="2" height="1.5" rx="0.75" fill="#fbbf24" opacity={active ? 0.8 : 0.4} />
        {active && [0,60,120,180,240,300].map((a,i) => (
          <line key={i}
            x1={11 + 7*Math.cos(a*Math.PI/180)} y1={9 + 7*Math.sin(a*Math.PI/180)}
            x2={11 + 9*Math.cos(a*Math.PI/180)} y2={9 + 9*Math.sin(a*Math.PI/180)}
            stroke="#fde68a" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        ))}
      </svg>
    ),
  },
  {
    label: 'Explore',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <defs>
          <radialGradient id="eg" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#10b981" />
          </radialGradient>
        </defs>
        <circle cx="11" cy="11" r="8" stroke="url(#eg)" strokeWidth="1.5" fill="none" opacity={active ? 0.8 : 0.4} />
        <circle cx="11" cy="11" r="2" fill="url(#eg)" opacity={active ? 1 : 0.5} />
        <line x1="11" y1="3" x2="11" y2="6" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="11" y1="16" x2="11" y2="19" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="3" y1="11" x2="6" y2="11" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="16" y1="11" x2="19" y2="11" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" />
        {active && <polygon points="11,5 13,9 11,8 9,9" fill="#fde68a" opacity="0.9" />}
      </svg>
    ),
  },
  {
    label: 'Curate',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <defs>
          <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <path d="M11 3 C8 3 6 5.5 6 8 C6 12.5 11 18 11 18 C11 18 16 12.5 16 8 C16 5.5 14 3 11 3Z"
          fill="url(#cg)" opacity={active ? 0.9 : 0.5} />
        <circle cx="11" cy="8" r="2.2" fill="white" fillOpacity="0.9" />
        {active && [[-3,-3],[3,-3],[0,3]].map(([dx,dy],i) => (
          <circle key={i} cx={11+dx*1.8} cy={8+dy*1.8} r="1" fill="#fde68a" opacity="0.85" />
        ))}
      </svg>
    ),
  },
  {
    label: 'Depart',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <defs>
          <linearGradient id="dg" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
        </defs>
        <path d="M3 14 L10 11 L8 5 L10.5 6 L14 11 L19 9.5 C20.5 9 21 10 20 10.8 L13 14.5 L12 18 L10 17.5 L10.5 14 Z"
          fill="url(#dg)" opacity={active ? 1 : 0.5} />
        {active && <line x1="2" y1="17" x2="10" y2="15" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />}
      </svg>
    ),
  },
];

export default function HeroStepper({ activeStep }) {
  const [lineWidths, setLineWidths] = useState([0, 0, 0]);

  useEffect(() => {
    const newWidths = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      newWidths[i] = activeStep > i ? 100 : activeStep === i ? 50 : 0;
    }
    setLineWidths(newWidths);
  }, [activeStep]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        background: 'rgba(8,20,35,0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(56,189,248,0.18)',
        borderRadius: 999,
        padding: '8px 12px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        maxWidth: '92vw',
        overflow: 'hidden',
      }}
    >
      {steps.map((step, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        return (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {/* Step pill */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px',
                borderRadius: 999,
                background: isActive
                  ? 'rgba(56,189,248,0.15)'
                  : isDone ? 'rgba(56,189,248,0.07)' : 'transparent',
                border: isActive
                  ? '1px solid rgba(56,189,248,0.45)'
                  : '1px solid transparent',
                boxShadow: isActive
                  ? '0 0 16px rgba(56,189,248,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
                  : 'none',
                transition: 'all 0.4s ease',
                transform: isActive ? 'scale(1.06) translateY(-1px)' : 'scale(1)',
                cursor: 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {/* Icon with pulse on active */}
              <div style={{
                animation: isActive ? 'stepPulse 2s ease-in-out infinite' : 'none',
              }}>
                {step.icon(isActive || isDone)}
              </div>
              <span style={{
                fontSize: 'clamp(10px, 2.5vw, 13px)',
                fontWeight: 700,
                letterSpacing: '0.03em',
                color: isActive ? '#38bdf8'
                  : isDone ? 'rgba(56,189,248,0.6)'
                  : 'rgba(255,255,255,0.45)',
                transition: 'color 0.4s ease',
              }}>
                {step.label}
              </span>
            </div>

            {/* Animated connector line between steps */}
            {i < steps.length - 1 && (
              <div style={{ position: 'relative', width: 'clamp(16px, 4vw, 36px)', height: 2, margin: '0 2px' }}>
                {/* Base dim line */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(56,189,248,0.12)',
                  borderRadius: 2,
                }} />
                {/* Glowing fill */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${lineWidths[i]}%`,
                  background: 'linear-gradient(90deg, #1a7fa0, #38bdf8)',
                  borderRadius: 2,
                  boxShadow: '0 0 8px rgba(56,189,248,0.8)',
                  transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)',
                }} />
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes stepPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}