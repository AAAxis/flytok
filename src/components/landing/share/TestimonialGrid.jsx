import { useState } from 'react';

const TESTIMONIALS = [
  { avatar: 'S', name: 'sofia_explores', color: '#f97316', stars: 5, text: 'Lost in Lisbon\'s alleys and never wanted to be found…', location: 'Lisbon, Portugal', time: '3 days ago', emoji: '🫶', featured: true },
  { avatar: 'M', name: 'marco.travels',   color: '#22d3ee', stars: 5, text: 'Sunrise hike in Patagonia — worth every blister ⛰️', location: 'Patagonia, Argentina', time: '1 week ago', emoji: '🔥' },
  { avatar: 'J', name: 'jakefromearth',   color: '#34d399', stars: 5, text: 'Street food tour in Hanoi changed my life forever 🍜', location: 'Hanoi, Vietnam', time: '5 days ago', emoji: '😍' },
  { avatar: 'A', name: 'alex_roams',      color: '#8b5cf6', stars: 5, text: 'Watched the Northern Lights for 3 hours straight ✨❄️', location: 'Tromsø, Norway', time: '2 weeks ago', emoji: '🌟' },
  { avatar: 'E', name: 'elena.nomad',     color: '#ec4899', stars: 4, text: 'The Amalfi coast at golden hour is pure magic 🌅', location: 'Amalfi, Italy', time: '4 days ago', emoji: '💫' },
  { avatar: 'L', name: 'luna_wanders',    color: '#a855f7', stars: 5, text: 'Roamerz helped me find hidden gems I\'d never have discovered alone 🗺️', location: 'Kyoto, Japan', time: '1 day ago', emoji: '✨' },
];

function StarRow({ count }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ fontSize: 11, color: s <= count ? '#facc15' : 'rgba(255,255,255,0.15)', textShadow: s <= count ? '0 0 6px rgba(250,204,21,0.7)' : 'none' }}>★</span>
      ))}
    </div>
  );
}

function Card({ r, i, visible }) {
  const [hovered, setHovered] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  const handleHover = () => {
    setHovered(true);
    const id = Date.now();
    setFloatingEmojis(prev => [...prev, id]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e !== id)), 1200);
  };

  return (
    <div
      style={{
        position: 'relative',
        background: hovered ? 'rgba(14,32,58,0.97)' : 'rgba(12,24,44,0.88)',
        backdropFilter: 'blur(20px)',
        border: hovered ? `1px solid ${r.color}66` : '1px solid rgba(255,255,255,0.08)',
        borderRadius: r.featured ? 20 : 16,
        padding: r.featured ? '20px' : '16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'pointer', overflow: 'hidden',
        boxShadow: hovered
          ? `0 0 32px ${r.color}33, 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px ${r.color}33`
          : '0 4px 20px rgba(0,0,0,0.4)',
        transform: hovered
          ? 'translateY(-6px) scale(1.02)'
          : (visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.96)'),
        opacity: visible ? 1 : 0,
        transition: `opacity 0.6s ease ${0.3 + i * 0.08}s, transform 0.4s cubic-bezier(0.23,1,0.32,1), box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease`,
        zIndex: hovered ? 10 : 1,
      }}
      onMouseEnter={handleHover}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Inner top gloss */}
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', borderRadius: '50%' }} />

      {/* Floating emojis */}
      {floatingEmojis.map(id => (
        <div key={id} style={{
          position: 'absolute', left: '50%', bottom: 20,
          fontSize: 20, pointerEvents: 'none', zIndex: 20,
          animation: 'floatEmoji 1.2s ease-out forwards',
        }}>{r.emoji}</div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Avatar */}
        <div style={{
          width: r.featured ? 46 : 38, height: r.featured ? 46 : 38,
          borderRadius: '50%', background: r.color, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: r.featured ? 16 : 13, color: '#000', flexShrink: 0,
          border: hovered ? `2px solid ${r.color}` : '2px solid transparent',
          boxShadow: hovered ? `0 0 16px ${r.color}88` : 'none',
          transition: 'all 0.3s ease',
        }}>{r.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 700 }}>@{r.name}</div>
          <StarRow count={r.stars} />
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: r.featured ? 13 : 12, lineHeight: 1.55, margin: 0, fontStyle: r.featured ? 'italic' : 'normal' }}>
        "{r.text}"
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10 }}>📍</span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{r.location}</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{r.time}</span>
      </div>

      <style>{`
        @keyframes floatEmoji {
          0%   { transform: translateX(-50%) translateY(0); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-60px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function TestimonialGrid({ visible }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
      {TESTIMONIALS.map((r, i) => (
        <Card key={i} r={r} i={i} visible={visible} />
      ))}
    </div>
  );
}