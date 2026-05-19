import { useEffect, useRef, useState } from 'react';
import WobbleText from './WobbleText';
import FlightPathBackground from './FlightPathBackground';
import { WatchIcon, ExploreIcon, MatchIcon, ShareIcon, PlanIcon, SaveIcon } from './why/GlowIcons';

// Flow: Watch(0)→Explore(1)→Match(2)↓Save(5)←Plan(4)←Share(3)
const cards = [
  { GlowIcon: WatchIcon,   title: 'Watch',   desc: 'Real traveler videos. No generic stock photos.' },
  { GlowIcon: ExploreIcon, title: 'Explore', desc: 'Every destination comes alive on an interactive 3D map.' },
  { GlowIcon: MatchIcon,   title: 'Match',   desc: 'AI that actually understands your travel style.' },
  { GlowIcon: ShareIcon,   title: 'Share',   desc: 'Your moments help the next traveler decide with confidence.' },
  { GlowIcon: PlanIcon,    title: 'Plan',    desc: 'Build a complete itinerary in one beautiful flow.' },
  { GlowIcon: SaveIcon,    title: 'Save',    desc: 'Your dream trip, saved and ready anytime.' },
];

// next card in flow for each index
const nextInFlow = { 0: 1, 1: 2, 2: 5, 5: 4, 4: 3 };

// staggered float offsets: row 0 slightly higher, alternating
const floatOffsets = [-8, -14, -8, 4, -2, 4]; // px translateY per card index

function Card({ card, index, hovered, setHovered, visible, isCardVisible }) {
  const { GlowIcon } = card;
  const isHovered = hovered === index;
  const isTarget = hovered !== null && nextInFlow[hovered] === index;

  const baseY = floatOffsets[index] ?? 0;

  const transform = !isCardVisible
    ? 'scale(0.88) translateY(20px)'
    : isHovered
      ? `perspective(1200px) translateY(${baseY - 12}px) rotateX(8deg) rotateY(-6deg) scale(1.04)`
      : `perspective(1200px) translateY(${baseY}px) scale(1)`;

  const boxShadow = isHovered
    ? [
        '0 2px 0 rgba(255,255,255,0.12) inset',        // inner top highlight
        '0 -1px 0 rgba(56,189,248,0.08) inset',        // inner bottom glow
        '0 8px 32px rgba(26,127,160,0.55)',             // close glow
        '0 20px 60px rgba(0,0,0,0.7)',                  // deep shadow
        '0 0 0 1px rgba(56,189,248,0.4)',               // edge ring
        '0 40px 80px rgba(26,127,160,0.18)',            // far bloom
      ].join(', ')
    : isTarget
      ? [
          '0 2px 0 rgba(255,255,255,0.07) inset',
          '0 4px 24px rgba(26,127,160,0.25)',
          '0 8px 32px rgba(0,0,0,0.5)',
        ].join(', ')
      : [
          '0 2px 0 rgba(255,255,255,0.05) inset',
          '0 4px 20px rgba(0,0,0,0.45)',
          '0 1px 0 rgba(56,189,248,0.06)',
        ].join(', ');

  return (
    <div
      className="flex-1 rounded-2xl p-5 cursor-pointer text-white"
      style={{
        background: isHovered
          ? 'rgba(16,38,62,0.88)'
          : 'rgba(14, 26, 48, 0.60)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: isHovered
          ? '1px solid rgba(56,189,248,0.45)'
          : isTarget
            ? '1px solid rgba(56,189,248,0.22)'
            : '1px solid rgba(255,255,255,0.10)',
        boxShadow,
        transform,
        transition: 'transform 0.45s cubic-bezier(0.23,1,0.32,1), box-shadow 0.45s cubic-bezier(0.23,1,0.32,1), border-color 0.3s ease, background 0.3s ease, opacity 0.5s ease',
        opacity: isCardVisible ? 1 : 0,
        zIndex: isHovered ? 10 : 1,
        position: 'relative',
        filter: isHovered ? 'brightness(1.12)' : 'brightness(1)',
        willChange: 'transform',
      }}
      onMouseEnter={() => setHovered(index)}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Inner top gloss line */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
        borderRadius: '50%',
      }} />

      <div className="flex items-center gap-3 mb-3">
        <div
          className="rounded-full w-14 h-14 flex items-center justify-center flex-shrink-0"
          style={{
            background: isHovered
              ? 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.12), rgba(0,0,0,0.3))'
              : 'rgba(10,20,35,0.55)',
            boxShadow: isHovered
              ? '0 0 24px rgba(56,189,248,0.45), inset 0 1px 0 rgba(255,255,255,0.15)'
              : 'inset 0 1px 0 rgba(255,255,255,0.06)',
            border: isHovered ? '1px solid rgba(56,189,248,0.35)' : '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.4s ease',
          }}
        >
          <GlowIcon hovered={isHovered} />
        </div>
        <span className="font-bold text-lg tracking-wide">{card.title}</span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>{card.desc}</p>
    </div>
  );
}

