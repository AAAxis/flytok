import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { videosRepo, usersRepo } from '@/lib/repositories';
import Logo from '@/components/common/Logo';

function ownerLabelFromUser(user, fallbackUid) {
  const name = (user?.displayName ?? '').trim() || (user?.username ?? '').trim();
  if (name) return name;
  return fallbackUid ? `User ${fallbackUid.slice(0, 6)}` : 'user';
}

export default function Video() {
  const { id } = useParams();
  const { data: video, isLoading } = useQuery({
    queryKey: ['video', id],
    queryFn: () => videosRepo.get(id),
  });
  const { data: owner } = useQuery({
    queryKey: ['user', video?.ownerId],
    queryFn: () => usersRepo.get(video.ownerId),
    enabled: !!video?.ownerId,
  });

  // Update document title and meta tags for sharing
  useEffect(() => {
    if (!video) return;
    const title = video.caption?.slice(0, 60) || 'Roamrez video';
    document.title = `${title} · Roamrez`;
    setMeta('description', video.caption ?? 'A travel video on Roamrez.');
    setMeta('og:title', title, true);
    setMeta('og:description', video.caption ?? 'A travel video on Roamrez.', true);
    setMeta('og:url', window.location.href, true);
    setMeta('og:type', 'video.other', true);
    if (video.downloadURL) setMeta('og:video', video.downloadURL, true);
    setMeta('twitter:card', 'player');
    return () => {
      document.title = 'Roamrez — Travel videos for the curious';
    };
  }, [video]);

  if (isLoading) {
    return (
      <Wrapper>
        <div className="text-zinc-400">Loading…</div>
      </Wrapper>
    );
  }

  if (!video) {
    return (
      <Wrapper>
        <div className="text-zinc-400">Video not found.</div>
        <Link to="/feed" className="text-sky-400 mt-4 inline-block">Browse the feed →</Link>
      </Wrapper>
    );
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ url, title: 'Roamrez video' });
      else {
        await navigator.clipboard.writeText(url);
        alert('Link copied');
      }
    } catch { /* cancelled */ }
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="px-4 py-3 flex items-center justify-between border-b border-zinc-900">
        <Link to="/"><Logo size="sm" /></Link>
        <div className="flex items-center gap-2">
          <a
            href={`flytok://v/${id}`}
            className="text-sky-400 hover:text-sky-300 text-sm"
          >
            Open in app
          </a>
          <button
            type="button"
            onClick={share}
            className="text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 text-sm"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4">
        <div className="relative w-full aspect-[9/16] bg-zinc-950 rounded-lg overflow-hidden">
          <video
            src={video.downloadURL}
            controls
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold">
            {ownerLabelFromUser(owner, video.ownerId)}
          </div>
          {video.caption && (
            <p className="text-sm text-zinc-300 mt-2 whitespace-pre-wrap">{video.caption}</p>
          )}
          {video.hashtags?.length > 0 && (
            <div className="text-sky-400 text-xs mt-3 flex flex-wrap gap-x-2">
              {video.hashtags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
          )}
          {video.location?.label && (
            <div className="text-xs text-zinc-500 mt-3">📍 {video.location.label}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Wrapper({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-zinc-100 p-6">
      <Link to="/" className="mb-6"><Logo size="md" /></Link>
      {children}
    </div>
  );
}

function setMeta(name, content, isProperty = false) {
  if (typeof document === 'undefined') return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
