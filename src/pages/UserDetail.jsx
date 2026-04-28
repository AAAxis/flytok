import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Bookmark,
  Video,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { usersRepo, videosRepo, moderationRepo } from '@/lib/repositories';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function fmtDate(ts) {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return format(date, 'MMM d, yyyy HH:mm');
}

const TABS = [
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'following', label: 'Following', icon: UserPlus },
  { id: 'saves', label: 'Saves', icon: Bookmark },
];

export default function UserDetail() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('videos');
  const [resetState, setResetState] = useState({ status: 'idle', message: '' });

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', uid],
    queryFn: () => usersRepo.get(uid),
  });

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
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        to="/admin/users"
        className="text-sm text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to users
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <Avatar className="w-20 h-20">
          <AvatarImage src={user.photoURL ?? user.avatarUrl} alt="" />
          <AvatarFallback className="bg-zinc-800 text-zinc-200 text-2xl">
            {(user.displayName ?? user.email ?? '?').toString()[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-zinc-100">
            {user.displayName ?? user.email ?? user.id}
          </h1>
          <div className="text-xs text-zinc-500 font-mono break-all mt-1">{user.id}</div>
          {user.bio && <div className="text-zinc-300 text-sm mt-2">{user.bio}</div>}
          <div className="flex gap-2 mt-3">
            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
              {user.role ?? 'user'}
            </Badge>
            {isDisabled && <Badge variant="destructive">disabled</Badge>}
          </div>
        </div>
      </div>

      <div className="mb-6 text-sm">
        <Detail label="Joined" value={fmtDate(user.createdAt)} />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex border-b border-zinc-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
                activeTab === t.id
                  ? 'border-sky-400 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300',
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'videos' && <UserVideos uid={uid} />}
          {activeTab === 'comments' && <UserComments uid={uid} />}
          {activeTab === 'following' && <UserFollowing uid={uid} />}
          {activeTab === 'saves' && <UserSaves uid={uid} />}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mt-6 space-y-3">
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

function UserVideos({ uid }) {
  const { data: videos = [], isLoading, error } = useQuery({
    queryKey: ['user-videos', uid],
    queryFn: () => videosRepo.byOwner(uid),
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorBlock error={error} />;
  if (videos.length === 0) return <EmptyTab>No videos uploaded.</EmptyTab>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {videos.map((v) => (
        <div key={v.id} className="relative aspect-[9/16] bg-zinc-950 rounded overflow-hidden border border-zinc-800">
          {v.downloadURL ? (
            <video
              src={v.downloadURL}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : null}
          {v.caption && (
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60">
              <div className="text-zinc-100 text-xs truncate">{v.caption}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function UserComments({ uid }) {
  const { data: comments = [], isLoading, error } = useQuery({
    queryKey: ['user-comments', uid],
    queryFn: () => videosRepo.commentsByAuthor(uid),
  });
  if (isLoading) return <Loading />;
  if (error) {
    const msg = String(error.message || '');
    const isIndexErr = /requires.*index/i.test(msg) || msg.includes('failed-precondition');
    return (
      <ErrorBlock
        error={error}
        hint={
          isIndexErr
            ? 'Firestore needs a collection-group index on "comments". Open the link in the error message to auto-create it.'
            : null
        }
      />
    );
  }
  if (comments.length === 0) return <EmptyTab>No comments yet.</EmptyTab>;

  return (
    <ul className="divide-y divide-zinc-800">
      {comments.map((c) => (
        <li key={`${c.videoId}_${c.id}`} className="py-3">
          <div className="text-zinc-100 text-sm">{c.text}</div>
          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
            <span>on video</span>
            <code className="font-mono text-zinc-400">{c.videoId?.slice(0, 12)}…</code>
            <span>·</span>
            <span>{fmtDate(c.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function UserFollowing({ uid }) {
  const { data: ids = [], isLoading, error } = useQuery({
    queryKey: ['user-following', uid],
    queryFn: () => usersRepo.followingOf(uid),
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorBlock error={error} />;
  if (ids.length === 0) return <EmptyTab>Not following anyone.</EmptyTab>;

  return (
    <ul className="divide-y divide-zinc-800">
      {ids.map((otherUid) => (
        <li key={otherUid} className="py-2 text-sm">
          <Link
            to={`/admin/users/${otherUid}`}
            className="text-sky-400 font-mono hover:underline"
          >
            {otherUid}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function UserSaves({ uid }) {
  const { data: ids = [], isLoading, error } = useQuery({
    queryKey: ['user-saves', uid],
    queryFn: () => usersRepo.savesOf(uid),
  });
  const { data: videos = [] } = useQuery({
    queryKey: ['user-saves-videos', uid, ids],
    queryFn: () => videosRepo.byIds(ids),
    enabled: ids.length > 0,
  });
  if (isLoading) return <Loading />;
  if (error) return <ErrorBlock error={error} />;
  if (ids.length === 0) return <EmptyTab>No saved videos.</EmptyTab>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {videos.map((v) => (
        <div key={v.id} className="relative aspect-[9/16] bg-zinc-950 rounded overflow-hidden border border-zinc-800">
          {v.downloadURL ? (
            <video
              src={v.downloadURL}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : null}
          {v.caption && (
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60">
              <div className="text-zinc-100 text-xs truncate">{v.caption}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Loading() {
  return <div className="text-zinc-500 text-sm">Loading…</div>;
}

function EmptyTab({ children }) {
  return <div className="text-zinc-500 text-sm py-8 text-center">{children}</div>;
}

function ErrorBlock({ error, hint }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-md p-3 text-sm">
      <div>{error.message}</div>
      {hint && <div className="text-red-200/80 text-xs mt-2">{hint}</div>}
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
