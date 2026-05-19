import { useEffect, useRef, useState } from 'react';
import PhoneVideoScroll from './PhoneVideoScroll';
import CinematicPath from './explore/CinematicPath';
import ExploreParticles from './explore/ExploreParticles';

export default function ExploreSection() {
  const [visible, setVisible] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const windowH = window.innerHeight;
      const p = Math.max(0, Math.min(1, (windowH - rect.top) / (rect.height + windowH * 0.3)));
      setScrollProgress(p);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section
      ref={ref}
      className="relative py-16 md:py-24 px-4 sm:px-6 md:px-16 overflow-hidden"
      style={{
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
        transition: 'opacity 0.8s ease',
        opacity: visible ? 1 : 0,
        minHeight: '100vh',
      }}
    >
      {/* Subtle tint */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,12,22,0.35)', zIndex: 0, pointerEvents: 'none' }} />

      {/* Floating particles */}
      <ExploreParticles />

      {/* Volumetric fog gradient */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 50% at 20% 10%, rgba(0,180,200,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(15,60,90,0.12) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 max-w-6xl mx-auto">

        {/* Heading */}
        <div
          style={{
            transition: 'opacity 0.9s ease 0.1s, transform 0.9s ease 0.1s',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
          }}
          className="mb-4"
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(56,189,248,0.85)', border: '1px solid rgba(56,189,248,0.22)',
            borderRadius: 999, padding: '4px 14px', background: 'rgba(56,189,248,0.07)', marginBottom: 16,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', display: 'inline-block' }} />
            Discover
          </div>

          <h2 style={{ fontSize: 'clamp(2rem, 6vw, 4.5rem)', fontWeight: 900, lineHeight: 1.05, color: '#fff', marginBottom: 16, letterSpacing: '-0.02em' }}>
            EXPLORE
            <br />
            <span style={{ background: 'linear-gradient(90deg, #38bdf8, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Real stories. Real places.
            </span>
          </h2>

          <p style={{ color: 'rgba(255,255,255,0.58)', fontSize: 'clamp(1rem, 2vw, 1.2rem)', lineHeight: 1.7, maxWidth: 600, marginBottom: 20 }}>
            A travel platform powered by authentic traveler and creator content —
            turning endless scrolling into your next unforgettable journey.
          </p>

          {/* Glowing underline */}
          <div style={{
            height: 3, width: visible ? 220 : 0, borderRadius: 4,
            background: 'linear-gradient(90deg, #1a7fa0, #38bdf8, transparent)',
            boxShadow: '0 0 12px rgba(56,189,248,0.6)',
            transition: 'width 1s cubic-bezier(0.22,1,0.36,1) 0.5s',
          }} />
        </div>

        {/* Main content: path + phone */}
        <div className="hidden md:flex" style={{ alignItems: 'flex-start', gap: 0, position: 'relative', marginTop: 8 }}>

          {/* Cinematic path on left */}
          <div style={{ flex: '1 1 auto', position: 'relative', height: 540 }}>
            <CinematicPath progress={scrollProgress} visible={visible} />
          </div>

          {/* Phone on right */}
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              transition: 'opacity 1s ease 0.6s, transform 1s ease 0.6s',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(60px)',
              marginTop: 20,
            }}
          >
            {/* Label */}
            <div style={{
              background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14,
              padding: '8px 20px', color: '#fff', fontSize: 'clamp(0.75rem, 1.5vw, 1rem)',
              fontWeight: 600, letterSpacing: '0.03em', textAlign: 'center',
            }}>
              Inspiration starts with a scroll.
            </div>

            <PhoneVideoScroll visible={visible} />

            {/* CTA */}
            <button
              style={{
                padding: '12px 32px', borderRadius: 999, fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.1))',
                border: '1px solid rgba(56,189,248,0.5)', color: '#38bdf8',
                cursor: 'pointer', letterSpacing: '0.06em',
                boxShadow: '0 0 20px rgba(56,189,248,0.2)',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(56,189,248,0.25)';
                e.currentTarget.style.boxShadow = '0 0 32px rgba(56,189,248,0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.1))';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(56,189,248,0.2)';
              }}
            >
              Start Exploring Now →
            </button>
          </div>
        </div>

        {/* Mobile: phone only */}
        <div className="md:hidden flex flex-col items-center gap-6 mt-8">
          <PhoneVideoScroll visible={visible} />
          <button style={{
            padding: '12px 32px', borderRadius: 999, fontSize: 14, fontWeight: 700,
            background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.4)',
            color: '#38bdf8', cursor: 'pointer',
          }}>
            Start Exploring Now →
          </button>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            marginTop: 48, textAlign: 'center',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.8s ease 1.2s, transform 0.8s ease 1.2s',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontStyle: 'italic', letterSpacing: '0.04em' }}>
            "Inspiration starts with a scroll. Your adventure starts with{' '}
            <span style={{ color: '#38bdf8', fontWeight: 700, fontStyle: 'normal' }}>Roamerz</span>."
          </p>
        </div>

      </div>
    </section>
  );
}