import { useEffect, useRef } from 'react';

/**
 * Full-page cinematic background — absolute positioned to span the entire scroll height.
 * Gradient + nebula orbs + ambient particles.
 */
export default function CinematicBackground() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colorMap = { '#38bdf8': '56,189,248', '#fbbf24': '251,191,36' };

    const particles = Array.from({ length: 30 }, () => { // Reduced particle count
      const color = Math.random() > 0.5 ? '#38bdf8' : '#fbbf24';
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.15, // Slower movement
        vy: (Math.random() - 0.5) * 0.1,
        r: 0.8 + Math.random() * 1.2, // Smaller particles
        alpha: 0.05 + Math.random() * 0.15,
        color,
        _rgb: colorMap[color],
      };
    });

    const animateFixed = () => {
      animRef.current = requestAnimationFrame(animateFixed);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p._rgb},${p.alpha})`;
        ctx.fill();
      });
    };

    animRef.current = requestAnimationFrame(animateFixed);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      {/* ── Continuous vertical gradient spanning the full page ── */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `linear-gradient(
            180deg,
            #050e1a 0%,
            #071524 8%,
            #0a1e2a 16%,
            #071828 24%,
            #081422 32%,
            #071220 40%,
            #09182c 50%,
            #0b1e34 58%,
            #091828 68%,
            #081422 78%,
            #060f1c 88%,
            #050c18 100%
          )`,
        }}
      />

      {/* ── Nebula orbs — absolute, spread across full page height ── */}
      <div style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', top: '2%', left: '-8vw', width: '55vw', height: '40vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(16,100,80,0.15) 0%, transparent 70%)', filter: 'blur(70px)' }} />
      <div style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', top: '8%', right: '-5vw', width: '40vw', height: '35vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(56,189,248,0.09) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', top: '20%', left: '15vw', width: '65vw', height: '30vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(16,180,120,0.07) 0%, transparent 65%)', filter: 'blur(90px)' }} />
      <div style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', top: '35%', left: '-5vw', width: '50vw', height: '40vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(20,80,140,0.14) 0%, transparent 65%)', filter: 'blur(70px)' }} />
      <div style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', top: '48%', right: '-5vw', width: '45vw', height: '40vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(34,211,238,0.07) 0%, transparent 65%)', filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', top: '62%', left: '10vw', width: '55vw', height: '35vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(56,189,248,0.08) 0%, transparent 65%)', filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', top: '78%', right: '5vw', width: '40vw', height: '35vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(251,191,36,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none', bottom: '2%', left: '20vw', width: '55vw', height: '30vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(16,60,100,0.15) 0%, transparent 65%)', filter: 'blur(80px)' }} />

      {/* ── Ambient particle canvas (viewport-fixed for performance) ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />

      {/* ── Scan lines ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.018) 3px, rgba(0,0,0,0.018) 4px)',
        mixBlendMode: 'multiply',
      }} />
    </>
  );
}