import { useState } from 'react';
import { Search, Filter, AlertTriangle, ShieldAlert, Flag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STATUS_TABS = [
  { id: 'pending', label: 'Pending', count: 0 },
  { id: 'resolved', label: 'Resolved', count: 0 },
  { id: 'dismissed', label: 'Dismissed', count: 0 },
];

const SEVERITY = [
  { id: 'all', label: 'All severity' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const TYPE = [
  { id: 'all', label: 'All types' },
  { id: 'video', label: 'Video' },
  { id: 'comment', label: 'Comment' },
  { id: 'user', label: 'User profile' },
];

export default function Reports() {
  const [status, setStatus] = useState('pending');
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-semibold text-zinc-100">Moderation queue</h1>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <Stat icon={AlertTriangle} label="High severity" value={0} tone="red" />
          <Stat icon={ShieldAlert} label="Awaiting review" value={0} tone="amber" />
          <Stat icon={Flag} label="Total open" value={0} tone="zinc" />
        </div>
      </div>
      <p className="text-sm text-zinc-500 mb-6">User-filed reports across videos, comments, and profiles.</p>

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
            <span className="ml-2 text-xs text-zinc-600">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <Input
            placeholder="Search by reporter, target, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100"
          />
        </div>
        <FilterChip label="Severity" value={severity} options={SEVERITY} onChange={setSeverity} />
        <FilterChip label="Type" value={type} options={TYPE} onChange={setType} />
        <button className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
          <Filter className="w-3 h-3" /> More filters
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-16 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
            <Flag className="w-5 h-5 text-zinc-500" />
          </div>
          <div className="text-zinc-300 text-sm font-medium">No reports in this view</div>
          <div className="text-xs text-zinc-500 mt-1 max-w-md">
            When users tap Report on a video, comment, or profile, those reports land here for review.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  const colors = {
    red: 'text-red-400 bg-red-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    zinc: 'text-zinc-300 bg-zinc-800',
  };
  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-6 h-6 rounded flex items-center justify-center', colors[tone])}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-zinc-200 font-semibold">{value}</span>
        <span className="text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

function FilterChip({ label, value, options, onChange }) {
  const current = options.find((o) => o.id === value) ?? options[0];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-md px-3 py-2 hover:bg-zinc-800/80 cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {label}: {o.label}
        </option>
      ))}
    </select>
  );
}
