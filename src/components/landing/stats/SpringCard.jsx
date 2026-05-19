import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useRef } from 'react';

/**
 * A card that lifts and tilts with spring physics on hover.
 * Children are rendered inside a preserve-3d container.
 */
export default function SpringCard({ children, style = {}, className = '', delay = 0 }) {
  const ref = useRef(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const springConfig = { stiffness: 200, damping: 18, mass: 0.8 };
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-10, 10]), springConfig);
  const scale   = useSpring(1, { stiffness: 250, damping: 20 });
  const z       = useSpring(0, { stiffness: 250, damping: 20 });
  const glow    = useSpring(0.15, { stiffness: 200, damping: 20 });

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    rawX.set((e.clientX - rect.left) / rect.width  - 0.5);
    rawY.set((e.clientY - rect.top)  / rect.height - 0.5);
  };

  const handleMouseEnter = () => {
    scale.set(1.04);
    z.set(24);
    glow.set(0.55);
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
    scale.set(1);
    z.set(0);
    glow.set(0.15);
  };

  const boxShadow = useTransform(glow, (g) =>
    `0 0 0 1px rgba(255,255,255,0.06) inset,
     0 2px 0 rgba(255,255,255,0.08) inset,
     0 -1px 0 rgba(0,0,0,0.45) inset,
     -6px 8px 32px rgba(0,0,0,0.55),
     -12px 16px 60px rgba(0,0,0,0.35),
     0 0 ${Math.round(g * 80)}px rgba(26,127,160,${(g * 0.5).toFixed(2)}),
     0 0 ${Math.round(g * 40)}px rgba(56,189,248,${(g * 0.3).toFixed(2)})`
  );

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      style={{
        ...style,
        rotateX,
        rotateY,
        scale,
        translateZ: z,
        boxShadow,
        perspective: 1000,
        transformStyle: 'preserve-3d',
        cursor: 'default',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}