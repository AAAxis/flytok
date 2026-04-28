import { Video, UserPlus, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ICONS = {
  video: Video,
  signup: UserPlus,
  report: Flag,
};

const COLORS = {
  video: 'text-sky-400 bg-sky-500/10',
  signup: 'text-emerald-400 bg-emerald-500/10',
  report: 'text-amber-400 bg-amber-500/10',
};

function relativeTime(ts) {
  if (!ts) return '';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return formatDistanceToNow(date, { addSuffix: true });
}

export default function ActivityFeed({ items = [], isLoading }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="text-zinc-200 text-sm font-medium">Live activity</div>
        <div className="text-xs text-zinc-500">Recent events across the platform</div>
      </div>
      <div className="divide-y divide-zinc-800">
        {isLoading && (
          <div className="px-5 py-12 text-center text-sm text-zinc-500">Loading…</div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-zinc-500">
            No activity yet.
          </div>
        )}
        {items.map((item) => {
          const Icon = ICONS[item.kind] ?? Video;
          const color = COLORS[item.kind] ?? COLORS.video;
          return (
            <div key={item.id} className="px-5 py-3 flex items-start gap-3 hover:bg-zinc-800/40 transition-colors">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-200 truncate">{item.title}</div>
                {item.subtitle && (
                  <div className="text-xs text-zinc-500 truncate">{item.subtitle}</div>
                )}
              </div>
              <div className="text-xs text-zinc-500 flex-shrink-0">
                {relativeTime(item.timestamp)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
