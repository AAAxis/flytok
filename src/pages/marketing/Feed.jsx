import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart, MessageCircle, Share2, Volume2, VolumeX } from 'lucide-react';
import { videosRepo } from '@/lib/repositories';
import Logo from '@/components/common/Logo';

export default function Feed() {
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['public-feed'],
    queryFn: () => videosRepo.list({ pageSize: 50 }),
  });

  const [muted, setMuted] = useState(true);
  const containerRef = useRef(null);
  const itemRefs = useRef(new Map());
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!videos.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio > 0.7) {
            setActiveId(entry.target.dataset.id);
          }
        }
      },
      { threshold: [0.7], root: containerRef.current },
    );
    itemRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos]);

  return (
    <div className="h-screen w-full bg-black overflow-hidden flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-900 p-4">
        <Link to="/" className="mb-8"><Logo size="md" /></Link>
        <nav className="flex flex-col gap-1 text-sm">
          <NavItem to="/feed" label="Feed" active />
          <NavItem to="/" label="About" />
          <NavItem to="/admin" label="Admin" />
        </nav>
        <div className="mt-auto text-xs text-zinc-600 space-y-1">
          <Link to="/privacy" className="block hover:text-zinc-400">Privacy</Link>
          <Link to="/terms" className="block hover:text-zinc-400">Terms</Link>
        </div>
      </aside>

      <main
        ref={containerRef}
        className="flex-1 h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : videos.length === 0 ? (
          <Empty>No videos yet.</Empty>
        ) : (
          videos.map((v) => (
            <FeedSlide
              key={v.id}
              video={v}
              active={activeId === v.id}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              setRef={(el) => {
                if (el) itemRefs.current.set(v.id, el);
                else itemRefs.current.delete(v.id);
              }}
            />
          ))
        )}
      </main>
    </div>
  );
}

function FeedSlide({ video, active, muted, onToggleMute, setRef }) {
  const videoEl = useRef(null);

  useEffect(() => {
    if (!videoEl.current) return;
    if (active) videoEl.current.play().catch(() => {});
    else videoEl.current.pause();
  }, [active]);

  return (
    <div
      ref={setRef}
      data-id={video.id}
      className="snap-start h-screen w-full flex items-center justify-center relative bg-black"
    >
      <div className="relative w-full max-w-md h-full mx-auto bg-black overflow-hidden">
        <video
          ref={videoEl}
          src={video.downloadURL}
          loop
          playsInline
          muted={muted}
          className="absolute inset-0 w-full h-full object-cover"
          onClick={() => {
            if (videoEl.current?.paused) videoEl.current.play();
            else videoEl.current?.pause();
          }}
        />

        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        <div className="absolute left-4 right-20 bottom-6 text-white pointer-events-none">
          <div className="font-semibold text-sm">
            {video.ownerEmail ?? video.ownerId?.slice(0, 8)}
          </div>
          {video.caption && (
            <div className="text-sm mt-1 leading-snug">{video.caption}</div>
          )}
          {video.hashtags?.length > 0 && (
            <div className="text-sky-300 text-xs mt-2 flex flex-wrap gap-x-2">
              {video.hashtags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="absolute right-3 bottom-6 flex flex-col items-center gap-4">
          <Action icon={Heart} label="Like" onClick={() => alert('Sign in to like — coming soon')} />
          <Link
            to={`/v/${video.id}`}
            className="flex flex-col items-center gap-1 text-white"
            aria-label="Open video"
          >
            <div className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-[11px]">Open</span>
          </Link>
          <Action
            icon={Share2}
            label="Share"
            onClick={async () => {
              const url = `${window.location.origin}/v/${video.id}`;
              try {
                if (navigator.share) await navigator.share({ url, title: 'Roamrez video' });
                else {
                  await navigator.clipboard.writeText(url);
                  alert('Link copied');
                }
              } catch { /* user cancelled */ }
            }}
          />
          <button
            type="button"
            onClick={onToggleMute}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Action({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-white"
    >
      <div className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[11px]">{label}</span>
    </button>
  );
}

function NavItem({ to, label, active }) {
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md transition-colors ${
        active
          ? 'bg-zinc-800/60 text-zinc-100 font-medium'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
      }`}
    >
      {label}
    </Link>
  );
}

function Empty({ children }) {
  return (
    <div className="h-screen flex items-center justify-center text-zinc-500">
      {children}
    </div>
  );
}