// Animated glowing SVG arrow — horizontal
function HArrow({ fromIdx, hovered, direction = 'right' }) {
  const active = hovered === fromIdx;
  const id = `harrow-${fromIdx}-${direction}`;
  return (
    <div className="hidden lg:flex items-center justify-center flex-shrink-0" style={{ width: 36 }}>
      <svg width="36" height="20" viewBox="0 0 36 20" fill="none" overflow="visible">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a7fa0" stopOpacity={active ? 0.9 : 0.3} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={active ? 1 : 0.4} />
          </linearGradient>
          <filter id={`gf-${id}`}>
            <feGaussianBlur stdDeviation={active ? 2 : 1} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {direction === 'right' ? (
          <>
            <line x1="2" y1="10" x2="30" y2="10" stroke={`url(#${id})`} strokeWidth={active ? 2 : 1.2} filter={`url(#gf-${id})`} strokeDasharray={active ? 'none' : '4 3'} style={{ transition: 'stroke-width 0.3s ease' }} />
            <polyline points="24,4 32,10 24,16" fill="none" stroke={`url(#${id})`} strokeWidth={active ? 2 : 1.2} strokeLinejoin="round" filter={`url(#gf-${id})`} />
          </>
        ) : (
          <>
            <line x1="34" y1="10" x2="6" y2="10" stroke={`url(#${id})`} strokeWidth={active ? 2 : 1.2} filter={`url(#gf-${id})`} strokeDasharray={active ? 'none' : '4 3'} style={{ transition: 'stroke-width 0.3s ease' }} />
            <polyline points="12,4 4,10 12,16" fill="none" stroke={`url(#${id})`} strokeWidth={active ? 2 : 1.2} strokeLinejoin="round" filter={`url(#gf-${id})`} />
          </>
        )}
      </svg>
    </div>
  );
}

// Animated glowing SVG arrow — vertical
function VArrow({ fromIdx, hovered }) {
  const active = hovered === fromIdx;
  const id = `varrow-${fromIdx}`;
  return (
    <div className="flex justify-center items-center" style={{ height: 38 }}>
      <svg width="20" height="38" viewBox="0 0 20 38" fill="none" overflow="visible">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a7fa0" stopOpacity={active ? 0.9 : 0.3} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={active ? 1 : 0.4} />
          </linearGradient>
          <filter id={`gf-${id}`}>
            <feGaussianBlur stdDeviation={active ? 2.5 : 1} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <line x1="10" y1="2" x2="10" y2="30" stroke={`url(#${id})`} strokeWidth={active ? 2 : 1.2} filter={`url(#gf-${id})`} strokeDasharray={active ? 'none' : '4 3'} />
        <polyline points="4,24 10,34 16,24" fill="none" stroke={`url(#${id})`} strokeWidth={active ? 2 : 1.2} strokeLinejoin="round" filter={`url(#gf-${id})`} />
      </svg>
    </div>
  );
}

