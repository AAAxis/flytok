import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import ShareParticles from './share/ShareParticles';
import TestimonialGrid from './share/TestimonialGrid';

const PLACEHOLDERS = [
  "Lost in Lisbon's alleys and never wanted to be found…",
  "Sunrise hike in Patagonia — worth every blister ⛰️",
  "That hidden beach in Bali no one talks about…",
  "Street food in Hanoi that changed my life forever 🍜",
];

const TRENDING = ['Hidden Gems', 'Solo Travel', 'Road Trips', 'Cultural Shock', 'Foodie Finds', 'Night Adventures'];

export default function ShareSection() {
  const [visible, setVisible] = useState(true);
  const [text, setText] = useState('');
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [submitted, setSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [count, setCount] = useState(18400);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Rotate placeholders
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % PLACEHOLDERS.length;
      setPlaceholder(PLACEHOLDERS[i]);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Animate counter
  useEffect(() => {
    if (!visible) return;
    const target = 18472;
    const step = Math.ceil((target - 18400) / 40);
    const interval = setInterval(() => {
      setCount(c => {
        if (c >= target) { clearInterval(interval); return target; }
        return c + step;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [visible]);

  const handleSubmit = () => {
    if (!text.trim()) return;
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setText(''); }, 3000);
  };

  return (
    <section
      id="share"
      ref={ref}
      className="relative py-16 md:py-24 px-4 sm:px-6 md:px-16 overflow-hidden"
      style={{
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.8s ease',
      }}
    >
      {/* Subtle tint */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,10,20,0.32)', zIndex: 0, pointerEvents: 'none' }} />

      <ShareParticles />

      <div className="relative z-10 max-w-6xl mx-auto">

        {/* Live counter */}
        <div
          style={{
            textAlign: 'center', marginBottom: 40,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s',
          }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 999, padding: '8px 20px',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', display: 'inline-block' }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              Join <span style={{ color: '#38bdf8', fontWeight: 800 }}>{count.toLocaleString()}</span> travelers sharing their stories
            </span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">

          {/* LEFT: Input */}
          <div
            style={{
              flex: '0 0 auto', width: '100%', maxWidth: 480,
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s',
            }}
          >
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Share your<br />
              <span style={{ background: 'linear-gradient(90deg, #38bdf8, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>feelings.</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Your story might become someone's inspiration.
            </p>

            {/* Card */}
            <div style={{
              background: 'rgba(10,24,44,0.88)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(56,189,248,0.25)',
              borderRadius: 20,
              padding: '20px',
              boxShadow: '0 0 40px rgba(56,189,248,0.08), 0 20px 60px rgba(0,0,0,0.5)',
            }}>
              {/* Stars */}
              <div className="flex gap-1 mb-4" onMouseLeave={() => setHoveredStar(0)}>
                {[1,2,3,4,5].map(star => (
                  <span
                    key={star}
                    onMouseEnter={() => setHoveredStar(star)}
                    onClick={() => setHoveredStar(star)}
                    onTouchStart={() => setHoveredStar(star)}
                    style={{
                      fontSize: 26, cursor: 'pointer',
                      padding: '4px 2px',
                      color: star <= hoveredStar ? '#facc15' : 'rgba(255,255,255,0.18)',
                      transition: 'color 0.15s ease, text-shadow 0.15s ease',
                      textShadow: star <= hoveredStar ? '0 0 12px rgba(250,204,21,0.9)' : 'none',
                      userSelect: 'none',
                    }}>★</span>
                ))}
              </div>

              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={placeholder}
                rows={4}
                className="w-full bg-transparent text-white placeholder-white/25 resize-none outline-none text-sm leading-relaxed border-b border-white/10 focus:border-cyan-500/40 transition pb-3"
                style={{ fontFamily: 'inherit' }}
              />

              <div className="flex items-center justify-between mt-4">
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>{text.length} / 280</span>
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim() || submitted}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', borderRadius: 999, fontWeight: 700, fontSize: 13,
                    background: submitted ? 'rgba(56,189,248,0.15)' : text.trim() ? 'linear-gradient(135deg, #1a7fa0, #0e5f7a)' : 'rgba(255,255,255,0.06)',
                    color: submitted ? '#38bdf8' : text.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                    border: submitted ? '1px solid rgba(56,189,248,0.4)' : '1px solid transparent',
                    cursor: text.trim() && !submitted ? 'pointer' : 'default',
                    boxShadow: text.trim() ? '0 0 20px rgba(56,189,248,0.25)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Send size={13} />
                  {submitted ? 'Shared! ✨' : 'Share feeling'}
                </button>
              </div>
            </div>

            {/* Trending chips */}
            <div style={{ marginTop: 20 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Trending</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TRENDING.map(t => (
                  <button key={t} onClick={() => setText(t + ' ')}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)',
                      color: 'rgba(255,255,255,0.55)', cursor: 'pointer', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.15)'; e.currentTarget.style.color = '#38bdf8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                  >#{t}</button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Testimonial grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <TestimonialGrid visible={visible} />
          </div>
        </div>

        {/* Trust bar */}
        <div
          style={{
            marginTop: 56, textAlign: 'center',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease 1s',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>As featured in</p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            {['Lonely Planet', 'Travel + Leisure', 'National Geographic', 'Forbes Travel'].map(brand => (
              <span key={brand} style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>{brand}</span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}