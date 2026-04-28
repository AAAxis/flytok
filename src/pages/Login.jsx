import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/common/Logo';

export default function Login() {
  const { login, loginWithGoogle, sendReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(null); // 'email' | 'google' | 'reset' | null

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

  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setBusy('google');
    try {
      await loginWithGoogle();
      navigate('/admin/dashboard');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google sign-in failed');
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        <form
          onSubmit={handleEmail}
          className="space-y-4 bg-zinc-900 border border-zinc-800 rounded-lg p-6"
        >
          <div className="text-zinc-200 text-base font-medium">Sign in</div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-400">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
              disabled={anyBusy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-400">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
              disabled={anyBusy}
            />
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={anyBusy}
            className="text-xs text-sky-400 hover:text-sky-300 self-end disabled:opacity-50"
          >
            {busy === 'reset' ? 'Sending…' : 'Forgot password?'}
          </button>

          {error && <div className="text-sm text-red-400">{error}</div>}
          {info && <div className="text-sm text-emerald-400">{info}</div>}
          <Button type="submit" disabled={anyBusy} className="w-full">
            {busy === 'email' ? 'Signing in…' : 'Sign in'}
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-zinc-900 px-2 text-xs text-zinc-500">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={anyBusy}
            className="w-full flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 rounded-md py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <GoogleIcon />
            {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500 mt-4">
          Admins and advertisers only. Need access? Contact{' '}
          <a className="text-sky-400" href="mailto:support@flytok.app">support</a>.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
