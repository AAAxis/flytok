import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, subDays } from 'date-fns';

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, i) => ({
    date: format(subDays(new Date(), 6 - i), 'MMM d'),
    signups: 0,
  }));
}

export default function SignupChart({ data }) {
  const series = data?.length ? data : lastSevenDays();
  const hasData = series.some((d) => d.signups > 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-zinc-200 text-sm font-medium">Signups</div>
          <div className="text-xs text-zinc-500">Last 7 days</div>
        </div>
      </div>
      <div className="h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="date" stroke="#52525b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis stroke="#52525b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: '#a1a1aa' }}
              itemStyle={{ color: '#38bdf8' }}
            />
            <Area
              type="monotone"
              dataKey="signups"
              stroke="#38bdf8"
              strokeWidth={2}
              fill="url(#signupGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-zinc-500 text-xs bg-zinc-900/90 border border-zinc-800 rounded-full px-3 py-1">
              No signups yet
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
