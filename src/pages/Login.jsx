import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import Logo from '@/components/common/Logo';

export default function Login() {
  const { login, loginWithGoogle, loginWithApple, sendReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(null); // 'email' | 'google' | 'apple' | 'reset' | null

  async function handleEmail(e) {
    e.preventDefault();
    setError(null);
    setBusy('email');
    try {
      await login(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleProvider(name, fn) {
    setError(null);
    setInfo(null);
    setBusy(name);
    try {
      await fn();
      navigate('/admin/dashboard');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Sign-in failed');
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleReset() {
    setError(null);
    setInfo(null);
    if (!email) {
      setError('Enter your email above first.');
      return;
    }
    setBusy('reset');
    try {
      await sendReset(email);
      setInfo(`Password reset email sent to ${email}.`);
    } catch (err) {
      setError(err.message || 'Could not send reset email');
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <Logo size="lg" showText={false} />
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm text-zinc-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={anyBusy}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 px-4 py-3 text-sm outline-none transition-colors focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40 disabled:opacity-50"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm text-zinc-400">
                Password
              </label>
              <button
                type="button"
                onClick={handleReset}
                disabled={anyBusy}
                className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
              >
                {busy === 'reset' ? 'Sending…' : 'Forgot?'}
              </button>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={anyBusy}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 px-4 py-3 text-sm outline-none transition-colors focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40 disabled:opacity-50"
            />
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}
          {info && <div className="text-sm text-emerald-400">{info}</div>}

          {/* Sign in */}
          <button
            type="submit"
            disabled={anyBusy}
            className="w-full rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition-all hover:from-sky-300 hover:to-blue-400 active:scale-[0.99] disabled:opacity-60"
          >
            {busy === 'email' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* OR divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-zinc-950 px-3 text-xs font-medium tracking-wide text-zinc-500">
              OR
            </span>
          </div>
        </div>

        {/* Social */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleProvider('google', loginWithGoogle)}
            disabled={anyBusy}
            className="w-full flex items-center justify-center gap-3 rounded-lg bg-zinc-900 border border-zinc-800 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            <GoogleIcon />
            {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
          </button>

          <button
            type="button"
            onClick={() => handleProvider('apple', loginWithApple)}
            disabled={anyBusy}
            className="w-full flex items-center justify-center gap-3 rounded-lg bg-zinc-900 border border-zinc-800 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            <AppleIcon />
            {busy === 'apple' ? 'Signing in…' : 'Continue with Apple'}
          </button>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] leading-relaxed text-zinc-500">
          By continuing, you agree to the{' '}
          <a className="text-zinc-400 underline hover:text-zinc-300" href="/terms">
            Terms of use
          </a>{' '}
          and{' '}
          <a className="text-zinc-400 underline hover:text-zinc-300" href="/privacy">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.22-1.18 3.04-.84.9-2.2 1.6-3.36 1.5-.14-1.1.43-2.26 1.16-3.03.83-.88 2.27-1.54 3.38-1.51zM20.5 17.1c-.6 1.38-.89 1.99-1.66 3.21-1.08 1.7-2.6 3.82-4.48 3.84-1.67.02-2.1-1.09-4.37-1.08-2.27.01-2.74 1.1-4.41 1.08-1.88-.02-3.32-1.93-4.4-3.63C-1.3 16.4-1.6 10.86.83 7.92 1.95 6.55 3.7 5.68 5.3 5.68c1.66 0 2.7 1.09 4.07 1.09 1.33 0 2.14-1.09 4.06-1.09 1.45 0 2.99.79 4.08 2.15-3.59 1.96-3 7.08.99 9.27z"/>
    </svg>
  );
}
