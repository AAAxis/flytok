import { useEffect, useRef, useState } from 'react';
import HeroParticles from './HeroParticles';
import HeroStepper from './HeroStepper';

export default function HeroSection() {
  const [mounted, setMounted] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef(null);

  // Mount fade-in
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Throttled mouse parallax for performance
  useEffect(() => {
    let ticking = false;
    const onMove = (e) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        setParallax({
          x: (e.clientX - cx) / cx * 0.5, // Reduced parallax intensity
          y: (e.clientY - cy) / cy * 0.5,
        });
        ticking = false;
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Step progress on scroll
  useEffect(() => {
    const onScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / (rect.height * 0.6)));
      setActiveStep(Math.min(3, Math.floor(progress * 4)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const px = parallax.x;
  const py = parallax.y;

  return (
    <section
      id="home"
      ref={sectionRef}
      className="relative min-h-screen flex items-center pt-16 overflow-hidden"
    >
      {/* ── Video background ─────────────────────────────────── */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/5511bd27d_generated_video.mp4"
        autoPlay loop muted playsInline preload="auto"
        style={{
          transform: `scale(1.04) translate(${px * -6}px, ${py * -4}px)`, // Reduced parallax movement
          transition: 'transform 0.1s linear',
          filter: 'saturate(1.2) contrast(1.05) brightness(0.95)',
          willChange: 'transform',
        }}
      />

      {/* ── Color grade overlays ─────────────────────────────── */}
      {/* Deep teal/emerald base */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(160deg, rgba(5,18,32,0.62) 0%, rgba(8,30,50,0.45) 40%, rgba(4,20,16,0.38) 100%)',
      }} />
      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 35%, rgba(5,14,28,0.78) 100%)',
      }} />
      {/* Fog bottom — bleeds into next section */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(5,12,20,0.95) 0%, rgba(5,14,22,0.6) 40%, transparent 100%)',
      }} />
      {/* Top fade */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '20%', zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(4,10,20,0.6) 0%, transparent 100%)',
      }} />
      {/* Cyan teal tint */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 20% 80%, rgba(16,90,80,0.18) 0%, transparent 60%)',
        mixBlendMode: 'screen',
      }} />

      {/* ── Firefly particles ─────────────────────────────────── */}
      <HeroParticles />

      {/* ── Parallax light ray ───────────────────────────────── */}
      <div style={{
        position: 'absolute', top: '-10%', left: '35%', width: 600, height: '130%',
        background: 'linear-gradient(170deg, rgba(56,189,248,0.03) 0%, rgba(251,191,36,0.02) 50%, transparent 100%)',
        transform: `rotate(-15deg) translate(${px * 8}px, ${py * 5}px)`, // Reduced parallax
        transition: 'transform 0.15s linear',
        pointerEvents: 'none', zIndex: 3,
        borderRadius: '50%',
        willChange: 'transform',
      }} />

      {/* ── TEXT CONTENT ─────────────────────────────────────── */}
      <div
        className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 md:px-20 pb-24 md:pb-40"
        style={{ zIndex: 10 }}
      >
        {/* Eyebrow */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s',
          marginBottom: 20,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(56,189,248,0.8)',
            border: '1px solid rgba(56,189,248,0.25)',
            borderRadius: 999, padding: '5px 16px',
            background: 'rgba(56,189,248,0.07)',
            backdropFilter: 'blur(8px)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', display: 'inline-block' }} />
            The Future of Travel Discovery
          </span>
        </div>

        {/* Main headline */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 1s ease 0.25s, transform 1s ease 0.25s',
          marginBottom: 20,
        }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 6.5vw, 5.5rem)',
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: '#fff',
            textShadow: '0 2px 40px rgba(0,0,0,0.8), 0 0 80px rgba(56,189,248,0.12)',
            margin: 0,
          }}>
            Travel is one of the world's<br />
            <span style={{
              background: 'linear-gradient(90deg, #e0f2fe 0%, #38bdf8 40%, #67e8f9 70%, #fde68a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 20px rgba(56,189,248,0.4))',
            }}>
              most universal aspirations.
            </span>
          </h1>
        </div>

        {/* Tagline */}
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 1s ease 0.5s, transform 1s ease 0.5s',
          marginBottom: 36,
        }}>
          <p style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.65,
            maxWidth: 600,
            margin: 0,
          }}>
            Roamerz turns inspiration into your perfect trip —&nbsp;
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>in minutes.</span>
          </p>
        </div>


      </div>

      {/* ── Scroll indicator ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        opacity: mounted ? 0.7 : 0,
        transition: 'opacity 1s ease 1.2s',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
          Scroll to explore
        </span>
        <div style={{
          width: 1, height: 36,
          background: 'linear-gradient(to bottom, rgba(56,189,248,0.6), transparent)',
          animation: 'scrollPulse 2s ease-in-out infinite',
        }} />
        <style>{`@keyframes scrollPulse { 0%,100%{opacity:0.5;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.15)} }`}</style>
      </div>

      {/* ── Stepper bar ──────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', justifyContent: 'center',
        paddingBottom: 28,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 1s ease 1s, transform 1s ease 1s',
      }}>
        <HeroStepper activeStep={activeStep} />
      </div>
    </section>
  );
}