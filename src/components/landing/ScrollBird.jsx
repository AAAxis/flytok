import { useEffect, useRef, useState, useCallback } from 'react';
import useIsMobile from './useIsMobile';

const TRAIL_COUNT = 10; // Reduced for performance

export default function ScrollBird() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const scrollYRef = useRef(0);
  const targetYRef = useRef(80);
  const currentYRef = useRef(80);
  const currentXRef = useRef(60);
  const targetXRef = useRef(60);
  const trailRef = useRef([]);
  const timeRef = useRef(0);
  const wingsRef = useRef(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return; // skip bird animation entirely on mobile
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Init trail
    trailRef.current = Array.from({ length: TRAIL_COUNT }, () => ({
      x: 60, y: 80, alpha: 0,
    }));

    const drawBird = (ctx, x, y, wingPhase, scale = 1) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      // Simplified glow (reduced gradient complexity)
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56,189,248,0.12)';
      ctx.fill();

      const flapUp = Math.sin(wingPhase);
      const leftWingY = -4 + flapUp * 6;
      const rightWingY = -4 + flapUp * 6;

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
      const bodyGrad = ctx.createLinearGradient(-7, -4, 7, 4);
      bodyGrad.addColorStop(0, '#e0f2fe');
      bodyGrad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = bodyGrad;
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Simplified wings (no shadows for performance)
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.bezierCurveTo(-10, leftWingY - 2, -16, leftWingY + 2, -12, leftWingY + 6);
      ctx.bezierCurveTo(-8, leftWingY + 4, -4, 2, -2, 0);
      ctx.fillStyle = 'rgba(56,189,248,0.85)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.bezierCurveTo(10, rightWingY - 2, 16, rightWingY + 2, 12, rightWingY + 6);
      ctx.bezierCurveTo(8, rightWingY + 4, 4, 2, 2, 0);
      ctx.fillStyle = 'rgba(56,189,248,0.85)';
      ctx.fill();

      // Simplified eye
      ctx.beginPath();
      ctx.arc(4, -1, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      ctx.restore();
    };

    const drawTrail = (ctx, trail) => {
      trail.forEach((pt, i) => {
        if (pt.alpha <= 0) return;
        const t = i / TRAIL_COUNT;
        const size = 2 + t * 3; // Smaller particles
        const alpha = pt.alpha * (1 - t * 0.7);

        // Simplified particles (no radial gradients)
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 
          ? `rgba(251,191,36,${alpha * 0.7})` 
          : `rgba(56,189,248,${alpha * 0.5})`;
        ctx.fill();
      });
    };

    const animate = (ts) => {
      animRef.current = requestAnimationFrame(animate);
      timeRef.current = ts * 0.001;
      wingsRef.current = ts * 0.004;

      const scroll = scrollYRef.current;
      const pageH = document.body.scrollHeight - window.innerHeight;
      const scrollPct = pageH > 0 ? scroll / pageH : 0;

      // Bird follows scroll: starts top-left, floats gently down-right with scroll
      const baseX = 64 + scrollPct * 40;
      const baseY = 80 + scroll * 0.12 + Math.sin(timeRef.current * 0.6) * 6;

      targetXRef.current = baseX;
      targetYRef.current = Math.min(baseY, window.innerHeight * 0.88 + scroll);

      // Faster lerp for smoother tracking
      currentXRef.current += (targetXRef.current - currentXRef.current) * 0.15;
      currentYRef.current += (targetYRef.current - currentYRef.current) * 0.15;

      const bx = currentXRef.current;
      const by = currentYRef.current - scroll; // screen-space Y

      // Clamp to viewport
      const visY = Math.max(30, Math.min(window.innerHeight - 40, by));

      // Update trail
      for (let i = TRAIL_COUNT - 1; i > 0; i--) {
        trailRef.current[i].x = trailRef.current[i - 1].x;
        trailRef.current[i].y = trailRef.current[i - 1].y;
        trailRef.current[i].alpha = trailRef.current[i - 1].alpha * 0.88; // Faster fade
      }
      trailRef.current[0].x = bx;
      trailRef.current[0].y = visY;
      trailRef.current[0].alpha = 0.5; // Reduced trail opacity

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw trail
      drawTrail(ctx, trailRef.current);

      // Draw bird
      drawBird(ctx, bx, visY, wingsRef.current, 1);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    />
  );
}