import { useEffect, useState, useRef } from 'react';

const VIDEOS = [
  {
    video: 'https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/c34766032_generated_video.mp4',
    caption: 'Chasing sunsets & warm waves 🌅',
    user: '@beachvibes',
    likes: '142K',
    comments: '3.2K',
    music: 'Tropical Feels — Lo-fi Mix',
    accent: '#fbbf24',
  },
  {
    video: 'https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/9a2decda5_generated_video.mp4',
    caption: 'Every summit is worth it ⛰️',
    user: '@trailblazer',
    likes: '89K',
    comments: '1.8K',
    music: 'Epic Journey — Cinematic',
    accent: '#fb923c',
  },
  {
    video: 'https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/fb3ef615d_generated_video.mp4',
    caption: 'Fresh powder, no tracks 🎿❄️',
    user: '@snowchaser',
    likes: '203K',
    comments: '5.1K',
    music: 'Adrenaline Rush — EDM',
    accent: '#93c5fd',
  },
  {
    video: 'https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/ccf9ad5da_generated_video.mp4',
    caption: 'Lost in the music ✨🎭',
    user: '@festivallife',
    likes: '387K',
    comments: '12K',
    music: 'Festival Anthem 2024',
    accent: '#a855f7',
  },
  {
    video: 'https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/69e4219ba_generated_video.mp4',
    caption: 'Best street food in the world 🍜🔥',
    user: '@streetfoodking',
    likes: '521K',
    comments: '9.7K',
    music: 'Asian Street Vibes',
    accent: '#f59e0b',
  },
  {
    video: 'https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/e993d3939_generated_video.mp4',
    caption: 'Full throttle on open water 🌊🏄',
    user: '@jetskijunkie',
    likes: '315K',
    comments: '7.4K',
    music: 'Ride The Wave — Summer Mix',
    accent: '#22d3ee',
  },
  {
    video: 'https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/924368337_generated_video.mp4',
    caption: 'The ocean has a whole other world 🐠🤿',
    user: '@deepdiverdave',
    likes: '178K',
    comments: '4.2K',
    music: 'Ocean Depths — Ambient',
    accent: '#06b6d4',
  },
  {
    video: 'https://media.base44.com/videos/public/69fdbea1d88b5185b3e0b8ce/1d7ebc4b5_generated_video.mp4',
    caption: 'Riding barrels like it\'s nothing 🏄‍♂️🌊',
    user: '@wavehunter',
    likes: '612K',
    comments: '11.3K',
    music: 'Surf\'s Up — Cali Vibes',
    accent: '#0ea5e9',
  },
];

function ActionBtn({ icon, count }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 18, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }}>{icon}</span>
      {count ? <span style={{ color: 'white', fontSize: 7, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{count}</span> : null}
    </div>
  );
}

function VideoSlide({ video }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flexShrink: 0 }}>
      <video
        key={video.video}
        src={video.video}
        autoPlay
        loop
        muted
        playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 35%, transparent 50%, rgba(0,0,0,0.75) 100%)',
      }} />
      {/* Status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px', zIndex: 10,
      }}>
        <span style={{ color: 'white', fontSize: 7, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>9:41</span>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ color: 'white', fontSize: 7 }}>●●●</span>
          <span style={{ color: 'white', fontSize: 7 }}>▮▮</span>
        </div>
      </div>
      {/* Right action buttons */}
      <div style={{
        position: 'absolute', right: 8, bottom: 55, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          border: '2px solid white', overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
        }}>
          <div style={{
            width: '100%', height: '100%',
            background: video.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 12, color: '#000',
          }}>
            {video.user[1].toUpperCase()}
          </div>
        </div>
        <ActionBtn icon="❤️" count={video.likes} />
        <ActionBtn icon="💬" count={video.comments} />
        <ActionBtn icon="⋯" count="" />
      </div>
      {/* Bottom info */}
      <div style={{ position: 'absolute', left: 8, bottom: 20, right: 52, zIndex: 10 }}>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 10, marginBottom: 3, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
          {video.user}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.95)', fontSize: 8.5, marginBottom: 5, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
          {video.caption}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8 }}>🎵</span>
          <div style={{
            color: 'rgba(255,255,255,0.85)', fontSize: 7.5,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 110,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}>
            {video.music}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PhoneVideoScroll({ visible }) {
  const [offset, setOffset] = useState(0); // in units of screen height (0 = first, 1 = second, etc.)
  const [transitioning, setTransitioning] = useState(false);
  const currentRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      const next = (currentRef.current + 1) % VIDEOS.length;
      currentRef.current = next;
      setTransitioning(true);
      setOffset(next);
      // After transition ends, reset without animation so it's seamless on wrap
    }, 4000);
    return () => clearInterval(interval);
  }, [visible]);

  const screenHeight = 424; // inner screen height in px

  return (
    <div style={{ perspective: '1000px', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0' }}>
      {/* 3D Phone Shell */}
      <div style={{
        width: 220,
        height: 440,
        borderRadius: 36,
        background: '#111',
        border: '3px solid #2a2a2a',
        boxShadow: '0 40px 80px rgba(0,0,0,0.8), 12px 12px 40px rgba(0,0,0,0.5), -2px -2px 10px rgba(255,255,255,0.04)',
        transform: 'rotateY(-12deg) rotateX(4deg)',
        transformStyle: 'preserve-3d',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>

        {/* Glare overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(120deg, rgba(255,255,255,0.08) 0%, transparent 45%)',
          borderRadius: 34,
          pointerEvents: 'none',
          zIndex: 50,
        }} />

        {/* Notch */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          width: 68, height: 16, background: '#0a0a0a', borderRadius: 12, zIndex: 50,
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
        }} />

        {/* Screen */}
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8, bottom: 8,
          borderRadius: 28,
          overflow: 'hidden',
          background: '#000',
        }}>
          {/* Scrolling strip — all videos stacked vertically, translated up */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: `${VIDEOS.length * 100}%`,
            transform: `translateY(-${(offset / VIDEOS.length) * 100}%)`,
            transition: transitioning ? 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {VIDEOS.map((video, i) => (
              <div key={i} style={{ width: '100%', height: `${100 / VIDEOS.length}%`, flexShrink: 0 }}>
                <VideoSlide video={video} />
              </div>
            ))}
          </div>
        </div>

        {/* Home bar */}
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          width: 55, height: 4, background: '#555', borderRadius: 4, zIndex: 50,
        }} />
      </div>
    </div>
  );
}