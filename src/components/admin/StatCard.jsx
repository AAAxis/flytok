import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatCard({
  label,
  value,
  delta,
  deltaLabel = 'vs last week',
  icon: Icon,
  isLoading = false,
  error,
}) {
  let display;
  if (error) display = '—';
  else if (isLoading) display = '…';
  else if (value == null) display = '—';
  else display = typeof value === 'number' ? value.toLocaleString() : value;

  const trend =
    typeof delta === 'number'
      ? delta > 0
        ? 'up'
        : delta < 0
          ? 'down'
          : 'flat'
      : null;

  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-zinc-600" />}
      </div>
      <div className="text-3xl font-semibold mt-2 text-zinc-100">{display}</div>
      {trend && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs mt-2',
            trend === 'up' && 'text-emerald-400',
            trend === 'down' && 'text-red-400',
            trend === 'flat' && 'text-zinc-500',
          )}
        >
          <TrendIcon className="w-3 h-3" />
          <span className="font-medium">{Math.abs(delta)}%</span>
          <span className="text-zinc-500">{deltaLabel}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-red-400 mt-2 truncate" title={error.message}>
          {error.message}
        </div>
      )}
    </div>
  );
}
