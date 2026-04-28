import { Link } from 'react-router-dom';
import Logo from '@/components/common/Logo';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="px-6 py-5 flex justify-between items-center max-w-3xl mx-auto">
        <Link to="/"><Logo size="md" /></Link>
        <nav className="flex gap-6 text-sm text-zinc-400">
          <Link to="/" className="hover:text-zinc-100">Home</Link>
          <Link to="/terms" className="hover:text-zinc-100">Terms</Link>
        </nav>
      </header>

      <article className="px-6 pb-20 max-w-3xl mx-auto prose prose-invert">
        <h1 className="text-3xl font-bold mt-6">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm">Last updated April 2026.</p>

        <h2 className="text-xl font-semibold mt-8">What we collect</h2>
        <ul className="list-disc pl-5 text-zinc-300 space-y-2 mt-3">
          <li>Account data: email address, sign-in provider (Apple, Google, or password), and any display info you provide.</li>
          <li>Content: videos, captions, comments, and chat messages you create.</li>
          <li>Device data: when you allow it, your approximate location for the Map feature.</li>
          <li>Diagnostics: crash reports to keep the app stable.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">How we use it</h2>
        <p className="text-zinc-300 mt-3">
          We use this data to operate Flytok — to show you a feed, deliver chats, fix bugs, and
          keep the service safe. We do not sell your personal data.
        </p>

        <h2 className="text-xl font-semibold mt-8">Sharing</h2>
        <p className="text-zinc-300 mt-3">
          Content you post is visible to other Flytok users. We use Firebase (Google Cloud) for
          authentication, storage, database, and crash reporting; data is processed under
          Google's terms.
        </p>

        <h2 className="text-xl font-semibold mt-8">Your choices</h2>
        <p className="text-zinc-300 mt-3">
          You can block users, report content, and delete your account at any time from your
          profile inside the app. Deleting your account removes your authentication record and
          clears your profile details. Content you've shared may persist in others' chats.
        </p>

        <h2 className="text-xl font-semibold mt-8">Children</h2>
        <p className="text-zinc-300 mt-3">
          Flytok is not directed to children under 13. We do not knowingly collect data from
          children under 13.
        </p>

        <h2 className="text-xl font-semibold mt-8">Contact</h2>
        <p className="text-zinc-300 mt-3">
          Questions? Email <a className="text-sky-400" href="mailto:support@flytok.app">support@flytok.app</a>.
        </p>
      </article>
    </div>
  );
}
