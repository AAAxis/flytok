import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Flag, ShieldOff, Trash2, Check, X } from 'lucide-react';
import { reportsRepo, moderationRepo } from '@/lib/repositories';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const STATUS_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
];

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'video', label: 'Videos' },
  { id: 'comment', label: 'Comments' },
  { id: 'user', label: 'Users' },
];

function fmtDate(ts) {
  if (!ts) return '—';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return format(date, 'MMM d, HH:mm');
}

export default function Reports() {
  const [status, setStatus] = useState('open');
  const [typeFilter, setTypeFilter] = useState('all');
  const qc = useQueryClient();

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['reports', status],
    queryFn: () => reportsRepo.list({ status, pageSize: 200 }),
  });

  const filtered = typeFilter === 'all'
    ? reports
    : reports.filter((r) => r?.target?.kind === typeFilter);

  const resolve = useMutation({
    mutationFn: ({ id, action }) => reportsRepo.resolve(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });

  const dismiss = useMutation({
    mutationFn: (id) => reportsRepo.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });

  const deleteVideo = useMutation({
    mutationFn: (videoId) => moderationRepo.deleteVideo(videoId),
  });

  const deleteComment = useMutation({
    mutationFn: ({ videoId, commentId }) => moderationRepo.deleteComment(videoId, commentId),
  });

  const blockUser = useMutation({
    mutationFn: (uid) => moderationRepo.blockUser(uid),
  });

  async function handleResolveAndAct(report, action) {
    try {
      if (action === 'delete-video' && report.target?.videoId) {
        await deleteVideo.mutateAsync(report.target.videoId);
      }
      if (action === 'delete-comment' && report.target?.videoId && report.target?.commentId) {
        await deleteComment.mutateAsync({
          videoId: report.target.videoId,
          commentId: report.target.commentId,
        });
      }
      if (action === 'block-user') {
        const uid =
          report.target?.userId ?? report.target?.ownerId ?? report.target?.authorId;
        if (uid) await blockUser.mutateAsync(uid);
      }
      await resolve.mutateAsync({ id: report.id, action: 'resolved' });
    } catch (err) {
      alert(err?.message ?? 'Action failed');
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-semibold text-zinc-100">Moderation queue</h1>
        <div className="text-sm text-zinc-500">
          {isLoading ? 'Loading…' : `${filtered.length} ${status}`}
        </div>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        User-filed reports across videos, comments, and profiles. Acting on a report resolves it.
      </p>

      <div className="flex border-b border-zinc-800 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatus(tab.id)}
            className={cn(
              'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
              status === tab.id
                ? 'border-sky-400 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-md px-3 py-2"
        >
          {TYPE_FILTERS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-md p-3 mb-4 text-sm">
          {error.message}
        </div>
      )}

      {filtered.length === 0 && !isLoading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-16 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
            <Flag className="w-5 h-5 text-zinc-500" />
          </div>
          <div className="text-zinc-300 text-sm font-medium">No reports in this view</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              status={status}
              onAct={(action) => handleResolveAndAct(r, action)}
              onResolve={() => resolve.mutate({ id: r.id, action: 'resolved' })}
              onDismiss={() => dismiss.mutate(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, status, onAct, onResolve, onDismiss }) {
  const t = report.target ?? {};
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex gap-4">
      <div className="flex-shrink-0">
        <Badge variant="secondary" className="capitalize">
          {t.kind ?? 'unknown'}
        </Badge>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200">
          <span className="font-medium capitalize">{report.reason ?? 'reported'}</span>
          {report.note && <span className="text-zinc-400"> — {report.note}</span>}
        </div>
        <div className="mt-1 text-xs text-zinc-500 font-mono break-all">
          {t.kind === 'video' && `video: ${t.videoId}`}
          {t.kind === 'comment' && `comment: ${t.commentId} on video: ${t.videoId}`}
          {t.kind === 'user' && `user: ${t.userId}`}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Reporter: {report.reporterEmail ?? report.reporterId} · {fmtDate(report.createdAt)}
        </div>
      </div>
      {status === 'open' && (
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {t.kind === 'video' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onAct('delete-video')}
              className="gap-1"
            >
              <Trash2 className="w-3 h-3" /> Delete video
            </Button>
          )}
          {t.kind === 'comment' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onAct('delete-comment')}
              className="gap-1"
            >
              <Trash2 className="w-3 h-3" /> Delete comment
            </Button>
          )}
          {(t.kind === 'user' || t.ownerId || t.authorId) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAct('block-user')}
              className="gap-1"
            >
              <ShieldOff className="w-3 h-3" /> Block user
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onResolve} className="gap-1">
            <Check className="w-3 h-3" /> Resolve
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-1">
            <X className="w-3 h-3" /> Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
