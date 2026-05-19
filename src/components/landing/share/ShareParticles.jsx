import { useEffect, useRef } from 'react';

export default function ShareParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.5 + Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -(0.05 + Math.random() * 0.25),
      opacity: 0.15 + Math.random() * 0.6,
      hue: Math.random() > 0.6 ? 195 : Math.random() > 0.5 ? 42 : 270,
    }));

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.opacity -= 0.001;
        if (p.y < 0 || p.opacity <= 0) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 5;
          p.opacity = 0.2 + Math.random() * 0.5;
        }
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grad.addColorStop(0, `hsla(${p.hue}, 85%, 68%, ${p.opacity})`);
        grad.addColorStop(1, `hsla(${p.hue}, 85%, 68%, 0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} />
  );
}