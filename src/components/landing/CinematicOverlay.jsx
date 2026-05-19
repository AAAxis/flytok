import { useEffect, useRef } from 'react';

/**
 * Full-screen grain noise + vignette overlay.
 * Renders once on a canvas and updates ~24fps for film-grain feel.
 * Sits above everything with pointer-events:none so it never blocks clicks.
 */
export default function CinematicOverlay({ grainOpacity = 0.045, vignetteOpacity = 0.72 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const drawGrain = () => {
      const { width: w, height: h } = canvas;
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        data[i]     = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = (Math.random() * 40) | 0; // Reduced grain opacity
      }
      ctx.putImageData(imageData, 0, 0);
    };

    let last = 0;
    const loop = (ts) => {
      rafRef.current = requestAnimationFrame(loop);
      if (ts - last < 60) return; // ~16fps for better performance
      last = ts;
      drawGrain();
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      {/* Grain canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
          opacity: grainOpacity * 0.6, // Reduced grain intensity
          mixBlendMode: 'overlay',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9997,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
        }}
      />
    </>
  );
}