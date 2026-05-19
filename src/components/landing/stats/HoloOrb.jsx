export default function HoloOrb() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes orbitRing {
          from { transform: rotateZ(0deg) rotateX(70deg); }
          to   { transform: rotateZ(360deg) rotateX(70deg); }
        }
        @keyframes orbitRing2 {
          from { transform: rotateZ(120deg) rotateX(55deg) rotateY(20deg); }
          to   { transform: rotateZ(480deg) rotateX(55deg) rotateY(20deg); }
        }
        @keyframes weightPulse {
          0%, 100% { font-variation-settings: 'wght' 900; }
          50%       { font-variation-settings: 'wght' 200; }
        }
        @keyframes rimSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* Outer ambient glow */}
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(26,127,160,0.18) 0%, transparent 70%)',
        filter: 'blur(24px)',
        transform: 'scale(1.4)',
      }} />

      {/* Orbit ring 1 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{
          width: 260, height: 260,
          borderRadius: '50%',
          border: '1px solid rgba(56,189,248,0.25)',
          animation: 'orbitRing 6s linear infinite',
          boxShadow: '0 0 8px rgba(56,189,248,0.15)',
        }} />
      </div>

      {/* Orbit ring 2 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{
          width: 240, height: 240,
          borderRadius: '50%',
          border: '1px solid rgba(168,85,247,0.2)',
          animation: 'orbitRing2 9s linear infinite',
          boxShadow: '0 0 6px rgba(168,85,247,0.1)',
        }} />
      </div>

      {/* Main orb */}
      <div
        className="relative flex flex-col items-center justify-center rounded-full"
        style={{
          width: 220, height: 220,
          background: 'radial-gradient(circle at 35% 35%, rgba(56,189,248,0.25) 0%, rgba(15,23,42,0.9) 60%, rgba(26,127,160,0.15) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(56,189,248,0.3)',
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.08) inset,
            0 4px 0 rgba(255,255,255,0.1) inset,
            0 -2px 0 rgba(0,0,0,0.6) inset,
            0 0 60px rgba(26,127,160,0.35),
            0 0 120px rgba(26,127,160,0.15),
            0 24px 60px rgba(0,0,0,0.6)
          `,
          animation: 'orbFloat 4s ease-in-out infinite',
        }}
      >
        {/* Rim light top */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px rounded-full pointer-events-none" style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
        }} />

        {/* Spinning rim highlight */}
        <div className="absolute inset-2 rounded-full pointer-events-none" style={{
          border: '1px solid transparent',
          borderTopColor: 'rgba(56,189,248,0.5)',
          animation: 'rimSpin 3s linear infinite',
        }} />

        <p className="text-white/60 text-sm font-medium text-center px-4 mb-1 leading-snug" style={{ fontSize: 11 }}>
          Travel should begin with excitement, yet
        </p>

        {/* Metallic gradient 71% */}
        <p
          style={{
            fontSize: 'clamp(4rem, 18vw, 6rem)',
            fontWeight: 900,
            lineHeight: 1,
            background: 'linear-gradient(135deg, #e0f2fe 0%, #38bdf8 30%, #ffffff 50%, #1a7fa0 70%, #7dd3fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 16px rgba(56,189,248,0.7))',
            animation: 'weightPulse 3s ease-in-out infinite',
            fontVariationSettings: "'wght' 900",
          }}
        >
          71%
        </p>

        <p className="text-white/60 text-center px-6 leading-snug" style={{ fontSize: 11 }}>
          of travelers say planning is{' '}
          <span className="text-red-400 font-bold">stressful</span>
        </p>
      </div>
    </div>
  );
}