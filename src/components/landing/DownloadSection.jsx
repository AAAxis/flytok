import { useEffect, useRef, useState } from 'react';
import { Apple, Play, Lock } from 'lucide-react';

export default function DownloadSection() {
  const [visible, setVisible] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const StoreBtn = ({ name, Icon, sub }) => {
    const [hovered, setHovered] = useState(false);
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 28px', borderRadius: 18, cursor: 'not-allowed',
          background: hovered ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          border: hovered ? '1px solid rgba(56,189,248,0.35)' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: hovered ? '0 0 32px rgba(56,189,248,0.18), 0 8px 32px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.3)',
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
          transition: 'all 0.3s cubic-bezier(0.23,1,0.32,1)',
          minWidth: 'min(200px, 80vw)', width: '100%', maxWidth: 260, position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Shine effect */}
        {hovered && (
          <div style={{
            position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
            animation: 'shineSlide 0.6s ease forwards',
          }} />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Lock size={14} style={{ color: 'rgba(255,255,255,0.3)', position: 'absolute', top: -6, right: -6 }} />
          <Icon size={30} style={{ color: hovered ? '#38bdf8' : 'rgba(255,255,255,0.5)', transition: 'color 0.3s ease' }} />
        </div>
        <div style={{ zIndex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{sub}</div>
          <div style={{ color: hovered ? '#fff' : 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 16, transition: 'color 0.3s ease' }}>{name}</div>
          <div style={{ color: 'rgba(56,189,248,0.6)', fontSize: 10, marginTop: 1 }}>Coming Soon</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes shineSlide { from { left: -100% } to { left: 150% } }
        @keyframes pulseGlow { 0%,100% { opacity:0.6 } 50% { opacity:1 } }
      `}</style>
      <section
        id="download"
        ref={ref}
        className="relative py-16 md:py-24 px-4 sm:px-6 md:px-16 overflow-hidden"
        style={{
          background: 'transparent',
          position: 'relative',
          zIndex: 10,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        {/* Top glow */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.3), transparent)' }} />

        {/* BG radial glow */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(56,189,248,0.05) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">

          {/* Badge */}
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s',
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24,
            background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 999, padding: '6px 18px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', display: 'inline-block', animation: 'pulseGlow 2s ease infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Downloaded by <strong style={{ color: '#38bdf8' }}>47,291</strong> travelers this month</span>
          </div>

          {/* Headline */}
          <div style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s',
            marginBottom: 12,
          }}>
            <h2 style={{ fontSize: 'clamp(2rem, 6vw, 4.5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff', margin: 0 }}>
              Ready to Start
              <br />
              <span style={{ background: 'linear-gradient(90deg, #38bdf8, #67e8f9, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Your Journey?
              </span>
            </h2>
          </div>

          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: 16, marginBottom: 40, lineHeight: 1.7,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease 0.35s',
          }}>
            Download Roamerz. Your next adventure is one tap away.
          </p>

          {/* Store buttons */}
          <div className="flex flex-col sm:flex-row" style={{
            gap: 14, justifyContent: 'center', alignItems: 'center',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.8s ease 0.45s, transform 0.8s ease 0.45s',
            marginBottom: 48,
          }}>
            <StoreBtn name="App Store" Icon={Apple} sub="Download on the" />
            <StoreBtn name="Google Play" Icon={Play} sub="Get it on" />
          </div>

          {/* QR placeholder */}
          <div style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease 0.6s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(56,189,248,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>📱</div>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: '0.06em' }}>Scan to download</span>
          </div>

        </div>
      </section>
    </>
  );
}