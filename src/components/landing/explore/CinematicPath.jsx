import { useEffect, useRef } from 'react';

// S-curve control points
const P = { x: [120, 60, 520, 480], y: [20, 200, 320, 520] };
const CURVE_LENGTH = 700;
const NUM_DOTS = 10;

function bezierPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3;
}
function bezierTangent(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return 3*mt*mt*(p1-p0) + 6*mt*t*(p2-p1) + 3*t*t*(p3-p2);
}

const WAYPOINTS = Array.from({ length: NUM_DOTS }, (_, i) => {
  const t = i / (NUM_DOTS - 1);
  const cx = bezierPoint(t, P.x[0], P.x[1], P.x[2], P.x[3]);
  const cy = bezierPoint(t, P.y[0], P.y[1], P.y[2], P.y[3]);
  const tx = bezierTangent(t, P.x[0], P.x[1], P.x[2], P.x[3]);
  const ty = bezierTangent(t, P.y[0], P.y[1], P.y[2], P.y[3]);
  const angle = Math.atan2(ty, tx) * (180 / Math.PI);
  const isLeft = i % 2 === 0;
  const rad = Math.atan2(ty, tx);
  const side = isLeft ? -1 : 1;
  return {
    cx, cy, angle,
    fx: cx + (-Math.sin(rad) * 18 * side),
    fy: cy + (Math.cos(rad) * 18 * side),
    isLeft,
  };
});

export default function CinematicPath({ progress, visible }) {
  const drawnLength = progress * CURVE_LENGTH;
  const dotsToShow = Math.floor(progress * NUM_DOTS);
  const curveD = `M ${P.x[0]} ${P.y[0]} C ${P.x[1]} ${P.y[1]}, ${P.x[2]} ${P.y[2]}, ${P.x[3]} ${P.y[3]}`;

  // Traveler position along path
  const travelerT = Math.min(progress * 1.1, 1);
  const tx = bezierPoint(travelerT, P.x[0], P.x[1], P.x[2], P.x[3]);
  const ty = bezierPoint(travelerT, P.y[0], P.y[1], P.y[2], P.y[3]);
  const ttx = bezierTangent(travelerT, P.x[0], P.x[1], P.x[2], P.x[3]);
  const tty = bezierTangent(travelerT, P.y[0], P.y[1], P.y[2], P.y[3]);
  const travelerAngle = Math.atan2(tty, ttx) * (180 / Math.PI);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      <svg
        viewBox="0 0 600 540"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          {/* Path glow */}
          <filter id="cpGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="cpGlowStrong" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Golden gradient for path */}
          <linearGradient id="pathGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Faint ghost path */}
        <path
          d={curveD}
          fill="none"
          stroke="rgba(56,189,248,0.08)"
          strokeWidth="2.5"
          strokeDasharray="10 14"
        />

        {/* Outer glow path */}
        <path
          d={curveD}
          fill="none"
          stroke="url(#pathGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#cpGlowStrong)"
          strokeDasharray={`${drawnLength} ${CURVE_LENGTH}`}
          opacity="0.5"
          style={{ transition: 'stroke-dasharray 0.1s linear' }}
        />

        {/* Main animated path */}
        <path
          d={curveD}
          fill="none"
          stroke="url(#pathGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#cpGlow)"
          strokeDasharray={`${drawnLength} ${CURVE_LENGTH}`}
          style={{ transition: 'stroke-dasharray 0.1s linear' }}
        />

        {/* Pulsing waypoint dots */}
        {WAYPOINTS.slice(0, dotsToShow).map((wp, i) => (
          <g key={i}>
            {/* Ripple */}
            <circle cx={wp.cx} cy={wp.cy} r={10} fill="none"
              stroke={i % 2 === 0 ? '#38bdf8' : '#f59e0b'} strokeWidth="1"
              opacity="0.4" filter="url(#dotGlow)"
            />
            {/* Core dot */}
            <circle cx={wp.cx} cy={wp.cy} r={4.5}
              fill={i % 2 === 0 ? '#38bdf8' : '#f59e0b'}
              filter="url(#dotGlow)"
              opacity="0.95"
            />
          </g>
        ))}

        {/* Footprints */}
        {WAYPOINTS.slice(0, dotsToShow).map((wp, i) => (
          <g
            key={`foot-${i}`}
            transform={`translate(${wp.fx}, ${wp.fy}) rotate(${wp.angle + 90}) scale(${wp.isLeft ? -0.55 : 0.55}, 0.55)`}
            filter="url(#cpGlow)"
            style={{ opacity: 0.7 }}
          >
            <ellipse cx="0" cy="9" rx="6.5" ry="7.5" fill="white" />
            <ellipse cx="0" cy="1" rx="5" ry="7" fill="white" />
            <ellipse cx="0" cy="-8" rx="7.5" ry="6" fill="white" />
            <ellipse cx="-7" cy="-15" rx="3" ry="3.5" fill="white" />
            <ellipse cx="-2.5" cy="-17" rx="2.8" ry="3.5" fill="white" />
            <ellipse cx="2" cy="-17.5" rx="2.5" ry="3.2" fill="white" />
            <ellipse cx="6" cy="-16" rx="2.2" ry="3" fill="white" />
            <ellipse cx="9" cy="-13.5" rx="2" ry="2.6" fill="white" />
          </g>
        ))}

        {/* Traveler backpack icon moving along path */}
        {progress > 0.05 && (
          <g transform={`translate(${tx}, ${ty}) rotate(${travelerAngle})`} filter="url(#cpGlowStrong)">
            <circle cx="0" cy="0" r="12" fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="0" y="5" textAnchor="middle" fontSize="12" fill="#fff">✈</text>
          </g>
        )}

        {/* Sparkle particles along revealed path */}
        {[0.15, 0.35, 0.55, 0.75].map((t, i) => {
          if (progress < t) return null;
          const sx = bezierPoint(t, P.x[0], P.x[1], P.x[2], P.x[3]);
          const sy = bezierPoint(t, P.y[0], P.y[1], P.y[2], P.y[3]);
          return (
            <g key={`spark-${i}`}>
              <circle cx={sx + (i % 2 ? 15 : -15)} cy={sy - 8} r={2}
                fill="#f59e0b" opacity="0.7" filter="url(#dotGlow)" />
              <circle cx={sx + (i % 2 ? -10 : 10)} cy={sy + 10} r={1.5}
                fill="#38bdf8" opacity="0.6" filter="url(#dotGlow)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}