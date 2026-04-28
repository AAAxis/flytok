import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { TrendingUp, Users as UsersIcon, Video, Eye, Clock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const RANGES = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
];

function emptySeries(days) {
  return Array.from({ length: days }, (_, i) => ({
    date: format(subDays(new Date(), days - 1 - i), 'MMM d'),
    value: 0,
  }));
}

export default function Analytics() {
  const [rangeId, setRangeId] = useState('7d');
  const range = RANGES.find((r) => r.id === rangeId);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-semibold text-zinc-100">Analytics</h1>
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRangeId(r.id)}
              className={cn(
                'px-3 py-1 text-xs rounded transition-colors',
                rangeId === r.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-zinc-500 mb-6">Engagement, retention, and content distribution.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="New signups"
          subtitle={`Daily, last ${range.label}`}
          icon={UsersIcon}
          variant="area"
          color="#38bdf8"
          data={emptySeries(range.days)}
        />
        <ChartCard
          title="Daily active users"
          subtitle="Unique users opening the app"
          icon={TrendingUp}
          variant="area"
          color="#a78bfa"
          data={emptySeries(range.days)}
        />
        <ChartCard
          title="Video uploads"
          subtitle="Posted per day"
          icon={Video}
          variant="bar"
          color="#34d399"
          data={emptySeries(range.days)}
        />
        <ChartCard
          title="Watch minutes"
          subtitle="Total minutes consumed"
          icon={Clock}
          variant="area"
          color="#fbbf24"
          data={emptySeries(range.days)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankCard title="Top countries" icon={Globe} rows={[]} unit="users" />
        <RankCard title="Top hashtags" icon={Eye} rows={[]} unit="views" />
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, variant, color, data }) {
  const hasData = data.some((d) => d.value > 0);
  const Chart = variant === 'bar' ? BarChart : AreaChart;
  const Series = variant === 'bar' ? Bar : Area;
  const gradientId = `g-${title.replace(/\s+/g, '')}`;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-zinc-200 text-sm font-medium">{title}</div>
          <div className="text-xs text-zinc-500">{subtitle}</div>
        </div>
        <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
      </div>
      <div className="h-44 relative">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            {variant === 'area' && (
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
            )}
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="date" stroke="#52525b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis stroke="#52525b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: '#a1a1aa' }}
              itemStyle={{ color }}
            />
            {variant === 'area' ? (
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
            ) : (
              <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
            )}
          </Chart>
        </ResponsiveContainer>
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-zinc-500 text-xs bg-zinc-900/90 border border-zinc-800 rounded-full px-3 py-1">
              No data yet
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RankCard({ title, icon: Icon, rows, unit }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="text-zinc-200 text-sm font-medium">{title}</div>
        <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-500">No data yet</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.label} className="flex items-center gap-3 text-sm">
              <div className="w-5 text-xs text-zinc-500 font-mono">{i + 1}.</div>
              <div className="flex-1 text-zinc-200 truncate">{r.label}</div>
              <div className="text-zinc-400">
                {r.value.toLocaleString()} <span className="text-zinc-600">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
