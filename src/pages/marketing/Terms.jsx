import { Link } from 'react-router-dom';
import Logo from '@/components/common/Logo';

export default function Terms() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="px-6 py-5 flex justify-between items-center max-w-3xl mx-auto">
        <Link to="/"><Logo size="md" /></Link>
        <nav className="flex gap-6 text-sm text-zinc-400">
          <Link to="/" className="hover:text-zinc-100">Home</Link>
          <Link to="/privacy" className="hover:text-zinc-100">Privacy</Link>
        </nav>
      </header>

      <article className="px-6 pb-20 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mt-6">Terms of Service</h1>
        <p className="text-zinc-500 text-sm">Last updated April 2026.</p>

        <h2 className="text-xl font-semibold mt-8">Welcome to Flytok</h2>
        <p className="text-zinc-300 mt-3">
          By creating a Flytok account or using the app, you agree to these terms. If you don't
          agree, don't use Flytok.
        </p>

        <h2 className="text-xl font-semibold mt-8">Your account</h2>
        <p className="text-zinc-300 mt-3">
          You are responsible for activity on your account and for the content you upload. Don't
          share your password. You must be at least 13 years old to use Flytok.
        </p>

        <h2 className="text-xl font-semibold mt-8">Content rules</h2>
        <p className="text-zinc-300 mt-3">
          You may not upload content that is illegal, sexually explicit, hateful, harassing, or
          that infringes the rights of others. We may remove content and suspend accounts at our
          discretion.
        </p>

        <h2 className="text-xl font-semibold mt-8">Reporting and moderation</h2>
        <p className="text-zinc-300 mt-3">
          Use the in-app Report button to flag objectionable content. We aim to review reports
          within 24 hours and act on them. Repeat offenders are removed.
        </p>

        <h2 className="text-xl font-semibold mt-8">Termination</h2>
        <p className="text-zinc-300 mt-3">
          You may delete your account at any time from your profile. We may suspend or terminate
          accounts that violate these terms.
        </p>

        <h2 className="text-xl font-semibold mt-8">Disclaimer</h2>
        <p className="text-zinc-300 mt-3">
          Flytok is provided "as is" without warranties. We are not liable for damages arising
          from your use of the service.
        </p>

        <h2 className="text-xl font-semibold mt-8">Contact</h2>
        <p className="text-zinc-300 mt-3">
          Questions? Email <a className="text-sky-400" href="mailto:support@flytok.app">support@flytok.app</a>.
        </p>
      </article>
    </div>
  );
}
