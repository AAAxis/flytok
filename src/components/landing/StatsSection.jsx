import { useEffect, useRef, useState } from 'react';
import HoloOrb from './stats/HoloOrb';
import { PuzzleIcon3D, StackIcon3D, WrenchIcon3D, QuestionOrbIcon3D } from './stats/Icons3D';
import SpringCard from './stats/SpringCard';

const painPoints = [
  { Icon: PuzzleIcon3D, text: 'Collect scattered information from dozens of sources' },
  { Icon: StackIcon3D,  text: 'Compare endless recommendations with no clear answer' },
  { Icon: WrenchIcon3D, text: 'Build the trip manually, piece by piece' },
  { Icon: QuestionOrbIcon3D, text: 'Guess what the experience will actually be like' },
];


export default function StatsSection() {
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

  return (
    <section
      ref={ref}
      className="relative py-16 md:py-20 px-4 md:px-16 overflow-hidden"
      style={{
        transition: 'opacity 0.8s ease',
        opacity: visible ? 1 : 0,
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Subtle section tint for readability */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,14,22,0.38)', zIndex: 0 }} />
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
      `}</style>

      <div className="relative z-10 max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10" style={{ position: 'relative', zIndex: 1 }}>

        {/* Holographic orb card */}
        <SpringCard
          delay={0.1}
          className="flex-shrink-0 w-full md:w-auto flex items-center justify-center rounded-3xl p-6"
          style={{
            background: 'rgba(12,24,44,0.72)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(56,189,248,0.22)',
            animation: 'floatY 5s ease-in-out 0s infinite',
          }}
        >
          <HoloOrb />
        </SpringCard>

        {/* Pain point cards */}
        <div className="flex flex-col gap-3 w-full">
          {painPoints.map(({ Icon, text }, i) => (
            <SpringCard
              key={i}
              delay={0.25 + i * 0.12}
              className="flex items-center gap-4 rounded-xl px-5 py-4"
              style={{
                background: 'rgba(12,24,44,0.72)',
                backdropFilter: 'blur(22px)',
                WebkitBackdropFilter: 'blur(22px)',
                border: '1px solid rgba(251,191,36,0.18)',
                animation: visible ? `floatY 4s ease-in-out ${i * 0.5}s infinite` : 'none',
              }}
            >
              <div className="flex-shrink-0">
                <Icon />
              </div>
              <p className="text-red-300 font-semibold text-xs md:text-base">{text}</p>
            </SpringCard>
          ))}
        </div>

      </div>
    </section>
  );
}