export default function WhyRoamerzSection() {
  const [visible, setVisible] = useState(true);
  const [hovered, setHovered] = useState(null);
  const [drawn, setDrawn] = useState(false);
  const [visibleCards, setVisibleCards] = useState(new Set([0,1,2,3,4,5]));
  const ref = useRef(null);
  const pathRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    // top-left → bottom-right stagger: row1 left→right, then row2 right→left (visual order: 0,1,2,5,4,3)
    const cardOrder = [0, 1, 2, 5, 4, 3];
    const timings =   [0, 150, 300, 480, 620, 760];
    
    const timeouts = cardOrder.map((idx, i) =>
      setTimeout(() => {
        setVisibleCards(prev => new Set([...prev, idx]));
      }, timings[i])
    );
    
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [visible]);

  // Trigger draw animation when the arrow area scrolls into view
  useEffect(() => {
    const onScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      // Fire when bottom 40% of section is visible
      if (rect.bottom < window.innerHeight * 1.3) {
        setDrawn(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);



  return (
    <section
      ref={ref}
      className="relative py-16 md:py-24 px-4 md:px-20 overflow-hidden"
      style={{ background: 'transparent', position: 'relative', zIndex: 10, transition: 'opacity 0.8s ease', opacity: visible ? 1 : 0 }}
    >
      {/* 3D flight-path + nebula background */}
      <FlightPathBackground visible={visible} />

      {/* Soft nebula glow layers */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 20% 40%, rgba(34,211,238,0.05) 0%, transparent 65%), radial-gradient(ellipse 50% 60% at 80% 70%, rgba(251,191,36,0.04) 0%, transparent 65%)'
      }} />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Heading */}
        <div
          className="mb-10 md:mb-12"
          style={{
            transition: 'opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          <h2 className="text-2xl md:text-5xl font-black text-white mb-3">
            <WobbleText text="Why Roamerz Wins" color="#ffffff" />
          </h2>
          {/* Glowing underline */}
          <div style={{
            height: 3,
            width: visible ? 220 : 0,
            background: 'linear-gradient(90deg, #1a7fa0, #38bdf8, transparent)',
            borderRadius: 4,
            boxShadow: '0 0 12px rgba(56,189,248,0.6), 0 0 24px rgba(26,127,160,0.4)',
            transition: 'width 1s cubic-bezier(0.22,1,0.36,1) 0.4s',
            marginBottom: 10,
          }} />
          <p className="text-base md:text-2xl font-bold text-[#1a7fa0]">
            <WobbleText text="Better Discovery. Better T(r)ips." />
          </p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:block" style={{ perspective: '1200px' }}>
          {/* ROW 1: Watch(0) → Explore(1) → Match(2) */}
          <div className="flex items-end gap-0 mb-0">
            <Card card={cards[0]} index={0} hovered={hovered} setHovered={setHovered} visible={visible} isCardVisible={visibleCards.has(0)} />
            <HArrow fromIdx={0} hovered={hovered} direction="right" />
            <Card card={cards[1]} index={1} hovered={hovered} setHovered={setHovered} visible={visible} isCardVisible={visibleCards.has(1)} />
            <HArrow fromIdx={1} hovered={hovered} direction="right" />
            <Card card={cards[2]} index={2} hovered={hovered} setHovered={setHovered} visible={visible} isCardVisible={visibleCards.has(2)} />
          </div>

          {/* DOWN ARROW: from Match (col 3) down to Save (col 3) */}
          <div className="flex items-center justify-center gap-0">
            <div className="flex-1" />
            <div className="w-8 flex-shrink-0" />
            <div className="flex-1" />
            <div className="w-8 flex-shrink-0" />
            <div className="flex-1 flex justify-center">
              <VArrow fromIdx={2} hovered={hovered} />
            </div>
          </div>

          {/* ROW 2: Share(3) ← Plan(4) ← Save(5)  — left-to-right DOM order but arrows point left */}
          <div className="flex items-end gap-0">
            <Card card={cards[3]} index={3} hovered={hovered} setHovered={setHovered} visible={visible} isCardVisible={visibleCards.has(3)} />
            <HArrow fromIdx={4} hovered={hovered} direction="left" />
            <Card card={cards[4]} index={4} hovered={hovered} setHovered={setHovered} visible={visible} isCardVisible={visibleCards.has(4)} />
            <HArrow fromIdx={5} hovered={hovered} direction="left" />
            <Card card={cards[5]} index={5} hovered={hovered} setHovered={setHovered} visible={visible} isCardVisible={visibleCards.has(5)} />
          </div>
        </div>

        {/* Mobile Layout - 2-col on sm/md, 1-col on xs */}
        <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card, idx) => (
            <Card key={idx} card={card} index={idx} hovered={hovered} setHovered={setHovered} visible={visible} isCardVisible={visibleCards.has(idx)} />
          ))}
        </div>

        {/* Bottom strip: micro-CTA + trust line */}
        <div
          className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.8s ease 1s, transform 0.8s ease 1s',
          }}
        >
          {/* "→ Real results" micro-animation */}
          <div className="flex items-center gap-2 group cursor-pointer select-none">
            <span className="text-sm font-semibold text-white/50 group-hover:text-white transition-colors duration-300">
              Real results
            </span>
            <span
              style={{
                display: 'inline-block',
                fontSize: 16,
                color: '#38bdf8',
                transform: 'translateX(0)',
                transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.8))',
              }}
              className="group-hover:[transform:translateX(6px)]"
            >→</span>
          </div>

          {/* Trust line */}
          <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.02em',
          }}>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>Loved by 18k+ travelers</span>
            {' '}building better trips
          </p>
        </div>

      </div>
    </section>
  );
}