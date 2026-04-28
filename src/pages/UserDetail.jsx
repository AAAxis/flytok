import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { usersRepo, moderationRepo } from '@/lib/repositories';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

function fmtDate(ts) {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return format(date, 'MMM d, yyyy HH:mm');
}

export default function UserDetail() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', uid],
    queryFn: () => usersRepo.get(uid),
  });

  const [resetState, setResetState] = useState({ status: 'idle', message: '' });

  const block = useMutation({
    mutationFn: () => moderationRepo.blockUser(uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', uid] }),
  });

  const unblock = useMutation({
    mutationFn: () => moderationRepo.unblockUser(uid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user', uid] }),
  });

  const remove = useMutation({
    mutationFn: () => usersRepo.delete(uid),
    onSuccess: () => navigate('/admin/users'),
  });

  async function sendReset() {
    if (!user?.email) return;
    setResetState({ status: 'sending', message: '' });
    try {
      await sendPasswordResetEmail(firebaseAuth, user.email);
      setResetState({ status: 'sent', message: `Reset email sent to ${user.email}` });
    } catch (err) {
      setResetState({ status: 'error', message: err.message ?? 'Could not send email' });
    }
  }

  if (isLoading) return <div className="p-8 text-zinc-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-300">{error.message}</div>;
  if (!user) {
    return (
      <div className="p-8">
        <Link to="/admin/users" className="text-sky-400 text-sm">← Back to users</Link>
        <div className="mt-6 text-zinc-400">User not found.</div>
      </div>
    );
  }

  const isDisabled = !!user.disabled;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        to="/admin/users"
        className="text-sm text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to users
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <Avatar className="w-16 h-16">
          <AvatarImage src={user.photoURL ?? user.avatarUrl} alt="" />
          <AvatarFallback className="bg-zinc-800 text-zinc-200 text-lg">
            {(user.displayName ?? user.email ?? '?').toString()[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-zinc-100">
            {user.displayName ?? user.email ?? user.id}
          </h1>
          <div className="text-zinc-100 text-sm break-all font-medium">{user.email ?? '—'}</div>
          <div className="text-xs text-zinc-500 font-mono break-all mt-1">{user.id}</div>
          <div className="flex gap-2 mt-3">
            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
              {user.role ?? 'user'}
            </Badge>
            {isDisabled && <Badge variant="destructive">disabled</Badge>}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-6 text-sm">
        <Detail label="Joined" value={fmtDate(user.createdAt)} />
        <Detail label="Last seen" value={fmtDate(user.lastSeenAt)} />
        <Detail label="Videos" value={user.videoCount ?? 0} />
        <Detail label="Followers" value={user.followerCount ?? 0} />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
        <h2 className="text-zinc-100 text-sm font-medium">Account actions</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            onClick={sendReset}
            disabled={!user.email || resetState.status === 'sending'}
            className="gap-1"
          >
            <KeyRound className="w-4 h-4" />
            {resetState.status === 'sending' ? 'Sending…' : 'Send password reset email'}
          </Button>
          {resetState.message && (
            <span
              className={`text-xs ${
                resetState.status === 'error' ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {resetState.message}
            </span>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mt-4 space-y-3">
        <h2 className="text-zinc-100 text-sm font-medium">Moderation</h2>
        <div className="flex flex-wrap gap-2">
          {isDisabled ? (
            <Button
              variant="outline"
              onClick={() => unblock.mutate()}
              disabled={unblock.isPending}
              className="gap-1"
            >
              <ShieldCheck className="w-4 h-4" /> Unblock
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => block.mutate()}
              disabled={block.isPending}
              className="gap-1"
            >
              <ShieldOff className="w-4 h-4" /> Block
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => {
              if (
                confirm(
                  `Delete profile doc for ${user.email ?? user.id}?\nThis does NOT delete the Firebase Auth account.`,
                )
              ) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
            className="gap-1"
          >
            <Trash2 className="w-4 h-4" /> Delete profile
          </Button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className="text-zinc-100 text-sm mt-0.5">{value}</div>
    </div>
  );
}
