import Logo from '@/components/common/Logo';
import { Smartphone, Map, MessageCircle, Shield } from 'lucide-react';

const FEATURES = [
  {
    icon: Smartphone,
    title: 'Travel videos that scroll like TikTok',
    body: 'A vertical video feed of real places from real travelers. Find your next destination in seconds.',
  },
  {
    icon: Map,
    title: 'Pin places on the map',
    body: 'Every clip lives on a map. Tap a pin, watch the video, save it for the trip.',
  },
  {
    icon: MessageCircle,
    title: 'Chat and share',
    body: 'Send videos straight into a chat with your travel crew. Comments, follows, the whole social loop.',
  },
  {
    icon: Shield,
    title: 'Safe by default',
    body: 'Report and block built in. Reports reviewed within 24 hours. Account deletion in one tap.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="px-6 py-5 flex justify-between items-center max-w-6xl mx-auto">
        <Logo size="md" />
        <nav className="flex gap-6 text-sm text-zinc-400">
          <a href="#features" className="hover:text-zinc-100">Features</a>
          <a href="https://flytok.vercel.app/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">Privacy</a>
          <a href="https://flytok.vercel.app/terms" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">Terms</a>
          <a href="https://flytok.vercel.app/support" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">Support</a>
        </nav>
      </header>

      <section className="px-6 pt-12 pb-20 max-w-6xl mx-auto">
        <div className="max-w-3xl">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
            Travel videos for the curious.
          </h1>
          <p className="mt-6 text-lg text-zinc-400 max-w-2xl">
            Roamrez is a vertical video app for travelers. Discover places, share your trips,
            chat with friends, and find what's worth flying for.
          </p>
          <div className="mt-10 flex gap-3">
            <a
              href="#features"
              className="inline-flex items-center px-5 py-3 rounded-md bg-sky-500 hover:bg-sky-400 text-zinc-950 font-medium transition-colors"
            >
              See what's inside
            </a>
            <a
              href="https://apps.apple.com/"
              className="inline-flex items-center px-5 py-3 rounded-md border border-zinc-800 hover:bg-zinc-900 text-zinc-200 font-medium transition-colors"
            >
              Download on iOS
            </a>
          </div>
          <p className="mt-3 text-xs text-zinc-600">Coming soon to the App Store and Google Play.</p>
        </div>
      </section>

      <section id="features" className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
            >
              <div className="w-10 h-10 rounded-md bg-sky-500/10 text-sky-300 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-900 px-6 py-8 max-w-6xl mx-auto flex flex-col sm:flex-row justify-between gap-4 text-sm text-zinc-500">
        <div>© {new Date().getFullYear()} Roamrez</div>
        <div className="flex gap-5">
          <a href="https://flytok.vercel.app/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">Privacy</a>
          <a href="https://flytok.vercel.app/terms" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">Terms</a>
          <a href="https://flytok.vercel.app/support" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">Support</a>
        </div>
      </footer>
    </div>
  );
}
