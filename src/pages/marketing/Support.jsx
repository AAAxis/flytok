import { Link } from 'react-router-dom';
import Logo from '@/components/common/Logo';
import { Mail, ShieldAlert, Trash2, MessageCircle } from 'lucide-react';

const TOPICS = [
  {
    icon: ShieldAlert,
    title: 'Report content or a user',
    body: 'Tap the three-dot menu on any video, comment, or profile inside the app and choose Report. Reports are reviewed within 24 hours.',
  },
  {
    icon: Trash2,
    title: 'Delete your account',
    body: 'Open Profile → Settings → Delete account. This removes your authentication record and clears your profile. Content already shared in chats may persist.',
  },
  {
    icon: MessageCircle,
    title: 'Trouble signing in or uploading',
    body: 'Check that you are on the latest app version. If the issue persists, email us with your device, OS version, and a short description.',
  },
];

export default function Support() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="px-6 py-5 flex justify-between items-center max-w-3xl mx-auto">
        <Link to="/"><Logo size="md" /></Link>
        <nav className="flex gap-6 text-sm text-zinc-400">
          <Link to="/" className="hover:text-zinc-100">Home</Link>
          <a href="https://flytok.vercel.app/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">Privacy</a>
          <a href="https://flytok.vercel.app/terms" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-100">Terms</a>
        </nav>
      </header>

      <article className="px-6 pb-20 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mt-6">Support</h1>
        <p className="text-zinc-500 text-sm">We aim to respond within 24 hours.</p>

        <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-md bg-sky-500/10 text-sky-300 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="text-zinc-100 font-medium">Email us</div>
            <a className="text-sky-400 hover:text-sky-300" href="mailto:support@flytok.app">
              support@flytok.app
            </a>
            <p className="text-sm text-zinc-400 mt-2">
              Include your account email, the device you're using, and a short description of what
              happened. Screenshots help.
            </p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mt-10 mb-4">Common topics</h2>
        <div className="grid gap-4">
          {TOPICS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-zinc-800 text-zinc-300 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold">{title}</h3>
              </div>
              <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold mt-10 mb-3">Legal</h2>
        <p className="text-zinc-300 text-sm">
          See our{' '}
          <a className="text-sky-400" href="https://flytok.vercel.app/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>{' '}
          and{' '}
          <a className="text-sky-400" href="https://flytok.vercel.app/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
        </p>
      </article>
    </div>
  );
}
