import { useEffect, useRef } from 'react';

// Floating firefly/pollen particles rendered on canvas
export default function HeroParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const N = 40; // Reduced particle count for performance
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4, // Smaller particles
      vx: (Math.random() - 0.5) * 0.2, // Slower movement
      vy: -(Math.random() * 0.3 + 0.08),
      alpha: Math.random() * 0.6 + 0.2,
      alphaDir: Math.random() > 0.5 ? 1 : -1,
      alphaSpeed: Math.random() * 0.005 + 0.002,
      hue: Math.random() > 0.6 ? 190 : Math.random() > 0.5 ? 48 : 155,
    }));

    let rafId;
    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha += p.alphaDir * p.alphaSpeed;
        if (p.alpha > 1) { p.alpha = 1; p.alphaDir = -1; }
        if (p.alpha < 0) { p.alpha = 0; p.alphaDir = 1; }
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},80%,70%,${p.alpha * 0.7})`; // Simpler rendering
        ctx.fill();
      }
      rafId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 3, mixBlendMode: 'screen',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    />
  );
}